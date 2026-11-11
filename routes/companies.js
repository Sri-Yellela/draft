// routes/companies.js — A50 step 4: company list management (admin-gated).
//
// ⛔ The same rule as every writing admin route: adding a company is DRY BY DEFAULT — the first POST
// probes the board and reports what it found; only a second POST with confirm:true AND the state the
// operator saw (expectState) writes, and only when the board is alive (live or empty). A board that
// answers 404 is never added. Disabling is reversible (active = 0) and logged.
import { actorOf } from "../services/actor.js";
import express, { Router } from "express";
import { listCompanies, harvestedSuggestions, validateBoard, addCompany, setCompanyActive, ATS_FETCHERS } from "../services/companyList.js";
import { trancheGate } from "../services/diskGauge.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { createBackupAsync } from "../scripts/backup.js";   // D82 C: an approved candidate batch is added only after a backup
import { heatReport, boardCounts, boardCountsVia } from "../services/companyHeat.js";
import { listCandidates, discoveryStatus, planApproval, approveCandidates, rejectCandidates, resetBreaker, runCandidateProbe, probeDue, PROBE_BATCH } from "../services/companyCandidates.js";

const DEFAULT_DATA_DIR = () => process.env.RM_DATA_DIR || "data";

export function createCompaniesRouter(db, requireAdmin, { fetchers = ATS_FETCHERS, dataDir = DEFAULT_DATA_DIR(),
                                                            gate = (companies) => trancheGate(db, dataDir, { companies }),
                                                            backup = (label) => createBackupAsync(label, { db }), env = process.env, read = null } = {}) {
  const router = Router();
  router.use(requireAdmin);
  router.use(express.json({ limit: "64kb" }));

  router.get("/", async (_req, res) => {
    // D80 E: each active company's hiring heat and the deactivation PROPOSALS — read-only; the owner presses Disable.
    // ⛔ A162 (46a): the posting counts are ONE grouped pass, run on the read-worker pool when there is one — this tab
    // used to hold the event loop for minutes (the whole site froze while it loaded).
    try {
      const now = Math.floor(Date.now() / 1000);
      const counts = read ? await boardCountsVia(read, { now }) : boardCounts(db, { now });
      const heat = heatReport(db, { now, counts });
      const byId = new Map(heat.companies.map((c) => [c.id, c]));
      const companies = listCompanies(db, { counts }).map((c) => ({ ...c, heat: byId.get(c.id)?.heat ?? null, new_30d: byId.get(c.id)?.new_30d ?? null }));
      res.json({ companies, suggestions: harvestedSuggestions(db), atsTypes: Object.keys(fetchers),
                 heat: { ...heat.summary, hotDays: heat.hotDays, dormantDays: heat.dormantDays, target: heat.target, proposals: heat.proposals } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ⭐ 46a (owner 11-10): a careers page URL in the slug field is read with the crawl's one URL parser —
  // "https://zoom.wd5.myworkdayjobs.com/Zoom" → workday · 5|zoom|Zoom — so a multi-part board need not be typed by hand.
  const boardOf = (atsType, slug) => {
    const s = String(slug || "").trim();
    if (!/^https?:\/\//i.test(s)) return { atsType, slug: s };
    const p = harvestPairOf(s);
    return p?.atsType ? { atsType: p.atsType, slug: p.slug, fromUrl: true } : { atsType, slug: s };
  };
  router.post("/validate", async (req, res) => {
    const { company } = req.body || {};
    const b = boardOf(req.body?.atsType, req.body?.slug);
    res.json({ ...(await validateBoard({ atsType: b.atsType, slug: b.slug, company, fetchers })), ...(b.fromUrl ? { board: { atsType: b.atsType, slug: b.slug } } : {}) });
  });

  router.post("/", async (req, res) => {
    const { company, bucketRole = null, confirm = false, expectState = null } = req.body || {};
    const { atsType, slug } = boardOf(req.body?.atsType, req.body?.slug);   // a pasted careers URL → its pair
    if (!company || !String(company).trim()) return res.status(400).json({ error: "company_required", message: "Name the company." });
    const validation = await validateBoard({ atsType, slug, company, fetchers });
    if (!confirm) {
      return res.json({ dryRun: true, validation, board: { atsType, slug },
        note: validation.ok ? `Nothing was added. POST again with confirm: true and expectState: "${validation.state}" to add it.`
                            : "This board cannot be added." });
    }
    if (!validation.ok) return res.status(409).json({ error: "board_not_alive", validation });
    // ⛔ D77 → D74 P3: no company is added while the projected disk after it is above the gate.
    const disk = gate(1);
    if (!disk.ok) return res.status(507).json({ error: disk.reason, disk });
    if (validation.state !== expectState) {
      return res.status(409).json({ error: "board_changed", validation,
        message: `The board now reads "${validation.state}", not "${expectState}". Look again before adding it.` });
    }
    // D80: the evidence is what the operator saw on the board when they added it.
    const evidence = `admin add ${new Date().toISOString().slice(0, 10)}: ${validation.message}`;
    const out = addCompany(db, { company, atsType, slug, bucketRole, adminUserId: actorOf(req), evidence });
    if (!out.ok) return res.status(409).json({ error: out.code === "exists" ? "already_configured" : out.code, company: out.company });
    res.status(201).json({ ok: true, company: out.company, validation,
      note: "Added and active. The next crawl reads it; its postings pass the same dedup and US-only gate as every source." });
  });

  // ⛔ D82 C · THE CANDIDATE POOL — what the discovery jobs FOUND (they never add). Read: ranked, with the probe's
  // evidence and the guards' state. Approve: dry first (what would be added, what is refused and why, the disk
  // gate); then confirm:true with expectIds = the dry run's eligible ids → a backup, the disk gate, and each add
  // through addCompany WITH its evidence (D80). Reject keeps the row, so the next sweep never re-queues it.
  router.get("/candidates", (req, res) => {
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    res.json({ ...listCandidates(db, { status }), discovery: discoveryStatus(db, env), probeRun, probeDue: probeDue(db) });
  });

  router.post("/candidates/approve", async (req, res) => {
    const { ids = [], confirm = false, expectIds = null } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids_required" });
    const plan = planApproval(db, ids);
    const want = plan.eligible.map((e) => e.id);
    const disk = gate(Math.max(1, want.length));
    if (!confirm) {
      return res.json({ dryRun: true, ...plan, disk,
        note: want.length ? `Nothing was added. POST again with confirm: true and expectIds: [${want.join(", ")}] to add ${want.length}.`
                          : "None of these can be added." });
    }
    const expected = Array.isArray(expectIds) ? expectIds.map(Number).sort((a, b) => a - b) : null;
    if (!expected || expected.join(",") !== want.join(",")) {
      return res.status(409).json({ error: "plan_changed", ...plan, message: "What would be added changed since the dry run. Look again." });
    }
    if (!want.length) return res.status(409).json({ error: "nothing_eligible", ...plan });
    if (!disk.ok) return res.status(507).json({ error: disk.reason, disk });              // ⛔ D77
    if (typeof backup !== "function") return res.status(503).json({ error: "backup_unavailable", message: "No backup could be taken; nothing was added." });
    let snapshot;
    // ⛔ 46g (owner 11-11, "the admin panel is currently stuck on loading"): this was createBackup's fs.copyFileSync — a
    // 6.2 GB copy on the one thread held the WHOLE site 95 s (16:05Z). Now SQLite's online backup, a step at a time.
    try { snapshot = await backup("pre-d82-candidates"); }
    catch (e) { return res.status(500).json({ error: "backup_failed", message: e.message }); }
    const out = approveCandidates(db, plan, { adminUserId: actorOf(req) });
    res.json({ ok: true, backup: snapshot?.filename ?? null, ...out, refused: plan.refused,
      note: "Added and active. Each carries its evidence; Disable on the company list reverses it." });
  });

  router.post("/candidates/reject", (req, res) => {
    const { ids = [], reason = "owner" } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids_required" });
    res.json(rejectCandidates(db, ids, { adminUserId: actorOf(req), reason }));
  });

  // ⭐ 46a (owner 11-10): "Re-probe stale" — one probe batch NOW (the nightly job's own run: new rows first, then probed rows
  // about to go stale; ≤ PROBE_BATCH boards, ≥ 1 s apart, read-only). One run at a time; it answers at once and runs behind.
  // ⛔ 46a (owner 11-10, after the first presses): a probe takes ~30–60 s a board (the board + 3 sampled postings, ≥ 1 s
  // apart), so one batch of 25 was ~15 min and 242 candidates ~10 presses. ONE press now works through every candidate that
  // is due — batch after batch, one board at a time, as politely as the nightly job — and the panel reads its progress from
  // GET /candidates (`probeRun`). The batches are capped at the count due when it started (+1), so a board that keeps
  // erroring can never keep the loop alive. ⚠ In memory: a deploy ends a run (the nightly job carries on from there).
  let probeRun = null;
  router.post("/candidates/probe", (_req, res) => {
    if (probeRun?.running) return res.status(409).json({ error: "already_running", message: "Re-probing is already running — its progress is above the list." });
    const due = probeDue(db);
    const maxBatches = Math.ceil(due / PROBE_BATCH) + 1;
    probeRun = { running: true, startedAt: Math.floor(Date.now() / 1000), due, batches: 0, probed: 0, errored: 0, finishedAt: null, error: null };
    (async () => {
      try {
        for (let b = 0; b < maxBatches; b++) {
          const r = await runCandidateProbe(db, { env });
          if (r.ran === false || r.failed) { probeRun.error = r.reason || r.error || "stopped"; break; }
          probeRun.batches++; probeRun.probed += r.probed || 0; probeRun.errored += r.errored || 0;
          console.log(`[discovery:probe] (admin) batch ${probeRun.batches}/${maxBatches} · probed ${r.probed ?? 0} · errored ${r.errored ?? 0} · ${probeDue(db)} still due`);
          if (!r.considered || !probeDue(db)) break;
        }
      } catch (e) { probeRun.error = e.message; console.warn("[discovery:probe] (admin) failed:", e.message); }
      probeRun.running = false; probeRun.finishedAt = Math.floor(Date.now() / 1000);
    })();
    res.status(202).json({ started: true, due, note: `Re-probing ${due} candidate${due === 1 ? "" : "s"}, one board at a time — about ${Math.max(1, Math.round(due * 40 / 60))} min. Progress shows above the list.` });
  });

  router.post("/candidates/breakers/:source/reset", (req, res) => {
    const out = resetBreaker(db, req.params.source);
    if (!out.ok) return res.status(404).json({ error: out.code });
    res.json(out);
  });

  router.patch("/:id", (req, res) => {
    if (typeof req.body?.active !== "boolean") return res.status(400).json({ error: "active_required" });
    if (req.body.active) {                                     // ⛔ D77: enabling is a tranche of one; disabling is always allowed
      const disk = gate(1);
      if (!disk.ok) return res.status(507).json({ error: disk.reason, disk });
    }
    const out = setCompanyActive(db, { id: req.params.id, active: req.body.active, adminUserId: actorOf(req) });
    if (!out.ok) return res.status(404).json({ error: "not_found" });
    res.json(out);
  });

  return router;
}

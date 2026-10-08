// routes/companies.js — A50 step 4: company list management (admin-gated).
//
// ⛔ The same rule as every writing admin route: adding a company is DRY BY DEFAULT — the first POST
// probes the board and reports what it found; only a second POST with confirm:true AND the state the
// operator saw (expectState) writes, and only when the board is alive (live or empty). A board that
// answers 404 is never added. Disabling is reversible (active = 0) and logged.
import express, { Router } from "express";
import { listCompanies, harvestedSuggestions, validateBoard, addCompany, setCompanyActive, ATS_FETCHERS } from "../services/companyList.js";
import { trancheGate } from "../services/diskGauge.js";
import { createBackup } from "../scripts/backup.js";       // D82 C: an approved candidate batch is added only after a backup
import { heatReport } from "../services/companyHeat.js";
import { listCandidates, discoveryStatus, planApproval, approveCandidates, rejectCandidates, resetBreaker } from "../services/companyCandidates.js";

const DEFAULT_DATA_DIR = () => process.env.RM_DATA_DIR || "data";

export function createCompaniesRouter(db, requireAdmin, { fetchers = ATS_FETCHERS, dataDir = DEFAULT_DATA_DIR(),
                                                            gate = (companies) => trancheGate(db, dataDir, { companies }),
                                                            backup = (label) => createBackup(label), env = process.env } = {}) {
  const router = Router();
  router.use(requireAdmin);
  router.use(express.json({ limit: "64kb" }));

  router.get("/", (_req, res) => {
    // D80 E: each active company's hiring heat and the deactivation PROPOSALS — read-only; the owner presses Disable.
    const heat = heatReport(db);
    const byId = new Map(heat.companies.map((c) => [c.id, c]));
    const companies = listCompanies(db).map((c) => ({ ...c, heat: byId.get(c.id)?.heat ?? null, new_30d: byId.get(c.id)?.new_30d ?? null }));
    res.json({ companies, suggestions: harvestedSuggestions(db), atsTypes: Object.keys(fetchers),
               heat: { ...heat.summary, hotDays: heat.hotDays, dormantDays: heat.dormantDays, target: heat.target, proposals: heat.proposals } });
  });

  router.post("/validate", async (req, res) => {
    const { atsType, slug, company } = req.body || {};
    res.json(await validateBoard({ atsType, slug, company, fetchers }));
  });

  router.post("/", async (req, res) => {
    const { company, atsType, slug, bucketRole = null, confirm = false, expectState = null } = req.body || {};
    if (!company || !String(company).trim()) return res.status(400).json({ error: "company_required", message: "Name the company." });
    const validation = await validateBoard({ atsType, slug, company, fetchers });
    if (!confirm) {
      return res.json({ dryRun: true, validation,
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
    const out = addCompany(db, { company, atsType, slug, bucketRole, adminUserId: req.user?.id, evidence });
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
    res.json({ ...listCandidates(db, { status }), discovery: discoveryStatus(db, env) });
  });

  router.post("/candidates/approve", (req, res) => {
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
    try { snapshot = backup("pre-d82-candidates"); }
    catch (e) { return res.status(500).json({ error: "backup_failed", message: e.message }); }
    const out = approveCandidates(db, plan, { adminUserId: req.user?.id ?? null });
    res.json({ ok: true, backup: snapshot?.filename ?? null, ...out, refused: plan.refused,
      note: "Added and active. Each carries its evidence; Disable on the company list reverses it." });
  });

  router.post("/candidates/reject", (req, res) => {
    const { ids = [], reason = "owner" } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids_required" });
    res.json(rejectCandidates(db, ids, { adminUserId: req.user?.id ?? null, reason }));
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
    const out = setCompanyActive(db, { id: req.params.id, active: req.body.active, adminUserId: req.user?.id });
    if (!out.ok) return res.status(404).json({ error: "not_found" });
    res.json(out);
  });

  return router;
}

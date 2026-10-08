// routes/companies.js — A50 step 4: company list management (admin-gated).
//
// ⛔ The same rule as every writing admin route: adding a company is DRY BY DEFAULT — the first POST
// probes the board and reports what it found; only a second POST with confirm:true AND the state the
// operator saw (expectState) writes, and only when the board is alive (live or empty). A board that
// answers 404 is never added. Disabling is reversible (active = 0) and logged.
import express, { Router } from "express";
import { listCompanies, harvestedSuggestions, validateBoard, addCompany, setCompanyActive, ATS_FETCHERS } from "../services/companyList.js";
import { trancheGate } from "../services/diskGauge.js";
import { heatReport } from "../services/companyHeat.js";

const DEFAULT_DATA_DIR = () => process.env.RM_DATA_DIR || "data";

export function createCompaniesRouter(db, requireAdmin, { fetchers = ATS_FETCHERS, dataDir = DEFAULT_DATA_DIR(),
                                                            gate = (companies) => trancheGate(db, dataDir, { companies }) } = {}) {
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

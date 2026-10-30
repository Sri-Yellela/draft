// routes/atlas.js — ⭐ D105 · the Atlas's API. Pages are PUBLIC (no sign-in): a reader sees PUBLISHED nodes only.
//
//   GET  /api/atlas/search?q=k8s          → [{ slug, kind, name, via }]   (aliases resolve through skill_synonyms)
//   GET  /api/atlas/node/:slug            → the page's data; + `you` (have / missing) on a ROLE page when signed in
//   GET  /api/admin/atlas?status=draft    → the curator's list                (admin)
//   POST /api/admin/atlas/:slug/status    { status: "published" | "draft" }   (admin)
//   POST /api/admin/atlas/:slug/alias     { alias }  → a CONFIRMED alias in skill_synonyms, the one thesaurus (admin)
//   POST /api/admin/atlas/stats           recompute "On the board" now (it also runs after the 04:00 crawl)  (admin)
//
// ⛔ `you` is computed only for a signed-in reader and only from THEIR profile's skills (D101 profile_skills) — never
// stored, never shown to anyone else (d105YouOnlyWhenSignedIn).
import { Router } from "express";
import { searchNodes, readNode, setStatus, addAlias, profileTerms } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";

// A signed-in reader's terms — ONE implementation (services/atlas/atlasStore.js profileTerms), also read by D110's
// interview prep (services/interviewPrep.js skillGaps).
const userTerms = profileTerms;

/** have / missing against a role page's `requires` edges. */
export function youAgainst(db, userId, node) {
  if (node.kind !== "role") return null;
  const needs = node.related.filter(r => r.type === "requires" && r.dir === "out");
  if (!needs.length) return null;
  const mine = userTerms(db, userId);
  const termBySlug = new Map(db.prepare(`SELECT slug, term FROM atlas_nodes WHERE slug IN (${needs.map(() => "?").join(",")})`)
    .all(...needs.map(n => n.slug)).map(r => [r.slug, r.term]));
  const have = [], missing = [];
  for (const n of needs) (mine.has(termBySlug.get(n.slug)) ? have : missing).push({ slug: n.slug, name: n.name });
  const share = have.length / needs.length;
  return { status: share >= 0.6 ? "have" : share > 0 ? "partial" : "missing", have, missing };
}

export function createAtlasRouter(db) {
  const router = Router();
  router.get("/search", (req, res) => {
    const q = String(req.query.q ?? "").slice(0, 80);
    res.json({ q, results: q.trim() ? searchNodes(db, q, { publishedOnly: true }) : [] });
  });
  router.get("/node/:slug", (req, res) => {
    const node = readNode(db, req.params.slug, { publishedOnly: true });
    if (!node) return res.status(404).json({ error: "not_found", message: "No published Atlas page by that name." });
    const userId = req.user?.id ?? null;
    res.json({ ...node, ...(userId ? { you: youAgainst(db, userId, node) } : {}) });
  });
  return router;
}

export function createAtlasAdminRouter(db) {
  const router = Router();
  router.get("/", (req, res) => {
    const status = req.query.status === "published" ? "published" : req.query.status === "draft" ? "draft" : null;
    const rows = db.prepare(`SELECT n.slug, n.kind, n.name, n.status, n.source, COALESCE(s.postings, 0) AS postings
      FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id
      ${status ? "WHERE n.status = ?" : ""} ORDER BY postings DESC, n.name LIMIT 1000`).all(...(status ? [status] : []));
    res.json({ nodes: rows });
  });
  router.post("/stats", (_req, res) => {
    const t = Date.now();
    res.json({ ok: true, ...computeAtlasStats(db), ms: Date.now() - t });
  });
  router.post("/:slug/status", (req, res) => {
    const status = req.body?.status;
    if (!["published", "draft"].includes(status)) return res.status(400).json({ error: "bad_status" });
    if (!setStatus(db, req.params.slug, status, req.user?.username || req.admin?.email || "admin")) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, slug: req.params.slug, status });
  });
  router.post("/:slug/alias", (req, res) => {
    const node = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).get(req.params.slug);
    if (!node) return res.status(404).json({ error: "not_found" });
    const alias = String(req.body?.alias ?? "").trim().slice(0, 80);
    if (!alias) return res.status(400).json({ error: "bad_alias" });
    const ok = addAlias(db, node.id, alias, req.user?.username || req.admin?.email || "admin");
    res.status(ok ? 200 : 409).json({ ok, note: "Confirmed aliases change ATS scores — re-measure ρ after a batch (A76)." });
  });
  return router;
}

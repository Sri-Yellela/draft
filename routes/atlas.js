// routes/atlas.js — ⭐ D105 · the Atlas's API. Pages are PUBLIC (no sign-in): a reader sees PUBLISHED nodes only.
//
//   GET  /api/atlas/search?q=k8s          → [{ slug, kind, name, via }]   (aliases resolve through skill_synonyms)
//   GET  /api/atlas/node/:slug            → the page's data; + `you` (have / missing) on a ROLE page when signed in
//   GET  /api/admin/atlas?status=draft    → the curator's list                (admin)
//   POST /api/admin/atlas/:slug/status    { status: "published" | "draft" }   (admin)
//   POST /api/admin/atlas/:slug/alias     { alias }  → a CONFIRMED alias in skill_synonyms, the one thesaurus (admin)
//   POST /api/admin/atlas/stats           recompute "On the board" now (it also runs after the 04:00 crawl)  (admin)
//
// ⭐ D105 P5 · links in:
//   GET  /api/atlas/resolve?terms=a,b,c   → { slugs: { term: slug } } — PUBLISHED nodes only, by term or confirmed alias;
//                                           a term with no published page is absent, so no caller draws a dead link
// ⭐ D105 P6 · the curator's editor (admin; requireAdmin is mounted in front of this router in server.js):
//   POST   /api/admin/atlas/nodes                 { kind, name, definition?, wikiTitle? }   add a node (a draft)
//   GET    /api/admin/atlas/node/:slug            the editor's view — every edge, every resource (dead ones marked)
//   PATCH  /api/admin/atlas/node/:slug            { definition?, wikiTitle? }
//   POST   /api/admin/atlas/merge                 { winner, loser } — edges + resources move; the loser's term becomes a
//                                                  CONFIRMED alias in skill_synonyms (addAlias), the loser is deleted
//   POST   /api/admin/atlas/node/:slug/edges      { to, type }   (typed — never alias_of)
//   DELETE /api/admin/atlas/node/:slug/edges?to=&type=
//   POST   /api/admin/atlas/node/:slug/resources  { url (https), title, level, format, hours, cost }
//   PATCH  /api/admin/atlas/resources/:id         DELETE /api/admin/atlas/resources/:id
//   POST   /api/admin/atlas/links/check           the dead-link checker now (it also runs daily)
//   POST   /api/admin/atlas/wiki/refresh          Wikipedia summaries now, for nodes with a wiki title (weekly cache)
// ⭐ D105 P7–P9 (amended 10-31) · the Atlas publishes itself:
//   GET    /api/admin/atlas                       each row also carries `readiness` — why a draft is not published yet
//                                                  (postings n of 5, no Wikipedia summary or definition, unpublished by …)
//   POST   /api/admin/atlas/auto/run              titles + Wikidata items → Wikidata resources → Wikipedia → the bar, now
//                                                  (it also runs nightly after the stats)
//
// ⛔ `you` is computed only for a signed-in reader and only from THEIR profile's skills (D101 profile_skills) — never
// stored, never shown to anyone else (d105YouOnlyWhenSignedIn).
import { Router } from "express";
import { searchNodes, readNode, setStatus, addAlias, resolveTerms, RESOLVE_MAX_TERMS, profileTerms } from "../services/atlas/atlasStore.js";
import { createNode, updateNode, readNodeForEditor, mergeNodes, addTypedEdge, removeEdge, addResource, updateResource, removeResource,
  AtlasEditError } from "../services/atlas/atlasEditor.js";
import { checkAtlasLinks } from "../services/atlas/atlasLinkCheck.js";
import { refreshWikiSummaries } from "../services/atlas/atlasWiki.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { readiness, READINESS_COLUMNS, runAtlasAutoPipeline, autoPublish } from "../services/atlas/atlasPublish.js";
import { sponsorsForRole } from "../services/atlas/atlasSponsors.js";

// A signed-in reader's terms — ONE implementation (services/atlas/atlasStore.js profileTerms), also read by D110's
// interview prep (services/interviewPrep.js skillGaps).
const userTerms = profileTerms;

/** have / missing against a role page's `requires` edges. */
export function youAgainst(db, userId, node) {
  if (node.kind !== "role") return null;
  const needs = node.related.filter(r => r.type === "requires" && r.dir === "out");
  if (!needs.length) return null;
  const mine = profileTerms(db, userId);
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
  // ⭐ P5: the skill tags' links. Comma-separated, at most RESOLVE_MAX_TERMS; the answer is cacheable for a short while.
  router.get("/resolve", (req, res) => {
    const raw = Array.isArray(req.query.terms) ? req.query.terms.join(",") : String(req.query.terms ?? "");
    const terms = raw.slice(0, 8000).split(",").map(t => t.trim().slice(0, 80)).filter(Boolean).slice(0, RESOLVE_MAX_TERMS);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ slugs: terms.length ? resolveTerms(db, terms) : {} });
  });
  router.get("/node/:slug", (req, res) => {
    const node = readNode(db, req.params.slug, { publishedOnly: true });
    if (!node) return res.status(404).json({ error: "not_found", message: "No published Atlas page by that name." });
    const userId = req.user?.id ?? null;
    // ⭐ D108 P3 · "Sponsors who hire this role" — computed from active postings + the companies' public LCA facts.
    const sponsors = node.kind === "role" ? (() => { try { return sponsorsForRole(db, node.slug); } catch { return []; } })() : null;
    res.json({ ...node, ...(sponsors?.length ? { sponsors } : {}), ...(userId ? { you: youAgainst(db, userId, node) } : {}) });
  });
  return router;
}

/** An editor refusal → 400 / 404 / 409 with its code; anything else is a real fault. */
function editing(res, fn) {
  try { return fn(); }
  catch (e) {
    if (!(e instanceof AtlasEditError)) throw e;
    const status = e.code === "not_found" ? 404 : e.code === "exists" ? 409 : 400;
    return res.status(status).json({ error: e.code, message: e.message });
  }
}
const curator = (req) => req.user?.username || req.admin?.email || "admin";

/** @param opts { fetchImpl } — the link checker's and the Wikipedia refresh's fetcher (tests inject one; never the network). */
export function createAtlasAdminRouter(db, { fetchImpl = globalThis.fetch, linkPauseMs, wikiPauseMs } = {}) {
  const router = Router();
  router.get("/", (req, res) => {
    const status = req.query.status === "published" ? "published" : req.query.status === "draft" ? "draft" : null;
    const rows = db.prepare(`SELECT n.slug, n.kind, n.name, n.status, n.source, ${READINESS_COLUMNS}
      FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id
      ${status ? "WHERE n.status = ?" : ""} ORDER BY postings DESC, n.name LIMIT 1000`).all(...(status ? [status] : []));
    res.json({ nodes: rows.map(r => ({ slug: r.slug, kind: r.kind, name: r.name, status: r.status, source: r.source, postings: r.postings,
      publishedBy: r.published_by || null, wikiTitle: r.wiki_title || null, wikidataId: r.wikidata_id || null, readiness: readiness(r) })) });
  });
  router.post("/stats", (_req, res) => {
    const t = Date.now();
    const stats = computeAtlasStats(db);
    res.json({ ok: true, ...stats, autoPublished: autoPublish(db).published, ms: Date.now() - t });
  });
  router.post("/auto/run", async (_req, res) => {
    const t = Date.now();
    try {
      const r = await runAtlasAutoPipeline(db, { fetchImpl, ...(wikiPauseMs != null ? { pauseMs: wikiPauseMs, wikiPauseMs } : {}) });
      res.json({ ok: true, ...r, ms: Date.now() - t });
    } catch (e) { res.status(500).json({ error: "auto_run_failed", message: e.message }); }
  });
  // ── D105 P6 · the editor ──
  router.post("/nodes", (req, res) => editing(res, () => {
    const b = req.body || {};
    res.status(201).json({ ok: true, node: createNode(db, { kind: b.kind, name: b.name, definition: b.definition, wikiTitle: b.wikiTitle }) });
  }));
  router.get("/node/:slug", (req, res) => {
    const node = readNodeForEditor(db, req.params.slug);
    if (!node) return res.status(404).json({ error: "not_found" });
    res.json(node);
  });
  router.patch("/node/:slug", (req, res) => editing(res, () => {
    const b = req.body || {};
    updateNode(db, req.params.slug, { definition: b.definition, wikiTitle: b.wikiTitle });
    res.json({ ok: true, node: readNodeForEditor(db, req.params.slug) });
  }));
  router.post("/merge", (req, res) => editing(res, () => {
    const r = mergeNodes(db, String(req.body?.winner ?? ""), String(req.body?.loser ?? ""), curator(req));
    res.json({ ok: true, ...r, note: "Confirmed aliases change ATS scores — re-measure ρ after a batch (A76)." });
  }));
  router.post("/node/:slug/edges", (req, res) => editing(res, () => {
    const added = addTypedEdge(db, req.params.slug, String(req.body?.to ?? ""), String(req.body?.type ?? ""));
    res.status(added ? 201 : 200).json({ ok: true, added });
  }));
  router.delete("/node/:slug/edges", (req, res) => editing(res, () => {
    const removed = removeEdge(db, req.params.slug, String(req.query.to ?? ""), String(req.query.type ?? ""));
    res.status(removed ? 200 : 404).json({ ok: removed });
  }));
  router.post("/node/:slug/resources", (req, res) => editing(res, () => {
    res.status(201).json({ ok: true, id: addResource(db, req.params.slug, req.body || {}, curator(req)) });
  }));
  router.patch("/resources/:id", (req, res) => editing(res, () => {
    res.json({ ok: updateResource(db, req.params.id, req.body || {}) });
  }));
  router.delete("/resources/:id", (req, res) => {
    const ok = removeResource(db, req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  });
  router.post("/links/check", async (_req, res) => {
    const t = Date.now();
    try {
      const r = await checkAtlasLinks(db, { fetchImpl, ...(linkPauseMs != null ? { pauseMs: linkPauseMs } : {}) });
      res.status(r.busy ? 409 : 200).json({ ok: !r.busy, ...r, ms: Date.now() - t });
    } catch (e) { res.status(500).json({ error: "link_check_failed", message: e.message }); }
  });
  router.post("/wiki/refresh", async (_req, res) => {
    const t = Date.now();
    try {
      const r = await refreshWikiSummaries(db, { fetchImpl, ...(wikiPauseMs != null ? { pauseMs: wikiPauseMs } : {}) });
      res.json({ ok: true, ...r, ms: Date.now() - t });
    } catch (e) { res.status(500).json({ error: "wiki_refresh_failed", message: e.message }); }
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

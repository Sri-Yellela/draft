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
// ⭐ D114 · terms in the postings (public):
//   GET  /api/atlas/terms/:jobId          → { terms: [{ slug, name, kind, forms: [{ text, exactCase }] }] } for ONE posting
//   GET  /api/atlas/peek/:slug            → the popup: name, kind, meaning (+ fromWikipedia), postings, firstResource, you?
//   POST /api/atlas/link-event            { event: "open" | "visit" } → 204; a per-day count, nothing else stored
// ⭐ D167 · the Atlas's Glossary panel (public):
//   GET  /api/atlas/glossary              → { terms: [{ slug, name, kind, meaning, fromWikipedia, wikipediaUrl, postings }], total }
//                                           every PUBLISHED term; `meaning` is the popup's own (meaningOf — one source)
// ⭐ D116 · YOUR MAP (public router — signed out is the fallback answer, never a 401):
//   GET  /api/atlas/me[?all=<section>]    signed in with profile skills → haveSkills · nextLevel · adjacent · branches ·
//                                         learnNext (each ≤ 12 + its total; ?all= one section uncapped, "see all");
//                                         signed out / no skills → search · Learn · exploreByRole + the upload line;
//                                         ⭐ D116 M1 · + `tree`: the whole map in one answer (services/atlas/atlasTree.js)
// ⭐ D116 M7 · the same tree on a role page and a family page (public; signed in, the reader's own have / rings):
//   GET  /api/atlas/tree/role/:slug       centre = the role, its top skills, distance = the share of its postings
//   GET  /api/atlas/tree/family/:key      centre = the family (shared/atlasFamilies.js — computing's five and, ⭐ A111 P3, a family per field of every D127 category)
// ⭐ A111 P3 · ONE ROLE AGAINST THE READER'S RÉSUMÉ (public; signed in, the reader's own have / missing — never stored):
//   GET  /api/atlas/role-fit?role=<slug or title>&job=<job_id>   → services/atlas/atlasRoleFit.js roleFitReading: the role's
//                                         top 15 from the board, have / missing ("You cover 9 of this role's top 15"), the
//                                         next level's rising skills, the role page link; another category's skills never
//                                         (D127). 404 { found: false, reason } for an unknown role.
// ⭐ D105 P6 · the curator's editor (admin; requireAdmin is mounted in front of this router in server.js):
//   POST   /api/admin/atlas/nodes                 { kind, name, definition?, wikiTitle? }   add a node (a draft)
//   GET    /api/admin/atlas/node/:slug            the editor's view — every edge, every resource (dead ones marked)
//   PATCH  /api/admin/atlas/node/:slug            { definition?, wikiTitle?, family? }   (family: D116 M1, "" = none)
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
//                                                  (it also runs nightly after the stats); `line` names any failure (BUG 10-31)
//   POST   /api/admin/atlas/wiki/ask-again        clear the 30-day "no article" mark on unmatched nodes → { cleared }
//   GET    /api/admin/atlas/wiki/classes          the matcher's last answer per node, counted by class, with the nodes
//   GET    /api/admin/atlas/wiki/probe            ONE real Wikipedia + Wikidata answer as this server receives it (read-only)
// ⭐ D105 P10 · Find on Wikipedia (services/atlas/atlasWikiFind.js):
//   GET    /api/admin/atlas/node/:slug/wiki-candidates   candidates by the node's class, each with its first sentence
//   POST   /api/admin/atlas/node/:slug/wiki-pick         { title, wikidataId }  → the title + Wikidata ID, by this curator
//   GET    /api/admin/atlas/wiki/redirects               every redirect node with its target (the group preview)
//   POST   /api/admin/atlas/wiki/redirects/accept        { picks: [{ slug, title, wikidataId }] }  all or nothing
// ⭐ D105 P11 · drafted definitions (services/atlas/atlasDefinitions.js):
//   GET    /api/admin/atlas/definitions/export           up to 30 nodes without one + the instructions, as copyable text
//   POST   /api/admin/atlas/definitions/import           { text } — the chat's JSON answer; all or nothing; lands as drafts
//   GET    /api/admin/atlas/definitions/drafts           the review list
//   POST   /api/admin/atlas/definitions/:slug/accept     { definition? } (edited) · …/:slug/reject · …/accept-all { slugs }
//
// ⛔ `you` is computed only for a signed-in reader and only from THEIR profile's skills (D101 profile_skills) — never
// stored, never shown to anyone else (d105YouOnlyWhenSignedIn).
import { Router } from "express";
import { searchNodes, readNode, setStatus, addAlias, resolveTerms, RESOLVE_MAX_TERMS, profileTerms } from "../services/atlas/atlasStore.js";
import { createNode, updateNode, readNodeForEditor, mergeNodes, addTypedEdge, removeEdge, addResource, updateResource, removeResource,
  AtlasEditError } from "../services/atlas/atlasEditor.js";
import { checkAtlasLinks } from "../services/atlas/atlasLinkCheck.js";
import { loadRegistry, registrySummary, lastLinkCheck, runRegisterLinkCheck } from "../services/atlas/sourceRegistry.js";
import { probeWikipedia, wikiMatchSummary } from "../services/atlas/atlasWikidata.js";
import { wikiCandidates, pickWikiTitle, redirectPreview, acceptPicks } from "../services/atlas/atlasWikiFind.js";
import { atlasTermsForPosting, peekNode, countLinkEvent, glossaryTerms } from "../services/atlas/atlasLinks.js";
import { learnStepForNode } from "../services/learn/learnLinks.js";
import { servedLearnContent } from "../services/learn/learnContent.js";
import { learnSourceSummary } from "../services/atlas/learnSources.js";
import { yourRun } from "../services/atlas/points.js";
import { roleReadiness, compareRoles } from "../services/atlas/roleReadiness.js";
import { aimRoleFor } from "../services/navigator.js";
import { exportForDrafting, importDrafted, draftedDefinitions, acceptDraft, rejectDraft, acceptAllDrafts } from "../services/atlas/atlasDefinitions.js";
import { refreshWikiSummaries } from "../services/atlas/atlasWiki.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { readiness, READINESS_COLUMNS, runAtlasAutoPipeline, autoPublish, askWikipediaAgain } from "../services/atlas/atlasPublish.js";
import { sponsorsForRole } from "../services/atlas/atlasSponsors.js";
import { computeYourMap, SECTIONS } from "../services/atlas/atlasMe.js";
import { roleTree, familyTree } from "../services/atlas/atlasTree.js";
import { roleBoard } from "../services/atlas/atlasRolePage.js";
import { roleFitReading } from "../services/atlas/atlasRoleFit.js";
import { atlasPostingsChanged, liveCached, LIVE_CACHE_MS } from "../services/atlas/atlasLive.js";
import { thumbIndex } from "../services/thumbs/resourceThumbs.js";

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
  // ⭐ D114 · Atlas terms in the postings (services/atlas/atlasLinks.js). ONE posting's linkable terms (its text is
  // matched where it is drawn, shared/atlasLinks.js); the popup's small read, fetched on the first hover only; and an
  // anonymous count of opens and visits.
  router.get("/terms/:jobId", (req, res) => {
    const terms = atlasTermsForPosting(db, String(req.params.jobId).slice(0, 200));
    if (!terms) return res.status(404).json({ error: "not_found" });
    res.set("Cache-Control", "public, max-age=300");
    res.json({ terms });
  });
  // ⭐ D118 P1: the popup's count is live — kept (here and in the browser) at most LIVE_CACHE_MS, and never past a
  // change of the counts or the Atlas (the old one-hour cache is gone).
  router.get("/peek/:slug", (req, res) => {
    const uid = req.user?.id ?? null;
    atlasPostingsChanged(db);
    const slug = String(req.params.slug);
    const p = uid != null ? peekNode(db, slug, uid) : liveCached(db, `peek:${slug}`, () => peekNode(db, slug, null));
    if (!p) return res.status(404).json({ error: "not_found" });
    res.set("Cache-Control", `${uid != null ? "private" : "public"}, max-age=${LIVE_CACHE_MS / 1000}`);
    res.json(p);
  });
  // ⭐ D167 · the Atlas's Glossary: every published term in plain words + its postings — the SAME meaning as the popup
  // (services/atlas/atlasLinks.js meaningOf), kept like the popup at most LIVE_CACHE_MS. The same for everyone.
  router.get("/glossary", (_req, res) => {
    const terms = liveCached(db, "glossary", () => glossaryTerms(db));
    res.set("Cache-Control", `public, max-age=${LIVE_CACHE_MS / 1000}`);
    res.json({ terms, total: terms.length });
  });
  // ⭐ D172 (3) · Your run: the reader's points from proof, level, streak and today's quests. Signed in only; private.
  router.get("/run", (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (req.user?.id == null) return res.status(401).json({ error: "sign_in", message: "Sign in to see your run." });
    res.json(yourRun(db, req.user.id));
  });
  // ⭐ D116 · computed from THIS reader's profile only (req.user, when signed in) — never stored, never cached shared.
  router.get("/me", (req, res) => {
    const all = SECTIONS.includes(req.query.all) ? req.query.all : null;
    res.set("Cache-Control", "private, no-store");
    res.json(computeYourMap(db, req.user?.id ?? null, { all }));
  });
  // ⭐ D116 M7 · the tree on a role / family page. Signed out it is the same for everyone (kept like the page); signed in
  // it carries the reader's own have / rings, so it is private and never cached shared.
  const treeRoute = (kind, compute) => (req, res) => {
    const uid = req.user?.id ?? null;
    const key = String(req.params.key).slice(0, 120);
    const t = uid != null ? compute(db, key, uid) : liveCached(db, `tree:${kind}:${key}`, () => compute(db, key, null));
    if (!t) return res.status(404).json({ error: "not_found" });
    res.set("Cache-Control", uid != null ? "private, no-store" : `public, max-age=${LIVE_CACHE_MS / 1000}`);
    res.json(t);
  };
  // ⭐ A111 P3 · the role against the reader's résumé (their Profile's skills, else the parsed résumé). Signed out: the role's
  // top skills with nothing marked as had. Private either way (it can carry the reader's skills), never cached shared.
  // ⭐ D178-3 · readiness for a role: the share of its demand you have PROVEN (claims shown apart). Signed in; private.
  // No role named → the person's aim on Your route (D143).
  // ⭐ D178-3 (Idea E) · compare up to four roles: ?roles=a|b|c|d (titles or slugs). Signed in; private.
  router.get("/readiness/compare", (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (req.user?.id == null) return res.status(401).json({ error: "sign_in" });
    const roles = String(req.query.roles ?? "").slice(0, 400).split("|").map(s => s.trim()).filter(Boolean);
    if (!roles.length) return res.status(400).json({ error: "roles_required", message: "Name up to four roles to compare." });
    res.json(compareRoles(db, req.user.id, roles));
  });
  router.get("/readiness", (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (req.user?.id == null) return res.status(401).json({ error: "sign_in" });
    let role = String(req.query.role ?? "").slice(0, 120) || null;
    if (!role) { try { role = aimRoleFor(db, req.user.id)?.name || null; } catch { role = null; } }
    if (!role) return res.status(404).json({ found: false, reason: "no_role", message: "Choose a role to see how ready you are for it." });
    const r = roleReadiness(db, req.user.id, role);
    if (!r.found) return res.status(404).json(r);
    res.json(r);
  });
  router.get("/role-fit", (req, res) => {
    const role = String(req.query.role ?? "").slice(0, 120) || null;
    const jobId = String(req.query.job ?? "").slice(0, 200) || null;
    const uid = req.user?.id ?? null;
    const reading = roleFitReading(db, { role, jobId, userId: uid });
    res.set("Cache-Control", "private, no-store");
    if (!reading.found) return res.status(404).json(reading);
    res.json({ ...reading, signedIn: uid != null });
  });
  router.get("/tree/role/:key", treeRoute("role", roleTree));
  router.get("/tree/family/:key", treeRoute("family", familyTree));
  router.post("/link-event", (req, res) => res.status(countLinkEvent(db, String(req.body?.event ?? "")) ? 204 : 400).end());
  router.get("/node/:slug", (req, res) => {
    // ⭐ D118 P1: the page's board data is live; the public part is kept at most LIVE_CACHE_MS and never past a change.
    atlasPostingsChanged(db);
    const slug = String(req.params.slug);
    const page = liveCached(db, `node:${slug}`, () => {
      const node = readNode(db, slug, { publishedOnly: true });
      if (!node) return null;
      // ⭐ D108 P3 · "Sponsors who hire this role" — computed from active postings + the companies' public LCA facts.
      const sponsors = node.kind === "role" ? (() => { try { return sponsorsForRole(db, node.slug); } catch { return []; } })() : null;
      // ⭐ D115 P4(b): the step of the owner's learning path that teaches it — "Learn it: Part 3 · Data structures · Step 2".
      const learn = (() => { try { return learnStepForNode(db, { name: node.name, term: db.prepare(`SELECT term FROM atlas_nodes WHERE slug = ?`).pluck().get(node.slug) }); } catch { return null; } })();
      // ⭐ D105 P12 · a role's page is the board's own data: skills with shares, levels, companies, the next level's rises.
      const board = node.kind === "role" ? (() => { try { return roleBoard(db, node.slug); } catch { return null; } })() : null;
      return { node, extra: { ...(board ? { roleBoard: board } : {}), ...(sponsors?.length ? { sponsors } : {}), ...(learn ? { learn } : {}) } };
    });
    if (!page) return res.status(404).json({ error: "not_found", message: "No published Atlas page by that name." });
    const userId = req.user?.id ?? null;
    // ⭐ D119: each resource's stored picture (read now, outside the page cache — a pin or a takedown shows at once).
    const thumbs = (() => { try { return thumbIndex(db, (page.node.resources || []).map(r => r.url)); } catch { return {}; } })();
    const resources = (page.node.resources || []).map(r => ({ ...r, thumb: thumbs[r.url] || null }));
    res.json({ ...page.node, resources, ...page.extra, ...(userId ? { you: youAgainst(db, userId, page.node) } : {}) });
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
  // ⛔ D176 · the learning-centre source register (content/sources/registry.json): the summary for Admin → Atlas →
  // Sources, with the last monthly link check; and the check, now.
  router.get("/sources", (_req, res) => {
    try {
      const reg = loadRegistry();
      // D176-3: every Learn item's source, resolved from the register against the content the app actually serves.
      let learn = null;
      try { const s = learnSourceSummary(servedLearnContent(db), reg); learn = { items: s.items, resolved: s.resolved, own: s.own, needsNamedSource: s.needsNamedSource, unregistered: s.unregistered }; }
      catch { learn = null; }
      res.json({ ...registrySummary(reg), links: lastLinkCheck(db), learn });
    }
    catch (e) { res.status(500).json({ error: "register_unreadable", message: e.message }); }
  });
  router.post("/sources/check", async (_req, res) => {
    try { res.json(await runRegisterLinkCheck(db, { fetchImpl, force: true })); }
    catch (e) { res.status(500).json({ error: "register_check_failed", message: e.message }); }
  });
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
    // ⭐ D116 M1: `family` too — set or cleared by the curator, it sticks (family_by).
    updateNode(db, req.params.slug, { definition: b.definition, wikiTitle: b.wikiTitle, family: b.family }, curator(req));
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
  router.post("/wiki/ask-again", (_req, res) => res.json({ ok: true, ...askWikipediaAgain(db) }));
  router.get("/wiki/classes", (_req, res) => res.json(wikiMatchSummary(db)));
  const wikiAsk = async (res, fn) => {
    try { res.json(await fn()); } catch (e) { res.status(e.status ? 502 : 500).json({ error: "wikipedia_failed", message: e.message }); }
  };
  router.get("/wiki/redirects", (_req, res) => wikiAsk(res, async () => ({ redirects: await redirectPreview(db, fetchImpl) })));
  router.post("/wiki/redirects/accept", (req, res) => editing(res, () => res.json({ ok: true, picked: acceptPicks(db, req.body?.picks, curator(req)) })));
  router.get("/node/:slug/wiki-candidates", (req, res) => {
    const node = db.prepare(`SELECT slug, name, wiki_match FROM atlas_nodes WHERE slug = ?`).get(req.params.slug);
    if (!node) return res.status(404).json({ error: "not_found" });
    return wikiAsk(res, () => wikiCandidates(fetchImpl, node));
  });
  // ── D105 P11 · drafted definitions, reviewed (no model call from draft — the owner pastes to and from a chat) ──
  router.get("/definitions/export", (_req, res) => res.json(exportForDrafting(db)));
  router.post("/definitions/import", (req, res) => {
    const r = importDrafted(db, req.body?.text ?? req.body?.definitions ?? req.body);
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.get("/definitions/drafts", (_req, res) => res.json({ drafts: draftedDefinitions(db) }));
  router.post("/definitions/accept-all", (req, res) => res.json({ ok: true, ...acceptAllDrafts(db, req.body?.slugs, curator(req)) }));
  router.post("/definitions/:slug/accept", (req, res) => {
    const r = acceptDraft(db, req.params.slug, { definition: req.body?.definition }, curator(req));
    return r ? res.json({ ok: true, ...r }) : res.status(404).json({ error: "no_draft" });
  });
  router.post("/definitions/:slug/reject", (req, res) => res.status(rejectDraft(db, req.params.slug) ? 200 : 404).json({ ok: true }));
  router.post("/node/:slug/wiki-pick", (req, res) => editing(res, () =>
    res.json({ ok: true, node: pickWikiTitle(db, req.params.slug, { title: req.body?.title, wikidataId: req.body?.wikidataId }, curator(req)) })));
  router.get("/wiki/probe", async (_req, res) => {
    try { res.json(await probeWikipedia({ fetchImpl })); } catch (e) { res.status(500).json({ error: "probe_failed", message: e.message }); }
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

// client/src/pages/atlas/gazetteerModel.js — ⭐ D197 Wave 1 #8 (47m, lane gaz) · D201 · THE GAZETTEER AS DATA: the pure half of
// the Gazetteer's index, its entries and the routes over them. Everything comes from what Atlas already serves — nothing is
// invented and nothing calls a model (D190):
//   · ENTRIES = every published Atlas term (GET /api/atlas/glossary `terms`: roles, skills, tools, stacks, concepts — the
//     node pages), every concept the course's index teaches with no node of its own (`concepts`), every lesson of the course
//     *From silicon to software* (GET /api/learn/course/silicon-to-software — today's PLACES) and every pattern of *Coding
//     interview patterns* (GET /api/learn/course/coding-interview-patterns). A term the course teaches carries its lesson.
//   · its PLATE (region) and STAGE = its lesson's module (the eight regions, volumeModel REGION_META) and its quarter of the
//     module (Start · Build · Deepen · Master — the region page's own rule); a term with no lesson has no plate yet.
//   · its THREE SQUARES = what the reader has PROVEN on its lesson (the one rule, libraryModel.lessonState): lit = 3; a
//     started lesson lights its share of the checks. DUE = the piece's questions due for review (GET /api/learn/checks).
//   · ROUTES = a saved order of entries (D201 (2)): the two courses, each guided route of the circle (learn_routes), each
//     pathway's stages (GET /api/learn/pathways), the guides' ladder (GET /api/learn/guides), and every approved *Build it*
//     brief as a PROJECT ROUTE (D203 (6)). Progress lives on the entry, so a stop lit on one route is lit on every route.
import { matchCandidate } from "../../../../shared/atlasSearchNormalize.js";
import { lessonState } from "./libraryModel.js";
import { REGION_META, STAGES, placeChecks } from "./volumeModel.js";

export const SHOW = Object.freeze([
  { id: "all", label: "All" }, { id: "due", label: "Due" }, { id: "lit", label: "Lit" }, { id: "started", label: "Started" }, { id: "notyet", label: "Not yet" },
]);
export const BROWSE = Object.freeze([
  { id: "az", label: "A–Z" }, { id: "region", label: "Region" }, { id: "role", label: "Role" }, { id: "stage", label: "Stage" }, { id: "interview", label: "Interview" },
]);
export const STAGE_BANDS = Object.freeze(["Lowlands", "Foothills", "Highlands", "Summit"]);
export const KIND_WORD = Object.freeze({ role: "role", skill: "skill", tool: "tool", stack: "stack", concept: "concept", pattern: "pattern", place: "lesson", term: "term", word: "word · several meanings" });
const COURSE_ID = "silicon-to-software", PATTERN_ID = "coding-interview-patterns";
/** ≈ minutes a due review takes (the board's "Review 4 · about 6 min"): agent's pick, 1.5 min a question. */
export const MIN_PER_REVIEW = 1.5;

export const entryHref = (base, e) => (e.slug ? `${base}/${encodeURIComponent(e.slug)}` : e.deck ? `${base}/library/${encodeURIComponent(e.deck)}` : `${base}/gazetteer/${encodeURIComponent(e.lessonId || e.key)}`);
export const routeHref = (base, id) => `${base}/routes/${encodeURIComponent(id)}`;

const regionOf = (moduleN) => {
  const m = REGION_META[moduleN - 1];
  return m ? { roman: m.roman, name: m.name, kind: m.kind } : null;
};
const stageOf = (i, n) => Math.min(3, Math.floor((4 * i) / Math.max(1, n)));

/** Three squares from a lesson's earned state: complete = 3; started = its checks' share (at least one). */
export function squaresFor(lesson, marks = {}) {
  if (!lesson) return 0;
  const s = lessonState(lesson, marks);
  if (s.complete) return 3;
  if (!s.started) return 0;
  const c = placeChecks(lesson, marks);
  return Math.max(1, Math.min(2, Math.round((3 * c.done) / Math.max(1, c.total))));
}
export const stateOf = (sq) => (sq >= 3 ? "lit" : sq > 0 ? "started" : "notyet");

/** Every lesson of a course with its module, region, stage and position. */
export function lessonsOf(course) {
  const out = [];
  for (const m of course?.modules || []) {
    const n = m.lessons.length;
    m.lessons.forEach((l, i) => out.push({ ...l, module: m.n, moduleTitle: m.title, region: course.id === PATTERN_ID ? regionOf(3) : regionOf(m.n), stage: stageOf(i, n), pattern: course.id === PATTERN_ID }));
  }
  return out;
}

/**
 * The entries: [{ key, kind, name, meaning, slug?, lessonId?, region, stage, squares, state, due, postings, learn }]. `data` =
 * { glossary: { terms, concepts }, course, patterns, marks, checks } (any may be missing — a part not loaded adds nothing).
 */
export function entriesOf({ glossary = null, course = null, patterns = null, marks = {}, checks = null } = {}) {
  const lessons = lessonsOf(course);
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const dueOf = (id) => checks?.pieces?.[id]?.due || 0;
  const out = [];
  const fromLesson = (l) => (l ? { region: l.region, stage: l.stage, squares: squaresFor(l, marks), lessonId: l.id } : { region: null, stage: null, squares: 0 });
  for (const t of glossary?.terms || []) {
    const l = t.learn ? byId.get(t.learn.stepId) : null;
    const f = fromLesson(l);
    out.push({ key: `t:${t.slug}`, kind: t.kind || "term", name: t.name, meaning: t.meaning || "", fromWikipedia: !!t.fromWikipedia, wikipediaUrl: t.wikipediaUrl || null,
      slug: t.slug, postings: t.postings ?? null, learn: t.learn || null, ...f, due: f.lessonId ? dueOf(f.lessonId) : 0 });
  }
  for (const c of glossary?.concepts || []) {
    const l = c.learn ? byId.get(c.learn.stepId) : null;
    const f = fromLesson(l);
    out.push({ key: `c:${c.name}`, kind: "concept", name: c.name, meaning: c.meaning || "", postings: null, learn: c.learn || null, ...f, due: f.lessonId ? dueOf(f.lessonId) : 0 });
  }
  // ⭐ 47o W6: a word with several meanings is one entry — "kernel · 3 meanings" — that opens its disambiguation page
  for (const w of glossary?.words || []) {
    out.push({ key: `w:${w.slug}`, kind: "word", name: w.word, meaning: `${w.meanings} meanings — pick the one you meant.`, slug: w.slug, region: null, stage: null, squares: 0, due: 0, postings: null, learn: null });
  }
  for (const l of lessons) {
    const sq = squaresFor(l, marks);
    out.push({ key: `l:${l.id}`, kind: "place", name: l.title, meaning: l.goal || "", lessonId: l.id, region: l.region, stage: l.stage, squares: sq, due: dueOf(l.id), postings: null });
  }
  for (const p of lessonsOf(patterns)) {
    out.push({ key: `p:${p.id}`, kind: "pattern", name: p.title, meaning: p.goal || "", lessonId: p.id, region: p.region, stage: p.stage, squares: 0, due: dueOf(p.id), postings: null, pattern: true });
  }
  for (const e of out) e.state = stateOf(e.squares);
  return out.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** The Show counts and the filter. */
export function showCounts(entries = []) {
  return { all: entries.length, due: entries.filter((e) => e.due > 0).length, lit: entries.filter((e) => e.state === "lit").length,
    started: entries.filter((e) => e.state === "started").length, notyet: entries.filter((e) => e.state === "notyet").length };
}
export const showFilter = (entries = [], show = "all") => (show === "all" ? entries : show === "due" ? entries.filter((e) => e.due > 0) : entries.filter((e) => e.state === show));

/** The search ("Make sense of…") — the ONE normaliser (shared/atlasSearchNormalize.js) over the name, then the meaning. */
export function searchEntries(entries = [], q = "", limit = 8) {
  const query = String(q ?? "").trim();
  if (!query) return [];
  const hits = [];
  for (const e of entries) {
    const m = matchCandidate(query, { name: e.name, definition: e.meaning || "" });
    if (m) hits.push({ e, rank: m.rank + (e.kind === "place" ? 0.5 : 0) });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.e.name.localeCompare(b.e.name)).slice(0, limit).map((h) => h.e);
}
/** The part of a name the query matched (the board underlines it), or null. */
export function matchedPart(name, q) {
  const s = String(name || ""), t = String(q || "").trim().toLowerCase();
  const i = t ? s.toLowerCase().indexOf(t) : -1;
  return i < 0 ? null : [s.slice(0, i), s.slice(i, i + t.length), s.slice(i + t.length)];
}

/** The first letter an entry files under (a digit or a sign files under #). */
export const letterOf = (name) => { const c = String(name || "").trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
export const LETTERS = Object.freeze("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
/** Entries by letter: Map(letter → entries), and the letters that hold something. */
export function byLetter(entries = []) {
  const m = new Map();
  for (const e of entries) { const L = letterOf(e.name); if (!m.has(L)) m.set(L, []); m.get(L).push(e); }
  return m;
}

/** The eight plates: each region's entries and lit count. */
export function regionCounts(entries = []) {
  return REGION_META.map((r, i) => {
    const own = entries.filter((e) => e.region?.roman === r.roman);
    return { n: i + 1, roman: r.roman, name: r.name, kind: r.kind, entries: own.length, lit: own.filter((e) => e.state === "lit").length };
  });
}
/** The four stages as elevation bands: each stage's entries and lit count (entries with a plate only). */
export function stageCounts(entries = []) {
  return STAGES.map((s, i) => {
    const own = entries.filter((e) => e.stage === i);
    return { i, id: s.id, label: s.label, band: STAGE_BANDS[i], entries: own.length, lit: own.filter((e) => e.state === "lit").length };
  });
}

/**
 * Browse by role (GET /api/atlas/me → exploreByRole: each role's top skills from the board). `proven` = the reader's
 * proven skill names (GET /api/readiness, checked / built), lower-cased; % proven counts only those.
 */
export function roleRows(roles = [], proven = new Set()) {
  return (roles || []).map((r) => {
    const skills = r.topSkills || [];
    const have = skills.filter((s) => proven.has(String(s.name || "").toLowerCase())).length;
    return { slug: r.slug, name: r.name, postings: r.postings || 0, asks: skills.length, skills, pct: skills.length ? Math.round((100 * have) / skills.length) : 0 };
  });
}

/**
 * Browse by interview: the reader's own interview question bank (GET /api/interview/questions — rounds from their
 * debriefs) grouped by round, each round with the entries its questions name; companies they were asked at; and the
 * patterns course as the coding round everyone gets. Pure; a name matches on word boundaries, case-folded.
 */
export function interviewRows(entries = [], questions = [], patterns = []) {
  const terms = entries.filter((e) => e.kind !== "place" && e.name.length >= 3);
  const named = (text) => {
    const t = ` ${String(text || "").toLowerCase()} `;
    return terms.filter((e) => new RegExp(`[^a-z0-9]${e.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(t));
  };
  const rounds = new Map();
  const companies = new Set();
  const asked = new Map();
  for (const q of questions || []) {
    const r = String(q.round || "other");
    if (!rounds.has(r)) rounds.set(r, new Map());
    for (const e of named(q.question)) { rounds.get(r).set(e.key, e); if (q.company) asked.set(e.key, e); }
    if (q.company) companies.add(q.company);
  }
  const rows = [];
  if (patterns.length) rows.push({ id: "coding", title: "Coding rounds", sub: patterns.slice(0, 4).map((p) => p.name).join(" · "), entries: patterns });
  for (const [r, m] of rounds) if (m.size) rows.push({ id: `round:${r}`, title: `${r.charAt(0).toUpperCase()}${r.slice(1)} rounds`, sub: [...m.values()].slice(0, 4).map((e) => e.name).join(" · "), entries: [...m.values()] });
  if (asked.size) rows.push({ id: "asked", title: "Asked at companies you applied to", sub: `${[...companies].slice(0, 3).join(" · ")} — ${asked.size} entr${asked.size === 1 ? "y" : "ies"}`, entries: [...asked.values()] });
  return rows;
}

/** The rail's due list: the entries due for review, most overdue first (a place before a term that shares its lesson). */
export function dueList(entries = []) {
  const seen = new Set();
  return entries.filter((e) => e.due > 0).sort((a, b) => b.due - a.due || (a.kind === "place" ? -1 : 1)).filter((e) => {
    if (seen.has(e.lessonId)) return false; seen.add(e.lessonId); return true;
  });
}
export const dueMinutes = (n) => Math.max(1, Math.round(n * MIN_PER_REVIEW));

// ── ROUTES ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The routes: [{ id, name, kind, made, stops: [{ key, name, lessonId?, region, stage, ... }], build? }]. Stops are entry
 * keys, so a stop's light is its entry's. `data` = { course, patterns, circle (GET /api/learn/circle), routesFor (the
 * circle's route closure, learnModel.routesFor), pieces (the course's pieces for it), pathways, guides, entries }.
 */
export function routesOf({ course = null, patterns = null, circleRoutes = [], pathways = null, guides = null, entries = [] } = {}) {
  const byLesson = new Map(entries.filter((e) => e.kind === "place" || e.kind === "pattern").map((e) => [e.lessonId, e]));
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));
  const out = [];
  const stop = (e) => ({ key: e.key, name: e.name, lessonId: e.lessonId, slug: e.slug, deck: e.deck, region: e.region, stage: e.stage, squares: e.squares, state: e.state, kind: e.kind });
  if (course?.modules?.length) {
    const ls = lessonsOf(course).map((l) => byLesson.get(l.id)).filter(Boolean);
    out.push({ id: COURSE_ID, name: course.title || "From silicon to software", kind: "course", made: "draft (the course)", about: `${ls.length} lessons, ${course.counts?.links ?? 0} links`, stops: ls.map(stop), circle: true });
  }
  if (patterns?.modules?.length) {
    const ls = lessonsOf(patterns).map((l) => byLesson.get(l.id)).filter(Boolean);
    out.push({ id: PATTERN_ID, name: patterns.title || "Coding interview patterns", kind: "patterns", made: "draft (a starter route)", about: `${ls.length} patterns, ${patterns.counts?.links ?? 0} practice problems`, stops: ls.map(stop), round: true });
  }
  for (const r of circleRoutes || []) {
    const ls = (r.list || []).map((id) => byLesson.get(id)).filter(Boolean);
    if (ls.length) out.push({ id: `guided-${r.id}`, name: r.name, kind: "guided", made: "draft (a guided route through the course)", about: `${ls.length} lessons`, stops: ls.map(stop) });
  }
  const deckEntry = (t, stageI) => {
    const e = byName.get(String(t.title || "").toLowerCase());
    if (e) return stop(e);
    return { key: t.deck ? `d:${t.deck}` : `planned:${t.title}`, name: t.title, deck: t.deck || null, planned: !t.deck, drafted: !!t.drafted, region: null, stage: stageI, squares: 0, state: "notyet", kind: "deck" };
  };
  for (const p of pathways?.pathways || []) {
    const stops = [];
    p.stages.forEach((s, si) => { for (const t of s.topics || []) stops.push(deckEntry(t, Math.min(3, si))); });
    if (stops.length) out.push({ id: `pathway-${p.id}`, name: p.title, kind: "pathway", made: "draft (a pathway)", later: !!p.later, about: `${p.stages.length} stages, ${stops.length} topics (${stops.filter((x) => !x.planned).length} written)`, stops,
      stages: p.stages.map((s) => ({ id: s.id, title: s.title, n: (s.topics || []).length })) });
    p.stages.forEach((s, si) => {
      for (const b of s.builds || []) {
        const skills = (b.skills || []).map((n) => byName.get(String(n).toLowerCase())).filter(Boolean).map(stop);
        const decks = (b.decks || []).map((d) => ({ key: `d:${d}`, name: d.replace(/-/g, " "), deck: d, region: null, stage: si, squares: 0, state: "notyet", kind: "deck" }));
        const stops = skills.length ? skills : decks;
        out.push({ id: `build-${b.id}`, name: b.title, kind: "project", made: `draft (a build brief · ${p.title} · ${s.title})`, about: b.brief || "", stops, build: { title: "build it", line: b.title, brief: b.brief || "", steps: b.steps || [], show: b.show || null } });
      }
    });
  }
  const written = (guides?.guides || []).filter((g) => g.written);
  if (written.length) {
    const stops = written.flatMap((g, gi) => g.lessons.map((d) => deckEntry({ title: d.title, deck: d.id }, Math.min(3, gi))));
    out.push({ id: "guides", name: "The guides, level by level", kind: "guides", made: "draft (the guides' ladder)", about: `${written.length} levels, ${stops.length} decks`, stops,
      levels: (guides?.guides || []).map((g) => ({ id: g.id, name: g.name, level: g.level, written: g.written, n: g.lessons.length })) });
  }
  return out;
}

/**
 * A route's stops with their states for the map: walked (lit, earlier than you), elsewhere (lit, but not reached on this route
 * yet — it was lit on another route and counts here), here (the first stop not lit), ahead. `joined` = the reader has
 * this route as theirs (only then is anything "walked here").
 */
export function stopStates(stops = []) {
  const hereI = stops.findIndex((s) => s.state !== "lit");
  return stops.map((s, i) => ({ ...s, mapState: s.state === "lit" ? (hereI < 0 || i < hereI ? "walked" : "elsewhere") : i === hereI ? "here" : "ahead" }));
}
/** Lit / total for a route (progress lives on the entries). */
export const routeProgress = (stops = []) => ({ lit: stops.filter((s) => s.state === "lit").length, total: stops.length, here: stops.find((s) => s.state !== "lit") || null });

/** The window of a long route drawn on the map (≤ 14 stops around where you are — agent's pick); the list shows all. */
export function mapWindow(stops = [], max = 14) {
  if (stops.length <= max) return { from: 0, stops };
  const here = Math.max(0, stops.findIndex((s) => s.mapState === "here"));
  const from = Math.max(0, Math.min(stops.length - max, here - 3));
  return { from, stops: stops.slice(from, from + max) };
}

/** The routes an entry sits on: [{ route, at (1-based), of }]. */
export function routesThrough(routes = [], key) {
  const out = [];
  for (const r of routes) { const i = r.stops.findIndex((s) => s.key === key); if (i >= 0) out.push({ route: r, at: i + 1, of: r.stops.length }); }
  return out;
}
/** The routes that cross this one: shared stops, with where they meet. */
export function crossings(routes = [], route) {
  if (!route) return [];
  const mine = new Map(route.stops.map((s, i) => [s.key, i]));
  const out = [];
  for (const r of routes) {
    if (r.id === route.id) continue;
    const j = r.stops.findIndex((s) => mine.has(s.key));
    if (j >= 0) out.push({ route: r, at: r.stops[j], stop: j + 1, of: r.stops.length });
  }
  return out;
}

// ── YOUR ROUTES (agent's pick: kept in this browser until a route store exists — no endpoint, no migration) ───────────
const MINE = "atlas.myRoutes.v1";
export function readMine(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse(store?.getItem(MINE) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export function writeMine(mine, store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { store?.setItem(MINE, JSON.stringify(mine)); } catch { /* private mode: kept for this visit */ }
  return mine;
}
/** Join (keep as yours), copy (yours to drop stops from), leave. A copy's stops are entry keys. */
export const joinRoute = (mine, id) => ({ ...mine, [id]: { ...(mine[id] || {}), joined: true } });
export const leaveRoute = (mine, id) => { const n = { ...mine }; delete n[id]; return n; };
export const copyRoute = (mine, route) => ({ ...mine, [`mine-${route.id}`]: { joined: true, copyOf: route.id, name: `${route.name} (my copy)`, keys: route.stops.map((s) => s.key) } });
export const dropStop = (mine, id, key) => (mine[id]?.keys ? { ...mine, [id]: { ...mine[id], keys: mine[id].keys.filter((k) => k !== key) } } : mine);
/** The reader's copies as routes (their stops resolved through the source route's stops). */
export function myCopies(mine = {}, routes = []) {
  return Object.entries(mine).filter(([, v]) => v.copyOf).map(([id, v]) => {
    const src = routes.find((r) => r.id === v.copyOf);
    if (!src) return null;
    const at = new Map(src.stops.map((s) => [s.key, s]));
    return { ...src, id, name: v.name, made: "you (a copy)", copy: true, stops: (v.keys || []).map((k) => at.get(k)).filter(Boolean) };
  }).filter(Boolean);
}

// ── AN ENTRY ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The practice ladder: the piece's bank questions on the one scale (agent's pick: in order, split in quarters). */
export function practiceLadder(questions = []) {
  const n = questions.length;
  const rungs = STAGES.map((s) => ({ id: s.id, label: s.label.toUpperCase(), questions: [] }));
  questions.forEach((q, i) => rungs[stageOf(i, n)].questions.push(q));
  return rungs;
}

// ⭐ 47o: crossRefs (the Gazetteer's second linker) is gone — every Atlas text links through the one linker,
// shared/atlasText.js, drawn by components/AtlasTerm.jsx AtlasProse.

/** The neighbouring entries in the A–Z (the entry page's side index): up to `n` around this one, same letter first. */
export function neighbours(entries = [], key, n = 7) {
  const list = entries.filter((e) => e.kind !== "place");
  const i = list.findIndex((e) => e.key === key);
  if (i < 0) return list.slice(0, n);
  const from = Math.max(0, Math.min(list.length - n, i - Math.floor(n / 2)));
  return list.slice(from, from + n);
}

/** A deck that teaches an entry (GET /api/learn/guides decks with their skills, or the same title). */
export function deckFor(name, guides = null) {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  for (const g of guides?.guides || []) for (const d of g.lessons || []) {
    if (String(d.title).toLowerCase() === n || (d.skills || []).some((s) => String(s).toLowerCase() === n)) return { ...d, guide: g.name };
  }
  return null;
}
/** How it works (GET /api/learn/how-it-works): the flow of the deck that teaches this entry, or one whose title is its name. */
export function flowFor(name, deckId, ideas = []) {
  const n = String(name || "").toLowerCase();
  return (ideas || []).find((d) => d.id === deckId) || (ideas || []).find((d) => String(d.title).toLowerCase() === n) || null;
}
/** The compass's four arms from the node's typed edges (atlasModel relatedGroups' types) and the lesson's circle links. */
export function compassOf({ node = null, piece = null, lessonTitles = new Map(), entries = [] } = {}) {
  const up = [], down = [], side = [], roles = [];
  const push = (arr, x) => { if (x && !arr.some((y) => y.name === x.name)) arr.push(x); };
  for (const r of node?.related || []) {
    const item = { name: r.name, slug: r.slug, kind: r.kind };
    // the node's typed edges (atlasModel EDGE_ORDER): it asks for / is part of → builds on ↑; leads to, or is asked for by
    // / includes → leads to ↓; used with / alternatives → related ↔; any role → roles that need it ←
    const t = String(r.type || ""), inward = r.dir === "in";
    if (!r.slug) continue;
    if (r.kind === "role") push(roles, item);
    else if ((t === "requires" || t === "part_of") && !inward) push(up, item);
    else if (t === "leads_to" ? !inward : (t === "requires" || t === "part_of") && inward) push(down, item);
    else if (t === "leads_to" && inward) push(up, item);
    else push(side, item);
  }
  for (const r of node?.onTheBoard?.topRoles || []) push(roles, { name: r.name, slug: r.slug, kind: "role" });
  for (const nd of piece?.needs || []) push(up, { name: lessonTitles.get(nd.id) || nd.id, lessonId: nd.id });
  for (const id of piece?.opens || []) push(down, { name: lessonTitles.get(id?.id ?? id) || String(id?.id ?? id), lessonId: id?.id ?? id });
  for (const t of piece?.teaches || []) if (t.slug) push(side, { name: t.name, slug: t.slug });
  const known = new Map(entries.map((e) => [e.slug || e.lessonId, e]));
  const fix = (x) => ({ ...x, entry: known.get(x.slug || x.lessonId) || null });
  return { up: up.slice(0, 6).map(fix), down: down.slice(0, 6).map(fix), side: side.slice(0, 6).map(fix), roles: roles.slice(0, 5).map(fix) };
}

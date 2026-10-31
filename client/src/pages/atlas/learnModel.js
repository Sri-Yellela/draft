// client/src/pages/atlas/learnModel.js — ⭐ D115 P2–P3 / ⭐ D117 · the Learn view's pure half: steps and pieces, a piece's
// earned state (the ONE rule, shared/learnStepState.js), what is next, the circle's geometry, routes and the words the
// page says. No React here, so the rules are testable as plain functions.
// ⭐ D117 C8: progress is EARNED, never ticked — nothing here (or anywhere on the page) marks an item or a piece done.
// Signed out, nothing is recorded; D115's browser ticks ("draft-learn-progress") are no longer read or written.
import { matchCandidate } from "../../../../shared/atlasSearchNormalize.js";
import { stepState, checkpointId, buildId, wordCount, EXPLAIN_MIN_WORDS, OWN_WORDS } from "../../../../shared/learnStepState.js";
import { routeClosure, routeStart, goBackTo } from "../../../../shared/learnCircle.js";
export { stepState, checkpointId, buildId, wordCount, EXPLAIN_MIN_WORDS, OWN_WORDS, routeClosure, routeStart, goBackTo };

/** Every step in order, with its part, phase and numbers — the tracker's own "Step 1 … 108". */
export function flatSteps(learn) {
  const out = [];
  (learn?.PARTS || []).forEach((part, pi) => (part.phases || []).forEach((ph, phi) => (ph.steps || []).forEach((s, si) => {
    out.push({ ...s, n: out.length + 1, partIndex: pi + 1, part: part.t, phase: ph.t, phaseId: ph.id, inPhase: si + 1 });
  })));
  return out;
}

/**
 * ⭐ D117 C1 · THE PIECES: every step with the circle's overlay — its live P5 items appended (optional), "Before this"
 * (needs, with their status), "After this" (opens), the Atlas nodes it teaches. @param circle GET /api/learn/circle
 */
export function piecesOf(learn, circle) {
  const over = circle?.pieces || {};
  return flatSteps(learn).map(s => {
    const o = over[s.id] || {};
    return { ...s, items: [...(s.items || []), ...(o.extras || [])], needs: o.needs || [], opens: o.opens || [], teaches: o.teaches || [] };
  });
}
/** Map(id → [need ids]) — what the graph functions read (drafted links are used, marked "draft" on the page). */
export const needsMap = (pieces) => new Map(pieces.map(p => [p.id, (p.needs || []).map(n => n.id)]));

/** One phase number per phase across the whole path (the tracker's grid numbers). */
export function phaseNumbers(learn) {
  const m = new Map(); let n = 0;
  for (const part of learn?.PARTS || []) for (const ph of part.phases || []) m.set(ph.id, ++n);
  return m;
}

/** Up next: the first step not finished — skipping advanced steps when "Basics first" is on. */
export function nextStep(steps, marks, { basicsOnly = false } = {}) {
  return steps.find(s => !(basicsOnly && s.lv === "a") && !stepState(s, marks).complete) || null;
}

/** "N of M core resources opened" — the required items with a link, across the path. */
export function coreCounts(steps, marks) {
  const req = steps.flatMap(s => (s.items || []).filter(it => !it.o && it.u));
  return { done: req.filter(it => marks[it.id]).length, total: req.length };
}

/** The Concepts view's search — the ONE normaliser (BUG 10-31), over the term, then its definition. */
export function searchConcepts(index, q) {
  const query = String(q ?? "").trim();
  if (!query) return (index || []).map(t => ({ ...t, via: null }));
  const hits = [];
  for (const t of index || []) {
    const m = matchCandidate(query, { name: t.term, definition: t.def });
    if (m) hits.push({ ...t, via: m.via, rank: m.rank });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.term.localeCompare(b.term)).map(({ rank, ...t }) => t);
}

// ── ⭐ D117 C3 · the circle ─────────────────────────────────────────────────────────────────────

/** A piece on the circle follows its bar: open (nothing yet) · half (> 0) · filled (finished). */
export const circleState = (st) => (st.complete ? "filled" : st.started ? "half" : "open");

export const GEO = Object.freeze({ size: 640, c: 320, r: 248, gap: 0.05, square: 10 });
/** The ring's layout: each piece's angle in path order, each part's arc. Step 1 is at the top — one place on the ring. */
export function circleLayout(pieces) {
  const parts = [];
  for (const p of pieces) {
    if (!parts.length || parts[parts.length - 1].index !== p.partIndex) parts.push({ index: p.partIndex, t: p.part, ids: [] });
    parts[parts.length - 1].ids.push(p.id);
  }
  const per = (Math.PI * 2 - GEO.gap * parts.length) / Math.max(1, pieces.length);
  const angle = new Map();
  let a = -Math.PI / 2 + GEO.gap / 2;
  for (const part of parts) {
    part.a0 = a;
    for (const id of part.ids) { angle.set(id, a + per / 2); a += per; }
    part.a1 = a;
    a += GEO.gap;
  }
  return { angle, parts };
}
const r2 = (x) => Math.round(x * 100) / 100;
export const pointAt = (layout, id, r = GEO.r) => { const a = layout.angle.get(id) ?? 0; return [r2(GEO.c + r * Math.cos(a)), r2(GEO.c + r * Math.sin(a))]; };
/** A chord inside the ring between two pieces (orange: what it builds on; blue: what it opens). */
export function chordPath(layout, from, to) {
  const [x1, y1] = pointAt(layout, from, GEO.r - 12), [x2, y2] = pointAt(layout, to, GEO.r - 12);
  const k = 0.18, mx = r2(GEO.c + ((x1 + x2) / 2 - GEO.c) * k), my = r2(GEO.c + ((y1 + y2) / 2 - GEO.c) * k);
  return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
}
/** A route as ONE ink stroke looping through its pieces in order. */
export function routePath(layout, ids) {
  let d = "", prev = null;
  for (const id of ids) {
    const p = pointAt(layout, id, GEO.r - 12);
    if (!prev) d = `M${p[0]} ${p[1]}`;
    else d += ` Q${r2(GEO.c + ((p[0] + prev[0]) / 2 - GEO.c) * 0.55)} ${r2(GEO.c + ((p[1] + prev[1]) / 2 - GEO.c) * 0.55)} ${p[0]} ${p[1]}`;
    prev = p;
  }
  return d;
}
/** A part's arc outside the ring. */
export function arcPath(part, r = GEO.r + 22) {
  const x0 = r2(GEO.c + r * Math.cos(part.a0)), y0 = r2(GEO.c + r * Math.sin(part.a0));
  const x1 = r2(GEO.c + r * Math.cos(part.a1)), y1 = r2(GEO.c + r * Math.sin(part.a1));
  return `M${x0} ${y0} A${r} ${r} 0 ${part.a1 - part.a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

// ── C4 · the piece's words ─────────────────────────────────────────────────────────────────────

/** "Part 4 · Distributed systems · one piece of the whole" */
export const whereLine = (p) => `Part ${p.partIndex} · ${p.part} · ${p.phase} · one piece of the whole`;
/** "Piece 54 of 108" */
export const pieceOf = (p, total) => `Piece ${p.n} of ${total}`;
/** The bar's line — "opened", never "done" (draft cannot know a video was watched). */
export function barLine(st) {
  const parts = [`${st.opened} of ${st.toOpen} opened`, `${st.explained} of ${st.checkpoints} explained`];
  if (st.build) parts.push(st.built ? "build linked" : "build not linked yet");
  if (st.extrasTotal) parts.push(`${st.extras} of ${st.extrasTotal} extras`);
  return parts.join(" · ");
}
/** The toast when a piece is finished by what the user just did. */
export function unlockLine(unlocked) {
  const names = (unlocked || []).map(u => u.name);
  if (!names.length) return "Piece finished.";
  return `Piece finished. Unlocked on your map: ${names.slice(0, 4).join(", ")}${names.length > 4 ? " and more" : ""}`;
}
/** C8 (2): a paste of 25+ words is refused before it lands. @returns the words pasted, and whether it is refused */
export function pasteVerdict(text) {
  const words = wordCount(text);
  return { words, refused: words >= EXPLAIN_MIN_WORDS, message: words >= EXPLAIN_MIN_WORDS ? OWN_WORDS : null };
}

// ── C5 · routes ───────────────────────────────────────────────────────────────────────────────

/** The routes as the page offers them: the stored ones (data), then "From your map" when the user has one. */
export function routesFor(circle, pieces, myRoute) {
  const order = pieces.map(p => p.id), needs = needsMap(pieces);
  const out = (circle?.routes || []).map(r => ({ id: r.id, name: r.name, list: r.targets === "*" ? order : routeClosure(needs, order, r.targets) }));
  if (myRoute?.name && myRoute.targets?.length) out.push({ id: "my-map", name: myRoute.name, list: routeClosure(needs, order, myRoute.targets) });
  return out.filter(r => r.list.length);
}
/** "Make sense of…": the piece that teaches a concept (the concept index through the one normaliser, then titles). */
export function pieceForConcept(query, pieces, index) {
  const q = String(query ?? "").trim();
  if (!q) return null;
  const ids = new Set(pieces.map(p => p.id));
  const hit = searchConcepts(index, q).find(t => t.via !== "definition" && ids.has(t.st));
  if (hit) return hit.st;
  const byTitle = pieces.find(p => matchCandidate(q, { name: p.t }));
  return byTitle ? byTitle.id : null;
}

/** ⭐ C6 · an entry from anywhere (the Atlas, D114's popup, Your map, search) lands on #step-<id>: that piece opens. */
export function entryFromHash(hash) {
  const m = /^#step-(.+)$/.exec(String(hash ?? ""));
  return m ? decodeURIComponent(m[1]) : null;
}

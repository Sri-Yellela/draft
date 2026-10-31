// shared/learnCircle.js — ⭐ D117 · LEARN AS A CIRCLE: the links between pieces, defined once for the server (the import's
// loop check, the "From your map" route) and the client (the circle, the routes, "Go back to understand").
//
//   needs   piece → the pieces it builds on ("Before this", C1 / C2) — stored, drafted or accepted (a rejected link is
//           not a link)
//   opens   piece → the pieces that build on it ("After this") — the INVERSE of needs, computed, never stored
//   route   a target set → everything it builds on, recursively → ordered so nothing comes before what it builds on;
//           ties go to the circle's own order (C5). It starts at the first piece the learner hasn't finished.
// No model, no network: plain functions over ids.

/** @param needs Map(id → [ids]) | { [id]: [ids] } @returns Map(id → [ids]) */
const asMap = (needs) => (needs instanceof Map ? needs : new Map(Object.entries(needs || {})));

/** "After this": the inverse of needs, each list in the circle's order (`order` = every piece id in path order). */
export function opensOf(needs, order) {
  const n = asMap(needs);
  const place = new Map((order || [...n.keys()]).map((id, i) => [id, i]));
  const out = new Map();
  for (const [id, list] of n) for (const need of list || []) {
    if (!out.has(need)) out.set(need, []);
    if (!out.get(need).includes(id)) out.get(need).push(id);
  }
  for (const list of out.values()) list.sort((a, b) => (place.get(a) ?? 1e9) - (place.get(b) ?? 1e9));
  return out;
}

/** A loop in the needs, as the path that closes it ([a, b, a]), or null. */
export function findCycle(needs) {
  const n = asMap(needs);
  const state = new Map();   // 1 = on the path, 2 = done
  const path = [];
  const visit = (id) => {
    state.set(id, 1); path.push(id);
    for (const next of n.get(id) || []) {
      if (state.get(next) === 1) return [...path.slice(path.indexOf(next)), next];
      if (!state.get(next)) { const c = visit(next); if (c) return c; }
    }
    path.pop(); state.set(id, 2);
    return null;
  };
  for (const id of n.keys()) if (!state.get(id)) { const c = visit(id); if (c) return c; }
  return null;
}

/**
 * A route: the targets and everything they build on, ordered so nothing comes before what it builds on (ties: the
 * circle's order). Unknown ids are dropped. @returns string[]
 */
export function routeClosure(needs, order, targets) {
  const n = asMap(needs);
  const place = new Map(order.map((id, i) => [id, i]));
  const inSet = new Set();
  const walk = (id) => { if (inSet.has(id) || !place.has(id)) return; inSet.add(id); for (const x of n.get(id) || []) walk(x); };
  for (const t of targets || []) walk(t);
  const indeg = new Map([...inSet].map(id => [id, (n.get(id) || []).filter(x => inSet.has(x)).length]));
  const opens = opensOf(new Map([...inSet].map(id => [id, (n.get(id) || []).filter(x => inSet.has(x))])), order);
  const ready = [...inSet].filter(id => !indeg.get(id));
  const out = [];
  while (ready.length) {
    ready.sort((a, b) => place.get(a) - place.get(b));
    const id = ready.shift();
    out.push(id);
    for (const o of opens.get(id) || []) { indeg.set(o, indeg.get(o) - 1); if (indeg.get(o) === 0) ready.push(o); }
  }
  return out;
}

/** Where a route starts: the first piece not finished, else its first. @param finished Set | (id) => boolean */
export function routeStart(route, finished) {
  const done = typeof finished === "function" ? finished : (id) => finished.has(id);
  return route.find(id => !done(id)) ?? route[0] ?? null;
}

/**
 * "Go back to understand: <…>" — the first unfinished piece this one builds on, AT ANY DEPTH: the route to the piece,
 * read from its deepest roots up, so the learner is sent to the earliest gap, not the nearest. null when all are finished.
 */
export function goBackTo(needs, order, id, finished) {
  const done = typeof finished === "function" ? finished : (x) => finished.has(x);
  return routeClosure(needs, order, [id]).filter(x => x !== id).find(x => !done(x)) ?? null;
}

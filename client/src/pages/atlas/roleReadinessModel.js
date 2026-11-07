// client/src/pages/atlas/roleReadinessModel.js — ⭐ D178-3 · the readiness dial's arcs and the branch labels, pure (the numbers
// are the server's, services/atlas/roleReadiness.js — never re-derived here).
export const TIER_LABEL = Object.freeze({ must: "Must-have", common: "Common", nice: "Nice to have" });

/** The dial: the ring's radius and the dash arrays for "ready" and for ready + "waiting" (the lighter segment under it). */
export function dialArcs(ready = 0, waiting = 0, r = 48) {
  const c = 2 * Math.PI * r;
  const len = (p) => Math.max(0, Math.min(100, p)) * c / 100;
  return { r, ready: ready > 0 ? `${len(ready).toFixed(1)} ${c.toFixed(1)}` : null,
    waiting: waiting > 0 ? `${len(ready + waiting).toFixed(1)} ${c.toFixed(1)}` : null };
}

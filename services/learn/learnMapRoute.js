// services/learn/learnMapRoute.js — ⭐ D117 C5 · "From your map": the user's own guided route. Your map's route (D116 M4 —
// the aim role's top skills not yet had, closest first) → the pieces that teach those skills (D116 M8's stepsTeaching,
// the one seam) → the targets of a route like any other; the client closes it over "Before this" (shared/learnCircle.js
// routeClosure) and starts it at the first unfinished piece. Per user, computed on request, never stored.
import { computeYourMap, atlasIndex } from "../atlas/atlasMe.js";
import { stepsTeaching } from "../atlas/atlasTree.js";
import { learnContent } from "./learnContent.js";

/** @returns {{ name, targets: string[], skills: string[] } | { name: null, targets: [], reason }} */
export function mapRouteFor(db, userId, learn = learnContent(db)) {
  const map = computeYourMap(db, userId);
  const tree = map.tree;
  const aim = tree?.user?.aim;
  if (!tree || !aim || !(tree.route || []).length) return { name: null, targets: [], skills: [], reason: map.reason || "no_route" };
  const idx = atlasIndex(db);
  const bySlug = new Map(idx.nodes.map(n => [n.slug, n]));
  const targets = [], skills = [];
  for (const slug of tree.route) {
    const n = bySlug.get(slug);
    if (!n) continue;
    const steps = stepsTeaching(db, n, learn).map(s => s.stepId);
    if (!steps.length) continue;
    skills.push(n.name);
    for (const s of steps) if (!targets.includes(s)) targets.push(s);
  }
  return { name: `From your map: ${aim.level} ${aim.name}`, targets, skills };
}

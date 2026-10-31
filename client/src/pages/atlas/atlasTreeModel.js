// ⭐ D116 M3–M5, M8, M10 · THE TREE'S WORDS AND CHOICES — pure, so the drawing (AtlasTree.jsx) holds no rules:
// what a node is called to a screen reader, a family list's rows, the waypoints and what each flies to, Fly my route's
// order, what a selection lights and dims, and which nodes just unlocked. The facts themselves (M5's sentences) come
// from the server, measured (services/atlas/atlasTree.js) — nothing here counts the board.
import { pathBack, pathEdges } from "./atlasTreeLayout.js";
import { FAMILIES } from "../../../../shared/atlasFamilies.js";

export const familyLabel = (key) => FAMILIES.find(f => f.key === key)?.name ?? key;

/** M10 · a node's accessible name: "Model serving, you don't have it yet, 81 % close, 380 postings". */
export function ariaFor(n, page = "you") {
  const posts = `${n.postings} posting${n.postings === 1 ? "" : "s"}`;
  if (page !== "you") return `${n.name}, ${n.have ? "you have it" : "you don't have it yet"}, ${n.share} % of postings, ${posts}`;
  if (n.have) return `${n.name}, you have it, ${posts}`;
  const state = n.learned ? "learned in the course" : n.state === "learning" && n.progress ? `learning, ${n.progress.done} of ${n.progress.total} in its step` : "you don't have it yet";
  return `${n.name}, ${state}, ${n.closeness ?? 0} % close, ${posts}`;
}

/** M3 · the label under a node's name: "81 % close · 380", "940 postings", or "64 % of postings" on a page. */
export const subFor = (n) => n.sub || "";

/** M4 · a family list's row: "81 % close · 380 postings · +23 toward senior". */
export function rowLine(n, page = "you") {
  if (page !== "you") return `${n.have ? "You have it · " : ""}${n.share} % of postings · ${n.postings} postings`;
  if (n.have) return `You have it · ${n.postings} postings`;
  return `${n.learned ? "Learned · " : ""}${n.closeness ?? 0} % close · ${n.postings} postings${n.rises && n.rise != null ? ` · +${n.rise} toward senior` : ""}`;
}

/** M4 · a family's list, in the server's order (yours first by postings, then closest → furthest). */
export function familyList(tree, key) {
  const bySlug = new Map(tree.nodes.map(n => [n.slug, n]));
  const f = (tree.families || []).find(x => x.key === key);
  return f ? f.order.map(s => bySlug.get(s)).filter(Boolean) : [];
}

/** M10 · Tab order: family by family (the tree's order), each in its list order; only drawn nodes are buttons. */
export function tabOrder(tree) {
  return (tree.families || []).flatMap(f => familyList(tree, f.key).filter(n => n.onTree).map(n => n.slug));
}

/** M4 · the waypoints row: You · Your skills · Next up: <best> · Toward senior · the families (· Fly my route). */
export function waypoints(tree) {
  const fams = (tree.families || []).map(f => ({ id: `family:${f.key}`, label: f.name, target: { kind: "family", key: f.key }, family: f.key }));
  if (tree.page !== "you") return [{ id: "all", label: "Everything", target: { kind: "fit" } }, ...(tree.page === "role" ? fams : [])];
  const next = tree.nextUp ? tree.nodes.find(n => n.slug === tree.nextUp) : null;
  return [
    { id: "you", label: "You", target: { kind: "fit" } },
    { id: "yours", label: "Your skills", target: { kind: "yours" }, special: "have" },
    ...(next ? [{ id: "next", label: `Next up: ${next.name}`, target: { kind: "node", slug: next.slug } }] : []),
    ...(tree.user?.aim ? [{ id: "senior", label: "Toward senior", target: { kind: "fit" }, special: "risers" }] : []),
    ...fams,
  ];
}

/** M4 · Fly my route: the route's steps in order (step 1 first). */
export const tourOrder = (tree) => (tree.route || []).slice();
export const flyRouteLabel = (tree) => `Fly my route to ${tree.user?.aim ? `senior ${tree.user.aim.name}` : "senior"} ▸`;

/**
 * M4 · what a selection lights and dims.
 * @param state { sel: slug | null, focusFam: key | null, special: "have" | "risers" | null }
 * @returns {{ path: string[], hotEdges: Set, links: string[], dimNode: (slug) => boolean, dimEdge: (edge) => boolean }}
 */
export function selectionView(tree, layout, { sel = null, focusFam = null, special = null } = {}) {
  const bySlug = new Map(tree.nodes.map(n => [n.slug, n]));
  const path = sel ? pathBack(sel, tree, layout) : [];
  const lit = new Set(path);
  const hotEdges = sel ? pathEdges(path) : new Set();
  const s = sel ? bySlug.get(sel) : null;
  // Dashed accent links to its OTHER asked-with skills (not the one it hangs off), drawn ones only.
  const links = s && tree.page === "you" && !s.have ? (s.askedWith || []).map(w => w.slug).filter(h => h !== s.parent && layout.pos.has(h)) : [];
  const linked = new Set(links);
  const dimNode = (slug) => {
    const n = bySlug.get(slug);
    if (special === "risers") return !n?.rises;
    if (special === "have") return !(n?.have || n?.learned);
    if (focusFam) return n?.family !== focusFam;
    if (sel) return !(lit.has(slug) || linked.has(slug));
    return false;
  };
  const dimEdge = (e) => {
    if (sel) return !hotEdges.has(e.id);
    if (focusFam) return e.family !== focusFam;
    if (special === "risers") return !(bySlug.get(e.to)?.rises);
    if (special === "have") return !(bySlug.get(e.to)?.have || bySlug.get(e.to)?.learned);
    return false;
  };
  return { path, hotEdges, links, dimNode, dimEdge };
}

/** ⭐ M8 · the nodes that became learned since this reader last saw the tree (they play the unlock, once). */
export function newlyLearned(tree, seenBefore) {
  if (!Array.isArray(seenBefore)) return [];   // a first visit plays nothing
  const before = new Set(seenBefore);
  return tree.nodes.filter(n => n.learned && !before.has(n.slug)).map(n => n.slug);
}
export const learnedNow = (tree) => tree.nodes.filter(n => n.learned).map(n => n.slug);
export const LEARNED_KEY = "draft-atlas-learned";

/** M8 · a learning node's progress arc: the share of its step done, 0–100 (the ring's dash). */
export const progressArc = (n) => (n.progress && n.progress.total ? Math.round((n.progress.done / n.progress.total) * 100) : null);

/** Your map's header line: "From your résumé: Backend Engineer, mid level, 11 skills. Aim: senior." */
export function headerLine(tree) {
  const u = tree.user || {};
  const have = tree.nodes.filter(n => n.have).length;
  const who = [u.role?.name, u.level ? `${u.level} level` : null].filter(Boolean).join(", ");
  return `From your résumé: ${who ? `${who}, ` : ""}${have} skill${have === 1 ? "" : "s"} on the tree.${u.aim ? ` Aim: ${u.aim.level} ${u.aim.name}.` : ""}`;
}

// shared/atlasFamilies.js — ⭐ D116 M1 · THE ATLAS FAMILIES, defined once: the server (the tree's data, the editor's
// check, the seed) and the client (the branch colours, the waypoints, the editor's choice) read this list.
// A family is a stored field on atlas_nodes (migration 201); its order here is the tree's order round the circle.
// More may be added (owner 10-31): one line here, one colour token in AtlasTree.css.

export const FAMILIES = Object.freeze([
  Object.freeze({ key: "ml", name: "ML" }),
  Object.freeze({ key: "systems", name: "Systems" }),
  Object.freeze({ key: "infra", name: "Infra" }),
  Object.freeze({ key: "data", name: "Data" }),
  Object.freeze({ key: "backend", name: "Backend" }),
]);

export const FAMILY_KEYS = Object.freeze(FAMILIES.map(f => f.key));
export const familyName = (key) => FAMILIES.find(f => f.key === key)?.name ?? null;
export const isFamily = (key) => FAMILY_KEYS.includes(key);

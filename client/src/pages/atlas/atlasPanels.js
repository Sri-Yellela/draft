// client/src/pages/atlas/atlasPanels.js — ⭐ D167 (owner APPROVED 11-06, Atlas.html) · ATLAS AS A PRODUCT WITH ITS OWN
// NAVIGATION: the panels, their groups and which panel an Atlas address belongs to. Pure — the tests read it.
//
// Three groups (the sketch's): You · Grow · Explore. Every panel has an address, /atlas/<id> (and /app/atlas/<id>); the
// Atlas's older addresses keep working and light the panel they now live in (docs/D167_ATLAS_MAP.md, the mapping):
//   /atlas                → Overview            /atlas?q=…           → Roles and skills (the search)
//   /atlas/<node slug>    → Roles and skills    /atlas/family/<key>  → Your map (the families are the map's)
//   /atlas/learn(#step-…) → Learn               /atlas/check         → Your skills (D142's check, until D169's panel)
// ⚠ A panel id is a reserved slug, like "learn" and "check" before it: ids are chosen so no node name slugs to one
// (slugOf("Glossary") would — no published node has that name; d167AtlasKeepsEverySurface pins the list).

export const ATLAS_NAV = Object.freeze([
  { group: "You", panels: [
    { id: "overview", label: "Overview" },
    { id: "your-map", label: "Your map" },
    { id: "your-skills", label: "Your skills" },
    { id: "your-route", label: "Your route" },
  ] },
  { group: "Grow", panels: [
    { id: "learn", label: "Learn" },
    { id: "todays-question", label: "Today's question" },
    { id: "the-audit", label: "The audit" },
  ] },
  { group: "Explore", panels: [
    { id: "roles-and-skills", label: "Roles and skills" },
    { id: "this-weeks-market", label: "This week's market" },
    { id: "glossary", label: "Glossary" },
  ] },
]);

export const PANEL_IDS = Object.freeze(ATLAS_NAV.flatMap(g => g.panels.map(p => p.id)));
export const PANEL_LABEL = Object.freeze(Object.fromEntries(ATLAS_NAV.flatMap(g => g.panels.map(p => [p.id, p.label]))));
/** Older reserved addresses that now open a panel. */
export const PANEL_ALIASES = Object.freeze({ check: "your-skills" });

/** The panel an Atlas address belongs to. `slug` is the path after the mount ("" for the mount itself). */
export function panelFor(slug, q = "") {
  const s = String(slug || "");
  if (!s) return q ? "roles-and-skills" : "overview";
  if (PANEL_IDS.includes(s)) return s;
  if (PANEL_ALIASES[s]) return PANEL_ALIASES[s];
  if (s.startsWith("family/")) return "your-map";
  return "roles-and-skills";
}

/** Is this address a panel itself (not a node, a family or a search inside one)? */
export const isPanelSlug = (slug) => PANEL_IDS.includes(String(slug || "")) || !!PANEL_ALIASES[String(slug || "")];

/** A panel's address under a mount. Overview is the mount itself (/atlas/overview works too). */
export const panelHref = (base, id) => (id === "overview" ? base : `${base}/${id}`);

/** The Learn panel's stages: one per part of the path, with its EARNED progress (the one stepState rule). */
export function learnStages(steps, stateOf) {
  const parts = [];
  for (const s of steps) {
    if (!parts.length || parts[parts.length - 1].index !== s.partIndex) parts.push({ index: s.partIndex, title: s.part, steps: [] });
    parts[parts.length - 1].steps.push(s);
  }
  return parts.map(p => {
    const done = p.steps.filter(s => stateOf(s).complete).length;
    const next = p.steps.find(s => !stateOf(s).complete) || p.steps[0];
    const started = p.steps.some(s => { const st = stateOf(s); return st.started || st.complete; });
    return { index: p.index, title: p.title, done, total: p.steps.length, pct: p.steps.length ? Math.round((done / p.steps.length) * 100) : 0,
      state: done === p.steps.length && done > 0 ? "done" : started ? "started" : "new", nextId: next?.id || null };
  });
}

/** Overview's stat cards — only numbers that exist (no practice streak until D154 records one). */
export function overviewStats({ readiness = null, nav = null } = {}) {
  const out = [];
  if (Array.isArray(readiness) && readiness.length) {
    const proven = readiness.filter(s => s.state === "checked" || s.state === "built").length;
    out.push({ id: "skills", value: `${proven} of ${readiness.length}`, label: "skills checked or built", panel: "your-skills" });
  }
  if (nav?.ready) {
    if (Array.isArray(nav.bridges)) out.push({ id: "bridges", value: String(nav.bridges.length), label: "roles you cover enough to apply to now", panel: "your-route" });
    if (nav.route?.skills?.length) out.push({ id: "route", value: String(nav.route.skills.length), label: `skills on your route${nav.route.role ? ` to ${nav.route.role}` : ""}`, panel: "your-route" });
  }
  return out;
}

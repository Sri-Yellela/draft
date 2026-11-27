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
    // ⭐ 46u (owner 11-17: "move your map to the top in atlas and make it the default screen"): Your map first.
    { id: "your-map", label: "Your map" },
    // ⭐ D172 (3): Your run — your level, points from proof, streak and today's quests.
    { id: "your-run", label: "Your run" },
    { id: "your-skills", label: "Your skills" },
  ] },
  { group: "Grow", panels: [
    // ⭐ D172 (2): the Library — the courses as a shelf; /atlas/library/<course> is a course's page.
    { id: "library", label: "Library" },
    // ⭐ A154 (45o, the D172 sketch): How it works — each idea as one picture (its flow), from the decks.
    { id: "how-it-works", label: "How it works" },
    { id: "todays-question", label: "Today's question" },
    { id: "the-audit", label: "The audit" },
  ] },
  { group: "Explore", panels: [
    { id: "roles-and-skills", label: "Roles and skills" },
    { id: "this-weeks-market", label: "This week's market" },
    { id: "glossary", label: "Glossary" },
  ] },
]);

// ⭐ A154 / D172 (4) (45s, owner 11-08: "build league and challenges, can merge them later") · COMPETE — its own group, drawn
// only when the owner has turned its switch on (GET /api/atlas/compete). Its ids are reserved slugs whether or not it shows,
// so no node can take them; with the switch off the address opens Your run's place, never a node page.
export const COMPETE_NAV = Object.freeze({ group: "Compete", panels: Object.freeze([
  { id: "league", label: "This week's league", needs: "league" },
  { id: "challenges", label: "Challenges", needs: "challenges" },
]) });
export const COMPETE_PANEL_IDS = Object.freeze(COMPETE_NAV.panels.map(p => p.id));
/** The nav's groups for this reader: the three, plus Compete with only the panels whose switch is on. Pure. */
export function navGroups(compete = null) {
  const shown = COMPETE_NAV.panels.filter(p => !!compete?.[p.needs]);
  return shown.length ? [...ATLAS_NAV, { group: COMPETE_NAV.group, panels: shown }] : [...ATLAS_NAV];
}

export const PANEL_IDS = Object.freeze(ATLAS_NAV.flatMap(g => g.panels.map(p => p.id)));
export const PANEL_LABEL = Object.freeze(Object.fromEntries([...ATLAS_NAV, COMPETE_NAV].flatMap(g => g.panels.map(p => [p.id, p.label]))));
/** Older reserved addresses that now open a panel. */
// ⭐ D178 (the nav regrouped, owner 11-07): Your route is folded into Your map (the map IS the route drawn) — its address
// opens Your map. Overview is Atlas's signed-OUT front page (signed in, the mount opens Your map — 46u; Your run before); Learn's address
// redirects to the course's circle view (AtlasPage). Both stay reserved slugs, so no node can take them.
export const PANEL_ALIASES = Object.freeze({ check: "your-skills", "your-route": "your-map" });
export const RESERVED_PANELS = Object.freeze(["overview", "learn", "gazetteer", "routes"]);   // ⭐ D201 (47m): + the Gazetteer, Routes

/** The panel an Atlas address belongs to. `slug` is the path after the mount ("" for the mount itself). */
export function panelFor(slug, q = "") {
  const s = String(slug || "");
  if (!s) return q ? "roles-and-skills" : "overview";
  if (PANEL_IDS.includes(s)) return s;
  if (COMPETE_PANEL_IDS.includes(s)) return s;   // A154: shown only with its switch on (AtlasPage)
  if (PANEL_ALIASES[s]) return PANEL_ALIASES[s];
  // ⭐ D178: the reserved slugs light their home — /atlas/overview is the front page; /atlas/learn (redirecting to the
  // course's circle view) lights the Library, never Roles and skills.
  if (s === "overview") return "overview";
  if (s === "learn") return "library";
  if (s.startsWith("family/")) return "your-map";
  if (s.startsWith("library/")) return "library";
  return "roles-and-skills";
}

/** Is this address a panel itself (not a node, a family or a search inside one)? */
export const isPanelSlug = (slug) => PANEL_IDS.includes(String(slug || "")) || COMPETE_PANEL_IDS.includes(String(slug || "")) ||!!PANEL_ALIASES[String(slug || "")] || RESERVED_PANELS.includes(String(slug || ""));

/** ⭐ D178 · a Learn piece's address. ⭐ D201 (47m, lane gaz): a piece is a GAZETTEER ENTRY now — its own page, where its links
 *  are opened, its checkpoints explained and its build linked (the circle stays a route's overview: /atlas/routes/<course>?view=circle). */
export const learnStepHref = (base, stepId) => `${base}/gazetteer/${encodeURIComponent(stepId)}`;
/** ⭐ D201 (47m): the Gazetteer's and Routes' own addresses (reserved: no node can take "gazetteer" or "routes"). */
export const GAZETTEER_SLUGS = Object.freeze(["gazetteer", "routes"]);
export const gazetteerOf = (slug) => { const s = String(slug || ""); const m = /^(gazetteer|routes)(?:\/(.+))?$/.exec(s); return m ? { page: m[1], id: m[2] || null } : null; };

/** A panel's address under a mount. Overview is the mount itself (/atlas/overview works too). */
export const panelHref = (base, id) => (id === "overview" ? base : `${base}/${id}`);

/** Overview's stat cards — only numbers that exist (no practice streak until D154 records one). */
export function overviewStats({ readiness = null, nav = null } = {}) {
  const out = [];
  if (Array.isArray(readiness) && readiness.length) {
    const proven = readiness.filter(s => s.state === "checked" || s.state === "built").length;
    out.push({ id: "skills", value: `${proven} of ${readiness.length}`, label: "skills checked or built", panel: "your-skills" });
  }
  if (nav?.ready) {
    if (Array.isArray(nav.bridges)) out.push({ id: "bridges", value: String(nav.bridges.length), label: "roles you cover enough to apply to now", panel: "your-map" });
    if (nav.route?.skills?.length) out.push({ id: "route", value: String(nav.route.skills.length), label: `skills on your route${nav.route.role ? ` to ${nav.route.role}` : ""}`, panel: "your-map" });
  }
  return out;
}

/** ⭐ D172 (2): the course a /atlas/library/<id> address opens, or null. */
export const courseIdOf = (slug) => { const s = String(slug || ""); return s.startsWith("library/") ? s.slice("library/".length) || null : null; };

// ── D93 · THE LAYOUT-OPTIONS REGISTRY — the ONLY list of layout choices (plug and play) ──────────────────
//
// Each entry is one choice on the Customise page: { id, label, description, attribute, values: [{ id, label,
// description, default? }] }. The page DRAWS ITSELF from this list, so adding an option is one entry here, its
// id list in shared/appearance.js (the server validates the same values) and the styles under its attribute —
// no page change. test/d93Customise.test.js is the contract: the ids equal shared/'s, exactly one default per
// option and it is shared/'s default, and every value has styles under [attribute="value"] in a stylesheet.
//
// ⛔ The values are applied as attributes on <html> (themes/index.js applyLayout, and before first paint by the
// pre-paint script). Stylesheets read them through CUSTOM PROPERTIES set on the element that carries the
// attribute — never as `[data-nav="track"] .x { … }` on the consuming rule — because a custom property
// inherits from the NEAREST carrier: the Customise page's preview sets its own attributes and is drawn in
// its own choice even while <html> still carries the old one (a descendant selector would match both).
import { LAYOUT_OPTION_IDS } from "../../../shared/appearance.js";

const def = (key, id) => (LAYOUT_OPTION_IDS[key].default === id ? { default: true } : {});

export const LAYOUT_OPTIONS = Object.freeze([
  {
    id: "nav", label: "Top bar", attribute: LAYOUT_OPTION_IDS.nav.attribute,
    description: "How the four pages are laid out across the top.",
    values: [
      { id: "ghost", label: "Ghost tabs", ...def("nav", "ghost"),
        description: "Only the page you are on is a box. The others stay quiet until you point at them." },
      { id: "track", label: "One track", ...def("nav", "track"),
        description: "All four sit in a single recessed track; the page you are on is filled." },
    ],
  },
  {
    id: "sentence", label: "Filter sentence", attribute: LAYOUT_OPTION_IDS.sentence.attribute,
    description: "The sentence at the top of Full House — “discovering all roles at all career levels…”.",
    values: [
      { id: "marked", label: "Marked words", ...def("sentence", "marked"),
        description: "The sentence stays text. A highlighter underline marks a word you can change; only a filter you have set becomes a box." },
      { id: "calm", label: "Calm boxes", ...def("sentence", "calm"),
        description: "Every changeable word is a box — one height, room around each, no shadow until you point at it." },
    ],
  },
  {
    // ⭐ D114 P3 · styled in components/AtlasTerm.css under [data-learning-links="…"].
    id: "learning", label: "Learning links", attribute: LAYOUT_OPTION_IDS.learning.attribute,
    description: "Words in a job posting that have a page in the Atlas — point at one to see what it is and where to learn it.",
    values: [
      { id: "quiet", label: "Quiet", ...def("learning", "quiet"),
        description: "The posting reads as the employer wrote it. A dotted line appears only under the word you point at." },
      { id: "shown", label: "Shown", ...def("learning", "shown"),
        description: "A faint dotted line under every learning link, all the time — so you can see them without pointing." },
    ],
  },
].map((o) => Object.freeze({ ...o, values: Object.freeze(o.values.map((v) => Object.freeze(v))) })));

/** The default value of each option, from the registry. */
export const layoutDefaults = () => Object.fromEntries(LAYOUT_OPTIONS.map((o) => [o.id, o.values.find((v) => v.default).id]));

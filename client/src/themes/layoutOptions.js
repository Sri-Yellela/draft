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
    id: "sentence", label: "Filter sentence", attribute: LAYOUT_OPTION_IDS.sentence.attribute,
    description: "The sentence at the top of /draft — “discovering all roles at all career levels…”.",
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
  // ⛔ 45n (owner 11-08, decision (10)): the Navigation option (Automatic / Dock / Menu) is RETIRED — the dock is the one
  // navigation. A stored "navigation=…" flag reads as unknown and is ignored (shared/appearance.js parseLayoutFlags).
  {
    // ⭐ D145 · styled in index.css under [data-text-size="…"] (the --type-scale every scaled size multiplies).
    id: "text", label: "Text size", attribute: LAYOUT_OPTION_IDS.text.attribute,
    description: "How large draft's text is. Your browser's zoom still works on top.",
    values: [
      { id: "smaller", label: "Smaller", ...def("text", "smaller"), description: "A little smaller than usual." },
      { id: "default", label: "Default", ...def("text", "default"), description: "The size draft is designed at." },
      { id: "larger", label: "Larger", ...def("text", "larger"), description: "About an eighth larger." },
      { id: "largest", label: "Largest", ...def("text", "largest"), description: "A quarter larger." },
    ],
  },
  {
    // ⭐ D197 #17 (47m, the approved DarkPlate board) · styled in styles/plate.css under [data-plate-face="…"].
    id: "plate", label: "Plate pages", attribute: LAYOUT_OPTION_IDS.plate.attribute,
    description: "The map-paper pages — the market, Atlas, Home, Your passport. Paper follows your theme; Night is the plate's own dark version.",
    values: [
      { id: "paper", label: "Paper", ...def("plate", "paper"),
        description: "Warm paper and ink, in your theme's colours." },
      { id: "night", label: "Night", ...def("plate", "night"),
        description: "A warm near-black ground, paper-coloured lines, the clay lifted to stay the brightest thing on screen." },
    ],
  },
].map((o) => Object.freeze({ ...o, values: Object.freeze(o.values.map((v) => Object.freeze(v))) })));

/** The default value of each option, from the registry. */
export const layoutDefaults = () => Object.fromEntries(LAYOUT_OPTIONS.map((o) => [o.id, o.values.find((v) => v.default).id]));

// D91 P5 · THE ACCOUNT'S APPEARANCE — what may be stored, and how, read by the server and the client alike.
//
// Kept in the existing users.theme_preference column (migration 112), no new column: the value is the theme
// preference, plus ";cues" when shape cues are on — the same shape as the device's localStorage['draft-theme']
// (client/src/themes/index.js), so the two never translate. GET/PUT /api/settings/appearance speak
// { theme, cues, nav, sentence }; the older GET/PUT /api/settings/theme keep answering in system / light / dark
// only, so a client from before D91 is never handed a value it does not know.
//   theme: "system" (Paper Light / Charcoal Dark by the OS) · "contrast" (the Contrast pair by the OS) ·
//          a theme id · "light" / "dark" (the older names for the Paper pair)
// test/d91Appearance.test.js proves APPEARANCE_THEMES equals the client registry's preferences.
//
// ⭐ D93 · THE LAYOUT OPTIONS — the same string, two more flags: ";nav=<id>" and ";sentence=<id>", written only
// when they differ from the default (so every value stored before D93 still reads, and reads as the defaults).
// Chosen over a migration because the column already holds "the appearance" and the flags are the cues
// precedent: no schema change, one value to read, and an older client's PUT cannot drop what it does not know
// (the route MERGES, below). The ids live HERE so the server rejects exactly what the client cannot draw;
// client/src/themes/layoutOptions.js adds the labels and test/d93Customise.test.js holds the two equal.
export const LEGACY_THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
export const APPEARANCE_THEMES = Object.freeze([
  "system", "light", "dark", "contrast", "paper-light", "charcoal-dark", "contrast-light", "contrast-dark",
]);

/** D93: each layout option — the <html> attribute it drives, its values, and the default (the recommendation). */
export const LAYOUT_OPTION_IDS = Object.freeze({
  nav:      Object.freeze({ attribute: "data-nav",      values: Object.freeze(["ghost", "track"]), default: "ghost" }),
  sentence: Object.freeze({ attribute: "data-sentence", values: Object.freeze(["marked", "calm"]), default: "marked" }),
  // ⭐ D114 P3 (owner 10-31, "yes to all three") · the Atlas terms in a posting: quiet at rest (the owner's call), or
  // a faint dotted underline at rest for anyone who wants to see them without pointing (accessibility).
  learning: Object.freeze({ attribute: "data-learning-links", values: Object.freeze(["quiet", "shown"]), default: "quiet" }),
});
export const LAYOUT_KEYS = Object.freeze(Object.keys(LAYOUT_OPTION_IDS));
/** Every option at its default — what a new account, and every account stored before D93, reads. */
export const LAYOUT_DEFAULTS = Object.freeze(Object.fromEntries(LAYOUT_KEYS.map((k) => [k, LAYOUT_OPTION_IDS[k].default])));
export const isLayoutValue = (key, value) => !!LAYOUT_OPTION_IDS[key]?.values.includes(value);

/** The flags after the theme ("cues", "nav=track", …) → the layout, every option filled (unknown values → default). */
export function parseLayoutFlags(flags = []) {
  const out = { ...LAYOUT_DEFAULTS };
  for (const f of flags) {
    const [k, v] = String(f).split("=");
    if (isLayoutValue(k, v)) out[k] = v;
  }
  return out;
}
/** The layout → its flags: only the options that differ from their default. */
export function formatLayoutFlags(layout = {}) {
  return LAYOUT_KEYS.filter((k) => isLayoutValue(k, layout[k]) && layout[k] !== LAYOUT_OPTION_IDS[k].default).map((k) => `${k}=${layout[k]}`);
}

/** The stored column → { theme, cues, nav, sentence }; theme is null when nothing valid is stored. */
export function parseStoredAppearance(value) {
  const [theme, ...flags] = String(value ?? "").split(";");
  return { theme: APPEARANCE_THEMES.includes(theme) ? theme : null, cues: flags.includes("cues"), ...parseLayoutFlags(flags) };
}

/** { theme, cues, nav, sentence } → the stored column, or null when the theme (or a given layout value) is not one we know. */
export function formatStoredAppearance({ theme, cues, ...layout } = {}) {
  if (!APPEARANCE_THEMES.includes(theme)) return null;
  for (const k of LAYOUT_KEYS) if (layout[k] !== undefined && !isLayoutValue(k, layout[k])) return null;
  return [theme, cues ? "cues" : null, ...formatLayoutFlags(layout)].filter(Boolean).join(";");
}

// D91 P5 · THE ACCOUNT'S APPEARANCE — what may be stored, and how, read by the server and the client alike.
//
// Kept in the existing users.theme_preference column (migration 112), no new column: the value is the theme
// preference, plus ";cues" when shape cues are on — the same shape as the device's localStorage['draft-theme']
// (client/src/themes/index.js), so the two never translate. GET/PUT /api/settings/appearance speak
// { theme, cues }; the older GET/PUT /api/settings/theme keep answering in system / light / dark only, so a
// client from before D91 is never handed a value it does not know.
//   theme: "system" (Paper Light / Charcoal Dark by the OS) · "contrast" (the Contrast pair by the OS) ·
//          a theme id · "light" / "dark" (the older names for the Paper pair)
// test/d91Appearance.test.js proves APPEARANCE_THEMES equals the client registry's preferences.
export const LEGACY_THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
export const APPEARANCE_THEMES = Object.freeze([
  "system", "light", "dark", "contrast", "paper-light", "charcoal-dark", "contrast-light", "contrast-dark",
]);

/** The stored column → { theme, cues }; theme is null when nothing valid is stored. */
export function parseStoredAppearance(value) {
  const [theme, ...flags] = String(value ?? "").split(";");
  return { theme: APPEARANCE_THEMES.includes(theme) ? theme : null, cues: flags.includes("cues") };
}

/** { theme, cues } → the stored column, or null when the theme is not one we know. */
export function formatStoredAppearance({ theme, cues } = {}) {
  if (!APPEARANCE_THEMES.includes(theme)) return null;
  return cues ? `${theme};cues` : theme;
}

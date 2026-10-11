// ── THE THEME REGISTRY — the ONLY place a theme is chosen (D91, docs/THEME_MODULE.md §5) ──────────
//
// A theme is DATA, one file: { id, label, scheme: "light"|"dark", contrast: "aa"|"aaa", tokens, substrate }.
// Adding one is that file plus one line in THEME_LIST below — no component changes, because every colour
// the client paints (theme.* via themes/cinematic.js, C.* direct, var(--c-*) in CSS) derives from the one
// `C` this module resolves. test/d91ThemeModule.test.js is the contract: key parity, 6-digit hex, every
// declared pair at the theme's own target, nothing outside this file deciding a theme.
//
// RESOLVED ONCE, AT LOAD. Step 2b made 549 literals into C.TOKEN values read inline at render, and several
// modules capture a token in a module-level constant, so swapping values live would leave half the app on
// the old theme. A preference change therefore RELOADS (setThemePreference) and the whole app — inline
// styles, CSS variables, hex-alpha suffixes — resolves one palette, coherently. The preference is per
// device ("system" by default, which follows the OS) and follows the ACCOUNT once signed in.
import paperLight from "./paper-light.js";
import charcoalDark from "./charcoal-dark.js";

export const THEME_LIST = Object.freeze([paperLight, charcoalDark]);
export const THEMES = Object.freeze(Object.fromEntries(THEME_LIST.map((t) => [t.id, t])));
export const DEFAULT_THEME_ID = paperLight.id;

// The stored preference. "light" and "dark" name the Paper pair; "system" picks one by the OS scheme.
export const THEME_STORAGE_KEY = "draft-theme";
export const THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
const BY_SCHEME = Object.freeze({ light: paperLight.id, dark: charcoalDark.id });

export function themePreference(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = storage?.getItem(THEME_STORAGE_KEY); return THEME_PREFERENCES.includes(v) ? v : "system"; }
  catch { return "system"; }
}
/** The SCHEME a preference resolves to — "light" or "dark". */
export function resolveTheme(pref = themePreference(), matchMedia = typeof window !== "undefined" ? window.matchMedia : null) {
  if (pref === "light" || pref === "dark") return pref;
  try { return matchMedia?.call(typeof window !== "undefined" ? window : undefined, "(prefers-color-scheme: dark)")?.matches ? "dark" : "light"; }
  catch { return "light"; }
}
/** The THEME a preference resolves to. */
export function resolve(pref = themePreference(), matchMedia) {
  return THEMES[BY_SCHEME[resolveTheme(pref, matchMedia)]] || THEMES[DEFAULT_THEME_ID];
}
export function setThemePreference(pref) {
  try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch {}
  if (typeof location !== "undefined") location.reload();
}
/**
 * The ACCOUNT's preference wins on every device (follow-up 18). Called once the signed-in app knows
 * it. Stores it locally, and reloads ONLY if it changes what is actually on screen — so agreeing
 * values cost nothing, and there is no loop (after the reload the two agree).
 * @returns {boolean} whether a reload was triggered
 */
export function adoptAccountTheme(pref, { reload = () => location.reload() } = {}) {
  if (!THEME_PREFERENCES.includes(pref) || pref === themePreference()) return false;
  try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch { return false; }
  if (resolve(pref).id === ACTIVE_THEME.id) return false;
  reload();
  return true;
}

export const ACTIVE_THEME = resolve();
/** The live theme's scheme, "light" or "dark" — the name the older callers know. */
export const THEME = ACTIVE_THEME.scheme;
/** The live theme's tokens. */
export const C = ACTIVE_THEME.tokens;

// The custom-property name for a token: ACCENT_QUIET -> --c-accent-quiet. The same rule zLayers.js
// uses for --z-*, so the two scales read alike in a stylesheet.
export const cssVarName = (name) => `--c-${name.toLowerCase().replace(/_/g, "-")}`;

// Stylesheets need the same values, and two copies of a palette is how a palette rots. Publish
// them from this one definition so CSS says `var(--c-ink)` and never holds a literal.
export function installColorVars(doc = typeof document !== "undefined" ? document : null) {
  if (!doc?.documentElement) return;
  for (const [name, value] of Object.entries(C)) {
    doc.documentElement.style.setProperty(cssVarName(name), value);
  }
  if (doc.documentElement.dataset) {
    doc.documentElement.dataset.theme = ACTIVE_THEME.id;
    doc.documentElement.dataset.contrast = ACTIVE_THEME.contrast;
  }
  doc.documentElement.style.setProperty("color-scheme", THEME);
}

/**
 * NO FLASH. The bundle publishes the palette when it loads; until then the page is the browser's white.
 * This is the tiny script vite.config.js inlines into index.html's <head>, so the ground, the scheme and
 * the theme attributes are right BEFORE first paint. It is generated from this registry — the same
 * preference rule as resolve(), the same canvas as the theme — so it can neither drift nor hold a literal
 * in index.html. installColorVars later sets the same values, so the settled page is unchanged.
 */
export function prePaintScript() {
  const table = Object.fromEntries(Object.entries(BY_SCHEME).map(([scheme, id]) => {
    const t = THEMES[id];
    return [scheme, { id: t.id, contrast: t.contrast, canvas: t.tokens.CANVAS }];
  }));
  return `(function(){try{var T=${JSON.stringify(table)},p=null;try{p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}` +
    `var s=p==="light"||p==="dark"?p:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),t=T[s],d=document.documentElement;` +
    `d.setAttribute("data-theme",t.id);d.setAttribute("data-contrast",t.contrast);d.style.setProperty("color-scheme",s);d.style.setProperty("--c-canvas",t.canvas)}catch(e){}})();`;
}

installColorVars();

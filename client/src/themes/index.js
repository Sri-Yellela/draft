// ── THE THEME REGISTRY — the ONLY place a theme is chosen (D91, docs/THEME_MODULE.md §5) ──────────
//
// A theme is DATA, one file: { id, label, scheme: "light"|"dark", contrast: "aa"|"aaa", tokens, substrate }.
// Adding one is that file plus one line in THEME_LIST below — no component changes, because every colour
// the client paints (theme.* via themes/cinematic.js, C.* direct, var(--c-*) in CSS) derives from the one
// `C` this module resolves. test/d91ThemeModule.test.js is the contract; docs/THEMES.md the five steps.
//
// RESOLVED ONCE, AT LOAD. Step 2b made 549 literals into C.TOKEN values read inline at render, and several
// modules capture a token in a module-level constant, so swapping values live would leave half the app on
// the old theme. A preference change therefore RELOADS (setAppearance) and the whole app — inline styles,
// CSS variables, hex-alpha suffixes — resolves one palette, coherently. The preference is per device and
// follows the ACCOUNT once signed in (PUT /api/settings/appearance).
import paperLight from "./paper-light.js";
import charcoalDark from "./charcoal-dark.js";
import contrastLight from "./contrast-light.js";
import contrastDark from "./contrast-dark.js";

export const THEME_LIST = Object.freeze([paperLight, charcoalDark, contrastLight, contrastDark]);
export const THEMES = Object.freeze(Object.fromEntries(THEME_LIST.map((t) => [t.id, t])));
export const DEFAULT_THEME_ID = paperLight.id;

// ── The preference ────────────────────────────────────────────────────────────────────────────────────
// Stored in ONE key (no new storage key for D91): "<pref>" plus optional ";cues" (shape cues on) and
// ";no-offer" (the prefers-contrast banner dismissed). <pref> is a theme id, or a PAIR that follows the OS:
// "system" (Paper Light / Charcoal Dark), "contrast" (Contrast Light / Contrast Dark); "light" and "dark"
// are the older names for the Paper pair and still resolve.
export const THEME_STORAGE_KEY = "draft-theme";
const PAIRS = Object.freeze({
  system:   { light: paperLight.id,    dark: charcoalDark.id },
  contrast: { light: contrastLight.id, dark: contrastDark.id },
});
const LEGACY = Object.freeze({ light: paperLight.id, dark: charcoalDark.id });
export const THEME_PREFERENCES = Object.freeze(["system", "light", "dark", "contrast", ...THEME_LIST.map((t) => t.id)]);

const store = () => (typeof localStorage !== "undefined" ? localStorage : null);
function readRaw(storage = store()) { try { return storage?.getItem(THEME_STORAGE_KEY) || ""; } catch { return ""; } }
function parseRaw(raw) {
  const [pref, ...flags] = String(raw || "").split(";");
  return { pref: THEME_PREFERENCES.includes(pref) ? pref : "system", cues: flags.includes("cues"), noOffer: flags.includes("no-offer") };
}
const formatRaw = ({ pref, cues, noOffer }) => [pref, cues ? "cues" : null, noOffer ? "no-offer" : null].filter(Boolean).join(";");

export function themePreference(storage = store()) { return parseRaw(readRaw(storage)).pref; }
/** { pref, cues } as stored on this device. */
export function appearance(storage = store()) { const a = parseRaw(readRaw(storage)); return { pref: a.pref, cues: a.cues }; }

const osDark = (matchMedia) => {
  try { return !!matchMedia?.call(typeof window !== "undefined" ? window : undefined, "(prefers-color-scheme: dark)")?.matches; }
  catch { return false; }
};
const defaultMM = () => (typeof window !== "undefined" ? window.matchMedia : null);
/** The THEME a preference resolves to. */
export function resolve(pref = themePreference(), matchMedia = defaultMM()) {
  if (THEMES[pref]) return THEMES[pref];
  if (LEGACY[pref]) return THEMES[LEGACY[pref]];
  const pair = PAIRS[pref] || PAIRS.system;
  return THEMES[pair[osDark(matchMedia) ? "dark" : "light"]];
}
/** The SCHEME a preference resolves to — "light" or "dark" (the name older callers know). */
export function resolveTheme(pref = themePreference(), matchMedia = defaultMM()) { return resolve(pref, matchMedia).scheme; }
/** The pair preference a theme belongs to ("follow my system" from a chosen card). */
export function pairPreference(theme) { return theme.contrast === "aaa" ? "contrast" : "system"; }

export function setAppearance({ pref, cues }, { reload = () => location.reload() } = {}) {
  const cur = parseRaw(readRaw());
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ pref, cues: !!cues, noOffer: cur.noOffer })); } catch {}
  if (typeof location !== "undefined") reload();
}
/** The older, theme-only entry point (the avatar menu before D91). */
export function setThemePreference(pref) { setAppearance({ pref, cues: appearance().cues }); }
export function dismissContrastOffer() {
  const cur = parseRaw(readRaw());
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ ...cur, noOffer: true })); } catch {}
}
/**
 * The ACCOUNT's appearance wins on every device (follow-up 18). Called once the signed-in app knows it.
 * Stores it locally, and reloads ONLY if it changes what is actually on screen — so agreeing values cost
 * nothing, and there is no loop (after the reload the two agree). Accepts the older bare preference too.
 * @returns {boolean} whether a reload was triggered
 */
export function adoptAccountTheme(account, { reload = () => location.reload() } = {}) {
  const next = typeof account === "string" ? { pref: account, cues: appearance().cues } : { pref: account?.theme, cues: !!account?.cues };
  if (!THEME_PREFERENCES.includes(next.pref)) return false;
  const cur = parseRaw(readRaw());
  if (next.pref === cur.pref && next.cues === cur.cues) return false;
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ ...next, noOffer: cur.noOffer })); } catch { return false; }
  if (resolve(next.pref).id === ACTIVE_THEME.id && next.cues === CUES) return false;
  reload();
  return true;
}

// ── What is live ──────────────────────────────────────────────────────────────────────────────────────
const query = (q) => { try { return !!defaultMM()?.call(window, q)?.matches; } catch { return false; } };
export const ACTIVE_THEME = resolve();
/** The live theme's scheme, "light" or "dark". */
export const THEME = ACTIVE_THEME.scheme;
export const CUES = appearance().cues;
/** prefers-reduced-transparency: the glass resolves to its opaque composite (and backdrop-filter is off, cues.css). */
export const REDUCED_TRANSPARENCY = query("(prefers-reduced-transparency: reduce)");
/** prefers-contrast: more, on a non-contrast theme, not dismissed — OFFER the Contrast pair, never force it. */
export const CONTRAST_OFFER = query("(prefers-contrast: more)") && ACTIVE_THEME.contrast !== "aaa" && !parseRaw(readRaw()).noOffer;

// The glass keys that turn opaque under reduced transparency: each is composited over the canvas, once.
export const GLASS_KEYS = Object.freeze(["SURFACE", "SURFACE_2", "SURFACE_MENU", "SURFACE_MODAL", "GLASS_BODY_TOP", "GLASS_BODY", "GLASS_SHEEN"]);
export function opaqueTokens(tokens) {
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  const canvas = [1, 3, 5].map((i) => parseInt(tokens.CANVAS.slice(i, i + 2), 16));
  const out = { ...tokens };
  for (const k of GLASS_KEYS) {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(tokens[k]);
    if (!m) continue;
    const a = m[4] === undefined ? 1 : +m[4];
    out[k] = "#" + [1, 2, 3].map((i, j) => hex(+m[i] * a + canvas[j] * (1 - a))).join("");
  }
  return Object.freeze(out);
}
/** The live theme's tokens. */
export const C = REDUCED_TRANSPARENCY ? opaqueTokens(ACTIVE_THEME.tokens) : ACTIVE_THEME.tokens;

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
  const d = doc.documentElement.dataset;
  if (d) {
    d.theme = ACTIVE_THEME.id;
    d.contrast = ACTIVE_THEME.contrast;
    if (CUES) d.cues = "shape"; else delete d.cues;
    if (REDUCED_TRANSPARENCY) d.transparency = "reduced"; else delete d.transparency;
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
  const themes = Object.fromEntries(THEME_LIST.map((t) => [t.id, [t.contrast, t.scheme, t.tokens.CANVAS]]));
  const alias = { ...LEGACY };
  for (const [p, pair] of Object.entries(PAIRS)) alias[p] = [pair.light, pair.dark];
  return `(function(){try{var T=${JSON.stringify(themes)},A=${JSON.stringify(alias)},r="";try{r=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||""}catch(e){}` +
    `var f=r.split(";"),p=f[0],id=T[p]?p:null;if(!id){var a=A[p]||A.system;id=typeof a==="string"?a:a[window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?1:0]}` +
    `var t=T[id],d=document.documentElement;d.setAttribute("data-theme",id);d.setAttribute("data-contrast",t[0]);if(f.indexOf("cues")>0)d.setAttribute("data-cues","shape");` +
    `d.style.setProperty("color-scheme",t[1]);d.style.setProperty("--c-canvas",t[2])}catch(e){}})();`;
}

installColorVars();

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
import studioLight from "./studio-light.js";
import studioDark from "./studio-dark.js";
import duskLight from "./dusk-light.js";
import duskDark from "./dusk-dark.js";
import plainLight from "./plain-light.js";
import plainDark from "./plain-dark.js";
import { installShapeVars } from "./shapes.js";
import { LAYOUT_OPTION_IDS, LAYOUT_KEYS, LAYOUT_DEFAULTS, parseLayoutFlags, formatLayoutFlags } from "../../../shared/appearance.js";

export const THEME_LIST = Object.freeze([paperLight, charcoalDark, contrastLight, contrastDark, studioLight, studioDark, duskLight, duskDark, plainLight, plainDark]);
// ⭐ D133 · Studio is offered to users only when the owner turns it on (Admin → System → Appearance); the admin can
// always choose it, per surface. A user who already chose it keeps it.
export const STUDIO_IDS = Object.freeze([studioLight.id, studioDark.id]);
// ⭐ D144 · Dusk likewise: offered to users only when the owner switches it on (its own switch, Admin → System → Appearance).
export const DUSK_IDS = Object.freeze([duskLight.id, duskDark.id]);
// ⭐ D181 (owner 11-07) · PLAIN: neutral backgrounds, one accent, no tints — offered to everyone (no switch), with "Match my
// device" as the pair "plain".
export const PLAIN_IDS = Object.freeze([plainLight.id, plainDark.id]);
export const THEMES = Object.freeze(Object.fromEntries(THEME_LIST.map((t) => [t.id, t])));
// ⭐ D149 (owner 11-03): DUSK IS THE DEFAULT for every user and every surface — Dusk Dark or Dusk Light following the
// device. A device / account with NO stored choice opens in it; an explicit choice (any theme id or pair, "system"
// included — Paper Light / Charcoal Dark following the device) is kept. D144's "off for users" is superseded.
export const DEFAULT_PREFERENCE = "dusk";
export const DEFAULT_THEME_ID = duskDark.id;

// ── The preference ────────────────────────────────────────────────────────────────────────────────────
// Stored in ONE key (no new storage key for D91): "<pref>" plus optional ";cues" (shape cues on),
// ";no-offer" (the prefers-contrast banner dismissed) and — D93 — ";nav=<id>" / ";sentence=<id>" for a layout
// option away from its default (shared/appearance.js, the same flags the account stores). <pref> is a theme id, or a PAIR that follows the OS:
// "system" (Paper Light / Charcoal Dark), "contrast" (Contrast Light / Contrast Dark); "light" and "dark"
// are the older names for the Paper pair and still resolve.
export const THEME_STORAGE_KEY = "draft-theme";
const PAIRS = Object.freeze({
  system:   { light: paperLight.id,    dark: charcoalDark.id },
  contrast: { light: contrastLight.id, dark: contrastDark.id },
  studio:   { light: studioLight.id,   dark: studioDark.id },
  dusk:     { light: duskLight.id,     dark: duskDark.id },
  plain:    { light: plainLight.id,    dark: plainDark.id },
});
const LEGACY = Object.freeze({ light: paperLight.id, dark: charcoalDark.id });
export const THEME_PREFERENCES = Object.freeze(["system", "light", "dark", "contrast", "studio", "dusk", "plain", ...THEME_LIST.map((t) => t.id)]);

// ⭐ D133 · PER SURFACE. The admin can give the Admin pages their own look ("admin=<pref>" in the same stored value — no
// new storage key, §5); every other page is "the app" and uses the ordinary preference. Resolved once at load, like
// the palette, from the path the page loaded on.
const SURFACE_FLAG = "admin=";
export const surfaceOf = (pathname = typeof location !== "undefined" ? location.pathname : "/") =>
  (/^\/admin(\/|$)/.test(String(pathname)) ? "admin" : "app");

const store = () => (typeof localStorage !== "undefined" ? localStorage : null);
function readRaw(storage = store()) { try { return storage?.getItem(THEME_STORAGE_KEY) || ""; } catch { return ""; } }
function parseRaw(raw) {
  const [pref, ...flags] = String(raw || "").split(";");
  const admin = flags.find((f) => f.startsWith(SURFACE_FLAG))?.slice(SURFACE_FLAG.length) || null;
  return { pref: THEME_PREFERENCES.includes(pref) ? pref : DEFAULT_PREFERENCE, cues: flags.includes("cues"), noOffer: flags.includes("no-offer"),
           layout: parseLayoutFlags(flags), admin: THEME_PREFERENCES.includes(admin) ? admin : null };
}
const formatRaw = ({ pref, cues, noOffer, layout, admin }) =>
  [pref, cues ? "cues" : null, noOffer ? "no-offer" : null, ...formatLayoutFlags(layout), admin ? `${SURFACE_FLAG}${admin}` : null].filter(Boolean).join(";");

export function themePreference(storage = store()) { return parseRaw(readRaw(storage)).pref; }
/** D133: the preference for a SURFACE — the Admin pages' own choice when one is set, else the ordinary preference. */
export function surfacePreference(surface = surfaceOf(), storage = store()) {
  const a = parseRaw(readRaw(storage));
  return surface === "admin" && a.admin ? a.admin : a.pref;
}
/** D133: the Admin pages' own choice (a preference), or null when they follow the app. */
export function adminSurfaceTheme(storage = store()) { return parseRaw(readRaw(storage)).admin; }
/** D133: set (or clear, with null) the Admin pages' own look on this device. Reloads, like every palette change. */
export function setAdminSurfaceTheme(pref, { reload = () => location.reload() } = {}) {
  const cur = parseRaw(readRaw());
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ ...cur, admin: THEME_PREFERENCES.includes(pref) ? pref : null })); } catch {}
  if (typeof location !== "undefined") reload();
}
/** { pref, cues } as stored on this device. */
export function appearance(storage = store()) { const a = parseRaw(readRaw(storage)); return { pref: a.pref, cues: a.cues }; }
/** D93: { nav, sentence } as stored on this device — every option filled, defaults where nothing is stored. */
export function layout(storage = store()) { return parseRaw(readRaw(storage)).layout; }

const osDark = (matchMedia) => {
  try { return !!matchMedia?.call(typeof window !== "undefined" ? window : undefined, "(prefers-color-scheme: dark)")?.matches; }
  catch { return false; }
};
const defaultMM = () => (typeof window !== "undefined" ? window.matchMedia : null);
/** The THEME a preference resolves to. */
export function resolve(pref = surfacePreference(), matchMedia = defaultMM()) {   // D133: the preference for the surface this page is
  if (THEMES[pref]) return THEMES[pref];
  if (LEGACY[pref]) return THEMES[LEGACY[pref]];
  const pair = PAIRS[pref] || PAIRS[DEFAULT_PREFERENCE];
  return THEMES[pair[osDark(matchMedia) ? "dark" : "light"]];
}
/** The SCHEME a preference resolves to — "light" or "dark" (the name older callers know). */
export function resolveTheme(pref = themePreference(), matchMedia = defaultMM()) { return resolve(pref, matchMedia).scheme; }
/** The pair preference a theme belongs to ("follow my system" from a chosen card). */
export function pairPreference(theme) { return STUDIO_IDS.includes(theme.id) ? "studio" : DUSK_IDS.includes(theme.id) ? "dusk" : PLAIN_IDS.includes(theme.id) ? "plain" : theme.contrast === "aaa" ? "contrast" : "system"; }

export function setAppearance({ pref, cues }, { reload = () => location.reload() } = {}) {
  const cur = parseRaw(readRaw());
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ pref, cues: !!cues, noOffer: cur.noOffer, layout: cur.layout, admin: cur.admin })); } catch {}
  if (typeof location !== "undefined") reload();
}
/**
 * D93 · a LAYOUT choice applies LIVE — no reload. Unlike the palette (resolved once, at load), a layout option
 * is only an attribute on <html> that stylesheets key off, so changing it is changing the attribute.
 * `apply: false` stores it without touching <html> — the Customise page saves at once but changes only its
 * preview until you leave (it applies on unmount).
 */
export function setLayout(next, { apply = true, doc = typeof document !== "undefined" ? document : null } = {}) {
  const cur = parseRaw(readRaw());
  const merged = { ...cur.layout, ...next };
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ ...cur, layout: merged })); } catch {}
  if (apply) applyLayout(merged, doc);
  return merged;
}
/** Sets each option's attribute (data-nav, data-sentence) on an element — <html>, or a preview's own box. */
export function applyLayout(values, doc = typeof document !== "undefined" ? document : null, el = doc?.documentElement) {
  if (!el?.setAttribute) return;
  for (const k of LAYOUT_KEYS) el.setAttribute(LAYOUT_OPTION_IDS[k].attribute, values?.[k] || LAYOUT_DEFAULTS[k]);
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
  // D93: the account's layout options come along. They apply live (an attribute), so they never cost a reload.
  const nextLayout = account && typeof account === "object"
    ? { ...cur.layout, ...parseLayoutFlags(LAYOUT_KEYS.filter((k) => account[k] !== undefined).map((k) => `${k}=${account[k]}`)) }
    : cur.layout;
  if (LAYOUT_KEYS.some((k) => nextLayout[k] !== cur.layout[k])) setLayout(nextLayout);
  if (next.pref === cur.pref && next.cues === cur.cues) return false;
  try { store()?.setItem(THEME_STORAGE_KEY, formatRaw({ ...next, noOffer: cur.noOffer, layout: nextLayout, admin: cur.admin })); } catch { return false; }
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
  installShapeVars(ACTIVE_THEME.id, doc.documentElement);   // D144: the corners + type set — only Dusk has one
  applyLayout(layout(), doc);
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
  // D93: each layout option's attribute, its values and its default — set before first paint, so a chosen
  // layout never flashes the default first.
  const L = Object.fromEntries(LAYOUT_KEYS.map((k) => [k, [LAYOUT_OPTION_IDS[k].attribute, LAYOUT_OPTION_IDS[k].values, LAYOUT_OPTION_IDS[k].default]]));
  return `(function(){try{var T=${JSON.stringify(themes)},A=${JSON.stringify(alias)},L=${JSON.stringify(L)},r="";try{r=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||""}catch(e){}` +
    `var f=r.split(";"),p=f[0],P=(typeof location!=="undefined"&&location.pathname)||"";if(P.indexOf("/admin")===0&&(P.length===6||P.charAt(6)==="/")){for(var j=1;j<f.length;j++){if(f[j].indexOf("admin=")===0&&(T[f[j].slice(6)]||A[f[j].slice(6)]))p=f[j].slice(6)}}var id=T[p]?p:null;if(!id){var a=A[p]||A[${JSON.stringify(DEFAULT_PREFERENCE)}];id=typeof a==="string"?a:a[window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?1:0]}` +
    `var t=T[id],d=document.documentElement;d.setAttribute("data-theme",id);d.setAttribute("data-contrast",t[0]);if(f.indexOf("cues")>0)d.setAttribute("data-cues","shape");` +
    `d.style.setProperty("color-scheme",t[1]);d.style.setProperty("--c-canvas",t[2]);` +
    `for(var k in L){var v=L[k][2];for(var i=1;i<f.length;i++){var kv=f[i].split("=");if(kv[0]===k&&L[k][1].indexOf(kv[1])>-1)v=kv[1]}d.setAttribute(L[k][0],v)}}catch(e){}})();`;
}

installColorVars();

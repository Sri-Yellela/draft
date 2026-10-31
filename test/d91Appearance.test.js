// D91 P5 · SETTINGS → APPEARANCE — the four themes and shape cues, saved to the account, honoured on every
// device, with the system's preferences respected and nothing new leaving the page.
//
// docs/THEME_MODULE.md §6 and §9: a theme chosen on one device appears on the next · no flash (the pre-paint
// script reads the same stored value) · prefers-contrast OFFERS, never forces · reduced transparency makes
// the glass opaque · forced-colors gives every control a real border · no new storage key, request or permission.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const REG = await import("../client/src/themes/index.js");
const { THEME_PREFERENCES, THEME_LIST, resolve, appearance, adoptAccountTheme, opaqueTokens, GLASS_KEYS, prePaintScript, pairPreference } = REG;
const { APPEARANCE_THEMES, LEGACY_THEME_PREFERENCES, parseStoredAppearance, formatStoredAppearance } = await import("../shared/appearance.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const mm = (dark) => () => ({ matches: dark });

test("the server and the client know the same preferences — and the legacy route still speaks only light / dark", () => {
  assert.deepEqual([...APPEARANCE_THEMES].sort(), [...THEME_PREFERENCES].sort());
  assert.deepEqual([...LEGACY_THEME_PREFERENCES], ["system", "light", "dark"]);
  // D93 extends the answer ADDITIVELY with the layout options, at their defaults when nothing is stored.
  const D = { nav: "ghost", sentence: "marked", learning: "quiet" };   // D114 P3 adds learning links, quiet by default
  assert.deepEqual(parseStoredAppearance("contrast-dark;cues"), { theme: "contrast-dark", cues: true, ...D });
  assert.deepEqual(parseStoredAppearance("dark"), { theme: "dark", cues: false, ...D });
  assert.deepEqual(parseStoredAppearance("neon"), { theme: null, cues: false, ...D });
  assert.equal(formatStoredAppearance({ theme: "contrast", cues: true }), "contrast;cues");
  assert.equal(formatStoredAppearance({ theme: "neon", cues: true }), null);
  const route = read("routes/account.js");
  assert.match(route, /router\.get\("\/api\/settings\/appearance", requireAuth/);
  assert.match(route, /router\.put\("\/api\/settings\/appearance", requireAuth/);
  assert.match(route, /res\.json\(\{ preference: THEME_PREFERENCES\.has\(theme\) \? theme : null \}\)/,
    "the pre-D91 route hands an old client a contrast theme it does not know");
});

test("every preference resolves: the Paper pair and the Contrast pair follow the OS; a theme id is that theme", () => {
  assert.equal(resolve("system", mm(false)).id, "paper-light");
  assert.equal(resolve("system", mm(true)).id, "charcoal-dark");
  assert.equal(resolve("contrast", mm(false)).id, "contrast-light");
  assert.equal(resolve("contrast", mm(true)).id, "contrast-dark");
  assert.equal(resolve("light", mm(true)).id, "paper-light");
  assert.equal(resolve("dark", mm(false)).id, "charcoal-dark");
  for (const t of THEME_LIST) assert.equal(resolve(t.id, mm(true)).id, t.id);
  assert.equal(pairPreference(THEME_LIST.find(t => t.id === "contrast-dark")), "contrast");
  assert.equal(pairPreference(THEME_LIST.find(t => t.id === "paper-light")), "system");
});

test("⭐ a theme chosen on one device appears on the next — the account's appearance is adopted, reloading only on change", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    let reloads = 0;
    assert.equal(adoptAccountTheme({ theme: "contrast-dark", cues: true }, { reload: () => reloads++ }), true);
    assert.equal(store.get("draft-theme"), "contrast-dark;cues");
    assert.deepEqual(appearance(), { pref: "contrast-dark", cues: true });
    assert.equal(reloads, 1);
    // Agreeing values cost nothing — no loop after the reload.
    assert.equal(adoptAccountTheme({ theme: "contrast-dark", cues: true }, { reload: () => reloads++ }), false);
    assert.equal(reloads, 1);
    // Junk from the server is ignored.
    assert.equal(adoptAccountTheme({ theme: "neon" }, { reload: () => reloads++ }), false);
    // The client asks for the appearance, not the old theme-only route.
    assert.match(read("client/src/App.jsx"), /api\("\/api\/settings\/appearance"\)\.then\(r => \{ if \(r\?\.theme\) adoptAccountTheme\(r\); \}\)/);
  } finally { delete globalThis.localStorage; }
});

test("⛔ no flash: the pre-paint script reads the same stored value — theme, pair and cues", () => {
  const src = prePaintScript();
  const run = (raw, dark) => {
    const attrs = {}, style = {};
    new Function("localStorage", "window", "document", src)({ getItem: () => raw }, { matchMedia: mm(dark) },
      { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty: (k, v) => { style[k] = v; } } } });
    return { attrs, style };
  };
  for (const raw of ["contrast-light", "contrast-dark;cues", "contrast", "system;cues;no-offer", "light", ""]) for (const dark of [false, true]) {
    const { attrs, style } = run(raw, dark);
    const want = resolve(raw.split(";")[0] || "system", mm(dark));
    assert.equal(attrs["data-theme"], want.id, `${raw} / dark ${dark}`);
    assert.equal(attrs["data-contrast"], want.contrast);
    assert.equal(style["--c-canvas"], want.tokens.CANVAS);
    assert.equal(attrs["data-cues"], raw.includes(";cues") ? "shape" : undefined, `${raw}: cues`);
  }
});

test("Appearance: four preview cards, follow-the-system, the shape-cues switch — saved to the account (on Customise since D93)", () => {
  const ui = read("client/src/components/AppearanceSettings.jsx");
  assert.match(ui, /THEME_LIST\.map\(\(t\) =>/, "the cards come from the registry, not a list of their own");
  assert.match(ui, /<RadioCards label="Theme"/);
  assert.match(read("client/src/components/RadioCards.jsx"), /role="radiogroup" aria-label=\{label\}/);
  assert.match(ui, /role="switch"/);
  assert.match(ui, /api\("\/api\/settings\/appearance", \{ method: "PUT"/);
  assert.doesNotMatch(ui, /<select/, "no dropdown (THEME_MODULE §6)");
  // ⭐ D93: Appearance lives on the Customise page, and NOTHING of it is left on Account.
  const page = read("client/src/panels/CustomisePanel.jsx");
  assert.match(page, /<ThemeSection \/>/);
  assert.match(page, /<AccessibilitySection \/>/);
  assert.doesNotMatch(read("client/src/panels/AccountPanel.jsx"), /AppearanceSettings|ThemeSection|AccessibilitySection|id="appearance"/);
  // The avatar menu keeps a QUICK system / light / dark switch (D93's recommendation) and links to Customise.
  const top = read("client/src/components/TopBar.jsx");
  assert.match(top, /data-quick-scheme=""/);
  assert.match(top, /onTabChange\?\.\("customise"\)/);
});

test("prefers-contrast: more OFFERS the Contrast pair in one line — never switches by itself", () => {
  const reg = read("client/src/themes/index.js");
  assert.match(reg, /export const CONTRAST_OFFER = query\("\(prefers-contrast: more\)"\) && ACTIVE_THEME\.contrast !== "aaa" && !parseRaw\(readRaw\(\)\)\.noOffer;/);
  const ui = read("client/src/components/AppearanceSettings.jsx");
  assert.match(ui, /export function ContrastOffer\(\)/);
  assert.match(ui, /if \(!CONTRAST_OFFER \|\| gone\) return null;/);
  assert.match(read("client/src/App.jsx"), /<ContrastOffer \/>/);
  // Resolution never looks at prefers-contrast: the offer is the ONLY thing it drives.
  assert.doesNotMatch(reg.slice(at(reg, "export function resolve("), at(reg, "export function resolveTheme(")), /prefers-contrast/);
});

test("⛔ reduced transparency makes the glass OPAQUE — every glass token composited once over the canvas", () => {
  // Named here, not read from GLASS_KEYS — a key dropped from the module's list must still fail.
  const GLASS = ["SURFACE", "SURFACE_2", "SURFACE_MENU", "SURFACE_MODAL", "GLASS_BODY_TOP", "GLASS_BODY", "GLASS_SHEEN"];
  for (const k of GLASS) assert.ok(GLASS_KEYS.includes(k), `${k} is not composited under reduced transparency`);
  for (const t of THEME_LIST) {
    const o = opaqueTokens(t.tokens);
    for (const k of GLASS) assert.match(o[k], /^#[0-9A-F]{6}$/, `${t.id}.${k} is still translucent: ${o[k]}`);
    assert.equal(o.INK, t.tokens.INK, "only the glass changes");
  }
  const css = read("client/src/styles/cues.css");
  assert.match(css, /html\[data-transparency="reduced"\] \*, html\[data-transparency="reduced"\] \*::before, html\[data-transparency="reduced"\] \*::after \{ backdrop-filter: none !important; -webkit-backdrop-filter: none !important; \}/);
});

test("⛔ forced-colors: every control, mark and depth box keeps a REAL border (the mode drops box-shadows)", () => {
  const css = read("client/src/styles/cues.css");
  const block = css.slice(at(css, "@media (forced-colors: active)"));
  for (const sel of ["button", "input", "select", "textarea", ".dbx", ".mark", "[role=\"button\"]", "[data-settings-section]"]) {
    assert.ok(block.includes(sel), `forced-colors does not border ${sel}`);
  }
  assert.match(block, /border: 1px solid (ButtonText|CanvasText)/);
  assert.match(read("client/src/main.jsx"), /import "\.\/styles\/cues\.css";/);
});

test("⛔ nothing new leaves the page: one storage key, no new permission, the extension untouched", () => {
  const reg = read("client/src/themes/index.js");
  assert.deepEqual([...reg.matchAll(/(?:get|set)Item\((\w+)/g)].map(m => m[1]).filter(k => k !== "THEME_STORAGE_KEY"), [],
    "the registry reads or writes a key other than draft-theme");
  const ext = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
  assert.doesNotMatch(JSON.stringify(ext.permissions || []), /theme|appearance/i);
  // The only request D91 adds is the account's own settings route.
  const ui = read("client/src/components/AppearanceSettings.jsx");
  assert.deepEqual([...ui.matchAll(/api\("([^"]+)"/g)].map(m => m[1]), ["/api/settings/appearance"]);
});

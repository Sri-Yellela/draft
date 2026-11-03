// D93 · CUSTOMISE — its own page, its own menu link, and D92's layout choices as options (owner, 10-11).
//
// The contract: the layout-options registry is complete (ids = shared/'s, exactly one default, every value has
// styles under its attribute) · the server refuses a value the registry does not list · a choice round-trips and
// follows the account to a second device · a new account reads the defaults · an older client's PUT keeps the
// layout · no flash (the pre-paint script sets the attributes) · the preview never changes the page · Reset
// restores the defaults · Account no longer renders Appearance; the menu has Customise and it routes · the old
// designs are gone · the radio groups are keyboard-operable · no new request beyond the one settings call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { createAccountRouter } from "../routes/account.js";

const { LAYOUT_OPTION_IDS, LAYOUT_KEYS, LAYOUT_DEFAULTS, parseStoredAppearance, formatStoredAppearance } = await import("../shared/appearance.js");
const { LAYOUT_OPTIONS, layoutDefaults } = await import("../client/src/themes/layoutOptions.js");
const REG = await import("../client/src/themes/index.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const cssFiles = (() => { const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".css")) out.push(p); } }; walk("client/src"); return out; })();
const allCss = cssFiles.map(read).join("\n");

test("D93 · the registry is complete: the ids are shared/'s, exactly one default each (shared/'s), every value styled", () => {
  assert.deepEqual(LAYOUT_OPTIONS.map((o) => o.id), LAYOUT_KEYS);
  for (const o of LAYOUT_OPTIONS) {
    const ids = LAYOUT_OPTION_IDS[o.id];
    assert.equal(o.attribute, ids.attribute);
    assert.deepEqual(o.values.map((v) => v.id), [...ids.values], `${o.id}: the client lists what the server accepts`);
    const defs = o.values.filter((v) => v.default);
    assert.equal(defs.length, 1, `${o.id} has exactly one default`);
    assert.equal(defs[0].id, ids.default, `${o.id}: the default is the recommendation`);
    assert.ok(o.label && o.description, `${o.id} carries its words`);
    for (const v of o.values) {
      assert.ok(v.label && v.description, `${o.id}=${v.id} carries its words`);
      assert.ok(allCss.includes(`[${o.attribute}="${v.id}"]`), `${o.id}=${v.id} has no styles under [${o.attribute}="${v.id}"]`);
    }
  }
  assert.deepEqual(layoutDefaults(), LAYOUT_DEFAULTS);
  assert.deepEqual(LAYOUT_DEFAULTS, { sentence: "marked", learning: "quiet", navigation: "auto", text: "default" }, "the recommendations are the defaults (D92)");
});

test("D93 · the stored value: flags only off the default, every pre-D93 value reads as the defaults, junk refused", () => {
  assert.equal(formatStoredAppearance({ theme: "system", cues: false, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" }), "system");
  assert.equal(formatStoredAppearance({ theme: "contrast-dark", cues: true, sentence: "calm", learning: "quiet", navigation: "menu", text: "default" }), "contrast-dark;cues;sentence=calm;navigation=menu");
  assert.deepEqual(parseStoredAppearance("contrast-dark;cues;sentence=calm;navigation=menu"), { theme: "contrast-dark", cues: true, sentence: "calm", learning: "quiet", navigation: "menu", text: "default" });
  assert.deepEqual(parseStoredAppearance("light;cues"), { theme: "light", cues: true, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" });
  assert.deepEqual(parseStoredAppearance(null), { theme: null, cues: false, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" });
  assert.deepEqual(parseStoredAppearance("dark;nav=boxed;sentence=boxes"), { theme: "dark", cues: false, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" }, "an unknown stored value reads as the default");
  assert.equal(formatStoredAppearance({ theme: "dark", navigation: "boxed" }), null, "an unknown value is never stored");
  // ⭐ D145: `nav` (the tab row's ghost / track) is RETIRED with the row — a stored flag reads as nothing, never an error.
  assert.deepEqual(parseStoredAppearance("dark;nav=track"), parseStoredAppearance("dark"));
  // ⭐ D114 P3: the third option, learning links — stored only when shown, read back.
  assert.equal(formatStoredAppearance({ theme: "system", learning: "shown" }), "system;learning=shown");
  assert.equal(parseStoredAppearance("system;learning=shown").learning, "shown");
});

async function server() {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, theme_preference TEXT)");
  db.prepare("INSERT INTO users (id, username) VALUES (1, 'ada'), (2, 'grace')").run();
  const app = express();
  app.use(express.json());
  const requireAuth = (req, res, next) => { req.user = { id: Number(req.get("x-user") || 1) }; next(); };
  app.use(createAccountRouter({ db, requireAuth, emitToUser() {}, syncClients: new Map(), INTEGRATION_PROVIDERS: [], INDUSTRY_CATEGORIES: [] }));
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, body, user = 1) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { db, call, close: () => new Promise((r) => srv.close(r)) };
}

test("D93 · the server: refuses an unknown value · round-trips · a second device reads it · a new account gets the defaults · merges", async () => {
  const s = await server();
  try {
    // A new account: the defaults.
    assert.deepEqual((await s.call("GET", "/api/settings/appearance", null, 2)).json, { theme: null, cues: false, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" });
    // Unknown values are refused, and nothing is stored.
    assert.equal((await s.call("PUT", "/api/settings/appearance", { theme: "system", navigation: "boxed" })).status, 400);
    assert.equal((await s.call("PUT", "/api/settings/appearance", { theme: "system", sentence: "boxes" })).status, 400);
    assert.equal(s.db.prepare("SELECT theme_preference FROM users WHERE id=1").get().theme_preference, null);
    // Set → read back (a second device is just another GET for the same account).
    const put = await s.call("PUT", "/api/settings/appearance", { theme: "contrast-dark", cues: true, sentence: "calm", learning: "quiet", navigation: "menu", text: "default" });
    assert.equal(put.status, 200);
    assert.deepEqual((await s.call("GET", "/api/settings/appearance")).json, { theme: "contrast-dark", cues: true, sentence: "calm", learning: "quiet", navigation: "menu", text: "default" });
    // A layout-only PUT (the Customise page) keeps the theme and cues.
    await s.call("PUT", "/api/settings/appearance", { sentence: "marked", learning: "quiet" });
    assert.deepEqual((await s.call("GET", "/api/settings/appearance")).json, { theme: "contrast-dark", cues: true, sentence: "marked", learning: "quiet", navigation: "menu", text: "default" });
    // An older client's PUT ({ theme, cues } only) keeps the layout.
    await s.call("PUT", "/api/settings/appearance", { theme: "paper-light", cues: false });
    assert.deepEqual((await s.call("GET", "/api/settings/appearance")).json, { theme: "paper-light", cues: false, sentence: "marked", learning: "quiet", navigation: "menu", text: "default" });
    // …and so does the pre-D91 theme route.
    assert.equal((await s.call("PUT", "/api/settings/theme", { preference: "dark" })).status, 200);
    assert.deepEqual((await s.call("GET", "/api/settings/appearance")).json, { theme: "dark", cues: false, sentence: "marked", learning: "quiet", navigation: "menu", text: "default" });
    assert.deepEqual((await s.call("GET", "/api/settings/theme")).json, { preference: "dark" });
    // The other account is untouched.
    assert.equal(s.db.prepare("SELECT theme_preference FROM users WHERE id=2").get().theme_preference, null);
  } finally { await s.close(); }
});

test("D93 · the device: a layout applies LIVE (no reload); the account's layout is adopted without a reload", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const attrs = {}; const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } };
    store.set("draft-theme", "contrast-dark;cues;no-offer");
    REG.setLayout({ navigation: "menu" }, { doc });
    assert.equal(store.get("draft-theme"), "contrast-dark;cues;no-offer;navigation=menu", "the other flags survive");
    assert.deepEqual(attrs, { "data-sentence": "marked", "data-learning-links": "quiet", "data-navigation": "menu", "data-text-size": "default" });   // D145: navigation + text size; nav retired
    // apply:false (the Customise page) stores but leaves <html> alone.
    const before = { ...attrs };
    REG.setLayout({ sentence: "calm" }, { apply: false, doc });
    assert.deepEqual(attrs, before, "the page changed while the preview was being chosen");
    assert.deepEqual(REG.layout(), { sentence: "calm", learning: "quiet", navigation: "menu", text: "default" });
    // A theme change keeps the layout.
    REG.setAppearance({ pref: "paper-light", cues: false }, { reload() {} });
    assert.deepEqual(REG.layout(), { sentence: "calm", learning: "quiet", navigation: "menu", text: "default" });
    // The account's appearance, differing only in layout: adopted, NO reload.
    let reloads = 0;
    assert.equal(REG.adoptAccountTheme({ theme: "paper-light", cues: false, sentence: "marked", learning: "quiet", navigation: "auto", text: "default" }, { reload: () => reloads++ }), false);
    assert.equal(reloads, 0);
    assert.deepEqual(REG.layout(), { sentence: "marked", learning: "quiet", navigation: "auto", text: "default" });
  } finally { delete globalThis.localStorage; }
});

test("D93 · ⛔ no flash: the pre-paint script sets data-navigation and data-sentence from the stored value (defaults otherwise)", () => {
  const src = REG.prePaintScript();
  const run = (raw) => {
    const attrs = {};
    new Function("localStorage", "window", "document", src)({ getItem: () => raw }, { matchMedia: () => ({ matches: false }) },
      { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty() {} } } });
    return attrs;
  };
  assert.equal(run("")["data-navigation"], "auto");
  assert.equal(run("")["data-text-size"], "default");
  assert.equal(run("")["data-sentence"], "marked");
  const a = run("contrast-dark;cues;sentence=calm;navigation=menu;text=largest");
  assert.equal(a["data-navigation"], "menu"); assert.equal(a["data-text-size"], "largest"); assert.equal(a["data-sentence"], "calm"); assert.equal(a["data-cues"], "shape");
  assert.equal(run("system;navigation=boxed")["data-navigation"], "auto", "an unknown value falls back to the default");
  // …and the bundle sets the same attributes when it loads.
  assert.match(read("client/src/themes/index.js"), /applyLayout\(layout\(\), doc\);/);
});

test("D93 · the page: drawn from the registry; the preview carries its own attributes; Reset restores the defaults", () => {
  const page = read("client/src/panels/CustomisePanel.jsx");
  assert.match(page, /LAYOUT_OPTIONS\.map\(\(o\) =>/, "the page draws its layout cards from the registry");
  assert.doesNotMatch(page, /"ghost"|"track"|"marked"|"calm"/, "the page names an option value — adding one would need a page change");
  assert.match(page, /setLayout\(\{ \[key\]: value \}, \{ apply: false \}\)/, "a choice changes only the preview until you leave");
  assert.match(page, /useEffect\(\(\) => \(\) => applyLayout\(layout\(\)\), \[\]\)/, "leaving applies the choice");
  assert.match(page, /setLayout\(layoutDefaults\(\), \{ apply: false \}\);\s*saveAppearance\(\{ pref: "system", cues: false, layout: layoutDefaults\(\) \}\)/, "Reset");
  const pv = read("client/src/components/CustomisePreview.jsx");
  assert.match(pv, /\[o\.attribute, values\?\.\[k\] \|\| o\.default\]/, "the preview sets its own data-nav / data-sentence");
  assert.match(pv, /aria-hidden="true"/); assert.match(pv, /setAttribute\("inert", ""\)/);
  // The styles read the attribute through CUSTOM PROPERTIES — so the nearest carrier (the preview) wins.
  for (const [file, attr] of [["client/src/components/AppNav.css", "data-navigation"], ["client/src/components/FullHouse.css", "data-sentence"]]) {
    const css = read(file);
    assert.doesNotMatch(css, new RegExp(`\\[${attr}="[a-z]+"\\]\\s+[.#\\w]`), `${file}: a descendant selector off [${attr}] — it would match <html>'s value inside the preview`);
  }
  // Mobile: the preview stacks above the options and collapses.
  assert.match(page, /aria-expanded=\{previewOpen\}/);
  assert.match(read("client/src/components/Customise.css"), /@media \(max-width: 980px\) \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
});

test("D93 · Account no longer renders Appearance; the menu has Customise, and it routes", () => {
  assert.doesNotMatch(read("client/src/panels/AccountPanel.jsx"), /<AppearanceSettings|<ThemeSection|<AccessibilitySection|id="appearance"|import .*AppearanceSettings/);
  const app = read("client/src/App.jsx");
  assert.match(app, /"customise",\n\s*\.\.\.ROUTE_ONLY_TABS\]/, "/app/customise is navigable");
  assert.match(app, /activeTab === "customise"\s+&& <CustomisePanel\/>/);
  const top = read("client/src/components/TopBar.jsx");
  assert.match(top, /onTabChange\?\.\("customise"\); \}\} data-customise-link=""/);
  assert.match(top, />\s*Customise\s*</);
  // The quick switch stays: three choices, inside the family of the theme in use.
  assert.match(top, /const SCHEMES = \[\["system", "System"\], \["light", "Light"\], \["dark", "Dark"\]\];/);
  assert.match(top, /contrast \? \(s === "dark" \? "contrast-dark" : "contrast-light"\) : \(s === "dark" \? "charcoal-dark" : "paper-light"\)/);
});

test("D93 · ⛔ the old designs are gone and not offered — no boxed tab, no boxed sentence word", () => {
  // ⭐ D145: the tab row is gone altogether (the Dock / the Menu replaced it) — no tab rule is left to regrow a box.
  const top = read("client/src/components/TopBar.css");
  assert.doesNotMatch(top, /\.tbar-tab|\.tbar-nav|\[data-nav=/, "the retired tab row's styles came back");
  assert.doesNotMatch(read("client/src/components/TopBar.jsx"), /var\(--c-fh-well\)|var\(--c-depth-rest\)/);
  const fh = read("client/src/components/FullHouse.css");
  const tok = fh.slice(at(fh, ".bh .tok {"), at(fh, "}", at(fh, ".bh .tok {")));
  assert.doesNotMatch(tok, /height:|--fh-token-box|inline-flex/, "the sentence word is a box taller than its line again");
  for (const k of LAYOUT_KEYS) for (const old of ["boxed", "boxes", "classic"]) assert.ok(!LAYOUT_OPTION_IDS[k].values.includes(old));
});

test("D93 · radio groups are keyboard-operable: one tab stop, arrows move and select, Space / Enter select, a focus ring", () => {
  const rc = read("client/src/components/RadioCards.jsx");
  assert.match(rc, /role="radiogroup" aria-label=\{label\}/);
  assert.match(rc, /role="radio" aria-checked=\{on\} tabIndex=\{i === at \? 0 : -1\}/);
  assert.match(rc, /ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1/);
  assert.match(rc, /e\.key === "Home"/); assert.match(rc, /e\.key === "End"/);
  assert.match(rc, /e\.key === " " \|\| e\.key === "Enter"/);
  assert.match(read("client/src/components/Customise.css"), /\.cz-opt:focus-visible \{ outline: 2px solid var\(--c-accent-ink\);/);
  for (const f of ["client/src/components/AppearanceSettings.jsx", "client/src/panels/CustomisePanel.jsx"]) assert.match(read(f), /<RadioCards /);
});

test("D93 · nothing new leaves the page: the one settings route, no new storage key", () => {
  for (const f of ["client/src/panels/CustomisePanel.jsx", "client/src/components/AppearanceSettings.jsx", "client/src/components/CustomisePreview.jsx", "client/src/components/RadioCards.jsx"]) {
    const src = read(f);
    // (the deck mirror writes the deck's EXISTING route — Reset awaits it; no new endpoint)
    assert.deepEqual([...new Set([...src.matchAll(/api\("([^"]+)"/g)].map((m) => m[1]))].filter((u) => u !== "/api/settings/appearance" && u !== "/api/settings/deck-geometry"), [], `${f} calls another route`);
    assert.doesNotMatch(src, /localStorage|sessionStorage/, `${f} keeps its own storage`);
  }
});

test("D93 · the deck's layout and order are mirrored on Customise — through the SAME stores as the deck's own controls", async () => {
  const page = read("client/src/panels/CustomisePanel.jsx");
  // The layout: the deck's own hook (with the account), the shared preset names and words.
  assert.match(page, /const \[geometry, chooseGeometry\] = useDeckGeometry\(\);/);
  assert.match(page, /DECK_PRESET_NAMES\.map\(\(id\) => \(\{ id, label: DECK_PRESET_COPY\[id\]\[0\], description: DECK_PRESET_COPY\[id\]\[1\]/);
  assert.match(read("client/src/components/DeckGeometryControl.jsx"), /const PRESET_COPY = DECK_PRESET_COPY;/, "the deck's control says the same words");
  // The order: one key, one read / write, used by both.
  const lib = await import("../client/src/lib/deckOrder.js");
  assert.equal(lib.DECK_ORDER_KEY, "draft-deck-order", "the key the deck has always used — a chosen order survives");
  assert.deepEqual(lib.DECK_ORDERS.map((o) => o.id), ["dealt", "ats"]);
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /import \{ readDeckOrder, writeDeckOrder \} from "\.\.\/lib\/deckOrder\.js";/);
  assert.doesNotMatch(deck, /"draft-deck-order"/, "the deck keeps its own copy of the key");
  assert.match(page, /DECK_ORDERS\.map/); assert.match(page, /writeDeckOrder\(next\)/);
  // A custom layout (the deck's sliders) is named, not silently shown as a preset.
  assert.match(page, /data-deck-custom=""/);
  // The deck keeps its quick controls; Reset restores the deck too, its layout awaited before the reload.
  assert.match(deck, /<DeckGeometryControl /); assert.match(deck, /<DeckOrderControl /);
  assert.match(page, /chooseOrder\("dealt"\); chooseLayout\("standard"\);[^\n]*\n\s*await api\("\/api\/settings\/deck-geometry", \{ method: "PUT"/);
  // A round trip of the order through the shared helpers.
  const store = new Map(); globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try { assert.equal(lib.readDeckOrder(), "dealt"); lib.writeDeckOrder("ats"); assert.equal(store.get("draft-deck-order"), "ats"); assert.equal(lib.readDeckOrder(), "ats"); }
  finally { delete globalThis.localStorage; }
});

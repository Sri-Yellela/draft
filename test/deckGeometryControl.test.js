// Queue 38 — the deck's geometry as a user control: presets (tight / standard / wide) with zoom,
// spread and reach behind "Customise"; ⛔ the ranges CLAMPED so no value breaks the layout;
// ⛔ persisted per user; ⛔ prefers-reduced-motion overrides whatever was picked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createAccountRouter } from "../routes/account.js";

const { FAN, FIT, clampGeometry, fanFit, geometryFor, reachBounds, spreadBounds } = await import("../client/src/lib/fanGeometry.js");
const { DECK_LIMITS, DECK_PRESETS, DECK_PRESET_NAMES, clampAxis, normaliseDeckPreference } = await import("../shared/deckGeometry.js");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const O = ["horizontal", "vertical"];
const AXES = ["zoom", "spread", "reach"];
const steps = (o, a) => { const [min, max, step] = DECK_LIMITS[o][a]; const v = []; for (let x = min; x <= max + 1e-9; x += step) v.push(Math.round(x * 1000) / 1000); return v; };
const inLimits = (o, g) => AXES.every(a => g[a] >= DECK_LIMITS[o][a][0] - 1e-9 && g[a] <= DECK_LIMITS[o][a][1] + 1e-9);

// ── the presets ───────────────────────────────────────────────────────────────────────────────
test("three presets — tight, standard, wide — and standard IS the fan queue 27 settled", () => {
  assert.deepEqual([...DECK_PRESET_NAMES], ["tight", "standard", "wide"]);
  for (const o of O) {
    assert.equal(geometryFor(o, null), FAN[o], "no preference is the standard fan");
    assert.equal(geometryFor(o, { preset: "standard", custom: {} }), FAN[o]);
    for (const p of DECK_PRESET_NAMES) {
      const g = geometryFor(o, { preset: p, custom: {} });
      assert.ok(inLimits(o, g), `${o} ${p} is outside its own sliders`);
      assert.ok(fanFit(o, g).ok, `${o} ${p} does not fit the layout: ${JSON.stringify(fanFit(o, g))}`);
    }
  }
});

test("⭐ tight is the calm one — the least sweep — and wide the most", () => {
  for (const o of O) {
    const t = geometryFor(o, { preset: "tight" }), s = geometryFor(o, { preset: "standard" }), w = geometryFor(o, { preset: "wide" });
    assert.ok(t.spread < s.spread && s.spread < w.spread, `${o}: a step turns each card ${t.spread}° / ${s.spread}° / ${w.spread}°`);
    assert.ok(t.reach > s.reach && s.reach > w.reach, `${o}: tight is the flattest arc`);
  }
});

// ── ⛔ the clamp ───────────────────────────────────────────────────────────────────────────────
test("⛔ the sliders are COUPLED: in-range values alone can still break the layout — which is why the clamp fits the combination", () => {
  // The smallest sweep at the smallest size: every value inside its slider, and the next card is
  // entirely behind the front one — you would rotate blind.
  const blind = { zoom: 0.64, spread: 3, reach: 600 };
  assert.ok(inLimits("horizontal", blind));
  assert.equal(fanFit("horizontal", blind).ok, false);
  assert.ok(fanFit("horizontal", blind).peek < 0, "the first back does not show at all");
  // The most sweep at full size on the longest arc: the stack runs out of the frame.
  const out = { zoom: 0.8, spread: 10, reach: 1400 };
  assert.ok(inLimits("horizontal", out));
  assert.ok(fanFit("horizontal", out).bottom > FIT.horizontal.frameBottom);
  assert.ok(fanFit("horizontal", clampGeometry("horizontal", blind)).ok && fanFit("horizontal", clampGeometry("horizontal", out)).ok);
});

test("⛔ EVERY combination the sliders can be set to — and every junk value — clamps to a geometry that fits", () => {
  const junk = [NaN, Infinity, -Infinity, -1, 0, 1e9, "", "x", null, undefined, "0.7", {}, []];
  for (const o of O) {
    let n = 0;
    for (const zoom of steps(o, "zoom")) for (const spread of steps(o, "spread")) for (const reach of steps(o, "reach")) {
      const g = clampGeometry(o, { zoom, spread, reach });
      assert.ok(inLimits(o, g) && fanFit(o, g).ok, `${o} ${zoom}/${spread}/${reach} → ${JSON.stringify(g)}`);
      if (fanFit(o, { zoom, spread, reach }).ok) assert.deepEqual([g.zoom, g.spread, g.reach], [zoom, spread, reach], "a geometry that fits is left alone");
      assert.deepEqual(clampGeometry(o, g), g, "idempotent");
      n++;
    }
    assert.ok(n > 1000, `${o}: only ${n} combinations checked`);
    for (const a of junk) for (const b of junk) {
      const g = clampGeometry(o, { zoom: a, spread: b, reach: a });
      assert.ok(inLimits(o, g) && fanFit(o, g).ok, `${o} junk ${String(a)}/${String(b)} → ${JSON.stringify(g)}`);
    }
  }
});

test("the slider ends ARE the fitted interval: every zoom has spreads, every spread in it has reaches, with no holes", () => {
  for (const o of O) for (const zoom of steps(o, "zoom")) {
    const sb = spreadBounds(o, zoom);
    assert.ok(sb, `${o}: zoom ${zoom} has no spread that fits`);
    for (const spread of steps(o, "spread").filter(s => s >= sb[0] && s <= sb[1])) {
      const rb = reachBounds(o, zoom, spread);
      assert.ok(rb, `${o}: ${zoom}/${spread} is inside the spread slider but no reach fits — a hole`);
      for (const reach of steps(o, "reach").filter(r => r >= rb[0] && r <= rb[1])) assert.ok(fanFit(o, { zoom, spread, reach }).ok, "a hole inside the reach interval");
    }
  }
});

test("each slider's own range and step", () => {
  assert.equal(clampAxis("horizontal", "reach", 99999), DECK_LIMITS.horizontal.reach[1]);
  assert.equal(clampAxis("vertical", "zoom", 0), DECK_LIMITS.vertical.zoom[0]);
  assert.equal(clampAxis("horizontal", "spread", 6.3), 6.5, "snapped to the step");
  assert.equal(clampAxis("horizontal", "zoom", "abc"), null, "a non-number is null, never quietly a default");
  // The standard fan sits inside both orientations' sliders.
  for (const o of O) assert.ok(inLimits(o, FAN[o]));
});

// ── ⛔ reduced motion ──────────────────────────────────────────────────────────────────────────
test("⛔ prefers-reduced-motion OVERRIDES whatever the user picked: the deck is Tight", () => {
  for (const o of O) {
    const tight = { ...FAN[o], ...DECK_PRESETS[o].tight };
    for (const pref of [null, { preset: "standard" }, { preset: "wide" }, { preset: "tight" },
                        { preset: "custom", custom: { [o]: { zoom: DECK_LIMITS[o].zoom[1], spread: 10, reach: DECK_LIMITS[o].reach[0] } } }]) {
      assert.deepEqual({ ...geometryFor(o, pref, { reduced: true }) }, tight, `${o} ${JSON.stringify(pref)}`);
    }
  }
  const view = codeOnly(read("client/src/panels/DeckView.jsx"));
  assert.match(view, /geometryFor\(orientation, deckPref, \{ reduced: !!reduced \}\)/, "the view passes the media query in");
  assert.doesNotMatch(view, /FAN\[orientation\]/, "a road from the fan's constants to the screen that skips the preference and reduced motion");
});

// ── the stored shape ──────────────────────────────────────────────────────────────────────────
test("the stored preference: a known preset, custom values clamped per axis, junk refused", () => {
  for (const bad of [null, undefined, 1, "wide", [], {}, { preset: "huge" }, { preset: "" }]) assert.equal(normaliseDeckPreference(bad), null, JSON.stringify(bad));
  assert.deepEqual(normaliseDeckPreference({ preset: "wide" }), { preset: "wide", custom: {} });
  const p = normaliseDeckPreference({ preset: "custom", custom: {
    horizontal: { zoom: 5, spread: -3, reach: "900" },
    vertical: { zoom: 0.9, spread: 5 },                       // incomplete: dropped, not half-kept
    diagonal: { zoom: 1, spread: 1, reach: 1 },               // not an orientation
  } });
  assert.deepEqual(p, { preset: "custom", custom: { horizontal: { zoom: 0.8, spread: 3, reach: 900 } } });
});

// ── ⛔ persisted per user ──────────────────────────────────────────────────────────────────────
test("⛔ migration 114 adds the column, additively, byte-identical in both migration paths", () => {
  const block = (src) => { const i = src.indexOf('id: "114_users_deck_geometry"'); assert.ok(i > 0, "migration 114 must exist"); return src.slice(i, at(src, "\n    },", i)); };
  const a = block(read("server.js")), b = block(read("scripts/migrations.js"));
  assert.equal(a, b, "the migration must be byte-identical in server.js and scripts/migrations.js");
  assert.match(a, /ALTER TABLE users ADD COLUMN deck_geometry TEXT;/);
  assert.doesNotMatch(a, /DROP|RENAME/i);
});

function accountApp(userId = 1) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) for (const stmt of m.sql.split(";").map(s => s.trim()).filter(Boolean)) db.exec(stmt);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'ada','x'), (2,'bo','y')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.get("x-user") || userId) }; next(); });
  const noop = () => ({});
  app.use(createAccountRouter({ db, requireAuth: (q, r, n) => n(), emitToUser: noop, syncClients: new Map(), buildAutofillPayload: noop,
    requireModeEntitlement: () => true, normalisePlanTier: (t) => t, allowedModesForTier: () => [], canUseGenerate: () => true,
    canUseAPlusResume: () => true, nextPlan: () => null, getAutomationReadiness: noop, oauthReadiness: noop, probeBrowserAvailability: async () => ({}),
    encryptSecret: () => ({}), INTEGRATION_PROVIDERS: [], publicIntegrationRow: noop, providerColumnFor: () => null, INDUSTRY_CATEGORIES: [] }));
  const server = app.listen(0);
  return { db, server, url: `http://127.0.0.1:${server.address().port}/api/settings/deck-geometry` };
}
const put = (url, preference, user = 1) => fetch(url, { method: "PUT", headers: { "content-type": "application/json", "x-user": String(user) }, body: JSON.stringify({ preference }) });
const get = (url, user = 1) => fetch(url, { headers: { "x-user": String(user) } }).then(r => r.json());

test("⛔ the account keeps it: PUT stores the normalised preference, GET returns it — per USER", async () => {
  const { db, server, url } = accountApp();
  try {
    assert.deepEqual(await get(url), { preference: null }, "never set");
    let r = await put(url, { preset: "custom", custom: { vertical: { zoom: 2, spread: 4, reach: 1600 } } });
    assert.equal(r.status, 200);
    assert.deepEqual((await get(url)).preference, { preset: "custom", custom: { vertical: { zoom: 0.92, spread: 4, reach: 1600 } } });
    assert.deepEqual(await get(url, 2), { preference: null }, "one user's layout is not another's");
    r = await put(url, { preset: "tight" }, 2);
    assert.equal((await get(url, 2)).preference.preset, "tight");
    assert.equal((await get(url)).preference.preset, "custom");
  } finally { server.close(); db.close(); }
});

test("⛔ a malformed preference is REFUSED and nothing is stored; a corrupt stored value reads as none", async () => {
  const { db, server, url } = accountApp();
  try {
    await put(url, { preset: "wide" });
    for (const bad of [null, "wide", { preset: "enormous" }, []]) {
      const r = await put(url, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
    assert.equal((await get(url)).preference.preset, "wide", "a refused PUT left the good value alone");
    db.prepare("UPDATE users SET deck_geometry = '{not json' WHERE id = 1").run();
    assert.deepEqual(await get(url), { preference: null });
  } finally { server.close(); db.close(); }
});

// ── the control ───────────────────────────────────────────────────────────────────────────────
test("⚠ presets FIRST, the three sliders behind \"Customise\" — and their ends are the fitted ones", () => {
  const src = codeOnly(read("client/src/components/DeckGeometryControl.jsx"));
  assert.ok(at(src, 'role="radiogroup"', 0, "presets") < at(src, "Customise", 0, "the reveal"), "the presets come first");
  assert.match(src, /\{custom && \(\s*<div id=\{`\$\{id\}-custom`\}/, "the sliders are hidden until Customise");
  assert.match(src, /aria-expanded=\{custom\}/);
  assert.match(src, /spread: spreadBounds\(orientation, current\.zoom\)/);
  assert.match(src, /reach: reachBounds\(orientation, current\.zoom, current\.spread\)/);
  assert.match(src, /min=\{lo\} max=\{hi\} step=\{step\}/, "a slider whose ends are its raw range can be dragged into a broken deck");
  assert.match(src, /clampGeometry\(orientation, \{ \.\.\.current, \[axis\]: Number\(value\) \}\)/, "and every value still passes the clamp");
});

test("⭐ framed as accessibility; ⛔ under reduced motion it says so and the choice is disabled", () => {
  const src = read("client/src/components/DeckGeometryControl.jsx");
  assert.match(src, /Tight is the calmest and the easiest to follow/);
  assert.match(src, /A step moves every card least/);
  assert.match(src, /<fieldset disabled=\{reduced\}/);
  assert.match(src, /Your device asks for reduced motion, so the deck stays Tight and does not animate, whatever is chosen here\./);
  // Portalled: in the header it sat UNDER the front card (same tier, earlier in the DOM).
  assert.match(src, /createPortal\(/);
  assert.match(src, /position: "fixed"/);
});

test("persisted per user, cached per device: the hook reads the account, writes both", () => {
  const hook = codeOnly(read("client/src/hooks/useDeckGeometry.js"));
  assert.match(hook, /api\("\/api\/settings\/deck-geometry"\)/);
  assert.match(hook, /method: "PUT"/);
  assert.match(hook, /localStorage\.setItem\(DECK_GEOMETRY_STORAGE_KEY/);
  assert.match(hook, /return \(\) => \{ live = false; flush\(\); \};/, "leaving mid-drag drops the last value");
  assert.match(hook, /!touched\.current/, "the account's late answer overwrites a choice just made");
});

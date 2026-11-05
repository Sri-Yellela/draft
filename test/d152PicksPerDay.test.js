// ⭐ D152 (3) · PICKS PER DAY — the deck deals the person's own count (Customise → Daily Deck), stored with the account
// (users.deck_size, migration 220) and read by GET /api/draft/today. NULL / never chosen = the standard 10.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createAccountRouter } from "../routes/account.js";
import { todaysDeck, deckSizeOf, DECK_SIZE } from "../services/dailyDraft.js";
import { DECK_SIZES, DECK_SIZE_STANDARD, normaliseDeckSize } from "../shared/deckGeometry.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const raw = (p) => fs.readFileSync(p, "utf8");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("the choices: a short list whose standard is the deck's own 10; anything else refused", () => {
  assert.deepEqual([...DECK_SIZES], [5, 10, 15, 20]);
  assert.equal(DECK_SIZE_STANDARD, DECK_SIZE, "the standard is services/dailyDraft.js DECK_SIZE — one number");
  assert.ok(DECK_SIZES.includes(DECK_SIZE_STANDARD));
  for (const n of DECK_SIZES) { assert.equal(normaliseDeckSize(n), n); assert.equal(normaliseDeckSize(String(n)), n); }
  for (const bad of [null, undefined, 0, 7, 100, -5, "", "ten", 10.5, [], {}]) assert.equal(normaliseDeckSize(bad), null, JSON.stringify(bad));
});

test("⛔ migration 220 adds the column, additively, byte-identical in both runners", () => {
  // Byte identity IS the property here (CLAUDE.md, line endings): read raw, not normalised.
  const block = (src) => src.slice(at(src, 'id: "220_users_deck_size"'), at(src, "    },", at(src, 'id: "220_users_deck_size"')));
  const a = block(raw("server.js")), b = block(raw("scripts/migrations.js"));
  assert.equal(a, b, "the migration must be byte-identical in server.js and scripts/migrations.js");
  assert.match(a, /ALTER TABLE users ADD COLUMN deck_size INTEGER;/);
  assert.doesNotMatch(a, /DROP|RENAME|UPDATE /i);
});

function accountApp() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'ada','x'), (2,'bo','y')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.get("x-user") || 1) }; next(); });
  const noop = () => ({});
  app.use(createAccountRouter({ db, requireAuth: (q, r, n) => n(), emitToUser: noop, syncClients: new Map(), buildAutofillPayload: noop,
    requireModeEntitlement: () => true, normalisePlanTier: (t) => t, allowedModesForTier: () => [], canUseGenerate: () => true,
    canUseAPlusResume: () => true, nextPlan: () => null, getAutomationReadiness: noop, oauthReadiness: noop, probeBrowserAvailability: async () => ({}),
    encryptSecret: () => ({}), INTEGRATION_PROVIDERS: [], publicIntegrationRow: noop, providerColumnFor: () => null, INDUSTRY_CATEGORIES: [] }));
  const server = app.listen(0);
  return { db, server, url: `http://127.0.0.1:${server.address().port}/api/settings/deck-size` };
}
const put = (url, size, user = 1) => fetch(url, { method: "PUT", headers: { "content-type": "application/json", "x-user": String(user) }, body: JSON.stringify({ size }) });
const get = (url, user = 1) => fetch(url, { headers: { "x-user": String(user) } }).then(r => r.json());

test("⛔ stored per USER: PUT keeps a listed count, GET returns it, never set reads 10; junk refused and nothing stored", async () => {
  const { db, server, url } = accountApp();
  try {
    assert.deepEqual(await get(url), { size: 10, sizes: DECK_SIZES }, "never set = the standard 10");
    assert.equal((await put(url, 5)).status, 200);
    assert.equal((await get(url)).size, 5);
    assert.equal((await get(url, 2)).size, 10, "one person's count is not another's");
    for (const bad of [7, 0, "lots", null, 1000]) assert.equal((await put(url, bad)).status, 400, JSON.stringify(bad));
    assert.equal((await get(url)).size, 5, "a refused PUT left the good value alone");
    assert.equal(deckSizeOf(db, 1), 5);
    db.prepare("UPDATE users SET deck_size = 13 WHERE id = 1").run();
    assert.equal(deckSizeOf(db, 1), 10, "a stored value the list does not hold reads as the standard");
    assert.equal(deckSizeOf(new Database(":memory:"), 1), 10, "no users table (a fixture) — the standard, never a throw");
  } finally { server.close(); db.close(); }
});

test("the deal deals the chosen count — and a deal already frozen today is read as it was dealt", async () => {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
          CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT);
          CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, starred INTEGER DEFAULT 0, disliked INTEGER DEFAULT 0);
          INSERT INTO users (id) VALUES (1);`);
  d.exec(MIGRATIONS.find(m => m.id === "111_daily_drafts").sql);
  const strong = ATS_BAND_CUTPOINTS.strong + 5;
  const page = Array.from({ length: 50 }, (_, i) => ({ id: "s" + i, title: "Role", company: "Co", matchScore: strong }));
  const fetchBoardPage = async () => ({ ok: true, jobs: page, nextCursor: null });
  const date = new Date().toISOString().slice(0, 10);
  const twenty = await todaysDeck(d, { userId: 1, profileId: 1, date, fetchBoardPage, size: 20 });
  assert.equal(twenty.size, 20);
  const five = await todaysDeck(d, { userId: 1, profileId: 2, date, fetchBoardPage, size: 5 });
  assert.equal(five.size, 5);
  const again = await todaysDeck(d, { userId: 1, profileId: 2, date, fetchBoardPage, size: 15 });
  assert.equal(again.size, 5, "today's deal is frozen — a new count starts with the next deal");
  assert.equal(again.dealtNow, false);
});

test("GET /api/draft/today sizes the deal by the person's own count", () => {
  const src = codeOnly(read("server.js"));
  const route = src.slice(at(src, 'app.get("/api/draft/today"'), at(src, 'console.error("[GET /api/draft/today]"'));
  assert.match(route, /const size = deckSizeOf\(db, req\.user\.id\);/);
  assert.match(route, /await todaysDeck\(db, \{[^}]*\bsize, betFor \}\)/);
});

test("Customise → Daily Deck offers the count as radio cards (no pills), saved with the account, and Reset restores 10", () => {
  const src = codeOnly(read("client/src/panels/CustomisePanel.jsx"));
  assert.match(src, /<RadioCards label="Cards a day" name="deck-size"/);
  assert.match(src, /DECK_SIZES\.map\(/, "the choices come from shared/deckGeometry.js, not a second list");
  assert.match(src, /api\("\/api\/settings\/deck-size", \{ method: "PUT", body: JSON\.stringify\(\{ size: next \}\) \}\)/);
  assert.match(src, /await chooseSize\(DECK_SIZE_STANDARD\);/);
  assert.match(read("client/src/panels/CustomisePanel.jsx"), /a new count starts with tomorrow's deal/);
});

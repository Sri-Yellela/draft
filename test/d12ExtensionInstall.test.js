// D12 (10-03): the extension is the import path now (D11 removed IMPORT), so the site has to explain
// and install it, and Full House has to say where it is.
//
//   · /extension — a public page; its install control reads ONE setting (shared/extension.js)
//   · GET /api/extension/status — "connected" = a live extension token for THIS user
//   · Full House: "+ Add jobs" where IMPORT sat, a first-run prompt until connected, and the empty
//     ★ Saved tab pointing at the extension
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { extensionStatusHandler } from "../routes/extensionStatus.js";
import { EXTENSION_STORE_URL, EXTENSION_PAGE, isStoreDetailUrl } from "../shared/extension.js";
import { EXTENSION_USER_AGENT } from "../shared/brand.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const strip = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'),(2,'bo','x')").run();
  return db;
}
const token = (db, { user = 1, ua = EXTENSION_USER_AGENT, revoked = null, expiresIn = 86400, hash } = {}) =>
  db.prepare(`INSERT INTO auth_contexts (token_hash,user_id,expires_at,revoked_at,user_agent)
              VALUES (?,?,unixepoch()+?,?,?)`).run(hash || `h${Math.random()}`, user, expiresIn, revoked, ua);

async function statusFor(db, userId) {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.get("/api/extension/status", extensionStatusHandler(db));
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/extension/status`);
    return { code: r.status, body: await r.json() };
  } finally { server.close(); }
}

test("D12: /api/extension/status — connected only on a LIVE extension token of this user", async () => {
  const db = freshDb();
  // D33 added `state`, `lastCaptureAt` and `recentCaptures` (test/d33InstallState.test.js).
  const none = (await statusFor(db, 1)).body;
  assert.deepEqual({ connected: none.connected, lastSeenAt: none.lastSeenAt }, { connected: false, lastSeenAt: null }, "no token");
  token(db, { ua: "resume-master-mobile" });                 // the phone's token is not the extension
  token(db, { revoked: 1 });                                   // revoked = disconnected
  token(db, { expiresIn: -10 });                               // expired
  token(db, { user: 2 });                                      // someone else's
  const before = await statusFor(db, 1);
  assert.equal(before.code, 200);
  assert.equal(before.body.connected, false, "a mobile, revoked, expired or other user's token counted");
  token(db, {});
  const after = await statusFor(db, 1);
  assert.equal(after.body.connected, true);
  assert.equal(typeof after.body.lastSeenAt, "number");
});

test("D12: the status route is behind requireAuth, at its exact path (the save-job 410 stub stays public)", () => {
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/extension\/status", requireAuth, extensionStatusHandler\(db\)\);/);
  assert.doesNotMatch(server, /app\.use\("\/api\/extension", requireAuth/);
  // The issuing route and the status route agree on the token's tag through ONE constant.
  assert.match(read("routes/extensionStatus.js"), /import \{ EXTENSION_USER_AGENT \} from "\.\.\/shared\/brand\.js";/);
});

test("D12: the store link is one setting — null, or a real Chrome Web Store detail link", () => {
  assert.equal(EXTENSION_PAGE, "/extension");
  assert.ok(EXTENSION_STORE_URL === null || isStoreDetailUrl(EXTENSION_STORE_URL),
    `EXTENSION_STORE_URL is neither null nor a store detail link: ${EXTENSION_STORE_URL}`);
  assert.ok(isStoreDetailUrl("https://chromewebstore.google.com/detail/draft/abcdefghijklmnopabcdefghijklmnop"));
  assert.ok(isStoreDetailUrl("https://chromewebstore.google.com/detail/abcdefghijklmnopabcdefghijklmnop"));
  for (const bad of ["https://example.com/detail/abcdefghijklmnopabcdefghijklmnop", "chromewebstore.google.com",
                     "https://chromewebstore.google.com/detail/draft/ABC", "javascript:alert(1)"]) {
    assert.ok(!isStoreDetailUrl(bad), bad);
  }
  // No client file hard-codes a store link of its own.
  for (const f of ["client/src/pages/marketing/ExtensionPage.jsx", "client/src/components/ExtensionPrompt.jsx", "client/src/App.jsx"]) {
    assert.doesNotMatch(read(f), /chromewebstore\.google\.com|chrome\.google\.com\/webstore/, f);
  }
});

test("D12: /extension is routed, public, and linked from the footer and the marketing nav", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /<Route path="\/extension"\s+element=\{<ExtensionPage\/>\}\/>/);
  // Public: it is a top-level route, not under /app/*.
  assert.ok(app.indexOf('<Route path="/extension"') < app.indexOf('<Route path="/app/*"'));
  assert.match(read("client/src/components/Footer.jsx"), /\{ label: "Browser extension", to: "\/extension" \}/);
  assert.match(read("client/src/components/ScrollDock.jsx"), /\{ label: "Extension",\s+to: "\/extension" \}/);
  const page = strip(read("client/src/pages/marketing/ExtensionPage.jsx"));
  assert.match(page, /if \(!EXTENSION_STORE_URL\)/, "the page offers a link that may not exist");
  assert.match(page, /You submit it yourself/);
});

test("D12: Full House — + Add jobs where IMPORT sat, the first-run prompt, the Saved empty state", () => {
  const app = strip(read("client/src/App.jsx"));
  // ⛔ D40 (owner, 10-06): ADD JOBS is no longer a square — + is the fourth VIEW, and its head carries
  // Import jobs (to /extension).
  const icons = app.slice(at(app, "function BoardControlIcons()"), at(app, "function BoardSortSlot()"));
  assert.doesNotMatch(icons, /<AddSquare\b/, "the standalone + square is back");
  assert.match(app, /\["imported", "\+", "Imported jobs"\]/);
  const chrome = app.slice(at(app, '<header className="fh"'), at(app, "</main>"));
  assert.match(chrome, /<ExtensionFirstRunPrompt \/>/);

  const prompt = read("client/src/components/ExtensionPrompt.jsx");
  assert.match(prompt, /api\("\/api\/extension\/status"\)/);
  // Shown only when the check SUCCEEDED and said not connected — unknown shows nothing.
  assert.match(prompt, /if \(dismissed \|\| !status \|\| status\.connected\) return null;/);
  // Storage is wrapped: a private window must not crash the board.
  assert.match(prompt, /try \{ return localStorage\.getItem\(DISMISS_KEY\) === "1"; \} catch \{ return false; \}/);

  const panel = read("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /: savedTab\s*\r?\n\s*\? <SavedEmptyState theme=\{theme\}\/>/);
  assert.match(panel, /: importedTab\s*\r?\n\s*\? <ImportedEmptyState theme=\{theme\}\/>/, "D40: the empty + view says how to capture");
  assert.match(panel, /<Link to=\{EXTENSION_PAGE\}[^>]*data-import-jobs="">Import jobs<\/Link>/);
  assert.equal((panel.match(/savedTab=\{boardTab === "saved"\}/g) || []).length, 2, "both JobsColumn call sites");
  assert.doesNotMatch(panel, /posting yourself with <strong>Import<\/strong>/);
});

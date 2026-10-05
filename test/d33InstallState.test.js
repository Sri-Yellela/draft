// D33 part 4 — THE INSTALL STATE IS KNOWABLE, STOP ASKING. The owner had the extension installed and
// enabled, and the site offered "get the extension". Three states, from routes/extensionStatus.js:
//   not_installed  -> install       not_connected -> connect       connected -> what to do with it
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { extensionStatusHandler } from "../routes/extensionStatus.js";
import { EXTENSION_USER_AGENT } from "../shared/brand.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const strip = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'),(2,'bo','x')").run();
  return db;
}
const token = (db, { user = 1, revoked = null, expiresIn = 86400 } = {}) =>
  db.prepare(`INSERT INTO auth_contexts (token_hash,user_id,expires_at,revoked_at,user_agent) VALUES (?,?,unixepoch()+?,?,?)`)
    .run(`h${Math.random()}`, user, expiresIn, revoked, EXTENSION_USER_AGENT);

async function status(db, userId = 1) {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.get("/api/extension/status", extensionStatusHandler(db));
  const server = app.listen(0);
  try { return await (await fetch(`http://127.0.0.1:${server.address().port}/api/extension/status`)).json(); }
  finally { server.close(); }
}

test("not_installed: no extension token on record and no capture — the only state that offers an install", async () => {
  const db = freshDb();
  token(db, { user: 2 });   // someone else's
  const s = await status(db);
  assert.equal(s.state, "not_installed");
  assert.equal(s.connected, false);
  assert.deepEqual(s.recentCaptures, []);
});

test("not_connected: a lapsed or revoked extension token, or a capture, is evidence the extension is there", async () => {
  let db = freshDb();
  token(db, { expiresIn: -10 });
  assert.equal((await status(db)).state, "not_connected", "an expired token");
  db = freshDb();
  token(db, { revoked: 1 });
  assert.equal((await status(db)).state, "not_connected", "a revoked token (disconnected)");
  // Lapsed rows are swept a day later (issueAuthContext), so a capture also counts.
  db = freshDb();
  db.prepare("INSERT INTO job_captures (user_id,job_id,origin,action,created_at) VALUES (1,'x','capture','inserted',1000)").run();
  const s = await status(db);
  assert.equal(s.state, "not_connected");
  assert.equal(s.lastCaptureAt, 1000000);
  // An admin import or a pasted URL is not the extension.
  db = freshDb();
  db.prepare("INSERT INTO job_captures (user_id,job_id,origin,action) VALUES (1,'x','import_url','inserted')").run();
  assert.equal((await status(db)).state, "not_installed");
});

test("connected: a live token — and the recent captures say what happened to each", async () => {
  const db = freshDb();
  token(db);
  db.prepare(`INSERT INTO scraped_jobs (job_id,search_query,_hash,title,company,url,source,location,is_active)
              VALUES ('j1','crawl','h','Backend Engineer','Northwind','https://x.example/1','import','Remote',0)`).run();
  db.prepare("INSERT INTO rejected_jobs (job_id,title,company,source,reason,rejected_at) VALUES ('j1','','','','out_of_market:remote_region_unstated',0)").run();
  db.prepare("INSERT INTO job_captures (user_id,job_id,origin,action,created_at) VALUES (1,'j1','capture','inserted',1000)").run();
  const s = await status(db);
  assert.equal(s.state, "connected");
  assert.equal(s.connected, true);
  assert.equal(s.recentCaptures[0].outcome, "held");
  assert.match(s.recentCaptures[0].message, /NOT on the shared board/);
  assert.equal(s.recentCaptures[0].link, "/app/jobs?job=j1");
});

test("the /extension page offers the install ONLY to the signed-out and to not_installed", () => {
  const page = strip(read("client/src/pages/marketing/ExtensionPage.jsx"));
  assert.match(page, /const offerInstall = signedIn === false \|\| status\?\.state === "not_installed";/);
  assert.match(page, /\{known && offerInstall && \(/);
  // Connected: what to do with it, never an install control.
  const card = page.slice(at(page, "export function ExtensionStateCard"), at(page, "export function RecentCaptures"));
  const connected = card.slice(at(card, 'status.state === "connected"'), at(card, 'status.state === "not_connected"'));
  assert.doesNotMatch(connected, /ExtensionInstallButton|Add to Chrome|Get the extension/);
  assert.match(connected, /Ctrl\+Shift\+K/);
  // The site shows the capture outcome text as the server gave it.
  assert.match(page, /\{c\.message\}/);
  // Signed-in is learned from /api/auth/me (200 either way), never from a 401 on the status route.
  assert.match(page, /api\("\/api\/auth\/me"\)/);
  assert.match(page, /useExtensionStatus\(\{ enabled: signedIn === true \}\)/);
});

test("Full House: the ★ Saved empty state and the first-run prompt follow the state", () => {
  const prompt = strip(read("client/src/components/ExtensionPrompt.jsx"));
  const saved = prompt.slice(at(prompt, "export function SavedEmptyState"));
  assert.match(saved, /const connected = status\?\.state === "connected";/);
  assert.match(saved, /\{!connected && \(/, "a connected user is offered the extension again");
  const first = prompt.slice(at(prompt, "export function ExtensionFirstRunPrompt"), at(prompt, "export function SavedEmptyState"));
  assert.match(first, /if \(dismissed \|\| !status \|\| status\.connected\) return null;/);
  assert.match(first, /"How to connect it" : "Get the extension"/);
});

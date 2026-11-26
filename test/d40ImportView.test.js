// D40 (owner, 10-06) — `+` BECOMES THE FOURTH VIEW: ALL · ★ · /d · +.
//
// The + view is ALL restricted to the jobs this user imported (job_captures), on the board's own card,
// with the board's search, sort and sentence working on it. The standalone + square is gone; imports
// do not go into ★; the /extension page stops listing captures and points here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importJob } from "../services/jobs/importJob.js";
import { viewCounts } from "../client/src/lib/filterSentenceModel.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const app = read("client/src/App.jsx");
const server = read("server.js");
const panel = read("client/src/panels/JobsPanel.jsx");

test("D40 · the bar has exactly FOUR views, + last — and no standalone import control remains", () => {
  // 47j R2 (changed on purpose): the views are the shell's area nav (MARKET_AREA_VIEWS) — Today's picks + the same three
  const tabs = app.slice(at(app, "const MARKET_AREA_VIEWS = ["), at(app, "];", at(app, "const MARKET_AREA_VIEWS = [")));
  // ⭐ D156 (4) (changed on purpose): All jobs · Starred · Imported — the Pending (Drafted) view is not needed now.
  assert.deepEqual([...tabs.matchAll(/id: "(\w+)"/g)].map(m => m[1]), ["picks", "all", "saved", "imported"]);   // ⛔ A157 (45q, owner 11-09): the Companies tab is removed
  assert.match(tabs, /\{ id: "imported", label: "Imported", href: "\/app\/jobs\?view=imported"/);
  assert.doesNotMatch(app, /<AddSquare\b/);
  assert.doesNotMatch(read("client/src/components/BoardBar.jsx"), /export function AddSquare/);
  assert.deepEqual(viewCounts({ total: 1, clauses: {}, views: { all: 5, saved: 1, pending: 0, imported: 2 } }),
    { all: 5, saved: 1, pending: 0, imported: 2 }, "the + view carries its count");
});

test("D40 · + is ALL restricted by ONE predicate — the same statement, with ★'s one labelled exception", () => {
  assert.match(server, /const importedSql = importedTab\s+\? `AND EXISTS \(SELECT 1 FROM job_captures jc WHERE jc\.job_id = sj\.job_id AND jc\.user_id = \$\{ownUid\}\)\s+AND sj\.job_id IN \(SELECT c\.job_id FROM job_captures c WHERE c\.user_id = \$\{ownUid\}\)` : '';/ /* ⭐ D151 Rule 4 (11-08, changed on purpose) */);
  assert.match(server, /\$\{starredSql\}\s+\$\{importedSql\}/, "the predicate sits beside ★'s in the one WHERE");
  assert.match(server, /WHERE \$\{\(savedTab \|\| importedTab\) \? '1 = 1' : 'sj\.is_active = 1'\}/,
    "a capture whose listing closed stays in + labelled, as a save does in ★");
  assert.match(panel, /if \(boardTab === "imported"\) p\.set\("imported", "1"\);/, "the client asks the same endpoint");
});

test("D40 · an import is in ALL and in +, and NOT in ★ unless the user stars it", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  db.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (7,1,'P','engineering','general',1)`).run();
  const r = await importJob({ url: "https://northwind.example.com/careers/x",
    text: "Title: Backend Engineer\nCompany: Northwind\nLocation: Boston, MA\n\nBuild." }, { db, userId: 1 });
  const id = r.job.id;
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = ?").get(id).is_active, 1, "in ALL");
  assert.ok(db.prepare("SELECT 1 FROM job_captures WHERE job_id = ? AND user_id = 1").get(id), "in + (its membership)");
  assert.equal(db.prepare("SELECT starred FROM user_jobs WHERE job_id = ? AND user_id = 1").get(id).starred, 0, "not in ★");
  // Capturing twice does not duplicate the row the + view lists (the list is GROUPed by the board's own rows).
  await importJob({ url: "https://northwind.example.com/careers/x",
    text: "Title: Backend Engineer\nCompany: Northwind\nLocation: Boston, MA\n\nBuild." }, { db, userId: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM scraped_jobs").get().n, 1);
  db.close();
});

test("D40 · the + head: Import jobs → /extension; a CONNECTED extension is never offered a download", () => {
  const head = panel.slice(at(panel, "export function ImportedHeaderView"), at(panel, "export function ImportedEmptyState"));
  assert.match(head, /<Link to=\{EXTENSION_PAGE\}[^>]*data-import-jobs="">Import jobs<\/Link>/);
  assert.match(head, /\{connected\s*\?\s*<span data-extension-connected/, "connected → how to capture, not a download");
  assert.match(head, /: EXTENSION_STORE_URL\s*\?\s*<a href=\{EXTENSION_STORE_URL\}/);
  assert.match(head, /Web Store listing is not published yet/, "a null store URL says so, never a dead link");
  assert.match(panel, /: importedTab\s*\n\s*\? <ImportedEmptyState theme=\{theme\}\/>/, "the empty + view says how to capture one");
});

test("D40 · each imported card adds ONE line: captured <date> · from <host>", () => {
  // 47j A248 (changed on purpose): the card's "captured … · from …" line (capturedLine) is deleted with JobBubble's card; the server still
  // sends `captured` on the + view. ⭐ A251 (47j): the Index row says it — the same words, in the row's one line.
  assert.doesNotMatch(read("client/src/components/JobBubble.jsx"), /capturedLine/);
  const ix = read("client/src/plate/MarketIndex.jsx");
  assert.match(ix, /return \[day \? `captured \$\{day\}` : "captured", c\.from \? `from \$\{c\.from\}` : null\]\.filter\(Boolean\)\.join\(" · "\);/);
  assert.match(ix, /captured: capturedWords\(job\.captured\),/);
  assert.match(ix, /\{r\.captured \? <span className="pl-ixrow__mark" data-captured=""> · \{r\.captured\}<\/span> : null\}/);
  assert.match(server, /\.\.\.\(importedTab \? \{ captured: captureMeta\(capturedBy\.get\(j\.job_id\)\) \} : \{\}\)/);
  // Read after the list, so the list statement interpolates exactly what the count does.
  assert.match(server, /const capturedBy = new Map\(\);\s+if \(importedTab && rows\.length\)/);
});

test("D40 · the /extension page stops listing captures and points at the + view", () => {
  const page = read("client/src/pages/marketing/ExtensionPage.jsx");
  assert.doesNotMatch(page, /RecentCaptures|data-recent-captures/);
  assert.match(page, /<Link to="\/app\/jobs\?view=imported">/);
  const ctx = read("client/src/contexts/JobBoardContext.jsx");
  assert.match(ctx, /export const BOARD_VIEWS = Object\.freeze\(\["all", "saved", "pending", "imported"]\);/);
  assert.match(ctx, /useState\(\(\) => viewFromUrl\(\) \|\| "all"\)/, "the link opens the + view");
});

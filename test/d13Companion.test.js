// D13 (10-03, owner chose C, "the companion"): the extension does the same four things — capture,
// fill, score, open draft — and picks the one this page calls for. ⭐ T31 (owner 10-25): the toolbar popup that picked
// it is retired; the PICK is the toolbar press's (extension/toolbarPress.js relayFor — test/t31ToolbarPress.test.js),
// and companion.js went with the popup. What stays pinned here is the server half — POST /api/import/context, which
// the press asks — and D13's guarantees: no new storage, no new permission, the address sent on the press only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// ── The server half: POST /api/import/context ─────────────────────────────────────────────────
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'),(2,'bo','x')").run();
  const job = db.prepare(`INSERT INTO scraped_jobs (job_id,search_query,company,title,_hash,url,apply_url,is_active,duplicate_of,updated_at)
                          VALUES (?,?,?,?,?,?,?,?,?,unixepoch())`);
  job.run("greenhouse:northwind:101", "", "Northwind", "Backend Engineer", "h1",
          "https://job-boards.greenhouse.io/northwind/jobs/101", null, 1, null);
  job.run("dup:1", "", "Northwind", "Backend Engineer (dup)", "h2",
          "https://northwind.example/careers/101", null, 0, "greenhouse:northwind:101");
  job.run("lever:fabrikam:1", "", "Fabrikam", "Data Engineer", "h3",
          "https://jobs.lever.co/fabrikam/0b1c2d3e-0000", "https://jobs.lever.co/fabrikam/0b1c2d3e-0000/apply", 1, null);
  return db;
}

async function contextFor(db, userId, url) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.use("/api/import", createImportJobRouter(db, null));
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/import/context`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    return { code: r.status, body: await r.json() };
  } finally { server.close(); }
}

test("D13: /api/import/context — saved / known / not on the board, matched loosely, duplicates resolved", async () => {
  const db = freshDb();
  // Not in the pool at all.
  let r = await contextFor(db, 1, "https://jobs.ashbyhq.com/contoso/11111111-2222");
  assert.equal(r.code, 200);
  assert.deepEqual({ known: r.body.posting.known, saved: r.body.posting.saved }, { known: false, saved: false });
  assert.deepEqual(r.body.ats, { type: "ashby", slug: "contoso" }, "the URL names the ATS and slug (D4's parser)");
  // In the pool; tracking query, hash and trailing slash do not hide it.
  r = await contextFor(db, 1, "https://job-boards.greenhouse.io/northwind/jobs/101/?gh_src=abc#apply");
  assert.equal(r.body.posting.known, true);
  assert.equal(r.body.posting.saved, false);
  assert.equal(r.body.posting.jobId, "greenhouse:northwind:101");
  // Saved by THIS user only.
  db.prepare("INSERT INTO user_jobs (user_id,job_id,starred) VALUES (2,'greenhouse:northwind:101',1)").run();
  assert.equal((await contextFor(db, 1, "https://job-boards.greenhouse.io/northwind/jobs/101")).body.posting.saved, false,
    "another user's star counted");
  db.prepare("INSERT INTO user_jobs (user_id,job_id,starred) VALUES (1,'greenhouse:northwind:101',1)").run();
  assert.equal((await contextFor(db, 1, "https://job-boards.greenhouse.io/northwind/jobs/101")).body.posting.saved, true);
  // A retired duplicate resolves to its canonical row.
  r = await contextFor(db, 1, "https://northwind.example/careers/101");
  assert.equal(r.body.posting.jobId, "greenhouse:northwind:101");
  assert.equal(r.body.posting.saved, true);
  // apply_url matches too.
  r = await contextFor(db, 1, "https://jobs.lever.co/fabrikam/0b1c2d3e-0000/apply");
  assert.equal(r.body.posting.jobId, "lever:fabrikam:1");
  // Not a web page: no posting, but recent captures still come back.
  r = await contextFor(db, 1, "chrome://extensions");
  assert.equal(r.body.posting, null);
  assert.ok(Array.isArray(r.body.recent));
});

test("D13: /api/import/context — recent captures are YOURS, newest first, one per job, read-only", async () => {
  const db = freshDb();
  const cap = db.prepare("INSERT INTO job_captures (user_id,job_id,origin,action,created_at) VALUES (?,?,?,?,?)");
  cap.run(1, "greenhouse:northwind:101", "capture", "inserted", 1000);
  cap.run(1, "lever:fabrikam:1", "capture", "inserted", 2000);
  cap.run(1, "greenhouse:northwind:101", "capture", "attached", 3000);
  cap.run(2, "lever:fabrikam:1", "capture", "inserted", 4000);
  const before = db.prepare("SELECT (SELECT COUNT(*) FROM scraped_jobs) + (SELECT COUNT(*) FROM user_jobs) + (SELECT COUNT(*) FROM job_captures) AS n").get().n;
  const r = await contextFor(db, 1, "https://example.com/");
  assert.deepEqual(r.body.recent.map(x => [x.jobId, x.capturedAt]),
    [["greenhouse:northwind:101", 3000000], ["lever:fabrikam:1", 2000000]]);
  assert.equal(r.body.recent[0].title, "Backend Engineer");
  const after = db.prepare("SELECT (SELECT COUNT(*) FROM scraped_jobs) + (SELECT COUNT(*) FROM user_jobs) + (SELECT COUNT(*) FROM job_captures) AS n").get().n;
  assert.equal(after, before, "the lookup wrote a row");
  // The URL travels in the body, never the query string (request logs).
  const route = read("routes/importJob.js");
  assert.match(route, /router\.post\("\/context"/);
  assert.match(route, /req\.body\?\.url/);
  assert.doesNotMatch(route, /req\.query\.url/);
});

// ── The extension half ─────────────────────────────────────────────────────────────────────────
test("⛔ D13: no new storage, no new permission — the context is asked on the press only and stored nowhere", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  // D55 decision B (10-07) added contextMenus — the owner's decision, rationalised in
  // MANIFEST_RATIONALE.md and reconciled in PRIVACY_RECONCILIATION.md. D13 itself still adds none.
  assert.deepEqual(manifest.permissions, ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  // D99 J11 (owner, 10-14: "build the bridge"): the ONE content script is the bridge, on draft's own origin only.
  assert.deepEqual(manifest.content_scripts, [{ matches: ["https://jobsviadraft.com/*"], js: ["boardBridge.js"], run_at: "document_start", all_frames: false }], "a content script other than D99's bridge appeared");

  const bg = read("extension/background.js");
  const ctx = bg.slice(at(bg, "async function popupContext"), at(bg, "// ── ⭐ T17 · THE DOCK"));
  assert.doesNotMatch(ctx, /chrome\.storage/, "the companion stores its context");
  assert.match(ctx, /authedFetch\(RESUME_MASTER_URL, '\/api\/import\/context', \{\s*method: 'POST'/);
  // D56: the drafted-application half is the page MATCH (origin list + job id, server-side) — asked only on the press.
  assert.match(ctx, /pageMatchFor\(RESUME_MASTER_URL, tab\)/);
  // ⭐ T31: the press is what asks — the toolbar's onClicked, signed in only (toolbarPress.js)
  assert.match(bg, /context: \(\) => popupContext\(tab\),/);
  assert.match(read("extension/toolbarPress.js"), /const ctx = identity\?\.authenticated \? await deps\.context\(tab\)\.catch\(\(\) => null\) : null;/);
  // Fill is the SAME handoff the shortcut runs.
  assert.match(bg, /if \(message\.type === 'FILL_ACTIVE_TAB'\) \{\s*handleGatedHandoff\(\)/);
  // the press's words are drawn by the popup layer as TEXT (no innerHTML in what the press shows)
  const tp = read("extension/toolbarPress.js");
  assert.doesNotMatch(tp.slice(at(tp, "export function renderRelay(specs, theme) {"), at(tp, "/** Injected, TOP frame: is draft's dock")), /innerHTML/);
});

test("D13 → T31: the privacy policy says the toolbar press sends the tab's address — on the press, and nothing before it", () => {
  // D23 moved the board check from popup OPEN to the "Read this page" press; ⭐ T31 (owner 10-25, "one press reads")
  // makes the toolbar press that press — the sentence moved with it rather than growing a new disclosure.
  assert.match(read("client/src/pages/marketing/PrivacyPage.jsx"),
    /When you press the extension's\{" "\}\s*<Strong>toolbar button<\/Strong> \(or its keyboard shortcut\) on a page, it opens draft's\s+panel there and also sends that one address to \{CANONICAL_HOST\}[\s\S]{0,260}nothing is read or sent before you press it/);
});

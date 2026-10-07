// D13 (10-03, owner chose C, "the companion"): the extension does the same four things — capture,
// fill, score, open draft — and the popup PICKS the one this page calls for:
//   a form you drafted -> Fill it ("You drafted this 2 days ago · résumé ready · 14 fields prepared")
//   a job posting      -> Capture it + Score it, and whether it is on your board yet
//   neither            -> your recent captures
// ⛔ No new storage, no new permission, no new disclosure beyond the one sentence the policy now
// carries (the popup sends the tab's address for the board check). ⚠ All four actions stay visible.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// companion.js is a classic script (popup.html loads it before popup.js) — run it as one.
const sandbox = {};
vm.runInNewContext(read("extension/companion.js"), sandbox);
const { companionMode, draftedLine, postingLine, questionsLine } = sandbox;

const DAY = 86400000;
const now = Date.UTC(2026, 9, 3, 12);
const packet = (o = {}) => ({ packetId: 1, createdAt: now - 2 * DAY, stale: false, answerCount: 14,
  unresolvedCount: 0, resumeAvailable: true, ...o });

test("D13: a form you drafted wins — Fill it, with the owner's sentence", () => {
  const c = companionMode({ preview: { capturable: true, ok: true }, context: { packets: [packet()] } });
  assert.equal(c.mode, "form");
  assert.deepEqual([...c.primary], ["fill"]);
  assert.equal(draftedLine(c.packet, now), "You drafted this 2 days ago · résumé ready · 14 fields prepared");
  assert.equal(draftedLine(packet({ answerCount: 1, resumeAvailable: false, createdAt: now - DAY }), now),
    "You drafted this yesterday · no résumé attached · 1 field prepared");
  // A stale packet cannot be released (the server refuses), so it must not make this a form.
  assert.notEqual(companionMode({ preview: null, context: { packets: [packet({ stale: true })] } }).mode, "form");
  // Newest of several.
  const two = companionMode({ context: { packets: [packet({ packetId: 1, createdAt: now - 3 * DAY }), packet({ packetId: 2, createdAt: now - DAY })] } });
  assert.equal(two.packet.packetId, 2);
  assert.equal(two.others, 1);
});

test("D13: unanswered questions surface on the form, and say the answer is reused", () => {
  assert.equal(questionsLine(packet()), "");
  assert.equal(questionsLine(packet({ unresolvedCount: 2 })), "2 questions need your answer — answer once and draft reuses it.");
  assert.equal(questionsLine(packet({ unresolvedCount: 1 })), "1 question needs your answer — answer once and draft reuses it.");
});

test("D13: a posting -> Capture it + Score it, and whether it is on your board", () => {
  const c = companionMode({ preview: { capturable: true, ok: true }, context: { packets: [], posting: { known: false, saved: false } } });
  assert.equal(c.mode, "posting");
  assert.deepEqual([...c.primary], ["capture", "score"]);
  assert.equal(postingLine({ known: false, saved: false }), "Not on your board yet");
  assert.equal(postingLine({ known: true, saved: false }), "On draft, not saved by you yet");
  assert.equal(postingLine({ known: true, saved: true }), "Saved on your board");
  assert.equal(postingLine(null), "", "a failed board check says nothing rather than guessing");
});

test("D13: neither -> recent captures (at most five); an unreadable page is not a posting", () => {
  const recent = Array.from({ length: 7 }, (_, i) => ({ jobId: `j${i}`, title: `T${i}` }));
  const c = companionMode({ preview: { capturable: true, ok: false }, context: { packets: [], recent } });
  assert.equal(c.mode, "neither");
  assert.equal(c.recent.length, 5);
  assert.equal(companionMode({ preview: null, context: null }).mode, "neither", "both lookups failing is not a crash");
});

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
test("⛔ D13: no new storage, no new permission — and all four actions stay visible", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  // D55 decision B (10-07) added contextMenus — the owner's decision, rationalised in
  // MANIFEST_RATIONALE.md and reconciled in PRIVACY_RECONCILIATION.md. D13 itself still adds none.
  assert.deepEqual(manifest.permissions, ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  assert.equal(manifest.content_scripts, undefined, "a content script appeared");

  const bg = read("extension/background.js");
  const ctx = bg.slice(at(bg, "async function popupContext"), at(bg, "async function previewActiveTab"));
  assert.doesNotMatch(ctx, /chrome\.storage/, "the companion stores its context");
  assert.match(ctx, /authedFetch\(RESUME_MASTER_URL, '\/api\/import\/context', \{\s*method: 'POST'/);
  assert.match(ctx, /portalQueueFor\(RESUME_MASTER_URL, origin\)/);
  for (const f of ["extension/companion.js", "extension/popup.js"]) {
    assert.doesNotMatch(read(f), /chrome\.storage\.(local|session)\.set/, `${f} writes storage`);
  }
  // Fill from the popup is the SAME handoff the shortcut runs.
  assert.match(bg, /if \(message\.type === 'FILL_ACTIVE_TAB'\) \{\s*handleGatedHandoff\(\)/);

  const html = read("extension/popup.html");
  // D23: the heading only appears once the page has been read; the four sit under it either way.
  const everything = html.slice(at(html, '<p class="all-head" id="all-head" style="display:none">Everything</p>'), at(html, '<p class="result-text"'));
  for (const id of ["btn-capture-job", "btn-fill", "btn-ats", "btn-resume"]) {
    assert.match(everything, new RegExp(`id="${id}"`), `${id} is not under Everything`);
  }
  assert.ok(html.indexOf('src="companion.js"') < html.indexOf('src="popup.js"'), "companion.js must load first");

  // On a page that cannot be read, Capture is disabled — never hidden.
  const popupSrc = read("extension/popup.js");
  const unreadable = popupSrc.slice(at(popupSrc, "if (!preview?.capturable) {"), at(popupSrc, "setStatus('Open a job posting to capture it');"));
  assert.match(unreadable, /cap\.style\.display = 'inline-flex';\s*cap\.disabled = true;/);

  // The popup renders server text as TEXT.
  const popup = read("extension/popup.js");
  const render = popup.slice(at(popup, "function renderCompanion"), at(popup, "async function fillActiveTab"));
  assert.doesNotMatch(render, /innerHTML/);
});

test("D13 (narrowed by D23): the privacy policy says the popup sends the tab's address — on the press", () => {
  // D23 moved the board check from popup OPEN to the "Read this page" press; the sentence narrowed
  // with it rather than growing a new disclosure.
  assert.match(read("client/src/pages/marketing/PrivacyPage.jsx"),
    /When you press\{" "\}\s*<Strong>Read this page<\/Strong> in the extension's popup \(opening the popup alone reads\s+nothing\), it also sends that one address to \{CANONICAL_HOST\}/);
});

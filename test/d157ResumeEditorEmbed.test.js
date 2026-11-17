// ⭐ D157 (owner 11-06, option A) + D171 FIX 4 — the résumé editor is resume-master's tool, embedded; draft keeps no
// fork. Pinned here: draft's two reads (on the real schema), the host's side of rm-editor/1, the places that open it,
// and the fallback to draft's own preview. The editor's own tests live in resume-master (test/d157Editor.test.js);
// the real-Chrome walk of the pair is in the WORKLOG (45c TECH).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createResumeEditorRouter, editorOrigin, EDITOR_CONTRACT } from "../routes/resumeEditor.js";
import { changedLines } from "../client/src/lib/resumeEditor.js";
import { LEGACY_ORIGIN, LEGACY_HOST } from "../shared/brand.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function migrated() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
async function serve(db, userId, env = {}) {
  const app = express();
  const requireAuth = (req, _res, next) => { req.user = { id: userId }; next(); };
  app.use(createResumeEditorRouter({ db, requireAuth, env }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}
function seed(db) {
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'syn-a', 'x'), (2, 'syn-b', 'x')").run();
  const rid = db.prepare("INSERT INTO resumes (user_id, job_id, company, role, html, created_at, updated_at) VALUES (1, 'gh::1', 'Northwind', 'Backend Engineer', '<html><body><div class=\"header\"><div class=\"name\">Syn</div></div></body></html>', unixepoch(), unixepoch())").run().lastInsertRowid;
  // One run per attempt (a run holds a job once).
  const newRun = () => db.prepare("INSERT INTO apply_runs (user_id, mode, status, created_at) VALUES (1, 'auto', 'done', unixepoch())").run().lastInsertRowid;
  const add = (status, submittedBy = null) => db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, resume_artifact_id, posting_title, posting_company, submitted_by, created_at)
    VALUES (?, 1, 'gh::1', ?, ?, 'Backend Engineer II', 'Northwind Inc', ?, unixepoch())`).run(newRun(), status, rid, submittedBy).lastInsertRowid;
  return { held: add("needs_review"), sent: add("submitted", "user"), noResume: db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, created_at) VALUES (?, 1, 'gh::2', 'failed', unixepoch())").run(newRun()).lastInsertRowid };
}

test("d171ResumePreviewInApp: an attempt's résumé is served as HTML to open in draft — read-only once it was sent", async () => {
  const db = migrated();
  let ids;
  try { ids = seed(db); } catch (e) { assert.fail(`the seed no longer matches the schema: ${e.message}`); }
  const s = await serve(db, 1);
  try {
    const held = await (await fetch(`${s.base}/api/apply/run-jobs/${ids.held}/resume-doc`)).json();
    assert.match(held.html, /class="name">Syn/);
    assert.equal(held.jobId, "gh::1");
    assert.equal(held.company, "Northwind Inc", "the posting as stored when the application was made");
    assert.equal(held.title, "Backend Engineer II");
    assert.equal(held.readOnly, false, "not sent yet — an edit changes what will go out");
    const sent = await (await fetch(`${s.base}/api/apply/run-jobs/${ids.sent}/resume-doc`)).json();
    assert.equal(sent.readOnly, true, "what was sent is a record");
    const none = await fetch(`${s.base}/api/apply/run-jobs/${ids.noResume}/resume-doc`);
    assert.equal(none.status, 404);
    assert.equal((await none.json()).error, "no_resume_artifact");
    assert.equal((await fetch(`${s.base}/api/apply/run-jobs/abc/resume-doc`)).status, 404);
  } finally { await s.close(); }
  const other = await serve(db, 2);
  try {
    assert.equal((await fetch(`${other.base}/api/apply/run-jobs/${ids.held}/resume-doc`)).status, 404, "another user's attempt is a 404");
  } finally { await other.close(); }
});

test("d157SandboxIsTheToolsService (D157 d157SandboxIsResume-Master): the editor's address is the tools service's public origin, never its private network", async () => {
  assert.equal(editorOrigin({}), LEGACY_ORIGIN);
  assert.equal(editorOrigin({ RESUME_MASTER_URL: "http://tools-svc.railway.internal:8080" }), LEGACY_ORIGIN);
  assert.equal(editorOrigin({ RESUME_MASTER_URL: "https://tools.example.com/v1" }), "https://tools.example.com");
  assert.equal(editorOrigin({ RESUME_MASTER_URL: "http://localhost:3100" }), "http://localhost:3100", "a local pair works");
  assert.equal(editorOrigin({ RESUME_EDITOR_ORIGIN: `https://staging.${LEGACY_HOST}/x` }), `https://staging.${LEGACY_HOST}`);
  const s = await serve(migrated(), 1, { RESUME_MASTER_URL: "http://localhost:3100" });
  try {
    const c = await (await fetch(`${s.base}/api/resume-editor`)).json();
    assert.deepEqual(c, { available: true, origin: "http://localhost:3100", url: "http://localhost:3100/editor/", contract: EDITOR_CONTRACT });
  } finally { await s.close(); }
  const off = await serve(migrated(), 1, { RESUME_EDITOR_OFF: "1" });
  try { assert.equal((await (await fetch(`${off.base}/api/resume-editor`)).json()).available, false); } finally { await off.close(); }
});

test("d157NoForkInDraft: draft holds the host, never the editor — no section model, no editor page of its own", () => {
  const host = read("client/src/components/ResumeEditorHost.jsx");
  for (const term of ["sectionsFromHtml", "htmlFromSections", "moveSection", "execCommand", "contentEditable"]) {
    assert.ok(!host.includes(term), `the host does not re-implement ${term}`);
  }
  assert.match(host, /e\.origin !== cfg\.origin \|\| e\.source !== frameRef\.current\?\.contentWindow/, "messages only from the editor's frame, at its origin");
  assert.match(host, /m\.contract !== CONTRACT/);
  assert.match(host, /w\.postMessage\(\{ contract: CONTRACT, type, \.\.\.payload \}, cfg\.origin\)/, "posted only to the editor's origin");
  assert.match(host, /const CONTRACT = "rm-editor\/1"/);
  assert.match(read("routes/resumeEditor.js"), /export const EDITOR_CONTRACT = "rm-editor\/1"/);
  // The theme follows the site live, from the --color-* bridge.
  assert.match(host, /post\("theme", \{ tokens: themeTokens\(\) \}\)/);
  assert.match(host, /new MutationObserver\(send\)/);
  assert.match(read("client/src/lib/resumeEditor.js"), /accent: v\("--color-primary"\)/);
});

test("d157OpensFullScreenAndReturns: one host in the app shell; Back, Esc and the browser's Back close it; the page stays mounted", () => {
  const app = read("client/src/App.jsx");
  assert.equal((app.match(/<ResumeEditorHost \/>/g) || []).length, 1);
  const host = read("client/src/components/ResumeEditorHost.jsx");
  // 45n D157 (i) (4e10cc14): the pushed entry now carries the editor's own address (/draft/resume/<job>) for an editable
  // résumé — still one entry, the router's state kept, so Back still closes it (pin moved on purpose).
  assert.match(host, /window\.history\.pushState\(\{ \.\.\.\(window\.history\.state \|\| \{\}\), rmEditor: 1 \}, "", own\)/, "the browser's Back closes it, the router's state kept");
  assert.match(host, /addEventListener\("popstate", onPop\)/);
  assert.match(host, /if \(e\.key === "Escape"\)/);
  assert.match(host, /m\.type === "close"/, "the editor's own Esc closes it");
  assert.match(host, /createPortal\(/, "drawn over the page, so the page under it never unmounts");
  assert.match(host, /data-nav-dock/, "it starts where the dock ends — the dock stays");
});

test("d157PostingOpensTheEditor: a ready résumé opens in the editor; the panel keeps generating / failed / missing / KB findings / variants, and is the fallback", () => {
  const jp = read("client/src/panels/JobsPanel.jsx");
  const open = jp.slice(at(jp, "const openSandbox = useCallback"), at(jp, "const closeSandbox"));
  assert.match(open, /!active\?\.html \|\| entry\?\.generating \|\| entry\?\.error \|\| entry\?\.missing/);
  assert.match(open, /kbFindings\?\.length > 0/);
  assert.match(open, /Object\.keys\(entry\?\.variants \|\| \{\}\)\.length > 1/);
  assert.match(open, /openResumeEditor\(\{/);
  assert.match(open, /fallback: \(\) => setSandboxOpen\(true\)/);
  assert.match(jp, /sandboxSaveRef\.current = saveSandboxHtml;/, "the editor saves through the same call as the panel");
  assert.match(jp, /sandboxExportRef\.current = exportAndTrack;/, "and exports through the same call");
});

test("d171NoDownloadOnPreview: every attempt's résumé link opens it in draft; only PDF downloads", () => {
  for (const f of ["client/src/panels/AutoApplyPanel.jsx", "client/src/panels/AutoApplyPanelSections.jsx"]) {
    const s = read(f);
    assert.doesNotMatch(s, /artifactUrl\([^)]*"resume"\)[^>]*target="_blank"/, `${f}: no résumé link opens a PDF tab`);
    assert.ok((s.match(/<AttemptResume /g) || []).length >= 2, f);
  }
  const c = read("client/src/components/AttemptResume.jsx");
  assert.match(c, /\/resume-doc`\)/);
  assert.match(c, /openResumeEditor\(\{/);
  assert.match(c, /readOnly: !!d\.readOnly/);
  assert.match(c, /download=1/, "PDF is the download");
});

test("d157ReviewChangesFromTailoring: the lines tailoring added or rewrote, from the job's change report", () => {
  const report = { sections: [
    { type: "summary", status: "rewritten", before: "Old summary text here.", after: "New **summary** text, rewritten." },
    { type: "entries", entries: [{ status: "changed", bullets: [
      { status: "rewritten", before: "x", after: "Cut p99 latency by 35% with batched writes." },
      { status: "unchanged", before: "Same bullet as before.", after: "Same bullet as before." },
      { status: "added", before: null, after: "Owned the on-call rotation for four services." },
      { status: "removed", before: "Gone bullet that was removed.", after: null },
    ] }] },
  ] };
  assert.deepEqual(changedLines(report), ["New summary text, rewritten.", "Cut p99 latency by 35% with batched writes.", "Owned the on-call rotation for four services."]);
});

test("d171HomeResumeOpensEditor: every Home row's Résumé pane opens the résumé in draft — not only rows waiting for approval", () => {
  const s = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(s, /<AttemptResume runJobId=\{runJobOf\(node\)\} jobId=\{node\.jobId \?\? null\} sent=\{sentAlready\(node\)\}/);
  assert.match(s, /<AttemptResume recordId=\{h\.recordId \?\? null\} jobId=\{row\.jobId \?\? null\} sent/, "a history row: the copy that was sent");
  assert.match(s, /pickReady && node\.jobId != null && \(\n\s+<AttemptResume jobId=\{node\.jobId\}/, "a pick whose résumé is made");
  const c = read("client/src/components/AttemptResume.jsx");
  assert.match(c, /\/resume-doc`\)/);
  assert.match(c, /\/api\/applications\/\$\{encodeURIComponent\(recordId\)\}\/resume\?inline=1/);
  assert.match(c, /readOnly: true \}/, "the kept copy of a sent application is read-only");
});

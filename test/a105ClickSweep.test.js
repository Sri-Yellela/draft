import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import { markPending, recordSubmission } from "../services/applicationRecords.js";

// ⭐ A105 (owner 10-30: "our product is time") — the click sweep's fixes, one test per finding.

// A105 finding 3 — recording a submission keeps the job: History → Pending opens THAT row's form.
test("A105 (3) · History's 'Record the submission' opens that job's form in Pending; 'I submitted it' is on every posting", () => {
  const db = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");
  const pending = fs.readFileSync("client/src/components/PendingApplications.jsx", "utf8");
  assert.match(db, /onOpenPending=\{\(jobId\) => \{ setPendingFocus\(jobId \|\| null\); setActiveSheet\("pending"\); \}\}/);
  assert.match(db, /focusJobId=\{pendingFocus\}/);
  assert.match(pending, /const \[open, setOpen\] = useState\(focusJobId\);/);
  assert.match(pending, /scrollIntoView/);
});

// A105 finding 2 — every opened posting is Pending (O45c), so clearing is one press, not one per row.
test("A105 (2) · POST /api/applications/pending/withdraw clears many PENDING rows; a recorded one keeps its evidence", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'), (2,'eli','x')").run();
  for (const j of ["j1", "j2", "j3"]) markPending(db, 1, j, "opened_posting");
  markPending(db, 2, "j1", "opened_posting");
  recordSubmission(db, { userId: 1, jobId: "j3", input: { submittedAt: Date.now(), method: "company_site", evidenceText: "Thanks for applying" }, capturedAtsAtApply: () => null });
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  applicationRecordRoutes(app, db, (_q, _r, n) => n(), { capturedAtsAtApply: () => null });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/applications/pending/withdraw`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({})).status, 400);
    const r = await (await post({ jobIds: ["j1", "j2", "j3", "nope"] })).json();
    assert.equal(r.withdrawn, 2, "j3 is recorded — not cleared in bulk");
    const st = (u, j) => db.prepare("SELECT state FROM application_records WHERE user_id=? AND job_id=?").pluck().get(u, j);
    assert.equal(st(1, "j1"), "withdrawn");
    assert.notEqual(st(1, "j3"), "withdrawn");
    assert.equal(st(2, "j1"), "pending", "another user's row is untouched");
  } finally { server.close(); }
});

test("A105 (2) · Pending has a search, a tick per pending row, 'I did not apply (N)' and 'Dismiss N opened, not applied'", () => {
  const ui = fs.readFileSync("client/src/components/PendingApplications.jsx", "utf8");
  const db = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");
  assert.match(ui, /placeholder="Search pending…"/);
  assert.match(ui, /r\.origin === "opened_posting" && r\.state === "pending"/);
  assert.match(ui, /Dismiss \{openedOnly\.length\} opened, not applied/);
  assert.match(ui, /I did not apply \(\{pickedIds\.length\}\)/);
  assert.match(ui, /window\.confirm\(/, "a bulk clear says what it does first");
  assert.match(db, /api\("\/api\/applications\/pending\/withdraw", \{ method: "POST", body: JSON\.stringify\(\{ jobIds \}\) \}\)/);
});

// A105 finding 6 — Approve all was Review all → scroll → Approve all → Yes, inside a modal.
test("A105 (6) · Approve all sits in Draft House's Stopped header: two presses, the same server call", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  assert.match(panel, /\{applyPending\.length > 1 && \(confirmSendAll \? \(/, "only when there are two or more");
  assert.match(panel, /onClick=\{\(\) => decidePending\(applyPending\.map\(p => p\.runJobId\), true\)\.finally\(\(\) => setConfirmSendAll\(false\)\)\}/);
  assert.match(panel, /Send all \{applyPending\.length\} to their employers\?/, "the second press says what it does");
});

// A105 finding 7 — replies were recorded one row at a time, and the nudge walked the oldest only.
test("A105 (7) · History marks every unanswered application 'Still nothing' in one press, through the per-row route", () => {
  const h = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");
  assert.match(h, /const unanswered = rows\.filter\(r => r\.status === "sent" && r\.ask\);/);
  assert.match(h, /outcome: RESPONSE_OUTCOME\.NO_RESPONSE, source: "manual"/);
  assert.match(h, /Mark all \$\{unanswered\.length\} as still nothing/);
  assert.match(h, /window\.confirm\(`Mark \$\{unanswered\.length\} applications/);
});

// A105 finding 9 — sandbox edits could be lost (manual Save only) and the KB findings' Accept did nothing.
test("A105 (9) · the sandbox saves itself after an edit, guards a closing tab, and Accept applies a suggestion's fix", () => {
  const sb = fs.readFileSync("client/src/panels/SandboxPanel.jsx", "utf8");
  assert.match(sb, /const AUTOSAVE_MS = 3000;/);
  assert.match(sb, /autoSaveTimer\.current = setTimeout\(\(\) => saveRef\.current\?\.\(\), AUTOSAVE_MS\);/);
  assert.match(sb, /window\.addEventListener\("beforeunload", warn\)/);
  assert.match(sb, /const from = f\?\.diff\?\.from, to = f\?\.diff\?\.to;/);
  assert.match(sb, /t\.nodeValue = t\.nodeValue\.split\(from\)\.join\(to\)/, "the fix replaces the text on the page");
  assert.match(sb, /applyFinding\(f\) \? "accepted" : "not found in the résumé"/, "an Accept that changed nothing says so");
});

// A105 finding 5 — Profile's one Save was below Job profiles and Résumé & Signals, far from what was edited.
test("A105 (5) · Profile's Save follows the page and says when something is unsaved", () => {
  const p = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");
  assert.match(p, /data-profile-savebar="" style=\{\{[^}]*position:"sticky", bottom:0/);
  assert.match(p, /const set = \(k, v\) => \{ setUnsaved\(true\);/);
  assert.match(p, /setForm\(cleaned\);\r?\n\s+setUnsaved\(false\);/);
});

// A105 finding 11 — triaging the board was hover-and-press per job; the open posting now takes the deck's letters.
test("A105 (11) · the board's open posting: S save, D draft, P pass — never while typing, never with a modifier", () => {
  const p = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(p, /\{ s: DECISIONS\.SAVED, d: DECISIONS\.DRAFTED, p: DECISIONS\.PASSED \}\[e\.key\.toLowerCase\(\)\]/);
  assert.match(p, /closest\?\.\("input, textarea, select, \[contenteditable=''\], \[contenteditable='true'\]"\)/);
  assert.match(p, /!e\.ctrlKey && !e\.metaKey && !e\.altKey/);
  assert.match(p, /decideJobRef\.current = \(\.\.\.args\) => decideJob\(\.\.\.args\);/, "the handler reaches the current decideJob, not a stale one");
  assert.doesNotMatch(p.slice(at(p, "const decision = { s:"), at(p, "const decision = { s:") + 300), /approve|decidePending/i);
});

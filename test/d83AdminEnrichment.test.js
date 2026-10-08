// D83 BUILD 1 / 1b / 1c — Admin → Enrichment, one page of six steps (client/src/panels/adminEnrichment.jsx), with the
// split / check / join in the browser through shared/enrichmentChunks.js. Each red when removed:
//   the page loads its numbers without a click (GET /overview, on mount) · Apply is disabled until a dry run of the
//   SAME file is clean, and re-locks when the file changes · every past import has an Undo that calls the revert and
//   reloads the numbers · the source control is a dropdown of the board's real sources · no project code appears
//   outside a tooltip · a <button> for every action
//   1c: an uploaded reply with an invalid value is LISTED and refused · Join stays disabled until every piece is
//   Checked · a restored content_hash survives a model that dropped it · the browser and the CLI merge identically ·
//   no request carries a posting to a model · the text is cleaned, never truncated, and the stored posting unchanged
//   ⭐ the dry run changes NOTHING — backlog, every enrichment column and Past imports identical before and after.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { createEnrichmentRouter } from "../routes/enrichment.js";
import { buildExport, toJsonl } from "../services/jobs/enrichmentTransfer.js";
import { columnCoverage } from "../services/jobs/enrichmentSelection.js";
import {
  buildPieces, checkPiece, mergeFilled, applyGate, refusalCounts, withoutRefused, cleanPostingText, enrichmentPrompt,
} from "../shared/enrichmentChunks.js";
import { ALLOWED_VALUES } from "../shared/enrichmentRules.js";

const PAGE = fs.readFileSync("client/src/panels/adminEnrichment.jsx", "utf8");
// Comments carry the design vocabulary (D17, A76…) on purpose; the checks read the CODE: whole-line // comments,
// trailing " // …" comments and JSX {/* … */} blocks are removed.
const stripComments = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/\s.*$/gm, "");

function board(n = 5, { source = "greenhouse" } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const now = Math.floor(Date.now() / 1000);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, is_active, discovered_at, scraped_at)
    VALUES (?, 't', ?, ?, 'Acme', ?, ?, ?, 1, ?, ?)`);
  for (let i = 1; i <= n; i++) ins.run(`j${i}`, `h${i}`, `Backend Engineer ${i}`, `https://x/${i}`, i % 2 ? source : "ashby",
    `<p>Build APIs in Go and Python. Posting ${i}.</p><p>We are an equal opportunity employer and value diversity.</p>`, now, now);
  return db;
}
function mount(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, username: "admin" }; next(); });
  app.use("/api/admin/enrichment", createEnrichmentRouter(db, (_q, _s, next) => next()));
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}
const exportOf = (db) => toJsonl(buildExport(db, { candidatesOnly: true }));
const reply = (ids, enr = { skills_json: [{ skill: "Go", type: "hard" }], experience_level: "mid" }, { dropHash = false } = {}) =>
  ids.map((id) => JSON.stringify(dropHash ? { job_id: id, enrichment: enr } : { job_id: id, content_hash: "MANGLED", enrichment: enr })).join("\n");

// ── the numbers, without a click ────────────────────────────────────────────────────────────────

test("GET /overview carries the four numbers, six coverage bars, the real sources and the importer's cap", async () => {
  const db = board(5);
  const { base, stop } = mount(db);
  try {
    const o = await (await fetch(`${base}/api/admin/enrichment/overview`)).json();
    assert.equal(o.backlog, 5);
    assert.equal(o.board, 5);
    assert.deepEqual(o.groups.map((g) => g.key), ["skills", "level", "workplace", "salary", "flags", "summary"]);
    assert.ok(o.groups.every((g) => g.total === 5 && g.filled === 0));
    assert.deepEqual(o.sources.map((s) => s.value).sort(), ["ashby", "greenhouse"], "the dropdown's values are the board's own");
    assert.equal(o.importRowCap, 500, "read from the route, not restated in the client");
    assert.deepEqual(o.newPostings, { days: 7, total: 5, scored: 0 });
    assert.equal(o.imports.count, 0);
  } finally { stop(); }
});

test("the page loads its numbers on mount — no click — and never restates the cap", () => {
  assert.match(PAGE, /const load = useCallback\(\(\) => \{\s*api\("\/api\/admin\/enrichment\/overview"\)/);
  assert.match(PAGE, /useEffect\(\(\) => \{ load\(\); \}, \[load\]\);/);
  const code = stripComments(PAGE).replace(/fontWeight: 500\b|"500 [\d.]+px/g, "");     // a font weight is not the cap
  assert.doesNotMatch(code, /\b500\b/, "the 500-row cap is read from /overview, never copied");
});

// ── Apply's gate ────────────────────────────────────────────────────────────────────────────────

test("Apply unlocks only for the exact file of a clean dry run, and re-locks when the file changes", () => {
  const clean = { valid: true, wouldWrite: 3, rejected: [] };
  assert.equal(applyGate(null, "A").unlocked, false, "no dry run");
  assert.equal(applyGate({ forText: "A", plan: clean }, "A").unlocked, true);
  assert.equal(applyGate({ forText: "A", plan: clean }, "A\n").unlocked, false, "one byte differs → locked");
  assert.equal(applyGate({ forText: "A", plan: { ...clean, valid: false } }, "A").unlocked, false, "refused rows → locked");
  assert.equal(applyGate({ forText: "A", plan: { ...clean, wouldWrite: 0 } }, "A").unlocked, false, "nothing to write → locked");
  // The page wires the button to the gate, and a new file voids the dry run.
  assert.match(PAGE, /const gate = applyGate\(dry, importText\);/);
  assert.match(PAGE, /<DepthButton primary disabled=\{!gate\.unlocked \|\| !!applied\} onClick=\{\(\) => setConfirm\(true\)\}>Apply the import…/);
  const setFile = PAGE.slice(at(PAGE, "const setFile = "), at(PAGE, "// ── step 2"));
  assert.match(setFile, /setDry\(null\)/);
  assert.match(setFile, /setOverwrite\(false\); setAllowStale\(false\)/, "the expert switches reset with the file");
});

test("the projected coverage is drawn only BEFORE an apply — after it, the reloaded numbers are the after", () => {
  // Found on the 10-08 screenshots: after Apply the bars read "1.3% → 2.6%", the gain counted twice.
  assert.match(PAGE, /const projecting = Boolean\(plan\) && !applied;/);
  assert.match(PAGE, /const projectedGain = \(g\) => \(projecting \?/);
  assert.match(PAGE, /\{skillsGroup && projecting && \(/);
});

test("the confirm states exactly how many postings it writes, and that it can be undone", () => {
  assert.match(PAGE, /This writes <b>\{num\(plan\?\.wouldWrite\)\} postings<\/b>\. All or nothing\. You can undo it/);
});

// ── Undo on every past import ───────────────────────────────────────────────────────────────────

test("every past import has an Undo that runs the revert's dry run, confirms, applies the quoted count and reloads", () => {
  assert.match(PAGE, /batches\?source=import&kind=enrichment/);
  assert.match(PAGE, /<DepthButton size="compact" disabled=\{busy === "undo-plan"\} onClick=\{\(\) => askUndo\(b\)\}>Undo<\/DepthButton>/);
  assert.match(PAGE, /api\(`\/api\/admin\/enrichment\/batches\/\$\{b\.id\}\/revert`, \{ method: "POST", body: "\{\}" \}\)/);
  const doUndo = PAGE.slice(at(PAGE, "const doUndo"), at(PAGE, "// ── where the path stands"));
  assert.match(doUndo, /apply: true, expectRestorable: undoPlan\.restorable/);
  assert.match(doUndo, /load\(\)/, "the numbers update after an undo");
});

test("Past imports lists enrichment imports only — a grade import (also source 'import') is not one", async () => {
  const db = board(2);
  db.prepare(`INSERT INTO enrichment_batches (source, started_at, rows_written, kind) VALUES ('import', 1, 2, 'enrichment')`).run();
  db.prepare(`INSERT INTO enrichment_batches (source, started_at, rows_written, kind) VALUES ('import', 2, 9, 'ats_grade')`).run();
  db.prepare(`INSERT INTO enrichment_batches (source, started_at, rows_written) VALUES ('cron', 3, 4)`).run();
  const { base, stop } = mount(db);
  try {
    const b = await (await fetch(`${base}/api/admin/enrichment/batches?source=import&kind=enrichment`)).json();
    assert.deepEqual(b.batches.map((x) => x.rows_written), [2]);
    const all = await (await fetch(`${base}/api/admin/enrichment/batches`)).json();
    assert.equal(all.batches.length, 3, "unfiltered keeps the old shape");
    const o = await (await fetch(`${base}/api/admin/enrichment/overview`)).json();
    assert.equal(o.imports.count, 1);
  } finally { stop(); }
});

// ── real controls, plain words ──────────────────────────────────────────────────────────────────

test("the source control is a dropdown of the real sources — never a free-text box", () => {
  assert.match(PAGE, /<select id="enr-source" value=\{source\}/);
  assert.match(PAGE, /\(ov\?\.sources \|\| \[\]\)\.map\(\(s\) => <option key=\{s\.value\} value=\{s\.value\}>/);
  assert.doesNotMatch(PAGE, /<input[^>]*type="text"/, "no free-text input on the page");
});

test("no project code (D17, D72, A76…) appears outside a ? tooltip", () => {
  const code = stripComments(PAGE).replace(/tip="[^"]*"/g, 'tip=""').replace(/tip=\{`[^`]*`\}/g, "tip={``}");
  const hits = code.match(/\b[DAOU]\d{1,3}\b/g) || [];
  assert.deepEqual(hits, [], `project codes in the visible text: ${hits.join(", ")}`);
  assert.match(PAGE, /<Help tip="[^"]*\(design rule D17\)\."\/>/, "the code lives in the tooltip");
});

test("every action is a <button> (DepthButton or button) — no clickable div besides the dialog's scrim", () => {
  const clickables = [...stripComments(PAGE).matchAll(/<(\w+)[^<>]*?\bonClick=/g)].map((m) => m[1]);
  const notButtons = clickables.filter((t) => t !== "DepthButton" && t !== "button");
  assert.deepEqual(notButtons, ["div", "div"], "only the scrim (Escape also closes it) and the dialog's stopPropagation");
  assert.match(PAGE, /if \(e\.key === "Escape"\) onCancel\(\);/);
});

// ── 1c · pieces checked in the browser ──────────────────────────────────────────────────────────

test("a reply with an invalid value is LISTED and the piece stays unchecked; a second reply with the fix completes it", () => {
  const db = board(3);
  const { pieces } = buildPieces(exportOf(db), { size: 30 });
  assert.equal(pieces.length, 1);
  const p = pieces[0];
  const bad = [reply(["j1", "j2"]), JSON.stringify({ job_id: "j3", content_hash: "x", enrichment: { experience_level: "wizard" } })].join("\n");
  const first = checkPiece(p.text, [{ name: "r1", text: bad }]);
  assert.equal(first.checked, false);
  assert.equal(first.valid, 2);
  assert.equal(first.problems.length, 1);
  assert.equal(first.problems[0].jobId, "j3");
  assert.match(first.problems[0].why, /experience_level must be one of/);
  const second = checkPiece(p.text, [{ name: "r1", text: bad }, { name: "r2", text: reply(["j3"]) }]);
  assert.equal(second.checked, true, "the good rows were kept; the redo completed the piece");
  assert.equal(second.valid, 3);
});

test("a posting that never came back is listed, not silently dropped", () => {
  const db = board(3);
  const { pieces } = buildPieces(exportOf(db));
  const c = checkPiece(pieces[0].text, [{ name: "r", text: reply(["j1", "j2"]) }]);
  assert.equal(c.checked, false);
  assert.deepEqual(c.problems.map((x) => [x.jobId, x.why]), [["j3", "did not come back in the reply"]]);
});

test("Join stays disabled until every piece shows Checked", () => {
  assert.match(PAGE, /const allChecked = Boolean\(exp\?\.pieces\.length\) && exp\.pieces\.every\(\(p\) => p\.check\?\.checked\);/);
  assert.match(PAGE, /disabled=\{!allChecked\} onClick=\{join\}>Join the pieces/);
  assert.match(PAGE, /Unlocks when every piece shows Checked\./);
});

test("a restored content_hash survives a model that dropped it — from the EXPORT, not the reply", () => {
  const db = board(2);
  const exp = exportOf(db);
  const { pieces } = buildPieces(exp);
  const r = [{ name: "r", text: reply(["j1", "j2"], undefined, { dropHash: true }) }];
  assert.equal(checkPiece(pieces[0].text, r).checked, true);
  const { files } = mergeFilled(exp, r);
  const hashes = Object.fromEntries(exp.trim().split("\n").map((l) => JSON.parse(l)).filter((o) => o.job_id).map((o) => [o.job_id, o.content_hash]));
  for (const l of files[0].trim().split("\n")) {
    const o = JSON.parse(l);
    assert.equal(o.content_hash, hashes[o.job_id]);
    assert.equal(o.source, undefined, "source is dropped");
  }
});

test("the browser and the CLI produce the identical merged file for the same input", () => {
  const db = board(5);
  const exp = exportOf(db);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d83-"));
  try {
    const expFile = path.join(dir, "export.jsonl");
    fs.writeFileSync(expFile, exp);
    const out = path.join(dir, "chunks");
    execFileSync(process.execPath, ["scripts/enrichmentChunks.mjs", "split", expFile, "--size", "2", "--out", out], { stdio: "pipe" });
    const cliChunks = fs.readdirSync(out).filter((f) => /^chunk-\d+\.jsonl$/.test(f)).sort();
    const { pieces } = buildPieces(exp, { size: 2 });
    assert.equal(cliChunks.length, pieces.length);
    cliChunks.forEach((f, i) => assert.equal(fs.readFileSync(path.join(out, f), "utf8"), pieces[i].text, `${f} is the page's piece ${i + 1}`));
    assert.equal(fs.readFileSync(path.join(out, "PROMPT.txt"), "utf8"), enrichmentPrompt() + "\n", "the on-screen instructions ARE PROMPT.txt");
    const replies = pieces.map((p, i) => ({ name: `chunk-${String(i + 1).padStart(3, "0")}.filled.jsonl`, text: reply(p.jobIds) }));
    for (const r of replies) fs.writeFileSync(path.join(out, r.name), r.text);
    execFileSync(process.execPath, ["scripts/enrichmentChunks.mjs", "merge", expFile, out], { stdio: "pipe" });
    const browser = mergeFilled(exp, replies).files[0];
    assert.equal(fs.readFileSync(path.join(out, "import-001.jsonl"), "utf8"), browser);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the on-screen instructions carry every allowed value, read from the importer's rules", () => {
  const p = enrichmentPrompt();
  for (const vals of Object.values(ALLOWED_VALUES)) for (const v of vals) assert.ok(p.includes(v), `${v} is in the instructions`);
  assert.match(PAGE, /const prompt = enrichmentPrompt\(\);/);
  assert.match(PAGE, /Copy the instructions/);
});

test("no request carries a posting to a model: every URL on the page is /api/admin/enrichment/*, and no key is asked for", () => {
  const urls = [...PAGE.matchAll(/(?:api|fetch)\(\s*[`"]([^`"]+)[`"]/g)].map((m) => m[1]);
  assert.ok(urls.length >= 5);
  for (const u of urls) assert.match(u, /^\/api\/admin\/enrichment\//, u);
  const code = stripComments(PAGE);
  assert.doesNotMatch(code, /anthropic|openai|apiKey|api_key|x-api-key|https?:\/\//i);
  assert.doesNotMatch(code, /type="password"/, "nothing on the page asks for a key");
  for (const f of ["shared/enrichmentChunks.js", "shared/enrichmentRules.js"]) {
    assert.doesNotMatch(stripComments(fs.readFileSync(f, "utf8")), /\bfetch\(|XMLHttpRequest|from ["']node:|https?:\/\//, `${f} is pure`);
  }
});

// ── Clean the text ──────────────────────────────────────────────────────────────────────────────

test("Clean the text removes HTML and boilerplate, keeps pay / eligibility / workplace, and never truncates", () => {
  const intro = "<p>" + "Acme builds rockets for everyone. ".repeat(150) + "</p>";        // ~5,000 characters before the role
  const raw = `${intro}<h3>Requirements</h3><ul><li>5+ years of Go</li><li>Kubernetes in production</li></ul>` +
    `<p>The base pay range is $150,000 - $190,000.</p><p>We are unable to sponsor a visa for this role.</p>` +
    `<p>This role is hybrid, three days in our NYC office.</p>` +
    `<p>Acme is an equal opportunity employer. We consider applicants without regard to race, religion or age.</p>` +
    `<ul><li>401(k) matching</li><li>Health, dental and vision insurance</li></ul>`;
  const { text, removedParagraphs, removed } = cleanPostingText(raw);
  assert.equal(removed.length, removedParagraphs, "what was left out is listed, for audit");
  assert.ok(removed.some((p) => /equal opportunity/i.test(p)));
  assert.doesNotMatch(text, /<[a-z]/i, "no HTML");
  for (const keep of ["5+ years of Go", "Kubernetes in production", "$150,000 - $190,000", "unable to sponsor a visa", "hybrid, three days"]) {
    assert.ok(text.includes(keep), `kept: ${keep}`);
  }
  assert.doesNotMatch(text, /equal opportunity|401\(k\)|dental/i, "boilerplate removed");
  assert.ok(removedParagraphs >= 3);
  assert.ok(text.indexOf("Kubernetes") > 4000, "requirements after a long introduction survive — nothing is cut at a length");
  // ⛔ A boilerplate paragraph that ALSO states pay or eligibility is kept whole — those are columns the model fills.
  const mixed = cleanPostingText("<p>Acme is an equal opportunity employer. We cannot sponsor a visa for this role.</p>" +
    "<p>Benefits: 401(k), dental, and a salary of $140,000 per year.</p>").text;
  assert.match(mixed, /cannot sponsor a visa/);
  assert.match(mixed, /\$140,000/);
  // Entity-escaped HTML (Greenhouse) is decoded and cleaned the same way.
  assert.equal(cleanPostingText("&lt;p&gt;Write Rust &amp;amp; C&lt;/p&gt;").text, "Write Rust & C");
});

test("pieces hold a CLEANED copy; job_id and content_hash are the export's, and the stored posting is unchanged", () => {
  const db = board(2);
  const before = db.prepare("SELECT job_id, description, content_hash FROM scraped_jobs ORDER BY job_id").all();
  const exp = exportOf(db);
  const { pieces, removedParagraphs } = buildPieces(exp, { clean: true });
  assert.equal(removedParagraphs, 2, "the equal-opportunity paragraph left each copy");
  const expRows = exp.trim().split("\n").map((l) => JSON.parse(l)).filter((o) => o.job_id);
  pieces[0].text.trim().split("\n").map((l) => JSON.parse(l)).forEach((o, i) => {
    assert.equal(o.job_id, expRows[i].job_id);
    assert.equal(o.content_hash, expRows[i].content_hash);
    assert.doesNotMatch(o.source.description, /<p>|equal opportunity/);
    assert.match(o.source.description, /Build APIs in Go and Python/);
  });
  assert.deepEqual(db.prepare("SELECT job_id, description, content_hash FROM scraped_jobs ORDER BY job_id").all(), before);
  assert.match(buildPieces(exp, { clean: false }).pieces[0].text, /equal opportunity/, "clean off leaves the text as stored");
});

// ── the dry run, read for the page ──────────────────────────────────────────────────────────────

test("refusals are counted per reason in plain words, and can be taken out into the redo file", () => {
  const rejected = [{ line: 2, kind: "stale" }, { line: 3, kind: "stale" }, { line: 5, kind: "invalid_value" }];
  assert.deepEqual(refusalCounts(rejected), [
    { kind: "stale", count: 2, words: "the posting changed since you exported" },
    { kind: "invalid_value", count: 1, words: "a value that isn't allowed" },
  ]);
  const { text, refused } = withoutRefused("a\nb\nc\nd\ne\n", rejected);
  assert.equal(text, "a\nd\n");
  assert.equal(refused, "b\nc\ne\n");
});

test("⭐ the dry run changes NOTHING: backlog, every enrichment column and Past imports are identical before and after", async () => {
  const db = board(4);
  const exp = exportOf(db);
  const { pieces } = buildPieces(exp);
  const file = mergeFilled(exp, [{ name: "r", text: reply(pieces[0].jobIds) }]).files[0];
  const { base, stop } = mount(db);
  try {
    const snap = async () => ({
      overview: await (await fetch(`${base}/api/admin/enrichment/overview`)).json(),
      cols: columnCoverage(db),
      rows: db.prepare("SELECT * FROM scraped_jobs ORDER BY job_id").all(),
      batches: db.prepare("SELECT COUNT(*) n FROM enrichment_batches").get().n,
    });
    const before = await snap();
    const r = await fetch(`${base}/api/admin/enrichment/import`, { method: "POST", headers: { "content-type": "application/x-ndjson" }, body: file });
    const dry = await r.json();
    assert.equal(dry.dryRun, true);
    assert.equal(dry.plan.matched, 4);
    assert.equal(dry.plan.wouldWrite, 4);
    assert.equal(dry.plan.valid, true);
    assert.deepEqual(await snap(), before);
  } finally { stop(); }
});

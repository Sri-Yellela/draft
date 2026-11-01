// D84 — what the first rehearsal (20 postings, 10-09) exposed. Each red when removed.
// F1 · the export never cuts the middle: the FULL text (description_full, migration 150) is stored at the crawl, the
// export sends it cleaned and capped from the END at 12,000 characters, no "[…]" ever, a row with only cut text is
// held back; pay that sat in the cut middle is exported; a row filled from cut text is PARTIAL — it stays in the
// backlog, its skills_json may be replaced, and the flag reverts with the batch; pieces carry no header noise.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { buildExport, toJsonl, planImport, applyImport } from "../services/jobs/enrichmentTransfer.js";
import { selectCandidates, computeContentHash } from "../services/jobs/enrichmentSelection.js";
import { revertBatch } from "../services/jobs/enrichmentBatches.js";
import { at } from "../test-support/sourceAnchors.js";
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from "../services/jobs/htmlToText.js";
import { normalizeJob } from "../services/jobs/schema.js";
import { exportPostingText, buildPieces, mergeFilled, EXPORT_TEXT_CAP } from "../shared/enrichmentChunks.js";

// A DoorDash-shaped posting: a long introduction, the requirements, the pay in the MIDDLE, then a long trailer —
// the shape the 5,000-character head + tail cap cut (the owner's export lost DoorDash's 107,400–158,000).
const INTRO = "<p>" + "DoorDash builds the logistics layer for local commerce. ".repeat(60) + "</p>";
const REQS = "<h3>What you'll need</h3><ul><li>5+ years building distributed systems in Go or Kotlin</li><li>Kafka and Cassandra at scale</li></ul>";
const PAY = "<p>The base salary range for this role is $107,400 - $158,000 per year.</p>";
const TRAILER = "<p>" + "We are committed to growing and empowering a more inclusive community within our company. ".repeat(40) + "</p>";
const LONG_HTML = INTRO + REQS + PAY + TRAILER;

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
function insert(db, { id, description, description_full = null, enriched_at = null, partial = 0 }) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, description_full,
      is_active, discovered_at, scraped_at, enriched_at, content_hash, enrichment_partial)
    VALUES (?, 't', ?, 'Software Engineer', 'DoorDash', ?, 'greenhouse', ?, ?, 1, ?, ?, ?, ?, ?)`)
    .run(id, id, `https://x/${id}`, description, description_full, now, now, enriched_at,
      enriched_at ? computeContentHash("Software Engineer", description) : null, partial);
}
const capped = (html) => htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH });

test("the cap the crawl applies really cuts the middle — the pay is gone from the stored description", () => {
  const stored = capped(LONG_HTML);
  assert.ok(stored.includes("[…]"));
  assert.ok(!stored.includes("$107,400"), "the fixture reproduces the defect");
  assert.ok(fullDescriptionText(null, LONG_HTML).includes("$107,400"), "the full text keeps it");
});

test("normalizeJob keeps the full text ONLY when the capped description was cut", () => {
  const base = { id: "1", title: "SWE", company: "DoorDash", url: "https://x", source: "greenhouse" };
  const cut = normalizeJob({ ...base, description: capped(LONG_HTML), description_full: fullDescriptionText(null, LONG_HTML) });
  assert.ok(cut.description_full.includes("$107,400"));
  const short = normalizeJob({ ...base, description: "Build APIs.", description_full: "Build APIs." });
  assert.equal(short.description_full, null, "no second copy of a whole text");
});

test("a row with pay in the cut middle EXPORTS its pay and requirements — and no export contains […]", () => {
  const db = board();
  insert(db, { id: "dd", description: capped(LONG_HTML), description_full: fullDescriptionText(null, LONG_HTML) });
  const out = toJsonl(buildExport(db));
  assert.ok(out.includes("$107,400 - $158,000"), "the pay travels");
  assert.ok(out.includes("Kafka and Cassandra"), "the requirements travel");
  assert.ok(!out.includes("[…]"), "never the elision marker");
  const row = JSON.parse(out.trim().split("\n")[1]);
  assert.equal(row.truncated, false);
  assert.ok(row.chars_sent > 0 && row.chars_sent === row.chars_total);
  assert.equal(row.content_hash, computeContentHash("Software Engineer", capped(LONG_HTML)), "the hash stays the STORED text's");
});

test("a row whose only text is cut is HELD BACK (counted), never exported with a gap", () => {
  const db = board();
  insert(db, { id: "cut", description: capped(LONG_HTML) });
  insert(db, { id: "whole", description: "Build APIs in Go. Pay: $150,000 - $190,000." });
  const { rows, meta } = buildExport(db);
  assert.deepEqual(rows.map((r) => r.job_id), ["whole"]);
  assert.equal(meta.heldForFullText, 1);
});

test("the 12,000 cap drops whole paragraphs from the END, never the middle, and says so", () => {
  const paras = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} about the role: ` + "x".repeat(400));
  const t = exportPostingText(paras.join("\n\n"));
  assert.ok(t.text.length <= EXPORT_TEXT_CAP);
  assert.equal(t.truncated, true);
  assert.ok(t.text.startsWith("Paragraph 0"), "the head is kept");
  const kept = t.text.split("\n\n").map((p) => Number(p.match(/Paragraph (\d+)/)[1]));
  assert.deepEqual(kept, kept.map((_, i) => i), "a contiguous head — nothing taken from the middle");
  assert.equal(t.chars_total > t.chars_sent, true);
  assert.equal(exportPostingText("half a posting\n[…]\nthe end"), null, "old cut text is refused");
});

test("pieces carry no export header: no _meta, no stored_content_hash, no char counts; truncated only when true", () => {
  const db = board();
  insert(db, { id: "dd", description: capped(LONG_HTML), description_full: fullDescriptionText(null, LONG_HTML) });
  const { pieces } = buildPieces(toJsonl(buildExport(db)));
  assert.doesNotMatch(pieces[0].text, /_meta|stored_content_hash|chars_sent|chars_total|"truncated"/);
});

test("a row filled from CUT text is partial: it stays in the backlog, the next import may replace its skills, and the flag reverts", () => {
  const db = board();
  insert(db, { id: "p", description: "Build APIs in Go.", description_full: null });
  const exp = toJsonl(buildExport(db)).replace('"truncated":false', '"truncated":true');
  const fill = (skills) => mergeFilled(exp, [{ name: "r", text: JSON.stringify({ job_id: "p", content_hash: "x",
    enrichment: { skills_json: skills, experience_level: "mid" } }) }]).files[0];
  const first = fill([{ skill: "Go", type: "hard" }]);
  assert.match(first, /"truncated":true/, "the join carries the flag into the import");
  assert.equal(applyImport(db, first).ok, true);
  assert.equal(db.prepare("SELECT enrichment_partial FROM scraped_jobs WHERE job_id='p'").get().enrichment_partial, 1);
  assert.deepEqual(selectCandidates(db).candidates.map((r) => r.job_id), ["p"], "a partial row is still in the backlog");

  // The full text arrives; the next import is complete and replaces skills_json (and only that) without OVERWRITE.
  const second = fill([{ skill: "Go", type: "hard" }, { skill: "Kafka", type: "hard" }]).replace(',"truncated":true', "");
  const plan = planImport(db, second);
  assert.equal(plan.perColumn.skills_json, 1);
  assert.equal(plan.perColumn.experience_level, undefined, "an imported value is not replaced without OVERWRITE");
  const res = applyImport(db, second);
  const row = db.prepare("SELECT skills_json, enrichment_partial FROM scraped_jobs WHERE job_id='p'").get();
  assert.match(row.skills_json, /Kafka/);
  assert.equal(row.enrichment_partial, 0);
  assert.deepEqual(selectCandidates(db).candidates, [], "complete → out of the backlog");
  revertBatch(db, res.batchId);
  assert.equal(db.prepare("SELECT enrichment_partial FROM scraped_jobs WHERE job_id='p'").get().enrichment_partial, 1, "undo restores partial");
});

test("migration 150 marks the rows a live import already filled from cut text as partial", () => {
  const db = board();
  insert(db, { id: "a", description: capped(LONG_HTML), enriched_at: 100 });
  insert(db, { id: "b", description: "Whole text.", enriched_at: 100 });
  const b = db.prepare("INSERT INTO enrichment_batches (source, started_at) VALUES ('import', 1)").run().lastInsertRowid;
  for (const id of ["a", "b"]) db.prepare("INSERT INTO enrichment_batch_rows (batch_id, job_id, before_json, written_at) VALUES (?, ?, '{}', 1)").run(b, id);
  const sql = MIGRATIONS.find((m) => m.id === "150_description_full").sql;
  db.exec(sql.slice(at(sql, "UPDATE scraped_jobs")));
  assert.deepEqual(db.prepare("SELECT job_id FROM scraped_jobs WHERE enrichment_partial = 1").all().map((r) => r.job_id), ["a"]);
});

// ── F2 · crawler placeholders are not enrichment ───────────────────────────────────────────────────────────────────
import { backfillProvenance, isPlaceholder } from "../services/jobs/enrichmentProvenance.js";
import { levelFromTitle, LEVEL_RULES } from "../shared/levelMapping.js";
import { enrichmentPrompt } from "../shared/enrichmentChunks.js";

test("ONE level mapping: Staff / Principal are lead in the crawler AND in the prompt", () => {
  const job = (title) => normalizeJob({ id: "1", title, company: "Acme", url: "https://x", source: "greenhouse", description: "x" });
  for (const t of ["Staff Software Engineer", "Principal Engineer", "Engineering Manager", "Director, Platform"]) {
    assert.equal(job(t).experience_level, "lead", t);
  }
  assert.equal(job("Senior Software Engineer").experience_level, "senior");
  assert.equal(job("VP, Engineering").experience_level, "executive");
  assert.equal(job("Software Engineer II").experience_level, "mid");
  assert.equal(job("New Grad Software Engineer").experience_level, "entry");
  assert.equal(levelFromTitle("Software Engineer"), null, "a title that says nothing has no level of its own");
  const prompt = enrichmentPrompt();
  for (const rule of LEVEL_RULES) assert.ok(prompt.includes(rule), `the prompt states: ${rule}`);
});

test("the crawl records provenance on insert: guesses are placeholders, the board's own location is stated", () => {
  const j = normalizeJob({ id: "1", title: "Staff Engineer", company: "Acme", url: "https://x", source: "greenhouse",
    location: "Remote - US", description: "ABOUT US. We build things." });
  const map = JSON.parse(j.enrichment_provenance);
  assert.equal(map.summary, "crawler_fallback");
  assert.equal(map.normalized_title, "crawler_fallback");
  assert.equal(map.experience_level, "crawler_fallback");
  assert.equal(map.workplace_type, "board_location");
});

test("a crawler_fallback summary is REPLACED on import; an import value is NOT (without OVERWRITE)", () => {
  const db = board();
  const description = "ABOUT US. " + "We build logistics software. ".repeat(20);
  insert(db, { id: "s", description });
  db.prepare("UPDATE scraped_jobs SET summary = ?, normalized_title = 'software engineer', experience_level = 'mid', enrichment_provenance = ? WHERE job_id = 's'")
    .run(description.trim().slice(0, 300), JSON.stringify({ summary: "crawler_fallback", normalized_title: "crawler_fallback", experience_level: "crawler_fallback" }));
  const line = (enr) => JSON.stringify({ job_id: "s", content_hash: computeContentHash("Software Engineer", description), enrichment: enr });
  const plan = planImport(db, line({ summary: "Builds logistics software.", experience_level: "senior" }));
  assert.equal(plan.perColumn.summary, 1, "the placeholder summary counts as empty");
  assert.equal(plan.columns.summary.replacingPlaceholder, 1);
  assert.equal(plan.columns.summary.alreadyFilled, 0, "a placeholder is not 'already filled'");
  applyImport(db, line({ summary: "Builds logistics software.", experience_level: "senior" }));
  const map = JSON.parse(db.prepare("SELECT enrichment_provenance FROM scraped_jobs WHERE job_id='s'").get().enrichment_provenance);
  assert.equal(map.summary, "import");
  assert.equal(map.experience_level, "import");
  const again = planImport(db, line({ summary: "Something else.", experience_level: "lead" }));
  assert.equal(again.perColumn.summary, undefined, "an imported summary is never replaced without OVERWRITE");
  assert.equal(again.columns.summary.alreadyFilled, 1);
  assert.equal(planImport(db, line({ summary: "Something else." }), { overwrite: true }).perColumn.summary, 1);
});

test("the boot backfill detects placeholders, keeps what an import wrote, and re-maps a guessed Staff level", () => {
  const db = board();
  const description = "ABOUT US. " + "We build logistics software. ".repeat(20);
  insert(db, { id: "a", description });
  insert(db, { id: "b", description });
  db.prepare("UPDATE scraped_jobs SET title = 'Staff Software Engineer', summary = ?, experience_level = 'senior', enrichment_provenance = NULL WHERE job_id = 'a'")
    .run(description.trim().slice(0, 300));
  db.prepare("UPDATE scraped_jobs SET title = 'Staff Software Engineer', summary = 'Imported summary.', experience_level = 'senior', enrichment_provenance = NULL WHERE job_id = 'b'").run();
  const batch = db.prepare("INSERT INTO enrichment_batches (source, started_at) VALUES ('import', 1)").run().lastInsertRowid;
  db.prepare("INSERT INTO enrichment_batch_rows (batch_id, job_id, before_json, filled_json, written_at) VALUES (?, 'b', '{}', ?, 1)")
    .run(batch, JSON.stringify({ filled: ["summary", "experience_level"], corrected: [] }));
  const res = backfillProvenance(db);
  assert.equal(res.written, 2);
  const row = (id) => db.prepare("SELECT experience_level, enrichment_provenance FROM scraped_jobs WHERE job_id = ?").get(id);
  assert.equal(JSON.parse(row("a").enrichment_provenance).summary, "crawler_fallback");
  assert.equal(row("a").experience_level, "lead", "the crawl's OWN guess is re-mapped");
  assert.equal(JSON.parse(row("b").enrichment_provenance).summary, "import", "an import's record beats detection");
  assert.equal(row("b").experience_level, "senior", "an imported level is never touched");
  assert.equal(backfillProvenance(db).written, 0, "NULL-only: a no-op on the next boot");
});

test("without a map, the importer detects per row — and an import's own record still wins", () => {
  const description = "ABOUT US. We build things.";
  const row = { title: "Software Engineer", description, summary: description.slice(0, 300), enrichment_provenance: null };
  assert.equal(isPlaceholder(row, "summary"), true);
  assert.equal(isPlaceholder(row, "summary", new Set(["summary"])), false);
});

// ── F5 · F13 · F14 — the dry run per column, the notes channel, one batch / one download / one upload ───────────────
import fs from "node:fs";
import { checkPiece, parseNote, notesCsv, matchReplies, zipStore, pieceFileName, PIECE_SIZES, DEFAULT_PIECE_SIZE, NOTE_CODES } from "../shared/enrichmentChunks.js";
import { IMPORT_ROW_CAP } from "../shared/enrichmentRules.js";
const PAGE = fs.readFileSync("client/src/panels/adminEnrichment.jsx", "utf8");

test("F5: the dry run lists per-column counts — already filled · in the file · would be written · replacing a placeholder", () => {
  const db = board();
  insert(db, { id: "c", description: "Build APIs in Go." });
  db.prepare("UPDATE scraped_jobs SET experience_level = 'senior', enrichment_provenance = ? WHERE job_id = 'c'").run(JSON.stringify({ experience_level: "import" }));
  const line = JSON.stringify({ job_id: "c", content_hash: computeContentHash("Software Engineer", "Build APIs in Go."),
    enrichment: { skills_json: ["Go"], experience_level: "mid" } });
  const { columns } = planImport(db, line);
  assert.deepEqual(columns.skills_json, { alreadyFilled: 0, supplied: 1, wouldWrite: 1, replacingPlaceholder: 0 });
  assert.deepEqual(columns.experience_level, { alreadyFilled: 1, supplied: 1, wouldWrite: 0, replacingPlaceholder: 0 });
  assert.match(PAGE, /Object\.entries\(plan\.columns\)\.filter\(\(\[, c\]\) => c\.supplied > 0\)/, "the page shows the table");
  assert.match(PAGE, /Replacing a placeholder/);
});

test("F13: a #NOTE line is COLLECTED, not rejected as unreadable — and an unknown code is kept as ODD", () => {
  const piece = JSON.stringify({ job_id: "j1", content_hash: "h", source: { title: "SWE", description: "x" } }) + "\n";
  const reply = JSON.stringify({ job_id: "j1", content_hash: "h", enrichment: { skills_json: ["Go"] } }) +
    "\n#NOTE j1 PAY-FORMAT pay given as 'competitive' only\n#NOTE j1 WEIRD something odd\n";
  const c = checkPiece(piece, [{ name: "piece-01.reply.jsonl", text: reply }]);
  assert.equal(c.checked, true);
  assert.equal(c.junkLines, 0, "a note is not an unreadable line");
  assert.deepEqual(c.notes.map((n) => n.code), ["PAY-FORMAT", "ODD"]);
  assert.equal(parseNote("#NOTE j9 TRUNCATED " + "w ".repeat(40)).text.split(" ").length, 20, "at most 20 words");
  assert.match(notesCsv(c.notes), /^job_id,code,note,file\n"j1","PAY-FORMAT"/);
  for (const code of NOTE_CODES) assert.ok(PAGE.includes("NOTE_CODES") && code, code);
  assert.match(PAGE, /Things the model flagged/);
});

test("F14: replies are matched to pieces BY NAME — a stray name or two replies for one piece is reported, never guessed", () => {
  const files = [{ name: "piece-01.reply.jsonl", text: "a" }, { name: "piece-02-of-03.filled.jsonl", text: "b" },
    { name: "piece-03 (1).jsonl", text: "c" }, { name: "piece-3.jsonl", text: "d" }, { name: "answers.jsonl", text: "e" },
    { name: "piece-09.jsonl", text: "f" }];
  const { assigned, unmatched, duplicates } = matchReplies([1, 2, 3], files);
  assert.deepEqual([...assigned.keys()].sort(), [1, 2]);
  assert.deepEqual(unmatched, ["answers.jsonl", "piece-09.jsonl"]);
  assert.deepEqual(duplicates, [{ piece: 3, names: ["piece-03 (1).jsonl", "piece-3.jsonl"] }]);
  assert.equal(pieceFileName(7, 24), "piece-07-of-24.jsonl");
});

test("F14: one .zip of every piece — a valid archive (local headers, central directory, CRCs)", () => {
  const files = [{ name: "piece-01-of-02.jsonl", text: '{"a":1}\n' }, { name: "piece-02-of-02.jsonl", text: "é — ü\n" }];
  const z = Buffer.from(zipStore(files));
  const eocd = z.length - 22;
  assert.equal(z.readUInt32LE(eocd), 0x06054b50);
  assert.equal(z.readUInt16LE(eocd + 10), 2, "two entries");
  let at = z.readUInt32LE(eocd + 16);
  for (const f of files) {
    assert.equal(z.readUInt32LE(at), 0x02014b50);
    const size = z.readUInt32LE(at + 20), nameLen = z.readUInt16LE(at + 28), local = z.readUInt32LE(at + 42);
    assert.equal(z.slice(at + 46, at + 46 + nameLen).toString(), f.name);
    const data = z.slice(local + 30 + nameLen, local + 30 + nameLen + size).toString();
    assert.equal(data, f.text);
    at += 46 + nameLen;
  }
});

test("F14: the batch is 2,000; the piece size is a setting (20 · 50 · 100, default 20) that governs only the chat", () => {
  assert.equal(IMPORT_ROW_CAP, 2000);
  assert.deepEqual(PIECE_SIZES, [20, 50, 100]);
  assert.equal(DEFAULT_PIECE_SIZE, 20);
  assert.match(PAGE, /<select id="enr-piece" value=\{pieceSize\}/);
  assert.match(PAGE, /Download all pieces \(\.zip\)/);
  assert.match(PAGE, /<input type="file" multiple/);
  assert.match(PAGE, /Upload all the replies/);
  assert.match(PAGE, /matchReplies\(exp\.pieces\.map\(\(p\) => p\.n\), files\)/);
  assert.doesNotMatch(PAGE, /Clean the text/, "cleaning is the export's job now, always on");
});

// ── P2 · F3 the pay parser · F7 identical text once · F8 not what the board will drop ──────────────────────────────
import { payFromText } from "../services/jobs/payFromText.js";
import { deriveDescriptionColumns, backfillDescriptionText } from "../services/jobs/descriptionText.js";
import { upsertCanonicalJob, reconcileFingerprint } from "../services/jobs/aggregator.js";

test("F3: every pay fixture from the rehearsal parses — and the negatives do not", () => {
  const cases = [
    ["Annual salary range: $180,000- $240,000", 180000, 240000],
    ["Annual salary range:  $180,000-$240,000 USD", 180000, 240000],
    ["Salary range: $110,000 - $140,000", 110000, 140000],
    ["Salary range: $190,000 $250,000 + performance-based bonus", 190000, 250000],
    ["Salary range: $180,000 $260,000 Base Salary + performance-based bonus", 180000, 260000],
    ["$187,500 - 220,000 USD", 187500, 220000],
    ["$187,500 - $220,000 USD base salary", 187500, 220000],
  ];
  for (const [text, lo, hi] of cases) {
    const p = payFromText(text);
    assert.ok(p, `parses: ${text}`);
    assert.deepEqual([p.salary_min, p.salary_max, p.salary_currency, p.salary_period], [lo, hi, "USD", "annual"], text);
  }
  for (const neg of ["401k contributions and 4% match", "We grew revenue from $10,000,000 to $50,000,000", "a team of 200 - 400 engineers"]) {
    assert.equal(payFromText(neg), null, `not pay: ${neg}`);
  }
});

test("F3: the description pass reads pay from the FULL text — the pay the cap cut out is found", () => {
  const stored = capped(LONG_HTML);
  assert.equal(deriveDescriptionColumns(stored).pay_text_min_usd, null, "the cut text has no pay");
  assert.equal(deriveDescriptionColumns(stored, fullDescriptionText(null, LONG_HTML)).pay_text_min_usd, 107400);
});

test("F3: a crawl that brings the full text re-queues the posting for the description pass", () => {
  const db = board();
  const verdict = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };
  const crawl = (description_full) => {
    const canonical = { title: "Software Engineer", company: "DoorDash", location: "US", source: "greenhouse",
      url: "https://boards.greenhouse.io/doordash/jobs/1", description: capped(LONG_HTML), description_full };
    const dedup = reconcileFingerprint(db, { id: "q", ...canonical });
    upsertCanonicalJob(db, { jobId: "q", canonical, verdict, contentHash: "h", searchQuery: "s", sourceLabel: "", matchedBy: "t", dedup, now: 1 });
  };
  crawl(null);                                           // before the deploy: only the cut text
  backfillDescriptionText(db, { dryRun: false });
  assert.equal(db.prepare("SELECT pay_text_min_usd FROM scraped_jobs WHERE job_id='q'").get().pay_text_min_usd, null);
  crawl(fullDescriptionText(null, LONG_HTML));           // the next crawl stores the full text
  assert.equal(db.prepare("SELECT description_basis FROM scraped_jobs WHERE job_id='q'").get().description_basis, null, "the upsert cleared the basis");
  backfillDescriptionText(db, { dryRun: false });
  assert.equal(db.prepare("SELECT pay_text_min_usd FROM scraped_jobs WHERE job_id='q'").get().pay_text_min_usd, 107400);
  crawl(fullDescriptionText(null, LONG_HTML));           // an unchanged re-crawl keeps the basis
  assert.notEqual(db.prepare("SELECT description_basis FROM scraped_jobs WHERE job_id='q'").get().description_basis, null);
});

test("F7: identical text exports ONCE and the import writes it to every row that shares it", () => {
  const db = board();
  for (const id of ["x1", "x2", "x3"]) insert(db, { id, description: "Build APIs in Go. Pay: $150,000 - $190,000." });
  insert(db, { id: "y", description: "A different role entirely." });
  const { rows, meta } = buildExport(db);
  assert.equal(rows.length, 2, "one representative per distinct text");
  assert.equal(meta.dedupedRows, 2);
  const rep = rows.find((r) => r.applies_to);
  assert.deepEqual(rep.applies_to.map((m) => m.job_id).sort(), ["x1", "x2", "x3"].filter((id) => id !== rep.job_id).sort());
  const exp = toJsonl({ rows, meta });
  assert.doesNotMatch(buildPieces(exp).pieces[0].text, /applies_to/, "the model never sees it");
  const file = mergeFilled(exp, rows.map((r) => ({ name: "r", text: JSON.stringify({ job_id: r.job_id, content_hash: "x",
    enrichment: { skills_json: ["Go"] } }) }))).files[0];
  assert.match(file, /applies_to/, "the join restores it");
  const res = applyImport(db, file);
  assert.equal(res.written, 4, "three identical rows and the other one");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE skills_json IS NOT NULL").get().n, 4);
});

test("F7: a sibling whose text is NOT identical is refused, never guessed", () => {
  const db = board();
  insert(db, { id: "a", description: "Same text." });
  insert(db, { id: "b", description: "Different text." });
  const line = JSON.stringify({ job_id: "a", content_hash: computeContentHash("Software Engineer", "Same text."),
    applies_to: [{ job_id: "b", content_hash: computeContentHash("Software Engineer", "Different text.") }], enrichment: { skills_json: ["Go"] } });
  const plan = planImport(db, line);
  assert.equal(plan.valid, false);
  assert.equal(plan.rejected[0].kind, "not_identical");
});

test("F8: the backlog and the export leave out what the enforced policy will retire; unscored rows come first", () => {
  const db = board();
  db.prepare("INSERT OR REPLACE INTO board_policy (id, age_limit_days, age_enforce, scope_enforce) VALUES (1, 120, 1, 1)").run();
  insert(db, { id: "new", description: "Build APIs in Go." });
  insert(db, { id: "scored", description: "Build services in Rust." });
  insert(db, { id: "old", description: "Build APIs in Python." });
  db.prepare("UPDATE scraped_jobs SET posted_at = '2026-01-01T00:00:00Z' WHERE job_id = 'old'").run();
  insert(db, { id: "sales", description: "Sell our product to enterprises." });
  // D126 + D127 (11-01, changed on purpose): an account executive is IN now (sales); a support engineer is held.
  db.prepare("UPDATE scraped_jobs SET title = 'Support Engineer' WHERE job_id = 'sales'").run();
  db.prepare("UPDATE scraped_jobs SET discovered_at = discovered_at + 100 WHERE job_id = 'scored'").run();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u', 'x')").run();
  db.prepare("INSERT INTO ats_only_reports (user_id, job_id, ats_report, ats_score) VALUES (1, 'scored', '{}', 80)").run();
  const { rows, meta } = buildExport(db);
  assert.deepEqual(rows.map((r) => r.job_id), ["new", "scored"], "the unscored row first, even though 'scored' is newer");
  assert.deepEqual(meta.retiringExcluded, { aged: 1, outOfScope: 1 });
});

// ── P3 · F6 canonical skill names ──────────────────────────────────────────────────────────────────────────────────
import { canonicalSkill, SKILL_GROUPS } from "../shared/skillAliases.js";

test("F6: aliases map to the vocabulary's canonical form; the import merges duplicates and lists unknown terms", () => {
  const vocab = new Map([["postgresql", "PostgreSQL"], ["gcp", "GCP"], ["kubernetes", "Kubernetes"]]);
  assert.equal(canonicalSkill("Postgres", vocab).name, "PostgreSQL");
  assert.equal(canonicalSkill("k8s", vocab).name, "Kubernetes");
  assert.equal(canonicalSkill("Google Cloud Platform", vocab).name, "GCP", "the vocabulary's own form wins");
  assert.deepEqual(canonicalSkill("Zapier", vocab), { name: "Zapier", known: false, aliased: false });
  const seen = new Set();
  for (const g of SKILL_GROUPS) for (const n of g) { assert.ok(!seen.has(n.toLowerCase()), `${n} is in one group only`); seen.add(n.toLowerCase()); }

  const db = board();
  insert(db, { id: "k", description: "Build APIs." });
  const line = JSON.stringify({ job_id: "k", content_hash: computeContentHash("Software Engineer", "Build APIs."),
    enrichment: { skills_json: [{ skill: "Postgres", type: "hard" }, { skill: "PostgreSQL", type: "hard" }, { skill: "K8s", type: "hard" },
      { skill: "Zapierish Tooling", type: "hard" }] } });
  const plan = planImport(db, line);
  assert.ok(plan.skillsAliased >= 2);
  assert.deepEqual(plan.unknownSkills, [{ skill: "Zapierish Tooling", count: 1 }]);
  applyImport(db, line);
  const skills = JSON.parse(db.prepare("SELECT skills_json FROM scraped_jobs WHERE job_id = 'k'").get().skills_json).map((s) => s.skill);
  assert.deepEqual(skills, ["PostgreSQL", "Kubernetes", "Zapierish Tooling"], "canonical, merged, the unknown kept as given");
  assert.match(enrichmentPrompt(), /PostgreSQL \(not Postgres\)/, "the prompt asks for canonical names");
});

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

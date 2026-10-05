#!/usr/bin/env node
/**
 * AL3 (G1) — propose SKILL EQUIVALENCES from the corpus, offline. ⛔ Under D17 it makes NO model call.
 *
 * THE MEASURED CEILING THIS ATTACKS. AK1's worst ATS inversion was -19 ranks: a reliability role
 * whose JD said "log analysis" where the résumé said "observability tooling". AK1 called that "a
 * ceiling on the approach, not a bug" — the scorer matches terms, and two names for one skill are
 * two terms.
 *
 * ── IT READS THE CORPUS VOCABULARY, NOT THE JOB DESCRIPTIONS ───────────────────────────────────
 *
 * The batches are built from `scraped_jobs.skills_json` — the per-posting skill terms the scorer
 * itself matches on (services/atsTermWeights.js builds its weights from the same column). Pairs for
 * words the scorer never sees could not move rho however good they were. Provenance survives: which
 * postings support a pair is recovered exactly, from which postings carry the terms.
 *
 * ── EXPORT → OWNER → IMPORT (D17, A80 V10) ─────────────────────────────────────────────────────
 *
 * Until 10-05 `--propose` sent each batch of 60 terms to Haiku (purpose skill_synonyms — 36 calls
 * on 09-04). D17 confines model calls to résumé generation, so that step now happens OUTSIDE the
 * product: `--export` writes the same batches and the same rules as JSONL, the owner fills each
 * line's `pairs`, and `--import` validates the file and records the pairs. The guards are in
 * services/kb/synonymTransfer.js: invalid value, a tampered batch, a term the batch did not contain,
 * a duplicate batch, a term that left the corpus — any one refuses the whole file. Re-importing the
 * same file changes nothing.
 *
 * ⛔ IT STILL PROMOTES NOTHING. Every imported pair lands as 'proposed'. A false equivalence is a
 * confidently wrong match that shifts every score on the board in the same direction, invisibly, so
 * promotion is a human act — `--review` writes the sheet, `--confirm`/`--reject` record the
 * decision, and a rejection is sticky. Corroboration orders the queue and never promotes.
 *
 * Usage (point --db at a COPY unless you mean to change the developer database):
 *   node scripts/al3SkillSynonyms.mjs --export FILE.jsonl [--corpus SNAPSHOT.db] [--batches N]
 *   (fill each line's "pairs" outside the product)
 *   node scripts/al3SkillSynonyms.mjs --import FILE.jsonl [--corpus SNAPSHOT.db] [--allow-stale]   # dry run
 *   node scripts/al3SkillSynonyms.mjs --import FILE.jsonl --apply
 *   node scripts/al3SkillSynonyms.mjs --review                     # write the review sheet
 *   node scripts/al3SkillSynonyms.mjs --confirm "k8s|kubernetes"   # promote (repeatable)
 *   node scripts/al3SkillSynonyms.mjs --reject  "kubernetes|docker"
 *   node scripts/al3SkillSynonyms.mjs --stats
 * Every command takes --db PATH (default data/resume_master.db).
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listProposals, listConfirmed, confirmSynonym, rejectSynonym, synonymStats,
} from "../services/kb/skillSynonyms.js";
import {
  MIN_DF, BATCH, corpusVocabulary as vocabularyOfRows, vocabularyTerms, buildSynonymExport,
  parseJsonl, planSynonymImport, applySynonymImport,
} from "../services/kb/synonymTransfer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET = path.join(__dirname, "..", "docs", "al3-skill-synonym-review.md");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const DB_PATH = val("--db") || path.join(__dirname, "..", "data", "resume_master.db");

const db = new Database(DB_PATH);

/**
 * ⛔ THE LIVE BOARD IS NOT THE CORPUS ANY MORE, AND THAT IS NOT A BUG IN THIS SCRIPT.
 *
 * `cleanup_log` id 85 deleted **1288 postings** in a single retention run (server.js deletes rows
 * whose `scraped_at` is older than the cutoff and which are neither applied nor starred).
 * `scraped_jobs` now holds **5** rows — fixtures — while every derived table still describes the
 * board that produced them: 8690 company_technographics rows, 856 ats_term_weights, 697
 * company_org_units, 1302 enrich_job usage events.
 *
 * So a corpus pass run against the live database silently produces a table built from SEVEN
 * DISTINCT TERMS and reports success. That is Shape 3 in an asset generator — the output would be
 * empty for a reason nobody would see, and the synonym table would simply never earn its rho.
 *
 * Hence: the corpus is CHECKED, the count is PRINTED, and too small is a hard refusal naming the
 * backups. `--corpus <path>` reads any snapshot READ-ONLY; proposals are still written to the live
 * database, because the table is the asset and the corpus is only evidence.
 */
const MIN_CORPUS_POSTINGS = 200;

function openCorpus() {
  const explicit = val("--corpus");
  if (explicit) {
    console.log(`[al3] corpus: ${explicit} (read-only)`);
    return new Database(explicit, { readonly: true });
  }
  const n = db.prepare("SELECT COUNT(*) c FROM scraped_jobs WHERE is_active=1").get().c;
  if (n >= MIN_CORPUS_POSTINGS) return db;

  const backups = path.join(__dirname, "..", "data", "backups");
  const candidates = fs.existsSync(backups)
    ? fs.readdirSync(backups).filter(f => f.endsWith(".db")).sort().reverse()
    : [];
  console.error(
    `\n⛔ THE LIVE BOARD HAS ONLY ${n} ACTIVE POSTINGS — that is not a corpus.\n\n` +
    `   A retention run (cleanup_log id 85) deleted 1288 rows from scraped_jobs. The derived\n` +
    `   tables still describe the old board (8690 technographics, 856 term weights), so every\n` +
    `   doc's "1291 postings" is still true of the EVIDENCE and no longer true of this table.\n\n` +
    `   Running anyway would build a synonym table from a handful of terms and report success.\n\n` +
    (candidates.length
      ? `   Point at a snapshot instead — the newest has the full board:\n\n` +
        `       node scripts/al3SkillSynonyms.mjs --export FILE.jsonl --corpus data/backups/${candidates[0]}\n`
      : `   No backups found in data/backups.\n`)
  );
  process.exit(2);
}

function corpusVocabulary(corpus) {
  const rows = corpus.prepare(`
    SELECT job_id, skills_json FROM scraped_jobs
    WHERE is_active = 1 AND skills_json IS NOT NULL AND skills_json != '' AND skills_json != '[]'
  `).all();
  return vocabularyOfRows(rows);
}

function requireTable() {
  try {
    db.prepare("SELECT 1 FROM skill_synonyms LIMIT 1").get();
  } catch {
    console.error(`\n⛔ skill_synonyms DOES NOT EXIST in ${DB_PATH}. Migration 098 has not been applied.\n` +
      `   Start the server once against it (it migrates at boot), or run the CLI migration runner.\n`);
    process.exit(2);
  }
}

function exportBatches(out) {
  requireTable();
  const corpus = openCorpus();
  const { postingsByTerm, corpusSize } = corpusVocabulary(corpus);
  const terms = vocabularyTerms(postingsByTerm, MIN_DF);
  const maxBatches = Number(val("--batches", "0")) || Infinity;
  const lines = buildSynonymExport(terms, { batchSize: BATCH, maxBatches });
  fs.writeFileSync(out, lines.map(l => JSON.stringify(l)).join("\n") + "\n");
  console.log(`[al3] corpus: ${corpusSize} active postings with skills, ${postingsByTerm.size} distinct terms`);
  console.log(`[al3] vocabulary at df>=${MIN_DF}: ${terms.length} terms -> ${lines.length - 1} batches of ${BATCH}`);
  console.log(`[al3] wrote ${out}. Fill each line's "pairs" (the rules are on line 1), then:`);
  console.log(`      node scripts/al3SkillSynonyms.mjs --import ${out}            (dry run)`);
}

function importBatches(file) {
  requireTable();
  const corpus = openCorpus();
  const { postingsByTerm } = corpusVocabulary(corpus);
  const parsed = parseJsonl(fs.readFileSync(file, "utf8"));
  const opts = { allowStale: has("--allow-stale") };
  const apply = has("--apply");
  const res = apply ? applySynonymImport(db, parsed, postingsByTerm, opts) : planSynonymImport(db, parsed, postingsByTerm, opts);
  console.log(`[al3] ${res.batches} batches, ${res.pairs} distinct pairs: ${res.pairs - res.unchanged - res.alreadyReviewed} new or reinforced, ` +
    `${res.unchanged} unchanged, ${res.alreadyReviewed} already decided by a person (left alone)`);
  if (!res.ok) {
    console.error(`\n⛔ REFUSED — ${res.problems.length} problem(s); nothing was written:`);
    for (const p of res.problems) console.error(`   line ${p.lineNo}  ${p.code.padEnd(15)} ${p.detail}`);
    process.exit(2);
  }
  if (!apply) { console.log("DRY RUN — nothing written. Add --apply to record these as 'proposed'."); return; }
  if (res.written) {
    console.log(`[al3] recorded: ${res.written.inserted} new, ${res.written.reinforced} reinforced`);
  }
  console.log(`[al3] status: ${JSON.stringify(synonymStats(db))}`);
  console.log("NOTHING IS LIVE YET. Every row is 'proposed' and the scorer reads only 'confirmed'.");
  console.log("Next: node scripts/al3SkillSynonyms.mjs --review");
}

function writeReviewSheet() {
  const proposals = listProposals(db);
  const confirmed = listConfirmed(db);
  const line = (p) => `| \`${p.term}\` | \`${p.equivalent}\` | ${p.relation} | ${p.corroborationCount} | ${p.confidence.toFixed(2)} | | |`;
  const md = `# AL3 (G1) — skill synonym review sheet

Generated ${new Date().toISOString()} from \`skill_synonyms\`.

**${proposals.length} pairs await a decision. ${confirmed.length} are already confirmed and live.**

⛔ **Nothing here is affecting any score.** The scorer reads only \`status='confirmed'\` rows. A
false equivalence is a confidently wrong match — it does not merely inflate a number, it tells a
candidate they have a skill they do not have, and it shifts every posting mentioning either term in
the same direction at once. That is why corroboration cannot promote a row here, unlike
\`company_org_units\`: more postings using both words is not evidence that the words mean the same
thing.

## How to read a row

**\`alias\`** claims the two are the same thing under different names — interchangeable in any
sentence. These are usually obvious and usually right.

**\`related\`** claims they are different but close enough to credit. **This is where the rho comes
from and where the false matches come from.** Judge it by asking: *if a résumé says only the
right-hand term, is it honest to tell the candidate they match a posting asking for the left-hand
one?* If that is arguable, reject — a missed pair costs far less than a false one.

Confirm or reject with:

\`\`\`
node scripts/al3SkillSynonyms.mjs --confirm "term|equivalent"
node scripts/al3SkillSynonyms.mjs --reject  "term|equivalent"
\`\`\`

A rejection is **sticky**: later extraction passes will not resurrect it.

## Proposed

| term | equivalent | relation | postings | confidence | ✅/❌ | note |
|---|---|---|---|---|---|---|
${proposals.map(line).join("\n") || "| _(none)_ | | | | | | |"}

## Already confirmed — live in the scorer

| term | equivalent | relation | reviewed by |
|---|---|---|---|
${confirmed.map(p => `| \`${p.term}\` | \`${p.equivalent}\` | ${p.relation} | ${p.reviewedBy || "—"} |`).join("\n") || "| _(none)_ | | | |"}
`;
  fs.writeFileSync(SHEET, md);
  console.log(`review sheet -> ${path.relative(path.join(__dirname, ".."), SHEET)}`);
  console.log(`${proposals.length} proposed, ${confirmed.length} confirmed`);
}

// ── dispatch ────────────────────────────────────────────────────────────────
if (has("--stats")) {
  console.log(JSON.stringify(synonymStats(db), null, 2));
} else if (has("--confirm") || has("--reject")) {
  const act = has("--confirm") ? confirmSynonym : rejectSynonym;
  const flag = has("--confirm") ? "--confirm" : "--reject";
  let n = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== flag) continue;
    const [a, b] = String(args[i + 1] || "").split("|");
    if (a && b && act(db, a.trim(), b.trim())) { n++; console.log(`${flag} ${a.trim()} | ${b.trim()}`); }
    else console.warn(`no such proposed pair: ${args[i + 1]}`);
  }
  console.log(`${n} updated. status: ${JSON.stringify(synonymStats(db))}`);
} else if (has("--review")) {
  writeReviewSheet();
} else if (has("--export")) {
  const out = val("--export");
  if (!out) { console.error("--export FILE"); process.exit(1); }
  exportBatches(out);
} else if (has("--import")) {
  const file = val("--import");
  if (!file) { console.error("--import FILE"); process.exit(1); }
  importBatches(file);
} else if (has("--propose")) {
  console.error("--propose is retired (D17, A80 V10): it sent the vocabulary to a model. Use --export, fill the pairs, then --import.");
  process.exit(1);
} else {
  console.log("one of --export FILE | --import FILE [--apply] | --review | --confirm a|b | --reject a|b | --stats");
  process.exit(1);
}
db.close();

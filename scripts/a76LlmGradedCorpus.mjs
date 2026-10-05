#!/usr/bin/env node
/**
 * A76 — A LARGER GRADED CORPUS, THEN RE-TUNE. ⛔ Under D17 (owner, 10-03) it makes NO model call.
 *
 * Today's evidence for the ATS number is 30 postings graded by one person (ρ 0.746; 0.723 and 24
 * postings after the US filter) — too thin to justify DISPLAYING a number (A75). This samples a larger
 * set against the same profile and has it graded BLIND, outside the product:
 *
 *   EXPORT → the owner grades the file (by hand, or with any external tool) → IMPORT → REPORT.
 *
 * Until 10-03 this script graded through the Anthropic API (`--grade`). It stopped at 71 / 230 when
 * the credit ran out, and D17 then ruled that only résumé generation may call a model. The `--grade`
 * path is REMOVED; the 71 grades it produced are carried over (`--carry-over`) with their provenance.
 * The grades reuse the enrichment manual path (services/jobs/atsGradeTransfer.js): the same JSONL
 * shape, staleness interlock, all-or-nothing refusal, batch provenance and dry-run revert.
 *
 * ⛔ A GRADE FROM ANYONE BUT THE OWNER IS A PROXY, NOT GROUND TRUTH. The owner's 30 are in every
 * export (unlabelled) so each grader's agreement with the owner is measured before any figure built on
 * that grader is trusted. The real ground truth is still `job_applications` (D15).
 *
 * Usage (always against a COPY of the board — pending migrations are applied to it):
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> --export <out.jsonl> [--n 200] [--seed 76] [--include-graded]
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> --carry-over [--apply]
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> --import <graded.jsonl> --grader <name> [--apply] [--overwrite] [--allow-stale]
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> --revert <batchId> [--apply]
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> [--report] [--out <report.json>]
 *   node scripts/a76LlmGradedCorpus.mjs --db <copy> --resume-out <path OUTSIDE the repo>   (the base résumé, for the grader)
 *
 * Without --apply, --carry-over / --import / --revert are DRY RUNS. Excluded from verify:harness: it
 * needs a real profile.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";
import { MIGRATIONS } from "./migrations.js";
import { applyPendingMigrations } from "./applyMigrations.js";
import { revertBatch, revertPreview } from "../services/jobs/enrichmentBatches.js";
import { computeContentHash } from "../services/jobs/enrichmentSelection.js";
import {
  stratifiedSample, buildGradeExport, toGradeJsonl, planGradeImport, applyGradeImport, formatGradePlan,
  loadGrades, analyzeGrades, GRADE_FILE_KIND,
} from "../services/jobs/atsGradeTransfer.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const has = (f) => args.includes(f);

const CORPUS = "a76";
const LEGACY = path.join(ROOT, "docs", "a76-llm-graded-corpus.json");   // the 10-03 API grades (history)
const HUMAN = path.join(ROOT, "docs", "am1-ats-graded-corpus.json");
const PROFILE_ID = 6;          // the profile the owner's 30 were graded against
const N = Number(val("--n", "200"));
const SEED = Number(val("--seed", "76"));
const LEGACY_GRADER = "model:claude-sonnet-5 (10-03, API, pre-D17)";

if (has("--grade")) {
  console.error("⛔ --grade is removed (D17, 10-03: only résumé generation may call a model).\n" +
    "   Export the sample (--export), grade it outside the product, and --import the file.");
  process.exit(6);
}

const dbPath = val("--db");
if (!dbPath) { console.error("⛔ --db <path> is required — point it at a COPY of the board, never production."); process.exit(2); }
const db = new Database(dbPath);
const applied = applyPendingMigrations(db, MIGRATIONS);
if (applied) console.log(`(applied ${applied} pending migration(s) to ${dbPath})`);

const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(PROFILE_ID);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(PROFILE_ID)?.content;
if (!profile || !resumeText) { console.error(`⛔ profile ${PROFILE_ID} or its base résumé is not in ${dbPath}.`); process.exit(3); }

if (val("--resume-out")) {
  const out = path.resolve(val("--resume-out"));
  if (out.startsWith(ROOT + path.sep)) { console.error("⛔ --resume-out must be OUTSIDE the repository — the résumé is personal."); process.exit(7); }
  fs.writeFileSync(out, resumeText);
  console.log(`wrote the base résumé of profile ${PROFILE_ID} to ${out} (${resumeText.length} chars) — keep it out of the repo`);
  process.exit(0);
}

const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });
const runtimeBasis = buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile });
const synonyms = loadConfirmedSynonyms(db);
const score = (job) => {
  const s = scoreAtsLocally({ job, runtimeBasis, termWeights: loadTermWeights(db, roleFamilyForTitle(job.title)), synonyms }).score;
  return Number.isFinite(s) ? s : null;      // a declined score is null, never NaN and never 0
};

// The owner's 30 are read from the pinned fixture — the text the owner graded, and what the engine
// scored for every figure quoted so far. Everything else is the board's current text.
const human = JSON.parse(fs.readFileSync(HUMAN, "utf8")).postings;
const humanById = new Map(human.map(p => [p.job_id, p]));
const boardQ = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?");
const postingFor = (jobId) => humanById.get(jobId) ?? boardQ.get(jobId) ?? null;

function sample() {
  const rows = db.prepare(`SELECT job_id, company, title, description, skills_json, normalized_title, experience_level,
                                  workplace_type, location, source, source_platform, category, url, scraped_at
                           FROM scraped_jobs WHERE is_active = 1 AND length(description) > 400`).all()
    .filter(r => !humanById.has(r.job_id));
  return stratifiedSample(rows, score, { n: N, seed: SEED });
}

// ── export ────────────────────────────────────────────────────────────────────────────────────────
if (val("--export")) {
  const out = path.resolve(val("--export"));
  const drawn = sample();
  const graded = new Set(db.prepare("SELECT job_id FROM ats_corpus_grades WHERE corpus = ?").all(CORPUS).map(r => r.job_id));
  // The owner's 30 are ALWAYS exported: a grader's agreement with the owner is the only thing that
  // says whether its grades can stand in for the owner's. Already-graded SAMPLE postings are left out
  // unless --include-graded (the 10-03 model grades stand for them, carried over with provenance).
  const sampleRows = has("--include-graded") ? drawn : drawn.filter(r => !graded.has(r.job_id));
  const postings = [...human, ...sampleRows];
  const file = buildGradeExport(postings, { corpus: CORPUS, profileId: PROFILE_ID, seed: SEED,
    note: `${human.length} reference postings + ${sampleRows.length} sampled (n=${N}, seed=${SEED}); ` +
          `${drawn.length - sampleRows.length} already-graded sample postings ${has("--include-graded") ? "INCLUDED" : "left out"}` });
  const text = toGradeJsonl(file);           // computed before the file is opened
  fs.writeFileSync(out, text);
  console.log(`exported ${file.rows.length} postings (blind) to ${out}\n  ${file.meta.note}`);
  process.exit(0);
}

// ── carry-over: the 71 grades of the 10-03 API run, through the same importer ────────────────────
if (has("--carry-over")) {
  const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));
  const rows = legacy.postings.map(p => {
    const post = postingFor(p.job_id);
    return { job_id: p.job_id, content_hash: post ? computeContentHash(post.title, post.description) : null, grade: { fit: p.llm_fit, note: null } };
  });
  const text = toGradeJsonl({ rows, meta: { kind: GRADE_FILE_KIND, corpus: CORPUS, profile_id: PROFILE_ID,
    note: `carried over from docs/a76-llm-graded-corpus.json — graded 10-03 by ${legacy.grader} through the API, ` +
          "before D17; content_hash taken at carry-over (the text was not hashed when graded)" } });
  importText(text, { grader: LEGACY_GRADER, notes: "A76 carry-over — the 10-03 API grades (pre-D17)" });
  process.exit(0);
}

// ── import ────────────────────────────────────────────────────────────────────────────────────────
if (val("--import")) {
  const grader = val("--grader");
  if (!grader) { console.error("⛔ --grader <name> is required (who graded this file — e.g. owner, chatgpt-free)."); process.exit(8); }
  importText(fs.readFileSync(path.resolve(val("--import")), "utf8"), { grader });
  process.exit(0);
}
function importText(text, { grader, notes = null }) {
  const opts = { corpus: CORPUS, grader, resolve: postingFor, overwrite: has("--overwrite"), allowStale: has("--allow-stale"), notes };
  const plan = planGradeImport(db, text, opts);
  console.log(formatGradePlan(plan));
  if (!has("--apply")) { console.log("\n(dry run — pass --apply to write)"); return; }
  const r = applyGradeImport(db, text, opts);
  if (!r.ok) { console.error(`\n⛔ ${r.reason}`); process.exitCode = 9; return; }
  console.log(`\nwrote ${r.written} grade(s)${r.batchId != null ? ` — batch ${r.batchId}; undo with --revert ${r.batchId}` : ""}`);
}

// ── revert ────────────────────────────────────────────────────────────────────────────────────────
if (val("--revert")) {
  const id = Number(val("--revert"));
  const p = revertPreview(db, id);
  if (!p) { console.error(`⛔ no batch ${id}`); process.exit(10); }
  console.log(`batch ${id}${p.kind ? ` (${p.kind})` : ""}: ${p.restorable} restorable, ${p.missing} missing, ${p.changedSince} changed since${p.alreadyReverted ? " — ALREADY REVERTED" : ""}`);
  for (const x of (p.pairs ?? p.sample).slice(0, 20)) console.log(`  ${x.jobId}${x.grader ? `  ${x.grader}` : ""}${"now" in x ? `  now ${x.now} → restores to ${x.restoresTo ?? "(no grade)"}${x.changedSince ? "  ⚠ changed since" : ""}` : ""}`);
  if (!has("--apply")) { console.log("\n(dry run — pass --apply to revert)"); process.exit(0); }
  const r = revertBatch(db, id);
  if (!r.ok) { console.error(`⛔ ${r.reason}`); process.exit(11); }
  console.log(`reverted: ${r.restored} restored, ${r.missing} missing`);
  process.exit(0);
}

// ── report — zero model calls ─────────────────────────────────────────────────────────────────────
const { fresh, stale } = loadGrades(db, CORPUS, postingFor);
if (!fresh.length) { console.log(`Nothing graded in corpus ${CORPUS} yet${stale.length ? ` (${stale.length} stale)` : ""}. --carry-over, or --export then --import.`); process.exit(0); }
const ids = [...new Set(fresh.map(g => g.job_id))];
const postings = ids.map(id => {
  const h = humanById.get(id);
  const p = postingFor(id);
  return { job_id: id, set: h ? "owner30" : "sample", engine: p ? score(p) : null, human_fit: h?.human_fit };
});
for (const h of human) if (!ids.includes(h.job_id)) postings.push({ job_id: h.job_id, set: "owner30", engine: score(h), human_fit: h.human_fit });
const report = analyzeGrades(postings, fresh, ATS_BAND_CUTPOINTS);
report.stale_grades_excluded = stale.length;
const f = (s) => s ? `n=${String(s.n).padStart(3)}  ρ ${s.rho.toFixed(3)}  τ-b ${s.tau_b.toFixed(3)}  mis-ordered ${(100 * s.misordered).toFixed(1)}%` : "—";
console.log("─".repeat(100));
console.log(`engine vs OWNER (the original 30)                 ${f(report.engine_vs_owner_30)}`);
for (const [g, r] of Object.entries(report.graders)) {
  console.log(`\ngrader: ${g} — ${r.graded} graded, engine declined ${r.engine_declined} (excluded, not counted as 0)`);
  if (r.grader_vs_owner_30) console.log(`  grader vs OWNER (the proxy check)               ${f(r.grader_vs_owner_30)}  exact ${r.grader_vs_owner_30.exact}, within one ${r.grader_vs_owner_30.within_one}`);
  console.log(`  engine vs grader (all scored)                   ${f(r.engine_vs_grader_all)}`);
  console.log(`  engine vs grader (sample only)                  ${f(r.engine_vs_grader_sample)}`);
  if (r.cutpoints) console.log(`  cutpoints ${ATS_BAND_CUTPOINTS.strong}/${ATS_BAND_CUTPOINTS.moderate} κ ${r.cutpoints.current_kappa} · best in-sample ${r.cutpoints.best_in_sample.strong}/${r.cutpoints.best_in_sample.moderate} κ ${r.cutpoints.best_in_sample.kappa} · held out: fit on even → ${r.cutpoints.held_out.strong}/${r.cutpoints.held_out.moderate}, on odd κ ${r.cutpoints.held_out.kappa_odd} vs current ${r.cutpoints.held_out.current_kappa_odd}`);
  console.log(`  fit distribution 1..5: ${r.fit_distribution.join(" / ")}`);
}
if (stale.length) console.log(`\n⚠ ${stale.length} grade(s) excluded as stale — the posting's text changed since it was graded`);
if (val("--out")) {
  const next = JSON.stringify({ generated_at: new Date().toISOString(), corpus: CORPUS, profile_id: PROFILE_ID, ...report }, null, 2) + "\n";
  fs.writeFileSync(path.resolve(val("--out")), next);
}

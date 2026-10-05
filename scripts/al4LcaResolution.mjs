#!/usr/bin/env node
/**
 * AL4 (G2) — resolve the LCA companies the matcher declined to match.
 *
 * ── WHAT IS ACTUALLY UNRESOLVED, and it is not what the task assumed ───────────────────────────
 *
 * The task described the gap as "legal-entity vs brand mismatches — META PLATFORMS, INC. vs Meta,
 * subsidiaries, DBAs". Measured, that is not it: tier A already strips legal suffixes and tier B
 * already reads d/b/a fields, so those cases match today. The six unresolved rows split cleanly:
 *
 *   3 UNMATCHED  Bolt Farm Treehouse · Epia Neuro · Physical Superintelligence
 *                ZERO candidate employers out of 144,584. There is nothing to resolve TO. A model
 *                asked to resolve these can only invent one, and an invented match here is a
 *                sponsorship claim about a company that has never filed.
 *   3 AMBIGUOUS  Linear · Mercury · Ramp
 *                Real candidates the matcher refuses to choose between. This is the ONLY place
 *                outside knowledge can help, so it is the only place this script asks.
 *
 * ⛔ SO IT DOES NOT ASK ABOUT UNMATCHED COMPANIES AT ALL. Not a cost saving — a correctness one.
 *
 * ── "NONE OF THESE" IS A FIRST-CLASS ANSWER ────────────────────────────────────────────────────
 *
 * Linear is the case that shaped this. The corpus contains "Linear Labs LLC", an electric-motor
 * company, and lcaMatch.js's header records that an earlier candidate-set check attributed it to
 * Linear.app — which has never filed an LCA. The prompt therefore offers "none" explicitly and says
 * it is the expected answer when nothing fits, because a model asked to pick from a list will pick
 * from the list.
 *
 * ── EXPORT → OWNER → IMPORT (D17, A80 V11) ─────────────────────────────────────────────────────
 *
 * Until 10-05 `--propose` asked Haiku (purpose lca_company_resolution — 3 calls on 09-05). D17
 * confines model calls to résumé generation, so the question now goes to the owner as a file:
 * `--export` writes one line per AMBIGUOUS company with its candidate employers and the rules
 * below; the owner fills `answer`; `--import` validates it (services/kb/lcaResolutionTransfer.js:
 * invalid value, an unknown or no-longer-ambiguous company, a tampered or stale candidate list, an
 * employer that is not a candidate, a duplicate — any one refuses the whole file) and records it.
 * The grader's name is required and kept with every answer.
 *
 * Nothing imported here reaches the matcher. `--confirm` does, and only after a person reads it.
 *
 * Usage (point --db at a COPY unless you mean to change the developer database):
 *   node scripts/al4LcaResolution.mjs --export FILE.jsonl
 *   (fill each line's "answer" outside the product)
 *   node scripts/al4LcaResolution.mjs --import FILE.jsonl --grader NAME            # dry run
 *   node scripts/al4LcaResolution.mjs --import FILE.jsonl --grader NAME --apply
 *   node scripts/al4LcaResolution.mjs --review
 *   node scripts/al4LcaResolution.mjs --confirm "Ramp"      (repeatable)
 *   node scripts/al4LcaResolution.mjs --reject  "Linear"
 *   node scripts/al4LcaResolution.mjs --rate                # the match rate, before/after
 * Every command takes --db PATH (default data/resume_master.db).
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listResolutionProposals, confirmResolution, rejectResolution,
  resolutionStats, RESOLUTION_CONFIDENCE,
} from "../services/kb/lcaResolution.js";
import { buildLcaExport, planLcaImport, applyLcaImport } from "../services/kb/lcaResolutionTransfer.js";
import { parseJsonl } from "../services/kb/synonymTransfer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const DB_PATH = val("--db") || path.join(__dirname, "..", "data", "resume_master.db");

const db = new Database(DB_PATH);

function unresolved() {
  return db.prepare(`
    SELECT company, match_status, match_reason, matched_entities_json, candidate_count
    FROM company_lca_sponsorship WHERE match_status != 'matched' ORDER BY company
  `).all();
}

/** Every LCA employer whose name shares the brand's first token — the real candidate set. */
function candidatesFor(company) {
  const token = String(company).toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  if (!token) return [];
  return db.prepare(`
    SELECT employer_name, SUM(certified) certified, COUNT(DISTINCT fiscal_period) periods
    FROM lca_employer_periods
    WHERE LOWER(employer_name) LIKE ?
    GROUP BY employer_name ORDER BY certified DESC LIMIT 25
  `).all(`${token}%`);
}

// The rules the model was given, unchanged in substance — now addressed to whoever fills the file.
const RULES = `A job board lists each company below. US Department of Labor H-1B (LCA) filings
are recorded against LEGAL ENTITY names. Each line gives every LCA employer whose name begins with the
same word as the company.

For each line: which ONE of its candidates, if any, is the legal entity of that company?

⛔ READ BEFORE ANSWERING:
- "none" is a REAL and often CORRECT answer. Many well-known companies have never filed an LCA at
  all, and a similarly-named company appearing in this list is not evidence that they have.
- Companies that merely share a word are DIFFERENT COMPANIES. "Linear Labs LLC" makes electric
  motors and is not the software company Linear. "Mercury Insurance Services" is not the fintech
  Mercury. Answering with one of those would tell a job seeker that a company sponsors visas when
  it does not — a false statement about a third party who cannot correct it.
- Answer "none" unless you specifically know this legal entity IS this company.

Fill "answer" as {"employer_name": "<exact name from candidates, or null for none>",
"confidence": <0.0-1.0 or null>, "reason": "<one sentence — required, also for none>"}.
Leave a line's answer empty (null and "") to skip it for now. Change nothing else on the line.`;

/** The ambiguous companies, with their candidates — and the ones skipped, said out loud. */
function askable({ quiet = false } = {}) {
  const rows = unresolved();
  // ⛔ AMBIGUOUS ONLY. See the header: an unmatched company has no candidates, so there is nothing
  // to resolve and the only possible answer is an invented one.
  const ambiguous = rows.filter(r => r.match_status === "ambiguous");
  const skipped = rows.filter(r => r.match_status !== "ambiguous");
  if (!quiet) {
    console.log(`[al4] unresolved: ${rows.length}  (${ambiguous.length} ambiguous, ${skipped.length} unmatched)`);
    for (const s of skipped) {
      console.log(`      skipping ${s.company} — ${s.match_status}: no candidate entities exist, so there is nothing to resolve`);
    }
  }
  return ambiguous
    .map(r => ({ company: r.company, candidates: candidatesFor(r.company).map(c => ({ name: c.employer_name, certified: c.certified, periods: c.periods })) }))
    .filter(a => a.candidates.length);
}

function exportResolutions(out) {
  const list = askable();
  const lines = buildLcaExport(list, RULES);
  fs.writeFileSync(out, lines.map(l => JSON.stringify(l)).join("\n") + "\n");
  console.log(`[al4] wrote ${list.length} companies to ${out}. Fill each "answer", then:`);
  console.log(`      node scripts/al4LcaResolution.mjs --import ${out} --grader NAME   (dry run)`);
}

function importResolutions(file) {
  const current = new Map(askable({ quiet: true }).map(a => [a.company, a.candidates]));
  const parsed = parseJsonl(fs.readFileSync(file, "utf8"));
  const opts = { grader: val("--grader") };
  const apply = has("--apply");
  const lookup = (c) => current.get(c) || null;
  const res = apply ? applyLcaImport(db, parsed, lookup, opts) : planLcaImport(db, parsed, lookup, opts);
  console.log(`[al4] ${res.lines} companies: ${res.proposals.length} to record, ${res.unchanged} unchanged, ` +
    `${res.unanswered} not answered yet, ${res.alreadyReviewed} already decided by a person (left alone)`);
  for (const p of res.proposals) console.log(`  ${p.company.padEnd(12)} -> ${p.resolvedEmployerName || "none"}`);
  if (!res.ok) {
    console.error(`\n⛔ REFUSED — ${res.problems.length} problem(s); nothing was written:`);
    for (const p of res.problems) console.error(`   line ${p.lineNo}  ${p.code.padEnd(18)} ${p.detail}`);
    process.exit(2);
  }
  if (!apply) { console.log("DRY RUN — nothing written. Add --apply to record these as 'proposed'."); return; }
  console.log(`[al4] recorded ${res.written}. status: ${JSON.stringify(resolutionStats(db))}`);
  console.log("NOTHING IS LIVE. Confirm with --confirm \"<Company>\" after reading --review.");
}

function review() {
  const props = listResolutionProposals(db);
  if (!props.length) { console.log("no proposals awaiting review."); return; }
  console.log(`${props.length} awaiting review. A wrong confirmation is a false sponsorship claim`);
  console.log(`about a third party, so confirm only what you can verify independently.\n`);
  for (const p of props) {
    const cands = JSON.parse(p.candidates_json || "[]");
    console.log(`── ${p.company}`);
    console.log(`   proposed : ${p.resolved_employer_name || "NONE OF THESE"}`);
    console.log(`   model    : confidence ${p.model_confidence ?? "?"} — ${p.model_reason || ""}`);
    console.log(`   chose from ${cands.length}: ${cands.slice(0, 6).map(c => `${c.name} (${c.certified})`).join(" | ")}`);
    console.log(`   confirm  : node scripts/al4LcaResolution.mjs --confirm "${p.company}"`);
    console.log("");
  }
  console.log(`A confirmed resolution enters the matcher as TIER R at confidence ${RESOLUTION_CONFIDENCE} —`);
  console.log(`above the presentable floor (0.60) so it can be shown, below the high-confidence line`);
  console.log(`(0.80) so the surface NAMES the matched legal entity instead of asserting a bare count.`);
}

function rate() {
  const rows = db.prepare("SELECT match_status, match_tier, COUNT(*) n FROM company_lca_sponsorship GROUP BY match_status, match_tier").all();
  const total = db.prepare("SELECT COUNT(*) n FROM company_lca_sponsorship").get().n;
  const matched = rows.filter(r => r.match_status === "matched").reduce((a, r) => a + r.n, 0);
  console.log(`match rate: ${matched}/${total} = ${((matched / total) * 100).toFixed(1)}%`);
  for (const r of rows) console.log(`  ${r.match_status.padEnd(10)} ${(r.match_tier || "-").padEnd(3)} ${r.n}`);
  const unmatchedNoCandidates = db.prepare(`
    SELECT COUNT(*) n FROM company_lca_sponsorship WHERE match_status='unmatched'
  `).get().n;
  console.log(`\nOf the unmatched, ${unmatchedNoCandidates} have ZERO candidate employers in the corpus.`);
  console.log(`Those are not resolution failures — they are companies with no LCA filings, and`);
  console.log(`"no evidence of sponsorship" is the correct answer for them.`);
}

if (has("--export")) {
  const out = val("--export");
  if (!out) { console.error("--export FILE"); process.exit(1); }
  exportResolutions(out);
} else if (has("--import")) {
  const f = val("--import");
  if (!f) { console.error("--import FILE --grader NAME"); process.exit(1); }
  importResolutions(f);
} else if (has("--propose")) {
  console.error("--propose is retired (D17, A80 V11): it asked a model. Use --export, fill the answers, then --import.");
  process.exit(1);
}
else if (has("--review")) review();
else if (has("--rate")) rate();
else if (has("--confirm") || has("--reject")) {
  const act = has("--confirm") ? confirmResolution : rejectResolution;
  const flag = has("--confirm") ? "--confirm" : "--reject";
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== flag) continue;
    const c = args[i + 1];
    console.log(c && act(db, c) ? `${flag} ${c}` : `no proposal for "${c}"`);
  }
  console.log(`status: ${JSON.stringify(resolutionStats(db))}`);
  console.log("Re-run the LCA rollup for a confirmation to take effect in company_lca_sponsorship.");
} else {
  console.log("one of --export FILE | --import FILE --grader NAME [--apply] | --review | --confirm <Company> | --reject <Company> | --rate");
  process.exit(1);
}
db.close();

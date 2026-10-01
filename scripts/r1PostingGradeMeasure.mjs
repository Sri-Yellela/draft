#!/usr/bin/env node
/**
 * R1 — measure BEFORE trusting it (RECRUITER_LAYER_EXECUTION.md §R1 VERIFY).
 *
 *  1. REQUIREMENTS-SECTION DETECTION on 20 postings, against a truth label read by hand from each
 *     posting's stored text (09-30). Reported as a rate, with every miss named.
 *  2. DISCRIMINATION over 50 postings: the distribution of every measure. ⛔ If every posting scores
 *     the same it is measuring nothing — the v3 ATS engine's whole spread was sd 2.87 on 0–100.
 *  3. The board-wide requirements rate, split by whether the stored text was CAPPED — because the
 *     cap (htmlToText: first ~3,000 + last 2,000 characters) elides the middle of a long posting,
 *     which is where requirements sections sit.
 *
 * Zero model calls. Read-only. Usage: node scripts/r1PostingGradeMeasure.mjs [--db <path>]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { requirementsSections, boardBaseline, gradePosting } from "../services/postingGrade.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbArg = process.argv.indexOf("--db");
const db = new Database(dbArg > -1 ? process.argv[dbArg + 1] : path.join(ROOT, "data", "resume_master.db"), { readonly: true, fileMustExist: true });
const rows = db.prepare(`SELECT job_id, title, company, bucket_role, description FROM scraped_jobs
  WHERE description IS NOT NULL AND length(description) > 400 ORDER BY job_id`).all();
console.log(`board: ${rows.length} postings with a description`);

// ── 1. detection on 20 ────────────────────────────────────────────────────────────────────────
// The sample: a fixed stride through the id-ordered board, so a re-run reads the same postings.
// TRUTH, read by hand on 09-30 from each posting's STORED text: is a requirements section VISIBLE?
// "elided" = the posting has one, but the cap cut it out of the stored text (both are OpenAI/Scale
// postings whose requirements follow a long responsibilities list).
const TRUTH = [
  ["OpenAI", true], ["OpenAI", true], ["Notion", true], ["OpenAI", true], ["OpenAI", "elided"],
  ["OpenAI", true], ["OpenAI", true], ["Scale AI", "elided"], ["Anthropic", true], ["Anthropic", true],
  ["Anthropic", true], ["Vercel", true], ["Figma", true], ["Stripe", true], ["Stripe", true],
  ["Stripe", true], ["Stripe", true], ["Stripe", true], ["Brex", true], ["Match Group", false],
];
const step = Math.floor(rows.length / 20);
const sample = Array.from({ length: 20 }, (_, i) => rows[i * step + 7]);
let agree = 0, visible = 0, hit = 0;
const misses = [];
sample.forEach((row, i) => {
  const [company, truth] = TRUTH[i];
  if (row.company !== company) throw new Error(`sample ${i} is ${row.company}, labelled ${company} — the board changed; re-read and relabel`);
  const det = requirementsSections(row.description).hasRequirements;
  const visibleTruth = truth === true;
  if (visibleTruth) { visible++; if (det) hit++; }
  if (det === visibleTruth) agree++; else misses.push(`[${i}] ${row.company} — ${row.title}: detected=${det}, truth=${truth}`);
});
console.log(`\n1. REQUIREMENTS DETECTION on 20 sampled postings`);
console.log(`   detected ${hit} of the ${visible} whose section is visible in the stored text (${Math.round(100 * hit / visible)}%); agreement with the hand label ${agree}/20`);
console.log(`   not visible: ${TRUTH.filter(t => t[1] === "elided").length} elided by the storage cap, ${TRUTH.filter(t => t[1] === false).length} with no structure at all`);
for (const m of misses) console.log(`   ✗ ${m}`);

// ── 2. discrimination over 50 ─────────────────────────────────────────────────────────────────
const t0 = Date.now();
const baseline = boardBaseline(rows);
console.log(`\n(board baseline: ${rows.length} postings measured in ${((Date.now() - t0) / 1000).toFixed(1)} s, 0 model calls)`);
const step50 = Math.floor(rows.length / 50);
const fifty = Array.from({ length: 50 }, (_, i) => rows[i * step50 + 3]);
const graded = fifty.map(row => gradePosting(row, baseline));
const stats = (xs) => {
  const v = xs.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return "n=0";
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const q = (p) => v[Math.floor(p * (v.length - 1))];
  return `n=${v.length} min ${q(0).toFixed(2)} · p25 ${q(0.25).toFixed(2)} · median ${q(0.5).toFixed(2)} · p75 ${q(0.75).toFixed(2)} · max ${q(1).toFixed(2)} · sd ${sd.toFixed(2)} · distinct ${new Set(v.map(x => x.toFixed(2))).size}`;
};
const pick = (measure, key = "value") => graded.map(g => g.lines.find(l => l.measure === measure)?.[key] ?? null);
console.log(`\n2. DISTRIBUTION over 50 postings`);
console.log(`   specificity (tools named)        ${stats(pick("specificity"))}`);
console.log(`     as a peer percentile           ${stats(pick("specificity", "percentile"))}`);
console.log(`   generic-language share           ${stats(pick("generic_language"))}`);
console.log(`     as a peer percentile           ${stats(pick("generic_language", "percentile"))}`);
console.log(`   boilerplate share                ${stats(pick("boilerplate"))}`);
console.log(`     as a peer percentile           ${stats(pick("boilerplate", "percentile"))}`);
const reqs = pick("requirements").filter(Boolean);
console.log(`   requirements section             ${reqs.filter(r => r.hasRequirements).length}/50 · separates preferred ${reqs.filter(r => r.separatesPreferred).length}/50`);
console.log(`   seniority incoherent             ${graded.filter(g => g.lines.some(l => l.measure === "seniority")).length}/50`);

console.log(`\n   three of them, as a reader would see them:`);
for (const i of [0, 17, 41]) {
  console.log(`   — ${fifty[i].company}: ${fifty[i].title}  (compared on ${graded[i].comparedOn})`);
  for (const l of graded[i].lines) console.log(`       ${l.sentence}`);
}

console.log(`
   per role family (>= 30 postings) — median tools named · median generic share · requirements rate (uncapped):`);
for (const [role, d] of baseline.byRole) {
  const med = (v) => v[Math.floor((v.length - 1) / 2)];
  console.log(`     ${role.padEnd(12)} n=${String(d.n).padStart(4)}  tools ${med(d.tools)} (p90 ${d.tools[Math.floor(0.9 * (d.tools.length - 1))]})  generic ${Math.round(100 * med(d.genericShare))}%  requirements ${Math.round(100 * d.requirementsRate)}% of ${d.requirementsN}`);
}

// ── 3. the cap ────────────────────────────────────────────────────────────────────────────────
const capped = baseline.measured.filter(({ row }) => row.description.includes("[…]"));
const whole = baseline.measured.filter(({ row }) => !row.description.includes("[…]"));
const rate = (xs) => `${xs.filter(({ m }) => m.requirements.hasRequirements).length}/${xs.length} (${Math.round(100 * xs.filter(({ m }) => m.requirements.hasRequirements).length / (xs.length || 1))}%)`;
console.log(`\n3. REQUIREMENTS SECTION, board-wide: capped text ${rate(capped)} · uncapped ${rate(whole)} · all ${Math.round(100 * baseline.requirementsRate)}%`);

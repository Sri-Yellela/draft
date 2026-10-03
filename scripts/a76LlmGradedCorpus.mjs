#!/usr/bin/env node
/**
 * A76 (owner, 10-03) — A LARGER GRADED CORPUS, GRADED BY AN EXTERNAL MODEL, THEN RE-TUNED.
 *
 * Today's evidence for the ATS number is 30 postings graded by one person (ρ 0.746; 0.723 and 24
 * postings after the US filter). That is too thin to justify DISPLAYING a number (A75). This samples
 * a larger set against the same real profile, grades every posting BLIND with an external model —
 * the engine's score is never in the prompt, as it was never on the owner's sheet — and joins the
 * grades to the engine's scores only afterwards.
 *
 * ⛔ AN LLM GRADER IS NOT GROUND TRUTH. It is a bigger, cheaper, more consistent PROXY. AK1 graded
 * with a model once and got ρ 0.504 — a model reading the same text the engine reads can share its
 * failure modes. So the script ALSO grades the 30 owner-graded postings and reports how far the
 * model agrees with the person before any figure built on the model is trusted. The real ground
 * truth is still `job_applications`, which is still empty.
 *
 * Steps (each re-runnable; grades are checkpointed after every posting):
 *   --grade   sample and grade (spends money: ~$0.006 a posting on Sonnet; refuses without --yes)
 *   (always)  report: ρ, τ-b, mis-ordered %, model-vs-owner agreement, and re-derived cutpoints
 *
 * Usage: node scripts/a76LlmGradedCorpus.mjs --db <copy of the board> [--n 200] [--grade --yes]
 *
 * Writes docs/a76-llm-graded-corpus.json — job ids, titles, companies, the engine's score and the
 * model's grade. ⛔ NEVER the résumé: it is personal and stays in the local database.
 *
 * Excluded from verify:harness: it calls a model and needs a real profile.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";
import { callModel, SYSTEM_USER_ID } from "../services/modelCall.js";
import { DATA_CLASS } from "../shared/modelProviders.js";
import { MODEL_SONNET } from "../shared/anthropicModels.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const has = (f) => args.includes(f);

const OUT = path.join(ROOT, "docs", "a76-llm-graded-corpus.json");
const HUMAN = path.join(ROOT, "docs", "am1-ats-graded-corpus.json");
const PROFILE_ID = 6;          // the profile the owner's 30 were graded against
const N = Number(val("--n", "200"));
const SEED = Number(val("--seed", "76"));
const DESC_CHARS = 6000;

// ── statistics (the same definitions as am1GradedCorpusVerify) ────────────────────────────────────
function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function spearman(xs, ys) {
  const rx = ranks(xs), ry = ranks(ys), n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}
function kendall(xs, ys) {
  let c = 0, d = 0, tx = 0, ty = 0;
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    const a = Math.sign(xs[i] - xs[j]), b = Math.sign(ys[i] - ys[j]);
    if (a === 0 && b === 0) continue; if (a === 0) { tx++; continue; } if (b === 0) { ty++; continue; }
    if (a === b) c++; else d++;
  }
  const n0 = c + d + tx + ty;
  return { tau: (c - d) / Math.sqrt((n0 - tx) * (n0 - ty) || 1), misordered: c + d ? d / (c + d) : 0 };
}
/** Quadratic-weighted Cohen's kappa between two ordinal labelings over the same categories. */
function weightedKappa(a, b, k) {
  const n = a.length; const O = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) O[a[i]][b[i]]++;
  const ra = O.map(r => r.reduce((s, x) => s + x, 0)), cb = O[0].map((_, j) => O.reduce((s, r) => s + r[j], 0));
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const w = ((i - j) ** 2) / ((k - 1) ** 2);
    num += w * O[i][j]; den += w * (ra[i] * cb[j] / n);
  }
  return den ? 1 - num / den : 1;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

// ── inputs ──────────────────────────────────────────────────────────────────────────────────────
const dbPath = val("--db");
if (!dbPath) { console.error("⛔ --db <path> is required — point it at a COPY of the board, never production."); process.exit(2); }
const db = new Database(dbPath);
const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(PROFILE_ID);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(PROFILE_ID)?.content;
if (!profile || !resumeText) { console.error(`⛔ profile ${PROFILE_ID} or its base résumé is not in ${dbPath}.`); process.exit(3); }
const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });
const runtimeBasis = buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile });
const synonyms = loadConfirmedSynonyms(db);
const score = (job) => scoreAtsLocally({ job, runtimeBasis, termWeights: loadTermWeights(db, roleFamilyForTitle(job.title)), synonyms }).score;

const corpus = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8"))
  : { schema: "a76-llm-graded-corpus/1", purpose: "A76 — blind LLM grades joined to engine scores; a PROXY, not ground truth",
      profile_id: PROFILE_ID, resume_chars: resumeText.length, grader: MODEL_SONNET, seed: SEED, postings: [] };
const save = () => {
  const next = JSON.stringify(corpus, null, 2) + "\n";   // computed before the file is opened
  fs.writeFileSync(OUT, next);
};

// ── sampling: the owner's 30, plus N stratified across the engine's score range ──────────────────
function sample() {
  const human = JSON.parse(fs.readFileSync(HUMAN, "utf8")).postings;
  const picked = human.map(p => ({ ...p, set: "owner30" }));
  const seen = new Set(picked.map(p => p.job_id));
  const rows = db.prepare(`SELECT job_id, company, title, description, skills_json, normalized_title, experience_level,
                                  workplace_type, location, source, source_platform, category, url, scraped_at
                           FROM scraped_jobs WHERE is_active = 1 AND length(description) > 400`).all()
    .filter(r => !seen.has(r.job_id));
  for (const r of rows) r.engine = score(r);
  const rand = rng(SEED);
  const bins = Array.from({ length: 10 }, () => []);
  const max = Math.max(...rows.map(r => r.engine), 1);
  for (const r of rows) bins[Math.min(9, Math.floor((r.engine / (max + 1)) * 10))].push(r);
  const per = Math.ceil(N / 10);
  for (const b of bins) {
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    for (const r of b.slice(0, per)) picked.push({ ...r, set: "sample" });
  }
  // ⛔ SHUFFLED, so a run that stops partway (it did: the API credit ran out at 71 on 10-03) has graded
  // a spread of the engine's range, not its lowest bins only — a partial run over three low bins
  // read as ρ −0.107, a restriction-of-range artefact, not a finding.
  const owner30 = picked.filter(p => p.set === "owner30");
  const rest = picked.filter(p => p.set !== "owner30").slice(0, N);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...owner30, ...rest];
}

// ── grading — BLIND: the prompt carries the résumé and the posting, never the engine's score ─────
const RUBRIC = "You are grading how well a job posting fits a candidate's résumé, the way a careful recruiter " +
  "would. Rate the fit from 1 (poor) to 5 (excellent). Judge from the title and description only. " +
  "Consider role, seniority, skills and domain. Reply with JSON only: {\"fit\": <1-5>}.";
async function grade(anthropic, p) {
  const msg = await callModel({
    anthropic, db, purpose: "a76_llm_grading", userId: SYSTEM_USER_ID,
    // CANDIDATE: the prompt carries a real résumé.
    dataClass: DATA_CLASS.CANDIDATE,
    // No `temperature`: this model refuses it (400, measured 10-03). The rubric asks for JSON only.
    model: MODEL_SONNET, max_tokens: 20,
    system: [{ type: "text", text: `${RUBRIC}\n\nThe résumé:\n${resumeText}`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Title: ${p.title}\nCompany: ${p.company}\n\n${String(p.description || "").slice(0, DESC_CHARS)}` }],
  });
  const text = msg.content.map(b => b.text || "").join("");
  const fit = Number(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}").fit);
  if (!(fit >= 1 && fit <= 5)) throw new Error(`unparseable grade: ${text.slice(0, 80)}`);
  return Math.round(fit);
}

if (has("--grade")) {
  if (!has("--yes")) { console.error("⛔ --grade spends money (~$0.006 a posting). Add --yes to proceed."); process.exit(4); }
  if (!process.env.ANTHROPIC_KEY) { console.error("⛔ ANTHROPIC_KEY is not set."); process.exit(5); }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });
  const done = new Set(corpus.postings.map(p => p.job_id));
  const todo = sample().filter(p => !done.has(p.job_id));
  console.log(`grading ${todo.length} postings blind with ${MODEL_SONNET} (${done.size} already graded)`);
  let failedInARow = 0;
  for (const p of todo) {
    // Stop rather than repeat one failure 230 times: the first run refused every call identically.
    if (failedInARow >= 3) { console.log("\n⛔ three failures in a row — stopping; fix the cause and re-run (graded rows are kept)."); break; }
    try {
      const llm = await grade(anthropic, p);
      const engine = p.set === "owner30" ? score(p) : p.engine;
      corpus.postings.push({ job_id: p.job_id, company: p.company, title: p.title, set: p.set,
                             engine_score: engine, llm_fit: llm, ...(p.set === "owner30" ? { human_fit: p.human_fit } : {}) });
      save();
      failedInARow = 0;
      process.stdout.write(".");
    } catch (e) { failedInARow++; console.log(`\n  ✗ ${p.job_id}: ${e.message}`); }
  }
  console.log("");
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────
const P = corpus.postings;
if (!P.length) { console.log("Nothing graded yet. Run with --grade --yes."); process.exit(0); }
const line = (label, xs, ys) => {
  const { tau, misordered } = kendall(xs, ys);
  console.log(`${label.padEnd(44)} n=${String(xs.length).padStart(3)}  ρ ${spearman(xs, ys).toFixed(3)}  τ-b ${tau.toFixed(3)}  mis-ordered ${(100 * misordered).toFixed(1)}%`);
  return { n: xs.length, rho: +spearman(xs, ys).toFixed(4), tau_b: +tau.toFixed(4), misordered: +misordered.toFixed(4) };
};
const owner = P.filter(p => p.set === "owner30" && Number.isFinite(p.human_fit));
const all = P;
console.log("─".repeat(100));
const report = {
  engine_vs_owner_30: line("engine vs OWNER (the original 30)", owner.map(p => p.engine_score), owner.map(p => p.human_fit)),
  llm_vs_owner_30: line("MODEL vs OWNER (the original 30) — the proxy check", owner.map(p => p.llm_fit), owner.map(p => p.human_fit)),
  engine_vs_llm_all: line("engine vs MODEL (all graded)", all.map(p => p.engine_score), all.map(p => p.llm_fit)),
  engine_vs_llm_sample: line("engine vs MODEL (the new sample only)", all.filter(p => p.set === "sample").map(p => p.engine_score), all.filter(p => p.set === "sample").map(p => p.llm_fit)),
};
// Exact agreement of the model with the owner, and within one point.
if (owner.length) {
  const exact = owner.filter(p => p.llm_fit === p.human_fit).length, near = owner.filter(p => Math.abs(p.llm_fit - p.human_fit) <= 1).length;
  console.log(`model = owner exactly ${exact}/${owner.length}, within one point ${near}/${owner.length}`);
  report.llm_owner_agreement = { exact, within_one: near, n: owner.length };
}
// Re-derive the band cutpoints against the MODEL's grade: fit 4-5 → strong, 3 → moderate, 1-2 → weak.
const target = all.map(p => (p.llm_fit >= 4 ? 2 : p.llm_fit === 3 ? 1 : 0));
const bandOf = (s, st, mo) => (s >= st ? 2 : s >= mo ? 1 : 0);
const kappaFor = (st, mo) => weightedKappa(all.map(p => bandOf(p.engine_score, st, mo)), target, 3);
let best = { st: 0, mo: 0, k: -Infinity };
for (let st = 10; st <= 90; st++) for (let mo = 5; mo < st; mo++) { const k = kappaFor(st, mo); if (k > best.k) best = { st, mo, k }; }
const cur = kappaFor(ATS_BAND_CUTPOINTS.strong, ATS_BAND_CUTPOINTS.moderate);
console.log(`band cutpoints  current strong ${ATS_BAND_CUTPOINTS.strong} / moderate ${ATS_BAND_CUTPOINTS.moderate}: weighted κ ${cur.toFixed(3)}`);
console.log(`                best fit to the model's grades: strong ${best.st} / moderate ${best.mo}: weighted κ ${best.k.toFixed(3)} (in-sample — an upper bound)`);
// Out-of-sample check of the re-derived pair: fit on even rows, score on odd rows.
const half = (r) => all.filter((_, i) => i % 2 === r);
const kOn = (rows, st, mo) => weightedKappa(rows.map(p => bandOf(p.engine_score, st, mo)), rows.map(p => (p.llm_fit >= 4 ? 2 : p.llm_fit === 3 ? 1 : 0)), 3);
let bestEven = { st: 0, mo: 0, k: -Infinity };
for (let st = 10; st <= 90; st++) for (let mo = 5; mo < st; mo++) { const k = kOn(half(0), st, mo); if (k > bestEven.k) bestEven = { st, mo, k }; }
console.log(`                held out: fit on even rows → strong ${bestEven.st} / moderate ${bestEven.mo}; on odd rows κ ${kOn(half(1), bestEven.st, bestEven.mo).toFixed(3)} vs current ${kOn(half(1), ATS_BAND_CUTPOINTS.strong, ATS_BAND_CUTPOINTS.moderate).toFixed(3)}`);
report.cutpoints = { current: { ...ATS_BAND_CUTPOINTS, kappa: +cur.toFixed(4) }, best_in_sample: { strong: best.st, moderate: best.mo, kappa: +best.k.toFixed(4) },
  held_out: { fit_on: "even rows", strong: bestEven.st, moderate: bestEven.mo, kappa_odd: +kOn(half(1), bestEven.st, bestEven.mo).toFixed(4), current_kappa_odd: +kOn(half(1), ATS_BAND_CUTPOINTS.strong, ATS_BAND_CUTPOINTS.moderate).toFixed(4) } };
const dist = [1, 2, 3, 4, 5].map(f => all.filter(p => p.llm_fit === f).length);
console.log(`model grade distribution 1..5: ${dist.join(" / ")}`);
report.llm_fit_distribution = dist;
corpus.report = { generated_at: new Date().toISOString(), ...report };
save();

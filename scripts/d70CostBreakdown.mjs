#!/usr/bin/env node
// D70 Phase 0 — WHAT A RÉSUMÉ COSTS, per block, WITHOUT calling a model (D17).
//
// Builds the EXACT generate request draft sends (services/toolsServiceRequests.js), renders it with
// the tools service's OWN prompt code (buildRuntimeInputs + assemblePrompt, imported from the sibling
// checkout — never a copy, so this cannot drift from what the model reads), splits it into blocks,
// and prices each block at the repo's verified rates (shared/anthropicModels.js).
//
// ⛔ READ-ONLY. The database is opened readonly; nothing is written, nothing is sent anywhere, and
// no content is printed — character counts, token estimates and dollars only.
//
// TOKENS ARE ESTIMATED FROM CHARACTERS, calibrated against the ledger rather than guessed: AL6
// measured resume_generate's static prefix at 6,704 cache-write tokens (promptAssembler.js), and
// the engineering + Generate static prompt is 20,814 characters → 3.10 chars/token. That is the
// ~30% Sonnet 5 tokenizer inflation enhance.js notes (≈4 chars/token on Sonnet 4). Override with
// --chars-per-token.
//
// OUTPUT is not in the prompt, so it cannot be measured from it. It is read from the ledger (mean
// output_tokens of resume_generate rows in this database) unless --out-tokens is given.
//
// Usage:
//   node scripts/d70CostBreakdown.mjs [--user 14] [--job <job_id>] [--jobs 25]
//        [--rm ../resume-master] [--db data/resume_master.db] [--out-tokens N] [--chars-per-token 3.1]
//        [--cache write|read|off] [--json]
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ANTHROPIC_PRICING } from "../shared/anthropicModels.js";
import { generateRequest } from "../services/toolsServiceRequests.js";
import { listProfileClaims } from "../services/profileSignalAggregator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "claude-sonnet-5";
const CALIBRATION = { staticTokens: 6704, module: "engineering", mode: "GENERATE", source: "AL6 ledger reading, promptAssembler.js" };

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    out[a.slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
  }
  return out;
}

const opt = args(process.argv.slice(2));
const rmDir = path.resolve(ROOT, opt.rm || "../resume-master");
const dbPath = path.resolve(ROOT, opt.db || "data/resume_master.db");
const cacheMode = opt.cache || "write";   // what the static blocks cost on THIS call
if (!fs.existsSync(path.join(rmDir, "src/generation/promptAssembler.js"))) {
  console.error(`the tools service's checkout was not found at ${rmDir} — pass --rm <path to the resume-master checkout>`);
  process.exit(2);
}
const rm = (p) => import(pathToFileURL(path.join(rmDir, p)).href);
const { assemblePrompt, loadAllPrompts } = await rm("src/generation/promptAssembler.js");
const { buildRuntimeInputs } = await rm("src/generation/runtimeInputs.js");
const { getDomainModuleKey } = await rm("src/generation/domainModule.js");

const silence = console.log; console.log = () => {}; loadAllPrompts(); console.log = silence;

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const price = ANTHROPIC_PRICING[MODEL];

// ── chars → tokens, calibrated ────────────────────────────────────────────────────────────────
function staticChars(moduleKey, mode, summary) {
  const { systemBlocks } = assemblePrompt(moduleKey, mode, "", { SUMMARY: summary });
  return systemBlocks.map(b => b.text.length);
}
const calChars = staticChars(CALIBRATION.module, CALIBRATION.mode, false).reduce((a, b) => a + b, 0);
const charsPerToken = Number(opt["chars-per-token"]) || calChars / CALIBRATION.staticTokens;
const tok = (chars) => Math.round(chars / charsPerToken);

// ── the candidate ─────────────────────────────────────────────────────────────────────────────
const dp = opt.user
  ? db.prepare("SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1").get(Number(opt.user))
  : db.prepare("SELECT * FROM domain_profiles WHERE is_active=1 ORDER BY id LIMIT 1").get();
if (!dp) { console.error("No active job profile in this database (pass --user)."); process.exit(2); }
const userId = dp.user_id;
const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
const baseResume = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=? AND user_id=?").get(dp.id, userId)?.content
  || db.prepare("SELECT content FROM base_resume WHERE user_id=?").get(userId)?.content || "";
if (!baseResume) { console.error(`User ${userId} has no base résumé.`); process.exit(2); }
let claims = null;
try { claims = listProfileClaims(db, { userId, profileId: dp.id }); } catch { claims = null; }
const includeSummary = dp.include_summary === 1;

// ── the jobs ──────────────────────────────────────────────────────────────────────────────────
const jobs = opt.job
  ? [db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(opt.job))].filter(Boolean)
  : db.prepare(`SELECT * FROM scraped_jobs WHERE is_active=1 AND description IS NOT NULL AND length(description) > 200
                ORDER BY job_id LIMIT ?`).all(Number(opt.jobs) || 25);
if (!jobs.length) { console.error("No job found."); process.exit(2); }

// ── output tokens: the ledger, or the flag ────────────────────────────────────────────────────
const ledgerOut = db.prepare(`SELECT COUNT(*) n, AVG(output_tokens) avg, MIN(output_tokens) mn, MAX(output_tokens) mx
                              FROM usage_events WHERE purpose='resume_generate' AND success=1 AND output_tokens > 0`).get();
const outTokens = Number(opt["out-tokens"]) || Math.round(ledgerOut.avg || 0);

// ── one job → blocks ──────────────────────────────────────────────────────────────────────────
const JD_MARK = "**TARGET JOB DESCRIPTION**", RESUME_MARK = "**BASE RESUME TEXT**";
function breakdown(job) {
  const body = generateRequest({ profile, job, baseResumeText: baseResume, mode: "GENERATE", employers: [],
                                 domainProfile: dp, claims, includeSummary });
  const moduleKey = getDomainModuleKey(body.roleFamily, body.domain);
  const runtime = buildRuntimeInputs({ candidate: body.candidate, job: body.job, baseResumeText: body.baseResumeText,
                                       mode: body.mode, employers: body.employers, profile: body.profile, claims: body.claims });
  const [l1, l2, l3] = staticChars(moduleKey, body.mode, includeSummary);
  const jdAt = runtime.indexOf(JD_MARK), resAt = runtime.indexOf(RESUME_MARK);
  const header = runtime.slice(0, jdAt), jd = runtime.slice(jdAt, resAt), resume = runtime.slice(resAt);
  return { moduleKey, classifyRuns: !body.roleFamily, blocks: {
    "static L1 global rules": l1, "static L2 domain module": l2, "static L3 mode overlay": l3,
    "candidate + profile + claims": header.length, "job description": jd.length, "base résumé": resume.length,
  } };
}

const staticRate = { write: price.cache_write, read: price.cache_read, off: price.input }[cacheMode] ?? price.cache_write;
function priced(b) {
  const rows = Object.entries(b.blocks).map(([name, chars]) => {
    const isStatic = name.startsWith("static");
    const t = tok(chars);
    return { name, chars, tokens: t, usd: t * (isStatic ? staticRate : price.input) };
  });
  rows.push({ name: "OUTPUT (résumé HTML)", chars: null, tokens: outTokens, usd: outTokens * price.output });
  return rows;
}

const per = jobs.map(j => ({ jobId: j.job_id, ...breakdown(j) }));
const sums = {};
for (const p of per) for (const r of priced(p)) {
  sums[r.name] ??= { chars: 0, tokens: 0, usd: 0 };
  sums[r.name].chars += r.chars || 0; sums[r.name].tokens += r.tokens; sums[r.name].usd += r.usd;
}
const n = per.length;
const mean = Object.entries(sums).map(([name, s]) => ({ name, chars: Math.round(s.chars / n), tokens: Math.round(s.tokens / n), usd: s.usd / n }));
const total = mean.reduce((a, r) => a + r.usd, 0);
const jdChars = per.map(p => p.blocks["job description"]).sort((a, b) => a - b);

const report = {
  db: path.relative(ROOT, dbPath), model: MODEL, user: userId, profile: dp.id, includeSummary,
  modules: [...new Set(per.map(p => p.moduleKey))], classifyRuns: per.some(p => p.classifyRuns),
  jobs: n, staticPricedAs: cacheMode,
  calibration: { ...CALIBRATION, staticChars: calChars, charsPerToken: +charsPerToken.toFixed(2) },
  outputTokens: { used: outTokens, from: opt["out-tokens"] ? "--out-tokens" : `ledger mean of ${ledgerOut.n} resume_generate rows`,
                  ledgerMin: ledgerOut.mn, ledgerMax: ledgerOut.mx },
  jobDescriptionChars: { min: jdChars[0], median: jdChars[Math.floor(n / 2)], max: jdChars[n - 1] },
  perCall: mean.map(r => ({ ...r, usd: +r.usd.toFixed(5), share: +(100 * r.usd / total).toFixed(1) })),
  perCallTotalUsd: +total.toFixed(5),
};

if (opt.json) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
const c = (x) => (x * 100).toFixed(2) + "¢";
console.log(`D70 cost breakdown — ${n} job(s), user ${userId}, module ${report.modules.join("/")}, ${MODEL}, static priced as cache-${cacheMode}`);
console.log(`calibration: ${calChars} static chars ↔ ${CALIBRATION.staticTokens} ledger tokens → ${charsPerToken.toFixed(2)} chars/token`);
console.log(`output: ${outTokens} tokens (${report.outputTokens.from}; range ${ledgerOut.mn}–${ledgerOut.mx})`);
console.log(`job description chars: min ${report.jobDescriptionChars.min} · median ${report.jobDescriptionChars.median} · max ${report.jobDescriptionChars.max}`);
console.log(`classify (Haiku) would run: ${report.classifyRuns ? "YES" : "no — roleFamily is sent"}\n`);
console.log("block".padEnd(32) + "chars".padStart(8) + "tokens".padStart(9) + "cost".padStart(9) + "share".padStart(8));
for (const r of report.perCall) console.log(r.name.padEnd(32) + String(r.chars || "—").padStart(8) + String(r.tokens).padStart(9) + c(r.usd).padStart(9) + (r.share + "%").padStart(8));
console.log("".padEnd(32) + "".padStart(8) + "".padStart(9) + c(total).padStart(9) + "  per call");

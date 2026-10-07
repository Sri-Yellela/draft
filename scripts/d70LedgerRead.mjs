#!/usr/bin/env node
// D70 Phase 0, items 2–3 — WHERE A RÉSUMÉ'S MONEY WENT, read from usage_events. READ-ONLY.
//
// Run against production with:   railway ssh -s draft -- "node scripts/d70LedgerRead.mjs --since 2026-10-06"
// ⛔ never `railway run`, which runs HERE against the LOCAL database with production's variables.
//
// Prints counts, tokens and dollars only — no user content (usage_events holds none).
//
// HOW A REFUSAL IS TOLD APART FROM A DELIVERY. The ledger has no refusal flag: a claim-guard refusal
// is a model call that SUCCEEDED, so its row reads success = 1 like a delivered one. The two are
// distinguishable only by what draft wrote afterwards — the delivered path records the row with
// ats_score_before (AK1) and fills ats_score_after (recordAtsOutcome); the failure path
// (server.js coreGenerateResume's catch) records the usage with neither. So:
//   delivered  = ats_score_after IS NOT NULL
//   withheld   = ats_score_before IS NULL AND ats_score_after IS NULL   (refused, or failed after the call)
//   unknown    = before set, after missing (the after-score itself failed)
//   unscored   = no job_id — a script or a row from before AK1/A88 wired the job id, so neither
//                column says anything about it
// That is an inference, and the report labels it as one.
//
// Usage: node scripts/d70LedgerRead.mjs [--db <path>] [--since YYYY-MM-DD] [--gap-minutes 15] [--json]
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : d; };
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = flag("db", path.join(dataDir, "resume_master.db"));
if (!fs.existsSync(dbPath)) { console.error(`no database at ${dbPath}`); process.exit(2); }
const since = Math.floor(Date.parse(flag("since", "2026-09-01") + "T00:00:00Z") / 1000);
const gap = Number(flag("gap-minutes", 15)) * 60;
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

// Every purpose a résumé request can spend on, draft-side names included.
const GEN = ["resume_generate", "standalone_generate", "classifier", "resume_format", "resume_enhance"];
const inList = GEN.map(() => "?").join(",");

const byPurpose = db.prepare(`
  SELECT purpose, model, COUNT(*) calls, SUM(success = 0) failed,
         SUM(input_tokens) input, SUM(output_tokens) output,
         SUM(cache_creation_tokens) cache_write, SUM(cache_read_tokens) cache_read,
         ROUND(SUM(cost_usd), 4) usd, ROUND(AVG(cost_usd) * 100, 2) avg_cents, ROUND(MAX(cost_usd) * 100, 2) max_cents
  FROM usage_events WHERE created_at >= ? AND purpose IN (${inList})
  GROUP BY purpose, model ORDER BY usd DESC`).all(since, ...GEN);

const gens = db.prepare(`
  SELECT id, user_id, job_id, event_subtype, success, input_tokens, output_tokens,
         cache_creation_tokens, cache_read_tokens, cost_usd, ats_score_before, ats_score_after, created_at
  FROM usage_events WHERE created_at >= ? AND purpose = 'resume_generate' ORDER BY created_at`).all(since);
const outcome = (r) => !r.job_id ? "unscored" : r.ats_score_after != null ? "delivered"
  : (r.ats_score_before == null ? "withheld" : "unknown");
const outcomes = gens.reduce((m, r) => (m[outcome(r)] = (m[outcome(r)] || 0) + 1, m), {});

// A "request" = one user's calls on one job (or with no job) within `gap` of each other — so a
// refusal followed by a manual retry, or a classify before a generate, land in one group.
const all = db.prepare(`
  SELECT id, user_id, job_id, purpose, success, input_tokens, output_tokens, cache_creation_tokens,
         cache_read_tokens, cost_usd, ats_score_before, ats_score_after, created_at
  FROM usage_events WHERE created_at >= ? AND purpose IN (${inList}) ORDER BY user_id, job_id, created_at`).all(since, ...GEN);
const groups = [];
for (const r of all) {
  const g = groups.at(-1);
  if (g && g.user_id === r.user_id && g.job_id === r.job_id && r.created_at - g.last <= gap) { g.rows.push(r); g.last = r.created_at; }
  else groups.push({ user_id: r.user_id, job_id: r.job_id, first: r.created_at, last: r.created_at, rows: [r] });
}
const summarise = (g) => ({
  user: g.user_id, job: g.job_id ? "set" : "none", at: new Date(g.first * 1000).toISOString().slice(0, 16),
  calls: g.rows.map(r => r.purpose === "resume_generate" ? `generate(${outcome(r)})` : r.purpose).join(" + "),
  output_tokens: g.rows.map(r => r.output_tokens).join("/"),
  cache_w_r: g.rows.map(r => `${r.cache_creation_tokens}:${r.cache_read_tokens}`).join(" "),
  cents: +(100 * g.rows.reduce((a, r) => a + (r.cost_usd || 0), 0)).toFixed(2),
});
const requests = groups.map(summarise).sort((a, b) => b.cents - a.cents);

const sum = (k) => gens.reduce((a, r) => a + (r[k] || 0), 0);
const report = {
  db: dbPath, since: new Date(since * 1000).toISOString().slice(0, 10),
  byPurpose,
  resumeGenerate: {
    calls: gens.length, outcomes, outcomeRule: "inferred from the ATS columns — see the header",
    // Of the rows the rule can judge — unscored rows are left out of the denominator.
    withheldRate: (() => { const judged = gens.length - (outcomes.unscored || 0);
      return judged ? +((outcomes.withheld || 0) / judged * 100).toFixed(1) : null; })(),
    cacheWriteTokens: sum("cache_creation_tokens"), cacheReadTokens: sum("cache_read_tokens"),
    cacheReadToWrite: sum("cache_creation_tokens") ? +(sum("cache_read_tokens") / sum("cache_creation_tokens")).toFixed(2) : null,
    meanOutputTokens: gens.length ? Math.round(sum("output_tokens") / gens.length) : null,
  },
  requests: { count: requests.length, multiCall: requests.filter(r => r.calls.includes("+")).length,
              over10cents: requests.filter(r => r.cents > 10).length, top: requests.slice(0, 15) },
};

if (flag("json", false)) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
console.log(`D70 ledger read — ${report.db}, since ${report.since}\n`);
console.table(byPurpose);
console.log("resume_generate:", JSON.stringify(report.resumeGenerate));
console.log(`\nrequests (calls grouped by user + job within ${gap / 60} min): ${requests.length}, ` +
            `multi-call ${report.requests.multiCall}, over 10¢ ${report.requests.over10cents} — most expensive first:`);
console.table(report.requests.top);

#!/usr/bin/env node
// D78 D · WHICH COMPANIES ARE WORTH ADDING — a probe of candidate boards through EVERY filter the board now has.
// ⛔ READ-ONLY. It fetches each candidate's PUBLIC board (the same request the crawl makes), validates it the
// way the Admin add does (services/companyList.js validateBoard: dead / empty / no_descriptions / live), and
// then counts what would actually REACH the board: US evidence (queue 37) → posted within the age limit
// (D78 A) → a white-collar verdict with a family (classifyJob) → computer science (D78 B). It writes nothing.
//
//   node scripts/d78TrancheProbe.mjs [--candidates file.json] [--skip ats:slug,...] [--json]
// file.json: [{ "atsType": "greenhouse", "slug": "databricks", "company": "Databricks" }, ...]
// Without --candidates it probes CANDIDATES below — tech-heavy boards, D74 P3's advice ("the stricter filter
// makes a non-tech company yield almost nothing"). A wrong slug simply reads `dead`.
import fs from "node:fs";
import { probeBoard } from "../services/companyProbe.js";
import { DEFAULT_LIMIT_DAYS } from "../services/jobs/boardAge.js";

const CANDIDATES = [
  ...["databricks", "cloudflare", "datadog", "robinhood", "coinbase", "discord", "dropbox", "instacart", "lyft",
      "pinterest", "reddit", "gitlab", "mongodb", "twilio", "okta", "samsara", "asana", "affirm", "chime", "gusto",
      "flexport", "roblox", "airtable", "benchling", "nuro", "waymo", "anduril", "faire", "toast", "squarespace",
      "etsy", "elastic", "pagerduty", "hashicorp", "confluent", "cockroachlabs", "grafanalabs", "fivetran",
      "dbtlabsinc", "sofi", "carta", "verkada", "lattice", "mixpanel", "amplitude", "intercom", "webflow",
      "calendly", "twitch", "nextdoor", "doordashusa", "gemini", "neuralink", "zoox", "applovin", "hubspot"]
    .map(slug => ({ atsType: "greenhouse", slug })),
  ...["supabase", "posthog", "replit", "cursor", "perplexity", "cohere", "deel", "clickhouse", "modal", "baseten",
      "elevenlabs", "harvey", "sierra", "decagon", "hebbia", "vanta", "watershed", "zapier", "1password", "writer",
      "runway", "plaid", "snowflake", "confluent"]
    .map(slug => ({ atsType: "ashby", slug })),
  ...["palantir", "mistral", "shieldai", "kraken", "plaid", "attentive", "zoox", "netflix"]
    .map(slug => ({ atsType: "lever", slug })),
];

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const candidates = flag("candidates") ? JSON.parse(fs.readFileSync(flag("candidates"), "utf8")) : CANDIDATES;
const skip = new Set(String(flag("skip") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
const now = Math.floor(Date.now() / 1000);

async function probe({ atsType, slug, company }) {
  const p = await probeBoard({ atsType, slug, company }, { now });
  const { fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120, medianAge, salaryPct, usPct, dated } = p;
  return { atsType, slug, company: p.companyGuess || company || slug, state: p.state, ok: p.ok, descriptions: p.descriptions?.note ?? null,
           dated, fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120, medianAge, salaryPct, usPct };
}

const todo = candidates.filter(c => !skip.has(`${c.atsType}:${c.slug}`.toLowerCase()));
const results = [];
const POOL = 4;                       // polite: four boards at a time
for (let i = 0; i < todo.length; i += POOL) {
  results.push(...await Promise.all(todo.slice(i, i + POOL).map(c => probe(c).catch(e => ({ ...c, state: "error", ok: false, error: e.message })))));
}
results.sort((a, b) => (b.cs ?? -1) - (a.cs ?? -1));

if (argv.includes("--json")) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }
console.log(`D78 D tranche probe · ${results.length} candidate(s) · funnel: fetched → US → ≤${DEFAULT_LIMIT_DAYS}d → classified → CS`);
for (const r of results) {
  console.log(`${String(r.cs ?? "-").padStart(4)}  ${`${r.atsType}:${r.slug}`.padEnd(28)} ${String(r.state).padEnd(15)} ` +
    (r.fetched != null ? `${r.fetched} → ${r.us} → ${r.fresh} → ${r.classified} → ${r.cs}  (dated ${r.dated}/${r.fetched}; ${r.descriptions ?? "—"})` : (r.error || "")));
}

#!/usr/bin/env node
// ⛔ D81 step 3 · THE ONE-OFF FRESHNESS EXPERIMENT — 2 of the month's 250 SerpApi searches.
// The same title, once WITHOUT and once WITH `chips: "date_posted:week"`, both with NO num / start — D4's empty
// result came with chips + num + start together, so which one emptied it was never isolated. If `chips` alone
// returns results, HARVEST_CHIPS in services/slugHarvest.js can be switched on (a company with a posting from this
// week is hiring now); if it returns empty, record that and leave it off. ⛔ It reads the quota first and refuses
// if it cannot, spends exactly two searches, writes nothing, and prints counts — never a posting's text.
//
//   node scripts/d81ChipsExperiment.mjs [--q "backend engineer"]       (needs SERPAPI_KEY; on production via railway ssh)
import { serpSearch, serpAccount, poolFromResults } from "../services/slugHarvest.js";

const argv = process.argv.slice(2);
const q = argv.includes("--q") ? argv[argv.indexOf("--q") + 1] : "backend engineer";
const before = await serpAccount().catch((e) => { console.error(`refused: the quota could not be read (${e?.response?.status ?? e.message})`); process.exit(2); });
if (!(before.left >= 2)) { console.error(`refused: ${before.left} searches left`); process.exit(2); }
const out = { q, quotaBefore: before.left, runs: [] };
for (const chips of [null, "date_posted:week"]) {
  try {
    const data = await serpSearch(q, "United States", { chips });
    const r = poolFromResults(data);
    out.runs.push({ chips: chips || "(none)", jobs: r.jobs, links: r.links, atsLinks: r.atsLinks, pairs: r.pairs.size,
                    language: data?.search_parameters ? `${data.search_parameters.hl}/${data.search_parameters.gl}` : null, error: data?.error ?? null });
  } catch (e) { out.runs.push({ chips: chips || "(none)", error: e?.response?.status ?? e.message }); }
}
const [plain, week] = out.runs;
out.verdict = week.jobs > 0 ? `CHIPS WORK ALONE — ${week.jobs} jobs with date_posted:week (vs ${plain.jobs} without): HARVEST_CHIPS can be switched on`
  : `CHIPS RETURNED EMPTY (${plain.jobs} without) — leave HARVEST_CHIPS off`;
console.log(JSON.stringify(out, null, 1));

#!/usr/bin/env node
// D123 P6g · THE OWNER'S BLIND CHECK, UNBLINDED. Reads the key scripts/d123CompareModels.mjs wrote beside the pairs
// (blind-key.json) and the picks the owner saved from blind/index.html (picks.json), and says whether the new call
// passed. The rule, from P6g: "Pass = the new one wins or ties on ≥ 14 of 20 at ≤ 1¢" — generalised to any number of
// judged pairs as ≥ 70 % wins-or-ties AND the new route's median cost ≤ 1¢. An unpriced new route (an open model with no
// price in the tools service's prices.js) cannot pass the cost half: unknown is not cheap.
//
// Counts only: the key holds route names, ids, scores and costs; nothing here reads a document.
//
// Usage: node scripts/d123BlindCheck.mjs --key <blind-key.json> --picks <picks.json> [--new payload:haiku]
//        → prints the verdict and a markdown block for docs/LLM_AUDIT.md (also written beside the key as blind-verdict.md)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PASS_SHARE = 0.7;
export const PASS_MEDIAN_COST = 0.01;   // dollars — 1¢

const median = (a) => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * @param keyFile   blind-key.json's content: { pairs: [a, b], key: { "pair-01": { left, right, resume, job, atsBefore, atsAfter, cost } } }
 * @param picks     { "pair-01": "left" | "right" | "tie" }
 * @param newRoute  the route under test (default: the key's second route)
 */
export function blindVerdict(keyFile, picks = {}, newRoute = null) {
  const key = keyFile?.key || {};
  const routes = keyFile?.pairs || [];
  const nu = newRoute || routes[1];
  const old = routes.find(r => r !== nu) || null;
  let wins = 0, ties = 0, losses = 0, unjudged = 0;
  const rows = [];
  for (const [id, k] of Object.entries(key)) {
    const pick = picks[id];
    const side = k.left === nu ? "left" : k.right === nu ? "right" : null;
    let outcome = "unjudged";
    if (!side || !["left", "right", "tie"].includes(pick)) unjudged++;
    else if (pick === "tie") { ties++; outcome = "tie"; }
    else if (pick === side) { wins++; outcome = "win"; }
    else { losses++; outcome = "loss"; }
    rows.push({ id, resume: k.resume, job: k.job, outcome, atsBefore: k.atsBefore ?? null,
                atsNew: k.atsAfter?.[nu] ?? null, atsOld: old ? k.atsAfter?.[old] ?? null : null,
                costNew: k.cost?.[nu] ?? null, costOld: old ? k.cost?.[old] ?? null : null });
  }
  const judged = wins + ties + losses;
  const share = judged ? (wins + ties) / judged : 0;
  const costs = rows.map(r => r.costNew);
  const unpriced = costs.some(c => c == null);
  const medianCost = unpriced ? null : median(costs);
  const pass = judged > 0 && share >= PASS_SHARE && medianCost != null && medianCost <= PASS_MEDIAN_COST;
  return { newRoute: nu, oldRoute: old, judged, wins, ties, losses, unjudged, share, medianCost, unpriced, pass, rows };
}

/** The verdict as a block for docs/LLM_AUDIT.md. */
export function verdictMarkdown(v, date = new Date().toISOString().slice(0, 10)) {
  const c = (x) => (x == null ? "unpriced" : `${(x * 100).toFixed(2)}¢`);
  let md = `### D123 P6g · the blind check — ${date}\n\n`;
  md += `**${v.newRoute}** against **${v.oldRoute}**, sides hidden: **${v.wins} wins · ${v.ties} ties · ${v.losses} losses** of ${v.judged} judged` +
        `${v.unjudged ? ` (${v.unjudged} not judged)` : ""} = **${Math.round(v.share * 100)} %** wins-or-ties; median cost of the new route **${c(v.medianCost)}**.\n`;
  md += `Rule: ≥ ${PASS_SHARE * 100} % wins-or-ties at a median ≤ 1¢ → **${v.pass ? "PASS" : "FAIL"}**.\n\n`;
  md += "| pair | résumé | job | outcome | ATS before | ATS new | ATS old | new ¢ | old ¢ |\n|---|---|---|---|---|---|---|---|---|\n";
  for (const r of v.rows) md += `| ${r.id} | ${r.resume} | ${r.job} | ${r.outcome} | ${r.atsBefore ?? "–"} | ${r.atsNew ?? "–"} | ${r.atsOld ?? "–"} | ${c(r.costNew)} | ${c(r.costOld)} |\n`;
  return md;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const get = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : null; };
  if (!get("key") || !get("picks")) { console.error("usage: --key <blind-key.json> --picks <picks.json> [--new route]"); process.exit(2); }
  const v = blindVerdict(JSON.parse(fs.readFileSync(get("key"), "utf8")), JSON.parse(fs.readFileSync(get("picks"), "utf8")), get("new"));
  const md = verdictMarkdown(v);
  fs.writeFileSync(path.join(path.dirname(path.resolve(get("key"))), "blind-verdict.md"), md);
  console.log(md);
  process.exit(v.pass ? 0 : 1);
}

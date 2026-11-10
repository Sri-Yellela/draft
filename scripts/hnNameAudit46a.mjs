// scripts/hnNameAudit46a.mjs — 46a (owner 11-10: a candidate named "Location: Seattle OR Arlington, United States. Hybrid"
// on board workday:5|remitly|Remitly_Careers — "probe why … and probe if there are others"). Read-only: the SAME public
// Algolia HN pull the weekly discovery makes (services/jobs/hnDiscovery.js collectHn — 14 requests, 1.5 s apart), cached to
// CACHE so the audit re-runs offline; then every kept post's company name is checked for the shapes that are NOT a
// company (a "Field:" label, a place, a role / hiring phrase, a work-mode word). Prints each suspect with its header.
// Usage: node scripts/hnNameAudit46a.mjs [--offline]   (writes nothing in the repo or any database)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { collectHn, cleanCompany } from "../services/jobs/hnDiscovery.js";

const CACHE = process.env.HN_CACHE || path.join(os.tmpdir(), "hn-audit-46a");
fs.mkdirSync(CACHE, { recursive: true });
const offline = process.argv.includes("--offline");
const keyOf = (url) => url.replace(/[^a-z0-9]+/gi, "_").slice(-150) + ".json";
const fetchJson = async (url) => {
  const f = path.join(CACHE, keyOf(url));
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  if (offline) throw new Error(`not cached: ${url}`);
  const r = await fetch(url, { headers: { "user-agent": "draft-discovery-audit" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const j = await r.json();
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
};
const res = await collectHn({ fetchJson, sleep: offline ? async () => {} : undefined });

// The shapes a company name never has.
export const SUSPECT = [
  ["field label", /^[A-Za-z][A-Za-z /&-]{1,30}:\s*\S/],
  ["place", /\b(United States|USA|U\.S\.|Remote|Hybrid|Onsite|On-site|In[- ]office|NYC|San Francisco|SF|Bay Area|Seattle|Boston|New York|London|Berlin|Austin|Chicago|Toronto|Europe|EMEA|Americas|Worldwide|Anywhere)\b/i],
  ["role / hiring phrase", /\b(engineers?|developers?|designers?|scientists?|managers?|hiring|positions?|roles?|openings?|jobs?|full[- ]?time|part[- ]?time|contract|intern(ship)?s?|senior|staff|principal|lead)\b/i],
  ["joined places", /\s(OR|or|\/)\s/],
];
const suspects = [];
for (const c of res.candidates) {
  const why = SUSPECT.filter(([, re]) => re.test(c.company)).map(([w]) => w);
  if (why.length) suspects.push({ company: c.company, why, ats: c.ats ? `${c.ats.atsType}:${c.ats.slug}` : null, header: String(c.header || "").slice(0, 160) });
}
console.log(`threads ${res.threads.length} · candidates ${res.candidates.length} · requests ${res.requests.length} · errors ${res.errors.length} · cache ${CACHE}`);
console.log(`suspect names: ${suspects.length}`);
for (const s of suspects) console.log(`- ${JSON.stringify(s.company)} [${s.why.join(", ")}] ${s.ats || "(no ATS)"}\n    ${JSON.stringify(s.header)}`);
fs.writeFileSync(path.join(CACHE, "suspects.json"), JSON.stringify(suspects, null, 1));
void cleanCompany;

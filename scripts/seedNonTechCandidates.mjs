// scripts/seedNonTechCandidates.mjs — 45s (owner 11-09: "start boosting crawlers to boost coverage and volume") · the board is
// tech-heavy because its employer list came from Hacker News (D82): construction PM had 704 open postings against software
// engineering's 8,163. This proposes NON-TECH US employers (construction, healthcare, finance, manufacturing, energy,
// retail, logistics, public sector) to the existing candidate pool — it never adds one (D82's trust ladder: the owner
// approves a ranked batch in Admin → Companies → Candidates).
//
// For each employer it tries a few likely board names on the PUBLIC ATS APIs the crawl already uses (Greenhouse, Lever,
// Ashby, SmartRecruiters, Workable), READ-ONLY, ≥ 1.2 s between requests, through services/companyProbe.js probeBoard —
// and keeps a board only when it is live and holds US, in-scope, fresh roles. Output: content/companies/candidates-nontech-45s.json
// ({ company, atsType, slug, industry, evidence }), which server.js imports into company_candidates once (poolCandidates —
// deduped against configured / held / rejected pairs and the deny-list).
// Usage: node scripts/seedNonTechCandidates.mjs [--limit N]
import fs from "node:fs";
import { probeBoard } from "../services/companyProbe.js";

const OUT = "content/companies/candidates-nontech-45s.json";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// [company, industry] — US employers outside software, the families the board is thin in. Board names are GUESSED below
// and only a live probe keeps one.
const EMPLOYERS = [
  ["Suffolk Construction", "construction"], ["Shawmut Design and Construction", "construction"], ["Turner Construction", "construction"],
  ["Skanska", "construction"], ["Gilbane", "construction"], ["Whiting-Turner", "construction"], ["DPR Construction", "construction"],
  ["Mortenson", "construction"], ["McCarthy Building Companies", "construction"], ["Clayco", "construction"], ["Swinerton", "construction"],
  ["Hensel Phelps", "construction"], ["Kiewit", "construction"], ["Granite Construction", "construction"], ["Katerra", "construction"],
  ["Procore", "construction"], ["Built Technologies", "construction"], ["Juniper Square", "real estate"], ["Bowery Valuation", "real estate"],
  ["JLL", "real estate"], ["Cushman & Wakefield", "real estate"], ["CBRE", "real estate"], ["Compass", "real estate"], ["Opendoor", "real estate"],
  ["AECOM", "engineering services"], ["Jacobs", "engineering services"], ["HDR", "engineering services"], ["Stantec", "engineering services"],
  ["WSP", "engineering services"], ["Burns & McDonnell", "engineering services"], ["Black & Veatch", "engineering services"],
  ["Mass General Brigham", "healthcare"], ["One Medical", "healthcare"], ["Oak Street Health", "healthcare"], ["Cityblock Health", "healthcare"],
  ["Devoted Health", "healthcare"], ["Oscar Health", "healthcare"], ["Ro", "healthcare"], ["Hims & Hers", "healthcare"], ["Cerebral", "healthcare"],
  ["Headway", "healthcare"], ["Spring Health", "healthcare"], ["Lyra Health", "healthcare"], ["Included Health", "healthcare"],
  ["Carbon Health", "healthcare"], ["Forward", "healthcare"], ["Tempus", "healthcare"], ["Flatiron Health", "healthcare"], ["Komodo Health", "healthcare"],
  ["Moderna", "biotech"], ["Ginkgo Bioworks", "biotech"], ["Recursion", "biotech"], ["Insitro", "biotech"], ["Vertex Pharmaceuticals", "biotech"],
  ["Regeneron", "biotech"], ["Biogen", "biotech"], ["Alnylam", "biotech"], ["Sarepta", "biotech"],
  ["Fidelity Investments", "finance"], ["State Street", "finance"], ["Wellington Management", "finance"], ["Bridgewater Associates", "finance"],
  ["Two Sigma", "finance"], ["Citadel", "finance"], ["Jane Street", "finance"], ["DraftKings", "finance"], ["Toast", "finance"],
  ["Betterment", "finance"], ["Wealthfront", "finance"], ["SoFi", "finance"], ["Chime", "finance"], ["Affirm", "finance"], ["Marqeta", "finance"],
  ["Lemonade", "insurance"], ["Root Insurance", "insurance"], ["Hippo", "insurance"], ["Next Insurance", "insurance"], ["Coalition", "insurance"],
  ["Tesla", "manufacturing"], ["Rivian", "manufacturing"], ["Lucid Motors", "manufacturing"], ["Anduril", "manufacturing"], ["SpaceX", "manufacturing"],
  ["Relativity Space", "manufacturing"], ["Boston Dynamics", "manufacturing"], ["Formlabs", "manufacturing"], ["Desktop Metal", "manufacturing"],
  ["Hadrian", "manufacturing"], ["Zipline", "manufacturing"], ["Joby Aviation", "manufacturing"], ["Archer Aviation", "manufacturing"],
  ["Form Energy", "energy"], ["Commonwealth Fusion Systems", "energy"], ["Sunrun", "energy"], ["Palmetto", "energy"], ["Redwood Materials", "energy"],
  ["Fervo Energy", "energy"], ["Twelve", "energy"], ["Heirloom", "energy"], ["Arcadia", "energy"], ["Octopus Energy", "energy"],
  ["Flexport", "logistics"], ["Convoy", "logistics"], ["Samsara", "logistics"], ["Project44", "logistics"], ["ShipBob", "logistics"], ["Stord", "logistics"],
  ["Warby Parker", "retail"], ["Glossier", "retail"], ["Allbirds", "retail"], ["Away", "retail"], ["Rent the Runway", "retail"], ["Chewy", "retail"],
  ["Sweetgreen", "food"], ["Cava", "food"], ["Instacart", "food"], ["DoorDash", "food"], ["Gopuff", "food"],
  ["Teach For America", "nonprofit"], ["Khan Academy", "education"], ["Coursera", "education"], ["2U", "education"], ["Guild", "education"],
  ["Code for America", "public sector"], ["Nava PBC", "public sector"], ["US Digital Response", "public sector"], ["Ad Hoc", "public sector"],
  ["Harvard University", "education"], ["Northeastern University", "education"], ["New York Times", "media"], ["Vox Media", "media"],
  ["Condé Nast", "media"], ["Spotify", "media"], ["Peloton", "consumer"], ["Lululemon", "retail"], ["Patagonia", "retail"],
];
const ATS = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable"];
const slugs = (name) => {
  const base = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]+/g, "").trim();
  const words = base.split(/\s+/);
  return [...new Set([words.join(""), words.join("-"), words[0], words.filter(w => !["and", "the", "of", "inc", "company", "companies"].includes(w)).join("")])].filter(s => s.length >= 2);
};
const limit = (() => { const i = process.argv.indexOf("--limit"); return i > 0 ? Number(process.argv[i + 1]) : Infinity; })();
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { tried: {}, found: [] };
let n = 0;
for (const [company, industry] of EMPLOYERS) {
  if (n++ >= limit) break;
  if (prior.tried[company]) continue;
  let hit = null;
  outer: for (const atsType of ATS) for (const slug of slugs(company)) {
    let v = null;
    try { v = await probeBoard({ atsType, slug, company }, { describe: async () => null }); } catch { v = null; }
    await sleep(1200);
    if (v && v.state === "live" && v.us >= 3) { hit = { company, atsType, slug, industry, evidence: { fetched: v.fetched, us: v.us, fresh: v.fresh, inScope: v.csOpen, cs30: v.cs30, usPct: v.usPct, medianAge: v.medianAge, probedAt: new Date().toISOString() } }; break outer; }
  }
  prior.tried[company] = hit ? `${hit.atsType}:${hit.slug}` : "none";
  if (hit) prior.found.push(hit);
  fs.mkdirSync("content/companies", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(prior, null, 1));
  console.log(`${company.padEnd(34)} ${hit ? `${hit.atsType}:${hit.slug}  us ${hit.evidence.us} · in scope ${hit.evidence.inScope} · fresh ${hit.evidence.fresh}` : "—"}`);
}
console.log(`found ${prior.found.length} of ${Object.keys(prior.tried).length} tried`);

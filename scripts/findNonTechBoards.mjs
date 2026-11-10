// scripts/findNonTechBoards.mjs — 45s (owner 11-09, "boost crawlers … coverage and volume") · the guessed-slug pass found that
// 39 of 41 live boards were already crawled: the employers the board is missing are on systems a guess can't reach
// (Workday's wdN|tenant|site, iCIMS, Oracle). This runs the crawler's OWN board-finder (crawler/lib/j1.js findBoard —
// robots.txt honoured, the SSRF / deny guards, ≥ 2 s between pages, ≤ 25 pages a site) on employers' public sites, turns
// each ATS link it finds into a (vendor, slug) pair with the crawl's one parser (services/slugHarvest.js harvestPairOf),
// and probes the supported ones read-only (services/companyProbe.js). Output: appended to
// content/companies/candidates-nontech-45s.json `found` (live, ≥ 3 in-scope US roles) and `unsupported` (iCIMS / Oracle …,
// counted — the next lever). Nothing is added; the boot import puts new pairs in the pool for the owner's approval.
import fs from "node:fs";
import { createFetcher } from "../crawler/lib/fetcher.js";
import { findBoard } from "../crawler/lib/j1.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { probeBoard } from "../services/companyProbe.js";
import { fetchDescription } from "../services/jobs/detailFetch.js";

// The probe's detail sample, exactly as the nightly candidate probe asks it (services/companyCandidates.js — ≥ 1 s apart,
// no retries). ⛔ 46a: this was a stub answering null, and Workday lists carry no description — so EVERY Workday board
// read `no_descriptions` (Swinerton 45 in scope, Clark 67) and was dropped as "not live / thin".
const describe = async (row) => { await new Promise(r => setTimeout(r, 1000)); return fetchDescription(row, { maxRetries: 0, timeoutMs: 10000 }); };

const OUT = "content/companies/candidates-nontech-45s.json";
const SITES = [
  ["Suffolk Construction", "https://www.suffolk.com", "construction"], ["Shawmut Design and Construction", "https://www.shawmut.com", "construction"],
  ["Turner Construction", "https://www.turnerconstruction.com", "construction"], ["Skanska USA", "https://www.usa.skanska.com", "construction"],
  ["Gilbane", "https://www.gilbaneco.com", "construction"], ["Whiting-Turner", "https://www.whiting-turner.com", "construction"],
  ["DPR Construction", "https://www.dpr.com", "construction"], ["Mortenson", "https://www.mortenson.com", "construction"],
  ["McCarthy Building Companies", "https://www.mccarthy.com", "construction"], ["Clayco", "https://claycorp.com", "construction"],
  ["Swinerton", "https://swinerton.com", "construction"], ["Hensel Phelps", "https://www.henselphelps.com", "construction"],
  ["Kiewit", "https://www.kiewit.com", "construction"], ["Granite Construction", "https://www.graniteconstruction.com", "construction"],
  ["Structure Tone", "https://www.structuretone.com", "construction"], ["Consigli", "https://www.consigli.com", "construction"],
  ["Walsh Brothers", "https://www.walshbrothers.com", "construction"], ["Lendlease", "https://www.lendlease.com", "construction"],
  ["Bechtel", "https://www.bechtel.com", "construction"], ["Fluor", "https://www.fluor.com", "construction"], ["Clark Construction", "https://www.clarkconstruction.com", "construction"],
  ["AECOM", "https://aecom.com", "engineering services"], ["Jacobs", "https://www.jacobs.com", "engineering services"], ["HDR", "https://www.hdrinc.com", "engineering services"],
  ["Stantec", "https://www.stantec.com", "engineering services"], ["WSP USA", "https://www.wsp.com", "engineering services"], ["Burns & McDonnell", "https://www.burnsmcd.com", "engineering services"],
  ["Black & Veatch", "https://www.bv.com", "engineering services"], ["Tetra Tech", "https://www.tetratech.com", "engineering services"],
  ["Mass General Brigham", "https://www.massgeneralbrigham.org", "healthcare"], ["Boston Children's Hospital", "https://www.childrenshospital.org", "healthcare"],
  ["Beth Israel Lahey Health", "https://bilh.org", "healthcare"], ["Kaiser Permanente", "https://www.kaiserpermanente.org", "healthcare"],
  ["Mayo Clinic", "https://www.mayoclinic.org", "healthcare"], ["Cleveland Clinic", "https://my.clevelandclinic.org", "healthcare"],
  ["Fidelity Investments", "https://www.fidelity.com", "finance"], ["State Street", "https://www.statestreet.com", "finance"], ["Liberty Mutual", "https://www.libertymutual.com", "insurance"],
  ["John Hancock", "https://www.johnhancock.com", "finance"], ["Wellington Management", "https://www.wellington.com", "finance"], ["Vanguard", "https://www.vanguard.com", "finance"],
  ["General Electric", "https://www.ge.com", "manufacturing"], ["Raytheon", "https://www.rtx.com", "manufacturing"], ["Boston Scientific", "https://www.bostonscientific.com", "medtech"],
  ["Thermo Fisher Scientific", "https://www.thermofisher.com", "biotech"], ["Moderna", "https://www.modernatx.com", "biotech"], ["Vertex Pharmaceuticals", "https://www.vrtx.com", "biotech"],
  ["Eversource", "https://www.eversource.com", "energy"], ["National Grid", "https://www.nationalgridus.com", "energy"], ["Dominion Energy", "https://www.dominionenergy.com", "energy"],
];
// 46a: the second batch, by the board's thin families (the worklog's "widen the site list by industry") — health systems,
// banks / insurers, utilities, aerospace / manufacturing, more contractors and engineering firms, retail / logistics.
const SITES_46A = [
  ["HCA Healthcare", "https://hcahealthcare.com", "healthcare"], ["CommonSpirit Health", "https://www.commonspirit.org", "healthcare"],
  ["Providence", "https://www.providence.org", "healthcare"], ["Advocate Health", "https://www.advocatehealth.org", "healthcare"],
  ["Intermountain Health", "https://intermountainhealthcare.org", "healthcare"], ["Northwell Health", "https://www.northwell.edu", "healthcare"],
  ["NYU Langone Health", "https://nyulangone.org", "healthcare"], ["Johns Hopkins Medicine", "https://www.hopkinsmedicine.org", "healthcare"],
  ["UPMC", "https://www.upmc.com", "healthcare"], ["Sutter Health", "https://www.sutterhealth.org", "healthcare"],
  ["Baylor Scott & White Health", "https://www.bswhealth.com", "healthcare"], ["CVS Health", "https://www.cvshealth.com", "healthcare"],
  ["JPMorgan Chase", "https://www.jpmorganchase.com", "finance"], ["Bank of America", "https://www.bankofamerica.com", "finance"],
  ["Wells Fargo", "https://www.wellsfargo.com", "finance"], ["Citi", "https://www.citigroup.com", "finance"],
  ["Goldman Sachs", "https://www.goldmansachs.com", "finance"], ["Morgan Stanley", "https://www.morganstanley.com", "finance"],
  ["Capital One", "https://www.capitalone.com", "finance"], ["Travelers", "https://www.travelers.com", "insurance"],
  ["Progressive", "https://www.progressive.com", "insurance"], ["Prudential Financial", "https://www.prudential.com", "insurance"],
  ["MetLife", "https://www.metlife.com", "insurance"], ["Northwestern Mutual", "https://www.northwesternmutual.com", "insurance"],
  ["Duke Energy", "https://www.duke-energy.com", "energy"], ["NextEra Energy", "https://www.nexteraenergy.com", "energy"],
  ["Southern Company", "https://www.southerncompany.com", "energy"], ["Exelon", "https://www.exeloncorp.com", "energy"],
  ["Xcel Energy", "https://www.xcelenergy.com", "energy"], ["PG&E", "https://www.pge.com", "energy"],
  ["Con Edison", "https://www.coned.com", "energy"], ["Entergy", "https://www.entergy.com", "energy"],
  ["Boeing", "https://www.boeing.com", "manufacturing"], ["Lockheed Martin", "https://www.lockheedmartin.com", "manufacturing"],
  ["Northrop Grumman", "https://www.northropgrumman.com", "manufacturing"], ["General Dynamics", "https://www.gd.com", "manufacturing"],
  ["Honeywell", "https://www.honeywell.com", "manufacturing"], ["Caterpillar", "https://www.caterpillar.com", "manufacturing"],
  ["John Deere", "https://www.deere.com", "manufacturing"], ["3M", "https://www.3m.com", "manufacturing"],
  ["Parsons", "https://www.parsons.com", "engineering services"], ["Kimley-Horn", "https://www.kimley-horn.com", "engineering services"],
  ["Terracon", "https://www.terracon.com", "engineering services"], ["Barton Malow", "https://www.bartonmalow.com", "construction"],
  ["PCL Construction", "https://www.pcl.com", "construction"], ["Sundt", "https://www.sundt.com", "construction"],
  ["Brasfield & Gorrie", "https://www.brasfieldgorrie.com", "construction"], ["JE Dunn", "https://www.jedunn.com", "construction"],
  ["Webcor", "https://www.webcor.com", "construction"], ["Target", "https://corporate.target.com", "retail"],
  ["The Home Depot", "https://corporate.homedepot.com", "retail"], ["UPS", "https://about.ups.com", "logistics"],
  ["FedEx", "https://www.fedex.com", "logistics"],
];
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { tried: {}, found: [] };
prior.unsupported ??= [];
prior.j1 ??= {};
const have = new Set(prior.found.map(f => `${f.atsType}:${f.slug}`.toLowerCase()));
for (const [company, site, industry] of [...SITES, ...SITES_46A]) {
  // 46b: RETRY_ERRORS=1 re-tries only the sites a run recorded as "error" (46a: Lockheed, Caterpillar, Morgan Stanley).
  if (prior.j1[company] && !(process.env.RETRY_ERRORS === "1" && prior.j1[company] === "error")) continue;
  const fetcher = createFetcher({ budget: { pages: 25, bytes: 5_000_000, ms: 120_000 }, rateMs: 2000 });
  let r = null;
  try { r = await findBoard({ baseUrl: site }, fetcher); } catch (e) { r = { status: "error", error: String(e?.message || e).slice(0, 120) }; }
  const urls = [...new Set((r?.evidence || []).map(e => e.url))];
  // harvestPairOf answers {atsType, slug} for a crawlable vendor and {unsupported: "icims"} for one with no crawler —
  // keep them apart, or iCIMS / Oracle links read as "undefined:undefined" pairs and never reach `unsupported`.
  const harvested = urls.map(u => ({ u, p: harvestPairOf(u) })).filter(x => x.p);
  // One probe per distinct pair (Clark's site links the same Workday board eight times).
  const pairs = harvested.filter((x, i, all) => x.p.atsType && x.p.slug && all.findIndex(y => y.p.atsType === x.p.atsType && y.p.slug === x.p.slug) === i);
  const vendors = [...new Set(harvested.filter(x => x.p.unsupported).map(x => x.p.unsupported))];
  let hit = null;
  for (const { p } of pairs) {
    if (!["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "workday", "recruitee", "bamboohr", "rippling", "gem", "icims", "oracle", "taleo", "successfactors"].includes(p.atsType)) continue;
    let v = null; try { v = await probeBoard({ atsType: p.atsType, slug: p.slug, company }, { describe }); } catch { v = null; }
    if (v && v.state === "live" && v.us >= 3 && (v.csOpen || 0) >= 3) {
      hit = { company, atsType: p.atsType, slug: p.slug, industry, via: "j1", evidence: { fetched: v.fetched ?? v.jobs, us: v.us, fresh: v.fresh, inScope: v.csOpen, cs30: v.cs30, usPct: v.usPct, medianAge: v.medianAge, probedAt: new Date().toISOString() } };
      break;
    }
  }
  const other = urls.filter(u => !pairs.some(x => x.u === u)).map(u => { try { return new URL(u).hostname; } catch { return u; } });
  prior.j1[company] = hit ? `${hit.atsType}:${hit.slug}` : pairs.length ? `pairs ${pairs.map(x => `${x.p.atsType}:${x.p.slug}`).join(",")} (not live / thin)`
    : vendors.length ? `unsupported ${vendors.join(",")} (${[...new Set(other)].join(",")})` : other.length ? `other ${[...new Set(other)].join(",")}` : (r?.status || "none");
  if (hit && !have.has(`${hit.atsType}:${hit.slug}`.toLowerCase())) { prior.found.push(hit); have.add(`${hit.atsType}:${hit.slug}`.toLowerCase()); }
  if (!hit && (vendors.length || other.length)) prior.unsupported.push({ company, industry, vendors, hosts: [...new Set(other)], urls: urls.slice(0, 5) });
  fs.writeFileSync(OUT, JSON.stringify(prior, null, 1));
  console.log(`${company.padEnd(32)} ${prior.j1[company]}${hit ? `  us ${hit.evidence.us} · in scope ${hit.evidence.inScope}` : ""}`);
}
console.log(`J1: ${Object.values(prior.j1).filter(v => /^[a-z]+:/.test(v)).length} boards found of ${Object.keys(prior.j1).length} sites`);

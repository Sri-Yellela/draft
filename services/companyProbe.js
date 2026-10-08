// services/companyProbe.js — ⛔ D80 A · THE HIRING-EVIDENCE PROBE, built once.
//
// One board, read once (the same public endpoint the crawl uses), validated the way the Admin add does
// (companyList.js validateBoard: dead / empty / no_descriptions / live), then counted through EVERY filter the
// board now has — US evidence (queue 37) → within the age limit (D78 A) → a classifier family → computer
// science (D78 B) — plus D80 A's evidence: in-scope open roles before the age cut, the share within 30 and 120
// days, the median age, the salary share, the US share. ⛔ READ-ONLY: no database, no write.
// Used by scripts/d78TrancheProbe.mjs (tranches) and services/slugHarvest.js (D81: the harvest export carries it).
import { ATS_FETCHERS, validateBoard } from "./companyList.js";
import { usEligibility, officeLocations } from "./jobs/usLocation.js";
import { ageOf, DEFAULT_LIMIT_DAYS } from "./jobs/boardAge.js";
import { classifyJob } from "./jobs/classifyJob.js";
import { csScopeOf } from "./jobs/csScope.js";

/**
 * @returns validateBoard's result, plus { fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120,
 *          medianAge, salaryPct, usPct, dated } — `cs` = in-scope US postings within the age limit.
 */
export async function probeBoard({ atsType, slug, company = "" }, { fetchers = ATS_FETCHERS, now = Math.floor(Date.now() / 1000), describe } = {}) {
  let jobs = [];
  const fetch = fetchers[atsType];
  const fetchOnce = async (s, c, w) => (jobs = (await fetch(s, c, w)) || []);
  const v = await validateBoard({ atsType, slug, company: company || slug, fetchers: fetch ? { [atsType]: fetchOnce } : {}, ...(describe ? { describe } : {}) });
  const funnel = { fetched: jobs.length, us: 0, fresh: 0, classified: 0, cs: 0 };
  const csAges = [];
  let csSalary = 0;
  for (const j of jobs) {
    if (!usEligibility({ location: j.location, description: j.description, offices: officeLocations(j._raw) }).admit) continue;
    funnel.us++;
    const age = ageOf({ posted_at: j.posted_at }, { now, limitDays: DEFAULT_LIMIT_DAYS });
    const verdict = classifyJob(j.title || "", j.description || "", j.company || "");
    const cs = verdict.collar !== "blue" && verdict.roleKey !== null && csScopeOf({ title: j.title, roleKey: verdict.roleKey }).inScope;
    if (cs) { csAges.push(age.days); if (j.salary_min_usd != null || j.salary_min != null) csSalary++; }
    if (age.tooOld) continue;
    funnel.fresh++;
    if (verdict.collar === "blue" || verdict.roleKey === null) continue;
    funnel.classified++;
    if (cs) funnel.cs++;
  }
  csAges.sort((x, y) => x - y);
  const share = (n) => (csAges.length ? Math.round((100 * n) / csAges.length) : null);
  return { ...v, ...funnel,
    csOpen: csAges.length, cs30: csAges.filter((d) => d <= 30).length,
    pct30: share(csAges.filter((d) => d <= 30).length), pct120: share(csAges.filter((d) => d <= DEFAULT_LIMIT_DAYS).length),
    medianAge: csAges.length ? csAges[Math.floor(csAges.length / 2)] : null, salaryPct: share(csSalary),
    usPct: jobs.length ? Math.round((100 * funnel.us) / jobs.length) : null,
    dated: jobs.filter((j) => ageOf({ posted_at: j.posted_at }, { now }).basis === "posted_at").length };
}

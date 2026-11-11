// services/hirebase/sampleReport.js — ⭐ HB-FEED FEED-0 (owner 11-10): "100 jobs have been ingested — check their status".
// One read-only report over the jobs a Hirebase run landed (default: the latest live `sample` run), answering FEED-0's list:
// on the board? · the D179 category / subcategory (how many unclassified) · level · ghost score · the company each resolved
// to (a companies row? a logo?) · technologies / team / visa hint present in the payload · the apply link's ATS · freshness
// (first_ingested vs date_posted; for merged rows, Hirebase's first-seen vs the crawl's) · merged rows: what they gained ·
// held / dropped confirmed from the rows themselves, not the run's counters.
// Served at GET /api/admin/hirebase/sample-report (admin only). No writes, no Hirebase call.

const ATS_HOSTS = [
  ["greenhouse", /greenhouse\.io/i], ["lever", /lever\.co/i], ["ashby", /ashbyhq\.com/i], ["workday", /myworkdayjobs\.com|workday\.com/i],
  ["icims", /icims\.com/i], ["smartrecruiters", /smartrecruiters\.com/i], ["workable", /workable\.com/i], ["bamboohr", /bamboohr\.com/i],
  ["jobvite", /jobvite\.com/i], ["successfactors", /successfactors\.|sapsf\./i], ["taleo", /taleo\.net/i], ["oracle", /oraclecloud\.com/i],
  ["rippling", /rippling\.com/i], ["linkedin", /linkedin\.com/i],
];
const CRAWLED = new Set(["greenhouse", "lever", "ashby", "workday", "smartrecruiters"]);
export const atsOfUrl = (u) => { for (const [k, re] of ATS_HOSTS) if (re.test(String(u || ""))) return k; return u ? "other" : "none"; };

const has = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t);
const parse = (s) => { try { return JSON.parse(s || "null"); } catch { return null; } };
const tally = (arr) => arr.reduce((m, k) => (m[k ?? "(none)"] = (m[k ?? "(none)"] || 0) + 1, m), {});
const hoursBetween = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((x - y) / 36e5) : null; };

export function sampleReport(db, { runId = null } = {}) {
  const run = runId
    ? db.prepare("SELECT * FROM hirebase_runs WHERE id = ?").get(runId)
    : db.prepare("SELECT * FROM hirebase_runs WHERE kind = 'sample' AND dry_run = 0 ORDER BY id DESC LIMIT 1").get();
  if (!run) return { run: null, note: "no live sample run yet" };
  const raws = db.prepare("SELECT hb_id, payload_json, first_ingested, fetched_at FROM hirebase_raw WHERE run_id = ?").all(run.id);
  const withTax = has(db, "job_taxonomy"), withCo = has(db, "companies"), withLogo = has(db, "company_logos");
  const own = db.prepare(`SELECT job_id, source, is_active, retired_reason, board_category, experience_level, ghost_score, ghost_level, company, company_icon_url,
    url, apply_url, posted_at, first_ingested, discovered_at, skills_json FROM scraped_jobs WHERE job_id = ?`);
  const byPlatform = db.prepare(`SELECT job_id, source, is_active, retired_reason, board_category, experience_level, ghost_score, ghost_level, company, company_icon_url,
    url, apply_url, posted_at, first_ingested, discovered_at, skills_json FROM scraped_jobs WHERE platform_job_id = ? AND source != 'hirebase' LIMIT 1`);
  const tax = withTax ? db.prepare("SELECT category, subcategory FROM job_taxonomy WHERE job_id = ?") : null;
  const co = withCo ? db.prepare("SELECT id FROM companies WHERE lower(name) = lower(?) LIMIT 1") : null;
  const logo = withLogo ? db.prepare("SELECT status FROM company_logos WHERE lower(company) = lower(?) LIMIT 1") : null;

  const jobs = raws.map(r => {
    const p = parse(r.payload_json) || {};
    const row = own.get(`hirebase::${r.hb_id}`) || (p.platform_job_id ? byPlatform.get(String(p.platform_job_id)) : null);
    const t = row && tax ? tax.get(row.job_id) : null;
    const kind = !row ? "not_found" : row.source === "hirebase" ? "new" : "merged";
    return {
      hbId: r.hb_id, kind, jobId: row?.job_id ?? null, title: p.job_title ?? null, company: p.company_name ?? null,
      onBoard: !!(row && row.is_active), retired: row?.retired_reason ?? null,
      category: t?.category ?? row?.board_category ?? null, subcategory: t?.subcategory ?? null,
      level: row?.experience_level ?? null, hirebaseLevel: p.experience_level ?? null,
      ghostScore: row?.ghost_score ?? null, ghostLevel: row?.ghost_level ?? null,
      companyRecord: co && p.company_name ? !!co.get(p.company_name) : null,
      logo: row?.company_icon_url ? "icon_url" : (logo && p.company_name ? (logo.get(p.company_name)?.status ?? "none") : null),
      technologies: Array.isArray(p.technologies) ? p.technologies.length : 0, team: !!p.team, visaHint: typeof p.visa_sponsored === "boolean" ? p.visa_sponsored : null,
      companyData: !!(p.company_data && typeof p.company_data === "object"),
      ats: atsOfUrl(row?.apply_url || row?.url || p.application_link), hirebaseBoard: p.job_board ?? null,
      datePosted: p.date_posted ?? null, firstIngested: r.first_ingested ?? p.first_ingested ?? null,
      ingestLagHours: hoursBetween(r.first_ingested ?? p.first_ingested, p.date_posted),
      crawlVsHirebaseHours: kind === "merged" && row?.discovered_at ? hoursBetween(new Date(row.discovered_at * 1000).toISOString(), r.first_ingested ?? p.first_ingested) : null,
      // what a merged row gained from Hirebase (ingest.js enrich: only the EMPTY platform_job_id / first_ingested are filled)
      mergedGained: kind === "merged" ? { firstIngested: !!row.first_ingested, teamOrTechOrCompanyData: false } : null,
    };
  });
  const n = jobs.length, counted = (k) => jobs.filter(j => j.kind === k).length;
  const lags = jobs.map(j => j.ingestLagHours).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    run: { id: run.id, kind: run.kind, status: run.status, units: run.units_used, startedAt: run.started_at, counts: parse(run.counts_json) },
    summary: {
      landed: n, new: counted("new"), merged: counted("merged"), notFound: counted("not_found"),
      onBoard: jobs.filter(j => j.onBoard).length, retired: tally(jobs.filter(j => j.retired).map(j => j.retired)),
      unclassified: jobs.filter(j => !j.subcategory).length, categories: tally(jobs.map(j => j.category)), subcategories: tally(jobs.map(j => j.subcategory)),
      levels: tally(jobs.map(j => j.level)), ghostLevels: tally(jobs.map(j => j.ghostLevel)),
      companyRecords: jobs.filter(j => j.companyRecord).length, logos: tally(jobs.map(j => j.logo)),
      withTechnologies: jobs.filter(j => j.technologies > 0).length, withTeam: jobs.filter(j => j.team).length,
      withCompanyData: jobs.filter(j => j.companyData).length, visaFlagged: jobs.filter(j => j.visaHint === true).length,
      ats: tally(jobs.map(j => j.ats)), atsWeCrawl: jobs.filter(j => CRAWLED.has(j.ats)).length,
      ingestLagHours: lags.length ? { min: lags[0], median: lags[Math.floor(lags.length / 2)], max: lags[lags.length - 1] } : null,
      // ⚠ by design (ingest.js): a merged (crawled) row keeps its own content — Hirebase's team / technologies / company_data
      // live only in hirebase_raw; the new rows carry technologies inside skills, team / company_data are not stored on the row.
      mergedGainNote: "merged rows gain only an empty first_ingested / platform_job_id; Hirebase's team, technologies and company_data stay in hirebase_raw",
    },
    jobs,
  };
}

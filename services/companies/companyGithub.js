// services/companies/companyGithub.js — ⭐ D179 P5b (45l) · A COMPANY'S PUBLIC GITHUB LANGUAGES.
//
// D179 (5) source 2: "their public GitHub organisation (languages and notable repos through GitHub's public API, within
// its terms)". Evidence, never a guess:
//   · candidates are the company's own slug forms ("acme-labs", "acmelabs"); a candidate counts ONLY when GitHub's
//     organisation record names the company's OWN website in its `blog` field (the domain P4a holds) — so a squatted or
//     unrelated organisation with the same name never lands on the page;
//   · the languages: GitHub's `language` of each public, non-fork, non-archived repository pushed in the last 12 months,
//     counted; the page shows the top ones with their repository counts and links the organisation.
// GitHub's REST API: 60 requests an hour without a token (GITHUB_TOKEN raises it); a run asks at most `perRun` companies,
// at most three requests each, `gapMs` apart; stops on 403 / 429. Re-read after 30 days. Kill switch COMPANY_GITHUB=off.
const API = "https://api.github.com";
const UA = "draft-company-pages (https://jobsviadraft.com)";
export const REFRESH_DAYS = 30;

const domainOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
export function candidatesFor(slug) {
  const s = String(slug || "").toLowerCase().replace(/-\d+$/, "");
  return [...new Set([s, s.replace(/-/g, ""), s.split("-")[0]].filter(x => x && x.length >= 2))].slice(0, 2);
}
// The site's NAME part — "stripe" for stripe.com, stripe.dev, docs.stripe.com, stripe.co.uk.
const TWO_LEVEL = ["co.uk", "com.au", "co.in", "com.br", "co.jp", "com.sg", "co.nz", "co.za"];
export function siteName(host) {
  const parts = String(host || "").toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const tail = parts.slice(-2).join(".");
  return TWO_LEVEL.includes(tail) ? parts[parts.length - 3] || null : parts[parts.length - 2];
}
/**
 * True when the organisation record names the company's own site — the same domain, or (11-08: Stripe's organisation
 * says stripe.dev, its jobs come from stripe.com) a site with the same NAME part. Always together with the login being
 * one of the company's own slug forms (the caller only asks those), so two independent signals agree.
 */
export function orgMatches(org, domain) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  const b = domainOf(org?.blog || "");
  if (!d || !b) return false;
  if (b === d || b.endsWith(`.${d}`) || d.endsWith(`.${b}`)) return true;
  const n = siteName(d);
  return !!n && n.length >= 3 && n === siteName(b);
}
/** The repositories → [{ language, repos }], most first. */
export function languagesOf(repos, nowMs = Date.now()) {
  const since = nowMs - 365 * 86400000;
  const counts = new Map();
  for (const r of repos || []) {
    if (!r || r.fork || r.archived || r.private || !r.language) continue;
    if (Date.parse(r.pushed_at || 0) < since) continue;
    counts.set(r.language, (counts.get(r.language) || 0) + 1);
  }
  return [...counts.entries()].map(([language, repos]) => ({ language, repos })).sort((a, b) => b.repos - a.repos || a.language.localeCompare(b.language));
}

/** The page's GitHub block, or null. */
export function companyGithub(db, companyId) {
  let r = null;
  try { r = db.prepare(`SELECT org, languages_json, fetched_at FROM company_github WHERE company_id = ? AND status = 'ok'`).get(companyId); } catch { r = null; }
  if (!r) return null;
  let langs = []; try { langs = JSON.parse(r.languages_json || "[]"); } catch { langs = []; }
  if (!langs.length) return null;
  return { org: r.org, url: `https://github.com/${r.org}`, languages: langs.slice(0, 8), asOf: r.fetched_at };
}

export function createCompanyGithub(db, { perRun = 15, gapMs = 2000, token = process.env.GITHUB_TOKEN || null, fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise(r => setTimeout(r, ms)), log = console } = {}) {
  let running = null;
  let status = { state: "idle", runs: 0, asked: 0, found: 0, none: 0, failed: 0, startedAt: null, finishedAt: null };
  const headers = { Accept: "application/vnd.github+json", "User-Agent": UA, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const store = (id, st, org = null, langs = []) => db.prepare(`INSERT INTO company_github (company_id, org, languages_json, status, fetched_at)
      VALUES (?, ?, ?, ?, unixepoch()) ON CONFLICT(company_id) DO UPDATE SET org = excluded.org, languages_json = excluded.languages_json,
      status = excluded.status, fetched_at = excluded.fetched_at`).run(id, org, JSON.stringify(langs), st);
  function due(limit) {
    const since = Math.floor(Date.now() / 1000) - REFRESH_DAYS * 86400;
    try {
      return db.prepare(`SELECT co.id, co.slug, co.domain FROM companies co LEFT JOIN company_github g ON g.company_id = co.id
          WHERE co.domain IS NOT NULL AND (g.company_id IS NULL OR g.fetched_at < ?)
            AND EXISTS (SELECT 1 FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = co.id AND sj.is_active = 1)
          ORDER BY g.fetched_at IS NOT NULL, co.id LIMIT ?`).all(since, limit);
    } catch { return []; }
  }
  async function get(path) {
    const r = await fetchImpl(`${API}${path}`, { headers });
    status.asked++;
    if (r.status === 403 || r.status === 429) throw Object.assign(new Error("rate limited"), { stop: true });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, asked: 0, found: 0, none: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
    running = (async () => {
      outer: for (const co of due(perRun)) {
        try {
          let hit = null;
          for (const c of candidatesFor(co.slug)) {
            const org = await get(`/orgs/${encodeURIComponent(c)}`);
            await sleep(gapMs);
            if (org && orgMatches(org, co.domain)) { hit = org.login; break; }
          }
          if (!hit) { store(co.id, "none"); status.none++; continue; }
          const repos = await get(`/orgs/${encodeURIComponent(hit)}/repos?per_page=100&sort=pushed&type=public`);
          await sleep(gapMs);
          const langs = languagesOf(repos);
          store(co.id, langs.length ? "ok" : "none", hit, langs);
          if (langs.length) status.found++; else status.none++;
        } catch (e) {
          if (e.stop) { log.warn?.("[company-github] GitHub's rate limit reached — stopping this run"); break outer; }
          store(co.id, "failed"); status.failed++;
        }
      }
      status = { ...status, state: "done", finishedAt: new Date().toISOString() };
      if (status.asked) log.log?.(`[company-github] (${trigger}) ${status.found} organisations matched by their own site, ${status.none} none, ${status.failed} failed`);
      running = null;
      return { ...status };
    })();
    return running;
  }
  return { run, status: () => ({ ...status }) };
}

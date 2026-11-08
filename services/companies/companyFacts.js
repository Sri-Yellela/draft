// services/companies/companyFacts.js — ⭐ D179 P4b (45l) · ABOUT, IN DRAFT'S OWN WORDS, FROM PUBLIC FACTS.
//
// D179 (4): "About (a short description in draft's own words, written from public facts — the company's own site,
// Wikidata (CC0) for industry / HQ / founded / size; the sources linked; never copied from LinkedIn or any site whose
// terms forbid it — D78 stands)". This is the Wikidata half:
//   · the company record (D179 P4a) is matched to a Wikidata item by its OWN WEBSITE (P856 = the record's domain, the
//     https / www variants) — never by name alone, so "Mercury" the bank is not "Mercury" the insurer;
//   · the facts read: industry (P452), headquarters (P159), inception (P571), employees (P1128), the item's id;
//   · aboutLine() turns them into ONE sentence of draft's own ("Stripe is a financial-technology company headquartered
//     in South San Francisco, founded in 2010, with about 8,000 employees.") — no text is copied, not even Wikidata's
//     own description; the page links the item as the source.
// Wikidata's data is CC0. Requests: one SPARQL query per company, at most `perRun` companies a run, `gapMs` apart, a
// descriptive User-Agent (Wikimedia's policy); a company is re-read after REFRESH_DAYS. Kill switch COMPANY_FACTS=off.
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "draft-company-facts/1.0 (https://jobsviadraft.com; company pages from public facts)";
export const REFRESH_DAYS = 90;

const sitesFor = (domain) => {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return [];
  return [`https://${d}`, `https://${d}/`, `https://www.${d}`, `https://www.${d}/`, `http://${d}`, `http://${d}/`, `http://www.${d}`, `http://www.${d}/`];
};

export function factsQuery(domain) {
  const sites = sitesFor(domain);
  if (!sites.length) return null;
  return `SELECT ?item ?industryLabel ?hqLabel ?inception ?employees WHERE {
  VALUES ?site { ${sites.map(s => `<${s}>`).join(" ")} }
  ?item wdt:P856 ?site .
  OPTIONAL { ?item wdt:P452 ?industry . }
  OPTIONAL { ?item wdt:P159 ?hq . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P1128 ?employees . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 20`;
}

/** The SPARQL answer → one fact set (the item most bindings name; the largest employee figure; the earliest inception). */
export function factsFrom(json) {
  const rows = json?.results?.bindings || [];
  if (!rows.length) return null;
  const count = new Map();
  for (const r of rows) count.set(r.item?.value, (count.get(r.item?.value) || 0) + 1);
  const item = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const mine = rows.filter(r => r.item?.value === item);
  const first = (k) => mine.map(r => r[k]?.value).find(v => v && !/^Q\d+$/.test(v) && !/^http/.test(v)) || null;
  const years = mine.map(r => Number(String(r.inception?.value || "").slice(0, 4))).filter(y => y > 1600 && y <= new Date().getUTCFullYear());
  const emps = mine.map(r => Number(r.employees?.value)).filter(n => Number.isFinite(n) && n > 0);
  return {
    wikidataId: String(item).split("/").pop(),
    industry: first("industryLabel"), hq: first("hqLabel"),
    founded: years.length ? Math.min(...years) : null,
    employees: emps.length ? Math.max(...emps) : null,
  };
}

const roundEmployees = (n) => (n >= 10000 ? Math.round(n / 1000) * 1000 : n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : n);
const article = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");

/** One sentence of draft's own from the facts, or null when there is too little to say. */
export function aboutLine(name, f) {
  if (!f || (!f.industry && !f.hq && !f.founded)) return null;
  let s = f.industry ? `${name} is ${article(f.industry)} ${f.industry.toLowerCase()} company` : `${name} is a company`;
  if (f.hq) s += ` headquartered in ${f.hq}`;
  if (f.founded) s += `${f.hq ? "," : ""} founded in ${f.founded}`;
  if (f.employees) s += `, with about ${roundEmployees(f.employees).toLocaleString("en-US")} employees`;
  return `${s}.`;
}

/** The page's About block, or null. */
export function companyAbout(db, company) {
  let f = null;
  try { f = db.prepare(`SELECT * FROM company_facts WHERE company_id = ? AND status = 'ok'`).get(company.id); } catch { f = null; }
  if (!f) return null;
  const facts = { industry: f.industry, hq: f.hq, founded: f.founded, employees: f.employees };
  const line = aboutLine(company.name, facts);
  if (!line) return null;
  return { line, facts, sources: [{ name: "Wikidata (CC0)", url: `https://www.wikidata.org/wiki/${f.wikidata_id}` }], asOf: f.fetched_at };
}

/**
 * The background reader: companies with an own site and an open posting, never read or read > REFRESH_DAYS ago, `perRun`
 * at a time, `gapMs` apart. Each answer is stored (ok / none / failed) so a company is not asked again before its time.
 */
export function createCompanyFacts(db, { perRun = 150, gapMs = 1500, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)), log = console } = {}) {
  let running = null;
  let status = { state: "idle", runs: 0, asked: 0, found: 0, none: 0, failed: 0, startedAt: null, finishedAt: null };
  function due() {
    const since = Math.floor(Date.now() / 1000) - REFRESH_DAYS * 86400;
    try {
      return db.prepare(`SELECT co.id, co.name, co.domain FROM companies co
          LEFT JOIN company_facts f ON f.company_id = co.id
          WHERE co.domain IS NOT NULL AND (f.company_id IS NULL OR f.fetched_at < ?)
            AND EXISTS (SELECT 1 FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = co.id AND sj.is_active = 1)
          ORDER BY f.fetched_at IS NOT NULL, co.id LIMIT ?`).all(since, perRun);
    } catch { return []; }
  }
  const store = (id, st, f = {}) => db.prepare(`INSERT INTO company_facts (company_id, wikidata_id, industry, hq, founded, employees, status, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch()) ON CONFLICT(company_id) DO UPDATE SET wikidata_id = excluded.wikidata_id, industry = excluded.industry,
      hq = excluded.hq, founded = excluded.founded, employees = excluded.employees, status = excluded.status, fetched_at = excluded.fetched_at`)
    .run(id, f.wikidataId || null, f.industry || null, f.hq || null, f.founded || null, f.employees || null, st);
  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, asked: 0, found: 0, none: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
    running = (async () => {
      for (const co of due()) {
        const q = factsQuery(co.domain);
        if (!q) { store(co.id, "none"); status.none++; continue; }
        try {
          const r = await fetchImpl(`${ENDPOINT}?format=json&query=${encodeURIComponent(q)}`, { headers: { Accept: "application/sparql-results+json", "User-Agent": UA } });
          status.asked++;
          if (r.status === 429) { log.warn?.("[company-facts] Wikidata asked us to slow down — stopping this run"); break; }
          if (!r.ok) { store(co.id, "failed"); status.failed++; }
          else {
            const f = factsFrom(await r.json());
            if (f) { store(co.id, "ok", f); status.found++; } else { store(co.id, "none"); status.none++; }
          }
        } catch { store(co.id, "failed"); status.failed++; }
        await sleep(gapMs);
      }
      status = { ...status, state: "done", finishedAt: new Date().toISOString() };
      if (status.asked) log.log?.(`[company-facts] (${trigger}) asked ${status.asked}: ${status.found} with facts, ${status.none} none, ${status.failed} failed`);
      running = null;
      return { ...status };
    })();
    return running;
  }
  return { run, status: () => ({ ...status }) };
}

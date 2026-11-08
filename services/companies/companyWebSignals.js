// services/companies/companyWebSignals.js — ⭐ D179 P5c (45l) · LIGHT SIGNALS FROM THE COMPANY'S OWN WEBSITE.
//
// D179 (5) source 3: "their public website (front-end and infrastructure signals from headers and scripts — light,
// labelled as such)". ONE request to the company's own homepage (the domain its record holds), its response headers and
// the first part of its HTML read for well-known markers — a framework's own build marker, a host's own header. Shown on
// the page only as "From their website", never mixed into the postings' evidence (a marketing site's stack is not the
// product team's). Nothing is stored but the marker names. One company a request, `perRun` a day, `gapMs` apart, a
// descriptive User-Agent; re-read after 60 days. Kill switch COMPANY_WEB_SIGNALS=off.
const UA = "Mozilla/5.0 (compatible; draft-company-pages/1.0; +https://jobsviadraft.com)";
export const REFRESH_DAYS = 60;
const MAX_HTML = 600_000;

// [name, test(headers, html)] — each a marker the technology itself writes.
const SIGNALS = [
  ["Next.js", (h, s) => /__NEXT_DATA__|\/_next\/static\//.test(s) || /next\.js/i.test(h["x-powered-by"] || "")],
  ["Nuxt", (h, s) => /__NUXT__|\/_nuxt\//.test(s)],
  ["Gatsby", (h, s) => /___gatsby|gatsby-/.test(s)],
  ["React", (h, s) => /data-reactroot|react-dom(\.production)?(\.min)?\.js|__REACT_DEVTOOLS/.test(s)],
  ["Vue", (h, s) => /data-v-[0-9a-f]{6,}|vue(\.runtime)?(\.global)?(\.prod)?(\.min)?\.js/.test(s)],
  ["Angular", (h, s) => /ng-version=|<app-root/.test(s)],
  ["Svelte", (h, s) => /class="svelte-[a-z0-9]+"|__sveltekit/.test(s)],
  ["WordPress", (h, s) => /wp-content\/|wp-includes\//.test(s)],
  ["Webflow", (h, s) => /data-wf-page|webflow\.js|assets\.website-files\.com/.test(s)],
  ["HubSpot", (h, s) => /js\.hs-scripts\.com|hs-analytics/.test(s)],
  ["Shopify", (h, s) => /cdn\.shopify\.com/.test(s) || !!h["x-shopid"]],
  ["Cloudflare", (h) => !!h["cf-ray"] || /cloudflare/i.test(h.server || "")],
  ["Vercel", (h) => !!h["x-vercel-id"] || /vercel/i.test(h.server || "")],
  ["Netlify", (h) => !!h["x-nf-request-id"] || /netlify/i.test(h.server || "")],
  ["Amazon CloudFront", (h) => /cloudfront/i.test(h.via || "") || !!h["x-amz-cf-id"]],
  ["Fastly", (h) => /fastly/i.test(h["x-served-by"] || "") || !!h["x-fastly-request-id"]],
  ["Akamai", (h) => /akamai/i.test(h.server || "") || !!h["x-akamai-transformed"]],
  ["Nginx", (h) => /^nginx/i.test(h.server || "")],
  ["Google Tag Manager", (h, s) => /googletagmanager\.com\/gtm\.js/.test(s)],
  ["Segment", (h, s) => /cdn\.segment\.com/.test(s)],
  ["Intercom", (h, s) => /widget\.intercom\.io|intercomcdn/.test(s)],
];

/** The markers a homepage shows: [name]. Pure. */
export function signalsIn(headers, html) {
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  const s = String(html || "").slice(0, MAX_HTML);
  return SIGNALS.filter(([, test]) => { try { return test(h, s); } catch { return false; } }).map(([name]) => name);
}

/** The page's block, or null. */
export function companyWebSignals(db, companyId) {
  let r = null;
  try { r = db.prepare(`SELECT signals_json, fetched_at FROM company_web_signals WHERE company_id = ? AND status = 'ok'`).get(companyId); } catch { r = null; }
  if (!r) return null;
  let list = []; try { list = JSON.parse(r.signals_json || "[]"); } catch { list = []; }
  return list.length ? { signals: list, asOf: r.fetched_at } : null;
}

export function createCompanyWebSignals(db, { perRun = 100, gapMs = 1500, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)), log = console } = {}) {
  let running = null;
  let status = { state: "idle", runs: 0, asked: 0, found: 0, none: 0, failed: 0, startedAt: null, finishedAt: null };
  const store = (id, st, list = []) => db.prepare(`INSERT INTO company_web_signals (company_id, signals_json, status, fetched_at)
      VALUES (?, ?, ?, unixepoch()) ON CONFLICT(company_id) DO UPDATE SET signals_json = excluded.signals_json, status = excluded.status,
      fetched_at = excluded.fetched_at`).run(id, JSON.stringify(list), st);
  function due() {
    const since = Math.floor(Date.now() / 1000) - REFRESH_DAYS * 86400;
    try {
      return db.prepare(`SELECT co.id, co.domain FROM companies co LEFT JOIN company_web_signals w ON w.company_id = co.id
          WHERE co.domain IS NOT NULL AND (w.company_id IS NULL OR w.fetched_at < ?)
            AND EXISTS (SELECT 1 FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = co.id AND sj.is_active = 1)
          ORDER BY w.fetched_at IS NOT NULL, co.id LIMIT ?`).all(since, perRun);
    } catch { return []; }
  }
  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, asked: 0, found: 0, none: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
    running = (async () => {
      for (const co of due()) {
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(co.domain || "")) { store(co.id, "none"); status.none++; continue; }
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 8000);
          const r = await fetchImpl(`https://${co.domain}/`, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: ctl.signal });
          const html = (await r.text()).slice(0, MAX_HTML);
          clearTimeout(timer);
          status.asked++;
          const list = r.ok ? signalsIn(Object.fromEntries(r.headers.entries()), html) : [];
          store(co.id, list.length ? "ok" : "none", list);
          if (list.length) status.found++; else status.none++;
        } catch { store(co.id, "failed"); status.failed++; }
        await sleep(gapMs);
      }
      status = { ...status, state: "done", finishedAt: new Date().toISOString() };
      if (status.asked) log.log?.(`[company-web] (${trigger}) read ${status.asked} homepages: ${status.found} with signals`);
      running = null;
      return { ...status };
    })();
    return running;
  }
  return { run, status: () => ({ ...status }) };
}

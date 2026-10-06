// services/jobs/companyLogoStore.js — COMPANY LOGOS, RESOLVED ONCE PER COMPANY, STORED, SERVED FIRST-PARTY (A77).
//
// WHAT WAS MISSING, MEASURED (10-03, the local board): 22 companies, 11 with a logo — exactly the 11 in
// shared/companyLogos.js's hand-kept KNOWN_DOMAINS table. Ramp, Mercury, Duolingo, Wealthfront … showed
// a lettered tile, because a company outside the table had no way to get a logo at all.
//
// THE DESIGN — the owner's: "resolve during enrichment: fetch, cache, and store per company, not per job".
//   1. A DOMAIN, WITH EVIDENCE. Candidates: the known table; the posting's own careers host when it is
//      not an ATS (careers.duolingo.com → duolingo.com); then <name>.com and a few TLDs. ⛔ A candidate
//      counts only if the site's OWN homepage names the company — its <title>, og:site_name or
//      application-name, whole words. "A guess is not a logo" (shared/companyLogos.js): tala.com is
//      not Tala's site, and a confident wrong logo is worse than a letter.
//   2. THE BYTES, NOT A URL. The icon is fetched and STORED (company_logos.bytes) and served from
//      /api/company-logo/<key>. A provider that dies later cannot take stored logos with it, and the
//      board makes no third-party request per card.
//   3. ⛔ A REAL FALLBACK CHAIN. logo.clearbit.com died and its fallback for "unreachable" was Clearbit
//      itself, so 1,290 / 1,296 rows held a dead URL while the code looked fine. Here each provider is a
//      DIFFERENT source — the site's own declared icon, the site's /favicon.ico, then DuckDuckGo's icon
//      service — and when all fail NOTHING is stored: status 'none', the card keeps its letter, and the
//      company is re-tried after RETRY_NONE_DAYS. Per-provider outcomes are counted every pass so a dead
//      provider shows up as zero successes, and scripts/a77LogoProvidersLive.mjs exits 1 when one is dead.
//
// ⛔ NO SVG. Served from our origin, an SVG opened directly is a document that can run script. Only raster
// formats are kept (PNG, ICO, GIF, JPEG, WebP — checked by magic bytes, not by the Content-Type header).

import { KNOWN_DOMAINS, LOGO_HOST } from "../../shared/companyLogos.js";

export const RETRY_NONE_DAYS = 30;
const MAX_BYTES = 200 * 1024;
const MAX_HTML = 3 * 1024 * 1024;   // mercury.com's homepage is 855 KB
const TIMEOUT_MS = 6000;
const UA = "Mozilla/5.0 (compatible; draft-logo/1.0; +https://jobsviadraft.com)";

// Hosts that are an ATS or a job board, never the employer's own site.
const ATS_HOSTS = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com",
  "myworkdayjobs.com", "workday.com", "recruitee.com", "jobvite.com", "icims.com", "bamboohr.com",
  "breezy.hr", "teamtailor.com", "personio.de", "personio.com", "linkedin.com", "indeed.com", "adzuna.com",
  "google.com", "jobo.world", "remoteok.com", "wellfound.com", "ycombinator.com"];
const TWO_LEVEL = ["co.uk", "com.au", "co.in", "com.br", "co.jp", "com.sg"];

// Legal forms only. ⛔ NOT "group" or "holdings": stripping them turned "Match Group" into "match" →
// match.com, a different site from the employer's (mtch.com).
const LEGAL = /\b(inc|llc|ltd|limited|corp|corporation|co|company|the|plc|gmbh|sa|ag|bv)\b\.?/g;

/** The per-company key: lower-case, legal suffixes dropped, one hyphen between words. */
export function companyKey(name) {
  return String(name || "").toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Whole-word, normalised name tokens (legal suffixes dropped) — what the homepage must contain. */
function nameTokens(name) {
  return String(name || "").toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function registrable(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  const parts = h.split(".");
  const two = parts.slice(-2).join(".");
  return TWO_LEVEL.includes(two) ? parts.slice(-3).join(".") : two;
}

function isAtsHost(host) {
  const r = registrable(host);
  return ATS_HOSTS.some(a => r === a || r.endsWith("." + a));
}

/**
 * Candidate domains for a company, best first, each with the EVIDENCE it rests on:
 *   known     — the curated table (shared/companyLogos.js); trusted as written.
 *   careers   — the host of the company's own posting when it is not an ATS (careers.duolingo.com):
 *               the employer itself put the job there. Trusted.
 *   guess     — <name>.com, and ONLY .com. ⛔ The first build also tried .io/.co/.ai/.app, and "Ramp"
 *               resolved to ramp.app — a different, German company titled "Ramp.app" — because ramp.com
 *               serves no <title> to check. A guess is accepted only when its homepage names the company.
 */
export function candidateDomains(company, urls = []) {
  const out = [];
  const add = (domain, evidence) => { if (domain && !out.some(c => c.domain === domain)) out.push({ domain, evidence }); };
  const lower = String(company || "").toLowerCase().trim();
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(lower)) add(domain, "known");
  }
  for (const u of urls) {
    try { const host = new URL(u).hostname; if (!isAtsHost(host)) add(registrable(host), "careers"); } catch { /* not a URL */ }
  }
  const slug = nameTokens(company).replace(/\s+/g, "");
  if (slug) add(`${slug}.com`, "guess");
  return out;
}



/** Does this homepage name the company? Title, og:site_name, application-name — whole words. */
export function homepageNamesCompany(html, company) {
  const want = nameTokens(company);
  if (!want) return false;
  const pick = (re) => (String(html).match(re)?.[1] || "");
  const texts = [
    pick(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i),
    pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{0,200})["']/i),
    pick(/<meta[^>]+content=["']([^"']{0,200})["'][^>]+property=["']og:site_name["']/i),
    pick(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']{0,200})["']/i),
  ].map(t => ` ${t.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]+/g, " ").trim()} `);
  return texts.some(t => t.includes(` ${want} `));
}

/** Icon URLs the page itself declares, best first: apple-touch-icon, then the largest rel=icon. */
export function declaredIcons(html, baseUrl) {
  const links = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
  const attr = (tag, a) => tag.match(new RegExp(`${a}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
  const icons = links.map(tag => ({ rel: attr(tag, "rel").toLowerCase(), href: attr(tag, "href"),
                                    size: Number((attr(tag, "sizes").match(/(\d+)x\d+/) || [])[1]) || 0,
                                    type: attr(tag, "type").toLowerCase() }))
    .filter(l => l.href && /(^|\s)(apple-touch-icon|icon|shortcut icon)(\s|$)/.test(l.rel) && !/svg/.test(l.type) && !/\.svg(\?|$)/i.test(l.href));
  icons.sort((a, b) => (b.rel.includes("apple-touch-icon") - a.rel.includes("apple-touch-icon")) || (b.size - a.size));
  const out = [];
  for (const l of icons) { try { const u = new URL(l.href, baseUrl).href; if (!out.includes(u)) out.push(u); } catch { /* bad href */ } }
  return out;
}

/** The image type from its first bytes, or null — SVG and HTML are refused by construction. */
export function sniffImage(buf) {
  const b = Buffer.from(buf);
  if (b.length < 8) return null;
  if (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "image/x-icon";
  if (b.toString("latin1", 0, 3) === "GIF") return "image/gif";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function get(fetchImpl, url, { max }) {
  const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max) throw new Error(`too large (${buf.length} bytes)`);
  return { buf, url: res.url || url };
}

/**
 * The providers, in order. Each takes (domain, ctx) and returns a URL to try, or null. They are
 * DIFFERENT SOURCES so that one failing never makes the next fail too.
 */
export const PROVIDERS = Object.freeze([
  { name: "site-declared", urls: (domain, ctx) => ctx.declared || [] },
  { name: "site-favicon",  urls: (domain) => [`https://${domain}/favicon.ico`] },
  { name: "duckduckgo",    urls: (domain) => [`${LOGO_HOST}/${domain}.ico`] },
]);

/**
 * Resolve ONE company: find a domain the company's own homepage confirms, then the first provider
 * that returns real image bytes. Never throws.
 * @returns {{ status:'ok', domain, provider, mime, bytes } | { status:'none', error, attempts }}
 */
export async function resolveCompanyLogo(company, urls, { fetchImpl = globalThis.fetch, stats = null } = {}) {
  const attempts = [];
  const tally = (provider, ok) => { if (stats) { const s = (stats[provider] ||= { ok: 0, failed: 0 }); s[ok ? "ok" : "failed"]++; } };
  for (const { domain, evidence } of candidateDomains(company, urls)) {
    const trusted = evidence !== "guess";
    let declared = [];
    // The homepage is the EVIDENCE for an unknown domain, and the source of its declared icons.
    try {
      const page = await get(fetchImpl, `https://${domain}/`, { max: MAX_HTML });
      const html = page.buf.toString("utf8");
      if (!trusted && !homepageNamesCompany(html, company)) { attempts.push(`${domain}: homepage does not name ${company}`); continue; }
      declared = declaredIcons(html, page.url);
    } catch (e) {
      if (!trusted) { attempts.push(`${domain}: ${e.message}`); continue; }
    }
    for (const p of PROVIDERS) {
      for (const url of p.urls(domain, { declared })) {
        try {
          const { buf } = await get(fetchImpl, url, { max: MAX_BYTES });
          const mime = sniffImage(buf);
          if (!mime) throw new Error("not a raster image");
          tally(p.name, true);
          return { status: "ok", domain, provider: p.name, mime, bytes: buf };
        } catch (e) { tally(p.name, false); attempts.push(`${p.name} ${url}: ${e.message}`); }
      }
    }
    // The domain is the company's, but nothing served an icon: no further candidate can be more right.
    return { status: "none", domain, error: "no provider returned an image", attempts };
  }
  return { status: "none", domain: null, error: "no domain the company's own site confirms", attempts };
}

export const LOGO_ROUTE = "/api/company-logo/";
export const logoPath = (key) => `${LOGO_ROUTE}${encodeURIComponent(key)}`;

/**
 * One enrichment pass: every company on the active board with no stored row (or a 'none' older than
 * RETRY_NONE_DAYS), up to `limit`. Stores per company; points that company's rows at the stored logo
 * unless a row carries a FEED logo (a LinkedIn / serpapi CDN URL, which is better than anything here).
 */
export async function resolveCompanyLogos(db, { fetchImpl = globalThis.fetch, limit = 40, now = Math.floor(Date.now() / 1000) } = {}) {
  const stats = {};
  const companies = db.prepare(`
    SELECT sj.company AS company, GROUP_CONCAT(COALESCE(sj.url, '') || ' ' || COALESCE(sj.apply_url, ''), ' ') AS urls
    FROM scraped_jobs sj
    WHERE sj.is_active = 1 AND sj.company IS NOT NULL AND TRIM(sj.company) != ''
    GROUP BY sj.company`).all();
  const existing = db.prepare("SELECT status, checked_at FROM company_logos WHERE company_key = ?");
  const due = companies.filter(c => {
    const key = companyKey(c.company);
    if (!key) return false;
    const row = existing.get(key);
    return !row || (row.status === "none" && now - row.checked_at > RETRY_NONE_DAYS * 86400);
  }).slice(0, limit);

  let ok = 0, none = 0;
  for (const c of due) {
    const urls = String(c.urls || "").split(/\s+/).filter(Boolean);
    const r = await storeCompanyLogo(db, c.company, urls, { fetchImpl, stats, now });
    if (r.status === "ok") ok++; else none++;
  }
  // ⛔ A PROVIDER WITH ATTEMPTS AND NO SUCCESS IS NAMED. This is the line that would have caught Clearbit.
  const dead = Object.entries(stats).filter(([, s]) => s.ok === 0 && s.failed >= 5).map(([p]) => p);
  return { scanned: due.length, ok, none, providers: stats, dead };
}

/** Resolve, store and point ONE company's logo — the pass above and a capture share it. */
async function storeCompanyLogo(db, company, urls, { fetchImpl = globalThis.fetch, stats = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const key = companyKey(company);
  const r = await resolveCompanyLogo(company, urls, { fetchImpl, stats });
  db.prepare(`
    INSERT INTO company_logos (company_key, company, domain, status, provider, mime, bytes, error, checked_at)
    VALUES (@company_key, @company, @domain, @status, @provider, @mime, @bytes, @error, @checked_at)
    ON CONFLICT(company_key) DO UPDATE SET company = excluded.company, domain = excluded.domain,
      status = excluded.status, provider = excluded.provider, mime = excluded.mime, bytes = excluded.bytes,
      error = excluded.error, checked_at = excluded.checked_at`)
    .run({ company_key: key, company, domain: r.domain ?? null, status: r.status,
           provider: r.provider ?? null, mime: r.mime ?? null, bytes: r.bytes ?? null,
           error: r.status === "ok" ? null : `${r.error}${r.attempts?.length ? ` — ${r.attempts.slice(0, 4).join("; ")}` : ""}`.slice(0, 1000),
           checked_at: now });
  // A row's own feed logo is kept; NULL, a known-table URL and a retired host are ours to repoint.
  if (r.status === "ok") {
    db.prepare(`
      UPDATE scraped_jobs SET company_icon_url = ?
      WHERE company = ? AND (company_icon_url IS NULL OR company_icon_url LIKE ? OR company_icon_url LIKE ?
                             OR company_icon_url LIKE 'https://logo.clearbit.com/%' OR company_icon_url LIKE 'https://www.google.com/s2/favicons%')`)
      .run(logoPath(key), company, `${LOGO_HOST}/%`, `${LOGO_ROUTE}%`);
  }
  return r;
}

/**
 * ⭐ D41(c) · A CAPTURED COMPANY'S LOGO IS QUEUED AT CAPTURE TIME. The background pass reaches a
 * company only every 6 hours, 40 at a time, so a company the board never crawled waited — and showed
 * its letter tile — for hours. `urls` carries the capture's own addresses and, when the page named
 * it (JSON-LD hiringOrganization), the EMPLOYER'S SITE — which candidateDomains trusts as the
 * company's own. ⛔ ATS hosts are never candidates (isAtsHost), so a Greenhouse or Ashby mark is never
 * any company's logo. Skips a company already stored. Never throws; the letter tile stands meanwhile.
 * @returns {Promise<{ status: string } | null>} null when nothing was attempted
 */
export async function resolveCaptureLogo(db, { company, urls = [] }, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const key = companyKey(company);
    if (!key) return null;
    const row = db.prepare("SELECT status FROM company_logos WHERE company_key = ?").get(key);
    if (row?.status === "ok") return null;
    return await storeCompanyLogo(db, company, urls.filter(Boolean), { fetchImpl });
  } catch (e) {
    console.warn(`[logos] capture logo for ${company} failed (the letter tile stands): ${e.message}`);
    return null;
  }
}

/** The stored logo for a key, or null. */
export function storedLogo(db, key) {
  return db.prepare("SELECT mime, bytes FROM company_logos WHERE company_key = ? AND status = 'ok' AND bytes IS NOT NULL").get(String(key || "")) || null;
}

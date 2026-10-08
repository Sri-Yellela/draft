// services/jobs/hnDiscovery.js — ⛔ D82 B · HN "Who is hiring?" discovery, the parsing core.
//
// The server-side successor to the owner's attended console scripts (hn_sweep.js, hn_sweep2.js — D80 C).
// Those scripts were not committed (they ran in the owner's clean browser profile), so this is built from
// D80 C's description of them and the CSV they produced (hn_candidates_v2.csv): the public Algolia HN API,
// the thread list, the last 12 monthly "Ask HN: Who is hiring?" threads, and HN's own JOBS feed (the
// "X (YC S22) is hiring" ads). Output per company: sources · n_months · recent4 · last month · YC batch ·
// ATS pair · site · remote · US hint · header — the v2 CSV's columns.
//
// ⛔ What this file does NOT do: it writes nothing. It parses, and `collectHn` reads the API through an
// injected `fetchJson` with a spacing `sleep` between requests — so every function here runs offline in a
// test. Pooling (dedup, exclusions, the candidate table) is services/companyCandidates.js; adding a company
// stays the owner's approval through services/companyList.js addCompany (D80).
//
// ⛔ ONE PARSER for an ATS link: harvestPairOf (services/slugHarvest.js), the same one the slug harvest and
// the crawler's J1 results use. A ycombinator.com/companies page is a PROFILE, not a job board, and
// harvestPairOf returns null for it — the bug hn_sweep2's tests caught (D80 C).
import { harvestPairOf } from "../slugHarvest.js";

export const HN_API = "https://hn.algolia.com/api/v1";
export const THREAD_MONTHS = 12;
export const RECENT_MONTHS = 4;
export const JOBS_FEED_DAYS = 150;
export const REQUEST_GAP_MS = 1500;
/** The thread list + 12 monthly threads + the jobs feed. Nothing past this is ever requested. */
export const MAX_REQUESTS = 1 + THREAD_MONTHS + 1;

// ⛔ D80 C / D82 E: never a source whose terms forbid automated access or redistribution. A link to one of
// these is never a candidate's board and never its site.
export const DENIED_HOSTS = Object.freeze(["linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com",
  "remotive.com", "remoteok.com", "remoteok.io", "wellfound.com", "angel.co", "workatastartup.com"]);

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export const threadListUrl = () => `${HN_API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=100`;
export const itemUrl = (id) => `${HN_API}/items/${encodeURIComponent(String(id))}`;
export const jobsFeedUrl = (sinceEpoch) =>
  `${HN_API}/search_by_date?tags=job&numericFilters=created_at_i>${Math.floor(sinceEpoch)}&hitsPerPage=1000`;

/** "Ask HN: Who is hiring? (October 2026)" → "2026-10"; anything else (Who wants to be hired, Freelancer) → null. */
export function hiringThreadMonth(title) {
  const m = String(title || "").match(/^Ask HN:\s*Who is hiring\?\s*\(([A-Za-z]+)\s+(\d{4})\)/i);
  if (!m) return null;
  const i = MONTHS.indexOf(m[1].toLowerCase());
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

/** The newest `months` monthly threads from the thread list, one per month, newest first. */
export function pickHiringThreads(hits, months = THREAD_MONTHS) {
  const byMonth = new Map();
  for (const h of Array.isArray(hits) ? hits : []) {
    const month = hiringThreadMonth(h?.title);
    const id = h?.objectID ?? h?.story_id ?? h?.id;
    if (!month || id == null) continue;
    if (!byMonth.has(month)) byMonth.set(month, { id: String(id), month });
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, months);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

/** HN comment HTML → plain lines. A link becomes its href (the visible text is often truncated "…"). */
export function hnText(html) {
  return decodeEntities(String(html || "")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi, (_, href) => ` ${decodeEntities(href)} `)
    .replace(/<p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'|]+/gi;
export function urlsIn(text) {
  return [...String(text || "").matchAll(URL_RE)].map((m) => m[0].replace(/[).,;:!?\]]+$/, ""));
}
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
export const isDeniedHost = (host, extra = []) => {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  return [...DENIED_HOSTS, ...extra].some((d) => h === d || h.endsWith("." + d));
};

// CS-looking (D78 B's families, loosely — the probe's classifier decides per posting later).
const CS_RE = /\b(engineer(?:ing)?s?|developers?|software|swe|sre|devops|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|infra(?:structure)?|platform|machine learning|ml|ai|data (?:scien|engineer|analy)\w*|security|mobile|ios|android|embedded|firmware|qa|sdet|cto|technical|research scientist)\b/i;
const US_RE = /\b(US|USA|U\.S\.A?\.?|United States|North America|Americas|NYC|New York|San Francisco|SF|Bay Area|Silicon Valley|Seattle|Austin|Boston|Chicago|Denver|Los Angeles|Atlanta|Washington,? DC|DC|Miami|Portland|San Diego|Palo Alto|Mountain View|Menlo Park|Berkeley|Oakland|Pittsburgh|Philadelphia|Salt Lake|Phoenix|Dallas|Houston|Minneapolis|Raleigh|EST|PST|ET|PT)\b|,\s*(?:CA|NY|WA|TX|MA|IL|CO|GA|FL|OR|NC|VA|PA|UT|AZ|MN|MI|OH|NJ|MD|DC)\b/;
const NON_US_RE = /\b(UK|United Kingdom|London|Europe|EU|EMEA|Germany|Berlin|Munich|France|Paris|Netherlands|Amsterdam|Spain|Madrid|Barcelona|Portugal|Lisbon|Poland|Warsaw|Sweden|Stockholm|Denmark|Copenhagen|Switzerland|Zurich|Ireland|Dublin|Canada only|India|Bangalore|Bengaluru|Singapore|Japan|Tokyo|Australia|Sydney|Melbourne|Israel|Tel Aviv|Brazil|Mexico|Argentina|APAC|LATAM)\b/;

/** A company name from the header's first segment: no URL, no "(YC S18, …)", no trailing " - tagline". */
export function cleanCompany(seg) {
  let s = String(seg || "").replace(URL_RE, " ").replace(/\([^)]*\)/g, " ").replace(/\s[-–—:]\s.*$/, "")
    .replace(/\s+/g, " ").trim().replace(/^[\s"'*]+|[\s"'*.,;:]+$/g, "");
  if (!s || s.length > 60 || /^(remote|onsite|hybrid|full[- ]?time|part[- ]?time|contract)\b/i.test(s)) return null;
  return s;
}
export function ycBatchOf(text) {
  const m = String(text || "").match(/\bYC\s*[-,]?\s*([SWFX]\s?\d{2})\b/i);
  return m ? m[1].replace(/\s/g, "").toUpperCase() : null;
}

/** The first supported ATS pair among the urls, the first unsupported vendor, and the company's own site. */
export function linksOf(urls) {
  let ats = null, other = null, site = null;
  for (const u of urls) {
    const host = hostOf(u);
    if (!host || isDeniedHost(host) || /(^|\.)(news\.)?ycombinator\.com$/.test(host)) continue;
    const pair = harvestPairOf(u);
    if (pair?.atsType) { if (!ats) ats = { atsType: pair.atsType, slug: pair.slug, url: u }; continue; }
    if (pair?.unsupported) { if (!other) other = pair.unsupported; continue; }
    if (!site) site = u;
  }
  return { ats, other, site };
}

/**
 * One top-level "Who is hiring?" post. @returns null for a post that is not a hiring post we keep, or
 * { company, header, ats, other, site, remote, usHint, yc } — ⛔ kept only when it looks like a CS role and
 * is not clearly outside the US (D80 C: "the probe and the US gate decide the rest").
 */
export function parsePost(html) {
  const text = hnText(html);
  if (!text) return null;
  const header = text.split("\n")[0].slice(0, 240);
  const company = cleanCompany(header.split("|")[0]);
  if (!company) return null;
  const body = text.slice(0, 3000);
  if (!CS_RE.test(body)) return null;
  const usHint = US_RE.test(header);
  if (!usHint && NON_US_RE.test(header)) return null;
  return { company, header, ...linksOf(urlsIn(text)), remote: /\bremote\b/i.test(header), usHint, yc: ycBatchOf(header) };
}

/** One jobs-feed ad: "Tasklet (YC S24) Is Hiring a Design Engineer". */
export function parseJobAd(hit) {
  const title = String(hit?.title || "");
  const m = title.match(/^(.+?)\s*(?:\((?:YC\s*)?[SWFX]\d{2}\))?\s+(?:is|are)\s+hiring\b/i);
  if (!m) return null;
  const company = cleanCompany(m[1]);
  if (!company) return null;
  const text = `${title}\n${hnText(hit?.story_text || "")}`;
  if (!CS_RE.test(text)) return null;
  const urls = [hit?.url, ...urlsIn(text)].filter(Boolean);
  const usHint = US_RE.test(text);
  if (!usHint && NON_US_RE.test(title)) return null;
  return { company, header: title, ...linksOf(urls), remote: /\bremote\b/i.test(text), usHint, yc: ycBatchOf(title), jobUrl: hit?.url || null };
}

export const nameKey = (s) => String(s || "").toLowerCase().replace(/\b(inc|llc|ltd|corp|co|labs?|technologies|hq)\b\.?/g, "").replace(/[^a-z0-9]+/g, "");

/**
 * Merge per-month sightings into one row per company. `entries`: { ...parsePost(), month, via: "who"|"jobs" }.
 * `recentMonths`: the newest RECENT_MONTHS thread months — recent4 counts the months seen among them.
 */
export function mergeCandidates(entries, { recentMonths = [] } = {}) {
  const recent = new Set(recentMonths);
  const byName = new Map();
  for (const e of entries) {
    const k = nameKey(e.company);
    if (!k) continue;
    const c = byName.get(k) || { company: e.company, sources: { who: 0, jobs: 0 }, months: new Set(), last: null, yc: null,
      ats: null, other: null, site: null, remote: false, usHint: false, header: e.header, jobUrl: null };
    c.sources[e.via] = (c.sources[e.via] || 0) + 1;
    if (e.month) { c.months.add(e.month); if (!c.last || e.month > c.last) { c.last = e.month; c.header = e.header; } }
    c.yc ||= e.yc; c.ats ||= e.ats; c.other ||= e.other; c.site ||= e.site; c.jobUrl ||= e.jobUrl || null;
    c.remote ||= e.remote; c.usHint ||= e.usHint;
    byName.set(k, c);
  }
  return [...byName.values()].map((c) => ({ ...c, months: [...c.months].sort(), n_months: c.months.size,
    recent4: [...c.months].filter((m) => recent.has(m)).length }))
    .sort((a, b) => b.n_months - a.n_months || b.recent4 - a.recent4 || a.company.localeCompare(b.company));
}

const monthOfEpoch = (s) => new Date(s * 1000).toISOString().slice(0, 7);

/**
 * Read HN: the thread list, the last `months` threads, the jobs feed — spaced by `sleep(gapMs)`, never more
 * than MAX_REQUESTS. `fetchJson(url)` is injected (axios in production, a fixture in tests).
 * @returns {{ candidates, threads, feed, requests, errors }} — throws only when the thread list itself fails.
 */
export async function collectHn({ fetchJson, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), gapMs = REQUEST_GAP_MS,
                                  now = Math.floor(Date.now() / 1000), months = THREAD_MONTHS } = {}) {
  const requests = [];
  const errors = [];
  const get = async (url) => {
    if (requests.length >= MAX_REQUESTS) throw new Error("request budget spent");
    if (requests.length) await sleep(gapMs);
    requests.push(url);
    return fetchJson(url);
  };
  const list = await get(threadListUrl());
  const threads = pickHiringThreads(list?.hits, Math.min(months, THREAD_MONTHS));
  const entries = [];
  const threadLog = [];
  for (const t of threads) {
    try {
      const item = await get(itemUrl(t.id));
      const posts = (item?.children || []).filter((c) => c && c.text);
      let kept = 0;
      for (const p of posts) {
        const parsed = parsePost(p.text);
        if (parsed) { kept++; entries.push({ ...parsed, month: t.month, via: "who" }); }
      }
      threadLog.push({ ...t, posts: posts.length, kept });
    } catch (e) { errors.push({ url: itemUrl(t.id), error: e.message }); threadLog.push({ ...t, error: e.message }); }
  }
  const feed = { ads: 0, kept: 0 };
  try {
    const jobs = await get(jobsFeedUrl(now - JOBS_FEED_DAYS * 86400));
    for (const h of jobs?.hits || []) {
      feed.ads++;
      const parsed = parseJobAd(h);
      if (parsed) { feed.kept++; entries.push({ ...parsed, month: h.created_at_i ? monthOfEpoch(h.created_at_i) : null, via: "jobs" }); }
    }
  } catch (e) { errors.push({ url: "jobs feed", error: e.message }); feed.error = e.message; }
  const candidates = mergeCandidates(entries, { recentMonths: threads.slice(0, RECENT_MONTHS).map((t) => t.month) });
  return { candidates, threads: threadLog, feed, requests, errors };
}

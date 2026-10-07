// crawler/lib/fetcher.js — ⛔ D75 · THE ONLY WAY THE WORKER TOUCHES THE WEB.
//
// Every page request — J1's careers pages, J2's Apply hop — goes through fetchPage, which in order:
//   1. stops if the kill switch is on (asked of draft BEFORE every page: "within one page");
//   2. stops if the task's page / byte / time budget is spent (`error: budget`, never a hang);
//   3. refuses a deny-listed host, and an SSRF target (guards.checkUrl);
//   4. reads robots.txt for the origin (once per origin, cached) and refuses a disallowed path —
//      the disallowed path is NEVER requested;
//   5. waits out the per-host rate limit (default 2 s, or the site's Crawl-delay if longer);
//   6. follows redirects BY HAND, re-running 3 and 4 on every hop;
//   7. treats a bot challenge as `blocked` — it never solves, waits out or retries one.
// It records an AUDIT entry per request — `navigate` or `apply`, the URL without its query — and
// there is no other kind: the worker has no code that types, submits or clicks (D75's interaction test).
import { USER_AGENT, checkUrl, deniedBy, parseRobots, robotsVerdict, recordUrl } from "./guards.js";

export class CrawlStop extends Error {
  constructor(code, detail = "") { super(`${code}${detail ? ": " + detail : ""}`); this.code = code; }
}

const CHALLENGE = /(cf-chl|challenge-platform|captcha|are you a robot|verify you are human|px-captcha|datadome)/i;

export function createFetcher({
  fetchImpl = globalThis.fetch, allowHosts = new Set(), deny = [], resolve,
  budget = { pages: 25, bytes: 5_000_000, ms: 120_000 }, rateMs = 2000, maxRedirects = 5,
  isPaused = async () => false, now = () => Date.now(), sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  dryRun = false, log = () => {},
} = {}) {
  const started = now();
  const spent = { pages: 0, bytes: 0 };
  const audit = [];
  const robotsCache = new Map();          // origin → groups
  const lastHit = new Map();              // host → ms
  const hostDelay = new Map();            // host → ms (Crawl-delay)

  async function guard(url) {
    const d = deniedBy(url, deny);
    if (d) throw new CrawlStop("denied", d);
    const c = await checkUrl(url, { allowHosts, resolve, staticOnly: dryRun });
    if (!c.ok) throw new CrawlStop("refused", c.reason);
  }
  async function pace(host) {
    const wait = Math.max(rateMs, hostDelay.get(host) || 0) - (now() - (lastHit.get(host) || -Infinity));
    if (wait > 0) await sleep(wait);
    lastHit.set(host, now());
  }
  function charge(bytes = 0) {
    if (spent.pages >= budget.pages) throw new CrawlStop("budget", "pages");
    if (now() - started > budget.ms) throw new CrawlStop("budget", "time");
    spent.pages++; spent.bytes += bytes;
    if (spent.bytes > budget.bytes) throw new CrawlStop("budget", "bytes");
  }
  async function raw(url) {
    const r = await fetchImpl(url, { redirect: "manual", headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.5" } });
    const text = await r.text();
    return { status: r.status, location: r.headers.get("location"), type: r.headers.get("content-type") || "", text };
  }
  async function robotsAllow(u) {
    if (!robotsCache.has(u.origin)) {
      let groups = [];
      try {
        await guard(`${u.origin}/robots.txt`);
        const r = await raw(`${u.origin}/robots.txt`);
        if (r.status >= 200 && r.status < 300) groups = parseRobots(r.text);
        // ⚠ A 401/403 on robots.txt is read as "disallow all" (the conservative reading); 404 = allow all.
        if (r.status === 401 || r.status === 403) groups = [{ agents: ["*"], rules: [{ allow: false, path: "/" }], delay: null }];
      } catch (e) { if (e instanceof CrawlStop) throw e; }
      robotsCache.set(u.origin, groups);
    }
    const v = robotsVerdict(robotsCache.get(u.origin), u.pathname);
    if (v.delaySeconds) hostDelay.set(u.host, v.delaySeconds * 1000);
    return v.allowed;
  }

  /**
   * @param {string} url
   * @param {{ kind?: "navigate" | "apply" }} opts
   * @returns {Promise<{ url: string, status: number, html: string, hops: { from: string, to: string, status: number }[] }>}
   */
  async function fetchPage(url, { kind = "navigate" } = {}) {
    if (await isPaused()) throw new CrawlStop("paused");
    let current = new URL(url, "http://invalid.invalid").href;
    const hops = [];
    for (let i = 0; i <= maxRedirects; i++) {
      await guard(current);
      const u = new URL(current);
      // ⛔ D75 STEP 0b: a dry run makes NO network request — not robots.txt, not the page. It records what it would do.
      if (dryRun) {
        charge();
        audit.push({ kind: i === 0 ? kind : "redirect", url: recordUrl(current), dryRun: true });
        log(`[dry-run] would read robots.txt for ${u.origin}, then GET ${recordUrl(current)}`);
        return { url: current, status: 0, html: "", hops };
      }
      if (!(await robotsAllow(u))) throw new CrawlStop("robots", recordUrl(current));
      charge();
      audit.push({ kind: i === 0 ? kind : "redirect", url: recordUrl(current) });
      await pace(u.host);
      const r = await raw(current);
      spent.bytes += r.text.length;
      if (spent.bytes > budget.bytes) throw new CrawlStop("budget", "bytes");
      if (r.status >= 300 && r.status < 400 && r.location) {
        const next = new URL(r.location, current).href;
        hops.push({ from: recordUrl(current), to: recordUrl(next), status: r.status });
        current = next;
        continue;
      }
      if ((r.status === 403 || r.status === 429 || r.status === 503) && CHALLENGE.test(r.text)) throw new CrawlStop("blocked", String(r.status));
      if (CHALLENGE.test(r.text) && r.text.length < 20000 && !/<a\s/i.test(r.text)) throw new CrawlStop("blocked", "challenge");
      return { url: current, status: r.status, html: r.type.includes("html") || /^\s*</.test(r.text) ? r.text : "", hops };
    }
    throw new CrawlStop("error", "too_many_redirects");
  }

  return { fetchPage, guard, audit, spent };
}

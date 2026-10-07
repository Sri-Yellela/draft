// crawler/lib/j1.js — ⛔ D75 J1 · FIND A COMPANY'S BOARD. The ladder, browser LAST (docs/CRAWLER_WORKER.md §4):
//   1. plain HTTP over the company's careers paths — every link, script and iframe that points at a known ATS;
//   2. careers-shaped links followed to a depth of two, same site only;
//   3. only if that found nothing AND a page looked client-rendered: the browser stage (browser.js), which
//      reads the page's own NETWORK requests — the strongest evidence there is.
// It reports EVIDENCE (where an ATS URL was seen, and how). Draft names the (vendor, slug) from it.
import { isAtsUrl } from "./atsHosts.js";
import { extractRefs, looksClientRendered } from "./html.js";
import { recordUrl } from "./guards.js";
import { CrawlStop } from "./fetcher.js";

export const CAREERS_PATHS = Object.freeze(["/careers", "/jobs", "/careers/jobs", "/join-us"]);
const CAREERS_LINK = /\b(careers?|jobs|openings|open roles|join (us|the team)|work with us|positions)\b/i;

/**
 * @param {{ baseUrl: string }} task
 * @param {{ fetchPage: Function }} fetcher
 * @param {{ browser?: { networkUrls(url: string): Promise<string[]> } }} [opts]
 */
export async function findBoard({ baseUrl }, fetcher, { browser = null, maxDepth = 2 } = {}) {
  const base = new URL(baseUrl);
  const root = base.pathname.replace(/\/+$/, "");
  const evidence = [], seen = new Set();
  let careersUrl = null, clientRendered = null;
  const note = (url, how) => { const r = recordUrl(url); if (!evidence.some(e => e.url === r)) evidence.push({ url: r, how }); };

  async function visit(url, depth) {
    if (seen.has(url) || depth > maxDepth) return;
    seen.add(url);
    let page;
    try { page = await fetcher.fetchPage(url); }
    catch (e) { if (e instanceof CrawlStop && ["refused", "robots"].includes(e.code)) return; throw e; }
    for (const h of page.hops) if (isAtsUrl(h.to)) note(h.to, "redirect");
    if (isAtsUrl(page.url)) { careersUrl ??= recordUrl(url); return; }
    if (page.status >= 400 || !page.html) return;
    const refs = extractRefs(page.html, page.url);
    const before = evidence.length;
    for (const r of refs) if (isAtsUrl(r.url)) note(r.url, r.how);
    if (evidence.length > before) { careersUrl ??= recordUrl(page.url); return; }
    if (looksClientRendered(page.html) && clientRendered == null) clientRendered = page.url;
    for (const r of refs) {
      if (r.how !== "link") continue;
      let u; try { u = new URL(r.url); } catch { continue; }
      if (u.host !== base.host) continue;
      if (CAREERS_LINK.test(r.text) || CAREERS_LINK.test(u.pathname)) await visit(u.href.split("#")[0], depth + 1);
      if (evidence.length) return;
    }
  }

  try {
    for (const p of CAREERS_PATHS) {
      await visit(new URL(root + p, base.origin).href, 1);
      if (evidence.length) break;
    }
    if (!evidence.length && clientRendered && browser) {
      for (const u of await browser.networkUrls(clientRendered)) if (isAtsUrl(u)) note(u, "network");
      if (evidence.length) careersUrl = recordUrl(clientRendered);
    }
  } catch (e) {
    if (e instanceof CrawlStop && e.code === "blocked") return { status: "blocked", careersUrl, evidence, needsBrowser: false };
    return { status: "error", error: String(e?.message || e).slice(0, 200), careersUrl, evidence, needsBrowser: false };
  }
  return { status: evidence.length ? "found" : "none", careersUrl, evidence,
           needsBrowser: !evidence.length && !!clientRendered && !browser };
}

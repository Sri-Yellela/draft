// extension/autoCapture.js — ⭐ D64 · AUTOMATED CAPTURE, the extension's half.
//
// Owner, 10-07: capture a job page automatically when it is opened, check it against the user's board,
// and put it there without a click. ⛔ It reverses decision A, the held-off auto-start and the LinkedIn /
// Indeed refusal (AUTOFILL_TARGET.md §8.6) — with these guard rails:
//
//   1. OFF BY DEFAULT. Switched on in Options, which asks Chrome for OPTIONAL host access to the origins
//      below — at that moment, by the user's click (chrome.permissions.request). ⛔ Never <all_urls>,
//      never in the install-time manifest. Switching it off removes the access again.
//   2. ⛔ NOTHING LEAVES THE BROWSER UNLESS THE PAGE IS A POSTING. A page on these origins is a posting
//      when its URL has a known posting shape, or it carries JobPosting JSON-LD. Anything else sends
//      nothing — not the URL, not a hash.
//   3. Relevance is the SERVER's call, against the user's board; an irrelevant posting is discarded there
//      and never stored (services/jobs/autoCapture.js).
//   4. Auto-capture is NOT auto-apply: nothing here fills or submits (D36). Fill still takes a click.
//
// ⛔ THE ORIGINS ARE PUBLIC POSTING HOSTS ONLY. Gated portals — Workday, Amazon, SmartRecruiters, iCIMS,
// Taleo, Meta — are where the user SIGNS IN and the gated handoff fills; the extension deliberately holds
// no standing access to any of them (MANIFEST_RATIONALE.md, test/manifestMinimumPermission.test.js), and
// automatic capture does not change that. Those stay manual (the toolbar / Ctrl+Shift+K) until the owner
// decides otherwise. LinkedIn and Indeed likewise: not in this list.
//
// This file has no top-level `chrome` use, so node tests import it directly.

export const AUTO_CAPTURE_SETTING = "autoCaptureEnabled";

/** The optional host permissions — each an origin pattern, each a public job-posting host. */
export const AUTO_CAPTURE_ORIGINS = Object.freeze([
  "https://boards.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://jobs.lever.co/*",
  "https://jobs.ashbyhq.com/*",
  "https://apply.workable.com/*",
]);

// A posting's URL, per host — the detail page of one job, not a company's list or an application step.
const POSTING_SHAPES = [
  { host: /^(?:boards|job-boards)\.greenhouse\.io$/i, path: /^\/[^/]+\/jobs\/\d+\/?$/ },
  { host: /^jobs\.lever\.co$/i, path: /^\/[^/]+\/[0-9a-f-]{36}\/?$/i },
  { host: /^jobs\.ashbyhq\.com$/i, path: /^\/[^/]+\/[0-9a-f-]{36}\/?$/i },
  { host: /^apply\.workable\.com$/i, path: /^\/[^/]+\/j\/[0-9A-F]+\/?$/i },
];

function parse(url) {
  try { const u = new URL(url); return u.protocol === "https:" ? u : null; } catch { return null; }
}

/** The origin pattern in AUTO_CAPTURE_ORIGINS that covers this URL, or null. */
export function autoCaptureOriginFor(url) {
  const u = parse(url);
  if (!u) return null;
  return AUTO_CAPTURE_ORIGINS.find(p => new URL(p.replace("/*", "/")).hostname === u.hostname.toLowerCase()) || null;
}

/** Does the URL itself say "this is one posting"? (No page read needed.) */
export function hasPostingUrlShape(url) {
  const u = parse(url);
  if (!u) return false;
  return POSTING_SHAPES.some(s => s.host.test(u.hostname) && s.path.test(u.pathname));
}

/**
 * The decision BEFORE any page is read: may this tab be considered at all? Pure.
 * @returns {"skip"|"by_url"|"check_page"}
 *   skip        — off, not https, not one of our origins, or access not granted: NOTHING happens.
 *   by_url      — the URL is a posting shape: read and send it.
 *   check_page  — our origin, but the URL does not say: read the page's JSON-LD locally first.
 */
export function autoCaptureStep({ enabled, url, granted }) {
  if (!enabled || !granted) return "skip";
  if (!autoCaptureOriginFor(url)) return "skip";
  return hasPostingUrlShape(url) ? "by_url" : "check_page";
}

/**
 * INJECTED into the page (must be self-contained — chrome.scripting serialises it). True when the page
 * carries a schema.org JobPosting in JSON-LD. Reads only the page's own script tags; sends nothing.
 */
export function pageHasJobPosting() {
  const isPosting = (n) => {
    if (!n || typeof n !== "object") return false;
    if (Array.isArray(n)) return n.some(isPosting);
    const t = n["@type"];
    if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return true;
    return isPosting(n["@graph"]);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { if (isPosting(JSON.parse(s.textContent || "null"))) return true; } catch { /* not JSON */ }
  }
  return false;
}

/** One attempt per URL per service-worker life — the server brakes per day; this saves the round trip. */
export function createSeenSet(limit = 500) {
  const seen = new Set();
  return {
    has: (url) => seen.has(url),
    add: (url) => { seen.add(url); if (seen.size > limit) seen.delete(seen.values().next().value); },
  };
}

/** THE ONE WRITE of the setting (Options' switch, and the background when Chrome's access is removed).
 *  One key, one write site — the privacy policy counts write sites (test/privacyReconciliation). */
export async function setAutoCaptureSetting(on) {
  await chrome.storage.local.set({ [AUTO_CAPTURE_SETTING]: !!on });
}

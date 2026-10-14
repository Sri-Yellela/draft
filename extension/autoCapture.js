// extension/autoCapture.js — ⭐ D64 · AUTOMATED CAPTURE — now one of D97's four switches (extension/autoRead.js).
//
// Owner, 10-07: capture a job page automatically when it is opened, check it against the user's board, and put it
// there without a click. Owner, 10-13 (D97): that became "Capture jobs automatically — to MY account", one of four
// per-site switches, and Workday joined the five public posting hosts. ⛔ The guard rails are unchanged:
//
//   1. OFF BY DEFAULT, per site, switched on in Options, which asks Chrome for that site's OPTIONAL host access at the
//      user's click (chrome.permissions.request). ⛔ Never <all_urls>, never in the install-time manifest. Switching
//      it off gives the access back.
//   2. ⛔ NOTHING LEAVES THE BROWSER UNLESS THE PAGE IS A POSTING — a known posting URL shape, or JobPosting JSON-LD,
//      and never an application page (Workday's applyFlowPage, an /apply stage). Anything else sends nothing — not
//      the URL, not a hash.
//   3. Relevance is the SERVER's call, against the user's board; an irrelevant posting is discarded there and never
//      stored (services/jobs/autoCapture.js).
//   4. Capture is not apply: capture fills and submits nothing (D36). Filling is its own switch (D97), never submits.
//
// ⛔ D97 REVERSES one line of D64 (owner, 10-13): Workday is now offered — `*.myworkdayjobs.com` and
// `*.myworkdaysite.com`, OPTIONAL, asked for only when the user switches Workday on. LinkedIn, Indeed and Glassdoor
// stay out, in the table and in code.
//
// ONE SITE TABLE: autoRead.js SITES. This file keeps D64's names for the service worker that still imports them
// (background.js — the coordinator's file) and derives every one of them from that table.
// This file has no top-level `chrome` use, so node tests import it directly.
import {
  OPTIONAL_ORIGINS, siteFor, hasPostingUrlShape, pageHasJobPosting, createSeenSet, LEGACY_CAPTURE_KEY,
} from './autoRead.js';

export { hasPostingUrlShape, pageHasJobPosting, createSeenSet };

/** D64's switch key — retired by D97 (autoRead.js migrateLegacy reads it once, then removes it). */
export const AUTO_CAPTURE_SETTING = "autoCaptureEnabled";
if (AUTO_CAPTURE_SETTING !== LEGACY_CAPTURE_KEY) throw new Error('autoCapture.js and autoRead.js disagree on the D64 key');

/** The optional host permissions — derived from autoRead.js's one site table. */
export const AUTO_CAPTURE_ORIGINS = OPTIONAL_ORIGINS;

/** The origin pattern in AUTO_CAPTURE_ORIGINS that covers this URL, or null. */
export function autoCaptureOriginFor(url) {
  const site = siteFor(url);
  if (!site) return null;
  const host = new URL(url).hostname.toLowerCase();
  return site.origins.find(p => {
    const h = new URL(p.replace('*.', 'x.').replace('/*', '/')).hostname.replace(/^x\./, '');
    return p.includes('*.') ? host.endsWith(`.${h}`) : host === h;
  }) || null;
}

/**
 * D64's decision before any page is read. Pure. Kept for background.js's D64 block until the coordinator wires
 * autoRead.js in its place; with the D64 key gone (migrated) `enabled` is false and this always says "skip".
 * @returns {"skip"|"by_url"|"check_page"}
 */
export function autoCaptureStep({ enabled, url, granted }) {
  if (!enabled || !granted) return "skip";
  if (!autoCaptureOriginFor(url)) return "skip";
  return hasPostingUrlShape(url) ? "by_url" : "check_page";
}

/** D64's write of its switch — retired: the switch now lives in autoRead.js (one key, one write site). Turning it off
 *  (background.js, when Chrome's access is removed) removes the old key; it is never written again. */
export async function setAutoCaptureSetting(on) {
  if (on) return;
  try { await chrome.storage.local.remove(AUTO_CAPTURE_SETTING); } catch { /* already gone */ }
}

// ── THE TAB BINDING — which job THIS tab is on, across every stage of its application ────────────
//
// Owner, 10-12 (Zoom's Workday posting): the posting, /apply, /apply/applyManually, the sign-in and the account
// pages are one job, and Workday can change steps without changing the address at all. So once a tab has
// captured a job — or draft recognised the posting in it — the tab REMEMBERS that job, and fill, prepare, the
// Copy sheet and "I submitted it" use it first.
//
//   bind:{tabId} → { origin, jobId, title, company, via: 'capture' | 'recognised' | 'board', boundAt, dock,
//                    origins?, board? }
//
//   · ⭐ D99 J11 · via 'board': the draft board handed the job over and the extension opened the tab itself
//     (boardOpen.js) — the server confirmed the job and gave the address. `board` is what the server said then:
//     { logo, reportPath, ats } (the score, band and matched / missing TERMS — words from the posting, never an
//     answer or a page value). `origins` is the address's origin plus its known redirect twin (Greenhouse's two hosts),
//     because the opened tab's address is not readable until the user opens the popup on it.
//
//   · chrome.storage.session — memory-backed, discarded when the browser closes; cleared when the tab closes,
//     when a DIFFERENT posting is recognised in it, or by "Unlink this page".
//   · ⛔ Valid only on the ORIGIN it was made on: the activeTab grant persists across same-origin navigation,
//     and so does the binding — a tab that leaves the employer's site leaves its binding behind.
//   · ⛔ Never written to the server as such: the job id rides with the next request as a HINT the server honours
//     only for a job that is already this user's own (routes/apply.js boundJob). Never shared across tabs.
//   · No new permission: no `tabs`, no `webNavigation` — tabs.onRemoved needs neither.

export const BIND_PREFIX = 'bind:';
const bindKey = (tabId) => `${BIND_PREFIX}${tabId}`;
// The ONE write site for the key (the privacy count is of write sites — test/privacyReconciliation.test.js).
const writeBinding = (tabId, entry) => chrome.storage.session.set({ [bindKey(tabId)]: entry });

export function originOfUrl(url) {
  try { const u = new URL(url || ''); return /^https?:$/.test(u.protocol) ? u.origin : null; } catch { return null; }
}

// Hosts that redirect to each other for the SAME posting (a board URL opened by draft can land on either).
const ORIGIN_TWINS = [['https://boards.greenhouse.io', 'https://job-boards.greenhouse.io']];
export function originTwins(origin) {
  const pair = ORIGIN_TWINS.find(p => p.includes(origin));
  return pair ? [...pair] : (origin ? [origin] : []);
}

/** Bind this tab to a job. A different job replaces the old binding; the same job keeps its first time and dock. */
export async function bindTab(tab, { jobId, title = null, company = null, via = 'capture', board = null } = {}) {
  const origin = originOfUrl(tab?.url);
  if (!tab?.id || !origin || jobId == null) return null;
  const prior = await loadBinding(tab.id);
  const same = prior && String(prior.jobId) === String(jobId) && onOrigin(prior, origin);
  const boardFacts = board || (same ? prior.board : null) || null;
  const entry = {
    origin, jobId: String(jobId), title: title || prior?.title || null, company: company || prior?.company || null,
    via: same ? prior.via : via, boundAt: same ? prior.boundAt : Date.now(), dock: prior?.dock || 'right',
    ...(prior?.panelDock ? { panelDock: prior.panelDock } : {}),
    ...((same ? prior.via : via) === 'board' ? { origins: originTwins(origin) } : {}),
    ...(boardFacts ? { board: boardFacts } : {}),
  };
  await writeBinding(tab.id, entry);
  return entry;
}

export async function loadBinding(tabId) {
  if (tabId == null) return null;
  try { return (await chrome.storage.session.get(bindKey(tabId)))?.[bindKey(tabId)] || null; } catch { return null; }
}

/** The binding for this tab AS IT IS NOW — null when the tab is on another origin than the one it was made on. */
const onOrigin = (b, origin) => !!origin && (b.origin === origin || (Array.isArray(b.origins) && b.origins.includes(origin)));

export async function bindingForTab(tab) {
  const b = await loadBinding(tab?.id);
  if (!b) return null;
  return onOrigin(b, originOfUrl(tab?.url)) ? b : null;
}

export async function clearBinding(tabId) {
  if (tabId == null) return;
  try { await chrome.storage.session.remove(bindKey(tabId)); } catch { /* storage gone */ }
}

/**
 * A panel's dock side, remembered with the tab's binding (no key of its own): `dock` is the Copy sheet's,
 * `panelDock` the review panel's (D96 §5, lane J4) — two fields, so the two panels can sit on different sides.
 */
export async function setBindingDock(tabId, dock, which = 'dock') {
  const b = await loadBinding(tabId);
  if (!b || !['left', 'right'].includes(dock) || !['dock', 'panelDock'].includes(which)) return;
  await writeBinding(tabId, { ...b, [which]: dock });
}

const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const bindingLabel = (b) => [b?.title, b?.company].filter(Boolean).join(' at ') || 'this job';

/** "Using Software Engineer at Zoom, captured 10:42" — what the fill says when it used the binding. */
export function bindingLine(b) {
  if (!b) return '';
  return `Using ${bindingLabel(b)}, ${b.via === 'capture' ? 'captured' : b.via === 'board' ? 'opened from your board' : 'recognised'} ${hhmm(b.boundAt || Date.now())}`;
}

/**
 * ⭐ D96 §2 · what a fill that found nothing to fill says on a BOUND tab. "Capture it first" is said ONLY when there is
 * truly no binding and no match (owner, 10-13: it said so while the popup said the job was in the imports). On a bound
 * tab the job is named: not on your board yet → capture it to fill; not found any more → capture it again, or Unlink.
 * Any other server sentence ("Press Prepare this application", "not one of this application's addresses") stands.
 */
export function boundMissMessage(b, reason, serverMessage) {
  if (!b) return serverMessage || null;
  if (serverMessage && !/capture it first/i.test(serverMessage)) return serverMessage;
  const job = bindingLabel(b);
  if (reason === 'not_on_board') return `${job} isn't on your board yet — capture it to fill this page.`;
  if (reason === 'unknown') return `This tab is linked to ${job}, but draft can't find it in your imports — capture it again, or press "Unlink this page".`;
  return `Nothing is prepared for ${job} on this page — press "Prepare this application" in the draft popup.`;
}

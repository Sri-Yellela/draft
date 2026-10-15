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
//     only for a job that is already this user's own (routes/apply.js boundJob). Never COPIED from another tab.
//   · No new permission: no `tabs`, no `webNavigation` — tabs.onRemoved needs neither.
//
//   · ⭐ T14 (field report 10-14) · via 'known': a NEW tab whose address is one the JOB has already been seen at (its
//     progress record's `addresses`, extension/progress.js — the posting, an application stage, the page a capture or
//     a read or a fill happened on) binds to that job the moment the popup opens on it or Fill is pressed — no capture,
//     no read, no prepare asked again. A local comparison of two addresses: no page read, no request (D23 holds).
//     The comparison is generic — an address the job was seen at is the tab's address or a parent path of it — and
//     deliberately knows no ATS (one URL parser, the server's: services/jobPageKey.js). A tab two jobs could claim
//     binds to neither.

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

/** ⭐ T14 · the ATS facts a binding may carry for the popup's card: a score, a band word and when — nothing else. */
export function atsFactsOf(a) {
  if (!a || !Number.isFinite(a.score)) return null;
  return { score: Math.round(a.score), band: typeof a.band === 'string' ? a.band.slice(0, 40) : null, at: Number.isFinite(a.at) ? a.at : Date.now() };
}

/** Bind this tab to a job. A different job replaces the old binding; the same job keeps its first time and dock. */
export async function bindTab(tab, { jobId, title = null, company = null, via = 'capture', board = null, ats = null } = {}) {
  const origin = originOfUrl(tab?.url);
  if (!tab?.id || !origin || jobId == null) return null;
  const prior = await loadBinding(tab.id);
  const same = prior && String(prior.jobId) === String(jobId) && onOrigin(prior, origin);
  const boardFacts = board || (same ? prior.board : null) || null;
  const atsFacts = atsFactsOf(ats) || (same ? prior.ats : null) || null;
  const entry = {
    origin, jobId: String(jobId), title: title || prior?.title || null, company: company || prior?.company || null,
    via: same ? prior.via : via, boundAt: same ? prior.boundAt : Date.now(), dock: prior?.dock || 'right',
    ...(prior?.panelDock ? { panelDock: prior.panelDock } : {}),
    ...((same ? prior.via : via) === 'board' ? { origins: originTwins(origin) } : {}),
    ...(boardFacts ? { board: boardFacts } : {}),
    ...(atsFacts ? { ats: atsFacts } : {}),
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
  return `Using ${bindingLabel(b)}, ${b.via === 'capture' ? 'captured' : b.via === 'board' ? 'opened from your board'
    : b.via === 'known' ? 'known from earlier' : 'recognised'} ${hhmm(b.boundAt || Date.now())}`;
}

// ── ⭐ T14 · THE ADDRESSES A JOB HAS BEEN SEEN AT — generic, no ATS knowledge ──────────────────────────────────────
// A query parameter is kept only when it looks like an IDENTIFIER (letters, digits, - and _, at least one digit, at
// most 64 long) and its name is not a credential's or a tracker's. So `?gh_jid=8198280` stays and `?source=linkedin`,
// `?utm_campaign=…`, `?token=…` and `?redirect=…` go — an address kept here never carries a secret or a value the user
// typed. The fragment always goes.
const SECRET_PARAM = /token|secret|session|auth|code|state|sig|key|pass|redirect|return|email|user|login|nonce/i;
const TRACKING_PARAM = /^(utm_|source$|src$|ref$|referrer$|gclid$|fbclid$|mc_|lang$|locale$|hl$)/i;
const ID_VALUE = /^(?=.*\d)[A-Za-z0-9_-]{1,64}$/;
const segmentsOf = (p) => p.split('/').filter(Boolean);

/** "https://host/a/b?id=12" — the address as kept: origin, path without a trailing slash, identifier params only. */
export function addressOf(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || url.length > 2048) return null;
  const keep = [...u.searchParams].filter(([k, v]) => ID_VALUE.test(v) && !SECRET_PARAM.test(k) && !TRACKING_PARAM.test(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const q = keep.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const path = `/${segmentsOf(u.pathname).join('/')}`;
  return `${u.origin}${path === '/' ? '' : path}${q ? `?${q}` : ''}`;
}

/** An address names ONE posting by its path alone when a path segment carries a long number or a UUID. */
const specificPath = (segs) => segs.some(s => /\d{4,}|[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s));

/**
 * How well a SEEN address claims the tab's address: 0 = not at all; otherwise the number of path segments it shares
 * (more = more specific). It claims it when the origin is the same, its path is the tab's path or a parent of it, and
 * either its path alone names one posting or every identifier parameter it kept is on the tab's address too.
 * A bare origin or a one-segment path never claims anything.
 */
export function addressClaim(seen, url) {
  const a = addressOf(seen), b = addressOf(url);
  if (!a || !b) return 0;
  const A = new URL(a), B = new URL(b);
  if (A.origin !== B.origin) return 0;
  // A leading language segment (/en-US/, /de/) names the same page in another language — it is set aside on both sides.
  const unlocale = (segs) => (segs.length > 1 && /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(segs[0]) ? segs.slice(1) : segs);
  const as = unlocale(segmentsOf(A.pathname)), bs = unlocale(segmentsOf(B.pathname));
  if (as.length > bs.length || as.some((s, i) => s !== bs[i])) return 0;
  const params = [...A.searchParams];
  const paramsHeld = params.length > 0 && params.every(([k, v]) => B.searchParams.getAll(k).includes(v));
  if (!specificPath(as) && !paramsHeld) return 0;
  if (as.length < 2 && !paramsHeld) return 0;
  return as.length + (paramsHeld ? 1 : 0);
}

/**
 * The ONE job whose seen addresses claim this tab's address — from the progress records (each `{ jobId, addresses }`).
 * The most specific claim wins; two different jobs claiming it equally → null (a tab two jobs could claim binds to
 * neither, and the user's Read decides).
 */
export function knownJobForAddress(records = [], url) {
  let best = null, bestScore = 0, tie = false;
  for (const r of records || []) {
    const score = Math.max(0, ...(r?.addresses || []).map(s => addressClaim(s, url)));
    if (!score) continue;
    if (score > bestScore) { best = r; bestScore = score; tie = false; }
    else if (score === bestScore && String(r.jobId) !== String(best?.jobId)) tie = true;
  }
  return tie ? null : best;
}

/**
 * ⭐ D96 §2 · what a fill that found nothing to fill says on a BOUND tab: the job is named (owner, 10-13: it said
 * "capture it first" while the popup said the job was in the imports).
 * ⛔ T16 (field report 10-14): no sentence tells the user to run an earlier step. Nothing prepared is never said here —
 * the Fill press prepares by itself (tabState.js runFillChain, T15). Where the extension truly cannot act — a job that is
 * not the user's needs a capture, which writes to their account — the sentence names ONE button.
 */
export function boundMissMessage(b, reason, serverMessage) {
  if (!b) return serverMessage || null;
  const job = bindingLabel(b);
  if (reason === 'not_on_board') return `${job} isn't on your board yet — Capture adds it.`;
  if (reason === 'unknown') return `This tab is linked to ${job}, but draft can't find it in your jobs any more — Capture adds it again.`;
  if (serverMessage) return serverMessage;
  return `Nothing is prepared for ${job} on this page yet — Fill prepares your answers before it fills.`;
}

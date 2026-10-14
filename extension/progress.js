// ── PERSISTED PROGRESS — where each application stands, remembered by the browser (D96 §3) ───────────
//
// Owner, 10-13 (Zoom's Workday, the unpacked v1.5.2): "nothing persists — close the popup or reload and it is zero,
// no page read, no prepared answers." The popup now opens KNOWING the job and where you are:
//
//     Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you · Reviewed · Submitted
//
// and an "In progress" list of the last five jobs brings you back to one.
//
//   jobProgress → { v: 1, owner, records: { [jobId]: { jobKey, jobId, title, company, postingUrl, link,
//                   captured: { at }, read: { at, stage, fieldCount }, prepared: { at, packetId },
//                   filled: { n, of, needYou, check }, resume: { at, id, status, attached },
//                   reviewed: { at }, submitted: { at }, updatedAt } } }
//
//   · ONE record per JOB. The record is filed under the board job's id — the server's resolution of the page's
//     canonical key (services/jobPageKey.js: workday|tenant|site|R19749, every stage, locale and ?source= stripped).
//     A job found on LinkedIn and applied to on Workday has two addresses and one job id, so it has ONE record; the
//     page key rides in the record as `jobKey` when the server named one (POST /api/import/context → pageKey).
//     ⛔ The extension parses no ATS URL (one parser, the server's — A93: the same thing is built once).
//   · ⛔ NO ANSWER VALUES. Counts, times, the packet's id, the job's title / company and its posting address — never
//     what was typed, chosen or filled. sanitiseRecord() is a whitelist, so a value cannot ride in by accident.
//   · chrome.storage.local — survives closing the popup, reloading the page, a browser restart and another job.
//     Kept 30 days from its last change; cleared on Disconnect, on sign-out, and when another account connects.
//   · ⛔ D23: the popup READS this on open (popup-progress.js) — it reads nothing from the page and asks the server
//     nothing. Every write happens where the event happened: a capture, "Read this page", Prepare, a fill, the review
//     panel, "I submitted it" — all in the service worker, serialised so two events never lose each other's write.
//   · ⛔ Never sent anywhere: nothing in this file makes a request, and no request body carries a record.
//   · No new permission.
//   · ⭐ D98 §4 (lane J6): `resume` is the résumé the on-page panel generated for THIS job — the generation's id
//     (erg_…, draft's server's), its last status (queued · generating · ready · refused · failed · cancelled), when it
//     started and when you pressed Attach. No HTML, no file, no file name, no score: the panel asks the server for those
//     each time it opens (extension/resumePanel.js). It is what lets the panel come back after a popup close, a reload
//     or a Workday step change, and lets a later fill attach the SAME file without generating again.

export const PROGRESS_KEY = 'jobProgress';
export const PROGRESS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const IN_PROGRESS_LIMIT = 5;
const MAX_RECORDS = 50;

const STEPS = Object.freeze({
  captured: ['at'],
  read: ['at', 'stage', 'fieldCount'],
  prepared: ['at', 'packetId'],
  filled: ['n', 'of', 'needYou', 'check'],
  resume: ['at', 'id', 'status', 'attached'],
  reviewed: ['at'],
  submitted: ['at'],
});

const str = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const webUrl = (v) => {
  if (typeof v !== 'string' || v.length > 2048) return null;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
};
const STEP_FIELD = { at: num, n: num, of: num, needYou: num, check: num, fieldCount: num,
  stage: (v) => str(v, 40), packetId: (v) => (v == null ? null : str(String(v), 64)),
  // D98: the generation's id is the server's opaque erg_<hex>; its status one of six words; Attach a time.
  id: (v) => (typeof v === 'string' && /^erg_[a-f0-9]{8,64}$/.test(v) ? v : null),
  status: (v) => (RESUME_STATUSES.includes(v) ? v : null),
  attached: num };
/** The server's six (services/extensionResume.js STATUSES). */
export const RESUME_STATUSES = Object.freeze(['queued', 'generating', 'ready', 'refused', 'failed', 'cancelled']);

/** ⛔ The whitelist. Anything not named here — an answer, a field value, the page's text — is dropped. */
export function sanitiseRecord(r) {
  if (!r || r.jobId == null) return null;
  const out = {
    jobId: String(r.jobId).slice(0, 128), jobKey: str(r.jobKey, 200),
    title: str(r.title), company: str(r.company), postingUrl: webUrl(r.postingUrl), link: webUrl(r.link),
    updatedAt: num(r.updatedAt) ?? Date.now(),
  };
  for (const [step, fields] of Object.entries(STEPS)) {
    const s = r[step];
    if (!s || typeof s !== 'object') { out[step] = null; continue; }
    const o = {};
    for (const f of fields) o[f] = STEP_FIELD[f](s[f]);
    out[step] = o;
  }
  return out;
}

const fresh = (r, now) => r && now - (r.updatedAt || 0) <= PROGRESS_RETENTION_MS;

async function readStore() {
  try {
    const s = (await chrome.storage.local.get(PROGRESS_KEY))?.[PROGRESS_KEY];
    return s && typeof s === 'object' && s.records ? s : { v: 1, owner: null, records: {} };
  } catch { return { v: 1, owner: null, records: {} }; }
}

// The ONE write site for the key (the privacy count is of write sites — test/privacyReconciliation.test.js).
const writeStore = (store) => chrome.storage.local.set({ [PROGRESS_KEY]: store });

/** Drop what is past its 30 days, keep the newest MAX_RECORDS. */
function prune(store, now = Date.now()) {
  const kept = Object.values(store.records || {}).filter(r => fresh(r, now))
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_RECORDS);
  return { v: 1, owner: store.owner ?? null, records: Object.fromEntries(kept.map(r => [r.jobId, r])) };
}

// Every write goes through here, one after another: a fill and its review panel report within milliseconds.
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

/** The record for { jobId } or { jobKey }, or null. Read-only: the popup calls this on open. */
async function get(ref = {}) {
  const store = await readStore();
  const now = Date.now();
  const all = Object.values(store.records).filter(r => fresh(r, now));
  return all.find(r => ref.jobId != null && String(r.jobId) === String(ref.jobId))
    || all.find(r => ref.jobKey && r.jobKey === ref.jobKey) || null;
}

/** Replace one record whole (sanitised). */
function set(record) {
  return exclusive(async () => {
    const clean = sanitiseRecord({ ...record, updatedAt: Date.now() });
    if (!clean) return null;
    const store = await readStore();
    store.records[clean.jobId] = clean;
    await writeStore(prune(store));
    return clean;
  });
}

/**
 * Merge a change into the job's record, creating it on its first event. Each step merges field by field, so a fill
 * that knows the field count does not erase when the page was read. A record found by its page key under another job
 * id (the key was re-captured into another job) moves to the job the server named now.
 */
function patch(ref = {}, changes = {}) {
  return exclusive(async () => {
    if (ref.jobId == null) return null;
    const store = await readStore();
    const id = String(ref.jobId);
    const byKey = ref.jobKey ? Object.values(store.records).find(r => r.jobKey === ref.jobKey && r.jobId !== id) : null;
    const prior = store.records[id] || byKey || {};
    if (byKey) delete store.records[byKey.jobId];
    const next = { ...prior, jobId: id };
    if (ref.jobKey) next.jobKey = ref.jobKey;
    for (const [k, v] of Object.entries(changes || {})) {
      if (v == null) continue;
      next[k] = STEPS[k] ? { ...(prior[k] || {}), ...v } : v;
    }
    next.updatedAt = Date.now();
    const clean = sanitiseRecord(next);
    if (!clean) return null;
    store.records[id] = clean;
    await writeStore(prune(store));
    return clean;
  });
}

/** The "In progress" list: the newest first, the last five by default. Read-only. */
async function list({ limit = IN_PROGRESS_LIMIT } = {}) {
  const store = await readStore();
  const now = Date.now();
  return Object.values(store.records).filter(r => fresh(r, now))
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

/** Forget every job — Disconnect, sign-out, another account. */
function clearAll() {
  return exclusive(async () => { try { await chrome.storage.local.remove(PROGRESS_KEY); } catch { /* storage gone */ } });
}

/** Which account the records belong to. A different account connecting clears them first. */
function claim(owner) {
  return exclusive(async () => {
    if (!owner) return;
    const store = await readStore();
    if (store.owner === owner) return;
    if (store.owner && store.owner !== owner) {
      try { await chrome.storage.local.remove(PROGRESS_KEY); } catch { /* storage gone */ }
      return;
    }
    if (!Object.keys(store.records).length) return;   // nothing to claim; the first event writes it
    await writeStore({ ...store, owner });
  });
}

/** The account the stored records belong to (null before any is claimed). Read-only. */
async function owner() { return (await readStore()).owner ?? null; }

export const progress = Object.freeze({ get, set, patch, list, clearAll, claim, owner });

// ── the words ─────────────────────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');
/** "10:41" today, "11 Oct" before today. */
export function whenWords(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms); const t = new Date(now);
  return d.toDateString() === t.toDateString() ? `${two(d.getHours())}:${two(d.getMinutes())}` : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you · 3 to check · Reviewed · Submitted" */
export function progressLine(r, now = Date.now()) {
  if (!r) return '';
  const parts = [];
  if (r.captured?.at) parts.push(`Captured ${whenWords(r.captured.at, now)}`);
  if (r.read?.at) parts.push(`Page read ${whenWords(r.read.at, now)}`);
  if (r.prepared?.at) parts.push('Answers prepared');
  if (r.filled && Number.isFinite(r.filled.n)) {
    parts.push(Number.isFinite(r.filled.of) && r.filled.of > 0 ? `Filled ${r.filled.n} of ${r.filled.of}` : `Filled ${r.filled.n}`);
    if (r.filled.needYou > 0) parts.push(`${r.filled.needYou} need${r.filled.needYou === 1 ? 's' : ''} you`);
    if (r.filled.check > 0) parts.push(`${r.filled.check} to check`);
  }
  if (r.resume?.attached) parts.push('Résumé attached');
  else if (r.resume?.status === 'ready') parts.push('Résumé ready');
  else if (r.resume?.status === 'queued' || r.resume?.status === 'generating') parts.push('Résumé generating');
  if (r.reviewed?.at) parts.push('Reviewed');
  if (r.submitted?.at) parts.push('Submitted');
  return parts.join(' · ');
}

/** Where a job stands, in a word or three — the "In progress" list's right-hand side. */
export function standWords(r) {
  if (!r) return '';
  if (r.submitted?.at) return 'Submitted';
  if (r.reviewed?.at) return 'Reviewed';
  if (r.filled && Number.isFinite(r.filled.n)) {
    return Number.isFinite(r.filled.of) && r.filled.of > 0 ? `Filled ${r.filled.n} of ${r.filled.of}` : `Filled ${r.filled.n}`;
  }
  if (r.prepared?.at) return 'Answers prepared';
  if (r.read?.at) return 'Page read';
  if (r.captured?.at) return 'Captured';
  return '';
}

export const jobLabel = (r) => [r?.title, r?.company].filter(Boolean).join(' at ') || 'A job';

// ── where the events happen — each a no-op without a job, and never throws at its caller ──────────
const quiet = (fn) => async (...a) => { try { return await fn(...a); } catch { return null; } };

/** A capture that landed (background.js captureActiveTab). `extracted` is the extractor's title and company. */
export const noteCapture = quiet(async (result, extracted = null) => {
  if (!result?.success || result.jobId == null) return null;
  return patch({ jobId: result.jobId }, {
    title: extracted?.title || null, company: extracted?.company || null, link: result.link || null,
    captured: { at: Date.now() },
  });
});

/** "Read this page" (background.js popupContext): the server's answer about the page, and the tab's binding. */
export const noteContext = quiet(async (board, binding = null) => {
  const posting = board?.posting?.known ? board.posting : null;
  const jobId = posting?.jobId ?? binding?.jobId ?? null;
  if (jobId == null) return null;
  const sameJob = !posting || binding == null || String(binding.jobId) === String(posting.jobId);
  const pk = board?.pageKey || null;
  const prior = await get({ jobId });
  return patch({ jobId, jobKey: pk?.key || null }, {
    title: posting?.title || (sameJob ? binding?.title : null) || null,
    company: posting?.company || (sameJob ? binding?.company : null) || null,
    postingUrl: pk?.canonicalUrl || null,
    // a job captured by another route (the web app, another device) shows its capture time too
    captured: !prior?.captured?.at && posting?.captured && Number.isFinite(posting.capturedAt) ? { at: posting.capturedAt } : null,
    read: { at: Date.now(), stage: board?.ats?.stage ?? null },
  });
});

/** "Prepare this application" built a packet (gated-handoff.js prepareAndFill). */
export const notePrepared = quiet(async (body) => {
  if (!body?.ok || body.job?.jobId == null) return null;
  return patch({ jobId: body.job.jobId }, {
    title: body.job.title || null, company: body.job.company || null,
    prepared: { at: Date.now(), packetId: body.packetId ?? null },
  });
});

/**
 * A fill ran (gated-handoff.js runGatedHandoff): how many fields it filled of how many the form has, how many
 * required ones are still empty (they need you) and how many guesses are left to check. Counts only.
 */
export const noteFill = quiet(async (result, { jobId = null, bound = null } = {}) => {
  const id = jobId ?? bound?.jobId ?? null;
  if (id == null || !result || !Array.isArray(result.filled)) return null;
  if (!result.ok && !result.filled.length) return null;
  const of = Number.isFinite(result.fieldCount) ? result.fieldCount : null;
  return patch({ jobId: id }, {
    title: bound && String(bound.jobId) === String(id) ? bound.title : null,
    company: bound && String(bound.jobId) === String(id) ? bound.company : null,
    read: of != null ? { fieldCount: of } : null,
    prepared: result.packetId != null ? { packetId: result.packetId } : null,
    // ⭐ D96 §5 (J4): the review PANEL's own counts when the fill reports them — so "Filled 14 of 18 · 2 need you" in
    // the popup is the same three numbers the panel shows (filled · needs you · to check), not a second count.
    filled: result.panel && Number.isFinite(result.panel.filled)
      ? { n: result.panel.filled, of: Number.isFinite(result.panel.of) ? result.panel.of : of, needYou: result.panel.needYou ?? 0, check: result.panel.check ?? 0 }
      : { n: result.filled.length, of, needYou: result.missingCount ?? 0, check: result.review?.uncertainCount ?? 0 },
  });
});

/** The review panel says everything is checked (background.js GATE_REVIEW_STATE, ready). */
export const noteReviewed = quiet(async (msg, { jobId = null } = {}) => {
  if (!msg?.ready || jobId == null) return null;
  return patch({ jobId }, { reviewed: { at: Date.now() } });
});

/** "I submitted it" was recorded (gated-handoff.js recordSubmitted). */
export const noteSubmitted = quiet(async (result, { jobId = null } = {}) => {
  const id = result?.jobId ?? jobId;
  if (!result?.ok || id == null) return null;
  return patch({ jobId: id }, { submitted: { at: Date.now() } });
});

/**
 * ⭐ D98 §4 (J6): the on-page panel's résumé for this job — a new generation (its id and status; a NEW id clears
 * `attached`, so a regenerated résumé is never mistaken for the attached one), a status change, or Attach pressed.
 */
export const noteResume = quiet(async (jobId, { id = null, status = null, attached = null, title = null, company = null } = {}) => {
  if (jobId == null) return null;
  const prior = (await get({ jobId }))?.resume || null;
  const next = id && prior?.id !== id ? { at: Date.now(), id, status, attached: null } : { ...(prior || {}) };
  if (status) next.status = status;
  if (attached) next.attached = attached;
  if (!next.id) return null;
  return patch({ jobId }, { title, company, resume: next });
});

/** The panel's résumé for this job, or null. Read-only. */
export async function resumeFor(jobId) {
  if (jobId == null) return null;
  const r = await get({ jobId }).catch(() => null);
  return r?.resume?.id ? r.resume : null;
}

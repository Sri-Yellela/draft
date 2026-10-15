// ── ⭐ T6 (field report 10-14) · "SHOW DETAILS" — WHY SOMETHING FAILED, WITHOUT A GUESS ──────────────────────────────────
//
// The owner's résumé failure read "Résumé generation is unavailable right now" — the sentence every failure gets — and
// the cause (the tools service refusing the model call) was found only by reading production's log. This is the view
// that makes the next failure readable from the extension itself: Options → "Show details" (off unless ticked, nothing
// remembered), and a "Copy details" button.
//
// What it shows: the tab's binding and its job key, what draft answered about the page, whether the extension holds a
// token, each server path's LAST answer (HTTP status + our code), and the tab's last generation (status, and its cause
// code from the server). ⛔ NEVER a token, an answer value, a page's text or résumé text — named fields only.
//
// ⛔ NO NEW STORAGE KEY. The answers are kept in the service worker's MEMORY (a worker that Chrome stopped starts empty,
// and the view says so) — not chrome.storage, so the policy's count of stored things is unchanged.

const MAX_PATHS = 40;
const answersByPath = new Map();
const pageReads = new Map();   // tabId → what draft last answered about that tab's page

/** A path with its ids replaced — `/api/extension/resume/erg_…/pdf` → `/api/extension/resume/:id/pdf`. No query. */
export function pathShape(path) {
  const p = String(path || '').split(/[?#]/)[0].slice(0, 200);
  return p.split('/').map((seg) => (/^(erg_[a-f0-9]+|\d+|[0-9a-f-]{16,}|.*(%3A|::|%7C).*)$/i.test(seg) ? ':id' : seg)).join('/');
}

const codeOf = (v) => (typeof v === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(v) ? v : null);

/** Called by auth.js for every answer from draft's server. `body` is read only for a refusal, and only its code. */
export function noteAnswer(path, status, body = null) {
  const key = pathShape(path);
  answersByPath.delete(key);
  answersByPath.set(key, { path: key, status: Number(status) || 0, code: codeOf(body?.code) || codeOf(body?.error), at: Date.now() });
  while (answersByPath.size > MAX_PATHS) answersByPath.delete(answersByPath.keys().next().value);
}

/** What the popup's / panel's read last learned about a tab's page — the job draft named, how, and the report's basis. */
export function notePageRead(tabId, { url = null, known = false, jobId = null, how = null, pageKey = null, basis = null, atsState = null } = {}) {
  if (tabId == null) return;
  pageReads.set(tabId, { page: pageOf(url), known: !!known, jobId: jobId != null ? String(jobId).slice(0, 128) : null, how: codeOf(how),
    pageKey: typeof pageKey === 'string' ? pageKey.slice(0, 160) : null, basis: codeOf(basis), atsState: codeOf(atsState), at: Date.now() });
}

// ⭐ T18 · HOW THE LAST FILL READ THE FORM'S FIELDS — where each label came from (counts), and for every field nothing
// named, its RAW attributes (id, name, type, aria, placeholder, the nearest words, a few data-* pairs) and the best guess
// shown for it — so the classifier improves from real pages. ⛔ Never a value: probeFormShape reports none. Memory only.
const fieldReads = new Map();   // tabId → { at, total, bySource, unresolved: [...] }
const short = (v, n = 80) => (typeof v === 'string' && v ? v.slice(0, n) : null);
export function noteFieldsRead(tabId, fields = [], { guessOf = () => '' } = {}) {
  if (tabId == null || !Array.isArray(fields)) return;
  const bySource = {};
  for (const f of fields) { const s = codeOf(f?.labelSource) || 'none'; bySource[s] = (bySource[s] || 0) + 1; }
  const unresolved = fields.filter(f => f && !f.labelSource && f.type !== 'hidden').slice(0, 20).map(f => ({
    index: Number.isInteger(f.index) ? f.index : null, guess: short(guessOf(f)) || null,
    id: short(f.raw?.id ?? f.id), name: short(f.raw?.name ?? f.name), type: short(f.raw?.type ?? f.type, 24),
    aria: short(f.raw?.aria), labelledby: short(f.raw?.labelledby), placeholder: short(f.raw?.placeholder), near: short(f.raw?.near),
    data: Array.isArray(f.raw?.data) ? f.raw.data.slice(0, 4).map(d => short(d, 70)).filter(Boolean) : [],
  }));
  fieldReads.set(tabId, { at: Date.now(), total: fields.length, bySource, unresolved });
}
export function fieldsReadFor(tabId) { return fieldReads.get(tabId) || null; }

export function answers() { return [...answersByPath.values()].reverse(); }
export function pageReadFor(tabId) { return pageReads.get(tabId) || null; }

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

/** A page as host + path — never its query (a session code, an email address) or its hash. */
export function pageOf(url) {
  try { const u = new URL(String(url || '')); return /^https?:$/.test(u.protocol) ? `${u.host}${u.pathname}`.slice(0, 200) : null; } catch { return null; }
}

/**
 * The details, as plain data. Every input is passed in (the router gathers them), so this is pure and testable.
 *   tabs  [{ id, page, binding, progress, resume: { id, status }, view }] — every tab draft knows about: bound, or read
 *         since the worker started. `view` is the server's answer for the tab's generation (its status and cause code).
 */
export function detailsOf({ version = null, hasToken = false, identity = null, tabs = [], workerStartedAt = null, now = Date.now() } = {}) {
  return {
    at: iso(now), extension: version, workerStartedAt: iso(workerStartedAt),
    note: 'Server answers and page reads are kept in memory only — they start empty when Chrome restarts the extension.',
    account: { signedIn: !!identity?.authenticated, tokenHeld: !!hasToken },
    tabs: (tabs || []).slice(0, 8).map(({ id, page = null, binding = null, progress = null, resume = null, view = null }) => {
      const r = pageReadFor(id);
      const fr = fieldsReadFor(id);
      return {
        id, page: page || r?.page || null,
        // ⭐ T18: how the last fill on this tab read the form's labels, and the raw attributes of any field nothing named
        fields: fr ? { at: iso(fr.at), total: fr.total, labelSources: fr.bySource, unlabelled: fr.unresolved } : null,
        binding: binding ? { jobId: binding.jobId ?? null, via: codeOf(binding.via), boundAt: iso(binding.boundAt), origin: pageOf(binding.origin) } : null,
        lastRead: r ? { known: r.known, jobId: r.jobId, how: r.how, pageKey: r.pageKey, atsBasis: r.basis, atsState: r.atsState, at: iso(r.at) } : null,
        // the remembered progress (extension/progress.js): its job key and WHICH steps it holds — never a step's values
        progress: progress ? { jobKey: typeof progress.jobKey === 'string' ? progress.jobKey.slice(0, 200) : null,
          steps: ['captured', 'read', 'prepared', 'filled', 'resume', 'reviewed', 'submitted'].filter((s) => progress[s]),
          updatedAt: iso(progress.updatedAt) } : null,
        generation: resume?.id ? {
          id: String(resume.id).slice(0, 80), status: codeOf(view?.status) || codeOf(resume.status),
          error: codeOf(view?.error?.code),
          cause: view?.cause && codeOf(view.cause.stage) ? { stage: view.cause.stage, code: codeOf(view.cause.code) } : null,
          slotRefunded: view?.slot?.refunded === true,
        } : null,
      };
    }),
    answers: answers().map((a) => ({ ...a, at: iso(a.at) })),
  };
}

/** The tabs the details cover: those read since the worker started, newest first. */
export function readTabIds() {
  const at = new Map([...pageReads.entries()].map(([id, r]) => [id, r.at]));
  for (const [id, r] of fieldReads.entries()) at.set(id, Math.max(at.get(id) || 0, r.at));   // ⭐ T18: a tab a fill read
  return [...at.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

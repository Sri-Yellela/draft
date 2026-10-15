// ── D99 · ASK DRAFT ABOUT A BOARD JOB — its address, its card, and draft's own ATS report ──────────────────────────
//
// GET /api/extension/job/:id (routes/extensionJob.js) with the extension's own token (auth.js authedFetch). The server
// decides whether the job is on THIS user's board; the answer is kept to named fields here — words from the posting
// (the matched and missing terms), a number and a band, never an answer or a page value — and is not stored.
//
// Used by the on-page résumé panel (J12: a signed-in user with a base résumé sees draft's report, never the free
// checker) and by the board → extension bridge (J11, boardOpen.js: the tab it opens is the address returned here).
import { authedFetch } from './auth.js';

const JOB_ID_RE = /^[\w.:|@\-]{1,128}$/;
const httpsOnly = (u) => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };

/** The report, kept to named fields. null when the server sent nothing usable. */
export function atsFacts(ats) {
  if (!ats || typeof ats !== 'object') return null;
  if (ats.state === 'no_base_resume' || ats.state === 'unavailable') return { state: ats.state };
  if (ats.state !== 'ready') return null;
  const words = (xs) => (Array.isArray(xs) ? xs.filter(x => typeof x === 'string').map(x => x.slice(0, 60)).slice(0, 40) : []);
  return { state: 'ready', score: Number.isFinite(ats.score) ? Math.round(ats.score) : null,
           band: typeof ats.band === 'string' ? ats.band.slice(0, 40) : null, scorable: ats.scorable !== false,
           matched: words(ats.matched), missing: words(ats.missing) };
}

const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p.slice(0, 200) : null);

/** → { ok: true, job, ats } · { ok: false, error: 'signed_out' | 'not_on_board' | 'bad_job' | 'unavailable' | … } */
export async function lookupBoardJob(serverUrl, jobId) {
  if (!serverUrl || !JOB_ID_RE.test(String(jobId ?? ''))) return { ok: false, error: 'bad_job' };
  let r;
  try { r = await authedFetch(serverUrl, `/api/extension/job/${encodeURIComponent(String(jobId))}`); } catch { r = null; }
  if (!r) return { ok: false, error: 'signed_out' };
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  if (!r.ok) return { ok: false, error: typeof body?.error === 'string' ? body.error.slice(0, 40) : 'unavailable' };
  // `url` is null when draft has no https address for it — the report stands; an opener must check it
  const url = httpsOnly(body?.job?.url);
  if (!body?.job || String(body.job.jobId) !== String(jobId)) return { ok: false, error: 'unavailable' };
  return { ok: true, ats: atsFacts(body.ats),
           job: { jobId: String(body.job.jobId), title: body.job.title ?? null, company: body.job.company ?? null, url,
                  logo: httpsOnly(body.job.logo), reportPath: safePath(body.job.reportPath) } };
}

/**
 * ⭐ T2 + T3 (field report 10-14) · "Read this page" — POST /api/extension/page { url, text, frameUrls }: which job this page
 * is (by its address, by the address of the ATS form it embeds, else by the capture's own matcher on the text the
 * extractor read) and draft's ATS report — the board job's, or the base résumé against THIS PAGE'S TEXT when draft does
 * not hold it. Sent only on a press; the server keeps nothing.
 *   ⭐ BINDING FIRST (owner 10-15): `frameUrls` — at most 3 addresses of the ATS frames the page embeds (Stripe's careers
 *   page carries Greenhouse's form in a frame whose address names the job); `posting.mine` — the job is already the
 *   user's own (vs a live board job not yet theirs); `kind` — "job" · "not_a_job" (text read, no posting) · "unread".
 * → { ok: true, posting, ats, basis, kind } · { ok: false, error }
 */
export async function lookupPage(serverUrl, { url = '', text = '', frameUrls = [] } = {}) {
  if (!serverUrl || !/^https?:\/\//i.test(String(url))) return { ok: false, error: 'bad_page' };
  const frames = (Array.isArray(frameUrls) ? frameUrls : []).filter(f => typeof f === 'string' && /^https?:\/\//i.test(f))
    .slice(0, 3).map(f => f.slice(0, 2048));
  let r;
  try {
    r = await authedFetch(serverUrl, '/api/extension/page', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: String(url).slice(0, 2048), text: typeof text === 'string' ? text.slice(0, 60000) : '',
        ...(frames.length ? { frameUrls: frames } : {}) }) });
  } catch { r = null; }
  if (!r) return { ok: false, error: 'signed_out' };
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  if (r.status === 401) return { ok: false, error: 'signed_out' };
  if (!r.ok) return { ok: false, error: typeof body?.error === 'string' ? body.error.slice(0, 40) : 'unavailable' };
  const p = body?.posting;
  const words = (v) => (typeof v === 'string' ? v.slice(0, 200) : null);
  const posting = !p || typeof p !== 'object' ? null
    : p.known === true && JOB_ID_RE.test(String(p.jobId ?? ''))
      ? { known: true, jobId: String(p.jobId), title: words(p.title), company: words(p.company), how: words(p.how), onBoard: p.onBoard === true,
          // an older server sends no `mine`: a job on the board is then treated as on the board, nothing more
          mine: p.mine === true }
      : { known: false, title: words(p.title), company: words(p.company) };
  const kind = ['job', 'not_a_job', 'unread'].includes(body?.kind) ? body.kind : (posting ? 'job' : 'unread');
  return { ok: true, posting, kind, ats: atsFacts(body?.ats), basis: body?.basis === 'board' || body?.basis === 'page' ? body.basis : null };
}

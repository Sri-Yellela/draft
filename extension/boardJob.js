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

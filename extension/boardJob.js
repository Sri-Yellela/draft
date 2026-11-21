// ── D99 · ASK DRAFT ABOUT A BOARD JOB — its address, its card, and draft's own ATS report ──────────────────────────
//
// GET /api/extension/job/:id (routes/extensionJob.js) with the extension's own token (auth.js authedFetch). The server
// decides whether the job is on THIS user's board; the answer is kept to named fields here — words from the posting
// (the matched and missing terms), a number and a band, never an answer or a page value — and is not stored.
//
// Used by the on-page résumé panel (J12: a signed-in user with a base résumé sees draft's report, never the free
// checker) and by the board → extension bridge (J11, boardOpen.js: the tab it opens is the address returned here).
import { authedFetch } from './auth.js';
// ⭐ T9: the web app's ATS report component, bundled (scripts/buildAtsReport.mjs). Imported for its side effect — it
// sets globalThis.__draftAtsReport — so the report the server passes through is kept to the component's OWN named
// fields (cleanReport, the same function the component applies on the web), never copied wholesale.
import './atsReport.js';

const JOB_ID_RE = /^[\w.:|@\-]{1,128}$/;
const httpsOnly = (u) => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };

/** The report, kept to named fields. null when the server sent nothing usable. */
export function atsFacts(ats) {
  if (!ats || typeof ats !== 'object') return null;
  if (ats.state === 'no_base_resume' || ats.state === 'unavailable') return { state: ats.state };
  if (ats.state !== 'ready') return null;
  const words = (xs) => (Array.isArray(xs) ? xs.filter(x => typeof x === 'string').map(x => x.slice(0, 60)).slice(0, 40) : []);
  // T9: the scorer's own report — the JSON the web app's ATS panel draws — for the one component; absent from an
  // older server, and then the panel shows the summary lines it showed before.
  const report = ats.report ? globalThis.__draftAtsReport?.cleanReport(ats.report) ?? null : null;
  const card = cardOf(ats);
  return { state: 'ready', score: Number.isFinite(ats.score) ? Math.round(ats.score) : null,
           band: typeof ats.band === 'string' ? ats.band.slice(0, 40) : null, scorable: ats.scorable !== false,
           matched: words(ats.matched), missing: words(ats.missing), ...(report ? { report } : {}), ...(card ? { card } : {}) };
}

/**
 * ⭐ 47a (owner 11-21, E1) · THE ATS CARD — the web's card (client AtsCard.jsx), from the SAME words: shared/contextualView.js
 * atsCardView, bundled in atsReport.js. Read from the scorer's report and the 2.0.0 `contextual` block the server passes
 * through (routes/extensionJob.js reportOf); kept here to the view's named words and numbers — the contextual block itself
 * never leaves the service worker. Each number carries its band (the board's cutpoints) so the panel paints it, no band word.
 */
export function cardOf(ats) {
  const A = globalThis.__draftAtsReport;
  if (!ats || typeof A?.atsCardView !== 'function') return null;
  let v = null;
  try { v = A.atsCardView({ report: ats.report && typeof ats.report === 'object' ? ats.report : null,
    contextual: ats.contextual && typeof ats.contextual === 'object' ? ats.contextual : null }); } catch { v = null; }
  if (!v) return null;
  const s = (x, n = 160) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const n = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : null);
  const band = (x) => { try { return n(x) == null ? null : String(A.atsBandFor(n(x)) || '').slice(0, 20) || null; } catch { return null; } };
  if (v.declined) return { declined: true, reason: s(v.reason, 200) };
  const facts = (xs) => (Array.isArray(xs) ? xs.map(f => s(f, 120)).filter(Boolean).slice(0, 6) : []);
  return { declined: false, score: n(v.score), band: band(v.score), facts: facts(v.facts),
    parts: (Array.isArray(v.parts) ? v.parts : []).slice(0, 4).map(p => ({ id: s(p.id, 30), name: s(p.name, 30), score: n(p.score), band: band(p.score),
      line: s(p.line, 200), facts: facts(p.facts) })).filter(p => p.score != null),
    gain: v.gain?.text ? { text: s(v.gain.text, 160), tech: s(v.gain.tech || '', 60) || null } : null };
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
  return { ok: true, posting, kind, ats: atsFacts(body?.ats), basis: body?.basis === 'board' || body?.basis === 'page' ? body.basis : null,
           company: companyFacts(body?.company),
           // ⭐ D191 (2a) / (2c) / (2d) · the side panel's facts (46p: the real-extension walk found them dropped here)
           facts: postingFacts(body?.facts) };
}

/**
 * ⭐ D191 (2a) / (2c) / (2d) · what draft knows about the posting, for the side panel — named fields only, words capped,
 * a logo only on https (services/extensionJobFacts.js builds it; no model). → { job, application, company } or null. Pure.
 */
export function postingFacts(f) {
  if (!f || typeof f !== 'object') return null;
  const w = (v, n = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const j = f.job && typeof f.job === 'object' ? f.job : null;
  const a = f.application && typeof f.application === 'object' ? f.application : null;
  const c = f.company && typeof f.company === 'object' ? f.company : null;
  const count = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null);
  const proven = j?.proven && count(j.proven.count) != null && count(j.proven.of) > 0 ? { count: count(j.proven.count), of: count(j.proven.of) } : null;
  return {
    job: j ? { category: w(j.category), subcategory: w(j.subcategory), level: w(j.level, 40), salary: w(j.salary, 60),
      worksWith: Array.isArray(j.worksWith) ? j.worksWith.map(x => w(x, 40)).filter(Boolean).slice(0, 8) : [],
      fit: ['Good fit', 'Stretch', 'Long shot'].includes(j.fit) ? j.fit : null, proven } : null,
    application: a ? { state: ['Sent', 'Needs you', 'In progress', 'Failed', 'Drafted'].includes(a.state) ? a.state : null, sendFromHere: a.sendFromHere === true } : null,
    company: c ? { logo: typeof c.logo === 'string' && /^https:\/\//.test(c.logo) ? c.logo.slice(0, 500) : null, about: w(c.about, 300),
      trend: ['up', 'down', 'flat'].includes(c.trend) ? c.trend : null } : null,
  };
}

/** ⭐ D191 (2d) · the employer's card from draft's answer — named fields only; a link only to draft's own site. Pure. */
export function companyFacts(c) {
  if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name.trim()) return null;
  const n = Number(c.openJobs);
  const sponsorship = typeof c.sponsorship === 'string' ? c.sponsorship : typeof c.sponsorship?.text === 'string' ? c.sponsorship.text : null;
  return { name: c.name.trim().slice(0, 120), openJobs: Number.isFinite(n) && n >= 0 ? Math.floor(n) : null,
    sponsorship: sponsorship ? sponsorship.slice(0, 200) : null,
    href: typeof c.href === 'string' && /^https:\/\/jobsviadraft\.com\//.test(c.href) ? c.href.slice(0, 300) : null };
}

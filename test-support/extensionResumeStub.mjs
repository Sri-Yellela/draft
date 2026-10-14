/**
 * J6 · J3's résumé routes (routes/extensionResume.js + services/extensionResume.js — the REAL ones) mounted on a test
 * API, with the GENERATION STUBBED: no model, no tools service, nothing leaves the machine. The stub stores through
 * D57's one store (storeGeneratedResume) exactly as coreGenerateResume does, honours the cancel hook as it does, and
 * can be told to refuse (the claim guard), fail, or wait on a gate. Synthetic people only.
 *
 *   const ctl = mountExtensionResume(app, db, { userId: 1, profileId: 10 });
 *   ctl.mode = 'ok' | 'refuse' | 'fail';  ctl.hold() → release();  ctl.calls  ctl.html
 */
import { createExtensionResumeRouter } from '../routes/extensionResume.js';
import { createExtensionResumeService, GenerationCancelledError } from '../services/extensionResume.js';
import { storeGeneratedResume } from '../services/generatedResumes.js';
import { draftSlots } from '../services/draftSlots.js';

export const BASE_RESUME = 'Ada Example — Software Engineer. Built distributed systems in Go and Python for six years; led a team of four; ' +
  'shipped a payments ledger; wrote the on-call runbook; mentored two engineers; reduced p99 latency by 40%.';
/** A generated résumé carrying what must never run or load in the preview: a script, an external image, a handler. */
export const GENERATED_HTML = `<!DOCTYPE html><html><head><style>body{font-family:Georgia,serif;color:#222} .name{font-size:28px;font-weight:700}</style></head><body>
<div class="header"><span class="name">Ada Example</span></div><ul class="bullets"><li>Led a team of four building a payments ledger in Go</li>
<li>Reduced p99 latency by 40% across the order pipeline</li></ul><script>window.__ranFromResume = 1</script>
<img src="http://tracker.invalid/pixel.png" onerror="window.__ranFromResume = 2"></body></html>`;
export const PDF_BYTES = Buffer.from('%PDF-1.4\n% synthetic test PDF for J6\n%%EOF\n');

/** The base résumé (the active profile's) — what a generation is made from. */
export function seedBaseResume(db, { userId = 1, profileId = 10 } = {}) {
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content) VALUES (?,?,'base.txt',?)").run(profileId, userId, BASE_RESUME);
}

export function mountExtensionResume(app, db, { userId = 1, profileId = 10, slotsRoute = false } = {}) {
  const ctl = { mode: 'ok', html: GENERATED_HTML, calls: [], gate: null, rendered: [] };
  ctl.hold = () => { let release; ctl.gate = new Promise(r => { release = r; }); return () => { ctl.gate = null; release(); }; };
  const generate = async ({ userId: uid, jobId, job, isCancelled }) => {
    ctl.calls.push({ userId: uid, jobId });
    if (isCancelled()) throw new GenerationCancelledError('before_model');
    if (ctl.gate) await ctl.gate;
    if (isCancelled()) throw new GenerationCancelledError('after_model');
    if (ctl.mode === 'refuse') throw Object.assign(new Error('withheld'), { code: 'resume_claim_violation',
      violations: [{ message: 'The résumé claims 9 years of experience; your profile states 6.' }] });
    if (ctl.mode === 'fail') throw Object.assign(new Error('Your credit balance is too low to access claude-sonnet-5 (12,000 input tokens, $0.04)'), { code: 'tools_service_error' });
    const s = storeGeneratedResume(db, { userId: uid, jobId, job, tool: 'a_plus_resume', html: ctl.html, atsScore: 81, baseAtsScore: 62, domainProfileId: profileId });
    // what a caller could leak if the service echoed it — it must not reach the panel
    return { version: s.version, html: ctl.html, atsScore: 81, baseAtsScore: 62, resumeId: s.resumeId, tool: 'a_plus_resume', model: 'claude-sonnet-5', usage: { inputTokens: 12000, costUsd: 0.04 } };
  };
  const service = createExtensionResumeService({
    db, generate, renderPdf: async (html) => { ctl.rendered.push(html); return PDF_BYTES; }, log: { error() {}, warn() {} },
  });
  app.use((req, _res, next) => { if (!req.user) req.user = { id: userId }; next(); });
  app.use(createExtensionResumeRouter({ service, requireAuth: (q, r, n) => n(), isExtension: () => true }));
  if (slotsRoute) {
    app.get('/api/draft/slots', (req, res) => { const s = draftSlots(db, req.user.id); res.json({ limit: s.limit, used: s.used, remaining: s.remaining, windowHours: s.windowHours }); });
  }
  ctl.service = service;
  ctl.generations = () => db.prepare('SELECT id, status FROM extension_resume_generations ORDER BY created_at').all();
  ctl.slots = () => db.prepare("SELECT COUNT(*) FROM draft_slot_uses WHERE user_id=? AND kind='generate'").pluck().get(userId);
  ctl.pdfs = () => db.prepare('SELECT id, file_name, attached_at FROM resume_pdf_artifacts').all();
  return ctl;
}

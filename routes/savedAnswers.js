// ── D55 (f) · SAVED ANSWERS — the candidate's own answers, kept for reuse ─────────────────────────────
//
// docs/AUTOFILL_TARGET.md §8.1 rows 4–7, §8.2 item 2. Mounted at the root like routes/account.js, so
// every route carries its full /api path and its own requireAuth (test/authRouteGuardManifest.test.js
// enumerates them). Every route reads and writes ONLY req.user.id's own user_profile row.
//
// ⛔ USER-STATED ONLY. Nothing here stores an answer the server worked out: each write carries text
// the candidate typed or picked — in Draft House, in the extension's review overlay, or in
// Settings → Saved answers.

import { Router } from "express";
import { readAnswerStore, rememberAnswer, effectiveCustomAnswers as resolveFor } from "../services/customAnswers.js";
import {
  listEntries, editEntry, deleteEntry, exportJson, exportCsv, readImportFile, validateImport, testQuestion,
} from "../services/savedAnswersManage.js";
import { buildPacketEntries } from "../services/applyGatePacket.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { SAVED_ANSWER_LIMITS, workHistoryCompanies } from "../shared/savedAnswers.js";
import {
  acknowledgeAnswer, changeAnswer, editLifecycleAnswer, deleteLifecycleAnswer, listLifecycle, reviewDueOf, recordReview,
  packetLifecycleAnswers, lifecycleInputs,
} from "../services/answerLifecycle.js";

export function createSavedAnswersRouter({ db, requireAuth, buildAutofillPayload = null }) {
  const router = Router();

  const profileOf = (userId) => db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
  const sendCode = (res, e) => {
    if (!e.code) throw e;
    res.status(e.code === "not_found" ? 404 : 400).json({ error: e.code });
  };
  // Migration 164: the label-only answers count as acknowledged from the migration (or the last review).
  const legacyAcknowledgedAt = (userId) => {
    const s = profileOf(userId).custom_answers_acknowledged_at;
    return s == null ? null : new Date(Number(s) * 1000).toISOString();
  };

  /**
   * Settings → Saved answers: every entry, what kind of question it is, and the limits.
   * ⭐ D96 §4: `entries` are the label-only answers (acknowledged, source legacy, dated by migration 164);
   * `lifecycle` the keyed answers with their state, date and history; `reviewDue` the 90-day reminder or null.
   */
  router.get("/api/saved-answers", requireAuth, (req, res) => {
    const userId = req.user.id;
    const legacyAt = legacyAcknowledgedAt(userId);
    res.json({
      entries: listEntries(storeOf(userId)).map(e => ({ ...e, state: "acknowledged", source: "legacy", acknowledgedAt: legacyAt })),
      lifecycle: listLifecycle(db, userId),
      reviewDue: reviewDueOf(db, userId),
      limits: SAVED_ANSWER_LIMITS,
    });
  });

  /** Edit one entry, or rename it. Body: { question, answer, previousQuestion?, company? } */
  router.put("/api/saved-answers", requireAuth, (req, res) => {
    try {
      write(req.user.id, editEntry(storeOf(req.user.id), req.body || {}));
      res.json({ ok: true, entries: listEntries(storeOf(req.user.id)) });
    } catch (e) { sendCode(res, e); }
  });

  /** Delete one entry. Body: { question, company? } */
  router.delete("/api/saved-answers", requireAuth, (req, res) => {
    try {
      write(req.user.id, deleteEntry(storeOf(req.user.id), { question: req.body?.question, company: req.body?.company || null }));
      res.json({ ok: true, entries: listEntries(storeOf(req.user.id)) });
    } catch (e) { sendCode(res, e); }
  });

  /** Bulk export: ?format=json (default) | csv — a download. */
  router.get("/api/saved-answers/export", requireAuth, (req, res) => {
    const store = storeOf(req.user.id);
    if (req.query?.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="draft-saved-answers.csv"');
      return res.send(exportCsv(store));
    }
    res.setHeader("Content-Disposition", 'attachment; filename="draft-saved-answers.json"');
    res.json(exportJson(store));
  });

  /**
   * Bulk import through the five guards (services/savedAnswersManage.js). DRY RUN unless apply:true.
   * Body: { format: 'json'|'csv', content: string, apply?: boolean, overwrite?: boolean }
   * 200 { applied, accepted: [...], rejected: [{ row, question, reason }] } · 413 too_large · 400
   */
  router.post("/api/saved-answers/import", requireAuth, (req, res) => {
    const { format = "json", content, apply = false, overwrite = false } = req.body || {};
    if (format !== "json" && format !== "csv") return res.status(400).json({ error: "format_invalid" });
    if (content === undefined || content === null) return res.status(400).json({ error: "content_required" });
    const file = readImportFile({ format, content });
    if (file.error) return res.status(file.error === "too_large" ? 413 : 400).json({ error: file.error });
    const result = validateImport(storeOf(req.user.id), file.entries, { overwrite: !!overwrite });
    if (result.fileRefused) return res.status(413).json({ error: "too_large", rejected: result.rejected });
    const applied = apply === true && result.accepted.length > 0;
    if (applied) write(req.user.id, result.store);
    res.json({ applied, dryRun: apply !== true, accepted: result.accepted, rejected: result.rejected });
  });

  /**
   * "Test a question": which saved answer matches and why, or "no match: it would stop".
   * Body: { question, company?, options?: string[] | {value,label}[] }
   */
  router.post("/api/saved-answers/test", requireAuth, (req, res) => {
    const { question, company = null, options = null } = req.body || {};
    if (!String(question ?? "").trim()) return res.status(400).json({ error: "question_required" });
    if (String(question).length > SAVED_ANSWER_LIMITS.maxQuestionChars) return res.status(400).json({ error: "too_long" });
    const profile = profileOf(req.user.id);
    const store = readAnswerStore(profile);
    const base = buildAutofillPayload ? buildAutofillPayload(profile, "APPLY", company || null) : null;
    const payload = base && typeof base === "object"
      ? base
      : { field_map: {}, handler_map: {}, custom_answers: {} };
    // The same work history a run's payload carries (routes/apply.js): current_company + the base
    // résumé's EXPERIENCE companies.
    let work = [];
    try {
      const b = db.prepare("SELECT content FROM base_resume WHERE user_id=?").get(req.user.id);
      if (b?.content) work = buildPacketEntries({ profile, structuredResume: buildStructuredResume(b.content) })?.work || [];
    } catch { /* no base résumé table / none readable */ }
    if (!base) payload.custom_answers = (resolveFor(store, company));
    payload.worked_here = { company: company || null, history: workHistoryCompanies({ profile, work }) };
    res.json(testQuestion({ payload, store, question, company, options }));
  });

  const storeOf = (userId) =>
    readAnswerStore(db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {});
  const write = (userId, store) => {
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
    db.prepare("UPDATE user_profile SET custom_answers=?, custom_answer_overrides=? WHERE user_id=?")
      .run(JSON.stringify(store.answers), JSON.stringify(store.overrides), userId);
  };

  // ── D96 §4 · THE LIFECYCLE — the on-page panel (lane J4, the extension's own token) and Settings ─────────
  // Each takes the question AS THE PAGE SHOWS IT: { question, widgetKind, options? } is the key
  // (shared/answerKey.js); `company` only resolves a {company} template in the label-only store.
  const lifecycleError = (res, e) => {
    if (!e.code) throw e;
    const status = e.code === "not_found" ? 404 : e.code === "never_remembered" ? 422 : e.code === "lifecycle_unavailable" ? 503 : 400;
    res.status(status).json({ error: e.code, ...(e.reason ? { reason: e.reason } : {}) });
  };
  const jobIdOf = (b) => (b?.jobId == null || b.jobId === "" ? null : String(b.jobId).slice(0, 200));

  /**
   * Acknowledge — one tick, remembered for every later fill and the Copy sheet (eligibility included).
   * Body: { question, answer, widgetKind, options?, source?: 'you_typed'|'you_acknowledged', jobId?, company? }
   * 200 { ok, answer: <row> } · 422 { error: 'never_remembered', reason } · 400 { error }
   */
  router.post("/api/saved-answers/acknowledge", requireAuth, (req, res) => {
    const b = req.body || {};
    try {
      res.json({ ok: true, answer: acknowledgeAnswer(db, req.user.id, {
        question: b.question, answer: b.answer, widgetKind: b.widgetKind, options: b.options ?? null,
        source: b.source || "you_acknowledged", jobId: jobIdOf(b), company: b.company || null,
      }) });
    } catch (e) { lifecycleError(res, e); }
  });

  /**
   * Change — the person edited a remembered answer on the page. A history row; the new value is NOT stored
   * (it serves this application only); the old one stops being auto-used; the next application asks again.
   * Body: { question, answer (the new value), widgetKind, options?, jobId?, company? }
   * 200 { ok, stored: false, servesThisApplicationOnly: true, state: 'changed'|'unremembered', ...row }
   */
  router.post("/api/saved-answers/change", requireAuth, (req, res) => {
    const b = req.body || {};
    try {
      res.json({ ok: true, ...changeAnswer(db, req.user.id, {
        question: b.question, answer: b.answer, widgetKind: b.widgetKind, options: b.options ?? null,
        jobId: jobIdOf(b), company: b.company || null,
      }) });
    } catch (e) { lifecycleError(res, e); }
  });

  /** Settings → Edit a keyed answer: typed in Settings, so stored and acknowledged. Body: { answer } */
  router.put("/api/saved-answers/lifecycle/:id", requireAuth, (req, res) => {
    try { res.json({ ok: true, answer: editLifecycleAnswer(db, req.user.id, req.params.id, { answer: req.body?.answer }) }); }
    catch (e) { lifecycleError(res, e); }
  });

  /** Delete a keyed answer and its history — the next fill asks again. */
  router.delete("/api/saved-answers/lifecycle/:id", requireAuth, (req, res) => {
    try { res.json(deleteLifecycleAnswer(db, req.user.id, req.params.id)); }
    catch (e) { lifecycleError(res, e); }
  });

  /**
   * What a fill may use NOW, in the packet's savedAnswers shape — for the panel after an acknowledgement, without
   * re-preparing. ?company= expands {company} templates. 200 { savedAnswers: [...] }
   */
  router.get("/api/saved-answers/fillable", requireAuth, (req, res) => {
    const company = typeof req.query?.company === "string" && req.query.company.trim() ? req.query.company.trim().slice(0, 200) : null;
    const { records, legacyAcknowledgedAt: legacyAt } = lifecycleInputs(db, req.user.id);
    res.json({ savedAnswers: packetLifecycleAnswers({ legacy: resolveFor(storeOf(req.user.id), company), records, legacyAcknowledgedAt: legacyAt }) });
  });

  /** The 90-day review reminder: 200 { reviewDue: null | { due, lastReviewedAt, dueAt, categories, count, showInPanel } } */
  router.get("/api/saved-answers/review", requireAuth, (req, res) => {
    res.json({ reviewDue: reviewDueOf(db, req.user.id) });
  });

  /** Body: { action: 'confirmed' (Still right — reviewed now) | 'dismissed' (the panel showed it once) } */
  router.post("/api/saved-answers/review", requireAuth, (req, res) => {
    try { res.json({ ok: true, reviewDue: recordReview(db, req.user.id, req.body?.action) }); }
    catch (e) { lifecycleError(res, e); }
  });

  /**
   * "Save this answer for next time?" — for a question that STOPPED a fill. Called by the review
   * overlay (extension) and by any surface that has the candidate's answer to one question.
   * Body: { question, answer, company?, scope: 'all' | 'company' }
   *   'all'     reused at every employer; the employer's name templated as {company}
   *   'company' this employer only (a motivation question is always narrowed to this)
   * 200 { ok, saved: { scope, question, company?, templated?, narrowed? } } · 400 { error: code }
   */
  router.post("/api/saved-answers/remember", requireAuth, (req, res) => {
    const { question, answer, company = null, scope = "all" } = req.body || {};
    if (scope !== "all" && scope !== "company") return res.status(400).json({ error: "scope_invalid" });
    try {
      const { store, saved } = rememberAnswer(storeOf(req.user.id), { question, answer, company, scope });
      write(req.user.id, store);
      res.json({ ok: true, saved });
    } catch (e) {
      if (!e.code) throw e;
      res.status(400).json({ error: e.code });
    }
  });

  return router;
}

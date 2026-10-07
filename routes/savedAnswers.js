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
import { readAnswerStore, rememberAnswer } from "../services/customAnswers.js";

export function createSavedAnswersRouter({ db, requireAuth }) {
  const router = Router();

  const storeOf = (userId) =>
    readAnswerStore(db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {});
  const write = (userId, store) => {
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
    db.prepare("UPDATE user_profile SET custom_answers=?, custom_answer_overrides=? WHERE user_id=?")
      .run(JSON.stringify(store.answers), JSON.stringify(store.overrides), userId);
  };

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

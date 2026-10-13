// ── D96 §4 · THE SAVED-ANSWER LIFECYCLE — acknowledge once, remembered; a change is recorded, not stored ──
//
// The owner's rule (10-13): *tick once and it is remembered; it is not asked again unless the user wants to
// change it. A change is recorded as a change, and the new value is NOT stored until the user acknowledges it
// again.* It applies to EVERY category — eligibility and voluntary disclosures included — because what is
// stored is the person's own stated answer, never a guess (D36: exact-or-blank). It SUPERSEDES the older
// "a sensitive answer is saved only on an explicit tick each time" rule.
//
//             acknowledge                    edit (in the panel)
//   (asked) ─────────────► ACKNOWLEDGED ──────────────────────► CHANGED
//      ▲                    every later fill                     history row: from → to · when · which job
//      │                    and the Copy sheet                   the old value is NO LONGER auto-used
//      └─────────── asked again ◄────────────────────────────────┘ the new value serves this application only
//                                                                 acknowledge the new value → ACKNOWLEDGED
//
// WHERE IT LIVES (migration 164). Two stores, one per kind of answer, never two copies of one answer:
//   · `saved_answers` — the KEYED answers the on-page panel acknowledges: the normalised label + widget kind +
//     option wording (shared/answerKey.js), with state, source, date acknowledged, last reviewed. UNIQUE per
//     (user, key), so for one question the newest acknowledgement simply is the row.
//   · `user_profile.custom_answers` — the web's label-only answers (Settings, Draft House, the import), as
//     before; every reader of it (buildAutofillPayload, the server-side run, Draft House's unblocking) is
//     unchanged. Migration 164 marks them acknowledged at migration time (`custom_answers_acknowledged_at`),
//     source `legacy`, so they keep filling.
//   · `answer_history` — every change: from → to, when, which job.
// Where the two stores meet on one label, the lifecycle wins: acknowledging a different value, or changing
// it, removes the label-only entry (recorded in the history), so no stale value survives a change.
//
// ⛔ Never remembered and never returned for a fill, whatever is stored: terms, consent, privacy notices,
// attestations, signatures — and password, payment and national-id fields (shared/answerKey.js).
// Nothing here calls a model (D17). Every query is scoped to the caller's own user id.

import { eligibilityClassOf } from "./applyAutomation.js";
import { readAnswerStore, expandCompany, companyKey, isTemplate } from "./customAnswers.js";
import { isOptInQuestion, SAVED_ANSWER_LIMITS } from "../shared/savedAnswers.js";
import { answerKeyOf, questionLabelKey, neverFillableReason } from "../shared/answerKey.js";

/** The 90-day quiet review reminder for eligibility and disclosure answers (D96 §4 safeguard 4). */
export const REVIEW_INTERVAL_DAYS = 90;
const DAY = 86400;

export const LIFECYCLE_STATES = Object.freeze(["acknowledged", "changed"]);
export const LIFECYCLE_SOURCES = Object.freeze(["you_typed", "you_acknowledged", "legacy"]);

const nowSec = () => Math.floor(Date.now() / 1000);
const iso = (sec) => (sec == null ? null : new Date(Number(sec) * 1000).toISOString());
function codeError(code, extra = {}) { const e = new Error(code); e.code = code; Object.assign(e, extra); return e; }

/** The category a question belongs to — an eligibility class (work_authorization, …, 'eeo') or null. */
export function categoryOf(question) { return eligibilityClassOf(question) || null; }

function tableReady(db) {
  try { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='saved_answers'").get(); }
  catch { return false; }
}
function profileOf(db, userId) {
  try { return db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || null; } catch { return null; }
}
function writeLegacy(db, userId, store) {
  db.prepare("UPDATE user_profile SET custom_answers=?, custom_answer_overrides=? WHERE user_id=?")
    .run(JSON.stringify(store.answers), JSON.stringify(store.overrides), userId);
}
function history(db, userId, k, question, event, from, to, jobId, at) {
  db.prepare(`INSERT INTO answer_history (user_id, question_key, widget_kind, options_key, question, event, from_value, to_value, job_id, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, k.questionKey, k.widgetKind, k.optionsKey, question, event, from ?? null, to ?? null, jobId == null ? null : String(jobId), at);
}

/**
 * The label-only (legacy) entries that answer this label — every-employer answers, {company} expanded, and
 * this employer's own overrides. Returned as places in the store so a change can remove them.
 */
function legacyMatches(store, questionKey, company) {
  const out = [];
  for (const [q, a] of Object.entries(store.answers || {})) {
    const asked = isTemplate(q) ? (company ? expandCompany(q, company) : null) : q;
    if (asked != null && questionLabelKey(asked) === questionKey && String(a).trim() !== "") out.push({ where: "answers", q, a: String(a) });
  }
  const ck = companyKey(company);
  for (const [q, a] of Object.entries((ck && store.overrides?.[ck]) || {})) {
    if (questionLabelKey(expandCompany(q, company)) === questionKey && String(a).trim() !== "") out.push({ where: "override", ck, q, a: String(a) });
  }
  return out;
}
function removeLegacy(store, matches) {
  const next = { answers: { ...(store.answers || {}) }, overrides: {} };
  for (const [c, byQ] of Object.entries(store.overrides || {})) next.overrides[c] = { ...byQ };
  for (const m of matches) {
    if (m.where === "answers") delete next.answers[m.q];
    else if (next.overrides[m.ck]) { delete next.overrides[m.ck][m.q]; if (!Object.keys(next.overrides[m.ck]).length) delete next.overrides[m.ck]; }
  }
  return next;
}

function validate({ question, answer, widgetKind, options }) {
  const q = String(question ?? "").trim();
  if (!q) throw codeError("question_required");
  if (q.length > SAVED_ANSWER_LIMITS.maxQuestionChars) throw codeError("too_long");
  if (answer !== undefined && String(answer ?? "").length > SAVED_ANSWER_LIMITS.maxAnswerChars) throw codeError("too_long");
  if (options != null && (!Array.isArray(options) || options.length > 500)) throw codeError("options_invalid");
  const never = neverFillableReason(q, options);
  if (never) throw codeError("never_remembered", { reason: never });
  return { q, k: answerKeyOf({ question: q, widgetKind, options }) };
}

function rowOf(db, userId, k) {
  return db.prepare(`SELECT * FROM saved_answers WHERE user_id=? AND question_key=? AND widget_kind=? AND options_key=?`)
    .get(userId, k.questionKey, k.widgetKind, k.optionsKey);
}

/**
 * ACKNOWLEDGE — one tick, remembered. `source`: 'you_typed' (the person typed it and ticked Remember) or
 * 'you_acknowledged' (they ticked a value draft prepared). Re-acknowledging a CHANGED answer stores the new
 * value. A different value over a remembered one is recorded in the history (from → to).
 * Returns the stored row as the API shows it.
 */
export function acknowledgeAnswer(db, userId, { question, answer, widgetKind, options = null, source = "you_acknowledged", jobId = null, company = null, now = nowSec() } = {}) {
  if (!tableReady(db)) throw codeError("lifecycle_unavailable");
  const { q, k } = validate({ question, answer, widgetKind, options });
  const a = String(answer ?? "").trim();
  if (!a) throw codeError("answer_required");
  if (source !== "you_typed" && source !== "you_acknowledged") throw codeError("source_invalid");
  return db.transaction(() => {
    const prev = rowOf(db, userId, k);
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
    const store = readAnswerStore(profileOf(db, userId) || {});
    const legacy = legacyMatches(store, k.questionKey, company);
    // What was remembered before, if anything: the row's value, else (no row) a label-only entry's.
    const before = prev ? (prev.state === "acknowledged" ? prev.answer : null) : (legacy[0]?.a ?? null);
    const pendingChange = prev?.state === "changed";
    if (!prev && countRows(db, userId) >= SAVED_ANSWER_LIMITS.maxEntries) throw codeError("too_many");
    if (prev) {
      db.prepare(`UPDATE saved_answers SET question=?, answer=?, state='acknowledged', source=?, category=?, acknowledged_at=?, reviewed_at=?, updated_at=?, last_job_id=COALESCE(?, last_job_id)
        WHERE id=?`).run(q, a, source, categoryOf(q), now, now, now, jobId == null ? null : String(jobId), prev.id);
    } else {
      db.prepare(`INSERT INTO saved_answers (user_id, question_key, widget_kind, options_key, question, answer, state, source, category, acknowledged_at, reviewed_at, created_at, updated_at, last_job_id)
        VALUES (?, ?, ?, ?, ?, ?, 'acknowledged', ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, k.questionKey, k.widgetKind, k.optionsKey, q, a, source, categoryOf(q), now, now, now, now, jobId == null ? null : String(jobId));
    }
    if ((before != null && before !== a) || pendingChange) history(db, userId, k, q, "acknowledged", before, a, jobId, now);
    // A label-only entry with a DIFFERENT value is the old answer: it stops being used (newest wins).
    const stale = legacy.filter(m => m.a !== a);
    if (stale.length) writeLegacy(db, userId, removeLegacy(store, stale));
    return present(rowOf(db, userId, k), historyOf(db, userId, k));
  })();
}

/**
 * CHANGE — the person edited a remembered answer on the page. The history row is written (from → to · when ·
 * which job); the NEW value is NOT stored — it serves this application only, in the panel; the OLD value stops
 * being auto-used (the row becomes 'changed', and a label-only entry for the label is removed); the next
 * application asks again until the new value is acknowledged.
 * A change to an answer that was never remembered stores nothing at all: { state: 'unremembered' }.
 */
export function changeAnswer(db, userId, { question, answer, widgetKind, options = null, jobId = null, company = null, now = nowSec() } = {}) {
  if (!tableReady(db)) throw codeError("lifecycle_unavailable");
  const { q, k } = validate({ question, answer, widgetKind, options });
  const to = String(answer ?? "");
  return db.transaction(() => {
    const prev = rowOf(db, userId, k);
    const store = readAnswerStore(profileOf(db, userId) || {});
    const legacy = legacyMatches(store, k.questionKey, company);
    const from = prev?.state === "acknowledged" ? prev.answer : (legacy[0]?.a ?? null);
    if (!prev && !legacy.length) return { state: "unremembered", stored: false, servesThisApplicationOnly: true };
    if (prev?.state === "changed" && !legacy.length) {
      history(db, userId, k, q, "changed", null, to, jobId, now);
      return { ...present(prev, historyOf(db, userId, k)), stored: false, servesThisApplicationOnly: true };
    }
    if (prev) {
      db.prepare(`UPDATE saved_answers SET answer=NULL, state='changed', changed_at=?, updated_at=?, last_job_id=COALESCE(?, last_job_id) WHERE id=?`)
        .run(now, now, jobId == null ? null : String(jobId), prev.id);
    } else {
      db.prepare(`INSERT INTO saved_answers (user_id, question_key, widget_kind, options_key, question, answer, state, source, category, acknowledged_at, changed_at, created_at, updated_at, last_job_id)
        VALUES (?, ?, ?, ?, ?, NULL, 'changed', 'legacy', ?, NULL, ?, ?, ?, ?)`)
        .run(userId, k.questionKey, k.widgetKind, k.optionsKey, q, categoryOf(q), now, now, now, jobId == null ? null : String(jobId));
    }
    if (legacy.length) writeLegacy(db, userId, removeLegacy(store, legacy));
    history(db, userId, k, q, "changed", from, to, jobId, now);
    return { ...present(rowOf(db, userId, k), historyOf(db, userId, k)), stored: false, servesThisApplicationOnly: true };
  })();
}

/** Settings → Edit: typed in Settings, so it IS the person's acknowledgement — stored, history 'edited'. */
export function editLifecycleAnswer(db, userId, id, { answer, now = nowSec() } = {}) {
  if (!tableReady(db)) throw codeError("lifecycle_unavailable");
  const row = db.prepare("SELECT * FROM saved_answers WHERE id=? AND user_id=?").get(Number(id), userId);
  if (!row) throw codeError("not_found");
  const a = String(answer ?? "").trim();
  if (!a) throw codeError("answer_required");
  if (a.length > SAVED_ANSWER_LIMITS.maxAnswerChars) throw codeError("too_long");
  const k = { questionKey: row.question_key, widgetKind: row.widget_kind, optionsKey: row.options_key };
  db.transaction(() => {
    db.prepare(`UPDATE saved_answers SET answer=?, state='acknowledged', source='you_typed', acknowledged_at=?, reviewed_at=?, updated_at=? WHERE id=?`)
      .run(a, now, now, now, row.id);
    if (row.answer !== a || row.state !== "acknowledged") history(db, userId, k, row.question, "edited", row.state === "acknowledged" ? row.answer : null, a, null, now);
  })();
  return present(rowOf(db, userId, k), historyOf(db, userId, k));
}

/** Delete — the next fill asks again. The answer's history goes with it: nothing of it is kept unseen. */
export function deleteLifecycleAnswer(db, userId, id) {
  if (!tableReady(db)) throw codeError("lifecycle_unavailable");
  const row = db.prepare("SELECT * FROM saved_answers WHERE id=? AND user_id=?").get(Number(id), userId);
  if (!row) throw codeError("not_found");
  db.transaction(() => {
    db.prepare("DELETE FROM answer_history WHERE user_id=? AND question_key=? AND widget_kind=? AND options_key=?")
      .run(userId, row.question_key, row.widget_kind, row.options_key);
    db.prepare("DELETE FROM saved_answers WHERE id=? AND user_id=?").run(row.id, userId);
  })();
  return { ok: true };
}

function countRows(db, userId) {
  try { return db.prepare("SELECT COUNT(*) n FROM saved_answers WHERE user_id=?").get(userId).n; } catch { return 0; }
}
function historyOf(db, userId, k) {
  return db.prepare(`SELECT event, from_value, to_value, job_id, at FROM answer_history
    WHERE user_id=? AND question_key=? AND widget_kind=? AND options_key=? ORDER BY at DESC, id DESC LIMIT 50`)
    .all(userId, k.questionKey, k.widgetKind, k.optionsKey)
    .map(h => ({ event: h.event, from: h.from_value, to: h.to_value, jobId: h.job_id, at: iso(h.at) }));
}
const parseOptions = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

/** One row as the API shows it. */
export function present(row, hist = []) {
  if (!row) return null;
  return {
    id: row.id, question: row.question, answer: row.state === "acknowledged" ? row.answer : null,
    state: row.state, source: row.source, category: row.category || null,
    widgetKind: row.widget_kind, questionKey: row.question_key, options: parseOptions(row.options_key),
    acknowledgedAt: iso(row.acknowledged_at), changedAt: iso(row.changed_at),
    lastReviewedAt: iso(Math.max(row.acknowledged_at || 0, row.reviewed_at || 0) || null),
    attesting: !!row.category, history: hist,
  };
}

/** Settings: every keyed answer with its state, date and history. Only the caller's own. */
export function listLifecycle(db, userId) {
  if (!tableReady(db)) return [];
  const rows = db.prepare("SELECT * FROM saved_answers WHERE user_id=? ORDER BY updated_at DESC, id DESC").all(userId);
  return rows.map(r => present(r, historyOf(db, userId, { questionKey: r.question_key, widgetKind: r.widget_kind, optionsKey: r.options_key })));
}

/** The acknowledged keyed answers a fill may use (never a consent / attestation / secret, whatever is stored). */
export function fillableRecords(db, userId) {
  if (!tableReady(db)) return [];
  return db.prepare("SELECT * FROM saved_answers WHERE user_id=? ORDER BY acknowledged_at DESC, id DESC").all(userId);
}

/**
 * ⭐ THE PACKET'S savedAnswers (pure) — what a fill may use, each with WHERE it came from and WHEN it was
 * acknowledged, so the panel can say "you acknowledged this on 11 Oct" and the Copy sheet "you are attesting
 * to this" for an eligibility row.
 *   legacy   the label-only map already resolved for this employer ({company} expanded, motivation withheld)
 *   records  saved_answers rows (any state)
 *   legacyAcknowledgedAt  user_profile.custom_answers_acknowledged_at (seconds) or null
 * ⛔ Only ACKNOWLEDGED answers. ⛔ A label any keyed row holds (acknowledged OR changed) is not also offered
 * from the label-only store. ⛔ Never a terms / consent / privacy / attestation / signature / secret question.
 */
export function packetLifecycleAnswers({ legacy = {}, records = [], legacyAcknowledgedAt = null } = {}) {
  const out = [];
  const keyed = new Set((records || []).map(r => r.question_key));
  for (const [question, answer] of Object.entries(legacy || {})) {
    if (!String(question).trim() || answer == null || String(answer).trim() === "") continue;
    if (neverFillableReason(question)) continue;
    if (keyed.has(questionLabelKey(question))) continue;
    const eligibility = !!eligibilityClassOf(question);
    out.push({
      question, answer: String(answer), eligibility, optIn: isOptInQuestion(question),
      source: "legacy", acknowledgedAt: iso(legacyAcknowledgedAt), widgetKind: "any", options: null,
      questionKey: questionLabelKey(question), attesting: eligibility,
    });
  }
  for (const r of records || []) {
    if (r.state !== "acknowledged" || r.answer == null || String(r.answer).trim() === "") continue;
    const options = parseOptions(r.options_key);
    if (neverFillableReason(r.question, options)) continue;
    const eligibility = !!eligibilityClassOf(r.question);
    out.push({
      question: r.question, answer: String(r.answer), eligibility, optIn: isOptInQuestion(r.question),
      source: r.source, acknowledgedAt: iso(r.acknowledged_at), widgetKind: r.widget_kind, options,
      questionKey: r.question_key, attesting: eligibility, id: r.id,
    });
  }
  return out;
}

/** The records and the legacy date for one user, ready to hang on an autofill payload. */
export function lifecycleInputs(db, userId) {
  const profile = profileOf(db, userId);
  return { records: fillableRecords(db, userId), legacyAcknowledgedAt: profile?.custom_answers_acknowledged_at ?? null };
}

/**
 * ⭐ THE 90-DAY REVIEW REMINDER (quiet, never blocking). Over the eligibility and disclosure answers — keyed
 * rows acknowledged, and label-only entries dated by the migration or the last review — the OLDEST last
 * review decides. `showInPanel` is true once per due period: the panel reports it shown ('dismissed').
 * Returns null when there is nothing of the kind to review.
 */
export function reviewDueOf(db, userId, { now = nowSec() } = {}) {
  const profile = profileOf(db, userId) || {};
  const items = [];
  for (const r of fillableRecords(db, userId)) {
    if (r.state !== "acknowledged" || !r.category) continue;
    items.push({ category: r.category, at: Math.max(r.acknowledged_at || 0, r.reviewed_at || 0) });
  }
  const legacyAt = profile.custom_answers_acknowledged_at ?? null;
  if (legacyAt != null) {
    for (const q of Object.keys(readAnswerStore(profile).answers)) {
      const c = categoryOf(q);
      if (c) items.push({ category: c, at: legacyAt });
    }
  }
  if (!items.length) return null;
  const oldest = Math.min(...items.map(i => i.at));
  const dueSince = oldest + REVIEW_INTERVAL_DAYS * DAY;
  const due = now >= dueSince;
  const dueItems = items.filter(i => now >= i.at + REVIEW_INTERVAL_DAYS * DAY);
  const reminded = profile.answer_review_reminded_at ?? null;
  return {
    due, lastReviewedAt: iso(oldest), dueAt: iso(dueSince), intervalDays: REVIEW_INTERVAL_DAYS,
    categories: [...new Set(dueItems.map(i => i.category))].sort(), count: dueItems.length,
    showInPanel: due && !(reminded != null && reminded >= dueSince),
  };
}

/** 'confirmed' — every eligibility / disclosure answer reviewed now. 'dismissed' — the panel showed it once. */
export function recordReview(db, userId, action, { now = nowSec() } = {}) {
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  if (action === "confirmed") {
    db.transaction(() => {
      if (tableReady(db)) db.prepare("UPDATE saved_answers SET reviewed_at=? WHERE user_id=? AND state='acknowledged' AND category IS NOT NULL").run(now, userId);
      db.prepare("UPDATE user_profile SET custom_answers_acknowledged_at=? WHERE user_id=? AND custom_answers_acknowledged_at IS NOT NULL").run(now, userId);
    })();
  } else if (action === "dismissed") {
    db.prepare("UPDATE user_profile SET answer_review_reminded_at=? WHERE user_id=?").run(now, userId);
  } else throw codeError("action_invalid");
  return reviewDueOf(db, userId, { now });
}

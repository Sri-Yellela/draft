// ⭐ A165 (owner 11-10): "it held off auto apply for review. didnt specify which questions."
//
// A held application must SAY why it is held and NAME the questions waiting on the person. The facts were all
// recorded — the run job's `open_questions_json` (the fill's unanswered / low-confidence questions), `blanks_json`
// (required fields left empty) and the handoff packet's `unresolved` (what the profile could not answer, plus the
// ATS's own questions in the employer's wording, D185-1) — but no surface read them together, and a hold that
// returned before the browser opened (the full-auto safety gate, the daily cap, a provider out of scope) carried
// only its code. This module is the one place that joins them. Pure: callers pass the stored JSON strings.

const s = (v) => (v == null ? "" : String(v).trim());
const parse = (json) => {
  if (json == null) return null;
  if (typeof json === "object") return json;
  try { return JSON.parse(json); } catch { return null; }
};
const norm = (q) => s(q).toLowerCase().replace(/[\s*:?.]+$/g, "").replace(/\s+/g, " ");

/**
 * ⛔ A189 (written as A185, owner 11-11: "none of them could be submitted even after answering the questions"): ONE rule for
 * which of a run's open questions wait on the person — the held stepper LISTS exactly these, and the answers route
 * (routes/apply.js answersCore) UNBLOCKS a job when exactly these are answered. Before, the stepper hid every
 * `required: false` question while the unblock check required all of them — and `buildOpenQuestions` writes each
 * LOW-CONFIDENCE answer (draft would not send a guess) as `required: false`, so those jobs could never unblock: every
 * Finish answered 409 no_retryable_jobs. A low-confidence question is a real blocker (the next run holds on it again), so
 * it is listed; an optional field and a file are not, and neither blocks.
 */
export function waitsOnPerson(q) {
  if (!q || q.type === "file") return false;   // D165 R1: the résumé is draft's to make, never a question
  if (q.required === false && !q.eligibility && q.reason !== "low_confidence") return false;
  return !!s(q.question || q.label);
}

/**
 * The questions waiting on the person, required first, each once.
 * @returns {Array<{ question: string, required: boolean, from: "form" | "empty" | "profile" | "employer", eligibility?: string|boolean }>}
 */
export function heldQuestionsOf({ openQuestionsJson = null, blanksJson = null, packetJson = null } = {}) {
  const out = [];
  const seen = new Set();
  // ⭐ A181 (3): the form's own control type and options travel with the question, so the held panel draws ONE typed input
  // per question (Yes / No, a choice, a text area for a free-text draft) instead of one box for all of them.
  const push = (question, required, from, eligibility, type = null, options = null) => {
    const k = norm(question);
    if (!k || seen.has(k)) return;
    seen.add(k);
    const opts = Array.isArray(options) ? options.map(o => (o && typeof o === "object" ? s(o.label ?? o.value) : s(o))).filter(Boolean).slice(0, 40) : null;
    out.push({ question: s(question), required: !!required, from, ...(eligibility ? { eligibility } : {}),
      ...(type ? { type: s(type) } : {}), ...(opts && opts.length ? { options: opts } : {}) });
  };
  const open = parse(openQuestionsJson), blanks = parse(blanksJson);
  // ⭐ A179 F3 (owner 11-10: 24 fields listed — First Name, Email … — and optional ones "as if needed"): when the run READ
  // the form (its open questions / blanks were recorded), the form is the truth — the packet's CANONICAL contact fields
  // (which may not even be on this form) are not listed; only its eligibility answers and the employer's own questions
  // stay. An optional field is never listed: left blank, as the person would.
  const readTheForm = Array.isArray(open) || Array.isArray(blanks);
  for (const q of open || []) {
    if (!waitsOnPerson(q)) continue;   // A189: the same rule the unblock check uses
    push(q?.question || q?.label, q?.required, "form", q?.eligibility, q?.type, q?.options);
  }
  for (const b of blanks || []) {
    if (!b?.required || b?.type === "file") continue;
    push(b.label || b.field, true, "empty", null, b.type, b.options);
  }
  const packet = parse(packetJson);
  for (const u of packet?.unresolved || []) {
    if (u?.type === "file") continue;
    if (readTheForm && !u?.eligibility && !u?.from_schema) continue;
    if (!u?.is_required && !(u?.eligibility && !readTheForm)) {
      // an optional item is listed only when it merges into a question already named (the required blank wins)
      if (!seen.has(norm(u?.field || u?.name))) continue;
    }
    push(u?.field || u?.name, u?.is_required, u?.from_schema ? "employer" : "profile", u?.eligibility);
  }
  return out.sort((a, b) => Number(b.required) - Number(a.required));
}

// Plain words for every hold code the server writes, so no held row is ever "Held for you to look at" and nothing
// else. The client's obstacle table (client/src/lib/applyObstacles.js) carries the same sentences for its rows.
const WORDS = Object.freeze({
  awaiting_approval: "Filled and waiting for your approval.",
  full_auto_prerequisites: "Sending without your review waits until draft's safety checks are green, so it was held for you. Nothing was sent.",
  full_auto_not_chosen: "This would have been sent without your review, and your mode is SEMI. Nothing was opened or sent.",
  full_auto_disabled: "Automatic applications are paused by the operator. Nothing was sent.",
  daily_cap_reached: "Today's application limit was reached. It waits for tomorrow or for you.",
  provider_review_only: "This company's application site isn't one draft sends on by itself yet, so it waits for you.",
  ats_below_threshold: "The tailored résumé scored below your ATS threshold.",
  manual_review: "The form asked something only you can answer.",
  low_confidence_answers: "Some answers would have been guesses, and draft never sends a guess.",
  incomplete_form: "Required fields were left empty.",
  login_required: "The company's site wants you signed in.",
  captcha_required: "The company's site is behind a CAPTCHA or an identity check.",
  answers_changed_since_approval: "The form changed after you approved it.",
  // ⭐ A179 F2: caught before the run — nothing was opened, typed or sent
  profile_contact_empty: "Your contact details are empty, so nothing was filled or sent. Upload a résumé or fill your name and email in Profile, then Run now.",
});

/** One sentence: why this application is held. `detail` names the specifics where the code alone can't (the checks). */
export function heldReasonWords(code, detail = null) {
  const base = WORDS[s(code)] || (s(detail) ? s(detail) : "Held for you to look at.");
  if (s(code) === "full_auto_prerequisites") {
    const m = /\(([^)]+)\)/.exec(s(detail));
    if (m) return `${base} Still to pass: ${m[1]}.`;
  }
  return base;
}

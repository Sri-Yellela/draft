// ⭐ D165 (5) [T7] · THE HELD APPLICATION, OPENED IN PLACE — `docs/sketches/held-application-sketch.html` (approved 11-06,
// saved by the owner 11-07, O108). Pure: the tracker's opened row (panels/AutoApplyPanel.jsx renderRow) reads these.
//   heldStateOf   — which of the sketch's four states a row is in: needs · fail · ready · sent (null: not an application run)
//   heldHeadline  — the eyebrow, headline and one-line lead for that state, in the sketch's words
//   runSteps      — every step the run took (read the posting → tailored → attached → filled → you → ready → sent), each
//                   done / now / fail / waiting — "did it even try?" answered at a glance
//   answerSource  — where each answer came from, in plain words (your Profile, you · saved, your résumé, by draft …)
//   earlierAttempts — ONE quiet line for the attempts before the latest, opened on "show"
// Removed by the sketch (not drawn here): HELD ON PURPOSE, No signal, Hide 1 attempt, Open & fill, raw URLs.

const s = (v) => (v == null ? "" : String(v));
const RESUME_FAILED = /^resume_(unavailable|pdf_failed|artifact_missing|claim_violation|generate)/;

/** The latest attempt's row, for the node kinds that carry one. */
export function latestRow(node) {
  if (!node) return null;
  if (node.kind === "approval") return node.ref || null;
  return node.ref?.primary?.row || node.ref?.rows?.[0] || null;
}

export function heldStateOf(node) {
  if (!node) return null;
  if (node.ring === "sent" || node.ring === "reply" || node.kind === "sent") return "sent";
  if (node.kind === "approval") return "ready";
  const row = latestRow(node) || {};
  if ((node.kind === "held" || node.kind === "broke") && RESUME_FAILED.test(s(row.reasonCode))) return "fail";
  if (node.kind === "held" && (node.question || node.why === "question" || node.why === "empty")) return "needs";
  // ⭐ A165: every other held application still says why — the safety gate, the cap, a provider out of scope, stale answers.
  if (node.kind === "held" || node.kind === "gated") return "held";
  return null;
}

/** ⭐ A165: the questions waiting on the person, named (server: services/heldQuestions.js), required first. */
export function heldQuestionsFor(node) {
  if (!node) return [];
  const row = latestRow(node) || {};
  const list = Array.isArray(row.heldQuestions) ? row.heldQuestions : [];
  return list.filter(q => q && s(q.question)).map(q => ({ question: s(q.question), required: !!q.required, from: s(q.from) }));
}

export function heldHeadline(node) {
  const state = heldStateOf(node);
  const company = s(node?.company) || "this company";
  const q = node?.question?.question;
  switch (state) {
    case "needs": return { state, eyebrow: "Only you can answer this", title: q ? s(q).replace(/\s*\??$/, "?") : "One answer only you can give",
      lead: "Everything else is done. draft never makes up salary, eligibility or legal answers." };
    case "fail": return { state, eyebrow: "Something went wrong on our side", title: "The résumé couldn't be made",
      lead: "Nothing was sent, and nothing is left for you to fill. Try again, or pick another base résumé." };
    case "ready": return { state, eyebrow: "Ready for you", title: "Everything is filled. Submit when you're happy.",
      lead: "Check the résumé and the answers if you like." };
    case "sent": return { state, eyebrow: null, title: `Applied to ${company}`,   // D182: the status column says Sent
      lead: "Replies will show here." };
    case "held": {
      const row = latestRow(node) || {};
      const why = s(row.heldReason) || s(node?.say) || "Held for you to look at.";
      const n = heldQuestionsFor(node).length;
      return { state, eyebrow: "Held — nothing was sent", title: why,
        lead: n ? `${n} question${n === 1 ? "" : "s"} ${n === 1 ? "is" : "are"} waiting on you — listed below.` : "No question is waiting on you; it can be sent as it is." };
    }
    default: return null;
  }
}

/**
 * The steps the run took. `counts` = { filled, total } when the answers are read; `resumeName` the attached file's name.
 * Each step: { id, label, state: "done" | "now" | "fail" | "", meta }.
 */
export function runSteps(node, { counts = null, resumeName = "" } = {}) {
  const state = heldStateOf(node);
  if (!state || state === "held") return [];   // A165: a hold before the form says why; it claims no steps
  const fail = state === "fail";
  const after = (at) => ["needs", "ready", "sent"].indexOf(state) >= ["needs", "ready", "sent"].indexOf(at);
  const filledMeta = counts && Number.isFinite(counts.total) && counts.total > 0 ? `${counts.filled} of ${counts.total}` : "";
  return [
    { id: "posting", label: "Read the posting", state: "done", meta: "" },
    { id: "resume", label: fail ? "Tailored your résumé — it couldn't be made" : "Tailored your résumé", state: fail ? "fail" : "done", meta: "" },
    { id: "attached", label: "Attached the résumé", state: fail ? "" : "done", meta: fail ? "waiting" : s(resumeName) },
    { id: "filled", label: "Filled the form", state: fail ? "" : "done", meta: fail ? "waiting" : filledMeta },
    { id: "you", label: state === "needs" ? "Waiting for you" : "Your answers", state: fail ? "" : state === "needs" ? "now" : "done", meta: "" },
    { id: "ready", label: "Ready for you to submit", state: fail ? "" : state === "ready" ? "now" : after("sent") ? "done" : "", meta: "" },
    { id: "sent", label: "Sent", state: state === "sent" ? "done" : "", meta: "" },
  ];
}

// Where an answer came from. Keys are the fill engine's provenance codes (services/applyAutomation.js PROVENANCE, plus
// the sources the fill records beside them).
const SOURCE_WORDS = Object.freeze({
  handler_exact: "your Profile", field_map_exact: "your Profile", label_exact: "your Profile", label_fuzzy: "your Profile · matched loosely",
  sponsorship_derived: "your Profile", sponsorship_assumed_future: "your Profile",
  saved_answer: "you · saved", custom_answer: "you · saved",
  work_history: "your résumé", education: "your résumé",
  user_consent_setting: "your Auto settings",
  default: "draft's default",
});
/** One answer's source, in plain words. An open question reads "needs you"; an own statement "left for you". */
export function answerSource(a = {}) {
  if (a.asked) return "needs you";
  if (a.own) return "left for you";
  if (a.resume || /résumé|resume|cv/i.test(s(a.label)) && /\.pdf$|\.docx?$/i.test(s(a.value))) return "tailored by draft";
  return SOURCE_WORDS[s(a.provenance)] || "by draft";
}

const timeOf = (row) => Number(row?.finishedAt || row?.createdAt || 0);
/**
 * The attempts before the latest, as ONE quiet line: "1 earlier attempt · stopped before the résumé was made" + its detail.
 * Returns null when there is none. `rows` newest first (the tracker's order).
 */
export function earlierAttempts(rows = []) {
  const list = (rows || []).slice(1);
  if (!list.length) return null;
  const last = list[0];
  const why = RESUME_FAILED.test(s(last.reasonCode)) ? "stopped before the résumé was made"
    : last.status === "failed" ? "stopped" : last.status === "submitted" ? "sent" : "replaced by the latest";
  const when = timeOf(last) ? new Date(timeOf(last) > 1e12 ? timeOf(last) : timeOf(last) * 1000) : null;
  return {
    line: `${list.length} earlier attempt${list.length === 1 ? "" : "s"}${when ? ` · ${when.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""} · ${why}`,
    detail: s(last.obstacle || last.reason || last.error) || "This attempt replaced it.",
    count: list.length,
  };
}

/**
 * The inline question's "keep it" label (held-application-sketch.html: "Use this for similar jobs (full-stack, US) next
 * time"). A salary answer is saved for the scope of the jobs blocked on it (D165 (3)); the server names that scope on the
 * question (`GET /api/apply/questions` → salary, scope, scopeSeveral). Every other answer is kept for every employer.
 */
export function saveForNextTimeLabel(q = {}) {
  if (!q?.salary) return "Save this answer for next time";
  if (q.scope) return `Use this for similar jobs (${q.scope}) next time`;
  if (q.scopeSeveral) return "Use this for similar jobs next time (one answer per role and location)";
  return "Use this for similar jobs next time";
}

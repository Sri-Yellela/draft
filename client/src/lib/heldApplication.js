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
  return list.filter(q => q && s(q.question)).map(q => ({ question: s(q.question), required: !!q.required, from: s(q.from),
    eligibility: q.eligibility || null, type: q.type ? s(q.type) : null, options: Array.isArray(q.options) ? q.options.map(s) : null,
    kind: questionKind(q) }));
}

// ⭐ A181 (3) / (4): what each held question IS — a Yes / No statement (work authorisation, sponsorship: the person's own,
// saved once), a choice from the form's options, a free-text question draft writes for the person to check, or a short text.
const YES_NO = /\b(authori[sz]ed|authori[sz]ation|eligible|sponsor|sponsorship|visa|legally|relocat\w*|over (the age of )?18|background check|non-compete)\b/i;
const FREE_TEXT = /\b(why|describe|tell us|explain|what (interests|excites|motivates)|cover letter|proficien\w*|experience with|additional information|anything else)\b/i;
export function questionKind(q) {
  const t = s(q?.type).toLowerCase(), text = s(q?.question);
  const opts = Array.isArray(q?.options) ? q.options : [];
  if (opts.length && opts.length <= 3 && opts.every(o => /^(yes|no|n\/a|prefer not)/i.test(s(o?.label ?? o)))) return "yesno";
  if (opts.length) return "choice";
  if (q?.eligibility || t === "checkbox" || t === "toggle" || YES_NO.test(text)) return "yesno";
  if (t === "text_area" || t === "textarea" || FREE_TEXT.test(text) || text.length > 70) return "draft";
  return "text";
}

/** ⭐ A181 (4): ONE count for the row and the panel — the questions really waiting, split into yours and draft's drafts. */
export function heldCounts(node) {
  const qs = heldQuestionsFor(node);
  const drafts = qs.filter(q => q.kind === "draft").length;
  return { total: qs.length, yours: qs.length - drafts, drafts };
}

export function heldHeadline(node) {
  const state = heldStateOf(node);
  const company = s(node?.company) || "this company";
  const q = node?.question?.question;
  switch (state) {
    case "needs": {
      // ⭐ A179 F1 (owner 11-10: "One answer only you can give" over 24 fields, "Everything else is done" when nothing was):
      // the heading counts the questions really waiting, and "everything else is done" is said only when the run filled the rest.
      const n = heldQuestionsFor(node).length;
      const { yours, drafts } = heldCounts(node);
      const fill = fillOf(latestRow(node));
      // ⭐ A181 (4): "2 answers only you can give · 2 drafts to check" — the free-text ones are draft's to write, the person checks.
      const title = drafts > 0 && n > 1
        ? [yours ? `${yours} answer${yours === 1 ? "" : "s"} only you can give` : null, `${drafts} draft${drafts === 1 ? "" : "s"} to check`].filter(Boolean).join(" · ")
        : n > 1 ? `${n} answers only you can give` : q ? s(q).replace(/\s*\??$/, "?") : "One answer only you can give";
      const rest = fill && fill.filled === 0 ? "Nothing was filled on the form yet — draft had no answers to type."
        : fill && fill.filled > 0 ? `draft filled ${fill.filled}${fill.discovered ? ` of ${fill.discovered}` : ""} fields; the rest are yours.`
        : "Everything else is done.";
      return { state, eyebrow: "Only you can answer this", title,
        lead: `${rest} draft never makes up salary, eligibility or legal answers.` };
    }
    case "fail": return { state, eyebrow: "Something went wrong on our side", title: "The résumé couldn't be made",
      lead: "Nothing was sent, and nothing is left for you to fill. Try again, or pick another base résumé." };
    case "ready": return { state, eyebrow: "Ready for you", title: "Everything is filled. Submit when you're happy.",
      lead: "Check the résumé and the answers if you like." };
    case "sent": return { state, eyebrow: null, title: `Applied to ${company}`,   // D182: the status column says Sent
      lead: "Replies will show here." };
    case "held": {
      const row = latestRow(node) || {};
      const why = s(row.heldReason) || s(node?.say) || "Held for you to look at.";
      // The headline is the reason's first sentence; the rest (what was sent, the checks still to pass) leads the line
      // under it — a whole paragraph as the display headline read as a wall (46b walk).
      const cut = why.search(/\.\s+(?=[A-Z])/);
      const title = cut > 0 ? why.slice(0, cut + 1) : why;
      const rest = cut > 0 ? why.slice(cut + 1).trim() : "";
      const n = heldQuestionsFor(node).length;
      const count = n ? `${n} question${n === 1 ? "" : "s"} ${n === 1 ? "is" : "are"} waiting on you — listed below.` : "No question is waiting on you; it can be sent as it is.";
      return { state, eyebrow: "Held — nothing was sent", title, lead: rest ? `${rest} ${count}` : count };
    }
    default: return null;
  }
}

/**
 * The steps the run took. `counts` = { filled, total } when the answers are read; `resumeName` the attached file's name.
 * Each step: { id, label, state: "done" | "now" | "fail" | "", meta }.
 */
/** ⭐ A179 F1: what the run REPORTED it typed — { filled, discovered } (routes/apply.js publicRunJob `fill`), or null. */
export function fillOf(row) {
  const f = row?.fill;
  if (!f || !Number.isFinite(Number(f.filled))) return null;
  return { filled: Number(f.filled), discovered: Number.isFinite(Number(f.discovered)) && f.discovered != null ? Number(f.discovered) : null };
}

/**
 * ⭐ A179 F1: the résumé step in plain truth — "Tailored" only when the tailored résumé scored above the base; the same score
 * is "already fits — kept as is"; a lower one says so. `row` carries atsScore (the attached résumé) and baseAtsScore.
 */
export function resumeStepOf(row) {
  // the held row's fields, or an approval row's (resume.atsScore, baseAts.score)
  const baseRaw = row?.baseAtsScore ?? row?.baseAts?.score ?? null, gotRaw = row?.atsScore ?? row?.resume?.atsScore ?? null;
  const base = Number(baseRaw), got = Number(gotRaw);
  if (baseRaw == null || gotRaw == null || !Number.isFinite(base) || !Number.isFinite(got)) {
    // ⭐ A182 (owner 11-11: "the run still shows resume and form filled as green"): no score = no tailored résumé to show —
    // a held run defers the résumé to approval (generationDeferred), so it is WAITING, never a green "Tailored".
    if (row?.resumeAvailable || row?.resume?.atsScore != null) return { label: "Tailored your résumé", state: "done", meta: "" };
    return { label: row?.generationDeferred ? "Your résumé is tailored when you approve" : "Tailored your résumé — not reported", state: "", meta: "waiting" };
  }
  const meta = `ATS ${base} → ${got}`;
  if (got > base) return { label: "Tailored your résumé", state: "done", meta };
  if (got === base) return { label: "Your résumé already fits — tailoring changed no score", state: "done", meta };
  return { label: "Tailoring scored lower than your base résumé", state: "fail", meta };
}

export function runSteps(node, { counts = null, resumeName = "" } = {}) {
  const state = heldStateOf(node);
  if (!state || state === "held") return [];   // A165: a hold before the form says why; it claims no steps
  const fail = state === "fail";
  const after = (at) => ["needs", "ready", "sent"].indexOf(state) >= ["needs", "ready", "sent"].indexOf(at);
  // ⭐ A179 F1: the counts are what the run REPORTED (the approval's answer count, else the row's fill); "Filled the form"
  // is never green over nothing — 0 typed is a failed step, and a run that never reached the form claims no fill.
  const row = latestRow(node);
  const reported = counts && Number.isFinite(counts.filled) ? { filled: counts.filled, discovered: Number.isFinite(counts.total) ? counts.total : null } : fillOf(row);
  const filledMeta = reported ? (reported.discovered ? `${reported.filled} of ${reported.discovered}` : `${reported.filled}`) : "";
  // A sent application filled its form (the submission is the evidence) even when no count was kept.
  const fillState = fail ? "" : state === "sent" && !reported ? "done" : !reported ? "" : reported.filled === 0 ? "fail" : "done";
  const fillLabel = !fail && reported && reported.filled === 0 ? "Filled the form — nothing was filled"
    : !fail && !reported && state !== "sent" ? "Filled the form — not reported" : "Filled the form";
  const resumeStep = fail ? { label: "Tailored your résumé — it couldn't be made", state: "fail", meta: "" }
    : state === "sent" ? { label: "Tailored your résumé", state: "done", meta: resumeStepOf(row).meta === "waiting" ? "" : resumeStepOf(row).meta }   // sent = it was attached
    : resumeStepOf(row);
  return [
    { id: "posting", label: "Read the posting", state: "done", meta: "" },
    { id: "resume", label: resumeStep.label, state: resumeStep.state, meta: resumeStep.meta },
    // A182: "Attached" is green only when a résumé exists (or the application was sent) — never for a deferred one.
    { id: "attached", label: "Attached the résumé", state: fail ? "" : (resumeStep.state === "done" || state === "sent") ? "done" : "", meta: fail || resumeStep.state !== "done" ? "waiting" : s(resumeName) },
    { id: "filled", label: fillLabel, state: fillState, meta: fail ? "waiting" : filledMeta },
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
  saved_answer: "you · saved", custom_answer: "you · saved", drafted_from_resume: "written by draft from your résumé",
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

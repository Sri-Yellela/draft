// ── D102 P1 · THE PIPELINE WORKSPACE — one row per job, one detail panel ─────────────────────
//
// A job is ONE row from the moment it is Drafted until it closes (owner 10-30). The row's identity is
// its `application_records` id — one per (user, job) by the table's UNIQUE, written by the Draft
// (markPending) and kept through every retry, approval and send — so the same id opens the same
// detail from the board, the extension, Draft House, The Table and (D103) an inbox message.
//
// Read-only: everything here is derived from what the pipeline already writes —
//   application_records  the row (its state says whether a submission was recorded / verified)
//   apply_run_jobs       the latest live attempt (status, reason, answers, résumé, snapshot)
//   job_applications     the employer's axis (response_outcome) once sent
//   scraped_jobs         the posting, while it exists (D43: a row never depends on it — snapshots win)
// and the status is shared/applicationStatus.js's ladder, the one module both surfaces read.
import { ladderStatus, surfaceOf, tabCounts, LADDER_LABELS } from "../shared/applicationStatus.js";
import { sourceOf, ANSWER_SOURCES } from "../shared/answerSource.js";
import { listMessages } from "./inbox.js";
import { prepSummary, userDateFor } from "./interviewPrep.js";
import { mergeResponse, RESPONSE_OUTCOME } from "../shared/applicationResponse.js";

const parse = (s, fallback) => { if (s == null) return fallback; try { return JSON.parse(s); } catch { return fallback; } };

// The latest attempt that still speaks for the job: superseded rows were REPLACED by a newer one, and a
// row in the bin (hidden_at) is not on any surface.
const LATEST_RUN_JOB = `
  SELECT * FROM apply_run_jobs
  WHERE user_id = ? AND job_id = ? AND status != 'superseded' AND hidden_at IS NULL
  ORDER BY id DESC LIMIT 1`;

function rowFor(db, rec) {
  const rj = db.prepare(LATEST_RUN_JOB).get(rec.user_id, rec.job_id) ?? null;
  const ja = db.prepare(`SELECT * FROM job_applications WHERE user_id = ? AND job_id = ? ORDER BY id DESC LIMIT 1`)
    .get(rec.user_id, rec.job_id) ?? null;
  let posting = null;
  try {
    posting = db.prepare(`SELECT title, company, url, apply_url, location, description FROM scraped_jobs WHERE job_id = ?`)
      .get(rec.job_id) ?? null;
  } catch { posting = null; }
  // A recorded or verified record is a submission the user or the pipeline recorded (A63).
  const sent = rec.state === "verified" || rec.state === "recorded";
  const { status, closedByCandidate } = ladderStatus({
    runJobStatus: rj?.status ?? null, reasonCode: rj?.reason_code ?? null, sent, outcome: ja?.response_outcome ?? null,
  });
  // D113 UI "Add the date": the user's own interview / assessment date (D110's interview_prep — the one store).
  const when = ["interview", "assessment"].includes(status) ? userDateFor(db, rec.user_id, rec.id) : null;
  return { rec, rj, ja, posting, status, closedByCandidate, when };
}

function publicRow({ rec, rj, ja, posting, status, closedByCandidate, when = null }) {
  return {
    id: rec.id,
    jobId: rec.job_id,
    status,
    statusLabel: LADDER_LABELS[status],
    surface: surfaceOf(status),
    closedByCandidate,
    // D43 · no orphans: the snapshot the pipeline took wins over a posting that may be gone.
    company: rj?.posting_company || ja?.company || posting?.company || null,
    title: rj?.posting_title || ja?.role || posting?.title || null,
    url: rj?.posting_url || ja?.job_url || posting?.apply_url || posting?.url || null,
    reasonCode: rj?.reason_code ?? null,
    // D113 UI U5 "Note why": the application's own notes (job_applications.notes, The Table's Notes column).
    note: ja?.notes ?? null,
    // { ymd, time, timeZone, at } — the row's "Interview Tue 4 Nov, 2 PM" (an interview or an assessment only).
    interview: when,
    updatedAt: Math.max(rec.updated_at || 0, rj?.finished_at || 0, rj?.created_at || 0, ja?.outcome_at || 0) || null,
  };
}

/**
 * One surface's rows and tab counts. A record with no attempt and nothing sent (a posting merely
 * opened, origin 'manual') is not a pipeline row: it has never been Drafted.
 */
export function listPipeline(db, userId, surface) {
  const recs = db.prepare(`SELECT * FROM application_records WHERE user_id = ? AND state NOT IN ('withdrawn', 'not_applied') ORDER BY updated_at DESC, id DESC`)
    .all(userId);
  const rows = [];
  for (const rec of recs) {
    const r = rowFor(db, rec);
    if (!r.rj && r.rec.state === "pending") continue;
    rows.push(publicRow(r));
  }
  const mine = rows.filter(r => r.surface === surface);
  return { surface, rows: mine, counts: tabCounts(rows.map(r => r.status), surface) };
}

// ── D113 UI U5 · THE ACTIONS ON A SENT ROW — on the ladder, recorded in draft only ──────────────────────
//
// The tree's sentences and actions per state (WORKLOG D113 U5, defined by the owner 10-31 "THE DRAFT HOUSE TREE'S
// LEFTOVERS"): sent, no reply → I heard back / **Withdraw** · interview / assessment → **Add the date** · rejected →
// **Note why**. Each acts on the ladder status the row reads NOW (shared/applicationStatus.js, derived):
//   withdrawn  ⛔ draft CANNOT withdraw an application on most employers' systems and never pretends to: the tree's
//              Withdraw opens the company's own page ("Withdraw it on <company>'s site; then confirm here"). Only the
//              user's "I withdrew it" lands here → job_applications.response_outcome = 'withdrawn' through mergeResponse
//              (the AK1 rules every outcome write follows) → the ladder's terminal `withdrawn`. Any sent status but a
//              rejection; never twice.
//   note       `rejected` only (below).
//   date       `interview` / `assessment` → D110's own route (PUT /api/interview/prep/:id/date), not here.
// ⛔ NOTHING IS SENT TO THE EMPLOYER from any of them; each records the user's own word in draft.
export const ROW_ACTIONS = Object.freeze({
  withdrawn: Object.freeze(["submitted", "interview", "assessment", "offer"]),
  note: Object.freeze(["rejected"]),
  date: Object.freeze(["interview", "assessment"]),
});
export const NOTE_MAX = 2000;

const refuse = (status, code, message) => Object.assign(new Error(message), { status, code });

function ownRow(db, userId, applicationId) {
  const rec = db.prepare(`SELECT * FROM application_records WHERE id = ? AND user_id = ?`).get(Number(applicationId), userId);
  return rec ? rowFor(db, rec) : null;
}

/**
 * "I withdrew it" — the user withdrew on the company's site and says so. Null when the row is not this user's. Throws
 * {status, code} when the ladder refuses. Records only; contacts no one.
 */
export function markWithdrawn(db, userId, applicationId, { now = Math.floor(Date.now() / 1000) } = {}) {
  const r = ownRow(db, userId, applicationId);
  if (!r) return null;
  if (!ROW_ACTIONS.withdrawn.includes(r.status)) {
    throw refuse(409, "not_withdrawable", r.status === "withdrawn" ? "It is already marked withdrawn." : "Only a sent application can be marked withdrawn.");
  }
  if (!r.ja) throw refuse(409, "not_verified", "This submission is not verified yet, so there is nothing to mark.");
  const m = mergeResponse(r.ja, { outcome: RESPONSE_OUTCOME.WITHDRAWN, source: "manual" }, { now });
  db.prepare(`UPDATE job_applications SET response_outcome = ?, furthest_stage = ?, first_response_at = ?, outcome_at = ?, outcome_source = ?
    WHERE id = ? AND user_id = ?`).run(m.response_outcome, m.furthest_stage, m.first_response_at, m.outcome_at, m.outcome_source, r.ja.id, userId);
  return publicRow(ownRow(db, userId, applicationId));
}

/** "Note why" — the user's note on a rejection. Empty clears it. Null when the row is not this user's. */
export function noteWhy(db, userId, applicationId, note) {
  const r = ownRow(db, userId, applicationId);
  if (!r) return null;
  if (!ROW_ACTIONS.note.includes(r.status) || !r.ja) throw refuse(409, "not_rejected", "A note why is for an application they said no to.");
  if (note != null && typeof note !== "string") throw refuse(400, "bad_note", "A note is text.");
  const text = String(note ?? "").trim();
  if (text.length > NOTE_MAX) throw refuse(400, "too_long", `A note is at most ${NOTE_MAX} characters.`);
  db.prepare(`UPDATE job_applications SET notes = ? WHERE id = ? AND user_id = ?`).run(text || null, r.ja.id, userId);
  return publicRow(ownRow(db, userId, applicationId));
}

/** The checklist's steps in order, each `done` | `current` | `waiting` | `skipped`. */
function checklist({ rec, rj, posting, status }, confirmed = false) {
  const answers = parse(rj?.answers_json, []);
  const filled = Array.isArray(answers) ? answers.filter(a => a && a.value != null && !a.skipped).length : 0;
  const total = Number.isFinite(rj?.fields_discovered) ? rj.fields_discovered : (Array.isArray(answers) ? answers.length : 0);
  const open = parse(rj?.open_questions_json, []);
  const sent = ["submitted", "interview", "assessment", "offer", "rejected", "withdrawn"].includes(status);
  const state = (done, current) => (done ? "done" : current ? "current" : "waiting");
  return [
    { step: "posting_read", label: "Posting read", state: state(!!(posting || rj?.posting_title), false) },
    { step: "resume_tailored", label: "Résumé tailored", state: state(!!rj?.resume_artifact_id || sent, status === "in_flight") },
    { step: "form_filled", label: "Form filled", state: state(filled > 0 && (sent || status === "ready_to_approve"), status === "in_flight"),
      filled, total },
    { step: "needs_you", label: "Needs you", state: status === "needs_you" ? "current" : (Array.isArray(open) && open.length && !sent ? "current" : "done"),
      fields: Array.isArray(open) ? open.map(q => q?.question ?? q?.label ?? String(q)).slice(0, 50) : [] },
    { step: "approved", label: "Approved", state: state(!!rj?.approved_at || rj?.submitted_by === "auto" || sent, status === "ready_to_approve") },
    { step: "submitted", label: "Submitted", state: state(sent, false), by: rj?.submitted_by ?? null },
    // D103: done when the inbox matched the employer's confirmation (category Applied) to this application.
    { step: "confirmation_email", label: "Confirmation email received", state: confirmed ? "done" : sent ? "current" : "waiting" },
  ];
}

/** One job's detail panel — Checklist · Résumé · Form · Job · Emails. Null when it is not this user's. */
export function jobDetail(db, userId, applicationId) {
  const rec = db.prepare(`SELECT * FROM application_records WHERE id = ? AND user_id = ?`).get(Number(applicationId), userId);
  if (!rec) return null;
  const r = rowFor(db, rec);
  const answers = parse(r.rj?.answers_json, []);
  // D103: this application's mail (a database before migration 174 has none).
  let emails = [];
  try { emails = listMessages(db, userId, { applicationId: rec.id }); } catch { emails = []; }
  return {
    ...publicRow(r),
    runJobId: r.rj?.id ?? null,
    checklist: checklist(r, emails.some(m => m.category === "applied")),
    resume: {
      artifactId: r.rj?.resume_artifact_id ?? null,
      atsScore: r.rj?.resume_ats_score ?? null,
      baseAtsScore: r.rj?.base_ats_score ?? null,
    },
    form: {
      // Every field and value as the run recorded it, with D104 P2's `source` (shown on hover in the Form tab).
      // A worker report already carries a source; a local run's provenance is mapped by the same rule.
      fields: (Array.isArray(answers) ? answers : []).map(a => ({
        name: a?.label ?? a?.name ?? a?.field_id ?? null, type: a?.type ?? null, value: a?.value ?? null,
        skipped: !!a?.skipped, provenance: a?.provenance ?? null,
        source: ANSWER_SOURCES.includes(a?.provenance) ? a.provenance : sourceOf(a?.provenance),
      })),
      openQuestions: parse(r.rj?.open_questions_json, []),
      approvable: r.status === "ready_to_approve",
    },
    job: {
      company: publicRow(r).company, title: publicRow(r).title, url: publicRow(r).url,
      location: r.rj?.posting_location || r.ja?.location || r.posting?.location || null,
      description: r.posting?.description ?? null,
      // ⭐ D114: the posting's board id, so the Job tab can ask which Atlas terms it links (GET /api/atlas/terms/:jobId).
      postingId: r.posting ? rec.job_id : null,
    },
    emails,
    // D110 P1: an Interview or Assessment (D103's category, or the ladder) turns on the Prep tab and its countdown.
    prep: (() => { try { return prepSummary(db, userId, rec.id, { status: r.status, emails }); } catch { return { active: false }; } })(),
  };
}

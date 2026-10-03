// ── D15 · THE TABLE — one row per application, pending and sent ───────────────────────────────
//
// The user-facing history behind the top bar's "The Table" (NOT the admin DB inspector). Two
// tables describe one application and neither alone is the history:
//
//   application_records   pending -> recorded -> verified | withdrawn  (A63: "did they apply?")
//   job_applications      written ONLY when a record verifies; carries the employer's reply (AK1)
//
// This file folds them into one row with ONE status, and is pure — no clock of its own, no
// database — so the server (routes/applicationRecords.js) and the panel share the same rule and a
// test can drive it directly.
//
// ⛔ THE STATUS IS EXCLUSIVE AND READS THE EMPLOYER'S AXIS THROUGH shared/applicationResponse.js:
//   in_play   a record not yet sent (pending, or recorded but not verified)
//   sent      sent, nothing recorded back. ⭐ After MATURITY_DAYS the row ASKS "Did they reply?" —
//             it does NOT become "no reply" on its own: NULL is not "no response" yet. Only the user
//             saying "Still nothing" (outcome no_response) moves it to no_reply.
//   replied   the employer engaged — ⛔ a REJECTION COUNTS (responseBucket's rule: it is a reply to
//             the résumé; an ATS score is a screening score, not a hiring prediction).
//   no_reply  the user said they never heard back.
//   closed    the CANDIDATE ended it: "I did not apply" on a record, or outcome withdrawn.
import {
  RESPONSE_OUTCOME, RESPONSE_LABELS, MATURITY_DAYS, responseBucket,
} from "./applicationResponse.js";

export const HISTORY_STATUSES = Object.freeze(["in_play", "sent", "replied", "no_reply", "closed"]);

/** The chips — filters AND counts. ⛔ There is no separate summary bar: the chips are it. */
export const HISTORY_CHIPS = Object.freeze([
  { id: "in_play",  label: "In play",  title: "Not sent yet — pending, or recorded and waiting to verify." },
  { id: "sent",     label: "Sent",     title: `Sent, nothing back yet. After ${MATURITY_DAYS} days it asks whether they replied.` },
  { id: "replied",  label: "Replied",  title: "They answered — a rejection counts: something read it and replied." },
  { id: "no_reply", label: "No reply", title: "You told us you never heard back." },
  { id: "closed",   label: "Closed",   title: "You ended it — did not apply, or withdrew." },
]);

export const HISTORY_SORTS = Object.freeze([
  { id: "newest",   label: "Newest" },
  { id: "oldest",   label: "Oldest" },
  { id: "az",       label: "A–Z" },
  { id: "awaiting", label: "Awaiting longest" },
]);

/** The three answers offered on a matured, unanswered row — stored values from the shared vocabulary. */
export const REPLY_ASK = Object.freeze([
  { outcome: RESPONSE_OUTCOME.INTERVIEW,   label: "Interview" },
  { outcome: RESPONSE_OUTCOME.REJECTED,    label: "Rejected" },
  { outcome: RESPONSE_OUTCOME.NO_RESPONSE, label: "Still nothing" },
]);

const DAY = 86400;
const daysBetween = (a, b) => (a == null || b == null ? null : Math.max(0, Math.floor((b - a) / DAY)));
const minDefined = (...v) => { const d = v.filter(x => x != null); return d.length ? Math.min(...d) : null; };

/**
 * One row's status, its label and whether it asks "Did they reply?". `row` carries both halves:
 * recordState (or null), and the application's applied_at / response_outcome / first_response_at.
 */
export function historyStatus(row, { now = Math.floor(Date.now() / 1000) } = {}) {
  const sent = row.applicationId != null;
  if (!sent) {
    if (row.recordState === "withdrawn") return { status: "closed", label: "Did not apply", ask: false };
    if (row.recordState === "recorded")  return { status: "in_play", label: "Recorded — not verified yet", ask: false };
    return { status: "in_play", label: "Pending", ask: false };
  }
  const app = { applied_at: row.sentAt, response_outcome: row.responseOutcome, first_response_at: row.firstResponseAt };
  const outcome = row.responseOutcome ?? null;
  if (outcome === RESPONSE_OUTCOME.WITHDRAWN) return { status: "closed", label: RESPONSE_LABELS.withdrawn.label, ask: false };
  const bucket = responseBucket(app, { now });
  if (bucket === "responded") {
    const key = outcome && outcome !== RESPONSE_OUTCOME.NO_RESPONSE ? outcome : row.furthestStage;
    return { status: "replied", label: RESPONSE_LABELS[key]?.label ?? "Replied", ask: false };
  }
  if (outcome === RESPONSE_OUTCOME.NO_RESPONSE) return { status: "no_reply", label: RESPONSE_LABELS.no_response.label, ask: false };
  // Nothing recorded. Matured silence is a QUESTION to the user, never a stored or displayed "no".
  if (bucket === "silent") return { status: "sent", label: "Did they reply?", ask: true };
  return { status: "sent", label: "Sent · waiting", ask: false };
}

/**
 * The timeline: drafted → résumé → approved → sent → waiting. Each reached step carries its time and
 * the days since the step before it; a step not reached is { at: null } (shown dim, never invented).
 * "approved" exists only for a Draft (the automation asks for approval); a manual application never
 * passes through it, so it is marked skipped rather than pending forever.
 */
export function historyTimeline(row, { now = Math.floor(Date.now() / 1000) } = {}) {
  const steps = [
    { key: "drafted",  label: "Drafted",  at: row.draftedAt ?? null },
    { key: "resume",   label: "Résumé",   at: row.resumeAt ?? null },
    { key: "approved", label: "Approved", at: row.approvedAt ?? null, skipped: row.approvedAt == null && row.sentAt != null && row.method !== "draft" },
    { key: "sent",     label: "Sent",     at: row.sentAt ?? null },
  ];
  let prev = null;
  for (const s of steps) {
    s.days = s.at != null && prev != null ? daysBetween(prev, s.at) : null;
    if (s.at != null) prev = s.at;
  }
  const replied = row.firstResponseAt ?? null;
  const waiting = row.sentAt == null
    ? { key: "waiting", label: "Waiting", at: null, days: null }
    : replied != null
      ? { key: "waiting", label: "Replied", at: replied, days: daysBetween(row.sentAt, replied) }
      : { key: "waiting", label: "Waiting", at: null, days: daysBetween(row.sentAt, now), ongoing: true };
  return [...steps, waiting];
}

/**
 * Fold the database rows into history rows. Inputs are plain row arrays (snake_case, as SQLite
 * returns them); the output is the panel's shape, camelCase, times in SECONDS.
 */
export function buildHistory({ records = [], applications = [], resumes = [], approvals = [], jobs = [] }, { now = Math.floor(Date.now() / 1000) } = {}) {
  const byJob = new Map();
  const jobInfo = new Map(jobs.map(j => [String(j.job_id), j]));
  const resumeAt = new Map(resumes.map(r => [String(r.job_id), r.created_at ?? null]));
  const approvedAt = new Map(approvals.map(a => [String(a.job_id), a.approved_at ?? null]));
  const get = (jobId) => {
    const k = String(jobId);
    if (!byJob.has(k)) byJob.set(k, { jobId: k });
    return byJob.get(k);
  };
  for (const r of records) {
    const h = get(r.job_id);
    Object.assign(h, {
      recordId: r.id, recordState: r.state, origin: r.origin, method: r.method ?? null,
      recordCreatedAt: r.created_at ?? null, recordSubmittedAt: r.submitted_at ?? null,
      updatedAt: r.updated_at ?? null, withdrawnAt: r.withdrawn_at ?? null,
    });
  }
  for (const a of applications) {
    const h = get(a.job_id);
    Object.assign(h, {
      applicationId: a.id, sentAt: a.applied_at ?? null,
      company: a.company ?? h.company, title: a.role ?? h.title, applyUrl: a.job_url ?? h.applyUrl,
      responseOutcome: a.response_outcome ?? null, furthestStage: a.furthest_stage ?? null,
      firstResponseAt: a.first_response_at ?? null, outcomeAt: a.outcome_at ?? null,
      method: h.method ?? (a.apply_mode === "AUTO" ? "draft" : null),
    });
  }
  const out = [];
  for (const h of byJob.values()) {
    const j = jobInfo.get(h.jobId) || {};
    h.company = h.company ?? j.company ?? null;
    h.title = h.title ?? j.title ?? null;
    h.applyUrl = h.applyUrl ?? j.apply_url ?? j.url ?? null;
    h.resumeAt = resumeAt.get(h.jobId) ?? null;
    h.hasResume = h.resumeAt != null;
    h.approvedAt = approvedAt.get(h.jobId) ?? null;
    h.draftedAt = minDefined(h.recordCreatedAt, h.resumeAt, h.sentAt);
    if (h.applicationId == null) h.sentAt = null;
    Object.assign(h, historyStatus(h, { now }));
    h.timeline = historyTimeline(h, { now });
    h.daysWaiting = h.status === "sent" && h.sentAt != null ? daysBetween(h.sentAt, now) : null;
    // The date the row is filed under: when it was sent, else when it entered the history.
    h.date = h.sentAt ?? h.draftedAt ?? h.updatedAt ?? null;
    out.push(h);
  }
  return out;
}

/** Counts per chip over the rows given (after search and date, before the chip filter). */
export function chipCounts(rows) {
  const c = Object.fromEntries(HISTORY_STATUSES.map(s => [s, 0]));
  for (const r of rows) if (c[r.status] != null) c[r.status]++;
  return c;
}

/** The nudge: the sent row that has waited longest with nothing recorded, matured or not. */
export function oldestUnanswered(rows) {
  let best = null;
  for (const r of rows) {
    if (r.status !== "sent" || r.daysWaiting == null) continue;
    if (!best || r.daysWaiting > best.daysWaiting) best = r;
  }
  return best;
}

/**
 * Date range, chip and sort. `from`/`to` are SECONDS (inclusive bounds the caller computed in the
 * user's own time zone — a day picked on a calendar is a local day). Search runs on the server,
 * because it covers the posting text, which is not sent to the client.
 */
export function applyHistoryView(rows, { chip = null, from = null, to = null, sort = "newest" } = {}) {
  let r = rows.filter(x => (from == null || (x.date ?? 0) >= from) && (to == null || (x.date ?? 0) <= to));
  const counts = chipCounts(r);
  if (chip) r = r.filter(x => x.status === chip);
  const az = (a, b) => String(a.company ?? "").localeCompare(String(b.company ?? ""), undefined, { sensitivity: "base" })
    || String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, { sensitivity: "base" });
  const cmp = {
    newest:   (a, b) => (b.date ?? 0) - (a.date ?? 0),
    oldest:   (a, b) => (a.date ?? 0) - (b.date ?? 0),
    az,
    // Rows still waiting on the employer first, longest wait at the top; everything else after, newest first.
    awaiting: (a, b) => ((b.daysWaiting ?? -1) - (a.daysWaiting ?? -1)) || ((b.date ?? 0) - (a.date ?? 0)),
  }[sort] || ((a, b) => (b.date ?? 0) - (a.date ?? 0));
  return { rows: [...r].sort(cmp), counts };
}

/** Search across company, title and the posting text: every word must appear in one of them. */
export function matchesSearch(row, postingText, q) {
  const words = String(q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${row.company ?? ""}\n${row.title ?? ""}\n${postingText ?? ""}`.toLowerCase();
  return words.every(w => hay.includes(w));
}

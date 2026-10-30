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
//
// ⭐ D55 decision F · THE FUNNEL. `status` above stays exactly as it was (D54's By company and every
// caller read it), and a second, finer field rides beside it — `stage` — which splits `replied` into
// the funnel's own steps: screen · interviewing · offer · rejected. Every stage belongs to exactly one
// status, so the chips (which now count stages), the Kanban columns and the funnel all partition the
// same rows: their counts are the List's rows grouped, and a test holds them to it.
//   `reached` is how far DOWN the funnel a sent application got — applied · screen · interviewing ·
//   offer — from the outcome AND furthest_stage, so screen → interview → rejected counts as having
//   reached interviewing, not as a rejection off the résumé. An unsent row has reached nothing (null).
import {
  RESPONSE_OUTCOME, RESPONSE_LABELS, MATURITY_DAYS, STAGE_RANK, responseBucket,
} from "./applicationResponse.js";

export const HISTORY_STATUSES = Object.freeze(["in_play", "sent", "replied", "no_reply", "closed"]);

/**
 * D55 F: the exclusive STAGE each row sits in — the Kanban's columns, in funnel order. `replied` is the
 * rare reply with no stage recorded (first_response_at set, outcome cleared): kept rather than guessed
 * into a stage, and hidden wherever it is empty.
 */
export const HISTORY_STAGES = Object.freeze([
  "in_play", "sent", "screen", "interviewing", "offer", "rejected", "replied", "no_reply", "closed",
]);
/** Which status each stage belongs to — the partition that keeps D15/D54's counts and these equal. */
export const STAGE_STATUS = Object.freeze({
  in_play: "in_play", sent: "sent", screen: "replied", interviewing: "replied", offer: "replied",
  rejected: "replied", replied: "replied", no_reply: "no_reply", closed: "closed",
});
/** A stored outcome -> its funnel stage. The stored value `interview` is the funnel's "interviewing". */
const STAGE_OF_OUTCOME = Object.freeze({
  [RESPONSE_OUTCOME.SCREEN]: "screen",
  [RESPONSE_OUTCOME.INTERVIEW]: "interviewing",
  [RESPONSE_OUTCOME.OFFER]: "offer",
  [RESPONSE_OUTCOME.REJECTED]: "rejected",
});

/**
 * The chips — filters AND counts, one per stage. ⛔ There is no separate summary bar: the chips are it.
 * `optional` chips are hidden while their count is 0.
 */
export const HISTORY_CHIPS = Object.freeze([
  { id: "in_play",      label: "In play",      title: "Not sent yet — pending, or recorded and waiting to verify." },
  { id: "sent",         label: "Sent",         title: `Sent, nothing back yet. After ${MATURITY_DAYS} days it asks whether they replied.` },
  { id: "screen",       label: "Screen",       title: "A recruiter or phone screen — the first real engagement." },
  { id: "interviewing", label: "Interviewing", title: "Interviewing with them." },
  { id: "offer",        label: "Offer",        title: "An offer came back." },
  { id: "rejected",     label: "Rejected",     title: "They replied, and it was no — still a reply: something read it." },
  { id: "replied",      label: "Replied",      title: "They answered, and no stage was recorded.", optional: true },
  { id: "no_reply",     label: "No reply",     title: "You told us you never heard back." },
  { id: "closed",       label: "Closed",       title: "You ended it — did not apply, or withdrew." },
]);

/** The funnel's steps: how far down a SENT application got. Ranks are STAGE_RANK's (applied = 0). */
export const FUNNEL_STEPS = Object.freeze([
  { id: "applied",      label: "Applied",      rank: 0 },
  { id: "screen",       label: "Screen",       rank: 1 },
  { id: "interviewing", label: "Interviewing", rank: 2 },
  { id: "offer",        label: "Offer",        rank: 3 },
]);
/** Where an application that stopped at a step ended — the funnel's drop-offs. `active` is still going. */
export const FUNNEL_ENDINGS = Object.freeze(["active", "rejected", "no_reply", "closed"]);

export const HISTORY_SORTS = Object.freeze([
  { id: "newest",   label: "Newest" },
  { id: "oldest",   label: "Oldest" },
  { id: "az",       label: "A–Z" },
  { id: "awaiting", label: "Awaiting longest" },
]);

/**
 * The answers offered on a matured, unanswered row — stored values from the shared vocabulary. D55 F
 * added the screen: the first step of the funnel, and the one an ATS score could most plausibly predict.
 */
export const REPLY_ASK = Object.freeze([
  { outcome: RESPONSE_OUTCOME.SCREEN,      label: "Screen" },
  { outcome: RESPONSE_OUTCOME.INTERVIEW,   label: "Interviewing" },
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
  const s = statusOf(row, { now });
  return { ...s, stage: stageOf(row, s.status), reached: reachedOf(row) };
}

/** D55 F: the stage inside the status. Only `replied` splits; every other status is its own stage. */
function stageOf(row, status) {
  if (status !== "replied") return status;
  const outcome = row.responseOutcome ?? null;
  return STAGE_OF_OUTCOME[outcome] ?? STAGE_OF_OUTCOME[row.furthestStage] ?? "replied";
}

/** D55 F: how far down the funnel a SENT application got; null for one never sent. */
function reachedOf(row) {
  if (row.applicationId == null) return null;
  const rank = Math.max(STAGE_RANK[row.responseOutcome] ?? 0, STAGE_RANK[row.furthestStage] ?? 0);
  return FUNNEL_STEPS.find(s => s.rank === rank)?.id ?? "applied";
}

function statusOf(row, { now }) {
  const sent = row.applicationId != null;
  if (!sent) {
    if (row.recordState === "withdrawn") return { status: "closed", label: "Did not apply", ask: false };
    // D112 c2: moved after 14 quiet days — closed like a withdrawal, but labelled as draft's inference.
    if (row.recordState === "not_applied") return { status: "closed", label: "Not applied · moved after 14 days", ask: false };
    if (row.recordState === "recorded")  return { status: "in_play", label: "Recorded — not verified yet", ask: false };
    // D51: a Draft is in play from the click — it waits in Draft House until you approve or stop it.
    if (row.origin === "drafted")        return { status: "in_play", label: "Drafted — in Draft House", ask: false };
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
export function buildHistory({ records = [], applications = [], resumes = [], approvals = [], jobs = [], artifacts = [], snapshots = [] }, { now = Math.floor(Date.now() / 1000) } = {}) {
  const byJob = new Map();
  const jobInfo = new Map(jobs.map(j => [String(j.job_id), j]));
  // D54/D43: the posting as the Draft snapshot it (apply_run_jobs.posting_*) — the company and title of a
  // drafted job whose posting is gone. A fallback only; it never marks the posting as listed.
  const snapInfo = new Map(snapshots.map(j => [String(j.job_id), j]));
  const resumeAt = new Map(resumes.map(r => [String(r.job_id), r.created_at ?? null]));
  // D16's kept copy, by the record it belongs to (application_artifacts.record_id).
  const artifactBy = new Map(artifacts.map(a => [Number(a.record_id), a]));
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
      // D55 (i): a past application imported from a CSV — sent elsewhere, no résumé or score of ours.
      imported: a.auto_status === "imported",
      // Migration 135: the company's website as the import stated it — the D54 key's strongest evidence.
      companyDomain: a.company_domain ?? null,
    });
  }
  const out = [];
  for (const h of byJob.values()) {
    const j = jobInfo.get(h.jobId) || snapInfo.get(h.jobId) || {};
    h.company = h.company ?? j.company ?? null;
    h.title = h.title ?? j.title ?? null;
    h.applyUrl = h.applyUrl ?? j.apply_url ?? j.url ?? null;
    // ⛔ D43: the record stands without its posting — it renders from its own snapshot, and says so.
    h.postingListed = jobInfo.has(h.jobId);
    h.resumeAt = resumeAt.get(h.jobId) ?? null;
    // ⛔ O56(a): WHICH résumé the download serves, read the way the download route reads it
    // (services/applicationArtifacts.js readResumeArtifact): D16's kept copy first — taken when the
    // application was recorded, or backfilled later — and only without one the working résumé, which a
    // regeneration may have changed since. A kept copy outlives its working résumé, so the link must
    // follow the copy, not the `resumes` row. Keyed on the record: the download is
    // /api/applications/:recordId/resume, so a row with no record has nothing to download.
    const kept = h.recordId != null ? artifactBy.get(Number(h.recordId)) : undefined;
    h.resumeSource = h.recordId == null ? null
      : kept ? (kept.source ?? "snapshot_at_record")
      : h.resumeAt != null ? "current_resume" : null;
    h.resumeKeptAt = kept?.created_at ?? null;
    h.hasResume = h.resumeSource != null;
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

/** A row's stage — read from the row, or derived for a row built before D55 F carried one. */
const stageOfRow = (r) => r.stage ?? stageOf(r, r.status);

/** Counts per chip (= per stage) over the rows given (after search and date, before the chip filter). */
export function chipCounts(rows) {
  const c = Object.fromEntries(HISTORY_STAGES.map(s => [s, 0]));
  for (const r of rows) { const s = stageOfRow(r); if (c[s] != null) c[s]++; }
  return c;
}

/**
 * ⭐ D55 F · THE KANBAN: the rows given, one column per stage, in funnel order. ⛔ A pure grouping of
 * the SAME rows the List shows — every row lands in exactly one column, so a column's count IS its
 * chip's count. The optional `replied` column appears only when it holds a row.
 */
export function kanbanColumns(rows) {
  const by = new Map(HISTORY_STAGES.map(s => [s, []]));
  for (const r of rows) by.get(stageOfRow(r))?.push(r);
  return HISTORY_CHIPS
    .filter(c => !c.optional || by.get(c.id).length)
    .map(c => ({ id: c.id, label: c.label, status: STAGE_STATUS[c.id], rows: by.get(c.id) }));
}

/**
 * ⭐ D55 F · THE FUNNEL: how far the SENT applications got, and where each one stopped.
 *
 * steps[i].reached   sent applications that got at least this far (applied ⊇ screen ⊇ …)
 * steps[i].here      the ones whose furthest step IS this one, by how they ended (FUNNEL_ENDINGS):
 *                    still active, rejected, no reply, or closed by the candidate.
 * inPlay / notSent   rows that were never sent: still in play, or "did not apply". In no step.
 *
 * ⛔ THE INVARIANT (tested): Σ steps.here = sent = steps[0].reached, and sent + inPlay + notSent is the
 * number of rows given — the funnel is the List's rows grouped, never a second count.
 */
export function historyFunnel(rows) {
  const steps = FUNNEL_STEPS.map(s => ({ ...s, reached: 0, here: Object.fromEntries(FUNNEL_ENDINGS.map(e => [e, 0])) }));
  let sent = 0, inPlay = 0, notSent = 0;
  for (const r of rows) {
    const reached = r.reached !== undefined ? r.reached : reachedOf(r);
    if (reached == null) { if (stageOfRow(r) === "in_play") inPlay++; else notSent++; continue; }
    sent++;
    const idx = Math.max(0, FUNNEL_STEPS.findIndex(s => s.id === reached));
    for (let i = 0; i <= idx; i++) steps[i].reached++;
    const st = stageOfRow(r);
    steps[idx].here[FUNNEL_ENDINGS.includes(st) ? st : "active"]++;
  }
  return { steps, sent, inPlay, notSent, total: rows.length };
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
  if (chip) r = r.filter(x => stageOfRow(x) === chip);
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

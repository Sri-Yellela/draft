// services/admin/runTrace.js — ⭐ FIRST PRIORITY (A)-2 (45o, owner 11-08) · THE RUN TRACE, "FA1 without database access".
//
// The spec: "pick a run → one table: each pick, the résumé (model, cost, attached when), every field's answer and its source
// (profile / saved answer / routine / held for you), what stopped and why, what was sent (submitted_by), the summary email,
// the request id across draft → tools service → worker. The owner's runs and the canary are read here from now on."
// READ-ONLY. Everything comes from what the run already writes: apply_runs / apply_run_jobs (status, reasons, the audit
// columns, answers_json with each answer's provenance, blanks / open questions), apply_job_logs (the run's events),
// resumes (the artifact + its model_source), usage_events (the model calls for that job in the run's window: model, cost),
// picks_runs (the scheduler's run: picks, left out, the message / summary stamps) and the request id every run job
// carries (services/requestContext.js runJobRequestId — the string to search both services' logs by).
import { runJobRequestId } from "../requestContext.js";

const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const json = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// Each answer's provenance (services/applyAutomation.js PROVENANCE) in the spec's four words.
const SOURCE_WORD = {
  handler_exact: "profile", field_map_exact: "profile", label_exact: "profile", label_fuzzy: "profile (fuzzy match)",
  sponsorship_derived: "profile", custom_answer: "saved answer",
  default: "routine", user_consent_setting: "routine (your consent setting)", sponsorship_assumed_future: "routine",
};
export const sourceWord = (provenance) => SOURCE_WORD[provenance] || (provenance ? String(provenance) : "unknown");

/** The latest runs (newest first), optionally one person's — the list the admin picks from. */
export function listRuns(db, { userId = null, limit = 50 } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const rows = userId != null
    ? db.prepare(`SELECT r.*, u.username FROM apply_runs r JOIN users u ON u.id = r.user_id WHERE r.user_id = ? ORDER BY r.id DESC LIMIT ?`).all(Number(userId), lim)
    : db.prepare(`SELECT r.*, u.username FROM apply_runs r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT ?`).all(lim);
  return rows.map(r => ({
    id: r.id, user: { id: r.user_id, username: r.username }, mode: r.mode, tool: r.tool_type || "generate", status: r.status,
    total: r.total_jobs, submitted: r.submitted_count, held: r.held_count, failed: r.failed_count,
    createdAt: r.created_at, startedAt: r.started_at, finishedAt: r.finished_at,
    testAccount: !!safe(() => db.prepare(`SELECT test_account FROM users WHERE id = ?`).pluck().get(r.user_id), 0),
  }));
}

/** One run, as one table. null when there is no such run. */
export function runTrace(db, runId) {
  const run = db.prepare(`SELECT r.*, u.username FROM apply_runs r JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(Number(runId));
  if (!run) return null;
  const picks = safe(() => db.prepare(`SELECT * FROM picks_runs WHERE apply_run_id = ?`).get(run.id), null);
  const jobs = db.prepare(`SELECT * FROM apply_run_jobs WHERE run_id = ? ORDER BY id`).all(run.id);
  const winFrom = run.created_at - 60, winTo = (run.finished_at || Math.floor(Date.now() / 1000)) + 3600;
  const rows = jobs.map(rj => {
    const resume = rj.resume_artifact_id != null
      ? safe(() => db.prepare(`SELECT id, created_at, updated_at, model_source FROM resumes WHERE id = ?`).get(rj.resume_artifact_id), null) : null;
    const calls = safe(() => db.prepare(`SELECT model, cost_usd, input_tokens, output_tokens, cached, success, error_text, created_at, task, event_subtype
        FROM usage_events WHERE user_id = ? AND job_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at`).all(run.user_id, rj.job_id, winFrom, winTo), []);
    const answers = json(rj.answers_json, []).map(a => ({
      field: a.label || a.name || a.field || a.key || "(a field)", value: a.value ?? a.answer ?? null,
      source: sourceWord(a.provenance || a.source), provenance: a.provenance || a.source || null, confidence: a.confidence ?? null,
    }));
    const held = [...json(rj.blanks_json, []), ...json(rj.open_questions_json, [])]
      .map(b => ({ field: typeof b === "string" ? b : (b.label || b.name || b.field || "(a field)"), value: null, source: "held for you", provenance: null, confidence: null }));
    const events = safe(() => db.prepare(`SELECT created_at, level, event, message FROM apply_job_logs WHERE run_job_id = ? ORDER BY id`).all(rj.id), []);
    const attachedEv = events.find(e => e.event === "generation_ready" || e.event === "resume_attached");
    return {
      runJobId: rj.id, jobId: rj.job_id, title: rj.posting_title || null, company: rj.posting_company || null, url: rj.posting_url || null,
      status: rj.status, reasonCode: rj.reason_code || null, reasonDetail: rj.reason_detail || null,
      resume: {
        artifactId: rj.resume_artifact_id ?? null, atsScore: rj.resume_ats_score ?? null, baseAtsScore: rj.base_ats_score ?? null,
        model: json(resume?.model_source, null)?.model || (calls.find(c => c.model)?.model ?? null),
        attachedAt: attachedEv?.created_at ?? resume?.updated_at ?? resume?.created_at ?? null,
        costUsd: Math.round(calls.reduce((s, c) => s + (Number(c.cost_usd) || 0), 0) * 10000) / 10000,
        calls: calls.length, failedCalls: calls.filter(c => !c.success).length,
        missingReason: safe(() => rj.resume_missing_reason, null) || null,
      },
      answers: [...answers, ...held],
      sent: { submittedBy: rj.submitted_by || null, verified: rj.submit_verified == null ? null : !!rj.submit_verified, evidence: rj.submit_evidence || null },
      requestId: runJobRequestId(run.id, rj.id),
      events: events.map(e => ({ at: e.created_at, level: e.level, event: e.event, message: e.message })),
    };
  });
  return {
    run: { id: run.id, user: { id: run.user_id, username: run.username }, mode: run.mode, tool: run.tool_type || "generate", status: run.status,
      total: run.total_jobs, submitted: run.submitted_count, held: run.held_count, failed: run.failed_count,
      createdAt: run.created_at, startedAt: run.started_at, finishedAt: run.finished_at },
    scheduler: picks ? {
      picksRunId: picks.id, slotAt: picks.slot_at, mode: picks.mode, seen: picks.seen, picked: picks.picked,
      leftOut: json(picks.left_out_json, {}), messageAt: picks.delivery_claimed_at ?? null, message: json(picks.delivery_json, null),
      summarySentAt: picks.summary_sent_at ?? null,
    } : null,
    jobs: rows,
    totals: { costUsd: Math.round(rows.reduce((s, j) => s + j.resume.costUsd, 0) * 10000) / 10000,
      withResume: rows.filter(j => j.resume.artifactId != null).length, sent: rows.filter(j => j.sent.submittedBy).length },
    logHint: `Search both services' logs for "run${run.id}-job<runJobId>" (the x-request-id each job carries).`,
  };
}

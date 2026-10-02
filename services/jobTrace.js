// ── The job lifecycle trace (A50 step 5) — one posting, end to end, every decision and its reason ─
//
// docs/ADMIN_PANEL_REVAMP.md §2B: Job Trace and the DB inspector are the best things in the panel;
// extend rather than replace — "trace a job from crawl -> dedup -> enrichment -> scoring -> draft ->
// apply, with every decision and its reason on one page". This reads; it never writes. Each stage
// is read in its own try, so a database missing a later migration still traces what it has.
//
// ⛔ Nothing personal is returned beyond what the inspector already shows an admin: user ids and
// statuses, never a résumé, an answer or a piece of evidence text.
import { atsJobInputHash, ATS_JOB_INPUT_FIELDS } from "./jobs/boardFitPrecompute.js";

const read = (fn, fallback = []) => { try { return fn(); } catch { return fallback; } };

export function traceJobLifecycle(db, jobId) {
  const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(jobId);
  if (!job) return null;
  const ev = [];
  const add = (stage, at, what, detail = null) => ev.push({ stage, at: at ?? null, what, detail });

  // crawl
  add("crawl", job.discovered_at, `First seen from ${job.source || "?"}`,
    `sources seen: ${job.sources_seen || job.source || "—"} · req ${job.req_uid || "none"} · fingerprint ${String(job.fingerprint || "—").slice(0, 12)}`);
  if (job.scraped_at && job.scraped_at !== job.discovered_at) add("crawl", job.scraped_at, "Last written by a crawl");

  // market gate (queue 37) and other rejections
  for (const r of read(() => db.prepare("SELECT reason, rejected_at FROM rejected_jobs WHERE job_id = ?").all(jobId))) {
    add("gate", r.rejected_at, r.reason?.startsWith("out_of_market:") ? "Held off the board: outside the US" : `Rejected: ${r.reason}`, r.reason);
  }

  // dedup (A49)
  if (job.duplicate_of) add("dedup", job.retired_at, `Retired as a duplicate of ${job.duplicate_of}`, job.retired_reason);
  else if (job.retired_reason) add("dedup", job.retired_at, `Retired: ${job.retired_reason}`);
  for (const d of read(() => db.prepare("SELECT * FROM job_dedup_log WHERE from_job_id = ? OR to_job_id = ? ORDER BY id").all(jobId, jobId))) {
    add("dedup", d.created_at, d.to_job_id === jobId ? `${d.from_job_id} folded into this posting` : `Folded into ${d.to_job_id}`,
      `${d.reason}${d.restored_at ? " · RESTORED" : ""}`);
  }

  // enrichment
  for (const b of read(() => db.prepare(`
    SELECT r.batch_id, r.written_at, r.filled_json, b.source FROM enrichment_batch_rows r
    LEFT JOIN enrichment_batches b ON b.id = r.batch_id WHERE r.job_id = ? ORDER BY r.written_at`).all(jobId))) {
    let filled = [];
    try { filled = Object.keys(JSON.parse(b.filled_json || "{}")); } catch {}
    add("enrichment", b.written_at, `Enriched in batch ${b.batch_id} (${b.source || "?"})`,
      filled.length ? `filled: ${filled.join(", ")}` : "no column gained a value");
  }
  if (!job.enriched_at) add("enrichment", null, "Not enriched yet", job.description ? null : "no description to enrich from");

  // scoring — is each stored score still about THIS version of the posting? (A52)
  const currentHash = atsJobInputHash(Object.fromEntries(ATS_JOB_INPUT_FIELDS.map(k => [k, job[k]])));
  for (const s of read(() => db.prepare(`
    SELECT user_id, domain_profile_id, ats_score, scored_at, created_at, job_hash FROM ats_only_reports WHERE job_id = ?`).all(jobId))) {
    const fresh = s.job_hash && s.job_hash === currentHash;
    add("scoring", s.scored_at || s.created_at, `Scored for user ${s.user_id} / profile ${s.domain_profile_id ?? "—"}`,
      fresh ? "current for this version of the posting" : "STALE — the posting changed since (the board shows Check match)");
  }

  // captures and imports (A62)
  for (const c of read(() => db.prepare("SELECT * FROM job_captures WHERE job_id = ? ORDER BY id").all(jobId))) {
    add("capture", c.created_at, `${c.origin} by ${c.user_id ? `user ${c.user_id}` : "admin import"}: ${c.action}${c.out_of_market ? " (held: outside the US)" : ""}`,
      c.ats_type ? `${c.ats_type}/${c.ats_slug}${c.batch_id ? ` · batch ${c.batch_id}` : ""}` : null);
  }

  // drafts and runs
  for (const r of read(() => db.prepare(`
    SELECT rj.id, rj.user_id, rj.status, rj.reason_code, rj.created_at, rj.finished_at, rj.submit_verified, r.mode, r.approval_mode, r.status AS run_status
    FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id WHERE rj.job_id = ? ORDER BY rj.id`).all(jobId))) {
    add("draft", r.created_at, `Drafted by user ${r.user_id} (${r.mode}, ${r.approval_mode || "—"})${r.run_status === "waiting" ? " — waiting in line" : ""}`,
      `run-job ${r.id}: ${r.status}${r.reason_code ? ` · ${r.reason_code}` : ""}${r.submit_verified ? " · submit verified" : ""}`);
  }

  // pending -> verified -> submitted (A63)
  for (const a of read(() => db.prepare("SELECT user_id, state, origin, method, created_at, recorded_at, verified_at FROM application_records WHERE job_id = ?").all(jobId))) {
    add("record", a.created_at, `User ${a.user_id}: pending (${a.origin})`);
    if (a.recorded_at) add("record", a.recorded_at, `User ${a.user_id}: submission recorded (${a.method || "?"})`, a.state === "verified" ? "verified" : a.state);
  }
  for (const a of read(() => db.prepare("SELECT user_id, applied_at, ats_score_at_apply, response_outcome FROM job_applications WHERE job_id = ?").all(jobId))) {
    add("submitted", a.applied_at, `User ${a.user_id}: in Submitted`,
      `score at apply ${a.ats_score_at_apply ?? "—"}${a.response_outcome ? ` · employer: ${a.response_outcome}` : ""}`);
  }

  ev.sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));
  return { jobId, active: !!job.is_active, events: ev };
}

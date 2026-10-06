// ── PENDING -> VERIFIED -> SUBMITTED (A63, owner O45c, 10-02) ─────────────────────────────────
//
// ⛔ NOTHING BECOMES "SUBMITTED" ON A CLICK ALONE. Before this, three clicks wrote job_applications
// directly: the board's Apply (POST /api/apply ignored its `mode` and recorded the job as applied
// the moment it was pressed — no browser opened), and exporting a résumé PDF from the board or the
// Saved sheet (POST /api/applications). None of them was a submission. And the one path that DID
// submit — the automation — never wrote job_applications at all, which is why A47's recording path
// "has never fired".
//
// Now every route goes through this one record per (user, job):
//
//   pending    the user generated a résumé for it, opened the posting from the board, or exported
//              a résumé — they may be applying. A tag on the board and a row in the Pending table.
//   recorded   they told us when and how they submitted, but the evidence does not verify yet.
//   verified   it verified (below). ONLY NOW is job_applications written — with the ATS score that
//              was true at apply (AK1) — and the job moves to the Submitted list (Applications).
//   withdrawn  "I did not apply". Re-opening the posting later makes it pending again.
//
// ⭐ WHAT "VERIFIED" MEANS, stated so the UI can say it:
//   1. a statement — when they submitted and how (the method), and
//   2. a plausible date — not in the future, not before we first saw the posting, and
//   3. at least ONE piece of evidence consistent with THIS employer:
//        · a confirmation URL on the posting's own host (or its ATS's domain),
//        · confirmation text (an email subject or excerpt) that names the company,
//        · an application / reference number (letters and digits, at least one digit), or
//        · Draft's own automation having verified the submit on the employer's page.
// It PROVES that the user stated it and that what they gave matches this employer. It does NOT
// prove the employer received it — only their reply does (Applications → Outcome, AK1). A reference
// number in particular is taken on trust: we cannot look it up.
//
// D16: recording a submission (recorded OR verified, by the user or the pipeline) also copies the
// résumé onto the record, once — what was sent, kept for The Table's download. See
// services/applicationArtifacts.js. It runs AFTER the record's transaction and never throws into it.
import { snapshotResumeForRecord } from "./applicationArtifacts.js";

import { buildHistory, matchesSearch } from "../shared/applicationHistory.js";
import { groupCompanies, companyNameKey } from "../shared/companyIdentity.js";

/** "Northwind, Inc." and "NORTHWIND" match; "the confirmation for Northwind Traders" contains it. */
export function normaliseCompanyForMatch(s) {
  return String(s ?? "").toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

export const RECORD_STATES = Object.freeze(["pending", "recorded", "verified", "withdrawn"]);
// ⛔ D51: 'drafted' is the Draft CLICK itself (POST /api/apply/runs) — written in the same transaction as
// the run-job, so /d, Draft House and The Table read one fact. 'draft' stays the gated handoff's (the
// candidate is on the employer's form). Only a 'drafted' record is released when its Draft is undone.
export const PENDING_ORIGINS = Object.freeze(["generated", "opened_posting", "exported_resume", "manual", "draft", "drafted"]);
/** Origins a CLIENT may claim. 'generated', 'draft' and 'drafted' are written by the server only. */
export const CLIENT_ORIGINS = Object.freeze(["opened_posting", "exported_resume", "manual"]);

export const SUBMIT_METHODS = Object.freeze({
  company_site: "On the company's careers site",
  ats_portal:   "Through the employer's application portal",
  email:        "By email",
  referral:     "Through a referral",
  recruiter:    "Through a recruiter",
  other:        "Another way",
  draft:        "By Draft's automation",
});
/** Methods a user may state; 'draft' is the automation's own. */
export const USER_METHODS = Object.freeze(Object.keys(SUBMIT_METHODS).filter(m => m !== "draft"));

export const VERIFY_RULE = Object.freeze({
  proves: "You said when and how you applied, and gave evidence that matches this employer.",
  doesNotProve: "It does not prove the employer received it — only their reply does. A reference number is taken on trust.",
  evidence: [
    "a confirmation page URL on the employer's (or their application portal's) site",
    "the confirmation email's subject or a line from it, naming the company",
    "your application or reference number",
  ],
});

const nowSec = () => Math.floor(Date.now() / 1000);

function hostOf(u) {
  try {
    const url = new URL(String(u));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}
/** The last two labels — "job-boards.greenhouse.io" and "boards.greenhouse.io" share "greenhouse.io". */
const siteOf = (host) => (host ? host.split(".").slice(-2).join(".") : null);

/** Seconds from an ISO string, a ms epoch or a seconds epoch; null if unreadable. */
export function toEpochSeconds(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Pure: does this record verify against this posting? Returns every check, so the Pending table can
 * say exactly what is missing rather than "not verified".
 */
export function verifyEvidence({ job = {}, record = {}, now = nowSec() }) {
  const checks = [];
  const stated = record.submitted_at != null && !!SUBMIT_METHODS[record.method];
  checks.push({ key: "stated", ok: stated,
    detail: stated ? "You said when and how you applied." : "Say when you submitted it and how." });

  const firstSeen = Number(job.discovered_at ?? job.scraped_at ?? 0) || null;
  const s = Number(record.submitted_at);
  const dateOk = stated && s <= now + 300 && (!firstSeen || s >= firstSeen - 86400);
  checks.push({ key: "date", ok: dateOk,
    detail: !stated ? "No date yet."
      : s > now + 300 ? "That date is in the future."
      : dateOk ? "The date is after the posting appeared."
      : "That date is before this posting was first seen." });

  const evidence = [];
  if (record.method === "draft") {
    const ok = record.automation_verified === true;
    evidence.push({ key: "automation", ok,
      detail: ok ? "Draft's automation confirmed the submit on the employer's page."
        : "Draft's automation clicked submit but could not confirm the employer accepted it." });
  }
  if (record.evidence_url) {
    const eh = hostOf(record.evidence_url);
    const postingHosts = [job.apply_url, job.url].map(hostOf).filter(Boolean);
    const ok = !!eh && postingHosts.some(h => h === eh || siteOf(h) === siteOf(eh) || eh.endsWith("." + siteOf(h)));
    evidence.push({ key: "confirmation_url", ok,
      detail: ok ? "The confirmation URL is on the employer's application site."
        : eh ? `The confirmation URL is on ${eh}, not this posting's site.` : "That is not a web address." });
  }
  if (record.evidence_text) {
    const company = normaliseCompanyForMatch(job.company || "");
    const text = normaliseCompanyForMatch(record.evidence_text);
    const ok = company.length >= 2 && text.includes(company);
    evidence.push({ key: "confirmation_text", ok,
      detail: ok ? "The confirmation names the company."
        : company ? `The confirmation does not mention ${job.company}.` : "We do not know this posting's company to check against." });
  }
  if (record.reference) {
    const ok = /^[A-Za-z0-9][A-Za-z0-9#._\/-]{3,63}$/.test(record.reference) && /\d/.test(record.reference);
    evidence.push({ key: "reference", ok,
      detail: ok ? "An application / reference number was given (taken on trust)."
        : "A reference number is 4–64 letters and digits, with at least one digit." });
  }
  if (!evidence.length) {
    evidence.push({ key: "evidence", ok: false,
      detail: "Add one piece of evidence: the confirmation URL, the confirmation email's subject, or your reference number." });
  }
  checks.push(...evidence);
  const verified = stated && dateOk && evidence.some(e => e.ok);
  return { verified, checks, ...VERIFY_RULE };
}

function readJob(db, jobId) {
  try { return db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(String(jobId)) || null; }
  catch { return null; }
}

function alreadySubmitted(db, userId, jobId) {
  try {
    return !!db.prepare("SELECT 1 FROM job_applications WHERE user_id = ? AND job_id = ?").get(userId, String(jobId));
  } catch { return false; }
}

export function readRecord(db, userId, jobId) {
  return db.prepare("SELECT * FROM application_records WHERE user_id = ? AND job_id = ?").get(userId, String(jobId)) || null;
}

/**
 * Tag a job PENDING. A no-op for a job already submitted or already pending/recorded/verified; a
 * withdrawn one becomes pending again (the user is back at the posting).
 */
export function markPending(db, userId, jobId, origin) {
  if (!jobId) throw Object.assign(new Error("jobId required"), { status: 400, code: "job_required" });
  if (!PENDING_ORIGINS.includes(origin)) throw Object.assign(new Error(`unknown origin ${origin}`), { status: 400, code: "bad_origin" });
  if (alreadySubmitted(db, userId, jobId)) return { state: "submitted", record: readRecord(db, userId, jobId) };
  db.prepare(`
    INSERT INTO application_records (user_id, job_id, state, origin)
    VALUES (?, ?, 'pending', ?)
    ON CONFLICT(user_id, job_id) DO UPDATE SET
      state = 'pending', origin = excluded.origin, withdrawn_at = NULL, updated_at = unixepoch()
    WHERE application_records.state = 'withdrawn'
       -- D51: a stronger signal replaces the Draft click's own origin (a gated handoff released, the
       -- posting opened), so undoing the Draft no longer releases a record the user acted on since.
       OR (application_records.state = 'pending' AND application_records.origin = 'drafted'
           AND excluded.origin <> 'drafted')
  `).run(userId, String(jobId), origin);
  const record = readRecord(db, userId, jobId);
  return { state: record.state, record };
}

/**
 * ⛔ D51 · release the record a Draft click wrote, once nothing of that Draft is left. Called after a
 * run-job is cancelled (Undo, Stop, removed from the line) or removed. A no-op unless the record is
 * still PENDING with origin 'drafted' AND no other attempt for the job is live — so a job drafted
 * again, opened, recorded or sent keeps its record. Returns true when it released one.
 */
export function releaseDraftRecord(db, userId, jobId) {
  if (jobId == null) return false;
  const liveSql = (hidden) => `SELECT COUNT(*) FROM apply_run_jobs WHERE user_id = ? AND job_id = ?
    AND status NOT IN ('cancelled', 'superseded')${hidden ? " AND hidden_at IS NULL" : ""}`;
  let live;
  try { live = db.prepare(liveSql(true)).pluck().get(userId, String(jobId)); }
  catch { live = db.prepare(liveSql(false)).pluck().get(userId, String(jobId)); }   // pre-hidden_at schema
  if (live) return false;
  return db.prepare(`DELETE FROM application_records WHERE user_id = ? AND job_id = ?
    AND state = 'pending' AND origin = 'drafted'`).run(userId, String(jobId)).changes > 0;
}

/** job_applications — the Submitted list — written ONLY from a verified record. */
function writeApplication(db, { userId, jobId, job, record, capturedAtsAtApply }) {
  const stamp = capturedAtsAtApply ? capturedAtsAtApply(db, userId, String(jobId)) : { score: null, version: null, report: null };
  const notes = [SUBMIT_METHODS[record.method], record.reference ? `ref ${record.reference}` : null].filter(Boolean).join(" · ");
  db.prepare(`
    INSERT INTO job_applications
      (user_id, job_id, company, role, job_url, source, location, apply_mode, applied_at, notes, auto_status,
       ats_score_at_apply, ats_scorer_version, ats_report_at_apply, ats_scored_at,
       salary_min, salary_max, salary_currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, job_id) DO UPDATE SET
      applied_at = excluded.applied_at, notes = COALESCE(excluded.notes, job_applications.notes),
      -- D43: the posting's pay, snapshot at apply time — kept if the posting is later deleted.
      salary_min = COALESCE(job_applications.salary_min, excluded.salary_min),
      salary_max = COALESCE(job_applications.salary_max, excluded.salary_max),
      salary_currency = COALESCE(job_applications.salary_currency, excluded.salary_currency),
      auto_status = 'verified',
      ats_score_at_apply = COALESCE(job_applications.ats_score_at_apply, excluded.ats_score_at_apply),
      ats_scorer_version = COALESCE(job_applications.ats_scorer_version, excluded.ats_scorer_version),
      ats_report_at_apply = COALESCE(job_applications.ats_report_at_apply, excluded.ats_report_at_apply),
      ats_scored_at = COALESCE(job_applications.ats_scored_at, excluded.ats_scored_at)
  `).run(userId, String(jobId), job?.company ?? null, job?.title ?? null, job?.apply_url || job?.url || null,
         job?.source ?? null, job?.location ?? null, record.method === "draft" ? "AUTO" : "MANUAL",
         record.submitted_at, notes || null,
         stamp.score, stamp.version, stamp.report, stamp.score == null ? null : nowSec(),
         job?.salary_min ?? null, job?.salary_max ?? null, job?.salary_currency ?? null);
  try {
    const profileId = db.prepare("SELECT id FROM domain_profiles WHERE user_id=? AND is_active=1 ORDER BY id DESC LIMIT 1")
      .pluck().get(userId) ?? null;
    db.prepare(`
      INSERT INTO user_jobs (user_id, job_id, domain_profile_id, applied, updated_at)
      VALUES (?, ?, ?, 1, unixepoch())
      ON CONFLICT(user_id, job_id) DO UPDATE SET applied = 1, updated_at = unixepoch()
    `).run(userId, String(jobId), profileId);
  } catch { /* a fixture without user_jobs: the application row is what matters */ }
}

function clip(v, n) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}

function persist(db, userId, jobId, origin, fields, verification, capturedAtsAtApply, job) {
  const now = nowSec();
  const state = verification.verified ? "verified" : "recorded";
  db.transaction(() => {
    db.prepare(`
      INSERT INTO application_records (user_id, job_id, state, origin) VALUES (?, ?, 'pending', ?)
      ON CONFLICT(user_id, job_id) DO NOTHING
    `).run(userId, String(jobId), origin);
    db.prepare(`
      UPDATE application_records SET state = ?, submitted_at = ?, method = ?, reference = ?, evidence_text = ?,
             evidence_url = ?, recorded_at = ?, verified_at = ?, verification_json = ?, withdrawn_at = NULL,
             updated_at = ?
      WHERE user_id = ? AND job_id = ?
    `).run(state, fields.submitted_at, fields.method, fields.reference, fields.evidence_text, fields.evidence_url,
           now, verification.verified ? now : null, JSON.stringify(verification), now, userId, String(jobId));
    if (verification.verified) writeApplication(db, { userId, jobId, job, record: fields, capturedAtsAtApply });
  })();
  const artifact = snapshotResumeForRecord(db, { userId, jobId });
  return { state, verification, record: readRecord(db, userId, jobId), artifact };
}

/**
 * The user records a submission. Verifies it; writes job_applications only if it verifies.
 * Throws { status, code, message } on bad input or on a record already verified.
 */
export function recordSubmission(db, { userId, jobId, input = {}, capturedAtsAtApply, now = nowSec() }) {
  const bad = (message) => Object.assign(new Error(message), { status: 400, code: "invalid_submission" });
  if (!jobId) throw bad("Which job? jobId is required.");
  const submitted_at = toEpochSeconds(input.submittedAt);
  if (submitted_at == null) throw bad("When did you submit it? Give a date.");
  if (!USER_METHODS.includes(input.method)) throw bad(`How did you submit it? One of: ${USER_METHODS.join(", ")}.`);
  const existing = readRecord(db, userId, jobId);
  if (existing?.state === "verified" || alreadySubmitted(db, userId, jobId)) {
    throw Object.assign(new Error("This application is already verified and in your Submitted list."),
      { status: 409, code: "already_verified" });
  }
  const fields = {
    submitted_at, method: input.method,
    reference: clip(input.reference, 64), evidence_text: clip(input.evidenceText, 2000),
    evidence_url: clip(input.evidenceUrl, 2000),
  };
  const job = readJob(db, jobId);
  const verification = verifyEvidence({ job: job || {}, record: fields, now });
  return persist(db, userId, jobId, existing?.origin || "manual", fields, verification, capturedAtsAtApply, job);
}

/** The automation submitted. Verified only when it confirmed the submit on the employer's page. */
export function recordSubmissionFromPipeline(db, { userId, jobId, runJobId, capturedAtsAtApply }) {
  const rj = db.prepare("SELECT submit_verified, submit_evidence, finished_at FROM apply_run_jobs WHERE id = ?").get(runJobId) || {};
  const fields = {
    submitted_at: rj.finished_at || nowSec(), method: "draft", reference: null,
    evidence_text: clip(rj.submit_evidence, 2000), evidence_url: null,
  };
  const job = readJob(db, jobId);
  const verification = verifyEvidence({ job: job || {}, record: { ...fields, automation_verified: rj.submit_verified === 1 } });
  return persist(db, userId, jobId, "draft", fields, verification, capturedAtsAtApply, job);
}

/** "I did not apply." Only from pending or recorded; a verified one is history. */
export function withdraw(db, userId, jobId) {
  return db.prepare(`
    UPDATE application_records SET state = 'withdrawn', withdrawn_at = unixepoch(), updated_at = unixepoch()
    WHERE user_id = ? AND job_id = ? AND state IN ('pending', 'recorded')
  `).run(userId, String(jobId)).changes;
}

export function publicRecord(r) {
  if (!r) return null;
  let verification = null;
  try { verification = r.verification_json ? JSON.parse(r.verification_json) : null; } catch {}
  return {
    jobId: r.job_id, state: r.state, origin: r.origin,
    title: r.title ?? null, company: r.company ?? null, applyUrl: r.apply_url || r.url || null,
    createdAt: r.created_at ? r.created_at * 1000 : null,
    updatedAt: r.updated_at ? r.updated_at * 1000 : null,
    submittedAt: r.submitted_at ? r.submitted_at * 1000 : null,
    method: r.method ?? null, methodLabel: r.method ? SUBMIT_METHODS[r.method] ?? r.method : null,
    reference: r.reference ?? null, evidenceText: r.evidence_text ?? null, evidenceUrl: r.evidence_url ?? null,
    verifiedAt: r.verified_at ? r.verified_at * 1000 : null,
    checks: verification?.checks ?? null,
  };
}

/** The Pending table (pending + recorded) and the recently verified, newest first. */
export function listRecords(db, userId) {
  const q = (states, limit) => db.prepare(`
    SELECT ar.*, sj.title, sj.company, sj.apply_url, sj.url
    FROM application_records ar
    LEFT JOIN scraped_jobs sj ON sj.job_id = ar.job_id
    WHERE ar.user_id = ? AND ar.state IN (${states.map(() => "?").join(",")})
    ORDER BY ar.updated_at DESC, ar.id DESC LIMIT ${limit}
  `).all(userId, ...states).map(publicRecord);
  return { pending: q(["pending", "recorded"], 200), verified: q(["verified"], 50) };
}

// ── D15 · The Table — every application, pending and sent ──────────────────────────────────────
//
// The rule (status, timeline, chips) is shared/applicationHistory.js; this only reads the rows.
// Search covers the POSTING TEXT, which never leaves the server — the panel gets the matches, not
// the descriptions. Each read is guarded: a fixture without a table must not lose the history.
export function listHistory(db, userId, { q = "", now = nowSec(), limit = 500 } = {}) {
  const all = (sql, ...args) => { try { return db.prepare(sql).all(...args); } catch { return []; } };
  const records = all("SELECT * FROM application_records WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?", userId, limit);
  const applications = all("SELECT * FROM job_applications WHERE user_id = ? ORDER BY applied_at DESC LIMIT ?", userId, limit);
  const resumes = all("SELECT job_id, created_at FROM resumes WHERE user_id = ?", userId);
  const approvals = all(`SELECT job_id, MAX(approved_at) AS approved_at FROM apply_run_jobs
                          WHERE user_id = ? AND approved_at IS NOT NULL GROUP BY job_id`, userId);
  const ids = [...new Set([...records, ...applications].map(r => String(r.job_id)))];
  const jobs = [];
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    jobs.push(...all(`SELECT job_id, title, company, apply_url, url, description FROM scraped_jobs
                       WHERE job_id IN (${chunk.map(() => "?").join(",")})`, ...chunk));
  }
  // D16's kept copies — metadata only, never the body. Joined through the record so another user's
  // artifact can never appear (application_artifacts has no user_id of its own).
  const artifacts = all(`SELECT aa.record_id, aa.source, aa.created_at FROM application_artifacts aa
                          JOIN application_records ar ON ar.id = aa.record_id
                          WHERE ar.user_id = ? AND aa.kind = 'resume'`, userId);
  const snapshots = all(`SELECT job_id, MAX(posting_title) AS title, MAX(posting_company) AS company, MAX(posting_url) AS apply_url
                          FROM apply_run_jobs WHERE user_id = ? AND posting_company IS NOT NULL GROUP BY job_id`, userId);
  const rows = buildHistory({ records, applications, resumes, approvals, jobs, artifacts, snapshots }, { now });
  // ⭐ D54: every row carries its COMPANY — one identity across boards (shared/companyIdentity.js), never
  // the display string alone. Domains come from the logo store, keyed by the same normalised name.
  const domainBy = new Map(all("SELECT company, domain FROM company_logos WHERE domain IS NOT NULL")
    .map(r => [companyNameKey(r.company), r.domain]));
  const { groups, keyOf } = groupCompanies(rows.map(r => ({ id: r.jobId, company: r.company, url: r.applyUrl,
    domain: domainBy.get(companyNameKey(r.company)) ?? null })));
  const nameOf = new Map(groups.map(g => [g.key, g.name]));
  for (const r of rows) { r.companyKey = keyOf.get(String(r.jobId)) ?? null; r.companyName = nameOf.get(r.companyKey) ?? r.company ?? null; }
  const text = new Map(jobs.map(j => [String(j.job_id), j.description]));
  return rows.filter(r => matchesSearch(r, text.get(r.jobId), q));
}

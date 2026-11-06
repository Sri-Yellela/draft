import os from "os";
import crypto from "node:crypto";
// ⭐ D113: a tap on Apply in a picks message is the user's own send for THAT job (services/picks.js pickAuthorisesSend).
import { pickAuthorisesSend } from "../services/picks.js";
import path from "path";
import { resolveEntitlement } from "../services/entitlementResolver.js";
import { fileURLToPath } from "url";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { autoApply, requestAbort, isAbortRequested, clearAbort, normaliseText } from "../services/applyAutomation.js";
import {
  readAnswerStore, resolveForCompany, effectiveCustomAnswers, companyKey,
  resolvesQuestion, rememberAnswer,
} from "../services/customAnswers.js";
import { normaliseQuestion, workHistoryCompanies } from "../shared/savedAnswers.js";
import { lifecycleInputs } from "../services/answerLifecycle.js";
import { isSalaryQuestion, jobAnswerScope, readScoped, rememberScoped, resolveScoped, scopedResolves, withScopedAnswers } from "../services/scopedAnswers.js";
import { atsScorePair } from "../shared/resumeScores.js";
import { getKnownLogoUrl } from "../shared/companyLogos.js";
import {
  buildGatePacket, mintPacketToken, verifyPacketToken, hashToken, originOf,
  DEFAULT_TOKEN_TTL_MS,
  handoffKind, shouldBuildPacket, packetFreshness, PACKET_STALE_MS, HANDOFF_STATUSES,
  buildPacketEntries, packetSavedAnswers, PACKET_ANSWERS_VERSION,
} from "../services/applyGatePacket.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { payloadResumeParse } from "../services/payloadResume.js";
import { baseResumeOnlyState, baseOnlyGeneration, activeBaseResume, baseResumeHtml, BASE_RESUME_LABEL } from "../services/baseResumeOnly.js";
import {
  recordFormSchema, formSchemaSummary, hostOf,
} from "../services/kb/formSchemaLayer.js";
import { probeBrowserAvailability } from "../services/browserLauncher.js";
// AH5: the one definition of "is this stored resume still the right one". Shared with server.js's
// generateResumeForApply so the two reuse sites cannot drift apart again.
import { artifactCurrency, currencySentence } from "../services/resumeCurrency.js";
// TASK H — CONFIRMED label mappings only, loaded here because services/applyAutomation.js has no
// database handle by design and must keep it that way.
import { loadAllConfirmedMappings } from "../services/kb/formFieldMappings.js";
import { detectPlatformFromUrl } from "../services/platformDetector.js";
import { classifyRuntimeError } from "../shared/failureAttribution.js";
import { getAutomationReadiness, getMissingApplyPrerequisites } from "../services/integrationReadiness.js";
import { canUseAPlusResume, normalisePlanTier } from "../services/entitlements.js";
import { monetisationEnabledFromEnv } from "../shared/monetisation.js";
import { fullAutoDisabled as sharedFullAutoDisabled } from "../services/appSettings.js";
import { userHeld, userHoldSince, setUserHold } from "../services/applyUserHold.js";
import { draftSlots, slotsExhausted } from "../services/draftSlots.js";
import { atsJobInputHash, ATS_JOB_INPUT_FIELDS } from "../services/jobs/boardFitPrecompute.js";
import { recordSubmissionFromPipeline, markPending, releaseDraftRecord, publicRecord } from "../services/applicationRecords.js";
import { binRunJobs, listBin, restoreFromBin, purgeNow, BIN_DAYS } from "../services/draftBin.js";
// D56: a packet's ORIGINS (the adapter table, never the user) and the manual route's page → job.
import { APPLY_ORIGIN_FAMILIES, pageMatchesPacket, hostsSentence } from "../services/applyOrigins.js";
import { learnedFamilies, recordSighting } from "../services/learnedOrigins.js";
import { evidenceUrlOf } from "../services/evidenceUrl.js";
import { packetAddressing, resolvePageJob, pageNotice, copySheetRows, handoffMessage, ownPageUrls, jobOnUsersBoard } from "../services/manualHandoff.js";
import { recordSubmission } from "../services/applicationRecords.js";
// D100 P2: a gated run-job with a connected portal session goes to the apply worker (services/applyWorker.js).
import { enqueueRemoteRun, sessionForHost, accountForHost } from "../services/applyWorker.js";
import { notifyRunJobOutcome } from "../services/notify.js";
// D104 P1: Approve all leaves out a posting the candidate's own defaults rule out.
import { eligibilityForJob, userEligibilityInputs } from "../services/jobEligibility.js";
// D107 P3: Approve all also leaves out a posting past the user's staleness thresholds (Auto settings).
import { livenessFor, isStale } from "../services/jobs/jobHistory.js";
import { readAutoSettings } from "../shared/autoSettings.js";
import { educationEntries } from "../services/structuredProfile.js";

// Live read through the one shared parser, exactly as server.js does — same flag, same function,
// so this route and the gates over there cannot disagree. ⛔ See shared/monetisation.js: ON is a
// legal statement about the trader declaration, not merely a UI change.
const monetisationEnabled = () => monetisationEnabledFromEnv(process.env);
// TASK AC4: the three outcome groups of the dated history. In shared/ because the panel renders
// the same partition — a copy on each side is how "COMPLETED" comes to mean two things.
import { OUTCOME, OUTCOME_STATUSES, outcomeGroupFor } from "../shared/applyOutcomeGroups.js";
import { trialSendUrl, practiceBaseUrl, practiceSecret } from "../services/trial.js";
// AK1: the OTHER outcome axis — what the employer did, not what our pipeline did. The two are
// deliberately separate vocabularies; see the header of shared/applicationResponse.js.
import {
  RESPONSE_OUTCOMES, RESPONSE_OUTCOME, RESPONSE_LABELS, MATURITY_DAYS,
  mergeResponse, responseBucket, isResponse, normaliseOutcome, STAGE_RANK,
} from "../shared/applicationResponse.js";

// Must match services/applyAutomation.js SCREENSHOT_DIR — screenshot_path rows are absolute paths
// written by takeScreenshot(), and this is the only directory they are ever allowed to resolve into.
const SCREENSHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "screenshots");

// ── Gate-packet token secret (TASK G1) ───────────────────────────────────────────────────────
// Read from the environment here rather than threaded through applyRoutes()' already long parameter
// list, which server.js is the only caller of — adding an eighth positional argument for this would
// be a worse trade than one module-scope constant.
//
// Falls back to SESSION_SECRET because it is the secret this deployment already has and rotating it
// invalidates gate tokens, which is the correct blast radius. In production with neither set the
// value is empty and minting REFUSES: a run then still holds as held_gate with no packet, which is a
// visible degradation. Minting on a known-weak dev secret in production would be worse than that —
// the token unlocks a home address and eligibility answers.
const GATE_TOKEN_SECRET =
  process.env.APPLY_GATE_TOKEN_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "dev-gate-token-secret-change-me");

/** Exchange attempts allowed per user per window. The endpoint returns a home address. */
const GATE_EXCHANGE_MAX_ATTEMPTS = 20;
const GATE_EXCHANGE_WINDOW_SEC = 10 * 60;

/**
 * AK1 — the ATS score to stamp on an application, and the scorer version that produced it.
 *
 * Reads an EXISTING report rather than scoring. Two sources, most-specific first:
 *   1. resumes.ats_report      — the generated document that was actually sent
 *   2. ats_only_reports        — the report the candidate saw on the board before applying
 *
 * The version is read out of the stored report's own `source` field rather than from the current
 * LOCAL_ATS_SOURCE constant. Those two differ exactly when a cached report predates a scorer
 * change, which is the case the version column exists to keep straight — stamping today's version
 * onto a report produced by an older one would be the specific lie this field is meant to prevent.
 *
 * ── ⛔ CC5 · THE THIRD SOURCE WAS DELETED, AND IT WAS A CROSS-USER READ ───────────────────────────
 *
 * It was:
 *
 *     || pick(db.prepare("SELECT ats_report FROM scraped_jobs WHERE job_id=?").get(jobId))
 *
 * described here as "the scrape-time score against the base resume" — WHOSE base resume was never
 * asked. `scraped_jobs.ats_report` is ONE CELL PER JOB, written at ingest from whichever user's
 * résumé basis happened to trigger the crawl. So a candidate who applied to a posting somebody else
 * had crawled got THAT PERSON'S score, their matched terms and their missing terms, written into
 * their own `job_applications` row and into `ats_report_at_apply` verbatim.
 *
 * That is worse here than on any display surface. A wrong number on a card is a wrong number on a
 * card; this one is PERMANENT and it is the training signal — `job_applications` is the only table
 * that can ever correlate a score with whether an employer replied, and AK1's own comment says a
 * fabricated point in it would poison the only dataset that can validate the scorer. A stranger's
 * score against the same posting is a fabricated point with a plausible provenance stamp on it.
 *
 * There is no narrower read that fixes it: a score is a statement about (résumé, posting), and a
 * per-job cell cannot hold one. Falling through to nulls is correct and already handled — see the
 * "NULL IS AN HONEST ANSWER" note at the insert site.
 *
 * ── CC5 · AND BOTH SURVIVING SOURCES ARE NOW SCOPED TO THE PROFILE ──────────────────────────────
 *
 * Both tables carry `domain_profile_id` and both reads ignored it, so a user with an engineering
 * profile and a data profile stamped whichever report existed first. Rows predating the column
 * carry NULL and are accepted as a LAST resort — an old report of your own beats none, and
 * `ORDER BY (domain_profile_id IS NULL) ASC` puts the profile-matched one first when both exist.
 *
 * The profile is resolved here rather than passed in, from the same rule the rest of the server
 * uses (`is_active = 1`). Two callers with two local variable names is two chances to hand this the
 * wrong profile, and neither call site has a reason to mean anything but "the active one".
 *
 * Returns nulls when nothing has scored this job. That is left as null: see the insert site.
 */
export function capturedAtsAtApply(db, userId, jobId) {
  const empty = { score: null, version: null, report: null };
  const pick = (row) => {
    if (!row?.ats_report) return null;
    let parsed;
    try { parsed = JSON.parse(row.ats_report); } catch { return null; }
    if (!parsed || typeof parsed !== "object") return null;
    // A report the scorer DECLINED carries no score, and an application against it records that
    // honestly rather than inventing one.
    if (parsed.score == null) return null;
    return { score: parsed.score, version: parsed.source || null, report: row.ats_report };
  };
  try {
    const profileId = db.prepare(
      "SELECT id FROM domain_profiles WHERE user_id=? AND is_active=1"
    ).get(userId)?.id ?? null;
    // One statement per table, differing only in the table name, so the two cannot drift into
    // disagreeing about what "this user's report for this profile" means.
    const forProfile = (table) => db.prepare(`
      SELECT ats_report FROM ${table}
      WHERE user_id = ? AND job_id = ?
        AND (domain_profile_id IS NULL OR domain_profile_id = ?)
      ORDER BY (domain_profile_id IS NULL) ASC
      LIMIT 1
    `).get(userId, jobId, profileId);
    // A52 follow-up (10-02): a STORED board score is a statement about the posting as it was when it
    // was scored. If the posting has changed since (enrichment landed, a re-crawl edited it), its
    // job_hash no longer matches and the board itself shows "Check match" — so it is not the score
    // the candidate saw, and stamping it would put a stale number into the only dataset that can
    // validate the score. A row with no job_hash (scored before migration 118) is stale too, while the
    // posting still exists.
    const boardReport = () => {
      const row = db.prepare(`
        SELECT ats_report, job_hash FROM ats_only_reports
        WHERE user_id = ? AND job_id = ? AND (domain_profile_id IS NULL OR domain_profile_id = ?)
        ORDER BY (domain_profile_id IS NULL) ASC LIMIT 1
      `).get(userId, jobId, profileId);
      if (!row) return null;
      const posting = db.prepare(`SELECT ${ATS_JOB_INPUT_FIELDS.join(", ")} FROM scraped_jobs WHERE job_id = ?`).get(jobId);
      // No posting row (expired, pruned): nothing newer exists for the score to be stale against.
      if (posting && row.job_hash !== atsJobInputHash(posting)) return null;
      return pick(row);
    };
    return pick(forProfile("resumes"))
      || boardReport()
      || empty;
  } catch {
    // Recording an application must never fail because a score could not be found for it.
    return empty;
  }
}

/**
 * D36 — where a run's résumé / cover-letter PDF is written for upload.
 *
 * ⛔ THE JOB ID IS NOT A FILENAME. Real ids are `greenhouse::6110219004`, and `:` is illegal in a
 * Windows path, so every conversion on a Windows host threw ENOENT inside a `catch { return null; }`.
 * The run then held as `resume_unavailable` — "No resume was generated" — over a résumé that HAD
 * been generated and scored (D36 walk, 10-05). Linux accepts the colon, which is why production never
 * showed it; the silent catch is why nothing else did either. Anything outside [A-Za-z0-9_-] becomes
 * `_`, so the name is portable and still says which job it was.
 */
export function tmpPdfPath(kind, userId, jobId, now = Date.now()) {
  const safe = (v) => String(v ?? "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
  return path.join(os.tmpdir(), `${safe(kind)}_${safe(userId)}_${safe(jobId)}_${now}.pdf`);
}

/**
 * ⭐ D100 (owner 10-30, GATES LIFTED): FULL AUTO IS THE USER'S MODE. The server constant that locked it
 * (`FULL_AUTO_PROVEN = false`, D22 / D36) is removed — a RECORDED DELIBERATE REVERSAL (D100,
 * CORRECTIONS_REGISTER.md). `users.send_mode` (migration 169) is 'semi' | 'auto'; NULL is 'semi', the default.
 *
 * It is READ in the same three places the lock was — the run bar (autoModeState), admission (startRun
 * refuses approvalMode 'auto' with 403 full_auto_not_chosen unless the user chose FULL AUTO) and
 * processing (processRunJob holds an 'auto' row the same way, so a row written any other way cannot
 * send for a user who did not choose it). What stays: the operator's kill switch and the user's own
 * Stop everything are controls, not gates, and both still stop it.
 */
export const APPLY_MODES = Object.freeze(["semi", "auto"]);

/** D36: what a deferred preview says about the résumé it has not written yet. */
export const DEFERRED_RESUME_SENTENCE =
  "No résumé exists for this job yet. It is written when you approve — nothing was generated for the preview.";

function publicApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    company: row.company,
    role: row.role,
    jobUrl: row.job_url,
    source: row.source,
    location: row.location,
    applyMode: row.apply_mode,
    resumeFile: row.resume_file,
    appliedAt: row.applied_at,
    notes: row.notes,
    status: row.auto_status || "manual",
    // AK1 provenance. Exposed as a pair because a score without the scorer that produced it cannot
    // be compared with any other score — v3 and v4 disagree by roughly 17 points on the same fit.
    atsScoreAtApply: row.ats_score_at_apply ?? null,
    atsScorerVersion: row.ats_scorer_version ?? null,
    // AK1 — the employer's half of the pair.
    responseOutcome: row.response_outcome ?? null,
    furthestStage: row.furthest_stage ?? null,
    firstResponseAt: row.first_response_at ?? null,
    outcomeAt: row.outcome_at ?? null,
    // Derived, not stored: "nothing recorded" means different things at 2 days and at 2 months, and
    // a caller that had to work that out itself would get it wrong the same way a naive query does.
    responseBucket: responseBucket(row),
  };
}

/**
 * D123 P6e (R9): a memoised, on-demand cover letter. autoApply calls it only when the form shows a cover-letter upload,
 * so a form without one costs no model call; a second cover slot (another frame, the next step) reuses the first answer.
 */
export function coverLetterOnDemand(make) {
  let pending = null;
  return () => (pending ??= Promise.resolve().then(make).catch(() => null));
}

export default function applyRoutes(app, db, requireAuth, buildAutofillPayload, generateResumeForApply, htmlToPdf, generateCoverLetterForApply,
                                    scoreBaseResumeForApply, { applyOriginFamilies = APPLY_ORIGIN_FAMILIES } = {}) {
  // D55 (f) · every payload this module builds — for a run's resolver AND for a packet — carries the
  // work history "have you worked here before?" is answered from: the profile's current_company plus
  // the base résumé's EXPERIENCE companies, the same `entries.work` the packet fills Work Experience
  // with. One fact, one source, so the two cannot disagree. (The parameter is re-bound rather than
  // renamed: test/applyPipeline.test.js pins the signature.)
  // ⭐ D66 · BASE-RÉSUMÉ-ONLY: every résumé this router asks for goes through generateResumeForApply, so
  // this one wrapper is where the setting holds. On → the base résumé, ⛔ and the model is never called.
  const generateResumeForApplyModel = generateResumeForApply;
  generateResumeForApply = async (userId, jobId, toolType) => {
    if (baseResumeOnlyState(db, userId).on) return baseOnlyGeneration(db, userId);
    return generateResumeForApplyModel(userId, jobId, toolType);
  };
  const buildAutofillPayloadBase = buildAutofillPayload;
  // ⛔ D165 (3): `jobId` (optional) is the posting the payload fills — its role + location pick the person's SCOPED
  // salary answers (services/scopedAnswers.js: the most specific matching scope wins). Without a job only the global
  // answers apply, as before.
  buildAutofillPayload = (profile, mode, company = null, jobId = null) => {
    let payload = buildAutofillPayloadBase(profile, mode, company);
    if (!payload || typeof payload !== "object") return payload;
    let work = [];
    try { if (profile?.user_id != null) work = packetEntriesFor(profile.user_id)?.work || []; } catch { /* fewer employers, never a thrown payload */ }
    if (jobId != null) {
      try { payload = withScopedAnswers(payload, readScoped(profile), jobAnswerScope(db, jobId)); } catch { /* the global answers, never a thrown payload */ }
    }
    return { ...payload, worked_here: { company: company ?? payload.worked_here?.company ?? null,
      history: [...new Set([...(payload.worked_here?.history || []), ...workHistoryCompanies({ profile, work })])] } };
  };
  // D56: the adapter table a packet's origin list comes from. A parameter only so a test can add the
  // local fake ATS's two-origin family; server.js passes nothing and gets the table in code.
  const FAMILIES = applyOriginFamilies;
  // ⭐ D67 (2): the code table plus the pairs learned from users — the promoted ones, and the ones THIS
  // user saw themselves (services/learnedOrigins.js). Every packet-address check reads it per user.
  const familiesFor = (userId) => [...FAMILIES, ...learnedFamilies(db, userId)];
  // ── Manual tracking endpoints ────────────────────────────────────────────────

  // ⛔ A63: THIS NO LONGER RECORDS AN APPLICATION ON A CLICK. Its one caller was the board's Apply
  // button, which sent mode:"semi" expecting a browser to open — this route ignored the mode and
  // wrote job_applications on the spot, so pressing Apply marked a job "applied" with nothing sent.
  // The Apply button is gone (the company name now links to the posting) and this route tags the
  // job PENDING instead; job_applications is written only when a recorded submission VERIFIES
  // (services/applicationRecords.js). Idempotent as before.
  app.post("/api/apply", requireAuth, (req, res) =>
    withIdempotency("/api/apply", req, res, (out) => {
    const { jobId } = req.body || {};
    if (!jobId) {
      return out.status(400).json({ error: "jobId required",
        message: "Pick the job on the board; it is tagged Pending until you record and verify the submission." });
    }
    const r = markPending(db, req.user.id, String(jobId), "manual");
    out.json({
      ok: true, state: r.state, pending: r.state === "pending" || r.state === "recorded",
      record: publicRecord(r.record),
      message: r.state === "submitted"
        ? "Already in your Submitted applications."
        : "Tagged Pending — record when and how you submitted it, and it moves to Submitted once it verifies.",
    });
  }));

  app.get("/api/apply/status/:jobId", requireAuth, (req, res) => {
    const row = db.prepare("SELECT * FROM job_applications WHERE user_id=? AND job_id=?")
      .get(req.user.id, String(req.params.jobId));
    res.json({
      status: row ? "applied" : "idle",
      application: publicApplication(row),
    });
  });

  app.get("/api/apply/applications", requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT * FROM job_applications
      WHERE user_id=?
      ORDER BY applied_at DESC, id DESC
      LIMIT 100
    `).all(req.user.id);
    res.json({ applications: rows.map(publicApplication) });
  });

  // ── AK1: recording what the employer did ─────────────────────────────────────
  //
  // THE CALLER IS THE APPLICATIONS SHEET in client/src/panels/DatabasePanel.jsx — the Outcome
  // column's picker posts here.
  //
  // It deliberately does NOT go through PATCH /api/applications/:jobId, which every other editable
  // cell in that table uses. That endpoint writes whatever field it is handed, and these columns
  // must not be written that way: first_response_at is set once and never moved, and furthest_stage
  // only ever advances so that screen -> interview -> rejected keeps the interview instead of
  // reading as a resume rejection. Those rules live in mergeResponse, and a dedicated endpoint is
  // how they are enforced for every caller rather than re-implemented in a click handler.
  app.patch("/api/apply/applications/:jobId/response", requireAuth, (req, res) => {
    const { outcome: reported = null, respondedAt = null, source = "manual" } = req.body || {};
    // D55 F: the funnel's words (screen · interviewing · offer) are accepted; what is STORED is always
    // the shared vocabulary's value, so a row written before the funnel reads exactly as it did.
    const outcome = normaliseOutcome(reported);
    if (outcome === undefined) {
      return res.status(400).json({
        error: `unknown outcome "${reported}"`,
        allowed: RESPONSE_OUTCOMES,
      });
    }
    const jobId = String(req.params.jobId);
    const existing = db.prepare("SELECT * FROM job_applications WHERE user_id=? AND job_id=?")
      .get(req.user.id, jobId);
    // Scoped AND checked. A 404 for a job this user has not applied to is the same answer as for
    // one that does not exist, so the endpoint cannot be used to probe another user's history.
    if (!existing) return res.status(404).json({ error: "No application recorded for that job" });

    let merged;
    try {
      merged = mergeResponse(existing, { outcome, respondedAt, source });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    db.prepare(`
      UPDATE job_applications
         SET response_outcome=?, furthest_stage=?, first_response_at=?, outcome_at=?, outcome_source=?
       WHERE user_id=? AND job_id=?
    `).run(
      merged.response_outcome, merged.furthest_stage, merged.first_response_at,
      merged.outcome_at, merged.outcome_source, req.user.id, jobId,
    );

    const row = db.prepare("SELECT * FROM job_applications WHERE user_id=? AND job_id=?")
      .get(req.user.id, jobId);
    res.json({ ok: true, application: publicApplication(row) });
  });

  /**
   * AK1 — does the ATS score predict a response?
   *
   * The endpoint that makes the pair worth having. It exists so that the question is asked with the
   * maturity window and the scorer-version split already applied, rather than by whoever writes the
   * first ad-hoc query and forgets both.
   *
   * READ THE CAVEATS IT RETURNS. They are part of the response, not documentation:
   *   - Applications younger than MATURITY_DAYS with nothing recorded are UNRESOLVED and are in no
   *     denominator. Counting them as silence is what makes an early response rate read near zero.
   *   - Scores are grouped BY SCORER VERSION and never pooled across one. v3 and v4 disagree by
   *     roughly 17 points on the same fit, so a pooled correlation would be confident and meaningless.
   *   - `sufficient` is false until there is enough data to say anything. n is zero today.
   */
  app.get("/api/apply/response-correlation", requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT applied_at, ats_score_at_apply, ats_scorer_version,
             response_outcome, furthest_stage, first_response_at
        FROM job_applications
       WHERE user_id=? AND ats_score_at_apply IS NOT NULL
    `).all(req.user.id);

    const byVersion = new Map();
    let unresolved = 0;
    for (const r of rows) {
      const bucket = responseBucket(r);
      if (bucket === "unresolved") { unresolved++; continue; }
      const key = r.ats_scorer_version || "unknown";
      if (!byVersion.has(key)) byVersion.set(key, { responded: [], silent: [], screened: [], notScreened: [] });
      const g = byVersion.get(key);
      g[bucket === "responded" ? "responded" : "silent"].push(r.ats_score_at_apply);
      // ⭐ D55 F: the funnel's question — did it get PAST THE SCREEN (screen, interview or offer, ever)?
      // A rejection is a reply but not a pass; furthest_stage keeps an interview a later rejection ended.
      const rank = Math.max(STAGE_RANK[r.furthest_stage] ?? 0, STAGE_RANK[r.response_outcome] ?? 0);
      g[rank >= 1 ? "screened" : "notScreened"].push(r.ats_score_at_apply);
    }

    const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const versions = [...byVersion.entries()].map(([version, g]) => {
      const n = g.responded.length + g.silent.length;
      const mr = mean(g.responded);
      const ms = mean(g.silent);
      return {
        scorerVersion: version,
        n,
        responded: g.responded.length,
        silent: g.silent.length,
        responseRate: n ? Number((g.responded.length / n).toFixed(4)) : null,
        meanScoreResponded: mr == null ? null : Number(mr.toFixed(2)),
        meanScoreSilent: ms == null ? null : Number(ms.toFixed(2)),
        // The headline: do applications that scored higher get more replies? Positive means yes.
        scoreDelta: (mr == null || ms == null) ? null : Number((mr - ms).toFixed(2)),
        // D55 F: the same comparison one step down the funnel — screened (or further) vs not.
        screened: g.screened.length,
        meanScoreScreened: mean(g.screened) == null ? null : Number(mean(g.screened).toFixed(2)),
        meanScoreNotScreened: mean(g.notScreened) == null ? null : Number(mean(g.notScreened).toFixed(2)),
        // Deliberately conservative. Below this, a delta is noise and reporting it invites exactly
        // the confident-and-wrong conclusion this whole task was about avoiding.
        sufficient: g.responded.length >= 20 && g.silent.length >= 20,
      };
    });

    res.json({
      maturityDays: MATURITY_DAYS,
      totalWithScore: rows.length,
      unresolved,
      versions,
      // No caller should have to know to look for these.
      caveats: [
        `Applications younger than ${MATURITY_DAYS} days with no recorded outcome are excluded as unresolved (${unresolved} of ${rows.length}).`,
        "Scores are never pooled across scorer versions — the scale changed between them.",
        "A version with sufficient:false has too little data to support any conclusion.",
      ],
    });
  });

  // ── Queue infrastructure ─────────────────────────────────────────────────────

  // ── Submit guards (TASK A3) ──────────────────────────────────────────────────
  // This pipeline submits real applications under a real candidate's name and a submission cannot
  // be recalled, so every limit here is configurable and every rejection is explicit.
  const envInt = (name, dflt) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
  };
  const APPLY_WORKER_LIMIT   = envInt("APPLY_WORKER_LIMIT", 2);
  // ⭐ D88 P1: the three apply caps are the resolver's (apply_daily_*), whose system defaults are these env
  // variables with these fallbacks — read at boot, as before.
  const APPLY_DAILY_CAP      = resolveEntitlement(db, null, "apply_daily_submission_cap").value;
  const APPLY_MAX_ACTIVE_RUNS = envInt("APPLY_MAX_ACTIVE_RUNS_PER_USER", 1);
  // A59: how many runs may WAIT behind the active one. A line is not a cap on spend — each waiting
  // job already counted against the daily queue cap when it was drafted — it bounds how much a user
  // can stack up that they would then have to read through in Auto Apply.
  const APPLY_MAX_WAITING_RUNS = envInt("APPLY_MAX_WAITING_RUNS_PER_USER", 25);
  /**
   * The ceiling on queue attempts per 24h.
   *
   * ⛔ RE-SCOPED BY TASK Q. THIS IS NO LONGER THE SPEND CAP. It was written as one — "at two model
   * calls per queued job (resume + cover letter), 40 is already ~80 calls a day" — and that was
   * true while processRunJob generated at QUEUE time. AL2 moved generation to approval — the
   * deferred branch below says "Nothing here calls a model" — so queueing 40 jobs now costs $0.
   * (The phrase "CASE D" with a colon is deliberately not written here: test/generationDeferral
   * .test.js anchors its branch slice on that exact string, and a prose mention of it upstream
   * silently widens the slice to most of this file. Third time this file has taught that lesson.)
   * The sentence was correct when
   * written and became false without anything editing it, which is the reason it is corrected here
   * rather than deleted: a stale rationale is how a cap survives the disappearance of its purpose.
   *
   * KEPT, NOT REMOVED, and the reason is that queueing is free of MODEL spend, not free. Every
   * preview opens a real browser, navigates a real employer's form and fills it. That is CPU, wall
   * time, disk, and — the part that actually matters — traffic to a third party under the
   * candidate's name. A ceiling on how many of those a day one user can start is worth having on
   * its own terms.
   *
   * So the number is unchanged and its MEANING is now stated honestly: a session/rate limit, not a
   * budget. What it must never again do is explain itself with a cost that is not incurred.
   *
   * 40 still has to sit ABOVE the caps below it: every approval needs a queue first and every
   * submission needs an approval, so a queue cap at or under either would make them unreachable.
   * assertCapOrdering() checks that rather than trusting this comment.
   */
  const APPLY_DAILY_QUEUE_CAP = resolveEntitlement(db, null, "apply_daily_queue_cap").value;
  /**
   * ⛔ THE SPEND CAP, and the one this pipeline was missing (TASK Q).
   *
   * AL2 moved every model call from queue time to APPROVAL time. The approve endpoint starts a run
   * with approval_mode='approved'; that run finds no artifact and goes down CASE C, which calls
   * generateResumeForApply AND generateCoverLetterForApply. Two model calls, ~$0.04, per approval.
   *
   * Nothing bounded it. queuedLast24h EXCLUDES approval_mode='approved' by design — that exclusion
   * was correct when an approval REUSED the preview's artifact and would otherwise have charged the
   * user twice for one application. After the deferral the same exclusion means the only action
   * that spends money is the only one no cap counts. The guard did not break; the cost moved out
   * from under it.
   *
   * 30. Above APPLY_DAILY_CAP's 25, because every submission needs an approval first and an
   * approval cap at or below it would make the submission cap unreachable — the identical argument
   * that put the queue cap above the submission cap. Below the queue cap's 40, because an approval
   * requires a preview to approve. The 5 over 25 is for approvals that do not end in a submission:
   * a hold, a form that stopped resolving, a retry through the answers path.
   */
  const APPLY_DAILY_APPROVAL_CAP = resolveEntitlement(db, null, "apply_daily_approval_cap").value;

  /**
   * ⛔ THE THREE CAPS MUST STAY REACHABLE (task Q requirement 4), AND ALL THREE ARE env-OVERRIDABLE.
   *
   * queue >= approval >= submission is not a style preference, it is the pipeline's own order: a
   * submission needs an approval, an approval needs a preview. Set APPLY_DAILY_QUEUE_CAP=10 with
   * APPLY_DAILY_CAP at 25 and the submission cap can never be hit — it would look like a
   * configured limit and behave like dead code, and nothing would say so.
   *
   * Warn rather than throw. A refusal to boot over a cap ordering would take the whole product down
   * for a misconfiguration that degrades one flow, and an operator who deliberately wants a tight
   * queue for a day should be able to have one. But it must be SAID, once, loudly, at the moment
   * the process reads the values.
   */
  function assertCapOrdering(log = console.warn) {
    const problems = [];
    if (APPLY_DAILY_QUEUE_CAP < APPLY_DAILY_APPROVAL_CAP) {
      problems.push(`APPLY_DAILY_QUEUE_CAP (${APPLY_DAILY_QUEUE_CAP}) is below APPLY_DAILY_APPROVAL_CAP ` +
        `(${APPLY_DAILY_APPROVAL_CAP}) — an approval needs a queued preview first, so the approval cap is unreachable.`);
    }
    if (APPLY_DAILY_APPROVAL_CAP < APPLY_DAILY_CAP) {
      problems.push(`APPLY_DAILY_APPROVAL_CAP (${APPLY_DAILY_APPROVAL_CAP}) is below APPLY_DAILY_CAP ` +
        `(${APPLY_DAILY_CAP}) — a submission needs an approval first, so the submission cap is unreachable.`);
    }
    for (const p of problems) log(`[applyRoutes] ⛔ CAP ORDERING: ${p}`);
    return problems;
  }
  assertCapOrdering();
  /**
   * The score at or above which an application is sent UNATTENDED. Below it the job is not
   * discarded — it becomes held_review with an early handoff, so the candidate still gets to send
   * it by hand.
   *
   * 65 -> 50, AND CONFIGURABLE. Two reasons, one of which is a correction:
   *
   * 65 was calibrated against a scorer that has since been fixed. The old ATS report mined 1-3 word
   * windows out of the job description and counted every sentence fragment it produced as a MISSING
   * skill, so the denominator was full of terms no resume could ever match and every score was
   * pushed down. Across 1291 real postings the corrected scorer gives median 48, p75 54, p90 61 —
   * and at 65 only 6% of postings could ever auto-send. A gate that holds 94% of everything is not
   * a safety threshold, it is an off switch nobody chose.
   *
   * 50 sits just above that median: roughly average-or-better matches go unattended (44%), the rest
   * queue for a human. It is a deliberate throughput decision, made by the owner with the
   * distribution in front of them, not a number inherited from a broken scale.
   *
   * ── AK1: 50 -> 30, BECAUSE THE SCALE MOVED, NOT BECAUSE THE POLICY DID ──
   *
   * The scorer was rebalanced (local_ats_v4): skills carry 70 of the 100 points instead of 50,
   * experience is graded instead of a 17-point cliff, and hard constraints only subtract — v3 paid
   * ~33 points for the mere absence of a detected problem, which is what held the floor near 30.
   * Re-measured over the same 1291 postings with a realistic engineering resume, v4 gives
   * median 28, p75 32, p90 38, max 63 — against v3's median 45.
   *
   * At 50 on the v4 scale, roughly 2% of postings could auto-send rather than the 44% the paragraph
   * above chose deliberately. That is a throughput regression rather than a safety one — the gate
   * was holding almost everything — but it is still a number that no longer means what it was set
   * to mean.
   *
   * 30 restores the STATED INTENT, unchanged: "just above the median, roughly average-or-better
   * goes unattended, the rest queue for a human". Against a v4 median of 28 and p75 of 32, 30 sits
   * exactly where 50 sat against v3's median of 45. The policy is the same policy; only the scale
   * underneath it moved.
   *
   * THIS SENDS MORE APPLICATIONS UNATTENDED THAN 50 DID, and that is the point — 50 on this scale
   * is an off switch nobody chose, which is the same failure the 65 -> 50 note above describes.
   * The owner adopted 30 explicitly after the redistribution was measured.
   *
   * RE-MEASURE BEFORE MOVING IT AGAIN. That distribution is for ONE profile and one resume, and it
   * moves with both — see the note below. The distribution and the inversion analysis behind this
   * number are in docs/ak1-ats-ranking.md.
   *
   * Configurable because the comment above says every limit here is; this one was the exception,
   * and it is the one most likely to want tuning as the scorer or the candidate's profile changes.
   * It is also candidate-specific — that distribution was measured for one profile.
   *
   * Nothing here relaxes what may be SAID: services/resumeClaimGuard.js still refuses an artifact
   * that overstates years or seniority, before it can be persisted or sent.
   *
   * NOTE ON 0: envInt only accepts n > 0, so ATS_AUTO_APPLY_THRESHOLD=0 falls back to the default
   * rather than meaning "send everything". That is the shared behaviour of every limit here and it
   * is the safe direction to be wrong in, but it does mean the gate cannot be switched off this
   * way — use the kill switch (app_settings.apply_full_auto_disabled) to stop unattended sending.
   */
  const ATS_AUTO_APPLY_THRESHOLD = envInt("ATS_AUTO_APPLY_THRESHOLD", 30);
  let activeWorkers = 0;

  /**
   * KILL SWITCH (requirement 4). Blocks all full-auto submission; semi mode keeps working.
   * The DB row wins so it can be flipped with no restart and no deploy; the env var is the
   * boot-level default. Read at request time — never cached — which is the whole point.
   *
   * The body of this moved to services/appSettings.js when the admin write path was added, so the
   * surface that FLIPS the switch and the pipeline that OBEYS it cannot disagree about what it
   * currently says. Behaviour is unchanged and pinned by applyGuards.test.js, which drives both
   * the env default and a DB override that reverses it.
   */
  function fullAutoDisabled() {
    return sharedFullAutoDisabled(db);
  }

  /** Applications actually submitted for this user in the trailing 24h. */
  function submittedLast24h(userId) {
    try {
      return db.prepare(`
        SELECT COUNT(*) AS n FROM apply_run_jobs
        WHERE user_id=? AND status='submitted' AND COALESCE(finished_at, 0) >= unixepoch() - 86400
      `).get(userId).n;
    } catch { return 0; }
  }

  /**
   * Queue attempts that can TRIGGER GENERATION, for this user, in the trailing 24h.
   *
   * WHY THIS EXISTS ALONGSIDE submittedLast24h. APPLY_DAILY_CAP counts status='submitted', and
   * since an 'auto' run now PREVIEWS by default (approval_mode='required'), nothing reaches
   * 'submitted' until a human approves. So `used` sat at 0 essentially always and the admission
   * check read `0 + N > 25` — which 25 jobs pass, and passes again on the next run, and the next.
   * APPLY_MAX_ACTIVE_RUNS only serialises runs; it is a rate limiter, not a ceiling.
   *
   * Meanwhile processRunJob spends money per job at QUEUE time, not at submit time: a preview runs
   * generateResumeForApply AND generateCoverLetterForApply and stops short only of the click. So
   * the one cost that scales with queueing was the one cost nothing bounded.
   *
   * COUNTS ROWS, NOT SUBMISSIONS, and counts them by created_at regardless of what status they
   * reached — a job that generated and then held for review cost exactly as much as one that
   * submitted, so for this purpose they are the same event.
   *
   * EXCLUDES approval_mode='approved' RUNS. That is the run the approve endpoint creates to send an
   * already-previewed application, and it reuses the artifact the preview just generated
   * (artifactCurrency finds it current, CASE A) rather than generating again. Counting it would
   * make the normal flow cost two against the cap per application and turn this guard into a
   * refusal to submit work the user has already reviewed — the opposite of the intent.
   *
   * ⚠ THE PARAGRAPH ABOVE IS THE REASON THE SPEND CAP HAD TO BE ADDED (task Q). It describes
   * generate-at-queue, where the exclusion cost nothing because the approved run reused an existing
   * artifact. With AL2's deferral there IS no artifact at approval time — the approved run goes down
   * CASE C and generates — so this exclusion now removes the only spending action from the only
   * cap that was counting. The exclusion is still right for what THIS counter measures; it is
   * approvedLast24h below that counts the other side.
   */
  function queuedLast24h(userId) {
    try {
      return db.prepare(`
        SELECT COUNT(*) AS n
        FROM apply_run_jobs rj
        JOIN apply_runs r ON r.id = rj.run_id
        WHERE rj.user_id=?
          AND COALESCE(r.approval_mode, '') != 'approved'
          AND COALESCE(rj.created_at, 0) >= unixepoch() - 86400
      `).get(userId).n;
    } catch { return 0; }
  }

  /**
   * Approvals that DO trigger generation, for this user, in the trailing 24h — the exact complement
   * of queuedLast24h's exclusion, so between them the two counters partition every run-job and no
   * spending action can fall through the gap that opened when generation moved.
   *
   * COUNTS RUN-JOBS, NOT APPROVE CALLS. One POST /api/apply/approve with eight runJobIds starts one
   * run of eight jobs and generates eight resumes. Counting requests would bound the wrong thing by
   * a factor of eight, which is the shape of a cap that reports a limit and enforces nothing.
   *
   * BY created_at, REGARDLESS OF OUTCOME, for the same reason queuedLast24h does: a job that
   * generated and then held cost exactly as much as one that submitted.
   */
  function approvedLast24h(userId) {
    try {
      return db.prepare(`
        SELECT COUNT(*) AS n
        FROM apply_run_jobs rj
        JOIN apply_runs r ON r.id = rj.run_id
        WHERE rj.user_id=?
          AND COALESCE(r.approval_mode, '') = 'approved'
          AND COALESCE(rj.created_at, 0) >= unixepoch() - 86400
      `).get(userId).n;
    } catch { return 0; }
  }

  function activeRunCount(userId) {
    try {
      return db.prepare(`
        SELECT COUNT(*) AS n FROM apply_runs WHERE user_id=? AND status IN ('queued','running')
      `).get(userId).n;
    } catch { return 0; }
  }

  // ── A59: THE LINE ─────────────────────────────────────────────────────────────────────────────
  //
  // A run over APPLY_MAX_ACTIVE_RUNS waits as apply_runs.status='waiting', ordered by
  // line_position (migration 120). Its jobs stay 'queued', so the duplicate filter, the caps and the
  // outcome partition need no new status. Until it STARTS it is the user's to edit, reorder or
  // remove; once dispatchLine claims it, it is an ordinary run and only abort applies.
  //
  // Every query that names line_position is reached only after a waiting row is known to exist, so
  // a database or a test fixture that predates 120 never touches the column.

  function waitingRunCount(userId) {
    return db.prepare(`SELECT COUNT(*) FROM apply_runs WHERE user_id=? AND status='waiting'`).pluck().get(userId);
  }

  /** The user's waiting runs, next first. */
  function waitingRuns(userId) {
    if (!waitingRunCount(userId)) return [];
    return db.prepare(`
      SELECT * FROM apply_runs WHERE user_id=? AND status='waiting' ORDER BY line_position, id
    `).all(userId);
  }

  /** 1-based place of one waiting run, and the line's length; null when it is not waiting. */
  function linePlaceOf(userId, runId) {
    const line = waitingRuns(userId);
    const i = line.findIndex(r => r.id === Number(runId));
    return i < 0 ? null : { position: i + 1, length: line.length };
  }

  /**
   * Why the line is not moving, or null. ⛔ THE KILL SWITCH STOPS THE LINE, not only the active run
   * (the A59 row): a waiting full-auto run is never started while full-auto is disabled, and since
   * the line is strictly in order, nothing behind it starts either. Semi runs are exempt exactly as
   * they are at admission — a human is at the browser for those.
   */
  function lineHeldBy(run) {
    // D25: the USER's Stop everything holds the line for every mode — unlike the kill switch, which
    // exempts semi. It is checked first because it is the one the user can see and undo.
    if (run && userHeld(db, run.user_id)) return "user_hold";
    if (run && run.mode === "auto" && fullAutoDisabled()) return "kill_switch";
    return null;
  }

  /**
   * Start the head of the user's line while a slot is free. Synchronous claim (status='waiting' in
   * the WHERE), so two callers — a run finishing and the ticker — cannot both start one run.
   * Returns how many runs it started.
   */
  function dispatchLine(userId) {
    let started = 0;
    for (let guard = 0; guard < 100; guard++) {
      if (activeRunCount(userId) >= APPLY_MAX_ACTIVE_RUNS) break;
      const head = waitingRuns(userId)[0];
      if (!head || lineHeldBy(head)) break;
      // Every job removed from it while it waited: nothing to start, so it leaves the line as
      // cancelled rather than becoming an empty run that "completes".
      const live = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE run_id=? AND status='queued'`).pluck().get(head.id);
      if (!live) {
        db.prepare(`UPDATE apply_runs SET status='cancelled', line_position=NULL, finished_at=unixepoch()
                    WHERE id=? AND status='waiting'`).run(head.id);
        continue;
      }
      const claimed = db.prepare(`
        UPDATE apply_runs SET status='queued', line_position=NULL WHERE id=? AND status='waiting'
      `).run(head.id).changes;
      if (!claimed) continue;
      for (const rj of db.prepare(`SELECT id, job_id FROM apply_run_jobs WHERE run_id=? AND status='queued'`).all(head.id)) {
        logEvent(head.id, rj.id, userId, rj.job_id, "run_left_line",
          "Started from the line — it can no longer be edited.");
      }
      const run = db.prepare("SELECT * FROM apply_runs WHERE id=?").get(head.id);
      setImmediate(() => processRun(run).catch(e => console.error("[applyRoutes] processRun:", e.message)));
      started++;
    }
    return started;
  }

  /** Every user's line, once. The ticker's body, and what boot recovery ends with. */
  function dispatchAllLines() {
    let users;
    try {
      users = db.prepare(`SELECT DISTINCT user_id FROM apply_runs WHERE status='waiting'`).pluck().all();
    } catch { return 0; }
    let started = 0;
    for (const u of users) {
      try { started += dispatchLine(u); }
      catch (e) { console.error(`[applyRoutes] line user=${u}: ${e.message}`); }
    }
    return started;
  }

  /**
   * ⚠ THE ORPHAN (the A59 row): a run left 'queued' or 'running' by a restart was never reset, and
   * because activeRunCount counts it, that user's line could never move again. Called once at boot
   * (server.js), before anything else can start a run.
   *
   *   a run-job that was RUNNING  -> failed, reason 'interrupted_by_restart'. Its browser is gone and
   *                                  what it reached is unknown, so it is not silently retried — a
   *                                  full-auto or approved job may have clicked submit just before.
   *   a run-job still QUEUED      -> left queued, and its run is restarted: it never opened anything.
   *   a run with nothing queued   -> 'interrupted'.
   *
   * ⚠ Assumes one process owns the database. Railway stops a service with a volume before it
   * starts the new deployment, so no other process can be mid-run when this reads 'running'.
   */
  function recoverInterruptedRuns() {
    const out = { runs: 0, jobsInterrupted: 0, runsResumed: 0, linesStarted: 0 };
    let orphans;
    try {
      orphans = db.prepare(`SELECT * FROM apply_runs WHERE status IN ('queued','running')`).all();
    } catch (e) {
      console.error(`[applyRoutes] recovery could not read apply_runs: ${e.message}`);
      return out;
    }
    for (const run of orphans) {
      out.runs++;
      const willSend = (run.mode || "auto") === "auto" && (run.approval_mode || "auto") !== "required";
      const detail = willSend
        ? "The server restarted while this application was being filled. It may or may not have reached the employer — check before drafting it again."
        : "The server restarted while this draft was being prepared. Nothing was sent. Draft it again to retry.";
      const running = db.prepare(`SELECT * FROM apply_run_jobs WHERE run_id=? AND status='running'`).all(run.id);
      for (const rj of running) {
        const n = db.prepare(`
          UPDATE apply_run_jobs SET status='failed', reason_code='interrupted_by_restart', reason_detail=?,
                 finished_at=unixepoch()
          WHERE id=? AND status='running'
        `).run(detail, rj.id).changes;
        if (n) {
          out.jobsInterrupted++;
          db.prepare(`UPDATE apply_runs SET failed_count=failed_count+1 WHERE id=?`).run(run.id);
          logEvent(run.id, rj.id, run.user_id, rj.job_id, "run_job_interrupted", detail);
        }
      }
      const queued = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE run_id=? AND status='queued'`).pluck().get(run.id);
      if (queued) {
        db.prepare(`UPDATE apply_runs SET status='queued' WHERE id=?`).run(run.id);
        const fresh = db.prepare("SELECT * FROM apply_runs WHERE id=?").get(run.id);
        setImmediate(() => processRun(fresh).catch(e => console.error("[applyRoutes] processRun:", e.message)));
        out.runsResumed++;
      } else {
        db.prepare(`UPDATE apply_runs SET status='interrupted', finished_at=unixepoch() WHERE id=?`).run(run.id);
      }
    }
    out.linesStarted = dispatchAllLines();
    if (out.runs) {
      console.log(`[boot] apply runs recovered: ${out.runs} orphaned, ${out.jobsInterrupted} jobs interrupted, ` +
        `${out.runsResumed} resumed, ${out.linesStarted} started from a line`);
    }
    return out;
  }

  /**
   * The line moves when a run finishes (processRun's finally). The ticker covers what that cannot:
   * the kill switch being turned OFF again (nothing finishes, so nothing would move the line) and a
   * dispatch lost to an exception. unref'd, so it never holds a process open.
   */
  let lineTicker = null;
  function startLineTicker(intervalMs = 30_000) {
    if (lineTicker) return lineTicker;
    lineTicker = setInterval(() => {
      try { dispatchAllLines(); } catch (e) { console.error(`[applyRoutes] line ticker: ${e.message}`); }
    }, intervalMs);
    lineTicker.unref?.();
    return lineTicker;
  }

  // ── Idempotency (requirement 1) ──────────────────────────────────────────────
  // A retry storm must not become duplicate applications to the same employer: duplicates are
  // worse than none. Keyed per user, NOT per endpoint — a key reused against a different endpoint
  // is surfaced as a 409 rather than silently answered with the wrong body.
  function priorResponse(userId, key, endpoint) {
    if (!key) return null;
    try {
      const row = db.prepare(
        "SELECT endpoint, status_code, response_json FROM apply_idempotency WHERE user_id=? AND idem_key=?"
      ).get(userId, key);
      if (!row) return null;
      if (row.endpoint !== endpoint) return { conflict: row.endpoint };
      return { statusCode: row.status_code, body: JSON.parse(row.response_json) };
    } catch { return null; }
  }

  function recordResponse(userId, key, endpoint, statusCode, body) {
    if (!key) return;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO apply_idempotency (user_id, idem_key, endpoint, status_code, response_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, key, endpoint, statusCode, JSON.stringify(body));
    } catch (e) {
      console.warn("[applyRoutes] idempotency record failed:", e.message);
    }
  }

  /**
   * Wraps a synchronous POST handler with replay protection. Handlers stay synchronous up to the
   * point they respond, so no interleaving is possible between the lookup and the record.
   */
  function withIdempotency(endpoint, req, res, handler) {
    const key = String(req.get("Idempotency-Key") || "").trim().slice(0, 200);
    const prior = priorResponse(req.user.id, key, endpoint);
    if (prior?.conflict) {
      return res.status(409).json({
        error: "Idempotency-Key was already used for a different endpoint",
        usedFor: prior.conflict,
      });
    }
    if (prior) return res.status(prior.statusCode).json({ ...prior.body, idempotentReplay: true });

    let sent = null;
    const capture = {
      status(code) { this._code = code; return this; },
      json(body) { sent = { code: this._code || 200, body }; return this; },
    };
    handler(capture);
    if (!sent) return;
    // Only a success is replayable. Replaying a 4xx would pin a transient rejection (a cap that
    // has since reset) as this key's permanent answer.
    if (sent.code >= 200 && sent.code < 300) recordResponse(req.user.id, key, endpoint, sent.code, sent.body);
    return res.status(sent.code).json(sent.body);
  }

  const BROWSER_FAILURE_CODES = [
    "browser_runtime_missing_dependency",
    "browser_binary_not_found",
    "browser_launch_failed",
  ];
  const isBrowserFailure = (reasonCode) => BROWSER_FAILURE_CODES.includes(reasonCode);

  function logEvent(runId, runJobId, userId, jobId, event, message, details = null) {
    try {
      db.prepare(`
        INSERT INTO apply_job_logs (run_id, run_job_id, user_id, job_id, event, message, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(runId, runJobId, userId, String(jobId), event, message, details ? JSON.stringify(details) : null);
    } catch (e) {
      console.warn("[applyRoutes] logEvent error:", e.message);
    }
  }

  // ── Audit persistence ────────────────────────────────────────────────────────
  // These seven were written by ONE UPDATE inside ONE try/catch, so a single missing column — an
  // un-migrated deployment, or a stale fixture — threw and silently discarded EVERY audit field
  // while the run still reported success. The columns are resolved against the live schema instead,
  // so a missing one costs only itself; it is named once per process; and the facts are written to
  // apply_job_logs as well, so the record survives even if no column exists at all.
  const AUDIT_COLUMNS = [
    "answers_json", "resume_artifact_id", "resume_ats_score",
    "screenshot_path", "submit_verified", "submit_evidence", "open_questions_json",
    // 088, AF5's campaign record. Resolved against the live schema like the rest, so a missing one
    // costs only itself.
    "fields_discovered",
    // 091, AH5's fill log. The BLANK half of what the run did — answers_json has always held the
    // filled half. Without it the record could say "7 fields filled" and nothing about the rest.
    "blanks_json",
  ];

  // corrections_json is written OUTSIDE persistAudit — the human's edits arrive after the audit row
  // is complete — so it needs its own presence check.
  let correctionsColumnCache = null;
  function canRecordCorrections() {
    if (correctionsColumnCache !== null) return correctionsColumnCache;
    let present = false;
    try {
      present = db.prepare("PRAGMA table_info(apply_run_jobs)").all().some(c => c.name === "corrections_json");
    } catch (e) {
      console.warn("[applyRoutes] could not read apply_run_jobs schema:", e.message);
    }
    if (!present) {
      console.warn(
        "[applyRoutes] CAMPAIGN RECORD DEGRADED — apply_run_jobs is missing corrections_json. " +
        "Hand corrections will not be recorded; run migrations (088 adds it). The application is unaffected."
      );
    }
    correctionsColumnCache = present;
    return present;
  }
  let auditColumnsCache = null;

  function auditColumns() {
    if (auditColumnsCache) return auditColumnsCache;
    let present = [];
    try {
      const live = new Set(db.prepare("PRAGMA table_info(apply_run_jobs)").all().map(c => c.name));
      present = AUDIT_COLUMNS.filter(c => live.has(c));
    } catch (e) {
      console.warn("[applyRoutes] could not read apply_run_jobs schema:", e.message);
    }
    const missing = AUDIT_COLUMNS.filter(c => !present.includes(c));
    if (missing.length) {
      console.warn(
        `[applyRoutes] AUDIT DEGRADED — apply_run_jobs is missing: ${missing.join(", ")}. ` +
        `Those fields will not be queryable; run migrations (073 adds open_questions_json). ` +
        `The full payload is still recorded in apply_job_logs as an 'audit_recorded' event.`
      );
    }
    auditColumnsCache = present;
    return present;
  }

  /** Write whatever audit columns this schema actually has. Returns what was written and skipped. */
  function persistAudit(runJobId, values) {
    const cols = auditColumns();
    const skipped = AUDIT_COLUMNS.filter(c => !cols.includes(c));
    if (!cols.length) return { written: [], skipped };
    try {
      db.prepare(`UPDATE apply_run_jobs SET ${cols.map(c => `${c}=?`).join(", ")} WHERE id=?`)
        .run(...cols.map(c => values[c]), runJobId);
      return { written: cols, skipped };
    } catch (e) {
      // Unexpected (the columns were verified present). Still not fatal: the event carries the data.
      console.warn("[applyRoutes] audit persist failed:", e.message,
        "— payload retained in apply_job_logs");
      return { written: [], skipped: AUDIT_COLUMNS, error: e.message };
    }
  }

  // ── Gate packets (TASK G1) ───────────────────────────────────────────────────
  // Persisted when a run observes a login wall or a CAPTCHA. The packet is everything already
  // decided, waiting for the human who will cross that gate.
  //
  // NO TOKEN IS MINTED HERE, deliberately, and this departs from §3's step ordering. A token with a
  // minutes-long TTL — which requirement 3 asks for, because it unlocks a home address and
  // eligibility answers — minted when the gate is observed would be expired long before the
  // candidate reads the notification and clicks Review. Either the TTL becomes hours, or the token is
  // minted on demand. Minting on demand is the one that keeps the short TTL meaningful, so the row is
  // created with a placeholder hash that no real token can ever match and an already-past expiry,
  // meaning "no outstanding token" until /token is called.
  const GATE_PACKET_NO_TOKEN = () => `unminted:${crypto.randomUUID()}`;

  /**
   * ⭐ O80c (owner, 10-07: "packets should carry a resume — that's the whole point"). A packet is the
   * candidate finishing the application themselves; without a résumé the extension fills the answers and
   * leaves the upload empty. A preview DEFERS generation to approval (AL2) — but a packet never reaches an
   * approval, so its résumé was never written (O73b). Attached here, after the packet is stored, in the
   * background: a CURRENT artifact is reused (no model call); otherwise the one generation D17 allows.
   * ⛔ No extra Draft slot — like the approval's generation, it is the same Draft continuing.
   * ⛔ The kill switch is read right before the model call. ⛔ Never changes the hold's outcome: a failure
   * is logged and the packet stays as it was, still fillable, still retryable (Prepare again).
   */
  async function attachPacketResume({ packetId, runId, runJobId, userId, jobId, toolType = "generate", allowGenerate = true }) {
    // ⭐ D66: base-résumé-only → the packet carries the base résumé, whatever tailored one exists, and
    // nothing is generated. Its work history and skills are read from that résumé (D65).
    if (baseResumeOnlyState(db, userId).on) {
      if (!activeBaseResume(db, userId)) {
        logEvent(runId, runJobId, userId, jobId, "packet_resume_absent",
          "Base-résumé-only is on and there is no base résumé — the handoff fills your answers; attach a résumé yourself.");
        return { ok: false, reason: "no_base_resume" };
      }
      const entries = packetEntriesFor(userId, null);
      db.prepare(`UPDATE apply_gate_packets SET resume_artifact_id=NULL,
          answers_json=json_set(json_set(answers_json, '$.resumeSource', 'base'), '$.entries', json(?))
        WHERE id=? AND user_id=? AND consumed_at IS NULL`).run(JSON.stringify(entries || {}), packetId, userId);
      try { refreshPacketWorkedHere(packetId, userId, entries); } catch { /* the answer stays as built */ }
      logEvent(runId, runJobId, userId, jobId, "packet_resume_ready", `The handoff carries your ${BASE_RESUME_LABEL.toLowerCase()}`,
        { resumeArtifactId: null, resumeSource: "base" });
      return { ok: true, artifactId: null, base: true };
    }
    const cur = artifactCurrency(db, { userId, jobId, tool: toolType });
    let artifactId = cur.current ? (cur.artifact?.id ?? null) : null;
    let atsScore = cur.current ? (cur.artifact?.ats_score ?? null) : null;
    // D56: a packet prepared ON DEMAND (the extension's "Prepare this application", or the manual
    // route's own generation) reuses the résumé the user made and never starts a model call — a
    // generation from the manual route is the user's own act and uses a Draft slot (A63), which a
    // click on an employer's page must not spend behind their back. Said, not swallowed.
    if (artifactId == null && !allowGenerate) {
      logEvent(runId, runJobId, userId, jobId, "packet_resume_absent",
        cur.artifact ? `Your résumé for this job is out of date (${cur.detail || cur.reason}) — the handoff fills without it.`
                     : "No résumé made for this job yet — the handoff fills your answers; attach a résumé yourself.");
      return { ok: false, reason: cur.artifact ? "resume_not_current" : "no_resume" };
    }
    if (artifactId == null) {
      if (fullAutoDisabled()) {
        logEvent(runId, runJobId, userId, jobId, "packet_resume_skipped",
          "Paused by the operator — no résumé was written for this handoff. Prepare it again once resumed.");
        return { ok: false, reason: "paused" };
      }
      logEvent(runId, runJobId, userId, jobId, "packet_resume_started", "Writing the résumé for this handoff");
      let gen;
      try { gen = await generateResumeForApply(userId, jobId, toolType); }
      catch (e) { gen = { error: e.message }; }
      if (!gen?.html || gen.resumeId == null) {
        logEvent(runId, runJobId, userId, jobId, "packet_resume_failed",
          gen?.errorDetail || gen?.error || "Résumé generation returned no résumé — the handoff fills without one.",
          { errorCode: gen?.errorCode ?? null });
        return { ok: false, reason: gen?.errorCode || "generation_failed" };
      }
      artifactId = gen.resumeId; atsScore = gen.atsScore ?? null;
    }
    db.prepare(`UPDATE apply_gate_packets SET resume_artifact_id=?,
        answers_json=json_set(answers_json, '$.resumeArtifactId', ?)
      WHERE id=? AND user_id=? AND consumed_at IS NULL`).run(artifactId, artifactId, packetId, userId);
    db.prepare(`UPDATE apply_run_jobs SET resume_artifact_id=COALESCE(resume_artifact_id, ?),
        resume_ats_score=COALESCE(resume_ats_score, ?) WHERE id=? AND user_id=?`).run(artifactId, atsScore, runJobId, userId);
    // ⭐ D65: the packet was built before this résumé existed, so its work history and skills were read
    // from the base résumé. Now that it carries this one, they are re-read from it.
    try {
      const entries = packetEntriesFor(userId, artifactId);
      if (entries) db.prepare(`UPDATE apply_gate_packets SET answers_json=json_set(answers_json, '$.entries', json(?))
          WHERE id=? AND user_id=? AND consumed_at IS NULL`).run(JSON.stringify(entries), packetId, userId);
      // D65 residual: "have you worked here?" is re-read from the same résumé.
      refreshPacketWorkedHere(packetId, userId, entries);
    } catch { /* fewer entries, never a lost résumé link */ }
    logEvent(runId, runJobId, userId, jobId, "packet_resume_ready",
      cur.current ? "The handoff carries your current résumé for this job" : "The handoff carries a résumé written for this job",
      { resumeArtifactId: artifactId, reused: !!cur.current, atsScore });
    return { ok: true, artifactId, reused: !!cur.current };
  }

  /**
   * D55 (b): the packet's repeating-section entries (education / work / languages / websites /
   * skills), from what this candidate has STATED — the profile row and the base résumé. Never allowed
   * to cost a packet: an older schema (no base_resume table, no confirmed_skills column) or an
   * unparseable résumé yields fewer entries, never a thrown packet build.
   */
  // ⭐ D65 (owner, 10-07): work history and skills come from the résumé the packet CARRIES — `resumeId`
  // (the packet's resume_artifact_id), else the base résumé — parsed once and stored with it
  // (services/payloadResume.js, migration 138). User-claimed skills are added. With no résumé at all
  // (an answers-only packet) the profile's current role is the one work entry, as before.
  // ⭐ T18 / T23: the BASE résumé's parse (the active profile's, else the account's — payloadResumeParse with no
  // tailored id), whose stated facts fill what the profile left empty (applyGatePacket.js resumeAnswers). null when
  // there is none or it read nothing.
  function baseResumeParsed(userId) {
    try { const p = payloadResumeParse(db, { userId, resumeId: null }); return p?.ok ? p.structured : null; } catch { return null; }
  }

  function packetEntriesFor(userId, resumeId = null) {
    let profile = null, payload = null;
    try { profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || null; } catch { /* no profile table */ }
    try { payload = payloadResumeParse(db, { userId, resumeId }); } catch { payload = null; }
    let entries;
    try { entries = buildPacketEntries({ profile, payload }); } catch { return null; }
    // D112 d2: the Education entries are the Profile's Education SECTION, not the old one-degree block (null before 173).
    const edu = educationEntries(db, userId);
    if (entries && edu) entries.education = edu;
    return entries;
  }

  // ⭐ D65 residual · "HAVE YOU WORKED HERE BEFORE?" READS THE RÉSUMÉ THE PACKET CARRIES. The autofill
  // payload is built before the packet's résumé is known, so its worked_here history came from the BASE
  // résumé — a tailored résumé that dropped a role still answered Yes for that employer. The history is
  // re-derived from the packet's own entries.work (the carried résumé's parse) plus the profile's
  // current_company, the same workHistoryCompanies rule as before. No entries → the payload unchanged.
  function withCarriedWorkHistory(userId, autofillPayload, entries) {
    const wh = autofillPayload?.worked_here;
    if (!wh || !entries) return autofillPayload;
    let profile = null;
    try { profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || null; } catch { /* no profile table */ }
    return { ...autofillPayload,
      worked_here: { company: wh.company ?? null, history: workHistoryCompanies({ profile, work: entries.work || [] }) } };
  }
  // ⭐ D96 §4: the keyed lifecycle answers (migration 164) ride on the payload, so a packet's savedAnswers carry only
  // ACKNOWLEDGED answers, each with its source and date (services/answerLifecycle.js packetLifecycleAnswers).
  function withSavedAnswerRecords(userId, autofillPayload) {
    let inputs = { records: [], legacyAcknowledgedAt: null };
    try { inputs = lifecycleInputs(db, userId); } catch { /* no lifecycle table: the label-only answers, as before */ }
    return { ...autofillPayload, saved_answer_records: inputs.records, saved_answers_legacy_at: inputs.legacyAcknowledgedAt };
  }
  // ⭐ D96 §4: a STORED packet's savedAnswers are re-derived whenever it is released or shown, so a change or a delete
  // since it was prepared takes effect at once (the old value is no longer auto-used) and a new acknowledgement is in.
  function withLiveSavedAnswers(userId, body, jobId) {
    if (!body || typeof body !== "object") return body;
    try {
      let company = body.workedHere?.company ?? null;
      if (!company && jobId != null) {
        try { company = db.prepare("SELECT company FROM scraped_jobs WHERE job_id=?").get(String(jobId))?.company ?? null; } catch { /* no jobs table */ }
      }
      const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
      const live = packetSavedAnswers(withSavedAnswerRecords(userId, buildAutofillPayload(profile, "APPLY", company, jobId))).savedAnswers;
      const { savedAnswers: _old, ...rest } = body;
      return live?.length ? { ...rest, savedAnswers: live } : rest;
    } catch (e) {
      console.warn(`[applyRoutes] live saved answers job=${jobId}: ${e.message}`);
      return body;
    }
  }
  // …and once attachPacketResume knows the résumé, the stored packet's workedHere is rebuilt from it.
  function refreshPacketWorkedHere(packetId, userId, entries) {
    if (!entries) return;
    const row = db.prepare("SELECT answers_json FROM apply_gate_packets WHERE id=? AND user_id=? AND consumed_at IS NULL")
      .get(packetId, userId);
    let company = null;
    try { company = JSON.parse(row?.answers_json || "null")?.workedHere?.company ?? null; } catch { /* unreadable packet: leave it */ }
    if (!company) return;
    const wh = packetSavedAnswers(withCarriedWorkHistory(userId, { worked_here: { company, history: [] } }, entries)).workedHere;
    if (wh) db.prepare(`UPDATE apply_gate_packets SET answers_json=json_set(answers_json, '$.workedHere', json(?))
        WHERE id=? AND user_id=? AND consumed_at IS NULL`).run(JSON.stringify(wh), packetId, userId);
  }

  function createGatePacket({ runId, runJobId, userId, jobId, result, autofillPayload, resumeArtifactId,
                             reasonCode, jobUrl, toolType = "generate" }) {
    // Where the human has to go, most-specific first:
    //   gate.applyUrl   the URL a gate was observed at — a gated portal redirects to a sign-in on
    //                   the way, so this is not what the run was queued with.
    //   landedUrl       AB1: the URL a HELD form was actually on. A held review had neither of the
    //                   two above, which is precisely why it never got a packet and so had no route
    //                   to submission.
    //   jobUrl          the posting's own apply link, as a floor.
    const applyUrl = result.gate?.applyUrl || result.landedUrl || result.gate?.startedFrom || jobUrl || null;
    let packet;
    try {
      const entries = packetEntriesFor(userId, resumeArtifactId);
      packet = buildGatePacket({
        resolvedAnswers: result.answers,
        autofillPayload: withSavedAnswerRecords(userId, withCarriedWorkHistory(userId, autofillPayload, entries)),
        baseResume: baseResumeParsed(userId),
        applyUrl,
        jobId, runId, runJobId,
        resumeArtifactId,
        // The row's OWN reason, not a default of "login_required": the reason is what tells the
        // panel whether this packet amortises across a portal or belongs to one application, and
        // mislabelling a held review as a login wall would put it in the wrong group and promise
        // that a sign-in clears it.
        gateReason: reasonCode || result.reasonCode || "login_required",
        entries,
      });
    } catch (e) {
      // buildGatePacket refuses in exactly two cases, and both leave the run held with no packet —
      // a degraded handoff, which is the honest outcome:
      //   gate_packet_unparseable_url  no expected origin, so it could only be released by trusting
      //                                whatever page it landed on.
      //   gate_packet_no_answers       nothing to fill, so "Open & fill" would promise work that
      //                                cannot happen (AE2).
      logEvent(runId, runJobId, userId, jobId, "gate_packet_failed",
        "Could not prepare a handoff packet for this gate", { reasonCode: e.reasonCode || null, error: e.message });
      return null;
    }

    try {
      const ins = db.prepare(`
        INSERT INTO apply_gate_packets
          (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason,
           answers_json, resume_artifact_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(userId, runId, runJobId, String(jobId), packet.applyUrl, packet.expectedOrigin,
             packet.gateReason, JSON.stringify(packet), resumeArtifactId, GATE_PACKET_NO_TOKEN());

      const packetId = Number(ins.lastInsertRowid);
      // Counts, origins and provenance mix — never a value, and never a token. This event is the
      // durable record that a handoff was prepared, and it lands in the same log the rest of the
      // audit trail uses.
      logEvent(runId, runJobId, userId, jobId, "gate_packet_created",
        `Handoff packet prepared: ${packet.answers.length} answer(s) ready, ${packet.unresolved.length} for you to answer`, {
          packetId,
          gateReason:      packet.gateReason,
          expectedOrigin:  packet.expectedOrigin,
          source:          packet.source,
          answerCount:     packet.answers.length,
          unresolvedCount: packet.unresolved.length,
          eligibilityCount: packet.answers.filter(a => a.eligibility).length,
          provenanceMix:   packet.answers.reduce((m, a) => { m[a.provenance ?? "none"] = (m[a.provenance ?? "none"] || 0) + 1; return m; }, {}),
          resumeArtifactId,
        });
      // ⭐ D100 P2: a SIGN-IN WALL on a portal the user connected (a sealed session, D79) is not handed back to them —
      // the apply worker leases it, loads the session and fills with this same packet. An approved run carries the
      // values the user approved (the worker verifies each before it submits); SEMI fills and stops at review.
      try {
        const rj = db.prepare("SELECT rj.status, r.approval_mode FROM apply_run_jobs rj LEFT JOIN apply_runs r ON r.id = rj.run_id WHERE rj.id = ?").get(runJobId);
        if (rj?.status === "held_gate") {
          const approvalMode = rj.approval_mode || "auto";
          const approvedValues = approvalMode === "approved"
            ? Object.fromEntries(packet.answers.filter(a => (a.field_id ?? a.name ?? a.label) != null)
                .map(a => [String(a.field_id ?? a.name ?? a.label), a.value == null ? null : String(a.value)]))
            : null;
          const remoteId = enqueueRemoteRun(db, { userId, runJobId, packetId, applyUrl: packet.applyUrl, approvalMode, approvedValues });
          if (remoteId) logEvent(runId, runJobId, userId, jobId, "remote_run_queued",
            "Your connected portal session will be used: the apply worker fills this application", { remoteId });
        }
      } catch (e) {
        console.warn(`[applyRoutes] remote run job=${jobId}: ${e.message}`);
      }
      // O80c: a packet without a résumé gets one, in the background (attachPacketResume).
      if (resumeArtifactId == null) {
        attachPacketResume({ packetId, runId, runJobId, userId, jobId, toolType })
          .catch(e => console.warn(`[applyRoutes] packet résumé job=${jobId}: ${e.message}`));
      }
      return { packetId, packet };
    } catch (e) {
      // Never let a packet failure change the run's outcome: the job is held either way, and a held
      // job with no packet is a degraded handoff rather than a lost application.
      logEvent(runId, runJobId, userId, jobId, "gate_packet_failed",
        "Handoff packet could not be stored", { error: e.message });
      console.warn("[applyRoutes] gate packet insert failed:", e.message);
      return null;
    }
  }

  /**
   * ⭐ D56 · THE MANUAL ROUTE PRODUCES A PACKET. A job the user made a résumé for by hand — or one the
   * extension's "Prepare this application" names — becomes PREPARED: the profile's answers (the same
   * canonical resolution a login wall gets) plus the user's current résumé, fillable without a Draft.
   * Draft is the queue for batches; manual is a one-off — both must fill.
   *
   * No run, no run-job: run_id and run_job_id are NULL, gate_reason 'prepared' (a per-application
   * handoff, handoffKind 'review'). ⛔ No model call and no Draft slot: the résumé attached is the one
   * the user already made (attachPacketResume, allowGenerate false). Re-preparing reuses a fresh packet
   * for the same résumé rather than stacking rows; a stale one is replaced, which is what makes
   * "Prepare this application" always available and never a dead end (D52 — a packet goes off in 72h).
   *
   * The origin list is NOT stored: it is derived from the packet's URLs and the adapter table on every
   * read (packetAddressing), so a packet prepared before a family was added gains it, and nothing a
   * request carries can widen it.
   */
  const PREPARED_REASON = "prepared";
  function prepareManualPacket({ userId, jobId, via = "extension", toolType = "generate" }) {
    const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId));
    if (!job) return { ok: false, error: "job_not_found", message: "draft no longer has this posting." };
    const cur = artifactCurrency(db, { userId, jobId, tool: toolType });
    // ⭐ D66: base-résumé-only — the packet carries the base résumé, not a tailored one.
    const baseOnly = baseResumeOnlyState(db, userId).on;
    const artifactId = !baseOnly && cur.current ? (cur.artifact?.id ?? null) : null;
    const resume = baseOnly ? (activeBaseResume(db, userId) ? "base" : "none")
      : artifactId != null ? "ready" : cur.artifact ? "out_of_date" : "none";
    const existing = db.prepare(`SELECT id, created_at, resume_artifact_id, answers_json FROM apply_gate_packets
      WHERE user_id=? AND job_id=? AND gate_reason=? AND consumed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`)
      .get(userId, String(jobId), PREPARED_REASON);
    // ⭐ T18: a packet built with an older answer set (before the vocabulary and the base résumé's facts) is re-made.
    const currentAnswers = (parseJson(existing?.answers_json, {})?.answersVersion ?? 1) >= PACKET_ANSWERS_VERSION;
    if (existing && currentAnswers && !packetFreshness(toMs(existing.created_at)).stale && (existing.resume_artifact_id ?? null) === artifactId) {
      return { ok: true, packetId: existing.id, reused: true, resume };
    }
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
    const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId);
    let packet;
    try {
      const entries = packetEntriesFor(userId, artifactId);
      packet = buildGatePacket({
        autofillPayload: withSavedAnswerRecords(userId, withCarriedWorkHistory(userId, buildAutofillPayload(profile, "APPLY", job.company, jobId), entries)),
        applyUrl: job.apply_url || job.url, jobId: String(jobId),
        resumeArtifactId: artifactId, gateReason: PREPARED_REASON,
        entries,
        baseResume: baseResumeParsed(userId),
      });
    } catch (e) {
      return { ok: false, error: e.reasonCode || "prepare_failed",
        message: e.reasonCode === "gate_packet_no_answers"
          ? "Your profile has nothing to fill yet — add your name and email in Settings, then prepare again."
          : "This posting has no address draft can fill on." };
    }
    const ins = db.prepare(`
      INSERT INTO apply_gate_packets
        (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason,
         answers_json, resume_artifact_id, token_hash, expires_at)
      VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(userId, String(jobId), packet.applyUrl, packet.expectedOrigin, PREPARED_REASON,
           JSON.stringify(packet), artifactId, GATE_PACKET_NO_TOKEN());
    const packetId = Number(ins.lastInsertRowid);
    logEvent(null, null, userId, jobId, "gate_packet_created",
      `Prepared ${via === "generate" ? "with the résumé you generated" : "on demand"}: ${packet.answers.length} answer(s) ready, ${packet.unresolved.length} for you to answer`,
      { packetId, gateReason: PREPARED_REASON, via, expectedOrigin: packet.expectedOrigin,
        answerCount: packet.answers.length, unresolvedCount: packet.unresolved.length, resumeArtifactId: artifactId });
    if (artifactId == null) {
      attachPacketResume({ packetId, runId: null, runJobId: null, userId, jobId, toolType, allowGenerate: false })
        .catch(e => console.warn(`[applyRoutes] prepared packet résumé job=${jobId}: ${e.message}`));
    }
    return { ok: true, packetId, reused: false, resume };
  }

  async function processRunJob(runJob, run) {
    const { id: runJobId, run_id: runId, job_id: jobId, user_id: userId } = runJob;
    const mode = run.mode || "auto";
    // Queue-then-approve. NULL approval_mode means the run predates the flow, and those rows
    // submitted — so NULL keeps submitting rather than silently changing what old runs did.
    const approvalMode  = run.approval_mode || "auto";
    const needsApproval = mode === "auto" && approvalMode === "required";

    // ── AL2: GENERATION IS DEFERRED TO APPROVAL ──────────────────────────────────────────────
    //
    // Generation costs ~$0.04 on Sonnet. Swiping costs ~1 second, so five idle minutes of swiping
    // was ~60 jobs and ~$2.40 spent by a gesture that decided nothing — the user had not seen the
    // application, and had not approved sending it.
    //
    // ⛔ ONLY THE PREVIEW PATH DEFERS, and the other two keep generating exactly when they did:
    //   needsApproval (auto + approval_mode 'required')  DEFER. A human will see this before it is
    //                                                    sent, so the spend can wait for them.
    //   mode 'semi'                                      DO NOT defer. A live human is standing at
    //                                                    an open browser; a resume that does not
    //                                                    exist yet cannot be uploaded, and the
    //                                                    hold it produces ('manual_review') is not
    //                                                    approvable in the first place.
    //   approval_mode 'auto' / 'approved'                DO NOT defer. Nobody is going to approve
    //                                                    it later — 'auto' has opted out of review
    //                                                    and 'approved' IS the approval.
    //
    // The per-profile escape hatch is DEFAULT OFF, per requirement 3: this is the owner's testing
    // switch for restoring the old behaviour, not a setting users are expected to find.
    // ALIASED ON PURPOSE (`dp`), and it is not a style choice. test/harnessSchemaCoverage.test.js
    // discovers which columns these routes read by finding `FROM <table> <alias>` and then sweeping
    // for `alias.column`; an unaliased SELECT list is invisible to it, so this query produced NO
    // required-column entry and the guard skipped domain_profiles entirely — passing vacuously
    // while a9ApprovalFlow died on `no such column: generate_at_queue`.
    // TASK H — every platform's CONFIRMED derived mappings, loaded once per run-job. Injected into
    // autoApply because that module has no database handle by design, and merged BENEATH the
    // authored label map so a derived entry can only ever fill a gap it does not already cover.
    const derivedLabelMaps = loadAllConfirmedMappings(db);

    const generateAtQueue = !!db.prepare(`
      SELECT dp.generate_at_queue FROM domain_profiles dp
      WHERE dp.user_id=? AND dp.is_active=1 ORDER BY dp.id DESC LIMIT 1
    `).pluck().get(userId);
    // ⛔⛔ D165 R1 (owner 11-06, "the semi run failed miserably, didnt even trigger a resume generation"): THE RÉSUMÉ IS
    // NEVER THE PERSON'S JOB. An *Ask me first* run (approval required) used to take CASE D — fill the form with NO résumé
    // and write it only on approval (AL2, to save ≈ $0.04 per unapproved preview) — so the person met an application
    // "held: Resume left empty". It now generates like every other run (CASE C: in parallel with the browser, the upload
    // step awaits it, the artifact recorded on the attempt, a failure held with its reason). AL2's deferral survives only
    // as an OPERATOR switch, off unless DRAFT_DEFER_PREVIEW_GENERATION=1; the per-profile toggle is gone.
    const deferGeneration = needsApproval && !generateAtQueue && process.env.DRAFT_DEFER_PREVIEW_GENERATION === "1";
    // 'preview' is full-auto minus the click; 'semi' opens a visible browser for a live human.
    const applyMode = mode !== "auto" ? "semi" : needsApproval ? "preview" : "full";
    // D36 · the kill switch reaches a run ALREADY IN FLIGHT. Read at the moment before the click
    // (autoApply's submitBlocker), not only here at the job's start — a full or approved run fills
    // and waits on generation for up to ~90 s, and the switch thrown in that window used to be
    // ignored. Only for the mode that clicks: a preview never submits and semi leaves it to a human.
    const submitBlocker = applyMode === "full"
      ? () => (fullAutoDisabled() ? "full_auto_disabled" : null)
      : null;
    // What the human approved, if this run exists because of an approval. autoApply refuses to
    // submit anything that differs from it.
    const approvedAnswers = runJob.approved_from_run_job_id
      ? parseJson(db.prepare("SELECT answers_json FROM apply_run_jobs WHERE id=? AND user_id=?")
          .get(runJob.approved_from_run_job_id, userId)?.answers_json, null)
      : null;
    let resumeTmpPath = null;
    let coverLetterTmpPath = null;
    // Which resume artifact was actually sent. The temp PDF is deleted in `finally`, so the
    // reconstructable reference is the resumes row it was rendered from (requirement 3).
    let usedArtifactId = null;
    let usedAtsScore   = null;
    // AH5: whether this run reused the candidate's existing resume or rebuilt it, and why. Read
    // back by the fill log, so "no regeneration happened" is a fact the surface can state rather
    // than something the candidate has to trust.
    let reuseDecision  = null;
    // Set when resume generation fails, so the run's terminal reason can name GENERATION rather
    // than inheriting whatever failed last. Resume generation runs in parallel with the browser,
    // so without this the browser's outcome silently wins the attribution race.
    let genFailure = null;
    // D36: set when the résumé WAS generated but its PDF could not be made. Without it the run
    // reported `resume_unavailable` — "No resume was generated" — which sends the user to generate
    // a résumé they already have. Ranked just below genFailure in the attribution below.
    let docFailure = null;
    const resumePdfFailure = (e) => ({
      reasonCode: "resume_pdf_failed",
      detail: `The résumé was written but could not be turned into a PDF to attach: ${String(e?.message || e).slice(0, 300)}`,
    });

    /**
     * Write a terminal status — unless the user has ABORTED this run-job (TASK AC4).
     *
     * `AND status != 'cancelled'` is the whole guard, and it has to be in the WHERE clause rather
     * than in a read-then-write: the abort endpoint and this worker are different call stacks, and
     * a check followed by an update loses the race the guard exists to win. better-sqlite3 is
     * synchronous, so one statement is one atomic decision.
     *
     * Without it, aborting mid-flight closes the browser, the run throws, the catch writes 'failed',
     * and the row the user just stopped comes back as a failure with a Retry button on it.
     */
    const setJobStatus = (status, reasonCode = null, reasonDetail = null) => {
      db.prepare(`
        UPDATE apply_run_jobs
        SET status=?, reason_code=?, reason_detail=?, finished_at=unixepoch()
        WHERE id=? AND status != 'cancelled'
      `).run(status, reasonCode, reasonDetail, runJobId);
    };

    try {
      // Aborted between being queued and being picked up. processRun snapshots the queued rows
      // before it starts launching them, so a job cancelled in that window is still in its list —
      // and would otherwise open a browser and fill a real employer's form after the user stopped
      // it. The abort endpoint has already written 'cancelled'; this just declines to undo it.
      const beforeStart = db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").get(runJobId);
      if (beforeStart?.status === "cancelled") {
        logEvent(runId, runJobId, userId, jobId, "run_job_cancelled",
          "Cancelled before it started. Nothing was opened and nothing was submitted.");
        return;
      }
      db.prepare(`UPDATE apply_run_jobs SET status='running', started_at=unixepoch() WHERE id=? AND status != 'cancelled'`).run(runJobId);

      const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId));
      if (!job) { setJobStatus("failed", "job_not_found", "Job not found in DB"); return; }

      // ⛔ D124 · THE SAFETY RULE: a sample résumé (a fictional person) never reaches a real employer — its run fills draft's
      // practice form for this posting instead (services/trial.js). Keyed on the active résumé, not on the account's trial flag.
      const practiceUrl = trialSendUrl(db, { userId, jobId: String(jobId), baseUrl: practiceBaseUrl(), secret: practiceSecret() });
      const jobUrl = practiceUrl || job.apply_url || job.url;
      if (!jobUrl) { setJobStatus("failed", "no_job_url", "Job has no apply URL"); return; }
      if (practiceUrl) logEvent(runId, runJobId, userId, jobId, "practice_form", "A sample résumé: this Draft goes to draft's practice form, never to the employer.");

      /**
       * Park a handoff for a hold that RETURNS EARLY, before the browser ever runs (AB1).
       *
       * Six holds below never reach the main terminal path: the provider is out of v1 scope, the
       * kill switch is on, the daily cap is spent, the resume scored under the floor, generation
       * failed. Every one of them is a held_review whose intended route is the human — and every one
       * of them used to leave the candidate a row with nothing on it but a reason, because the
       * packet was built only at the end of a browser run they never got.
       *
       * A profile-only packet is exactly the case buildGatePacket was designed for: no form was
       * reached, so it resolves the canonical question set against the profile and reports what it
       * could not answer, rather than inventing provenance. That is the same thing a login wall
       * produces, and it is enough to fill a name, an address and eligibility answers in the
       * candidate's own browser.
       *
       * Never allowed to change the outcome: the hold has already been written, and a packet failure
       * is a degraded handoff rather than a lost application.
       */
      const parkEarlyHandoff = (reasonCode) => {
        try {
          db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
          const p = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId);
          createGatePacket({
            runId, runJobId, userId, jobId,
            result: {}, autofillPayload: buildAutofillPayload(p, "APPLY", job?.company, jobId),
            // run.tool_type, not toolType: the early holds run BEFORE `const toolType` is declared below,
            // and reading it here would throw (TDZ) inside this try — losing the packet silently.
            resumeArtifactId: usedArtifactId, reasonCode, jobUrl, toolType: run.tool_type || "generate",
          });
        } catch (e) {
          console.warn("[applyRoutes] early handoff packet failed:", e.message);
        }
      };

      // v1 provider scope: only greenhouse/lever/ashby get full-auto; others fall to held_review.
      // Re-checked per job, not just at admission: a run can cross the daily cap mid-flight, and
      // the kill switch can be flipped while a run is in progress. Both HOLD the job with a
      // reasonCode — visible in /api/apply/review — rather than dropping it silently.
      // D36 → D100: the same rule as startRun's, at the door that cannot be walked around — boot recovery,
      // the line and any hand-written row all arrive here. NULL approval_mode reads as 'auto' above.
      // Sending without review is the user's FULL AUTO mode; a user in SEMI is held, nothing opened.
      // ⭐ D113: …unless the user tapped Apply on THIS job in a picks message — that tap is their send (services/picks.js).
      if (mode === "auto" && approvalMode === "auto" && userApplyMode(userId) !== "auto" && !pickAuthorisesSend(db, userId, jobId)) {
        logEvent(runId, runJobId, userId, jobId, "full_auto_not_chosen",
          "Held: this run would have sent without your review, and your mode is SEMI. Nothing was opened or sent.");
        setJobStatus("held_review", "full_auto_not_chosen",
          "Sending without review needs FULL AUTO, and your mode is SEMI. Nothing was opened or sent.");
        db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
        return;
      }
      if (mode === "auto" && fullAutoDisabled()) {
        logEvent(runId, runJobId, userId, jobId, "full_auto_disabled",
          "Full-auto submission is disabled; holding for manual review");
        setJobStatus("held_review", "full_auto_disabled", "Automatic submission is currently disabled");
        db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
        parkEarlyHandoff("full_auto_disabled");
        return;
      }
      if (mode === "auto") {
        const usedToday = submittedLast24h(userId);
        if (usedToday >= APPLY_DAILY_CAP) {
          logEvent(runId, runJobId, userId, jobId, "daily_cap_reached",
            `Daily cap reached: ${usedToday} of ${APPLY_DAILY_CAP} in the last 24h`, { submittedLast24h: usedToday, limit: APPLY_DAILY_CAP });
          setJobStatus("held_review", "daily_cap_reached", `Daily application cap (${APPLY_DAILY_CAP}) reached`);
          db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
          parkEarlyHandoff("daily_cap_reached");
          return;
        }
      }

      const V1_AUTO_PROVIDERS = new Set(["greenhouse", "lever", "ashby"]);
      if (mode === "auto") {
        const detectedProvider = detectPlatformFromUrl(jobUrl);
        // ⭐ D100 P5 (43s, found by the Amazon test): a portal outside v1's scope that the user CONNECTED (a sealed session)
        // or asked draft to make an account on is the apply worker's — not a review hold. This hold used to run BEFORE any
        // page was opened, so the sign-in wall that hands a run to the worker was never reached and the worker could never
        // be used on Amazon. It is a gate (held_gate · login_required): the packet is made and the remote run queued exactly
        // as at a sign-in wall; SEMI fills and stops at review, FULL AUTO's rules are the worker's lease checks.
        const portalHost = hostOf(jobUrl);
        if (!V1_AUTO_PROVIDERS.has(detectedProvider) && portalHost
            && (sessionForHost(db, userId, portalHost) || accountForHost(db, userId, portalHost))) {
          logEvent(runId, runJobId, userId, jobId, "portal_worker",
            `Provider '${detectedProvider || "unknown"}' — your ${portalHost} portal is connected; the apply worker takes it`);
          setJobStatus("held_gate", "login_required", "Your connected portal will be used — the apply worker fills this application");
          db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
          parkEarlyHandoff("login_required");
          return;
        }
        if (!V1_AUTO_PROVIDERS.has(detectedProvider)) {
          logEvent(runId, runJobId, userId, jobId, "provider_review_only",
            `Provider '${detectedProvider || "unknown"}' not in v1 auto-apply scope; routing to review`);
          setJobStatus("held_review", "provider_review_only",
            `Provider ${detectedProvider || "unknown"} not supported for full-auto in v1`);
          db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
          parkEarlyHandoff("provider_review_only");
          return;
        }
      }

      db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
      const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId);
      // The employer is passed so `{company}`-templated custom answers resolve for THIS company.
      const autofillPayload = buildAutofillPayload(profile, "APPLY", job?.company, jobId);

      /**
       * AF5's correction record. A semi run returns while the browser is still open, so the human's
       * edits arrive AFTER the audit block below has already written the row — which is why this
       * writes on its own, once per reported change, last-write-wins.
       *
       * Guarded on the column existing for the same reason the override column is: an un-migrated
       * deployment must lose the campaign note, not the application.
       */
      const recordCorrections = (corrections) => {
        if (!Array.isArray(corrections) || !canRecordCorrections()) return;
        try {
          db.prepare("UPDATE apply_run_jobs SET corrections_json=? WHERE id=?")
            .run(corrections.length ? JSON.stringify(corrections) : null, runJobId);
          logEvent(runId, runJobId, userId, jobId, "corrections_observed",
            `${corrections.length} field(s) corrected by hand`,
            { corrections: corrections.map(c => ({
                field: c.field, provenance: c.provenance, confidence: c.confidence })) });
        } catch (e) {
          console.warn(`[applyRoutes] correction record failed job=${jobId}: ${e.message}`);
        }
      };

      const toolType = run.tool_type || "generate";

      /**
       * AH5: reuse what the candidate already generated — but only while it is still CURRENT.
       *
       * This used to be its own `SELECT ... FROM resumes ORDER BY updated_at DESC`, a second query
       * with no rule beside generateResumeForApply's. Both reused unconditionally, so an artifact
       * built under a different job profile, or from a base resume the candidate had since
       * rewritten, was sent to an employer with nothing saying so. services/resumeCurrency.js is
       * now the one definition; a stale artifact falls through to CASE B/C, which regenerate.
       *
       * The decision is LOGGED either way. "Queued a job I already generated for and it
       * regenerated" and "it reused a resume I had replaced" are both things the candidate can only
       * find out if the run says so.
       */
      const currency = artifactCurrency(db, { userId, jobId, tool: toolType });
      reuseDecision = { reused: currency.current, reason: currency.reason, detail: currency.detail ?? null };
      // D36: a DEFERRED preview (CASE D below) writes nothing now, so "…so one was generated" was
      // false — and the run history printed it directly above "No resume generated yet". Said as
      // what will happen instead; the event name stays, so every reader of it is unchanged.
      const willDefer = !currency.current && mode !== "semi" && deferGeneration;
      logEvent(runId, runJobId, userId, jobId,
        currency.current ? "resume_reused" : "resume_regenerating",
        willDefer ? DEFERRED_RESUME_SENTENCE : currencySentence(currency),
        willDefer ? { ...reuseDecision, deferred: true } : reuseDecision);
      const artifact = currency.current ? currency.artifact : null;

      let result;

      if (artifact?.html) {
        // CASE A: a current artifact — ATS gate, then PDF convert and apply
        usedArtifactId = artifact.id ?? null;
        usedAtsScore   = artifact.ats_score ?? null;
        const atsScore = artifact.ats_score ?? null;
        // AK1 — AN UNKNOWN SCORE MUST HOLD, NOT PASS.
        //
        // This gate used to read `atsScore !== null && atsScore < THRESHOLD`, so a null score fell
        // through and auto-submitted. That was already wrong for a never-scored artifact, and it
        // became actively dangerous once the scorer gained the ability to DECLINE (returning null
        // when there is too little signal to judge): the one case where the engine says "I cannot
        // tell you if this is a good fit" was the one case that skipped the gate and applied on the
        // candidate's behalf. An auto-submit gate may only open on a score it has actually seen.
        if (mode === "auto" && (atsScore === null || atsScore < ATS_AUTO_APPLY_THRESHOLD)) {
          logEvent(runId, runJobId, userId, jobId, "ats_review",
            atsScore === null
              ? "Held: no ATS score for this artifact — auto-apply does not submit on an unknown score"
              : `ATS score ${atsScore} below threshold`,
            { atsScore });
          db.prepare(`UPDATE apply_run_jobs SET status='held_review', reason_code='ats_below_threshold', finished_at=unixepoch() WHERE id=?`).run(runJobId);
          db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
          // Held on the score before the browser ran. The candidate may well decide to send it
          // anyway, so they get a handoff rather than a dead row.
          parkEarlyHandoff("ats_below_threshold");
          return;
        }
        // D123 P6e (R9): the cover letter is written only when the form has a cover-letter upload — a paid Haiku
        // call per job for nothing otherwise. autoApply calls it at the first cover slot it finds (once, memoised).
        const clOnDemand = coverLetterOnDemand(() => generateCoverLetterForApply(userId, jobId).then(async (cl) => {
          if (!cl?.html) {
            logEvent(runId, runJobId, userId, jobId, "cover_letter_unavailable", cl?.error || "no cover letter");
            return null;
          }
          try {
            const pdfBuf = await htmlToPdf(cl.html);
            const tmpPath = tmpPdfPath("cl", userId, jobId);
            writeFileSync(tmpPath, pdfBuf);
            coverLetterTmpPath = tmpPath;
            return tmpPath;
          } catch { return null; }
        }).catch(() => null));
        const pdfBuf = await htmlToPdf(artifact.html);
        resumeTmpPath = tmpPdfPath("resume", userId, jobId);
        writeFileSync(resumeTmpPath, pdfBuf);
        logEvent(runId, runJobId, userId, jobId, "site_visit_started", "Opening application page in browser");
        result = await autoApply(jobUrl, autofillPayload, {
          derivedLabelMaps,
          mode: applyMode,
          jobId,
          resumePath: resumeTmpPath,
          coverLetterOnDemand: clOnDemand,
          approvedAnswers,
          onCorrections: recordCorrections,
          submitBlocker,
        });

      } else if (mode === "semi") {
        // CASE B: no artifact + semi (manual review) mode
        // Generation and browser run in parallel; browser starts immediately in semi mode
        // so the user can review the pre-filled form while generation completes in the background.
        logEvent(runId, runJobId, userId, jobId, "generation_started", "Starting resume generation in background");
        const genPromise = generateResumeForApply(userId, jobId, toolType).then(async (gen) => {
          if (!gen?.html) {
            // Was silent: a semi run whose generation failed looked identical to one that
            // succeeded, because neither recorded anything about the resume.
            genFailure = {
              reasonCode: gen?.errorCode || "generation_failed",
              detail: gen?.errorDetail || gen?.error || "Resume generation returned no HTML",
              permanent: gen?.errorPermanent ?? null,
            };
            logEvent(runId, runJobId, userId, jobId, "generation_failed",
              gen?.errorDetail || gen?.error || "Resume generation returned no HTML");
            return null;
          }
          // CASE A and CASE C both recorded which artifact they used; this branch never did, so the
          // review surface reported "no resume generated" for a resume that generateResumeForApply
          // had in fact written to the `resumes` table. The resume existed — the link to it did not.
          usedArtifactId = gen.resumeId ?? null;
          usedAtsScore   = gen.atsScore ?? null;
          logEvent(runId, runJobId, userId, jobId, "generation_ready", "Resume generation completed", { atsScore: gen.atsScore });
          try {
            const pdfBuf = await htmlToPdf(gen.html);
            const tmpPath = tmpPdfPath("resume", userId, jobId);
            writeFileSync(tmpPath, pdfBuf);
            resumeTmpPath = tmpPath;
            return tmpPath;
          } catch (e) {
            docFailure = resumePdfFailure(e);
            logEvent(runId, runJobId, userId, jobId, "resume_pdf_failed", docFailure.detail);
            return null;
          }
        });
        // D123 P6e (R9): only when the form asks for one (see CASE A).
        const coverLetterOnDemandCaseB = coverLetterOnDemand(() => generateCoverLetterForApply(userId, jobId).then(async (cl) => {
          if (!cl?.html) {
            logEvent(runId, runJobId, userId, jobId, "cover_letter_unavailable", cl?.error || "no cover letter");
            return null;
          }
          try {
            const pdfBuf = await htmlToPdf(cl.html);
            const tmpPath = tmpPdfPath("cl", userId, jobId);
            writeFileSync(tmpPath, pdfBuf);
            coverLetterTmpPath = tmpPath;
            return tmpPath;
          } catch { return null; }
        }).catch(() => null));
        logEvent(runId, runJobId, userId, jobId, "site_visit_started", "Opening application page for review");
        const browserPromise = autoApply(jobUrl, autofillPayload, {
          derivedLabelMaps,
          mode: "semi",
          jobId,
          resumePathPromise: genPromise,
          coverLetterOnDemand: coverLetterOnDemandCaseB,
          onCorrections: recordCorrections,
        });
        const [, applySettled] = await Promise.allSettled([genPromise, browserPromise]);
        result = applySettled.status === "fulfilled" ? applySettled.value : { status: "awaiting_user", fieldsFilled: 0 };
        db.prepare(`UPDATE apply_run_jobs SET status='held_review', reason_code='manual_review', finished_at=unixepoch() WHERE id=?`).run(runJobId);

        // This branch used to return here, before the audit block below — so a manual-review run
        // discarded everything it had just produced: the resolved answers WITH their provenance,
        // the resume artifact id, and the screenshot of the filled form. autoApply returns all
        // three; nothing read them. That is why the review surface could say "7 fields filled"
        // and then show nothing about WHICH fields, offer no resume, and offer no way to see what
        // the form looked like. The evidence was captured and thrown away.
        const semiAnswers = Array.isArray(result.answers) ? result.answers : [];
        const semiAudit = persistAudit(runJobId, {
          answers_json: semiAnswers.length ? JSON.stringify(semiAnswers) : null,
          resume_artifact_id: usedArtifactId,
          resume_ats_score: usedAtsScore,
          screenshot_path: result.screenshotPath || null,
          // Nothing was submitted — this run exists so a human can decide. Recording 0 rather than
          // null keeps "reviewed, not sent" distinguishable from "we have no idea".
          submit_verified: 0,
          submit_evidence: null,
          open_questions_json: Array.isArray(result.openQuestions) && result.openQuestions.length
            ? JSON.stringify(result.openQuestions) : null,
          // AH5: semi is the mode this task is about — the run returns with the browser open and
          // the candidate reading the form, so the record of what was left blank is the whole
          // value of the run.
          blanks_json: Array.isArray(result.blanks) ? JSON.stringify(result.blanks) : null,
          fields_discovered: Number.isFinite(result.fieldsDiscovered) ? result.fieldsDiscovered : null,
        });
        // ── AE6: SAY WHAT IS STILL THEIRS TO ANSWER ────────────────────────────────────────
        // A semi run runs neither the completeness gate nor the low-confidence gate, so the human's
        // reading of the form is the only check there is. That is a defensible product decision;
        // being SILENT about it is not. autoApply now returns `missingRequired` on a semi result —
        // an empty array meaning "we checked and nothing is outstanding", which is a different fact
        // from the field being absent — so the run's own event states the count rather than
        // reporting "Autofilled 7 fields" over a form that cannot be submitted.
        const semiMissing = Array.isArray(result.missingRequired) ? result.missingRequired : null;
        logEvent(runId, runJobId, userId, jobId, "autofill_done",
          `Autofilled ${result.fieldsFilled ?? 0} fields` +
          (semiMissing === null ? ""
            : semiMissing.length
              ? ` — ${semiMissing.length} required field${semiMissing.length === 1 ? " is" : "s are"} yours to answer`
              : " — no required field is left blank"), {
            platform: result.platform,
            answerCount: semiAnswers.length,
            // Recorded even when zero: the count is the claim, and an absent key is how this went
            // unnoticed in the first place.
            missingRequiredCount: semiMissing === null ? null : semiMissing.length,
            missingRequired: semiMissing,
            resumeArtifactId: usedArtifactId,
            screenshotPath: result.screenshotPath || null,
            columnsWritten: semiAudit.written,
          });
        db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
        // The manual-review branch returns here, so it never reached the packet built at the end of
        // the main path — the one hold most obviously meant to be finished by a human was the one
        // with no route to finishing it. Unlike the early holds above this DID reach the form, so it
        // hands off the real resolved answers and the URL the form was actually on, not the
        // canonical profile set.
        if (shouldBuildPacket({ status: "held_review", reasonCode: "manual_review" })) {
          createGatePacket({
            runId, runJobId, userId, jobId, result, autofillPayload,
            resumeArtifactId: usedArtifactId, reasonCode: "manual_review", jobUrl, toolType,
          });
        }
        return;

      } else if (deferGeneration) {
        // ── CASE D: PREVIEW WITHOUT GENERATING (AL2) ───────────────────────────────────────────
        //
        // The whole point of the deferral. Nothing here calls a model: no resume, no cover letter.
        // The browser still opens and fills the form, because the form is what the human is being
        // asked to approve — what changes is that the ~$0.04 waits for their decision.
        //
        // ⛔ resumePathPromise IS DELIBERATELY NOT PASSED, and this is not a tidiness choice.
        // autoApply treats `preview` as UNATTENDED, and it has a gate reading
        // `isUnattended && resumePathPromise && !effectiveResumePath` which returns
        // status 'ats_held' / 'resume_unavailable'. Passing Promise.resolve(null) — the obvious
        // way to say "no resume yet" — therefore turns EVERY deferred preview into a hold that the
        // approve endpoint cannot release, because only 'awaiting_approval' rows are approvable.
        // The deferral would silently break the entire queue. Omitting the option is what tells
        // autoApply there was never a resume coming, which is the truth.
        const baseAts = typeof scoreBaseResumeForApply === "function"
          ? scoreBaseResumeForApply(userId, jobId) : null;
        db.prepare(`UPDATE apply_run_jobs SET base_ats_score=?, base_ats_json=? WHERE id=?`)
          .run(baseAts?.score ?? null, baseAts ? JSON.stringify(baseAts) : null, runJobId);
        logEvent(runId, runJobId, userId, jobId, "generation_deferred",
          baseAts
            // The band, not the number — the number is internal (see shared/atsBands.js).
            ? `No resume generated yet. Base resume fit: ${baseAts.band.replace(/_/g, " ")}. ` +
              `Generation happens when you approve.`
            : "No resume generated yet. Generation happens when you approve.",
          { baseAtsScore: baseAts?.score ?? null, baseAtsBand: baseAts?.band ?? null,
            deferred: true, generateAtQueue });
        logEvent(runId, runJobId, userId, jobId, "site_visit_started", "Opening application page for preview");
        const applyPromise = autoApply(jobUrl, autofillPayload, {
          derivedLabelMaps,
          mode: applyMode,
          jobId,
          approvedAnswers,
          // Says the empty resume/cover-letter slots are DEFERRED, not unfillable. Without it the
          // completeness gate holds this row as 'incomplete_form', and only 'awaiting_approval'
          // rows can be approved — so every deferred preview would be a dead end.
          documentsDeferred: true,
        });
        const settled = await Promise.allSettled([applyPromise]);
        result = settled[0].status === "fulfilled" ? settled[0].value : { status: "error", fieldsFilled: 0 };

      } else {
        // CASE C: no artifact + auto mode
        // Browser and generation run in parallel; browser awaits resumePathPromise at the upload step,
        // so navigation and form-fill can proceed while generation runs.
        // ATS gate is embedded inside the resumePathPromise chain — it gates the PDF path, not the browser launch.
        logEvent(runId, runJobId, userId, jobId, "generation_started", "Starting resume generation in parallel with browser");
        const resumePathPromise = generateResumeForApply(userId, jobId, toolType).then(async (gen) => {
          if (gen?.error === "generation_timed_out") {
            logEvent(runId, runJobId, userId, jobId, "generation_timed_out", "Resume generation timed out — no file to upload");
            return null;
          }
          if (gen?.error) {
            // Remember WHY there is no resume. Without this, the run ends with only "no resume
            // path" and the terminal status gets attributed to whatever failed last — which is
            // how an Anthropic 404 came to be reported as "browser error".
            genFailure = {
              reasonCode: gen.errorCode || "generation_failed",
              detail: gen.errorDetail || `Generation failed: ${gen.error}`,
              permanent: gen.errorPermanent ?? null,
            };
            logEvent(runId, runJobId, userId, jobId, "generation_failed",
              gen.errorDetail || `Generation failed: ${gen.error}`);
            return null;
          }
          logEvent(runId, runJobId, userId, jobId, "generation_ready", "Resume generated", { atsScore: gen.atsScore });
          usedArtifactId = gen.resumeId ?? null;
          usedAtsScore   = gen.atsScore ?? null;
          // AK1: the scorer may now DECLINE to score (null) when the posting or the resume carries
          // too little signal to judge. That is not a zero. Both outcomes hold the job for review —
          // the gate must never auto-submit on an unknown — but they are logged differently,
          // because "Score 0 below threshold" for a job that was never scored sends whoever reads
          // the run history looking for a resume problem that does not exist.
          const unscorable = gen.atsScore == null;
          const atsScore = gen.atsScore ?? 0;
          logEvent(runId, runJobId, userId, jobId, "ats_review",
            unscorable ? "ATS score: not enough signal to score" : `ATS score: ${atsScore}`,
            { atsScore: gen.atsScore ?? null });
          if (unscorable || atsScore < ATS_AUTO_APPLY_THRESHOLD) {
            logEvent(runId, runJobId, userId, jobId, "ats_below_threshold",
              unscorable
                ? "Held: not enough signal to score this posting against the resume"
                : `Score ${atsScore} below threshold ${ATS_AUTO_APPLY_THRESHOLD}`);
            db.prepare(`UPDATE apply_run_jobs SET status='held_review', reason_code='ats_below_threshold', finished_at=unixepoch() WHERE id=?`).run(runJobId);
            db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
            return null;
          }
          try {
            const pdfBuf = await htmlToPdf(gen.html);
            const tmpPath = tmpPdfPath("resume", userId, jobId);
            writeFileSync(tmpPath, pdfBuf);
            resumeTmpPath = tmpPath;
            return tmpPath;
          } catch (e) {
            docFailure = resumePdfFailure(e);
            logEvent(runId, runJobId, userId, jobId, "resume_pdf_failed", docFailure.detail);
            return null;
          }
        });
        // D123 P6e (R9): only when the form asks for one (see CASE A).
        const coverLetterOnDemandCaseC = coverLetterOnDemand(() => generateCoverLetterForApply(userId, jobId).then(async (cl) => {
          if (!cl?.html) {
            logEvent(runId, runJobId, userId, jobId, "cover_letter_unavailable", cl?.error || "no cover letter");
            return null;
          }
          try {
            const pdfBuf = await htmlToPdf(cl.html);
            const tmpPath = tmpPdfPath("cl", userId, jobId);
            writeFileSync(tmpPath, pdfBuf);
            coverLetterTmpPath = tmpPath;
            return tmpPath;
          } catch { return null; }
        }).catch(() => null));
        logEvent(runId, runJobId, userId, jobId, "site_visit_started", "Opening application page in browser");
        const applyPromise = autoApply(jobUrl, autofillPayload, {
          derivedLabelMaps,
          mode: applyMode,
          jobId,
          resumePathPromise,
          coverLetterOnDemand: coverLetterOnDemandCaseC,
          approvedAnswers,
          submitBlocker,
        });
        const [, applySettled] = await Promise.allSettled([resumePathPromise, applyPromise]);
        result = applySettled.status === "fulfilled" ? applySettled.value : { status: "error", fieldsFilled: 0 };
      }

      // Record final result for CASE A and CASE C (CASE B returns early above)
      const submitted = result.status === "submitted";
      const atsHeld   = result.status === "ats_held";
      // A preview holds like any other hold — the row carries the full answer set, so the review
      // endpoints serve it and the approve endpoint can release it.
      const previewed = result.status === "preview_ready";
      // A generation failure is a HOLD, not a crash. The old mapping only reached "held_review"
      // via the browser's own status, so when generation died and the browser later threw for any
      // reason, the run was filed as "failed / browser error" — pointing at the one subsystem that
      // had worked. This does NOT widen the submit gate: only reason_code 'awaiting_approval' rows
      // are releasable by the approve endpoints, so a generation_failed hold can never be
      // approved into a submission.
      // A gated portal gets its OWN terminal status rather than landing in held_review's fallback,
      // which is where it used to end up: reason_code 'login_required' on a held_review row made a
      // job whose form was never reached indistinguishable, to every status='held_review' query, from
      // one that was filled and needs three answers checked. See the G1 decision in §8.
      const gated = result.status === "held_gate";
      // TASK AC4: an aborted run reports `cancelled`, and it outranks everything below it — a run
      // the user stopped is not "held for review" and not a failure. autoApply returns this only
      // from its abort checkpoints, so it can never be reached by a run that submitted.
      const cancelled = result.status === "cancelled";
      const finalStatus = cancelled ? "cancelled"
        : submitted ? "submitted"
        : genFailure ? "held_review"
        : gated ? "held_gate"
        : previewed || atsHeld || result.status === "awaiting_user" ? "held_review"
        : result.status === "error" ? "failed"
        : "held_review";
      // result.reasonCode now takes precedence so `submit_unverified` — a submit button was
      // clicked and nothing happened — is not flattened into the much milder "no_submit_button".
      //
      // `atsHeld` used to hardcode "ats_below_threshold" here, which OVERWROTE the reason
      // autoApply had already worked out. The pre-submit gate returns ats_held with
      // reasonCode "resume_unavailable" whenever there is no resume to upload — so a run whose
      // generation crashed was reported as "ATS score below threshold", a completely different
      // diagnosis pointing at the scorer instead of at the generator. The gate's own reason wins.
      //
      // A generation failure outranks all of it: when generation is why we are not submitting,
      // that is the fact worth reporting, not the browser's or the scorer's downstream symptom.
      const reasonCode = cancelled ? (result.reasonCode || "user_aborted")
        : submitted ? null
        : genFailure ? genFailure.reasonCode
        : docFailure ? docFailure.reasonCode
        : atsHeld ? (result.reasonCode || "ats_below_threshold")
        : previewed ? "awaiting_approval"
        : result.status === "awaiting_user" ? "manual_review"
        : result.reasonCode
          || (result.status === "filled_not_submitted" ? "no_submit_button" : null);

      // Preserve the upstream failure (404 body, error type, request_id) on the row, and say
      // plainly whether a retry can ever work — "permanent" means the same call fails identically.
      const reasonDetail = genFailure ? genFailure.detail : docFailure ? docFailure.detail : result.reasonDetail;
      const fallbackUrl = isBrowserFailure(reasonCode) ? jobUrl : null;
      setJobStatus(finalStatus, reasonCode, reasonDetail || (fallbackUrl ? `fallbackUrl:${fallbackUrl}` : null));

      // AUDIT TRAIL (requirement 3). Everything needed to reconstruct exactly what was sent to an
      // employer and why, on the run-job row itself rather than only in the event log: the resolved
      // answers with provenance/confidence from A2, which resume artifact was used and its ATS
      // score, the screenshot, and whether the submission was actually VERIFIED (see submit_verified
      // — A1 finding N1 showed 'submitted' was previously claimed on a click alone).
      const openQuestions = Array.isArray(result.openQuestions) ? result.openQuestions : [];
      const audit = persistAudit(runJobId, {
        answers_json: Array.isArray(result.answers) && result.answers.length ? JSON.stringify(result.answers) : null,
        resume_artifact_id: usedArtifactId,
        resume_ats_score: usedAtsScore,
        screenshot_path: result.screenshotPath || null,
        submit_verified: result.submitVerified === true ? 1 : result.submitVerified === false ? 0 : null,
        submit_evidence: result.submitEvidence || null,
        // Validation-correction loop: the questions that would turn this hold into a completion.
        open_questions_json: openQuestions.length ? JSON.stringify(openQuestions) : null,
        // AF5: the denominator for "N fields filled". Null rather than 0 when the run never got to
        // discovery — "we did not look" and "we looked and found nothing" are different facts.
        fields_discovered: Number.isFinite(result.fieldsDiscovered) ? result.fieldsDiscovered : null,
        // AH5. An EMPTY array is a real answer — "we looked at every discovered field and none is
        // empty" — and is a different fact from null, which means the run never got to look.
        blanks_json: Array.isArray(result.blanks) ? JSON.stringify(result.blanks) : null,
      });

      // The durable record, independent of schema state. The columns are a queryable projection of
      // this; these particular facts (which artifact, which screenshot, whether the submission was
      // actually verified) had no event of their own before, so a failed UPDATE lost them outright.
      logEvent(runId, runJobId, userId, jobId, "audit_recorded",
        `Audit recorded (${audit.written.length}/${AUDIT_COLUMNS.length} columns)`, {
          resumeArtifactId: usedArtifactId,
          resumeAtsScore:   usedAtsScore,
          screenshotPath:   result.screenshotPath || null,
          submitVerified:   result.submitVerified ?? null,
          submitEvidence:   result.submitEvidence || null,
          answerCount:      Array.isArray(result.answers) ? result.answers.length : 0,
          openQuestionCount: openQuestions.length,
          columnsWritten:   audit.written,
          ...(audit.skipped.length ? { columnsSkipped: audit.skipped } : {}),
          ...(audit.error ? { persistError: audit.error } : {}),
        });

      // Park the prepared packet for the handoff. After the audit on purpose — the audit row is the
      // record of the attempt and must not depend on the packet succeeding.
      //
      // AB1: this used to read `finalStatus === "held_gate"`, and that one condition is why the
      // pipeline could not complete. A held review ended here with a screenshot and nothing else:
      // the filled DOM lives in a Puppeteer context that has already closed, so "Filled form ↗" was
      // a static picture and the apply URL beside it opened a brand-new empty application. There was
      // no route from held to submitted at all — the candidate had to redo by hand everything the
      // system had already done.
      //
      // The gated handoff is exactly the mechanism for this, so held reviews are routed through it
      // rather than given one of their own. shouldBuildPacket decides which held rows qualify.
      if (shouldBuildPacket({ status: finalStatus, reasonCode })) {
        createGatePacket({
          runId, runJobId, userId, jobId, result, autofillPayload,
          resumeArtifactId: usedArtifactId,
          reasonCode, jobUrl, toolType,
        });
      }

      // Outside the persistence path on purpose: this used to sit inside the same try, so a failed
      // UPDATE also swallowed the questions the correction loop depends on.
      if (openQuestions.length) {
        logEvent(runId, runJobId, userId, jobId, "open_questions",
          `${openQuestions.length} question(s) would unblock this application`,
          { openQuestions });
      }
      logEvent(runId, runJobId, userId, jobId, "autofill_done", `Autofilled ${result.fieldsFilled ?? 0} fields`, { platform: result.platform, fallbackUrl });

      // Answer provenance (TASK A2). Persisted so that what was sent to an employer, and which
      // rule produced each value, can be reconstructed after the fact. details_json is used
      // deliberately: it needs no migration, leaving id 069 for A3's dedicated audit columns.
      // The field VALUE is recorded — auditing "was this answer correct" is impossible without it.
      if (Array.isArray(result.answers) && result.answers.length) {
        logEvent(runId, runJobId, userId, jobId, "answers_resolved",
          `Resolved ${result.answers.filter(a => !a.skipped).length} answers`, {
            answers: result.answers.map(a => ({
              field: a.label || a.name || a.field_id,
              type: a.type,
              value: a.skipped ? null : a.value,
              provenance: a.provenance,
              confidence: a.confidence,
              matched_on: a.matched_on,
              ...(a.skipped ? { skipped: true, refusals: a.refusals } : {}),
            })),
          });
      }
      if (Array.isArray(result.lowConfidence) && result.lowConfidence.length) {
        logEvent(runId, runJobId, userId, jobId, "low_confidence_hold",
          `Held: ${result.lowConfidence.length} answer(s) below the auto-submit confidence floor`,
          { lowConfidence: result.lowConfidence });
      }

      if (submitted) {
        logEvent(runId, runJobId, userId, jobId, "submitted", "Application submitted successfully");
        db.prepare(`UPDATE apply_runs SET submitted_count=submitted_count+1 WHERE id=?`).run(runId);
        // A63: the same Pending -> verified -> Submitted record every other route uses. A submit the
        // automation VERIFIED (submit_verified, with its evidence) is recorded verified, and that is
        // what writes job_applications with the score at apply; a claimed-but-unverified submit
        // stays recorded, for the user to confirm. Never allowed to fail the run.
        try {
          recordSubmissionFromPipeline(db, { userId, jobId, runJobId, capturedAtsAtApply });
        } catch (e) {
          console.warn(`[applyRoutes] application record job=${jobId}: ${e.message}`);
        }
        // D100 / D36 amended: whose submit it was. 'approved' = the user approved these values; 'auto' = their
        // FULL AUTO standing instruction (processRunJob held it above unless they chose that mode).
        // ⭐ D113: a tap on Apply in a picks message is the user's submit too ('user'), not the standing instruction.
        db.prepare(`UPDATE apply_run_jobs SET submitted_by=? WHERE id=?`)
          .run(approvalMode === "approved" || (userApplyMode(userId) !== "auto" && pickAuthorisesSend(db, userId, jobId)) ? "user" : "auto", runJobId);
      } else if (cancelled) {
        // Counted as neither held nor failed. The run's three counters are what the run chip
        // reports, and a cancelled job is not work waiting on the user (held) nor work that broke
        // (failed) — incrementing either would misreport the run for the sake of a tidier sum.
        logEvent(runId, runJobId, userId, jobId, "run_job_cancelled",
          "You stopped this application. Nothing was submitted.");
      } else if (finalStatus === "held_review") {
        db.prepare(`UPDATE apply_runs SET held_count=held_count+1 WHERE id=?`).run(runId);
      } else {
        db.prepare(`UPDATE apply_runs SET failed_count=failed_count+1 WHERE id=?`).run(runId);
      }

    } catch (e) {
      // TASK AC4: an abort is not a crash. requestAbort closes the browser out from under whatever
      // this job was awaiting, so the throw arriving here is usually a "Target closed" — and
      // attributing it would file a deliberate stop as a browser failure with a Retry button on it.
      // The DB write below is guarded too (setJobStatus's `status != 'cancelled'`), but returning
      // early also skips the failed_count increment and the misleading error log.
      if (isAbortRequested(jobId)) {
        logEvent(runId, runJobId, userId, jobId, "run_job_cancelled",
          "You stopped this application mid-run. The browser was closed and nothing was submitted.");
        return;
      }
      console.error(`[applyRoutes] processRunJob error job=${jobId}: ${e.message}`);
      // A generation failure that happened earlier in this job outranks whatever threw here:
      // it is the reason there was nothing to submit. Otherwise attribute the throw by cause
      // rather than assuming a subsystem (the old code's second branch was unreachable — it
      // tested e.reasonCode after already returning it — and always yielded "internal_error").
      const attributed = classifyRuntimeError(e);
      const errReasonCode = genFailure ? genFailure.reasonCode : attributed.reasonCode;
      const errDetail     = genFailure ? genFailure.detail     : attributed.detail;
      const fallbackUrl = isBrowserFailure(errReasonCode) ? (job?.apply_url || job?.url || null) : null;
      // Generation failures are held for review, not filed as crashes — same rationale as the
      // main path, and still unsubmittable (only 'awaiting_approval' rows can be approved).
      const errStatus = genFailure ? "held_review" : "failed";
      db.prepare(`UPDATE apply_run_jobs SET status=?, reason_code=?, reason_detail=?, finished_at=unixepoch() WHERE id=?`)
        .run(errStatus, errReasonCode,
          (errDetail || e.message?.slice(0, 500) || "Unknown error") + (fallbackUrl ? ` fallbackUrl:${fallbackUrl}` : ""), runJobId);
      db.prepare(`UPDATE apply_runs SET ${genFailure ? "held_count=held_count+1" : "failed_count=failed_count+1"} WHERE id=?`).run(runId);
      logEvent(runId, runJobId, userId, jobId, "error", e.message?.slice(0, 500) || "Unknown error", { fallbackUrl });
    } finally {
      if (resumeTmpPath) { try { unlinkSync(resumeTmpPath); } catch {} }
      if (coverLetterTmpPath) { try { unlinkSync(coverLetterTmpPath); } catch {} }
      // TASK AC4: retire the abort flag HERE, not in the endpoint that raised it. This is the point
      // at which the run it was aimed at has genuinely finished unwinding and recorded itself, so
      // clearing is safe — and it must be cleared, because the key is the POSTING and the same
      // posting is routinely re-queued. A flag left set would silently cancel the next attempt.
      clearAbort(jobId);
    }
  }

  /**
   * D25: put a run that has not finished back at the HEAD of the user's line, its unstarted jobs
   * still queued. Used when the user's hold is found at processRun's own doors — before the run is
   * marked running, or before its next job is launched. The head, not the tail, because it was
   * already the next thing to happen; resuming must not reorder what the user lined up.
   */
  function parkRunAtHead(run, why) {
    db.prepare(`
      UPDATE apply_runs SET status='waiting', line_position =
        (SELECT COALESCE(MIN(line_position), 1) - 1 FROM apply_runs WHERE user_id=? AND status='waiting')
      WHERE id=?
    `).run(run.user_id, run.id);
    for (const rj of db.prepare(`SELECT id, job_id FROM apply_run_jobs WHERE run_id=? AND status='queued'`).all(run.id)) {
      logEvent(run.id, rj.id, run.user_id, rj.job_id, "user_hold", why);
    }
  }

  const processRun = async (run) => {
    // D25: set when this run went back to the line because of the user's hold. Such a run must not
    // re-dispatch the line on its way out: if the line's check and this one ever disagreed, that
    // dispatch would start the run, this would park it, and the two would ping-pong it forever (an
    // injected-violation check found exactly that loop). Resume dispatches the line itself.
    let parked = false;
    try {
      // D25: THE USER'S HOLD, CHECKED BEFORE THE RUN STARTS. startRun and dispatchLine already
      // decline to start a held user's run; this is the door they both lead to, and boot recovery
      // calls it directly — so the check here is the one that cannot be walked around.
      if (userHeld(db, run.user_id)) {
        parkRunAtHead(run, "You stopped everything before this draft started. Nothing was opened or sent.");
        parked = true;
        return;
      }
      db.prepare(`UPDATE apply_runs SET status='running', started_at=unixepoch() WHERE id=?`).run(run.id);
      const jobs = db.prepare(`SELECT * FROM apply_run_jobs WHERE run_id=? AND status='queued' ORDER BY id`).all(run.id);

      const runningJobs = [];
      let heldMidRun = false;
      for (const job of jobs) {
        while (activeWorkers >= APPLY_WORKER_LIMIT) {
          await new Promise(r => setTimeout(r, 500));
        }
        // Small jitter (1–3 s) between job launches to avoid hammering a provider.
        if (runningJobs.length > 0) {
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
        // D25: re-checked immediately before EACH next application is launched (after the worker
        // wait and the jitter, so a Stop pressed during either is seen), so Stop everything pressed
        // during a run starts nothing further. What is already being filled finishes; the rest wait.
        if (userHeld(db, run.user_id)) { heldMidRun = true; break; }
        activeWorkers++;
        const p = processRunJob(job, run)
          // ⭐ D112 item 8: the job's outcome, told to the person — Needs you / Ready to approve, or sent (services/notify.js;
          // a job the apply worker took over is told by the worker's report instead).
          .then(() => { notifyRunJobOutcome(db, job.id); })
          .catch(e => console.error(`[applyRoutes] uncaught job error job=${job.job_id}: ${e.message}`))
          .finally(() => { activeWorkers--; });
        runningJobs.push(p);
      }

      await Promise.allSettled(runningJobs);
      const unstarted = heldMidRun
        ? db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE run_id=? AND status='queued'`).pluck().get(run.id)
        : 0;
      if (unstarted) {
        parkRunAtHead(run, "You stopped everything while this run was going. This application had not started — nothing was opened or sent.");
        parked = true;
        return;
      }
      db.prepare(`UPDATE apply_runs SET status='completed', finished_at=unixepoch() WHERE id=?`).run(run.id);
    } catch (e) {
      console.error(`[applyRoutes] processRun error run=${run.id}: ${e.message}`);
      db.prepare(`UPDATE apply_runs SET status='failed', finished_at=unixepoch() WHERE id=?`).run(run.id);
    } finally {
      // A59: a slot just freed — start the next run in this user's line, if there is one. Not after
      // a D25 park: the user stopped everything, and Resume is what moves the line again.
      if (!parked) {
        try { dispatchLine(run.user_id); }
        catch (e) { console.error(`[applyRoutes] line user=${run.user_id}: ${e.message}`); }
      }
    }
  };

  // ── Browser readiness ────────────────────────────────────────────────────────

  app.get("/api/apply/readiness", requireAuth, async (_req, res) => {
    try {
      const probe = await probeBrowserAvailability();
      if (!probe.available) {
        return res.status(503).json({ available: false, reason: probe.reasonCode || null });
      }
      res.json({ available: true, reason: null });
    } catch (e) {
      res.status(503).json({ available: false, reason: "probe_error" });
    }
  });

  // ── Queue endpoints ──────────────────────────────────────────────────────────

  // A53's duplicate rule, ONE copy: a job is already drafted while a run-job for it is submitted, running or queued,
  // or (for a Draft — the second parameter 1) parked awaiting approval. startRun filters by it; ⭐ T24's extension
  // Draft asks it first (draftStateOf), so the extension says "already drafted" before it spends anything.
  const DRAFT_DUPLICATE_WHERE = `user_id=? AND (status IN ('submitted', 'running', 'queued')
                           OR (? = 1 AND status = 'held_review' AND reason_code = 'awaiting_approval'))`;

  /** ⭐ T24 · the job's Draft House state for this user: { drafted, status, runId, runJobId } — drafted by A53's rule. */
  function draftStateOf(userId, jobId) {
    const row = db.prepare(`SELECT id, run_id, status FROM apply_run_jobs WHERE ${DRAFT_DUPLICATE_WHERE} AND job_id = ?
      ORDER BY id DESC LIMIT 1`).get(userId, 1, String(jobId));
    return row ? { drafted: true, status: row.status, runId: row.run_id, runJobId: row.id }
      : { drafted: false, status: null, runId: null, runJobId: null };
  }

  /**
   * Create and dispatch a run. Extracted so the validation-correction retry goes through EXACTLY
   * the same admission control as a fresh run: the kill switch, concurrency limit, prerequisite
   * gate, duplicate filter and daily cap are implemented once and cannot drift apart.
   * Returns { status, body } — body carries `error` on refusal.
   */
  function startRun(userId, planTier, jobIds, { mode = "auto", tool = "generate", approvalMode = null,
                                                approvedFrom = null, retryOfHeld = false } = {}) {
    const respond = (status, body) => ({ status, body });

    // ── Three payload-contract mismatches with the client, fixed together ──────────────────────
    //
    // 1. MODE. "manual" is the client's word for the review flow (its button calls
    //    startApplyRun("manual") and its own copy says "manual review"); "semi" is the server's
    //    word and what processRunJob branches on. They were never mapped, so "manual" fell through
    //    to "auto" and autoApply ran in "full" mode — a user asking to review first got a real
    //    auto-submitted application. Accept both spellings for the one behaviour.
    const resolvedMode = (mode === "semi" || mode === "manual") ? "semi" : "auto";

    // 2. TOOL. The client sends `tool` — its convention at every other resume endpoint — while
    //    this route read only `toolType`, so the A+ selection never arrived and every run recorded
    //    tool_type='generate'. Accept both; `tool` wins. Anything unrecognised means generate.
    const resolvedTool = tool === "a_plus_resume" ? "a_plus_resume" : "generate";

    // APPROVAL. A full-auto run submits to a real employer with nobody having seen what it filled,
    // and a submission cannot be recalled — so it is now opt-in. An 'auto' run PREVIEWS by default:
    // it runs every gate, stops short of the click, and parks each job for a human decision.
    // 'semi' is exempt because it already puts a human at the browser; approving twice is friction
    // with no safety gained. 'approved' is set by the approve endpoint on the run it creates.
    const resolvedApproval = resolvedMode === "semi" ? "auto"
      : approvalMode === "auto" || approvalMode === "approved" ? approvalMode
      : "required";

    // Honouring the client's tool makes this route entitlement-bearing for the first time: while
    // the field was ignored, a BASIC user could not reach A+ generation by asking for it. Gate it
    // server-side so repairing the plumbing does not open a plan-tier bypass. Same 403 shape as
    // requireToolEntitlement in server.js, which this route cannot reach (positional signature,
    // pinned by applyPipeline.test.js).
    // This is the fourth enforcement point and the only one outside server.js, so it has to consult
    // the lever for itself — it cannot reach requireToolEntitlement. Same flag, same parser, read
    // from shared/monetisation.js: one lever, four readers, no independent decisions.
    if (monetisationEnabled() && resolvedTool === "a_plus_resume" && !canUseAPlusResume(planTier)) {
      return respond(403, {
        error: "upgrade_required",
        message: "A+ Resume requires the PRO plan.",
        requiredTier: "PRO",
        planTier,
      });
    }

    // KILL SWITCH (requirement 4). Full-auto is refused outright; semi still runs, because semi
    // puts a human in front of every submit and is the mode A5 gates the first live application on.
    if (resolvedMode === "auto" && fullAutoDisabled()) {
      return respond(503, {
        error: "full_auto_disabled",
        // D36: this offered "Manual review mode", which no client surface has offered since the deck and
        // board Draft became the only way in (A53) — so the one thing the user was told to do did not exist.
        // Said as it is: paused by the operator, nothing new starts, nothing already sent is affected.
        message: "Automatic applications are paused by the operator, so nothing new can be drafted right now. " +
          "Nothing already sent is affected. Draft it again once they are resumed.",
      });
    }

    // ⛔ D36 → D100 · SENDING WITHOUT REVIEW IS THE USER'S CHOICE, ENFORCED WHERE A RUN IS ADMITTED.
    // D36 found the run bar's lock was only a picture: this function admitted `approvalMode:'auto'` from
    // POST /api/apply/runs and POST /api/apply/answers and the run SUBMITTED with nobody having seen it.
    // D100 replaced the server-wide lock with the user's mode; the enforcement stays here and in
    // processRunJob, so a user in SEMI cannot be sent for by any caller.
    // 'approved' is not this: a human approved exactly those answers.
    // ⭐ D113: a tap on Apply in a picks message is the user's send for exactly the jobs tapped — every job must carry it.
    if (resolvedMode === "auto" && resolvedApproval === "auto" && userApplyMode(userId) !== "auto"
        && !(jobIds.length && jobIds.every(id => pickAuthorisesSend(db, userId, id)))) {
      return respond(403, {
        error: "full_auto_not_chosen",
        message: "Sending without your review needs FULL AUTO, and your mode is SEMI. Switch it in Home, " +
          "or draft it without approvalMode and it will wait for your approval.",
      });
    }

    // CONCURRENCY (requirement 2). A user may not stack runs: overlapping runs make the daily cap
    // racy and multiply browser load.
    //
    // ⛔ A59 (owner, O44, 10-02): A DRAFT WAITS IN LINE — it is no longer REFUSED. This was a 429
    // run_already_active, which the deck reached on every second Draft inside a minute and, since
    // A53 gave the board the deck's Draft, the board too. The limit on concurrent runs is unchanged;
    // what changed is that a run over it is admitted as status 'waiting' with a place in the user's
    // line (dispatchLine starts it when a slot frees). It also waits when the line is not empty,
    // even with a free slot, so a later Draft can never jump an earlier one — the head of the line
    // can be held by the kill switch, and that hold must hold everything behind it.
    // Every other admission check below still runs NOW, at the moment of the Draft, so a refusal is
    // said while the user is looking rather than discovered later in a list.
    const active = activeRunCount(userId);
    const waitingAhead = waitingRunCount(userId);
    // D25: a user who pressed Stop everything still gets their Draft admitted — every check below
    // runs now — but it WAITS rather than starting, and the line does not move until they resume.
    const heldByUser = userHeld(db, userId);
    const mustWait = active >= APPLY_MAX_ACTIVE_RUNS || waitingAhead > 0 || heldByUser;
    if (mustWait && waitingAhead >= APPLY_MAX_WAITING_RUNS) {
      return respond(429, {
        error: "line_full",
        message: `${waitingAhead} drafts are already waiting in line — the most there can be. ` +
          "Remove one from the line in Home, or wait for the current one to finish.",
        waiting: waitingAhead,
        limit: APPLY_MAX_WAITING_RUNS,
      });
    }

    // Restored server-side prerequisite gate (§5.13). A run cannot produce anything without a
    // base resume, an active profile, and the name/email the autofill fills in — so refuse before
    // queueing rather than failing per-job inside processRun. This is the missing half of a
    // contract the client still honours: JobsPanel's startApplyRun catch reads
    // `missingPrerequisites` off the error payload and renders "Setup needed in Integrations: …".
    // Deliberately narrow: getAutomationReadiness keeps gmail/google in `apply.optional` and
    // scopes linkedin to profile_import, so none of those block a run.
    const missingPrerequisites = getMissingApplyPrerequisites(getAutomationReadiness(db, userId));
    if (missingPrerequisites.length) {
      return respond(409, {
        error: "Apply prerequisites are not set up yet",
        missingPrerequisites,
      });
    }

    // ⛔ A53: A DRAFT WAITING FOR YOUR REVIEW IS ALSO A DUPLICATE. This used to list only
    // submitted / running / queued, so a job previewed and parked (held_review, awaiting_approval)
    // could be drafted AGAIN — from the deck and then the board, or twice from either — and each
    // one opened another preview run. The approve path is exempt: it releases exactly that parked
    // row (approvalMode 'approved'), and the answers-retry path supersedes its held rows first.
    const duplicates = db.prepare(`
      SELECT job_id FROM apply_run_jobs WHERE ${DRAFT_DUPLICATE_WHERE}
    `).pluck().all(userId, resolvedApproval === "approved" ? 0 : 1);
    const duplicateSet = new Set(duplicates);

    const filtered = jobIds.map(String).filter(id => !duplicateSet.has(id));
    if (filtered.length === 0)
      return respond(400, { error: "All selected jobs are already applied or in progress",
        code: "already_drafted",
        message: jobIds.length === 1
          ? "Already drafted — it is waiting for your review, in progress, or sent."
          : "All selected jobs are already drafted — waiting for your review, in progress, or sent." });

    // ⛔ A63: THE DAY'S DRAFT SLOTS (owner, O45c). A Draft and a board résumé generation share one
    // allowance — the deck's 10 (services/draftSlots.js). Exempt: an approval (the same Draft
    // continuing) and an answers retry (it supersedes the held row it replaces, so the count does
    // not move). Refused with the one sentence every surface shows.
    if (resolvedApproval !== "approved" && !retryOfHeld) {
      const slots = draftSlots(db, userId);
      if (slots.used + filtered.length > slots.limit) return respond(429, slotsExhausted(slots, filtered.length));
    }

    // QUEUE CAP. The cost gate: bounds generations, which the submission cap below does not (see
    // queuedLast24h). Checked before it because it is the limit a queue-heavy caller hits first,
    // and refused with the same explicit shape as every other limit here.
    //
    // ⚠ AL2 CHANGED WHAT THIS PROTECTS, and the number was deliberately NOT changed with it.
    // This cap was sized for generate-at-queue, where 40 queued applications meant 40 generations
    // and ~$1.60. With generation deferred to approval, queueing 40 jobs costs nothing and the
    // meaningful cost limit is the number of APPROVALS — which this does not bound. So the cap now
    // limits how many previews a user may open, which is a browser-time and rate-limit concern
    // rather than a spend one. That is a real change in meaning and it is the owner's call, not
    // one to make unilaterally; see docs/al2-generation-deferral.md. The user-facing message below
    // no longer claims each queued application generates a resume, because on the deferred path it
    // does not, and a limit that explains itself with a false reason is worse than a bare number.
    //
    // Skipped for approval_mode='approved' — the approve endpoint is releasing work already
    // reviewed and already generated, and this guard exists to stop unreviewed generation, not to
    // stand between a human decision and the submission it authorises.
    if (resolvedApproval !== "approved") {
      const queuedUsed = queuedLast24h(userId);
      if (queuedUsed + filtered.length > APPLY_DAILY_QUEUE_CAP) {
        return respond(429, {
          error: "queue_cap_exceeded",
          message: `Daily queue limit reached: ${queuedUsed} of ${APPLY_DAILY_QUEUE_CAP} applications queued in the last 24h, ${filtered.length} requested. This limit bounds how many applications can be opened and previewed per day.`,
          queuedLast24h: queuedUsed,
          requested: filtered.length,
          limit: APPLY_DAILY_QUEUE_CAP,
          remaining: Math.max(0, APPLY_DAILY_QUEUE_CAP - queuedUsed),
        });
      }
    }

    // ⛔ APPROVAL CAP (TASK Q) — the branch the queue cap deliberately skips, which is exactly where
    // the money now goes. This run has approval_mode='approved', has no artifact, and will take
    // CASE C: generateResumeForApply + generateCoverLetterForApply, ~$0.04 a job.
    //
    // Enforced in startRun rather than in POST /api/apply/approve because /approve is not the only
    // caller — the answers/retry path reaches startRun with approvalMode too, and a cap installed at
    // one of two doors is a cap on one of two doors. /approve already handles a non-202 by putting
    // its approvals back, so a refusal here loses nothing.
    if (resolvedApproval === "approved") {
      const approvedUsed = approvedLast24h(userId);
      if (approvedUsed + filtered.length > APPLY_DAILY_APPROVAL_CAP) {
        return respond(429, {
          error: "approval_cap_exceeded",
          // Says what it protects. The queue cap's old message explained itself with a cost that
          // was no longer incurred; this one must not acquire the opposite problem, so it names the
          // generation directly.
          message: `Daily approval limit reached: ${approvedUsed} of ${APPLY_DAILY_APPROVAL_CAP} approved in the last 24h, ` +
            `${filtered.length} requested. Approving generates a tailored resume and cover letter for each ` +
            `application, and this limit bounds that cost. Previewing more applications is unaffected.`,
          approvedLast24h: approvedUsed,
          requested: filtered.length,
          limit: APPLY_DAILY_APPROVAL_CAP,
          remaining: Math.max(0, APPLY_DAILY_APPROVAL_CAP - approvedUsed),
        });
      }
    }

    // DAILY CAP (requirement 2). Checked here so the caller gets a clear error rather than a run
    // that quietly holds most of its jobs. processRunJob re-checks before each submit, because a
    // long run can cross the cap after it was admitted.
    const used = submittedLast24h(userId);
    if (resolvedMode === "auto" && used + filtered.length > APPLY_DAILY_CAP) {
      return respond(429, {
        error: "daily_cap_exceeded",
        message: `Daily application cap reached: ${used} of ${APPLY_DAILY_CAP} used in the last 24h, ${filtered.length} requested.`,
        submittedLast24h: used,
        requested: filtered.length,
        limit: APPLY_DAILY_CAP,
        remaining: Math.max(0, APPLY_DAILY_CAP - used),
      });
    }

    // A59: a run over the limit is inserted 'waiting' and takes the place after the last one. The
    // place is written only on that branch, so a database (or a test fixture) without migration
    // 120 is untouched until a line actually forms. Synchronous, so nothing runs in between.
    const runResult = db.prepare(`
      INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, resolvedMode, resolvedTool, mustWait ? "waiting" : "queued", filtered.length, resolvedApproval);
    const runId = runResult.lastInsertRowid;
    if (mustWait) {
      db.prepare(`
        UPDATE apply_runs SET line_position =
          (SELECT COALESCE(MAX(line_position), 0) + 1 FROM apply_runs WHERE user_id=? AND status='waiting')
        WHERE id=?
      `).run(userId, runId);
    }

    // approvedFrom maps job_id -> the preview run-job whose answers were approved. Carrying it on
    // the row is what lets the submitting run compare against what the human actually saw.
    const insertJob = db.prepare(`
      INSERT OR IGNORE INTO apply_run_jobs (run_id, user_id, job_id, status, approved_from_run_job_id)
      VALUES (?, ?, ?, 'queued', ?)
    `);
    // ⛔ D43: the posting is SNAPSHOT onto the run-job — title, company, URL, location — so the record of
    // what the user applied to stands if the posting is later deleted (migration 129). A database
    // without 129's columns still queues the run; only the snapshot is skipped.
    let snapshotJob = null;
    try {
      snapshotJob = db.prepare(`
        UPDATE apply_run_jobs SET
          posting_title    = (SELECT sj.title FROM scraped_jobs sj WHERE sj.job_id = apply_run_jobs.job_id),
          posting_company  = (SELECT sj.company FROM scraped_jobs sj WHERE sj.job_id = apply_run_jobs.job_id),
          posting_url      = (SELECT COALESCE(sj.apply_url, sj.url) FROM scraped_jobs sj WHERE sj.job_id = apply_run_jobs.job_id),
          posting_location = (SELECT sj.location FROM scraped_jobs sj WHERE sj.job_id = apply_run_jobs.job_id)
        WHERE run_id = ?
      `);
    } catch { /* pre-129 schema */ }
    // ⛔ D51 · ONE WRITE, THREE READERS. The Draft click wrote only the run-job, so the job was in Draft
    // House and nowhere else: /d reads résumés and application_records, The Table reads application_records.
    // The record is written HERE, in the run-job's own transaction — both or neither — so /d, Draft House
    // and The Table all see the Draft at once. Origin 'drafted' (server-only); undoing the Draft releases it
    // (releaseDraftRecord). An approval or an answers retry continues a Draft that already wrote one.
    // A fixture database without application_records (pre-A63) still queues the run.
    const tagDrafted = resolvedApproval !== "approved" && !retryOfHeld &&
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='application_records'").get();
    // ⭐ D57 · THE RÉSUMÉ FOLLOWS THE JOB INTO DRAFT HOUSE. A résumé the user already generated by hand
    // (and that is still CURRENT — the same rule CASE A reuses it by) is attached to the run-job at the
    // Draft, so Draft House shows it at once — not only once the run reaches it, and not never for a
    // run that waits in line or is held before the browser. The run's own audit later writes the same
    // artifact (CASE A). A fixture without the audit columns still queues the run.
    let carryResume = null;
    try {
      carryResume = db.prepare(`UPDATE apply_run_jobs SET resume_artifact_id=?, resume_ats_score=?
        WHERE run_id=? AND job_id=? AND resume_artifact_id IS NULL`);
    } catch { /* pre-audit schema */ }
    db.transaction(() => {
      for (const id of filtered) {
        insertJob.run(runId, userId, id, approvedFrom?.[id] ?? null);
        if (tagDrafted) markPending(db, userId, id, "drafted");
        if (carryResume) {
          const cur = artifactCurrency(db, { userId, jobId: id, tool: resolvedTool });
          if (cur.current && cur.artifact?.id != null) carryResume.run(cur.artifact.id, cur.artifact.ats_score ?? null, runId, id);
        }
      }
      snapshotJob?.run(runId);
    })();

    let run = db.prepare("SELECT * FROM apply_runs WHERE id=?").get(runId);
    if (mustWait) {
      // The run ahead may have finished between the count above and here; let the line move now
      // rather than at the next tick. dispatchLine only ever starts the HEAD, so this cannot jump.
      dispatchLine(userId);
      run = db.prepare("SELECT * FROM apply_runs WHERE id=?").get(runId);
    } else {
      setImmediate(() => processRun(run).catch(e => console.error("[applyRoutes] processRun:", e.message)));
    }
    const line = run.status === "waiting" ? linePlaceOf(userId, run.id) : null;

    // 3. RESPONSE SHAPE. The client's success message reads `data.queued?.length`, which this
    //    route never sent — so every run reported "0 jobs started". `queued` is the accepted ids,
    //    which is also what distinguishes them from the ones dropped as duplicates above.
    //    `toolType` is echoed so the client can tell when A+ was requested but downgraded.
    return respond(202, {
      ok: true,
      runId,
      mode: run.mode,
      toolType: run.tool_type,
      queued: filtered,
      totalJobs: filtered.length,
      // A59: true when the run is in the user's line rather than started. `line` is its place
      // (1 = next) and the line's length; the sentence is the one every surface shows.
      waiting: !!line,
      line: line ? { position: line.position, length: line.length } : null,
      message: line
        ? (heldByUser
          ? `Waiting in line (${line.position} of ${line.length}) — you stopped everything, so nothing ` +
            "starts until you resume in Home. Until then you can edit, reorder or remove it."
          : `Waiting in line (${line.position} of ${line.length}) — it starts when the draft ahead of it ` +
            "finishes. Until then you can edit, reorder or remove it in Home.")
        : undefined,
      held: heldByUser || undefined,
      dailyCap: { limit: APPLY_DAILY_CAP, submittedLast24h: used, remaining: Math.max(0, APPLY_DAILY_CAP - used - filtered.length) },
      // The preview/session budget. NOT the cost budget any more — see APPLY_DAILY_QUEUE_CAP.
      queueCap: (() => {
        const q = queuedLast24h(userId);
        return { limit: APPLY_DAILY_QUEUE_CAP, queuedLast24h: q, remaining: Math.max(0, APPLY_DAILY_QUEUE_CAP - q) };
      })(),
      // ⛔ THE COST BUDGET (task Q requirement 3). Reported on every run, not only on the approvals,
      // because a user planning a queueing session needs to know how many of those previews they
      // will be able to act on — a cap discovered by being refused at it is a cap that has already
      // wasted the work it was supposed to bound.
      //
      // Counted AFTER this run's rows are inserted, like queueCap above and unlike dailyCap, which
      // subtracts `filtered.length` because a submission has not happened yet. The client renders
      // "what is left now", and an approval budget that excluded the approval just made would tell
      // the user they have one more than they do.
      // A63: what is left of the day's Draft slots, after this one.
      draftSlots: draftSlots(db, userId),
      approvalCap: (() => {
        const a = approvedLast24h(userId);
        return { limit: APPLY_DAILY_APPROVAL_CAP, approvedLast24h: a, remaining: Math.max(0, APPLY_DAILY_APPROVAL_CAP - a) };
      })(),
    });
  }

  app.post("/api/apply/runs", requireAuth, (req, res) =>
    withIdempotency("/api/apply/runs", req, res, (out) => {
      // approvalMode:'auto' is how a caller opts OUT of review and back into full-auto. Anything
      // else — including omitting it — previews and parks for approval.
      const { jobIds = [], mode = "auto", tool, toolType, approvalMode = null, surface = null } = req.body || {};
      // ⛔ THE DECK MAY NOT ASK FOR NO REVIEW (UI step 3b, 09-30; SWIPE_FEED_DESIGN's "real gap").
      // A Draft from the deck is one keystroke or one swipe, and the review step is the only thing
      // between it and an employer. The server's default (approvalMode omitted → "required") is
      // what makes it safe; this makes the default the ONLY option from that surface, so a second
      // caller cannot drift into sending approvalMode:'auto'. Any value is refused, not only 'auto'.
      // A53 (owner, 10-02): the board's Draft is the deck's Draft — same call, same rule. A Draft
      // from either decision surface is one click, so neither may ask for no review.
      // ⭐ T24: the extension's Draft button is the same Draft (routes/extensionDraft.js calls draftForExtension below,
      // which never passes one); a caller naming the surface here is refused the same way.
      if ((surface === "deck" || surface === "board" || surface === "extension") && approvalMode != null)
        return out.status(400).json({ error: "approval_mode_forbidden_for_surface",
          message: `A draft from the ${surface} always waits for your review. Remove approvalMode.` });
      if (!Array.isArray(jobIds) || jobIds.length === 0)
        return out.status(400).json({ error: "jobIds array required" });
      // ⛔ D51: a null or empty id was admitted as the job "null" — a run-job for nothing, and a Draft slot
      // spent on it (measured on the throwaway server, 10-07). An id is a non-empty string or a number.
      if (jobIds.some(id => !((typeof id === "string" && id.trim()) || (typeof id === "number" && Number.isFinite(id)))))
        return out.status(400).json({ error: "bad_job_id", message: "Every job id must be a non-empty string or a number." });
      if (jobIds.length > 25)
        return out.status(400).json({ error: "Max 25 jobs per run" });
      // 'approved' is set by the approve endpoint on runs it creates; accepting it from a client
      // would let anyone submit without ever previewing.
      if (approvalMode === "approved")
        return out.status(400).json({ error: "approval_mode_reserved" });

      const r = startRun(req.user.id, normalisePlanTier(req.user?.planTier), jobIds,
        { mode, tool: tool ?? toolType, approvalMode });
      return out.status(r.status).json(r.body);
    }));

  // ── Run payload shape ────────────────────────────────────────────────────────
  // These routes returned raw DB rows: snake_case, seconds-epoch timestamps, and no join to
  // scraped_jobs at all. The client reads camelCase and renders `new Date(...)`, so every review
  // row showed a status pill and nothing else — no title, no company, no reason, no ATS score —
  // and the run chips rendered "undefined✓". Both sides were self-consistent and neither matched
  // the other, the same shape of defect as `tool` vs `toolType`.
  //
  // apply_run_jobs stores only job_id, so title/company have to come from scraped_jobs. LEFT JOIN,
  // not JOIN: a posting can be expired by the 7-day cleanup while the application that targeted it
  // remains, and losing the row entirely would be worse than showing it without a title.
  const toMs = (sec) => (sec ? Number(sec) * 1000 : null);

  const publicRun = (r) => ({
    id: r.id,
    mode: r.mode,
    toolType: r.tool_type,
    approvalMode: r.approval_mode ?? null,
    status: r.status,
    totalJobs: r.total_jobs ?? 0,
    submittedCount: r.submitted_count ?? 0,
    heldCount: r.held_count ?? 0,
    failedCount: r.failed_count ?? 0,
    createdAt: toMs(r.created_at),
    startedAt: toMs(r.started_at),
    finishedAt: toMs(r.finished_at),
  });

  const publicRunJob = (r) => ({
    id: r.id,
    runId: r.run_id,
    jobId: r.job_id,
    // Null when the posting has since expired — the row still names the job_id, so a run is never
    // anonymous even after its target is gone.
    title: r.title ?? null,
    company: r.company ?? null,
    applyUrl: r.apply_url || r.url || null,
    mode: r.mode ?? null,
    status: r.status,
    reasonCode: r.reason_code ?? null,
    reasonDetail: r.reason_detail ?? null,
    atsScore: r.resume_ats_score ?? null,
    // What the review surface needs to offer a link rather than leaving the user guessing whether
    // a resume was ever produced.
    resumeAvailable: r.resume_artifact_id != null,
    screenshotAvailable: !!r.screenshot_path,
    // AH5: a hold reading "Required fields were left empty" that does not say WHICH is a hold the
    // candidate cannot act on. Named here, on the row every surface already renders, rather than
    // behind a second request.
    missingRequired: parseJson(r.blanks_json, [])
      .filter(b => b?.required).map(b => b.label || b.field).filter(Boolean),
    // Whether there is a fill log worth asking for. The log itself is on demand — it is a record
    // you go and read, not something every row should carry.
    fillLogAvailable: r.blanks_json != null || r.answers_json != null,
    submitVerified: r.submit_verified === 1,
    submitEvidence: r.submit_evidence ?? null,
    startedAt: toMs(r.started_at),
    finishedAt: toMs(r.finished_at),
    createdAt: toMs(r.created_at),
  });

  const RUN_JOB_SELECT = `
    SELECT rj.*, r.mode, sj.title, sj.company, sj.apply_url, sj.url
    FROM apply_run_jobs rj
    JOIN apply_runs r ON r.id = rj.run_id
    LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
  `;

  app.get("/api/apply/runs", requireAuth, (req, res) => {
    const runs = db.prepare(`
      SELECT * FROM apply_runs WHERE user_id=? ORDER BY created_at DESC LIMIT 20
    `).all(req.user.id);
    // Applications awaiting approval are also held_review, but they have their own surface with
    // their own decision. Leaving them here listed every one of them twice — once as something to
    // approve and once as a bare "needs review" row with no action on it.
    const review = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL AND rj.status='held_review'
        AND COALESCE(rj.reason_code, '') != 'awaiting_approval'
      ORDER BY rj.created_at DESC LIMIT 50
    `).all(req.user.id);
    // Gated jobs used to land in `review` above, as held_review rows with reason_code
    // 'login_required'. Giving them their own terminal status took them out of that list, and leaving
    // it there would have made them silently disappear from the only place they were visible. They
    // get their own key instead of being folded back in: a gated job has nothing to review yet — its
    // form was never reached — so it needs a different offer ("sign in once") rather than the same
    // one. ADDITIVE: `runs` and `review` are unchanged, so an existing caller sees no difference.
    const gated = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL AND rj.status='held_gate'
      ORDER BY rj.created_at DESC LIMIT 50
    `).all(req.user.id);
    // ── The four surfaces the panel is organised around, as a TOTAL PARTITION ──────────────────
    //
    // The panel used to be organised around RUNS, and a run is an implementation detail — "run 47"
    // is not a thing anyone thinks about. It is organised around what the user can DO now, which
    // needs cross-run feeds: every application in flight, every one submitted, every one stopped,
    // regardless of which run produced it. Only `review` and `gated` existed, so submitted and
    // stopped applications were reachable only by opening a specific run.
    //
    // PARTITIONED BY EXCLUSION, deliberately. `stopped` is "not any of the others" rather than a
    // list of failure statuses, so a status added later cannot fall through every bucket and vanish
    // from the UI — which is exactly what happened to held_gate when it was split out of
    // held_review. The partition is asserted total by statusCounts below.
    const IN_FLIGHT   = ['queued', 'running'];
    const NEEDS_YOU   = ['held_review', 'held_gate'];
    // A59: a job waiting in the line is 'queued' but has not started, and the user can still change
    // it — so it is listed under `line` below, with its controls, and not here as "clears itself".
    const inFlight = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL AND rj.status IN (${IN_FLIGHT.map(() => '?').join(',')})
        AND r.status != 'waiting'
      ORDER BY rj.created_at DESC LIMIT 50
    `).all(req.user.id, ...IN_FLIGHT);
    const submitted = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL AND rj.status='submitted'
      ORDER BY COALESCE(rj.finished_at, rj.created_at) DESC LIMIT 50
    `).all(req.user.id);
    const stopped = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL
        AND rj.status NOT IN (${[...IN_FLIGHT, ...NEEDS_YOU].map(() => '?').join(',')})
        AND rj.status != 'submitted'
      ORDER BY COALESCE(rj.finished_at, rj.created_at) DESC LIMIT 50
    `).all(req.user.id, ...IN_FLIGHT, ...NEEDS_YOU);

    // Every status this user actually has, with its count. The client asserts nothing against it;
    // it exists so "which bucket did this land in?" is answerable from the response alone, and so
    // test/applyObstacleSurfaces.test.js can prove the four buckets sum to the total.
    const statusCounts = Object.fromEntries(
      db.prepare(`SELECT status, COUNT(*) n FROM apply_run_jobs WHERE user_id=? AND hidden_at IS NULL GROUP BY status`)
        .all(req.user.id).map(r => [r.status, r.n])
    );

    res.json({
      runs: runs.map(publicRun),
      review: review.map(publicRunJob),
      gated: gated.map(publicRunJob),
      // D25: Draft House's In flight rows carry Stop, so the SERVER says which can be aborted — the
      // same rule the dated history and the abort endpoint use, never re-derived by the client.
      inFlight: inFlight.map(r => ({ ...publicRunJob(r), abortable: OUTCOME_STATUSES[OUTCOME.PENDING].includes(r.status) })),
      submitted: submitted.map(publicRunJob),
      stopped: stopped.map(publicRunJob),
      // A59: the user's line, next first — the same payload as GET /api/apply/line.
      line: publicLine(req.user.id),
      statusCounts,
    });
  });

  // ── A59: THE LINE, VIEWED AND EDITED ──────────────────────────────────────────────────────────
  //
  // ⭐ Every waiting Draft is viewable and editable BEFORE it begins (owner, O44): its place, its
  // job, and what the run will do and use. ⛔ A run that has STARTED is not editable, and the
  // refusal says so — every write below carries status='waiting' in its WHERE (or checks it inside
  // a transaction), because dispatchLine can claim the run between the user's read and their click.

  const TOOL_LABEL = { generate: "Generate", a_plus_resume: "A+ Resume" };

  /** What a run will do, in the user's words — the "what will be filled / generated" of the row. */
  function lineWillDo(run) {
    const tool = TOOL_LABEL[run.tool_type] || "Generate";
    if ((run.mode || "auto") !== "auto") {
      return `Opens the employer's form in a browser for you to finish by hand, with a résumé made by ${tool}.`;
    }
    if (run.approval_mode === "approved") {
      return "Sends the application you already approved, with exactly the answers you approved.";
    }
    if (run.approval_mode === "auto") {
      return `Fills the employer's form from your profile and SENDS it without a review, with a résumé made by ${tool}.`;
    }
    return "Fills the employer's form from your profile and stops before sending, to wait for your review. " +
      `The résumé and cover letter are made by ${tool} when you approve it.`;
  }

  function publicLine(userId) {
    const runs = waitingRuns(userId)
      .filter(r => db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE run_id=? AND status='queued'`).pluck().get(r.id));
    if (!runs.length) return { waiting: [], held: null };
    const profile = db.prepare(`
      SELECT dp.profile_name FROM domain_profiles dp WHERE dp.user_id=? AND dp.is_active=1 ORDER BY dp.id DESC LIMIT 1
    `).pluck().get(userId) ?? null;
    const jobsOf = db.prepare(`${RUN_JOB_SELECT} WHERE rj.run_id=? AND rj.status='queued' ORDER BY rj.id`);
    const held = lineHeldBy(runs[0]);
    return {
      waiting: runs.map((r, i) => ({
        ...publicRun(r),
        position: i + 1,
        // Only the tool is a choice here: an approved run sends what was approved, unchanged.
        editable: { tool: r.approval_mode !== "approved", order: true, remove: true },
        willDo: lineWillDo(r),
        // Read when the run STARTS, not now — said so, rather than implying it is pinned.
        usesProfile: profile,
        jobs: jobsOf.all(r.id).map(publicRunJob),
      })),
      held: held === "user_hold"
        ? { reason: "user_hold",
            message: "You stopped everything, so the line is not moving. Nothing in it will start until you resume." }
        : held === "kill_switch"
        ? { reason: "kill_switch",
            message: "Automatic applications are paused by the operator, so the line is not moving. Nothing in it will start until they are resumed." }
        : null,
    };
  }

  // ── D25: THE RUN BAR ─────────────────────────────────────────────────────────────────────────
  //
  // Draft House's top strip: the mode, the three caps with how much of each is used, and the
  // user's Stop everything. One read, so the bar never assembles itself from three endpoints that
  // could each be a poll apart.

  /** D100: the user's mode — 'auto' only when they chose FULL AUTO; NULL, unknown or a failed read is 'semi'. */
  function userApplyMode(userId) {
    try {
      const r = db.prepare("SELECT send_mode FROM users WHERE id = ?").get(userId);
      return r?.send_mode === "auto" ? "auto" : "semi";
    } catch { return "semi"; }
  }

  /**
   * D100: AUTO is selectable unless the operator's kill switch is on — the one lock left, a control.
   * The client renders AUTO selectable only when this says `locked: false`, and never decides it for itself.
   */
  function autoModeState() {
    const killSwitch = fullAutoDisabled();
    // ⭐ D88 P1: the lock is the resolver's auto_apply_mode — GLOBAL only (the kill switch); no override can lift it.
    const mode = resolveEntitlement(db, null, "auto_apply_mode").value;
    if (mode === "locked") {
      return { locked: true, reason: "kill_switch",
               message: "Automatic sending is paused by the operator.", killSwitch };
    }
    return { locked: false, reason: null, message: null, killSwitch };
  }

  function runBar(userId) {
    const queued = queuedLast24h(userId);
    const approved = approvedLast24h(userId);
    const submitted = submittedLast24h(userId);
    const cap = (id, label, bounds, used, limit) =>
      ({ id, label, bounds, used, limit, remaining: Math.max(0, limit - used) });
    const held = userHeld(db, userId);
    const since = userHoldSince(db, userId);
    return {
      // D100: the user's own mode (default SEMI). A Draft from the board, the deck or the extension still
      // previews and waits in either mode; FULL AUTO is what the scheduler's runs (D102 P4) send under.
      mode: { current: userApplyMode(userId), auto: autoModeState() },
      // The pipeline's own order, queue ≥ approval ≥ submission (docs/am2-approval-cap.md §4).
      windowHours: 24,
      caps: [
        cap("queue", "Previews", "applications opened and filled for review", queued, APPLY_DAILY_QUEUE_CAP),
        cap("approval", "Approvals", "tailored résumés and cover letters generated on approval", approved, APPLY_DAILY_APPROVAL_CAP),
        cap("submission", "Submitted", "applications submitted to employers", submitted, APPLY_DAILY_CAP),
      ],
      hold: { held, since: since ? since * 1000 : null },
    };
  }

  app.get("/api/apply/run-bar", requireAuth, (req, res) => {
    res.json(runBar(req.user.id));
  });

  /**
   * D100 / D102 P2: the run bar's SEMI / FULL AUTO switch. No lock — the user's choice, default SEMI.
   * Choosing FULL AUTO while the operator's kill switch is on is refused (409) rather than stored, so the
   * bar never shows a mode that cannot run; SEMI can always be chosen.
   */
  app.post("/api/apply/mode", requireAuth, (req, res) => {
    const { mode } = req.body || {};
    if (!APPLY_MODES.includes(mode)) {
      return res.status(400).json({ error: "bad_mode", message: 'POST {"mode": "semi"} or {"mode": "auto"}.' });
    }
    if (mode === "auto" && autoModeState().locked) {
      return res.status(409).json({ error: "full_auto_disabled",
        message: "Automatic sending is paused by the operator, so FULL AUTO cannot be chosen right now." });
    }
    db.prepare("UPDATE users SET send_mode = ? WHERE id = ?").run(mode, req.user.id);
    console.warn(`[apply] user ${req.user.id} mode → ${mode}`);
    res.json(runBar(req.user.id));
  });

  /**
   * Stop everything / Resume. Strict boolean, the kill switch's rule: a stop must never be flipped
   * by a typo coercing one way or the other. Releasing moves the line at once rather than at the
   * next tick, so Resume visibly does something.
   */
  app.post("/api/apply/hold", requireAuth, (req, res) => {
    const { held } = req.body || {};
    if (typeof held !== "boolean") {
      return res.status(400).json({ error: "held_must_be_boolean",
        message: 'POST {"held": true} to stop everything, {"held": false} to resume.' });
    }
    const userId = req.user.id;
    setUserHold(db, userId, held);
    console.warn(`[apply] user ${userId} ${held ? "STOPPED everything" : "resumed"}`);
    if (!held) {
      try { dispatchLine(userId); }
      catch (e) { console.error(`[applyRoutes] line user=${userId}: ${e.message}`); }
    }
    res.json({ ...runBar(userId), line: publicLine(userId) });
  });

  /** 404 when the run is not this user's; 409 run_started (with what it is now) when not waiting. */
  function notWaiting(res, userId, runId) {
    const run = db.prepare("SELECT status FROM apply_runs WHERE id=? AND user_id=?").get(runId, userId);
    if (!run) return res.status(404).json({ error: "run_not_found" });
    return res.status(409).json({
      error: "run_started",
      status: run.status,
      message: "This draft has already left the line, so it can no longer be edited or removed from it. " +
        "While it runs you can stop it from In flight.",
    });
  }

  app.get("/api/apply/line", requireAuth, (req, res) => {
    res.json({ ...publicLine(req.user.id), limits: { active: APPLY_MAX_ACTIVE_RUNS, waiting: APPLY_MAX_WAITING_RUNS } });
  });

  /** Edit what a waiting run will use. Today that is the résumé tool; A+ is entitlement-gated. */
  app.patch("/api/apply/line/:runId", requireAuth, (req, res) => {
    const runId = Number(req.params.runId);
    const { tool, toolType } = req.body || {};
    const want = tool ?? toolType;
    if (want !== "generate" && want !== "a_plus_resume")
      return res.status(400).json({ error: "tool_required", message: "tool must be generate or a_plus_resume." });
    const planTier = normalisePlanTier(req.user?.planTier);
    if (monetisationEnabled() && want === "a_plus_resume" && !canUseAPlusResume(planTier))
      return res.status(403).json({ error: "upgrade_required", message: "A+ Resume requires the PRO plan.",
        requiredTier: "PRO", planTier });
    const changed = db.prepare(`
      UPDATE apply_runs SET tool_type=?
      WHERE id=? AND user_id=? AND status='waiting' AND COALESCE(approval_mode, '') != 'approved'
    `).run(want, runId, req.user.id).changes;
    if (!changed) {
      const run = db.prepare("SELECT status, approval_mode FROM apply_runs WHERE id=? AND user_id=?").get(runId, req.user.id);
      if (run?.status === "waiting" && run.approval_mode === "approved")
        return res.status(409).json({ error: "approved_run_locked",
          message: "You approved this application as it is, so it sends exactly that. Remove it from the line to change it." });
      return notWaiting(res, req.user.id, runId);
    }
    res.json({ ok: true, line: publicLine(req.user.id) });
  });

  /** Reorder the line. The body is the WHOLE order, so a stale view is refused, never half-applied. */
  app.post("/api/apply/line/order", requireAuth, (req, res) => {
    const order = Array.isArray(req.body?.runIds) ? req.body.runIds.map(Number) : null;
    if (!order || !order.length) return res.status(400).json({ error: "runIds array required" });
    const result = db.transaction(() => {
      const current = waitingRuns(req.user.id).map(r => r.id);
      const same = current.length === order.length && new Set(order).size === order.length &&
        order.every(id => current.includes(id));
      if (!same) return false;
      const set = db.prepare(`UPDATE apply_runs SET line_position=? WHERE id=? AND user_id=? AND status='waiting'`);
      order.forEach((id, i) => set.run(i + 1, id, req.user.id));
      return true;
    })();
    if (!result)
      return res.status(409).json({ error: "line_changed",
        message: "The line changed while you were reordering it — a draft started or was removed. Here it is now.",
        line: publicLine(req.user.id) });
    res.json({ ok: true, line: publicLine(req.user.id) });
  });

  /** ⛔ D51: an undone Draft leaves /d and The Table too — the record its click wrote is released. */
  const releaseDrafted = (userId, jobIds) => {
    for (const id of jobIds) {
      try { releaseDraftRecord(db, userId, id); }
      catch (e) { console.warn(`[applyRoutes] release drafted record job=${id}: ${e.message}`); }
    }
  };

  /** Remove a whole waiting run from the line. Nothing was opened, so nothing needs undoing. */
  app.delete("/api/apply/line/:runId", requireAuth, (req, res) => {
    const runId = Number(req.params.runId);
    const lineJobIds = db.prepare("SELECT job_id FROM apply_run_jobs WHERE run_id=? AND user_id=? AND status='queued'")
      .pluck().all(runId, req.user.id);
    const removed = db.transaction(() => {
      const n = db.prepare(`
        UPDATE apply_runs SET status='cancelled', line_position=NULL, finished_at=unixepoch()
        WHERE id=? AND user_id=? AND status='waiting'
      `).run(runId, req.user.id).changes;
      if (!n) return false;
      db.prepare(`
        UPDATE apply_run_jobs SET status='cancelled', reason_code='removed_from_line',
               reason_detail='Removed from the line before it started. Nothing was opened or sent.',
               finished_at=unixepoch()
        WHERE run_id=? AND status='queued'
      `).run(runId);
      return true;
    })();
    if (!removed) return notWaiting(res, req.user.id, runId);
    // D53: removing from the line is CLEARING — the same 7-day bin as every other unsent state.
    try { binRunJobs(db, req.user.id, db.prepare("SELECT id FROM apply_run_jobs WHERE run_id=? AND user_id=? AND reason_code='removed_from_line'").pluck().all(runId, req.user.id)); }
    catch (e) { console.warn(`[applyRoutes] bin line run=${runId}: ${e.message}`); }
    releaseDrafted(req.user.id, lineJobIds);
    res.json({ ok: true, message: "Removed from the line. Nothing was opened or sent.", line: publicLine(req.user.id) });
  });

  /** Remove ONE job from a waiting run of several. Removing its last job removes the run. */
  app.delete("/api/apply/line/:runId/jobs/:runJobId", requireAuth, (req, res) => {
    const runId = Number(req.params.runId);
    const runJobId = Number(req.params.runJobId);
    const outcome = db.transaction(() => {
      const run = db.prepare("SELECT status FROM apply_runs WHERE id=? AND user_id=?").get(runId, req.user.id);
      if (!run || run.status !== "waiting") return "not_waiting";
      const n = db.prepare(`
        UPDATE apply_run_jobs SET status='cancelled', reason_code='removed_from_line',
               reason_detail='Removed from the line before it started. Nothing was opened or sent.',
               finished_at=unixepoch()
        WHERE id=? AND run_id=? AND status='queued'
      `).run(runJobId, runId).changes;
      if (!n) return "no_job";
      const left = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE run_id=? AND status='queued'`).pluck().get(runId);
      db.prepare(left
        ? `UPDATE apply_runs SET total_jobs=? WHERE id=?`
        : `UPDATE apply_runs SET total_jobs=?, status='cancelled', line_position=NULL, finished_at=unixepoch() WHERE id=?`)
        .run(left, runId);
      return "ok";
    })();
    if (outcome === "not_waiting") return notWaiting(res, req.user.id, runId);
    if (outcome === "no_job") return res.status(404).json({ error: "run_job_not_found" });
    const removedJob = db.prepare("SELECT job_id FROM apply_run_jobs WHERE id=? AND user_id=?").pluck().get(runJobId, req.user.id);
    try { binRunJobs(db, req.user.id, [runJobId]); } catch (e) { console.warn(`[applyRoutes] bin line job=${runJobId}: ${e.message}`); }
    releaseDrafted(req.user.id, removedJob == null ? [] : [removedJob]);
    res.json({ ok: true, line: publicLine(req.user.id) });
  });

  app.get("/api/apply/runs/:runId", requireAuth, (req, res) => {
    const run = db.prepare("SELECT * FROM apply_runs WHERE id=? AND user_id=?")
      .get(Number(req.params.runId), req.user.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    const jobs = db.prepare(`${RUN_JOB_SELECT} WHERE rj.run_id=? ORDER BY rj.id`).all(run.id);
    // Log lines carry job_id but the panel rendered only the message, so "7 fields filled" gave no
    // indication of WHICH application or site it referred to. Joining the posting lets each line
    // name its target.
    const logs = db.prepare(`
      SELECT l.*, sj.title, sj.company
      FROM apply_job_logs l
      LEFT JOIN scraped_jobs sj ON sj.job_id = l.job_id
      WHERE l.run_id=? ORDER BY l.created_at, l.id
    `).all(run.id);
    res.json({
      run: publicRun(run),
      jobs: jobs.map(publicRunJob),
      logs: logs.map(l => ({
        id: l.id,
        jobId: l.job_id,
        title: l.title ?? null,
        company: l.company ?? null,
        level: l.level || "info",
        event: l.event,
        message: l.message,
        createdAt: toMs(l.created_at),
      })),
    });
  });

  app.get("/api/apply/review", requireAuth, (req, res) => {
    const jobs = db.prepare(`
      SELECT rj.*, r.mode, sj.title, sj.company AS sj_company, sj.url, sj.apply_url
      FROM apply_run_jobs rj
      JOIN apply_runs r ON r.id = rj.run_id
      LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id=? AND rj.status='held_review'
      ORDER BY rj.created_at DESC LIMIT 50
    `).all(req.user.id);
    // Additive: openQuestions is parsed alongside the existing row shape, so a caller that ignores
    // it is unaffected. This is the read half of the validation-correction loop.
    res.json({ jobs: jobs.map(withOpenQuestions) });
  });

  // ── Review artifacts (read-only) ─────────────────────────────────────────────
  // A3 already persists everything needed to reconstruct what was sent to an employer — the resume
  // artifact id, the resolved answers with A2's provenance/confidence, the screenshot, and the submit
  // evidence. None of it was reachable over HTTP, so an application could not actually be reviewed,
  // before or after submission. These three endpoints serve that record. They are strictly read-only:
  // nothing here changes whether, when, or what gets submitted.
  //
  // Keyed on apply_run_jobs.id (the run job), not scraped_jobs.job_id — the audit columns live on the
  // run job, and the same posting can be attempted more than once.

  const ownedRunJob = (runJobId, userId) => {
    const id = Number(runJobId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return db.prepare(`
      SELECT rj.*, r.mode, sj.title, sj.company AS sj_company
      FROM apply_run_jobs rj
      JOIN apply_runs r ON r.id = rj.run_id
      LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.id=? AND rj.user_id=?
    `).get(id, userId) || null;
  };

  /** The full record of one application attempt: what was answered, with what confidence, and why. */
  app.get("/api/apply/run-jobs/:runJobId/review", requireAuth, (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });
    res.json({
      runJobId:  rj.id,
      runId:     rj.run_id,
      jobId:     rj.job_id,
      title:     rj.title,
      company:   rj.sj_company,
      mode:      rj.mode,
      status:    rj.status,
      reasonCode:   rj.reason_code,
      reasonDetail: rj.reason_detail,
      // Every answer with the rule that produced it. A 'label_fuzzy' answer is a guess; an
      // 'handler_exact'/'field_map_exact'/'custom_answer' one is not. That distinction is the
      // point of showing this at all.
      answers:       parseJson(rj.answers_json, []),
      openQuestions: parseJson(rj.open_questions_json, []),
      resume: {
        artifactId: rj.resume_artifact_id ?? null,
        atsScore:   rj.resume_ats_score ?? null,
        available:  rj.resume_artifact_id != null,
      },
      // AL2 — the free base-resume fit, and the terms behind it. On a deferred row this is what
      // the approve decision is actually made on; the FULL matched/missing sets are served here
      // (the pending list caps them) because this is the screen where a user checks the number
      // rather than just reading it.
      baseAts: (() => {
        const b = baseAtsFor(rj);
        if (!b) return null;
        const parsed = parseJson(rj.base_ats_json, null) || {};
        return { ...b, matched: parsed.matched || [], missing: parsed.missing || [] };
      })(),
      generationDeferred: rj.resume_artifact_id == null && rj.base_ats_json != null,
      submission: {
        verified: rj.submit_verified === 1,
        evidence: rj.submit_evidence ?? null,
      },
      // AH5: a hold that says "required fields were left empty" and does not say WHICH is a hold
      // the candidate cannot act on — the same defect class as the old unscoped review modal. The
      // list existed; it lived in an apply_job_logs event that no surface reads.
      missingRequired: parseJson(rj.blanks_json, [])
        .filter(b => b?.required).map(b => b.label || b.field).filter(Boolean),
      screenshotAvailable: !!rj.screenshot_path,
      fillLogAvailable: rj.blanks_json != null || rj.answers_json != null,
    });
  });

  /**
   * THE FILL LOG (AH5) — what this run put in the form, and what it did not.
   *
   * ON DEMAND, and text. AB1/AE4 removed the "What we filled" screenshot correctly: it was a dead
   * snapshot of a browser context that had already closed. What was needed instead is a record you
   * can read, and every part of it was already being written — answers_json since A2 carries each
   * filled field with the rule that produced it, fields_discovered and corrections_json since AF5,
   * blanks_json since AH5. This composes them; it stores nothing of its own, so there is no second
   * copy to drift.
   *
   * The BLANK half is read off the post-fill discovery pass, so it is the actual state of the form
   * rather than a gate's opinion of it. That matters most in semi, where neither gate runs at all:
   * a fill log built from gate output would faithfully report the same silence the gates do.
   */
  app.get("/api/apply/run-jobs/:runJobId/fill-log", requireAuth, (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });

    const answers = parseJson(rj.answers_json, []);
    const blanks = parseJson(rj.blanks_json, null);
    const corrections = parseJson(rj.corrections_json, []);

    const filled = answers
      .filter(a => !a?.skipped)
      .map(a => ({
        field: a.field_id ?? a.name ?? null,
        label: a.label || a.name || a.field_id || null,
        value: a.value ?? null,
        provenance: a.provenance ?? null,
        confidence: a.confidence ?? null,
      }));

    // The reuse decision is recorded as a run event rather than a column: it is a fact about the
    // RUN, and apply_job_logs is where the run's own account of itself already lives.
    const reuse = (() => {
      try {
        const row = db.prepare(`
          SELECT event, message, details_json FROM apply_job_logs
          WHERE run_job_id=? AND event IN ('resume_reused','resume_regenerating')
          ORDER BY id DESC LIMIT 1
        `).get(rj.id);
        if (!row) return null;
        const d = parseJson(row.details_json, {}) || {};
        return { reused: row.event === "resume_reused", reason: d.reason ?? null, summary: row.message };
      } catch { return null; }
    })();

    res.json({
      runJobId: rj.id,
      jobId: rj.job_id,
      status: rj.status,
      reasonCode: rj.reason_code,
      // null means the run never reached discovery. 0 would claim it looked and found nothing.
      fieldsDiscovered: rj.fields_discovered ?? null,
      filled,
      // null and [] are different answers: "we never looked at the form" vs "we looked at every
      // field and none is empty".
      blanks,
      corrections,
      resume: {
        artifactId: rj.resume_artifact_id ?? null,
        atsScore: rj.resume_ats_score ?? null,
        reuse,
      },
    });
  });

  /**
   * The resume for this attempt, as a PDF.
   *
   * IMPORTANT: this is RE-RENDERED from the stored `resumes.html`, not the archived upload — the temp
   * PDF is deleted in processRunJob's `finally`. It is a faithful reconstruction of the same source,
   * which is what the audit trail was designed around, but it is not guaranteed byte-identical to the
   * file the employer received: a different Chromium build or missing font would render differently.
   * Treat it as "the resume this application was built from", not as a forensic copy.
   */
  app.get("/api/apply/run-jobs/:runJobId/resume", requireAuth, async (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });
    if (rj.resume_artifact_id == null) {
      return res.status(404).json({
        error: "no_resume_artifact",
        message: "No resume artifact was recorded for this application.",
      });
    }
    // Re-check ownership on the artifact itself rather than trusting the foreign key.
    const artifact = db.prepare("SELECT html FROM resumes WHERE id=? AND user_id=?")
      .get(rj.resume_artifact_id, req.user.id);
    if (!artifact?.html) {
      return res.status(404).json({
        error: "resume_artifact_missing",
        message: "The resume this application used is no longer stored.",
      });
    }
    try {
      const pdf = await htmlToPdf(artifact.html);
      const safe = String(rj.job_id).replace(/[^a-z0-9._-]+/gi, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition",
        `${req.query.download ? "attachment" : "inline"}; filename="resume-${safe}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      // PDF rendering needs a browser; on a host without one this is the same failure the apply
      // path hits, and it should read as unavailable rather than as a missing resume.
      return res.status(503).json({
        error: "pdf_render_failed",
        message: err?.message || "Could not render the resume to PDF.",
      });
    }
  });

  /** The screenshot taken at the end of the attempt — the visual proof of what the form looked like. */
  app.get("/api/apply/run-jobs/:runJobId/screenshot", requireAuth, (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });
    if (!rj.screenshot_path) return res.status(404).json({ error: "no_screenshot" });
    // The value is written by our own takeScreenshot(), but serving a DB string as a filesystem path
    // is precisely the shape that becomes an arbitrary-file read if anything upstream ever changes.
    // Confine it to the screenshot directory and refuse anything else.
    const resolved = path.resolve(rj.screenshot_path);
    if (resolved !== path.resolve(SCREENSHOT_DIR) &&
        !resolved.startsWith(path.resolve(SCREENSHOT_DIR) + path.sep)) {
      return res.status(403).json({ error: "screenshot_outside_store" });
    }
    if (!existsSync(resolved)) return res.status(404).json({ error: "screenshot_missing" });
    res.setHeader("Content-Type", "image/png");
    return res.sendFile(resolved);
  });

  // ── Gated handoff: packet list, token mint, packet exchange (TASK G1) ────────
  // The server prepared everything it could and then met a gate only a human can cross. These three
  // endpoints are how what it prepared reaches the extension standing on the other side.
  //
  // Nothing here submits, and nothing here crosses a gate. See §6.

  /** Attempts in the recent window, counted from the durable log rather than process memory. */
  function gateExchangeAttempts(userId) {
    const since = Math.floor(Date.now() / 1000) - GATE_EXCHANGE_WINDOW_SEC;
    return db.prepare(`
      SELECT COUNT(*) AS c FROM apply_job_logs
      WHERE user_id=? AND event LIKE 'gate_packet_exchange%' AND created_at > ?
    `).get(userId, since).c;
  }

  /**
   * Log an exchange outcome. Every rejection reason is its OWN event (requirement 4): a forged
   * signature, an expired token, a replayed one and one belonging to another account are four
   * different facts, and only one of them means somebody is probing.
   */
  function logExchange(userId, outcome, details = {}) {
    logEvent(details.runId ?? null, details.runJobId ?? null, userId, details.jobId ?? "-",
      `gate_packet_exchange_${outcome}`, `Gate packet exchange: ${outcome}`, details);
  }

  /** Jobs held at a gate, with what is prepared for each. Grouped by portal in G5; flat here. */

  // ── TASK AC4: RUN HISTORY, DATE-DRIVEN AND ON DEMAND ─────────────────────────────────────────
  //
  // The panel's history was a small expandable list of the last 20 RUNS. A run is an implementation
  // detail — nobody thinks "run 47" — and twenty of them is neither all of the history nor a
  // useful window on it. This is the same record asked the question a candidate actually has:
  // what did I put into auto-apply on this day, and how did each one end.
  //
  // DATE-SCOPED AND USER-SCOPED ON THE SERVER (requirement 5). Explicitly not "fetch all history and
  // filter client-side": that would defeat requirement 2's on-demand loading, it would grow without
  // bound, and it would ship every application a user has ever attempted to the browser to render
  // one day of it. The index added by migration 085 — (user_id, created_at) — is the exact shape of
  // this query; the pre-existing idx_apply_run_jobs_user_status leads with status and cannot serve
  // a date range.
  //
  // WHICH DATE. `created_at` — when the application was ADDED to auto-apply, which is what the
  // requirement asks for ("the applications added to auto-apply on that date") and what a user
  // remembers doing. finished_at would scatter one afternoon's queueing across several days
  // depending on when each job happened to be picked up.
  //
  // THE TIMEZONE, which is not a detail here. created_at is unixepoch seconds, i.e. UTC. The
  // calendar hands over a LOCAL date. Without the offset, a run queued at 8pm in Boston lands on
  // the next UTC day, and the user picks the day they remember and is told nothing happened. The
  // client sends its own getTimezoneOffset(); the day boundary is computed from it. Absent or
  // malformed, it falls back to UTC — which is the old behaviour, not a crash.
  const dayRangeUtc = (dateStr, offsetMinutes) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
    if (!m) return null;
    const [, y, mo, d] = m;
    // Date.UTC of the local wall-clock midnight, then shifted by the offset to reach the real
    // instant. getTimezoneOffset() is minutes WEST of UTC (Boston in winter is +300), so local
    // midnight is that many minutes LATER in UTC — hence the addition.
    const off = Number.isFinite(Number(offsetMinutes)) ? Number(offsetMinutes) : 0;
    const startMs = Date.UTC(Number(y), Number(mo) - 1, Number(d)) + off * 60_000;
    return { start: Math.floor(startMs / 1000), end: Math.floor(startMs / 1000) + 86400 };
  };

  /**
   * THE DATE OF THE MOST RECENT ACTIVITY (AH6). One row, one MAX, no listing.
   *
   * AD1 made the panel open on nothing and ask which day you mean, and that inversion was right
   * about one thing and wrong about another. Right: the panel must not silently ship a day's worth
   * of applications you did not ask for. Wrong: it landed on a blank board with a prompt, and the
   * commonest reason to open Auto Apply is to see what happened on the last run — which was almost
   * never today. So the answer to "which day?" was one the panel could have worked out.
   *
   * This is the cheap half of that. It returns a DATE, not a listing: the caller then asks for that
   * day through the ordinary /api/apply/history path, so there is still exactly one way to load a
   * day's rows and the counts still come from the same partition as the rows.
   *
   * Keyed on created_at like the day filter itself — WHEN YOU QUEUED IT, not when it finished — so
   * "your most recent activity" means the same thing here as it does on the calendar.
   */
  app.get("/api/apply/history/latest", requireAuth, (req, res) => {
    const row = db.prepare(`
      SELECT MAX(created_at) AS latest FROM apply_run_jobs
      WHERE user_id=? AND hidden_at IS NULL
    `).get(req.user.id);
    if (!row?.latest) return res.json({ date: null });
    // Rendered in the CALLER'S day, for the same reason dayRangeUtc takes an offset: a run queued
    // at 9pm in Boston belongs to that Boston day, not to the UTC one it lands in.
    const off = Number.isFinite(Number(req.query.tzOffset)) ? Number(req.query.tzOffset) : 0;
    const local = new Date((row.latest - off * 60) * 1000);
    const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
    res.json({ date });
  });

  /**
   * One day's applications, in three groups — or, since AD1, ONE group of them plus the counts of
   * all three.
   *
   * Nothing here loads unless a date is asked for — there is no "recent" default and no implicit
   * today. AH6 gives the PANEL a default (the date above) but not this endpoint: a caller still has
   * to name the day it wants, so an accidental mount cannot ship a listing.
   *
   * ── TASK AD1: `group`, AND WHY THE COUNTS ARE NOT A SECOND REQUEST ─────────────────────────
   *
   * AD1 turns the three outcome groups into SUB-TABS and states the rule directly: "Switching
   * sub-tabs with a date selected refetches for that tab; it must not load all three." So the
   * endpoint learned to answer for one group. `group` is OPTIONAL and its absence keeps the
   * original three-group shape, which is what AC4's own tests read and what any other caller would
   * expect — this is additive, not a replacement.
   *
   * The counts, though, are needed for ALL THREE tabs whichever one is open, and AD1 requirement 4
   * makes them date-scoped. Two ways to get them, and only one is honest:
   *
   *   - three requests, or one request that returns every row and is then filtered — which is the
   *     "must not load all three" the requirement forbids, wearing a different hat;
   *   - one aggregate over the SAME day range that reads `status` and whether the posting join came
   *     back empty, and nothing else. No artifacts, no answers, no reasons — just enough to run
   *     outcomeGroupFor, which is the only thing that can produce these numbers correctly because
   *     the dead-posting override is not expressible as a GROUP BY status.
   *
   * It is the second. A day holds tens of run-jobs, not thousands, and this reads two columns from
   * them. The full-row SELECT — the one with the joins and the artifact probes — runs for the ONE
   * group asked for.
   */
  app.get("/api/apply/history", requireAuth, (req, res) => {
    const range = dayRangeUtc(req.query.date, req.query.tzOffset);
    if (!range) return res.status(400).json({ error: "bad_date", message: "Expected date=YYYY-MM-DD." });

    // An unrecognised group is a 400 rather than a silent fallback to "all three": a typo'd tab
    // name would otherwise ship the whole day to a client that asked for a slice of it, which is
    // the exact thing requirement 3 is trying to prevent, and it would do it invisibly.
    const asked = req.query.group ? String(req.query.group) : null;
    if (asked && !Object.prototype.hasOwnProperty.call(OUTCOME_STATUSES, asked)) {
      return res.status(400).json({
        error: "bad_group",
        message: `Expected group to be one of ${Object.keys(OUTCOME_STATUSES).join(", ")}.`,
      });
    }

    // THE COUNTS. Two columns per run-job for the day, run through the same partition the rows use,
    // so a tab's number and that tab's contents cannot disagree.
    const counts = { [OUTCOME.COMPLETED]: 0, [OUTCOME.PENDING]: 0, [OUTCOME.ABORTED]: 0 };
    const tally = db.prepare(`
      SELECT rj.status AS status, (sj.job_id IS NULL) AS postingGone
      FROM apply_run_jobs rj
      LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id=? AND rj.hidden_at IS NULL
        AND rj.created_at >= ? AND rj.created_at < ?
    `).all(req.user.id, range.start, range.end);
    for (const t of tally) {
      counts[outcomeGroupFor({ status: t.status, postingGone: !!t.postingGone })] += 1;
    }

    const rows = db.prepare(`
      ${RUN_JOB_SELECT}
      WHERE rj.user_id=? AND rj.hidden_at IS NULL
        AND rj.created_at >= ? AND rj.created_at < ?
      ${asked
        // The status filter narrows the read, and the dead-posting override is then applied per row
        // below. PENDING has to over-fetch and drop, because a row can be PENDING by status and
        // ABORTED in reality; ABORTED has to over-fetch the PENDING statuses for the mirror reason.
        // Stated rather than hidden, because "SELECT the group's statuses" looks sufficient and is
        // not — that is precisely the bug the override exists to prevent.
        ? `AND rj.status IN (${[...OUTCOME_STATUSES[asked],
             ...(asked === OUTCOME.ABORTED ? OUTCOME_STATUSES[OUTCOME.PENDING] : [])]
             .map(() => "?").join(",")})`
        : ""}
      ORDER BY rj.created_at DESC, rj.id DESC
    `).all(req.user.id, range.start, range.end,
           ...(asked ? [...OUTCOME_STATUSES[asked],
                        ...(asked === OUTCOME.ABORTED ? OUTCOME_STATUSES[OUTCOME.PENDING] : [])]
                     : []));

    // The partition, from shared/applyOutcomeGroups.js so the panel cannot disagree with it. Each
    // row lands in exactly one group; outcomeGroupFor is total by construction (an unmapped status
    // is ABORTED rather than dropped) and asserted total by test/applyRunHistory.test.js.
    const groups = { [OUTCOME.COMPLETED]: [], [OUTCOME.PENDING]: [], [OUTCOME.ABORTED]: [] };
    for (const r of rows) {
      const pub = publicRunJob(r);
      // The dead-posting override needs to know the posting is gone, and that is the LEFT JOIN
      // coming back empty rather than anything on the run-job row.
      const group = outcomeGroupFor({ ...pub, postingGone: r.title == null && r.company == null });
      groups[group].push({
        ...pub,
        postingGone: r.title == null && r.company == null,
        // Whether THIS row can still be aborted, decided by the server. The client must not
        // re-derive it: the button's presence and the endpoint's guard have to agree, and two
        // copies of that rule is how a button appears for something the server will refuse.
        abortable: OUTCOME_STATUSES[OUTCOME.PENDING].includes(r.status),
      });
    }

    res.json({
      date: req.query.date,
      // Empty is a NORMAL state, not an error and not a spinner (requirement 6). The response is
      // shaped identically whether or not anything happened, so the client renders emptiness from
      // data rather than from the absence of it.
      //
      // `total` is the DAY's total in both shapes — it is what "nothing happened on this date"
      // means, and scoping it to the asked-for group would make an empty COMPLETED tab on a busy
      // day claim the day itself was empty. That is what `counts` is for.
      total: counts[OUTCOME.COMPLETED] + counts[OUTCOME.PENDING] + counts[OUTCOME.ABORTED],
      counts,
      ...(asked
        ? { group: asked, jobs: groups[asked] }
        : {
            completed: groups[OUTCOME.COMPLETED],
            pending:   groups[OUTCOME.PENDING],
            aborted:   groups[OUTCOME.ABORTED],
          }),
    });
  });

  /**
   * Which dates in a month have anything on them (requirement 7: dates with activity should be
   * discoverable — the user should not hunt blindly).
   *
   * THE TRADEOFF, STATED. Requirement 7 allows a calendar marker only if it does not violate
   * requirement 2. This does not: requirement 2 is that "the panel's initial render issues no
   * history query", and this fires when the user OPENS THE CALENDAR, which is an action they took.
   * The panel can be mounted, scrolled and read without ever calling it.
   *
   * It is a COUNT-PER-DAY aggregate over one month — no rows, no joins, served by the same
   * (user_id, created_at) index — so it is cheap in a way that fetching the month's runs would not
   * be. If an owner would still rather have no query at all before a date is picked, deleting the
   * `loadHistoryMonth` call in AutoApplyContext removes it and leaves the picker working blind.
   */
  app.get("/api/apply/history/months/:month", requireAuth, (req, res) => {
    const m = /^(\d{4})-(\d{2})$/.exec(String(req.params.month || ""));
    if (!m) return res.status(400).json({ error: "bad_month", message: "Expected YYYY-MM." });
    const [, y, mo] = m;
    const off = Number.isFinite(Number(req.query.tzOffset)) ? Number(req.query.tzOffset) : 0;
    const start = Math.floor((Date.UTC(Number(y), Number(mo) - 1, 1) + off * 60_000) / 1000);
    const end   = Math.floor((Date.UTC(Number(y), Number(mo), 1) + off * 60_000) / 1000);

    // Bucketed in SQL by the same local-day boundary the day query uses, so a date that is marked
    // is a date that returns rows. Two different definitions of "day" between the marker and the
    // fetch would put a dot on an empty day, which is worse than no dot.
    const rows = db.prepare(`
      SELECT strftime('%Y-%m-%d', (rj.created_at - ?) , 'unixepoch') AS day, COUNT(*) AS n
      FROM apply_run_jobs rj
      WHERE rj.user_id=? AND rj.hidden_at IS NULL
        AND rj.created_at >= ? AND rj.created_at < ?
      GROUP BY day
    `).all(off * 60, req.user.id, start, end);

    res.json({ month: req.params.month, days: Object.fromEntries(rows.map(r => [r.day, r.n])) });
  });

  /**
   * ABORT one pending run-job (requirement 4).
   *
   * THE ORDER OF THE THREE STEPS IS THE SAFETY PROPERTY, and it is:
   *
   *   1. WRITE 'cancelled' FIRST, conditionally on the row still being pending. better-sqlite3 is
   *      synchronous, so `UPDATE ... WHERE status IN (pending)` is one atomic decision — it both
   *      claims the abort and rejects it if the run finished a millisecond ago. Doing this first is
   *      what makes the worker's `AND status != 'cancelled'` guard bite: processRunJob's terminal
   *      write loses to a row already marked cancelled, so a run that completes during the abort
   *      cannot overwrite it, and one that is still going cannot be recorded as failed when its
   *      browser is closed underneath it.
   *   2. VOID THE PACKET. A prepared handoff for an application the user just stopped is a live
   *      credential-bearing artifact for work that is not happening; consumed_at is how a packet is
   *      retired everywhere else, so it drops out of GET /api/apply/gate-packets, out of the portal
   *      batches, and out of the token mint — which refuses a consumed packet.
   *   3. TELL THE BROWSER. requestAbort sets its flag and closes the Chromium process. The page,
   *      the frames and the filled DOM go with it. Every await in flight rejects; the flag in front
   *      of autoApply's catch is what keeps that from being reported as a browser failure.
   *
   * WHAT CANNOT BE PROMISED, said plainly rather than implied: an abort that arrives after the
   * submit click has dispatched cannot recall it. That window is one statement wide — autoApply
   * checks the flag immediately before the click — and the run reports what it observed rather than
   * assuming. Everything before that point is guaranteed not to submit.
   */
  app.post("/api/apply/run-jobs/:runJobId/abort", requireAuth, (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });

    const PENDING = OUTCOME_STATUSES[OUTCOME.PENDING];
    // 1. Claim it. The WHERE clause is the race guard — see above.
    const claimed = db.prepare(`
      UPDATE apply_run_jobs
      SET status='cancelled', reason_code='user_aborted',
          reason_detail='You stopped this application. Nothing was submitted.',
          finished_at=unixepoch()
      WHERE id=? AND user_id=? AND status IN (${PENDING.map(() => "?").join(",")})
    `).run(rj.id, req.user.id, ...PENDING);

    if (claimed.changes === 0) {
      // It finished between the panel rendering the button and the click landing. Reported as a
      // conflict with the status it actually reached, so the UI can say what happened instead of
      // showing a generic failure for an application that may well have been submitted.
      const now = db.prepare("SELECT status FROM apply_run_jobs WHERE id=? AND user_id=?")
        .get(rj.id, req.user.id);
      return res.status(409).json({
        error: "not_abortable",
        status: now?.status ?? null,
        message: now?.status === "submitted"
          ? "This one was submitted before the abort reached it. It cannot be recalled."
          : `This application already finished (${now?.status ?? "unknown"}), so there was nothing to stop.`,
      });
    }

    // 2. Void the packet. Unconsumed packets for this run-job AND for this posting: a re-run makes
    //    a new run-job, and an older attempt's packet is still a usable handoff into the same form.
    const voided = db.prepare(`
      UPDATE apply_gate_packets SET consumed_at=unixepoch()
      WHERE user_id=? AND consumed_at IS NULL AND (run_job_id=? OR job_id=?)
    `).run(req.user.id, rj.id, String(rj.job_id));

    // 3. Stop the browser, if one is running for this posting.
    //    Fire-and-forget on purpose: browser.close() can take seconds against a hung page, and the
    //    row is ALREADY cancelled — making the user wait on Chromium to acknowledge a decision the
    //    database has recorded would turn a click into a spinner for no added guarantee.
    // The flag is NOT cleared here. requestAbort resolves as soon as the Chromium process is
    // gone, while the run that was awaiting a page operation is still unwinding through its own
    // catch — clearing it in that window makes the catch attribute a deliberate stop to the browser.
    // processRunJob's `finally` clears it once the run has actually finished; a five-minute TTL in
    // applyAutomation is the backstop for when there was no run in flight to do so.
    requestAbort(rj.job_id).catch(e => console.warn("[applyRoutes] abort:", e.message));

    // A59: Undo on a Draft that is still WAITING in line aborts its only job — the run leaves the
    // line now, rather than sitting in it empty until it reaches the head. (Status read first: a
    // database without migration 120 has no waiting runs and never compiles the column.)
    if (db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(rj.run_id) === "waiting") {
      db.prepare(`
        UPDATE apply_runs SET status='cancelled', line_position=NULL, finished_at=unixepoch()
        WHERE id=? AND status='waiting'
          AND NOT EXISTS (SELECT 1 FROM apply_run_jobs WHERE run_id=? AND status='queued')
      `).run(rj.run_id, rj.run_id);
    }

    logEvent(rj.run_id, rj.id, req.user.id, rj.job_id, "run_job_cancelled",
      "Aborted by the user. The browser was closed, nothing was submitted, and the prepared handoff was voided.",
      { packetsVoided: voided.changes });

    releaseDrafted(req.user.id, [rj.job_id]);
    res.json({ ok: true, runJobId: rj.id, status: "cancelled", packetsVoided: voided.changes });
  });

  /**
   * HIDE one run-job from the user's own view (requirement 4's DELETE).
   *
   * IT IS A SOFT HIDE, FOR EVERYTHING, AND THAT IS THE DECISION. The requirement asks which was
   * implemented and recommends soft-hide for submitted; this goes further and soft-hides all of it.
   *
   *   A submitted application is EVIDENCE THAT REACHED A REAL EMPLOYER. That record — the date, the
   *   exact resume, the screenshot of the form as sent — is what the candidate needs when an
   *   interview lands three weeks later, and it must not be destroyable by a click made while
   *   tidying up. So submitted rows are never hard-deleted.
   *
   *   And rather than two code paths with different consequences, nothing is. Three things a DELETE
   *   would have cost, none of them obvious at the call site:
   *     - apply_job_logs.run_job_id and apply_gate_packets.run_job_id both cascade ON DELETE, so
   *       removing one run-job would silently take its whole audit trail with it.
   *     - apply_runs' submitted_count / held_count / failed_count are STORED counters. Deleting a
   *       row would leave the run claiming work that no longer exists.
   *     - A hide is reversible by an operator (`SET hidden_at=NULL`). A delete is a support ticket
   *       that cannot be answered.
   *
   * A pending application is ABORTED FIRST, not merely hidden: hiding a running job would take it
   * off the user's screen while its browser carried on filling a real employer's form. "Remove
   * this" cannot mean "stop looking at it while it continues".
   */
  /**
   * ⭐ D53 · CLEAR ONE RUN-JOB — Remove, removal from the line and the bulk clear all come here, so the
   * behaviour is the same in every unsent state. Stops it first if it is still pending (AC4), hides it,
   * and — unless it was SUBMITTED — puts it in the 7-day bin (services/draftBin.js). A submitted row is
   * history: hiding it from Draft House stays AC4's soft hide, never binned, never purged.
   */
  function clearRunJob(userId, rj) {
    // ⛔ D53: only what is LIVE is stopped (queued, running) — a parked item (held_review, held_gate) is
    // binned untouched, so Restore puts it back exactly as it was. AC4 cancelled every "pending" row,
    // which made a held item unrestorable. Its packets are hidden with it (the list and the mint read
    // hidden_at), not voided. A submitted row is hidden as before and never binned.
    const LIVE = ["queued", "running"];
    const wasPending = LIVE.includes(rj.status);
    if (wasPending) {
      const PENDING = LIVE;
      db.prepare(`
        UPDATE apply_run_jobs
        SET status='cancelled', reason_code='cleared',
            reason_detail='You cleared this application. Nothing was submitted.',
            finished_at=unixepoch()
        WHERE id=? AND user_id=? AND status IN (${PENDING.map(() => "?").join(",")})
      `).run(rj.id, userId, ...PENDING);
      db.prepare(`
        UPDATE apply_gate_packets SET consumed_at=unixepoch()
        WHERE user_id=? AND consumed_at IS NULL AND (run_job_id=? OR job_id=?)
      `).run(userId, rj.id, String(rj.job_id));
      // Not cleared here either — same reason as the abort endpoint above.
      requestAbort(rj.job_id).catch(e => console.warn("[applyRoutes] abort-on-delete:", e.message));
    }

    db.prepare("UPDATE apply_run_jobs SET hidden_at=unixepoch() WHERE id=? AND user_id=?")
      .run(rj.id, userId);
    let binned = false;
    try { binned = binRunJobs(db, userId, [rj.id]).cleared.length === 1; }
    catch (e) { console.warn(`[applyRoutes] bin run-job=${rj.id}: ${e.message}`); }   // pre-130 schema

    logEvent(rj.run_id, rj.id, userId, rj.job_id, "run_job_hidden",
      wasPending
        ? `Cleared. It was still pending, so it was stopped first — nothing was submitted.${binned ? ` In the bin for ${BIN_DAYS} days.` : ""}`
        : binned ? `Cleared — in the bin for ${BIN_DAYS} days, then purged.`
        : "Removed from your history. The record is retained and can be restored by an operator.",
      { previousStatus: rj.status, aborted: wasPending, binned });
    releaseDrafted(userId, [rj.job_id]);
    return { wasPending, binned };
  }

  app.delete("/api/apply/run-jobs/:runJobId", requireAuth, (req, res) => {
    const rj = ownedRunJob(req.params.runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });
    const { wasPending, binned } = clearRunJob(req.user.id, rj);
    res.json({
      ok: true,
      runJobId: rj.id,
      hidden: true,
      // Said back to the caller so the UI can be honest about what "delete" did, rather than
      // implying an erasure that did not happen.
      softHide: true,
      abortedFirst: wasPending,
      // D53: in the bin (restorable for BIN_DAYS), or — a submitted one — hidden and kept, never purged.
      binned,
      binDays: binned ? BIN_DAYS : null,
    });
  });

  // ── D53 · THE BIN ─────────────────────────────────────────────────────────────────────────────────
  /** Bulk clear: the ids given, or every unsent item older than 7 / 30 days. Submitted ones are refused. */
  app.post("/api/apply/bin/clear", requireAuth, (req, res) => {
    const { runJobIds = null, olderThanDays = null, dryRun = false } = req.body || {};
    const userId = req.user.id;
    let ids;
    if (Array.isArray(runJobIds)) ids = runJobIds.map(Number).filter(Number.isInteger).slice(0, 500);
    else if (olderThanDays === 7 || olderThanDays === 30) {
      ids = db.prepare(`SELECT id FROM apply_run_jobs WHERE user_id=? AND hidden_at IS NULL AND status <> 'submitted'
        AND COALESCE(created_at, 0) < unixepoch() - ? ORDER BY id LIMIT 500`).pluck().all(userId, olderThanDays * 86400);
    } else return res.status(400).json({ error: "bad_clear", message: "Give runJobIds, or olderThanDays of 7 or 30." });
    // The count the confirmation states, measured — never guessed client-side.
    if (dryRun === true) return res.json({ ok: true, dryRun: true, count: ids.length });
    const cleared = [], refused = [];
    for (const id of ids) {
      const rj = ownedRunJob(id, userId);
      if (!rj || rj.status === "submitted") { refused.push(id); continue; }
      clearRunJob(userId, rj); cleared.push(id);
    }
    res.json({ ok: true, cleared, refused, binDays: BIN_DAYS,
      message: `Cleared ${cleared.length}. They stay in the bin for ${BIN_DAYS} days.` +
        (refused.length ? ` ${refused.length} could not be cleared — a sent application is history, kept on The Table.` : "") });
  });

  app.get("/api/apply/bin", requireAuth, (req, res) => {
    res.json({ items: listBin(db, req.user.id), binDays: BIN_DAYS });
  });

  app.post("/api/apply/bin/:runJobId/restore", requireAuth, (req, res) => {
    const out = restoreFromBin(db, req.user.id, req.params.runJobId);
    if (!out.ok) return res.status(404).json({ error: out.code, message: "It is not in the bin — restored already, or purged." });
    logEvent(out.runId, out.id, req.user.id, out.jobId, "run_job_restored", "Restored from the bin.", { status: out.status });
    res.json({ ok: true, runJobId: out.id, jobId: out.jobId, status: out.status,
      // One that was still running when cleared was stopped by the clear: it comes back stopped.
      needsDraft: out.status === "cancelled" });
  });

  app.delete("/api/apply/bin/:runJobId", requireAuth, (req, res) => {
    const out = purgeNow(db, req.user.id, req.params.runJobId);
    if (!out.ok) return res.status(404).json({ error: out.code });
    res.json({ ok: true, runJobId: out.id, purged: true });
  });

  /**
   * The unconsumed handoff queue.
   *
   * ?origin= — OPTIONAL, AND IT IS THE QUESTION EVERY EXTENSION CALLER ACTUALLY ASKS.
   *
   * All three extension call sites (background.js's batch continuation, gated-handoff.js's
   * portalQueueFor and its target match) fetched this list whole and immediately threw away every
   * row whose expectedOrigin was not the tab's. They ask "what is queued for THIS portal?" and were
   * answered with "the newest 100 across all of them".
   *
   * That is not merely wasteful — the cap made it WRONG. With more than 100 unconsumed packets, a
   * portal whose packets all fall outside the newest 100 comes back empty, and the extension reports
   * `batch_empty` on a batch that is not empty: it stops mid-run and the candidate is told there is
   * nothing left to do. A silent cap answering a question nobody asked.
   *
   * Filtering here puts the LIMIT on the set the caller cares about, where 100 packets for a SINGLE
   * portal is a different order of magnitude, and `total` below makes the truncation visible in
   * every case rather than leaving it to be inferred.
   */
  // D53: a cleared (binned or hidden) application's packet is not offered — nor fillable, see the mint.
  const NOT_CLEARED = "AND NOT EXISTS (SELECT 1 FROM apply_run_jobs hx WHERE hx.id = p.run_job_id AND hx.hidden_at IS NOT NULL)";

  /**
   * The unconsumed packets for a user, each with its D56 ADDRESSING — `origins` (the expected origin
   * plus its ATS family, from the adapter table) and `jobIds` — and, when `origin` is given, only the
   * packets whose LIST holds it. ONE function builds the rows and the count, so the list and its
   * `total` cannot disagree about what they are scoped to — a `total` computed over a different scope
   * than the rows would be worse than no total at all.
   *
   * Scoped by origin, the filter runs over every unconsumed packet BEFORE the cap (the list is the
   * family's, which SQL cannot see) — the cap still lands on the set the caller cares about.
   */
  function listUnconsumedPackets(userId, { origin = "", limit = 100 } = {}) {
    const sql = (tail) => `
      SELECT p.id, p.user_id, p.job_id, p.run_id, p.run_job_id, p.apply_url, p.expected_origin, p.gate_reason,
             p.answers_json, p.resume_artifact_id, p.consumed_at, p.created_at,
             sj.title, sj.company, sj.url AS sj_url, sj.apply_url AS sj_apply_url
      FROM apply_gate_packets p
      LEFT JOIN scraped_jobs sj ON sj.job_id = p.job_id
      WHERE p.user_id=? AND p.consumed_at IS NULL ${NOT_CLEARED}
      ORDER BY p.created_at DESC ${tail}`;
    // ⭐ own_urls: the pages the user captured this job from (a Workday tenant joins only that way)
    const address = (r) => ({ ...r, ...packetAddressing({ ...r, own_urls: ownPageUrls(db, userId, r.job_id) }, familiesFor(userId)) });
    if (!origin) {
      const rows = db.prepare(sql(`LIMIT ${limit}`)).all(userId).map(address);
      const total = db.prepare(`SELECT COUNT(*) AS n FROM apply_gate_packets p
        WHERE p.user_id=? AND p.consumed_at IS NULL ${NOT_CLEARED}`).get(userId)?.n || 0;
      return { rows, total };
    }
    const all = db.prepare(sql("")).all(userId).map(address).filter(r => r.origins.includes(origin));
    return { rows: all.slice(0, limit), total: all.length };
  }

  /** ⭐ D63 · a packet's job card: the job's résumé scores (D58) and its logo. Guarded: never fails a list. */
  function packetCardFacts(r) {
    let scores = null, logo = null;
    try {
      const rs = db.prepare("SELECT ats_score, base_ats_score FROM resumes WHERE user_id = ? AND job_id = ?").get(r.user_id, r.job_id);
      if (rs && (rs.ats_score != null || rs.base_ats_score != null)) scores = atsScorePair({ base: rs.base_ats_score, tailored: rs.ats_score });
    } catch { /* an older schema: no scores, the card still draws */ }
    try { logo = db.prepare("SELECT company_icon_url FROM scraped_jobs WHERE job_id = ?").pluck().get(r.job_id) || null; } catch {}
    return { scores, logo: logo || getKnownLogoUrl(r.company || "") || null };
  }

  /** One packet as every list shows it — counts and addressing, never a value (those are behind the token). */
  function listedPacket(r) {
    const body = parseJson(r.answers_json, {});
    const createdAt = toMs(r.created_at);
    const { ageMs, stale } = packetFreshness(createdAt);
    return {
      packetId:       r.id,
      jobId:          r.job_id,
      runId:          r.run_id,
      runJobId:       r.run_job_id,
      title:          r.title ?? null,
      company:        r.company ?? null,
      applyUrl:       r.apply_url,
      expectedOrigin: r.expected_origin,
      // ⭐ D56: every address this application may be filled on — the expected origin and its ATS
      // family, from the adapter table, never the user. The extension matches on THIS, not on
      // expectedOrigin alone, which is what refused account.amazon.jobs for a www.amazon.jobs packet.
      origins:        r.origins || [r.expected_origin],
      jobIds:         r.jobIds || [],
      gateReason:     r.gate_reason,
      createdAt,
      // Whether crossing this releases a batch or finishes one application. The panel groups on
      // it, so it is stated by the server rather than re-derived from the reason string twice.
      kind:           handoffKind(r.gate_reason),
      // AB1 requirement 5. A packet is a snapshot of a decision and the world moves; an old one
      // must SAY it is old rather than quietly filling three-day-old answers into a live form.
      ageMs,
      stale,
      staleAfterMs:   PACKET_STALE_MS,
      // AB1 requirement 6. The LEFT JOIN on scraped_jobs misses when the 7-day cleanup has
      // removed the posting, which is what produced rows reading "4369183334 (posting no longer
      // on the board)". A held review for a posting that no longer exists cannot be resumed at
      // all — there is nothing to open — so it is its OWN state, not a row with a broken link.
      postingGone:    r.title == null && r.company == null,
      // COUNTS ONLY on the list. The values are behind the token exchange, so opening the queue
      // does not spray a home address across every row of a list response.
      answerCount:      Array.isArray(body.answers) ? body.answers.length : 0,
      unresolvedCount:  Array.isArray(body.unresolved) ? body.unresolved.length : 0,
      resumeAvailable:  r.resume_artifact_id != null,
      // ⭐ D63: the popup's job card and its packet summary ("Résumé tailored · 62 → 81") — D58's pair and
      // the logo, read beside the list (two integers and an address), never a value from the packet.
      ...packetCardFacts(r),
    };
  }

  /** D56: one stored packet row's addressing, with its posting's URLs read alongside. */
  function addressingFor(row) {
    let sj = null;
    try { sj = db.prepare("SELECT url, apply_url FROM scraped_jobs WHERE job_id=?").get(row.job_id); } catch {}
    return packetAddressing({ ...row, sj_url: sj?.url ?? null, sj_apply_url: sj?.apply_url ?? null,
      own_urls: ownPageUrls(db, row.user_id, row.job_id) }, familiesFor(row.user_id));
  }

  /**
   * Where the extension fetches a packet's résumé. A run's packet goes through its run-job (the audit
   * route, unchanged); a PREPARED packet (D56 — no run) through the packet itself.
   */
  function resumeUrlFor(row) {
    if (row.resume_artifact_id == null) return null;
    return row.run_job_id != null
      ? `/api/apply/run-jobs/${row.run_job_id}/resume`
      : `/api/apply/gate-packets/${row.id}/resume`;
  }

  app.get("/api/apply/gate-packets", requireAuth, (req, res) => {
    const origin = String(req.query.origin || "").trim();

    const PACKET_LIST_LIMIT = 100;
    const { rows, total } = listUnconsumedPackets(req.user.id, { origin, limit: PACKET_LIST_LIMIT });

    // ── Amortise the gate per PORTAL, not per application (TASK G5) ───────────
    // The architecture doc calls this the highest-leverage item in the design, and it is a
    // reframing rather than machinery: the same rows, grouped by the origin the candidate has to
    // authenticate against. One ten-second CAPTCHA that releases seven applications is a different
    // product from seven separate reviews.
    //
    // Grouped here rather than in the client because G0 established the unit that matters is the
    // ORIGIN — the grant survives every same-origin navigation and dies when it leaves — and the
    // origin is a stored fact on the packet, not something a UI should be re-deriving from a URL.
    //
    // ONLY GATE-CROSSING PACKETS ARE GROUPED THIS WAY (AB1/AB2). Once held reviews also carry
    // packets, grouping every packet by origin would report "sign in to boards.greenhouse.io once →
    // 4 applications ready" over four applications that each need a different answer from the
    // candidate — a promise the sign-in cannot keep. The rule the panel is built on:
    //
    //   group by OBSTACLE    when one action unblocks MANY applications  (a portal sign-in)
    //   group by APPLICATION when many obstacles block ONE application   (a held review)
    //
    // Both cases are real, so both are served: portals below, per-application packets in `packets`.
    const portals = [...rows.filter(r => handoffKind(r.gate_reason) === "gate").reduce((m, r) => {
      const g = m.get(r.expected_origin) || {
        origin: r.expected_origin,
        host: (() => { try { return new URL(r.expected_origin).host; } catch { return r.expected_origin; } })(),
        count: 0, packetIds: [], oldestAt: null, gateReasons: new Set(),
      };
      g.count++;
      g.packetIds.push(r.id);
      g.oldestAt = g.oldestAt == null ? r.created_at : Math.min(g.oldestAt, r.created_at);
      g.gateReasons.add(r.gate_reason);
      m.set(r.expected_origin, g);
      return m;
    }, new Map()).values()]
      .map(g => ({ ...g, oldestAt: toMs(g.oldestAt), gateReasons: [...g.gateReasons] }))
      // Biggest batch first: that is the one where crossing a gate once buys the most.
      .sort((a, b) => b.count - a.count);

    res.json({
      // The scope this answer was computed over, echoed so a caller can tell a filtered response
      // from a whole one without remembering what it asked for — and so a response cached or passed
      // between contexts stays self-describing.
      origin: origin || null,
      // `total` is the count over that scope BEFORE the cap; `truncated` says the list was cut.
      // Both are always present: a client that only learns about truncation when it happens has to
      // discover the field's existence at the worst possible moment.
      total,
      returned: rows.length,
      truncated: total > rows.length,
      limit: PACKET_LIST_LIMIT,
      portals,
      packets: rows.map(listedPacket),
    });
  });

  /**
   * Mint a single-use token for an unconsumed packet. This is what "click Review" calls.
   *
   * On demand rather than at gate-detection time because the TTL is minutes: a token minted when the
   * run observed the gate would be dead long before anyone read the notification. Re-minting rotates
   * the outstanding token, so an abandoned handoff leaves nothing usable behind.
   */
  app.post("/api/apply/gate-packets/:packetId/token", requireAuth, (req, res) => {
    const packetId = Number(req.params.packetId);
    if (!Number.isInteger(packetId) || packetId <= 0) return res.status(400).json({ error: "bad_packet_id" });

    const row = db.prepare("SELECT * FROM apply_gate_packets WHERE id=? AND user_id=?")
      .get(packetId, req.user.id);
    // Not-found and not-yours are the same response on purpose: distinguishing them would confirm
    // another account's packet exists.
    if (!row) return res.status(404).json({ error: "packet_not_found" });
    if (row.consumed_at != null) {
      return res.status(409).json({
        error: "packet_consumed",
        message: "This handoff was already completed. Re-queue the job to prepare a new one.",
      });
    }
    // ⛔ D53: a cleared application is not filled. Restore it from the bin first.
    if (row.run_job_id != null && db.prepare("SELECT hidden_at FROM apply_run_jobs WHERE id=?").pluck().get(row.run_job_id) != null) {
      return res.status(410).json({ error: "packet_cleared",
        message: "You cleared this application. Restore it from Cleared in Home to fill it." });
    }

    // STALE PACKETS ARE REFUSED HERE, before a token exists (AB1 requirement 5).
    //
    // Refused at the MINT rather than filtered out of the list on purpose: a packet that has gone
    // off must be able to say so. Dropping it from the list would make it vanish, which is the
    // "silently fill nothing" failure the requirement names — the candidate would click Open, watch
    // an empty form, and have no way to learn that the answers had expired. A 410 with a sentence
    // and a re-run is the honest version.
    const { ageMs, stale } = packetFreshness(toMs(row.created_at));
    if (stale) {
      const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      logEvent(row.run_id, row.run_job_id, req.user.id, row.job_id, "gate_packet_stale",
        "Handoff refused: the prepared answers are too old to fill", { packetId, ageMs });
      return res.status(410).json({
        error: "packet_stale",
        message: `This application was prepared ${days} day${days === 1 ? "" : "s"} ago and the posting may have changed. Run it again to prepare fresh answers.`,
        ageMs,
        staleAfterMs: PACKET_STALE_MS,
        // What clears it. The panel turns this into a button rather than leaving the user stuck.
        // D56: a PREPARED packet is cleared by preparing it again — one click, never a dead end.
        remedy: row.gate_reason === PREPARED_REASON ? "prepare" : "rerun",
        jobId: row.job_id,
      });
    }

    // ⛔ D56: NEVER RELEASED OUTSIDE ITS ORIGIN LIST. When the extension says which page it is standing
    // on (every build from D56 on does), that page must be one of this application's addresses — its
    // origin in the list and, where the URL carries one, the same job id. Checked HERE, before a token
    // exists, so a mismatch costs nothing; the extension checks the origin again after the release.
    const addr = addressingFor(row);
    const pageUrl = typeof req.body?.url === "string" ? req.body.url.slice(0, 2048) : "";
    if (pageUrl) {
      const m = pageMatchesPacket({ url: pageUrl, ...addr }, familiesFor(row.user_id));
      if (!m.ok) {
        return res.status(409).json({
          error: "not_this_address", reason: m.reason, origins: addr.origins,
          message: `This page isn't one of this application's addresses. It fills on ${hostsSentence(addr.origins)}.`,
        });
      }
    }
    // ⭐ T11: the form is in a FRAME (Stripe embeds Greenhouse's). The answers go into the frame, so the frame's own
    // address must be this application's too — origin in the list and the same job id — not only the page around it.
    const frameUrl = frameUrlOf(req);
    if (frameUrl === false) return res.status(400).json({ error: "bad_frame_url", message: "The form's frame address cannot be read." });
    if (frameUrl) {
      const m = pageMatchesPacket({ url: frameUrl, ...addr }, familiesFor(row.user_id));
      if (!m.ok) {
        return res.status(409).json({
          error: "not_this_address", reason: `frame_${m.reason}`, origins: addr.origins,
          message: `The form on this page is not this application's — it fills on ${hostsSentence(addr.origins)}.`,
        });
      }
    }

    if (!GATE_TOKEN_SECRET) {
      return res.status(503).json({
        error: "gate_token_secret_missing",
        message: "Handoff tokens cannot be issued: no server secret is configured.",
      });
    }

    const { token, tokenHash, expiresAt } = mintPacketToken({
      secret: GATE_TOKEN_SECRET, userId: req.user.id, jobId: row.job_id, packetId,
      ttlMs: DEFAULT_TOKEN_TTL_MS,
    });
    db.prepare("UPDATE apply_gate_packets SET token_hash=?, expires_at=? WHERE id=?")
      .run(tokenHash, expiresAt, packetId);

    logEvent(row.run_id, row.run_job_id, req.user.id, row.job_id, "gate_packet_token_minted",
      "Handoff token issued", { packetId, expiresAt, expectedOrigin: row.expected_origin });

    res.json({
      token,
      expiresAt: expiresAt * 1000,
      // Returned so the extension knows what to target-match BEFORE it asks for the packet, and so a
      // mismatch costs nothing: it can refuse without ever holding the answers.
      expectedOrigin: row.expected_origin,
      origins: addr.origins,
      applyUrl: row.apply_url,
      // Where the extension fetches the resume as a blob. This route already existed for the audit
      // trail (requirement 5) and is session-authenticated, so nothing new was added for it.
      resumeUrl: resumeUrlFor(row),
    });
  });

  /**
   * Exchange a token for the packet, ONCE.
   *
   * Rejections are deliberately NOT collapsed into one generic 400 (requirement 4):
   *   401 token_invalid / token_malformed   signature failed or the token is not a token
   *   403 token_user_mismatch              a valid token belonging to another account
   *   409 token_consumed                   a replay
   *   410 token_expired                    past its TTL
   *   429 rate_limited
   */
  app.post("/api/apply/gate-packet/exchange", requireAuth, (req, res) => {
    const userId = req.user.id;

    // Before anything else: this endpoint returns a home address and work-authorization answers.
    const attempts = gateExchangeAttempts(userId);
    if (attempts >= GATE_EXCHANGE_MAX_ATTEMPTS) {
      logExchange(userId, "rate_limited", { attempts, limit: GATE_EXCHANGE_MAX_ATTEMPTS });
      return res.status(429).json({
        error: "rate_limited",
        message: `Too many handoff attempts (${attempts} in the last ${GATE_EXCHANGE_WINDOW_SEC / 60} minutes).`,
        retryAfterSeconds: GATE_EXCHANGE_WINDOW_SEC,
      });
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const verified = verifyPacketToken(token, { secret: GATE_TOKEN_SECRET });
    if (!verified.ok) {
      logExchange(userId, verified.reason);
      const status = verified.reason === "token_expired" ? 410
                   : verified.reason === "no_secret" ? 503
                   : 401;
      return res.status(status).json({ error: verified.reason });
    }

    const { pid, uid, jid } = verified.payload;
    // The token is bound to a user. A signature that verifies still does not entitle THIS session to
    // the packet — that is the difference between a valid token and an authorised one.
    if (uid !== userId) {
      logExchange(userId, "token_user_mismatch", { packetId: pid, tokenUserId: uid });
      return res.status(403).json({ error: "token_user_mismatch" });
    }

    const row = db.prepare("SELECT * FROM apply_gate_packets WHERE id=?").get(pid);
    if (!row || row.user_id !== userId || String(row.job_id) !== String(jid)) {
      logExchange(userId, "token_binding_mismatch", { packetId: pid, tokenJobId: jid });
      return res.status(403).json({ error: "token_binding_mismatch" });
    }
    // The hash on the row is the ONE outstanding token. An older token for the same packet verifies
    // by signature and is still refused here, which is what makes re-minting a rotation rather than
    // handing out a second key.
    if (row.token_hash !== hashToken(token)) {
      logExchange(userId, "token_superseded", { packetId: pid, jobId: row.job_id });
      return res.status(401).json({ error: "token_superseded" });
    }

    // SINGLE USE. Claimed with a conditional UPDATE, not a read-then-write: two concurrent exchanges
    // would both pass a `consumed_at IS NULL` check and both be served. Whichever UPDATE changes a
    // row is the one that won.
    const claim = db.prepare(`
      UPDATE apply_gate_packets
      SET consumed_at=unixepoch(), exchange_attempts=exchange_attempts+1
      WHERE id=? AND consumed_at IS NULL
    `).run(pid);
    if (claim.changes === 0) {
      db.prepare("UPDATE apply_gate_packets SET exchange_attempts=exchange_attempts+1 WHERE id=?").run(pid);
      logExchange(userId, "token_consumed", { packetId: pid, jobId: row.job_id, runId: row.run_id, runJobId: row.run_job_id });
      return res.status(409).json({ error: "token_consumed" });
    }

    const body = parseJson(row.answers_json, null);
    if (!body) {
      logExchange(userId, "packet_corrupt", { packetId: pid });
      return res.status(500).json({ error: "packet_corrupt" });
    }

    logExchange(userId, "released", {
      packetId: pid, jobId: row.job_id, runId: row.run_id, runJobId: row.run_job_id,
      expectedOrigin: row.expected_origin,
      answerCount: Array.isArray(body.answers) ? body.answers.length : 0,
    });

    // ⛔ D36: THE CANDIDATE IS NOW APPLYING — say so on The Table. A released packet means they are on
    // the employer's form with our answers in it, and they will submit it themselves. Nothing tagged
    // the job Pending, and the Pending table lists only application_records rows, so after a gated
    // handoff there was no place in the UI to record the submission at all — job_applications could
    // never be written for this path (walked 10-05: the record succeeded only by calling the API).
    // 'draft' is the server-only origin PENDING_ORIGINS reserves; markPending is a no-op for a job
    // already submitted or already pending, and never fails the release.
    let pending = null;
    try { pending = markPending(db, userId, String(row.job_id), "draft").state; }
    catch (e) { console.warn(`[applyRoutes] gate exchange pending tag job=${row.job_id}: ${e.message}`); }

    res.json({
      pending,
      packetId: pid,
      // Repeated at the top level because the extension target-matches on it before releasing
      // anything into a page (G2 requirement 3), and it must not have to dig for it.
      expectedOrigin: row.expected_origin,
      // ⭐ D56: the whole list. The extension refuses to fill a page whose origin is not in it — even
      // with the token already spent (a burnt token is cheap; a misplaced home address is not).
      origins: addressingFor(row).origins,
      applyUrl: row.apply_url,
      gateReason: row.gate_reason,
      resumeUrl: resumeUrlFor(row),
      // ⭐ D96 §4: the saved answers as they stand NOW, not as they stood when the packet was prepared.
      packet: withLiveSavedAnswers(userId, body, row.job_id),
    });
  });

  // ── Form schema capture (TASK G4) ────────────────────────────────────────────
  // Behind a gate is a place the server can never reach. The extension is standing inside it, so the
  // form's STRUCTURE comes back here and the next candidate's packet arrives pre-mapped.
  //
  // OPT-IN, DEFAULT OFF, ENFORCED SERVER-SIDE. The extension checks the setting too, but only to
  // avoid pointless work — the refusal that matters is this one, because a client-side check is a
  // request the client can simply not make.

  /** Whether this account has turned capture on. Read by the extension before it captures. */
  app.get("/api/apply/form-schema/consent", requireAuth, (req, res) => {
    try {
      const row = db.prepare("SELECT form_schema_capture FROM users WHERE id=?").get(req.user.id);
      res.json({ enabled: row?.form_schema_capture === 1 });
    } catch {
      // Same posture as the POST below, which has always guarded this: an un-migrated deployment has
      // no column. Unguarded, this threw a 500 on EVERY handoff — the extension asks about consent
      // on its way through, so one missing migration turned a working fill into a server error in
      // the log for every single application. Not consenting is the safe answer, and capture is
      // opt-in and default off anyway.
      res.json({ enabled: false });
    }
  });

  app.post("/api/apply/form-schema/consent", requireAuth, (req, res) => {
    const enabled = req.body?.enabled === true;
    try {
      db.prepare("UPDATE users SET form_schema_capture=? WHERE id=?").run(enabled ? 1 : 0, req.user.id);
    } catch (e) {
      // An un-migrated deployment has no column. Reporting that is better than reporting success and
      // silently never capturing.
      return res.status(503).json({ error: "consent_unavailable", message: "Run migration 081." });
    }
    res.json({ ok: true, enabled });
  });

  /**
   * Receive one observation of a company's application form.
   *
   * Takes STRUCTURE ONLY, and it is this endpoint's job to make that true rather than to trust the
   * sender: normaliseCapturedFields whitelists the properties that may be stored, so a client that
   * posted values — by mistake or otherwise — cannot get them in.
   */
  app.post("/api/apply/form-schema", requireAuth, (req, res) => {
    const consent = db.prepare("SELECT form_schema_capture FROM users WHERE id=?").get(req.user.id);
    if (consent?.form_schema_capture !== 1) {
      return res.status(403).json({
        error: "capture_not_enabled",
        message: "Form schema capture is off for this account.",
      });
    }

    const applyHost = hostOf(req.body?.applyUrl) || String(req.body?.applyHost || "").toLowerCase();
    if (!applyHost) return res.status(400).json({ error: "bad_apply_host" });

    try {
      const result = recordFormSchema(db, {
        applyHost,
        company:  req.body?.company ?? null,
        platform: req.body?.platform ?? null,
        fields:   req.body?.fields,
        // Named so a schema learned by a candidate crossing a gate is distinguishable from one our
        // own crawl of a public careers page produced. Same store, same shape.
        source:   "extension_gated",
      });
      logEvent(null, null, req.user.id, req.body?.jobId ?? "-", "form_schema_captured",
        `Form schema ${result.changed ? "changed" : "corroborated"} for ${applyHost}: ` +
        `${result.fieldCount} field(s), ${result.unmappedCount} we cannot answer`,
        // Counts and identity, never the fields themselves — the log is not a second copy of the
        // store, and a form's shape belongs in one place.
        { applyHost, ...result });
      res.json({ ok: true, ...result });
    } catch (e) {
      // An empty capture is REFUSED, not stored. Persisting one would cache the absence of
      // information into the asset that is supposed to compound, and a later reader could not tell
      // "this form has no fields" from "discovery ran before the page rendered" — which is exactly
      // the failure this task was blocked on.
      const code = e.reasonCode === "form_schema_empty" ? 422 : 400;
      return res.status(code).json({ error: e.reasonCode || "capture_failed", message: e.message });
    }
  });

  /**
   * What we already know about the form behind a URL — for IMPORT and QUEUE time, which is when
   * knowing costs nothing and helps most (requirement 4).
   */
  app.get("/api/apply/form-schema", requireAuth, (req, res) => {
    const summary = formSchemaSummary(db, req.query.url || req.query.host || "");
    if (!summary) return res.json({ known: false });
    res.json(summary);
  });

  /**
   * A handoff that was released but never completed — the portal signed the candidate out partway
   * through a batch, or the tab was closed on the way (TASK G5 requirement 4).
   *
   * The token was already spent, and un-spending it would make "single use" conditional on our own
   * bookkeeping being right. So this issues a FRESH packet for the same job instead: the original row
   * stays consumed and auditable, and the new one starts with no outstanding token. Single use holds
   * absolutely; what is reopened is the handoff, not the token.
   *
   * Refused once a review has been recorded, because then the candidate did see the form and the
   * application is theirs to finish — reopening would offer a second copy of an application that is
   * already in front of them.
   */
  app.post("/api/apply/gate-packets/:packetId/reopen", requireAuth, (req, res) => {
    const packetId = Number(req.params.packetId);
    if (!Number.isInteger(packetId) || packetId <= 0) return res.status(400).json({ error: "bad_packet_id" });

    const row = db.prepare("SELECT * FROM apply_gate_packets WHERE id=? AND user_id=?")
      .get(packetId, req.user.id);
    if (!row) return res.status(404).json({ error: "packet_not_found" });
    if (row.consumed_at == null) {
      // Nothing to reopen: the packet is still usable exactly as it is.
      return res.json({ ok: true, packetId, reopened: false, reason: "still_open" });
    }

    const rj = row.run_job_id
      ? db.prepare("SELECT status, gate_review_json FROM apply_run_jobs WHERE id=? AND user_id=?")
          .get(row.run_job_id, req.user.id)
      : null;
    if (rj?.gate_review_json) {
      return res.status(409).json({
        error: "already_reviewed",
        message: "This application was already opened and reviewed. Finish it in the tab you started.",
      });
    }
    // Both handoff statuses, not just held_gate: once a held review carries a packet, reopening one
    // after an abandoned session is the same operation. Keying on held_gate alone would have made
    // every held review permanently unresumable the moment its first session was abandoned.
    if (rj && !HANDOFF_STATUSES.has(rj.status)) {
      return res.status(409).json({ error: "not_held", message: `This job is ${rj.status}, not waiting for you.` });
    }

    const ins = db.prepare(`
      INSERT INTO apply_gate_packets
        (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason,
         answers_json, resume_artifact_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(row.user_id, row.run_id, row.run_job_id, row.job_id, row.apply_url, row.expected_origin,
           row.gate_reason, row.answers_json, row.resume_artifact_id, GATE_PACKET_NO_TOKEN());

    const newId = Number(ins.lastInsertRowid);
    logEvent(row.run_id, row.run_job_id, req.user.id, row.job_id, "gate_packet_reopened",
      "Handoff reopened after an incomplete session", { from: packetId, to: newId, expectedOrigin: row.expected_origin });
    res.json({ ok: true, packetId: newId, reopened: true, from: packetId });
  });

  // ── ⛔⛔ D56 · THE EXTENSION ON A PAGE: which packets may fill it, and what to say when none may ──
  //
  // The tab's URL arrives in the BODY (never a query string, so it does not land in request logs —
  // the same posture as D13's /api/import/context), only after a user gesture on that tab. The server
  // answers from the database and the adapter table; nothing in the request can widen a packet's
  // origin list. The extension re-checks every packet's ORIGIN against its list before and after the
  // release — the server's job-id check is the half only the server can do (one URL parser, D23).

  const pageUrlOf = (req) => {
    const raw = String(req.body?.url || "").slice(0, 2048);
    try { const u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
  };
  /** ⭐ T11: the address of the FRAME the form is in, when it is not the page — null when absent, false when unreadable. */
  function frameUrlOf(req) {
    if (req.body?.frameUrl == null || req.body.frameUrl === "") return null;
    try { const u = new URL(String(req.body.frameUrl).slice(0, 2048)); return /^https?:$/.test(u.protocol) ? u.href : false; } catch { return false; }
  }

  function resumeStateFor(userId, jobId) {
    try {
      const cur = artifactCurrency(db, { userId, jobId });
      return cur.current ? "ready" : cur.artifact ? "out_of_date" : "none";
    } catch { return "none"; }
  }

  /** ⭐ D63 · what the popup's job card shows for one of your jobs: its logo and the score pair (D58). */
  function jobCardFacts(userId, jobId) {
    try {
      const sj = db.prepare("SELECT company, company_icon_url FROM scraped_jobs WHERE job_id = ?").get(jobId);
      const profileId = db.prepare("SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1").pluck().get(userId) ?? null;
      const base = db.prepare("SELECT ats_score FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?").pluck().get(userId, profileId, jobId) ?? null;
      const rs = db.prepare("SELECT ats_score, base_ats_score FROM resumes WHERE user_id = ? AND job_id = ?").get(userId, jobId);
      return { logo: sj?.company_icon_url || getKnownLogoUrl(sj?.company || "") || null,
               scores: atsScorePair({ base: rs ? (rs.base_ats_score ?? base) : base, tailored: rs?.ats_score ?? null }) };
    } catch { return { logo: null, scores: null }; }
  }

  /**
   * ⭐ THE TAB BINDING'S HINT (extension, owner 10-12): the job this tab captured or recognised, sent with the page
   * so a stage whose address names no job (Workday's sign-in, a step that changed without changing the URL) is
   * still that job. Honoured ONLY for a job that is the user's own or live on the board (D99: a tab the board opened
   * is bound to a board job the user may never have saved) — never a retired or held-out posting that is not theirs.
   */
  function boundJob(userId, hint) {
    if (hint == null || hint === "") return null;
    const id = String(hint).slice(0, 128);
    if (!jobOnUsersBoard(db, userId, id)) return null;
    const row = db.prepare("SELECT job_id, title, company, url, apply_url, duplicate_of FROM scraped_jobs WHERE job_id=?").get(id);
    if (!row) return null;
    return { job: { jobId: String(row.job_id), title: row.title ?? null, company: row.company ?? null, url: row.url ?? null, applyUrl: row.apply_url ?? null },
             mine: true, how: "binding" };
  }
  const hintOf = (req) => (req.body?.boundJobId != null ? String(req.body.boundJobId) : null);
  /**
   * ⭐ BINDING FIRST (owner 10-15) · the page's address named a live board job that is not yet the user's own, and the
   * extension's identify step bound the tab to THAT job: the binding's rule (boundJob above, D99) applies to it as it
   * would on a stage whose address names nothing — so Prepare works for it. Only for the very job the address names;
   * a hint naming another job changes nothing here.
   */
  function withBoundBoardJob(userId, page, hint) {
    if (!page?.job || page.mine || hint == null || String(hint) !== String(page.job.jobId)) return page;
    return boundJob(userId, hint) ? { ...page, mine: true } : page;
  }

  /** The D56 decision for one page, shared by /match, /prepare and /copy-sheet. */
  function matchPage(userId, url, hint = null, frameUrl = null) {
    const origin = new URL(url).origin;
    const { rows } = listUnconsumedPackets(userId, { origin, limit: 100 });
    const fills = (r, u) => pageMatchesPacket({ url: u, origins: r.origins, jobIds: r.jobIds, pageKeys: r.pageKeys }, familiesFor(userId)).ok;
    // ⭐ T11: with the form in a frame, a packet fills here only when the page AND the frame are its addresses.
    const matching = rows.filter(r => fills(r, url) && (!frameUrl || fills(r, frameUrl)));
    const packets = matching.map(listedPacket);
    let page = withBoundBoardJob(userId, resolvePageJob(db, userId, url, familiesFor(userId)), hint);
    if (!page.job) page = boundJob(userId, hint) || page;
    // ⭐ D63: the popup leads with the job card — the logo and D58's score pair ride with the job.
    const job = page.job ? { jobId: page.job.jobId, title: page.job.title, company: page.job.company, ...jobCardFacts(userId, page.job.jobId) } : null;
    const resume = job ? resumeStateFor(userId, job.jobId) : "none";
    let state = "ready", addresses = null;
    if (!packets.some(p => !p.stale)) {
      // This page's job has a usable packet somewhere else? Then the truth is "not one of its addresses".
      let elsewhere = [];
      if (job) {
        try {
          elsewhere = db.prepare(`
            SELECT p.*, sj.url AS sj_url, sj.apply_url AS sj_apply_url FROM apply_gate_packets p
            LEFT JOIN scraped_jobs sj ON sj.job_id = p.job_id
            WHERE p.user_id=? AND p.job_id=? AND p.consumed_at IS NULL ${NOT_CLEARED}`).all(userId, job.jobId)
            .filter(r => !packetFreshness(toMs(r.created_at)).stale)
            .map(r => ({ ...r, ...packetAddressing(r, familiesFor(userId)) }));
        } catch { elsewhere = []; }
      }
      if (elsewhere.length) {
        state = "not_this_address";
        addresses = [...new Set(elsewhere.flatMap(r => r.origins))];
      } else if (packets.length) state = "stale";
      else if (job && page.mine) state = "prepare";
      else if (job) state = "not_on_board";
      else state = "unknown";
    }
    const message = state === "ready" ? null : handoffMessage(state, { job, addresses, resume });
    // ⭐ §8 row 10: the on-demand notice — this is the only moment it is asked for.
    let notice = null;
    try { notice = pageNotice(db, userId, { job: page.job }); } catch { notice = null; }
    return { origin, state, message, job, mine: !!page.mine, how: page.how || null, resume, packets, addresses, notice,
             canPrepare: !!(job && page.mine) && state !== "ready" && state !== "not_this_address" };
  }

  app.post("/api/apply/handoff/match", requireAuth, (req, res) => {
    const url = pageUrlOf(req);
    if (!url) return res.status(400).json({ error: "bad_url", message: "Only http(s) pages can be filled." });
    const frameUrl = frameUrlOf(req);
    if (frameUrl === false) return res.status(400).json({ error: "bad_frame_url", message: "The form's frame address cannot be read." });
    res.json(matchPage(req.user.id, url, hintOf(req), frameUrl));
  });

  /**
   * ⭐ "Prepare this application" — one click. The server maps the page (its URL, or its ATS's job id on
   * any of that ATS's origins) to the user's job and builds the packet on demand (prepareManualPacket):
   * the profile's answers and the résumé the user made. The extension then fills it straight away,
   * under the same gesture's activeTab grant.
   */
  app.post("/api/apply/prepare", requireAuth, (req, res) => {
    const url = pageUrlOf(req);
    if (!url) return res.status(400).json({ error: "bad_url", message: "Only http(s) pages can be filled." });
    let page = withBoundBoardJob(req.user.id, resolvePageJob(db, req.user.id, url, familiesFor(req.user.id)), hintOf(req));
    if (!page.job) page = boundJob(req.user.id, hintOf(req)) || page;
    if (!page.job || !page.mine) {
      const state = page.job ? "not_on_board" : "unknown";
      return res.status(404).json({ error: state, message: handoffMessage(state) });
    }
    const out = prepareManualPacket({ userId: req.user.id, jobId: page.job.jobId, via: "extension" });
    if (!out.ok) return res.status(422).json({ error: out.error, message: out.message });
    const row = db.prepare("SELECT * FROM apply_gate_packets WHERE id=? AND user_id=?").get(out.packetId, req.user.id);
    const addr = addressingFor(row);
    const fillsHere = pageMatchesPacket({ url, ...addr }, familiesFor(req.user.id)).ok;
    // ⭐ T15 · ONE TRUTH FOR "PREPARED": the packet's own facts — when it was made, when it goes off, how many fields —
    // so the extension's "Prepared 14:02 · 12 fields" is the server's packet, never a local count standing in for it.
    const createdAt = toMs(row?.created_at);
    const packetFacts = { createdAt, staleAfterMs: PACKET_STALE_MS, expiresAt: Number.isFinite(createdAt) ? createdAt + PACKET_STALE_MS : null,
      answerCount: (() => { const b = parseJson(row?.answers_json, {}); return Array.isArray(b.answers) ? b.answers.length : 0; })() };
    res.json({
      ok: true, packetId: out.packetId, reused: out.reused, resume: out.resume, origins: addr.origins, fillsHere, packet: packetFacts,
      job: { jobId: page.job.jobId, title: page.job.title, company: page.job.company },
      message: fillsHere
        ? (out.resume === "ready" ? "Prepared — your answers and your résumé for this job." : "Prepared — your answers. No current résumé for this job, so attach one yourself.")
        : handoffMessage("not_this_address", { addresses: addr.origins }),
    });
  });

  /**
   * ⭐ §8 row 17 · THE COPY SHEET — the prepared answers as a list, for a portal draft cannot fill.
   * Shown in the extension's own popup and copied by the user's hand: nothing enters any page, so no
   * page access is needed and no token is spent. The answers are the packet's when one matches this
   * page; otherwise the same canonical resolution a packet would carry, computed and NOT stored.
   */
  app.post("/api/apply/copy-sheet", requireAuth, (req, res) => {
    const userId = req.user.id;
    const url = pageUrlOf(req);
    let body = null, source = "profile", job = null;
    if (url) {
      const m = matchPage(userId, url, hintOf(req));
      job = m.job;
      const fresh = m.packets.find(p => !p.stale);
      if (fresh) {
        const row = db.prepare("SELECT answers_json FROM apply_gate_packets WHERE id=? AND user_id=?").get(fresh.packetId, userId);
        body = parseJson(row?.answers_json, null);
        if (body) { source = "packet"; body = withLiveSavedAnswers(userId, body, job?.jobId ?? null); }
      }
      // ⭐ The sheet shows the PREPARED answers for the bound job even where no packet fills this page (the sheet
      // fills nothing, so its address does not matter) — the newest fresh packet for that job, including one a fill
      // has already released into the page: those are still the answers prepared for this application.
      if (!body && job && m.mine) {
        try {
          const rows = db.prepare(`SELECT p.id, p.answers_json, p.created_at FROM apply_gate_packets p WHERE p.user_id=? AND p.job_id=? ${NOT_CLEARED} ORDER BY p.id DESC LIMIT 5`)
            .all(userId, job.jobId).filter(r => !packetFreshness(toMs(r.created_at)).stale);
          if (rows[0]) { body = parseJson(rows[0].answers_json, null); if (body) { source = "packet"; body = withLiveSavedAnswers(userId, body, job.jobId); } }
        } catch { /* no packets table */ }
      }
    }
    if (!body) {
      db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
      const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId);
      try {
        body = buildGatePacket({ autofillPayload: withSavedAnswerRecords(userId, buildAutofillPayload(profile, "APPLY", job?.company ?? null, job?.jobId ?? null)),
          applyUrl: url || "https://jobsviadraft.com/", jobId: job?.jobId ?? "copy-sheet", gateReason: PREPARED_REASON, baseResume: baseResumeParsed(userId) });
      } catch (e) {
        return res.json({ source: "profile", job, rows: [], unanswered: [],
          message: "Your profile has nothing to copy yet — add your details in Settings." });
      }
    }
    // Counts only, never a value — the log is not a second copy of the answers.
    logEvent(null, null, userId, job?.jobId ?? "-", "copy_sheet_opened", "Copy sheet opened in the extension",
      { source, answerCount: body.answers?.length ?? 0 });
    res.json({ source, job, ...copySheetRows(body) });
  });

  /** A PREPARED packet's résumé (no run-job to go through) — owner-checked on the packet AND the artifact. */
  app.get("/api/apply/gate-packets/:packetId/resume", requireAuth, async (req, res) => {
    const row = db.prepare("SELECT job_id, resume_artifact_id, answers_json FROM apply_gate_packets WHERE id=? AND user_id=?")
      .get(Number(req.params.packetId), req.user.id);
    if (!row) return res.status(404).json({ error: "packet_not_found" });
    // ⭐ D66: a packet that carries the BASE résumé has no tailored artifact — it serves the base one.
    let html = null;
    if (row.resume_artifact_id == null) {
      let source = null;
      try { source = JSON.parse(row.answers_json || "{}").resumeSource || null; } catch { source = null; }
      const base = source === "base" ? activeBaseResume(db, req.user.id) : null;
      if (!base) return res.status(404).json({ error: "no_resume_artifact" });
      html = baseResumeHtml(base.content);
    } else {
      const artifact = db.prepare("SELECT html FROM resumes WHERE id=? AND user_id=?").get(row.resume_artifact_id, req.user.id);
      if (!artifact?.html) return res.status(404).json({ error: "resume_artifact_missing" });
      html = artifact.html;
    }
    const artifact = { html };
    try {
      const pdf = await htmlToPdf(artifact.html);
      const safe = String(row.job_id).replace(/[^a-z0-9._-]+/gi, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="resume-${safe}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      return res.status(503).json({ error: "pdf_render_failed", message: err?.message || "Could not render the resume to PDF." });
    }
  });

  /**
   * ⭐ D56 / §8 row 8 · "I SUBMITTED" — from the popup and the review overlay, for a job that was never
   * drafted as much as one that was. The page the user is standing on is the evidence (a confirmation
   * URL on the employer's application site, A63's rule), so a hand-submitted application VERIFIES and
   * job_applications is written — with the score capturedAtsAtApply finds, which is the TAILORED
   * résumé's when one exists. Nothing is recorded on the page's say-so alone: verifyEvidence decides.
   */
  app.post("/api/apply/handoff/submitted", requireAuth, (req, res) => {
    const userId = req.user.id;
    const url = pageUrlOf(req);
    if (!url) return res.status(400).json({ error: "bad_url" });
    let jobId = null;
    const claimed = req.body?.jobId != null ? String(req.body.jobId) : null;
    // A job id from the released packet is honoured only when that packet is the user's own.
    if (claimed && db.prepare("SELECT 1 FROM apply_gate_packets WHERE user_id=? AND job_id=?").get(userId, claimed)) jobId = claimed;
    // ⭐ …or the tab binding's job, when it is the user's own (a confirmation page rarely names its requisition).
    const bindingHint = req.body?.boundJobId != null ? String(req.body.boundJobId) : null;
    // ⭐ D67 (2): the user holds a packet for this job and is submitting it on a page OUTSIDE the job's
    // addresses — their own application shows where this job's form lives. The pair of HOSTNAMES is
    // learned (services/learnedOrigins.js): offered to them now, to everyone once 3 users have shown it.
    if (jobId) {
      try {
        const sj = db.prepare("SELECT url, apply_url FROM scraped_jobs WHERE job_id=?").get(jobId);
        const pk = db.prepare("SELECT expected_origin, apply_url FROM apply_gate_packets WHERE user_id=? AND job_id=? ORDER BY id DESC LIMIT 1").get(userId, jobId);
        const known = packetAddressing({ expected_origin: pk?.expected_origin ?? null, apply_url: pk?.apply_url ?? null, sj_url: sj?.url ?? null, sj_apply_url: sj?.apply_url ?? null }, familiesFor(userId)).origins || [];
        const originOfUrl = (u) => { try { return new URL(u).origin; } catch { return null; } };
        const own = [sj?.url, sj?.apply_url, pk?.apply_url].map(originOfUrl).filter(Boolean);
        const pageOrigin = originOfUrl(url);
        if (sj?.url && pageOrigin && !known.includes(pageOrigin) && !own.includes(pageOrigin)) recordSighting(db, { userId, postingUrl: sj.url, pageUrl: url });
      } catch { /* learning is never allowed to cost a submission record */ }
    }
    if (!jobId) {
      const page = resolvePageJob(db, userId, url, familiesFor(userId));
      if (page.job && page.mine) jobId = page.job.jobId;
    }
    if (!jobId && bindingHint && boundJob(userId, bindingHint)) jobId = bindingHint;
    if (!jobId) {
      return res.status(404).json({ error: "unknown_job",
        message: "draft can't tell which of your jobs this page is — record it from The Table." });
    }
    try {
      const out = recordSubmission(db, { userId, jobId, capturedAtsAtApply,
        input: { submittedAt: Date.now(), method: "ats_portal", evidenceUrl: evidenceUrlOf(url) || url.split(/[?#]/)[0] } });
      const score = db.prepare("SELECT ats_score_at_apply FROM job_applications WHERE user_id=? AND job_id=?").pluck().get(userId, jobId) ?? null;
      const missing = out.verification.checks.find(c => !c.ok);
      res.json({ ok: true, jobId, state: out.state, verified: out.verification.verified, atsScoreAtApply: score,
        message: out.verification.verified
          ? "Recorded — it's in your Submitted applications."
          : `Recorded, not verified yet${missing ? ` — ${missing.detail}` : ""}. Add your confirmation in The Table.` });
    } catch (e) {
      if (e.code === "already_verified") return res.json({ ok: true, jobId, state: "verified", verified: true, message: "Already in your Submitted applications." });
      res.status(e.status || 500).json({ error: e.code || "record_failed", message: e.message });
    }
  });

  /**
   * What the candidate actually saw and did before submitting (TASK G3 requirement 6).
   *
   * For a gated application this is the ONLY record of human review: the submission happens in the
   * candidate's own browser, on a portal we cannot reach, so nothing else observes it. Written to its
   * own column rather than merged into answers_json — those are two claims made at different times by
   * different parties, and merging them would make it impossible to say afterwards whether a value
   * was the resolver's or the candidate's correction.
   *
   * Idempotent by overwrite: the overlay reports its state on every change, and the last report is
   * the one that describes what the candidate ended up looking at.
   */
  app.post("/api/apply/gate-review", requireAuth, (req, res) => {
    const runJobId = Number(req.body?.runJobId);
    if (!Number.isInteger(runJobId) || runJobId <= 0) return res.status(400).json({ error: "bad_run_job_id" });

    const rj = db.prepare("SELECT id, run_id, job_id FROM apply_run_jobs WHERE id=? AND user_id=?")
      .get(runJobId, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });

    const acknowledged = Array.isArray(req.body?.acknowledged) ? req.body.acknowledged.map(String).slice(0, 200) : [];
    // Field identity and the fact of a change, never the new value. A correction is the candidate's
    // own data and the audit question is WHAT THEY CHANGED, not what they changed it to — which is
    // already going to the employer either way.
    const edits = (Array.isArray(req.body?.edits) ? req.body.edits : []).slice(0, 200)
      .map(e => ({ field: String(e?.key ?? "").slice(0, 200), changed: true }));

    const record = {
      version: 1,
      packetId: req.body?.packetId ?? null,
      ready: req.body?.ready === true,
      acknowledgedCount: acknowledged.length,
      acknowledged,
      editedCount: edits.length,
      edits,
      recordedAt: Math.floor(Date.now() / 1000),
    };

    try {
      const cols = new Set(db.prepare("PRAGMA table_info(apply_run_jobs)").all().map(c => c.name));
      if (!cols.has("gate_review_json")) {
        // Same posture as the audit columns: an un-migrated deployment degrades to the event log
        // rather than failing the candidate's review.
        logEvent(rj.run_id, rj.id, req.user.id, rj.job_id, "gate_review_recorded",
          "Gate review recorded (event only — run migration 080)", record);
        return res.json({ ok: true, persisted: "event_only" });
      }
      db.prepare("UPDATE apply_run_jobs SET gate_review_json=? WHERE id=? AND user_id=?")
        .run(JSON.stringify(record), runJobId, req.user.id);
      logEvent(rj.run_id, rj.id, req.user.id, rj.job_id, "gate_review_recorded",
        record.ready
          ? `Candidate reviewed: ${record.acknowledgedCount} acknowledged, ${record.editedCount} corrected`
          : `Candidate review in progress: ${record.acknowledgedCount} acknowledged`,
        record);
      res.json({ ok: true, persisted: "column" });
    } catch (e) {
      console.warn("[applyRoutes] gate review persist failed:", e.message);
      res.status(500).json({ error: "persist_failed" });
    }
  });

  // ── Queue-then-approve ───────────────────────────────────────────────────────
  // An 'auto' run now previews by default: it fills the form, runs every gate, stops short of the
  // click and parks. Approving releases a job to a run that submits — and that run refuses if the
  // form no longer resolves to what was approved, because the reviewer's decision was about a
  // specific set of answers, not about the job in general.

  const AWAITING = "awaiting_approval";

  /** Jobs parked for a decision, each with the answers that are actually going to be sent. */
  /**
   * The free base-resume fit for a run-job row, in the shape every surface renders.
   *
   * ONE DEFINITION, because the approval list and the review detail both show it and this codebase
   * has repeatedly produced two self-consistent sides joined to nothing. Returns null when the row
   * predates the deferral (nothing was recorded) — which is different from a recorded decline, and
   * both are different from a low score.
   */
  const baseAtsFor = (row) => {
    if (row?.base_ats_json == null) return null;
    const parsed = parseJson(row.base_ats_json, null);
    if (!parsed) return null;
    return {
      score: parsed.score ?? null,
      band: parsed.band ?? null,
      scorable: parsed.scorable ?? null,
      declineReasons: parsed.declineReasons ?? [],
      // Capped for a list surface. The full sets live on the review detail; a pending list showing
      // 40 missing terms per row is not a screen anyone reads.
      matched: (parsed.matched || []).slice(0, 12),
      missing: (parsed.missing || []).slice(0, 12),
      matchedCount: (parsed.matched || []).length,
      missingCount: (parsed.missing || []).length,
      resumeDepth: parsed.resumeDepth ?? null,
    };
  };

  app.get("/api/apply/pending", requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT rj.id, rj.run_id, rj.job_id, rj.answers_json, rj.resume_artifact_id, rj.resume_ats_score,
             rj.base_ats_score, rj.base_ats_json,
             rj.screenshot_path, rj.created_at, r.mode, r.tool_type,
             sj.title, sj.company, sj.apply_url, sj.url
      FROM apply_run_jobs rj
      JOIN apply_runs r ON r.id = rj.run_id
      LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id=? AND rj.status='held_review' AND rj.reason_code=?
      ORDER BY rj.created_at DESC, rj.id DESC LIMIT 100
    `).all(req.user.id, AWAITING);

    // ⛔ THE BUDGET BELONGS ON THE SCREEN WHERE IT IS SPENT (task Q requirement 3). This is the
    // approval queue; approving is now the action that costs money. A user with 18 pending previews
    // and 4 approvals left needs to know that BEFORE selecting all of them, not from a 429 after.
    const approvedUsed = approvedLast24h(req.user.id);

    res.json({
      approvalCap: {
        limit: APPLY_DAILY_APPROVAL_CAP,
        approvedLast24h: approvedUsed,
        remaining: Math.max(0, APPLY_DAILY_APPROVAL_CAP - approvedUsed),
      },
      pending: rows.map(r => {
        const answers = parseJson(r.answers_json, []);
        const filled = answers.filter(a => !a.skipped && !a.policy_rejected);
        return {
          runJobId: r.id, runId: r.run_id, jobId: r.job_id,
          title: r.title, company: r.company,
          applyUrl: r.apply_url || r.url,
          createdAt: r.created_at,
          answerCount: filled.length,
          // Surfaced at list level so a reviewer can see which applications need attention without
          // opening each one. An exact mapping is not a guess; a fuzzy one is.
          guessCount: filled.filter(a => a.provenance === "label_fuzzy").length,
          resume: { artifactId: r.resume_artifact_id ?? null, atsScore: r.resume_ats_score ?? null,
                    available: r.resume_artifact_id != null },
          // AL2 — WHAT THE USER APPROVES ON. With generation deferred there is no artifact yet, so
          // `resume.available` is false and this is the only fit signal on the screen. It is the
          // BASE resume's band: free, computed with no model call, and an honest floor, because
          // tailoring at approval time can only raise it.
          //
          // A null score is the scorer DECLINING, not a zero — `band` carries 'not_enough_signal'
          // for that case and the client must render it as its own state, never as a low score.
          baseAts: baseAtsFor(r),
          // Says WHY the resume is absent. "Not generated yet" and "generation failed" look
          // identical from `available: false` alone, and they need opposite responses from the user.
          generationDeferred: r.resume_artifact_id == null && r.base_ats_json != null,
          screenshotAvailable: !!r.screenshot_path,
        };
      }),
    });
  });

  /** The rows this user actually owns and that are actually awaiting a decision. */
  const pendingRows = (userId, runJobIds) => {
    const ids = (Array.isArray(runJobIds) ? runJobIds : [])
      .map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return [];
    const q = ids.map(() => "?").join(",");
    return db.prepare(`
      SELECT id, job_id FROM apply_run_jobs
      WHERE user_id=? AND status='held_review' AND reason_code=? AND id IN (${q})
    `).all(userId, AWAITING, ...ids);
  };

  /**
   * Approve one or more previewed applications and submit them.
   *
   * The approved rows are superseded rather than mutated in place, exactly as the correction loop
   * does, so the preview stays in the audit trail as its own record of what was shown and when it
   * was approved. The new run carries approval_mode='approved', which is the discriminator that
   * separates a human-approved submission from a full-auto one — the thing that was missing when
   * mode was being coerced at INSERT.
   */
  app.post("/api/apply/approve", requireAuth, (req, res) =>
    withIdempotency("/api/apply/approve", req, res, (out) => {
      let rows = pendingRows(req.user.id, req.body?.runJobIds);
      const requested = Array.isArray(req.body?.runJobIds) ? req.body.runJobIds.length : 0;
      // ⛔ D104 P1: Approve ALL (more than one) never sends a posting whose stated requirements contradict what the
      // user set — those stay in Ready to approve, named. Approving ONE is the user's own explicit choice.
      let skippedIneligible = [];
      if (rows.length > 1) {
        const inputs = userEligibilityInputs(db, req.user.id);
        const verdict = new Map(rows.map(r => [r.id, eligibilityForJob(db, req.user.id, r.job_id, inputs)]));
        skippedIneligible = rows.filter(r => verdict.get(r.id).status === "ineligible")
          .map(r => ({ runJobId: r.id, jobId: String(r.job_id), reasons: verdict.get(r.id).reasons }));
        rows = rows.filter(r => verdict.get(r.id).status !== "ineligible");
      }
      // ⛔ D107 P3: the same for a posting that looks never-filled (reposted ≥ N, open > N days — the user's Auto settings).
      let skippedStale = [];
      if (rows.length > 1) {
        let settings;
        try { settings = readAutoSettings(db.prepare("SELECT auto_settings FROM users WHERE id = ?").pluck().get(req.user.id)); }
        catch { settings = readAutoSettings(null); }
        const live = new Map(rows.map(r => { try { return [r.id, livenessFor(db, r.job_id)]; } catch { return [r.id, null]; } }));
        skippedStale = rows.filter(r => isStale(live.get(r.id), settings))
          .map(r => ({ runJobId: r.id, jobId: String(r.job_id), reason: live.get(r.id).label }));
        rows = rows.filter(r => !isStale(live.get(r.id), settings));
      }
      if (rows.length === 0) {
        if (skippedIneligible.length || skippedStale.length) return out.status(409).json({ error: skippedStale.length && !skippedIneligible.length ? "all_stale" : "all_ineligible", skippedIneligible, skippedStale,
          message: skippedStale.length && !skippedIneligible.length
            ? "Every one of these postings looks like it is never filled (reposted, or open a long time). Approve one by itself to send it anyway."
            : "Every one of these postings states a requirement your Application defaults rule out. Approve one by itself to send it anyway." });
        return out.status(409).json({
          error: "no_approvable_jobs",
          message: requested
            ? "None of those applications are awaiting approval."
            : "runJobIds required.",
        });
      }

      const approvedFrom = {};
      for (const r of rows) approvedFrom[String(r.job_id)] = r.id;

      db.transaction(() => {
        const mark = db.prepare(`
          UPDATE apply_run_jobs SET approved_at=unixepoch(), status='superseded', finished_at=unixepoch()
          WHERE id=? AND user_id=? AND status='held_review'
        `);
        for (const r of rows) mark.run(r.id, req.user.id);
      })();

      const started = startRun(req.user.id, normalisePlanTier(req.user?.planTier),
        rows.map(r => String(r.job_id)), { mode: "auto", approvalMode: "approved", approvedFrom });

      if (started.status !== 202) {
        // The run was refused (cap, kill switch, concurrency). Put the approvals back so the user
        // can retry — an approval that silently evaporates is worse than one that fails loudly.
        db.transaction(() => {
          const undo = db.prepare(`
            UPDATE apply_run_jobs SET status='held_review', approved_at=NULL, finished_at=NULL
            WHERE id=? AND user_id=? AND status='superseded'
          `);
          for (const r of rows) undo.run(r.id, req.user.id);
        })();
        return out.status(started.status).json({ ...started.body, approved: [] });
      }

      return out.status(202).json({
        ok: true,
        approved: rows.map(r => r.id),
        skipped: Math.max(0, requested - rows.length),
        skippedIneligible,
        skippedStale,
        run: started.body,
      });
    }));

  /** Reject previewed applications. Nothing is submitted and no run is started. */
  app.post("/api/apply/reject", requireAuth, (req, res) => {
    const rows = pendingRows(req.user.id, req.body?.runJobIds);
    if (rows.length === 0) {
      return res.status(409).json({ error: "no_rejectable_jobs" });
    }
    db.transaction(() => {
      const reject = db.prepare(`
        UPDATE apply_run_jobs SET status='dismissed', reason_code='rejected', finished_at=unixepoch()
        WHERE id=? AND user_id=? AND status='held_review'
      `);
      for (const r of rows) reject.run(r.id, req.user.id);
    })();
    res.json({ ok: true, rejected: rows.map(r => r.id) });
  });

  // ── Validation-correction loop ───────────────────────────────────────────────
  // A hold used to be a dead end: missingRequired named the fields and the run stopped. The answers
  // the resolver could not supply are exactly the answers the USER has, so they are collected and
  // stored as custom_answers — the one resolution path that is exact by construction, and therefore
  // the only one safe for eligibility questions. Nothing is guessed on retry; it is answered.

  const parseJson = (s, dflt) => { try { return s ? JSON.parse(s) : dflt; } catch { return dflt; } };
  const withOpenQuestions = (row) => ({ ...row, openQuestions: parseJson(row.open_questions_json, []) });

  /**
   * The answer store, read WITHOUT naming custom_answer_overrides.
   *
   * `SELECT *` rather than a column list for the same reason auditColumns() exists above: an
   * un-migrated deployment or a stale fixture would otherwise throw on the missing column and take
   * the whole endpoint down with a 500 — including the plain-answers path that worked before 087.
   * readAnswerStore treats an absent column as an empty override map, which is exactly right.
   */
  const answerStore = (userId) =>
    readAnswerStore(db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {});

  // Whether overrides can be PERSISTED, which is a different question from whether they can be read.
  // Named once per process, loudly, because a silently dropped override would look like the store
  // simply not working.
  let overridesColumnCache = null;
  function canPersistOverrides() {
    if (overridesColumnCache !== null) return overridesColumnCache;
    let present = false;
    try {
      present = db.prepare("PRAGMA table_info(user_profile)").all().some(c => c.name === "custom_answer_overrides");
    } catch (e) {
      console.warn("[applyRoutes] could not read user_profile schema:", e.message);
    }
    if (!present) {
      console.warn(
        "[applyRoutes] PER-COMPANY ANSWERS DEGRADED — user_profile is missing custom_answer_overrides. " +
        "Per-company overrides cannot be saved; run migrations (087 adds it). Plain answers still save."
      );
    }
    overridesColumnCache = present;
    return present;
  }

  /** Every outstanding question across this user's held jobs, deduplicated by question text. */
  app.get("/api/apply/questions", requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT rj.job_id, rj.run_id, rj.reason_code, rj.open_questions_json,
             sj.title, sj.company
      FROM apply_run_jobs rj
      LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id=? AND rj.status='held_review' AND rj.open_questions_json IS NOT NULL
      ORDER BY rj.created_at DESC LIMIT 50
    `).all(req.user.id);

    const store = answerStore(req.user.id);
    // Resolution is per-employer once templates exist, so it is computed per company and cached
    // rather than read off one flat map.
    const perCompany = new Map();
    const forCompany = (company) => {
      const key = companyKey(company);
      if (!perCompany.has(key)) perCompany.set(key, resolveForCompany(store, company));
      return perCompany.get(key);
    };

    const byQuestion = new Map();
    for (const row of rows) {
      const { answers: resolved, withheld } = forCompany(row.company);
      for (const q of parseJson(row.open_questions_json, [])) {
        const key = String(q.question || "").trim().toLowerCase();
        if (!key) continue;
        if (!byQuestion.has(key)) {
          byQuestion.set(key, { ...q, answered: true, blocking: [] });
        }
        const entry = byQuestion.get(key);
        // Answered means answered FOR EVERY employer still blocked on it. A template answered for
        // one company does not unblock the same question at another.
        if (!resolvesQuestion(resolved, q.question)) entry.answered = false;
        // A motivation template deliberately produced no answer. Hand back the expanded generic
        // text as a DRAFT — a starting point the candidate edits into their own words — and say
        // which stored template it came from, so saving it can become a per-company override.
        const held = withheld.find(w => normaliseText(w.question) === normaliseText(q.question));
        if (held && !entry.draft) {
          entry.draft = held.draft;
          entry.template = held.template;
          entry.needsOwnWords = true;
        }
        entry.blocking.push({ jobId: row.job_id, runId: row.run_id, title: row.title, company: row.company });
      }
    }
    const questions = [...byQuestion.values()];
    res.json({
      questions,
      // Eligibility answers are attestations to an employer. A caller should present them as such,
      // and they are the ones the resolver refuses to infer on the user's behalf.
      eligibilityCount: questions.filter(q => q.eligibility).length,
      // The ones the system will never write for the candidate, however full the store gets.
      ownWordsCount: questions.filter(q => q.needsOwnWords).length,
      blockedJobs: rows.length,
    });
  });

  /**
   * Save answers, and optionally retry the jobs they unblock.
   * Answers are merged into user_profile.custom_answers keyed by the EXACT question text captured
   * from the form, which is what makes them usable for eligibility fields on the next pass.
   */
  // ⭐ D113 P4: the route's body is answersCore, so a question that came back by message and is answered on the confirm
  // page (routes/picksConfirm.js) takes exactly this path — saveAnswers below. Behaviour of the route is unchanged.
  function answersCore(req, out) {
    {
      // The retry goes through startRun, so it inherits the approval default too: answering the
      // questions unblocks the job, it does not authorise the submission. Pass approvalMode:'auto'
      // to answer-and-send in one step.
      const { answers = {}, overrides = {}, retryJobIds = null, mode = "auto", approvalMode = null } = req.body || {};
      if (approvalMode === "approved")
        return out.status(400).json({ error: "approval_mode_reserved" });
      if (!answers || typeof answers !== "object" || Array.isArray(answers))
        return out.status(400).json({ error: "answers object required" });
      if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
        return out.status(400).json({ error: "overrides must be an object keyed by company" });

      const clean = (obj) => Object.entries(obj)
        .map(([q, a]) => [String(q).trim(), a])
        .filter(([q, a]) => q.length > 0 && a !== null && a !== undefined && String(a).trim() !== "");

      const entries = clean(answers);
      // A per-company override is how a motivation question gets answered at all: the generic
      // template is never submitted, so the candidate's own words for THIS employer are the only
      // thing that can resolve it. Keyed by company, then by the question as stored.
      const overrideEntries = [];
      for (const [company, byQuestion] of Object.entries(overrides)) {
        if (!byQuestion || typeof byQuestion !== "object" || Array.isArray(byQuestion)) continue;
        const key = companyKey(company);
        if (!key) continue;
        for (const [q, a] of clean(byQuestion)) overrideEntries.push([key, q, String(a)]);
      }
      if (entries.length === 0 && overrideEntries.length === 0)
        return out.status(400).json({ error: "no non-empty answers supplied" });

      db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(req.user.id);
      const prior = answerStore(req.user.id);
      let merged = { ...prior.answers };
      let mergedOverrides = {};
      for (const [c, byQ] of Object.entries(prior.overrides)) mergedOverrides[c] = { ...byQ };

      // D55 (f) · "SAVE THIS ANSWER FOR NEXT TIME?" — `remember: { [question]: boolean }`, per answer.
      //   absent  the answer is stored as before: literal question text, reused wherever it recurs.
      //   true    reused at every employer — the blocking employer's name templated as {company}, and
      //           an existing entry for the same normalised question replaced rather than duplicated.
      //   false   NOT kept for next time: stored only as a per-company override for the employer(s)
      //           blocked on it, which is what lets this retry fill and nothing beyond it.
      // User-stated only: these are the answers the candidate typed or picked in Draft House.
      const remember = (req.body?.remember && typeof req.body.remember === "object" && !Array.isArray(req.body.remember))
        ? req.body.remember : {};
      const blockingCompanies = new Map();   // normalised question -> Set of display company names
      if (Object.keys(remember).length) {
        for (const row of db.prepare(`
          SELECT rj.open_questions_json, sj.company FROM apply_run_jobs rj
          LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
          WHERE rj.user_id=? AND rj.status='held_review' AND rj.open_questions_json IS NOT NULL
        `).all(req.user.id)) {
          for (const q of parseJson(row.open_questions_json, [])) {
            const k = normaliseQuestion(q.question);
            if (!k || !row.company) continue;
            if (!blockingCompanies.has(k)) blockingCompanies.set(k, new Map());
            blockingCompanies.get(k).set(companyKey(row.company), row.company);
          }
        }
      }
      const remembered = [];
      const notKept = [];
      // ⛔ D165 (3) · A SALARY ANSWER IS SAVED FOR ITS SCOPE (role + location), not globally: a salary given for a
      // full-stack role in the US is not the answer for a data role abroad. Its scope is, in order: the caller's
      // `scopes[question]` ("global", { jobId }, or { roleKey, locationKey }); else the scope of every held job blocked
      // on that question (one entry per distinct scope); else open (no role, no location). remember:false keeps the
      // old per-company override below. Eligibility and every other answer stay global — unchanged.
      const scopesIn = (req.body?.scopes && typeof req.body.scopes === "object" && !Array.isArray(req.body.scopes)) ? req.body.scopes : {};
      let scopedList = null;
      const scopedSaved = [];
      const scopesFor = (q) => {
        const given = Object.prototype.hasOwnProperty.call(scopesIn, q) ? scopesIn[q] : undefined;
        if (given === "global") return [{ roleKey: null, locationKey: null }];
        if (given && typeof given === "object") {
          if (given.jobId != null) return [jobAnswerScope(db, given.jobId)];
          return [{ roleKey: given.roleKey ? String(given.roleKey) : null, locationKey: given.locationKey ? String(given.locationKey) : null }];
        }
        const want = normaliseQuestion(q);
        const seen = new Map();
        for (const row of db.prepare(`SELECT job_id, open_questions_json FROM apply_run_jobs
            WHERE user_id=? AND status='held_review' AND open_questions_json IS NOT NULL`).all(req.user.id)) {
          if (!parseJson(row.open_questions_json, []).some(x => normaliseQuestion(x?.question) === want)) continue;
          const s = jobAnswerScope(db, row.job_id);
          seen.set(`${s.roleKey}|${s.locationKey}`, s);
        }
        return seen.size ? [...seen.values()] : [{ roleKey: null, locationKey: null }];
      };
      for (const [q, a] of entries) {
        const choice = Object.prototype.hasOwnProperty.call(remember, q) ? remember[q] : undefined;
        if (choice !== false && isSalaryQuestion(q)) {
          if (scopedList === null) scopedList = readScoped(db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(req.user.id));
          try {
            for (const scope of scopesFor(q)) {
              const r = rememberScoped(scopedList, { question: q, answer: a, ...scope });
              scopedList = r.list; scopedSaved.push(r.saved);
            }
          } catch (e) {
            if (!e.code) throw e;
            return out.status(400).json({ error: e.code, question: q });
          }
          continue;
        }
        if (choice === undefined) { merged[q] = String(a); continue; }
        const companies = [...(blockingCompanies.get(normaliseQuestion(q))?.values() || [])];
        try {
          if (choice === false) {
            if (!companies.length) { notKept.push(q); continue; }
            for (const company of companies) {
              const r = rememberAnswer({ answers: merged, overrides: mergedOverrides }, { question: q, answer: a, company, scope: "company" });
              merged = r.store.answers; mergedOverrides = r.store.overrides;
              remembered.push(r.saved);
            }
          } else {
            // One blocking employer: template its name. Several (or none): the wording is shared, so
            // it is stored as asked — templating against one of them would misstate the others.
            const company = companies.length === 1 ? companies[0] : null;
            const r = rememberAnswer({ answers: merged, overrides: mergedOverrides }, { question: q, answer: a, company, scope: "all" });
            merged = r.store.answers; mergedOverrides = r.store.overrides;
            remembered.push(r.saved);
          }
        } catch (e) {
          if (!e.code) throw e;
          return out.status(400).json({ error: e.code, question: q });
        }
      }
      for (const [c, q, a] of overrideEntries) {
        if (!mergedOverrides[c]) mergedOverrides[c] = {};
        mergedOverrides[c][q] = a;
      }
      const overridesPersisted = canPersistOverrides();
      if (overridesPersisted) {
        db.prepare("UPDATE user_profile SET custom_answers=?, custom_answer_overrides=? WHERE user_id=?")
          .run(JSON.stringify(merged), JSON.stringify(mergedOverrides), req.user.id);
      } else {
        // Plain answers must still save. Losing them because a per-company column is missing would
        // be a worse failure than losing the overrides.
        db.prepare("UPDATE user_profile SET custom_answers=? WHERE user_id=?")
          .run(JSON.stringify(merged), req.user.id);
      }
      // D165 (3): the scoped salary answers (migration 222's column). A database without the column keeps them out of
      // `scoped` in the reply rather than claiming they were saved.
      let scopedPersisted = false;
      if (scopedList !== null) {
        try {
          db.prepare("UPDATE user_profile SET custom_answer_scoped=? WHERE user_id=?").run(JSON.stringify(scopedList), req.user.id);
          scopedPersisted = true;
        } catch (e) {
          // Never lose the person's answer: without the column it is kept GLOBALLY, as before D165 (3).
          console.warn(`[applyRoutes] scoped answers kept globally (migration 222?): ${e.message}`);
          for (const s of scopedSaved) merged[s.question] = s.answer;
          db.prepare("UPDATE user_profile SET custom_answers=? WHERE user_id=?").run(JSON.stringify(merged), req.user.id);
        }
      }
      const scopedNow = scopedPersisted ? scopedList
        : readScoped(db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(req.user.id));

      // Which held jobs are now fully answered? A job is retryable when every question it was
      // blocked on has an answer — retrying one that is still missing an answer just burns a run.
      //
      // Resolved PER EMPLOYER, not against the raw map: a `{company}` template answers the question
      // only once expanded for that job's company, and a motivation template answers it for nobody.
      // Checking the flat store would mark a job retryable that is still going to hold.
      // Resolved against what was actually WRITTEN, not what was asked for: if the override column
      // is missing, those answers did not persist and must not count towards unblocking a job.
      const store = { answers: merged, overrides: overridesPersisted ? mergedOverrides : prior.overrides };
      const held = db.prepare(`
        SELECT rj.job_id, rj.open_questions_json, sj.company
        FROM apply_run_jobs rj
        LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
        WHERE rj.user_id=? AND rj.status='held_review' AND rj.open_questions_json IS NOT NULL
      `).all(req.user.id);
      const unblocked = held
        .filter(row => {
          const qs = parseJson(row.open_questions_json, []);
          if (qs.length === 0) return false;
          const resolved = effectiveCustomAnswers(store, row.company);
          // D165 (3): a held job's salary question is answered by a scoped salary answer that matches ITS role + location.
          const scopedPick = scopedNow.length ? resolveScoped(scopedNow, jobAnswerScope(db, row.job_id)) : null;
          // D55 (f): by normalised question, the comparison buildAnswers makes — so an answer stored
          // as "Why Figma?" unblocks the form's "Why Figma? *". Every word must still agree.
          return qs.every(q => resolvesQuestion(resolved, q.question) || scopedResolves(scopedPick, q.question));
        })
        .map(row => row.job_id);

      const body = {
        ok: true,
        saved: entries.map(([q]) => q).filter(q => !notKept.includes(q)),
        savedOverrides: overridesPersisted
          ? overrideEntries.map(([c, q]) => ({ company: c, question: q }))
          : [],
        unblocked,
        ...(Object.keys(remember).length ? { remembered, notKept } : {}),
        // D165 (3): each salary answer saved for a scope — { question, answer, roleKey, locationKey, savedAt }.
        ...(scopedSaved.length && scopedPersisted ? { scoped: scopedSaved } : {}),
      };

      if (retryJobIds !== null) {
        const requested = (Array.isArray(retryJobIds) ? retryJobIds : []).map(String);
        // Only retry jobs that are actually unblocked; anything else is reported back, not queued.
        const toRetry = requested.filter(id => unblocked.includes(id));
        const skipped = requested.filter(id => !unblocked.includes(id));
        if (toRetry.length === 0) {
          return out.status(409).json({ ...body, error: "no_retryable_jobs", skipped });
        }
        // The held rows are dismissed first: leaving them held_review would keep re-offering
        // questions that have since been answered. (And startRun's duplicate check counts a row
        // awaiting approval, so it has to be out of the way before the retry is admitted.)
        //
        // ⛔ D36: KEEP WHAT WAS DISMISSED, and put it back if the retry is refused. This superseded
        // the held rows and then called startRun; a refusal (the kill switch's 503, a full line, a
        // cap, FULL AUTO locked) returned an error with the rows already gone — so the application
        // vanished from Draft House: no longer held, never retried, with nothing to press.
        const heldNow = db.prepare(`
          SELECT id, finished_at FROM apply_run_jobs WHERE user_id=? AND job_id=? AND status='held_review'
        `);
        const dismissed = [];
        const dismiss = db.prepare(`UPDATE apply_run_jobs SET status='superseded', finished_at=unixepoch() WHERE id=? AND status='held_review'`);
        db.transaction(() => {
          for (const id of toRetry) for (const r of heldNow.all(req.user.id, id)) {
            if (dismiss.run(r.id).changes) dismissed.push(r);
          }
        })();

        const retry = startRun(req.user.id, normalisePlanTier(req.user?.planTier), toRetry,
          { mode, tool: "generate", approvalMode, retryOfHeld: true });
        // A refusal is surfaced as-is: the answers were still saved, but the retry did not start,
        // and the caller needs the real reason (cap, kill switch, concurrency).
        if (retry.status !== 202) {
          const restore = db.prepare(`UPDATE apply_run_jobs SET status='held_review', finished_at=? WHERE id=? AND status='superseded'`);
          db.transaction(() => { for (const r of dismissed) restore.run(r.finished_at, r.id); })();
          return out.status(retry.status).json({ ...body, ...retry.body, skipped, stillHeld: dismissed.map(r => r.id) });
        }
        return out.status(202).json({ ...body, skipped, retry: retry.body });
      }

      out.json(body);
    }
  }
  app.post("/api/apply/answers", requireAuth, (req, res) =>
    withIdempotency("/api/apply/answers", req, res, (out) => answersCore(req, out)));

  app.post("/api/apply/close/:jobId", requireAuth, (req, res) => {
    db.prepare(`
      UPDATE apply_run_jobs SET status='dismissed', finished_at=unixepoch()
      WHERE job_id=? AND user_id=? AND status='held_review'
    `).run(String(req.params.jobId), req.user.id);
    res.json({ ok: true });
  });

  /**
   * WAS RETIRED (until D100, 10-30 — below) — the server did not keep portal sessions, deliberately. Kept as the
   * history of WHY the reversal had to change the design, not just the status code:
   *
   * WHAT THESE WERE. In the server-side-Playwright era (ebeb9ae) POST /save wrote a Playwright
   * `storageState` — the cookies and localStorage of the candidate's LOGGED-IN session on an
   * employer's portal — to data/sessions/<userId>_<domain>.json in plaintext, and GET /:domain
   * reported whether that file existed. c818b9c replaced that architecture and left both as stubs.
   *
   * WHY THEY ARE NOT BEING IMPLEMENTED. A gated portal is now handled by handing the application to
   * the candidate's OWN browser: detectGate runs before any fill so a sign-in wall is never typed
   * into, no credential control is ever answered (g6CredentialGuard), and `login_required` becomes
   * a portal batch resolved by one real sign-in whose grant survives every same-origin navigation
   * (G0). The session lives where it should — in the browser the person is sitting at. Restoring
   * these would put a live authenticated session to a third party back on our disk, which is the
   * single most sensitive thing this product could hold and is exactly what that architecture
   * removed. data/sessions/ no longer exists.
   *
   * WHY 410 RATHER THAN DELETION, and rather than leaving the stubs. The stubs were the worse of
   * the three: `{ok:true}` tells a caller its session was saved when nothing was written, and
   * `{exists:false}` answers "do you have my session?" with a confident no that is true only by
   * accident. Both are the wired-to-a-no-op shape this codebase keeps finding. 410 follows the
   * /api/scrape and extension save-job precedent — a caller that still exists learns what happened
   * and what to do instead, rather than getting a 404 it reads as a bug.
   */
  //
  // ⭐ D100 (owner 10-30) REVERSES the 410 — a RECORDED DELIBERATE REVERSAL (CORRECTIONS_REGISTER.md). What changed in
  // the design: the password never passes through draft, and draft CANNOT read a session — it is sealed in the user's
  // app to a per-session key the apply worker minted, and stored here as ciphertext (routes/applyWorker.js). These two
  // old paths now point at the new doors (308 keeps the method and the body) instead of answering "gone".
  app.post("/api/apply/session/save", requireAuth, (_req, res) => res.redirect(308, "/api/portals/upload"));
  app.get("/api/apply/session/:domain", requireAuth, (_req, res) => res.redirect(308, "/api/portals"));

  // A59: boot-time hooks, called by server.js — not here, so a test mounting these routes on its own
  // fixture neither recovers its seeded rows nor starts a timer unless it asks to.
  // resumeForApply: the D66-wrapped generator, exposed so a test can prove base-only never calls the model.
  // ⭐ T24: the extension's Draft button is the board's Draft — THIS startRun, mode "auto", ⛔ never an approvalMode (so
  // it previews and waits for review exactly as the deck's and the board's do; full auto stays locked above). Its
  // run bar (the account's mode, the hold) and the job's Draft House state are read through the same functions.
  const draftForExtension = (user, jobId) =>
    startRun(user.id, normalisePlanTier(user?.planTier), [String(jobId)], { mode: "auto" });
  // D100 P7: the FULL AUTO scheduler's way in (services/autoScheduler.js) — the same admission as every Draft;
  // startRun refuses approvalMode 'auto' unless the user's mode is FULL AUTO, and processRunJob checks again.
  // D100 P2: the apply worker's inputs — it has no database, so draft hands it the SAME payload a local run fills from
  // (buildAutofillPayload + the carried work history + the saved-answer records), and the résumé the run attaches.
  const workerPayload = ({ userId, jobId, resumeArtifactId = null }) => {
    const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
    const company = db.prepare("SELECT company FROM scraped_jobs WHERE job_id=?").pluck().get(String(jobId)) ?? null;
    const entries = packetEntriesFor(userId, resumeArtifactId);
    return withSavedAnswerRecords(userId, withCarriedWorkHistory(userId, buildAutofillPayload(profile, "APPLY", company, jobId), entries));
  };
  const workerResumePdf = async ({ userId, resumeArtifactId }) => {
    const artifact = db.prepare("SELECT html FROM resumes WHERE id=? AND user_id=?").get(resumeArtifactId, userId);
    return artifact?.html ? htmlToPdf(artifact.html) : null;
  };
  // ⭐ D113: `review` = Auto settings' "Show me the form before sending" — the run previews and stops at Ready for your review.
  const startAutoRun = (userId, jobIds, { review = false } = {}) => {
    const planTier = db.prepare("SELECT plan_tier FROM users WHERE id = ?").get(userId)?.plan_tier;
    return startRun(userId, normalisePlanTier(planTier), jobIds.map(String), review ? { mode: "auto" } : { mode: "auto", approvalMode: "auto" });
  };
  // ⭐ D113 P4 · after the tap: the confirm page's Apply. The tap (a picks row, state 'applied') is the send authority;
  // with "Show me the form before sending" on the run previews instead (the default Draft path, stops at review).
  // Tailoring happens inside this run (processRunJob) — never before the tap.
  const startPickRun = (userId, jobIds, { review = false } = {}) => startAutoRun(userId, jobIds, { review });
  // ⭐ D113 P4 · answering a question that came back: the same path as POST /api/apply/answers (answersCore).
  const saveAnswers = (userId, planTier, body) => {
    let sent = { code: 500, body: { error: "no_response" } };
    const out = { status(code) { this._code = code; return this; }, json(b) { sent = { code: this._code || 200, body: b }; return this; } };
    answersCore({ user: { id: userId, planTier }, body }, out);
    return { status: sent.code, body: sent.body };
  };
  return { recoverInterruptedRuns, startLineTicker, dispatchAllLines, prepareManualPacket, resumeForApply: generateResumeForApply,
           draftForExtension, draftStateOf, runBar, startAutoRun, startPickRun, saveAnswers, workerPayload, workerResumePdf };
}

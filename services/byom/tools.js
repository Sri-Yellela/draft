// services/byom/tools.js — ⭐ D86 · THE TOOLS A USER'S OWN MODEL CALLS (v1 catalogue, docs/CLAUDE_CONNECTOR_COMPLIANCE.md App. A).
//
// ⛔ NO MODEL CALL IS MADE BY DRAFT ANYWHERE IN THIS PATH (D17). The model is the user's, inside their own
// Claude or ChatGPT. draft reads, validates, renders, scores and stores — all deterministic, all local.
// This file imports nothing that can reach a model; test/d86Byom.test.js holds it to that.
//
// ⛔ THE COMPLIANCE RULES THIS FILE IS BUILT TO (DR-n are that document's §2; each is a test in
// test/d86ConnectorCompliance.test.js):
//   DR-1  results are DATA — no instructions; the guidance is the static Skill in the public plugin repo.
//   DR-2  a description says what the tool does, nothing else.
//   DR-3  read and write are separate tools; names carry the `draft_` prefix and are ≤ 64 characters. THE
//         BRIEF IS A STATELESS SIGNED TOKEN (user + job + base-résumé hash + expiry), so the brief tool
//         writes nothing and is genuinely read-only; the attempts ledger is written by the submit — the write.
//   DR-4  typed, narrow inputs: ids, enums, a patch. No free-text context, conversation or history field.
//   DR-6  frugal: ≤ 10 search results; a brief within its token budget; no posting prose by default.
//   DR-8  first-party only: no tool contacts an employer or anyone else — there is no apply tool.
//   DR-10 posting text is untrusted: structured fields first, prose capped and neutralised (untrusted.js).
//   DR-14 what a posting STATES about work authorisation is shown as the posting's statement — no tool
//         concludes anything about the user's eligibility.
//
// The dependencies that live in server.js's closure (the board, the scorer's weights, the active profile,
// the résumé store) come in through `deps`, so the tools are testable on an in-memory database.
import crypto from "node:crypto";
import { BRIEF_TTL_SECONDS, BRIEF_DETAIL, MAX_ATTEMPTS, baseHash, buildBrief, applyPatch, termGuard, immutablesChanged, renderPatched } from "./resumePatch.js";
import { dailyCap, usedToday } from "./policy.js";
import { untrustedText, SUMMARY_CHARS, DESCRIPTION_CHARS } from "./untrusted.js";
import { connectorPack } from "../interviewPrep.js";

const now = () => Math.floor(Date.now() / 1000);
const READ = "resume:read", WRITE = "resume:write";

// ⛔ DR-13: the AI-assistance notice — on every saved result, the consent screen, draft's own Done card and
// the Skill's closing message. Many employers restrict AI-written applications.
export const AI_NOTICE = "Written with AI assistance and checked by draft for claims the candidate never made. Some employers restrict AI-assisted applications — check theirs before you apply.";

export const SEARCH_LIMIT = 10;
export const LEVELS = Object.freeze(["intern", "entry", "mid", "senior", "lead", "executive"]);
export const POSTED_WITHIN = Object.freeze(["1d", "2d", "3d", "1w", "1m"]);

const jobIdParam = { type: "string", maxLength: 200, description: "A draft job id." };

/** Each tool's annotations are explicit booleans, and each carries the justification the review asks for. */
export const TOOL_DEFS = Object.freeze([
  {
    name: "draft_search_jobs",
    title: "Search my job board",
    description: "Searches the jobs on the candidate's draft board by keyword, location, level and posting age. Returns up to 10 jobs with id, title, company, location, level, workplace, posted date, stated pay and the candidate's stored ATS score where one exists.",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      query: { type: "string", maxLength: 120, description: "Keywords matched against title, company and skills." },
      location: { type: "string", maxLength: 80, description: "A city, state, metro or \"Remote\"." },
      level: { type: "string", enum: [...LEVELS] },
      posted_within: { type: "string", enum: [...POSTED_WITHIN], description: "Posting age: 1d, 2d, 3d, 1w or 1m." },
    } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Reads the user's own board — the same query and order draft's web board uses — so they can find a job to tailor for. Structured fields only; nothing is written.",
  },
  {
    name: "draft_get_job",
    title: "Get one job",
    description: "Returns one job's structured details: title, company, location, level, workplace, stated pay, required skills, what the posting states about work authorisation, and a short summary. The full posting text is returned only when include_description is true, capped and marked as the posting's own words.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id"], properties: {
      job_id: jobIdParam,
      include_description: { type: "boolean", description: "Adds the posting's text, up to 6,000 characters." },
    } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Reads one public job posting the user can see on their board. Posting prose is untrusted text, so it is opt-in, capped and neutralised.",
  },
  {
    name: "draft_score_resume_for_job",
    title: "Score my résumé for a job",
    description: "Scores the candidate's base résumé against one job with draft's deterministic ATS scorer. Returns the score with the matched and missing terms, or the reasons it declined when the posting carries too little signal to score. Nothing is saved.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id"], properties: { job_id: jobIdParam } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "A deterministic score of the user's own base résumé against one job; it stores nothing.",
  },
  {
    name: "draft_get_resume_brief",
    title: "Get a résumé brief",
    description: "Returns the data used to tailor a résumé for one job: the candidate's base résumé as bullets with ids, the skills the candidate has claimed, the job's matched keywords, the job's basics and the JSON schema of a patch. Contains no contact details. The brief id is valid for 30 minutes and up to 3 submissions. detail \"short\" leaves out each entry's location line, technology line and free text.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id"], properties: {
      job_id: jobIdParam,
      detail: { type: "string", enum: [...BRIEF_DETAIL], description: "full (the default) or short." },
    } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    scope: READ,
    justification: "Reads the user's own base résumé, claims and one job so their model can tailor the résumé. It writes nothing: the brief id is a signed token naming the user, the job, the base résumé's version and an expiry.",
  },
  {
    name: "draft_submit_resume_patch",
    title: "Save the tailored résumé",
    description: "Applies a patch of rewritten bullets, keyed by id, to the base résumé a brief was made from. Refuses any skill, employer, title, date, years or seniority that is not in the candidate's base résumé or claims, and returns each reason. On success scores the result against the job and saves it as a new version in the candidate's draft account. A refused patch is not saved.",
    inputSchema: { type: "object", additionalProperties: false, required: ["brief_id", "patch"],
      properties: { brief_id: { type: "string", maxLength: 600 }, patch: { type: "object", description: "An object matching the brief's output_schema." } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: WRITE,
    justification: "Saves a résumé to the user's own draft account. It adds a new version and never deletes or overwrites an earlier one; sending the same patch again returns the same result.",
  },
  {
    name: "draft_list_my_resumes",
    title: "List my saved résumés",
    description: "Lists the candidate's saved tailored résumés with job, company, ATS score and date, and a link to each in draft. Résumé content is not returned.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Lists the user's own résumés by job and score, without their content.",
  },
  {
    name: "draft_list_my_drafts",
    title: "List my drafted jobs",
    description: "Lists the jobs in the candidate's Draft House, newest first: job id, title, company and whether a résumé exists.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Lists the user's own queued jobs so they can pick one; titles and companies only.",
  },
]);

// ⛔ D110 P4 · THE MOCK-INTERVIEW DATA TOOL — BUILT, NOT IN THE CATALOGUE. It is deliberately OUTSIDE TOOL_DEFS: adding a
// tool changes the catalogue the directory reviews (docs/CLAUDE_CONNECTOR_COMPLIANCE.md Appendix A; PLUGIN_LAUNCH D6 — which
// tools ship is the owner's), so it is served only when deps.interviewTool is true (server.js: BYOM_INTERVIEW_TOOL=1).
// It returns DATA only — the posting, the profile, the gap list, the rounds, the user's own stories and past questions;
// the interviewer's instructions are the static Skill's (docs/plugin-skills/mock-interview/SKILL.md, §2F). No contact
// details and no Application defaults (DR-14). Read-only: nothing is written, no model is called (D17).
export const INTERVIEW_TOOL_DEF = Object.freeze({
  name: "draft_get_interview_prep",
  title: "Get interview practice data for a job",
  description: "Returns the data for interview practice on one job the candidate applied to: the job's basics and a short posting summary, the candidate's experience and skills, each of the posting's skills marked have, partial or missing, the interview rounds and assessment platform read from the posting and the employer's replies, the date when one is known, the candidate's own STAR stories and the questions the candidate recorded after earlier rounds. Contains no contact details and no work-authorisation answers. Nothing is saved.",
  inputSchema: { type: "object", additionalProperties: false, required: ["job_id"], properties: { job_id: jobIdParam } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  scope: READ,
  justification: "Reads the user's own application, profile, story bank and debrief notes so their own model can run a practice interview. Structured fields only; posting and user text are capped and neutralised; nothing is written.",
});

/** The names the audit wrote before the v1 catalogue (10-09), for reading old activity rows. */
export const LEGACY_TOOL_NAMES = Object.freeze({
  get_generation_brief: "draft_get_resume_brief", submit_resume: "draft_submit_resume_patch",
  score_resume: "draft_score_resume_for_job", list_my_drafts: "draft_list_my_drafts", get_my_resumes: "draft_list_my_resumes",
});

export class ToolRefusal extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; this.extra = extra; }
}

const jobLink = (appUrl, jobId) => `${appUrl}/app/jobs?job=${encodeURIComponent(jobId)}`;
const patchHash = (patch) => crypto.createHash("sha256").update(JSON.stringify(patch ?? null)).digest("hex").slice(0, 32);

// ── DR-3 · THE BRIEF AS A SIGNED TOKEN. `brf_<payload>.<mac>`: payload = base64url JSON
// { u: user, j: job, h: base-résumé hash, e: expiry, n: nonce }, mac = HMAC-SHA256 under the server's key.
// Nothing is stored when it is issued; the submit verifies it and keeps the attempts ledger by nonce.
export function signBrief(secret, { userId, jobId, hash, expiresAt, nonce }) {
  const payload = Buffer.from(JSON.stringify({ u: userId, j: String(jobId), h: hash, e: expiresAt, n: nonce })).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `brf_${payload}.${mac}`;
}

export function readBrief(secret, token) {
  const m = String(token ?? "").match(/^brf_([A-Za-z0-9_-]{1,500})\.([A-Za-z0-9_-]{43})$/);
  if (!m || !secret) return null;
  const want = crypto.createHmac("sha256", secret).update(m[1]).digest();
  const got = Buffer.from(m[2], "base64url");
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    return c && typeof c.n === "string" && Number.isFinite(c.e) ? c : null;
  } catch { return null; }
}

const payOf = (j) => (j.salaryMin != null || j.salaryMax != null)
  ? { min: j.salaryMin ?? null, max: j.salaryMax ?? null, currency: j.salaryCurrency ?? null, period: j.salaryPeriod ?? null } : null;
const listOf = (v) => Array.isArray(v) ? v : (() => { try { const x = JSON.parse(v || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } })();
const skillNames = (v) => listOf(v).map(s => typeof s === "string" ? s : s?.name || s?.skill || null).filter(Boolean).slice(0, 30);

/**
 * @param deps {{ db, appUrl, briefSecret, jobFor(jobId), mapJob(row), searchBoard(userId, filters), baseFor(userId),
 *   scoreText(userId, job, text), storeResume(args), claimCheck(args), vocabulary(job, baseReport), notify(userId, event) }}
 *   baseFor → { text, structured, domainProfile, userProfile, claims, allowSummary } | null
 */
export function createByomTools(deps) {
  const { db } = deps;
  const secret = deps.briefSecret;
  if (!secret) throw new Error("byom tools need a briefSecret");

  function requireJob(jobId) {
    const job = deps.jobFor(String(jobId ?? ""));
    if (!job) throw new ToolRefusal("unknown_job", "There is no job with that id on the candidate's board (draft_search_jobs and draft_list_my_drafts list them).");
    return job;
  }
  function requireBase(userId) {
    const base = deps.baseFor(userId);
    if (!base?.text || !base.structured?.sections?.length) {
      throw new ToolRefusal("no_base_resume", "This candidate has no base résumé draft can read. A base résumé is uploaded in draft itself.");
    }
    return base;
  }
  function requireCap(userId) {
    const cap = dailyCap(db, userId);
    const used = usedToday(db, userId);
    if (used >= cap) throw new ToolRefusal("daily_cap", `Daily limit reached: ${used} of ${cap} résumés written this way today. It resets at 00:00 UTC.`);
  }
  const mapJob = (row) => (deps.mapJob ? deps.mapJob(row) : row);
  const interviewTool = deps.interviewTool === true;

  const handlers = {
    async draft_search_jobs({ userId }, args = {}) {
      const level = args.level == null || args.level === "" ? null : String(args.level);
      const posted = args.posted_within == null || args.posted_within === "" ? null : String(args.posted_within);
      if (level && !LEVELS.includes(level)) throw new ToolRefusal("bad_level", `level must be one of ${LEVELS.join(", ")}.`);
      if (posted && !POSTED_WITHIN.includes(posted)) throw new ToolRefusal("bad_posted_within", `posted_within must be one of ${POSTED_WITHIN.join(", ")}.`);
      const out = await deps.searchBoard(userId, {
        query: String(args.query ?? "").slice(0, 120).trim(), location: String(args.location ?? "").slice(0, 80).trim(),
        level, postedWithin: posted, limit: SEARCH_LIMIT,
      });
      if (out?.needsProfile) throw new ToolRefusal("no_active_profile", "This candidate has no job profile yet; the board is scoped to one. A profile is created in draft itself.");
      const jobs = (out?.jobs || []).slice(0, SEARCH_LIMIT).map(j => ({
        job_id: String(j.id), title: j.title ?? null, company: j.company ?? null, location: j.location ?? null,
        level: j.experienceLevel ?? null, workplace: j.workplaceType ?? null, posted_at: j.postedAt ?? null,
        pay: payOf(j), ats_score: j.matchScore ?? null,
      }));
      return { jobs, total: out?.total ?? jobs.length, returned: jobs.length };
    },

    draft_get_job(_who, { job_id, include_description } = {}) {
      const row = requireJob(job_id);
      const j = mapJob(row);
      const summary = untrustedText(j.summary || j.description || "", SUMMARY_CHARS);
      const out = {
        job_id: String(row.job_id), title: j.title ?? null, company: j.company ?? null, location: j.location ?? null,
        level: j.experienceLevel ?? row.experience_level ?? null, workplace: j.workplaceType ?? row.workplace_type ?? null,
        pay: payOf(j), required_skills: skillNames(j.skills ?? row.skills_json), posted_at: j.postedAt ?? null,
        // DR-14: what the POSTING says — never a conclusion about the candidate.
        posting_states: { work_authorization_required: j.requiresWorkAuth ?? null, clearance_required: j.isClearanceRequired ?? null,
          h1b_sponsor: j.isH1bSponsor ?? null },
        summary: summary.text,
        link: jobLink(deps.appUrl, row.job_id),
      };
      if (include_description === true) {
        const d = untrustedText(j.description || "", DESCRIPTION_CHARS);
        out.posting_text = { source: "the employer's posting, as data", text: d.text, truncated: d.truncated, neutralised: d.neutralised };
      }
      return out;
    },

    draft_score_resume_for_job({ userId }, { job_id } = {}) {
      const job = requireJob(job_id);
      const base = requireBase(userId);
      const r = deps.scoreText(userId, job, base.text);
      return { job_id: String(job.job_id), score: r?.score ?? null, scorable: r?.scorable !== false,
        decline_reasons: r?.decline_reasons || [], matched: r?.tier1_matched || [], missing: r?.tier1_missing || [] };
    },

    draft_get_resume_brief({ userId }, { job_id, detail } = {}) {
      if (detail != null && !BRIEF_DETAIL.includes(detail)) throw new ToolRefusal("bad_detail", `detail must be one of ${BRIEF_DETAIL.join(", ")}.`);
      const job = requireJob(job_id);
      requireCap(userId);
      const base = requireBase(userId);
      const baseReport = deps.scoreText(userId, job, base.text);
      const expiresAt = now() + BRIEF_TTL_SECONDS;
      const id = signBrief(secret, { userId, jobId: job.job_id, hash: baseHash(base.text), expiresAt, nonce: crypto.randomBytes(12).toString("hex") });
      notify(userId, job.job_id, "waiting");
      // D109 P2: base.backedFor (when the host supplies it) marks each bullet backed / unbacked by the candidate's evidence.
      return buildBrief({ briefId: id, expiresAt, job, structured: base.structured, claims: base.claims, baseReport, allowSummary: base.allowSummary, detail: detail || "full",
        backedFor: typeof base.backedFor === "function" ? base.backedFor : null });
    },

    draft_submit_resume_patch({ userId, connectionId }, { brief_id, patch } = {}) {
      const claim = readBrief(secret, brief_id);
      if (!claim || claim.u !== userId) throw new ToolRefusal("unknown_brief", "That brief id is not valid for this candidate. A brief comes from draft_get_resume_brief.");
      const ledgerId = `brf_${claim.n}`;
      let brief = db.prepare("SELECT * FROM byom_briefs WHERE id = ? AND user_id = ?").get(ledgerId, userId);
      const hash = patchHash(patch);
      if (brief?.status === "used") {
        if (brief.patch_hash === hash) {
          const row = db.prepare("SELECT ats_score FROM resume_versions WHERE user_id = ? AND job_id = ? AND version = ?").get(userId, brief.job_id, brief.resume_version);
          const j = deps.jobFor(brief.job_id) || {};
          return { saved: true, repeated: true, job_id: brief.job_id, title: j.title ?? null, company: j.company ?? null, ats_score: row?.ats_score ?? null, base_ats_score: brief.base_ats_score,
            link: jobLink(deps.appUrl, brief.job_id), message: "This patch was already saved; nothing new was written.", notice: AI_NOTICE };
        }
        throw new ToolRefusal("brief_used", "This brief was already used for a saved résumé. Another résumé needs a new brief from draft_get_resume_brief.");
      }
      if (brief?.status === "exhausted") throw new ToolRefusal("brief_exhausted", `This brief was refused ${MAX_ATTEMPTS} times and is closed. A new brief comes from draft_get_resume_brief.`);
      if (claim.e <= now()) throw new ToolRefusal("brief_expired", "This brief has expired (30 minutes). A new brief comes from draft_get_resume_brief.");

      const job = requireJob(claim.j);
      const base = requireBase(userId);
      if (baseHash(base.text) !== claim.h) {
        if (brief) db.prepare("UPDATE byom_briefs SET status = 'exhausted' WHERE id = ?").run(ledgerId);
        throw new ToolRefusal("base_changed", "The candidate's base résumé changed after this brief was made, so the brief is closed. A new brief comes from draft_get_resume_brief.");
      }
      if (!brief) {
        requireCap(userId);
        const baseReport0 = deps.scoreText(userId, job, base.text);
        // The ledger row holds ids and counts only; the base is re-read and matched by hash (DR-3, DR-4).
        db.prepare(`INSERT INTO byom_briefs (id, user_id, connection_id, job_id, base_hash, base_json, base_ats_score, expires_at)
          VALUES (?,?,?,?,?,'{}',?,?)`).run(ledgerId, userId, connectionId ?? null, String(job.job_id), claim.h, baseReport0?.score ?? null, claim.e);
        brief = db.prepare("SELECT * FROM byom_briefs WHERE id = ?").get(ledgerId);
      }
      const baseStructured = base.structured;
      notify(userId, brief.job_id, "checks");

      const applied = applyPatch(baseStructured, patch, { allowSummary: base.allowSummary });
      let reasons = applied.reasons;
      let html = null;
      if (applied.ok) {
        const baseReport = deps.scoreText(userId, job, base.text);
        reasons = termGuard({ changedText: applied.changedText, baseText: base.text, claims: base.claims, vocabulary: deps.vocabulary(job, baseReport) });
        if (immutablesChanged(baseStructured, applied.structured)) {
          reasons.push({ code: "immutable_changed", message: "An employer, title or date differs from the base résumé. Those cannot change." });
        }
        if (!reasons.length) {
          html = renderPatched(baseStructured, applied.structured);
          const check = deps.claimCheck({ html, profile: base.userProfile, baseResumeText: base.text, domainProfile: base.domainProfile });
          for (const v of check?.violations || []) reasons.push({ code: v.kind || "claim", message: v.message || String(v) });
        }
      }
      if (reasons.length) {
        const attempts = brief.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? "exhausted" : "open";
        db.prepare("UPDATE byom_briefs SET attempts = ?, status = ?, last_refusal = ? WHERE id = ?")
          .run(attempts, status, JSON.stringify(reasons.map(r => ({ code: r.code, message: r.message, ...(r.term ? { term: r.term } : {}) }))), ledgerId);
        notify(userId, brief.job_id, "refused", { reasons: reasons.map(r => r.message), attemptsLeft: MAX_ATTEMPTS - attempts });
        throw new ToolRefusal("refused", status === "exhausted"
          ? `Refused, and this was attempt ${attempts} of ${MAX_ATTEMPTS}: the brief is closed. Nothing was saved.`
          : `Refused — nothing was saved. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left on this brief.`,
          { reasons, attempts_left: MAX_ATTEMPTS - attempts });
      }

      const report = deps.scoreText(userId, job, html);
      const stored = deps.storeResume({ userId, jobId: brief.job_id, job, html, atsScore: report?.score ?? null, atsReport: report,
        baseAtsScore: brief.base_ats_score, domainProfileId: base.domainProfile?.id ?? null });
      db.prepare("UPDATE byom_briefs SET status = 'used', used_at = unixepoch(), attempts = attempts + 1, patch_hash = ?, resume_version = ?, last_refusal = NULL WHERE id = ?")
        .run(hash, stored.version, ledgerId);
      const below = report?.score != null && brief.base_ats_score != null && report.score < brief.base_ats_score;
      notify(userId, brief.job_id, "done", { atsScore: report?.score ?? null, baseAtsScore: brief.base_ats_score, belowBase: below });
      return {
        saved: true, job_id: brief.job_id, title: job.title ?? null, company: job.company ?? null, version: stored.version,
        ats_score: report?.score ?? null, base_ats_score: brief.base_ats_score,
        ...(below ? { warning: `The tailored résumé scores ${report.score}, below the base résumé's ${brief.base_ats_score}.` } : {}),
        scorable: report?.scorable !== false,
        link: jobLink(deps.appUrl, brief.job_id),
        message: "Saved to the candidate's draft account. Claims checked: nothing was added that the candidate never stated.",
        notice: AI_NOTICE,
      };
    },

    draft_list_my_resumes({ userId }) {
      const rows = db.prepare(`SELECT job_id, company, role, ats_score, base_ats_score, updated_at FROM resumes
        WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`).all(userId);
      return { resumes: rows.map(r => ({ job_id: r.job_id, company: r.company, title: r.role, ats_score: r.ats_score,
        base_ats_score: r.base_ats_score, updated_at: new Date(r.updated_at * 1000).toISOString(), link: jobLink(deps.appUrl, r.job_id) })) };
    },

    draft_list_my_drafts({ userId }) {
      const rows = db.prepare(`SELECT rj.job_id, sj.title, sj.company, MAX(rj.created_at) AS added,
          EXISTS(SELECT 1 FROM resumes r WHERE r.user_id = rj.user_id AND r.job_id = rj.job_id) AS has_resume
        FROM apply_run_jobs rj JOIN scraped_jobs sj ON sj.job_id = rj.job_id
        WHERE rj.user_id = ? AND rj.hidden_at IS NULL AND rj.status != 'submitted'
        GROUP BY rj.job_id ORDER BY added DESC LIMIT 50`).all(userId);
      return { drafts: rows.map(r => ({ job_id: r.job_id, title: r.title, company: r.company, has_resume: !!r.has_resume })) };
    },
  };

  function notify(userId, jobId, status, extra = {}) {
    try { deps.notify?.(userId, { type: "byom_status", jobId: String(jobId), status, ...extra }); } catch { /* a status update never fails a call */ }
  }

  /** The job a call is about, for the activity list: named directly, or inside a brief token. */
  const jobIdOf = (args = {}) => args.job_id != null ? String(args.job_id) : (readBrief(secret, args.brief_id)?.j ?? null);

  // D110 P4: served only behind the flag (INTERVIEW_TOOL_DEF above) — off, the tool is neither listed nor callable.
  if (interviewTool) {
    handlers.draft_get_interview_prep = ({ userId }, { job_id } = {}) => {
      const pack = connectorPack(db, userId, job_id);
      if (!pack) throw new ToolRefusal("unknown_application", "The candidate has no application for that job id in draft (draft_list_my_drafts lists drafted jobs).");
      return pack;
    };
  }
  return { handlers, defs: interviewTool ? [...TOOL_DEFS, INTERVIEW_TOOL_DEF] : TOOL_DEFS, jobIdOf };
}

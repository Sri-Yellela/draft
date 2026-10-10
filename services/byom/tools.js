// services/byom/tools.js — ⭐ D86 · THE FIVE TOOLS A USER'S OWN MODEL CALLS.
//
// ⛔ NO MODEL CALL IS MADE BY DRAFT ANYWHERE IN THIS PATH (D17). The model is the user's, inside their own
// Claude or ChatGPT. draft reads, validates, renders, scores and stores — all deterministic, all local.
// This file imports nothing that can reach a model; test/d86ByomTools.test.js holds it to that.
//
// The dependencies that live in server.js's closure (the scorer's weights, the active profile, the résumé
// store) come in through `deps`, so the tools are testable on an in-memory database.
import crypto from "node:crypto";
import { BRIEF_TTL_SECONDS, MAX_ATTEMPTS, baseHash, buildBrief, applyPatch, termGuard, immutablesChanged, renderPatched } from "./resumePatch.js";
import { dailyCap, usedToday } from "./policy.js";

const now = () => Math.floor(Date.now() / 1000);
const READ = "resume:read", WRITE = "resume:write";

// ⛔ D86 compliance: the AI-assistance notice (employment is a high-risk use) — on every saved result, and the
// same words in draft's own panel, so the candidate is told before the résumé goes to an employer.
export const AI_NOTICE = "Written with AI assistance in the candidate's own assistant, and checked by draft for claims the candidate never made. The candidate reads it before sending it to an employer.";

/** Each tool's annotations are explicit booleans, and each carries the justification the review asks for. */
export const TOOL_DEFS = Object.freeze([
  {
    name: "get_generation_brief",
    title: "Get a résumé brief",
    description: "Returns a single-use résumé brief for one of the candidate's jobs: the base résumé as bullets with ids, the skills the candidate has claimed, the job's matched keywords, and the JSON schema a patch must match. Contact details are not included. A brief expires 30 minutes after it is made.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id"],
      properties: { job_id: { type: "string", description: "A job id, as list_my_drafts returns it." } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    scope: READ,
    justification: "Reads the user's own base résumé, claims and one job so their model can tailor the résumé. It changes nothing the user can see; it records a short-lived brief so the result can be checked against the same base.",
  },
  {
    name: "submit_resume",
    title: "Save the tailored résumé",
    description: "Applies a patch to the base résumé a brief was made from, checks that the result adds no skill, employer, title, date, years or seniority the candidate never stated, scores it against the job, and saves it as a new version in the candidate's draft account. A refused patch is not saved, and the result lists each reason. A brief accepts at most 3 attempts.",
    inputSchema: { type: "object", additionalProperties: false, required: ["brief_id", "patch"],
      properties: { brief_id: { type: "string" }, patch: { type: "object", description: "An object matching the brief's output_schema." } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: WRITE,
    justification: "Saves a résumé to the user's own draft account. It adds a new version and never deletes or overwrites an earlier one; sending the same patch again returns the same result.",
  },
  {
    name: "score_resume",
    title: "Score résumé text against a job",
    description: "Scores plain résumé text against one job with draft's ATS scorer and returns the score with the matched and missing terms, or the reasons it declined when the posting carries too little signal to score. Nothing is saved.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id", "content"],
      properties: { job_id: { type: "string" }, content: { type: "string", maxLength: 30000 } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "A deterministic score of text the model supplies against a job the user has; it stores nothing.",
  },
  {
    name: "list_my_drafts",
    title: "List my drafted jobs",
    description: "Lists the jobs in the candidate's Draft House, newest first: job id, title, company and whether a résumé exists.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Lists the user's own queued jobs so they can pick one; titles and companies only.",
  },
  {
    name: "get_my_resumes",
    title: "List my saved résumés",
    description: "Lists the candidate's saved tailored résumés: job, company, ATS score and when each was made, with a link to each in draft. Résumé content is not returned.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    scope: READ,
    justification: "Lists the user's own résumés by job and score, without their content.",
  },
]);

export class ToolRefusal extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; this.extra = extra; }
}

const jobLink = (appUrl, jobId) => `${appUrl}/app/jobs?job=${encodeURIComponent(jobId)}`;
const patchHash = (patch) => crypto.createHash("sha256").update(JSON.stringify(patch ?? null)).digest("hex").slice(0, 32);

/**
 * @param deps {{ db, appUrl, jobFor(jobId), baseFor(userId), scoreText(userId, job, text),
 *   storeResume(args), claimCheck(args), vocabulary(job, baseReport), notify(userId, event) }}
 *   baseFor → { text, structured, domainProfile, userProfile, claims, allowSummary } | null
 */
export function createByomTools(deps) {
  const { db } = deps;

  function requireJob(jobId) {
    const job = deps.jobFor(String(jobId ?? ""));
    if (!job) throw new ToolRefusal("unknown_job", "There is no job with that id among the candidate's jobs (list_my_drafts lists them).");
    return job;
  }
  function requireBase(userId) {
    const base = deps.baseFor(userId);
    if (!base?.text || !base.structured?.sections?.length) {
      throw new ToolRefusal("no_base_resume", "This candidate has no base résumé draft can read. A base résumé is uploaded in draft itself.");
    }
    return base;
  }

  const handlers = {
    get_generation_brief({ userId, connectionId }, { job_id }) {
      const job = requireJob(job_id);
      const cap = dailyCap(db);
      const used = usedToday(db, userId);
      if (used >= cap) throw new ToolRefusal("daily_cap", `This candidate has written ${used} of ${cap} résumés this way today. The limit resets at midnight UTC.`);
      const base = requireBase(userId);
      const baseReport = deps.scoreText(userId, job, base.text);
      const id = `brf_${crypto.randomBytes(12).toString("hex")}`;
      const expiresAt = now() + BRIEF_TTL_SECONDS;
      db.prepare(`INSERT INTO byom_briefs (id, user_id, connection_id, job_id, base_hash, base_json, base_ats_score, expires_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(id, userId, connectionId ?? null, String(job.job_id), baseHash(base.text),
        JSON.stringify(base.structured), baseReport?.score ?? null, expiresAt);
      notify(userId, job.job_id, "waiting");
      return buildBrief({ briefId: id, expiresAt, job, structured: base.structured, claims: base.claims, baseReport, allowSummary: base.allowSummary });
    },

    submit_resume({ userId }, { brief_id, patch }) {
      const brief = db.prepare("SELECT * FROM byom_briefs WHERE id = ? AND user_id = ?").get(String(brief_id ?? ""), userId);
      if (!brief) throw new ToolRefusal("unknown_brief", "There is no brief with that id for this candidate. A brief comes from get_generation_brief.");
      const hash = patchHash(patch);
      if (brief.status === "used") {
        if (brief.patch_hash === hash) {
          const row = db.prepare("SELECT ats_score FROM resume_versions WHERE user_id = ? AND job_id = ? AND version = ?").get(userId, brief.job_id, brief.resume_version);
          const j = deps.jobFor(brief.job_id) || {};
          return { saved: true, repeated: true, job_id: brief.job_id, title: j.title ?? null, company: j.company ?? null, ats_score: row?.ats_score ?? null, base_ats_score: brief.base_ats_score,
            link: jobLink(deps.appUrl, brief.job_id), message: "This patch was already saved; nothing new was written." };
        }
        throw new ToolRefusal("brief_used", "This brief was already used for a saved résumé. Another résumé needs a new brief from get_generation_brief.");
      }
      if (brief.status === "exhausted") throw new ToolRefusal("brief_exhausted", `This brief was refused ${MAX_ATTEMPTS} times and is closed. A new brief comes from get_generation_brief.`);
      if (brief.expires_at <= now()) throw new ToolRefusal("brief_expired", "This brief has expired (30 minutes). A new brief comes from get_generation_brief.");

      const job = requireJob(brief.job_id);
      const base = requireBase(userId);
      if (baseHash(base.text) !== brief.base_hash) {
        db.prepare("UPDATE byom_briefs SET status = 'exhausted' WHERE id = ?").run(brief.id);
        throw new ToolRefusal("base_changed", "The candidate's base résumé changed after this brief was made, so the brief is closed. A new brief comes from get_generation_brief.");
      }
      const baseStructured = JSON.parse(brief.base_json);
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
          .run(attempts, status, JSON.stringify(reasons.map(r => ({ code: r.code, message: r.message, ...(r.term ? { term: r.term } : {}) }))), brief.id);
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
        .run(hash, stored.version, brief.id);
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

    score_resume({ userId }, { job_id, content }) {
      const job = requireJob(job_id);
      const text = String(content ?? "");
      if (!text.trim()) throw new ToolRefusal("empty", "content is empty.");
      if (text.length > 30000) throw new ToolRefusal("too_long", "content is over 30,000 characters.");
      const r = deps.scoreText(userId, job, text);
      return { job_id: String(job.job_id), score: r?.score ?? null, scorable: r?.scorable !== false,
        decline_reasons: r?.decline_reasons || [], matched: r?.tier1_matched || [], missing: r?.tier1_missing || [] };
    },

    list_my_drafts({ userId }) {
      const rows = db.prepare(`SELECT rj.job_id, sj.title, sj.company, MAX(rj.created_at) AS added,
          EXISTS(SELECT 1 FROM resumes r WHERE r.user_id = rj.user_id AND r.job_id = rj.job_id) AS has_resume
        FROM apply_run_jobs rj JOIN scraped_jobs sj ON sj.job_id = rj.job_id
        WHERE rj.user_id = ? AND rj.hidden_at IS NULL AND rj.status != 'submitted'
        GROUP BY rj.job_id ORDER BY added DESC LIMIT 50`).all(userId);
      return { drafts: rows.map(r => ({ job_id: r.job_id, title: r.title, company: r.company, has_resume: !!r.has_resume })) };
    },

    get_my_resumes({ userId }) {
      const rows = db.prepare(`SELECT job_id, company, role, ats_score, base_ats_score, updated_at FROM resumes
        WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`).all(userId);
      return { resumes: rows.map(r => ({ job_id: r.job_id, company: r.company, title: r.role, ats_score: r.ats_score,
        base_ats_score: r.base_ats_score, updated_at: new Date(r.updated_at * 1000).toISOString(), link: jobLink(deps.appUrl, r.job_id) })) };
    },
  };

  function notify(userId, jobId, status, extra = {}) {
    try { deps.notify?.(userId, { type: "byom_status", jobId: String(jobId), status, ...extra }); } catch { /* a status update never fails a call */ }
  }

  return { handlers, defs: TOOL_DEFS };
}

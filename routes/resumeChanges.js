// routes/resumeChanges.js — ⭐ D90 P1 · the "what we changed" endpoints. Authenticated; the user's own data only
// (another user's job, version, upload or application is a 404). Read-only: nothing here writes, scores or calls a
// model. Scores are the STORED ones — never recomputed on read (spec §4: a recomputed strip would drift).
//
//   GET /api/jobs/:id/resume-versions          what can be compared for this job: uploads, tailored versions, sent
//   GET /api/jobs/:id/resume-changes?from&to   any two of them (default: the newest version against its upload)
//   GET /api/applications/:id/resume-sent      the résumé as sent against the upload it was made from
//
// A ref is "upload:<id>", "version:<n>" or "sent:<application record id>"; `from` may also be "base" (the upload
// the `to` side was made from) — the default.
import crypto from "node:crypto";
import express from "express";
import { compareResumes } from "../services/resumeChanges.js";
import { getBaseUpload, listBaseUploads } from "../services/baseResumeHistory.js";
import { readResumeArtifact, SOURCES } from "../services/applicationArtifacts.js";
import { listProfileClaims } from "../services/profileSignalAggregator.js";

const parseJson = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
const sha = (s) => crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");

export function createResumeChangesRouter({ db, requireAuth }) {
  const router = express.Router();

  const versionsFor = (userId, jobId) => db.prepare(`SELECT version, html, ats_score, ats_report, base_ats_score, base_upload_id, tool_type, created_at
    FROM resume_versions WHERE user_id = ? AND job_id = ? ORDER BY version`).all(userId, jobId);
  const sentFor = (userId, jobId) => db.prepare(`SELECT ar.id, ar.submitted_at, ar.recorded_at, ar.created_at, ja.ats_score_at_apply, ja.ats_report_at_apply
    FROM application_records ar
    JOIN application_artifacts aa ON aa.record_id = ar.id AND aa.kind = 'resume'
    LEFT JOIN job_applications ja ON ja.user_id = ar.user_id AND ja.job_id = ar.job_id
    WHERE ar.user_id = ? AND ar.job_id = ? ORDER BY ar.id`).all(userId, jobId);
  const profileOf = (userId, jobId) => db.prepare("SELECT domain_profile_id FROM resumes WHERE user_id = ? AND job_id = ?").pluck().get(userId, jobId) ?? null;

  /** The upload a side was made from: its own record, else (a version from before D90) the profile's earliest upload. */
  function baseFor(userId, jobId, side) {
    if (side.baseUploadId) { const u = getBaseUpload(db, userId, side.baseUploadId); if (u) return { upload: u, known: true }; }
    const uploads = listBaseUploads(db, userId);
    const profileId = profileOf(userId, jobId);
    const pick = uploads.find(u => u.profile_id === profileId) || uploads[0];
    return pick ? { upload: getBaseUpload(db, userId, pick.id), known: false } : null;
  }

  /** Resolves a ref to { ref, kind, label, content, atsScore, report, at, baseUploadId }; null when it is not the user's. */
  function resolve(userId, jobId, ref) {
    const [kind, raw] = String(ref ?? "").split(":");
    if (kind === "upload") {
      const u = getBaseUpload(db, userId, raw);
      return u ? { ref, kind, label: `Your résumé (uploaded ${new Date(u.uploaded_at * 1000).toISOString().slice(0, 10)})`, content: u.content, atsScore: null, report: null, at: u.uploaded_at, baseUploadId: u.id } : null;
    }
    if (kind === "version") {
      const v = versionsFor(userId, jobId).find(x => String(x.version) === raw);
      return v ? { ref, kind, label: `Tailored v${v.version}`, content: v.html, atsScore: v.ats_score, baseAtsScore: v.base_ats_score, report: parseJson(v.ats_report),
        at: v.created_at, baseUploadId: v.base_upload_id, tool: v.tool_type } : null;
    }
    if (kind === "sent") {
      const rec = db.prepare("SELECT id FROM application_records WHERE id = ? AND user_id = ? AND job_id = ?").get(Number(raw), userId, jobId);
      if (!rec) return null;
      const r = readResumeArtifact(db, userId, rec.id);
      if (!r.found || !r.artifact?.html || r.artifact.source === SOURCES.CURRENT) return null;
      const ja = db.prepare("SELECT ats_score_at_apply, ats_report_at_apply FROM job_applications WHERE user_id = ? AND job_id = ?").get(userId, jobId) || {};
      // The version it was sent from, when its HTML is byte-identical — so the sent résumé inherits that version's upload.
      const from = versionsFor(userId, jobId).find(v => sha(v.html) === r.artifact.sha256);
      return { ref, kind, label: "What we sent", content: r.artifact.html, atsScore: ja.ats_score_at_apply ?? null, report: parseJson(ja.ats_report_at_apply),
        at: r.artifact.storedAt, baseUploadId: from?.base_upload_id ?? null, sentFromVersion: from?.version ?? null };
    }
    return null;
  }

  function changes(userId, jobId, fromRef, toRef) {
    const versions = versionsFor(userId, jobId);
    const to = resolve(userId, jobId, toRef || (versions.length ? `version:${versions.at(-1).version}` : null));
    if (!to) return { status: 404, body: { error: "There is no tailored résumé for this job yet." } };
    const base = baseFor(userId, jobId, to);
    let from;
    if (!fromRef || fromRef === "base") {
      if (!base?.upload) return { status: 404, body: { error: "There is no uploaded résumé to compare with." } };
      from = { ref: `upload:${base.upload.id}`, kind: "upload", label: "Your résumé", content: base.upload.content, atsScore: to.baseAtsScore ?? null, at: base.upload.uploaded_at };
    } else {
      from = resolve(userId, jobId, fromRef);
      if (!from) return { status: 404, body: { error: "That résumé is not one of yours." } };
    }
    const profileId = base?.upload?.profile_id ?? profileOf(userId, jobId);
    const claims = profileId != null ? listProfileClaims(db, { userId, profileId }) : { skills: [] };
    const result = compareResumes({ before: from.content, after: to.content, base: base?.upload?.content ?? from.content, claims, afterReport: to.report });
    const first = versions[0];
    const scores = [
      ...(first?.base_ats_score != null ? [{ ref: "base", label: "Base", atsScore: first.base_ats_score }] : []),
      ...versions.map(v => ({ ref: `version:${v.version}`, label: `Tailored v${v.version}`, atsScore: v.ats_score, at: v.created_at, tool: v.tool_type })),
    ];
    const side = (s) => ({ ref: s.ref, kind: s.kind, label: s.label, atsScore: s.atsScore ?? null, at: s.at ?? null, ...(s.sentFromVersion ? { sentFromVersion: s.sentFromVersion } : {}) });
    return { status: 200, body: { from: side(from), to: side(to), baseKnown: !!base?.known, scores, ...result } };
  }

  router.get("/api/jobs/:id/resume-versions", requireAuth, (req, res) => {
    const userId = req.user.id, jobId = String(req.params.id);
    const versions = versionsFor(userId, jobId);
    const sent = sentFor(userId, jobId);
    if (!versions.length && !sent.length) return res.status(404).json({ error: "There is no tailored résumé for this job yet." });
    res.json({
      uploads: listBaseUploads(db, userId).map(u => ({ ref: `upload:${u.id}`, name: u.name, uploadedAt: u.uploaded_at, profileId: u.profile_id })),
      versions: versions.map(v => ({ ref: `version:${v.version}`, version: v.version, atsScore: v.ats_score, baseAtsScore: v.base_ats_score, createdAt: v.created_at, tool: v.tool_type,
        baseRef: v.base_upload_id ? `upload:${v.base_upload_id}` : null })),
      sent: sent.map(s => ({ ref: `sent:${s.id}`, sentAt: s.submitted_at ?? s.recorded_at ?? s.created_at, atsScoreAtApply: s.ats_score_at_apply ?? null })),
      default: { from: "base", to: versions.length ? `version:${versions.at(-1).version}` : `sent:${sent.at(-1).id}` },
    });
  });

  router.get("/api/jobs/:id/resume-changes", requireAuth, (req, res) => {
    const out = changes(req.user.id, String(req.params.id), req.query.from, req.query.to);
    res.status(out.status).json(out.body);
  });

  router.get("/api/applications/:id/resume-sent", requireAuth, (req, res) => {
    const rec = db.prepare("SELECT id, job_id FROM application_records WHERE id = ? AND user_id = ?").get(Number(req.params.id), req.user.id);
    if (!rec) return res.status(404).json({ error: "There is no such application." });
    const out = changes(req.user.id, rec.job_id, "base", `sent:${rec.id}`);
    if (out.status === 404) return res.status(404).json({ error: "No résumé was kept for this application." });
    res.status(out.status).json(out.body);
  });

  return router;
}

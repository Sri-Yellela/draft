// ── A63: the Pending table, recording a submission, and the day's Draft slots ─────────────────
//
// services/applicationRecords.js holds the rule (pending -> recorded -> verified, and what
// "verified" means); services/draftSlots.js holds the allowance. These routes only expose them.
import {
  markPending, recordSubmission, withdraw, withdrawMany, restoreNotApplied, WITHDRAW_MANY_MAX, listRecords, listHistory, readRecord, publicRecord,
  CLIENT_ORIGINS, USER_METHODS, SUBMIT_METHODS, VERIFY_RULE, PENDING_MOVE_DAYS,
} from "../services/applicationRecords.js";
import { draftSlots } from "../services/draftSlots.js";
import { importApplications } from "../services/applicationImport.js";

export default function applicationRecordRoutes(app, db, requireAuth, { capturedAtsAtApply }) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });

  /** What is left of the day's Draft slots — shown BEFORE a Draft or a generation, not after. */
  app.get("/api/draft/slots", requireAuth, (req, res) => {
    res.json(draftSlots(db, req.user.id));
  });

  /** The Pending table (pending + recorded), the recently verified, and the rule, in one read. */
  app.get("/api/applications/pending", requireAuth, (req, res) => {
    res.json({
      ...listRecords(db, req.user.id),
      methods: USER_METHODS.map(value => ({ value, label: SUBMIT_METHODS[value] })),
      verifyRule: VERIFY_RULE,
    });
  });

  /**
   * D15 · The Table — every application, pending and sent, one row each, with its status and
   * timeline (shared/applicationHistory.js). ?q= searches company, title AND the posting text; the
   * text itself is not returned. Chips, date range and sort are applied by the panel over this list.
   */
  app.get("/api/applications/history", requireAuth, (req, res) => {
    const q = String(req.query.q ?? "").slice(0, 200);
    res.json({ rows: listHistory(db, req.user.id, { q }), q });
  });

  /**
   * D55 (i) · import past applications into The Table from a CSV (services/applicationImport.js).
   * DRY RUN unless apply:true — the panel previews exactly what would land. Always the caller's own
   * history (req.user.id); rows land as SENT job_applications, never Drafts, never with a score.
   * Body: { csv: string, mapping: { company, title, applied, outcome?, replied?, url?, location?, notes?, website? }, apply? }
   * 200 { applied, imported, duplicates, invalid } · 413 too_large / too_many_rows · 400 the rest
   */
  app.post("/api/applications/import", requireAuth, (req, res) => {
    const { csv, mapping = {}, apply = false } = req.body || {};
    if (typeof csv !== "string") return res.status(400).json({ error: "csv_required", message: "Send the file's text as csv." });
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
      return res.status(400).json({ error: "mapping_invalid", message: "mapping is { field: column header }." });
    const out = importApplications(db, req.user.id, { csv, mapping, apply: apply === true });
    if (out.error) {
      return res.status(out.error === "too_large" || out.error === "too_many_rows" ? 413 : 400)
        .json({ error: out.error, message: out.detail });
    }
    res.json(out);
  });

  /** Tag a job pending: the user opened its posting, or exported a résumé for it. */
  app.post("/api/applications/pending", requireAuth, (req, res) => {
    const { jobId, origin = "manual" } = req.body || {};
    if (!CLIENT_ORIGINS.includes(origin))
      return res.status(400).json({ error: "bad_origin", message: `origin must be one of ${CLIENT_ORIGINS.join(", ")}.` });
    try {
      const out = markPending(db, req.user.id, jobId, origin);
      res.json({ ok: true, state: out.state, record: publicRecord(out.record) });
    } catch (e) { fail(res, e); }
  });

  /** Record the submission: when, how, and evidence. Verified -> job_applications; else recorded. */
  app.post("/api/applications/pending/:jobId/record", requireAuth, (req, res) => {
    try {
      const out = recordSubmission(db, {
        userId: req.user.id, jobId: req.params.jobId, input: req.body || {}, capturedAtsAtApply,
      });
      res.json({
        ok: true, state: out.state, verified: out.verification.verified,
        checks: out.verification.checks, record: publicRecord(out.record),
        message: out.verification.verified
          ? "Verified — it is in your Submitted applications."
          : "Recorded, not verified yet — see what is missing below. It stays in Pending until it verifies.",
      });
    } catch (e) { fail(res, e); }
  });

  /** A105 finding 2 · "I did not apply" for many — { jobIds: [...] }; only PENDING rows leave (a recorded one keeps its evidence). */
  app.post("/api/applications/pending/withdraw", requireAuth, (req, res) => {
    const ids = req.body?.jobIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > WITHDRAW_MANY_MAX) {
      return res.status(400).json({ error: "job_ids_required", message: `Send { jobIds: [...] } — 1 to ${WITHDRAW_MANY_MAX}.` });
    }
    const n = withdrawMany(db, req.user.id, ids);
    res.json({ ok: true, withdrawn: n, message: `${n} taken out of Pending. Opening a posting again puts it back.` });
  });

  /**
   * D112 c2 · Restore — a Not applied row (moved after 14 days, or one you withdrew) goes back to Pending,
   * its 14 days restarting. 404 when there is no record; 409 when it is not in the Not applied list.
   */
  app.post("/api/applications/not-applied/:jobId/restore", requireAuth, (req, res) => {
    const changed = restoreNotApplied(db, req.user.id, req.params.jobId);
    if (!changed) {
      const r = readRecord(db, req.user.id, req.params.jobId);
      if (!r) return res.status(404).json({ error: "not_found" });
      return res.status(409).json({ error: "not_not_applied", state: r.state, message: `It is ${r.state}, not in Not applied.` });
    }
    res.json({ ok: true, record: publicRecord(readRecord(db, req.user.id, req.params.jobId)),
      message: `Back in Pending — it moves again in ${PENDING_MOVE_DAYS} days if nothing happens.` });
  });

  /** "I did not apply." */
  app.post("/api/applications/pending/:jobId/withdraw", requireAuth, (req, res) => {
    const changed = withdraw(db, req.user.id, req.params.jobId);
    if (!changed) {
      const r = readRecord(db, req.user.id, req.params.jobId);
      if (!r) return res.status(404).json({ error: "not_found" });
      return res.status(409).json({ error: "not_pending", state: r.state,
        message: r.state === "verified" ? "This one is verified and in your Submitted list." : `It is ${r.state}.` });
    }
    res.json({ ok: true, message: "Taken out of Pending. Opening the posting again puts it back." });
  });
}

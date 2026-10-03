// ── A63: the Pending table, recording a submission, and the day's Draft slots ─────────────────
//
// services/applicationRecords.js holds the rule (pending -> recorded -> verified, and what
// "verified" means); services/draftSlots.js holds the allowance. These routes only expose them.
import {
  markPending, recordSubmission, withdraw, listRecords, listHistory, readRecord, publicRecord,
  CLIENT_ORIGINS, USER_METHODS, SUBMIT_METHODS, VERIFY_RULE,
} from "../services/applicationRecords.js";
import { draftSlots } from "../services/draftSlots.js";

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

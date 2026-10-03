// ── D16: download the résumé an application sent ───────────────────────────────────────────────
//
// GET /api/applications/:recordId/resume[?inline=1]
//   recordId  application_records.id — the user's own, or 404 (whose it is is not disclosed)
//   inline=1  served inline instead of as an attachment, so the client can open it and print it
//
// It answers with the stored HTML, expanded and checksum-verified. ⛔ NO SERVER-SIDE PDF: draft
// deliberately answers 503 "use client-side print" on /api/export-pdf and /api/resumes/:jobId/pdf (a
// Chromium per request is the RAM spike the htmlToPdf/Gotenberg note is about), and the tools service's
// rule is the same — "a PDF is printed by the browser and never stored". The HTML is the print-ready
// document; the client prints it.
//
//   200  text/html. X-Artifact-Source says WHICH résumé it is:
//          snapshot_at_record  copied when the application was recorded — what was sent
//          backfill            copied later from the résumé as it stood then
//          current_resume      NO copy exists: the working résumé now, which a regeneration may have
//                              changed since the application
//        X-Artifact-Sha256 is the hash of the HTML served.
//   404  { error: "not_found" }          no such record for this user
//   404  { error: "artifact_missing" }   the record exists; no résumé was ever kept or generated
//   500  { error: "artifact_corrupt" }   ⛔ the stored copy failed to decompress or its checksum —
//                                        said out loud, never an empty file
import { readResumeArtifact, artifactFilename, ArtifactCorruptError } from "../services/applicationArtifacts.js";

export default function applicationArtifactRoutes(app, db, requireAuth) {
  app.get("/api/applications/:recordId/resume", requireAuth, (req, res) => {
    let found;
    try {
      found = readResumeArtifact(db, req.user.id, req.params.recordId);
    } catch (e) {
      if (e instanceof ArtifactCorruptError) {
        console.error(`[artifacts] CORRUPT résumé for record ${req.params.recordId} (user ${req.user.id}): ${e.message}`, e.detail);
        return res.status(500).json({ error: "artifact_corrupt",
          message: "The saved copy of this résumé is damaged and cannot be opened. Nothing was sent to you in its place." });
      }
      console.error(`[artifacts] read failed for record ${req.params.recordId}: ${e.message}`);
      return res.status(500).json({ error: "artifact_read_failed", message: "The résumé could not be read." });
    }
    if (!found.found) return res.status(404).json({ error: "not_found", message: "No such application." });
    const a = found.artifact;
    if (!a) {
      return res.status(404).json({ error: "artifact_missing",
        message: "No résumé was kept for this application — none was generated in Draft for it." });
    }
    const inline = req.query.inline === "1" || req.query.inline === "true";
    res.set("X-Artifact-Source", a.source);
    res.set("X-Artifact-Sha256", a.sha256);
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    // The HTML is model-generated and served from draft's own origin: sandboxed (an opaque origin,
    // no script), styles and data: images only. The user prints it with the browser's own print.
    res.set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${artifactFilename(a, "html")}"`);
    return res.send(a.html);
  });
}

// services/resumePdfArtifacts.js — ⭐ D98 P1: the PDF the extension attaches, KEPT, linked to its job and its snapshot.
//
// ⚠ THIS REVERSES D16's RULE FOR ONE PATH. D16 (services/applicationArtifacts.js) measured a stored PDF at ~56x a
// brotli HTML snapshot and decided to keep HTML and print a PDF on demand. D98 asks for the FILE the page received to
// be kept, so *What we sent* can show exactly it. So this one artifact is a PDF, stored once per (generation, HTML)
// as a BLOB (no volume path, no temp file), with D16's other rules: the 2 MB cap, a refusal when the volume is low,
// the sha256 of the bytes checked on every read.
//
// RETENTION. A PDF linked to an application record lives exactly as long as that record (ON DELETE CASCADE, as
// application_artifacts does). One not linked goes with the job's résumé (services/generatedResumes.js
// deleteGeneratedResume) and with the account (users cascade).
//
// THE LINK. The apply snapshot is taken when the application is RECORDED, which is after an attach. So the link is
// made twice: at attach, when a record already exists, and by snapshotResumeForRecord, which links the newest
// attached PDF for (user, job) to the record and its HTML snapshot row.
import crypto from "node:crypto";
import { MAX_ARTIFACT_RAW_BYTES, volumeRoomFor } from "./applicationArtifacts.js";

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

export class PdfStoreError extends Error {
  constructor(code) { super(code); this.name = "PdfStoreError"; this.code = code; }
}

const COLUMNS = "id, user_id, job_id, generation_id, resume_version, html_sha256, file_name, media_type, sha256, byte_size, attached_at, record_id, snapshot_artifact_id, created_at";

/** The stored PDF for this generation and this exact HTML, or null. Never the body. */
export function findPdf(db, userId, generationId, htmlSha256) {
  return db.prepare(`SELECT ${COLUMNS} FROM resume_pdf_artifacts WHERE user_id = ? AND generation_id = ? AND html_sha256 = ? ORDER BY id DESC LIMIT 1`)
    .get(userId, generationId, htmlSha256) || null;
}

/** Stores one PDF. Throws PdfStoreError('too_large' | 'storage_full' | 'empty'). Returns the row (no body). */
export function storePdf(db, { userId, jobId, generationId = null, version = null, htmlSha256, fileName, pdf, statfs } = {}) {
  const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf || []);
  if (!buf.length) throw new PdfStoreError("empty");
  if (buf.length > MAX_ARTIFACT_RAW_BYTES) throw new PdfStoreError("too_large");
  if (!volumeRoomFor(db, buf.length, statfs ? { statfs } : undefined).ok) throw new PdfStoreError("storage_full");
  const id = db.prepare(`INSERT INTO resume_pdf_artifacts (user_id, job_id, generation_id, resume_version, html_sha256, file_name, sha256, byte_size, body)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, String(jobId), generationId, version, htmlSha256, fileName, sha256(buf), buf.length, buf).lastInsertRowid;
  return db.prepare(`SELECT ${COLUMNS} FROM resume_pdf_artifacts WHERE id = ?`).get(id);
}

/** The bytes of one of the user's PDFs, checked against their hash; null when it is not theirs or does not verify. */
export function readPdf(db, userId, pdfId) {
  const row = db.prepare("SELECT * FROM resume_pdf_artifacts WHERE id = ? AND user_id = ?").get(Number(pdfId), userId);
  if (!row?.body) return null;
  const body = Buffer.isBuffer(row.body) ? row.body : Buffer.from(row.body);
  if (sha256(body) !== row.sha256 || body.length !== Number(row.byte_size)) return null;
  return { fileName: row.file_name, mediaType: row.media_type, body, sha256: row.sha256 };
}

/** Links one PDF to the job's application record and its HTML snapshot, when they exist. Returns the record id or null. */
export function linkPdfToRecord(db, userId, pdfId) {
  const pdf = db.prepare("SELECT id, job_id FROM resume_pdf_artifacts WHERE id = ? AND user_id = ?").get(Number(pdfId), userId);
  if (!pdf) return null;
  const rec = db.prepare("SELECT id FROM application_records WHERE user_id = ? AND job_id = ?").get(userId, pdf.job_id);
  if (!rec) return null;
  const snap = db.prepare("SELECT id FROM application_artifacts WHERE record_id = ? AND kind = 'resume'").get(rec.id);
  db.prepare("UPDATE resume_pdf_artifacts SET record_id = ?, snapshot_artifact_id = ? WHERE id = ?").run(rec.id, snap?.id ?? null, pdf.id);
  return rec.id;
}

/** Called by snapshotResumeForRecord: the newest ATTACHED PDF for (user, job) joins the record. Never throws. */
export function linkAttachedPdfToRecord(db, { userId, jobId, recordId, snapshotArtifactId = null }) {
  try {
    const row = db.prepare(`SELECT id FROM resume_pdf_artifacts WHERE user_id = ? AND job_id = ? AND attached_at IS NOT NULL
      ORDER BY attached_at DESC, id DESC LIMIT 1`).get(userId, String(jobId));
    if (!row) return null;
    db.prepare("UPDATE resume_pdf_artifacts SET record_id = ?, snapshot_artifact_id = COALESCE(?, snapshot_artifact_id) WHERE id = ?")
      .run(recordId, snapshotArtifactId, row.id);
    return row.id;
  } catch (e) {
    if (!/no such table/.test(String(e?.message))) console.warn(`[pdf-artifacts] link failed for job ${jobId}: ${e.message}`);
    return null;
  }
}

/** The PDF kept with an application record (What we sent), or null. Never the body. */
export function pdfForRecord(db, userId, recordId) {
  try {
    return db.prepare(`SELECT ${COLUMNS} FROM resume_pdf_artifacts WHERE user_id = ? AND record_id = ? ORDER BY id DESC LIMIT 1`).get(userId, Number(recordId)) || null;
  } catch { return null; }
}

/** With the job's résumé: every PDF for (user, job) not kept by an application record. */
export function deleteUnlinkedPdfs(db, userId, jobId) {
  try {
    return db.prepare("DELETE FROM resume_pdf_artifacts WHERE user_id = ? AND job_id = ? AND record_id IS NULL").run(userId, String(jobId)).changes;
  } catch (e) {
    if (/no such table/.test(String(e?.message))) return 0;
    throw e;
  }
}

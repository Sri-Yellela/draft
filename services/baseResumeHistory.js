// services/baseResumeHistory.js — ⭐ D90 · EVERY BASE RÉSUMÉ THE USER UPLOADED, KEPT.
//
// Owner, 10-10: "base would be base as in the résumé the user would upload originally — any change would be
// compared against that, or we can have a compare that lets them select which two to compare." The profile's
// base row (`profile_base_resumes`) is overwritten on each upload, so before this nothing could say what a
// tailored version was made FROM once the user uploaded again. Now:
//   · every DISTINCT base saved for a profile is a row here (deduplicated by content hash — saving the same
//     text twice adds nothing);
//   · every tailored version records the upload it was made from (`resume_versions.base_upload_id`);
//   · a comparison defaults to a version against ITS upload, and the user may pick any two.
// Pure SQL on purpose — no import from simpleApplyProfile.js, which calls into this module.
import crypto from "node:crypto";

// ⭐ THE ONE NORMALISATION a base résumé's hash is taken over: CRLF → LF, then the ends trimmed. Every hasher goes
// through it — the upload record below AND the extension's base (extensionResume.js baseResumeFor, which trims before
// it hashes). Until 11-05 this did not trim, so a base saved with a trailing newline was recorded under H(text + "\n")
// while the extension looked it up under H(text): the web app's tailored version was never found and the extension
// made (and charged for) a second one. Whitespace at the ends of a résumé is never content.
export const normaliseBaseText = (text) => String(text ?? "").replace(/\r\n/g, "\n").trim();
export const hashBase = (text) => crypto.createHash("sha256").update(normaliseBaseText(text)).digest("hex");

// Rows whose stored hash may be in the OLD (untrimmed) form: no hash yet, or content with whitespace at either end
// (for every other row trimming changes nothing, so its stored hash is already the new form). They are re-hashed in
// place from their content — which is kept — so a row stored before the fix matches like one stored after it.
const EDGE_WS = "char(32, 9, 10, 13, 11, 12, 160)";
const STALE_HASH_SQL = `(content_hash IS NULL OR content GLOB '[' || ${EDGE_WS} || ']*' OR content GLOB '*[' || ${EDGE_WS} || ']')`;

function fillHashes(db, userId, profileId = undefined) {
  const scoped = profileId !== undefined;
  const rows = db.prepare(`SELECT id, content, content_hash FROM base_resume_uploads WHERE user_id = ?${scoped ? " AND profile_id IS ?" : ""} AND ${STALE_HASH_SQL}`)
    .all(...(scoped ? [userId, profileId ?? null] : [userId]));
  const set = db.prepare("UPDATE base_resume_uploads SET content_hash = ? WHERE id = ?");
  for (const r of rows) { const h = hashBase(r.content); if (h !== r.content_hash) set.run(h, r.id); }
}

/** Brings every one of the user's stored upload hashes to the current form (cheap: only edge-whitespace rows are read). */
export function normaliseUploadHashes(db, userId) {
  try { fillHashes(db, userId); } catch { /* a missing table on an old fixture — the lookup below simply finds nothing */ }
}

/** Records a base the user saved; returns the upload's id (an existing one when the text is unchanged). */
export function recordBaseUpload(db, { userId, profileId = null, content, name = null, source = "upload" }) {
  const text = String(content ?? "");
  if (!text.trim()) return null;
  fillHashes(db, userId, profileId);
  const hash = hashBase(text);
  const existing = db.prepare("SELECT id FROM base_resume_uploads WHERE user_id = ? AND profile_id IS ? AND content_hash = ? ORDER BY id LIMIT 1")
    .pluck().get(userId, profileId ?? null, hash);
  if (existing) return existing;
  return Number(db.prepare(`INSERT INTO base_resume_uploads (user_id, profile_id, name, content, content_hash, source) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, profileId ?? null, name, text, hash, source).lastInsertRowid);
}

/** The upload that is the profile's base RIGHT NOW (recorded if it is not yet) — what a new version is made from. */
export function currentBaseUploadId(db, { userId, profileId = null }) {
  const row = profileId != null
    ? db.prepare("SELECT content, name FROM profile_base_resumes WHERE user_id = ? AND profile_id = ?").get(userId, profileId)
    : db.prepare("SELECT content, name FROM base_resume WHERE user_id = ?").get(userId);
  if (!row || !String(row.content ?? "").trim()) return null;
  return recordBaseUpload(db, { userId, profileId, content: row.content, name: row.name, source: "seen" });
}

export function listBaseUploads(db, userId, profileId = undefined) {
  const where = profileId === undefined ? "" : " AND profile_id IS ?";
  const args = profileId === undefined ? [userId] : [userId, profileId ?? null];
  return db.prepare(`SELECT id, profile_id, name, source, uploaded_at FROM base_resume_uploads WHERE user_id = ?${where} ORDER BY uploaded_at, id`).all(...args);
}

/** One upload, the user's own only (null otherwise). */
export function getBaseUpload(db, userId, id) {
  return db.prepare("SELECT * FROM base_resume_uploads WHERE id = ? AND user_id = ?").get(Number(id), userId) || null;
}

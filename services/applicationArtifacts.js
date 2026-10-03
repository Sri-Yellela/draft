// ── D16: the résumé an application SENT — compressed at rest, expanded on demand ───────────────────
//
// WHY A SNAPSHOT AND NOT resumes.html. `resumes` is the working copy, UNIQUE(user_id, job_id): a
// regeneration OVERWRITES it, and a PDF is printed into os.tmpdir() for the browser run and then
// deleted. So before D16 nothing in draft could answer "what did I send them?" — the thing a user
// actually wants back from The Table months later. At the moment an application is recorded (by the
// user, or by the pipeline after a Draft submits) the résumé's HTML is copied here, once, and kept.
//
// WHY HTML, BROTLI, AND NOT A STORED PDF (measured 10-03 on six real-shaped résumés through draft's
// own formatter and its Chromium print path): HTML 9.0 KB → gzip-9 2.14 KB (4.2x) → brotli-11
// 1.67 KB (5.4x). The PDF of the same résumé is 94 KB and compresses only 1.2x (77 KB) — a stored
// PDF costs ~56x a stored HTML. So the HTML is kept and a PDF is printed from it when asked. ~1.7 MB
// per 1,000 applications instead of ~77 MB. This is the tools service's A65 rule too ("size it for PDFs,
// not rows": what is stored is text/HTML; a PDF is printed and never stored).
//
// ⛔ A CORRUPT ARTIFACT FAILS LOUDLY. Every row carries the sha256 of the UNCOMPRESSED bytes; a
// decompress error, a hash mismatch or an empty result throws ArtifactCorruptError — never an empty
// file with a 200 (the route answers 500 artifact_corrupt and logs it).
//
// DUAL PATH. `encoding` is 'br' for everything this module writes, but 'gzip' and 'identity' read
// too: an 'identity' row (written uncompressed — by hand, by a future import, or when compression is
// switched off with APPLICATION_ARTIFACT_ENCODING=identity) is served the same way, and
// scripts/d16CompressArtifacts.mjs re-encodes such rows in place, verifying each one.
//
// RETENTION — reconciled with the tools service's, deliberately NOT the same answer. the tools service's
// stored documents (A57/A65) are a user's OPT-IN tool outputs: they expire after 90 days unless
// pinned. This is different in kind — it is the record of something the user DID, the evidence
// behind an application and its outcome (D15) — so it lives exactly as long as its application
// record: deleted with the record, and with the account (application_records cascades from users).
// The OTHER A65 rules are shared: a 2 MB cap per document, and a save is REFUSED, not attempted,
// when the volume is low (draft hit ENOSPC at 481/500 MB on 09-29). A refused or failed snapshot
// never blocks recording the application; the download then says it is serving the CURRENT résumé.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const ARTIFACT_KIND_RESUME = "resume";
export const ENCODINGS = Object.freeze(["br", "gzip", "identity"]);
/** Same cap as the tools service's stored documents (A65). A real résumé is ~10 KB. */
export const MAX_ARTIFACT_RAW_BYTES = 2 * 1024 * 1024;
export const SOURCES = Object.freeze({
  /** Copied when the application was recorded — what was sent. */
  SNAPSHOT: "snapshot_at_record",
  /** Copied later by scripts/d16CompressArtifacts.mjs --backfill, from the résumé as it stood then. */
  BACKFILL: "backfill",
  /** Not stored: no snapshot exists, so the working copy is served — and labelled as such. */
  CURRENT: "current_resume",
});

export class ArtifactCorruptError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = "ArtifactCorruptError";
    this.code = "artifact_corrupt";
    this.detail = detail;
  }
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

export function chosenEncoding(env = process.env) {
  const e = String(env?.APPLICATION_ARTIFACT_ENCODING || "br").toLowerCase();
  return ENCODINGS.includes(e) ? e : "br";
}

/** Compress `raw` (Buffer or string). Pure; returns what a row stores. */
export function encodeArtifact(raw, encoding = "br") {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), "utf8");
  let body;
  if (encoding === "br") {
    body = zlib.brotliCompressSync(buf, { params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    } });
  } else if (encoding === "gzip") body = zlib.gzipSync(buf, { level: 9 });
  else if (encoding === "identity") body = Buffer.from(buf);
  else throw new Error(`unknown artifact encoding ${encoding}`);
  return { encoding, body, sha256: sha256(buf), rawBytes: buf.length, storedBytes: body.length };
}

/**
 * Expand a stored row back to its bytes. Throws ArtifactCorruptError on ANY doubt — an unknown
 * encoding, a decompress error, a length or hash mismatch, or nothing at all.
 */
export function decodeArtifact(row) {
  const where = { id: row?.id ?? null, recordId: row?.record_id ?? null, encoding: row?.encoding ?? null };
  if (!row || row.body == null) throw new ArtifactCorruptError("The stored résumé has no content.", where);
  const body = Buffer.isBuffer(row.body) ? row.body : Buffer.from(row.body);
  let out;
  try {
    if (row.encoding === "br") out = zlib.brotliDecompressSync(body);
    else if (row.encoding === "gzip") out = zlib.gunzipSync(body);
    else if (row.encoding === "identity") out = body;
    else throw new Error(`unknown encoding ${row.encoding}`);
  } catch (e) {
    throw new ArtifactCorruptError(`The stored résumé could not be decompressed (${e.message}).`, where);
  }
  if (!out.length) throw new ArtifactCorruptError("The stored résumé decompressed to nothing.", where);
  if (row.raw_bytes != null && out.length !== Number(row.raw_bytes)) {
    throw new ArtifactCorruptError(`The stored résumé is ${out.length} bytes; ${row.raw_bytes} were stored.`, where);
  }
  if (!row.sha256 || sha256(out) !== row.sha256) {
    throw new ArtifactCorruptError("The stored résumé does not match its checksum.", where);
  }
  return out;
}

/**
 * Is there room on the database's volume for `bytes` more, keeping a reserve free? the tools service's
 * rule (A65): the reserve is the larger of 64 MB and 15 % of the volume. An in-memory database
 * (tests) always has room; a volume statfs cannot read does not block. `statfs` is injectable.
 */
export function volumeRoomFor(db, bytes, { statfs = fs.statfsSync } = {}) {
  const file = db?.name;
  if (!file || file === ":memory:") return { ok: true };
  let s;
  try { s = statfs(path.dirname(path.resolve(file))); } catch { return { ok: true }; }
  const total = s.blocks * s.bsize, free = s.bavail * s.bsize;
  const reserve = Math.max(64 * 1024 * 1024, Math.floor(total * 0.15));
  return free - bytes >= reserve ? { ok: true } : { ok: false, free, total, reserve };
}

function readRecordRow(db, userId, jobId) {
  return db.prepare("SELECT id FROM application_records WHERE user_id = ? AND job_id = ?").get(userId, String(jobId)) || null;
}

function readWorkingResume(db, userId, jobId) {
  try {
    return db.prepare("SELECT id, html, company, role, updated_at FROM resumes WHERE user_id = ? AND job_id = ?")
      .get(userId, String(jobId)) || null;
  } catch { return null; }
}

/**
 * Copy the résumé for (user, job) onto its application record, ONCE. The first snapshot is what was
 * sent; a later re-record (recorded → verified) keeps it. Never throws — the caller is recording an
 * application, and a snapshot that cannot be taken must not stop that. Returns what happened.
 */
export function snapshotResumeForRecord(db, { userId, jobId, source = SOURCES.SNAPSHOT, env = process.env, statfs } = {}) {
  try {
    const record = readRecordRow(db, userId, jobId);
    if (!record) return { stored: false, reason: "no_record" };
    const existing = db.prepare("SELECT id FROM application_artifacts WHERE record_id = ? AND kind = ?")
      .get(record.id, ARTIFACT_KIND_RESUME);
    if (existing) return { stored: false, reason: "already_stored", artifactId: existing.id };
    const resume = readWorkingResume(db, userId, jobId);
    if (!resume?.html || !String(resume.html).trim()) return { stored: false, reason: "no_resume" };
    const enc = encodeArtifact(resume.html, chosenEncoding(env));
    if (enc.rawBytes > MAX_ARTIFACT_RAW_BYTES) return { stored: false, reason: "too_large" };
    const room = volumeRoomFor(db, enc.storedBytes, statfs ? { statfs } : undefined);
    if (!room.ok) {
      console.warn(`[artifacts] snapshot REFUSED for record ${record.id}: volume low (free ${room.free}, reserve ${room.reserve})`);
      return { stored: false, reason: "storage_full" };
    }
    const info = db.prepare(`
      INSERT OR IGNORE INTO application_artifacts
        (record_id, kind, media_type, encoding, sha256, raw_bytes, stored_bytes, body, source, resume_id, resume_updated_at)
      VALUES (?, ?, 'text/html', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, ARTIFACT_KIND_RESUME, enc.encoding, enc.sha256, enc.rawBytes, enc.storedBytes, enc.body,
           source, resume.id ?? null, resume.updated_at ?? null);
    return info.changes
      ? { stored: true, artifactId: Number(info.lastInsertRowid), rawBytes: enc.rawBytes, storedBytes: enc.storedBytes }
      : { stored: false, reason: "already_stored" };
  } catch (e) {
    console.warn(`[artifacts] snapshot failed for job ${jobId}: ${e.message}`);
    return { stored: false, reason: "error", message: e.message };
  }
}

/**
 * The résumé for application record `recordId`, if it belongs to `userId`.
 *   { found: false }                                    — no such record for this user
 *   { found: true, artifact: null }                     — the record exists; no résumé anywhere
 *   { found: true, artifact: { html, source, ... } }    — expanded and verified
 * Throws ArtifactCorruptError when a stored artifact does not decode.
 */
export function readResumeArtifact(db, userId, recordId) {
  const rid = Number(recordId);
  if (!Number.isInteger(rid) || rid <= 0) return { found: false };
  const record = db.prepare(`
    SELECT ar.id, ar.job_id, ar.state, sj.company AS job_company, sj.title AS job_title
    FROM application_records ar LEFT JOIN scraped_jobs sj ON sj.job_id = ar.job_id
    WHERE ar.id = ? AND ar.user_id = ?
  `).get(rid, userId);
  if (!record) return { found: false };
  const row = db.prepare("SELECT * FROM application_artifacts WHERE record_id = ? AND kind = ?").get(rid, ARTIFACT_KIND_RESUME);
  const resume = readWorkingResume(db, userId, record.job_id);
  const company = record.job_company || resume?.company || null;
  const role = record.job_title || resume?.role || null;
  if (row) {
    const bytes = decodeArtifact(row);
    return { found: true, record, artifact: {
      html: bytes.toString("utf8"), mediaType: row.media_type, source: row.source, sha256: row.sha256,
      storedAt: row.created_at, rawBytes: row.raw_bytes, storedBytes: row.stored_bytes, company, role,
    } };
  }
  if (resume?.html && String(resume.html).trim()) {
    const buf = Buffer.from(resume.html, "utf8");
    return { found: true, record, artifact: {
      html: resume.html, mediaType: "text/html", source: SOURCES.CURRENT, sha256: sha256(buf),
      storedAt: null, rawBytes: buf.length, storedBytes: null, company, role,
    } };
  }
  return { found: true, record, artifact: null };
}

/** "resume-acme-staff-engineer" — ASCII only, for a Content-Disposition filename. */
export function artifactFilename({ company, role } = {}, ext = "html") {
  const slug = [company, role].filter(Boolean).join(" ")
    .normalize("NFKD").replace(/[^\x20-\x7e]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `resume${slug ? `-${slug}` : ""}.${ext}`;
}

/**
 * Re-encode stored rows whose encoding is not the chosen one (e.g. 'identity' → 'br'), verifying
 * each: decode → re-encode → decode the new body and compare hashes, all before the UPDATE. With
 * `backfill`, also snapshot recorded/verified records that have none, labelled SOURCES.BACKFILL —
 * honest that it is the résumé as it stands NOW, not necessarily what was sent.
 */
export function compressArtifacts(db, { apply = false, backfill = false, env = process.env } = {}) {
  const target = chosenEncoding(env);
  const out = { target, reencoded: 0, rawBytes: 0, before: 0, after: 0, corrupt: [], backfilled: 0, backfillCandidates: 0 };
  const rows = db.prepare("SELECT * FROM application_artifacts WHERE encoding != ?").all(target);
  for (const row of rows) {
    let bytes;
    try { bytes = decodeArtifact(row); } catch (e) { out.corrupt.push({ id: row.id, recordId: row.record_id, message: e.message }); continue; }
    const enc = encodeArtifact(bytes, target);
    const check = decodeArtifact({ ...row, ...{ body: enc.body, encoding: enc.encoding, sha256: enc.sha256, raw_bytes: enc.rawBytes } });
    if (sha256(check) !== row.sha256) { out.corrupt.push({ id: row.id, recordId: row.record_id, message: "round trip changed the bytes" }); continue; }
    out.reencoded++; out.rawBytes += enc.rawBytes; out.before += row.stored_bytes; out.after += enc.storedBytes;
    if (apply) {
      db.prepare("UPDATE application_artifacts SET encoding = ?, body = ?, stored_bytes = ? WHERE id = ? AND sha256 = ?")
        .run(enc.encoding, enc.body, enc.storedBytes, row.id, row.sha256);
    }
  }
  if (backfill) {
    const missing = db.prepare(`
      SELECT ar.user_id, ar.job_id FROM application_records ar
      WHERE ar.state IN ('recorded', 'verified')
        AND NOT EXISTS (SELECT 1 FROM application_artifacts aa WHERE aa.record_id = ar.id AND aa.kind = ?)
    `).all(ARTIFACT_KIND_RESUME);
    out.backfillCandidates = missing.length;
    if (apply) {
      for (const m of missing) {
        if (snapshotResumeForRecord(db, { userId: m.user_id, jobId: m.job_id, source: SOURCES.BACKFILL, env }).stored) out.backfilled++;
      }
    }
  }
  return out;
}

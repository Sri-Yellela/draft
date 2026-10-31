// services/learn/learnContent.js — ⭐ D115 · the owner's tracker as the app reads it.
// ⭐ D118 P2 · THE DATABASE IS THE SOURCE: `learnContent(db)` reads the learn_content row (migration 198), which Admin →
// Atlas → Import content replaces with no deploy and no restart. The parsed document is kept in memory per database and
// row version, so a read costs one indexed SELECT of two numbers; an Apply moves the version and the next read has it.
// content/learn/silicon-to-software.json (written by scripts/learn/extractTracker.mjs) is the FIRST-INSTALL seed only
// (services/learn/learnImport.js seedLearnContentIfEmpty) — read here only where the database has no row (a fresh test
// database, or a call with no database at all).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEARN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/learn");
export const LEARN_FILE = path.join(LEARN_DIR, "silicon-to-software.json");
/** The row the app reads: the content file's own name, so the first-install seed lands where the app looks. */
export const LEARN_ID = "silicon-to-software";

let fileCache = null;
function fromFile(file) {
  if (fileCache && fileCache.file === file) return fileCache.data;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  fileCache = { file, data };
  return data;
}

let dbCache = { db: null, key: null, data: null };
/** The stored row's version — `null` when there is none (or no learn_content table). */
export function learnContentVersion(db, id = LEARN_ID) {
  try { return db.prepare(`SELECT version, imported_at AS at, imported_by AS by FROM learn_content WHERE id = ?`).get(id) || null; }
  catch { return null; }
}

/**
 * @param src a better-sqlite3 database (the app's source), or a file path (the extractor's file; tests)
 * @returns {{ source, copy, PARTS, ATLAS, INDEX }}
 */
export function learnContent(src) {
  if (src && typeof src.prepare === "function") {
    const v = learnContentVersion(src);
    if (!v) return fromFile(LEARN_FILE);
    const key = `${v.version}:${v.at}`;
    if (dbCache.db === src && dbCache.key === key) return dbCache.data;
    const data = JSON.parse(src.prepare(`SELECT data FROM learn_content WHERE id = ?`).pluck().get(LEARN_ID));
    dbCache = { db: src, key, data };
    return data;
  }
  return fromFile(typeof src === "string" ? src : LEARN_FILE);
}

/** Every step, in order, with its part and phase — the tracker's own numbering (Step 1 … 108). */
export function stepsOf(learn) {
  const out = [];
  learn.PARTS.forEach((part, pi) => (part.phases || []).forEach(ph => (ph.steps || []).forEach(s => {
    out.push({ ...s, n: out.length + 1, part: part.t, partIndex: pi + 1, phase: ph.t, phaseId: ph.id });
  })));
  return out;
}

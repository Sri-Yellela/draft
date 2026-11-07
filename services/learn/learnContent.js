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

// ⭐ D178-2 · REAL LINKS, NOT SEARCHES: content/links/learn-links-v*.json maps an item id to a VERIFIED real page (the video,
// the playlist, the book's page) found for an item that linked to a search. It is laid over whatever content Learn serves
// (the seed or the learn_content row), so production gets it on deploy with no re-import. An entry without a url changes
// nothing. `by` (the verified channel / author) names the item's source where its own `s` did not (D176-3).
export const LINKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/links");
let linksCache = null;
export function linkReplacements(dir = LINKS_DIR) {
  if (linksCache && linksCache.dir === dir) return linksCache.map;
  const map = new Map();
  try {
    for (const f of fs.readdirSync(dir).filter(x => /^learn-links-v\d+\.json$/.test(x)).sort())
      for (const e of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).links || [])
        if (e?.id && typeof e.url === "string" && /^https:\/\//.test(e.url)) map.set(e.id, { url: e.url, by: e.by || null });
  } catch { /* no file: nothing replaced */ }
  linksCache = { dir, map };
  return map;
}
/** The document with every replaced link applied (a copy; the input is never changed). */
export function withRealLinks(doc, map = linkReplacements()) {
  if (!doc?.PARTS || !map.size) return doc;
  return { ...doc, PARTS: doc.PARTS.map(p => ({ ...p, phases: (p.phases || []).map(ph => ({ ...ph, steps: (ph.steps || []).map(st => ({ ...st,
    items: (st.items || []).map(it => { const r = map.get(it.id); return r ? { ...it, u: r.url, ...(r.by ? { by: r.by } : {}) } : it; }) })) })) })) };
}
export const _resetLinks = () => { linksCache = null; };
/**
 * The content AS SERVED to people: the owner's tracker (learnContent, byte for byte — D117 C9) with the verified real
 * links laid over its search links. Used where an item's link is shown or fetched (GET /api/learn, the course, the
 * thumbnails, Admin → Sources); everything that reads ids, steps or progress keeps learnContent.
 */
export function servedLearnContent(src) { return withRealLinks(learnContent(src)); }

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

// services/learn/learnImport.js — ⭐ D118 P2 · CONTENT CHANGES WITHOUT A DEPLOY.
//
// Owner 10-31: "when we add to base files of the atlas, that should reflect in production rather than having to rebuild
// it". The database is the source of the Learn content (learn_content, migration 198); files are an import route:
//   · Admin → Atlas → Import content: the owner picks the tracker HTML (extracted IN HIS BROWSER by the same extractor,
//     shared/learnTracker.js) or the extracted JSON; the JSON comes here, is VALIDATED against the schema below, and a
//     DIFF by id (added / changed / removed parts' phases, steps, items, patterns, concepts) is shown — nothing is
//     written until Apply (applyLearnImport), which re-validates and refuses a preview made against an older version.
//   · ⛔ THE SERVER NEVER EVALUATES AN UPLOAD. It receives JSON (parsed by express.json, which runs no code) and copies
//     only the fields the schema names, as strings / numbers / arrays — an unknown field is refused, so no key
//     (`__proto__` included) is ever assigned that the schema does not know. No vm, no eval, no Function, no HTML here
//     (d118ServerNeverEvaluatesUpload).
//   · Progress (learn_progress, keyed on item ids and "<step>#c<n>") is never touched by an import: a mark on an id
//     that survives keeps working, a mark on a removed id is KEPT (it counts again if the id comes back) and the
//     preview says how many there are (d118ImportKeepsProgress).
//   · The Atlas follows: the owner's definitions fill empty ones / new concepts and patterns are added (the D115 boot
//     imports, run on the new content), and a definition that is still exactly the owner's OLD words takes his new ones
//     — a definition a person typed or accepted is never overwritten.
//   · content/learn/*.json is the FIRST-INSTALL seed: seedLearnContentIfEmpty writes it only while learn_content has
//     no row at all — never over newer database content (d118BootImportOnlyWhenEmpty).
import fs from "node:fs";
import path from "node:path";
import { countsOf } from "../../shared/learnTracker.js";
import { checkpointId } from "../../shared/learnStepState.js";
import { searchKey } from "../../shared/atlasSearchNormalize.js";
import { slugOf } from "../atlas/atlasStore.js";
import { importLearnConcepts, publishLearnConcepts } from "../atlas/atlasLearnImport.js";
import { importLearnPatterns } from "./learnLinks.js";
import { learnContent, learnContentVersion, LEARN_DIR, LEARN_ID } from "./learnContent.js";

// ── the schema ───────────────────────────────────────────────────────────────────────────────
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SLUG = /^[a-z0-9-]{1,120}$/;
const LONG = 4000, SHORT = 400;
export const LEARN_LIMITS = Object.freeze({ parts: 50, phases: 200, steps: 1000, items: 5000, checkpoints: 40, patterns: 500,
  concepts: 5000, where: 30, practice: 60, errors: 50 });

class Refusals {
  constructor() { this.list = []; }
  add(at, reason) { if (this.list.length < LEARN_LIMITS.errors) this.list.push({ at, reason }); }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Copy ONLY the named fields of `obj`, in its own order. Each spec: [kind, required]; kind is "text" | "short" | "id" |
 * a function (value, at) → value | undefined (it records its own refusal).
 */
function pick(obj, spec, at, r) {
  if (!isObj(obj)) { r.add(at, "must be an object"); return null; }
  const out = {};
  for (const k of Object.keys(obj)) if (!Object.prototype.hasOwnProperty.call(spec, k)) r.add(`${at}.${k}`, "is not a field of the tracker's schema");
  for (const [k, [kind, required]] of Object.entries(spec)) {
    const has = Object.prototype.hasOwnProperty.call(obj, k);
    if (!has || obj[k] === undefined) { if (required) r.add(`${at}.${k}`, "is required"); continue; }
  }
  for (const k of Object.keys(obj)) {
    if (!Object.prototype.hasOwnProperty.call(spec, k)) continue;
    const [kind, required] = spec[k];
    const v = obj[k];
    if (typeof kind === "function") { const x = kind(v, `${at}.${k}`); if (x !== undefined) out[k] = x; continue; }
    if (typeof v !== "string") { r.add(`${at}.${k}`, "must be text"); continue; }
    if (kind === "id" && !ID.test(v)) { r.add(`${at}.${k}`, "must be an id of letters, digits, - or _ (≤ 64)"); continue; }
    if (v.length > (kind === "short" || kind === "id" ? SHORT : LONG)) { r.add(`${at}.${k}`, "is too long"); continue; }
    if (required && !v.trim()) { r.add(`${at}.${k}`, "is empty"); continue; }
    out[k] = v;
  }
  return out;
}

const arrayOf = (r, max, each) => (v, at) => {
  if (!Array.isArray(v)) { r.add(at, "must be a list"); return undefined; }
  if (v.length > max) { r.add(at, `has more than ${max} entries`); return undefined; }
  return v.map((x, i) => each(x, `${at}[${i}]`)).filter(x => x !== undefined && x !== null);
};
const textIn = (r, max = LONG) => (v, at) => {
  if (typeof v !== "string") { r.add(at, "must be text"); return undefined; }
  if (v.length > max) { r.add(at, "is too long"); return undefined; }
  return v;
};
/** A link only — https or http, or none ("" for an item the owner builds himself). Never javascript:, data:, … */
const link = (r) => (v, at) => {
  if (typeof v !== "string") { r.add(at, "must be text"); return undefined; }
  if (v === "") return v;
  let u = null;
  try { u = new URL(v); } catch { /* refused below */ }
  if (!u || !["https:", "http:"].includes(u.protocol) || v.length > 2000) { r.add(at, "must be an https or http link (links only)"); return undefined; }
  return v;
};

/**
 * Validate an uploaded Learn document against the tracker's schema.
 * @returns {{ ok: true, content } | { ok: false, errors: { at, reason }[] }} content = the fields the schema names only
 */
export function validateLearnContent(input) {
  const r = new Refusals();
  if (!isObj(input)) return { ok: false, errors: [{ at: "file", reason: "must be the extracted JSON object { PARTS, ATLAS, INDEX }" }] };
  const top = pick(input, {
    source: [(v, at) => {
      if (!isObj(v)) { r.add(at, "must be an object"); return undefined; }
      return { file: typeof v.file === "string" ? v.file.slice(0, SHORT) : null, extracted: typeof v.extracted === "string" ? v.extracted.slice(0, 40) : null };
    }, false],
    copy: [(v, at) => pick(v, {
      title: ["text", false], lede: ["text", false], legend: ["text", false], linksNote: ["text", false],
      intros: [(x, at2) => pick(x, { path: ["text", false], patterns: ["text", false], concepts: ["text", false] }, at2, r), false],
    }, at, r), false],
    PARTS: [arrayOf(r, LEARN_LIMITS.parts, (p, at) => pick(p, {
      t: ["short", true],
      phases: [arrayOf(r, LEARN_LIMITS.phases, (ph, at2) => pick(ph, {
        id: ["id", true], t: ["short", true],
        steps: [arrayOf(r, LEARN_LIMITS.steps, (s, at3) => pick(s, {
          id: ["id", true], t: ["short", true], g: ["text", false],
          lv: [(v, at4) => (v === "a" || v === "b" ? v : (r.add(at4, 'must be "a" (advanced) or "b" (basics)'), undefined)), false],
          c: [arrayOf(r, LEARN_LIMITS.checkpoints, textIn(r)), false],
          items: [arrayOf(r, LEARN_LIMITS.items, (it, at4) => pick(it, {
            id: ["id", true], k: ["short", true], t: ["short", true], s: ["short", false], u: [link(r), false], n: ["text", false],
            o: [(v, at5) => (v === 0 || v === 1 ? v : v === true ? 1 : v === false ? 0 : (r.add(at5, "must be 0 or 1 (optional)"), undefined)), false],
            a: ["short", false],
          }, at4, r)), true],
        }, at3, r)), true],
      }, at2, r)), true],
    }, at, r)), true],
    ATLAS: [arrayOf(r, LEARN_LIMITS.patterns, (a, at) => pick(a, {
      id: ["id", true], n: ["short", true], line: ["text", false], st: ["id", false], idea: ["text", false], why: ["text", false],
      where: [arrayOf(r, LEARN_LIMITS.where, textIn(r, SHORT)), false], spot: ["text", false],
      pr: [arrayOf(r, LEARN_LIMITS.practice, (pair, at2) => {
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || !pair[0].trim() || pair[0].length > SHORT || typeof pair[1] !== "string" || !SLUG.test(pair[1])) {
          r.add(at2, "must be [title, leetcode-slug]"); return undefined;
        }
        return [pair[0], pair[1]];
      }), false],
    }, at, r)), true],
    INDEX: [arrayOf(r, LEARN_LIMITS.concepts, (c, at) => pick(c, { term: ["short", true], def: ["text", true], st: ["id", false] }, at, r)), true],
  }, "file", r);
  if (r.list.length) return { ok: false, errors: r.list };

  // ── across the document: ids unique (one namespace — a mark is keyed on an item id or a step id), references real ──
  const seen = new Set(), steps = new Set();
  let nSteps = 0, nItems = 0;
  top.PARTS.forEach((p, pi) => p.phases.forEach((ph, phi) => {
    const at = `PARTS[${pi}].phases[${phi}]`;
    if (seen.has(ph.id)) r.add(at, `the id "${ph.id}" is used twice`); seen.add(ph.id);
    ph.steps.forEach((s, si) => {
      nSteps++;
      if (seen.has(s.id)) r.add(`${at}.steps[${si}]`, `the id "${s.id}" is used twice`); seen.add(s.id); steps.add(s.id);
      s.items.forEach((it, ii) => { nItems++; if (seen.has(it.id)) r.add(`${at}.steps[${si}].items[${ii}]`, `the id "${it.id}" is used twice`); seen.add(it.id); });
    });
  }));
  if (nSteps > LEARN_LIMITS.steps || nItems > LEARN_LIMITS.items) r.add("PARTS", "has too many steps or items");
  if (!top.PARTS.length || !nSteps) r.add("PARTS", "has no steps");
  const pids = new Set();
  top.ATLAS.forEach((a, i) => {
    if (pids.has(a.id)) r.add(`ATLAS[${i}]`, `the pattern id "${a.id}" is used twice`); pids.add(a.id);
    if (a.st && !steps.has(a.st)) r.add(`ATLAS[${i}].st`, `points at a step that does not exist ("${a.st}")`);
  });
  const terms = new Set();
  top.INDEX.forEach((c, i) => {
    const k = c.term.trim().toLowerCase();
    if (terms.has(k)) r.add(`INDEX[${i}]`, `the term "${c.term}" is defined twice`); terms.add(k);
    if (c.st && !steps.has(c.st)) r.add(`INDEX[${i}].st`, `points at a step that does not exist ("${c.st}")`);
  });
  if (r.list.length) return { ok: false, errors: r.list };
  const { source, copy, PARTS, ATLAS, INDEX } = top;
  return { ok: true, content: { source: { file: source?.file ?? null, extracted: source?.extracted ?? null, counts: countsOf({ PARTS, ATLAS, INDEX }) },
    ...(copy ? { copy } : {}), PARTS, ATLAS, INDEX } };
}

// ── the diff, by id ──────────────────────────────────────────────────────────────────────────
function indexOf(content) {
  const phases = new Map(), steps = new Map(), items = new Map(), patterns = new Map(), concepts = new Map();
  (content.PARTS || []).forEach((p, pi) => (p.phases || []).forEach(ph => {
    phases.set(ph.id, JSON.stringify({ part: pi, t: ph.t, steps: (ph.steps || []).map(s => s.id) }));
    for (const s of ph.steps || []) {
      const { items: its, ...rest } = s;
      steps.set(s.id, JSON.stringify({ ...rest, phase: ph.id, items: (its || []).map(it => it.id) }));
      for (const it of its || []) items.set(it.id, JSON.stringify({ ...it, step: s.id }));
    }
  }));
  for (const a of content.ATLAS || []) patterns.set(a.id, JSON.stringify(a));
  for (const c of content.INDEX || []) concepts.set(c.term, JSON.stringify(c));
  return { phases, steps, items, patterns, concepts };
}

export const DIFF_KINDS = Object.freeze(["phases", "steps", "items", "patterns", "concepts"]);

/** @returns {{ phases, steps, items, patterns, concepts: { added, changed, removed }, parts: boolean, copy: boolean, same: boolean }} */
export function diffLearnContent(prev, next) {
  const a = indexOf(prev || {}), b = indexOf(next || {});
  const out = {};
  for (const k of DIFF_KINDS) {
    const added = [], changed = [], removed = [];
    for (const [id, v] of b[k]) { if (!a[k].has(id)) added.push(id); else if (a[k].get(id) !== v) changed.push(id); }
    for (const id of a[k].keys()) if (!b[k].has(id)) removed.push(id);
    out[k] = { added, changed, removed };
  }
  out.parts = JSON.stringify((prev?.PARTS || []).map(p => p.t)) !== JSON.stringify((next?.PARTS || []).map(p => p.t));
  out.copy = next?.copy !== undefined && JSON.stringify(prev?.copy ?? null) !== JSON.stringify(next.copy);
  out.same = !out.parts && !out.copy && DIFF_KINDS.every(k => !out[k].added.length && !out[k].changed.length && !out[k].removed.length);
  return out;
}

/** Every mark id a document knows (items done, checkpoints explained). */
function markIdsOf(content) {
  const ids = new Set();
  for (const p of content.PARTS || []) for (const ph of p.phases || []) for (const s of ph.steps || []) {
    for (const it of s.items || []) ids.add(it.id);
    (s.c || []).forEach((_, i) => ids.add(checkpointId(s.id, i)));
  }
  return ids;
}

/** What an import means for learners' marks — counted, never changed. */
function progressImpact(db, next) {
  const known = markIdsOf(next);
  let marks = 0, kept = 0, learners = 0;
  try {
    const rows = db.prepare(`SELECT mark_id, COUNT(*) AS n FROM learn_progress GROUP BY mark_id`).all();
    for (const r of rows) { marks += r.n; if (known.has(r.mark_id)) kept += r.n; }
    learners = db.prepare(`SELECT COUNT(DISTINCT user_id) FROM learn_progress`).pluck().get();
  } catch { /* no learn_progress table */ }
  return { marks, learners, stillPlaced: kept, onRemovedIds: marks - kept };
}

/** The upload as it would be stored: validated, with the current copy kept when the upload has none. */
function candidate(db, input) {
  const v = validateLearnContent(input);
  if (!v.ok) return v;
  const prev = learnContent(db);
  // Keep the document's key order (source, copy, PARTS, ATLAS, INDEX) — the same shape as the extractor's file.
  const { source, PARTS, ATLAS, INDEX } = v.content;
  const copy = v.content.copy ?? prev.copy;
  return { ok: true, prev, next: { source, ...(copy ? { copy } : {}), PARTS, ATLAS, INDEX } };
}

/**
 * The preview: validate and diff — NOTHING is written.
 * @returns {{ ok: true, base: number, diff, counts, progress } | { ok: false, errors }}
 */
export function previewLearnImport(db, input) {
  const c = candidate(db, input);
  if (!c.ok) return c;
  return { ok: true, base: learnContentVersion(db)?.version ?? 0, diff: diffLearnContent(c.prev, c.next), counts: c.next.source.counts,
    progress: progressImpact(db, c.next) };
}

/**
 * The Atlas follows the content (all idempotent; nothing a person wrote is overwritten):
 *  · a concept / pattern definition that is still EXACTLY the owner's old words, on a node the owner's words filled,
 *    takes the new words
 *  · the D115 imports run on the new content: empty definitions filled, new concepts added and published, patterns
 */
export function syncLearnAtlas(db, prev, next) {
  const out = { definitionsUpdated: 0 };
  const swap = db.prepare(`UPDATE atlas_nodes SET definition = ?, updated_at = unixepoch() WHERE id = ? AND definition_by = 'owner' AND definition = ?`);
  const bare = (t) => String(t).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const oldDef = new Map((prev.INDEX || []).map(c => [c.term, String(c.def ?? "").trim()]));
  const nodes = db.prepare(`SELECT id, slug, name, kind, definition FROM atlas_nodes WHERE definition_by = 'owner'`).all();
  for (const c of next.INDEX || []) {
    const was = oldDef.get(c.term), now = String(c.def ?? "").trim();
    if (!was || !now || was === now) continue;
    const keys = new Set([searchKey(c.term), searchKey(bare(c.term))].filter(Boolean));
    for (const n of nodes) if (n.definition === was && keys.has(searchKey(n.name))) out.definitionsUpdated += swap.run(now, n.id, was).changes;
  }
  const oldLine = new Map((prev.ATLAS || []).map(a => [a.id, { n: a.n, line: String(a.line ?? "").trim() }]));
  for (const a of next.ATLAS || []) {
    const was = oldLine.get(a.id), now = String(a.line ?? "").trim();
    if (!was || !was.line || !now || was.line === now || was.n !== a.n) continue;
    const n = nodes.find(x => x.kind === "pattern" && x.slug === slugOf(a.n));
    if (n) out.definitionsUpdated += swap.run(now, n.id, was.line).changes;
  }
  const concepts = importLearnConcepts(db, next);
  const published = publishLearnConcepts(db).published;
  const patterns = importLearnPatterns(db, next);
  return { ...out, filled: concepts.filled.length, conceptsAdded: concepts.created.length, published,
    patternsAdded: patterns.created.length, practiceLinks: patterns.resources, edges: patterns.edges, leftOut: concepts.skipped };
}

/**
 * Apply: re-validate, refuse a preview made against an older version (`base`), write the row (version + 1) and let
 * the Atlas follow — in one transaction. Progress is not touched.
 * @returns {{ ok: true, version, diff, progress, atlas } | { ok: false, errors } | { ok: false, stale: true, version }}
 */
export function applyLearnImport(db, input, { base, by = "admin", now = Math.floor(Date.now() / 1000) } = {}) {
  const c = candidate(db, input);
  if (!c.ok) return c;
  const current = learnContentVersion(db)?.version ?? 0;
  if (base != null && Number(base) !== current) return { ok: false, stale: true, version: current };
  const diff = diffLearnContent(c.prev, c.next);
  let atlas = null;
  db.transaction(() => {
    db.prepare(`INSERT INTO learn_content (id, data, version, imported_at, imported_by) VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, version = learn_content.version + 1,
        imported_at = excluded.imported_at, imported_by = excluded.imported_by`)
      .run(LEARN_ID, JSON.stringify(c.next), now, String(by).slice(0, 120));
    atlas = syncLearnAtlas(db, c.prev, c.next);
  })();
  return { ok: true, version: learnContentVersion(db).version, diff, progress: progressImpact(db, c.next), atlas };
}

/**
 * ⭐ (c) The boot import: content/learn/*.json goes in ONLY while learn_content is EMPTY (a first install). Once the
 * table has any row, the database is the source and the files are never read over it.
 * @returns {{ seeded: string[], skipped: { file, errors }[], kept: number }}  kept = rows already there (nothing done)
 */
export function seedLearnContentIfEmpty(db, { dir = LEARN_DIR, now = Math.floor(Date.now() / 1000) } = {}) {
  const rows = db.prepare(`SELECT COUNT(*) FROM learn_content`).pluck().get();
  if (rows > 0) return { seeded: [], skipped: [], kept: rows };
  const out = { seeded: [], skipped: [], kept: 0 };
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort() : [];
  const put = db.prepare(`INSERT OR IGNORE INTO learn_content (id, data, version, imported_at, imported_by) VALUES (?, ?, 1, ?, ?)`);
  db.transaction(() => {
    for (const f of files) {
      let v;
      try { v = validateLearnContent(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))); }
      catch (e) { v = { ok: false, errors: [{ at: "file", reason: e.message }] }; }
      if (!v.ok) { out.skipped.push({ file: f, errors: v.errors }); continue; }
      const { source, copy, PARTS, ATLAS, INDEX } = v.content;
      if (put.run(path.basename(f, ".json"), JSON.stringify({ source, ...(copy ? { copy } : {}), PARTS, ATLAS, INDEX }), now, `seed:content/learn/${f}`).changes) out.seeded.push(f);
    }
  })();
  return out;
}

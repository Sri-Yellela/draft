// services/learn/learnCircle.js — ⭐ D117 · LEARN AS A CIRCLE — the circle's own data, beside the owner's tracker.
//
// ⭐ C9 · THE DATA FILE (content/learn/d117-data.json, the chat assistant's, 10-31) goes in by ONE import, re-runnable
// and idempotent by id (importCircleData):
//   · needs_drafted  108 pieces → their "Before this" links → learn_needs, status 'drafted'. The owner's review in
//                    Admin → Learn → Before-this review (Accept · Edit · Reject per piece, Accept all) turns them
//                    'accepted' or 'rejected'; until then the circle and the routes USE them and mark them "draft" (the
//                    owner approved the design with them — his review only changes the label). A re-import never moves
//                    a status: INSERT OR IGNORE by (piece, need).
//   · ⛔ the import REFUSES A LOOP — the incoming links together with every link already live (drafted or accepted)
//   · teaches_derived  piece → the concept terms it teaches → learn_teaches; resolved to Atlas nodes ON READ through
//                    the one resolver (atlasLearnImport.learnTermResolver: the one normaliser, the one thesaurus), so the
//                    piece ↔ node link D116 M8 needs follows the Atlas; unresolved terms are reported
//   · p5_items       D115 P5's games / exercises / practice links → learn_extra_items, OPTIONAL, ids `<step>-p5-<n>`,
//                    'pending' until the dead-link checker (D105 P6's probeUrl) has seen them: a live one is appended to
//                    its piece, a dead one is HELD BACK and listed (checkExtraItems)
//   · ⛔ the owner's tracker text (learn_content) is never changed by this import
//
// WHY A BOOT SEED, AND NOT THE MIGRATION OR D118'S CONTENT IMPORT: learn_content is D118 P2's single validated tracker
// document, and its boot seed runs only on an empty table — that guarantee stays as it is. The circle's data is not
// tracker text, so it lives in its own tables (migration 202) and its import is idempotent by id: running it at every
// boot over an existing database only ADDS what is missing (a new piece's links, a new P5 link) and never touches a
// reviewed status — so the file "goes in" on the first boot after the deploy, with no step for the owner. The same
// import is reachable from Admin (POST /api/admin/learn/circle/import), as C9 asks for "when D118 P2 ships".
// ⛔ No model (D17).
import fs from "node:fs";
import path from "node:path";
import { learnContent, stepsOf, LEARN_DIR } from "./learnContent.js";
import { learnTermResolver } from "../atlas/atlasLearnImport.js";
import { atlasChangeCount } from "../atlas/atlasStore.js";
import { probeUrl } from "../atlas/atlasLinkCheck.js";
import { CIRCLE_FILE_NAME } from "./learnImport.js";
import { findCycle, opensOf } from "../../shared/learnCircle.js";

export const CIRCLE_FILE = path.join(LEARN_DIR, CIRCLE_FILE_NAME);
/** D115 P5's kinds: the two new ones and the tracker's own Practice. */
export const P5_KINDS = Object.freeze(["Game", "Exercise", "Practice"]);
export const NEED_STATUSES = Object.freeze(["drafted", "accepted", "rejected"]);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const SHORT = 400;

const httpsLink = (u) => { try { const x = new URL(u); return x.protocol === "https:" && u.length <= 2000; } catch { return false; } };

/** The extra items' id: `<step>-p5-<n>`, n counted per piece in the file's order, from 1. */
export const p5Id = (stepId, n) => `${stepId}-p5-${n}`;

/**
 * Validate the data file against the live tracker. @returns {{ ok: true, needs: Map, teaches: Map, p5: [] } | { ok: false, errors }}
 */
export function validateCircleData(input, learn) {
  const errors = [];
  const add = (at, reason) => { if (errors.length < 50) errors.push({ at, reason }); };
  if (!isObj(input)) return { ok: false, errors: [{ at: "file", reason: "must be the D117 data object { needs_drafted, teaches_derived, p5_items }" }] };
  for (const k of Object.keys(input)) if (!["source", "needs_drafted", "teaches_derived", "p5_items"].includes(k)) add(`file.${k}`, "is not a field of the D117 data file");
  const steps = stepsOf(learn);
  const known = new Set(steps.map(s => s.id));
  const itemIds = new Set(steps.flatMap(s => (s.items || []).map(it => it.id)));
  const needs = new Map(), teaches = new Map(), p5 = [];
  if (input.needs_drafted !== undefined) {
    if (!isObj(input.needs_drafted)) add("needs_drafted", "must be an object { piece: [pieces] }");
    else for (const [id, list] of Object.entries(input.needs_drafted)) {
      if (!known.has(id)) { add(`needs_drafted.${id}`, "is not a piece of the tracker"); continue; }
      if (!Array.isArray(list)) { add(`needs_drafted.${id}`, "must be a list"); continue; }
      const out = [];
      for (const n of list) {
        if (typeof n !== "string" || !known.has(n)) add(`needs_drafted.${id}`, `"${String(n).slice(0, 40)}" is not a piece of the tracker`);
        else if (n === id) add(`needs_drafted.${id}`, "a piece cannot build on itself");
        else if (!out.includes(n)) out.push(n);
      }
      needs.set(id, out);
    }
  }
  if (input.teaches_derived !== undefined) {
    if (!isObj(input.teaches_derived)) add("teaches_derived", "must be an object { piece: [terms] }");
    else for (const [id, list] of Object.entries(input.teaches_derived)) {
      if (!known.has(id)) { add(`teaches_derived.${id}`, "is not a piece of the tracker"); continue; }
      if (!Array.isArray(list) || list.some(t => typeof t !== "string" || !t.trim() || t.length > SHORT)) { add(`teaches_derived.${id}`, "must be a list of terms"); continue; }
      teaches.set(id, [...new Set(list.map(t => t.trim()))]);
    }
  }
  if (input.p5_items !== undefined) {
    if (!Array.isArray(input.p5_items)) add("p5_items", "must be a list");
    else {
      const perStep = new Map();
      input.p5_items.forEach((it, i) => {
        const at = `p5_items[${i}]`;
        if (!isObj(it)) return add(at, "must be an object");
        for (const k of Object.keys(it)) if (!["step", "k", "t", "s", "u", "o"].includes(k)) add(`${at}.${k}`, "is not a field of a P5 item");
        if (!known.has(it.step)) return add(`${at}.step`, "is not a piece of the tracker");
        if (!P5_KINDS.includes(it.k)) return add(`${at}.k`, `must be one of ${P5_KINDS.join(", ")}`);
        if (typeof it.t !== "string" || !it.t.trim() || it.t.length > SHORT) return add(`${at}.t`, "must be a title");
        if (it.s !== undefined && (typeof it.s !== "string" || it.s.length > SHORT)) return add(`${at}.s`, "must be short text");
        if (typeof it.u !== "string" || !httpsLink(it.u)) return add(`${at}.u`, "must be an https link (links only)");
        if (it.o !== 1 && it.o !== true) return add(`${at}.o`, "must be 1 — every P5 item is optional (it never blocks finishing)");
        const n = (perStep.get(it.step) || 0) + 1;
        perStep.set(it.step, n);
        const id = p5Id(it.step, n);
        if (!ID.test(id) || itemIds.has(id)) return add(at, `its id "${id}" is already a tracker item`);
        p5.push({ id, step: it.step, k: it.k, t: it.t.trim(), s: it.s ? it.s.trim() : null, u: it.u, position: n });
      });
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, needs, teaches, p5 };
}

/** Every live "Before this" link (drafted or accepted — a rejected link is not a link): Map(piece → [{ id, status }]). */
export function needsOf(db) {
  const out = new Map();
  let rows = [];
  try { rows = db.prepare(`SELECT step_id, need_id, status FROM learn_needs WHERE status != 'rejected' ORDER BY step_id, position, need_id`).all(); }
  catch { return out; }
  for (const r of rows) {
    if (!out.has(r.step_id)) out.set(r.step_id, []);
    out.get(r.step_id).push({ id: r.need_id, status: r.status });
  }
  return out;
}
/** The same, as plain ids — what the graph functions take. */
export const needIdsOf = (db) => new Map([...needsOf(db)].map(([k, v]) => [k, v.map(n => n.id)]));

/**
 * ⭐ C9's import. Idempotent by id: needs and teaches are INSERT OR IGNORE (a status the owner set is never moved), a
 * P5 item already there keeps its checked status. Refuses a loop (nothing is written).
 * @returns {{ ok: true, needs: { added, kept }, teaches: { added, unresolved: [{ step, term }] }, p5: { added, pending } }
 *          | { ok: false, errors } | { ok: false, loop: string[] }}
 */
export function importCircleData(db, input, { learn = learnContent(db), now = Math.floor(Date.now() / 1000) } = {}) {
  const v = validateCircleData(input, learn);
  if (!v.ok) return v;
  // The loop check: what is live now, with what this file adds (a link the owner REJECTED stays out).
  const rejected = new Set(db.prepare(`SELECT step_id || ' ' || need_id FROM learn_needs WHERE status = 'rejected'`).pluck().all());
  const graph = needIdsOf(db);
  for (const [id, list] of v.needs) {
    const cur = graph.get(id) || [];
    graph.set(id, [...cur, ...list.filter(n => !cur.includes(n) && !rejected.has(`${id} ${n}`))]);
  }
  const loop = findCycle(graph);
  if (loop) return { ok: false, loop, errors: [{ at: "needs_drafted", reason: `the links make a loop: ${loop.join(" → ")}` }] };

  const out = { ok: true, needs: { added: 0, kept: 0 }, teaches: { added: 0, unresolved: [] }, p5: { added: 0, pending: 0 } };
  const putNeed = db.prepare(`INSERT OR IGNORE INTO learn_needs (step_id, need_id, status, source, position, updated_at) VALUES (?, ?, 'drafted', 'import', ?, ?)`);
  const putTerm = db.prepare(`INSERT OR IGNORE INTO learn_teaches (step_id, term, position) VALUES (?, ?, ?)`);
  const putItem = db.prepare(`INSERT OR IGNORE INTO learn_extra_items (id, step_id, k, t, s, u, o, position, status, imported_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'pending', ?)`);
  db.transaction(() => {
    for (const [id, list] of v.needs) list.forEach((n, i) => { if (putNeed.run(id, n, i, now).changes) out.needs.added++; else out.needs.kept++; });
    for (const [id, list] of v.teaches) list.forEach((t, i) => { out.teaches.added += putTerm.run(id, t, i).changes; });
    for (const it of v.p5) out.p5.added += putItem.run(it.id, it.step, it.k, it.t, it.s, it.u, it.position, now).changes;
  })();
  out.teaches.unresolved = unresolvedTerms(db);
  out.p5.pending = db.prepare(`SELECT COUNT(*) FROM learn_extra_items WHERE status = 'pending'`).pluck().get();
  return out;
}

/**
 * The boot step: content/learn/d117-data.json through the same import (idempotent — a second boot adds nothing).
 * @returns the import's result, or { ok: true, missing: true } when there is no file
 */
export function seedCircleData(db, { file = CIRCLE_FILE, learn } = {}) {
  if (!fs.existsSync(file)) return { ok: true, missing: true };
  let input;
  try { input = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { ok: false, errors: [{ at: "file", reason: e.message }] }; }
  return importCircleData(db, input, learn ? { learn } : {});
}

// ── teaches: the piece ↔ node links (D116 M8) ───────────────────────────────────────────────────

let teachCache = { db: null, key: null, byStep: null, byNode: null, unresolved: null };
function teachIndex(db) {
  let key;
  try { key = `${atlasChangeCount(db)}:${db.prepare(`SELECT COUNT(*) || ':' || COALESCE(SUM(LENGTH(term)), 0) FROM learn_teaches`).pluck().get()}:${db.prepare(`SELECT COUNT(*) FROM atlas_nodes`).pluck().get()}`; }
  catch { return { byStep: new Map(), byNode: new Map(), unresolved: [] }; }
  if (teachCache.db === db && teachCache.key === key) return teachCache;
  const resolve = learnTermResolver(db);
  const byStep = new Map(), byNode = new Map(), unresolved = [];
  for (const r of db.prepare(`SELECT step_id, term FROM learn_teaches ORDER BY step_id, position, term`).all()) {
    const n = resolve(r.term);
    if (!byStep.has(r.step_id)) byStep.set(r.step_id, []);
    if (!n) { unresolved.push({ step: r.step_id, term: r.term }); byStep.get(r.step_id).push({ term: r.term, slug: null, name: null, published: false }); continue; }
    byStep.get(r.step_id).push({ term: r.term, id: n.id, slug: n.slug, name: n.name, published: n.status === "published" });
    if (!byNode.has(n.id)) byNode.set(n.id, []);
    if (!byNode.get(n.id).includes(r.step_id)) byNode.get(n.id).push(r.step_id);
  }
  teachCache = { db, key, byStep, byNode, unresolved };
  return teachCache;
}
/** Map(piece → [{ term, id, slug, name, published }]) — a term no node answers keeps slug null. */
export const teachesByStep = (db) => teachIndex(db).byStep;
/** The pieces that teach a node (by its id), from the stored terms. */
export const stepsTeachingNodeId = (db, nodeId) => teachIndex(db).byNode.get(nodeId) || [];
/** The terms no Atlas node answers — reported on import and in Admin → Learn. */
export const unresolvedTerms = (db) => teachIndex(db).unresolved;

// ── D115 P5's items, through the dead-link checker first ───────────────────────────────────────

/** The live extra items: Map(piece → [item]) — shaped as the tracker's items (k, t, s, u, o: 1, p5: true). */
export function extraItemsByStep(db) {
  const out = new Map();
  let rows = [];
  try { rows = db.prepare(`SELECT id, step_id, k, t, s, u FROM learn_extra_items WHERE status = 'live' ORDER BY step_id, position, id`).all(); }
  catch { return out; }
  for (const r of rows) {
    if (!out.has(r.step_id)) out.set(r.step_id, []);
    out.get(r.step_id).push({ id: r.id, k: r.k, t: r.t, ...(r.s ? { s: r.s } : {}), u: r.u, o: 1, p5: true });
  }
  return out;
}

/**
 * Check the P5 links: every 'pending' one (and the 'held' ones again — a site that was down comes back), one at a
 * time, politely (D105 P6's probe). ok → 'live'; a failure → 'held' (listed, never shown). The fetcher is injectable.
 * @returns {{ checked, live, held: [{ id, url, status }] }}
 */
export async function checkExtraItems(db, { fetchImpl = globalThis.fetch, now = () => Math.floor(Date.now() / 1000), pauseMs = 750,
  pause = (ms) => new Promise(r => setTimeout(r, ms)), include = ["pending", "held"] } = {}) {
  const rows = db.prepare(`SELECT id, u, status FROM learn_extra_items WHERE status IN (${include.map(() => "?").join(",")}) ORDER BY id`).all(...include);
  const save = db.prepare(`UPDATE learn_extra_items SET status = ?, checked_at = ?, check_note = ? WHERE id = ?`);
  const out = { checked: 0, live: 0, held: [] };
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && pauseMs > 0) await pause(pauseMs);
    const r = rows[i];
    const p = await probeUrl(r.u, { fetchImpl });
    out.checked++;
    if (p.ok) { save.run("live", now(), null, r.id); out.live++; }
    else { const note = p.status ? `answered ${p.status}` : `no answer (${p.error || "error"})`; save.run("held", now(), note, r.id); out.held.push({ id: r.id, url: r.u, status: note }); }
  }
  return out;
}

// ── the circle, as GET /api/learn/circle serves it ─────────────────────────────────────────────

/** The routes (C5) as data: [{ id, name, targets: '*' | [piece ids] }], in their order. */
export function routesOf(db) {
  let rows = [];
  try { rows = db.prepare(`SELECT id, name, targets FROM learn_routes ORDER BY position, id`).all(); } catch { return []; }
  return rows.map(r => {
    let targets = "*";
    if (r.targets !== "*") { try { targets = JSON.parse(r.targets); } catch { targets = []; } }
    return { id: r.id, name: r.name, targets };
  });
}

/**
 * The circle's overlay on the tracker: per piece its needs (with status), opens (computed), teaches (resolved) and live
 * extra items. The tracker's own words come from GET /api/learn; this never repeats or changes them.
 */
export function circleOf(db, learn = learnContent(db)) {
  const order = stepsOf(learn).map(s => s.id);
  const needs = needsOf(db), teaches = teachesByStep(db), extras = extraItemsByStep(db);
  const opens = opensOf(new Map([...needs].map(([k, v]) => [k, v.map(n => n.id)])), order);
  const pieces = {};
  for (const id of order) {
    pieces[id] = {
      needs: (needs.get(id) || []).filter(n => order.includes(n.id)),
      opens: opens.get(id) || [],
      teaches: (teaches.get(id) || []).map(t => ({ term: t.term, slug: t.published ? t.slug : null, name: t.name || t.term })),
      extras: extras.get(id) || [],
    };
  }
  const counts = { drafted: 0, accepted: 0 };
  for (const list of needs.values()) for (const n of list) counts[n.status]++;
  return { pieces, routes: routesOf(db), counts };
}

// services/learn/learnQuestions.js — ⭐ D150 T01 · THE QUESTION BANK (owner 11-03: "use the quiz part as part of our own
// learning model"). ONE reviewed bank, ONE reader: the audit (T05), Check, Play, Learn's pieces (T14), Defend and the
// company guides (T12) all read questions() — never a second copy of an item.
//
//   · An ITEM: id · role · level · type (scenario | recall | explain) · skills[] (Atlas slugs) · pieces[] (Learn step ids)
//     · role_families[] · stem · choices[] · correct · why[] (⛔ one for EVERY choice — the wrong ones teach too) · source
//     · status (draft | live | retired).
//   · ⛔ NOTHING IS LIVE UNREVIEWED. An import writes NEW items as drafts whatever the file says; only Admin → Data →
//     Question bank's Approve (reviewQuestion) makes one live. A re-import of the same content touches nothing — never its
//     status, never its answers. Changed content of a LIVE item goes back to draft (a changed answer key is a new item to
//     review — reported as `requeued`); a retired item stays retired. A reviewer's edit is never undone by re-importing the
//     same file (content_hash is the file's content at its last import, not the row's).
//   · THE IMPORT is D118 P2's shape: validate everything (an unknown field is refused, not dropped), diff by id, then apply.
//   · ANSWERS: learn_question_answers, one row per answer (the choice, the time); the stats and the review desk's flags
//     are computed from them, never stored twice.
// ⛔ D17: no model. Content files: content/learn/audit-questions-*.json (the chat assistant's drafts for the owner).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { LEARN_DIR, learnContent, stepsOf } from "./learnContent.js";

export const QUESTION_TYPES = Object.freeze(["scenario", "recall", "explain"]);
export const QUESTION_STATUSES = Object.freeze(["draft", "live", "retired"]);
export const QUESTION_LEVELS = Object.freeze(["entry", "early", "mid", "senior", "staff"]);
export const QUESTION_FILE_PATTERN = /^audit-questions-v\d+\.json$/;
const ITEM_FIELDS = new Set(["id", "role", "level", "type", "skills", "pieces", "role_families", "stem", "choices", "correct", "why", "source", "status"]);
const FILE_FIELDS = new Set(["version", "note", "items"]);
/** T02's flags: after this many answers a correct share above / below these is suspicious; a median under MIN_MEDIAN_MS too. */
export const FLAG_RULES = Object.freeze({ MIN_ANSWERS: 30, TOO_EASY: 0.95, TOO_HARD: 0.15, MIN_MEDIAN_MS: 2000 });

const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const strings = (v) => Array.isArray(v) && v.every(s => typeof s === "string" && s.trim());

/** Every problem with one item, in words — [] when it is importable. */
export function itemProblems(item) {
  const out = [];
  if (!item || typeof item !== "object" || Array.isArray(item)) return ["not an object"];
  for (const k of Object.keys(item)) if (!ITEM_FIELDS.has(k)) out.push(`unknown field "${k}"`);
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id)) out.push("id: lowercase letters, digits and dashes");
  if (!QUESTION_TYPES.includes(item.type)) out.push(`type: one of ${QUESTION_TYPES.join(" | ")}`);
  if (item.level != null && !QUESTION_LEVELS.includes(item.level)) out.push(`level: one of ${QUESTION_LEVELS.join(" | ")}`);
  if (item.role != null && (typeof item.role !== "string" || !item.role.trim())) out.push("role: a name");
  if (typeof item.stem !== "string" || item.stem.trim().length < 10) out.push("stem: the question, in words");
  if (!strings(item.choices) || item.choices.length < 2 || item.choices.length > 6) out.push("choices: 2 to 6, each in words");
  const n = Array.isArray(item.choices) ? item.choices.length : 0;
  if (!Number.isInteger(item.correct) || item.correct < 0 || item.correct >= n) out.push("correct: the index of one choice");
  if (!strings(item.why) || item.why.length !== n) out.push("why: one explanation for EVERY choice");
  for (const k of ["skills", "pieces", "role_families"]) if (item[k] != null && !(Array.isArray(item[k]) && item[k].every(s => typeof s === "string"))) out.push(`${k}: a list of ids`);
  if (item.status != null && !QUESTION_STATUSES.includes(item.status)) out.push(`status: one of ${QUESTION_STATUSES.join(" | ")}`);
  return out;
}

const contentOf = (it) => ({
  role: it.role ?? null, level: it.level ?? null, type: it.type, skills: it.skills || [], pieces: it.pieces || [],
  role_families: it.role_families || [], stem: it.stem, choices: it.choices, correct: it.correct, why: it.why, source: it.source ?? null,
});
const hashOf = (it) => crypto.createHash("sha1").update(JSON.stringify(contentOf(it))).digest("hex").slice(0, 16);

/** A row → the item every consumer reads. */
function itemOf(r) {
  return {
    id: r.id, role: r.role, level: r.level, type: r.type,
    skills: JSON.parse(r.skills_json), pieces: JSON.parse(r.pieces_json), role_families: JSON.parse(r.families_json),
    stem: r.stem, choices: JSON.parse(r.choices_json), correct: r.correct, why: JSON.parse(r.why_json),
    source: r.source, status: r.status, version: r.version, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at,
  };
}

/**
 * ⭐ THE ONE READER. Live items only — there is no option that returns a draft (Admin's desk reads reviewList).
 * @param {{ role?, level?, type?, skills?: string[], ids?: string[], limit? }} q
 */
export function questions(db, { role = null, level = null, type = null, skills = null, ids = null, limit = null } = {}) {
  const where = ["status = 'live'"], args = [];
  if (role) { where.push("role = ?"); args.push(role); }
  if (level) { where.push("level = ?"); args.push(level); }
  if (type) { where.push("type = ?"); args.push(type); }
  if (ids?.length) { where.push(`id IN (${ids.map(() => "?").join(",")})`); args.push(...ids); }
  let rows = db.prepare(`SELECT * FROM learn_questions WHERE ${where.join(" AND ")} ORDER BY id`).all(...args).map(itemOf);
  if (skills?.length) { const want = new Set(skills); rows = rows.filter(q => q.skills.some(s => want.has(s))); }
  return limit ? rows.slice(0, limit) : rows;
}

/** A question as a person sees it before answering — no correct choice, no explanations. */
export const servedQuestion = (q) => ({ id: q.id, role: q.role, level: q.level, type: q.type, skills: q.skills, stem: q.stem, choices: q.choices });

/**
 * Validate a file, diff it against the bank by id, and (apply) write it. Nothing is written if any item is refused.
 * @returns {{ added: string[], changed: string[], requeued: string[], unchanged: string[], refused: {id, problems}[], applied: boolean }}
 */
export function importQuestions(db, file, { apply = false, from = "import", now = Math.floor(Date.now() / 1000) } = {}) {
  const out = { added: [], changed: [], requeued: [], unchanged: [], refused: [], applied: false };
  if (!file || typeof file !== "object" || !Array.isArray(file.items)) throw bad(400, "bad_file", "A question file is { version, note, items: [...] }.");
  const extra = Object.keys(file).filter(k => !FILE_FIELDS.has(k));
  if (extra.length) throw bad(400, "bad_file", `Unknown top-level field(s): ${extra.join(", ")}.`);
  const seen = new Set();
  for (const it of file.items) {
    const problems = itemProblems(it);
    if (it?.id && seen.has(it.id)) problems.push("id appears twice in the file");
    if (it?.id) seen.add(it.id);
    if (problems.length) out.refused.push({ id: it?.id ?? null, problems });
  }
  if (out.refused.length) return out;
  const get = db.prepare(`SELECT id, status, content_hash FROM learn_questions WHERE id = ?`);
  const plan = file.items.map(it => {
    const cur = get.get(it.id), h = hashOf(it);
    const kind = !cur ? "added" : cur.content_hash === h ? "unchanged" : cur.status === "live" ? "requeued" : "changed";
    out[kind].push(it.id);
    return { it, h, kind };
  });
  if (!apply) return out;
  const ins = db.prepare(`INSERT INTO learn_questions (id, role, level, type, skills_json, pieces_json, families_json, stem, choices_json,
    correct, why_json, source, status, content_hash, imported_from, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'draft', ?,?,?,?)`);
  const upd = db.prepare(`UPDATE learn_questions SET role = ?, level = ?, type = ?, skills_json = ?, pieces_json = ?, families_json = ?,
    stem = ?, choices_json = ?, correct = ?, why_json = ?, source = ?, content_hash = ?, imported_from = ?, updated_at = ?, version = version + 1,
    status = CASE WHEN status = 'live' THEN 'draft' ELSE status END WHERE id = ?`);
  db.transaction(() => {
    for (const { it, h, kind } of plan) {
      if (kind === "unchanged") continue;
      const c = contentOf(it);
      const vals = [c.role, c.level, c.type, JSON.stringify(c.skills), JSON.stringify(c.pieces), JSON.stringify(c.role_families),
        c.stem, JSON.stringify(c.choices), c.correct, JSON.stringify(c.why), c.source];
      if (kind === "added") ins.run(it.id, ...vals, h, from, now, now);
      else upd.run(...vals, h, from, now, it.id);
    }
  })();
  out.applied = true;
  return out;
}

/** The boot import: every content/learn/audit-questions-vN.json, as drafts; idempotent. */
export function importQuestionFiles(db, { dir = LEARN_DIR, now } = {}) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => QUESTION_FILE_PATTERN.test(f)).sort() : [];
  return files.map(f => {
    try { return { file: f, ...importQuestions(db, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), { apply: true, from: `content/learn/${f}`, now }) }; }
    catch (e) { return { file: f, error: e.message }; }
  });
}

/** The pieces the bank cites that are not Learn steps (T03: "report any that don't exist"). */
export function unknownPieces(db) {
  let steps;
  try { steps = new Set(stepsOf(learnContent(db)).map(s => s.id)); } catch { return null; }
  const out = new Map();   // piece → [question ids]
  for (const r of db.prepare(`SELECT id, pieces_json FROM learn_questions WHERE status != 'retired'`).all()) {
    for (const p of JSON.parse(r.pieces_json)) if (!steps.has(p)) out.set(p, [...(out.get(p) || []), r.id]);
  }
  return [...out].map(([piece, ids]) => ({ piece, questions: ids })).sort((a, b) => a.piece.localeCompare(b.piece));
}

/** One answer, judged here (the correct choice never leaves the server before the answer). */
export function recordAnswer(db, { questionId, userId = null, surface, chosen, ms = null, now = Math.floor(Date.now() / 1000) }) {
  const q = db.prepare(`SELECT correct, choices_json, status FROM learn_questions WHERE id = ?`).get(questionId);
  if (!q || q.status !== "live") throw bad(404, "no_question", "That question is not available.");
  const n = JSON.parse(q.choices_json).length;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= n) throw bad(400, "bad_choice", "Choose one of the answers.");
  if (typeof surface !== "string" || !surface) throw bad(400, "bad_surface", "Which surface asked it.");
  const correct = chosen === q.correct ? 1 : 0;
  db.prepare(`INSERT INTO learn_question_answers (question_id, user_id, surface, chosen, correct, ms, answered_at) VALUES (?,?,?,?,?,?,?)`)
    .run(questionId, userId, surface, chosen, correct, Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : null, now);
  return { correct: !!correct };
}

/** answered · correct share · median time · how many chose each choice. */
export function questionStats(db, id) {
  const q = db.prepare(`SELECT choices_json FROM learn_questions WHERE id = ?`).get(id);
  const n = q ? JSON.parse(q.choices_json).length : 0;
  const rows = db.prepare(`SELECT chosen, correct, ms FROM learn_question_answers WHERE question_id = ?`).all(id);
  const choices = Array.from({ length: n }, () => 0);
  for (const r of rows) if (r.chosen < n) choices[r.chosen]++;
  const times = rows.map(r => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
  const median = times.length ? (times.length % 2 ? times[times.length >> 1] : Math.round((times[times.length / 2 - 1] + times[times.length / 2]) / 2)) : null;
  return { answered: rows.length, correctShare: rows.length ? rows.filter(r => r.correct).length / rows.length : null, medianMs: median, choices };
}

/** T02's flags for one item's stats — each a code and its reason in words. */
export function flagsFor(stats) {
  const f = [];
  if (stats.answered >= FLAG_RULES.MIN_ANSWERS) {
    if (stats.correctShare > FLAG_RULES.TOO_EASY) f.push({ code: "too_easy", text: `${Math.round(stats.correctShare * 100)} % right — nearly everyone gets it` });
    if (stats.correctShare < FLAG_RULES.TOO_HARD) f.push({ code: "too_hard", text: `${Math.round(stats.correctShare * 100)} % right — check the answer key` });
    stats.choices.forEach((c, i) => { if (c === 0) f.push({ code: "dead_choice", text: `nobody picks choice ${String.fromCharCode(65 + i)}` }); });
    if (stats.medianMs != null && stats.medianMs < FLAG_RULES.MIN_MEDIAN_MS) f.push({ code: "too_fast", text: `answered in ${(stats.medianMs / 1000).toFixed(1)} s on the median` });
  }
  return f;
}

/** Admin → Learn → Questions: every item (any status) with its stats and flags, filtered. */
export function reviewList(db, { role = null, level = null, type = null, status = null, flagged = false } = {}) {
  const where = [], args = [];
  for (const [k, v] of [["role", role], ["level", level], ["type", type], ["status", status]]) if (v) { where.push(`${k} = ?`); args.push(v); }
  const rows = db.prepare(`SELECT * FROM learn_questions ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY role, level, id`).all(...args);
  const items = rows.map(r => { const q = itemOf(r); const stats = questionStats(db, q.id); return { ...q, stats, flags: flagsFor(stats) }; });
  return flagged ? items.filter(q => q.flags.length) : items;
}

/**
 * ⛔ THE ONLY WAY TO 'live' (t02ApproveOnlyHere): approve · retire · edit (an edit of a live item sends it back to draft).
 */
export function reviewQuestion(db, id, { action, reviewer, edits = null, now = Math.floor(Date.now() / 1000) }) {
  const r = db.prepare(`SELECT * FROM learn_questions WHERE id = ?`).get(id);
  if (!r) throw bad(404, "not_found", "No such question.");
  if (!reviewer) throw bad(400, "no_reviewer", "A review names its reviewer.");
  if (action === "approve") {
    db.prepare(`UPDATE learn_questions SET status = 'live', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).run(reviewer, now, now, id);
  } else if (action === "retire") {
    db.prepare(`UPDATE learn_questions SET status = 'retired', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).run(reviewer, now, now, id);
  } else if (action === "edit") {
    const next = { ...contentOf(itemOf(r)), id, type: r.type, ...(edits || {}) };
    delete next.status;
    const problems = itemProblems(next);
    if (problems.length) throw bad(400, "bad_item", problems.join("; "));
    const c = contentOf(next);
    db.prepare(`UPDATE learn_questions SET role = ?, level = ?, type = ?, skills_json = ?, pieces_json = ?, families_json = ?, stem = ?,
      choices_json = ?, correct = ?, why_json = ?, source = ?, version = version + 1, updated_at = ?,
      status = CASE WHEN status = 'live' THEN 'draft' ELSE status END WHERE id = ?`)
      .run(c.role, c.level, c.type, JSON.stringify(c.skills), JSON.stringify(c.pieces), JSON.stringify(c.role_families), c.stem,
        JSON.stringify(c.choices), c.correct, JSON.stringify(c.why), c.source, now, id);
    // ⛔ content_hash is the FILE's content at its last import — an edit leaves it, so the next boot's re-import of the same
    // file is a no-op and never undoes the reviewer's edit.
  } else throw bad(400, "bad_action", "approve, retire or edit.");
  return itemOf(db.prepare(`SELECT * FROM learn_questions WHERE id = ?`).get(id));
}

// services/learn/learnEarned.js — ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED (owner 10-31: "approved but make a progress
// bar the user may not mark themselves complete"). One bar per piece, filled only by what the user actually does:
//   (1) OPENED     an item opened FROM DRAFT — the link's click records piece, item and time (learn_opened); nothing is
//                  tracked on the other site. Shown as "opened", never "done": draft cannot know a video was watched.
//   (2) EXPLAINED  each checkpoint takes the user's answer IN THEIR OWN WORDS (learn_explanations): private, ≥ 25 words,
//                  a paste of ≥ 25 words refused ("Put it in your own words."), saved with the date, editable.
//                  ⛔ No model reads or grades it (D17) — the act of writing it is the evidence. Only its author reads it.
//   (3) BUILT      a piece with a required Build / Project item takes a link to what was built (learn_builds) — checked
//                  by D109's one evidence rule (services/proofLinks.js checkEvidence: https only, a real host).
//   (4) verified practice (a practice site's public count) — LATER, optional, per site: not built.
// THE BAR and FINISHED are shared/learnStepState.js's (one rule for the circle, Your map's Learn next and the tree's
// learned state, D116 M8). ⛔ Nothing here sets a piece or an item "done": there is no such write.
// D115's old ticks (learn_progress) stay stored as they were — never deleted, never counted (`ticked` says how many).
import { learnContent, stepsOf } from "./learnContent.js";
import { extraItemsByStep, teachesByStep } from "./learnCircle.js";
import { stepState, checkpointId, buildId, buildRequired, wordCount, EXPLAIN_MIN_WORDS, OWN_WORDS } from "../../shared/learnStepState.js";
import { checkEvidence } from "../proofLinks.js";

export { wordCount, EXPLAIN_MIN_WORDS, OWN_WORDS };   // the one rule, shared with the page (shared/learnStepState.js)
export const EXPLAIN_MAX_CHARS = 6000;
export const PASTE_MAX_WORDS = EXPLAIN_MIN_WORDS - 1;   // a paste of 25 words or more is refused
export const BUILD_KINDS_ACCEPTED = Object.freeze(["repository", "demo"]);

/** Every piece with its live P5 items appended (the tracker's own items untouched). */
export function piecesOf(db, learn = learnContent(db)) {
  const extras = extraItemsByStep(db);
  return stepsOf(learn).map(s => (extras.has(s.id) ? { ...s, items: [...(s.items || []), ...extras.get(s.id)] } : s));
}

/** What a learner can open from draft: item id → its piece (tracker items with a link, live P5 items). */
function openable(pieces) {
  const m = new Map();
  for (const s of pieces) for (const it of s.items || []) if (it.u) m.set(it.id, s.id);
  return m;
}

/**
 * The user's earned marks, in the shape the one rule reads: { [itemId | "<step>#c<n>" | "<step>#build"]: at }.
 * ⛔ learn_progress (the old ticks) is never read here.
 */
/**
 * ⭐ D172 (3) · WHEN each idea was first explained — the checkpoint and the time, NEVER the words (points from proof,
 * services/atlas/points.js). learn_explanations stays read in this one file (d117ExplanationsPrivate).
 */
export function explanationTimes(db, userId) {
  try { return db.prepare(`SELECT checkpoint_id AS ref, created_at AS at FROM learn_explanations WHERE user_id = ?`).all(userId); }
  catch { return []; }
}

export function earnedMarks(db, userId) {
  const marks = {};
  if (userId == null) return marks;
  try {
    for (const r of db.prepare(`SELECT item_id AS id, at FROM learn_opened WHERE user_id = ?`).all(userId)) marks[r.id] = r.at;
    for (const r of db.prepare(`SELECT checkpoint_id AS id, updated_at AS at FROM learn_explanations WHERE user_id = ?`).all(userId)) marks[r.id] = r.at;
    for (const r of db.prepare(`SELECT step_id, updated_at AS at FROM learn_builds WHERE user_id = ?`).all(userId)) marks[buildId(r.step_id)] = r.at;
  } catch { /* before 202 */ }
  return marks;
}

/** The learner's own record, for their own eyes only (GET /api/learn/earned). */
export function readEarned(db, userId) {
  const explanations = {}, builds = {};
  for (const r of db.prepare(`SELECT checkpoint_id, body, words, created_at, updated_at FROM learn_explanations WHERE user_id = ?`).all(userId)) {
    explanations[r.checkpoint_id] = { text: r.body, words: r.words, at: r.created_at, updated: r.updated_at };
  }
  for (const r of db.prepare(`SELECT step_id, url, kind, created_at, updated_at FROM learn_builds WHERE user_id = ?`).all(userId)) {
    builds[r.step_id] = { url: r.url, kind: r.kind, at: r.created_at, updated: r.updated_at };
  }
  let ticked = 0;
  try { ticked = db.prepare(`SELECT COUNT(*) FROM learn_progress WHERE user_id = ?`).pluck().get(userId); } catch { /* none */ }
  return { marks: earnedMarks(db, userId), explanations, builds, ticked };
}

/** A piece's nodes on Your map (D116 M8): the published Atlas nodes its terms resolve to. */
export function unlocksOf(db, stepId) {
  const seen = new Set(), out = [];
  for (const t of teachesByStep(db).get(stepId) || []) {
    if (!t.slug || !t.published || seen.has(t.slug)) continue;
    seen.add(t.slug); out.push({ slug: t.slug, name: t.name });
  }
  return out;
}

/** After a write: the piece's state, and — when THIS write finished it — the nodes it unlocked on Your map. */
function after(db, userId, piece, was) {
  const now = stepState(piece, earnedMarks(db, userId));
  const finishedNow = now.complete && !was.complete;
  return { ok: true, piece: piece.id, state: now, finished: finishedNow, unlocked: finishedNow ? unlocksOf(db, piece.id) : [] };
}
const fail = (status, error, message) => ({ ok: false, status, error, message });

/**
 * (1) The user opened an item FROM DRAFT (the link's click). The first opening's time is kept.
 * @returns {{ ok, piece, state, finished, unlocked } | { ok: false, status, error }}
 */
export function recordOpened(db, userId, itemId, { now = Math.floor(Date.now() / 1000), learn } = {}) {
  const pieces = piecesOf(db, learn);
  const stepId = openable(pieces).get(String(itemId));
  if (!stepId) return fail(404, "unknown_item", "No such item with a link.");
  const piece = pieces.find(s => s.id === stepId);
  const was = stepState(piece, earnedMarks(db, userId));
  db.prepare(`INSERT OR IGNORE INTO learn_opened (user_id, item_id, step_id, at) VALUES (?, ?, ?, ?)`).run(userId, String(itemId), stepId, now);
  return after(db, userId, piece, was);
}

/**
 * (2) A checkpoint explained, in the user's own words. `pastedWords` = the most words pasted into the box at once in this
 * edit (the page counts it; the page also refuses such a paste before it lands).
 */
export function saveExplanation(db, userId, checkpoint, text, { pastedWords = 0, now = Math.floor(Date.now() / 1000), learn } = {}) {
  const pieces = piecesOf(db, learn);
  const m = /^(.+)#c(\d+)$/.exec(String(checkpoint ?? ""));
  const piece = m && pieces.find(s => s.id === m[1]);
  if (!piece || !(piece.c || [])[Number(m[2])] || checkpointId(piece.id, Number(m[2])) !== checkpoint) return fail(404, "unknown_checkpoint", "No such checkpoint.");
  const body = String(text ?? "").trim();
  if (body.length > EXPLAIN_MAX_CHARS) return fail(400, "too_long", `Keep it under ${EXPLAIN_MAX_CHARS} characters.`);
  if (Number(pastedWords) > PASTE_MAX_WORDS) return fail(400, "not_own_words", OWN_WORDS);
  const words = wordCount(body);
  if (words < EXPLAIN_MIN_WORDS) return fail(400, "too_few_words", `Explain it in at least ${EXPLAIN_MIN_WORDS} words — you have ${words}.`);
  const was = stepState(piece, earnedMarks(db, userId));
  db.prepare(`INSERT INTO learn_explanations (user_id, checkpoint_id, step_id, body, words, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, checkpoint_id) DO UPDATE SET body = excluded.body, words = excluded.words, updated_at = excluded.updated_at`)
    .run(userId, checkpoint, piece.id, body, words, now, now);
  return { ...after(db, userId, piece, was), words };
}

/** (3) The link to what was built — only on a piece with a required Build / Project item; D109's evidence rule. */
export function saveBuild(db, userId, stepId, { url, kind = "repository" } = {}, { now = Math.floor(Date.now() / 1000), learn } = {}) {
  const piece = piecesOf(db, learn).find(s => s.id === String(stepId));
  if (!piece) return fail(404, "unknown_piece", "No such piece.");
  if (!buildRequired(piece)) return fail(400, "no_build_here", "This piece asks for nothing to be built.");
  if (!BUILD_KINDS_ACCEPTED.includes(kind)) return fail(400, "bad_kind", "A repository or a live demo.");
  let ev;
  try { ev = checkEvidence({ kind, url }); } catch (e) { return fail(400, "bad_link", e.message.replace(/^Evidence 1: /, "")); }
  const was = stepState(piece, earnedMarks(db, userId));
  db.prepare(`INSERT INTO learn_builds (user_id, step_id, url, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, step_id) DO UPDATE SET url = excluded.url, kind = excluded.kind, updated_at = excluded.updated_at`)
    .run(userId, piece.id, ev.url, ev.kind, now, now);
  return after(db, userId, piece, was);
}

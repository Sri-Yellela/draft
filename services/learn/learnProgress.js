// services/learn/learnProgress.js — ⭐ D115 P3 · a learner's marks on the owner's tracker (learn_progress, migration 195).
//   an ITEM done       mark_id = the item's id           ("s1-code")
//   a CHECKPOINT explained  mark_id = "<step id>#c<place>"   ("s1#c0") — the tracker's checkpoints carry no id of their
//                       own, so their place in the step is theirs; the extractor's re-run prints any id that moved
// Only marks the content knows are accepted (an unknown id is refused, so a stale browser cannot store junk).
import { learnContent, stepsOf } from "./learnContent.js";
import { checkpointId } from "../../shared/learnStepState.js";
export { checkpointId };   // the one rule (shared/learnStepState.js)

export const MARK_STATES = Object.freeze(["done", "explained"]);

let known = null;
/** Every mark id the content has → the state it takes ("done" for an item, "explained" for a checkpoint). */
export function knownMarks(learn = learnContent()) {
  if (known && known.learn === learn) return known.map;
  const map = new Map();
  for (const s of stepsOf(learn)) {
    for (const it of s.items || []) map.set(it.id, "done");
    (s.c || []).forEach((_, i) => map.set(checkpointId(s.id, i), "explained"));
  }
  known = { learn, map };
  return map;
}

export function readProgress(db, userId) {
  return db.prepare(`SELECT mark_id AS id, state, at FROM learn_progress WHERE user_id = ? ORDER BY at, mark_id`).all(userId);
}

/** Set or clear one mark. @returns {boolean} false for an id the content does not know */
export function setMark(db, userId, id, on, { now = Math.floor(Date.now() / 1000), learn } = {}) {
  const state = knownMarks(learn).get(String(id));
  if (!state) return false;
  if (on) db.prepare(`INSERT INTO learn_progress (user_id, mark_id, state, at) VALUES (?,?,?,?)
    ON CONFLICT(user_id, mark_id) DO UPDATE SET state = excluded.state, at = excluded.at`).run(userId, String(id), state, now);
  else db.prepare(`DELETE FROM learn_progress WHERE user_id = ? AND mark_id = ?`).run(userId, String(id));
  return true;
}

/**
 * The browser's marks, offered to the account on sign-in: added where the account has none; the account's own mark
 * (and its date) wins. Unknown ids are dropped. @returns {{ added: number, ignored: number }}
 */
export function importMarks(db, userId, marks, { learn } = {}) {
  const map = knownMarks(learn);
  const list = Array.isArray(marks) ? marks.slice(0, 2000) : [];
  const put = db.prepare(`INSERT OR IGNORE INTO learn_progress (user_id, mark_id, state, at) VALUES (?,?,?,?)`);
  let added = 0, ignored = 0;
  db.transaction(() => {
    for (const m of list) {
      const id = String(m?.id ?? ""), state = map.get(id);
      const at = Number.isFinite(Number(m?.at)) && Number(m.at) > 0 ? Math.floor(Number(m.at)) : Math.floor(Date.now() / 1000);
      if (!state) { ignored++; continue; }
      added += put.run(userId, id, state, at).changes;
    }
  })();
  return { added, ignored };
}

// services/learn/learnCircleReview.js — ⭐ D117 C9 · Admin → Learn → BEFORE-THIS REVIEW: the owner's review of the drafted
// "Before this" links, per piece — Accept · Edit · Reject, and Accept all after reading (the pattern of D105 P11's
// definitions). Until a link is accepted the circle and the routes use it marked "draft"; a rejected one is not used.
// An Edit makes the piece's list exactly what the owner wrote (each 'accepted', source 'owner'; the rest 'rejected'),
// and is refused when it would make a loop. Every change is a status — a re-import never undoes one.
import { learnContent, stepsOf } from "./learnContent.js";
import { needIdsOf, unresolvedTerms, routesOf } from "./learnCircle.js";
import { findCycle } from "../../shared/learnCircle.js";

/** The review list: every piece, in path order, with its links (all statuses) and their titles. */
export function reviewList(db, learn = learnContent(db)) {
  const steps = stepsOf(learn);
  const title = new Map(steps.map(s => [s.id, s.t]));
  const rows = db.prepare(`SELECT step_id, need_id, status, source, reviewed_by FROM learn_needs ORDER BY position, need_id`).all();
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.step_id)) by.set(r.step_id, []);
    by.get(r.step_id).push({ id: r.need_id, title: title.get(r.need_id) ?? r.need_id, status: r.status, source: r.source, by: r.reviewed_by });
  }
  const pieces = steps.map(s => ({ id: s.id, n: s.n, title: s.t, part: s.part, needs: by.get(s.id) || [] }));
  const counts = { drafted: 0, accepted: 0, rejected: 0 };
  for (const r of rows) counts[r.status]++;
  const extras = db.prepare(`SELECT id, step_id AS step, k, t, u, status, check_note AS note, checked_at AS checkedAt FROM learn_extra_items ORDER BY step_id, position`).all();
  return { pieces, counts, unresolved: unresolvedTerms(db), extras, routes: routesOf(db) };
}

const err = (status, error, message) => ({ ok: false, status, error, message });

/** Accept (drafted → accepted) or reject (drafted / accepted → rejected) a piece's links. */
export function reviewPiece(db, stepId, action, { by = "admin", now = Math.floor(Date.now() / 1000), learn = learnContent(db) } = {}) {
  if (!stepsOf(learn).some(s => s.id === stepId)) return err(404, "unknown_piece", "No such piece.");
  if (action === "accept") {
    const r = db.prepare(`UPDATE learn_needs SET status = 'accepted', reviewed_by = ?, updated_at = ? WHERE step_id = ? AND status = 'drafted'`).run(by, now, stepId);
    return { ok: true, changed: r.changes };
  }
  if (action === "reject") {
    const r = db.prepare(`UPDATE learn_needs SET status = 'rejected', reviewed_by = ?, updated_at = ? WHERE step_id = ? AND status != 'rejected'`).run(by, now, stepId);
    return { ok: true, changed: r.changes };
  }
  return err(400, "bad_action", "action is accept or reject.");
}

/** Edit: the piece's links become exactly `needs` (accepted, by the owner); the others rejected. Refuses a loop. */
export function editPiece(db, stepId, needs, { by = "admin", now = Math.floor(Date.now() / 1000), learn = learnContent(db) } = {}) {
  const known = new Set(stepsOf(learn).map(s => s.id));
  if (!known.has(stepId)) return err(404, "unknown_piece", "No such piece.");
  if (!Array.isArray(needs) || needs.length > 20 || needs.some(n => typeof n !== "string" || !known.has(n) || n === stepId)) {
    return err(400, "bad_needs", "needs is a list of other pieces' ids (at most 20).");
  }
  const list = [...new Set(needs)];
  const graph = needIdsOf(db);
  graph.set(stepId, list);
  const loop = findCycle(graph);
  if (loop) return { ...err(400, "loop", `That makes a loop: ${loop.join(" → ")}`), loop };
  db.transaction(() => {
    db.prepare(`UPDATE learn_needs SET status = 'rejected', reviewed_by = ?, updated_at = ? WHERE step_id = ? AND status != 'rejected'`).run(by, now, stepId);
    const put = db.prepare(`INSERT INTO learn_needs (step_id, need_id, status, source, position, reviewed_by, updated_at) VALUES (?, ?, 'accepted', 'owner', ?, ?, ?)
      ON CONFLICT(step_id, need_id) DO UPDATE SET status = 'accepted', position = excluded.position, reviewed_by = excluded.reviewed_by, updated_at = excluded.updated_at`);
    list.forEach((n, i) => put.run(stepId, n, i, by, now));
  })();
  return { ok: true, needs: list };
}

/** Accept all — every drafted link becomes accepted. */
export function acceptAll(db, { by = "admin", now = Math.floor(Date.now() / 1000) } = {}) {
  return { ok: true, changed: db.prepare(`UPDATE learn_needs SET status = 'accepted', reviewed_by = ?, updated_at = ? WHERE status = 'drafted'`).run(by, now).changes };
}

/** A route (C5) as data — the owner adds an audience without code. targets: '*' or piece ids. */
export function saveRoute(db, id, { name, targets }, { by = "admin", now = Math.floor(Date.now() / 1000), learn = learnContent(db) } = {}) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(id))) return err(400, "bad_id", "A route id is lower-case letters, digits and - (≤ 40).");
  const nm = String(name ?? "").trim();
  if (!nm || nm.length > 80) return err(400, "bad_name", "A route needs a name (≤ 80 characters).");
  const known = new Set(stepsOf(learn).map(s => s.id));
  if (targets !== "*" && (!Array.isArray(targets) || !targets.length || targets.length > 20 || targets.some(t => !known.has(t)))) {
    return err(400, "bad_targets", "targets is \"*\" (the whole circle) or 1–20 piece ids.");
  }
  const pos = db.prepare(`SELECT COALESCE(MAX(position), 0) + 1 FROM learn_routes`).pluck().get();
  db.prepare(`INSERT INTO learn_routes (id, name, targets, position, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, targets = excluded.targets, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .run(id, nm, targets === "*" ? "*" : JSON.stringify(targets), pos, by, now);
  return { ok: true };
}
export function deleteRoute(db, id) {
  return { ok: true, changed: db.prepare(`DELETE FROM learn_routes WHERE id = ?`).run(String(id)).changes };
}

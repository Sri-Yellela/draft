// services/network/feed.js — ⭐ D180 P3 (45r, owner 11-08: "build league and challenges, can merge them later, and the same
// for everything else") · THE FEED, behind the network switch (connections.js networkEnabled — OFF by default; the routes 404).
//
// The spec's rules, each enforced here (not in the client):
//   · FROM CONNECTIONS, CHRONOLOGICAL BY DEFAULT — newest first by id; no engagement ranking anywhere (d180FeedChronologicalDefault).
//   · NOTHING APPEARS UNLESS THE PERSON CHOSE IT — a post is something they wrote; a PROOF MOMENT is written only for a kind
//     they turned on in "What you share" (network_share_prefs, every kind OFF until turned on; migration 263's trigger
//     writes a check passed only when `checks` is on) (d180ProofMomentsOptIn).
//   · ONE REACTION (helpful) and comments, only by people who can see the post.
//   · BLOCK STOPS EVERYTHING — a block either way hides each other's posts and comments, and refuses a reaction or comment.
//   · REPORT on every post and comment (messages.js report — the same moderation queue); an admin can remove one.
//   · LIMITS — posts and comments per day; links must be http(s) and are never fetched (no previews: nothing reads them).
//   · NO AI READS ANY OF IT — nothing here calls a model.
//   · DELETE — an author removes their own post or comment; account deletion removes all of it (ON DELETE CASCADE).
import { isBlocked, isConnected } from "./connections.js";
import { jobPath } from "../jobs/publicJobPage.js";

export const POST_MAX = 2000, COMMENT_MAX = 1000, FEED_PAGE = 30;
export const POSTS_PER_DAY = 20, COMMENTS_PER_DAY = 100;
export const SHARE_KINDS = Object.freeze({ checks: "An Atlas check you passed", new_role: "A new role you started" });
const DAY = 86400;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const now0 = () => Math.floor(Date.now() / 1000);

const handleOf = (db, id) => db.prepare(`SELECT handle FROM proof_pages WHERE user_id = ?`).pluck().get(id) || null;
const nameOf = (db, id) => db.prepare(`SELECT name FROM people_index WHERE user_id = ?`).pluck().get(id) || handleOf(db, id) || "A draft member";
const author = (db, id) => ({ handle: handleOf(db, id), name: nameOf(db, id) });

/** Can `me` see `authorId`'s posts? Their own, or a connection's — never across a block. */
export function canSee(db, me, authorId) {
  if (me === authorId) return true;
  return !isBlocked(db, me, authorId) && isConnected(db, me, authorId);
}

function jobCard(db, jobId) {
  if (jobId == null) return null;
  const r = db.prepare(`SELECT id, title, company, location FROM scraped_jobs WHERE id = ? AND is_active = 1`).get(Number(jobId));
  return r ? { id: r.id, title: r.title, company: r.company, location: r.location || null, path: jobPath(r) } : null;
}
const cleanLink = (u) => {
  if (u == null || String(u).trim() === "") return null;
  const s = String(u).trim();
  if (!/^https?:\/\/[^\s]+$/i.test(s) || s.length > 500) throw bad(400, "bad_link", "A link starts with http:// or https://.");
  return s;
};
function postFor(db, me, id) {
  const p = db.prepare(`SELECT * FROM network_posts WHERE id = ? AND removed_at IS NULL`).get(Number(id));
  if (!p || !canSee(db, me, p.author_id)) throw bad(404, "no_such_post", "There is no such post.");
  return p;
}

function shape(db, me, p) {
  const helpful = db.prepare(`SELECT COUNT(*) FROM network_post_helpful WHERE post_id = ?`).pluck().get(p.id);
  const mine = !!db.prepare(`SELECT 1 FROM network_post_helpful WHERE post_id = ? AND user_id = ?`).get(p.id, me);
  const comments = db.prepare(`SELECT author_id FROM network_comments WHERE post_id = ? AND removed_at IS NULL`).pluck().all(p.id)
    .filter(a => a === me || !isBlocked(db, me, a)).length;
  return {
    id: p.id, kind: p.kind, at: p.created_at, by: author(db, p.author_id), yours: p.author_id === me,
    text: p.body || null, link: p.link_url || null, job: p.kind === "job" ? jobCard(db, p.job_id) : null,
    proof: p.kind === "proof" ? { kind: p.proof_kind, label: p.proof_label } : null,
    helpful, helpfulByMe: mine, comments,
  };
}

/** My feed: my posts and my connections', newest first (by id — chronological, never ranked). `before` pages back. */
export function myFeed(db, me, { before = null, limit = FEED_PAGE } = {}) {
  const ids = [me, ...db.prepare(`SELECT CASE WHEN low_id = ? THEN high_id ELSE low_id END FROM network_connections
      WHERE (low_id = ? OR high_id = ?) AND status = 'accepted'`).pluck().all(me, me, me)].filter(a => a === me || !isBlocked(db, me, a));
  const lim = Math.min(100, Math.max(1, Number(limit) || FEED_PAGE));
  const rows = db.prepare(`SELECT * FROM network_posts WHERE removed_at IS NULL AND author_id IN (${ids.map(() => "?").join(",")})
      ${before ? "AND id < ?" : ""} ORDER BY id DESC LIMIT ?`).all(...ids, ...(before ? [Number(before)] : []), lim + 1);
  const more = rows.length > lim;
  return { posts: rows.slice(0, lim).map(p => shape(db, me, p)), more, order: "newest" };
}

/** Write a post: text (≤ POST_MAX) with an optional link, or a job of the open board (with an optional note). */
export function createPost(db, me, { text = null, link = null, jobId = null } = {}, { now = now0() } = {}) {
  const body = text == null ? null : String(text).trim().slice(0, POST_MAX) || null;
  const url = cleanLink(link);
  const job = jobId != null ? jobCard(db, jobId) : null;
  if (jobId != null && !job) throw bad(404, "no_such_job", "That job isn't open any more.");
  if (!body && !url && !job) throw bad(400, "empty", "Write something, add a link or share a job.");
  const today = db.prepare(`SELECT COUNT(*) FROM network_posts WHERE author_id = ? AND kind != 'proof' AND created_at >= ?`).pluck().get(me, now - DAY);
  if (today >= POSTS_PER_DAY) throw bad(429, "daily_cap", `You can post ${POSTS_PER_DAY} times a day.`);
  const id = db.prepare(`INSERT INTO network_posts (author_id, kind, body, link_url, job_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(me, job ? "job" : "post", body, url, job ? job.id : null, now).lastInsertRowid;
  return shape(db, me, db.prepare(`SELECT * FROM network_posts WHERE id = ?`).get(id));
}

/** helpful on / off — only by someone who can see the post (never on your own: it would only count yourself). */
export function setHelpful(db, me, postId, on) {
  const p = postFor(db, me, postId);
  if (p.author_id === me) throw bad(400, "own_post", "That's your own post.");
  if (on) db.prepare(`INSERT OR IGNORE INTO network_post_helpful (post_id, user_id) VALUES (?, ?)`).run(p.id, me);
  else db.prepare(`DELETE FROM network_post_helpful WHERE post_id = ? AND user_id = ?`).run(p.id, me);
  return shape(db, me, p);
}

/** A post's comments, oldest first — a blocked person's are left out. */
export function listComments(db, me, postId) {
  const p = postFor(db, me, postId);
  return db.prepare(`SELECT * FROM network_comments WHERE post_id = ? AND removed_at IS NULL ORDER BY id`).all(p.id)
    .filter(c => c.author_id === me || !isBlocked(db, me, c.author_id))
    .map(c => ({ id: c.id, at: c.created_at, by: author(db, c.author_id), yours: c.author_id === me, text: c.body }));
}

export function addComment(db, me, postId, text, { now = now0() } = {}) {
  const p = postFor(db, me, postId);
  if (isBlocked(db, me, p.author_id)) throw bad(404, "no_such_post", "There is no such post.");
  const body = String(text ?? "").trim().slice(0, COMMENT_MAX);
  if (!body) throw bad(400, "empty", "Write a comment.");
  const today = db.prepare(`SELECT COUNT(*) FROM network_comments WHERE author_id = ? AND created_at >= ?`).pluck().get(me, now - DAY);
  if (today >= COMMENTS_PER_DAY) throw bad(429, "daily_cap", `You can comment ${COMMENTS_PER_DAY} times a day.`);
  db.prepare(`INSERT INTO network_comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)`).run(p.id, me, body, now);
  return listComments(db, me, p.id);
}

/** The author removes their own post or comment (gone for everyone). */
export function removeOwn(db, me, kind, id) {
  const table = kind === "post" ? "network_posts" : kind === "comment" ? "network_comments" : null;
  if (!table) throw bad(400, "bad_kind", "A post or a comment.");
  const r = db.prepare(`UPDATE ${table} SET removed_at = unixepoch() WHERE id = ? AND author_id = ? AND removed_at IS NULL`).run(Number(id), me);
  if (!r.changes) throw bad(404, `no_such_${kind}`, `There is no such ${kind}.`);
  return { removed: true };
}

/** What you share — every kind OFF until the person turns it on. */
export function sharePrefs(db, me) {
  const r = db.prepare(`SELECT checks, new_role FROM network_share_prefs WHERE user_id = ?`).get(me) || { checks: 0, new_role: 0 };
  return { kinds: Object.entries(SHARE_KINDS).map(([key, label]) => ({ key, label, on: !!r[key] })) };
}
export function setSharePref(db, me, key, on) {
  if (!(key in SHARE_KINDS)) throw bad(400, "bad_kind", `One of: ${Object.keys(SHARE_KINDS).join(", ")}.`);
  db.prepare(`INSERT INTO network_share_prefs (user_id, ${key}, updated_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET ${key} = excluded.${key}, updated_at = excluded.updated_at`).run(me, on ? 1 : 0);
  return sharePrefs(db, me);
}

/**
 * A proof moment of `kind` — written ONLY when the person turned that kind on. (An Atlas check passed is written by
 * migration 263's trigger on skill_proofs; a new role calls this from the profile's experience change.)
 */
export function recordProofMoment(db, userId, kind, label) {
  if (!(kind in SHARE_KINDS)) return null;
  const on = db.prepare(`SELECT ${kind} FROM network_share_prefs WHERE user_id = ?`).pluck().get(userId);
  if (!on) return null;
  const proofKind = kind === "checks" ? "check" : kind;
  return Number(db.prepare(`INSERT INTO network_posts (author_id, kind, proof_kind, proof_label) VALUES (?, 'proof', ?, ?)`)
    .run(userId, proofKind, String(label || "").slice(0, 200)).lastInsertRowid);
}

// ⭐ D180 (4) (45s): *started a new role* — the proof moment's hook. A save of the Experience section that ADDS a current role
// (a company + title marked current that was not current before) becomes one post, only when the person turned *new role*
// on (recordProofMoment checks). Editing a bullet, a date or an old job never posts.
const roleKey = (r) => `${String(r.company || "").trim().toLowerCase()}|${String(r.title || "").trim().toLowerCase()}`;
/** The person's current roles as rows { company, title } (the profile's own table). */
export function currentRoles(db, userId) {
  try { return db.prepare(`SELECT company, title FROM profile_experience WHERE user_id = ? AND is_current = 1 ORDER BY position, id`).all(userId); }
  catch { return []; }
}
/** PURE. The first current role in `after` that was not current in `before`, or null. */
export function newRoleOf(before = [], after = []) {
  const had = new Set(before.map(roleKey));
  return after.find(r => r.company && !had.has(roleKey(r))) || null;
}
/** After an Experience save: post *started as <title> at <company>* when a new current role appeared (and the switch is on). */
export function noteNewRole(db, userId, before) {
  const role = newRoleOf(before, currentRoles(db, userId));
  if (!role) return null;
  return recordProofMoment(db, userId, "new_role", role.title ? `started as ${role.title} at ${role.company}` : `started at ${role.company}`);
}

/** The reported post / comment for the moderation queue, and who wrote it (messages.js report / reportQueue). */
export function feedTarget(db, kind, id) {
  if (kind === "post") {
    const p = db.prepare(`SELECT * FROM network_posts WHERE id = ?`).get(Number(id));
    return p ? { authorId: p.author_id, removed: p.removed_at != null, text: p.body || p.proof_label || null, link: p.link_url || null } : null;
  }
  if (kind === "comment") {
    const c = db.prepare(`SELECT * FROM network_comments WHERE id = ?`).get(Number(id));
    return c ? { authorId: c.author_id, removed: c.removed_at != null, text: c.body } : null;
  }
  return null;
}

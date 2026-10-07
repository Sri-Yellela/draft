// services/learnedOrigins.js — ⭐ D67 (2) · THE SELF-LEARNING ORIGIN TABLE, shared across the platform.
//
// Owner, 10-07: "these are things that can be reused cross platform … a self-learning module which can be
// saved and shared across the platform." A posting lives on one host and its application form sometimes
// on another (Amazon: www.amazon.jobs → account.amazon.jobs). The code table (services/applyOrigins.js)
// names the pairs someone has observed; this learns the rest from the users who apply.
//
// HOW A PAIR IS LEARNED. A user who holds a packet for a job presses "I submitted" on a page whose host is
// NOT in that job's family — they have shown, with their own application, that this job's form lives
// there. The pair (posting host → apply host) is recorded for that user.
//   · Below N distinct users (N = 3) a pair is offered ONLY to the user(s) who saw it: their packets may
//     fill on that host, nobody else's.
//   · At N it is PROMOTED into every user's families.
//   · An admin can REVOKE a pair; a revoked pair is offered to no one, ever again, until un-revoked.
// ⛔ PRIVACY: only HOSTNAMES are stored — no path, no query, no URL. The SHARED row (apply_origin_pairs)
//    carries no user identity, only a count; the per-user observation (apply_origin_sightings) exists to
//    count DISTINCT users and to offer a pair to the one who saw it, and is deleted with the account.
// ⛔ SAFETY: https only; never an IP address, localhost or a bare TLD; never our own host; never a pair
//    whose two hosts are the same. Learning widens WHERE a packet may be released, so the bar is a
//    user's verified application, never a capture, a link or a page view.

export const PROMOTE_AT_USERS = 3;
const OWN_HOSTS = new Set(["jobsviadraft.com", "www.jobsviadraft.com"]);

// ⛔ A95 · HOSTS THAT SERVE EVERY EMPLOYER. A pair is a pair of HOSTNAMES, so a learned pair touching one of
// these would widen far beyond the job it was learned from: `a.wd5.myworkdayjobs.com → wd5.myworkdaysite.com`
// lets A's packets fill ANY employer's form on wd5 (docs/D67C_WORKDAY_FAMILY.md §5), and
// `jobs.lever.co → careers.x.com` lets EVERY Lever job's packet fill on X's domain. Refused on either side.
// On these hosts the code table's job-id / tenant rules decide, never a learned hostname.
//   · Workday's shared shards — wdN.myworkdaysite.com (the tenant is in the PATH) and a bare
//     wdN.myworkdayjobs.com. NOT <tenant>.wdN.myworkdayjobs.com: that host is one employer's.
//   · the shared origins already in services/applyOrigins.js (Lever, Ashby, Workable, Greenhouse).
const SHARED_TENANT_HOSTS = new Set([
  "jobs.lever.co", "jobs.ashbyhq.com", "apply.workable.com", "boards.greenhouse.io", "job-boards.greenhouse.io",
]);
const SHARED_TENANT_PATTERNS = [/^wd\d+\.myworkdaysite\.com$/, /^wd\d+\.myworkdayjobs\.com$/, /^(?:www\.)?myworkday(?:site|jobs)\.com$/];

/** Does this hostname serve many employers, so that a learned pair on it would cross employers? */
export function isSharedTenantHost(host) {
  const h = String(host || "").toLowerCase();
  return SHARED_TENANT_HOSTS.has(h) || SHARED_TENANT_PATTERNS.some(re => re.test(h));
}

/** A hostname fit to learn, or null. */
export function learnableHost(url) {
  let u; try { u = new URL(String(url)); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return null;
  if (OWN_HOSTS.has(h)) return null;
  return h;
}

/**
 * Record what the user's own application showed: this job's form is on `pageUrl`.
 * @returns {{ recorded: boolean, reason?: string, users?: number, promoted?: boolean }}
 */
export function recordSighting(db, { userId, postingUrl, pageUrl, now = Math.floor(Date.now() / 1000) }) {
  const postingHost = learnableHost(postingUrl);
  const applyHost = learnableHost(pageUrl);
  if (!postingHost || !applyHost) return { recorded: false, reason: "not_learnable" };
  if (postingHost === applyHost) return { recorded: false, reason: "same_host" };
  if (isSharedTenantHost(postingHost) || isSharedTenantHost(applyHost)) return { recorded: false, reason: "shared_host" };
  return db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO apply_origin_pairs (posting_host, apply_host, first_seen_at) VALUES (?, ?, ?)`)
      .run(postingHost, applyHost, now);
    const pair = db.prepare("SELECT id, revoked_at FROM apply_origin_pairs WHERE posting_host = ? AND apply_host = ?").get(postingHost, applyHost);
    db.prepare("INSERT OR IGNORE INTO apply_origin_sightings (pair_id, user_id, seen_at) VALUES (?, ?, ?)").run(pair.id, userId, now);
    const users = db.prepare("SELECT COUNT(*) AS n FROM apply_origin_sightings WHERE pair_id = ?").get(pair.id).n;
    db.prepare("UPDATE apply_origin_pairs SET users_seen = ? WHERE id = ?").run(users, pair.id);
    let promoted = false;
    if (users >= PROMOTE_AT_USERS && pair.revoked_at == null) {
      promoted = db.prepare("UPDATE apply_origin_pairs SET promoted_at = COALESCE(promoted_at, ?) WHERE id = ? AND promoted_at IS NULL")
        .run(now, pair.id).changes > 0;
    }
    return { recorded: true, users, promoted, revoked: pair.revoked_at != null };
  })();
}

/**
 * The learned families this user's packets may use: every PROMOTED pair, plus the pairs THIS user saw —
 * never a revoked one. Each is a two-origin family in services/applyOrigins.js's shape.
 */
export function learnedFamilies(db, userId) {
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT p.posting_host, p.apply_host FROM apply_origin_pairs p
       WHERE p.revoked_at IS NULL
         AND (p.promoted_at IS NOT NULL
              OR EXISTS (SELECT 1 FROM apply_origin_sightings s WHERE s.pair_id = p.id AND s.user_id = ?))
    `).all(userId);
  } catch { return []; }                                         // a database without the tables learns nothing
  // A95: a pair learned before the guard existed is never served either.
  return rows.filter(r => !isSharedTenantHost(r.posting_host) && !isSharedTenantHost(r.apply_host)).map(r => Object.freeze({
    ats: "learned",
    origins: Object.freeze([`https://${r.posting_host}`, `https://${r.apply_host}`]),
  }));
}

/** Admin: revoke (or restore) one learned pair. */
export function setPairRevoked(db, pairId, revoked, now = Math.floor(Date.now() / 1000)) {
  return db.prepare("UPDATE apply_origin_pairs SET revoked_at = ? WHERE id = ?").run(revoked ? now : null, pairId).changes > 0;
}

/**
 * Admin: promote (or un-promote) one pair by hand — D75's crawler OBSERVES pairs and never promotes them.
 * ⛔ A95: a shared multi-tenant host is refused here too, whoever asks.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function setPairPromoted(db, pairId, promoted, now = Math.floor(Date.now() / 1000)) {
  const pair = db.prepare("SELECT posting_host, apply_host, revoked_at FROM apply_origin_pairs WHERE id = ?").get(pairId);
  if (!pair) return { ok: false, reason: "pair_not_found" };
  if (promoted && (isSharedTenantHost(pair.posting_host) || isSharedTenantHost(pair.apply_host))) return { ok: false, reason: "shared_host" };
  if (promoted && pair.revoked_at != null) return { ok: false, reason: "revoked" };
  db.prepare("UPDATE apply_origin_pairs SET promoted_at = ? WHERE id = ?").run(promoted ? now : null, pairId);
  return { ok: true };
}

/** Admin: the table, newest first — hostnames and counts only. */
export function listPairs(db) {
  return db.prepare(`SELECT id, posting_host AS postingHost, apply_host AS applyHost, users_seen AS usersSeen,
      first_seen_at AS firstSeenAt, promoted_at AS promotedAt, revoked_at AS revokedAt,
      crawler_seen_at AS crawlerSeenAt
    FROM apply_origin_pairs ORDER BY first_seen_at DESC, id DESC`).all();
}

// services/userAdmin.js — ⭐ D88 P2 + P4 · user management: Admin → People → Users (the list) and one person's page,
// made of modules (account & status · plan & usage · feature access · activity).
//
// ⛔ What a module may show is an ALLOW-LIST: no eligibility or EEO answer (sponsorship, work authorisation,
// clearance, visa, gender, ethnicity, veteran, disability) and no address or phone — support needs none of them.
// ⛔ Every write here records an admin_audit_log row with a REASON (migration 155), and the person's timeline reads
// those rows back. An override is never deleted: clearing it stamps revoked_at, so the history stays.
// ⛔ An override cannot unlock a HARD feature (full auto, D36) or pass a ceiling — refused, not clamped, so the
// admin sees why. A suspended account cannot sign in or call the API; an admin or the system account cannot be
// suspended from here.
import { FEATURES } from "../shared/entitlements.js";
import { resolveEntitlement, liveOverride } from "./entitlementResolver.js";
import { draftSlots } from "./draftSlots.js";
import { toActor, auditActorColumns } from "./actor.js";

const now = () => Math.floor(Date.now() / 1000);
const isSystem = (u) => u?.id === 0 || u?.username === "system";

export class UserAdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/**
 * The audit row every admin write makes. Returns its id. ⛔ D95: `actorId` is an actor (services/actor.js) — an admin
 * account, a users row, or the system — and the row records its KIND and its coded name; admin_user_id keeps only a
 * users.id. A bare number from an older caller still means a users row.
 */
export function writeAudit(db, { actorId, actor, action, target, before = null, after = null, reason = null }) {
  const a = auditActorColumns(actor ?? actorId);
  return db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(a.admin_user_id, a.actor_kind, a.actor, action, target, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after),
      reason ? String(reason).slice(0, 500) : null).lastInsertRowid;
}

const needReason = (reason) => {
  const r = String(reason ?? "").trim();
  if (r.length < 3) throw new UserAdminError("Say why — a reason of a few words is required for every change to an account.");
  return r.slice(0, 500);
};

/** Validate a value against the feature's kind and ceiling. Returns the value to store. */
export function checkOverrideValue(featureKey, value) {
  const f = FEATURES[featureKey];
  if (!f) throw new UserAdminError(`There is no feature called ${featureKey}.`);
  if (f.hard) throw new UserAdminError(`${f.label} cannot be set per user — it is decided by the system (full auto stays locked, D36).`);
  if (f.kind === "boolean") {
    if (typeof value !== "boolean") throw new UserAdminError(`${f.label} takes on or off.`);
    return value;
  }
  if (f.kind === "integer" || f.kind === "limit") {
    if (f.kind === "limit" && value === null) return null;
    if (!Number.isInteger(value) || value < 0) throw new UserAdminError(`${f.label} takes a whole number of 0 or more.`);
    if (f.ceiling != null && value > f.ceiling) throw new UserAdminError(`${f.label} cannot go above ${f.ceiling} — the system's ceiling.`);
    return value;
  }
  throw new UserAdminError(`${f.label} cannot be set per user.`);
}

/** Set (or replace) a per-user override. An earlier live one is revoked in the same transaction. */
export function setOverride(db, { userId, featureKey, value, reason, expiresAt = null, actorId }) {
  const why = needReason(reason);
  const v = checkOverrideValue(featureKey, value);
  if (expiresAt != null && (!Number.isInteger(expiresAt) || expiresAt <= now())) throw new UserAdminError("The expiry must be in the future.");
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(userId);
  if (!user) throw new UserAdminError("No such user.", 404);
  return db.transaction(() => {
    const before = resolveEntitlement(db, userId, featureKey);
    const prior = liveOverride(db, userId, featureKey);
    if (prior) db.prepare("UPDATE user_entitlement_overrides SET revoked_at = unixepoch(), revoked_by = ?, revoked_by_actor = ? WHERE id = ?").run(toActor(actorId).userId, toActor(actorId).ref, prior.id);
    const id = db.prepare(`INSERT INTO user_entitlement_overrides (user_id, feature_key, value_json, reason, set_by, set_by_actor, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(userId, featureKey, JSON.stringify(v), why, toActor(actorId).userId, toActor(actorId).ref, expiresAt).lastInsertRowid;
    const after = resolveEntitlement(db, userId, featureKey);
    writeAudit(db, { actorId, action: "user.override.set", target: `user:${userId}`, reason: why,
      before: { feature: featureKey, value: before.value, source: before.source }, after: { feature: featureKey, value: after.value, source: after.source, expiresAt, overrideId: id } });
    return { id, effective: after };
  })();
}

/** Clear a live override — the feature falls back to the plan or the system. */
export function clearOverride(db, { userId, featureKey, reason, actorId }) {
  const why = needReason(reason);
  return db.transaction(() => {
    const prior = liveOverride(db, userId, featureKey);
    if (!prior) throw new UserAdminError("There is no override to clear.", 404);
    const before = resolveEntitlement(db, userId, featureKey);
    db.prepare("UPDATE user_entitlement_overrides SET revoked_at = unixepoch(), revoked_by = ?, revoked_by_actor = ? WHERE id = ?").run(toActor(actorId).userId, toActor(actorId).ref, prior.id);
    const after = resolveEntitlement(db, userId, featureKey);
    writeAudit(db, { actorId, action: "user.override.clear", target: `user:${userId}`, reason: why,
      before: { feature: featureKey, value: before.value, source: before.source, overrideId: prior.id }, after: { feature: featureKey, value: after.value, source: after.source } });
    return { effective: after };
  })();
}

// ⛔ Owner 11-07 · WHO GETS WHAT ACCESS: "in the admin panel design an override to decide which user gets what level of
// access to site. the reviewer from yc should be able to visit current state of site" — three levels, one per account:
//   full      everything, no plan limits (users.full_access = 1 — services/entitlementResolver.js hasFullAccess)
//   standard  the plan's limits (full_access cleared)
//   none      refused on every request and signed out everywhere (users.status = 'suspended' — the existing gate)
// Built on the two fields that already decide it, so there is one source of truth for each; one audit row a change.
export const ACCESS_LEVELS = Object.freeze(["full", "standard", "none"]);
export const ACCESS_WORDS = Object.freeze({ full: "Full", standard: "Standard", none: "No access" });

export function accessLevelOf(row) {
  if ((row?.status || "active") === "suspended") return "none";
  return row?.full_access === 1 ? "full" : "standard";
}

/** Sets an account's access level, with a reason and an audit row. */
export function setAccessLevel(db, { userId, level, reason, actorId }) {
  const why = needReason(reason);
  if (!ACCESS_LEVELS.includes(level)) throw new UserAdminError(`The access level is one of ${ACCESS_LEVELS.join(", ")}.`);
  const u = db.prepare("SELECT id, username, is_admin, COALESCE(status, 'active') AS status, full_access FROM users WHERE id = ?").get(userId);
  if (!u) throw new UserAdminError("No such user.", 404);
  if (isSystem(u)) throw new UserAdminError("The system account's access cannot be changed.");
  if (u.is_admin && level === "none") throw new UserAdminError("An admin account cannot be refused here — remove its admin role first.");
  if (u.id === toActor(actorId).userId && level === "none") throw new UserAdminError("You cannot refuse your own account.");
  const before = accessLevelOf(u);
  if (before === level) throw new UserAdminError(`The account already has ${ACCESS_WORDS[level]} access.`);
  const a = toActor(actorId);
  db.transaction(() => {
    if (level === "none") {
      db.prepare("UPDATE users SET status = 'suspended', suspended_reason = ?, suspended_at = ? WHERE id = ?").run(why, now(), userId);
    } else {
      db.prepare("UPDATE users SET status = 'active', suspended_reason = NULL, suspended_at = NULL, full_access = ?, full_access_at = ?, full_access_by = ? WHERE id = ?")
        .run(level === "full" ? 1 : null, now(), a.ref, userId);
    }
    writeAudit(db, { actorId, action: "user.access.set", target: `user:${userId}`, reason: why, before: { access: before }, after: { access: level } });
  })();
  return { access: level, signOut: level === "none" };
}

/** Suspend or restore an account. */
export function setStatus(db, { userId, status, reason, actorId }) {
  const why = needReason(reason);
  if (!["active", "suspended"].includes(status)) throw new UserAdminError("The status is active or suspended.");
  const u = db.prepare("SELECT id, username, is_admin, status FROM users WHERE id = ?").get(userId);
  if (!u) throw new UserAdminError("No such user.", 404);
  if (isSystem(u)) throw new UserAdminError("The system account cannot be suspended.");
  if (u.is_admin && status === "suspended") throw new UserAdminError("An admin account cannot be suspended here — remove its admin role first.");
  if (u.id === toActor(actorId).userId) throw new UserAdminError("You cannot suspend your own account.");
  if ((u.status || "active") === status) throw new UserAdminError(`The account is already ${status}.`);
  db.transaction(() => {
    db.prepare("UPDATE users SET status = ?, suspended_reason = ?, suspended_at = ? WHERE id = ?")
      .run(status, status === "suspended" ? why : null, status === "suspended" ? now() : null, userId);
    writeAudit(db, { actorId, action: status === "suspended" ? "user.suspend" : "user.unsuspend", target: `user:${userId}`, reason: why,
      before: { status: u.status || "active" }, after: { status } });
  })();
  return { status };
}

export function addNote(db, { userId, body, actorId }) {
  const text = String(body ?? "").trim();
  if (!text) throw new UserAdminError("The note is empty.");
  if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId)) throw new UserAdminError("No such user.", 404);
  const id = db.prepare("INSERT INTO user_notes (user_id, body, author_id, author_actor) VALUES (?, ?, ?, ?)").run(userId, text.slice(0, 4000), toActor(actorId).userId, toActor(actorId).ref).lastInsertRowid;
  writeAudit(db, { actorId, action: "user.note", target: `user:${userId}`, after: { noteId: id } });
  return { id };
}

// ⭐ D86/D88 follow-up item 3: an admin marks an account internal, test or beta. Shown by default; the list's
// "Hide internal and test" filter hides the first two and says how many it hid. Every change asks why.
export const USER_TAGS = Object.freeze({ internal: "internal", test: "test", beta: "beta" });
export const HIDDEN_TAGS = Object.freeze(["internal", "test"]);

export function setTag(db, { userId, tag, on, reason, actorId }) {
  const why = needReason(reason);
  if (!USER_TAGS[tag]) throw new UserAdminError(`The tag is one of ${Object.keys(USER_TAGS).join(", ")}.`);
  if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND id != 0 AND COALESCE(is_admin, 0) = 0").get(userId)) throw new UserAdminError("No such user.", 404);
  const has = !!db.prepare("SELECT 1 FROM user_tags WHERE user_id = ? AND tag = ?").get(userId, tag);
  if (has === !!on) throw new UserAdminError(on ? `The account is already tagged ${tag}.` : `The account is not tagged ${tag}.`);
  db.transaction(() => {
    if (on) db.prepare("INSERT INTO user_tags (user_id, tag, set_by_actor) VALUES (?, ?, ?)").run(userId, tag, toActor(actorId).ref);
    else db.prepare("DELETE FROM user_tags WHERE user_id = ? AND tag = ?").run(userId, tag);
    writeAudit(db, { actorId, action: on ? "user.tag.add" : "user.tag.remove", target: `user:${userId}`, reason: why, before: { tag, on: has }, after: { tag, on: !!on } });
  })();
  return { tag, on: !!on };
}

const tagsOf = (db, userId) => { try { return db.prepare("SELECT tag FROM user_tags WHERE user_id = ? ORDER BY tag").pluck().all(userId); } catch { return []; } };
const HIDDEN_SQL = `EXISTS (SELECT 1 FROM user_tags t WHERE t.user_id = u.id AND t.tag IN (${HIDDEN_TAGS.map(t => `'${t}'`).join(", ")}))`;

/** Is this account suspended? Read on every authenticated request (requireAuth) and at sign-in. */
export function isSuspended(db, userId) {
  try { return db.prepare("SELECT status FROM users WHERE id = ?").get(userId)?.status === "suspended"; }
  catch { return false; }
}

// ── reads ─────────────────────────────────────────────────────────────────────────────────────────────

const LAST_ACTIVE_SQL = `MAX(COALESCE((SELECT MAX(last_seen_at) FROM user_sessions s WHERE s.user_id = u.id), 0),
                            COALESCE((SELECT MAX(last_seen_at) FROM auth_contexts a WHERE a.user_id = u.id), 0))`;

// ⛔ D95: People → Users lists USER accounts only. No admin is listed, counted, opened, exported, merged or deleted here —
// the legacy is_admin row is excluded until the switch clears it, and admin accounts were never in `users` at all.
export const PEOPLE_FILTERS = Object.freeze(["all", "active", "suspended", "override", "inactive30", "new7"]);
export const USERS_ONLY_SQL = "u.id != 0 AND u.username != 'system' AND COALESCE(u.is_admin, 0) = 0";
export const PEOPLE_SORTS = Object.freeze({ recent: "last_active DESC", newest: "u.created_at DESC", name: "LOWER(u.username) ASC" });

/** Admin → People → Users: the numbers on top, and one page of the list. */
export function listPeople(db, { q = "", filter = "all", sort = "recent", page = 1, pageSize = 25, hideTagged = false } = {}) {
  const where = [USERS_ONLY_SQL];
  const args = [];
  const term = String(q || "").trim().toLowerCase();
  if (term) {
    where.push("(LOWER(u.username) LIKE ? OR LOWER(COALESCE(p.email, '')) LIKE ? OR LOWER(COALESCE(p.full_name, p.first_name || ' ' || p.last_name, '')) LIKE ? OR CAST(u.id AS TEXT) = ?)");
    args.push(`%${term}%`, `%${term}%`, `%${term}%`, term);
  }
  const f = PEOPLE_FILTERS.includes(filter) ? filter : "all";
  if (f === "active") where.push("COALESCE(u.status, 'active') = 'active'");
  if (f === "suspended") where.push("u.status = 'suspended'");
  if (f === "override") where.push("EXISTS (SELECT 1 FROM user_entitlement_overrides o WHERE o.user_id = u.id AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > unixepoch()))");
  if (f === "inactive30") where.push(`${LAST_ACTIVE_SQL} < unixepoch() - 30 * 86400`);
  if (f === "new7") where.push("u.created_at > unixepoch() - 7 * 86400");
  const size = Math.min(100, Math.max(5, Number(pageSize) || 25));
  const pg = Math.max(1, Number(page) || 1);
  // item 3: how many the filter hides, among what the rest of the query would show — said beside the filter
  let hidden = 0;
  if (hideTagged) {
    try { hidden = db.prepare(`SELECT COUNT(*) AS n FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE ${where.join(" AND ")} AND ${HIDDEN_SQL}`).get(...args).n; } catch { hidden = 0; }
    if (hidden) where.push(`NOT ${HIDDEN_SQL}`);
  }
  const base = `FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE ${where.join(" AND ")}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...args).n;
  const rows = db.prepare(`SELECT u.id, u.username, u.plan_tier, COALESCE(u.status, 'active') AS status, u.created_at, u.email_verified_at,
      p.email, COALESCE(NULLIF(p.full_name, ''), NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')) AS name,
      ${LAST_ACTIVE_SQL} AS last_active,
      (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id AND r.created_at > unixepoch() - 7 * 86400) AS resumes_week,
      (SELECT COUNT(*) FROM job_applications j WHERE j.user_id = u.id) AS applications,
      (SELECT COUNT(*) FROM user_entitlement_overrides o WHERE o.user_id = u.id AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > unixepoch())) AS overrides
    ${base} ORDER BY ${PEOPLE_SORTS[sort] || PEOPLE_SORTS.recent}, u.id LIMIT ? OFFSET ?`).all(...args, size, (pg - 1) * size)
    .map(r => {
      let slots = null;
      try { const s = draftSlots(db, r.id); slots = { used: s.used, limit: s.limit }; } catch { /* no slot tables */ }
      return { ...r, last_active: r.last_active || null, drafts: slots, tags: tagsOf(db, r.id) };
    });
  const counts = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN ${LAST_ACTIVE_SQL} > unixepoch() - 7 * 86400 THEN 1 ELSE 0 END) AS active_week,
      SUM(CASE WHEN u.status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM user_entitlement_overrides o WHERE o.user_id = u.id AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > unixepoch())) THEN 1 ELSE 0 END) AS with_override
    FROM users u WHERE ${USERS_ONLY_SQL}`).get();
  return { total, page: pg, pageSize: size, rows, hidden, counts: { total: counts.total || 0, activeWeek: counts.active_week || 0, suspended: counts.suspended || 0, withOverride: counts.with_override || 0 } };
}

/** One person's page — every module's data, from an allow-list. */
export function personDetail(db, userId) {
  const u = db.prepare(`SELECT u.id, u.username, u.is_admin, u.plan_tier, COALESCE(u.status, 'active') AS status, u.suspended_reason, u.suspended_at, u.full_access,
      u.created_at, u.email_verified_at, u.byom_enabled, u.marketing_opt_in, p.email,
      COALESCE(NULLIF(p.full_name, ''), NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')) AS name,
      ${LAST_ACTIVE_SQL} AS last_active
    FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE u.id = ?`).get(userId);
  if (!u || u.is_admin) throw new UserAdminError("No such user.", 404);
  const count = (sql, ...a) => { try { return db.prepare(sql).get(...a)?.n ?? 0; } catch { return 0; } };
  let slots = null;
  try { slots = draftSlots(db, userId); } catch { /* none */ }
  const usage = {
    drafts: slots ? { used: slots.used, limit: slots.limit, remaining: slots.remaining, nextFreeAt: slots.nextFreeAt } : null,
    resumesToday: count("SELECT COUNT(*) AS n FROM resumes WHERE user_id = ? AND created_at > unixepoch() - 86400", userId),
    resumesMonth: count("SELECT COUNT(*) AS n FROM resumes WHERE user_id = ? AND created_at > unixepoch() - 30 * 86400", userId),
    applications: count("SELECT COUNT(*) AS n FROM job_applications WHERE user_id = ?", userId),
    pluginCalls: count("SELECT COUNT(*) AS n FROM mcp_audit WHERE user_id = ? AND at > unixepoch() - 7 * 86400", userId),
    // admin-only: what this user's résumés cost us (the ledger; users never see money)
    costUsd30d: (() => { try { return db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM usage_events WHERE user_id = ? AND created_at > unixepoch() - 30 * 86400").get(userId).c; } catch { return 0; } })(),
  };
  const features = Object.entries(FEATURES).map(([key, f]) => {
    const r = resolveEntitlement(db, userId, key);
    const o = liveOverride(db, userId, key);
    return { key, label: f.label, kind: f.kind, hard: !!f.hard, ceiling: f.ceiling ?? null, value: r.value, source: r.source, detail: r.detail,
      override: o ? { id: o.id, value: o.value, reason: o.reason, setBy: o.set_by, setAt: o.set_at, expiresAt: o.expires_at } : null };
  });
  let activity = [];
  try {
    activity = db.prepare(`SELECT l.id, l.at, l.action, l.before_json, l.after_json, l.reason, l.undone_at, l.actor_kind, COALESCE(a.username, (SELECT 'admin ' || x.email FROM admin_accounts x WHERE 'admin:' || x.public_id = l.actor), CASE WHEN l.actor = 'system' THEN 'system' END) AS actor
      FROM admin_audit_log l LEFT JOIN users a ON a.id = l.admin_user_id WHERE l.target = ? ORDER BY l.id DESC LIMIT 100`).all(`user:${userId}`)
      .map(r => ({ id: r.id, at: r.at, action: r.action, actor: r.actor, actorKind: r.actor_kind || null, reason: r.reason, undoneAt: r.undone_at,
        before: r.before_json ? JSON.parse(r.before_json) : null, after: r.after_json ? JSON.parse(r.after_json) : null }));
  } catch { /* no audit table */ }
  let notes = [];
  try { notes = db.prepare("SELECT n.id, n.body, n.created_at, COALESCE(a.username, (SELECT 'admin ' || x.email FROM admin_accounts x WHERE 'admin:' || x.public_id = n.author_actor), CASE WHEN n.author_actor = 'system' THEN 'system' END) AS author FROM user_notes n LEFT JOIN users a ON a.id = n.author_id WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 50").all(userId); }
  catch { /* none */ }
  let sessions = 0;
  try { sessions = db.prepare("SELECT COUNT(*) AS n FROM auth_contexts WHERE user_id = ? AND revoked_at IS NULL AND expires_at > unixepoch()").get(userId).n; } catch { /* none */ }
  return {
    account: { id: u.id, username: u.username, name: u.name, email: u.email, system: isSystem(u), plan: u.plan_tier || "BASIC",
      status: u.status, access: accessLevelOf(u), suspendedReason: u.suspended_reason, suspendedAt: u.suspended_at, createdAt: u.created_at,
      emailVerifiedAt: u.email_verified_at, lastActive: u.last_active || null, pluginOn: !!u.byom_enabled, productNews: !!u.marketing_opt_in, sessions },
    usage, features, activity, notes, tags: tagsOf(db, userId),
  };
}

// ── P5 · the self-service subset: what a user sees of their own plan and allowance (Settings) ──────────────────
// ⛔ Never money (cost visibility, 10-09), never the admin's A+ swap (it stays silent — 39d), never where a value came
// from beyond "your plan" (an override is support's business), and nothing operator-only.
export const SELF_FEATURES = Object.freeze(["draft_slots", "generate_enabled", "a_plus_enabled", "plugin_byo", "byo_daily_cap",
  "apply_daily_queue_cap", "apply_daily_approval_cap", "apply_daily_submission_cap", "auto_apply_mode"]);
const SELF_LABELS = Object.freeze({
  draft_slots: "Drafts in any 24 hours (a Draft or a new résumé uses one)", generate_enabled: "Generate a résumé", a_plus_enabled: "A+ résumé",
  plugin_byo: "Write résumés in your own ChatGPT or Claude", byo_daily_cap: "Résumés a day written in ChatGPT or Claude",
  apply_daily_queue_cap: "Previews in 24 hours", apply_daily_approval_cap: "Approvals in 24 hours", apply_daily_submission_cap: "Applications sent in 24 hours",
  auto_apply_mode: "Sending applications automatically",
});
export function selfAllowance(db, userId) {
  const u = db.prepare("SELECT plan_tier FROM users WHERE id = ?").get(userId);
  if (!u) throw new UserAdminError("No such user.", 404);
  let slots = null;
  try { slots = draftSlots(db, userId); } catch { /* none */ }
  const count = (sql) => { try { return db.prepare(sql).get(userId)?.n ?? 0; } catch { return 0; } };
  const features = SELF_FEATURES.map(key => {
    const r = resolveEntitlement(db, userId, key);
    const value = key === "auto_apply_mode" ? (r.value === "locked" ? "not available yet" : "available")
      : FEATURES[key].kind === "boolean" ? (r.value ? "yes" : "no") : r.value == null ? "no limit" : String(r.value);
    return { key, label: SELF_LABELS[key], value };
  });
  return {
    plan: String(u.plan_tier || "BASIC").toLowerCase(),
    drafts: slots ? { used: slots.used, limit: slots.limit, remaining: slots.remaining, nextFreeAt: slots.nextFreeAt } : null,
    resumesToday: count("SELECT COUNT(*) AS n FROM resumes WHERE user_id = ? AND created_at > unixepoch() - 86400"),
    resumesMonth: count("SELECT COUNT(*) AS n FROM resumes WHERE user_id = ? AND created_at > unixepoch() - 30 * 86400"),
    features,
  };
}

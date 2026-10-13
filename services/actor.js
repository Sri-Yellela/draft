// services/actor.js — ⛔ D95 · WHO DID IT, WITH ITS KIND IN THE NAME.
//
// Every admin-side write records an ACTOR REFERENCE, a string whose prefix says what kind of identity acted:
//
//     admin:adm_k3…    an admin account (admin_accounts.public_id) — signed in through /admin, its own session
//     user:3           a users row — before D95's switch, the legacy is_admin user acting in the console
//     system           the server itself (boot, a sweep, a schedule)
//
// The older integer columns (admin_audit_log.admin_user_id, set_by, decided_by, …) hold a users.id and nothing
// else: for an admin account they are NULL, never an admin id that could be mistaken for a person. Two of them are
// real foreign keys to users (plan_upgrade_requests.decided_by, user_limits.updated_by), and foreign keys are ON.

export const SYSTEM_ACTOR = Object.freeze({ kind: "system", ref: "system", userId: null, adminId: null, label: "system" });

export function adminActor(admin) {
  return Object.freeze({ kind: "admin", ref: `admin:${admin.public_id}`, userId: null, adminId: admin.id, publicId: admin.public_id,
    isOwner: !!admin.is_owner, label: admin.email });
}

export function userActor(user) {
  return Object.freeze({ kind: "user", ref: `user:${user.id}`, userId: user.id, adminId: null, label: user.username ?? `user ${user.id}` });
}

/** The acting identity of a request: the admin session's, else the signed-in user's, else the system. */
export function actorOf(req) {
  if (req?.actor) return req.actor;
  if (req?.user?.id != null) return userActor(req.user);
  return SYSTEM_ACTOR;
}

/**
 * Whatever a service was handed as "who" — an actor, a request, a bare users.id from older callers, or nothing —
 * as an actor. A bare number is a users row (that is all an integer actor ever meant); nothing is the system.
 */
export function toActor(x) {
  if (x?.kind && x?.ref) return x;
  if (x && typeof x === "object" && ("actor" in x || "user" in x)) return actorOf(x);
  if (x != null && Number.isFinite(Number(x))) return userActor({ id: Number(x) });
  return SYSTEM_ACTOR;
}

/** The columns every admin_audit_log row carries for its actor. */
export const auditActorColumns = (x) => { const a = toActor(x); return { admin_user_id: a.userId ?? null, actor_kind: a.kind, actor: a.ref }; };

/** For a legacy column that references users(id): the user's id, or null for an admin or the system. */
export const actorUserId = (reqOrActor) => (reqOrActor?.kind ? reqOrActor : actorOf(reqOrActor)).userId ?? null;

/** For the *_actor TEXT columns and admin_audit_log.actor. */
export const actorRef = (reqOrActor) => (reqOrActor?.kind ? reqOrActor : actorOf(reqOrActor)).ref;

/** A coded string back to its kind — for display, and so a reader never has to guess. */
export function actorKindOf(ref) {
  const s = String(ref ?? "");
  if (s.startsWith("admin:")) return "admin";
  if (s.startsWith("user:")) return "user";
  if (s === "system") return "system";
  return null;
}

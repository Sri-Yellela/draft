// services/flags.js — ⭐ A187 Stage 0 (46i) · RUNTIME FLAGS on D162's pattern (services/modelGateway.js):
//
//   1. the registry default     shared/flags.js
//   2. the environment          the flag's variable (e.g. ATS_STORE_SLIM=on) — a per-deploy baseline
//   3. the admin's switch       app_settings `flag:<key>` = { state: off | on | cohort, percent } — read at call time
//                               (a 2 s memo, so a bulk loop reads it once, not per row), so a switch or a rollback takes
//                               effect with NO deploy (a deploy is a ~30 s outage on this volume). Every write leaves an
//                               admin_audit_log row — who · when · why · before · after — and rollbackFlag undoes the
//                               newest change still in force.
//
// cohort: a stable 0–99 bucket per person × flag (sha256) — the same person never flips between states.
import crypto from "node:crypto";
import { FLAGS, FLAG_STATES } from "../shared/flags.js";
import { getSetting, setSetting, clearSetting, settingTruthy } from "./appSettings.js";
import { auditActorColumns } from "./actor.js";

export const FLAG_KEY_PREFIX = "flag:";
const settingKey = (key) => FLAG_KEY_PREFIX + key;

export class FlagError extends Error {
  constructor(message, { code = "flag_invalid", status = 400 } = {}) { super(message); this.code = code; this.status = status; }
}

const def = (key) => {
  const f = FLAGS[key];
  if (!f) throw new FlagError(`unknown flag "${key}"`, { code: "unknown_flag", status: 404 });
  return f;
};

function readOverride(db, key) {
  const raw = getSetting(db, settingKey(key));
  if (raw == null) return null;
  try { const v = JSON.parse(raw); return v && FLAG_STATES.includes(v.state) ? v : null; } catch { return null; }
}

/** The flag's effective state and which layer set it: { key, state, percent, layer, override, env }. */
export function flagState(db, key, env = process.env) {
  const f = def(key);
  const override = db ? readOverride(db, key) : null;
  const envRaw = f.env ? env[f.env] : undefined;
  const envState = envRaw == null || envRaw === "" ? null : (settingTruthy(envRaw) ? "on" : "off");
  if (override) return { key, state: override.state, percent: override.state === "cohort" ? override.percent : null, layer: "override", override, env: envState };
  if (envState) return { key, state: envState, percent: null, layer: "env", override: null, env: envState };
  return { key, state: f.default, percent: null, layer: "default", override: null, env: null };
}

/** A stable 0–99 bucket for one person on one flag. */
export function flagBucket(key, userId) {
  return crypto.createHash("sha256").update(`flag:${key}:${userId ?? 0}`).digest().readUInt32BE(0) % 100;
}

const memo = new Map();   // key -> { at, st }
/** Is the flag on for this person (or for the system, with no userId)? */
export function flagOn(db, key, { userId = null, env = process.env, now = Date.now() } = {}) {
  let hit = memo.get(key);
  if (!hit || now - hit.at > 2000 || env !== process.env) { hit = { at: now, st: flagState(db, key, env) }; if (env === process.env) memo.set(key, hit); }
  const { state, percent } = hit.st;
  if (state === "on") return true;
  if (state === "cohort") return userId != null && flagBucket(key, userId) < (percent ?? 0);
  return false;
}

function audit(db, { actor, action, key, before, after, reason }) {
  const a = auditActorColumns(actor);
  return Number(db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
    VALUES (?,?,?,?,?,?,?,?)`).run(a.admin_user_id, a.actor_kind, a.actor, action, `flag:${key}`,
      before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), reason).lastInsertRowid);
}

/**
 * The admin's switch. `state` off | on | cohort (with `percent` 1–99) | inherit (removes the override — back to the
 * environment / default). A reason is required: a flag switch is read later by someone deciding whether to undo it.
 */
export function setFlag(db, key, { state, percent = null, reason, actor = null }) {
  const f = def(key);
  if (typeof reason !== "string" || !reason.trim()) throw new FlagError("say why (reason)", { code: "flag_reason_required" });
  if (state !== "inherit" && !FLAG_STATES.includes(state)) throw new FlagError(`state must be one of ${[...FLAG_STATES, "inherit"].join(", ")}`);
  if (state === "cohort") {
    if (!f.cohort) throw new FlagError(`"${key}" is all-or-nothing — it has no cohort`, { code: "flag_no_cohort" });
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) throw new FlagError("percent must be a whole number 1–99");
  }
  const before = readOverride(db, key);
  const after = state === "inherit" ? null : { state, ...(state === "cohort" ? { percent } : {}) };
  db.transaction(() => {
    if (after === null) clearSetting(db, settingKey(key)); else setSetting(db, settingKey(key), JSON.stringify(after));
    audit(db, { actor, action: "flag_set", key, before, after, reason: reason.trim() });
  })();
  memo.delete(key);
  return flagState(db, key);
}

/** Undo the newest change to this flag that is still in force (one step back). */
export function rollbackFlag(db, key, { reason, actor = null }) {
  def(key);
  if (typeof reason !== "string" || !reason.trim()) throw new FlagError("say why (reason)", { code: "flag_reason_required" });
  const last = db.prepare(`SELECT id, before_json FROM admin_audit_log WHERE target = ? AND action = 'flag_set' AND undone_at IS NULL
    ORDER BY id DESC LIMIT 1`).get(`flag:${key}`);
  if (!last) throw new FlagError("nothing to roll back", { code: "flag_nothing_to_undo", status: 409 });
  const before = last.before_json ? JSON.parse(last.before_json) : null;
  const current = readOverride(db, key);
  db.transaction(() => {
    if (before === null) clearSetting(db, settingKey(key)); else setSetting(db, settingKey(key), JSON.stringify(before));
    db.prepare("UPDATE admin_audit_log SET undone_at = unixepoch() WHERE id = ?").run(last.id);
    audit(db, { actor, action: "flag_rollback", key, before: current, after: before, reason: reason.trim() });
  })();
  memo.delete(key);
  return flagState(db, key);
}

/** Who switched it, when and why — newest first. */
export function flagHistory(db, key, limit = 50) {
  def(key);
  return db.prepare(`SELECT id, at, actor, action, before_json, after_json, reason, undone_at FROM admin_audit_log
    WHERE target = ? ORDER BY id DESC LIMIT ?`).all(`flag:${key}`, limit)
    .map(r => ({ ...r, before: r.before_json ? JSON.parse(r.before_json) : null, after: r.after_json ? JSON.parse(r.after_json) : null }));
}

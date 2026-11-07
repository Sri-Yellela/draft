// services/fullAutoGate.js — ⛔ D175 FA6 [T7] · NO UNATTENDED SEND UNTIL THE FOUR SAFETY CHECKS ARE GREEN (owner 11-07).
//
// FULL AUTO sends an application nobody pressed Submit on. Before it may, all four must hold:
//   injection_defence    — D173 (1): postings / emails reach a model only fenced, and outputs are checked (code; this
//                          module imports the defence so the check cannot outlive it)
//   cost_alarm           — D171 FIX 2: a daily cost alarm is set (Admin → System → Model usage, or
//                          MODEL_DAILY_COST_ALARM_USD) and today's spend is under it
//   kill_switch_verified — an admin recorded, within the last 30 days, that the kill switch and Stop everything stopped
//                          a run already in flight ON PRODUCTION (POST /api/admin/full-auto/prerequisites)
//   never_twice_verified — an admin recorded, within the last 30 days, that the never-sends-twice check passed on a copy
//                          of production data
// fullAutoPrerequisites() reports each; fullAutoBlocked() is what both unattended doors call (routes/apply.js before an
// auto submit, services/applyWorker.js before leasing an unattended remote submit). A red check HOLDS the application
// (`full_auto_prerequisites`), never drops it; a send the person pressed (approve, a pick's Apply tap) is not gated.
import { getSetting, setSetting } from "./appSettings.js";
import { auditActorColumns, toActor } from "./actor.js";
import { costAlarmStatus } from "./modelUsage.js";
import { UNTRUSTED_DATA_RULE, fenceUntrusted } from "./untrustedText.js";

export const ATTESTED = Object.freeze({
  kill_switch_verified: "full_auto_kill_switch_verified_at",
  never_twice_verified: "full_auto_never_twice_verified_at",
});
export const ATTEST_MAX_AGE_DAYS = 30;
export const HOLD_REASON = "full_auto_prerequisites";

const LABELS = Object.freeze({
  injection_defence: "Prompt-injection defence (D173 (1))",
  cost_alarm: "A daily cost alarm, and today under it",
  kill_switch_verified: "The kill switch tested on production",
  never_twice_verified: "Never sends twice, tested on a copy of production",
});

function attestation(db, key, nowSec) {
  let v = null;
  try { v = JSON.parse(getSetting(db, key) || "null"); } catch { v = null; }
  const at = Number(v?.at);
  if (!Number.isFinite(at) || at <= 0) return { ok: false, why: "not recorded yet" };
  const ageDays = (nowSec - at) / 86400;
  if (ageDays > ATTEST_MAX_AGE_DAYS) return { ok: false, why: `recorded ${Math.floor(ageDays)} days ago — older than ${ATTEST_MAX_AGE_DAYS}`, at, by: v.by ?? null };
  return { ok: true, why: `recorded ${new Date(at * 1000).toISOString().slice(0, 10)}${v.by ? ` by ${v.by}` : ""}`, at, by: v.by ?? null };
}

/** Each check: { id, label, ok, why }. `allOk` is true only when every one is green. */
export function fullAutoPrerequisites(db, { env = process.env, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const checks = [];
  const defence = typeof UNTRUSTED_DATA_RULE === "string" && UNTRUSTED_DATA_RULE.length > 50 && fenceUntrusted("posting", "x").startsWith("<untrusted_posting>");
  checks.push({ id: "injection_defence", ok: defence, why: defence ? "built (services/untrustedText.js)" : "missing" });
  let alarm = { thresholdUsd: null, over: false, spentUsd: 0 };
  try { alarm = costAlarmStatus(db, { env, now: nowSec }); } catch { /* reported red below */ }
  const alarmOk = alarm.thresholdUsd != null && !alarm.over;
  checks.push({ id: "cost_alarm", ok: alarmOk,
    why: alarm.thresholdUsd == null ? "no daily alarm set" : alarm.over ? `today $${alarm.spentUsd} is over the $${alarm.thresholdUsd} alarm` : `$${alarm.spentUsd} of $${alarm.thresholdUsd} today` });
  for (const [id, key] of Object.entries(ATTESTED)) checks.push({ id, ...attestation(db, key, nowSec) });
  const out = checks.map(c => ({ ...c, label: LABELS[c.id] }));
  return { allOk: out.every(c => c.ok), checks: out };
}

/** null when an unattended send may go; else the hold's sentence (names the red checks). */
export function fullAutoBlocked(db, opts = {}) {
  const p = fullAutoPrerequisites(db, opts);
  if (p.allOk) return null;
  return `Held: sending without your review waits until draft's safety checks are green (${p.checks.filter(c => !c.ok).map(c => c.label).join("; ")}). Nothing was sent.`;
}

/** An admin records a check as passed (with a reason), or clears it. Audited: who · when · what · why. */
export function recordAttestation(db, id, { actor = null, reason = null, clear = false, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const key = ATTESTED[id];
  if (!key) throw Object.assign(new Error(`unknown check "${id}" (${Object.keys(ATTESTED).join(", ")})`), { status: 400 });
  if (!clear && !(reason && String(reason).trim().length >= 10)) throw Object.assign(new Error("say what was tested (at least 10 characters)"), { status: 400 });
  const before = getSetting(db, key);
  const a = auditActorColumns(toActor(actor));
  const value = clear ? JSON.stringify(null) : JSON.stringify({ at: nowSec, by: a.actor || null, reason: String(reason).slice(0, 500) });
  setSetting(db, key, value);
  try {
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
      VALUES (?,?,?,?,?,?,?,?)`).run(a.admin_user_id, a.actor_kind, a.actor, clear ? "full_auto_prerequisite.clear" : "full_auto_prerequisite.record", key,
      JSON.stringify(before), value, reason ? String(reason).slice(0, 500) : null);
  } catch (e) { console.warn(`[full-auto] prerequisite audit row not written: ${e.message}`); }
  return fullAutoPrerequisites(db, { nowSec });
}

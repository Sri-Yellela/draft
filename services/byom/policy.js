// services/byom/policy.js — ⭐ D86 · WHO MAY USE BRING-YOUR-OWN-MODEL, read at request time.
//
// Three layers, each a hard stop, and ONE definition each so the admin page, the Settings card and the
// enforcement can never disagree (the appSettings.js precedent):
//   · THE GLOBAL SWITCH (Admin → System → Plugin) — OFF by default, so a deploy turns nothing on: the
//     owner decides who sees it first. Off → every tool call is refused and the Settings card reads
//     "unavailable".
//   · THE HOST ALLOW-LIST — Claude and ChatGPT separately. A disabled host can neither connect nor call.
//   · THE USER'S MASTER SWITCH (users.byom_enabled) — OFF by default; nothing connects until it is on.
// Plus a per-user DAILY CAP on résumés written this way (default 50) — draft pays nothing for them, so the
// cap is abuse protection, not cost.
import { getSetting, setSetting, settingTruthy } from "../appSettings.js";
import { HOSTS } from "./oauthServer.js";
import { resolveEntitlement } from "../entitlementResolver.js";
import { BYO_DAILY_CAP_DEFAULT } from "../../shared/entitlements.js";

export const KEYS = Object.freeze({
  enabled: "byom_enabled",
  cap: "byom_daily_cap",
  host: (h) => `byom_host_${h}`,
});
export const DEFAULT_DAILY_CAP = BYO_DAILY_CAP_DEFAULT;
export const CALLS_PER_HOUR = 120;

// ⭐ D88 P1: the switch and the cap are the resolver's (plugin_byo, byo_daily_cap) — the same settings, read in one place.
export function globalEnabled(db) { return resolveEntitlement(db, null, "plugin_byo").value === true; }

export function hostEnabled(db, host) {
  if (host === "local") return process.env.NODE_ENV !== "production";
  if (!HOSTS[host]) return false;
  const v = getSetting(db, KEYS.host(host));
  return v === null ? true : settingTruthy(v);
}

export function dailyCap(db) { return resolveEntitlement(db, null, "byo_daily_cap").value; }

export function userEnabled(db, userId) {
  try { return db.prepare("SELECT byom_enabled FROM users WHERE id = ?").pluck().get(userId) === 1; }
  catch { return false; }
}

export function setUserEnabled(db, userId, on) {
  db.prepare("UPDATE users SET byom_enabled = ? WHERE id = ?").run(on ? 1 : 0, userId);
}

/** Résumés this user had written this way since UTC midnight. */
export function usedToday(db, userId, nowSec = Math.floor(Date.now() / 1000)) {
  const midnight = nowSec - (nowSec % 86400);
  return db.prepare("SELECT COUNT(*) FROM byom_briefs WHERE user_id = ? AND status = 'used' AND used_at >= ?").pluck().get(userId, midnight);
}

export function callsLastHour(db, userId, nowSec = Math.floor(Date.now() / 1000)) {
  return db.prepare("SELECT COUNT(*) FROM mcp_audit WHERE user_id = ? AND at > ?").pluck().get(userId, nowSec - 3600);
}

/**
 * Why a caller may not proceed, as { code, message } — or null when it may. Checked in this order so the
 * message names the switch that is actually off.
 */
export function refusalFor(db, { userId, host }) {
  if (!globalEnabled(db)) return { code: "feature_off", message: "Writing résumés with your own model is switched off on draft right now." };
  if (!hostEnabled(db, host)) return { code: "host_off", message: `draft is not accepting connections from ${HOSTS[host]?.label ?? "this app"} right now.` };
  if (!userEnabled(db, userId)) return { code: "user_off", message: "This is switched off in your draft settings. Turn on \"Write my résumés in ChatGPT or Claude\" in Settings → Connected apps." };
  return null;
}

export function adminSettings(db) {
  return {
    enabled: globalEnabled(db),
    hosts: Object.fromEntries(Object.keys(HOSTS).map(h => [h, hostEnabled(db, h)])),
    dailyCap: dailyCap(db),
  };
}

export function writeAdminSettings(db, { enabled, hosts, dailyCap: cap } = {}) {
  if (typeof enabled === "boolean") setSetting(db, KEYS.enabled, enabled);
  for (const [h, on] of Object.entries(hosts || {})) if (HOSTS[h] && typeof on === "boolean") setSetting(db, KEYS.host(h), on);
  if (cap != null) {
    const n = Number(cap);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw Object.assign(new Error("The daily cap must be a whole number from 1 to 1000."), { status: 400 });
    setSetting(db, KEYS.cap, n);
  }
  return adminSettings(db);
}

// services/diskAlert.js — the disk alert that reaches the owner OUTSIDE Admin (owner 11-02, after the volume filled).
//
// ⛔ 11-02: the draft-data volume reached 5.01 of 5 GB (A112's crawl: 79,184 postings and their fit reports). Every
// sign-up then wrote its users row but failed on the session (SQLITE_FULL): testers saw "service unavailable", then
// "username taken". D77's banner was showing — on Admin, which nobody had open. This emails ADMIN_OWNER_EMAIL and logs
// an error line (Railway's log) when the volume passes ALERT_AT, again at each higher band, and once a day while it stays
// above. Read from the same gauge as the banner (services/diskGauge.js readGauge).
import { readGauge } from "./diskGauge.js";
import { getSetting, setSetting } from "./appSettings.js";

export const ALERT_AT = 80;
/** The bands an alert is sent at: crossing into a higher one sends again at once. */
export const BANDS = Object.freeze([80, 90, 95]);
export const REPEAT_SECONDS = 24 * 3600;
export const CHECK_EVERY_MS = 10 * 60 * 1000;
const KEY = "disk_alert_last";

export const bandOf = (pct) => (Number.isFinite(pct) ? [...BANDS].reverse().find(b => pct >= b) ?? null : null);
const gb = (b) => `${(b / 1e9).toFixed(2)} GB`;

/**
 * One check. Sends when the band rises, or the same band has gone REPEAT_SECONDS without one; records the send.
 * Back under ALERT_AT, the record is cleared so the next crossing alerts at once.
 * @returns {{ sent: boolean, band: number|null, usedPct?: number, reason?: string }}
 */
export async function checkDiskAlert(db, dataDir, { send, to, now = Math.floor(Date.now() / 1000), readGaugeImpl = readGauge, log = console } = {}) {
  let g;
  try { g = readGaugeImpl(dataDir); } catch (e) { return { sent: false, band: null, reason: `unreadable: ${e.message}` }; }
  const band = bandOf(g.usedPct);
  const last = (() => { try { return JSON.parse(getSetting(db, KEY) || "null"); } catch { return null; } })();
  if (band == null) {
    if (last) try { setSetting(db, KEY, "null"); } catch { /* the disk may still be tight */ }
    return { sent: false, band: null, usedPct: g.usedPct };
  }
  const due = !last || band > last.band || now - last.at >= REPEAT_SECONDS;
  if (!due) return { sent: false, band, usedPct: g.usedPct, reason: "already_alerted" };
  const line = `The draft data volume is ${g.usedPct}% full (${gb(g.usedBytes)} of ${gb(g.totalBytes)}, ${gb(g.freeBytes)} free).`;
  log.error?.(`[disk-alert] ${line}`);
  let sent = false;
  if (to && send) {
    try {
      const r = await send({ to, db, subject: `draft: data volume ${g.usedPct}% full`,
        text: `${line}\n\nAt 100% sign-ups and sign-ins fail (SQLITE_FULL). Resize the draft-data volume in Railway, or free space `
          + `(Admin → Ops shows the largest files).\n\nYou'll get this again if it passes ${BANDS.find(b => b > band) ?? "the next band"}%, `
          + `and once a day while it stays above ${ALERT_AT}%.` });
      sent = !!r?.ok;
    } catch (e) { log.error?.(`[disk-alert] email failed: ${e.message}`); }
  }
  // Recorded even when the email could not go: the log line is the alert of record, and a retry every 10 minutes spams it.
  try { setSetting(db, KEY, JSON.stringify({ band, at: now })); } catch { /* full: the next check tries again */ }
  return { sent, band, usedPct: g.usedPct };
}

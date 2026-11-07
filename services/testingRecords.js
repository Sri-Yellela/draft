// services/testingRecords.js — ⛔ Owner 11-07: "survey results are exempt, everything else write code to automatically
// delete and show as no longer available if pursued." The privacy page promises the early-testing records "are kept with
// your account for 90 days"; until now nothing deleted them. A daily sweep (server.js, 03:40 UTC) deletes, older than
// RETENTION_DAYS:
//   trial_events     the walkthrough steps reached, minutes, features tried by name, errors, device type
//   trial_feedback   the in-app "Something broke? / Feedback" notes
// ⛔ EXEMPT (the owner's word): survey answers — trial_surveys and standalone_surveys are never swept.
// The cutoff of the last sweep is kept (app_settings), so a reader can say the older records are no longer available
// instead of showing a gap as if nothing had happened.
import { getSetting, setSetting } from "./appSettings.js";

export const RETENTION_DAYS = 90;
export const SWEPT_TABLES = Object.freeze(["trial_events", "trial_feedback"]);
export const EXEMPT_TABLES = Object.freeze(["trial_surveys", "standalone_surveys"]);
export const SWEPT_BEFORE_KEY = "testing_records_swept_before";
export const NO_LONGER_AVAILABLE = `Activity and feedback older than ${RETENTION_DAYS} days are no longer available — deleted as the privacy policy says. Survey answers are kept.`;

/** Deletes the swept tables' rows older than the retention; returns { cutoff, deleted: { table: n } }. */
export function sweepTestingRecords(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const cutoff = now - RETENTION_DAYS * 86400;
  const deleted = {};
  for (const t of SWEPT_TABLES) {
    try { deleted[t] = db.prepare(`DELETE FROM ${t} WHERE created_at < ?`).run(cutoff).changes; }
    catch { deleted[t] = 0; }   // a database without the table
  }
  try { setSetting(db, SWEPT_BEFORE_KEY, String(cutoff)); } catch { /* no app_settings */ }
  return { cutoff, deleted };
}

/** What a reader shows: null before any sweep, else the cutoff and the words. */
export function retentionNote(db) {
  let before = null;
  try { const v = Number(getSetting(db, SWEPT_BEFORE_KEY)); before = Number.isFinite(v) && v > 0 ? v : null; } catch { before = null; }
  return before == null ? null : { days: RETENTION_DAYS, before, text: NO_LONGER_AVAILABLE };
}

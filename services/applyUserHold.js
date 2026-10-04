// services/applyUserHold.js
//
// D25: THE USER'S OWN "STOP EVERYTHING" — a per-user hold on the apply pipeline.
//
// The kill switch (services/appSettings.js, FULL_AUTO_KEY) is the OPERATOR's: global, admin-only,
// and it stops full-auto submission for everyone. Draft House's run bar needed the user's
// equivalent, and nothing user-scoped existed — abort is per run-job and removing from the line is
// per waiting run, so a user who wanted everything to stop had to find and click each one.
//
// THE NARROWEST HOLD THAT DOES THE JOB:
//   - stored in app_settings, the table the kill switch already lives in, under one key per user.
//     That is a key/value table read at request time and never cached — exactly the property a
//     stop needs — and it needs no migration (a migration has to land byte-identical in server.js
//     and scripts/migrations.js; see CLAUDE.md).
//   - checked by routes/apply.js BEFORE A RUN STARTS, at the same doors the kill switch guards for
//     the line: lineHeldBy (so dispatchLine — a finishing run, the ticker, boot recovery — starts
//     nothing), startRun (a Draft made while held waits in line instead of starting), and
//     processRun itself (before the run is marked running, and before each next job is launched).
//
// WHAT IT DOES NOT DO, and the run bar says so: it does not recall an application already sent —
// nothing can — and an application already being filled when the hold lands finishes (the per-row
// Stop in Queued is what cancels that one).

import { getSetting, setSetting, clearSetting, settingTruthy } from "./appSettings.js";

export const USER_HOLD_PREFIX = "apply_user_hold:";

/** The app_settings key for one user's hold. Exported so a test can assert the storage shape. */
export function userHoldKey(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("userHoldKey: a positive integer user id is required");
  return `${USER_HOLD_PREFIX}${id}`;
}

/** True when this user has pressed Stop everything and not released it. Read at call time. */
export function userHeld(db, userId) {
  if (userId == null) return false;
  let key;
  try { key = userHoldKey(userId); } catch { return false; }
  return settingTruthy(getSetting(db, key));
}

/** When the hold was set (seconds epoch), or null when there is none. */
export function userHoldSince(db, userId) {
  if (!userHeld(db, userId)) return null;
  try {
    return db.prepare("SELECT updated_at FROM app_settings WHERE key=?").pluck().get(userHoldKey(userId)) ?? null;
  } catch { return null; }
}

/**
 * Set or release the hold. Releasing DELETES the row rather than writing "0": a user hold has no
 * env default to fall back to, so "released" and "never set" are the same state and should look it.
 */
export function setUserHold(db, userId, held) {
  if (typeof held !== "boolean") throw new Error("setUserHold: held must be a boolean");
  const key = userHoldKey(userId);
  if (held) setSetting(db, key, true);
  else clearSetting(db, key);
  return userHeld(db, userId);
}

// ⛔ A148 (45p, owner 11-08): "i logged into the cws tester account and its showing my pfp".
//
// Everything this browser keeps about the SIGNED-IN PERSON is forgotten the moment the signed-in person changes — a
// sign-out (any of the paths: the menu, inactivity, an expired session, the admin's), or a sign-in as someone else.
// AppRouter calls clearPersonalClientState() when authUser's id changes; other tabs follow through one BroadcastChannel.
//
// What stays: this DEVICE's preferences (theme, panel widths, the deck's geometry and order, dismissed prompts) — they
// describe the screen, not the person. What goes: anything that names or reflects the person's own data.
import { resetAccountAvatar } from "./accountAvatar.js";

// Keys holding the person's own data (exact names) and key families (prefixes).
export const PERSONAL_KEYS = [
  "rm_jobs_profile_ui_v1",        // the job profiles' names / ids
  "rm_board_filters_v1",          // the board's remembered sentence + filters
  "draft:pending-board-search",   // a search waiting to run
  "draft:reopen-editor",          // the résumé the editor was showing
  "draft-audit-token",            // the person's audit link
  "draft-atlas-learned",          // what the person learned on Atlas
  "empTypePrefs",
];
export const PERSONAL_PREFIXES = [
  "draft.deck.lastGood.",         // the deck's last good deal (the person's picks)
  "draft.placementSeen.",         // B-2: the placement the sentence followed, per profile
  "atlas.wholeSeen.",             // Atlas modules already celebrated
];

const CHANNEL = "draft-auth";

function sweep(storage) {
  if (!storage) return;
  const doomed = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && (PERSONAL_KEYS.includes(k) || PERSONAL_PREFIXES.some((p) => k.startsWith(p)))) doomed.push(k);
  }
  doomed.forEach((k) => { try { storage.removeItem(k); } catch { /* storage refused: nothing more to do */ } });
}

/** Forget the signed-in person in this tab: the picture + account, their stored keys, the whole session store. */
export function clearPersonalClientState() {
  resetAccountAvatar();
  try { sweep(window.localStorage); } catch { /* private mode */ }
  try { window.sessionStorage.clear(); } catch { /* private mode */ }
}

const LAST_PERSON_KEY = "draft:last-person";   // the id last signed in on this browser (an id only — not personal data)

/**
 * The signed-in person is now `nextId` (null = signed out); `prevId` is who this tab had (undefined = not known yet).
 * Clears when this tab's person changed, or when a DIFFERENT person signs in than the one this browser last had (a
 * sign-out from a client older than A148 left their keys behind). Returns true when it cleared.
 */
export function notePerson(prevId, nextId) {
  let stored = null;
  try { stored = window.localStorage.getItem(LAST_PERSON_KEY); } catch { stored = null; }
  const tabSwitched = prevId != null && String(prevId) !== String(nextId ?? "");
  const browserSwitched = nextId != null && stored != null && stored !== String(nextId);
  if (tabSwitched || browserSwitched) clearPersonalClientState();
  if (tabSwitched) announcePersonChanged(nextId);
  if (nextId != null) { try { window.localStorage.setItem(LAST_PERSON_KEY, String(nextId)); } catch { /* private mode */ } }
  return tabSwitched || browserSwitched;
}

/** Tell the other open tabs the person changed (they reload into the new state). */
export function announcePersonChanged(userId) {
  try { const ch = new BroadcastChannel(CHANNEL); ch.postMessage({ type: "person-changed", userId: userId ?? null }); ch.close(); }
  catch { /* no BroadcastChannel: the other tabs find out on their next request (401 or the new session) */ }
}

/** Follow another tab's sign-out / switch. Returns the unsubscribe. */
export function onPersonChangedElsewhere(fn) {
  let ch = null;
  try { ch = new BroadcastChannel(CHANNEL); ch.onmessage = (e) => { if (e?.data?.type === "person-changed") fn(e.data.userId ?? null); }; }
  catch { return () => {}; }
  return () => { try { ch.close(); } catch { /* closed */ } };
}

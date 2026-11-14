// lib/assistantBridge.js — ⭐ D190 · how Ask draft reaches the SAME functions the buttons call.
// A mounted surface (the board, the deck) registers what it can do — the current job, its Draft / Save / Pass call, the
// filter sentence — and Ask draft's T1 handlers call them. Nothing is re-implemented here: when no surface has registered an
// action (the person is on Atlas, say), the handler says so instead of guessing.
const owners = new Map();   // owner → { [name]: fn }

/** Register actions for as long as the surface is mounted; returns the unregister function. */
export function registerAssistantActions(owner, actions) {
  owners.set(owner, actions);
  return () => { if (owners.get(owner) === actions) owners.delete(owner); };
}

/** The newest registration that offers `name`, or null. */
export function assistantAction(name) {
  const all = [...owners.values()];
  for (let i = all.length - 1; i >= 0; i--) if (typeof all[i][name] === "function") return all[i][name];
  return null;
}

/** For tests and sign-out. */
export function clearAssistantActions() { owners.clear(); }

// The conversation is kept for the tab's session (D190: "remembers the conversation for the session, cleared on sign-out;
// never stored server-side"). App.jsx's one sign-out calls clearAskDraftSession.
export const ASK_SESSION_KEY = "draft-ask:turns";
export const ASK_CLEAR_EVENT = "draft:ask-clear";
export function clearAskDraftSession() {
  try { sessionStorage.removeItem(ASK_SESSION_KEY); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(ASK_CLEAR_EVENT)); } catch { /* no window (tests) */ }
}

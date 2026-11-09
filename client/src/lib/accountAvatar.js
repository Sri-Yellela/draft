// The signed-in user's picture, shared by the TopBar avatar and the Account page.
//
// The uploaded picture is behind auth, so an <img src> cannot carry the auth-context header a
// cross-origin frontend needs — it is fetched once with the same headers as every API call and
// handed out as an object URL. Without an upload, the Google picture (a public URL) is used; with
// neither, callers draw the initial. "rm:account-changed" refreshes everyone.
import { useEffect, useState } from "react";
import { api, authHeaders } from "./api.js";

let cached = null;          // { url, objectUrl } | null
let inflight = null;
let generation = 0;          // A148: a load started for the previous account never lands after a reset
const listeners = new Set();

async function resolve() {
  const account = await api("/api/account");
  let url = null, objectUrl = null;
  if (account.hasAvatar) {
    // ⛔ A148: the per-user, versioned URL (never one URL shared by every account — the browser served the last account's).
    const r = await fetch(account.avatarUrl || "/api/account/avatar", { credentials: "include", headers: authHeaders(), cache: "no-cache" });
    if (r.ok) url = objectUrl = URL.createObjectURL(await r.blob());
  }
  if (!url && account.providerPicture) url = account.providerPicture;
  return { url, objectUrl, account };
}

export function refreshAccount() {
  if (cached?.objectUrl) URL.revokeObjectURL(cached.objectUrl);
  cached = null;
  const gen = generation;
  inflight = resolve().then((v) => {
      if (gen !== generation) { if (v.objectUrl) URL.revokeObjectURL(v.objectUrl); return null; }
      cached = v; listeners.forEach((fn) => fn(v)); return v;
    })
    .catch(() => { if (gen !== generation) return null; cached = { url: null, objectUrl: null, account: null }; listeners.forEach((fn) => fn(cached)); return cached; })
    .finally(() => { inflight = null; });
  return inflight;
}

/** { url, account } — url is null until loaded, and when there is no picture. */
export function useAccountAvatar(enabled = true) {
  const [state, setState] = useState(cached);
  useEffect(() => {
    if (!enabled) return undefined;
    listeners.add(setState);
    if (!cached && !inflight) refreshAccount();
    else if (cached) setState(cached);
    const onChange = () => refreshAccount();
    window.addEventListener("rm:account-changed", onChange);
    return () => { listeners.delete(setState); window.removeEventListener("rm:account-changed", onChange); };
  }, [enabled]);
  return state || { url: null, account: null };
}

/** ⛔ A148: forget the signed-in person's picture and account — called whenever the signed-in user changes or signs out. */
export function resetAccountAvatar() {
  if (cached?.objectUrl) URL.revokeObjectURL(cached.objectUrl);
  cached = null;
  inflight = null;
  generation += 1;
  listeners.forEach((fn) => fn(null));
}

export const announceAccountChanged = () => window.dispatchEvent(new Event("rm:account-changed"));

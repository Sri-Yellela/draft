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
const listeners = new Set();

async function resolve() {
  const account = await api("/api/account");
  let url = null, objectUrl = null;
  if (account.hasAvatar) {
    const r = await fetch("/api/account/avatar", { credentials: "include", headers: authHeaders() });
    if (r.ok) url = objectUrl = URL.createObjectURL(await r.blob());
  }
  if (!url && account.providerPicture) url = account.providerPicture;
  return { url, objectUrl, account };
}

export function refreshAccount() {
  if (cached?.objectUrl) URL.revokeObjectURL(cached.objectUrl);
  cached = null;
  inflight = resolve().then((v) => { cached = v; listeners.forEach((fn) => fn(v)); return v; })
    .catch(() => { cached = { url: null, objectUrl: null, account: null }; listeners.forEach((fn) => fn(cached)); return cached; })
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

export const announceAccountChanged = () => window.dispatchEvent(new Event("rm:account-changed"));

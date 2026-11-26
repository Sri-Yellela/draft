// ── D12: the extension, where IMPORT used to be ────────────────────────────────────────────────
//
// D11 removed Full House's IMPORT button, so without the extension a user has no way to put a job
// from elsewhere on their board. Three things here say where to get it, each in the place the
// missing route would otherwise be felt:
//
//   the bar's + square     — D35: ADD JOBS is the condensed bar's "+" (components/BoardBar.jsx AddSquare),
//                             exactly where IMPORT sat. Always shown.
//   ExtensionFirstRunPrompt — under the search bar until the extension is CONNECTED (a live
//                             extension token, GET /api/extension/status) or the user says "Not now".
//                             Connecting makes it go away by itself; nobody who has it is nagged.
//   SavedEmptyState         — the ★ Saved tab, empty: captures land there, so that is where the
//                             absence of the extension shows.
//
// All three lead to /extension (the site's page, shared/extension.js), never straight to the store:
// the page explains what is being installed before anyone installs it, and it is the one place that
// knows whether a store link exists yet.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { EXTENSION_PAGE } from "../../../shared/extension.js";
// ⛔ 47j w1-market (D197 Wave 1 #2): both are drawn on the plate market's Index (the first-run prompt above the list, the ★
// empty in it), so both are the plate's drawer (plate/PlateState.jsx) — the conditions, words and links are unchanged.
import { Drawer } from "../plate/PlateState.jsx";

const DISMISS_KEY = "draft:extension-prompt-dismissed";

/**
 * GET /api/extension/status once known — { connected, state, lastSeenAt, lastCaptureAt, recentCaptures };
 * null while loading or if the check failed (show nothing).
 *
 * D33: `state` is one of three (routes/extensionStatus.js): "connected" · "not_connected" (the
 * extension has been used on this account but holds no live token) · "not_installed" (no sign of it).
 * A surface that offers an install to someone whose extension is connected is asserting something it
 * could have checked — the same class as the old "Not linked" label.
 */
export function useExtensionStatus({ enabled = true } = {}) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    api("/api/extension/status")
      .then(d => {
        if (!live || typeof d?.connected !== "boolean") return;
        setStatus({ ...d, connected: d.connected, state: d.state || (d.connected ? "connected" : "not_installed") });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [enabled]);
  return status;
}

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

// ⭐ D147 (owner 11-03): the prompt is shown ONCE — on the first visit that shows it — and stays dismissible. A later
// visit (a new page load) treats it as seen; within the visit that showed it, it stays until dismissed.
const SEEN_KEY = "draft:extension-prompt-seen";
let shownThisLoad = false;
function seenBefore() {
  if (shownThisLoad) return false;
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function markSeen() {
  shownThisLoad = true;
  try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
}

export function ExtensionFirstRunPrompt() {
  const status = useExtensionStatus();
  const [dismissed, setDismissed] = useState(() => readDismissed() || seenBefore());
  const showing = !dismissed && !!status && !status.connected;
  useEffect(() => { if (showing) markSeen(); }, [showing]);
  // Unknown (loading, or the check failed) shows nothing: a prompt that flashes and vanishes for
  // someone who already has the extension is worse than one that arrives a beat late.
  if (!showing) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };
  return (
    <Drawer role="note" data-extension-first-run="" kicker={status.state === "not_connected" ? "NOT CONNECTED" : "THE EXTENSION"}
      title={status.state === "not_connected" ? "Your draft extension isn't connected." : "Add jobs from any site."}
      actions={<>
        <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="pl-btn pl-btn--secondary">
          {status.state === "not_connected" ? "How to connect it" : "Get the extension"}
        </Link>
        <button type="button" onClick={dismiss} className="pl-btn pl-btn--flat">Not now</button>
      </>}>
      {status.state === "not_connected" ? (
        <p data-extension-state="not_connected">
          Click it once in your browser's toolbar while you're signed in here, and it connects.
        </p>
      ) : (
        <p data-extension-state="not_installed">
          The draft browser extension captures the posting you're viewing onto your board — find it under Sort → Imported.
        </p>
      )}
    </Drawer>
  );
}

export function SavedEmptyState({ theme }) {
  const status = useExtensionStatus();
  // D33: someone whose extension is connected is told how to USE it, not offered it again.
  const connected = status?.state === "connected";
  return (
    <Drawer data-saved-empty="" title="Nothing saved yet"
      actions={!connected && (
        <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="pl-btn pl-btn--secondary"
          data-extension-state={status?.state || "unknown"}>
          {status?.state === "not_connected" ? "Connect the extension" : "Get the extension"}
        </Link>
      )}>
      {connected
        ? <p>Save a job on the board (★) to keep it here. Your extension is connected: on any job posting,
            click it or press Ctrl+Shift+K and the job lands on your board, under +.</p>
        : <p>Save a job on the board (★) to keep it here. To add a job you found somewhere else, capture it
            with the draft browser extension — it lands on your board, under +.</p>}
    </Drawer>
  );
}

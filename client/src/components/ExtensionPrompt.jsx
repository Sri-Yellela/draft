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
import { DraftMark } from "./DraftMark.jsx";
import { EXTENSION_PAGE } from "../../../shared/extension.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

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
    <div role="note" data-extension-first-run=""
      style={{
        maxWidth: 920, width: "calc(100% - 32px)", margin: "14px auto 0", padding: "12px 16px", boxSizing: "border-box",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        border: "1px solid var(--border-glass)", borderRadius: 14,
        background: "var(--c-hover)", color: "var(--color-text)", fontSize: ts(13),
      }}>
      <DraftMark style={{ fontSize: ts(18), color: "var(--color-primary)" }}/>
      {status.state === "not_connected" ? (
        <div data-extension-state="not_connected" style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.5 }}>
          <strong>Your draft extension isn't connected.</strong>{" "}
          <span style={{ color: "var(--color-text-muted)" }}>
            Click it once in your browser's toolbar while you're signed in here, and it connects.
          </span>
        </div>
      ) : (
        <div data-extension-state="not_installed" style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.5 }}>
          <strong>Add jobs from any site.</strong>{" "}
          <span style={{ color: "var(--color-text-muted)" }}>
            The draft browser extension captures the posting you're viewing onto your board — find it under Sort → Imported.
          </span>
        </div>
      )}
      <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="rm-btn rm-btn-primary rm-btn-sm"
        style={{ textDecoration: "none" }}>
        {status.state === "not_connected" ? "How to connect it" : "Get the extension"}
      </Link>
      <button type="button" onClick={dismiss} className="rm-btn rm-btn-secondary rm-btn-sm">Not now</button>
    </div>
  );
}

export function SavedEmptyState({ theme }) {
  const status = useExtensionStatus();
  // D33: someone whose extension is connected is told how to USE it, not offered it again.
  const connected = status?.state === "connected";
  return (
    <div data-saved-empty="" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 14, padding: 40, color: theme?.textDim }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: ts(29), color: theme?.text, textAlign: "center" }}>
        Nothing saved yet
      </div>
      <div style={{ fontSize: ts(13), textAlign: "center", color: theme?.textDim, maxWidth: 400, lineHeight: 1.7 }}>
        {connected
          ? <>Save a job on the board (★) to keep it here. Your extension is connected: on any job posting,
              click it or press Ctrl+Shift+K and the job lands on your board, under +.</>
          : <>Save a job on the board (★) to keep it here. To add a job you found somewhere else, capture it
              with the draft browser extension — it lands on your board, under +.</>}
      </div>
      {!connected && (
        <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="rm-btn rm-btn-secondary rm-btn-sm"
          data-extension-state={status?.state || "unknown"} style={{ textDecoration: "none" }}>
          {status?.state === "not_connected" ? "Connect the extension" : "Get the extension"}
        </Link>
      )}
    </div>
  );
}

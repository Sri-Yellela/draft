// ── D12: the extension, where IMPORT used to be ────────────────────────────────────────────────
//
// D11 removed Full House's IMPORT button, so without the extension a user has no way to put a job
// from elsewhere on their board. Three things here say where to get it, each in the place the
// missing route would otherwise be felt:
//
//   ExtensionAddJobsLink    — in the board's action row, exactly where IMPORT sat. Always shown.
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
import { Plus } from "lucide-react";
import { api } from "../lib/api.js";
import { DraftMark } from "./DraftMark.jsx";
import { EXTENSION_PAGE } from "../../../shared/extension.js";

const DISMISS_KEY = "draft:extension-prompt-dismissed";

/** { connected: boolean } once known; null while loading or if the check failed (show nothing). */
export function useExtensionStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/extension/status")
      .then(d => { if (live && typeof d?.connected === "boolean") setStatus({ connected: d.connected }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return status;
}

export function ExtensionAddJobsLink() {
  return (
    <Link to={EXTENSION_PAGE} target="_blank" rel="noopener"
      title="Add jobs from any site with the draft browser extension"
      data-extension-link=""
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999,
        background: "transparent",
        border: "1px solid var(--color-primary)",
        color: "var(--color-text)", textDecoration: "none",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        textTransform: "uppercase", letterSpacing: "0.08em",
        whiteSpace: "nowrap",
      }}>
      <Plus size={13} /> Add jobs
    </Link>
  );
}

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

export function ExtensionFirstRunPrompt() {
  const status = useExtensionStatus();
  const [dismissed, setDismissed] = useState(readDismissed);
  // Unknown (loading, or the check failed) shows nothing: a prompt that flashes and vanishes for
  // someone who already has the extension is worse than one that arrives a beat late.
  if (dismissed || !status || status.connected) return null;
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
        background: "var(--c-hover)", color: "var(--color-text)", fontSize: 13,
      }}>
      <DraftMark style={{ fontSize: 18, color: "var(--color-primary)" }}/>
      <div style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.5 }}>
        <strong>Add jobs from any site.</strong>{" "}
        <span style={{ color: "var(--color-text-muted)" }}>
          The draft browser extension captures the posting you're viewing into ★ Saved.
        </span>
      </div>
      <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="rm-btn rm-btn-primary rm-btn-sm"
        style={{ textDecoration: "none" }}>
        Get the extension
      </Link>
      <button type="button" onClick={dismiss} className="rm-btn rm-btn-secondary rm-btn-sm">Not now</button>
    </div>
  );
}

export function SavedEmptyState({ theme }) {
  return (
    <div data-saved-empty="" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 14, padding: 40, color: theme?.textDim }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 29, color: theme?.text, textAlign: "center" }}>
        Nothing saved yet
      </div>
      <div style={{ fontSize: 13, textAlign: "center", color: theme?.textDim, maxWidth: 400, lineHeight: 1.7 }}>
        Save a job on the board (★) to keep it here. To save a job you found somewhere else, capture it
        with the draft browser extension — it lands here.
      </div>
      <Link to={EXTENSION_PAGE} target="_blank" rel="noopener" className="rm-btn rm-btn-secondary rm-btn-sm"
        style={{ textDecoration: "none" }}>
        Get the extension
      </Link>
    </div>
  );
}

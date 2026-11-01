// ⭐ EXPLORE, VIEW-ONLY (owner 11-01): "after the survey, let them explore the site as an option besides the coming soon,
// but lock out all features with a coming soon pop up". The real app, everything navigable — turn the deck, open cards
// and reports, try filters, open branches, explore the map, zoom the circle — and every action that would ACT or SAVE
// (Draft, Save, Pass, Apply, Approve, send, upload, settings, the mode switch, add to Profile, claim, Learn progress,
// résumé changes) is stopped before it reaches the page and opens ONE pop-up naming their sign-up email. Each stopped
// press is counted by feature (POST /api/trial/event { event: "locked" }): the most-pressed = what people want first.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import { Z } from "../styles/zLayers.js";

/** [feature, test(element)] — the first that matches names the press. Selectors first, then the button's own words. */
const RULES = [
  ["draft", (el) => el.closest('[aria-keyshortcuts^="D"], .jb__sq--draft, [data-draft-state]')],
  ["save", (el) => el.closest('[aria-keyshortcuts="S"], .jb__sq--save')],
  ["pass", (el) => el.closest('[aria-keyshortcuts^="X"]')],
  ["auto_mode", (el) => el.closest(".dh-mode__seg, [data-stop-everything]")],
  ["settings", (el) => el.closest("[data-settings-open], [data-auto-settings] button, [data-auto-settings] input, [data-auto-settings] select")],
  ["upload", (el) => el.closest('input[type="file"], [data-upload]')],
];
const WORDS = [
  ["draft", /^(draft|redraft)\b/i], ["apply", /^(apply|apply now|apply for me)\b/i], ["approve", /^(approve|approve & send|send it)\b/i],
  ["send", /^(send|submit)\b/i], ["save", /^(save|star)\b/i], ["pass", /^pass\b/i], ["upload", /^(upload|replace)\b/i],
  ["profile", /^(add to (my )?profile|add skill|add it)\b/i], ["claim", /^claim\b/i], ["learn_progress", /^(mark (as )?(done|complete)|i finished|start (this|the) (piece|course))/i],
  ["resume", /^(generate|tailor|enhance|make (it|the résumé)|regenerate)\b/i],
];
/** Never locked: getting around and reading. */
const READ_ONLY = /^(open|close|collapse|expand|next|back|previous|more|less|show|hide|why these|open the report|tap for the report|explore|skip|ok|cancel|search|filters?|all|zoom|\+|−|-)\b/i;

export function lockedFeatureOf(target) {
  const el = target?.closest?.("button, a, [role='button'], input, select, label");
  if (!el || el.closest("[data-explore-popup], [data-trial-dock], nav, header")) return null;
  for (const [f, t] of RULES) if (t(el)) return f;
  const words = (el.getAttribute("aria-label") || el.textContent || "").trim();
  if (!words || READ_ONLY.test(words)) return null;
  for (const [f, re] of WORDS) if (re.test(words)) return f;
  return null;
}

export default function ExploreLock({ email }) {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const stop = (feature, e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
      setOpen(feature);
      api("/api/trial/event", { method: "POST", body: JSON.stringify({ event: "locked", detail: { feature, page: location.pathname } }) }).catch(() => {});
    };
    const onClick = (e) => { const f = lockedFeatureOf(e.target); if (f) stop(f, e); };
    // The deck's keys act too: D drafts, S saves, X passes, ← and → decide.
    const onKey = (e) => {
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      const k = e.key;
      const f = k === "d" || k === "D" || k === "ArrowRight" ? "draft" : k === "s" || k === "S" ? "save" : k === "x" || k === "X" || k === "ArrowLeft" ? "pass" : null;
      if (f && location.pathname.startsWith("/app/today")) stop(f, e);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("change", onClick, true); document.removeEventListener("keydown", onKey, true); };
  }, []);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Coming soon" data-explore-popup={open}
      style={{ position: "fixed", inset: 0, zIndex: Z.TOAST, display: "grid", placeItems: "center", padding: 16,
               background: "color-mix(in srgb, var(--c-ink) 35%, transparent)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
      <div style={{ boxSizing: "border-box", width: "min(440px, 100%)", padding: 20, borderRadius: 12, background: "var(--c-surface-solid)",
                    color: "var(--c-ink)", border: "1px solid var(--c-border)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Coming soon</h2>
        <p style={{ margin: "0 0 16px" }}>
          draft is opening soon. We'll email you{email ? <> at <b>{email}</b></> : null} when your account is ready.
        </p>
        <DepthButton primary onClick={() => setOpen(null)} data-explore-ok="">OK</DepthButton>
      </div>
    </div>
  );
}

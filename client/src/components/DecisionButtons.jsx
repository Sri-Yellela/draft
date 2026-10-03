// ── The board's decisions, in the deck's button treatment (A53) ────────────────────────────
//
// DeckView's ActionButton, scaled for a listing row and a panel's action bar: glass for Pass and
// Save, the orange FILL with ink text and an ACCENT_INK edge for Draft — text on orange is ink, and
// the logo orange is a fill only (styles/colorTokens.js). Words, not glyphs: the board said "⚡" and
// "Queue Auto" for Draft and "☆" for Save, which were more names for the same three actions.
//
// ⛔ Save and Pass SET (owner, 10-02). A decided button shows its state and does nothing when
// pressed again; reversal is Undo on the toast (components/DecisionToast.jsx), or the Saved list's
// own labelled "Remove" — never the same button pressed twice.
import { useState } from "react";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";

export function DecisionPill({ label, onClick, primary = false, done = false, disabled = false, title, compact = false }) {
  const [hov, setHov] = useState(false);
  const live = hov && !disabled;
  const base = primary && !done
    ? { background: live ? C.ACCENT_HOVER : C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`,
        boxShadow: live ? C.SHADOW_GLASS_HOVER : C.SHADOW_GLASS }
    : { ...glass({ hover: live, radius: 999 }), color: done ? C.INK_MUTED : C.INK };
  return (
    <button type="button" title={title} aria-pressed={done || undefined} disabled={disabled}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, borderRadius: 999, padding: compact ? "4px 10px" : "6px 14px", minHeight: compact ? 28 : 32,
               fontSize: compact ? 11.5 : 12.5, fontWeight: 800, letterSpacing: "0.02em", whiteSpace: "nowrap",
               display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "inherit",
               cursor: disabled ? "default" : "pointer", opacity: disabled && !done ? 0.6 : 1 }}>
      {label}
    </button>
  );
}

export function SaveButton({ saved, onSave, onUnsave, compact }) {
  // On the Saved list the reversal is its own labelled control, never the same button again.
  if (saved && onUnsave) {
    return <DecisionPill compact={compact} label="Remove" title="Remove from saved" onClick={onUnsave} />;
  }
  return <DecisionPill compact={compact} label={saved ? "Saved" : "Save"} done={saved} disabled={saved}
    title={saved ? "Saved — to reverse it, Undo on the toast, or Remove it from Saved in Database" : "Save for later"}
    onClick={onSave} />;
}

export function PassButton({ passed, onPass, compact }) {
  return <DecisionPill compact={compact} label={passed ? "Passed" : "Pass"} done={passed} disabled={passed}
    title={passed ? "Passed — it won't come back. Undo on the toast to reverse it" : "Pass — it won't come back"}
    onClick={onPass} />;
}

export function DraftButton({ drafted, drafting, onDraft, compact }) {
  return <DecisionPill compact={compact} primary label={drafted ? "Drafted" : drafting ? "Drafting…" : "Draft"}
    done={drafted} disabled={drafted || drafting}
    title={drafted ? "Drafted — it waits for your review on the Draft tab" : "Draft — queue it for your review. Nothing is sent until you approve it."}
    onClick={onDraft} />;
}

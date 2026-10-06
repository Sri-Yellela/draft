// ── The board's decisions (A53), as DEPTH BOXES (D48) ─────────────────────────────────────────────────
//
// Pass · Save · Draft — the deck's three actions, the same calls everywhere. Words, not glyphs (A53).
// ⭐ D48 (owner, 10-07): these were Apple-style pills (fully rounded glass, no depth); interactive controls
// are now depth boxes, through the ONE DepthButton — the orange fill for Draft, D1's rest / hover / press.
// `square` is the posting panel's condensed rendering (an icon square with a tooltip, a caption on touch).
//
// ⛔ Save and Pass SET (owner, 10-02). A decided button shows its state and does nothing when pressed
// again; reversal is Undo on the toast (components/DecisionToast.jsx), or the Saved list's own labelled
// "Remove" — never the same button pressed twice.
import DepthButton, { ICONS } from "./DepthButton.jsx";
import { StampLogo } from "./StampLogo.jsx";
import { draftButtonState } from "../lib/jobDecisions.js";

/** Kept by name for the callers that import it; it is the depth box now. */
export function DecisionPill({ label, onClick, primary = false, done = false, disabled = false, title, compact = false,
                               square = false, icon = null, badge = null, flags = null }) {
  return (
    <DepthButton size={square ? "square" : compact ? "compact" : "box"} primary={primary} pressed={done} disabled={disabled}
      title={title} onClick={onClick} icon={compact ? null : icon} badge={badge} caption={square ? label : null} tip={square ? title : null}
      {...(flags || {})}>
      {label}
    </DepthButton>
  );
}

export function SaveButton({ saved, onSave, onUnsave, compact, square }) {
  // On the Saved list the reversal is its own labelled control, never the same button again.
  if (saved && onUnsave) {
    return <DecisionPill compact={compact} square={square} label="Remove" title="Remove from saved" onClick={onUnsave} />;
  }
  return <DecisionPill compact={compact} square={square} icon={ICONS.save} label={saved ? "Saved" : "Save"} done={saved} disabled={saved}
    title={saved ? "Saved — to reverse it, Undo on the toast, or Remove it from Saved in Database" : "Save for later"}
    onClick={onSave} />;
}

export function PassButton({ passed, onPass, compact, square }) {
  return <DecisionPill compact={compact} square={square} icon={ICONS.pass} label={passed ? "Passed" : "Pass"} done={passed} disabled={passed}
    title={passed ? "Passed — it won't come back. Undo on the toast to reverse it" : "Pass — it won't come back"}
    onClick={onPass} />;
}

/**
 * ⛔ D51: never a dead end. Drafted → "Drafted ✓", which opens Draft House (`onView`); refused → its
 * reason (`block`, lib/jobDecisions.js draftBlock), aria-disabled but answering a press with that reason
 * (`onExplain`) — touch has no tooltip. Only a Draft on the wire is truly disabled.
 */
export function DraftButton({ drafted, drafting, onDraft, onView = null, block = null, onExplain = null,
                              compact, square, badge = null, logo = false }) {
  const s = draftButtonState({ drafted, drafting, block, canView: !!onView });
  const { label, title } = s;
  const onClick = s.action === "draft" ? onDraft : s.action === "view" ? onView
    : s.action === "explain" ? () => onExplain?.(title) : undefined;
  const flags = { "aria-disabled": s.ariaDisabled || undefined, "data-draft-state": s.kind };
  // ⭐ Owner 10-07 (36), the posting panel: the button IS the logo — "/draft", or "/d" as a square — through
  // the ONE StampLogo, so it wears the mark's own tokens (orange and ink in light, all orange in dark). It is
  // therefore not on the orange fill, where the mark would vanish; the word returns only for the states.
  if (logo) {
    const idle = s.kind === "idle";
    return (
      <DepthButton size={square ? "square" : "box"} pressed={drafted} disabled={s.disabled} title={title}
        onClick={onClick} badge={badge} caption={square ? label : null} tip={square ? title : null}
        className="dbx--logo" aria-label={`${label} — ${title}`} data-draft-logo="" {...flags}
        icon={square ? <StampLogo size="md" progress={1} /> : null}>
        {square ? label : idle ? <StampLogo size="mini" /> : label}
      </DepthButton>
    );
  }
  return <DecisionPill compact={compact} square={square} primary
    // The /d mark leads the label (posting-header2.html: "/d  Draft"); a square is the mark alone.
    icon={square ? <span aria-hidden="true">/d</span> : <span aria-hidden="true">/d</span>}
    label={label} badge={badge} done={drafted} disabled={s.disabled} flags={flags}
    title={title} onClick={onClick} />;
}

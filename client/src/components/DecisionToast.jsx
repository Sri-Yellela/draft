// ── The decision toast — "Drafted Northwind — it waits for your review · Undo" (A53) ──────────
//
// ONE component for the deck (Today) and the board (Jobs). It was the deck's own markup; the board
// had no way back from a Save or a Pass except pressing the same button again, which toggled. Owner
// decision, 10-02: Save and Pass SET, and reversal is this — the same label, placement and timing
// on both surfaces. The calls behind Undo live in lib/jobDecisions.js, also shared.
//
// ⛔ A toast must read over anything, so it is the opaque menu surface, not see-through glass.
// ⛔ Centred by margins, not left:50% + translate — that shrink-wraps the toast to HALF the
//    viewport and wrapped it to eight lines on a phone.
// ⛔ 47j w1-market (round 2, D197 Wave 1 #2): both mounts are the plate market (the deck, the Index), so the toast is a plate
// card (`.plate .pl-toast`, plate/plate.css: the card ground, the ink border, the plate shadow, the key a `.pl-kbd`). Its
// words, timing, placement (fixed, centred by margins), Undo, Draft anyway and the refusal are unchanged. The bottom offset
// and the stacking tier stay inline (they are the caller's and the shell's numbers, not a look).
import { AnimatePresence, motion } from "framer-motion";
import { Z } from "../styles/zLayers.js";
import { DECISION_AFTER, DECISION_VERB, lineAfter } from "../lib/jobDecisions.js";

/**
 * @param toast   { decision, company, at, line? } | null — what was just decided; `line` is set
 *                when a Draft waits in line behind a running one (A59)
 * @param onUndo  reverses it (lib/jobDecisions.js undoDecision)
 * @param undoKey the key bound to Undo on this surface, shown beside the label (the deck binds U)
 */
export default function DecisionToast({ toast, onUndo, undoKey = null, bottom = 96, onConfirmNotice = null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key={toast.at} role="status" data-decision-toast className="plate pl-toast"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          style={{ bottom, zIndex: Z.NAV }}>
          {/* ⛔ D51: a REFUSED decision said "Drafted Northwind — it waits for your review · Undo" — the
              board set `error` and this rendered the success sentence over it. A refusal says why, and
              offers no Undo: nothing was done. */}
          {/* A105 finding 12 / D54: a second role at one company — said here, decided here, never a modal. */}
          {toast.notice && (
            <>
              <span data-company-notice-toast="">{toast.notice.replace(/\s*Draft this one too\?$/, "")}</span>
              {onConfirmNotice && (
                <button type="button" className="pl-toast__act" onClick={() => onConfirmNotice(toast)}>Draft anyway</button>
              )}
            </>
          )}
          {!toast.notice && <>
          {toast.error ? (
            <span data-decision-refused=""><strong>Not {DECISION_VERB[toast.decision]?.toLowerCase()}</strong>
              {toast.company ? ` ${toast.company}` : ""} — {toast.error}</span>
          ) : (
            <>
              <span><strong>{DECISION_VERB[toast.decision]}</strong> {toast.company} — {toast.line ? lineAfter(toast.line) : DECISION_AFTER[toast.decision]}</span>
              <button type="button" className="pl-toast__act" onClick={onUndo}>
                Undo {undoKey && <kbd className="pl-kbd">{undoKey}</kbd>}
              </button>
            </>
          )}
          </>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

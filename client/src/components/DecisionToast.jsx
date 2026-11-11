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
import { AnimatePresence, motion } from "framer-motion";
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import { glass } from "../styles/glass.js";
import { DECISION_AFTER, DECISION_VERB, lineAfter } from "../lib/jobDecisions.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const kbd = { fontSize: ts(11), fontWeight: 700, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.BORDER_STRONG}`,
              color: C.INK_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: "16px" };

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
        <motion.div key={toast.at} role="status" data-decision-toast
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          style={{ ...glass({ radius: 16 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
                   position: "fixed", left: 0, right: 0, margin: "0 auto", width: "fit-content", bottom, zIndex: Z.NAV,
                   padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, maxWidth: "calc(100vw - 32px)",
                   fontSize: ts(14), color: C.INK }}>
          {/* ⛔ D51: a REFUSED decision said "Drafted Northwind — it waits for your review · Undo" — the
              board set `error` and this rendered the success sentence over it. A refusal says why, and
              offers no Undo: nothing was done. */}
          {/* A105 finding 12 / D54: a second role at one company — said here, decided here, never a modal. */}
          {toast.notice && (
            <>
              <span data-company-notice-toast="">{toast.notice.replace(/\s*Draft this one too\?$/, "")}</span>
              {onConfirmNotice && (
                <button type="button" onClick={() => onConfirmNotice(toast)} style={{ background: "transparent", border: "none",
                  color: C.ACCENT_INK, fontWeight: 800, cursor: "pointer" }}>Draft anyway</button>
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
              <button type="button" onClick={onUndo} style={{ background: "transparent", border: "none", color: C.ACCENT_INK,
                fontWeight: 800, cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}>
                Undo {undoKey && <span style={kbd}>{undoKey}</span>}
              </button>
            </>
          )}
          </>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

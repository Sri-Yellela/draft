// ⭐ D48 / D50 · THE ATS NUMBER BOX — ONE component (A93). It was built twice in the client: the posting
// header's (inside JobDetailPanel.jsx, styled by JobDetailPanel.css) and D62's ScoreBox (ResumeList),
// "literally the same" thing in two modules. Now every surface draws this one:
//   · the posting header — a BUTTON that opens the ATS card (D39); OPEN is an outline
//   · the ATS panel's header and every résumé row (History, Settings) — READ-ONLY (`readOnly`)
// The number is in the ATS card's own display face; its colour is PP_ATS_NUMBER (the sketch's --atx —
// #A33200 in light, where the logo orange fails as text; the orange in dark), the same value as the ATS
// card's number (PAIR_KICKER), so the two read as one. No score → the dashed box with the bars and NO
// digits: a missing score is "not scored yet" far more often than a decline (A52). Provisional (D50).
// ⚠ The extension's popup draws the same box in its own CSS (extension/ui.css .nb) — it cannot import
// client code; client/src/modules.manifest.js records it as this component's MIRROR.
import { ATS_NUMBER_SHOWN, ATS_NUMBER_NOTE } from "../../../shared/atsBands.js";
import "./AtsNumberBox.css";

const BARS = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V8"/></svg>;

export function AtsNumberBox({ score, tailored = false, base = null, open = false, onOpen, readOnly = false, size = "header", caption = null, title = null }) {
  const has = ATS_NUMBER_SHOWN && Number.isFinite(score);
  // ⭐ D58: the score of the résumé that would be SENT — the tailored one when it exists, marked so.
  const what = has
    ? (tailored ? `Tailored résumé's ATS match ${Math.round(score)}${Number.isFinite(base) ? ` (base résumé ${Math.round(base)})` : ""}` : `ATS match ${Math.round(score)}`)
    : "No ATS score yet";
  const cls = `atsn atsn--${size}${has ? "" : " atsn--none"}${readOnly ? " atsn--static" : ""}`;
  const body = has
    ? (<><b>{Math.round(score)}</b><small>{caption || (tailored ? "tailored" : "ATS")}</small></>)
    : BARS;
  if (readOnly) {
    return (
      <span className={cls} data-ats-box="" data-ats-score={has ? Math.round(score) : ""} role="img"
        aria-label={has ? `${what}. ${ATS_NUMBER_NOTE}` : what} title={title || (has ? `${what} — ${ATS_NUMBER_NOTE}` : what)}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" className={cls} data-ats-box="" data-ats-tailored={has && tailored ? "true" : undefined} aria-expanded={open}
      onClick={() => onOpen?.()}
      title={has ? `${what} — ${ATS_NUMBER_NOTE}` : "No ATS score yet — open the ATS card to score this posting"}
      aria-label={has ? `${what}. ${ATS_NUMBER_NOTE}. Open the ATS card` : "No ATS score yet. Open the ATS card"}>
      {body}
    </button>
  );
}

export default AtsNumberBox;

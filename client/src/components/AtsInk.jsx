// client/src/components/AtsInk.jsx — ⭐ 46x (owner 11-19: "the font color on the ats number should do it no need for the
// words", then "yes switch the held panel rows to colour too") · AN ATS NUMBER PAINTED BY ITS BAND, inline, in a sentence.
// The one implementation (A93): the contextual section's numbers and bars (ContextualFit.jsx) and Home's held rows
// (AutoApplyPanel) draw it. The colour is styles/bandStyle.js's (tokens); the cutpoints are shared/atsBands.js's.
//   <AtsInk score={64} />                 → "64%" in the Strong colour
//   <AtsInk score={null} band="strong" /> a row stored before its number was kept: the band's colour on a dot, its
//                                         word only as the accessible name (never printed)
//   <AtsInk score={null} />               → "not scored yet" (the absence of a number is said in words — it is not a number)
import { atsBandFor, atsBandLabel, ATS_BAND } from "../../../shared/atsBands.js";
import { bandStyle } from "../styles/bandStyle.js";

/** The ink of a score (its band's foreground colour). A null score paints as Not enough signal. */
export const atsInk = (score) => bandStyle(atsBandFor(Number.isFinite(score) ? score : null)).fg;

export function AtsInk({ score = null, band = null, suffix = "%" }) {
  if (Number.isFinite(score)) {
    const b = atsBandFor(score);
    return (
      <span data-ats-ink={b} title={`ATS match ${Math.round(score)} — ${atsBandLabel(b).label}`}
        style={{ color: atsInk(score), fontWeight: 700 }}>{Math.round(score)}{suffix}</span>
    );
  }
  if (band && band !== ATS_BAND.NOT_ENOUGH_SIGNAL && bandStyle(band)) {
    return (
      <span data-ats-ink={band} role="img" aria-label={atsBandLabel(band).label} title={atsBandLabel(band).label}
        style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: bandStyle(band).fg, verticalAlign: "middle" }} />
    );
  }
  return <span data-ats-ink="none">not scored yet</span>;
}

export default AtsInk;

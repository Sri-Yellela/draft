// ⭐ D196 P1 · THE BEARING AS A PRINTED CARTOUCHE — D184 B-7's sentence filter in the board's cartouche (strip, the serif
// sentence, its dashed italic parts as buttons, All filters beneath). The market board: "CARTOUCHE · THE BEARING".
// ⛔ R6: the SAME sentence and the SAME controls as components/BoardHeadline.jsx — one projection of the filter params
// (sentenceParts, D30), the same id (fh-sentence) and data-slot per word, aria-pressed (a choice is held) / aria-expanded
// (its panel is open) / aria-controls (fh-panel), the same press (onToggle → nextBoardPanel), and All filters with its id.
// Only the look changes. WordPanel still opens beneath it (App.jsx BoardHeadlineSlot).
// Not drawn from the board: "FROM MAYA_CHEN.PDF · NOV 8" and "Back to my résumé's bearing" — the slot has no résumé file
// name or reset action to show (nothing invented); they join when the board publishes them.
import { Fragment } from "react";
import PlateRoot from "./PlateRoot.jsx";
import { Icon } from "./icons.jsx";
import { sentenceParts } from "../lib/filterSentenceModel.js";
import { SENTENCE_ID, PANEL_ID, ALL_FILTERS_ID } from "../components/BoardHeadline.jsx";

export default function PlateBearing({ params = {}, defaultDomain = null, nothingMatches = false, open = null, onToggle, allOpen = false, onAll, allSlot }) {
  const { verb, slots } = sentenceParts(params, { defaultDomain, nothingMatches });
  return (
    <PlateRoot className="pl-bearing" data-plate-bearing="">
      <div className="pl-cartouche">
        <div className="pl-cartouche__strip"><span className="pl-label">CARTOUCHE · THE BEARING</span>
          <span className="pl-label pl-muted">SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE</span></div>
        <h1 className="pl-cartouche__text" id={SENTENCE_ID} data-board-headline="" data-nothing-matches={nothingMatches ? "true" : "false"}>
          <span>{verb}</span>
          {slots.map((s) => {
            const expanded = open === s.key;
            return (
              <Fragment key={s.key}>
                {s.lead}
                <button type="button" className="pl-cartouche__part" data-slot={s.key}
                  aria-pressed={s.active || !!s.clause.floor} aria-expanded={expanded} aria-controls={expanded ? PANEL_ID : undefined}
                  title={`${s.clause.label} — ${expanded ? "close its options" : "change it"}`}
                  onClick={() => onToggle?.(s.key)}>{s.text}</button>
                {s.noun ? ` ${s.noun}` : ""}
              </Fragment>
            );
          })}
          .
        </h1>
        <div className="pl-cartouche__actions">
          <button type="button" className="pl-btn" id={ALL_FILTERS_ID} data-slot={allSlot} aria-expanded={allOpen}
            aria-controls={allOpen ? PANEL_ID : undefined} onClick={onAll}><Icon name="filters"/>All filters</button>
        </div>
      </div>
    </PlateRoot>
  );
}

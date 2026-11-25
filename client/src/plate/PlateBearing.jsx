// ⭐ D196 P1 · THE BEARING AS A PRINTED CARTOUCHE — D184 B-7's sentence filter in the board's cartouche (strip, the serif
// sentence, its dashed italic parts as buttons, All filters beneath). The market board: "CARTOUCHE · THE BEARING".
// ⛔ R6: the SAME sentence and the SAME controls as components/BoardHeadline.jsx — one projection of the filter params
// (sentenceParts, D30), the same id (fh-sentence) and data-slot per word, aria-pressed (a choice is held) / aria-expanded
// (its panel is open) / aria-controls (fh-panel), the same press (onToggle → nextBoardPanel), and All filters with its id.
// Only the look changes. WordPanel still opens beneath it (App.jsx BoardHeadlineSlot).
// "FROM MAYA_CHEN.PDF · NOV 8" (47h): the active profile's résumé file and the day it was set (`from`, App reads
// /api/base-resume); unknown → the strip keeps "SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE". Not drawn yet: "Back to my
// résumé's bearing" — the board has no reset action to call (nothing invented).
import { Fragment } from "react";
import PlateRoot from "./PlateRoot.jsx";
import { Icon } from "./icons.jsx";
import { sentenceParts } from "../lib/filterSentenceModel.js";
import { SENTENCE_ID, PANEL_ID, ALL_FILTERS_ID } from "../components/BoardHeadline.jsx";

/** Pure: the strip's "FROM file · MON D" from the résumé's name and its set time (unix seconds) — null when no name. */
export function fromWords(from) {
  const name = String(from?.name || "").trim();
  if (!name) return null;
  const at = Number(from?.at);
  const day = from?.at != null && Number.isFinite(at) && at > 0
    ? new Date(at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase() : null;
  return `FROM ${name.toUpperCase()}${day ? ` · ${day}` : ""}`;
}

// ⭐ D199 C2 (47h): `children` = the market's controls (search + sort, the filter chips, the open panel, the stats box), drawn
// INSIDE the cartouche under the sentence (the `Market` board); with them, All filters moves into the chips row.
export default function PlateBearing({ params = {}, defaultDomain = null, nothingMatches = false, open = null, onToggle, allOpen = false, onAll, allSlot, from = null, children = null }) {
  const { verb, slots } = sentenceParts(params, { defaultDomain, nothingMatches });
  return (
    <PlateRoot className="pl-bearing" data-plate-bearing="">
      <div className="pl-cartouche">
        <div className="pl-cartouche__strip"><span className="pl-label">CARTOUCHE · THE BEARING</span>
          <span className="pl-label pl-muted" data-bearing-from={fromWords(from) ? "" : undefined}>{fromWords(from) || (children ? "FROM YOUR RÉSUMÉ · YOURS TO CHANGE" : "SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE")}</span></div>
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
        {children ? <div className="pl-cartouche__controls" data-market-controls="">{children}</div> : null}
        {children ? null : <div className="pl-cartouche__actions">
          <button type="button" className="pl-btn" id={ALL_FILTERS_ID} data-slot={allSlot} aria-expanded={allOpen}
            aria-controls={allOpen ? PANEL_ID : undefined} onClick={onAll}><Icon name="filters"/>All filters</button>
        </div>}
      </div>
    </PlateRoot>
  );
}

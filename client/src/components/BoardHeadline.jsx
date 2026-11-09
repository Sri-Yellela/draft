import { Fragment } from "react";
import { sentenceParts } from "../lib/filterSentenceModel.js";
import "../styles/type.js";
import "./FullHouse.css";

// ── D26 + D30 + D35 · THE SENTENCE IS THE HEADLINE, AND ITS WORDS ARE THE CONTROLS ─────────────────
//
//   discovering [all] roles at [all] career levels and [all] workstyles in [the United States].   (D37)
//
// ⛔ A PROJECTION OF FILTER STATE, NEVER A SECOND SOURCE OF TRUTH (D30) — sentenceParts derives it from
// the same params the panels set.
// ⭐ D35 · each filter word is a BUTTON that opens its options in the ONE panel beneath the sentence;
// pressing the same word again closes it (the caller resolves the press with nextBoardPanel, so only
// one panel is ever open). TWO SIGNALS, two attributes, and a word can carry both:
//   aria-pressed  ACTIVE — the clause holds a choice (the orange fill). Location is always pressed:
//                 the United States is a filter that is always on — the floor (header.html draws it so).
//   aria-expanded OPEN — its panel is showing (the outline).
// ⛔ D34 · ONE FAMILY, ONE SIZE, ONE LINE-HEIGHT: the tokens are lettered exactly like the prose around
// them (FullHouse.css: `font: inherit`); only the box says which words are controls.
// ⛔ D42 (owner, 10-06): `+ add` LEFT THE SENTENCE — what can still be added is listed inside the panel
// any word opens (WordPanel's "Add a filter" row).
//
// Pure: no hooks, so a test can call it and press its buttons directly.
//
// Props: params, defaultDomain, nothingMatches, open (the board's one panel value), onToggle(key)
export const SENTENCE_ID = "fh-sentence";
export const PANEL_ID = "fh-panel";
export const ALL_FILTERS_ID = "fh-all-filters";   // A146: the word after the sentence

export default function BoardHeadline({ params = {}, defaultDomain = null, nothingMatches = false, open = null, onToggle }) {
  const { verb, slots } = sentenceParts(params, { defaultDomain, nothingMatches });
  return (
    <h1 className="bh" id={SENTENCE_ID} data-board-headline data-nothing-matches={nothingMatches ? "true" : "false"}>
      <span className="bh__verb">{verb}</span>
      {slots.map((s) => {
        const expanded = open === s.key;
        // D37: the connective before the token and the noun after it are prose; only the token is a control.
        return (
          <Fragment key={s.key}>
            {s.lead}
            <button type="button" className="tok" data-slot={s.key}
              aria-pressed={s.active || !!s.clause.floor}
              aria-expanded={expanded}
              aria-controls={expanded ? PANEL_ID : undefined}
              title={`${s.clause.label} — ${expanded ? "close its options" : "change it"}`}
              onClick={() => onToggle?.(s.key)}>
              {s.text}
            </button>
            {s.noun ? ` ${s.noun}` : ""}
          </Fragment>
        );
      })}
      {/* ⭐ A145 (45o): "using [Go]" is now a clause of its own (shared/filterSentence.js `tech`) — it opens its picker
          like every other word (45l's press-to-clear token is gone). */}
      .
    </h1>
  );
}

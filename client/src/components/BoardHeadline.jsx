import { Fragment } from "react";
import { sentenceParts, BOARD_PANEL, isWordPanel } from "../lib/filterSentenceModel.js";
import "../styles/type.js";
import "./FullHouse.css";

// ── D26 + D30 + D35 · THE SENTENCE IS THE HEADLINE, AND ITS WORDS ARE THE CONTROLS ─────────────────
//
//   Now showing [all] jobs, at [senior level], [in the United States], [any workplace]. [+ add]
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
// `+ add` (dashed, shadowless) opens the panel of what can still be added; it reads open while that
// panel — or the panel of an optional clause not yet in the sentence — is showing.
//
// Pure: no hooks, so a test can call it and press its buttons directly.
//
// Props: params, defaultDomain, nothingMatches, open (the board's one panel value), onToggle(key)
export const SENTENCE_ID = "fh-sentence";
export const PANEL_ID = "fh-panel";

export default function BoardHeadline({ params = {}, defaultDomain = null, nothingMatches = false, open = null, onToggle }) {
  const { verb, slots } = sentenceParts(params, { defaultDomain, nothingMatches });
  const addOpen = open === BOARD_PANEL.MORE || (isWordPanel(open) && !slots.some(s => s.key === open));
  return (
    <h1 className="bh" id={SENTENCE_ID} data-board-headline data-nothing-matches={nothingMatches ? "true" : "false"}>
      <span className="bh__verb">{verb}</span>{" "}
      {slots.map((s, i) => {
        const expanded = open === s.key;
        return (
          <Fragment key={s.key}>
            {i > 0 ? ", " : ""}
            {s.key === "level" ? "at " : ""}
            <button type="button" className="tok" data-slot={s.key}
              aria-pressed={s.active || !!s.clause.floor}
              aria-expanded={expanded}
              aria-controls={expanded ? PANEL_ID : undefined}
              title={`${s.clause.label} — ${expanded ? "close its options" : "change it"}`}
              onClick={() => onToggle?.(s.key)}>
              {s.key === "level" && s.text.startsWith("at ") ? s.text.slice(3) : s.text}
            </button>
            {i === 0 ? " jobs" : ""}
          </Fragment>
        );
      })}
      .{" "}
      <button type="button" className="tok tok--add" data-slot={BOARD_PANEL.MORE}
        aria-expanded={addOpen} aria-controls={addOpen ? PANEL_ID : undefined}
        title="Add a filter"
        onClick={() => onToggle?.(addOpen ? open : BOARD_PANEL.MORE)}>
        + add
      </button>
    </h1>
  );
}

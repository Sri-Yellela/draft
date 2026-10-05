import { Fragment } from "react";
import { sentenceParts } from "../lib/filterSentenceModel.js";
import "./BoardPanels.css";

// ── D26 + D30 · THE SENTENCE IS THE HEADLINE ────────────────────────────────────────────────────────
//
// It replaces the "Let's get to work." caption: the thing you are looking at becomes the page's title.
//
//   Now showing all jobs, at any level, in the United States, any workplace.
//
// ⛔ A PROJECTION OF DIAL STATE, NEVER A SECOND SOURCE OF TRUTH — sentenceParts derives it from the
// same params the dials set. Each slot is a button that opens the filter panel on ITS dial.
// ⛔ NOTHING MATCHES keeps the same clauses with a different verb, so the reader can see which one to
// loosen, instead of an empty board under a generic message.
//
// Props: params, defaultDomain, nothingMatches, onSlot(key)
export default function BoardHeadline({ params = {}, defaultDomain = null, nothingMatches = false, onSlot }) {
  const { verb, slots } = sentenceParts(params, { defaultDomain, nothingMatches });
  return (
    <h1 className="bh" data-board-headline data-nothing-matches={nothingMatches ? "true" : "false"} aria-live="polite">
      <span className="bh__verb">{verb}</span>{" "}
      {slots.map((s, i) => (
        <Fragment key={s.key}>
          {i === 1 ? ", " : i > 1 ? ", " : ""}
          {s.key === "level" ? "at " : ""}
          <button type="button" className="bh__slot" data-slot={s.key} data-active={s.active ? "true" : "false"}
            title={`Change ${s.clause.label.toLowerCase()}`}
            onClick={() => onSlot?.(s.key)}>
            {s.key === "level" && s.text.startsWith("at ") ? s.text.slice(3) : s.text}
          </button>
          {i === 0 ? " jobs" : ""}
        </Fragment>
      ))}
      .
    </h1>
  );
}

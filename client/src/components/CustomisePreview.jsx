// D93 · THE CUSTOMISE PREVIEW — the navigation, the filter sentence and the bar, drawn with the REAL stylesheets
// (AppNav.css, FullHouse.css) and carrying its OWN layout attributes (data-navigation, data-sentence, data-text-size). The styles read
// those attributes through custom properties that inherit from the nearest carrier, so this box shows the
// choice being made while the page around it — and <html> — keep the old one until you leave.
//
// A picture, not controls: aria-hidden and inert, so nothing in it is focusable or announced.
//   part   "all" (the live preview) · "navigation" · "sentence" · "text" — the option cards
//   values { navigation, sentence, text, … } — the layout to draw
import { useEffect, useRef } from "react";
import { LAYOUT_OPTION_IDS } from "../../../shared/appearance.js";
import { StampLogo } from "./StampLogo.jsx";
import "../styles/type.js";
import "./AppNav.css";
import { ts } from "../themes/shapes.js";
import "./FullHouse.css";

// ⭐ D145 · the Navigation option's picture: the bar with its Menu button, and the Dock under it — drawn with AppNav's
// real classes, so the carrier's data-navigation decides which of the two shows (as it does in the app).
const NAV = [["Daily Deck", "today's jobs"], ["Full House", "every job"], ["Home", "in progress"], ["The Table", "applied"], ["Atlas", "your skills"]];

function Navigation() {
  return (
    <div className="cz-pv__nav">
      <div className="cz-pv__bar">
        <StampLogo size="nav" />
        <span style={{ flex: 1 }} />
        <span className="appnav-menu-btn">Menu</span>
      </div>
      <div className="appnav-dock cz-pv__dock">
        {NAV.map(([n, p], i) => (
          <span key={n} className="appnav-item" aria-current={i === 0 ? "page" : undefined}>
            <span className="appnav-name">{n}</span><small className="appnav-plain">{p}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

// ⭐ D145 · the Text size option's picture: a card's title, a figure and a line of body text, in the scaled sizes.
function TextSample() {
  return (
    <div className="cz-pv__text">
      <div style={{ fontFamily: "var(--font-display)", fontSize: ts(30), lineHeight: 1.05 }}>Senior Data Engineer</div>
      <div style={{ color: "var(--c-accent-ink)", fontSize: ts(26), fontWeight: 500, marginTop: 6 }}>13 of 15</div>
      <div style={{ color: "var(--c-ink-muted)", fontSize: ts(15), marginTop: 4 }}>must-haves your résumé shows</div>
    </div>
  );
}

function Sentence() {
  return (
    <h2 className="bh">
      <span className="bh__verb">discovering</span> <span className="tok">all</span> roles at <span className="tok">all</span> career
      levels in <span className="tok" aria-pressed="true">the United States</span>.
    </h2>
  );
}

function Bar() {
  return (
    <div className="fh-bar">
      <div className="fh-views">
        <button type="button" tabIndex={-1} aria-pressed="true">ALL <em className="fh-ct">454</em></button>
        <button type="button" tabIndex={-1}>★ <em className="fh-ct">3</em></button>
        <button type="button" tabIndex={-1}>/d <em className="fh-ct">6</em></button>
      </div>
      <div className="fh-srch">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" /></svg>
        <span className="cz-pv__ph">Job title, company, or anything…</span>
      </div>
      <span className="fh-ico">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3" /></svg>
      </span>
    </div>
  );
}

export default function CustomisePreview({ part = "all", values }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.setAttribute("inert", ""); }, []);
  const attrs = Object.fromEntries(Object.entries(LAYOUT_OPTION_IDS).map(([k, o]) => [o.attribute, values?.[k] || o.default]));
  return (
    <div ref={ref} aria-hidden="true" className="cz-pv" data-part={part} data-customise-preview={part} {...attrs}>
      {(part === "all" || part === "navigation") && <Navigation />}
      {part === "text" && <TextSample />}
      {(part === "all" || part === "sentence") && (
        <div className="fh cz-pv__fh">
          <Sentence />
          {part === "all" && <Bar />}
        </div>
      )}
    </div>
  );
}

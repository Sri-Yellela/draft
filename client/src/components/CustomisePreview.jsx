// D93 · THE CUSTOMISE PREVIEW — the top bar, the filter sentence and the bar, drawn with the REAL stylesheets
// (TopBar.css, FullHouse.css) and carrying its OWN layout attributes (data-nav, data-sentence). The styles read
// those attributes through custom properties that inherit from the nearest carrier, so this box shows the
// choice being made while the page around it — and <html> — keep the old one until you leave.
//
// A picture, not controls: aria-hidden and inert, so nothing in it is focusable or announced.
//   part   "all" (the live preview) · "nav" (just the tab row) · "sentence" (just the sentence) — the option cards
//   values { nav, sentence } — the layout to draw
import { useEffect, useRef } from "react";
import { LAYOUT_OPTION_IDS } from "../../../shared/appearance.js";
import { StampLogo } from "./StampLogo.jsx";
import "../styles/type.js";
import "./TopBar.css";
import "./FullHouse.css";

const TABS = [["Daily", "Deck"], ["Full", "House"], ["Draft", "House"], ["The", "Table"]];

// The real bar's width tiers (TopBar.jsx: narrow < 560, tiny < 440), read once — the preview is a picture of
// the bar on THIS screen.
const sizeFor = (w) => (w < 440 ? "tiny" : w < 560 ? "narrow" : "wide");

function TabRow() {
  const size = sizeFor(typeof window !== "undefined" ? window.innerWidth : 1280);
  return (
    <div className="cz-pv__bar">
      <StampLogo size="nav" />
      <div className="tbar-group">
        <div className="tbar-nav" data-size={size} data-overflow="false">
          {TABS.map(([a, b], i) => (
            <span key={a + b} className="tbar-tab" aria-current={i === 1 ? "page" : undefined}>{a}<br />{b}</span>
          ))}
        </div>
      </div>
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
      {(part === "all" || part === "nav") && <TabRow />}
      {(part === "all" || part === "sentence") && (
        <div className="fh cz-pv__fh">
          <Sentence />
          {part === "all" && <Bar />}
        </div>
      )}
    </div>
  );
}

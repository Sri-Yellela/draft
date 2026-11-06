// client/src/pages/atlas/AtlasNav.jsx — ⭐ D167 (owner APPROVED 11-06, docs/sketches/Atlas.html) · ATLAS'S OWN NAVIGATION:
// a card beside the site's dock — the accent eyebrow "Your way through the market", "Atlas" as a serif headline — and
// three groups of panels (atlasPanels.js ATLAS_NAV): You · Grow · Explore. Every entry is a real link to the panel's
// address (/atlas/<panel>), so it works with the keyboard (Tab, Enter), the back button and a reload; the current one
// carries aria-current="page". ↑ / ↓ (and Home / End) move between entries inside the card.
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ATLAS_NAV, panelHref } from "./atlasPanels.js";
import "./AtlasNav.css";

export default function AtlasNav({ base, current }) {
  const ref = useRef(null);
  const onKeyDown = (e) => {
    const keys = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" };
    if (!(e.key in keys)) return;
    const links = [...(ref.current?.querySelectorAll("a[data-atlas-nav]") || [])];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const k = keys[e.key];
    const to = k === "first" ? 0 : k === "last" ? links.length - 1 : (i + k + links.length) % links.length;
    links[to]?.focus();
  };
  return (
    <nav className="atl-anav" aria-label="Atlas" data-atlas-nav-card="" ref={ref} onKeyDown={onKeyDown}>
      <p className="atl-anav__eb">Your way through the market</p>
      <p className="atl-anav__title">Atlas</p>
      {ATLAS_NAV.map(g => (
        <div key={g.group} className="atl-anav__group" data-atlas-nav-group={g.group}>
          <h2 className="atl-anav__h" id={`atl-anav-${g.group}`}>{g.group}</h2>
          <ul className="atl-anav__list" aria-labelledby={`atl-anav-${g.group}`}>
            {g.panels.map(p => (
              <li key={p.id}>
                <Link to={panelHref(base, p.id)} className="atl-anav__item" data-atlas-nav={p.id}
                  aria-current={current === p.id ? "page" : undefined}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

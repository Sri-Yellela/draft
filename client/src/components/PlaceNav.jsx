// ⭐ D167 (owner 11-06) · A PLACE WITH ITS OWN NAVIGATION — the pattern the owner approved for Atlas, Profile and
// Interview (docs/sketches/Atlas.html · Profile.html · Interview.html): a nav card beside the site's dock (an accent
// eyebrow, the place's name as a serif headline, its panels in labelled groups) and one panel beside it, the two as one
// centred group (D163). Each panel opens at its own address (`hrefFor`), so a panel is a link — middle-click, Back and a
// shared URL all work — and the current one carries aria-current="page".
//
// Built ONCE for every place (A93): a page passes its groups and renders the current panel as children; PlaceHead is the
// panel's own eyebrow + headline + lead. Tokens only; no capsule (D60) — the items are 12 px-cornered rows.
// ⭐ A136: Atlas's card is this one too (its own AtlasNav.jsx was a second implementation): ↑ / ↓ (wrapping) and Home / End
// move focus between the card's links, for every place. `fill`: the place sits inside a page that already pads it, and
// its panel takes the rest of the width (Atlas's map is wider than a settings panel).
import { createContext, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import "./PlaceNav.css";

const MOVE = { ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" };

// ⭐ D182 (45n, owner 11-08) · the panel's eyebrow never repeats the nav: the card beside it already shows the current
// item (and its group) in bold, so a PlaceHead / Atlas PanelHead eyebrow equal to either is not drawn.
const PlaceCurrent = createContext(null);
const norm = (s) => String(s || "").trim().toLowerCase();
/** true when `eyebrow` only repeats the current nav item's label or its group's label. */
export function useRepeatsNav(eyebrow) {
  const cur = useContext(PlaceCurrent);
  return !!cur && !!eyebrow && (norm(eyebrow) === norm(cur.label) || norm(eyebrow) === norm(cur.group));
}

/** The nav card + the panel. `groups`: [{ label, items: [{ id, label, meta? }] }]. ⭐ 47j w1-shell: `nav={false}` draws the
 *  panel alone — for a place whose navigation is the shell's area nav (Atlas in the app, D197 #5), so the card would be a
 *  second copy of the same places. With no card beside it, a panel's eyebrow is drawn (nothing repeats it). */
export default function PlaceNav({ name, eyebrow, title, groups, current, hrefFor, children, place, fill = false, panelId, nav = true }) {
  const ref = useRef(null);
  const onKeyDown = (e) => {
    if (!(e.key in MOVE)) return;
    const links = [...(ref.current?.querySelectorAll("a[data-place-item]") || [])];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const k = MOVE[e.key];
    links[k === "first" ? 0 : k === "last" ? links.length - 1 : (i + k + links.length) % links.length]?.focus();
  };
  const group = groups.find((g) => g.items.some((i) => i.id === current));
  const here = { label: labelOf(groups, current), group: group?.label || "" };
  if (!nav) return (
    <div className={fill ? "pl pl--fill pl--bare" : "pl pl--bare"} data-place={place || name}>
      <section className="pl__panel" data-place-panel={current} key={current} id={panelId} aria-label={here.label || title}>
        {children}
      </section>
    </div>
  );
  return (
    <div className={fill ? "pl pl--fill" : "pl"} data-place={place || name}>
      <aside className="pl__nav" aria-label={name || title} data-place-nav="" ref={ref} onKeyDown={onKeyDown}>
        {eyebrow && <p className="pl__eb">{eyebrow}</p>}
        <h1 className="pl__title">{title}</h1>
        {groups.map((g) => (
          <div key={g.label} className="pl__group" role="group" aria-label={g.label}>
            <h2 className="pl__glabel">{g.label}</h2>
            {g.items.map((it) => (
              <Link key={it.id} to={hrefFor(it.id)} className="pl__item" data-place-item={it.id}
                aria-current={it.id === current ? "page" : undefined}>
                <span>{it.label}</span>
                {it.meta != null && it.meta !== "" && <small className="pl__meta" data-place-meta={it.id}>{it.meta}</small>}
              </Link>
            ))}
          </div>
        ))}
      </aside>
      <section className="pl__panel" data-place-panel={current} key={current} id={panelId} aria-label={here.label}>
        <PlaceCurrent.Provider value={here}>{children}</PlaceCurrent.Provider>
      </section>
    </div>
  );
}

const labelOf = (groups, id) => groups.flatMap((g) => g.items).find((i) => i.id === id)?.label || "";

/** A panel's head: the accent eyebrow, the headline, one line of lead (any of them optional). */
export function PlaceHead({ eyebrow, title, lead }) {
  const repeats = useRepeatsNav(eyebrow);
  return (
    <header className="pl__head" data-place-head="">
      {eyebrow && !repeats && <p className="pl__peb">{eyebrow}</p>}
      {title && <h2 className="pl__h">{title}</h2>}
      {lead && <p className="pl__lead">{lead}</p>}
    </header>
  );
}

// ⭐ D167 (owner 11-06) · A PLACE WITH ITS OWN NAVIGATION — the pattern the owner approved for Atlas, Profile and
// Interview (docs/sketches/Atlas.html · Profile.html · Interview.html): a nav card beside the site's dock (an accent
// eyebrow, the place's name as a serif headline, its panels in labelled groups) and one panel beside it, the two as one
// centred group (D163). Each panel opens at its own address (`hrefFor`), so a panel is a link — middle-click, Back and a
// shared URL all work — and the current one carries aria-current="page".
//
// Built ONCE for every place (A93): a page passes its groups and renders the current panel as children; PlaceHead is the
// panel's own eyebrow + headline + lead. Tokens only; no capsule (D60) — the items are 12 px-cornered rows.
import { Link } from "react-router-dom";
import "./PlaceNav.css";

/** The nav card + the panel. `groups`: [{ label, items: [{ id, label, meta? }] }]. */
export default function PlaceNav({ name, eyebrow, title, groups, current, hrefFor, children, place }) {
  return (
    <div className="pl" data-place={place || name}>
      <aside className="pl__nav" aria-label={name || title} data-place-nav="">
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
      <section className="pl__panel" data-place-panel={current} key={current} aria-label={labelOf(groups, current)}>
        {children}
      </section>
    </div>
  );
}

const labelOf = (groups, id) => groups.flatMap((g) => g.items).find((i) => i.id === id)?.label || "";

/** A panel's head: the accent eyebrow, the headline, one line of lead (any of them optional). */
export function PlaceHead({ eyebrow, title, lead }) {
  return (
    <header className="pl__head" data-place-head="">
      {eyebrow && <p className="pl__peb">{eyebrow}</p>}
      {title && <h2 className="pl__h">{title}</h2>}
      {lead && <p className="pl__lead">{lead}</p>}
    </header>
  );
}

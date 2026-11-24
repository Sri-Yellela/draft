// ⭐ D196 F3 · cards: the field card (why an opening fits — D192's Lines up / Doesn't, yet), the side panel, the catalogue
// card (a primary source) and the field-note card (a harvested reel). The boards' / the report's anatomy in plate classes.
import { plateState, NoData } from "./PlateState.jsx";
import { Stamp } from "./Marks.jsx";

/**
 * The field card. `alike` = lines that line up (lit squares), `gaps` = [{ text, link: { label, href } }] (dashed squares),
 * `figures` = { label, value } (D192's contextual parts, e.g. "ROLE FIT · STACK · DUTIES" / "88 · 75 · 72").
 * partial: a list with no data says so; nothing is invented.
 */
export function FieldCard({ kicker = "FIELD CARD · WHY IT FITS", note = "NO AI", alike = [], gaps = [], figures, className = "", ...s }) {
  const gate = plateState(s, { height: 300, radius: "plate", label: "Loading why it fits", lines: 4 });
  if (gate) return gate;
  return (
    <aside className={`pl-card pl-fieldcard ${className}`.trim()} aria-label="Why this opening fits you">
      <div className="pl-card__strip"><span className="pl-label">{kicker}</span>{note ? <span className="pl-label pl-muted">{note}</span> : null}</div>
      <div className="pl-card__body">
        <div className="pl-card__group">
          <span className="pl-label pl-tone-lit">LINES UP</span>
          {alike.length ? alike.map((a, i) => <div key={i} className="pl-card__item"><span aria-hidden="true" className="pl-card__mark"/><span>{a}</span></div>) : <NoData/>}
        </div>
        <div className="pl-card__rule"/>
        <div className="pl-card__group">
          <span className="pl-label pl-tone-clay">DOESN’T, YET</span>
          {gaps.length ? gaps.map((g, i) => (
            <div key={i} className="pl-card__item"><span aria-hidden="true" className="pl-card__mark" data-yet=""/>
              <span>{g.text}{g.link ? <a href={g.link.href} style={{ display: "block", fontWeight: 700 }}>{g.link.label}</a> : null}</span></div>
          )) : <NoData>NOTHING MISSING</NoData>}
        </div>
        {figures ? <>
          <div className="pl-card__rule"/>
          <div className="pl-card__foot"><span className="pl-label pl-muted">{figures.label}</span><span className="pl-card__num">{figures.value ?? "—"}</span></div>
        </> : null}
      </div>
    </aside>
  );
}

/** A side panel: a strip, then label / value rows (the ledger's "Filled for you"). Values are never guessed. */
export function FactSheet({ kicker, rows = [], foot, label, ...s }) {
  const gate = plateState(s, { height: 260, radius: "plate", label: "Loading", lines: 4 });
  if (gate) return gate;
  return (
    <aside className="pl-card pl-fieldcard" aria-label={label || kicker}>
      <div className="pl-card__strip"><span className="pl-label">{kicker}</span></div>
      <div className="pl-card__body" style={{ gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} className="pl-card__item" style={{ justifyContent: "space-between", gap: 10, borderBottom: "var(--pl-border-rule)", paddingBottom: 7 }}>
            <span className="pl-muted">{r.label}</span>{r.value == null ? <NoData/> : <b style={{ textAlign: "right" }}>{r.value}</b>}
          </div>
        ))}
        {foot ? <span className="pl-muted" style={{ fontSize: "var(--pl-t-tiny)" }}>{foot}</span> : null}
      </div>
    </aside>
  );
}

/** A catalogue card — a primary source: call number tag, serif title, mono authors, punch hole; EXPLAINED when marked. */
export function CatalogueCard({ call, title, authors, href, explained = false, onToggle, ...s }) {
  const gate = plateState(s, { height: 150, radius: "card", label: "Loading the source" });
  if (gate) return gate;
  return (
    <div className="pl-catalogue">
      <span aria-hidden="true" className="pl-catalogue__hole"/>
      {call ? <span className="pl-catalogue__call">{call}</span> : null}
      {href ? <a className="pl-catalogue__title" href={href} style={{ color: "var(--pl-ink)" }}>{title}</a> : <span className="pl-catalogue__title">{title}</span>}
      {authors ? <span className="pl-catalogue__authors">{authors}</span> : null}
      {onToggle ? <button type="button" className="pl-btn" aria-pressed={explained} onClick={onToggle} style={{ alignSelf: "flex-start" }}>{explained ? "Explained" : "Mark as explained"}</button> : null}
      {explained ? <Stamp tone="lit" rotate={-6}>EXPLAINED</Stamp> : null}
    </div>
  );
}

/** A field-note card: a dark 9:16 poster (kicker, duration, the highlighted phrase, progress) + the FN label strip. */
export function FieldNoteCard({ code, kicker, duration, text, highlight, progress = 0, views, href, ...s }) {
  const gate = plateState(s, { height: 380, radius: "q", label: "Loading the field note" });
  if (gate) return gate;
  const parts = highlight && text?.includes(highlight) ? text.split(highlight) : [text];
  const Tag = href ? "a" : "div";
  return (
    <Tag className="pl-fieldnote pl-lift" href={href}>
      <div className="pl-fieldnote__poster">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span className="pl-label pl-tone-on">{kicker}</span>{duration ? <span className="pl-label pl-tone-on">{duration}</span> : null}
        </div>
        <span className="pl-fieldnote__text">{parts.length === 2 ? <>{parts[0]}<span className="pl-fieldnote__hi">{highlight}</span>{parts[1]}</> : text}</span>
        <div className="pl-fieldnote__bar" role="img" aria-label={`${Math.round(progress * 100)}% watched`}><span style={{ width: `${Math.round(progress * 100)}%` }}/></div>
      </div>
      <div className="pl-fieldnote__strip"><span className="pl-label">{code}</span>{views ? <span className="pl-label pl-muted">{views}</span> : null}</div>
    </Tag>
  );
}

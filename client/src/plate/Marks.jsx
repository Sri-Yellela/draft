// ⭐ D196 F3 · the small marks: lit squares, the stamp, a status tag, the letter tile, a stack chip, the breadcrumb chain,
// filter chips, the kicker row. Each is the boards' markup in plate classes; colour is never the only signal (R5).
import { plateState, NoData } from "./PlateState.jsx";

/**
 * Lit squares — proof, never progress for opening a page. `squares` = ["lit" | "today" | "underway" | "needs" | "ahead" | "ink" | null].
 * size 10 / 12 / 14 / 16. `label` says what they count (it is the only thing a screen reader hears).
 */
export function LitSquares({ squares = [], size = 12, label, pop = false, ...s }) {
  const gate = plateState(s, { height: 28, radius: "tag", lines: 1, label: "Loading" });
  if (gate) return gate;
  const cls = size === 10 ? "pl-sq pl-sq--run" : `pl-sq pl-sq--${size}`;
  return (
    <span className="pl-squares pl-squares--gap4" role="img" aria-label={label || `${squares.filter((q) => q === "lit").length} of ${squares.length} lit`}>
      {squares.map((q, i) => <span key={i} className={`${cls}${pop && q === "lit" ? " pl-lit-pop" : ""}`} data-s={q || undefined}/>)}
    </span>
  );
}

/** A stamp: mono caps, a 3 px double border, rotated; lands from 1.9× (off under reduced motion). tone region | lit | ink. */
export function Stamp({ children, tone = "region", rotate = -8, land = true, className = "", ...s }) {
  const gate = plateState(s, { height: 36, radius: "stamp", lines: 1 });
  if (gate) return gate;
  return (
    <span className={`pl-stamp${land ? " at-stamp" : ""} ${className}`.trim()} data-tone={tone === "region" ? undefined : tone}
      style={{ "--pl-stamp-rot": `${rotate}deg` }}>{children}</span>
  );
}

const STATUS_KIND = { "NEEDS YOU": "needs", SENT: "sent", "HELD · FIXED": "held", NEW: "new" };
/** A status tag — the word carries the state, the fill only repeats it. */
export function StatusTag({ children, kind, ...s }) {
  const gate = plateState(s, { height: 28, radius: "status", lines: 1 });
  if (gate) return gate;
  return <span className="pl-status" data-kind={kind || STATUS_KIND[String(children).toUpperCase()]}>{children}</span>;
}

/** The letter tile: a company with no logo (R2) — its first letter on its sector colour; a logo when there is one. */
export function LetterTile({ name = "", logo, region, size = "lg", ...s }) {
  const gate = plateState(s, { height: size === "sm" ? 38 : 50, radius: "input", lines: 1 });
  if (gate) return gate;
  const letter = (name.trim()[0] || "?").toUpperCase();
  return (
    <span aria-hidden="true" className={`pl-letter${size === "sm" ? " pl-letter--sm" : ""}`} data-region={region}>
      {logo ? <img src={logo} alt="" loading="lazy"/> : letter}
    </span>
  );
}

/** A stack chip: ✓ on your résumé (solid, a lit square) or not yet (dashed) — the words say which for a screen reader. */
export function StackChip({ name, yours }) {
  return (
    <span className="pl-stackchip" data-yours={yours ? "true" : "false"}>
      <span aria-hidden="true" className="pl-sq pl-sq--run" data-s={yours ? "lit" : undefined}/>
      {name}<span className="pl-sr">{yours ? " (on your résumé)" : " (not on your résumé yet)"}</span>
    </span>
  );
}

/** The breadcrumb chain: VOL. I / PL. IV / D3 — the region chip in its colour, the current one not a link. */
export function Breadcrumb({ crumbs = [], ...s }) {
  const gate = plateState(s, { height: 32, radius: "tag", lines: 1 });
  if (gate) return gate;
  return (
    <nav aria-label="Where you are" className="pl-crumbs">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const cls = `pl-crumb${c.region ? " pl-crumb--region" : ""}`;
        return (
          <span key={i} style={{ display: "contents" }}>
            {i ? <span className="pl-crumbs__slash" aria-hidden="true">/</span> : null}
            {last || !c.href
              ? <span className={cls} aria-current={last ? "page" : undefined} data-region={c.region}>{c.label}</span>
              : <a className={cls} href={c.href} data-region={c.region}>{c.label}</a>}
          </span>
        );
      })}
    </nav>
  );
}

/** Filter chips: a mono region tag + name + count; active = ink fill + clay shadow (aria-pressed). */
export function FilterChips({ chips = [], onToggle, label = "Filters", ...s }) {
  const gate = plateState(s, { height: 48, radius: "input", lines: 1 });
  if (gate) return gate;
  return (
    <div className="pl-filters" role="group" aria-label={label}>
      {chips.map((c) => (
        <button key={c.id} type="button" className="pl-filter" aria-pressed={!!c.on} onClick={() => onToggle?.(c.id)}>
          {c.tag ? <span className="pl-filter__tag" data-region={c.region}>{c.tag}</span> : null}
          {c.label}
          {c.count == null ? null : <span className="pl-filter__count">{c.count.toLocaleString("en-US")}</span>}
        </button>
      ))}
    </div>
  );
}

/** The kicker row: mono caps parts joined by a muted "·". */
export function Kickers({ parts = [] }) {
  return (
    <div className="pl-kickers">
      {parts.map((p, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i ? <span className="pl-kicker pl-kickers__sep" aria-hidden="true">·</span> : null}
          <span className="pl-kicker">{p}</span>
        </span>
      ))}
    </div>
  );
}

/** A legend of evidence (the survey sheet's stack legend): swatch, name, evidence bar, count. `partial` rows say "no data yet". */
export function Legend({ rows = [], label = "Legend", max, ...s }) {
  const gate = plateState(s, { height: 140, radius: "small", label: "Loading the legend" });
  if (gate) return gate;
  const top = max || Math.max(1, ...rows.map((r) => r.n || 0));
  if (s.state === "partial" && !rows.length) return <div className="pl-legend" aria-label={label}><NoData/></div>;
  return (
    <div className="pl-legend" role="list" aria-label={label}>
      {rows.map((r) => (
        <div key={r.name} role="listitem" className="pl-legend__row" data-yours={r.yours === false ? "false" : "true"} data-region={r.region}>
          <span className="pl-legend__sw" aria-hidden="true"/>
          <span className="pl-legend__name">{r.name}{r.yours === false ? <span className="pl-sr"> (not on your résumé)</span> : null}</span>
          {r.n == null
            ? <NoData/>
            : <span className="pl-legend__bar" aria-hidden="true"><span style={{ width: `${Math.round((r.n / top) * 100)}%` }}/></span>}
          <span className="pl-legend__n">{r.n == null ? "" : r.n}</span>
        </div>
      ))}
    </div>
  );
}

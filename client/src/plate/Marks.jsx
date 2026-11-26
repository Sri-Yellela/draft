// ⭐ D196 F3 · the small marks: lit squares, the stamp, a status tag, the letter tile, a stack chip, the breadcrumb chain,
// filter chips, the kicker row. Each is the boards' markup in plate classes; colour is never the only signal (R5).
import { useState } from "react";
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

const DAY_WORD = { lit: "proof that day", today: "today", rest: "the week’s rest day", off: "a weekend — not counted" };
/**
 * ⭐ 47j (D197 Wave 2 · M3, lane w2-practice; D203 (1)) · THE LOGBOOK'S LIT DAYS — Your run's month grid (YourRun.jsx's
 * run-month, D178-4) as a plate piece: a week per row under mono weekday letters, each day a 16 px square — lit = proof that
 * day (green), today = clay, the week's rest day dashed, a weekend when weekdays-only is on hatched paper, an unlit day white.
 * `days` = [{ day: "2026-11-23", s: "lit" | "today" | "rest" | "off" | null }] in date order, Monday first; `label` says what
 * the grid counts (the one thing a screen reader hears); `showKey` = false hides the key line. Colour is never the only
 * signal: each square carries its word as a title, and the key spells the four.
 */
// `onPick(i)` (optional) makes each day a button that says what lit it (the Logbook's operable model); `picked` = the open one.
export function LogbookDays({ days = [], label, showKey = true, onPick, picked = null, ...s }) {
  const gate = plateState(s, { height: 150, radius: "card", lines: 4, label: "Loading your days" });
  if (gate) return gate;
  const lit = days.filter((d) => d.s === "lit").length;
  return (
    <div className="pl-logdays">
      <div className="pl-logdays__grid" role="img" aria-label={label || `${lit} of ${days.length} days lit`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => <span key={`h${i}`} className="pl-logdays__wd" aria-hidden="true">{w}</span>)}
        {days.map((d, i) => {
          const word = `${d.day}${DAY_WORD[d.s] ? ` · ${DAY_WORD[d.s]}` : ""}`;
          return onPick
            ? <button key={d.day} type="button" className="pl-sq pl-sq--16 pl-logdays__day" data-s={d.s || undefined} title={word} aria-label={word} aria-pressed={picked === i} onClick={() => onPick(i)}/>
            : <span key={d.day} className="pl-sq pl-sq--16 pl-logdays__day" data-s={d.s || undefined} title={word}/>;
        })}
      </div>
      {showKey ? <p className="pl-logdays__key">■ PROOF THAT DAY · ■ TODAY · ⬚ REST DAY · ▨ WEEKEND, NOT COUNTED</p> : null}
    </div>
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

const STATUS_KIND = { "NEEDS YOU": "needs", SENT: "sent", "HELD · FIXED": "held", NEW: "new", DRAFTED: "drafted" };   // DRAFTED: white, ink border (the base)
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

const MARK_WORD = { yours: "on your résumé", not: "not on your résumé yet", unknown: "sign in to see whether it’s on your résumé" };
/** NEW THIS QUARTER — a mark that answers (D200 Rule 2): pressed, it says when the postings first named it. */
function NewTag({ note }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="pl-legend__new" aria-expanded={open} onClick={() => setOpen((o) => !o)}>NEW THIS QUARTER</button>
      {open ? <span className="pl-legend__note" role="status">{note || "First named in their postings in the last 90 days."}</span> : null}
    </>
  );
}
/**
 * ⭐ 47h (D197 #4, the final `Survey` board) · the survey sheet's stack legend — a card: the strip (`kicker` + `keyText`), one
 * column per group (`columns` = [{ label, rows }]), per technology (`row` = { name, n, of, pct, teams, mark, isNew, newNote,
 * href, attrs }): your square (■ yours · ⬚ not yet · ◌ signed out), the name (a link to its Atlas page when it has one), the
 * evidence bar (n / of), "in N of M postings · teams", NEW THIS QUARTER. `foot` = the rows under it (PUBLIC GITHUB …).
 * Live data only (stackFor); a group with nothing is not drawn, a legend with nothing says so.
 */
export function Legend({ columns = [], label = "Legend", kicker = "LEGEND · TECHNOLOGIES", keyText = "■ ON YOUR RÉSUMÉ · ⬚ NOT YET", foot = null, nameLink, ...s }) {
  const gate = plateState(s, { height: 220, radius: "sheet", label: "Loading the legend", lines: 4 });
  if (gate) return gate;
  return (
    <div className="pl-legend" role="region" aria-label={label}>
      <div className="pl-legend__strip"><span className="pl-label">{kicker}</span><span className="pl-label pl-muted">{keyText}</span></div>
      <div className="pl-legend__body">
        {columns.length ? columns.map((c) => (
          <div key={c.label} className="pl-legend__col" role="list" aria-label={c.label}>
            <span className="pl-label pl-muted">{c.label}</span>
            {c.rows.map((r) => (
              <div key={r.name} role="listitem" className="pl-legend__row" data-mark={r.mark || "unknown"} {...r.attrs}>
                <span className="pl-legend__sw" role="img" aria-label={MARK_WORD[r.mark || "unknown"]} title={MARK_WORD[r.mark || "unknown"]}/>
                <b className="pl-legend__name">{r.href && nameLink ? nameLink(r) : r.name}</b>
                <span className="pl-legend__bar" aria-hidden="true"><span style={{ width: `${r.pct ?? Math.floor((100 * (r.n || 0)) / Math.max(1, r.of || 1))}%` }}/></span>
                <span className="pl-legend__ev" title={r.seen || undefined}>in <b>{r.n} of {r.of}</b> postings{r.teams ? ` · ${r.teams}` : ""}</span>
                {r.isNew ? <NewTag note={r.newNote}/> : null}
              </div>
            ))}
          </div>
        )) : <div className="pl-legend__col"><NoData>NO TECHNOLOGY IN TWO OR MORE OF THEIR POSTINGS YET</NoData></div>}
      </div>
      {foot}
    </div>
  );
}

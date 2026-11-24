// ⭐ D196 F3 · the page's big pieces: the title block, the plate hero, callout tags, the label tape, the stats strip,
// the leg header and binder tabs — the boards' markup in plate classes.
import { useEffect, useState } from "react";
import { plateState } from "./PlateState.jsx";
import { Kickers } from "./Marks.jsx";
import { usePlateMotion } from "./motion.js";

/** A page title with its clay full stop ("The market."). Wraps, never clips (R2). */
export function PageTitle({ children, id, stop = true, as: Tag = "h1" }) {
  return <Tag id={id} className="pl-title">{children}{stop ? <span className="pl-title__stop">.</span> : null}</Tag>;
}

/** A stats strip: serif number + mono caps label, cells split by 1.5 px rules. tone "clay" on the one that needs you. */
export function StatsStrip({ cells = [], label, ...s }) {
  const gate = plateState(s, { height: 66, radius: "small", lines: 2, label: "Loading the figures" });
  if (gate) return gate;
  return (
    <div className="pl-stats" role="list" aria-label={label}>
      {cells.map((c) => (
        <div key={c.label} role="listitem" className="pl-stats__cell" data-tone={c.tone}>
          <span className="pl-stats__num">{c.value == null ? "—" : typeof c.value === "number" ? c.value.toLocaleString("en-US") : c.value}</span>
          <span className="pl-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The plate hero: a framed drawing at a fixed aspect ratio (nothing shifts as data arrives — CLS ≈ 0), a 10 px shadow,
 * an optional figcaption strip and callout tags placed in % of the viewBox (hidden below 980 px).
 */
export function PlateHero({ children, aspect = "640 / 520", caption, tags = [], ...s }) {
  const gate = plateState(s, { height: 360, radius: "hero", label: "Loading the plate" });
  return (
    <figure className="pl-platehero">
      {gate || (
        <div className="pl-platehero__frame" style={{ "--pl-aspect": aspect }}>{children}</div>
      )}
      {!gate && tags.map((t, i) => <CalloutTag key={i} {...t} index={i}/>)}
      {!gate && caption ? <figcaption className="pl-platehero__cap">{caption}</figcaption> : null}
    </figure>
  );
}

/** A callout tag pinned on a plate: mono kicker (YOU ARE HERE / NEXT / AHEAD) + a bold line; floats (one of three bobs). */
export function CalloutTag({ kicker, line, x = 50, y = 50, kind, index = 0, children, ...s }) {
  const gate = plateState(s, { height: 64, radius: "input", lines: 2 });
  if (gate) return gate;
  return (
    <div className={`pl-callout pl-hide-sm at-bob${(index % 3) + 1}`} data-kind={kind} style={{ left: `${x}%`, top: `${y}%` }}>
      <span className="pl-label">{kicker}</span>
      <span className="pl-callout__line">{line}</span>
      {children}
    </div>
  );
}

/** The label tape: a rotating word on its region's tape, flipping every 2.6 s (still under reduced motion). */
export function LabelTape({ words = [], every = 2600, ...s }) {
  const motion = usePlateMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!motion || words.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), every);
    return () => clearInterval(t);
  }, [motion, words.length, every]);
  const gate = plateState(s, { height: 60, radius: "tag", lines: 1 });
  if (gate) return gate;
  const w = words[i] || { text: "" };
  return (
    <span className="pl-tape" aria-live="polite">
      <span key={i} className="pl-tape__word" data-region={w.region}>{w.text}</span>
    </span>
  );
}

/** A leg / section header: the outlined serif numeral, mono meta, serif title, on a ruled bottom edge. */
export function LegHeader({ n, meta, title, id, level = 2 }) {
  const H = `h${level}`;
  return (
    <div className="pl-leg" id={id}>
      {n == null ? null : <span aria-hidden="true" className="pl-leg__num">{String(n).padStart(2, "0")}</span>}
      <div className="pl-leg__text">
        {meta ? <span className="pl-kicker pl-muted">{meta}</span> : null}
        <H className="pl-leg__title">{title}</H>
      </div>
    </div>
  );
}

/** The page's title block: kicker row, the title, the lead, a stats strip and the actions (the hero's left side). */
export function TitleBlock({ kickers = [], title, titleId, lead, stats, actions }) {
  return (
    <div className="pl-hero__main">
      {kickers.length ? <Kickers parts={kickers}/> : null}
      <PageTitle id={titleId}>{title}</PageTitle>
      {lead ? <p className="pl-lead">{lead}</p> : null}
      {stats ? <StatsStrip {...stats}/> : null}
      {actions ? <div className="pl-actions">{actions}</div> : null}
    </div>
  );
}

/**
 * Binder tabs: the tabs sit on the panel's top edge — the open one white with the region's shadow, the others 4 px lower.
 * Real tabs (role=tablist / tab / tabpanel, arrow keys move between them).
 */
export function BinderTabs({ tabs = [], selected, onSelect, label = "Views", idBase = "pl-tab", children }) {
  const keys = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(i + d + tabs.length) % tabs.length];
    onSelect?.(next.id);
    document.getElementById(`${idBase}-${next.id}`)?.focus();
  };
  return (
    <>
      <div className="pl-tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button key={t.id} id={`${idBase}-${t.id}`} type="button" role="tab" className="pl-tab" aria-selected={selected === t.id}
            aria-controls={`${idBase}-panel`} tabIndex={selected === t.id ? 0 : -1} onClick={() => onSelect?.(t.id)} onKeyDown={(e) => keys(e, i)}>
            <span className="pl-tab__label">{t.label}</span>{t.sub ? <span className="pl-tab__sub">{t.sub}</span> : null}
          </button>
        ))}
      </div>
      <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-${selected}`} className="pl-tabpanel pl-in" key={selected}>{children}</div>
    </>
  );
}

// ⭐ D197 Wave 1 #5 (47h, lane atlas) · ATLAS'S FRONT PAGE — VOLUME I (the approved canvas board `Home`,
// docs/sketches/final/project/Home.dc.html; the owner 11-25: "the atlas home page from v2 was nice", it stays Atlas's front
// page). The board's markup in plate classes (plate/atlasPlate.css), its data as props — the page (pages/atlas/
// AtlasVolume.jsx) passes the course's, the F5 fixture the board's. Atlas home is a DESTINATION, so its big serif title
// stays (D200 Rule 3).
//   AtlasHero      the kicker, "Find your way through" + the label tape, the lead, the two actions, the stats strip, and
//                  the volume plate (the ported drawing) with its three callout tags and its caption
//   RegionPlates   "Eight plates, one territory": a plate card per region (emblem, lit squares, blurb, BEGIN HERE)
//   VolumesPanel   the VOL. I pill's panel (the volumes column + a row per region) — the area nav opens it
//   AtlasFooter    the index of every Atlas place (You · Grow · Compete · Explore)
import { RegionEmblem } from "./Drawings.jsx";
import { usePlateMotion } from "./motion.js";
import { useEffect, useState } from "react";
import AtlasVolumePlate from "./drawings/AtlasVolumePlate.jsx";
import "./atlasPlate.css";

/** A row of squares: lit = proven (green), today = clay, null = not yet (white). */
export function AtSquares({ squares = [], size = 11, label }) {
  return (
    <span className="pl-at-sqs" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
      {squares.map((s, i) => <span key={i} className={`pl-at-sq pl-at-sq--${size}${s === "today" ? " at-tick" : ""}`} data-s={s || undefined}/>)}
    </span>
  );
}

/** The rotating phrase on its region's tape — the board's five, one every 2.6 s; still under reduced motion. */
function HeroTape({ words = [] }) {
  const motion = usePlateMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!motion || words.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [motion, words.length]);
  const w = words[i] || { text: "" };
  return (
    <span className="pl-at-tapebox">
      <span key={i} className="pl-at-tape" data-region={w.region} aria-live="polite">{w.text}</span>
    </span>
  );
}

/**
 * The hero. `tapes` = [{ text, region }] · `actions` = { primary: { label, href, onClick }, secondary: {…} } ·
 * `stats` = [{ value, label }] · `tags` = { here: { kicker, line, squares }, next: { kicker, line, code }, ahead: { kicker, words } }
 * (each optional — a tag with nothing to say is not drawn) · `caption` = [left, right].
 */
export function AtlasHero({ kicker = ["VOL. I", "COMPUTING · MORE VOLUMES IN PREPARATION"], title = ["Find your way", "through"], tapes = [], lead, actions = {}, stats = [], tags = {}, caption = [], onGo }) {
  const go = (a) => (e) => { if (!a?.onClick) return; if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); a.onClick(); };
  return (
    <section className="pl-at-hero" id="top" aria-labelledby="pl-at-title">
      <div className="pl-at-hero__main">
        <span className="pl-at-kicker"><span className="pl-at-kicker__tag">{kicker[0]}</span>{kicker[1]}</span>
        <h1 className="pl-at-h1" id="pl-at-title">{title[0]}<br/>{title[1]}
          <span className="pl-at-tapes"><HeroTape words={tapes}/></span>
        </h1>
        {lead ? <p className="pl-at-lead">{lead}</p> : null}
        <div className="pl-at-actions">
          {actions.primary ? <a className="pl-at-cta" href={actions.primary.href} onClick={go(actions.primary)} data-atlas-resume="">{actions.primary.label} <span className="pl-at-cta__go" aria-hidden="true">→</span></a> : null}
          {actions.secondary ? <a className="pl-at-cta2" href={actions.secondary.href} onClick={go(actions.secondary)}>{actions.secondary.label}</a> : null}
        </div>
        {stats.length ? (
          <div className="pl-at-stats" role="list" aria-label="Volume I in figures">
            {stats.map((c) => (
              <span key={c.label} role="listitem" className="pl-at-stats__cell">
                {c.href ? <a className="pl-at-stats__a" href={c.href} onClick={onGo ? (e) => { if (!e.button && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onGo(c.href); } } : undefined}>
                  <span className="pl-at-stats__num">{Number(c.value).toLocaleString("en-US")}</span><span className="pl-at-stats__label">{c.label}</span></a>
                  : <><span className="pl-at-stats__num">{Number(c.value).toLocaleString("en-US")}</span><span className="pl-at-stats__label">{c.label}</span></>}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <figure className="pl-at-plate">
        <div className="pl-at-plate__frame">
          <AtlasVolumePlate/>
          {tags.here ? (
            <div className="pl-at-tag pl-hide-sm at-bob1" data-tag="here" style={{ left: "30%", top: "70%", width: 186 }}>
              <span className="pl-at-tag__k" data-tone="clay">{tags.here.kicker || "YOU ARE HERE"}</span>
              {tags.here.href ? <a className="pl-at-tag__line" href={tags.here.href} onClick={go(tags.here)}>{tags.here.line}</a> : <span className="pl-at-tag__line">{tags.here.line}</span>}
              {tags.here.squares ? <AtSquares squares={tags.here.squares} size={10}/> : null}
            </div>
          ) : null}
          {tags.next ? (
            <div className="pl-at-tag pl-hide-sm at-bob2" data-tag="next" data-ink="" style={{ left: "56%", top: "47%", width: 156 }}>
              <span className="pl-at-tag__k" data-tone="on-navy">{tags.next.kicker}</span>
              {tags.next.code ? <span className="pl-at-tag__code">{tags.next.code[0]} <span className="pl-at-tag__arrow">→</span> {tags.next.code[1]}</span> : null}
              {tags.next.line ? (tags.next.href ? <a className="pl-at-tag__sub" href={tags.next.href} onClick={go(tags.next)}>{tags.next.line}</a> : <span className="pl-at-tag__sub">{tags.next.line}</span>) : null}
            </div>
          ) : null}
          {tags.ahead ? (
            <div className="pl-at-tag pl-hide-sm at-bob3" data-tag="ahead" style={{ left: "62%", top: "9%", width: 150 }}>
              <span className="pl-at-tag__k" data-tone="r8">{tags.ahead.kicker}</span>
              {tags.ahead.words ? (
                <span className="pl-at-tag__words">{tags.ahead.words.map((w, i) => <span key={i} className="pl-at-tag__word" data-hi={w.hi ? "" : undefined}>{w.text}</span>)}</span>
              ) : null}
              {tags.ahead.line ? (tags.ahead.href ? <a className="pl-at-tag__sub" href={tags.ahead.href} onClick={go(tags.ahead)}>{tags.ahead.line}</a> : <span className="pl-at-tag__sub">{tags.ahead.line}</span>) : null}
            </div>
          ) : null}
        </div>
        <figcaption className="pl-at-plate__cap"><span>{caption[0]}</span><span>{caption[1]}</span></figcaption>
      </figure>
    </section>
  );
}

/** One region's plate card. `r` = { n, roman, kind, name, lit, total, squares, blurb, href }. */
function RegionPlate({ r, start, onGo }) {
  const click = onGo ? (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onGo(r.href); } : undefined;
  return (
    <a className="pl-at-rplate" href={r.href} onClick={click} data-region={r.roman} data-atlas-region={r.n}
      aria-label={`Plate ${r.roman}, ${r.name}: ${r.lit} of ${r.total} places lit`}>
      <span className="pl-at-rplate__strip"><span>PLATE {r.roman}</span><span className="pl-at-rplate__count">{r.lit}/{r.total}</span></span>
      <span className="pl-at-rplate__art"><RegionEmblem kind={r.kind} region={r.roman} size={132}/></span>
      <span className="pl-at-rplate__body">
        <span className="pl-at-rplate__name">{r.name}</span>
        <AtSquares squares={r.squares}/>
        <span className="pl-at-rplate__blurb">{r.blurb}</span>
      </span>
      {start ? <span className="pl-at-begin">BEGIN HERE</span> : null}
    </a>
  );
}

/** "Eight plates, one territory". */
export function RegionPlates({ regions = [], kicker = "THE REGIONS OF VOLUME I", title = "Eight plates, one territory", note, onGo }) {
  return (
    <section className="pl-at-regions" aria-labelledby="pl-at-regions-title">
      <div className="pl-at-regions__in">
        <div className="pl-at-regions__head">
          <div>
            <span className="pl-at-k pl-at-k--clay">{kicker}</span>
            <h2 className="pl-at-h2" id="pl-at-regions-title">{title}</h2>
          </div>
          {note ? <p className="pl-at-regions__note">{note}</p> : null}
        </div>
        <div className="pl-at-regions__grid">
          {regions.map((r, i) => <RegionPlate key={r.roman} r={r} start={i === 0} onGo={onGo}/>)}
        </div>
      </div>
    </section>
  );
}

/** The VOL. I pill's panel: the volumes column (the one in print, the next in preparation) + a row per region. */
export function VolumesPanel({ regions = [], volume = { tag: "VOL. I", name: "Computing", line: "From silicon to software · 8 regions · 108 lessons" }, onGo }) {
  const click = (href) => (e) => { if (!onGo || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onGo(href); };
  return (
    <div className="pl-at-vols" data-atlas-volumes="">
      <div className="pl-at-vols__col">
        <span className="pl-at-vols__k">THE VOLUMES</span>
        <a className="pl-at-vols__vol" aria-current="true" href={volume.href} onClick={click(volume.href)}>
          <span className="pl-at-vols__tag">{volume.tag}</span>
          <span className="pl-at-vols__name">{volume.name}</span>
          <span className="pl-at-vols__line">{volume.line}</span>
        </a>
        <span className="pl-at-vols__vol" data-next="" aria-disabled="true">
          <span className="pl-at-vols__tag">VOL. II · IN PREPARATION</span>
          <span className="pl-at-vols__name">[Next field]</span>
          <span className="pl-at-vols__line">Drawn on the same map, when it’s ready</span>
        </span>
      </div>
      <div className="pl-at-vols__grid">
        {regions.map((r) => (
          <a key={r.roman} className="pl-at-vols__row" href={r.href} onClick={click(r.href)} data-region={r.roman}>
            <RegionEmblem kind={r.kind} region={r.roman} size={56}/>
            <span className="pl-at-vols__text">
              <span className="pl-at-vols__pl">PL. {r.roman}</span>
              <span className="pl-at-vols__rname">{r.name}</span>
              <span className="pl-at-vols__lit">{r.lit} of {r.total} lit</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** The footer: Atlas, its line, and a column of links per group — every Atlas place, so none is lost (D200 Rule 1). */
// 47j (w2-public, D197 #16): `brand` = the name at the top left (default Atlas) — the public pages' footer is this footer
// with the /draft wordmark (A93: one footer, not a second implementation).
export function AtlasFooter({ groups = [], line = "Your way through the market.", onGo, brand = "Atlas" }) {
  const click = (href) => (e) => { if (!onGo || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onGo(href); };
  return (
    <footer className="pl-at-foot">
      <div className="pl-at-foot__in">
        <div className="pl-at-foot__brand">
          <span className="pl-at-foot__name">{brand}</span>
          <span className="pl-at-foot__line">{line}</span>
          <svg aria-hidden="true" width="220" height="60" viewBox="0 0 220 60">
            <g fill="none" strokeWidth="1" style={{ stroke: "var(--pl-muted)" }}><path d="M0 40 C40 20 80 50 120 30 C160 10 190 30 220 20"/><path d="M0 52 C40 32 80 62 120 42 C160 22 190 42 220 32"/></g>
            <path d="M10 44 C50 30 90 46 130 30" fill="none" strokeWidth="2" strokeDasharray="5 5" style={{ stroke: "var(--pl-clay)" }}/>
            <circle cx="130" cy="30" r="4" style={{ fill: "var(--pl-clay)" }}/>
          </svg>
        </div>
        {groups.map((g) => (
          <nav key={g.label} className="pl-at-foot__col" aria-label={g.label}>
            <span className="pl-at-foot__k">{g.label.toUpperCase()}</span>
            {g.links.map((l) => <a key={l.label} href={l.href} onClick={click(l.href)}>{l.label}</a>)}
          </nav>
        ))}
      </div>
    </footer>
  );
}

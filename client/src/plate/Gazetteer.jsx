// ⭐ D197 Wave 1 #8 (47m, lane gaz) · D201 · THE GAZETTEER — Atlas's dictionary, drawn from the approved canvas boards
// `Gazetteer` (a sample entry, *hash map*), `GazetteerIndex` (*Look anything up*) and `Route` (a route over entries)
// (docs/sketches/final/project/*.dc.html; generators scripts/sketches47l/index.mjs + route.mjs). The boards' inline styles are
// classes in plate/gazetteer.css (every value a token). These pieces only draw: the data and the router arrive as props
// from pages/atlas/AtlasGazetteer.jsx. Every mark answers (D200 Rule 2): a chip, a square row, a count is a link or says why not.
import { useEffect, useRef, useState } from "react";
import "./gazetteer.css";

const plain = (e) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
/** A link that takes a plain click through the router (`onGo(href)`), anything else the browser's. */
export function GoLink({ href, onGo, className, children, onClick, ...s }) {
  const out = /^https?:/.test(String(href || ""));
  return (
    <a href={href} className={className} target={out ? "_blank" : undefined} rel={out ? "noopener noreferrer" : undefined} {...s}
      onClick={(e) => { onClick?.(e); if (!e.defaultPrevented && !out && onGo && href && plain(e)) { e.preventDefault(); onGo(href); } }}>{children}</a>
  );
}

/** A Gazetteer card: the mono title strip (+ its right-hand note) over the body. `tone` = the shadow's colour. */
export function GzCard({ title, right, tone, id, label, children, flush = false, className = "", ...s }) {
  return (
    <section id={id} aria-label={label || title} className={`pl-gz-card ${className}`.trim()} data-tone={tone || undefined} {...s}>
      <div className="pl-gz-card__strip"><span className="pl-gz-k">{title}</span>{right ? <span className="pl-gz-k pl-gz-k--muted">{right}</span> : null}</div>
      <div className={flush ? "pl-gz-card__flush" : "pl-gz-card__body"}>{children}</div>
    </section>
  );
}

/** The plate chip (PL. III in its region's colour) — a link to the region on the physical map. */
export function PlateChip({ region, href, onGo }) {
  if (!region) return <span className="pl-gz-plate" data-none="" title="Not on a plate yet: no lesson teaches it">NO PLATE</span>;
  return <GoLink href={href} onGo={onGo} className="pl-gz-plate" data-region={region.roman} title={`Region ${region.roman} · ${region.name}`}>PL. {region.roman}</GoLink>;
}

/** The entry's three squares (lit green, dashed = not yet). */
export function GzSquares({ n = 0, label }) {
  return (
    <span className="pl-gz-sqs" role="img" aria-label={label || `${n} of 3 squares lit`}>
      {[0, 1, 2].map((i) => <span key={i} className="pl-gz-sq" data-s={i < n ? "lit" : undefined}/>)}
    </span>
  );
}

/** A dotted cross-reference: the meaning's parts (string | { text, href }) with each entry name a link. */
export function CrossRefText({ parts = [], onGo }) {
  return <>{parts.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <GoLink key={i} href={p.href} onGo={onGo} className="pl-gz-xref">{p.text}</GoLink>))}</>;
}

// ── LOOK ANYTHING UP ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The search with its grouped suggestions (ENTRIES, then ALSO MATCHES: an interview question, a route, ⇄ the market).
 * `groups` = [{ id, label, items: [{ id, href, kind?, word?, match?: [pre, hit, post], region, line, squares, tail }] }].
 * Arrow keys move, Enter opens, Escape closes; Ctrl K (or /) focuses it from anywhere on the page.
 */
export function LookUp({ value = "", onChange, onSubmit, groups = [], onGo, big = true, label = "Make sense of a word, a question or a skill", placeholder = "Make sense of…" }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const ref = useRef(null);
  const flat = groups.flatMap((g) => g.items);
  useEffect(() => {
    const onKey = (e) => { if ((e.key === "k" && (e.ctrlKey || e.metaKey)) && ref.current) { e.preventDefault(); ref.current.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { setAt(0); }, [value]);
  const shown = open && value.trim() && flat.length > 0;
  let k = -1;
  return (
    <div className="pl-gz-look" data-big={big ? "" : undefined}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); const it = shown ? flat[at] : null; if (it) { setOpen(false); onGo?.(it.href); } else onSubmit?.(value); }}>
        <label className="pl-gz-look__field">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--pl-ink)" }}><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4"/></svg>
          <span className="pl-sr">{label}</span>
          <input ref={ref} type="search" value={value} placeholder={placeholder} maxLength={80} className="pl-gz-look__input" data-gazetteer-search=""
            role="combobox" aria-expanded={shown ? "true" : "false"} aria-controls="pl-gz-suggest" aria-autocomplete="list"
            onChange={(e) => { onChange?.(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setAt((x) => Math.min(flat.length - 1, x + 1)); setOpen(true); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setAt((x) => Math.max(0, x - 1)); }
              else if (e.key === "Escape") setOpen(false);
            }}/>
          {big ? <span className="pl-gz-look__key" aria-hidden="true">Ctrl K</span> : null}
        </label>
      </form>
      {shown ? (
        <div id="pl-gz-suggest" className="pl-gz-suggest at-drop" role="listbox" aria-label="Suggestions">
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.id} role="group" aria-label={g.label}>
              <div className="pl-gz-suggest__head"><span className="pl-gz-k">{g.label}</span></div>
              {g.items.map((it) => {
                k += 1;
                const sel = k === at;
                return (
                  <GoLink key={it.id} href={it.href} onGo={onGo} role="option" aria-selected={sel ? "true" : "false"} className={it.word ? "pl-gz-opt pl-gz-opt--entry" : "pl-gz-opt"}
                    data-region={it.region?.roman} onMouseDown={(e) => e.preventDefault()}>
                    {it.word ? (
                      <>
                        <span className="pl-gz-opt__word">{it.match ? <>{it.match[0]}<b>{it.match[1]}</b>{it.match[2]}</> : it.word}</span>
                        {it.region ? <span className="pl-gz-plate" data-region={it.region.roman}>PL. {it.region.roman}</span> : null}
                        {it.line ? <span className="pl-gz-opt__line">{it.line}</span> : null}
                        <GzSquares n={it.squares || 0}/>
                      </>
                    ) : (
                      <><span className="pl-gz-k" data-kind={it.kind}>{it.kindLabel}</span> {it.text} {it.tail ? <span className="pl-gz-muted">{it.tail}</span> : null}</>
                    )}
                  </GoLink>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A toggle chip (aria-pressed), its count beside the word; or, with `href`, a link that looks like one. */
export function GzChip({ on = false, count, href, onGo, onClick, children, ...s }) {
  const inner = <>{children}{count != null && count !== "" ? <span className="pl-gz-chip__n">{count}</span> : null}</>;
  if (href && !onClick) return <GoLink href={href} onGo={onGo} className="pl-gz-chip" data-on={on ? "" : undefined} {...s}>{inner}</GoLink>;
  return <button type="button" className="pl-gz-chip" aria-pressed={on} data-on={on ? "" : undefined} onClick={onClick} {...s}>{inner}</button>;
}

/** Show: All · Due · Lit · Started · Not yet, and Browse by: A–Z · Region · Role · Stage · Interview. */
export function ShowBrowse({ show = "all", shows = [], counts = {}, onShow, browse = "az", browses = [], onBrowse }) {
  return (
    <div className="pl-gz-filters">
      <div role="group" aria-label="Show" className="pl-gz-filters__g"><span className="pl-gz-k pl-gz-k--muted">SHOW</span>
        {shows.map((x) => <GzChip key={x.id} on={show === x.id} count={counts[x.id] ? counts[x.id].toLocaleString("en-US") : ""} onClick={() => onShow?.(x.id)} data-show={x.id}>{x.label}</GzChip>)}</div>
      <div role="group" aria-label="Browse by" className="pl-gz-filters__g"><span className="pl-gz-k pl-gz-k--muted">BROWSE BY</span>
        {browses.map((x) => <GzChip key={x.id} on={browse === x.id} onClick={() => onBrowse?.(x.id)} data-browse={x.id}>{x.label}</GzChip>)}</div>
    </div>
  );
}

/** One dictionary row: the headword, its plate, three squares, one line with dotted cross-references, where it's used. */
export function DictRow({ word, href, onGo, region, regionHref, squares = 0, line, meta, kind }) {
  return (
    <div className="pl-gz-row" data-gazetteer-entry={word}>
      <div className="pl-gz-row__top">
        <GoLink href={href} onGo={onGo} className="pl-gz-row__word">{word}</GoLink>
        {kind ? <span className="pl-gz-k pl-gz-k--muted">{kind.toUpperCase()}</span> : null}
        <PlateChip region={region} href={regionHref} onGo={onGo}/>
        <span className="pl-grow"/>
        <GzSquares n={squares}/>
      </div>
      {line ? <p className="pl-gz-row__line">{line}</p> : null}
      {meta ? <p className="pl-gz-row__meta">{meta}</p> : null}
    </div>
  );
}

/** The A–Z page: the letters (the current one inked; an empty letter is dashed and says so), the two columns, ← / →. */
export function AzPage({ letter, letters = [], have = new Set(), onLetter, range, count, cols = [[], []], prev, next, empty }) {
  return (
    <section id="az" aria-label="A to Z" className="pl-gz-card">
      <div className="pl-gz-card__strip pl-gz-card__strip--az"><span className="pl-gz-k">A – Z · THE DICTIONARY PAGE</span>{range ? <span className="pl-gz-az__range">{range}</span> : null}</div>
      <nav aria-label="Letters" className="pl-gz-letters">
        {letters.map((L) => (
          <button key={L} type="button" className="pl-gz-letter" aria-current={L === letter ? "true" : undefined} disabled={!have.has(L)}
            title={have.has(L) ? `Entries under ${L}` : `Nothing under ${L} yet`} onClick={() => onLetter?.(L)}>{L}</button>
        ))}
      </nav>
      {count != null ? <div className="pl-gz-az__letter"><span className="pl-gz-az__big">{letter}</span><span className="pl-gz-k pl-gz-k--muted">{count} {count === 1 ? "ENTRY" : "ENTRIES"}</span></div> : null}
      {empty ? <p className="pl-gz-empty">{empty}</p> : (
        <div className="pl-gz-az__cols"><div className="pl-gz-az__col">{cols[0]}</div><div className="pl-gz-az__col pl-gz-az__col--2">{cols[1]}</div></div>
      )}
      <div className="pl-gz-az__foot">
        <span className="pl-gz-muted">Each row: the word, its plate, your three squares, one line, and where it’s used.</span>
        <span className="pl-gz-az__pager">
          {prev ? <button type="button" className="pl-btn" onClick={prev.onClick}>← {prev.letter}</button> : null}
          {next ? <button type="button" className="pl-btn" onClick={next.onClick}>{next.letter} →</button> : null}
        </span>
      </div>
    </section>
  );
}

/** Browse by region: the eight plates (contour-hatched in their tint), entries and lit counts; tap = that plate's entries. */
export function PlateCards({ regions = [], onPick }) {
  return (
    <div className="pl-gz-plates">
      {regions.map((r) => (
        <button key={r.roman} type="button" className="pl-gz-platecard at-plate" data-region={r.roman} onClick={() => onPick?.(r)} data-gazetteer-region={r.roman}>
          <span aria-hidden="true" className="pl-gz-platecard__art"><span className="pl-gz-platecard__tag">PL. {r.roman}</span></span>
          <span className="pl-gz-platecard__text"><span className="pl-gz-platecard__name">{r.name}</span><span className="pl-gz-k pl-gz-k--muted">{r.entries} ENTRIES · {r.lit} LIT</span></span>
        </button>
      ))}
    </div>
  );
}

/** Browse by role: what the market asks (its top skills) against what you've proven, ⇄ Your survey. */
export function RoleRows({ rows = [], onGo, roleHref, surveyHref, signedIn }) {
  if (!rows.length) return <p className="pl-gz-empty">No role has enough openings counted yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.slug} className="pl-gz-role" data-gazetteer-role={r.slug}>
          <GoLink href={roleHref(r)} onGo={onGo} className="pl-gz-role__name">{r.name}</GoLink>
          <span className="pl-gz-k pl-gz-k--muted">{r.asks} ENTRIES THE MARKET ASKS FOR · {r.postings.toLocaleString("en-US")} OPENINGS</span>
          <span className="pl-gz-bar" role="img" aria-label={`${r.pct}% proven`}><span style={{ width: `${r.pct}%` }}/></span>
          <GoLink href={surveyHref(r)} onGo={onGo} className="pl-gz-role__go">{signedIn ? `${r.pct}% PROVEN → YOUR SURVEY` : "SIGN IN TO SEE YOURS → YOUR SURVEY"}</GoLink>
        </div>
      ))}
    </div>
  );
}

/** Browse by stage: the four elevation bands, one scale for everything. */
export function StageBands({ stages = [], onPick }) {
  return (
    <div className="pl-gz-stages">
      {stages.map((s) => (
        <button key={s.id} type="button" className="pl-gz-stage" data-stage={s.id} onClick={() => onPick?.(s)} data-gazetteer-stage={s.id}>
          <svg aria-hidden="true" viewBox="0 0 200 50" width="100%" height="50" preserveAspectRatio="none" className="pl-gz-stage__art">
            <path d={`M0 ${46 - s.i * 9} C 40 ${40 - s.i * 10}, 80 ${44 - s.i * 11}, 120 ${36 - s.i * 9} S 180 ${30 - s.i * 8}, 200 ${34 - s.i * 9} L200 50 L0 50 Z`} opacity=".85" style={{ fill: `var(--pl-stage-${s.id})` }}/>
            <path d={`M0 ${46 - s.i * 9} C 40 ${40 - s.i * 10}, 80 ${44 - s.i * 11}, 120 ${36 - s.i * 9} S 180 ${30 - s.i * 8}, 200 ${34 - s.i * 9}`} fill="none" strokeWidth="1.5" style={{ stroke: "var(--pl-ink)" }}/>
          </svg>
          <span className="pl-gz-stage__text"><span className="pl-gz-k" data-stage-k={s.id}>{s.label.toUpperCase()}</span><span className="pl-gz-stage__band">{s.band}</span>
            <span className="pl-gz-k pl-gz-k--muted">{s.entries} ENTRIES · {s.lit} LIT</span></span>
        </button>
      ))}
    </div>
  );
}

/** Browse by interview: rounds, the entries they ask, and the companies you were asked at. */
export function InterviewRows({ rows = [], onPick, empty }) {
  if (!rows.length) return <p className="pl-gz-empty">{empty}</p>;
  return (
    <div>
      {rows.map((r) => (
        <button key={r.id} type="button" className="pl-gz-irow" onClick={() => onPick?.(r)} data-gazetteer-interview={r.id}>
          <span className="pl-gz-irow__t">{r.title}</span><span className="pl-gz-irow__sub">{r.sub}</span><span className="pl-gz-k">{r.entries.length} ENTRIES →</span>
        </button>
      ))}
    </div>
  );
}

/** The index's rail: Due for review, Start anywhere, Your routes, Recently looked up. Each part is passed in. */
export function IndexRail({ children }) {
  return <aside aria-label="Your way in" className="pl-gz-rail">{children}</aside>;
}
/** A due row (the word, its plate, its stage · when). */
export function DueRow({ word, href, onGo, region, stage, when, over }) {
  return (
    <GoLink href={href} onGo={onGo} className="pl-gz-due">
      <span className="pl-gz-due__w">{word}</span>{region ? <span className="pl-gz-plate" data-region={region.roman}>PL. {region.roman}</span> : null}
      <span className="pl-gz-due__when" data-over={over ? "" : undefined}>{stage} · {when}</span>
    </GoLink>
  );
}
/** A way in (Start anywhere): its kicker in its colour, one line. */
export function Door({ kicker, text, href, onGo, tone }) {
  return <GoLink href={href} onGo={onGo} className="pl-gz-door" data-tone={tone}><span className="pl-gz-k" data-tone={tone}>{kicker}</span><span className="pl-gz-door__t">{text}</span></GoLink>;
}
/** A route's progress row (its name, lit / total, the bar). */
export function RouteRow({ name, lit = 0, total = 0, href, onGo, sub }) {
  const pct = total ? Math.round((100 * lit) / total) : 0;
  return (
    <GoLink href={href} onGo={onGo} className="pl-gz-rrow" data-gazetteer-route={name}>
      <span className="pl-gz-rrow__top"><span className="pl-gz-rrow__n">{name}</span><span className="pl-gz-k pl-gz-k--muted">{lit} / {total}</span></span>
      <span aria-hidden="true" className="pl-gz-bar pl-gz-bar--thin"><span style={{ width: `${pct}%` }}/></span>
      {sub ? <span className="pl-gz-k pl-gz-k--muted">{sub}</span> : null}
    </GoLink>
  );
}
/** A word chip (Recently looked up / the compass's links). */
export function WordChip({ href, onGo, children, dim = false }) {
  return <GoLink href={href} onGo={onGo} className="pl-gz-word" data-dim={dim ? "" : undefined}>{children}</GoLink>;
}

// ── AN ENTRY ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The entry's header: the kicker (GAZETTEER · ENTRY · plate · grid · stage), the headword, its other names, the meaning. */
export function EntryHead({ kicker = [], word, also, meaning, squares, children }) {
  return (
    <header className="pl-gz-head">
      <div className="pl-gz-head__k">{kicker.map((k, i) => <span key={i} className="pl-gz-k">{k}</span>)}<span className="pl-grow"/>{squares}</div>
      <h1 className="pl-gz-head__word" data-gazetteer-headword="">{word}</h1>
      {also ? <p className="pl-gz-head__also">{also}</p> : null}
      {meaning ? <p className="pl-gz-head__meaning" data-gazetteer-meaning="">{meaning}</p> : null}
      {children}
    </header>
  );
}

/** Watch it: the explainer's card (a dark poster tile + title + line), or the words that say none is drawn yet. */
export function WatchIt({ title, line, href, onGo, region, tag = "▶", none }) {
  return (
    <GzCard title="WATCH IT · THE EXPLAINER">
      {href ? (
        <GoLink href={href} onGo={onGo} className="pl-gz-watch" data-gazetteer-watch="">
          <span className="pl-gz-watch__poster" aria-hidden="true">{region ? <span className="pl-gz-plate" data-region={region.roman}>PL. {region.roman}</span> : <span/>}<span className="pl-gz-watch__play">{tag}</span></span>
          <span className="pl-gz-watch__text"><span className="pl-gz-watch__title">{title}</span>{line ? <span className="pl-gz-muted">{line}</span> : null}</span>
        </GoLink>
      ) : <p className="pl-gz-empty" data-gazetteer-watch="none">{none}</p>}
    </GzCard>
  );
}

/** Where it runs: lines of fact with their links, then the ⇄ interchange to the market. */
export function WhereItRuns({ lines = [], market, onGo, foot }) {
  return (
    <GzCard title="WHERE IT RUNS · TODAY" data-gazetteer-where="">
      {lines.length ? <ul className="pl-gz-where">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="pl-gz-empty">No opening on the board names it yet.</p>}
      {market ? <GoLink href={market.href} onGo={onGo} className="pl-gz-interchange" data-gazetteer-market="">⇄ {market.text}</GoLink> : null}
      {foot ? <p className="pl-gz-foot">{foot}</p> : null}
    </GzCard>
  );
}

/** Why it works: the idea's parts in order (the flow), then its words, then the mono line. */
export function WhyItWorks({ flow = null, title = "WHY IT WORKS", children, line }) {
  return (
    <GzCard title={title} tone="r3" data-gazetteer-why="">
      {flow?.length ? (
        <ol className="pl-gz-flow" aria-label="Its parts, in the order they work">
          {flow.map((p, i) => <li key={i} className="pl-gz-flow__step">{i ? <span aria-hidden="true" className="pl-gz-flow__arrow">→</span> : null}<span className="pl-gz-flow__box">{p}</span></li>)}
        </ol>
      ) : null}
      {children}
      {line ? <p className="pl-gz-k pl-gz-k--muted pl-gz-why__line">{line}</p> : null}
    </GzCard>
  );
}

/** Practice and interview questions on one scale: a rung per stage (its question, where it's asked, its square, the action). */
export function PracticeLadder({ rungs = [], right, children }) {
  return (
    <GzCard title="PRACTICE · AND INTERVIEW QUESTIONS · ONE SCALE" right={right} data-gazetteer-practice="">
      <ol className="pl-gz-ladder">
        {rungs.map((r) => (
          <li key={r.id} className="pl-gz-rung" data-stage={r.id} data-lit={r.lit ? "" : undefined}>
            <span className="pl-gz-k pl-gz-rung__k" data-stage-k={r.id}>{r.label}</span>
            <span className="pl-gz-rung__q">{r.text || <span className="pl-gz-muted">{r.empty || "No question at this stage yet."}</span>}{r.asked ? <span className="pl-gz-k pl-gz-k--muted pl-gz-rung__asked">{r.asked}</span> : null}</span>
            <span className="pl-gz-sq pl-gz-sq--16" data-s={r.lit ? "lit" : undefined} aria-label={r.lit ? "answered right" : "not yet"} role="img"/>
            {r.action || null}
          </li>
        ))}
      </ol>
      {children}
    </GzCard>
  );
}

/** The compass of links: builds on ↑, roles that need it ←, the entry at the centre, related ↔, leads to ↓. */
export function Compass({ word, up = [], down = [], side = [], roles = [], link, note = "Every dotted word in the entry is a link too." }) {
  const arm = (k, items, cls) => (
    <div className={`pl-gz-compass__arm ${cls}`}>
      <span className="pl-gz-k pl-gz-k--muted">{k}</span>
      <span className="pl-gz-compass__words">{items.length ? items.map((x, i) => <span key={i}>{link(x)}</span>) : <span className="pl-gz-muted">none on file</span>}</span>
    </div>
  );
  return (
    <GzCard title="LINKS IN EVERY DIRECTION · START ANYWHERE" data-gazetteer-compass="">
      <div className="pl-gz-compass">
        {arm("↑ BUILDS ON", up, "pl-gz-compass__n")}
        {arm("← ROLES THAT NEED IT", roles, "pl-gz-compass__w")}
        <div className="pl-gz-compass__c" aria-hidden="true"><span className="pl-gz-compass__needle"/><span className="pl-gz-compass__word">{word}</span></div>
        {arm("RELATED ↔", side, "pl-gz-compass__e")}
        {arm("↓ LEADS TO", down, "pl-gz-compass__s")}
      </div>
      <p className="pl-gz-foot">{note}</p>
    </GzCard>
  );
}

/** Read more, from the Library: each source's kind, title (a link out), who. */
export function ReadMore({ items = [], foot, onOpen }) {
  return (
    <GzCard title="READ MORE · FROM THE LIBRARY" flush data-gazetteer-read="">
      {items.length ? items.map((x, i) => (
        <a key={x.id || x.url || i} href={x.url} target="_blank" rel="noopener noreferrer" className="pl-gz-read" onClick={() => onOpen?.(x)} data-opened={x.opened ? "" : undefined}>
          <span className="pl-gz-k pl-gz-k--muted pl-gz-read__kind">{String(x.kind || "LINK").toUpperCase()}</span>
          <span className="pl-gz-read__t">{x.title}{x.by ? <span className="pl-gz-muted"> · {x.by}</span> : null}</span>
          {x.opened ? <span className="pl-gz-k" data-tone="lit">OPENED</span> : null}
        </a>
      )) : <p className="pl-gz-empty pl-gz-pad">Nothing from the Library is filed against it yet.</p>}
      {foot ? <div className="pl-gz-pad">{foot}</div> : null}
    </GzCard>
  );
}

/** The routes it sits on (each a link with stop N of M), one drawn; progress lives on the entry. */
export function EntryRoutes({ routes = [], onGo, drawn, empty }) {
  return (
    <GzCard title={routes.length ? `ON ${routes.length} ROUTE${routes.length === 1 ? "" : "S"} · PROGRESS LIVES ON THE ENTRY, SO IT COUNTS ON ${routes.length === 1 ? "IT" : routes.length === 2 ? "BOTH" : `ALL ${routes.length}`}` : "THE ROUTES IT SITS ON"}
      right="A ROUTE = A SAVED ORDER OF ENTRIES" data-gazetteer-routes="">
      {routes.length ? (
        <>
          <div className="pl-gz-onroutes">{routes.map((r) => <GoLink key={r.id} href={r.href} onGo={onGo} className="pl-gz-onroute"><span className="pl-gz-onroute__n">{r.name}</span><span className="pl-gz-k pl-gz-k--muted">STOP {r.at} OF {r.of}</span></GoLink>)}</div>
          {drawn ? <div className="pl-gz-scroll">{drawn}</div> : null}
          <p className="pl-gz-foot">You can join or leave a route at any stop, or skip ahead; nothing is locked.</p>
        </>
      ) : <p className="pl-gz-empty">{empty}</p>}
    </GzCard>
  );
}

/** The entry page's side index: look up, the letters, the neighbouring entries, browse by. */
export function EntrySide({ search, letters = [], letter, onLetter, have = new Set(), heading, near = [], browse = [], onGo }) {
  return (
    <aside className="pl-gz-side" aria-label="The index">
      {search}
      <nav aria-label="Letters" className="pl-gz-letters pl-gz-letters--side">
        {letters.map((L) => <button key={L} type="button" className="pl-gz-letter pl-gz-letter--sm" aria-current={L === letter ? "true" : undefined} disabled={!have.has(L)} onClick={() => onLetter?.(L)}>{L}</button>)}
      </nav>
      {heading ? <span className="pl-gz-k">{heading}</span> : null}
      <ul className="pl-gz-near">
        {near.map((x) => (
          <li key={x.key}><GoLink href={x.href} onGo={onGo} className="pl-gz-near__a" aria-current={x.current ? "page" : undefined}><span>{x.name}</span>{x.region ? <span className="pl-gz-plate" data-region={x.region.roman}>PL. {x.region.roman}</span> : null}</GoLink></li>
        ))}
      </ul>
      <span className="pl-gz-k pl-gz-k--muted">BROWSE BY</span>
      <div className="pl-gz-side__browse">{browse.map((b) => <GoLink key={b.id} href={b.href} onGo={onGo} className="pl-gz-chip">{b.label}</GoLink>)}</div>
    </aside>
  );
}

// ── A ROUTE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The route's header: the kicker, the name, the line, the progress squares, the two actions. */
export function RouteHead({ kicker, name, line, squares = [], actions }) {
  return (
    <header className="pl-gz-rhead">
      <div className="pl-gz-rhead__main">
        <span className="pl-gz-k">{kicker}</span>
        <h1 className="pl-gz-rhead__title" data-route-title="">{name}</h1>
        {line ? <p className="pl-gz-rhead__line">{line}</p> : null}
        <div className="pl-gz-rhead__sqs" role="img" aria-label={`${squares.filter((s) => s === "lit").length} of ${squares.length} stops lit`}>
          {squares.map((s, i) => <span key={i} className="pl-gz-rsq" data-s={s}/>)}
        </div>
      </div>
      {actions ? <div className="pl-gz-rhead__acts">{actions}</div> : null}
    </header>
  );
}

/** The stops list: number (outlined numeral), the entry, its plate, stage, squares, status, its questions; the current one open. */
export function StopsList({ title = "THE STOPS", right = "JOIN, LEAVE OR SKIP AT ANY STOP", stops = [], children }) {
  return (
    <section aria-label="The stops" className="pl-gz-card">
      <div className="pl-gz-card__strip"><span className="pl-gz-k">{title}</span><span className="pl-gz-k pl-gz-k--muted">{right}</span></div>
      <ol className="pl-gz-stops">{stops}</ol>
      {children}
    </section>
  );
}
const STATUS = { walked: "LIT HERE", elsewhere: "LIT ON ANOTHER ROUTE", here: "YOU ARE HERE", ahead: "AHEAD" };
export function StopRow({ n, word, href, onGo, region, regionHref, stage, stageId, squares = 0, state = "ahead", meta, open, tail }) {
  return (
    <li className="pl-gz-stop" data-s={state} data-route-stop-row={word}>
      <div className="pl-gz-stop__main">
        <span className="pl-gz-stop__n" aria-hidden="true">{String(n).padStart(2, "0")}</span>
        <GoLink href={href} onGo={onGo} className="pl-gz-stop__w">{word}</GoLink>
        <PlateChip region={region} href={regionHref} onGo={onGo}/>
        {stage ? <span className="pl-gz-k" data-stage-k={stageId}>{stage}</span> : null}
        <GzSquares n={squares}/>
        <span className="pl-gz-k pl-gz-stop__status" data-s={state}>{STATUS[state] || ""}</span>
        {meta ? <span className="pl-gz-k pl-gz-k--muted">{meta}</span> : null}
        {tail || null}
      </div>
      {open ? <div className="pl-gz-stop__open">{open}</div> : null}
    </li>
  );
}

/** The route stamp: ROUTE COMPLETE when every stop is lit (→ the Logbook), else the promise. */
export function RouteStamp({ done = false, total = 0, logbook }) {
  return (
    <div className="pl-gz-stamp" data-done={done ? "" : undefined} data-route-stamp="">
      <span aria-hidden="true" className="pl-gz-stamp__ring at-stamp">ROUTE<br/>COMPLETE<br/>{done ? "· LIT ·" : "· NOT YET ·"}</span>
      <span className="pl-gz-stamp__t">{done ? <>Every stop is lit. The stamp is in your {logbook}, and later on your passport.</> : <>Light all {total} stops and the stamp goes in your {logbook}, and later on your passport.</>}</span>
    </div>
  );
}

/** A definition list for the rail (MADE BY · CROSSES · ABOUT · ON IT). */
export function RouteFacts({ rows = [] }) {
  return <dl className="pl-gz-facts">{rows.map(([k, v]) => <div key={k} className="pl-gz-facts__r"><dt className="pl-gz-k pl-gz-k--muted">{k}</dt><dd>{v}</dd></div>)}</dl>;
}

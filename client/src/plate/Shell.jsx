// ⭐ D196 · THE SHELL (canvas v3 "The shell", the addendum): the retained dock + one Atlas-style nav per area.
// The dock = where you are in draft (never changes); the area nav = what you can do here.
// Built from the board's markup: the dock 84 px, items 58 px with 20 px icons and 11.5 px labels, the active item a white
// tile with a 3 px shadow; the area nav's views as links with 16 px icons, More, search with Ctrl K, one chip, the 12 px ruler.
// ⛔ The dock's ITEMS are the caller's (P5 passes the app's own list — D167's order and badges); this file only draws them.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { plateState } from "./PlateState.jsx";

/** The /d mark: ink d, clay slash, on a white 1.5 px-bordered tile (44 px in the dock, 28 px favicon). */
export function PlateLogo({ size = "dock" }) {
  return (
    <span aria-hidden="true" className={`pl-logo${size === "favicon" ? " pl-logo--sm" : ""}`}>
      <span><span className="pl-logo__slash">/</span>d</span>
    </span>
  );
}

/** Signed out: the /draft wordmark (Inter Tight 800, clay slash). */
export function Wordmark() {
  return <span className="pl-wordmark"><span className="pl-wordmark__slash">/</span>draft</span>;
}

/** The map-scale ruler: 12 px under every nav, 6 px on a leg header, 8 px on a phone. */
export function Ruler({ size = "nav" }) {
  const cls = size === "leg" ? " pl-ruler--leg" : size === "phone" ? " pl-ruler--phone" : "";
  return <div aria-hidden="true" className={`pl-ruler${cls}`}/>;
}

function DockBadge({ n, label }) {
  if (!(n > 0)) return null;
  return <span className="pl-badge"><span aria-hidden="true">{n > 9 ? "9+" : n}</span><span className="pl-sr">{`, ${label || `${n} new`}`}</span></span>;
}

function DockIcon({ item, size }) {
  if (item.initials) return <span className="pl-avatar" aria-hidden="true">{item.initials}</span>;
  if (item.mark) return <span className="pl-dock__mark" aria-hidden="true"><span className="pl-logo__slash">/</span>d</span>;
  return <Icon name={item.icon} size={size}/>;
}

/**
 * The dock. `home` = the /d tile's link (the market); `items` = [{ id, label, href, icon, badge, badgeLabel, initials }]
 * in the app's order; `ask` = the Ask draft item after the rule. `current` = the id that is aria-current ("home" for /d).
 * `bar` = the phone's bottom bar: the same items and badges (Ask draft by long-press or from search — not on the bar).
 */
export function Dock({ home = { href: "/app/jobs", label: "draft — the market" }, items = [], ask, current, bar = false, onGo, ...s }) {
  const gate = plateState(s, { height: 420, radius: "plate", label: "Loading the dock" });
  if (gate) return gate;
  const go = (e, it) => {
    if (!onGo || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault(); onGo(it.id, it.href);
  };
  const item = (it) => (
    <a key={it.id} className="pl-dock__item" href={it.href} data-dock-item={it.id} aria-current={current === it.id ? "page" : undefined}
      onClick={(e) => go(e, it)} onKeyDown={undefined}>
      <span className="pl-dock__icon"><DockIcon item={it} size={20}/><DockBadge n={it.badge} label={it.badgeLabel}/></span>
      <span className="pl-dock__label">{it.label}</span>
    </a>
  );
  if (bar) {
    const market = { id: "home", label: "Market", href: home.href, mark: true };
    return <nav aria-label="Main" className="pl-dock pl-dock--bar">{[market, ...items].map(item)}</nav>;
  }
  return (
    <nav aria-label="Main" className="pl-dock">
      <a className="pl-dock__logo" href={home.href} aria-label={home.label} aria-current={current === "home" ? "page" : undefined}
        onClick={(e) => go(e, { id: "home", href: home.href })}><PlateLogo/></a>
      <span aria-hidden="true" className="pl-dock__rule"/>
      {items.map(item)}
      {ask ? <><span aria-hidden="true" className="pl-dock__sep"/>{item({ id: "ask", icon: "ask", label: "Ask draft", ...ask })}</> : null}
    </nav>
  );
}

/** One chip: today's new drafts as 10 squares ("3 left"), or the run (days with a send this week). */
export function NavChip({ kind = "drafts", used = 0, of = 10, days = [], href, label }) {
  if (kind === "run") {
    const lit = days.filter((d) => d === "lit").length;
    return (
      <a className="pl-chip" href={href} aria-label={label || `This week: applications sent on ${lit} of ${days.length} days`}>
        {days.map((d, i) => <span key={i} className={`pl-sq pl-sq--run${d === "today" ? " at-tick" : ""}`} data-s={d === "lit" ? "lit" : d === "today" ? "today" : undefined}/>)}
        <span className="pl-chip__text">{lit}</span>
      </a>
    );
  }
  const left = Math.max(0, of - used);
  return (
    <a className="pl-chip" href={href} aria-label={label || `New drafts today: ${used} of ${of} used, ${left} left. Re-runs are free`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className="pl-sq" data-s={i < used ? "ink" : undefined}/>)}
      <span className="pl-chip__text">{left} left</span>
    </a>
  );
}

/** Search with Ctrl K (the placeholder is the area's: "Company, role, tech…", "Company or role…", "Make sense of…"). */
export function NavSearch({ placeholder, value, onChange, onSubmit, inputRef }) {
  const own = useRef(null);
  const ref = inputRef || own;
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [ref]);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(ref.current?.value || ""); }} style={{ display: "contents" }}>
      <label className="pl-search">
        <Icon name="search" size={15} stroke={2}/>
        <span className="pl-sr">Search</span>
        <input ref={ref} type="search" className="pl-search__input" placeholder={placeholder} value={value} onChange={onChange}/>
        <span className="pl-kbd" aria-hidden="true">Ctrl K</span>
      </label>
    </form>
  );
}

/**
 * THE AREA NAV — one component for every area (the addendum (c)).
 * `pill` = { tag, name, panel } only where the area has a panel to open (the ledger, Atlas — the market has none);
 * `views` = [{ id, label, href, icon }]; `more` = [{ label, href }]; `search` = { placeholder, … }; `chip` = NavChip props.
 * ⛔ No avatar here: Profile lives in the dock only (the addendum (d)).
 */
export function AreaNav({ area, pill, views = [], current, more = [], search, chip, onGo, phone = false, ...s }) {
  const [open, setOpen] = useState(null);   // "pill" | "more" | null
  const gate = plateState(s, { height: 70, radius: "small", label: `Loading ${area}`, lines: 2 });
  if (gate) return gate;
  const go = (e, v) => {
    if (!onGo || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault(); onGo(v.id, v.href);
  };
  const viewLinks = views.map((v) => (
    <a key={v.id} className="pl-areanav__link" href={v.href} aria-current={current === v.id ? "page" : undefined} onClick={(e) => go(e, v)}>
      {phone ? null : <Icon name={v.icon} size={16}/>}{v.label}
    </a>
  ));
  const pillButton = pill ? (
    <button type="button" className="pl-areanav__pill" aria-expanded={open === "pill"} aria-haspopup="true" onClick={() => setOpen(open === "pill" ? null : "pill")}>
      <span className="pl-areanav__tag">{pill.tag}</span><span className="pl-areanav__pillname">{pill.name}</span><Icon name="chevron" size={12} stroke={2.4}/>
    </button>
  ) : null;
  const menu = (which, body) => open === which ? <div className="pl-menu pl-drop" role="menu">{body}</div> : null;
  if (phone) {
    return (
      <header className="pl-areanav" aria-label={area}>
        <div className="pl-topbar">
          <PlateLogo/>
          {pillButton}
          <span className="pl-grow"/>
          <button type="button" className="pl-btn pl-btn--icon pl-btn--flat" aria-label="Search" onClick={() => search?.onOpen?.()}><Icon name="search" size={16} stroke={2}/></button>
        </div>
        {menu("pill", pill?.panel)}
        <Ruler size="phone"/>
        <nav aria-label={area} className="pl-viewscroll">{viewLinks}</nav>
      </header>
    );
  }
  return (
    <header className="pl-areanav">
      <div className="pl-areanav__row">
        {pill ? <span style={{ position: "relative" }}>{pillButton}{menu("pill", pill.panel)}</span> : null}
        <nav aria-label={area} className="pl-areanav__views">
          {viewLinks}
          {more.length ? (
            <span style={{ position: "relative" }}>
              <button type="button" className="pl-areanav__more" aria-expanded={open === "more"} aria-haspopup="true" onClick={() => setOpen(open === "more" ? null : "more")}>
                More <Icon name="chevron" size={12} stroke={2.4}/>
              </button>
              {menu("more", more.map((m) => <a key={m.label} role="menuitem" className="pl-areanav__link" href={m.href}>{m.label}</a>))}
            </span>
          ) : null}
        </nav>
        <div className="pl-areanav__end">
          {search ? <NavSearch {...search}/> : null}
          {chip ? <NavChip {...chip}/> : null}
        </div>
      </div>
      <Ruler/>
    </header>
  );
}

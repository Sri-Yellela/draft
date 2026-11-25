// ⭐ D196 · THE SHELL (canvas v3 "The shell", the addendum): the retained dock + one Atlas-style nav per area.
// The dock = where you are in draft (never changes); the area nav = what you can do here.
// Built from the board's markup: the dock 84 px, items 58 px with 20 px icons and 11.5 px labels, the active item a white
// tile with a 3 px shadow; the area nav's views as links with 16 px icons, More, search with Ctrl K, one chip, the 12 px ruler.
// ⛔ The dock's ITEMS are the caller's (P5 passes the app's own list — D167's order and badges); this file only draws them.
// ⭐ D197 Wave 1 #1 (47i): THIS is the live dock — components/AppNav.jsx (the app's navigation, its state and behaviour)
// renders this Dock as the rail (≥ 980 px, A237) and as the phone's bottom bar; there is no second dock (A93). An item may
// be a link (`href`) or a button (`onPress` — Profile opens the peek, Ask draft opens Tiny), and carries the caller's
// own attributes (`attrs`: the data-nav-item hooks the walks read).
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { plateState } from "./PlateState.jsx";

/** The /d mark: ink d, clay slash, on a white 1.5 px-bordered tile (44 px in the dock, 40 px on the phone's top bar, 28 px favicon). */
export function PlateLogo({ size = "dock" }) {
  const cls = size === "favicon" ? " pl-logo--sm" : "";   // the phone's 40 px tile is .pl-topbar .pl-logo
  return (
    <span aria-hidden="true" className={`pl-logo${cls}`}>
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
  return <span className="pl-badge" title={label}><span aria-hidden="true">{n > 9 ? "9+" : n}</span><span className="pl-sr">{`, ${label || `${n} new`}`}</span></span>;
}

function DockIcon({ item, size }) {
  if (item.img) return <img className="pl-avatar pl-avatar--img" src={item.img} alt=""/>;
  if (item.initials) return <span className="pl-avatar" aria-hidden="true">{item.initials}</span>;
  if (item.mark) return <span className="pl-dock__mark" aria-hidden="true"><span className="pl-logo__slash">/</span>d</span>;
  return <Icon name={item.icon} size={size}/>;
}

const plainClick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * The dock. `home` = the /d tile's link (the market: { id, href, label, attrs }); `items` = [{ id, label, href | onPress,
 * icon | initials | img, badge, badgeLabel, attrs, itemRef }] in the app's order; `ask` = the Ask draft item after the rule.
 * `current` = the id that is aria-current (home.id for /d). `bar` = the phone's bottom bar: the same items and badges
 * (Ask draft by long-press or from search — not on the bar). `navRef` / `navProps` go on the <nav> (the caller's state).
 */
export function Dock({ home = { href: "/app/jobs", label: "draft — the market" }, items = [], ask, current, bar = false, onGo, navRef, navProps, ...s }) {
  const gate = plateState(s, { height: 420, radius: "plate", label: "Loading the dock" });
  if (gate) return gate;
  const homeId = home.id || "home";
  const go = (e, it) => {
    if (!onGo || !plainClick(e)) return;
    e.preventDefault(); onGo(it.id, it.href);
  };
  const item = (it) => {
    const inner = (
      <>
        <span className="pl-dock__icon"><DockIcon item={it} size={bar ? 19 : 20}/><DockBadge n={it.badge} label={it.badgeLabel}/></span>
        <span className="pl-dock__label">{it.label}</span>
      </>
    );
    const common = { key: it.id, className: "pl-dock__item", "data-dock-item": it.id, ref: it.itemRef || undefined, ...(it.attrs || null) };
    if (it.onPress && !it.href) return <button type="button" {...common} onClick={it.onPress}>{inner}</button>;
    return (
      <a {...common} href={it.href} aria-current={current === it.id ? "page" : undefined}
        onClick={(e) => { if (it.onPress) { if (plainClick(e)) { e.preventDefault(); it.onPress(e); } return; } go(e, it); }}>{inner}</a>
    );
  };
  if (bar) {
    const market = { id: homeId, label: "Market", href: home.href, mark: true, attrs: home.attrs };
    return <nav aria-label="Main" className="pl-dock pl-dock--bar" ref={navRef} {...(navProps || null)}>{[market, ...items].map(item)}</nav>;
  }
  return (
    <nav aria-label="Main" className="pl-dock" ref={navRef} {...(navProps || null)}>
      <a className="pl-dock__logo" href={home.href} aria-label={home.label} aria-current={current === homeId ? "page" : undefined}
        {...(home.attrs || null)} onClick={(e) => go(e, { id: homeId, href: home.href })}><PlateLogo/></a>
      <span aria-hidden="true" className="pl-dock__rule"/>
      {items.map(item)}
      {ask ? <><span aria-hidden="true" className="pl-dock__sep"/>{item({ id: "ask", icon: "ask", label: "Ask draft", ...ask })}</> : null}
    </nav>
  );
}

/** One chip: today's new drafts as 10 squares ("3 left"), or the run (days with a send this week). */
export function NavChip({ kind = "drafts", used = 0, of = 10, days = [], href, label, onGo }) {
  const click = onGo ? (e) => { if (plainClick(e)) { e.preventDefault(); onGo(href); } } : undefined;
  if (kind === "run") {
    const lit = days.filter((d) => d === "lit").length;
    return (
      <a className="pl-chip" href={href} onClick={click} aria-label={label || `This week: applications sent on ${lit} of ${days.length} days`}>
        {days.map((d, i) => <span key={i} className={`pl-sq pl-sq--run${d === "today" ? " at-tick" : ""}`} data-s={d === "lit" ? "lit" : d === "today" ? "today" : undefined}/>)}
        <span className="pl-chip__text">{lit}</span>
      </a>
    );
  }
  const left = Math.max(0, of - used);
  return (
    <a className="pl-chip" href={href} onClick={click} data-nav-chip="drafts" aria-label={label || `New drafts today: ${used} of ${of} used, ${left} left. Re-runs are free`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className="pl-sq" data-s={i < used ? "ink" : undefined}/>)}
      <span className="pl-chip__text">{left} left</span>
    </a>
  );
}

// ⭐ D197 #1 (shell.md §6 item 5) · ONE Ctrl / Cmd K for the whole page: every search that wants the shortcut registers here,
// and the one window listener hands the key to the newest one still on screen (two area navs on a page no longer fight).
const SHORTCUT_TARGETS = [];
function onShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || !(e.key === "k" || e.key === "K")) return;
  const target = [...SHORTCUT_TARGETS].reverse().find((t) => t.ready());
  if (!target) return;
  e.preventDefault();
  target.focus();
}
/** Register `focus` for Ctrl / Cmd K while mounted; `ready()` says whether it can take it now (on screen). */
export function useSearchShortcut(focus, ready = () => true) {
  const ref = useRef({ focus, ready });
  ref.current.focus = focus; ref.current.ready = ready;
  useEffect(() => {
    const entry = { focus: () => ref.current.focus(), ready: () => ref.current.ready() };
    SHORTCUT_TARGETS.push(entry);
    if (SHORTCUT_TARGETS.length === 1) window.addEventListener("keydown", onShortcut);
    return () => {
      const i = SHORTCUT_TARGETS.indexOf(entry);
      if (i >= 0) SHORTCUT_TARGETS.splice(i, 1);
      if (!SHORTCUT_TARGETS.length) window.removeEventListener("keydown", onShortcut);
    };
  }, []);
}
const onScreen = (el) => !!el && el.getClientRects().length > 0;

/**
 * Search with Ctrl K (the placeholder is the area's: "Company, role, tech…", "Company or role…", "Make sense of…").
 * `renderInput(props)` lets the app put its own input in the box (the dock's people / companies / roles suggest); it gets
 * the input's className, placeholder and ref.
 */
export function NavSearch({ placeholder, value, onChange, onSubmit, inputRef, renderInput }) {
  const own = useRef(null);
  const ref = inputRef || own;
  useSearchShortcut(() => ref.current?.focus(), () => onScreen(ref.current));
  const input = renderInput
    ? renderInput({ className: "pl-search__input", placeholder, ref })
    : <input ref={ref} type="search" className="pl-search__input" placeholder={placeholder} value={value} onChange={onChange}/>;
  const box = (
    <label className="pl-search">
      <Icon name="search" size={15} stroke={2}/>
      <span className="pl-sr">Search</span>
      {input}
      <span className="pl-kbd" aria-hidden="true">Ctrl K</span>
    </label>
  );
  if (renderInput) return <div role="search" className="pl-search__wrap">{box}</div>;
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(ref.current?.value || ""); }} style={{ display: "contents" }}>
      {box}
    </form>
  );
}

/**
 * THE AREA NAV — one component for every area (the addendum (c)).
 * `pill` = { tag, name, panel } only where the area has a panel to open (the ledger, Atlas — the market has none);
 * `views` = [{ id, label, href, icon }]; `more` = [{ label, href }]; `search` = { placeholder, renderInput, onOpen, … };
 * `chip` = NavChip props. `phone` = the phone's top bar (the /d tile, the pill, a search button) over the views' scroller.
 * ⛔ No avatar here: Profile lives in the dock only (the addendum (d)).
 * ⭐ D197 #1 (§6 item 5): an open menu (the pill's panel, More) closes on Esc (focus back on its button) and on a press
 * outside it.
 */
export function AreaNav({ area, pill, views = [], current, more = [], search, chip, onGo, phone = false, home, ...s }) {
  const [open, setOpen] = useState(null);   // "pill" | "more" | null
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(null);
      rootRef.current?.querySelector(open === "pill" ? ".pl-areanav__pill" : ".pl-areanav__more")?.focus({ preventScroll: true });
    };
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(null); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown); };
  }, [open]);
  const gate = plateState(s, { height: 70, radius: "small", label: `Loading ${area}`, lines: 2 });
  if (gate) return gate;
  const go = (e, v) => {
    setOpen(null);
    if (!onGo || !plainClick(e)) return;
    e.preventDefault(); onGo(v.id, v.href);
  };
  const viewLinks = views.map((v) => (
    <a key={v.id} className="pl-areanav__link" href={v.href} data-area-view={v.id} aria-current={current === v.id ? "page" : undefined} onClick={(e) => go(e, v)}>
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
    const logo = home ? <a className="pl-topbar__logo" href={home.href} aria-label={home.label} onClick={(e) => go(e, { id: home.id || "home", href: home.href })}><PlateLogo size="phone"/></a> : <PlateLogo size="phone"/>;
    return (
      <header className="pl-areanav pl-areanav--phone" aria-label={area} ref={rootRef}>
        <div className="pl-topbar">
          {logo}
          {pill ? <span className="pl-rel">{pillButton}{menu("pill", pill.panel)}</span> : null}
          <span className="pl-grow"/>
          {search ? <button type="button" className="pl-btn pl-btn--icon pl-btn--flat" aria-label="Search" data-area-search-open="" onClick={() => search.onOpen?.()}><Icon name="search" size={16} stroke={2}/></button> : null}
        </div>
        {search?.sheet || null}
        <Ruler size="phone"/>
        {views.length ? <nav aria-label={area} className="pl-viewscroll">{viewLinks}</nav> : null}
      </header>
    );
  }
  return (
    <header className="pl-areanav" ref={rootRef}>
      <div className="pl-areanav__row">
        {pill ? <span className="pl-rel">{pillButton}{menu("pill", pill.panel)}</span> : null}
        {views.length || more.length ? (
          <nav aria-label={area} className="pl-areanav__views">
            {viewLinks}
            {more.length ? (
              <span className="pl-rel">
                <button type="button" className="pl-areanav__more" aria-expanded={open === "more"} aria-haspopup="true" onClick={() => setOpen(open === "more" ? null : "more")}>
                  More <Icon name="chevron" size={12} stroke={2.4}/>
                </button>
                {menu("more", more.map((m) => <a key={m.label} role="menuitem" className="pl-areanav__link" href={m.href} onClick={(e) => go(e, { id: m.id || m.label, href: m.href })}>{m.label}</a>))}
              </span>
            ) : null}
          </nav>
        ) : null}
        <div className="pl-areanav__end">
          {search ? <NavSearch {...search}/> : null}
          {chip ? <NavChip {...chip} onGo={chip.onGo}/> : null}
        </div>
      </div>
      <Ruler/>
    </header>
  );
}

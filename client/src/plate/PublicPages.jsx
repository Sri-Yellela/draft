// ⭐ D197 Wave 2 · #16 / #22 (47j, lane w2-public) · the signed-out chrome (the plate for a drawing not yet drawn is Drawings.jsx's DrawingToCome).
//   PublicNav      — the public nav: the /draft wordmark, the public links, Sign in, Get started (the page's one clay point),
//                    the 12 px ruler; signed in, Open draft / Admin / Sign out; on a phone, the /d tile + a Menu drop. It
//                    replaces components/NavBar.jsx at M5 (docs/revamp/public.md §5b) — every item there has a home here.
// Built only from the library's classes (plate.css: the area nav, buttons, menu, plate hero frame) — no new look.
import { useEffect, useRef, useState } from "react";
import { PlateLogo, Wordmark, Ruler } from "./Shell.jsx";
import { plateState } from "./PlateState.jsx";

const plainClick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * The public nav. `links` = [{ id, label, href }] (the caller decides — Pricing only while monetisation is on); `current` =
 * the id that is aria-current; `user` = null signed out, or { admin } signed in; `signIn` = { href, onPress } (onPress opens
 * the inline sign-in popover; `wrap(button)` returns the button wrapped — the live popover); `getStarted` = { href, label }; `clay` = false turns Get started ink (a page whose own clay
 * point is elsewhere — the survey sheet); `phone` = the phone's top bar with a Menu drop; `menuOpen` = the drop's first state.
 */
export function PublicNav({ home = { href: "/", label: "draft — home" }, links = [], current, user = null, signIn = { href: "/login" },
  getStarted = { href: "/register", label: "Get started" }, clay = true, phone = false, menuOpen = false, onGo, onSignOut, ...s }) {
  const [open, setOpen] = useState(!!menuOpen);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); rootRef.current?.querySelector("[data-public-menu]")?.focus({ preventScroll: true }); } };
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown); };
  }, [open]);
  const gate = plateState(s, { height: 70, radius: "small", label: "Loading the navigation", lines: 2 });
  if (gate) return gate;
  const go = (e, href) => { setOpen(false); if (!onGo || !plainClick(e)) return; e.preventDefault(); onGo(href); };
  const start = <a className={`pl-btn ${clay ? "pl-btn--primary" : "pl-btn--ink"}`} href={getStarted.href} data-public-start="" onClick={(e) => go(e, getStarted.href)}>{getStarted.label}</a>;
  // 47m (M5): `signIn.wrap` — the live page's inline sign-in popover wraps the button (components/InlineLoginPopover's trigger)
  const signInBtn = signIn.onPress || signIn.wrap
    ? <button type="button" className="pl-btn pl-btn--paper" data-public-signin="" onClick={signIn.onPress}>Sign in</button> : null;
  const signInEl = signIn.wrap ? signIn.wrap(signInBtn) : signIn.onPress
    ? <button type="button" className="pl-btn pl-btn--paper" data-public-signin="" onClick={signIn.onPress}>Sign in</button>
    : <a className="pl-btn pl-btn--paper" href={signIn.href} data-public-signin="" onClick={(e) => go(e, signIn.href)}>Sign in</a>;
  const account = user ? (
    <>
      <a className="pl-btn pl-btn--ink" href="/app" onClick={(e) => go(e, "/app")}>Open draft</a>
      {user.admin ? <a className="pl-btn pl-btn--paper" href="/admin" onClick={(e) => go(e, "/admin")}>Admin</a> : null}
      <button type="button" className="pl-btn pl-btn--paper" onClick={() => { setOpen(false); onSignOut?.(); }}>Sign out</button>
    </>
  ) : <>{signInEl}{start}</>;
  const linkEls = (menu) => links.map((l) => (
    <a key={l.id || l.href} className="pl-areanav__link" href={l.href} role={menu ? "menuitem" : undefined}
      aria-current={current === (l.id || l.href) ? "page" : undefined} onClick={(e) => go(e, l.href)}>{l.label}</a>
  ));
  if (phone) {
    return (
      <header className="pl-areanav pl-areanav--phone" aria-label="Site" ref={rootRef} data-public-nav="phone">
        <div className="pl-topbar">
          <a className="pl-topbar__logo" href={home.href} aria-label={home.label} onClick={(e) => go(e, home.href)}><PlateLogo size="phone"/></a>
          <span className="pl-grow"/>
          {user ? null : start}
          <span className="pl-rel">
            <button type="button" className="pl-btn pl-btn--paper" aria-expanded={open} aria-haspopup="true" data-public-menu="" onClick={() => setOpen(!open)}>Menu</button>
            {open ? (
              <div className="pl-menu pl-drop" role="menu" style={{ right: 0 }}>
                {linkEls(true)}
                <div aria-hidden="true" style={{ borderTop: "var(--pl-border-rule)", margin: "6px 0" }}/>
                {user ? account : signInEl}
              </div>
            ) : null}
          </span>
        </div>
        <Ruler size="phone"/>
      </header>
    );
  }
  return (
    <header className="pl-areanav" ref={rootRef} data-public-nav="">
      <div className="pl-areanav__row">
        <a href={home.href} aria-label={home.label} onClick={(e) => go(e, home.href)} style={{ textDecoration: "none", marginRight: 12 }}><Wordmark/></a>
        {links.length ? <nav aria-label="Site" className="pl-areanav__views">{linkEls(false)}</nav> : null}
        <div className="pl-areanav__end">{account}</div>
      </div>
      <Ruler/>
    </header>
  );
}

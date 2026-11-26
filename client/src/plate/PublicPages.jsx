// ⭐ D197 Wave 2 · #16 / #22 (47j, lane w2-public) · the signed-out chrome and the plate for a drawing not yet drawn.
//   PublicNav      — the public nav: the /draft wordmark, the public links, Sign in, Get started (the page's one clay point),
//                    the 12 px ruler; signed in, Open draft / Admin / Sign out; on a phone, the /d tile + a Menu drop. It
//                    replaces components/NavBar.jsx at M5 (docs/revamp/public.md §5b) — every item there has a home here.
//   UnchartedPlate — a labelled placeholder plate where a page's drawing is still to come (role="img", "drawing to come: …"):
//                    paper, a faint grid, contours that stop at a dashed edge. Never a finished drawing — M4 / the owner
//                    replaces it with a ported or new one.
// Built only from the library's classes (plate.css: the area nav, buttons, menu, plate hero frame) — no new look.
import { useEffect, useRef, useState } from "react";
import { PlateLogo, Wordmark, Ruler } from "./Shell.jsx";
import { plateState } from "./PlateState.jsx";

const plainClick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/**
 * The public nav. `links` = [{ id, label, href }] (the caller decides — Pricing only while monetisation is on); `current` =
 * the id that is aria-current; `user` = null signed out, or { admin } signed in; `signIn` = { href, onPress } (onPress opens
 * the inline sign-in popover); `getStarted` = { href, label }; `clay` = false turns Get started ink (a page whose own clay
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
  const signInEl = signIn.onPress
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

/**
 * A plate whose drawing is still to come: the frame at its fixed aspect (nothing shifts when the drawing lands), a faint
 * grid with A–G / 1–5 references, contours that stop at a dashed edge, and the words DRAWING TO COME + what it will show.
 * `label` = what the drawing will show (it becomes the aria-label "drawing to come: <label>"); `caption` = the strip under it.
 */
export function UnchartedPlate({ label = "a drawing", aspect = "640 / 360", caption, ...s }) {
  const gate = plateState(s, { height: 240, radius: "hero", label: "Loading the plate" });
  if (gate) return gate;
  const ink = { stroke: "var(--pl-muted)" };
  return (
    <figure className="pl-platehero" data-uncharted="" style={{ margin: 0 }}>
      <div className="pl-platehero__frame" style={{ "--pl-aspect": aspect }}>
        <svg role="img" aria-label={`drawing to come: ${label}`} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
          <g fill="none" strokeWidth=".5" opacity=".35" style={ink}>
            {[1, 2, 3, 4, 5, 6].map((i) => <line key={`v${i}`} x1={i * 91} y1="0" x2={i * 91} y2="360"/>)}
            {[1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="0" y1={i * 72} x2="640" y2={i * 72}/>)}
          </g>
          <g fontFamily="var(--pl-mono)" fontSize="10" opacity=".6" style={{ fill: "var(--pl-muted)" }}>
            {"ABCDEFG".split("").map((c, i) => <text key={c} x={i * 91 + 40} y="14">{c}</text>)}
            {[1, 2, 3, 4, 5].map((n) => <text key={n} x="6" y={n * 72 - 30}>{n}</text>)}
          </g>
          <g fill="none" strokeWidth="1.2" style={ink}>
            <path d="M0 250 C90 220 160 270 250 236 C300 218 330 230 360 224"/>
            <path d="M0 290 C100 262 170 306 262 270 C310 252 340 262 360 258"/>
            <path d="M40 200 C110 168 190 214 270 186 C310 172 340 180 360 176"/>
          </g>
          <line x1="360" y1="20" x2="360" y2="340" strokeWidth="1.6" strokeDasharray="6 6" style={{ stroke: "var(--pl-ink)" }}/>
          <text x="384" y="170" fontFamily="var(--pl-mono)" fontSize="12" fontWeight="700" letterSpacing="2" style={{ fill: "var(--pl-ink)" }}>DRAWING TO COME</text>
          <text x="384" y="196" fontFamily="var(--pl-serif)" fontStyle="italic" fontSize="17" style={{ fill: "var(--pl-ink-soft)" }}>{String(label).slice(0, 34)}</text>
        </svg>
      </div>
      {caption ? <figcaption className="pl-platehero__cap">{caption}</figcaption> : null}
    </figure>
  );
}

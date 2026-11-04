// ⭐ D145 STEP 3 · THE APP'S NAVIGATION — a Dock or a Menu, the user's choice (owner 11-03, declutter-v7: "navigation as
// a user choice: Dock (bottom, rises on approach) or Menu (top right, side panel with the dock's buttons)").
//
// Replaces the top bar's row of five tabs (removed). Settings → Appearance → Navigation (shared/appearance.js
// `navigation`: auto · dock · menu; "auto" = Dock on a computer, Menu on a phone). WHICH ONE SHOWS IS CSS
// (AppNav.css reads data-navigation through custom properties), so a live change of the option — and the Customise
// preview — needs no state here.
//
//   Dock — a bar at the bottom centre that RISES when the pointer nears the bottom edge and hides again; always up on a
//          touch screen (there is no pointer to approach with) and while it holds focus. Each button: the section name +
//          a small plain line ("Daily Deck · today's jobs"); the current one raised.
//   Menu — a Menu button at the top right (in the bar); it opens a side panel from the right whose buttons are EXACTLY
//          the dock's (one list, one <NavItems>); closes with Close, a click outside, Esc; M toggles it.
// ⛔ No symbols or icons in either (D145 row). ⛔ Real links (AH2): ctrl / middle click opens a new tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AppNav.css";

// The plain line under each section name (D145 Step 2 rule 5: feature names stay, paired with plain words).
export const NAV_PLAIN = Object.freeze({
  // ⭐ D146: one entry for every application — Draft House and The Table merged.
  today: "today's jobs", console: "every job", "auto-apply" : "your applications", atlas: "your skills",   // (the id, spaced for the D6 guard)
});
// How near the bottom edge the pointer must come before the dock rises, and how far above it before it falls.
export const DOCK_REVEAL_PX = 72;
const DOCK_HIDE_PX = 150;

function NavItems({ tabs, activeTab, hrefForTab, onGo }) {
  return (tabs || []).map((t) => (
    <a key={t.id} className="appnav-item" href={hrefForTab?.(t.id) || undefined} data-nav-item={t.id}
      aria-current={activeTab === t.id ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onGo(t.id);
      }}>
      <span className="appnav-name">
        {t.label}
        {t.badge > 0 && (
          <span className="appnav-badge" title={t.badgeLabel}>
            <span aria-hidden="true">{t.badge}</span><span className="sr-only">{`, ${t.badgeLabel}`}</span>
          </span>
        )}
      </span>
      <small className="appnav-plain">{NAV_PLAIN[t.id] || ""}</small>
    </a>
  ));
}

// ⭐ D149 (owner 11-03): the top bar is gone, and its account menu is "Profile — you and your résumé", the last button
// of the Dock and of the Menu (the sketch's Menu has it). `profile` = { onOpen, badge, badgeLabel } (TopBar's).
function ProfileItem({ profile, onPress }) {
  if (!profile) return null;
  return (
    <button type="button" className="appnav-item" data-nav-item="profile" aria-haspopup="dialog" onClick={onPress}>
      <span className="appnav-name">
        Profile
        {profile.badge > 0 && (
          <span className="appnav-badge" title={profile.badgeLabel}>
            <span aria-hidden="true">{profile.badge > 9 ? "9+" : profile.badge}</span><span className="sr-only">{`, ${profile.badgeLabel}`}</span>
          </span>
        )}
      </span>
      <small className="appnav-plain">you and your résumé</small>
    </button>
  );
}

export default function AppNav({ tabs = [], activeTab, hrefForTab, onTabChange, profile = null }) {
  const [up, setUp] = useState(false);          // the dock, risen
  const [open, setOpen] = useState(false);      // the menu's side panel
  const dockRef = useRef(null), menuBtnRef = useRef(null), panelRef = useRef(null);
  const go = useCallback((id) => { setOpen(false); onTabChange?.(id); }, [onTabChange]);

  // The dock rises as the pointer nears the bottom edge — a window listener, not an invisible strip over the page (a
  // strip would swallow clicks on whatever sits at the bottom, the deck's Pass · Save · Draft among them).
  useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const fromBottom = window.innerHeight - e.clientY;
        const over = dockRef.current?.contains(e.target);
        if (fromBottom <= DOCK_REVEAL_PX) setUp(true);
        else if (!over && fromBottom > DOCK_HIDE_PX) setUp(false);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    // Shown once on arrival, so a first visit learns where it lives.
    setUp(true);
    const t = setTimeout(() => setUp(false), 1600);
    return () => { window.removeEventListener("mousemove", onMove); clearTimeout(t); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ⭐ The risen dock LIFTS what sticks to the bottom of the screen (the deck's Pass · Save · Draft, when an open card has
  // them sticking): its height is published as --appnav-lift on <html>, 0 while it is down or not the navigation.
  useEffect(() => {
    const el = dockRef.current, root = document.documentElement;
    const shown = el && getComputedStyle(el).display !== "none" && (up || el.matches(":focus-within") || matchMedia("(hover: none)").matches);
    root.style.setProperty("--appnav-lift", shown ? `${Math.ceil(el.getBoundingClientRect().height) + 18}px` : "0px");
  }, [up]);
  useEffect(() => () => document.documentElement.style.removeProperty("--appnav-lift"), []);

  // The menu: Esc closes; M toggles — only while the Menu button is the navigation on screen (CSS decides), and never
  // while typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) { setOpen(false); menuBtnRef.current?.focus({ preventScroll: true }); return; }
      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        if (el?.closest?.("input,textarea,select,[contenteditable=''],[contenteditable='true']")) return;
        const btn = menuBtnRef.current;
        if (!btn || getComputedStyle(btn).display === "none") return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (open) panelRef.current?.querySelector("a,button")?.focus({ preventScroll: true }); }, [open]);

  const body = typeof document !== "undefined" ? document.body : null;
  return (
    <>
      <button type="button" ref={menuBtnRef} className="appnav-menu-btn" data-nav-menu-button=""
        aria-haspopup="true" aria-expanded={open} aria-controls="appnav-panel" aria-keyshortcuts="M" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      {body && createPortal(
        <>
          <nav aria-label="Main" ref={dockRef} className="appnav-dock" data-nav-dock="" data-up={up ? "true" : "false"}
            onFocus={() => setUp(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setUp(false); }}
            onMouseLeave={(e) => { if (window.innerHeight - e.clientY > DOCK_REVEAL_PX) setUp(false); }}>
            <NavItems tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onGo={go} />
            <ProfileItem profile={profile} onPress={() => profile?.onOpen?.()} />
          </nav>
          <div className="appnav-scrim" data-open={open ? "true" : "false"} aria-hidden="true" onClick={() => setOpen(false)} />
          <nav aria-label="Main menu" id="appnav-panel" ref={panelRef} className="appnav-panel" data-nav-panel="" data-open={open ? "true" : "false"}
            {...(open ? null : { inert: "", "aria-hidden": true })}>
            <button type="button" className="appnav-close" onClick={() => { setOpen(false); menuBtnRef.current?.focus({ preventScroll: true }); }}>Close</button>
            <NavItems tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onGo={go} />
            <ProfileItem profile={profile} onPress={() => { setOpen(false); profile?.onOpen?.(); }} />
          </nav>
        </>, body)}
    </>
  );
}

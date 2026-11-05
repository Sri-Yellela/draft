// ⭐ D145 STEP 3 · THE APP'S NAVIGATION — a Dock or a Menu, the user's choice (owner 11-03, declutter-v7: "navigation as
// a user choice: Dock (bottom, rises on approach) or Menu (top right, side panel with the dock's buttons)").
//
// Replaces the top bar's row of five tabs (removed). Settings → Appearance → Navigation (shared/appearance.js
// `navigation`: auto · dock · menu; "auto" = the Dock). WHICH ONE SHOWS IS CSS (AppNav.css reads data-navigation
// through custom properties), so a live change of the option — and the Customise preview — needs no state here.
//
//   Dock — ⭐ D156 (3) / (1b) (owner 11-05: "use symbols for the menu dock: a home, a globe like atlas icon, draft icon
//          replaces the draft house title and symbol, slash for short and draft for long, profile pic for the profile,
//          these would expand to full names when hovering"): a SLIM RAIL on the left edge, ALWAYS VISIBLE — four icons
//          of one size (DOCK_ICON_PX): a house (Home) and a globe (Atlas) drawn in the current theme's accent, the short
//          logo "/d" (your applications — "draft" when expanded) and the person's picture (initials when there is none).
//          Hover or keyboard focus expands it to the full names with their plain lines, and the page moves over to make
//          room (`data-dock-open` on <html>; AppNav.css pads the app shell) — it never covers the page. Badges are small
//          numbers on the icons. Supersedes D152 (4)'s hidden dock with the embossed logo.
//          ⭐ D156 (1c) (owner 11-05: "flip the draft icon and home … home is where you have your dashboard, draft is where
//          the jobs are"): the order and the names are SWAPPED — "/d" · draft · today's picks and every job (this page,
//          the jobs) first; the house · Home · your dashboard and applications (the tracker, with its badge); the globe ·
//          Atlas; the picture · Profile. The route ids are unchanged (today = the jobs, auto-apply = the tracker).
//   Menu — a Menu button at the top right (in the bar); it opens a side panel from the right whose buttons are EXACTLY
//          the dock's (one list, one <NavItems>); closes with Close, a click outside, Esc; M toggles it.
// ⛔ Real links (AH2): ctrl / middle click opens a new tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DraftMark } from "./DraftMark.jsx";
import { useAccountAvatar } from "../lib/accountAvatar.js";
import "./AppNav.css";

// The plain line under each section name (D145 Step 2 rule 5: feature names stay, paired with plain words).
export const NAV_PLAIN = Object.freeze({
  // ⭐ D146: one entry for every application — Draft House and The Table merged.
  // ⭐ D152 (4): one entry, Home — the deck and every job on one screen.
  today: "today's picks and every job", console: "every job", "auto-apply" : "your dashboard and applications", atlas: "your skills",   // (the id, spaced for the D6 guard)
});
// ⭐ D156 (1b): all four icons the same size.
export const DOCK_ICON_PX = 30;
// ⭐ D156 (3): "slash for short and draft for long" — the short logo "/d", expanded "draft". ⭐ D156 (1c): it is the JOBS
// page's entry now ("draft is where the jobs are"), and the tracker's is the house, "Home". The Menu's panel says the same
// names, so the two navigations never disagree about which page is Home.
export const DOCK_NAMES = Object.freeze({ today: "draft", "auto-apply" : "Home" });   // (the id, spaced for the D6 guard)

// The house and the globe: line drawings in the theme's accent (AppNav.css strokes them with --c-accent).
function HouseIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 10.6 12 3.8l8.5 6.8" /><path d="M5.8 9v10.6h4.5v-5.8h3.4v5.8h4.5V9" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6S9.6 5.8 12 3.4Z" />
    </svg>
  );
}
const ICONS = { today: () => <DraftMark />, console: () => <DraftMark />, atlas: () => <GlobeIcon />, "auto-apply" : () => <HouseIcon /> };   // (the id, spaced for the D6 guard)

function Badge({ n, label }) {
  if (!(n > 0)) return null;
  return (
    <span className="appnav-badge" title={label}>
      <span aria-hidden="true">{n > 9 ? "9+" : n}</span><span className="sr-only">{`, ${label}`}</span>
    </span>
  );
}

function NavItems({ tabs, activeTab, hrefForTab, onGo, dock = false }) {
  return (tabs || []).map((t) => {
    const Icon = ICONS[t.id];
    const name = DOCK_NAMES[t.id] || t.label;
    return (
      <a key={t.id} className="appnav-item" href={hrefForTab?.(t.id) || undefined} data-nav-item={t.id}
        aria-current={activeTab === t.id ? "page" : undefined} {...(dock ? { "aria-label": `${name} — ${NAV_PLAIN[t.id] || ""}` } : null)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onGo(t.id);
        }}>
        {dock && Icon && <span className="appnav-ico" data-nav-icon={t.id}><Icon /><Badge n={t.badge} label={t.badgeLabel} /></span>}
        <span className="appnav-words">
          <span className="appnav-name">
            {name}
            {!dock && <Badge n={t.badge} label={t.badgeLabel} />}
          </span>
          <small className="appnav-plain">{NAV_PLAIN[t.id] || ""}</small>
        </span>
      </a>
    );
  });
}

const initialsOf = (name) => String(name || "").trim().split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

// ⭐ D149 (owner 11-03): the top bar is gone, and its account menu is "Profile — you and your résumé", the last button
// of the Dock and of the Menu (the sketch's Menu has it). `profile` = { onOpen, badge, badgeLabel, name } (TopBar's).
// ⭐ D156 (3): in the dock, the person's picture (a perfect circle — D60 keeps circles round), initials without one.
function ProfileItem({ profile, onPress, dock = false }) {
  const { url } = useAccountAvatar(!!profile && dock);
  if (!profile) return null;
  return (
    <button type="button" className="appnav-item" data-nav-item="profile" aria-haspopup="dialog" onClick={onPress}
      {...(dock ? { "aria-label": "Profile — you and your résumé" } : null)}>
      {dock && (
        <span className="appnav-ico appnav-ico--me" data-nav-icon="profile">
          {url ? <img src={url} alt="" /> : <span className="appnav-initials" aria-hidden="true">{initialsOf(profile.name)}</span>}
          <Badge n={profile.badge} label={profile.badgeLabel} />
        </span>
      )}
      <span className="appnav-words">
        <span className="appnav-name">
          Profile
          {!dock && <Badge n={profile.badge} label={profile.badgeLabel} />}
        </span>
        <small className="appnav-plain">you and your résumé</small>
      </span>
    </button>
  );
}

export default function AppNav({ tabs = [], activeTab, hrefForTab, onTabChange, profile = null }) {
  const [wide, setWide] = useState(false);      // the dock, expanded to its names (hover / focus / M)
  const [open, setOpen] = useState(false);      // the menu's side panel
  const dockRef = useRef(null), menuBtnRef = useRef(null), panelRef = useRef(null);
  const go = useCallback((id) => { setOpen(false); setWide(false); onTabChange?.(id); }, [onTabChange]);

  // The page makes room while the dock is expanded — only when the dock is the navigation on screen (CSS decides which).
  useEffect(() => {
    const el = dockRef.current, root = document.documentElement;
    const shown = !!el && getComputedStyle(el).display !== "none" && wide;
    if (shown) root.setAttribute("data-dock-open", "true"); else root.removeAttribute("data-dock-open");
  }, [wide]);
  useEffect(() => () => document.documentElement.removeAttribute("data-dock-open"), []);

  // A press outside the dock folds it back to its icons.
  useEffect(() => {
    if (!wide) return undefined;
    const onDown = (e) => { if (!dockRef.current?.contains(e.target)) setWide(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [wide]);

  // The menu: Esc closes; M toggles — only while the Menu button is the navigation on screen (CSS decides), and never
  // while typing. With the dock, M expands / folds it and Esc folds it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) { setOpen(false); menuBtnRef.current?.focus({ preventScroll: true }); return; }
      if (e.key === "Escape") { setWide(false); return; }
      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        if (el?.closest?.("input,textarea,select,[contenteditable=''],[contenteditable='true']")) return;
        const btn = menuBtnRef.current;
        if (btn && getComputedStyle(btn).display !== "none") { e.preventDefault(); setOpen((o) => !o); return; }
        const dock = dockRef.current;
        if (dock && getComputedStyle(dock).display !== "none") { e.preventDefault(); setWide((u) => !u); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (open) panelRef.current?.querySelector("a,button")?.focus({ preventScroll: true }); }, [open]);

  // A touch screen has no hover: a tap goes straight to the page (the icons carry their names for assistive tech).
  const canHover = typeof window === "undefined" || !window.matchMedia || window.matchMedia("(hover: hover)").matches;
  const body = typeof document !== "undefined" ? document.body : null;
  return (
    <>
      <button type="button" ref={menuBtnRef} className="appnav-menu-btn" data-nav-menu-button=""
        aria-haspopup="true" aria-expanded={open} aria-controls="appnav-panel" aria-keyshortcuts="M" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      {body && createPortal(
        <>
          <nav aria-label="Main" ref={dockRef} className="appnav-dock" data-nav-dock="" data-open={wide ? "true" : "false"}
            aria-keyshortcuts="M"
            onMouseEnter={canHover ? () => setWide(true) : undefined}
            onMouseLeave={canHover ? () => { if (!dockRef.current?.contains(document.activeElement)) setWide(false); } : undefined}
            onFocus={(e) => { if (canHover || e.target.matches?.(":focus-visible")) setWide(true); }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setWide(false); }}>
            <NavItems tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onGo={go} dock />
            <ProfileItem profile={profile} dock onPress={() => { setWide(false); profile?.onOpen?.(); }} />
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

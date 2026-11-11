// ⭐ D145 STEP 3 · THE APP'S NAVIGATION — a Dock or a Menu, the user's choice (owner 11-03, declutter-v7: "navigation as
// a user choice: Dock (bottom, rises on approach) or Menu (top right, side panel with the dock's buttons)").
//
// Replaces the top bar's row of five tabs (removed). Settings → Appearance → Navigation (shared/appearance.js
// `navigation`: auto · dock · menu; "auto" = the Dock). WHICH ONE SHOWS IS CSS (AppNav.css reads data-navigation
// through custom properties), so a live change of the option — and the Customise preview — needs no state here.
//
//   Dock — ⭐ D156 (3) / (1b): a SLIM RAIL on the left edge, ALWAYS VISIBLE — icons of one size (DOCK_ICON_PX), the line
//          icons in the current theme's accent, the person's picture (initials when there is none). Hover or keyboard
//          focus expands it to the names. Badges are small numbers on the icons.
//          ⭐ D167 · THE SITE'S MAP (owner 11-06, home-sketch.html — supersedes D156 (1c)'s list): SIX PLACES —
//          /d → /draft (the jobs) · Home (the house) · Atlas (the globe) · Interview (a microphone) · Profile (the
//          person's picture) · a thin divider · Ask draft (a speech bubble). NAMES ONLY: the plain lines under the names
//          are removed ("remove description below menu items"). THE /d MARK DRAWS OUT INTO /draft: the whole wordmark is
//          set once (DraftMark drawOut) and "raft" is uncovered by clip-path while the mark slides (transform) — the logo
//          never changes size. THE DOCK'S MOTION ("looks a bit choppy … the menu items have to be centered"): every icon
//          centred in the rail; only width / transform / clip-path / opacity animate (AppNav.css); the names fade and
//          slide in after 0.1 s.
//          ⭐ THE DOCK GOES WHERE THE SPACE IS (owner 11-06, "draft screen" — supersedes the fixed left rail and the
//          push-the-page rule): `data-dock-place` on <html>, re-measured on every resize (dockPlace below) —
//            side   only when the page's left margin fits the dock OPEN with a 24 px gap on both sides; the dock is
//                   centred in that margin (both ways) and grows evenly from its centre when it opens;
//            top    otherwise: one row centred at the top, icons AND names (the whole /draft), the same gap above it
//                   and between it and the content;
//            phone  (≤ 600 px) always at the top, centred, icons only (the short /d), below the status bar.
//          It never pushes or covers the page. The quick peek opens beside a side dock and below a top one.
//          THE PROFILE QUICK PEEK: pressing the picture (or resting on it ≈ 350 ms) opens a small Dusk menu beside the
//          dock (ProfilePeek) — it closes on Esc, a press outside, or leaving it, and never covers the dock.
//          ASK DRAFT: the assistant (T5) is not built yet; the item opens AskDraftPanel, a minimal panel on the right that
//          MOVES THE PAGE OVER (`data-ask-open` pads the app shell by its width) — never on top of it.
//   Menu — a Menu button at the top right (in the bar); it opens a side panel from the right whose buttons are EXACTLY
//          the dock's (one list, one <NavItems>); closes with Close, a click outside, Esc; M toggles it.
// ⛔ Real links (AH2): ctrl / middle click opens a new tab.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";   // D180 P1: the network switch
import { DraftMark } from "./DraftMark.jsx";
import UsbSuggest from "./UsbSuggest.jsx";
import { requestBoardSearch } from "../lib/boardSearch.js";
import { useAccountAvatar } from "../lib/accountAvatar.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { autoToggle } from "../lib/draftHouseExceptions.js";
import { ACTIVE_THEME } from "../themes/index.js";
import "./AppNav.css";

// ⭐ D156 (1b): every icon the same size.
export const DOCK_ICON_PX = 30;
// ⭐ D167: the names, and nothing under them. The jobs are "draft" (the mark draws out into /draft); the tracker is the
// house, "Home"; Interview is the new page (/app/interview — the d167-profile lane builds the page and its route).
export const DOCK_NAMES = Object.freeze({ today: "draft", "auto-apply" : "Home", atlas: "Atlas", interview: "Interview", network: "Network", feed: "Feed", messages: "Messages" });   // (the id, spaced for the D6 guard)
// The six places, in the dock's order (D167). Profile and Ask draft are not tabs: they are drawn by ProfileItem and
// AskItem after the tabs (and the divider).
export const NETWORK_PATH = "/app/network";   // D180 P1
export const FEED_PATH = "/app/feed";   // 46f: the feed's own page
export const MESSAGES_PATH = "/app/messages";   // 46f: messages' own page
export const DOCK_PLACES = Object.freeze(["today", "auto-apply", "atlas", "interview", "profile", "ask"]);
export const INTERVIEW_PATH = "/app/interview";
// ⭐ D167 · the open dock's width, the gaps and where the dock goes — one pure module (dockPlace.js), so the rule is
// tested without a browser.
import { DOCK_OPEN_PX, DOCK_GAP_PX, DOCK_TOP_GAP_PX, PHONE_MAX_PX, dockPlace } from "./dockPlace.js";
export { DOCK_OPEN_PX, DOCK_GAP_PX, DOCK_TOP_GAP_PX, PHONE_MAX_PX, dockPlace };
// The Profile page's panels (the d167-profile lane builds them): one helper, so every link here says the same thing.
export const PROFILE_PANELS = Object.freeze(["about", "answers", "autoapply", "connections", "appearance", "notifications", "privacy", "account"]);
// ⭐ D167: Profile's panels live at /app/profile/<id> (pages/profile/profilePanels.js profilePath — a profile-module
// file the shell may not import, A93; the ids above are its PROFILE_PANEL_IDS, pinned equal by test/d167Profile).
export const profileHref = (panel) => (panel ? `/app/profile/${panel}` : "/app/profile");
// ⭐ A151 (45o, owner 11-08: "we should be able to click on our username to go to an about section, a seperate about you is
// not needed"): the name opens the profile at its About section (ProfileSections' ABOUT_ANCHOR).
export const ABOUT_HREF = "/app/profile/about#profile-about";

// The house, the globe, the microphone and the speech bubble: line drawings in the theme's accent (AppNav.css strokes
// them with --c-accent).
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
function MicIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v2.5" />
    </svg>
  );
}
// ⭐ D180 P1 (45o): Network — two people (the spec's icon).
function PeopleIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M15.5 14.2a4.6 4.6 0 0 1 5 4.8" />
    </svg>
  );
}
// ⭐ 46f (owner 11-11): Feed and Messages are their own places — a page of posts, an envelope.
function FeedIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 12.5h8M8 16h5" />
    </svg>
  );
}
function EnvelopeIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4 7l8 6 8-6" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" />
    </svg>
  );
}

// ⭐ 45n (owner 11-08) · THE DOCK'S SEARCH — the icon turns the dock into one search bar in the dock's own place: companies,
// people (public profiles, with workplace · school), roles, technologies and titles, the one grouped list (UsbSuggest).
// A company or a person opens its page; a role, a technology or typed words (Enter) search the jobs board
// (lib/boardSearch.js). Esc, the ✕ or leaving it empty and pressing outside puts the dock back.
function DockSearch({ onClose }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
  const toBoard = (detail) => { requestBoardSearch(detail); onClose(); navigate("/app/jobs"); };
  return (
    <div className="appnav-search" role="search" aria-label="Search draft" data-dock-search="">
      <UsbSuggest field="title" value={q} onChange={setQ}
        onPickRole={(r) => toBoard({ role: { id: r.id, categoryId: r.categoryId } })}
        onPickTech={(t) => toBoard({ tech: { name: t.name } })}
        onAccept={(text) => toBoard({ query: text })}>
        {(sugg) => (
          <input {...sugg} ref={(el) => { inputRef.current = el; if (typeof sugg.ref === "function") sugg.ref(el); else if (sugg.ref) sugg.ref.current = el; }}
            type="search" enterKeyHint="search" className="appnav-search__input"
            placeholder="Search people, companies, jobs" aria-label="Search people, companies and jobs"
            onKeyDown={(e) => {
              sugg.onKeyDown?.(e);
              if (e.defaultPrevented) return;
              if (e.key === "Enter" && q.trim()) toBoard({ query: q.trim() });
              else if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }} />
        )}
      </UsbSuggest>
      <button type="button" className="appnav-search__close" aria-label="Close the search" onClick={onClose}>✕</button>
    </div>
  );
}

function BubbleIcon() {
  return (
    <svg className="appnav-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4.5 3.5v-3.5h-.5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
const ICONS = { atlas: () => <GlobeIcon />, "auto-apply" : () => <HouseIcon />, interview: () => <MicIcon />, network: () => <PeopleIcon />, feed: () => <FeedIcon />, messages: () => <EnvelopeIcon /> };   // (the id, spaced for the D6 guard)
// The jobs' entry is the mark itself — "/d" at rest, "/draft" open (the wordmark IS its name, so no separate word).
const isJobs = (id) => id === "today" || id === "console";

function Badge({ n, label }) {
  if (!(n > 0)) return null;
  return (
    <span className="appnav-badge" title={label}>
      <span aria-hidden="true">{n > 9 ? "9+" : n}</span><span className="sr-only">{`, ${label}`}</span>
    </span>
  );
}

// The tabs App hands over (today · auto-apply · atlas), with Interview after Atlas when App does not route it yet.
function placesOf(tabs, network = false, netUnread = 0) {
  const list = (tabs || []).filter((t) => t.id !== "console");
  if (!list.some((t) => t.id === "interview")) {
    const i = list.findIndex((t) => t.id === "atlas");
    list.splice(i < 0 ? list.length : i + 1, 0, { id: "interview", label: "Interview" });
  }
  // ⭐ D180 P1 (45o, the spec: "a new dock item, Network, between Interview and Profile"): ONLY while the network switch is
  // on — with it off (the default) the dock is exactly as before.
  // ⭐ 46f (owner 11-11: "a page for feed and messaging into the menu with their own pages"): Feed and Messages follow
  // Network as their own places, under the same switch; the unread count is Messages' now (it is where they are read).
  if (network && !list.some((t) => t.id === "network")) {
    const i = list.findIndex((t) => t.id === "interview");
    list.splice(i < 0 ? list.length : i + 1, 0, { id: "network", label: "Network" }, { id: "feed", label: "Feed" },
      { id: "messages", label: "Messages", badge: netUnread || 0, badgeLabel: netUnread ? `${netUnread} unread` : undefined });
  }
  return list;
}

function NavItems({ tabs, activeTab, hrefForTab, onGo, dock = false, network = false, netUnread = 0 }) {
  return placesOf(tabs, network, netUnread).map((t) => {
    const Icon = ICONS[t.id];
    const name = DOCK_NAMES[t.id] || t.label;
    const href = hrefForTab?.(t.id) || (t.id === "interview" ? INTERVIEW_PATH : t.id === "network" ? NETWORK_PATH
      : t.id === "feed" ? FEED_PATH : t.id === "messages" ? MESSAGES_PATH : undefined);
    const jobs = isJobs(t.id);
    return (
      <a key={t.id} className="appnav-item" href={href} data-nav-item={t.id} {...(dock && jobs ? { "data-nav-brand": "" } : null)}
        aria-current={activeTab === t.id ? "page" : undefined} {...(dock ? { "aria-label": name } : null)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onGo(t.id, href);
        }}>
        {dock && jobs && <span className="appnav-ico appnav-ico--mark" data-nav-icon={t.id}><DraftMark drawOut /><Badge n={t.badge} label={t.badgeLabel} /></span>}
        {dock && !jobs && Icon && <span className="appnav-ico" data-nav-icon={t.id}><Icon /><Badge n={t.badge} label={t.badgeLabel} /></span>}
        {!(dock && jobs) && (
          <span className="appnav-words">
            <span className="appnav-name">
              {name}
              {!dock && <Badge n={t.badge} label={t.badgeLabel} />}
            </span>
          </span>
        )}
      </a>
    );
  });
}

const initialsOf = (name) => String(name || "").trim().split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

function Avatar({ url, name, className }) {
  return url ? <img className={className} src={url} alt="" /> : <span className={`${className} appnav-initials`} aria-hidden="true">{initialsOf(name)}</span>;
}

// ⭐ D149: the account menu is "Profile", the fifth place of the Dock and of the Menu. `profile` = { onOpen, badge,
// badgeLabel, name, email, onSignOut } (TopBar's). ⭐ D156 (3): in the dock, the person's picture (a perfect circle — D60
// keeps circles round), initials without one. ⭐ D167: in the dock a press opens the quick peek (`peek` handlers); in the
// Menu's panel it opens the Profile panel as before.
function ProfileItem({ profile, onPress, dock = false, peek = null, itemRef = null }) {
  const { url } = useAccountAvatar(!!profile && dock);
  if (!profile) return null;
  return (
    <button type="button" ref={itemRef} className="appnav-item" data-nav-item="profile" aria-haspopup="dialog" onClick={onPress}
      {...(dock ? { "aria-label": "Profile", "aria-expanded": !!peek?.open, "aria-controls": "appnav-peek",
                    onMouseEnter: peek?.onEnter, onMouseLeave: peek?.onLeave } : null)}>
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
      </span>
    </button>
  );
}

// ⭐ D167 · Ask draft — the sixth place, after the divider.
function AskItem({ onPress, open, dock = false }) {
  return (
    <button type="button" className="appnav-item" data-nav-item="ask" aria-expanded={!!open} aria-controls="appnav-ask" onClick={onPress}
      {...(dock ? { "aria-label": "Ask draft" } : null)}>
      {dock && <span className="appnav-ico" data-nav-icon="ask"><BubbleIcon /></span>}
      <span className="appnav-words"><span className="appnav-name">Ask draft</span></span>
    </button>
  );
}

// ⭐ D167 · THE PROFILE QUICK PEEK (home-sketch.html's .peek) — the basics from Profile's own menu, in the same styling:
// the picture, name and email; About you · Your résumés · Saved answers; the Ask me first / Apply for me switch (THE
// auto-apply mode — AutoApplyContext's setApplyMode, POST /api/apply/mode; Apply for me stays locked unless the server
// unlocks it, autoToggle); Connections · Appearance (the current theme) · Notifications; Open Profile (accent) · Sign out.
// Fixed beside a side dock (its left is the open dock's right + 10) or below a top dock — it never covers the dock; a
// small transient menu may sit over the page.
export function ProfilePeek({ open, profile, pos = { top: 0, left: 80 }, onGo, onClose, onEnter, onLeave, peekRef }) {
  const { url } = useAccountAvatar(!!profile);
  const { runBar, setApplyMode, holdBusy } = useAutoApply();
  const fullAuto = runBar?.mode?.current === "auto";
  const mode = autoToggle(runBar);
  const themeName = String(ACTIVE_THEME?.label || "").replace(/ Dark$/, "");
  if (!profile) return null;
  const link = (panel, label, aside = null, extra = {}) => (
    <a href={profileHref(panel)} data-peek-link={panel || "open"} {...extra}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); onGo(profileHref(panel)); }}>
      <span>{label}</span>{aside != null && <small>{aside}</small>}
    </a>
  );
  return (
    <div id="appnav-peek" ref={peekRef} className="appnav-peek" role="dialog" aria-label="Profile" data-profile-peek="" data-open={open ? "true" : "false"}
      style={{ top: pos.top, left: pos.left }} onMouseEnter={onEnter} onMouseLeave={onLeave}
      {...(open ? null : { inert: "", "aria-hidden": true })}>
      <div className="appnav-peek__head">
        <Avatar url={url} name={profile.name} className="appnav-peek__pic" />
        <div>
          <a href={ABOUT_HREF} className="appnav-peek__name" data-peek-name="" title="Your About section"
            onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); onGo(ABOUT_HREF); }}>
            <b>{profile.name || "You"}</b></a>
          {profile.email && <span data-peek-email="">{profile.email}</span>}
        </div>
      </div>
      {/* A151 (45o): the separate "About you" link is gone — the name above opens the About section. */}
      {link("answers", "Saved answers")}
      <div className="appnav-peek__sep" aria-hidden="true" />
      <div className="appnav-peek__seg" role="group" aria-label="Auto-apply" data-peek-mode="">
        <button type="button" data-mode="ask" aria-pressed={!fullAuto} disabled={holdBusy || !runBar || !setApplyMode}
          onClick={() => { if (fullAuto) setApplyMode?.("semi"); }}>Ask me first</button>
        <button type="button" data-mode="auto" aria-pressed={fullAuto} data-locked={mode.selectable ? "false" : "true"}
          disabled={holdBusy || !mode.selectable || !setApplyMode} title={mode.selectable ? undefined : `Apply for me is locked: ${mode.reason}`}
          onClick={mode.selectable ? () => { if (!fullAuto) setApplyMode?.("auto"); } : undefined}>Apply for me</button>
      </div>
      {link("connections", "Connections", profile.connectionsNeedYou > 0 ? `${profile.connectionsNeedYou} need${profile.connectionsNeedYou === 1 ? "s" : ""} you` : null)}
      {link("appearance", "Appearance", themeName || null)}
      {link("notifications", "Notifications", profile.badge > 0 ? String(profile.badge) : null)}
      <div className="appnav-peek__sep" aria-hidden="true" />
      {link(null, "Open Profile", null, { className: "appnav-peek__open" })}
      <button type="button" className="appnav-peek__out" data-peek-signout="" onClick={() => { onClose(); profile.onSignOut?.(); }}>Sign out</button>
    </div>
  );
}

// ⭐ D167 · ASK DRAFT — the assistant's place: on the right, and it MOVES THE PAGE OVER (`data-ask-open` → AppNav.css pads
// the app shell by --appnav-ask-w), never on top of it. ⭐ T5 v1 (owner 11-10, "OK ship it"): a short answer, one to three
// Atlas lessons (only lessons that exist), one next step, and at most one PROPOSED action that runs only when the person
// presses Confirm (POST /api/assistant/actions/:id/confirm — the server uses this session's user, never the model's say).
// The conversation lives here only (short-term memory, docs/ASSISTANT.md §2): closing the panel forgets it. Until the
// assistant is open to everyone (Admin → Atlas → Asks), the panel says so plainly instead of pretending to answer.
export function AskDraftPanel({ open, onClose, panelRef }) {
  const [status, setStatus] = useState(null);
  const [turns, setTurns] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) { setTurns([]); setQ(""); return; }
    let live = true;
    api("/api/assistant/status").then(s => { if (live) setStatus(s); }).catch(() => { if (live) setStatus({ available: false }); });
    return () => { live = false; };
  }, [open]);
  const send = async (e) => {
    e?.preventDefault?.();
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setQ("");
    setTurns(t => [...t, { who: "you", text: question }]);
    try {
      const r = await api("/api/assistant/ask", { method: "POST", body: JSON.stringify({ question }) });
      setTurns(t => [...t, r.ok ? { who: "draft", ...r } : { who: "draft", text: r.message, failed: true }]);
    } catch (err) { setTurns(t => [...t, { who: "draft", text: err.message || "Ask draft couldn't answer just now.", failed: true }]); }
    finally { setBusy(false); }
  };
  const decide = async (i, action, confirm) => {
    try {
      const r = await api(`/api/assistant/actions/${action.id}/${confirm ? "confirm" : "cancel"}`, { method: "POST", body: "{}" });
      setTurns(t => t.map((x, k) => (k === i ? { ...x, decided: r.status === "done" ? "Done." : "Cancelled." } : x)));
    } catch (err) { setTurns(t => t.map((x, k) => (k === i ? { ...x, decided: err.message } : x))); }
  };
  const toggleImprove = async () => {
    try { const r = await api("/api/assistant/settings", { method: "PUT", body: JSON.stringify({ improveAtlas: !status.improveAtlas }) }); setStatus(s => ({ ...s, ...r })); }
    catch { /* unchanged */ }
  };
  return (
    <aside id="appnav-ask" ref={panelRef} className="appnav-ask" aria-label="Ask draft" data-ask-draft="" data-open={open ? "true" : "false"}
      {...(open ? null : { inert: "", "aria-hidden": true })}>
      <header className="appnav-ask__head">
        <h2>Ask draft</h2>
        <button type="button" className="appnav-close appnav-ask__close" data-ask-close="" onClick={onClose}>Close</button>
      </header>
      {status && !status.available && (
        <p className="appnav-ask__say" data-ask-draft-closed="">
          Ask draft isn't open yet. Soon you will ask it about your jobs, your applications and Atlas here, and it will check
          with you before it does anything.
        </p>
      )}
      {status?.available && <>
        <p className="appnav-ask__say">Ask about a skill, a role or how draft works. It checks with you before it does anything.</p>
        <div className="appnav-ask__turns" data-ask-turns="" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className="appnav-ask__turn" data-ask-turn={t.who}>
              <p className="appnav-ask__text">{t.who === "you" ? <b>You: </b> : null}{t.answer || t.text}</p>
              {t.lessons?.length > 0 && (
                <ul className="appnav-ask__lessons" data-ask-lessons="">
                  {t.lessons.map(l => <li key={l.slug}><a href={l.href} data-ask-lesson={l.slug}>{l.name}</a> <span className="appnav-ask__kind">{l.kind}</span></li>)}
                </ul>
              )}
              {t.next && <p className="appnav-ask__next" data-ask-next=""><b>Next: </b>{t.next}</p>}
              {t.action && (
                <div className="appnav-ask__action" data-ask-action={t.action.tool}>
                  <span>{t.action.summary}?</span>
                  {t.decided ? <span className="appnav-ask__kind">{t.decided}</span> : <>
                    <button type="button" className="appnav-ask__btn" data-ask-confirm="" onClick={() => decide(i, t.action, true)}>Confirm</button>
                    <button type="button" className="appnav-ask__btn" data-ask-cancel="" onClick={() => decide(i, t.action, false)}>Cancel</button>
                  </>}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="appnav-ask__kind" data-ask-busy="">Thinking…</p>}
        </div>
        <form className="appnav-ask__form" onSubmit={send}>
          <textarea className="appnav-ask__input" aria-label="Your question" rows={3} maxLength={600} value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
            placeholder="What should I learn for a data analyst role?" data-ask-input="" />
          <button type="submit" className="appnav-ask__btn" disabled={busy || !q.trim()} data-ask-send="">Ask</button>
        </form>
        <label className="appnav-ask__opt" data-ask-improve="">
          <input type="checkbox" checked={!!status.improveAtlas} onChange={toggleImprove} />
          Use my questions to improve Atlas (stored without your name or contact details)
        </label>
      </>}
    </aside>
  );
}

export default function AppNav({ tabs = [], activeTab, hrefForTab, onTabChange, profile = null }) {
  const navigate = useNavigate();
  const [wide, setWide] = useState(false);      // the dock, expanded to its names (hover / focus / M)
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekPos, setPeekPos] = useState({ top: 0, left: 80 });
  const [askOpen, setAskOpen] = useState(false);
  const [searching, setSearching] = useState(false);   // ⭐ 45n: the dock is the search bar
  // ⭐ D180 P1 (45o): is the network on? (GET /api/network/status — false on any failure: the dock stays as it was.)
  const [network, setNetwork] = useState(false);
  const [netUnread, setNetUnread] = useState(0);   // D180 P2: unread messages on the dock's Network
  useEffect(() => {
    let live = true;
    const ask = () => api("/api/network/status").then(r => { if (!live) return; setNetwork(!!r?.enabled); setNetUnread(Number(r?.unread) || 0); }).catch(() => {});
    ask(); const iv = setInterval(ask, 60_000);
    return () => { live = false; clearInterval(iv); };
  }, []);
  const dockRef = useRef(null);
  const profRef = useRef(null), peekRef = useRef(null), askRef = useRef(null), askBtnRef = useRef(null), peekTimer = useRef(null);
  const closePeek = useCallback(() => { clearTimeout(peekTimer.current); setPeekOpen(false); }, []);
  const go = useCallback((id, href) => {
    setWide(false); closePeek();
    if (id === "interview" && !hrefForTab?.(id)) { navigate(href || INTERVIEW_PATH); return; }
    if (id === "network") { navigate(href || NETWORK_PATH); return; }   // D180 P1
    if (id === "feed" || id === "messages") { navigate(href || (id === "feed" ? FEED_PATH : MESSAGES_PATH)); return; }   // 46f
    onTabChange?.(id);
  }, [onTabChange, hrefForTab, navigate, closePeek]);
  const goPath = useCallback((path) => { setWide(false); closePeek(); navigate(path); }, [navigate, closePeek]);

  // A touch screen has no hover: a tap goes straight to the page (the icons carry their names for assistive tech).
  const canHover = typeof window === "undefined" || !window.matchMedia || window.matchMedia("(hover: hover)").matches;
  // The dock stays open while its peek is (with a pointer): the peek sits beside the OPEN dock, so the two never overlap.
  // On a touch screen the rail stays slim and the peek sits beside it.
  const dockOpen = wide || (peekOpen && canHover);
  // (the place is measured below; a top / phone dock has one form — names or icons — and is never widened)

  // ⭐ D167: "raft"'s width, measured ONCE the logo face has loaded — the mark slides by half of it (AppNav.css).
  useEffect(() => {
    let gone = false;
    const set = () => {
      const dock = dockRef.current, raft = dock?.querySelector("[data-draft-raft]");
      if (!gone && raft) dock.style.setProperty("--appnav-raft-w", `${raft.offsetWidth}px`);
    };
    set();
    document.fonts?.ready?.then(set).catch(() => {});
    return () => { gone = true; };
  }, []);

  // ⭐ D167 · THE DOCK GOES WHERE THE SPACE IS. Measured on mount, on every resize and whenever the page's first box
  // changes size: where the content starts (D163's centred group) decides side / top / phone (dockPlace). A side dock is
  // centred in the margin (--appnav-margin); a top dock sits so the gap above it equals the gap below it
  // (--appnav-top-y, and --appnav-top-reserve when the page must start lower). Only while the dock is the navigation
  // on screen (CSS decides which); nothing here ever pads the page sideways.
  const [place, setPlace] = useState("side");
  useLayoutEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = dockRef.current;
      if (!el || getComputedStyle(el).display === "none") { root.removeAttribute("data-dock-place"); return; }
      const shell = document.querySelector("[data-app-shell]"), first = shell?.querySelector("main")?.firstElementChild;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      let contentLeft = 0, contentTop = 0;
      if (first) {
        const r = first.getBoundingClientRect(), cs = getComputedStyle(first);
        contentLeft = r.left + (parseFloat(cs.paddingLeft) || 0);
        contentTop = r.top + window.scrollY + (parseFloat(cs.paddingTop) || 0)
          - (parseFloat(getComputedStyle(shell).getPropertyValue("--appnav-top-reserve")) || 0);
      }
      const next = dockPlace({ vw, contentLeft });
      root.setAttribute("data-dock-place", next);
      root.style.setProperty("--appnav-margin", `${Math.max(0, Math.round(contentLeft))}px`);
      if (next !== "side") {
        // equal gaps: the dock's top is the gap; the content starts one more gap below the dock's bottom
        const h = el.offsetHeight || 48;
        const y = Math.max(DOCK_TOP_GAP_PX, Math.round((contentTop - h) / 2));
        root.style.setProperty("--appnav-top-y", `${y}px`);
        root.style.setProperty("--appnav-top-reserve", `${Math.max(0, Math.round(y + h + y - contentTop))}px`);
      } else {
        root.style.removeProperty("--appnav-top-y"); root.style.setProperty("--appnav-top-reserve", "0px");
      }
      setPlace(next);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", schedule);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    const main = document.querySelector("[data-app-shell] main");
    if (ro && main) ro.observe(main);
    document.fonts?.ready?.then(schedule).catch(() => {});
    return () => { window.removeEventListener("resize", schedule); ro?.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (dockOpen) root.setAttribute("data-dock-open", "true"); else root.removeAttribute("data-dock-open");
  }, [dockOpen]);
  useEffect(() => () => { const r = document.documentElement; r.removeAttribute("data-dock-open"); r.removeAttribute("data-dock-place"); r.removeAttribute("data-ask-open"); }, []);

  // ⭐ D167 · Ask draft moves the page over: the shell is padded by the panel while it is open.
  useEffect(() => {
    const root = document.documentElement;
    if (askOpen) root.setAttribute("data-ask-open", "true"); else root.removeAttribute("data-ask-open");
    if (askOpen) askRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [askOpen]);

  // A press outside the dock folds it back to its icons; outside the dock and the peek closes the peek.
  useEffect(() => {
    if (!wide && !peekOpen) return undefined;
    const onDown = (e) => {
      const inDock = dockRef.current?.contains(e.target), inPeek = peekRef.current?.contains(e.target);
      if (!inDock && !inPeek) { setWide(false); closePeek(); }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [wide, peekOpen, closePeek]);

  // ⛔ 45n (owner 11-08, decision (10)): the side Menu is RETIRED — the dock is the one navigation. M expands / folds the
  // dock (never while typing); Esc folds it (the peek first, then Ask draft).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && peekOpen) { closePeek(); profRef.current?.focus({ preventScroll: true }); return; }
      if (e.key === "Escape" && askOpen) { setAskOpen(false); askBtnRef.current?.focus?.({ preventScroll: true }); return; }
      if (e.key === "Escape") { setWide(false); return; }
      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        if (el?.closest?.("input,textarea,select,[contenteditable=''],[contenteditable='true']")) return;
        const dock = dockRef.current;
        if (dock && getComputedStyle(dock).display !== "none") { e.preventDefault(); setWide((u) => !u); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [peekOpen, askOpen, closePeek]);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  // ⭐ D167: the peek follows the dock — BESIDE a side dock (its middle on the picture's, its left past the open dock's
  // right edge) and BELOW a top dock (its middle under the picture), kept on screen.
  const placePeek = useCallback(() => {
    const r = profRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = peekRef.current?.offsetHeight || 420, w = peekRef.current?.offsetWidth || 268;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    if (document.documentElement.getAttribute("data-dock-place") === "side") {
      const d = dockRef.current?.getBoundingClientRect();
      const openRight = d ? d.left + d.width / 2 + DOCK_OPEN_PX / 2 : r.right;
      setPeekPos({ top: Math.max(12, Math.min(window.innerHeight - h - 12, r.top + r.height / 2 - h / 2)), left: Math.round(openRight + 10) });
    } else {
      const d = dockRef.current?.getBoundingClientRect();
      setPeekPos({ top: Math.round((d ? d.bottom : r.bottom) + 10), left: Math.round(Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))) });
    }
  }, []);
  const showPeek = useCallback(() => { clearTimeout(peekTimer.current); placePeek(); setPeekOpen(true); }, [placePeek]);
  // Resting ≈ 350 ms on the picture opens it; leaving the picture or the peek closes it after 250 ms unless the pointer
  // reached the other one.
  const peekHover = {
    open: peekOpen,
    onEnter: () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(showPeek, 350); },
    onLeave: () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => { if (!peekRef.current?.matches(":hover")) setPeekOpen(false); }, 250); },
  };
  const onPeekEnter = () => clearTimeout(peekTimer.current);
  const onPeekLeave = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => { if (!profRef.current?.matches(":hover")) setPeekOpen(false); }, 250); };
  const pressProfile = () => {
    if (peekOpen) { closePeek(); return; }
    showPeek();
    requestAnimationFrame(() => peekRef.current?.querySelector("a,button:not([disabled])")?.focus({ preventScroll: true }));
  };
  const pressAsk = (e) => { askBtnRef.current = e.currentTarget; setWide(false); closePeek(); setAskOpen((o) => !o); };

  const body = typeof document !== "undefined" ? document.body : null;
  return (
    <>
      {body && createPortal(
        <>
          <nav aria-label="Main" ref={dockRef} className="appnav-dock" data-nav-dock="" data-open={dockOpen || searching ? "true" : "false"} data-place={place}
            data-searching={searching ? "true" : "false"}
            aria-keyshortcuts="M"
            onMouseEnter={canHover ? () => setWide(true) : undefined}
            onMouseLeave={canHover ? () => { if (!dockRef.current?.contains(document.activeElement)) setWide(false); } : undefined}
            onFocus={(e) => { if (canHover || e.target.matches?.(":focus-visible")) setWide(true); }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setWide(false); }}>
            {searching ? <DockSearch onClose={() => { setSearching(false); setWide(false); }} /> : <>
            <button type="button" className="appnav-item" data-nav-item="search" aria-label="Search" onClick={() => { closePeek(); setSearching(true); }}>
              <span className="appnav-ico" data-nav-icon="search"><SearchIcon /></span>
              <span className="appnav-words"><span className="appnav-name">Search</span></span>
            </button>
            <NavItems tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onGo={go} dock network={network} netUnread={netUnread} />
            <ProfileItem profile={profile} dock itemRef={profRef} peek={canHover ? peekHover : { open: peekOpen }} onPress={pressProfile} />
            <span className="appnav-sep" aria-hidden="true" />
            <AskItem dock open={askOpen} onPress={pressAsk} />
            </>}
          </nav>
          <ProfilePeek open={peekOpen} profile={profile} pos={peekPos} onGo={goPath} onClose={closePeek}
            onEnter={canHover ? onPeekEnter : undefined} onLeave={canHover ? onPeekLeave : undefined} peekRef={peekRef} />
          <AskDraftPanel open={askOpen} panelRef={askRef} onClose={() => { setAskOpen(false); askBtnRef.current?.focus?.({ preventScroll: true }); }} />
        </>, body)}
    </>
  );
}

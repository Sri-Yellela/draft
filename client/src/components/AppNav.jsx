// ⭐ THE APP'S NAVIGATION — the dock (D145 → D156 → D167 → ⭐ D197 Wave 1 #1, 47i: the plate system's shell).
//
// ⭐ D197 #1 · THE SHELL (the owner-approved canvas board `Shell`, docs/sketches/final/project/Shell.dc.html; the design doc's
// addendum shell bullet; A237): the dock is the PLATE's — drawn by the plate library's one Dock (plate/Shell.jsx): a paper rail,
// 1.5 px ink border, 20 px radius, 4 px hard shadow, 84 px wide; the active item a white tile with a 1.5 px ink border and a
// 3 px ink shadow; badges ink mono tags; the /d logo an ink d with a clay slash on a white 44 px tile. On wide screens it is a
// vertical RAIL at the LEFT, 14 px from the edges, with the content column beside it (AppNav.css pads the shell 98 px); the
// area nav (ShellAreaNav below, mounted by App) runs across the column's top, its row centred in 1,180 px — at 2560 the extra
// width is margin, never a dock on top. Below 980 px the rail becomes the phone's bottom bar, and the area nav's top bar holds
// the /d tile and the search button.
//   THE PLACES (D167's order and badges, kept — D200 Rule 1): /d (the market, the jobs' entry) · Home (needs-you count) ·
//          Atlas · Interview · [Network · Feed · Messages — only while the network switch is on (D180 P1 / 46f), Messages
//          with the unread count] · Profile (the person's picture or initials; opens the quick peek) · — · Ask draft (the
//          board's item after its rule: it opens Tiny — D190's fox bubble at the bottom-right stays too).
//   THE NAMES are always shown (the board): D167's hover-expand to 196 px and the /d → /draft draw-out retired with the 60 px
//          rail. M takes the keyboard into the dock (its current place) and back out; Esc closes the peek, then Tiny, then
//          lets go of the dock.
//   THE DOCK'S SEARCH (45n: people, companies, roles, technologies — UsbSuggest) lives in each area's nav: the search box with
//          Ctrl K (one listener, plate/Shell.jsx) on a wide screen, the top bar's search button on a phone.
//   THE PROFILE QUICK PEEK (D167): a press on the picture (or ≈ 350 ms resting on it) opens it beside the rail / above the bar;
//          Esc, a press outside or leaving it closes it. ⭐ A236 (b): its Notifications row opens the notifications list.
//   TINY (D190, owner 11-15): the fox bubble fixed at the bottom-right opens AskDraftPanel as a floating card over the page.
// ⛔ Real links (AH2): ctrl / middle click opens a new tab.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";   // D180 P1: the network switch
import PlateRoot from "../plate/PlateRoot.jsx";   // ⭐ D197 #1: the dock and the area nav are the plate's (plate tokens, the theme's palette)
import { Dock, AreaNav, useSearchShortcut } from "../plate/Shell.jsx";
import { Icon, notifIcon } from "../plate/icons.jsx";   // ⭐ 47m: the peek's per-type notification icons
import { AskDraftCard } from "../plate/Cards.jsx";   // ⭐ D197 #12 (47m, M5): Tiny's card is the plate's
import { AskRouteCard, askRouteKind } from "../plate/AskRouteMap.jsx";   // the answer as a route (the board AskRoute)
// an answer naming more than three entries points to an existing route — the course, whose circle is its overview (D201 (2))
const ROUTE_FOR_BIGGER = "/app/atlas/library/silicon-to-software?view=circle";
import UsbSuggest from "./UsbSuggest.jsx";
import { requestBoardSearch } from "../lib/boardSearch.js";
import { useAccountAvatar } from "../lib/accountAvatar.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import AskDraftThread from "./AskDraftThread.jsx";   // A199 (2): a held application's questions as a thread
// ⭐ D190 · the one engine (shared with the PDF tools' Tiny) + the one vocabulary + draft's handlers (no model for site data)
import { createAssistant, TIER_LABEL } from "../../../shared/assistantEngine.js";
import ASSISTANT_COMMANDS from "../../../content/assistant/commands-v1.json";
import { createDraftHandlers } from "../lib/assistantDraft.js";
import { assistantAction, ASK_SESSION_KEY, ASK_CLEAR_EVENT } from "../lib/assistantBridge.js";
import { heldQuestionsFor } from "../lib/heldApplication.js";
import { voiceSupported, listenOnce, voiceNote, VOICE_ERRORS } from "../../../shared/assistantVoice.js";   // D190 P4
import { tinySvg, TINY_NAME } from "../../../shared/tinyMascot.js";   // D190 (owner 11-15): Tiny's face, the fox
import { autoToggle } from "../lib/draftHouseExceptions.js";
import { ACTIVE_THEME } from "../themes/index.js";
import "./AppNav.css";

// ⭐ D167: the names, and nothing under them. The jobs are "draft" (the mark draws out into /draft); the tracker is the
// house, "Home"; Interview is the new page (/app/interview — the d167-profile lane builds the page and its route).
export const DOCK_NAMES = Object.freeze({ today: "draft", "auto-apply" : "Home", atlas: "Atlas", interview: "Interview", network: "Network", feed: "Feed", messages: "Messages" });   // (the id, spaced for the D6 guard)
// The places, in the dock's order (D167). Profile is not a tab: ProfileItem draws it after the tabs. ⭐ D190 (owner 11-15:
// Tiny replaces Ask draft, floating): D167's sixth place, Ask draft after a divider, left the dock — Tiny is the fox bubble
// at the bottom-right (TinyBubble).
export const NETWORK_PATH = "/app/network";   // D180 P1
export const FEED_PATH = "/app/feed";   // 46f: the feed's own page
export const MESSAGES_PATH = "/app/messages";   // 46f: messages' own page
export const DOCK_PLACES = Object.freeze(["today", "auto-apply", "atlas", "interview", "profile"]);
export const INTERVIEW_PATH = "/app/interview";
// ⭐ D167 · the open dock's width, the gaps and where the dock goes — one pure module (dockPlace.js), so the rule is
// tested without a browser.
import { DOCK_RAIL_PX, DOCK_EDGE_PX, SIDE_MIN_PX, PHONE_MAX_PX, dockPlace } from "./dockPlace.js";
export { DOCK_RAIL_PX, DOCK_EDGE_PX, SIDE_MIN_PX, PHONE_MAX_PX, dockPlace };
// The Profile page's panels (the d167-profile lane builds them): one helper, so every link here says the same thing.
export const PROFILE_PANELS = Object.freeze(["about", "answers", "autoapply", "connections", "appearance", "notifications", "privacy", "account"]);
// ⭐ D167: Profile's panels live at /app/profile/<id> (pages/profile/profilePanels.js profilePath — a profile-module
// file the shell may not import, A93; the ids above are its PROFILE_PANEL_IDS, pinned equal by test/d167Profile).
export const profileHref = (panel) => (panel ? `/app/profile/${panel}` : "/app/profile");
// ⭐ A151 (45o, owner 11-08: "we should be able to click on our username to go to an about section, a seperate about you is
// not needed"): the name opens the profile at its About section (ProfileSections' ABOUT_ANCHOR).
export const ABOUT_HREF = "/app/profile/about#profile-about";

// ⭐ D197 #1: the places' line drawings are the plate's (plate/icons.jsx — the Shell board's own paths, stroked in the
// plate's ink); the dock itself is the plate's one Dock (plate/Shell.jsx), drawn inside a PlateRoot (the plate tokens,
// in the person's theme's palette — D196 THEMES).
const DOCK_ICON = Object.freeze({ "auto-apply" : "home", atlas: "atlas", interview: "interview", network: "network", feed: "feed", messages: "messages" });   // (the id, spaced for the D6 guard)
const pathOf = (id) => (id === "interview" ? INTERVIEW_PATH : id === "network" ? NETWORK_PATH : id === "feed" ? FEED_PATH : id === "messages" ? MESSAGES_PATH : undefined);

// ⭐ 45n (owner 11-08) · THE DOCK'S SEARCH — companies, people (public profiles, with workplace · school), roles,
// technologies and titles, the one grouped list (UsbSuggest). A company or a person opens its page; a role, a technology or
// typed words (Enter) search the jobs board (lib/boardSearch.js). ⭐ D197 #1 (the Shell board): it lives in each area's nav
// now — the search box with Ctrl K on a wide screen, the top bar's search button on a phone (DockSearch, a sheet under it).
// The same suggest, built once (A93): ShellSearchInput is the input, DockSearch the phone's sheet with its ✕.
export function ShellSearchInput({ className = "appnav-search__input", placeholder = "Search people, companies, jobs", inputRef, onDone, autoFocus = false }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const own = useRef(null);
  const ref = inputRef || own;
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus, ref]);
  const toBoard = (detail) => { requestBoardSearch(detail); setQ(""); onDone?.(); navigate("/app/jobs"); };
  return (
    <UsbSuggest field="title" value={q} onChange={setQ}
      onPickRole={(r) => toBoard({ role: { id: r.id, categoryId: r.categoryId } })}
      onPickTech={(t) => toBoard({ tech: { name: t.name } })}
      onAccept={(text) => toBoard({ query: text })}>
      {(sugg) => (
        <input {...sugg} ref={(el) => { ref.current = el; if (typeof sugg.ref === "function") sugg.ref(el); else if (sugg.ref) sugg.ref.current = el; }}
          type="search" enterKeyHint="search" className={className} data-dock-search-input=""
          placeholder={placeholder} aria-label="Search people, companies and jobs"
          onKeyDown={(e) => {
            sugg.onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === "Enter" && q.trim()) toBoard({ query: q.trim() });
            else if (e.key === "Escape") { e.preventDefault(); setQ(""); e.currentTarget.blur(); onDone?.(); }
          }} />
      )}
    </UsbSuggest>
  );
}
function DockSearch({ onClose }) {
  return (
    <div className="appnav-search" role="search" aria-label="Search draft" data-dock-search="">
      <ShellSearchInput onDone={onClose} autoFocus />
      <button type="button" className="appnav-search__close" aria-label="Close the search" onClick={onClose}>✕</button>
    </div>
  );
}

// ⭐ D197 #1 · A237 · THE AREA NAV ACROSS THE TOP OF THE CONTENT COLUMN — the plate's one AreaNav (plate/Shell.jsx) with
// the dock's search in it. App passes each area's views (the market's: Today's picks · All jobs · Starred · Imported) and
// chip; an area the board hasn't drawn views for yet still gets its search (so the dock's search is never lost). Below
// 980 px the phone's top bar: the /d tile, the search button (opens DockSearch under it), the views scrolling sideways.
const PHONE_QUERY = `(max-width: ${SIDE_MIN_PX - 1}px)`;
export function useShellPhone() {
  const get = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches;
  const [phone, setPhone] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone;
}
export function ShellAreaNav({ area, views = [], current, onGo, pill, more = [], chip, placeholder = "Search people, companies, jobs", homeHref = "/app/jobs", onHome }) {
  const phone = useShellPhone();
  const [sheet, setSheet] = useState(false);
  const inputRef = useRef(null);
  // on a phone, Ctrl / Cmd K opens the sheet (the one shortcut — plate/Shell.jsx's useSearchShortcut)
  useSearchShortcut(() => setSheet(true), () => phone);
  const go = (id, href) => { setSheet(false); onGo?.(id, href); };
  const home = { id: "home", href: homeHref, label: "draft — the market" };
  const search = phone
    ? { onOpen: () => setSheet((s) => !s), sheet: sheet ? <DockSearch onClose={() => setSheet(false)} /> : null }
    : { placeholder, inputRef, renderInput: ({ className, placeholder: ph }) => <ShellSearchInput className={className} placeholder={ph} inputRef={inputRef} /> };
  return (
    <PlateRoot className="appnav-areanav" data-area-nav={area} data-phone={phone ? "true" : "false"}>
      {/* ⭐ 47j (A245, D200 Rule 1): the phone's top bar draws no More, so a More item marked `phone` joins the view
          scroller there (the market's Import a job was unreachable at 390) */}
      <AreaNav area={area} views={phone ? [...views, ...more.filter((m) => m.phone)] : views} current={current} onGo={(id, href) => (id === "home" ? onHome?.() : go(id, href))} pill={pill} more={more}
        chip={phone ? null : chip} search={search} phone={phone} home={home} />
    </PlateRoot>
  );
}

// The jobs' entry is the /d tile itself (the wordmark IS its name).
const isJobs = (id) => id === "today" || id === "console";

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

// the notifications' times (seconds since the epoch) — the one copy: the peek's list reads it (47j: the account panel is gone)
export function notifTimeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - Number(ts || 0));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const initialsOf = (name) => String(name || "").trim().split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

function Avatar({ url, name, className }) {
  return url ? <img className={className} src={url} alt="" /> : <span className={`${className} appnav-initials`} aria-hidden="true">{initialsOf(name)}</span>;
}

// ⭐ D190 · TINY (owner 11-15: "make tiny a floating bot on the site rather than a panel button. give it a cute logo
// animal"; the owner chose: Tiny REPLACES Ask draft on draft — one floating Tiny on both sites). The dock's sixth place
// (D167's Ask draft speech bubble after a divider) is gone: a fox bubble fixed at the bottom-right of every app page opens
// AskDraftPanel as a floating card above it. A perfect circle (D60 allows it); the fox's own colours live in
// shared/tinyMascot.js (illustration, like a logo — not theme); everything around it is theme tokens (AppNav.css).
const TINY_FACE = { __html: tinySvg({ size: 40 }) };          // trusted constant markup (shared/tinyMascot.js), decorative
const TINY_FACE_SMALL = { __html: tinySvg({ size: 28 }) };
export const TINY_OPEN_KEY = "draft-ask:open";                 // the card's open state, remembered for the tab's session
function TinyBubble({ open, onPress, btnRef }) {
  return (
    <button type="button" ref={btnRef} className="appnav-tiny" data-tiny-launch="" data-open={open ? "true" : "false"}
      aria-expanded={!!open} aria-controls="appnav-ask" aria-label={open ? `Close ${TINY_NAME}` : `Ask ${TINY_NAME}`}
      title={open ? `Close ${TINY_NAME}` : `Ask ${TINY_NAME}`} onClick={onPress}>
      <span className="appnav-tiny__face" aria-hidden="true" dangerouslySetInnerHTML={TINY_FACE} />
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
  // ⭐ D197 #1 · A236 (b): the Notifications row opens the LIST in place (each row, its unread dot and time, Mark all read)
  // — since the account panel lost its opener the list was reachable nowhere; what to send stays one link below it.
  const [notifsOpen, setNotifsOpen] = useState(false);
  useEffect(() => { if (!open) setNotifsOpen(false); }, [open]);
  if (!profile) return null;
  const notifs = Array.isArray(profile.notifs) ? profile.notifs : [];
  const link = (panel, label, aside = null, extra = {}, plain = false) => (
    <a href={profileHref(panel)} data-peek-link={panel || "open"} {...extra}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); onGo(profileHref(panel)); }}>
      <span>{label}</span>{aside != null && <small {...(plain ? { "data-plain": "" } : null)}>{aside}</small>}
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
      {link("appearance", "Appearance", themeName || null, {}, true)}
      <button type="button" className="appnav-peek__row" data-peek-notifs="" aria-expanded={notifsOpen} aria-controls="appnav-peek-notifs"
        onClick={() => { if (!notifsOpen) profile.onLoadNotifs?.(); setNotifsOpen((o) => !o); }}>
        <span>Notifications</span>
        <span>{profile.badge > 0 && <small>{profile.badge > 9 ? "9+" : String(profile.badge)}</small>} <span className="appnav-peek__chev" aria-hidden="true">▾</span></span>
      </button>
      {notifsOpen && (
        <div id="appnav-peek-notifs" className="appnav-peek__notifs" data-peek-notif-list="">
          {notifs.length === 0
            ? <p className="appnav-peek__none">No notifications yet.</p>
            : <ul>{notifs.slice(0, 20).map((n, i) => (
              <li key={n.id ?? i} className="appnav-peek__notif" data-peek-notif={n.read ? "read" : "unread"} data-peek-notif-type={n.type || undefined}>
                <span className="appnav-peek__dot" data-read={n.read ? "true" : "false"} aria-hidden="true" />
                <span className="appnav-peek__ico" data-peek-notif-icon={notifIcon(n.type)}><Icon name={notifIcon(n.type)} size={16}/></span>
                <span>{n.message}{!n.read && <span className="pl-sr"> (unread)</span>}<time>{notifTimeAgo(n.created_at)}</time></span>
              </li>))}</ul>}
          <div className="appnav-peek__acts">
            {profile.badge > 0 && <button type="button" data-peek-mark-all="" onClick={() => profile.onMarkAll?.()}>Mark all read</button>}
            {link("notifications", "What to send me")}
          </div>
        </div>
      )}
      <div className="appnav-peek__sep" aria-hidden="true" />
      {link(null, "Open Profile", null, { className: "appnav-peek__open" })}
      <button type="button" className="appnav-peek__out" data-peek-signout="" onClick={() => { onClose(); profile.onSignOut?.(); }}>Sign out</button>
    </div>
  );
}

// ⭐ D190 · TINY (owner 11-15: "Tiny replaces Ask draft, floating") — this panel, renamed Tiny where a person reads it and
// drawn as a FLOATING CARD over the page above the fox bubble (AppNav.css .appnav-ask); the `data-ask-*` hooks stay (the
// walks and tests use them). `data-ask-open` on <html> still says it is open (A200's timeline fold reads it) but no longer
// pads the page. ~~D167 · ASK DRAFT — on the right, and it MOVES THE PAGE OVER~~ (superseded). ⭐ T5 v1 (owner 11-10, "OK ship it"): a short answer, one to three
// Atlas lessons (only lessons that exist), one next step, and at most one PROPOSED action that runs only when the person
// presses Confirm (POST /api/assistant/actions/:id/confirm — the server uses this session's user, never the model's say).
// The conversation lives here only (short-term memory, docs/ASSISTANT.md §2): closing the panel forgets it. Until the
// assistant is open to everyone (Admin → Atlas → Asks), the panel says so plainly instead of pretending to answer.
// ⭐ A199 (46j, owner 11-13: "the ask draft can be opened beside the answers section in home as a companion chat … the agent
// would write into the ask draft chat for each question, which appear in the ask draft chat instead of the home section"):
// a held question's draft is written HERE (the window event draft:ask-question from Home's stepper), never into the
// person's answer box. Each draft offers "Use as my answer" (draft:use-answer fills the stepper's box); when the résumé
// doesn't cover it, the person tells draft about it here and the answer is written from their own words (POST …/draft
// with `note`). Works whether or not the general assistant is open.
export function AskDraftPanel({ open, onClose, panelRef }) {
  // ⭐ A199 (2): one held application's questions as a thread here (components/AskDraftThread.jsx) — draft:open-questions.
  const [thread, setThread] = useState(null);
  const auto = useAutoApply();
  const { loadApplyRuns, loadApplyPending } = auto;
  const autoRef = useRef(auto); autoRef.current = auto;
  const navigate = useNavigate();
  useEffect(() => {
    const onOpen = (e) => {
      const d = e.detail || {};
      if (d.jobId == null || !Array.isArray(d.questions) || !d.questions.length) return;
      // ⭐ A210 (46l, the A199 (2) walk): the same job's NEXT held run (a Run again that came back with questions) is a new
      // thread — compared by job AND run, so it never stays on the last run's "Saved".
      const same = (t) => t && String(t.jobId) === String(d.jobId) && String(t.runKey ?? "") === String(d.runKey ?? "");
      setThread(t => (same(t) ? t : { jobId: d.jobId, runKey: d.runKey ?? null, company: d.company || "", questions: d.questions }));
    };
    window.addEventListener("draft:open-questions", onOpen);
    return () => window.removeEventListener("draft:open-questions", onOpen);
  }, []);
  const [status, setStatus] = useState(null);
  const statusRef = useRef(null); statusRef.current = status;
  // ⭐ D190: the conversation is kept for this tab's session (cleared on sign-out — App.jsx); Undo links live in memory only
  const [turns, setTurns] = useState(() => { try { return JSON.parse(sessionStorage.getItem(ASK_SESSION_KEY) || "[]"); } catch { return []; } });
  useEffect(() => {
    try { sessionStorage.setItem(ASK_SESSION_KEY, JSON.stringify(turns.slice(-60).map(({ undoFn, ...t }) => ({ ...t, live: false })))); } catch { /* storage blocked */ }
  }, [turns]);
  useEffect(() => {
    const clear = () => { setTurns([]); bot.reset(); undoStack.current.length = 0; };
    window.addEventListener(ASK_CLEAR_EVENT, clear);
    return () => window.removeEventListener(ASK_CLEAR_EVENT, clear);
  });
  // ⭐ D190 · ONE ENGINE (shared/assistantEngine.js): T1 actions and T2 lookups with NO model; T3 only on an explicit ask.
  const undoStack = useRef([]);
  const bot = useMemo(() => {
    const handlers = createDraftHandlers({
      navigate: (to) => navigate(to), api, action: assistantAction, undoStack: undoStack.current,
      t3Available: () => !!statusRef.current?.available,
      counts: () => {
        const a = autoRef.current || {};
        const questions = (a.applyQuestions || []).length, ready = (a.applyReviewJobs || []).length, other = (a.applyPending || []).length;
        return { needsYou: a.needsAttentionCount ?? questions + ready + other, questions, ready, other };
      },
      pending: () => {
        const a = autoRef.current || {};
        return [...(a.applyGatedJobs || []), ...(a.applyInFlight || []), ...(a.applyReviewJobs || [])]
          .map(row => ({ jobId: row.jobId, runKey: row.id ?? null, company: row.company || "", questions: heldQuestionsFor({ kind: "approval", ref: row }) }))
          .filter(p => p.jobId != null && p.questions.length);
      },
      openThread: (p) => setThread({ jobId: p.jobId, runKey: p.runKey, company: p.company, questions: p.questions }),
    });
    // "cancel that draft": the tracker's own Stop (abortRunJob) on this job's live run-job
    handlers.cancelDraft = async () => {
      const j = assistantAction("currentJob")?.() || assistantAction("deckJob")?.();
      if (!j) throw new Error("Open the job first — on Home, a card or a posting — and ask again.");
      const a = autoRef.current || {};
      const rows = [...(a.applyInFlight || []), ...(a.applyReviewJobs || []), ...(a.applyGatedJobs || [])].filter(r => String(r.jobId) === String(j.jobId ?? j.id));
      if (!rows.length) return { text: `${j.company || "This job"} has no draft running to cancel.` };
      await a.abortRunJob?.(rows.map(r => r.id));
      return { text: `Cancelled the draft of ${j.company || "this job"}. It's in your history as stopped.` };
    };
    return createAssistant({ commands: ASSISTANT_COMMANDS, site: "draft", handlers, fallback: handlers.fallback,
      examples: ["draft this job", "open my profile", "how many need me?", "what's my match?"],
      ledger: (typeof window !== "undefined" ? (window.__askDraftLedger ||= []) : null) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  // D190 · Tiny's card scrolls inside itself: the newest turn is kept in view (on open, and as each reply lands)
  const bodyRef = useRef(null);
  useEffect(() => { const b = bodyRef.current; if (open && b) b.scrollTop = b.scrollHeight; }, [open, turns.length, busy]);
  const [app, setApp] = useState(null);   // { jobId, question } — the application question being answered here
  const draftFor = useCallback(async (target, note = "") => {
    setBusy(true);
    try {
      const r = await api(`/api/apply/questions/${encodeURIComponent(target.jobId)}/draft`, { method: "POST", body: JSON.stringify({ question: target.question, ...(note ? { note } : {}) }) });
      setTurns(t => [...t, { who: "draft", app: target, text: r.draft, usable: true }]);
    } catch (err) {
      setTurns(t => [...t, { who: "draft", app: target, failed: true,
        text: err.message || "draft couldn't write this one — type your own answer in Home." }]);
    } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const onAsk = (e) => {
      const d = e.detail || {};
      if (d.jobId == null || !d.question) return;
      const target = { jobId: d.jobId, question: String(d.question) };
      setApp(target);
      setTurns(t => [...t, { who: "question", app: target, text: target.question }]);
      draftFor(target);
    };
    window.addEventListener("draft:ask-question", onAsk);
    return () => window.removeEventListener("draft:ask-question", onAsk);
  }, [draftFor]);
  const useAnswer = (t) => {
    window.dispatchEvent(new CustomEvent("draft:use-answer", { detail: { jobId: t.app.jobId, question: t.app.question, text: t.text } }));
    setTurns(x => x.map(y => (y === t ? { ...y, used: true } : y)));
  };
  useEffect(() => {
    if (!open) { setQ(""); setApp(null); return; }   // D190: closing keeps the conversation (the session forgets it)
    let live = true;
    api("/api/assistant/status").then(s => { if (live) setStatus(s); }).catch(() => { if (live) setStatus({ available: false }); });
    return () => { live = false; };
  }, [open]);
  const send = async (e) => {
    e?.preventDefault?.();
    const question = q.trim();
    if (!question || busy) return;
    // A199: while an application question is open here, what the person types is THEIR words for it — draft writes the answer.
    if (app) { setQ(""); setTurns(t => [...t, { who: "you", text: question }]); return draftFor(app, question); }
    return say(question);
  };
  // ⭐ D190: every typed line goes through the engine — T1 acts, T2 reads draft's own data, "ask" asks back / confirms first,
  // T3 (new writing) only when the person asked for it. Nothing that fails to match reaches a model.
  const say = async (question) => {
    setBusy(true); setQ("");
    setTurns(t => [...t, { who: "you", text: question }]);
    try {
      const m = await bot.handle(question);
      if (m.undo) undoStack.current.push(m.undo);
      setTurns(t => [...t, { who: "draft", tier: m.tier, label: m.label || TIER_LABEL[m.tier] || null, text: m.text, intent: m.intent || null,
        failed: !!m.failed, confirm: !!m.confirm, live: true, undoFn: m.undo || null, lessons: m.lessons || [], links: m.links || [], next: m.next || "",
        action: m.action || null }]);
    } catch (err) { setTurns(t => [...t, { who: "draft", text: err.message || `${TINY_NAME} couldn't answer just now.`, failed: true }]); }
    finally { setBusy(false); }
  };
  const undoTurn = async (i, t) => {
    setTurns(x => x.map((y, k) => (k === i ? { ...y, undoing: true } : y)));
    try {
      const r = await t.undoFn();
      const k = undoStack.current.indexOf(t.undoFn); if (k >= 0) undoStack.current.splice(k, 1);
      setTurns(x => x.map((y, k2) => (k2 === i ? { ...y, undoFn: null, undone: (r && r.text) || "Undone." } : y)));
    } catch (err) { setTurns(x => x.map((y, k2) => (k2 === i ? { ...y, undoFn: null, undone: err.message || "Couldn't undo." } : y))); }
  };
  // ⭐ D190 P4 · voice: the browser's speech-to-text → the same engine (a spoken command is the typed one)
  const [voice, setVoice] = useState({ on: false, note: "" });
  const listenRef = useRef(null);
  const canSpeak = typeof window !== "undefined" && voiceSupported(window);
  const toggleVoice = async () => {
    if (listenRef.current) { listenRef.current.stop(); return; }
    try {
      setVoice({ on: true, note: "" });
      listenRef.current = await listenOnce({ onText: (t) => { if (app) { setTurns(x => [...x, { who: "you", text: t }]); draftFor(app, t); } else say(t); },
        onEnd: (code) => { listenRef.current = null; setVoice({ on: false, note: code ? (VOICE_ERRORS[code] || "Voice stopped — type instead.") : "" }); } });
      setVoice({ on: true, note: voiceNote(listenRef.current.local) });
    } catch (err) { listenRef.current = null; setVoice({ on: false, note: err.message }); }
  };
  const answerConfirm = (i, yes) => { setTurns(x => x.map((y, k) => (k === i ? { ...y, confirm: false } : y))); say(yes ? "Yes" : "No"); };
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
  // ⭐ D197 Wave 2 #12 · M5 (47m, lane practice; the owner 11-27: the mock and the board AskRoute approved) · THE CARD IS THE
  // PLATE'S AskDraftCard (plate/Cards.jsx) — only the look and the route card change; the engine above is untouched (D190:
  // act first, ask a model last). An answer naming 2–3 Atlas entries draws as a route (plate/AskRouteMap.jsx); one stays a
  // link; more than three point to an existing route (the course's circle). Saved → POST /api/atlas/question-routes.
  const [routeSaves, setRouteSaves] = useState({});   // turn index → "saving" | "saved" | an error sentence
  const questionFor = (i) => { for (let k = i - 1; k >= 0; k--) if (turns[k]?.who === "you" || turns[k]?.who === "question") return turns[k].text; return ""; };
  const stopsOf = (t) => (t.lessons || []).map((l) => ({ slug: l.slug, name: l.name, href: `/app/atlas/${encodeURIComponent(l.slug)}`, lit: !!(l.lit || l.done) }));
  const saveRoute = async (i, t) => {
    setRouteSaves((x) => ({ ...x, [i]: "saving" }));
    try {
      await api("/api/atlas/question-routes", { method: "POST", body: JSON.stringify({ question: questionFor(i) || t.text, stops: stopsOf(t).map(({ slug, name }) => ({ slug, name })) }) });
      setRouteSaves((x) => ({ ...x, [i]: "saved" }));
    } catch (err) { setRouteSaves((x) => ({ ...x, [i]: err.message || "That route was not saved." })); }
  };
  const cardTurns = turns.map((t) => {
    const kind = t.who === "draft" ? askRouteKind(t.lessons) : null;
    return { ...t, text: t.answer || t.text, undo: !!t.undoFn, confirm: !!(t.confirm && t.live), routeKind: kind,
      lessons: kind === "route" || kind === "bigger" ? [] : t.lessons };
  });
  const renderTurn = (t, i) => {
    if (t.routeKind === "route") {
      const st = routeSaves[i];
      return <AskRouteCard stops={stopsOf(turns[i])} saved={st === "saved"} saving={st === "saving"} message={st && st !== "saved" && st !== "saving" ? st : null}
        onSave={() => saveRoute(i, turns[i])} onGo={(href) => navigate(href)} />;
    }
    if (t.routeKind === "bigger") {
      return <p className="pl-askroute__line" data-ask-route-bigger="">This is a bigger topic — walk it as a route: <a href={ROUTE_FOR_BIGGER}
        onClick={(e) => { e.preventDefault(); navigate(ROUTE_FOR_BIGGER); }}>From silicon to software</a> covers it, one stop at a time.</p>;
    }
    return null;
  };
  return (
    <aside id="appnav-ask" ref={panelRef} className="appnav-ask" role="dialog" aria-label={TINY_NAME} data-ask-draft="" data-tiny-card="" data-open={open ? "true" : "false"}
      {...(open ? null : { inert: "", "aria-hidden": true })}>
      <PlateRoot className="pl-askwrap">
        <AskDraftCard name={TINY_NAME} face={<span className="appnav-ask__face" dangerouslySetInnerHTML={TINY_FACE_SMALL} />}
          intro={app ? null : "Tell me what to do — “show me senior remote jobs in Boston”, “find data analyst jobs”, “draft this job”, “open my profile”, “how many need me?” — or ask about a skill, a role or how draft works. Anything draft already holds is done without AI."}
          turns={cardTurns} busy={busy} bodyRef={bodyRef} value={q} onChange={setQ} onSend={() => send()}
          placeholder={app ? "e.g. I set up Splunk alerts for the payments team…" : `Ask ${TINY_NAME} — e.g. find data analyst jobs · how many need me?`}
          canSpeak={canSpeak} listening={voice.on} onSpeak={toggleVoice} voiceNote={voice.note || null}
          improve={status?.available ? { on: !!status.improveAtlas, onToggle: toggleImprove } : null}
          onClose={onClose} onUndo={(i) => undoTurn(i, turns[i])} onAnswerBack={(i, yes) => answerConfirm(i, yes)}
          onDecide={(i, ok) => decide(i, turns[i].action, ok)} onUseAnswer={(i) => useAnswer(turns[i])} renderTurn={renderTurn}>
          {thread && (
            <AskDraftThread key={`${thread.jobId}:${thread.runKey ?? ""}`} thread={thread} onClose={() => setThread(null)}
              onSaved={() => { loadApplyRuns?.(); loadApplyPending?.(); window.dispatchEvent(new CustomEvent("draft:answers-saved", { detail: { jobId: thread.jobId } })); }} />
          )}
          {app && (
            <p className="pl-ask__intro" data-ask-app-question="">
              Answering <b>{app.question}</b> — tell {TINY_NAME} about it in your own words and it writes the answer.{" "}
              <button type="button" className="pl-btn" data-ask-app-done="" onClick={() => setApp(null)}>Done</button>
            </p>
          )}
        </AskDraftCard>
      </PlateRoot>
    </aside>
  );
}

export default function AppNav({ tabs = [], activeTab, hrefForTab, onTabChange, profile = null }) {
  const navigate = useNavigate();
  const [wide, setWide] = useState(false);      // the rail holds the focus (hover / focus / M) — `data-open`, <html data-dock-open>
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekPos, setPeekPos] = useState({ top: 0, left: 112 });
  // ⭐ D190 · Tiny's card: open or closed is remembered for the tab's session (the PDF-tools site's Tiny does the same).
  const [askOpen, setAskOpen] = useState(() => { try { return sessionStorage.getItem(TINY_OPEN_KEY) === "1"; } catch { return false; } });
  useEffect(() => { try { sessionStorage.setItem(TINY_OPEN_KEY, askOpen ? "1" : ""); } catch { /* storage blocked */ } }, [askOpen]);
  // A199: Home's held stepper asks for a draft → Tiny opens (the panel itself takes the question).
  // A199 (2): …and a held application's questions open as a thread there (draft:open-questions).
  useEffect(() => {
    const open = () => setAskOpen(true);
    window.addEventListener("draft:ask-question", open);
    window.addEventListener("draft:open-questions", open);
    return () => { window.removeEventListener("draft:ask-question", open); window.removeEventListener("draft:open-questions", open); };
  }, []);
  // ⭐ D180 P1 (45o): is the network on? (GET /api/network/status — false on any failure: the dock stays as it was.)
  const [network, setNetwork] = useState(false);
  const [netUnread, setNetUnread] = useState(0);   // D180 P2: unread messages on the dock's Messages
  useEffect(() => {
    let live = true;
    const ask = () => api("/api/network/status").then(r => { if (!live) return; setNetwork(!!r?.enabled); setNetUnread(Number(r?.unread) || 0); }).catch(() => {});
    ask(); const iv = setInterval(ask, 60_000);
    // 46f: a conversation just read (MessagesPane's Thread) → the Messages count now, not on the next minute's ask.
    window.addEventListener("rm:network-read", ask);
    return () => { live = false; clearInterval(iv); window.removeEventListener("rm:network-read", ask); };
  }, []);
  const { url: avatarUrl } = useAccountAvatar(!!profile);
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
  const dockOpen = wide || (peekOpen && canHover);

  // ⭐ D197 #1 · A237 (the Shell board, owner-approved 11-25): THE RAIL AT THE LEFT on wide screens — 84 px, 14 px from the
  // edge, the area nav across the top of the content column beside it (AppNav.css pads the shell by the rail); below
  // 980 px the rail becomes the phone's bottom bar. Re-measured on every resize; `data-dock-place` on <html> says which.
  const [place, setPlace] = useState(() => (typeof window === "undefined" ? "side" : dockPlace({ vw: document.documentElement.clientWidth || window.innerWidth })));
  useLayoutEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const next = dockPlace({ vw: root.clientWidth || window.innerWidth });
      root.setAttribute("data-dock-place", next);
      setPlace(next);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("resize", schedule); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (dockOpen) root.setAttribute("data-dock-open", "true"); else root.removeAttribute("data-dock-open");
  }, [dockOpen]);
  useEffect(() => () => { const r = document.documentElement; r.removeAttribute("data-dock-open"); r.removeAttribute("data-dock-place"); r.removeAttribute("data-ask-open"); }, []);

  // ⭐ D190 · Tiny floats over the page (owner 11-15): `data-ask-open` says it is open (A200's timeline fold reads it).
  // Opening puts the cursor in the box.
  useEffect(() => {
    const root = document.documentElement;
    if (askOpen) root.setAttribute("data-ask-open", "true"); else root.removeAttribute("data-ask-open");
    if (askOpen) askRef.current?.querySelector("[data-ask-input]")?.focus({ preventScroll: true });
  }, [askOpen]);

  // A press outside the dock lets it go; outside the dock and the peek closes the peek.
  useEffect(() => {
    if (!wide && !peekOpen) return undefined;
    const onDown = (e) => {
      const inDock = dockRef.current?.contains(e.target), inPeek = peekRef.current?.contains(e.target);
      if (!inDock && !inPeek) { setWide(false); closePeek(); }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [wide, peekOpen, closePeek]);

  // ⛔ 45n (owner 11-08, decision (10)): the dock is the one navigation. ⭐ D197 #1: the rail always shows its names (the
  // board), so M no longer widens it — M takes the keyboard INTO the dock (its current place) and back out (never while
  // typing). Esc: the peek first, then Tiny, then the dock lets go of the focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && peekOpen) { closePeek(); profRef.current?.focus({ preventScroll: true }); return; }
      if (e.key === "Escape" && askOpen) { setAskOpen(false); askBtnRef.current?.focus?.({ preventScroll: true }); return; }
      if (e.key === "Escape") { if (dockRef.current?.contains(document.activeElement)) document.activeElement.blur?.(); setWide(false); return; }
      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target;
        if (el?.closest?.("input,textarea,select,[contenteditable=''],[contenteditable='true']")) return;
        const dock = dockRef.current;
        if (!dock) return;
        e.preventDefault();
        if (dock.contains(document.activeElement)) { document.activeElement.blur?.(); setWide(false); return; }
        (dock.querySelector('[aria-current="page"]') || dock.querySelector("a,button"))?.focus({ preventScroll: true });
        setWide(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [peekOpen, askOpen, closePeek]);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  // The peek follows the dock — BESIDE the rail (its middle on the picture's, 10 px past the rail's right edge) and ABOVE
  // the phone's bottom bar (its middle over the picture), kept on screen.
  const placePeek = useCallback(() => {
    const r = profRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = peekRef.current?.offsetHeight || 420, w = peekRef.current?.offsetWidth || 268;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const d = dockRef.current?.getBoundingClientRect();
    if (document.documentElement.getAttribute("data-dock-place") === "side") {
      setPeekPos({ top: Math.max(12, Math.min(window.innerHeight - h - 12, r.top + r.height / 2 - h / 2)), left: Math.round((d ? d.right : r.right) + 10) });
    } else {
      setPeekPos({ top: Math.max(12, Math.round((d ? d.top : r.top) - h - 10)), left: Math.round(Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2))) });
    }
  }, []);
  const showPeek = useCallback(() => { clearTimeout(peekTimer.current); placePeek(); setPeekOpen(true); }, [placePeek]);
  // Resting ≈ 350 ms on the picture opens it; leaving the picture or the peek closes it after 250 ms unless the pointer
  // reached the other one.
  const onProfileEnter = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(showPeek, 350); };
  const onProfileLeave = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => { if (!peekRef.current?.matches(":hover")) setPeekOpen(false); }, 250); };
  const onPeekEnter = () => clearTimeout(peekTimer.current);
  const onPeekLeave = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => { if (!profRef.current?.matches(":hover")) setPeekOpen(false); }, 250); };
  const pressProfile = () => {
    if (peekOpen) { closePeek(); return; }
    showPeek();
    requestAnimationFrame(() => peekRef.current?.querySelector("a,button:not([disabled])")?.focus({ preventScroll: true }));
  };
  const pressAsk = () => { setWide(false); closePeek(); setAskOpen((o) => !o); };

  // ⭐ D197 #1 · the dock's items, in D167's order with their badges (placesOf), drawn by the plate's one Dock: the /d tile
  // is the jobs' entry (the market); Profile is the person's picture (initials without one) and opens the peek; on the
  // rail Ask draft (after the rule, the board's) opens Tiny — Tiny's own fox bubble stays (D190).
  const bar = place === "phone";
  const brand = (tabs || []).find((t) => isJobs(t.id)) || { id: "today" };
  const home = { id: brand.id, href: hrefForTab?.(brand.id) || "/app/jobs", label: "draft — the market",
    attrs: { "data-nav-item": brand.id, "data-nav-brand": "" } };
  const current = isJobs(activeTab) ? brand.id : activeTab;
  const items = placesOf(tabs, network, netUnread).filter((t) => !isJobs(t.id)).map((t) => {
    const href = hrefForTab?.(t.id) || pathOf(t.id);
    return { id: t.id, label: DOCK_NAMES[t.id] || t.label, href, icon: DOCK_ICON[t.id] || "list", badge: t.badge, badgeLabel: t.badgeLabel,
      attrs: { "data-nav-item": t.id } };
  });
  if (profile) items.push({ id: "profile", label: "Profile", onPress: pressProfile, itemRef: profRef, badge: profile.badge, badgeLabel: profile.badgeLabel,
    ...(avatarUrl ? { img: avatarUrl } : { initials: initialsOf(profile.name) }),
    attrs: { "data-nav-item": "profile", "aria-label": "Profile", "aria-haspopup": "dialog", "aria-expanded": !!peekOpen, "aria-controls": "appnav-peek",
      ...(canHover ? { onMouseEnter: onProfileEnter, onMouseLeave: onProfileLeave } : null) } });
  const ask = bar ? null : { onPress: pressAsk, attrs: { "data-nav-item": "ask", "aria-expanded": !!askOpen, "aria-controls": "appnav-ask", "aria-label": `Ask draft — opens ${TINY_NAME}` } };

  const body = typeof document !== "undefined" ? document.body : null;
  return (
    <>
      {body && createPortal(
        <PlateRoot className="appnav-plate" data-appnav-plate="">
          <Dock home={home} items={items} ask={ask} current={current} bar={bar} onGo={go} navRef={dockRef}
            navProps={{ "data-nav-dock": "", "data-open": dockOpen ? "true" : "false", "data-place": place, "aria-keyshortcuts": "M",
              onFocus: () => setWide(true),
              onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setWide(false); } }} />
          <ProfilePeek open={peekOpen} profile={profile} pos={peekPos} onGo={goPath} onClose={closePeek}
            onEnter={canHover ? onPeekEnter : undefined} onLeave={canHover ? onPeekLeave : undefined} peekRef={peekRef} />
          <AskDraftPanel open={askOpen} panelRef={askRef} onClose={() => { setAskOpen(false); askBtnRef.current?.focus?.({ preventScroll: true }); }} />
          <TinyBubble open={askOpen} onPress={pressAsk} btnRef={askBtnRef} />
        </PlateRoot>, body)}
    </>
  );
}

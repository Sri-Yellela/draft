// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
// client/src/components/TopBar.jsx — the app's single fixed nav (Lucy Brand)
//
// This header said "converges from full-width bar -> centered glassy pill on scroll" for as long as
// the file existed, and it never did. The convergence read AppScrollContext's `progress`, whose only
// writer listened on a container that never scrolls, so the value was permanently 0 and the bar was
// permanently the full-width end of the interpolation. The machinery is removed; the description is
// corrected to what it always rendered. position:fixed, full width, no elevation.
//
// ⛔ NOT TRANSPARENT (10-01). It was, as the leftover of the pill's p < 0.02 branch — never a decision —
// and with the deck's in-place expansion a long card scrolled visibly THROUGH the tab labels. The bar is
// now frosted SURFACE_2 with the glass hairline under it: INK and INK_MUTED on SURFACE_2 are declared,
// contrast-proved pairs in both themes (colorTokens.js CONTRAST_PAIRS), so the labels stay AA over anything.
import { useState, useEffect, useCallback } from "react";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import { api } from "../lib/api.js";
import { StampLogo } from "./StampLogo.jsx";
import { Z } from "../styles/zLayers.js";
import AppNav from "./AppNav.jsx";
import "./TopBar.css";

// The slideDown keyframes and injectKeyframes() were removed with the pill (Y4).
//
// They existed for one thing: the collapsed pill's entrance. The keyframe carried a comment
// explaining, at length, why it animated TRANSFORM ONLY and never opacity — fading in from opacity 0
// opened a window in which the outgoing bar was already gone and the incoming pill was not yet
// visible, captured at the crossing as `bar: null, pill: { opacity: 0 }`. That reasoning was correct
// and is now moot: there is no crossing, because there is one search surface.
//
// ── Parse hex → [r,g,b] ──────────────────────────────────────

// ── The brand mark ───────────────────────────────────────────
//
// ⛔ THIS USED TO BE A SECOND IMPLEMENTATION OF THE MARK, AND IT SHIPPED THE OLD BRAND.
//
// It drew its own stamp and spelled the legacy name as two hardcoded spans — split so the tail
// could collapse, which is also why test/brandAndOriginGuard.test.js could not see it: that guard
// searched for the name as a CONTIGUOUS string. P4 swept the other two copies and missed this one,
// so production's app nav showed the old brand for days with the suite green. Found by
// screenshotting the real board on 2026-09-26.
//
// It is one call now. See StampLogo.jsx's header for the full account, including which of the
// three copies' disagreements survived and why.
//
// ⚠ THE 33-PIXEL CLIPPING FINDING LIVES ON IN StampLogo.jsx AND IS NOT LOST. This copy was the one
// that had it right — no `overflow` on the stamp box, established by A/B'ing the running app at
// deviceScaleFactor 6 and differencing. The shared component adopted that, so unifying applied
// this file's measurement to every other caller rather than discarding it.
//
// The wrapper is kept rather than inlined at the call site: it is referenced by name in
// test/topBarChrome.test.js and test/appScrollProgressRemoved.test.js, which slice the file
// between this function and the next to assert the mark's chrome.
function AnimatedLucyLogo() {
  return <StampLogo size="nav"/>;
}

// D10 / D18's TabLabel (a two-word tab name on two lines) went with the tab row (D145): the Dock and the Menu set each
// name on one line with its plain words under it (AppNav.jsx).

// ── Notifications ─────────────────────────────────────────────
//
// These used to be a bell of their own in the top bar, beside a quick-actions button. Both are
// gone from the bar (W6): quick actions entirely, and the bell INTO the profile menu.
//
// The one thing that could not move with it is the unread count. A notification nobody can see is
// not a notification, and burying the count behind a menu you have to open first would make unread
// items invisible — so the badge stays in the bar, on the avatar, and only the LIST moved. That
// split is why this is a hook plus a section rather than one component: the badge and the list are
// two renderings of one piece of state, in two places, and they must not be able to disagree.
// ⭐ 47j w1-shell: the list is the dock peek's (AppNav ProfilePeek, D197 #1 · A236 (b)) — the panel that drew it is gone.
function useNotifications() {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/notifications");
      setNotifs(d.notifications || []);
      setUnread(d.unreadCount || 0);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useSyncEvents({
    notification:     () => setUnread(n => n + 1),
    scrape_complete:  () => setUnread(n => n + 1),
    resume_generated: () => setUnread(n => n + 1),
  });

  const markAll = useCallback(async () => {
    try { await api("/api/notifications/read-all", { method: "PATCH" }); } catch {}
    setNotifs(n => n.map(x => ({ ...x, read: 1 })));
    setUnread(0);
  }, []);

  return { notifs, unread, load, markAll };
}

// ⛔ 47j w1-shell (D197 Wave 1 #1): THE ACCOUNT PANEL IS GONE. ProfileMenuPanel (D149's Profile panel — the old avatar
// menu) opened only through the dock's `profile.onOpen`, which D197 #1's plate dock never calls, so nothing could reach it.
// Every link and action it carried has a home in the live shell (D200 Rule 1):
//   Profile / the username → About      the peek's Open Profile / its name (ABOUT_HREF)
//   the notifications list, Mark all read  the peek's Notifications row (the same useNotifications state, below)
//   the job-profile switcher (activate, delete, add)  Profile → Your profile → Behind your profile (ProfilePanel's Job
//                                       Profiles) and the full manager, /app/job-profiles
//   the quick System / Light / Dark switch  the peek's Appearance → Profile → Appearance (the Customise screen, D93)
//   Plan · tier words · View Plans (lever on)  Profile → Account (ProfilePage's ProfilePlanLine, the same lever)
//   Job Profiles · Saved answers · Account & security · Customise · Integrations  Profile's own nav (Your profile's
//                                       Behind your profile · Saved answers · Account · Appearance · Connections)
//   Sign Out                            the peek's Sign out (the same onLogout)
// The panel's notification type icons were its own decoration; the peek's list draws a dot, the words and the time.

// ═══════════════════════════════════════════════════════════════
// Main TopBar — position:fixed, convergence animation
// ═══════════════════════════════════════════════════════════════
export default function TopBar({
  user, onTabChange, onLogout, onUserChange,
  // THE TAB ROW LIVES HERE NOW (Y4). It used to sit in UnifiedSearchBar, which meant the app's
  // primary navigation was a slot on the search bar — so it appeared and disappeared with a control
  // that is only meaningful on the Jobs board.
  //
  // `tabs` is passed in rather than derived here, and comes from AppDashboard's appTabs — the single
  // source established when three hardcoded copies of the tab list were found, two of which had
  // never heard of "Auto Apply". This component does NOT own a list.
  //
  // `onTabChange` is NOT declared again below: it is already a prop above, because the profile menu
  // has always used it to reach Profile / Job Profiles / Plans / Integrations. The tab row and the
  // menu route through the same handler, which is AppDashboard's handlePanelChange — so the row
  // cannot navigate to somewhere the menu cannot, and neither can drift onto its own list.
  tabs = [],
  activeTab,
  // AH2: the tab row is made of REAL LINKS now, and this is where their href comes from.
  //
  // It used to be `<button onClick={onTabChange}>`, which meant the application's primary
  // navigation could not be opened in a second tab by any means a browser offers — no ctrl/cmd
  // click, no middle click, no "Open link in new tab" in the context menu, nothing for a screen
  // reader to report as a link. The panels themselves were always deep-linkable (/app/auto-apply
  // renders fine when you reach it), so "I can't have Jobs in one tab and Auto Apply in another"
  // was never a state bug — it was the absence of any affordance to get the second tab.
  //
  // Supplied by AppDashboard's pathForTab, the same function its click handler routes through, so
  // the href and the click can never point at different places.
  hrefForTab,
}) {
  // GONE WITH THE PILL (Y4): `searchSurface` / `boardIsActive` props, `pillIsTheSearchSurface`,
  // `hovered` + `setHovered` + `hoverTimerRef` + handleMouseEnter/handleMouseLeave (a 100ms grace
  // period for the gap between two pills that no longer exists — and `hovered` was write-only: two
  // handlers set it and nothing ever read it), `searchFocused` (read only by the pill's input
  // width), the effect that cleared both on un-scroll, and injectKeyframes' slideDown.
  //
  // `p` and `scrolled` ARE GONE NOW. Y4 kept them, correctly for its own scope: they were not pill
  // machinery, and removing them meant changing the logo's signature, which Y1 forbade. Y4 reported
  // them as provably dead instead and recommended this pass. Confirmed with the owner, then removed.

  const { setActiveProfileId } = useJobBoard() || {};

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ⭐ D145 Step 3 (owner 11-03): the tab row that lived here is REMOVED — the sections are reached from the Dock or the
  // Menu (AppNav.jsx, the user's choice in Settings → Appearance → Navigation). Its width tiers and overflow
  // measuring went with it.

  // The active job profile, read once and followed (profile_switched) — the board's profile cache keys on it
  // (JobBoardContext setActiveProfileId). ⛔ 47j w1-shell: the account panel's switcher (activate / delete) that also lived
  // here went with the panel; switching is Profile → Your profile and /app/job-profiles, whose activation emits
  // profile_switched, read below.
  const loadProfiles = useCallback(() => {
    if (!user) return;
    api("/api/domain-profiles")
      .then(d => {
        const rows = Array.isArray(d) ? d : [];
        const active = rows.find(p => p.is_active) || rows[0];
        if (active) setActiveProfileId?.(active.id);
      })
      .catch(() => {});
  }, [user, setActiveProfileId]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  useSyncEvents({
    profile_switched: ({ profileId }) => {
      if (profileId) setActiveProfileId?.(Number(profileId));
      loadProfiles();
    },
  });

  // ── Geometry ──
  //
  // WAS an interpolation over AppScrollContext's `progress`, which was permanently 0. Every value
  // below is the p=0 end of that interpolation, i.e. what the bar has always actually rendered:
  //
  //     pillWidth      vw - p * (vw - 400)      -> vw            (full-bleed, never a pill)
  //     radius         p * 9999                 -> 0
  //     topOffset      p * 10                   -> 0
  //     blur           12 + p * 8               -> unused; effectiveBlur was `p < 0.02 ? 0 : blur`
  //     pillBg         gradient over p           -> "transparent" (the p < 0.02 branch)
  //     borderColor    rgba(accent, p * 0.25)   -> "transparent" (the p < 0.02 branch)
  //     shadow         elevation over p          -> "none"        (the p <= 0.05 branch)
  //
  // hexToRgb(theme.accent) went with them: `ar`/`ag`/`ab` existed only to build the two accent
  // values above, and the function had no other caller.
  //
  // The bar is still centred on the viewport rather than left-anchored, which is why dockCenter and
  // the translateX(-50%) survive a full-width bar: the board's content column is centred too, so the
  // two coincide (measured at vw=1600: search bar spans 340..1260, centre 800 = vw/2).
  // The notifications: their unread count rides on the dock's Profile item, the list opens in the peek (one state).
  const { notifs, unread, load: loadNotifs, markAll } = useNotifications();

  const dockCenter = vw / 2;
  const padH       = 20;

  // `pill2Bg` was here — the collapsed pill's glass gradient. Removed with the pill (Y4).

  // ONE ELEMENT NOW, not a fragment of two. The second was the collapsed search pill.
  //
  // data-app-chrome marks the element whose HEIGHT the in-flow column has to reserve. The bar is
  // position:fixed, so it reserves nothing itself, and nothing below it reserved anything for it
  // either — see hooks/useChromeHeight.js for the 32px overlap that produced on every tab but Jobs.
  // Measured off this element rather than declared as a constant, because the height moves with
  // font loading, zoom and which tab is showing.
  return (
      <div
        data-app-chrome=""
        style={{
          position: "fixed",
          top: 0,
          left: dockCenter,
          transform: "translateX(-50%)",
          width: vw,
          // D10: ~74px, so two-line tab labels sit beside a ~30px mark. The in-flow reserve and every
          // sticky offset read the MEASURED height (hooks/useChromeHeight.js), not this number.
          // ⭐ D197 #1 · A237 (the Shell board): the strip RESERVES NOTHING now — the rail sits in its own column at the left
          // and the area nav is the first thing in the content column (App's ShellAreaNav), so the page starts at the
          // top; --app-chrome-height (the sticky offsets) measures 0. The strip stays as the click-through carrier of the
          // dock's portal and the account panel. (D10's ~74 px bar, and D149's reserve under the floating mark, retired.)
          height: 0,
          borderRadius: 0,
          // ⭐ D149 (owner 11-03): the sketches have NO top bar — the /draft mark floats at the top left and the Menu
          // button (when Menu is the navigation) at the top right. The band, its blur and its border are gone; the
          // strip stays as a click-through layer so the page still starts below the mark (--app-chrome-height).
          background: "transparent",
          border: "none",
          pointerEvents: "none",
          boxSizing: "border-box",
          boxShadow: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${padH}px`,
          overflow: "visible",
          zIndex: Z.NAV,
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}>
        {/* Left group: the mark. (The tab row that followed it is gone — D145, AppNav.) */}
        {/* flex 1 + clipped sides: the tab row must give way to the avatar, never slide under it — at 390px the
            avatar sat on top of "AUTO APPLY" (seen in the 10-02 reshoot). ⛔ D92: it clips its SIDES only
            (TopBar.css .tbar-group, clip-path) — `overflow: hidden` here cut the tabs' shadows into a rectangle. */}
        <div className="tbar-group">
          {/* Logo — "R" always visible, "esume Master" collapses */}
          <AnimatedLucyLogo/>

        </div>

        {/* Right: utility icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 8, pointerEvents: "auto" }}>
          {/* The bell and the quick-actions button are gone from the bar (W6). Notifications live
              in the dock's Profile peek (AppNav); their unread count rides on the Profile item so it is
              still visible without opening anything. */}
          {/* ⭐ D145: the Menu button (shown when Navigation is Menu, or Automatic on a phone) and the Dock (portalled to
              the bottom of the screen) — one list, the same `tabs` the row used to draw. */}
          <AppNav tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onTabChange={onTabChange}
            profile={user ? { badge: unread, name: user.displayName || user.name || user.username || user.email,
              badgeLabel: `${unread} unread notification${unread === 1 ? "" : "s"}`,
              // ⭐ D167: the dock's quick peek shows the email and signs out (App's one handleLogout).
              email: user.email || "", onSignOut: onLogout,
              // ⭐ D197 #1 · A236 (b): the peek's Notifications row opens the list (the same hook as the badge — one state)
              notifs, onLoadNotifs: loadNotifs, onMarkAll: markAll } : null} />
        </div>
      </div>
  );
}

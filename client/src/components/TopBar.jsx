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
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../styles/theme.jsx";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import { api } from "../lib/api.js";
import { StampLogo } from "./StampLogo.jsx";
import ProfileSelectorDropdown from "./ProfileSelectorDropdown.jsx";
import { Z } from "../styles/zLayers.js";
import { useNavigate } from "react-router-dom";
import { ABOUT_HREF, notifTimeAgo } from "./AppNav.jsx";   // A151: the username opens the About section
import { C } from "../styles/colorTokens.js";
import { ACTIVE_THEME, appearance, setAppearance } from "../themes/index.js";
import AppNav from "./AppNav.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
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

const NOTIF_TYPE_ICONS = {
  scrape_complete: "🔍", resume_generated: "✦", ats_scored: "🎯",
  enhance_ready: "✨", best_match: "⚡", apply_complete: "✅",
  // D112 item 8 (services/notify.js): the person's pipeline events.
  needs_you: "!", inbox_reply: "✉", auto_daily_summary: "☰",
};

// notifTimeAgo: AppNav.jsx's (D197 #1 — the peek's notifications list reads the same one)

// The list, rendered inside the profile menu. Every row, the mark-all-read action, the per-item
// unread dot, the icons and the relative timestamps are the bell's, unchanged — this is where they
// live now, not a reduced version of them. Scrolls within itself so a long list cannot push the
// rest of the menu off screen.
function NotificationsSection({ theme, notifs, unread, markAll }) {
  return (
    <div style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px 8px" }}>
        <span style={{ fontSize: ts(10), fontWeight: 700, textTransform: "uppercase",
                       letterSpacing: "0.08em", color: theme.textDim }}>
          Notifications{unread > 0 ? ` (${unread})` : ""}
        </span>
        {unread > 0 && (
          <button onClick={markAll}
            style={{ background: "none", border: "none", cursor: "pointer",
                     fontSize: ts(10), color: theme.accentText, fontWeight: 700, padding: 0 }}>
            Mark all read
          </button>
        )}
      </div>
      {notifs.length === 0 ? (
        <div style={{ padding: "8px 16px 14px", fontSize: ts(12), color: theme.textDim }}>
          No notifications yet
        </div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", paddingBottom: 6 }}>
          {notifs.slice(0, 20).map(n => (
            <div key={n.id} style={{
              padding: "8px 16px", display: "flex", alignItems: "flex-start", gap: 10,
              background: !n.read ? `${theme.accent}0d` : "transparent",
            }}>
              <span style={{ fontSize: ts(14), flexShrink: 0, marginTop: 1 }}>
                {NOTIF_TYPE_ICONS[n.type] || "ℹ"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ts(12), color: theme.text, lineHeight: 1.4 }}>{n.message}</div>
                <div style={{ fontSize: ts(10), color: theme.textDim, marginTop: 2 }}>{notifTimeAgo(n.created_at)}</div>
              </div>
              {!n.read && (
                <div style={{ width: 6, height: 6, borderRadius: "50%",
                               background: theme.accent, flexShrink: 0, marginTop: 4 }}/>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick actions removed (W6). The control was a ⚡ button opening three items: "Search new role"
// and "ATS sort", which both did nothing but navigate to the jobs tab — the same thing the JOBS tab
// beside them already does, and neither actually searched or sorted anything — and "Export PDF",
// which called window.print() on the whole application chrome. Nothing here is preserved elsewhere
// because there was no behaviour to preserve.

// ⭐ D93 · THE QUICK SCHEME SWITCH — System | Light | Dark, inside the family of the theme in use (Paper Light /
// Charcoal Dark, or Contrast Light / Contrast Dark). Saved to the account like every appearance choice, then
// applied (the palette resolves once, at load, so applying is a reload). The full choice is on Customise.
const SCHEMES = [["system", "System"], ["light", "Light"], ["dark", "Dark"]];
function QuickScheme() {
  const cur = appearance();
  const contrast = ACTIVE_THEME.contrast === "aaa";
  const on = cur.pref === "system" || cur.pref === "contrast" ? "system" : ACTIVE_THEME.scheme;
  const prefFor = (s) => (s === "system" ? (contrast ? "contrast" : "system")
    : contrast ? (s === "dark" ? "contrast-dark" : "contrast-light") : (s === "dark" ? "charcoal-dark" : "paper-light"));
  const pick = (s) => {
    if (s === on) return;
    const pref = prefFor(s);
    api("/api/settings/appearance", { method: "PUT", body: JSON.stringify({ theme: pref, cues: cur.cues }) })
      .catch(() => {}).finally(() => setAppearance({ pref, cues: cur.cues }));
  };
  return (
    <div role="radiogroup" aria-label="Light or dark" data-quick-scheme=""
      style={{ display: "flex", gap: 4, marginTop: 6 }}>
      {SCHEMES.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={on === id} onClick={() => pick(id)}
          style={{ flex: 1, padding: "6px 8px", borderRadius: 8, cursor: on === id ? "default" : "pointer", fontSize: ts(12), fontWeight: 700,
                   background: on === id ? "var(--c-accent)" : "transparent", color: on === id ? "var(--c-fh-on-accent)" : "var(--c-ink)",
                   border: on === id ? "1px solid var(--c-fh-accent-edge)" : "1px solid var(--c-border-strong)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ⭐ D149 (owner 11-03): THE TOP BAR IS GONE, AND ITS ACCOUNT MENU IS THE PROFILE PANEL (ProfileMenuPanel — not panels/ProfilePanel.jsx, the Profile page, nor
// panels/AccountPanel.jsx, the Account & security page) — opened by "Profile — you and
// your résumé", the last button of the Dock and of the Menu (AppNav), it slides in from the right like the Menu's panel
// (the same surface, Close, Esc and a click outside close it). What it holds is the old avatar menu's, unchanged:
// Profile, the notifications, the job-profile switcher, the appearance shortcut, the plan, the settings links, Sign Out.
function ProfileMenuPanel({ open, onClose, theme, user, onLogout, onTabChange, profiles, onActivateProfile, onDeleteProfile,
                        notifs, unread, markAll }) {
  const monetisationEnabled = useMonetisationEnabled();
  const navigate = useNavigate();   // A151
  const panelRef = useRef(null);
  const planTier = user?.planTier || "BASIC";
  const planLabel = planTier === "PRO" ? "Pro" : planTier === "PLUS" ? "Plus" : "Basic";
  const toolLabel = planTier === "PRO" ? "Generate + A+ Resume"
    : planTier === "PLUS" ? "Generate"
    : "Your jobs and today's picks";
  const menuItemStyle = {
    padding: "10px 16px", cursor: "pointer", fontSize: ts(13),
    color: theme.text, background: "transparent", border: "none",
    display: "block", width: "100%", textAlign: "left",
  };
  const activeProfile = profiles?.find(p => p.is_active) || profiles?.[0] || null;
  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector("button")?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="appnav-scrim" data-open={open ? "true" : "false"} aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Profile" ref={panelRef} className="appnav-panel acct-panel" data-account-panel=""
        data-open={open ? "true" : "false"} {...(open ? null : { inert: "", "aria-hidden": true })}>
        <button type="button" className="appnav-close" onClick={onClose}>Close</button>
        {/* PROFILE nav */}
          <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${theme.border}` }}>
            <button
              onClick={() => { onClose(); onTabChange?.("profile"); }}
              style={{
                background: "transparent", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontWeight: 400, fontSize: ts(18), color: theme.text,
                display: "block", width: "100%", textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.color = theme.accent}
              onMouseLeave={e => e.currentTarget.style.color = theme.text}>
              Profile
            </button>
            {/* ⭐ A151 (45o): the username opens the profile's About section. */}
            <button type="button" data-username-about="" onClick={() => { onClose(); navigate(ABOUT_HREF); }}
              title="Your About section"
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", font: "inherit",
                fontSize: ts(10), color: theme.textDim, marginTop: 2, textAlign: "left" }}>
              {user?.username} - {user?.isAdmin ? "Administrator" : "Member"}
            </button>
          </div>

          <NotificationsSection theme={theme} notifs={notifs} unread={unread} markAll={markAll}/>

          <div style={{ padding: "10px 16px 10px", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: ts(10), fontWeight: 700, textTransform: "uppercase",
                           letterSpacing: "0.08em", color: theme.textDim, marginBottom: 8 }}>
              Job Profile
            </div>
            {/* D18: managing profiles is a SETTING (the Settings group below); this block only switches. */}
            {profiles?.length > 0 ? (
              <ProfileSelectorDropdown
                theme={theme}
                profiles={profiles}
                activeProfile={activeProfile}
                onActivate={onActivateProfile}
                onDelete={onDeleteProfile}
                onAdd={() => { onClose(); onTabChange?.("job-profiles"); }}
              />
            ) : (
              <button onClick={() => { onClose(); onTabChange?.("job-profiles"); }}
                style={{ width:"100%", border:`1px solid ${theme.border}`, borderRadius:6,
                         background:theme.surfaceHigh, color:theme.text, padding:"8px 10px",
                         cursor:"pointer", textAlign:"left", fontSize:ts(12), fontWeight:700 }}>
                Add your first job profile
              </button>
            )}
          </div>

          {/* Appearance — ⭐ D93: the QUICK switch stays here as a shortcut (system / light / dark, within the
              family of the theme in use: Paper, or Contrast); everything else — the four themes, shape cues, the
              layout options — lives on the Customise page (the Settings group below). */}
          <div style={{ padding: "10px 16px 10px", borderBottom: `1px solid ${theme.border}` }}>
            <div className="rm-section-label">Appearance</div>
            <QuickScheme />
          </div>

          {/* Plan heading, tier label, tool label and "View Plans" are all tier claims and go
              together when the lever is off. INTEGRATIONS IS NOT ONE and stays either way — it
              lived inside this same block, so hiding the block wholesale would have quietly
              removed a feature that has nothing to do with monetisation. */}
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${theme.border}` }}>
            {monetisationEnabled && (
              <>
                <div style={{ fontSize: ts(10), fontWeight: 700, textTransform: "uppercase",
                               letterSpacing: "0.08em", color: theme.textDim, marginBottom: 6 }}>
                  Plan
                </div>
                <div style={{ fontSize: ts(13), color: theme.text, fontWeight: 700 }}>{planLabel}</div>
                <div style={{ fontSize: ts(11), color: theme.textDim, marginTop: 2 }}>{toolLabel}</div>
                <button onClick={() => { onClose(); onTabChange?.("plans"); }}
                  style={{ ...menuItemStyle, marginTop:4, color:theme.accentText, fontWeight:700 }}>
                  View Plans
                </button>
              </>
            )}
            {/* D18 (10-03): JOB PROFILES LIVES IN SETTINGS. It left the top bar in D10; the page stays
                route-only (/app/job-profiles) and this group is its home, beside the other settings. */}
            <div className="rm-section-label" style={{ marginTop: monetisationEnabled ? 10 : 2 }}>Settings</div>
            <button onClick={() => { onClose(); onTabChange?.("job-profiles"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Job Profiles
            </button>
            <button onClick={() => { onClose(); onTabChange?.("saved-answers"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Saved answers
            </button>
            <button onClick={() => { onClose(); onTabChange?.("account"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Account &amp; security
            </button>
            {/* ⭐ D93: Customise — its own page (theme, shape cues, the layout options), beside the other settings. */}
            <button onClick={() => { onClose(); onTabChange?.("customise"); }} data-customise-link=""
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Customise
            </button>
            <button onClick={() => { onClose(); onTabChange?.("integrations"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Integrations
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { onClose(); onLogout?.(); }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--c-danger-quiet)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            style={{ ...menuItemStyle, color: "var(--c-danger)", fontWeight: 600 }}>
            Sign Out
          </button>
      </aside>
    </>, document.body);
}

// ═══════════════════════════════════════════════════════════════
// Main TopBar — position:fixed, convergence animation
// ═══════════════════════════════════════════════════════════════
export default function TopBar({
  user, onTabChange, onLogout, onUserChange, onProfileActivate,
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
  const { theme } = useTheme();

  // GONE WITH THE PILL (Y4): `searchSurface` / `boardIsActive` props, `pillIsTheSearchSurface`,
  // `hovered` + `setHovered` + `hoverTimerRef` + handleMouseEnter/handleMouseLeave (a 100ms grace
  // period for the gap between two pills that no longer exists — and `hovered` was write-only: two
  // handlers set it and nothing ever read it), `searchFocused` (read only by the pill's input
  // width), the effect that cleared both on un-scroll, and injectKeyframes' slideDown.
  //
  // `p` and `scrolled` ARE GONE NOW. Y4 kept them, correctly for its own scope: they were not pill
  // machinery, and removing them meant changing the logo's signature, which Y1 forbade. Y4 reported
  // them as provably dead instead and recommended this pass. Confirmed with the owner, then removed.

  const { setActiveProfileId, deleteProfileCache } = useJobBoard() || {};

  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ⭐ D145 Step 3 (owner 11-03): the tab row that lived here is REMOVED — the sections are reached from the Dock or the
  // Menu (AppNav.jsx, the user's choice in Settings → Appearance → Navigation). Its width tiers and overflow
  // measuring went with it.

  // Domain profiles for docked pill switcher
  const [profiles, setProfiles] = useState([]);
  const loadProfiles = useCallback(() => {
    if (!user) return;
    api("/api/domain-profiles")
      .then(d => {
        const rows = Array.isArray(d) ? d : [];
        setProfiles(rows);
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

  const activateProfile = async (id) => {
    const prev = profiles;
    setProfiles(ps => ps.map(pr => ({ ...pr, is_active: pr.id === id ? 1 : 0 })));
    setActiveProfileId?.(id);
    onProfileActivate?.(id);
    try {
      await api(`/api/domain-profiles/${id}/activate`, { method: "POST" });
    } catch {
      setProfiles(prev);
      const active = prev.find(p => p.is_active) || prev[0];
      if (active) setActiveProfileId?.(active.id);
    }
  };

  const deleteProfile = async (id) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    if (profiles.length <= 1) return;
    if (!confirm(`Delete job profile "${profile.profile_name}"?`)) return;
    try {
      await api(`/api/domain-profiles/${id}`, { method: "DELETE" });
      deleteProfileCache?.(id);
      const next = await api("/api/domain-profiles");
      const rows = Array.isArray(next) ? next : [];
      setProfiles(rows);
      const active = rows.find(p => p.is_active) || rows[0];
      if (active) setActiveProfileId?.(active.id);
      onProfileActivate?.(active?.id);
    } catch(e) {
      alert(e.message || "Could not delete profile");
    }
  };

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
  // ⭐ D149: the Profile panel's state and the notifications (their unread count rides on the Profile button).
  const { notifs, unread, load: loadNotifs, markAll } = useNotifications();
  const [accountOpen, setAccountOpen] = useState(false);
  const openAccount = useCallback(() => { loadNotifs(); setAccountOpen(true); }, [loadNotifs]);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

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
              in the profile menu below; their unread count rides on the avatar so it is still
              visible without opening anything. */}
          {/* ⭐ D145: the Menu button (shown when Navigation is Menu, or Automatic on a phone) and the Dock (portalled to
              the bottom of the screen) — one list, the same `tabs` the row used to draw. */}
          <AppNav tabs={tabs} activeTab={activeTab} hrefForTab={hrefForTab} onTabChange={onTabChange}
            profile={user ? { onOpen: openAccount, badge: unread, name: user.displayName || user.name || user.username || user.email,
              badgeLabel: `${unread} unread notification${unread === 1 ? "" : "s"}`,
              // ⭐ D167: the dock's quick peek shows the email and signs out with the same handler as the Profile panel.
              email: user.email || "", onSignOut: onLogout,
              // ⭐ D197 #1 · A236 (b): the peek's Notifications row opens the list (the same hook as the badge — one state)
              notifs, onLoadNotifs: loadNotifs, onMarkAll: markAll } : null} />
          {user && (
            <ProfileMenuPanel open={accountOpen} onClose={closeAccount}
              theme={theme} user={user} onLogout={onLogout} onTabChange={onTabChange}
              profiles={profiles} onActivateProfile={activateProfile} onDeleteProfile={deleteProfile}
              notifs={notifs} unread={unread} markAll={markAll} />
          )}
        </div>
      </div>
  );
}

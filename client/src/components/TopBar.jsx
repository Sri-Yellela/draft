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
import { useTheme } from "../styles/theme.jsx";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import { api } from "../lib/api.js";
import { StampLogo } from "./StampLogo.jsx";
import { DockPortal } from "./DockPortal.jsx";
import ProfileSelectorDropdown from "./ProfileSelectorDropdown.jsx";
import { Z } from "../styles/zLayers.js";
import { C, themePreference, setThemePreference } from "../styles/colorTokens.js";
import { useAccountAvatar } from "../lib/accountAvatar.js";

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

// D10: a two-word tab name is set on two lines ("Daily / Deck", "Full / House", "The / Table"), so the
// label is as tall as the mark beside it rather than a long single line. A one-word string, or a
// decorated ReactNode (Draft House's label + count, which calls this itself), renders as given. The
// accessible name is the same words with a space — the line break is a <br>, not a character in the name.
// D18: no tab carries a symbol — all four are two-line text in the same format.
// The scrollable tab row's "there is more" cue: the last 36px fade out (a mask, so it works over
// any background and in both themes — no colour literal).
const TAB_ROW_FADE = "linear-gradient(to right, var(--c-ink) calc(100% - 36px), transparent)";   // a mask reads alpha only; ink is opaque

export function TabLabel({ label }) {
  if (typeof label !== "string" || !label.includes(" ")) return label;
  const cut = label.indexOf(" ");
  return <>{label.slice(0, cut)}<br/>{label.slice(cut + 1)}</>;
}


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
};

function notifTimeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// The list, rendered inside the profile menu. Every row, the mark-all-read action, the per-item
// unread dot, the icons and the relative timestamps are the bell's, unchanged — this is where they
// live now, not a reduced version of them. Scrolls within itself so a long list cannot push the
// rest of the menu off screen.
function NotificationsSection({ theme, notifs, unread, markAll }) {
  return (
    <div style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px 8px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                       letterSpacing: "0.08em", color: theme.textDim }}>
          Notifications{unread > 0 ? ` (${unread})` : ""}
        </span>
        {unread > 0 && (
          <button onClick={markAll}
            style={{ background: "none", border: "none", cursor: "pointer",
                     fontSize: 10, color: theme.accentText, fontWeight: 700, padding: 0 }}>
            Mark all read
          </button>
        )}
      </div>
      {notifs.length === 0 ? (
        <div style={{ padding: "8px 16px 14px", fontSize: 12, color: theme.textDim }}>
          No notifications yet
        </div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", paddingBottom: 6 }}>
          {notifs.slice(0, 20).map(n => (
            <div key={n.id} style={{
              padding: "8px 16px", display: "flex", alignItems: "flex-start", gap: 10,
              background: !n.read ? `${theme.accent}0d` : "transparent",
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                {NOTIF_TYPE_ICONS[n.type] || "ℹ"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.4 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>{notifTimeAgo(n.created_at)}</div>
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

function UserAvatarMenu({ theme, user, onLogout, onTabChange, onUserChange, profiles, onActivateProfile, onDeleteProfile }) {
  const monetisationEnabled = useMonetisationEnabled();
  const [open,        setOpen]        = useState(false);
  const [rect,        setRect]        = useState(null);
  const triggerRef = useRef(null);
  // Notifications moved in here from their own bell in the bar. The COUNT stays outside, on the
  // avatar — see the badge below.
  const { notifs, unread, load: loadNotifs, markAll } = useNotifications();
  const { themeId, setThemeId, availableThemes } = useTheme();
  const { url: avatarUrl } = useAccountAvatar(!!user);
  const planTier = user?.planTier || "BASIC";
  const planLabel = planTier === "PRO" ? "Pro" : planTier === "PLUS" ? "Plus" : "Basic";
  const toolLabel = planTier === "PRO" ? "Generate + A+ Resume"
    : planTier === "PLUS" ? "Generate"
    : "Baseline jobs console";

  const menuItemStyle = {
    padding: "10px 16px", cursor: "pointer", fontSize: 13,
    color: theme.text, background: "transparent", border: "none",
    display: "block", width: "100%", textAlign: "left",
  };
  const activeProfile = profiles?.find(p => p.is_active) || profiles?.[0] || null;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        onClick={() => {
          if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
          setOpen(o => { if (!o) loadNotifs(); return !o; });
        }}
        title={unread > 0
          ? `${user?.username || "Account"} — ${unread} unread notification${unread === 1 ? "" : "s"}`
          : user?.username}
        aria-label={unread > 0
          ? `Account menu, ${unread} unread notification${unread === 1 ? "" : "s"}`
          : "Account menu"}
        style={{
          width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
          background: theme.accent, color: "var(--c-on-accent)",
          fontWeight: 800, fontSize: 12, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          outline: open ? `2px solid ${theme.accent}` : "none",
          outlineOffset: 2, transition: "outline 0.15s",
          fontFamily: "'DM Sans',system-ui,sans-serif",
        }}>
        {/* The account picture (uploaded, else Google's), the initial until there is one. */}
        {avatarUrl
          ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}/>
          : (user?.username || "U")[0].toUpperCase()}
        {/* The unread count, kept OUTSIDE the menu on purpose. Moving notifications into the
            profile menu is only safe if the fact that there ARE unread ones survives the move —
            otherwise they become invisible until someone happens to open a menu. Same "9+" cap and
            the same badge the bell carried, now on the avatar. Bordered against the avatar's own
            accent fill so it reads as a separate mark rather than part of the initial. */}
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: -3, right: -3,
              minWidth: 16, height: 16, padding: "0 3px",
              background: "var(--c-danger)", color: "var(--c-surface-solid)",
              border: `2px solid ${theme.surfaceBase || theme.surface}`,
              borderRadius: 999,
              fontSize: 9, fontWeight: 800, lineHeight: "12px", textAlign: "center",
            }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && rect && (
        <DockPortal anchorRect={rect} theme={theme} onClose={() => setOpen(false)}
          style={{ minWidth: 320, maxWidth: "calc(100vw - 24px)" }}>
          {/* PROFILE nav */}
          <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${theme.border}` }}>
            <button
              onClick={() => { setOpen(false); onTabChange?.("profile"); }}
              style={{
                background: "transparent", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "'Barlow Condensed','DM Sans',sans-serif",
                fontWeight: 800, fontSize: 14, letterSpacing: "0.06em",
                textTransform: "uppercase", color: theme.text,
                display: "block", width: "100%", textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.color = theme.accent}
              onMouseLeave={e => e.currentTarget.style.color = theme.text}>
              PROFILE
            </button>
            <div style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>
              {user?.username} - {user?.isAdmin ? "Administrator" : "Member"}
            </div>
          </div>

          <NotificationsSection theme={theme} notifs={notifs} unread={unread} markAll={markAll}/>

          <div style={{ padding: "10px 16px 10px", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
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
                onAdd={() => { setOpen(false); onTabChange?.("job-profiles"); }}
              />
            ) : (
              <button onClick={() => { setOpen(false); onTabChange?.("job-profiles"); }}
                style={{ width:"100%", border:`1px solid ${theme.border}`, borderRadius:6,
                         background:theme.surfaceHigh, color:theme.text, padding:"8px 10px",
                         cursor:"pointer", textAlign:"left", fontSize:12, fontWeight:700 }}>
                Add your first job profile
              </button>
            )}
          </div>

          {/* Appearance (UI step 6): System follows the OS. A change RELOADS — the palette resolves once
              at load, so the whole app (inline tokens, CSS variables, alpha suffixes) switches together. */}
          <div style={{ padding: "10px 16px 10px", borderBottom: `1px solid ${theme.border}` }}>
            <div className="rm-section-label">Appearance</div>
            <div role="radiogroup" aria-label="Appearance" style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([id, label]) => {
                const on = themePreference() === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on}
                    // Saved with the ACCOUNT first (so it follows you to other devices), then applied.
                    onClick={() => { if (!on) api("/api/settings/theme", { method: "PUT", body: JSON.stringify({ preference: id }) })
                      .catch(() => {}).finally(() => setThemePreference(id)); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: on ? "default" : "pointer", fontSize: 12, fontWeight: 700,
                             background: on ? "var(--c-hover)" : "transparent", color: "var(--color-text)",
                             border: on ? "1px solid var(--c-accent-ink)" : "1px solid var(--border-glass)" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme picker — hidden until more than one theme is registered */}
          {availableThemes.length > 1 && (
            <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${theme.border}` }}>
              <div className="rm-section-label">Theme</div>
              {availableThemes.map(t => (
                <button key={t.id} onClick={() => setThemeId(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", marginBottom: 4, width: "100%",
                    background: themeId === t.id ? "var(--c-hover)" : "transparent",
                    border: themeId === t.id ? `1px solid var(--color-primary)` : "1px solid var(--border-glass)",
                    borderRadius: 8, cursor: "pointer", color: "var(--color-text)",
                    fontSize: 12, textAlign: "left",
                  }}>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <span style={{ marginLeft: "auto", color: "var(--color-text-faint)", fontSize: 10 }}>
                    {themeId === t.id ? "Active" : "Switch"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Plan heading, tier label, tool label and "View Plans" are all tier claims and go
              together when the lever is off. INTEGRATIONS IS NOT ONE and stays either way — it
              lived inside this same block, so hiding the block wholesale would have quietly
              removed a feature that has nothing to do with monetisation. */}
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${theme.border}` }}>
            {monetisationEnabled && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                               letterSpacing: "0.08em", color: theme.textDim, marginBottom: 6 }}>
                  Plan
                </div>
                <div style={{ fontSize: 13, color: theme.text, fontWeight: 700 }}>{planLabel}</div>
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>{toolLabel}</div>
                <button onClick={() => { setOpen(false); onTabChange?.("plans"); }}
                  style={{ ...menuItemStyle, marginTop:4, color:theme.accentText, fontWeight:700 }}>
                  View Plans
                </button>
              </>
            )}
            {/* D18 (10-03): JOB PROFILES LIVES IN SETTINGS. It left the top bar in D10; the page stays
                route-only (/app/job-profiles) and this group is its home, beside the other settings. */}
            <div className="rm-section-label" style={{ marginTop: monetisationEnabled ? 10 : 2 }}>Settings</div>
            <button onClick={() => { setOpen(false); onTabChange?.("job-profiles"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Job Profiles
            </button>
            <button onClick={() => { setOpen(false); onTabChange?.("saved-answers"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Saved answers
            </button>
            <button onClick={() => { setOpen(false); onTabChange?.("account"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Account &amp; security
            </button>
            <button onClick={() => { setOpen(false); onTabChange?.("integrations"); }}
              style={{ ...menuItemStyle, marginTop:2, color:theme.accentText, fontWeight:700 }}>
              Integrations
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); onLogout?.(); }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--c-danger-quiet)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            style={{ ...menuItemStyle, color: "var(--c-danger)", fontWeight: 600 }}>
            Sign Out
          </button>
        </DockPortal>
      )}
    </div>
  );
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

  // The tab row scrolls when it does not fit (below ~760px with the full wordmark). D18/O56e: at
  // 390px "The Table" sat wholly past the edge with nothing to say it was there. Two small things:
  // tighter tab spacing on a phone, and a fade on the edge that still hides a tab, so the row reads
  // as scrollable. `tabsMore` is recomputed on scroll and resize; nothing fades when it all fits.
  const narrow = vw < 560;
  const tabRowRef = useRef(null);
  const [tabsMore, setTabsMore] = useState(false);
  const measureTabs = useCallback(() => {
    const el = tabRowRef.current;
    setTabsMore(!!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  useEffect(() => { measureTabs(); }, [measureTabs, vw, tabs]);

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
          height: 74,
          borderRadius: 0,
          background: C.SURFACE_2,
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          border: "none",
          borderBottom: `1px solid ${C.GLASS_EDGE}`,
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
        {/* Left group: the mark, then the app's primary navigation.
            logo | DAILY DECK | FULL HOUSE | DRAFT | THE TABLE (D10) */}
        {/* flex 1 + overflow hidden: the tab row must give way to the avatar, never slide under it —
            at 390px the avatar sat on top of "AUTO APPLY" (seen in the 10-02 reshoot). */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>
          {/* Logo — "R" always visible, "esume Master" collapses */}
          <AnimatedLucyLogo/>

          {/* THE TAB ROW. Moved here from UnifiedSearchBar (Y4), where the app's primary navigation
              was a slot on a control that is only meaningful on the Jobs board.

              The button styling is UnifiedSearchBar's verbatim — same padding, radius, border,
              colours, uppercase 12px/0.08em type, same active treatment — because this is a MOVE.
              `t.label` is a ReactNode, not a string: that is what carries the AUTO APPLY
              needs-review count, which AppDashboard decorates onto the tab before passing it down
              (see AppTopBar there). A review queue nobody sees is worse than a cluttered bar.

              `overflowX: auto` with a hidden scrollbar rather than wrapping: the bar is a fixed
              46px tall and five tabs plus the mark plus the avatar do not fit below about 700px of
              viewport. Scrolling keeps every tab REACHABLE at any width, where wrapping would push
              the second row outside the bar's height and clip it. */}
          <nav aria-label="Main" ref={tabRowRef} onScroll={measureTabs} style={{
            display: "flex", gap: narrow ? 2 : 4, alignItems: "center", minWidth: 0,
            overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none",
            ...(tabsMore ? { WebkitMaskImage: TAB_ROW_FADE, maskImage: TAB_ROW_FADE } : null),
          }}>
            {(tabs || []).map(t => (
              <a key={t.id}
                href={hrefForTab?.(t.id) || undefined}
                // Plain left-click stays an SPA navigation — preventDefault and route in-app, so
                // nothing about single-tab behaviour changes. Every MODIFIED click is left to the
                // browser: ctrl/cmd (new tab), shift (new window), middle-click, and the context
                // menu, which needs no handler at all now that there is an href to act on.
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onTabChange?.(t.id);
                }}
                aria-current={activeTab === t.id ? "page" : undefined}
                style={{
                  display: "inline-block", textDecoration: "none",
                  padding: narrow ? "5px 8px" : "5px 14px",
                  background: activeTab === t.id ? "var(--c-hover)" : "transparent",
                  border: activeTab === t.id ? "1px solid var(--color-primary)" : "1px solid transparent",
                  borderRadius: 14, lineHeight: 1.15, textAlign: "center",
                  color: activeTab === t.id ? "var(--color-text)" : "var(--color-text-muted)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: narrow ? "0.04em" : "0.08em",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}><TabLabel label={t.label}/></a>
            ))}
          </nav>
        </div>

        {/* Right: utility icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginLeft: 8 }}>
          {/* The bell and the quick-actions button are gone from the bar (W6). Notifications live
              in the profile menu below; their unread count rides on the avatar so it is still
              visible without opening anything. */}
          {user && (
            <UserAvatarMenu
              theme={theme} user={user} onLogout={onLogout}
              onTabChange={onTabChange} onUserChange={onUserChange}
              profiles={profiles}
              onActivateProfile={activateProfile}
              onDeleteProfile={deleteProfile}
            />
          )}
        </div>
      </div>
  );
}

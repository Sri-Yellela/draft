/*
 * ScrollDock — marketing + tools nav bar.
 * AppDockBar (authenticated) removed in Step 7 — TopBar.jsx handles the app.
 * MarketingToolsDock (public pages) and its helpers remain active.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../styles/theme.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { useScrollCollapsed } from "../hooks/useScrollCollapsed.js";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { StampLogo } from "./StampLogo.jsx";

// ── Logo ─────────────────────────────────────────────────────
// One call, not a third copy of the mark. This file used to draw its own stamp — see the header of
// StampLogo.jsx for why three copies of one mark is the mechanism a rename half-ships through.
//
// The dock shows the redesigned mark: "/draft", or "/d" when mini (09-30). The rotated accent rect
// it used to draw sat behind the old WHITE stamp; behind the orange mark it would swallow it, so it
// is gone with that stamp. The mark sizes itself.
// eslint-disable-next-line no-unused-vars
function LucyLogo({ theme, mini = false }) {
  return <StampLogo size={mini ? "mini" : "sm"} progress={mini ? 1 : 0}/>;
}

// ── Dock divider ─────────────────────────────────────────────
function DockDivider({ theme }) {
  return (
    <div style={{ width: 1, height: 20, background: `${theme.accent}33`,
                  flexShrink: 0, margin: "0 2px" }}/>
  );
}

// ── Mobile hamburger overlay ──────────────────────────────────
function HamburgerOverlay({ open, onClose, theme, links, ctaLinks }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: theme.bg,
      display: "flex", flexDirection: "column",
      padding: "72px 24px 24px",
    }}>
      <button onClick={onClose} style={{
        position: "absolute", top: 16, right: 16,
        background: "none", border: "none", cursor: "pointer",
        fontSize: 22, color: theme.textMuted,
      }}>✕</button>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {links.map(({ label, to }) => (
          <Link key={to} to={to} onClick={onClose}
            style={{
              fontSize: 22, fontWeight: 700, color: theme.text,
              textDecoration: "none", padding: "12px 0",
              borderBottom: `1px solid ${theme.border}`,
              fontFamily: "'Barlow Condensed','DM Sans',sans-serif",
              letterSpacing: "0.04em",
            }}>
            {label}
          </Link>
        ))}
      </nav>

      {ctaLinks && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {ctaLinks.map(({ label, to, primary }) => (
            <Link key={to} to={to} onClick={onClose}
              style={{
                display: "block", textAlign: "center",
                padding: "12px 24px", borderRadius: 8,
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                background: primary ? theme.accent : "transparent",
                color: primary ? "var(--c-on-accent)" : theme.text,
                border: primary ? "none" : `1px solid ${theme.border}`,
              }}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Marketing / Tools dock (scroll-collapse pill)
// ══════════════════════════════════════════════════════════════
function MarketingToolsDock({ variant }) {
  const monetisationEnabled = useMonetisationEnabled();
  const { theme } = useTheme();
  const { mode: vpMode } = useViewport();
  const isMobile = vpMode === "mobile" || vpMode === "tablet";

  const scrolled = useScrollCollapsed(60, false);
  const collapsed = scrolled;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Variant content definitions
  const MARKETING_LINKS = [
    { label: "Features",     to: "/features" },
    { label: "How It Works", to: "/how-it-works" },
    // D12: the extension is how a job from anywhere reaches the board, so the nav says where it is.
    { label: "Extension",    to: "/extension" },
    ...(monetisationEnabled ? [{ label: "Pricing", to: "/pricing" }] : []),
    { label: "About",        to: "/about" },
  ];
  const MARKETING_CTAS = [
    { label: "Sign In",     to: "/login",    primary: false },
    { label: "Get Started", to: "/register", primary: true },
  ];
  const TOOLS_LINKS = [
    { label: "ATS Scorer",         to: "/tools/ats" },
    { label: "Resume Generator",   to: "/tools/generate" },
    { label: "Draft",              to: "/tools/apply" },
  ];
  const TOOLS_CTAS = [
    { label: "← Full Platform", to: "/login",    primary: false },
    { label: "Sign Up Free",    to: "/register", primary: true },
  ];

  const navLinks  = variant === "marketing" ? MARKETING_LINKS : variant === "tools" ? TOOLS_LINKS : [];
  const ctaLinks  = variant === "marketing" ? MARKETING_CTAS  : variant === "tools" ? TOOLS_CTAS  : [];

  // ── Styles ────────────────────────────────────────────────
  const baseStyle = {
    display: "flex", alignItems: "center",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    zIndex: 200,
    transition: "all 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const expandedStyle = {
    ...baseStyle,
    position: "fixed",
    top: 0, left: 0, right: 0,
    height: 56,
    padding: "0 32px",
    justifyContent: "space-between",
    // theme.menuSurface, not `${theme.surface}f2`. theme.surface is the STRING "var(--bg-card)",
    // so appending a hex alpha produced "var(--bg-card)f2" — invalid CSS, which browsers drop
    // entirely, leaving this fixed top dock with no background at all over scrolling content.
    // menuSurface (var(--bg-menu), hsl(... / 0.98)) is the near-opaque floating-surface token
    // this was reaching for.
    background: theme.menuSurface || theme.surface,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: `1px solid ${theme.accent}1a`,
    borderRadius: 0,
    boxShadow: "none",
  };

  const collapsedStyle = {
    ...baseStyle,
    position: "fixed",
    top: 12,
    left: "50%",
    right: "auto",
    transform: "translateX(-50%)",
    height: 44,
    padding: "0 10px",
    justifyContent: "center",
    gap: 2,
    // Same invalid-CSS bug as the top dock above. This pill sits over page content and relies on
    // its blur, so it keeps a lighter surface than the top bar — but expressed as a real color
    // rather than an un-appendable var() reference.
    background: theme.menuSurface || theme.surface,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
    boxShadow: "var(--c-shadow-md)",
    maxWidth: "min(720px, calc(100vw - 24px))",
    width: "auto",
  };

  const finalStyle = collapsed ? collapsedStyle : expandedStyle;

  return (
    <>
      <nav style={finalStyle}>
        {/* ── LEFT: Logo ──────────────────────────────── */}
        <Link to="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <LucyLogo theme={theme} mini={collapsed || (isMobile && !collapsed)} />
        </Link>

        {/* ── CENTER: Nav links (desktop) ─────────────── */}
        {!isMobile && navLinks.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            ...(collapsed ? {} : { position: "absolute", left: "50%", transform: "translateX(-50%)" }),
          }}>
            {collapsed && <DockDivider theme={theme}/>}
            {navLinks.map(({ label, to }) => (
              <NavLinkItem key={to} to={to} label={label}
                collapsed={collapsed} theme={theme}/>
            ))}
          </div>
        )}

        {/* ── RIGHT: CTA buttons (desktop) ─ */}
        {!isMobile && ctaLinks.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {collapsed && <DockDivider theme={theme}/>}
            {ctaLinks.map(({ label, to, primary }) => (
              <Link className="dbx-depth" key={to} to={to} style={{
                fontSize: 13, fontWeight: 700, textDecoration: "none",
                padding: collapsed ? "5px 14px" : "7px 18px",
                background: primary ? theme.accent : "transparent",
                color: primary ? "var(--c-on-accent)" : theme.accentText,
                border: primary ? "none" : `1px solid ${theme.accent}55`,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}>
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* ── Mobile: hamburger ─────────────────────────── */}
        {isMobile && (
          <button onClick={() => setMobileMenuOpen(true)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 22, color: theme.textMuted, padding: "4px 8px", marginLeft: "auto",
            }}>
            ☰
          </button>
        )}
      </nav>

      <HamburgerOverlay
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        theme={theme}
        links={navLinks}
        ctaLinks={ctaLinks}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Main ScrollDock — routes to correct component by variant
// ══════════════════════════════════════════════════════════════
export default function ScrollDock({ variant = "marketing" }) {
  return <MarketingToolsDock variant={variant}/>;
}

// Helper: nav link with hover state
function NavLinkItem({ to, label, collapsed, theme }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: collapsed ? 12 : 13, fontWeight: 600,
        color: hovered ? theme.accent : theme.textMuted,
        textDecoration: "none",
        padding: collapsed ? "0 10px" : "6px 12px",
        borderRadius: 8, transition: "color 0.15s",
        lineHeight: collapsed ? "44px" : "auto",
        whiteSpace: "nowrap",
      }}>
      {label}
    </Link>
  );
}

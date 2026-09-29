// The one registered theme. Its id stays "cinematic" because that string is persisted in
// localStorage.rm_theme_id and read back by ThemeProvider; the theme itself is the paper one now —
// cream substrate, glass surfaces, the logo orange. Every value is a token from
// styles/colorTokens.js: this file maps the long-lived theme.* / --bg-* names onto them, so the
// ~1,600 theme.* reads and ~550 var(--bg-*/--color-*) reads moved with no edit.
import PaperBackground from "../components/PaperBackground.jsx";
import { C } from "../styles/colorTokens.js";

export const baseTheme = {
  bg:           "var(--bg-page)",
  surface:      "var(--bg-card)",
  surfaceHigh:  "var(--bg-panel)",
  menuSurface:  "var(--bg-menu)",
  modalSurface: "var(--bg-modal)",
  backdrop:     "var(--bg-blur)",
  backdropCard: "var(--bg-blur-sm)",
  bgBase:       C.CANVAS,
  surfaceBase:  C.SURFACE_SOLID,
  overlay:      C.HOVER,
  border:       C.BORDER,
  borderStrong: C.BORDER_STRONG,
  text:         C.INK,
  textMuted:    C.INK_MUTED,
  textDim:      C.INK_FAINT,
  // accent is the orange FILL; accentText is orange TEXT. They are different colours on purpose —
  // the fill fails AA as text on paper (2.96:1). See colorTokens.js.
  accent:       C.ACCENT,
  accentMuted:  C.ACCENT_QUIET,
  accentText:   C.ACCENT_INK,
  onAccent:     C.ON_ACCENT,
  success:      C.SUCCESS,
  successMuted: C.SUCCESS_QUIET,
  danger:       C.DANGER,
  dangerMuted:  C.DANGER_QUIET,
  warning:      C.WARNING,
  warningMuted: C.WARNING_QUIET,
  info:         C.INFO,
  infoMuted:    C.INFO_QUIET,
  shadowSm:     C.SHADOW_SM,
  shadowMd:     C.SHADOW_MD,
  shadowLg:     C.SHADOW_LG,
  shadowXl:     C.SHADOW_XL,
  gradAccent:   C.ACCENT,
  gradSubtle:   "linear-gradient(135deg, var(--bg-page) 0%, var(--bg-panel) 100%)",
  fontDisplay:  "'Barlow Condensed', 'DM Sans', system-ui, sans-serif",
  fontBody:     "'DM Sans', system-ui, sans-serif",
  fontMono:     "'JetBrains Mono', monospace",
  // The admin surface had its own citrus accent. One product, one accent: it is the orange too.
  adminAccent:      C.ACCENT,
  adminAccentText:  C.ACCENT_INK,
  adminAccentMuted: C.ACCENT_QUIET,
  colorPrimary:   C.ACCENT,
  colorSecondary: C.ACCENT_INK,
  colorAccent:    C.ACCENT_INK,
  colorSurface:   "var(--bg-card)",
  colorBorder:    C.BORDER,
  colorText:      C.INK,
  colorMuted:     C.INK_MUTED,
  colorDim:       C.INK_FAINT,
  colorCard:      "var(--bg-panel)",
  colorInputBg:   "var(--bg-input)",
  colorTag:       C.ACCENT_QUIET,
  gradBg:         "var(--bg-page)",
  gradPanel:      "var(--bg-card)",
  gradHover:      C.HOVER,
  glowPrimary:    `0 0 0 3px ${C.ACCENT_INK}33`,
  shimmer1:       C.HOVER,
  shimmer2:       C.BORDER,
  radiusPill:     "999px",
  radiusCard:     "16px",
  radiusInput:    "10px",
};

// The glass. Values are the SURFACE tokens; blur is unchanged — glass over the paper grain is the
// whole reason the substrate is textured (docs/UI_REDESIGN.md, "the palette problem").
export const cssVars = {
  "--bg-page":      C.SURFACE,
  "--bg-card":      C.SURFACE,
  "--bg-panel":     C.SURFACE_2,
  "--bg-menu":      C.SURFACE_MENU,
  "--bg-modal":     C.SURFACE_MODAL,
  "--bg-input":     C.SURFACE_INPUT,
  "--bg-hover":     C.HOVER,
  "--bg-blur":      "blur(40px) saturate(180%)",
  "--bg-blur-sm":   "blur(20px) saturate(160%)",
  "--border-glass": C.GLASS_EDGE,
};

export function styles(t) {
  return `
        body {
          margin: 0;
          font-family: 'DM Sans', system-ui, sans-serif;
          background: transparent;
          color: ${t.text};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transition: color 0.3s ease;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .site-title {
          font-family: 'Barlow Condensed', 'DM Sans', system-ui, sans-serif;
          font-weight: 800;
          font-size: 28px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${t.text};
          font-style: italic;
        }
        .glass-surface {
          backdrop-filter: var(--bg-blur-sm);
          -webkit-backdrop-filter: var(--bg-blur-sm);
          position: relative;
        }
        .glass-surface::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: 0.04;
          mix-blend-mode: overlay;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }
        .rm-card {
          background: ${t.surface};
          backdrop-filter: ${t.backdropCard};
          -webkit-backdrop-filter: ${t.backdropCard};
          border: 1px solid ${t.border};
          border-radius: 16px;
          padding: 20px 24px;
          box-shadow: ${t.shadowSm};
          transition: box-shadow 0.2s ease;
        }
        .rm-card-interactive {
          background: ${t.surface};
          backdrop-filter: ${t.backdropCard};
          -webkit-backdrop-filter: ${t.backdropCard};
          border: 1px solid ${t.border};
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: ${t.shadowSm};
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
        }
        .rm-card-interactive:hover {
          box-shadow: ${t.shadowLg};
          transform: translateY(-2px) scale(1.005);
          border-color: ${t.borderStrong};
        }
        .rm-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px; padding: 8px 20px; border-radius: 2px;
          font-family: 'Barlow Condensed', 'DM Sans', system-ui, sans-serif;
          font-weight: 800; font-size: 13px; letter-spacing: 0.1em;
          text-transform: uppercase; cursor: pointer;
          border: 2.5px solid ${t.text};
          background-color: transparent;
          background-image: linear-gradient(to top, transparent, transparent);
          background-size: 100% 0%;
          background-repeat: no-repeat;
          background-position: bottom;
          color: ${t.text};
          transition: background-size 1s ease, border-radius 1s ease, border-color 1s ease;
          white-space: nowrap; text-decoration: none; box-sizing: border-box;
        }
        .rm-btn:hover:not(:disabled) { border-radius: 999px; }
        .rm-btn:active { transform: scale(0.97); }
        .rm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rm-btn-primary:hover:not(:disabled) {
          background-image: linear-gradient(to top, ${t.accent}, ${t.accent});
          background-size: 100% 100%; border-color: ${t.accent}; color: ${t.onAccent};
        }
        .rm-btn-secondary:hover:not(:disabled) {
          background-image: linear-gradient(to top, var(--bg-panel), var(--bg-panel));
          background-size: 100% 100%; border-color: ${t.borderStrong};
        }
        .rm-btn-ghost { border-color: ${t.border}; color: ${t.textMuted}; }
        .rm-btn-ghost:hover:not(:disabled) {
          border-radius: 999px;
          background-image: linear-gradient(to top, ${t.overlay}, ${t.overlay});
          background-size: 100% 100%; border-color: ${t.borderStrong}; color: ${t.text};
        }
        .rm-btn-sm { padding: 5px 14px; font-size: 11px; gap: 4px; }
        .rm-btn-icon { padding: 0; width: 36px; height: 36px; border-radius: 999px; font-size: 16px; border: none; }
        .rm-btn-icon.sm { width: 28px; height: 28px; font-size: 13px; }
        .rm-input {
          width: 100%; height: 40px; padding: 0 14px;
          border-radius: 10px; border: 1px solid ${C.BORDER_CONTROL};
          background: ${t.colorInputBg}; color: ${t.text};
          backdrop-filter: ${t.backdropCard};
          -webkit-backdrop-filter: ${t.backdropCard};
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 13px;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .rm-input:focus { border-color: ${t.accentText}; box-shadow: 0 0 0 3px ${t.accentText}22; }
        .rm-input::placeholder { color: ${t.textDim}; }
        .rm-badge {
          display: inline-flex; align-items: center; padding: 3px 10px;
          border-radius: 999px; font-size: 10px; font-weight: 700;
          letter-spacing: 0.02em; white-space: nowrap;
        }
        .rm-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
          background: ${t.accentMuted}; color: ${t.accentText};
          border: 1px solid ${t.accent}22;
        }
        .rm-section-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: ${t.textDim}; margin: 0 0 8px;
        }
        .animate-in { animation: fadeUp 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) both; }
        .rm-table-row {
          transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        .rm-table-row:hover {
          transform: scale(1.008);
          box-shadow: ${t.shadowMd};
          z-index: 5;
          background: ${t.overlay} !important;
        }
        .rm-skeleton {
          background: linear-gradient(90deg, ${t.overlay} 25%, ${t.border} 50%, ${t.overlay} 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease infinite;
          border-radius: 8px;
        }
  `;
}

export default {
  id: "cinematic",
  label: "Paper",
  description: "Glass over a paper-grain substrate, in the logo's cream and orange",
  baseTheme,
  cssVars,
  styles,
  Wrapper: PaperBackground,
  fonts: {
    display: "'Instrument Serif', serif",
    body: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
  },
};

// client/src/styles/theme.jsx — Design System v6 (theme registry)
//
// Every colour below resolves to a token in styles/colorTokens.js. This file used to own an
// ACCENT_OPTIONS list of four accents (sky, lemon, green, sunset) and pick one AT RANDOM per
// session into sessionStorage.rm_session_accent. docs/UI_REDESIGN.md killed that (owner decision,
// 2026-09-27): it fought a two-colour identity, and it meant two screenshots of the same page
// differed by accent, so a visual diff needed a same-origin control to tell a change from noise.
// The accent is now the logo orange, always. The menu that let a user pick one of the four went
// with it (TopBar's "Accent Color" row).
import { useState, createContext, useContext } from "react";
import { getTheme, DEFAULT_THEME_ID, AVAILABLE_THEMES } from "../themes/index.js";
import { baseTheme as cinematicBase } from "../themes/cinematic.js";
import "./colorTokens.js";

// Preserved for backward-compat consumers (e.g. TopBar pillBg uses THEMES.dark.surfaceBase). The
// key says `dark` for those callers; the theme is the paper one.
export const THEMES = { dark: cinematicBase };

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("rm_theme_id");
      if (saved) return saved;
    } catch {}
    return DEFAULT_THEME_ID;
  });

  const setThemeId = (id) => {
    setThemeIdRaw(id);
    try { localStorage.setItem("rm_theme_id", id); } catch {}
  };

  const activeTheme = getTheme(themeId);
  // The paper substrate is a LIGHT surface. Callers that branch on isDark pick their light value.
  const isDark = false;
  const theme = activeTheme.baseTheme;

  const cssVarEntries = Object.entries(activeTheme.cssVars || {})
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n          ");

  const themeStyles = typeof activeTheme.styles === "function"
    ? activeTheme.styles(theme)
    : (activeTheme.styles || "");

  return (
    <ThemeContext.Provider value={{
      theme,
      tokens: theme,
      isDark,
      themeId,
      setThemeId,
      availableThemes: AVAILABLE_THEMES,
    }}>
      <style>{`
        /* ── Color token bridge: --color-* → styles/colorTokens.js ──
           ⛔ --color-primary-text is orange TEXT (ACCENT_INK) and must never sit on a
           --color-primary fill: that is the /pricing card that shipped invisible. Text on the
           orange fill is --color-on-primary. */
        :root {
          --color-primary:         var(--c-accent);
          --color-primary-hover:   var(--c-accent-hover);
          --color-primary-muted:   var(--c-accent-quiet);
          --color-primary-text:    var(--c-accent-ink);
          --color-on-primary:      var(--c-on-accent);
          --shadow-sm:             var(--c-shadow-sm);
          --color-warning:         var(--c-warning);
          --color-text:            var(--c-ink);
          --color-text-muted:      var(--c-ink-muted);
          --color-text-faint:      var(--c-ink-faint);
          --color-bg:              var(--bg-page);
          --color-surface:         var(--bg-card);
          --color-surface-offset:  var(--bg-panel);
          --color-surface-2:       var(--bg-panel);
          --color-border:          var(--border-glass);
          --color-divider:         var(--border-glass);
          --color-surface-dynamic: var(--c-surface-menu);
        }

        /* ══ Theme CSS vars ══ */
        html {
          color-scheme: light;
          min-height: 100vh;
          /* Transparent so body's background propagates to the canvas and PaperBackground's
             fixed, negative-z layer paints ABOVE it. An html background would put body's own
             background above the substrate and hide the grain. */
          background: transparent;
          ${cssVarEntries}
        }

        ${themeStyles}
      `}</style>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

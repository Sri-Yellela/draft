// REVAMP v1 — main.jsx
import React from "react";
import { createRoot } from "react-dom/client";

// ── SELF-HOSTED WEB FONTS ───────────────────────────────────────────────────────────────────────
// These four families were loaded from fonts.googleapis.com until 2026-09-15 — two via a <link> in
// index.html, two via an @import at the top of index.css. Either way, every visitor's browser
// requested them from Google on every page, which handed Google the visitor's IP address and
// user-agent, and the privacy policy did not name Google anywhere. Same shape as the Google S2
// favicon fallback that task X removed: a third party seeing browsing that nothing disclosed.
//
// Serving them from our own origin is what makes the policy's "we send Google nothing" true, so
// these imports are load-bearing for a legal statement, not a performance tweak.
//
// ⛔ EXACTLY THE WEIGHTS THE OLD REQUESTS ASKED FOR, AND NO MORE. Importing a package's index.css
// pulls every weight it ships (9 for Barlow, plus italics), which is a payload nobody asked for.
//
// ⛔ DO NOT SWAP IN @fontsource-variable/dm-sans. It declares the family as 'DM Sans Variable',
// while ~40 call sites ask for 'DM Sans' — so every one of them would silently fall through to
// system-ui and nothing would fail. Pinned by test/selfHostedFonts.test.js.
// D62 (10-07): Barlow Condensed retired — the old condensed face no surface uses any more.
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
// D1 (10-03): the job card's company name is set in "the logo face" — heavy italic geometric sans.
// Self-hosted like every face here (no third-party request); ⚠ Poppins is an approximation of the mark.
import "@fontsource/poppins/800-italic.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
// Inter was here until 10-02: nothing asked for it (the body renders DM Sans) — A53 follow-up.

import "./styles/colorTokens.js";   // publishes --c-* before anything paints
import "./index.css";
// D48: the depth box — DepthButton's classes AND the .dbx-depth skin every other interactive control wears.
import "./components/DepthButton.css";
import { ThemeProvider } from "./styles/theme.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

// ── The type scale — the deck's, named once (A53) ─────────────────────────────────────────────
//
// There was no type-scale file: "the new type scale" lived only in how Today (DeckView), the
// landing page and /features were written — the display serif (Instrument Serif, --font-display)
// at weight 400 for what a page IS, the body font for everything else, and small tracked capitals
// for a section label. The surfaces built before the rebrand (Auto Apply, Job Profiles, Database,
// the Recruiter view, the board's dialogs) used Barlow Condensed ExtraBold capitals instead. This
// names the deck's scale so those surfaces use the same one rather than a third.
//
// Colours are tokens (colorTokens.js). ⛔ A heading is ink, never the logo orange — orange text is
// ACCENT_INK, and only where the orange means something.
import { C } from "./colorTokens.js";

export const FONT = Object.freeze({
  DISPLAY: "var(--font-display)",
  BODY: "inherit",
  MONO: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const TYPE = Object.freeze({
  // What the page is — DeckView's "Today's draft", the board's "Your jobs."
  PAGE_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: "clamp(36px, 5vw, 54px)",
                lineHeight: 1, letterSpacing: "-0.01em", color: C.INK, margin: 0 },
  // A section of a page, a dialog's heading.
  SECTION_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: 28, lineHeight: 1.1,
                   letterSpacing: "-0.005em", color: C.INK, margin: 0 },
  // A card's own title (a profile, a company).
  CARD_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: 24, lineHeight: 1.15, color: C.INK },
  // The deck's section label: small tracked capitals in the faintest text ink.
  EYEBROW: { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT },
  // The sentence under a page title.
  LEAD: { fontSize: 14, lineHeight: 1.6, color: C.INK_MUTED },
});

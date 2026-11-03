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
import { MARK_SIZES, LOGO_FACE } from "./brandMark.js";
// ⭐ D145 · every size in TYPE follows the user's text size (Settings → Appearance → Text size).
import { ts, TYPE_SCALE_VAR } from "../themes/shapes.js";

export const FONT = Object.freeze({
  DISPLAY: "var(--font-display)",
  BODY: "inherit",
  MONO: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const TYPE = Object.freeze({
  // What the page is — DeckView's "Today's draft", the board's "Your jobs."
  PAGE_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: `calc(clamp(36px, 5vw, 54px) * var(${TYPE_SCALE_VAR}, 1))`,
                lineHeight: 1, letterSpacing: "-0.01em", color: C.INK, margin: 0 },
  // A section of a page, a dialog's heading.
  SECTION_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: ts(28), lineHeight: 1.1,
                   letterSpacing: "-0.005em", color: C.INK, margin: 0 },
  // A card's own title (a profile, a company).
  CARD_TITLE: { fontFamily: FONT.DISPLAY, fontWeight: 400, fontSize: ts(24), lineHeight: 1.15, color: C.INK },
  // The deck's section label: small tracked capitals in the faintest text ink.
  EYEBROW: { fontSize: ts(11), fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT },
  // The sentence under a page title.
  LEAD: { fontSize: ts(14), lineHeight: 1.6, color: C.INK_MUTED },
});

// ── D35 · THE FULL HOUSE SENTENCE — one family, one size, one line-height (header.html) ─────────
//
// ⛔ D30 shipped the sentence with the TOKENS re-lettered — Poppins 800 italic at .78em inside a serif
// line — and it read as two things stitched together. D34/D35: the prose and the filter words are ONE
// line of type; only the box (background, border, radius, shadow) says which words are controls.
// So the three values live here ONCE and are published as custom properties; the sentence sets them
// and every token INHERITS them (FullHouse.css), and test/d35FullHouseHeader.test.js fails if any
// token rule names a family, size or line-height of its own.
//
// The values are header.html's: `.sent{font:400 23px/1.85 Georgia,serif}`. ⚠ The sketch gives its
// `.tok` an internal `line-height:1.3` — which would make the token's line-height differ from the
// prose's, the very divergence the row forbids. The token keeps the sentence's line-height; the
// sketch's 1.3 survives only as the HEIGHT of the box drawn around one line (TOKEN_BOX), so the box
// is the sketch's size and the type is not touched.
//
// ⭐ D47 (owner, 10-07): "use the same font as the draft logo and the same size". The serif is replaced
// by THE LOGO FACE (brandMark.js LOGO_FACE: Poppins 800 italic) at THE MARK'S SIZE — MARK_SIZES.nav,
// the same number StampLogo draws the app bar's mark at, so the two cannot drift. D34 still holds: ONE
// family, size, weight, style and line-height for prose and tokens alike. On a narrow window the size
// steps down (6.4vw: ~25px at 390) rather than overflowing — measured in the D47 commit.
export const FULL_HOUSE_TYPE = Object.freeze({
  SENTENCE_FAMILY: LOGO_FACE.family,
  SENTENCE_SIZE: `min(${MARK_SIZES.nav}px, 6.4vw)`,
  SENTENCE_LINE: "1.5",
  SENTENCE_WEIGHT: LOGO_FACE.weight,
  SENTENCE_STYLE: LOGO_FACE.style,
  TOKEN_BOX: "1.3em",
  // The logo face — the bar's segment, the panel's key, the + (Poppins 800 italic, self-hosted).
  LOGO_FAMILY: LOGO_FACE.family,
  MONO: FONT.MONO,
});

export const typeVarName = (name) => `--fh-${name.toLowerCase().replace(/_/g, "-")}`;

/** Publish FULL_HOUSE_TYPE as --fh-* custom properties, from this one definition. */
export function installTypeVars(doc = typeof document !== "undefined" ? document : null) {
  if (!doc?.documentElement) return;
  for (const [name, value] of Object.entries(FULL_HOUSE_TYPE)) {
    doc.documentElement.style.setProperty(typeVarName(name), value);
  }
}

installTypeVars();

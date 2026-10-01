// ── The back of a deck card ──────────────────────────────────────────────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §"The card back — the detail that makes the fan work". A blank back
// meant rotating blind, and that killed every earlier fan sketch. So the back carries:
//
//   · the company's OWN LOGO, blurred, in the accent orange, at low opacity, filling the back
//   · a fine diagonal weave in the same orange at ~5%
//   · the / mark, small, top-left
//
// ⛔ LOGOS, NEVER LETTERS. A company with no known logo gets the weave and the mark and nothing else
// — an initial in a box is a placeholder, and a placeholder on the back says less than nothing.
//
// HOW THE ORANGE IS MADE. The logo is a third-party image (shared/companyLogos.js → DuckDuckGo's
// icon service), so a CSS `mask-image` cannot use it: masks are fetched in CORS mode and that host
// does not answer CORS. An SVG filter has no such restriction. LOGO_FILTER keeps the logo's INK —
// alpha := alpha − luminance, so white and transparent drop out and colour and black stay — then
// floods it with the ACCENT token and blurs it. The colour is the token, never a restated value.
//
// ⚠ TRADEMARK: a blurred, re-tinted company logo is a derivative use of a mark we do not own. Raised
// as an owner decision (WORKLOG, queue 27), not settled here.
import { C } from "../styles/colorTokens.js";
import { getKnownLogoUrl } from "../../../shared/companyLogos.js";

export const LOGO_FILTER_ID = "deck-back-logo";

/** Rendered ONCE per deck: the filter every back refers to. */
export function CardBackDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <filter id={LOGO_FILTER_ID} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
        {/* ink: alpha − luminance. Opaque white → 0, opaque black → 1, a brand colour → in between. */}
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0" result="ink" />
        <feFlood floodColor={C.ACCENT} result="tone" />
        <feComposite in="tone" in2="ink" operator="in" result="tinted" />
        <feGaussianBlur in="tinted" stdDeviation="5" />
      </filter>
    </svg>
  );
}

const weave = `repeating-linear-gradient(45deg, ${C.ACCENT} 0 1px, transparent 1px 7px), ` +
              `repeating-linear-gradient(-45deg, ${C.ACCENT} 0 1px, transparent 1px 7px)`;

export default function CardBack({ company, iconUrl, radius = 28 }) {
  const logo = iconUrl || getKnownLogoUrl(company);
  return (
    <div aria-hidden="true" data-card-back
      style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden",
               background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, boxShadow: C.SHADOW_GLASS }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: weave, opacity: 0.05 }} />
      {logo && (
        <img src={logo} alt="" draggable={false} decoding="async" loading="lazy"
          // A failed logo leaves the weave and the mark — never a broken-image icon, never a letter.
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          style={{ position: "absolute", left: "50%", top: "50%", width: "62%", aspectRatio: "1 / 1", maxHeight: "86%",
                   objectFit: "contain", transform: "translate(-50%, -50%)", filter: `url(#${LOGO_FILTER_ID})`,
                   opacity: 0.32, imageRendering: "auto" }} />
      )}
      <svg width="22" height="22" viewBox="0 0 30 30" style={{ position: "absolute", left: 18, top: 16 }}>
        <line x1="8" y1="26" x2="22" y2="4" stroke={C.ACCENT_INK} strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

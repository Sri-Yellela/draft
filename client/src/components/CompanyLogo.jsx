// The company's mark — ONE component, every surface (D61, owner 10-07; was ui/CompanyIcon.jsx, TASK AE5).
//
// AE5 found this three times (JobCard, JobDetailPanel, JobsPanel) and made it one; D61 found a FOURTH —
// the ATS panel's History list drew its own green letter tile where the card showed the real logo. "Three
// implementations of one mark is how the legacy brand shipped on every page." Every company mark in the
// client is this component: the card (ALL, ★, /d, +), the posting header, the deck, the ATS panel.
//
// ⛔ D61 · THE TILE RULE.
//   · A logo sits on a PAPER tile (C.LOGO_TILE) in BOTH themes. It used to sit on `transparent`, so in dark
//     mode a transparent dark mark — Mercury, RTX, GitHub, Uber, Vercel (15 of the known logos, measured) —
//     landed on the dark card and all but vanished, while the same company read fine wherever its icon
//     happened to be opaque. That is the "inverted or invisible in ALL, fine in +" the owner saw.
//   · An OPAQUE logo (it brings its own ground — Amazon, Duolingo, Stripe) FILLS the tile; a transparent
//     mark gets a few px of paper around it. Which is which is MEASURED (shared/companyLogos.js,
//     OPAQUE_LOGO_DOMAINS) — the logo host sends no CORS header, so the pixels cannot be read here.
//   · ⛔ NEVER invert, filter or blend a logo — `filter: none`, always. A mark is drawn as its owner drew it.
//   · The letter fallback is a BOLD tile (D149, owner 11-04 "go bold"): one of the sketch's strong colours
//     (C.TILE_*, tracker-options.html .lg), the sketch's top light, a white UPRIGHT letter at 700 — the same tile on
//     every screen. (It was a pale status tone with an italic dark letter in the logo face.)
//
// A GUESS IS NOT A LOGO (AE5): getKnownLogoUrl returns null for a company it does not know, so an unknown
// employer gets the letter, never a broken image. `onError` falls back to the letter at runtime, and the
// failure memo is module-level so a dead URL is asked for once per session, not once per card (TASK X).
import { useState } from "react";
import { getKnownLogoUrl, isOpaqueLogoUrl } from "../../../shared/companyLogos.js";
import { C } from "../styles/colorTokens.js";

const failedLogoUrls = new Set();

export default function CompanyLogo({ company, iconUrl, size = 48, radius = 10 }) {
  const [, forceRender] = useState(0);
  const letter = (company || "?")[0].toUpperCase();
  // Deterministic colour from the company name, so a given employer's tile is always the same one.
  // Every tone here is paired with ON_TILE in every theme (colorTokens CONTRAST_PAIRS).
  const colors = [C.TILE_BLUE, C.TILE_GREEN, C.TILE_PURPLE, C.TILE_ORANGE, C.TILE_TEAL, C.TILE_SLATE, C.TILE_ROSE];
  let hash = 0;
  for (const c of company || "") hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  const bg = colors[hash % colors.length];

  const resolved = iconUrl || getKnownLogoUrl(company);

  if (resolved && !failedLogoUrls.has(resolved)) {
    const opaque = isOpaqueLogoUrl(resolved);
    return (
      <span data-company-logo={opaque ? "opaque" : "mark"}
        style={{ width: size, height: size, borderRadius: radius, background: C.LOGO_TILE,
                 padding: opaque ? 0 : Math.max(3, Math.round(size * 0.12)), boxSizing: "border-box",
                 display: "inline-flex", alignItems: "center", justifyContent: "center",
                 overflow: "hidden", flexShrink: 0, filter: "none" }}>
        <img src={resolved} alt={company}
          onError={() => { failedLogoUrls.add(resolved); forceRender(n => n + 1); }}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block",
                   background: "transparent", filter: "none", mixBlendMode: "normal" }}/>
      </span>
    );
  }
  return (
    <span data-company-logo="letter"
      style={{ width: size, height: size, borderRadius: radius, color: C.ON_TILE,
               background: `linear-gradient(155deg, color-mix(in srgb, ${C.ON_TILE} 28%, transparent), transparent 45%), ${bg}`,
               display: "inline-flex", alignItems: "center", justifyContent: "center",
               fontFamily: "var(--font-body)", fontStyle: "normal",
               fontWeight: 700, fontSize: Math.round(size * 0.4), flexShrink: 0, filter: "none" }}>
      {letter}
    </span>
  );
}

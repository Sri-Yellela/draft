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
//   · The letter fallback is a token-coloured tile in the depth style.
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
  // Every tone here is paired with SURFACE_SOLID in both themes.
  const colors = [C.INFO, C.VIOLET, C.TEAL, C.SUCCESS, C.DANGER, C.WARNING, C.VIOLET];
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
      style={{ width: size, height: size, borderRadius: radius, background: bg, color: C.SURFACE_SOLID,
               display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: C.DEPTH_REST,
               fontFamily: "'Poppins', var(--font-body)", fontStyle: "italic",
               fontWeight: 800, fontSize: Math.round(size * 0.38), flexShrink: 0, filter: "none" }}>
      {letter}
    </span>
  );
}

// ── The glass material — one definition for every glass surface ─────────────────────────────
//
// 09-30, the owner: the board "feels very mundane … looks like something from 2012", and "the glossy
// effect can be more apparent". The glass had been a translucent rectangle with a blur: no light on
// it, so it read as a paler rectangle. Real glass shows its light source. This material has one,
// upper left:
//
//   specular edge — a bright 1px line along the top, where the light catches the rim
//   sheen         — a soft radial highlight from the upper left
//   body          — a gradient, denser at the top, CLEARER at the bottom so the leather shows through
//   rim/underside — a light hairline all round, a slightly darker bottom edge
//   shadow        — warm and soft, offset down: an object resting on the hide, not floating
//
// Colours are tokens (colorTokens.js); this file only composes them. ⛔ Text contrast: the body is
// clearer than SURFACE, and every text token is proved against CANVAS_SHADE (the darkest substrate),
// so text on this glass sits between two proven cases.
import { C } from "./colorTokens.js";

const BLUR = { rest: "blur(18px) saturate(1.7)", hover: "blur(22px) saturate(1.9)" };

/**
 * Style for a glass surface. `hover` lifts it; `radius` follows the surface. Spread it FIRST, then
 * override layout — border and shadow belong to the material, so a caller that sets `border` owns
 * that decision (the selected state does).
 */
export function glass({ hover = false, radius = 14 } = {}) {
  const sheen = hover ? C.GLASS_SPECULAR : C.GLASS_SHEEN;
  return {
    backgroundImage:
      `radial-gradient(120% 70% at 12% 0%, ${sheen} 0%, transparent 55%), ` +
      `linear-gradient(170deg, ${C.GLASS_BODY_TOP} 0%, ${C.GLASS_BODY} 70%)`,
    backgroundColor: "transparent",
    backdropFilter: hover ? BLUR.hover : BLUR.rest,
    WebkitBackdropFilter: hover ? BLUR.hover : BLUR.rest,
    border: `1px solid ${C.GLASS_RIM}`,
    borderRadius: radius,
    boxShadow:
      `inset 0 1px 0 ${C.GLASS_SPECULAR}, inset 0 -1px 0 ${C.GLASS_UNDERSIDE}, ` +
      (hover ? C.SHADOW_GLASS_HOVER : C.SHADOW_GLASS),
    transform: hover ? "translateY(-2px)" : "none",
    transition: "transform 160ms ease, box-shadow 160ms ease, backdrop-filter 160ms ease",
  };
}

import { C } from "../styles/colorTokens.js";

/**
 * The paper substrate. Replaces CinematicBackground — a looping night-sky video with a navy
 * gradient fallback and a vignette — per docs/UI_REDESIGN.md: "Kill the dynamic background".
 *
 * WHY TEXTURE AND NOT FLAT CREAM: glass needs something behind it to refract. Over a flat field a
 * frosted panel reads as a slightly different shade of the same colour and the effect vanishes.
 * The logo is photographed on textured paper, so the substrate is that paper: a still, generated
 * grain (SVG feTurbulence, tiled), not a gradient and not motion.
 *
 * ⛔ QUIET BY CONSTRUCTION. Every pixel the grain produces must stay LIGHTER than
 * C.CANVAS_SHADE, because that token is the worst case every contrast pair in colorTokens.js is
 * computed against. The noise alpha is clamped by the colour matrix (at most min(1, MATRIX_GAIN -
 * MATRIX_BIAS)); the grain layer is drawn at GRAIN_OPACITY and the fibre layer at FIBRE_OPACITY, so
 * the darkest possible pixel is GRAIN at 1 - (1 - a·GRAIN_OPACITY)(1 - a·FIBRE_OPACITY) over
 * CANVAS. CANVAS reaches CANVAS_SHADE at 8.5%, so that must stay under it — test/colorTokens.test.js
 * computes it from these exported constants, so a stronger grain cannot slip past the floor.
 *
 * ⭐ LEATHER, NOT STATIC (owner, 09-30: "fairly coarse … like a leather, not too coarse"). The
 * grain was baseFrequency 0.82 with 3 octaves and a soft matrix (gain 0.9): fine paper tooth that
 * measured a luminance sd of 0.95 — flat to the eye. Chosen on a bench of six candidates rendered
 * and measured side by side (draft-screenshots/grain/bench-2.png): 0.28 with 2 octaves, pebbles
 * roughly three times larger; 0.14 was blotchy ("too coarse"). sd 0.95 → 3.6.
 *
 * THE FLOOR CAPS THE SHADOW, NOT THE LIGHT. Leather reads as relief — lit tops beside shaded
 * hollows — and at ≤ 8.5% darkening a shadow layer alone cannot carry it. So the matrix is sharper
 * (gain 2.2, bias 0.85: the alpha now reaches its clamp of 1), the SHADOW layers are thinner to pay
 * for it (GRAIN 0.06, FIBRE 0.02 → worst case 7.9%), and a third layer, SHEEN, is the same pebble in
 * white on an offset seed. Lighter than CANVAS can only raise the contrast of the dark text on it,
 * so SHEEN_OPACITY is taste, not safety.
 *
 * No animation, no video, no requestAnimationFrame: the substrate does not move, so there is
 * nothing for prefers-reduced-motion to suppress and nothing to pause on a hidden tab.
 */
const TILE = 320;
const MATRIX_GAIN = 2.2;
const MATRIX_BIAS = 0.85;
export const GRAIN_OPACITY = 0.06;
export const FIBRE_OPACITY = 0.02;
export const SHEEN_OPACITY = 0.80;
export const MATRIX_ALPHA_MAX = Math.min(1, MATRIX_GAIN - MATRIX_BIAS);

const rgb01 = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));

function grainUri() {
  const [r, g, b] = rgb01(C.GRAIN);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
    `<filter id='g' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.28' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${MATRIX_GAIN} 0 0 0 -${MATRIX_BIAS}'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// A second, much lower-frequency layer: the slow mottling of paper fibre, so the grain is not a
// uniform static. Same colour, same clamp, lower opacity.
function fibreUri() {
  const [r, g, b] = rgb01(C.GRAIN);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>` +
    `<filter id='f' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.012 0.03' numOctaves='2' seed='7' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${MATRIX_GAIN} 0 0 0 -${MATRIX_BIAS}'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// The pebble's lit side: the same frequency as the grain, in white, on another seed.
function sheenUri() {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
    `<filter id='s' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.28' numOctaves='2' seed='23' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${MATRIX_GAIN} 0 0 0 -${MATRIX_BIAS}'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#s)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const GRAIN = grainUri();
const SHEEN = sheenUri();
const FIBRE = fibreUri();

export default function PaperBackground({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      data-substrate="paper"
      className={"pointer-events-none fixed inset-0 -z-10 overflow-hidden " + className}
      style={{ background: C.CANVAS }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: FIBRE, backgroundSize: "600px 600px", opacity: FIBRE_OPACITY }} />
      <div className="absolute inset-0" style={{ backgroundImage: SHEEN, backgroundSize: `${TILE}px ${TILE}px`, opacity: SHEEN_OPACITY }} />
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: `${TILE}px ${TILE}px`, opacity: GRAIN_OPACITY }} />
    </div>
  );
}

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
 * computed against. The noise alpha is clamped by the colour matrix (at most MATRIX_GAIN - MATRIX_BIAS
 * = 0.55); the grain layer is drawn at GRAIN_OPACITY (0.10) and the fibre layer at half that, so
 * the darkest possible pixel is GRAIN at 1 - (1 - 0.055)(1 - 0.0275) = 8.1% over CANVAS. CANVAS
 * reaches CANVAS_SHADE at 8.5%, so the substrate cannot get darker than the contrast floor.
 * Measured off the rendered page too, not only derived: darkest pixel #EDE5D9 at 1440x900.
 *
 * No animation, no video, no requestAnimationFrame: the substrate does not move, so there is
 * nothing for prefers-reduced-motion to suppress and nothing to pause on a hidden tab.
 */
const TILE = 220;
const MATRIX_GAIN = 0.9;
const MATRIX_BIAS = 0.35;
export const GRAIN_OPACITY = 0.10;

const rgb01 = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));

function grainUri() {
  const [r, g, b] = rgb01(C.GRAIN);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
    `<filter id='g' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/>` +
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

const GRAIN = grainUri();
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
      <div className="absolute inset-0" style={{ backgroundImage: FIBRE, backgroundSize: "600px 600px", opacity: GRAIN_OPACITY * 0.5 }} />
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: `${TILE}px ${TILE}px`, opacity: GRAIN_OPACITY }} />
    </div>
  );
}

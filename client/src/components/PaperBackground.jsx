import { C, THEME } from "../styles/colorTokens.js";
import { PAPER } from "../styles/paper.js";
import { Z } from "../styles/zLayers.js";

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
 * ⭐ CRISP LEATHER (owner, 09-30, twice). First "fairly coarse, like a leather" — then, having seen
 * the benches (draft-screenshots/grain/bench-1.png, bench-2.png), "C or D … crisp leather". This is
 * bench C exactly: pebble frequency 0.34 × 2 octaves, a sharp matrix (gain 2.2, bias 0.85, so alpha
 * reaches its clamp and the pebble edges are crisp), GRAIN 0.12 for the shaded hollows, SHEEN 0.55
 * for the lit tops, no fibre mottle.
 *
 * THE FLOOR MOVED FOR IT, NOT THE REVERSE. At 12% the shadow passes the old CANVAS_SHADE, so the
 * floor token darkened (#E6DDCF → #DFD6C9) and every contrast pair was re-proved against it — one
 * moved (WARNING). The sheen only lightens, so it is outside the floor's reach.
 *
 * No animation, no video, no requestAnimationFrame: the substrate does not move, so there is
 * nothing for prefers-reduced-motion to suppress and nothing to pause on a hidden tab.
 */
const TILE = 320;
// The numbers live in styles/paper.js, per theme (step 6), so the floor test can prove each one.
const P = PAPER[THEME] || PAPER.light;
const MATRIX_GAIN = P.gain;
const MATRIX_BIAS = P.bias;
export const GRAIN_OPACITY = P.grain;
export const FIBRE_OPACITY = P.fibre;
export const SHEEN_OPACITY = P.sheen;

const rgb01 = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));

function grainUri() {
  const [r, g, b] = rgb01(C.GRAIN);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
    `<filter id='g' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${P.freq}' numOctaves='${P.octaves}' stitchTiles='stitch'/>` +
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

// The pebble's lit side: the same frequency as the grain, in SHEEN_TINT (white on cream, a warm
// grey on charcoal), on another seed.
function sheenUri() {
  const [r, g, b] = rgb01(C.SHEEN_TINT);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>` +
    `<filter id='s' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${P.freq}' numOctaves='${P.octaves}' seed='23' stitchTiles='stitch'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${MATRIX_GAIN} 0 0 0 -${MATRIX_BIAS}'/>` +
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
      className={"pointer-events-none fixed inset-0 overflow-hidden " + className}
      // The floor of the layer scale, by name — it was the Tailwind literal -z-10.
      style={{ background: C.CANVAS, zIndex: Z.BG }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: FIBRE, backgroundSize: "600px 600px", opacity: FIBRE_OPACITY }} />
      <div className="absolute inset-0" style={{ backgroundImage: SHEEN, backgroundSize: `${TILE}px ${TILE}px`, opacity: SHEEN_OPACITY }} />
      <div className="absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: `${TILE}px ${TILE}px`, opacity: GRAIN_OPACITY }} />
    </div>
  );
}

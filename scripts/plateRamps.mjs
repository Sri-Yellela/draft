// ⭐ 47k · THE REGION RAMPS — the method that builds a region's 10-step hypsometric ramp from its colour.
//
// docs/design/plate-system.md gives Region IV's ramp and says "build the same 10-step ramp for any other region before
// designing its pages". IV's came from the report; III's (D198) was hand-built around the four steps canvas v4's
// explainer uses (#F5E2D6 · #E6BA9F · #B4532A · #8F4122). Neither recorded a method, so this one is read off the two of
// them in OKLCH (perceptual lightness L, chroma C, hue h) and reproduces both to within a just-noticeable step:
//
//   · light steps 0–6 sit on one lightness ladder, the mean of III's and IV's:
//       L = .955 · .920 · .879 · .825 · .752 · .666 · .564
//     with chroma a share of the region colour's: .115 · .195 · .305 · .44 · .605 · .735 · .92
//   · the region colour itself takes step 6 when it is mid-light (L > .50, like III's #B4532A) and step 7 when it is
//     deep (like IV's #1F3A63) — the region colour is always on its ramp, unchanged;
//   · the steps below it darken geometrically, L × .82 per step, chroma × .84 · .66 · .49 of the colour's;
//   · hue stays the region colour's; an out-of-gamut step loses chroma until it fits sRGB.
//
// The ramps live as tokens in client/src/styles/plate.css (--pl-<roman>-0…9); test/plateRamps47k.test.js holds every
// ramp token to this method (III and IV within tolerance, every other region exactly) and checks text on the ramp:
// ink on steps 0–5, paper on steps 7–9, at least 4.5 : 1 (the report's rule; step 6 is a mid-tone and carries none).
//
// Usage: node scripts/plateRamps.mjs [#hex …]   — prints the token lines for each region (or for the given colours).

/** The region colours (report § Color, the Region palettes table) — roman → colour. */
export const REGION_COLOURS = Object.freeze({
  I: "#C2593A", II: "#4B3FA8", III: "#B4532A", IV: "#1F3A63", V: "#6A3E73", VI: "#2F6B7A", VII: "#7A5A2A", VIII: "#5A5F2E",
});

const LIGHT_L = [0.955, 0.920, 0.879, 0.825, 0.752, 0.666, 0.564];
const LIGHT_C = [0.115, 0.195, 0.305, 0.44, 0.605, 0.735, 0.92];
const DEEP_C = [0.84, 0.66, 0.49];
const DEEP_L = 0.82;
const MID_LIGHT = 0.50;

const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export function hexToOklch(hex) {
  const [r, g, b] = rgbOf(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}

function oklchToLinear(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

/** OKLCH → #RRGGBB; a colour outside sRGB loses chroma (hue and lightness kept) until it fits. */
export function oklchToHex(L, C, h) {
  let c = C;
  for (let i = 0; i < 60; i++) {
    const lin = oklchToLinear(L, c, h);
    if (lin.every(v => v >= -1e-6 && v <= 1 + 1e-6)) break;
    c *= 0.95;
  }
  return "#" + oklchToLinear(L, c, h)
    .map(v => Math.round(Math.min(1, Math.max(0, toGam(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

/** The step the region colour itself takes: 6 when mid-light, 7 when deep. */
export const baseStep = hex => (hexToOklch(hex)[0] > MID_LIGHT ? 6 : 7);

/** A region's 10-step ramp, light → deep, built from its colour. */
export function buildRamp(hex) {
  const colour = hex.toUpperCase();
  const [L, C, h] = hexToOklch(colour);
  const at = baseStep(colour);
  const out = [];
  for (let i = 0; i < at; i++) out.push(oklchToHex(LIGHT_L[i], C * LIGHT_C[i], h));
  out.push(colour);
  for (let k = 1; at + k <= 9; k++) out.push(oklchToHex(L * DEEP_L ** k, C * DEEP_C[k - 1], h));
  return out;
}

/** WCAG 2 contrast ratio of two #RRGGBB colours. */
export function contrast(a, b) {
  const lum = hex => { const [r, g, b2] = rgbOf(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b2; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** OKLab distance (×100 ≈ ΔE; ≈ 2 is a just-noticeable step). */
export function deltaOk(a, b) {
  const lab = hex => { const [L, C, h] = hexToOklch(hex); return [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)]; };
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
}

/** The CSS token lines for a region's ramp, five steps to a line (the shape of styles/plate.css). */
export function rampTokens(roman, ramp) {
  const name = roman.toLowerCase();
  const step = (h, i) => `--pl-${name}-${i}: ${h};`;
  return [`  ${ramp.slice(0, 5).map(step).join(" ")}`, `  ${ramp.slice(5).map((h, i) => step(h, i + 5)).join(" ")}`].join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const args = process.argv.slice(2);
  const rows = args.length ? args.map(h => [h, h]) : Object.entries(REGION_COLOURS);
  for (const [roman, hex] of rows) console.log(`/* ${roman} ${hex} (step ${baseStep(hex)}) */\n${rampTokens(String(roman).replace("#", "x"), buildRamp(hex))}`);
}

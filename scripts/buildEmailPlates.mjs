#!/usr/bin/env node
// scripts/buildEmailPlates.mjs — ⭐ D197 #18 M5 (47m, lane outside) · THE EMAIL HEADER PLATES, one per kind (dispatch · run
// report · digest), ported from DrawingsPublic's Drawing 23 (docs/sketches/final/project/DrawingsPublic.dc.html, approved
// 11-27) as 560 × 140 PNGs at 2× — what every mail client shows (they strip SVG; emails.md "Hero plate").
//
// A plate is the same for every send of its kind, so it carries no per-send words: the contour lines in the kind's colour
// (IV navy · lit green · clay), the ink kind tag, a fixed serif line, and the kind's mark (the count box with the /d · the
// SENT stamp · the route to its clay dot). The per-send title is the HTML's own <h1> under it (services/dispatchHtml.js).
// Rasterised by @resvg/resvg-js (pinned, already a dependency — services/ogImage.js). Fonts: the build machine's Georgia /
// Consolas when present (the plate's serif / mono fallbacks), else DM Sans (assets/fonts) — the PNG is committed, so the
// face is fixed at build time. Colours: services/dispatchHtml.js PLATE_EMAIL (one map, pinned to plate.css).
//
//   node scripts/buildEmailPlates.mjs          write client/public/email/plate-*.png
//   node scripts/buildEmailPlates.mjs --svg    print the three SVGs, write nothing
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PLATE_EMAIL as T, EMAIL_PLATES } from "../services/dispatchHtml.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "client", "public", "email");
const SERIF = "Georgia, 'Instrument Serif', serif";
const MONO = "Consolas, 'JetBrains Mono', monospace";

const contours = (stroke) => [130, 110, 90, 70, 50].map((y, i) =>
  `<path d="M0 ${y} C 140 ${y - 14 - 2 * i}, 300 ${y + 6}, 560 ${y - 26}" fill="none" stroke="${stroke}" stroke-opacity="${(0.18 + 0.05 * i).toFixed(2)}" stroke-width="1.2"/>`).join("");
const tag = (words) => `<rect x="20" y="20" width="${Math.max(92, 16 + words.length * 7.6)}" height="22" rx="5" fill="${T.ink}"/>`
  + `<text x="${20 + Math.max(92, 16 + words.length * 7.6) / 2}" y="35" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="700" letter-spacing="1" fill="${T.paper}">${words}</text>`;

/** The three plates' SVG sources (Drawing 23, per-send words left to the HTML). */
export function plateSvgs() {
  const frame = (label, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 140" width="560" height="140" role="img" aria-label="${label}">`
    + `<rect width="560" height="140" fill="${T.paperWarm}"/>${inner}</svg>`;
  return {
    dispatch: frame(EMAIL_PLATES.dispatch.alt, contours(T.r4) + tag("DISPATCH")
      + `<text x="20" y="92" font-family="${SERIF}" font-size="34" fill="${T.ink}">A dispatch from draft</text>`
      + `<rect x="440" y="56" width="96" height="44" rx="6" fill="${T.card}" stroke="${T.ink}" stroke-width="1.5"/>`
      + `<text x="488" y="86" text-anchor="middle" font-family="${SERIF}" font-size="26" fill="${T.ink}"><tspan fill="${T.clay}">/</tspan>d</text>`),
    "run-report": frame(EMAIL_PLATES["run-report"].alt, contours(T.lit) + tag("RUN REPORT")
      + `<text x="20" y="92" font-family="${SERIF}" font-size="34" fill="${T.ink}">The run report</text>`
      + `<g transform="translate(470 78) rotate(-8)"><rect x="-50" y="-22" width="100" height="44" rx="6" fill="none" stroke="${T.lit}" stroke-width="3"/>`
      + `<text y="6" text-anchor="middle" font-family="${MONO}" font-size="13" font-weight="700" letter-spacing="1" fill="${T.lit}">SENT</text></g>`),
    digest: frame(EMAIL_PLATES.digest.alt, contours(T.clay) + tag("DIGEST")
      + `<text x="20" y="92" font-family="${SERIF}" font-size="34" fill="${T.ink}">New openings that fit</text>`
      + `<path d="M430 104 C 460 96, 470 70, 500 66 S 530 44, 540 40" fill="none" stroke="${T.ink}" stroke-width="6" stroke-linecap="round"/>`
      + `<circle cx="540" cy="40" r="7" fill="${T.clay}" stroke="${T.ink}" stroke-width="1.5"/>`),
  };
}

async function main() {
  const svgs = plateSvgs();
  if (process.argv.includes("--svg")) { for (const [k, v] of Object.entries(svgs)) console.log(`${k}:\n${v}\n`); return; }
  const { Resvg } = await import("@resvg/resvg-js");
  const sys = ["C:/Windows/Fonts/georgia.ttf", "C:/Windows/Fonts/consolab.ttf", "C:/Windows/Fonts/consola.ttf"].filter((f) => fs.existsSync(f));
  const dm = path.join(ROOT, "assets", "fonts", "DMSans.ttf");
  const fontFiles = [...sys, ...(fs.existsSync(dm) ? [dm] : [])];
  fs.mkdirSync(OUT, { recursive: true });
  for (const [kind, svg] of Object.entries(svgs)) {
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1120 }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: sys.length ? "Georgia" : "DM Sans" } }).render().asPng();
    const file = path.join(OUT, EMAIL_PLATES[kind].file);
    fs.writeFileSync(file, png);
    console.log(`[emailPlates] ${path.relative(ROOT, file)} ${png.length} bytes`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();

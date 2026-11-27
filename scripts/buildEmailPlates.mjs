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
// face is fixed at build time. Colours and the drawing: shared/emailPlates.js (PLATE_EMAIL — one map, pinned to plate.css).
//
//   node scripts/buildEmailPlates.mjs          write client/public/email/plate-*.png
//   node scripts/buildEmailPlates.mjs --svg    print the three SVGs, write nothing
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EMAIL_PLATES, plateSvgs as svgsOf } from "../shared/emailPlates.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "client", "public", "email");
/** The three plates as the PNG build draws them: the rasteriser's installed faces first (shared/emailPlates.js draws). */
export const plateSvgs = () => svgsOf({ faces: { serif: "Georgia, 'Instrument Serif', serif", mono: "Consolas, 'JetBrains Mono', monospace" } });

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

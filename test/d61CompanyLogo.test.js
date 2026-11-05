// ⛔ D61 (owner 10-07) · SOME LOGOS WERE INVERTED OR INVISIBLE IN ALL — the same card was fine in `+`.
//
// THE PROBE (reported in the WORKLOG): no filter, invert or blend mode was applied anywhere, and the card is
// ONE JobBubble in every view. The cause was the third option: transparent DARK marks on a TRANSPARENT tile.
// CompanyIcon drew every logo with `background: transparent`, so in dark mode Mercury's and RTX's marks
// (measured: 29% / 33% of pixels opaque, mean luminance 40 / 32) landed on the dark card. In `+` the same
// company read fine when its captured icon happened to be opaque. And the ATS panel's History list drew a
// FOURTH implementation — its own letter tile — where the card showed the real logo.
//
// THE FIX, pinned here: ONE CompanyLogo; a paper tile in BOTH themes; an opaque logo fills it, a mark is
// padded; `filter: none`, always. The components are RENDERED (esbuild + react-dom/server), not grepped.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import CompanyLogo from ${abs("components/CompanyLogo.jsx")};
        import { C_LIGHT, C_DARK } from ${abs("styles/colorTokens.js")};
        export const logo = (props) => renderToStaticMarkup(createElement(CompanyLogo, props));
        export { C_LIGHT, C_DARK };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d61-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

/** The tile's inline style, as a map. */
function tileStyle(html) {
  const m = html.match(/^<span data-company-logo="(\w+)" style="([^"]*)"/);
  assert.ok(m, `not a CompanyLogo tile: ${html.slice(0, 120)}`);
  return { kind: m[1], style: Object.fromEntries(m[2].split(";").filter(Boolean).map(d => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; })) };
}

test("⛔ D61 · the tile is PAPER in both themes — the same value, never one that follows the theme", async () => {
  const { C_LIGHT, C_DARK } = await loadUi();
  assert.equal(C_LIGHT.LOGO_TILE, C_DARK.LOGO_TILE);
  assert.equal(C_LIGHT.LOGO_TILE, "#FBF7F0", "the sketch's .tile");
});

test("⛔ D61 · fixtures: a transparent dark mark is padded on paper; an opaque logo fills; filter is none", async () => {
  const { logo, C_LIGHT } = await loadUi();
  const { LOGO_HOST } = await import("../shared/companyLogos.js");
  const cases = [
    // [company, iconUrl, expected kind]
    ["Mercury", null, "mark"],                                   // transparent dark (measured 29% opaque, lum 40)
    ["RTX", "https://www.rtx.com/favicon.png", "mark"],          // captured icon, unmeasured → treated as a mark
    ["Amazon", null, "opaque"], ["Duolingo", null, "opaque"], ["Stripe", null, "opaque"],
  ];
  for (const [company, iconUrl, kind] of cases) {
    const html = logo({ company, iconUrl, size: 52, radius: 13 });
    const t = tileStyle(html);
    assert.equal(t.kind, kind, company);
    assert.equal(t.style.background, C_LIGHT.LOGO_TILE, `${company}: the tile is paper`);
    assert.equal(t.style.filter, "none", `${company}: the tile is never filtered`);
    assert.match(html, /<img [^>]*style="[^"]*filter:none;mix-blend-mode:normal/, `${company}: the logo is never filtered or blended`);
    if (kind === "opaque") assert.equal(t.style.padding, "0", `${company}: an opaque logo fills its tile`);
    else assert.equal(t.style.padding, "6px", `${company}: a mark gets paper around it (12% of 52)`);
  }
  assert.ok(LOGO_HOST, "the logo host is the shared module's");
});

// D149 (owner 11-04, "go bold") changed this on purpose: the letter tile was a pale status tone with an italic dark
// letter in the logo face; it is now the sketch's bold tile (tracker-options.html .lg) — a strong TILE_* colour under
// the sketch's top light, a white upright letter at 700 — the same on every screen.
test("D61 → D149 · the letter fallback is a bold TILE_* colour with a white upright letter", async () => {
  const { logo, C_LIGHT } = await loadUi();
  const t = tileStyle(logo({ company: "Brightmoor Analytics Group", size: 40 }));
  assert.equal(t.kind, "letter");
  const tiles = ["TILE_BLUE", "TILE_GREEN", "TILE_PURPLE", "TILE_ORANGE", "TILE_TEAL", "TILE_SLATE", "TILE_ROSE"].map(k => C_LIGHT[k]);
  assert.ok(tiles.some(c => t.style.background.includes(c)), `a TILE_* colour: ${t.style.background}`);
  assert.match(t.style.background, /^linear-gradient\(155deg/, "the sketch's top light");
  assert.equal(t.style.color, C_LIGHT.ON_TILE);
  assert.equal(t.style["font-style"], "normal");
  assert.equal(t.style["font-weight"], "700");
  assert.equal(t.style.filter, "none");
  const src = read("client/src/components/CompanyLogo.jsx");
  assert.doesNotMatch(src, /C\.(INFO|VIOLET|TEAL|SUCCESS|DANGER|WARNING)\b/, "no status tone is a company's colour");
});

test("⛔ D61 · ONE CompanyLogo — every surface that draws a company mark imports it, and no other tile exists", () => {
  for (const f of ["client/src/components/JobBubble.jsx", "client/src/components/JobCard.jsx",
                   "client/src/components/JobDetailPanel.jsx", "client/src/panels/DeckView.jsx",
                   "client/src/components/ResumeList.jsx"]) {   // (AtsReportPanel.jsx: retired, D152 (8))
    const src = read(f);
    assert.match(src, /import CompanyLogo from "[./]+(components\/)?CompanyLogo\.jsx";/, f);
    assert.match(src, /<CompanyLogo /, f);
  }
  // The History list's own letter tile (the green "A" for Amazon in the owner's screenshot) is gone — D62
  // replaced the whole list with ResumeList, and the ATS panel's header draws CompanyLogo.
  assert.doesNotMatch(read("client/src/panels/JobsPanel.jsx"), /function HistoryList\(/);
  assert.ok(!fs.existsSync("client/src/panels/AtsReportPanel.jsx"), "D152 (8): the ATS overlay (and its header's logo) is retired");
  assert.match(read("client/src/components/ResumeList.jsx"), /<CompanyLogo company=\{r\.company\}/);
  // No second letter tile anywhere in the client: a company's initial is drawn by CompanyLogo only.
  const offenders = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(n)) {
    const s = read(p); if (/company[^\n]{0,40}\)\s*\[0\]\.toUpperCase\(\)|company[^\n]{0,20}\|\|\s*"\?"\)\[0\]/i.test(s) && !p.endsWith("CompanyLogo.jsx")) offenders.push(p); } } };
  walk("client/src");
  assert.deepEqual(offenders, []);
});

test("⛔ D61 · never invert, filter or blend a logo — and the measured opaque list is the shared module's", async () => {
  const src = read("client/src/components/CompanyLogo.jsx").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /invert\(|grayscale\(|mix-blend-mode:\s*(?!normal)|mixBlendMode:\s*"(?!normal)/);
  const { isOpaqueLogoUrl, getKnownLogoUrl, OPAQUE_LOGO_DOMAINS } = await import("../shared/companyLogos.js");
  assert.equal(isOpaqueLogoUrl(getKnownLogoUrl("Stripe")), true);
  assert.equal(isOpaqueLogoUrl(getKnownLogoUrl("Mercury")), false);
  assert.equal(isOpaqueLogoUrl("https://www.rtx.com/favicon.png"), false, "an unmeasured host is never assumed opaque");
  for (const d of ["mercury.com", "github.com", "uber.com", "vercel.com", "netflix.com"]) assert.equal(OPAQUE_LOGO_DOMAINS.has(d), false, d);
});

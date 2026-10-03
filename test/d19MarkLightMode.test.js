// D19 (owner, 10-03) — in LIGHT mode the mark's "/" stays the orange and "draft" becomes ink; dark mode
// unchanged; every other surface unchanged. ⛔ A TOKEN change in the ONE StampLogo, never a per-page
// special case: the rebrand once shipped the legacy name on every page because a third copy of the
// mark existed that the guard could not see.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const { C_LIGHT, C_DARK, CONTRAST_PAIRS } = await import("../client/src/styles/colorTokens.js");
const { decode, encode, split } = await import("../scripts/d19SplitMark.mjs");

test("D19: the tokens — light: '/' the orange, 'draft' ink; dark: the whole mark the orange, as before", () => {
  assert.equal(C_LIGHT.LOGO_SLASH, C_LIGHT.ACCENT);
  assert.equal(C_LIGHT.LOGO_WORD, C_LIGHT.INK);
  assert.equal(C_DARK.LOGO_SLASH, "#FD4600");
  assert.equal(C_DARK.LOGO_WORD, "#FD4600", "dark mode's mark changed (D19: dark unchanged)");
  // The art is drawn in #FD4600 (its opaque pixels), so the dark mark is the art's own colour.
  const art = decode(fs.readFileSync("client/src/assets/brand/wordmark.png"));
  const counts = new Map();
  for (let i = 0; i < art.w * art.h; i++) if (art.px[i * 4 + 3] === 255) {
    const k = art.px.subarray(i * 4, i * 4 + 3).toString("hex"); counts.set(k, (counts.get(k) || 0) + 1);
  }
  assert.equal([...counts].sort((a, b) => b[1] - a[1])[0][0], "fd4600", "the art's orange moved");
});

test("D19: the word's contrast is declared on every surface the mark sits on (proved in both themes by colorTokens)", () => {
  const pairs = CONTRAST_PAIRS.filter(([fg]) => fg === "LOGO_WORD").map(([, bg, size]) => `${bg}/${size}`);
  assert.deepEqual(pairs.sort(), ["CANVAS_SHADE/large", "SURFACE/large", "SURFACE_2/large", "SURFACE_MENU/large"]);
});

test("D19: ONE StampLogo draws the art as token-filled masks — no <img>, no theme branch", () => {
  const stamp = stripComments(read("client/src/components/StampLogo.jsx"));
  assert.match(stamp, /'--c-logo-slash'/);
  assert.match(stamp, /'--c-logo-word'/);
  assert.match(stamp, /background: `var\(\$\{token\}\)`/);
  assert.match(stamp, /maskImage: `url\(\$\{src\}\)`/);
  assert.match(stamp, /WebkitMaskImage: `url\(\$\{src\}\)`/);
  // High-contrast mode repaints backgrounds; without this the mark would vanish there.
  assert.match(stamp, /forcedColorAdjust: 'none'/);
  assert.doesNotMatch(stamp, /<img\b/, "the single-colour artwork is drawn directly again — it cannot take a token");
  assert.doesNotMatch(stamp, /\bTHEME\b|C_DARK|C_LIGHT|prefers-color-scheme|data-theme/, "the mark branches on the theme itself — it is a token change");
  assert.match(stamp, /role="img" aria-label=\{WORDMARK\}/);
});

test("D19: nothing outside StampLogo and the token file paints the mark — no per-page special case", () => {
  const files = execFileSync("git", ["ls-files", "--", "client/src"], { encoding: "utf8" })
    .split("\n").filter(f => /\.(jsx?|css)$/.test(f));
  assert.ok(files.length > 100);
  const allowed = new Set(["client/src/components/StampLogo.jsx", "client/src/styles/colorTokens.js"]);
  // (--c-logo-shadow is a COMPANY logo's shadow on the job card, not the mark.)
  const hits = files.filter(f => !allowed.has(f) && /--c-logo-(slash|word)\b|LOGO_SLASH|LOGO_WORD|-slash\.png|-letters\.png/.test(read(f)));
  assert.deepEqual(hits, [], "a surface special-cases the mark's colours");
});

test("D19: the masks are fresh from the artwork, and slash + letters is exactly the art's alpha", () => {
  for (const name of ["wordmark", "monogram"]) {
    const art = decode(fs.readFileSync(`client/src/assets/brand/${name}.png`));
    const s = split(art);
    for (const part of ["slash", "letters"]) {
      const committed = fs.readFileSync(`client/src/assets/brand/${name}-${part}.png`);
      assert.ok(committed.equals(encode(s[part])), `${name}-${part}.png is stale — run node scripts/d19SplitMark.mjs`);
    }
    for (let i = 0; i < art.w * art.h; i++) {
      const a = art.px[i * 4 + 3], sum = s.slash.px[i * 4 + 3] + s.letters.px[i * 4 + 3];
      if (a !== sum) assert.fail(`${name}: pixel ${i} alpha ${a} != slash+letters ${sum}`);
    }
    // The slash is the left-hand glyph alone: it never reaches the letters' half of the art.
    assert.ok(s.maxX < art.w * 0.6, `${name}: the slash runs to x=${s.maxX}`);
  }
});

test("D19: the splitter REFUSES a slash fused to a letter rather than painting the letter orange", () => {
  // A bar of ink from the slash's foot across the whole art.
  const art = decode(fs.readFileSync("client/src/assets/brand/wordmark.png"));
  const px = Buffer.from(art.px);
  const y = art.h - 2;
  for (let x = 0; x < art.w; x++) px[(y * art.w + x) * 4 + 3] = 255;
  assert.throws(() => split({ ...art, px }), /fused to a letter/);
});

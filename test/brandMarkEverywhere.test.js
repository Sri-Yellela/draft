import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// THE REDESIGNED MARK, ON EVERY SURFACE THAT SHOWS ONE (09-30).
//
// 9feac48 put the "/draft" artwork on the app bar, the landing page and the dock, and said
// "everywhere". Five surfaces still set the name as styled TEXT — the sign-in screen, the marketing
// nav, the footer, the admin bar and the admin sign-in — so a signed-out visitor met the old look
// first. Each now renders <StampLogo>, and this keeps a sixth from appearing: the wordmark constant
// rendered as a JSX child is the old stamp by another name.

const ROOT = "client/src";
const files = fs.readdirSync(ROOT, { recursive: true })
  .map(String).filter(f => f.endsWith(".jsx")).map(f => path.join(ROOT, f).replace(/\\/g, "/"));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\/.*$/gm, "");

test("no surface draws the name as text in place of the mark", () => {
  const offenders = files.filter(f => !f.endsWith("components/StampLogo.jsx"))
    .filter(f => />\s*\{WORDMARK\}\s*</.test(strip(fs.readFileSync(f, "utf8"))));
  assert.deepEqual(offenders, [], "render <StampLogo>, the shared mark");
});

test("the five surfaces that drew text now render the shared mark", () => {
  for (const f of ["components/AuthScreen.jsx", "components/Footer.jsx",   // A93: MarketingNav.jsx deleted — nothing rendered it
                   "components/AdminLayout.jsx", "pages/AdminLoginPage.jsx"]) {
    assert.match(strip(fs.readFileSync(`${ROOT}/${f}`, "utf8")), /<StampLogo\b/, f);
  }
});

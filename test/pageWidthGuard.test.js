// ⛔⛔ 46q · FULL WIDTH (owner 11-16: "draft is still not using the full space width of the screen … crammed to the
// center portion. space the content out with reasonable margin. audit the whole site for this issue and fix it").
// The rule is docs/BRAND.md § FULL WIDTH: a page's container fills the width with var(--page-gutter); running text is
// capped at var(--page-measure); grids grow into the width. This guard fails on a NEW centred page-level cap — a
// `max-width` (CSS) / `maxWidth` (JSX style) of 640 px or more TOGETHER WITH `margin: 0 auto` / `margin-inline: auto`
// (or `marginInline: "auto"`) in the same rule or style object — anywhere in client/src, unless ALLOW names the file and
// the selector / value with WHY (prose read at a measure, a dialog, a sheet). Like d60NoPills / colorLiteralGuard.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!/node_modules/.test(f)) walk(p, out); }
    else out.push(p.split(path.sep).join("/"));
  }
  return out;
}
const MIN_PX = 640;

/** file → [{ key: a substring of the offending rule / style object, why }] */
export const ALLOW = {
  // prose-only pages: the column IS the reading measure (BRAND § FULL WIDTH, "a prose-only page")
  "client/src/pages/marketing/PrivacyPage.jsx": [{ key: "maxWidth: 720", why: "prose page — the reading measure" }],
  "client/src/pages/marketing/TermsPage.jsx": [{ key: "maxWidth: 720", why: "prose page — the reading measure" }],
  "client/src/pages/marketing/ConnectorDocsPage.jsx": [{ key: "maxWidth: 820", why: "prose page (docs) — the reading measure" }],
  "client/src/pages/tools/ApplyToolPage.jsx": [{ key: "maxWidth: 720", why: "a one-column tool form read top to bottom" }],
  "client/src/pages/tools/ATSToolPage.jsx": [{ key: "maxWidth: 720", why: "a one-column tool form read top to bottom" }],
  "client/src/pages/tools/GenerateToolPage.jsx": [{ key: "maxWidth: 720", why: "a one-column tool form read top to bottom" }],
  "client/src/pages/tools/HonestyToolPage.jsx": [{ key: "maxWidth: 760", why: "a one-column tool form read top to bottom" }],
  "client/src/pages/audit/AuditPage.css": [{ key: ".au", why: "the résumé audit — a one-column report read top to bottom" }],
  // ⛔ 47j w1-market (changed on purpose): ExtensionPrompt's banner (maxWidth 920) is the plate's drawer now — its entry is dropped
  "client/src/components/Footer.jsx": [{ key: "maxWidth: 960", why: "the footer's link rows" }],
  "client/src/pages/atlas/LibraryPanel.css": [{ key: ".lib-half__svg", why: "an illustration drawn at its own size, not a container" }],
  "client/src/panels/ProfilePanel.jsx": [{ key: "maxWidth:680", why: "the sign-in-required notice card, not a page" }],
};

/** CSS rules and JSX style objects that pair a ≥ MIN_PX max-width with auto side margins. */
export function centredCaps(src, file) {
  const out = [];
  const s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  if (file.endsWith(".css")) {
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, sel, body] = m;
      if (/@media|@container|@supports/.test(sel) && !/[.#\w]/.test(sel.replace(/@\w+[^{]*/, ""))) continue;
      // 46q: a px fallback inside var() counts too (the landing's var(--content-wide, 1200px) hid a centred cap)
      const mw = body.match(/max-width:\s*(?:var\(--[\w-]+,\s*)?(\d+)px/);
      if (!mw || Number(mw[1]) < MIN_PX) continue;
      if (/margin:\s*(0|[\d.]+px)\s+auto\b|margin:\s*auto\b|margin-inline:\s*auto\b|margin-left:\s*auto[^;]*;[^}]*margin-right:\s*auto/.test(body))
        out.push({ key: sel.trim().split("\n").pop().trim(), px: Number(mw[1]), text: `${sel.trim().split("\n").pop().trim()} { max-width: ${mw[1]}px … auto }` });
    }
  } else {
    // template holes (`${theme.border}`) carry braces that would end a style object early — blank them first
    const code = s.replace(/(^|[\s;,{(])\/\/[^\n]*/g, (x, p) => p + " ".repeat(x.length - p.length)).replace(/\$\{[^{}]*\}/g, "$X");
    for (const m of code.matchAll(/\{\{?[^{}]*maxWidth:\s*"?(\d+)(?:px)?"?[^{}]*\}/g)) {
      const body = m[0], px = Number(m[1]);
      if (px < MIN_PX) continue;
      if (/margin:\s*"(0|[\d.]+px)\s+auto|margin:\s*"auto|marginInline:\s*"auto|marginLeft:\s*"auto/.test(body))
        out.push({ key: body, px, text: body.replace(/\s+/g, " ").slice(0, 120) });
    }
  }
  return out;
}

test("46q pageWidthGuard — no centred page-level max-width cap outside the allowed measures", () => {
  const files = walk("client/src").filter(f => /\.(css|jsx)$/.test(f));
  const bad = [];
  for (const f of files) {
    const allow = ALLOW[f] || [];
    for (const c of centredCaps(read(f), f)) if (!allow.some(a => c.key.includes(a.key) || c.text.includes(a.key))) bad.push(`${f}: ${c.text}`);
  }
  assert.deepEqual(bad, [], `centred page caps (docs/BRAND.md § FULL WIDTH — fill the width with var(--page-gutter); cap only running text at var(--page-measure)):\n${bad.join("\n")}`);
});

test("46q pageWidthGuard — every allow-list entry still matches something and says why", () => {
  for (const [f, entries] of Object.entries(ALLOW)) {
    assert.ok(fs.existsSync(f), `${f} is gone — drop its entry`);
    const caps = centredCaps(read(f), f);
    for (const a of entries) {
      assert.ok(a.why && a.why.length > 8, `${f}: say why`);
      assert.ok(caps.some(c => c.key.includes(a.key) || c.text.includes(a.key)), `${f}: "${a.key}" no longer caps anything — drop the entry`);
    }
  }
});

test("46q pageWidthGuard — the tokens and the shared piece exist once, loaded by main.jsx", () => {
  const css = read("client/src/styles/pageWidth.css");
  assert.match(css, /--page-gutter:\s*clamp\(16px,\s*3vw,\s*48px\)/);
  assert.match(css, /--page-measure:\s*70ch/);
  assert.match(css, /\.page-fill\s*\{/);
  assert.match(read("client/src/main.jsx"), /import "\.\/styles\/pageWidth\.css"/);
});

test("46q pageWidthGuard — the detector itself: a centred cap is found, a measure or an uncentred cap is not", () => {
  assert.equal(centredCaps(".x { max-width: 920px; margin: 0 auto; }", "a.css").length, 1);
  assert.equal(centredCaps(".x { max-width: 70ch; margin: 0 auto; }", "a.css").length, 0);
  assert.equal(centredCaps(".x { max-width: 920px; }", "a.css").length, 0);
  assert.equal(centredCaps(".x { max-width: var(--content-wide, 1200px); margin-inline: auto; }", "a.css").length, 1);
  assert.equal(centredCaps('<div style={{ maxWidth: 980, margin: "0 auto" }}/>', "a.jsx").length, 1);
  assert.equal(centredCaps('<div style={{ maxWidth: 420, margin: "0 auto" }}/>', "a.jsx").length, 0);
  // Admin's old wrapper: a template hole (`${…}`) inside the style object, and a comment between the cap and the margin
  assert.equal(centredCaps('<div style={{ border:`1px solid ${theme.border}`, maxWidth:1200,\n // why\n margin:"0 auto" }}/>', "a.jsx").length, 1);
});

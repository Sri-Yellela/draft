// A69 — draft carries the PDF toolkit as the SAME component the tools service mounts, not a copy.
// The operations themselves are tested in packages/pdf-toolkit/test (run by this suite).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("/tools/pdf is routed, linked from the tools nav, and renders the toolkit", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /<Route path="\/tools\/pdf"\s+element=\{<PdfToolPage\/>\}\/>/);
  assert.match(read("client/src/components/ScrollDock.jsx"), /\{ label: "PDF Tools",\s+to: "\/tools\/pdf" \}/);
  assert.match(read("client/src/pages/tools/PdfToolPage.jsx"), /<PdfToolkit initial=/);
});

test("⛔ one implementation: the client mounts the package's ui.js, lazily, and nothing else draws the tools", () => {
  const wrapper = read("client/src/components/PdfToolkit.jsx");
  assert.match(wrapper, /import\("\.\.\/\.\.\/\.\.\/packages\/pdf-toolkit\/src\/ui\.js"\)/, "the package's own component, by dynamic import");
  assert.match(wrapper, /import\("@cantoo\/pdf-lib"\)/, "the libraries load only when the tools open");
  for (const f of walk("client/src")) {
    if (f.endsWith(path.join("components", "PdfToolkit.jsx"))) continue;
    const src = read(f);
    assert.doesNotMatch(src, /@cantoo\/pdf-lib|pdfjs-dist|function mountPdfToolkit/, `${f} must not carry a second PDF toolkit`);
  }
});

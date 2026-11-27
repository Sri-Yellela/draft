// D91 · DOCUMENTS ARE NEVER THEMED — the résumé, its preview, the PDF / DOCX and the cover letter stay black on
// white in EVERY theme (docs/THEME_MODULE.md §1; the audit found the cover letter themed, THEME_AUDIT.md §10).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { THEME_LIST } = await import("../client/src/themes/index.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

test("⛔ the document surface is the SAME black on white in every registered theme", () => {
  for (const t of THEME_LIST) {
    assert.equal(t.tokens.DOC_PAPER, "#FFFFFF", `${t.id}: the document paper follows the theme`);
    assert.equal(t.tokens.DOC_INK, "#1A1A1A", `${t.id}: the document ink follows the theme`);
  }
});

test("the résumé document carries its own white ground and ink — no theme variable reaches it", () => {
  const fmt = read("services/resumeFormatter.js");
  assert.match(fmt, /--color-bg: #ffffff;/);
  assert.match(fmt, /--color-text: #1a1a1a;/);
  assert.doesNotMatch(fmt, /var\(--c-/, "the résumé reads a theme token");
});

test("the cover letter as shown, and the résumé frames, sit on the document surface", () => {
  const letter = read("client/src/components/CoverLetterModal.jsx");
  assert.match(letter, /data-doc-surface="" style=\{\{ background:C\.DOC_PAPER,[\s\S]{0,160}?color:C\.DOC_INK,/);
  const table = read("client/src/panels/DatabasePanel.jsx");
  assert.match(table, /background:C\.DOC_PAPER \}\}/, "The Table's résumé frame has a themed backdrop");
  assert.match(table, /color:\$\{C\.DOC_INK\}'>No resume HTML stored\./);
  // No résumé frame is given a themed background behind the document.
  for (const f of ["client/src/pages/tools/GenerateToolPage.jsx", "client/src/plate/SheetResume.jsx" /* 47m: SandboxPanel's preview */, "client/src/panels/DatabasePanel.jsx"]) {
    for (const m of read(f).matchAll(/<iframe[\s\S]*?\/>/g)) {
      assert.doesNotMatch(m[0], /background:\s*(theme\.|C\.(?!DOC_PAPER))/, `${f}: a résumé frame on a themed ground`);
    }
  }
});

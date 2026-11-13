// ⭐ A204 (46k, owner 11-13: "bring it into [resume-master] and apply the theme, styling and range of utility options to the
// entire [resume-master] site and draft would just host the sandbox"). draft keeps NO résumé editor of its own: the editor —
// its toolbar, its range of options (A203 (2) moved draft's sandbox options into it) — is resume-master's, embedded by
// components/ResumeEditorHost.jsx. draft's panel shows only what the editor does not: generating, a failure, a missing
// artifact, the company KB's findings (Accept applies the fix and saves), the A+ / Generate switch, and a read-only preview.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A204: draft's own editing toolbar and commands are gone — the editor is resume-master's", () => {
  assert.equal(fs.existsSync("client/src/components/DocToolbar.jsx"), false);
  assert.equal(fs.existsSync("client/src/lib/docFormat.js"), false);
  const manifest = read("client/src/modules.manifest.js");
  assert.doesNotMatch(manifest, /DocToolbar|docFormat/);
  for (const f of ["client/src/panels/SandboxPanel.jsx", "client/src/panels/JobsPanel.jsx", "client/src/components/JobDetailPanel.jsx"]) {
    assert.doesNotMatch(read(f), /execCommand|DocToolbar|docFormat/, `${f} edits nothing itself`);
  }
});

test("A204: the panel's pages are a read-only preview; 'Edit in the editor' hands the résumé to resume-master's editor", () => {
  const sb = read("client/src/panels/SandboxPanel.jsx");
  assert.doesNotMatch(sb, /contentEditable = "true"/, "the page frames are not editable");
  assert.match(sb, /import \{ openResumeEditor \} from "\.\.\/lib\/resumeEditor\.js";/);
  assert.match(sb, /const editInEditor = \(\) => \{\n    const html = getCurrentHtml\(\);\n    openResumeEditor\(\{ html,/);
  assert.match(sb, /data-edit-in-editor="">Edit in the editor<\/button>/);
  // the company KB's fix is still applied on Accept and saved (a draft feature, not the editor's)
  assert.match(sb, /const applyFinding = \(f\) => \{/);
  assert.match(sb, /if \(n && doc\) doc\.dispatchEvent\(new Event\("input"\)\);/);
  // a ready résumé opens in the editor; the panel is for what the editor does not do
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.match(jp, /openResumeEditor\(\{\n      html: cleanDocHtml\(active\.html\)/);
});

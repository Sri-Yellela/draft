// e2e 11-05 (agenda step 3, edit + export) — what the real-Chrome walk of draft's sandbox found, pinned.
// The walk itself (headless Chrome on the 18k copy: open a stored résumé → Page → type → Save → autosave → HTML → PDF →
// reload) lives outside the repo; these tests hold the four mechanisms it measured.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { at } from "../test-support/sourceAnchors.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// ⛔ 47m (changed on purpose): "e2e step 3 · the page frames' html is memoised…" retired — SandboxPanel is deleted (D199 C7): its live view is the opening sheet's 06 (plate/SheetResume.jsx, pinned in a204DraftHostsTheSandbox); editing is resume-master's editor (A204)

// ⛔ 47m (changed on purpose): "e2e step 3 · Save's own echo…" retired — SandboxPanel is deleted (D199 C7): its live view is the opening sheet's 06 (plate/SheetResume.jsx, pinned in a204DraftHostsTheSandbox); editing is resume-master's editor (A204)

// ⛔ 47m (changed on purpose): "e2e step 3 · a save that finishes while typing…" retired — SandboxPanel is deleted (D199 C7): its live view is the opening sheet's 06 (plate/SheetResume.jsx, pinned in a204DraftHostsTheSandbox); editing is resume-master's editor (A204)

test("e2e step 3 · saved / downloaded / printed html carries no editing attributes", async () => {
  // 47m: cleanDocHtml moved to lib/resumeEditor.js with SandboxPanel's deletion; the editor's open path strips with it
  const { cleanDocHtml } = await import("../client/src/lib/resumeEditor.js");
  const html = '<html><head></head><body contenteditable="true" spellcheck="false" class="r"><h1>Alex</h1></body></html>';
  assert.equal(cleanDocHtml(html), '<html><head></head><body class="r"><h1>Alex</h1></body></html>');
  assert.equal(cleanDocHtml("<body><p contenteditable=\"true\">x</p></body>"), "<body><p contenteditable=\"true\">x</p></body>", "only <body>'s own");
  assert.match(read("client/src/panels/JobsPanel.jsx"), /html: cleanDocHtml\(active\.html\)/);
});

test("e2e step 3 · /keep reads version null as 'no version' (every PDF export of a stored résumé was a 404)", () => {
  const server = read("server.js");
  const keep = server.slice(at(server, 'app.post("/api/resumes/:jobId/keep"'), at(server, 'app.get("/api/resumes/:jobId/pdf"'));
  assert.match(keep, /const version = rawVersion == null \|\| rawVersion === "" \? null :/);
  assert.equal(Number(null), 0, "why: Number(null) is 0");
});

// ⛔ 47m (changed on purpose): "e2e step 3 · the Reading view's 'Page view' button…" retired — SandboxPanel is deleted (D199 C7): its live view is the opening sheet's 06 (plate/SheetResume.jsx, pinned in a204DraftHostsTheSandbox); editing is resume-master's editor (A204)

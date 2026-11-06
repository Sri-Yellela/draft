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
const sandbox = read("client/src/panels/SandboxPanel.jsx");

test("e2e step 3 · the page frames' html is memoised — typing never reloads an iframe (the caret survives)", () => {
  // Before: srcDoc={currentHtmlRef.current || activeEntry.html} — the ref changes on every input, so the first
  // re-render (setDirty) changed srcdoc and reloaded the page: only the first keystroke landed.
  assert.doesNotMatch(sandbox, /srcDoc=\{currentHtmlRef\.current/);
  assert.equal((sandbox.match(/srcDoc=\{frameHtml\}/g) || []).length, 2, "both the page frames and Reading view");
  assert.match(sandbox, /const frameHtml = useMemo\(/);
  assert.match(sandbox, /\[docVersion, viewMode, selectedTool, pageCount\]/);
});

test("e2e step 3 · Save's own echo (entry.html) is not a new résumé — no reset to Reading, no reload", () => {
  assert.match(sandbox, /if \(entry\?\.html != null && savedHtmlsRef\.current\.has\(entry\.html\)\) return;/);
  assert.match(sandbox, /savedHtmlsRef\.current\.add\(html\);\n\s+if \(onSave\) await onSave\(html, activeEntry\);/);
});

test("e2e step 3 · a save that finishes while typing does not cancel the next autosave", () => {
  // Before: useEffect(() => () => clearTimeout(autoSaveTimer.current), [entry?.html]) — the save's echo changed
  // entry.html and cleared the timer of what was typed after it (measured: " AutoB" never saved).
  assert.doesNotMatch(sandbox, /clearTimeout\(autoSaveTimer\.current\), \[entry\?\.html\]/);
  const reset = sandbox.slice(at(sandbox, "savedHtmlsRef.current = new Set();"), at(sandbox, "setDocVersion(v => v + 1);"));
  assert.match(reset, /clearTimeout\(autoSaveTimer\.current\);/, "only a NEW résumé drops the pending autosave");
});

test("e2e step 3 · saved / downloaded / printed html carries no editing attributes", async () => {
  const src = sandbox.slice(at(sandbox, "export function cleanDocHtml("), at(sandbox, "export default function SandboxPanel("));
  const cleanDocHtml = new Function(`${src.replace("export function", "function")}; return cleanDocHtml;`)();
  const html = '<html><head></head><body contenteditable="true" spellcheck="false" class="r"><h1>Alex</h1></body></html>';
  assert.equal(cleanDocHtml(html), '<html><head></head><body class="r"><h1>Alex</h1></body></html>');
  assert.equal(cleanDocHtml("<body><p contenteditable=\"true\">x</p></body>"), "<body><p contenteditable=\"true\">x</p></body>", "only <body>'s own");
  assert.match(sandbox, /const getCurrentHtml = \(\) => \{[\s\S]*?return cleanDocHtml\(/);
});

test("e2e step 3 · /keep reads version null as 'no version' (every PDF export of a stored résumé was a 404)", () => {
  const server = read("server.js");
  const keep = server.slice(at(server, 'app.post("/api/resumes/:jobId/keep"'), at(server, 'app.get("/api/resumes/:jobId/pdf"'));
  assert.match(keep, /const version = rawVersion == null \|\| rawVersion === "" \? null :/);
  assert.equal(Number(null), 0, "why: Number(null) is 0");
});

test("e2e step 3 · the Reading view's 'Page view' button calls the setter that exists", () => {
  assert.doesNotMatch(sandbox, /setViewMode\(/);
  assert.match(sandbox, /onClick=\{\(\) => setViewChoice\("page"\)\}/);
});

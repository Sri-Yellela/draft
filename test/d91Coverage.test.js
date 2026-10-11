// D91 P6 · COVERAGE — what the screenshot matrix's scans found, held so it cannot come back.
//
// scripts/d91ThemeShots.mjs --scan walks every route × theme × viewport × cues for text below its theme's target
// and for focus stops that draw nothing. Two defects it found were older than D91 and in every theme:
//   1. the logo orange FILL used as TEXT (the shared sub-tab bar, the cover letter's tone picker, the dock's
//      hover, a board control) — 3.3:1 on Paper Light's glass, a rule colorTokens.js states and nothing enforced;
//   2. ~20 controls with an inline `outline: none` and no other keyboard-focus cue.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const files = fs.readdirSync("client/src", { recursive: true }).map(String)
  .filter((f) => /\.(jsx?|css)$/.test(f)).map((f) => path.join("client/src", f).replace(/\\/g, "/"));
// Comments out, line numbers kept (a block comment becomes blanks of the same shape).
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, " ");

test("⛔ the logo orange FILL is never text — orange text is accentText / ACCENT_INK", () => {
  const FILL_AS_TEXT = /(^|[^-\w])color:\s*(?:[^,;}\n]*\?\s*)?(?:theme\.accent|t\.accent|C\.ACCENT|var\(--c-accent\)|var\(--color-primary\))(?![\w-])/;
  const hits = [];
  for (const f of files) {
    strip(read(f)).split("\n").forEach((line, i) => { if (FILL_AS_TEXT.test(line)) hits.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
  // The scanner itself works on the shape it guards against.
  assert.ok(FILL_AS_TEXT.test(`color: active === id ? theme.accent : theme.textMuted,`));
  assert.ok(!FILL_AS_TEXT.test(`color: active === id ? theme.accentText : theme.textMuted,`));
  assert.ok(!FILL_AS_TEXT.test(`background-color: var(--c-accent);`));
});

test("⛔ focus is visible everywhere: a keyboard-focus ring floor under every theme", () => {
  const css = read("client/src/styles/cues.css");
  assert.match(css, /^:focus-visible \{ outline: 2px solid var\(--c-accent-ink\) !important; outline-offset: 2px !important; \}$/m);
  assert.match(read("client/src/main.jsx"), /import "\.\/styles\/cues\.css";/);
});

test("the matrix's contrast scan holds exactly the approved exceptions at AA, and checks focus", () => {
  const shots = read("scripts/d91ThemeShots.mjs");
  assert.match(shots, /const held = \["--c-accent", "--c-accent-hover", "--c-provider-google", "--c-provider-linkedin", "--c-provider-github", "--c-provider-indeed"\]/);
  assert.match(shots, /const need = aaa && !isHeld\(ground\) \? \(large \? 4\.5 : 7\) : \(large \? 3 : 4\.5\);/);
  assert.match(shots, /async function focusScan\(page\)/);
});

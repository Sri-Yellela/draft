// A233 / 46v 0a (owner 11-18: "get rid of the draft house full house words"): the two place names are
// retired from everything a person reads. The board is "your jobs"; Draft House is "Applications".
// Code names, file names, data attributes and comments keep the old words — only strings are checked.
// Allowed: client/src/modules.manifest.js (the A93 ledger describes code, not a screen).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DIRS = ["client/src", "extension", "services", "shared", "routes", "content"];
const SKIP_DIRS = new Set(["node_modules", "submission", "dist"]);
const ALLOW = new Set(["client/src/modules.manifest.js"]);
const EXT = /\.(jsx?|mjs|html|json|md)$/;
const WORDS = /Full House|Draft House|FULL HOUSE|DRAFT HOUSE/;

function* walk(dir) {
  let names;
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (SKIP_DIRS.has(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.test(n)) yield p;
  }
}

// Strip comments: JSX {/* */}, block /* */, HTML <!-- -->, and // to end of line when it follows
// whitespace or starts the line (so "https://" inside a string survives).
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

test("no user-facing string says Full House or Draft House", () => {
  const hits = [];
  for (const d of DIRS) {
    for (const file of walk(join(ROOT, d))) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (ALLOW.has(rel)) continue;
      const lines = stripComments(readFileSync(file, "utf8")).split(/\r?\n/);
      lines.forEach((l, i) => { if (WORDS.test(l)) hits.push(`${rel}:${i + 1}: ${l.trim().slice(0, 140)}`); });
    }
  }
  assert.deepEqual(hits, [], "retired place names in user-facing text:\n" + hits.join("\n"));
});

// ⭐ 46v: the other retired words, once none was left on screen — the old mode names (owner D113: "Ask me first" /
// "Apply for me"), the assistant's old name (owner 11-18: "drop 'tiny'"), and the October plan vocabulary. Client and
// extension strings only (services' logs and the mobile API's own docs are not screens; admin pages are allowed).
const SCREENS = ["client/src", "extension"];
const RETIRED = /\bSEMI\b|FULL AUTO|\bTiny\b|jobs console|Simple Apply|ATS Sort|profile-scoped/;
const ADMIN = /(^|\/)(admin[^/]*|Admin[^/]*)\.jsx?$|\/pages\/admin\//;
test("no user-facing string uses a retired name (SEMI / FULL AUTO / Tiny / the October plan words)", () => {
  const hits = [];
  for (const d of SCREENS) {
    for (const file of walk(join(ROOT, d))) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (ALLOW.has(rel) || ADMIN.test(rel) || rel.endsWith(".md")) continue;   // .md: reviewer docs, not in the package's screens
      const lines = stripComments(readFileSync(file, "utf8")).split(/\r?\n/);
      lines.forEach((l, i) => { if (RETIRED.test(l) && !/^\s*"about":/.test(l)) hits.push(`${rel}:${i + 1}: ${l.trim().slice(0, 140)}`); });
    }
  }
  assert.deepEqual(hits, [], "retired names in user-facing text:\n" + hits.join("\n"));
});

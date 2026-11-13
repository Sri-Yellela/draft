// 46k: every client stylesheet parses. A201's edit once left a stray "}" in ApplicationTracker.css; Vite then showed its error
// overlay instead of the app, and the real-Chrome layout probes measured an empty page as "clean". A parse error fails here,
// in a second, before any browser runs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve("client/package.json"));
const postcss = require("postcss");

function* cssFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") yield* cssFiles(p); }
    else if (e.name.endsWith(".css")) yield p;
  }
}

test("every client stylesheet parses (a stray brace never reaches the browser)", () => {
  const bad = [];
  let n = 0;
  for (const f of cssFiles("client/src")) {
    n++;
    try { postcss.parse(fs.readFileSync(f, "utf8"), { from: f }); } catch (e) { bad.push(`${f}: ${e.reason || e.message} (line ${e.line})`); }
  }
  assert.ok(n > 20, `found the stylesheets (${n})`);
  assert.deepEqual(bad, []);
});

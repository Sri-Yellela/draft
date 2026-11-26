// ⭐ 47h (47f's gap 4 (d)) · THE BEARING SAYS WHICH RÉSUMÉ SET IT — the board's "FROM MAYA_CHEN.PDF · NOV 8" on the
// cartouche's strip, from the active profile's base résumé (GET /api/base-resume: name + updatedAt, read once on the plate
// market). Unknown → the strip keeps "SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE" (nothing invented).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
async function load() {
  const require = createRequire(path.resolve("client/package.json"));
  const esbuild = require("esbuild");
  const out = await esbuild.build({ entryPoints: [path.resolve("client/src/plate/PlateBearing.jsx")], bundle: true, write: false, format: "esm",
    platform: "node", jsx: "automatic", loader: { ".woff2": "empty", ".woff": "empty", ".css": "empty" }, logLevel: "error",
    nodePaths: [path.resolve("client/node_modules")] });
  const file = path.resolve("tmp", `bearingFrom47h-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

test("47h · fromWords: FROM <FILE> · <MON D>; no name → null", async () => {
  const { fromWords } = await load();
  const nov8 = Date.parse("2026-11-08T15:00:00Z") / 1000;
  assert.equal(fromWords({ name: "Maya_Chen.pdf", at: nov8 }), "FROM MAYA_CHEN.PDF · NOV 8");
  assert.equal(fromWords({ name: "cv.docx", at: null }), "FROM CV.DOCX", "no date → the file alone");
  assert.equal(fromWords({ name: "", at: nov8 }), null);
  assert.equal(fromWords(null), null);
});

test("47h · the strip draws it, App reads /api/base-resume once on the plate market", () => {
  const pb = read("client/src/plate/PlateBearing.jsx");
  // D199 (47h, moved on purpose): with the market's controls inside, the strip reads the approved board's words
  assert.match(pb, /\{fromWords\(from\) \|\| \(children \? "FROM YOUR RÉSUMÉ · YOURS TO CHANGE" : "SET FROM YOUR RÉSUMÉ · YOURS TO CHANGE"\)\}/);
  const app = read("client/src/App.jsx");
  assert.match(app, /function useResumeSource\(on\) \{[\s\S]{0,300}api\("\/api\/base-resume"\)/);
  // 47j R2 (changed on purpose): the market is always the plate market, so the read is always on there
  assert.match(app, /const resumeFrom = useResumeSource\(true\);/);
  assert.match(app, /from=\{resumeFrom\}/);
});

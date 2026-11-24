// ⭐ D196 F4 / R2 / R4 · the gallery in a real Chrome, with R2's extreme data, at 1280 and 390 px:
//   no page error, no sideways page scroll (R4: wide things scroll in their own box), and no gallery cell whose content
//   is wider than the cell — a long title or company name wraps, never clips (d196ExtremeDataNoClip). Two cells overflow
//   on purpose and are named: the deck pile's rotated backs, and the plate hero's callout tags (they hang off a plate;
//   hidden below 980 px).
// First run 11-24 (47d): 190 cells at each width, 0 errors, 0 page scroll, only the two named.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { launchBrowser } from "../services/browserLauncher.js";

const ON_PURPOSE = new Set(["DeckPile:ready", "PlateHero:ready"]);

test("D196 · the gallery renders every cell at 1280 and 390 without an error, a page scroll or a clipped cell", { timeout: 300000 }, async () => {
  const require = createRequire(path.resolve("client/package.json"));
  const esbuild = require("esbuild");
  const dir = path.resolve("tmp/d196-gallery-test");
  fs.mkdirSync(dir, { recursive: true });
  await esbuild.build({
    stdin: { contents: `import { createRoot } from "react-dom/client"; import G from ${JSON.stringify(path.resolve("client/src/pages/dev/PlateGallery.jsx"))}; createRoot(document.getElementById("root")).render(<G/>);`, resolveDir: path.resolve("client"), loader: "jsx" },
    bundle: true, format: "iife", outfile: path.join(dir, "g.js"), jsx: "automatic", loader: { ".woff2": "file", ".woff": "file" }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  fs.writeFileSync(path.join(dir, "g.html"), `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="g.css"><style>body{margin:0}</style><div id="root"></div><script src="g.js"></script>`);
  const browser = await launchBrowser({ headless: "new" });
  try {
    for (const w of [1280, 390]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await page.setViewport({ width: w, height: 1000 });
      await page.goto(pathToFileURL(path.join(dir, "g.html")).href + `?extremes=1${w === 390 ? "&w=390" : ""}`, { waitUntil: "load" });
      await page.waitForSelector("[data-plate-cell]");
      await new Promise((r) => setTimeout(r, 1500));
      const m = await page.evaluate(() => ({
        pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cells: document.querySelectorAll("[data-plate-cell]").length,
        clipped: [...document.querySelectorAll("[data-plate-cell]")]
          .filter((c) => c.scrollWidth > c.clientWidth + 1 && !c.querySelector(".pl-gazetteer,.pl-route,.pl-code__plate,.pl-viewscroll"))
          .map((c) => c.dataset.plateCell),
      }));
      await page.close();
      assert.deepEqual(errors, [], `${w} px: page errors`);
      assert.equal(m.pageScroll, 0, `${w} px: the page scrolls sideways`);
      assert.ok(m.cells >= 180, `${w} px: only ${m.cells} cells`);
      assert.deepEqual(m.clipped.filter((c) => !ON_PURPOSE.has(c)), [], `${w} px: content wider than its cell`);
    }
  } finally { await browser.close(); }
});

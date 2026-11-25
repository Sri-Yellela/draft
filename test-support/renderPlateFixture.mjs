// 47h (D197 #3 / #4) · render a plate F5 fixture (client/src/plate/fixtures.jsx FIXTURES) to static HTML in Node — esbuild
// bundles it (CSS and fonts emptied) and react-dom/server renders it. No browser: a fast-tier helper for markup checks
// (every mark answers, one header line, the stack legend's rows).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();

/** The fixture `name`'s rendered HTML (cached per process). */
export async function renderFixture(name) {
  if (cache.has(name)) return cache.get(name);
  const require = createRequire(path.join(ROOT, "client", "package.json"));
  const esbuild = require("esbuild");
  const dir = path.join(ROOT, "tmp", "plate-render");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}-${process.pid}.mjs`);
  await esbuild.build({
    stdin: { contents: `
      import { renderToStaticMarkup } from "react-dom/server";
      import { createElement } from "react";
      import { FIXTURES } from ${JSON.stringify(path.join(ROOT, "client/src/plate/fixtures.jsx"))};
      export const html = renderToStaticMarkup(createElement(FIXTURES[${JSON.stringify(name)}]));`, resolveDir: path.join(ROOT, "client"), loader: "jsx" },
    bundle: true, platform: "node", format: "esm", outfile: out, jsx: "automatic", logLevel: "error",
    loader: { ".css": "empty", ".woff2": "empty", ".woff": "empty", ".json": "json" }, define: { "process.env.NODE_ENV": '"production"' },
  });
  try {
    const { html } = await import(pathToFileURL(out).href);
    cache.set(name, html);
    return html;
  } finally { fs.rmSync(out, { force: true }); }
}

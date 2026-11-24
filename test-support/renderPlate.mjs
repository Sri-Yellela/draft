// ⭐ D196 · render the plate library to static markup in node — no browser (the fast tier). esbuild bundles a tiny entry
// (the library, its registry, the generated drawings, react-dom/server) into tmp/, CSS and fonts as empty modules; the
// test imports it and calls renderToStaticMarkup. What this proves: every component renders in every state without a
// throw, and the markup carries the structure R1 / R2 / R5 ask for. What it cannot: layout (clipping, overlap, contrast
// in pixels) — that is the browser regression run (scripts/d196Regress.mjs, F5).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = path.join(ROOT, "client");
const require = createRequire(path.join(CLIENT, "package.json"));

let cached = null;
/** → { React, render(Component, props) → html, LIB, REGISTRY, PORTED, DRAWINGS } */
export async function loadPlate({ reducedMotion = false } = {}) {
  const key = reducedMotion ? "rm" : "m";
  if (cached?.[key]) return cached[key];
  const esbuild = require("esbuild");
  const out = path.join(ROOT, "tmp", "d196-render", `plate-${key}-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const src = path.join(CLIENT, "src");
  const entry = `
    import * as React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import * as Shell from ${JSON.stringify(path.join(src, "plate/Shell.jsx"))};
    import * as Marks from ${JSON.stringify(path.join(src, "plate/Marks.jsx"))};
    import * as Plates from ${JSON.stringify(path.join(src, "plate/Plates.jsx"))};
    import * as Tickets from ${JSON.stringify(path.join(src, "plate/Tickets.jsx"))};
    import * as Cards from ${JSON.stringify(path.join(src, "plate/Cards.jsx"))};
    import * as Lists from ${JSON.stringify(path.join(src, "plate/Lists.jsx"))};
    import * as Drawings from ${JSON.stringify(path.join(src, "plate/Drawings.jsx"))};
    import * as Explainer from ${JSON.stringify(path.join(src, "plate/explainer/Explainer.jsx"))};
    import PlateRoot from ${JSON.stringify(path.join(src, "plate/PlateRoot.jsx"))};
    import { PLATE_REGISTRY, PORTED_DRAWINGS } from ${JSON.stringify(path.join(src, "plate/registry.js"))};
    import { DRAWINGS } from ${JSON.stringify(path.join(src, "plate/drawings/index.js"))};
    export const LIB = { ...Shell, ...Marks, ...Plates, ...Tickets, ...Cards, ...Lists, ...Drawings, ...Explainer };
    export const REGISTRY = PLATE_REGISTRY; export const PORTED = PORTED_DRAWINGS; export { DRAWINGS, PlateRoot, React };
    const RM = ${reducedMotion ? "true" : "false"};
    const fakeWindow = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} };
    // reduced motion is set only while THIS bundle renders, so two bundles in one process don't leak into each other
    export const render = (C, props) => {
      if (!RM) return renderToStaticMarkup(React.createElement(C, props));
      const had = Object.prototype.hasOwnProperty.call(globalThis, "window"), prev = globalThis.window;
      globalThis.window = fakeWindow;
      try { return renderToStaticMarkup(React.createElement(C, props)); } finally { if (had) globalThis.window = prev; else delete globalThis.window; }
    };
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: CLIENT, loader: "jsx" },
    bundle: true, platform: "node", format: "esm", outfile: out, jsx: "automatic", logLevel: "silent",
    loader: { ".css": "empty", ".woff2": "empty", ".woff": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(CLIENT, "node_modules")],
    // react-dom/server's node build requires node builtins (stream, util): give the ESM bundle a real require
    banner: { js: 'import { createRequire as __plateCR } from "node:module"; const require = __plateCR(import.meta.url);' },
  });
  const mod = await import(pathToFileURL(out).href);
  cached = { ...(cached || {}), [key]: mod };
  try { fs.unlinkSync(out); } catch { /* the import holds it; tmp/ is untracked */ }
  return mod;
}

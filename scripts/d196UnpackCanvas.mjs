// D196 F2 / F5 — unpack the canvas export (docs/sketches/Atlas plate system.html) into its pages.
//
// The export is a self-contained bundle: a gzip+base64 manifest of every file the canvas uses
// (the artboard pages as HTML, the Google-font files), a page order and a template that frames the
// pages as iframes. The port (F2) and the regression oracle (F5) read the artboard pages directly,
// so they are unpacked once into tmp/d196-canvas/ (untracked, re-derivable from the committed export):
//   tmp/d196-canvas/<id>.<ext>      every manifest entry, decompressed
//   tmp/d196-canvas/template.html   the board template, page ids rewritten to the local files
//   tmp/d196-canvas/index.json      [{ id, mime, bytes, title, board }] in page order first
//
// Usage: node scripts/d196UnpackCanvas.mjs [export.html] [outDir]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_EXPORT = path.join(ROOT, "docs", "sketches", "Atlas plate system.html");
export const DEFAULT_OUT = path.join(ROOT, "tmp", "d196-canvas");

const EXT = { "text/html": "html", "text/css": "css", "application/javascript": "js", "text/javascript": "js",
  "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "font/woff2": "woff2", "font/woff": "woff",
  "font/ttf": "ttf", "application/json": "json" };

function scriptBody(html, type) {
  const open = `<script type="__bundler/${type}">`;
  const i = html.indexOf(open);
  if (i < 0) return null;
  const j = html.indexOf("</script>", i);
  return html.slice(i + open.length, j).trim();
}

export function unpackCanvas(exportPath = DEFAULT_EXPORT, outDir = DEFAULT_OUT) {
  const html = fs.readFileSync(exportPath, "utf8");
  const manifest = JSON.parse(scriptBody(html, "manifest"));
  const order = JSON.parse(scriptBody(html, "page_order") || "[]");
  let template = JSON.parse(scriptBody(html, "template"));
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  const ids = [...order, ...Object.keys(manifest).filter((k) => !order.includes(k))];
  for (const id of ids) {
    const entry = manifest[id];
    if (!entry) continue;
    let buf = Buffer.from(entry.data, "base64");
    if (entry.compressed) buf = zlib.gunzipSync(buf);
    const ext = EXT[entry.mime] || "bin";
    const file = `${id}.${ext}`;
    fs.writeFileSync(path.join(outDir, file), buf);
    let title = null;
    if (entry.mime === "text/html") {
      const m = buf.toString("utf8").match(/<title>([^<]*)<\/title>/i);
      title = m ? m[1].trim() : null;
    }
    index.push({ id, file, mime: entry.mime, bytes: buf.length, title, page: order.includes(id) });
  }
  // Rewrite page ids in the template to the local files, and font ids anywhere in the pages.
  for (const row of index) template = template.split(row.id).join(row.file);
  fs.writeFileSync(path.join(outDir, "template.html"), template);
  for (const row of index.filter((r) => r.mime === "text/html")) {
    const p = path.join(outDir, row.file);
    let text = fs.readFileSync(p, "utf8");
    for (const other of index) if (other.id !== row.id) text = text.split(other.id).join(other.file);
    fs.writeFileSync(p, text);
  }
  // Each artboard page is itself a bundle (React from a CDN + its own manifest): unpack it into
  // <id>/ the same way, so its source (the JSX / CSS the board renders) is readable.
  for (const row of index.filter((r) => r.mime === "text/html")) {
    const p = path.join(outDir, row.file);
    if (fs.readFileSync(p, "utf8").includes('<script type="__bundler/manifest">')) {
      row.inner = unpackCanvas(p, path.join(outDir, row.id));
    }
  }
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
  return index;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = unpackCanvas(process.argv[2] || DEFAULT_EXPORT, process.argv[3] || DEFAULT_OUT);
  for (const r of index) console.log(`${r.page ? "PAGE" : "    "} ${r.file.padEnd(48)} ${String(r.bytes).padStart(8)}  ${r.title || r.mime}`);
}

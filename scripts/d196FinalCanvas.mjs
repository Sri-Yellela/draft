// ⭐ 47h · THE ORACLE, from the canvas's own sources (A244). The owner approved the whole canvas on 11-25, but its HTML export
// (`docs/sketches/Platesystem Final sketch.html`) carries only the board in view (the explainer storyboard). The canvas
// itself is files: `project/canvas.json` + one `project/<Board>.dc.html` per board, read from the artifact into
// `docs/sketches/final/project/` (the version id is in docs/sketches/final/SOURCE.md). Each board renders standalone in
// Chrome once it is served over http (its runtime fetches the page; `support.js` = the canvas's dc-runtime.js).
//
//   node scripts/d196FinalCanvas.mjs                 → lists the boards
//   node scripts/d196FinalCanvas.mjs serve [port]    → serves them (http://127.0.0.1:<port>/<Board>.dc.html)
//
// d196Regress pairs with `source: "final"` name a board by its file stem (`board: "Market"`) and get it from here.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FINAL_DIR = path.join(ROOT, "docs", "sketches", "final", "project");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };

/** The canvas index: { boards: { "<Board>.dc.html": { title, w, h, … } }, order, … }. */
export function finalIndex() {
  return JSON.parse(fs.readFileSync(path.join(FINAL_DIR, "canvas.json"), "utf8"));
}

/** 47l · boards drawn on the canvas but NOT yet approved (row 4, "awaiting the owner's look"). They are never an oracle:
 *  finalBoards() leaves them out, so no F5 pair can gate against them. Move a stem out of this list when the owner approves it. */
// 47m: the owner approved all nine row-4 boards on 11-27 ("I have reviewed and approved all sketches and mockups") — none pending.
export const PENDING_LOOK = Object.freeze([]);

const onPage = (ix) => ix.order.filter((f) => ix.boards[f]?.page).map((f) => ({ file: f, stem: f.replace(/\.dc\.html$/, ""), ...ix.boards[f] }));

/** The APPROVED boards (retired ones — no `page` in the index — and PENDING_LOOK ones left out), in the canvas's order. */
export function finalBoards() {
  return onPage(finalIndex()).filter((b) => !PENDING_LOOK.includes(b.stem));
}

/** The boards awaiting the owner's look, in the canvas's order. */
export function pendingBoards() {
  return onPage(finalIndex()).filter((b) => PENDING_LOOK.includes(b.stem));
}

let shared = null;
/** One static server for the run (resolves its base URL); a path outside FINAL_DIR is refused. */
export function serveFinal(port = 0) {
  if (shared) return shared;
  shared = new Promise((resolve) => {
    const srv = http.createServer((q, s) => {
      const f = path.resolve(FINAL_DIR, "." + decodeURIComponent(q.url.split("?")[0]));
      if (!f.startsWith(FINAL_DIR + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(s);
    });
    srv.listen(port, "127.0.0.1", () => { srv.unref(); resolve({ base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }); });
  });
  return shared;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "serve") {
    const { base } = await serveFinal(Number(process.argv[3] || 0));
    process.stdin.resume();
    console.log(`serving ${FINAL_DIR} at ${base}`);
  } else for (const b of finalBoards()) console.log(`${b.stem.padEnd(12)} ${String(b.w)}×${b.h}  ${b.title}`);
}

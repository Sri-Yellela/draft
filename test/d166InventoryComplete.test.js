// ⭐ D166 T1 · THE INVENTORY IS COMPLETE — every route in App.jsx, every panel and every full-screen fixed overlay in the
// client is listed in docs/D166_INVENTORY.md, so a new screen can't arrive without being marked current or legacy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const inv = read("docs/D166_INVENTORY.md");

test("d166InventoryComplete: every route in App.jsx is listed", () => {
  const app = read("client/src/App.jsx");
  const routes = [...new Set([...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]))];
  assert.ok(routes.length >= 25, "the route scan found the routes");
  const missing = routes.filter(r => !inv.includes(`\`${r}\``) && !inv.includes(`\`${r} `));
  assert.deepEqual(missing, [], `routes not in docs/D166_INVENTORY.md: ${missing.join(", ")}`);
});

test("d166InventoryComplete: every panel is listed", () => {
  const panels = fs.readdirSync("client/src/panels").filter(f => /\.(jsx|js)$/.test(f)).map(f => f.replace(/\.(jsx|js)$/, ""));
  const missing = panels.filter(p => !inv.includes(p));
  assert.deepEqual(missing, [], `panels not in docs/D166_INVENTORY.md: ${missing.join(", ")}`);
});

test("d166InventoryComplete: every full-screen fixed overlay is listed", () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.jsx$/.test(e.name)) files.push(p);
  } };
  walk("client/src");
  const overlay = /position:\s*"fixed",\s*inset:\s*0|position:"fixed",\s*inset:0/;
  const withOverlay = files.filter(f => overlay.test(read(f))).map(f => path.basename(f, ".jsx"));
  assert.ok(withOverlay.includes("CompanyViewModal"), "the scan finds a known overlay");
  const missing = withOverlay.filter(n => !inv.includes(n));
  assert.deepEqual(missing, [], `full-screen overlays not in docs/D166_INVENTORY.md: ${missing.join(", ")}`);
});

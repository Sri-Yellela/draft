// ⛔ D60 · NO PILLS — the NEAR-capsule. d60NoPills catches a fully rounded shape; this catches the one that is
// not fully rounded and still reads as a capsule: a small control whose radius is a large share of its height.
// The overlay's 28px `.rm-btn` at radius 11 (39%) passed the first guard and was spotted in the v1.5.0 store
// screenshots (10-09). The client's compact depth box is the reference: 9 on 30 (30%).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const MAX_RADIUS_SHARE = 0.3;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name).replace(/\\/g, "/");
  if (e.isDirectory()) return ["node_modules", "submission", "icons"].includes(e.name) ? [] : walk(p);
  return /\.(css|js|html)$/.test(e.name) ? [p] : [];
});

/** Every `selector { … }` block whose own declarations give a px radius and a px height (or min-height). */
export function nearCapsules(source) {
  const out = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    const px = (prop) => { const r = body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+(?:\\.\\d+)?)px`)); return r ? Number(r[1]) : null; };
    const radius = px("border-radius");
    const height = px("height") ?? px("min-height");
    if (radius == null || height == null) continue;
    const width = px("width");
    if (width != null && width === height) continue;              // a square or a circle — d60NoPills' business
    if (radius / height > MAX_RADIUS_SHARE) out.push(`${m[1].trim().split("\n").pop().trim()} — radius ${radius} on ${height} (${Math.round(radius / height * 100)}%)`);
  }
  return out;
}

test("⛔ D60 · no small control in the extension is drawn as a near-capsule (radius > 30% of its height)", () => {
  const offenders = walk("extension").flatMap(f => nearCapsules(fs.readFileSync(f, "utf8")).map(o => `${f}: ${o}`));
  assert.deepEqual(offenders, []);
});

test("⛔ D60 · the near-capsule guard catches the 10-09 shape and passes the client's compact box", () => {
  assert.equal(nearCapsules(".rm-btn { min-height: 28px; border-radius: 11px; }").length, 1);
  assert.equal(nearCapsules(".rm-btn { min-height: 28px; border-radius: 8px; }").length, 0);
  assert.equal(nearCapsules(".dbx--compact { height: 30px; padding: 0 11px; border-radius: 9px; }").length, 0);
  assert.equal(nearCapsules(".dot { width: 10px; height: 10px; border-radius: 5px; }").length, 0, "a circle is d60NoPills' case");
});

// ⭐ D172 (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → the Kafka page) · d172NodePageOneCard — a skill
// or role page is ONE CARD: the name, the definition, one number from the board, your standing, Learn it / Prove it, and
// the nine older sections on demand, one at a time — none dropped. Synthetic nodes; the real component, rendered.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { nodePanes, nodeHeadline, NODE_PANE_LABEL } from "../client/src/pages/atlas/atlasModel.js";

const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { MemoryRouter } from "react-router-dom";
        import { AtlasNodeView } from ${abs("pages/atlas/AtlasPage.jsx")};
        export const card = (node, signedIn = false) => renderToStaticMarkup(h(MemoryRouter, null, h(AtlasNodeView, { base: "/app/atlas", node, signedIn, onWalk: () => {} })));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d172-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

const kafka = {
  slug: "kafka", name: "Kafka", kind: "skill", aliases: ["Apache Kafka"],
  definition: "A log that many systems write to and read from, in order, so data moves reliably between services.",
  onTheBoard: { postings: 1240, computedAt: 1793318400, topRoles: [{ slug: "data-engineer", name: "Data Engineer", share: 0.61 }],
    topSkills: [{ slug: "spark", name: "Spark" }], pay: { n: 12, minUsd: 130000, maxUsd: 190000, medianUsd: 155000 } },
  related: [{ type: "used_with", slug: "flink", name: "Flink" }],
  resources: [{ url: "https://kafka.example/intro", title: "Kafka: introduction", format: "docs", cost: "free" }],
  learn: { stepId: "s-12", label: "Part 3 · Streams · Step 2", title: "Logs and streams" },
  wikipedia: { extract: "Apache Kafka is a distributed event store.", url: "https://en.wikipedia.org/wiki/Apache_Kafka" },
  you: { status: "partial", have: [], missing: [] },
};

test("d172NodePageOneCard: a skill's panes, in the card's order, only when they have something to show", () => {
  assert.deepEqual(nodePanes(kafka).map(p => p.id), ["roles", "pay", "related", "resources", "wikipedia"]);
  assert.deepEqual(nodePanes({ slug: "x", name: "X", kind: "skill" }).map(p => p.id), [], "nothing to show → no buttons");
  assert.deepEqual(nodePanes({ kind: "role", roleBoard: { nextLevel: [{ slug: "a" }] }, sponsors: [{ company: "Acme" }] }).map(p => p.id),
    ["board", "map", "next", "sponsors"], "a role: the board, the map, the next level, sponsors");
  for (const p of nodePanes(kafka)) assert.equal(p.label, NODE_PANE_LABEL[p.id]);
  assert.deepEqual(nodeHeadline(kafka), { value: "1,240", words: "open jobs ask for it" });
  assert.equal(nodeHeadline({ kind: "skill" }), null, "not computed → no number (unknowns omitted)");
});

// ⛔ 47m (changed on purpose): "d172NodePageOneCard: ONE card — the facts and actions first, every pane closed u" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "d172NodePageOneCard: Prove it only for a skill or tool, signed in — never a role" retired — the surface it pinned was rebuilt in the plate system (47m M5).

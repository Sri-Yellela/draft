// The image builds the client BEFORE `COPY . .` (Dockerfile), so every folder outside client/ that the client imports must
// be copied before `RUN cd client && npm run build`. 46m: Ask draft imported content/assistant/commands-v1.json; the local
// build passed (the whole repo is there) and staging's image build failed with "Could not resolve". This keeps it from
// passing locally again.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function filesUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...filesUnder(p)); }
    else if (/\.(jsx?|mjs|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("every path outside client/ that the client imports is copied into the image before the client build", () => {
  const docker = fs.readFileSync(path.join(ROOT, "Dockerfile"), "utf8").replace(/\r\n/g, "\n");
  const buildAt = docker.indexOf("RUN cd client && npm run build");
  assert.ok(buildAt > 0, "the Dockerfile builds the client");
  const copied = [...docker.slice(0, buildAt).matchAll(/^COPY\s+(\S+)\s+\S+/gm)].map(m => m[1].replace(/^\.\//, "").replace(/\/$/, ""));
  const clientDir = path.join(ROOT, "client");
  const needed = new Set();
  for (const f of filesUnder(path.join(clientDir, "src"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g)) {
      const abs = path.resolve(path.dirname(f), m[1]);
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      if (!rel.startsWith("client/") && !rel.startsWith("..")) needed.add(rel);
    }
  }
  const missing = [...needed].filter(rel => !copied.some(c => rel === c || rel.startsWith(`${c}/`))).sort();
  assert.deepEqual(missing, [], `copy these into the image before \`RUN cd client && npm run build\`:\n  ${missing.join("\n  ")}`);
});

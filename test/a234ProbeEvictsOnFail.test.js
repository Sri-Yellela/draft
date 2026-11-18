// A234 (found 11-17, built 46v): test-support/fidelityProbe.mjs kept any answer that was not an error, so a probe measured
// while the machine was loaded (the tracker's phone --bg) was cached wrong and every rerun read it. Now a test process
// that read cached answers and then exits FAILING drops them; a passing one keeps them. Checked here with a cache in a
// temp dir (FIDELITY_CACHE_DIR) and a child `node --test` that reads one seeded answer — no Chrome, no vite.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = path.join(import.meta.dirname, "..");
const PROBE = pathToFileURL(path.join(ROOT, "test-support", "fidelityProbe.mjs")).href;

function run(pass) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a234-"));
  const env = { ...process.env, FIDELITY_CACHE_DIR: dir };
  delete env.NODE_TEST_CONTEXT;   // else the child sees it is inside a test run and skips its files
  // the child computes the tree hash and seeds one answer under it, so both sides agree on the file name
  const child = path.join(dir, "child.test.mjs");
  fs.writeFileSync(child, `
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { probe, PROBES, keyOf, treeHash } from ${JSON.stringify(PROBE)};
const spec = PROBES[0], key = keyOf(spec), file = path.join(process.env.FIDELITY_CACHE_DIR, treeHash() + ".json");
fs.writeFileSync(file, JSON.stringify({ [key]: { seeded: true }, other: { kept: true } }));
fs.writeFileSync(path.join(process.env.FIDELITY_CACHE_DIR, "file.txt"), file + "\\n" + key);
test("reads the seeded answer", () => {
  const a = probe(spec.id, { ...(spec.routes ? { routes: spec.routes } : {}), ...(spec.sizes ? { sizes: spec.sizes } : {}) });
  if (!a.seeded) throw new Error("did not read the seed");
  if (${pass ? "false" : "true"}) throw new Error("this test fails on purpose");
});
`);
  const r = spawnSync(process.execPath, ["--test", child], { cwd: ROOT, env, encoding: "utf8", timeout: 120000 });
  if (!fs.existsSync(path.join(dir, "file.txt"))) throw new Error(`the child did not start:\n${r.stdout}\n${r.stderr}`);
  const [file, key] = fs.readFileSync(path.join(dir, "file.txt"), "utf8").split("\n");
  const cache = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: r.status, cache, key };
}

test("A234 · a failing test process drops the cached answers it read; others stay", () => {
  const { status, cache, key } = run(false);
  assert.notEqual(status, 0, "the child failed on purpose");
  assert.equal(key in cache, false, "the answer the failing test read is gone");
  assert.deepEqual(cache.other, { kept: true }, "an answer it did not read is kept");
});

test("A234 · a passing test process keeps them", () => {
  const { status, cache, key } = run(true);
  assert.equal(status, 0);
  assert.deepEqual(cache[key], { seeded: true });
});

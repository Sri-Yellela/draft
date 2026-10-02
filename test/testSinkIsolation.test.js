import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sinkPath } from "../services/trackingFailureSink.js";

// 10-02 (18): every `npm test` appended ~109 fake tracking failures to the developer's real
// data/usage-tracking-failures.jsonl, and a local boot drained them into the real database. See
// test-support/isolateTrackingSink.mjs.

const REPO_SINK = path.resolve("data", "usage-tracking-failures.jsonl");

test("npm test preloads the sink isolation into every test process", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.match(pkg.scripts.test, /--import \.\/test-support\/isolateTrackingSink\.mjs/);
  assert.ok(fs.existsSync("test-support/isolateTrackingSink.mjs"));
});

test("inside a test process the sink is NOT the repository's data/ file", () => {
  // Run without the preload (a bare `node --test`) this fails, which is the point: it says why.
  assert.notEqual(path.resolve(sinkPath()), REPO_SINK,
    "this process would write fake failures into the developer's real sink — run tests via npm test");
  assert.ok(path.resolve(sinkPath()).startsWith(path.resolve(os.tmpdir())));
});

test("the default sink follows RM_DATA_DIR, as the database does", () => {
  const saved = { sink: process.env.USAGE_FAILURE_SINK_PATH, dir: process.env.RM_DATA_DIR };
  try {
    delete process.env.USAGE_FAILURE_SINK_PATH;
    process.env.RM_DATA_DIR = path.join(os.tmpdir(), "throwaway-db");
    assert.equal(sinkPath(), path.join(os.tmpdir(), "throwaway-db", "usage-tracking-failures.jsonl"));
    delete process.env.RM_DATA_DIR;
    assert.equal(path.resolve(sinkPath()), REPO_SINK, "unset, it is the server's default data/");
  } finally {
    if (saved.sink) process.env.USAGE_FAILURE_SINK_PATH = saved.sink; else delete process.env.USAGE_FAILURE_SINK_PATH;
    if (saved.dir) process.env.RM_DATA_DIR = saved.dir; else delete process.env.RM_DATA_DIR;
  }
});

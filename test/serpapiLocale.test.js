import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import serpapiPlugin from "../services/jobs/sources/serpapi.js";

// D4 addendum (10-03): a google_jobs call without hl/gl comes back localised to the caller's
// guessed locale — the owner's came back as hl=es-419, locations "Estados Unidos", dates
// "hace 18 horas". Every ingested location string would then be in the wrong language, which
// silently defeats the US-only gate (A37). The plugin has sent hl=en&gl=us since e68a3f4; these
// pin it, and pin that no second call site appears without it.

test("⛔ every google_jobs call is pinned to English and the US (hl=en, gl=us)", async () => {
  const savedKey = process.env.SERPAPI_KEY;
  const savedGet = axios.get;
  let seen = null;
  process.env.SERPAPI_KEY = "test-key";
  axios.get = async (url, opts) => { seen = { url, params: opts?.params }; return { data: { jobs_results: [] } }; };
  try {
    await serpapiPlugin.search({ query: "software engineer", location: "United States" });
  } finally {
    axios.get = savedGet;
    if (savedKey === undefined) delete process.env.SERPAPI_KEY; else process.env.SERPAPI_KEY = savedKey;
  }
  assert.ok(seen, "the plugin made no request");
  assert.equal(seen.params.engine, "google_jobs");
  assert.equal(seen.params.hl, "en");
  assert.equal(seen.params.gl, "us");
});

test("⛔ no other code calls serpapi.com — a second call site would not inherit hl/gl", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "dist", ".git", "data", "test", "docs"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(c|m)?jsx?$/.test(e.name) && fs.readFileSync(p, "utf8").includes("serpapi.com/search")) {
        hits.push(path.relative(root, p).split(path.sep).join("/"));
      }
    }
  };
  for (const d of ["services", "routes", "scripts", "shared"]) walk(path.join(root, d));
  if (fs.readFileSync(path.join(root, "server.js"), "utf8").includes("serpapi.com/search")) hits.push("server.js");
  assert.deepStrictEqual(hits, ["services/jobs/sources/serpapi.js"]);
});

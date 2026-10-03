// D17 (owner, 2026-10-03): ONLY RÉSUMÉ GENERATION MAY CALL A MODEL. Everything else is in-house or a
// manual export → import path.
//
// This test is the ratchet that holds that rule in PRODUCTION code (server.js, routes/, services/,
// shared/). Every `callModel({ … purpose: "x" … })` found there must be either
//
//   ALLOWED      — the generation family (résumé generation itself runs in the tools service; what
//                  draft still calls directly is the cover letter), or
//   KNOWN        — a violation already logged in WORKLOG row A80, still waiting to be fixed.
//
// The set found must EQUAL allowed ∪ known. A new model call fails it (D17 forbids adding one), and
// fixing a known violation fails it too until the entry is deleted below — so the list can only
// shrink, and it always says exactly what is left.
//
// And no file but services/modelCall.js may talk to the SDK directly: a direct
// `anthropic.messages.create` would walk round this whole check.
//
// Scripts are deliberately out of scope here (A80 V8–V12 are one-off tools, decided separately).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ALLOWED = new Set([
  "cover_letter",        // /api/cover-letter/generate — the generation family
  "cover_letter_apply",  // the apply path's cover letter — the generation family
]);

// Each entry names its A80 item. Delete the entry in the same commit that removes the call.
const KNOWN_VIOLATIONS = new Map([
  ["enrich_job",     "A80 V4 — enrichment (the automatic triggers)"],
  ["domain_chips",   "A80 V3 — /api/domain-profiles/generate-chips"],
  ["import_job",     "A80 V5 — capture/paste extraction"],
  ["classifier",     "A80 V6 — /api/smart-search sends the résumé to a classifier"],
]);

function productionFiles() {
  const out = ["server.js"];
  for (const dir of ["routes", "services", "shared"]) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(m?js)$/.test(e.name)) out.push(p);
      }
    };
    walk(dir);
  }
  return out;
}

/** Every purpose passed to callModel in a source string. */
export function modelPurposes(src) {
  const found = [];
  for (const m of src.matchAll(/callModel\(\{/g)) {
    const window = src.slice(m.index, m.index + 400);
    const p = window.match(/purpose:\s*["']([a-z_0-9]+)["']/);
    found.push(p ? p[1] : "<no literal purpose>");
  }
  return found;
}

test("D17: production code calls a model only for generation, or for a violation A80 already names", () => {
  const found = new Map();
  for (const file of productionFiles()) {
    if (file.replace(/\\/g, "/") === "services/modelCall.js") continue; // the definition, not a call
    const src = fs.readFileSync(file, "utf8");
    for (const purpose of modelPurposes(src)) {
      if (!found.has(purpose)) found.set(purpose, []);
      found.get(purpose).push(file.replace(/\\/g, "/"));
    }
  }
  const unexpected = [...found.keys()].filter(p => !ALLOWED.has(p) && !KNOWN_VIOLATIONS.has(p));
  assert.deepEqual(unexpected, [],
    "D17 forbids a model call outside résumé generation. New call site(s):\n" +
    unexpected.map(p => `  ${p}: ${found.get(p).join(", ")}`).join("\n"));
  const fixed = [...KNOWN_VIOLATIONS.keys()].filter(p => !found.has(p));
  assert.deepEqual(fixed, [],
    "These A80 violations no longer call a model — delete them from KNOWN_VIOLATIONS so the list " +
    "stays exact:\n" + fixed.map(p => `  ${p}: ${KNOWN_VIOLATIONS.get(p)}`).join("\n"));
});

test("D17: no production file but services/modelCall.js talks to the model SDK directly", () => {
  const offenders = productionFiles()
    .filter(f => f.replace(/\\/g, "/") !== "services/modelCall.js")
    .filter(f => /\.messages\.(create|stream)\s*\(/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(offenders, [], "a direct SDK call bypasses callModel and this whole check");
});

test("D17 V7: the dead classify_job model call stays deleted", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.ok(!/async function classifyJob\(/.test(src), "server.js defines a model classifyJob again");
  assert.ok(!/purpose:\s*["']classify_job["']/.test(src));
});

test("D17 V2: /api/standalone/generate scores its résumé with the deterministic scorer, no model", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const start = src.indexOf('app.post("/api/standalone/generate"');
  const end = src.indexOf("// POST /api/standalone/apply", start);
  assert.ok(start > 0 && end > start, "the route moved — re-anchor this test");
  const route = src.slice(start, end);
  assert.match(route, /standaloneAtsResult\(/, "the generated résumé is scored by the public tool's scorer");
  assert.match(route, /res\.json\(\{ html, ats \}\)/, "the answer is a band report, no number");
  // The résumé itself is generated by the tools service (the one allowed model use); this route
  // makes no model call of its own.
  assert.doesNotMatch(route, /callModel\(|ATS_SYSTEM_PROMPT/);
  const page = fs.readFileSync("client/src/pages/tools/GenerateToolPage.jsx", "utf8");
  assert.match(page, /result\.ats\?\.band/, "the page reads the band the server sends");
  assert.doesNotMatch(page, /result\.atsScore/);
});

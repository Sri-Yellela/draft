// ⛔⛔ D162 G1 · d162NoFeatureNamesAModel — a lint: no shipped feature names a model.
//
// Every model call names a TASK (shared/modelTasks.js); the model comes from the task's route. A model id written into a
// feature is how a switch stops being a configuration change — and how the 2026-06 outage happened (a bump updated 8 of
// ~20 inline literals; shared/anthropicModels.js tells it). This scans the shipped tree for:
//   · a model-id string literal — "claude-…", "gpt-4…", "gemini-1…", "llama-3…", "mistral-…", "qwen2…", "deepseek-…",
//     "nemotron…", "gemma-2…"
//   · the model constants MODEL_HAIKU / MODEL_SONNET / MODEL_OPUS
//   · a `model: "…"` property with a literal value
// outside the registry and the model catalogue: shared/modelTasks.js and shared/anthropicModels.js. Comments are
// stripped first (files that explain the history name what they no longer use). Scripts are offline harnesses and are
// held by test/d17ModelCallSites.test.js's script ratchet instead; tests are not shipped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["server.js", "routes", "services", "shared", "client/src", "extension", "apply-worker", "crawler", "packages"];
const ALLOWED = new Set(["shared/modelTasks.js", "shared/anthropicModels.js",
  // 46x · D192 (4d): the plausibility check's TECH_FIRST_YEAR names "GPT-4" as a TECHNOLOGY a résumé may list (it came out in
  // 2023, so a role that ended before then cannot have used it) — vocabulary for a lookup, never a model to call. Nothing else.
  "packages/ats-scorer/src/plausibility.js"]);

export const MODEL_SHAPES = [
  { name: "model id literal",
    re: /["'`](claude-[a-z0-9]|gpt-[0-9]|o[134]-(mini|preview)|gemini-[0-9]|llama-?[0-9]|mistral-[a-z0-9]|mixtral|qwen[0-9]|deepseek-[a-z0-9]|nemotron|gemma-?[0-9])[A-Za-z0-9.:_/-]*["'`]/i },
  { name: "model constant", re: /\bMODEL_(HAIKU|SONNET|OPUS)\b/ },
  { name: "literal model property", re: /\bmodel\s*:\s*["'`][A-Za-z][A-Za-z0-9.:_/-]{2,}["'`]/ },
];

/** Code only: block comments, then line comments (`[^:]` keeps URLs — test/modelCallGuard.test.js records why). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
  .split(/\r?\n/).map(l => l.replace(/(^|[^:])\/\/.*$/, "$1"));

function walk(p, acc = []) {
  if (!fs.existsSync(p)) return acc;
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.(m?js|cjs|jsx)$/.test(p)) acc.push(p.split(path.sep).join("/")); return acc; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (/^(node_modules|dist|build|coverage|\.git|test|__tests__)$/.test(e.name)) continue;
    walk(path.join(p, e.name), acc);
  }
  return acc;
}

export function scan(files) {
  const hits = [];
  for (const f of files) {
    if (ALLOWED.has(f)) continue;
    codeOf(fs.readFileSync(f, "utf8")).forEach((line, i) => {
      for (const s of MODEL_SHAPES) {
        const m = line.match(s.re);
        if (m) hits.push(`${f}:${i + 1}  (${s.name}: ${m[0]})`);
      }
    });
  }
  return hits;
}

const shipped = () => ROOTS.flatMap(r => walk(r));

test("⛔ D162 d162NoFeatureNamesAModel: no shipped file outside the registry names a model", () => {
  const files = shipped();
  assert.ok(files.includes("server.js") && files.includes("routes/domainProfiles.js") && files.includes("client/src/App.jsx"),
    "the walk no longer reaches the shipped tree — fix the walk, not the finding");
  const hits = scan(files);
  assert.deepEqual(hits, [],
    "A feature names a model. Name a task instead (shared/modelTasks.js) and call callTask (services/modelGateway.js);\n" +
    "the model belongs in the task's route:\n" + hits.map(h => `  ${h}`).join("\n"));
});

const INJECT_DIR = "services/__d162_injection__";
function injectAndScan(line) {
  const file = `${INJECT_DIR}/feature.js`;
  fs.mkdirSync(INJECT_DIR, { recursive: true });
  fs.writeFileSync(file, `export async function feature(x) {\n  ${line}\n}\n`);
  try {
    const files = shipped();
    assert.ok(files.includes(file), "the walk did not reach the injected file");
    return scan([file]);
  } finally { fs.rmSync(INJECT_DIR, { recursive: true, force: true }); }
}

test("D162 the lint is seen to fail on each shape, and ignores the ones it must", () => {
  const caught = [
    // Split so this test file's own text is not a literal model id.
    `const m = "claude-" + "x"; await callModel({ model: "claude-haiku-4-5" });`,
    `const id = 'gpt-4o-mini';`,
    "const id = `llama-3.1-8b-instant`;",
    `import { MODEL_HAIKU } from "../shared/anthropicModels.js";`,
    `await send({ model: "my-open-model", max_tokens: 10 });`,
    `const fallback = "gemini-1.5-flash";`,
  ];
  for (const line of caught) assert.ok(injectAndScan(line).length >= 1, `not caught: ${line}`);
  const ignored = [
    `// MODEL_HAIKU was the cover letter's model before D162 — "claude-haiku-4-5"`,
    `await callTask({ task: "cover_letter.write", messages });`,
    `const label = "Claude Haiku (fastest, cheapest)";`,
    `const choice = "haiku";`,
    `await callModel({ ...rest, model: target.model });`,
    `const shortModel = m => m.replace("claude-", "");`,
  ];
  for (const line of ignored) assert.deepEqual(injectAndScan(line), [], `false positive: ${line}`);
});

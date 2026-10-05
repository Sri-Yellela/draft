// A87 (10-05) — ANTHROPIC IS THE ONLY MODEL PROVIDER, AND THIS FILE KEEPS IT THAT WAY.
//
// The Groq/Gemini stack (shared/modelProviders.js, services/providerTransport.js, the
// ENRICH_PROVIDER / ENRICH_MODEL / GROQ_API_KEY / GOOGLE_API_KEY switches) existed to route PUBLIC
// job-advert text to a free tier. D17 deleted every PUBLIC model call, the stack outlived them with
// no traffic, and A87 deleted it. This ratchet fails if any of it — or any other non-Anthropic
// provider — comes back:
//
//   1. the two deleted modules stay deleted;
//   2. no shipped code (server.js, routes/, services/, shared/, scripts/, client/src/, packages/,
//      extension/) names a non-Anthropic provider's API-key env var, the retired routing switches,
//      a provider SDK, or a provider API host;
//   3. no package.json depends on a provider SDK, and .env.example documents none of the env vars;
//   4. callModel has one transport — the Anthropic SDK — and DATA_CLASS has no route-only class.
//
// Comments are stripped before scanning: the files that explain the deletion name what was deleted.
// Tests are not scanned (they set the old env vars on purpose, to prove they do nothing).
//
// Re-adding a provider is a D17 decision first (only résumé generation may call a model at all) and
// an edit to this file second — never a quiet new module.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DELETED_MODULES = ["shared/modelProviders.js", "services/providerTransport.js"];

const SHIPPED_ROOTS = ["server.js", "routes", "services", "shared", "scripts", "client/src", "packages", "extension"];

// Each entry: what it is, and the pattern. The patterns are exported to the injection test below
// through `findings`, so a narrowed regex fails there, not just here.
export const FORBIDDEN = [
  { name: "retired routing switch", re: /\bENRICH_(PROVIDER|MODEL)\b/ },
  { name: "non-Anthropic API key",
    re: /\b(GROQ|GEMINI|GOOGLE|OPENAI|MISTRAL|COHERE|TOGETHER|SAMBANOVA|FIREWORKS|DEEPSEEK|OPENROUTER|XAI|PERPLEXITY)_API_KEY\b/ },
  { name: "provider SDK import",
    re: /(from\s+|require\(\s*|import\(\s*)["'](openai|groq-sdk|@google\/(genai|generative-ai)|@mistralai\/[\w-]+|cohere-ai|together-ai|ollama)["']/ },
  { name: "provider API host",
    re: /(api\.groq\.com|generativelanguage\.googleapis\.com|api\.openai\.com|api\.mistral\.ai|api\.cohere\.(ai|com)|api\.together\.xyz|api\.sambanova\.ai|api\.fireworks\.ai|api\.deepseek\.com|openrouter\.ai\/api)/ },
];

/** Code only. `[^:]` keeps `https://` intact (the same fix test/modelCallGuard.test.js records). */
export function codeOf(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/).map(l => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

/** Every forbidden shape in `src`, as "name: match". */
export function findings(src) {
  const code = codeOf(src);
  return FORBIDDEN.filter(f => f.re.test(code)).map(f => `${f.name}: ${code.match(f.re)[0]}`);
}

function walk(p, acc = []) {
  if (!fs.existsSync(p)) return acc;
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.(m?js|cjs|jsx|tsx?)$/.test(p)) acc.push(p.split(path.sep).join("/")); return acc; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (/^(node_modules|dist|build|coverage|\.git)$/.test(e.name)) continue;
    walk(path.join(p, e.name), acc);
  }
  return acc;
}

export function shippedFiles() {
  return SHIPPED_ROOTS.flatMap(r => walk(r));
}

test("A87: the Groq/Gemini modules stay deleted", () => {
  for (const f of DELETED_MODULES) assert.equal(fs.existsSync(f), false, `${f} is back`);
});

test("A87: no shipped code names a non-Anthropic provider — env var, SDK, host or routing switch", () => {
  const files = shippedFiles();
  assert.ok(files.includes("services/modelCall.js") && files.includes("client/src/App.jsx"),
    "the walk no longer reaches the shipped tree — fix the walk, not the finding");
  const offenders = [];
  for (const f of files) {
    for (const hit of findings(fs.readFileSync(f, "utf8"))) offenders.push(`${f} — ${hit}`);
  }
  assert.deepEqual(offenders, [],
    "Anthropic is the only model provider (A87). Found:\n" + offenders.map(o => `  ${o}`).join("\n"));
});

test("A87: no package depends on a provider SDK, and .env.example documents no provider key", () => {
  const sdk = /^(openai|groq-sdk|@google\/(genai|generative-ai)|@mistralai\/[\w-]+|cohere-ai|together-ai|ollama)$/;
  const manifests = ["package.json", "client/package.json",
    ...fs.readdirSync("packages").map(p => `packages/${p}/package.json`).filter(p => fs.existsSync(p))];
  const deps = [];
  for (const m of manifests) {
    const pkg = JSON.parse(fs.readFileSync(m, "utf8"));
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[field] || {})) if (sdk.test(name)) deps.push(`${m} ${field}: ${name}`);
    }
  }
  assert.deepEqual(deps, [], "a provider SDK is a dependency again");

  // .env.example is not code, so it is matched line by line, comments included: a commented-out
  // `# GROQ_API_KEY=` is still an instruction to set one.
  const env = fs.readFileSync(".env.example", "utf8");
  const envHits = FORBIDDEN.slice(0, 2).filter(f => f.re.test(env)).map(f => env.match(f.re)[0]);
  assert.deepEqual(envHits, [], ".env.example documents a retired provider variable again");
});

test("A87: callModel has one transport — the Anthropic SDK — and DATA_CLASS no route-only class", async () => {
  const src = codeOf(fs.readFileSync("services/modelCall.js", "utf8"));
  assert.doesNotMatch(src, /\bfetch\s*\(|callProvider|routeFor|resolveProvider|process\.env\[/,
    "services/modelCall.js reaches something other than the Anthropic SDK");
  assert.equal((src.match(/\.messages\.create\s*\(/g) || []).length, 1, "exactly one model call, the SDK's");
  const mod = await import("../services/modelCall.js");
  assert.deepEqual(Object.keys(mod.DATA_CLASS).sort(), ["CANDIDATE", "TOKENIZED"],
    "a DATA_CLASS member was added — PUBLIC existed only to be routed off Anthropic");
  for (const gone of ["routeFor", "resetRoutingWarnings"]) assert.equal(mod[gone], undefined, `${gone} is exported again`);
});

test("A87: the scan catches each forbidden shape, and ignores the ones it must", () => {
  // The guard is seen to fail on every shape here; the whole-tree injection was also run by hand
  // (see the A87 commit). Each line is what a re-introduction would actually look like.
  const caught = [
    ["retired routing switch", `const p = process.env.ENRICH_PROVIDER;`],
    ["retired routing switch", `if (env.ENRICH_MODEL) pin(env.ENRICH_MODEL);`],
    ["non-Anthropic API key",  `const key = process.env.GROQ_API_KEY;`],
    ["non-Anthropic API key",  `headers["x-goog-api-key"] = process.env.GOOGLE_API_KEY;`],
    ["non-Anthropic API key",  `new OpenAI({ apiKey: process.env.OPENAI_API_KEY });`],
    ["provider SDK import",    `import OpenAI from "openai";`],
    ["provider SDK import",    `const Groq = require("groq-sdk");`],
    ["provider SDK import",    `import { GoogleGenAI } from "@google/genai";`],
    // Hosts are split so test/modelCallGuard.test.js, which scans test files too, does not read this
    // fixture as a real untracked call (it must not grow an exemption for it either).
    ["provider API host",      "await fetch('https://api." + "groq.com/openai/v1/chat/completions', init);"],
    ["provider API host",      "await fetch(`https://generativelanguage." + "googleapis.com/v1beta/models/${m}`);"],
  ];
  for (const [name, line] of caught) {
    const hit = findings(line);
    assert.equal(hit.length, 1, `not caught: ${line}`);
    assert.ok(hit[0].startsWith(name), `caught as the wrong shape: ${hit[0]}`);
  }
  const ignored = [
    `// ENRICH_PROVIDER and GROQ_API_KEY were deleted by A87.`,
    `/* services/providerTransport.js called https://api.groq.com */`,
    `const logos = { groq: "groq.com", openai: "openai.com" };`,
    `const id = process.env.GOOGLE_CLIENT_ID;`,
    `import Anthropic from "@anthropic-ai/sdk";`,
  ];
  for (const line of ignored) assert.deepEqual(findings(line), [], `false positive: ${line}`);
});

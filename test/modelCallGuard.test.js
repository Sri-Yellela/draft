// The half that keeps cost coverage from rotting.
//
// An audit found 4 of 14 model call sites recorded usage. The other 10 — including one call PER
// JOB across hundreds of enrichment rows, and three UNAUTHENTICATED standalone endpoints — spent
// real money and logged nothing, so the admin cost panel showed a confident total that omitted
// most of the traffic. A wrapper alone would have rotted the same way the hardcoded model IDs
// did: the fix was applied once, and the next call site added went straight back to the raw SDK.
//
// This guard fails the build when that happens.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const WRAPPER = "services/modelCall.js";
// A87 (10-05): there is no second module allowed to speak a provider's wire protocol. The Groq/Gemini
// transport (services/providerTransport.js) and its catalog (shared/modelProviders.js) were deleted,
// and with them their two exemptions from this scan. The hostname shapes below stay: a fetch to a
// provider host is still the shape an untracked call would take, for any provider.
// This file quotes the forbidden calls inside its own failure message and its injection fixtures,
// so it must not scan itself. Every OTHER test file is still scanned — a test that calls a
// provider directly is a real untracked call site, not an exemption.
const SELF = "test/modelCallGuard.test.js";
const ALLOWED = new Set([WRAPPER, SELF]);

// ── THE SCAN ────────────────────────────────────────────────────────────────────────────────────
//
// DEFINED ONCE, and used both by the guard below and by the injection test beneath it. It was
// previously written out twice — once as the live scan, once as a copy inside the test that checks
// the scan's coverage — which means the copy could agree with itself while the live one narrowed.
//
// WHY THIS IS BROADER THAN "anthropic.messages.create". The cost-tracking guarantee is that no
// model call happens without a usage_events row. A guard that only knows Anthropic's SDK shape
// enforces that guarantee only for Anthropic: the moment a call site reaches for Groq's
// OpenAI-compatible endpoint or Gemini's `generateContent`, it bypasses the wrapper entirely and
// the suite stays green. That is the same defect the batch shape already demonstrated — the old
// /\.messages\.create\s*\(/ could not see `messages.batches.create` — one provider over.
const PROVIDER_CALL_SHAPES = [
  // Anthropic SDK, including the Batch API. ".messages.create" is not a substring of
  // ".messages.batches.create", which is why the optional group is here and not a looser regex.
  { name: "anthropic sdk", re: /\.messages\.(batches\.)?(create|results)\s*\(/ },
  // OpenAI-compatible SDKs — this is Groq's entire interface, and SambaNova's, and any
  // `new OpenAI({ baseURL })` swap. Covers both the chat and the responses surfaces.
  { name: "openai-compatible sdk", re: /\.(chat\.)?completions\.create\s*\(/ },
  { name: "openai responses sdk", re: /\.responses\.create\s*\(/ },
  // Google GenAI, both the streaming and non-streaming entry points.
  { name: "google genai sdk", re: /\.generateContent(Stream)?\s*\(/ },
  // RAW HTTP TO A PROVIDER HOST. The one that actually matters here: this repo adds no SDK for
  // Groq or Gemini, so an untracked call would not look like an SDK method at all — it would look
  // like a fetch. Hostnames rather than paths, because the path varies per provider.
  {
    name: "direct http to a provider",
    re: /(api\.anthropic\.com|api\.groq\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.sambanova\.ai|api\.cohere\.(ai|com)|api\.mistral\.ai|api\.together\.xyz)/,
  },
];

/** True if `code` contains any provider call shape; returns the shape that matched. */
function providerCallIn(code) {
  return PROVIDER_CALL_SHAPES.find(s => s.re.test(code)) || null;
}

/** Every tracked .js/.jsx file, excluding deps, build output and the wrapper itself. */
function sourceFiles(dir = ".", acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // .claude holds agent git WORKTREES — whole second copies of this repo. Walking into one reported
    // every model call in the codebase twice, from a path no deploy ever ships (09-29).
    if (/^(node_modules|\.git|\.claude|dist|build|coverage|\.cinematic)$/.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.(js|mjs|jsx)$/.test(entry.name)) acc.push(full.split(path.sep).join("/"));
  }
  return acc;
}

/**
 * The live scan, factored out so the INJECTION test below drives this exact function rather than a
 * re-implementation of it. The previous coverage test asserted against a private copy of the
 * regex, which could have agreed with itself while the real guard narrowed.
 */
function scanForProviderCalls(files) {
  const offenders = [];
  for (const file of files) {
    if (ALLOWED.has(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      // Ignore comments — several files legitimately explain why they no longer call it directly.
      //
      // `[^:]` IS LOAD-BEARING AND WAS FOUND BY THE INJECTION TEST BELOW. A bare /\/\/.*$/ strips
      // from the first `//` on the line, and `https://api.groq.com/...` contains one — so every
      // direct-HTTP provider call was being erased as a "comment" before the scan ever saw it,
      // and the shape that matters most here (no Groq/Gemini SDK is installed, so a bypass IS a
      // fetch) was silently unguardable. Requiring the character before `//` not to be a colon
      // keeps URLs intact while still stripping real comments.
      const code = line.replace(/(^|[^:])\/\/.*$/, "$1").replace(/\/\*.*?\*\//g, "");
      const shape = providerCallIn(code);
      if (shape) offenders.push(`${file}:${i + 1}  (${shape.name})`);
    });
  }
  return offenders;
}

test("no model call by ANY provider outside the wrapper", () => {
  const offenders = scanForProviderCalls(sourceFiles());
  assert.deepEqual(
    offenders, [],
    "These call a model without recording what it cost:\n" +
    offenders.map(o => `  ${o}`).join("\n") +
    `\n\nFIX: import { callModel } from '${WRAPPER}' (adjust the relative path) and replace\n` +
    "      await anthropic.messages.create({ model, ...params })\n" +
    "  with\n" +
    "      await callModel({ anthropic, db, purpose: 'some_feature', userId, model, ...params })\n" +
    "  `purpose` is a stable snake_case feature name and is REQUIRED — it is how spend is\n" +
    "  attributed to a feature rather than only to a model. For background work with no user in\n" +
    "  scope, pass userId: SYSTEM_USER_ID from the same module.\n" +
    "  Do NOT add an exemption here: an untracked call site is exactly the defect this guards."
  );
});

// ── THE GUARD IS SEEN TO FAIL ───────────────────────────────────────────────────────────────────
//
// A guard nobody has watched fail is not evidence. The scan above is a regex over source text, so
// its COVERAGE is a property of the regex and of the file walk that feeds it — and the previous
// version of this test checked only a private copy of the regex, never the walk, and never the
// live function. It therefore could not have caught the case that motivated it: a scan that agrees
// with its own copy while the real one narrows.
//
// So: write a real violating file into the real tree, run the REAL scan, and require it to be
// caught. One case per provider shape, because a provider added later is exactly when this stops
// holding — a Groq call bypasses an Anthropic-only guard completely, with the suite green.
const INJECT_DIR = "test/__guard_injection__";

/** Writes `line` into a real .js file inside the scanned tree and returns the live scan's verdict. */
function injectAndScan(line) {
  const file = path.join(INJECT_DIR, "violation.js");
  fs.mkdirSync(INJECT_DIR, { recursive: true });
  fs.writeFileSync(file, `export async function untracked(client) {\n  ${line}\n}\n`);
  try {
    const files = sourceFiles();
    const normalized = file.split(path.sep).join("/");
    assert.ok(files.includes(normalized), `the file WALK did not reach ${normalized}`);
    return scanForProviderCalls(files).filter(o => o.startsWith(normalized));
  } finally {
    fs.rmSync(INJECT_DIR, { recursive: true, force: true });
  }
}

test("an injected call is CAUGHT, for every provider shape", () => {
  // One per shape in PROVIDER_CALL_SHAPES, plus the Anthropic variants that have bitten before.
  const violations = [
    ["anthropic sdk",              "const m = await client.messages.create({ model });"],
    ["anthropic sdk",              "const m = await client.beta.messages.create({ model });"],
    ["anthropic sdk",              "const b = await client.messages.batches.create({ requests });"],
    ["anthropic sdk",              "for await (const r of client.messages.batches.results(id)) {}"],
    // Groq is OpenAI-compatible, so this is the literal shape a base-URL swap produces.
    ["openai-compatible sdk",      "const m = await groq.chat.completions.create({ model });"],
    ["openai-compatible sdk",      "const m = await client.completions.create({ model });"],
    ["openai responses sdk",       "const m = await client.responses.create({ model });"],
    ["google genai sdk",           "const m = await model.generateContent(prompt);"],
    ["google genai sdk",           "const s = await client.models.generateContentStream(req);"],
    // The one that matters most here: no Groq/Gemini SDK is installed, so a real bypass would be
    // a bare fetch, which no SDK-shaped regex can see.
    ["direct http to a provider",  "const r = await fetch('https://api.groq.com/openai/v1/chat/completions', init);"],
    ["direct http to a provider",  "const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`);"],
    ["direct http to a provider",  "const r = await fetch('https://api.anthropic.com/v1/messages', init);"],
  ];
  for (const [shape, line] of violations) {
    const caught = injectAndScan(line);
    assert.equal(caught.length, 1, `the guard did NOT catch an untracked call site: ${line}`);
    assert.match(caught[0], new RegExp(shape.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `caught, but attributed to the wrong shape: ${caught[0]}`);
  }
});

test("the scan does not fire on unrelated code", () => {
  // Must not false-positive, or the guard becomes noise and grows exemptions — and an exemption
  // list is how the original four-of-fourteen coverage gap was lived with.
  const mustIgnore = [
    "const messages = buildMessages();",
    "db.prepare('SELECT * FROM messages').all();",
    "await client.messages.countTokens({ messages });",
    "batches.push(job);",
    "const completions = [];",
    "const html = await fetch('https://boards.greenhouse.io/acme');",
  ];
  for (const line of mustIgnore) {
    assert.deepEqual(injectAndScan(line), [], `the scan false-positives on: ${line}`);
  }
});

// A4 — ONE LOGGED PATH PER CALLER. The rule was "only callModel records usage", and it stands for
// every model call DRAFT makes. The tools service's calls are made by ANOTHER service; draft learns
// of them only from the usage records in its response, and callModel cannot record a call it did
// not make. So services/toolsService.js is the one second path — and only on the condition asserted
// below, that it never makes a model call of its own.
const TOOLS_CLIENT = "services/toolsService.js";

test("the tools-service client records only calls it did not make — it makes none itself", () => {
  const src = fs.readFileSync(TOOLS_CLIENT, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /messages\.(create|batches)|callModel\s*\(|@anthropic-ai\/sdk/,
    "services/toolsService.js reaches for a model — that call must go through callModel, not be recorded here");
  assert.match(src, /trackApiCall\(db,/, "and it is the path the tools service's usage records reach usage_events by");
});

test("the wrapper is the only thing importing trackApiCall (plus the tools-service client, for calls it did not make)", () => {
  // Two paths to the same table is how the four 'tracked' sites drifted from the other ten.
  const offenders = [];
  for (const file of sourceFiles()) {
    if (file === WRAPPER || file === TOOLS_CLIENT || file.startsWith("test/")) continue;
    const src = fs.readFileSync(file, "utf8");
    if (/import\s*\{[^}]*\btrackApiCall\b[^}]*\}\s*from/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [],
    "trackApiCall must be called only by services/modelCall.js so there is ONE logged path.\n" +
    "Route the call through callModel instead of tracking it separately.");
});

test("every callModel invocation passes a purpose", () => {
  // A call recorded without a purpose is spend that cannot be attributed to a feature.
  const missing = [];
  for (const file of sourceFiles()) {
    if (file === WRAPPER || file.startsWith("test/")) continue;
    const src = fs.readFileSync(file, "utf8");
    // Each call's argument object, up to the model line — purpose is written adjacent to it.
    // Inspect the whole argument window, not just the text before `model`: key order is a style
    // choice, and a site writing `{ anthropic, db, model, purpose }` is perfectly correct.
    for (const m of src.matchAll(/callModel\(\{([\s\S]{0,600})/g)) {
      // Accept property shorthand (`{ purpose }`) as well as `purpose: '…'` — otherwise a
      // perfectly good call site that forwards a `purpose` variable fails this guard.
      if (!/\bpurpose\s*[:,}]/.test(m[1])) {
        missing.push(`${file}: callModel({...}) near "${m[1].trim().slice(0, 60)}"`);
      }
    }
  }
  assert.deepEqual(missing, [],
    "callModel requires a `purpose`:\n" + missing.map(x => `  ${x}`).join("\n"));
});

// (A87, 10-05) "the provider catalog is data — it makes no network call at all" and "only the
// transport reads a provider base URL" retired with the two files they policed —
// shared/modelProviders.js and services/providerTransport.js; test/a87AnthropicOnly.test.js keeps them
// deleted. With them gone, the scan above has no exemption but this file itself.

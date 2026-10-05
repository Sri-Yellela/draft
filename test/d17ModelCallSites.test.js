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
// Scripts (scripts/) are held by a second, file-level ratchet at the bottom of this file
// (A80 V8–V12): a script may reach a model only if it is the generation family or a named A80 item.

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
  // V4 closed 10-05: enrich_job's call was deleted from enrichJob.js once A76 landed (pinned below).
  // V6 closed 10-05: /api/smart-search and services/classifier.js deleted — no UI had called it (pinned below).
  ["domain_chips",   "A80 V3 — /api/domain-profiles/generate-chips"],
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

test("D17 V1: /api/parse-pdf reads the PDF's text layer locally — no tools-service model call", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const start = src.indexOf('app.post("/api/parse-pdf"');
  const end = src.indexOf("\n});", start);
  assert.ok(start > 0 && end > start, "the route moved — re-anchor this test");
  const route = src.slice(start, end);
  assert.doesNotMatch(route, /toolsService\.parsePdf|callModel\(/, "PDF → text went back to a model");
  assert.match(route, /pdf-parse/);
  // A scan has no text layer; the answer says so and what to do, rather than an empty résumé.
  assert.match(route, /pdf_no_text_layer/);
  assert.match(route, /degraded: false/, "local extraction is the product now, not a degraded mode");
});

test("D17 V2:/api/standalone/generate scores its résumé with the deterministic scorer, no model", () => {
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

test("D17 V4: nothing in production starts a model enrichment pass — no cron drain, no post-import pass, no run route", () => {
  // runEnrichment / drainEnrichment were the model passes, deleted with enrichJob.js's call (A80,
  // 10-05). Any production file defining, importing or calling one has put model enrichment back —
  // enrichJob.js included, which is no longer exempt.
  const offenders = [];
  for (const file of productionFiles()) {
    const f = file.replace(/\\/g, "/");
    // Comments mention both names as history; only code counts.
    const code = fs.readFileSync(file, "utf8").split(/\r?\n/)
      .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).map(l => l.replace(/\s\/\/.*$/, "")).join("\n");
    if (/\b(runEnrichment|drainEnrichment)\b/.test(code)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], "a production file reaches the model enrichment pass again");
  const enrich = fs.readFileSync("services/jobs/enrichJob.js", "utf8");
  assert.doesNotMatch(enrich, /callModel|modelCall.js|buildPrompt|purpose:s*["']enrich_job["']/,
    "enrichJob.js calls a model again — enrichment is export → import only (D17)");
  const route = fs.readFileSync("routes/enrichment.js", "utf8");
  assert.match(route, /status\(410\)[\s\S]{0,80}enrichment_by_model_retired/, "POST /run's apply is refused");
});

test("D17 V6: no résumé classifier in draft — /api/smart-search and services/classifier.js stay deleted", () => {
  // The route sent 2,000 chars of the résumé to Haiku to pick a search query. Its only UI, the
  // Smart Search button, was removed in a68c6c0 (2026-04-14); the route outlived it by six months.
  // The tools service still classifies INSIDE generate when no role family is sent — that is part of
  // résumé generation and pinned in resume-master's own ratchet.
  assert.equal(fs.existsSync("services/classifier.js"), false, "services/classifier.js is back");
  const src = fs.readFileSync("server.js", "utf8");
  assert.doesNotMatch(src, /app\.(post|get)\("\/api\/smart-search"/, "/api/smart-search is back");
  assert.doesNotMatch(src, /from "\.\/services\/classifier\.js"/);
});

// ── SCRIPTS (A80 V8–V12) ─────────────────────────────────────────────────────────────────────────
// One-off tools are not production, but D17 still binds them: every batch job needs an export and
// an import so the owner can do the model's part by hand. Held per FILE, because a script may build
// its client and call the SDK in ways the purpose scan above was never meant to read.
const SCRIPT_ALLOWED = new Map([
  // Verifies the tokenized GENERATION round trip on a real Sonnet call — the generation family.
  ["scripts/al5TokenizedGeneration.mjs", "generation — AL5's tokenized round trip"],
]);
const SCRIPT_KNOWN_VIOLATIONS = new Map([
  // V8 closed 10-05: scripts/a76LlmGradedCorpus.mjs is export → grade → import (A76, 291c906).
  ["scripts/al1ProviderQualityDiff.mjs", "A80 V9 — Groq vs Anthropic enrichment diff"],
  ["scripts/al3SkillSynonyms.mjs",       "A80 V10 — skill-synonym proposals by Haiku"],
  ["scripts/al4LcaResolution.mjs",       "A80 V11 — LCA company resolution by Haiku"],
]);

function scriptFiles() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js|cjs)$/.test(e.name)) out.push(p.replace(/\\/g, "/"));
    }
  };
  walk("scripts");
  return out;
}

/** Code only — a script's header may describe the model call it used to make. */
function codeOf(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/)
    .filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/.*$/, "")).join("\n");
}

const REACHES_A_MODEL = /callModel\(|\.messages\.(create|stream)\s*\(|new Anthropic\(|callProvider\(|api\.anthropic\.com|api\.groq\.com|generativelanguage\.googleapis/;

test("D17 scripts: a script reaches a model only for generation, or for a violation A80 already names", () => {
  const found = scriptFiles().filter(f => REACHES_A_MODEL.test(codeOf(fs.readFileSync(f, "utf8"))));
  const unexpected = found.filter(f => !SCRIPT_ALLOWED.has(f) && !SCRIPT_KNOWN_VIOLATIONS.has(f));
  assert.deepEqual(unexpected, [],
    "D17: a batch job needs an export and an import, not a model loop. New model-calling script(s):\n" +
    unexpected.map(f => `  ${f}`).join("\n"));
  const fixed = [...SCRIPT_KNOWN_VIOLATIONS.keys()].filter(f => !found.includes(f));
  assert.deepEqual(fixed, [],
    "These scripts no longer reach a model — delete them from SCRIPT_KNOWN_VIOLATIONS:\n" +
    fixed.map(f => `  ${f}: ${SCRIPT_KNOWN_VIOLATIONS.get(f)}`).join("\n"));
  const allowedGone = [...SCRIPT_ALLOWED.keys()].filter(f => !found.includes(f));
  assert.deepEqual(allowedGone, [], "an allowed script stopped calling a model — drop it from SCRIPT_ALLOWED");
});

test("D17 V8: the A76 corpus script grades by export → grade → import, never by a model", () => {
  const src = fs.readFileSync("scripts/a76LlmGradedCorpus.mjs", "utf8");
  assert.doesNotMatch(codeOf(src), REACHES_A_MODEL);
  assert.match(src, /--export <out\.jsonl>/);
  assert.match(src, /--import <graded\.jsonl>/);
  assert.match(src, /--revert <batchId>/);
});

// ── TASK AD — model-catalogue liveness ────────────────────────────────────────────────────────────
//
// shared/anthropicModels.js opens with the incident: a partial sweep left Sonnet pinned to
// `claude-sonnet-4-20250514`, Anthropic retired it, every call 404'd, and four features degraded
// silently for two months. Nothing asked, so nothing knew.
// ⛔ It must REFUSE, never substitute — an auto-updater would have "fixed" the 404 by quietly
// switching to a model that returns HTTP 200 and an empty extraction 49 times in 50.
//
// A87 (10-05): this file was test/modelCatalogueAndPacing.test.js. Its other two parts tested
// services/providerTransport.js, deleted with the Groq/Gemini stack, and retired with it:
//   1 · token pacing — "the Groq spec declares the limit that actually binds", "the estimate counts
//       BOTH directions", "TOKENS stop the caller long before requests do", "the window is
//       RECONCILED with real usage", "a single request larger than the whole budget still goes out"
//   3 · the max_tokens floor — "a REASONING model with max_tokens 500 is refused", "the same model
//       above the floor is allowed", "the floor does NOT apply to non-reasoning models"
// and from part 2, the three free-tier verdicts: "the free-tier catalogue is checked by
// MEMBERSHIP", "an empty catalogue is UNREACHABLE", "a provider with no catalogue endpoint reads
// UNSUPPORTED". Every Anthropic liveness test below is kept.
import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { checkPinnedModels, assertPinnedModelsLive, LIVENESS } from "../services/modelCatalogue.js";

// ── MODEL-CATALOGUE LIVENESS ────────────────────────────────────────────────────────────────

const anthropicStub = (impl) => ({ models: { retrieve: impl } });
const err = (status, message) => Object.assign(new Error(message), { status });

test("a live Anthropic model reports LIVE", async () => {
  const r = await checkPinnedModels({
    anthropic: anthropicStub(async (id) => ({ id, display_name: "Claude Haiku 4.5" })),
    anthropicModels: ["claude-haiku-4-5-20251001"],
  });
  const hit = r.find(x => x.provider === "anthropic");
  assert.equal(hit.status, LIVENESS.LIVE);
});

test("a RETIRED model reports GONE — the exact 2026-06-15 Sonnet incident", async () => {
  const r = await checkPinnedModels({
    anthropic: anthropicStub(async () => { throw err(404, "model not_found_error"); }),
    anthropicModels: ["claude-sonnet-4-20250514"],
  });
  assert.equal(r[0].status, LIVENESS.GONE);
});

test("⛔ a GONE model REFUSES THE BOOT, and never substitutes another", async () => {
  const log = { error: () => {}, warn: () => {}, log: () => {} };
  await assert.rejects(
    () => assertPinnedModelsLive({
      anthropic: anthropicStub(async () => { throw err(404, "model not_found_error"); }),
      anthropicModels: ["claude-sonnet-4-20250514"],
      log,
    }),
    (e) => {
      assert.equal(e.code, "PINNED_MODEL_GONE");
      assert.match(e.message, /REFUSING TO START/);
      assert.match(e.message, /claude-sonnet-4-20250514/, "it must name the model");
      // The anti-auto-update contract, asserted as text because it is the whole point of the task.
      assert.match(e.message, /does NOT substitute one automatically/);
      return true;
    },
  );
});

test("UNREACHABLE is not GONE — a network blip must not take the server down", async () => {
  // ⛔ THE FAILURE MODE OF THE FIX ITSELF. A liveness check that refuses to boot on a DNS hiccup
  // converts a momentary outage into a hard one, which is worse than the problem it solves. Only
  // an ANSWERED "no such model" is evidence about the catalogue.
  const log = { error: () => {}, warn: () => {}, log: () => {} };
  const results = await assertPinnedModelsLive({
    anthropic: anthropicStub(async () => { throw new Error("ECONNREFUSED"); }),
    anthropicModels: ["claude-haiku-4-5-20251001"],
    log,
  });
  assert.equal(results[0].status, LIVENESS.UNREACHABLE, "no status field means transport, not 404");
});

test("a 500 from the provider is also UNREACHABLE, not GONE", async () => {
  const r = await checkPinnedModels({
    anthropic: anthropicStub(async () => { throw err(500, "internal"); }),
    anthropicModels: ["claude-haiku-4-5-20251001"],
  });
  assert.equal(r[0].status, LIVENESS.UNREACHABLE);
});

test("each verdict is logged EXACTLY once", async () => {
  // `log.log?.(line) ?? log.warn(line)` printed everything twice: console.log returns undefined, so
  // `??` fired the fallback too. Invisible to every assertion in this file until the real output
  // was read — so it is asserted now.
  const lines = [];
  const log = { error: l => lines.push(l), warn: l => lines.push(l), log: l => lines.push(l) };
  await assertPinnedModelsLive({
    anthropic: anthropicStub(async (id) => ({ id })),
    anthropicModels: ["claude-haiku-4-5-20251001"], log,
  });
  const haiku = lines.filter(l => l.includes("claude-haiku-4-5-20251001"));
  assert.equal(haiku.length, 1, `logged ${haiku.length} times: ${JSON.stringify(haiku)}`);
});

test("no Anthropic client reads as UNCONFIGURED, never as a healthy or failing one", async () => {
  // "Unconfigured" and "broken" reading alike is how Jobo hid for months.
  // A87: re-pointed. This asserted the Groq/Gemini rows (GROQ_API_KEY / GOOGLE_API_KEY unset); with
  // those providers gone the case that remains is a boot with ANTHROPIC_KEY unset.
  const r = await checkPinnedModels({ anthropic: null, anthropicModels: ["claude-haiku-4-5-20251001"] });
  assert.equal(r.length, 1, "one verdict per pinned Anthropic model, and no other provider");
  for (const hit of r) {
    assert.equal(hit.status, LIVENESS.UNCONFIGURED, `${hit.provider} with no key`);
    assert.match(hit.detail, /unset/);
  }
});

test("server.js actually calls the gate, and exits on GONE", () => {
  // A boot gate nobody wired in is a module with tests. Asserted against the source because the
  // alternative is booting the real server in a unit test.
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /assertPinnedModelsLive\(/, "the gate must be called at boot");
  assert.match(src, /PINNED_MODEL_GONE/, "and its verdict acted on");
  assert.match(src, /process\.exit\(1\)/, "refusing to start means exiting");
});

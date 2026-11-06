// Provider routing — what is left of it after A87.
//
// This file held the PUBLIC/CANDIDATE split: PUBLIC job-advert text (enrich_job, classify_job,
// import_job) could be routed to a free tier (Groq, Gemini) under ENRICH_PROVIDER; anything derived
// from a person stayed on Anthropic. D17 deleted all three PUBLIC model calls (A80 V4, V7; D33), so
// the route carried no traffic, and A87 (10-05) deleted it: shared/modelProviders.js,
// services/providerTransport.js, routeFor(), and the ENRICH_PROVIDER / ENRICH_MODEL / GROQ_API_KEY /
// GOOGLE_API_KEY switches.
//
// What survives, and is pinned here:
//   - every call goes to the Anthropic SDK and is recorded provider=anthropic, whatever the env says;
//   - an undeclared call site is CANDIDATE; an unknown class (the retired "public") is refused;
//   - each call site still declares what it sends;
//   - migration 096's provider column and its backfill.
//
// Retired with the code (each exercised only the deleted modules): "PUBLIC traffic routes to the
// configured free tier", "a missing key WARNS and falls back", "an unknown ENRICH_PROVIDER warns and
// falls back", "the default — nothing configured — is Anthropic and is NOT a warning", "the fallback
// warning fires ONCE per process", "an unpinned ENRICH_MODEL is a LOUD failure", "a pinned
// ENRICH_MODEL that IS in the catalog is honoured", "a DECOMMISSIONED model id is refused for sending
// yet still prices historical rows", "every pinned model of every provider has a pricing entry", "a
// free-tier model prices at $0 SILENTLY; a genuinely unknown model still warns loudly" (the unknown
// half is test/anthropicModels.test.js's "an unknown model warns loudly"), "a routed call records
// the PROVIDER and the model actually called", "providerForModel labels a model with its provider",
// the three adapter tests (OpenAI-compatible, Gemini, block flattening), the three transport 429 /
// error tests, "a param the transport cannot translate is REFUSED", and "the three PUBLIC call sites
// pass only translatable params".

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";

import { callModel, DATA_CLASS, SYSTEM_USER_ID } from "../services/modelCall.js";
import { calculateCost } from "../shared/anthropicModels.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      event_subtype TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0, cache_creation_tokens INTEGER DEFAULT 0,
      cached INTEGER NOT NULL DEFAULT 0, model TEXT, cost_usd REAL DEFAULT 0,
      ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT,
      company TEXT, success INTEGER NOT NULL DEFAULT 1, error_text TEXT, purpose TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE cache_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      layer TEXT, domain_module TEXT, tokens_in_cache INTEGER DEFAULT 0,
      tokens_saved INTEGER DEFAULT 0, cost_saved_usd REAL DEFAULT 0, model TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE usage_tracking_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, purpose TEXT, user_id INTEGER,
      error_text TEXT, recovered_from_sink INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  return db;
}

/** An Anthropic client stub that records what it was asked for. */
function fakeAnthropic() {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        return {
          content: [{ type: "text", text: "{}" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        };
      },
    },
  };
}

/** Runs `fn` with env vars set, restoring each one (including absence) afterwards. */
async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

// ── ONE PROVIDER ────────────────────────────────────────────────────────────────────────────────

test("CANDIDATE traffic goes to Anthropic even with the retired free-tier env vars set", async () => {
  // Re-pointed (A87). This was "CANDIDATE traffic stays on Anthropic even when a free tier is fully
  // configured", asserted through routeFor(). routeFor is gone; the property is now asserted at the
  // wrapper: a deploy that still carries ENRICH_PROVIDER / GROQ_API_KEY changes nothing, and no
  // request leaves for any other host.
  const db = makeDb();
  const anthropic = fakeAnthropic();
  const originalFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error("callModel must not fetch"); };
  try {
    await withEnv({ ENRICH_PROVIDER: "groq", GROQ_API_KEY: "gsk_test", ENRICH_MODEL: "openai/gpt-oss-20b" }, () =>
      callModel({
        anthropic, db, purpose: "cover_letter", userId: SYSTEM_USER_ID,
        dataClass: DATA_CLASS.CANDIDATE,
        model: "claude-sonnet-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }],
      }));
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(anthropic.calls.length, 1);
  assert.equal(anthropic.calls[0].model, "claude-sonnet-5", "the candidate model must not be swapped either");
  assert.equal(fetched, 0);
  const row = db.prepare("SELECT provider, model FROM usage_events").get();
  assert.deepEqual({ ...row }, { provider: "anthropic", model: "claude-sonnet-5" });
});

test("an UNDECLARED call site is CANDIDATE and goes to Anthropic — the default fails closed", async () => {
  // Re-pointed (A87) from the routeFor() version of the same rule.
  const db = makeDb();
  const anthropic = fakeAnthropic();
  await callModel({
    anthropic, db, purpose: "cover_letter", userId: SYSTEM_USER_ID,
    model: "claude-sonnet-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(anthropic.calls.length, 1);
});

test("the retired PUBLIC class is REFUSED before any call or usage row", async () => {
  // Re-pointed (A87). This was "the PUBLIC set is exactly the job-text purposes still calling a
  // model" — an empty set since enrich_job went. With the route gone, a site still declaring
  // "public" is a stale declaration; reading it as CANDIDATE would hide it, so callModel refuses.
  assert.equal(DATA_CLASS.PUBLIC, undefined, "DATA_CLASS has no PUBLIC member");
  const db = makeDb();
  const anthropic = fakeAnthropic();
  await assert.rejects(() => callModel({
    anthropic, db, purpose: "enrich_job", userId: SYSTEM_USER_ID,
    dataClass: "public",
    model: "claude-haiku-4-5-20251001", messages: [{ role: "user", content: "a job advert" }],
  }), /unknown dataClass "public"/);
  assert.equal(anthropic.calls.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_events").get().n, 0);
});

test("Anthropic pricing is untouched by the free-tier table's removal", () => {
  // A regression here would silently reprice every historical reconciliation.
  assert.equal(calculateCost("claude-haiku-4-5-20251001", { input_tokens: 1_000_000 }), 1);
  assert.equal(calculateCost("claude-sonnet-5", { output_tokens: 1_000_000 }), 10);
});

// ── usage_events RECORDS PROVIDER AND MODEL ─────────────────────────────────────────────────────

test("an unrouted call still records provider=anthropic — no row is left unattributed", async () => {
  const db = makeDb();
  const anthropic = fakeAnthropic();
  await callModel({
    anthropic, db, purpose: "resume_generate", userId: SYSTEM_USER_ID,
    dataClass: DATA_CLASS.CANDIDATE,
    model: "claude-sonnet-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }],
  });
  const row = db.prepare("SELECT * FROM usage_events ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.provider, "anthropic");
  assert.equal(row.model, "claude-sonnet-5");
  assert.equal(anthropic.calls.length, 1, "the candidate call must have gone to the Anthropic SDK");
});

test("a rate-limited call is RECORDED as a failure, not dropped", async () => {
  // A failed call is a fact worth having: the dead claude-sonnet-4 ID 404'd on every call for two
  // months while the cost table showed nothing at all.
  // Re-pointed (A87): this drove a Groq 429 through the deleted transport; the rule it pinned —
  // callModel's `finally` records success=0 with the upstream message — is asserted on Anthropic.
  const db = makeDb();
  const anthropic = {
    messages: { create: async () => { throw Object.assign(new Error("429 rate_limit_error: slow down"), { status: 429 }); } },
  };
  await assert.rejects(() => callModel({
    anthropic, db, purpose: "cover_letter", userId: SYSTEM_USER_ID,
    dataClass: DATA_CLASS.CANDIDATE, model: "claude-sonnet-5",
    messages: [{ role: "user", content: "x" }],
  }), (e) => e.status === 429);
  const row = db.prepare("SELECT * FROM usage_events ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.success, 0);
  assert.equal(row.provider, "anthropic");
  assert.match(row.error_text, /rate_limit/i);
});

// ── EACH SITE DECLARES WHAT IT SENDS ────────────────────────────────────────────────────────────

test("every callModel call site declares a dataClass", () => {
  // The safe default protects production; this protects INTENT. A new site that forgets is made to
  // choose, rather than inheriting a default that happens to be right today.
  const files = ["server.js", "services/jobs/enrichJob.js",
                 "services/jobs/importJob.js", "routes/domainProfiles.js"];
  const missing = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    // D162: features call callTask (services/modelGateway.js), which hands dataClass through to callModel.
    for (const m of src.matchAll(/call(?:Model|Task)\(\{([\s\S]{0,900}?)\}\);/g)) {
      if (!/dataClass:\s*DATA_CLASS\./.test(m[1])) {
        missing.push(`${file}: near "${m[1].trim().slice(0, 70)}"`);
      }
    }
  }
  assert.deepEqual(missing, [],
    "These call sites do not say whose data they send:\n" + missing.map(x => `  ${x}`).join("\n"));
});

test("the resume-bearing `classifier` call is gone from draft, not re-routed (A80 V6)", () => {
  // services/classifier.js sent 2000 chars of the candidate's resume; it was CANDIDATE and never
  // public. D17 deleted it with /api/smart-search. Back in any form, it must declare CANDIDATE again.
  assert.equal(fs.existsSync("services/classifier.js"), false);
});

// ── MIGRATION 096 ───────────────────────────────────────────────────────────────────────────────

test("migration 096 is byte-identical in both runners and is additive", () => {
  // The list is duplicated between the boot-time runner (server.js) and the CLI one
  // (scripts/migrations.js). A migration added to only one of them applies on only one path.
  const grab = (file) => {
    const s = fs.readFileSync(file, "utf8");
    const i = s.indexOf(`id: "096_usage_events_provider"`);
    assert.ok(i > 0, `096 missing from ${file}`);
    // `at`/`lastAt` rather than bare indexOf: a missing anchor returns -1, and slice reads -1 as an
    // offset from the END, so the region silently becomes far too WIDE instead of empty and the
    // assertions over it keep passing. test/sourceAnchorGuard.test.js enforces this.
    return s.slice(lastAt(s, "{", i), at(s, "\n    },", i))
      .replace(/\r\n/g, "\n").replace(/^\s+/gm, "");
  };
  const sql = grab("scripts/migrations.js");
  assert.equal(sql, grab("server.js"),
    "the boot-time runner and the CLI runner must apply the same DDL");
  assert.match(sql, /ADD COLUMN provider/);
  // The one UPDATE it does contain is the backfill, and it is bounded to rows with no value.
  // Anything DROPping or DELETing here would be destroying the record of past spend.
  assert.doesNotMatch(sql, /\bDROP\b|\bDELETE\b/i);
  assert.match(sql, /UPDATE usage_events SET provider = 'anthropic' WHERE provider IS NULL/);
});

test("096 backfills existing rows to anthropic rather than leaving them unknown", async () => {
  const { MIGRATIONS } = await import("../scripts/migrations.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) {
    if (m.id === "096_usage_events_provider") break;
    db.exec(m.sql);
  }
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  db.prepare(`INSERT INTO usage_events (user_id, event_type, model, purpose)
              VALUES (1, 'enrich_job', 'claude-haiku-4-5-20251001', 'enrich_job')`).run();

  db.exec(MIGRATIONS.find(m => m.id === "096_usage_events_provider").sql);

  // Every row predating this migration WAS an Anthropic call — there was no other path. NULL would
  // say "unknown", which is a different and false claim, and would grow a bucket in `GROUP BY
  // provider` that never corresponded to anything real.
  const row = db.prepare("SELECT provider FROM usage_events").get();
  assert.equal(row.provider, "anthropic");
  db.close();
});

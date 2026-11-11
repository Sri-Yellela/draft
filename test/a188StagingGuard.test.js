// ⛔ A188 (46g) · THE STAGING GUARD — docs/STAGING_PLAN.md §4. A Railway duplicate of production carries every live
// credential; with DRAFT_ENV=staging the server refuses to start on any of them and forces the outward switches off.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkStaging, applyStagingGuard, isStaging, STAGING_MUST_BE_BLANK, STAGING_URL_VARS, STAGING_FORCED, STAGING_MODEL_KEY_LABEL }
  from "../services/stagingGuard.js";
import { CANONICAL_HOST, LEGACY_HOST } from "../shared/brand.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const STAGING = { DRAFT_ENV: "staging", APP_BASE_URL: "https://draft-staging.up.railway.app" };

test("a188: without DRAFT_ENV=staging the guard changes nothing", () => {
  const env = { STRIPE_SECRET_KEY: "sk_live_x", RESEND_API_KEY: "re_x" };
  assert.deepEqual(checkStaging(env), { staging: false, refused: [], forced: {} });
  assert.equal(isStaging({ DRAFT_ENV: "production" }), false);
  let exited = null; const r = applyStagingGuard(env, { exit: (c) => { exited = c; }, log: { log() {}, error() {} } });
  assert.equal(exited, null); assert.equal(env.DISCOVERY_PAUSED, undefined); assert.equal(r.staging, false);
});

test("a188: a clean staging env passes, and every outward switch is forced off", () => {
  const env = { ...STAGING, DISCOVERY_PAUSED: "0", BILLING_ENABLED: "1", MARKETING_SENDS_ENABLED: "true", DAILY_REMINDERS: "on" };
  let exited = null;
  const r = applyStagingGuard(env, { exit: (c) => { exited = c; }, log: { log() {}, error() {} } });
  assert.equal(exited, null); assert.deepEqual(r.refused, []);
  for (const [k, v] of Object.entries(STAGING_FORCED)) assert.equal(env[k], v, k);
  assert.deepEqual([env.DISCOVERY_PAUSED, env.JOB_CRAWL, env.BILLING_ENABLED, env.APPLY_FULL_AUTO_DISABLED], ["1", "off", "", "1"]);
});

test("a188: each production credential refuses the boot — by NAME, never printing its value", () => {
  for (const k of STAGING_MUST_BE_BLANK) {
    const r = checkStaging({ ...STAGING, [k]: "SECRET-VALUE-123" });
    assert.ok(r.refused.some(l => l.startsWith(`${k}:`)), k);
    assert.ok(!JSON.stringify(r).includes("SECRET-VALUE-123"), `${k}: the value is never echoed`);
  }
  // Stripe: only TEST keys
  assert.ok(checkStaging({ ...STAGING, STRIPE_SECRET_KEY: "sk_live_abc" }).refused.some(l => l.startsWith("STRIPE_SECRET_KEY:")));
  assert.ok(checkStaging({ ...STAGING, STRIPE_PUBLISHABLE_KEY: "pk_live_abc" }).refused.length === 1);
  assert.deepEqual(checkStaging({ ...STAGING, STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_PUBLISHABLE_KEY: "pk_test_abc" }).refused, []);
  assert.ok(checkStaging({ ...STAGING, STRIPE_WEBHOOK_SECRET: "whsec_x" }).refused.length === 1);
  // the model key: only the capped staging key
  assert.ok(checkStaging({ ...STAGING, ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "draft-prod" }).refused.some(l => l.startsWith("ANTHROPIC_KEY:")));
  assert.ok(checkStaging({ ...STAGING, ANTHROPIC_KEY: "k" }).refused.length === 1, "an unlabelled key is refused");
  assert.deepEqual(checkStaging({ ...STAGING, ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: STAGING_MODEL_KEY_LABEL }).refused, []);
});

test("a188: a URL naming the live site (canonical or legacy host) refuses; staging's own does not", () => {
  for (const k of STAGING_URL_VARS) {
    for (const h of [CANONICAL_HOST, LEGACY_HOST]) {
      for (const u of [`https://${h}`, `https://${h}/auth/google/callback`, `https://www.${h}/x`]) {
        assert.ok(checkStaging({ ...STAGING, [k]: u }).refused.some(l => l.startsWith(`${k}:`)), `${k} = ${u}`);
      }
    }
  }
  assert.deepEqual(checkStaging({ ...STAGING, RESUME_MASTER_URL: "https://resume-master-staging.up.railway.app" }).refused, []);
});

test("a188: a refused boot EXITS 1 before forcing anything, and lists every problem", () => {
  const env = { ...STAGING, RESEND_API_KEY: "re_x", COOKIE_DOMAIN: ".example.com" };
  const errors = []; let exited = null;
  applyStagingGuard(env, { exit: (c) => { exited = c; }, log: { log() {}, error: (m) => errors.push(m) } });
  assert.equal(exited, 1);
  assert.equal(env.DISCOVERY_PAUSED, undefined, "nothing forced on a refused boot");
  assert.ok(errors.some(m => m.includes("REFUSED TO START")) && errors.some(m => m.includes("RESEND_API_KEY")) && errors.some(m => m.includes("COOKIE_DOMAIN")));
  assert.ok(!errors.join("\n").includes("re_x"), "no value in the log");
});

test("a188: every name the guard forces or refuses is one the code really reads (a renamed switch fails here)", () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.claude/.test(f)) walk(f); } else if (/\.(js|mjs)$/.test(e.name)) files.push(f);
  } };
  for (const d of ["routes", "services", "shared", "crawler"]) walk(d);
  files.push("server.js");
  const src = files.filter(f => !/stagingGuard/.test(f)).map(read).join("\n");
  for (const k of [...STAGING_MUST_BE_BLANK, ...STAGING_URL_VARS, ...Object.keys(STAGING_FORCED)]) {
    assert.ok(new RegExp(`env\\??\\.${k}\\b|env\\[["']${k}["']\\]`).test(src), `${k} is read somewhere`);
  }
});

test("a188: wired — the guard runs right after dotenv and before every other module; noindex, robots, /api/version", () => {
  const server = read("server.js");
  const imports = server.split("\n").filter(l => /^import /.test(l));
  assert.deepEqual(imports.slice(0, 2), [
    'import "dotenv/config";',
    'import "./services/stagingGuardBoot.js";   // ⛔ A188: a staging deploy with a production credential exits HERE, before any module reads it',
  ]);
  assert.match(read("services/stagingGuardBoot.js"), /import \{ applyStagingGuard \} from "\.\/stagingGuard\.js";\n\napplyStagingGuard\(\);/);
  assert.match(server, /if \(isStaging\(\)\) app\.use\(\(_req, res, next\) => \{ res\.set\("X-Robots-Tag", "noindex, nofollow"\); next\(\); \}\);/);
  assert.match(server, /app\.get\("\/robots\.txt", \(req, res\) => \{\n  if \(isStaging\(\)\) return res\.type\("text\/plain"\)\.send\("User-agent: \*\\nDisallow: \/\\n"\);/);
  assert.match(server, /env: isStaging\(\) \? "staging" : "production",/);
});

test("a188: JOB_CRAWL=off — the daily employer-board crawl reads no company and fetches nothing", async () => {
  const { cacheJobs } = await import("../services/jobs/aggregator.js");
  const was = process.env.JOB_CRAWL;
  process.env.JOB_CRAWL = "off";
  try {
    const db = { prepare() { throw new Error("cacheJobs touched the database with JOB_CRAWL=off"); } };
    assert.equal(await cacheJobs(db, null), 0);
  } finally { if (was === undefined) delete process.env.JOB_CRAWL; else process.env.JOB_CRAWL = was; }
});

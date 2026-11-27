// ⛔ COST VISIBILITY (owner, 10-09) · a user sees their allowance and what to expect; what a résumé costs us,
// which tool or model ran, the cache and the retry reasons are Admin → Costs & quotas only. Each guard below was
// mutated red and restored (the commit message lists the mutations). No model call (D17).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { userSafeGeneration, userCostView, USER_HIDDEN_GENERATION_FIELDS, GENERATION_EXPECT_SECONDS } from "../services/costVisibility.js";
import { httpErrorFor, ToolsServiceError, isFundingFailure, USER_GENERATION_MESSAGES } from "../services/toolsService.js";
import { draftSlots, recordGenerationSlot } from "../services/draftSlots.js";
import { at } from "../test-support/sourceAnchors.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = lf("server.js");
const route = (open) => {
  const start = at(SERVER, open);
  const rest = SERVER.slice(start + 1);
  return SERVER.slice(start, start + 1 + rest.search(/\napp\.(get|post|put|delete|use)\(/));
};

// ── (a) the cost route: allowance and expectation only, for a non-admin ─────────────────────────

test("cost (a): a non-admin's GET /api/generate/cost is the allowance and '10–20 seconds' — no cents, tool or sentence", () => {
  const allowance = { limit: 10, used: 3, remaining: 7, nextFreeAt: null };
  assert.deepEqual(userCostView(allowance), { allowance, expectSeconds: [10, 20] });
  assert.deepEqual(GENERATION_EXPECT_SECONDS, [10, 20]);
  const r = route('app.get("/api/generate/cost"');
  const gate = at(r, "if (!mayActAsAdmin(req)) return res.json(userCostView(allowance));");
  assert.ok(gate < at(r, "generationCostSummary("), "the non-admin answer returns BEFORE the cost summary is built");
});

// ── (b) the generate response ───────────────────────────────────────────────────────────────────

test("cost (b): a non-admin's generate response drops the tool, the retry and every usage / cost / model / cache key", () => {
  const body = { html: "<p>x</p>", atsScore: 81, draftSlots: { remaining: 6 }, tool: "a_plus_resume", toolLabel: "A+ Resume",
    retry: { reason: "claim" }, cached: false, usage: [{ cost_usd: 0.07 }], costUsd: 0.07, model: "m", tokens: 9 };
  const user = userSafeGeneration(body, { admin: false });
  assert.deepEqual(Object.keys(user).sort(), ["atsScore", "draftSlots", "html"]);
  for (const k of USER_HIDDEN_GENERATION_FIELDS) assert.ok(!(k in user), k);
  assert.equal(userSafeGeneration(body, { admin: true }), body, "an admin's is unchanged");
  // EVERY answer of the route goes through it — the filter wraps res.json on the route's first line.
  const r = route('app.post("/api/generate"');
  assert.match(r.split("\n").slice(0, 4).join("\n"),
    /res\.json = \(body\) => json\(userSafeGeneration\(body, \{ admin: mayActAsAdmin\(req\) \}\)\);/);
});

// ── (c) the user's screens ──────────────────────────────────────────────────────────────────────

function* clientFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) yield* clientFiles(p);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) yield p;
  }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

test("cost (c): no non-admin client file shows cents, a model's name, or fetches the cost figures", () => {
  const offenders = [];
  for (const f of clientFiles("client/src")) {
    if (/admin/i.test(f)) continue;
    const code = stripComments(lf(f));
    if (/¢|\bSonnet\b|\bHaiku\b|\bOpus\b|api\/generate\/cost|api\/admin\/costs|cost_usd|costUsd/.test(code)) offenders.push(f);
  }
  assert.deepEqual(offenders, []);
  const panel = (fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */;
  assert.match(panel, /data-generate-expect="">Takes about 10–20 seconds\.</);
  assert.match(panel, /You[’']ve used your drafts for now — the next one frees up/);   // 47m: the sheet's 06 says it
  assert.doesNotMatch(panel, /\(A\+\)|one model call/);
});

// ── (d) a funding failure ───────────────────────────────────────────────────────────────────────

test("cost (d): a credit-balance failure gives the user the generic sentence and raises the admin's banner", () => {
  const e = new ToolsServiceError("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing.",
    { code: "upstream_error", status: 502, retryable: false, permanent: true });
  const { status, body } = httpErrorFor(e);
  assert.equal(status, 503);
  // 44x: a permanent failure no longer tells the user to retry (it said "try again shortly" beside "Retrying will not help").
  assert.equal(body.error, USER_GENERATION_MESSAGES.down);
  assert.doesNotMatch(body.error, /try again shortly/);
  assert.doesNotMatch(JSON.stringify(body), /credit|billing|Anthropic/i);
  assert.ok(isFundingFailure(e));
  assert.ok(!isFundingFailure(new ToolsServiceError("overloaded", { code: "overloaded" })));
  for (const m of Object.values(USER_GENERATION_MESSAGES)) assert.doesNotMatch(m, /model|key|credit|configured/i);
  // every tools-service catch notes it; the next success clears it
  assert.match(SERVER, /noteGenerationFailure\(e, "generate"\)/);
  assert.match(SERVER, /noteGenerationFailure\(e, "enhance"\)/);
  assert.match(SERVER, /noteGenerationFailure\(e, "standalone"\)/);
  assert.match(SERVER, /generated = await toolsService\.generate\(generateBody\);\n\s+clearFundingAlert\(\);/);
  const note = SERVER.slice(at(SERVER, "function noteGenerationFailure("), at(SERVER, "function clearFundingAlert("));
  assert.match(note, /if \(!isFundingFailure\(e\)\) return;/);
  assert.match(note, /setSetting\(db, FUNDING_ALERT_KEY/);
  // the cover letter's own 503 says nothing of keys
  assert.match(SERVER, /error: "Cover letters are unavailable right now\.",/);
});

// ── (e) the admin view ──────────────────────────────────────────────────────────────────────────

test("cost (e): Admin → Costs & quotas is admin-only and shows the figures, the retry notes and the banner", () => {
  const r = route('app.get("/api/admin/costs"');
  assert.match(r, /^app\.get\("\/api\/admin\/costs", requireAdmin,/);
  for (const col of ["cost_usd", "input_tokens", "output_tokens", "cache_read_tokens", "e.model", "error_text AS note"]) assert.ok(r.includes(col), col);
  assert.match(r, /fundingAlert: fundingAlert\(\)/);
  assert.match(route('app.post("/api/admin/costs/funding-alert/clear"'), /", requireAdmin,/);
  const ops = lf("client/src/panels/adminOps.jsx");
  const tab = ops.slice(at(ops, "export function CostsTab("));
  assert.match(tab, /api\("\/api\/admin\/costs"\)/);
  assert.match(tab, /Note \(retry reason, failure\)/);
  assert.match(tab, /data-funding-alert/);
  const admin = lf("client/src/panels/AdminPanel.jsx");
  assert.match(lf("client/src/panels/adminMap.js"), /\["costs", "Costs & quotas"\]/);
  assert.match(admin, /\{at\("today", "costs"\) && <CostsTab theme=\{theme\}\/>\}/);
});

// ── (f) the allowance still works ───────────────────────────────────────────────────────────────

test("cost (f): the allowance still counts down and refuses at zero", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, plan_tier) VALUES (1, 'ada', 'x', 'PRO')").run();
  const env = { DAILY_DRAFT_SLOTS: "2" };
  const before = draftSlots(db, 1, { env });
  recordGenerationSlot(db, 1, "j1");
  recordGenerationSlot(db, 1, "j2");
  const after = draftSlots(db, 1, { env });
  assert.equal(after.used - before.used, 2);
  assert.equal(after.remaining, 0);
  assert.ok(after.nextFreeAt > Date.now(), "the panel says when the next one frees up");
  assert.ok(at(SERVER, "if (slots.remaining <= 0) return res.status(429).json(slotsExhausted(slots));") > 0);
});

// ── (g) the mobile contract ─────────────────────────────────────────────────────────────────────

test("cost (g): the mobile contract carries no cost, token, tool or cache field — nothing to change there", () => {
  const c = lf("contract/mobile-api.v1.json");
  assert.doesNotMatch(c, /"(cost_?usd|costUsd|cents|toolLabel|cache_read_tokens|input_tokens|output_tokens)"/i);
});

// ── (h) the layout ──────────────────────────────────────────────────────────────────────────────

// ⛔ 47m (changed on purpose): "cost (h): the new line is an ordinary quota line — the panel's own class, theme " retired — the posting panel is deleted (D199 C7): a job opens as its opening sheet (plate/OpeningSheet.jsx, SheetResume.jsx), pinned by d199Market47h and a204.

// ── (i) the swap stays silent on a reload ──────────────────────────────────────────────────────

test("cost (i): a swapped résumé is listed as Generate to its non-admin owner; an admin and an unswapped user see the stored mode", async () => {
  const { userSafeResumeRow } = await import("../services/costVisibility.js");
  const row = { job_id: "j1", apply_mode: "CUSTOM_SAMPLER", html: "<p/>" };
  assert.equal(userSafeResumeRow(row, { admin: false, swapActive: true }).apply_mode, "TAILORED");
  assert.equal(userSafeResumeRow(row, { admin: true, swapActive: true }).apply_mode, "CUSTOM_SAMPLER");
  assert.equal(userSafeResumeRow(row, { admin: false, swapActive: false }).apply_mode, "CUSTOM_SAMPLER", "an A+ the user chose stays A+");
  const listing = SERVER.slice(at(SERVER, 'app.get("/api/resumes", requireAuth'), at(SERVER, 'app.delete("/api/resumes/:jobId"'));
  assert.equal((listing.match(/view\(\{ \.\.\.r|resumeRowView\(req\)\(\{ \.\.\.row/g) || []).length, 3, "all three listings pass through it");
  assert.match(SERVER, /swapActive = resolveEntitlement\(db, req\.user\.id, "a_plus_default"\)\.value === true/);
});

// 44x (e2e walk on the 18k copy, 11-05): the tools service refused an UNSCOPED key ("not scoped to a workspace", 400 →
// 502 upstream_model_failure, retryable:false) and the sandbox told the user "try again shortly". A permanent failure
// now says trying again won't help; a transient one still says try again shortly.
test("44x: a permanent 503 never tells the user to try again; a transient one still does", () => {
  const unscoped = new ToolsServiceError("This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header",
    { code: "upstream_model_failure", status: 502, retryable: false, permanent: true });
  const p = httpErrorFor(unscoped, "Resume generation failed");
  assert.equal(p.status, 503);
  assert.equal(p.body.retryable, false);
  assert.equal(p.body.error, USER_GENERATION_MESSAGES.down);
  assert.doesNotMatch(p.body.error, /try again shortly/i);
  assert.doesNotMatch(JSON.stringify(p.body), /workspace|Anthropic|key/i);
  assert.ok(isFundingFailure(unscoped), "the admin banner still names it");
  const busy = httpErrorFor(new ToolsServiceError("overloaded", { code: "overloaded", status: 529, retryable: true, permanent: false }));
  assert.equal(busy.status, 503);
  assert.equal(busy.body.retryable, true);
  assert.equal(busy.body.error, USER_GENERATION_MESSAGES[503]);
});

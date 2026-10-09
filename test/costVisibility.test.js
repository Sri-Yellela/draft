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
  const panel = lf("client/src/components/JobDetailPanel.jsx");
  assert.match(panel, /data-generate-expect="">Takes about 10–20 seconds\.</);
  assert.match(panel, /You've used your drafts for now — the next one frees up/);
  assert.doesNotMatch(panel, /\(A\+\)|one model call/);
});

// ── (d) a funding failure ───────────────────────────────────────────────────────────────────────

test("cost (d): a credit-balance failure gives the user the generic sentence and raises the admin's banner", () => {
  const e = new ToolsServiceError("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing.",
    { code: "upstream_error", status: 502, retryable: false, permanent: true });
  const { status, body } = httpErrorFor(e);
  assert.equal(status, 503);
  assert.equal(body.error, "Résumé generation is unavailable right now — try again shortly.");
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
  assert.match(admin, /\{ id:"costs",\s+label:"Costs & quotas" \}/);
  assert.match(admin, /\{topTab === "costs" && <CostsTab theme=\{theme\}\/>\}/);
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

test("cost (h): the new line is an ordinary quota line — the panel's own class, theme colours, no pill", () => {
  const panel = lf("client/src/components/JobDetailPanel.jsx");
  const line = panel.slice(at(panel, "data-generate-expect"), at(panel, "data-generate-expect") + 120);
  assert.ok(panel.lastIndexOf('className="pp__quota"', at(panel, "data-generate-expect")) > at(panel, "data-generate-expect") - 40);
  assert.doesNotMatch(line, /style=|999px|rounded-full|#[0-9a-f]{3,6}/i);
  const tab = lf("client/src/panels/adminOps.jsx").slice(at(lf("client/src/panels/adminOps.jsx"), "export function CostsTab("));
  assert.doesNotMatch(tab, /999px|rounded-full|#[0-9a-fA-F]{3,6}\b/, "theme tokens and C.* only");
});

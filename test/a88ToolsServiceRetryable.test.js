// A88 · 1 — the tools service's 429 { retryable: true } is TRANSIENT, everywhere it is read.
//
// Found by D36 (42d5391): services/toolsService.js inferred `permanent = res.status < 500` whenever
// the body carried no `permanent`, so the tools service's own rate-limit refusal — 429
// { error: "limit_exceeded", retryable: true } — was filed permanent=yes, "retry will fail
// identically", and the generate route told the user "Retrying will not help" beside a Retry button.
//
// The permanence flag is read in four places, all pinned here:
//   1. the client itself (ToolsServiceError.retryable / .permanent)
//   2. classifyGenerationError — an explicit boolean wins, so the client's verdict IS the verdict;
//      it writes the "permanent=yes|no" phrase into the apply line's reason_detail
//   3. httpErrorFor — the generate / enhance / standalone routes' answer to the user
//   4. classifyRuntimeError — autoApply's outer catch, for a tools error that surfaces there
// and the apply pipeline passes (2) through generateResumeForApply's errorPermanent into genFailure.
//
// ⛔ And the other half: a PERMANENT 4xx stays permanent, and nothing retries on its own — one
// request per call, whatever the answer, so a permanent error cannot loop.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { createToolsServiceClient, ToolsServiceError, httpErrorFor } from "../services/toolsService.js";
import { classifyGenerationError, classifyRuntimeError } from "../shared/failureAttribution.js";
import { at } from "../test-support/sourceAnchors.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

async function fakeService(answer) {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    seen.push(req.url);
    const { status, json } = answer;
    res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json));
  });
  await new Promise(r => server.listen(0, r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

async function failureFrom(answer, op = "generate") {
  const svc = await fakeService(answer);
  try {
    const e = await createToolsServiceClient({ baseUrl: svc.url, token: "t" })[op]({}).catch(x => x);
    assert.ok(e instanceof ToolsServiceError, "a non-2xx JSON answer throws a ToolsServiceError");
    return { e, requests: svc.seen.length };
  } finally { await svc.close(); }
}

// ── the tools service's OWN answers (resume-master src/http/app.js, auth.js: limit_exceeded) ────

test("A88 · The tools service's 429 limit_exceeded { retryable: true } is transient — client, apply line, route, autoApply", async () => {
  const { e, requests } = await failureFrom({ status: 429,
    json: { error: "limit_exceeded", retryable: true, message: "Daily limit reached for this key" } });
  assert.equal(requests, 1, "the client makes ONE request — it never retries on its own");
  // 1 · the client
  assert.equal(e.status, 429);
  assert.equal(e.retryable, true);
  assert.equal(e.permanent, false, "retryable:true is a verdict — it must not be overridden by status < 500");
  // 2 · the apply line: generateResumeForApply copies f.permanent into errorPermanent and f.detail
  //     into errorDetail, which processRunJob writes to apply_run_jobs.reason_detail
  const f = classifyGenerationError(e);
  assert.equal(f.permanent, false);
  assert.match(f.detail, /permanent=no \(retryable\)/);
  assert.doesNotMatch(f.detail, /retry will fail identically/);
  // 3 · the route's answer
  const h = httpErrorFor(e, "Resume generation failed");
  assert.equal(h.body.retryable, true);
  assert.equal(h.body.detail, undefined, "no 'Retrying will not help' on a rate limit");
  // 4 · autoApply's outer catch
  const r = classifyRuntimeError(e);
  assert.equal(r.reasonCode, "upstream_api_error");
  assert.equal(r.permanent, false);
});

for (const status of [408, 429]) {
  test(`A88 · a ${status} with NO verdict in the body is transient — "not now", not "never"`, async () => {
    const { e, requests } = await failureFrom({ status, json: { error: "internal_error" } }, "enhance");
    assert.equal(requests, 1);
    assert.equal(e.retryable, true);
    assert.equal(e.permanent, false);
    assert.equal(classifyGenerationError(e).permanent, false);
    assert.equal(httpErrorFor(e).body.retryable, true);
  });
}

// ── ⛔ a permanent 4xx stays permanent, and does not loop ───────────────────────────────────────

for (const [status, error] of [[400, "invalid_request"], [401, "unauthenticated"], [403, "unauthenticated"], [422, "invalid_request"]]) {
  test(`A88 · a ${status} with no verdict stays PERMANENT — one request, "retry will fail identically", no Retry`, async () => {
    const { e, requests } = await failureFrom({ status, json: { error } });
    assert.equal(requests, 1, "a permanent error is not retried — nothing loops");
    assert.equal(e.retryable, false);
    assert.equal(e.permanent, true);
    const f = classifyGenerationError(e);
    assert.equal(f.permanent, true);
    assert.match(f.detail, /permanent=yes \(retry will fail identically\)/);
    const h = httpErrorFor(e);
    assert.equal(h.body.retryable, false);
    assert.match(h.body.detail, /Retrying will not help/);
  });
}

test("A88 · an explicit verdict still wins over the status, both ways", async () => {
  // an exhausted balance: 502 (transient by status) with permanent:true — must not say retry (A4)
  const billing = (await failureFrom({ status: 502, json: { error: "upstream_model_failure", retryable: false, permanent: true } })).e;
  assert.equal(billing.permanent, true);
  assert.equal(httpErrorFor(billing).body.retryable, false);
  // a 4xx the service says is retryable (its auth limiter's 429 aside, any 4xx it marks so)
  const said = (await failureFrom({ status: 400, json: { error: "invalid_request", retryable: true } })).e;
  assert.equal(said.permanent, false);
  // retryable:false with no permanent → permanent
  const refused = (await failureFrom({ status: 503, json: { error: "model_unconfigured", retryable: false } })).e;
  assert.equal(refused.permanent, true);
  assert.equal(classifyGenerationError(refused).permanent, true);
});

// ── the callers carry the flag through unchanged ────────────────────────────────────────────────

test("A88 · the apply pipeline passes the classified verdict through — nothing re-infers it from the status", () => {
  const server = lf("server.js");
  const fn = server.slice(at(server, "function generateResumeForApply"), at(server, '\napp.post("/api/generate"'));
  assert.match(fn, /const f = classifyGenerationError\(e\);/);
  assert.match(fn, /errorPermanent: f\.permanent,/);
  assert.match(fn, /errorDetail: f\.detail,/);
  const apply = lf("routes/apply.js");
  // both generation branches (semi and auto) keep the verdict and the detail line
  assert.equal((apply.match(/permanent: gen\??\.errorPermanent \?\? null,/g) || []).length, 2);
  assert.match(apply, /const reasonDetail = genFailure \? genFailure\.detail/);
  // the client reads the reason CODE for its Retry affordance — generation_failed stays retryable
  const obstacles = lf("client/src/lib/applyObstacles.js");
  assert.match(obstacles, /generation_failed: \{[^}]*retryable: true/);
});

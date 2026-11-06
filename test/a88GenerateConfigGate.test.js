// A88 · 2 — /api/generate gates on the dependency it actually has.
//
// Found by D36: /api/generate answered 500 "ANTHROPIC_KEY not configured on server." — but nothing in
// the route calls a model. A new résumé is coreGenerateResume → toolsService.generate (the tools
// service holds the model key; D17 isolates generation there), and a cached one is served and
// re-scored locally. So the key gated the wrong dependency, in both directions: a server with the
// key and no tools service passed the gate, and one with the tools service and no key refused a
// route that would have worked. And a missing setting is configuration, not a crash — never a 500.
//
// The one branch of the generation family that DOES call the model directly is the cover letter
// (callModel, purpose cover_letter / cover_letter_apply — test/d17ModelCallSites.test.js), so the key
// check stays there, and only there, as an honest 503.
//
// server.js is one module that boots the whole app, so the routes are pinned by source region, the
// way test/a63BoardToolsPending.test.js pins the same route; the refusal body is built by the real
// httpErrorFor.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { httpErrorFor, ToolsServiceError } from "../services/toolsService.js";

const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
// Code only: a comment that explains the old gate must not count as the gate.
const code = (s) => s.split("\n").map(l => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/\s.*$/, "")).join("\n");

const generateRoute = server.slice(at(server, 'app.post("/api/generate", requireAuth'), at(server, "// SANDBOX + PDF"));
const coreGenerate = server.slice(at(server, "async function coreGenerateResume("), at(server, "function generateResumeForApply"));
const coverRoute = server.slice(at(server, 'app.post("/api/cover-letter/generate"'), at(server, "const message = await callModel({", at(server, 'app.post("/api/cover-letter/generate"')));

test("A88 · /api/generate makes no model call of its own — generation goes through the tools service", () => {
  for (const [name, region] of [["the route", generateRoute], ["coreGenerateResume", coreGenerate]]) {
    assert.doesNotMatch(code(region), /\bcallModel\(|\banthropic\b|messages\.create\(/, `${name} must not call a model directly`);
  }
  assert.match(code(generateRoute), /await coreGenerateResume\(/);
  assert.match(code(coreGenerate), /await toolsService\.generate\(/);
});

test("A88 · /api/generate does not gate on ANTHROPIC_KEY, and no config refusal there is a 500", () => {
  const c = code(generateRoute);
  assert.doesNotMatch(c, /ANTHROPIC_KEY/, "the route must not read the model key it does not use");
  assert.doesNotMatch(c, /status\(500\)[^;]*not configured/);
});

test("A88 · a NEW résumé is refused 503 when the tools service is not configured — before the limit, the slot or the call", () => {
  const c = code(generateRoute);
  const branch = at(c, "if (!cachedArtifact || forceRegen) {");
  const gate = at(c, "if (!toolsService.configured) {");
  assert.ok(gate > branch, "the gate is on the new-generation branch, so a cached résumé is still served");
  assert.ok(gate < at(c, 'checkLimit(db, req.user.id, "resume_generate")'), "refused before the limit is checked");
  assert.ok(gate < at(c, "draftSlots(db, req.user.id)"), "refused before a slot is read");
  assert.ok(gate < at(c, "await coreGenerateResume("), "refused before the call");
  assert.ok(at(c, "if (cachedArtifact && !forceRegen) {") > gate, "the cache-hit branch follows, ungated");
  const refusal = c.slice(gate, at(c, "const limitCheck"));
  assert.match(refusal, /httpErrorFor\(new ToolsServiceError\("The résumé tools service is not configured on this server",/);
  assert.match(refusal, /code: "tools_service_unconfigured", retryable: false, permanent: true/);
  // …and that body, built by the real httpErrorFor, is the honest one
  const { status, body } = httpErrorFor(new ToolsServiceError("The résumé tools service is not configured on this server",
    { code: "tools_service_unconfigured", retryable: false, permanent: true }));
  assert.equal(status, 503);
  assert.equal(body.code, "tools_service_unconfigured");
  assert.equal(body.retryable, false);
  // Cost visibility (10-09): the user's words are the generic sentence; the code still names the cause.
  // 44x: not retryable → it does not say "try again shortly" (the old sentence contradicted the detail below).
  assert.equal(body.error, "Résumé generation is down on our side — trying again won't help until we fix it.");
  assert.match(body.detail, /Retrying will not help/);
});

test("A88 · the cover letter calls the model itself, so the key check stays THERE — as a stated 503", () => {
  const c = code(coverRoute);
  const gate = at(c, "if (!ANTHROPIC_KEY) {");
  const answer = c.slice(at(c, "return res.status(503).json(", gate), at(c, "});", gate));
  assert.match(answer, /code: "model_unconfigured", retryable: false/);
  assert.match(answer, /Cover letters are unavailable right now\./);
  assert.doesNotMatch(answer, /ANTHROPIC_KEY/, "the setting's name is for the operator's log, not the user's screen");
  assert.ok(at(c, "return res.status(503).json(", gate) < at(c, "});", gate), "the 503 is the gate's own answer");
  // the apply path's cover letter: non-fatal, the run proceeds without one
  assert.match(server, /async function generateCoverLetterForApply\(userId, jobId\) \{\n  if \(!ANTHROPIC_KEY\) return \{ error: 'no_api_key' \};/);
});

test("A88 · nowhere in server.js does a missing setting answer 500", () => {
  const lines = code(server).split("\n").filter(l => /status\(500\)/.test(l) && /not configured|_KEY\b/.test(l));
  assert.deepEqual(lines, [], "a missing setting is the server's configuration: 503 with the reason, not 500");
});

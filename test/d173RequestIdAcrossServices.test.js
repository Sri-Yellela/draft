// ⛔ D173 (5) · ONE REQUEST ID ACROSS SERVICES (docs/SERVICES.md). draft gives every request an id, answers with it,
// runs an application run's job inside "run<id>-job<id>", and sends the current id to the tools service as
// `x-request-id` — which logs it as `rid` (resume-master test/d173RequestIdAcrossServices.test.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import { cleanRequestId, currentRequestId, withRequestId, requestIdMiddleware, runJobRequestId, REQUEST_ID_HEADER }
  from "../services/requestContext.js";
import { createToolsServiceClient } from "../services/toolsService.js";

test("d173RequestIdAcrossServices: a caller's plain id is kept; a malformed one is replaced, never echoed", () => {
  assert.equal(cleanRequestId("run12-job340"), "run12-job340");
  for (const bad of [undefined, "", "abc", "x".repeat(81), "id\r\nset-cookie: x", "<b>hi</b>"]) assert.equal(cleanRequestId(bad), null);
  assert.equal(runJobRequestId(12, 340), "run12-job340");
  assert.equal(currentRequestId(), null, "outside any work there is no id");
  withRequestId("run1-job2", () => assert.equal(currentRequestId(), "run1-job2"));
});

test("d173RequestIdAcrossServices: every response carries its id, and handlers (and what they await) see the same one", async () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/x", async (req, res) => { await new Promise(r => setTimeout(r, 5)); res.json({ seen: currentRequestId(), req: req.requestId }); });
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const given = await fetch(`${base}/x`, { headers: { [REQUEST_ID_HEADER]: "from-caller-123" } });
    assert.equal(given.headers.get(REQUEST_ID_HEADER), "from-caller-123");
    assert.deepEqual(await given.json(), { seen: "from-caller-123", req: "from-caller-123" });
    const fresh = await fetch(`${base}/x`, { headers: { [REQUEST_ID_HEADER]: "bad id with spaces" } });
    const id = fresh.headers.get(REQUEST_ID_HEADER);
    assert.match(id, /^[0-9a-f-]{36}$/, "a malformed id is replaced by a fresh UUID");
    assert.equal((await fresh.json()).seen, id);
  } finally { server.close(); }
});

test("d173RequestIdAcrossServices: the tools service is sent the current id as x-request-id (and none outside work)", async () => {
  const sent = [];
  const fetchImpl = async (_url, init) => {
    sent.push(init.headers);
    return new Response(JSON.stringify({ service: "resume-master" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = createToolsServiceClient({ baseUrl: "http://tools.test", token: "t", fetchImpl });
  await withRequestId("run7-job99", () => client.version());
  await client.version();
  assert.equal(sent[0][REQUEST_ID_HEADER], "run7-job99");
  assert.ok(!(REQUEST_ID_HEADER in sent[1]), "no work → no header, never an invented id");
});

test("d173RequestIdAcrossServices: wired — the middleware first in server.js, each run job inside its own id", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const mw = server.indexOf("app.use(requestIdMiddleware)");
  assert.ok(mw > 0, "server.js mounts requestIdMiddleware");
  assert.ok(mw < server.indexOf("app.use(startedByMiddleware)"), "before every other middleware that opens a context");
  const apply = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(apply, /withRequestId\(runJobRequestId\(run\.id, job\.id\)/, "processRunJob runs inside run<id>-job<id>");
});

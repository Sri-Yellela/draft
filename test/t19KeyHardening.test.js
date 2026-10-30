// ⭐ T19 hardening (G1, 10-30) — the workspace header, the key check, and the admin banner for a refused key.
// 10-15: keys created outside a workspace were refused on every request ("This API key is not scoped to a workspace…")
// and nothing said so until a user's generation failed. See services/modelKeyCheck.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { workspaceHeaders, checkModelKey, keyCheckLine, safeReason } from "../services/modelKeyCheck.js";
import { isFundingFailure } from "../services/toolsService.js";

// The provider's 10-15 body, as the SDK raises it (status + message)
const NOT_SCOPED = Object.assign(new Error('400 {"type":"error","error":{"type":"invalid_request_error","message":"This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace."}}'), { status: 400 });
const fake = (impl) => ({ models: { list: impl } });

test("T19: the workspace header is sent when ANTHROPIC_WORKSPACE_ID is set, and absent when not", () => {
  assert.deepEqual(workspaceHeaders({ ANTHROPIC_WORKSPACE_ID: "wrkspc_01AbC" }), { "anthropic-workspace-id": "wrkspc_01AbC" });
  assert.deepEqual(workspaceHeaders({}), {});
  assert.deepEqual(workspaceHeaders({ ANTHROPIC_WORKSPACE_ID: "  " }), {});
  assert.deepEqual(workspaceHeaders({ ANTHROPIC_WORKSPACE_ID: "bad id\nX-Inject: 1" }), {}, "a malformed id is never sent as a header");
});

test("T19: the key check — OK, FAILED with Anthropic's reason, UNREACHABLE for the network", async () => {
  assert.deepEqual(await checkModelKey(fake(async () => ({ data: [] }))), { state: "ok", reason: null, status: 200 });
  const failed = await checkModelKey(fake(async () => { throw NOT_SCOPED; }));
  assert.equal(failed.state, "failed");
  assert.match(keyCheckLine(failed), /^model key: FAILED \(.*not scoped to a workspace/);
  const down = await checkModelKey(fake(async () => { throw Object.assign(new Error("503 overloaded"), { status: 503 }); }));
  assert.equal(down.state, "unreachable", "a 5xx is the network's, not the key's");
  assert.equal((await checkModelKey(fake(() => new Promise(() => {})), { timeoutMs: 20 })).state, "unreachable");
  assert.equal((await checkModelKey(null)).state, "unconfigured");
  assert.equal(keyCheckLine({ state: "ok" }), "model key: OK");
});

test("T19: no key or workspace id is ever printed — the reason is masked", () => {
  const leak = new Error("invalid x-api-key sk-ant-api03-SECRETSECRET for workspace wrkspc_01XYZ");
  const r = safeReason(leak);
  assert.doesNotMatch(r, /SECRETSECRET|01XYZ/);
  assert.match(r, /sk-ant-…/);
});

test("T19: the 10-15 refusal raises the admin banner (it matched no funding words before)", () => {
  assert.equal(isFundingFailure(NOT_SCOPED), true);
  assert.equal(isFundingFailure(Object.assign(new Error("permission_error: this key cannot use this model"), { status: 403 })), true);
  assert.equal(isFundingFailure(new Error("503 overloaded")), false, "an outage is not a funding failure");
});

test("T19: server.js sends the header, says it at boot, and checks the key at boot and daily", () => {
  const src = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(src, /new Anthropic\(\{ apiKey: ANTHROPIC_KEY, defaultHeaders: workspaceHeaders\(process\.env\) \}\)/);
  assert.match(src, /workspace-header=\$\{workspaceHeaders\(process\.env\)\["anthropic-workspace-id"\] \? "on" : "off"\}/);
  assert.match(src, /setSetting\(db, FUNDING_ALERT_KEY, JSON\.stringify\(\{ at: [^}]*where: "model_key_check", code: "model_key_rejected"/);
  assert.match(src, /setInterval\(\(\) => \{ void runModelKeyCheck\(\); \}, KEY_CHECK_EVERY_MS\)\.unref\(\)/);
});

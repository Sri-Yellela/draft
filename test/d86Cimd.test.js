// A96 · CIMD with its SSRF fence (services/byom/cimd.js). No network: every fetch is a fake.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cimdUrl, ensureCimdClient, checkClientMetadata, CIMD_MAX_BYTES, _resetCimdCache } from "../services/byom/cimd.js";
import { validateAuthorize, authorizationServerMetadata, redirectRegistered } from "../services/byom/oauthServer.js";

const CC = "https://claude.ai/oauth/claude-code-client-metadata";
const CC_DOC = { client_id: CC, client_name: "Claude Code", client_uri: "https://claude.ai", redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
  grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };

function db() {
  const d = new Database(":memory:");
  d.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);");
  d.exec(MIGRATIONS.find(m => m.id === "152_byom_oauth").sql);
  return d;
}
const fake = (body, { status = 200, type = "application/json" } = {}) => {
  const calls = [];
  const f = async (url, opts) => { calls.push({ url, opts }); return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } }); };
  f.calls = calls;
  return f;
};

test("⛔ A96: only an https URL on Claude's or ChatGPT's own origin is ever fetched", () => {
  assert.equal(cimdUrl(CC), CC);
  for (const bad of ["http://claude.ai/x", "https://evil.example/doc", "https://claude.ai.evil.example/x", "https://169.254.169.254/latest", "https://127.0.0.1/x",
    "https://claude.ai:8443/x", "https://user:pw@claude.ai/x", "https://claude.ai/x?y=1", "https://claude.ai/x#f", "https://claude.ai/", "dft_client_abc", ""]) {
    assert.equal(cimdUrl(bad), null, bad);
  }
});

test("⛔ A96: the fetch follows NO redirect, times out, and a DCR client_id fetches nothing", async () => {
  _resetCimdCache();
  const d = db(), f = fake(CC_DOC);
  assert.equal(await ensureCimdClient(d, "dft_client_abc", { fetchImpl: f }), null);
  assert.equal(f.calls.length, 0);
  await ensureCimdClient(d, CC, { fetchImpl: f });
  assert.equal(f.calls[0].opts.redirect, "error");
  assert.ok(f.calls[0].opts.signal, "a timeout signal");
  await ensureCimdClient(d, CC, { fetchImpl: f });
  assert.equal(f.calls.length, 1, "a verified document is not re-fetched within the hour");
});

test("⛔ A96: Claude Code's real document registers, and its loopback callback matches on ANY port", async () => {
  _resetCimdCache();
  const d = db();
  await ensureCimdClient(d, CC, { fetchImpl: fake(CC_DOC) });
  const row = d.prepare("SELECT host, registration FROM oauth_clients WHERE client_id = ?").get(CC);
  assert.deepEqual(row, { host: "claude", registration: "cimd" });
  const q = { client_id: CC, redirect_uri: "http://localhost:53122/callback", response_type: "code", code_challenge: "a".repeat(43), code_challenge_method: "S256", state: "s" };
  assert.equal(validateAuthorize(d, q, { resource: "https://x/mcp" }).redirectUri, "http://localhost:53122/callback");
  assert.throws(() => validateAuthorize(d, { ...q, redirect_uri: "http://localhost:53122/other" }, { resource: "https://x/mcp" }), /not one this app registered/);
  assert.equal(redirectRegistered(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai:444/api/mcp/auth_callback"), false, "only loopback ignores the port");
});

test("⛔ A96: a document that does not name itself, is confidential, or redirects elsewhere is refused — and nothing is stored", async () => {
  _resetCimdCache();
  for (const [doc, why] of [
    [{ ...CC_DOC, client_id: "https://claude.ai/other" }, /does not name itself/],
    [{ ...CC_DOC, token_endpoint_auth_method: "client_secret_basic" }, /public clients only/],
    [{ ...CC_DOC, redirect_uris: ["https://evil.example/cb"] }, /same app/],
    [{ ...CC_DOC, redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"] }, /same app/],
    [{ ...CC_DOC, grant_types: ["client_credentials"] }, /grant_types/],
  ]) assert.throws(() => checkClientMetadata(CC, doc), why);
  const d = db();
  await assert.rejects(ensureCimdClient(d, CC, { fetchImpl: fake({ ...CC_DOC, redirect_uris: ["https://evil.example/cb"] }) }), /same app/);
  await assert.rejects(ensureCimdClient(d, CC, { fetchImpl: fake("x".repeat(CIMD_MAX_BYTES + 10)) }), /could not read/);
  await assert.rejects(ensureCimdClient(d, CC, { fetchImpl: fake("<html>", { type: "text/html" }) }), /could not read/);
  await assert.rejects(ensureCimdClient(d, CC, { fetchImpl: fake(CC_DOC, { status: 302 }) }), /could not read/);
  assert.equal(d.prepare("SELECT COUNT(*) FROM oauth_clients").pluck().get(), 0);
});

test("⛔ D86 G3: the authorization-server metadata advertises CIMD (and 'none') and DCR", () => {
  const m = authorizationServerMetadata({ issuer: "https://jobsviadraft.com" });
  assert.equal(m.client_id_metadata_document_supported, true);
  assert.ok(m.token_endpoint_auth_methods_supported.includes("none"));
  assert.equal(m.registration_endpoint, "https://jobsviadraft.com/oauth/register");
  assert.deepEqual(m.code_challenge_methods_supported, ["S256"]);
});

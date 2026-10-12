// D86 BUG (owner, 10-12) — claude.ai could not connect: "grant_types may be authorization_code and refresh_token only".
// Claude's client metadata document lists jwt-bearer too: a document is published ONCE for every server its client talks
// to, so it may name grants draft never offers. RFC 7591 §2 — a server may ignore grants it does not support. So: the
// list must INCLUDE authorization_code, everything else is ignored, and the client still gets only authorization_code +
// refresh_token (the token endpoint refuses any other grant). Fixture: the REAL document, fetched 10-12.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { checkClientMetadata } from "../services/byom/cimd.js";
import { registerClient, tokenGrant } from "../services/byom/oauthServer.js";

const URL_ = "https://claude.ai/oauth/mcp-oauth-client-metadata";
const CLAUDE_DOC = JSON.parse(fs.readFileSync("test/fixtures/claude-client-metadata.json", "utf8"));
function db() { const d = new Database(":memory:"); for (const m of MIGRATIONS) d.exec(m.sql); return d; }

test("D86 · Claude's REAL client metadata document is accepted (it names jwt-bearer; draft ignores it)", () => {
  assert.equal(CLAUDE_DOC.client_id, URL_);
  assert.ok(CLAUDE_DOC.grant_types.includes("urn:ietf:params:oauth:grant-type:jwt-bearer"), "the fixture is the real document");
  assert.deepEqual(checkClientMetadata(URL_, CLAUDE_DOC, { production: true }),
    { name: "Claude", host: "claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] });
});

test("D86 · a document WITHOUT authorization_code is still refused", () => {
  assert.throws(() => checkClientMetadata(URL_, { ...CLAUDE_DOC, grant_types: ["client_credentials"] }), /must include authorization_code/);
  assert.throws(() => checkClientMetadata(URL_, { ...CLAUDE_DOC, grant_types: "authorization_code" }), /must include authorization_code/);
  assert.doesNotThrow(() => { const { grant_types, ...noGrants } = CLAUDE_DOC; void grant_types; checkClientMetadata(URL_, noGrants); }, "absent defaults to authorization_code");
});

test("D86 · registerClient (DCR) accepts the extra grant and returns ONLY authorization_code + refresh_token", () => {
  const d = db();
  const r = registerClient(d, { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:jwt-bearer"] });
  assert.deepEqual(r.grant_types, ["authorization_code", "refresh_token"]);
  assert.throws(() => registerClient(d, { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], grant_types: ["client_credentials"] }),
    /must include authorization_code/);
});

test("D86 · the token endpoint still answers unsupported_grant_type for jwt-bearer and client_credentials", () => {
  const d = db();
  const { client_id } = registerClient(d, { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "urn:ietf:params:oauth:grant-type:jwt-bearer"] });
  for (const grant_type of ["urn:ietf:params:oauth:grant-type:jwt-bearer", "client_credentials"]) {
    assert.throws(() => tokenGrant(d, { grant_type, client_id, assertion: "x" }, { resource: "https://jobsviadraft.com/mcp" }),
      (e) => e.error === "unsupported_grant_type", grant_type);
  }
});

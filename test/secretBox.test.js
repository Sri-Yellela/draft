import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadSecretKey, createSecretBox, saveIntegrationSecret, SECRET_KEY_ENV } from "../services/secretBox.js";

const KEY = "ab".repeat(32);

test("production refuses to start without the key — it used to generate one per boot, silently", () => {
  assert.throws(() => loadSecretKey({ NODE_ENV: "production" }), /COOKIE_ENCRYPTION_KEY is not set/);
  assert.throws(() => loadSecretKey({ NODE_ENV: "production", [SECRET_KEY_ENV]: "" }), /not set/);
});

test("a malformed key is refused at boot, not at the first encrypt", () => {
  // The old reader sliced to 64 and let Buffer.from(…, "hex") drop non-hex characters, so these
  // became short buffers and failed mid-request with "Invalid key length".
  for (const bad of ["replace-with-64-hex-chars", "ab".repeat(16), "zz".repeat(32), "ab".repeat(33)]) {
    assert.throws(() => loadSecretKey({ NODE_ENV: "production", [SECRET_KEY_ENV]: bad }), /64 hex/, bad);
    assert.throws(() => loadSecretKey({ [SECRET_KEY_ENV]: bad }), /64 hex/, `dev too: ${bad}`);
  }
});

test("a valid key is used as given, whitespace ignored", () => {
  const { key, source } = loadSecretKey({ NODE_ENV: "production", [SECRET_KEY_ENV]: ` ${KEY.slice(0, 30)}\n${KEY.slice(30)} ` });
  assert.equal(source, "env");
  assert.equal(key.toString("hex"), KEY);
});

test("development gets a per-boot key, and SAYS so", () => {
  const warnings = [];
  const a = loadSecretKey({}, { warn: (m) => warnings.push(m) });
  const b = loadSecretKey({}, { warn: (m) => warnings.push(m) });
  assert.equal(a.source, "ephemeral");
  assert.notEqual(a.key.toString("hex"), b.key.toString("hex"));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /will not survive a restart/);
});

test("a sealed secret opens with the same key and not with another", () => {
  const box = createSecretBox(Buffer.from(KEY, "hex"));
  const sealed = box.encrypt('{"accessToken":"t"}');
  assert.doesNotMatch(sealed.enc, /accessToken/);
  assert.equal(box.decrypt(sealed.enc, sealed.iv, sealed.tag), '{"accessToken":"t"}');
  const other = createSecretBox(Buffer.from("cd".repeat(32), "hex"));
  assert.throws(() => other.decrypt(sealed.enc, sealed.iv, sealed.tag));
});

test("an empty secret stores nothing, so the upsert's COALESCE keeps the old one", () => {
  const box = createSecretBox(Buffer.from(KEY, "hex"));
  for (const empty of [null, undefined, "", {}]) {
    assert.deepEqual(saveIntegrationSecret(box.encrypt, empty), { enc: null, iv: null, tag: null });
  }
  const sealed = saveIntegrationSecret(box.encrypt, { provider: "google", accessToken: "t" });
  assert.equal(JSON.parse(box.decrypt(sealed.enc, sealed.iv, sealed.tag)).accessToken, "t");
});

test("server.js and routes/account.js share ONE saveIntegrationSecret, imported — not a name with no binding", () => {
  // Until 09-30 server.js's upsertAuthIntegration called saveIntegrationSecret(sessionState) with
  // no definition or import in that module (it lived only inside routes/account.js), so every OAuth
  // sign-in threw a ReferenceError at its last step. The tests that covered the route matched its
  // source text and stayed green.
  //
  // ⚠ Still a source check: server.js cannot be imported without booting. What it pins is the
  // shape of the fix — each module that CALLS the helper IMPORTS it, and nobody defines a copy.
  for (const file of ["server.js", "routes/account.js"]) {
    const src = fs.readFileSync(file, "utf8");
    assert.match(src, /import \{[^}]*\bsaveIntegrationSecret\b[^}]*\} from "\.\.?\/services\/secretBox\.js"/, `${file} must import it`);
    assert.doesNotMatch(src, /function saveIntegrationSecret\b/, `${file} defines its own copy`);
  }
  const server = fs.readFileSync("server.js", "utf8");
  // The one-argument call was the bug's other half: with a binding it would have encrypted with
  // `undefined` as the cipher.
  assert.doesNotMatch(server, /saveIntegrationSecret\((?!SECRET_BOX\.encrypt\b)/,
    "server.js calls saveIntegrationSecret without the box's encrypt as its first argument");
  assert.doesNotMatch(server, /crypto\.randomBytes\(32\)\.toString\("hex"\)\s*,\s*"hex"/,
    "the silent per-boot key is back in server.js");
});

// D87 (10-09): the dev handoff. Two things a developer setting up the extension locally tripped on:
// the README's header still said v1.1.1 at v1.5.0, and the DEV SWITCH pointed at :3000 while the
// server serves :3001.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncReadmeVersion } from "../scripts/buildExtension.mjs";

const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8").replace(/^﻿/, ""));

test("D87: extension/README.md's header carries the manifest's version", () => {
  const first = fs.readFileSync("extension/README.md", "utf8").split(/\r?\n/)[0];
  assert.match(first, new RegExp(`\\bv${manifest.version.replace(/\./g, "\\.")}$`),
    `README header "${first}" is not v${manifest.version} — run npm run build:extension`);
});

test("D87: syncReadmeVersion rewrites only the header's version and keeps CRLF", () => {
  const crlf = "# draft — Chrome Extension v1.1.1\r\n\r\nBody v1.1.1 stays.\r\n";
  assert.equal(syncReadmeVersion(crlf, "1.5.0"), "# draft — Chrome Extension v1.5.0\r\n\r\nBody v1.1.1 stays.\r\n");
  assert.equal(syncReadmeVersion(crlf, "1.1.1"), crlf, "an up-to-date header is returned unchanged");
  assert.equal(syncReadmeVersion("No header\n# x v1.0\n", "2.0"), null, "only the FIRST line is a header");
});

test("D87: the DEV SWITCH points at the port the server serves", () => {
  const serverPort = fs.readFileSync("server.js", "utf8").match(/const PORT\s*=\s*process\.env\.PORT\s*\|\|\s*(\d+)/)?.[1];
  assert.ok(serverPort, "server.js's default PORT not found");
  for (const f of ["extension/config.js", "extension/background.js"]) {
    const lineB = fs.readFileSync(f, "utf8").match(/^\/\/ const RESUME_MASTER_URL = '(http:\/\/localhost:(\d+))';/m);
    assert.ok(lineB, `${f}: no commented dev-switch line B`);
    assert.equal(lineB[2], serverPort, `${f}: line B is ${lineB[1]}, the server serves :${serverPort}`);
  }
});

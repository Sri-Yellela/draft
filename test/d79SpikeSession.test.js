// ⛔ D79 S0.2 · the spike's capture and replay. Each red when removed:
// the sealed file round-trips and hides every value · a wrong passphrase or a tampered file THROWS · a short
// passphrase is refused · the destination is refused inside this repo AND inside any git work tree · cookies are
// kept only for the named origins · the capture is HEADED, never touches a form field and never uploads · the
// replay prints no screenshot, page text or cookie value · the passphrase never comes from argv.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sealSession, openSession, assertOutsideRepo, cookieMatches, describeSession, REPO_ROOT, MIN_PASSPHRASE } from "../scripts/spikeSession.mjs";

const PASS = "correct horse battery";
const SESSION = { origins: ["https://account.example.test"], capturedAt: "2026-10-08T00:00:00Z",
  cookies: [{ name: "sid", value: "SYNTHETIC-SECRET-VALUE-123", domain: ".example.test" }],
  localStorage: { "https://account.example.test": { token: "SYNTHETIC-LS-VALUE-456" } } };

test("⛔ D79 S0.2: a sealed session round-trips, and the file shows no value", () => {
  const sealed = sealSession(SESSION, PASS);
  assert.doesNotMatch(sealed, /SYNTHETIC-SECRET-VALUE-123|SYNTHETIC-LS-VALUE-456|"sid"/, "no cookie or storage value, nor a cookie name, in the file");
  assert.deepEqual(openSession(sealed, PASS), SESSION);
});

test("⛔ D79 S0.2: a wrong passphrase or a tampered file THROWS; a short passphrase is refused", () => {
  const sealed = sealSession(SESSION, PASS);
  assert.throws(() => openSession(sealed, "the wrong passphrase"), /wrong passphrase/);
  const f = JSON.parse(sealed);
  f.enc = Buffer.from("x".repeat(40)).toString("base64");
  assert.throws(() => openSession(JSON.stringify(f), PASS), /wrong passphrase, or the file was changed/);
  assert.throws(() => sealSession(SESSION, "short"), new RegExp(`at least ${MIN_PASSPHRASE}`));
});

test("⛔ D79 S0.2: the destination is refused INSIDE the repo, and inside ANY git work tree", () => {
  assert.throws(() => assertOutsideRepo(path.join(REPO_ROOT, "x.session")), /inside the repository/);
  assert.throws(() => assertOutsideRepo(path.join(REPO_ROOT, "data", "deep", "new", "x.session")), /inside the repository/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "d79-"));
  try {
    assert.throws(() => assertOutsideRepo(path.join(outside, "x.session"), { gitCheck: () => true }), /inside a git work tree/);
    assert.equal(assertOutsideRepo(path.join(outside, "x.session"), { gitCheck: () => false }), path.resolve(outside, "x.session"));
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
});

test("D79 S0.2: cookies are kept only for the named origins (host or a parent domain)", () => {
  const o = ["https://account.amazon.jobs"];
  assert.equal(cookieMatches({ domain: ".amazon.jobs" }, o), true);
  assert.equal(cookieMatches({ domain: "account.amazon.jobs" }, o), true);
  assert.equal(cookieMatches({ domain: ".google.com" }, o), false);
  assert.equal(cookieMatches({ domain: "evilamazon.jobs" }, o), false);
  assert.deepEqual(describeSession(SESSION), { origins: SESSION.origins, capturedAt: SESSION.capturedAt, cookies: 1,
    localStorage: { "https://account.example.test": 1 } }, "the printable summary is counts only");
});

const code = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("⛔ D79 S0.2: the capture is HEADED, never touches a form field, never types or clicks, never uploads", () => {
  const src = code("scripts/spikeCaptureSession.mjs");
  assert.match(src, /headless:\s*false/);
  for (const [re, what] of [
    [/password/i, "a password field"], [/querySelector|\$\(|\$\$\(|\.value\b|getElementsBy/, "reading the DOM"],
    [/\.type\(|keyboard|\.click\(|keydown|keypress|addEventListener/, "typing, clicking or listening for keys"],
    [/\bfetch\(|axios|https?\.request|XMLHttpRequest|sendBeacon/, "a network upload"],
  ]) assert.doesNotMatch(src, re, `the capture must not do ${what}`);
  assert.match(src, /assertOutsideRepo\(out\);[\s\S]*puppeteer\.launch/, "the destination is checked BEFORE the browser opens");
});

test("⛔ D79 S0.3: the replay takes no screenshot, prints no page text or cookie value, types and submits nothing", () => {
  const src = code("scripts/spikeReplaySession.mjs");
  for (const [re, what] of [
    [/screenshot|\.pdf\(/, "a screenshot"], [/innerText|textContent|\.content\(\)/, "page text"],
    [/\.type\(|keyboard|\.click\(|submit/i, "typing, clicking or submitting"],
    [/\bfetch\(|axios|https?\.request|sendBeacon/, "a network upload"],
    [/console\.(log|error)\([^)]*cookies\b(?!\.length)/, "a cookie value"],
  ]) assert.doesNotMatch(src, re, `the replay must not do ${what}`);
});

test("⛔ D79: the passphrase is typed into the terminal, never taken from argv or the environment", () => {
  for (const rel of ["scripts/spikeCaptureSession.mjs", "scripts/spikeReplaySession.mjs"]) {
    const src = code(rel);
    assert.match(src, /promptHidden\(/, `${rel} reads the passphrase with echo off`);
    assert.doesNotMatch(src, /one\("pass|process\.env\.[A-Z_]*PASS/i, `${rel} must not take the passphrase from argv or env`);
  }
  assert.match(code("scripts/spikeSession.mjs"), /if \(!input\.isTTY\) return Promise\.reject/, "no terminal → refuse, never read a piped secret");
});

#!/usr/bin/env node
// ⛔ D79 S0.2 · CAPTURE — a HEADED browser on the owner's machine; THE OWNER SIGNS IN THEMSELVES; the script then
// saves that origin's cookies and localStorage to a passphrase-sealed file OUTSIDE every repository.
//
//   node scripts/spikeCaptureSession.mjs --url https://account.amazon.jobs/ --out C:\Users\<you>\draft-secrets\spike\amazon.session
//        [--origin https://www.amazon.jobs]   a second origin the portal uses (D56's two-origin case); repeatable
//        [--force]                             replace an existing file
//
// ⛔ What it never does: type, click, or read the page. It does not look at any form field — it cannot see what
// was typed into the sign-in form — and it records no keystrokes. It reads only what the browser itself holds
// for the named origins (cookies; localStorage, read while the tab is on that origin). It uploads nothing.
// The browser runs in a fresh, throwaway profile that is deleted on exit, so nothing of the owner's everyday
// browser is touched or read. ⚠ Prefer a SECONDARY account (APPLY_WORKER.md §9); sign out in the portal when
// the spike is done — that kills the session wherever a copy of it went.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { sealSession, writeSealed, assertOutsideRepo, promptHidden, waitForEnter, cookieMatches, describeSession } from "./spikeSession.mjs";

const argv = process.argv.slice(2);
const one = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const many = (k) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : []));
const url = one("url");
const out = one("out");
if (!url || !out) { console.error("usage: --url <portal sign-in page> --out <file outside any repo> [--origin <url>]... [--force]"); process.exit(2); }

assertOutsideRepo(out);                                               // ⛔ refuse before anyone signs in
if (fs.existsSync(out) && !argv.includes("--force")) { console.error(`refused: ${out} exists — pass --force`); process.exit(2); }
const origins = [...new Set([new URL(url).origin, ...many("origin").map((o) => new URL(o).origin)])];

const exe = await resolveBrowserExecutable();
if (!exe) { console.error("No Chrome binary found."); process.exit(1); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "draft-spike-"));
const browser = await puppeteer.launch({ executablePath: exe.path, headless: false, userDataDir: profile, defaultViewport: null,
                                         args: ["--no-first-run", "--no-default-browser-check"] });
try {
  const [page] = await browser.pages();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.error(`\nSign in YOURSELF in the browser window (${new URL(url).host}).`);
  console.error("This script does not see what you type. Finish any 2-step check there too.");
  await waitForEnter("Press Enter HERE once you are signed in and the portal shows your account… ");

  const client = await page.createCDPSession();
  const { cookies: all } = await client.send("Storage.getCookies");
  const cookies = all.filter((c) => cookieMatches(c, origins));
  const localStorage = {};
  for (const o of origins) {
    if (new URL(page.url()).origin !== o) {
      try { await page.goto(o, { waitUntil: "domcontentloaded" }); } catch { /* an origin with no root page */ }
    }
    if (new URL(page.url()).origin === o) {
      localStorage[o] = await page.evaluate(() => Object.fromEntries(Object.keys(window.localStorage).map((k) => [k, window.localStorage.getItem(k)])));
    }
  }
  const session = { origins, capturedAt: new Date().toISOString(), userAgent: await browser.userAgent(), cookies, localStorage };
  await browser.close();

  const passphrase = await promptHidden("Passphrase to seal the file (12+ characters, not echoed): ");
  const again = await promptHidden("Again: ");
  if (passphrase !== again) throw new Error("the two passphrases differ — nothing was written");
  const file = writeSealed(out, sealSession(session, passphrase), { force: argv.includes("--force") });
  console.error(`\nSealed → ${file}`);
  console.error(JSON.stringify(describeSession(session), null, 1));
  console.error("⛔ Never commit or upload this file. When the spike is done, sign out in the portal to kill the session.");
} finally {
  try { await browser.close(); } catch { /* already closed */ }
  fs.rmSync(profile, { recursive: true, force: true });
}

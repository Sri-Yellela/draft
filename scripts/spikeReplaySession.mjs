#!/usr/bin/env node
// ⛔ D79 S0.3 · REPLAY — load a sealed session into a FRESH browser and report whether the portal still treats it
// as signed in: S0.3 (a) on the owner's machine, same IP; (b) on a datacenter box. It answers APPLY_WORKER.md §8.2.
//
//   node scripts/spikeReplaySession.mjs --in <sealed file> --url <a signed-in page, e.g. the portal's applications list>
//        [--headed]                 show the window (default: headless, the worker's shape)
//        [--signin-pattern <re>]    what a sign-in URL looks like on this portal (default: login|signin|sign-in|auth)
//
// ⛔ It reads the session, opens ONE page, and reports the outcome as words: where the page landed (host + path,
// never the query), whether that is a sign-in page, and whether a challenge (CAPTCHA / bot check) appeared.
// No screenshot (a signed-in page is personal data — APPLY_WORKER.md §4), no page text, no cookie value is
// printed. It types nothing, clicks nothing, submits nothing, and uploads nothing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { openSession, promptHidden, describeSession } from "./spikeSession.mjs";

const argv = process.argv.slice(2);
const one = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const file = one("in");
const url = one("url");
if (!file || !url) { console.error("usage: --in <sealed file> --url <signed-in page> [--headed] [--signin-pattern <re>]"); process.exit(2); }
const signin = new RegExp(one("signin-pattern") || "login|signin|sign-in|sign_in|auth", "i");

const session = openSession(fs.readFileSync(file, "utf8"), await promptHidden("Passphrase (not echoed): "));
console.error(JSON.stringify(describeSession(session), null, 1));

const exe = await resolveBrowserExecutable();
if (!exe) { console.error("No Chrome binary found."); process.exit(1); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "draft-spike-"));
const browser = await puppeteer.launch({ executablePath: exe.path, headless: argv.includes("--headed") ? false : "new", userDataDir: profile,
                                         args: ["--no-first-run", "--no-default-browser-check"] });
try {
  const page = await browser.newPage();
  if (session.userAgent) await page.setUserAgent(session.userAgent);
  const client = await page.createCDPSession();
  await client.send("Storage.setCookies", { cookies: session.cookies });
  for (const [origin, kv] of Object.entries(session.localStorage || {})) {
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await page.evaluate((entries) => { for (const [k, v] of entries) window.localStorage.setItem(k, v); }, Object.entries(kv));
    } catch { /* an origin with no root page: cookies still apply */ }
  }
  const started = Date.now();
  const res = await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 }).catch((e) => ({ error: e.message }));
  const landed = new URL(page.url());
  const challenge = await page.evaluate(() => {
    const frames = [...document.querySelectorAll("iframe")].map((f) => f.src || "");
    const hit = frames.find((s) => /recaptcha|hcaptcha|arkoselabs|funcaptcha|captcha|challenges\.cloudflare/i.test(s));
    return hit ? new URL(hit, location.href).host : null;
  }).catch(() => null);
  const report = {
    ranAt: new Date().toISOString(), host: os.hostname(), headless: !argv.includes("--headed"),
    asked: `${new URL(url).host}${new URL(url).pathname}`, landed: `${landed.host}${landed.pathname}`,
    status: res?.status?.() ?? null, error: res?.error ?? null, ms: Date.now() - started,
    redirectedToSignIn: signin.test(landed.pathname) || (landed.host !== new URL(url).host && signin.test(landed.host)),
    challenge,
  };
  report.verdict = report.error ? "ERROR" : report.challenge ? "CHALLENGED" : report.redirectedToSignIn ? "SIGNED OUT" : "SESSION SURVIVED";
  console.log(JSON.stringify(report, null, 1));
  console.error("⛔ When the spike is done: delete any box this ran on, and sign out in the portal to kill the session.");
} finally {
  await browser.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
}

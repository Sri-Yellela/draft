#!/usr/bin/env node
// D124 · /try AND THE TRIAL GATE, WALKED IN A REAL CHROME against a LOCAL draft (never production — a walk there would
// count as a tester in the owner's trial numbers). Boot draft first on a fresh data dir with DRAFT_TRIAL=on, e.g.
//   RM_DATA_DIR=<empty dir> PORT=3917 DRAFT_TRIAL=on node server.js
// then: node scripts/d124TryWalk.mjs [--base http://localhost:3917] [--shots <dir>]
//
// The walk: /try signed out (Start) → a synthetic sign-up (the register API, in the page, as the form posts it) → /try's
// résumé picker → Sample A (the normal from-resume onboarding) → /app with the trial dock → Finish the trial → the
// survey as the whole page (the improvements dropdown, the thoughts box) → Skip → the coming-soon page. Desktop and phone
// widths. Nothing is sent anywhere; the account is synthetic.
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const SHOTS = arg("--shots", null);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); if (!ok) failed++; };
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, re, ms = 20000) => page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { timeout: ms }, re.source);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };

const browser = await launchBrowser({ headless: "new" });
try {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    console.log(`\n── ${label} ──`);
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(viewport);
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    await waitText(page, /Takes about 4 minutes/);
    check(`${label}: /try signed out shows the one screen and Start`, /Start/.test(await text(page)));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${label}: no horizontal scroll`, !overflow);
    await shot(page, `${label}-1-try`);

    const user = `walk${Date.now().toString(36)}${label[0]}`;
    const reg = await page.evaluate(async (u) => {
      localStorage.setItem("draft.trialIntent", "1");   // what Start sets before the sign-up form
      const r = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Walk", last_name: "Tester" } }) });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, user);
    check(`${label}: a synthetic sign-up`, reg.status === 200, `status ${reg.status} ${JSON.stringify(reg.body)?.slice(0, 120)}`);

    await page.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    await waitText(page, /Pick a résumé/);
    check(`${label}: a new account lands on the résumé picker`, /Sample A/.test(await text(page)) && /Use my own résumé/.test(await text(page)));
    await shot(page, `${label}-2-picker`);

    await page.click('[data-trial-choice="A"] button');
    await page.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 30000 });
    await page.waitForSelector("[data-trial-dock]", { timeout: 30000 });
    const dock = await page.$eval("[data-trial-dock]", el => el.innerText);
    check(`${label}: the app opens with the trial dock`, /2 of 2 Drafts left|2 Drafts/.test(dock) && /Finish/.test(dock), dock.replace(/\s+/g, " ").slice(0, 160));
    check(`${label}: the sample is labelled fictional`, /fictional/.test(dock));
    await shot(page, `${label}-3-app`);

    const state = await page.evaluate(() => fetch("/api/trial/state", { credentials: "include" }).then(r => r.json()));
    check(`${label}: the account is a trial account with a profile`, state.trial === true && state.hasProfile === true && state.sample === "A", JSON.stringify({ trial: state.trial, hasProfile: state.hasProfile, sample: state.sample }));

    await page.evaluate(() => [...document.querySelectorAll("[data-trial-dock] button")].find(b => /^Finish/.test(b.innerText.trim())).click());
    await page.waitForSelector("[data-trial-sheet]");
    await page.evaluate(() => [...document.querySelectorAll("[data-trial-sheet] button")].find(b => /Finish and take the survey/.test(b.innerText)).click());
    await page.waitForSelector("[data-trial-survey]", { timeout: 20000 });
    const survey = await text(page);
    check(`${label}: Finish the trial locks the site into the survey`, /That was your trial/.test(survey));
    check(`${label}: the improvements are a dropdown`, await page.$$eval("[data-trial-survey] select option", o => o.length) >= 10);
    check(`${label}: it ends in the tester's own words`, /Any other thoughts or feedback\?/.test(survey));
    await shot(page, `${label}-4-survey`);

    await page.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-trial-survey]", { timeout: 20000 });
    check(`${label}: the lock holds across a reload — the app is not reachable`, !(await page.$("[data-trial-dock]")));

    await page.evaluate(() => [...document.querySelectorAll("[data-trial-survey] button")].find(b => /Skip/.test(b.innerText)).click());
    await page.waitForSelector("[data-trial-coming-soon]", { timeout: 20000 });
    check(`${label}: Skip → the coming-soon page`, /The full version is coming soon/.test(await text(page)));
    await shot(page, `${label}-5-coming-soon`);
    await ctx.close();
  }
} catch (e) {
  console.error("walk failed:", e?.message || e);
  failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);

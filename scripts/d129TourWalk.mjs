#!/usr/bin/env node
// D129 · THE GUIDED TOUR, WALKED IN A REAL CHROME against a LOCAL draft (never production — a walk there would count as a
// tester in the owner's trial numbers). The board must hold postings (a sample is offered only with 10 good picks), so
// boot draft on a COPY of a migrated local database with DRAFT_TRIAL=on, e.g.
//   RM_DATA_DIR=<copy dir> PORT=3917 DRAFT_TRIAL=on node --env-file=.env server.js
// then: node scripts/d129TourWalk.mjs [--base http://localhost:3917] [--shots <dir>] [--sample A]
//
// The walk: a synthetic sign-up → /try → the sample → the tour's steps on the real pages, checking at each that the
// caption and its spotlight are there; the deck's sweep ends on the top card; the filters step waits for a filter to be
// tried; the pick-two step waits for 2 Drafts (not sent here — they need the tools service — so the walk skips there).
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const SHOTS = arg("--shots", null);
const SAMPLE = arg("--sample", "A");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); if (!ok) failed++; };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const stepOf = (page) => page.$eval("[data-guided-tour]", el => el.getAttribute("data-guided-tour")).catch(() => null);
const waitStep = (page, id, ms = 20000) => page.waitForSelector(`[data-guided-tour="${id}"]`, { timeout: ms }).then(() => true).catch(() => false);
const lit = (page) => page.waitForSelector("[data-tour-spotlight]", { timeout: 8000 }).then(() => true).catch(() => false);
const next = (page) => page.click("[data-tour-next]");

const browser = await launchBrowser({ headless: "new" });
try {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    console.log(`\n── ${label} ──`);
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    const user = `tour${Date.now().toString(36)}${label[0]}`;
    const reg = await page.evaluate(async (u) => {
      localStorage.setItem("draft.trialIntent", "1");
      const r = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Walk", last_name: "Tester" } }) });
      const j = await r.json().catch(() => ({}));
      // The session is the auth context the client keeps in sessionStorage (lib/api.js), as the sign-up form leaves it.
      if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
      return r.status;
    }, user);
    check(`${label}: a synthetic sign-up`, reg === 200, `status ${reg}`);
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    const offered = await page.waitForSelector(`[data-trial-choice="${SAMPLE}"] button`, { timeout: 60000 }).then(() => true).catch(() => false);
    check(`${label}: sample ${SAMPLE} is offered (10 good picks on this board)`, offered);
    if (!offered) { await ctx.close(); continue; }
    await page.click(`[data-trial-choice="${SAMPLE}"] button`);

    check(`${label}: the tour starts on the deck`, await waitStep(page, "deck", 40000));
    check(`${label}: the deck is lit`, await page.waitForSelector("[data-tour-spotlight]", { timeout: 40000 }).then(() => true).catch(() => false));
    await shot(page, `${label}-1-deck`);
    // D129 (1): the sweep ends on the top card (≤ 0.5 s a card; the deck holds at most a few dozen).
    const top = await page.waitForFunction(() => /^\s*1\b/.test(document.querySelector("[data-deck-counter]")?.innerText || ""), { timeout: 30000 })
      .then(() => true).catch(() => false);
    check(`${label}: the sweep ends on the best match (card 1)`, top,
      await page.$eval("[data-deck-counter]", el => el.innerText).catch(() => "no counter"));
    const progress = await page.$eval("[data-tour-progress]", el => el.innerText);
    check(`${label}: "Step 1 of 11"`, progress === "Step 1 of 11", progress);

    await next(page);
    check(`${label}: why this job`, await waitStep(page, "deck_card"));
    await next(page);
    check(`${label}: the filters`, await waitStep(page, "filters", 30000));
    check(`${label}: the sentence is lit`, await lit(page));
    const locked = await page.$eval("[data-tour-next]", el => el.disabled);
    check(`${label}: Next waits for a filter to be tried`, locked);
    // The VISIBLE word (a layout may keep a hidden copy of the sentence), pressed as a tap would.
    const pressed = await page.evaluate(() => {
      const el = [...document.querySelectorAll("[data-slot]")].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden");
      if (!el) return null;
      el.click();
      return el.getAttribute("data-slot");
    });
    check(`${label}: a word of the sentence pressed`, !!pressed, pressed || "no visible word");
    const unlocked = await page.waitForFunction(() => !document.querySelector("[data-tour-next]")?.disabled, { timeout: 8000 }).then(() => true).catch(() => false);
    check(`${label}: trying a filter unlocks Next`, unlocked);
    await page.keyboard.press("Escape").catch(() => {});
    await shot(page, `${label}-2-filters`);
    await next(page);

    for (const id of ["draft_house", "auto_settings", "atlas_map", "atlas_learn"]) {
      const at = await waitStep(page, id, 30000);
      const on = at && await lit(page);
      check(`${label}: ${id} — the caption and its spotlight`, at && on, at ? (on ? "" : "no element to light") : `stuck on ${await stepOf(page)}`);
      if (id === "draft_house") {
        check(`${label}: Draft House shows its labelled example`, await page.waitForSelector("[data-house-example]", { timeout: 8000 }).then(() => true).catch(() => false));
      }
      if (id === "auto_settings") {
        check(`${label}: the modes step opens Auto settings`, await page.waitForSelector("[data-auto-settings]", { timeout: 8000 }).then(() => true).catch(() => false));
      }
      await shot(page, `${label}-3-${id}`);
      if (at) await page.click("[data-tour-next]").catch(() => page.$eval("[data-tour-next]", el => el.click()));
      if (id === "auto_settings") {
        const closed = await page.waitForFunction(() => !document.querySelector("[data-auto-settings]"), { timeout: 8000 }).then(() => true).catch(() => false);
        check(`${label}: Next closes Auto settings (and puts them back)`, closed);
      }
    }
    check(`${label}: your turn — pick 2`, await waitStep(page, "pick_two", 30000));
    const req = await page.waitForSelector("[data-tour-require]", { timeout: 8000 }).then(h => h.evaluate(el => el.innerText)).catch(() => "");
    check(`${label}: Next waits for 2 Drafts`, /Draft on 2 jobs/.test(req) && await page.$eval("[data-tour-next]", el => el.disabled), req);
    await shot(page, `${label}-4-pick-two`);
    await page.click("[data-tour-skip]");
    const gone = await page.waitForFunction(() => !document.querySelector("[data-guided-tour]"), { timeout: 5000 }).then(() => true).catch(() => false);
    check(`${label}: Skip to the survey ends the tour`, gone);
    // 44b: leaving the tour ends the trial into the survey, never into the open app.
    check(`${label}: Skip opens the survey`, await page.waitForSelector("[data-trial-survey]", { timeout: 8000 }).then(() => true).catch(() => false));
    check(`${label}: no Skip the survey`, !(await page.evaluate(() => /Skip the survey/.test(document.body.innerText))));
    // 44b: the sequence cannot be broken before the survey — a reload, a typed URL or the old dismiss call all land on it.
    for (const to of ["/app", "/app/house", "/app/atlas"]) {
      await page.goto(BASE + to, { waitUntil: "networkidle2" });
      const onSurvey = await page.waitForSelector("[data-trial-survey], [data-survey-invite]", { timeout: 10000 }).then(() => true).catch(() => false);
      check(`${label}: ${to} after skipping shows the survey, not the site`, onSurvey);
    }
    const dismissed = await page.evaluate(() => fetch("/api/trial/survey/dismiss", { method: "POST", credentials: "include" }).then(r => r.status));
    // a raw fetch carries no app auth header (401); signed in, the route answers 410 (test/t44bTrialSequence pins it)
    check(`${label}: the old survey dismiss is refused`, dismissed >= 400, String(dismissed));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${label}: no horizontal scroll`, !overflow);
    check(`${label}: no page errors`, !errors.length, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${failed ? `${failed} FAILED` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);

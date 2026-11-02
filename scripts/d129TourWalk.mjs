#!/usr/bin/env node
// D129 · THE GUIDED TOUR, WALKED IN A REAL CHROME against a LOCAL draft (never production — a walk there would count as a
// tester in the owner's trial numbers). The board must hold postings (a sample is offered only with 10 good picks), so
// boot draft on a COPY of a migrated local database with DRAFT_TRIAL=on, e.g.
//   RM_DATA_DIR=<copy dir> PORT=3917 DRAFT_TRIAL=on node --env-file=.env server.js
// then: node scripts/d129TourWalk.mjs [--base http://localhost:3917] [--shots <dir>] [--sample A]
//
// The walk: a synthetic sign-up → /try → the sample → the tour's steps on the real pages, checking at each that the
// caption and its spotlight are there; the deck's sweep ends on the top card; the filters step waits for a filter to be
// tried; the pick-two step waits for 2 Drafts. Desktop then presses Draft twice and follows the demonstration, The Table
// and the survey's pop-up into the survey; the phone takes "Skip to the survey". Either way a reload or a typed URL
// before the survey is answered lands on the survey (44b).
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";
import { TOUR_STEPS } from "../shared/trialTour.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const SHOTS = arg("--shots", null);
const SAMPLE = arg("--sample", "A");
// The steps the tour walks on the real pages, in its own order — read from the shared list, so the walk cannot fall
// behind the tour again (it expected 11 steps and a "deck_card" step for a week after the tour became 13; 44d).
const WALKED = TOUR_STEPS.map(s => s.id).filter(id => id !== "pick_resume" && id !== "survey");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`); if (!ok) failed++; };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const stepOf = (page) => page.$eval("[data-guided-tour]", el => el.getAttribute("data-guided-tour")).catch(() => null);
const waitStep = (page, id, ms = 20000) => page.waitForSelector(`[data-guided-tour="${id}"]`, { timeout: ms }).then(() => true).catch(() => false);
const lit = (page) => page.waitForSelector("[data-tour-spotlight]", { timeout: 8000 }).then(() => true).catch(() => false);
// Next, as a person presses it: once the caption is SHOWN (it is hidden, and lets presses through, while the tour measures
// its target) and Next is enabled; then the step must change — a press lost in that moment is pressed again (44d).
async function next(page) {
  for (let k = 0; k < 4; k++) {
    const before = await stepOf(page);
    await page.waitForFunction(() => { const p = document.querySelector("[data-guided-tour]"); const n = document.querySelector("[data-tour-next]");
      return p && n && !n.disabled && getComputedStyle(p).opacity === "1"; }, { timeout: 20000 }).catch(() => {});
    await page.$eval("[data-tour-next]", el => el.click()).catch(() => {});
    const moved = await page.waitForFunction((b) => document.querySelector("[data-guided-tour]")?.getAttribute("data-guided-tour") !== b,
      { timeout: 6000 }, before).then(() => true).catch(() => false);
    if (moved) return true;
  }
  return false;
}

const browser = await launchBrowser({ headless: "new" });
try {
  // Desktop walks the WHOLE sequence to the survey; the phone takes "Skip to the survey" (44b) — both roads, every step.
  for (const [label, viewport, road] of [["desktop", { width: 1280, height: 860 }, "full"], ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true }, "skip"]]) {
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
    await shot(page, `${label}-01-deck`);
    // D129 (1): the sweep ends on the top card (≤ 0.5 s a card; the deck holds at most a few dozen).
    const top = await page.waitForFunction(() => /^\s*1\b/.test(document.querySelector("[data-deck-counter]")?.innerText || ""), { timeout: 30000 })
      .then(() => true).catch(() => false);
    check(`${label}: the sweep ends on the best match (card 1)`, top,
      await page.$eval("[data-deck-counter]", el => el.innerText).catch(() => "no counter"));
    const progress = await page.$eval("[data-tour-progress]", el => el.innerText);
    check(`${label}: "Step 1 of ${WALKED.length}"`, progress === `Step 1 of ${WALKED.length}`, progress);
    await next(page);

    // Every step from the deck to "pick 2", in the tour's own order (shared/trialTour.js), each with its caption and light.
    for (const id of WALKED.slice(1, WALKED.indexOf("pick_two"))) {
      const at = await waitStep(page, id, 30000);
      const on = at && await lit(page);
      check(`${label}: ${id} — the caption and its spotlight`, at && on, at ? (on ? "" : "no element to light") : `stuck on ${await stepOf(page)}`);
      if (!at) break;
      if (id === "filters") {
        const locked = await page.waitForFunction(() => document.querySelector("[data-tour-next]")?.disabled, { timeout: 5000 }).then(() => true).catch(() => false);
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
      }
      if (id === "draft_house") {
        check(`${label}: Draft House shows its labelled example`, await page.waitForSelector("[data-house-example]", { timeout: 8000 }).then(() => true).catch(() => false));
      }
      if (id === "auto_settings") {
        check(`${label}: the step opens Auto settings`, await page.waitForSelector("[data-auto-settings]", { timeout: 8000 }).then(() => true).catch(() => false));
      }
      await shot(page, `${label}-${String(WALKED.indexOf(id) + 1).padStart(2, "0")}-${id}`);
      await next(page);
      if (id === "auto_settings") {
        const closed = await page.waitForFunction(() => !document.querySelector("[data-auto-settings]"), { timeout: 8000 }).then(() => true).catch(() => false);
        check(`${label}: Next closes Auto settings (and puts them back)`, closed);
      }
    }
    check(`${label}: your turn — pick 2`, await waitStep(page, "pick_two", 30000));
    // The deck is dealt again on the way back to it (sample A's 10 picks), not left on "Dealing today's draft…".
    const dealt = await page.waitForSelector('[data-fan-offset="0"]', { timeout: 20000 }).then(() => true).catch(() => false);
    check(`${label}: the deck is dealt again for pick 2`, dealt);
    const req = await page.waitForSelector("[data-tour-require]", { timeout: 8000 }).then(h => h.evaluate(el => el.innerText)).catch(() => "");
    check(`${label}: Next waits for 2 Drafts`, /Draft on 2 jobs/.test(req) && await page.$eval("[data-tour-next]", el => el.disabled).catch(() => true), req);
    await shot(page, `${label}-${WALKED.indexOf("pick_two") + 1}-pick-two`);

    if (road === "full") {
      // THE WHOLE SEQUENCE: 2 Drafts (the deck's D key, as a person presses it) → the demonstration → The Table → the
      // survey's pop-up → the survey. Locally no tools service is configured, so nothing reaches a model or an employer.
      for (let k = 0; k < 2; k++) {
        await page.waitForSelector("[data-deck-actions]", { timeout: 10000 }).catch(() => {});
        await page.keyboard.press("d");
        await page.waitForFunction((n) => Number(document.querySelector("[data-tour-drafted]")?.getAttribute("data-tour-drafted")) >= n,
          { timeout: 30000 }, k + 1).catch(() => {});
      }
      const drafted = await page.$eval("[data-tour-drafted]", el => el.getAttribute("data-tour-drafted")).catch(() => null);
      check(`${label}: 2 Drafts counted`, Number(drafted) >= 2, `drafted ${drafted}`);
      check(`${label}: live_run — the demonstration`, await waitStep(page, "live_run", 30000) && await page.waitForSelector("[data-trial-demo]", { timeout: 15000 }).then(() => true).catch(() => false),
        `on ${await stepOf(page)}`);
      // The consent box is the person's to tick (D36) — once per pick, as a tester would.
      for (let k = 0; k < 2; k++) {
        const tick = await page.waitForSelector("[data-demo-consent]", { timeout: 90000 }).catch(() => null);
        if (!tick) break;
        await tick.evaluate(el => el.click());
        await page.waitForFunction(() => !document.querySelector("[data-demo-consent]"), { timeout: 10000 }).catch(() => {});
      }
      await shot(page, `${label}-${WALKED.indexOf("live_run") + 1}-live-run`);
      check(`${label}: the demonstration ends on The Table`, await waitStep(page, "table", 240000), `on ${await stepOf(page)}`);
      check(`${label}: The Table is lit`, await lit(page));
      await shot(page, `${label}-${WALKED.indexOf("table") + 1}-table`);
      const invite = await page.waitForSelector("[data-survey-invite-open]", { timeout: 30000 }).then(() => true).catch(() => false);
      check(`${label}: the tour ends in the survey's pop-up`, invite);
      if (invite) await page.click("[data-survey-invite-open]");
      check(`${label}: the survey opens`, await page.waitForSelector("[data-trial-survey]", { timeout: 10000 }).then(() => true).catch(() => false));
      check(`${label}: no Skip the survey`, !(await page.evaluate(() => /Skip the survey/.test(document.body.innerText))));
      await shot(page, `${label}-survey`);
    } else {
      // Skip, as a person presses it: once the caption is shown (44e: it shows within LOST_MS even with no target).
      await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-guided-tour]")).opacity === "1", { timeout: 10000 }).catch(() => {});
      await page.$eval("[data-tour-skip]", el => el.click());
      const gone = await page.waitForFunction(() => !document.querySelector("[data-guided-tour]"), { timeout: 5000 }).then(() => true).catch(() => false);
      check(`${label}: Skip to the survey ends the tour`, gone);
      // 44b: leaving the tour ends the trial into the survey, never into the open app.
      check(`${label}: Skip opens the survey`, await page.waitForSelector("[data-trial-survey]", { timeout: 8000 }).then(() => true).catch(() => false));
      check(`${label}: no Skip the survey`, !(await page.evaluate(() => /Skip the survey/.test(document.body.innerText))));
    }
    // 44b: the sequence cannot be broken before the survey — a reload or a typed URL lands on it, on either road.
    for (const to of ["/app", "/app/house", "/app/atlas"]) {
      await page.goto(BASE + to, { waitUntil: "networkidle2" });
      const onSurvey = await page.waitForSelector("[data-trial-survey], [data-survey-invite]", { timeout: 10000 }).then(() => true).catch(() => false);
      check(`${label}: ${to} before the survey is answered shows the survey, not the site`, onSurvey);
    }
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

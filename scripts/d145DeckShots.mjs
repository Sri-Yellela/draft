#!/usr/bin/env node
// ⭐ D145 STEP 3 · THE DECK CARD AND NAVIGATION, WALKED — in a real Chrome against a LOCAL draft (DRAFT_TRIAL=on, a copy
// of a migrated database). A trial account (/try, sample A) is dealt its frozen cards with their score, so the card is
// the one testers see. For each width × theme × navigation × text size it screenshots the folded card, the card under
// the pointer, "Why this job" open, and the navigation (the dock risen / the menu's panel open), and checks:
//   · Pass · Save · Draft are OUTSIDE the card · the match sits at the card's top right and no "ATS" is on the card
//   · the info row is salary / job type / work mode only · no "posted" or "ago" beside the location
//   · a scroll down on the card opens "Why this job" and a scroll up folds it
//   · the dock or the Menu button is the navigation on screen (never both), and the panel's buttons are the dock's
//   · no horizontal scroll (the page is no wider than the window) — including 390 px on Largest
// LOCAL ONLY (refuses a non-localhost base). Screenshots go to docs/d145-shots/ (untracked).
//   node scripts/d145DeckShots.mjs [--base http://localhost:3962] [--out docs/d145-shots] [--only 390-dusk-dark-menu-largest]
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3962");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = arg("--out", "docs/d145-shots");
const ONLY = arg("--only", null);
fs.mkdirSync(OUT, { recursive: true });

const RUNS = [
  // [width, height, theme, navigation, text]
  [1280, 800, "dusk-dark", "auto", "default"],
  [1280, 800, "dusk-light", "menu", "default"],
  [1280, 800, "paper-light", "auto", "default"],
  [1280, 800, "dusk-dark", "auto", "largest"],
  [390, 844, "dusk-dark", "auto", "default"],
  [390, 844, "dusk-dark", "menu", "largest"],
  [390, 844, "charcoal-dark", "dock", "largest"],
];
const rows = [];
let failed = 0;
const check = (where, name, ok, detail = "") => { rows.push({ where, name, ok: !!ok, detail }); if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${where} · ${name}${detail ? ` — ${detail}` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launchBrowser({ headless: true });
try {
  for (const [w, h, theme, nav, text] of RUNS) {
    const where = `${w}-${theme}-${nav}-${text}`;
    if (ONLY && ONLY !== where) continue;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    // The appearance is stored BEFORE the app loads, so the pre-paint script and the registry read it.
    const flags = [theme, nav !== "auto" ? `navigation=${nav}` : null, text !== "default" ? `text=${text}` : null].filter(Boolean).join(";");
    await page.evaluateOnNewDocument((v) => { try { localStorage.setItem("draft-theme", v); } catch {} }, flags);
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    // A synthetic tester (the same sign-up d129TourShots makes).
    const user = `d145${Date.now().toString(36)}`;
    const signed = await page.evaluate(async (u) => {
      localStorage.setItem("draft.trialIntent", "1");
      const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } }) });
      const j = await res.json().catch(() => ({}));
      if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
      return res.status === 200;
    }, user);
    if (!signed) { check(where, "sign-up", false); await ctx.close(); continue; }
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    if (!await page.waitForSelector('[data-trial-choice="A"] button', { timeout: 60000 }).then(() => true).catch(() => false)) { check(where, "sample A offered", false); await ctx.close(); continue; }
    await page.click('[data-trial-choice="A"] button');
    await page.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 60000 }).catch(() => {});
    // The tour may start; close it (its own Esc / skip), then read the deck as a person would.
    await wait(1500);
    // ⛔ Not its Skip — that ends the trial's tour into the survey. The tour is left running and its overlay hidden, so
    // the card is read as it is under the tour.
    await page.addStyleTag({ content: "[data-guided-tour],[data-tour-spotlight],[data-tour-dim]{display:none!important}" });
    if (!await page.waitForSelector('[data-face="up"] [data-deck-head]', { timeout: 60000 }).then(() => true).catch(() => false)) {
      check(where, "the deck dealt a face-up card", false); await page.screenshot({ path: path.join(OUT, `${where}-0-nodeck.png`) }); await ctx.close(); continue;
    }
    await wait(6000);   // the deal, the tour's sweep, the flip
    await page.mouse.move(5, 5);
    await wait(500);
    await page.screenshot({ path: path.join(OUT, `${where}-1-folded.png`) });

    const r = await page.evaluate(() => {
      const face = document.querySelector('[data-face="up"] article');
      const fr = face.getBoundingClientRect();
      const acts = document.querySelector("[data-deck-actions]");
      const ar = acts.getBoundingClientRect();
      const head = face.querySelector("[data-deck-head]"), match = face.querySelector("[data-deck-signal-row]");
      const mr = match?.getBoundingClientRect(), hr = head.getBoundingClientRect();
      const info = [...face.querySelectorAll("[data-deck-info-item]")].map(e => e.getAttribute("data-deck-info-item"));
      const loc = face.querySelector("[data-deck-location]")?.innerText || "";
      const visible = (el) => !!el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0;
      const dock = document.querySelector("[data-nav-dock]"), btn = document.querySelector("[data-nav-menu-button]");
      return {
        actionsOutside: !face.contains(acts) && ar.top >= fr.bottom - 1,
        matchTopRight: !!mr && mr.right >= hr.right - 2 && mr.top <= hr.top + 12,
        noAts: !/\bATS\b/.test(face.innerText),
        info, loc,
        dock: visible(dock), menu: visible(btn),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        tops: [document.documentElement.style.getPropertyValue("--shape-radius-card"), getComputedStyle(document.documentElement).getPropertyValue("--type-scale")],
      };
    });
    check(where, "Pass · Save · Draft are outside the card, below it", r.actionsOutside);
    check(where, "the match is at the card's top right", r.matchTopRight);
    check(where, "no \"ATS\" on the card", r.noAts);
    check(where, "the info row is salary / job type / work mode only", r.info.every(k => ["salary", "type", "mode"].includes(k)), r.info.join(","));
    check(where, "no \"posted\" / \"ago\" beside the location", !/posted|ago\b/i.test(r.loc), r.loc);
    check(where, "exactly one navigation on screen", r.dock !== r.menu, `dock ${r.dock} · menu ${r.menu}`);
    if (nav === "dock") check(where, "Dock chosen → the dock", r.dock);
    if (nav === "menu") check(where, "Menu chosen → the Menu button", r.menu);
    if (nav === "auto") check(where, `Automatic at ${w} → ${w < 640 ? "Menu" : "Dock"}`, w < 640 ? r.menu : r.dock);
    check(where, "no horizontal scroll", r.overflow <= 0, `${r.overflow}px`);

    // Hover: the soft facts and "Why this job?".
    const box = await page.$eval('[data-face="up"] [data-deck-head]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 3, y: b.y + b.height / 2 }; });
    await page.mouse.move(box.x, box.y);
    await wait(700);
    await page.screenshot({ path: path.join(OUT, `${where}-2-hover.png`) });
    // Scroll down on the card → "Why this job".
    await page.mouse.wheel({ deltaY: 120 });
    const opened = await page.waitForFunction(() => document.querySelector('[data-face="up"] [data-deck-why-button]')?.getAttribute("aria-expanded") === "true", { timeout: 3000 }).then(() => true).catch(() => false);
    await wait(700);
    check(where, "a scroll down on the card opens \"Why this job\"", opened);
    await page.screenshot({ path: path.join(OUT, `${where}-3-why.png`), fullPage: true });
    const o2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(where, "no horizontal scroll with \"Why this job\" open", o2 <= 0, `${o2}px`);
    await wait(400);
    await page.mouse.wheel({ deltaY: -120 });
    const folded = await page.waitForFunction(() => document.querySelector('[data-face="up"] [data-deck-why-button]')?.getAttribute("aria-expanded") === "false", { timeout: 3000 }).then(() => true).catch(() => false);
    check(where, "a scroll up folds it", folded);

    // The navigation.
    if (r.dock) {
      await page.mouse.move(w / 2, h - 10);
      await wait(700);
      const up = await page.$eval("[data-nav-dock]", (d) => { const b = d.getBoundingClientRect(); return b.bottom <= window.innerHeight; });
      check(where, "the dock rises when the pointer nears the bottom edge", up);
      await page.screenshot({ path: path.join(OUT, `${where}-4-dock.png`) });
    } else {
      await page.click("[data-nav-menu-button]");
      await wait(600);
      const same = await page.evaluate(() => {
        // textContent: the dock is display:none in Menu mode, and innerText of a hidden element is laid out differently.
        const a = [...document.querySelectorAll("[data-nav-dock] [data-nav-item]")].map(e => e.textContent.replace(/\s+/g, " ").trim());
        const b = [...document.querySelectorAll("[data-nav-panel] [data-nav-item]")].map(e => e.textContent.replace(/\s+/g, " ").trim());
        const p = document.querySelector("[data-nav-panel]").getBoundingClientRect();
        return { same: JSON.stringify(a) === JSON.stringify(b), n: b.length, inView: p.right <= window.innerWidth + 1 && p.left < window.innerWidth };
      });
      check(where, "the menu's panel opens from the right", same.inView);
      check(where, "the panel's buttons are exactly the dock's", same.same && same.n === 5, `${same.n}`);
      await page.screenshot({ path: path.join(OUT, `${where}-4-menu.png`) });
      await page.keyboard.press("Escape");
      await wait(500);
      const shut = await page.$eval("[data-nav-panel]", (p) => p.getAttribute("data-open") === "false");
      check(where, "Esc closes the panel", shut);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "checks.json"), JSON.stringify(rows, null, 2));
console.log(`\n${rows.length - failed} / ${rows.length} checks passed → ${OUT}`);
process.exit(failed ? 1 : 0);

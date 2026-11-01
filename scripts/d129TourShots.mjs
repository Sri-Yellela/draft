#!/usr/bin/env node
// ⭐ D129 · THE TOUR'S PROOF (the owner's bug report, 11-01): every step screenshotted at 1280 × 800, 800 × 900 and
// 390 × 844, in Paper Light and Charcoal Dark, with per-step checks — the target's centre is the target (nothing over
// it: document.elementFromPoint), the popover covers neither the target nor the navigation, the spotlight is a clear
// cut-out (no fill). LOCAL ONLY (refuses a non-localhost base): boot draft on a COPY of a migrated board with
// DRAFT_TRIAL=on. Screenshots go to docs/tour-shots/ (untracked) for the owner to flip through before a link goes out.
//
//   node scripts/d129TourShots.mjs [--base http://localhost:3917] [--out docs/tour-shots] [--only 1280x800-light]
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = arg("--out", "docs/tour-shots");
const ONLY = arg("--only", null);
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[1280, 800], [800, 900], [390, 844]];
const THEMES = [["light", "light"], ["dark", "dark"]];   // draft-theme values: "light" = Paper Light, "dark" = Charcoal Dark
const rows = [];
let failed = 0;
const check = (where, name, ok, detail = "") => { rows.push({ where, name, ok, detail }); if (!ok) failed++; };

async function inspect(page) {
  return page.evaluate(() => {
    const pop = document.querySelector("[data-guided-tour]");
    if (!pop) return null;
    const sel = pop.getAttribute("data-tour-target");
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height }; };
    const target = sel ? document.querySelector(sel) : null;
    const t = box(target), p = box(pop);
    const nav = box(document.querySelector('nav[aria-label="Main"]'));
    let centreOk = null, hitDesc = "";
    if (t) {
      const cx = Math.min(window.innerWidth - 1, Math.max(0, t.left + t.width / 2));
      const cy = Math.min(window.innerHeight - 1, Math.max(0, t.top + Math.min(t.height, window.innerHeight) / 2));
      const hit = document.elementFromPoint(cx, cy);
      centreOk = !!hit && (hit === target || target.contains(hit));
      hitDesc = hit ? `${hit.tagName.toLowerCase()}${hit.id ? "#" + hit.id : ""}${hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : ""}` : "nothing";
    }
    const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)) : 0);
    const spot = document.querySelector("[data-tour-spotlight]");
    const fill = spot ? getComputedStyle(spot).backgroundColor : null;
    return { id: pop.getAttribute("data-guided-tour"), side: pop.getAttribute("data-tour-side"), sel, t, p, nav, centreOk, hitDesc,
             overTarget: t ? ov(p, t) : 0, targetArea: t ? t.width * t.height : 0, overNav: ov(p, nav),
             fill, progress: document.querySelector("[data-tour-progress]")?.innerText || "",
             drafted: document.querySelector("[data-tour-drafted]")?.innerText || null,
             score: document.querySelector("[data-deck-score]")?.innerText || null };
  });
}

const browser = await launchBrowser({ headless: "new" });
try {
  for (const [w, h] of SIZES) for (const [theme, pref] of THEMES) {
    const where = `${w}x${h}-${theme}`;
    if (ONLY && ONLY !== where) continue;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    await page.evaluateOnNewDocument((p) => { try { localStorage.setItem("draft-theme", p); } catch {} }, pref);
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    const user = `shot${Date.now().toString(36)}`;
    const ok = await page.evaluate(async (u) => {
      localStorage.setItem("draft.trialIntent", "1");
      const r = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } }) });
      const j = await r.json().catch(() => ({}));
      if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
      return r.status === 200;
    }, user);
    check(where, "sign-up", ok);
    await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
    if (!await page.waitForSelector('[data-trial-choice="A"] button', { timeout: 60000 }).then(() => true).catch(() => false)) { check(where, "sample A offered", false); await ctx.close(); continue; }
    await page.click('[data-trial-choice="A"] button');

    for (let n = 0; n < 16; n++) {
      if (!await page.waitForSelector("[data-guided-tour]", { timeout: 45000 }).then(() => true).catch(() => false)) { check(where, `step ${n + 1} appears`, false); break; }
      const id = await page.$eval("[data-guided-tour]", el => el.getAttribute("data-guided-tour"));
      const hasTarget = await page.$eval("[data-guided-tour]", el => !!el.getAttribute("data-tour-target"));
      if (hasTarget) await page.waitForSelector("[data-tour-spotlight]", { timeout: 40000 }).catch(() => {});
      await new Promise(r => setTimeout(r, id === "deck" ? 9000 : 900));      // the deal's sweep, or the step settling
      const s = await inspect(page);
      const tag = `${String(n + 1).padStart(2, "0")}-${id}`;
      await page.screenshot({ path: path.join(OUT, `${where}-${tag}.jpg`), type: "jpeg", quality: 70 });
      if (s?.sel) {
        check(where, `${tag}: the target is on screen`, !!s.t, s.sel);
        check(where, `${tag}: nothing covers the target`, s.centreOk === true, `hit ${s.hitDesc}`);
        const share = s.targetArea ? s.overTarget / s.targetArea : 0;
        // A target larger than the screen (the whole deck on a phone) may share some area with the sheet; never its centre.
        check(where, `${tag}: the popover is off the target`, s.overTarget === 0 || (share < 0.25 && s.centreOk), `${Math.round(share * 100)}% · ${s.side}`);
        check(where, `${tag}: the spotlight is a cut-out`, /rgba\(0, 0, 0, 0\)|transparent/.test(String(s.fill)), String(s.fill));
      }
      check(where, `${tag}: the popover is off the navigation`, (s?.overNav ?? 0) === 0, s?.side || "");
      if (id === "deck_match") check(where, `${tag}: the match shows a number`, /\d+%/.test(s?.score || ""), s?.score || "no score");
      if (id === "pick_two") check(where, `${tag}: "Drafted N of 2"`, /Drafted \d of 2/.test(s?.drafted || ""), s?.drafted || "none");
      if (id === "survey") break;
      if (id === "filters") {
        await page.evaluate(() => { const el = [...document.querySelectorAll("[data-slot]")].find(e => e.getClientRects().length); el?.click(); });
        await page.waitForFunction(() => !document.querySelector("[data-tour-next]")?.disabled, { timeout: 8000 }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
      }
      if (id === "pick_two") {
        // Draft 2 cards for real (the Draft button of the front card, twice); the tour moves on by itself.
        for (let d = 0; d < 2; d++) {
          await page.evaluate(() => document.querySelector('[data-deck-actions] [aria-keyshortcuts="D ArrowRight"]')?.click());
          await new Promise(r => setTimeout(r, 2500));
        }
        const moved = await page.waitForSelector('[data-guided-tour="live_run"]', { timeout: 30000 }).then(() => true).catch(() => false);
        check(where, `${tag}: 2 Drafts take the tour on by itself`, moved);
        if (!moved) break;
        continue;
      }
      if (id === "live_run") {
        check(where, `${tag}: the demonstration is labelled`, !!(await page.$("[data-demo-tag]")));
        // the sample résumé and the tailored one, side by side, the tailored lines marked
        const cmp = await page.waitForSelector("[data-demo-compare]", { timeout: 30000 }).then(() => true).catch(() => false);
        const pages = cmp ? await page.evaluate(() => ({ sample: !!document.querySelector('[data-demo-page="sample"]'),
          tailored: !!document.querySelector('[data-demo-page="tailored"]'), marked: document.querySelectorAll("[data-demo-line]").length })) : {};
        check(where, `${tag}: the sample and the tailored résumé side by side`, cmp && pages.sample && pages.tailored && pages.marked > 0, JSON.stringify(pages));
        if (cmp) {
          await page.$eval("[data-demo-compare]", el => el.scrollIntoView({ block: "center" }));
          await new Promise(r => setTimeout(r, 1500));      // the popover re-places after the scroll
          await page.screenshot({ path: path.join(OUT, `${where}-${tag}-tailoring.jpg`), type: "jpeg", quality: 70 });
        }
        for (let c = 0; c < 2; c++) {
          const at = await page.waitForSelector("[data-demo-consent]", { timeout: 120000 }).then(() => true).catch(() => false);
          if (!at) break;
          if (c === 0) await page.screenshot({ path: path.join(OUT, `${where}-${tag}-consent.jpg`), type: "jpeg", quality: 70 });
          await page.click("[data-demo-consent]");
          await new Promise(r => setTimeout(r, 1500));
        }
        const table = await page.waitForSelector('[data-guided-tour="table"]', { timeout: 60000 }).then(() => true).catch(() => false);
        check(where, `${tag}: the demonstration ends on The Table`, table);
        if (!table) break;
        continue;
      }
      if (id === "table") {
        const table = await page.evaluate(() => document.querySelector("[data-table-split]")?.innerText || "");
        check(where, `${tag}: The Table shows the two as Sent`, /Sent ·/.test(table) && !/Drafted — in Draft House/.test(table), table.slice(0, 160).replace(/\s+/g, " "));
        const survey = await page.waitForSelector("[data-trial-survey]", { timeout: 60000 }).then(() => true).catch(() => false);
        check(where, `${tag}: The Table, then the survey opens by itself`, survey);
        if (survey) await page.screenshot({ path: path.join(OUT, `${where}-${String(n + 2).padStart(2, "0")}-survey.jpg`), type: "jpeg", quality: 70 });
        if (survey) {
          // Answer the required questions, send, choose Explore, press Draft: the locked pop-up names their email.
          await page.evaluate(() => {
            for (const sel of document.querySelectorAll("[data-survey-q] select")) {
              const opt = [...sel.options].find(o => o.value); if (!opt) continue;
              const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
              set.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          await page.click("[data-survey-send]");
          const choice = await page.waitForSelector("[data-trial-explore]", { timeout: 15000 }).then(() => true).catch(() => false);
          check(where, "the thank-you offers Explore", choice);
          if (choice) {
            await page.screenshot({ path: path.join(OUT, `${where}-90-thanks.jpg`), type: "jpeg", quality: 70 });
            await page.click("[data-trial-explore]");
            await page.goto(`${BASE}/app/today`, { waitUntil: "networkidle2" });
            await page.waitForSelector("[data-deck-actions]", { timeout: 30000 }).catch(() => {});
            await page.evaluate(() => document.querySelector('[data-deck-actions] [aria-keyshortcuts="D ArrowRight"]')?.click());
            const pop = await page.waitForSelector("[data-explore-popup]", { timeout: 8000 }).then(h => h.evaluate(el => el.innerText)).catch(() => "");
            check(where, "explore: Draft opens Coming soon with their email", /Coming soon/.test(pop) && /@example\.com/.test(pop), pop.slice(0, 120));
            await page.screenshot({ path: path.join(OUT, `${where}-91-explore-locked.jpg`), type: "jpeg", quality: 70 });
          }
        }
        break;
      }
      await page.$eval("[data-tour-next]", el => el.click());
      await page.waitForFunction((prev) => document.querySelector("[data-guided-tour]")?.getAttribute("data-guided-tour") !== prev, { timeout: 15000 }, id).catch(() => {});
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
const bad = rows.filter(r => !r.ok);
console.log(`${rows.length} checks · ${bad.length} failed · screenshots in ${OUT}`);
for (const r of bad) console.log(`FAIL  ${r.where}  ${r.name}  — ${r.detail}`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// ⭐ A111 P4 · THE TRIAL'S "USE MY OWN RÉSUMÉ" PATHWAY, WALKED IN A REAL CHROME against a LOCAL draft on a THROWAWAY copy of
// the board (never production — a walk there would count as a tester in the owner's trial numbers). Boot first:
//   COOKIE_ENCRYPTION_KEY=<random> RM_DATA_DIR=<temp dir holding a COPY of data/resume_master.db> PORT=3917 DRAFT_TRIAL=on node server.js
// then:
//   node scripts/a111OwnResumeWalk.mjs --db <that copy>/resume_master.db [--base http://localhost:3917] [--shots <dir>]
//        [--seed]  (ONLY on a throwaway walk DB: adds SYNTHETIC postings labelled "a111-walk-seed" so a field with < 10
//                   real good picks can still walk the happy path; reported as seeded)
//
// The walk, at 1280 × 860 and 390 × 844: the switch OFF → /try has no own card and POST /api/trial/resume {own} is 409
// own_resume_off; the switch ON (written to the walk DB's app_settings) → per synthetic résumé (test-support/a111Resumes.mjs:
// an analyst uploaded as a PDF made by Chrome itself, a project manager pasted, a nurse pasted): a synthetic sign-up → /try's
// own card → the field in plain words (or, for the nurse, "Your field isn't live yet" with the samples still offered) →
// Continue (the normal onboarding) → the deck: score ring + why → a pick's report with the role against the résumé → the
// guided tour to "pick 2" → 2 Drafts → the demonstration on the OWN résumé (its tailoring beside the original, the form
// from its contact lines) → The Table, both Sent → the survey → explore, view-only. Fictional people only.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { launchBrowser } from "../services/browserLauncher.js";
import { ANALYST, PROJECT_MANAGER, NURSE } from "../test-support/a111Resumes.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const DB = arg("--db", null);
if (!DB || /WebstormProjects[\\/]draft[\\/]data[\\/]/i.test(path.resolve(DB))) { console.error("REFUSING: --db must be a throwaway COPY (not data/resume_master.db)"); process.exit(2); }
const SHOTS = arg("--shots", "docs/a111-shots");
const SEED = process.argv.includes("--seed");
const ONLY = arg("--only", null);   // e.g. "desktop" or "phone"
fs.mkdirSync(SHOTS, { recursive: true });

const rows = [];
const check = (where, name, ok, detail = "") => { rows.push({ where, name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${where}  ${name}${detail ? `  — ${detail}` : ""}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const text = (page) => page.evaluate(() => document.body.innerText);
const exists = (page, sel, ms) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

// ── the walk DB: the switch, the measured counts, and (only with --seed) synthetic postings ─────────────────────
const db = new Database(DB);
db.pragma("busy_timeout = 5000");
const setSwitch = (on) => db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('trial_own_resume', ?, unixepoch())
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(on ? "1" : "0");
const counts = Object.fromEntries(db.prepare(`SELECT COALESCE(board_category, '(null)') k, COUNT(*) n FROM scraped_jobs
  WHERE is_active = 1 AND duplicate_of IS NULL GROUP BY 1`).all().map(r => [r.k, r.n]));
console.log("active postings by category (walk copy):", JSON.stringify(counts));
if (SEED) {
  const ins = db.prepare(`INSERT OR IGNORE INTO scraped_jobs (job_id, search_query, _hash, title, company, url, apply_url, source, is_active, discovered_at,
    description, board_category, bucket_seniority, level_read) VALUES (?, 'a111-walk-seed', ?, ?, ?, ?, ?, 'greenhouse', 1, unixepoch(), ?, ?, ?, ?)`);
  const seed = (cat, level, titles, desc, n) => { for (let i = 0; i < n; i++) { const id = `a111seed::${cat}-${i}`;
    ins.run(id, `a111seed-${cat}-${i}`, titles[i % titles.length], `Synthetic Co ${String.fromCharCode(65 + i)} (walk seed)`, `https://example.com/a111/${cat}/${i}`,
      `https://example.com/a111/${cat}/${i}`, `${desc} Synthetic posting ${i} for the A111 walk (a111-walk-seed).`, cat, level, level); } };
  seed("business", "mid", ["Financial Analyst", "FP&A Analyst", "Business Analyst", "Senior Financial Analyst"],
    "Own forecasting and variance analysis for the business; budgeting and financial modeling in Excel; dashboards in Tableau and Power BI; SQL against the warehouse; requirements gathering with stakeholders. 2+ years.", 12);
  seed("management", "senior", ["Project Manager", "Senior Project Manager", "Program Manager", "Operations Project Manager"],
    "Lead project planning, scheduling and risk management across cross-functional teams; Agile and Scrum; MS Project, Smartsheet and Jira; stakeholder management, budget management and change management; PMP preferred. 5+ years.", 12);
  console.log("SEEDED 24 synthetic postings (a111-walk-seed) into the throwaway walk DB: 12 business, 12 management");
}

/** A PDF of the résumé, made by Chrome itself (the upload path: /api/parse-pdf reads its text layer). */
async function pdfOf(browser, textBody, file) {
  const p = await browser.newPage();
  await p.setContent(`<pre style="font:12px/1.4 Arial,sans-serif;white-space:pre-wrap">${textBody.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>`);
  await p.pdf({ path: file, format: "Letter" });
  await p.close();
  return file;
}

async function signUp(page, tag) {
  await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
  const user = `a111${tag}${Date.now().toString(36)}`;
  return page.evaluate(async (u) => {
    localStorage.setItem("draft.trialIntent", "1");
    const r = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Walk", last_name: "Tester" } }) });
    const j = await r.json().catch(() => ({}));
    if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
    return r.status;
  }, user);
}

async function readOwn(page, where, { resume, pdf = null }) {
  await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
  if (!await exists(page, "[data-trial-own-resume]", 60000)) { check(where, "/try offers Use my own résumé (switch on)", false); return false; }
  check(where, "/try offers Use my own résumé (switch on)", true);
  if (pdf) {
    const input = await page.$("[data-own-file]");
    await input.uploadFile(pdf);
  } else {
    await page.click("[data-own-paste-toggle]");
    await page.waitForSelector("[data-own-paste]");
    await page.$eval("[data-own-paste]", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, resume);
    await page.click("[data-own-read]");
  }
  return page.waitForSelector("[data-own-field], [data-own-not-live]", { timeout: 90000 }).then(() => true).catch(() => false);
}

async function walkHappy(browser, label, viewport, who) {
  const where = `${label}/${who.name}`;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  check(where, "a synthetic sign-up", (await signUp(page, `${label[0]}${who.name[0]}`)) === 200);
  const pdf = who.pdf ? await pdfOf(browser, who.resume, path.resolve(SHOTS, `${who.name}.pdf`)) : null;
  if (!await readOwn(page, where, { resume: who.resume, pdf })) { check(where, "the field is read", false); await ctx.close(); return; }
  await shot(page, `${label}-${who.name}-1-field`);
  const notLive = await page.$("[data-own-not-live]");
  if (notLive) {
    const t = await page.$eval("[data-own-not-live]", el => el.innerText);
    check(where, `step 2: the field is live (${who.expect})`, false, t.replace(/\s+/g, " ").slice(0, 200));
    await ctx.close(); return;
  }
  const words = await page.$eval("[data-own-field-words]", el => el.innerText);
  const cat = await page.$eval("[data-own-field]", el => el.getAttribute("data-own-field"));
  check(where, "step 1-2: the field in plain words", cat === who.expect, `${words} (${cat})`);
  await page.click("[data-own-continue]");
  await page.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 60000 }).catch(() => {});
  // step 3: the deck — the score ring and the why marks, from the résumé's own category
  const deck = await exists(page, "[data-trial-match]", 120000);
  check(where, "step 3: a pick card shows the score ring + why", deck && !!(await page.$("[data-deck-score]")) && !!(await page.$("[data-trial-chips]")));
  const picks = await page.evaluate(() => fetch("/api/trial/picks", { credentials: "include" }).then(r => r.json()));
  const cats = await page.evaluate(() => fetch("/api/draft/today", { credentials: "include" }).then(r => r.json()).then(d => d.cards?.map(c => c.job?.title) || []));
  check(where, "step 3: 10 picks from the résumé's own category", picks.category === who.expect && (picks.picks || []).length === 10,
    `${picks.category} · ${(picks.picks || []).length} picks · deck ${cats.length} cards: ${cats.slice(0, 4).join(" | ")}`);
  // step 4 (inside the tour, once the deck is dealt — its "match" step says "press it for the full report")
  const roleFit = async () => {
    await page.evaluate(() => document.querySelector('[data-fan-offset="0"] [data-deck-signal]')?.click());
    const fit = await exists(page, "[data-trial-role-fit]", 30000);
    const fitText = fit ? await page.$eval("[data-trial-role-fit]", el => el.innerText) : "";
    check(where, "step 4: the pick's report shows the role against the résumé", fit && /against your résumé/i.test(fitText), fitText.replace(/\s+/g, " ").slice(0, 240));
    if (fit) {
      await page.$eval("[data-trial-role-fit]", el => el.scrollIntoView({ block: "center" })); await sleep(1200);
      const vis = await page.$eval("[data-trial-role-fit]", el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; });
      check(where, "step 4: the role panel is on screen", vis);
      await shot(page, `${label}-${who.name}-3-role-fit`);
    }
    await page.evaluate(() => [...document.querySelectorAll("[data-deck-sheet] button")].find(b => /Close/.test(b.innerText))?.click());
    await sleep(600);
  };
  // the tour, step by step, to "your turn: pick 2"
  let reachedPick = false, fitDone = false;
  for (let n = 0; n < 16; n++) {
    if (!await exists(page, "[data-guided-tour]", 45000)) break;
    const id = await page.$eval("[data-guided-tour]", el => el.getAttribute("data-guided-tour"));
    await sleep(id === "deck" ? 9000 : 900);
    if (id === "deck") await shot(page, `${label}-${who.name}-2-deck`);
    if (id === "deck_match" && !fitDone) { fitDone = true; await roleFit(); }
    if (id === "pick_two") { reachedPick = true; break; }
    if (id === "filters") {
      await page.evaluate(() => { const el = [...document.querySelectorAll("[data-slot]")].find(e => e.getClientRects().length); el?.click(); });
      await page.waitForFunction(() => !document.querySelector("[data-tour-next]")?.disabled, { timeout: 8000 }).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
    }
    await page.$eval("[data-tour-next]", el => el.click()).catch(() => {});
    await page.waitForFunction((prev) => document.querySelector("[data-guided-tour]")?.getAttribute("data-guided-tour") !== prev, { timeout: 15000 }, id).catch(() => {});
  }
  check(where, "the guided tour reaches \"pick 2\"", reachedPick);
  if (!reachedPick) { await ctx.close(); return; }
  for (let d = 0; d < 2; d++) {
    await page.evaluate(() => document.querySelector('[data-deck-actions] [aria-keyshortcuts="D ArrowRight"]')?.click());
    await sleep(2500);
  }
  const live = await exists(page, '[data-guided-tour="live_run"]', 45000);
  check(where, "step 5: 2 Drafts start the demonstration", live);
  if (!live) { await ctx.close(); return; }
  // the demonstration on the OWN résumé: its text on the left, tailored on the right, the form from its contact lines
  const demo = await page.evaluate(() => fetch("/api/trial/demo", { credentials: "include" }).then(r => r.json()));
  const fields = Object.fromEntries((demo.fields || []).map(f => [f.label, f.value]));
  check(where, "step 5: the demonstration runs on the OWN résumé", demo.ok && demo.own === true && demo.runs?.length === 2, `own ${demo.own} · runs ${demo.runs?.length}`);
  check(where, "step 5: the form from the résumé's own contact lines", fields["First name"] === who.first && fields.Email === who.email, JSON.stringify(fields));
  const added = (demo.runs || []).flatMap(r => r.tailoring.after.filter(l => l.change === "added").map(l => l.text)).join(" ");
  const terms = (demo.runs || []).flatMap(r => r.tailoring.terms);
  const lower = who.resume.toLowerCase();
  check(where, "step 5: tailoring adds no skill the résumé lacks", terms.every(t => lower.includes(t.toLowerCase())), `terms ${terms.join(", ")}`);
  const cmp = await exists(page, "[data-demo-compare]", 40000);
  const title = cmp ? await page.$eval("[data-demo-compare]", el => el.innerText.slice(0, 400)) : "";
  check(where, "step 5: \"Your résumé\" beside the tailored one", cmp && /Your résumé/i.test(title) && !!(await page.$('[data-demo-page="tailored"]')), added.slice(0, 120));
  if (cmp) { await page.$eval("[data-demo-compare]", el => el.scrollIntoView({ block: "center" })); await sleep(1500); await shot(page, `${label}-${who.name}-4-tailoring`); }
  for (let c = 0; c < 2; c++) {
    if (!await exists(page, "[data-demo-consent]", 120000)) break;
    if (c === 0) { await sleep(500); await shot(page, `${label}-${who.name}-5-form`); }
    await page.click("[data-demo-consent]");
    await sleep(1500);
  }
  const table = await exists(page, '[data-guided-tour="table"]', 90000);
  // The Table loads its list after the step opens: wait for two Sent rows before reading it
  if (table) await page.waitForFunction(() => ((document.querySelector("[data-table-split]")?.innerText || "").match(/Sent ·/g) || []).length >= 2, { timeout: 20000 }).catch(() => {});
  const tableText = table ? await page.evaluate(() => document.querySelector("[data-table-split]")?.innerText || "") : "";
  check(where, "step 5: The Table shows both Sent", table && (tableText.match(/Sent ·/g) || []).length >= 2 && !/Drafted — in Draft House/.test(tableText), tableText.slice(0, 160).replace(/\s+/g, " "));
  if (table) await shot(page, `${label}-${who.name}-6-table`);
  const inbox = await page.evaluate(() => fetch("/api/trial/state", { credentials: "include" }).then(r => r.json()));
  check(where, "step 5: the trial locks into the survey (2 sent)", inbox.locked === true && inbox.sent >= 2, `sent ${inbox.sent}`);
  // step 6: the survey, then explore view-only
  const invite = await exists(page, "[data-survey-invite-open]", 60000);
  if (invite) await page.click("[data-survey-invite-open]");
  const survey = await exists(page, "[data-trial-survey]", 15000);
  check(where, "step 6: the survey opens from its button", survey);
  if (survey) {
    // the field question is prefilled from the OWN résumé's category (the tester may change it); the walk keeps it
    const prefill = await page.$eval('[data-survey-q="field"] select', s => s.value).catch(() => "");
    check(where, "step 6: the survey's field is prefilled from the résumé", prefill === who.field, prefill);
    await page.evaluate(() => {
      for (const sel of document.querySelectorAll("[data-survey-q] select")) {
        if (sel.value) continue;
        const opt = [...sel.options].find(o => o.value); if (!opt) continue;
        const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        set.call(sel, opt.value); sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const field = await page.evaluate(() => [...document.querySelectorAll("[data-survey-q] select")].map(s => s.value).join(" | "));
    await page.click("[data-survey-send]");
    const thanks = await exists(page, "[data-trial-explore]", 15000);
    check(where, "step 6: the survey is sent; Explore offered", thanks, field.slice(0, 100));
    if (thanks) {
      await page.click("[data-trial-explore]");
      await page.goto(`${BASE}/app/today`, { waitUntil: "networkidle2" });
      await page.waitForSelector("[data-deck-actions]", { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => document.querySelector('[data-deck-actions] [aria-keyshortcuts="D ArrowRight"]')?.click());
      const pop = await page.waitForSelector("[data-explore-popup]", { timeout: 8000 }).then(h => h.evaluate(el => el.innerText)).catch(() => "");
      check(where, "step 6: explore is view-only (Draft → Coming soon)", /Coming soon/.test(pop), pop.slice(0, 100));
      await shot(page, `${label}-${who.name}-7-explore`);
    }
  }
  await ctx.close();
}

async function walkNotLive(browser, label, viewport) {
  const where = `${label}/nurse`;
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  check(where, "a synthetic sign-up", (await signUp(page, `${label[0]}n`)) === 200);
  if (!await readOwn(page, where, { resume: NURSE })) { check(where, "the reading answers", false); await ctx.close(); return; }
  const honest = await page.$("[data-own-not-live]");
  const t = honest ? await page.$eval("[data-own-not-live]", el => el.innerText) : "";
  check(where, "step 2: a held field gets \"Your field isn't live yet\"", !!honest && /isn't live yet/.test(t), t.replace(/\s+/g, " ").slice(0, 200));
  await sleep(1200);   // the reading scrolls itself into view
  const inView = await page.$eval("[data-own-not-live]", el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; }).catch(() => false);
  check(where, "step 2: the honest line is brought into view", inView);
  await shot(page, `${label}-nurse-not-live-top`);
  const samples = await page.$$eval("[data-trial-choice]", els => els.map(e => e.getAttribute("data-trial-choice")));
  check(where, "step 2: the samples are still offered", samples.length > 0, samples.join(","));
  const saved = await page.evaluate(() => fetch("/api/trial/state", { credentials: "include" }).then(r => r.json()));
  check(where, "step 2: nothing saved for a field that isn't live", saved.hasProfile === false && saved.resume !== "own", JSON.stringify({ hasProfile: saved.hasProfile, resume: saved.resume }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(where, "no horizontal scroll", !overflow);
  await shot(page, `${label}-nurse-not-live`);
  await ctx.close();
}

async function walkOff(browser, label, viewport) {
  const where = `${label}/switch-off`;
  setSwitch(false);
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  check(where, "a synthetic sign-up", (await signUp(page, `${label[0]}o`)) === 200);
  await page.goto(`${BASE}/try`, { waitUntil: "networkidle2" });
  await page.waitForSelector("[data-trial-choice]", { timeout: 60000 }).catch(() => {});
  await sleep(800);
  check(where, "/try offers no own card", !(await page.$("[data-trial-own-resume]")) && !/Use my own résumé/.test(await text(page)));
  const r = await page.evaluate((c) => fetch("/api/trial/resume", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice: "own", content: c }) }).then(async x => ({ status: x.status, body: await x.json() })), ANALYST);
  check(where, "POST /api/trial/resume {own} → 409 own_resume_off", r.status === 409 && r.body.error === "own_resume_off", `${r.status} ${r.body.error}`);
  await shot(page, `${label}-0-switch-off`);
  await ctx.close();
  setSwitch(true);
}

const PEOPLE = [
  { name: "analyst", resume: ANALYST, pdf: true, expect: "business", field: "Business, finance or consulting", first: "Priya", email: "priya.delacroix@example.com" },
  { name: "pm", resume: PROJECT_MANAGER, pdf: false, expect: "management", field: "Product or project management", first: "Marcus", email: "marcus.oyelaran@example.com" },
];
const browser = await launchBrowser({ headless: "new" });
try {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    if (ONLY && ONLY !== label) continue;
    console.log(`\n── ${label} ──`);
    await walkOff(browser, label, viewport);
    await walkNotLive(browser, label, viewport);
    for (const who of PEOPLE) await walkHappy(browser, label, viewport, who);
  }
} catch (e) {
  check("walk", "no exception", false, e?.stack || String(e));
} finally {
  await browser.close();
  db.close();
}
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length} checks · ${bad.length} failed · screenshots in ${SHOTS}${SEED ? " · SEEDED synthetic postings (a111-walk-seed)" : ""}`);
for (const r of bad) console.log(`FAIL  ${r.where}  ${r.name}  — ${r.detail}`);
process.exit(bad.length ? 1 : 0);

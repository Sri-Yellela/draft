// D51–D54 + O80c · THE BROWSER PASS — the real app, a real server, headless Chrome.
//
//   node scripts/d51d54BrowserPass.mjs <base> <dbPath>
//
// Run against a THROWAWAY server only (RM_DATA_DIR on a copy, keys blanked, DAILY_DRAFT_SLOTS small so
// "out of drafts" is reachable, every posting URL pointed at the local fake ATS). The page's own
// requests that leave localhost are ABORTED. (domcontentloaded + selectors, never networkidle: the app holds
// its sync event stream open, so the network never goes idle.), so nothing reaches an employer or a third party.
// Writes screenshots to ../draft-screenshots/d51-d54 and prints one JSON report of what was SEEN.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const BASE = process.argv[2] || "http://127.0.0.1:3151";
const DB_PATH = process.argv[3];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT = path.resolve(ROOT, "..", "draft-screenshots", "d51-d54");
const USER = { username: `d5xpass${Date.now() % 100000}`, password: "Synthetic-Pass-51!" };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let cookie = "";
async function call(method, p, body) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const set = r.headers.get("set-cookie");
  if (set && /connect\.sid=/.test(set)) cookie = set.split(";")[0];
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const seen = { notes: [] };
  await call("POST", "/api/auth/register", { ...USER, profile: { email: `${USER.username}@example.invalid`, first_name: "Ada", last_name: "Synthetic", phone: "555-0100", city: "Boston", state: "MA" } });
  const dp = await call("POST", "/api/domain-profiles", { profile_name: "Platform", role_family: "engineering", domain: "general", seniority: "mid", target_titles: ["Software Engineer"] });
  await call("POST", `/api/domain-profiles/${dp.json?.id || dp.json?.profile?.id}/activate`);
  await call("POST", "/api/base-resume", { content: "Ada Synthetic\nSoftware Engineer\nAcme — Software Engineer, 2020–2024\n- Built services in Node.js\nSkills: JavaScript, Python, SQL", name: "base.txt" });

  // Clicks are dispatched on a timeout: a click that opens window.confirm (D54's notice) would otherwise
  // block the evaluate call that made it.
  const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, protocolTimeout: 60000,
    args: ["--no-first-run", "--no-default-browser-check"] });
  const [name, ...rest] = cookie.split("=");
  const page = await browser.newPage();
  const dialogs = [];
  page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e)));
  await page.setRequestInterception(true);
  let aborted = 0;
  page.on("request", req => {
    const u = new URL(req.url());
    if (["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:") return req.continue();
    aborted++; return req.abort();
  });
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.setCookie({ name, value: rest.join("="), url: BASE });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const stateOf = (i) => page.$$eval(".jb__sq--draft", (els, i) => els[i] && ({
    state: els[i].dataset.draftState, label: els[i].getAttribute("aria-label"), disabled: els[i].disabled,
    ariaDisabled: els[i].getAttribute("aria-disabled") }), i);
  const pendingCount = () => page.$eval('[data-view="pending"]', b => b.getAttribute("aria-label")).catch(() => null);
  const toast = () => page.$eval("[data-decision-toast]", t => t.innerText.replace(/\s+/g, " ").trim()).catch(() => null);

  // ── D51 · draft one job on the board ───────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jb__sq--draft", { timeout: 20000 });
  await sleep(800);
  seen.d51 = { before: await stateOf(0), pendingBefore: await pendingCount() };
  await shot("01-board-before");
  await page.$$eval(".jb__sq--draft", els => { setTimeout(() => els[0].click(), 0); });
  await sleep(2500);
  seen.d51.after = await stateOf(0);
  seen.d51.toast = await toast();
  seen.d51.pendingAfter = await pendingCount();
  await shot("02-board-drafted");
  // /d — the drafted job is listed.
  await page.click('[data-view="pending"]');
  await sleep(2500);
  seen.d51.slashDCards = await page.$$eval("[data-job-bubble]", els => els.length);
  await shot("03-slash-d");
  // Drafted ✓ opens Draft House.
  await page.$$eval(".jb__sq--draft", els => { setTimeout(() => els[0]?.click(), 0); });
  await sleep(2000);
  seen.d51.afterDraftedClick = new URL(page.url()).pathname;

  // ── D54 · a second role at the same company asks first ───────────────────────────────────────
  const db = new Database(DB_PATH, { readonly: true });
  const uid = db.prepare("SELECT id FROM users WHERE username=?").pluck().get(USER.username);
  const first = db.prepare("SELECT job_id FROM apply_run_jobs WHERE user_id=? ORDER BY id LIMIT 1").pluck().get(uid);
  const firstCo = db.prepare("SELECT company FROM scraped_jobs WHERE job_id=?").pluck().get(first);
  seen.d54 = { company: firstCo };
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".jb__sq--draft", { timeout: 20000 });   // not [data-job-bubble]: D45's skeleton matches it
  // The board remembers its view — it reopens on /d, where the pass left it. Back to ALL.
  await page.click('[data-view="all"]');
  await sleep(2500);
  const sameCo = await page.$$eval("[data-job-bubble]", (els, co, first) => {
    const i = els.findIndex(e => e.querySelector(".jb__sq--draft")?.dataset.draftState === "idle" && e.querySelector(".jb__company")?.textContent.trim() === co);
    return i;
  }, firstCo, first);
  seen.d54.sameCompanyIndex = sameCo;
  seen.d54.cardsAfterNav = await page.$$eval("[data-job-bubble]", els => els.slice(0, 6).map(e =>
    `${e.querySelector(".jb__company")?.textContent?.trim()}:${e.querySelector(".jb__sq--draft")?.dataset.draftState}`));
  seen.d54.url = page.url();
  if (sameCo >= 0) {
    const n = dialogs.length;
    await page.$$eval("[data-job-bubble]", (els, i) => { setTimeout(() => els[i].querySelector(".jb__sq--draft").click(), 0); }, sameCo);
    await sleep(2500);
    seen.d54.notice = dialogs.slice(n)[0] ?? null;
  } else seen.notes.push("no second card at the first company on page 1 — the notice not exercised in the browser");

  // ── D51 · draft until out of drafts (DAILY_DRAFT_SLOTS on the server) ──────────────────────────
  for (let k = 0; k < 6; k++) {
    const i = await page.$$eval(".jb__sq--draft", els => els.findIndex(e => e.dataset.draftState === "idle"));
    if (i < 0) break;
    await page.$$eval(".jb__sq--draft", (els, i) => { setTimeout(() => els[i].click(), 0); }, i);
    await sleep(2200);
  }
  const blocked = await page.$$eval(".jb__sq--draft", els => {
    const e = els.find(x => x.dataset.draftState === "blocked"); return e ? { label: e.getAttribute("aria-label"), disabled: e.disabled } : null; });
  seen.d51.blocked = blocked;
  if (blocked) {
    await page.$$eval(".jb__sq--draft", els => { setTimeout(() => els.find(x => x.dataset.draftState === "blocked").click(), 0); });
    await sleep(500);
    seen.d51.blockedToast = await toast();
  }
  await shot("04-out-of-drafts");

  // ── D52 / O80c · Draft House: where each one went, the Fill line ───────────────────────────────
  await sleep(20000);   // let the previews reach their holds
  await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  seen.d52 = {
    stopped: await page.$$eval("[data-stopped-item]", els => els.map(e => ({ kind: e.dataset.stoppedItem, title: e.querySelector(".dh-item__title")?.textContent }))),
    queued: await page.$eval("[data-draft-queued]", e => e.innerText.slice(0, 200)).catch(() => null),
    fillTitles: await page.$$eval(".dh-sq", els => els.filter(b => /Fill|Prepare again/.test(b.innerText)).map(b => b.title)),
  };
  await shot("05-draft-house");

  // ── D53 · Clear → the bin → Restore ────────────────────────────────────────────────────────────
  const clearBtn = await page.$$eval(".dh-sq", els => { const i = els.findIndex(b => /Clear/.test(b.innerText)); if (i >= 0) els[i].click(); return i; });
  await sleep(2500);
  seen.d53 = { clicked: clearBtn >= 0, msg: await page.$eval('[role="status"]', e => e.innerText).catch(() => null) };
  seen.d53.binSummary = await page.$eval("[data-draft-bin] > summary", s => s.innerText).catch(() => null);
  if (seen.d53.binSummary) {
    await page.click("[data-draft-bin] > summary");
    await sleep(400);
    seen.d53.binItem = await page.$eval("[data-bin-item]", li => li.innerText.replace(/\s+/g, " ")).catch(() => null);
    await shot("06-bin-open");
    await page.$$eval("[data-bin-item] .dh-bulk", els => els.find(b => b.innerText === "Restore")?.click());
    await sleep(2500);
    seen.d53.afterRestore = { bin: await page.$eval("[data-draft-bin] > summary", s => s.innerText).catch(() => "(no bin)"),
      msg: await page.$eval("[data-bin-msg]", e => e.innerText).catch(() => null) };
  }
  seen.d53.select = await page.$$eval("[data-bulk-clear] button", bs => bs.map(b => b.innerText));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(600);
  seen.d53.phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await shot("07-draft-house-390");
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  // ── D54 · The Table, By company ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/database`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  seen.d54.listRows = await page.$$eval(".ah__row", els => els.length);
  // The Pending Apply tab's count must be measured before it is clicked (it read 0 with Drafts in play).
  seen.d54.sheetTabs = await page.$$eval("button", bs => bs.map(b => b.innerText.replace(/\s+/g, " ").trim()).filter(t => /^Pending Apply/.test(t)));
  seen.d54.listLabels = await page.$$eval(".ah__row .ah__status", els => [...new Set(els.map(e => e.innerText))]);
  await page.$$eval('[data-layout="company"]', b => b[0]?.click());
  await sleep(600);
  seen.d54.companyRows = await page.$$eval("[data-company-row]", els => els.map(e => e.innerText.replace(/\s+/g, " ").slice(0, 120)));
  await shot("08-table-by-company");

  seen.pageErrors = errors;
  seen.abortedThirdParty = aborted;
  seen.dialogs = dialogs;
  await browser.close();
  console.log(JSON.stringify(seen, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });

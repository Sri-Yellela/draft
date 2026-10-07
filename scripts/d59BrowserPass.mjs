// D59 · THE BROWSER PASS — the real app, a real server, headless Chrome.
//
//   node scripts/d59BrowserPass.mjs <base> <dbPath>
//
// Run against a THROWAWAY server only (RM_DATA_DIR on a copy, keys blanked). It seeds three SYNTHETIC
// postings into <dbPath> (test/fixtures/d59Postings.js — the RTX shape, a hostile description, the Blue
// Origin export-control wording) and reads two of them through the same refreshDescriptionText the boot
// pass runs; the hostile one is left UNREAD so the panel's render-time re-check is what is seen. Every
// page request that leaves localhost is aborted. Prints one JSON report of what was SEEN and writes
// screenshots to ../draft-screenshots/d59.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { RTX_HTML, HOSTILE_HTML, BLUE_ORIGIN_TEXT } from "../test/fixtures/d59Postings.js";
import { computeContentHash } from "../services/jobs/enrichmentSelection.js";
import { refreshDescriptionText, registerDescriptionBasis } from "../services/jobs/descriptionText.js";

const BASE = process.argv[2] || "http://127.0.0.1:3159";
const DB_PATH = process.argv[3];
if (!DB_PATH) { console.error("usage: node scripts/d59BrowserPass.mjs <base> <dbPath>"); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT = path.resolve(ROOT, "..", "draft-screenshots", "d59");
const USER = { username: `d59pass${Date.now() % 100000}`, password: "Synthetic-Pass-59!" };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const JOBS = [
  { id: "d59pass::rtx", title: "Systems Engineer II (Synthetic)", company: "Synthetic Defense Co", description: RTX_HTML, read: true },
  { id: "d59pass::hostile", title: "Platform Engineer (Synthetic)", company: "Synthetic Hostile Co", description: HOSTILE_HTML, read: false },
  { id: "d59pass::blue", title: "Avionics Engineer (Synthetic)", company: "Synthetic Launch Co", description: BLUE_ORIGIN_TEXT, read: true },
];

function seed() {
  const db = new Database(DB_PATH);
  registerDescriptionBasis(db);
  const ins = db.prepare(`INSERT OR REPLACE INTO scraped_jobs (job_id, search_query, _hash, title, company, location, url, source, description, content_hash, is_active)
    VALUES (?, 'd59pass', ?, ?, ?, NULL, ?, 'import', ?, ?, 1)`);
  const before = {};
  for (const j of JOBS) {
    ins.run(j.id, `h-${j.id}`, j.title, j.company, `http://127.0.0.1:3999/${j.id}`, j.description, computeContentHash(j.title, j.description));
    if (j.read) refreshDescriptionText(db, j.id);
    before[j.id] = db.prepare("SELECT description, content_hash FROM scraped_jobs WHERE job_id=?").get(j.id);
  }
  db.close();
  return before;
}

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
  const stored = seed();
  const seen = {};
  await call("POST", "/api/auth/register", { ...USER, profile: { email: `${USER.username}@example.invalid`, first_name: "Ada", last_name: "Synthetic", city: "Boston", state: "MA" } });
  const dp = await call("POST", "/api/domain-profiles", { profile_name: "Systems", role_family: "engineering", domain: "general", seniority: "mid", target_titles: ["Systems Engineer"] });
  await call("POST", `/api/domain-profiles/${dp.json?.id || dp.json?.profile?.id}/activate`);

  // The API — what the panel is handed.
  const api = {};
  for (const j of JOBS) {
    const r = await call("GET", `/api/jobs/by-id/${encodeURIComponent(j.id)}`);
    api[j.id] = { status: r.status, requirements: r.json?.job?.requirements ?? null, postingFields: r.json?.job?.postingFields ?? null,
      workplace: r.json?.job?.workplaceType ?? r.json?.job?.workplace ?? null, location: r.json?.job?.location ?? null, postedAt: r.json?.job?.postedAt ?? null };
  }
  seen.api = api;

  const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, protocolTimeout: 60000,
    args: ["--no-first-run", "--no-default-browser-check"] });
  const [name, ...rest] = cookie.split("=");
  const page = await browser.newPage();
  const dialogs = [];
  page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss(); });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e)));
  await page.setRequestInterception(true);
  let aborted = 0;
  page.on("request", req => {
    const u = new URL(req.url());
    if (["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol === "data:" || u.protocol === "blob:") return req.continue();
    aborted++; return req.abort();
  });
  await page.setCookie({ name, value: rest.join("="), url: BASE });

  const panel = async (id) => {
    await page.goto(`${BASE}/app/jobs?job=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-posting-body]", { timeout: 20000 });
    await sleep(900);
    return page.evaluate(() => {
      const body = document.querySelector("[data-posting-body]");
      const strip = [...document.querySelectorAll("[data-posting-strip] [data-cell]")].map(c => ({ cell: c.dataset.cell, text: c.innerText.replace(/\s+/g, " ").trim() }));
      return {
        bodyText: body.innerText,
        bodyElements: [...new Set([...body.querySelectorAll("*")].map(e => e.tagName.toLowerCase()))],
        dangerous: body.querySelectorAll("script, iframe, img, object, embed, style, [onerror], [onclick], [onload]").length,
        jsLinks: document.querySelectorAll('a[href^="javascript:" i]').length,
        pwned: window.stolen !== undefined,
        strip,
        requirements: [...document.querySelectorAll("[data-posting-requirements] [data-req]")].map(p => ({ key: p.dataset.req, label: p.innerText, tag: p.tagName.toLowerCase() })),
        details: document.querySelector("[data-posting-details]")?.innerText ?? null,
        notice: document.querySelector("[data-eligibility-notice]")?.innerText ?? null,
      };
    });
  };
  const summarise = (p) => ({
    tagsVisible: /<\/?[a-z][^>]*>/i.test(p.bodyText), escapedQuote: p.bodyText.includes('\\"'), entity: /&(?:lt|gt|amp|quot|#\d+);/.test(p.bodyText),
    labelLinesInBody: ["Date Posted", "Country:", "Position Role Type", "Security Clearance Type"].filter(l => p.bodyText.includes(l)),
    bostonAsCity: p.strip.some(c => /\bBoston\b(?! Post)/.test(c.text)),
    ...p, bodyText: p.bodyText.slice(0, 400),
  });

  for (const [w, h] of [[1280, 900], [390, 844]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    seen[`rtx@${w}`] = summarise(await panel("d59pass::rtx"));
    await page.screenshot({ path: path.join(OUT, `rtx-${w}.png`) });
  }
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  seen.hostile = summarise(await panel("d59pass::hostile"));
  await page.screenshot({ path: path.join(OUT, "hostile-1280.png") });
  seen.blue = summarise(await panel("d59pass::blue"));
  await page.screenshot({ path: path.join(OUT, "blue-1280.png") });

  // Dark theme, the RTX panel.
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await panel("d59pass::rtx");
  await page.screenshot({ path: path.join(OUT, "rtx-1280-dark.png") });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  // The filter — the drawer's control, and what the board query returns with it on and off.
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  seen.filterControl = await page.$eval('[data-filter="eligibility"] button', b => ({ text: b.innerText, pressed: b.getAttribute("aria-pressed") })).catch(() => "(drawer closed — not in the DOM)");
  // The seeded postings carry no role classification, so they are on no board; the filter is judged on
  // the REAL board's rows the boot pass read (whatever this new account's board holds).
  const listed = async (q) => {
    const r = await call("GET", `/api/jobs?pageSize=100${q}`);
    const list = r.json?.jobs || [];
    const stating = list.filter(j => j.requirements && (j.requirements.citizenship !== "none_stated" || j.requirements.clearance !== "none" || j.requirements.polygraph));
    return { status: r.status, total: r.json?.total ?? list.length, statingRequirements: stating.length,
      sample: stating.slice(0, 3).map(j => `${j.company} — ${j.title}`), reason: r.json?.reason ?? null };
  };
  seen.filter = { off: await listed(""), on: await listed("&hide_eligibility_required=1") };

  // The stored text was never written.
  const db = new Database(DB_PATH, { readonly: true });
  seen.descriptionAndHashUnchanged = JOBS.every(j => {
    const now = db.prepare("SELECT description, content_hash FROM scraped_jobs WHERE job_id=?").get(j.id);
    return now.description === stored[j.id].description && now.content_hash === stored[j.id].content_hash;
  });
  db.close();

  seen.dialogs = dialogs; seen.pageErrors = errors; seen.abortedOffLocalhost = aborted;
  await browser.close();
  console.log(JSON.stringify(seen, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });

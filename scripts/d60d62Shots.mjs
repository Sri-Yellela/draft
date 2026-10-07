// D60–D62 · BEFORE / AFTER SCREENSHOTS — the real app, a throwaway server, headless Chrome, both themes.
//
//   node scripts/d60d62Shots.mjs <base> <label>
//
// Run against a THROWAWAY server only (RM_DATA_DIR on a copy, keys blanked). Registers a SYNTHETIC user,
// then shoots the board (ALL), the posting panel + ATS card pair, The Table and Settings in light and dark.
// Every page request that leaves localhost is aborted. Screenshots to ../draft-screenshots/d60-d62/<label>.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const BASE = process.argv[2] || "http://127.0.0.1:3169";
const LABEL = process.argv[3] || "after";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT = path.resolve(ROOT, "..", "draft-screenshots", "d60-d62", LABEL);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function call(method, p, body, token) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "Content-Type": "application/json", ...(token ? { "X-RM-Auth-Context": token, Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

fs.mkdirSync(OUT, { recursive: true });
const u = `d60shots${Date.now() % 100000}`;
const reg = await call("POST", "/api/auth/register", { username: u, password: "Synthetic-Pass-60!",
  profile: { email: `${u}@example.invalid`, first_name: "Ada", last_name: "Synthetic", city: "Boston", state: "MA" } });
const token = reg.json?.authContext;
const dp = await call("POST", "/api/domain-profiles", { profile_name: "Platform", role_family: "engineering", domain: "general", seniority: "mid", target_titles: ["Software Engineer"] }, token);
await call("POST", `/api/domain-profiles/${dp.json?.id || dp.json?.profile?.id}/activate`, null, token);
await call("POST", "/api/base-resume", { content: "Ada Synthetic\nSoftware Engineer\nAcme — Software Engineer, 2020–2024\n- Built services in Node.js\nSkills: JavaScript, Python, SQL", name: "base.txt" }, token);
const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, protocolTimeout: 180000, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setRequestInterception(true);
let aborted = 0;
// D61: the logo host is let through (public icons, no cookie, no user data) so the tiles show real marks;
// every other off-localhost request — every employer — is aborted.
page.on("request", req => { const h = new URL(req.url()).hostname; if (["localhost", "127.0.0.1", "icons.duckduckgo.com"].includes(h) || /^(data|blob):/.test(req.url())) req.continue(); else { aborted++; req.abort(); } });
const errors = [];
page.on("pageerror", e => errors.push(String(e.message || e)));
page.on("dialog", d => d.dismiss());
await page.evaluateOnNewDocument((t) => { try { sessionStorage.setItem("rm_auth_context", t); } catch {} }, token);
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const shot = (n) => Promise.race([page.screenshot({ path: path.join(OUT, `${n}.png`), optimizeForSpeed: true }),
  sleep(45000).then(() => { errors.push(`shot ${n} timed out`); })]).catch(e => errors.push(`shot ${n}: ${String(e.message).slice(0, 80)}`));
const seen = {};
for (const theme of ["light", "dark"]) {
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => { try { localStorage.setItem("draft-theme", t); } catch {} }, theme);
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-job-bubble] .jb__company", { timeout: 60000 }).catch(() => {});
  await sleep(4000);
  await shot(`${theme}-01-board`);
  // The posting panel + the ATS card (the pair).
  const opened = await page.$$eval("[data-job-bubble]", els => { const b = els[0]?.querySelector(".jb__title, .jb__company"); if (!b) return false; b.click(); return true; });
  await sleep(2500);
  await shot(`${theme}-02-posting`);
  const ats = await page.$('[aria-label^="ATS report"]');
  if (ats) { await ats.click().catch(() => {}); await sleep(2500); await shot(`${theme}-03-ats`); }
  seen[theme] = { opened, ats: !!ats };
  await page.goto(`${BASE}/app/database`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await shot(`${theme}-04-table`);
}
await browser.close();
console.log(JSON.stringify({ out: OUT, seen, pageErrors: errors, abortedOffLocalhost: aborted }, null, 2));

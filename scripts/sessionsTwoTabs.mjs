#!/usr/bin/env node
// Sessions A′ — the admin and the owner's own account open at once, one per tab, in ONE browser. Drives a real
// Chrome against a running server (a throwaway one: RM_DATA_DIR, synthetic accounts) and checks every step of
// the timeline the owner's goal depends on. Exit 1 on any failure.
//   node scripts/sessionsTwoTabs.mjs http://localhost:3011 <admin-user> <admin-password>
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:3011";
const ADMIN = process.argv[3] || "admin", ADMIN_PW = process.argv[4] || "synthetic-admin-pw-1";
const USER = `twotab${Date.now() % 100000}`, USER_PW = "Synthetic-pass-123!";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failed = 0;
const expect = (step, got, want) => {
  const ok = Object.entries(want).every(([k, v]) => got[k] === v);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${step.padEnd(58)} ${JSON.stringify(got)}${ok ? "" : `  expected ${JSON.stringify(want)}`}`);
};

await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify({ username: USER, password: USER_PW, profile: { email: `${USER}@example.com`, first_name: "Sam", last_name: "Sample" } }) });

const exe = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: exe.path, headless: "new", pipe: true, args: ["--no-first-run"] });
// What the client's lib/api.js does: this tab's token from sessionStorage, plus the shared cookie.
const who = (page) => page.evaluate(async () => {
  const t = sessionStorage.getItem("rm_auth_context") || "";
  const h = t ? { "X-RM-Auth-Context": t } : {};
  const me = await (await fetch("/api/auth/me", { headers: h })).json();
  return { me: me.authenticated ? (me.user.isAdmin ? "admin" : "user") : "out", admin: (await fetch("/api/admin/users", { headers: h })).status };
});
const signIn = (page, u, p) => page.evaluate(async (u, p) => {
  const d = await (await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: p }) })).json();
  if (d.authContext) sessionStorage.setItem("rm_auth_context", d.authContext);
  return !!d.ok;
}, u, p);
const signOut = (page) => page.evaluate(async () => {
  const t = sessionStorage.getItem("rm_auth_context") || "";
  const r = await (await fetch("/api/auth/logout", { method: "POST", headers: t ? { "X-RM-Auth-Context": t } : {} })).json();
  sessionStorage.removeItem("rm_auth_context");
  return r.scope;
});
const go = async (page, p) => { await page.goto(BASE + p, { waitUntil: "networkidle2" }); await sleep(900); };

try {
  const profile = await browser.createBrowserContext();
  const A = await profile.newPage(), B = await profile.newPage();
  await go(A, "/admin/login"); await signIn(A, ADMIN, ADMIN_PW); await go(A, "/admin");
  expect("1 tab A: the admin signs in", await who(A), { me: "admin", admin: 200 });

  await go(B, "/login");
  const note = await B.evaluate(() => document.querySelector("[data-signed-in-elsewhere]")?.textContent || "");
  expect("2 tab B: /login shows the form and the notice (not /admin)", { path: new URL(B.url()).pathname, note: /signed in as/.test(note) },
    { path: "/login", note: true });
  await signIn(B, USER, USER_PW); await go(B, "/app");
  expect("3 tab B: the owner's own account signs in", await who(B), { me: "user", admin: 403 });

  await A.reload({ waitUntil: "networkidle2" }); await sleep(900);
  expect("4 tab A reloads: still the admin", await who(A), { me: "admin", admin: 200 });

  const scope = await signOut(A);
  expect("5 tab A: the ADMIN signs out — this tab only", { scope }, { scope: "tab" });
  await B.reload({ waitUntil: "networkidle2" }); await sleep(900);
  expect("5b tab B: still the owner's account", await who(B), { me: "user", admin: 403 });

  await go(A, "/admin/login"); await signIn(A, ADMIN, ADMIN_PW); await go(A, "/admin");
  await go(B, "/login"); await signIn(B, USER, USER_PW); await go(B, "/app");   // B signs in last: the cookie is B's
  const scopeB = await signOut(B);
  expect("6 tab B: the user signs out (the cookie's own account) — the machine", { scope: scopeB }, { scope: "browser" });
  await A.reload({ waitUntil: "networkidle2" }); await sleep(900);
  expect("6b tab A: the admin is still signed in", await who(A), { me: "admin", admin: 200 });

  const fresh = await profile.newPage();
  await go(fresh, "/admin");
  expect("7 a fresh tab gets the cookie's account (no token of its own)", await who(fresh), { me: "out" });
} finally { await browser.close(); }
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);

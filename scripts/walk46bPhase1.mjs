// scripts/walk46bPhase1.mjs — ⭐ 46b · A167 + A165 WALKED IN REAL CHROME, with phase 1's switches ON and NO real keys.
// A FRESH throwaway database, the real server from this checkout, every key blanked, the checkout's .env kept out
// (draft-harness-key-leak). BILLING_ENABLED=1 and SIGNUP_VERIFICATION_REQUIRED=1 with no Stripe key (the plan buttons say
// "not on sale yet" — nothing is sent to Stripe) and no SMS provider (the dev-log stand-in: the code is read from the
// server's own log, as is the email code). Synthetic people only.
//   1. /register: step 1 → step 2; Create Account is refused until both codes are confirmed; email code + phone code →
//      the account is made, signed in, with both stamped.
//   2. a second sign-up with the SAME phone is refused, and the admin's refusal list has it (masked).
//   3. Settings → Account: "Your plan" (10 of 10 trial drafts, the tiers at test prices), "Your phone" confirmed,
//      "Sharing your details with employers" OFF until ticked.
//   4. the trial gate: an 11th new job is refused 402 plan_required; the site's other reads stay open.
//   5. A165: a held run job (the FA6 safety gate, a packet with two unanswered questions) opens in the tracker with
//      "Held — nothing was sent", the reason, and both questions by name.
// Usage: node scripts/walk46bPhase1.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walk46bp1"), SHOTS = path.join(DIR, "shots");
const PORT = 4421, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (ok, what) => { results.push({ ok, what }); console.log(`${ok ? "PASS" : "FAIL"} phase1: ${what}`); };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk46bp1-secret-not-real",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness",
  BILLING_ENABLED: "1", SIGNUP_VERIFICATION_REQUIRED: "1", STRIPE_SECRET_KEY: "", TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", TWILIO_VERIFY_SERVICE_SID: "" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { up = (await fetch(`${BASE}/api/health/ready`)).ok; } catch { /* not yet */ } if (!up) await sleep(500); }
if (!up) { console.log("server never became ready\n" + log.slice(-3000)); process.exit(1); }
const db = new Database(path.join(DIR, "resume_master.db"));

const lastCode = async (re, since) => {
  for (let i = 0; i < 40; i++) { const m = [...log.slice(since).matchAll(re)].pop(); if (m) return m[1]; await sleep(250); }
  return null;
};
const EMAIL_CODE = /subject="Your [^"]*code: (\d{6})"/gi, SMS_CODE = /\[verify:dev\] SMS code for [^:]+: (\d{6})/g;

const resolution = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
const newPage = async (ctx) => { const p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 900 }); return p; };
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, `${n}.png`) }).catch(() => {});
const api = (p, url, method = "GET", body = null) => p.evaluate(async (u, m, b) => {
  const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch { /* none */ }
  return { status: r.status, body: j };
}, url, method, body);
const typeInto = async (p, sel, text) => {
  await p.waitForSelector(sel, { visible: true, timeout: 10000 });
  const els = await p.$$(sel);
  let el = null; for (const e of els) { if (await e.boundingBox()) { el = e; break; } }
  await el.click({ clickCount: 3 }); await el.type(text);
};
const clickText = async (p, text) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find(x => x.offsetParent && x.textContent.trim().startsWith(t) && !/with /i.test(x.textContent) && !x.disabled); if (b) b.click(); return !!b; }, text);

async function signUp(ctx, { username, email, phone }) {
  const p = await newPage(ctx);
  await p.goto(`${BASE}/register`, { waitUntil: "networkidle2" });
  await typeInto(p, 'input[placeholder="Username"]', username);
  await typeInto(p, 'input[placeholder="Password (min 8 chars)"]', "walk-phase1-password");
  await typeInto(p, 'input[placeholder="Confirm password"]', "walk-phase1-password");
  await clickText(p, "Continue →");
  await typeInto(p, 'input[placeholder="First name *"]', "Pat");
  await typeInto(p, 'input[placeholder="Last name *"]', "Walker");
  await typeInto(p, 'input[placeholder="Email *"]', email);
  await shot(p, `signup-step2-${username}`);
  await typeInto(p, 'input[placeholder="Phone *"]', phone);
  return p;
}

try {
  // ── 1. sign-up with both codes ──────────────────────────────────────────────────────────────────────────────────────
  const ctxA = await browser.createBrowserContext();
  const A = await signUp(ctxA, { username: "walk-pat", email: "walk-pat@example.test", phone: "(617) 555-0142" });
  await clickText(A, "Create Account →");
  await sleep(600);
  const early = await A.evaluate(() => document.body.innerText.includes("Confirm your email with the code"));
  say(early, "Create Account before any code is refused with \"Confirm your email with the code we send it.\"");
  if (!early) console.log("PAGE:", (await A.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n+/g, " | "));
  let mark = log.length;
  await A.waitForSelector('[data-otp="email"] button', { timeout: 5000 });
  await A.click('[data-otp="email"] button');
  const ecode = await lastCode(EMAIL_CODE, mark);
  await typeInto(A, 'input[aria-label="The code we emailed"]', ecode || "000000");
  await A.evaluate(() => [...document.querySelectorAll('[data-otp="email"] button')].find(b => b.textContent.trim() === "Confirm")?.click());
  await A.waitForSelector('[data-otp-proven="email"]', { timeout: 8000 }).catch(() => {});
  mark = log.length;
  await A.click('[data-otp="sms"] button');
  const scode = await lastCode(SMS_CODE, mark);
  await typeInto(A, 'input[aria-label="The code we texted"]', scode || "000000");
  await A.evaluate(() => [...document.querySelectorAll('[data-otp="sms"] button')].find(b => b.textContent.trim() === "Confirm")?.click());
  await A.waitForSelector('[data-otp-proven="sms"]', { timeout: 8000 }).catch(() => {});
  const proven = await A.evaluate(() => [!!document.querySelector('[data-otp-proven="email"]'), !!document.querySelector('[data-otp-proven="sms"]')]);
  say(!!ecode && !!scode && proven[0] && proven[1], `both codes arrived (email ${ecode ? "✓" : "✗"}, SMS ${scode ? "✓" : "✗"}) and confirmed in the form: ${JSON.stringify(proven)}`);
  await shot(A, "signup-codes");
  await clickText(A, "Create Account →");
  await A.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 20000 }).catch(() => {});
  const u = db.prepare("SELECT id, phone_e164, phone_verified_at, email_verified_at FROM users WHERE username = 'walk-pat'").get();
  say(!!u && u.phone_e164 === "+16175550142" && !!u.phone_verified_at && !!u.email_verified_at, `account made, signed in at ${new URL(A.url()).pathname}, phone ${u?.phone_e164}, both stamped`);

  // ── 2. the same phone again ────────────────────────────────────────────────────────────────────────────────────────
  const ctxB = await browser.createBrowserContext();
  const B = await signUp(ctxB, { username: "walk-pat-two", email: "walk-pat-two@example.test", phone: "617-555-0142" });
  mark = log.length; await B.click('[data-otp="email"] button');
  const e2 = await lastCode(EMAIL_CODE, mark);
  await typeInto(B, 'input[aria-label="The code we emailed"]', e2 || "000000");
  await B.evaluate(() => [...document.querySelectorAll('[data-otp="email"] button')].find(b => b.textContent.trim() === "Confirm")?.click());
  await sleep(800);
  mark = log.length; await B.click('[data-otp="sms"] button');
  const s2 = await lastCode(SMS_CODE, mark);
  await typeInto(B, 'input[aria-label="The code we texted"]', s2 || "000000");
  await B.evaluate(() => [...document.querySelectorAll('[data-otp="sms"] button')].find(b => b.textContent.trim() === "Confirm")?.click());
  await sleep(800);
  await clickText(B, "Create Account →");
  await sleep(1500);
  const refusedText = await B.evaluate(() => document.body.innerText.includes("already on a draft account"));
  const second = db.prepare("SELECT COUNT(*) FROM users WHERE username = 'walk-pat-two'").pluck().get();
  const refusal = db.prepare("SELECT reason, stage, phone_hint, email_hint FROM signup_refusals ORDER BY id DESC LIMIT 1").get();
  say(refusedText && second === 0 && refusal?.reason === "phone_taken", `the same phone is refused on screen, no account made, recorded masked: ${JSON.stringify(refusal)}`);
  await shot(B, "signup-same-phone");

  // ── 3. Settings → Account ───────────────────────────────────────────────────────────────────────────────────────────
  await A.goto(`${BASE}/app/profile/account`, { waitUntil: "networkidle2" });
  await A.waitForSelector("[data-plan-headline]", { timeout: 15000 }).catch(() => {});
  const cards = await A.evaluate(() => ({
    plan: document.querySelector("[data-plan-headline]")?.textContent || null,
    tiers: [...document.querySelectorAll("[data-plan-tier]")].map(t => t.textContent.replace(/\s+/g, " ").trim().slice(0, 60)),
    test: document.querySelectorAll("[data-test-price]").length,
    phone: !!document.querySelector("[data-phone-verified]"),
    lead: document.querySelector("[data-lead-sharing] input")?.checked ?? null,
  }));
  say(cards.plan === "10 of 10 trial drafts left" && cards.tiers.length === 2 && cards.test === 2 && cards.phone && cards.lead === false,
    `Settings cards: ${JSON.stringify(cards)}`);
  await shot(A, "settings-plan");
  await A.evaluate(() => document.querySelector("[data-lead-sharing] input")?.click());
  await sleep(800);
  say(db.prepare("SELECT lead_share_consent FROM users WHERE id = ?").pluck().get(u.id) === 1, "ticking the lead-sharing box records the explicit consent");

  // ── 4. the trial gate ───────────────────────────────────────────────────────────────────────────────────────────────
  db.prepare("UPDATE users SET send_mode = 'semi' WHERE id = ?").run(u.id);
  // the run's own prerequisites (an active job profile + a base résumé) — so the request reaches the plan gate
  db.prepare("UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?").run(u.id);
  db.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?, 'Backend', 'engineering', 'software', 1)").run(u.id);
  db.prepare("INSERT INTO base_resume (user_id, content) VALUES (?, 'Pat Walker — Backend Engineer. Go, Postgres, Kafka. 2019–2026 Walk Rails Co.') ON CONFLICT(user_id) DO UPDATE SET content = excluded.content").run(u.id);
  const ins = db.prepare("INSERT OR IGNORE INTO trial_drafts (user_id, job_id) VALUES (?, ?)");
  for (let i = 0; i < 10; i++) ins.run(u.id, `walk-used-${i}`);
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, direct_apply, is_active, url, apply_url)
    VALUES ('walk-new-1', 'walk', 'Walk Rails Co', 'Backend Engineer', 'h-walk-new-1', unixepoch(), 1, 1, 'https://boards.greenhouse.io/walkrails/jobs/1', 'https://boards.greenhouse.io/walkrails/jobs/1')`).run();
  const gated = await api(A, "/api/apply/runs", "POST", { jobIds: ["walk-new-1"], mode: "semi" });
  const open = await api(A, "/api/billing/status");
  say(gated.status === 402 && gated.body?.error === "plan_required" && open.status === 200,
    `the 11th new job: ${gated.status} ${gated.body?.error} "${String(gated.body?.message || "").slice(0, 80)}"; the rest of the site still answers (${open.status})`);

  // ── 5. A165: a held run job opens with its reason and its questions ───────────────────────────────────────────────
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (?, 'auto', 'generate', 'completed', 1, 'auto')").run(u.id).lastInsertRowid;
  const rj = db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, reason_detail, finished_at)
    VALUES (?, ?, 'walk-new-1', 'held_review', 'full_auto_prerequisites', ?, unixepoch())`)
    .run(run, u.id, "Held: sending without your review waits until draft's safety checks are green (A daily cost alarm, and today under it; The kill switch tested on production). Nothing was sent.").lastInsertRowid;
  db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
    VALUES (?, ?, ?, 'walk-new-1', 'https://boards.greenhouse.io/walkrails/jobs/1', 'https://boards.greenhouse.io', 'full_auto_prerequisites', ?, ?, 0)`)
    .run(u.id, run, rj, JSON.stringify({ answers: [], unresolved: [
      { field: "Are you legally authorized to work in the US?", is_required: true }, { field: "Why do you want to work at Walk Rails Co?", is_required: true, from_schema: true }] }), `walk-${Date.now()}`);
  await A.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2" });
  await sleep(1500);
  const opened = await A.evaluate(() => {
    const row = [...document.querySelectorAll("[data-row-key], [data-row], tr, li, button")].find(e => /Walk Rails/i.test(e.textContent || "") && e.offsetParent);
    if (row) row.click();
    return !!row;
  });
  await A.waitForSelector("[data-held-questions]", { timeout: 8000 }).catch(() => {});
  const held = await A.evaluate(() => ({
    eyebrow: document.querySelector(".trk-o__eyebrow")?.textContent || null,
    headline: document.querySelector("[data-row-headline]")?.textContent || null,
    lead: document.querySelector("[data-held-lead]")?.textContent || null,
    qs: [...document.querySelectorAll("[data-held-questions] li")].map(li => li.textContent.trim()),
  }));
  say(opened && held.eyebrow === "Held — nothing was sent" && /safety checks/.test(held.headline || "") && held.qs.length === 2,
    `the held row: ${JSON.stringify(held).slice(0, 400)}`);
  await shot(A, "held-row");
} catch (e) {
  say(false, `walk error: ${e.message}`);
} finally {
  await browser.close();
  stop();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} PASS`);
process.exit(failed ? 1 : 0);

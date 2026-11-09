// scripts/walk45s.mjs — ⭐ 45s · the end-of-log REAL-CHROME WALKS, against the real server booted from this checkout on a
// THROWAWAY copy of data/resume_master.db (RM_DATA_DIR = tmp/walk45s; run from a checkout with no .env, so nothing can send
// an email or call a model). Synthetic people only (walk-ada, walk-ben). Each walk prints PASS / FAIL with what it saw, and
// a screenshot under tmp/walk45s/shots/. Usage: node scripts/walk45s.mjs [walk,…]   (default: all)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walk45s"), SHOTS = path.join(DIR, "shots");
const PORT = 4411, BASE = `http://127.0.0.1:${PORT}`;
const SRC_DB = process.env.WALK_DB || "C:/Users/duggi/WebstormProjects/draft/data/resume_master.db";
const CO = process.env.WALK_COMPANY || "Stripe", CO_SLUG = process.env.WALK_SLUG || "stripe";
const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (walk, ok, what) => { results.push({ walk, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${walk}: ${what}`); };

// ── a fresh copy and the switches the walks need (set BEFORE boot, in the copy only) ────────────────────────────────
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));
// WALK_ACTIVATE=<company>: the local real-data copy has no OPEN postings (all closed), so a company page has nothing to show —
// re-open that company's postings in the THROWAWAY copy only.
if (process.env.WALK_ACTIVATE) {
  const pre = new Database(path.join(DIR, "resume_master.db"));
  const n = pre.prepare("UPDATE scraped_jobs SET is_active = 1, retired_at = NULL, scraped_at = unixepoch() WHERE company = ?").run(process.env.WALK_ACTIVATE).changes;
  pre.close(); console.log(`re-opened ${n} ${process.env.WALK_ACTIVATE} postings in the copy`);
}

const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk45s-secret-not-real",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);

async function ready() {
  for (let i = 0; i < 240; i++) {
    try { const r = await fetch(`${BASE}/api/health/ready`); if (r.ok) return true; } catch { /* not yet */ }
    await sleep(500);
  }
  return false;
}
if (!(await ready())) { console.log("server never became ready\n" + log.slice(-3000)); process.exit(1); }
const db = new Database(path.join(DIR, "resume_master.db"));
const setting = (k, v) => db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(k, v);

const resolution = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
const ctxA = await browser.createBrowserContext(), ctxB = await browser.createBrowserContext();
const pageOf = async (ctx) => { const p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 900 }); return p; };
const A = await pageOf(ctxA), B = await pageOf(ctxB);
const shot = async (p, name) => { try { await p.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } catch { /* best effort */ } };
const api = (p, url, method = "GET", body = null) => p.evaluate(async (u, m, b) => {
  const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
}, url, method, body);
const text = (p) => p.evaluate(() => document.body.innerText);
async function register(p, who) {
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const r = await api(p, "/api/auth/register", "POST", { username: `walk-${who}`, password: "Walk45s-Passw0rd!", profile: { email: `walk-${who}@example.invalid`, first_name: who === "ada" ? "Ada" : "Ben", last_name: "Example" } });
  if (r.status >= 400) { const l = await api(p, "/api/auth/login", "POST", { username: `walk-${who}`, password: "Walk45s-Passw0rd!" }); return l; }
  const me = await api(p, "/api/auth/me");
  if (me.status !== 200) return api(p, "/api/auth/login", "POST", { username: `walk-${who}`, password: "Walk45s-Passw0rd!" });
  return r;
}
const want = (w) => !only || only.has(w);

try {
  // ── A157 · companies at their own address; postings under them; the old addresses 301 ───────────────────────────
  if (want("a157")) {
    const job = db.prepare(`SELECT job_id, company, title FROM scraped_jobs WHERE company = ? ORDER BY id LIMIT 1`).get(CO);
    const r1 = await fetch(`${BASE}/companies/${CO_SLUG}`, { redirect: "manual" });
    say("a157", r1.status === 301 && new RegExp(`/${CO_SLUG}$`).test(r1.headers.get("location") || ""), `/companies/${CO_SLUG} → ${r1.status} ${r1.headers.get("location")}`);
    const P = await pageOf(await browser.createBrowserContext());
    await P.goto(`${BASE}/${CO_SLUG}`, { waitUntil: "networkidle2", timeout: 60000 });
    const t1 = await text(P);
    say("a157", t1.includes(CO) && !/not found|404/i.test(t1.slice(0, 400)), `signed-out /${CO_SLUG} draws the company page (${t1.slice(0, 80).replace(/\s+/g, " ")}…)`);
    await shot(P, "a157-stripe");
    if (job) {
      const pub = await fetch(`${BASE}/api/public/jobs/${encodeURIComponent(job.job_id)}`).catch(() => null);
      const list = await P.evaluate((slug) => [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")).filter(h => h && h.startsWith('/'+slug+'/') && h.split('/').length === 3), CO_SLUG);
      if (list[0]) {
        await P.goto(`${BASE}${list[0]}`, { waitUntil: "networkidle2", timeout: 60000 });
        const t2 = await text(P);
        say("a157", t2.includes(CO) && /apply/i.test(t2), `signed-out ${list[0]} draws the posting under its company, with Apply`);
        await shot(P, "a157-stripe-posting");
      } else say("a157", false, `the company page lists no /<company>/<id> posting links (open board rows: ${pub?.status ?? "?"})`);
    }
  }

  // ── accounts ──────────────────────────────────────────────────────────────────────────────────────────────────
  const ra = await register(A, "ada"), rb = await register(B, "ben");
  const idA = db.prepare(`SELECT id FROM users WHERE username = 'walk-ada'`).pluck().get(), idB = db.prepare(`SELECT id FROM users WHERE username = 'walk-ben'`).pluck().get();
  say("accounts", !!idA && !!idB, `walk-ada ${ra.status} · walk-ben ${rb.status}`);

  // ── A148 · the switch walk: A signs in, signs out, B signs in on the SAME browser — B's picture, nothing of A's ────
  if (want("a148")) {
    const C = await pageOf(await browser.createBrowserContext());
    await C.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await api(C, "/api/auth/login", "POST", { username: "walk-ada", password: "Walk45s-Passw0rd!" });
    const meA = await api(C, "/api/auth/me");
    await C.goto(`${BASE}/app`, { waitUntil: "networkidle2", timeout: 60000 });
    const avA = await C.evaluate(() => [...document.querySelectorAll("img")].map(i => i.src).filter(s => /avatar/.test(s)));
    await api(C, "/api/auth/logout", "POST");
    await api(C, "/api/auth/login", "POST", { username: "walk-ben", password: "Walk45s-Passw0rd!" });
    const meB = await api(C, "/api/auth/me");
    await C.goto(`${BASE}/app`, { waitUntil: "networkidle2", timeout: 60000 });
    const avB = await C.evaluate(() => [...document.querySelectorAll("img")].map(i => i.src).filter(s => /avatar/.test(s)));
    const page = await text(C);
    const cc = (await fetch(`${BASE}/api/auth/me`)).headers.get("cache-control");
    say("a148", meA.body?.user?.username === "walk-ada" && meB.body?.user?.username === "walk-ben" && !avB.some(s => avA.includes(s) && avA.length) && !/\bAda\b/.test(page),
      `A then B in one browser: me=${meB.body?.user?.username}; A's avatar urls ${avA.length}, B's ${avB.length}, shared ${avB.filter(s => avA.includes(s)).length}; "Ada" on B's page: ${/\bAda\b/.test(page)}; /api/auth/me Cache-Control: ${cc}`);
    await shot(C, "a148-after-switch");
  }

  // ── D180 P3 / P4 with the network ON (in this copy only) ─────────────────────────────────────────────────────────
  if (want("d180")) {
    setting("network_enabled", "1");
    for (const [p, h] of [[A, "walk-ada"], [B, "walk-ben"]]) {
      await api(p, "/api/profile/page/handle", "PUT", { handle: h });
      await api(p, "/api/profile/page/visibility", "PUT", { page: "public" });
    }
    const req = await api(A, "/api/network/request", "POST", { handle: "walk-ben" });
    const acc = await api(B, "/api/network/walk-ada/accept", "POST");
    const post = await api(B, "/api/network/feed", "POST", { text: "Walk 45s — a post from Ben" });
    await A.goto(`${BASE}/app/network?tab=feed`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(800);
    const feedText = await text(A);
    say("d180", req.status < 400 && acc.status < 400 && /Walk 45s — a post from Ben/.test(feedText), `request ${req.status} · accept ${acc.status} · post ${post.status} · Ada's feed shows Ben's post: ${/Walk 45s — a post from Ben/.test(feedText)}`);
    await shot(A, "d180-feed");
    // P4: Ben works at Stripe and shows it to connections → Ada sees "1 connection works here" on the Stripe page and a posting
    await api(B, "/api/profile/sections/experience", "PUT", { items: [{ company: CO, title: "Software Engineer", current: true, start: "2024-01" }] });
    await api(B, "/api/profile/page/visibility", "PUT", { sections: { experience: "connections" } });
    await A.goto(`${BASE}/app/companies/${CO_SLUG}`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(1200);
    const co = await text(A);
    say("d180", /connection works here/.test(co) && /Ask for a referral/.test(co), `the Stripe page, as Ada: "${(co.match(/\d+ connections? works? here/) || ["(none)"])[0]}"`);
    await shot(A, "d180-works-here");
    const job = db.prepare(`SELECT job_id FROM scraped_jobs WHERE company = ? AND is_active = 1 ORDER BY id LIMIT 1`).pluck().get(CO)
      || db.prepare(`SELECT job_id FROM scraped_jobs WHERE company = ? ORDER BY id LIMIT 1`).pluck().get(CO);
    const at = await api(A, `/api/network/at-company?name=${encodeURIComponent(CO)}&job=${encodeURIComponent(job || "")}`);
    say("d180", at.body?.count === 1 && (at.body?.people?.[0]?.template || "").includes(CO), `at-company for a Stripe posting: ${at.body?.count} · the referral template names Stripe`);
  }

  // ── A154 · League / Challenges / pod rank (switches on, in this copy only) ────────────────────────────────────────
  if (want("a154")) {
    setting("atlas_league_enabled", "1"); setting("atlas_challenges_enabled", "1");
    await A.goto(`${BASE}/app/atlas/league`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(800);
    const j0 = await text(A);
    await A.click("[data-league-join-go] button").catch(() => {});
    await sleep(1200);
    const j1 = await text(A);
    say("a154", /Join .+ pod/.test(j0) && /Leave the league/.test(j1) && /Points from proof only/.test(j1), `the join card, then the pod (${(j1.match(/Bronze · [^\n]+/) || ["?"])[0].slice(0, 90)})`);
    await shot(A, "a154-league");
    const nav = await A.evaluate(() => [...document.querySelectorAll("[data-place-item]")].map(e => e.getAttribute("data-place-item")));
    say("a154", nav.includes("league") && nav.includes("challenges"), `the Compete group in Atlas's nav: ${nav.filter(x => ["league", "challenges"].includes(x)).join(", ")}`);
    await A.goto(`${BASE}/app/atlas/challenges`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(800);
    const ch = await text(A);
    say("a154", /Beat the bar/.test(ch) && /Time attack/.test(ch) && /Friday duel/.test(ch), "Challenges: Beat the bar · Time attack · Friday duel");
    await shot(A, "a154-challenges");
    await A.goto(`${BASE}/app/atlas/your-run`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(800);
    const run = await text(A);
    say("a154", /#1 in your .+ pod/.test(run), `Your run's pod line: ${(run.match(/#\d+ in your [^\n]+/) || ["(none)"])[0]}`);
    await shot(A, "a154-your-run");
    setting("atlas_league_enabled", "0"); setting("atlas_challenges_enabled", "0");
    await A.goto(`${BASE}/app/atlas/your-run`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(600);
    const nav2 = await A.evaluate(() => [...document.querySelectorAll("[data-place-item]")].map(e => e.getAttribute("data-place-item")));
    const off = await api(A, "/api/atlas/league");
    say("a154", !nav2.includes("league") && off.status === 404, `switches off: no Compete in the nav, /api/atlas/league ${off.status}`);
  }

  // ── D185-1 · "this one will ask you N questions" on the posting panel (a cached Greenhouse form in this copy) ──────
  if (want("d185")) {
    const job = db.prepare(`SELECT job_id, company FROM scraped_jobs WHERE is_active = 1 ORDER BY id LIMIT 1`).get()
      || db.prepare(`SELECT job_id, company FROM scraped_jobs ORDER BY id LIMIT 1`).get();
    db.prepare(`INSERT OR REPLACE INTO posting_application_schemas (job_id, ats, status, fields_json, error, fetched_at) VALUES (?, 'greenhouse', 'ok', ?, NULL, unixepoch())`)
      .run(job.job_id, JSON.stringify([
        { name: "first_name", label: "First Name", type: "text", custom: false, is_required: true, handler_type: "first_name" },
        { name: "question_9", label: `Why do you want to work at ${job.company}?`, type: "textarea", custom: true, is_required: true, handler_type: null, group: "custom" },
        { name: "question_10", label: "What is your notice period?", type: "text", custom: true, is_required: false, handler_type: null, group: "custom" },
      ]));
    const q = await api(A, `/api/apply/questions/${encodeURIComponent(job.job_id)}`);
    say("d185", q.body?.known === true && q.body?.count >= 1, `GET questions: known ${q.body?.known} · ${q.body?.count} question(s) · ${JSON.stringify(q.body?.questions?.map(x => x.question)).slice(0, 160)}`);
    const off = await api(A, `/api/apply/questions/${encodeURIComponent(job.job_id)}/draft`, "POST", { question: `Why do you want to work at ${job.company}?` });
    say("d185", off.status === 404, `Draft an answer while the switch is off → ${off.status}`);
  }

  // ── A158 (d) · the search's way back: the dock's bar → a company → Back returns to where the search began ──────────
  if (want("a158d")) {
    await A.goto(`${BASE}/app/jobs`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(800);
    const start = A.url();
    const opened = await A.evaluate(() => { const b = document.querySelector("[data-nav-item='search']"); if (b) { b.click(); return true; } return false; });
    await sleep(500);
    const input = await A.$("[data-dock-search] input.appnav-search__input");
    if (!opened || !input) say("a158d", false, `the dock's search did not open (button ${opened}, input ${!!input})`);
    else {
      await input.type(CO, { delay: 30 });
      await sleep(1200);
      const options = await A.evaluate(() => [...document.querySelectorAll("[role='option'], [data-suggestion]")].map(e => e.textContent.trim()).slice(0, 6));
      await A.keyboard.press("ArrowDown"); await A.keyboard.press("Enter");
      await sleep(1500);
      const mid = A.url();
      await A.goBack({ waitUntil: "networkidle2" }).catch(() => {});
      await sleep(800);
      const back = A.url();
      say("a158d", mid !== start && back === start, `start ${start.replace(BASE, "")} → picked (${options[0] || "?"}) ${mid.replace(BASE, "")} → browser Back ${back.replace(BASE, "")}`);
      await shot(A, "a158d-after-back");
    }
  }

  // ── M-7 · the three-sample walk (D184's test set G–I), as a rehearsal: Maya → Daniel → Elena → Undo back to Daniel ──────
  if (want("m7")) {
    const M = await pageOf(await browser.createBrowserContext());
    await register(M, "maya");
    const uid = db.prepare(`SELECT id FROM users WHERE username = 'walk-maya'`).pluck().get();
    db.prepare(`UPDATE users SET send_mode = 'auto' WHERE id = ?`).run(uid);   // Apply for me on, so a family move must pause it
    const sample = (k) => JSON.parse(fs.readFileSync(`content/trial/sample-${k}.json`, "utf8"));
    const sentence = async () => {
      await M.goto(`${BASE}/app/jobs`, { waitUntil: "networkidle2", timeout: 60000 }); await sleep(1200);
      return M.evaluate(() => (document.querySelector("[data-board-headline]")?.innerText || "").replace(/\s+/g, " ").trim());
    };
    // The substance of SAMPLES.md's sentence — its role, its level, Boston. (Its exact words differ from the board's approved
    // D37 / A145 words — the owner's open choice — and this copy has only one company's postings open, so it reads "nothing matches".)
    const fits = (text, s) => { const t = text.toLowerCase(); const sub = String(s.expected.subcategory).toLowerCase();
      return t.includes(sub) && t.includes(`${s.expected.level} career level`) && t.includes("in boston") && !t.includes("all roles"); };
    let pid = null;
    const upload = async (k) => {
      const s = sample(k);
      // the first résumé goes in as the board's Upload your résumé sends it (StartFromResume → /from-resume); a later one is a
      // REPLACE on the job profile (the Profile page's upload → /:id/base-resume), which is what snapshots and pauses
      const r = pid == null
        ? await api(M, "/api/domain-profiles/from-resume", "POST", { content: s.resumeText, name: `${s.candidate.fullName}.txt` })
        : await api(M, `/api/domain-profiles/${pid}/base-resume`, "POST", { content: s.resumeText, name: `${s.candidate.fullName}.txt` });
      if (pid == null) pid = (await api(M, "/api/profile/page")).body?.activeProfileId ?? null;
      await api(M, `/api/domain-profiles/${pid}/signals/refresh`, "POST");
      return { s, r };
    };
    const g = await upload("g");
    const sg = await sentence();
    say("m7", fits(sg, g.s), `Maya (${g.r.status}): "${sg}" — expected "${g.s.expected.sentence}"`);
    await shot(M, "m7-maya");
    const h = await upload("h");
    const sh = await sentence();
    const changed = await api(M, "/api/profile/replacements/latest");
    say("m7", fits(sh, h.s), `Daniel replaces Maya (${h.r.status}): "${sh}" — expected "${h.s.expected.sentence}"`);
    const lines = changed.body?.replacement?.lines || [];
    const decision = lines.find(l => l.kind === "decision" && l.what === "apply_for_me");
    const paused = db.prepare(`SELECT apply_paused_at FROM domain_profiles WHERE id = ?`).pluck().get(pid);
    say("m7", lines.length > 0 && !!decision && !!paused, `What changed: ${lines.length} lines (${lines.slice(0, 3).map(l => l.text).join(" | ")}) · Apply for me paused: ${!!paused} · decision line: ${decision?.text || "none"}`);
    await shot(M, "m7-daniel");
    const i = await upload("i");
    const si = await sentence();
    say("m7", fits(si, i.s), `Elena replaces Daniel (${i.r.status}): "${si}" — expected "${i.s.expected.sentence}"`);
    const last = await api(M, "/api/profile/replacements/latest");
    const undo = last.body?.replacement ? await api(M, `/api/profile/replacements/${last.body.replacement.id}/undo`, "POST") : { status: 0 };
    const su = await sentence();
    say("m7", undo.status === 200 && fits(su, h.s), `Undo (${undo.status}) returns to Daniel: "${su}"`);
    await shot(M, "m7-undo");
  }
} catch (e) {
  say("harness", false, `threw: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
} finally {
  await browser.close().catch(() => {});
  db.close();
  stop();
  fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(DIR, "server.log"), log);
  console.log(`\n${results.filter(r => r.ok).length} / ${results.length} PASS`);
}

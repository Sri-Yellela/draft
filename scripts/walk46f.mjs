// scripts/walk46f.mjs — ⭐ 46f · the REAL-CHROME WALK of Feed and Messages as their own places (owner 11-11), against the
// real server booted from this checkout on a THROWAWAY copy of data/resume_master.db (RM_DATA_DIR = tmp/walk46f; no model
// key, no email key, no .env — memory: harness key leak). Synthetic people only (walk-ada, walk-ben). Each step prints
// PASS / FAIL with what it saw; screenshots under tmp/walk46f/shots/. Usage: node scripts/walk46f.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walk46f"), SHOTS = path.join(DIR, "shots");
const PORT = 4412, BASE = `http://127.0.0.1:${PORT}`;
const SRC_DB = process.env.WALK_DB || path.join(ROOT, "data", "resume_master.db");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (walk, ok, what) => { results.push({ walk, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${walk}: ${what}`); };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));

const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk46f-secret-not-real",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);

async function ready() {
  for (let i = 0; i < 480; i++) {
    try { const r = await fetch(`${BASE}/api/health/ready`); if (r.ok) return true; } catch { /* not yet */ }
    await sleep(500);
  }
  return false;
}
if (!(await ready())) { console.log("server never became ready\n" + log.slice(-3000)); process.exit(1); }
const db = new Database(path.join(DIR, "resume_master.db"));
const setting = (k, v) => db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(k, v);

const resolution = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true,
  args: ["--no-first-run", "--no-default-browser-check", "--disable-features=HttpsFirstBalancedModeAutoEnable"] });
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
const waitText = async (p, re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await text(p))) return true; await sleep(300); } return false; };
async function register(p, who) {
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const r = await api(p, "/api/auth/register", "POST", { username: `walk-${who}`, password: "Walk46f-Passw0rd!", profile: { email: `walk-${who}@example.invalid`, first_name: who === "ada" ? "Ada" : "Ben", last_name: "Example" } });
  if (r.status >= 400) return api(p, "/api/auth/login", "POST", { username: `walk-${who}`, password: "Walk46f-Passw0rd!" });
  return r;
}
const visible = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none"; }, sel);

try {
  const ra = await register(A, "ada"), rb = await register(B, "ben");
  say("setup", ra.status < 400 && rb.status < 400, `register / log in: Ada ${ra.status} · Ben ${rb.status}`);

  // ── 1 · switch OFF (the default): the dock has no Feed / Messages; a direct link says so ─────────────────────────────
  setting("network_enabled", "0");
  await A.goto(`${BASE}/app/feed`, { waitUntil: "networkidle2", timeout: 90000 });
  const offOk = await waitText(A, /This isn't available yet\./);
  const dockOff = await A.evaluate(() => ({ feed: !!document.querySelector('[data-nav-item="feed"]'), msgs: !!document.querySelector('[data-nav-item="messages"]') }));
  say("off", offOk && !dockOff.feed && !dockOff.msgs, `/app/feed with the switch off: "isn't available yet" ${offOk} · dock Feed ${dockOff.feed} · dock Messages ${dockOff.msgs}`);
  await shot(A, "1-off");

  // ── 2 · switch ON: connect, Ben posts and writes; the dock shows Network · Feed · Messages, the unread on Messages ──
  setting("network_enabled", "1");
  for (const [p, h] of [[A, "walk-ada"], [B, "walk-ben"]]) {
    await api(p, "/api/profile/page/handle", "PUT", { handle: h });
    await api(p, "/api/profile/page/visibility", "PUT", { page: "public" });
  }
  const req = await api(A, "/api/network/request", "POST", { handle: "walk-ben" });
  const acc = await api(B, "/api/network/walk-ada/accept", "POST");
  const post = await api(B, "/api/network/feed", "POST", { text: "Walk 46f — a post from Ben" });
  const msg = await api(B, "/api/network/messages", "POST", { to: "walk-ada", text: "Walk 46f — hello Ada, from Ben" });
  say("setup", req.status < 400 && acc.status < 400 && post.status < 400 && msg.status < 400, `request ${req.status} · accept ${acc.status} · post ${post.status} · message ${msg.status} (thread ${msg.body?.threadId})`);

  await A.goto(`${BASE}/app`, { waitUntil: "networkidle2", timeout: 90000 });
  await A.waitForSelector('[data-nav-item="messages"]', { timeout: 20000 }).catch(() => {});
  const dock = await A.evaluate(() => {
    const ids = [...document.querySelectorAll("nav[aria-label='Main'] [data-nav-item]")].map(a => a.getAttribute("data-nav-item"));
    const m = document.querySelector('[data-nav-item="messages"]');
    return { ids, msgBadge: m?.querySelector(".appnav-badge")?.textContent || "", netBadge: document.querySelector('[data-nav-item="network"] .appnav-badge')?.textContent || "",
      hrefs: { feed: document.querySelector('[data-nav-item="feed"]')?.getAttribute("href"), messages: m?.getAttribute("href") } };
  });
  const order = dock.ids.indexOf("network") >= 0 && dock.ids.indexOf("feed") === dock.ids.indexOf("network") + 1 && dock.ids.indexOf("messages") === dock.ids.indexOf("network") + 2;
  say("dock", order && /1/.test(dock.msgBadge) && !dock.netBadge && dock.hrefs.feed === "/app/feed" && dock.hrefs.messages === "/app/messages",
    `dock: ${dock.ids.join(" · ")} · Messages badge "${dock.msgBadge.trim()}" · Network badge "${dock.netBadge.trim()}" · hrefs ${JSON.stringify(dock.hrefs)}`);
  await shot(A, "2-dock");

  // ── 3 · Feed: the dock item opens /app/feed — Ben's post in the main column, What you share in the side column ─────
  await A.evaluate(() => document.querySelector('[data-nav-item="feed"]').click());
  const feedOk = await waitText(A, /Walk 46f — a post from Ben/);
  const feed = await A.evaluate(() => ({ path: location.pathname, side: !!document.querySelector(".net-cols__side [data-feed-share]"), main: !!document.querySelector(".net-cols__main [data-feed-composer]"),
    shareInMain: !!document.querySelector(".net-cols__main [data-feed-share]"), cols: getComputedStyle(document.querySelector(".net-cols")).gridTemplateColumns }));
  say("feed", feedOk && feed.path === "/app/feed" && feed.side && feed.main && !feed.shareInMain, `${feed.path} · Ben's post ${feedOk} · composer in main ${feed.main} · What you share in side ${feed.side} (not repeated in main: ${!feed.shareInMain}) · columns ${feed.cols}`);
  await shot(A, "3-feed");
  // Ada posts from the page; Ben sees it in his feed.
  await A.type('[data-feed-composer] textarea', "Walk 46f — Ada posts from the Feed page");
  await A.evaluate(() => [...document.querySelectorAll("[data-feed-composer] button")].find(b => /Post/.test(b.textContent)).click());
  await sleep(1200);
  const benFeed = await api(B, "/api/network/feed");
  say("feed", (benFeed.body?.posts || []).some(p => /Ada posts from the Feed page/.test(p.text || "")), `Ada's post reached Ben's feed: ${(benFeed.body?.posts || []).length} posts`);

  // ── 4 · Messages: the list beside the open conversation; reply; the URL carries the thread ─────────────────────────
  await A.evaluate(() => document.querySelector('[data-nav-item="messages"]').click());
  await waitText(A, /Ben Example|walk-ben/);
  const listOk = await A.evaluate(() => ({ path: location.pathname, rows: document.querySelectorAll("[data-msg-row]").length, none: !!document.querySelector("[data-msg-none]") }));
  say("messages", listOk.path === "/app/messages" && listOk.rows >= 1 && listOk.none, `${listOk.path} · ${listOk.rows} conversation(s) · "Pick a conversation" shown ${listOk.none}`);
  await shot(A, "4-messages-list");
  await A.evaluate(() => document.querySelector("[data-msg-row]").click());
  // (the list's preview carries Ben's words too — wait for the conversation itself, not the text)
  const threadOk = await A.waitForSelector(".msg-cols__thread [data-msg-thread] .msg__text", { timeout: 20000 }).then(() => true).catch(() => false);
  if (!threadOk) console.log("thread pane:", await A.evaluate(() => document.querySelector(".msg-cols__thread")?.innerText || "(no pane)"));
  const both = await A.evaluate(() => ({ search: location.search, list: !!document.querySelector(".msg-cols__list [data-msg-row]"), thread: !!document.querySelector(".msg-cols__thread [data-msg-thread]"),
    marked: document.querySelector("[data-msg-row][aria-current='true']") != null }));
  say("messages", threadOk && /thread=\d+/.test(both.search) && both.list && both.thread && both.marked, `opened: ${both.search} · Ben's message ${threadOk} · list and conversation side by side ${both.list && both.thread} · the open row marked ${both.marked}`);
  const badgeGone = await (async () => { for (let i = 0; i < 20; i++) { const b = await A.evaluate(() => document.querySelector('[data-nav-item="messages"] .appnav-badge')?.textContent || ""); if (!b) return true; await sleep(300); } return false; })();
  say("messages", badgeGone, `the dock's Messages count clears once the conversation is read (no minute's wait): ${badgeGone}`);
  await A.type(".msg-compose textarea", "Walk 46f — Ada replies from Messages");
  await A.evaluate(() => [...document.querySelectorAll(".msg-compose button")].find(b => /Send/.test(b.textContent)).click());
  const replied = await waitText(A, /Ada replies from Messages/);
  const benThread = await api(B, `/api/network/messages/${msg.body?.threadId}`);
  say("messages", replied && (benThread.body?.messages || []).some(m => /Ada replies from Messages/.test(m.text || "")), `the reply drawn for Ada ${replied} · reached Ben ${(benThread.body?.messages || []).length} messages`);
  await shot(A, "4-messages-thread");

  // ── 5 · old addresses land on the new pages ───────────────────────────────────────────────────────────────────────
  await A.goto(`${BASE}/app/network?tab=messages&thread=${msg.body?.threadId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1200);
  const r1 = await A.evaluate(() => location.pathname + location.search);
  await A.goto(`${BASE}/app/network?tab=feed`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1200);
  const r2 = await A.evaluate(() => location.pathname + location.search);
  await A.goto(`${BASE}/app/network`, { waitUntil: "networkidle2", timeout: 60000 });
  const people = await waitText(A, /Connections · 1/);
  const tabs = await A.evaluate(() => !!document.querySelector("[role='tablist']"));
  say("redirect", r1 === `/app/messages?thread=${msg.body?.threadId}` && r2 === "/app/feed" && people && !tabs, `?tab=messages → ${r1} · ?tab=feed → ${r2} · Network = People (Connections · 1: ${people}), no tab row ${!tabs}`);
  await shot(A, "5-network-people");

  // ── 6 · a phone: one column — the conversation alone when one is open, the list alone when none ──────────────────
  await A.setViewport({ width: 390, height: 844 });
  await A.goto(`${BASE}/app/messages?thread=${msg.body?.threadId}`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(A, /hello Ada, from Ben/);
  const phoneOpen = { list: await visible(A, ".msg-cols__list"), thread: await visible(A, ".msg-cols__thread") };
  await shot(A, "6-phone-thread");
  await A.goto(`${BASE}/app/messages`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(A, /Ben Example|walk-ben/);
  const phoneList = { list: await visible(A, ".msg-cols__list"), thread: await visible(A, ".msg-cols__thread") };
  const overflow = await A.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  say("phone", phoneOpen.thread && !phoneOpen.list && phoneList.list && !phoneList.thread && !overflow, `open: thread ${phoneOpen.thread} / list ${phoneOpen.list} · none open: list ${phoneList.list} / thread ${phoneList.thread} · sideways scroll ${overflow}`);
  await shot(A, "6-phone-list");
  await A.goto(`${BASE}/app/feed`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText(A, /Walk 46f — a post from Ben/);
  const feedPhoneOverflow = await A.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  say("phone", !feedPhoneOverflow, `Feed at 390 px: sideways scroll ${feedPhoneOverflow}`);
  await shot(A, "6-phone-feed");
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

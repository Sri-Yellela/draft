// scripts/a228SkillMapWalk.mjs — ⭐ A228 (46r) · the REAL-CHROME walk of Your map (the skill map) against the real server
// booted from this checkout on a COPY of the 100k synthetic fixture (never the original). A SYNTHETIC person is registered
// through the API, given skills in the copy (Profile skills, three proven by a passed check) and an aim, then the page is
// shot at 1920 and 400 px in Dusk Dark and Plain Light (+ the List view and a tooltip) into docs/fidelity-shots/a228-*.png.
//   node scripts/a228SkillMapWalk.mjs [copyDir=tmp/a228build]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing — nothing here can
// call a model or send a mail. The fixture's child may ignore SIGTERM: it is killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/a228build");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4428, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
if (!fs.existsSync(path.join(RUN, "resume_master.db")) || /scale-100k[\\/]?$/.test(RUN)) throw new Error(`refusing: ${RUN} must be a COPY of the fixture`);

// the copy re-seen now (scaleSuite.mjs 46c: else the boot's expiry retires ~92 % of it) and the rollups marked as run
{
  const copy = new Database(path.join(RUN, "resume_master.db"));
  copy.prepare(`UPDATE scraped_jobs SET scraped_at = ? - (id * 7919 % 518400)`).run(Math.floor(Date.now() / 1000));
  copy.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('d151_history_rollup_at', ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(Math.floor(Date.now() / 1000)));
  copy.close();
}

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "a228-walk-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-a228-walk" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { process.kill(server.pid, "SIGKILL"); } catch { /* gone */ } try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

let browser = null;
try {
  const t0 = Date.now();
  for (;;) {
    if (server.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    const s = await fetch(`${BASE}/api/health/ready`).then(r => r.status).catch(() => 0);
    if (s === 200) break;
    if (Date.now() - t0 > 540000) throw new Error(`not ready in 9 minutes:\n${log.slice(-3000)}`);
    await sleep(500);
  }
  console.log(`ready in ${Math.round((Date.now() - t0) / 1000)} s`);

  const resolution = await resolveBrowserExecutable();
  browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
    const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    let j = null; try { j = await r.json(); } catch { j = null; } return { status: r.status, body: j };
  }, url, method, body);

  // a SYNTHETIC person
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const who = `a228-walk-${Date.now().toString(36)}`;
  const reg = await api("/api/auth/register", "POST", { username: who, password: "A228-Walk-Passw0rd!", profile: { email: `${who}@example.invalid`, first_name: "Rin", last_name: "Example" } });
  const me = await api("/api/auth/me");
  const uid = me.body?.user?.id;
  say("register", reg.status < 400 && uid != null, `${reg.status} user ${uid}`);
  {
    const db = new Database(path.join(RUN, "resume_master.db"));
    db.pragma("busy_timeout = 5000");
    const big = db.prepare(`SELECT role_id, COUNT(*) n FROM atlas_posting_match WHERE role_id IS NOT NULL GROUP BY role_id ORDER BY n DESC LIMIT 2`).all();
    const role = big[1].role_id;
    const counts = new Map();
    for (const a of db.prepare(`SELECT asked FROM atlas_posting_match WHERE role_id = ?`).pluck().iterate(role)) for (const id of String(a).split(",").filter(Boolean)) counts.set(+id, (counts.get(+id) || 0) + 1);
    const nodes = new Map(db.prepare(`SELECT id, name, term, kind, slug FROM atlas_nodes`).all().map(n => [n.id, n]));
    const top = [...counts.entries()].filter(([id]) => ["skill", "tool", "stack"].includes(nodes.get(id)?.kind)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([id]) => nodes.get(id));
    const mine = [top[0], top[1], top[3], top[5], top[6], top[8], top[11]].filter(Boolean);
    mine.forEach((n, i) => db.prepare(`INSERT INTO profile_skills (user_id, name, position, source) VALUES (?, ?, ?, 'user')`).run(uid, n.name, i));
    for (const n of mine.slice(0, 3)) db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via) VALUES (?, ?, ?, 'checked', 'check')`).run(uid, n.term, n.name);
    db.prepare(`INSERT INTO navigator_routes (user_id, aim_slug, aim_set_by, aim_at) VALUES (?, ?, 'user', unixepoch()) ON CONFLICT(user_id) DO UPDATE SET aim_slug = excluded.aim_slug`).run(uid, nodes.get(role).slug);
    db.prepare(`UPDATE user_profile SET current_job_title = ? WHERE user_id = ?`).run(nodes.get(big[0].role_id).name, uid);
    db.close();
    console.log(`skills: ${mine.map(n => n.name).join(", ")} (3 proven) · aim ${nodes.get(role).name} · today ${nodes.get(big[0].role_id).name}`);
  }
  const t1 = performance.now();
  const first = await api("/api/atlas/skill-map");
  const firstMs = Math.round(performance.now() - t1);
  const t2 = performance.now();
  await api("/api/atlas/skill-map");
  const warmMs = Math.round(performance.now() - t2);
  say("skill-map API", first.status === 200 && first.body?.found, `${first.status} first ${firstMs} ms (incl. the index build), warm ${warmMs} ms · ${first.body?.role?.name}: ${first.body?.applicable} of ${first.body?.role?.judged} · levels ${JSON.stringify(first.body?.levels)}`);

  for (const theme of ["dusk-dark", "plain-light"]) {
    const ap = await api("/api/settings/appearance", "PUT", { theme });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1920, 1080], [400, 860]]) {
      await page.setViewport({ width: w, height: h });
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/your-map`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector("[data-skill-map]", { timeout: 60000 });
      await sleep(1200);
      const facts = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        sections: [...document.querySelectorAll("[data-skm-section]")].map(s => s.getAttribute("data-skm-section")),
        svgs: document.querySelectorAll(".skm-chart svg").length,
        tables: document.querySelectorAll("[data-skm-table]").length,
        levels: !!document.querySelector("[data-skm-levels]"),
        n: document.querySelector("[data-skm-applicable]")?.textContent,
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        routeClosed: document.querySelector("[data-atlas-route-steps]")?.open === false,
        jargon: (document.querySelector("[data-skill-map]")?.innerText.match(/\bpostings?\b|\basks\b|\bcoverage\b/gi) || []),
        steps: document.querySelectorAll("[data-skm-step]").length,
        logos: document.querySelectorAll("[data-skm-step] [data-company-logo]").length,
      }));
      const name = `a228-${theme}-${w}`;
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
      say(name, facts.theme === theme && facts.sections.join() === "number,wants,learn,move" && facts.svgs === 4 && facts.tables === 4 && !facts.hscroll && facts.routeClosed && !facts.jargon.length && errors.length === 0,
        `${JSON.stringify(facts)} errors ${JSON.stringify(errors.slice(0, 3))} (applied ${ap.status})`);
    }
  }
  // Dusk Dark 1920: a tooltip (keyboard focus on a map tile), the List view, another role from its button
  await api("/api/settings/appearance", "PUT", { theme: "dusk-dark" });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft-theme", "dusk-dark"); } catch { /* blocked */ } });
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`${BASE}/app/atlas/your-map`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector("[data-skm-tile] rect[data-tip]", { timeout: 60000 });
  await page.evaluate(() => document.querySelector("[data-skm-tile] rect[data-tip]").focus());   // an SVG mark: tabindex 0
  await sleep(300);
  const tip = await page.evaluate(() => document.querySelector(".skm-tip")?.innerText || null);
  const wants = await page.$("[data-skm-section=wants]");
  await wants.screenshot({ path: path.join(SHOTS, "a228-dusk-dark-1920-tooltip.png") });
  say("tooltip on focus", !!tip && /jobs want it/.test(tip) && /You: /.test(tip), JSON.stringify(tip));
  await page.evaluate(() => [...document.querySelectorAll("[data-skm-view] button")].find(b => b.textContent === "List").click());
  await sleep(500);
  const listOk = await page.evaluate(() => !!document.querySelector('[data-skm-treemap="list"]') && !document.querySelector('[data-skm-treemap="map"]'));
  await (await page.$("[data-skm-section=wants]")).screenshot({ path: path.join(SHOTS, "a228-dusk-dark-1920-list.png") });
  say("Map | List, one at a time", listOk, "the List view replaces the map");
  const before = await page.evaluate(() => document.querySelector("#skm-wants")?.textContent);
  await page.evaluate(() => { const b = [...document.querySelectorAll("[data-skm-role-btn]")].map(s => s.closest("button")).find(x => x.getAttribute("aria-pressed") !== "true"); b?.click(); });
  await page.waitForFunction((t) => document.querySelector("#skm-wants")?.textContent !== t, { timeout: 60000 }, before).catch(() => null);
  const after = await page.evaluate(() => document.querySelector("#skm-wants")?.textContent);
  say("a role button re-sizes the map", after && after !== before, `${before} → ${after}`);
  // the request times once the boot's own work has settled: a role not asked yet (a new answer on the warm index), the same
  // again (the cached answer), and /api/version beside them (the loop's own latency)
  const roles = (await api("/api/atlas/skill-map")).body.roles;
  const other = roles[roles.length - 1].slug;
  const tm = async (u) => { const s0 = performance.now(); const r = await api(u); return [Math.round(performance.now() - s0), r.status]; };
  const [v] = await tm("/api/version");
  const [n1] = await tm(`/api/atlas/skill-map?role=${encodeURIComponent(other)}`);
  const [n2] = await tm(`/api/atlas/skill-map?role=${encodeURIComponent(other)}`);
  say("settled timings", true, `/api/version ${v} ms · a new role's answer ${n1} ms · the same again (cached) ${n2} ms`);
} catch (e) {
  say("walk", false, e.stack || e.message);
} finally {
  try { await browser?.close(); } catch { /* gone */ }
  kill();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} / ${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

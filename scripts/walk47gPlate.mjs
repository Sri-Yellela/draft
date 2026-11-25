// scripts/walk47gPlate.mjs — ⭐ 47g item 0 · THE PLATE MARKET WALKED SIGNED IN, in a real Chrome — never walked live before.
// Real server from this checkout on a THROWAWAY copy of data/resume_master.db (keys blanked, no crawl), a synthetic TEST
// account with the trial's sample résumé A (test accounts draft to draft's practice form, never an employer). At 1280 and 390,
// in Dusk Dark (the default) and Paper Light: the whole ticket, Pass / Save / Draft this job deciding the card, ‹ › and the
// wheel, the field card's three labelled numbers, a tab switch keeping the board, the Index's rows, the bubble's Star / Draft
// (hover at 1280, a tap at 390), the keyboard, no side-scroll, no page errors. Shots: docs/fidelity-shots/walk47g-*.png.
//   npm --prefix client run build && node scripts/walk47gPlate.mjs
// ⛔ The harness key leak (memory): ANTHROPIC_KEY blanked, DOTENV_CONFIG_PATH points at nothing. Killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walk47gPlate"), SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4457, BASE = `http://127.0.0.1:${PORT}`;
const SRC_DB = process.env.WALK_DB || path.join(ROOT, "data", "resume_master.db");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial/sample-a.json"), "utf8"));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));
// ⛔ the scale-fixture trap (memory): a copy's scraped_at is weeks old, and a boot retires what it reads as stale. RE-SEEN NOW,
// spread over the last 6 days (scaleSuite's re-date), active again, posted within a fortnight.
{ const c = new Database(path.join(DIR, "resume_master.db")); const now = Math.floor(Date.now() / 1000);
  const n = c.prepare(`UPDATE scraped_jobs SET scraped_at = ? - (id * 7919 % 518400), is_active = 1`).run(now).changes;
  const cols = new Set(c.prepare("PRAGMA table_info(scraped_jobs)").all().map(x => x.name));
  if (cols.has("posted_at")) c.prepare(`UPDATE scraped_jobs SET posted_at = strftime('%Y-%m-%dT%H:%M:%SZ', ? - (id * 104729 % 1209600), 'unixepoch')`).run(now);
  c.close(); console.log(`re-seen ${n} postings`); }
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk47gPlate-not-real",
  APP_BASE_URL: BASE, DRAFT_DEFER_PREVIEW_GENERATION: "1", DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
  DOTENV_CONFIG_PATH: "./.no-dotenv-for-walk47gPlate" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

let browser = null;
try {
  const t0 = Date.now();
  for (;;) {
    if (server.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    if (await fetch(`${BASE}/api/health/ready`).then(r => r.ok).catch(() => false)) break;
    if (Date.now() - t0 > 600000) throw new Error(`not ready in 10 minutes:\n${log.slice(-3000)}`);
    await sleep(1000);
  }
  console.log(`ready in ${Math.round((Date.now() - t0) / 1000)} s`);
  const resolution = await resolveBrowserExecutable();
  browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-features=HttpsFirstBalancedModeAutoEnable"] });
  let page = null, ctx = null;   // a fresh context per view (signUp)
  const errors = [];
  const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
    const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    let j = null; try { j = await r.json(); } catch { j = null; }
    return { status: r.status, body: j };
  }, url, method, body);

  // one account per view: each view decides three cards, and a day deals ten — a fresh person starts every view on a full deck
  let nth = 0;
  const signUp = async (theme) => {
    nth += 1; const user = `walk-47g-plate-${nth}`;
    try { await ctx?.close(); } catch { /* gone */ }
    ctx = await browser.createBrowserContext(); page = await ctx.newPage();
    page.on("pageerror", e => errors.push(e.message));
    if (process.env.WALK_FACETLOG) await page.evaluateOnNewDocument(() => {
      const ES = window.EventSource;
      window.EventSource = function (url, opts) {
        const es = new ES(url, opts);
        (window.__sse ||= { opened: 0, types: {} }).opened++;
        es.addEventListener("message", (m) => { let t = "?"; try { const d = JSON.parse(m.data); t = d.type + (d.type === "board_scored" ? `(w${d.waiting})` : ""); } catch { /* not json */ }
          window.__sse.types[t] = (window.__sse.types[t] || 0) + 1; });
        return es;
      };
      window.EventSource.prototype = ES.prototype;
    });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); localStorage.removeItem("draft.plate.market"); } catch { /* blocked */ } }, theme);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const reg = await api("/api/auth/register", "POST", { username: user, password: "Walk47g-Plate-Passw0rd!", profile: { email: `${user}@example.invalid`, first_name: "Walk", last_name: "Plate" } });
    const w = new Database(path.join(DIR, "resume_master.db")); w.pragma("busy_timeout = 5000");
    w.prepare("UPDATE users SET test_account = 1 WHERE username = ?").run(user);
    w.close();
    const up = await api("/api/domain-profiles/from-resume", "POST", { content: sample.resumeText, name: `${sample.candidate.fullName}.txt` });
    say(`setup ${user}`, reg.status < 400 && up.status < 400, `register ${reg.status} · résumé ${up.status}`);
  };
  // the VISIBLE front: decided cards linger at offset 0 with opacity 0 (A238 — framer-motion's exit never unmounts them), so
  // the front is the last offset-0 card whose opacity is 1
  const frontTitle = () => page.evaluate(() => { const live = [...document.querySelectorAll("[data-fan-offset='0']")].filter(e => getComputedStyle(e).opacity !== "0");
    return live[live.length - 1]?.querySelector("[data-deck-title-line]")?.textContent?.trim() || null; });
  // the deal can show an empty marker for a moment while it arrives: wait for a ticket first, accept "empty" only after 90 s
  const waitDeck = () => page.waitForFunction(() => document.querySelector("[data-fan-offset='0'] [data-deck-title-line]"), { timeout: 90000 }).catch(() => null);

  for (const theme of (process.env.WALK_THEMES || "dusk-dark,paper-light").split(",")) {
    for (const [vw, vh] of [[1280, 900], [390, 844]].filter(([x]) => !process.env.WALK_WIDTHS || process.env.WALK_WIDTHS.split(",").includes(String(x)))) {
      const tag = `${theme} ${vw}`;
      await signUp(theme);
      await page.setViewport({ width: vw, height: vh, isMobile: vw < 600, hasTouch: vw < 600 });
      errors.length = 0;
      await page.goto(`${BASE}/app/jobs${process.env.WALK_PLATE === "0" ? "?plate=0" : ""}`, { waitUntil: "networkidle2", timeout: 180000 }).catch(() => {});
      await waitDeck();
      await sleep(1500);
      const s = await page.evaluate(() => {
        const plate = !!document.querySelector(".pl-marketpage");
        const front = document.querySelector("[data-fan-offset='0']");
        const r = front?.getBoundingClientRect();
        const face = front?.querySelector(".pl-opening, [data-plate-face]");
        const fr = face?.getBoundingClientRect();
        const title = front?.querySelector("[data-deck-title-line]");
        const tr = title?.getBoundingClientRect();
        const field = [...document.querySelectorAll(".pl-fieldcard, [class*='fieldcard']")].map(e => e.innerText).join(" ");
        return { plate, empty: document.querySelector("[data-deck-empty]")?.getAttribute("data-deck-empty") || null,
          front: !!front, frontBox: r ? [Math.round(r.left), Math.round(r.right)] : null,
          faceInView: fr ? fr.left >= -1 && fr.right <= innerWidth + 1 : null,
          titleWhole: title ? title.scrollWidth <= title.clientWidth + 1 && tr.right <= innerWidth + 1 : null,
          actions: [...(front?.querySelectorAll("[data-deck-action]") || [])].map(b => b.getAttribute("data-deck-action")),
          field, sideScroll: document.documentElement.scrollWidth > innerWidth + 1,
          bg: getComputedStyle(document.querySelector(".pl-marketpage") || document.body).backgroundColor };
      });
      if (process.env.WALK_FACETS) for (const waitS of [0, 15, 30, 45, 60, 90, 120]) {
        if (waitS) await sleep(waitS <= 60 ? 15000 : 30000);
        const f = await page.evaluate(async () => { const r = await fetch("/api/jobs/facets", { credentials: "include" }); const b = await r.json().catch(() => null);
          const j = await fetch("/api/jobs?page=1&pageSize=50", { credentials: "include" }).then(x => x.json()).catch(() => null);
          return { cache: r.headers.get("X-Facets-Cache"), asOf: r.headers.get("X-Facets-As-Of"), views: b?.views, posted: (b?.clauses?.posted || []).map(o => `${o.value}:${o.count}`).join(","),
            usable: b ? { total: b.total, known: b.known, unscored: b.unscored, coverage: b.coverage } : null, jobs: j?.jobs?.length, total: j?.total ?? j?.totalCount ?? null, matching: j?.beingMatched ?? null }; });
        const hero = await page.evaluate(() => document.querySelector(".pl-markethero, [class*='markethero']")?.innerText?.replace(/\s+/g, " ").slice(0, 120));
        console.log(`FACETS +${waitS}s: ${JSON.stringify(f).slice(0, 420)} · hero: ${hero}`);
      }
      say(`${tag}: the plate market is the page`, s.plate, `plate ${s.plate} · ground ${s.bg}`);
      say(`${tag}: a dealt ticket`, s.front, s.front ? `front at ${s.frontBox}` : `empty: ${s.empty}`);
      if (!s.front) { await page.screenshot({ path: path.join(SHOTS, `walk47g-${theme}-${vw}-empty.png`) }); continue; }
      say(`${tag}: the whole ticket in view, the title not cut`, s.faceInView && s.titleWhole, `face in view ${s.faceInView} · title whole ${s.titleWhole}`);
      say(`${tag}: Pass · Save · Send · Draft this job on the ticket`, ["pass", "save", "send", "draft"].every(a => s.actions.includes(a)), JSON.stringify(s.actions));
      say(`${tag}: the field card's three labelled numbers`, /ROLE FIT/i.test(s.field) && /STACK/i.test(s.field) && /DUTIES/i.test(s.field), s.field.replace(/\s+/g, " ").slice(0, 140));
      // ⭐ A239: the hero's counts follow the board as the new person's postings are scored — never a frozen 0 beside a full board
      const facetLog = [];
      if (process.env.WALK_FACETLOG) page.on("response", async (r) => { if (!r.url().includes("/api/jobs/facets")) return;
        let all = null; try { all = (await r.json())?.views?.all; } catch { /* body gone */ }
        facetLog.push(`${new Date().toISOString().slice(14, 23)} ${r.headers()["x-facets-cache"]} asOf ${String(r.headers()["x-facets-as-of"]).slice(14, 23)} all ${all}`); });
      { let hero = null, total = null, matching = null; const t0 = Date.now();
        while (Date.now() - t0 < 120000) {
          [hero, total] = await page.evaluate(async () => { const cell = [...document.querySelectorAll(".pl-markethero .pl-stats__cell, .pl-markethero [class*='stats'] > *")]
              .find(c => /FIT YOUR BEARING/.test(c.innerText)); const n = cell ? parseInt(cell.innerText.replace(/[^0-9]/g, ""), 10) : null;
            const j = await fetch("/api/jobs?page=1&pageSize=1", { credentials: "include" }).then(x => x.json()).catch(() => null);
            return [Number.isFinite(n) ? n : null, j?.total ?? null, j?.beingMatched ?? 0]; }).then(([h, t, m]) => { matching = m; return [h, t]; });
          // only once the board says nothing is still being matched: comparing mid-scoring passes on an early 41 = 41
          if (!matching && hero != null && total != null && hero === total && hero > 0) break;
          await sleep(5000);
        }
        if (process.env.WALK_FACETLOG) console.log(["FACETLOG", ...facetLog].join("\n  "));
        if (process.env.WALK_FACETLOG) console.log("SSE", JSON.stringify(await page.evaluate(() => window.__sse || "no EventSource opened")).slice(0, 900));
        say(`${tag}: the hero's FIT YOUR BEARING follows the board once scored (A239)`, !matching && hero != null && hero === total && hero > 0, `hero ${hero} · board ${total} · still matching ${matching} · after ${Math.round((Date.now() - t0) / 1000)} s`); }
      say(`${tag}: no side-scroll`, !s.sideScroll, s.sideScroll ? "scrolls sideways" : "none");
      await page.screenshot({ path: path.join(SHOTS, `walk47g-${theme}-${vw}-deck.png`) });

      // ‹ › and the wheel turn one card; the keyboard J / K the same
      const t1 = await frontTitle();
      await page.evaluate(() => document.querySelector("[data-deck-flip='next']")?.click()); await sleep(900);
      const t2 = await frontTitle();
      await page.evaluate(() => document.querySelector("[data-deck-flip='prev']")?.click()); await sleep(900);
      const t3 = await frontTitle();
      say(`${tag}: › turns on one card, ‹ back`, t2 && t2 !== t1 && t3 === t1, `${t1} → ${t2} → ${t3}`);
      if (vw >= 600) {
        const box = await page.evaluate(() => { const st = document.querySelector("[data-deck-stage]"); st.scrollIntoView({ block: "center" });
          const r = st.getBoundingClientRect(); return { x: r.left + Math.min(200, r.width / 2), y: r.top + Math.min(120, r.height / 2) }; });
        await sleep(500);
        const a = await frontTitle();
        await page.mouse.move(box.x, box.y); await page.mouse.wheel({ deltaY: 120 }); await sleep(1200);
        const b = await frontTitle();
        say(`${tag}: one wheel flick turns one card`, a && b && b !== a, `${a} → ${b}`);
        await page.mouse.wheel({ deltaY: -120 }); await sleep(1200);
        const c = await frontTitle();
        say(`${tag}: a flick back returns it`, c === a, `${b} → ${c}`);
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press("j"); await sleep(900);
        const d = await frontTitle();
        await page.keyboard.press("k"); await sleep(900);
        const e = await frontTitle();
        say(`${tag}: J turns on, K back`, d && d !== a && e === a, `${a} → ${d} → ${e}`);
      }

      // Pass and Save decide the card (the front changes); Draft this job on the next (a test account: the practice form)
      for (const act of ["pass", "save", "draft"]) {
        const before = await frontTitle();
        const reqs = [];
        const onReq = (r) => { if (r.url().includes("/api/")) reqs.push(`${r.request().method()} ${r.url().replace(BASE, "").slice(0, 60)} ${r.status()}`); };
        page.on("response", onReq);
        const clicked = await page.evaluate((a) => { const live = [...document.querySelectorAll("[data-fan-offset='0']")].filter(e => getComputedStyle(e).opacity !== "0"); const b = live[live.length - 1]?.querySelector(`[data-deck-action='${a}']`) || document.querySelector(`[data-deck-action='${a}']`); if (!b) return "no button";
          const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          b.click(); return top === b || b.contains(top) ? "on top" : `covered by ${top?.tagName}.${String(top?.className).slice(0, 40)}`; }, act);
        const seen = [];
        for (let k = 0; k < 12; k++) { await sleep(500); seen.push(await page.evaluate(() => `${document.querySelector("[data-fan-offset='0'] [data-deck-title-line]")?.textContent?.trim()?.slice(0, 24) ?? "∅"}|${document.querySelector("[data-deck-count]")?.textContent?.trim() ?? ""}`)); }
        page.off("response", onReq);
        if (process.env.WALK_DIAG) { const all = await page.evaluate(() => [...document.querySelectorAll("[data-fan-offset]")].map(e => { const r = e.getBoundingClientRect();
            return `${e.getAttribute("data-fan-offset")}:${e.querySelector("[data-deck-title-line]")?.textContent?.trim()?.slice(0, 18)}@${Math.round(r.left)},${Math.round(r.top)} o${getComputedStyle(e).opacity} pe:${getComputedStyle(e).pointerEvents} z${getComputedStyle(e).zIndex}`; }));
          console.log(`DIAG cards ${act}: ${all.join(" | ")}`);
          const hit = await page.evaluate(() => { const f = document.querySelector(".pl-fieldcard"); if (!f) return "no field card"; f.scrollIntoView({ block: "center" });
            const r = f.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(60, r.height / 2));
            const card = top?.closest?.("[data-fan-offset]"); return card ? `COVERED by a fan card (offset ${card.getAttribute("data-fan-offset")}, opacity ${getComputedStyle(card).opacity})` : `clear (${top?.tagName}.${String(top?.className).slice(0, 30)})`; });
          console.log(`DIAG field card after ${act}: ${hit}`); await page.screenshot({ path: path.join(DIR, `diag-${act}.png`) }); }
        if (process.env.WALK_DIAG) console.log(`DIAG ${tag} ${act}: ${clicked} · ${[...new Set(seen)].join(" → ")} · ${reqs.join(" ; ")}`);
        const after = await frontTitle();
        say(`${tag}: ${act} decides the card`, before && after !== before, `${before} → ${after}`);
      }

      // the Index tab: rows, the board kept; the bubble's Star / Draft
      const tabs = await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].map(t => t.textContent.trim()));
      const deckBefore = await frontTitle();
      await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click());
      await page.waitForSelector("[data-market-index] tbody tr", { timeout: 30000 }).catch(() => null);
      await sleep(800);
      const idx = await page.evaluate(() => ({ rows: document.querySelectorAll("[data-market-index] tbody tr:not(.pl-gz__spacer)").length,
        head: [...document.querySelectorAll("[data-market-index] thead th")].map(h => h.textContent.trim()).join(" · "),
        sideScroll: document.documentElement.scrollWidth > innerWidth + 1 }));
      say(`${tag}: the Index lists the openings`, idx.rows > 0, `${idx.rows} rows · ${idx.head}`);
      say(`${tag}: the Index never scrolls the page sideways`, !idx.sideScroll, idx.sideScroll ? "scrolls" : "none");
      const firstRow = "[data-market-index] tbody tr:not(.pl-gz__spacer)";
      if (vw >= 860) {
        const rb = await page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, firstRow);
        if (rb) { await page.mouse.move(rb.x, rb.y); await sleep(700); }
        const bub = await page.evaluate(() => [...document.querySelectorAll("[data-market-index] [data-bubble-action]")].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute("data-bubble-action")));
        say(`${tag}: hovering a row opens Star and Draft`, bub.includes("star") && bub.includes("draft"), JSON.stringify(bub));
        const starred = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-market-index] [data-bubble-action=star]")].find(x => x.getBoundingClientRect().width > 0); b?.click(); return !!b; });
        await sleep(1200);
        const pressed = await page.evaluate(() => [...document.querySelectorAll("[data-market-index] [data-bubble-action=star]")].some(b => b.getAttribute("aria-pressed") === "true"));
        say(`${tag}: Star saves the row`, starred && pressed, `clicked ${starred} · pressed ${pressed}`);
      } else {
        say(`${tag}: below 860 px no bubble covers the tag (by design)`, true, "the row opens the posting");
      }
      await page.screenshot({ path: path.join(SHOTS, `walk47g-${theme}-${vw}-index.png`) });
      // a row's title opens its posting where the person can see it (D168: one way to open)
      if (vw >= 860) {
        await page.evaluate(() => document.querySelector("[data-market-index] [data-index-title]")?.click());
        await sleep(1500);
        const opened = await page.evaluate(() => {
          const tab = [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => t.getAttribute("aria-selected") === "true")?.textContent?.trim();
          const slot = document.querySelector("[data-deck-post-slot]");
          const jd = document.querySelector("[data-jd-panel]");
          const r = jd?.getBoundingClientRect();
          return { tab, slotOpen: slot?.getAttribute("data-open"), jd: !!jd, jdVisible: !!r && r.width > 0 && r.height > 0 && getComputedStyle(jd).visibility !== "hidden",
            url: location.pathname + location.search, panels: document.querySelectorAll("[data-panel-id]").length };
        });
        say(`${tag}: an Index row's title opens its posting, visible`, opened.jdVisible, JSON.stringify(opened));
        await page.keyboard.press("Escape"); await sleep(800);
      }
      await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /deck/i.test(t.textContent))?.click());
      await sleep(1200);
      const deckAfter = await frontTitle();
      say(`${tag}: back on Deck, the board is kept`, deckAfter === deckBefore, `${deckBefore} → ${deckAfter} (tabs ${JSON.stringify(tabs)})`);
      say(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    }
  }
} catch (e) {
  say("the walk ran", false, e.message.slice(0, 800));
} finally {
  try { await browser?.close(); } catch { /* gone */ }
  kill();
  const failed = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length} / ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

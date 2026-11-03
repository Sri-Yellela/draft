#!/usr/bin/env node
// ⭐ D146 · THE ONE APPLICATION TRACKER, WALKED — in a real Chrome against a LOCAL draft on a THROWAWAY copy of the
// database (never production). Boot first:
//   COOKIE_ENCRYPTION_KEY=<random> RM_DATA_DIR=<temp dir holding a COPY of data/resume_master.db> PORT=3962 DRAFT_TRIAL=on node server.js
// then:
//   node scripts/d146TrackerShots.mjs [--base http://localhost:3962] [--out docs/d146-shots]
// A SYNTHETIC account is made and given past applications through the app's own CSV import (sent · interviewing ·
// rejected · no reply · screen), then /app/auto-apply is walked at 1280 × 800 and 390 × 844 in Dusk Dark and Paper Light:
//   · ONE navigation entry for applications; /app/database lands on the tracker
//   · the header: Import · Export · Send all ready (n) · Settings · the mode switch; ONE row of counts; the filters
//   · the columns Position · Résumé · Answers · Status · When; a header press sorts and a second press flips it
//   · the status is a dot + a word (no capsule: no radius ≥ half its height on the status)
//   · a row opens IN PLACE under itself, one at a time; Escape / Close folds it; its panes show one at a time
//   · desktop: the timeline card beside the table (≈ 300 px); phone: the Applications · Auto-apply timeline switch
//   · no horizontal scroll
// Screenshots go to --out (untracked).
import fs from "node:fs";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3962");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = arg("--out", "docs/d146-shots");
fs.mkdirSync(OUT, { recursive: true });

const RUNS = [[1280, 800, "dusk-dark"], [1280, 800, "paper-light"], [390, 844, "dusk-dark"], [390, 844, "paper-light"]];
const CSV = [
  "Company,Title,Applied,Outcome",
  "Northwind Labs,Software Engineer,2026-10-20,interviewing",
  "Contoso Data,Data Analyst,2026-10-18,rejected",
  "Fabrikam Systems,Backend Engineer,2026-10-25,no response",
  "Tailspin Toys,Product Analyst,2026-10-28,screen",
  "Woodgrove Health,Business Analyst,2026-11-01,",
].join("\n");
const MAPPING = { company: "Company", title: "Title", applied: "Applied", outcome: "Outcome" };

let failed = 0;
const check = (where, name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${where} · ${name}${detail ? ` — ${detail}` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launchBrowser({ headless: true });
try {
  for (const [w, h, theme] of RUNS) {
    const where = `${w}-${theme}`;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((v) => { try { localStorage.setItem("draft-theme", v); } catch {} }, theme);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const user = `d146${Date.now().toString(36)}`;
    const seeded = await page.evaluate(async (u, csv, mapping) => {
      const post = async (p, body) => {
        const res = await fetch(p, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json",
          ...(sessionStorage.getItem("rm_auth_context") ? { Authorization: `Bearer ${sessionStorage.getItem("rm_auth_context")}` } : {}) }, body: JSON.stringify(body) });
        return { status: res.status, j: await res.json().catch(() => ({})) };
      };
      const r = await post("/api/auth/register", { username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } });
      if (r.j.authContext) sessionStorage.setItem("rm_auth_context", r.j.authContext);
      const imp = await post("/api/applications/import", { csv, mapping, apply: true });
      return { reg: r.status, imp: imp.status, imported: imp.j.imported ?? imp.j.applied ?? null, err: imp.j.error || null };
    }, user, CSV, MAPPING);
    check(where, "synthetic sign-up + CSV import", seeded.reg === 200 && seeded.imp === 200, JSON.stringify(seeded));

    // /app/database lands on the one tracker.
    await page.goto(`${BASE}/app/database`, { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-tracker-table]", { timeout: 30000 }).catch(() => {});
    check(where, "/app/database redirects to the tracker", page.url().includes("/app/auto-apply") && !!(await page.$("[data-tracker-table]")), page.url());
    await wait(800);
    await page.screenshot({ path: `${OUT}/${where}-1-table.png`, fullPage: false });

    const s = await page.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const rows = [...document.querySelectorAll("[data-tracker-table] tbody tr.trk-row")];
      const cols = [...document.querySelectorAll("[data-tracker-table] thead th")].map(th => th.getAttribute("data-col"));
      const visibleCols = [...document.querySelectorAll("[data-tracker-table] thead th")].filter(th => th.offsetParent !== null && getComputedStyle(th).display !== "none").map(th => th.getAttribute("data-col"));
      const st = q("[data-tracker-table] .trk-status");
      const dot = q("[data-tracker-table] .trk-dot");
      const tl = q("[data-timeline]");
      const tableBox = q("[data-tracker-table]")?.getBoundingClientRect();
      const tlBox = tl?.getBoundingClientRect();
      const navText = [...document.querySelectorAll("[data-nav-item]")].map(a => a.innerText.replace(/\s+/g, " ").trim()).filter(Boolean);
      return {
        rows: rows.length, cols, visibleCols,
        counts: !!q("[data-tracker-counts]"), filters: document.querySelectorAll("[data-filter]").length,
        importBtn: !!q("[data-import-open]"), exportBtn: !!q("[data-export-open]"), sendAll: !!q("[data-send-all-ready]"),
        statusRadius: st ? parseFloat(getComputedStyle(st).borderTopLeftRadius) : null, statusH: st?.getBoundingClientRect().height ?? null,
        dotRound: dot ? getComputedStyle(dot).borderTopLeftRadius : null,
        timelineShown: !!tl && tl.offsetParent !== null, tlWidth: tlBox ? Math.round(tlBox.width) : null,
        beside: !!(tableBox && tlBox && tlBox.left >= tableBox.right - 2),
        phoneSwitch: (() => { const b = q('[data-phone-view="timeline"]'); return !!b && b.offsetParent !== null; })(),
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        tableWord: /The Table/.test(navText.join(" | ")), navText: navText.slice(0, 12),
      };
    });
    check(where, "the imported rows are in the table", s.rows >= 5, `${s.rows} rows`);
    check(where, "the columns: Position · Résumé · Answers · Status · When", JSON.stringify(s.cols) === JSON.stringify(["position", "resume", "answers", "status", "when"]), JSON.stringify(s.cols));
    check(where, "one row of counts + the filters", s.counts && s.filters >= 6, `${s.filters} filters`);
    check(where, "the header: Import · Export · Send all ready", s.importBtn && s.exportBtn && s.sendAll);
    check(where, "the status is a dot + a word, never a capsule", s.statusRadius != null && !(s.statusH && s.statusRadius >= s.statusH / 2 - 0.5), `radius ${s.statusRadius} / height ${s.statusH}`);
    check(where, "no The Table entry in the navigation", !s.tableWord, s.navText.join(" | "));
    check(where, "no horizontal scroll", !s.hscroll);
    if (w >= 900) {
      check(where, "desktop: the timeline card beside the table, ≈ 300 px", s.timelineShown && s.beside && Math.abs(s.tlWidth - 300) <= 24, `width ${s.tlWidth}, beside ${s.beside}`);
      check(where, "desktop: no phone switch", !s.phoneSwitch);
    } else {
      check(where, "phone: the Applications · Auto-apply timeline switch", s.phoneSwitch);
      check(where, "phone: two columns", JSON.stringify(s.visibleCols) === JSON.stringify(["position", "status"]), JSON.stringify(s.visibleCols));
    }

    // Sort: a header press sorts by it, a second press flips it.
    const order = () => page.evaluate(() => [...document.querySelectorAll("[data-tracker-table] tbody tr.trk-row")].map(r => r.getAttribute("data-row")));
    const before = await order();
    await page.evaluate(() => document.querySelector('[data-sort="position"]')?.click()); await wait(200);
    const byPos = await order();
    await page.evaluate(() => document.querySelector('[data-sort="position"]')?.click()); await wait(200);
    const flipped = await order();
    check(where, "a header sorts, a second press flips it", byPos.length >= 2 && JSON.stringify(flipped) === JSON.stringify([...byPos].reverse()) && (JSON.stringify(byPos) !== JSON.stringify(before) || JSON.stringify(flipped) !== JSON.stringify(before)));

    // A row opens in place, under itself; another closes it; Escape folds it.
    const keys = await order();
    await page.evaluate((k) => document.querySelector(`[data-row="${CSS.escape(k)}"]`)?.click(), keys[0]); await wait(300);
    const open1 = await page.evaluate((k) => {
      const row = document.querySelector(`[data-row="${CSS.escape(k)}"]`);
      const det = document.querySelectorAll("[data-row-detail]");
      return { n: det.length, under: row?.nextElementSibling?.getAttribute("data-row-open") === k, url: location.pathname };
    }, keys[0]);
    check(where, "a row opens in place, under itself", open1.n === 1 && open1.under && open1.url === "/app/auto-apply", JSON.stringify(open1));
    await page.screenshot({ path: `${OUT}/${where}-2-row-open.png`, fullPage: false });
    const panes = await page.evaluate(() => [...document.querySelectorAll("[data-row-detail] [data-pane]")].map(b => b.getAttribute("data-pane")));
    check(where, "the row's panes are on demand", panes.length >= 1, JSON.stringify(panes));
    let shownOne = true;
    for (const id of panes) {
      await page.evaluate((p) => document.querySelector(`[data-row-detail] [data-pane="${p}"]`)?.click(), id); await wait(400);
      const bodies = await page.evaluate(() => [...document.querySelectorAll("[data-row-detail] [data-pane-body]")].map(b => b.getAttribute("data-pane-body")));
      if (!(bodies.length === 1 && bodies[0] === id)) shownOne = false;
    }
    check(where, "each pane shows alone, inside the row", shownOne);
    await page.screenshot({ path: `${OUT}/${where}-3-pane.png`, fullPage: false });
    await page.evaluate((k) => document.querySelector(`[data-row="${CSS.escape(k)}"]`)?.click(), keys[1]); await wait(300);
    const open2 = await page.evaluate(() => [...document.querySelectorAll("[data-row-detail]")].map(d => d.getAttribute("data-row-detail")));
    check(where, "another row closes the first", open2.length === 1 && open2[0] === keys[1], JSON.stringify(open2));
    await page.keyboard.press("Escape"); await wait(300);
    check(where, "Escape folds it", (await page.$$("[data-row-detail]")).length === 0);

    if (w < 900) {
      await page.evaluate(() => document.querySelector('[data-phone-view="timeline"]')?.click()); await wait(400);
      const ph = await page.evaluate(() => ({ tl: (document.querySelector("[data-timeline]")?.offsetParent ?? null) !== null, table: (document.querySelector("[data-tracker-table]")?.offsetParent ?? null) !== null }));
      check(where, "phone: the switch shows the timeline instead of the table", ph.tl && !ph.table, JSON.stringify(ph));
      await page.screenshot({ path: `${OUT}/${where}-4-timeline.png`, fullPage: false });
    }
    check(where, "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);

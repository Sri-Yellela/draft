#!/usr/bin/env node
// ⭐ D165 (5) · THE HELD APPLICATION, WALKED IN A REAL CHROME AGAINST THE SKETCH (docs/sketches/held-application-sketch.html)
// — a LOCAL draft on a THROWAWAY copy of the database (never production). Boot first:
//   COOKIE_ENCRYPTION_KEY=<random> RM_DATA_DIR=<temp dir holding a COPY of data/resume_master.db> ANTHROPIC_KEY= PORT=3965 node server.js
// then:
//   node scripts/d165HeldShots.mjs --db <that copy>/resume_master.db [--base http://localhost:3965] [--out docs/d165-shots]
// A SYNTHETIC account is made; one synthetic posting (an engineering role in Boston) is given a held application whose
// one open question is the salary, plus an earlier attempt that stopped before the résumé. Then /app/auto-apply is opened
// at 1280 × 800 and 390 × 844, the held row is opened, and the sketch is shot at the same size. Checks:
//   · the headline is the question; the lead says draft never makes up salary answers
//   · the keep-it label names the scope: "Use this for similar jobs (engineering, US) next time"
//   · the order: question → buttons → steps → panes → the earlier attempt (one quiet line, its detail closed)
//   · no modal, no horizontal scroll
// Screenshots go to --out (untracked).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3965");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const DB = arg("--db", null);
if (!DB || path.resolve(DB).startsWith(path.resolve("data"))) { console.error("REFUSING: --db must be a throwaway COPY outside data/"); process.exit(2); }
const OUT = arg("--out", "docs/d165-shots");
fs.mkdirSync(OUT, { recursive: true });
const SKETCH = pathToFileURL(path.resolve("docs/sketches/held-application-sketch.html")).href;

let failed = 0;
const check = (where, name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${where} · ${name}${detail ? ` — ${detail}` : ""}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seed(username) {
  const db = new Database(DB);
  try {
    const user = db.prepare("SELECT id FROM users WHERE username=?").get(username);
    if (!user) throw new Error(`no user ${username}`);
    const jobId = `d165walk-${username}`;
    db.prepare(`INSERT OR IGNORE INTO scraped_jobs (job_id, search_query, _hash, title, company, location, url, apply_url, source, is_active)
                VALUES (?, 'walk', ?, 'Full-stack Engineer', 'Acme Rails', 'Boston, MA', 'https://example.com/acme/1', 'https://example.com/acme/1', 'greenhouse', 1)`).run(jobId, jobId);
    db.prepare("INSERT OR IGNORE INTO job_role_map (job_id, role_key, matched_by) VALUES (?, 'engineering', 'walk')").run(jobId);
    const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs) VALUES (?, 'auto', 'completed', 1)").run(user.id).lastInsertRowid;
    const now = Math.floor(Date.now() / 1000);
    // The earlier attempt: held, stopped before the résumé was made (as Prophetic's 11-06 attempt was). ⚠ A FAILED
    // earlier attempt is not part of a held application — /api/apply/review reads held_review rows only.
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, reason_detail, created_at, finished_at)
                VALUES (?, ?, ?, 'held_review', 'resume_unavailable', 'The résumé step didn''t run, so the form was left with 2 empty fields.', ?, ?)`)
      .run(run, user.id, jobId, now - 3600, now - 3598);
    const run2 = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs) VALUES (?, 'auto', 'completed', 1)").run(user.id).lastInsertRowid;
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, open_questions_json, answers_json, created_at)
                VALUES (?, ?, ?, 'held_review', 'incomplete_form', ?, ?, ?)`)
      .run(run2, user.id, jobId, JSON.stringify([{ question: "Salary expectation (US$ a year)", type: "text", reason: "missing" }]),
        JSON.stringify([{ label: "First name", value: "Shot", provenance: "field_map_exact" }]), now - 60);
    return jobId;
  } finally { db.close(); }
}

const browser = await launchBrowser({ headless: true });
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const where = `${w}`;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
    const user = `d165${Date.now().toString(36)}`;
    const reg = await page.evaluate(async (u) => {
      const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } }) });
      const j = await res.json().catch(() => ({}));
      if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
      return res.status;
    }, user);
    check(where, "synthetic sign-up", reg === 200, String(reg));
    let jobId = null;
    try { jobId = seed(user); check(where, "seeded one held application + an earlier attempt", true); }
    catch (e) { check(where, "seed", false, e.message); continue; }

    await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-tracker-table] tr.trk-row", { timeout: 30000 }).catch(() => {});
    await wait(800);
    const opened = await page.evaluate(() => {
      const row = [...document.querySelectorAll("[data-tracker-table] tr.trk-row")].find(r => /Acme Rails/.test(r.innerText));
      if (!row) return false;
      row.click();
      return true;
    });
    check(where, "the held row is in the tracker", opened);
    await page.waitForSelector("[data-row-detail]", { timeout: 10000 }).catch(() => {});
    await wait(500);
    await page.evaluate(() => document.querySelector("[data-row-detail]")?.scrollIntoView({ block: "start" }));
    await wait(200);
    await page.screenshot({ path: `${OUT}/${where}-app-held.png`, fullPage: false });

    const s = await page.evaluate(() => {
      const d = document.querySelector("[data-row-detail]");
      if (!d) return null;
      const y = (sel) => { const el = d.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; };
      return {
        headline: d.querySelector("[data-row-headline]")?.innerText || "",
        lead: d.querySelector("[data-held-lead]")?.innerText || "",
        label: d.querySelector("[data-save-for-next-time]")?.innerText.trim() || "",
        order: { ask: y("[data-inline-question]"), acts: y("[data-row-actions]"), steps: y("[data-run-steps]"), panes: y(".trk-o__panes"), earlier: y("[data-earlier-attempts]") },
        earlierDetailOpen: !!d.querySelector("[data-earlier-detail]"),
        modal: [...document.querySelectorAll("[role=dialog][aria-modal=true]")].filter(m => { const r = m.getBoundingClientRect(), cs = getComputedStyle(m); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0; }).map(m => (m.getAttribute("aria-label") || m.className || "dialog") + ": " + m.innerText.slice(0, 80).replace(/\s+/g, " ")),
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    check(where, "the row opened in place", !!s);
    if (s) {
      check(where, "the headline is the question", /Salary expectation/.test(s.headline), s.headline);
      check(where, "the lead: draft never makes up salary answers", /never makes up salary/.test(s.lead), s.lead);
      check(where, "the label names the scope", s.label === "Use this for similar jobs (engineering, US) next time", s.label);
      const o = s.order, seq = [o.ask, o.acts, o.steps, o.panes, o.earlier];
      check(where, "question → buttons → steps → panes → earlier", seq.every(v => v != null) && seq.every((v, i) => i === 0 || v >= seq[i - 1]), JSON.stringify(o));
      check(where, "the earlier attempt is one quiet line, its detail closed", o.earlier != null && !s.earlierDetailOpen);
      check(where, "no modal", s.modal.length === 0, s.modal.join(" | "));
      check(where, "no horizontal scroll", !s.hscroll);
    }
    check(where, "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

    // The sketch at the same size, in its default (needs) state.
    const sk = await ctx.newPage();
    await sk.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await sk.goto(SKETCH, { waitUntil: "load" });
    await wait(300);
    await sk.screenshot({ path: `${OUT}/${where}-sketch-needs.png`, fullPage: false });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);

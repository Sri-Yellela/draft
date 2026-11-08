#!/usr/bin/env node
// scripts/d140TheirStackTrial.mjs — ⭐ D140 P1 (45n, owner 11-08 decision (9): "yes to the trial only") · THE FEED TRIAL.
//
// ⛔ TRIAL ONLY: the free / trial tier, never a paid plan or a card without the owner's separate yes. TheirStack bills in
// CREDITS (≈ 1 per job returned); this script ASKS for at most --max-jobs jobs in total (default 100), PRINTS THE ESTIMATE
// FIRST, and spends nothing without --go. Nothing is written to draft's board: the trial READS our database (read-only)
// to compare, and writes its report to tmp/d140-trial-<date>.json + prints a summary.
//
// What it reports (the owner's "the trial reports what it adds"):
//   · new postings   — TheirStack jobs whose apply URL / (company, title) is NOT on our open board
//   · overlap        — the share already on our board (by URL, then by company + title)
//   · by category    — which of the queried role families each adds most to
//   · licence terms  — ⚠ read by hand from the account's own terms page (the public site renders with script); the report
//                      carries D140 P0's reading and a line to confirm it
//
// Usage:  THEIRSTACK_API_KEY=… node scripts/d140TheirStackTrial.mjs [--max-jobs 100] [--days 14] [--go]
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GO = process.argv.includes("--go");
const MAX = Math.max(1, Math.min(500, Number(arg("--max-jobs", 100)) || 100));
const DAYS = Math.max(1, Math.min(60, Number(arg("--days", 14)) || 14));
const KEY = (process.env.THEIRSTACK_API_KEY || "").trim();
const URL_ = "https://api.theirstack.com/v1/jobs/search";
// The board is computer science only (D78 B) — the trial asks for the same families, split evenly.
const QUERIES = ["software engineer", "data engineer", "machine learning engineer", "devops engineer", "security engineer"];
const PER = Math.max(1, Math.floor(MAX / QUERIES.length));

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const urlKey = (u) => { try { const x = new URL(u); return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase(); } catch { return ""; } };

console.log(`D140 trial — ${QUERIES.length} queries × ${PER} jobs, posted in the last ${DAYS} days, US.`);
console.log(`ESTIMATE: at most ${PER * QUERIES.length} jobs ≈ ${PER * QUERIES.length} TheirStack credits (free tier only — check the account's balance first).`);
if (!KEY) { console.log("⏸ THEIRSTACK_API_KEY is not set — the owner signs up for the free tier and puts the key in .env (owner list B)."); process.exit(0); }
if (!GO) { console.log("Nothing spent. Re-run with --go to make the calls."); process.exit(0); }

const dataDir = process.env.RM_DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(dataDir, "resume_master.db"), { readonly: true, fileMustExist: true });
const ours = { urls: new Set(), pairs: new Set() };
for (const r of db.prepare(`SELECT company, title, apply_url, url FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL`).iterate()) {
  for (const u of [r.apply_url, r.url]) { const k = urlKey(u); if (k) ours.urls.add(k); }
  ours.pairs.add(`${norm(r.company)}|${norm(r.title)}`);
}
db.close();
console.log(`Our open board: ${ours.pairs.size.toLocaleString()} (company, title) pairs, ${ours.urls.size.toLocaleString()} URLs.`);

const out = { at: new Date().toISOString(), days: DAYS, asked: PER * QUERIES.length, byQuery: {}, jobs: 0, newJobs: 0, byUrl: 0, byPair: 0, sample: [] };
for (const q of QUERIES) {
  let jobs = [];
  try {
    const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: PER, page: 0, job_title_or: [q], job_country_code_or: ["US"], posted_at_max_age_days: DAYS }) });
    if (!r.ok) { console.log(`  ${q}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); out.byQuery[q] = { error: r.status }; continue; }
    const body = await r.json();
    jobs = body?.data || body?.jobs || [];
  } catch (e) { console.log(`  ${q}: ${e.message}`); out.byQuery[q] = { error: e.message }; continue; }
  let fresh = 0;
  for (const j of jobs) {
    const company = j.company_object?.name || j.company_name || j.company || "";
    const title = j.job_title || j.title || "";
    const url = j.final_url || j.url || "";
    const hitUrl = ours.urls.has(urlKey(url)), hitPair = ours.pairs.has(`${norm(company)}|${norm(title)}`);
    if (hitUrl) out.byUrl++; else if (hitPair) out.byPair++; else { fresh++; if (out.sample.length < 25) out.sample.push({ q, company, title, url }); }
  }
  out.jobs += jobs.length; out.newJobs += fresh;
  out.byQuery[q] = { returned: jobs.length, new: fresh };
  console.log(`  ${q}: ${jobs.length} returned, ${fresh} not on our board`);
}
out.overlap = out.jobs ? Math.round(((out.byUrl + out.byPair) / out.jobs) * 100) : null;
out.licence = "D140 P0 (11-02): TheirStack is the only candidate whose public licence allows showing postings, derived stats and public job pages — ⚠ CONFIRM on the account's own terms page before any of its rows reach a user (the public site renders its terms with script).";
fs.mkdirSync("tmp", { recursive: true });
const file = path.join("tmp", `d140-trial-${out.at.slice(0, 10)}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`\n${out.jobs} jobs read · ${out.newJobs} new to us · overlap ${out.overlap ?? "—"}% (URL ${out.byUrl}, company + title ${out.byPair}). Report: ${file}`);
console.log(out.licence);

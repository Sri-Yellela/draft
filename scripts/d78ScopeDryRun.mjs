#!/usr/bin/env node
// D78 B · THE COMPUTER-SCIENCE SCOPE, AS A DRY RUN — what services/jobs/csScope.js WOULD drop, before
// anyone applies it. READ-ONLY: it opens a database readonly or reads a JSON file, and prints counts.
//
//   node scripts/d78ScopeDryRun.mjs --fetch data/d74-fetch.json      the frozen live fetch (D74 P1)
//   node scripts/d78ScopeDryRun.mjs --db data/jobs.db                active scraped_jobs + job_role_map
//   add --json for the raw report object instead of the summary
//
// --fetch: [{ source, id, title, company, url, description }] classified the crawl's way
// (classifyJob; a blue-collar verdict counts as roleKey null). --db: each active row's classifier
// role_key from job_role_map (a profile-scrape row only when no classifier row exists); a row with
// no role_key at all is re-classified with classifyJob. Prints totals, OUT by reason, by family,
// the top 20 companies, and a deterministic sample of 60 OUT and 30 IN titles for a person to judge.
// No posting text other than titles is printed.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { classifyJob } from "../services/jobs/classifyJob.js";
import { csScopeOf, scopeReport, CS_SCOPE_VERSION } from "../services/jobs/csScope.js";

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const classify = (title, description, company) => {
  const v = classifyJob(title || "", description || "", company || "");
  return v.collar === "blue" ? null : v.roleKey;
};

let rows;
if (flag("fetch")) {
  const fetched = JSON.parse(fs.readFileSync(flag("fetch"), "utf8"));
  rows = fetched.map(j => ({ id: `${j.source}:${j.id}`, title: j.title, company: j.company,
    roleKey: classify(j.title, j.description, j.company) }));
} else if (flag("db")) {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(flag("db"), { readonly: true, fileMustExist: true });
  const found = db.prepare(`
    SELECT sj.job_id AS id, sj.title, sj.company, sj.description,
      (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id
        ORDER BY (m.source_profile_id IS NULL) DESC, m.created_at ASC LIMIT 1) AS roleKey
    FROM scraped_jobs sj WHERE sj.is_active = 1`).all();
  db.close();
  rows = found.map(r => ({ id: r.id, title: r.title, company: r.company,
    roleKey: r.roleKey ?? classify(r.title, r.description, r.company) }));
} else {
  console.error("usage: --fetch <json> | --db <sqlite path> [--json]");
  process.exit(2);
}

const report = scopeReport(rows);
if (argv.includes("--json")) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }

// Deterministic sample: order by a hash of the id, so the same input always shows the same titles.
const hash = (s) => createHash("sha1").update(String(s)).digest("hex");
const judged = rows.map(r => ({ ...r, ...csScopeOf(r), h: hash(r.id) })).sort((a, b) => a.h < b.h ? -1 : 1);
const sample = (inScope, n) => judged.filter(r => r.inScope === inScope).slice(0, n);
const pct = (n) => `${(100 * n / Math.max(report.total, 1)).toFixed(1)}%`;
const sorted = (o, by) => Object.entries(o).sort((a, b) => by(b[1]) - by(a[1]));

console.log(`D78 B dry run · csScope v${CS_SCOPE_VERSION} · ${flag("fetch") ? `fetch ${flag("fetch")}` : `db ${flag("db")}`}`);
console.log(`total ${report.total} · IN ${report.in} (${pct(report.in)}) · OUT ${report.out} (${pct(report.out)})`);
console.log(`\n── by reason`);
for (const [k, n] of sorted(report.byReason, n => n)) console.log(`  ${String(n).padStart(5)}  ${k}`);
console.log(`\n── by family (in / out)`);
for (const [k, v] of sorted(report.byFamily, v => v.in + v.out)) console.log(`  ${String(v.in).padStart(5)} / ${String(v.out).padEnd(5)} ${k}`);
console.log(`\n── top 20 companies (in / out)`);
for (const [k, v] of sorted(report.byCompany, v => v.in + v.out).slice(0, 20)) console.log(`  ${String(v.in).padStart(5)} / ${String(v.out).padEnd(5)} ${k}`);
console.log(`\n── sample: 60 OUT (reason | family | company | title)`);
for (const r of sample(false, 60)) console.log(`  ${r.reason} | ${r.roleKey ?? "-"} | ${r.company} | ${r.title}`);
console.log(`\n── sample: 30 IN`);
for (const r of sample(true, 30)) console.log(`  ${r.reason} | ${r.roleKey ?? "-"} | ${r.company} | ${r.title}`);

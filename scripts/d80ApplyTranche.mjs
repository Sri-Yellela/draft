#!/usr/bin/env node
// ⛔ D80 · BUILD A TRANCHE FROM THE OWNER'S APPROVED LIST — never a hard-coded one.
//
//   node scripts/d80ApplyTranche.mjs --approved data/tranche2_hn_approved.json [--approved …]... --probe <probe.json>
//        [--source "hn who-is-hiring 2026-07..10"] [--min-recent 1] [--backfill <probe of configured companies.json>]
//        [--names <json: { "ats:slug": "Clean Name" }>] [--hold ats:slug,...] [--out <container module .mjs>]
// --names: the configured name is what every job card shows, and an HN header is not a name ("Remote (US) Close").
// --hold: approved, but held for a human look (e.g. a recruiter posting for a client) — never added.
//
// Local and READ-ONLY. It joins the approved list(s) with a probe (`scripts/d78TrancheProbe.mjs --json`), applies
// services/companyList.js admitFromProbe (approved · not a portfolio board / agency · live · in-scope postings
// within the age limit), prints the D80 D review table, and — with --out — writes the module the OWNER pipes into
// the container (`cat <out> | railway ssh -s draft -- "cd /app && node --input-type=module -"`). That module takes
// a backup, passes the D77 disk gate for the whole tranche, re-validates each board live, adds it WITH its evidence
// line, back-fills the evidence of already-configured companies that have none (--backfill), and runs one crawl.
// ⛔ A company that is not on an approved list never reaches the module. Production writes stay the owner's.
import fs from "node:fs";
import { admitFromProbe, evidenceLine } from "../services/companyList.js";

const argv = process.argv.slice(2);
const many = (k) => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : []));
const one = (k) => many(k)[0] ?? null;
const approvedFiles = many("approved");
if (!approvedFiles.length || !one("probe")) {
  console.error("usage: --approved <json>... --probe <probe.json> [--backfill <probe.json>] [--min-recent N] [--source s] [--out m.mjs]");
  process.exit(2);
}

/** The owner's approved list: [{ company, ats_type, ats_slug }] → a key set and a lookup. */
function loadApproved(files, read = (f) => fs.readFileSync(f, "utf8")) {
  const rows = files.flatMap((f) => JSON.parse(read(f)));
  const byKey = new Map(rows.map((r) => [`${r.ats_type}:${String(r.ats_slug).toLowerCase()}`, r]));
  return { keys: new Set(byKey.keys()), byKey };
}

const approved = loadApproved(approvedFiles);
const probe = JSON.parse(fs.readFileSync(one("probe"), "utf8"));
const minRecent = Number(one("min-recent") ?? 1);
const source = one("source") || "hn who-is-hiring (D80)";
const today = new Date().toISOString().slice(0, 10);
const names = one("names") ? JSON.parse(fs.readFileSync(one("names"), "utf8")) : {};
const hold = new Set(String(one("hold") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));

const judged = probe.map((row) => {
  const key = `${row.atsType}:${String(row.slug).toLowerCase()}`;
  const a = approved.byKey.get(key);
  const company = names[key] || a?.company || row.company;
  if (hold.has(key)) return { ...row, company, key, admit: false, reason: "held_for_review" };
  return { ...row, company, key, ...admitFromProbe({ ...row, company }, { approved: approved.keys, minRecent }) };
}).sort((x, y) => (y.cs ?? -1) - (x.cs ?? -1));
const unprobed = [...approved.keys].filter((k) => !judged.some((j) => j.key === k));

const pad = (s, n) => String(s ?? "—").padEnd(n);
console.log(`D80 review · ${approved.keys.size} approved · ${probe.length} probed · admit ≥ ${minRecent} in-scope ≤ 120d`);
console.log(`${pad("", 3)}${pad("company", 30)}${pad("board", 32)}${pad("recent", 8)}${pad("open", 6)}${pad("≤30d", 6)}${pad("≤120d", 7)}${pad("median", 8)}${pad("US", 6)}reason`);
for (const j of judged) {
  console.log(`${pad(j.admit ? "✓" : "✗", 3)}${pad(j.company.slice(0, 28), 30)}${pad(j.key.slice(0, 30), 32)}${pad(j.cs, 8)}${pad(j.csOpen, 6)}` +
    `${pad(j.pct30 == null ? "—" : j.pct30 + "%", 6)}${pad(j.pct120 == null ? "—" : j.pct120 + "%", 7)}${pad(j.medianAge == null ? "—" : j.medianAge + "d", 8)}${pad(j.usPct == null ? "—" : j.usPct + "%", 6)}${j.reason}`);
}
const admitted = judged.filter((j) => j.admit);
const why = judged.filter((j) => !j.admit).reduce((m, j) => ((m[j.reason] = (m[j.reason] || 0) + 1), m), {});
console.log(`\nADMIT ${admitted.length} (${admitted.reduce((s, j) => s + j.cs, 0)} in-scope postings ≤ 120d) · REFUSE ${judged.length - admitted.length} ${JSON.stringify(why)}` +
  (unprobed.length ? ` · ⚠ NOT PROBED ${unprobed.length}: ${unprobed.join(", ")}` : ""));

let backfill = [];
if (one("backfill")) {
  backfill = JSON.parse(fs.readFileSync(one("backfill"), "utf8")).filter((r) => r.state === "live")
    .map((r) => ({ atsType: r.atsType, slug: r.slug, evidence: evidenceLine(r, { source: "configured before D80 evidence (re-probed)", date: today }) }));
  const dormant = JSON.parse(fs.readFileSync(one("backfill"), "utf8")).filter((r) => r.state !== "live" || !(r.cs > 0));
  console.log(`\nBACKFILL evidence for ${backfill.length} configured companies · ⚠ PROPOSE DEACTIVATION (the owner decides, D80 E): ` +
    (dormant.map((r) => `${r.atsType}:${r.slug} (${r.state}${r.state === "live" ? `, ${r.cs} recent` : ""})`).join(", ") || "none"));
}

if (one("out")) {
  const T = admitted.map((j) => ({ atsType: j.atsType, slug: j.slug, company: j.company, evidence: evidenceLine(j, { source, date: today }) }));
  const module = `// D80 — generated by scripts/d80ApplyTranche.mjs ${new Date().toISOString()} from ${approvedFiles.join(", ")}.
// ⛔ Only owner-approved, probe-admitted companies are in T. Backup → disk gate → each board live → add with evidence → crawl.
import path from "node:path";
import Database from "/app/node_modules/better-sqlite3/lib/index.js";
const { createBackup } = await import("/app/scripts/backup.js");
const { validateBoard, addCompany } = await import("/app/services/companyList.js");
const { trancheGate } = await import("/app/services/diskGauge.js");
const { cacheJobs } = await import("/app/services/jobs/aggregator.js");
const dataDir = process.env.RM_DATA_DIR || "/app/data";
const db = new Database(path.join(dataDir, "resume_master.db"));
db.pragma("busy_timeout = 15000");
const T = ${JSON.stringify(T)};
const BACKFILL = ${JSON.stringify(backfill)};
const out = { backup: createBackup("pre-d80-tranche").filename, added: [], refused: [] };
const activeBefore = db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
const gate = trancheGate(db, dataDir, { companies: T.length });
out.gate = { ok: gate.ok, usedPct: gate.usedPct, projectedPct: gate.projectedPct, reason: gate.reason };
if (gate.ok) {
  for (let i = 0; i < T.length; i += 5) {
    const vs = await Promise.all(T.slice(i, i + 5).map((t) => validateBoard({ atsType: t.atsType, slug: t.slug, company: t.company }).then((v) => [t, v])));
    for (const [t, v] of vs) {
      if (!v.ok || v.state !== "live") { out.refused.push(t.slug + ":" + v.state); continue; }
      const r = addCompany(db, { company: t.company, atsType: t.atsType, slug: t.slug, adminUserId: null, evidence: t.evidence });
      if (r.ok) out.added.push(t.slug); else out.refused.push(t.slug + ":" + r.code);
    }
  }
  const upd = db.prepare("UPDATE company_ats_list SET evidence = ? WHERE ats_type = ? AND lower(ats_slug) = lower(?) AND evidence IS NULL");
  out.evidenceBackfilled = db.transaction(() => BACKFILL.reduce((n, b) => n + upd.run(b.evidence, b.atsType, b.slug).changes, 0))();
  const t0 = Math.floor(Date.now() / 1000);
  out.crawlReturned = await cacheJobs(db, null);
}
out.activeBefore = activeBefore;
out.activeAfter = db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
out.companiesActive = db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE active = 1").pluck().get();
out.withoutEvidence = db.prepare("SELECT ats_type || ':' || ats_slug FROM company_ats_list WHERE active = 1 AND evidence IS NULL").pluck().all();
db.close();
console.log(JSON.stringify(out, null, 1));
`;
  fs.writeFileSync(one("out"), module);
  console.log(`\nwrote ${one("out")} — ${T.length} companies, ${backfill.length} evidence back-fills`);
}

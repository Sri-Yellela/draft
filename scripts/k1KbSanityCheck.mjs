#!/usr/bin/env node
/**
 * K1 — the KB sanity check, run ON ITS OWN (RECRUITER_LAYER_EXECUTION.md §K1).
 *
 * ⛔ DECOUPLED BY DECISION (OWNER 30, 09-30). This script is how K1 runs. Nothing in the generation
 * path calls kbSanityCheck; wiring it in is a separate, later decision, taken once this and
 * generation have each been tested on their own.
 *
 * It reads a GENERATED résumé and the SOURCE résumé it was generated from, and reports every
 * company-shaped claim — a team, or a technology the KB knows that employer uses — that the source
 * does not support. It flags; it never edits, never blocks, and never writes to the KB. Read-only
 * against the database.
 *
 * Usage:
 *   node scripts/k1KbSanityCheck.mjs --html <generated.html> --base <source.txt>
 *   node scripts/k1KbSanityCheck.mjs --html <generated.html> --profile <domain_profile id>
 *   node scripts/k1KbSanityCheck.mjs --verify      the acceptance run, both directions (below)
 *   options: --db <path>  (default data/resume_master.db) · --json
 *
 * --verify is the acceptance check from §K1, against THIS database's KB:
 *   1. the second G1 document (saved 09-28; its bullets verbatim) MUST flag;
 *   2. the owner's real résumé (profile 6's base résumé), run as its own generation, MUST flag
 *      NOTHING — the Bangalore precedent is a false "does not match" against a true claim.
 * It exits 1 if either direction fails. The first G1 document ("listed Kafka") was never saved; a
 * Kafka-at-Stripe line stands in for it, and Kafka in a SKILLS list is shown NOT flagging, because
 * that is a stated limit, not a pass.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { kbSanityCheck } from "../services/kb/failsafe.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const db = new Database(opt("--db") || path.join(ROOT, "data", "resume_master.db"), { readonly: true, fileMustExist: true });

function baseForProfile(id) {
  const row = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id = ?").get(Number(id));
  if (!row?.content) throw new Error(`no base résumé for profile ${id}`);
  return row.content;
}

function print(label, result) {
  if (args.includes("--json")) { console.log(JSON.stringify({ label, ...result }, null, 2)); return; }
  console.log(`\n${label}`);
  console.log(`  checked: ${JSON.stringify(result.checked)}${result.declined ? `  DECLINED: ${result.declined}` : ""}`);
  for (const f of result.findings) console.log(`  ⚑ [${f.kind}] ${f.message}`);
  if (!result.findings.length && !result.declined) console.log("  (no findings)");
}

const JANE_SOURCE = [
  "JANE Q SAMPLE", "Austin, TX · jane.sample@example.com", "", "EXPERIENCE",
  "Stripe — Software Engineer, 2021–2025",
  "- Built payment services in Go handling 2k requests/second",
  "- Designed PostgreSQL schemas for ledger reconciliation", "", "EDUCATION",
  "B.S. Computer Science, UT Austin, 2021", "", "TECHNICAL SKILLS", "Go, PostgreSQL, Docker, AWS",
].join("\n");

const entry = (bullets, { skills = "" } = {}) => `<html><body>
${skills ? `<div class="section-title">TECHNICAL SKILLS</div><ul class="bullets"><li><strong>Tools</strong> ${skills}</li></ul>` : ""}
<div class="section-title">EXPERIENCE</div>
<div class="entry"><div class="entry-header"><div><span class="entry-org">Stripe</span> <span class="entry-meta"><span class="sep">|</span> Austin, TX</span></div><div class="entry-date">2021 - 2025</div></div>
<div class="entry-role">Software Engineer</div>
<ul class="bullets">${bullets.map(b => `<li>${b}</li>`).join("")}</ul></div></body></html>`;

// The second G1 document, saved 09-28 by the agent's own run (draft-e2e-save.mjs): bullets verbatim.
const G1_DOC_2 = entry([
  "Built payment processing services in Go that sustained 2,000 requests/second, supporting core transaction throughput for the payments platform",
  "Designed PostgreSQL schemas for ledger reconciliation, balancing normalization against query performance to keep financial reporting accurate at scale",
  "Collaborated with risk and infrastructure teams to align service APIs with fraud-detection data requirements, reducing mismatched schema issues between systems",
  "Instrumented service-level metrics for payment endpoints, enabling faster diagnosis of latency regressions in the request pipeline",
]);

if (args.includes("--verify")) {
  let failed = 0;
  const expect = (label, result, wantFindings) => {
    print(label, result);
    const ok = wantFindings ? result.findings.length > 0 : result.findings.length === 0 && result.checked.entriesWithKb > 0;
    console.log(`  ${ok ? "✓" : "✗"} expected ${wantFindings ? "findings" : "NO findings, on an entry the KB holds"}`);
    if (!ok) failed++;
  };
  expect("1. G1 document 2 (risk/infrastructure teams invented at Stripe)",
    kbSanityCheck(db, G1_DOC_2, { baseResumeText: JANE_SOURCE }), true);
  expect("1b. stand-in for G1 document 1: Kafka claimed AT Stripe",
    kbSanityCheck(db, entry(["Built event pipelines on Kafka for ledger reconciliation"]), { baseResumeText: JANE_SOURCE }), true);
  const owner = baseForProfile(opt("--profile") || 6);
  expect("2. the owner's real résumé, as its own generation (Stripe, Bangalore)",
    kbSanityCheck(db, owner, { baseResumeText: owner }), false);
  const skillsOnly = kbSanityCheck(db, entry(["Built payment services in Go"], { skills: "Go · Kafka" }), { baseResumeText: JANE_SOURCE });
  print("LIMIT, not a pass: Kafka in the SKILLS list is not a company claim and is not flagged", skillsOnly);
  console.log(`\n${failed ? `✗ ${failed} acceptance check(s) failed` : "✓ both directions hold"}`);
  console.log("\nWHAT K1 CANNOT CATCH:");
  for (const line of skillsOnly.cannotCatch) console.log(`  · ${line}`);
  process.exit(failed ? 1 : 0);
}

const htmlPath = opt("--html");
if (!htmlPath || (!opt("--base") && !opt("--profile"))) {
  console.error("usage: --html <generated.html> (--base <source.txt> | --profile <id>) | --verify");
  process.exit(2);
}
const base = opt("--base") ? fs.readFileSync(opt("--base"), "utf8") : baseForProfile(opt("--profile"));
const result = kbSanityCheck(db, fs.readFileSync(htmlPath, "utf8"), { baseResumeText: base });
print(htmlPath, result);
console.log("\nWHAT K1 CANNOT CATCH:");
for (const line of result.cannotCatch) console.log(`  · ${line}`);

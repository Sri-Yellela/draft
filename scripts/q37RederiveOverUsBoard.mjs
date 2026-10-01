#!/usr/bin/env node
/**
 * Queue 37 — which published figures were taken over rows that should not exist, re-derived.
 *
 * Every curation figure to date was measured over a board that was ~29% non-US (local, 10-01). This
 * re-takes the three the queue names, ALL against the board as it is and against its US-admitted
 * subset (services/jobs/usLocation.js), side by side, so the change is visible rather than asserted:
 *
 *   1. ρ — the graded 30 (docs/am1-ats-graded-corpus.json), re-scored with today's engine exactly as
 *      scripts/am1GradedCorpusVerify.mjs does, then restricted to the postings the gate admits.
 *   2. The band cutpoints' two justifications (shared/atsBands.js): Strong ≥ 44 is "the lowest cut at
 *      which precision against human ≥ 4 reaches 100%"; Weak < 26 is "the share of the live board in
 *      Weak closest to the 36.7% the owner graded 1-or-2". Both re-computed on both populations.
 *   3. The entry/intern share (docs/STUDENT_BOARD_FINDING.md: 80 of 2663 = 3.0%).
 *
 * Read-only. Usage: node scripts/q37RederiveOverUsBoard.mjs [--db <path>]
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scoreAtsLocally, buildRuntimeAtsBasis } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";
import { usEligibility } from "../services/jobs/usLocation.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dbArg = args.indexOf("--db") >= 0 ? args[args.indexOf("--db") + 1] : null;
const db = new Database(dbArg || path.join(ROOT, "data", "resume_master.db"), { readonly: true });
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "am1-ats-graded-corpus.json"), "utf8"));

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");

const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(fixture.provenance.profile_id);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(fixture.provenance.profile_id)?.content;
if (!profile || !resumeText) { console.error("⛔ profile " + fixture.provenance.profile_id + " or its résumé is missing — cannot score."); process.exit(3); }
const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });
const runtimeBasis = buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile });
const weightsByFamily = new Map();
const score = (job) => {
  const fam = roleFamilyForTitle(job.title);
  if (!weightsByFamily.has(fam)) weightsByFamily.set(fam, loadTermWeights(db, fam));
  return scoreAtsLocally({ job, runtimeBasis, termWeights: weightsByFamily.get(fam), synonyms: null }).score;
};

// ── 1 + 2a. ρ and the Strong cutpoint, on the graded 30 ─────────────────────────────────────────
const graded = fixture.postings.filter((p) => Number.isFinite(p.human_fit))
  .map((p) => ({ ...p, fresh: score(p), gate: usEligibility(p) }));
const sets = [["all graded", graded], ["US-admitted", graded.filter((p) => p.gate.admit)]];
console.log("1. ρ (human FIT vs today's engine)");
for (const [name, s] of sets) console.log(`   ${name.padEnd(12)} n=${String(s.length).padStart(2)}  ρ=${spearman(s.map((p) => p.fresh), s.map((p) => p.human_fit)).toFixed(3)}`);
console.log("   not admitted: " + graded.filter((p) => !p.gate.admit)
  .map((p) => `#${p.n} ${p.location} (human ${p.human_fit}, engine ${p.fresh}, ${p.gate.reason})`).join("; "));

console.log("\n2a. Strong cutpoint — precision vs human ≥ 4, recall of human 5s");
for (const [name, s] of sets) {
  const fives = s.filter((p) => p.human_fit === 5);
  for (const cut of [40, 42, 44, 46]) {
    const at = s.filter((p) => p.fresh >= cut);
    console.log(`   ${name.padEnd(12)} cut ${cut}: precision ${pct(at.filter((p) => p.human_fit >= 4).length, at.length).padStart(6)} (${at.length})  ` +
                `recall5 ${pct(fives.filter((p) => p.fresh >= cut).length, fives.length)} of ${fives.length}`);
  }
  console.log(`   ${name.padEnd(12)} owner graded 1-or-2: ${pct(s.filter((p) => p.human_fit <= 2).length, s.length)}`);
}

// ── 2b + 3. The live board: band populations and the entry/intern share ─────────────────────────
const board = db.prepare("SELECT job_id, title, company, location, description, skills_json, normalized_title, experience_level, workplace_type, category FROM scraped_jobs WHERE is_active = 1").all()
  .map((r) => ({ ...r, gate: usEligibility(r) }));
const boards = [["whole board", board], ["US-admitted", board.filter((r) => r.gate.admit)]];
console.log("\n2b. Band populations on the live board, against profile " + profile.id);
for (const [name, b] of boards) {
  const scores = b.map(score);
  const strong = scores.filter((s) => s != null && s >= ATS_BAND_CUTPOINTS.strong).length;
  const weak = scores.filter((s) => s != null && s < ATS_BAND_CUTPOINTS.moderate).length;
  const none = scores.filter((s) => s == null).length;
  console.log(`   ${name.padEnd(12)} n=${b.length}  Strong ${pct(strong, b.length)}  Moderate ${pct(b.length - strong - weak - none, b.length)}  Weak ${pct(weak, b.length)}  no signal ${none}`);
  for (const cut of [24, 26, 28, 30]) console.log(`      weak cut ${cut}: ${pct(scores.filter((s) => s != null && s < cut).length, b.length)} in Weak`);
}
console.log("\n3. Entry + intern share (experience_level)");
for (const [name, b] of boards) {
  const n = b.filter((r) => r.experience_level === "entry" || r.experience_level === "intern").length;
  console.log(`   ${name.padEnd(12)} ${n} of ${b.length} = ${pct(n, b.length)}`);
}

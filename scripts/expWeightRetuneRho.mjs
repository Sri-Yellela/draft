#!/usr/bin/env node
/**
 * exp-weight-retune — did making a MET years requirement neutral (MEETS_EXPERIENCE_RATIO) lower any
 * path, and by how much did it move each one? BEFORE is the scorer at a git ref (default `main`),
 * extracted to a temp directory; AFTER is the working tree's package.
 *
 * The committed graded corpus (docs/am1-ats-graded-corpus.json, 30 postings, human FIT), scored on
 * four paths:
 *
 *   draft              the graded profile + its family's term weights, profile years as stored
 *                      (UNSET for the graded profile) — what am1GradedCorpusVerify scores
 *   draft+years        the same with the profile's years SET, to the figure A81's text reader finds —
 *                      what draft scores for a user who filled the field
 *   assistant          job + resumeText, factsFromText on, no profile, no weights — what the tools
 *                      service scores since A81
 *   assistant-notext   the same with factsFromText off — the pre-A81 tools service, for reference
 *
 * For each: Spearman rho with a 95% bootstrap CI, and the PAIRED bootstrap CI on rho(after) −
 * rho(before) (the same resample for both, 10,000 resamples, fixed seed). ⛔ n = 30: a change whose CI
 * spans zero is noise, and this prints it as such.
 *
 * ⛔ Prints figures only — never the résumé, never what was read from it. Read-only: pass a COPY.
 *
 * Usage: node scripts/expWeightRetuneRho.mjs --db <copy of data/resume_master.db> [--before <ref>] [--out f.json]
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as AFTER from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const dbPath = val("--db");
if (!dbPath) { console.error("--db <copy of data/resume_master.db> is required (read-only; use a copy)"); process.exit(2); }
const ref = val("--before", "main");

// BEFORE: the package's src/ and data/ at `ref`, written to a temp directory and imported from there.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "exp-retune-before-"));
const git = (...a) => execFileSync("git", a, { cwd: ROOT, maxBuffer: 64 << 20 });
const listed = git("ls-tree", "-r", "--name-only", ref, "packages/ats-scorer/src", "packages/ats-scorer/data").toString().trim().split("\n");
for (const f of listed) {
  const dest = path.join(tmp, path.relative("packages/ats-scorer", f));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, git("show", `${ref}:${f}`));
}
const BEFORE = await import(pathToFileURL(path.join(tmp, "src", "index.js")));

export function spearman(xs, ys) {
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
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "am1-ats-graded-corpus.json"), "utf8"));
const db = new Database(dbPath, { readonly: true });
const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(fixture.provenance.profile_id);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(fixture.provenance.profile_id)?.content;
if (!profile || !resumeText) { console.error("⛔ the graded profile or its résumé is not in this database"); process.exit(3); }
const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });
const textYears = AFTER.buildRuntimeAtsBasis({ resumeText, factsFromText: true }).yearsExperience;
const postings = fixture.postings.filter(p => Number.isFinite(p.human_fit));
const human = postings.map(p => p.human_fit);
const weightCache = new Map();
const weightsFor = (title) => { const f = roleFamilyForTitle(title); if (!weightCache.has(f)) weightCache.set(f, loadTermWeights(db, f)); return weightCache.get(f); };

const PATHS = {
  "draft": (S) => [S.buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile }), true],
  "draft+years": (S) => [S.buildRuntimeAtsBasis({ resumeText, signalProfile: { ...(signalProfile || {}), yearsExperience: textYears }, domainProfile: profile }), true],
  "assistant": (S) => [S.buildRuntimeAtsBasis({ resumeText, factsFromText: true }), false],
  "assistant-notext": (S) => [S.buildRuntimeAtsBasis({ resumeText }), false],
};
const scoresOf = (S, p) => { const [basis, weighted] = PATHS[p](S);
  return postings.map(j => S.scoreAtsLocally({ job: j, runtimeBasis: basis, termWeights: weighted ? weightsFor(j.title) : null, synonyms: null }).score); };

// One fixed set of resamples, shared by every path and both sides — that is what makes it PAIRED.
let seed = 0x5eed; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const B = 10000, N = postings.length;
const resamples = Array.from({ length: B }, () => Array.from({ length: N }, () => Math.floor(rnd() * N)));
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const ci = (f) => { const v = resamples.map(f); return [q(v, 0.025), q(v, 0.975)]; };
const pick = (arr, ix) => ix.map(i => arr[i]);

const out = { n: N, before: ref, after: "working tree", source: { before: BEFORE.LOCAL_ATS_SOURCE, after: AFTER.LOCAL_ATS_SOURCE },
              years_used_for_draft_years: textYears == null ? null : "text-read (value not printed)", paths: {} };
const f3 = (x) => (x >= 0 ? "+" : "") + x.toFixed(3);
const line = "─".repeat(100);
console.log(line);
console.log(`exp-weight-retune — the graded ${N}, before (${ref}, ${BEFORE.LOCAL_ATS_SOURCE}) vs after (working tree, ${AFTER.LOCAL_ATS_SOURCE})`);
console.log(`profile years set: ${signalProfile?.yearsExperience != null ? "yes" : "no"} · text years found: ${textYears != null ? "yes" : "no"} · ${B} paired resamples`);
console.log(line);
for (const p of Object.keys(PATHS)) {
  const b = scoresOf(BEFORE, p), a = scoresOf(AFTER, p);
  if (b.some(x => x == null) || a.some(x => x == null)) { console.error(`⛔ ${p}: a declined score — the corpus no longer scores whole`); process.exit(4); }
  const rb = spearman(human, b), ra = spearman(human, a);
  const ciB = ci(ix => spearman(pick(human, ix), pick(b, ix)));
  const ciA = ci(ix => spearman(pick(human, ix), pick(a, ix)));
  const ciD = ci(ix => spearman(pick(human, ix), pick(a, ix)) - spearman(pick(human, ix), pick(b, ix)));
  const moved = a.filter((x, i) => x !== b[i]).length;
  const noise = ciD[0] <= 0 && ciD[1] >= 0;
  out.paths[p] = { before: { rho: rb, ci: ciB }, after: { rho: ra, ci: ciA }, delta: { rho: ra - rb, ci: ciD, noise }, moved };
  console.log(`${p.padEnd(17)} ${rb.toFixed(3)} [${ciB[0].toFixed(3)}, ${ciB[1].toFixed(3)}] -> ${ra.toFixed(3)} [${ciA[0].toFixed(3)}, ${ciA[1].toFixed(3)}]` +
              `   Δ ${f3(ra - rb)} [${f3(ciD[0])}, ${f3(ciD[1])}]${moved ? (noise ? "  NOISE (CI spans 0)" : "") : ""}   ${moved}/${N} scores moved`);
}
console.log(line);
fs.rmSync(tmp, { recursive: true, force: true });
if (val("--out")) fs.writeFileSync(val("--out"), JSON.stringify(out, null, 2));

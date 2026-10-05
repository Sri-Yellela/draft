#!/usr/bin/env node
/**
 * A81 — does reading years and a stated clearance from résumé TEXT move any score draft shows, and
 * what does it do for a caller that sends only `job` + `resumeText` (an AI assistant over MCP)?
 *
 * The same committed graded corpus as scripts/am1GradedCorpusVerify.mjs (docs/am1-ats-graded-corpus.json,
 * 30 postings, human FIT), scored four ways:
 *
 *   draft         buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile }) + the family's
 *                 term weights — exactly what am1GradedCorpusVerify scores. ⛔ MUST NOT MOVE: draft never
 *                 passes factsFromText, and this is the proof that the default path is untouched.
 *   draft+text    the same, with factsFromText: true. The profile's own facts WIN over the text, so
 *                 this must equal `draft` too whenever the profile carries yearsExperience.
 *   assistant     what the tools service receives from an assistant: job + resumeText, no profile, no
 *                 weights, no synonyms — before A81 (factsFromText off).
 *   assistant+text  the same with factsFromText: true — what the tools service now scores.
 *
 * ⛔ Prints scores, postings and figures only — never the résumé or anything read out of it beyond
 * whether a fact was found. Read-only: pass a COPY of the database.
 *
 * Usage: node scripts/a81TextFactsRho.mjs --db <copy of data/resume_master.db> [--out scores.json]
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const dbPath = val("--db");
if (!dbPath) { console.error("--db <copy of data/resume_master.db> is required (read-only; use a copy)"); process.exit(2); }

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

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "am1-ats-graded-corpus.json"), "utf8"));
const db = new Database(dbPath, { readonly: true });
const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(fixture.provenance.profile_id);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(fixture.provenance.profile_id)?.content;
if (!profile || !resumeText) { console.error("⛔ the graded profile or its résumé is not in this database"); process.exit(3); }
const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });

const bases = {
  "draft": buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile }),
  "draft+text": buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile, factsFromText: true }),
  "assistant": buildRuntimeAtsBasis({ resumeText }),
  "assistant+text": buildRuntimeAtsBasis({ resumeText, factsFromText: true }),
};
const weighted = (name) => name.startsWith("draft");

const postings = fixture.postings.filter(p => Number.isFinite(p.human_fit));
const out = { n: postings.length, ways: {} };
for (const [name, basis] of Object.entries(bases)) {
  const rows = postings.map(p => {
    const rep = scoreAtsLocally({ job: p, runtimeBasis: basis,
      termWeights: weighted(name) ? loadTermWeights(db, roleFamilyForTitle(p.title)) : null, synonyms: null });
    return { n: p.n, human: p.human_fit, score: rep.score, experience: rep.experience.summary.replace(/\d+(\.\d+)? years/g, "N years"),
             hard: rep.hard_constraint_misses };
  });
  const scored = rows.filter(r => r.score != null);
  out.ways[name] = { rho: spearman(scored.map(r => r.human), scored.map(r => r.score)), scored: scored.length, rows };
}

const line = "─".repeat(90);
console.log(line);
console.log(`A81 — the graded ${out.n}, four ways (profile ${profile.id}; résumé ${resumeText.length} chars, not printed)`);
console.log(`profile years set: ${signalProfile?.yearsExperience != null ? "yes" : "no"} · ` +
            `text years found: ${bases["assistant+text"].yearsExperience != null ? "yes" : "no"} · ` +
            `text clearance found: ${bases["assistant+text"].structuredFacts.hasClearance ? "yes" : "no"}`);
console.log(line);
for (const [name, w] of Object.entries(out.ways)) {
  console.log(`${name.padEnd(16)} rho ${w.rho.toFixed(3)}   scored ${w.scored}/${out.n}`);
}
const moved = (a, b) => out.ways[a].rows.filter((r, i) => r.score !== out.ways[b].rows[i].score);
console.log(line);
console.log(`draft vs draft+text: ${moved("draft", "draft+text").length} of ${out.n} scores differ`);
const am = moved("assistant", "assistant+text");
console.log(`assistant vs assistant+text: ${am.length} of ${out.n} scores differ`);
for (const r of am) {
  const after = out.ways["assistant+text"].rows.find(x => x.n === r.n);
  console.log(`   ${String(r.n).padStart(2)}  human ${r.human}   ${String(r.score).padStart(3)} -> ${String(after.score).padStart(3)}   ${after.experience}`);
}
if (val("--out")) fs.writeFileSync(val("--out"), JSON.stringify(out, null, 2));

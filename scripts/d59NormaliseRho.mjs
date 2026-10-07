// scripts/d59NormaliseRho.mjs — ⛔ D59 step 2: does reading the NORMALISED text move the scores?
//
//   node scripts/d59NormaliseRho.mjs <backfilled db copy>
//
// The scorer reads the posting through withPostingText (description_text when fresh), so D59 changes
// scores wherever the normaliser changed the text. This scores, once on the stored description and once
// on the normalised text, with the same résumé, profile and weights:
//   A. the committed graded corpus (docs/am1-ats-graded-corpus.json) → ρ raw vs ρ normalised;
//   B. every board row whose description_text is set → score and band raw vs normalised.
// Read-only on the copy. Run scripts/d59Backfill.mjs first to make it.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";
import { normalizePosting } from "../shared/postingNormalize.js";
import { withPostingText } from "../services/jobs/descriptionText.js";
import { atsBandFor } from "../shared/atsBands.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.argv[2];
if (!dbPath) { console.error("usage: node scripts/d59NormaliseRho.mjs <backfilled db copy>"); process.exit(2); }
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "am1-ats-graded-corpus.json"), "utf8"));

const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(fixture.provenance.profile_id);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(fixture.provenance.profile_id)?.content;
if (!profile || !resumeText) { console.error(`⛔ profile ${fixture.provenance.profile_id} or its résumé is not in this database`); process.exit(3); }
const runtimeBasis = buildRuntimeAtsBasis({
  resumeText, domainProfile: profile,
  signalProfile: loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id }),
});
const score = (job) => scoreAtsLocally({ job, runtimeBasis, termWeights: loadTermWeights(db, roleFamilyForTitle(job.title)), synonyms: null });

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

// A · the graded corpus.
const graded = fixture.postings.filter(p => Number.isFinite(p.human_fit));
const corpus = graded.map(p => {
  const n = normalizePosting(p.description);
  const raw = score(p).score;
  const norm = n.changed ? score({ ...p, description: n.text }).score : raw;
  return { n: p.n, company: p.company, title: p.title, human: p.human_fit, changed: n.changed, raw, norm };
});
const human = corpus.map(r => r.human);
const rhoRaw = spearman(human, corpus.map(r => r.raw));
const rhoNorm = spearman(human, corpus.map(r => r.norm));

// B · the board rows the normaliser changed.
const board = db.prepare("SELECT * FROM scraped_jobs WHERE description_text IS NOT NULL").all().map(job => {
  const raw = score(job), norm = score(withPostingText(job));
  return { job_id: job.job_id, company: job.company, title: job.title, raw: raw.score, norm: norm.score,
    bandRaw: atsBandFor(raw), bandNorm: atsBandFor(norm) };
});

console.log(JSON.stringify({
  corpus: { n: corpus.length, textChanged: corpus.filter(r => r.changed).length, scoresMoved: corpus.filter(r => r.raw !== r.norm).length,
    rhoRaw: +rhoRaw.toFixed(3), rhoNormalised: +rhoNorm.toFixed(3), published: fixture.published.rho,
    moved: corpus.filter(r => r.raw !== r.norm) },
  board: { rowsWithNormalisedText: board.length, scoresMoved: board.filter(r => r.raw !== r.norm).length,
    bandsMoved: board.filter(r => r.bandRaw !== r.bandNorm).length, rows: board },
}, null, 2));

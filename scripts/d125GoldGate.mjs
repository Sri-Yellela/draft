#!/usr/bin/env node
// ⭐ D125 P4 · THE GOLD SET NEVER GETS WORSE. Re-measures the CURRENT scorer on the owner's reviewed gold set (Admin →
// ATS calibration) and compares it with the baseline he recorded there: a fall in skill or verb precision / recall, or
// in ρ, fails (exit 1) and names each drop. READ-ONLY on the database.
//
//   node scripts/d125GoldGate.mjs [--db <path>]        (default: $RM_DATA_DIR/resume_master.db, else data/)
//
// ⚠ The gold set lives in the DATABASE, not the repository: its postings are employers' text and one résumé is the
// owner's own, so it is never committed (CLAUDE.md). Run this against production's database (or a pulled backup)
// before a scorer, extraction or vocabulary change ships; it is not part of `npm test`.
import path from "node:path";
import Database from "better-sqlite3";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { results, latestBaseline, gate } from "../services/atsCalibration.js";

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const dbPath = flag("db", path.join(process.env.RM_DATA_DIR || path.join(process.cwd(), "data"), "resume_master.db"));
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

// The board's scoring, as server.js builds it: the role family's fresh weights and the confirmed synonyms.
const synonyms = loadConfirmedSynonyms(db);
const weights = new Map();
const weightsFor = (job) => {
  let family = null; try { family = roleFamilyForTitle(job?.title || ""); } catch { /* none */ }
  const k = family || "__none__";
  if (!weights.has(k)) { let l = null; try { l = loadTermWeights(db, family); } catch { /* none */ } weights.set(k, l && !l.stale && l.weights.size ? l.weights : null); }
  return weights.get(k);
};
const score = (job, resumeText) => scoreAtsLocally({ job, resumeText, termWeights: weightsFor(job), synonyms });

const r = results(db, { score });
const b = latestBaseline(db, r.version);
const f = (x) => (x == null ? "—" : x.toFixed(3));
console.log(`gold set v${r.version ?? "—"} · ${r.reviewed} reviewed postings · ${r.rhoPairs} scored pairs`);
console.log(`skills  P ${f(r.skills.precision)}  R ${f(r.skills.recall)}   verbs  P ${f(r.verbs.precision)}  R ${f(r.verbs.recall)}   ρ ${f(r.rho)}`);
if (!r.reviewed) { console.log("No reviewed postings yet — nothing to gate."); process.exit(0); }
if (!b) { console.log("No baseline recorded (Admin → ATS calibration → Record as baseline) — nothing to gate."); process.exit(0); }
const g = gate(r, b);
for (const d of g.drops) console.log(`DROP  ${d.metric}: ${f(d.was)} → ${f(d.is)}`);
console.log(g.ok ? "PASS — nothing fell below the baseline." : `FAIL — ${g.drops.length} metric(s) fell below the baseline.`);
process.exit(g.ok ? 0 : 1);

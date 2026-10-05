// A81 — the package can now read years and a stated clearance from résumé TEXT, opt-in
// (buildRuntimeAtsBasis factsFromText). ⛔ draft does NOT opt in: its users have a profile, and its
// scores, stored reports and basis hashes must not move. These pin that from draft's side; the
// measured proof (the graded 30, every score identical) is scripts/a81TextFactsRho.mjs and
// scripts/am1GradedCorpusVerify.mjs, whose outputs were byte-identical before and after.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildRuntimeAtsBasis, scoreAtsLocally } from "../services/localAtsScorer.js";

const SYNTHETIC = "EXPERIENCE\nExample Co — Engineer\nJan 2015 – Present\nActive TS/SCI clearance.\nPython, Kubernetes, AWS.";
const JOB = { title: "Backend Engineer", company: "Acme",
  description: "Python, Kubernetes, Kafka, Terraform and AWS. Requires 5+ years of experience. Active TS/SCI clearance required." };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(m?js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("⛔ no draft production code passes factsFromText — draft's scores stay profile-sourced", () => {
  const files = ["server.js", ...walk("services"), ...walk("routes"), ...walk("shared")];
  const offenders = files.filter(f => /factsFromText/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(offenders, [], "opting in moves every draft score that has a years or clearance line — that is a product decision, not a refactor");
});

test("⛔ draft's wrapper, with no profile, scores a dated, cleared résumé exactly as before A81", () => {
  // The public ATS tool and the no-active-profile paths call this with no signalProfile at all.
  for (const signalProfile of [undefined, null, {}]) {
    const basis = buildRuntimeAtsBasis({ resumeText: SYNTHETIC, signalProfile: signalProfile ?? undefined });
    assert.equal("factsFromText" in basis, false);
    const r = scoreAtsLocally({ job: JOB, runtimeBasis: basis });
    assert.equal(r.experience.summary, "Job asks for 5+ years; profile years are not set.");
    assert.ok(r.hard_constraint_misses.includes("Security clearance"));
    assert.equal("facts_from_text" in r, false);
  }
  const viaWrapper = scoreAtsLocally({ job: JOB, resumeText: SYNTHETIC });
  assert.equal(viaWrapper.experience.summary, "Job asks for 5+ years; profile years are not set.");
});

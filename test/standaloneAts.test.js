import test from "node:test";
import assert from "node:assert/strict";
import { standaloneAtsResult, standaloneJob } from "../services/standaloneAts.js";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { atsBandFor, ATS_BAND } from "../shared/atsBands.js";

const RESUME = `Jordan Rivera — Backend Engineer
Built payment services in Go and Python on AWS; designed PostgreSQL schemas; ran Kubernetes and
Docker deployments; automated CI/CD; instrumented observability with Prometheus and Grafana.
Designed REST APIs, built event pipelines with Kafka, and mentored two engineers over four years.`;
const JD = `Backend Engineer
We build services in Go and Python on AWS with PostgreSQL, Kubernetes, Docker and Kafka.
You will design REST APIs, automate CI/CD and own observability with Prometheus and Grafana.`;

test("the public tool answers with a BAND and never the number (G5)", () => {
  const r = standaloneAtsResult({ resumeText: RESUME, jdText: JD });
  assert.ok(Object.values(ATS_BAND).includes(r.band), `unknown band ${r.band}`);
  assert.equal("score" in r, false, "the result carries the raw score");
  assert.ok(!JSON.stringify(r).match(/"(score|raw_score|matchScore)"/), "a score leaked into a nested field");
});

test("it scores exactly as the panel's scorer does for the same pair", () => {
  const weights = new Map([["kafka", 2]]);
  const r = standaloneAtsResult({ resumeText: RESUME, jdText: JD, termWeightsFor: () => weights });
  const job = standaloneJob(JD);
  const direct = scoreAtsLocally({ job, resumeText: RESUME, termWeights: weights, synonyms: null });
  assert.equal(r.band, atsBandFor(direct));
  assert.deepEqual(r.matched_skills, direct.tier1_matched);
  assert.deepEqual(r.missing_skills, direct.tier1_missing);
});

test("a posting with nothing to score is Not enough signal, with its reasons — not Weak", () => {
  const r = standaloneAtsResult({ resumeText: RESUME, jdText: "We are hiring. Apply today." });
  assert.equal(r.band, ATS_BAND.NOT_ENOUGH_SIGNAL);
  assert.ok(r.decline_reasons.length > 0, "a decline must say why");
});

test("the title comes from the caller, else the posting's first line", () => {
  assert.equal(standaloneJob("\n\n  Senior Data Engineer \nbody").title, "Senior Data Engineer");
  assert.equal(standaloneJob("Anything\nbody", "Backend Engineer").title, "Backend Engineer");
  assert.equal(standaloneJob("x".repeat(300)).title.length, 120);
});

test("the thin-resume note fires for a short resume, never for 'no profile' — visitors have none", () => {
  const long = (RESUME + "\n").repeat(12);
  assert.equal(standaloneAtsResult({ resumeText: long, jdText: JD }).resume_depth, null,
    "a full resume was called thin because the anonymous visitor has no profile skills");
  const short = standaloneAtsResult({ resumeText: "Go engineer. Built APIs.", jdText: JD }).resume_depth;
  assert.equal(short?.reason, "short_resume");
  assert.ok(short.headline && short.detail);
});

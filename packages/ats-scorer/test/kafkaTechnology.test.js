// ⭐ A122 (1.7.3, owner 11-26 "go with your recs") — "kafka" in job text is the TECHNOLOGY: a posting that names it only in
// its prose (no skills list) now counts it, as it counts Kubernetes. The one exception is Kafka the author: a posting that
// names "Franz Kafka" counts it only when its own skills list does ("trust the reader"). Synthetic résumés and postings only.
import test from "node:test";
import assert from "node:assert/strict";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "../src/index.js";

const basis = buildRuntimeAtsBasis({ resumeText: "Data engineer. Built Kafka streaming pipelines and Kubernetes services.",
  signalProfile: { skills: [], titles: [], keywords: [], yearsExperience: 5, structuredFacts: {} }, domainProfile: {} });
const job = (description, skills = null) => ({ title: "Data Engineer", company: "Acme", description,
  ...(skills ? { skills_json: JSON.stringify(skills.map((skill) => ({ skill, type: "hard" }))) } : {}) });
const terms = (r) => [...r.tier1_matched, ...r.tier1_missing].map((t) => t.toLowerCase());

test("A122: a posting that names Kafka only in its prose counts it — the technology, matched on the résumé", () => {
  const r = scoreAtsLocally({ job: job("You will build streaming pipelines with Kafka and run them on Kubernetes."), runtimeBasis: basis });
  assert.ok(terms(r).includes("kafka"), JSON.stringify(r.tier1_matched));
  assert.ok(r.tier1_matched.map((t) => t.toLowerCase()).includes("kafka"), "the résumé's Kafka is matched");
});

test("A122: Kafka the author is not the technology — a posting naming Franz Kafka counts it only from its skills list", () => {
  const prose = "Our book club reads Franz Kafka. You will build services on Kubernetes.";
  assert.ok(!terms(scoreAtsLocally({ job: job(prose), runtimeBasis: basis })).includes("kafka"), "the author is not asked for");
  assert.ok(terms(scoreAtsLocally({ job: job(prose, ["Kafka", "Kubernetes"]), runtimeBasis: basis })).includes("kafka"),
    "its own skills list still decides");
});

#!/usr/bin/env node
/**
 * A64 — apply the 2026-10-02 audit of packages/ats-scorer/data/DOMAIN_TOOL_REGISTRY.json.
 *
 * What the audit found (WORKLOG A64, SESSION LOG 17d):
 *   · The header said the registry is "used by classifier.js and the generation model to enforce
 *     company authenticity". Nothing does. Its ONE reader is the ATS scorer (vocabulary.js
 *     companyStackTerms -> scorer.js candidateTermsFromJob), which admits a company's stack term as
 *     a skill only when that term appears in THAT company's own posting text (and passes the
 *     ambiguity guard). So an entry can never put a term into a score that the posting did not ask
 *     for. `notStack` has no reader at all.
 *   · Stripe was wrong: "GCP, Pub/Sub, BigQuery, GKE, Dataflow", with "AWS Lambda" as notStack.
 *     Stripe runs on AWS (AWS's own case study and engineering blog) and writes mostly Ruby,
 *     type-checked with Sorbet, with Java and Go for services (Sorbet's site; Stripe engineering).
 *   · notStack: 75 negative claims, none sourced, none read. A "does not use X" claim is the kind
 *     that does harm the moment something reads it (a true claim flagged false). Removed.
 *
 * Applied rule: an entry carries `sources` when audited; its stack then holds only terms backed by
 * those sources or by the company's own postings on the board. Entries without `sources` are
 * UNVERIFIED and the header says so. Idempotent: run it twice, same file.
 */
import fs from "node:fs";

const FILE = "packages/ats-scorer/data/DOMAIN_TOOL_REGISTRY.json";
const reg = JSON.parse(fs.readFileSync(FILE, "utf8"));

const AUDITED = {
  Stripe: {
    stack: ["AWS", "Ruby", "Sorbet", "Java", "Go", "Python", "TypeScript", "Kafka", "PostgreSQL",
            "payments infrastructure", "risk and fraud"],
    sources: [
      "https://aws.amazon.com/blogs/mt/how-stripe-architected-massive-scale-observability-solution-on-aws/",
      "https://aws.amazon.com/solutions/case-studies/stripe-architects-case-study/",
      "https://sorbet.org/blog/2019/05/16/state-of-sorbet-spring-2019",
      "https://newsletter.pragmaticengineer.com/p/stripe",
      "Stripe's own postings on the board (Python, TypeScript, Kafka, PostgreSQL, risk and fraud, payments infrastructure)",
    ],
  },
  Airbnb: {
    stack: ["Airflow", "Hive", "Spark", "Presto", "Druid", "Python", "Java", "Minerva metrics platform",
            "marketplace search and ranking", "pricing optimisation", "trust and safety"],
    sources: [
      "https://medium.com/airbnb-engineering/how-airbnb-achieved-metric-consistency-at-scale-f23cc53dea70",
      "https://medium.com/airbnb-engineering/how-airbnb-enables-consistent-data-consumption-at-scale-1c0b6a8b9206",
      "Airbnb's own postings on the board (Python, Java, trust and safety, pricing optimisation)",
    ],
  },
  Spotify: {
    stack: ["Python", "Java", "GCP", "BigQuery", "Pub/Sub", "Dataflow", "Scio", "Luigi", "Flyte",
            "music recommendation", "podcast analytics", "A/B experimentation"],
    sources: [
      "https://cloud.google.com/blog/products/gcp/spotifys-journey-to-cloud-why-spotify-migrated-its-event-delivery-system-from-kafka-to-google-cloud-pubsub",
      "https://engineering.atspotify.com/2017/10/big-data-processing-at-spotify-the-road-to-scio-part-1",
      "https://www.computerworld.com/article/1655983/how-spotify-migrated-everything-from-on-premise-to-google-cloud-platform.html",
    ],
  },
};

const HEADER = "Per-company stack terms for the ATS scorer. READ BY ONE THING: @draft/ats-scorer's candidateTermsFromJob " +
  "(via vocabulary.js companyStackTerms), which admits a company's stack term as a skill ONLY when that term appears in that " +
  "company's own posting text and passes the ambiguity guard — so an entry can never put a term into a score that the posting " +
  "did not ask for. ⛔ NOT a source of facts about a company: do not use it to assert or deny what an employer runs. " +
  "Schema: { domain, stack[], scaleRank, sources[]? }. An entry WITH `sources` was audited (A64, 2026-10-02) and its stack " +
  "holds only terms those sources or the company's own postings back; an entry WITHOUT `sources` is UNVERIFIED. `notStack` " +
  "was removed by the audit: 75 unsourced negative claims that nothing read.";

const out = { __comment: HEADER };
for (const [k, v] of Object.entries(reg)) {
  if (k.startsWith("__")) continue;
  const { notStack, ...rest } = v;                       // eslint-disable-line no-unused-vars
  out[k] = AUDITED[k] ? { ...rest, stack: AUDITED[k].stack, sources: AUDITED[k].sources } : rest;
}

// The file's own layout: one entry per block, fields one per line, arrays inline.
const lines = ["{", `  "__comment": ${JSON.stringify(out.__comment)},`, ""];
const keys = Object.keys(out).filter(k => k !== "__comment");
keys.forEach((k, i) => {
  const fields = Object.entries(out[k]).map(([f, val]) => `    ${JSON.stringify(f)}: ${JSON.stringify(val).replace(/","/g, "\", \"")}`);
  lines.push(`  ${JSON.stringify(k)}: {`, fields.join(",\n"), `  }${i < keys.length - 1 ? "," : ""}`);
});
lines.push("}", "");
const text = lines.join("\n");
JSON.parse(text);                                        // refuse to write anything that is not JSON
fs.writeFileSync(FILE, text);
console.log(`${keys.length} entries; audited ${Object.keys(AUDITED).length}; notStack removed everywhere.`);

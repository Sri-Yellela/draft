// ⭐ A122 (owner 11-26, "go with your recs"): "kafka" is the technology in job text, unless the posting means Kafka the
// author. The scorer (packages/ats-scorer, 1.7.3, test/kafkaTechnology.test.js) and Atlas's posting matcher (its mirror of
// the scorer's ambiguous words) say the same thing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { AMBIGUOUS_TERMS, KAFKA_THE_AUTHOR_RE } from "../services/atlas/postingMatcher.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A122: kafka left both ambiguous-word lists, which still agree (the matcher adds only 'can', the CAN bus)", () => {
  assert.ok(!AMBIGUOUS_TERMS.has("kafka"));
  const src = read("packages/ats-scorer/src/scorer.js");
  const list = src.slice(at(src, "const AMBIGUOUS_SKILL_WORDS = new Set(["), at(src, "]);", at(src, "const AMBIGUOUS_SKILL_WORDS = new Set([")));
  const scorer = new Set([...list.replace(/\/\/[^\n]*/g, "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  assert.ok(!scorer.has("kafka"));
  assert.deepEqual([...AMBIGUOUS_TERMS].filter((t) => t !== "can").sort(), [...scorer].sort());
});

test("A122: Kafka the author is caught by name — the technology is not", () => {
  assert.ok(KAFKA_THE_AUTHOR_RE.test("Our book club reads Franz Kafka."));
  assert.ok(!KAFKA_THE_AUTHOR_RE.test("Apache Kafka, Kafka Streams and Kafka Connect"));
  const m = read("services/atlas/postingMatcher.js");
  assert.match(m, /const counted = \(t\) => \(t === "kafka" && authorKafka\(\) \? listed\(\)\.has\(t\) : !AMBIGUOUS_TERMS\.has\(t\) \|\| listed\(\)\.has\(t\)\);/);
  assert.match(read("packages/ats-scorer/src/scorer.js"), /if \(key === "kafka" && normJob\.includes\(KAFKA_THE_AUTHOR\)\) return !enrichedKeys\.has\(key\);/);
});

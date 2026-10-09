// D70 Phase 1, draft's half: the keyword context a generation will send instead of the posting.
import test from "node:test";
import assert from "node:assert/strict";
import { buildJobKeywords, responsibilityPhrases, KEYWORD_CAPS } from "../services/jobKeywordContext.js";
import { scoreAtsLocally } from "../services/localAtsScorer.js";

const POSTING = `Senior Backend Engineer — Payments
We are building the payments platform that moves money for millions of merchants.
Responsibilities
- Design and own our payments platform and the ledger services behind it
- Build reliable data pipelines for reconciliation
- Join the on-call rotation for production systems
Requirements
- 5+ years with Go or Java, PostgreSQL, and Kafka
- Experience with Kubernetes and Terraform`;
const RESUME = `Jane Doe
EXPERIENCE
Northwind — Software Engineer
- Built Go services on PostgreSQL handling 40,000 payments a day
- Led the migration of reconciliation jobs`;

test("D70 P1: a missing-and-unclaimed term never appears; a claimed term the posting asks for appears as claimed", () => {
  const report = { tier1_matched: ["Go", "PostgreSQL", "Kubernetes"], tier1_missing: ["Kafka", "Terraform", "Java"],
    claimed_matches: ["Kubernetes"], action_verbs_matched: ["Built"], action_verbs_missing: ["Design"], competencies_matched: ["system design"] };
  const k = buildJobKeywords({ job: { seniority: "Senior" }, report, claims: { skills: ["Kubernetes", "Rust"], actionVerbs: ["Design", "Juggle"] }, postingText: POSTING });
  const all = JSON.stringify(k);
  for (const t of ["Kafka", "Terraform", "Java", "Rust", "Juggle"]) assert.ok(!all.includes(`"${t}"`), `${t} must not be sent`);
  assert.deepEqual(k.matched, ["Go", "PostgreSQL"], "evidenced = matched − claimed");
  assert.deepEqual(k.claimed, ["Kubernetes"]);
  assert.deepEqual(k.verbs, ["Built", "Design"], "a claimed verb the posting asks for");
  assert.deepEqual(k.competencies, ["system design"]);
  assert.equal(k.seniority, "Senior");
});

test("D70 P1: phrases are short, deterministic, and never the posting's sentences", () => {
  const a = responsibilityPhrases(POSTING);
  assert.deepEqual(responsibilityPhrases(POSTING), a, "same input → same output");
  assert.ok(a.includes("payments platform"), JSON.stringify(a));
  assert.ok(a.includes("on-call"));
  assert.ok(a.includes("data pipelines"));
  assert.ok(a.length <= KEYWORD_CAPS.phrases && a.every(p => p.split(" ").length <= KEYWORD_CAPS.phraseWords));
  assert.ok(!a.some(p => p.includes("millions")), "the intro line (not a bullet) is not read");
});

test("D70 P1: lists are deduped case-insensitively and bounded; nothing longer than 60 characters of the posting is sent", () => {
  const many = Array.from({ length: 90 }, (_, i) => `Term${i}`);
  const k = buildJobKeywords({ report: { tier1_matched: [...many, "go", "Go"], claimed_matches: [] }, postingText: POSTING });
  assert.equal(k.matched.length, KEYWORD_CAPS.matched);
  const out = JSON.stringify(k).toLowerCase();
  const p = POSTING.toLowerCase();
  for (let i = 0; i + 61 <= p.length; i += 7) assert.ok(!out.includes(p.slice(i, i + 61)), "a 61-character run of the posting was sent");
});

test("D70 P1: it reads the real scorer's report shape (no model call)", () => {
  const report = scoreAtsLocally({ job: { title: "Senior Backend Engineer", description: POSTING }, resumeText: RESUME });
  const k = buildJobKeywords({ job: { title: "Senior Backend Engineer" }, report, postingText: POSTING });
  for (const t of report.tier1_missing || []) assert.ok(!k.matched.includes(t) && !k.claimed.includes(t), `missing ${t} leaked`);
  assert.ok(Array.isArray(k.phrases) && k.phrases.length > 0);
});

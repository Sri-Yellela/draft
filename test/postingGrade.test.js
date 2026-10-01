import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { requirementsSections, measurePosting, boardBaseline, gradePosting, namedTools } from "../services/postingGrade.js";

/**
 * R1 — grade the employer's posting. Comparative, never absolute; zero model calls; never a league
 * table. The board-scale measurement (detection on 20, distribution over 50) is
 * scripts/r1PostingGradeMeasure.mjs; these pin the rules.
 */

test("R1: the requirements headings the board actually uses are found", () => {
  for (const [text, required, preferred] of [
    ["Who you are\nMinimum requirements\n• 5 years\nPreferred qualifications\n• Go", "Minimum requirements", "Preferred qualifications"], // Stripe
    ["About the role\nYou may be a good fit if you:\n• ship", "You may be a good fit if you", null],                                   // Anthropic
    ["In this role, you will:\n• build\nYou might thrive in this role if you:\n• care", "You might thrive in this role if you", null], // OpenAI
    ["SKILLS YOU'LL NEED TO BRING\n• React\nNICE TO HAVES:\n• Rust", "SKILLS YOU'LL NEED TO BRING", "NICE TO HAVES"],                  // Notion
    ["🧠 You will...\n• build\n✅ You have...\n• Kubernetes", "You have", null],                                                      // Duolingo
  ]) {
    const r = requirementsSections(text);
    assert.equal(r.required, required, text);
    assert.equal(r.preferred, preferred, text);
  }
});

test("R1: a sentence is not a heading, and a posting with no section says so", () => {
  const r = requirementsSections("We need someone who has strong requirements gathering skills.\nYou will build things.");
  assert.equal(r.hasRequirements, false);
});

test("R1: requirements are read from the FULL text, not the capped copy the counts use", () => {
  // The board stores ~3,000 + 2,000 characters and elides the middle — where requirements sit.
  // Capping a submitted posting before looking would report a section it HAS as missing.
  const long = "About us\n" + "We build payments infrastructure. ".repeat(110) +
    "\nMinimum requirements\n• 5 years of Go\n" + "We care about our people deeply. ".repeat(80);
  assert.ok(long.length > 6000);
  const m = measurePosting({ title: "Engineer", company: "Acme", description: long });
  assert.equal(m.capped, true);
  assert.equal(m.requirements.required, "Minimum requirements");
});

test("R1: technologies are registry TOOLS, never keywords like 'financial reporting'", () => {
  const found = namedTools("We use Go, Kafka and PostgreSQL for financial reporting. Let's go to market.");
  assert.ok(found.includes("Go") && found.includes("Kafka") && found.includes("PostgreSQL"), found.join(","));
  assert.ok(!found.some(t => /financial reporting/i.test(t)));
  assert.equal(found.filter(t => t === "Go").length, 1, "'go to market' is not the language");
});

function board() {
  const rows = [];
  for (let i = 0; i < 40; i++) {
    rows.push({ job_id: `e${i}`, company: `Co${i % 8}`, bucket_role: "engineering", title: "Software Engineer",
      description: `About Co${i % 8}\nWe are a company that values every customer and every builder on the team.\n` +
        `What you'll do\n• Build services in Go${i % 2 ? ", Kafka and PostgreSQL" : ""}\nMinimum requirements\n• ${i % 5} years` });
  }
  for (let i = 0; i < 35; i++) {
    rows.push({ job_id: `s${i}`, company: `Co${i % 8}`, bucket_role: "sales", title: "Account Executive",
      description: `About Co${i % 8}\nWe are a company that values every customer and every builder on the team.\nOwn a quota and run discovery calls with prospects.` });
  }
  return boardBaseline(rows);
}

test("R1: COMPARATIVE — every line carries the peers' median or rate, and there is no total score", () => {
  const g = gradePosting({ title: "Backend Engineer", company: "Acme", bucket_role: "engineering",
    description: "What you'll do\n• Build services in Go, Kafka, PostgreSQL, Redis and Kubernetes\nMinimum requirements\n• 3 years" }, board());
  assert.ok(!("score" in g) && !("total" in g), "no number out of 100, anywhere");
  for (const line of g.lines) {
    assert.ok("boardMedian" in line || "boardRate" in line || line.measure === "seniority", JSON.stringify(line));
    assert.match(line.sentence, /median|postings on this board|years/);
  }
  const spec = g.lines.find(l => l.measure === "specificity");
  assert.match(spec.sentence, /^Names 5 specific technologies; the median engineering posting on this board names \d+\.$/);
  assert.equal(g.modelCalls, 0);
});

test("R1: peers are the role family when the board holds enough of them, else the whole board — and it says which", () => {
  const b = board();
  assert.equal(gradePosting({ title: "x", company: "Acme", bucket_role: "engineering", description: "Go" }, b).peers, "engineering");
  const thin = gradePosting({ title: "x", company: "Acme", bucket_role: "legal", description: "Go" }, b);
  assert.equal(thin.peers, "board");
  assert.match(thin.lines[0].sentence, /the median posting on this board/);
});

test("R1: NEVER A LEAGUE TABLE — a grade names no other employer", () => {
  const g = gradePosting({ title: "Engineer", company: "Acme", bucket_role: "engineering", description: "Build in Go." }, board());
  assert.doesNotMatch(JSON.stringify(g), /Co\d/);
});

test("R1: boilerplate needs the company's own peers — no corpus, no claim", () => {
  const b = board();
  const unknown = gradePosting({ title: "Engineer", company: "Nobody Inc", bucket_role: "engineering", description: "Build in Go and Rust for our customers every day." }, b);
  assert.ok(!unknown.lines.some(l => l.measure === "boilerplate"));
  const known = gradePosting({ title: "Engineer", company: "Co1", bucket_role: "engineering",
    description: "About Co1\nWe are a company that values every customer and every builder on the team.\nBuild services in Go." }, b);
  assert.ok(known.lines.some(l => l.measure === "boilerplate"));
});

test("R1: seniority coherence — a junior title asking 3+ years is said, a mid ask is not", () => {
  const b = board();
  const says = (title, years) => gradePosting({ title, company: "Acme", bucket_role: "engineering",
    description: `Minimum requirements\n• ${years}+ years of experience building software` }, b).lines.some(l => l.measure === "seniority");
  assert.equal(says("Junior Software Engineer", 5), true);
  assert.equal(says("Junior Software Engineer", 1), false);
  assert.equal(says("Senior Software Engineer", 5), false);
});

test("R1: zero model calls — the module imports no model client and no network", () => {
  const src = fs.readFileSync("services/postingGrade.js", "utf8");
  const imports = src.match(/^import .*$/gm) || [];
  assert.ok(imports.length > 0);
  for (const line of imports) assert.doesNotMatch(line, /anthropic|toolsService|model|fetch|http/i, line);
  assert.doesNotMatch(src.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""), /\bfetch\(|callAnthropic|messages\.create/);
});

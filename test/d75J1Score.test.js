// D75 J1 acceptance — the known-answer set and its scorer (services/crawlerJ1Score.js, scripts/d75J1Score.mjs).
// §7: the correct (vendor, slug) for >= 90 %, a wrong one for none. No network: evidence is read by draft's
// own harvestPairOf, which parses URLs and fetches nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scoreJ1, rowsOf, readRow, normHost, formatReport } from "../services/crawlerJ1Score.js";
import { harvestPairOf } from "../services/slugHarvest.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(root, "test", "fixtures", "d75J1KnownAnswers.json");
const KNOWN = JSON.parse(fs.readFileSync(FIXTURE, "utf8")).companies;

const K = [
  { company: "Stripe", url: "https://stripe.com", ats_type: "greenhouse", slug: "stripe" },
  { company: "OpenAI", url: "https://openai.com", ats_type: "ashby", slug: "openai" },
  { company: "Zoox", url: "https://zoox.com", ats_type: "lever", slug: "zoox" },
];
// A crawler_tasks row as `sqlite3 -json` exports it: input_json and result_json are strings.
let nextId = 1;
const row = (host, urls, { status = "found", id = nextId++, extra = {} } = {}) => ({
  id, type: "j1_find_board", target_host: host, input_json: JSON.stringify({ baseUrl: `https://${host}` }),
  status: "done", result_status: status,
  result_json: JSON.stringify({ taskId: id, type: "j1_find_board", status, evidence: urls.map(url => ({ url, how: "link" })), ...extra }),
});
const outcomeOf = (r, company) => r.companies.find(c => c.company === company);

// ── the known-answer set ────────────────────────────────────────────────────────────────────────────

test("the known-answer set: ~30 companies, public https sites, three ATS, no duplicate host or pair", () => {
  assert.ok(KNOWN.length >= 28 && KNOWN.length <= 40, `${KNOWN.length} companies`);
  const hosts = new Set(), pairs = new Set();
  for (const k of KNOWN) {
    assert.ok(k.company && k.url && k.ats_type && k.slug, JSON.stringify(k));
    assert.match(k.url, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/?$/i, `${k.company}: a public homepage URL`);
    assert.ok(["greenhouse", "ashby", "lever"].includes(k.ats_type), k.ats_type);
    assert.ok(!hosts.has(normHost(k.url)), `duplicate host ${k.url}`); hosts.add(normHost(k.url));
    assert.ok(!pairs.has(`${k.ats_type}/${k.slug}`), `duplicate pair ${k.slug}`); pairs.add(`${k.ats_type}/${k.slug}`);
  }
  for (const ats of ["greenhouse", "ashby", "lever"]) assert.ok(KNOWN.filter(k => k.ats_type === ats).length >= 4, ats);
});

test("every known answer is a pair draft's own parser reads back from that board's URL", () => {
  const board = { greenhouse: s => `https://boards.greenhouse.io/${s}`, ashby: s => `https://jobs.ashbyhq.com/${s}`, lever: s => `https://jobs.lever.co/${s}` };
  for (const k of KNOWN) assert.deepEqual(harvestPairOf(board[k.ats_type](k.slug)), { atsType: k.ats_type, slug: k.slug }, k.company);
});

test("nothing personal in the fixture: company names and public URLs only", () => {
  const values = KNOWN.flatMap(k => Object.values(k)).join(" | ");
  assert.doesNotMatch(values, /@[a-z0-9-]+\.[a-z]/i, "no email address");
  assert.doesNotMatch(values, /\+?\d[\d ()-]{8,}\d/, "no phone number");
  for (const k of KNOWN) assert.deepEqual(Object.keys(k).filter(x => !["company", "url", "ats_type", "slug", "check", "verified"].includes(x)), [], k.company);
});

// ── the scoring rules ───────────────────────────────────────────────────────────────────────────────

test("an exact (ats, slug) match is correct — and counts in precision and recall", () => {
  const r = scoreJ1(K, [row("stripe.com", ["https://boards.greenhouse.io/stripe"]),
                        row("openai.com", ["https://jobs.ashbyhq.com/openai/abc-123"]),
                        row("zoox.com", ["https://jobs.lever.co/zoox"])]);
  assert.deepEqual(r.companies.map(c => c.outcome), ["correct", "correct", "correct"]);
  assert.deepEqual(r.overall, { known: 3, correct: 3, wrong: 0, missed: 0, precision: 1, recall: 1 });
  assert.equal(r.acceptance.pass, true);
});

test("slugs compare case-insensitively", () => {
  const r = scoreJ1(K, [row("openai.com", ["https://jobs.ashbyhq.com/OpenAI"]), row("stripe.com", ["https://boards.greenhouse.io/STRIPE"])]);
  assert.equal(outcomeOf(r, "OpenAI").outcome, "correct");
  assert.equal(outcomeOf(r, "Stripe").outcome, "correct");
  assert.equal(r.byAts.ashby.correct, 1);
});

test("a missing answer is a miss — it lowers recall, never precision", () => {
  const r = scoreJ1(K, [row("stripe.com", ["https://boards.greenhouse.io/stripe"]),
                        row("openai.com", [], { status: "none" })]);           // zoox: no task at all
  assert.equal(outcomeOf(r, "OpenAI").outcome, "missed");
  assert.equal(outcomeOf(r, "OpenAI").reason, "none");
  assert.equal(outcomeOf(r, "Zoox").outcome, "missed");
  assert.equal(outcomeOf(r, "Zoox").reason, "no_task");
  assert.deepEqual(r.overall, { known: 3, correct: 1, wrong: 0, missed: 2, precision: 1, recall: 0.3333 });
  assert.equal(r.byAts.lever.recall, 0);
  assert.equal(r.byAts.lever.precision, null, "named nothing: precision is undefined, not 0");
  assert.equal(r.acceptance.pass, false);
});

test("a dry run, an error, and an unsupported vendor are misses, each with its reason", () => {
  const r = scoreJ1(K, [row("stripe.com", [], { status: "dry_run", extra: { dryRun: true } }),
                        row("openai.com", [], { status: "error" }),
                        row("zoox.com", ["https://acme.taleo.net/careersection/2/jobdetail.ftl?job=1"])]);
  assert.deepEqual(r.companies.map(c => [c.outcome, c.reason]), [["missed", "dry_run"], ["missed", "error"], ["missed", "unsupported:taleo"]]);   // icims until A161 made it a source
  assert.equal(r.dryRuns, 1);
  assert.match(formatReport(r), /DRY-RUN/);
});

test("a wrong ATS is WRONG — not a miss — and is listed with what it named", () => {
  const r = scoreJ1(K, [row("stripe.com", ["https://jobs.lever.co/stripe"])]);
  const s = outcomeOf(r, "Stripe");
  assert.equal(s.outcome, "wrong");
  assert.deepEqual(s.named, ["lever/stripe"]);
  assert.equal(r.byAts.greenhouse.wrong, 1);
  assert.equal(r.byAts.greenhouse.precision, 0);
  assert.deepEqual(r.wrong.map(c => c.company), ["Stripe"]);
  assert.match(formatReport(r), /Stripe \(stripe\.com, task \d+\): expected greenhouse\/stripe, named lever\/stripe/);
  assert.equal(r.acceptance.pass, false);
});

test("a wrong slug is wrong, and so is the right pair named beside another (that other would enter the pool)", () => {
  const r = scoreJ1(K, [row("stripe.com", ["https://boards.greenhouse.io/stripe-payments"]),
                        row("openai.com", ["https://jobs.ashbyhq.com/openai", "https://jobs.ashbyhq.com/someone-else"])]);
  assert.equal(outcomeOf(r, "Stripe").outcome, "wrong");
  assert.equal(outcomeOf(r, "OpenAI").outcome, "wrong");
  assert.deepEqual(outcomeOf(r, "OpenAI").named, ["ashby/openai", "ashby/someone-else"]);
});

test("the same pair seen twice (link and API call) is one answer, not two", () => {
  const r = scoreJ1(K, [row("stripe.com", ["https://boards.greenhouse.io/stripe", "https://boards-api.greenhouse.io/v1/boards/stripe/jobs"])]);
  assert.equal(outcomeOf(r, "Stripe").outcome, "correct");
});

test("§7: 90 % recall with zero wrong passes; one wrong answer fails whatever the recall", () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ company: `C${i}`, url: `https://c${i}.example.com`, ats_type: "greenhouse", slug: `c${i}` }));
  const rows = ten.slice(0, 9).map((k, i) => row(`c${i}.example.com`, [`https://boards.greenhouse.io/c${i}`]));
  assert.equal(scoreJ1(ten, rows).acceptance.pass, true);
  const withWrong = [...rows, row("c9.example.com", ["https://boards.greenhouse.io/nope"])];
  assert.equal(scoreJ1(ten, withWrong).acceptance.pass, false);
  assert.equal(scoreJ1(ten, rows.slice(0, 8)).acceptance.pass, false, "80 % is below the bar");
});

// ── the shapes draft holds a run in ─────────────────────────────────────────────────────────────────

test("reads Admin → Crawler's summary ({ tasks }, evidence inline) as well as crawler_tasks rows", () => {
  const summary = { tasks: [{ id: 7, type: "j1_find_board", target_host: "www.stripe.com", status: "done", result_status: "found",
                              evidence: [{ url: "https://boards.greenhouse.io/stripe", how: "iframe" }] }] };
  const r = scoreJ1(K, rowsOf(summary));
  assert.equal(outcomeOf(r, "Stripe").outcome, "correct", "www. is ignored when matching a task to a company");
  assert.equal(outcomeOf(r, "Stripe").taskId, 7);
});

test("a retry supersedes: the newest FINISHED task answers for a host; J2 tasks and other hosts are ignored", () => {
  const rows = [row("stripe.com", ["https://jobs.lever.co/stripe"], { id: 1 }),
                row("stripe.com", ["https://boards.greenhouse.io/stripe"], { id: 2 }),
                { id: 3, type: "j1_find_board", target_host: "stripe.com", status: "queued", input_json: "{}" },
                { ...row("openai.com", ["https://jobs.lever.co/wrong"], { id: 4 }), type: "j2_apply_hop" },
                row("unknown.example.org", ["https://jobs.lever.co/x"], { id: 5 })];
  const r = scoreJ1(K, rows);
  assert.equal(outcomeOf(r, "Stripe").outcome, "correct");
  assert.equal(outcomeOf(r, "Stripe").taskId, 2);
  assert.equal(outcomeOf(r, "OpenAI").reason, "no_task");
  assert.deepEqual(r.unmatchedTasks, ["unknown.example.org"]);
  assert.equal(readRow({ target_host: "x.com", status: "queued" }).finished, false);
});

test("the script scores a crawler_tasks export end to end, and lists the URLs to queue", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d75j1-"));
  try {
    const f = path.join(dir, "j1.json");
    fs.writeFileSync(f, JSON.stringify(KNOWN.map(k => row(new URL(k.url).host, [
      k.ats_type === "greenhouse" ? `https://boards.greenhouse.io/${k.slug}` : k.ats_type === "ashby" ? `https://jobs.ashbyhq.com/${k.slug}` : `https://jobs.lever.co/${k.slug}`]))));
    const script = path.join(root, "scripts", "d75J1Score.mjs");
    const text = execFileSync(process.execPath, [script, "--results", f], { encoding: "utf8" });
    assert.match(text, /OVERALL\s+known\s+\d+\s+correct\s+\d+\s+wrong\s+0\s+missed\s+0/);
    assert.match(text, /ACCEPTANCE .*: PASS/);
    const json = JSON.parse(execFileSync(process.execPath, [script, "--results", f, "--json"], { encoding: "utf8" }));
    assert.equal(json.overall.correct, KNOWN.length);
    const urls = execFileSync(process.execPath, [script, "--urls"], { encoding: "utf8" }).trim().split(/\r?\n/);
    assert.deepEqual(urls, KNOWN.map(k => k.url));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

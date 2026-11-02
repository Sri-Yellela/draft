// D123 · the model-comparison harness (scripts/d123CompareModels.mjs) and the blind check (scripts/d123BlindCheck.mjs),
// run DRY: a fake model, no network, an in-memory board of two synthetic postings, the trial's fictional samples A and B.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { runCompare, parseRoute, openSkipReason } from "../scripts/d123CompareModels.mjs";
import { blindVerdict, verdictMarkdown } from "../scripts/d123BlindCheck.mjs";

const POSTING_SECRET = "Our lighthouse office hosts a pancake breakfast every Friday";
function board() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, normalized_title TEXT, company TEXT, category TEXT,
           description TEXT, description_full TEXT, stack TEXT, seniority TEXT)`);
  const ins = db.prepare("INSERT INTO scraped_jobs VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)");
  const text = (t) => `${t}\n\nRequirements\n- Python, SQL and REST APIs\n- Build and maintain backend services\n\nPreferred\n- Docker\n\n${POSTING_SECRET}.`;
  ins.run("test::job-1", "Software Engineer", "software engineer", "Brightwater Labs", "software", text("Build services."), null);
  ins.run("test::job-2", "Backend Engineer", "backend engineer", "Cobalt Harbor", "software", text("Design APIs."), null);
  return db;
}
const ROUTES = ["full", "lean:haiku", "payload:haiku", "payload:sonnet", "payload:open", "code"];
let run, outDir;
async function once() {
  if (run) return run;
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "d123-compare-"));
  run = await runCompare({ out: outDir, dry: true, db: board(), routes: ROUTES, resumes: ["A", "B"], jobs: ["test::job-1", "test::job-2"],
                           pairs: ["full", "payload:haiku"], env: {}, log: () => {} });
  return run;
}
test.after(() => { if (outDir) fs.rmSync(outDir, { recursive: true, force: true }); });

test("harnessRunsEveryRoute: every (résumé, job, route) is a row; dry rows say so; code calls no model and costs 0", async () => {
  const { results } = await once();
  for (const route of ROUTES.filter(r => r !== "payload:open")) {
    assert.equal(results.filter(r => r.route === route).length, 4, route);
  }
  assert.ok(results.every(r => r.dry === true));
  const failed = results.filter(r => !r.ok);
  assert.deepEqual(failed.map(r => `${r.route} ${r.error?.code} ${r.error?.message}`), [], "every dry run succeeds");
  for (const r of results.filter(r => r.route === "code")) {
    assert.equal(r.cost, 0); assert.equal(r.modelCalled, false); assert.deepEqual(r.usage, []);
  }
  for (const r of results.filter(r => r.route !== "code")) {
    assert.ok(r.cost > 0, `${r.route} is priced`); assert.equal(r.guardPass, true); assert.equal(r.validJson, true);
    assert.ok(Number.isFinite(r.ms));
  }
  assert.ok(results.filter(r => r.route === "payload:sonnet" && r.modelCalled).every(r => /sonnet/.test(r.modelUsed)));
  const saved = JSON.parse(fs.readFileSync(path.join(outDir, "results.json"), "utf8"));
  assert.equal(saved.results.length, results.length);
  assert.ok(Object.values(saved.gistCosts).every(g => g.gists >= 1), "gists built once per résumé");
  assert.match(fs.readFileSync(path.join(outDir, "summary.md"), "utf8"), /\| payload:haiku \| 4 \|/);
});

test("harnessOpenSkippedWithoutKeys: an :open route with no provider configured is skipped with its reason, never a failed run", async () => {
  const { skipped, results } = await once();
  assert.deepEqual(skipped.map(s => s.route), ["payload:open"]);
  assert.equal(results.filter(r => r.route === "payload:open").length, 0);
  assert.match(openSkipReason({}, false), /RM_OPENAI_COMPAT_BASE_URL, RM_OPENAI_COMPAT_API_KEY, RM_OPEN_MODEL/);
  assert.equal(openSkipReason({ RM_OPENAI_COMPAT_BASE_URL: "https://x", RM_OPENAI_COMPAT_API_KEY: "k", RM_OPEN_MODEL: "m" }, false), null);
  assert.throws(() => parseRoute("code:haiku"), /takes no model/);
  assert.throws(() => parseRoute("payload:gpt"), /haiku, sonnet or open/);
  await assert.rejects(runCompare({ out: path.join(process.cwd(), "tmp-compare-out"), dry: true, db: board(), log: () => {} }), /inside the repository/);
});

test("harnessCountsOnly: results.json and summary.md carry no résumé or posting text; the pairs name no route", async () => {
  await once();
  const sample = JSON.parse(fs.readFileSync("content/trial/sample-a.json", "utf8"));
  const bullet = sample.resumeText.split(/\r?\n/).find(l => /^[-•]\s+\S/.test(l)).replace(/^[-•]\s+/, "").slice(0, 40);
  for (const f of ["results.json", "summary.md", "blind-key.json"]) {
    const s = fs.readFileSync(path.join(outDir, f), "utf8");
    assert.ok(!s.includes(POSTING_SECRET), `${f} carries posting text`);
    assert.ok(!s.includes(bullet), `${f} carries résumé text`);
  }
  const pairs = fs.readdirSync(path.join(outDir, "blind")).filter(f => /^pair-\d+\.html$/.test(f));
  assert.equal(pairs.length, 4);
  for (const f of pairs) {
    const html = fs.readFileSync(path.join(outDir, "blind", f), "utf8");
    assert.doesNotMatch(html, /payload|haiku|sonnet|lean|full call|¢/i, `${f} names a route`);
    assert.match(html, /Left/); assert.match(html, /Right/);
  }
  assert.match(fs.readFileSync(path.join(outDir, "blind", "index.html"), "utf8"), /picks\.json/);
});

test("p6gBlindCheckRecorded: the key unblinds the picks, and the rule is ≥ 70 % wins-or-ties at a median ≤ 1¢", async () => {
  await once();
  const keyFile = JSON.parse(fs.readFileSync(path.join(outDir, "blind-key.json"), "utf8"));
  assert.deepEqual(keyFile.pairs, ["full", "payload:haiku"]);
  const ids = Object.keys(keyFile.key);
  for (const id of ids) assert.deepEqual(new Set([keyFile.key[id].left, keyFile.key[id].right]), new Set(["full", "payload:haiku"]));
  const sideOfNew = (id) => (keyFile.key[id].left === "payload:haiku" ? "left" : "right");
  const other = (s) => (s === "left" ? "right" : "left");
  // 2 wins, 1 tie, 1 loss = 75 %.
  const picks = { [ids[0]]: sideOfNew(ids[0]), [ids[1]]: sideOfNew(ids[1]), [ids[2]]: "tie", [ids[3]]: other(sideOfNew(ids[3])) };
  const v = blindVerdict(keyFile, picks, "payload:haiku");
  assert.deepEqual([v.wins, v.ties, v.losses, v.judged], [2, 1, 1, 4]);
  assert.equal(v.oldRoute, "full");
  assert.ok(v.medianCost != null && v.medianCost <= 0.01, "the dry payload is priced under 1¢");
  assert.equal(v.pass, true);
  const lose = blindVerdict(keyFile, Object.fromEntries(ids.map(id => [id, other(sideOfNew(id))])), "payload:haiku");
  assert.equal(lose.pass, false);
  const unpriced = blindVerdict({ pairs: ["full", "payload:open"], key: { "pair-01": { left: "payload:open", right: "full", cost: { "payload:open": null, full: 0.1 } } } }, { "pair-01": "left" });
  assert.equal(unpriced.pass, false, "unknown cost is not cheap");
  assert.match(verdictMarkdown(v), /2 wins · 1 ties · 1 losses.*PASS/s);
});

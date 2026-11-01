// ⛔ D81 · THE GOOGLE JOBS SWEEP — a CS-only query plan for the D20 harvester. Each red when removed:
// the default plan holds no out-of-scope family · two cities for one title are TWO queries, searched with their
// place, and run-tracked apart · serpSearch sends the place, sends `chips` only when asked, and the hl/gl pin
// survives any caller · the export carries the probe's numbers (in-scope roles, recency) · the dry run spends
// nothing (test/d20SlugHarvest.test.js "a sweep is dry first" holds that, unchanged).
import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { HARVEST_QUERIES, queryKey, planSweep, openSweep, runSweep, buildExport, serpSearch, familyConversion, probeValidate } from "../services/slugHarvest.js";

const OUT = ["product", "design", "marketing", "sales", "finance", "hr"];

test("⛔ D81: the default plan is CS only — no out-of-scope family, 99 searches, every key distinct", () => {
  assert.equal(HARVEST_QUERIES.length, 99);
  for (const x of HARVEST_QUERIES) assert.ok(!OUT.includes(x.family), `${queryKey(x)} is in the out-of-scope family "${x.family}"`);
  assert.doesNotMatch(HARVEST_QUERIES.map((x) => x.q).join("|"), /product manager|designer|marketing|account executive|financial analyst|recruiter/i);
  assert.equal(new Set(HARVEST_QUERIES.map(queryKey)).size, HARVEST_QUERIES.length, "two cities for one title must not collapse into one");
  assert.ok(HARVEST_QUERIES.filter((x) => x.q === "data engineer").length > 1, "the plan does carry one title in several places");
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}

test("⛔ D81: two cities for one title are two searches, sent with their place, tracked apart", async () => {
  const db = db0();
  const plan = planSweep(db, { queries: ["data engineer", "data engineer @ Washington, DC"] });
  assert.deepEqual(plan.queries.map(queryKey), ["data engineer", "data engineer @ Washington, DC"]);
  const id = openSweep(db, { queries: plan.queries });
  const sent = [];
  await runSweep(db, id, { search: async (q, location) => { sent.push([q, location]); return { jobs_results: [] }; }, validate: async () => ({ ok: true, state: "empty" }) });
  assert.deepEqual(sent, [["data engineer", "United States"], ["data engineer", "Washington, DC"]]);
  assert.equal(familyConversion(db).find((f) => f.family === "data_eng").searches, 2, "both count for the title's family");
  db.prepare("UPDATE slug_harvest_sweeps SET started_at = started_at - 86400 * 2").run();   // yesterday: today's cap is free
  const p2 = planSweep(db);
  const queue = [...p2.queries.map(queryKey), ...p2.skipped.filter((x) => /cap/.test(x.reason)).map((x) => x.q)];
  const pos = (k) => queue.indexOf(k);
  // Keyed by title + place: running the nationwide search and DC moves THOSE two back — and only those.
  assert.ok(pos("data engineer @ Seattle, WA") >= 0 && pos("data engineer @ Seattle, WA") < pos("data engineer"),
    "an unrun city of the same title still comes before the title that ran");
});

test("⛔ D81: serpSearch sends the place, sends chips only when asked, and the hl/gl pin survives", async () => {
  const saved = axios.get;
  const seen = [];
  axios.get = async (url, opts) => { seen.push(opts.params); return { data: {} }; };
  try {
    await serpSearch("backend engineer");
    await serpSearch("backend engineer", "Austin, TX", { chips: "date_posted:month" });
  } finally { axios.get = saved; }
  assert.deepEqual([seen[0].location, seen[0].chips, seen[0].num, seen[0].start], ["United States", "date_posted:week", undefined, undefined],
    "D81: chips is on by default (the 10-08 experiment); num / start never");
  assert.deepEqual([seen[1].location, seen[1].chips, seen[1].hl, seen[1].gl], ["Austin, TX", "date_posted:month", "en", "us"]);
});

test("⛔ D81: a new pair is validated by the D80 probe, and the export carries in-scope roles and recency", async () => {
  const db = db0();
  const id = openSweep(db, { queries: [{ q: "backend engineer", family: "eng_backend" }] });
  const recent = new Date(Date.now() - 10 * 86400000).toISOString();
  const fetchers = { greenhouse: async () => [
    { title: "Senior Backend Engineer", location: "Austin, TX", description: "Build APIs in Go.", url: "https://x/1", company: "Acme", posted_at: recent },
    // D126 + D127 (11-01, changed on purpose): an account executive is in scope now (sales); a support engineer is held.
    { title: "Support Engineer", location: "Austin, TX", description: "Answer tickets.", url: "https://x/2", company: "Acme", posted_at: recent },
  ] };
  const results = { jobs_results: [{ apply_options: [{ link: "https://boards.greenhouse.io/acmeco/jobs/123" }] }] };
  await runSweep(db, id, { search: async () => results, validate: probeValidate, fetchers });
  const { rows } = buildExport(db);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].slug, rows[0].in_scope_recent, rows[0].in_scope_open, rows[0].pct_120d], ["acmeco", 1, 1, 100],
    "the owner decides add / skip on evidence, not on a slug");
});

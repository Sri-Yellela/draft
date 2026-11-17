// ⭐ D178-3 (owner's pick 11-07) · readiness for a role — d178ReadinessCountsProvenOnly · d178ReadinessWeightsByPostingShare ·
// d178ThinRoleShowsNoPercent · d178NeverCalledExpertise. Synthetic skills and shares.
// ⭐ A228 (46r, owner 11-16 "Build it"): the CLIENT views — For a role (RoleReadiness.jsx, its dial roleReadinessModel.js) and
// Compare roles (CompareRoles.jsx) — are retired (Your map, the skill map, answers them); their pins went with them. The
// server reading stays (the daily question, the metrics list and the Profile read roleReadiness / subcategoryReadiness).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readinessOf, tierOf, READINESS } from "../services/atlas/roleReadiness.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const top = [
  { slug: "sql", name: "SQL", share: 80 }, { slug: "python", name: "Python", share: 70 },
  { slug: "spark", name: "Spark", share: 40 }, { slug: "airflow", name: "Airflow", share: 10 },
];

test("d178ReadinessCountsProvenOnly: only proven skills count; claims are shown apart as 'waiting'", () => {
  const r = readinessOf(top, new Map([["sql", "proven"], ["python", "claimed"]]));
  assert.equal(r.ready, 40, "SQL's 80 of the 200 total");
  assert.equal(r.waiting, 35, "Python's 70 — waiting until proven");
  assert.equal(readinessOf(top, new Map([["sql", "claimed"], ["python", "claimed"]])).ready, 0, "claims alone are 0% ready");
  assert.deepEqual(r.moves.map(m => [m.slug, m.action]), [["python", "prove"], ["spark", "learn"], ["airflow", "learn"]], "claimed → Prove it; missing → Learn it");
});

test("d178ReadinessWeightsByPostingShare: each skill weighs by its share of the role's postings; tiers by share", () => {
  const a = readinessOf(top, new Map([["sql", "proven"]])), b = readinessOf(top, new Map([["airflow", "proven"]]));
  assert.ok(a.ready > b.ready, "proving the most-asked skill moves readiness more");
  assert.deepEqual(a.moves.map(m => m.adds), [35, 20, 5], "what each would add, largest first");
  assert.deepEqual(top.map(s => tierOf(s.share)), ["must", "must", "common", "nice"]);
  assert.deepEqual([READINESS.MUST, READINESS.COMMON], [60, 30]);
  assert.deepEqual([a.tiers.must.have, a.tiers.must.of], [1, 2]);
  assert.equal(readinessOf([], new Map()).ready, 0);
});

test("d178ThinRoleShowsNoPercent: under the minimum postings, no % — 'not enough postings yet'", () => {
  assert.equal(READINESS.MIN_POSTINGS, 30);
  const svc = read("services/atlas/roleReadiness.js");
  assert.match(svc, /if \(f\.role\.postings < READINESS\.MIN_POSTINGS\) return \{ \.\.\.base, thin: true, line: "Not enough postings yet to say how ready you are\." \};/);
});

test("d178NeverCalledExpertise: 'ready', never 'expertise' or a guarantee; the scope is shown", () => {
  for (const f of ["services/atlas/roleReadiness.js"]) {
    const src = read(f).replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(src, /expertise|guarantee|certif/i, f);
  }
  assert.match(read("services/atlas/roleReadiness.js"), /line: `from \$\{f\.role\.postings\} live posting/);
});

test("d178CompareRoles (Idea E): the skills-by-role grid and the skill that lifts the most roles", async () => {
  const { compareFrom } = await import("../services/atlas/roleReadiness.js");
  const mk = (slug, name, skills) => ({ found: true, thin: false, role: { slug, name, postings: 100 }, ...readinessOf(skills, new Map([["sql", "proven"], ["python", "claimed"]])) });
  const c = compareFrom([
    mk("de", "Data Engineer", [{ slug: "sql", name: "SQL", share: 80 }, { slug: "python", name: "Python", share: 70 }, { slug: "spark", name: "Spark", share: 40 }]),
    mk("ds", "Data Scientist", [{ slug: "python", name: "Python", share: 85 }, { slug: "stats", name: "Statistics", share: 60 }]),
    mk("be", "Backend Engineer", [{ slug: "python", name: "Python", share: 40 }, { slug: "sql", name: "SQL", share: 50 }]),
    { found: false, reason: "unknown_role" },
  ]);
  assert.deepEqual(c.lifts, { slug: "python", name: "Python", roles: 3, of: 3, state: "claimed" }, "Python is in all three roles and only claimed");
  assert.deepEqual(c.grid[0].shares, { de: 70, ds: 85, be: 40 });
  assert.equal(c.roles.length, 4, "an unknown role stays in the list, said as such");
  assert.equal(compareFrom([mk("de", "DE", [{ slug: "x", name: "X", share: 50 }])]).lifts, null, "one role lifts nothing 'at once'");
});

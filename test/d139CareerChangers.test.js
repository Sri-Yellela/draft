import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { navigatorFor, setAim, changerMove, NAVIGATOR } from "../services/navigator.js";

// ⭐ D139 (owner 11-02) · CAREER CHANGERS — translating skills across fields. Synthetic roles, postings and people.

const NOW = Math.floor(Date.now() / 1000);
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, n] of [["skill", "Python"], ["skill", "SQL"], ["tool", "Excel"], ["tool", "Tableau"], ["tool", "Airflow"],
    ["skill", "process improvement"], ["skill", "capacity planning"], ["skill", "forecasting"],
    ["role", "Data Analyst"], ["role", "Data Engineer"], ["role", "Operations Analyst"]]) {
    upsertNode(db, { kind, name: n, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE name = ?`).pluck().get(n), "published");
  }
  let j = 0;
  const post = (title, text, n) => {
    for (let i = 0; i < n; i++) {
      const id = `j${++j}`;
      db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,discovered_at) VALUES (?,?,?,?,?,?,?,1,?)`)
        .run(id, title, `Co${j % 4}`, `https://x.test/${id}`, "t", `h${id}`, text, NOW - 2 * 86400);
    }
  };
  post("Data Analyst", "SQL, Excel and Tableau dashboards; some Python.", 8);
  post("Data Engineer", "Python, SQL and Airflow pipelines.", 8);
  post("Operations Analyst", "Process improvement and capacity planning with Excel, SQL and forecasting.", 8);
  computeAtlasStats(db);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x')").run();
  db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active) VALUES (1,'Data Analyst','x','x','["Data Analyst"]',1)`).run();
  for (const s of ["SQL", "Python", "Tableau", "Excel"]) db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (1, ?)").run(s);
  return db;
}

test("D139 · d139CrossCategoryDestinations — roles in OTHER fields, ranked by what transfers; never the user's own field", () => {
  const n = navigatorFor(world(), 1);
  assert.ok(n.elsewhere.length >= 1, JSON.stringify(n.elsewhere));
  const ops = n.elsewhere.find(e => e.slug === "operations-analyst");
  assert.ok(ops, "Operations Analyst is in another field");
  assert.match(ops.line, /^Data Analyst → Operations Analyst: you have \d+ of \d+ skills · \d+ open postings$/);
  assert.ok(!n.elsewhere.some(e => e.slug === "data-engineer"), "the user's own field is the navigator's, not a change");
});

test("D139 · d139OverlapNamedInDestinationTerms — what transfers is the destination's own skill names", () => {
  const n = navigatorFor(world(), 1);
  const ops = n.elsewhere.find(e => e.slug === "operations-analyst");
  assert.ok(ops.transferable.includes("Excel") && ops.transferable.includes("SQL"), ops.transferable.join(","));
  assert.match(ops.framing, /^Lead with .+ — named the way Operations Analyst postings name them\.$/);
});

test("D139 · d139FramingStaysTruthful — the framing and the questions use only skills the user has", () => {
  const m = changerMove({ from: "Logistics Coordinator", to: { slug: "ops", name: "Operations Analyst", covered: 2, of: 12, postings: 120, payDelta: 14000 },
    have: [{ name: "SQL" }, { name: "Excel" }], missing: [{ name: "Tableau" }, { name: "process improvement" }] });
  assert.equal(m.line, "Logistics Coordinator → Operations Analyst: you have 2 of 12 skills · ≈ $14k more · 120 open postings");
  assert.equal(m.framing, "Lead with SQL, Excel — named the way Operations Analyst postings name them.");
  for (const said of [m.framing, ...m.interview]) assert.doesNotMatch(said, /Tableau|process improvement/, said);
  assert.deepEqual(m.gaps, ["Tableau", "process improvement"], "the gaps are named as gaps, not as claims");
  assert.deepEqual(m.interview, ["Why are you moving from Logistics Coordinator to Operations Analyst?",
    "Tell me about a time you used SQL in your work as a Logistics Coordinator.", "What would you need to learn in your first 90 days as an Operations Analyst?"]);
  assert.equal(changerMove({ from: "X", to: { slug: "y", name: "Y", covered: 0, of: 10, postings: 5 }, have: [], missing: [] }).framing, null, "nothing to lead with, nothing said");
});

test("D139 · every stage changes for a changer: an aim in another field makes the route a changer's, with its interview", () => {
  const db = world();
  const n = setAim(db, 1, "operations-analyst");
  assert.equal(n.changer.to, "Operations Analyst");
  assert.equal(n.destination.aim.line, n.changer.line);
  assert.ok(n.route.skills.every(s => n.changer.gaps.includes(s.name)), "the route closes the change's gaps");
  assert.equal(n.changer.interview[0], "Why are you moving from Data Analyst to Operations Analyst?");
  assert.equal(setAim(db, 1, "data-engineer").changer, null, "a move within the field is not a change of field");
  const ui = read("client/src/pages/atlas/Navigator.jsx");
  assert.match(ui, /data-navigator-changer=""/);
  assert.match(ui, /data-navigator-elsewhere=""/);
  assert.ok(NAVIGATOR.CHANGER_MIN_REACH <= NAVIGATOR.MIN_REACH);
});

test("D139 · O*NET's relatedness is recorded as measured and not used (the board's SOC codes are too coarse to join)", () => {
  assert.match(read("services/navigator.js"), /O\*NET's Related Occupations \(29\.3, CC BY 4\.0\) was measured for the ranking and NOT used/);
});

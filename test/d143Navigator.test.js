import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { navigatorFor, setAim, rankDestinations, routeChanges, aimRoleFor, NAVIGATOR } from "../services/navigator.js";
import { bestBetSignalsFor } from "../services/bestBets.js";

// ⭐ D143 (owner 11-02) · THE NAVIGATOR — a destination, a route, progress and re-routing. Synthetic roles, postings, people.

const DAY = 86400;
const NOW = Math.floor(Date.now() / 1000);
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, n] of [["skill", "Python"], ["skill", "SQL"], ["tool", "Airflow"], ["tool", "dbt"], ["tool", "Tableau"],
    ["tool", "Excel"], ["tool", "Kubernetes"], ["role", "Data Engineer"], ["role", "Data Analyst"], ["role", "Software Engineer"]]) {
    upsertNode(db, { kind, name: n, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE name = ?`).pluck().get(n), "published");
  }
  let j = 0;
  db.post = (title, text, n, { at = NOW - 2 * DAY } = {}) => {
    for (let i = 0; i < n; i++) {
      const id = `j${++j}`;
      db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,discovered_at) VALUES (?,?,?,?,?,?,?,1,?)`)
        .run(id, title, `Co${j % 4}`, `https://x.test/${id}`, "t", `h${id}`, text, at);
    }
  };
  db.post("Data Engineer", "We use Python, SQL and Airflow daily. dbt helps.", 8);
  db.post("Data Analyst", "SQL, Excel and Tableau dashboards; some Python.", 8);
  db.post("Software Engineer", "Python, Kubernetes and SQL services.", 8);
  computeAtlasStats(db);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x')").run();
  db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active) VALUES (1,'Data Analyst','x','x','["Data Analyst"]',1)`).run();
  for (const s of ["SQL", "Python", "Tableau", "Excel"]) db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (1, ?)").run(s);
  return db;
}

test("D143 · d143RecommendsWithReasons — one or two destinations, each with the reasons a person can check", () => {
  const n = navigatorFor(world(), 1);
  assert.equal(n.ready, true);
  assert.equal(n.current.name, "Data Analyst");
  assert.ok(n.destination.recommended.length >= 1 && n.destination.recommended.length <= NAVIGATOR.RECOMMEND);
  const top = n.destination.recommended[0];
  assert.match(top.line, /^Most reachable step up: .+ — you cover \d+ of \d+ skills · 8 new postings this week$/);
  assert.ok(!n.destination.recommended.some(r => r.slug === "data-analyst"), "the current role is never its own destination");
  assert.equal(n.destination.aim.setBy, "recommended");
});

test("D143 · d143AlternativesShown — ranked by reach, then new postings, then pay; the person decides", () => {
  const r = rankDestinations([
    { slug: "a", name: "A", covered: 3, of: 15, postings: 50, newThisWeek: 40 },
    { slug: "b", name: "B", covered: 9, of: 15, postings: 30, newThisWeek: 30, payMedian: 160000 },
    { slug: "c", name: "C", covered: 9, of: 15, postings: 30, newThisWeek: 2 },
    { slug: "tiny", name: "Tiny", covered: 15, of: 15, postings: 2, newThisWeek: 2 },
    { slug: "me", name: "Me", covered: 15, of: 15, postings: 80, newThisWeek: 9 },
  ], { slug: "me", payMedian: 140000 });
  assert.deepEqual(r.map(x => x.slug), ["b", "c", "a"], "the current role and a role with too few postings are no destinations");
  assert.equal(r[0].line, "Most reachable step up: B — you cover 9 of 15 skills · ≈ $20k more · 30 new postings this week");
  assert.match(r[2].line, /^Also reachable: A/);
});

test("D143 · d143RouteHasSkillsAndBridgeRoles — the skills in the order postings ask, with Learn; and roles to apply to now", () => {
  const n = navigatorFor(world(), 1);
  assert.ok(n.route.skills.length >= 1);
  const shares = n.route.skills.map(s => s.share);
  assert.deepEqual([...shares].sort((a, b) => b - a), shares, "most asked first");
  assert.match(n.route.line, /, ≈ \d+ weeks$/);
  assert.ok(n.bridges.some(b => b.slug === "data-analyst"), "keep applying where you already fit");
  assert.ok(n.bridges.every(b => b.covered / b.of >= NAVIGATOR.BRIDGE_MIN_REACH));
  assert.match(n.next.text, /^Next on your route to /);
});

test("D143 · the user's own aim is kept; an unknown role is refused; null follows the recommendation again", () => {
  const db = world();
  const mine = setAim(db, 1, "data-engineer");
  assert.equal(mine.destination.aim.slug, "data-engineer");
  assert.equal(mine.destination.aim.setBy, "user");
  assert.equal(navigatorFor(db, 1).destination.aim.slug, "data-engineer", "kept");
  assert.throws(() => setAim(db, 1, "astronaut"), /not a role/);
  assert.equal(setAim(db, 1, null).destination.aim.setBy, "recommended");
  assert.deepEqual(aimRoleFor(db, 1)?.name != null, true, "the route's role is the aim D136 reads");
});

test("D143 · d143WeeklyProgress — applications, replies and route skills done, this week", () => {
  const db = world();
  for (const [job, at, reply] of [["j1", NOW - 2 * DAY, null], ["j2", NOW - 3 * DAY, NOW - DAY], ["j3", NOW - 20 * DAY, null]]) {
    db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, first_response_at) VALUES (1, ?, 'Co', 'Data Engineer', ?, ?)`).run(job, at, reply);
  }
  const p = navigatorFor(db, 1).progress;
  assert.equal(p.applications, 2);
  assert.equal(p.replies, 1);
  assert.match(p.line, /^This week: 2 applications sent · 1 reply · 0 of \d+ route skills done$/);
});

test("D143 · d143ReroutesWithReason — a skill the market added, one the user now has, and where the replies are", () => {
  // pure: added / rising / done / dropped, each with its reason
  const before = { skills: [{ slug: "spark", name: "Spark", share: 30 }, { slug: "airflow", name: "Airflow", share: 20 }, { slug: "dbt", name: "dbt", share: 15 }] };
  const after = { skills: [{ slug: "spark", name: "Spark", share: 45 }, { slug: "kafka", name: "Kafka", share: 25 }], covered: ["airflow"] };
  assert.deepEqual(routeChanges(before, after, "Data Engineer").map(c => [c.kind, c.text]), [
    ["rising", "Spark is rising: now asked in 45 % of Data Engineer postings (was 30 %)"],
    ["added", "Kafka is now asked in 25 % of Data Engineer postings — added to your route"],
    ["done", "You have Airflow now — your route is shorter"],
    ["dropped", "dbt is asked less often in Data Engineer postings — taken off your route"],
  ]);
  // integration: a skill the user learns leaves the route, with the reason kept
  const db = world();
  setAim(db, 1, "data-engineer");
  const first = navigatorFor(db, 1);
  const learnt = first.route.skills[0];
  db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (1, ?)").run(learnt.name);
  const second = navigatorFor(db, 1);
  assert.ok(second.changes.some(c => c.kind === "done" && c.slug === learnt.slug), JSON.stringify(second.changes));
  assert.equal(second.progress.routeDone, 1, "progress counts against the route as it was set");
  // replies elsewhere → a suggestion to aim there
  const se = db.prepare(`SELECT sj.job_id FROM scraped_jobs sj WHERE sj.title = 'Software Engineer' LIMIT 2`).pluck().all();
  for (const job of se) db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, first_response_at) VALUES (1, ?, 'Co', 'Software Engineer', ?, ?)`).run(job, NOW - 9 * DAY, NOW - 5 * DAY);
  const third = navigatorFor(db, 1);
  assert.equal(third.suggest?.slug, "software-engineer");
  assert.match(third.suggest.text, /^You're getting replies for Software Engineer \(2 in 60 days\) — aim there first\?$/);
});

test("D143 · D136's aim signal: a posting on the user's route gets the reason", () => {
  const db = world();
  setAim(db, 1, "data-engineer");
  const de = db.prepare(`SELECT job_id FROM scraped_jobs WHERE title = 'Data Engineer' LIMIT 1`).pluck().get();
  const da = db.prepare(`SELECT job_id FROM scraped_jobs WHERE title = 'Data Analyst' LIMIT 1`).pluck().get();
  assert.deepEqual(bestBetSignalsFor(db, { userId: 1, job: { id: de } }).aim, { text: "on your route to Data Engineer" });
  assert.equal(bestBetSignalsFor(db, { userId: 1, job: { id: da } }).aim, null);
});

test("D143 · surfaces: the navigator is first on the Atlas home and the D120 line is its fallback; routes are the user's own", () => {
  // ⭐ A228 (46r, moved on purpose): the Atlas home that put the navigator first (YourMap.jsx AtlasHome) is retired; the
  // navigator is Your route's panel (AtlasPanels.jsx), drawn under Your map's "Your route, step by step".
  assert.match(read("client/src/pages/atlas/AtlasPanels.jsx"), /<Navigator base=\{base\} fallback=/);
  const nav = read("client/src/pages/atlas/Navigator.jsx");
  assert.match(nav, /if \(!nav\?\.ready\) return fallback;/);
  assert.match(nav, /data-navigator-next=""/);
  const guard = read("test/authRouteGuardManifest.test.js");
  assert.match(guard, /"GET \/api\/navigator",/);
  assert.match(guard, /"PUT \/api\/navigator\/aim",/);
  assert.match(read("services/accountService.js"), /navigator_routes: "keepInto",/);
});

test("D143 · no current role → not ready, with what to do", () => {
  const db = world();
  db.prepare("DELETE FROM domain_profiles").run();
  const n = navigatorFor(db, 1);
  assert.equal(n.ready, false);
  assert.equal(n.reason, "no_current_role");
});

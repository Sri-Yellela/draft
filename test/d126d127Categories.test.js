import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { categoryOf, profileCategory, categoryReport, CATEGORIES, CATEGORY_CONFIDENCE_FLOOR } from "../services/jobs/professionalScope.js";
import { scopeGate, backfillCategories, HELD_CATEGORY } from "../services/jobs/boardScope.js";
import { readPolicy, setPolicy } from "../services/jobs/boardAge.js";

// ⛔ D126 + D127 (owner 11-01): every professional role, each in ONE category; nothing shown from an unknown one.
// A recorded reversal of D78 B. Titles are real-shaped (several from the local board's spot-check, 11-01); no person.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const cat = (title, roleKey = null) => categoryOf({ title, roleKey });

// The labelled fixture for the leak rate: [title, family, expected category or "held"].
const LABELLED = [
  ["Senior Software Engineer, Payments", "engineering", "computing"],
  ["Data Scientist, Growth", "data", "computing"],
  ["Machine Learning Engineer", "engineering", "computing"],
  ["Site Reliability Engineer", "engineering", "computing"],
  ["Software Quality Assurance Engineer", "general", "computing"],
  ["Technical Program Manager, Infrastructure", "pm", "computing"],
  ["Mechanical Engineer, Hardware Systems", "general", "engineering"],
  ["Electrical Engineer, Robotics", "general", "engineering"],
  ["Civil Engineer II", null, "engineering"],
  ["Structural Engineer", null, "engineering"],
  ["Chemical Process Engineer", null, "engineering"],
  ["Manufacturing Engineer, Motors & Actuators", "operations", "engineering"],
  ["Aerospace Engineer, Propulsion", null, "engineering"],
  ["Biomedical Engineer", null, "engineering"],
  ["RTL Design Engineer", "general", "engineering"],
  ["Quality Engineer, Rack Infrastructure", "operations", "engineering"],
  ["Hardware Systems Architect", "general", "engineering"],
  ["Project Engineer, Construction", null, "engineering"],
  ["Senior Product Manager, AI", "pm", "management"],
  ["Staff Product Manager, Growth", "pm", "management"],
  ["Staff Product Manager, Stripe Tax", "pm", "management"],
  ["Operations Manager", "operations", "management"],
  ["Credit Operations Manager", "operations", "management"],
  ["Financial Analyst", "finance", "business"],
  ["Business Analyst", null, "business"],
  ["Senior Accountant", "finance", "business"],
  ["Senior Recruiter", "hr", "business"],
  ["Employee Relations Business Partner", "hr", "business"],
  ["Procurement Specialist", "operations", "business"],
  ["Commercial Counsel", "legal", "legal"],
  ["Paralegal", null, "legal"],
  ["Account Executive, Mid-Market", "sales", "sales"],
  ["Sales Development Representative", "sales", "sales"],
  ["Customer Success Manager", "sales", "sales"],
  ["Product Marketing Manager", "marketing", "marketing"],
  ["Growth Marketing Manager", "marketing", "marketing"],
  ["Product Marketing Manager, IT Admin and Governance", "marketing", "marketing"],
  ["Senior Product Designer", "design", "arts_media"],
  ["Technical Writer", null, "arts_media"],
  ["UX Researcher", "design", "arts_media"],
  ["Economist", null, "science"],
  ["Research Scientist, Biology", null, "science"],
  ["Statistician", null, "computing"],
  // held
  ["Registered Nurse, ICU", null, "held"],
  ["High School Math Teacher", null, "held"],
  ["Executive Assistant", "hr", "held"],
  ["Social Worker", null, "held"],
  ["Engineering Technician", "general", "held"],
  ["CAD Drafter", null, "held"],
  ["Field Service Engineer", "general", "held"],
  ["Sales Engineer", "sales", "held"],
  ["Solutions Architect", "engineering", "held"],
  ["IT Support Specialist", "general", "held"],
  ["Support Engineer", "general", "held"],
  ["Cashier", null, "held"],
  ["Integration Engineer, Professional Services", "general", "held"],
  ["Strategic Pursuits Lead, RevOps", "sales", "held"],
  ["Outcomes Architect", "general", "held"],
];

test("d127LeakRateZeroOnFixture: every labelled title lands where it is labelled — 0 shown in the wrong category", () => {
  const wrong = LABELLED.filter(([t, f, want]) => { const v = cat(t, f); return (v.inScope ? v.category : "held") !== want; })
    .map(([t, f, want]) => `${t} [${f}] → ${JSON.stringify(cat(t, f))}, want ${want}`);
  assert.deepEqual(wrong, []);
  const shownWrong = LABELLED.filter(([t, f, want]) => { const v = cat(t, f); return v.inScope && v.category !== want; });
  assert.equal(shownWrong.length, 0, "the leak rate");
});

test("d127EveryShownPostingHasCategory: a shown verdict always names a known category, an occupation and a confidence ≥ the floor", () => {
  for (const [t, f] of LABELLED) {
    const v = cat(t, f);
    if (!v.inScope) { assert.equal(v.category, null); assert.match(v.reason, /^held:/); continue; }
    assert.ok(CATEGORIES[v.category], `${t}: ${v.category}`);
    assert.ok(v.soc, t);
    assert.ok(v.confidence >= CATEGORY_CONFIDENCE_FLOOR, t);
  }
});

test("d126CsGateLifted + d126DisciplineClassified: non-CS engineering is IN, each with its discipline", () => {
  assert.deepEqual([cat("Mechanical Engineer").category, cat("Mechanical Engineer").discipline], ["engineering", "mechanical"]);
  assert.equal(cat("Electrical Engineer, Robotics").discipline, "electrical");
  assert.equal(cat("Civil Engineer II").discipline, "civil");
  assert.equal(cat("Manufacturing Engineer").discipline, "industrial");
  assert.equal(cat("Aerospace Engineer, Propulsion").discipline, "aerospace");
  // and computing is D78 B's own rule, unchanged
  assert.equal(cat("Backend Engineer", "engineering").category, "computing");
});

test("d126PendingRolesHeld + d127HeldCategoriesExcluded: the owner's undecided groups are held, with their reason", () => {
  for (const t of ["Engineering Technician", "CAD Drafter", "Field Service Engineer", "Sales Engineer"]) assert.equal(cat(t).reason, "held:pending_engineering_role", t);
  assert.equal(cat("Registered Nurse").reason, "held:healthcare");
  assert.equal(cat("Math Teacher").reason, "held:education");
  assert.equal(cat("Administrative Assistant").reason, "held:office_admin");
  assert.equal(cat("Social Worker").reason, "held:community_service");
  // the traps the spot-check found: these are professional, not held
  for (const t of ["Device Driver Engineer", "Data Warehouse Engineer", "Delivery Manager", "Gene Therapy Scientist"]) {
    assert.ok(cat(t, "engineering").inScope || cat(t).inScope, t);
  }
});

test("d126NonEngineeringStillOut: non-professional work is held", () => {
  for (const t of ["Cashier", "Barista", "Retail Sales Associate"]) assert.equal(cat(t).inScope, false, t);
});

test("d127LowConfidenceHeld: a family with no title signal is held as low confidence, never placed by the family alone", () => {
  const v = cat("Strategic Pursuits Lead, RevOps", "sales");
  assert.deepEqual([v.inScope, v.reason], [false, "held:low_confidence"]);
  assert.ok(v.confidence < CATEGORY_CONFIDENCE_FLOOR);
  assert.equal(cat("Outcomes Architect", null).reason, "held:unknown");
});

test("d127UserSeesOwnCategoryByDefault: a profile's category comes from its titles by the same rule; the board matches it", () => {
  assert.equal(profileCategory({ role_family: "engineering", target_titles: ["Software Engineer"] }), "computing");
  assert.equal(profileCategory({ role_family: "engineering", target_titles: JSON.stringify(["Mechanical Engineer"]) }), "engineering");
  assert.equal(profileCategory({ role_family: "finance", target_titles: ["Financial Analyst"] }), "business");
  assert.equal(profileCategory({ role_family: "pm", target_titles: [], profile_name: "Product Manager" }), "management");
  assert.equal(profileCategory({ role_family: "data" }), "computing", "no titles: the family's default");
  const server = read("server.js");
  assert.match(server, /const boardCategory = \(savedTab \|\| boardSearch \|\| functionChosen\) \? null : profileCategory\(sessionActiveProfile \|\| \{\}\);/);
  assert.match(server, /AND \(sj\.board_category IS NULL OR \(sj\.board_category <> 'held'\$\{/);
  assert.match(server, /\$\{roleSql\}\n\s+\$\{categorySql\}/, "applied in the board's one WHERE");
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  return db;
}
function insert(db, id, title, roleKey) {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at)
    VALUES (?, 't', ?, ?, 'Acme', ?, 'greenhouse', 1, unixepoch())`).run(id, `h-${id}`, title, `https://example.com/${id}`);
  if (roleKey) db.prepare("INSERT INTO job_role_map (job_id, role_key, matched_by) VALUES (?, ?, 'ats_cache')").run(id, roleKey);
}
const stored = (db, id) => db.prepare("SELECT board_category, discipline, category_reason FROM scraped_jobs WHERE job_id = ?").get(id);

test("d127HeldNeverShown: the gate holds a held posting (enforced: never written; report-only: stored 'held'); the backfill fills the rest", () => {
  const db = db0();
  const NOW = Math.floor(Date.now() / 1000);
  insert(db, "nurse", "Registered Nurse", null);
  insert(db, "mech", "Mechanical Engineer", "general");
  insert(db, "old", "Financial Analyst", "finance");
  assert.equal(scopeGate(db, { title: "Registered Nurse" }, "nurse", { exists: true, roleKey: null, now: NOW }), "would_drop");
  assert.deepEqual(stored(db, "nurse"), { board_category: HELD_CATEGORY, discipline: null, category_reason: "held:healthcare" });
  assert.equal(scopeGate(db, { title: "Mechanical Engineer" }, "mech", { exists: true, roleKey: "general", now: NOW }), "keep");
  assert.deepEqual(stored(db, "mech"), { board_category: "engineering", discipline: "mechanical", category_reason: "engineering:mechanical" });

  const r = backfillCategories(db);
  assert.equal(r.classified, 1, "only the row with no category yet");
  assert.equal(stored(db, "old").board_category, "business");
  assert.equal(backfillCategories(db).classified, 0, "a no-op on the next boot");

  setPolicy(db, { scope_enforce: true });
  assert.equal(scopeGate(db, { title: "Registered Nurse" }, "nurse2", { exists: false, roleKey: null, now: NOW, policy: readPolicy(db) }), "rejected_new");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE job_id = 'nurse2'").pluck().get(), 0, "enforced: never written");
});

test("d127 migration 207: the category columns, byte-identical in both migration paths, and a boot backfill", () => {
  const server = fs.readFileSync("server.js", "utf8"), mig = fs.readFileSync("scripts/migrations.js", "utf8");
  const block = (s) => s.slice(s.indexOf('id: "207_posting_category"'), s.indexOf("`,", s.indexOf('id: "207_posting_category"')));
  assert.ok(block(server).includes("ADD COLUMN board_category TEXT"));
  assert.equal(block(server), block(mig));
  assert.match(read("server.js"), /const cat = backfillCategories\(db\);/);
});

test("d127 report: counts by category, discipline and held reason", () => {
  const r = categoryReport(LABELLED.map(([title, roleKey]) => ({ title, roleKey })));
  assert.equal(r.total, LABELLED.length);
  assert.equal(r.shown + r.held, r.total);
  assert.ok(r.byCategory.engineering >= 10 && r.byDiscipline.mechanical >= 1 && r.heldByReason["held:pending_engineering_role"] >= 4);
});

test("d78ReversalRegistered: CORRECTIONS_REGISTER records D78 B reversed by D126 / D127, and what stays", () => {
  const reg = read("docs/CORRECTIONS_REGISTER.md");
  const row = reg.split("\n").find(l => l.startsWith("| **The board serves computer science only** (D78 B"));
  assert.ok(row, "the reversal row");
  assert.match(row, /D126 → widened by D127, owner 11-01/);
  assert.match(row, /120-day age limit and its source rules stay/);
});

test("d127SpotCheckLogged: Admin reads the counts, the held reasons and 20 per category; 'Wrong category' writes the audit log", () => {
  const server = read("server.js");
  const route = server.slice(server.indexOf('app.get("/api/admin/board-categories"'), server.indexOf('// D78 A: the daily sweep'));
  assert.match(route, /requireAdmin/);
  assert.match(route, /board_category = \?\s+ORDER BY random\(\) LIMIT 20/);
  assert.match(route, /app\.post\("\/api\/admin\/board-categories\/report", requireAdmin/);
  assert.match(route, /action: "board_category_report"/);
  assert.match(route, /FROM admin_audit_log WHERE action = 'board_category_report'/, "the log is read back on the same page");
  const ui = read("client/src/panels/adminOps.jsx");
  assert.match(ui, /api\("\/api\/admin\/board-categories\/report", \{ method: "POST"/);
  assert.match(ui, />Wrong category<\/Btn>/);
});

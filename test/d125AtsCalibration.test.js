import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { buildSet, setOverview, itemView, saveReview, readReview, assistBatch, importAssist, results, queueFix, listFixes,
         recordBaseline, latestBaseline, gate, spearman, niceSection, readingOf, cleanReview, copyAccountResume } from "../services/atsCalibration.js";

// ⭐ D125 (owner 11-01): "a manual enrichment task for me to compare and calibrate the ats module against here including
// scores and ats words detection". Synthetic postings only; the samples are fictional people.

const score = (job, resumeText) => scoreAtsLocally({ job, resumeText });
const BODY = (stack, extra = "") => `About the role\nYou will build and run services.\n\nRequirements\n- 3+ years with ${stack}\n- Experience designing REST APIs and SQL databases\n- Built and deployed software in production\n${extra}\nPreferred qualifications\n- Kubernetes\n- Terraform\n\nBenefits\nHealth insurance and a 401(k).\n` + "We are an equal opportunity employer. ".repeat(12);

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, board_category, discipline, level_read, is_active)
    VALUES (?, 'q', ?, ?, ?, 'https://example.com', ?, ?, ?, ?, 1)`);
  const levels = ["entry", "mid", "senior"];
  for (let i = 0; i < 6; i++) ins.run(`cs::${i}`, `c${i}`, `Software Engineer ${i}`, `Acme ${i % 3}`, BODY("Java, Python and PostgreSQL"), "computing", null, levels[i % 3]);
  for (let i = 0; i < 6; i++) ins.run(`me::${i}`, `m${i}`, `Mechanical Engineer ${i}`, `Forge ${i % 3}`, BODY("SolidWorks, GD&T and FEA"), "engineering", "mechanical", levels[i % 3]);
  ins.run("held::1", "h1", "Mystery role", "X", BODY("Java"), "held", null, "mid");
  return db;
}

test("d125GoldSetVersioned: a set is frozen per version — text, counted sentences and draft's reading — never re-picked under the same number", () => {
  const db = db0();
  const a = buildSet(db, { score, computing: 4, other: 4 });
  assert.deepEqual(a, { version: 1, items: 8 });
  const ov = setOverview(db);
  assert.equal(ov.items.length, 8);
  assert.equal(ov.items.filter(i => i.category === "computing").length, 4, "computing and other fields, as asked");
  assert.ok(!ov.items.some(i => i.title === "Mystery role"), "a held posting is never in the set");
  assert.deepEqual([...new Set(ov.items.filter(i => i.category === "computing").map(i => i.level))].sort(), ["entry", "mid", "senior"], "entry → senior covered");
  assert.ok(ov.resumes.some(r => r.source === "sample:A"), "the trial's samples are paired");
  // frozen: a later edit to the posting does not change the set's text
  db.prepare("UPDATE scraped_jobs SET description = 'changed' WHERE job_id LIKE 'cs::%'").run();
  const v = itemView(db, ov.items[0].id, { score });
  assert.match(v.text, /Requirements/);
  assert.ok(v.reading.skills.length > 0);
  db.prepare("UPDATE scraped_jobs SET description = ? WHERE job_id LIKE 'cs::%'").run(BODY("Go"));
  assert.equal(buildSet(db, { score, computing: 1, other: 1 }).version, 2, "a new set is a new version");
  assert.equal(setOverview(db).items.length, 2);
});

test("draft's reading: a skill named only under 'Preferred' is nice-to-have; the rest must", () => {
  assert.match(niceSection(BODY("Java")), /Kubernetes/);
  assert.doesNotMatch(niceSection(BODY("Java")), /health insurance/i, "the nice section ends at the next heading");
  const r = readingOf({ text: BODY("Java") }, [{ tier1_matched: ["java"], tier1_missing: ["kubernetes"] }]);
  assert.deepEqual(r.skills, [{ term: "java", tier: "must" }, { term: "kubernetes", tier: "nice" }]);
});

test("d125ReviewSavesProgress: marks, added terms, must ↔ nice moves and score feels are saved as he goes; Done counts", () => {
  const db = db0();
  buildSet(db, { score, computing: 1, other: 1 });
  const [it] = setOverview(db).items;
  saveReview(db, it.id, { marks: { skills: { java: "right", made_up_kind: "x" }, nope: { a: "right" } }, added: { skills: ["Spring Boot"] },
    tiers: { java: "nice", x: "maybe" }, scores: { 1: { feel: "too_low", own: 72 }, 2: { feel: "loud", own: 140 } } });
  const r = readReview(db, it.id);
  assert.deepEqual(r.marks.skills, { java: "right" }, "only right / wrong");
  assert.deepEqual(r.added.skills, ["Spring Boot"]);
  assert.deepEqual(r.tiers, { java: "nice" });
  assert.deepEqual(r.scores, { 1: { feel: "too_low", own: 72 }, 2: { feel: null, own: null } }, "an own score is 0–100");
  assert.equal(setOverview(db).done, 0);
  saveReview(db, it.id, { ...r, done: true });
  assert.equal(setOverview(db).done, 1);
  assert.equal(cleanReview({ scores: { abc: { feel: "right" } } }).scores.abc, undefined);
});

test("d125AssistIsSuggestionOnly: the chat's answer is kept apart as suggestions — the gold is unchanged until he accepts", () => {
  const db = db0();
  buildSet(db, { score, computing: 1, other: 1 });
  const ids = setOverview(db).items.map(i => i.id);
  const batch = assistBatch(db, ids);
  assert.equal(batch.items.length, 2);
  assert.match(batch.instructions, /Answer ONLY with JSON/);
  saveReview(db, ids[0], { marks: { skills: { java: "right" } } });
  const answer = "```json\n" + JSON.stringify({ items: [{ id: ids[0], wrong: ["java"], missed: ["Spring Boot"], nice: [1, "x"] }, { id: 999, missed: ["y"] }] }) + "\n```";
  assert.deepEqual(importAssist(db, answer), { items: 1 }, "an unknown posting is ignored");
  const r = readReview(db, ids[0]);
  assert.deepEqual(r.suggestions.missed, ["Spring Boot"]);
  assert.deepEqual(r.suggestions.nice, ["x"], "terms only");
  assert.deepEqual(r.marks.skills, { java: "right" }, "his mark stands — a suggestion is never gold by itself");
  assert.deepEqual(r.added.skills, []);
  // saving his review keeps the suggestions beside it
  saveReview(db, ids[0], { ...r, done: true });
  assert.deepEqual(readReview(db, ids[0]).suggestions.missed, ["Spring Boot"]);
  assert.throws(() => importAssist(db, "not json"), /not the JSON/);
  assert.doesNotMatch(fs.readFileSync("services/atsCalibration.js", "utf8"), /anthropic|callModel|fetch\(/, "draft calls no model (D17)");
});

test("d125MetricsComputed: precision / recall on the CURRENT scorer, must / nice accuracy, ρ, bias per band, the worst pairs", () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  assert.equal(spearman([1, 2], [1, 2]), null, "under 3 pairs, no ρ");
  const db = db0();
  buildSet(db, { score, computing: 2, other: 2 });
  const items = setOverview(db).items;
  const resumes = setOverview(db).resumes;
  for (const [k, it] of items.entries()) {
    const v = itemView(db, it.id, { score });
    const skills = v.reading.skills.map(s => s.term);
    const marks = Object.fromEntries(skills.map((t, j) => [t, j === 0 ? "wrong" : "right"]));
    const scores = Object.fromEntries(resumes.map((r, j) => [r.id, { feel: "too_low", own: Math.min(100, 20 + 10 * j + k) }]));
    saveReview(db, it.id, { marks: { skills: marks }, added: { skills: ["Microwave ovens"] }, scores, done: true });
  }
  const r = results(db, { score });
  assert.equal(r.reviewed, 4);
  assert.ok(r.skills.precision > 0 && r.skills.precision < 1, "one wrong per posting lowers precision");
  assert.ok(r.skills.recall < 1, "the added term the scorer never finds is a miss");
  assert.ok(r.rhoPairs >= 3 && r.rho != null);
  assert.ok(r.worst.length > 0 && r.worst.length <= 10);
  assert.ok(Object.keys(r.byDiscipline).includes("mechanical"));
  assert.ok(r.fixes.some(f => f.kind === "synonym" && f.term === "microwave ovens"), "a term missed on every posting points to the thesaurus");
});

test("d125FixesQueueable: one press queues a fix for the agent; the same fix twice is one row", () => {
  const db = db0();
  queueFix(db, { kind: "synonym", term: "GD&T", why: "missed" });
  queueFix(db, { kind: "synonym", term: "GD&T", why: "missed twice" });
  assert.deepEqual(listFixes(db).map(f => [f.kind, f.term, f.why, f.status]), [["synonym", "GD&T", "missed twice", "queued"]]);
  assert.throws(() => queueFix(db, { kind: "rewrite_everything", term: "x" }), /Which fix/);
});

test("d125RegressionGate: a recorded baseline; a fall in precision, recall or ρ fails, naming each drop", () => {
  const db = db0();
  buildSet(db, { score, computing: 1, other: 1 });
  const base = { version: 1, skills: { precision: 0.8, recall: 0.7 }, verbs: { precision: 0.6, recall: 0.5 }, rho: 0.72 };
  recordBaseline(db, base);
  const b = latestBaseline(db, 1);
  assert.equal(b.metrics.rho, 0.72);
  assert.deepEqual(gate({ ...base, rho: 0.723 }, b), { ok: true, drops: [] });
  const fell = gate({ ...base, skills: { precision: 0.7, recall: 0.7 }, rho: null }, b);
  assert.equal(fell.ok, false);
  assert.deepEqual(fell.drops.map(d => d.metric), ["skills.precision", "rho"]);
  const script = fs.readFileSync("scripts/d125GoldGate.mjs", "utf8");
  assert.match(script, /process\.exit\(g\.ok \? 0 : 1\)/);
  assert.match(script, /readonly: true/, "the gate never writes");
});

test("d125 Admin → Data → ATS calibration is wired, admin-only", () => {
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\["calibrate", "ATS calibration"\]/);
  assert.match(fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8"), /\{at\("data", "calibrate"\) && <CalibrateTab\/>\}/);
  const routes = fs.readFileSync("routes/atsCalibration.js", "utf8");
  for (const m of routes.matchAll(/app\.(get|post|put)\("([^"]+)", (\w+)/g)) assert.equal(m[3], "requireAdmin", m[2]);
});

test("the owner's résumé is copied from his USER account by username or email (an admin account has none, D95)", () => {
  const db = db0();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (5, 'owner', 'x')").run();
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (5, 'owner@example.com')").run();
  const p = db.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (5, 'p', 'engineering', 'it_digital', 1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, 5, ?, 'r.txt')").run(p.lastInsertRowid, "Synthetic résumé. " + "Java ".repeat(80));
  const list = copyAccountResume(db, "OWNER@example.com");
  assert.ok(list.some(r => r.source === "account:5" && /owner/.test(r.label)));
  assert.equal(copyAccountResume(db, "owner").length, list.length, "copied once; a later copy refreshes it");
  assert.throws(() => copyAccountResume(db, "nobody"), /No account/);
  const routes = fs.readFileSync("routes/atsCalibration.js", "utf8");
  assert.doesNotMatch(routes, /req\.user\.id/, "an admin request carries no user");
  assert.ok(routes.includes("const actor = (req) => req.admin?.id ?? req.user?.id ?? null;"));
});

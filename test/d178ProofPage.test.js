// ⭐ D178-4 · d178ProofPageLearning — the proof page (D109 P3, /p/<handle>) can show what the person proved in Atlas:
// modules finished, skills passed in a quick check or shown with a build, and builds — each with its date. Its own yes
// (proof_pages.show_learning, migration 227), OFF for every page until ticked; never a certificate, no points or levels.
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { renderProofPage, renderLearning } from "../routes/proofPage.js";
import { readProofPage, setProofPage, proofPageFor } from "../services/proofLinks.js";
import { learningProof } from "../services/atlas/points.js";
import { learnContent, stepsOf, LEARN_FILE } from "../services/learn/learnContent.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T = 1_794_100_000;
const CERTIFY = /\b(verif\w*|certif\w*|vouched|authenticated|validated|confirmed|guaranteed?|credential\w*|diploma)\b/i;

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'jordan','x'), (2,'casey','x')").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,full_name,email) VALUES (1,'Jordan','Rivera','Jordan Rivera','jordan@example.com')").run();
  return db;
}
const firstStep = () => stepsOf(learnContent(LEARN_FILE))[0];

test("d178ProofPageLearning: migration 227 is byte-identical in both runners, and only ADDS a column, OFF by default", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "227_proof_page_learning"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(sql, /ALTER TABLE proof_pages ADD COLUMN show_learning INTEGER NOT NULL DEFAULT 0;/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE)\b/);
});

test("d178ProofPageLearning: a page turned on shows NO learning until its own switch is ticked; a page off stays a 404", () => {
  const db = freshDb();
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'kafka', 'Kafka', 'checked', 'check', ?)").run(T);
  setProofPage(db, 1, { enabled: true, handle: "jordan-example" });
  assert.deepEqual(readProofPage(db, 1), { enabled: true, handle: "jordan-example", showLearning: false });
  const off = proofPageFor(db, "jordan-example");
  assert.equal(off.learning, null);
  assert.doesNotMatch(renderProofPage(off), /data-proof-learning|Kafka/);
  // ticked: the section appears
  setProofPage(db, 1, { enabled: true, showLearning: true });
  assert.equal(readProofPage(db, 1).showLearning, true);
  assert.match(renderProofPage(proofPageFor(db, "jordan-example")), /data-proof-learning=""[\s\S]*Kafka/);
  // a later save that does not mention it leaves it as it is
  setProofPage(db, 1, { enabled: true, handle: "jordan-example" });
  assert.equal(readProofPage(db, 1).showLearning, true);
  // the page off: the same 404 as no page, learning or not
  setProofPage(db, 1, { enabled: false });
  assert.equal(proofPageFor(db, "jordan-example"), null);
});

test("d178ProofPageLearning: skills (checked / built, once each, the stronger kept) and builds, each with its date — proof only", () => {
  const db = freshDb();
  const st = firstStep();
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'kafka', 'Kafka', 'checked', 'check', ?)").run(T - 86400 * 3);
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, url, created_at) VALUES (1, 'kafka', 'Kafka', 'built', 'link', 'https://example.com/kafka-demo', ?)").run(T);
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'sql', 'SQL', 'checked', 'check', ?)").run(T - 86400);
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'go', 'Go', 'claimed', 'profile', ?)").run(T);   // a claim proves nothing
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (2, 'rust', 'Rust', 'checked', 'check', ?)").run(T);  // someone else's
  db.prepare("INSERT INTO learn_builds (user_id, step_id, url, kind, created_at, updated_at) VALUES (1, ?, 'https://example.com/my-build', 'repository', ?, ?)").run(st.id, T, T);
  db.prepare("INSERT INTO learn_builds (user_id, step_id, url, kind, created_at, updated_at) VALUES (1, 'no-such-step', 'https://example.com/x', 'repository', ?, ?)").run(T, T);
  const l = learningProof(db, 1);
  assert.deepEqual(l.skills.map(s => [s.name, s.how, s.at, s.url]), [["SQL", "checked", T - 86400, null], ["Kafka", "built", T - 86400 * 3, "https://example.com/kafka-demo"]], "newest first; Kafka dated by its FIRST proof");
  assert.deepEqual(l.builds.map(b => [b.lesson, b.url, b.at]), [[st.t, "https://example.com/my-build", T]], "a build for a lesson that no longer exists is left out");
  assert.deepEqual(l.modules, []);
  assert.ok(!("total" in l) && !("level" in l) && !("streak" in l), "no points, no level, no streak — not evidence");
  const html = renderLearning(l);
  assert.match(html, /Kafka <span class="kind">· shown with a build · \d{4}-\d{2}-\d{2}<\/span> <a href="https:\/\/example\.com\/kafka-demo"/);
  assert.match(html, /SQL <span class="kind">· passed a one-minute quick check · \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(html, /Go|Rust/);
});

test("d178ProofPageLearning: the section claims nothing, links only http(s), and says plainly when nothing is finished", () => {
  const l = { modules: [{ title: "Foundations: Logic", at: T }], skills: [{ name: "Kafka", how: "built", at: T, url: "javascript:alert(1)" }],
    builds: [{ lesson: "A <b>lesson</b>", url: "https://example.com/b", at: T }] };
  const html = renderLearning(l);
  assert.doesNotMatch(html, CERTIFY, "never a certificate");
  assert.doesNotMatch(html, /\b(points?|level|streak|badge)\b/i);
  assert.doesNotMatch(html, /javascript:/, "a non-http address is never a link");
  assert.match(html, /A &lt;b&gt;lesson&lt;\/b&gt;/, "escaped");
  assert.match(html, /<h3>Modules finished<\/h3><ul><li>Foundations: Logic <span class="kind">\d{4}-\d{2}-\d{2}<\/span><\/li><\/ul>/);
  assert.match(renderLearning({ modules: [], skills: [], builds: [] }), /Nothing finished in Atlas yet\./);
  assert.equal(renderLearning(null), "");
  // modules come from the one earned rule (marksFrom), nowhere else
  assert.match(read("services/atlas/points.js"), /const modules = safe\(\(\) => marksFrom\(doc, earnedMarks\(db, userId\)\)\.earned, \[\]\)/);
});

test("d178ProofPageLearning: a database before 227 reads the switch as OFF and saves without it", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE proof_pages (user_id INTEGER PRIMARY KEY, handle TEXT UNIQUE, enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER);
    CREATE TABLE user_profile (user_id INTEGER, full_name TEXT, first_name TEXT, last_name TEXT);
    CREATE TABLE profile_projects (user_id INTEGER, name TEXT, description TEXT, position INTEGER, id INTEGER);
    CREATE TABLE profile_evidence (user_id INTEGER, target TEXT, kind TEXT, label TEXT, url TEXT, position INTEGER, id INTEGER);`);
  assert.deepEqual(setProofPage(db, 1, { enabled: true, handle: "casey-example", showLearning: true }), { enabled: true, handle: "casey-example", showLearning: false });
  const page = proofPageFor(db, "casey-example");
  assert.equal(page?.learning ?? null, null);
});

test("d178ProofPageLearning: the Profile asks separately; Your run points to the page", () => {
  const ui = read("client/src/components/ProfileSections.jsx");
  assert.match(ui, /\{s\.enabled && \(\n\s*<label [^>]*data-proof-page-learning=\{s\.showLearning \? "on" : "off"\}>\n\s*<input type="checkbox" checked=\{!!s\.showLearning\} onChange=\{e => send\(true, \{ showLearning: e\.target\.checked \}\)\} \/>/);
  assert.doesNotMatch(ui.slice(at(ui, "function ProofPageSetting"), at(ui, "const ymLabel")).replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, ""), CERTIFY);
  const run = read("client/src/pages/atlas/YourRun.jsx");
  assert.match(run, /api\("\/api\/profile\/proof-page"\)\.then\(r => live && setProofPage\(r\)\)/);
  assert.match(run, /href=\{`\/p\/\$\{proofPage\.handle\}`\}/);
  assert.match(run, /<Link className="atl__link" to="\/app\/profile">Profile → Proof page<\/Link>/);
});

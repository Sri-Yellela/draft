// ⭐ D169 (owner 11-06, APPROVED, revisable) · YOUR SKILLS LIVE IN ATLAS — and a skill is proven before it goes into a résumé.
// The service (services/yourSkills.js) on an in-memory database built from the real migrations; the panel
// (client/src/pages/atlas/YourSkillsPanel.jsx) and the shared check (components/SkillCheck.jsx) rendered by esbuild +
// react-dom/server as d116's tree is. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { importQuestions, reviewQuestion } from "../services/learn/learnQuestions.js";
import { setProfileSignalClaim } from "../services/profileSignalAggregator.js";
import { generateRequest } from "../services/toolsServiceRequests.js";
import { termGuard } from "../services/byom/resumePatch.js";
import {
  YOUR_SKILLS, PROFILE_SKILLS_LINE, listYourSkills, addSkill, removeSkill, curatorHolds, startQuickCheck, answerQuickCheck,
  addSkillProof, proveOptions, resumeClaims, gateClaimsForResume, gatedDomainProfile, textNamesTerm, quickSummary,
} from "../services/yourSkills.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T0 = Date.UTC(2026, 10, 6, 12);
const RESUME = "Jordan Example\nData Engineer at Acme\n• Built SQL pipelines in Python\nSKILLS\nLanguages: Python, SQL";

const item = (id, over = {}) => ({ id, role: "Data Engineer", level: "mid", type: "scenario", skills: ["kafka"], pieces: [],
  stem: `Question ${id}: what does an idempotent consumer give you?`, choices: ["A", "B", "C", "D"], correct: 1,
  why: ["Why A.", "Why B is right.", "Why C.", "Why D."], source: "test", status: "draft", ...over });

function fixtureDb({ kafkaQuestions = 4 } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x'), (2,'b','x')").run();
  for (const [kind, name] of [["tool", "Kafka"], ["skill", "SQL"], ["tool", "Python"], ["tool", "dbt"], ["tool", "Airflow"]]) {
    upsertNode(db, { kind, name, status: "draft" });
    setStatus(db, name === "SQL" ? "sql" : name.toLowerCase(), "published");
  }
  const items = Array.from({ length: kafkaQuestions }, (_, i) => item(`kafka-${i + 1}`));
  items.push(item("dbt-explain", { skills: ["dbt"], type: "explain" }));   // explain items are never auto-graded
  importQuestions(db, { version: 1, note: "test", items }, { apply: true });
  for (const it of items) reviewQuestion(db, it.id, { action: "approve", reviewer: "owner" });
  db.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (1, 'base.txt', ?)").run(RESUME);
  const pid = Number(db.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (1, 'p', 'engineering', 'it_digital', 1)").run().lastInsertRowid);
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, 1, ?, 'base.txt')").run(pid, RESUME);
  db.prepare("INSERT INTO profile_sections (user_id) VALUES (1)").run();
  for (const [i, s] of ["Python", "SQL"].entries()) db.prepare("INSERT INTO profile_skills (user_id, name, position, source) VALUES (1, ?, ?, 'resume')").run(s, i);
  return { db, pid };
}
const keyOf = (db, id) => db.prepare("SELECT correct FROM learn_questions WHERE id = ?").pluck().get(id);
function passCheck(db, skill = "Kafka", { mode = "timed", wrong = 0 } = {}) {
  let s = startQuickCheck(db, 1, { skill, mode, now: T0, random: () => 0.5 });
  let r, n = 0;
  while (true) {
    const q = s.question || r.question;
    const chosen = n < wrong ? (keyOf(db, q.id) + 1) % 4 : keyOf(db, q.id);
    r = answerQuickCheck(db, 1, s.checkId, { questionId: q.id, chosen, now: T0 + 5000 * (n + 1) });
    n++;
    if (r.summary) return r;
    s = { ...s, question: r.question };
  }
}

// ── the UI, rendered ────────────────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import YourSkillsPanel, { SkillsList } from ${abs("pages/atlas/YourSkillsPanel.jsx")};
        import SkillCheck from ${abs("components/SkillCheck.jsx")};
        export const panel = (p) => renderToStaticMarkup(h(YourSkillsPanel, p));
        export const list = (l) => renderToStaticMarkup(h(SkillsList, { list: l, onOpen() {}, openKey: null }));
        export const listOpen = (l, key) => renderToStaticMarkup(h(SkillsList, { list: l, onOpen() {}, openKey: key }));
        export const check = (s) => renderToStaticMarkup(h(SkillCheck, { skill: s }));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d169-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

test("D169 · d169SkillsPanelInAtlasListAndMap — one panel, List and Map of the same data; a state is a dot + a plain word", async () => {
  const { db } = fixtureDb();
  addSkill(db, 1, { name: "Kafka" });
  addSkill(db, 1, { name: "dbt" });
  const l = listYourSkills(db, 1);
  const u = await loadUi();
  const html = u.list(l);
  for (const s of ["Python", "SQL", "Kafka", "dbt"]) assert.match(html, new RegExp(`data-skill-row="${s.toLowerCase()}"`));
  assert.match(html, /data-state-word="claimed">claimed</);
  assert.match(html, /class="ysk__state ysk__state--claimed"/);
  assert.match(html, /Check it · 1 min/, "Kafka has questions");
  assert.match(html, /Add proof/, "dbt has none (its only item is an explain item)");
  assert.match(html, /Add a skill, for example Terraform/);
  const shell = u.panel({ signedIn: true });
  // ⭐ A228 (46r, moved on purpose): the panel's ring MAP view is retired — Your map (the skill map) draws the skills against
  // the market; the panel is the list alone. ⭐ A230 (46t): the server's map reading (GET /api/your-skills/map) had no caller left — deleted.
  assert.doesNotMatch(shell, />Map</);
  assert.match(shell, /What you can show/);
  // ⛔ D60 / D152 (7b): no capsules, no chips in the panel's look.
  for (const f of ["client/src/pages/atlas/YourSkillsPanel.css", "client/src/components/SkillCheck.css"]) {
    const css = read(f);
    assert.doesNotMatch(css, /999px|rounded-full/);
    for (const m50 of css.matchAll(/([^{}]+)\{([^}]*border-radius:\s*50%[^}]*)\}/g)) {
      const w = m50[2].match(/width:\s*(\d+)px/)?.[1], h = m50[2].match(/height:\s*(\d+)px/)?.[1];
      assert.ok(w && w === h, `50% only on a square (a dot): ${m50[1].trim()}`);
    }
  }
  assert.match(read("client/src/pages/atlas/YourSkillsPanel.css"), /\.ysk__state::before \{ content: ""; width: 6px; height: 6px; border-radius: 50%/);
});

test("D169 · d169ProfileLinksOnly — the panel side: skills are managed in Atlas; the Profile gets one line pointing there", () => {
  assert.match(PROFILE_SKILLS_LINE.text, /Your skills live in Atlas/);
  assert.equal(PROFILE_SKILLS_LINE.path, "/app/atlas/skills");
  const { db } = fixtureDb();
  assert.deepEqual(listYourSkills(db, 1).profileLine, PROFILE_SKILLS_LINE, "the line the Profile shows comes from the same reader");
  const src = read("client/src/pages/atlas/YourSkillsPanel.jsx");
  assert.doesNotMatch(src, /ProfilePanel|ProfileSections/, "the panel draws no Profile UI");
});

test("D169 · d169AddedSkillResolvesToNode — a typed skill lands as claimed on its node; an unknown one is held, never a node", () => {
  const { db } = fixtureDb();
  const nodesBefore = db.prepare("SELECT COUNT(*) FROM atlas_nodes").pluck().get();
  const k = addSkill(db, 1, { name: "  apache kafka ".replace("apache ", "") });
  assert.equal(k.skill.state, "claimed");
  assert.deepEqual(k.skill.node, { slug: "kafka", name: "Kafka" });
  assert.equal(k.held, false);
  const z = addSkill(db, 1, { name: "Zorblax" });
  assert.equal(z.held, true);
  assert.equal(z.skill.node, null);
  assert.match(z.skill.line, /no questions yet/);
  assert.equal(db.prepare("SELECT COUNT(*) FROM atlas_nodes").pluck().get(), nodesBefore, "⛔ never invented as a node");
  addSkill(db, 2, { name: "zorblax" });
  assert.deepEqual(curatorHolds(db).map(h => [h.term, h.people]), [["zorblax", 2]], "held for the curator, counted by person");
  assert.equal(addSkill(db, 1, { name: "kafka" }).added, false, "the same skill twice is one skill");
  assert.ok(db.prepare("SELECT 1 FROM profile_skills WHERE user_id = 1 AND name = 'Kafka'").get(), "it is the Profile's own list, so it counts on the map");
  assert.throws(() => addSkill(db, 1, { name: "  " }), /Type a skill/);
  removeSkill(db, 1, { key: "zorblax" });
  assert.equal(listYourSkills(db, 1).skills.some(s => s.key === "zorblax"), false);
  // Signed-in only, mounted once, every route guarded.
  const server = read("server.js");
  assert.match(server, /app\.use\("\/api\/your-skills", createYourSkillsRouter\(db, \{ requireAuth \}\)\);/);
  assert.match(server, /app\.use\("\/api\/admin\/your-skills", requireAdmin, createYourSkillsAdminRouter\(db\)\);/);
  assert.match(read("routes/yourSkills.js"), /router\.use\(requireAuth\);/);
});

test("D169 · d169UnprovenNeverInResume — a skill not on the résumé never reaches a tailored résumé until proven", () => {
  const { db, pid } = fixtureDb();
  for (const label of ["Kafka", "SQL"]) setProfileSignalClaim(db, { userId: 1, profileId: pid, kind: "skill", label, claimed: true });
  assert.ok(textNamesTerm(RESUME, "sql") && !textNamesTerm("JavaScript", "java") && textNamesTerm("C++ and Go", "c++"));
  let gated = resumeClaims(db, { userId: 1, profileId: pid });
  assert.deepEqual(gated.skills, ["SQL"], "SQL is on the résumé; Kafka is only claimed");
  assert.deepEqual(gated.held, ["Kafka"]);
  // What draft SENDS to resume-master: the request's claims, and the job profile's own tool list.
  const body = generateRequest({ profile: {}, job: { title: "t", company: "c" }, baseResumeText: RESUME, mode: "GENERATE", claims: gated,
    domainProfile: gatedDomainProfile(db, { userId: 1, domainProfile: { profile_name: "p", selected_tools: JSON.stringify(["Kafka", "Python"]) } }) });
  assert.deepEqual(body.claims.skills, ["SQL"]);
  assert.deepEqual(body.profile.tools, ["Python"], "an unproven tool is not sent either");
  // The BYOM patch guard refuses the unproven skill as a new term.
  assert.equal(termGuard({ changedText: [{ id: "b1", text: "Streamed events with Kafka" }], baseText: RESUME, claims: gated, vocabulary: ["kafka"] }).length > 0, true);
  // The panel says where it stands.
  const kafka = listYourSkills(db, 1).skills.find(s => s.key === "kafka");
  assert.equal(kafka.inResume, false);
  assert.equal(kafka.from, "posting", "a skill claimed on an ATS report is on the list too");
  // Proven → it goes.
  passCheck(db, "Kafka");
  assert.deepEqual(resumeClaims(db, { userId: 1, profileId: pid }).skills.sort(), ["Kafka", "SQL"]);
  // ⛔ The gate is on every generation path draft owns: coreGenerateResume and the BYOM base.
  const server = read("server.js");
  const kernel = server.slice(at(server, "async function coreGenerateResume("), at(server, "function scoreBaseResumeForApply("));
  assert.match(kernel, /gateClaimsForResume\(db, \{ userId, claims: listProfileClaims\(db, \{ userId, profileId: activeDomainProfile\.id \}\), resumeText: authoritativeResumeText \}\)/);
  assert.match(kernel, /domainProfile: gatedDomainProfile\(db, \{ userId, domainProfile: activeDomainProfile, resumeText: authoritativeResumeText \}\)/);
  assert.match(server, /claims: gateClaimsForResume\(db, \{ userId, claims: listProfileClaims\(db, \{ userId, profileId: dp\.id \}\), resumeText: text \}\)/);
  assert.equal(gateClaimsForResume(db, { userId: 1, claims: null }), null);
});

test("D169 · d169QuickCheckPromotes — 3–5 questions from D150's bank, D142's clock; passing moves claimed → checked", () => {
  const { db } = fixtureDb({ kafkaQuestions: 7 });
  addSkill(db, 1, { name: "Kafka" });
  const s = startQuickCheck(db, 1, { skill: "Kafka", now: T0, random: () => 0.5 });
  assert.equal(s.of, YOUR_SKILLS.MAX_QUESTIONS, "at most 5");
  assert.equal("correct" in s.question, false, "the key never leaves before the answer");
  assert.equal("why" in s.question, false);
  assert.equal(s.question.seconds, YOUR_SKILLS.SCENARIO_SECONDS);
  // Timed: a right answer past the clock earns no credit.
  const late = answerQuickCheck(db, 1, s.checkId, { questionId: s.question.id, chosen: keyOf(db, s.question.id), now: T0 + 200_000 });
  assert.deepEqual([late.correct, late.inTime], [true, false]);
  assert.throws(() => answerQuickCheck(db, 1, s.checkId, { questionId: s.question.id, chosen: 0 }), /not the question being asked/);
  assert.throws(() => answerQuickCheck(db, 2, s.checkId, { questionId: late.question.id, chosen: 0 }), /No such check/);
  // ONE BANK: answers are the bank's too.
  assert.equal(db.prepare("SELECT COUNT(*) FROM learn_question_answers WHERE surface = 'skills-check'").pluck().get(), 1);
  // Extended time doubles the clock and is never penalised; untimed has none.
  const ext = startQuickCheck(db, 1, { skill: "Kafka", mode: "extended", now: T0 });
  assert.equal(ext.question.seconds, YOUR_SKILLS.SCENARIO_SECONDS * 2);
  const slow = answerQuickCheck(db, 1, ext.checkId, { questionId: ext.question.id, chosen: keyOf(db, ext.question.id), now: T0 + 140_000 });
  assert.equal(slow.inTime, true);
  assert.equal(startQuickCheck(db, 1, { skill: "Kafka", mode: "untimed", now: T0 }).question.seconds, null);
  // Failing leaves it claimed; passing promotes it.
  const fail = passCheck(db, "Kafka", { wrong: 3 });
  assert.equal(fail.summary.passed, false);
  assert.equal(listYourSkills(db, 1).skills.find(x => x.key === "kafka").state, "claimed");
  const ok = passCheck(db, "Kafka");
  assert.equal(ok.summary.passed, true);
  assert.match(ok.summary.line, /Passed: 5 of 5/);
  assert.match(ok.summary.note, /not a grade or a certificate/);
  assert.equal(ok.skill.state, "checked");
  assert.equal(ok.skill.inResume, true);
  assert.equal(quickSummary([{ credit: true }, { credit: true }], { skill: "x" }).passed, false, "fewer than 3 is never a pass");
});

test("D169 · d169NoQuestionsProofOrBuild — no questions: a proof link or a build; until then not yet checked, offered for Defend", () => {
  const { db, pid } = fixtureDb({ kafkaQuestions: 2 });   // 2 < MIN_QUESTIONS → no check
  addSkill(db, 1, { name: "Kafka" });
  const e = listYourSkills(db, 1).skills.find(s => s.key === "kafka");
  assert.equal(e.checkAvailable, false);
  assert.equal(e.action, "proof");
  assert.match(e.line, /not yet checked/);
  assert.equal(e.defendOffered, true);
  assert.equal(e.inResume, false);
  assert.throws(() => startQuickCheck(db, 1, { skill: "Kafka" }), /no questions for Kafka yet/);
  assert.equal(proveOptions(db, 1, { skill: "Kafka" }).checkAvailable, false);
  // D109's validator: https only.
  assert.throws(() => addSkillProof(db, 1, { skill: "Kafka", url: "http://example.com/x" }), /only https/);
  assert.throws(() => addSkillProof(db, 1, { skill: "Nope", url: "https://example.com/x" }), /Add the skill first/);
  const r = addSkillProof(db, 1, { skill: "Kafka", url: "https://github.com/example/stream-lab", kind: "repository", label: "a streaming lab" });
  assert.equal(r.skill.state, "built");
  assert.equal(r.skill.line, "proof: a streaming lab");
  setProfileSignalClaim(db, { userId: 1, profileId: pid, kind: "skill", label: "Kafka", claimed: true });
  assert.deepEqual(resumeClaims(db, { userId: 1, profileId: pid }).skills, ["Kafka"], "built → it may go into a résumé");
  // The UI's words for the no-questions case.
  const src = read("client/src/components/SkillCheck.jsx");
  assert.match(src, /There are no questions for \{skill\} yet, so it's proven by a link or a build/);
  assert.match(src, /offered for Defend practice/);
  assert.match(src, /draft doesn't open it or vouch for it/, "⛔ D109: draft certifies nothing");
});

test("D169 · the quick check lives in Atlas's Your skills only — the posting's ATS panel no longer claims or opens a check (46x)", async () => {
  // ⭐ 46x (owner 11-19: "ditch the whole prove it and claim it gimmick and definitely ditch it from the jd panel"): moved on
  // purpose — d169AtsClaimOpensCheck pinned the claim → check in the posting's panel; the panel draws the ATS card now.
  const src = read("client/src/components/ATSPanel.jsx").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /SkillCheck|setProving|setProfileClaim/);
  // The Atlas list opens the SAME component (A93: built once).
  assert.match(read("client/src/pages/atlas/YourSkillsPanel.jsx"), /import SkillCheck from "\.\.\/\.\.\/components\/SkillCheck\.jsx";/);
  const u = await loadUi();
  assert.match(u.check("Kafka"), /data-skill-check="Kafka"/);
  const { db } = fixtureDb();
  addSkill(db, 1, { name: "Kafka" });
  assert.match(u.listOpen(listYourSkills(db, 1), "kafka"), /data-skill-check="Kafka"/, "the row's check opens in place, under the row");
});

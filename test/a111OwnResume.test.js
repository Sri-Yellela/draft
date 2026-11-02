import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { startTrial, trialState, trialSendUrl, isOwnTrial, samples, RESUME_CHOICES } from "../services/trial.js";
import { trialOwnResumeOn, setSetting, TRIAL_OWN_RESUME_KEY } from "../services/appSettings.js";
import { readOwnResume, fieldWords } from "../services/trialOwn.js";
import { ownPicks, clearPicksCache, PICKS_PER_SAMPLE } from "../services/trialPicks.js";
import { demoState, completeDemo, ownFormFields, simulateTailoring, names } from "../services/trialDemo.js";
import { roleFitFor, setAtlasReader } from "../services/trialRoleFit.js";
import { startFromResume } from "../services/resumeOnboarding.js";
import { categoryOf } from "../services/jobs/professionalScope.js";
import { listHistory, markPending } from "../services/applicationRecords.js";
import trialRoutes from "../routes/trial.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { ANALYST, PROJECT_MANAGER, NURSE } from "../test-support/a111Resumes.mjs";

// ⭐ A111 P4 · THE TRIAL'S "USE MY OWN RÉSUMÉ" PATHWAY, behind app setting trial_own_resume (OFF by default). Off: /try and
// every trial route are today's; on: the résumé's field read honestly (never another category's picks), 10 picks from its
// own category with the one scorer's reading, the role against the résumé, and the demonstration on the tester's OWN
// résumé — tailoring that never adds a skill, the practice form from its own contact lines, Sent, The Table. Synthetic
// people (test-support/a111Resumes.mjs) and synthetic postings only.

process.env.DRAFT_TRIAL = "on";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const FIN = (n) => Array.from({ length: n }, (_, i) => ({ cat: "business", title: i % 2 ? "Financial Analyst" : "FP&A Analyst",
  description: `Own forecasting and variance analysis; budgeting in Excel; dashboards in Tableau and Power BI; SQL. Desk ${i}.` }));
const SWE = (n) => Array.from({ length: n }, (_, i) => ({ cat: "computing", title: "Software Engineer",
  description: `Build services in Java, Go and TypeScript; SQL, Excel exports, Tableau embeds. Team ${i}.` }));
const PMS = (n) => Array.from({ length: n }, (_, i) => ({ cat: "management", title: "Project Manager", level: "senior",
  description: `Lead project planning, scheduling and risk management; Agile and Scrum; MS Project, Jira, Smartsheet; stakeholder management. Site ${i}.` }));

function fresh(rows = []) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
    description, board_category, bucket_seniority) VALUES (?, 't', ?, ?, ?, ?, 'greenhouse', 1, unixepoch() - ?, ?, ?, ?)`);
  rows.forEach((r, i) => { const id = `${r.cat}-${i}`; ins.run(id, `h-${id}`, r.title, `Co${i}`, `https://example.com/${id}`, i, r.description, r.cat, r.level || "mid"); });
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'tester', 'x'), (2, 'sampler', 'x')").run();
  db.prepare("INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (1, 'Account', 'Holder', 'account.holder@example.com')").run();
  startTrial(db, 1); startTrial(db, 2);
  clearPicksCache();
  return db;
}

/** The normal onboarding (POST /api/domain-profiles/from-resume's own step), as the client runs it after the pick. */
function onboard(db, userId, text) {
  return startFromResume(db, userId, { content: text, name: "resume.pdf" }, {
    registry: getRegistry(),
    saveBaseResume: (profileId, content, name) => db.prepare("INSERT INTO profile_base_resumes (user_id, profile_id, content, name) VALUES (?, ?, ?, ?)").run(userId, profileId, content, name),
    readProfile: () => null,
  });
}

/** The trial's routes on a tiny app: x-user names the caller. */
async function serve(db) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const requireAuth = (req, _res, next) => { req.user = { id: Number(req.headers["x-user"] || 1) }; next(); };
  const requireAdmin = (req, _res, next) => { req.admin = { username: "admin" }; next(); };
  trialRoutes(app, db, { requireAuth, requireAdmin, secret: "s", upload: { any: () => (_q, _s, n) => n() } });
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, user = 1) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, close: () => new Promise(r => server.close(r)) };
}

function drafted(db, userId, jobs) {
  db.prepare("INSERT INTO apply_runs (id, user_id) VALUES (70 + ?, ?)").run(userId, userId);
  for (const j of jobs) db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (70 + ?, ?, ?, 'held_review')").run(userId, userId, j);
}

test("a111OwnResumeOffByDefault: off, /try offers samples only and POST /api/trial/resume {own} answers 409 own_resume_off — nothing saved", async () => {
  const db = fresh(FIN(12));
  assert.equal(trialOwnResumeOn(db), false, "no row: off");
  const { call, close } = await serve(db);
  try {
    assert.equal((await call("GET", "/api/trial/samples")).body.ownResume, false);
    const r = await call("POST", "/api/trial/resume", { choice: "own", content: ANALYST, name: "cv.pdf" });
    assert.deepEqual([r.status, r.body.error], [409, "own_resume_off"]);
    assert.equal(db.prepare("SELECT COUNT(*) FROM domain_profiles").pluck().get(), 0);
    assert.equal(db.prepare("SELECT trial_resume FROM users WHERE id = 1").pluck().get(), null);
    assert.equal(db.prepare("SELECT COUNT(*) FROM trial_events WHERE event = 'own_resume'").pluck().get(), 0, "not even read");
    // the samples still work exactly as today
    assert.equal((await call("POST", "/api/trial/resume", { choice: "E" })).body.choice, "E");
    // Admin → Trial's switch turns it on (and off again)
    assert.deepEqual((await call("POST", "/api/admin/trial/own-resume", { on: true })).body, { on: true });
    assert.equal((await call("GET", "/api/trial/samples")).body.ownResume, true);
    assert.equal((await call("GET", "/api/admin/trial")).body.ownResume.on, true);
    assert.equal((await call("POST", "/api/admin/trial/own-resume", { on: "yes" })).status, 400, "a boolean only");
    assert.deepEqual((await call("POST", "/api/admin/trial/own-resume", { on: false })).body, { on: false });
  } finally { await close(); }
  // the samples-only choice list is unchanged; "own" goes only through the switch
  assert.deepEqual([...RESUME_CHOICES], ["A", "B", "C", "D", "E", "F"]);
  const page = read("client/src/pages/TryPage.jsx");
  assert.match(page, /\{ownOn && <OwnResumeCard /, "the card renders only when the server says the switch is on");
  assert.match(page, /setOwnOn\(r\.ownResume === true\)/);
  assert.match(read("client/src/panels/adminTrial.jsx"), /api\("\/api\/admin\/trial\/own-resume", \{ method: "POST", body: JSON\.stringify\(\{ on \}\) \}\)/);
});

test("a111OwnResumeHonestFieldNotLive: a held field, or one short of 10 picks today, is told so — the samples offered, nothing saved", async () => {
  const db = fresh([...FIN(4), ...SWE(12)]);
  setSetting(db, TRIAL_OWN_RESUME_KEY, true);
  const { call, close } = await serve(db);
  try {
    const nurse = await call("POST", "/api/trial/resume", { choice: "own", content: NURSE });
    assert.equal(nurse.status, 409);
    assert.deepEqual([nurse.body.error, nurse.body.reason, nurse.body.field.category], ["field_not_live", "field_not_live", null]);
    assert.match(nurse.body.message, /Your field isn't live in the trial yet/);
    assert.deepEqual(nurse.body.samples.map(s => s.id), ["A", "B"], "the samples offered today (12 computing postings: A and B) — and no picks of another category for the nurse");
    const analyst = await call("POST", "/api/trial/resume", { choice: "own", content: ANALYST });
    assert.deepEqual([analyst.status, analyst.body.reason, analyst.body.picks], [409, "too_few_picks", 4], "4 business postings: not live today, counted honestly");
    assert.equal(analyst.body.field.words, "Business & finance · Financial Analyst · mid level");
    assert.equal(db.prepare("SELECT COUNT(*) FROM domain_profiles").pluck().get(), 0, "nothing saved for a field that isn't live");
    assert.equal(db.prepare("SELECT trial_resume FROM users WHERE id = 1").pluck().get(), null);
    // Admin → Trial shows the own-résumé testers' field (the latest reading per tester: the analyst's)
    const admin = (await call("GET", "/api/admin/trial")).body.ownResume;
    assert.deepEqual([admin.testers, admin.live, admin.notLive, admin.byField], [1, 0, 1, { "Business & finance": 1 }]);
    assert.equal((await call("POST", "/api/trial/resume", { choice: "own", content: "too short" })).body.error, "resume_too_short");
  } finally { await close(); }
  assert.equal(fieldWords({ category: null }), null);
  const page = read("client/src/pages/TryPage.jsx");
  assert.match(page, /data-own-not-live=""/);
  assert.match(page, /Your field isn't live yet/);
  assert.match(page, /Try a sample instead/);
});

test("a111OwnPicksOwnCategoryOnly: 10 picks from the résumé's OWN category — never computing's or management's, never a held posting", async () => {
  const db = fresh([...FIN(14), ...SWE(20), ...PMS(12),
    { cat: "held", title: "Administrative Assistant", description: "Excel, budgeting, forecasting, SQL." },
    { cat: "business", title: "Registered Nurse", description: "Excel, budgeting, forecasting, SQL (a mis-stored row: the title guard skips it)." }]);
  setSetting(db, TRIAL_OWN_RESUME_KEY, true);
  const { call, close } = await serve(db);
  try {
    const r = await call("POST", "/api/trial/resume", { choice: "own", content: ANALYST, name: "priya.pdf" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.choice, r.body.field.category, r.body.picks], ["own", "business", PICKS_PER_SAMPLE]);
    assert.equal(r.body.own.content, ANALYST, "the résumé comes back for the normal onboarding (from-resume)");
    assert.equal(isOwnTrial(db, 1), true);
  } finally { await close(); }
  onboard(db, 1, ANALYST);
  const own = await ownPicks(db, 1);
  assert.equal(own.category, "business");
  assert.equal(own.picks.length, PICKS_PER_SAMPLE);
  for (const p of own.picks) {
    assert.equal(db.prepare("SELECT board_category FROM scraped_jobs WHERE job_id = ?").pluck().get(p.job_id), "business");
    assert.equal(categoryOf({ title: p.title }).category, "business", p.title);
  }
  // the project manager's field is management's, on the same board
  clearPicksCache();
  const pm = await readOwnResume(db, 2, { content: PROJECT_MANAGER, registry: getRegistry() });
  assert.deepEqual([pm.field.category, pm.live, pm.picks], ["management", true, PICKS_PER_SAMPLE]);
});

test("a111OwnPickShowsScoreAndWhy: the own résumé's cards carry the board's one score + why, exactly as a sample's", async () => {
  const db = fresh(FIN(12));
  setSetting(db, TRIAL_OWN_RESUME_KEY, true);
  db.prepare("UPDATE users SET trial_resume = 'own' WHERE id = 1").run();
  onboard(db, 1, ANALYST);
  const own = await ownPicks(db, 1);
  for (const p of own.picks) assert.ok(Number.isFinite(p.score) && p.score >= 30 && p.basis === "ats", `${p.title}: the local ATS score (one scorer)`);
  for (let i = 1; i < own.picks.length; i++) assert.ok(own.picks[i - 1].score >= own.picks[i].score, "best first");
  // the deck: every TRIAL account's card carries its stored score (not only a sample's), drawn by the same TrialMatch ring
  assert.match(read("server.js"), /if \(isTrialAccount\(db, req\.user\.id\)\) deck\.cards = deck\.cards\.map\(c => \(\{ \.\.\.c, score: scoreFor\(c\.job\.id\) \}\)\);/);
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /\{Number\.isFinite\(card\.score\)\n\s+\? <TrialMatch score=\{card\.score\} why=\{why\}/);
  assert.doesNotMatch(deck, /TrialMatch[^\n]*sample/, "no sample-only condition on the ring");
});

test("a111RoleAgainstResume: opening a pick reads the role against the résumé — the ATS report + the Atlas reading (the seam)", async () => {
  const db = fresh(FIN(12));
  db.prepare("UPDATE users SET trial_resume = 'own' WHERE id = 1").run();
  onboard(db, 1, ANALYST);
  db.prepare("INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, board_category) VALUES ('fa::1', 't', 'hf', 'Financial Analyst', 'Acme', 'https://example.com/fa', ?, 'business')")
    .run("Forecasting, variance analysis, budgeting, Excel, SQL, Tableau, Python, Snowflake. 3+ years of experience.");
  const fit = await roleFitFor(db, { userId: 1, jobId: "fa::1" });
  assert.equal(fit.available, true);
  assert.ok(Number.isFinite(fit.ats.score));
  assert.ok(fit.ats.matched.includes("Excel") && fit.ats.missing.includes("Python"), JSON.stringify(fit.ats));
  // no Atlas in this fixture: P3's found:false shape, handled — the panel falls back to the posting's own terms
  assert.deepEqual([fit.atlas.found, fit.atlas.reason], [false, "unknown_role"]);
  // the seam: the integrator swaps in A111 P3's roleFitReading(db, { role, jobId, userId, terms, resumeText, registry })
  let asked = null;
  setAtlasReader((_db, args) => { asked = args; return { found: true, role: { slug: "financial-analyst", name: "Financial Analyst", postings: 40, page: null },
    category: "business", categoryLabel: "Business and finance", rankedBy: "share", covered: 1, of: 2, line: "You cover 1 of this role's top 2 — missing Python",
    top: [{ slug: "excel", name: "Excel", kind: "tool", postings: 30, share: 75, have: true, page: "/app/atlas/excel" },
          { slug: "python", name: "Python", kind: "skill", postings: 12, share: 30, have: false, page: null }],
    have: [{ slug: "excel", name: "Excel", page: "/app/atlas/excel" }], missing: [{ slug: "python", name: "Python", share: 30, page: null }],
    nextLevel: [{ from: "mid", to: "senior", postings: { from: 20, to: 10 }, items: [{ slug: "sql", name: "SQL", share: 40, rise: 15, page: null, line: "+15 points" }] }],
    job: { job_id: "fa::1" } }; });
  try {
    const p3 = await roleFitFor(db, { userId: 1, jobId: "fa::1", registry: { r: 1 } });
    assert.deepEqual([p3.atlas.found, p3.atlas.covered, p3.atlas.of, p3.atlas.role.page], [true, 1, 2, null]);
    assert.deepEqual([asked.role, asked.jobId, asked.userId, asked.registry], ["Financial Analyst", "fa::1", 1, { r: 1 }]);
    assert.ok(asked.terms.includes("Excel") && asked.resumeText.includes("Priya"), "P3 gets the ATS terms and the résumé");
  } finally { setAtlasReader(null); }
  assert.equal((await roleFitFor(db, { userId: 2, jobId: "fa::1" })).available, false, "a sample account: its cards already carry the report");
  const panel = read("client/src/components/TrialRoleFit.jsx");
  assert.match(panel, /api\(`\/api\/trial\/role-fit\/\$\{encodeURIComponent\(jobId\)\}`\)/);
  assert.match(panel, /\{a\.line\}/, "the reading's own line");
  assert.match(panel, /a\.found \? "Read from every open posting/, "found:false handled");
  assert.match(read("services/trialRoleFit.js"), /import \{ roleFitReading \} from "\.\/atlas\/atlasRoleFit\.js";/, "the one-import swap is written down");
  assert.match(read("client/src/panels/DeckView.jsx"), /\{Number\.isFinite\(card\.score\) && <TrialRoleFit jobId=\{card\.job\.id\}\/>\}/);
});

test("a111DemoTailorsOwnResume: Draft 2's demonstration tailors the tester's OWN résumé — and never adds a skill it does not have", () => {
  const db = fresh(FIN(2));
  db.prepare("UPDATE users SET trial_resume = 'own' WHERE id = 1").run();
  onboard(db, 1, ANALYST);
  const lacks = ["Python", "Snowflake", "Looker", "dbt"];
  db.prepare("INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, board_category) VALUES ('fa::9', 't', 'h9', 'Senior Financial Analyst', 'Corvid Outfitters', 'https://example.com/9', ?, 'business')")
    .run(`Forecasting, variance analysis, Tableau and SQL. ${lacks.join(", ")}.`);
  // even a stored report naming a term the résumé lacks cannot put it in
  db.prepare("INSERT INTO ats_only_reports (user_id, job_id, ats_report, ats_score) VALUES (1, 'fa::9', ?, 61)").run(JSON.stringify({ tier1_matched: ["Tableau", "SQL", "Python"] }));
  drafted(db, 1, ["business-0", "fa::9"]);
  const d = demoState(db, 1);
  assert.deepEqual([d.ok, d.own, d.sample, d.runs.length], [true, true, null, 2]);
  for (const run of d.runs) {
    const t = run.tailoring;
    assert.deepEqual(t.before, ANALYST.split("\n"), "the tester's own résumé, whole, on the left");
    for (const term of t.terms) assert.ok(names(ANALYST, term), `${term}: only terms the résumé already shows`);
    const after = t.after.map(l => l.text).join("\n");
    for (const s of lacks) assert.equal(names(after, s), false, `${s} is never added`);
    const ownLines = new Set(ANALYST.split("\n").map(l => l.split(/[:,]\s*/).sort().join("|")));
    for (const l of t.after.filter(x => x.change !== "added" && x.text)) assert.ok(ownLines.has(l.text.split(/[:,]\s*/).sort().join("|")), l.text);
  }
  const nine = d.runs.find(r => r.jobId === "fa::9").tailoring;
  assert.deepEqual(nine.terms, ["Tableau", "SQL"], "the user's own report, filtered to what the résumé shows");
  assert.ok(nine.after.some(l => l.change === "added" && /^For the Senior Financial Analyst role at Corvid Outfitters: hands-on with Tableau and SQL/.test(l.text)));
  // deterministic per user × posting: the same résumé and posting give the same tailoring
  assert.deepEqual(demoState(db, 1).runs.map(r => r.tailoring.after), d.runs.map(r => r.tailoring.after));
  // a real résumé's mixed-case "Skills" heading is read too (the samples' is SKILLS)
  const mixed = ANALYST.replace("SKILLS", "Skills").replace("EDUCATION", "Education").replace("EXPERIENCE", "Experience");
  assert.deepEqual(simulateTailoring(mixed, { title: "Analyst", description: "Tableau and NetSuite" }).terms, ["Tableau", "NetSuite"]);
  // the sample path is unchanged: a sample account's replay is still the sample's
  const sDb = fresh(); sDb.prepare("UPDATE users SET trial_resume = 'A' WHERE id = 2").run();
  const p = sDb.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (2, 'p', 'engineering', 'it_digital', 1)").run();
  sDb.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, 2, ?, 'sample-a.txt')").run(p.lastInsertRowid, samples().A.resumeText);
  assert.equal(demoState(sDb, 2).sample, "A");
  assert.equal(demoState(sDb, 2).own, undefined);
});

test("a111DemoFormFromOwnResume: the practice form is filled from the résumé's own contact lines, else the account's", () => {
  const f = Object.fromEntries(ownFormFields(ANALYST, { first_name: "Account", last_name: "Holder", email: "account.holder@example.com" }).map(x => [x.label, x.value]));
  assert.deepEqual(f, { "First name": "Priya", "Last name": "Delacroix-Navarro", Email: "priya.delacroix@example.com", Phone: "(555) 010-7731",
    "Résumé": "the tailored résumé (PDF)", LinkedIn: "https://linkedin.com/in/example-priya-delacroix" });
  // a résumé with no contact lines: the account's name and sign-up email; nothing invented
  const bare = `EXPERIENCE\n${ANALYST.split("EXPERIENCE\n")[1]}`;
  const g = Object.fromEntries(ownFormFields(bare, { first_name: "Account", last_name: "Holder", email: "account.holder@example.com" }).map(x => [x.label, x.value]));
  assert.deepEqual([g["First name"], g["Last name"], g.Email, g.Phone, g.LinkedIn], ["Account", "Holder", "account.holder@example.com", "—", "—"]);
  // demoState hands them to the replay
  const db = fresh(FIN(2));
  db.prepare("UPDATE users SET trial_resume = 'own' WHERE id = 1").run();
  onboard(db, 1, PROJECT_MANAGER);
  drafted(db, 1, ["business-0", "business-1"]);
  const fields = Object.fromEntries(demoState(db, 1).fields.map(x => [x.label, x.value]));
  assert.deepEqual([fields["First name"], fields["Last name"], fields.Email], ["Marcus", "Oyelaran-Whitby", "marcus.oyelaran@example.com"]);
  assert.doesNotMatch(JSON.stringify(fields), /authori|sponsor|visa|gender|veteran|disab/i, "never an eligibility answer");
  const ui = read("client/src/components/TrialDemo.jsx");
  assert.match(ui, /<Page title="Your résumé" lines=\{t\.before\}\/>/);
});

test("a111TableShowsBothSent: the replay ends with both Sent on The Table and the confirmation in the Inbox — nothing reaches the employer", () => {
  const db = fresh(FIN(2));
  db.prepare("UPDATE users SET trial_resume = 'own' WHERE id = 1").run();
  onboard(db, 1, ANALYST);
  drafted(db, 1, ["business-0", "business-1"]);
  for (const id of ["business-0", "business-1"]) markPending(db, 1, id, "drafted");
  // ⛔ the safety rule: an own-résumé TRIAL account's Draft fills the practice form, never the employer's
  assert.match(trialSendUrl(db, { userId: 1, jobId: "business-0", baseUrl: "https://jobsviadraft.com", secret: "s" }), /\/try\/practice\/business-0\?u=1&t=/);
  const inbox = [];
  assert.equal(completeDemo(db, 1, { deliver: (m) => inbox.push(m) }).completed, 2);
  assert.deepEqual(listHistory(db, 1).map(r => r.status), ["sent", "sent"]);
  assert.ok(db.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE user_id = 1").all().every(r => r.status === "submitted" && r.reason_code === "demonstration"));
  assert.equal(inbox.length, 2);
  assert.ok(inbox.every(m => /draft's trial, a demonstration/.test(m.text) && /Nothing was sent to/.test(m.text)));
  assert.equal(trialState(db, 1).locked, true, "2 sent: the survey next, as on the sample path");
  // granted full access, the account is ordinary again: its runs go to the real posting
  db.prepare("UPDATE users SET full_access = 1 WHERE id = 1").run();
  assert.equal(trialSendUrl(db, { userId: 1, jobId: "business-0", baseUrl: "https://jobsviadraft.com", secret: "s" }), null);
});

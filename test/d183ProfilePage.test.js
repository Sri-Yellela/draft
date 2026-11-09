import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { saveSection } from "../services/structuredProfile.js";
import {
  readVisibility, setVisibility, effectiveLevel, visibleTo, profilePage, viewFor, placementFromResume,
  achievementsFromResume, linkKind, pageLinks, addAchievement, PAGE_SECTIONS,
} from "../services/profilePage.js";
import { MERGE_PLAN } from "../services/accountService.js";

// ⭐ D183 P1 (owner 11-08, TOP PRIORITY) · Profile = your page — private by default, each section's eye never wider than
// the page, the server omits what a viewer may not see. Synthetic person and companies.

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const PAGE_UI = lf("client/src/pages/profile/YourProfile.jsx");
const SECTIONS_UI = lf("client/src/components/ProfileSections.jsx");

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  db.prepare(`INSERT INTO user_profile (user_id,first_name,last_name,full_name,email,phone,location,address_line1,linkedin_url,github_url)
    VALUES (1,'Dana','Example','Dana Example','dana@example.test','617-555-0142','Boston, MA','12 Elm St','https://linkedin.com/in/dana-example','https://github.com/dana-example')`).run();
  db.prepare("INSERT INTO profile_sections (user_id) VALUES (1)").run();
  saveSection(db, 1, "summary", { summary: "Data engineer who builds streaming pipelines." });
  saveSection(db, 1, "experience", { items: [
    { company: "Northwind", title: "Data Engineer", start: "2023-01", current: true, bullets: ["Moved order events to Kafka streams"] },
  ] });
  return db;
}

test("d183PrivateByDefault — a new account's page and every section are Only you; search engines off", () => {
  const db = freshDb();
  const v = readVisibility(db, 1);
  assert.equal(v.page, "only_me");
  for (const id of PAGE_SECTIONS) assert.equal(v.effective[id], "only_me", id);
  assert.equal(v.searchable, false);
  const pub = viewFor(profilePage(db, 1), "public");
  assert.equal(pub.private, true);
  assert.deepEqual(pub.sections, {});
  assert.equal(pub.header, null);
});

test("d183SectionEyeNeverWiderThanPage — effective = the narrower of page and section", () => {
  assert.equal(effectiveLevel("only_me", "public"), "only_me");
  assert.equal(effectiveLevel("connections", "public"), "connections");
  assert.equal(effectiveLevel("public", "only_me"), "only_me");
  assert.equal(effectiveLevel("public", null), "public");
  const db = freshDb();
  setVisibility(db, 1, { section: "about", level: "public" });
  assert.equal(readVisibility(db, 1).effective.about, "only_me", "a section set wider than the page stays at the page");
  setVisibility(db, 1, { page: "public" });
  const v = readVisibility(db, 1);
  assert.equal(v.effective.about, "public");
  assert.equal(v.effective.fit, "only_me", "Where you fit starts at Only you even on a public page");
  assert.throws(() => setVisibility(db, 1, { page: "everyone" }), /Only you, Connections or Public/);
  assert.throws(() => setVisibility(db, 1, { section: "contact", level: "public" }), /No such section/);
});

test("d183ContactNeverPublic — no email, phone or address in the public view, whatever the setting", () => {
  const db = freshDb();
  setVisibility(db, 1, { page: "public" });
  const json = JSON.stringify(viewFor(profilePage(db, 1), "public"));
  for (const secret of ["dana@example.test", "617-555-0142", "12 Elm St"]) assert.ok(!json.includes(secret), secret);
  assert.ok(!PAGE_SECTIONS.includes("contact"), "contact is not a section — no eye can reach it");
});

test("d183ServerOmitsHiddenSections — a section the viewer may not see is not in the payload", () => {
  const db = freshDb();
  setVisibility(db, 1, { page: "public" });
  setVisibility(db, 1, { section: "experience", level: "only_me" });
  const pub = viewFor(profilePage(db, 1), "public");
  assert.ok(!("experience" in pub.sections));
  assert.ok(!("fit" in pub.sections));
  assert.ok(pub.hidden.includes("experience"));
  assert.ok(!JSON.stringify(pub).includes("Moved order events"), "the hidden bullets are not sent");
  assert.equal(pub.sections.about.summary, "Data engineer who builds streaming pipelines.");
  assert.equal(visibleTo("connection", "public"), true);
  assert.equal(visibleTo("public", "connections"), false);
  assert.ok(!("levelLabel" in (pub.header || {})), "the level stays with Where you fit");
  assert.match(lf("routes/profileSections.js"), /viewFor\(profilePage\(db, req\.user\.id\)/, "the preview is the server's filter");
});

test("d183PlacementFromResume — the résumé's title places the person in a subcategory with a level", () => {
  const p = placementFromResume({ titles: ["Data Engineer"], text: "Kafka Airflow dbt pipelines warehouse 2021 - present", years: 3 });
  assert.equal(p.subcategory, "data.engineering");
  assert.equal(p.categoryName, "Data and AI");
  assert.equal(p.level, "mid");
  assert.equal(placementFromResume({ titles: [], text: "" }), null);
});

test("d183LinksRenderAsLogos — GitHub and LinkedIn as their marks, with an aria-label; others a link icon + domain", () => {
  assert.equal(linkKind("https://www.github.com/x").kind, "github");
  assert.equal(linkKind("https://linkedin.com/in/x").kind, "linkedin");
  assert.equal(linkKind("https://example.dev").kind, "web");
  const links = pageLinks({ links: [{ url: "https://github.com/dana-example" }] }, { github_url: "https://github.com/dana-example/", linkedin_url: "https://linkedin.com/in/d" });
  assert.equal(links.length, 2, "the same address once");
  assert.match(PAGE_UI, /aria-label=\{aria\}/);
  assert.match(PAGE_UI, /on \$\{SITE\[kind\]\}/);
  assert.match(PAGE_UI, /data-link-mark=\{kind\}/);
});

test("d183BoldSkillsKept — the page draws its sections with the A140 editors and passes the job profile's terms", () => {
  // (pin brought to the code in 45o: the sections re-mount after a replace — `key` per round)
  assert.match(PAGE_UI, /<ProfileSections key=\{`page-\$\{round\}`\} theme=\{theme\} highlight=\{page\.highlight \|\| \[\]\}/);
  assert.match(SECTIONS_UI, /<BoldTerms text=\{b\} re=\{termRe\} \/>/);
  assert.match(lf("client/src/panels/ProfilePanel.jsx"), /\{resumeView && <ProfileSections/);
});

test("d183 achievements, merge plan and export", () => {
  const a = achievementsFromResume("Experience\nX\nCertifications\nAWS Certified Data Engineer – Associate (2025)\nEducation\nNEU");
  assert.deepEqual(a, [{ title: "AWS Certified Data Engineer – Associate", year: 2025, kind: "certification" }]);
  const db = freshDb();
  addAchievement(db, 1, { title: "Hackathon winner", year: 2024 });
  assert.ok(profilePage(db, 1).sections.achievements.items.some(x => x.source === "hand" && x.title === "Hackathon winner"));
  assert.throws(() => addAchievement(db, 1, { title: "" }), /Name the achievement/);
  assert.equal(MERGE_PLAN.profile_page, "keepInto");
  assert.equal(MERGE_PLAN.profile_achievements, "ifIntoEmpty");
});

// ── P2 · replacing the résumé ──────────────────────────────────────────────────────────────────────
import { snapshotForReplace, pageDigest, refillFromResume, whatChanged, recordReplacement, undoReplacement, latestReplacement, keepReplacement, UNDO_DAYS } from "../services/profileReplace.js";
import { readProfile } from "../services/structuredProfile.js";

const R1 = ["Dana Example", "SUMMARY", "Data engineer building pipelines.", "EXPERIENCE",
  "Data Engineer, Northwind Analytics    Jan 2023 - Present", "• Moved order events to Kafka streams", "• Rebuilt the warehouse in dbt",
  "EDUCATION", "Northeastern University, MS Computer Science, 2021", "SKILLS", "Kafka, dbt, SQL, Excel"].join("\n");
const R2 = R1.replace("Data Engineer, Northwind Analytics    Jan 2023 - Present",
  "Senior Data Engineer, Kestrel Payments    Jan 2025 - Present\n• Built Flink jobs\nData Engineer, Northwind Analytics    Jan 2023 - Dec 2024")
  .replace("Kafka, dbt, SQL, Excel", "Kafka, dbt, SQL, Flink, Snowflake");

function resumeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  db.prepare("INSERT INTO user_profile (user_id, full_name) VALUES (1, 'Dana Example')").run();
  db.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (1, 'r1.txt', ?)").run(R1);
  readProfile(db, 1);   // the first open fills the sections from R1
  return db;
}
function replaceWith(db, text) {
  const snap = snapshotForReplace(db, 1, null, { content: db.prepare("SELECT content FROM base_resume WHERE user_id=1").pluck().get(), name: "r1.txt" });
  const before = pageDigest(db, 1);
  db.prepare("UPDATE base_resume SET content = ?, name = 'r2.txt' WHERE user_id = 1").run(text);
  const refill = refillFromResume(db, 1);
  const changes = whatChanged(before, pageDigest(db, 1), refill.kept);
  return { id: recordReplacement(db, 1, null, snap, changes, { name: "r2.txt" }), changes, refill };
}
const skillNames = (db) => db.prepare("SELECT name FROM profile_skills WHERE user_id = 1 ORDER BY position").pluck().all();

test("d183ReplaceRefillsEverySection — a new résumé re-fills the sections and says what changed", () => {
  const db = resumeDb();
  const { changes, refill } = replaceWith(db, R2);
  assert.equal(refill.ok, true);
  assert.ok(skillNames(db).includes("Flink") && !skillNames(db).includes("Excel"));
  assert.ok(changes.lines.some(l => l.what === "skills" && l.kind === "added" && /Flink/.test(l.text)));
  assert.ok(changes.lines.some(l => l.what === "skills" && l.kind === "removed" && /Excel/.test(l.text)));
  assert.ok(changes.lines.some(l => l.what === "experience" && l.kind === "added"));
  assert.match(changes.untouched, /applications already sent/);
  assert.ok(latestReplacement(db, 1));
  assert.match(lf("routes/domainProfiles.js"), /refill = refillFromResume\(db, req\.user\.id\)/);
});

test("d183HandEditsSurviveReplace — an item the person added or changed is kept; unchanged items keep their résumé mark", () => {
  const db = resumeDb();
  const cur = readProfile(db, 1).sections;
  saveSection(db, 1, "skills", { items: [...cur.skills.map(s => ({ name: s.name, category: s.category })), { name: "Rust" }] });
  const src = Object.fromEntries(db.prepare("SELECT name, source FROM profile_skills WHERE user_id = 1").all().map(r => [r.name, r.source]));
  assert.equal(src.Rust, "user");
  assert.equal(src.Kafka, "resume", "saved unchanged → still the résumé's");
  saveSection(db, 1, "summary", { summary: "My own words." });
  replaceWith(db, R2);
  assert.ok(skillNames(db).includes("Rust"));
  assert.equal(db.prepare("SELECT summary FROM profile_sections WHERE user_id = 1").pluck().get(), "My own words.");
});

test("d183UndoRestores — Undo puts the old résumé's sections back, once, within 30 days", () => {
  const db = resumeDb();
  const before = skillNames(db);
  const { id } = replaceWith(db, R2);
  undoReplacement(db, 1, id);
  assert.deepEqual(skillNames(db), before);
  assert.throws(() => undoReplacement(db, 1, id), /already undone/);
  const late = replaceWith(db, R2).id;
  db.prepare("UPDATE profile_replacements SET created_at = created_at - ? WHERE id = ?").run((UNDO_DAYS + 1) * 86400, late);
  assert.throws(() => undoReplacement(db, 1, late), /30 days/);
  const k = replaceWith(db, R1).id;
  keepReplacement(db, 1, k);
  assert.equal(latestReplacement(db, 1), null, "Looks right puts the summary away");
});

test("d183ProvenNeverReverts — a skill proven in Atlas stays on the list when the new résumé drops it", () => {
  const db = resumeDb();
  db.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via) VALUES (1, 'excel', 'Excel', 'checked', 'check')").run();
  const { refill } = replaceWith(db, R2);
  assert.ok(skillNames(db).includes("Excel"));
  assert.deepEqual(refill.kept.proven, ["Excel"]);
});

// ── P3 · the public page /in/<handle> ────────────────────────────────────────────────────────────────
import express from "express";
import publicProfileRoutes, { publicViewFor, renderPublicProfile, indexable, fileReport, REPORTS_PER_DAY } from "../routes/publicProfile.js";
import proofPageRoutes from "../routes/proofPage.js";
import { setProofPage } from "../services/proofLinks.js";

async function serve(db, mount) {
  const app = express();
  mount(app);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close() };
}

test("d183PublicNoindexByDefault — private says so; public is noindex until the person switches search engines on", async () => {
  const db = freshDb();
  setProofPage(db, 1, { handle: "dana-example", enabled: false });
  const s = await serve(db, (app) => publicProfileRoutes(app, db, {}));
  try {
    let r = await fetch(`${s.base}/in/dana-example`); let html = await r.text();
    assert.equal(r.status, 200);
    assert.match(html, /This profile is private\./);
    assert.ok(!html.includes("Data engineer who builds"), "nothing of a private page is sent");
    setVisibility(db, 1, { page: "public" });
    r = await fetch(`${s.base}/in/dana-example`); html = await r.text();
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.equal(r.headers.get("x-robots-tag"), "noindex");
    for (const secret of ["dana@example.test", "617-555-0142", "12 Elm St"]) assert.ok(!html.includes(secret), secret);
    assert.match(html, /data-link-mark="github"/);
    assert.match(html, /not a certification/);
    setVisibility(db, 1, { searchable: true });
    r = await fetch(`${s.base}/in/dana-example`); html = await r.text();
    assert.ok(!/noindex/.test(html) && r.headers.get("x-robots-tag") == null, "indexed only on the person's yes");
    assert.equal((await fetch(`${s.base}/in/nobody-here`)).status, 404);
  } finally { s.close(); }
  assert.equal(indexable({ private: true, searchable: true }), false);
});

test("d183ProofPageRedirects — /p/<handle> answers 301 to /in/<handle>; a proof-page user starts Public for projects + skills only", async () => {
  const db = freshDb();
  const s = await serve(db, (app) => proofPageRoutes(app, db));
  try {
    const r = await fetch(`${s.base}/p/dana-example`, { redirect: "manual" });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/in/dana-example");
  } finally { s.close(); }
  const m = MIGRATIONS.find(x => x.id === "245_profile_public_page");
  assert.ok(m, "migration 245");
  const db2 = new Database(":memory:");
  for (const x of MIGRATIONS) {
    if (x.id === m.id) {
      db2.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'eli','x')").run();
      db2.prepare("INSERT INTO proof_pages (user_id, handle, enabled) VALUES (7, 'eli-ex', 1)").run();
    }
    db2.exec(x.sql);
  }
  const v = readVisibility(db2, 7);
  assert.equal(v.page, "public");
  assert.equal(v.effective.projects, "public");
  assert.equal(v.effective.skills, "public");
  for (const id of ["about", "experience", "fit", "achievements", "education", "links"]) assert.equal(v.effective[id], "only_me", id);
});

test("d183ReportReachesQueue — a report lands in profile_reports, rate-limited per sender a day", async () => {
  const db = freshDb();
  setProofPage(db, 1, { handle: "dana-example", enabled: false });
  setVisibility(db, 1, { page: "public" });
  const s = await serve(db, (app) => publicProfileRoutes(app, db, {}));
  try {
    const r = await fetch(`${s.base}/in/dana-example/report`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "reason=spam&details=selling+things" });
    assert.equal(r.status, 200);
    const row = db.prepare("SELECT reported_user_id, reason, details, status FROM profile_reports").get();
    assert.deepEqual(row, { reported_user_id: 1, reason: "spam", details: "selling things", status: "open" });
  } finally { s.close(); }
  for (let i = 0; i < REPORTS_PER_DAY + 2; i++) fileReport(db, { userId: 1, handle: "dana-example", reason: "fake", reporterHash: "same" });
  assert.equal(db.prepare("SELECT COUNT(*) FROM profile_reports WHERE reporter_hash = 'same'").pluck().get(), REPORTS_PER_DAY);
  assert.match(renderPublicProfile(publicViewFor(db, "dana-example")), /Report this profile/);
});

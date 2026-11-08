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
  assert.match(PAGE_UI, /<ProfileSections theme=\{theme\} highlight=\{page\.highlight \|\| \[\]\}/);
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

// ⛔ D74 (10-07) · THE CLASSIFIER DROPPED POSTINGS THE BOARD SHOULD KEEP.
//
// A live re-fetch of the 20 configured boards: ~27% of fetched postings were DROPPED (no family), and
// ~4 in 10 of those plainly belong to a family the board keeps. D74_STRONG_ANCHORS (services/
// jobClassifier.js) rescued 341 of 765 on that fetch with 0 newly dropped (scripts/d74ClassifierDiff.mjs).
// These pin it: real titles from that fetch reach their family; the ten collisions the first draft
// caused stay in their families; no strong anchor is shared by two families (a shared phrase scores
// "ambiguous" and drops the title); and the 'general' re-file moves only classifier rows.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { classifyJob } from "../services/jobs/classifyJob.js";
import { SIGNALS } from "../services/jobClassifier.js";
import { remapGeneralRows, REMAP_MATCHED_BY } from "../services/jobs/remapGeneralRoles.js";

const family = (title) => classifyJob(title, "", "").roleKey;

test("D74: postings the live boards dropped now reach their family", () => {
  const RESCUED = {
    "Senior Manager, Platform Product Management (Payments)": "pm",
    "Manager, Product Management - Figma Platform Experience": "pm",
    "Data Science Intern (2027)": "data",
    "Director, Data Science": "data",
    "RE / RS - Foundations, Search": "data",
    "Agent Post-Training, Computer Use Research": "data",
    "Research Economist, Economic Research": "data",
    "Director, Product Design": "design",
    "Staff UX Writer, AI": "design",
    "Director, US International Tax": "finance",
    "Strategic Finance, Compute": "finance",
    "Manager, Revenue Accounting": "finance",
    "Head of Payroll & Equity": "finance",
    "Account Director, Insurance": "sales",
    "Enterprise Client Sales Executive": "sales",
    "Manager, Customer Success Enterprise": "sales",
    "Manager, Sales Development": "sales",
    "Growth Marketing Lead, Programmatic & Video": "marketing",
    "Product Marketing Lead, Billing": "marketing",
    "Senior Technical Sourcer": "hr",
    "People Partner, EPD": "hr",
    "Head of Regulatory Affairs": "legal",
    "Sanctions Compliance Lead": "legal",
    "Manager, Payment Operations": "operations",
    "Red Team Specialist - Cyber": "engineering",
  };
  for (const [title, fam] of Object.entries(RESCUED)) assert.equal(family(title), fam, title);
});

test("D74: the first draft's collisions stay where they were — a narrower anchor, never a shared one", () => {
  const KEPT = {
    "Product Manager, Treasury for Platforms": "pm",
    "Account Executive, Product - Issuing & Treasury (Grower)": "sales",
    "Recruiting Project Manager": "pm",
    "Partnerships Manager, Accounting Channel": "sales",
    "Program Manager - Podcast Sales Strategy & Solutions": "pm",
    "Product Operations Manager": "operations",
    "Software Engineer, Bill Pay & Procurement": "engineering",
    "Data Scientist, Marketing Analytics": "data",
    "People Research Scientist, Recruiting": "data",
    "Specialist Solutions Architect, Tax": "engineering",
  };
  for (const [title, fam] of Object.entries(KEPT)) assert.equal(family(title), fam, title);
});

test("D74: no strong anchor is claimed by two families", () => {
  const owner = new Map(), shared = [];
  for (const [fam, s] of Object.entries(SIGNALS)) {
    for (const a of s.strongAnchors) {
      if (owner.has(a) && owner.get(a) !== fam) shared.push(`${a}: ${owner.get(a)} + ${fam}`);
      owner.set(a, fam);
    }
  }
  assert.deepEqual(shared, []);
});

test("D74: the 'general' re-file moves classifier rows only, once, and a dry run writes nothing", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const add = (id, title) => db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, is_active)
                                         VALUES (?, 't', ?, ?, 'Synthetic Co', ?, 'greenhouse', '', 1)`).run(id, `h-${id}`, title, `https://example.com/${id}`);
  const map = (id, profile = null) => db.prepare(`INSERT INTO job_role_map (job_id, role_key, role_family, source_profile_id, confidence, matched_by)
                                                   VALUES (?, 'general', 'general', ?, 0.5, 'classifier')`).run(id, profile);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain) VALUES (7, 1, 'p', 'engineering', 'engineering')").run();
  add("a", "Data Science Intern (2027)"); map("a");                 // now nameable → moves to data
  add("b", "Brex Rotational Program");    map("b");                 // still not nameable → stays general
  add("c", "Director, Product Design");   map("c", 7);              // profile-derived → never touched
  const rows = () => db.prepare("SELECT job_id, role_key, matched_by FROM job_role_map ORDER BY job_id").all();
  const before = rows();
  assert.equal(remapGeneralRows(db, { dryRun: true }).candidates, 1);
  assert.deepEqual(rows(), before, "a dry run writes nothing");
  assert.equal(remapGeneralRows(db).moved, 1);
  assert.deepEqual(rows(), [
    { job_id: "a", role_key: "data", matched_by: REMAP_MATCHED_BY },
    { job_id: "b", role_key: "general", matched_by: "classifier" },
    { job_id: "c", role_key: "general", matched_by: "classifier" },
  ]);
  assert.equal(remapGeneralRows(db).moved, 0, "idempotent");
});

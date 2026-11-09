// ⭐ FIRST PRIORITY (B)-4 (45o, owner 11-08) · only the job profile whose résumé changed moves. Synthetic résumés only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { followProfileText } from "../services/resumeOnboarding.js";
import { dealAgain } from "../services/profileReplace.js";

const BACKEND = "Jordan Example\nSenior Backend Engineer, Northwind (2019 - present)\nBuilt APIs and services on Postgres and Kafka queues; owned databases and on-call.\nSoftware Engineer, Contoso (2015 - 2019)";
const CONSTRUCTION = "Jordan Example\nConstruction Project Manager, Brickworks (2016 - present)\nRan site schedules, subcontractors, budgets and safety for commercial builds.\nAssistant Project Manager, Mason & Co (2012 - 2016)";

test("b4OtherProfilesUntouched · a replace on one job profile leaves the person's other profile, its placement and its picks as they were", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')").run();
  const ins = db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (?, 1, ?, 'general', 'general', ?)");
  ins.run(10, "Backend", 1); ins.run(11, "Second", 0);
  followProfileText(db, 10, BACKEND, { registry: getRegistry() });
  followProfileText(db, 11, BACKEND, { registry: getRegistry() });
  const cols = "domain, role_family, seniority, placement_category, placement_subcategory, placement_level, placed_at";
  const other = db.prepare(`SELECT ${cols} FROM domain_profiles WHERE id = 11`).get();
  const deal = db.prepare("INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json, dealt_at) VALUES (1, ?, '2026-11-08', ?, ?, 'strong', '{}', unixepoch())");
  deal.run(10, 0, "a"); deal.run(11, 0, "b");
  followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  dealAgain(db, 1, 10);
  assert.equal(db.prepare("SELECT domain FROM domain_profiles WHERE id = 10").pluck().get(), "pm_construction");
  assert.deepEqual(db.prepare(`SELECT ${cols} FROM domain_profiles WHERE id = 11`).get(), other, "the other profile is untouched");
  assert.equal(db.prepare("SELECT COUNT(*) FROM daily_drafts WHERE profile_id = 11").pluck().get(), 1, "its picks stay");
});

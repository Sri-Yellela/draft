// D185-2 (45q, owner 11-09) · new-match alerts: top tier only, live + not a ghost, digest by default / instant opt-in,
// capped per day, and time-to-alert measured per source. One fully migrated in-memory db; the "read workers" are the db.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  runMatchAlerts, topTierMin, dueFor, matchAlertTimings, setMatchAlertSettings, readMatchAlertSettings,
  DAILY_JOB_CAP, MAX_INSTANT_MESSAGES, MATCH_ALERT_EVENT,
} from "../services/jobs/newMatchAlerts.js";
import { resetSkillTiers } from "../services/jobs/skillTiers.js";
import { NOTIFY_EVENTS, eventEmail, eventText } from "../services/notify.js";
import { MERGE_PLAN } from "../services/accountService.js";

const NOW = Date.parse("2026-11-09T15:00:00Z") / 1000;   // 15:00 UTC — past the default 09:00 digest hour
const RESUME = "Python Python Python Django Django PostgreSQL PostgreSQL Kubernetes AWS";   // 5 top skills

function world({ sponsorship = null } = {}) {
  resetSkillTiers();
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (7, 'maya', 'h:x', 1)").run();
  db.prepare("INSERT INTO user_profile (user_id, email, sponsorship_need) VALUES (7, 'maya@example.com', ?)").run(sponsorship);
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active, placement_subcategory, placement_level, placed_at)
    VALUES (70, 7, 'Backend', 'engineering', 'software', 1, 'swe.backend', 'mid', 1)`).run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, updated_at) VALUES (70, 7, ?, 1)").run(RESUME);
  return db;
}
let n = 0;
function job(db, { tech, ghost = null, active = 1, seenAgo = 600, posted = null, source = "greenhouse", company = "Northwind", sub = "swe.backend", id = null }) {
  const jobId = id || `j${++n}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, is_active, ghost_level, discovered_at, posted_at)
    VALUES (?, 'q', ?, ?, ?, ?, ?, ?, ?, ?)`).run(jobId, company, `Engineer ${jobId}`, jobId, source, active, ghost, NOW - seenAgo, posted);
  db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'swe', ?, 'v1', 1)").run(jobId, sub);
  for (const t of tech) db.prepare("INSERT INTO job_tech (job_id, tech) VALUES (?, ?)").run(jobId, t);
  return jobId;
}
const read = (db) => ({ all: async (sql, p = []) => db.prepare(sql).all(...p), get: async (sql, p = []) => db.prepare(sql).get(...p) });
function sink() { const sent = []; return { sent, notify: async (u, ev, data) => { sent.push({ u, ev, data }); return {}; } }; }
const ALL5 = ["Python", "Django", "PostgreSQL", "Kubernetes", "AWS"];

test("d185AlertsTopTierOnly: only postings asking for most of the top skills, live, not a ghost, in the placement", async () => {
  const db = world();
  assert.equal(topTierMin(5), 4); assert.equal(topTierMin(2), 2); assert.equal(topTierMin(8), 6); assert.equal(topTierMin(0), 0);
  const top = job(db, { tech: ALL5 });
  const four = job(db, { tech: ALL5.slice(0, 4) });
  job(db, { tech: ALL5.slice(0, 3) });                          // tier 3 of 5 — the board shows it lower; it never alerts
  job(db, { tech: ALL5, ghost: 2 });                            // Likely not hiring
  job(db, { tech: ALL5, active: 0 });                           // closed
  job(db, { tech: ALL5, sub: "swe.frontend" });                 // another placement
  job(db, { tech: ALL5, seenAgo: 3 * 86400 });                  // older than the new window
  const s = sink();
  const sent = await runMatchAlerts(db, read(db), s.notify, { nowSec: NOW });
  assert.equal(sent, 1);
  assert.equal(s.sent[0].ev, MATCH_ALERT_EVENT);
  assert.deepEqual(s.sent[0].data.items.map(i => i.url.split("job=")[1]).sort(), [four, top].sort());
  // At most once: the next sweep (instant now) finds nothing new to say.
  setMatchAlertSettings(db, 7, { mode: "instant" });
  const s2 = sink();
  await runMatchAlerts(db, read(db), s2.notify, { nowSec: NOW + 600 });
  assert.equal(s2.sent.length, 0, "a job alerted once is never alerted again");
});

test("d185AlertsCapped: a digest once a local day at the hour; instant at most 3 messages; never more than 10 jobs a day", async () => {
  assert.equal(DAILY_JOB_CAP, 10); assert.equal(MAX_INSTANT_MESSAGES, 3);
  // The digest waits for the hour and goes once.
  assert.equal(dueFor({ mode: "digest", hour: 9, tz_offset_min: 0 }, { jobs: 0, messages: 0 }, Date.parse("2026-11-09T08:00:00Z") / 1000).due, false);
  assert.equal(dueFor({ mode: "digest", hour: 9, tz_offset_min: 0, last_digest_day: "2026-11-09" }, { jobs: 0, messages: 0 }, NOW).due, false);
  assert.equal(dueFor({ mode: "instant" }, { jobs: 3, messages: 3 }, NOW).reason, "message_cap");
  assert.equal(dueFor({ mode: "instant" }, { jobs: 10, messages: 1 }, NOW).reason, "daily_cap");
  assert.equal(dueFor({ mode: "off" }, { jobs: 0, messages: 0 }, NOW).due, false);

  const db = world();
  for (let i = 0; i < 14; i++) job(db, { tech: ALL5 });
  const s = sink();
  await runMatchAlerts(db, read(db), s.notify, { nowSec: NOW });
  assert.equal(s.sent[0].data.items.length, 10, "the day's cap");
  for (let i = 0; i < 5; i++) job(db, { tech: ALL5, seenAgo: 60 });
  setMatchAlertSettings(db, 7, { mode: "instant" });
  const s2 = sink();
  await runMatchAlerts(db, read(db), s2.notify, { nowSec: NOW + 600 });
  assert.equal(s2.sent.length, 0, "the cap holds across modes for the rest of the day");

  // Off, or both channels off → nobody is swept.
  const db3 = world();
  job(db3, { tech: ALL5 });
  db3.prepare("INSERT INTO notification_prefs (user_id, event, push, email) VALUES (7, 'new_match', 0, 0)").run();
  const s3 = sink();
  await runMatchAlerts(db3, read(db3), s3.notify, { nowSec: NOW });
  assert.equal(s3.sent.length, 0);
  assert.equal(readMatchAlertSettings(world(), 7).mode, "digest", "a daily digest is the default");
  assert.deepEqual(NOTIFY_EVENTS.new_match.defaults, { push: false, email: true });
});

test("d185TimeToAlertMeasured: every alerted job is a row with its posting date and when draft saw it; Admin reads it per source", async () => {
  const db = world();
  job(db, { tech: ALL5, source: "greenhouse", posted: new Date((NOW - 3600) * 1000).toISOString(), seenAgo: 1800 });
  job(db, { tech: ALL5, source: "lever", posted: null, seenAgo: 1200 });
  await runMatchAlerts(db, read(db), sink().notify, { nowSec: NOW });
  const rows = db.prepare("SELECT source, posted_at, discovered_at, alerted_at FROM match_alerts ORDER BY source").all();
  assert.equal(rows.length, 2);
  const t = matchAlertTimings(db, { nowSec: NOW + 1 });
  const gh = t.sources.find(s => s.source === "greenhouse");
  assert.equal(gh.postingToAlertMin.p50, 60);
  assert.equal(gh.seenToAlertMin.p50, 30);
  const lv = t.sources.find(s => s.source === "lever");
  assert.equal(lv.noPostingDate, 1);
  assert.equal(lv.postingToAlertMin.p50, null, "no posting date → not counted as a fast alert");
  assert.equal(t.total, 2); assert.equal(t.people, 1);
});

test("d185AlertsBeachhead: a person who needs sponsorship sees sponsors first, and the email says so; the push names nothing", async () => {
  const db = world({ sponsorship: "future" });
  job(db, { tech: ALL5, company: "Plainco", seenAgo: 60 });
  const sp = job(db, { tech: ALL5, company: "Sponsorco", seenAgo: 900 });
  db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
    .run("LCA_FY2025_Q4.xlsx", "FY2025Q4", 2025, 4, "https://www.dol.gov/x/LCA_Disclosure_Data_FY2025_Q4.xlsx");
  // Filings in every fiscal year the signal could read as "latest".
  const years = JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(2015 + i), 5])));
  db.prepare(`INSERT INTO company_lca_sponsorship (company, match_status, match_confidence, by_fiscal_year_json, first_seen, last_seen)
    VALUES ('Sponsorco', 'matched', 0.9, ?, 1, 1)`).run(years);
  const s = sink();
  await runMatchAlerts(db, read(db), s.notify, { nowSec: NOW });
  const items = s.sent[0].data.items;
  assert.equal(items[0].url.split("job=")[1], sp, "the sponsor leads, though the other posting is newer");
  assert.equal(items[0].sponsor, true);
  const mail = eventEmail("new_match", s.sent[0].data, "https://draft.example");
  assert.match(mail.text, /H-1B filing record first/);
  assert.match(mail.text, /Not legal advice/);
  assert.match(mail.text, /asks for 5 of your 5 top skills/);
  const line = eventText("new_match", { count: 2, company: "Sponsorco" });
  assert.equal(line.body, "2 new jobs fit your résumé.");
});

test("d185 alerts: wired — the sweep on the read workers, the routes, the merge plan, migration 258 in both runners", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.ok(server.includes("runMatchAlertsSlice(db, readPool,"), "the candidates are read on the workers (A126), as job-system slices (D151 Rule 2)");
  assert.ok(server.includes('app.put("/api/alerts/matches/settings", requireAuth'));
  assert.ok(server.includes('app.get("/api/admin/match-alerts", requireAdmin'));
  assert.equal(MERGE_PLAN.match_alerts, "keepInto"); assert.equal(MERGE_PLAN.match_alert_settings, "keepInto");
  const mig = fs.readFileSync(new URL("../scripts/migrations.js", import.meta.url), "utf8");
  const BLOCK = /id: "258_match_alerts",[\s\S]*?\r?\n    \},/;
  assert.equal(server.match(BLOCK)?.[0], mig.match(BLOCK)?.[0]);
  assert.ok(mig.match(BLOCK));
});

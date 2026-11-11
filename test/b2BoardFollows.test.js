// ⭐ FIRST PRIORITY (B)-2 (45o, owner 11-08) · WHAT FOLLOWS A PLACEMENT CHANGE — the spec's named tests: b2SentenceFilterFollows ·
// b2PicksRebuiltOnReplace · b2UndoRestoresBoard. Synthetic résumés only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { followProfileText } from "../services/resumeOnboarding.js";
import { snapshotForReplace, recordReplacement, undoReplacement, dealAgain, whatChanged } from "../services/profileReplace.js";

const BACKEND = "Jordan Example\nSenior Backend Engineer, Northwind (2019 - present)\nBuilt APIs and services on Postgres and Kafka queues; owned databases and on-call.\nSoftware Engineer, Contoso (2015 - 2019)";
const CONSTRUCTION = "Jordan Example\nConstruction Project Manager, Brickworks (2016 - present)\nRan site schedules, subcontractors, budgets and safety for commercial builds.\nAssistant Project Manager, Mason & Co (2012 - 2016)";
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')").run();
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (10, 1, 'My job profile', 'general', 'general', 1)").run();
  return db;
}
const deal = (db, n = 3) => {
  const ins = db.prepare("INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json, dealt_at) VALUES (1, 10, '2026-11-08', ?, ?, 'strong', '{}', unixepoch())");
  for (let i = 0; i < n; i++) ins.run(i, `j${i}`);
};
const dealt = (db) => db.prepare("SELECT COUNT(*) FROM daily_drafts WHERE user_id = 1 AND profile_id = 10").pluck().get();

test("b2PicksRebuiltOnReplace · a replace that places deals today's picks again (now, not tomorrow)", () => {
  const db = freshDb();
  deal(db);
  assert.equal(dealt(db), 3);
  const out = followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  assert.ok(out.placement?.placed);
  dealAgain(db, 1, 10);
  assert.equal(dealt(db), 0, "the next read deals again from the new placement");
  const src = fs.readFileSync("routes/domainProfiles.js", "utf8");
  assert.match(src, /if \(followed\?\.placement\) \{ try \{ dealAgain\(db, req\.user\.id, profile\.id\); \}/, "the replace route does it");
});

test("b2UndoRestoresBoard · Undo puts the role, the level AND the placement back, and deals again", () => {
  const db = freshDb();
  followProfileText(db, 10, BACKEND, { registry: getRegistry() });
  const was = db.prepare("SELECT domain, placement_category, placement_subcategory FROM domain_profiles WHERE id = 10").get();
  assert.equal(was.placement_subcategory, "swe.backend");
  const snap = snapshotForReplace(db, 1, 10, { content: BACKEND, name: "old.pdf" });
  followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  assert.equal(db.prepare("SELECT domain FROM domain_profiles WHERE id = 10").pluck().get(), "pm_construction");
  const rid = recordReplacement(db, 1, 10, snap, { lines: [] }, { name: "new.pdf" });
  deal(db);
  undoReplacement(db, 1, rid);
  const back = db.prepare("SELECT domain, placement_category, placement_subcategory FROM domain_profiles WHERE id = 10").get();
  assert.deepEqual(back, was);
  assert.equal(dealt(db), 0, "the board follows the restored placement");
});

test("b2SentenceFilterFollows · the board's role word follows a NEW placement (a .general one narrows to its category); What changed says what followed", () => {
  const ui = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(ui, /if \(String\(seen\) === String\(p\.placed_at\)\) return;/, "only a new placement moves it — the person's own board choice stays");
  // D184 B-7 (45p): the role comes through sentenceFromResume (a .general placement narrows to its category there —
  // shared/resumeSentence.js, pinned by d184ResumeChange's b7SentenceFromResume) with the level, workstyles and city.
  assert.match(ui, /const next = sentenceFromResume\(\{ category: p\.placement_category, subcategory: p\.placement_subcategory/);
  // D186-5 (45s, on purpose): + the placement's "also fits", searched beside the role.
  assert.match(ui, /setTaxRole\(\{ category: next\.category, subcategory: next\.subcategory, also \}\);/);
  const before = { headline: null, experience: [], fromResume: [], proven: [], placement: { path: "Software engineering › Backend", level: "Senior" } };
  const after = { ...before, placement: { path: "Project and program management › Construction", level: "Senior" } };
  const line = whatChanged(before, after).lines.find(l => l.what === "fit");
  assert.match(line.text, /Project and program management › Construction/);
  assert.match(line.detail, /your board now shows Project and program management › Construction jobs · the sentence follows the résumé .* · today's picks are dealt again/);   // D184 B-7
  assert.match(line.detail, /Apply for me looks for the same/);
});

// ⭐ 46f · B-2's last piece: "— N picks today" on the Where-you-fit line, read from today's deal (the deck's own call) — the
// count is never written into the line (it cannot be known then) and nothing is claimed while the board is still scoring.
test("b2PicksTodayOnTheFitLine: What changed reads today's deal and says how many picks it holds", () => {
  const src = fs.readFileSync("client/src/pages/profile/YourProfile.jsx", "utf8");
  assert.match(src, /api\(`\/api\/draft\/today\?date=\$\{encodeURIComponent\(localDay\(\)\)\}&order=best`\)/);
  assert.match(src, /if \(live && d\?\.reason !== "scoring" && Array\.isArray\(d\?\.cards\)\) setN\(d\.cards\.length\);/);
  assert.match(src, /const picks = usePicksToday\(r\.lines\.some\(l => l\.what === "fit" && l\.detail\)\);/);
  assert.match(src, /\{l\.what === "fit" && picks != null \? <span data-change-picks=""> — \{picks\} pick\{picks === 1 \? "" : "s"\} today<\/span> : null\}/);
});

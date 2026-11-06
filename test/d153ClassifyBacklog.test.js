// ⛔⛔ D153 (3) · CLASSIFY THE BOARD'S BACKLOG AS A BACKGROUND JOB (owner 11-04: "43,009 of 52,681 postings with no kind
// of work on file"). Measured on the 18k copy (l44z, 11-05): the kind of work came only from the role bucket, and the
// bucket 'general' maps to nothing — 3,259 of 16,740 shown postings (19.5 %) had none although D127 had categorised
// them; with D127's in-scope verdict deriving it, 98.8 %. These tests pin: coverage on synthetic titles, the leak rule
// (a held / unknown title is never given a kind of work or a category), the walk's yielding pages, idempotence, the
// tagger using the same rule, and the job's wiring (after ready, /api/version).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { categoryOf } from "../services/jobs/professionalScope.js";
import { functionForCategory, functionFromTitle } from "../services/jobs/categoryFunction.js";
import { classifyPage, createClassifyBacklog, postingFunction } from "../services/jobs/classifyBacklog.js";
import { tagFunction, deriveTags } from "../services/jobs/jobTags.js";
import { JOB_FUNCTIONS } from "../shared/jobTagVocabulary.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const quiet = { log() {}, error() {}, warn() {} };
const VOCAB = new Set(JOB_FUNCTIONS.options.map(o => o.value));

// Professional titles the role classifier files under 'general' (real-shaped, from the copy's misses; no person).
const PROFESSIONAL_GENERAL = [
  ["Engineering Manager, Customer Platform", "engineering"],
  ["Senior Director of Engineering, New Subjects", "engineering"],
  ["Machine Learning Engineer, Ranking", "data"],
  ["Mechanical Engineer, Dynamometer Testing", "engineering"],
  ["PCB Layout Engineer, Robotics", "engineering"],
  ["Senior Accountant", "finance"],
  ["Underwriting Senior Analyst", "finance"],
  ["People Consultant", "people"],
  ["Talent Relations Manager", "people"],
  ["Deployment Strategist", "operations"],
  ["Senior Manager, Occupancy Planning & Workplace Strategy", "operations"],
  ["Presentation Designer", "design"],
  ["Senior Editor, Podcast Editorial", "marketing"],
  ["Marketing Designer", "marketing"],
  ["Senior Vendor Manager - SMB Sales", "sales"],
  ["Immigration & Global Mobility Program Manager", "product"],
  ["Paralegal", "legal"],
  ["Data Analyst, Business Intelligence", "data"],
];
// Held / unknown titles: never a kind of work, never a category (D127 P2).
const HELD_TITLES = ["Registered Nurse", "Warehouse Associate - 2nd Shift", "Store Manager", "Executive Assistant",
  "High School Teacher", "Field Service Engineer", "Barista", "Delivery Driver", "", "Line Cook", "Personal Banker"];

test("d153 coverage on synthetic titles: a 'general' professional posting gets its kind of work from D127's verdict", () => {
  let hit = 0;
  for (const [title, want] of PROFESSIONAL_GENERAL) {
    const got = tagFunction("general", title);
    assert.ok(got === null || VOCAB.has(got), `${title}: ${got} is in the closed vocabulary`);
    assert.equal(got, want, title);
    if (got) hit++;
  }
  assert.ok(hit / PROFESSIONAL_GENERAL.length >= 0.95, `coverage ${hit}/${PROFESSIONAL_GENERAL.length}`);
  // The bucket still wins when it names a function; the title alone is never needed for those.
  assert.equal(tagFunction("sales", "Senior Accountant"), "sales");
  assert.equal(tagFunction("pm"), "product");
  assert.equal(tagFunction("general"), null, "no title: exactly the bucket's function, as before (D29)");
});

test("d153 leak rule: a held or unknown title is never given a kind of work", () => {
  for (const t of HELD_TITLES) {
    const v = categoryOf({ title: t, roleKey: "general" });
    assert.equal(v.inScope, false, `${t || "(empty)"} is held by D127`);
    assert.equal(functionForCategory(v, t), null, `${t}: held → no function`);
    assert.equal(tagFunction("general", t), null, `${t}: the tagger agrees`);
  }
  // A category with no function in the vocabulary, or a subject-less manager title, stays unknown — not guessed.
  assert.equal(functionFromTitle("Economist"), null);
  assert.equal(functionFromTitle("Researcher, Training"), null);
  assert.equal(functionFromTitle("Global Head of Land Revenue"), null);
  assert.equal(functionForCategory(null, "x"), null);
  // deriveTags reads the title for the fallback.
  assert.equal(deriveTags({ title: "Senior Accountant", role_key: "general", location: "Boston, MA" }).job_function, "finance");
  assert.equal(deriveTags({ title: "Registered Nurse", role_key: "general", location: "Boston, MA" }).job_function, null);
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
function insert(db, id, title, roleKey, { category, fn, active = 1, owner = null } = {}) {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
      board_category, tag_function, tag_owner_json)
    VALUES (?, 't', ?, ?, 'Acme', ?, 'greenhouse', ?, unixepoch(), ?, ?, ?)`)
    .run(id, `h-${id}`, title, `https://example.com/${id}`, active, category ?? null, fn ?? null, owner);
  if (roleKey) db.prepare("INSERT INTO job_role_map (job_id, role_key, matched_by) VALUES (?, ?, 'ats_cache')").run(id, roleKey);
}
const row = (db, id) => db.prepare("SELECT board_category, tag_function FROM scraped_jobs WHERE job_id = ?").get(id);

function board() {
  const db = db0();
  PROFESSIONAL_GENERAL.forEach(([t], i) => insert(db, `g${i}`, t, "general"));
  HELD_TITLES.filter(Boolean).forEach((t, i) => insert(db, `h${i}`, t, "general"));
  insert(db, "eng", "Senior Software Engineer", "engineering");                        // bucket names it
  insert(db, "stored", "Senior Accountant", "general", { category: "business" });       // categorised by an earlier pass
  insert(db, "owner", "Senior Accountant", "general", { owner: JSON.stringify({ job_function: "legal" }) });
  insert(db, "kept", "Senior Accountant", "general", { category: "business", fn: "people" });   // never overwritten
  insert(db, "gone", "Senior Accountant", "general", { active: 0 });                    // retired: not touched
  return db;
}

test("d153BacklogClassifiedAsJob: the walk fills categories and kinds of work, never for a held posting, never overwrites", async () => {
  const db = board();
  const job = createClassifyBacklog(db, { pageRows: 5, log: quiet });
  const s = await job.run("test");
  assert.equal(s.state, "done");
  for (let i = 0; i < PROFESSIONAL_GENERAL.length; i++) {
    const r = row(db, `g${i}`);
    assert.notEqual(r.board_category, null);
    assert.notEqual(r.board_category, "held");
    assert.equal(r.tag_function, PROFESSIONAL_GENERAL[i][1], PROFESSIONAL_GENERAL[i][0]);
  }
  HELD_TITLES.filter(Boolean).forEach((t, i) => {
    assert.deepEqual(row(db, `h${i}`), { board_category: "held", tag_function: null }, `${t}: held, no function (leak rate 0)`);
  });
  assert.equal(row(db, "stored").tag_function, "finance", "a row categorised earlier still gets its function");
  assert.equal(row(db, "owner").tag_function, null, "an owner-tagged function is the owner's (mergeOwner applies it), not overwritten here");
  assert.equal(row(db, "kept").tag_function, "people", "a stored function is never overwritten");
  assert.deepEqual(row(db, "gone"), { board_category: null, tag_function: null }, "a retired posting is not walked");
  // Coverage the walk measured: shown share, and the shown board's share with a kind of work.
  assert.equal(s.held, HELD_TITLES.filter(Boolean).length);
  assert.ok(s.coverage.functionOfShown >= 95, `functionOfShown ${s.coverage.functionOfShown}`);
});

test("d153 yielding pages: every page is a bounded rowid range and the walk yields between pages", async () => {
  const db = board();
  const total = db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get();
  let yields = 0;
  const job = createClassifyBacklog(db, { pageRows: 4, log: quiet, schedule: (fn) => { yields++; setImmediate(fn); } });
  const p = job.run("test");
  assert.equal(job.running, true);
  assert.equal(row(db, "g0").tag_function, null, "nothing runs synchronously inside run()");
  assert.equal(job.run("again"), p, "one walk at a time");
  const s = await p;
  assert.equal(s.pages, Math.ceil(total / 4));
  assert.equal(yields, s.pages, "a yield before every page");
  // A page reads only its range.
  const db2 = board();
  const c = classifyPage(db2, { from: 0, to: 2 });
  assert.equal(c.active, 2);
  assert.notEqual(row(db2, "g1").tag_function, null);
  assert.equal(row(db2, "g2").tag_function, null, "outside the range: untouched");
});

test("d153 idempotence: a second walk over a classified board writes nothing and measures the same coverage", async () => {
  const db = board();
  const job = createClassifyBacklog(db, { pageRows: 7, log: quiet });
  const a = await job.run("one");
  assert.ok(a.categorised > 0 && a.functioned > 0);
  const snapshot = db.prepare("SELECT job_id, board_category, tag_function, category_reason FROM scraped_jobs ORDER BY job_id").all();
  const b = await job.run("two");
  assert.equal(b.categorised, 0);
  assert.equal(b.functioned, 0);
  assert.deepEqual(b.coverage, a.coverage);
  assert.equal(b.runs, 2);
  assert.deepEqual(db.prepare("SELECT job_id, board_category, tag_function, category_reason FROM scraped_jobs ORDER BY job_id").all(), snapshot);
});

test("d153 the job and the tagger agree: postingFunction is jobTags' rule", () => {
  for (const [title] of PROFESSIONAL_GENERAL) {
    assert.equal(postingFunction({ title, role_key: "general" }), tagFunction("general", title), title);
  }
  for (const title of HELD_TITLES) assert.equal(postingFunction({ title, role_key: "general" }), null);
});

test("d153 wiring: started from READY in the listen callback, every 6 h, reported in /api/version; no whole-board warm-up step", () => {
  const server = read("server.js");
  assert.match(server, /import \{ createClassifyBacklog \} from "\.\/services\/jobs\/classifyBacklog\.js";/);
  assert.doesNotMatch(server, /backfillCategories\(db\)/, "the one-transaction category backfill is gone from the boot");
  const listen = server.indexOf("app.listen(PORT, () => {");
  const start = server.indexOf('BOOT.run().then(() => classifyBacklog.run("boot"));');
  assert.ok(listen > 0 && start > listen, "the walk starts on ready, inside the listen callback");
  assert.equal(server.split('classifyBacklog.run("boot")').length, 2, "started once");
  assert.match(server, /setInterval\(\(\) => classifyBacklog\.run\("interval"\), 6 \* 60 \* 60 \* 1000\)\.unref\(\);/);
  assert.match(server, /classify: classifyBacklog\.status\(\),/);
  const src = read("services/jobs/classifyBacklog.js");
  assert.match(src, /nextRowidRange\(db, from, pageRows\)/, "pages are A123's rowid ranges");
  assert.match(src, /schedule = \(fn\) => setImmediate\(fn\)/, "the yield is setImmediate");
  assert.match(src, /UPDATE scraped_jobs SET tag_function = \? WHERE job_id = \? AND tag_function IS NULL/, "conditional write: idempotent, never overwrites");
});

// ⛔ A132 (production 11-06: write pages up to 2,711 ms while the walk ran): the writes go in transactions of at most
// `writeChunk` rows with a yield between chunks; the shown postings left unknown are counted by category.
test("a132ClassifyWritesChunked: at most writeChunk rows per transaction, a yield between chunks, the same result", async () => {
  const db = board();
  const sizes = [];
  const realTx = db.transaction.bind(db);
  db.transaction = (fn) => { const t = realTx(fn); return (...a) => { let n = 0; const before = db.prepare("SELECT total_changes()").pluck().get(); const r = t(...a); n = db.prepare("SELECT total_changes()").pluck().get() - before; sizes.push(n); return r; }; };
  let yields = 0;
  const job = createClassifyBacklog(db, { pageRows: 500, writeChunk: 2, log: quiet, schedule: (fn) => { yields++; setImmediate(fn); } });
  const s = await job.run("test");
  assert.equal(s.state, "done");
  assert.equal(s.pages, 1, "one bounded read");
  assert.ok(sizes.length >= 2 && sizes.every(n => n <= 2), `transactions of ≤ 2 rows: ${sizes}`);
  assert.equal(yields, sizes.length, "a yield before the page and between every chunk");
  // Same outcome as the unchunked walk.
  const ref = board();
  const r = await createClassifyBacklog(ref, { pageRows: 500, log: quiet }).run("ref");
  const snap = (d) => d.prepare("SELECT job_id, board_category, tag_function FROM scraped_jobs ORDER BY job_id").all();
  assert.deepEqual(snap(db), snap(ref));
  assert.equal(s.categorised, r.categorised); assert.equal(s.functioned, r.functioned);
  assert.ok(Number.isFinite(s.maxWriteMs));
  assert.equal(typeof s.unknownByCategory, "object");
  const unknown = Object.values(s.unknownByCategory).reduce((a, b) => a + b, 0);
  assert.equal(unknown, s.shown - s.withFunction, "every shown posting without a kind of work is counted under its category");
});

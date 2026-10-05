// D29 — filters query the board's OWN tags, not free text. Pins the tagger's rules on the strings D27
// measured, the soft-null place predicate, "a tagged NULL is unknown, never the 'mid' fallback", the
// idempotent re-tag, owner tags surviving it, and the import's refusals.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  parsePlaces, formatPlaceList, tagLevel, levelFromTitle, levelFromYears, tagWorkplace, tagEmployment,
  tagFunction, deriveTags, tagStaleJobs, tagCoverage, usVerdict, TAGGER_VERSION,
} from "../services/jobs/jobTags.js";
import { buildTagExport, planTagImport, applyTagImport, parseCsv } from "../services/jobs/jobTagTransfer.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { placesFilterSql } from "../services/jobs/tagFilters.js";
import { resolvePlaceText, parsePlaceValue, METROS, JOB_FUNCTIONS } from "../shared/jobTagVocabulary.js";
import { usEligibility } from "../services/jobs/usLocation.js";
import { FILTER_DIMENSIONS } from "../shared/jobFilterOptions.js";

const places = (raw) => formatPlaceList(parsePlaces(raw));

// ── 1 · location is a SET of places, parsed — never a substring ────────────────────────────────

test("D27's failing strings: each place is read as a place, not as letters inside a word", () => {
  assert.equal(places("Boston, MA"), "metro:boston");
  assert.equal(places("Cambridge, MA"), "metro:boston", "Cambridge MA is Greater Boston");
  assert.equal(places("Cambridge"), "non_us", "a bare Cambridge is the UK one on this board (the US-only gate's reading)");
  assert.equal(places("Seattle, Washington, United States"), "metro:seattle");
  assert.equal(places("Washington, DC"), "metro:dc");
  assert.equal(places("Omaha, NE"), "state:NE", "Omaha is not in Massachusetts");
  assert.equal(places("Toronto, CA"), "non_us", "CA after Toronto is Canada");
  assert.equal(places("Bangalore, IN"), "non_us", "IN after Bangalore is India");
  assert.equal(places("San Francisco, Seattle, New York"), "metro:sf_bay_area;metro:seattle;metro:nyc",
    "a bare city list is three places, not Seattle-in-New-York");
  assert.equal(places("San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States"),
    "metro:sf_bay_area;metro:nyc;metro:portland;non_us");
  assert.equal(places("New York, NY (HQ)"), "metro:nyc", "a city and its own state are ONE place");
  assert.equal(places("Hybrid - San Francisco"), "metro:sf_bay_area");
  assert.equal(places("US - Remote"), "us");
  assert.equal(places("N/A"), "");
  assert.equal(places(null), "");
});

test("the place predicate: match, explicit mismatch excluded, unknown KEPT — and what counts as unknown", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, tag_basis TEXT);
           CREATE TABLE job_tag_places (job_id TEXT, country TEXT, state TEXT, metro TEXT);`);
  const row = (id, tagged, ...ps) => {
    db.prepare("INSERT INTO scraped_jobs VALUES (?, ?)").run(id, tagged ? "b" : null);
    for (const p of ps) db.prepare("INSERT INTO job_tag_places VALUES (?, ?, ?, ?)").run(id, ...p);
  };
  row("boston", true, ["US", "MA", "boston"]);
  row("sf", true, ["US", "CA", "sf_bay_area"]);
  row("sf_or_boston", true, ["US", "CA", "sf_bay_area"], ["US", "MA", "boston"]);
  row("us_only", true, ["US", null, null]);
  row("massachusetts", true, ["US", "MA", null]);
  row("untagged", false);
  const f = placesFilterSql(["metro:boston"]);
  const kept = db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE ${f.sql} ORDER BY job_id`).all().map(r => r.job_id);
  assert.deepEqual(kept, ["boston", "massachusetts", "sf_or_boston", "untagged", "us_only"]);
  const unknown = db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE ${f.unknownSql} ORDER BY job_id`).all().map(r => r.job_id);
  assert.deepEqual(unknown, ["massachusetts", "untagged", "us_only"], "kept only because we do not know");
  // A state filter: a metro row in that state matches, another state is a mismatch.
  const ca = placesFilterSql(["state:CA"]);
  assert.deepEqual(db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE ${ca.sql} AND NOT ${ca.unknownSql} ORDER BY job_id`)
    .all().map(r => r.job_id), ["sf", "sf_or_boston"]);
  // Values outside the vocabulary never reach SQL (they are inlined as literals).
  assert.equal(placesFilterSql(["metro:boston'); DROP TABLE x;--"]), null);
  assert.equal(placesFilterSql(["state:ZZ"]), null);
});

test("legacy free text resolves into the vocabulary instead of a substring", () => {
  assert.equal(resolvePlaceText("Boston"), "metro:boston");
  assert.equal(resolvePlaceText("bay area"), "metro:sf_bay_area");
  assert.equal(resolvePlaceText("CA"), "state:CA");
  assert.equal(resolvePlaceText("IN"), "state:IN", "IN is Indiana — it no longer matches Wash-in-gton");
  assert.equal(resolvePlaceText("California"), "state:CA");
  assert.equal(resolvePlaceText("Cambridge"), null, "ambiguous bare: no resolution, the caller says so");
  const f = buildJobFilters({ locations: ["Boston"] });
  assert.doesNotMatch(f.sql, /sj\.location LIKE/, "a resolvable location never becomes a substring match");
  assert.match(f.sql, /job_tag_places/);
  assert.ok(f.established.filters.includes("places"), "unknown places are ordered after known matches (A73)");
  assert.match(buildJobFilters({ locations: ["Atlantis"] }).sql, /sj\.location LIKE \?/,
    "text that names nothing in the vocabulary keeps the old match — it is what the caller typed");
  for (const m of METROS) assert.ok(parsePlaceValue(`metro:${m.value}`), m.value);
});

test("the US-only verdict from the tags agrees with the ingest gate on its own cases", () => {
  const cases = [
    ["San Francisco, CA", ""], ["London, UK", ""], ["Remote", "Must be based in the United States."],
    ["Remote", "We hire across EMEA; based in Europe."], ["Remote", ""], ["N/A", ""], ["Dublin, CA", ""],
    ["US / Canada", ""], ["Toronto, ON", ""], ["North America", ""],
  ];
  for (const [location, description] of cases) {
    const t = deriveTags({ location, description, title: "Engineer" });
    assert.equal(t.us === "us", usEligibility({ location, description }).admit, `${location} / ${description}`);
  }
});

// ── 2 · closed vocabularies, NULL = unknown ─────────────────────────────────────────────────────

test("level: from the title or the stated years — and NULL when neither says, never the 'mid' fallback", () => {
  assert.equal(levelFromTitle("Software Engineer"), null, "no seniority word is UNKNOWN, not mid");
  assert.equal(tagLevel({ title: "Software Engineer", experience_level: "mid" }), null,
    "the stored 'mid' is indistinguishable from schema.js's fallback, so it is not trusted");
  assert.equal(tagLevel({ title: "Senior Software Engineer" }), "senior");
  assert.equal(tagLevel({ title: "Software Engineer II" }), "mid");
  assert.equal(tagLevel({ title: "Staff Engineer" }), "senior");
  assert.equal(tagLevel({ title: "Engineering Manager" }), "lead");
  assert.equal(tagLevel({ title: "Account Manager" }), null, "a manager of accounts is not a people lead");
  assert.equal(tagLevel({ title: "Software Engineering Intern" }), "intern");
  assert.equal(levelFromYears("You have 5+ years of software engineering experience."), "senior");
  assert.equal(levelFromYears("3+ years of experience required; 7+ years of experience preferred"), "mid",
    "the smallest requirement is the floor");
  assert.equal(levelFromYears("1-3 years of experience"), "entry");
  assert.equal(levelFromYears("We have 10 years of history"), null, "not an experience requirement");
  assert.equal(tagLevel({ title: "Product Designer", description: "4 years of experience" }), "mid");
  assert.equal(tagLevel({ title: "Designer", experience_level: "senior", enriched_at: 1 }), "senior",
    "an enriched non-mid value is evidence and is kept");
});

test("workplace: a bare 'remote' in a description is not a statement about the role", () => {
  const stripe = "Office-assigned Stripes also have up to four weeks per year of fully remote work!";
  assert.deepEqual(tagWorkplace({ location: "San Francisco, CA", description: stripe }), { remote: null, workplace: null });
  assert.deepEqual(tagWorkplace({ location: "SF", description: "We use a hybrid work model of 3 days in the office per week." }),
    { remote: 0, workplace: "hybrid" });
  assert.deepEqual(tagWorkplace({ location: "Remote - US" }), { remote: 1, workplace: "remote" });
  assert.deepEqual(tagWorkplace({ location: "New York", workplace_type: "onsite" }), { remote: 0, workplace: "onsite" });
  assert.deepEqual(tagWorkplace({ location: "New York" }), { remote: null, workplace: null }, "silence is unknown");
});

test("employment type and function: stated or NULL — no 'full-time' default, 'general' is not a function", () => {
  assert.equal(tagEmployment({ title: "Engineer" }), null);
  assert.equal(tagEmployment({ title: "Engineer (Contract)" }), "contract");
  assert.equal(tagEmployment({ title: "Engineer", description: "This is a full-time position." }), "full-time");
  assert.equal(tagEmployment({ title: "Engineer", employment_type: "part-time" }), "part-time");
  assert.equal(tagFunction("pm"), "product");
  assert.equal(tagFunction("general"), null);
  assert.equal(tagFunction("engineering_embedded_firmware"), "engineering");
  const vocab = new Set(JOB_FUNCTIONS.options.map(o => o.value));
  for (const k of ["engineering", "data", "design", "pm", "sales", "marketing", "hr", "legal", "operations", "finance"]) {
    assert.ok(vocab.has(tagFunction(k)), `${k} maps into the closed vocabulary`);
  }
  assert.equal(FILTER_DIMENSIONS.jobFunction, JOB_FUNCTIONS, "registered, so GET /api/jobs validates it");
});

// ── 3 · the board reads tags; untagged rows read their legacy column ────────────────────────────

function migratedDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
function insert(db, id, o = {}) {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, is_active, location,
      experience_level, workplace_type, description) VALUES (?, 'q', 'Acme', ?, ?, 1, 1, ?, ?, ?, ?)`)
    .run(id, o.title ?? "Engineer", id, o.location ?? null, o.level ?? null, o.where ?? null, o.description ?? "");
}

test("a TAGGED NULL level is unknown — kept and ordered after — even though experience_level says 'mid'", () => {
  const db = migratedDb();
  insert(db, "plain", { title: "Software Engineer", level: "mid" });         // the fallback
  insert(db, "senior", { title: "Senior Software Engineer", level: "senior" });
  insert(db, "lead", { title: "Lead Engineer", level: "lead" });
  tagStaleJobs(db);
  const f = buildJobFilters({ experience_levels: ["mid"] });
  const rows = db.prepare(`SELECT job_id, ${f.established.unclassifiedSql} AS unknown FROM scraped_jobs sj WHERE 1=1 ${f.sql}
    ORDER BY job_id`).all(...f.params);
  assert.deepEqual(rows.map(r => [r.job_id, r.unknown]), [["plain", 1]],
    "the plain title is kept as UNKNOWN, not counted as a known mid; senior and lead are explicit mismatches");
  // An untagged row (written seconds ago, before a pass) still reads experience_level.
  insert(db, "fresh", { title: "Software Engineer", level: "mid" });
  const again = db.prepare(`SELECT job_id, ${f.established.unclassifiedSql} AS unknown FROM scraped_jobs sj WHERE 1=1 ${f.sql}
    ORDER BY job_id`).all(...f.params);
  assert.deepEqual(again.map(r => [r.job_id, r.unknown]), [["fresh", 0], ["plain", 1]]);
});

test("tagging is idempotent, and a changed posting is re-tagged", () => {
  const db = migratedDb();
  insert(db, "a", { location: "Boston, MA" });
  insert(db, "b", { location: "Seattle" });
  assert.deepEqual(tagStaleJobs(db), { scanned: 2, tagged: 2 });
  assert.deepEqual(tagStaleJobs(db), { scanned: 2, tagged: 0 }, "a settled board writes nothing");
  db.prepare("UPDATE scraped_jobs SET location = 'Austin, TX' WHERE job_id = 'b'").run();
  assert.deepEqual(tagStaleJobs(db), { scanned: 2, tagged: 1 });
  assert.equal(db.prepare("SELECT metro FROM job_tag_places WHERE job_id = 'b'").get().metro, "austin");
  assert.equal(db.prepare("SELECT tag_version FROM scraped_jobs WHERE job_id = 'a'").get().tag_version, TAGGER_VERSION);
  const cov = tagCoverage(db);
  assert.equal(cov.total, 2);
  assert.equal(cov.tags.find(t => t.tag === "metro").known, 2);
});

// ── 4 · export → the owner tags → import ────────────────────────────────────────────────────────

test("the owner's tags land, survive a re-tag, and the import refuses what it must", () => {
  const db = migratedDb();
  insert(db, "x", { title: "Software Engineer", location: "United States" });
  insert(db, "y", { title: "Software Engineer", location: "United States" });
  tagStaleJobs(db);
  const { csv, rows } = buildTagExport(db, { tag: "level" });
  assert.equal(rows, 2);
  const table = parseCsv(csv);
  const header = table[0];
  const set = (r, col, v) => { r[header.indexOf(col)] = v; return r; };
  const good = [header, set([...table[1]], "level", "senior"), set(set([...table[2]], "places", "metro:boston"), "level", "")]
    .map(r => r.join(",")).join("\n");
  const plan = planTagImport(db, good);
  assert.equal(plan.ok, true, JSON.stringify(plan.rejected));
  assert.equal(plan.changes.length, 2);
  applyTagImport(db, plan);
  const lvl = (id) => db.prepare("SELECT tag_level FROM scraped_jobs WHERE job_id = ?").get(id).tag_level;
  const tx = table[1][0];
  assert.equal(lvl(tx), "senior");
  tagStaleJobs(db, { all: true });
  assert.equal(lvl(tx), "senior", "a re-tag never overwrites an owner tag");
  assert.equal(db.prepare("SELECT metro FROM job_tag_places WHERE job_id = ?").get(table[2][0]).metro, "boston");

  // Refusals — and all-or-nothing: one bad line refuses the file.
  const bad = [header, set([...table[1]], "level", "mid level"), set([...table[2]], "level", "entry")].map(r => r.join(",")).join("\n");
  const refused = planTagImport(db, bad);
  assert.equal(refused.ok, false);
  assert.match(refused.rejected[0].reason, /not a level value/);
  assert.throws(() => applyTagImport(db, refused), /refused/);
  assert.equal(lvl(table[2][0]), null, "nothing from a refused file is written");
  db.prepare("UPDATE scraped_jobs SET title = 'Staff Engineer' WHERE job_id = ?").run(table[2][0]);
  const moved = planTagImport(db, [header, set([...table[2]], "level", "entry")].map(r => r.join(",")).join("\n"));
  assert.match(moved.rejected[0].reason, /changed since it was exported/);
  assert.match(planTagImport(db, "job_id,basis\nnope,abc").rejected[0].reason, /no such posting/);
});

test("no model call anywhere in the tag layer (D17)", () => {
  for (const f of ["services/jobs/jobTags.js", "services/jobs/jobTagTransfer.js", "services/jobs/tagFilters.js", "routes/jobTags.js"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(src, /callModel|anthropic|modelCall/i, `${f} reaches for a model`);
  }
  assert.equal(usVerdict([], null, ""), "unknown");
});

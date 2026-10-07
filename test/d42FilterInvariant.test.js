// D42 (owner, 10-06) — "TAGGING MADE THE BOARD WORSE." The owner's level-1 test, as a test.
//
// Measured 10-06 on the local board (2,616 active rows, the tagger run in memory, read-only):
//   H1 IN  — `finance` is the JOB's function (tax directors, controllers: 18 rows), so the 189
//            fintech-sector engineering rows could never carry it. The owner then ruled (10-06) that
//            the two are DIFFERENT dimensions: domain = the kind of work (the sentence), sector = the
//            employer's industry (the drawer, shared/companySectors.js).
//   H2 IN  — choosing a domain replaces the profile's scope (D30, on purpose); "all" now means
//            engineering + data for an engineering profile (ROLE_SCOPE_EXTRA), never "no scope".
//   H3 OUT — Boston recall 5 / 5 on the raw strings; the only metro miss was "Seattle WA" (no comma).
//   H4 IN  — the location's "unknown" branch admitted NON-US rows (a non-US place has no state): 716
//            of the 902 rows kept for Boston were Japan, London, Toronto…
//
// ⛔ THE INVARIANT: applying a filter never removes a row that carries the tag it asks for, and known
// matches rank before kept unknowns.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { parsePlaces, formatPlaceList, TAGGER_VERSION } from "../services/jobs/jobTags.js";
import { buildJobFilters, roleScopeExtraSql } from "../services/jobs/jobQuery.js";
import { functionForRole, roleScopeExtra } from "../shared/jobTagVocabulary.js";
import { sectorForCompany, SECTORS } from "../shared/companySectors.js";
import { FILTER_DIMENSIONS } from "../shared/jobFilterOptions.js";

// Real location strings from the 10-06 local board, with a title and company each.
const FIXTURE = [
  ["b1", "Software Engineer, Payments",   "Stripe",    "Boston, MA",                          "engineering"],
  ["b2", "Backend Engineer",              "Notion",    "Cambridge, MA",                       "engineering"],
  ["b3", "Financial Analyst",             "Stripe",    "Boston, Massachusetts",               "finance"],
  ["b4", "Tax Director",                  "OpenAI",    "San Francisco, CA",                   "finance"],
  ["b5", "Data Engineer",                 "Ramp",      "New York, NY",                        "data"],
  ["b6", "Software Engineer",             "Anthropic", "San Francisco, CA, Seattle WA, New York, NY", "engineering"],
  ["b7", "Account Executive",             "Figma",     "Boston, MA",                          "sales"],
  ["n1", "Software Engineer",             "Spotify",   "London",                              "engineering"],
  ["n2", "Software Engineer",             "Stripe",    "Toronto, Canada",                     "engineering"],
  ["u1", "Platform Engineer",             "Brex",      "US - Remote",                         "engineering"],
  ["u2", "Staff Engineer",                "Vercel",    "Remote in the US",                    "engineering"],
  ["x1", "Generalist",                    "Acme Co",   "N/A",                                 null],
];

function board() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, location TEXT,
             tag_basis TEXT, tag_function TEXT, is_active INTEGER DEFAULT 1);
           CREATE TABLE job_tag_places (job_id TEXT, country TEXT, state TEXT, metro TEXT);
           CREATE TABLE job_role_map (job_id TEXT, role_key TEXT, source_profile_id INTEGER);`);
  for (const [id, title, company, location, role] of FIXTURE) {
    db.prepare("INSERT INTO scraped_jobs (job_id, title, company, location, tag_basis, tag_function) VALUES (?, ?, ?, ?, 'b', ?)")
      .run(id, title, company, location, functionForRole(role));
    for (const p of parsePlaces(location)) db.prepare("INSERT INTO job_tag_places VALUES (?, ?, ?, ?)").run(id, p.country, p.state, p.metro);
    if (role) db.prepare("INSERT INTO job_role_map VALUES (?, ?, NULL)").run(id, role);
  }
  return db;
}

/** The board's own fragments: WHERE from buildJobFilters, known matches first (A73's established keys). */
function run(db, params) {
  const f = buildJobFilters(params);
  const where = f.sql.replace(/^\s*AND\s+/, "") || "1 = 1";
  const order = [...f.established.keys.map(k => k.sql), "sj.job_id"].join(", ");
  const unknown = f.established.unclassifiedSql;
  return db.prepare(`SELECT sj.job_id AS id${unknown ? `, (${unknown}) AS kept` : ", 0 AS kept"}
                     FROM scraped_jobs sj WHERE ${where} ORDER BY ${order}`).all(...f.params);
}
const ids = (rows) => rows.map(r => r.id);
const known = (rows) => rows.filter(r => !r.kept).map(r => r.id);

test("⛔ D42 fixture (D59) · 'US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd' is Marlborough — the STREET is not Boston", () => {
  // The substring trap D42 was about, from a real RTX shape: the city is MARLBOROUGH and "Boston" is a
  // road. Massachusetts, no metro — whether Marlborough is Greater Boston is a metro question, not this.
  const raw = "US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2";
  assert.equal(formatPlaceList(parsePlaces(raw)), "state:MA");
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, location TEXT,
             tag_basis TEXT, tag_function TEXT, is_active INTEGER DEFAULT 1);
           CREATE TABLE job_tag_places (job_id TEXT, country TEXT, state TEXT, metro TEXT);
           CREATE TABLE job_role_map (job_id TEXT, role_key TEXT, source_profile_id INTEGER);`);
  db.prepare("INSERT INTO scraped_jobs (job_id, title, company, location, tag_basis) VALUES ('rtx', 'Systems Engineer', 'RTX', ?, 'b')").run(raw);
  for (const p of parsePlaces(raw)) db.prepare("INSERT INTO job_tag_places VALUES ('rtx', ?, ?, ?)").run(p.country, p.state, p.metro);
  assert.deepEqual(ids(run(db, { places: "metro:boston", strict_tags: "1" })), [], "known to be in Boston — it is not");
  assert.deepEqual(ids(run(db, { places: "state:MA", strict_tags: "1" })), ["rtx"], "known to be in Massachusetts — it is");
});

test("D42 · H3: 'Seattle WA' (no comma) is a place — and the tagger re-tags every row for it", () => {
  assert.equal(formatPlaceList(parsePlaces("San Francisco, CA, Seattle WA, New York, NY")),
    "metro:sf_bay_area;metro:seattle;metro:nyc");
  assert.equal(formatPlaceList(parsePlaces("Boston, Massachusetts")), "metro:boston");
  assert.ok(TAGGER_VERSION >= 2, "the rule changed, so TAGGER_VERSION must move or no stored row re-tags");
});

test("D42 · BOSTON ALONE returns a SUPERSET of the Boston rows, known first — and never a non-US row", () => {
  const db = board();
  const all = ids(run(db, {}));
  const bostonTagged = all.filter(id => db.prepare("SELECT 1 FROM job_tag_places WHERE job_id = ? AND metro = 'boston'").get(id));
  const rows = run(db, { places: "metro:boston" });
  for (const id of bostonTagged) assert.ok(ids(rows).includes(id), `${id} is tagged Boston and the Boston filter dropped it`);
  assert.deepEqual(known(rows), ["b1", "b2", "b3", "b7"], "the known Boston rows");
  // ⛔ H4: London and Toronto name places — explicit mismatches, not "no city on file".
  assert.ok(!ids(rows).includes("n1") && !ids(rows).includes("n2"), "a non-US row was kept for Boston as unknown");
  // Kept unknowns are the US-with-no-city rows and the row naming nothing — after every known match.
  assert.deepEqual(rows.filter(r => r.kept).map(r => r.id), ["u1", "u2", "x1"]);
  assert.ok(rows.findIndex(r => r.kept) > rows.findLastIndex(r => !r.kept), "an unknown ranked among the known matches");
  // A row tagged with a DIFFERENT known metro is excluded: unknown is not different.
  assert.ok(!ids(rows).includes("b4") && !ids(rows).includes("b5"));
});

test("D42 · the STRICT toggle: only jobs known to be in Boston", () => {
  const rows = run(board(), { places: "metro:boston", strict_tags: "1" });
  assert.deepEqual(ids(rows), ["b1", "b2", "b3", "b7"]);
  assert.ok(rows.every(r => !r.kept));
});

test("D42 · FINANCE as the job's DOMAIN returns finance work — at OpenAI too — not an SDE at a bank", () => {
  const rows = run(board(), { job_functions: "finance" });
  assert.deepEqual(known(rows), ["b3", "b4"], "the finance-role jobs (Stripe's analyst, OpenAI's tax director)");
  assert.ok(!ids(rows).includes("b1"), "a software engineer at Stripe is not a finance job");
  assert.deepEqual(rows.filter(r => r.kept).map(r => r.id), ["x1"], "only the row with no kind of work on file is kept, after");
});

test("D42 · FINANCE as the company's SECTOR returns the fintech engineers — a separate drawer filter", () => {
  assert.equal(sectorForCompany("Stripe"), "finance");
  assert.equal(sectorForCompany("OpenAI"), "ai");
  assert.equal(sectorForCompany("Acme Co"), null, "a company not on the list has no sector on file — never guessed");
  assert.equal(FILTER_DIMENSIONS.sector, SECTORS, "the sector dimension is registered, so the server validates it");
  const rows = run(board(), { sectors: "finance", strict_tags: "1" });
  assert.deepEqual(ids(rows), ["b1", "b3", "b5", "n2", "u1"], "Stripe, Ramp and Brex rows");
  assert.ok(!ids(rows).includes("b4"), "OpenAI is not a finance company");
});

test("D42 · BOTH return their INTERSECTION, ranked", () => {
  const rows = run(board(), { places: "metro:boston", job_functions: "finance", sectors: "finance" });
  assert.deepEqual(known(rows), ["b3"], "the finance-role job, at a finance company, in Boston");
  assert.ok(rows.findIndex(r => r.kept) === -1 || rows.findIndex(r => r.kept) > 0, "the known match leads");
});

test("D42 · H2: an engineering profile's 'all' is engineering + data; any other profile keeps its bucket", () => {
  assert.deepEqual([...roleScopeExtra("engineering")], ["data"]);
  assert.deepEqual(roleScopeExtra("pm"), []);
  assert.deepEqual(roleScopeExtra("engineering_embedded_firmware"), [], "firmware stays isolated");
  assert.equal(roleScopeExtraSql(["data; DROP TABLE x"]), "", "only role-key-shaped values are inlined");
  const db = board();
  const extra = roleScopeExtraSql(roleScopeExtra("engineering"));
  // The board's scope predicate (server.js roleSql), against a LEFT JOIN on the declared bucket.
  const scoped = db.prepare(`SELECT sj.job_id AS id FROM scraped_jobs sj
      LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = 'engineering'
      WHERE (jrm.role_key IS NOT NULL OR ${extra} OR NOT EXISTS (SELECT 1 FROM job_role_map m WHERE m.job_id = sj.job_id))
      ORDER BY sj.job_id`).all().map(r => r.id);
  assert.ok(scoped.includes("b5"), "a data engineer is on an engineering profile's board");
  assert.ok(!scoped.includes("b7") && !scoped.includes("b4"), "sales and finance work stay off it");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /const scopeExtraSql = roleScopeExtraSql\(roleScopeExtra\(roleKey\)\);/);
  assert.match(server, /filterParams\.role_scope_extra = roleScopeExtra\(roleKey\);/);
});

test("D42 · the panel says exactly what happened: known, then kept — never a blended count", async () => {
  const { knownSplit, panelRows, STRICT_PARAM } = await import("../client/src/lib/filterSentenceModel.js");
  const { SENTENCE_CLAUSES } = await import("../shared/filterSentence.js");
  const facets = { total: 33, known: 1, unscored: 0, coverage: {}, clauses: {
    location: [{ value: "metro:boston", label: "Boston", count: 33, known: 1 }],
    domain: [{ value: "finance", label: "Finance", count: 20, known: 8 }],
  } };
  assert.equal(knownSplit("location", { places: ["metro:boston"] }, facets), "1 in Boston · 32 with no city on file, shown after.");
  assert.equal(knownSplit("domain", { job_functions: ["finance"] }, facets), "8 finance · 12 with no kind of work on file, shown after.");
  assert.equal(knownSplit("location", { places: ["metro:boston"], [STRICT_PARAM]: "1" }, facets),
    "1 known to be in Boston — postings with no city on file are left out.");
  const loc = SENTENCE_CLAUSES.find(c => c.key === "location");
  const strictRow = panelRows(loc, { places: ["metro:boston"] }, facets).find(r => r.kind === "strict");
  assert.equal(strictRow.label, "only jobs known to be in Boston");
  // Domain: "all" is the one nothing-chosen pill — no "your profile", no every-function pill.
  const dom = SENTENCE_CLAUSES.find(c => c.key === "domain");
  const head = panelRows(dom, {}, facets).filter(r => r.kind !== "option");
  assert.deepEqual(head.map(r => r.label), ["all"]);
});

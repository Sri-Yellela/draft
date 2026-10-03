// A72 (owner, 10-03) — the board's search is RANKED, LOCAL and WHOLE-WORD.
//
// It was `title/company/description LIKE %q%`: "ai" matched 2,525 of 2,616 active postings
// (maint-ai-n, det-ai-ls), so a search changed nothing. The owner's ranking: 1 title starts with,
// 2 title contains, 3 company or skill, 4 description only, everything else OMITTED; ATS match
// breaks ties; ai ≡ artificial intelligence and ml ≡ machine learning with EQUAL weight, from the
// one synonym table the scorer reads (CC3).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import {
  SEARCH_TIER, normaliseSearchText, searchVariants, searchTier, registerBoardSearch, boardSearchSql,
} from "../services/jobs/boardSearch.js";
import { buildOrderKeys, FIT_KEYS, orderSignature, encodeCursor, decodeCursor, cursorProjection, orderByClause } from "../services/jobs/jobCursor.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";

const SYN = new Map([
  ["ai", ["artificial intelligence"]], ["artificial intelligence", ["ai"]],
  ["machine learning", ["ml"]], ["ml", ["machine learning"]],
]);
const tierOf = (job, term) => searchTier(job, searchVariants(term, SYN));

test("⭐ the owner's four tiers, and everything else OMITTED", () => {
  const job = (o) => ({ title: "", company: "", skillsJson: null, summary: "", description: "", ...o });
  assert.equal(tierOf(job({ title: "AI Engineer" }), "ai"), SEARCH_TIER.TITLE_START);
  assert.equal(tierOf(job({ title: "Applied AI Engineer" }), "ai"), SEARCH_TIER.TITLE);
  assert.equal(tierOf(job({ title: "Account Executive", company: "Scale AI" }), "ai"), SEARCH_TIER.STRUCTURED);
  assert.equal(tierOf(job({ title: "Data Engineer", skillsJson: JSON.stringify([{ skill: "AI" }]) }), "ai"), SEARCH_TIER.STRUCTURED);
  assert.equal(tierOf(job({ title: "Data Engineer", description: "Our AI platform." }), "ai"), SEARCH_TIER.DESCRIPTION);
  assert.equal(tierOf(job({ title: "Data Engineer", description: "Maintain the pipelines." }), "ai"), null, "not in any tier → omitted");
});

test("⛔ WHOLE WORDS: 'ai' never matches maintain, details, available, retail or email", () => {
  for (const t of ["Maintenance Technician", "Retail Associate", "Email Marketing Manager", "Details Lead", "Available Now"]) {
    assert.equal(tierOf({ title: t, description: "maintain the details; available by email" }, "ai"), null, t);
  }
  // …and does match the forms a posting actually writes.
  for (const t of ["AI/ML Engineer", "Engineer (AI)", "Engineer, AI-Platform", "ai engineer"]) {
    assert.notEqual(tierOf({ title: t }, "ai"), null, t);
  }
  assert.equal(normaliseSearchText("Node.js / C++"), " node js c++ ");
});

test("⭐ SYNONYMS WITH EQUAL WEIGHT — a variant is a peer of the typed term, not a lower tier", () => {
  assert.deepEqual(searchVariants("ML", SYN), ["ml", "machine learning"]);
  assert.deepEqual(searchVariants("artificial intelligence", SYN), ["artificial intelligence", "ai"]);
  assert.equal(tierOf({ title: "Machine Learning Engineer" }, "ml"), SEARCH_TIER.TITLE_START);
  assert.equal(tierOf({ title: "ML Engineer" }, "machine learning"), SEARCH_TIER.TITLE_START);
  assert.equal(tierOf({ title: "Artificial Intelligence Researcher" }, "ai"), SEARCH_TIER.TITLE_START);
  // A part of a longer term is swapped too.
  assert.deepEqual(searchVariants("ml engineer", SYN), ["ml engineer", "machine learning engineer"]);
  // No synonyms passed → the term alone, never a built-in list.
  assert.deepEqual(searchVariants("ml", null), ["ml"]);
  assert.deepEqual(searchVariants("  !! ", SYN), [], "nothing searchable is no search, not a match-all");
});

test("skills are matched ONE AT A TIME — the end of one and the start of the next never make a phrase", () => {
  const skillsJson = JSON.stringify([{ skill: "Go" }, { skill: "Learning management" }]);
  assert.equal(searchTier({ title: "Engineer", skillsJson }, ["go learning"]), null);
  assert.equal(searchTier({ title: "Engineer", skillsJson: JSON.stringify(["Machine learning"]) }, ["machine learning"]), SEARCH_TIER.STRUCTURED);
  assert.equal(searchTier({ title: "Engineer", skillsJson: "not json" }, ["go"]), null);
});

test("⛔ there is NO second synonym table: the board's search reads loadConfirmedSynonyms, the scorer's map", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /const searchPhrases = rawQuery \? searchVariants\(rawQuery, atsSynonyms\(\)\) : \[\];/);
  assert.match(src, /function atsSynonyms\(\) \{\s*return loadConfirmedSynonyms\(db\);/);
  const mod = fs.readFileSync("services/jobs/boardSearch.js", "utf8");
  assert.doesNotMatch(mod, /artificial intelligence["']\s*[,\]]|new Map\(\s*\[/, "a synonym list written into the search module");
});

test("⛔ the substring filter is GONE from the board", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.doesNotMatch(src, /sj\.title LIKE \? OR sj\.company LIKE \? OR sj\.description LIKE \?/);
  assert.match(src, /const keyFilter = boardSearch \? `AND \$\{boardSearch\.sql\} IS NOT NULL` : '';/);
  assert.match(src, /buildOrderKeys\(sort, richFilters\.rank\.keys, \{ fit: fitRequested, search: boardSearch \}\)/);
  assert.match(src, /registerBoardSearch\(db\);/);
  // A search is the user asking: the profile's role scope (a default) does not hide what they typed.
  assert.match(src, /const roleSql = \(savedTab \|\| boardSearch\) \? '' : `AND \(/);
});

test("⭐ the order: tier first, then ATS match (the fit keys) on the default sort; an explicit sort keeps the tier", () => {
  const search = boardSearchSql(["ai"]);
  const rank = [{ sql: "sj.title LIKE ?", params: ["%x%"] }];
  const def = buildOrderKeys("dateDesc", rank, { fit: true, search });
  assert.equal(def[0].sql, search.sql);
  assert.deepEqual(def[0].params, search.params);
  assert.equal(def[1], FIT_KEYS[0]);
  assert.equal(def[2], FIT_KEYS[1]);
  assert.ok(!def.some(k => k.sql.includes("sj.title LIKE")), "the derived rank keys do not outrank what the user asked for");
  // On the Saved tab (fit off) the tie-break is still ATS match.
  assert.equal(buildOrderKeys("", [], { fit: false, search })[1], FIT_KEYS[0]);
  const pay = buildOrderKeys("compHigh", rank, { fit: true, search });
  assert.equal(pay[0].sql, search.sql);
  assert.ok(!pay.includes(FIT_KEYS[0]), "an explicit sort replaces the fit tie-break");
  // No search → exactly as before.
  assert.deepEqual(buildOrderKeys("dateDesc", rank, { fit: true }), buildOrderKeys("dateDesc", rank, { fit: true, search: null }));
});

test("⛔ a cursor issued for one search is REFUSED for another (the term is a bound parameter)", () => {
  const a = buildOrderKeys("", [], { search: boardSearchSql(["ai"]) });
  const b = buildOrderKeys("", [], { search: boardSearchSql(["ml"]) });
  assert.notEqual(orderSignature(a), orderSignature(b));
  const row = Object.fromEntries(a.map((_, i) => [`__cursor_k${i}`, i]));
  const token = encodeCursor(a, row);
  assert.equal(decodeCursor(token, a).ok, true);
  assert.equal(decodeCursor(token, b).error, "cursor_sort_mismatch");
  // Keys without params sign exactly as they always did.
  const plain = buildOrderKeys("dateDesc", [], {});
  assert.equal(orderSignature(plain), plain.map(k => `${k.sql}|${k.dir}`).join("~~"));
});

test("⭐ in SQLite: omitted rows are absent, tiers lead, ATS match orders a tier — through the same key list the board uses", () => {
  const db = new Database(":memory:");
  registerBoardSearch(db);
  registerBoardSearch(db); // idempotent
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, skills_json TEXT, summary TEXT,
             description TEXT, updated_at INTEGER, discovered_at INTEGER, scraped_at INTEGER, posted_at INTEGER);
           CREATE TABLE ats_only_reports (job_id TEXT, ats_score INTEGER);`);
  const ins = db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?,?,?,?,1,1,1,NULL)");
  const rows = [
    ["d1", "Data Engineer", "Acme", null, "", "We maintain AI systems."],
    ["t2a", "Applied AI Engineer", "Acme", null, "", ""],
    ["t1a", "AI Engineer", "Acme", null, "", ""],
    ["t1b", "Artificial Intelligence Lead", "Acme", null, "", ""],
    ["s3", "Account Executive", "Scale AI", null, "", ""],
    ["x", "Maintenance Technician", "Retail Co", null, "", "Maintain details by email."],
  ];
  for (const r of rows) ins.run(...r);
  db.prepare("INSERT INTO ats_only_reports VALUES (?, ?)").run("t1b", 80);
  db.prepare("INSERT INTO ats_only_reports VALUES (?, ?)").run("t1a", 40);
  const search = boardSearchSql(searchVariants("ai", SYN));
  const keys = buildOrderKeys("", [], { fit: true, search });
  const order = orderByClause(keys);
  const proj = cursorProjection(keys);
  const got = db.prepare(`SELECT sj.job_id ${proj.sql} FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id
                          WHERE ${search.sql} IS NOT NULL ORDER BY ${order.sql}`)
    .all(...proj.params, ...search.params, ...order.params).map(r => r.job_id);
  // t1b (Strong, 80) ahead of t1a (40) inside tier 1 — the synonym counted fully.
  assert.deepEqual(got, ["t1b", "t1a", "t2a", "s3", "d1"]);
  assert.ok(!got.includes("x"), "the row in no tier is omitted");
});

test("⛔ the per-job cache is never stale: an enriched or re-crawled posting is matched on its NEW text", () => {
  const db = new Database(":memory:");
  registerBoardSearch(db);
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, skills_json TEXT, summary TEXT,
             description TEXT, updated_at INTEGER)`);
  db.prepare("INSERT INTO scraped_jobs VALUES ('cache-1','Engineer','Acme',NULL,'','Payments work.',1)").run();
  const s = boardSearchSql(["kubernetes"]);
  const tier = () => db.prepare(`SELECT ${s.sql} AS t FROM scraped_jobs sj`).get(...s.params).t;
  assert.equal(tier(), null);
  db.prepare("UPDATE scraped_jobs SET description = 'Payments work on Kubernetes.', updated_at = 2").run();
  assert.equal(tier(), SEARCH_TIER.DESCRIPTION);
  db.prepare("UPDATE scraped_jobs SET skills_json = '[\"Kubernetes\"]'").run();   // same updated_at: the lengths move
  assert.equal(tier(), SEARCH_TIER.STRUCTURED);
});

test("migration 123: the owner's two pairs land CONFIRMED aliases and reach loadConfirmedSynonyms", () => {
  const m098 = MIGRATIONS.find(m => m.id === "098_skill_synonyms");
  const m123 = MIGRATIONS.find(m => m.id === "123_owner_skill_aliases");
  assert.ok(m098 && m123);
  const db = new Database(":memory:");
  db.exec(m098.sql);
  // An earlier REJECTION of the same pair is overruled by the owner's brief.
  db.prepare("INSERT INTO skill_synonyms (term, equivalent, relation, status) VALUES ('machine learning','ml','related','rejected')").run();
  const expected = [
    { term: "ai", equivalent: "artificial intelligence", relation: "alias", status: "confirmed" },
    { term: "machine learning", equivalent: "ml", relation: "alias", status: "confirmed" },
  ];
  const read = () => db.prepare("SELECT term, equivalent, relation, status FROM skill_synonyms ORDER BY term").all().map(r => ({ ...r }));
  // Asserted after the FIRST run: a second run's conflict update would hide a wrong insert.
  db.exec(m123.sql);
  assert.deepEqual(read(), expected);
  db.exec(m123.sql); // idempotent
  assert.deepEqual(read(), expected);
  const map = loadConfirmedSynonyms(db);
  assert.deepEqual(searchVariants("ai", map), ["ai", "artificial intelligence"]);
  assert.deepEqual(searchVariants("machine learning", map), ["machine learning", "ml"]);
});

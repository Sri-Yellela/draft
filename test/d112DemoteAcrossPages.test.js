// ⭐ D112 item 6 · INELIGIBLE POSTINGS DEMOTED ACROSS PAGES — only for the answers the user SET.
//
// D104 P1 moved an ineligible posting to the end of its own PAGE: a citizens-only posting at position 2 of page 1
// went to position 10 of page 1, ahead of all of page 2. The board's ORDER BY now leads with
// services/jobEligibility.js ineligibleOrderKey (the STORED req_* columns, fresh only), so it goes to the end of the
// BOARD. This file walks the board's own pieces — buildOrderKeys, orderByClause, cursorProjection, cursorPredicate,
// encode/decodeCursor — over the real schema (MIGRATIONS) with the real description pipeline (deriveDescriptionColumns).
// Synthetic postings and a synthetic user.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { deriveDescriptionColumns, registerDescriptionBasis } from "../services/jobs/descriptionText.js";
import { ineligibleOrderKey, userEligibilityInputs, eligibilityForRow } from "../services/jobEligibility.js";
import { buildOrderKeys, orderByClause, cursorProjection, cursorPredicate, encodeCursor, decodeCursor } from "../services/jobs/jobCursor.js";

const CITIZEN_ONLY = "MUST BE A US CITIZEN. NO H1B or Green card holders.\nAbout the role: build mission software with a small team.";
const TS_ACTIVE = "Requires an active Top Secret clearance.\nAbout the role: build mission software with a small team.";
const OPEN = (i) => `Build things with us, team ${i}. Python and SQL.`;
const PS = 10;
const N = 25;

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  registerDescriptionBasis(db);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO')").run();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,description,discovered_at,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,1)`);
  const write = db.prepare(`UPDATE scraped_jobs SET req_citizenship=@req_citizenship, req_clearance=@req_clearance,
    req_clearance_status=@req_clearance_status, req_polygraph=@req_polygraph, description_basis=@description_basis WHERE job_id=@job_id`);
  for (let i = 0; i < N; i++) {
    const id = `j${String(i).padStart(2, "0")}`;
    // j01: citizens only — page 1, natural position 2. j03: an active TS clearance. j05: citizens only, but
    // the description was re-crawled after it was read (stale). j07: citizens only, never read (basis NULL).
    const text = i === 1 || i === 5 || i === 7 ? CITIZEN_ONLY : i === 3 ? TS_ACTIVE : OPEN(i);
    ins.run(id, "Engineer", `Co ${id}`, `https://x.test/${id}`, `https://x.test/${id}`, "t", `h${id}`, text, 2_000_000 - i * 60);
    if (i !== 7) write.run({ ...deriveDescriptionColumns(text), job_id: id });
  }
  db.prepare("UPDATE scraped_jobs SET description = description || ' (updated)' WHERE job_id = 'j05'").run();
  return db;
}
const setAnswers = (db, answers) => {
  db.prepare("DELETE FROM application_defaults WHERE user_id = 1").run();
  for (const [k, v] of Object.entries(answers)) db.prepare("INSERT INTO application_defaults (user_id,key,value,source) VALUES (1,?,?,'user')").run(k, v);
};

// The board's statement shape: the same JOIN/WHERE for the list and the count, the cursor predicate on the list only.
const JOIN = "FROM scraped_jobs sj LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = 1"
  + " LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS NULL";
const WHERE = "WHERE sj.is_active = 1 AND COALESCE(uj.disliked, 0) = 0";
const keysFor = (db, sort) => buildOrderKeys(sort, [], { ineligible: ineligibleOrderKey(userEligibilityInputs(db, 1).defaults) });
function offsetPages(db, keys) {
  const ob = orderByClause(keys);
  const pages = [];
  for (let p = 0; p * PS < N; p++) {
    pages.push(db.prepare(`SELECT sj.job_id ${JOIN} ${WHERE} ORDER BY ${ob.sql} LIMIT ? OFFSET ?`).all(...ob.params, PS, p * PS).map(r => r.job_id));
  }
  return pages;
}
function cursorWalk(db, keys) {
  const ob = orderByClause(keys), proj = cursorProjection(keys);
  const seen = [];
  let cursor = null;
  for (let guard = 0; guard < 20; guard++) {
    const decoded = cursor ? decodeCursor(cursor, keys) : null;
    if (decoded) assert.ok(decoded.ok, decoded.error);
    const pred = decoded ? cursorPredicate(keys, decoded.values) : null;
    const fetched = db.prepare(`SELECT sj.job_id ${proj.sql} ${JOIN} ${WHERE} ${pred ? "AND " + pred.sql : ""} ORDER BY ${ob.sql} LIMIT ?`)
      .all(...proj.params, ...(pred ? pred.params : []), ...ob.params, PS + 1);
    const rows = fetched.slice(0, PS);
    seen.push(...rows.map(r => r.job_id));
    if (fetched.length <= PS) return seen;
    cursor = encodeCursor(keys, rows[rows.length - 1]);
  }
  throw new Error("the cursor walk did not end");
}
const count = (db) => db.prepare(`SELECT COUNT(*) AS n ${JOIN} ${WHERE}`).get().n;

for (const sort of ["dateDesc", undefined]) {
  const label = sort || "the curated default";
  test(`D112 item 6 · ${label}: a citizens-only posting at page 1 position 2 moves to the LAST page when citizenship is set to a non-US value`, () => {
    const db = fixture();
    const natural = offsetPages(db, buildOrderKeys(sort, []));
    assert.equal(natural[0][1], "j01", "the fixture's citizens-only posting sits at page 1, position 2");
    setAnswers(db, { citizenship: "India" });
    const pages = offsetPages(db, keysFor(db, sort));
    const last = pages[pages.length - 1];
    assert.ok(last.includes("j01"), `j01 is on the last page: ${JSON.stringify(pages)}`);
    assert.ok(!pages[0].includes("j01"));
    assert.ok(pages[0].includes("j03"), "⛔ clearance is not set — the TS posting is not demoted");
    assert.ok(!last.includes("j05") && !last.includes("j07"), "⛔ a stale or unread reading is not demoted");
    // Everything else keeps its natural relative order.
    assert.deepEqual(pages.flat().filter(id => id !== "j01"), natural.flat().filter(id => id !== "j01"));
    assert.equal(pages.flat().at(-1), "j01");
    // The per-row mark agrees with the key for this row.
    const row = db.prepare("SELECT * FROM scraped_jobs WHERE job_id='j01'").get();
    assert.equal(eligibilityForRow(row, userEligibilityInputs(db, 1)).status, "ineligible");
  });

  test(`D112 item 6 · ${label}: nothing set (or nothing contradicted) → no key, the order is unchanged`, () => {
    const db = fixture();
    const natural = offsetPages(db, buildOrderKeys(sort, []));
    assert.equal(ineligibleOrderKey(userEligibilityInputs(db, 1).defaults), null);
    assert.deepEqual(keysFor(db, sort), buildOrderKeys(sort, []), "no key is added");
    setAnswers(db, { citizenship: "United States", sponsorship_now: "yes" });
    assert.equal(ineligibleOrderKey(userEligibilityInputs(db, 1).defaults), null, "a US citizen is ruled out by no stored citizenship value; sponsorship is not stored");
    assert.deepEqual(offsetPages(db, keysFor(db, sort)), natural);
  });

  test(`D112 item 6 · ${label}: the count equals the list total, and cursor paging returns every row exactly once`, () => {
    const db = fixture();
    const before = count(db);
    setAnswers(db, { citizenship: "India", clearance: "none" });
    const keys = keysFor(db, sort);
    assert.equal(count(db), before, "the count statement is untouched");
    const listed = offsetPages(db, keys).flat();
    assert.equal(listed.length, count(db));
    const walked = cursorWalk(db, keys);
    assert.equal(walked.length, count(db));
    assert.equal(new Set(walked).size, walked.length, "no row twice");
    assert.deepEqual(walked, listed, "cursor and offset agree");
    assert.deepEqual(walked.slice(-2).sort(), ["j01", "j03"], "both answers set → both postings are last");
  });
}

test("D112 item 6 · the key reads eligibilityOf's verdicts per answer, and its params sign the cursor", () => {
  assert.deepEqual(ineligibleOrderKey({ citizenship: "Permanent resident" }).params, ["citizen_only"], "a permanent resident is a U.S. person");
  assert.deepEqual(ineligibleOrderKey({ citizenship: "India" }).params, ["citizen_only", "us_person"]);
  const canObtain = ineligibleOrderKey({ clearance: "can_obtain" });
  assert.ok(canObtain.params.includes("active_required") && !canObtain.params.includes("ability_to_obtain"), "can obtain → only an ACTIVE requirement rules out");
  assert.equal(ineligibleOrderKey({ clearance: "ts_sci" }), null, "the highest clearance is ruled out by none");
  assert.match(ineligibleOrderKey({ citizenship: "India" }).sql, /description_basis = d59_description_basis\(sj\.description\)/, "fresh only");
  const db = fixture();
  setAnswers(db, { citizenship: "India" });
  const keys = keysFor(db, "dateDesc");
  const first = db.prepare(`SELECT sj.job_id ${cursorProjection(keys).sql} ${JOIN} ${WHERE} ORDER BY ${orderByClause(keys).sql} LIMIT 1`)
    .get(...cursorProjection(keys).params, ...orderByClause(keys).params);
  const cursor = encodeCursor(keys, first);
  assert.equal(decodeCursor(cursor, keys).ok, true);
  setAnswers(db, { citizenship: "Permanent resident" });
  assert.equal(decodeCursor(cursor, keysFor(db, "dateDesc")).error, "cursor_sort_mismatch", "a changed answer refuses an old cursor");
});

test("D112 item 6 · server.js: the board's order leads with the key; the count statement is unchanged; the within-page move stays", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const board = src.slice(at(src, "const boardEligInputs = "), at(src, "const responseBody = {"));
  assert.match(board, /buildOrderKeys\(sort, richFilters\.rank\.keys,\s*\{[^}]*ineligible: ineligibleOrderKey\(boardEligInputs\.defaults\), ghost: boardHasGhosts \}\)/);
  assert.match(board, /const total = \(await readPool\.get\(`SELECT COUNT\(\*\) as n \$\{joinClause\} \$\{whereClause\}`, baseArgs\)\)/);
  assert.match(board, /const eligInputs = boardEligInputs;/);
  assert.match(board, /const pageRows = ineligible\.size \?/, "sponsorship and degree are not stored: they stay demoted within the page");
});

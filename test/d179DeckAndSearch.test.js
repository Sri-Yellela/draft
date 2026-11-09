// ⭐ A150 (45o) — the D179 spec NAMED six tests and none was written (the probe's finding: a named-test list is the checklist
// that would have caught the dropped pieces). Written against what is built: d179SentenceFilterCarriesTaxonomy (its own
// file, A145), and here d179DeckDesignUnchanged · d179SignedOutSamePageNoPersonalParts · d179SearchSuggestsCompaniesRolesTech
// · d179CompanyPickOpensPage. ⛔ d179NoCompaniesTab is VOID — the owner reversed that override on 11-08 (A144: the tab is
// built; a144CompaniesTab pins it).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { publicSuggest } from "../services/companies/publicCompany.js";

const read = (f) => fs.readFileSync(f, "utf8");

test("d179DeckDesignUnchanged · the deck keeps its fan and actions, gains Send + Works with + the company link, no taxonomy chip", () => {
  const deck = read("client/src/panels/DeckView.jsx");
  const acts = [...deck.matchAll(/<ActionButton label="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(acts.slice(0, 4), ["Pass", "Save", "Send", "Draft"], "Pass / Save / Draft as before, Send the fourth (D180)");
  assert.match(deck, /export function CardFace\(/);
  assert.match(deck, /data-works-with=""/, "Works with — the team's stack");
  assert.match(deck, /import \{ companyPath \} from "\.\.\/lib\/companySlug\.js";/, "the company name opens its page");
  assert.doesNotMatch(deck, /data-taxonomy-chip|className="[^"]*crumb/, "no taxonomy chip on the card (owner 11-07 / D182 J19)");
});

test("d179SignedOutSamePageNoPersonalParts · signed out, the deck's own card without match %, Starred / Imported or fit sorts; acting asks to sign up", () => {
  const page = read("client/src/pages/jobs/PublicBoardPage.jsx");
  assert.match(page, /import \{ CardFace \} from "\.\.\/\.\.\/panels\/DeckView\.jsx";/, "the SAME card");
  assert.match(page, /band: null, score: null/, "no match % signed out");
  const code = page.replace(/^\s*\/\/.*$/gm, "");   // the header comment names them to say they are absent
  assert.doesNotMatch(code, /Starred|Imported|Best fit|For you/, "no personal views or sorts");
  assert.match(page, /<Link to=\{`\/register\?returnTo=\$\{encodeURIComponent\(j\.path\)\}`\}>Save<\/Link>/, "acting asks to sign up");
});

test("d179SearchSuggestsCompaniesRolesTech · one box, grouped: companies (with open jobs), technologies, titles; people public only", async () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, domain TEXT, parent_id INTEGER);
    CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, title TEXT, normalized_title TEXT, is_active INTEGER, duplicate_of TEXT, board_category TEXT);
    CREATE TABLE job_company (job_id TEXT, company_id INTEGER);`);
  db.prepare(`INSERT INTO companies (id, slug, name) VALUES (1, 'pyrite-labs', 'Pyrite Labs'), (2, 'pyre-closed', 'Pyre Closed')`).run();
  db.prepare(`INSERT INTO scraped_jobs VALUES (1, 'a', 'Python Developer', NULL, 1, NULL, 'software-engineering'), (2, 'b', 'Python Developer', NULL, 0, NULL, 'software-engineering')`).run();
  db.prepare(`INSERT INTO job_company VALUES ('a', 1), ('b', 2)`).run();
  const r = await publicSuggest(db, { all: async (sql, p) => db.prepare(sql).all(...p) }, "py");
  assert.deepEqual(r.companies.map((c) => [c.slug, c.openJobs, c.path]), [["pyrite-labs", 1, "/pyrite-labs"]], "a company with no open job is not suggested (A157: its own address)");
  assert.ok(r.technologies.some((t) => t.name === "Python"));
  assert.ok(Array.isArray(r.roles) && Array.isArray(r.people) && Array.isArray(r.titles));
  const ui = read("client/src/components/UsbSuggest.jsx");
  assert.match(ui, /const GROUP_WORD = \{ company: "Companies", person: "People", role: "Roles", tech: "Technologies", title: "Titles" \};/);
});

test("d179CompanyPickOpensPage · a company picked opens its page — in the shell inside the app, public outside it", () => {
  const ui = read("client/src/components/UsbSuggest.jsx");
  assert.match(ui, /if \(row\.kind === "company"\) \{[\s\S]*?navigate\(`\$\{pathname\.startsWith\("\/app"\) \? "\/app" : ""\}\/companies\/\$\{row\.item\.slug\}`\);/);
  const app = read("client/src/App.jsx");
  assert.match(app, /<Route path="\/companies\/:slug"/, "the public page");
  assert.match(app, /activeTab === "company" && companyRoute && <CompanyPage slug=\{companyRoute\[1\]\} base="\/app\/companies" inApp\/>/, "inside the shell");
});

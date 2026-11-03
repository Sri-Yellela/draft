import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import {
  parseLinkedInConnections, parseAlumniList, importContacts, warmSummary, deleteContacts, warmPathTo, draftNote, connectedOnEpoch,
} from "../services/warmPaths.js";
import { bestBetSignalsFor } from "../services/bestBets.js";
import { mergeAccounts } from "../services/accountService.js";

// ⭐ D138 (owner 11-02) · WARM PATHS — from data the user owns. Synthetic people in the shape of LinkedIn's export.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const LINKEDIN = [
  "Notes:",
  "\"When exporting your connection data, you may notice that some of the email addresses are missing.\"",
  "",
  "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
  "Avery,Lin,https://www.linkedin.com/in/avery-lin-example,,Snowflake Inc.,Data Engineer,12 Mar 2023",
  "Sam,Okafor,https://www.linkedin.com/in/sam-okafor-example,sam@example.com,Datadog,Recruiter,01 Jul 2025",
  "\"Rae, Jr.\",Patel,https://www.linkedin.com/in/rae-example,,\"Acme, Inc.\",PM,05 Jan 2024",
].join("\r\n");
const ALUMNI = "Name,Company,Title\nMorgan Reyes,Snowflake,Analytics Engineer\nJo Kim,Stripe,PM\n";

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x'), (2,'b','x')").run();
  db.prepare("INSERT INTO profile_experience (user_id, company, title, start_ym, end_ym) VALUES (1, 'Walmart', 'Analyst', '2022-06', '2024-05')").run();
  return db;
}

test("D138 · d138OwnExportOnly — LinkedIn's own Connections.csv (its Notes lines, quoted commas) and an alumni list; nothing else", () => {
  const rows = parseLinkedInConnections(LINKEDIN);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], { name: "Rae, Jr. Patel", company: "Acme, Inc.", position: "PM", url: "https://www.linkedin.com/in/rae-example", email: null,
    connectedOn: connectedOnEpoch("05 Jan 2024") });
  assert.equal(connectedOnEpoch("12 Mar 2023"), Math.floor(Date.UTC(2023, 2, 12) / 1000));
  assert.throws(() => parseLinkedInConnections("name,score\nx,1"), /Connections\.csv/);
  assert.equal(parseAlumniList(ALUMNI).length, 2);
  const db = fixtureDb();
  assert.throws(() => importContacts(db, 1, { source: "scrape", text: LINKEDIN }), /Import LinkedIn/);
  assert.throws(() => importContacts(db, 1, { source: "alumni", text: ALUMNI }), /Which school/);
});

test("D138 · d138NoScraping — the service reads only the text it is handed: no fetch, no browser, no model", () => {
  const src = read("services/warmPaths.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /fetch\(|puppeteer|playwright|browserLauncher|https?:\/\/(?!www\.linkedin)|anthropic|toolsService/i);
  const server = read("server.js");
  const from = at(server, 'app.post("/api/warm-paths/import", requireAuth', 0, "the import route");
  assert.match(server.slice(from, from + 400), /importContacts\(db, req\.user\.id, \{ source: req\.body\?\.source, text: String\(req\.body\?\.text \?\? ""\)/);
});

test("D138 · on a posting: who you know there and how — only what the data says", () => {
  const db = fixtureDb();
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  importContacts(db, 1, { source: "alumni", text: ALUMNI, school: "Northeastern" });
  const p = warmPathTo(db, 1, "Snowflake");
  assert.equal(p.count, 2);
  assert.deepEqual(p.people.map(x => x.how).sort(), ["Northeastern alum", "a LinkedIn connection (connected while you were at Walmart)"]);
  assert.match(p.line, /^2 people you know work at Snowflake: /);
  assert.equal(warmPathTo(db, 1, "Acme Inc").count, 1, "company names match as the board does (Inc., punctuation)");
  assert.equal(warmPathTo(db, 1, "Datadog").people[0].how, "a LinkedIn connection", "connected after Walmart: no claim beyond the fact");
  assert.equal(warmPathTo(db, 2, "Snowflake"), null, "another user sees none of them");
  assert.equal(warmPathTo(db, 1, "Nowhere Co"), null);
});

test("D138 · d138NeverContactsAutomatically — the note is drafted for the user to edit, and only copied or opened by them", () => {
  const note = draftNote({ person: { name: "Morgan Reyes", how: "Northeastern alum", source: "alumni" },
    job: { title: "Data Engineer", company: "Snowflake", url: "https://jobs.example/1" }, userName: "Jordan" });
  assert.match(note, /^Hi Morgan,/);
  assert.match(note, /I'm applying for the Data Engineer role at Snowflake \(https:\/\/jobs\.example\/1\)\. We're both Northeastern alumni/);
  assert.match(note, /\[One line, in your words: /, "the user's own words go in before it leaves");
  const block = read("client/src/components/WarmPathsBlock.jsx");
  assert.match(read("client/src/components/JobDetailPanel.jsx"), /<WarmPathsBlock jobId=\{selectedJob\.id \?\? selectedJob\.jobId\} \/>/);
  assert.match(block, /navigator\.clipboard\?\.writeText/);
  assert.match(block, /draft never sends it for you\./);
  assert.doesNotMatch(block, /method: "POST"|sendMail|\/api\/.*send/i, "no send path");
  const svc = read("services/warmPaths.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(svc, /sendEmail|notify|resend|queueEmail/i);
});

test("D138 · d138ConnectionsPrivateDeletable — re-upload replaces, delete by source / school / all, cascade with the account, merge moves", () => {
  const db = fixtureDb();
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  importContacts(db, 1, { source: "alumni", text: ALUMNI, school: "Northeastern" });
  assert.equal(warmSummary(db, 1).people, 5, "a re-upload replaces its source, never doubles it");
  assert.equal(deleteContacts(db, 1, { source: "alumni", school: "Northeastern" }), 2);
  assert.equal(deleteContacts(db, 1), 3);
  assert.equal(warmSummary(db, 1).people, 0);
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  db.pragma("foreign_keys = ON");
  db.prepare("DELETE FROM users WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) FROM warm_contacts").pluck().get(), 0, "gone with the account");
  assert.match(read("services/accountService.js"), /warm_contacts: "move",/);
  assert.match(read("services/accountService.js"), /"application_signals", "navigator_routes", "warm_contacts"[,\]]/, "in the person's export");
  const ui = read("client/src/components/WarmPathsSettings.jsx");
  assert.match(ui, /Delete all my contacts/);
  assert.match(read("client/src/panels/AccountPanel.jsx"), /<WarmPathsSettings say=\{say\} \/>/);
});

test("D138 · a merged person keeps their contacts", () => {
  const db = fixtureDb();
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  mergeAccounts(db, 2, 1);
  assert.equal(warmSummary(db, 2).people, 3);
  assert.equal(warmPathTo(db, 2, "Snowflake").count, 1);
});

test("D138 · d138WarmPathFeedsBestBets — a posting where the user knows people gets the reason and the weight", () => {
  const db = fixtureDb();
  importContacts(db, 1, { source: "linkedin", text: LINKEDIN });
  for (const [id, company] of [["s1", "Snowflake"], ["o1", "Other Co"]]) {
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active) VALUES (?,?,?,?,?,?,?,1)`)
      .run(id, "Data Engineer", company, `https://x.test/${id}`, "t", `h${id}`, "SQL and Python.");
  }
  assert.deepEqual(bestBetSignalsFor(db, { userId: 1, job: { id: "s1" } }).warmPath, { text: "1 person you know works there" });
  assert.equal(bestBetSignalsFor(db, { userId: 1, job: { id: "o1" } }).warmPath, null);
});

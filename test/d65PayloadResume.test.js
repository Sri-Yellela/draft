// ⭐ D65 · WORK HISTORY AND SKILLS COME FROM THE RÉSUMÉ IN THE PAYLOAD (services/payloadResume.js,
// buildPacketEntries' `payload`, routes/apply.js packetEntriesFor, migration 138).
//
// ⛔ The row's tests: the fill's work-history entries equal the payload résumé's parse · a tailored résumé
// that dropped a role does not resurrect it · a claimed skill appears in the fill · a parse failure fills
// nothing for those sections and says so. Synthetic people and companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { payloadResumeParse, parseBasis, skillsOfStructured, claimedSkillsOf, PARSE_FAILED_MESSAGE } from "../services/payloadResume.js";
import { buildPacketEntries } from "../services/applyGatePacket.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { at } from "../test-support/sourceAnchors.js";

const BASE = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind — Senior Software Engineer
Jan 2022 – Present
- Built the billing service in Go

Contoso — Software Engineer
Jun 2019 – Dec 2021
- Wrote the search indexer

Fabrikam — Intern
Jun 2018 – Aug 2018
- Tested the payroll app

SKILLS
Languages: Go, Python, SQL`;
// The tailored résumé for one job DROPPED the Fabrikam internship and reordered the skills.
const TAILORED = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind — Senior Software Engineer
Jan 2022 – Present
- Built the billing service in Go, serving 2M invoices a month

Contoso — Software Engineer
Jun 2019 – Dec 2021
- Wrote the search indexer

SKILLS
Languages: Go, SQL
Tools: Kubernetes`;

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO user_profile (user_id, current_company, current_job_title, confirmed_skills) VALUES (1, 'Profilecorp', 'Engineer', ?)`)
    .run(JSON.stringify(["terraform", "go"]));
  d.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (1, 'base.txt', ?)").run(BASE);
  d.prepare("INSERT INTO resumes (id, user_id, job_id, company, role, html) VALUES (40, 1, 'j1', 'Northwind', 'SWE', ?)").run(TAILORED);
  return d;
}
const profileOf = (d) => d.prepare("SELECT * FROM user_profile WHERE user_id = 1").get();
const companies = (e) => e.work.map(w => w.company);

test("⛔ D65 · the fill's work history EQUALS the payload résumé's parse — the tailored one, not the base", () => {
  const d = db();
  const payload = payloadResumeParse(d, { userId: 1, resumeId: 40 });
  assert.equal(payload.source, "tailored");
  const e = buildPacketEntries({ profile: profileOf(d), payload });
  const parsed = buildStructuredResume(TAILORED).sections.find(s => s.title === "EXPERIENCE").entries.map(x => x.company);
  assert.deepEqual(companies(e), parsed);
  assert.equal(e.resumeSource, "tailored");
});

test("⛔ D65 · a tailored résumé that DROPPED a role does not resurrect it — not from the base, not from the profile", () => {
  const d = db();
  const e = buildPacketEntries({ profile: profileOf(d), payload: payloadResumeParse(d, { userId: 1, resumeId: 40 }) });
  assert.ok(!companies(e).some(c => /Fabrikam/.test(c || "")), "the internship the tailored résumé left out");
  assert.ok(!companies(e).includes("Profilecorp"), "and no profile fallback beside a résumé");
  // Without the tailored one, the base résumé is the payload — and it has the internship.
  const base = buildPacketEntries({ profile: profileOf(d), payload: payloadResumeParse(d, { userId: 1, resumeId: null }) });
  assert.ok(companies(base).some(c => /Fabrikam/.test(c || "")));
  assert.equal(base.resumeSource, "base");
});

test("⛔ D65 · a claimed skill appears in the fill — added, deduplicated, marked as the user's claim", () => {
  const d = db();
  const e = buildPacketEntries({ profile: profileOf(d), payload: payloadResumeParse(d, { userId: 1, resumeId: 40 }) });
  assert.deepEqual(e.skills, ["Go", "SQL", "Kubernetes", "terraform"], "the résumé's skills, then the claim it does not show");
  assert.deepEqual(e.skillsClaimed, ["terraform"], "'go' is on the résumé already — one entry, the résumé's");
  assert.deepEqual(claimedSkillsOf({ confirmed_skills: '["A","a"," b "]' }), ["A", "b"]);
});

test("⛔ D65 · a parse that reads NOTHING fills nothing for work history and the résumé's skills — and says so", () => {
  const d = db();
  d.prepare("UPDATE resumes SET html = ? WHERE id = 40").run("<div>   </div><p>…</p>");
  const payload = payloadResumeParse(d, { userId: 1, resumeId: 40 });
  assert.equal(payload.source, "tailored");
  assert.equal(payload.ok, false);
  const e = buildPacketEntries({ profile: profileOf(d), payload });
  assert.deepEqual(e.work, [], "no fallback to the base résumé's or the profile's roles");
  assert.deepEqual(e.parse, { ok: false, message: PARSE_FAILED_MESSAGE });
  assert.deepEqual(e.skills, ["terraform", "go"], "the user's own claims still fill — they never depended on the parse");
});

test("D65 · the parse is STORED WITH THE RÉSUMÉ, reused while the text is unchanged, re-taken when it changes", () => {
  const d = db();
  const first = payloadResumeParse(d, { userId: 1, resumeId: 40 });
  assert.equal(first.cached, false);
  const row = d.prepare("SELECT parsed_json, parsed_basis FROM resumes WHERE id = 40").get();
  assert.equal(row.parsed_basis, parseBasis(TAILORED));
  assert.ok(JSON.parse(row.parsed_json).sections.length > 0);
  assert.equal(payloadResumeParse(d, { userId: 1, resumeId: 40 }).cached, true);
  d.prepare("UPDATE resumes SET html = ? WHERE id = 40").run(TAILORED.replace("Contoso", "Litware"));
  const again = payloadResumeParse(d, { userId: 1, resumeId: 40 });
  assert.equal(again.cached, false, "a rewritten résumé is re-parsed, never served the old parse");
  assert.ok(buildPacketEntries({ profile: profileOf(d), payload: again }).work.some(w => /Litware/.test(w.company)));
  // The base résumé's parse is stored on its own row too.
  payloadResumeParse(d, { userId: 1 });
  assert.equal(d.prepare("SELECT parsed_basis FROM base_resume WHERE user_id = 1").get().parsed_basis, parseBasis(BASE));
});

test("D65 · another user's résumé id is never read — it falls back to the caller's own base résumé", () => {
  const d = db();
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (2,'bea','x')").run();
  assert.equal(payloadResumeParse(d, { userId: 2, resumeId: 40 }).source, null, "user 2 has no résumé of their own");
});

test("D65 · with NO résumé at all (an answers-only packet), the old rule stands: the profile's current role", () => {
  const d = db();
  d.prepare("DELETE FROM base_resume").run();
  const payload = payloadResumeParse(d, { userId: 1, resumeId: null });
  assert.equal(payload.source, null);
  const e = buildPacketEntries({ profile: profileOf(d), payload });
  assert.deepEqual(companies(e), ["Profilecorp"]);
  assert.equal(e.parse, undefined);
});

test("D65 · skills are read from the résumé's SKILLS rows", () => {
  assert.deepEqual(skillsOfStructured(buildStructuredResume(BASE)), ["Go", "Python", "SQL"]);
});

test("D65 · the packet reads the résumé it CARRIES — at build, and again when attachPacketResume attaches one", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /const entries = packetEntriesFor\(userId, resumeArtifactId\);/);
  assert.match(src, /const entries = packetEntriesFor\(userId, artifactId\);\s+packet = buildGatePacket/);
  const attach = src.slice(at(src, "async function attachPacketResume("), at(src, "function packetEntriesFor("));
  assert.match(attach, /const entries = packetEntriesFor\(userId, artifactId\);/);
  assert.match(attach, /json_set\(answers_json, '\$\.entries', json\(\?\)\)/);
});

test("D65 · migration 138 is byte-identical in both runners", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "138_resume_parse"'); return s.slice(i, at(s, "`,", i)); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
});

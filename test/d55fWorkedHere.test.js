import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// D55 (f) piece 3 — "Have you worked here before?" from the stated work history (docs/AUTOFILL_TARGET.md
// §8.2 item 2): Yes only when the company is in it, No otherwise — stated by the profile, never guessed.

import { buildAnswers, PROVENANCE } from "../services/applyAutomation.js";
import { buildGatePacket, packetSavedAnswers } from "../services/applyGatePacket.js";
import { parseWorkedHereQuestion, workedHereAnswer, workHistoryCompanies } from "../shared/savedAnswers.js";

const YES_NO = [{ value: "y", label: "Yes" }, { value: "n", label: "No" }];
const ask = (label, worked_here, custom_answers = {}) => buildAnswers(
  [{ field_id: "w", name: "former", type: "select", label, handler_type: null, is_required: true, options: YES_NO }],
  { field_map: {}, handler_map: {}, custom_answers, worked_here },
)[0];

test("the question shapes it reads — and the qualified ones it refuses to read", () => {
  for (const q of ["Have you worked for Acme before?", "Have you ever been employed by Acme?", "Have you worked here before? *",
    "Are you a former employee of Acme?", "Are you a current or former employee of Acme?", "Have you previously worked at Acme Corp?",
    "Have you ever worked for Acme, or any of its subsidiaries?", "Have you worked for Acme in the last 12 months?"]) {
    assert.ok(parseWorkedHereQuestion(q), q);
  }
  for (const q of ["Have you worked as an intern at Acme?", "Have you worked here as a contractor?", "Have you worked with React before?x is long and not a company name at all here",
    "Why do you want to work at Acme?", "How many years have you worked in sales?"]) {
    assert.equal(parseWorkedHereQuestion(q), null, q);
  }
  assert.equal(parseWorkedHereQuestion("Have you worked for Acme, or any of its subsidiaries?").widened, true);
  assert.equal(parseWorkedHereQuestion("Have you worked for Acme in the last 12 months?").timeBound, true);
  assert.equal(parseWorkedHereQuestion("Have you worked here before?").named, null);
});

test("Yes ONLY when the employer is in the work history; No only when there IS a history and it is not", () => {
  const history = ["Acme, Inc.", "Globex"];
  assert.deepEqual(workedHereAnswer("Have you worked for Acme before?", "ACME", history), { answer: "Yes", reason: "in_work_history", matched: "Acme, Inc." });
  assert.equal(workedHereAnswer("Have you worked here before?", "Globex Corporation", history).answer, "Yes");
  assert.deepEqual(workedHereAnswer("Have you worked for Initech before?", "Initech", history), { answer: "No", reason: "not_in_work_history" });
  assert.deepEqual(workedHereAnswer("Have you worked for Initech before?", "Initech", []), { answer: null, reason: "no_work_history" },
    "⛔ an empty history states nothing — No would be a guess");
});

test("where the history cannot say, it says nothing", () => {
  const h = ["Scale"];
  assert.equal(workedHereAnswer("Have you worked for Scale AI before?", "Scale AI", h).reason, "ambiguous_company_name");
  assert.equal(workedHereAnswer("Have you worked at Google?", "Figma", ["Google"]).reason, "names_another_employer");
  assert.equal(workedHereAnswer("Have you worked for Acme in the last 12 months?", "Acme", ["Acme"]).reason, "time_bound_unknown_dates");
  assert.equal(workedHereAnswer("Have you worked for Acme in the last 12 months?", "Acme", ["Globex"]).answer, "No",
    "never worked there at all → No is true for any window");
  assert.equal(workedHereAnswer("Have you worked for Acme, or any of its subsidiaries?", "Acme", ["Globex"]).reason, "subsidiaries_unknown");
  assert.equal(workedHereAnswer("Have you worked for Acme?", null, ["Acme"]).reason, "employer_unknown");
});

test("the resolver fills it from the history — ahead of a generic saved answer, which would be false here", () => {
  const a = ask("Have you ever worked for Acme before?", { company: "Acme", history: ["Acme"] },
    { "Have you ever worked for Acme before?": "No" });
  assert.equal(a.value, "y", "Yes, from the work history — not the saved generic No");
  assert.equal(a.provenance, PROVENANCE.FIELD_MAP_EXACT);
  assert.equal(a.matched_on, "work_history:in_work_history");

  const no = ask("Are you a former employee of Initech?", { company: "Initech", history: ["Acme"] });
  assert.equal(no.value, "n");
});

test("when the history cannot say, the candidate's own saved answer is used — or the fill stops", () => {
  const saved = ask("Have you worked for Acme before?", { company: "Acme", history: [] }, { "Have you worked for Acme before?": "No" });
  assert.equal(saved.value, "n");
  assert.equal(saved.provenance, PROVENANCE.CUSTOM_ANSWER);

  const stop = ask("Have you worked for Acme before?", { company: "Acme", history: [] });
  assert.equal(stop.value, null);
  assert.ok(stop.refusals.includes("worked_here:no_work_history"), JSON.stringify(stop.refusals));
});

test("the history is current_company plus the work entries the packet already carries", () => {
  assert.deepEqual(workHistoryCompanies({ profile: { current_company: "Acme" }, work: [{ company: "Globex" }, { company: "Acme" }, { company: "" }] }),
    ["Globex", "Acme"]);
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(server, /worked_here: \{ company: company \|\| null, history: workHistoryCompanies\(\{ profile \}\) \}/);
  const apply = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(apply, /packetEntriesFor\(profile\.user_id\)\?\.work/, "every run and packet payload adds the résumé's employers");
});

test("the packet carries the worked-here fact and the saved answers, for questions the server never saw", () => {
  const payload = {
    field_map: { first_name: "Ada", email: "ada@example.com" }, handler_map: { "first-name": "Ada", email: "ada@example.com" },
    custom_answers: { "How did you hear about Acme?": "A friend", "Receive SMS updates?": "No", "Are you authorized to work in the US?": "Yes" },
    worked_here: { company: "Acme", history: ["Acme"] },
  };
  const extra = packetSavedAnswers(payload);
  assert.deepEqual(extra.workedHere, { company: "Acme", answer: "Yes", reason: "in_work_history" });
  const by = Object.fromEntries(extra.savedAnswers.map(s => [s.question, s]));
  assert.equal(by["Receive SMS updates?"].optIn, true);
  assert.equal(by["Are you authorized to work in the US?"].eligibility, true);
  assert.equal(by["How did you hear about Acme?"].eligibility, false);

  const packet = buildGatePacket({ autofillPayload: payload, applyUrl: "https://boards.greenhouse.io/acme/jobs/1", jobId: "j1" });
  assert.deepEqual(packet.workedHere, extra.workedHere);
  assert.equal(packet.savedAnswers.length, 3);
  assert.equal(packetSavedAnswers({ custom_answers: {} }).savedAnswers, undefined, "absent when empty");
});

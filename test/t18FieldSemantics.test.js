// ⭐ T18 + T23 (owner, field report 4, 10-15) · FIELD SEMANTICS, THE RÉSUMÉ FIELD, AND A PACKET THAT COVERS THE FORM.
//
// The owner's Stripe / Greenhouse panel read "5 of 43 filled · 38 need you": Location (City) and School "Nothing in
// your profile yet", the résumé and cover-letter uploads shown as "Attach", an "Unlabelled field 1". These tests pin the
// fix without a browser — the vocabulary (extension/fieldSemantics.js), the matcher's semantic tier
// (gated-handoff.js matchAnswersToFields), the packet's new answer sources (services/applyGatePacket.js: the fuller
// canonical set, the parsed base résumé's facts, the phone's country code), the panel's rows (review-overlay.js) — on
// the standard Greenhouse form as the probe reports it (test-support/greenhouseStandard.mjs; the real-Chrome test
// t18GreenhouseChrome checks the real page reads the same). Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildGatePacket, resumeFacts, resumeAnswers, derivedAnswers, splitDegree, degreeLevelOf, PACKET_ANSWERS_VERSION, CANONICAL_GATE_FIELDS }
  from "../services/applyGatePacket.js";
import { PROFILE_KEY_TO_HANDLER } from "../services/applyAutomation.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { matchAnswersToFields, questionKind, resumeInputScore } from "../extension/gated-handoff.js";
import { semanticKeyOf, classifyFields, fileTypeOf, guessLabelOf, offerGenerateOnCue, FIELD_VOCABULARY } from "../extension/fieldSemantics.js";
import { panelRowsForStep, panelSummary, EXACT_MATCHES, MATCH_CONFIDENCE } from "../extension/review-overlay.js";
import { placeStatedAnswers } from "../extension/savedAnswerMatch.js";
import { GREENHOUSE_FIELDS, STANDARD_IDS, SYNTHETIC_PAYLOAD, SYNTHETIC_RESUME } from "../test-support/greenhouseStandard.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const kind = { kindOf: questionKind };
const packetFor = ({ payload = SYNTHETIC_PAYLOAD, resume = SYNTHETIC_RESUME } = {}) => buildGatePacket({
  autofillPayload: payload, baseResume: resume ? buildStructuredResume(resume) : null,
  applyUrl: "https://job-boards.greenhouse.io/examplerobotics/jobs/4000001", jobId: "greenhouse::4000001", gateReason: "prepared",
});
const byId = (id) => GREENHOUSE_FIELDS.find(f => f.id === id);

// ── the vocabulary ───────────────────────────────────────────────────────────────────────────────────────────────
test("T18: the vocabulary reads a standard Greenhouse form's fields — Location (City) is the city, School the school", () => {
  const keys = Object.fromEntries(GREENHOUSE_FIELDS.map((f, i) => [f.id, classifyFields(GREENHOUSE_FIELDS, kind)[i]]));
  assert.deepEqual(
    { first: keys.first_name, last: keys.last_name, email: keys.email, phone: keys.phone, country: keys.country, city: keys["candidate-location"],
      li: keys.question_30001, web: keys.question_30002, school: keys["school--0"], degree: keys["degree--0"], disc: keys["discipline--0"],
      sm: keys["start-month--0"], sy: keys["start-year--0"], em: keys["end-month--0"], ey: keys["end-year--0"], heard: keys.question_30003, pref: keys.preferred_name },
    { first: "first-name", last: "last-name", email: "email", phone: "phone", country: "country", city: "city", li: "linkedin", web: "website",
      school: "school", degree: "degree", disc: "field-of-study", sm: "start-month", sy: "start-year", em: "grad-month", ey: "grad-year",
      heard: "how-heard", pref: "preferred-name" });
});

test("⛔ T18: the vocabulary never names an attestation, an EEO question, a consent or a screening question — whatever its words", () => {
  for (const label of ["Are you legally authorized to work in the United States?*", "Will you now or in the future require sponsorship?",
    "Gender", "Veteran Status", "Are you Hispanic/Latino?", "I agree to the privacy policy", "Do you have 5+ years of experience?",
    "Are you willing to relocate to this city?", "Desired salary", "Receive text messages about this job"]) {
    assert.equal(semanticKeyOf({ type: "text", label }, kind), null, label);
  }
  // defence in depth: whatever the words, a label the caller's questionKind reads as an attestation gets no key
  assert.equal(semanticKeyOf({ type: "text", label: "Country" }, { kindOf: () => "eligibility" }), null);
  assert.equal(semanticKeyOf({ type: "text", label: "Country" }, { kindOf: () => "other" }), "country");
  // anchored, not keywords: a city of birth is not the city; a referrer's name is not the candidate's
  assert.equal(semanticKeyOf({ type: "text", label: "City of birth" }, kind), null);
  assert.equal(semanticKeyOf({ type: "text", label: "Name of Referrer" }, kind), null);
  assert.equal(semanticKeyOf({ type: "text", label: "Current company" }, kind), "current-company");
  // a radio's label is its option ("Yes") — never vocabulary; a file is typed, not keyed
  assert.equal(semanticKeyOf({ type: "radio", label: "City" }, kind), null);
  assert.equal(semanticKeyOf({ type: "file", label: "Resume" }, kind), null);
  // the page's own words win over its attributes: a field LABELLED something else is not keyed by its name
  assert.equal(semanticKeyOf({ type: "text", label: "Favourite colour", name: "job_application[city]" }, kind), null);
  assert.equal(semanticKeyOf({ type: "text", label: "", name: "job_application[city]" }, kind), "city");
  assert.equal(semanticKeyOf({ type: "text", label: "", autocomplete: "postal-code" }, kind), "zip");
  // every key a vocabulary entry names is distinct
  assert.equal(new Set(FIELD_VOCABULARY.map(v => v.key)).size, FIELD_VOCABULARY.length);
});

test("T18: an education block's bare 'End date year' is the graduation year — an employment block's is left alone", () => {
  const edu = classifyFields([{ type: "text", label: "School" }, { type: "text", label: "End date year" }], kind);
  assert.deepEqual(edu, ["school", "grad-year"]);
  const job = classifyFields([{ type: "text", label: "School" }, { type: "text", label: "Company name" }, { type: "text", label: "End date year" }], kind);
  assert.deepEqual(job, ["school", null, null], "after an employer, the date is the employer's — nothing here answers it");
  assert.deepEqual(classifyFields([{ type: "text", label: "End date year" }], kind), [null], "no block → no key");
});

test("T18: an upload is typed — résumé · cover letter · other — by its label (the group's heading), then its attributes", () => {
  assert.equal(fileTypeOf({ type: "file", label: "Resume/CV*" }), "resume");
  assert.equal(fileTypeOf({ type: "file", label: "Cover Letter" }), "cover_letter");
  assert.equal(fileTypeOf({ type: "file", label: "", id: "cover_letter" }), "cover_letter");
  assert.equal(fileTypeOf({ type: "file", label: "", id: "resume" }), "resume");
  assert.equal(fileTypeOf({ type: "file", label: "Transcript" }), "other");
  assert.equal(fileTypeOf({ type: "file", label: "Upload", id: "f-1" }), "other", "a box named nothing is not assumed to be the résumé");
  assert.equal(fileTypeOf({ type: "text", label: "Resume" }), null);
  // the extension's résumé score and this module's agree (they are copies — the page side cannot import)
  const src = read("extension/fieldSemantics.js");
  const copy = src.slice(at(src, "function resumeInputScore(context) {"), at(src, "/** An upload's type"));
  const squash = (s) => s.replace(/\s+/g, " ").trim();
  assert.ok(squash(copy).startsWith(squash(resumeInputScore.toString().replace(/\r\n/g, "\n"))), "the copy is byte-identical modulo indentation");
});

test("T18: a field nothing named shows a best guess from its attributes before 'Unlabelled field N'", () => {
  assert.equal(guessLabelOf({ id: "candidate-location" }), "Candidate location");
  assert.equal(guessLabelOf({ name: "job_application[phone]" }), "Phone");
  assert.equal(guessLabelOf({ id: "question_30001" }), "", "a generated id says nothing");
  assert.equal(guessLabelOf({ id: "a91f3c0e77" }), "");
  const rows = panelRowsForStep({ fields: [
    { index: 0, type: "text", label: "", id: "candidate-location", visible: true },
    { index: 1, type: "text", label: "", id: "question_30009", visible: true },
  ] });
  assert.equal(rows[0].label, "Candidate location");
  assert.equal(rows[0].bestGuess, true);
  assert.equal(rows[0].noRemember, true, "a guessed label is never the key an answer is remembered under");
  assert.equal(rows[1].label, "Unlabelled field 1", "the last resort, still");
  assert.equal(rows[1].unlabelled, true);
});

// ── the packet's answer sources (server) ─────────────────────────────────────────────────────────────────────────
test("T18 / T23: the parsed base résumé states the school, degree, discipline, dates, current employer and the header's links", () => {
  const f = resumeFacts(buildStructuredResume(SYNTHETIC_RESUME));
  assert.deepEqual(f, {
    linkedin: "https://linkedin.com/in/avery-testcase", github: "https://github.com/avery-testcase", website: "https://averytest.dev",
    school: "State University of Examples", degree: "Bachelor of Science", degreeLevel: "Bachelor's Degree", "field-of-study": "Computer Science",
    "grad-year": "2018", "grad-month": "May", "start-year": "2014", "start-month": "August",
    "current-company": "Globex Corporation", "current-title": "Senior Software Engineer",
  });
  // a role that ended is not "current"
  const ended = resumeFacts(buildStructuredResume(SYNTHETIC_RESUME.replace("Jan 2022 – Present", "Jan 2022 – Mar 2024")));
  assert.equal(ended["current-company"], undefined);
  assert.deepEqual(resumeFacts(null), {});
  assert.deepEqual(splitDegree("MS Computer Science"), { degree: "Master of Science", field: "Computer Science" });
  assert.equal(degreeLevelOf("Ph.D."), "Doctor of Philosophy (Ph.D.)");
});

test("T18: the profile wins — a résumé fact is added only for a key the profile left empty", () => {
  const structured = buildStructuredResume(SYNTHETIC_RESUME);
  const have = [{ name: "school", handler_type: "school", value: "Northfield College" }];
  const out = resumeAnswers(structured, have);
  assert.equal(out.find(a => a.handler_type === "school"), undefined);
  const degree = out.find(a => a.handler_type === "degree");
  assert.equal(degree.value, "Bachelor of Science");
  assert.equal(degree.choice, "Bachelor's Degree", "a picker is matched by the level");
  assert.equal(degree.source, "resume");
  assert.equal(degree.provenance, "field_map_exact");
  assert.equal(degree.eligibility, false);
});

test("T18: the phone's country code comes from the profile's country — and only with a phone", () => {
  const [d] = derivedAnswers(SYNTHETIC_PAYLOAD, []);
  assert.deepEqual({ value: d.value, choice: d.choice, key: d.handler_type }, { value: "+1", choice: "United States +1", key: "phone-country" });
  assert.deepEqual(derivedAnswers({ handler_map: { country: "United States" } }, []), [], "no phone, no code");
  assert.deepEqual(derivedAnswers({ handler_map: { country: "Atlantis", phone: "1" } }, []), [], "a country it does not know");
});

test("T18 / T23: the canonical set asks what a standard form asks, in the resolver's own vocabulary; packets carry their answer-set version", () => {
  const known = new Set(Object.values(PROFILE_KEY_TO_HANDLER));
  for (const k of ["location", "github", "portfolio", "school", "degree", "field-of-study", "grad-year"]) {
    assert.ok(CANONICAL_GATE_FIELDS.some(f => f.handler_type === k), k);
    assert.ok(known.has(k), k);
  }
  const p = packetFor();
  assert.equal(p.answersVersion, PACKET_ANSWERS_VERSION);
  assert.ok(PACKET_ANSWERS_VERSION >= 2);
  // the résumé's facts answer what the profile did not, and are no longer listed as unresolved
  assert.equal(p.answers.find(a => a.handler_type === "school")?.value, "State University of Examples");
  assert.ok(!p.unresolved.some(u => u.handler_type === "school"));
  // ⛔ no résumé fact is an attestation
  assert.ok(p.answers.filter(a => a.source === "resume").every(a => a.eligibility === false));
  // the route re-makes a prepared packet built with an older answer set
  const route = read("routes/apply.js");
  const block = route.slice(at(route, "function prepareManualPacket("), at(route, "async function processRunJob("));
  assert.match(block, /const currentAnswers = \(parseJson\(existing\?\.answers_json, \{\}\)\?\.answersVersion \?\? 1\) >= PACKET_ANSWERS_VERSION;/);
  assert.match(block, /if \(existing && currentAnswers && !packetFreshness/);
  assert.match(block, /baseResume: baseResumeParsed\(userId\),/);
});

// ── the matcher on the standard form ─────────────────────────────────────────────────────────────────────────────
function prepared(packet = packetFor()) {
  const m = matchAnswersToFields(packet.answers, GREENHOUSE_FIELDS);
  const stated = placeStatedAnswers(packet, GREENHOUSE_FIELDS, m.plan, questionKind);
  return { plan: [...m.plan, ...stated.plan], unmatched: [...m.unmatched, ...stated.notes] };
}

test("⭐ T23: ≥ 80 % of a standard Greenhouse form is prepared with NO typing when the profile and the résumé hold the answers", () => {
  const { plan } = prepared();
  const planned = new Set(plan.map(p => GREENHOUSE_FIELDS[p.index].id));
  // the résumé upload is prepared when the row offers an attach — one click, no typing (base résumé on file)
  const rows = panelRowsForStep({ fields: GREENHOUSE_FIELDS, plan });
  const resumeRow = rows.find(r => r.fileType === "resume");
  assert.equal(resumeRow.resumeOffer, true);
  const prep = STANDARD_IDS.filter(id => planned.has(id) || id === "resume");
  const share = prep.length / STANDARD_IDS.length;
  assert.ok(share >= 0.8, `${prep.length} of ${STANDARD_IDS.length} (${Math.round(share * 100)}%): missing ${STANDARD_IDS.filter(id => !prep.includes(id)).join(", ")}`);
  // the measured number, pinned so a regression is seen: every standard field but the cover letter (no letter on file)
  assert.deepEqual(STANDARD_IDS.filter(id => !prep.includes(id)), ["cover_letter"]);
  // values: the profile's city, the résumé's school, the degree's level for the picker, the country for the phone's picker
  const v = (id) => plan.find(p => GREENHOUSE_FIELDS[p.index].id === id)?.value;
  assert.equal(v("candidate-location"), "Springfield");
  assert.equal(v("school--0"), "State University of Examples");
  assert.equal(v("degree--0"), "Bachelor's Degree");
  assert.equal(v("discipline--0"), "Computer Science");
  assert.equal(v("end-year--0"), "2018");
  assert.equal(v("end-month--0"), "May");
  assert.equal(v("question_30001"), "https://linkedin.com/in/avery-testcase");
  assert.equal(v("question_30002"), "https://averytest.dev");
  assert.equal(v("country"), "United States");
  // ⛔ nothing on an eligibility, EEO or consent question; nothing on the preferred name (the profile states none)
  for (const id of ["question_30005", "question_30006", "gender", "veteran_status", "preferred_name"]) assert.ok(!planned.has(id), id);
  // matched exactly (the vocabulary counts as exact), so nothing lands in "Check"
  assert.ok(plan.every(p => EXACT_MATCHES.has(p.matchedBy)), JSON.stringify(plan.map(p => p.matchedBy)));
  assert.equal(MATCH_CONFIDENCE.semantic, 1.0);
});

test("T23: without the vocabulary and the résumé (the field report's state) the same form prepared far less — the measured gap", () => {
  // the old answer set: the canonical profile answers only, no résumé, matched without the semantic tier
  const p = packetFor({ resume: null });
  const old = matchAnswersToFields(p.answers.map(a => ({ ...a, handler_type: null })), GREENHOUSE_FIELDS).plan
    .filter(x => STANDARD_IDS.includes(GREENHOUSE_FIELDS[x.index].id));
  assert.ok(old.length <= 7, `before: ${old.length}`);
});

test("T18: a custom question falls to the candidate's saved answer, then to Needs you", () => {
  const saved = { ...packetFor(), savedAnswers: [{ question: "How did you hear about this job?", answer: "A friend at the company", eligibility: false, optIn: false }] };
  const { plan } = prepared(saved);
  assert.equal(plan.find(p => GREENHOUSE_FIELDS[p.index].id === "question_30003")?.value, "A friend at the company");
  assert.equal(plan.find(p => GREENHOUSE_FIELDS[p.index].id === "question_30003")?.matchedBy, "saved_answer");
  // without one: Needs you, with the place to type it
  const rows = panelRowsForStep({ fields: GREENHOUSE_FIELDS, plan: prepared().plan, kindOf: questionKind });
  const heard = rows.find(r => r.label === "How did you hear about this job?");
  assert.equal(heard.group, "need");
  assert.equal(heard.canType, true);
  const why = rows.find(r => /^Why do you want/.test(r.label));
  assert.equal(why.group, "need");
});

test("⭐ T18: the standard Greenhouse form has NO 'Unlabelled' row; the résumé upload is a résumé, the cover letter a cover letter", () => {
  const { plan } = prepared();
  const rows = panelRowsForStep({ fields: GREENHOUSE_FIELDS, plan, kindOf: questionKind });
  assert.deepEqual(rows.filter(r => /Unlabelled|^Attach$/.test(r.label)).map(r => r.label), []);
  const resume = rows.find(r => r.label === "Resume/CV");
  const letter = rows.find(r => r.label === "Cover Letter");
  assert.equal(resume.fileType, "resume");
  assert.equal(resume.note, "Your résumé goes here — choose which one.");
  assert.equal(letter.fileType, "cover_letter");
  assert.equal(letter.resumeOffer, undefined);
  // an attached résumé is the résumé box's — the cover letter's box never reads "Résumé — attached"
  const after = panelRowsForStep({ fields: GREENHOUSE_FIELDS, plan, resume: { attached: true, filename: "Avery_Testcase_Resume.pdf" } });
  assert.equal(after.find(r => r.label === "Resume/CV").group, "ok");
  assert.equal(after.find(r => r.label === "Cover Letter").group, "need");
  const filledRows = panelRowsForStep({ fields: GREENHOUSE_FIELDS, plan, kindOf: questionKind,
    filled: plan.map(p => ({ field: p.label, name: p.name, index: p.index })) });
  const s = panelSummary(filledRows);
  assert.ok(s.filled >= 15, s.line);
  assert.equal(s.check, 0, "nothing to acknowledge — every placement is exact");
});

// ── the résumé row: the user's click, and T24's gate ─────────────────────────────────────────────────────────────
test("⛔ T18: a file is never attached without the user's click — the row's Attach / Generate are trusted presses; drawing sends nothing", () => {
  const ro = read("extension/review-overlay.js");
  const view = ro.slice(at(ro, "export function renderOverlay("), at(ro, "export function removeReviewPanel"));
  // the row's choices
  // the row's choices (⭐ T26: an icon control — its words are its aria-label and tooltip)
  assert.match(view, /ib\('attach', 'attach', 'Attach tailored', \{ cls: ' primary', attrs: ' data-which="tailored"' \}\)/);
  assert.match(view, /ib\('attach', 'resume', 'Attach my résumé', \{ cls: files\.tailored \? '' : ' primary', attrs: ' data-which="base"' \}\)/);
  assert.match(view, /ib\('generate', 'generate', 'Generate and attach'\)/);
  assert.match(view, /ib\('skip', 'skip', 'Skip'\)/);
  // every send of an attach or a generation is after the isTrusted gate, in its role's handler
  const trusted = at(view, "if (!ev.isTrusted) return;");
  for (const needle of ["type: 'RESUME_ATTACH'", "type: 'RESUME_ATTACH_FILE'", "type: 'RESUME_GENERATE', trigger: 'click'"]) {
    const i = at(view, needle);
    assert.ok(i > trusted, `${needle} only after the trusted-click check`);
  }
  assert.ok(at(view, "if (role === 'attach') {") > trusted);
  assert.ok(at(view, "if (role === 'generate') {") > trusted);
  // the service worker refuses an attach without the click's trigger; the bytes go to the form's frame
  const rp = read("extension/resumePanel.js");
  assert.match(rp, /RESUME_ATTACH_FILE: async \(msg, sender\) => \{\n\s+if \(msg\?\.trigger !== 'click'\) return refuse\('A file is attached only from its button\.'\);/);
  assert.match(rp, /target: \{ tabId, frameIds: \[formFrameOf\(tabId\)\] \}, func: attachResumeFile/);
});

test("T24's gate for 'Generate and attach': offered on cue by default; never when the setting is 'never', a résumé is ready, or one is being made", () => {
  assert.equal(offerGenerateOnCue({}), true);
  assert.equal(offerGenerateOnCue({ setting: "never" }), false);
  assert.equal(offerGenerateOnCue({ tailoredReady: true }), false);
  assert.equal(offerGenerateOnCue({ inFlight: true }), false);
});

// ── Show details (T6's developer view) and the base-résumé routes ────────────────────────────────────────────────
test("T18: Options → Show details lists how the fill read the labels, and the RAW attributes of a field nothing named — never a value", async () => {
  const d = await import("../extension/diagnostics.js");
  d.noteFieldsRead(77, [
    { index: 0, type: "text", id: "first_name", label: "First Name*", labelSource: "for" },
    { index: 1, type: "text", id: "question_30009", label: "", labelSource: null,
      raw: { id: "question_30009", name: null, type: "text", aria: null, labelledby: null, placeholder: null, near: "Optional", data: ["data-qa=q9"] } },
  ], { guessOf: guessLabelOf });
  const out = d.detailsOf({ tabs: [{ id: 77 }] });
  const tab = out.tabs.find(x => x.id === 77);
  assert.deepEqual(tab.fields.labelSources, { for: 1, none: 1 });
  assert.deepEqual(tab.fields.unlabelled, [{ index: 1, guess: null, id: "question_30009", name: null, type: "text", aria: null, labelledby: null,
    placeholder: null, near: "Optional", data: ["data-qa=q9"] }]);
  assert.ok(d.readTabIds().includes(77), "a tab a fill read is in the details");
  assert.doesNotMatch(JSON.stringify(tab.fields), /value/i);
});

test("T18: GET /api/extension/base-resume and …/pdf/file — the extension's credential only; the PDF's name; absent → 404", async (t) => {
  const express = (await import("express")).default;
  const { createExtensionResumeRouter } = await import("../routes/extensionResume.js");
  const service = { baseResumeInfo: (uid) => (uid === 1 ? { exists: true, fileName: "Avery_Testcase_Resume.pdf" } : { exists: false, fileName: null }),
    baseResumePdf: async (uid) => (uid === 1 ? { fileName: "Avery_Testcase_Resume.pdf", body: Buffer.from("%PDF-1.4 synthetic") } : null) };
  const app = express();
  app.use((req, _res, next) => { req.user = { id: Number(req.headers["x-user"] || 1) }; next(); });
  app.use(createExtensionResumeRouter({ service, requireAuth: (q, r, n) => n(), isExtension: (req) => req.headers["x-ext"] === "1" }));
  const srv = app.listen(0);
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;
  const info = await fetch(`${base}/api/extension/base-resume`, { headers: { "x-ext": "1" } });
  assert.deepEqual(await info.json(), { exists: true, fileName: "Avery_Testcase_Resume.pdf" });
  const pdf = await fetch(`${base}/api/extension/base-resume/pdf/file`, { headers: { "x-ext": "1" } });
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition"), /filename="Avery_Testcase_Resume\.pdf"/);
  assert.equal((await pdf.text()).slice(0, 8), "%PDF-1.4");
  assert.equal((await fetch(`${base}/api/extension/base-resume/pdf/file`, { headers: { "x-ext": "1", "x-user": "2" } })).status, 404);
  assert.equal((await fetch(`${base}/api/extension/base-resume/pdf/file`)).status, 403, "a browser tab's request is refused");
});

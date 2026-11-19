// J4 · D96 §4–§7 — THE REVIEW PANEL, THE ANSWER LIFECYCLE (client) AND FIELD COVERAGE. The pure rules and the
// client wrapper against J8's REAL routes (routes/savedAnswers.js on the full schema, a SYNTHETIC user). The real-
// Chrome half is test/j4PanelBrowser.test.js. Each rule here was shown red with its line removed (the commit says how).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const dedent = (s) => s.split("\n").map(l => l.trim()).join("\n");

// ── a chrome stub (storage only) ─────────────────────────────────────────────────────────────────────
function chromeStub() {
  const stores = { local: new Map(), session: new Map() };
  const area = (m) => ({
    async get(k) {
      if (k == null) return Object.fromEntries(m);
      const keys = [].concat(k);
      return Object.fromEntries(keys.filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  });
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { sendMessage: async () => null, getURL: (p) => `chrome-extension://test/${p}` },
    tabs: { query: async () => [] },
    scripting: { executeScript: async () => [{ result: null }] },
  };
  return stores;
}
chromeStub();

const gh = await import("../extension/gated-handoff.js");
const ov = await import("../extension/review-overlay.js");
const sam = await import("../extension/savedAnswerMatch.js");
const ak = await import("../extension/answerKey.js");
const shared = await import("../shared/answerKey.js");

let idx = 0;
const f = (o) => ({ index: idx++, name: null, id: `f${idx}`, required: false, options: null, widget: null, group: null, automationId: null, visible: true, hasValue: false, ...o });

// ── 0 · the copy is the shared rule, byte for byte ───────────────────────────────────────────────────
test("⛔ J4: extension/answerKey.js carries shared/answerKey.js's block BYTE FOR BYTE", () => {
  const block = (src, begin, end) => { const a = at(src, begin); return src.slice(at(src, "\n", a) + 1, at(src, end, a)); };
  const s = block(read("shared/answerKey.js"), "// ─── BEGIN the extension copy", "// ─── END the extension copy ───");
  const e = block(read("extension/answerKey.js"), "// ─── BEGIN COPY of shared/answerKey.js ───", "// ─── END COPY ───");
  assert.ok(s.length > 2000, "the shared block is missing");
  assert.equal(e, s, "the extension's key / never-fill guard drifted from shared/answerKey.js");
  for (const q of ["First Name*", "* First Name :", "Do you require sponsorship (required)?"]) {
    assert.deepEqual(ak.answerKeyOf({ question: q, widgetKind: "input" }), shared.answerKeyOf({ question: q, widgetKind: "input" }));
  }
});

// ── 1 · "First Name*" is an EXACT match ─────────────────────────────────────────────────────────────
test("⛔ J4 (D96 §4/§5 symptom 4): 'First Name*' and 'First Name *' match 'First Name' EXACTLY — not a guessed field", () => {
  for (const label of ["First Name*", "First Name *", "First Name"]) {
    const { plan } = gh.matchAnswersToFields(
      [{ name: "first_name", field: "First Name", value: "Ada", provenance: "field_map_exact" }],
      [f({ name: null, automationId: "x-not-in-the-table", label })]);
    assert.equal(plan.length, 1, label);
    assert.equal(plan[0].matchedBy, "label_exact", `${label}: an equal label is exact`);
    const item = ov.toReviewItem({ ...plan[0], field: plan[0].label });
    assert.equal(item.isGuess, false, `${label} is not a guess`);
    assert.notEqual(item.tierLabel, "guessed field");
  }
  // A loose match — the control's NAME resembling the answer's — is still a guess, and says so.
  // (⭐ T18: a label in the field vocabulary — "Forename" IS the first name — is matched 'semantic', which is exact; the
  // loose case is a label the vocabulary does not read.)
  const semantic = gh.matchAnswersToFields([{ name: "first_name", field: "Given", value: "Ada", provenance: "field_map_exact" }],
    [f({ name: "first-name", label: "Forename" })]).plan[0];
  assert.equal(semantic.matchedBy, "semantic");
  assert.equal(ov.toReviewItem({ ...semantic, field: semantic.label }).isGuess, false);
  const loose = gh.matchAnswersToFields([{ name: "first_name", field: "Given", value: "Ada", provenance: "field_map_exact" }],
    [f({ name: "first-name", label: "Prénom" })]).plan[0];
  assert.equal(loose.matchedBy, "label");
  assert.equal(ov.toReviewItem({ ...loose, field: loose.label }).tierLabel, "guessed field");
  // ⛔ eligibility is still exact-or-not-at-all: an equal LABEL does not place it.
  const elig = gh.matchAnswersToFields([{ name: "authorized", field: "Are you authorized to work in the US?", value: "Yes", eligibility: true }],
    [f({ label: "Are you authorized to work in the US?*" })]);
  assert.equal(elig.plan.length, 0);
  assert.equal(elig.unmatched[0].reason, "eligibility_requires_exact_match");
  // and the panel shows the label without its asterisk
  assert.equal(ov.shownLabel("First Name*"), "First Name");
  assert.equal(ov.shownLabel("First Name *"), "First Name");
});

// ── 2 · Ready means ready ───────────────────────────────────────────────────────────────────────────
test("⛔ J4 (D96 §5 symptom 3): 'Ready' is NEVER said with 0 filled — 'Nothing was filled' instead", () => {
  const none = ov.panelSummary([]);
  assert.equal(none.ready, false);
  assert.equal(none.state, "Nothing was filled — the page has no fields draft recognises yet.");
  // fields the page already held are not "filled by draft"
  const prefilled = ov.panelSummary([{ group: "ok", byDraft: false }, { group: "ok", byDraft: false }]);
  assert.equal(prefilled.ready, false);
  assert.match(prefilled.state, /^Nothing was filled/);
  const needs = ov.panelSummary([{ group: "ok", byDraft: true }, { group: "need" }, { group: "need" }]);
  assert.equal(needs.ready, false);
  assert.equal(needs.state, "Not ready — 2 need you.");
  assert.equal(needs.line, "1 of 3 filled · 2 need you · 0 to check");
  assert.equal(ov.panelSummary([{ group: "ok", byDraft: true }, { group: "check", byDraft: true }]).ready, false, "a check row blocks");
  const ready = ov.panelSummary([{ group: "ok", byDraft: true }]);
  assert.equal(ready.ready, true);
  assert.equal(ready.state, "Ready. Everything uncertain has been checked.");
});

test("⛔ J4: the panel's serialised summary is byte-identical to the tested export; 'I submitted it' waits for Ready", () => {
  const src = read("extension/review-overlay.js");
  const exported = src.slice(at(src, "export function panelSummary("));
  const exportedText = exported.slice("export ".length, at(exported, "\n}\n") + 2).trimEnd();
  const render = src.slice(at(src, "export function renderOverlay("));
  const inner = render.slice(at(render, "  function panelSummary("));
  const innerText = inner.slice(0, at(inner, "\n  }\n") + 4).trimEnd();
  assert.ok(innerText.length > 400);
  assert.equal(dedent(innerText), dedent(exportedText), "the copy the page runs drifted from the one these tests run");
  // ⭐ T26: an icon control — its words are its aria-label and tooltip; it is disabled until Ready
  assert.match(render, /ib\('submitted', 'submitted', 'I submitted it', \{ title: 'I submitted it — draft never submits for you', attrs: s\.ready \? '' : ' disabled aria-disabled="true"' \}\)/);
  assert.match(render, /if \(role === 'submitted'\) \{\n\s+if \(!panelSummary\(rows\)\.ready\) return;/);
});

// ── 3 · every field is listed ───────────────────────────────────────────────────────────────────────
const stepFields = () => {
  idx = 0;
  return [
    f({ type: "text", label: "First Name*", required: true }),
    f({ type: "text", label: "Address Line 1*", required: true }),
    f({ type: "button", widget: "dropdown", label: "State*", required: true }),
    f({ type: "tel", label: "Phone Number*", required: true }),
    f({ type: "text", label: "Middle Name" }),
    f({ type: "checkbox", label: "I have read and consent to the Terms and Conditions*", required: true }),
    f({ type: "radio", name: "auth", label: "Yes", group: "Are you legally authorized to work in the United States?*" }),
    f({ type: "radio", name: "auth", label: "No", group: "Are you legally authorized to work in the United States?*" }),
    f({ type: "text", label: "Month", dateGroup: { id: "d1", label: "Available from*", part: "month" } }),
    f({ type: "text", label: "Year", dateGroup: { id: "d1", label: "Available from*", part: "year" } }),
  ];
};

test("⛔ J4 (D96 §5 symptom 5): EVERY field on the step is a row — the unfilled ones under Needs you, nothing silent", () => {
  const fields = stepFields();
  const plan = [
    { index: 0, name: null, id: "f1", label: "First Name*", value: "Ada", provenance: "field_map_exact", matchedBy: "label_exact" },
    { index: 2, name: null, id: "f3", label: "State*", value: "Massachusetts", provenance: "field_map_exact", matchedBy: "exact" },
  ];
  const rows = ov.panelRowsForStep({
    stepName: "My Information", fields, plan, kindOf: gh.questionKind,
    filled: [{ field: "First Name*", name: null, index: 0, verified: true }],
    skipped: [{ field: "State*", name: null, reason: "value_not_in_options", wanted: "Massachusetts" }],
    unmatched: [{ field: "I have read and consent to the Terms and Conditions*", reason: "consent_left_for_you" }],
  });
  const by = Object.fromEntries(rows.map(r => [r.label, r]));
  assert.deepEqual(Object.keys(by), ["First Name", "Address Line 1", "State", "Phone Number", "Middle Name",
    "I have read and consent to the Terms and Conditions", "Are you legally authorized to work in the United States?", "Available from"],
    "one row per question — a radio group and a date are ONE question each — every one listed, asterisks gone");
  assert.equal(by["First Name"].group, "ok");
  assert.equal(by["First Name"].source, "profile");
  assert.equal(by["Address Line 1"].group, "need");
  assert.equal(by["Address Line 1"].canType, true, "a place to type it");
  assert.equal(by["Middle Name"].group, "need");
  assert.equal(by["Middle Name"].optional, true, "optional — it can be left blank");
  // ⛔ the fill that did not take: Needs you, with the value ready to copy
  assert.equal(by.State.group, "need");
  assert.equal(by.State.copyValue, "Massachusetts");
  assert.match(by.State.note, /pick it yourself/);
  // ⛔ the consent box: Needs you, NO place to type
  assert.equal(by["I have read and consent to the Terms and Conditions"].group, "need");
  assert.equal(by["I have read and consent to the Terms and Conditions"].canType, false);
  assert.equal(by["Are you legally authorized to work in the United States?"].widgetKind, "radio");
  assert.deepEqual(by["Are you legally authorized to work in the United States?"].choices, ["Yes", "No"]);
  assert.equal(by["Are you legally authorized to work in the United States?"].eligibility, true);
  assert.equal(by["Available from"].widgetKind, "date");
  const s = ov.panelSummary(rows);
  assert.equal(s.line, "1 of 8 filled · 7 need you · 0 to check");
  assert.equal(s.ready, false);
});

test("⛔ J4 (D96 §7): a fill that did not take — reverted by the page — is listed under Needs you with the value", () => {
  idx = 0;
  const fields = [f({ type: "text", label: "Phone Number*", required: true })];
  const rows = ov.panelRowsForStep({ fields,
    plan: [{ index: 0, label: "Phone Number*", name: null, value: "5550100", provenance: "field_map_exact", matchedBy: "label_exact" }],
    filled: [], skipped: [{ field: "Phone Number*", name: null, reason: "reverted_after_set", wanted: "5550100", got: "" }] });
  assert.equal(rows[0].group, "need");
  assert.equal(rows[0].copyValue, "5550100");
  assert.match(rows[0].note, /did not keep it/);
});

test("⛔ J4: password and payment fields are never rows — and never enumerated by the probe or the fill", () => {
  idx = 0;
  const rows = ov.panelRowsForStep({ fields: [f({ type: "text", label: "Card number" }), f({ type: "password", label: "Password" }), f({ type: "text", label: "City" })] });
  assert.deepEqual(rows.map(r => r.label), ["City"]);
  const src = read("extension/gated-handoff.js");
  const sel = /const controls = \[\.\.\.scope\.querySelectorAll\(\n\s+'([^']+)'\n\s+\)\]\.filter\(\n([^;]+);/g;
  const found = [...src.matchAll(sel)].map(m => dedent(m[2]));
  assert.equal(found.length, 2);
  assert.equal(found[0], found[1], "the probe and the fill enumerate the same controls");
  assert.match(found[0], /'reset', 'password'\]/, "a password box is not a control draft reads");
  assert.match(found[0], /\^cc-\|one-time-code\|-password\$/, "nor a payment or one-time-code field");
  // A page with a password box is a sign-in page: never filled, whatever the adapter says.
  assert.equal(gh.formRecognition({ wizard: { step: "Sign In" }, hasPassword: true, fields: [f({ type: "email", label: "Email" })] }, [{}, {}, {}]).recognised, false);
});

// ── 4 · never tick terms / consent / attestation / signature ────────────────────────────────────────
test("⛔ J4 (D96 §4 safeguard 1): a terms / consent / attestation / signature control is NEVER given a value", () => {
  idx = 0;
  const fields = [
    f({ type: "checkbox", label: "I have read and consent to the Terms and Conditions*", automationId: "agreementCheckbox" }),
    f({ type: "checkbox", label: "I certify that the information above is true" }),
    f({ type: "text", label: "Name*", automationId: "selfIdentifiedDisabilityData--name" }),
    f({ type: "text", label: "Month", automationId: "dateSectionMonth-input", dateGroup: { id: "g", label: "Date*", part: "month", aid: "formField-selfIdentifiedDisabilityData--dateSignedOn" } }),
    f({ type: "text", label: "Type your full legal name as your signature" }),
    f({ type: "text", label: "City" }),
  ];
  for (const x of fields.slice(0, 5)) assert.equal(gh.neverFillReasonOfField(x, fields), "consent_or_attestation", x.label);
  assert.equal(gh.neverFillReasonOfField(fields[5], fields), null);
  // the matcher refuses them…
  const m = gh.matchAnswersToFields(fields.map((x, i) => ({ name: `a${i}`, field: x.label.replace("*", ""), value: "true" })), fields);
  assert.deepEqual(m.plan.map(p => p.label), ["City"]);
  assert.ok(m.unmatched.filter(u => u.reason === "consent_left_for_you").length >= 4);
  // …a remembered answer for one is refused by the enforced rule on the whole plan…
  const placed = sam.placeStatedAnswers({ savedAnswers: [{ question: "I certify that the information above is true", answer: "Yes" }] }, fields, [], gh.questionKind);
  assert.equal(placed.plan.length, 1, "the saved-answer placer alone would tick it");
  assert.equal(gh.withoutNeverFill(placed.plan, fields).plan.length, 0, "…and the enforced rule takes it out");
  // …an edit typed in the panel yields no step…
  assert.deepEqual(gh.overlayEditSteps({ label: "I have read and consent to the Terms and Conditions", index: 0 }, "true"), []);
  // …it is never sent to be remembered…
  assert.equal(ak.neverFillableReason("Do you certify that you are authorized to work?"), "consent_or_attestation", "owner: 'Do you certify…' is an attestation");
  // …and the fill applies the rule to the step's WHOLE plan, and again inside the page, before anything is set.
  const src = read("extension/gated-handoff.js");
  const loop = src.slice(at(src, "async function fillFromPacket("), at(src, "async function captureFormSchema("));
  assert.ok(at(loop, "const guarded = withoutNeverFill(matched.plan, step.fields);") < at(loop, "func: applyPlan,"));
  const plan = src.slice(at(src, "async function applyPlan("), at(src, "// ── Matching"));
  assert.match(plan, /const place = async \(step, el\) => \{\n\s+if \(\(neverFill && neverFill\.test\(ownText\(el\)\)\) \|\| isSignatureId\(el\) \|\| inSignatureBlock\(el\)\) \{/);
  assert.match(src, /fillOptions\(opts\)/);
  assert.match(src, /return \{ neverFillSource: NEVER_FILL_RE\.source \};/);
});

// ── 5 · the saved-answer KEY on the page ─────────────────────────────────────────────────────────────
test("⛔ J4 (D96 §4): a keyed saved answer fills only the SAME question — label + widget kind + option wording", () => {
  idx = 0;
  const radios = (group, opts) => opts.map(label => f({ type: "radio", name: "q", label, group }));
  const q = "Are you legally authorized to work in the United States?";
  const keyed = { question: q, answer: "Yes", eligibility: true, source: "you_acknowledged", acknowledgedAt: "2026-10-11T10:00:00Z",
    widgetKind: "radio", options: ["no", "yes"], questionKey: ak.questionLabelKey(q), attesting: true, id: 7 };
  // the same question, its options in another order → placed, exactly, with where it came from
  let r = sam.placeStatedAnswers({ savedAnswers: [keyed] }, radios(`${q}*`, ["No", "Yes"]), [], gh.questionKind);
  assert.equal(r.plan.length, 1);
  assert.equal(r.plan[0].saved.source, "you_acknowledged");
  assert.equal(r.plan[0].saved.acknowledgedAt, "2026-10-11T10:00:00Z");
  // a MATERIAL change in the options is a new question → asked
  r = sam.placeStatedAnswers({ savedAnswers: [keyed] }, radios(q, ["Yes", "No", "Prefer not to say"]), [], gh.questionKind);
  assert.equal(r.plan.length, 0, "different option wording is a NEW question");
  // another widget kind is another question
  r = sam.placeStatedAnswers({ savedAnswers: [keyed] }, [f({ type: "text", label: q })], [], gh.questionKind);
  assert.equal(r.plan.length, 0);
  // a Workday dropdown shows no options until opened: matched by label + kind, the wording checked when it opens
  r = sam.placeStatedAnswers({ savedAnswers: [{ ...keyed, widgetKind: "select", options: ["no", "yes"] }] },
    [f({ type: "button", widget: "dropdown", label: q })], [], gh.questionKind);
  assert.equal(r.plan.length, 1);
  assert.deepEqual(r.plan[0].expectOptions, ["no", "yes"]);
  // a legacy label-only answer ('any') still matches by its label
  r = sam.placeStatedAnswers({ savedAnswers: [{ question: "Why Zoom?", answer: "Video.", widgetKind: "any" }] }, [f({ type: "textarea", label: "Why Zoom?*" })], [], gh.questionKind);
  assert.equal(r.plan[0].value, "Video.");
  // conflicts: the NEWEST acknowledged answer wins
  r = sam.placeStatedAnswers({ savedAnswers: [
    { question: "City", answer: "Old", widgetKind: "text", acknowledgedAt: "2026-01-01T00:00:00Z" },
    { question: "City", answer: "New", widgetKind: "text", acknowledgedAt: "2026-10-01T00:00:00Z" }] }, [f({ type: "text", label: "City" })], [], gh.questionKind);
  assert.equal(r.plan[0].value, "New");
});

test("⛔ J4 (D96 §7): dates in the page's own parts, checkbox groups exactly — or not at all", () => {
  assert.deepEqual(sam.dateParts("2026-11-01"), { year: "2026", month: "11", day: "01" });
  assert.deepEqual(sam.dateParts("3/2024"), { month: "3", day: null, year: "2024" });
  assert.equal(sam.dateParts("next spring"), null);
  idx = 0;
  const parts = [f({ label: "Month", dateGroup: { id: "d", label: "Start date", part: "month" } }), f({ label: "Year", dateGroup: { id: "d", label: "Start date", part: "year" } })];
  let r = sam.placeStatedAnswers({ savedAnswers: [{ question: "Start date", answer: "2026-11-01", widgetKind: "date" }] }, parts, [], gh.questionKind);
  assert.deepEqual(r.plan.map(p => p.value), ["11", "2026"]);
  const day = [...parts, f({ label: "Day", dateGroup: { id: "d", label: "Start date", part: "day" } })];
  r = sam.placeStatedAnswers({ savedAnswers: [{ question: "Start date", answer: "11/2026", widgetKind: "date" }] }, day, [], gh.questionKind);
  assert.equal(r.plan.length, 0, "the page asks for a day the answer does not have — not guessed");
  assert.deepEqual(gh.overlayEditSteps({ unitKind: "date", locator: [{ index: 1, part: "month" }, { index: 2, part: "year" }] }, "03/2024").map(s => s.value), ["03", "2024"]);
  idx = 0;
  const boxes = ["Remote (US)", "San Jose, CA", "Seattle, WA"].map(label => f({ type: "checkbox", name: "loc", label, group: "Which locations would you consider?" }));
  r = sam.placeStatedAnswers({ savedAnswers: [{ question: "Which locations would you consider?", answer: "Remote (US), Seattle, WA", widgetKind: "checkbox", options: ["Remote (US)", "San Jose, CA", "Seattle, WA"] }] }, boxes, [], gh.questionKind);
  assert.deepEqual(r.plan.map(p => p.index).sort(), [0, 2], "a label that itself holds a comma is still one box");
  r = sam.placeStatedAnswers({ savedAnswers: [{ question: "Which locations would you consider?", answer: "Remote (US), Mars", widgetKind: "checkbox", options: ["Remote (US)", "San Jose, CA", "Seattle, WA"] }] }, boxes, [], gh.questionKind);
  assert.equal(r.plan.length, 0, "a name that is not one of the boxes refuses the whole answer");
});

// ── 6 · the lifecycle through J8's REAL routes ──────────────────────────────────────────────────────
async function lifecycleServer() {
  const [{ default: express }, { default: Database }, { MIGRATIONS }, { createSavedAnswersRouter }] = await Promise.all([
    import("express"), import("better-sqlite3"), import("../scripts/migrations.js"), import("../routes/savedAnswers.js")]);
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  const app = express();
  app.use(express.json());
  const seen = [];
  app.use((req, _res, next) => { seen.push({ method: req.method, path: req.path, body: req.body }); req.user = { id: 1 }; next(); });
  app.use(createSavedAnswersRouter({ db, requireAuth: (q, r, n) => n() }));
  const server = await new Promise(r => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  return { db, seen, url: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

test("⛔ J4 (D96 §4): one acknowledgement remembers — eligibility included — and the NEXT fill and the Copy sheet use it", async (t) => {
  const stores = chromeStub();
  stores.local.set("authToken", "t");
  const srv = await lifecycleServer(); t.after(srv.stop);
  const mem = await import("../extension/answerMemory.js");
  const tab = { id: 9, url: "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/x/apply" };
  await gh.savePacketForTab(9, { packetId: 1, expectedOrigin: "https://zoom.wd5.myworkdayjobs.com", packet: { jobId: "gh-zoom-1", answers: [] } });
  const before = (await gh.loadPacketForTab(9)).expiresAt;
  const handlers = mem.handlersFor(srv.url);
  const q = "Are you legally authorized to work in the United States?";
  const r = await handlers.ANSWER_ACKNOWLEDGE({ question: q, widgetKind: "radio", options: ["Yes", "No"], answer: "Yes", source: "you_typed" }, { tab });
  assert.equal(r.ok, true, JSON.stringify(r));
  const posted = srv.seen.find(s => s.path === "/api/saved-answers/acknowledge");
  assert.deepEqual(posted.body, { question: q, widgetKind: "radio", options: ["Yes", "No"], answer: "Yes", source: "you_typed", jobId: "gh-zoom-1" },
    "the job is the TAB's (its released packet), never the message's");
  const row = srv.db.prepare("SELECT * FROM saved_answers WHERE user_id = 1").get();
  assert.equal(row.state, "acknowledged");
  assert.equal(row.category, "work_auth", "an eligibility answer — remembered on ONE acknowledgement");
  // the tab's released packet now carries it, its expiry unchanged → the next fill on this tab places it
  const held = await gh.loadPacketForTab(9);
  assert.equal(held.expiresAt, before, "refreshing the saved answers never extends a packet's life");
  const sa = held.packet.savedAnswers.find(s => s.question === q);
  assert.equal(sa.answer, "Yes");
  assert.equal(sa.source, "you_typed");
  idx = 0;
  const page = ["Yes", "No"].map(label => f({ type: "radio", name: "auth", label, group: `${q}*` }));
  const next = sam.placeStatedAnswers(held.packet, page, [], gh.questionKind);
  assert.equal(next.plan.length, 1, "the next fill places it — not asked again");
  assert.equal(next.plan[0].index, 0);
  assert.equal(next.plan[0].saved.attesting, true);
  // the Copy sheet's rows (services/manualHandoff.js) show it with its source, date and the attestation
  const { copySheetRows } = await import("../services/manualHandoff.js");
  const sheet = copySheetRows(held.packet).rows.find(x => x.label === q);
  assert.equal(sheet.source, "you_typed");
  assert.ok(sheet.acknowledgedAt);
  assert.equal(sheet.attesting, true);
});

test("⛔ J4 (D96 §4): an edit is RECORDED, the new value is NOT stored, and the old value is no longer auto-used", async (t) => {
  const stores = chromeStub();
  stores.local.set("authToken", "t");
  const srv = await lifecycleServer(); t.after(srv.stop);
  const { handlersFor } = await import("../extension/answerMemory.js");
  const handlers = handlersFor(srv.url);
  const tab = { id: 10, url: "https://zoom.wd5.myworkdayjobs.com/x" };
  await gh.savePacketForTab(10, { packetId: 2, packet: { jobId: "j-2", answers: [] } });
  await handlers.ANSWER_ACKNOWLEDGE({ question: "Address Line 1", widgetKind: "text", answer: "1 Example Way", source: "you_typed" }, { tab });
  assert.equal((await gh.loadPacketForTab(10)).packet.savedAnswers.length, 1);
  const ch = await handlers.ANSWER_CHANGE({ question: "Address Line 1", widgetKind: "text", answer: "2 Other Road" }, { tab });
  assert.equal(ch.ok, true);
  assert.equal(ch.stored, false, "the new value is not stored");
  assert.equal(ch.servesThisApplicationOnly, true);
  const row = srv.db.prepare("SELECT answer, state FROM saved_answers WHERE user_id = 1").get();
  assert.deepEqual({ ...row }, { answer: null, state: "changed" });
  const hist = srv.db.prepare("SELECT from_value, to_value, job_id FROM answer_history WHERE event = 'changed'").get();
  assert.deepEqual({ ...hist }, { from_value: "1 Example Way", to_value: "2 Other Road", job_id: "j-2" }, "a history row: from → to · which job");
  const held = await gh.loadPacketForTab(10);
  assert.equal((held.packet.savedAnswers || []).length, 0, "the old value is no longer in the tab's packet");
  idx = 0;
  assert.equal(sam.placeStatedAnswers(held.packet, [f({ type: "text", label: "Address Line 1*" })], [], gh.questionKind).plan.length, 0,
    "the next fill asks again");
  // re-acknowledging the new value stores it
  await handlers.ANSWER_ACKNOWLEDGE({ question: "Address Line 1", widgetKind: "text", answer: "2 Other Road", source: "you_typed" }, { tab });
  assert.equal(srv.db.prepare("SELECT answer FROM saved_answers WHERE user_id = 1").pluck().get(), "2 Other Road");
});

test("⛔ J4: the client never sends a consent / attestation / signature or a secret to be remembered", async (t) => {
  const stores = chromeStub();
  stores.local.set("authToken", "t");
  const srv = await lifecycleServer(); t.after(srv.stop);
  const { handlersFor, keyFieldsOf } = await import("../extension/answerMemory.js");
  const handlers = handlersFor(srv.url);
  const tab = { id: 11, url: "https://x.example/" };
  for (const question of ["I have read and consent to the Terms and Conditions", "Do you certify that the above is true?", "Social Security Number", "Password"]) {
    const r = await handlers.ANSWER_ACKNOWLEDGE({ question, widgetKind: "text", answer: "x" }, { tab });
    assert.equal(r.ok, false, question);
    assert.equal(r.error, "never_remembered", question);
  }
  assert.equal(srv.seen.filter(s => s.path === "/api/saved-answers/acknowledge").length, 0, "nothing was sent");
  assert.equal(keyFieldsOf({ question: "City", widgetKind: "combobox" }).widgetKind, "select", "aliases canonicalised");
  assert.equal((await handlers.ANSWER_ACKNOWLEDGE({ question: "City", widgetKind: "text", answer: "x" }, {})).error, "no_tab");
});

// ── 7 · progress, dock, wiring ──────────────────────────────────────────────────────────────────────
test("⛔ J4 (D96 §3/§5): the progress record takes the PANEL's counts — the popup and the panel say the same numbers", async () => {
  chromeStub();
  const { noteFill, progress } = await import("../extension/progress.js");
  await noteFill({ ok: true, filled: [{}, {}], fieldCount: 20, missingCount: 9, review: { uncertainCount: 9 },
    panel: { filled: 14, of: 18, needYou: 2, check: 3 } }, { jobId: "j-p" });
  const r = await progress.get({ jobId: "j-p" });
  assert.deepEqual((({ at, ...c }) => (assert.equal(typeof at, "number", "43k: counts carry when they were made"), c))(r.filled), { n: 14, of: 18, needYou: 2, check: 3 });
  const src = read("extension/gated-handoff.js");
  assert.match(src, /panel: \{ filled: panel\.filled, of: panel\.total, needYou: panel\.need, check: panel\.check, ready: panel\.ready \},/);
});

// ⭐ T17 (owner 10-15): the panel's side was the TAB's (the binding's `panelDock`, the Copy sheet's `dock`). It is now
// the ONE dock's, remembered per SITE (dockHost.js `dockPlace`) — the binding keeps no side, and a re-bind changes none.
test("⛔ J4 → T17: where the review panel sits is the DOCK's, remembered per site — the binding keeps no side of its own", async () => {
  const stores = chromeStub();
  const tb = await import("../extension/tabBinding.js");
  const tab = { id: 12, url: "https://zoom.wd5.myworkdayjobs.com/x" };
  await tb.bindTab(tab, { jobId: "j" });
  const b = await tb.loadBinding(12);
  assert.equal(b.dock, undefined, "no Copy-sheet side on the binding");
  assert.equal(b.panelDock, undefined, "no review-panel side on the binding");
  assert.equal(tb.setBindingDock, undefined, "the per-tab dock side is gone with the panels' own placement");
  assert.equal([...stores.session.keys()].length, 1);
  // the dock remembers it per site — the review panel's own Dock button became the dock's
  const host = read("extension/dockHost.js");
  assert.match(host, /DOCK_PLACE: async \(msg, sender\) => \{/);
  assert.doesNotMatch(read("extension/review-overlay.js"), /PANEL_DOCK/, "the panel sends no side of its own");
});

test("⛔ J4: no new storage key, no new permission — and the router wiring handed over is the one the browser pass ran", async () => {
  const writes = (p) => (read(p).match(/chrome\.storage\.(?:local|session)\.set\(/g) || []).length;
  for (const p of ["extension/answerMemory.js", "extension/review-overlay.js", "extension/answerKey.js", "extension/copy-sheet-panel.js"]) assert.equal(writes(p), 0, p);
  assert.equal(writes("extension/gated-handoff.js"), 2, "gate:{tabId} and batch:{tabId} — one write site each, as before");
  assert.doesNotMatch(read("extension/review-overlay.js"), /localStorage|sessionStorage|indexedDB/);
  const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  // Wired into the shipped router (the coordinator, at the J4 merge) — the browser pass runs exactly this file.
  const router = read("extension/background.js");
  assert.match(router, /import \{ handlers as ANSWER_MEMORY_HANDLERS, configureAnswerMemory \} from '\.\/answerMemory\.js';/);
  assert.match(router, /configureAnswerMemory\(\{ serverUrl: RESUME_MASTER_URL \}\);/);
  assert.match(router, /const handle = ANSWER_MEMORY_HANDLERS\[msg\?\.type\];/);
  assert.doesNotMatch(read("test-support/walks/panelLifecycle.mjs"), /backgroundAppend/, "the walk must not append a second copy of the wiring");
  const mem = await import("../extension/answerMemory.js");
  assert.deepEqual(Object.keys(mem.handlers).sort(), ["ANSWER_ACKNOWLEDGE", "ANSWER_CHANGE"], "T17: PANEL_DOCK went with the panel's own placement");
});

test("⛔ J4 (J2 measured): the wizard presses only a VISIBLE, enabled Continue — never on a page with a password box", () => {
  const src = read("extension/gated-handoff.js");
  const fn = src.slice(at(src, "function advanceWizard() {"), at(src, "// Injected, ISOLATED world. Which step is showing"));
  assert.match(fn, /if \(\[\.\.\.document\.querySelectorAll\('input\[type="password"\]'\)\]\.some\(seen\)\) return \{ ok: false, reason: 'sign_in_page' \};/);
  assert.match(fn, /\]\.find\(seen\)/, "the automation-id button must be SEEN");
  assert.match(fn, /find\(b => seen\(b\) && continueText\.test/);
  assert.ok(at(fn, "reason: 'sign_in_page'") < at(fn, "btn.click();"));
});

test("⛔ J4 (measured): ONE fill per tab — a newer fill supersedes one still waiting; the older never advances or paints", () => {
  const src = read("extension/gated-handoff.js");
  const loop = src.slice(at(src, "async function fillFromPacket("), at(src, "async function captureFormSchema("));
  assert.match(loop, /ACTIVE_FILL\.set\(tab\.id, panelMeta\.runId\);/);
  assert.match(loop, /if \(!isCurrent\(\)\) \{ wizard\.stoppedAt = 'superseded'; break; \}\n\s+const matched/);
  assert.match(loop, /const waited = await waitForCandidate\(tab\.id, origin, step\.wizard\.step, wizard, isCurrent\);\n\s+if \(!waited\.ok\) \{ wizard\.stoppedAt = waited\.reason; break; \}\n\s+if \(!isCurrent\(\)\) \{ wizard\.stoppedAt = 'superseded'; break; \}\n\s+await showBadge\(tab\.id, 'progress'(?:, progressSoFar\(\))?\);\n\s+const moved = await advanceAndWait/);
  assert.ok(at(loop, "if (!isCurrent()) {\n    return { ok: false, reason: 'superseded'") < at(loop, "drawInDock(tab.id, renderOverlay,"), "a superseded run draws nothing");
  assert.match(src, /async function waitForCandidate\(tabId, origin, stepName, wizard, isCurrent = \(\) => true\) \{[\s\S]{0,200}if \(!isCurrent\(\)\) return \{ ok: false, reason: 'superseded' \};/);
});

test("⛔ J4: a refused fill (a sign-in page, a form not recognised) takes another step's panel off the page", () => {
  const src = read("extension/gated-handoff.js");
  const fill = src.slice(at(src, "async function fillFromPacket("), at(src, "async function captureFormSchema("));
  const refused = fill.slice(at(fill, "if (!recognition.recognised) {"), at(fill, "await showBadge(tab.id, 'progress');"));
  assert.ok(at(refused, "func: removeReviewPanel") < at(refused, "showBadge(tab.id, 'unrecognised'"));
});

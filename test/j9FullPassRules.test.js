// J9 · what the integration browser pass found, as UNIT RULES (the pass itself, in a real Chrome, is test/j9FullPass.test.js).
// ⭐ A232 R3 (46y, owner 11-19 "all four approved"): these rules were split out of j9FullPass.test.js so they run in the fast
// tier on every change; the walk there now runs ONE theme, and the last test below pins what the second walk used to
// check in the other theme — the dock's frame paints SURFACE_MENU from the palette of the scheme the page is in.
//
// The full pass (the `fullPass` walk; the path is not written here, or the tier rule would call this file a browser
// file): capture on the owner's apply URL → bound → read → prepare → fill →
// the review panel → acknowledge a guess and type a needed answer → the popup remembers → reload → a résumé generated
// and attached → the Copy sheet → a new fill reuses every remembered answer; then the plain fake-ATS form. It found:
//
//   1. An ACKNOWLEDGED guess was asked again on the next fill. The packet still carries the profile's guess for that
//      question (Postal Code, by a whole-token label match on `postal`), the guess took the control first, and the
//      candidate's own acknowledged answer — waiting behind it — never got the field. D96 §4: "tick once and it is
//      remembered; it is not asked again." Fixed: a guess yields its control to the candidate's own stated answer for
//      the same question (extension/savedAnswerMatch.js yieldGuessesToStated, used by the fill's every step).
//   2. The Copy sheet listed the same question twice — the guess, labelled "profile", and the acknowledged answer. A
//      guess was never the profile's answer. Fixed: the server drops a packet answer whose question has an answer of
//      the candidate's own (services/manualHandoff.js copySheetRows), and a guess left on the sheet says "matched
//      loosely" (extension/copy-sheet-panel.js), the review panel's own word for it.
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import { matchAnswersToFields, questionKind } from "../extension/gated-handoff.js";
import { placeStatedAnswers, yieldGuessesToStated } from "../extension/savedAnswerMatch.js";
import { copySheetRows } from "../services/manualHandoff.js";

let idx = 0;
const f = (o) => ({ index: idx++, name: null, id: null, required: false, options: null, widget: null, group: null, ...o });

// What the fixture's My Information step gives the fill: Workday's automation ids, the label with its "*".
const postal = () => f({ type: "text", label: "Postal Code*", automationId: "addressSection_postalCode" });
const city = () => f({ type: "text", label: "City*", automationId: "addressSection_city" });
// The packet's answers as the server builds them from the profile (services/applyGatePacket.js, canonical fields).
const GUESS = { field: "Postal Code", name: "zip", value: "01101", provenance: "label_fuzzy", confidence: 0.3, eligibility: false };
const EXACT = { field: "City", name: "city", value: "Springfield", provenance: "field_map_exact", confidence: 0.9, eligibility: false };
const ACK = { question: "Postal Code", questionKey: "postal code", answer: "01101", widgetKind: "text", options: null,
  source: "you_acknowledged", acknowledgedAt: "2026-10-14T05:28:33.000Z", eligibility: false, optIn: false, attesting: false, id: 1 };

/** The fill's per-step planning, as gated-handoff.js runs it. */
function planStep(packet, fields) {
  const matched = matchAnswersToFields(packet.answers, fields);
  matched.plan = yieldGuessesToStated(matched.plan, packet, fields, questionKind);
  const stated = placeStatedAnswers(packet, fields, matched.plan, questionKind);
  return [...matched.plan, ...stated.plan];
}

test("⛔ J9 #1: an acknowledged answer outranks the profile's GUESS for the same question — the next fill does not ask again", () => {
  const fields = [postal(), city()];
  const plan = planStep({ answers: [GUESS, EXACT], savedAnswers: [ACK] }, fields);
  const pc = plan.filter(p => p.index === fields[0].index);
  assert.equal(pc.length, 1, "one value for the Postal Code control");
  assert.equal(pc[0].provenance, "saved_answer", "the candidate's acknowledged answer — not the guess");
  assert.equal(pc[0].saved?.source, "you_acknowledged");
  // the exact profile answer is not a guess, and keeps its control
  assert.equal(plan.find(p => p.index === fields[1].index)?.provenance, "field_map_exact");
});

test("J9 #1: with nothing acknowledged the guess still fills — and is still a guess the panel asks about", () => {
  const fields = [postal()];
  const plan = planStep({ answers: [GUESS], savedAnswers: [] }, fields);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].provenance, "label_fuzzy");
});

test("J9 #1: a saved answer for a DIFFERENT question takes nothing from the guess", () => {
  const fields = [postal()];
  const other = { ...ACK, question: "Postal Code (mailing)", questionKey: "postal code (mailing)" };
  const plan = planStep({ answers: [GUESS], savedAnswers: [other] }, fields);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].provenance, "label_fuzzy");
});

test("J9 #1: an EXACT profile answer is never displaced by a saved answer (only a guess yields)", () => {
  const fields = [city()];
  const saved = { ...ACK, question: "City", questionKey: "city", answer: "Elsewhere" };
  const plan = planStep({ answers: [EXACT], savedAnswers: [saved] }, fields);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].provenance, "field_map_exact");
  assert.equal(plan[0].value, "Springfield");
});

test("⛔ J9 #2: the Copy sheet lists a question ONCE — the candidate's own answer, not the profile's guess beside it", () => {
  const sheet = copySheetRows({ answers: [GUESS, EXACT], savedAnswers: [ACK] });
  const pcs = sheet.rows.filter(r => /^postal code$/i.test(r.label));
  assert.equal(pcs.length, 1, JSON.stringify(pcs));
  assert.equal(pcs[0].provenance, "saved_answer");
  assert.equal(pcs[0].source, "you_acknowledged");
  assert.ok(sheet.rows.some(r => r.label === "City" && r.provenance === "field_map_exact"), "the other answers stay");
});

test("J9 #1: the fill's every step runs the yield between the packet's match and the stated answers", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /const matched = matchAnswersToFields\(answers, step\.fields\);\n[^\n]*\n    matched\.plan = yieldGuessesToStated\(matched\.plan, released\.packet, step\.fields, questionKind\);\n(?:    \/\/[^\n]*\n)*    const stated = placeStatedAnswers\(released\.packet, step\.fields, matched\.plan, questionKind\);/);
});

test("J9 #2: an EXACT profile answer keeps its row beside a saved answer (only a guess is dropped, as in the fill)", () => {
  const sheet = copySheetRows({ answers: [EXACT], savedAnswers: [{ ...ACK, question: "City", questionKey: "city", answer: "Elsewhere" }] });
  assert.ok(sheet.rows.some(r => r.label === "City" && r.provenance === "field_map_exact" && r.value === "Springfield"));
});

test("J9 #2: with no answer of the candidate's own, the guess stays on the sheet — with its provenance", () => {
  const sheet = copySheetRows({ answers: [GUESS], savedAnswers: [] });
  assert.deepEqual(sheet.rows.map(r => [r.label, r.provenance]), [["Postal Code", "label_fuzzy"]]);
});

test("J9 #2: the Copy sheet panel calls a guess \"matched loosely\", never \"profile\"", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("extension/copy-sheet-panel.js", "utf8").replace(/\r\n/g, "\n");
  const fn = src.match(/const sourceWords = \(row\) => \{[\s\S]*?\n  \};/);
  assert.ok(fn, "copy-sheet-panel.js keeps sourceWords");
  // eslint-disable-next-line no-new-func
  const sourceWords = new Function(`const day = () => ''; ${fn[0]}; return sourceWords;`)();
  for (const p of ["label_fuzzy", "default", "sponsorship_assumed_future"]) assert.equal(sourceWords({ provenance: p }), "matched loosely", p);
  assert.equal(sourceWords({ provenance: "field_map_exact" }), "profile");
});

// ── #3 · the popup follows the panel ────────────────────────────────────────────────────────────────────────────────
function chromeStub() {
  const local = new Map();
  const area = (m) => ({
    async get(k) { if (k == null) return Object.fromEntries(m); return Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))])); },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  });
  globalThis.chrome = { storage: { local: area(local), session: area(new Map()) }, runtime: { getURL: (p) => p } };
  return local;
}
let instance = 0;

test("⛔ J9 #3: the panel's recount after an acknowledgement reaches the progress record — the popup says what the panel says", async () => {
  chromeStub();
  const { noteFill, noteReviewed, progress } = await import(`../extension/progress.js?j9=${++instance}`);
  await noteFill({ ok: true, filled: [{}, {}, {}, {}, {}, {}], fieldCount: 14, panel: { filled: 6, of: 13, needYou: 7, check: 1 } }, { jobId: "wd-1" });
  assert.deepEqual((({ at, ...c }) => (assert.equal(typeof at, "number", "43k: counts carry when they were made"), c))((await progress.get({ jobId: "wd-1" })).filled), { n: 6, of: 13, needYou: 7, check: 1 });
  // the candidate acknowledges the guess and types the address: the panel reports (GATE_REVIEW_STATE), not ready
  await noteReviewed({ ready: false, counts: { filled: 7, of: 13, needYou: 6, check: 0 }, edits: [{ key: "k", value: "1 Example Way" }] }, { jobId: "wd-1" });
  const r = await progress.get({ jobId: "wd-1" });
  assert.deepEqual((({ at, ...c }) => (assert.equal(typeof at, "number", "43k: counts carry when they were made"), c))(r.filled), { n: 7, of: 13, needYou: 6, check: 0 });
  assert.equal(r.reviewed, null, "not ready → not Reviewed");
  assert.ok(!JSON.stringify(r).includes("1 Example Way"), "counts only — never the typed value");
  // ready still marks Reviewed, as before
  await noteReviewed({ ready: true, counts: { filled: 13, of: 13, needYou: 0, check: 0 } }, { jobId: "wd-1" });
  assert.ok((await progress.get({ jobId: "wd-1" })).reviewed?.at);
  delete globalThis.chrome;
});

test("J9 #3: a report with no counts changes nothing (and a not-ready one marks nothing)", async () => {
  chromeStub();
  const { noteReviewed, progress } = await import(`../extension/progress.js?j9=${++instance}`);
  assert.equal(await noteReviewed({ ready: false }, { jobId: "wd-2" }), null);
  assert.equal(await progress.get({ jobId: "wd-2" }), null);
  delete globalThis.chrome;
});

test("J9 #3: the fill remembers the counts the panel DREW (the candidate's actions carried over), not the rows before them", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /const dc = drawn\?\.result\?\.counts;\n    if \(dc && Number\.isFinite\(dc\.filled\) && Number\.isFinite\(dc\.of\)\) drawnPanel = \{ \.\.\.dc, ready: drawn\.result\.ready === true \};/);
  assert.match(src, /    panel: drawnPanel \|\| \{ filled: panel\.filled, of: panel\.total, needYou: panel\.need, check: panel\.check, ready: panel\.ready \},/);
  // and the overlay returns exactly those keys
  const ov = fs.readFileSync("extension/review-overlay.js", "utf8");
  assert.match(ov, /counts: \{ filled: s\.filled, of: s\.total, needYou: s\.need, check: s\.check \}/);
});

// ── A232 R3: the both-themes half of the walk's surface check, without a browser ─────────────────────────────────
test("J9 (A232 R3): the dock's frame paints SURFACE_MENU from the palette of EACH scheme — the walk checks one, this pins both", async () => {
  const { C_LIGHT, C_DARK } = await import("../extension/tokens.js");
  const { themePair } = await import("../extension/dockHost.js");
  // the walk's account has no appearance set: the OS-following pair, Paper Light under light and Charcoal Dark under dark
  const pair = themePair(undefined);
  assert.equal(pair.light, C_LIGHT);
  assert.equal(pair.dark, C_DARK);
  assert.notEqual(C_LIGHT.SURFACE_MENU, C_DARK.SURFACE_MENU, "the two schemes differ, so painting the wrong one would show");
  const fs = await import("node:fs");
  const dock = fs.readFileSync("extension/dock.js", "utf8").replace(/\r\n/g, "\n");
  // the light palette on :host (+ the plate's, D197 #19 47m), the dark one under the page's prefers-color-scheme: dark — and nothing else picks it
  assert.match(dock, /:host \{ all: initial; \$\{varsOf\(theme\?\.light\)\} \$\{plVarsOf\(theme\?\.plate\)\} \}\n    @media \(prefers-color-scheme: dark\) \{ :host \{ \$\{varsOf\(theme\?\.dark\)\} \} \}/);
  // the frame's background IS that variable
  // ⭐ D197 #19 (47m): the frame is a plate — paper, with SURFACE_MENU as the fallback for a service worker without the plate palette
  assert.match(dock, /\.fr \{ position: absolute;[^}]*background: var\(--pl-paper, var\(--c-surface-menu\)\);/);
  // varsOf turns SURFACE_MENU into --c-surface-menu with the palette's own value (the dock's function, run here)
  const def = dock.match(/const varsOf = (\(pal\) => [^\n]+);/);
  assert.ok(def, "varsOf is where the dock defines it");
  const varsOf = new Function(`return ${def[1]}`)();
  for (const pal of [C_LIGHT, C_DARK]) assert.ok(varsOf(pal).includes(`--c-surface-menu: ${pal.SURFACE_MENU};`), pal.SURFACE_MENU);
  // and the review panel paints no surface of its own (the walk's "…and paints no surface of its own")
  assert.match(fs.readFileSync("extension/review-overlay.js", "utf8"), /#\$\{ID\} \{ height: 100%;[^}]*background: transparent;/);
});

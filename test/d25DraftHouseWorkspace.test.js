// D25 (10-04): DRAFT HOUSE AS A WORKSPACE — the run bar, exceptions as the main surface, the fold.
// ⛔ D113 UI (owner 10-31) REPLACED the run bar, the Stopped list and its fold with a tree that grows inline
// and a side column (test/d113ui.test.js). What D25 established and still holds is pinned here, RE-PINNED
// to where it lives now: AUTO locked unless the server says otherwise (the header's Apply for me), the caps
// (the Settings drawer), Pause = Stop everything reaching the server and saying what it does not do, the
// exceptions model's order (buildStoppedItems), and the shared controls.
//
// The premise was corrected first (docs/DRAFT_HOUSE_WORKSPACE.md): D14's Stopped │ Queued split and
// D18's "Draft House" tab had shipped, inside AutoApplyPanel.jsx. What had not was the workspace
// model — no run bar, no SEMI/AUTO, no caps, no user Stop — and AD1's chrome still filled the
// columns. These tests pin the model. The server half (the per-user hold the run loop checks before
// starting a run) is test/d25UserHold.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  autoToggle, capUsage, quietLine, splitAnswers, buildStoppedItems, filterItems,
  STOP_DOES, STOP_DOES_NOT, STOP_ITEMS, AUTO_LOCKED_FALLBACK,
} from "../client/src/lib/draftHouseExceptions.js";
import { PREREQUISITE_LABELS, groupByApplication } from "../client/src/lib/applyObstacles.js";
import { at } from "../test-support/sourceAnchors.js";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";   // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): d148SettingsDrawer's, merged below

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const panel    = read("client/src/panels/AutoApplyPanel.jsx");
const tree     = read("client/src/components/DraftHouseTree.jsx");
const drawer   = read("client/src/components/AutoSettingsDrawer.jsx");
const css      = read("client/src/components/DraftHouse.css");
const ctx      = read("client/src/contexts/AutoApplyContext.jsx");
const dbPanel  = read("client/src/panels/DatabasePanel.jsx");
const controls = read("client/src/components/ui/PanelControls.jsx");
const app      = read("client/src/App.jsx");
const route    = read("routes/apply.js");

// ── 1. THE RUN BAR: AUTO IS LOCKED, AND ONLY THE SERVER CAN SAY OTHERWISE ────────────────────

test("⛔ AUTO is locked unless the server answers locked:false — nothing else unlocks it", () => {
  for (const runBar of [null, undefined, {}, { mode: {} }, { mode: { auto: {} } },
                        { mode: { auto: { locked: true } } }, { mode: { auto: { locked: "false" } } },
                        { mode: { auto: { locked: 0 } } }, { mode: { auto: { locked: null } } }]) {
    const t = autoToggle(runBar);
    assert.equal(t.selectable, false, `unlocked from ${JSON.stringify(runBar)}`);
    assert.equal(typeof t.reason, "string");
  }
  assert.equal(autoToggle(null).reason, "Auto has never run unattended against a real employer.");
  assert.equal(AUTO_LOCKED_FALLBACK, "Auto has never run unattended against a real employer.");
  // The server's own sentence wins when it sends one.
  assert.equal(autoToggle({ mode: { auto: { locked: true, message: "Paused by the operator." } } }).reason,
    "Paused by the operator.");
  assert.deepEqual(autoToggle({ mode: { auto: { locked: false } } }), { selectable: true, reason: null });
});

// D100 (owner 10-30) changed this on purpose: FULL AUTO is the user's to choose, so the segment has a handler — but
// ONLY while the server says selectable; locked, the handler is not attached at all.
test("⛔ Apply for me (FULL AUTO) has a handler only when selectable, is disabled while locked, and SAYS why in text", () => {
  const auto = panel.slice(at(panel, 'data-mode="auto"'), at(panel, "</button>", at(panel, 'data-mode="auto"')));
  assert.match(auto, /onClick=\{mode\.selectable \? \(\) => !fullAuto && setApplyMode\?\.\("auto"\) : undefined\}/);
  assert.match(auto, /disabled=\{!mode\.selectable \|\| holdBusy\}/);
  assert.match(panel, /const mode = autoToggle\(runBar\);/);
  // The reason is a visible paragraph, not a tooltip a phone cannot show.
  // 47i (D197 #3): Home's controls are built once for both faces, so the class is the face's (classic dh-head__why, the
  // ledger's pl-lg-why) — still a visible paragraph with the reason in its words
  assert.match(panel, /<p className=(?:"dh-head__why"|\{cls\("dh-head__why", "pl-lg-why"\)\}) id="dh-auto-why" data-auto-locked-reason="">Apply for me is locked: \{mode\.reason\}<\/p>/);
  // Nothing in the client writes a lock state of its own (an object literal, not prose about one).
  for (const src of [panel, ctx]) assert.doesNotMatch(src, /locked:\s*false\s*[,}]/);
  // The pressed segment is the SERVER's mode.
  assert.match(panel, /const fullAuto = runBar\?\.mode\?\.current === "auto";/);
  assert.match(panel, /data-mode="ask" aria-pressed=\{!fullAuto\}/);
  // The mode reaches the SERVER; the header shows its answer.
  const setMode = ctx.slice(at(ctx, "const setApplyMode = useCallback"), at(ctx, "}, []);", at(ctx, "const setApplyMode")));
  assert.match(setMode, /api\("\/api\/apply\/mode", \{ method: "POST", body: JSON\.stringify\(\{ mode \}\) \}\)/);
  assert.match(setMode, /setRunBar\(r\)/);
});

// D102 P4: ⚙ Auto settings opens the drawer; its terms switch is off unless the user turns it on.
test("⚙ Auto settings: the drawer reads and writes the server's settings, terms opt-in included", () => {
  assert.match(panel, /<AutoSettingsDrawer open=\{settingsOpen\}/);
  assert.match(panel, /data-settings-open="" onClick=\{\(e\) => openSettings\(null, e\.currentTarget\)\}/);
  assert.match(drawer, /api\("\/api\/apply\/auto-settings"\)/);
  // A105 finding 8: every change saves (debounced) — no Save / Cancel; a refused value puts the last saved back.
  assert.match(drawer, /api\("\/api\/apply\/auto-settings", \{ method: "PUT", body: JSON\.stringify\(\{ settings: next \}\) \}\)/);
  assert.match(drawer, /timer\.current = setTimeout\(flush, SAVE_AFTER_MS\);/);
  assert.match(drawer, /if \(lastSaved\.current\) setS\(lastSaved\.current\);/);
  assert.match(drawer, /const close = async \(\) => \{ await flush\(\); onClose\?\.\(\); \};/, "closing never drops the last change");
  assert.doesNotMatch(drawer, />Cancel</);
  // Any run time, not a fixed list.
  assert.match(drawer, /<input type="time" aria-label="A run time to add"/);
  assert.doesNotMatch(drawer, /SPARE_TIMES/);
  // D148 (11-03): the switch is drawn by the drawer's one `sw` helper — the same value, the same attribute.
  assert.match(drawer, /\{sw\(s\.agreeToTerms, \(\) => set\(\{ agreeToTerms: !s\.agreeToTerms \}\), \{ "data-agree-to-terms": "" \}\)\}/);
  assert.match(drawer, /A human check \(a CAPTCHA\)/, "the drawer says a human check is never sent automatically");
});

// D100 (owner 10-30): the proof constant is removed; the mode is the user's (default SEMI) and the kill switch is
// the one lock left, reported beside it.
test("the bar's mode is the user's own, and AUTO is locked only by the operator's kill switch", () => {
  assert.doesNotMatch(route, /const FULL_AUTO_PROVEN/);
  assert.match(route, /message: "Automatic sending is paused by the operator\.", killSwitch/);
  assert.match(route, /mode: \{ current: userApplyMode\(userId\), auto: autoModeState\(\) \}/);
});

// ── 2. THE THREE CAPS ────────────────────────────────────────────────────────────────────────

test("the three caps the server sends, with how much of each is used — in Settings since D113 UI", () => {
  assert.equal(capUsage({ used: 3, limit: 40 }), "3 of 40");
  assert.equal(capUsage({ used: 0, limit: 25 }), "0 of 25");
  assert.equal(capUsage(null), null, "an unloaded cap renders no number nobody measured");
  assert.equal(capUsage({ used: undefined, limit: 40 }), null);
  assert.match(drawer, /const caps = Array\.isArray\(runBar\?\.caps\) \? runBar\.caps : \[\];/);
  assert.match(drawer, /data-caps-used=""/);
  assert.match(drawer, /capUsage\(c\)/);
  // The bar is read, never assembled: one endpoint, loaded with the feeds and re-read when they move.
  assert.match(ctx, /setRunBar\(await api\("\/api\/apply\/run-bar"\)\)/);
  assert.match(ctx, /useEffect\(\(\) => \{ if \(user\) loadRunBar\(\); \}, \[user, applyRuns, loadRunBar\]\);/);
  assert.match(panel, /<AutoSettingsDrawer open=\{settingsOpen\} runBar=\{runBar\}/);
  // The header's sentence reads the submission cap: "3 of 10 sent today".
  assert.match(panel, /const sub = \(runBar\?\.caps \|\| \[\]\)\.find\(c => c\.id === "submission"\);/);
});

// ── 3. ⏸ STOP EVERYTHING REACHES THE SERVER, AND SAYS WHAT IT DOES NOT DO ────────────────────

test("Pause (= Stop everything) posts the hold to the server — it stops nothing locally", () => {
  const stop = ctx.slice(at(ctx, "const setStopEverything = useCallback"), at(ctx, "}, [loadApplyRuns]);", at(ctx, "const setStopEverything")));
  assert.match(stop, /api\("\/api\/apply\/hold", \{ method: "POST", body: JSON\.stringify\(\{ held: !!held \}\) \}\)/);
  assert.match(stop, /setRunBar\(r\)/, "the bar shows the SERVER's answer, not an optimistic guess");
  assert.match(panel, /onClick=\{\(\) => setStopEverything\?\.\(!held\)\}/);
  assert.match(panel, /\{held \? "Resume" : "Pause"\}/);
  assert.match(panel, /const held = !!runBar\?\.hold\?\.held;/);
  assert.match(panel, /"Paused\. Nothing new is picked or sent until you resume\."/);
});

test("the bar says plainly what Stop does and does NOT do — sent applications are not recalled", () => {
  assert.match(STOP_DOES, /holds every draft that has not started/);
  assert.match(STOP_DOES, /a run in progress starts nothing further/);
  assert.match(STOP_DOES_NOT, /does not recall applications already sent/);
  assert.match(STOP_DOES_NOT, /already being filled finishes — stop it under Running/);
  // A233 (46v): the checklist Settings shows keeps every clause — recall is the one ✕.
  assert.deepEqual(STOP_ITEMS.map(i => i.ok), [true, true, true, false]);
  assert.match(STOP_ITEMS.map(i => i.text).join(" "), /has not started.*starts nothing further.*being filled finishes — stop it under Running.*Recall applications already sent/);
  // Said on the button (its title) and, in text a phone can read, in Settings.
  assert.match(panel, /title=\{\x60\$\{STOP_DOES\} \$\{STOP_DOES_NOT\}\x60\}/);
  // D148 (11-03): in the Pausing fold, beside "Pause everything now" — a paragraph now.
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): the Stop checklist line is asserted below in d148PauseNowExplains, inside the "pausing" fold (stricter)
  // And the copy matches what the server does: the hold is checked before a run, and between jobs.
  assert.match(route, /if \(userHeld\(db, run\.user_id\)\) \{\s*\n\s*parkRunAtHead\(run,/);
  assert.match(route, /if \(userHeld\(db, run\.user_id\)\) \{ heldMidRun = true; break; \}/);
});

// ── 4. EXCEPTIONS ARE THE MAIN SURFACE; EXACT MATCHES ARE ONE LINE IN THE FOLD ───────────────

test("the fold: exact matches are NOT listed — they are one line, '12 of 14 needed no attention'", () => {
  assert.equal(quietLine(14, 2), "12 of 14 needed no attention");
  assert.equal(quietLine(3, 3), null, "nothing quiet, no line");
  assert.equal(quietLine(0, 0), null);
  const answers = [
    ...Array.from({ length: 12 }, (_, i) => ({ label: `Exact ${i}`, value: "v", provenance: "field_map" })),
    { label: "Years with Go", value: "4", provenance: "label_fuzzy" },
    { label: "Notice period", value: "2 weeks", provenance: "label_fuzzy" },
    { label: "Skipped", value: "", skipped: true },
    { label: "Refused", value: "x", policy_rejected: true },
  ];
  const s = splitAnswers(answers);
  assert.deepEqual(s.attention.map(a => a.label), ["Years with Go", "Notice period"]);
  assert.equal(s.total, 14, "skipped and refused fields were never filled, so they are not counted");
  assert.equal(s.line, "12 of 14 needed no attention");
  // The pending item says the same thing BEFORE its answers are fetched, from the server's counts.
  const [approval] = buildStoppedItems({ pending: [{ runJobId: 7, company: "Acme", answerCount: 14, guessCount: 2 }] });
  assert.equal(approval.fold.quiet, "12 of 14 needed no attention");
  assert.equal(approval.fold.needs.length, 1, "one line about the guesses, not fourteen fields");
  // ⛔ D113 UI U4 changed the PANEL on purpose: its Answers leaf lists every field and value, the guesses
  // flagged "read this" (lib/draftHouseTree.js answerRows; test/d113ui.test.js). The counts above stay the
  // server's and the lib's.
});

test("Stopped lists what needs the user, in the order they should meet it", () => {
  const held = groupByApplication([{ id: 1, jobId: "h1", company: "Initech", title: "SRE", status: "held_review", reasonCode: "ats_below_threshold", finishedAt: 2 }]);
  const broke = groupByApplication([{ id: 2, jobId: "b1", company: "Globex", title: "SWE", status: "failed", reasonCode: "internal_error", finishedAt: 1 }]);
  const items = buildStoppedItems({
    prereqMissing: ["profile_email"], prereqLabels: PREREQUISITE_LABELS,
    gatePortals: [{ origin: "o", host: "acme.example", count: 2, gateReasons: ["login_required"] }],
    questions: [{ question: "Are you authorised to work here?", eligibility: true }],
    pending: [{ runJobId: 5, company: "Acme", title: "PM", answerCount: 10, guessCount: 0 }],
    heldApplications: held, brokeApplications: broke,
  });
  assert.deepEqual(items.map(i => i.kind), ["prerequisite", "portal", "questions", "approval", "held", "broke"]);
  assert.ok(items.every(i => i.key && i.title && ["danger", "warning", "info"].includes(i.tone)));
  // Search narrows by what a person would type.
  assert.deepEqual(filterItems(items, "globex").map(i => i.kind), ["broke"]);
  assert.equal(filterItems(items, "  ").length, items.length);
});

test("no numbered flow boxes, nothing 'Running fine', and Sent is a ring on a bubble — never a list", () => {
  // D113 UI U2 (owner 10-31) puts Sent and Replied on the tree as rings (The Table keeps the record, D15):
  // the submitted feed is still never RENDERED as a list here.
  assert.doesNotMatch(panel, /variant="submitted"/);
  assert.doesNotMatch(panel, /applySubmitted\.map/);
  assert.doesNotMatch(panel, /OUTCOME\.COMPLETED|data-draft-sent|aria-label="Sent"/);
  assert.doesNotMatch(panel, /Running fine/i);
  for (const src of [panel, tree]) {
    assert.doesNotMatch(src, /Step \d|[①②③④⑤]|data-flow-step/);
  }
});

test("D1's depth on every control, tokens only, and reduced motion honoured", () => {
  for (const t of ["--c-depth-rest", "--c-depth-hover", "--c-depth-press", "--c-depth-accent"]) {
    assert.ok(css.includes("var(" + t + ")"), t + " is not used");
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

// ── 5. REUSE, NOT FORK: AutoApplyContext and PanelControls ───────────────────────────────────

test("PanelControls is reused, not forked — and the Database panel keeps all three controls", () => {
  for (const name of ["PanelSubTabs", "PanelSearch", "DateFilterButton"]) {
    assert.match(controls, new RegExp(`export function ${name}\\(`));
    assert.match(dbPanel, new RegExp(`<${name}`), `the Database panel lost ${name}`);
  }
  assert.match(dbPanel, /import \{ PanelSubTabs, PanelSearch, DateFilterButton \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  assert.match(panel, /import \{ PanelSearch \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  assert.match(panel, /search=\{<PanelSearch theme=\{theme\} value=\{q\} onChange=\{setQ\}/, "the tree's search is the shared one");
  for (const src of [panel, tree]) {
    assert.doesNotMatch(src, /function (PanelSubTabs|PanelSearch|DateFilterButton)\b/, "a control was forked");
  }
  // And the state is the context's: the bar and the hold live in AutoApplyContext, not a new store.
  assert.match(ctx, /runBar, loadRunBar, setStopEverything, setApplyMode, holdBusy, holdMsg,/);
  assert.match(panel, /runBar = null, setStopEverything, setApplyMode, holdBusy = false, holdMsg = "",/);
  assert.doesNotMatch(panel, /createContext|useReducer/);
});

test("the panel's header describes Draft House as it is — the AD1-era prose is gone", () => {
  const head = panel.slice(0, at(panel, "export function AutoApplyPanel"));
  assert.doesNotMatch(head, /the strip that used to sit between the search bar and the postings/);
  // ⭐ D146 (changed on purpose, 11-03): the header names the one tracker.
  assert.match(head, /AutoApplyPanel — DRAFT HOUSE, THE ONE APPLICATION TRACKER \(D146, owner 11-03; D113 UI before it\)/);
  assert.match(head, /D25's run bar, the separate Stopped list/);
  assert.match(head, /NO second status model/);
});

// ── 6. RECRUITER PANEL: REACHABLE, SO KEPT ───────────────────────────────────────────────────

test("RecruiterPanel is still reachable — by route and by two in-app links — so its render path stays", () => {
  // D25 was asked to remove the render path only if it is provably dead. It is not: /app/recruiter is
  // a route-only tab (D5), and two components navigate to it. Whether those links go is O53.
  assert.match(app, /const ROUTE_ONLY_TABS = \["recruiter", "job-profiles"\];/);
  assert.match(app, /\{activeTab === "recruiter"\s+&& <RecruiterPanel\/>\}/);
  assert.match(read("client/src/components/JobCard.jsx"), /navigate\(`\/app\/recruiter\?company=/);
  assert.match(read("client/src/components/CompanyViewModal.jsx"), /navigate\(`\/app\/recruiter\?company=/);
  // …and it is still not a tab in the bar.
  const tabs = app.slice(at(app, "const appTabs"), at(app, "const ROUTE_ONLY_TABS"));
  assert.doesNotMatch(tabs, /id: "recruiter"/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// D148 · THE SETTINGS DRAWER (was test/d148SettingsDrawer.test.js)
// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): test/d148SettingsDrawer.test.js merged into this file (docs/A232_TEST_AUDIT.md §4 — 5 assertions shared word for word).
// Its tests follow in ONE block, so its own top-level names (it declares some of the same ones as above) stay its
// own. An assertion it repeated word for word is kept once — where it says the most — and named where it went.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
{
// ⭐ D148 (owner 11-03, docs/sketches/settings-declutter.html) — AUTO-APPLY SETTINGS, RESTYLED AND DECLUTTERED.
// The same drawer (the tracker's Settings), the same settings and saves: the mode first as two choices; folds, each ONE
// line with its current value, one open at a time, in D145's type; the internal limits behind Details.
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const drawer = read("client/src/components/AutoSettingsDrawer.jsx");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const css = read("client/src/components/DraftHouse.css");
const fold = (id) => {
  const from = at(drawer, `<Fold id="${id}"`);
  const next = drawer.indexOf("<Fold id=", from + 5);
  return drawer.slice(from, next > from ? next : undefined);
};

const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let mod;
async function load() {
  if (mod) return mod;
  const esbuild = requireClient("esbuild");
  const abs = JSON.stringify(path.join(CLIENT, "src", "components", "AutoSettingsDrawer.jsx").split(path.sep).join("/"));
  const r = await esbuild.build({
    stdin: { contents: `export { foldValues, zoneWords } from ${abs};`, resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d148-"));
  const f = path.join(dir, "m.mjs");
  fs.writeFileSync(f, r.outputFiles[0].text);
  try { mod = await import(pathToFileURL(f).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return mod;
}

const S = { dailyCap: 10, runTimes: ["09:00", "18:00"], timeZone: "America/New_York", pauseCompanyAfterReply: true, filters: {},
  profileId: null, agreeToTerms: false, staleReposts: 3, staleOpenDays: 90, showFormBeforeSending: true, onlySponsorRecord: true,
  perCompanyLimit30d: null };

test("d148ModeTwoChoices · the mode first, as two choices — the header switch's own handlers and lock", () => {
  const m = drawer.slice(at(drawer, '<div className="dh-mode2" role="group" aria-label="Mode"'), at(drawer, '<Fold id="when"'));
  assert.match(m, /<b>Ask me first<\/b><span>nothing is sent until you approve<\/span>/);
  assert.match(m, /<b>Apply for me<\/b><span>\{mode\.selectable \? "good matches are sent on their own" : `locked: \$\{mode\.reason\}`\}<\/span>/);
  assert.match(m, /aria-pressed=\{!mode\.fullAuto\}/);
  assert.match(m, /disabled=\{modeBusy \|\| !mode\.selectable \|\| !onAuto\}/, "locked stays locked");
  assert.ok(at(drawer, 'data-settings-mode=""') < at(drawer, '<Fold id="when"'), "the mode comes first");
  assert.match(panel, /mode=\{\{ fullAuto, selectable: mode\.selectable, reason: mode\.reason \}\} onAsk=\{runBar \? chooseAsk : null\}/);
  assert.match(panel, /onAuto=\{mode\.selectable \? \(\) => setApplyMode\?\.\("auto"\) : null\}/);
  // D149 (11-03) changed this on purpose: the sketch draws the current choice with an OUTLINE (1.5px, the accent), not a
  // border — the mode buttons have no border at all (test/fidelitySettings.test.js measures it).
  assert.match(css, /\.dh-mode2 button\[aria-pressed="true"\] \{ outline: 1\.5px solid var\(--c-accent\); \}/, "the current one outlined in the accent");
  assert.match(drawer, /<h2 id="dh-settings-title">Auto-apply<\/h2>/);
});

test("d148GroupsFoldToOneLineWithValue · each fold is ONE line with its current value", async () => {
  const { foldValues, zoneWords } = await load();
  assert.equal(zoneWords("America/New_York"), "New York time");
  const v = foldValues(S, { notify: { events: [{ key: "picks", email: true, push: true }] }, accounts: 2 });
  assert.equal(v.when, "9 AM and 6 PM, New York time");
  assert.equal(v.howmany, "up to 10 a day");
  assert.equal(v.jobs, "sponsors only · skips stale posts");
  assert.equal(v.before, "show me the form");
  assert.equal(v.tell, "by email and notification");
  assert.equal(v.pausing, "pause after an interview");
  assert.equal(v.accounts, "2 connected");
  assert.equal(foldValues({ ...S, staleReposts: null, staleOpenDays: null, onlySponsorRecord: false }).jobs, "every match");
  assert.equal(foldValues(S, { held: true }).pausing, "paused now · pause after an interview");
  assert.equal(foldValues(S, { notify: { events: [{ key: "picks", email: false, push: false }] } }).tell, "off");
  // The line: the title, then the value; the open body hides it and shows the eyebrow + headline + Done.
  assert.match(drawer, /<b>\{title\}<\/b><span data-fold-value="">\{value\}<\/span>/);
  // 45n D182 (bb297b05): the open body's eyebrow (the title again) was removed — the headline leads it (pin moved on purpose).
  assert.doesNotMatch(drawer, /dh-fold2__eyebrow/);
  assert.match(drawer, /<div className="dh-fold2__body" id=\{`dh-fb-\$\{id\}`\}>\s*<h3 className="dh-fold2__h">\{headline\}<\/h3>/);
  assert.match(css, /\.dh-fold2\[data-open="true"\] \.dh-fold2__top \{ display: none; \}/);
});

test("d148OneGroupOpenAtATime · pressing a fold opens only it; Done folds it back", () => {
  assert.match(drawer, /const fp = \(id\) => \(\{ open: fold === id, onOpen: \(\) => setFold\(f => \(f === id \? null : id\)\), onDone: \(\) => setFold\(null\) \}\);/);
  assert.match(drawer, /\{open && \(\s*<div className="dh-fold2__body"/);
  assert.match(drawer, /setMsg\(""\); setSaved\(""\); setFold\(group \|\| null\);/, "a deep link (openSettings('jobs')) opens its fold");
  assert.match(panel, /openSettings\("jobs", e\?\.currentTarget\)/);
});

test("d148EverySettingPresent · every setting has its fold (the row's map)", () => {
  const map = {
    when: ["s.runTimes.map", 'aria-label="A run time to add"', "Add a time", "s.timeZone"],
    howmany: ["dailyCap: Math.max(CAP_MIN, s.dailyCap - 1)", "dailyCap: Math.min(CAP_MAX, s.dailyCap + 1)", "Anything over waits for tomorrow"],
    jobs: ["onlySponsorRecord: !s.onlySponsorRecord", "staleReposts: 3, staleOpenDays: 90", "set({ filters: board })", "perCompanyLimit30d", "profileId", "Never sent automatically"],
    before: ["showFormBeforeSending: !s.showFormBeforeSending", "agreeToTerms: !s.agreeToTerms"],
    tell: ['setPick("email"', 'setPick("push"'],
    pausing: ["pauseCompanyAfterReply: !s.pauseCompanyAfterReply", "Pause everything now"],
    accounts: ["<Accounts onState={setAcct} />"],
    view: ['data-list-view="table"', 'data-list-view="sheet"'],
  };
  for (const [id, needles] of Object.entries(map)) for (const n of needles) assert.ok(fold(id).includes(n), `${id}: ${n}`);
  // "Tell me" writes the SAME preference Account → Notifications writes.
  assert.match(drawer, /api\("\/api\/notify\/prefs", \{ method: "PUT", body: JSON\.stringify\(\{ event: "picks", channel, on \}\) \}\)/);
  // Accounts: a fold only when there is anything in it.
  assert.match(drawer, /\{acct\?\.anything && \(\s*<Fold id="accounts"/);
  assert.match(drawer, /anything: live\.length \+ accounts\.length > 0 \|\| !!d\.worker \|\| !!g\?\.available/);
});

test("d148LimitsBehindDetails · the internal limits are one quiet line; the full limits behind Details", () => {
  const d = drawer.slice(at(drawer, '<details className="dh-limits" data-caps-used="">'), at(drawer, "</details>"));
  // D149 (11-03) changed this on purpose: the sketch's line is "Today: 4 sent of 10." with Details under it (its p.detail).
  assert.match(d, /<summary>\{sent \? `Today: \$\{sent\.used\} sent of \$\{Math\.min\(sent\.limit, s\.dailyCap\)\}\.` : "Today's limits\."\} <span className="dh-limits__more">Details<\/span><\/summary>/);
  assert.match(d, /caps\.map\(c => `\$\{c\.label\} \$\{capUsage\(c\) \?\? "—"\}`\)/);
  assert.ok(at(drawer, '<Fold id="view"') < at(drawer, '<details className="dh-limits"'), "after the folds, not on the first lines");
  assert.match(drawer, /const sent = caps\.find\(c => c\.id === "submission"\);/);
});

test("d148PauseNowExplains · Pause everything now says what it does and does not do", () => {
  const p = fold("pausing");
  assert.match(p, /onClick=\{\(\) => onPauseNow\(!held\)\}>\{held \? "Resume" : "Pause everything now"\}<\/button>/);
  assert.match(p, /data-stop-says="" title="Stop everything" items=\{STOP_ITEMS\} \/>/);   // A233 (46v): a ✓ / ✕ checklist, every clause kept (STOP_ITEMS) — changed on purpose
  assert.match(panel, /held=\{held\} onPauseNow=\{setStopEverything\}/, "the timeline's own Pause handler");
});

test("d148SettingsBehaviourUnchanged · the same load, the same whole-object save, the same refusal handling", () => {
  assert.match(drawer, /api\("\/api\/apply\/auto-settings"\)\.then\(r => \{ if \(live\) \{ lastSaved\.current = r\.settings; setS\(r\.settings\); \} \}\)/);
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): the whole-object PUT, the refusal put-back, the debounce and close-flushes are asserted above in "⚙ Auto settings: the drawer reads and writes …" (the same file, the same words)
  assert.match(drawer, /const CAP_MAX = 150, MAX_TIMES = 4, CAP_MIN = 1;/, "the same bounds the server validates");
});
}

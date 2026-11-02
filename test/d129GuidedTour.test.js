import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOUR_STEP_IDS, DECK_SCROLL_MS } from "../shared/trialTour.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D129 part 2 · the GuidedTour on the REAL pages. The component is JSX, so these read its source and the pages it
// lights; the behaviour is walked in a real Chrome by scripts/d129TourWalk.mjs. Changing a step here is a product change.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const tour = read("client/src/components/GuidedTour.jsx");
const script = tour.slice(at(tour, "export const TOUR_SCRIPT"), at(tour, "]);", at(tour, "export const TOUR_SCRIPT")));
const steps = [...script.matchAll(/\{ id: "([a-z_]+)", route: (null|"[^"]+")(?:, target: "([^"]+)")?/g)].map(m => ({ id: m[1], route: m[2], target: m[3] }));

function clientSource() {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(f) && !p.endsWith("GuidedTour.jsx")) out.push(read(p)); } };
  walk("client/src");
  return out.join("\n");
}

test("d129TourRunsOnRealPages: the path after the résumé, in the shared order, 14 steps (the owner's bug report split the card and the modes); every light is an element a real page renders", () => {
  assert.deepEqual(steps.map(s => s.id), TOUR_STEP_IDS.filter(id => id !== "pick_resume" && id !== "survey"), "the survey follows the tour, it is not a step");
  // Owner 11-01: the survey is no tour step — The Table moves on to it by itself (the demonstration's end).
  assert.equal(steps.length, 13, '"Step N of 13"');
  const src = clientSource();
  for (const s of steps.filter(s => s.target)) {
    const t = s.target;
    const needle = t.startsWith("#") ? `"${t.slice(1)}"` : t.startsWith(".") ? t.slice(1) : t.slice(1, -1);
    assert.ok(src.includes(needle), `${s.id}: nothing in client/src renders ${t}`);
  }
  // The tabs are ids in App.jsx; /app/atlas/learn is the Atlas's reserved slug "learn" (AtlasPage.jsx).
  const routes = read("client/src/App.jsx") + read("client/src/pages/atlas/AtlasPage.jsx");
  for (const s of steps.filter(s => s.route && s.route !== "null")) {
    const last = JSON.parse(s.route).split("/").pop();
    assert.ok(routes.includes(`"${last}"`), `${s.id}: ${s.route} is a route of the app`);
  }
  assert.doesNotMatch(tour, /<imgb|<pictureb/i, "coach-marks on the real pages, never pictures of them");
});

test("d129DeckAutoScrollHalfSecondToTop: the deck deals from the back to the best match, a card every 0.5 s (Faster: quicker)", () => {
  assert.equal(DECK_SCROLL_MS, 500);
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /window\.addEventListener\("draft:deck-sweep", onSweep\)/);
  assert.match(deck, /let i = n - 1;\n\s+dispatch\(\{ type: "goto", index: i \}\);/, "starts at the back");
  assert.match(deck, /dispatch\(\{ type: "goto", index: Math\.max\(i, 0\) \}\);\n\s+if \(i <= 0\) \{ clearInterval\(timer\); done\(\); \}/, "ends on the top");
  assert.match(deck, /\}, Number\(e\.detail\?\.every\) \|\| DECK_SCROLL_MS\);/);
  assert.match(tour, /every: speed === "faster" \? DECK_SCROLL_MS \/ 2 : DECK_SCROLL_MS/);
});

test("d129ReducedMotionStepsOnNext: reduced motion jumps the deck to the top and never smooth-scrolls; the cards step on Next", () => {
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /if \(n <= 1 \|\| reduced\) \{ dispatch\(\{ type: "goto", index: 0 \}\); done\(\); return; \}/);
  assert.match(tour, /behavior: reducedMotion\(\) \? "auto" : "smooth"/);
  assert.match(tour, /transition: reducedMotion\(\) \? "none"/);
});

test("d129PickTwoThenLiveRun + d129EndsOnTable: Next waits for 2 Drafts, then the live run, The Table, and the survey", () => {
  const ids = steps.map(s => s.id);
  assert.deepEqual(ids.slice(-3), ["pick_two", "live_run", "table"]);
  assert.match(script, /id: "pick_two"[\s\S]*?require: \{ kind: "drafts", count: 2/);
  assert.match(tour, /const n = Math\.max\(st\.draftsUsed \?\? 0, st\.sent \?\? 0\);[\s\S]{0,80}if \(n >= r\.count\)/);
  assert.match(tour, /disabled=\{!met\}/, "Next is locked until the action is done");
  // Owner 11-01 (changed on purpose): The Table is the last step and moves on to the survey by itself.
  assert.match(script, /id: "table", route: "\/app\/database", target: "\[data-table-split\]", noNext: true, autoAfter: 5000, finish: true,/);
  assert.match(tour, /if \(step\.finish\) \{ send\("tour", \{ step: "survey", phase: "reached", ms: 0, device, speed \}\); setDone\(true\); await onFinish\?\.\(\); return; \}/, "the last step locks the site into the survey");
  const dock = read("client/src/components/TrialDock.jsx");
  assert.match(dock, /<GuidedTour state=\{state\} onFinish=\{finish\} onActive=\{setTouring\} onSkipToSurvey=/, "44b: leaving the tour goes to the survey");
  assert.match(dock, /\{!touring && <Dock state=\{state\} onFinish=\{\(\) => finish\(\)\.then\(\(\) => setSurveyOpen\(true\)\)\}\/>\}/, "the dock steps aside while the tour is on screen");
});

test("d129: each step's time and the faster / skip choices reach the analytics; a missing element is reported, not hidden", () => {
  assert.match(tour, /tour\(step\.id, "reached", 0\)/);
  assert.match(tour, /tour\(step\.id, "completed", Date\.now\(\) - startedAt\.current\)/);
  assert.match(tour, /tour\(step\.id, "abandoned", Date\.now\(\) - startedAt\.current\)/);
  assert.match(tour, /send\("error", \{ code: "target_missing", step: step\.id \}\)/);
  assert.match(tour, /name: nextSpeed === "faster" \? "faster_on" : "faster_off"/);
  assert.match(tour, /send\("tour", \{ step: "pick_resume", phase: "completed"/);
});

test("d129: the Learn step is honest for a field with no course; the phone gets a bottom sheet; no pills", () => {
  assert.match(script, /textOtherField: "Learn holds the computing course for now; a course for your field is coming\./);
  assert.match(tour, /const other = step\.textOtherField && field && field !== "computing";/);
  assert.match(read("client/src/lib/tourGeometry.js"), /\{ side: "bottom-sheet", top: bottomTop, left: MARGIN, width \}/, "the phone: a sheet");
  assert.doesNotMatch(tour, /borderRadius: (999|"50%")/);
});

test("d129ExampleStateLabelled + d129AutoSettingsResetAfterStep: Draft House's example, labelled, only on an empty tree; Auto settings put back", () => {
  const house = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(house, /const showExample = tourExample && nothingYetForExample\(nodes\);/, "a real tree is never covered");
  assert.match(house, /<strong>Example\.<\/strong> This is what Draft House looks like/);
  assert.match(house, /if \(String\(action\?\.key \?\? ""\)\.startsWith\("example-"\)\) return;/, "nothing in the example opens or acts");
  assert.match(house, /useState\(\(\) => typeof window !== "undefined" && !!window\.draftTourExample\)/, "read on mount: the page mounts after the step's event");
  // set in the step, then reset: snapshot on open; on close, PUT the snapshot back only if something changed
  assert.match(house, /tourSnapshot\.current = \(await api\("\/api\/apply\/auto-settings"\)\)\.settings \?\? null;/);
  assert.match(house, /if \(strip\(now\) !== strip\(before\)\) await api\("\/api\/apply\/auto-settings", \{ method: "PUT", body: JSON\.stringify\(\{ settings: before \}\) \}\);/);
  assert.match(tour, /if \(step\.settings\) t\.push\(setTimeout\(\(\) => fire\("draft:tour-settings", \{ open: true \}\), 400\)\);/);
  assert.match(tour, /if \(step\.settings\) fire\("draft:tour-settings", \{ open: false \}\);/);
});

test("d129: tour progress is kept per trial account, so a second test account in one browser gets its own tour", () => {
  assert.match(tour, /const keyFor = \(state\) => `\$\{TOUR_KEY\}\.\$\{state\?\.startedAt \?\? "x"\}`;/);
  assert.match(read("services/trial.js"), /trial: true, startedAt: u\.trial_at \|\| null,/);
});

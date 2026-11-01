import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOUR_STEP_IDS, DECK_SCROLL_MS } from "../shared/trialTour.js";

// ⭐ D129 part 2 · the GuidedTour on the REAL pages. The component is JSX, so these read its source and the pages it
// lights; the behaviour is walked in a real Chrome by scripts/d129TourWalk.mjs. Changing a step here is a product change.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const tour = read("client/src/components/GuidedTour.jsx");
const script = tour.slice(tour.indexOf("export const TOUR_SCRIPT"), tour.indexOf("]);", tour.indexOf("export const TOUR_SCRIPT")));
const steps = [...script.matchAll(/\{ id: "([a-z_]+)", route: (null|"[^"]+")(?:, target: "([^"]+)")?/g)].map(m => ({ id: m[1], route: m[2], target: m[3] }));

function clientSource() {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.jsx?$/.test(f) && !p.endsWith("GuidedTour.jsx")) out.push(read(p)); } };
  walk("client/src");
  return out.join("\n");
}

test("d129TourRunsOnRealPages: the path after the résumé, in the shared order, 11 steps; every light is an element a real page renders", () => {
  assert.deepEqual(steps.map(s => s.id), TOUR_STEP_IDS.filter(id => id !== "pick_resume"));
  assert.equal(steps.length, 11, '"Step N of 11"');
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
  assert.deepEqual(ids.slice(-4), ["pick_two", "live_run", "table", "survey"]);
  assert.match(script, /id: "pick_two"[\s\S]*?require: \{ kind: "drafts", count: 2/);
  assert.match(tour, /\(st\.draftsUsed \?\? 0\) >= r\.count \|\| \(st\.sent \?\? 0\) >= r\.count/);
  assert.match(tour, /disabled=\{!met\}/, "Next is locked until the action is done");
  assert.match(script, /id: "survey", route: null, finish: true/);
  assert.match(tour, /if \(step\.finish\) \{ setDone\(true\); await onFinish\?\.\(\); return; \}/, "the last Next locks the site into the survey");
  const dock = read("client/src/components/TrialDock.jsx");
  assert.match(dock, /<GuidedTour state=\{state\} onFinish=\{finish\} onActive=\{setTouring\}\/>/);
  assert.match(dock, /\{!touring && <Dock state=\{state\} onFinish=\{finish\}\/>\}/, "the dock steps aside while the tour is on screen");
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
  assert.match(tour, /\? \{ left: 8, right: 8, bottom: 8 \}/);
  assert.doesNotMatch(tour, /borderRadius: (999|"50%")/);
});

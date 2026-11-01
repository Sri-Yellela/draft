import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { placePopover, cutoutPanels, overlaps, MIN_W } from "../client/src/lib/tourGeometry.js";

// ⚠⚠ THE OWNER'S BUG REPORT, 11-01 ("nothing there, no score … obscured and not at the right place"): the tour's
// spotlight was a filled box, the popover covered its target and the navigation, the Settings drawer covered the
// modes, and "your turn" lit only three buttons. The geometry is tested here in node; every step at three widths and
// two themes is walked by scripts/d129TourShots.mjs (screenshots in docs/tour-shots/).

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const tour = read("client/src/components/GuidedTour.jsx");
const VIEWS = [{ vw: 1280, vh: 800 }, { vw: 800, vh: 900 }, { vw: 390, vh: 844 }];
const NAV = 72;
const navRect = (vw) => ({ top: 0, left: 0, width: vw, height: NAV });

test("tourCutoutNotFilled: the dim is four panels AROUND the target; the outline over it is transparent", () => {
  const rect = { top: 300, left: 200, width: 400, height: 120 };
  const panels = cutoutPanels(rect, { vw: 1280, vh: 800, pad: 6 });
  assert.equal(panels.length, 4);
  for (const p of panels) assert.equal(overlaps(p, rect), false, "no panel lies over the target");
  const area = panels.reduce((a, p) => a + p.width * p.height, 0);
  assert.equal(area, 1280 * 800 - (412 * 132), "together they cover everything but the cut-out");
  assert.match(tour, /data-tour-spotlight="" data-tour-cutout=""[\s\S]{0,260}background: "transparent"/);
  assert.doesNotMatch(tour, /boxShadow: "0 0 0 9999px/, "the old filled-box shadow is gone");
});

test("tourPopoverNotOverTargetOrNav: below, above, beside, or the least-covering corner — never over the navigation", () => {
  const targets = [
    { top: 120, left: 300, width: 500, height: 80 },    // near the top
    { top: 600, left: 300, width: 500, height: 120 },   // near the bottom
    { top: 200, left: 280, width: 720, height: 420 },   // a large card
    { top: 90, left: 40, width: 1200, height: 690 },    // the whole deck
  ];
  for (const { vw, vh } of VIEWS) {
    for (const t of targets) {
      const r = { ...t, left: Math.min(t.left, vw - 50), width: Math.min(t.width, vw - Math.min(t.left, vw - 50) - 10) };
      const h = 200;
      const p = placePopover({ rect: r, h, vw, vh, navBottom: NAV, phone: vw < 600 });
      const pop = { top: p.top, left: p.left, width: p.width, height: h };
      assert.equal(overlaps(pop, navRect(vw)), false, `${vw}: over the nav (${JSON.stringify(p)})`);
      assert.ok(p.left >= 0 && p.left + p.width <= vw, `${vw}: off screen`);
      if (["below", "above", "right", "left"].includes(p.side)) assert.equal(overlaps(pop, r), false, `${vw} ${p.side}: over its target`);
      if (p.side === "right" || p.side === "left") assert.ok(p.width >= MIN_W);
    }
  }
});

test("tourTargetNotCovered: measured only after it stops moving (three equal reads), after anything the step opens has opened", () => {
  assert.match(tour, /still = same\(now, last\) \? still \+ 1 : 0;\s+\/\/ stable = three equal reads in a row/);
  assert.match(tour, /const startAt = Date\.now\(\) \+ \(step\.expand \|\| step\.settings \? 1100 : 0\);/);
  assert.match(tour, /opacity: waiting \? 0 : 1/, "no popover is shown against a target that has not settled");
  const shots = read("scripts/d129TourShots.mjs");
  assert.match(shots, /const SIZES = \[\[1280, 800\], \[800, 900\], \[390, 844\]\];/);
  assert.match(shots, /centreOk = !!hit && \(hit === target \|\| target\.contains\(hit\)\);/, "elementFromPoint at the target's centre");
});

test("tourMatchShowsNumber: the match step lights the match row, and a trial account's card shows its score", () => {
  assert.match(tour, /id: "deck_match", route: "\/app\/today", target: "\[data-deck-signal-row\]"/);
  const deck = read("client/src/panels/DeckView.jsx");
  // trialCardShowsScoreAndWhy (owner 11-01): the score in a ring, "N of M skills", top 4 matched (green) + top 2 missing (grey).
  assert.match(deck, /\{Number\.isFinite\(card\.score\)\n\s+\? <TrialMatch score=\{card\.score\} why=\{why\}/);
  assert.match(deck, /<span data-deck-score=\{pct\} aria-label=\{`\$\{pct\}% match`\}/);
  assert.match(deck, /\(why\.matched \|\| \[\]\)\.slice\(0, 4\)\.map\(t => <span key=\{`m-\$\{t\}`\} data-chip="matched" style=\{\{ \.\.\.markStyle\(C\.SUCCESS\)/);
  assert.match(deck, /\(why\.missing \|\| \[\]\)\.slice\(0, 2\)\.map\(t => <span key=\{`x-\$\{t\}`\} data-chip="missing"/);
  assert.match(deck, /trialDeck \? `Best match first · Drafted \$\{tally\.drafted\} of 2` : `Drafted \$\{tally\.drafted\}`/);
  assert.doesNotMatch(read("client/src/pages/TryPage.jsx"), /data-trial-choice="own"/, "trialNoOwnResume");
  assert.match(read("server.js"), /if \(isTrialAccount\(db, req\.user\.id\)\) deck\.cards = deck\.cards\.map\(c => \(\{ \.\.\.c, score: scoreFor\(c\.job\.id\) \}\)\);/);
});

test("tourSettingsOwnStep: the modes alone, then Settings as its own step lighting the drawer", () => {
  assert.match(tour, /id: "modes", route: "\/app\/auto-apply", target: "\.dh-mode", example: true,\n\s+text: "Ask me first sends nothing until you approve it\. Apply for me sends good matches on its own\."/);
  assert.match(tour, /id: "auto_settings", route: "\/app\/auto-apply", target: "\[data-auto-settings\]", example: true, settings: true,/);
  assert.doesNotMatch(tour.slice(tour.indexOf('id: "modes"'), tour.indexOf('id: "auto_settings"')), /settings: true/, "no drawer over the modes");
});

test("tourYourTurnWholeDeckLit + tourDraftedCounter: the whole deck lit, and a live Drafted N of 2", () => {
  assert.match(tour, /id: "pick_two", route: "\/app\/today", target: "\[data-deck-clip\]"/);
  assert.match(tour, /Look through your 10 picks — scroll or use the arrows — and press Draft on the 2 you'd send\./);
  assert.match(tour, /data-tour-drafted=\{drafted\}[^>]*>Drafted \{Math\.min\(drafted, 2\)\} of 2<\/p>/);
  assert.match(tour, /const n = Math\.max\(st\.draftsUsed \?\? 0, st\.sent \?\? 0\);\n\s+setDrafted\(n\);/);
});

test("the card is three steps: the match, the facts (the card opened), Pass · Save · Draft", () => {
  const ids = [...tour.matchAll(/\{ id: "([a-z_]+)", route:/g)].map(m => m[1]);
  assert.deepEqual(ids.slice(0, 4), ["deck", "deck_match", "deck_facts", "deck_actions"]);
  assert.match(tour, /id: "deck_facts", route: "\/app\/today", target: "\[data-fan-offset=\\"0\\"\] \[data-posting-masthead\]", expand: true,/);
  assert.match(read("client/src/panels/DeckView.jsx"), /const onExpand = \(e\) => setExpanded\(!!e\.detail\?\.open\);/);
});

test("tourWaitingPopoverNeverCatchesPresses + a tall target measured on screen only (11-01 proof: the 2nd consent box; The Table on a phone)", () => {
  const tour = fs.readFileSync("client/src/components/GuidedTour.jsx", "utf8");
  assert.ok(tour.includes('opacity: waiting ? 0 : 1, pointerEvents: waiting ? "none" : "auto",'));
  assert.ok(tour.includes("const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);"));
});

test("step 1 follows the dealt deck (no flicker) and deals once; the survey is offered in a pop-up, opened by its button (owner 11-01)", () => {
  const tour = fs.readFileSync("client/src/components/GuidedTour.jsx", "utf8");
  assert.ok(tour.includes("if (step.sweep) { setRect(prev => (same(prev, now) ? prev : now)); return; }"), "step 1 is followed, never hidden while it moves");
  assert.ok(tour.includes("if (done || !rect || swept.current === i) return undefined;"), "the deck is dealt once per visit");
  const dock = fs.readFileSync("client/src/components/TrialDock.jsx", "utf8");
  assert.ok(dock.includes('<DepthButton primary onClick={onOpen} data-survey-invite-open="">Take the survey</DepthButton>'));
  assert.ok(dock.includes("if (surveyOpen) return <SurveyPage"), "the survey only once its button is pressed");
});

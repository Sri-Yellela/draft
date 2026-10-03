// D14 (10-03, owner, from the v3 sketch): the Draft panel's Pending tab sets STOPPED and QUEUED side
// by side, 75 / 25. Stopped (Needs review — everything the pipeline stopped for you) is the working
// surface; Queued (Waiting in line + In flight) is a glance. Below ~1080px they stack, Stopped first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const split = panel.slice(at(panel, '<div data-draft-split=""'), at(panel, "{/* ── AD1: THE BODY"));

test("D14: 75 / 25 from 1080px, one column below it", () => {
  assert.match(panel, /const splitSideBySide = viewportWidth >= 1080;/);
  assert.match(split, /gridTemplateColumns: splitSideBySide \? "minmax\(0, 3fr\) minmax\(0, 1fr\)" : "minmax\(0, 1fr\)"/);
});

test("D14: Stopped comes first in the DOM (so it stacks first), and holds Needs review", () => {
  const stopped = at(split, '<section data-draft-stopped=""');
  const queued = at(split, '<aside data-draft-queued=""');
  assert.ok(stopped < queued, "Queued precedes Stopped — stacked, the queue would come before the work");
  const stoppedCol = split.slice(stopped, queued);
  const queuedCol = split.slice(queued);
  assert.match(stoppedCol, /Needs review/);
  assert.match(stoppedCol, /<PrerequisiteCards /);
  assert.doesNotMatch(stoppedCol, /<WaitingLine |variant="inFlight"/);
  assert.match(queuedCol, /<WaitingLine /);
  assert.match(queuedCol, /variant="inFlight"/);
  assert.doesNotMatch(queuedCol, /Needs review/);
  // Nothing was lost in the move: each section is rendered exactly once in the whole panel.
  for (const marker of [/<WaitingLine /g, /variant="inFlight"/g, /<PrerequisiteCards /g]) {
    assert.equal((panel.match(marker) || []).length, 1, String(marker));
  }
});

test("D14: each column names itself and says when it is empty", () => {
  assert.match(split, />Stopped\{needsYouCount > 0 \? ` · \$\{needsYouCount\}` : ""\}</);
  assert.match(split, />Queued\{queuedCount > 0 \? ` · \$\{queuedCount\}` : ""\}</);
  assert.match(split, /Nothing is stopped — nothing needs you\./);
  assert.match(split, /Nothing queued\./);
  assert.match(panel, /const queuedCount = \(applyLine\.waiting \|\| \[\]\)\.length \+ applyInFlight\.length;/);
});

test("D14: a section heading wraps rather than breaking its title in the narrow column", () => {
  const sections = read("client/src/panels/AutoApplyPanelSections.jsx");
  const h = sections.slice(at(sections, "export function SectionHeading"), at(sections, "export function ObstacleCard"));
  assert.match(h, /flexWrap: "wrap"/);
  assert.match(h, /whiteSpace: "nowrap"/);
});

test("D10 follow-up: the panel's intro names the new tabs", () => {
  assert.match(panel, /Draft jobs from the Daily Deck or Full House\./);
  assert.doesNotMatch(panel, /Draft jobs from Today or the board/);
});

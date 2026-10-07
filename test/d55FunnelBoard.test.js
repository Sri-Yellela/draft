// D55 F · THE TABLE'S BOARD (Kanban) AND FUNNEL — docs/AUTOFILL_TARGET.md §8.1 row 11, §8.5 (i).
//
// ⛔ The one property that matters: both are the List's rows GROUPED, never a second count. If either
// computed its numbers from anything but the rows the List shows, the funnel would drift from the
// table it summarises and nobody would notice until the score was validated against it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildHistory, applyHistoryView, chipCounts, kanbanColumns, historyFunnel,
  HISTORY_STAGES, FUNNEL_STEPS, FUNNEL_ENDINGS,
} from "../shared/applicationHistory.js";

const DAY = 86400;
const NOW = 1_800_000_000;

/** A synthetic history: every stage, two rejections at different depths, and unsent rows. */
function fixture() {
  const out = [
    ["a", null, null],                 // sent, waiting
    ["b", null, null],
    ["c", "screen", "screen"],
    ["d", "interview", "interview"],
    ["e", "offer", "offer"],
    ["f", "rejected", null],           // rejected off the résumé — reached applied only
    ["g", "rejected", "interview"],    // screen → interview → rejected — reached interviewing
    ["h", "no_response", null],
    ["i", "withdrawn", "screen"],      // withdrew after a screen
  ];
  const applications = out.map(([id, o, f], n) => ({
    id: n + 1, job_id: id, company: `Co ${id}`, role: "Engineer", applied_at: NOW - (20 + n) * DAY,
    response_outcome: o, furthest_stage: f,
    first_response_at: o && !["no_response", "withdrawn"].includes(o) ? NOW - 5 * DAY : null,
  }));
  const records = [
    { id: 100, job_id: "p", state: "pending", created_at: NOW - DAY },
    { id: 101, job_id: "q", state: "recorded", created_at: NOW - DAY },
    { id: 102, job_id: "w", state: "withdrawn", created_at: NOW - DAY },
  ];
  return buildHistory({ records, applications }, { now: NOW });
}

test("D55 Board: the Kanban's columns ARE the chips — every row in one column, counts equal", () => {
  const rows = fixture();
  const cols = kanbanColumns(rows);
  const counts = chipCounts(rows);
  assert.equal(cols.reduce((n, c) => n + c.rows.length, 0), rows.length, "every List row is on the board once");
  for (const c of cols) assert.equal(c.rows.length, counts[c.id], `${c.id}: column = chip`);
  // Grouped independently, by hand: the columns are exactly the rows with that stage.
  for (const c of cols) assert.deepEqual(c.rows.map(r => r.jobId).sort(), rows.filter(r => r.stage === c.id).map(r => r.jobId).sort());
  assert.deepEqual(cols.map(c => c.id), HISTORY_STAGES.filter(s => s !== "replied"),
    "funnel order; the optional 'replied' column only appears when it holds a row");
  const withBare = [...rows, ...buildHistory({ applications: [{ id: 99, job_id: "z", applied_at: NOW - 9 * DAY, first_response_at: NOW - DAY }] }, { now: NOW })];
  assert.ok(kanbanColumns(withBare).some(c => c.id === "replied" && c.rows.length === 1));
});

test("D55 Funnel: Σ drop-offs = sent = Applied, and sent + in play + not sent = the List's rows", () => {
  const rows = fixture();
  const f = historyFunnel(rows);
  assert.equal(f.total, rows.length);
  assert.equal(f.sent + f.inPlay + f.notSent, rows.length, "the funnel accounts for every row the List shows");
  assert.equal(f.sent, rows.filter(r => r.applicationId != null).length);
  assert.equal(f.steps[0].reached, f.sent, "Applied is everything sent");
  const here = f.steps.reduce((n, s) => n + FUNNEL_ENDINGS.reduce((m, e) => m + s.here[e], 0), 0);
  assert.equal(here, f.sent, "every sent application stopped at exactly one step");
  for (let i = 0; i < f.steps.length; i++) {
    const s = f.steps[i];
    const stopped = FUNNEL_ENDINGS.reduce((m, e) => m + s.here[e], 0);
    assert.equal(s.reached, (f.steps[i + 1]?.reached ?? 0) + stopped, `${s.id}: reached = went on + stopped here`);
  }
  assert.deepEqual([f.inPlay, f.notSent], [2, 1]);
});

test("D55 Funnel: the steps are the rows grouped by how far they got — an interview a rejection ended counts", () => {
  const rows = fixture();
  const f = historyFunnel(rows);
  const byStep = Object.fromEntries(f.steps.map(s => [s.id, s.reached]));
  // a b f h → applied only · c i → screen · d g → interviewing · e → offer
  assert.deepEqual(byStep, { applied: 9, screen: 5, interviewing: 3, offer: 1 });
  // Independently: rows whose `reached` rank is at least each step's.
  for (const s of FUNNEL_STEPS) {
    const rank = (id) => FUNNEL_STEPS.find(x => x.id === id).rank;
    assert.equal(byStep[s.id], rows.filter(r => r.reached != null && rank(r.reached) >= s.rank).length, s.id);
  }
  const iv = f.steps.find(s => s.id === "interviewing");
  assert.deepEqual(iv.here, { active: 1, rejected: 1, no_reply: 0, closed: 0 },
    "g is a rejection AT interviewing, not off the résumé");
  const ap = f.steps.find(s => s.id === "applied");
  assert.deepEqual(ap.here, { active: 2, rejected: 1, no_reply: 1, closed: 0 });
  assert.equal(f.steps.find(s => s.id === "screen").here.closed, 1, "withdrew after a screen");
});

test("D55: the Board and the Funnel follow the List's filters — same date range, same rows", () => {
  const rows = fixture();
  const v = applyHistoryView(rows, { from: NOW - 24 * DAY });
  const f = historyFunnel(v.rows);
  assert.equal(f.total, v.rows.length);
  assert.equal(kanbanColumns(v.rows).reduce((n, c) => n + c.rows.length, 0), v.rows.length);
  assert.ok(f.total < rows.length, "the range really did narrow it");
});

test("D55: the panel draws the Board and the Funnel from the shared grouping, over view.rows", () => {
  const src = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");
  assert.match(src, /\["board", "Board"\], \["funnel", "Funnel"\]/, "beside List | By company");
  assert.match(src, /kanbanColumns\(view\.rows\)/, "the Board groups the List's rows");
  assert.match(src, /<Funnel rows=\{view\.rows\}\/>/, "the Funnel is fed the List's rows");
  assert.match(src, /const f = historyFunnel\(rows\);/, "and counts them with the shared rule, not its own");
  assert.match(src, /<svg className="ah__fbar"/, "a clean SVG");
  const css = fs.readFileSync("client/src/components/ApplicationHistory.css", "utf8");
  assert.match(css, /\.ah__fseg\[data-seg="on"\]\s*\{ fill: var\(--c-accent\); \}/, "token fills");
});

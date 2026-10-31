// shared/learnStepState.js — ⭐ D115 P3 / D116 / ⭐ D117 C8 · THE rule for a piece's progress on the owner's tracker,
// defined once: the Learn view and the circle (client/src/pages/atlas/learnModel.js), YOUR MAP's "Learn next"
// (services/atlas/atlasMe.js) and the tree's learned state (services/atlas/atlasTree.js, D116 M8) all read it, so a
// piece's bar is the same number on every page.
//
// ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED (owner 10-31: "make a progress bar the user may not mark themselves
// complete"). `marks` holds only what the user DID, as the server recorded it (services/learn/learnEarned.js):
//   an item OPENED from draft        mark id = the item's id            ("s1-code")
//   a checkpoint EXPLAINED in writing mark id = "<step>#c<place>"        ("s1#c0")  — ≥ 25 words, the user's own
//   the BUILD linked                  mark id = "<step>#build"           ("s1#build") — a link to what was built
// D115's old ticks (learn_progress) are never part of `marks`: nothing a user can press says "complete".
//
// THE BAR = opened required items × 30 % + checkpoints explained × 50 % + build linked × 20 %; a piece with no required
// Build / Project item: 40 % / 60 %. A share with nothing in it (measured 10-31: every one of the 108 pieces has both
// items to open and checkpoints) gives its weight to the others. FINISHED = every required item opened, every
// checkpoint explained, the build linked where one is required. Optional items (all of D115 P5's) are "extras" — they
// add to the extras count and never block finishing. An item with no link (a Build the learner makes, the in-page
// Atlas item) cannot be opened from draft, so it is not in "opened"; a required Build is met by the build link.

/** A checkpoint's mark id — the tracker's checkpoints carry no id of their own, so their place in the step is theirs. */
export const checkpointId = (stepId, i) => `${stepId}#c${i}`;
/** The build link's mark id. */
export const buildId = (stepId) => `${stepId}#build`;

/** The item kinds that ask the learner to make something — a required one makes the piece take a build link. */
export const BUILD_KINDS = Object.freeze(["Build", "Project"]);
/** C8's weights, in percent. */
export const BAR_WEIGHTS = Object.freeze({
  build: Object.freeze({ opened: 30, explained: 50, built: 20 }),
  noBuild: Object.freeze({ opened: 40, explained: 60, built: 0 }),
});

/** The required items a learner can open from draft: not optional, with a link. */
export const itemsToOpen = (step) => (step.items || []).filter(it => !it.o && it.u);
/** True when the piece has a required Build / Project item. */
export const buildRequired = (step) => (step.items || []).some(it => !it.o && BUILD_KINDS.includes(it.k));

/**
 * A piece's earned progress.
 * @param marks { [markId]: truthy } — what the user did (never a tick)
 * @returns {{ bar, opened, toOpen, explained, checkpoints, build: boolean, built: boolean, extras, extrasTotal,
 *            done, total, complete: boolean, started: boolean }}  complete = FINISHED (C8); started = bar's first step
 */
export function stepState(step, marks = {}) {
  const open = itemsToOpen(step).map(it => it.id);
  const cps = (step.c || []).map((_, i) => checkpointId(step.id, i));
  const build = buildRequired(step);
  const opened = open.filter(id => marks[id]).length;
  const explained = cps.filter(id => marks[id]).length;
  const built = build && !!marks[buildId(step.id)];
  const optional = (step.items || []).filter(it => it.o);
  const extras = optional.filter(it => marks[it.id]).length;
  const w = build ? BAR_WEIGHTS.build : BAR_WEIGHTS.noBuild;
  const shares = [[w.opened, opened, open.length], [w.explained, explained, cps.length], [w.built, built ? 1 : 0, build ? 1 : 0]]
    .filter(([, , n]) => n > 0);
  const weight = shares.reduce((a, [wt]) => a + wt, 0);
  const done = opened + explained + (built ? 1 : 0);
  const total = open.length + cps.length + (build ? 1 : 0);
  const complete = total > 0 && done === total;
  // Floor, so the bar reads 100 only when the piece is finished.
  const bar = complete ? 100 : weight ? Math.floor(shares.reduce((a, [wt, d, n]) => a + (wt * d) / n, 0) * 100 / weight) : 0;
  return { bar, opened, toOpen: open.length, explained, checkpoints: cps.length, build, built, extras, extrasTotal: optional.length,
    done, total, complete, started: done > 0 };
}

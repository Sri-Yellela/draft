// shared/learnStepState.js — ⭐ D115 P3 / D116 · THE rule for a step's progress on the owner's tracker, defined once:
// the Learn view (client/src/pages/atlas/learnModel.js) and YOUR MAP's "Learn next" (services/atlas/atlasMe.js) both
// read it, so a step's "3 of 5" is the same number on both pages.

/** A checkpoint's mark id — the tracker's checkpoints carry no id of their own, so their place in the step is theirs. */
export const checkpointId = (stepId, i) => `${stepId}#c${i}`;

/**
 * A step's progress: its REQUIRED items (not optional) done and its checkpoints explained.
 * @param marks { [markId]: truthy }
 * @returns {{ done, total, complete: boolean, started: boolean }}
 */
export function stepState(step, marks) {
  const req = (step.items || []).filter(it => !it.o).map(it => it.id);
  const cps = (step.c || []).map((_, i) => checkpointId(step.id, i));
  const all = [...req, ...cps];
  const done = all.filter(id => marks[id]).length;
  const anyOptional = (step.items || []).some(it => it.o && marks[it.id]);
  return { done, total: all.length, complete: all.length > 0 && done === all.length, started: done > 0 || anyOptional };
}

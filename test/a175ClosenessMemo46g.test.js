// ⭐ A175 (46g, measured on staging) · Your map's closenessCounts is kept per readings array + skill set — exact, never stale.
import test from "node:test";
import assert from "node:assert/strict";
import { closenessCounts } from "../services/atlas/atlasTree.js";

const deep = (m) => JSON.stringify([...m].map(([k, v]) => [k, { ...v, with: [...v.with] }]).sort());

test("a175: the same readings + skill set answer the kept counts; a new readings array or another skill set is recomputed", () => {
  const readings = [{ asked: [1, 2, 3] }, { asked: [2, 3] }, { asked: [1, 4] }, { asked: [3, 4, 5] }];
  const a = closenessCounts(readings, new Set([2, 3]));
  assert.equal(closenessCounts(readings, new Set([3, 2])), a, "same array, same set (any order) → the kept answer");
  const fresh = closenessCounts(readings.map(r => ({ asked: [...r.asked] })), new Set([2, 3]));
  assert.notEqual(fresh, a, "a new readings array (a rebuild) is recomputed");
  assert.equal(deep(fresh), deep(a), "and agrees exactly");
  const other = closenessCounts(readings, new Set([1]));
  assert.notEqual(other, a);
  assert.notEqual(deep(other), deep(a), "another skill set is its own answer");
  assert.equal(a.get(3).postings, 3); assert.equal(a.get(1).postings, 2);
});

test("a175: a posting's requirements are kept per TEXT — the same words answer the kept reading, an edit is re-read", async () => {
  const { requirementsOfText } = await import("../services/jobEligibility.js");
  const { postingRequirements } = await import("../shared/postingRequirements.js");
  const { normalizePosting } = await import("../shared/postingNormalize.js");
  const text = "We are hiring.\nMust be a U.S. citizen. An active Secret clearance is required. Bachelor's degree in CS.";
  const a = requirementsOfText(text);
  assert.equal(requirementsOfText(text), a, "same text → the kept reading");
  assert.deepEqual(a, postingRequirements(normalizePosting(text)), "and it is exactly the direct reading");
  const edited = requirementsOfText(text.replace("Secret", "Top Secret"));
  assert.notEqual(edited, a);
  assert.deepEqual(edited, postingRequirements(normalizePosting(text.replace("Secret", "Top Secret"))));
});

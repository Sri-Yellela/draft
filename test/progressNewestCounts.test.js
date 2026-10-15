// ⛔ 43k · the progress record keeps the NEWEST fill counts. J9 (light) read "Filled 0 of 3" after a full fill twice
// under the full suite: the fill writes its result at once (noteFill), while the panel's first report — its "waiting"
// draw, 0 of N — waits on loadPacketForTab before it writes (noteReviewed), so it could land last. Ordering the panel's
// own reports (reviewWriteOrder.test.js) did not cover the fill's write. Both writers now stamp `at`; older never wins.
import test from "node:test";
import assert from "node:assert/strict";

function chromeStub() {
  const m = new Map();
  globalThis.chrome = { storage: { local: {
    async get(k) { return Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))])); },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  }, session: { async get() { return {}; }, async set() {}, async remove() {} } } };
}
let instance = 0;
const fresh = () => import(`../extension/progress.js?i=${++instance}`);

test("a panel report made BEFORE the fill's result never replaces it — the J9 order", async () => {
  chromeStub();
  const { noteFill, noteReviewed, progress } = await fresh();
  const waitingDrawAt = Date.now() - 5;   // the panel's first draw, during the fill
  await noteFill({ ok: true, filled: [{}, {}, {}], fieldCount: 3, panel: { filled: 3, of: 3, needYou: 0, check: 0 } }, { jobId: "j1" });
  await noteReviewed({ counts: { filled: 0, of: 3, needYou: 3, check: 0 }, sentAt: waitingDrawAt }, { jobId: "j1" });
  const r = await progress.get({ jobId: "j1" });
  assert.equal(r.filled.n, 3, `the late "waiting" report must not win — got ${JSON.stringify(r.filled)}`);
  assert.equal(r.filled.needYou, 0);
});

test("a NEWER panel report still applies — the person's own work in the panel moves the counts", async () => {
  chromeStub();
  const { noteFill, noteReviewed, progress } = await fresh();
  await noteFill({ ok: true, filled: [{}], fieldCount: 3, panel: { filled: 1, of: 3, needYou: 2, check: 0 } }, { jobId: "j2" });
  await noteReviewed({ counts: { filled: 3, of: 3, needYou: 0, check: 0 }, sentAt: Date.now() + 5 }, { jobId: "j2" });
  assert.equal((await progress.get({ jobId: "j2" })).filled.n, 3);
});

test("an unstamped write (an older caller) still applies; `at` is the only field added (null when unstamped)", async () => {
  chromeStub();
  const { progress } = await fresh();
  await progress.patch({ jobId: "j3" }, { filled: { n: 2, of: 4, needYou: 2, check: 0 } });
  const r = await progress.get({ jobId: "j3" });
  assert.deepEqual(r.filled, { n: 2, of: 4, needYou: 2, check: 0, at: null });
});

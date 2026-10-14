// J11 · TASK G5's batch fills on the ADVANCE the candidate pressed — never on a reload of the same application.
//
// G5 ("one gate crossing, several applications") moves the SAME tab to the next queued application on a portal
// (GATE_BATCH_NEXT → advanceBatch → chrome.tabs.update) and fills it "without another keypress". Its
// tabs.onUpdated listener used to start a fill on EVERY complete load of a batched tab on the batch's origin — so
// a plain reload of an application already filled re-ran a fill the candidate did not ask for (and, measured on
// the Workday fixture, painted the previous step's panel over a Sign In page). The fill is now gated on a one-shot
// advance mark: advanceBatch arms it just before it navigates, the next complete load on the origin takes it.
//
// These drive the REAL extension/background.js under a fake `chrome` that keeps its listeners, so what is asserted
// is the router's behaviour, not a regex over its source.
import test from 'node:test';
import assert from 'node:assert/strict';

const ORIGIN = 'https://acme.wd5.myworkdayjobs.com';
const JOB1 = `${ORIGIN}/en-US/careers/job/Boston/Engineer_R1/apply`;
const JOB2 = `${ORIGIN}/en-US/careers/job/Boston/Engineer_R2/apply`;
const TAB = 7;

const listeners = { onUpdated: [], onMessage: [] };
const h = { session: new Map(), updates: [], badges: [], net: [], packets: [], tabUrl: JOB1 };

function area(m) {
  return {
    async get(k) {
      if (k == null) return Object.fromEntries([...m].map(([a, b]) => [a, structuredClone(b)]));
      return Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  };
}
const ev = (bucket) => ({ addListener(fn) { if (bucket) listeners[bucket].push(fn); }, removeListener() {} });

globalThis.chrome = {
  storage: { local: area(new Map([['authToken', 'tok-synthetic']])), session: area(h.session), onChanged: ev() },
  runtime: {
    id: 'test', getURL: (p) => `chrome-extension://test/${p}`, getManifest: () => ({ version: '0.0.0' }),
    sendMessage: async () => null, onMessage: ev('onMessage'), onInstalled: ev(), onStartup: ev(),
  },
  permissions: {
    contains: async () => false, request: async () => false, remove: async () => true,
    getAll: async () => ({ origins: [] }), onAdded: ev(), onRemoved: ev(),
  },
  scripting: {
    async executeScript() { return [{ result: null }]; },
    async getRegisteredContentScripts() { return []; }, async registerContentScripts() {}, async unregisterContentScripts() {},
  },
  tabs: {
    get: async (id) => ({ id, url: h.tabUrl }),
    query: async () => [{ id: TAB, url: h.tabUrl }],
    update: async (id, { url }) => { h.updates.push(url); h.tabUrl = url; return { id, url }; },
    create: async () => ({}), sendMessage: async () => null,
    onUpdated: ev('onUpdated'), onRemoved: ev(),
  },
  commands: { getAll: async () => [], onCommand: ev() },
  action: {
    async setBadgeText({ text }) { h.badges.push(text); }, async setBadgeBackgroundColor() {}, async setTitle() {},
  },
  contextMenus: { create() {}, removeAll(cb) { cb?.(); }, onClicked: ev() },
};
globalThis.fetch = async (url, init = {}) => {
  h.net.push(String(url));
  const body = String(url).includes('/api/apply/gate-packets') ? { packets: h.packets, portals: [] } : {};
  return new Response(JSON.stringify(body), { status: String(url).includes('/api/apply/gate-packets') ? 200 : 404,
    headers: { 'Content-Type': 'application/json' } });
};

await import('../extension/background.js');

const settle = () => new Promise(r => setTimeout(r, 50));
const fills = () => h.badges.length;          // reportHandoff paints the toolbar badge once per fill that ran

async function load(url) {                    // what Chrome does at the end of any load of the tab
  h.tabUrl = url;
  await Promise.all(listeners.onUpdated.map(fn => fn(TAB, { status: 'complete' }, { id: TAB, url })));
  await settle();
}

async function pressNext() {                  // the overlay's "Next application" (GATE_BATCH_NEXT)
  return new Promise((resolve) => {
    let answered = false;
    for (const fn of listeners.onMessage) {
      const r = fn({ type: 'GATE_BATCH_NEXT' }, { tab: { id: TAB, url: h.tabUrl } }, (v) => { answered = true; resolve(v); });
      if (r === true && !answered) continue;
    }
  });
}

function batched() {                          // the state a finished fill leaves when more are queued (gated-handoff.js)
  h.session.set(`batch:${TAB}`, { origin: ORIGIN, host: 'acme.wd5.myworkdayjobs.com', remaining: 1, updatedAt: Date.now() });
}

test('G5: a RELOAD of a batched tab does not start a fill', async () => {
  batched();
  const before = fills();
  await load(JOB1);
  assert.equal(fills(), before, 'a reload of the application already in hand must not re-run the fill');
  assert.ok(h.session.has(`batch:${TAB}`), 'a reload on the portal keeps the batch — only leaving the origin ends it');
});

test('G5: the ADVANCE the candidate pressed fills the next application, once', async () => {
  batched();
  h.packets = [{ packetId: 'p2', applyUrl: JOB2, origin: ORIGIN, origins: [ORIGIN], createdAt: 2, kind: 'gate' }];
  const r = await pressNext();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.navigated, true);
  assert.deepEqual(h.updates.slice(-1), [JOB2], 'the same tab is moved to the next application');

  const before = fills();
  await load(JOB2);
  assert.equal(fills(), before + 1, 'the load the advance caused starts the fill, without another keypress');

  // The mark is one-shot, taken by the load that used it — not left for the fill to overwrite. (This fill stops
  // early under the fake chrome and re-saves nothing, which is exactly the case where a lingering mark would leak.)
  assert.ok(h.session.has(`batch:${TAB}`), 'the batch is still on the tab');
  assert.equal(h.session.get(`batch:${TAB}`).advance, undefined, 'the advance mark is spent');
  await load(JOB2);
  assert.equal(fills(), before + 1, 'a reload after the advanced fill must not fill again');
});

test('G5: a stale advance mark (the navigation never completed) does not fill a later reload', async () => {
  batched();
  const b = h.session.get(`batch:${TAB}`);
  h.session.set(`batch:${TAB}`, { ...b, advance: { applyUrl: JOB2, at: Date.now() - 10 * 60 * 1000 } });
  const before = fills();
  await load(JOB2);
  assert.equal(fills(), before, 'an advance armed long ago is not this load');
});

test('G5: leaving the portal still ends the batch, armed or not', async () => {
  batched();
  const b = h.session.get(`batch:${TAB}`);
  h.session.set(`batch:${TAB}`, { ...b, advance: { applyUrl: JOB2, at: Date.now() } });
  const before = fills();
  await load('https://elsewhere.example.com/');
  assert.equal(fills(), before);
  assert.equal(h.session.has(`batch:${TAB}`), false, 'the grant is gone off-origin, and so is the batch');
});

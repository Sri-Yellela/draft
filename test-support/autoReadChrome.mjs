// A fake `chrome` for extension/autoRead.js's service-worker half (D97, lane J5) — and a fetch that counts every request.
//
//   const h = installAutoReadChrome({ granted: ['https://*.myworkdayjobs.com/*'], page: { pageFacts: () => ({…}) } });
//
// · executeScript answers by the injected function's NAME from `page` (a function of its args, or a value); every
//   injection is recorded in h.injected, so a test can say "the extractor never ran".
// · permissions: contains / request / remove against the `granted` set; h.requested and h.removed record the calls.
// · scripting.registerContentScripts / getRegisteredContentScripts / unregisterContentScripts keep h.registered.
// · fetch: h.net records { url, method, body } of every request; h.respond(url, init) answers (default 200 {}).
//   `passthrough` sends the request on to the real fetch (for the real routes), still recording it.
const realFetch = globalThis.fetch;

export function installAutoReadChrome({ granted = [], page = {}, tab = null, respond = null, passthrough = false } = {}) {
  const stores = { local: new Map([['authToken', 'tok-synthetic']]), session: new Map() };
  const area = (m) => ({
    async get(k) {
      if (k == null) return Object.fromEntries([...m].map(([a, b]) => [a, structuredClone(b)]));
      return Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  });
  const ev = () => ({ addListener() {}, removeListener() {} });
  const h = {
    stores, granted: new Set(granted), page, tab, injected: [], injectedArgs: [], requested: [], removed: [],
    registered: new Map(), net: [], respond: respond || (() => ({ status: 200, body: {} })),
  };
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session), onChanged: ev() },
    runtime: {
      id: 'test', getURL: (p) => `chrome-extension://test/${p}`, getManifest: () => ({ version: '1.5.2' }),
      sendMessage: async () => null, onMessage: ev(), onInstalled: ev(), onStartup: ev(),
    },
    permissions: {
      contains: async ({ origins = [] } = {}) => origins.every(o => h.granted.has(o)),
      request: async ({ origins = [] } = {}) => { h.requested.push([...origins]); origins.forEach(o => h.granted.add(o)); return true; },
      remove: async ({ origins = [] } = {}) => { h.removed.push(...origins); origins.forEach(o => h.granted.delete(o)); return true; },
      onAdded: ev(), onRemoved: ev(),
    },
    scripting: {
      async executeScript({ func, args = [] }) {
        h.injected.push(func.name);
        h.injectedArgs.push({ name: func.name, args });
        const p = h.page[func.name];
        const result = typeof p === 'function' ? await p(args) : (p === undefined ? null : structuredClone(p));
        return [{ result }];
      },
      async getRegisteredContentScripts() { return [...h.registered.values()].map(r => structuredClone(r)); },
      async registerContentScripts(list) { for (const r of list) { if (h.registered.has(r.id)) throw new Error(`duplicate ${r.id}`); h.registered.set(r.id, structuredClone(r)); } },
      async unregisterContentScripts({ ids = [] } = {}) { for (const i of ids) h.registered.delete(i); },
    },
    tabs: { get: async () => h.tab, query: async () => (h.tab ? [h.tab] : []), onUpdated: ev(), onRemoved: ev(), create: async () => ({}) },
    commands: { getAll: async () => [{ name: 'fill-gated-application', shortcut: 'Ctrl+Shift+Y' }], onCommand: ev() },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    contextMenus: { create() {}, removeAll(cb) { cb?.(); }, onClicked: ev() },
  };
  globalThis.fetch = async (url, init = {}) => {
    h.net.push({ url: String(url), method: init.method || 'GET', body: init.body ?? null });
    if (passthrough) return realFetch(url, init);
    const r = await h.respond(String(url), init);
    return new Response(JSON.stringify(r?.body ?? {}), { status: r?.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  h.restore = () => { globalThis.fetch = realFetch; delete globalThis.chrome; };
  return h;
}

/** Settings as the service worker would have written them: consent given, the named switches on. */
export function settingsWith(on = {}, { consent = 'all', kill = false } = {}) {
  const sites = {};
  for (const id of ['greenhouse', 'lever', 'ashby', 'workable', 'workday']) {
    sites[id] = { read: false, prepare: false, capture: false, fill: false, ...(on[id] || {}) };
  }
  return { v: 1, consent: consent ? { at: Date.now(), scope: consent } : null, kill, sites, reads: [] };
}

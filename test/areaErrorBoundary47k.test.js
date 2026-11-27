// ⭐ 47k (errb) · ONE AREA FAILS, THE APP STAYS — the app had no React error boundary, so a render throw or a lazy chunk
// that 404s after a deploy blanked the whole shell (WORKLOG 47j, the owner questions).
//   areaEveryAreaWrapped      — every area slot inside App.jsx's <main> renders inside an AreaErrorBoundary, with the
//                               shared areaGuard (resetKey = the /app route, Go to Home = the area nav's Home);
//   areaEveryLazyWrapped      — every React.lazy component App.jsx renders sits inside an AreaErrorBoundary;
//   areaBoundaryShape         — the boundary keeps the dock outside it, draws the plate's drawer (Reload · Go to Home),
//                               resets on resetKey without remounting, logs to the console, and reloads a chunk
//                               failure only through the guard;
//   areaChunkDetector         — isChunkLoadError knows the browsers' chunk messages and nothing else;
//   areaReloadOnce            — claimAutoReload answers yes once per window, and no whenever storage misbehaves.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { isChunkLoadError, claimAutoReload, RELOAD_KEY, RELOAD_WINDOW_MS } from "../client/src/plate/areaFault.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const APP = read("client/src/App.jsx");
const BOUNDARY = read("client/src/plate/AreaErrorBoundary.jsx");

function mainBlock() {
  const open = at(APP, "<main style=");
  const close = at(APP, "</main>", open);
  return APP.slice(open, close);
}

test("47k · areaEveryAreaWrapped — every area slot in the shell's <main> sits in its own AreaErrorBoundary", () => {
  const slots = mainBlock().split("\n").map((l) => l.trim()).filter((l) => /^\{.+&&\s*</.test(l));
  assert.ok(slots.length >= 14, `found only ${slots.length} area slots in <main>`);
  const bare = slots.filter((l) => !/&& <AreaErrorBoundary area="[a-z-]+" \{\.\.\.areaGuard\}>.*<\/AreaErrorBoundary>\}$/.test(l));
  assert.deepEqual(bare, [], "wrap the area: {cond && <AreaErrorBoundary area=\"…\" {...areaGuard}>…</AreaErrorBoundary>}");
  const names = slots.map((l) => /area="([a-z-]+)"/.exec(l)[1]);
  assert.equal(new Set(names).size, names.length, `area names repeat: ${names}`);
  assert.match(APP, /const areaGuard = \{ resetKey: routeKey, onHome: \(\) => handlePanelChange\("today"\) \};/);
  // the dock and the area nav are outside every boundary — the person can always move to another area
  const shellStart = at(APP, "<AppTopBar");
  assert.ok(shellStart < at(APP, "<main style="), "the top bar renders before <main>");
  assert.ok(at(APP, "<AppAreaNavSlot") < at(APP, "<main style="), "the area nav renders before <main>");
});

test("47k · areaEveryLazyWrapped — every React.lazy component App.jsx renders is inside an AreaErrorBoundary", () => {
  const lazies = [...APP.matchAll(/^const (\w+) = lazy\(/gm)].map((m) => m[1]);
  assert.ok(lazies.length >= 1);
  for (const name of lazies) {
    const lines = APP.split("\n").filter((l) => new RegExp(`<${name}\\b[^>]*/>`).test(l));
    assert.ok(lines.length >= 1, `${name} is never rendered`);
    for (const line of lines) {
      assert.match(line, new RegExp(`<AreaErrorBoundary [^>]*>.*<${name}\\b.*</AreaErrorBoundary>`), `${name} rendered outside a boundary: ${line.trim()}`);
    }
  }
});

test("47k · areaBoundaryShape — the plate drawer, Reload + Go to Home, reset by route, console, the guarded reload", () => {
  assert.match(BOUNDARY, /export default class AreaErrorBoundary extends Component/);
  assert.match(BOUNDARY, /static getDerivedStateFromError\(/);
  assert.match(BOUNDARY, /componentDidCatch\(error, info\)/);
  assert.match(BOUNDARY, /import \{ Drawer \} from "\.\/PlateState\.jsx";/, "the fallback is the plate's one state implementation");
  assert.match(BOUNDARY, /<PlateRoot /);
  assert.match(BOUNDARY, />Reload</);
  assert.match(BOUNDARY, />Go to Home</);
  assert.match(BOUNDARY, /role="alert"/);
  assert.match(BOUNDARY, /console\.error\(/);
  assert.match(BOUNDARY, /prev\.resetKey !== this\.props\.resetKey/, "a route change clears a failed area");
  assert.match(BOUNDARY, /isChunkLoadError\(error\) && claimAutoReload\(sessionStore\(\)\)/, "a chunk failure reloads only through the guard");
  // no new reporting endpoint was invented — the client has none
  assert.ok(!/fetch\(|sendBeacon|api\(/.test(BOUNDARY), "the boundary reports to the console only");
  // the manifest knows both files (a93)
  const manifest = read("client/src/modules.manifest.js");
  for (const f of ["plate/AreaErrorBoundary.jsx", "plate/areaFault.js"]) assert.ok(manifest.includes(`"${f}"`), f);
});

test("47k · areaChunkDetector — the browsers' chunk-load messages, and nothing else", () => {
  const yes = [
    Object.assign(new Error("Loading chunk 42 failed."), { name: "ChunkLoadError" }),
    new TypeError("Failed to fetch dynamically imported module: https://x.test/assets/AtlasPage-abc123.js"),
    new TypeError("Importing a module script failed."),
    new TypeError("error loading dynamically imported module: https://x.test/assets/a.js"),
    new Error("Unable to preload CSS for /assets/a.css"),
    "Failed to fetch dynamically imported module",
  ];
  for (const e of yes) assert.equal(isChunkLoadError(e), true, String(e?.message || e));
  const no = [null, undefined, new Error("Cannot read properties of undefined (reading 'map')"), new TypeError("Failed to fetch"),
    new Error("Minified React error #310"), {}, ""];
  for (const e of no) assert.equal(isChunkLoadError(e), false, String(e?.message ?? e));
});

test("47k · areaRootBoundary — the root render sits in one AreaErrorBoundary, outside App (the public pages, admin, the dock)", () => {
  const MAIN = read("client/src/main.jsx");
  assert.match(MAIN, /import AreaErrorBoundary from "\.\/plate\/AreaErrorBoundary\.jsx";/);
  assert.match(MAIN, /<ThemeProvider>\s*<AreaErrorBoundary area="app" resetKey="root">\s*<App \/>\s*<\/AreaErrorBoundary>\s*<\/ThemeProvider>/,
    "App renders inside the root boundary (inside ThemeProvider, so the drawer wears the theme's plate)");
});

function memoryStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

test("47k · areaReloadOnce — one automatic reload per window, never a loop, and none without working storage", () => {
  const s = memoryStore();
  const t0 = 1_800_000_000_000;
  assert.equal(claimAutoReload(s, t0), true, "the first chunk failure reloads");
  assert.equal(s._m.get(RELOAD_KEY), String(t0));
  assert.equal(claimAutoReload(s, t0 + 1_000), false, "the page that comes back failing again shows the state");
  assert.equal(claimAutoReload(s, t0 + RELOAD_WINDOW_MS - 1), false);
  assert.equal(claimAutoReload(s, t0 + RELOAD_WINDOW_MS), true, "a later deploy in the same tab may reload once more");
  // storage that throws, is missing, or drops writes: no reload (without the guard a reload could loop)
  assert.equal(claimAutoReload(null, t0), false);
  assert.equal(claimAutoReload({ getItem() { throw new Error("SecurityError"); }, setItem() {} }, t0), false);
  assert.equal(claimAutoReload({ getItem: () => null, setItem() { throw new Error("QuotaExceededError"); } }, t0), false);
  assert.equal(claimAutoReload({ getItem: () => null, setItem() {} }, t0), false, "a write that does not stick");
  // a garbage record is not a recent reload
  const g = memoryStore(); g.setItem(RELOAD_KEY, "not-a-number");
  assert.equal(claimAutoReload(g, t0), true);
});

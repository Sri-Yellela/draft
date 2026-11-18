// ── A232 R2 (46t, owner 11-17: "go with R1 and R2") · ONE FIDELITY PROBE FOR THE WHOLE SUITE ───────────────────────
//
// Fourteen test files each ran `scripts/fidelityShots.mjs --styles <screen>`, and each run started its own vite dev
// server (a cold transform of the whole client) and its own Chrome — 12.2 min of the suite (docs/A232_TEST_AUDIT.md).
// Now they ask probe(id, { routes, sizes }) here. The answers are kept in tmp/fidelity-cache/<tree>.json, keyed by a
// hash of everything a probe reads (client/, shared/, docs/sketches/, the script); test-support/fidelityGlobalSetup.mjs
// fills every probe below with ONE vite and ONE Chrome before the browser tier runs (`--styles-batch`). A file run on
// its own with nothing cached measures only its own probe, as before. Shots go to tmp/fidelity-shots, never to the
// tracked docs/fidelity-shots/ (which every suite run used to rewrite).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CACHE = process.env.FIDELITY_CACHE_DIR || path.join(ROOT, "tmp", "fidelity-cache");   // A234: a test may point it elsewhere
export const SHOTS = "tmp/fidelity-shots";

/** Every probe a test asks for. A test asking for one not listed here fails loudly (add it here). */
export const PROBES = [
  { id: "deck" }, { id: "fullhouse" }, { id: "settings" }, { id: "tracker" },
  { id: "home" }, { id: "home156" }, { id: "home163" }, { id: "home168" },
  { id: "dock167" }, { id: "dock167place" }, { id: "posting-facts" }, { id: "ask200" },
  { id: "screens163" }, { id: "shrink201", routes: "draft-held,board,profile", sizes: "768,390" },
];
export const keyOf = (p) => [p.id, p.routes || "", p.sizes || ""].join("|");

// What a probe's answer depends on: the client it serves, the shared code the client imports, the sketches, the script.
const INPUTS = ["client/src", "client/index.html", "client/vite.config.js", "client/package.json", "shared", "docs/sketches", "scripts/fidelityShots.mjs", "services/browserLauncher.js"];
function walk(abs, out) {
  let st; try { st = fs.statSync(abs); } catch { return; }
  if (st.isDirectory()) { for (const n of fs.readdirSync(abs).sort()) if (n !== "node_modules" && n !== "dist") walk(path.join(abs, n), out); }
  else out.push(abs);
}
let treeMemo = null;
export function treeHash() {
  if (treeMemo) return treeMemo;
  const h = crypto.createHash("sha1"), files = [];
  for (const p of INPUTS) walk(path.join(ROOT, p), files);
  for (const f of files) { h.update(path.relative(ROOT, f)); h.update(fs.readFileSync(f)); }
  return (treeMemo = h.digest("hex").slice(0, 16));
}

const cacheFile = () => path.join(CACHE, `${treeHash()}.json`);
function readCache() { try { return JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { return {}; } }
function writeCache(add) {
  fs.mkdirSync(CACHE, { recursive: true });
  const next = { ...readCache(), ...add }, tmp = `${cacheFile()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next)); fs.renameSync(tmp, cacheFile());
}
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// one filler at a time (a mkdir lock); a lock older than 45 min is a killed run's and is taken over
function withLock(fn) {
  fs.mkdirSync(CACHE, { recursive: true });
  const lock = path.join(CACHE, `${treeHash()}.lock`);
  for (let waited = 0; ; waited += 2000) {
    try { fs.mkdirSync(lock); break; } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 45 * 60_000) { fs.rmSync(lock, { recursive: true, force: true }); continue; } } catch { continue; }
      if (waited > 50 * 60_000) throw new Error("fidelityProbe: waited 50 min for another run's probe");
      sleepSync(2000);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

/** Runs `--styles-batch` for these probes (one vite, one Chrome) and keeps the answers. */
export function fill(specs = PROBES, { timeout = 40 * 60_000 } = {}) {
  return withLock(() => {
    const have = readCache(), missing = specs.filter(p => !(keyOf(p) in have));
    if (!missing.length) return have;
    const stdout = execFileSync(process.execPath, [path.join(ROOT, "scripts", "fidelityShots.mjs"), "--styles-batch", JSON.stringify(missing)],
      { cwd: ROOT, encoding: "utf8", timeout, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, FIDELITY_OUT: SHOTS } });
    const got = JSON.parse(stdout.trim().split("\n").pop());
    // an answer that failed is not kept — the next ask measures it again
    writeCache(Object.fromEntries(Object.entries(got).filter(([, v]) => !v?.error)));
    return { ...readCache(), ...got };
  });
}

// ⭐ A234 (46v): an answer measured while the machine was loaded (11-17: the tracker's phone --bg) was cached and every
// rerun read the same wrong value. Now a test process remembers the cached answers it read, and if it exits FAILING
// (node:test sets process.exitCode), those answers are dropped from the cache — the next run measures them again. A
// passing run keeps them. The global fill never reads through probe(), so a fill alone never evicts anything.
const readHere = new Set();
export function evictKeys(keys) {
  if (!keys.length) return;
  try {
    const cur = readCache(); let changed = false;
    for (const k of keys) if (k in cur) { delete cur[k]; changed = true; }
    if (!changed) return;
    const tmp = `${cacheFile()}.${process.pid}.evict.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cur)); fs.renameSync(tmp, cacheFile());
  } catch { /* best effort: a cache that cannot be written is simply measured again */ }
}
let exitHooked = false;
const hookExit = () => {
  if (exitHooked) return; exitHooked = true;
  process.on("exit", (code) => { if ((code || process.exitCode) && readHere.size) evictKeys([...readHere]); });
};

/** The answer of `fidelityShots.mjs --styles <id> [routes]` (FIDELITY_SIZES=<sizes>), from the shared probe. */
export function probe(id, { routes = null, sizes = null } = {}) {
  const spec = { id, ...(routes ? { routes } : {}), ...(sizes ? { sizes } : {}) };
  if (!PROBES.some(p => keyOf(p) === keyOf(spec))) throw new Error(`fidelityProbe: "${keyOf(spec)}" is not in PROBES (test-support/fidelityProbe.mjs) — add it there`);
  let a = readCache()[keyOf(spec)];
  if (!a) a = fill([spec])[keyOf(spec)];
  readHere.add(keyOf(spec)); hookExit();   // A234: dropped again if this process ends failing
  if (a?.error) throw new Error(`fidelityShots ${keyOf(spec)}: ${a.error}`);
  return a;
}

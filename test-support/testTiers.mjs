// ── A232 R1 (46t, owner 11-17: "go with R1 and R2") · TWO TIERS, ONE RULE ─────────────────────────────────────────────
//
// The audit (docs/A232_TEST_AUDIT.md) measured 830 files run alone: the ~75 that drive a real browser took 38.9 min (76 %),
// the other ~755 took 12.2 min — 5 min at concurrency 3. So:
//   FAST    — every file that drives no browser: `npm run test:fast` (concurrency 3) on every change.
//   BROWSER — every file that drives one (real Chrome, the real extension, or a script that does): `npm run test:browser`
//             (concurrency 1) before a push, and when client/, extension/ or a walk changes.
// The whole suite (both) is still the gate for a push and for the count in CLAUDE.md. This rule is the ONLY place a file's
// tier is decided — the runner (scripts/testTier.mjs) and the guard (test/testTiers.test.js) both read it — so a new
// browser test cannot land in the fast tier by accident: a file is BROWSER when its own source names a browser driver, or
// when it runs a repository script whose source does.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
// a file DRIVES a browser when it imports one (puppeteer / launchBrowser / the extension harness / a walk) or reads the
// shared fidelity probe — a file that only names them in a comment or a regex stays fast
export const BROWSER_MARKERS = /from\s+["']puppeteer(?:-core)?["']|import\(\s*["']puppeteer(?:-core)?["']\s*\)|\blaunchBrowser\(|from\s+["'][^"']*(?:extensionBrowser|walkExtension)\.mjs["']|import\(\s*["'][^"']*(?:extensionBrowser|walkExtension|walks\/[\w-]+)\.mjs["']|test-support\/walks\/[\w-]+\.mjs|import \{ probe as fidelityProbe \} from/;
// a script the test runs: execFileSync / spawn / fork of process.execPath with "scripts/<name>.mjs" (or .js)
const SCRIPT_RUN = /(?:execFileSync|execFile|spawnSync|spawn|fork)\(\s*process\.execPath\s*,\s*\[\s*(?:path\.join\([^)]*?)?["'`]((?:scripts|test-support)\/[\w./-]+\.m?js)["'`]/g;

const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; } };
const scriptMemo = new Map();
function scriptDrivesBrowser(rel, seen = new Set()) {
  if (scriptMemo.has(rel)) return scriptMemo.get(rel);
  if (seen.has(rel)) return false; seen.add(rel);
  const src = read(rel);
  // a script's own driver, or one of the repository modules it imports (one level of test-support / scripts helpers)
  let yes = /\bpuppeteer\b|\blaunchBrowser\b/.test(src);
  if (!yes) for (const m of src.matchAll(/from\s+["'](\.{1,2}\/[^"']+\.m?js)["']/g)) {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
    if (/^(scripts|test-support)\//.test(dep) && scriptDrivesBrowser(dep, seen)) { yes = true; break; }
  }
  scriptMemo.set(rel, yes);
  return yes;
}

/** "browser" or "fast" for a test file (path relative to the repository, forward slashes). */
export function tierOf(rel) {
  const src = read(rel);
  if (BROWSER_MARKERS.test(src)) return "browser";
  for (const m of src.matchAll(SCRIPT_RUN)) if (scriptDrivesBrowser(m[1])) return "browser";
  return "fast";
}

/** Every test file the suite runs (`test/` + `packages/*\/test`), sorted, forward slashes. */
export function testFiles() {
  const list = (d) => { try { return fs.readdirSync(path.join(ROOT, d)).filter(f => /\.test\.m?js$/.test(f)).map(f => `${d}/${f}`); } catch { return []; } };
  const pk = (() => { try { return fs.readdirSync(path.join(ROOT, "packages")); } catch { return []; } })();
  return [...list("test"), ...pk.flatMap(p => list(`packages/${p}/test`))].sort();
}

export function filesFor(tier) {
  const all = testFiles();
  return tier === "all" ? all : all.filter(f => tierOf(f) === tier);
}

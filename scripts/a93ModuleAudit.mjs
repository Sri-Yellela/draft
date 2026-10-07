// A93 · THE MODULE AUDIT — what is defined twice, and what crosses a page boundary.
//
//   node scripts/a93ModuleAudit.mjs            → a readable report
//   node scripts/a93ModuleAudit.mjs --json     → the same, as JSON
//
// Read-only. Reads client/src and nothing else. Two questions, each the half of the owner's complaint
// (10-07): "others aspects that are literally the same are not being used modularly while the ones that
// are specific to a page or module are being used in another module."
//   duplicates  a component (a capitalised function / forwardRef / memo) defined in more than one file
//   crossings   a file importing from a PAGE-PRIVATE place — panels/, pages/ — when it is not in that
//               same panel or page; and a shared component importing a panel
import fs from "node:fs";
import path from "node:path";

const ROOT = "client/src";
const rel = (p) => p.split(path.sep).join("/").replace(`${ROOT}/`, "");

export function walkSources(dir = ROOT, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walkSources(p, out);
    else if (/\.(jsx?|css)$/.test(n)) out.push(p);
  }
  return out;
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/** { Name: [file, …] } for every capitalised component defined at module level. */
export function componentDefinitions(files = walkSources()) {
  const defs = {};
  const re = /^(?:export\s+(?:default\s+)?)?(?:function\s+([A-Z][A-Za-z0-9]+)\s*\(|const\s+([A-Z][A-Za-z0-9]+)\s*=\s*(?:\(|memo\(|forwardRef\(|React\.forwardRef\())/gm;
  for (const f of files.filter(f => /\.jsx?$/.test(f))) {
    const s = strip(fs.readFileSync(f, "utf8"));
    for (const m of s.matchAll(re)) (defs[m[1] || m[2]] ||= []).push(rel(f));
  }
  return defs;
}

/** Every relative import, resolved to a client/src path. */
export function importsOf(file) {
  const s = strip(fs.readFileSync(file, "utf8"));
  const out = [];
  for (const m of s.matchAll(/(?:import\s[^;]*?from\s*|import\s*\(\s*|^\s*import\s+)["'](\.{1,2}\/[^"']+)["']/gm)) {
    out.push(rel(path.normalize(path.join(path.dirname(file), m[1]))));
  }
  return out;
}

/** The place a file belongs to: a panel or page is private to itself; components/, styles/, lib/ are shared. */
export function zoneOf(r) {
  const m = r.match(/^(panels|pages)\/(?:admin\/|marketing\/|tools\/)?([^/.]+)/);
  if (m) return `${m[1]}/${m[2]}`;
  return r.split("/")[0];
}

export function crossings(files = walkSources()) {
  const out = [];
  for (const f of files.filter(f => /\.jsx?$/.test(f))) {
    const from = rel(f);
    for (const to of importsOf(f)) {
      const tz = zoneOf(to);
      if (!/^(panels|pages)\//.test(tz)) continue;          // importing something shared is fine
      if (zoneOf(from) === tz) continue;                     // inside its own panel or page
      if (from === "App.jsx" || /^(main\.jsx|routes\/)/.test(from)) continue;   // the app shell mounts pages
      out.push({ from, to });
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("a93ModuleAudit.mjs")) {
  const files = walkSources();
  const dup = Object.fromEntries(Object.entries(componentDefinitions(files)).filter(([, v]) => v.length > 1).sort());
  const cross = crossings(files);
  if (process.argv.includes("--json")) { console.log(JSON.stringify({ duplicates: dup, crossings: cross }, null, 2)); process.exit(0); }
  console.log(`DUPLICATES — ${Object.keys(dup).length} component names defined in more than one file`);
  for (const [k, v] of Object.entries(dup)) console.log(`  ${k.padEnd(26)} ${v.join("  ")}`);
  console.log(`\nCROSSINGS — ${cross.length} imports of another panel's / page's code`);
  for (const c of cross) console.log(`  ${c.from.padEnd(44)} → ${c.to}`);
}

/**
 * CSS ownership: a BEM block (`pp`, `jb`, `rl`, `atsp`…) belongs to the stylesheet that defines it. A JSX
 * file that uses a block's classes but is not that stylesheet's component is borrowing another module's
 * look — the "page-specific code used in another module" half. → [{ block, css, usedBy: [file…] }]
 */
export function cssBorrowing(files = walkSources()) {
  const owner = {};
  for (const f of files.filter(f => f.endsWith(".css"))) {
    const s = strip(fs.readFileSync(f, "utf8"));
    for (const m of s.matchAll(/\.([a-z][a-z0-9-]*)__[a-z0-9-]+/g)) (owner[m[1]] ||= new Set()).add(rel(f));
  }
  const out = [];
  for (const [block, cssSet] of Object.entries(owner)) {
    const css = [...cssSet];
    const home = css.map(c => c.replace(/\.css$/, ""));
    const usedBy = files.filter(f => /\.jsx?$/.test(f) && !home.includes(rel(f).replace(/\.jsx?$/, "")))
      .filter(f => new RegExp(`["'\` ]${block}__[a-z0-9-]+`).test(strip(fs.readFileSync(f, "utf8")))).map(rel);
    if (usedBy.length) out.push({ block, css, usedBy });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("a93ModuleAudit.mjs") && !process.argv.includes("--json")) {
  const b = cssBorrowing();
  console.log(`\nCSS BORROWING — ${b.length} class blocks used outside the component that owns the stylesheet`);
  for (const x of b) console.log(`  .${x.block}__*  (${x.css.join(", ")})  ← ${x.usedBy.join("  ")}`);
}

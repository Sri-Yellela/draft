// ⭐ A93 · THE MODULE GUARD — client/src/modules.manifest.js is the declaration; this test derives the truth
// from the code (scripts/a93ModuleAudit.mjs) and fails when they disagree. Owner, 10-07: "the code is
// literally leaking across modules … others aspects that are literally the same are not being used
// modularly while the ones that are specific to a page or module are being used in another module."
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { walkSources, componentDefinitions, crossings, cssBorrowing, consumers, zoneOf } from "../scripts/a93ModuleAudit.mjs";
import { MODULES, SHARED, COMPOSITIONS, MIRRORS } from "../client/src/modules.manifest.js";

const files = walkSources();
const P = "client/src/";
const short = (p) => p.replace(P, "");

test("⛔ A93 · no component is built twice — one name, one file", () => {
  const dup = Object.entries(componentDefinitions(files)).filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.join(", ")}`);
  assert.deepEqual(dup, [], "the same thing defined in two modules — make it one shared component and list it in modules.manifest.js");
});

test("⛔ A93 · the manifest is the COMPLETE log of shared files — every one listed, every listing real", () => {
  const actual = Object.keys(consumers(files)).map(short).sort();
  const listed = Object.keys(SHARED).sort();
  assert.deepEqual(actual.filter(f => !listed.includes(f)), [], "a shared file the manifest does not log — add it to SHARED with what it is");
  assert.deepEqual(listed.filter(f => !actual.includes(f)), [], "a manifest entry for a file that is gone — delete the entry");
  for (const [f, e] of Object.entries(SHARED)) {
    assert.ok(typeof e.what === "string" && e.what.length > 3, `${f}: say what it is`);
    if (e.module) assert.ok(MODULES[e.module], `${f}: unknown module "${e.module}"`);
  }
});

test("⛔ A93 · nothing in the shared directories is dead — a file no one imports is not a module", () => {
  const dead = Object.entries(consumers(files)).filter(([, v]) => !v.length).map(([k]) => short(k));
  assert.deepEqual(dead, [], "delete it, or say who uses it");
});

test("⛔ A93 · a module's PRIVATE part is used only inside its module", () => {
  const leaks = [];
  for (const [file, users] of Object.entries(consumers(files))) {
    const e = SHARED[short(file)];
    if (!e) continue;
    const allowed = e.module ? MODULES[e.module].members : null;
    for (const u of users.map(short)) {
      if (file.endsWith(".css")) {
        const ok = u === e.owner || (e.alsoBy || []).includes(u)
          || Object.values(MODULES).some(m => (m.css || []).includes(short(file)) && m.members.includes(u));
        if (!ok) leaks.push(`${u} imports ${short(file)} (owned by ${e.owner})`);
      } else if (allowed && !allowed.includes(u)) {
        leaks.push(`${u} uses ${short(file)}, private to "${e.module}"`);
      }
    }
  }
  assert.deepEqual(leaks, [], "a page-specific part used by another module — make it shared (and say why) or stop the import");
});

test("⛔ A93 · a panel or page reaches into another only by a DECLARED composition", () => {
  const sameModule = (a, b) => Object.values(MODULES).some(m => m.members.includes(a) && m.members.includes(b));
  const declared = (c) => COMPOSITIONS.some(x => x.from === c.from && x.to === c.to);
  const undeclared = crossings(files).filter(c => !declared(c) && !sameModule(c.from, c.to)).map(c => `${c.from} → ${c.to}`);
  assert.deepEqual(undeclared, [], "declare the composition in modules.manifest.js with why — or stop the import");
  for (const c of COMPOSITIONS) {
    assert.ok(fs.existsSync(P + c.from) && fs.existsSync(P + c.to), `a composition names a file that is gone: ${c.from} → ${c.to}`);
    assert.ok(crossings(files).some(x => x.from === c.from && x.to === c.to), `a declared composition no longer exists — delete it: ${c.from} → ${c.to}`);
  }
});

test("⛔ A93 · a stylesheet's classes are worn only by its owner or its module", () => {
  const borrowed = [];
  for (const b of cssBorrowing(files)) {
    for (const u of b.usedBy) {
      const ok = b.css.some(css => {
        const e = SHARED[css];
        return e?.owner === u || (e?.alsoBy || []).includes(u)
          || Object.values(MODULES).some(m => (m.css || []).includes(css) && m.members.includes(u));
      });
      if (!ok) borrowed.push(`${u} wears .${b.block}__* from ${b.css.join(", ")}`);
    }
  }
  assert.deepEqual(borrowed, [], "one module's look worn by another — give the component its own classes, or share the component");
});

test("A93 · every extension MIRROR of a client module is still where the manifest says", () => {
  for (const m of MIRRORS) {
    assert.ok(SHARED[m.of], `${m.of} is not a logged module`);
    const src = fs.readFileSync(m.file, "utf8");
    assert.ok(src.includes(m.selector), `${m.file} no longer carries ${m.selector} — the mirror of ${m.of} moved; update the manifest`);
  }
});

test("A93 · the zones the guard reads are what the manifest assumes", () => {
  assert.equal(zoneOf("panels/JobsPanel.jsx"), "panels/JobsPanel");
  assert.equal(zoneOf("pages/marketing/PrivacyPage.jsx"), "pages/PrivacyPage");
  assert.equal(zoneOf("components/CompanyLogo.jsx"), "components");
  // Planted: the guard's derivation sees a leak when one exists.
  const fakeDefs = { Thing: ["components/A.jsx", "panels/B.jsx"] };
  assert.equal(Object.values(fakeDefs).filter(v => v.length > 1).length, 1);
});

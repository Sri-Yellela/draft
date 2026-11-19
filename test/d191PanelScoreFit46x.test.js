// ⭐ 46x (owner 11-19: "the panel is as long as the content, it should have an ats score in line with the latest ats engine")
// · the panel's % is the contextual score (ATS contract 2.0.0) with the board's band word; the home tab is as tall as its
// content until the person resizes the dock.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { panelModel, matchWords } from "../extension/jobPanelModel.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

test("the status line: the number and the board's band word; no signal says no band", () => {
  assert.equal(matchWords({ score: 78.4, band: "strong" }), "78% match · Strong");
  assert.equal(matchWords({ score: 30, band: "moderate" }), "30% match · Moderate");
  assert.equal(matchWords({ score: 12, band: "not_enough_signal" }), "12% match");
  assert.equal(matchWords({ score: 50 }), "50% match");
  const m = panelModel({ signedIn: true, page: { title: "Backend Engineer", company: "Kestrel" },
    ctx: { job: { title: "Backend Engineer", company: "Kestrel", known: true, score: 81, band: "strong" }, company: { sponsorship: "Filed 12 LCAs" } } });
  assert.equal(m.status.text, "81% match · Strong · sponsors visas");
});

test("the worker takes the CONTEXTUAL score when draft sent it, the skill match otherwise", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /const contextual = Number\.isFinite\(report\?\.contextual\?\.score\) \? report\.contextual\.score : null;\n\s+const score = contextual \?\? skill;/);
  assert.match(bg, /known: !!p\.known, score, skill, band, contextual: contextual != null,/);
  // the server sends it beside the report (routes/extensionJob.js reportOf)
  assert.match(read("routes/extensionJob.js"), /\.\.\.\(r\.contextual && typeof r\.contextual === "object" \? \{ contextual: r\.contextual \} : \{\}\)/);
});

test("the home tab fits its content: the panel measures itself, the dock sizes `draft` to it until the person resizes", () => {
  const dock = read("extension/dock.js");
  assert.match(dock, /if \(kind !== 'dock' \|\| f\.active !== 'draft' \|\| f\.place\.edge \|\| f\.place\.collapsed \|\| f\.place\.sized \|\| !\(f\.fitH > 0\)\) return r;/,
    "only the home tab, never a snapped edge, the square, or a dock the person sized");
  assert.match(dock, /h = Math\.round\(clamp\(f\.fitH, L\.minH, L\.maxH\)\)/, "capped at the viewport");
  assert.equal((dock.match(/edge: null, sized: true, rect: resizeRect\(/g) || []).length, 2, "both resizes (pointer, keyboard) mark it sized");
  assert.match(dock, /\.\.\.\(p\?\.sized === true \? \{ sized: true \} : \{\}\)/, "remembered per site");
  assert.match(dock, /fit\(tab, px\) \{\n\s+if \(tab !== 'draft'/);
  const panel = read("extension/jobPanel.js");
  assert.match(panel, /const fitDock = \(\) => \{/);
  assert.match(panel, /el === mid \? 12 :/, "the middle's stretch is not content");
  assert.match(panel, /new ResizeObserver\(\(\) => fitDock\(\)\)/);
  assert.match(panel, /if \(!el\.classList\.contains\('mid'\)\) root\.__draftFit\.observe\(el\)/, "never observes the middle (it is the dock's height — a loop)");
});

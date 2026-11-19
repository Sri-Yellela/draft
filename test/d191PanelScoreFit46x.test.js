// ⭐ 46x (owner 11-19: "the panel is as long as the content, it should have an ats score in line with the latest ats engine")
// · the panel's % is the contextual score (ATS contract 2.0.0), painted in its band's colour with no band word (owner 11-19:
// "the font color on the ats number should do it no need for the words"); the home tab is as tall as its
// content until the person resizes the dock.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { panelModel, matchWords, matchBand } from "../extension/jobPanelModel.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

test("the status line: the number alone — its band is its colour, never a word (owner 11-19)", () => {
  assert.equal(matchWords({ score: 78.4, band: "strong" }), "78% match");
  assert.equal(matchBand({ score: 78, band: "strong" }), "strong");
  assert.equal(matchBand({ score: 12, band: "not_enough_signal" }), null, "no signal paints plain");
  assert.equal(matchBand({ band: "strong" }), null, "no number, no colour");
  const m = panelModel({ signedIn: true, page: { title: "Backend Engineer", company: "Kestrel" },
    ctx: { job: { title: "Backend Engineer", company: "Kestrel", known: true, score: 81, band: "strong" }, company: { sponsorship: "Filed 12 LCAs" } } });
  assert.equal(m.status.text, "81% match · sponsors visas");
  assert.doesNotMatch(m.status.text, /Strong|Moderate|Weak/);
  assert.deepEqual([m.status.match, m.status.band], ["81% match", "strong"]);
  const panel = read("extension/jobPanel.js");
  assert.ok(panel.includes('.st .m[data-band="strong"] { color: ${c.BAND_STRONG}; }'), "painted from the palette (tokens), never a literal");
  assert.ok(panel.includes(`<span class="m" data-band="\${esc(st.band || '')}">\${esc(m)}</span>`));
  // the server sends the band of the number shown (the contextual one)
  assert.ok(read("routes/extensionJob.js").includes("contextualBand: atsBandFor(r.contextual.score ?? null)"));
  assert.ok(read("extension/background.js").includes('const band = contextual != null && typeof report?.contextualBand === "string" ? report.contextualBand :'));
});

test("the worker takes the CONTEXTUAL score when draft sent it, the skill match otherwise", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /const contextual = Number\.isFinite\(report\?\.contextual\?\.score\) \? report\.contextual\.score : null;\n\s+const score = contextual \?\? skill;/);
  assert.match(bg, /known: !!p\.known, score, skill, band, contextual: contextual != null,/);
  // the server sends it beside the report (routes/extensionJob.js reportOf)
  assert.ok(read("routes/extensionJob.js").includes('...(r.contextual && typeof r.contextual === "object" ? { contextual: r.contextual,'));
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

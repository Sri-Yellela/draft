// Queue 31 — the landing page as find → fit → apply (docs/BRAND_OUTLAY_AND_MOTION.md §The wrapper problem).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const landing = codeOnly(read("client/src/pages/LandingPage.jsx"));
const ffa = codeOnly(read("client/src/components/FindFitApply.jsx"));

// The component is JSX, which node cannot import; read the exported list from source instead.
const stationsSrc = ffa.slice(at(ffa, "export const STATIONS", 0, "stations"), at(ffa, "function useReached", 0, "after stations"));

test("⛔ the feature grid and the feature marquee are gone from the landing page", () => {
  assert.doesNotMatch(landing, /BelowFoldContent|PosterBanner/);
  assert.equal(fs.existsSync("client/src/components/BelowFoldContent.jsx"), false);
  assert.equal(fs.existsSync("client/src/components/PosterBanner.jsx"), false);
  assert.match(landing, /\{!authUser && <FindFitApply \/>\}/);
  assert.doesNotMatch(landing + ffa, /Apply smarter|AI-Powered Writing|heavy lifting/i, "copy that sells the opposite of the product");
});

test("⭐ one verb, many surfaces: three stations in order, every tool a stop on the line", () => {
  const verbs = [...stationsSrc.matchAll(/verb: "(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(verbs, ["find", "fit", "apply"]);
  const names = [...stationsSrc.matchAll(/name: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(names.length >= 6, "the tools appear where they belong");
});

test("⛔ each tool is written as what it does for a PERSON, never a feature name", () => {
  const says = [...stationsSrc.matchAll(/say: "([^"]+)"/g)].map(m => m[1]);
  assert.equal(says.length, [...stationsSrc.matchAll(/name: "/g)].length, "a surface without its sentence");
  for (const s of says) {
    assert.ok(s.split(" ").length >= 6, `"${s}" reads like a label`);
    assert.doesNotMatch(s, /AI-powered|optimi[sz]ed|leverage|seamless|one-click/i, `"${s}" is feature copy`);
  }
});

// ⛔ Owner, 10-01 (WORKLOG audit item 7): the promises are DITCHED as a selling point — on the landing
// page, the login page and the footer. Code only: a comment may still name what was removed.
const PROMISE = /nothing is (sent|submitted) (until you approve|without you)|not claim anything you did not|not inflate your years|read every draft before anything is sent|built the other way round/i;

test("⛔ no promise is sold as a pitch — landing, login or footer", () => {
  for (const p of ["client/src/components/FindFitApply.jsx", "client/src/components/AuthScreen.jsx", "client/src/components/Footer.jsx"]) {
    assert.doesNotMatch(codeOnly(read(p)), PROMISE, `${p} sells a promise`);
  }
  assert.doesNotMatch(ffa, /PROMISES|data-promises/, "the promises block is back");
});

test("⭐ the approval sentence stays where it is FUNCTIONAL — the auto-apply flow and the deck's Draft toast", () => {
  assert.match(read("client/src/contexts/AutoApplyContext.jsx"), /nothing is sent until you approve each one/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /Nothing is submitted until you approve/);
  // A53: the toast's words are shared by the deck and the board (lib/jobDecisions.js), and the deck
  // renders that shared toast.
  assert.match(read("client/src/lib/jobDecisions.js"), /nothing is sent until you approve it/);
  assert.match(read("client/src/panels/DeckView.jsx"), /<DecisionToast toast=\{toast\} onUndo=\{undo\} undoKey="U" \/>/);
});

test("⛔ only what a visitor can use today is a link; the recruiter side says 'soon'", () => {
  const links = [...stationsSrc.matchAll(/to: "([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links.sort(), ["/register", "/tools/ats"]);
  assert.match(ffa, /grade of your own job posting\. Soon\./);
});

test("⛔ the line draws on scroll, but content is VISIBLE until the observer is known to work, and never hidden under reduced motion", () => {
  assert.match(ffa, /if \(reduced \|\| typeof IntersectionObserver === "undefined"\) return;\s*setArmed\(true\);/);
  assert.match(ffa, /shown: \(i\) => !armed \|\| reached\.has\(i\)/);
  assert.equal((ffa.match(/transition: reduced \? "none" :/g) || []).length, 3);
});

test("the footer no longer sells one product", () => {
  const footer = read("client/src/components/Footer.jsx");
  assert.doesNotMatch(footer, /AI-powered resumes/);
  assert.match(footer, /Find the job\. Fit the résumé\. Apply\./);
});

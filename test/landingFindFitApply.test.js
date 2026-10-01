// Queue 31 — the landing page as find → fit → apply (docs/BRAND_OUTLAY_AND_MOTION.md §The wrapper problem).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const landing = codeOnly(read("client/src/pages/LandingPage.jsx"));
const ffa = codeOnly(read("client/src/components/FindFitApply.jsx"));

// The component is JSX, which node cannot import; read the two exported lists from source instead.
const stationsSrc = ffa.slice(at(ffa, "export const STATIONS", 0, "stations"), at(ffa, "export const PROMISES", 0, "promises"));

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

test("⭐ the restraint IS the pitch — both promises, in display type, not small print", () => {
  assert.match(ffa, /"Nothing is submitted until you approve it\."/);
  assert.match(ffa, /"It will not inflate your years or seniority — and you read every draft before anything is sent\."/);
  // ⛔ OWNER 36: the stronger promise is false while generation can add unstated material (G1).
  assert.doesNotMatch(ffa, /not claim anything you did not/i, "a public promise the product breaks");
  assert.match(ffa, /PROMISES\.map\(p => \(\s*<p key=\{p\} style=\{\{ fontFamily: "var\(--font-display\)"/);
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
  assert.match(footer, /Find, fit, apply — and nothing is sent until you approve it\./);
});

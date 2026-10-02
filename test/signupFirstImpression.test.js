// Queue 30 — login and signup as the first impression (docs/BRAND_OUTLAY_AND_MOTION.md §Login).
// ⛔ The rule over all of it: NONE OF IT MAY DELAY THE FORM. Measured in a browser (SESSION LOG 8);
// pinned here by source so the entrance animation cannot quietly return.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const auth = codeOnly(read("client/src/components/AuthScreen.jsx"));
const backdrop = codeOnly(read("client/src/components/DealBackdrop.jsx"));
const hook = codeOnly(read("client/src/components/SignupAtsHook.jsx"));
const carry = codeOnly(read("client/src/lib/signupCarry.js"));

test("⛔ the form has no entrance animation — it is usable on the first paint", () => {
  const modal = auth.slice(at(auth, "function AuthModal(", 0, "modal"), at(auth, "const HEADLINE", 0, "screen"));
  assert.doesNotMatch(auth, /import \{[^}]*\bmotion\b[^}]*\} from "framer-motion"/, "framer's motion component is back");
  assert.doesNotMatch(modal, /<motion\./);
  assert.doesNotMatch(modal, /initial=\{\{\s*opacity\s*:\s*0/);
  assert.match(modal, /<div data-auth-form className="liquid-panel"/);
});

test("⛔ the motion is behind the form: the deal is decorative, on the FAN tier, compositor-only, and stops for reduced motion", () => {
  assert.match(backdrop, /aria-hidden="true" data-deal-backdrop/);
  assert.match(backdrop, /pointerEvents: "none", zIndex: Z\.FAN/);
  assert.match(backdrop, /@keyframes draft-deal-in \{\s*from \{ transform: [^;]+; opacity: 0; \}/, "transform and opacity only");
  assert.match(backdrop, /@media \(prefers-reduced-motion: reduce\) \{ \[data-deal-card\] \{ animation: none; \} \}/);
  assert.match(backdrop, /<CardBack company=\{company\}/, "the product's own card backs — logos, never letters");
  assert.match(auth, /zIndex:Z\.CONTENT/, "the form and the page content sit above the deal by tier");
});

test("type that sets ONCE: per page session, letters never break a word, and still for reduced motion", () => {
  assert.match(auth, /let headlineSet = false;/);
  assert.match(auth, /const first = !headlineSet; headlineSet = true; return first;/);
  assert.match(auth, /<h1 aria-label=\{HEADLINE\}/, "the heading reads as one sentence to a screen reader");
  assert.match(auth, /<span key=\{wi\} aria-hidden="true" style=\{\{ whiteSpace:"nowrap" \}\}>/, "a line may break between inline-blocks — words must not");
  assert.match(auth, /@media \(prefers-reduced-motion: reduce\) \{ \[data-set-once="playing"\] span\[data-ch\] \{ animation:none; \} \}/);
});

test("paper that reacts: fine pointers only, never under reduced motion, and the substrate is put back", () => {
  const drift = auth.slice(at(auth, "function usePaperDrift(", 0, "drift"), at(auth, "export default function AuthScreen", 0, "screen"));
  assert.match(drift, /if \(reduced \|\| [^\n]*\(pointer: fine\)/);
  assert.match(drift, /el\.style\.transform = prev\.transform;/);
  assert.match(drift, /scale\(1\.02\)/, "the drift must never uncover an edge of the fixed layer");
});

test("the / is the signup's progress, on both steps", () => {
  assert.match(auth, /<SlashSteps step=\{1\} of=\{2\}\/>/);
  assert.match(auth, /<SlashSteps step=\{2\} of=\{2\}\/>/);
  assert.match(auth, /role="img" aria-label=\{`Step \$\{step\} of \$\{of\}`\}/);
});

test("⭐ the signup hook is a REAL score — the public deterministic scorer, a band, never a number", () => {
  assert.match(hook, /fetch\("\/api\/standalone\/ats", \{ method: "POST"/);
  // A52: the band is drawn by the ONE report implementation's band card, from the route's band.
  assert.match(hook, /<AtsBandCard report=\{fromStandaloneResult\(result\)\} band=\{result\.band\}/);
  assert.doesNotMatch(hook, /\.score\b|atsScore|matchScore/, "the hook reads a number");
  const server = read("server.js");
  const route = server.slice(at(server, 'app.post("/api/standalone/ats"', 0, "route"), at(server, "// POST /api/standalone/generate", 0, "next"));
  assert.doesNotMatch(route, /callModel|toolsService|anthropic/i, "the free hook must cost zero model calls");
});

test("⛔ 'sign up to keep it' is literal — and the résumé is carried in MEMORY, never browser storage", async () => {
  assert.doesNotMatch(carry, /localStorage|sessionStorage|indexedDB/, "a résumé outliving the tab on a shared computer");
  assert.match(hook, /carryResume\(file, \{ band: d\.band \}\)/);
  const C = await import("../client/src/lib/signupCarry.js");
  const file = { name: "cv.pdf" };
  C.carryResume(file, { band: "strong" });
  assert.equal(C.carriedResume().file, file);
  C.dropCarriedResume();
  assert.equal(C.carriedResume(), null);
  const profiles = read("client/src/panels/JobProfilesPanel.jsx");
  assert.match(profiles, /carried && !profile\.has_base_resume/, "offered to a profile that has no base résumé");
  assert.match(profiles, /dropCarriedResume\(\); setCarried\(null\);\s*uploadProfileResume\(profile, \{ target: \{ files: \[file\], value: "" \} \}\);/, "used once, through the normal upload");
});

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
const backdrop = codeOnly("" /* 47m: DealBackdrop.jsx deleted */);
const hook = codeOnly(read("client/src/components/SignupAtsHook.jsx"));
const carry = codeOnly(read("client/src/lib/signupCarry.js"));

// ⛔ 47m (changed on purpose): "⛔ the form has no entrance animation — it is usable on the first paint" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "⛔ the motion is behind the form: the deal is decorative, on the FAN tier, compos" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "type that sets ONCE: per page session, letters never break a word, and still for" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "paper that reacts: fine pointers only, never under reduced motion, and the subst" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "the / is the signup's progress, on both steps" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("⭐ the signup hook is a REAL score — the public deterministic scorer, a band, never a number", () => {
  assert.match(hook, /fetch\("\/api\/standalone\/ats", \{ method: "POST"/);
  // A52: the band is drawn by the ONE report implementation's band card, from the route's band.
  assert.match(hook, /<AtsBandCard report=\{fromStandaloneResult\(result\)\} band=\{result\.band\}/);
  assert.doesNotMatch(hook, /\.score\b|atsScore|matchScore/, "the hook reads a number");
  const server = read("server.js");
  const route = server.slice(at(server, 'app.post("/api/standalone/ats"', 0, "route"), at(server, "// POST /api/standalone/generate", 0, "next"));
  assert.doesNotMatch(route, /callModel|toolsService|anthropic/i, "the free hook must cost zero model calls");
});

// ⛔ 47m (changed on purpose): "⛔ 'sign up to keep it' is literal — and the résumé is carried in MEMORY, never b" retired — the surface it pinned was rebuilt in the plate system (47m M5).

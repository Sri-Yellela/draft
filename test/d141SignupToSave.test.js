import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⭐ D141 (46y) · "SIGN UP TO SAVE AND FIX" — the honesty check's hand-off into an account. It REUSES the public ATS tool's
// carry (client/src/lib/signupCarry.js, memory only) — never a second hand-off (A93) — and Job Profiles offers the carried
// résumé as a base résumé, saying how many lines the check flagged.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const page = read("client/src/pages/tools/HonestyToolPage.jsx");
const hook = read("client/src/components/SignupAtsHook.jsx");
const profiles = read("client/src/panels/JobProfilesPanel.jsx");
const carry = read("client/src/lib/signupCarry.js");

test("D141 · the carry keeps where the résumé came from and what was flagged — still memory only", async () => {
  assert.doesNotMatch(carry.replace(/\/\/.*$/gm, ""), /localStorage|sessionStorage|indexedDB/);
  const C = await import("../client/src/lib/signupCarry.js");
  const file = new File(["Jane Doe\nEngineer"], "resume.txt", { type: "text/plain" });
  C.carryResume(file, { from: "honesty", flagged: 3 });
  assert.equal(C.carriedResume().file, file);
  assert.equal(C.carriedResume().from, "honesty");
  assert.equal(C.carriedResume().flagged, 3);
  C.carryResume(file, { band: "strong" });
  assert.equal(C.carriedResume().from, "ats", "the ATS hook's carry is unchanged (its default)");
  C.dropCarriedResume();
  assert.equal(C.carriedResume(), null);
});

test("D141 · the honesty page carries the CHECKED résumé (a pasted one as resume.txt) and links to sign-up", () => {
  assert.match(page, /import \{ carryResume \} from "\.\.\/\.\.\/lib\/signupCarry\.js"/, "the ATS hook's carry, reused");
  assert.match(page, /carryResume\(checkedResumeFile\(resume, resumeText\), \{ from: "honesty", flagged: d\.flagged \?\? 0 \}\)/);
  assert.match(page, /new File\(\[t\], "resume\.txt", \{ type: "text\/plain" \}\)/);
  assert.match(page, /<Link to="\/register" data-honesty-signup-link="">Sign up to save and fix →<\/Link>|data-honesty-signup-link=""[^>]*>Sign up to save and fix →/);
  assert.doesNotMatch(page, /fetch\("\/api\/(?!standalone\/honesty)/, "no new server call: nothing is stored before sign-up");
});

test("D141 · the sign-up page says the résumé comes with you instead of asking for it again", () => {
  assert.match(hook, /c\?\.from === "honesty"/);
  assert.match(hook, /data-ats-hook-carried=""/);
});

test("D141 · Job Profiles offers it as a base résumé and says what the check flagged", () => {
  assert.match(profiles, /carried && !profile\.has_base_resume/);
  assert.match(profiles, /carried\.from === "honesty" && carried\.flagged > 0/);
});

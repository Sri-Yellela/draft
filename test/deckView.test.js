import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const raw = fs.readFileSync("client/src/panels/DeckView.jsx", "utf8").replace(/\r\n/g, "\n");
// Code only: the header comments NAME approvalMode to explain why the deck never sends it.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const app = fs.readFileSync("client/src/App.jsx", "utf8").replace(/\r\n/g, "\n");

test("⛔ the deck's Draft call carries surface:'deck' and NEVER an approvalMode", () => {
  // A53 (owner, 10-02): the call moved into lib/jobDecisions.js so the board makes the SAME one.
  const libRaw = fs.readFileSync("client/src/lib/jobDecisions.js", "utf8").replace(/\r\n/g, "\n");
  const lib = libRaw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const start = at(lib, 'api("/api/apply/runs"', 0, "the shared Draft call");
  const call = lib.slice(start, start + 260);
  assert.match(call, /jobIds: \[jobId\], mode: "auto", tool, surface/);
  assert.doesNotMatch(call, /approvalMode/, "the deck asks for no review — the route would refuse it, and the client must not try");
  assert.doesNotMatch(lib, /approvalMode/, "no approvalMode anywhere in the shared calls");
  assert.match(lib, /DECK: "deck"/);
  assert.match(src, /commitDecision\(\{ jobId: id, decision, tool, surface: DECISION_SURFACES\.DECK \}\)/);
  assert.doesNotMatch(src, /approvalMode/, "no approvalMode anywhere in the deck");
});

test("every deck motion is under ONE reduced-motion config", () => {
  assert.match(src, /<MotionConfig reducedMotion="user">/);
  const opens = (src.match(/<MotionConfig/g) || []).length;
  assert.equal(opens, 1);
  assert.ok(at(src, "<MotionConfig", 0, "config") < at(src, "<AnimatePresence", 0, "presence"), "an animation sits outside the config");
});

test("the deck shows a band and never a score", () => {
  assert.doesNotMatch(src, /matchScore|atsScore/, "the deck reads a score");
  assert.match(src, /bandMarkStyle\(band\)/);   // D60: the band is a mark, never a capsule
});

test("/app lands on Today, and the board keeps /app/jobs", () => {
  // D10: displayed as DAILY DECK; the id and route stay "today".
  assert.match(app, /\{ id: "today",\s+label: "Daily Deck" \}/);
  assert.match(app, /if \(!routeKey\) \{\s*navigate\("\/app\/today", \{ replace:true \}\);/);
  // ⭐ D152 (1), changed on purpose: Today is HOME — the deck is Home's left column (test/d152Home.test.js).
  assert.match(app, /const home = activeTab === "today" \|\| activeTab === "console";/);
  assert.match(app, /<DeckView canUseAPlusResume=\{canUseAPlusResumeHere\} home\/>/);
});

test("a brand-new account is a SET-UP state on Today, never an error", () => {
  // 09-30: the owner's first Google sign-in created a fresh account, and Today said "could not be
  // dealt. no_active_profile". The route now answers 200 with a reason, and the deck explains it.
  const server = fs.readFileSync("server.js", "utf8");
  const route = server.slice(at(server, 'app.get("/api/draft/today"', 0, "deck route"),
                             at(server, "// GET /api/jobs/generic", 0, "next route"))
    .replace(/^\s*\/\/.*$/gm, "");   // code only — the comment quotes the old error by name
  assert.match(route, /if \(!profile\) return noDeal\("no_profile"\);/);
  assert.match(route, /if \(!hasResume\) return noDeal\("no_resume", profile\.id\);/);
  assert.doesNotMatch(route, /no_active_profile/, "the 404 is back");
  for (const r of ["no_profile", "no_resume", "empty"]) assert.match(src, new RegExp(`\\b${r}: \\[`), `the deck has no copy for ${r}`);
});

// ⭐ T32 (10-19 report) · A FAILURE IS A POPUP WITH A REASON, NEVER A SILENT "!". The field report's read ended with an
// orange eye between two "!" marks and no word: T26 had removed the words from the dock, and with them the REASON. Every
// read that does not find the job now raises ONE popup — the outcome's sentence and its code, the one fix, and Details
// (Settings → Developer details). Each failure class, driven through identifyAndBind's own steps (no browser).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { identifyAndBind, readFailurePopup, READ_FAILURE_CODES } from "../extension/identify.js";

const tab = { id: 7, url: "https://careers.example.test/jobs/1" };
const run = (lookupAnswer, text) => identifyAndBind(tab, {
  serverUrl: "https://draft.example.test",
  lookup: async (_u, body) => (typeof lookupAnswer === "function" ? lookupAnswer(body) : lookupAnswer),
  frames: async () => [],
  text: async () => text,
});

test("T32 · no access (the page could not be read): its own code, and Allow — never 'not a job'", async () => {
  const id = await run({ ok: true, posting: null }, { ran: false, text: "" });
  assert.equal(id.outcome, "no_access");
  const p = readFailurePopup(id);
  assert.equal(p.data.code, "no_access");
  assert.match(p.text, /isn't allowed to read this site.*\(no_access\)$/);
  assert.deepEqual(p.actions.map(a => a.id), ["allow-site", "details"]);
});

test("T32 · not a job / server / a script error: each its code, with Retry and Details", async () => {
  const notJob = await run({ ok: true, posting: null }, { ran: true, text: "" });
  assert.equal(readFailurePopup(notJob).data.code, "not_a_job");
  const server = await run({ ok: false, error: "unavailable" }, { ran: true, text: "" });
  assert.equal(readFailurePopup(server).data.code, "unavailable");
  assert.deepEqual(readFailurePopup(server).actions.map(a => a.id), ["retry", "details"]);
  assert.equal(readFailurePopup({ outcome: "script_error", bind: false, message: "Something went wrong." }).data.code, "script_error");
  assert.equal(readFailurePopup({ outcome: "weird", bind: false }).data.code, "script_error", "an unknown outcome is still a code");
});

test("T32 · the working outcomes say their own next step; a bound job raises nothing", async () => {
  const signedOut = readFailurePopup(await run({ ok: false, error: "signed_out" }, null));
  assert.deepEqual(signedOut.actions.map(a => a.id), ["sign-in"]);
  const notOnBoard = readFailurePopup(await run({ ok: true, posting: { title: "Engineer", company: "Northwind" } }, null));
  assert.equal(notOnBoard.data.code, "not_on_board");
  assert.deepEqual(notOnBoard.actions.map(a => a.id), ["capture", "draft"]);
  assert.equal(readFailurePopup({ outcome: "mine", bind: true }), null);
  for (const c of READ_FAILURE_CODES) {
    const p = readFailurePopup({ outcome: c, bind: false, message: "m" });
    assert.ok(p.actions.length <= 2, `${c}: at most two buttons`);
    assert.equal(p.kind, "question", `${c}: it stays until answered`);
  }
});

test("T32 · the panel raises the popup (never the '!'), acts inside the click, and the idle state is ONE eye", () => {
  const src = fs.readFileSync("extension/resumePanel.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /if \(role === 'read'\) \{ say\('Reading this page…'\); return readPage\(r\); \}/);
  const rp = src.slice(src.indexOf("const readPage = async (r) => {"), src.indexOf("const take = (r, reply, fallback) => {"));
  assert.match(rp, /globalThis\.__draftPopups\.show\(\{ \.\.\.reply\.popup/);
  assert.match(rp, /if \(!answer\?\.trusted\) return;/);
  assert.match(rp, /section: 'details'/);
  assert.match(rp, /type: 'DOCK_ACT', act: answer\.action, trigger: 'click'/);
  assert.match(src, /popup: readFailurePopup\(id\)/);
  assert.match(src, /nojob \? `<div class="empty" title="[^"]*">\$\{I\('read', 28\)\}/, "the unread state is the eye, not '!'");
  // the actions the popup offers all exist where the panel sends them
  const bg = fs.readFileSync("extension/background.js", "utf8");
  for (const act of ["'allow-site'", "capture:", "draft:", "'sign-in'"]) assert.ok(bg.includes(act), act);
  assert.match(bg, /SETTINGS_SECTIONS = Object\.freeze\(\[[^\]]*'details'/);
});

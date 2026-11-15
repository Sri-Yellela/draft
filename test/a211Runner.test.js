// ⭐ A211 (1a) (owner 11-15: "automate applications using the users own session … by seeking permission" → "build option
// 1a") · THE RUNNER TAB's rules (extension/runnerModel.js, pure) and the worker's guards (extension/background.js RUNNER_*).
// ⛔ Nothing is sent without the person's press; one press of "Send all" covers exactly the rows that read Ready; only the
// runner page may ask; only A207 extension-submit packets are listed or sent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rowsFromPackets, originPatterns, runnablePage, stateAfterFill, stateAfterSend, sendable, summaryLine, RUNNER_STATES } from "../extension/runnerModel.js";
import { isExtensionSubmitPacket } from "../extension/extensionSubmit.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const at = (s, needle) => { const i = s.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };

const pk = (o) => ({ packetId: 1, jobId: "j", company: "Co", title: "T", applyUrl: "https://jobs.ashbyhq.com/co/1", expectedOrigin: "https://jobs.ashbyhq.com", gateReason: "server_submit_paused", stale: false, ...o });

test("rows: only fresh extension-submit packets with an address become rows, each Waiting", () => {
  const rows = rowsFromPackets([pk({ packetId: 1 }), pk({ packetId: 2, gateReason: "captcha" }), pk({ packetId: 3, stale: true }), pk({ packetId: 4, applyUrl: null })], isExtensionSubmitPacket);
  assert.deepEqual(rows.map(r => r.packetId), [1]);
  assert.equal(rows[0].state, "waiting");
  assert.deepEqual(rows[0].origins, ["https://jobs.ashbyhq.com"]);
  assert.deepEqual(rowsFromPackets(null, isExtensionSubmitPacket), []);
  assert.ok(RUNNER_STATES.includes("needs_you") && Object.isFrozen(RUNNER_STATES));
});

test("permissions asked for are only these applications' own sites — https, or this computer's loopback", () => {
  const rows = rowsFromPackets([pk({ origins: ["https://jobs.ashbyhq.com", "http://evil.example", "not a url"] }), pk({ packetId: 2, origins: ["http://localhost:4123"] })], isExtensionSubmitPacket);
  assert.deepEqual(originPatterns(rows), ["http://localhost/*", "https://jobs.ashbyhq.com/*"]);
  assert.equal(runnablePage("https://x.test/a"), true);
  assert.equal(runnablePage("http://127.0.0.1:9/a"), true);
  assert.equal(runnablePage("http://x.test/a"), false);
  assert.equal(runnablePage("javascript:alert(1)"), false);
});

test("a fill is Ready only when the panel reads Ready AND nothing needs the person", () => {
  assert.equal(stateAfterFill({ ok: true, review: { ready: true }, panel: { needYou: 0, filled: 2, of: 2 } }).state, "ready");
  assert.equal(stateAfterFill({ ok: true, review: { ready: true }, panel: { needYou: 1 } }).state, "needs_you");
  assert.equal(stateAfterFill({ ok: true, review: { ready: false }, panel: { needYou: 0 } }).state, "needs_you");
  assert.equal(stateAfterFill({ ok: false, message: "x" }).state, "failed");
  assert.equal(stateAfterFill(null).state, "failed");
});

test("a send is Sent only on outcome sent; Send all takes only Ready rows with a tab", () => {
  assert.equal(stateAfterSend({ ok: true, outcome: "sent" }).state, "sent");
  assert.equal(stateAfterSend({ ok: false, outcome: "on_form" }).state, "needs_you");
  assert.equal(stateAfterSend({ ok: false, outcome: "refused" }).state, "failed");
  const rows = [{ state: "ready", tabId: 1 }, { state: "ready", tabId: null }, { state: "needs_you", tabId: 2 }, { state: "waiting", tabId: null }];
  assert.deepEqual(sendable(rows), [rows[0]]);
  assert.equal(summaryLine([]), "Nothing is waiting to be sent from your browser.");
  assert.equal(summaryLine(rows), "2 ready · 1 need you · 1 to fill");
});

test("the runner page sends only on a trusted press, and only the sendable rows", () => {
  const js = read("extension/runner.js");
  const send = js.slice(at(js, "$('runner-send').addEventListener"));
  assert.match(send.slice(0, 200), /if \(!e\.isTrusted\) return;/);
  assert.match(send, /const batch = sendable\(rows\);/);
  const fill = js.slice(at(js, "$('runner-fill').addEventListener"), at(js, "$('runner-send').addEventListener"));
  assert.match(fill, /if \(!e\.isTrusted\) return;/);
  assert.match(fill, /chrome\.permissions\.request\(\{ origins \}\)/);
  assert.doesNotMatch(fill, /RUNNER_SEND/, "Fill never sends");
});

test("the worker answers RUNNER_* from runner.html only, sends only a trusted press on its own tab holding an extension-submit packet", () => {
  const bg = read("extension/background.js");
  const block = bg.slice(at(bg, "const runnerTabs = new Map();"), at(bg, "async function openAskWindow(tab) {"));
  assert.match(block, /startsWith\(chrome\.runtime\.getURL\('runner\.html'\)\)/);
  assert.match(block, /if \(!fromRunner\(sender\)\) \{ sendResponse\(\{ ok: false/);
  assert.match(block, /\.filter\(isExtensionSubmitPacket\)/);
  assert.match(block, /if \(!runnablePage\(url\)\)/);
  const sendPart = block.slice(at(block, "if (msg.type === 'RUNNER_SEND')"));
  assert.match(sendPart, /msg\.trusted !== true \|\| !runnerTabs\.has\(tabId\)/);
  assert.match(sendPart, /if \(!isExtensionSubmitPacket\(held\?\.packet\)\)/);
  assert.match(sendPart, /return sendWithPress\(/);
});

test("the runner page wears tokens only and makes no promise it does not keep", () => {
  const html = read("extension/runner.html");
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ""), /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.match(html, /Nothing is sent until you press Send all/);
  assert.doesNotMatch(html, /999px/);
});

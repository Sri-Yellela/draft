// 46a · D183 P4 (owner 11-10: "what about the networking, messaging and feed modules … close them") — the public page's
// "Connect · Message" (D183's spec: "these appear when D180 ships"). Connect shipped with D180 P1; Message is the last piece:
// a link into the app's composer, where the server decides (a connection → the conversation; anyone else → a message
// REQUEST, capped a day, never past a block, never to an only-me page — services/network/messages.js, unchanged).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderPublicProfile } from "../routes/publicProfile.js";

const view = { header: { name: "Ada Example", headline: "Data engineer" }, sections: {} };

test("D183 P4: the public page offers Message beside Connect only while the network is on", () => {
  const on = renderPublicProfile({ view, handle: "ada-example" }, { origin: "https://jobsviadraft.com", connect: true });
  assert.match(on, /<a href="\/app\/network\?connect=ada-example">Connect on draft<\/a>/);
  assert.match(on, /<a data-message="" href="\/app\/network\?message=ada-example">Message<\/a>/);
  const off = renderPublicProfile({ view, handle: "ada-example" }, { origin: "https://jobsviadraft.com", connect: false });
  assert.doesNotMatch(off, /data-message|data-connect/, "network off (or your own page): neither");
  assert.match(off, /data-share=""/, "the Share line stays");
});

test("D183 P4: /app/network?message=<handle> opens the composer, and says when it will arrive as a request", () => {
  const page = fs.readFileSync("client/src/pages/network/NetworkPage.jsx", "utf8");
  assert.match(page, /get\("message"\)/);
  assert.match(page, /if \(messageTo && !off\) setWriting\(messageTo\)/, "the composer opens, it never sends by itself");
  assert.match(page, /data-net-writing-request=""/);
  const svc = fs.readFileSync("services/network/messages.js", "utf8");
  assert.match(svc, /isConnected\(db, me, other\) \? "open" : "request"/, "a non-connection gets a message request");
  assert.match(svc, /isBlocked\(db, me, other\)/);
});

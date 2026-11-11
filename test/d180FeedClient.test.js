// ⭐ D180 P3 + P4 (45r) · the client half: Network's tabs are Feed · Messages · People (the spec's order; People keeps the
// /app/network address); the feed draws links as plain words (never an <a> to a member's link, never a preview); What you
// share is offered; the company page shows "works here" + Ask for a referral only while the network is on.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL(`../client/src/${f}`, import.meta.url), "utf8");

// ⭐ 46f (owner 11-11, on purpose): Feed and Messages left Network's tab row for their own places — Network is People, and
// an old ?tab=feed / ?tab=messages address lands on the new page (test/d180OwnPages46f.test.js has the rest).
test("d180FeedClient: Network is People; its old Feed / Messages tabs redirect to their own pages, and the Feed page draws FeedPane", () => {
  const src = read("pages/network/NetworkPage.jsx");
  assert.doesNotMatch(src, /setTab\(|role="tablist"/, "no tab row");
  assert.match(src, /if \(oldTab === "feed"\) navigate\("\/app\/feed", \{ replace: true \}\)/);
  assert.match(src, /else if \(oldTab === "messages"\) navigate\(params\.get\("thread"\) \? `\/app\/messages\?thread=/);
  assert.match(read("pages/network/FeedPage.jsx"), /<FeedPane share=\{false\} \/>/);
});

test("d180FeedClient: a member's link is plain words, What you share is drawn, delete for own and report for others", () => {
  const src = read("pages/network/FeedPane.jsx");
  assert.match(src, /\{post\.link && <p className="net__quiet feed-link">\{post\.link\}<\/p>\}/);
  assert.doesNotMatch(src, /href=\{post\.link\}/, "never a clickable member link");
  assert.match(src, /<WhatYouShare \/>/);
  assert.match(src, /\{post\.yours\s+\? <button[\s\S]{0,160}Delete this post[\s\S]{0,200}: <button[\s\S]{0,160}Report this post/);
  assert.match(src, /Report this post/);
  assert.doesNotMatch(src, /callModel|anthropic/i);
});

test("d180FeedClient: the company page asks the server who works here, only while the network is on", () => {
  const src = read("pages/companies/CompanyPage.jsx");
  // 45s (on purpose): WorksHere is one shared component now (components/WorksHere.jsx) — the company page mounts it with the switch known.
  assert.match(src, /\{networkOn && <WorksHere company=\{c\.name\} job=\{focus \|\| null\} enabled \/>\}/);
  assert.match(fs.readFileSync("client/src/components/WorksHere.jsx", "utf8"), /\/api\/network\/at-company\?name=/);
  assert.match(fs.readFileSync("client/src/components/WorksHere.jsx", "utf8"), /if \(!r \|\| !r\.count\) return null;/, "nothing drawn when no one works here");
});

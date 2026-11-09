// ⭐ D180 P3 + P4 (45r) · the client half: Network's tabs are Feed · Messages · People (the spec's order; People keeps the
// /app/network address); the feed draws links as plain words (never an <a> to a member's link, never a preview); What you
// share is offered; the company page shows "works here" + Ask for a referral only while the network is on.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(new URL(`../client/src/${f}`, import.meta.url), "utf8");

test("d180FeedClient: Network's tabs are Feed · Messages · People, and Feed draws FeedPane", () => {
  const src = read("pages/network/NetworkPage.jsx");
  const order = [...src.matchAll(/onClick=\{\(\) => setTab\("(\w+)"\)\}/g)].map(m => m[1]);
  assert.deepEqual(order, ["feed", "messages", "people"]);
  assert.match(src, /\{tab === "feed" && <FeedPane \/>\}/);
  assert.match(src, /t === "people" \? "\/app\/network"/, "People stays the default address");
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
  assert.match(src, /\{networkOn && <WorksHere company=\{c\.name\} job=\{focus \|\| null\} \/>\}/);
  assert.match(src, /\/api\/network\/at-company\?name=/);
  assert.match(src, /if \(!r \|\| !r\.count\) return null;/, "nothing drawn when no one works here");
});

// /features — what each tool is for, on the find → fit → apply line, and NOT a feature grid.
// ⛔ Every sentence must be true of the code today. The one this exists to stop: tailoring promising
// "it will not claim anything you did not" while the WORKLOG's CURRENT STATE records that two of two
// real generations added unstated material and the claim guard checks years and seniority only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const src = read("client/src/pages/marketing/FeaturesPage.jsx");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const tools = code.slice(at(code, "export const TOOLS", 0, "tools"), at(code, "export function FeaturesPage", 0, "page"));
const entry = (name) => { const i = at(tools, `name: "${name}"`, 0, name); return tools.slice(i, at(tools, "}", i, `${name} end`)); };

test("⛔ not a feature grid: three stations on the line, no emoji icons, no 'everything you need'", () => {
  assert.deepEqual([...tools.matchAll(/verb: "(\w+)"/g)].map(m => m[1]), ["find", "fit", "apply"]);
  assert.doesNotMatch(code, /icon: "|Everything you need/);
  assert.doesNotMatch(code, /One click fills|at any portal/i, "a promise the product does not keep");
});

test("every tool says what it does AND the one thing it will not do", () => {
  const names = [...tools.matchAll(/name: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(names.length >= 7);
  for (const n of names) {
    const e = entry(n);
    assert.match(e, /does: "[^"]{30,}"/, `${n} has no 'does' sentence`);
    assert.match(e, /wont: "[^"]{20,}"/, `${n} has no 'won't' sentence`);
  }
});

test("⛔ tailoring states what the guard ACTUALLY does — it does not promise to never invent", () => {
  for (const n of ["Tailoring", "A+ résumé"]) {
    assert.doesNotMatch(entry(n), /not claim anything you did not/i, `${n} makes the promise the code does not keep`);
  }
  assert.match(entry("Tailoring"), /years or your seniority/);
  assert.match(entry("Tailoring"), /read every draft before you approve it/);
});

test("the review queue says what it does, with its real exception — not the ditched slogan", () => {
  assert.doesNotMatch(entry("Your review queue"), /Nothing is submitted until you approve it/, "the slogan, ditched 10-01");
  assert.match(entry("Your review queue"), /Only Apply for me, which you switch on, sends without asking/);   // A233 / 46v: the mode's name now (was 'a full-auto run') — changed on purpose
});

test("tier names show only when the monetisation lever is on", () => {
  assert.match(code, /\{monetisationEnabled && t\.tier && \(/);
  for (const tier of ["Basic", "Plus", "Pro"]) assert.match(tools, new RegExp(`tier: "${tier}"`));
});

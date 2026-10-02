import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { companyStackTerms } from "@draft/ats-scorer";

// A64 (10-02): the company stack registry, audited. It is read by ONE thing — the scorer, which
// admits a stack term only when the company's own posting names it — and it is not a source of
// facts about any company.
const reg = JSON.parse(fs.readFileSync("packages/ats-scorer/data/DOMAIN_TOOL_REGISTRY.json", "utf8"));
const entries = Object.entries(reg).filter(([k]) => !k.startsWith("__"));

test("no unsourced negative claims: notStack is gone, and nothing may read it back", () => {
  for (const [k, v] of entries) assert.equal(v.notStack, undefined, `${k} carries notStack again`);
  for (const f of ["packages/ats-scorer/src/vocabulary.js", "packages/ats-scorer/src/scorer.js"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, ""), /\.notStack\b/);
  }
});

test("the header says what reads it, and does not claim to enforce company authenticity", () => {
  assert.match(reg.__comment, /READ BY ONE THING/);
  assert.match(reg.__comment, /NOT a source of facts about a company/);
  assert.doesNotMatch(reg.__comment, /generation model|enforce company authenticity/);
});

test("an audited entry carries its sources; Stripe is AWS + Ruby, not the GCP stack it was given", () => {
  for (const k of ["Stripe", "Airbnb", "Spotify"]) {
    assert.ok(Array.isArray(reg[k].sources) && reg[k].sources.length >= 2, `${k} audited, with sources`);
  }
  const stripe = companyStackTerms("Stripe");
  for (const t of ["AWS", "Ruby", "Sorbet"]) assert.ok(stripe.includes(t), `Stripe has ${t}`);
  for (const t of ["GCP", "Pub/Sub", "BigQuery", "GKE", "Dataflow"]) assert.ok(!stripe.includes(t), `Stripe has no ${t}`);
});

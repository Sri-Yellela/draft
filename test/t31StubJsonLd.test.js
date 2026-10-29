// T31 (10-19 report) · READ NEVER FAILS ENTIRELY — the cause measured on the live page.
//
// The owner pressed Read on a careers site nobody configured (Railway's) and got only a "!". Measured 10-29 in a real
// Chrome with the unpacked build, the site's access granted: the read ran, and said "This page doesn't look like a job
// posting". The page DOES publish a JSON-LD JobPosting — but its description is an SEO stub ("Apply for <role> at
// Railway. Remote (anywhere), full-time."), and extractJobText returned it without looking at the page, so the
// 120-character `ok` gate failed on a real posting. A stub now falls through to the page's own text.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../extension/extractor.js", import.meta.url), "utf8").replace(/^export /gm, "");
const BODY = "Railway is building the infrastructure platform. " + "You will ship product across the stack. ".repeat(30);

function run({ description, main = BODY, host = "railway.example" }) {
  const ld = { "@type": "JobPosting", title: "Senior Full-Stack Engineer", hiringOrganization: { name: "Railway" },
    jobLocationType: "TELECOMMUTE", description };
  const el = (text) => ({ textContent: text, innerText: text });
  const document = {
    title: "Senior Full-Stack Engineer - Careers | Railway",
    querySelectorAll: (sel) => (sel.includes("ld+json") ? [el(JSON.stringify(ld))] : sel.includes("main") ? [el(main)] : []),
    querySelector: () => null,
    createElement: () => { const o = {}; Object.defineProperty(o, "innerHTML", { set(v) { o.innerText = v.replace(/<[^>]+>/g, ""); } }); return o; },
    body: el(main),
  };
  const where = { hostname: host, href: `https://${host}/careers/full-stack` };
  const sandbox = { document, window: { location: where }, location: where };
  vm.runInNewContext(`${src}\nresult = extractJobPayload();`, sandbox);
  return sandbox.result;
}

const STUB = "Apply for Senior Full-Stack Engineer at Railway. Remote (anywhere), full-time.";

test("T31: a JSON-LD JobPosting with a stub description is still a job — the page's own text is the description", () => {
  const r = run({ description: STUB });
  assert.equal(r.ok, true, "a real posting with an SEO-stub description was called not-a-job");
  assert.match(r.text, /You will ship product across the stack\./);
});

test("T31: a full JSON-LD description still wins, the page is not read instead", () => {
  const full = "<p>" + "Own the deploy pipeline end to end. ".repeat(10) + "</p>";
  const r = run({ description: full });
  assert.equal(r.ok, true);
  assert.match(r.text, /Own the deploy pipeline/);
  assert.doesNotMatch(r.text, /You will ship product/);
});

test("T31: a stub with no page text behind it is still not a job (the gate is unchanged)", () => {
  const r = run({ description: STUB, main: "" });
  assert.equal(r.ok, false);
});

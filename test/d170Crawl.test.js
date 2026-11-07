// ⭐ D170 (4) · THE CRAWL'S FAILURES IN ONE 11-06 RUN, FIXED AT THEIR CAUSE.
//   · ≈ 35 Lever companies timed out ("timeout of 8000ms exceeded": Palantir, Shield AI, Getty Images, …) — every
//     board fetched at once at an 8 s timeout, not 35 broken companies. Now: at most LEVER_CONCURRENCY in flight,
//     a 15 s timeout, two retries with backoff on a transient failure (never on a 404 / 403).
//   · Workday Broadcom failed WHOLE on "normalizeJob: title is required" — one bad posting threw out of the
//     company's .map(). Now each posting is normalised on its own; the bad ones are skipped and counted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeEach, isTransientFetchError, withRetry, settleWithLimit } from "../services/jobs/sources/base.js";
import { fetchCompanyJobs as leverFetch } from "../services/jobs/sources/lever.js";
import { fetchCompanyJobs as greenhouseFetch } from "../services/jobs/sources/greenhouse.js";
import { normalizeWorkdayJob } from "../services/jobs/sources/workday.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const quiet = { warn() {} };
const timeoutErr = () => Object.assign(new Error("timeout of 15000ms exceeded"), { code: "ECONNABORTED" });

test("d170LeverTimeoutsRetryWithBackoff: a timeout is retried with growing waits, then succeeds", async () => {
  const waits = [];
  let calls = 0;
  const v = await withRetry(async () => { calls++; if (calls < 3) throw timeoutErr(); return "ok"; },
    { retries: 2, baseMs: 100, sleep: async (ms) => { waits.push(ms); }, random: () => 0.5 });
  assert.equal(v, "ok"); assert.equal(calls, 3);
  assert.deepEqual(waits, [100, 200], "base · 2^n (jitter centred)");
  // gives up after `retries` more attempts
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw timeoutErr(); }, { retries: 2, sleep: async () => {} }), /timeout/);
  assert.equal(n, 3);
});

test("d170LeverTimeoutsRetryWithBackoff: a 404 / 403 is never retried; 429 and 5xx are", async () => {
  const http = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
  assert.equal(isTransientFetchError(http(404)), false);
  assert.equal(isTransientFetchError(http(403)), false);
  assert.equal(isTransientFetchError(http(429)), true);
  assert.equal(isTransientFetchError(http(503)), true);
  assert.equal(isTransientFetchError(timeoutErr()), true);
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw http(404); }, { sleep: async () => {} }));
  assert.equal(n, 1, "a removed board is not hammered");
});

test("d170LeverTimeoutsRetryWithBackoff: Lever's fetch retries through the injected client, at the 15 s timeout", async () => {
  let calls = 0; const seen = [];
  const http = { get: async (url, opts) => { calls++; seen.push(opts.timeout); if (calls === 1) throw timeoutErr();
    return { data: [{ id: "p1", text: "Software Engineer", hostedUrl: "https://jobs.lever.co/acme/p1", categories: {}, createdAt: Date.now() }] }; } };
  const jobs = await leverFetch("acme", "Acme", [], { http, retry: { sleep: async () => {} } });
  assert.equal(calls, 2); assert.deepEqual(seen, [15000, 15000]);
  assert.equal(jobs.length, 1);
});

test("d170GreenhouseRetriesAndSkipsBadRow: a transient failure is retried at the 15 s timeout; a 404 is not; one bad posting is skipped, not the board", async () => {
  let calls = 0; const seen = [];
  const good = { id: 1, title: "Software Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/1", location: { name: "New York, NY" }, content: "&lt;p&gt;Build things&lt;/p&gt;", first_published: "2026-11-01T00:00:00Z" };
  const http = { get: async (url, opts) => { calls++; seen.push(opts.timeout); if (calls === 1) throw timeoutErr();
    return { data: { jobs: [good, { id: 2, title: "", absolute_url: "https://boards.greenhouse.io/acme/jobs/2" }] } }; } };
  const warned = [];
  const origWarn = console.warn; console.warn = (m) => warned.push(String(m));
  let jobs;
  try { jobs = await greenhouseFetch("acme", "Acme", [], { http, retry: { sleep: async () => {} } }); } finally { console.warn = origWarn; }
  assert.equal(calls, 2, "the timeout was tried again");
  assert.deepEqual(seen, [15000, 15000]);
  assert.equal(jobs.length, 1, "the posting with no title is skipped; the company's other posting is kept");
  assert.ok(warned.some(w => /\[greenhouse\] skipped 1 of 2 posting\(s\) for "Acme"/.test(w)));
  let notFound = 0;
  const gone = { get: async () => { notFound++; const e = new Error("Request failed with status code 404"); e.response = { status: 404 }; throw e; } };
  await assert.rejects(greenhouseFetch("gone", "Gone", [], { http: gone, retry: { sleep: async () => {} } }));
  assert.equal(notFound, 1, "a 404 is a moved / removed board — never retried");
  const src = read("services/jobs/sources/greenhouse.js");
  assert.match(src, /await settleWithLimit\(_companies, GREENHOUSE_CONCURRENCY\(\),/);
  assert.doesNotMatch(src, /Promise\.allSettled/, "every company at once is what timed out");
});

test("d170: at most `limit` companies are fetched at once, results in input order", async () => {
  let inFlight = 0, peak = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);
  const res = await settleWithLimit(items, 6, async (i) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(r => setTimeout(r, 2 + (i % 3)));
    inFlight--;
    if (i === 7) throw new Error("boom");
    return i * 10;
  });
  assert.equal(peak, 6);
  assert.deepEqual(res.map(r => r.status === "fulfilled" ? r.value : "x"), items.map(i => (i === 7 ? "x" : i * 10)));
  const lever = read("services/jobs/sources/lever.js");
  assert.match(lever, /await settleWithLimit\(_companies, LEVER_CONCURRENCY\(\),/);
  assert.match(lever, /envInt\('LEVER_TIMEOUT_MS', 15000\)/);
});

test("d170WorkdaySkipsBadRow: a posting with no title is skipped and counted — the company's other postings are kept", () => {
  const warned = [];
  const postings = [
    { title: "Software Engineer", externalPath: "/job/a", bulletFields: ["R1"] },
    { title: "", externalPath: "/job/b", bulletFields: ["R2"] },
    { title: "Data Engineer", externalPath: "/job/c", bulletFields: ["R3"] },
  ];
  const jobs = normalizeEach(postings, j => normalizeWorkdayJob(j, "Broadcom", "https://broadcom.wd1.myworkdayjobs.com/x"),
    { source: "workday", company: "Broadcom", log: { warn: (m) => warned.push(m) } });
  assert.deepEqual(jobs.map(j => j.title), ["Software Engineer", "Data Engineer"]);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /\[workday\] skipped 1 of 3 posting\(s\) for "Broadcom" — normalizeJob: title is required/);
  assert.match(read("services/jobs/sources/workday.js"), /return normalizeEach\(jobs\.filter/);
  assert.deepEqual(normalizeEach([], () => 1, { log: quiet }), []);
});

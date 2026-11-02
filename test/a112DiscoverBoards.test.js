import test from "node:test";
import assert from "node:assert/strict";
import { HOSTS, slugOf, blocksFor } from "../scripts/a112DiscoverBoards.mjs";

// A112 (11-02): the crawler boost reads board URLs out of the Common Crawl index. A URL is only a candidate — these pin
// how one becomes an (atsType, slug), and which index blocks are read for a host.

const gh = HOSTS.greenhouse[0], lever = HOSTS.lever[0], ashby = HOSTS.ashby[0], wd = HOSTS.workday[0], rc = HOSTS.recruitee[0];

test("A112: a board URL names its slug; a job page under it names the same slug", () => {
  assert.equal(slugOf("greenhouse", gh, "https://boards.greenhouse.io/stripe"), "stripe");
  assert.equal(slugOf("greenhouse", gh, "https://boards.greenhouse.io/stripe/jobs/123456"), "stripe");
  assert.equal(slugOf("greenhouse", gh, "https://boards.greenhouse.io/embed/job_board?for=acmeco"), "acmeco");
  assert.equal(slugOf("lever", lever, "https://jobs.lever.co/palantir/abc-def?lever-source=x"), "palantir");
  assert.equal(slugOf("ashby", ashby, "https://jobs.ashbyhq.com/Harvey%20Labs/1234"), "Harvey");
  assert.equal(slugOf("recruitee", rc, "https://acme.recruitee.com/o/designer"), "acme");
});

test("A112: Workday URLs become the crawler's 'N|tenant|site', the locale skipped", () => {
  assert.equal(slugOf("workday", wd, "https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced/job/x"), "5|adobe|external_experienced");
  assert.equal(slugOf("workday", wd, "https://amgen.wd1.myworkdayjobs.com/Careers"), "1|amgen|Careers");
  assert.equal(slugOf("workday", wd, "https://amgen.wd1.myworkdayjobs.com/wday/cxs/amgen/Careers/jobs"), "");
  assert.equal(slugOf("workday", wd, "https://amgen.wd1.myworkdayjobs.com/robots.txt"), "");
  assert.equal(slugOf("workday", wd, "https://www.myworkdayjobs.com/"), "");
});

test("A112: not a board — API paths, assets and portfolio boards are refused", () => {
  assert.equal(slugOf("greenhouse", gh, "https://boards.greenhouse.io/favicon.ico"), "");
  assert.equal(slugOf("greenhouse", gh, "https://boards.greenhouse.io/embed/job_app?token=1"), "");
  assert.equal(slugOf("ashby", ashby, "https://jobs.ashbyhq.com/api/non-user-graphql"), "");
  assert.equal(slugOf("ashby", ashby, "https://jobs.ashbyhq.com/pear-vc"), "");      // D80: one slug, many employers
  assert.equal(slugOf("lever", lever, "not a url"), "");
});

test("A112: the blocks read for a prefix — the one before the first match, then every match", () => {
  const lines = ["co,example)/", "co,lever,jobs)/a", "co,lever,jobs)/m", "co,lever,jobs)/z", "co,lightning)/"].map((key, i) => ({ key, i }));
  assert.deepEqual(blocksFor(lines, "co,lever,jobs)/").map((b) => b.i), [0, 1, 2, 3]);
  assert.deepEqual(blocksFor(lines, "com,ashbyhq,jobs)/").map((b) => b.i), [4]);
});

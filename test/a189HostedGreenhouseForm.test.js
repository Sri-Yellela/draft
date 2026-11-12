import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { hostedFormUrl } from "../services/jobs/applicationSchema.js";
import { detectPlatformFromUrl } from "../services/platformDetector.js";

// ⛔ A189 P4 (owner 11-11: "one wasn't attempted saying draft can't fill this"). Production 20:02:41Z: greenhouse::8036943's
// résumé was made and no browser ever launched — a Greenhouse posting whose stored link is the employer's careers page
// (?gh_jid=) reads as provider "generic" and was held provider_review_only. Synthetic company and ids.

function db() {
  const d = new Database(":memory:");
  d.exec("CREATE TABLE company_ats_list (company TEXT, ats_type TEXT, ats_slug TEXT)");
  d.prepare("INSERT INTO company_ats_list VALUES ('Example Co', 'greenhouse', 'exampleco')").run();
  return d;
}

test("a189 P4: an employer-hosted Greenhouse page opens at Greenhouse's embed form", () => {
  const job = { source: "greenhouse", company: "Example Co", req_uid: "greenhouse:example co:8036943",
    url: "https://careers.example.com/jobs?gh_jid=8036943", apply_url: null };
  assert.equal(detectPlatformFromUrl(job.url), "generic", "precondition: the stored link reads as an unknown site");
  const u = hostedFormUrl(db(), job);
  assert.equal(u, "https://job-boards.greenhouse.io/embed/job_app?for=exampleco&token=8036943");
  assert.equal(detectPlatformFromUrl(u), "greenhouse");
});

test("a189 P4: no board token, another ATS, or a non-numeric id -> null (nothing changes)", () => {
  const d = db();
  assert.equal(hostedFormUrl(d, { source: "greenhouse", company: "Unknown Co", url: "https://x.example/jobs?gh_jid=1234" }), null);
  assert.equal(hostedFormUrl(d, { source: "lever", company: "Example Co", url: "https://jobs.lever.co/x/abc" }), null);
  assert.equal(hostedFormUrl(d, { source: "greenhouse", company: "Example Co", url: "https://x.example/jobs?gh_jid=abc" }), null);
});

test("a189 P4: the run uses it only when the stored link reads as generic, and never over a practice form", () => {
  const src = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8");
  assert.match(src, /const hostedUrl = [^\n]*detectPlatformFromUrl\(storedUrl\) === "generic" \? hostedFormUrl\(db, job\)/);
  assert.match(src, /const jobUrl = practiceUrl \|\| attributedUrl\(job, hostedUrl \|\| storedUrl\);/,
    "a practice form wins; the hosted form keeps D185-7's attribution");
});

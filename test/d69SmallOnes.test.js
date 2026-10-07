// ⭐ D69 · THREE SMALL ONES — (c) "I submitted" keeps only the id-type query parameters (owner, 10-07).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { evidenceUrlOf } from "../services/evidenceUrl.js";

test("⛔ D69 (c) · a token, a utm_*, a gclid and an email never reach the evidence row; the application's ids do", () => {
  const u = evidenceUrlOf("https://boards.greenhouse.io/northwind/jobs/4012/confirmation?gh_jid=4012&utm_source=li&gclid=Cj0K&session=eyJhbGciOiJIUzI1NiJ9.x.y&email=ada%40example.invalid#done");
  assert.equal(u, "https://boards.greenhouse.io/northwind/jobs/4012/confirmation?gh_jid=4012");
  assert.equal(evidenceUrlOf("https://apply.example.com/thanks?jobId=R-1234&applicationId=a_99&sid=abc"),
    "https://apply.example.com/thanks?jobId=R-1234&applicationId=a_99");
  assert.equal(evidenceUrlOf("https://job-boards.greenhouse.io/embed/job_app?token=4012345"), "https://job-boards.greenhouse.io/embed/job_app?token=4012345",
    "Greenhouse's embed carries the job id as a numeric token");
  assert.equal(evidenceUrlOf("https://x.example.com/done?token=a9f8e7d6c5"), "https://x.example.com/done", "a token that is not a job number is a secret");
  assert.equal(evidenceUrlOf("https://x.example.com/done?jobId=ada@example.invalid"), "https://x.example.com/done", "an id-named parameter holding an email is dropped");
  assert.equal(evidenceUrlOf("javascript:alert(1)"), null);
});

test("D69 (c) · the route stores the filtered URL, and the policy says so", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /evidenceUrl: evidenceUrlOf\(url\) \|\| url\.split\(\/\[\?#\]\/\)\[0\]/);
  assert.doesNotMatch(src, /evidenceUrl: url \}/, "the raw page URL is never the evidence");
  const policy = fs.readFileSync("client/src/pages/marketing/PrivacyPage.jsx", "utf8").replace(/\s+/g, " ");
  assert.match(policy, /only the parts of the query that identify the application/);
  assert.match(policy, /dropped before it is stored/);
});

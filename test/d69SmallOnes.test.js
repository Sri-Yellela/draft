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

test("⛔ D69 (a) · a SpeedyApply export's \"Archived\" imports as WITHDRAWN — and only in the import", async () => {
  const { readImport, guessMapping, parseCsv } = await import("../shared/applicationCsv.js");
  const { normaliseOutcome } = await import("../shared/applicationResponse.js");
  const csv = "Company,Job Title,Date Applied,Status\nNorthwind,Platform Engineer,2026-09-01,Archived\nContoso,Data Engineer,2026-09-02,Applied\n";
  const mapping = guessMapping(parseCsv(csv)[0]);
  const out = readImport(csv, mapping, { now: Math.floor(Date.UTC(2026, 9, 7) / 1000) });
  const byCo = Object.fromEntries((out.candidates || []).map(c => [c.company, c.outcome]));
  assert.deepEqual(byCo, { Northwind: "withdrawn", Contoso: null }, JSON.stringify(out));
  assert.equal(normaliseOutcome("archived"), undefined, "not a global alias — elsewhere 'archived' is not an outcome");
});

// D69 (b): measured in Chrome by scripts/d69NavPass.mjs — at 360, 390, 440 and 1280 every tab fits with
// no scrolling, inside the bar and clear of the avatar. This pins the rule that made it fit.
test("⛔ D69 (b) · on a phone the tabs stack their words, so all four fit at 390px (and 360) — no scrolling", () => {
  const src = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");
  assert.match(src, /const tiny = vw < 440;/);
  // ⭐ D92: the phone tier is CSS now (TopBar.css, the nav's data-size), the same values.
  assert.match(src, /data-size=\{tiny \? "tiny" : narrow \? "narrow" : "wide"\}/);
  const css = fs.readFileSync("client/src/components/TopBar.css", "utf8");
  assert.match(css, /\.tbar-nav\[data-size="tiny"\] \.tbar-tab \{ padding: 3px 4px; border-radius: 8px; font-size: 11px; white-space: normal; width: min-content; \}/);
  assert.match(css, /\.tbar-tab \{[^}]*white-space: nowrap;[^}]*font-size: 12px;/);
});

// D68 · the Copy sheet compliance check (PRIVACY_RECONCILIATION § D68) — the two fixes it needed, pinned.
test("⛔ D68 · the policy names the Copy sheet and carries the Web Store Limited Use affirmation", () => {
  const policy = fs.readFileSync("client/src/pages/marketing/PrivacyPage.jsx", "utf8").replace(/<[^>]+>/g, " ").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  assert.match(policy, /Copy sheet shows your own prepared answers — including any work-authorisation or voluntary self-identification answers you saved/);
  assert.match(policy, /we do not record what you copied/);
  assert.match(policy, /adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements/);
  const popup = fs.readFileSync("extension/popup.js", "utf8");
  assert.equal([...popup.matchAll(/navigator\.clipboard\.writeText/g)].length, 1, "one clipboard write");
  assert.match(popup, /copy\.addEventListener\('click', async \(\) => \{\s*try \{ await navigator\.clipboard\.writeText\(row\.value\)/, "and only on a click");
  assert.match(fs.readFileSync("extension/submission/PRIVACY_RECONCILIATION.md", "utf8"), /## ⭐ D68 · THE COPY SHEET, CHECKED/);
});

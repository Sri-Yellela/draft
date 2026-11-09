// D112 item 3 (owner 10-30) · the privacy text for D100 (the apply service), D101 (the profile), D103 (the inbox),
// D112 item 2 (Gmail) and D112 item 4 (global read), applied to the live page in one push. Each pin reads the PROSE a
// user sees (comments stripped first — a comment explaining a change must never satisfy the check for it).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { INBOX_RETENTION_DEFAULT_DAYS } from "../services/inbox.js";

const src = fs.readFileSync("client/src/pages/marketing/PrivacyPage.jsx", "utf8").replace(/\r\n/g, "\n");
const prose = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/[^\n]*$/gm, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\{["']\s*["']\}/g, " ")
  .replace(/\s+/g, " ");
const recon = fs.readFileSync("extension/submission/PRIVACY_RECONCILIATION.md", "utf8").replace(/\s+/g, " ");

test("D112 · one EFFECTIVE_DATE, the push day, with its change-log entry", () => {
  assert.equal((src.match(/const EFFECTIVE_DATE = /g) || []).length, 1);
  // Moved on purpose 11-08 (45n push, owner decision (5)) — the D112 entry below stays in the change log.
  assert.match(src, /const EFFECTIVE_DATE = 'November 8, 2026';/);
  assert.match(src, /\/\/ November 8, 2026 \(owner, 11-08 — 45n/, "the newest change-log comment");
  assert.match(src, /\/\/ October 31, 2026 \(owner, 10-30 — D112 item 3/, "the change-log comment the file's convention uses");
});

test("D112 · the inbox period in the policy is the sweep's default", () => {
  assert.equal(INBOX_RETENTION_DEFAULT_DAYS, 180);
  assert.match(prose, new RegExp(`Inbox messages are deleted ${INBOX_RETENTION_DEFAULT_DAYS} days \\(6 months\\) after they arrive`));
  assert.match(prose, /attachments are never stored/);
  assert.match(prose, /no AI model reads your mail/);
});

test("D112 · the apply service: SEMI default, sealed sessions draft cannot read, the never list", () => {
  assert.match(prose, /SEMI \(the default/);
  assert.match(prose, /draft's own servers store it only in that sealed form and cannot read it/);
  assert.match(prose, /your own email address/);
  assert.match(prose, /never answers a CAPTCHA or other human check, and never guesses an eligibility answer/);
  assert.match(prose, /within 10 minutes of asking for it/);
});

test("D112 item 2 · Gmail: gmail.readonly, only matching messages, text only, disconnect revokes, Limited Use verbatim", () => {
  assert.match(prose, /gmail\.readonly/);
  assert.match(prose, /only for messages from applicant-tracking systems and from the companies of your own applications/);
  assert.match(prose, /never reads, lists or keeps the rest of your mailbox/);
  assert.match(prose, /text only .{0,40}never an attachment/);
  assert.match(prose, /Disconnect .{0,40}revokes draft's access with Google and stops intake at once/);
  // Google's own example affirmation (Workspace API User Data and Developer Policy), with its two links.
  assert.match(prose, /The use of information received from Google Workspace scopes will adhere to the Google User Data Policy , including the Limited Use requirements \./);
  assert.match(src, /href="https:\/\/developers\.google\.com\/terms\/api-services-user-data-policy"/);
  assert.match(src, /href="https:\/\/developers\.google\.com\/terms\/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"/);
  assert.doesNotMatch(prose, /we send Google nothing at all/, "Google is a recipient again once Gmail is connected");
});

test("D112 item 4 · global read: asked once; a non-posting sends nothing, not even a hash; irrelevant discarded; never the three", () => {
  assert.match(prose, /Reading Job Postings on Any Site \(optional, asked once\)/);
  assert.match(prose, /A page that is not a posting sends nothing — not the page, not its address, not a hash of it/);
  assert.match(prose, /An irrelevant posting is discarded and not stored/);
  assert.match(prose, /never reads LinkedIn, Indeed or Glassdoor/);
  assert.match(prose, /Not now asks Chrome nothing/);
  assert.doesNotMatch(prose, /It never asks for every site/, "retracted: the one-time choice does ask for every site");
});

test("D112 · the reconciliation carries the rows, and names the new recipients", () => {
  assert.match(recon, /## ⭐ D112 · THE APPLY SERVICE, THE INBOX, GMAIL AND GLOBAL READ/);
  for (const name of ["Our apply service", "Employer portals you apply to", "Google \\(Gmail\\)"]) {
    assert.match(recon, new RegExp(`\\| \\*\\*${name}\\*\\* \\|`), `${name} in the third-party table`);
  }
  assert.match(recon, /180 days/);
});

test("D112 item 8 · Notifications: optional and per event, encrypted to the browser, no company or value, email by choice, off deletes", () => {
  assert.match(prose, /Notifications /);
  assert.match(prose, /Browser push notifications are optional and chosen per event/);
  assert.match(prose, /in Account → Notifications/);
  assert.match(prose, /encrypted end to end to your browser/);
  assert.match(prose, /browser maker's push service \(Google, Mozilla, Microsoft or Apple\), which can see only that a message was sent/);
  assert.match(prose, /A notification never names a company or shows a value/);
  assert.match(prose, /Email copies are sent only for the events you turn email on for/);
  assert.match(prose, /Turning push off, or your browser unsubscribing, deletes that browser's subscription/);
  assert.match(src, /<Strong>Your browser's push service<\/Strong> \(only if you turn on push notifications\)/, "named as a recipient");
  assert.match(recon, /\| \*\*Notifications — Web Push\*\* \(D112 item 8\)/);
  assert.match(recon, /\| \*\*Your browser's push service\*\* \|/);
});

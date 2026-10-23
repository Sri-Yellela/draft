// J2 · THE EXTENSION BROWSER HARNESS BOOTS AND READS (test-support/extensionBrowser.mjs).
// The real extension (test build) in a real Chrome, the real routes, the Workday-shaped fixture: a capture binds the
// tab, Prepare fills and the wizard waits, the candidate's × ends it, the review panel and the Copy sheet are READ,
// storage is read, the theme switches, a reload keeps the binding, the step changes without the URL, nothing is
// submitted and the password sentinel never leaves the page. Skips, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome, launchExtensionBrowser, OWNER_STAGE, waitUntil, BUSY_MS } from "../test-support/extensionBrowser.mjs";

const chrome = await findChrome();

test("the harness boots the real extension, drives the fixture and reads the review panel and the Copy sheet", { skip: chrome.skip || false, timeout: 180000 }, async (t) => {
  const h = await launchExtensionBrowser();
  t.after(() => h.close());
  await h.open(OWNER_STAGE);
  assert.equal(await h.step(), "myInformation");

  const cap = await h.capture();
  assert.equal(cap?.success, true, cap?.message);
  const binds = await h.bindings();
  assert.equal(binds.length, 1, "chrome.storage.session read: the tab is bound");

  // Prepare: fills, then the wizard waits for the candidate — the harness does not hang on it
  const prep = await h.prepare({ timeoutMs: 6000 });
  assert.equal(prep.pending, true, "the wizard is waiting for the candidate on the required fields");
  const badge = await waitUntil(() => h.readBadge().then(b => (b?.state === "required" ? b : null)), BUSY_MS);
  assert.ok(badge?.missing > 0, JSON.stringify(badge));
  assert.equal(await h.dismissBadge(), true);
  const reply = await prep.reply;
  assert.equal(reply.ok, true, reply.message);

  // the review panel, read
  const panel = await h.waitForPanel();
  assert.ok(panel, "the review panel is on the page");
  // J4 (D96 §5): the progress line — every field on the step is listed, so the unfilled required ones show too.
  assert.match(panel.subtitle, /^3 of \d+ filled · \d+ needs? you · \d+ to check/);
  assert.ok(panel.rows.some(r => /^First Name/.test(r.label) && r.value === "Ada"), JSON.stringify(panel.rows));
  assert.ok(panel.state, "the state line is read");
  assert.doesNotMatch(panel.text, /#rm-gate-review-overlay|\{/, "the panel's text excludes its stylesheet");

  // both themes: the panel's computed surface changes with prefers-color-scheme — ⭐ T26: the DOCK's frame is the one
  // surface the panel sits on (the view paints none of its own)
  const bg = () => h.page.evaluate(() => getComputedStyle(document.getElementById("rm-draft-dock").shadowRoot.querySelector(".fr")).backgroundColor);
  const light = await bg();
  assert.equal(await h.setTheme("dark"), "dark");
  const dark = await bg();
  assert.notEqual(light, dark, "light and dark paint differently");
  await h.setTheme("light");

  // the step changes, the URL does not; the Copy sheet is read
  const url = h.page.url();
  assert.equal(await h.next(), "myExperience");
  assert.equal(h.page.url(), url);
  assert.equal((await h.openCopySheet())?.ok, true);
  const sheet = await h.waitForCopySheet();
  assert.equal(sheet.sub, "Software Engineer at Zoom · prepared answers");
  assert.ok(sheet.rows.some(r => r.label === "First Name" && r.value === "Ada"), JSON.stringify(sheet.rows));

  // storage.local is readable; a reload returns to My Information and keeps the binding
  assert.equal(typeof (await h.storage.local()), "object");
  await h.reload();
  assert.equal(await h.step(), "myInformation");
  assert.equal((await h.bindings()).length, 1, "the binding survives a reload");

  // ⛔ guarded controls untouched, nothing submitted, the password sentinel never left the page
  await h.goStep("signIn");
  const g = await h.guarded();
  assert.equal(g.consentTicked, false);
  assert.equal(g.signatureName, "");
  assert.equal(g.passwordIntact, true);
  assert.equal((await h.leaked()).leaked, false);
  assert.ok((await h.leaked("R19749")).inRequests.length > 0, "the detector works: the capture DID send the page's address");
  assert.equal((await h.submissions()).length, 0);
  assert.equal(await h.submitPressed(), 0);
});

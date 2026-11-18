// 46v 0d (owner 11-18: "update all the marketing pages and login pages to reflect current design and feature list"):
// before the redesign, the claims that were FALSE against the code were corrected. These keep them from coming back.
//   - the job sources: draft reads employers' ATS boards and careers pages (services/jobs/aggregator.js, crawlerPage.js);
//     Indeed is not a source, and "we do not scrape" was untrue.
//   - "nothing is sent until you approve it" without the exception: Apply for me sends within the person's limits.
//   - the extension: read / prepare run after one consent (extension/autoRead.js); it submits on the person's press (A207).
//   - "nothing is sent anywhere" where a résumé IS sent to draft's server (it is parsed and not kept).
//   - the retired mode names SEMI / FULL AUTO on the Privacy page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const visible = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

test("46v · the FAQ names the real sources and no longer says draft doesn't scrape", () => {
  const faq = visible(read("client/src/pages/marketing/FAQPage.jsx"));
  assert.doesNotMatch(faq, /do not scrape/i);
  assert.doesNotMatch(faq, /Adzuna and Indeed/);
  assert.match(faq, /Greenhouse, Lever, Ashby, Workday/);
  assert.match(faq, /In Apply for me, which you switch on/, "the auto-apply answer names the mode that sends");
});

test("46v · the extension page and Features say what the extension really does", () => {
  const ext = visible(read("client/src/pages/marketing/ExtensionPage.jsx"));
  assert.doesNotMatch(ext, /Nothing runs in the background/);
  assert.doesNotMatch(ext, /never presses submit/i);
  assert.match(ext, /submits only when you press Submit application/);
  const fe = visible(read("client/src/pages/marketing/FeaturesPage.jsx"));
  assert.doesNotMatch(fe, /never presses the final button/);
  assert.doesNotMatch(fe, /Inside a job's card, once you sign in/, "the A+ résumé has no button on the card");
});

test("46v · no screen says a résumé is 'sent nowhere'; Privacy uses the modes' names", () => {
  for (const f of ["client/src/components/SignupAtsHook.jsx", "client/src/panels/DeckView.jsx"]) {
    assert.doesNotMatch(visible(read(f)), /nothing is sent anywhere/, f);
  }
  const privacy = visible(read("client/src/pages/marketing/PrivacyPage.jsx"));
  assert.doesNotMatch(privacy, /<Strong>(SEMI|FULL AUTO)<\/Strong>|\(FULL AUTO\)|FULL AUTO setting/);
});

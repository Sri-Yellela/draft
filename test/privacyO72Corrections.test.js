import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

// O72(b), 2026-10-05: the privacy page described five things that were not so. This is a legal
// surface on a product that stores special-category data (ethnicity, disability, veteran status),
// and a policy that describes flows that do not exist is the first thing a regulator reads. Each
// test below fails if its false claim comes back.
//
// ⛔ Assertions run on the PROSE a reader sees, with source comments stripped first (the lesson in
// test/privacyReconciliation.test.js: a comment explaining a change can otherwise satisfy an
// assertion about the user-facing text). The one exception is test 5, which is about a comment.

const policy = fs.readFileSync("client/src/pages/marketing/PrivacyPage.jsx", "utf8").replace(/\r\n/g, "\n");
const prose = policy
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/[^\n]*$/gm, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\{"\s*"\}/g, " ")
  .replace(/\s+/g, " ");
// Sentences, roughly. Good enough to ask "does any sentence pair these two words without a negation".
const sentences = prose.split(/(?<=[.:;])\s+/);
const NEGATED = /\b(not|no|never|nothing)\b/i;

test("O72b·1 — no sentence says job descriptions go to Anthropic for ATS scoring", () => {
  for (const s of sentences) {
    if (/Anthropic/.test(s) && /ATS (scor|analys)/i.test(s)) {
      assert.match(s, NEGATED, `the policy pairs Anthropic with ATS scoring again: "${s.trim()}"`);
    }
  }
  assert.doesNotMatch(prose, /for\s+ATS scoring or resume generation/i);
  assert.match(prose, /not sent anywhere to be scored/i,
    "the extension section must say a captured job description is not sent anywhere to be scored");
});

test("O72b·2 — the tools service does not read uploaded PDFs, and there is no fallback", () => {
  assert.doesNotMatch(prose, /reads uploaded résumé PDFs/i);
  assert.doesNotMatch(prose, /résumé text or PDF/i);
  assert.doesNotMatch(prose, /falls back to extraction/i);
  assert.match(prose, /does not read résumé PDFs you upload/i);
  assert.match(prose, /our own server extracts their text, and the PDF is not sent anywhere/i);
});

test("O72b·3 — Anthropic is not described as doing ATS analysis", () => {
  assert.doesNotMatch(prose, /ATS analysis/i);
});

test("O72b·4 — the Anthropic paragraph names cover letters (direct) and the wizard's suggestions", () => {
  assert.match(prose, /Cover letters: .*?sent from our server directly to Anthropic, not through the tools service/i,
    "cover-letter material reaches Anthropic from draft directly, and the policy must say so");
  assert.match(prose, /Load more AI suggestions/);
  assert.match(prose, /the domain and role family you picked, and the keywords, action verbs and tools you have already chosen/i,
    "the policy must say what the suggestions call sends: domain, role family and the chips already chosen");
});

test("O72b·4 — the suggestions disclosure stands or falls with the feature (O72a)", () => {
  // O72(a) may drop or replace the button. Whichever way it goes, the policy and the code must
  // move together: a disclosure of a call that no longer exists is the same defect this fixed.
  const route = fs.readFileSync("routes/domainProfiles.js", "utf8");
  const wizard = fs.readFileSync("client/src/components/DomainProfileWizard.jsx", "utf8");
  const routeCallsModel = /router\.post\("\/generate-chips"[\s\S]*?callModel\(/.test(route);
  const wizardLabel = /Load more AI suggestions/.test(wizard);
  const disclosed = /Load more AI suggestions/.test(prose);
  assert.equal(disclosed, routeCallsModel,
    routeCallsModel ? "the chip-suggestion route still calls the model and the policy no longer discloses it"
                    : "the chip-suggestion route no longer calls the model; remove its disclosure from the policy");
  assert.equal(wizardLabel, routeCallsModel,
    "the wizard's 'AI' label and the model call must change together (O72a)");
});

test("O72b·5 — the effective-date comment no longer says PDF reading lives in the tools service", () => {
  assert.doesNotMatch(policy, /generation, enhancement and PDF reading moved to the résumé tools service/,
    "the A4 comment still says PDF reading moved to the tools service without the A80 V1 correction");
  assert.match(policy, /A80 V1 — draft reads\s*\n?\/\/\s*an uploaded PDF's text layer itself/);
  // Moved again on 10-07 (the v1.5.0 release, F 1) , 10-08 (D86), 10-09 (the release check) and 10-13 (v1.5.2: the tab
  // binding is a new stored item) and 10-14 (D96–D98: answer memory, the attached PDF, automatic reading) and 10-15
  // (T14: a job's page addresses kept locally; T11: an embedded form's frame address sent on a fill) — never back
  // to before the O72(b) corrections.
  // ⭐ D112 item 3 (10-30): + 31 — the apply service, the inbox (180 days), Gmail, the profile sections, global read.
  assert.match(policy, /const EFFECTIVE_DATE = 'October (5|7|8|9|13|14|15|25|31), 2026'/,
    "five user-visible corrections need the effective date moved with them");
});

test("D44·1 — the cover-letter disclosure names exactly what both cover-letter prompts carry", () => {
  // D44.1, 2026-10-06: the page first said cover letters send "the profile details the letter
  // draws on" — written without reading the call. Both prompts (the Cover Letter tool and the
  // apply path's letter) interpolate résumé text, title + company, the job description and the
  // tone; no profile field. If a prompt gains an interpolation, this fails until the page and the
  // list below are updated together.
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const prompts = [...server.matchAll(/const prompt = `You are an expert cover letter writer\.([\s\S]*?)`;/g)].map(m => m[1]);
  assert.equal(prompts.length, 2, "expected two cover-letter prompts in server.js (tool + apply path)");
  const allowed = new Set([
    "resumeText", "resumeTrimmed.slice(0, 3000)",                 // the résumé text
    "targetLine || 'not specified'", 'targetLine || "not specified"', // job title + company
    "jd || 'Not provided — write a strong general cover letter based on the resume.'",
    'jobDescription ? String(jobDescription).slice(0, 2000) : "Not provided — write a strong general cover letter based on the resume."',
    "toneDesc",                                                   // the tone the user picks
  ]);
  for (const p of prompts) {
    for (const [, expr] of p.matchAll(/\$\{([^}]*)\}/g)) {
      assert.ok(allowed.has(expr.trim()), `a cover-letter prompt now sends \${${expr}} — disclose it on the privacy page`);
    }
  }
  assert.match(prose, /Cover letters: the text of your résumé, the job title and company, the job description and the tone you pick, sent from our server directly to Anthropic/i);
  assert.doesNotMatch(prose, /profile details the letter draws on/i);
});

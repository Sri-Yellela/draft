// ⭐ D202 (47i) · THE EXTENSION MIRRORS THE FIT CARD. The on-page panel's ATS tab draws plate/FitCard.jsx's two faces
// from the SAME shared model (shared/fitCardModel.js, shared/contextualView.js fieldCardView), bundled into
// extension/atsReport.js; boardJob.js fitOf keeps the faces to words and numbers (the contextual block never leaves the
// service worker); resumePanel.js lays them out in its own tokens (.fc). This file is the mirror's guard (A93's MIRRORS
// lists SHARED client files only, and FitCard is the plate module's).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { fitCardModel, fitWords } from "../shared/fitCardModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const REPORT = { score: 66, claimed_matches: ["Vue"], tier1_matched: ["React", "TypeScript", "Vue", "Playwright"], tier1_missing: ["Datadog RUM", "GraphQL"],
  action_verbs_matched: ["Rebuild the checkout"], action_verbs_missing: ["Run A/B experiments"], competencies_matched: ["Mid level"], competencies_missing: ["Led a team"] };
const CONTEXTUAL = { score: 87, parts: { skill_match: { status: "ok", score: 86, weight: 0.5 }, role_fit: { status: "ok", score: 91, weight: 0.2, relation: "same_role" },
  tech_stack: { status: "ok", score: 88, weight: 0.15, of: 9, exact: [{ tech: "React", postings: 8, of: 9 }], ecosystem: [], gaps: [{ tech: "Datadog RUM", postings: 4, of: 9 }] },
  responsibility_overlap: { status: "ok", score: 80, weight: 0.15, matched: [], missing: [] } }, similarities: {}, dissimilarities: [] };

async function loadBundle() {
  delete globalThis.__draftAtsReport;
  await import(`../extension/atsReport.js?fit=${Date.now()}`);
  return globalThis.__draftAtsReport;
}

test("d202ExtensionFitMirror: the extension's bundle carries the SAME fit model the web card reads", async () => {
  const A = await loadBundle();
  for (const f of ["fitCardModel", "fitWords", "fieldCardView", "atsCardView"]) assert.equal(typeof A[f], "function", f);
  const web = fitCardModel({ report: REPORT }), ext = A.fitCardModel({ report: REPORT });
  assert.deepEqual([ext.total, ext.on, ext.claimed, ext.missing], [web.total, web.on, web.claimed, web.missing]);
  assert.equal(A.fitWords(ext).count, fitWords(web).count);
  assert.deepEqual(ext.words.map((w) => [w.label, w.state, w.group]), web.words.map((w) => [w.label, w.state, w.group]));
  const gen = read("scripts/buildAtsReport.mjs");
  assert.match(gen, /"techVocabulary\.js"[\s\S]*"fitCardModel\.js"/, "bundled in dependency order");
});

test("d202ExtensionFitMirror: fitOf keeps the faces to words and counts — every scorer word, none of the contextual block", async () => {
  await loadBundle();
  const { fitOf } = await import(`../extension/boardJob.js?fit=${Date.now()}`);
  const f = fitOf({ report: REPORT, contextual: CONTEXTUAL });
  const web = fitCardModel({ report: REPORT });
  assert.equal(f.count, fitWords(web).count);
  assert.equal(f.groups.reduce((n, g) => n + g.words.length, 0), web.total, "every word the scorer read is listed (d202EveryWordListed)");
  assert.ok(f.groups.every((g) => g.total > 0), "an empty group is not drawn");
  assert.ok(f.alike.length && f.gaps.length, "the front's Lines up / Doesn't, yet (fieldCardView)");
  assert.doesNotMatch(JSON.stringify(f), /"parts"|"weights"|responsibility_overlap|skill_match/, "the contextual block stays in the service worker");
  assert.equal(fitOf({ report: null }), null);
  assert.equal(fitOf(null), null);
});

test("d202ExtensionFitMirror: the panel draws both faces — the front opens on the count; the back keeps today's card + Every word", () => {
  const src = read("extension/resumePanel.js");
  const draw = src.slice(at(src, "const fit = m.report?.fit || null;"), at(src, "// ⭐ T26: the title and the job are hidden words"));
  assert.match(draw, /data-role="fit-card" data-face="front"/);
  assert.match(draw, /FIELD CARD · WHY IT FITS/);
  assert.match(draw, /↻ Turn over · the full ATS card/);
  assert.match(draw, /data-role="fit-card" data-face="back"/);
  assert.match(draw, /\['card', 'The card'\], \['words', `Every word · \$\{fit\.total\}`\]/);
  assert.match(draw, /fitTab === 'words' \? `\$\{fitBar\(fit\)\}\$\{fitWordsHtml\(fit\)\}` : acHtml/, "the back's first tab is today's card, word for word");
  for (const id of ["all", "missing", "on", "claimed"]) assert.ok(draw.includes(`['${id}', `), `the ${id} filter`);
  assert.equal((draw.match(/data-role="plausibility"/g) || []).length, 1, "the front carries Does it add up? (the back's is inside today's card)");
  assert.match(src, /fitHtml \? fitHtml : ac \? acHtml : card \?/);
  // the faces' CSS is the panel's tokens only, and the bar keeps D60's corner
  const css = src.slice(at(src, "/* ⭐ D202 (47i) · THE FIT CARD (plate/FitCard.jsx, mirrored)"), at(src, ".fc-words[data-filter=\"missing\"]"));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  assert.match(css, /\.fc-bar \{ display: flex; height: 6px; border-radius: 1px;/);
  // (MIRRORS lists SHARED client files only; FitCard is the plate module's — this file is the mirror's guard)
});

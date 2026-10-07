import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ONE ATS REPORT, EVERY SURFACE (A52).
//
// The StampLogo lesson: three implementations of one mark existed, the rebrand swept two, and the
// third shipped the legacy name on every page while the guard passed green. The ATS report had the
// same shape — the board's ATSPanel, the deck's adapter feeding it, the public /tools/ats page's own
// band card and chip rows (already thinner: no competencies, no generic language, no matched verbs),
// and the signup hook's band card. They are one now: client/src/components/AtsReport.jsx draws the
// report, everything else renders it. This refuses a second one.
//
// HOW A SECOND REPORT IS RECOGNISED, without trusting its author to name it one:
//   1. it READS A REPORT'S SECTIONS — any of the scorer's term buckets or the deck's / public
//      route's names for them. Only the report module may know those field names (it owns the two
//      adapters, fromDeckReport and fromStandaloneResult, for exactly that reason);
//   2. it PRINTS A REPORT'S SECTION HEADINGS or the band card's "fit band" / "no judgement" caption.
// Either one outside the module is a second report.

const ROOT = "client/src";
const THE_ONE = "client/src/components/AtsReport.jsx";
const files = fs.readdirSync(ROOT, { recursive: true })
  .map(String).filter(f => /\.(jsx?|tsx?)$/.test(f)).map(f => path.join(ROOT, f).replace(/\\/g, "/"));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\/.*$/gm, "");

const SECTION_FIELDS = [
  // the scorer's report (services/localAtsScorer.js)
  "tier1_matched", "tier1_missing", "competencies_matched", "competencies_missing",
  "action_verbs_matched", "action_verbs_missing", "action_verbs_generic", "decline_reasons",
  "hard_constraint_misses", "best_possible_score", "resume_depth", "seniority_cap",
  // the deck's frozen report (services/dailyDraft.js deckReport)
  "skillsMatched", "skillsMissing", "competenciesMatched", "competenciesMissing",
  "verbsMatched", "verbsMissing", "verbsGeneric", "declineReasons", "hardConstraintMisses", "seniorityNote",
  // the public route's result (services/standaloneAts.js)
  "matched_skills", "missing_skills", "matched_verbs", "missing_verbs", "generic_verbs",
];
const READS_SECTION = new RegExp(`\\.(${SECTION_FIELDS.join("|")})\\b`);
// D31 (10-04): the simple card's three section headings are a report's headings too.
// D32 (10-05): and the ink pair's — "Already yours", and the header's "You cover … things this posting asks for".
const HEADINGS = /Skills Matched|Skills Missing|Competencies Missing|Verbs Missing|Generic Language|Experience Fit|Profile Facts Missing|"fit band"|"no judgement"|You could claim|Already on your r[eé]sum[eé]|Already yours|You cover|things this posting asks for|Generic — not a gap/;

/** Every file, other than the one, that draws or reads an ATS report. Pure, so violations can be injected. */
export function secondReports(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    if (file === THE_ONE) continue;
    const code = strip(src);
    const m = code.match(READS_SECTION) || code.match(HEADINGS);
    if (m) out.push(`${file}: ${m[0]}`);
  }
  return out;
}

const SOURCES = Object.fromEntries(files.map(f => [f, fs.readFileSync(f, "utf8")]));

test("⛔ no file but components/AtsReport.jsx reads a report's sections or prints its headings", () => {
  assert.deepEqual(secondReports(SOURCES), [],
    "a second ATS-report implementation — render <AtsReport> / <AtsBandCard> from components/AtsReport.jsx");
});

test("exactly one file defines the report, and it exports the pieces every surface uses", () => {
  const definers = files.filter(f => /export function AtsReport\b/.test(strip(SOURCES[f])));
  assert.deepEqual(definers, [THE_ONE]);
  const one = strip(SOURCES[THE_ONE]);
  for (const name of ["AtsReport", "AtsBandCard", "reportBand", "fromDeckReport", "fromStandaloneResult"]) {
    assert.match(one, new RegExp(`export function ${name}\\b`), name);
  }
});

test("the four surfaces — board side panel, deck panel, phone sheet, public tool — and the signup hook all render it", () => {
  const code = (f) => strip(SOURCES[`client/src/${f}`]);
  // The board's side panel and the deck (both its left panel and its sheet) render ATSPanel …
  assert.match(code("panels/AtsReportPanel.jsx"), /<ATSPanel\b/, "the board's side panel");
  const deck = code("panels/DeckView.jsx");
  assert.match(deck, /<ATSPanel report=\{fromDeckReport\(r\)\}/, "the deck draws the frozen report through the one adapter");
  assert.match(deck, /<DeckAtsReport\b[\s\S]*<DeckAtsReport\b/, "the deck's left panel AND its phone sheet");
  // … which is the data container, and draws nothing itself.
  assert.match(code("components/ATSPanel.jsx"), /<AtsReport report=\{activeReport\}/);
  assert.match(code("pages/tools/ATSToolPage.jsx"), /<AtsReport report=\{fromStandaloneResult\(result\)\}/, "the public tool");
  assert.match(code("components/SignupAtsHook.jsx"), /<AtsBandCard\b/, "the signup hook's band card");
});

test("the guard goes red on a second report (injected)", () => {
  const injected = (file, extra) => secondReports({ ...SOURCES, [file]: SOURCES[file] + extra });
  assert.equal(injected("client/src/pages/tools/ATSToolPage.jsx",
    "\nconst x = <div>{result.missing_skills.map(s => <span>{s}</span>)}</div>;\n").length, 1, "public tool re-grows its chips");
  assert.equal(injected("client/src/panels/DeckView.jsx",
    "\nfunction toPanelReport(r) { return { tier1_matched: r.skillsMatched }; }\n").length, 1, "deck re-grows its adapter");
  assert.equal(injected("client/src/components/JobCard.jsx",
    '\nconst h = <div className="rm-section-label">✓ Skills Matched</div>;\n').length, 1, "a heading copied into a card");
  assert.equal(injected("client/src/components/JobCard.jsx",
    '\nconst h = <summary>Already on your résumé (3)</summary>;\n').length, 1, "D31: the simple card's fold copied into a card");
  assert.equal(injected("client/src/components/SignupAtsHook.jsx",
    "\nconst y = report.decline_reasons.map(r => r);\n").length, 1, "the hook draws its own decline list");
  // A mention in a comment is not an implementation.
  assert.equal(injected("client/src/components/JobCard.jsx", "\n// see tier1_matched in AtsReport.jsx\n").length, 0);
});

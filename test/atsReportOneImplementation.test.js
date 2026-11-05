import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ONE ATS REPORT, EVERY SURFACE (A52) — AND BOTH PRODUCTS (T9).
//
// The StampLogo lesson: three implementations of one mark existed, the rebrand swept two, and the
// third shipped the legacy name on every page while the guard passed green. The ATS report had the
// same shape — the board's ATSPanel, the deck's adapter feeding it, the public /tools/ats page's own
// band card and chip rows (already thinner: no competencies, no generic language, no matched verbs),
// and the signup hook's band card. A52 made them one React component. T9 (owner 10-14: "the same ATS
// panel we use on the website — same design and everything") found the fourth copy that guard could not
// see: the extension's on-page panel drew its own (a score mark and two comma lists). Now the report is
// ONE framework-agnostic component in shared/ — shared/atsReportElement.js (structure, copy, events) and
// shared/atsReportModel.js (the report's shape and the two adapters) — which the web app wraps
// (client/src/components/AtsReport.jsx, thin) and the extension bundles (extension/atsReport.js,
// generated). This refuses a second one, in the client OR the extension.
//
// HOW A SECOND REPORT IS RECOGNISED, without trusting its author to name it one:
//   1. it READS A REPORT'S SECTIONS — any of the scorer's term buckets or the deck's / public
//      route's names for them. Only the report module may know those field names (it owns the two
//      adapters, fromDeckReport and fromStandaloneResult, for exactly that reason);
//   2. it PRINTS A REPORT'S SECTION HEADINGS or the band card's "fit band" / "no judgement" caption.
// Either one outside the module is a second report.

const THE_ONE = new Set(["shared/atsReportElement.js", "shared/atsReportModel.js"]);
const WRAPPER = "client/src/components/AtsReport.jsx";
const BUNDLE = "extension/atsReport.js";   // THE_ONE, bundled — its staleness is t9AtsReportComponent's job
const walk = (root, re) => fs.readdirSync(root, { recursive: true }).map(String).filter(f => re.test(f))
  .map(f => path.join(root, f).replace(/\\/g, "/")).filter(f => !f.includes("/submission/"));
const files = [...walk("client/src", /\.(jsx?|tsx?)$/), ...walk("extension", /\.(js|html)$/).filter(f => f !== BUNDLE)];
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/\/\/.*$/gm, "");

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
const HEADINGS = /Skills Matched|Skills Missing|Competencies Missing|Verbs Missing|Generic Language|Experience Fit|Profile Facts Missing|"fit band"|"no judgement"|You could claim|Already on your r[eé]sum[eé]|Already yours|You cover \$?\{[^}]*\} of|things this posting asks for|Generic — not a gap/;
// ⚠ 10-31 (43w): "You cover" ALONE is the Atlas tree's role coverage (D116: "You cover 6 of 15 of this role's top skills"
// — a fact about a ROLE, read from the server's line), not a posting's report; the ATS header is "You cover ${matched} of
// the ${total} things this posting asks for", so the guard matches that shape — an interpolated count, then "of".

/** Every file, other than the one, that draws or reads an ATS report. Pure, so violations can be injected. */
export function secondReports(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    if (THE_ONE.has(file)) continue;
    const code = strip(src);
    const m = code.match(READS_SECTION) || code.match(HEADINGS);
    if (m) out.push(`${file}: ${m[0]}`);
  }
  return out;
}

const SOURCES = Object.fromEntries(files.map(f => [f, fs.readFileSync(f, "utf8")]));
const ONE = Object.fromEntries([...THE_ONE].map(f => [f, strip(fs.readFileSync(f, "utf8"))]));

test("⛔ no file but the shared component reads a report's sections or prints its headings — client or extension", () => {
  assert.ok(files.some(f => f.startsWith("extension/")) && files.some(f => f.startsWith("client/src/")), "the scan found both products");
  assert.deepEqual(secondReports(SOURCES), [],
    "a second ATS-report implementation — render <AtsReport> / <AtsBandCard> (web) or <draft-ats-report> / mountAtsReport (extension)");
});

test("exactly one implementation defines the report, the web wrapper only re-exports it, and the pieces are where every surface reads them", () => {
  const all = { ...Object.fromEntries(files.map(f => [f, strip(SOURCES[f])])), ...ONE };
  assert.deepEqual(Object.keys(all).filter(f => /export function buildAtsReport\b/.test(all[f])), ["shared/atsReportElement.js"]);
  for (const name of ["buildAtsReport", "buildBandCard", "mountAtsReport", "defineAtsReportElement"]) {
    assert.match(ONE["shared/atsReportElement.js"], new RegExp(`export function ${name}\\b`), name);
  }
  for (const name of ["reportBand", "fromDeckReport", "fromStandaloneResult", "reportAsks", "cleanReport"]) {
    assert.match(ONE["shared/atsReportModel.js"], new RegExp(`export function ${name}\\b`), name);
  }
  // The web wrapper defines the two React entry points every surface renders, and re-exports the adapters.
  const w = strip(SOURCES[WRAPPER]);
  for (const name of ["AtsReport", "AtsBandCard"]) assert.match(w, new RegExp(`export function ${name}\\b`), name);
  assert.match(w, /export \{ reportBand, fromDeckReport, fromStandaloneResult, reportAsks, TERM_KINDS \};/);
});

test("the four surfaces — board side panel, deck panel, phone sheet, public tool — the signup hook, and the extension all render it", () => {
  const code = (f) => strip(SOURCES[`client/src/${f}`]);
  // The board's posting renders ATSPanel … (⭐ D152 (8) (b): the deck's left panel and its sheet are deleted — the deck's
  // match opens in the posting, so the deck draws only its collapsed score through the one adapter.)
  // ⭐ D152 (8): the board's report is the match INSIDE the posting (the side panel over the page is retired).
  assert.match(code("components/JobDetailPanel.jsx"), /<ATSPanel\b/, "the posting's match");
  const deck = code("panels/DeckView.jsx");
  assert.match(deck, /<AtsBandCard report=\{fromDeckReport\(card\.report\)\}/, "the deck draws the frozen report through the one adapter");
  assert.doesNotMatch(deck, /<ATSPanel\b|DeckAtsReport|AtsSheet/, "the deck's own full report is back");
  // … which is the data container, and draws nothing itself.
  assert.match(code("components/ATSPanel.jsx"), /<AtsReport report=\{activeReport\}/);
  assert.match(code("pages/tools/ATSToolPage.jsx"), /<AtsReport report=\{fromStandaloneResult\(result\)\}/, "the public tool");
  assert.match(code("components/SignupAtsHook.jsx"), /<AtsBandCard\b/, "the signup hook's band card");
  // T9: the extension's on-page panel (the renderer, in the panel's shadow root) — ⭐ T31: the popup's element went with
  // the retired toolbar popup; the dock's ATS tab is the extension's one place for the report
  assert.match(strip(SOURCES["extension/resumePanel.js"]), /ATS\.mountAtsReport\(/, "the on-page panel");
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
  // T9: the extension growing its own copy again — the old J12 lines, or a heading.
  assert.equal(injected("extension/resumePanel.js",
    "\nconst lines = ats.report.tier1_missing.join(', ');\n").length, 1, "the panel reads a section itself");
  assert.equal(injected("extension/popup.js", "\nbox.textContent = 'You could claim';\n").length, 1, "the popup prints a heading");
  assert.equal(injected("client/src/components/JobCard.jsx", "\nconst c = <p>You cover {m} of the {n} skills</p>;\n").length, 1, "the ink pair's header copied into a card");
  assert.equal(injected("client/src/components/JobCard.jsx", "\nconst c = `You cover ${m} of ${n}`;\n").length, 1, "…or as a template");
  // A mention in a comment is not an implementation.
  assert.equal(injected("client/src/components/JobCard.jsx", "\n// see tier1_matched in AtsReport.jsx\n").length, 0);
});

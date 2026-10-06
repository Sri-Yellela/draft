// D24 · FULL HOUSE — THE CLIENT HALF: the filter sentence, the sort panel, the facets they count from.
// ⛔ D30 (10-04) replaced D24's popover sentence with six dials and the declarative headline; ⛔ D35
// (10-05) replaced the dials and the filter ICON with the sentence's own words, each opening ONE panel
// beneath it (test/d35FullHouseHeader.test.js pins D35's seven). What this file still holds is D24's
// substance under the shape that now carries it:
//   the panel CLOSED BY DEFAULT · ONE panel value (mutually exclusive) · zero-count options DIMMED NOT
//   HIDDEN, and the WOULD-EMPTY warning · NO FACETS ANSWER, NO NUMBERS · the sentence as a PROJECTION
//   · the bar is the search input only · the SORT PANEL's rows, tie-break and unscored line · the
//   curated default sends no sort · NO LITERAL OPTION VALUES in the client code · the server side of
//   fit_bands · a pre-D24 cached sort reopens curated.
// RETIRED with the UI they held, 10-05 (D35): the filter icon's COUNT BADGE (the sentence now shows every
// active filter as a filled word — boardControlRowConsolidation pins that) and D30's SIX DIALS (the
// words are the dials).
//
// The components are RENDERED (esbuild from client/node_modules, react-dom/server) with a synthetic
// FacetsResponse.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { at } from "../test-support/sourceAnchors.js";

import {
  SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, FIT_BANDS,
  sentenceText, sentenceParts, SENTENCE_WORDS, PANEL_WORDS, panelWord,
} from "../shared/filterSentence.js";
import { JOB_FUNCTIONS, PLACES } from "../shared/jobTagVocabulary.js";
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE, SORTS } from "../shared/jobFilterOptions.js";
import {
  BOARD_PANEL, BOARD_PANEL_DEFAULT, nextBoardPanel, sentenceClauses, optionRows, panelRows, panelNote,
  sortRows, tieBreakText, unscoredText, DEFAULT_SORT, DEFAULT_SORT_ROW, isSortChosen, clearClause,
  allDomainsPatch, viewCounts,
} from "../client/src/lib/filterSentenceModel.js";
import { loadFacets, facetsQuery, FACETS_PATH } from "../client/src/lib/jobFacets.js";

const read = (p) => fs.readFileSync(p, "utf8");
const strip = (t) => t
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*(?:\/\/|\*).*$/gm, "")
  .replace(/([^:"'`\\])\/\/.*$/gm, "$1");

// ── A synthetic FacetsResponse (the contract's typedef). Nobody's data. ─────────────────────────
const fo = (value, count, known = count) => ({ value, label: value, count, known });
const FACETS = {
  total: 142, known: 131, unscored: 37,
  coverage: { level: 140, where: 71, employment: 11 }, views: { all: 142, saved: 3, pending: 2 },
  clauses: {
    level:  EXPERIENCE_LEVELS.options.map((o, i) => fo(o.value, i === 0 ? 0 : 10 * i, i === 0 ? 0 : 10 * i - 2)),
    where:  WORK_MODELS.options.map((o, i) => fo(o.value, 20 + i)),
    posted: POSTING_AGE.options.filter(o => o.value).map((o, i) => fo(o.value, 5 + i)),
    fit:    FIT_BANDS.options.map((o, i) => fo(o.value, i === 2 ? 0 : 7 + i)),
    domain: JOB_FUNCTIONS.options.map((o, i) => fo(o.value, 30 + i, 20 + i)),
    location: PLACES.options.map((o, i) => fo(o.value, i < 3 ? 40 - i : 0, i < 3 ? 1 : 0)),
  },
};
const clause = (key) => SENTENCE_CLAUSES.find(c => c.key === key);
const firstValue = (key) => clause(key).dim.options.find(o => o.value !== "").value;

// ── Render the real components ───────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import WordPanel, { PanelOptions } from ${abs("components/WordPanel.jsx")};
        import BoardHeadline from ${abs("components/BoardHeadline.jsx")};
        import SortPanel from ${abs("components/SortPanel.jsx")};
        import { SortSquare } from ${abs("components/BoardBar.jsx")};
        export const html = (C, props) => renderToStaticMarkup(createElement(C, props));
        export { WordPanel, PanelOptions, BoardHeadline, SortPanel, SortSquare };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d24-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// ── 1. Closed by default ────────────────────────────────────────────────────────────────────────

test("D24 → D35: the board's panel is CLOSED BY DEFAULT — the bar sits right under the sentence", async () => {
  assert.equal(BOARD_PANEL_DEFAULT, null);
  const ctx = read("client/src/contexts/JobBoardContext.jsx");
  assert.match(ctx, /const \[boardPanel, setBoardPanel\] = useState\(null\);/,
    "the board's panel state no longer starts closed");
  const { html, WordPanel, BoardHeadline, SortSquare } = await loadUi();
  assert.equal(html(WordPanel, { open: BOARD_PANEL_DEFAULT, params: {} }), "", "a panel renders with nothing open");
  const words = html(BoardHeadline, { params: {}, open: BOARD_PANEL_DEFAULT });
  assert.doesNotMatch(words, /aria-expanded="true"/);
  assert.match(html(SortSquare, { open: false }), /aria-expanded="false"/);
  const app = strip(read("client/src/App.jsx"));
  assert.match(app, /if \(boardPanel !== BOARD_PANEL\.SORT\) return null;/);
});

// ── 2. Mutual exclusivity ───────────────────────────────────────────────────────────────────────

test("D24 → D35: ONE panel value — a press swaps or closes, and a word and sort can never both be open", () => {
  const { SORT, MORE } = BOARD_PANEL;
  assert.equal(nextBoardPanel(null, "level"), "level");
  assert.equal(nextBoardPanel(null, SORT), SORT);
  assert.equal(nextBoardPanel("level", SORT), SORT, "opening sort must close the word's panel");
  assert.equal(nextBoardPanel(SORT, "where"), "where", "opening a word must close sort");
  assert.equal(nextBoardPanel("level", "level"), null, "pressing the open word closes it");
  assert.equal(nextBoardPanel(SORT, SORT), null);
  assert.equal(nextBoardPanel(MORE, MORE), null);
  assert.doesNotMatch(read("client/src/contexts/JobBoardContext.jsx"), /\[sortPanelOpen|\[sentenceOpen/,
    "a second open flag is back — two booleans can both be true");
});

// ── 3. Zero dimmed, not hidden — and the would-empty warning ────────────────────────────────────

test("D24: a ZERO-COUNT option is DIMMED, NOT HIDDEN — it keeps its row and its 0 (D35: and is not selectable)", async () => {
  const lvl = clause("level");
  const rows = optionRows(lvl, {}, FACETS);
  assert.equal(rows.length, lvl.dim.options.filter(o => o.value).length, "an option went missing");
  const zero = rows.find(r => r.value === firstValue("level"));
  assert.equal(zero.count, 0);
  assert.equal(zero.dimmed, true);
  const { html, WordPanel } = await loadUi();
  const out = html(WordPanel, { open: "level", params: {}, facets: FACETS, facetsStatus: "ready" });
  const word = panelWord(lvl, firstValue("level"));
  assert.match(out, new RegExp(`aria-disabled="true"[^>]*>${word}<span class="n">0</span>`), "the 0 itself is information — show it");
  for (const o of lvl.dim.options.filter(o => o.value)) assert.match(out, new RegExp(`>${panelWord(lvl, o.value)}<`));
});

test("D24: an option that WOULD EMPTY THE BOARD says so BEFORE it is pressed", async () => {
  const lvl = clause("level");
  const zeroValue = firstValue("level");
  const fresh = optionRows(lvl, {}, FACETS).find(r => r.value === zeroValue);
  assert.equal(fresh.empties, true);
  assert.equal(fresh.note, "Would show no jobs");
  const chosen = optionRows(lvl, { [lvl.dim.param]: [zeroValue] }, FACETS).find(r => r.value === zeroValue);
  assert.equal(chosen.empties, false, "already chosen: pressing it REMOVES it");
  const other = lvl.dim.options.filter(o => o.value)[2].value;
  const widening = optionRows(lvl, { [lvl.dim.param]: [other] }, FACETS).find(r => r.value === zeroValue);
  assert.equal(widening.empties, false, "added to an OR it cannot empty the board");
  assert.equal(widening.dimmed, true, "still dimmed — its own count is still 0");
  const fit = clause("fit");
  assert.equal(optionRows(fit, {}, FACETS).find(r => r.count === 0).empties, true);
  // The panel says it on the dimmed pill, before anything is pressed.
  const pill = panelRows(lvl, {}, FACETS).find(r => r.value === zeroValue);
  assert.equal(pill.note, "Would show no jobs");
  const { html, WordPanel } = await loadUi();
  const out = html(WordPanel, { open: "level", params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.equal((out.match(/title="Would show no jobs"/g) || []).length, 1, "only the empty option warns");
});

// ── 4. No facets, no numbers ─────────────────────────────────────────────────────────────────────

test("D24: NO FACETS ANSWER, NO NUMBERS — a 404 draws no counts, no dims, no warnings, never zeros", async () => {
  const lvl = clause("level");
  for (const facets of [null, undefined, { total: "x" }, { total: 3 }]) {
    for (const r of optionRows(lvl, {}, facets)) {
      assert.equal(r.count, null);
      assert.equal(r.dimmed, false);
      assert.equal(r.empties, false);
    }
    assert.doesNotMatch(unscoredText(facets), /\d/);
    assert.equal(panelNote("where", {}, facets), null);
    assert.deepEqual(viewCounts(facets), { all: null, saved: null, pending: null });
  }
  const calls = [];
  const ok = await loadFacets("page=3&pageSize=50&sort=dateDesc&cursor=abc&work_models=remote",
    async (url) => { calls.push(url); return FACETS; });
  assert.equal(ok.status, "ready");
  assert.equal(calls[0], `${FACETS_PATH}?sort=dateDesc&work_models=remote`, "paging keys must not reach facets");
  assert.equal(facetsQuery("page=1&pageSize=50"), "");
  const nf = await loadFacets("", async () => { throw Object.assign(new Error("Request failed (404)"), { status: 404 }); });
  assert.deepEqual(nf, { status: "unavailable", data: null });
  const boom = await loadFacets("", async () => { throw Object.assign(new Error("x"), { status: 500 }); });
  assert.deepEqual(boom, { status: "error", data: null });
  const junk = await loadFacets("", async () => ({ jobs: [] }));
  assert.deepEqual(junk, { status: "error", data: null });

  const { html, WordPanel } = await loadUi();
  const out = html(WordPanel, { open: "level", params: {}, facets: null, facetsStatus: "unavailable" });
  assert.match(out, /Counts aren(?:&#x27;|')t available right now — these still filter the board\./);
  assert.doesNotMatch(out, /class="n"/, "a count was drawn without a facets answer");
  // The clause's own options only — D42's "Add a filter" row lists employment type disabled on purpose.
  const options = out.split("data-add-section")[0];
  assert.doesNotMatch(options, /aria-disabled="true"/, "an option was dimmed without a facets answer");
});

// ── 5. The sentence, projected ─────────────────────────────────────────────────────────────────

test("D30 → D35: THE SENTENCE IS A PROJECTION — four permanent words, posted/fit append only when set, same words when nothing matches", async () => {
  assert.deepEqual(SENTENCE_CLAUSES.map(c => c.key), ["domain", "level", "location", "where", "posted", "fit"]);
  assert.equal(SENTENCE_CLAUSES.filter(c => c.permanent).length, SENTENCE_CAP, "four permanent slots");
  assert.equal(sentenceClauses().length, 6);
  assert.equal(sentenceText({}), "Now showing all jobs, at any level, in the United States, any workplace.");
  // ⛔ D42 (owner, 10-06): the unset domain reads "all" — for an engineering profile it IS engineering +
  // data — never the profile's word, whatever the caller passes.
  assert.equal(sentenceText({}, { defaultDomain: "engineering" }),
    "Now showing all jobs, at any level, in the United States, any workplace.",
    "the unset domain reads all (D42)");
  const full = { job_functions: ["design"], experience_levels: ["senior"], places: ["metro:boston"],
    work_models: ["remote"], ageFilter: "1w", fit_bands: ["strong"] };
  assert.equal(sentenceText(full),
    "Now showing design jobs, at senior level, in Boston, remote only, posted this week, strong fits only.");
  const { ageFilter, fit_bands, ...four } = full;
  assert.equal(sentenceText(four, { nothingMatches: true }),
    "Nothing matches design jobs, at senior level, in Boston, remote only.", "same clauses, different verb");
  assert.equal(sentenceText({ job_functions: JOB_FUNCTIONS.options.map(o => o.value) }),
    "Now showing all jobs, at any level, in the United States, any workplace.", "every function chosen reads 'all'");
  for (const key of ["level", "where", "posted", "fit"]) {
    for (const o of clause(key).dim.options.filter(o => o.value)) {
      assert.ok(SENTENCE_WORDS[key][o.value], `${key}=${o.value} has no word in the sentence`);
    }
  }
  // …and every value of the closed sets has a word in its PANEL (D35).
  for (const key of ["where", "posted"]) {
    for (const o of clause(key).dim.options.filter(o => o.value)) assert.ok(PANEL_WORDS[key][o.value], `${key}=${o.value} has no panel word`);
  }
  // Rendered as the headline: each slot a word-button. ⛔ D42: no "+ add" — it moved into the panel.
  const { html, BoardHeadline } = await loadUi();
  const out = html(BoardHeadline, { params: full });
  const text = out.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  assert.equal(text, "Now showing design jobs, at senior level, in Boston, remote only, posted this week, strong fits only.");
  assert.equal((out.match(/class="tok"/g) || []).length, 6);
  assert.equal((out.match(/class="tok tok--add"/g) || []).length, 0);
  assert.match(html(BoardHeadline, { params: four, nothingMatches: true }), /data-nothing-matches="true"/);
  assert.equal(sentenceParts({}).slots.length, 4, "posted and fit are absent at rest");
  assert.deepEqual(clearClause(clause("location")), { [PLACES.param]: [] }, "clearing location is the floor");
  assert.deepEqual(allDomainsPatch(clause("domain"))[JOB_FUNCTIONS.param], JOB_FUNCTIONS.options.map(o => o.value));
  const app = strip(read("client/src/App.jsx"));
  assert.doesNotMatch(app, /Let's get to work\./);
  assert.match(app, /<BoardHeadlineSlot \/>/);
});

test("D26/D28: the board's bar is the search input only; a search never touches the sentence's filters", () => {
  const app = strip(read("client/src/App.jsx"));
  assert.match(app, /applyBarFilters\(params, \{ fields: \["query"\] \}\)/);
  assert.match(read("client/src/components/BoardBar.jsx"), /const submit = \(\) => onSubmit\?\.\(\{ query: q \}\);/,
    "the board's search publishes more than the keyword");
  const bar = read("client/src/components/UnifiedSearchBar.jsx");
  assert.match(bar, /\{fields === 'all' && \(<>/, "location and the three selects render only on the landing page");
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /if \(has\("query"\)\) setLocalSearch\(query\);/);
  assert.match(panel, /if \(has\("status"\)\) \{/, "a search without a status must not reset ageFilter or the tab");
  assert.doesNotMatch(panel, /<div style=\{labelStyle\}>Provider<\/div>/, "the provider filter is an admin concept (D26)");
  assert.doesNotMatch(panel, /<div style=\{labelStyle\}>Location<\/div>/, "location is the sentence's word now, not free text");
});

// ── 6. The sort panel ───────────────────────────────────────────────────────────────────────────

test("D24 → D35: the SORT PANEL renders every order with its note, the chosen order's TIE-BREAK, and the unscored line", async () => {
  const best = SORT_PANEL.find(o => o.unscoredLast);
  assert.equal(tieBreakText(best), "Ties broken by: newest first, then company A–Z");
  assert.equal(unscoredText(FACETS), "37 jobs have no ATS score yet, so they sort last whatever you pick. Newest shows everything.");
  const { html, SortPanel } = await loadUi();
  for (const o of SORT_PANEL) {
    const out = html(SortPanel, { value: o.value, atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
    assert.match(out, new RegExp(`data-sort="${o.value}" title="${o.subtitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">${o.short}<span class="n">${o.tag}</span>`),
      `${o.label}: its pill, note or subtitle is missing`);
    assert.ok(out.includes(tieBreakText(o)), `${o.label}'s tie-break is not visible when it is chosen`);
    assert.match(out, new RegExp(`role="radio" aria-checked="true" class="fh-op" data-sort="${o.value}"`));
  }
  const out = html(SortPanel, { value: "dateDesc", atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
  assert.match(out, /37 jobs have no ATS score yet, so they sort last whatever you pick\. <b>Newest<\/b> shows everything\./);
  const noFit = html(SortPanel, { value: "dateDesc", atsAvailable: false, facets: FACETS, facetsStatus: "ready" });
  assert.ok(!noFit.includes(`>${best.short}<`), "Best fit offered without a résumé");
  assert.deepEqual(sortRows(false).map(r => r.value),
    [DEFAULT_SORT, ...SORT_PANEL.filter(o => !o.unscoredLast).map(o => o.value)]);
  const unknown = html(SortPanel, { value: "dateDesc", facets: null, facetsStatus: "unavailable" });
  assert.match(unknown, /Jobs with no ATS score yet sort last whatever you pick\. <b>Newest<\/b> shows everything\./);
});

test("D24: the DEFAULT board request carries NO sort param — the curated order; Newest is explicit", async () => {
  assert.equal(DEFAULT_SORT, "");
  const ctx = read("client/src/contexts/JobBoardContext.jsx");
  assert.match(ctx, /const \[sortBy,\s+setSortBy\]\s+= useState\(""\);/, "the board no longer starts on the curated default");
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  const bp = panel.slice(at(panel, "const buildParams = useCallback"), at(panel, "}, [sortBy"));
  assert.match(bp, /if \(sortBy\)\s+p\.set\("sort", sortBy\);/, "buildParams sends a sort when none was chosen");
  assert.doesNotMatch(bp, /^\s*p\.set\("sort", sortBy\);/m, "an unconditional sort is back");
  assert.match(panel, /setSortBy\(sortFromCachedSnapshot\(snapshot\)\)/, "a restored board without a sort must stay curated");
  assert.equal(sortRows(true)[0], DEFAULT_SORT_ROW);
  assert.equal(isSortChosen(""), false);
  assert.equal(isSortChosen("dateDesc"), true, "Newest is a CHOSEN sort now, not the default");
  const { html, SortPanel, SortSquare } = await loadUi();
  const out = html(SortPanel, { value: "", atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
  assert.match(out, new RegExp(`aria-checked="true" class="fh-op" data-sort="" title="[^"]+">${DEFAULT_SORT_ROW.short}<`));
  assert.equal((out.match(/aria-checked="true"/g) || []).length, 1);
  assert.match(html(SortSquare, { chosen: true }), /data-board-icon="sort" data-active="true"/);
  assert.match(html(SortSquare, { chosen: false }), /data-board-icon="sort" data-active="false"/);
  assert.match(strip(read("client/src/App.jsx")), /chosen=\{isSortChosen\(sortBy\)\}/);
});

// ── 7. No literal option values ─────────────────────────────────────────────────────────────────

test("D24: NO LITERAL OPTION VALUE OR LABEL in the client code — everything renders from the contract", () => {
  const files = [
    "client/src/lib/filterSentenceModel.js", "client/src/lib/jobFacets.js",
    "client/src/hooks/useJobFacets.js", "client/src/components/WordPanel.jsx",
    "client/src/components/BoardHeadline.jsx", "client/src/components/SortPanel.jsx",
    "client/src/components/BoardBar.jsx",
  ];
  const vocab = new Set();
  for (const c of SENTENCE_CLAUSES) {
    vocab.add(c.dim.param);
    for (const o of c.dim.options) { if (o.value) vocab.add(o.value); vocab.add(o.label); }
  }
  for (const o of SORT_PANEL) { vocab.add(o.value); vocab.add(o.label); vocab.add(o.subtitle); vocab.add(o.short); }
  for (const f of files) {
    const src = strip(read(f));
    for (const v of vocab) {
      for (const q of ['"', "'", "`"]) {
        assert.ok(!src.includes(`${q}${v}${q}`), `${f} holds the literal ${q}${v}${q} — it must come from the contract`);
      }
      assert.ok(!new RegExp(`>\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`).test(src),
        `${f} hardcodes "${v}" as JSX text`);
    }
  }
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /p\.set\(FIT_BANDS\.param,\s*fitBands\.join\(","\)\)/);
  assert.ok(!panel.includes(`"${FIT_BANDS.param}"`), "JobsPanel writes the fit param name literally");
  assert.match(strip(read("client/src/App.jsx")), /sortRows\(atsSortAvailable\)/);
});

// ── 8. The server side of the two new params ────────────────────────────────────────────────────
test("D24: the server reads fit_bands and offers every sort the panel sends", () => {
  const server = read("server.js");
  const jobQuery = read("services/jobs/jobQuery.js");
  assert.ok(server.includes(FIT_BANDS.param) || jobQuery.includes(FIT_BANDS.param),
    "the client sends fit_bands but GET /api/jobs no longer reads it");
  assert.ok(SORTS.options.some(o => o.value === "companyAsc") || (SORTS.dbOnly || []).some(o => o.value === "companyAsc"),
    "the sort panel offers Company A–Z but the server's SORTS does not accept it");
  for (const o of SORT_PANEL) {
    if (o.value === DEFAULT_SORT) continue;
    assert.ok([...SORTS.options, ...(SORTS.dbOnly || [])].some(s => s.value === o.value),
      `the sort panel offers ${o.value}, which GET /api/jobs would 400`);
  }
});

// ── 9. A board cached before D24 reopens CURATED (integration, 10-04) ─────────────────────────
test("D24: a pre-D24 cached 'dateDesc' reopens as the curated default; a post-D24 choice of Newest is kept", async () => {
  const { sortFromCachedSnapshot, SORT_SEMANTICS } = await import("../client/src/lib/filterSentenceModel.js");
  assert.equal(sortFromCachedSnapshot({ sortBy: "dateDesc" }), "", "every pre-D24 board sent dateDesc, meaning curated");
  assert.equal(sortFromCachedSnapshot({ sortBy: "dateDesc", sortSemantics: SORT_SEMANTICS }), "dateDesc", "an explicit Newest after D24 stays Newest");
  assert.equal(sortFromCachedSnapshot({ sortBy: "atsScore" }), "atsScore", "only the ambiguous value is reinterpreted");
  assert.equal(sortFromCachedSnapshot({}), "");
  assert.equal(sortFromCachedSnapshot(null), "");
  const panel = read("client/src/panels/JobsPanel.jsx");
  const written = panel.match(/sortSemantics: (\d+) \}/);
  assert.ok(written, "new snapshots must carry the sort semantics");
  assert.equal(Number(written[1]), SORT_SEMANTICS, "the literal in writeProfileUiCache drifted from SORT_SEMANTICS");
  assert.match(panel, /setSortBy\(sortFromCachedSnapshot\(snapshot\)\)/, "a restored snapshot must go through the rule");
});

// D24 · FULL HOUSE — THE CLIENT HALF: the filter sentence, the sort panel, the two icons.
//
// Built against shared/filterSentence.js (THE CONTRACT, 217d140) while the server half — GET
// /api/jobs/facets, the fit_bands filter, the companyAsc sort — is built in parallel. So these tests
// RENDER the real components (esbuild from client/node_modules, react-dom/server) and feed them a
// synthetic FacetsResponse, instead of waiting on an endpoint that does not exist on this branch yet.
//
// What is held, one test each, because each is a ⛔ in the D24 row:
//   both panels CLOSED BY DEFAULT · MUTUALLY EXCLUSIVE · the filter icon's COUNT BADGE
//   zero-count options DIMMED NOT HIDDEN · the WOULD-EMPTY warning before the press
//   the CAP OF FOUR · the TIE-BREAK text rendered · NO LITERAL OPTION VALUES in the new code
//   and the 404 path: no facets answer means no numbers, never zeros.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { at } from "../test-support/sourceAnchors.js";

import {
  SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, FIT_BANDS, activeClauseCount,
} from "../shared/filterSentence.js";
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE, SORTS } from "../shared/jobFilterOptions.js";
import {
  BOARD_PANEL, BOARD_PANEL_DEFAULT, nextBoardPanel, sentenceClauses, tokenText, pressOption,
  optionRows, footerText, sortRows, tieBreakText, unscoredText, clearAllClauses,
  DEFAULT_SORT, DEFAULT_SORT_ROW, isSortChosen,
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
  clauses: {
    level:  EXPERIENCE_LEVELS.options.map((o, i) => fo(o.value, i === 0 ? 0 : 10 * i, i === 0 ? 0 : 10 * i - 2)),
    where:  WORK_MODELS.options.map((o, i) => fo(o.value, 20 + i)),
    posted: POSTING_AGE.options.filter(o => o.value).map((o, i) => fo(o.value, 5 + i)),
    fit:    FIT_BANDS.options.map((o, i) => fo(o.value, i === 2 ? 0 : 7 + i)),
  },
};
const clause = (key) => SENTENCE_CLAUSES.find(c => c.key === key);
const firstValue = (key) => clause(key).dim.options.find(o => o.value !== "").value;
const firstLabel = (key) => clause(key).dim.options.find(o => o.value !== "").label;

// ── Render the real components ───────────────────────────────────────────────────────────────────
//
// One esbuild bundle of the four components plus react-dom/server, so React is one instance. CSS
// imports become empty modules. Bundled into the OS temp dir and imported from there.
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
        import FilterSentence, { ClausePopover } from ${abs("components/FilterSentence.jsx")};
        import SortPanel from ${abs("components/SortPanel.jsx")};
        import BoardPanelIcons from ${abs("components/BoardPanelIcons.jsx")};
        export const html = (C, props) => renderToStaticMarkup(createElement(C, props));
        export { FilterSentence, ClausePopover, SortPanel, BoardPanelIcons };`,
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

test("D24: BOTH PANELS ARE CLOSED BY DEFAULT — the board starts right under the search bar", async () => {
  assert.equal(BOARD_PANEL_DEFAULT, null);
  const ctx = read("client/src/contexts/JobBoardContext.jsx");
  assert.match(ctx, /const \[boardPanel, setBoardPanel\] = useState\(null\);/,
    "the board's panel state no longer starts closed");
  // JobsPanel renders a panel ONLY for an explicit open value — nothing sits between the bar and
  // the first card otherwise.
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /\{boardPanel === BOARD_PANEL\.FILTER && \(\s*<FilterSentence/);
  assert.match(panel, /\{boardPanel === BOARD_PANEL\.SORT && \(\s*<SortPanel/);
  assert.equal((panel.match(/<FilterSentence\b/g) || []).length, 1);
  assert.equal((panel.match(/<SortPanel\b/g) || []).length, 1);
  // And the icons, rendered closed, say so.
  const { html, BoardPanelIcons } = await loadUi();
  const out = html(BoardPanelIcons, { open: BOARD_PANEL_DEFAULT });
  assert.equal((out.match(/aria-expanded="false"/g) || []).length, 2, out);
  assert.doesNotMatch(out, /aria-expanded="true"/);
});

// ── 2. Mutual exclusivity ───────────────────────────────────────────────────────────────────────

test("D24: the two panels are MUTUALLY EXCLUSIVE — one state, and a press swaps or closes", async () => {
  const { FILTER, SORT } = BOARD_PANEL;
  assert.equal(nextBoardPanel(null, FILTER), FILTER);
  assert.equal(nextBoardPanel(null, SORT), SORT);
  assert.equal(nextBoardPanel(FILTER, SORT), SORT, "opening sort must close the sentence");
  assert.equal(nextBoardPanel(SORT, FILTER), FILTER, "opening the sentence must close sort");
  assert.equal(nextBoardPanel(FILTER, FILTER), null, "pressing the open icon closes it");
  assert.equal(nextBoardPanel(SORT, SORT), null);
  // The icons press through nextBoardPanel on the ONE context value — not two booleans.
  const app = strip(read("client/src/App.jsx"));
  assert.match(app, /onPress=\{\(which\) => setBoardPanel\(current => nextBoardPanel\(current, which\)\)\}/);
  assert.doesNotMatch(read("client/src/contexts/JobBoardContext.jsx"), /\[sortPanelOpen|\[sentenceOpen/,
    "a second open flag is back — two booleans can both be true");
  const { html, BoardPanelIcons } = await loadUi();
  for (const open of [FILTER, SORT]) {
    const out = html(BoardPanelIcons, { open });
    assert.equal((out.match(/aria-expanded="true"/g) || []).length, 1, `${open}: exactly one icon reads open`);
    assert.match(out, new RegExp(`data-board-icon="${open}"(?: data-active="[a-z]+")? aria-expanded="true"`));
  }
});

// ── 3. The badge ────────────────────────────────────────────────────────────────────────────────

test("D24: the filter icon carries a COUNT BADGE — activeClauseCount of the four clauses", async () => {
  const params = {
    [clause("level").dim.param]: [firstValue("level")],
    [clause("posted").dim.param]: firstValue("posted"),
    [clause("where").dim.param]: [],
    [clause("fit").dim.param]: [],
  };
  assert.equal(activeClauseCount(params), 2);
  const { html, BoardPanelIcons } = await loadUi();
  const two = html(BoardPanelIcons, { open: null, badge: 2 });
  assert.match(two, /<span class="bpi__badge" aria-hidden="true">2<\/span>/);
  assert.match(two, /aria-label="Filters \(2 active\)"/);
  const none = html(BoardPanelIcons, { open: null, badge: 0 });
  assert.doesNotMatch(none, /bpi__badge/, "a zero badge is noise — it must not render");
  // Wired: JobsPanel counts its committed clauses with the contract's function and publishes it;
  // App's icon reads exactly that.
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /const clauseCount = countActiveClauses\(clauseParams\);/);
  assert.match(panel, /setActiveClauseCount\?\.\(clauseCount\)/);
  assert.match(strip(read("client/src/App.jsx")), /badge=\{activeClauseCount\}/);
});

// ── 4. Zero dimmed, not hidden ──────────────────────────────────────────────────────────────────

test("D24: a ZERO-COUNT option is DIMMED, NOT HIDDEN — it keeps its row, its 0, and its press", async () => {
  const lvl = clause("level");
  const rows = optionRows(lvl, {}, FACETS);
  assert.equal(rows.length, lvl.dim.options.filter(o => o.value).length, "an option went missing");
  const zero = rows.find(r => r.value === firstValue("level"));
  assert.equal(zero.count, 0);
  assert.equal(zero.dimmed, true);
  const { html, ClausePopover } = await loadUi();
  const out = html(ClausePopover, { id: "p", clause: lvl, params: {}, facets: FACETS, onPress() {}, onAny() {} });
  const row = out.match(new RegExp(`<button[^>]*data-dimmed="true"[^>]*>(?:(?!</button>).)*${firstLabel("level")}(?:(?!</button>).)*</button>`));
  assert.ok(row, `the zero-count ${firstLabel("level")} row is not rendered dimmed:\n${out}`);
  assert.match(row[0], /<span class="fs__opt-n">0<\/span>/, "the 0 itself is information — show it");
  assert.doesNotMatch(row[0], /disabled/, "dimmed, not disabled: it can still be pressed");
  // Every option is rendered, zero or not.
  for (const o of lvl.dim.options.filter(o => o.value)) assert.match(out, new RegExp(`>${o.label}<`));
});

// ── 5. Would-empty, said before the press ───────────────────────────────────────────────────────

test("D24: an option that WOULD EMPTY THE BOARD says so BEFORE it is pressed", async () => {
  const lvl = clause("level");
  const zeroValue = firstValue("level");
  const fresh = optionRows(lvl, {}, FACETS).find(r => r.value === zeroValue);
  assert.equal(fresh.empties, true);
  assert.equal(fresh.note, "Would show no jobs");
  // Already chosen: pressing it REMOVES it, which cannot empty the board.
  const chosen = optionRows(lvl, { [lvl.dim.param]: [zeroValue] }, FACETS).find(r => r.value === zeroValue);
  assert.equal(chosen.empties, false);
  // Added to a multi clause that already has a choice: that widens an OR — it cannot empty either.
  const other = lvl.dim.options.filter(o => o.value)[2].value;
  const widening = optionRows(lvl, { [lvl.dim.param]: [other] }, FACETS).find(r => r.value === zeroValue);
  assert.equal(widening.empties, false);
  assert.equal(widening.dimmed, true, "still dimmed — its own count is still 0");
  // A SINGLE clause replaces its choice, so a zero there always warns. The fit clause (hard filter)
  // with a zero band warns too.
  const fit = clause("fit");
  const weak = optionRows(fit, {}, FACETS).find(r => r.count === 0);
  assert.equal(weak.empties, true);
  // Rendered: the warning is in the markup with nothing pressed.
  const { html, ClausePopover } = await loadUi();
  const out = html(ClausePopover, { id: "p", clause: lvl, params: {}, facets: FACETS, onPress() {}, onAny() {} });
  assert.match(out, /data-empties="true"[^>]*>(?:(?!<\/button>).)*Would show no jobs/);
  assert.equal((out.match(/Would show no jobs/g) || []).length, 1, "only the empty option warns");
  // Counts above `known` are said in plain words: kept, not hidden.
  assert.match(out, /2 have no level on file yet — kept, not hidden/);
});

test("D24: NO FACETS ANSWER, NO NUMBERS — a 404 draws no counts, no dims, no warnings, never zeros", async () => {
  const lvl = clause("level");
  for (const facets of [null, undefined, { total: "x" }, { total: 3 }]) {
    for (const r of optionRows(lvl, {}, facets)) {
      assert.equal(r.count, null);
      assert.equal(r.dimmed, false);
      assert.equal(r.empties, false);
    }
    assert.doesNotMatch(footerText(facets), /\d/);
    assert.doesNotMatch(unscoredText(facets), /\d/);
  }
  assert.equal(footerText(FACETS), "142 jobs match — tap any word to change it");
  assert.equal(footerText({ ...FACETS, total: 1 }), "1 job matches — tap any word to change it");

  // The loader: 404 is "unavailable", anything else bad is "error", and only a well-formed answer
  // is "ready". The fetch is injected — no server.
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

  const { html, FilterSentence, ClausePopover } = await loadUi();
  const out = html(FilterSentence, { params: {}, facets: null, facetsStatus: "unavailable" });
  assert.match(out, /Counts aren(?:&#x27;|')t available on this build yet\./);
  assert.match(out, /Tap any word to change it/);
  const pop = html(ClausePopover, { id: "p", clause: lvl, params: {}, facets: null, noCounts: true, onPress() {}, onAny() {} });
  assert.doesNotMatch(pop, /fs__opt-n/, "a count was drawn without a facets answer");
  assert.doesNotMatch(pop, /data-dimmed="true"|data-empties="true"/);
});

// ── 6. The cap ──────────────────────────────────────────────────────────────────────────────────

test("D24: THE CAP OF FOUR — the sentence renders at most SENTENCE_CAP clauses, by decision", async () => {
  assert.equal(SENTENCE_CAP, 4);
  assert.ok(SENTENCE_CLAUSES.length <= SENTENCE_CAP, "the contract grew past its own cap");
  assert.equal(sentenceClauses().length, Math.min(SENTENCE_CLAUSES.length, SENTENCE_CAP));
  // Enforced, not merely documented: a fifth clause in the contract would still render four.
  assert.match(read("client/src/lib/filterSentenceModel.js"), /SENTENCE_CLAUSES\.slice\(0, SENTENCE_CAP\)/);
  const { html, FilterSentence } = await loadUi();
  const out = html(FilterSentence, { params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.equal((out.match(/class="fs__token"/g) || []).length, SENTENCE_CAP);
  // The prose is the contract's, in order.
  const text = out.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  assert.match(text, /^Show me any level jobs that are anywhere, posted any time, where my fit is anything\./);
  assert.match(text, /142 jobs match — tap any word to change it/);
  assert.match(text, /Clear all ×/);
});

test("D24: tokens read the band WORD and the chosen labels; a press toggles or replaces", () => {
  const fit = clause("fit");
  const strong = FIT_BANDS.options[0];
  assert.equal(tokenText(fit, { [fit.dim.param]: [strong.value] }), strong.label);
  assert.doesNotMatch(tokenText(fit, { [fit.dim.param]: [strong.value] }), /\d/, "the fit clause shows a number");
  const lvl = clause("level");
  const [a, b] = lvl.dim.options.filter(o => o.value);
  assert.equal(tokenText(lvl, { [lvl.dim.param]: [a.value, b.value] }), `${a.label} or ${b.label}`);
  assert.deepEqual(pressOption(lvl, { [lvl.dim.param]: [a.value] }, b.value), { [lvl.dim.param]: [a.value, b.value] });
  assert.deepEqual(pressOption(lvl, { [lvl.dim.param]: [a.value] }, a.value), { [lvl.dim.param]: [] });
  const posted = clause("posted");
  const [p1, p2] = posted.dim.options.filter(o => o.value);
  assert.deepEqual(pressOption(posted, { [posted.dim.param]: p1.value }, p2.value), { [posted.dim.param]: p2.value });
  assert.deepEqual(pressOption(posted, { [posted.dim.param]: p1.value }, p1.value), { [posted.dim.param]: "" });
  assert.equal(tokenText(posted, { [posted.dim.param]: p1.value }), p1.label.toLowerCase(), "posting age reads as prose");
  // Clear all returns every clause to "any".
  const cleared = clearAllClauses();
  assert.equal(activeClauseCount(cleared), 0);
  assert.equal(Object.keys(cleared).length, SENTENCE_CLAUSES.length);
});

// ── 7. The sort panel: tie-breaks visible ───────────────────────────────────────────────────────

test("D24: the SORT PANEL renders every label, subtitle and its TIE-BREAK chain, and the unscored line", async () => {
  const best = SORT_PANEL.find(o => o.unscoredLast);
  assert.equal(tieBreakText(best), "Ties broken by: newest first, then company A–Z");
  assert.equal(unscoredText(FACETS), "37 jobs have no score and sort last — Newest shows everything");
  const { html, SortPanel } = await loadUi();
  const out = html(SortPanel, { value: "dateDesc", atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
  const text = out.replace(/<[^>]+>/g, "|");
  for (const o of SORT_PANEL) {
    assert.ok(text.includes(o.label), `${o.label} is missing`);
    assert.ok(text.includes(o.subtitle), `${o.label}'s subtitle is missing`);
    assert.ok(text.includes(tieBreakText(o)), `${o.label}'s tie-break is not visible`);
  }
  assert.ok(text.includes("37 jobs have no score and sort last — Newest shows everything"));
  assert.match(out, /role="radio" aria-checked="true" class="sp__row"><span class="sp__label">Newest</);
  // Without a résumé, Best fit is not offered (the 2026-09-26 rule) — and its line goes with it.
  const noFit = html(SortPanel, { value: "dateDesc", atsAvailable: false, facets: FACETS, facetsStatus: "ready" });
  assert.ok(!noFit.includes(`>${best.label}<`));
  assert.deepEqual(sortRows(false).map(r => r.value),
    [DEFAULT_SORT, ...SORT_PANEL.filter(o => !o.unscoredLast).map(o => o.value)]);
  // No facets: the line still says it, without a number.
  const unknown = html(SortPanel, { value: "dateDesc", facets: null, facetsStatus: "unavailable" });
  assert.match(unknown, /Jobs with no score sort last — Newest shows everything/);
});

// ── 7b. The curated default sends NO sort ───────────────────────────────────────────────────────

test("D24: the DEFAULT board request carries NO sort param — the curated order; Newest is explicit", async () => {
  // Server half (45f0f27): GET /api/jobs with no `sort` is the curated board (relevance and fit
  // first); an explicit sort=dateDesc is truly newest-first. So the board's state starts at "", and
  // buildParams emits `sort` only when one was chosen.
  assert.equal(DEFAULT_SORT, "");
  const ctx = read("client/src/contexts/JobBoardContext.jsx");
  assert.match(ctx, /const \[sortBy,\s+setSortBy\]\s+= useState\(""\);/, "the board no longer starts on the curated default");
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  const bp = panel.slice(at(panel, "const buildParams = useCallback"), at(panel, "}, [sortBy"));
  assert.match(bp, /if \(sortBy\)\s+p\.set\("sort", sortBy\);/, "buildParams sends a sort when none was chosen");
  assert.doesNotMatch(bp, /^\s*p\.set\("sort", sortBy\);/m, "an unconditional sort is back");
  assert.match(panel, /setSortBy\(snapshot\.sortBy \|\| ""\)/, "a restored board without a sort must stay curated");
  // Simulate the emission rule on the default state: no sort key at all.
  const p = new URLSearchParams(); const sortBy = ""; if (sortBy) p.set("sort", sortBy);
  assert.equal(p.has("sort"), false);
  // The panel's way back: "For you" first, checked by default, clearing the param.
  assert.equal(sortRows(true)[0], DEFAULT_SORT_ROW);
  assert.equal(isSortChosen(""), false);
  assert.equal(isSortChosen("dateDesc"), true, "Newest is a CHOSEN sort now, not the default");
  const { html, SortPanel, BoardPanelIcons } = await loadUi();
  const out = html(SortPanel, { value: "", atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
  assert.match(out, new RegExp(`aria-checked="true" class="sp__row"><span class="sp__label">${DEFAULT_SORT_ROW.label}<`));
  assert.equal((out.match(/aria-checked="true"/g) || []).length, 1);
  // The sort icon shows a non-default order without opening anything.
  assert.match(html(BoardPanelIcons, { sortChosen: true }), /data-board-icon="sort" data-active="true"/);
  assert.match(html(BoardPanelIcons, { sortChosen: false }), /data-board-icon="sort" data-active="false"/);
  assert.match(strip(read("client/src/App.jsx")), /sortChosen=\{isSortChosen\(sortBy\)\}/);
});

// ── 8. No literal option values ─────────────────────────────────────────────────────────────────

test("D24: NO LITERAL OPTION VALUE OR LABEL in the new client code — everything renders from the contract", () => {
  const files = [
    "client/src/lib/filterSentenceModel.js", "client/src/lib/jobFacets.js",
    "client/src/hooks/useJobFacets.js", "client/src/components/FilterSentence.jsx",
    "client/src/components/SortPanel.jsx", "client/src/components/BoardPanelIcons.jsx",
  ];
  const vocab = new Set();
  for (const c of SENTENCE_CLAUSES) {
    vocab.add(c.dim.param);
    for (const o of c.dim.options) { if (o.value) vocab.add(o.value); vocab.add(o.label); }
  }
  for (const o of SORT_PANEL) { vocab.add(o.value); vocab.add(o.label); vocab.add(o.subtitle); }
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
  // The D24 block in JobsPanel binds clauses by the contract's clause KEY and emits fit by
  // FIT_BANDS.param — never by a written param name.
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /p\.set\(FIT_BANDS\.param,\s*fitBands\.join\(","\)\)/);
  assert.ok(!panel.includes(`"${FIT_BANDS.param}"`), "JobsPanel writes the fit param name literally");
  // App's sort list is SORT_PANEL through sortRows — no copy.
  assert.match(strip(read("client/src/App.jsx")), /sortRows\(atsSortAvailable\)/);
});

// ── 9. The server side of the two new params — HELD ONCE THE SERVER HALF IS MERGED ─────────────

test("D24: the server reads fit_bands and offers companyAsc (the server half — todo until merged)", (t) => {
  const server = read("server.js");
  const jobQuery = read("services/jobs/jobQuery.js");
  const merged = server.includes(FIT_BANDS.param) || jobQuery.includes(FIT_BANDS.param);
  if (!merged) {
    t.todo("server half not merged on this branch: GET /api/jobs does not read fit_bands yet, " +
           "and SORTS has no companyAsc — the client already sends both");
    return;
  }
  assert.ok(SORTS.options.some(o => o.value === "companyAsc") || (SORTS.dbOnly || []).some(o => o.value === "companyAsc"),
    "the sort panel offers Company A–Z but the server's SORTS does not accept it");
  for (const o of SORT_PANEL) {
    if (o.value === DEFAULT_SORT) continue;
    assert.ok([...SORTS.options, ...(SORTS.dbOnly || [])].some(s => s.value === o.value),
      `the sort panel offers ${o.value}, which GET /api/jobs would 400`);
  }
});

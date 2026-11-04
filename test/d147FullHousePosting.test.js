// ⭐ D147 (owner 11-03, docs/sketches/fullhouse-declutter.html) — FULL HOUSE AND THE OPENED POSTING, RESTYLED.
//
// A restyle, not a rebuild: the panels, the ATS panel and the navigation keep their behaviour. What this file holds:
//   THE PAGE     the title + ONE Sort / view word · the sentence that filters (kept, its words still the controls) in the
//                serif · the search under it · jobs · new today · saved · the postings · no symbol view counts on the
//                first screen (ALL · ★ · /d · + became words inside the Sort / view panel) · scrolling, not page numbers
//                · the extension prompt once, dismissible.
//   THE POSTING  header: logo (→ the company's hiring data) · company name (→ the original posting) · location · Close;
//                the role; the facts box with the match box at its end (→ the existing ATS panel); the job description,
//                nothing between; Pass · Save · Draft · More at the foot, More holding Résumé for this job · Cover
//                letter · I applied myself.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const app = read("client/src/App.jsx");
const jd = read("client/src/components/JobDetailPanel.jsx");
const jdCss = read("client/src/components/JobDetailPanel.css");
const posting = read("client/src/components/PostingPanel.jsx");
const postingCss = read("client/src/components/PostingPanel.css");
const fhCss = read("client/src/components/FullHouse.css");
const jobs = read("client/src/panels/JobsPanel.jsx");
const acts = jd.slice(at(jd, "function PostingActions("), at(jd, "export default function JobDetailPanel("));
const header = jd.slice(at(jd, '<div className="pp__hd" data-posting-header="">'), at(jd, "{(pendingState ==="));

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
        import PostingPanel from ${abs("components/PostingPanel.jsx")};
        import SortPanel from ${abs("components/SortPanel.jsx")};
        import { SortWord } from ${abs("components/BoardBar.jsx")};
        import { boardCounts } from ${abs("lib/filterSentenceModel.js")};
        export const html = (C, props, ...kids) => renderToStaticMarkup(createElement(C, props, ...kids));
        export const h = createElement;
        export { PostingPanel, SortPanel, SortWord, boardCounts };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d147-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// A synthetic posting with every optional fact on file.
const JOB = {
  id: 7, jobId: "j7", title: "Senior Data Engineer", company: "Northwind", location: "Boston, MA",
  tagWorkplace: "hybrid", salaryMin: 165000, salaryMax: 190000, postedAt: new Date(Date.now() - 86400000).toISOString(),
  description: "We are hiring.\n\nRequirements:\n- 5+ years of experience building pipelines\n- SQL and Python",
  liveness: { kind: "open_long", label: "Open 94 days" },
  sponsorship: { level: "often", label: "Sponsors often", line: "Filed 140 LCAs", notice: "Not legal advice.", facts: [{ kind: "lca", text: "140 certified LCAs in FY2025" }], sources: [{ name: "DOL", through: "2025-09" }] },
  requirements: { citizenship: "citizen_only" },
  ghost: { level: "likely_not_hiring", evidence: ["Reposted 4 times"] },
  levelRead: { disagreement: { direction: "higher", text: "The text reads more senior than the title." } },
  eligibility: { state: "unknown" }, matchScore: 86,
};

test("d147FilterSentenceKept · the sentence that filters stays — its words still open their filters — restyled in the serif", () => {
  assert.match(app, /<header className="fh" data-fh-d147=""[^>]*>\s*<BoardTitleRow \/>\s*<BoardHeadlineSlot \/>/);
  assert.match(app, /<BoardHeadline params=\{params\}[^>]*\n\s+open=\{boardPanel\} onToggle=\{\(key\) => setBoardPanel\(current => nextBoardPanel\(current, key\)\)\} \/>/,
    "a word's press still opens its filter");
  // The serif at about 30px, through the sentence's TOKENS (D34: no token rule names a font).
  assert.match(fhCss, /\.fh\[data-fh-d147\] \{\s+--fh-sentence-family: var\(--font-display\); --fh-sentence-size: calc\(min\(30px, 7vw\) \* var\(--type-scale, 1\)\);/, "≈ 30px, following the text size (A116)");
  // The marked look (the default) underlines every changeable word in the accent, a SET one too (no orange box).
  const marked = fhCss.slice(at(fhCss, '[data-sentence="marked"] {'), at(fhCss, '[data-sentence="calm"] {'));
  assert.match(marked, /--tok-depth: inset 0 -1\.5px 0 var\(--c-accent\);/, "underlined in the accent");
  assert.match(marked, /--tok-on-fill: transparent;[^}]*--tok-on-depth: inset 0 -1\.5px 0 var\(--c-accent\);/, "a set word keeps the underline");
  // The search sits under it — the sticky bar holds the search alone.
  const bar = app.slice(at(app, "function BoardBar() {"), at(app, "// ⭐ D147 · THE TITLE ROW"));
  assert.match(bar, /<BoardSearchBar \/>/);
  assert.doesNotMatch(bar, /<BoardTabs|<BoardControlIcons/);
});

test("d147PostingsRowsRestyledOnly · the postings are the board's own rows — the same JobBubble with the same decisions", () => {
  assert.match(jobs, /<JobBubble\s+key=\{key\} job=\{job\}\s+score=\{scoresFor\(job, g\)\.shown\}/);
  assert.match(jobs, /onSave=\{\(\) => decideJob\?\.\(job, DECISIONS\.SAVED\)\}/);
  assert.match(jobs, /onDraft=\{\(\) => decideJob\?\.\(job, DECISIONS\.DRAFTED\)\}/);
});

test("d147NoSymbolCounts · ALL · ★ · /d · + are words inside the Sort / view control, not on the first screen", async () => {
  const tabs = app.slice(at(app, "const BOARD_TABS = ["), at(app, "const BOARD_VIEW_WORDS"));
  for (const [id, word] of [["all", "All jobs"], ["saved", "Saved"], ["pending", "Pending"], ["imported", "Imported"]]) {
    assert.match(tabs, new RegExp(`\\["${id}",\\s+"${word}"`), `${id} is the word ${word}`);
  }
  assert.doesNotMatch(tabs, /"ALL"|"★"|"\+"|DraftMark/, "a symbol is back");
  // The views render only inside the sort panel.
  assert.equal((app.match(/<BoardTabs \/>/g) || []).length, 1);
  assert.match(app.slice(at(app, "function BoardSortSlot()"), at(app, "function BoardBar()")), /<BoardTabs \/>/);
  const { html, h, SortPanel, SortWord } = await loadUi();
  const panel = html(SortPanel, { value: "", atsAvailable: false }, h("span", { "data-kid": "views" }, "views"));
  assert.match(panel, /data-sort-views=""[^>]*><span class="fh-k">Show<\/span><span data-kid="views">/);
  assert.match(html(SortWord, { label: "Newest", view: "Saved", chosen: true }), /data-board-icon="sort" data-active="true"[^>]*>.*<span>Sort: Newest · Saved<\/span>/);
  assert.match(html(SortWord, { label: "For you" }), /<span>Sort: For you<\/span>/);
  assert.match(html(SortWord, {}), /<span>Sort<\/span>/, "no label from the contract, no invented one");
  // Page numbers → scrolling.
  assert.doesNotMatch(jobs, /Go to page|buildVisiblePageItems|commitPageJump/);
  assert.match(jobs, /<BoardMore shown=\{jobs\.length\} total=\{totalJobs\} more=\{currentPage < totalPages\} onMore=\{onLoadMore\}/);
  assert.match(jobs, /await fetchJobs\(currentPage \+ 1, true, plan\.cursor \? \{ cursor: plan\.cursor \} : \{\}\);/, "the next page is appended");
  assert.match(jobs, /new IntersectionObserver\(\(entries\) => \{ if \(entries\.some\(e => e\.isIntersecting\)\) onMore\?\.\(\); \}/);
  // The minimal counts, each from the facets answer.
  const { boardCounts } = ui;
  const facets = { total: 746, clauses: { posted: [{ value: "", count: 746 }, { value: "1d", count: 38 }] }, views: { all: 746, saved: 12, pending: 3, imported: 0 } };
  assert.deepEqual(boardCounts(facets), { jobs: 746, newToday: 38, saved: 12 });
  assert.deepEqual(boardCounts(null), { jobs: null, newToday: null, saved: null }, "no answer, no number");
  // The extension prompt: once, dismissible.
  const ext = read("client/src/components/ExtensionPrompt.jsx");
  assert.match(ext, /const \[dismissed, setDismissed\] = useState\(\(\) => readDismissed\(\) \|\| seenBefore\(\)\);/);
  assert.match(ext, />Not now<\/button>/);
});

test("d147CompanyNameOpensOriginal · the company name is the one CompanyLink to the original posting, the location under it", () => {
  assert.match(header, /<CompanyLink company=\{selectedJob\.company\} href=\{postingUrl \|\| null\} jobId=\{jobId\} size="panel" onOpen=\{openedPosting\} \/>/);
  assert.match(jd, /const postingUrl = selectedJob\?\.applyUrl \|\| selectedJob\?\.url \|\| null;/);
  assert.match(header, /<span className="pp__loc" data-posting-location="">\{selectedJob\.location\}<\/span>/);
});

test("d147LogoShowsHiringData · the company bubble opens the company's hiring data (CompanyViewModal, unchanged)", () => {
  assert.match(header, /<button type="button" className="pp__logo" onClick=\{\(\) => setShowCompanyView\(true\)\} title=\{`Hiring at \$\{selectedJob\.company\}`\}/);
  assert.match(jd, /<CompanyViewModal company=\{selectedJob\.company\} onClose=\{\(\) => setShowCompanyView\(false\)\} \/>/);
  const modal = read("client/src/components/CompanyViewModal.jsx");
  for (const s of ["<StackSection", "<HiringSection", "<SponsorshipSection"]) assert.ok(modal.includes(s), s);
});

test("d147FactsBoxReused · the existing deck strip, restyled into one box; history / sponsorship / requirements only as cells", async () => {
  const { html, PostingPanel } = await loadUi();
  const out = html(PostingPanel, { job: JOB, layout: "panel", matchBox: "MATCH" });
  const cells = [...out.matchAll(/data-cell="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(cells, ["experience", "workstyle", "salary", "posted", "history", "sponsorship", "requirements"]);
  // D149 (11-03) changed this on purpose: the box still reads the deck strip, its values said in the sketch's words
  // ("5+ years", "9 hours ago") by panelWords — the deck's own strip is unchanged.
  assert.match(posting, /const cells = deckStrip\(job, \{ experience \}\)\.map\(c => panelWords\(c, job\)\);\n\s+const extra = \[\];/, "the deck strip is the box's source");
  // A posting without the optional facts draws only the four.
  const bare = html(PostingPanel, { job: { ...JOB, liveness: null, sponsorship: null, requirements: null }, layout: "panel" });
  assert.deepEqual([...bare.matchAll(/data-cell="([a-z]+)"/g)].map(m => m[1]), ["experience", "workstyle", "salary", "posted"]);
  assert.match(postingCss, /\.posting__facts \{\s+display: grid; grid-template-columns: minmax\(0, 1fr\) auto;/);
  // The deck's own masthead is untouched (layout defaults to "deck").
  const deck = html(PostingPanel, { job: JOB, showTitle: false });
  assert.match(deck, /data-posting-layout="deck"/);
  assert.match(deck, /data-posting-liveness=/, "the deck still draws its lines");
});

test("d147MatchBoxOpensExistingAtsPanel · the match box ends the facts box and opens the existing ATS panel", async () => {
  assert.match(jd, /matchBox=\{<AtsNumberBox score=\{scores\.shown\} tailored=\{scores\.tailoredShown\} base=\{scores\.base\} caption="match"\s+open=\{!!selectedJobMeta\?\.atsOpen\} onOpen=\{\(\) => selectedJobMeta\?\.onAts\?\.\(\)\} \/>\}/);
  assert.ok(!header.includes("<AtsNumberBox"), "not in the header any more");
  const { html, h, PostingPanel } = await loadUi();
  const out = html(PostingPanel, { job: JOB, layout: "panel", matchBox: h("b", { "data-m": "1" }, "86") });
  assert.ok(at(out, 'data-cell="requirements"') < at(out, 'data-posting-match=""'), "the match box is the box's last cell");
  assert.match(out, /<div class="posting__match" data-posting-match=""><b data-m="1">86<\/b><\/div>/);
});

test("d147PostingFollowsFacts · nothing between the facts box and the job description", async () => {
  const { html, PostingPanel } = await loadUi();
  const out = html(PostingPanel, { job: JOB, layout: "panel", matchBox: "M" });
  const between = out.slice(at(out, "</header>"), at(out, "data-posting-body"));
  assert.doesNotMatch(between, /data-posting-(liveness|ghost|level|requirements|details|sponsorship-signal)|data-apply-line|posting__cell-more/);
  assert.doesNotMatch(out, /data-posting-kicker|class="posting__company"/, "no kicker, no second company line");
  // The warm paths and the applicant count follow the posting.
  assert.ok(at(jd, "</PostingPanel>") < at(jd, "<WarmPathsBlock"), "warm paths after the posting");
});

test("d147NoShouldYouApply · no 'In short' / ghost / level lines in the opened posting", async () => {
  const { html, PostingPanel } = await loadUi();
  const out = html(PostingPanel, { job: JOB, layout: "panel" });
  assert.doesNotMatch(out, /In short|Hiring\?|data-apply-line|data-posting-ghost|data-posting-level/);
  assert.doesNotMatch(out, /Should you apply/i);
});

test("d147ActionsPassSaveDraftMore · Pass · Save · Draft · More, one row at the panel's foot", () => {
  const row = acts.slice(at(acts, '<div className="pp__main-acts"'), at(acts, "{more && ("));
  // D149 (11-03) changed this on purpose: fullhouse-declutter.html's .ua is four PLAIN buttons (no glyphs, no logo face),
  // so the row draws its own — the same states and calls (Pass / Save SET; Draft is draftButtonState's, D51).
  const order = ['data-decision="pass"', 'data-decision="save"', 'data-decision="draft"', 'className="pp__moreb"'].map(s => row.indexOf(s));
  assert.match(row, /onClick=\{onPass\}/); assert.match(row, /onClick=\{onSave\}/); assert.match(row, /title=\{draft\.title\} onClick=\{draftClick\}/);
  assert.match(acts, /const draftClick = draft\.action === "draft" \? onDraft : draft\.action === "view" \? onViewDraft/);
  assert.ok(order.every(i => i >= 0), "a piece of the row is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(row, />More<\/button>/);
  assert.match(jdCss, /\.pp__main-acts \{ display: grid; grid-template-columns: 1fr 1fr 1\.4fr auto;/);
  assert.match(jd, /<div className="pp__foot" data-posting-actions-bar="">/);
  // Close is a small word in the header now.
  assert.match(header, /aria-label="Close the posting" title="Close" data-posting-close="">Close<\/button>/);
});

test("d147UtilityBehaviourKept · each folded button's action is reachable under its new label", () => {
  const more = acts.slice(at(acts, "{more && ("), at(acts, "{/* ⭐ D57: the state, in words"));
  // 📄 → "Résumé for this job": the same Generate (and BYOM split), View, Download, Regenerate.
  // D149 (11-03) changed this on purpose: the More buttons are the sketch's plain .btn (no DepthButton icons), same calls.
  assert.match(more, /<button type="button" className="pp__btn" onClick=\{\(\) => onGenerate\(false\)\}[^>]*\n?[^>]*>\s+\{generateLoading \? "Generating…" : "Résumé for this job"\}/);
  assert.match(more, /split\(false, "Résumé for this job", \(\) => onGenerate\(false\)\)/);
  assert.match(more, /onClick=\{\(\) => onViewSandbox\?\.\(\)\}/);
  assert.match(more, /onClick=\{\(\) => onExport\?\.\(\)\}/);
  assert.match(more, /onClick=\{regen\}/);
  // ✉ is the COVER LETTER in the code (ICONS.letter, onCoverLetter) — kept as itself.
  assert.match(more, /<button type="button" className="pp__btn" onClick=\{onCoverLetter\}[^>]*>Cover letter<\/button>/);
  // "I submitted it" → "I applied myself": the same evidence form and route.
  assert.match(more, /<ManualSubmitted jobId=\{job\.jobId\} \/>/);
  assert.match(jd, /className="pp__btn pp__submitted-btn" onClick=\{\(\) => setOpen\(true\)\}>I applied myself<\/button>/);
  assert.match(jd, /api\(`\/api\/applications\/pending\/\$\{encodeURIComponent\(jobId\)\}\/record`/);
  // ✕ → the header's Close (the same close); ★ and /d → Save and Draft in the row.
  assert.match(jd, /const close = useCallback\(\(\) => setSelectedJob\(null\), \[setSelectedJob\]\);/);
  assert.match(header, /onClick=\{close\}/);
  // More opens in place, resets per posting, and opens by itself while a résumé is being made.
  assert.match(acts, /useEffect\(\(\) => \{ setMore\(false\); \}, \[job\?\.jobId\]\);/);
  assert.match(acts, /useEffect\(\(\) => \{ if \(generateLoading\) setMore\(true\); \}, \[generateLoading\]\);/);
});

test("d147PhoneFullScreen · on a phone the posting is full screen (the panel host's fallback) and its layout folds", () => {
  // The JD panel is one peer in the dock; a narrow viewport renders the dock full screen (usePanelHost).
  assert.match(jobs, /<PanelDock width=\{dockWidth\} fullScreen=\{panelsFullScreen && openPanelCount > 0\}>/);
  // The facts two by two with the match box as its own row; the actions fold under a narrow panel.
  assert.match(postingCss, /\.posting__facts \{ grid-template-columns: 1fr; \}/);
  assert.match(postingCss, /\.posting__match \{ border-left: 0; border-top: 1px solid var\(--c-pair-rule\); \}/);
  assert.match(jdCss, /@container pp \(max-width: 420px\) \{ \.pp__main-acts \{ grid-template-columns: 1fr 1fr 1\.3fr; \} \.pp__moreb \{ grid-column: 1 \/ -1;/);
});

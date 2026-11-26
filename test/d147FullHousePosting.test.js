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
        import { MarketSortButton as SortIcon } from ${abs("plate/MarketControls.jsx")};   // 47j R2: the cartouche's sort
        import { boardCounts } from ${abs("lib/filterSentenceModel.js")};
        export const html = (C, props, ...kids) => renderToStaticMarkup(createElement(C, props, ...kids));
        export const h = createElement;
        export { PostingPanel, SortPanel, SortIcon, boardCounts };`,
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
  // ⭐ D156 (5), changed on purpose: no title row before the sentence (the sort is an icon in the search field).
  assert.match(app, /<header className="fh" data-fh-d147=""[^>]*>\s*<BoardHeadlineSlot \/>/);   // A125: Home's header is the only one
  // 47j R2 (changed on purpose): the sentence is the cartouche's (PlateBearing); a word's press goes through the same rule
  assert.match(app, /const toggle = \(key\) => setBoardPanel\(current => nextBoardPanel\(current, key\)\);/);
  assert.match(app, /<PlateBearing params=\{params\}[^>]*\n\s+open=\{boardPanel\} onToggle=\{toggle\}/, "a word's press still opens its filter");
  // The serif at about 30px, through the sentence's TOKENS (D34: no token rule names a font).
  // ⭐ D156 (1d) (changed on purpose): the sentence's ORIGINAL type (FULL_HOUSE_TYPE, the logo face) — D147's serif override
  // is withdrawn; only the size stays here, the original's times the text size (A116).
  assert.doesNotMatch(fhCss, /--fh-sentence-family: var\(--font-display\)/);
  assert.match(fhCss, /\.fh\[data-fh-d147\] \{ --fh-sentence-size: calc\(min\(30px, 6\.4vw\) \* var\(--type-scale, 1\)\); \}/, "≈ 30px, following the text size (A116)");
  // ⭐ D156 (1d) (changed on purpose): the marked look is the ORIGINAL one again (7ebed68) — the quiet highlighter underline,
  // and a SET filter is the one orange box (no --tok-on-* overrides); D147's accent underline is withdrawn.
  const marked = fhCss.slice(at(fhCss, '[data-sentence="marked"] {'), at(fhCss, '[data-sentence="calm"] {'));
  assert.match(marked, /--tok-depth: inset 0 -\.16em 0 var\(--c-accent-quiet\);/, "the highlighter underline");
  assert.doesNotMatch(marked, /--tok-on-fill/, "a set word is the orange box");
  // The search sits under it — the sticky bar holds the search alone.
  // ⭐ D156 (5), changed on purpose: the search holds the sort icon; the views are their own row under it.
  // 47j R2 (changed on purpose): the classic bar is deleted — the search and the sort sit in the cartouche's row
  assert.match(app, /<MarketSearchRow search=\{<BoardSearchBar [\s\S]{0,160}?\/>\}\s*sort=\{<MarketSortSlot \/>\} \/>/);
  assert.doesNotMatch(app, /<BoardTabs|function BoardBar\(\)/);
});

// 47j R2 (changed on purpose): the classic bubble rows (JobBubble in JobBubbleRows) are deleted — the board's rows are the
// Index's (MarketIndexTable), each row's bubble wired to the SAME decisions.
test("d147PostingsRowsRestyledOnly · the postings are the board's own rows — the Index's rows with the same decisions", () => {
  assert.doesNotMatch(jobs, /<JobBubble\b|<JobBubbleRows\b/, "the classic bubble rows are back");
  assert.match(jobs, /rows=\{jobs\.map\(\(job, i\) => indexRow\(job, i, \{ score: scoresFor\(job, generated\[job\.jobId\]\)\.shown,/);
  assert.match(jobs, /onSave=\{\(\) => decideJob\?\.\(r\.job, DECISIONS\.SAVED\)\}/);
  assert.match(jobs, /onDraft=\{\(\) => decideJob\?\.\(r\.job, DECISIONS\.DRAFTED\)\}/);
});

test("d147NoSymbolCounts · ALL · ★ · /d · + are words, not symbols (⭐ D156: a row under the search)", async () => {
  // ⭐ D156 (4), changed on purpose: All jobs · Starred · Imported (no Pending view), with counts.
  // 47j R2 (changed on purpose): the views are the shell's area nav (MARKET_AREA_VIEWS), still words, never symbols
  const tabs = app.slice(at(app, "const MARKET_AREA_VIEWS = ["), at(app, "];", at(app, "const MARKET_AREA_VIEWS = [")));
  for (const [id, word] of [["all", "All jobs"], ["saved", "Starred"], ["imported", "Imported"]]) {
    assert.match(tabs, new RegExp(`id: "${id}", label: "${word}"`), `${id} is the word ${word}`);
  }
  assert.doesNotMatch(tabs, /"ALL"|"★"|"\+"|DraftMark/, "a symbol is back");
  assert.doesNotMatch(app, /<BoardTabs \/>|const BOARD_TABS = \[/, "the classic views segment is back");
  const { html, SortPanel, SortIcon } = await loadUi();
  assert.doesNotMatch(html(SortPanel, { value: "", atsAvailable: false }), /data-sort-views/, "the views left the sort panel");
  // ⭐ D156 (5): the sort is an icon; its label says the current order.
  assert.match(html(SortIcon, { label: "Newest", chosen: true }), /data-board-icon="sort" data-active="true"[^>]*aria-label="Sort: Newest — change the order"/);
  assert.match(html(SortIcon, { label: "For you" }), /aria-label="Sort: For you — change the order"/);
  // 47j R2: the cartouche's sort always has a word — the board's own order reads "Best match" (MarketSortSlot passes the chosen one)
  assert.match(html(SortIcon, {}), /aria-label="Sort: Best match — change the order"/);
  // 47j R2 (changed on purpose): D147's endless scroll (BoardMore) is deleted — D199 C3's pages (MarketPager) replace it
  assert.doesNotMatch(jobs, /Go to page|buildVisiblePageItems|commitPageJump/);
  assert.doesNotMatch(jobs, /<BoardMore\b|function BoardMore\(/, "the endless-scroll line is back");
  assert.match(app, /<MarketPager page=\{boardPager\.page\}/);
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
  assert.match(header, /<CompanyLink company=\{selectedJob\.company\} jobId=\{jobId\} size="panel" \/>/);
  assert.match(jd, /const postingUrl = selectedJob\?\.applyUrl \|\| selectedJob\?\.url \|\| null;/);
  assert.match(header, /<span className="pp__loc" data-posting-location="">\{selectedJob\.location\}<\/span>/);
});

test("d147LogoShowsHiringData · the company bubble opens the company's hiring data (CompanyViewModal, unchanged)", () => {
  assert.match(header, /<button type="button" className="pp__logo" onClick=\{\(\) => \(companyPath\(selectedJob\.company, \{ job: jobId \}\) \? navigate\(companyPath\(selectedJob\.company, \{ job: jobId \}\)\) : setShowCompanyView\(true\)\)\} title=\{`Hiring at \$\{selectedJob\.company\}`\}/);
  assert.match(jd, /<CompanyViewModal company=\{selectedJob\.company\} onClose=\{\(\) => setShowCompanyView\(false\)\} \/>/);
  const modal = read("client/src/components/CompanyViewModal.jsx");
  for (const s of ["<StackSection", "<HiringSection", "<SponsorshipSection"]) assert.ok(modal.includes(s), s);
});

test("d147FactsBoxReused · the existing deck strip, restyled into one box; history / sponsorship / requirements only as cells", async () => {
  const { html, PostingPanel } = await loadUi();
  const out = html(PostingPanel, { job: JOB, layout: "panel", matchBox: "MATCH" });
  const cells = [...out.matchAll(/data-cell="([a-z]+)"/g)].map(m => m[1]);
  // ⭐ A217 (46r) changed this on purpose: JOB's history is "Open 94 days" beside a posted cell — the same fact twice —
  // so the box leaves it out; a REPOST is news the posted cell does not carry, and keeps its cell.
  assert.deepEqual(cells, ["experience", "workstyle", "salary", "posted", "sponsorship", "requirements"]);
  const reposted = html(PostingPanel, { job: { ...JOB, liveness: { kind: "reposted", label: "Reposted 4 times since June" } }, layout: "panel" });
  assert.deepEqual([...reposted.matchAll(/data-cell="([a-z]+)"/g)].map(m => m[1]), ["experience", "workstyle", "salary", "posted", "history", "sponsorship", "requirements"]);
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

// ⭐ D152 (8), changed on purpose (11-04, option A): the match box opens the existing report IN the posting, under the facts
// (the one loader, ATSPanel), instead of the separate panel over the page — test/d152Home.test.js walks it in Chrome.
test("d147MatchBoxOpensExistingAtsPanel · the match box ends the facts box and opens the existing report, in the posting", async () => {
  assert.match(jd, /matchBox=\{<AtsNumberBox score=\{scores\.shown\} tailored=\{scores\.tailoredShown\} base=\{scores\.base\} caption="match"\s+open=\{matchOpen\} onOpen=\{\(\) => \{ setMatchMounted\(true\); setMatchOpen\(o => !o\); \}\} \/>\}/);
  assert.match(jd, /<ATSPanel report=\{selectedJobMeta\?\.atsPayload\?\.report\}/);
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
  // ⭐ D164 (11-05) changed this on purpose: a quiet Résumé control sits between Draft and More — one more auto column
  // (the résumé controls had been folded under More, and the owner read them as gone; docs/D164_ACTIONS.md).
  assert.match(jdCss, /\.pp__main-acts \{ display: grid; grid-template-columns: 1fr 1fr 1\.4fr auto auto;/);
  assert.match(jd, /<div className="pp__foot" data-posting-actions-bar="">/);
  // ⭐ A217 (46r, the 46q audit): D149's row followed the posting (`position: static`), so at 1440 Draft / Save sat below a
  // long description, out of view. The last word on .pp__foot pins it to the panel's foot again, on the card's surface (owner 11-17: "pin it").
  const footRules = [...jdCss.matchAll(/^\.pp__foot \{([^}]*)\}/gm)].map(m => m[1]);
  assert.match(footRules.at(-1), /position: sticky; bottom: 0;[^}]*background: var\(--c-surface-solid\)/);
  assert.ok(!footRules.some(r => /position: static/.test(r)), "no later rule un-pins the actions");
  // Close is a small word in the header now.
  // ⭐ D156 (1c) (changed on purpose): drawn on the deck it says "Fold it back"; elsewhere "Close", as D147 had it.
  assert.match(header, /aria-label=\{onDeck \? "Fold the posting back into its card" : "Close the posting"\}/);
  assert.match(header, /data-posting-close="">\{onDeck \? "Fold it back" : "Close"\}<\/button>/);
});

test("d147UtilityBehaviourKept · each folded button's action is reachable under its new label", () => {
  const more = acts.slice(at(acts, "{more && ("), at(acts, "{/* ⭐ D57: the state, in words"));
  // ⭐ D164 (11-05) changed this on purpose: the résumé's buttons moved from More to their own Résumé control (opened in
  // place, beside Draft) — the same Generate (and BYOM split), View, Download, Regenerate; More keeps the rest.
  const res = acts.slice(at(acts, "{res && ("), at(acts, "{more && ("));
  // 📄 → "Résumé for this job": the same Generate (and BYOM split), View, Download, Regenerate.
  // D149 (11-03) changed this on purpose: the More buttons are the sketch's plain .btn (no DepthButton icons), same calls.
  // ⭐ D164: the click is runGenerate (onGenerate(false, genOpts), the posting's Which résumé), and a failed one says Try again.
  assert.match(res, /<button type="button" className="pp__btn" onClick=\{runGenerate\}[^>]*\n?[^>]*>\s+\{generateLoading \? "Generating…" : genError \? "Try again" : "Résumé for this job"\}/);
  assert.match(res, /split\(false, "Résumé for this job", runGenerate\)/);
  assert.match(res, /onClick=\{\(\) => onViewSandbox\?\.\(\)\}/);
  assert.match(res, /onClick=\{\(\) => onExport\?\.\(\)\}/);
  assert.match(res, /onClick=\{regen\}/);
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
  // ⭐ D164 changed this on purpose: Résumé and More both reset per posting; it is the Résumé group that opens by itself
  // (while one is being made or has just failed).
  assert.match(acts, /useEffect\(\(\) => \{ setRes\(false\); setMore\(false\); \}, \[job\?\.jobId\]\);/);
  assert.match(acts, /useEffect\(\(\) => \{ if \(generateLoading \|\| genError\) setRes\(true\); \}, \[generateLoading, genError\]\);/);
});

test("d147PhoneFullScreen · on a phone the posting is full screen (the panel host's fallback) and its layout folds", () => {
  // The JD panel is one peer in the dock; a narrow viewport renders the dock full screen (usePanelHost).
  assert.match(jobs, /<PanelDock width=\{dockWidth\} fullScreen=\{panelsFullScreen && openPanelCount > 0\}>/);
  // The facts two by two with the match box as its own row; the actions fold under a narrow panel.
  assert.match(postingCss, /\.posting__facts \{ grid-template-columns: 1fr; \}/);
  assert.match(postingCss, /\.posting__match \{ border-left: 0; border-top: 1px solid var\(--c-pair-rule\); \}/);
  // ⭐ D164 (11-05) changed this on purpose: Résumé · More share the second row (Résumé spans two of the three columns).
  assert.match(jdCss, /@container pp \(max-width: 420px\) \{ \.pp__main-acts \{ grid-template-columns: 1fr 1fr 1\.3fr; \} \.pp__moreb \{ grid-column: span 1;[^}]*\} \.pp__resb \{ grid-column: span 2; \} \}/);
});

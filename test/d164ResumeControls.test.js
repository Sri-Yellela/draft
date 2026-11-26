// ⭐ D164 (owner 11-05) · SEMI-AUTO, END TO END — the résumé controls come back on the one posting.
//
// "after removing all the buttons, the resume generation related ones also went away, we need to bring it back to be able
// to test the end to end in semi auto mode." D147 folded the posting's résumé controls under "More" (docs/D164_ACTIONS.md,
// T1). T2 puts them behind ONE quiet "Résumé" control beside the primary Draft, opening in place: Which résumé ·
// Résumé for this job (generate without drafting) / Regenerate · Preview / edit · What we changed · Download PDF ·
// Download HTML — with visible states Generating… · Ready · Failed — Try again (a failure never shown as "no résumé").
//
// This file: d164NoActionLost · d164GenerateWithoutDraft · d164PickResumeOrProfile · d164StatesAndRetry. The pipeline's
// three (d164SemiAutoStopsBeforeSubmit · d164SubmitOnlyByUser · d164ConsentLeftForUser) are in d164SemiAutoPipeline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const jd = read("client/src/components/JobDetailPanel.jsx");
const jdCss = read("client/src/components/JobDetailPanel.css");
const jobs = read("client/src/panels/JobsPanel.jsx");
const deck = read("client/src/panels/DeckView.jsx");
const bubble = read("client/src/components/JobBubble.jsx");
const topBar = read("client/src/components/TopBar.jsx");
const customise = read("client/src/panels/CustomisePanel.jsx");
const actionsDoc = read("docs/D164_ACTIONS.md");
const acts = jd.slice(at(jd, "export function PostingActions("), at(jd, "export default function JobDetailPanel("));
const resGroup = acts.slice(at(acts, "{res && ("), at(acts, "{more && ("));
const moreGroup = acts.slice(at(acts, "{more && ("), at(acts, "{/* ⭐ D57: the state, in words"));
const meta = jobs.slice(at(jobs, "setSelectedJobMeta({"), at(jobs, "// Auto-open resume + ATS panel when a pending job card is selected"));
const generateFrom = jobs.slice(at(jobs, "const generateFrom = useCallback("), at(jobs, "const saveSandboxHtml = useCallback("));
const generateActual = jobs.slice(at(jobs, "const generateActual = useCallback("), at(jobs, "// -- Generate (with company-reuse check)"));

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
        import { MemoryRouter } from "react-router-dom";
        import { PostingActions } from ${abs("components/JobDetailPanel.jsx")};
        import { resumeControlState } from ${abs("lib/jobDecisions.js")};
        export const html = (C, props) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(C, props)));
        export { PostingActions, resumeControlState };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".svg": "text", ".png": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d164-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// A synthetic posting and the board's meta for it.
const JOB = { id: 9, jobId: "j9", title: "Platform Engineer", company: "Fabrikam", applyUrl: "https://jobs.example.test/fabrikam/9" };
const noop = () => {};
const META = (over = {}) => ({
  g: null, done: false, st: undefined, canUseGenerate: true,
  onGenerate: noop, onViewSandbox: noop, onExport: noop, onExportHtml: noop, onRegenerate: noop,
  onSave: noop, onPass: noop, onDraft: noop, drafted: false, drafting: false,
  genError: null, resumeSources: [{ id: 3, name: "Platform roles", active: true }], resumeSourceId: 3,
  ...over,
});
const SLOTS = { remaining: 7, limit: 10 };
const render = async (meta, openResume = true) => {
  const { html, PostingActions } = await loadUi();
  return html(PostingActions, { job: JOB, meta, slots: SLOTS, onCoverLetter: noop, openResume });
};

test("d164NoActionLost · every action the posting and the deck card had before D145 is still reachable (T1's table)", () => {
  // T1's table is in the repo and names the baseline it measured against.
  assert.match(actionsDoc, /529dad8c/);
  assert.match(actionsDoc, /## MISSING \(bugs for T2\)/);
  // [action, source, anchor] — one row per line of docs/D164_ACTIONS.md's tables.
  const CHECKLIST = [
    ["Pass", acts, 'data-decision="pass"'], ["Save", acts, 'data-decision="save"'], ["Draft", acts, 'data-decision="draft"'],
    ["Résumé — generate for this job", resGroup, 'data-more="resume"'], ["Résumé — BYOM split", resGroup, 'split(false, "Résumé for this job", runGenerate)'],
    ["Preview / edit", resGroup, 'data-more="view"'], ["Download PDF", resGroup, 'data-more="download"'],
    ["Download HTML", resGroup, 'data-more="download-html"'], ["Regenerate", resGroup, 'data-more="regenerate"'],
    ["What we changed", resGroup, "<WhatWeChangedLink"], ["Which résumé", resGroup, "data-resume-source"],
    ["Cover letter", moreGroup, 'data-more="cover-letter"'], ["I applied myself", moreGroup, "<ManualSubmitted jobId={job.jobId} />"],
    ["Drafts left today", acts, "data-draft-slots"], ["Takes about 10–20 seconds", resGroup, "data-generate-expect"],
    ["Résumé ready · What we changed", acts, "data-resume-ready"], ["BYOM status", acts, "<ByomStatus"],
    ["Company notice", acts, "data-company-notice"], ["Eligibility notice", acts, "data-eligibility-notice"],
    ["Company hiring data", jd, "data-company-hiring"], ["The original posting", jd, "<CompanyLink company={selectedJob.company}"],
    ["The ATS report (match box)", jd, "matchBox={<AtsNumberBox"], ["Résumé versions", jd, "onOpenVersion"],
    ["Close", jd, "data-posting-close"], ["Pending · record it", jd, "data-pending-tag"], ["Retry the description", jd, "setRetry(r => r + 1)"],
    // 47j R2 (changed on purpose): the deck's Pass · Save · Draft are the ticket's own (TicketActions, plate/MarketCardFace.jsx)
    ["Deck Pass · Save · Draft", fs.readFileSync("client/src/plate/MarketCardFace.jsx", "utf8"), 'data-deck-action="draft"'], ["Deck previous / next", deck, "<FlipButton dir={1}"],
    ["Deck open the posting", deck, "data-deck-full-posting"], ["Deck ATS report", deck, "onSignal={() => openMatchInPosting("],
    ["Deck full report / the posting", deck, "Full report on the board →"], ["Deck drafted today", deck, 'aria-label="Drafted today"'],
    ["Deck keyboard shortcuts", deck, 'aria-label="Keyboard shortcuts"'], ["Deck order", customise, "DECK_ORDERS"],
    ["Bubble company profile", bubble, "jb__logo"], ["Bubble save", bubble, "jb__sq--save"], ["Bubble draft", bubble, 'draft.action === "draft" ? onDraft'],
    ["Job-profile switcher (whole board)", topBar, "<ProfileSelectorDropdown"],
  ];
  const lost = CHECKLIST.filter(([, src, anchor]) => !src.includes(anchor)).map(([name]) => name);
  assert.deepEqual(lost, [], `actions with no home now: ${lost.join(", ")}`);
  // The posting's foot renders the actions on the deck too — the posting the deck card opens into (D156 (1c)).
  assert.match(jd, /\{selectedJobMeta && \(\n\s+<div className="pp__foot" data-posting-actions-bar="">\n\s+<PostingActions /);
  assert.match(jobs, /const deckSlot = typeof document !== "undefined" \? document\.getElementById\(DECK_POST_SLOT_ID\) : null;/);
});

test("d164GenerateWithoutDraft · Résumé for this job generates without drafting — a quiet control beside Draft", async () => {
  // ONE quiet Résumé control in the row, after Draft and before More; it opens the group in place.
  const row = acts.slice(at(acts, '<div className="pp__main-acts"'), at(acts, "{res && ("));
  const order = ['data-decision="draft"', "data-posting-resume-toggle", "data-posting-more-toggle"].map(s => row.indexOf(s));
  assert.ok(order.every(i => i >= 0)); assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(row, /className="pp__moreb pp__resb" aria-expanded=\{res\} aria-controls=\{resId\}/);
  assert.match(row, />Résumé<\/button>/);
  assert.match(jdCss, /\.pp__main-acts \{ display: grid; grid-template-columns: 1fr 1fr 1\.4fr auto auto;/);
  // The button calls the board's generate — POST /api/generate — and never the Draft call (POST /api/apply/runs).
  assert.match(resGroup, /onClick=\{runGenerate\}/);
  assert.match(acts, /const runGenerate = \(\) => onGenerate\(false, genOpts\);/);
  assert.match(meta, /onGenerate: \(force, opts\) => generateFrom\(selectedJob, force, opts\),/);
  assert.match(generateActual, /api\("\/api\/generate", \{ method:"POST",/);
  assert.doesNotMatch(generateFrom + generateActual, /\/api\/apply\/runs|DECISIONS\.DRAFTED|onDraft/);
  // Rendered: no résumé yet → "Résumé for this job" in the group, Draft still its own button.
  const out = await render(META());
  assert.match(out, /data-posting-resume=""/);
  assert.match(out, /data-more="resume"[^>]*>Résumé for this job</);
  assert.match(out, /data-decision="draft"/);
  assert.match(out, /Takes about 10–20 seconds\./);
  // With a résumé: Preview / edit · What we changed · Regenerate · Download PDF · Download HTML, and no second generate.
  const ready = await render(META({ done: true, g: { html: "<p>r</p>", generatedAt: Date.now() - 2 * 3600_000 } }));
  for (const label of [">Preview / edit<", ">What we changed<", ">Regenerate<", ">Download PDF<", ">Download HTML<"]) assert.ok(ready.includes(label), label);
  assert.doesNotMatch(ready, /data-more="resume"/);
  // Download HTML reuses the sandbox's document clean-up and the one blob download — not a second implementation.
  assert.match(meta, /await downloadBlob\(new Blob\(\[cleanDocHtml\(html\)\], \{ type: "text\/html" \}\)/);
  assert.match(jobs, /import SandboxPanel, \{ cleanDocHtml \} from "\.\/SandboxPanel\.jsx";/);
  // Preview / edit is the existing sandbox (onViewSandbox → openSandbox / viewStoredResume).
  assert.match(meta, /onViewSandbox: \(\) => \{\n\s+if \(g2\?\.html === "__exists__"\) \{ viewStoredResume\(selectedJob, g2\.tool\); return; \}/);
});

test("d164PickResumeOrProfile · Which résumé: each job profile's base résumé, for this posting only", async () => {
  const two = await render(META({ resumeSources: [{ id: 3, name: "Platform roles", active: true }, { id: 5, name: "Data roles", active: false }] }));
  assert.match(two, /Which résumé/);
  assert.match(two, /<option value="3" selected="">Platform roles — base résumé \(this board&#x27;s\)<\/option>/);
  assert.match(two, /<option value="5">Data roles — base résumé<\/option>/);
  // One profile is said, not offered as a choice of one.
  const one = await render(META());
  assert.doesNotMatch(one, /<select/);
  assert.match(one, /Tailored from the base résumé of Platform roles\./);
  // The choice travels with Generate and Regenerate; another profile's base résumé is READ and handed to the same
  // generate — the board's profile is never switched from here (no /activate, no setActiveProfileId).
  assert.match(acts, /const genOpts = sourceId != null \? \{ profileId: sourceId \} : undefined;/);
  assert.match(acts, /const regen = onRegenerate \? \(\) => onRegenerate\(genOpts\) : \(\) => onGenerate\(true, genOpts\);/);
  assert.match(generateFrom, /if \(profileId == null \|\| String\(profileId\) === String\(activeId\)\) return generate\(job, force\);/);
  assert.match(generateFrom, /api\(`\/api\/domain-profiles\/\$\{encodeURIComponent\(profileId\)\}\/base-resume`/);
  assert.match(generateFrom, /return generate\(job, force, GENERATE_TOOL, \{ resumeText: text \}\);/);
  assert.doesNotMatch(generateFrom, /\/activate|setActiveProfileId/);
  assert.match(generateActual, /const baseText = source\?\.resumeText \|\| resumeText;/);
  assert.match(generateActual, /body:JSON\.stringify\(\{ jobId:key, job, resumeText: baseText, forceRegen:force, tool \}\)/);
  assert.match(meta, /resumeSources: domainProfiles\.map\(p => \(\{ id: p\.id, name: p\.profile_name/);
  // A field, a rectangle — never a capsule (D60).
  assert.match(jdCss, /\.pp__srcs \{[^}]*border-radius: 10px;/);
});

test("d164StatesAndRetry · Generating… · Ready · Failed — Try again; a failure is never drawn as 'no résumé'", async () => {
  const { resumeControlState } = await loadUi();
  assert.equal(resumeControlState({ generating: true }).word, "Generating…");
  assert.equal(resumeControlState({ hasArtifact: true, ago: "2h ago" }).word, "Ready · 2h ago");
  const failed = resumeControlState({ error: { message: "The résumé tools service is not configured on this server" } });
  assert.deepEqual([failed.kind, failed.word, failed.retry], ["failed", "Failed — Try again", true]);
  assert.match(failed.detail, /not configured/);
  assert.equal(resumeControlState({}).kind, "none");
  // A failure outranks "none" and "ready"; a regeneration in flight outranks all.
  assert.equal(resumeControlState({ hasArtifact: true, error: "x" }).kind, "failed");
  assert.equal(resumeControlState({ generating: true, error: "x" }).kind, "generating");

  const busy = await render(META({ st: "generate" }), false);
  assert.match(busy, /data-resume-state="generating"[^>]*><span class="mark mark--info">Résumé · Generating…<\/span>/);
  const bad = await render(META({ genError: { message: "The résumé tools service is not configured on this server" } }), false);
  assert.match(bad, /data-resume-state="failed" role="alert"><span class="mark mark--no">Résumé · Failed —<\/span> <button type="button" class="pp__retry"[^>]*data-resume-retry="">Try again<\/button>/);
  assert.match(bad, /not configured on this server/);
  const badOpen = await render(META({ genError: { message: "boom" } }));
  assert.match(badOpen, /data-more="resume"[^>]*>Try again</, "the group's button retries — it does not read 'Résumé for this job' as if none was tried");
  const ok = await render(META({ done: true, g: { html: "<p>r</p>", generatedAt: Date.now() - 2 * 3600_000 } }), false);
  assert.match(ok, /data-resume-ready="" data-resume-state="ready"><span class="mark mark--ok">Résumé ready · 2h ago<\/span>/);

  // The board keeps the failure per job and clears it on the next attempt or a success; every failure path sets it.
  assert.match(jobs, /const \[genFailed, {3}setGenFailed\] {3}= useState\(\{\}\);/);
  assert.match(generateActual, /if \(!baseText\)\s+\{ failGen\(key, noResumeTextReason\(\)\); return; \}/);
  assert.match(generateActual, /failGen\(key, d\.error\);/);
  assert.match(generateActual, /\} catch\(e\) \{\n\s+setSandbox\(\{ generating: false, status:"error", error: e\.message[^\n]*\n\s+failGen\(key, e\.message\);/);
  assert.match(generateActual, /clearGenFailed\(key\);\n\s+openSandbox\(mergeArtifact/);
  assert.match(meta, /genError: genFailed\[selectedJob\.jobId\] \|\| null,/);
  // A résumé read that failed or has not come back is said as such, never "no résumé on file" (D156 6).
  assert.match(jobs, /resumeState === "error" \? "Your résumé could not be read just now, so nothing was generated\."/);
  assert.match(jobs, /: resumeState === "loading" \? "Your résumé is still loading — try again in a moment\."/);
  // The walk's finding: generating opens the sandbox over the posting, and one Escape closed the sandbox AND folded the
  // posting (JobsPanel's keys and the deck's fold ignored D39's one-panel-per-Escape). Both now leave the posting while
  // another panel is open over it.
  const jobUrl = read("client/src/lib/jobUrl.js");
  assert.match(jobUrl, /export function panelOverPosting\(\) \{\n\s+return typeof document !== "undefined" && !!document\.querySelector\('\[data-panel-id\]:not\(\[data-panel-id="jd"\]\)'\);/);
  assert.match(jobs, /if \(e\.key === "Escape"\) \{ if \(panelOverPosting\(\)\) return; clearDeepLink\(\); setSelectedJob\(null\); return; \}/);
  assert.match(deck, /if \(k === "Escape"\) \{ if \(!panelOverPosting\(\)\) foldPost\(\); \}/);
  assert.match(read("client/src/components/PanelShell.jsx"), /data-panel-id=\{panelId\}/);
  // The Résumé group opens itself while one is being made or has just failed.
  assert.match(acts, /useEffect\(\(\) => \{ if \(generateLoading \|\| genError\) setRes\(true\); \}, \[generateLoading, genError\]\);/);
});

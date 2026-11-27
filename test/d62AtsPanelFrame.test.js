// ⭐ D62 (owner 10-07) · THE ATS PANEL'S FRAME AND ITS HISTORY WERE STILL THE OLD SITE.
//
// The screenshot: a header reading Amazon / title / "ATS [Strong]" capsule / "Base 62 → tailored 70" in bold ·
// tabs ATS REPORT | HISTORY (1) in the old condensed uppercase face, the active one an orange capsule · a
// History row with a green LETTER tile, a "Strong" capsule, and an eye and a share icon in old dark squares.
//
// Now: CompanyLogo · the company in the logo face (the one link, D38) · the number box (D50) · "62 → 70" as
// a serif mark · tabs as depth boxes in the logo face · History = THIS JOB's résumé versions, in ResumeList —
// the one list component whose other home is Settings' Generated résumés (D57). And the audit that followed:
// the old condensed face (Barlow Condensed) is gone from every rendered surface.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;,{(])\/\/[^\n]*/g, "$1");
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
        import ResumeList, { RESUME_ICONS } from ${abs("components/ResumeList.jsx")};
        import { AtsNumberBox } from ${abs("components/AtsNumberBox.jsx")};
        export const list = (props) => renderToStaticMarkup(createElement(ResumeList, props));
        export const box = (props) => renderToStaticMarkup(createElement(AtsNumberBox, { readOnly: true, size: "row", ...props }));
        export { RESUME_ICONS };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d62-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

test("⭐ D62 · a History row: version and date · the tailored score in the number box · view and download as depth squares", async () => {
  const { list, RESUME_ICONS } = await loadUi();
  const html = list({ scoreCaption: "tailored", rows: [{
    key: "j-2", title: "Version 2", meta: "7 Oct 2026 · base 62", score: 70,
    actions: [{ id: "view", label: "View version 2", icon: RESUME_ICONS.view, onClick() {} },
              { id: "download", label: "Download version 2 as PDF", icon: RESUME_ICONS.download, onClick() {} }],
  }] });
  assert.match(html, /<div class="rl__title">Version 2<\/div><div class="rl__meta">7 Oct 2026 · base 62<\/div>/);
  // A93: the row's score is the ONE number box (AtsNumberBox, read-only, row size).
  assert.match(html, /<span class="atsn atsn--row atsn--static" data-ats-box="" data-ats-score="70" role="img" aria-label="ATS match 70\.[^"]*"[^>]*><b>70<\/b><small>tailored<\/small><\/span>/,
    "the number box, the serif number and its caption — never a band capsule");
  assert.match(html, /<button type="button" class="rl__sq" data-resume-action="view" title="View version 2" aria-label="View version 2"><svg/);
  assert.match(html, /data-resume-action="download"/);
  assert.doesNotMatch(html, /👁|📥|data-company-logo="letter"|Strong/, "no emoji squares, no letter tile, no band word");
  // No score → the dashed box, no digits (D50).
  assert.match((await loadUi()).box({ score: null }), /atsn atsn--row atsn--none atsn--static/);
  const css = read("client/src/components/ResumeList.css");
  assert.match(css, /\.rl__sq \{[^}]*border-radius: 10px;[^}]*box-shadow: var\(--c-depth-rest\)/, "a D1 depth square");
  assert.match(read("client/src/components/AtsNumberBox.css"), /\.atsn b \{ font: 400 26px\/1 var\(--font-display\); color: var\(--c-pp-ats-number\); \}/, "the D50 number");
  assert.doesNotMatch(css, /rl__score|atsp__/, "A93: the list's stylesheet holds only the list");
});

// ⭐ D152 (8) (b), changed on purpose (owner 11-04, ats-options.html option A): the ATS panel drawn over the page —
// AtsReportPanel, its header and its tab row — is RETIRED. The match opens inside the posting, under the facts, whose
// own header already names the company (CompanyLogo, the ONE CompanyLink) and holds the number box (D58's pair). Its
// History is the report's quiet "History" switch; the rows are still THIS job's résumé versions, in ResumeList.
test("⭐ D62 → D152 (8) · the overlay's header and tabs are gone; the posting is the frame", () => {
  assert.ok(!fs.existsSync("client/src/panels/AtsReportPanel.jsx") && !fs.existsSync("client/src/panels/AtsReportPanel.css"));
  const jd = code((fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */);
  assert.match(jd, /<CompanyLogo company=\{selectedJob\.company\}/);
  assert.match(jd, /<AtsNumberBox score=\{scores\.shown\} tailored=\{scores\.tailoredShown\} base=\{scores\.base\} caption="match"/, "the ONE number box (D50, A93)");
});

test("⭐ D62 → D152 (8) · History is the report's switch, and counts THIS job's versions", () => {
  const jd = code((fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */);
  assert.match(jd, /api\(`\/api\/resumes\/\$\{encodeURIComponent\(versionsJobId\)\}\/versions`\)/, "the job's résumé versions");
  assert.match(jd, /history=\{matchHistory\} bare \/>/);
  // ⭐ 46x: the versions ride with the ATS card behind one toggle; the report's History switch is retired.
  // D202 (47h, the owner's yes — moved on purpose): the classic ATS card (components/AtsCard.jsx) is retired; the match panel draws FitCard — the versions are its History tab
  assert.match(read("client/src/plate/FitCard.jsx"), /\{tab === "hist" \? <HistoryTab lines=\{historyLines\} history=\{history\}\/> : null\}/);
  assert.doesNotMatch(read("shared/atsReportElement.js"), /\["history", "History"\]/);
});

test("⭐ D62 · ONE list component, two homes: the posting match's History and Settings' Generated résumés", () => {
  assert.match((fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */, /<ResumeList loading=\{versions === null\} rows=\{versionRows\}/);
  const acct = read("client/src/panels/AccountPanel.jsx");
  assert.match(acct, /import ResumeList, \{ RESUME_ICONS \} from "\.\.\/components\/ResumeList\.jsx";/);
  assert.match(acct, /<ResumeList showLogo scoreCaption="tailored" rows=\{list\.map\(r => \(\{/);
  assert.doesNotMatch(read("client/src/panels/JobsPanel.jsx"), /function HistoryList\(|historyContent=/, "the old History list is gone");
});

test("⛔ D62 audit · the old condensed face is gone from every rendered surface", () => {
  const offenders = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|css)$/.test(n) && /(font-family|fontFamily|fontDisplay)[^\n]{0,8}'Barlow Condensed/.test(code(read(p)))) offenders.push(p.split(path.sep).join("/")); } };
  walk("client/src");
  // A font DECLARATION is what counts — the privacy policy's prose names the face in its font history, and
  // main.jsx still imports the self-hosted file; neither renders it.
  assert.deepEqual(offenders, []);
});

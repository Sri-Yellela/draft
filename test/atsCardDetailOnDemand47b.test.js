// ⭐ 47b (owner 11-22: "this is still what i got, we can have a detailed analysis on demand") — THE ATS CARD OPENS SHORT.
// By default: the number, each part's name / bar / number, the biggest gain. The analysis — the score's facts line ("skill match
// 37 · in context 46 · …"), each part's line ("Reliability — missing Planning, SAFE") and figures ("1 of 3 skills · … · weighs
// 63%") — waits behind ONE quiet toggle, "Show the analysis". The same on the web (client/src/components/AtsCard.jsx, rendered
// here with esbuild + react-dom/server) and in the extension's mirror (extension/resumePanel.js; walked in a real Chrome by
// test-support/walks/atsOnPage.mjs section 4).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { atsCardView } from "../shared/contextualView.js";

const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
const REPORT = Object.freeze({ score: 72, scorable: true, tier1_matched: ["Go", "Kafka"], tier1_missing: ["Terraform"],
  action_verbs_matched: ["Built"], action_verbs_missing: ["Scaled"], experience: { requiredYears: 4, candidateYears: 6, fit: true } });

async function renderCard(props) {
  const esbuild = requireClient("esbuild");
  const abs = JSON.stringify(path.join(CLIENT, "src", "components/AtsCard.jsx").split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: { contents: `
        import { createElement as h } from "react";
        import { MemoryRouter } from "react-router-dom";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { AtsCard } from ${abs};
        export const render = (props) => renderToStaticMarkup(h(MemoryRouter, null, h(AtsCard, props)));`,
      resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ats47b-"));
  const file = path.join(dir, "card.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { return (await import(pathToFileURL(file).href)).render(props); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("atsCardDetailOnDemand — the web card opens short: number, parts, gain; the analysis only behind 'Show the analysis'", async () => {
  const view = atsCardView({ report: REPORT });
  assert.ok(view.parts.some(p => p.line || p.facts?.length), "the fixture has analysis to hide");
  const html = await renderCard({ report: REPORT });
  assert.match(html, /data-ats-card-score/, "the number");
  assert.match(html, /data-ats-card-part="skill_match"/, "each part, with its bar and number");
  assert.match(html, /<button[^>]*data-ats-card-detail[^>]*aria-expanded="false"[^>]*>Show the analysis<\/button>/, "one quiet toggle, closed");
  assert.doesNotMatch(html, /data-ats-card-facts/, "no facts line or part figures by default");
  assert.doesNotMatch(html, /data-ats-card-line/, "no part line by default");
  for (const p of view.parts) for (const f of p.facts || []) assert.ok(!html.includes(f), `the figure "${f}" waits for the toggle`);
});

test("atsCardDetailOnDemand — the toggle reveals the same analysis and remembers it per viewer (never required)", () => {
  const src = fs.readFileSync("client/src/components/AtsCard.jsx", "utf8");
  assert.match(src, /\{detail && view\.facts\?\.length > 0 && <div data-ats-card-facts="card"/);
  assert.match(src, /\{detail && p\.line && <div data-ats-card-line=\{p\.id\}/);
  assert.match(src, /\{detail && p\.facts\?\.length > 0 && <div data-ats-card-facts=\{p\.id\}/);
  assert.match(src, /const readDetail = \(\) => \{ try \{ return localStorage\.getItem\(DETAIL_KEY\) === "1"; \} catch \{ return false; \} \};/);
  assert.match(src, /\{detail \? "Hide the analysis" : "Show the analysis"\}/);
});

test("atsCardDetailOnDemand — the extension's mirror: the same default and toggle, in its own CSS, nothing stored", () => {
  const src = fs.readFileSync("extension/resumePanel.js", "utf8");
  assert.match(src, /data-role="ats-card-view" data-detail="\$\{atsDetail \? '1' : '0'\}"/);
  assert.match(src, /\.ac\[data-detail="0"\] \[data-detail-line\] \{ display: none; \}/);
  assert.equal((src.match(/class="fx" data-(role="ats-card-facts" data-)?detail-line=""/g) || []).length, 3, "the facts line, each part's line and its figures");
  assert.match(src, /let atsDetail = false;/);
  assert.match(src, /if \(role === 'ats-card-detail'\) return;\s*\/\/ ⛔ Everything here reaches draft's server/, "the panel's delegated click never disables the local toggle (it did: the second click was dead)");
  assert.match(src, /b\.textContent = atsDetail \? 'Hide the analysis' : 'Show the analysis';/);
  const toggle = src.match(/atsRoot\.querySelector\('\[data-role="ats-card-detail"\]'\)\?\.addEventListener\('click', \(e\) => \{[\s\S]*?\r?\n    \}\);/)?.[0] || "";
  assert.ok(toggle.includes("atsDetail = !atsDetail"), "the toggle's own listener");
  assert.doesNotMatch(toggle, /chrome\.storage|send\(|fetch\(/, "it stores and sends nothing");
});

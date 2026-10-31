// D90 P3 · the Draft House review line and The Table's "What we sent" (docs/WHAT_WE_CHANGED_SPEC.md §3, §6).
//
// The comparison, the endpoints and "What we sent never changes when the résumé is regenerated" are proved by
// test/d90ResumeChanges.test.js (P1). This file holds P3's wiring: the CHANGES are on screen before Approve &
// send on both approval surfaces; What we sent offers only a kept copy and opens on it; an untraced change leads.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const PANEL = read("client/src/components/ResumeChangesPanel.jsx");
const HOUSE = read("client/src/panels/AutoApplyPanel.jsx");
const TABLE = read("client/src/components/ApplicationHistory.jsx");

test("⛔ D90 P3: Draft House shows what we changed BEFORE Approve & send — in the fold and in the review list", () => {
  // D113 UI: the approval's lead card (its branch) — the line sits in the card, above the actions it renders.
  // (companyLabel: an ATS host must never reach the screen as a company — test/applyCompanyAttribution.test.js.)
  const lead = HOUSE.slice(at(HOUSE, "const renderJobBranch = (node) => {"), at(HOUSE, "const seeLeftOut = async"));
  assert.match(lead, /\{node\.kind === "approval" && !node\.ref\.generationDeferred && <ChangesSummaryLine jobId=\{node\.ref\.jobId\} jobLabel=\{companyLabel\(node\.ref\.company\)\} \/>\}/);
  const card = fs.readFileSync("client/src/components/DraftHouseTree.jsx", "utf8").replace(/\r\n/g, "\n");
  const leadCard = card.slice(at(card, "export function LeadCard("), at(card, "export function Leaf("));
  assert.ok(at(leadCard, "{children}") < at(leadCard, "actions.map("), "the line comes after Approve & send in the card");
  // The review list.
  const list = HOUSE.slice(at(HOUSE, "{/* D90 P3: what we changed in the résumé, read before Approve & send. */}"));
  assert.match(list, /\{!p\.generationDeferred && <ChangesSummaryLine jobId=\{p\.jobId\} jobLabel=\{companyLabel\(p\.company\)\} \/>\}/);
  assert.ok(at(list, "<ChangesSummaryLine") < at(list, "Approve &amp; send"), "the line comes after Approve & send in the review list");
  assert.match(HOUSE, /import \{ ChangesSummaryLine \} from "\.\.\/components\/ResumeChangesPanel\.jsx";/);
});

test("⛔ D90 P3: the review line is the stored comparison — numbers, ATS delta, still missing — and an untraced change leads it", () => {
  const line = PANEL.slice(at(PANEL, "export function ChangesSummaryLine("), at(PANEL, "/** The posting panel's way in"));
  assert.match(line, /api\(`\/api\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/resume-changes`\)/, "reads the same endpoint the panel does");
  assert.match(line, /if \(!d\?\.summary\) return null;/, "nothing is drawn without a tailored résumé");
  assert.match(line, /bullet\$\{s\.rewritten === 1 \? "" : "s"\} rewritten/);
  assert.match(line, /ATS \$\{last - first >= 0 \? "\+" : ""\}\$\{last - first\}/);
  assert.match(line, /requirement\$\{s\.requirementsMissing\.length === 1 \? "" : "s"\} still missing/);
  // Loudest: the untraced warning is the FIRST thing in the line, with role="alert".
  assert.ok(at(line, "rc__line-alarm") < at(line, "parts.join"), "the untraced warning does not lead the line");
  assert.match(line, /role="alert">⚠ \{untraced\} change/);
  assert.doesNotMatch(line, /fetch\(|model|anthropic|openai/i, "the line calls nothing but the stored comparison");
});

test("⛔ D90 P3: The Table's What we sent opens on the snapshot AT APPLY — and only for a kept copy", () => {
  assert.match(TABLE, /\{row\.resumeSource !== "current_resume" && \(\n\s+<WhatWeSentLink jobId=\{row\.jobId\} recordId=\{row\.recordId\} jobLabel=\{row\.company \|\| ""\} className="ah__btn" \/>/);
  const link = PANEL.slice(at(PANEL, "export function WhatWeSentLink("), at(PANEL, "export function ChangesSummaryLine("));
  assert.match(link, /initialTo=\{`sent:\$\{recordId\}`\}/);
  // The panel opens on that side only when the server listed it — never a guessed ref.
  assert.match(PANEL, /const known = initialTo && \[\.\.\.\(r\.versions \|\| \[\]\), \.\.\.\(r\.sent \|\| \[\]\)\]\.some\(x => x\.ref === initialTo\);/);
  assert.match(PANEL, /setTo\(known \? initialTo : r\.default\?\.to \|\| null\);/);
  // The panel's own default class — a stylesheet's classes are worn by their owner (A93); The Table passes its own.
  assert.match(link, /className = "rc__open"/);
});

test("D90 P3: the panel is a SHARED module now — the board, Draft House and The Table open it", () => {
  const manifest = read("client/src/modules.manifest.js");
  assert.match(manifest, /"components\/ResumeChangesPanel\.jsx":\s+\{ what: "[^"]+" \},/);
  assert.doesNotMatch(manifest, /"components\/ResumeChangesPanel\.jsx":[^\n]*module: "board"/);
});

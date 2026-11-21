// ⭐ 47a (owner 11-21, E1) · THE EXTENSION'S ATS TAB DRAWS THE WEB'S ATS CARD — the same words (shared/contextualView.js
// atsCardView, bundled into extension/atsReport.js), the contextual score and its four parts with their figures, the biggest
// gain, every number painted by its band; and the plausibility flags with Dismiss through the extension's own token.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import "../extension/atsReport.js";
import { atsCardView } from "../shared/contextualView.js";
import { cardOf, atsFacts } from "../extension/boardJob.js";
import { reportModel, handlersFor } from "../extension/resumePanel.js";
import { createExtensionJobRouter, flagsForExtension } from "../routes/extensionJob.js";
import { BUNDLE_MODULES } from "../scripts/buildAtsReport.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const report = { score: 52, matched: ["sql", "python"], missing: ["kafka"], tier1_missing: ["kafka"] };
const contextual = { score: 42, parts: {
  skill_match: { score: 52, status: "ok" },
  role_fit: { score: 70, status: "ok", same_category: true, level_gap: 1 },
  responsibility_overlap: { score: 30, status: "ok", missing: ["build payment infrastructure"] },
  tech_stack: { score: 25, status: "ok", exact: [{ tech: "SQL", share: 0.2 }], ecosystem: [], gaps: [{ tech: "Kafka", share: 0.64 }] } },
  similarities: { domains: ["fintech"] }, dissimilarities: [{ kind: "stack_gap", tech: "Kafka", share: 0.64 }] };

test("e1 the bundle carries the web card's own code — atsCardView and the band function", () => {
  assert.ok(BUNDLE_MODULES.includes("contextualView.js"));
  assert.equal(typeof globalThis.__draftAtsReport.atsCardView, "function");
  assert.deepEqual(globalThis.__draftAtsReport.atsCardView({ report, contextual }), atsCardView({ report, contextual }), "the extension says exactly what the web says");
  assert.match(read("extension/atsReport.js"), /\/\/ ── shared\/contextualView\.js /);
});

test("e1 cardOf: the contextual score, four parts with their bands and figures, the gain — named words only, never the raw block", () => {
  const c = cardOf({ report, contextual });
  assert.equal(c.declined, false);
  assert.equal(c.score, 42);
  assert.equal(c.band, globalThis.__draftAtsReport.atsBandFor(42));
  assert.deepEqual(c.parts.map(p => p.id), ["skill_match", "role_fit", "responsibility_overlap", "tech_stack"]);
  for (const p of c.parts) { assert.ok(Number.isFinite(p.score)); assert.ok(typeof p.band === "string" || p.band === null); assert.ok(Array.isArray(p.facts)); }
  assert.match(c.gain.text, /Kafka/);
  assert.ok(!JSON.stringify(c).includes("dissimilarities") && !JSON.stringify(c).includes("\"exact\""), "the contextual block stays in the service worker");
  assert.deepEqual(cardOf({ report: { score: null, decline_reasons: ["too short"] } }), { declined: true, reason: "too short" });
  assert.equal(cardOf(null), null);
  // through atsFacts (what the server's answer becomes) and the panel's report model
  const facts = atsFacts({ state: "ready", score: 52, band: "moderate", report, contextual });
  assert.equal(facts.card.score, 42);
  assert.equal(reportModel(facts).card.score, 42);
});

test("e1 the ATS tab draws the card (number, parts, bars, gain, flags) before the older report; no band word, 2 px bars", () => {
  const src = read("extension/resumePanel.js");
  assert.match(src, /const ac = m\.report\?\.card \|\| null;/);
  assert.match(src, /ac \? acHtml : card \? '<div data-role="ats-card"><\/div>'/);
  for (const role of ["ats-card-score", "ats-card-gain", "plausibility"]) assert.ok(src.includes(`data-role="${role}"`), role);
  assert.match(src, /\.ac \.bar \{ height: 6px; border-radius: 1px;/);
  assert.match(src, /--c-band-strong/);
});

test("e1 the flags: GET /api/extension/plausibility (extension token only) → named words; Dismiss posts the key", async () => {
  const r = { dismissed: 1, entries: [{ employer: "Kestrel", flags: [{ kind: "tech", tech: "Salesforce", bullet: "Built Salesforce flows", key: "tech|kestrel|built|salesforce",
    reason: "You list Salesforce at Kestrel, but its postings never mention it — check this", extra: "x" }] }, { employer: "Other", flags: [] }] };
  assert.deepEqual(flagsForExtension(r), [{ key: "tech|kestrel|built|salesforce", company: "Kestrel", bullet: "Built Salesforce flows",
    reason: "You list Salesforce at Kestrel, but its postings never mention it — check this" }]);
  const dismissed = [];
  const app = express();
  app.use(express.json());
  app.use(createExtensionJobRouter({ db: null, requireAuth: (req, _res, next) => { req.user = { id: 7 }; next(); }, isExtension: (req) => req.get("x-ext") === "1",
    scoreFor: () => null, hasBaseResume: () => true, plausibility: (u) => (u === 7 ? r : null), dismissFlag: (u, key, undo) => { dismissed.push([u, key, undo]); return { ok: true, dismissed: !undo }; } }));
  const srv = app.listen(0);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    assert.equal((await fetch(`${base}/api/extension/plausibility`)).status, 403, "a web session is refused");
    const got = await (await fetch(`${base}/api/extension/plausibility`, { headers: { "x-ext": "1" } })).json();
    assert.equal(got.flags.length, 1);
    assert.equal(got.dismissed, 1);
    const d = await fetch(`${base}/api/extension/plausibility/dismiss`, { method: "POST", headers: { "x-ext": "1", "Content-Type": "application/json" }, body: JSON.stringify({ key: "tech|kestrel|built|salesforce" }) });
    assert.equal(d.status, 200);
    assert.deepEqual(dismissed, [[7, "tech|kestrel|built|salesforce", false]]);
  } finally { srv.close(); }
});

test("e1 the handlers: flags only for a web page's panel; Dismiss only on the person's trusted click", async () => {
  const h = handlersFor("https://draft.test");
  assert.equal((await h.RESUME_FLAGS({}, {})).ok, false, "no tab (the popup / a worker) — refused");
  assert.equal((await h.RESUME_FLAG_DISMISS({ key: "k" }, { tab: { id: 1, url: "https://jobs.example/x" } })).ok, false, "no click — refused");
  const src = read("extension/resumePanel.js");
  assert.match(src, /if \(!e\.isTrusted\) return;\s*const f = flags\[Number\(b\.dataset\.dismiss\)\];/);
  assert.match(src, /send\(\{ type: 'RESUME_FLAG_DISMISS', key: f\?\.key, trigger: 'click' \}\)/);
  assert.match(read("server.js"), /plausibility: \(userId\) => \{ const profile = getOrRepairActiveProfile\(userId\);/);
});

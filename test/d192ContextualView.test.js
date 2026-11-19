// ⭐ D192 (4d) · the owner's pick (11-19): option A — the two numbers, the four parts, What fits, What to do — and "the font
// color on the ats number should do it no need for the words". shared/contextualView.js words it (pure);
// client/src/components/ContextualFit.jsx draws it beside the ATS report.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scoreContextual } from "@draft/ats-scorer";
import { contextualView } from "../shared/contextualView.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

const POSTING = "Senior Backend Engineer\nWhat you'll do\n- Build payment infrastructure for merchants\n- Lead a team of 5 engineers\n- Own on-call for the ledger service\nfintech PCI";
const RESUME = "Experience\n- Built payment infrastructure for merchants in fintech on Kafka\n- Ran on-call for the ledger service\nSkills: Airflow, Kafka, Go";
const SB = { category: "software-engineering", subcategory: "swe.backend", level: "senior" };
const block = scoreContextual({ skillMatch: 72, skillsBoth: ["kafka", "go", "postgresql"],
  posting: { ...SB, text: POSTING }, resume: { ...SB, text: RESUME },
  company: { industry: "healthcare", techStack: [{ name: "Apache Kafka", postingShare: 0.64 }, { name: "Prefect", postingShare: 0.27 }, { name: "Terraform", postingShare: 0.41 }] } });

test("option A's content: the two numbers, the four parts with why, What fits, What to do", () => {
  const v = contextualView(block);
  assert.equal(v.skill, 72);
  assert.equal(v.score, block.score);
  assert.deepEqual(v.parts.map(p => p.name), ["Skill match", "Role fit", "What you have done", "Their stack"]);
  assert.equal(v.parts.find(p => p.id === "role_fit").why, "the same role");
  assert.match(v.parts.find(p => p.id === "responsibility_overlap").why, /^2 of the 3 things the role does$/);
  assert.match(v.parts.find(p => p.id === "tech_stack").why, /1 you share · 1 close · 1 you don't show/);
  const fit = Object.fromEntries(v.fits.map(f => [f.label, f.value]));
  assert.equal(fit["Skills you both have"], "kafka · go · postgresql");
  assert.equal(fit["Same purpose"], "you: Apache Airflow → they: Prefect");
  assert.equal(fit["Their stack, yours too"], "Apache Kafka");
  assert.equal(fit["Both in"], "fintech");
  assert.equal(fit["Role and level"], "backend · senior");
  assert.match(fit["You've done"], /“Build payment infrastructure for merchants”/);
  assert.deepEqual(v.todo.map(t => t.kind), ["learn", "evidence"]);
  assert.equal(v.todo[0].text, "They use Terraform (in 41% of their postings)");
  assert.match(v.todo[1].text, /^“Lead a team of 5 engineers” — your résumé doesn't show it$/);
  assert.match(v.notes[0], /^They're in healthcare; your experience is fintech\. Not counted against you\.$/);
});

test("no band WORD anywhere — the number's colour says it (owner 11-19); a part without data is left out", () => {
  const v = contextualView(block);
  assert.doesNotMatch(JSON.stringify(v), /\b(Strong|Moderate|Weak)\b/);
  const thin = contextualView(scoreContextual({ skillMatch: 50, posting: { text: "Join us." }, resume: { text: "Python" } }));
  assert.deepEqual(thin.parts.map(p => p.id), ["skill_match"]);
  assert.deepEqual([thin.fits, thin.todo], [[], []]);
  assert.equal(contextualView(null), null);
  assert.equal(contextualView(scoreContextual({ skillMatch: null })).score, null, "a declined skill match draws nothing (the component returns null)");
});

test("the component: painted by band from the tokens, beside the report (the posting's match panel — ATSPanel's one mount), no dead Atlas link", () => {
  const c = read("client/src/components/ContextualFit.jsx");
  assert.ok(c.includes("const ink = atsInk;"), "the number's colour is its band's — the one ink (AtsInk.jsx, styles/bandStyle.js tokens)");
  assert.match(c, /color: n == null \? "var\(--color-text-faint\)" : ink\(n\)/);
  assert.doesNotMatch(c, /atsBandLabel|ATS_BAND_LABELS|"Strong|Moderate"|Weak match/, "no band word");
  assert.match(c, /api\(`\/api\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/contextual`\)/);
  assert.match(c, /slugs\[t\.tech\] \? atlasHref\(slugs\[t\.tech\]\) : null/, "Learn it only when a published Atlas page exists");
  assert.match(c, /borderRadius: 2/, "D60: the bar's corner is 2 px on a 6 px bar — no capsule");
  assert.doesNotMatch(c, /#[0-9a-fA-F]{3,6}\b|rgba?\(/, "no colour literal");
  const panel = read("client/src/components/ATSPanel.jsx");
  assert.ok(panel.includes("{jobId ? <ContextualFit jobId={jobId} /> : null}"), "in the posting's match panel (ATSPanel's one mount)");
  assert.match(read("client/src/modules.manifest.js"), /"components\/ContextualFit\.jsx":/);
});

test("Home's held rows (owner 11-19: \"switch the held panel rows to colour too\"): the résumé's number in its band's colour, no band word", () => {
  const p = read("client/src/panels/AutoApplyPanel.jsx");
  assert.doesNotMatch(p, /atsBandLabel\(/, "no band word on a held row");
  assert.ok(p.includes("Base résumé: <AtsInk score={node.ref.baseAts?.score ?? null} band={node.ref.baseAts?.band ?? null} />."));
  assert.ok(p.includes("Résumé: <AtsInk score={node.ref.resume?.atsScore ?? null} />."));
  assert.ok(p.includes(" · <AtsInk score={p.baseAts?.score ?? null} band={p.baseAts?.band ?? null} /> (base resume)"));
  const ink = read("client/src/components/AtsInk.jsx");
  assert.match(ink, /export const atsInk = \(score\) => bandStyle\(atsBandFor\(Number\.isFinite\(score\) \? score : null\)\)\.fg;/);
  assert.match(ink, /style=\{\{ color: atsInk\(score\), fontWeight: 700 \}\}>\{Math\.round\(score\)\}\{suffix\}<\/span>/, "the number, painted");
  assert.match(ink, /aria-label=\{atsBandLabel\(band\)\.label\}/, "a legacy row with only a band: a dot, the word only as its accessible name");
  assert.doesNotMatch(ink.replace(/^\s*\/\/.*$/gm, ""), /#[0-9a-fA-F]{3,6}\b|rgba?\(/, "no colour literal");
});

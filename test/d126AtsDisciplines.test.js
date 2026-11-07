import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { samples } from "../services/sampleResumes.js";
import { BUILTIN_REGISTRY } from "../routes/domainProfiles.js";

// ⭐ D126 P3 (owner 11-01): THE ATS FOR EVERY DISCIPLINE. Measured 11-01: the scorer extracted 0 terms from a mechanical
// posting — its closed vocabulary (packages/ats-scorer/data/DOMAIN_METADATA_REGISTRY.json) was computing's. Eight
// engineering disciplines now carry their tools (O*NET 30.0 Technology Skills, SOC 17-2xxx, named as postings name them)
// and named practices; @draft/ats-scorer 1.3.0. Fictional samples; synthetic postings.

const REG = JSON.parse(fs.readFileSync("registry/DOMAIN_METADATA_REGISTRY.json", "utf8"));
const DISCIPLINES = ["mechanical_engineering", "electrical_engineering", "civil_engineering", "chemical_engineering",
  "industrial_engineering", "aerospace_engineering", "biomedical_engineering", "hardware_engineering"];

const MECH = { title: "Mechanical Engineer", description: "Design heat exchangers and enclosures. Requirements: SolidWorks, ANSYS, FEA, GD&T, DFMEA, tolerance stack-up, heat transfer, MATLAB, injection molding, sheet metal." };
const ELEC = { title: "Electrical Engineer", description: "Design power electronics and DC-DC converters; schematic capture and PCB layout in Altium Designer; LTspice simulation; board bring-up with an oscilloscope; UL certification." };
const SWE = { title: "Software Engineer", description: "We are hiring a Software Engineer. You will build backend services in Java, Go and TypeScript, using PostgreSQL, Redis, Docker, Kubernetes and AWS. Requirements: 3+ years with REST APIs, SQL, CI/CD, unit testing." };

test("d126AtsNonCsVocabulary: a mechanical and an electrical posting are SCORED, not declined", () => {
  const m = scoreAtsLocally({ job: MECH, resumeText: samples().C.resumeText });
  assert.ok(m.score != null, `declined: ${m.decline_reasons}`);
  assert.ok(m.tier1_matched.length >= 6, m.tier1_matched.join(", "));
  for (const t of ["SolidWorks", "ANSYS", "DFMEA", "tolerance stack-up"]) assert.ok(m.tier1_matched.includes(t), t);
  const e = scoreAtsLocally({ job: ELEC, resumeText: samples().D.resumeText });
  assert.ok(e.score != null && e.tier1_matched.includes("Altium Designer") && e.tier1_matched.includes("LTspice"));
});

test("d126: computing does not move — a software posting matches no term that only the new disciplines name", () => {
  const before = new Set(Object.entries(REG).filter(([k]) => !DISCIPLINES.includes(k))
    .flatMap(([, v]) => [...(v.keywords || []), ...(v.tools || [])].map(t => t.toLowerCase())));
  const r = scoreAtsLocally({ job: SWE, resumeText: samples().A.resumeText });
  const onlyNew = [...r.tier1_matched, ...(r.tier1_missing || [])].filter(t => !before.has(String(t).toLowerCase())
    && DISCIPLINES.some(d => [...REG[d].keywords, ...REG[d].tools].some(x => x.toLowerCase() === String(t).toLowerCase())));
  assert.deepEqual(onlyNew, []);
});

test("d126: eight disciplines, each with titles, practices, verbs and tools — and no word generic enough to leak into software", () => {
  const GENERIC = ["testing", "quality", "risk management", "throughput", "cycle time", "specifications", "inspections",
    "prototyping", "systems engineering", "oracle", "erp", "agile", "communication", "leadership"];
  for (const d of DISCIPLINES) {
    const v = REG[d];
    assert.equal(v.roleFamily, "engineering", d);
    assert.ok(v.suggestedTitles.length >= 6 && v.keywords.length >= 20 && v.tools.length >= 10 && v.actionVerbs.length === 15, d);
    for (const t of [...v.keywords, ...v.tools]) assert.ok(!GENERIC.includes(t.toLowerCase()), `${d}: "${t}" is too generic`);
  }
});

test("d126: the three copies agree — registry/, the scorer package, and the domain picker's fallback; the package is 1.3.0", () => {
  assert.equal(fs.readFileSync("registry/DOMAIN_METADATA_REGISTRY.json", "utf8"), fs.readFileSync("packages/ats-scorer/data/DOMAIN_METADATA_REGISTRY.json", "utf8"));
  for (const d of DISCIPLINES) assert.deepEqual(BUILTIN_REGISTRY[d], REG[d], d);
  // At least 1.3.0, the release that carried these disciplines (A111 P2 moved it to 1.4.0 and pins that itself).
  const [maj, min] = JSON.parse(fs.readFileSync("packages/ats-scorer/package.json", "utf8")).version.split(".").map(Number);
  assert.ok(maj > 1 || (maj === 1 && min >= 3));
});

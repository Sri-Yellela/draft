import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { prefillFromResumeText, prefillDiff, PREFILL_FIELDS, NEVER_PREFILL } from "../shared/resumePrefill.js";

// A33: a résumé PREFILLS the profile — proposed, confirmed by the user, never auto-accepted, and
// never the eligibility or EEO answers. Synthetic person throughout.
const RESUME = [
  "JANE Q DOE",
  "Boston, MA | jane.doe@example.org | (617) 555-0142 | linkedin.com/in/janedoe | github.com/janedoe",
  "SUMMARY",
  "Backend engineer. Authorized to work in the US; no sponsorship required. US Citizen. Veteran.",
  "EDUCATION",
  "Northeastern University — Boston, MA",
  "M.S. in Computer Science, 2021",
  "B.Tech in Electronics, 2017",
  "EXPERIENCE",
  "Stripe — Software Engineer",
].join("\n");

test("it reads the contact, location and education fields, each with the line it came from", () => {
  const p = prefillFromResumeText(RESUME);
  assert.equal(p.full_name.value, "Jane Q Doe");
  assert.equal(p.email.value, "jane.doe@example.org");
  assert.equal(p.phone.value, "(617) 555-0142");
  assert.equal(p.linkedin_url.value, "https://linkedin.com/in/janedoe");
  assert.equal(p.github_url.value, "https://github.com/janedoe");
  assert.deepEqual([p.city.value, p.state.value], ["Boston", "MA"]);
  assert.equal(p.highest_degree.value, "Master's");
  assert.equal(p.university.value, "Northeastern University");
  assert.equal(p.field_of_study.value, "Computer Science");
  assert.equal(p.graduation_year.value, "2021", "the degree's own year, not the older degree's below it");
  for (const v of Object.values(p)) assert.ok(RESUME.includes(v.from), "every proposal names its source line");
});

test("a state code in the header is not a degree", () => {
  const p = prefillFromResumeText("JOHN ROE\nJackson, MS | john@example.org\nEXPERIENCE\nAcme — Engineer");
  assert.equal(p.highest_degree, undefined);
  assert.equal(p.state.value, "MS");
});

test("⛔ eligibility and EEO answers are NEVER proposed, whatever the résumé says", () => {
  const p = prefillFromResumeText(RESUME);
  for (const f of NEVER_PREFILL) assert.equal(p[f], undefined, f);
  for (const f of NEVER_PREFILL) assert.ok(!PREFILL_FIELDS.includes(f), `${f} is not a prefill field`);
  const diff = prefillDiff({ ...p, work_auth: { value: "US Citizen", from: "x" } }, {});
  assert.ok(!diff.some(r => r.field === "work_auth"), "even a hand-built proposal cannot carry one through");
});

test("only what would CHANGE is offered, and the panel ticks overwrites OFF by default", () => {
  const diff = prefillDiff(prefillFromResumeText(RESUME), { email: "jane.doe@example.org", phone: "+1 (617) 555-9999" });
  assert.ok(!diff.some(r => r.field === "email"), "already the same: not offered");
  const phone = diff.find(r => r.field === "phone");
  assert.equal(phone.current, "+1 (617) 555-9999");
  const ui = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");
  assert.match(ui, /setPrefillPicked\(Object\.fromEntries\(rows\.map\(r => \[r\.field, !String\(r\.current \|\| ""\)\.trim\(\)\]\)\)\)/,
    "an empty field is ticked, a replacement is not");
  assert.match(ui, /nothing is saved until you press Save/);
  assert.doesNotMatch(ui.slice(at(ui, "data-resume-prefill"), at(ui, "Fill the ticked fields") + 40), /api\(/,
    "the prefill only fills the form — Save is the user's");
});

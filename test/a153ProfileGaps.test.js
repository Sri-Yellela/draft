// ⭐ A153 (45o) · the Profile's dropped pieces against the D183 sketch: job durations on screen (one function, shared), school
// logos on Education (the employer logo store, looked up by name), "Get started" on the public header, Atlas's link to the
// public profile instead of the retired /p/ proof page. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { durationLabel } from "../shared/durationLabel.js";
import { durationLabel as fromPage } from "../services/profilePage.js";

test("A153 · one duration function, the page's and the editor's", () => {
  assert.equal(fromPage, durationLabel, "services/profilePage re-exports the shared one");
  assert.equal(durationLabel("2023-01", "2025-04"), "2 yrs 4 mos");
  assert.equal(durationLabel("2025-01", "2025-01"), "1 mo");
  assert.equal(durationLabel("2025-06", "2025-01"), null, "an end before the start says nothing");
  assert.equal(durationLabel("2024-03", null, new Date(Date.UTC(2026, 2, 15))), "2 yrs 1 mo", "current = to now");
  const ed = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8");
  assert.match(ed, /import \{ durationLabel \} from "\.\.\/\.\.\/\.\.\/shared\/durationLabel\.js";/);
  assert.match(ed, /data-duration=""/);
  assert.match(fs.readFileSync("routes/publicProfile.js", "utf8"), /durationLabel\(x\.start, x\.current \? null : x\.end\)/, "the public page too");
});

test("A153 · schools carry logos like employers; the public header offers Get started; Atlas links /in/", () => {
  const sp = fs.readFileSync("services/structuredProfile.js", "utf8");
  assert.match(sp, /logo: logoOf\(r\.school\), initial: String\(r\.school \|\| "\?"\)/);
  assert.match(sp, /UNION SELECT school FROM profile_education WHERE user_id = \?/, "schools are looked up in the background too");
  const ed = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8");
  assert.match(ed, /data-education-row="">\s*\{\/\*[\s\S]*?\*\/\}\s*<LogoTile logo=\{x\.logo\}/);
  const pub = fs.readFileSync("routes/publicProfile.js", "utf8");
  assert.match(pub, /<a href="\/register" data-get-started="">Get started<\/a>/);
  assert.match(pub, /\$\{e\.logo \? `<img class="logo" src="\$\{esc\(e\.logo\)\}" alt="">` : ""\}<b>\$\{esc\(e\.school\)\}<\/b>/);
  const run = fs.readFileSync("client/src/pages/atlas/YourRun.jsx", "utf8");
  assert.doesNotMatch(run, /href=\{`\/p\/\$\{/, "no link to the retired /p/ address");
  assert.match(run, /href=\{`\/in\/\$\{proofPage\.handle\}`\}/);
});

test("A153 part 2 · photo on the profile, the page's own replace, edited marks, counts as proof, Behind as folded rows", () => {
  const yp = fs.readFileSync("client/src/pages/profile/YourProfile.jsx", "utf8");
  assert.match(yp, /function PhotoUpload\(\{ has \}\)/);
  assert.match(yp, /await api\("\/api\/account\/avatar", \{ method: "POST", body: form \}\);\s*announceAccountChanged\(\);/, "the account's one picture");
  assert.match(yp, /await api\("\/api\/parse-pdf", \{ method: "POST", body: form \}\);/);
  assert.match(yp, /\/api\/domain-profiles\/\$\{page\.activeProfileId\}\/base-resume/);
  assert.match(yp, /window\.dispatchEvent\(new Event\(RESUME_REPLACED_EVENT\)\);/, "then What changed (P2)");
  for (const id of ["contact", "defaults", "resumes", "skills", "tailoring", "proofpage"]) assert.ok(yp.includes(`<BehindRow id="${id}"`), id);
  assert.match(yp, /\{mounted \? children : null\}/, "a row mounts its editor only once opened");
  assert.match(fs.readFileSync("services/profilePage.js", "utf8"), /activeProfileId: safe\(\(\) => db\.prepare\(`SELECT id FROM domain_profiles WHERE user_id = \? AND is_active = 1 LIMIT 1`\)/);
  const ps = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8");
  assert.match(ps, /source === "user" \? <span data-edited-by-you=""/);
  assert.equal((ps.match(/<EditedMark source=\{x\.source\} theme=\{theme\} \/>/g) || []).length, 3, "experience, projects, education");
  // provesSkills, run from the component's own source: whole words, your skills, only with a proof link
  const start = ps.indexOf("export function provesSkills("), end = ps.indexOf("\nfunction Box(", start);
  const provesSkills = new Function(`${ps.slice(start, end).replace("export function", "function")}; return provesSkills;`)();
  const sk = [{ name: "Kafka" }, { name: "Go" }, { name: "C++" }, { name: "Java" }];
  assert.deepEqual(provesSkills({ backed: true, name: "Tidewatch", description: "A Kafka pipeline in Go, C++ core" }, sk), ["Kafka", "Go", "C++"]);
  assert.deepEqual(provesSkills({ backed: true, name: "JavaScript app", description: "good stuff" }, sk), [], "Java is not JavaScript; Go is not good");
  assert.deepEqual(provesSkills({ backed: false, name: "Kafka" }, sk), [], "no proof link, no claim");
});

// ⭐ A153 (45o) · the Profile's dropped pieces against the D183 sketch: job durations on screen (one function, shared), school
// logos on Education (the employer logo store, looked up by name), "Get started" on the public header, Atlas's link to the
// public profile instead of the retired /p/ proof page. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
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
  const run = (fs.readFileSync("client/src/pages/atlas/Logbook.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: YourRun.jsx deleted — its home now */;
  assert.doesNotMatch(run, /href=\{`\/p\/\$\{/, "no link to the retired /p/ address");
  assert.match(run, /href=\{`\/in\/\$\{proofPage\.handle\}`\}/);
});

// ⛔ 47m (changed on purpose): "A153 part 2 · photo on the profile, the page's own replace, edited marks, counts" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "A223 (46r) · 'Add a photo' sits beside the avatar — the full-width head row's fr" retired — Your profile is the plate passport (D197 #9): its look is plate/personPages.css.

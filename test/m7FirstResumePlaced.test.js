// ⭐ 45s · two defects the M-7 walk (scripts/walk45s.mjs m7, real Chrome, D184's samples G–I) found:
//   (1) the FIRST résumé (the board's Upload your résumé → startFromResume) was never placed — only a later one was
//       (followProfileText), so the board's sentence never took the person's role / level / city, and their next résumé
//       counted as a first placement: a family move never paused Apply for me.
//   (2) the board's profile-key effect restored the cached / default snapshot AFTER the placement effect in the same commit,
//       resetting the résumé's level and places: "at all career levels … in the United States" for every résumé.
// Synthetic samples only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { startFromResume } from "../services/resumeOnboarding.js";
import { storedPlacement } from "../services/placement.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const at = (s, a) => { const i = s.indexOf(a); assert.ok(i >= 0, `anchor missing: ${a}`); return i; };

test("m7FirstResumePlaced: the board's first upload places the job profile (role, subcategory, level)", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'maya', 'x')").run();
  db.prepare("INSERT INTO user_profile (user_id) VALUES (1)").run();
  const maya = JSON.parse(fs.readFileSync("content/trial/sample-g.json", "utf8"));
  const r = startFromResume(db, 1, { content: maya.resumeText, name: "maya.txt" }, {
    registry: getRegistry(), saveBaseResume: () => {}, readProfile: () => null });
  const p = storedPlacement(db, 1);
  assert.ok(r.profileId);
  assert.equal(p?.asks, false, "placed, not asking");
  assert.equal(p.categoryName, maya.expected.category);
  assert.equal(p.subName, maya.expected.subcategory);
  assert.equal(p.level, maya.expected.level);
  assert.match(read("services/resumeOnboarding.js"), /deps\.saveBaseResume\(id, text, name \|\| "resume\.txt"\);\n  placeFirstResume\(db, id, text, inferred, deps\.registry\);/);
});

test("m7SentenceSurvivesTheRestore: the résumé's sentence applied for a profile is re-applied after that profile's snapshot restore", () => {
  const jp = read("client/src/panels/JobsPanel.jsx");
  const eff = jp.slice(at(jp, "const placementSentenceRef = useRef(null);"), at(jp, "}, [activeDomainProfile?.id, activeDomainProfile?.placed_at]"));
  assert.match(eff, /placementSentenceRef\.current = mine;/);
  assert.match(eff, /requestAnimationFrame\(\(\) => \{ if \(placementSentenceRef\.current === mine\) placementSentenceRef\.current = null; \}\)/, "only a restore from the same moment");
  const restore = jp.slice(at(jp, "const applyProfileSnapshot = useCallback("), at(jp, "}, [setBoardTab, setLocalSearch, setSortBy, applyFilterSnapshot]);"));
  assert.match(restore, /applyFilterSnapshot\(snapshot\);[\s\S]*const placed = placementSentenceRef\.current;\n    if \(placed && profileKey != null && placed\.key === String\(profileKey\)\) \{[\s\S]*setExperienceLevels\(placed\.next\.experience_levels\);[\s\S]*setPlaces\(placed\.next\.places\);/);
});

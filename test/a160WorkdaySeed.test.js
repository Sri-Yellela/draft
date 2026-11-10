// 46a (A160, owner 11-09 "make a note to add workday … support") · a Workday board found by scripts/findNonTechBoards.mjs
// (slug "wdN|tenant|site") must survive the whole candidate path: the seed file → seedItems' board URL (before 46a there was
// no workday entry, so such a hit was silently dropped) → poolCandidates' guards → the nightly probe → the owner's approval
// → company_ats_list. SYNTHETIC tenant; the probe is a stand-in (no network).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importSeedCandidates, seedItems } from "../services/seedCandidates.js";
import { runCandidateProbe, planApproval, approveCandidates } from "../services/companyCandidates.js";
import { harvestPairOf } from "../services/slugHarvest.js";

const SLUG = "5|examplebuild|External_Careers";
function seedFile(found) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a160-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ tried: {}, found }));
  return f;
}

test("A160: a harvested Workday URL round-trips to the same board URL seedItems writes", () => {
  const p = harvestPairOf("https://examplebuild.wd5.myworkdayjobs.com/en-US/External_Careers/job/Boston-MA/Project-Manager_R123");
  assert.deepEqual(p, { atsType: "workday", slug: SLUG });
  const [item] = seedItems(seedFile([{ company: "Example Build Co", atsType: "workday", slug: SLUG, industry: "construction", evidence: { us: 30, inScope: 12 } }]));
  assert.equal(item.ats.url, "https://examplebuild.wd5.myworkdayjobs.com/External_Careers");
  assert.deepEqual(harvestPairOf(item.ats.url), p);
  assert.equal(seedItems(seedFile([{ company: "Bad", atsType: "workday", slug: "examplebuild" }])).length, 0, "a malformed workday slug is dropped, not given a broken URL");
});

test("A160: a Workday seed candidate is pooled, probed and added on approval, end to end", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const f = seedFile([{ company: "Example Build Co", atsType: "workday", slug: SLUG, industry: "construction", evidence: { us: 30, inScope: 12 } }]);
  assert.equal(importSeedCandidates(db, { file: f }).inserted, 1);
  const seen = [];
  const probe = async (b) => { seen.push(b); return { state: "live", jobs: 40, us: 30, cs: 9, csOpen: 12, cs30: 4, pct30: 30, pct120: 75 }; };
  const r = await runCandidateProbe(db, { env: {}, probe, sleep: async () => {}, gapMs: 0 });
  assert.equal(r.probed, 1);
  assert.deepEqual(seen.map(s => [s.atsType, s.slug]), [["workday", SLUG]]);
  const row = db.prepare("SELECT id, status FROM company_candidates").get();
  assert.equal(row.status, "probed");
  const plan = planApproval(db, [row.id]);
  assert.equal(plan.eligible.length, 1, JSON.stringify(plan.refused));
  const out = approveCandidates(db, plan, { adminUserId: null });
  assert.equal(out.added.length, 1, JSON.stringify(out.failed));
  const co = db.prepare("SELECT company, ats_type, ats_slug FROM company_ats_list WHERE ats_type = 'workday' AND ats_slug = ?").get(SLUG);
  assert.deepEqual(co, { company: "Example Build Co", ats_type: "workday", ats_slug: SLUG });
});

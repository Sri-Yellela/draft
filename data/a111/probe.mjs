// A111 P1 (D127 P2) probe: services/companyProbe.js probeBoard (the D78 / D80 funnel, unchanged — `cs` stays "in the
// board's scope", which scripts/d80ApplyTranche.mjs admits on) PLUS the per-category reading A111 needs: of the US
// postings within the age limit with a white-collar family, how many categoryOf places in each category, and how many
// it HOLDS (and why). READ-ONLY: no database. Polite: ONE board at a time, a pause between boards.
//
//   node data/a111/probe.mjs <candidates.json> <out.json> [--delay 600]
// Resumable: rows already in <out.json> are skipped (an interrupted run picks up where it stopped).
import fs from "node:fs";
import { probeBoard } from "../../services/companyProbe.js";
import { ATS_FETCHERS } from "../../services/companyList.js";
import { usEligibility, officeLocations } from "../../services/jobs/usLocation.js";
import { ageOf, DEFAULT_LIMIT_DAYS } from "../../services/jobs/boardAge.js";
import { classifyJob } from "../../services/jobs/classifyJob.js";
import { categoryOf } from "../../services/jobs/professionalScope.js";

const [candFile, outFile] = process.argv.slice(2);
const di = process.argv.indexOf("--delay");
const DELAY = di > 0 ? Number(process.argv[di + 1]) : 600;
if (!candFile || !outFile) { console.error("usage: probe.mjs <candidates.json> <out.json> [--delay ms]"); process.exit(2); }
const TARGET = ["business", "management", "marketing", "sales", "legal", "arts_media", "science"];
const candidates = JSON.parse(fs.readFileSync(candFile, "utf8"));
const done = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : [];
const have = new Set(done.map(r => `${r.atsType}:${r.slug}`.toLowerCase()));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

function categories(jobs) {
  const byCategory = {}, heldByReason = {}, sample = {};
  let held = 0, target = 0;
  for (const j of jobs) {
    if (!usEligibility({ location: j.location, description: j.description, offices: officeLocations(j._raw) }).admit) continue;
    if (ageOf({ posted_at: j.posted_at }, { now, limitDays: DEFAULT_LIMIT_DAYS }).tooOld) continue;
    const verdict = classifyJob(j.title || "", j.description || "", j.company || "");
    if (verdict.collar === "blue" || verdict.roleKey === null) continue;
    const v = categoryOf({ title: j.title, roleKey: verdict.roleKey });
    if (!v.inScope) { held++; heldByReason[v.reason] = (heldByReason[v.reason] || 0) + 1; continue; }
    byCategory[v.category] = (byCategory[v.category] || 0) + 1;
    if (TARGET.includes(v.category)) {
      target++;
      (sample[v.category] ||= []).length < 3 && sample[v.category].push(j.title);
    }
  }
  return { target, held, byCategory, heldByReason, sample };
}

let i = 0;
for (const c of candidates) {
  i++;
  if (have.has(`${c.atsType}:${c.slug}`.toLowerCase())) continue;
  let captured = [];
  const fetch = ATS_FETCHERS[c.atsType];
  const fetchers = { [c.atsType]: async (...a) => (captured = (await fetch(...a)) || []) };
  let row;
  try {
    const p = await probeBoard(c, { fetchers, now });
    const { fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120, medianAge, salaryPct, usPct, dated } = p;
    row = { atsType: c.atsType, slug: c.slug, company: c.company, boardName: p.companyGuess || null, state: p.state, ok: p.ok,
            descriptions: p.descriptions?.note ?? null, dated, fetched, us, fresh, classified, cs, csOpen, cs30, pct30, pct120,
            medianAge, salaryPct, usPct, ...(p.state === "live" ? categories(captured) : {}) };
  } catch (e) {
    row = { ...c, state: "error", ok: false, error: e.message };
  }
  done.push(row);
  fs.writeFileSync(outFile, JSON.stringify(done, null, 1));
  console.log(`${i}/${candidates.length} ${c.atsType}:${c.slug} ${row.state} target=${row.target ?? "-"} held=${row.held ?? "-"} ${row.byCategory ? JSON.stringify(row.byCategory) : (row.error || "")}`);
  await sleep(DELAY);
}
console.log(`done: ${done.length} rows in ${outFile}`);

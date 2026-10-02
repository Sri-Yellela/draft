#!/usr/bin/env node
// A49 fix 2 — measure the cross-source fingerprint on a board, read-only.
//
//   node scripts/a49FingerprintMeasure.mjs <path-to-a-COPY-of-resume_master.db>
//
// ⛔ Opens the given file READ-ONLY and replays into an in-memory database built from every
// migration; it never writes the file it is given. Run it on a copy anyway.
//
// Two measurements, both through the REAL deduper (reconcileFingerprint + upsertCanonicalJob), so
// what is counted is what the board would do, not what the fingerprint string alone would say:
//
//  1. FALSE MERGES on the real board. Every active row is replayed, in order, as its own source.
//     Each fold or retirement is a merge the board would make; on a board of direct-ATS rows every
//     one of them is wrong unless the two rows are the same posting. Also reports the identical-
//     description groups (one role posted in several cities) and whether any collapsed.
//
//  2. MERGES GAINED for simulated aggregator echoes of each US row — the variants the audit used:
//     the location as "City, ST", as "City, State", the company with ", Inc.", the title with
//     " - Remote". Each echo is an adzuna row (no req id, redirect URL). A fold into the row it
//     was made from is a correct merge; into any other row, a false one.
import Database from 'better-sqlite3';
import { MIGRATIONS } from './migrations.js';
import { reconcileFingerprint, upsertCanonicalJob } from '../services/jobs/aggregator.js';
import { computeFingerprint } from '../services/jobs/schema.js';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/a49FingerprintMeasure.mjs <db copy>'); process.exit(2); }
const from = new Database(src, { readonly: true, fileMustExist: true });

const STATE = {
  AL: 'Alabama', AZ: 'Arizona', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', IL: 'Illinois', MA: 'Massachusetts', MD: 'Maryland', MI: 'Michigan', MN: 'Minnesota',
  MO: 'Missouri', NC: 'North Carolina', NE: 'Nebraska', NJ: 'New Jersey', NY: 'New York', OH: 'Ohio', OR: 'Oregon',
  PA: 'Pennsylvania', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VA: 'Virginia', WA: 'Washington', HI: 'Hawaii',
};
const NAME_TO_CODE = Object.fromEntries(Object.entries(STATE).map(([k, v]) => [v.toLowerCase(), k]));
// Bare city names the simulation can place without guessing (the board's own big cities).
const BARE = { 'san francisco': 'CA', 'new york': 'NY', 'new york city': 'NY', 'seattle': 'WA', 'chicago': 'IL',
  'austin': 'TX', 'boston': 'MA', 'pittsburgh': 'PA', 'palo alto': 'CA', 'los angeles': 'CA', 'atlanta': 'GA',
  'denver': 'CO', 'mountain view': 'CA', 'salt lake city': 'UT' };
const CITY_NAME = (c) => c.replace(/\b\w/g, (x) => x.toUpperCase());

/** The posting's first US city and state, read from its own location — or null. */
function usCityState(location) {
  const first = String(location || '').split(/\s*(?:\||;|•|·|\n|\(|\s\/\s)\s*/)[0].replace(/^(hybrid|us)\s*[-–:]\s*/i, '').trim();
  let m = first.match(/^([A-Za-z .'-]+?),\s*([A-Z]{2})\b/);
  if (m && STATE[m[2]]) return { city: m[1].trim(), code: m[2] };
  m = first.match(/^([A-Za-z .'-]+?),\s*([A-Za-z ]+?)(?:,|$)/);
  if (m && NAME_TO_CODE[m[2].trim().toLowerCase()]) return { city: m[1].trim(), code: NAME_TO_CODE[m[2].trim().toLowerCase()] };
  const bare = first.split(',')[0].trim().toLowerCase();
  if (BARE[bare]) return { city: CITY_NAME(bare === 'new york city' ? 'new york' : bare), code: BARE[bare] };
  return null;
}

function board() {
  const db = new Database(':memory:');
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}

const VERDICT = { roleKey: 'engineering', seniority: 'mid', domain: 'software', collar: 'white', confidence: 0.9 };
function write(db, job) {
  const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
  if (dedup.action === 'fold') return dedup.intoJobId;
  upsertCanonicalJob(db, { jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: 'h',
    searchQuery: job.source, sourceLabel: job.source, matchedBy: 'a49', dedup, now: 1_790_000_000 });
  return null;
}

const rows = from.prepare(`
  SELECT job_id, title, company, location, url, source, description, req_uid FROM scraped_jobs
  WHERE is_active = 1 ORDER BY job_id`).all();
const asJob = (r) => ({ id: r.job_id, title: r.title, company: r.company, location: r.location, url: r.url,
  source: r.source, description: r.description,
  req_id: r.req_uid ? r.req_uid.split(':').slice(2).join(':') : null });

// ── 1. the real board, replayed ───────────────────────────────────────────────────────────────
const db = board();
const realMerges = [];
db.transaction(() => {
  for (const r of rows) {
    const into = write(db, asJob(r));
    if (into) realMerges.push([r.job_id, into]);
  }
})();
const retiredOnReplay = db.prepare("SELECT job_id, duplicate_of FROM scraped_jobs WHERE duplicate_of IS NOT NULL").all();

// Fingerprint groups on the real board (string level, before req ids get a say).
const groups = new Map();
for (const r of rows) {
  const fp = computeFingerprint(r);
  if (!groups.has(fp)) groups.set(fp, []);
  groups.get(fp).push(r);
}
const multi = [...groups.values()].filter(g => g.length > 1);
const multiCity = multi.filter(g => new Set(g.map(r => usCityState(r.location)?.city?.toLowerCase() || r.location)).size > 1);

// One role in several cities: identical company + title + description, more than one location.
const byText = new Map();
for (const r of rows) {
  if (!r.description) continue;
  const k = `${r.company}|${r.title}|${r.description}`;
  if (!byText.has(k)) byText.set(k, []);
  byText.get(k).push(r);
}
const textGroups = [...byText.values()].filter(g => g.length > 1);
const severalCities = textGroups.filter(g => new Set(g.map(r => r.location)).size > 1);
const collapsedCities = severalCities.filter(g => {
  const fps = new Map();
  for (const r of g) {
    const fp = computeFingerprint(r);
    if (fps.has(fp) && fps.get(fp) !== r.location) return true;
    fps.set(fp, r.location);
  }
  return false;
});

// ── 2. simulated aggregator echoes ───────────────────────────────────────────────────────────
const VARIANTS = {
  'City, ST':    (r, cs) => cs && { location: `${cs.city}, ${cs.code}` },
  'City, State': (r, cs) => cs && { location: `${cs.city}, ${STATE[cs.code]}` },
  ', Inc.':      (r, cs) => cs && { company: `${r.company}, Inc.` },
  ' - Remote':   (r, cs) => cs && { title: `${r.title} - Remote` },
};
const echo = {};
for (const [name, make] of Object.entries(VARIANTS)) {
  let tried = 0, correct = 0, wrong = 0, wrongCity = 0;
  for (const r of rows) {
    const cs = usCityState(r.location);
    const over = make(r, cs);
    if (!over) continue;
    tried++;
    // Against the whole replayed board, inside a savepoint that is rolled back: every echo meets
    // every real row (so a wrong fold has somewhere to go) and none of them sees another echo.
    db.exec('SAVEPOINT echo');
    let into;
    try {
      into = write(db, { id: `adz-${r.job_id}`, source: 'adzuna', url: `https://www.adzuna.com/land/ad/${tried}`,
        title: r.title, company: r.company, location: r.location, description: r.description, ...over });
    } finally {
      db.exec('ROLLBACK TO echo'); db.exec('RELEASE echo');
    }
    if (!into) continue;
    if (into === r.job_id) correct++;
    else {
      wrong++;
      const target = rows.find(p => p.job_id === into);
      if ((usCityState(target?.location)?.city || '').toLowerCase() !== cs.city.toLowerCase()) wrongCity++;
    }
  }
  echo[name] = { tried, mergedIntoOrigin: correct, pct: tried ? +(100 * correct / tried).toFixed(1) : 0,
                 foldedIntoAnotherRow: wrong, ofWhichDifferentCity: wrongCity };
}

console.log(JSON.stringify({
  db: src, activeRows: rows.length,
  realBoard: {
    fingerprintGroups: multi.length, groupsSpanningCities: multiCity.length,
    mergesOnReplay: realMerges.length, retiredOnReplay: retiredOnReplay.length,
    identicalDescriptionGroups: textGroups.length, oneRoleSeveralCities: severalCities.length,
    severalCitiesCollapsedByFingerprint: collapsedCities.length,
    spanningExamples: multiCity.slice(0, 5).map(g => g.map(r => `${r.company} | ${r.title} | ${r.location}`)),
  },
  simulatedEchoes: echo,
}, null, 2));

// ⛔ D71 (owner, 10-08) · PAY AND LOCATION THAT SIT IN THE PROSE.
//
// A captured Amazon posting showed no salary and no location while its own text ended
// "USA, MA, Boston - 143,700.00 - 194,400.00 USD annually". Measured 10-07: 260 of production's 675
// salary-empty active postings state pay in their text. The fix reads the WHOLE text, deterministically
// (D17), into description_fields.pay — never into the provider's salary_* columns — and the place on
// the pay line into D29's tags.
//
// Each test is red when the thing it pins is removed: the Amazon line parses · multi-location lines
// yield several (location, min, max) · the five traps do NOT parse · a structured salary is never
// overwritten · description and content_hash are unchanged after the backfill · the Amazon row reads
// Boston, MA and $143.7k–$194.4k, is in Boston, passes the US floor, sorts and filters by salary.
// Fixtures are SYNTHETIC postings in the shapes the owner reported.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { payFromText, placeOfPayLine, annualisedUsd } from "../services/jobs/payFromText.js";
import { backfillDescriptionText, deriveDescriptionColumns } from "../services/jobs/descriptionText.js";
import { computeContentHash } from "../services/jobs/enrichmentSelection.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { deriveTags } from "../services/jobs/jobTags.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { SORT_KEYS } from "../services/jobs/jobCursor.js";
import { deckStrip, salaryLabel, NOT_STATED, COULD_NOT_READ } from "../shared/postingFacts.js";

const AMAZON = [
  "Job ID: 0000001 | Synthetic Retail Services LLC",
  "",
  "DESCRIPTION",
  "Build systems that scale. Own services end to end.",
  "",
  "BASIC QUALIFICATIONS",
  "- 3+ years of non-internship professional software development experience",
  "",
  "Our compensation reflects the cost of labor across several US geographic markets. The base salary range for this position is listed below. Your actual base pay will be consistent with the job.",
  "USA, MA, Boston - 143,700.00 - 194,400.00 USD annually",
].join("\n");
const MULTI = [
  "Pay Transparency",
  "USA, CA, Palo Alto - 150,000.00 - 210,000.00 USD annually",
  "USA, WA, Seattle - 140,000.00 - 200,000.00 USD annually",
  "Boston, MA, USA - 145,000.00 - 205,000.00 USD annually",
].join("\n");
const HOURLY = "The pay rate for this role is $45 - $60 per hour, depending on experience.";
const K_SUFFIX = "Salary: $150k-$180k plus equity.";
const BETWEEN = "The base salary for this role is between $120,000 and $150,000.";
const PER_YEAR = "We offer $130,000 – $170,000 per year for this role.";
const TRAPS = {
  revenue: "Last year we grew to $10,000,000 in revenue.",
  "401k": "Benefits include 401(k) matching up to 6%.",
  experience: "You bring 10–20 years of experience.",
  team: "You will join a team of 143,700 people.",
  budget: "You will own a $1–2 million budget.",
};

function migratedDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
function seed(d, id, description, extra = {}) {
  const title = extra.title || "Software Engineer";
  d.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, location, url, source, description, content_hash,
               salary_min, salary_max, salary_currency, salary_min_usd, salary_max_usd, salary_period, is_active)
             VALUES (?, 'test', ?, ?, 'Synthetic Co', ?, ?, 'import', ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(id, `h-${id}`, title, extra.location ?? "Location not specified", `https://example.com/${id}`, description,
      computeContentHash(title, description), extra.min ?? null, extra.max ?? null, extra.currency ?? null,
      extra.min ?? null, extra.max ?? null, extra.period ?? null);
}

test("D71: the Amazon line parses — USD, annual, Boston MA, as stated", () => {
  const p = payFromText(AMAZON);
  assert.deepEqual({ min: p.salary_min, max: p.salary_max, cur: p.salary_currency, unit: p.salary_period, src: p.source },
    { min: 143700, max: 194400, cur: "USD", unit: "annual", src: "description" });
  assert.deepEqual(p.locations, [{ country: "US", state: "MA", city: "Boston", min: 143700, max: 194400 }]);
});

test("D71: one range per location — several (location, min, max), the overall min–max", () => {
  const p = payFromText(MULTI);
  assert.equal(p.locations.length, 3);
  assert.deepEqual(p.locations.map(l => [l.city, l.state, l.min, l.max]),
    [["Palo Alto", "CA", 150000, 210000], ["Seattle", "WA", 140000, 200000], ["Boston", "MA", 145000, 205000]]);
  assert.deepEqual([p.salary_min, p.salary_max], [140000, 210000]);
});

test("D71: hourly stays hourly · the k suffix · between X and Y · $ … per year", () => {
  const h = payFromText(HOURLY);
  assert.deepEqual([h.salary_min, h.salary_max, h.salary_period], [45, 60, "hourly"]);
  assert.deepEqual(annualisedUsd(h), { min: 93600, max: 124800 }, "the sort's estimate is explicit, 2,080 hours");
  assert.deepEqual([payFromText(K_SUFFIX).salary_min, payFromText(K_SUFFIX).salary_max], [150000, 180000]);
  assert.deepEqual([payFromText(BETWEEN).salary_min, payFromText(BETWEEN).salary_max], [120000, 150000]);
  assert.deepEqual([payFromText(PER_YEAR).salary_min, payFromText(PER_YEAR).salary_period], [130000, "annual"]);
});

test("D71: the five traps do NOT parse — a wrongly parsed salary is worse than a missing one", () => {
  for (const [name, text] of Object.entries(TRAPS)) assert.equal(payFromText(text), null, name);
});

test("D71: a pay line's place — country/state/city in either order; a street is not a city", () => {
  assert.deepEqual(placeOfPayLine("USA, MA, Boston - "), { country: "US", state: "MA", city: "Boston" });
  assert.deepEqual(placeOfPayLine("Boston, MA, USA"), { country: "US", state: "MA", city: "Boston" });
  assert.deepEqual(placeOfPayLine("Boston, MA"), { country: "US", state: "MA", city: "Boston" });
  assert.equal(placeOfPayLine("1001 Boston Post Rd, MA"), null);
  assert.equal(placeOfPayLine("The base salary range is"), null);
});

test("D71: the derived columns carry the text's pay; the provider's salary_* are never written", () => {
  const cols = deriveDescriptionColumns(AMAZON);
  const fields = JSON.parse(cols.description_fields);
  assert.equal(fields.pay.source, "description");
  assert.equal(fields.payLocationLabel, "Boston, MA");
  assert.deepEqual([cols.pay_text_min_usd, cols.pay_text_max_usd], [143700, 194400]);
  for (const k of Object.keys(cols)) assert.ok(!k.startsWith("salary_"), `derivation writes ${k}`);
});

test("D71: a structured salary is never overwritten, on the row or in what the board shows", () => {
  const d = migratedDb();
  seed(d, "structured", AMAZON, { min: 160000, max: 200000, currency: "USD", period: "annual" });
  backfillDescriptionText(d, { dryRun: false });
  const row = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'structured'").get();
  assert.deepEqual([row.salary_min, row.salary_max, row.salary_min_usd], [160000, 200000, 160000]);
  const job = mapJobRow(row);
  assert.deepEqual([job.salaryMin, job.salaryMax, job.salarySource], [160000, 200000, "provider"]);
});

test("D71: description and content_hash are byte-identical after the backfill", () => {
  const d = migratedDb();
  seed(d, "amazon", AMAZON);
  seed(d, "multi", MULTI);
  seed(d, "trap", TRAPS.revenue);
  const before = d.prepare("SELECT job_id, description, content_hash FROM scraped_jobs ORDER BY job_id").all();
  const run = backfillDescriptionText(d, { dryRun: false });
  assert.equal(run.written, 3);
  assert.deepEqual(d.prepare("SELECT job_id, description, content_hash FROM scraped_jobs ORDER BY job_id").all(), before);
});

test("D71 acceptance: the Amazon row reads Boston, MA and $143.7k–$194.4k; in Boston; US; sorts and filters", () => {
  const d = migratedDb();
  seed(d, "amazon", AMAZON);
  seed(d, "low", "Build web apps in TypeScript.", { min: 80000, max: 90000, currency: "USD", period: "annual" });
  seed(d, "none", "Build web apps in TypeScript.");
  backfillDescriptionText(d, { dryRun: false });
  const row = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'amazon'").get();
  const job = mapJobRow(row);
  assert.equal(job.location, "Boston, MA", "the placeholder is not a location; the pay line's place is");
  assert.equal(salaryLabel(job), "$143.7k–$194.4k");
  const strip = deckStrip(job);
  const salary = strip.find(c => c.key === "salary");
  assert.equal(salary.value, "$143.7k–$194.4k");
  assert.equal(salary.sub, "from the posting text");
  // D29's tags: in Boston, and positive US evidence (the US floor).
  const tags = deriveTags(row);
  assert.equal(tags.us, "us");
  assert.ok(tags.places.some(p => p.country === "US" && p.state === "MA" && p.metro), "a Boston-metro place");
  // The salary filter and the salary sort see it.
  const f = buildJobFilters({ salary_min_usd: "150000" });
  const ids = d.prepare(`SELECT job_id FROM scraped_jobs sj WHERE 1 = 1 ${f.sql}`).all(...f.params).map(r => r.job_id);
  assert.deepEqual(ids, ["amazon"]);
  const order = SORT_KEYS.compHigh.map(k => `${k.sql} ${k.dir}`).join(", ");
  const sorted = d.prepare(`SELECT job_id FROM scraped_jobs sj ORDER BY ${order}`).all().map(r => r.job_id);
  assert.deepEqual(sorted, ["amazon", "low", "none"], "the text's pay ranks above a lower provider figure, not last");
});

test("D71: hourly prints as hourly; per-location lines in the strip; 'couldn't read' is not 'not stated'", () => {
  assert.equal(salaryLabel({ salaryMin: 45, salaryMax: 60, salaryPeriod: "hourly" }), "$45–$60 /hr");
  assert.equal(salaryLabel({ salaryMin: 130000, salaryMax: 170000 }), "$130k–$170k");
  const d = migratedDb();
  seed(d, "multi", MULTI);
  backfillDescriptionText(d, { dryRun: false });
  const job = mapJobRow(d.prepare("SELECT * FROM scraped_jobs").get());
  assert.match(deckStrip(job).find(c => c.key === "salary").sub, /^Palo Alto, CA \$150k–\$210k · Seattle, WA /);
  const empty = deckStrip(mapJobRow({ job_id: "x", title: "T", description: "" })).find(c => c.key === "salary");
  assert.equal(empty.missing, "unread");
  const stated = deckStrip(mapJobRow({ job_id: "y", title: "T", description: "Build things." })).find(c => c.key === "salary");
  assert.equal(stated.missing, "not_stated");
  assert.notEqual(COULD_NOT_READ, NOT_STATED);
});

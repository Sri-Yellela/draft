// A112 · the crawler boost — one batch from a probe (scripts/a112ProbeMany.mjs) into D80's tranche builder.
//
//   node data/a112/build.mjs <probe.json> <outDir> [--ats greenhouse,ashby,…] [--min-recent 2] [--exclude <configured.json>]
//
// The owner's go (11-02): "boost the number of crawlers for job postings … we need job data" — the approval for this
// boost is the probe's own admission rule (services/companyList.js admitFromProbe: live, in-scope US postings within
// the age limit, never a portfolio board or a staffing agency) plus the HOLD below. Writes <outDir>/approved.json,
// names.json, hold.txt and runs scripts/d80ApplyTranche.mjs → <outDir>/tranche.mjs (and its review table, review.txt).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { boardName, prettySlug } from "../../scripts/a112BoardName.mjs";

const argv = process.argv.slice(2);
const flag = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const [probeFile, outDir] = argv;
if (!probeFile || !outDir) { console.error("usage: build.mjs <probe.json> <outDir> [--ats a,b] [--min-recent 2] [--exclude configured.json]"); process.exit(2); }
const ats = flag("ats") ? new Set(flag("ats").split(",")) : null;
const minRecent = flag("min-recent", "2");
const key = (t, s) => `${t}:${String(s).toLowerCase()}`;
const exclude = new Set((flag("exclude") ? JSON.parse(fs.readFileSync(flag("exclude"), "utf8")) : []).map((r) => key(r.ats_type, r.ats_slug)));

// ⛔ HELD, never added: boards that post for OTHER employers (aggregators, recruiters, talent marketplaces, generic
// "talent community" pipelines). D80's AGENCY_NAME catches "staffing" / "recruiting" names; these slip past it.
export const HOLD_RE = /(recruit|staff(ing)?\b|staff[- ]?agency|talent(?![- ]?agency)|jobgether|careerswift|job ?wrapping|hiring$|headhunt|jobot|placement)/i;
export const HOLD_KEYS = new Set(["lever:jobgether", "lever:aogarciaagency", "greenhouse:artefactlinkedin", "greenhouse:afscareersmarketplace"]);
// The employer's OWN campus / intern board, or a name the pattern catches by accident ("Hubstaff") — not held.
export const RELEASE_KEYS = new Set(["ashby:hubstaff", "greenhouse:bgeinccampus", "greenhouse:idmeuniversityrecruiting", "greenhouse:internrecruiting"]);

const rows = JSON.parse(fs.readFileSync(probeFile, "utf8"))
  .filter((r) => (!ats || ats.has(r.atsType)) && !exclude.has(key(r.atsType, r.slug)));
// One row per board (a slug probed twice under two spellings keeps its best reading).
const best = new Map();
for (const r of rows) { const k = key(r.atsType, r.slug); if (!best.has(k) || (r.cs ?? 0) > (best.get(k).cs ?? 0)) best.set(k, r); }
const probe = [...best.values()].filter((r) => r.state === "live" && r.cs > 0);
const hold = probe.filter((r) => !RELEASE_KEYS.has(key(r.atsType, r.slug)) && (HOLD_KEYS.has(key(r.atsType, r.slug)) || HOLD_RE.test(`${r.company} ${r.slug}`)));

// Ashby and Lever publish no name in their API: a row probed before scripts/a112BoardName.mjs read the board page has
// only the slug made readable. Read the page's name once (cached in <outDir>/names-cache.json).
fs.mkdirSync(outDir, { recursive: true });
const cacheFile = path.join(outDir, "names-cache.json");
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
const unnamed = probe.filter((r) => r.company === prettySlug(r.atsType, r.slug) && !(key(r.atsType, r.slug) in cache));
for (let i = 0; i < unnamed.length; i += 8) {
  await Promise.all(unnamed.slice(i, i + 8).map(async (r) => { cache[key(r.atsType, r.slug)] = await boardName(r.atsType, r.slug); }));
  if (i % 200 === 0) { process.stderr.write(`\r[a112] names ${i}/${unnamed.length}  `); fs.writeFileSync(cacheFile, JSON.stringify(cache)); }
}
fs.writeFileSync(cacheFile, JSON.stringify(cache));
for (const r of probe) r.company = cache[key(r.atsType, r.slug)] || r.company;
const clean = (n) => String(n).replace(/\s+(careers?|jobs?|careers page|us careers|us jobs)\s*$/i, "").replace(/\s+/g, " ").trim();

fs.writeFileSync(path.join(outDir, "probe.json"), JSON.stringify(probe));
fs.writeFileSync(path.join(outDir, "approved.json"), JSON.stringify(probe.map((r) => ({ company: clean(r.company), ats_type: r.atsType, ats_slug: r.slug }))));
fs.writeFileSync(path.join(outDir, "names.json"), JSON.stringify(Object.fromEntries(probe.map((r) => [key(r.atsType, r.slug), clean(r.company)]))));
fs.writeFileSync(path.join(outDir, "hold.txt"), hold.map((r) => `${key(r.atsType, r.slug)}\t${r.company}\t${r.cs}`).join("\n") + "\n");

const review = execFileSync(process.execPath, ["scripts/d80ApplyTranche.mjs",
  "--approved", path.join(outDir, "approved.json"), "--probe", path.join(outDir, "probe.json"),
  "--names", path.join(outDir, "names.json"), "--hold", hold.map((r) => key(r.atsType, r.slug)).join(","),
  "--min-recent", minRecent, "--source", "A112 crawler boost — Common Crawl discovery (owner 11-02)",
  "--out", path.join(outDir, "tranche.mjs")], { encoding: "utf8", maxBuffer: 1 << 28 });
fs.writeFileSync(path.join(outDir, "review.txt"), review);
console.log(review.split("\n").filter((l) => /^ADMIT|^wrote/.test(l)).join("\n"), `\nheld ${hold.length}`);

// The D77 disk gate projects a tranche from the board's OWN rows per company (≈ 55 on 11-02) — a discovered board
// averages ≈ 10 — so one tranche of thousands is refused though it would fit. Split into tranches of --split (700),
// best boards first (d80ApplyTranche sorts by in-scope count): each passes or stops at the gate on its own reading.
const per = Number(flag("split", "700"));
const mod = fs.readFileSync(path.join(outDir, "tranche.mjs"), "utf8");
const line = mod.split("\n").find((l) => l.startsWith("const T = "));
const T = JSON.parse(line.slice("const T = ".length).replace(/;\s*$/, ""));
for (let i = 0, n = 1; i < T.length; i += per, n++) {
  // No crawl per tranche: crawl.mjs runs ONE after the last (each is a full crawl of every company).
  fs.writeFileSync(path.join(outDir, `tranche-${n}.mjs`), mod.replace(line, `const T = ${JSON.stringify(T.slice(i, i + per))};`)
    .replace("out.crawlReturned = await cacheJobs(db, null);", "out.crawlReturned = null;"));
  console.log(`tranche-${n}.mjs — ${Math.min(per, T.length - i)} companies`);
}
fs.writeFileSync(path.join(outDir, "crawl.mjs"), `// A112 — one crawl after the tranches (the chunked cacheJobs).
import path from "node:path";
import Database from "/app/node_modules/better-sqlite3/lib/index.js";
const { cacheJobs } = await import("/app/services/jobs/aggregator.js");
const db = new Database(path.join(process.env.RM_DATA_DIR || "/app/data", "resume_master.db"));
db.pragma("busy_timeout = 15000");
const before = db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
const t0 = Date.now();
const cached = await cacheJobs(db, null);
console.log(JSON.stringify({ cached, before, after: db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(),
  companiesActive: db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE active = 1").pluck().get(), seconds: Math.round((Date.now() - t0) / 1000) }));
db.close();
`);

// services/seedCandidates.js — 45s (owner 11-09: "start boosting crawlers to boost coverage and volume") · a committed list of
// probed NON-TECH employers (content/companies/candidates-nontech-45s.json, made by scripts/seedNonTechCandidates.mjs) goes
// into the candidate POOL once — through D82's own poolCandidates, so every guard holds: deduped against configured,
// held and rejected pairs, the deny-list and the never-sources (portfolio / VC boards, staffing agencies). ⛔ Nothing is
// ADDED: the nightly probe re-probes each, and the owner approves a ranked batch (D82's trust ladder, L1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { poolCandidates } from "./companyCandidates.js";
import { isCsbHost } from "./jobs/sources/successfactors.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SEED_FILE = path.join(ROOT, "content", "companies", "candidates-nontech-45s.json");
export const SEED_SOURCE = "seed-nontech-45s";
const BOARD_URL = {
  greenhouse: (s) => `https://boards.greenhouse.io/${s}`, lever: (s) => `https://jobs.lever.co/${s}`, ashby: (s) => `https://jobs.ashbyhq.com/${s}`,
  smartrecruiters: (s) => `https://jobs.smartrecruiters.com/${s}`, workable: (s) => `https://apply.workable.com/${s}`,
  // 46a (A160): every vendor findNonTechBoards.mjs probes needs a board URL here, or its hits are dropped at import.
  // Workday's slug is "wdN|tenant|site" (services/jobs/sources/workday.js) → https://<tenant>.wd<N>.myworkdayjobs.com/<site>.
  workday: (s) => { const [n, tenant, site] = String(s).split("|"); return /^\d+$/.test(n) && tenant && site ? `https://${tenant}.wd${n}.myworkdayjobs.com/${site}` : null; },
  recruitee: (s) => `https://${s}.recruitee.com`, bamboohr: (s) => `https://${s}.bamboohr.com/careers`,
  rippling: (s) => `https://ats.rippling.com/${s}/jobs`, gem: (s) => `https://jobs.gem.com/${s}`,
  icims: (s) => `https://${String(s).toLowerCase()}.icims.com/jobs/search`,   // A161: the slug is the tenant's host label
  // 46a: Oracle Recruiting Cloud's slug is "<host>|<site>" (services/jobs/sources/oracle.js) — a bad one is dropped, not guessed.
  oracle: (s) => { const [host, site] = String(s).split("|"); return /\.oraclecloud\.com$/i.test(host || "") && /^[A-Za-z0-9_-]{1,40}$/.test(site || "")
    ? `https://${host.toLowerCase()}/hcmUI/CandidateExperience/en/sites/${site}` : null; },
  // 46a: Taleo's slug is "<tenant>|<section>" (services/jobs/sources/taleo.js).
  taleo: (s) => { const [t, sec] = String(s).split("|"); return /^[a-z0-9][a-z0-9-]{0,62}$/i.test(t || "") && /^[A-Za-z0-9_-]{1,40}$/.test(sec || "")
    ? `https://${t.toLowerCase()}.taleo.net/careersection/${sec}/jobsearch.ftl` : null; },
  // 46b: SuccessFactors Career Site Builder — the slug is the career site's own host.
  successfactors: (s) => (isCsbHost(String(s).toLowerCase()) ? `https://${String(s).toLowerCase()}/` : null),
};

/** The seed file as pool items ({ company, ats: { atsType, slug, url }, … }). */
export function seedItems(file = SEED_FILE) {
  if (!fs.existsSync(file)) return [];
  const found = JSON.parse(fs.readFileSync(file, "utf8")).found || [];
  return found.filter(f => BOARD_URL[f.atsType] && f.slug && BOARD_URL[f.atsType](f.slug)).map(f => ({ company: f.company, ats: { atsType: f.atsType, slug: f.slug, url: BOARD_URL[f.atsType](f.slug) },
    sources: [SEED_SOURCE], header: `${f.industry} · probed ${f.evidence?.probedAt || ""}: ${f.evidence?.us ?? "?"} US roles, ${f.evidence?.inScope ?? "?"} in scope` }));
}

/** Import once (idempotent: a pair already in the pool is only refreshed, a rejected one stays rejected). */
export function importSeedCandidates(db, { file = SEED_FILE } = {}) {
  const items = seedItems(file);
  if (!items.length) return { inserted: 0, refreshed: 0, skipped: {}, items: 0 };
  return { ...poolCandidates(db, items, { source: SEED_SOURCE }), items: items.length };
}

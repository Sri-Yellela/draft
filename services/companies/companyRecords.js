// services/companies/companyRecords.js — ⭐ D179 P4a · ONE COMPANY = ONE RECORD (45l, 11-08).
//
// Owner 11-07: "a company page and description for every distinct company". Before a page can exist, a company has to
// be ONE thing. Today it is a free-text `scraped_jobs.company` string, and three different normalisers
// (companyLogoStore.companyKey, postingMatcher.companyKey, customAnswers.companyKey) each decide on their own what
// "the same company" means.
//
// The record:
//   companies            — one row per company: a slug (its future /companies/<slug>), the display name, its own
//                          website domain when known, and a parent (a subsidiary is LINKED to its parent, never merged —
//                          parent_id is set only by an admin).
//   company_aliases      — every key that resolves to a company, with the evidence it rests on:
//                            ats:<provider>:<tenant>  — the company's own ATS board (boards.greenhouse.io/stripe).
//                                                       The strongest evidence: the employer put its jobs there.
//                            domain:<registrable>     — the employer's own careers site (careers.duolingo.com).
//                            name:<key>               — the normalised name (companyLogoStore.companyKey: lower-case,
//                                                       legal forms dropped — "Match Group" keeps "group").
//   job_company          — posting → company. A SEPARATE table, never a column on scraped_jobs: an UPDATE rewrites the
//                          whole posting row with its description (A132 measured 2.7 s write pages), a small table does not.
//   company_review       — the unsure cases, for Admin: never merged automatically.
//
// The rule (evidence first, names last):
//   1. an ATS tenant or a domain already known → that company (a new name under the same board is an ALIAS:
//      "Facebook" posting on Meta's board is Meta);
//   2. else the normalised name already known → that company, UNLESS the posting's own ATS tenant / domain already
//      belongs to a DIFFERENT company or the name's company has a different domain on record — then a new company is
//      made and the pair goes to review ("Mercury" the bank and "Mercury" the insurer are different employers);
//   3. else a new company.
// A name that differs from a known one only by a trailing word ("Alphabe" / "Alphabe Insight") is NOT merged — it is
// filed for review when both share a first word and one name is a prefix of the other.
//
// The walk (linkCompanies) follows D153 (3)'s classify walk: rowid pages, starting small and growing while reads stay
// under budget, writes in small transactions, a yield between them. Idempotent: only postings with no job_company row
// are read for writing.
import { companyKey as nameKey } from "../jobs/companyLogoStore.js";
import { isAtsHost } from "../../shared/atsHosts.js";
import { nextRowidRange } from "../jobs/rowidWalk.js";

export const COMPANY_PAGE_ROWS = 500;
export const MIN_PAGE_ROWS = 50;
export const READ_BUDGET_MS = 200;
export const WRITE_CHUNK = 100;

// Job boards and aggregators: a posting hosted there says nothing about the employer's own site.
const BOARD_HOSTS = ["indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com", "adzuna.com", "google.com",
  "jobo.world", "remoteok.com", "wellfound.com", "ycombinator.com", "builtin.com", "dice.com", "monster.com",
  "simplyhired.com", "careerbuilder.com", "usajobs.gov", "themuse.com", "otta.com", "welcometothejungle.com",
  "jobsviadraft.com", "gem.com", "rippling.com", "teamtailor.com", "breezy.hr", "personio.de", "personio.com",
  "paylocity.com", "ultipro.com", "ukg.com", "adp.com", "dayforcehcm.com", "paycomonline.net", "applytojob.com",
  "jazzhr.com", "hire.trakstar.com", "oraclecloud.com", "successfactors.com", "successfactors.eu"];
const TWO_LEVEL = ["co.uk", "com.au", "co.in", "com.br", "co.jp", "com.sg", "co.nz", "co.za"];

export function registrable(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const two = parts.slice(-2).join(".");
  return TWO_LEVEL.includes(two) ? parts.slice(-3).join(".") : two;
}

const hostOf = (url) => { try { return new URL(String(url)).hostname.toLowerCase(); } catch { return null; } };
const isBoardHost = (host) => { const r = registrable(host); return !!r && BOARD_HOSTS.some(b => r === b || r.endsWith("." + b)); };

/**
 * The company's own ATS board, from a posting URL: { provider, tenant } or null. Only the multi-tenant boards whose
 * URL names the tenant are read; anything else is null (never guessed).
 */
export function atsTenantOf(url) {
  const host = hostOf(url);
  if (!host) return null;
  let path = "";
  try { path = new URL(String(url)).pathname; } catch { return null; }
  const seg = (path.split("/").filter(Boolean)[0] || "").toLowerCase();
  const sub = host.split(".")[0];
  const t = (provider, tenant) => (tenant && /^[a-z0-9][a-z0-9._-]{0,80}$/i.test(tenant) ? { provider, tenant: tenant.toLowerCase() } : null);
  if (/(^|\.)greenhouse\.io$/.test(host)) return ["boards", "job-boards", "boards-api", "www"].includes(sub) || host === "greenhouse.io" ? t("greenhouse", seg === "embed" ? null : seg) : null;
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") return t("lever", seg);
  if (host === "jobs.ashbyhq.com") return t("ashby", seg);
  if (/\.myworkdayjobs\.com$/.test(host)) return t("workday", sub);
  if (host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com") return t("smartrecruiters", seg);
  if (host === "apply.workable.com") return t("workable", seg);
  if (/\.recruitee\.com$/.test(host)) return t("recruitee", sub);
  if (/\.bamboohr\.com$/.test(host)) return t("bamboohr", sub);
  if (/\.icims\.com$/.test(host)) return t("icims", sub.replace(/^(careers|jobs)-/, ""));
  if (/\.jobvite\.com$/.test(host) && sub === "jobs") return t("jobvite", seg);
  return null;
}

/** The employer's own website domain from a posting URL — never an ATS, a job board or an aggregator. */
export function ownDomainOf(url) {
  const host = hostOf(url);
  if (!host || isAtsHost(host) || isBoardHost(host)) return null;
  return registrable(host);
}

/** The company's URL slug: its normalised name; unique (a -2, -3 … suffix when taken). */
function slugFor(db, name) {
  const base = nameKey(name) || "company";
  let slug = base, n = 1;
  while (db.prepare(`SELECT 1 FROM companies WHERE slug = ?`).get(slug)) slug = `${base}-${++n}`;
  return slug;
}

const STMTS = new WeakMap();
function stmts(db) {
  let s = STMTS.get(db);
  if (!s) {
    s = {
      alias: db.prepare(`SELECT company_id FROM company_aliases WHERE alias_key = ?`),
      company: db.prepare(`SELECT id, slug, name, domain FROM companies WHERE id = ?`),
      insertCompany: db.prepare(`INSERT INTO companies (slug, name, domain) VALUES (?, ?, ?)`),
      setDomain: db.prepare(`UPDATE companies SET domain = ?, updated_at = unixepoch() WHERE id = ? AND domain IS NULL`),
      insertAlias: db.prepare(`INSERT OR IGNORE INTO company_aliases (alias_key, company_id, evidence) VALUES (?, ?, ?)`),
      link: db.prepare(`INSERT INTO job_company (job_id, company_id) VALUES (?, ?)
        ON CONFLICT(job_id) DO UPDATE SET company_id = excluded.company_id, linked_at = unixepoch()`),
      review: db.prepare(`INSERT OR IGNORE INTO company_review (a_id, b_id, reason) VALUES (?, ?, ?)`),
      firstWord: db.prepare(`SELECT company_id, alias_key FROM company_aliases WHERE alias_key >= ? AND alias_key < ? LIMIT 50`),
    };
    STMTS.set(db, s);
  }
  return s;
}

const review = (s, a, b, reason) => { if (a && b && a !== b) s.review.run(Math.min(a, b), Math.max(a, b), reason); };

/**
 * Resolve one posting's company to a record id (making one when none matches). `posting` = { company, url, apply_url }.
 * Returns null for a posting with no usable name (UNKNOWN stays unknown — never guessed).
 */
export function resolveCompany(db, { company, url = null, apply_url = null }) {
  const name = String(company || "").trim();
  const key = nameKey(name);
  if (!key || isAtsHost(name)) return null;
  const s = stmts(db);
  const ats = atsTenantOf(url) || atsTenantOf(apply_url);
  const domain = ownDomainOf(url) || ownDomainOf(apply_url);
  const atsKey = ats ? `ats:${ats.provider}:${ats.tenant}` : null;
  const domainKey = domain ? `domain:${domain}` : null;
  const nk = `name:${key}`;

  const byAts = atsKey ? s.alias.get(atsKey)?.company_id ?? null : null;
  const byDomain = domainKey ? s.alias.get(domainKey)?.company_id ?? null : null;
  const byName = s.alias.get(nk)?.company_id ?? null;

  let id = byAts || byDomain;
  if (byAts && byDomain && byAts !== byDomain) review(s, byAts, byDomain, `the board ${atsKey} and the site ${domain} belong to different records`);
  if (!id && byName) {
    const known = s.company.get(byName);
    if (domain && known?.domain && known.domain !== domain) {
      id = null;   // same name, a different employer's own site → a new record, reviewed
    } else id = byName;
  }
  if (!id) {
    id = Number(s.insertCompany.run(slugFor(db, name), name, domain).lastInsertRowid);
    if (byName && byName !== id) review(s, byName, id, `the same name "${name}" with a different own site (${domain})`);
    else nearNames(db, s, key, id, name);
  }
  // Every key this posting proved now points at the record (first writer wins — INSERT OR IGNORE).
  if (atsKey) s.insertAlias.run(atsKey, id, "ats");
  if (domainKey) { s.insertAlias.run(domainKey, id, "domain"); s.setDomain.run(domain, id); }
  if (!byName) s.insertAlias.run(nk, id, "name");
  return id;
}

/** A new name that extends / is extended by a known one sharing its first word → review, never merged. */
function nearNames(db, s, key, id, name) {
  const first = key.split("-")[0];
  if (!first || first.length < 3) return;
  for (const r of s.firstWord.all(`name:${first}`, `name:${first}.`)) {
    if (r.company_id === id) continue;
    const other = r.alias_key.slice(5);
    if (other === key) continue;
    if (key.startsWith(other + "-") || other.startsWith(key + "-")) review(s, r.company_id, id, `"${name}" and "${other}" — one name extends the other`);
  }
}

const PAGE_SQL = `
  SELECT sj.job_id, sj.company, sj.url, sj.apply_url
    FROM scraped_jobs sj
   WHERE sj.is_active = 1 AND sj.rowid > ? AND sj.rowid <= ?
     AND NOT EXISTS (SELECT 1 FROM job_company jc WHERE jc.job_id = sj.job_id)`;

/** Link one chunk of postings (one transaction). */
export function linkChunk(db, rows, c = { linked: 0, unknown: 0 }) {
  const s = stmts(db);
  db.transaction(() => {
    for (const r of rows) {
      const id = resolveCompany(db, r);
      if (id == null) { c.unknown++; continue; }
      s.link.run(r.job_id, id);
      c.linked++;
    }
  })();
  return c;
}

/** The record's counts, for Admin → Board and /api/version. */
export function companyRecordStats(db) {
  const one = (sql) => { try { return db.prepare(sql).pluck().get(); } catch { return null; } };
  return {
    companies: one(`SELECT COUNT(*) FROM companies`),
    withDomain: one(`SELECT COUNT(*) FROM companies WHERE domain IS NOT NULL`),
    aliases: one(`SELECT COUNT(*) FROM company_aliases`),
    linkedPostings: one(`SELECT COUNT(*) FROM job_company`),
    reviewOpen: one(`SELECT COUNT(*) FROM company_review WHERE status = 'open'`),
  };
}

/**
 * The background walk: every active posting with no record linked, in rowid pages, a yield between slices.
 * One walk at a time; `run` resolves with the final status.
 */
export function createCompanyLinker(db, { pageRows = COMPANY_PAGE_ROWS, writeChunk = WRITE_CHUNK, schedule = (fn) => setImmediate(fn), log = console } = {}) {
  let status = { state: "idle", runs: 0, pages: 0, read: 0, linked: 0, unknown: 0, startedAt: null, finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0, pageRows };
  let running = null;

  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, pages: 0, read: 0, linked: 0, unknown: 0,
      startedAt: new Date().toISOString(), finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0 };
    running = new Promise((resolve) => {
      let from = 0;
      let rows = Math.min(pageRows, MIN_PAGE_ROWS);
      const finish = (error) => {
        status = { ...status, state: error ? "failed" : "done", finishedAt: new Date().toISOString(), error: error ? error.message : null };
        running = null;
        if (error) log.error?.(`[companies] link walk failed at rowid ${from} (the next run resumes; nothing half-written):`, error.message);
        else if (status.linked) log.log?.(`[companies] (${trigger}) linked ${status.linked} postings to company records; ${status.unknown} with no usable name`);
        resolve(self.status());
      };
      const page = db.prepare(PAGE_SQL);
      const step = () => {
        try {
          const t0 = Date.now();
          const range = nextRowidRange(db, from, rows);
          const found = range.to > from ? page.all(range.from, range.to) : [];
          const readMs = Date.now() - t0;
          if (readMs > READ_BUDGET_MS && rows > MIN_PAGE_ROWS) rows = Math.max(MIN_PAGE_ROWS, Math.floor(rows / 2));
          else if (readMs < READ_BUDGET_MS / 4 && rows < pageRows) rows = Math.min(pageRows, rows * 2);
          status = { ...status, pages: status.pages + 1, read: status.read + found.length, maxReadMs: Math.max(status.maxReadMs, readMs), pageRows: rows };
          const done = !range.more || range.to <= from;
          from = range.to;
          let i = 0;
          const chunk = () => {
            try {
              const tw = Date.now();
              const c = { linked: 0, unknown: 0 };
              const part = found.slice(i, i + writeChunk);
              if (part.length) linkChunk(db, part, c);
              i += part.length;
              status = { ...status, linked: status.linked + c.linked, unknown: status.unknown + c.unknown, maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
              if (i < found.length) return schedule(chunk);
              if (done) return finish(null);
              schedule(step);
            } catch (e) { finish(e); }
          };
          chunk();
        } catch (e) { finish(e); }
      };
      schedule(step);
    });
    return running;
  }

  const self = {
    run,
    get running() { return !!running; },
    status: () => ({ ...status, records: companyRecordStats(db) }),
  };
  return self;
}

/** Admin: the open review pairs, with both records. */
export function companyReviewQueue(db, { limit = 100 } = {}) {
  return db.prepare(`SELECT r.id, r.reason, r.created_at,
      a.id AS a_id, a.slug AS a_slug, a.name AS a_name, a.domain AS a_domain,
      b.id AS b_id, b.slug AS b_slug, b.name AS b_name, b.domain AS b_domain
    FROM company_review r JOIN companies a ON a.id = r.a_id JOIN companies b ON b.id = r.b_id
    WHERE r.status = 'open' ORDER BY r.created_at LIMIT ?`).all(Math.min(Math.max(Number(limit) || 100, 1), 500));
}

/**
 * Admin's decision on a pair: 'merge' (b into a: its aliases and postings move, b is deleted), 'apart' (kept as two),
 * or 'parent' (b is a subsidiary of a: linked, not merged).
 */
export function decideCompanyReview(db, reviewId, decision, { adminId = null } = {}) {
  const r = db.prepare(`SELECT * FROM company_review WHERE id = ? AND status = 'open'`).get(reviewId);
  if (!r) return { ok: false, error: "No open review with that id." };
  if (!["merge", "apart", "parent"].includes(decision)) return { ok: false, error: "decision must be merge, apart or parent" };
  db.transaction(() => {
    if (decision === "merge") {
      db.prepare(`UPDATE OR IGNORE company_aliases SET company_id = ? WHERE company_id = ?`).run(r.a_id, r.b_id);
      db.prepare(`DELETE FROM company_aliases WHERE company_id = ?`).run(r.b_id);
      db.prepare(`UPDATE job_company SET company_id = ? WHERE company_id = ?`).run(r.a_id, r.b_id);
      db.prepare(`UPDATE companies SET parent_id = ? WHERE parent_id = ?`).run(r.a_id, r.b_id);
      db.prepare(`UPDATE company_review SET status = 'closed', decision = 'merged-away', decided_at = unixepoch() WHERE status = 'open' AND id != ? AND (a_id = ? OR b_id = ?)`).run(r.id, r.b_id, r.b_id);
      db.prepare(`DELETE FROM companies WHERE id = ?`).run(r.b_id);
    } else if (decision === "parent") {
      db.prepare(`UPDATE companies SET parent_id = ?, updated_at = unixepoch() WHERE id = ?`).run(r.a_id, r.b_id);
    }
    db.prepare(`UPDATE company_review SET status = 'closed', decision = ?, decided_by = ?, decided_at = unixepoch() WHERE id = ?`).run(decision, adminId, r.id);
  })();
  return { ok: true };
}

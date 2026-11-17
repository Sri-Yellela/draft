// services/extensionJobFacts.js — ⭐ D191 (2a) / (2c) / (2d) · WHAT draft KNOWS ABOUT A POSTING, for the extension's side
// panel (owner 11-12 spec; built 46o, owner 11-15: "rebuild and revamp extension to current specifications").
//
//   jobFactsForExtension(db, userId, jobId, { score, yourSkillStates })
//     (2a) the posting: subcategory + category (D179 taxonomy), level, salary as posted, "Works with" (the posting's own
//          stack, D179 (5)), a one-word fit from the person's score, and "You've proven N of their top M" (D179 P4b's
//          company match against the employer's stack)
//     (2c) the person's application for it, if any: Drafted · Needs you · In progress · Sent · Failed, and whether an
//          application waits to be sent from this browser (A207 / A211)
//     (2d) the company's extras: its logo, one sentence about it (D179 P4b, Wikidata), the six-month hiring trend
//
// ⛔ The owner's rule (11-14): nothing here calls a model — every fact is a read of draft's own tables. ⛔ One posting per
// press: indexed per-job / per-user reads plus the company page's 5-minute cache — never a board pass (A126 / A158).
// Every part is guarded: a part that cannot be read is left out, never a failure of the press.
import { techForJobs } from "./companies/companyTech.js";
import { publicCompany, companyMatchFor } from "./companies/publicCompany.js";
import { companySlug } from "../shared/companyPaths.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";
import { EXTENSION_SUBMIT_REASONS } from "./extensionHome.js";
import { PACKET_STALE_MS } from "./applyGatePacket.js";

const tryRead = (f) => { try { return f(); } catch { return null; } };

/** One word for the person's fit, from their score (the board's own cut points). Pure. */
export function fitWord(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= ATS_BAND_CUTPOINTS.strong) return "Good fit";
  if (score >= ATS_BAND_CUTPOINTS.moderate) return "Stretch";
  return "Long shot";
}

/** "$140k–$180k a year" from the posted numbers — or null when the posting gave none. Pure. */
export function salaryLine(min, max, period) {
  const k = (n) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
  const lo = Number(min) > 0 ? Number(min) : null, hi = Number(max) > 0 ? Number(max) : null;
  if (!lo && !hi) return null;
  const per = /hour/i.test(period || "") ? " an hour" : /month/i.test(period || "") ? " a month" : " a year";
  return `${lo && hi && lo !== hi ? `${k(lo)}–${k(hi)}` : k(lo || hi)}${per}`;
}

/** The application's state in one word the panel shows. Pure. */
export function runWord(status) {
  switch (String(status || "")) {
    case "submitted": return "Sent";
    case "held_review": case "held_gate": return "Needs you";
    case "running": case "queued": return "In progress";
    case "failed": return "Failed";
    case "cancelled": case "dismissed": case "superseded": case "": return null;
    default: return "Drafted";
  }
}

/** "up" / "down" / "flat" from the months' counts (the last three against the three before). Pure. */
export function trendWord(months) {
  const n = (Array.isArray(months) ? months : []).map(m => Number(m.postings) || 0);
  if (n.length < 2) return null;
  const half = Math.floor(n.length / 2), sum = (a) => a.reduce((s, x) => s + x, 0);
  const before = sum(n.slice(0, half)) / half, after = sum(n.slice(half)) / (n.length - half);
  if (!before && !after) return null;
  if (after > before * 1.25) return "up";
  if (after < before * 0.8) return "down";
  return "flat";
}

export function jobFactsForExtension(db, userId, jobId, { score = null, yourSkillStates = null } = {}) {
  const id = String(jobId || "");
  if (!id) return null;
  const row = tryRead(() => db.prepare(`SELECT job_id, company, experience_level, salary_min_usd, salary_max_usd, salary_period,
      salary_min, salary_max, company_icon_url FROM scraped_jobs WHERE job_id = ?`).get(id));
  if (!row) return null;
  const tax = tryRead(() => db.prepare(`SELECT category, subcategory FROM job_taxonomy WHERE job_id = ?`).get(id));
  const works = tryRead(() => techForJobs(db, [id]).get(id)) || [];
  const run = tryRead(() => db.prepare(`SELECT status FROM apply_run_jobs WHERE user_id = ? AND job_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 1`).get(userId, id));
  const toSend = tryRead(() => db.prepare(`SELECT COUNT(*) FROM apply_gate_packets WHERE user_id = ? AND job_id = ? AND consumed_at IS NULL
      AND gate_reason IN (${EXTENSION_SUBMIT_REASONS.map(() => "?").join(", ")}) AND created_at >= unixepoch() - ?`)
      .pluck().get(userId, id, ...EXTENSION_SUBMIT_REASONS, Math.floor(PACKET_STALE_MS / 1000))) || 0;
  const slug = companySlug(row.company || "") || null;
  const page = slug ? tryRead(() => publicCompany(db, slug)) : null;
  const match = page && typeof yourSkillStates === "function" ? tryRead(() => companyMatchFor(db, slug, userId, { yourSkillStates })) : null;
  return {
    job: {
      category: tax?.category || null, subcategory: tax?.subcategory || null, level: row.experience_level || null,
      salary: salaryLine(row.salary_min_usd ?? row.salary_min, row.salary_max_usd ?? row.salary_max, row.salary_period),
      worksWith: works, fit: fitWord(score),
      proven: match && match.of > 0 ? { count: match.proven.length, of: match.of } : null,
    },
    application: { state: runWord(run?.status), sendFromHere: Number(toSend) > 0 },
    company: page ? { logo: row.company_icon_url || null, about: page.about?.line || null,
      trend: trendWord(page.hiringTrend) } : (row.company_icon_url ? { logo: row.company_icon_url, about: null, trend: null } : null),
  };
}

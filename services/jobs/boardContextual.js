// services/jobs/boardContextual.js — ⭐ D184 B-8 (46y) · THE CONTEXTUAL TIEBREAKER ON THE BOARD.
//
// D192 (4d): the contextual score (@draft/ats-scorer scoreContextual — role fit, responsibility overlap, tech stack, beside the
// skill match) orders cards INSIDE the same skill-match tier. Nothing else about the ranking changes: the skill-match number,
// its band, the tier key (skillTiers.js), the tailoring trigger. The order key sits AFTER the fit band and the score
// (jobCursor.js CONTEXTUAL_KEYS) — so it only reorders rows the board used to order by recency.
//
// ⛔ WHY IT IS STORED, NOT COMPUTED PER REQUEST (A126 / A158 / A162 / A186: a whole-board pass on the one thread froze the
// site). The block needs a company stack per posting. It is computed in the board-fit PRECOMPUTE, beside the skill match:
//   · the posting side (taxonomy + company id) is read a batch at a time through the read pool,
//   · each company's stack is read ONCE PER PASS (a per-pass cache, filled in bulk through the read pool — never one
//     company per posting, never on the one thread),
//   · the arithmetic runs in the score worker with the skill match (scoreWorker.js); the main-thread fallback is the
//     existing time-sliced loop,
//   · the number lands in ats_only_reports.contextual_score (migration 278) with the same DELETE + INSERT as the score, so
//     the board's cursor epoch already covers it.
// `contextual_key` = the hash of what the number rests on beyond the skill-match basis (the placement, the weights, this
// version): a pass re-scores a row whose key is not the current one. Company stacks are corpus-side (like term weights):
// not in the key — a row picks up a moved stack when it is next scored.
//
// ⛔ KILL SWITCH: the flag `board_contextual_tiebreak` (shared/flags.js → BOARD_CONTEXTUAL_TIEBREAK → Admin's switch). Off:
// no key on the board, nothing computed, nothing marked stale.
// ⛔ No model (D190): SELECTs and the package's arithmetic.
import crypto from "node:crypto";
import { scoreContextual } from "@draft/ats-scorer";
import { technologiesIn } from "../../shared/techVocabulary.js";
import { stackRowsManySql, stackOfManySql, SHOW_MIN_POSTINGS, FRESH_DAYS } from "../companies/companyTech.js";

export const CTX_VERSION = 1;
export const STACK_MAX = 20;

/**
 * The contract's techStack from stack rows [{ tech, grp, postings }] and the company's postings `of`. Pure — the ONE shape,
 * used by services/atsContextual.js companyStackOf (one company) and this file's per-pass stack cache.
 */
export function techStackShape(rows, of) {
  if (!of || !Array.isArray(rows)) return [];
  return rows.map(x => ({ name: x.tech, category: x.grp, postingShare: Math.round(1000 * Math.min(1, x.postings / of)) / 1000 }))
    .sort((a, b) => b.postingShare - a.postingShare || a.name.localeCompare(b.name)).slice(0, STACK_MAX);
}
export const FLAG = "board_contextual_tiebreak";
const IDS_PER_READ = 200;

/** The résumé side, once per pass, from the profile row (its stored placement) and the base résumé. Pure. */
export function resumeSideOf(profile, resumeText) {
  let also = null;
  try { const a = JSON.parse(profile?.placement_also || "null"); also = a?.subcategory ? { subcategory: a.subcategory } : null; } catch { also = null; }
  const text = String(resumeText || "");
  return {
    category: profile?.placement_category || null, subcategory: profile?.placement_subcategory || null,
    level: profile?.placement_level || null, also, text, tech: technologiesIn(text).map(t => t.name),
  };
}

/** The key a stored contextual number rests on (beyond the skill match's own basis_hash). Pure. */
export function contextualKey(resume, weights) {
  const w = Object.keys(weights || {}).sort().map(k => `${k}=${weights[k]}`).join(",");
  return crypto.createHash("sha256")
    .update(JSON.stringify({ v: CTX_VERSION, c: resume?.category ?? null, s: resume?.subcategory ?? null, l: resume?.level ?? null,
      a: resume?.also?.subcategory ?? null, w }))
    .digest("hex").slice(0, 24);
}

/**
 * The contextual number for one scored posting. Pure — the score worker and the main-thread fallback call the same function.
 * `item` = { category, subcategory, company: { industry, techStack } | null }; `shared` = { resume, weights }.
 * null when the skill match declined (scoreContextual: no skill match → no contextual score) or anything throws.
 */
export function contextualScoreFor(job, report, item, shared) {
  if (!report || typeof report.score !== "number" || !shared?.resume) return null;
  try {
    const company = item?.company && (item.company.techStack?.length || item.company.industry) ? item.company : null;
    const r = scoreContextual({
      skillMatch: report.score,
      posting: { category: item?.category || null, subcategory: item?.subcategory || null, level: job?.level_read || null,
        text: String(job?.description_text || job?.description || "") },
      resume: shared.resume, company, weights: shared.weights,
    });
    return typeof r?.score === "number" ? r.score : null;
  } catch { return null; }
}

const marks = (n) => Array(n).fill("?").join(",");

/**
 * One pass's context: the résumé side, the weights, the key, and the per-company stack cache.
 * `read` = { all(sql, params) → Promise<rows> } (the read pool; a test's db wrapper).
 */
export function createPassContext({ read, resume, weights, nowSec = Math.floor(Date.now() / 1000) }) {
  const key = contextualKey(resume, weights);
  const stacks = new Map();   // companyId → { industry, techStack }
  const since = nowSec - FRESH_DAYS * 86400;
  const stats = { postingReads: 0, stackReads: 0, companies: 0 };

  /** Fill the cache for any company not yet in it — in bulk, IDS_PER_READ at a time, all through `read`. */
  async function ensureStacks(ids) {
    const want = [...new Set(ids.filter(id => id != null && !stacks.has(id)))];
    for (let i = 0; i < want.length; i += IDS_PER_READ) {
      const chunk = want.slice(i, i + IDS_PER_READ);
      const [rows, ofs, facts] = await Promise.all([
        read.all(stackRowsManySql(chunk.length), [...chunk, SHOW_MIN_POSTINGS, since]),
        read.all(stackOfManySql(chunk.length), [...chunk, since]),
        read.all(`SELECT company_id, industry FROM company_facts WHERE status = 'ok' AND company_id IN (${marks(chunk.length)})`, chunk).catch(() => []),
      ]);
      stats.stackReads += 3;
      const byCo = new Map();
      for (const r of rows || []) { let a = byCo.get(r.company_id); if (!a) byCo.set(r.company_id, (a = [])); a.push(r); }
      const ofBy = new Map((ofs || []).map(r => [r.company_id, Number(r.n) || 0]));
      const indBy = new Map((facts || []).map(r => [r.company_id, r.industry || null]));
      for (const id of chunk) stacks.set(id, { industry: indBy.get(id) || null, techStack: techStackShape(byCo.get(id) || [], ofBy.get(id) || 0) });
      stats.companies = stacks.size;
    }
  }

  /** The per-item context for a batch of jobs, in their order: [{ category, subcategory, company }]. */
  async function itemsFor(jobs) {
    if (!jobs.length) return [];
    const ids = jobs.map(j => String(j.job_id));
    const rows = await read.all(`SELECT sj.job_id AS job_id, jx.category AS category, jx.subcategory AS subcategory, jc.company_id AS company_id
        FROM scraped_jobs sj LEFT JOIN job_taxonomy jx ON jx.job_id = sj.job_id LEFT JOIN job_company jc ON jc.job_id = sj.job_id
        WHERE sj.job_id IN (${marks(ids.length)})`, ids);
    stats.postingReads++;
    const by = new Map((rows || []).map(r => [String(r.job_id), r]));
    await ensureStacks((rows || []).map(r => r.company_id));
    return ids.map(id => {
      const r = by.get(id);
      return { category: r?.category || null, subcategory: r?.subcategory || null, company: r?.company_id != null ? stacks.get(r.company_id) || null : null };
    });
  }

  return { key, shared: { resume, weights }, itemsFor, ensureStacks, stats, stacks };
}

/** A read wrapper over a better-sqlite3 db (tests; the fallback when there is no pool). */
export const dbRead = (db) => ({ all: async (sql, params = []) => db.prepare(sql).all(...params), get: async (sql, params = []) => db.prepare(sql).get(...params) });

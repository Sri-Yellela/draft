// services/atsPlausibility.js — ⭐ D192 (4d) · CLAIM PLAUSIBILITY, draft's half: "does this add up?" (owner 11-14).
//
// The checks are the scorer package's (packages/ats-scorer src/plausibility.js — pure, no model). This file resolves each
// experience entry's employer to its company record (services/entities.js — the one resolver) and hands over what draft holds
// about it: its stack from its own postings (company_tech via stackFor), the kinds of roles it posts (job_taxonomy's
// categories over its postings), its industry and size (company_facts). It also keeps the person's dismissals
// (ats_flag_dismissals, migration 277): a dismissed flag stays dismissed across re-scores.
// ⛔ A flag is a warning — never a rejection, and it never changes a score (no scorer reads this).
import { experienceEntries, checkPlausibility, PLAUSIBILITY_VERSION } from "@draft/ats-scorer";
import { stackFor } from "./companies/companyTech.js";
import { companyIdByName } from "./atsContextual.js";
import { TECHNOLOGIES } from "../shared/techVocabulary.js";

const safe = (fn, d = null) => { try { return fn(); } catch { return d; } };
const VOCAB = TECHNOLOGIES.map(t => t[0]);
const plain = (s) => String(s || "").replace(/<(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n- ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n");

/** What draft knows about one company record, in the shape the package reads. */
export function companyFacts(db, companyId, nowSec = Math.floor(Date.now() / 1000)) {
  const co = safe(() => db.prepare(`SELECT name FROM companies WHERE id = ?`).get(companyId));
  if (!co) return null;
  const s = safe(() => stackFor(db, companyId, nowSec));
  const stack = s ? Object.values(s.groups).flat().map(x => ({ tech: x.tech, postings: x.postings })) : [];
  // ⛔ CROSS JOIN pins the join order to THIS company's rows (46p's finding — a plain JOIN read the whole table)
  const families = Object.fromEntries((safe(() => db.prepare(`SELECT jt.category AS c, COUNT(*) AS n FROM job_company jc
      CROSS JOIN job_taxonomy jt ON jt.job_id = jc.job_id WHERE jc.company_id = ? AND jt.category IS NOT NULL GROUP BY jt.category`).all(companyId), []) || [])
    .map(r => [r.c, r.n]));
  const facts = safe(() => db.prepare(`SELECT industry, employees FROM company_facts WHERE company_id = ? AND status = 'ok'`).get(companyId)) || {};
  return { name: co.name, stack, ofPostings: s?.ofPostings ?? 0, families, industry: facts.industry || null, employees: facts.employees ?? null };
}

/** The person's dismissed flag keys. */
export function dismissedKeys(db, userId) {
  return new Set(safe(() => db.prepare(`SELECT flag_key FROM ats_flag_dismissals WHERE user_id = ?`).pluck().all(userId), []) || []);
}
export function dismissFlag(db, userId, key, { undo = false } = {}) {
  const k = String(key || "").slice(0, 400);
  if (!k) throw Object.assign(new Error("A flag key is required."), { status: 400 });
  if (undo) db.prepare(`DELETE FROM ats_flag_dismissals WHERE user_id = ? AND flag_key = ?`).run(userId, k);
  else db.prepare(`INSERT OR IGNORE INTO ats_flag_dismissals (user_id, flag_key) VALUES (?, ?)`).run(userId, k);
  return { ok: true, key: k, dismissed: !undo };
}

/**
 * The plausibility of a résumé's text (a base résumé, or a tailored one's HTML) for one person: per experience entry, its
 * status, what is confirmed, and the flags not dismissed. `{ version, entries, flags, dismissed }`.
 */
export function plausibilityFor(db, { userId, text, html = null, asOf = new Date().getFullYear() } = {}) {
  const body = html ? plain(html) : String(text || "");
  const entries = experienceEntries(body);
  const cache = new Map();
  const companyFor = (entry) => {
    for (const part of entry.parts || []) {
      if (cache.has(part)) { if (cache.get(part)) return cache.get(part); continue; }
      const id = companyIdByName(db, part);
      const facts = id ? companyFacts(db, id) : null;
      cache.set(part, facts);
      if (facts) return facts;
    }
    return null;
  };
  const results = checkPlausibility({ entries, companyFor, vocabulary: VOCAB, asOf });
  const gone = userId ? dismissedKeys(db, userId) : new Set();
  let dismissed = 0;
  for (const r of results) {
    const kept = r.flags.filter(f => !gone.has(f.key));
    dismissed += r.flags.length - kept.length;
    r.flags = kept;
    if (!kept.length && r.status === "flags") r.status = r.known ? "all_confirmed" : "no_data";
  }
  return { version: PLAUSIBILITY_VERSION, entries: results, flags: results.reduce((n, r) => n + r.flags.length, 0), dismissed };
}

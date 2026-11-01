// services/atlas/atlasSponsors.js — ⭐ D108 P3 · a role page's "Sponsors who hire this role" (owner 10-30).
//
// COMPUTED, never typed: the companies with ACTIVE postings whose title names this role (the same rule as "On the
// board" — atlasStats.js: the scorer's normalisation, the LONGEST role term in the title wins, so "Senior Backend
// Engineer" is not also "Engineer"), kept only when the company has a safely matched public LCA record with filings in
// the latest complete fiscal year (sponsorshipFactFor — the ONE LCA matcher's output, nothing matched here). Ordered by
// those filings. A fact about employers, never advice; each entry carries its source and date.
// Only for a PUBLISHED role node — the route reads published nodes only, and this checks again.

import { normaliseAtsTerm } from "../localAtsScorer.js";
import { sponsorshipFactFor } from "../kb/sponsorshipFacts.js";
import { sponsorshipSignal, LABELS, PICK_RANK } from "../kb/sponsorshipSignal.js";

export const SPONSORS_LIMIT = 8;

/**
 * ⭐ D105 P12 · the companies with ACTIVE postings whose title names this (published) role — counted once, here: the
 * role page's "Companies hiring" and the sponsors' list below read the same counts, so they never disagree.
 * @returns {Map<string, number>} company → open postings (unordered)
 */
export function companiesForRole(db, slug) {
  let node;
  try { node = db.prepare(`SELECT id, term FROM atlas_nodes WHERE slug = ? AND kind = 'role' AND status = 'published'`).get(String(slug)); }
  catch { return new Map(); }
  if (!node?.term) return new Map();
  const roles = db.prepare(`SELECT id, term FROM atlas_nodes WHERE kind = 'role'`).all().filter(r => r.term)
    .sort((a, b) => b.term.length - a.term.length);
  const first = node.term.split(" ")[0];
  const byCompany = new Map();
  for (const p of db.prepare(`SELECT company, title FROM scraped_jobs
      WHERE is_active = 1 AND duplicate_of IS NULL AND company IS NOT NULL AND company != '' AND title LIKE ?`).iterate(`%${first}%`)) {
    const tk = ` ${normaliseAtsTerm(p.title ?? "")} `;
    const role = roles.find(r => tk.includes(` ${r.term} `));
    if (role?.id !== node.id) continue;
    byCompany.set(p.company, (byCompany.get(p.company) || 0) + 1);
  }
  return byCompany;
}

/**
 * ⭐ D121 P3 · "Companies hiring Data Engineers that sponsor often": each entry carries the ONE signal's level and label
 * (often before sometimes) and, when the ingest has it, the role's own title-family line.
 * @returns {Array<{ company, postings, filings, fiscalYear, text, source, level, label, titleLine }>}
 */
export function sponsorsForRole(db, slug, { limit = SPONSORS_LIMIT } = {}) {
  const out = [];
  let roleName = null;
  try { roleName = db.prepare(`SELECT name FROM atlas_nodes WHERE slug = ?`).pluck().get(String(slug)); } catch { roleName = null; }
  for (const [company, postings] of companiesForRole(db, slug)) {
    let f = null;
    try { f = sponsorshipFactFor(db, company); } catch { f = null; }
    if (!f || !(f.filings > 0)) continue;
    let s = null;
    try { s = sponsorshipSignal(db, company, { title: roleName }); } catch { s = null; }
    out.push({ company, postings, filings: f.filings, fiscalYear: f.fiscalYear, text: f.text, source: f.source,
      level: s?.companyLevel || "sometimes", label: s ? LABELS[s.companyLevel] : null,
      titleLine: s?.facts.find(x => x.kind === "title")?.text || null,
      // the chip's input — the company's level (a role page has no posting, so never "says no")
      signal: s ? { level: s.companyLevel, label: LABELS[s.companyLevel], line: s.line, notice: s.notice } : null });
  }
  const rank = (l) => PICK_RANK[l] ?? PICK_RANK.unknown;
  return out.sort((a, b) => rank(a.level) - rank(b.level) || b.filings - a.filings || b.postings - a.postings || a.company.localeCompare(b.company)).slice(0, limit);
}

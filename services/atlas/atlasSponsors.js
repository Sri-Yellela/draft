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

export const SPONSORS_LIMIT = 8;

/** @returns {Array<{ company, postings, filings, fiscalYear, text, source }>} */
export function sponsorsForRole(db, slug, { limit = SPONSORS_LIMIT } = {}) {
  let node;
  try { node = db.prepare(`SELECT id, term FROM atlas_nodes WHERE slug = ? AND kind = 'role' AND status = 'published'`).get(String(slug)); }
  catch { return []; }
  if (!node?.term) return [];
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
  const out = [];
  for (const [company, postings] of byCompany) {
    let f = null;
    try { f = sponsorshipFactFor(db, company); } catch { f = null; }
    if (!f || !(f.filings > 0)) continue;
    out.push({ company, postings, filings: f.filings, fiscalYear: f.fiscalYear, text: f.text, source: f.source });
  }
  return out.sort((a, b) => b.filings - a.filings || b.postings - a.postings || a.company.localeCompare(b.company)).slice(0, limit);
}

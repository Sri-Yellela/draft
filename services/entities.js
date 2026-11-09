// services/entities.js — ⭐ D184 B-6 (45p, owner 11-08) · ONE OBJECT, REUSED EVERYWHERE ("object modularity").
//
// *"resume updates the work ex accordingly in the about section, which accurately links to the company and company
// technographics from the db available. this is inline with our object modularity, which basically reuses the same object
// across wherever needed … keywords, companies basically all searchables."*
//
// THE ONE RESOLVER for draft's searchable objects. Nothing keeps its own copy of a company or a technology:
//   company     — D179 P4a's one record (companies + company_aliases). Postings WRITE through resolveCompany (it may make a
//                 record); every reader (the résumé's experience, the profile, suggestions) READS through companyRef, which
//                 never makes one — an employer with no record stays unknown (a letter logo, no stack), never a guess.
//   technology  — shared/techVocabulary.js (k8s = Kubernetes): technologiesIn for any text, techRef for one name.
//   stack       — services/companies/companyTech.js's stackFor (D179 (5): only technologies with evidence on the company's
//                 own postings) — the company page's Tech stack and the profile's "works with" line are the same rows.
import { companyKey as nameKey } from "./jobs/companyLogoStore.js";
import { resolveCompany } from "./companies/companyRecords.js";
import { stackFor } from "./companies/companyTech.js";
import { technologiesIn, TECH_GROUP_OF } from "../shared/techVocabulary.js";

export { resolveCompany, technologiesIn, nameKey };
// A company page's SLUG → its record (the board and the dropdown link by slug) — the same resolver, re-exported.
export { companyIdForSlug } from "./companies/publicCompany.js";

const safe = (fn, d) => { try { return fn(); } catch { return d; } };
export const STACK_SHOWN = 8;

/** The company record a name resolves to — READ-ONLY (never makes one). { id, slug, name, href } | null. */
export function companyRef(db, name) {
  const key = nameKey(String(name || "").trim());
  if (!key) return null;
  const row = safe(() => db.prepare(`SELECT c.id, c.slug, c.name FROM company_aliases a JOIN companies c ON c.id = a.company_id
      WHERE a.alias_key = ?`).get(`name:${key}`), null);
  return row ? { id: row.id, slug: row.slug, name: row.name, href: `/app/companies/${row.slug}` } : null;
}

/** A company's stack as names, most-evidenced first — only what its own postings show (empty when they show nothing). */
export function companyStack(db, companyId, { max = STACK_SHOWN, nowSec } = {}) {
  const s = safe(() => stackFor(db, companyId, nowSec), null);
  if (!s) return [];
  return Object.values(s.groups).flat().sort((a, b) => b.postings - a.postings || a.tech.localeCompare(b.tech))
    .slice(0, max).map(x => x.tech);
}

/** One technology as the shared object: its canonical name and group, or null when the vocabulary doesn't know it. */
export function techRef(name) {
  const hit = technologiesIn(String(name || ""))[0];
  return hit ? { name: hit.name, group: hit.group || TECH_GROUP_OF[hit.name] || null } : null;
}

/**
 * The résumé's experience rows with their company OBJECT: { ...row, companyRef: { id, slug, name, href, stack, used } | null }.
 * `stack` = the company's technologies from the DB; `used` = those the row's own title + bullets name ("you used React and
 * TypeScript there"). An employer with no record → companyRef null (the letter logo stays, no stack).
 */
export function experienceEntities(db, items, opts = {}) {
  const memo = new Map();
  return (items || []).map(x => {
    const k = nameKey(String(x?.company || ""));
    if (!memo.has(k)) {
      const ref = k ? companyRef(db, x.company) : null;
      memo.set(k, ref ? { ...ref, stack: companyStack(db, ref.id, opts) } : null);
    }
    const ref = memo.get(k);
    if (!ref) return { ...x, companyRef: null };
    const said = new Set(technologiesIn([x.title || "", ...(x.bullets || [])].join("\n")).map(t => t.name));
    return { ...x, companyRef: { ...ref, used: ref.stack.filter(t => said.has(t)) } };
  });
}

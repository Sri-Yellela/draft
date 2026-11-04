// services/audit/auditRoleCard.js — ⭐ D150 T04 · THE ROLE CARD FROM OUR DATA (the audit's step 2, before the questions).
//
// Every number is the board's own and traceable to postings — nothing from outside data, and always said as
// "market data from N open postings, not a promise":
//   · auditRoles(db, { field })   the roles we can audit: LIVE (approved) questions in the bank AND ≥ MIN_POSTINGS open
//                                 postings read as that role (the Atlas live rows, atlas_posting_match.role_id — D118 P1).
//   · roleCard(db, slug, { level }) → { slug, title, level, payRange, topRequirements[3], openThisWeek, newThisWeek, asOf, said }
//       payRange         p25–p75 of the role's postings that STATE pay (salary or pay in the text, ≥ $15k, the rollup's
//                        floor), with n — ⛔ HIDDEN (null + why) under MIN_PAY postings with pay.
//       topRequirements  the most-asked MUST-HAVES: each posting's Atlas reading (the skills it asks for), kept only where
//                        the posting does not name it solely in its nice-to-have section — D123's job-block rule
//                        (leanTailoring.js splitMustNice) — counted over the role's postings, top 3, with each share.
//       openThisWeek     the role's open postings now; newThisWeek those first seen in the last 7 days.
// Cached per role / level behind the live stamp (liveCached): a posting counted or closed moves the card.
// ⛔ D17: no model.
import { atlasIndex } from "../atlas/atlasMe.js";
import { liveCached } from "../atlas/atlasLive.js";
import { ACTIVE_POSTINGS_WHERE } from "../atlas/postingMatcher.js";
import { splitMustNice } from "../leanTailoring.js";

export const AUDIT_CARD = Object.freeze({ MIN_POSTINGS: 30, MIN_PAY: 20, REQUIREMENTS: 3, PAY_FLOOR_USD: 15000, WEEK_S: 7 * 86400 });
/** The audit's levels → the posting's own read level (D106 level_read). */
const LEVEL_READS = Object.freeze({ entry: ["entry", "early"], early: ["entry", "early"], mid: ["mid"], senior: ["senior"], staff: ["senior"] });
export const MARKET_SAID = (n) => `Market data from ${n} open posting${n === 1 ? "" : "s"}, not a promise.`;

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
};

/** The published Atlas role a bank role name means (its name, then its term), or null. */
export function roleNodeFor(idx, roleName) {
  const want = norm(roleName);
  const roles = idx.nodes.filter(n => n.kind === "role" && n.status === "published");
  return roles.find(n => norm(n.name) === want) || roles.find(n => norm(n.term) === want) || null;
}

const openCount = (db, roleId) => db.prepare(`SELECT COUNT(*) FROM atlas_posting_match m JOIN scraped_jobs sj ON sj.id = m.posting_id
  WHERE m.role_id = ? AND sj.${ACTIVE_POSTINGS_WHERE.replace(/ AND /g, " AND sj.")}`).pluck().get(roleId);

/** The roles the audit can be taken for. */
export function auditRoles(db, { field = null } = {}) {
  const idx = atlasIndex(db);
  const bank = db.prepare(`SELECT role, COUNT(*) n, GROUP_CONCAT(DISTINCT level) levels FROM learn_questions WHERE status = 'live' AND role IS NOT NULL GROUP BY role`).all();
  const out = [];
  for (const b of bank) {
    const node = roleNodeFor(idx, b.role);
    if (!node || (field && node.family !== field)) continue;
    const open = openCount(db, node.id);
    if (open < AUDIT_CARD.MIN_POSTINGS) continue;
    out.push({ slug: node.slug, title: node.name, bankRole: b.role, family: node.family ?? null, levels: String(b.levels || "").split(",").filter(Boolean).sort(), questions: b.n, openPostings: open });
  }
  return out.sort((a, b) => b.openPostings - a.openPostings || a.title.localeCompare(b.title));
}

/** One role's card, or null (not an auditable role). */
export function roleCard(db, slug, { level = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const idx = atlasIndex(db);
  const node = idx.nodes.find(n => n.slug === String(slug) && n.kind === "role" && n.status === "published");
  if (!node) return null;
  const lv = level && LEVEL_READS[level] ? level : null;
  return liveCached(db, `audit-card:${node.id}:${lv || "-"}`, () => build(db, idx, node, lv, now));
}

function build(db, idx, node, level, now) {
  const reads = level ? LEVEL_READS[level] : null;
  const rows = db.prepare(`SELECT sj.id, sj.title, sj.description, sj.description_text, sj.description_basis, sj.discovered_at, sj.scraped_at,
      COALESCE(sj.salary_min_usd, sj.pay_text_min_usd) AS pmin, COALESCE(sj.salary_max_usd, sj.pay_text_max_usd) AS pmax,
      m.asked, sj.level_read
    FROM atlas_posting_match m JOIN scraped_jobs sj ON sj.id = m.posting_id
    WHERE m.role_id = ? AND sj.${ACTIVE_POSTINGS_WHERE.replace(/ AND /g, " AND sj.")}`).all(node.id)
    .filter(r => !reads || reads.includes(r.level_read));
  const n = rows.length;

  // Pay: each stating posting's midpoint (or its one stated end), the rollup's rule — then p25 / p75.
  const ok = (v) => Number.isFinite(v) && v >= AUDIT_CARD.PAY_FLOOR_USD;
  const pays = rows.map(r => (ok(r.pmin) && ok(r.pmax) ? Math.round((r.pmin + r.pmax) / 2) : ok(r.pmin) ? r.pmin : ok(r.pmax) ? r.pmax : null))
    .filter(v => v != null).sort((a, b) => a - b);
  const payRange = pays.length >= AUDIT_CARD.MIN_PAY
    ? { p25Usd: quantile(pays, 0.25), p75Usd: quantile(pays, 0.75), n: pays.length }
    : { hidden: true, n: pays.length, why: `Pay is shown once at least ${AUDIT_CARD.MIN_PAY} of these postings state it (${pays.length} do).` };

  // Must-haves: the posting's Atlas reading, minus what it names only as nice-to-have.
  const counts = new Map();
  for (const r of rows) {
    const asked = String(r.asked || "").split(",").map(Number).filter(Number.isFinite)
      .map(id => idx.byId.get(id)).filter(x => x && x.kind !== "role" && x.status === "published");
    if (!asked.length) continue;
    const { must } = splitMustNice({ description: r.description, description_text: r.description_text, description_basis: r.description_basis }, asked.map(x => x.name));
    const mustSet = new Set(must);
    for (const x of asked) if (mustSet.has(x.name)) counts.set(x.id, (counts.get(x.id) || 0) + 1);
  }
  const topRequirements = [...counts.entries()].sort((a, b) => b[1] - a[1] || idx.byId.get(a[0]).name.localeCompare(idx.byId.get(b[0]).name))
    .slice(0, AUDIT_CARD.REQUIREMENTS)
    .map(([id, c]) => { const x = idx.byId.get(id); return { slug: x.slug, name: x.name, kind: x.kind, postings: c, share: n ? Math.round((c / n) * 100) : 0 }; });

  const weekAgo = now - AUDIT_CARD.WEEK_S;
  const seen = (r) => Number(r.discovered_at ?? r.scraped_at);
  return {
    slug: node.slug, title: node.name, level, payRange, topRequirements,
    openThisWeek: n, newThisWeek: rows.filter(r => seen(r) >= weekAgo).length,
    asOf: new Date(now * 1000).toISOString().slice(0, 10), said: MARKET_SAID(n),
  };
}

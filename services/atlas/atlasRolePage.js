// services/atlas/atlasRolePage.js — ⭐ D105 P12 (owner 10-31) · A ROLE PAGE IS THE BOARD'S OWN DATA.
//
// Role names rarely have an exact Wikipedia article ("Backend Engineer", "ML Engineer" — most of the 81 "missing" and
// 32 "redirect" titles were roles), so a role publishes on ≥ 5 active postings alone (atlasPublish.js) and its page is
// what the board says about it:
//   topSkills   the skills / tools its postings ask for most, each with its SHARE of the role's postings
//   levels      its postings by their real level (D106 scraped_jobs.level_read), and how many had no read
//   pay         the range where postings state one (atlas_node_stats — the nightly rollup's figure, as on every page)
//   companies   the companies with open postings for it (atlasSponsors.js companiesForRole — the sponsors' own count)
//   nextLevel   D116's "to reach the next level" for THIS role, every step (early-career → mid, mid → senior), by the
//               same rule YOUR MAP uses (atlasMe.js levelRises) — not the reader's profile, so nothing is skipped
// A definition, when one exists, is shown above it by the page; nothing here writes text. ⛔ No model (D17).
// ⛔ ONE MATCHER, ONE ROLLUP: the per-role counts are atlasMe.js boardCounts (the live rows, D118 P1 — the nightly
// pass's, moved by every posting ingested, changed or closed since).

import { atlasIndex, boardCounts, levelRises, LEVEL_BANDS } from "./atlasMe.js";
import { atlasPostingsChanged } from "./atlasLive.js";
import { companiesForRole } from "./atlasSponsors.js";
import { LEVELS_READ } from "../../shared/postingLevel.js";

/** How much of each list the role page shows. */
export const ROLE_PAGE = Object.freeze({ SKILLS: 12, COMPANIES: 12, RISES: 8 });

const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);
const nodeOut = (n) => ({ slug: n.slug, kind: n.kind, name: n.name });

/**
 * The board sections of one PUBLISHED role's page, or null (not a role, not published, unknown).
 * @returns {{ postings, topSkills: [{ slug, kind, name, postings, share }], levels: { read: [{ level, postings, share }],
 *   unread }, pay, companies: { total, items: [{ company, postings }] }, nextLevel: [{ from, to, postings, reason?, items }] }}
 */
export function roleBoard(db, slug) {
  atlasPostingsChanged(db);   // ⭐ D118 P1: the live rows, with any posting written a moment ago
  const idx = atlasIndex(db);
  const role = idx.nodes.find(n => n.slug === String(slug));
  if (!role || role.kind !== "role" || role.status !== "published") return null;
  const rollup = boardCounts(db, idx.nodes);
  const r = rollup.roles.get(role.id);
  const postings = r?.postings ?? 0;

  const topSkills = [...(r?.skill ?? new Map()).entries()]
    .map(([id, c]) => [idx.byId.get(id), c])
    .filter(([n]) => n && n.kind !== "role" && n.status === "published")
    .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
    .slice(0, ROLE_PAGE.SKILLS)
    .map(([n, c]) => ({ ...nodeOut(n), postings: c, share: pct(c, postings) }));

  const read = LEVELS_READ.map(level => ({ level, postings: r?.levels.get(level)?.postings ?? 0 }))
    .map(l => ({ ...l, share: pct(l.postings, postings) }));
  const unread = postings - read.reduce((s, l) => s + l.postings, 0);

  let pay = null;
  try {
    const s = db.prepare(`SELECT pay_min_usd, pay_median_usd, pay_max_usd, pay_n FROM atlas_node_stats WHERE node_id = ?`).get(role.id);
    if (s?.pay_n) pay = { minUsd: s.pay_min_usd, medianUsd: s.pay_median_usd, maxUsd: s.pay_max_usd, n: s.pay_n };
  } catch { pay = null; }

  const all = [...companiesForRole(db, role.slug).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([company, n]) => ({ company, postings: n }));

  const nextLevel = [];
  for (let cur = 0; cur + 1 < LEVEL_BANDS.length; cur++) {
    const { said, items } = levelRises(idx, rollup, role.id, cur);
    nextLevel.push({ from: said.from, to: said.to, postings: said.postings, ...(said.reason ? { reason: said.reason } : {}),
      total: items.length, items: items.slice(0, ROLE_PAGE.RISES).map(({ _rise, role: _r, ...i }) => i) });
  }

  return { postings, topSkills, levels: { read, unread }, pay, companies: { total: all.length, items: all.slice(0, ROLE_PAGE.COMPANIES) }, nextLevel };
}

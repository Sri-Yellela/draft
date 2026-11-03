// services/navigator.js — ⭐ D143 · THE NAVIGATOR (owner 11-02): a destination, a route, progress and re-routing —
// direction, not a menu. *"another gap is the direction, we only show them options but how are we going about showing
// direction."*
//
//   (1) THE DESTINATION — draft RECOMMENDS one or two roles with reasons ("Most reachable step up: Data Engineer — you
//       cover 9 of 15 skills · ≈ $20k more · 30 new postings this week"), shows the alternatives ranked, or keeps the
//       user's own aim. Candidates: the roles of the user's own category (D127 — a cross-category move is D139's) with
//       postings on the board; each read by the ONE role reading (services/atlas/atlasRoleFit.js roleFitReading: the
//       role's top 15 against the user's Profile, else their résumé).
//   (2) THE ROUTE — the destination's missing skills in the order its postings ask for them, each with the Learn step
//       that teaches it, ≈ WEEKS_PER_SKILL each (a stated assumption, not a measurement) — AND, in parallel, the BRIDGE
//       roles to apply to now (roles the user already covers ≥ 60 % of, by new postings): nobody stops job hunting to learn.
//   (3) PROGRESS, weekly — route skills now covered, applications sent and replies this week.
//   (4) RE-ROUTING — when the market or the user's results change, the route updates WITH THE REASON ("Airflow is now
//       asked in 41 % of Data Engineer postings — added"; "You're getting replies for Data Analyst — aim there first?").
//       Each change is kept (the last CHANGES_KEPT) with its date.
// ⛔ D17: rules and arithmetic, no model. The user's aim and the stored route are theirs (navigator_routes, merge keepInto).

import { atlasIndex } from "./atlas/atlasMe.js";
import { roleFitReading } from "./atlas/atlasRoleFit.js";
import { categoryIndex, roleCategory, registryCached } from "./atlas/atlasCategories.js";
import { targetRoleIds } from "./atlas/atlasMe.js";
import { postingMatcher } from "./atlas/postingMatcher.js";
import { learnStepForNode, learnStepPath } from "./learn/learnLinks.js";

const DAY = 86400;
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

/** Every number of the navigator, here and only here. */
export const NAVIGATOR = Object.freeze({
  CANDIDATE_ROLES: 40,    // the category's roles read, by postings
  MIN_POSTINGS: 5,        // a role with fewer open postings is no destination
  RECOMMEND: 2,
  ALTERNATIVES: 5,
  MIN_REACH: 0.3,         // below this share of the top skills, a role is an alternative at most
  ROUTE_SKILLS: 5,
  WEEKS_PER_SKILL: 2,     // ⚠ an assumption the owner tunes — not measured
  BRIDGE_MIN_REACH: 0.6,
  BRIDGES: 3,
  RISE_POINTS: 10,        // a skill whose share in the aim's postings rose this many points is "rising"
  REPLIES_WINDOW_DAYS: 60,
  REPLIES_TO_SUGGEST: 2,
  CHANGES_KEPT: 10,
  MIN_PAY_N: 20,          // a role's pay median is said only from this many postings that state pay
});

const money = (usd) => `$${Math.round(Math.abs(usd) / 1000)}k`;

/**
 * PURE. Rank destination candidates. @param cands [{ slug, name, covered, of, postings, newThisWeek, payMedian }]
 * @param current { slug, payMedian } | null — the user's current role (never its own destination)
 * @returns [{ ...cand, reach, payDelta, score, reasons: string[], line }] best first
 */
export function rankDestinations(cands, current = null) {
  const out = cands.filter(c => c.slug !== current?.slug && c.of > 0 && c.postings >= NAVIGATOR.MIN_POSTINGS).map(c => {
    const reach = c.covered / c.of;
    const payDelta = current?.payMedian && c.payMedian ? c.payMedian - current.payMedian : null;
    const score = reach * 100 + Math.min(c.newThisWeek || 0, 50) * 0.3 + (payDelta > 0 ? Math.min(payDelta / 1000, 30) * 0.5 : 0);
    const reasons = [`you cover ${c.covered} of ${c.of} skills`];
    if (payDelta != null && Math.abs(payDelta) >= 5000) reasons.push(`≈ ${money(payDelta)} ${payDelta > 0 ? "more" : "less"}`);
    if (c.newThisWeek) reasons.push(`${c.newThisWeek} new posting${c.newThisWeek === 1 ? "" : "s"} this week`);
    return { ...c, reach, payDelta, score, reasons };
  });
  out.sort((a, b) => b.score - a.score || b.postings - a.postings || a.name.localeCompare(b.name));
  return out.map((c, i) => ({ ...c, line: `${i === 0 && c.reach >= NAVIGATOR.MIN_REACH ? "Most reachable step up" : "Also reachable"}: ${c.name} — ${c.reasons.join(" · ")}` }));
}

/** PURE. The route's changes against the stored one, each with its reason. */
export function routeChanges(before, after, roleName) {
  if (!before) return [];
  const had = new Map((before.skills || []).map(s => [s.slug, s]));
  const now = new Map((after.skills || []).map(s => [s.slug, s]));
  const out = [];
  for (const s of after.skills || []) {
    if (had.has(s.slug)) {
      const rise = (s.share ?? 0) - (had.get(s.slug).share ?? 0);
      if (rise >= NAVIGATOR.RISE_POINTS) out.push({ kind: "rising", slug: s.slug, text: `${s.name} is rising: now asked in ${s.share} % of ${roleName} postings (was ${had.get(s.slug).share} %)` });
      continue;
    }
    out.push({ kind: "added", slug: s.slug, text: `${s.name} is now asked in ${s.share} % of ${roleName} postings — added to your route` });
  }
  for (const s of before.skills || []) {
    if (now.has(s.slug)) continue;
    out.push(after.covered?.includes(s.slug)
      ? { kind: "done", slug: s.slug, text: `You have ${s.name} now — your route is shorter` }
      : { kind: "dropped", slug: s.slug, text: `${s.name} is asked less often in ${roleName} postings — taken off your route` });
  }
  return out;
}

function nodeBySlug(db, slug) {
  return safe(() => db.prepare(`SELECT id, slug, name, term, kind, status FROM atlas_nodes WHERE slug = ?`).get(slug), null);
}
function payMedian(db, nodeId) {
  return safe(() => db.prepare(`SELECT pay_median_usd FROM atlas_node_stats WHERE node_id = ? AND pay_n >= ?`).pluck().get(nodeId, NAVIGATOR.MIN_PAY_N), null) ?? null;
}

/** Open postings first seen in the last 7 days, per role id (the one matcher's stored role per posting). */
function newThisWeekByRole(db, now) {
  const m = new Map();
  for (const r of safe(() => db.prepare(`SELECT pm.role_id AS id, COUNT(*) AS n FROM atlas_posting_match pm JOIN scraped_jobs sj ON sj.id = pm.posting_id
      WHERE sj.is_active = 1 AND sj.duplicate_of IS NULL AND pm.role_id IS NOT NULL AND COALESCE(sj.discovered_at, sj.scraped_at) >= ?
      GROUP BY pm.role_id`).all(now - 7 * DAY), [])) m.set(r.id, r.n);
  return m;
}

/** Replies to the user's applications in the last REPLIES_WINDOW_DAYS, per role id. */
function repliesByRole(db, userId, now) {
  const m = new Map();
  for (const r of safe(() => db.prepare(`SELECT pm.role_id AS id, COUNT(*) AS n FROM job_applications a
      JOIN scraped_jobs sj ON sj.job_id = a.job_id JOIN atlas_posting_match pm ON pm.posting_id = sj.id
      WHERE a.user_id = ? AND a.first_response_at >= ? AND pm.role_id IS NOT NULL GROUP BY pm.role_id`)
    .all(userId, now - NAVIGATOR.REPLIES_WINDOW_DAYS * DAY), [])) m.set(r.id, r.n);
  return m;
}

function readStored(db, userId) {
  const r = safe(() => db.prepare(`SELECT * FROM navigator_routes WHERE user_id = ?`).get(userId), null);
  if (!r) return null;
  return { aimSlug: r.aim_slug, aimSetBy: r.aim_set_by, aimAt: r.aim_at, route: safe(() => JSON.parse(r.route_json), null),
    routeAt: r.route_at, changes: safe(() => JSON.parse(r.changes_json), []) || [] };
}

/** The user's own aim: a role slug, or null to follow the recommendation. */
export function setAim(db, userId, slug, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (slug != null) {
    const n = nodeBySlug(db, String(slug));
    if (!n || n.kind !== "role") throw Object.assign(new Error("That is not a role on the Atlas."), { status: 400, code: "unknown_role" });
  }
  db.prepare(`INSERT INTO navigator_routes (user_id, aim_slug, aim_set_by, aim_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET aim_slug = excluded.aim_slug, aim_set_by = excluded.aim_set_by, aim_at = excluded.aim_at,
        route_json = NULL, route_at = NULL`).run(userId, slug ?? null, slug ? "user" : null, now);
  return navigatorFor(db, userId, { now });
}

/**
 * The navigator for one user.
 * @returns {{ ready, reason?, current, destination: { aim, recommended, alternatives }, route, bridges, progress, changes }}
 */
export function navigatorFor(db, userId, { now = Math.floor(Date.now() / 1000), registry = null } = {}) {
  const idx = atlasIndex(db);
  const roles = idx.nodes.filter(n => n.kind === "role");
  const currentIds = safe(() => targetRoleIds(db, userId, postingMatcher(db, roles, { listOnly: true })), []);
  const currentNode = currentIds.length ? idx.byId.get(currentIds[0]) : null;
  let reg = registry;
  if (!reg) reg = safe(() => registryCached(), {});
  const cIndex = categoryIndex(reg);
  const category = currentNode ? roleCategory(currentNode, cIndex) : null;
  if (!currentNode || !category) return { ready: false, reason: "no_current_role", message: "Add your current or target role to your job profile, and draft will point the way." };

  const newWeek = newThisWeekByRole(db, now);
  const candidates = roles.filter(r => (r.postings || 0) >= NAVIGATOR.MIN_POSTINGS && roleCategory(r, cIndex) === category)
    .sort((a, b) => (b.postings || 0) - (a.postings || 0)).slice(0, NAVIGATOR.CANDIDATE_ROLES);
  if (!candidates.some(r => r.id === currentNode.id)) candidates.push(currentNode);
  const readings = new Map();
  for (const r of candidates) {
    const f = safe(() => roleFitReading(db, { role: r.slug, userId, registry: reg }), null);
    if (f?.found) readings.set(r.slug, { node: r, f });
  }
  const cand = [...readings.values()].map(({ node, f }) => ({ slug: node.slug, name: node.name, covered: f.covered, of: f.of,
    postings: f.role.postings, newThisWeek: newWeek.get(node.id) || 0, payMedian: payMedian(db, node.id), page: f.role.page }));
  const current = { slug: currentNode.slug, name: currentNode.name, payMedian: payMedian(db, currentNode.id) };
  const ranked = rankDestinations(cand, current);
  const recommended = ranked.filter(c => c.reach >= NAVIGATOR.MIN_REACH).slice(0, NAVIGATOR.RECOMMEND);
  const alternatives = ranked.filter(c => !recommended.includes(c)).slice(0, NAVIGATOR.ALTERNATIVES);

  const stored = readStored(db, userId);
  // No role in reach yet → grow where you are: the current role's own missing skills are the route.
  const aimSlug = stored?.aimSlug || recommended[0]?.slug || current.slug;
  const aimNode = aimSlug ? (readings.get(aimSlug)?.node || nodeBySlug(db, aimSlug)) : null;
  const aimReading = aimNode ? (readings.get(aimNode.slug)?.f || safe(() => roleFitReading(db, { role: aimNode.slug, userId, registry: reg }), null)) : null;
  const setBy = stored?.aimSlug ? "user" : aimNode?.slug === current.slug ? "current" : "recommended";
  const here = cand.find(c => c.slug === current.slug);
  const aim = aimNode ? { slug: aimNode.slug, name: aimNode.name, setBy,
    line: setBy === "current" ? `Grow where you are: ${aimNode.name}${here ? ` — you cover ${here.covered} of ${here.of} skills` : ""}`
      : ranked.find(c => c.slug === aimNode.slug)?.line ?? aimNode.name } : null;

  // (2) THE ROUTE — the aim's missing skills in the order its postings ask, each with the Learn step that teaches it.
  let route = null;
  if (aimReading?.found) {
    const skills = aimReading.missing.slice(0, NAVIGATOR.ROUTE_SKILLS).map(m => {
      const node = nodeBySlug(db, m.slug);
      const step = node ? safe(() => learnStepForNode(db, node), null) : null;
      return { slug: m.slug, name: m.name, share: m.share, page: m.page, learn: step ? { stepId: step.stepId, title: step.title, label: step.label, path: learnStepPath(step.stepId) } : null };
    });
    route = { role: aim.name, slug: aim.slug, skills, covered: aimReading.have.map(h => h.slug),
      weeks: skills.length * NAVIGATOR.WEEKS_PER_SKILL,
      line: skills.length ? `${skills.map(s => s.name).join(" → ")}, ≈ ${skills.length * NAVIGATOR.WEEKS_PER_SKILL} weeks` : `You cover ${aim.name}'s top skills — apply now` };
  }
  // …and in parallel, the bridge roles to apply to now.
  const bridges = cand.filter(c => c.of > 0 && c.covered / c.of >= NAVIGATOR.BRIDGE_MIN_REACH)
    .sort((a, b) => b.newThisWeek - a.newThisWeek || b.postings - a.postings).slice(0, NAVIGATOR.BRIDGES)
    .map(c => ({ slug: c.slug, name: c.name, covered: c.covered, of: c.of, newThisWeek: c.newThisWeek,
      line: `${c.name}: you cover ${c.covered} of ${c.of} · ${c.newThisWeek} new this week` }));

  // (3) PROGRESS, this week.
  const apps = safe(() => db.prepare(`SELECT COUNT(*) FROM job_applications WHERE user_id = ? AND applied_at >= ?`).pluck().get(userId, now - 7 * DAY), 0);
  const replies = safe(() => db.prepare(`SELECT COUNT(*) FROM job_applications WHERE user_id = ? AND first_response_at >= ?`).pluck().get(userId, now - 7 * DAY), 0);
  const startSkills = stored?.route?.slug === route?.slug ? (stored?.route?.start || null) : null;
  const start = startSkills || (route ? [...route.skills.map(s => s.slug)] : []);
  const doneNow = route ? start.filter(s => route.covered.includes(s)).length : 0;
  const progress = { applications: apps, replies, routeSkills: start.length, routeDone: doneNow,
    line: `This week: ${apps} application${apps === 1 ? "" : "s"} sent · ${replies} repl${replies === 1 ? "y" : "ies"} · ${doneNow} of ${start.length} route skills done` };

  // (4) RE-ROUTING — the route's changes since it was stored, and what the user's replies say.
  const changes = [...(stored?.changes || [])];
  if (route) {
    const fresh = routeChanges(stored?.route?.slug === route.slug ? stored.route : null, route, route.role);
    if (fresh.length) changes.unshift(...fresh.map(c => ({ ...c, at: now })));
  }
  const replied = repliesByRole(db, userId, now);
  const aimReplies = aimNode ? (replied.get(aimNode.id) || 0) : 0;
  let suggest = null;
  for (const [id, n] of [...replied.entries()].sort((a, b) => b[1] - a[1])) {
    if (aimNode && id === aimNode.id) continue;
    if (n >= NAVIGATOR.REPLIES_TO_SUGGEST && n > aimReplies) {
      const r = idx.byId.get(id);
      if (r) suggest = { kind: "replies", slug: r.slug, text: `You're getting replies for ${r.name} (${n} in ${NAVIGATOR.REPLIES_WINDOW_DAYS} days) — aim there first?` };
      break;
    }
  }
  const kept = changes.slice(0, NAVIGATOR.CHANGES_KEPT);
  if (route) {
    const stamp = { ...route, start };
    safe(() => db.prepare(`INSERT INTO navigator_routes (user_id, aim_slug, aim_set_by, aim_at, route_json, route_at, changes_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET route_json = excluded.route_json, route_at = excluded.route_at, changes_json = excluded.changes_json`)
      .run(userId, stored?.aimSlug ?? null, stored?.aimSetBy ?? null, stored?.aimAt ?? null, JSON.stringify(stamp), now, JSON.stringify(kept)), null);
  }
  return {
    ready: true,
    current: { slug: current.slug, name: current.name },
    destination: { aim, recommended: recommended.map(pick), alternatives: alternatives.map(pick) },
    route, bridges, progress,
    changes: kept, suggest,
    next: route?.skills?.[0] ? { slug: route.skills[0].slug, name: route.skills[0].name, learn: route.skills[0].learn,
      text: `Next on your route to ${route.role}: ${route.skills[0].name}${route.skills[0].learn ? ` · start with ${route.skills[0].learn.title}` : ""}` } : null,
  };
}

const pick = ({ slug, name, covered, of, newThisWeek, payDelta, reasons, line, page }) => ({ slug, name, covered, of, newThisWeek, payDelta, reasons, line, page });

/**
 * ⭐ D136's aim signal: the user's destination role, for a posting's role id. Read once per shortlist.
 * @returns {{ roleId, name } | null}
 */
export function aimRoleFor(db, userId) {
  const slug = safe(() => db.prepare(`SELECT aim_slug FROM navigator_routes WHERE user_id = ?`).pluck().get(userId), null)
    || safe(() => JSON.parse(db.prepare(`SELECT route_json FROM navigator_routes WHERE user_id = ?`).pluck().get(userId) || "null")?.slug, null);
  const n = slug ? nodeBySlug(db, slug) : null;
  return n ? { roleId: n.id, name: n.name } : null;
}

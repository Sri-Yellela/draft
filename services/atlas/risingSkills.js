// services/atlas/risingSkills.js — ⭐ D185-3 (45q, owner 11-09) · REVERSE TECHNOGRAPHICS → THE ATLAS CONTENT BACKLOG.
//
// D185 P2b (adopted, changed): Atlas teaches what the market is STARTING to ask for — but nothing is auto-published.
//   • RISING = a technology's share of a subcategory's NEW postings (first seen in the last RECENT_DAYS) against its share
//     in the BASELINE window before it (RECENT_DAYS … BASELINE_DAYS ago), from D179 (5)'s job_tech — each posting's own text.
//     Minimum counts on both sides, so a skill named by three postings is never "rising".
//   • THE BACKLOG ranks the rising skills by growth, lifted when Atlas has NO lesson for the skill (learnStepForNode) and by
//     how many people hold the skill on their résumé while Atlas lacks it (atlas_skill_holds, D169). D177's unanswered asks
//     join here once the ask log exists (it waits on the owner: a privacy line + an opt-out) — the field is null until then.
//   • A DRAFT OUTLINE may be made for a backlog row: steps + the register's sources that cover the term, each marked adapt
//     (open-reuse / share-alike — with attribution) or link (link-only, gated, to-verify — never copied, D176). It is stored
//     as status 'draft' in atlas_backlog; a person accepts or rejects it in Admin. ⛔ Nothing here writes atlas_nodes or any
//     lesson, and nothing publishes — an accepted outline is a brief for the curator, who builds through the Atlas editor.
// ⛔ A126: the market reads run on the READ WORKERS.
import { loadRegistry, effectiveClass, mayAdapt } from "./sourceRegistry.js";
import { learnStepForNode } from "../learn/learnLinks.js";
import { learnContent } from "../learn/learnContent.js";
import { taxonomy } from "../jobs/taxonomyClassify.js";
import fs from "node:fs";

export const RECENT_DAYS = 30;
export const BASELINE_DAYS = 120;
export const MIN_RECENT_POSTINGS = 15;     // postings asking for the skill in the recent window
export const MIN_SUBCATEGORY_POSTINGS = 50; // new postings in the subcategory in each window
export const BACKLOG_STATUSES = Object.freeze(["draft", "accepted", "rejected"]);

const DAY = 86400;
const nowS = () => Math.floor(Date.now() / 1000);
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });

function subName(id) {
  const tax = safe(() => taxonomy(), null);
  for (const c of tax?.categories || []) { const s = c.subs.find(x => x.id === id); if (s) return s.name; }
  return id;
}

// ⭐ D193-1 (46z, owner 11-14) · the owner's research gaps (content/atlas/research-gaps-v1.json — topics with high creator
// engagement that Atlas is thin on) join the backlog BESIDE the market's rising skills, ranked by their own priority. Same
// rule: a row is a brief for the curator — drafting an outline stores status 'draft', nothing is written to atlas_nodes.
const RESEARCH_FILE = new URL("../../content/atlas/research-gaps-v1.json", import.meta.url);
export function researchGaps() {
  const doc = safe(() => JSON.parse(fs.readFileSync(RESEARCH_FILE, "utf8")), { gaps: [] });
  return (doc.gaps || []).filter(g => g?.term && g?.subcategory)
    .map(g => ({ kind: "research", tech: g.term, subcategory: g.subcategory, priority: Number(g.priority) || 9,
      scope: g.scope || "", atlasHas: g.atlasHas || "", proposal: g.proposal || "" }))
    .sort((a, b) => a.priority - b.priority || a.tech.localeCompare(b.tech));
}

/** PURE. Rows of (subcategory, tech, recent n, baseline n) + window totals → the rising list, best first. */
export function rankRising(techRows, totals, { minRecent = MIN_RECENT_POSTINGS, minSub = MIN_SUBCATEGORY_POSTINGS } = {}) {
  const out = [];
  for (const r of techRows) {
    const t = totals.get(r.subcategory);
    if (!t || t.recent < minSub || t.baseline < minSub || r.recent < minRecent) continue;
    const recentShare = r.recent / t.recent, baseShare = (r.baseline || 0) / t.baseline;
    if (recentShare <= baseShare) continue;
    const ratio = baseShare > 0 ? recentShare / baseShare : null;   // null = new in this window
    out.push({ subcategory: r.subcategory, tech: r.tech, recent: r.recent, baseline: r.baseline || 0,
      recentShare: Math.round(recentShare * 1000) / 10, baselineShare: Math.round(baseShare * 1000) / 10,
      pointsUp: Math.round((recentShare - baseShare) * 1000) / 10, ratio: ratio == null ? null : Math.round(ratio * 100) / 100 });
  }
  return out.sort((a, b) => b.pointsUp - a.pointsUp || b.recent - a.recent);
}

/** The rising skills by subcategory, from the read workers. */
export async function risingSkills(read, { now = nowS() } = {}) {
  const recentFrom = now - RECENT_DAYS * DAY, baseFrom = now - BASELINE_DAYS * DAY;
  const tot = await read.all(`SELECT jx.subcategory AS subcategory,
        SUM(CASE WHEN sj.discovered_at >= ? THEN 1 ELSE 0 END) AS recent,
        SUM(CASE WHEN sj.discovered_at < ? AND sj.discovered_at >= ? THEN 1 ELSE 0 END) AS baseline
      FROM job_taxonomy jx JOIN scraped_jobs sj ON sj.job_id = jx.job_id
     WHERE jx.subcategory IS NOT NULL AND jx.subcategory NOT LIKE '%.general' AND sj.discovered_at >= ? AND sj.duplicate_of IS NULL
     GROUP BY jx.subcategory`, [recentFrom, recentFrom, baseFrom, baseFrom]);
  const totals = new Map((tot || []).map(r => [r.subcategory, { recent: Number(r.recent) || 0, baseline: Number(r.baseline) || 0 }]));
  const rows = await read.all(`SELECT jx.subcategory AS subcategory, jt.tech AS tech,
        SUM(CASE WHEN sj.discovered_at >= ? THEN 1 ELSE 0 END) AS recent,
        SUM(CASE WHEN sj.discovered_at < ? AND sj.discovered_at >= ? THEN 1 ELSE 0 END) AS baseline
      FROM job_tech jt JOIN job_taxonomy jx ON jx.job_id = jt.job_id JOIN scraped_jobs sj ON sj.job_id = jt.job_id
     WHERE jx.subcategory IS NOT NULL AND jx.subcategory NOT LIKE '%.general' AND sj.discovered_at >= ? AND sj.duplicate_of IS NULL
     GROUP BY jx.subcategory, jt.tech`, [recentFrom, recentFrom, baseFrom, baseFrom]);
  return rankRising((rows || []).map(r => ({ ...r, recent: Number(r.recent) || 0, baseline: Number(r.baseline) || 0 })), totals);
}

/** The ranked backlog: rising skills, lifted when Atlas has no lesson and by the people who hold them. */
export async function contentBacklog(db, read, { now = nowS(), limit = 40 } = {}) {
  const rising = await risingSkills(read, { now });
  const holds = new Map(safe(() => db.prepare(`SELECT lower(name) AS k, COUNT(DISTINCT user_id) AS n FROM atlas_skill_holds GROUP BY lower(name)`).all(), [])
    .map(r => [r.k, r.n]));
  const drafts = new Map(safe(() => db.prepare(`SELECT term, subcategory, status, id FROM atlas_backlog`).all(), [])
    .map(r => [`${r.subcategory}|${r.term}`, r]));
  const byTech = new Map();
  const learn = safe(() => learnContent(db), null);
  for (const r of rising) {
    const lesson = learn ? safe(() => learnStepForNode(db, { name: r.tech, term: r.tech.toLowerCase() }, learn), null) : null;
    const held = holds.get(r.tech.toLowerCase()) || 0;
    const score = r.pointsUp * (lesson ? 1 : 2) + held * 0.5;
    const row = { ...r, subcategoryName: subName(r.subcategory), hasLesson: !!lesson, lesson: lesson ? (lesson.title || lesson.id || true) : null,
      peopleHolding: held, unansweredAsks: null, score: Math.round(score * 10) / 10,
      draft: drafts.get(`${r.subcategory}|${r.tech}`) || null };
    if (!byTech.has(r.tech) || byTech.get(r.tech).score < row.score) byTech.set(r.tech, row);
  }
  const research = researchGaps().map(g => {
    const lesson = learn ? safe(() => learnStepForNode(db, { name: g.tech, term: g.tech.toLowerCase() }, learn), null) : null;
    return { ...g, subcategoryName: subName(g.subcategory), hasLesson: !!lesson, lesson: lesson ? (lesson.title || lesson.id || true) : null,
      draft: drafts.get(`${g.subcategory}|${g.tech}`) || null };
  });
  return { rows: [...byTech.values()].sort((a, b) => b.score - a.score).slice(0, limit), research,
    windows: { recentDays: RECENT_DAYS, baselineDays: BASELINE_DAYS }, minimums: { recent: MIN_RECENT_POSTINGS, subcategory: MIN_SUBCATEGORY_POSTINGS },
    asks: "D177's unanswered asks join here once the ask log exists (owner-gated: a privacy line + an opt-out)." };
}

/** PURE. The register's sources that cover a term — each marked adapt (open licence, with attribution) or link only. */
export function sourcesFor(term, reg) {
  const t = String(term || "").toLowerCase();
  if (!t) return [];
  const hit = (s) => [s.name, ...(s.topics || [])].some(x => String(x || "").toLowerCase().includes(t));
  return (reg?.sources || []).filter(hit).slice(0, 8).map(s => ({ id: s.id, publisher: s.publisher, name: s.name, url: s.url,
    licenceClass: effectiveClass(s), use: mayAdapt(s) ? "adapt" : "link" }));
}

/** PURE. A path outline for curator review — steps and sources, nothing written as a lesson. */
export function outlineFor(row, reg) {
  const sources = sourcesFor(row.tech, reg);
  const adapt = sources.filter(s => s.use === "adapt");
  if (row.kind === "research") {
    return {
      title: `${row.tech} for ${row.subcategoryName || row.subcategory}`,
      why: `From the owner's research (D193, priority ${row.priority}): ${row.scope} Atlas has ${row.atlasHas}`,
      steps: [
        `What ${row.tech} covers and where it sits in ${row.subcategoryName || row.subcategory} work — in our own words, with a neutral source linked.`,
        adapt.length ? `The first module, adapted from ${adapt[0].publisher} ${adapt[0].name} (${adapt[0].licenceClass}; attribution + licence notice).`
          : `The first module — no open-licence source in the register covers it yet: write it ourselves, link the primary docs.`,
        `One deck and one check per idea (the reel shape: one concept, visual, five slides).`,
        `Proposed: ${row.proposal}.`,
      ],
      sources,
      status: "draft",
      note: "A brief for the curator. Nothing is published from here; creators' reels are linked as 'also watch', never copied.",
    };
  }
  return {
    title: `${row.tech} for ${row.subcategoryName || row.subcategory}`,
    why: `${row.recentShare}% of new ${row.subcategoryName || row.subcategory} postings ask for ${row.tech} (was ${row.baselineShare}%).`,
    steps: [
      `What ${row.tech} is and where it sits in ${row.subcategoryName || row.subcategory} work — in our own words, with a neutral source linked.`,
      adapt.length ? `A first hands-on step, adapted from ${adapt[0].publisher} ${adapt[0].name} (${adapt[0].licenceClass}; attribution + licence notice).`
        : `A first hands-on step — no open-licence source covers it yet: write it ourselves, link the vendor docs.`,
      `A quick check: three questions on when to reach for ${row.tech} and its trade-offs.`,
      `Prove it: a small build that uses ${row.tech}, linked from the profile.`,
    ],
    sources,
    status: "draft",
    note: "A brief for the curator. Nothing is published from here — the lesson is built and reviewed in the Atlas editor.",
  };
}

/** Make (or remake) the draft outline for a backlog row. Status is always 'draft'. */
export function draftOutline(db, row, { reg = safe(() => loadRegistry(), { sources: [] }), by = null } = {}) {
  if (!row?.tech || !row?.subcategory) throw bad(400, "bad_row", "Name a skill and its subcategory.");
  const outline = outlineFor(row, reg);
  db.prepare(`INSERT INTO atlas_backlog (term, subcategory, signal_json, outline_json, status, drafted_by, drafted_at)
      VALUES (?, ?, ?, ?, 'draft', ?, unixepoch())
      ON CONFLICT(term, subcategory) DO UPDATE SET signal_json = excluded.signal_json, outline_json = excluded.outline_json,
        status = 'draft', drafted_by = excluded.drafted_by, drafted_at = excluded.drafted_at, reviewed_by = NULL, reviewed_at = NULL`)
    .run(row.tech, row.subcategory, JSON.stringify(row), JSON.stringify(outline), by);
  return readBacklogItem(db, row.tech, row.subcategory);
}

export function readBacklogItem(db, term, subcategory) {
  const r = db.prepare(`SELECT * FROM atlas_backlog WHERE term = ? AND subcategory = ?`).get(term, subcategory);
  if (!r) return null;
  return { ...r, signal: safe(() => JSON.parse(r.signal_json), null), outline: safe(() => JSON.parse(r.outline_json), null) };
}

/** A person's review: accepted (a brief for the curator) or rejected. Never a publish. */
export function reviewOutline(db, id, { status, by = null } = {}) {
  if (!["accepted", "rejected"].includes(status)) throw bad(400, "bad_status", "Accept or reject.");
  const n = db.prepare(`UPDATE atlas_backlog SET status = ?, reviewed_by = ?, reviewed_at = unixepoch() WHERE id = ?`).run(status, by, Number(id)).changes;
  if (!n) throw bad(404, "not_found", "No such draft.");
  return db.prepare(`SELECT id, term, subcategory, status, reviewed_by, reviewed_at FROM atlas_backlog WHERE id = ?`).get(Number(id));
}

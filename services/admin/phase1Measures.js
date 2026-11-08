// services/admin/phase1Measures.js — ⭐ D150 T16 (45n) · MEASURE EACH MILESTONE — Admin → Today → Phase 1.
//
// One read of what Phase 1 has produced, with D131's small-number rule (services/testersReport.js shareText: "21 of 34"
// until there are 20, then a %): the audit's funnel (started · finished · claimed, by role, drop-off by question), the
// bank's answers by surface, debriefs per interview. Each against the spec's targets (continue or change): audit finish
// ≥ 60 % · claim after finish ≥ 20 % · debriefs ≥ 1 in 3 interviews. The milestones not built yet (T11 market pages'
// visits, T14 review returns, T15 stack opens) are listed as such, never as zero. Admin-only; no person is named.
import { shareText, SMALL_N } from "../testersReport.js";

export const PHASE1_TARGETS = Object.freeze({ auditFinish: 0.6, claimAfterFinish: 0.2, debriefsPerInterview: 1 / 3 });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** Pure: the audit funnel from session rows { role_slug, item_ids_json, answers_json, claimed_by }. */
export function auditFunnel(rows) {
  const byRole = new Map();
  const dropAt = new Map();          // question position (1-based) where an unfinished session stopped
  let started = 0, finished = 0, claimed = 0;
  for (const r of rows) {
    let items = [], answers = [];
    try { items = JSON.parse(r.item_ids_json || "[]"); } catch { items = []; }
    try { answers = JSON.parse(r.answers_json || "[]"); } catch { answers = []; }
    const done = items.length > 0 && answers.length >= items.length;
    started++; if (done) finished++; if (r.claimed_by != null) claimed++;
    if (!done) dropAt.set(answers.length + 1, (dropAt.get(answers.length + 1) || 0) + 1);
    const e = byRole.get(r.role_slug) || { role: r.role_slug, started: 0, finished: 0, claimed: 0 };
    e.started++; if (done) e.finished++; if (r.claimed_by != null) e.claimed++;
    byRole.set(r.role_slug, e);
  }
  const verdict = (k, n, target) => (n < SMALL_N ? "too few to judge" : k / n >= target ? "on target" : "under target");
  return {
    started, finished, claimed,
    finishShare: shareText(finished, started), finishVerdict: verdict(finished, started, PHASE1_TARGETS.auditFinish),
    claimShare: shareText(claimed, finished), claimVerdict: verdict(claimed, finished, PHASE1_TARGETS.claimAfterFinish),
    byRole: [...byRole.values()].sort((a, b) => b.started - a.started).map(e => ({ ...e, finishShare: shareText(e.finished, e.started) })),
    dropOff: [...dropAt].sort((a, b) => a[0] - b[0]).map(([at, n]) => ({ question: at, stopped: n })),
  };
}

// ⭐ D173 (9) (45n) · THE APPLY FUNNEL AS ONE CHAIN (Stripe's checkout → fraud → authorisation, for applications):
// dealt → kept → tailored → attempted → submitted → replied → interview, each stage's count in a window and its step
// from the stage before, this 30 days beside the 30 before — and a WARNING when submissions rose while the reply rate
// fell (never raise volume at the cost of replies). Counts only, no person named.
const DAY = 86400;
const STAGES = [
  ["dealt", "Dealt on a deck", `SELECT COUNT(*) FROM daily_drafts WHERE dealt_at >= ? AND dealt_at < ?`],
  ["kept", "Starred or drafted", `SELECT COUNT(*) FROM user_jobs WHERE (starred = 1 OR applied = 1) AND updated_at >= ? AND updated_at < ?`],
  ["tailored", "Résumé tailored", `SELECT COUNT(*) FROM resume_versions WHERE created_at >= ? AND created_at < ?`],
  ["attempted", "Application attempted", `SELECT COUNT(*) FROM apply_run_jobs WHERE started_at >= ? AND started_at < ?`],
  ["submitted", "Submitted", `SELECT COUNT(*) FROM job_applications WHERE applied_at >= ? AND applied_at < ?`],
  ["replied", "Replied", `SELECT COUNT(*) FROM job_applications WHERE response_outcome IS NOT NULL AND applied_at >= ? AND applied_at < ?`],
  ["interview", "Interview or assessment", `SELECT COUNT(*) FROM job_applications WHERE response_outcome IN ('interview', 'assessment', 'offer') AND applied_at >= ? AND applied_at < ?`],
];
/** Pure: the chain from two windows' counts { stage → n }. */
export function chainFrom(now, before) {
  const stages = STAGES.map(([id, label], i) => {
    const prev = i ? STAGES[i - 1][0] : null;
    return { id, label, n: now[id] ?? null, before: before[id] ?? null, fromPrevious: prev && now[prev] ? shareText(now[id] ?? 0, now[prev]) : "—" };
  });
  const rate = (w) => (w.submitted ? (w.replied || 0) / w.submitted : null);
  const warn = now.submitted > (before.submitted || 0) && rate(before) != null && rate(now) != null && rate(now) < rate(before)
    ? `Submissions rose (${before.submitted || 0} → ${now.submitted}) while the reply rate fell (${Math.round(rate(before) * 100)} % → ${Math.round(rate(now) * 100)} %) — volume is costing replies.` : null;
  return { stages, warning: warn };
}
export function applyChain(db, { nowSec = Math.floor(Date.now() / 1000), days = 30 } = {}) {
  const w = (from, to) => Object.fromEntries(STAGES.map(([id, , sql]) => [id, safe(() => db.prepare(sql).pluck().get(from, to), null)]));
  return { days, ...chainFrom(w(nowSec - days * DAY, nowSec), w(nowSec - 2 * days * DAY, nowSec - days * DAY)) };
}

export function phase1Measures(db) {
  const sessions = safe(() => db.prepare(`SELECT role_slug, item_ids_json, answers_json, claimed_by FROM audit_sessions`).all(), []);
  const surfaces = safe(() => db.prepare(`SELECT surface, COUNT(*) AS answers, SUM(correct) AS right FROM learn_question_answers GROUP BY surface ORDER BY answers DESC`).all(), [])
    .map(s => ({ ...s, rightShare: shareText(s.right || 0, s.answers) }));
  const interviews = safe(() => db.prepare(`SELECT COUNT(*) FROM job_applications WHERE response_outcome IN ('interview', 'assessment')`).pluck().get(), 0) || 0;
  const debriefs = safe(() => db.prepare(`SELECT COUNT(*) FROM interview_debriefs`).pluck().get(), 0) || 0;
  return {
    audit: auditFunnel(sessions),
    bank: { surfaces },
    debriefs: { interviews, debriefs, perInterview: interviews ? `${debriefs} for ${interviews} interviews` : "—",
      verdict: interviews < SMALL_N ? "too few to judge" : debriefs / interviews >= PHASE1_TARGETS.debriefsPerInterview ? "on target" : "under target" },
    applyChain: applyChain(db),
    notBuilt: ["T11 market pages' visits", "T14 review returns", "T15 stack opens"],
    targets: { auditFinish: "≥ 60 %", claimAfterFinish: "≥ 20 %", debriefs: "≥ 1 in 3 interviews" },
    smallN: SMALL_N,
  };
}

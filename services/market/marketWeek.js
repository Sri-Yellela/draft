// services/market/marketWeek.js — ⭐ D150 T09 (45n) · "YOUR MARKET THIS WEEK" — THE NUMBERS.
//
// A weekly snapshot (Mondays 06:00 America/New_York, server.js), one row per D127 field (scraped_jobs.board_category)
// and ISO week in `market_weeks` (migration 248): the week that just ENDED (Monday 00:00 UTC → the next Monday).
//   · new         — postings first seen in the week
//   · rolesUp / rolesDown — a role's new postings this week vs the mean of the 4 weeks before (atlas_posting_match's
//                   role); only roles with ≥ MIN_N postings across the five weeks; the top 5 each way
//   · seniorSkills — skills rising toward senior: the share of the week's SENIOR postings asking for a skill vs the
//                   same share over the 4 weeks before (D116's mid → senior reading, from atlas_posting_match.asked);
//                   only skills seen in ≥ MIN_N senior postings; the top 5
//   · companies   — the 5 companies with the most new postings in the week
//   · ghostRate   — D137's likely-not-hiring share of the field's open postings at the time of the run, AGGREGATED
//                   (never a posting named), with its n
// ⛔ Every figure carries its n. ⛔ IDEMPOTENT: a week already written is never recomputed (re-running gives the same
// numbers) unless `force`. The reads are grouped scans once a week, field by field, with a yield between fields (D151).
export const MARKET_METHOD = 1;
export const MARKET = Object.freeze({ MIN_N: 20, TOP: 5, PRIOR_WEEKS: 4 });
const WEEK = 7 * 86400;
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;
const FIRST_SEEN = SEC("COALESCE(sj.discovered_at, sj.scraped_at)");
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** ISO week "YYYY-Www" of a UTC date, and that week's Monday 00:00 UTC (seconds). */
export function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - dow + 1);
  const thursday = new Date(monday); thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return { key: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`, start: Math.floor(monday.getTime() / 1000) };
}
/** The week that ended before `now` (a Monday run reads the Monday-to-Sunday just gone). */
export const lastFullWeek = (now = new Date()) => isoWeekOf(new Date(now.getTime() - WEEK * 1000));

/** Pure: the top risers / fallers from { key → [w-4, w-3, w-2, w-1, w0] }. */
export function movers(series, { minN = MARKET.MIN_N, top = MARKET.TOP } = {}) {
  const rows = [];
  for (const [key, w] of series) {
    const total = w.reduce((a, b) => a + b, 0);
    if (total < minN) continue;
    const prior = w.slice(0, -1).reduce((a, b) => a + b, 0) / (w.length - 1);
    const now = w[w.length - 1];
    rows.push({ key, now, priorMean: Math.round(prior * 10) / 10, change: prior ? Math.round(((now - prior) / prior) * 100) : null, n: total });
  }
  const withChange = rows.filter(r => r.change != null);
  return { up: [...withChange].sort((a, b) => b.change - a.change).filter(r => r.change > 0).slice(0, top),
           down: [...withChange].sort((a, b) => a.change - b.change).filter(r => r.change < 0).slice(0, top) };
}

function fieldWeek(db, field, start) {
  const from = start - MARKET.PRIOR_WEEKS * WEEK, end = start + WEEK;
  const rows = safe(() => db.prepare(`SELECT ${FIRST_SEEN} AS t, sj.company AS company, m.role_id AS role, m.level AS level, m.asked AS asked
      FROM scraped_jobs sj LEFT JOIN atlas_posting_match m ON m.posting_id = sj.id
      WHERE sj.board_category = ? AND sj.duplicate_of IS NULL AND ${FIRST_SEEN} >= ? AND ${FIRST_SEEN} < ?`).all(field, from, end), []);
  const idx = (t) => Math.min(MARKET.PRIOR_WEEKS, Math.floor((t - from) / WEEK));
  const roles = new Map(), companies = new Map(), seniorAsk = new Map(), seniorN = Array(MARKET.PRIOR_WEEKS + 1).fill(0);
  let fresh = 0;
  for (const r of rows) {
    const i = idx(r.t);
    if (i === MARKET.PRIOR_WEEKS) { fresh++; if (r.company) companies.set(r.company, (companies.get(r.company) || 0) + 1); }
    if (r.role != null) { const s = roles.get(r.role) || Array(MARKET.PRIOR_WEEKS + 1).fill(0); s[i]++; roles.set(r.role, s); }
    if (/senior|staff|principal/i.test(String(r.level || ""))) {
      seniorN[i]++;
      for (const sk of new Set(String(r.asked || "").split(",").map(x => x.trim()).filter(Boolean))) {
        const s = seniorAsk.get(sk) || Array(MARKET.PRIOR_WEEKS + 1).fill(0); s[i]++; seniorAsk.set(sk, s);
      }
    }
  }
  const roleName = (id) => safe(() => db.prepare(`SELECT name FROM atlas_nodes WHERE id = ?`).pluck().get(id), null) || `role ${id}`;
  const m = movers(roles);
  const label = ({ key, ...x }) => ({ role: roleName(key), ...x });
  // skills toward senior: this week's share of senior postings vs the prior weeks' share (percentage points)
  const priorSenior = seniorN.slice(0, -1).reduce((a, b) => a + b, 0), nowSenior = seniorN[MARKET.PRIOR_WEEKS];
  const seniorSkills = [...seniorAsk].map(([skill, w]) => {
    const total = w.reduce((a, b) => a + b, 0);
    const now = nowSenior ? w[MARKET.PRIOR_WEEKS] / nowSenior : 0, prior = priorSenior ? w.slice(0, -1).reduce((a, b) => a + b, 0) / priorSenior : 0;
    return { skill, nowShare: Math.round(now * 1000) / 10, priorShare: Math.round(prior * 1000) / 10, points: Math.round((now - prior) * 1000) / 10, n: total };
  }).filter(s => s.n >= MARKET.MIN_N && nowSenior >= MARKET.MIN_N && s.points > 0).sort((a, b) => b.points - a.points).slice(0, MARKET.TOP);
  const ghost = safe(() => db.prepare(`SELECT COUNT(*) AS open, SUM(CASE WHEN ghost_level >= 2 THEN 1 ELSE 0 END) AS flagged
      FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL AND board_category = ?`).get(field), { open: 0, flagged: 0 }) || { open: 0, flagged: 0 };
  return {
    new: { n: fresh },
    rolesUp: m.up.map(label), rolesDown: m.down.map(label),
    seniorSkills: { seniorPostingsThisWeek: nowSenior, seniorPostingsBefore: priorSenior, skills: seniorSkills },
    companies: [...companies].sort((a, b) => b[1] - a[1]).slice(0, MARKET.TOP).map(([company, n]) => ({ company, n })),
    ghostRate: { open: ghost.open || 0, flagged: ghost.flagged || 0, rate: ghost.open ? Math.round(((ghost.flagged || 0) / ghost.open) * 1000) / 10 : null },
  };
}

/** Write the snapshot for the week that ended before `now`; a week already written is skipped unless `force`. */
export async function runMarketWeek(db, { now = new Date(), force = false, log = console } = {}) {
  const wk = lastFullWeek(now);
  const fields = safe(() => db.prepare(`SELECT DISTINCT board_category FROM scraped_jobs WHERE board_category IS NOT NULL AND is_active = 1`).pluck().all(), []);
  const have = new Set(safe(() => db.prepare(`SELECT field FROM market_weeks WHERE iso_week = ? AND method_version = ?`).pluck().all(wk.key, MARKET_METHOD), []));
  const put = db.prepare(`INSERT OR REPLACE INTO market_weeks (field, iso_week, week_start, metrics_json, method_version, computed_at) VALUES (?, ?, ?, ?, ?, unixepoch())`);
  let written = 0;
  for (const f of fields) {
    if (have.has(f) && !force) continue;
    put.run(f, wk.key, wk.start, JSON.stringify(fieldWeek(db, f, wk.start)), MARKET_METHOD);
    written++;
    await new Promise(r => setImmediate(r));   // D151: yield between fields
  }
  log.log?.(`[market-week] ${wk.key}: ${written} field(s) written, ${fields.length - written} already there`);
  return { week: wk.key, written, fields: fields.length };
}

/** The stored week for a field (the newest when `week` is omitted). */
export function marketWeekFor(db, field, week = null) {
  const r = safe(() => (week
    ? db.prepare(`SELECT * FROM market_weeks WHERE field = ? AND iso_week = ? ORDER BY method_version DESC LIMIT 1`).get(field, week)
    : db.prepare(`SELECT * FROM market_weeks WHERE field = ? ORDER BY week_start DESC, method_version DESC LIMIT 1`).get(field)), null);
  return r ? { field: r.field, week: r.iso_week, weekStart: r.week_start, method: r.method_version, ...JSON.parse(r.metrics_json) } : null;
}

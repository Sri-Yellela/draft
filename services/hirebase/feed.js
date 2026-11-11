// services/hirebase/feed.js — ⭐ HB-FEED (owner 11-10): Hirebase STARTER (25,000 jobs / month) as a DAILY FRESH FEED.
//
//   FEED-1  todayBudget   = (the month's usable allowance − what was used before today) ÷ the days left this month, where
//                           usable = cap × 0.95 (a 5 % reserve). Recomputed every day, so a quiet day's leftover spreads over
//                           the rest of the month instead of piling up, and the last day never binges.
//           hourBudget    = what is left of today's budget ÷ the hours left today (an even release through the day).
//   FEED-2  one pull per hour over a FIXED one-hour window of first_ingested lagged 2 hours: [T−3 h, T−2 h), where T is the
//           top of the hour. Hirebase says a job can take ~90 min to become searchable; its advised 2-hour OVERLAP would
//           return (and bill) the same jobs 2–3 times on an hourly poll, so the windows never overlap — each job is seen
//           once. Plus `days_ago: 1` (posted in the past 24 h). A window that already ran is never re-run.
//   FEED-3  each hour's budget split across role families by the shares (largest-remainder rounding, so the slices sum to
//           the budget); within a family the visa-sponsored jobs first (`visa: "true"`), then the rest (`visa: "false"`, so
//           nothing is bought twice); a family's unspent slice flows to the next family.
//   FEED-4  Hirebase-only rows leave the board 30 days after posting (runners.ageOut with FEED_MAX_AGE_DAYS).
//   FEED-5  feedState() — what Admin → System → Diagnostics → Hirebase shows; setShares / setFeedSwitch.
//   FEED-6  OFF until the owner's word: `hirebase_feed_on` (default off) AND the client's own HIREBASE_ENABLED / DRY_RUN.
import { getSetting, setSetting } from "../appSettings.js";
import { caps, usedSoFar } from "./spendGuard.js";
import { buildSearchBody, requestableCategories } from "./filter.js";
import { landHirebaseJob } from "./ingest.js";
import { HirebaseRefusedError, HirebaseQuotaError } from "./client.js";

export const RESERVE = 0.05;
export const FEED_MAX_AGE_DAYS = 30;
export const WINDOW_LAG_MS = 2 * 3600 * 1000;
export const WINDOW_MS = 3600 * 1000;
export const SHARES_KEY = "hirebase_feed_shares";
export const FEED_ON_KEY = "hirebase_feed_on";
export const FEED_PAUSED_KEY = "hirebase_feed_paused";

// FEED-3's starting split (Open Doors 2025 × the owner's order: CS first, then project management, finance, analytics).
// Each family names the Hirebase categories it requests (content/taxonomy/hirebase-category-map.json keys).
export const FAMILIES = Object.freeze([
  { key: "software",    label: "Software engineering",                         share: 30, categories: ["Software Engineer Jobs", "Quality Assurance Jobs"] },
  { key: "data",        label: "Data and AI (incl. analytics / BI)",           share: 18, categories: ["Data Analyst Jobs"] },
  { key: "engineering", label: "Engineering (hardware, mechanical, civil …)",  share: 12, categories: ["Engineering Jobs"] },
  { key: "finance",     label: "Business and finance",                         share: 12, categories: ["Accounting, Payroll & Financial Planning Jobs", "Finance Jobs", "Banking Jobs", "Insurance Jobs", "Consulting Jobs"] },
  { key: "pm",          label: "Project and program management",               share: 10, categories: ["Project & Program Management Jobs"] },
  { key: "cloud",       label: "Cloud, infrastructure, IT and security",       share: 8,  categories: ["Information Technology Jobs", "IT Support Jobs", "Support Engineer Jobs", "Security Engineer Jobs"] },
  { key: "product",     label: "Product management",                           share: 4,  categories: ["Product Jobs"] },
  { key: "other",       label: "Operations / supply chain, marketing, other",  share: 6,  categories: ["Business Operations & Strategy Jobs", "Operations Jobs", "Purchasing Jobs", "Marketing Jobs"] },
]);

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The shares in force: the saved ones (when valid) or FAMILIES' defaults. { key: pct } summing to 100. */
export function shares(db) {
  const def = Object.fromEntries(FAMILIES.map(f => [f.key, f.share]));
  try {
    const saved = JSON.parse(getSetting(db, SHARES_KEY) || "null");
    if (saved && validShares(saved).ok) return { ...Object.fromEntries(FAMILIES.map(f => [f.key, 0])), ...saved };
  } catch { /* defaults */ }
  return def;
}

export function validShares(s) {
  if (!s || typeof s !== "object") return { ok: false, reason: "shares must be an object" };
  const known = new Set(FAMILIES.map(f => f.key));
  let sum = 0;
  for (const [k, v] of Object.entries(s)) {
    if (!known.has(k)) return { ok: false, reason: `unknown family "${k}"` };
    if (!Number.isInteger(v) || v < 0 || v > 100) return { ok: false, reason: `"${k}" must be a whole percent 0–100` };
    sum += v;
  }
  return sum === 100 ? { ok: true } : { ok: false, reason: `shares total ${sum} %, must be 100 %` };
}

export function setShares(db, s) {
  const v = validShares(s);
  if (!v.ok) throw Object.assign(new Error(v.reason), { status: 400 });
  setSetting(db, SHARES_KEY, JSON.stringify(s));
  return shares(db);
}

export function feedSwitches(db) {
  const on = (k) => { try { return /^(1|on|true)$/i.test(String(getSetting(db, k) ?? "")); } catch { return false; } };
  return { on: on(FEED_ON_KEY), paused: on(FEED_PAUSED_KEY) };
}
export function setFeedSwitch(db, { on = null, paused = null } = {}) {
  if (on != null) setSetting(db, FEED_ON_KEY, on ? "1" : "0");
  if (paused != null) setSetting(db, FEED_PAUSED_KEY, paused ? "1" : "0");
  return feedSwitches(db);
}

/** FEED-1. Every number in jobs (= Hirebase units). */
export function budget(db, { nowMs = Date.now() } = {}) {
  const c = caps(db), used = usedSoFar(db, { nowMs });
  const d = new Date(nowMs);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - d.getUTCDate() + 1;                       // today included
  const usable = Math.floor(c.month * (1 - RESERVE));
  const usedBeforeToday = Math.max(0, used.month - used.day);
  const today = Math.min(c.day, Math.max(0, Math.floor((usable - usedBeforeToday) / daysLeft)));
  const leftToday = Math.max(0, today - used.day);
  const hoursLeft = 24 - d.getUTCHours();                                 // this hour included
  const hour = Math.floor(leftToday / hoursLeft);
  const elapsed = (d.getUTCDate() - 1) / daysInMonth;                     // the pace line: where "on track" sits today
  return { monthCap: c.month, dayCap: c.day, usable, reserve: c.month - usable, usedMonth: used.month, usedToday: used.day,
    daysLeft, today, leftToday, hoursLeft, hour, onTrackBy: Math.round(usable * elapsed) };
}

/** Largest-remainder split of `total` by the shares, in FAMILIES order. Sums to `total` exactly. */
export function split(total, s) {
  const rows = FAMILIES.map(f => { const exact = total * (s[f.key] || 0) / 100; return { key: f.key, n: Math.floor(exact), rem: exact - Math.floor(exact) }; });
  let left = total - rows.reduce((a, r) => a + r.n, 0);
  for (const r of [...rows].sort((a, b) => b.rem - a.rem)) { if (left <= 0) break; if (s[r.key] > 0) { r.n++; left--; } }
  return Object.fromEntries(rows.map(r => [r.key, r.n]));
}

/** FEED-2: the window for the hour containing nowMs — [T − 3 h, T − 2 h). */
export function windowFor(nowMs) {
  const top = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  return { after: iso(top - WINDOW_LAG_MS - WINDOW_MS), before: iso(top - WINDOW_LAG_MS) };
}

// A feed run is an 'incremental' row (migration 270's CHECK on kind has no 'feed'; a table rebuild for one word is not worth a
// production boot) marked feed: 1 in its cursor. runners.runIncremental skips marked rows.
export const FEED_RUN = "kind = 'incremental' AND json_extract(cursor_json, '$.feed') = 1";

function windowDone(db, after) {
  try {
    return !!db.prepare(`SELECT 1 FROM hirebase_runs WHERE ${FEED_RUN} AND dry_run = 0 AND status IN ('done', 'quota', 'refused')
      AND json_extract(cursor_json, '$.after') = ? LIMIT 1`).get(after);
  } catch { return false; }
}

/**
 * FEED-2 + FEED-3: one hour's pull. Returns { skipped } or { runId, window, perFamily }.
 * `force` runs even when the feed switch is off (tests, a one-off admin pull) — the client's own switches still apply.
 */
export async function runFeedHour(db, client, { nowMs = Date.now(), force = false } = {}) {
  const sw = feedSwitches(db);
  if (!force && !sw.on) return { skipped: "feed_off" };
  if (sw.paused) return { skipped: "paused" };
  const win = windowFor(nowMs);
  if (windowDone(db, win.after)) return { skipped: "window_done", window: win };
  const b = budget(db, { nowMs });
  if (b.hour <= 0) return { skipped: "no_budget", window: win, budget: b };
  const s = shares(db), slices = split(b.hour, s);
  const allowed = new Set(requestableCategories());
  const dryRun = client.config.dryRun || !client.config.enabled;
  const runId = Number(db.prepare(`INSERT INTO hirebase_runs (kind, request_json, status, dry_run, cursor_json) VALUES ('incremental', ?, 'running', ?, ?)`)
    .run(JSON.stringify({ window: win, hourBudget: b.hour, slices }), dryRun ? 1 : 0, JSON.stringify({ feed: 1, after: win.after })).lastInsertRowid);
  const perFamily = {};
  let carry = 0, units = 0, pages = 0, stopped = null;
  const order = [...FAMILIES].sort((a, z) => (s[z.key] || 0) - (s[a.key] || 0));
  try {
    for (const f of order) {
      const row = perFamily[f.key] = { share: s[f.key] || 0, slice: slices[f.key] || 0, pulled: 0, new: 0, merged: 0, held: 0, visa: 0, dropped: 0 };
      let allowance = row.slice + carry;
      const cats = f.categories.filter(c => allowed.has(c));
      if (allowance <= 0 || !cats.length) { carry = allowance; continue; }
      for (const visa of [true, false]) {
        for (let page = 1; allowance > 0; page++) {
          const body = { ...buildSearchBody({ categories: cats, daysAgo: 1, ingestedAfter: win.after, sortBy: "first_ingested", sortOrder: "asc",
            skipOurBoards: false, visa, limit: Math.min(100, allowance), page }), ingested_before: win.before };
          const r = await client.search(body);
          if (r.dryRun) { row.dryRunRequest = row.dryRunRequest || r.request; allowance = 0; break; }
          pages++; units += r.units;
          const jobs = r.json?.jobs || [];
          for (const job of jobs) {
            row.pulled++; allowance--;
            if (visa) row.visa++;
            const landed = landHirebaseJob(db, job, { runId });
            row[landed.action === "new" ? "new" : landed.action === "merged" ? "merged" : "dropped"]++;
            if (landed.outOfMarket) row.held++;
          }
          if (!jobs.length || !r.json?.total_pages || page >= r.json.total_pages) break;
        }
      }
      carry = Math.max(0, allowance);
    }
  } catch (e) {
    stopped = e instanceof HirebaseQuotaError ? "quota" : e instanceof HirebaseRefusedError ? "refused" : "failed";
    db.prepare(`UPDATE hirebase_runs SET status = ?, error = ?, counts_json = ?, cursor_json = ?, units_used = ?, pages_done = ?, finished_at = unixepoch() WHERE id = ?`)
      .run(stopped, e.message, JSON.stringify({ perFamily, unspent: carry }), JSON.stringify({ feed: 1, after: win.after }), units, pages, runId);
    return { runId, window: win, perFamily, stopped, error: e.message };
  }
  db.prepare(`UPDATE hirebase_runs SET status = ?, counts_json = ?, cursor_json = ?, units_used = ?, pages_done = ?, finished_at = unixepoch() WHERE id = ?`)
    .run(dryRun ? "dry_run" : "done", JSON.stringify({ perFamily, unspent: carry }), JSON.stringify({ feed: 1, after: win.after }), units, pages, runId);
  return { runId, window: win, perFamily, unspent: carry, dryRun };
}

/** FEED-5: today's table — each family's share, today's slice and what today's feed runs pulled. */
export function feedState(db, { nowMs = Date.now() } = {}) {
  const b = budget(db, { nowMs }), s = shares(db), slices = split(b.today, s);
  const today = dayOf(nowMs);
  const totals = Object.fromEntries(FAMILIES.map(f => [f.key, { pulled: 0, new: 0, merged: 0, held: 0, visa: 0 }]));
  try {
    const rows = db.prepare(`SELECT counts_json FROM hirebase_runs WHERE ${FEED_RUN} AND dry_run = 0 AND date(started_at, 'unixepoch') = ?`).pluck().all(today);
    for (const cj of rows) {
      let c = null; try { c = JSON.parse(cj || "null"); } catch { c = null; }
      for (const [k, v] of Object.entries(c?.perFamily || {})) if (totals[k]) for (const m of Object.keys(totals[k])) totals[k][m] += Number(v[m]) || 0;
    }
  } catch { /* no runs table */ }
  return {
    plan: { name: "Starter", monthJobs: 25000 }, switches: feedSwitches(db), budget: b, window: windowFor(nowMs),
    families: FAMILIES.map(f => ({ key: f.key, label: f.label, share: s[f.key] || 0, todaySlice: slices[f.key] || 0, ...totals[f.key] })),
  };
}

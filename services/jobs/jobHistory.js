// services/jobs/jobHistory.js — ⭐ D107 · IS THIS POSTING ALIVE — repost and age history from the crawl (owner 10-30).
//
// Pattern 3 (Greenhouse, 2025: 18–22 % of postings per quarter are never filled). draft crawls the companies' own job
// systems, so it SEES first seen · last seen · closed · reposted — but scraped_jobs cannot answer it on its own:
// the cleanup DELETEs expired rows (server.js EXPIRED_PREDICATE) and dedup folds others, so the posting a repost
// replaced is usually gone by the time the repost arrives. `job_history` (migration 175) keeps ONE small row per
// posting id that outlives its board row: company / title / location keys, a description signature, and the dates.
//
//   · WRITTEN by `recordJobHistory` — a rollup over scraped_jobs (the 04:00 crawl tick and once after boot), never
//     inside the crawl's upsert transaction. first_seen only ever moves EARLIER, a closed posting that is seen active
//     again re-opens, a posting whose board row is gone is closed at its last sighting.
//   · A REPOST = same company + same title key + same (or no) location + a near-same description (minhash ≥
//     REPOST_SIMILARITY when both have text), first seen at least REPOST_MIN_GAP_DAYS after the earlier one, after the
//     earlier one CLOSED (a week's grace) and within REPOST_WINDOW_DAYS of its last sighting. ⛔ The minimum gap is what keeps one role posted for five
//     cities on the same morning from reading "Reposted 4 times" — those are five postings, not four reposts.
//   · READ by `livenessFor` (one posting) / `livenessForRows` (a board page): plain facts and one sentence — never a
//     score, never a block. D107 P3 (`isStale`) is the only consumer that acts, and only for FULL AUTO / Approve all.

import { companyNameKey } from "../../shared/companyIdentity.js";

const DAY = 86400;
export const REPOST_WINDOW_DAYS = 90;
export const REPOST_MIN_GAP_DAYS = 7;
export const REPOST_SIMILARITY = 0.6;
export const NEW_DAYS = 2;
export const SHOW_OPEN_AFTER_DAYS = 30;
const SIG_HASHES = 32;
const SIG_TEXT_CHARS = 6000;

/** "Senior Software Engineer (R-12345) – Remote" → "senior software engineer". Requisition ids and brackets dropped. */
export function titleKey(title) {
  return String(title ?? "").toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(req|requisition|job)\s*(id|#)?\s*[:#]?\s*[a-z]*-?\d{3,}\b/g, " ")
    .replace(/\b[a-z]{0,3}-?\d{4,}\b/g, " ")
    .replace(/\s[-–—|]\s*(remote|hybrid|on-?site)\s*$/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ").trim().replace(/\s+/g, " ");
}

/** "San Francisco, CA, USA" → "san francisco ca usa"; empty → "" (an unknown location never contradicts). */
export function locationKey(location) {
  return String(location ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** 32-bit FNV-1a — one cheap, stable hash per shingle (md5 per shingle made the first pass take seconds). */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A 32-value minhash over the description's word 3-shingles, as a compact string; null when there is no text. */
export function descSignature(text) {
  const words = String(text ?? "").slice(0, SIG_TEXT_CHARS).toLowerCase().replace(/<[^>]+>/g, " ")
    .split(/[^a-z0-9+#]+/).filter(Boolean);
  if (words.length < 8) return null;
  const mins = new Array(SIG_HASHES).fill(0xffffffff);
  for (let i = 0; i + 2 < words.length; i++) {
    const h = fnv1a(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    for (let k = 0; k < SIG_HASHES; k++) {
      // 32 hash functions from one: mix with the index (murmur3's finaliser — a stable family).
      let m = (h ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
      m = Math.imul(m ^ (m >>> 16), 0x85ebca6b) >>> 0;
      m = Math.imul(m ^ (m >>> 13), 0xc2b2ae35) >>> 0;
      m = (m ^ (m >>> 16)) >>> 0;
      if (m < mins[k]) mins[k] = m;
    }
  }
  return mins.map(n => n.toString(36)).join(".");
}

/** The share of equal minhash slots — an estimate of the two texts' shingle Jaccard. null when either is missing. */
export function signatureSimilarity(a, b) {
  if (!a || !b) return null;
  const x = a.split("."), y = b.split(".");
  if (x.length !== y.length) return null;
  let same = 0;
  for (let i = 0; i < x.length; i++) if (x[i] === y[i]) same++;
  return same / x.length;
}

const toEpoch = (v) => { const t = Date.parse(String(v || "")); return Number.isFinite(t) ? Math.floor(t / 1000) : null; };

/**
 * The rollup. Every scraped_jobs row → its job_history row; rows whose board row is gone are closed.
 * @returns {{ seen: number, closed: number }}
 */
export function recordJobHistory(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const rows = db.prepare(`SELECT job_id, company, title, location, description_full, description, posted_at,
      discovered_at, scraped_at, updated_at, is_active, retired_at FROM scraped_jobs WHERE duplicate_of IS NULL`).iterate();
  const existing = db.prepare(`SELECT desc_sig, title_key FROM job_history WHERE job_id = ?`);
  const upsert = db.prepare(`
    INSERT INTO job_history (job_id, company_key, title_key, loc_key, desc_sig, posted_at, first_seen, last_seen, closed_at)
    VALUES (@job_id, @company_key, @title_key, @loc_key, @desc_sig, @posted_at, @first_seen, @last_seen, @closed_at)
    ON CONFLICT(job_id) DO UPDATE SET
      company_key = excluded.company_key, title_key = excluded.title_key, loc_key = excluded.loc_key,
      desc_sig = COALESCE(excluded.desc_sig, job_history.desc_sig),
      posted_at = COALESCE(job_history.posted_at, excluded.posted_at),
      first_seen = MIN(job_history.first_seen, excluded.first_seen),
      last_seen = MAX(job_history.last_seen, excluded.last_seen),
      closed_at = CASE WHEN excluded.closed_at IS NULL THEN NULL ELSE COALESCE(job_history.closed_at, excluded.closed_at) END`);
  let seen = 0;
  const batch = [];
  for (const r of rows) batch.push(r);
  db.transaction(() => {
    for (const r of batch) {
      const tk = titleKey(r.title);
      const ck = companyNameKey(r.company);
      if (!tk || !ck) continue;
      const prev = existing.get(r.job_id);
      // The signature is computed once per posting (or when its title changed): the text rarely moves, md5 is not free.
      const sig = prev && prev.title_key === tk && prev.desc_sig ? prev.desc_sig : descSignature(r.description_full ?? r.description);
      const first = Math.min(...[r.discovered_at, r.scraped_at, now].filter(Number.isFinite));
      const active = r.is_active === 1;
      const last = active ? Math.max(first, Number.isFinite(r.updated_at) ? r.updated_at : first) : Math.max(first, r.updated_at ?? first);
      upsert.run({ job_id: String(r.job_id), company_key: ck, title_key: tk, loc_key: locationKey(r.location), desc_sig: sig,
        posted_at: toEpoch(r.posted_at), first_seen: first, last_seen: last,
        closed_at: active ? null : (r.retired_at ?? r.updated_at ?? now) });
      seen++;
    }
  })();
  // A posting whose board row was deleted is closed at its last sighting.
  const closed = db.prepare(`UPDATE job_history SET closed_at = last_seen
    WHERE closed_at IS NULL AND job_id NOT IN (SELECT job_id FROM scraped_jobs WHERE duplicate_of IS NULL)`).run().changes;
  return { seen, closed };
}

/** The earlier postings this one is a repost OF, walking back one gap at a time. Oldest first, `row` last. */
function repostChain(row, group) {
  const chain = [row];
  let cur = row;
  const earlier = group.filter(g => g.job_id !== row.job_id && g.first_seen < row.first_seen)
    .sort((a, b) => b.first_seen - a.first_seen);
  for (const g of earlier) {
    if (cur.first_seen - g.first_seen < REPOST_MIN_GAP_DAYS * DAY) continue;
    // A repost REPLACES a posting: one still open when this one appeared is a second opening, not a repost.
    if (g.closed_at == null || g.closed_at > cur.first_seen + REPOST_MIN_GAP_DAYS * DAY) continue;
    if (cur.first_seen - (g.closed_at ?? g.last_seen) > REPOST_WINDOW_DAYS * DAY) break;
    if (cur.loc_key && g.loc_key && cur.loc_key !== g.loc_key) continue;
    const sim = signatureSimilarity(cur.desc_sig, g.desc_sig);
    if (sim != null && sim < REPOST_SIMILARITY) continue;
    chain.unshift(g);
    cur = g;
  }
  return chain;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthOf(epoch, now) {
  const d = new Date(epoch * 1000), n = new Date(now * 1000);
  return d.getUTCFullYear() === n.getUTCFullYear() ? MONTHS[d.getUTCMonth()] : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The facts and the one sentence, from a history row and its company + title group.
 * @returns {{ firstSeen, openDays, reposts, since, label, kind }} kind ∈ reposted | open_long | new | open
 */
export function livenessOf(row, group, { now = Math.floor(Date.now() / 1000) } = {}) {
  const chain = repostChain(row, group);
  const reposts = chain.length - 1;
  const start = Math.min(...[row.first_seen, row.posted_at].filter(Number.isFinite));
  const openDays = Math.max(0, Math.floor((now - start) / DAY));
  const sinceAt = chain[0].first_seen;
  let kind, label;
  if (reposts >= 1) { kind = "reposted"; label = `Reposted ${reposts === 1 ? "once" : `${reposts} times`} since ${monthOf(sinceAt, now)}`; }
  else if (openDays >= SHOW_OPEN_AFTER_DAYS) { kind = "open_long"; label = `Open ${openDays} days`; }
  else if (now - row.first_seen <= NEW_DAYS * DAY && openDays <= NEW_DAYS) {
    kind = "new";
    const d = Math.floor((now - row.first_seen) / DAY);
    label = `New — first seen ${d === 0 ? "today" : "yesterday"}`;
  } else { kind = "open"; label = `Open ${openDays} day${openDays === 1 ? "" : "s"}`; }
  return { firstSeen: row.first_seen, openDays, reposts, since: reposts ? sinceAt : null, label, kind };
}

/** A board row (scraped_jobs columns) as a history row — the fallback before the rollup has seen it. */
function historyFromBoardRow(r, now) {
  const first = Math.min(...[r.discovered_at, r.scraped_at, now].filter(Number.isFinite));
  return { job_id: String(r.job_id), company_key: companyNameKey(r.company), title_key: titleKey(r.title),
    loc_key: locationKey(r.location), desc_sig: null, posted_at: toEpoch(r.posted_at), first_seen: first,
    last_seen: r.updated_at ?? first, closed_at: null };
}

function groupOf(db, companyKey, tk) {
  try {
    return db.prepare(`SELECT * FROM job_history WHERE company_key = ? AND title_key = ? ORDER BY first_seen`).all(companyKey, tk);
  } catch { return []; }   // before migration 175
}

/** One posting's liveness, or null when nothing is known of it. */
export function livenessFor(db, jobId, { now = Math.floor(Date.now() / 1000) } = {}) {
  let row = null;
  try { row = db.prepare(`SELECT * FROM job_history WHERE job_id = ?`).get(String(jobId)); } catch { row = null; }
  if (!row) {
    let b = null;
    try { b = db.prepare(`SELECT job_id, company, title, location, posted_at, discovered_at, scraped_at, updated_at FROM scraped_jobs WHERE job_id = ?`).get(String(jobId)); }
    catch { b = null; }   // a database without those columns knows nothing of the posting's history
    if (!b) return null;
    row = historyFromBoardRow(b, now);
  }
  if (!row.title_key || !row.company_key) return null;
  return livenessOf(row, groupOf(db, row.company_key, row.title_key), { now });
}

/** A board page's rows → Map(job_id → liveness). One indexed read per company + title. */
export function livenessForRows(db, rows, { now = Math.floor(Date.now() / 1000) } = {}) {
  const out = new Map();
  const groups = new Map();
  let byId = new Map();
  try {
    const ids = rows.map(r => String(r.job_id));
    if (ids.length) byId = new Map(db.prepare(`SELECT * FROM job_history WHERE job_id IN (${ids.map(() => "?").join(",")})`).all(...ids).map(h => [h.job_id, h]));
  } catch { byId = new Map(); }
  for (const r of rows) {
    const h = byId.get(String(r.job_id)) || historyFromBoardRow(r, now);
    if (!h.title_key || !h.company_key) continue;
    const gk = `${h.company_key}\u0000${h.title_key}`;
    if (!groups.has(gk)) groups.set(gk, groupOf(db, h.company_key, h.title_key));
    out.set(String(r.job_id), livenessOf(h, groups.get(gk), { now }));
  }
  return out;
}

/**
 * ⛔ D107 P3 · stale by the user's own thresholds (Auto settings: staleReposts, staleOpenDays; null = that check off).
 * Used by FULL AUTO and Approve all only — a stale posting is still shown, opened and applied to by hand.
 */
export function isStale(liveness, { staleReposts = null, staleOpenDays = null } = {}) {
  if (!liveness) return false;
  if (staleReposts != null && liveness.reposts >= staleReposts) return true;
  if (staleOpenDays != null && liveness.openDays > staleOpenDays) return true;
  return false;
}

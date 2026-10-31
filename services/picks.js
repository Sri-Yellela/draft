// services/picks.js — ⭐ D113 (owner 10-31) · REMOTE AUTO-APPLY: picks arrive by message, one tap sends.
//
// The FULL AUTO scheduler (services/autoScheduler.js runAutoTick) is the ONE scheduler. At each user's run times
// (D102 P4's Auto settings — no second settings store) it now builds a RUN of PICKS for both modes:
//
//   "Ask me first"  users.send_mode = 'semi' (D100) + Auto settings `picks: true` → the picks are stored and ONE picks
//                   message goes out (one email through the Resend sender + one Web Push, through services/notify.js'
//                   dispatcher and its per-event switches). Apply / Pass open /p/confirm/<token> (routes/picksConfirm.js).
//   "Apply for me"  users.send_mode = 'auto' (FULL AUTO, D100) → the picks go straight to the run (startAutoRun, the same
//                   admission as every Draft) and ONE summary goes out after the run.
//
// ⛔ A run is ONE row per (user, run time): picks_runs is UNIQUE (user_id, slot_at), the picks are written in the same
// transaction, and the message / the start / the summary are each CLAIMED (a stamp set only where it was NULL) before
// they happen — so a crash or a second tick never creates or sends twice (at most once; a crash after the claim loses
// that one message rather than repeating it).
// ⛔ A tap on Apply = SEND (D113 answer 1) unless "Show me the form before sending" is on. The send authority of a tap is
// the picks row itself (state 'applied', review 0): pickAuthorisesSend is read where FULL AUTO's mode is read — startRun's
// admission, processRunJob's hold and the apply worker's lease — so a SEMI user is sent for ONLY on the job they tapped.
// ⛔ Tailoring (résumé generation) happens in the run, and the run starts only after Apply: building picks calls no model.
import crypto from "node:crypto";
import { companyNameKey } from "../shared/companyIdentity.js";
import { applyLine, levelRank, userLevelRank, yearsLevelRank } from "../shared/postingLevel.js";
import { artifactCurrency } from "./resumeCurrency.js";

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
export const MAX_PICKS_PER_RUN = 25; // POST /api/apply/runs' own limit, as the scheduler's runs always had
export const LEFT_OUT_KEEP_DAYS = 14;
/** A tap's send authority lasts this long — a run started from it that waits in line still sends. */
export const TAP_AUTHORITY_DAYS = 7;
/** An answer link (a question that came back) stays usable this long. */
export const ANSWER_LINK_DAYS = 3;

/** The left-out reasons the run card counts (D113 UI U4), with the words it says. `already_seen` is not "left out". */
export const LEFT_OUT_REASONS = Object.freeze({
  outside_filters: "Outside your filters",
  ineligible: "Not eligible",
  stale: "Stale or reposted",
  daily_cap: "Over today's limit",
  company: "Company limit or paused",
  level: "Above your level",
});
export const PICK_STATES = Object.freeze(["offered", "applied", "passed", "expired", "auto", "start_failed"]);

// ── the user's level (D106) ──────────────────────────────────────────────────────────────────

/**
 * The user's level rank, or null when it is not known. From the profile's years of experience (the same scale readLevel
 * puts a posting's ask on), else its stated seniority. ⛔ Unknown → the level never leaves anything out.
 */
export function userLevelFor(db, userId) {
  let row = null;
  try { row = db.prepare(`SELECT years_of_experience, seniority_level FROM user_profile WHERE user_id = ?`).get(userId); } catch { row = null; }
  if (!row) return null;
  if (row.years_of_experience != null) { const r = yearsLevelRank(row.years_of_experience); if (r != null) return r; }
  return userLevelRank(String(row.seniority_level || "").toLowerCase());
}

/**
 * ⭐ D113 P1 · the level rule: a posting is left out for its level only when the user's level is KNOWN and the posting's
 * text asks two or more steps above it (entry → mid, early → senior) — D106's own "two steps apart" threshold, the point
 * where a title and its ask are said to disagree. A posting with no read, or a user with no level, is never left out.
 */
export function levelOutOfReach(userRank, candidate) {
  if (userRank == null) return false;
  const asked = levelRank(candidate?.levelRead?.read ?? candidate?.levelRead?.level ?? null);
  return asked != null && asked - userRank >= 2;
}

// ── choosing ─────────────────────────────────────────────────────────────────────────────────

/**
 * Which candidates become picks. Pure. Order (D113 P1): already drafted / picked → eligibility (D104: only what the user
 * SET can exclude) → liveness (D107) → level (D106) → RANKED by the ATS match → per-company limit + the pause after an
 * interview → cut to what the daily cap leaves.
 * @param candidates [{ jobId, company, title?, score?, levelRead? }] in the board's order (a tie keeps it)
 * @param ctx { remaining, drafted:Set, companyCounts:Map, pausedCompanies:Set, settings, isIneligible?, isStalePosting?, userLevel? }
 * @returns { take: candidate[], leftOut: [{ jobId, reason }] }
 */
export function choosePicks(candidates, { remaining, drafted = new Set(), companyCounts = new Map(), pausedCompanies = new Set(), settings,
  isIneligible = null, isStalePosting = null, userLevel = null }) {
  const leftOut = [];
  const pool = [];
  for (const c of candidates) {
    const id = String(c.jobId);
    if (drafted.has(id)) { leftOut.push({ jobId: id, reason: "already_seen" }); continue; }
    if (isIneligible?.(c.jobId)) { leftOut.push({ jobId: id, reason: "ineligible" }); continue; }
    if (isStalePosting?.(c.jobId)) { leftOut.push({ jobId: id, reason: "stale" }); continue; }
    if (levelOutOfReach(userLevel, c)) { leftOut.push({ jobId: id, reason: "level" }); continue; }
    pool.push(c);
  }
  const score = (c) => (Number.isFinite(c.score) ? c.score : -1);
  const ranked = pool.map((c, i) => ({ c, i })).sort((a, b) => score(b.c) - score(a.c) || a.i - b.i).map(x => x.c);
  const take = [];
  const counts = new Map(companyCounts);
  const room = Math.max(0, Math.min(remaining, MAX_PICKS_PER_RUN));
  for (const c of ranked) {
    const id = String(c.jobId);
    const key = companyNameKey(c.company || "");
    if (key && settings.pauseCompanyAfterReply && pausedCompanies.has(key)) { leftOut.push({ jobId: id, reason: "company" }); continue; }
    if (key && settings.perCompanyLimit30d != null && (counts.get(key) || 0) >= settings.perCompanyLimit30d) {
      leftOut.push({ jobId: id, reason: "company" }); continue;
    }
    if (take.length >= room) { leftOut.push({ jobId: id, reason: "daily_cap" }); continue; }
    take.push(c);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return { take, leftOut };
}

/** { outside_filters, ineligible, stale, daily_cap, company, level } — every reason present, zero when none. */
export function countLeftOut(leftOut, outsideFilters = 0) {
  const out = Object.fromEntries(Object.keys(LEFT_OUT_REASONS).map(k => [k, 0]));
  out.outside_filters = outsideFilters;
  for (const l of leftOut) if (l.reason in out) out[l.reason]++;
  return out;
}

/** The next run time strictly after `slotSec` (minute precision; a DST jump can move it by an hour, as runDue accepts). */
export function nextSlotAfter(slotSec, settings, localClock) {
  const { minutes } = localClock(slotSec, settings.timeZone);
  const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  let best = 1440;
  for (const t of settings.runTimes) {
    const d = (toMin(t) - minutes + 1440) % 1440;
    if (d > 0 && d < best) best = d;
  }
  return slotSec - (slotSec % 60) + best * 60;
}

// ── storing a run ────────────────────────────────────────────────────────────────────────────

/**
 * Write the run, its picks and its left-out ids in ONE transaction. Returns { run, created } — created false when this
 * (user, run time) already has a run (a second tick, a restart): nothing is written twice.
 */
export function storeRun(db, { userId, slotAt, mode, expiresAt, seen, take, leftOut, outsideFilters = 0, lineFor = () => null, review = false, nowSec = now() }) {
  return db.transaction(() => {
    const ins = db.prepare(`INSERT OR IGNORE INTO picks_runs (user_id, slot_at, mode, seen, picked, left_out_json, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, slotAt, mode, seen, take.length, JSON.stringify(countLeftOut(leftOut, outsideFilters)), expiresAt, nowSec);
    const run = db.prepare(`SELECT * FROM picks_runs WHERE user_id = ? AND slot_at = ?`).get(userId, slotAt);
    if (!ins.changes) return { run, created: false };
    // The run before this one: its offers not acted on are spent — the picks expire at the next run.
    db.prepare(`UPDATE picks SET state = 'expired' WHERE user_id = ? AND state = 'offered' AND run_id != ?`).run(userId, run.id);
    const pick = db.prepare(`INSERT OR IGNORE INTO picks (user_id, run_id, job_id, rank, title, company, line, score, state, review, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    take.forEach((c, i) => {
      const line = lineFor(c);
      pick.run(userId, run.id, String(c.jobId), i + 1, c.title ?? null, c.company ?? null, line?.text ?? null,
        Number.isFinite(c.score) ? c.score : null, mode === "apply" ? "auto" : "offered", mode === "apply" && review ? 1 : 0, expiresAt, nowSec);
    });
    const lo = db.prepare(`INSERT OR IGNORE INTO picks_left_out (run_id, user_id, job_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`);
    for (const l of leftOut) if (l.reason !== "already_seen") lo.run(run.id, userId, l.jobId, l.reason, nowSec);
    return { run, created: true };
  })();
}

/** The one line (D106 P2) for a candidate, from what the scheduler already read. */
export function lineForCandidate(c, { eligibility = null, liveness = null } = {}) {
  try { return applyLine({ score: Number.isFinite(c.score) ? c.score : null, eligibility, liveness, level: c.levelRead ?? null }); }
  catch { return null; }
}

/** Claim a stamp column on a run: true only for the one caller that set it. */
export function claimRun(db, runId, column, nowSec = now()) {
  if (!["delivery_claimed_at", "summary_sent_at", "all_used_at"].includes(column)) throw new Error("bad claim column");
  return db.prepare(`UPDATE picks_runs SET ${column} = ? WHERE id = ? AND ${column} IS NULL`).run(nowSec, runId).changes === 1;
}

/** The left-out ids are kept 14 days; the counts stay on the run. */
export function sweepLeftOut(db, nowSec = now()) {
  try { return db.prepare(`DELETE FROM picks_left_out WHERE created_at < ?`).run(nowSec - LEFT_OUT_KEEP_DAYS * DAY).changes; }
  catch { return 0; }
}

/** Offers past their run's expiry are spent. */
export function expireOffers(db, nowSec = now()) {
  try { return db.prepare(`UPDATE picks SET state = 'expired' WHERE state = 'offered' AND expires_at <= ?`).run(nowSec).changes; }
  catch { return 0; }
}

/**
 * Job ids today's picks hold a slot of the daily cap for — offered (even if the offer has since expired), tapped, or sent
 * for the user. The cap is what a day may OFFER, so a second run time cannot re-fill a day the first one used; a Pass (or
 * a start that was refused) gives its slot back.
 */
export function pickedJobsSince(db, userId, sinceSec) {
  try {
    return db.prepare(`SELECT job_id, created_at FROM picks WHERE user_id = ? AND created_at >= ? AND state IN ('offered', 'applied', 'auto', 'expired')`)
      .all(userId, sinceSec);
  } catch { return []; }
}

/** Every job ever picked for the user — a picked job is never offered again (passed included). */
export function everPicked(db, userId) {
  try { return new Set(db.prepare(`SELECT DISTINCT job_id FROM picks WHERE user_id = ?`).pluck().all(userId).map(String)); }
  catch { return new Set(); }
}

// ── the tap's send authority ─────────────────────────────────────────────────────────────────

/**
 * ⛔ Did the user tap Apply on THIS job (with "Show me the form before sending" off)? Read beside FULL AUTO's mode at the
 * three doors a send passes. A missing table (an old fixture) reads as no.
 */
export function pickAuthorisesSend(db, userId, jobId, nowSec = now()) {
  try {
    return !!db.prepare(`SELECT 1 FROM picks WHERE user_id = ? AND job_id = ? AND state = 'applied' AND review = 0 AND acted_at >= ? LIMIT 1`)
      .get(userId, String(jobId), nowSec - TAP_AUTHORITY_DAYS * DAY);
  } catch { return false; }
}

// ── the confirm link ─────────────────────────────────────────────────────────────────────────

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
export const TOKEN_KINDS = Object.freeze(["apply", "pass", "all", "answer"]);

/** The links' key — derived from the session secret (as the BYOM brief's is), never stored. */
export function pickSecret(sessionSecret) {
  return crypto.createHmac("sha256", String(sessionSecret || "dev-session-secret-change-me")).update("d113-picks-confirm-v1").digest();
}

/**
 * A signed link token: { k: kind, id: pick id (run id for 'all'), u: user id, exp, n: the question round for 'answer' }.
 * HMAC-SHA256 over the payload. Single use is the row's own stamp (picks.token_used_at / picks_runs.all_used_at /
 * picks.question_answered_at), checked when the link acts.
 */
export function signPickToken(secret, { k, id, u, exp, n = 0 }) {
  if (!TOKEN_KINDS.includes(k)) throw new Error("bad token kind");
  const body = b64u(JSON.stringify({ k, id: Number(id), u: Number(u), exp: Number(exp), n: Number(n) || 0 }));
  return `${body}.${b64u(crypto.createHmac("sha256", secret).update(body).digest())}`;
}

/** { ok: true, payload } | { ok: false, error: 'bad_token' | 'expired' } */
export function readPickToken(secret, token, nowSec = now()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || body.length > 400) return { ok: false, error: "bad_token" };
  const want = crypto.createHmac("sha256", secret).update(body).digest();
  const got = fromB64u(sig);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, error: "bad_token" };
  let p;
  try { p = JSON.parse(fromB64u(body).toString("utf8")); } catch { return { ok: false, error: "bad_token" }; }
  if (!TOKEN_KINDS.includes(p?.k) || !Number.isInteger(p.id) || !Number.isInteger(p.u) || !Number.isFinite(p.exp)) return { ok: false, error: "bad_token" };
  if (p.exp <= nowSec) return { ok: false, error: "expired", payload: p };
  return { ok: true, payload: p };
}

// ── the messages ─────────────────────────────────────────────────────────────────────────────

/** The picks message's data: one item per pick with its Apply / Pass links, and the run's Apply all. */
export function picksMessageData(db, run, { secret, appUrl = "" }) {
  const picks = db.prepare(`SELECT * FROM picks WHERE run_id = ? ORDER BY rank`).all(run.id);
  const link = (k, id) => `${appUrl}/p/confirm/${signPickToken(secret, { k, id, u: run.user_id, exp: run.expires_at })}`;
  return {
    count: picks.length,
    expiresAt: run.expires_at,
    items: picks.map(p => ({ title: p.title || "A job", company: p.company || "", line: p.line || "",
      apply: link("apply", p.id), pass: link("pass", p.id) })),
    applyAll: picks.length > 1 ? link("all", run.id) : null,
  };
}

/**
 * Deliver one run — once. Ask me first: the picks message. Apply for me: start the run (the summary comes after it).
 * `deps`: { notify(userId, event, data), startAutoRun(userId, jobIds, { review }), secret, appUrl, settings }.
 */
export async function deliverRun(db, run, deps, nowSec = now()) {
  if (!run || run.delivery_claimed_at != null) return { skipped: "already_delivered" };
  if (run.picked === 0) { claimRun(db, run.id, "delivery_claimed_at", nowSec); return { skipped: "no_picks" }; }
  if (!claimRun(db, run.id, "delivery_claimed_at", nowSec)) return { skipped: "already_delivered" };
  if (run.mode === "ask") {
    const data = picksMessageData(db, run, deps);
    const r = deps.notify ? await deps.notify(run.user_id, "picks", data) : null;
    db.prepare(`UPDATE picks_runs SET delivery_json = ? WHERE id = ?`).run(JSON.stringify({ messaged: true, count: data.count }), run.id);
    return { messaged: true, result: r };
  }
  const jobIds = db.prepare(`SELECT job_id FROM picks WHERE run_id = ? ORDER BY rank`).pluck().all(run.id);
  const review = deps.settings?.showFormBeforeSending === true;
  let r;
  try { r = deps.startAutoRun(run.user_id, jobIds, { review }); } catch (e) { r = { status: 500, body: { error: e.message } }; }
  const ok = r?.status === 202 || r?.status === 200;
  db.prepare(`UPDATE picks_runs SET delivery_json = ?, apply_run_id = ? WHERE id = ?`)
    .run(JSON.stringify({ started: ok, status: r?.status ?? null, error: r?.body?.error ?? null }), r?.body?.runId ?? null, run.id);
  if (!ok) db.prepare(`UPDATE picks SET state = 'start_failed', apply_error = ? WHERE run_id = ? AND state = 'auto'`).run(String(r?.body?.error || "not_started"), run.id);
  return { started: ok ? jobIds.length : 0, status: r?.status ?? null, error: r?.body?.error ?? null };
}

const TERMINAL = new Set(["submitted", "failed", "skipped", "cancelled", "dismissed", "superseded"]);

/** The run-job a pick became (the newest for that job since the pick), or null. */
function runJobOf(db, pick) {
  try {
    return db.prepare(`SELECT rj.id, rj.status, rj.reason_code, rj.reason_detail, rj.open_questions_json,
        (SELECT 1 FROM apply_remote_runs ar WHERE ar.run_job_id = rj.id AND ar.state IN ('queued', 'leased')) AS remote_active
      FROM apply_run_jobs rj WHERE rj.user_id = ? AND rj.job_id = ? AND rj.created_at >= ? ORDER BY rj.id DESC LIMIT 1`)
      .get(pick.user_id, pick.job_id, pick.created_at - 60);
  } catch { return null; }
}

/**
 * ⭐ Apply for me · ONE summary after each run — when every job it started has finished (sent, stopped or waiting on the
 * user), or at the next run time at the latest. "Sent 4 today; 1 question."
 */
export async function runPickSummaries(db, { notify, nowSec = now() } = {}) {
  const out = [];
  let runs = [];
  try {
    runs = db.prepare(`SELECT * FROM picks_runs WHERE mode = 'apply' AND picked > 0 AND delivery_claimed_at IS NOT NULL
      AND summary_sent_at IS NULL AND created_at >= ?`).all(nowSec - 3 * DAY);
  } catch { return out; }
  for (const run of runs) {
    const picks = db.prepare(`SELECT * FROM picks WHERE run_id = ? AND state = 'auto'`).all(run.id);
    let sent = 0, waiting = 0, working = 0;
    for (const p of picks) {
      const rj = runJobOf(db, p);
      if (!rj) { working++; continue; }
      if (rj.status === "submitted") sent++;
      else if ((rj.status === "held_review" || rj.status === "held_gate") && !rj.remote_active) waiting++;
      else if (!TERMINAL.has(rj.status)) working++;
    }
    const due = working === 0 || run.expires_at <= nowSec;
    if (!due) continue;
    if (!claimRun(db, run.id, "summary_sent_at", nowSec)) continue;
    const result = notify ? await notify(run.user_id, "picks_summary", { sent, waiting, picked: run.picked }) : null;
    out.push({ userId: run.user_id, runId: run.id, sent, waiting, result });
  }
  return out;
}

/**
 * ⭐ D113 P4 · a question the run cannot answer COMES BACK: a tapped (or sent-for-you) pick whose run-job stopped at
 * Needs you with questions gets ONE message per round, with a link to answer on the confirm page.
 */
export async function runPickQuestions(db, { notify, secret, appUrl = "", nowSec = now() } = {}) {
  const out = [];
  let picks = [];
  try {
    picks = db.prepare(`SELECT * FROM picks WHERE state IN ('applied', 'auto') AND created_at >= ?`).all(nowSec - 14 * DAY);
  } catch { return out; }
  for (const p of picks) {
    // One round at a time: a question already sent and not yet answered is not sent again.
    if (p.question_sent_at != null && (p.question_answered_at == null || p.question_answered_at < p.question_sent_at)) continue;
    const rj = runJobOf(db, p);
    if (!rj || rj.status !== "held_review" || !rj.open_questions_json) continue;
    let qs = [];
    try { qs = JSON.parse(rj.open_questions_json) || []; } catch { qs = []; }
    if (!qs.length) continue;
    const took = db.prepare(`UPDATE picks SET question_sent_at = ? WHERE id = ? AND (question_sent_at IS NULL OR question_sent_at <= COALESCE(question_answered_at, 0))`)
      .run(nowSec, p.id);
    if (!took.changes) continue;
    const token = signPickToken(secret, { k: "answer", id: p.id, u: p.user_id, exp: nowSec + ANSWER_LINK_DAYS * DAY, n: nowSec });
    const result = notify ? await notify(p.user_id, "pick_question", { count: qs.length, title: p.title || "A job",
      company: p.company || "", questions: qs.slice(0, 5).map(q => String(q.question || "").slice(0, 200)),
      answer: `${appUrl}/p/confirm/${token}` }) : null;
    out.push({ userId: p.user_id, pickId: p.id, questions: qs.length, result });
  }
  return out;
}

/** The open questions of the run-job a pick became — what the answer page asks. */
export function questionsForPick(db, pick) {
  const rj = runJobOf(db, pick);
  if (!rj || rj.status !== "held_review" || !rj.open_questions_json) return [];
  try { return (JSON.parse(rj.open_questions_json) || []).filter(q => q && String(q.question || "").trim()); } catch { return []; }
}

// ── reads for the app (the Draft House tree, D113 UI) ────────────────────────────────────────

const parse = (s, d) => { try { return JSON.parse(s ?? "") ?? d; } catch { return d; } };

/** A pick as the app shows it. Never a token. */
export function publicPick(p) {
  return { id: p.id, runId: p.run_id, jobId: p.job_id, rank: p.rank, title: p.title, company: p.company, line: p.line,
    score: p.score, state: p.state, review: p.review === 1, actedAt: p.acted_at, expiresAt: p.expires_at,
    applyError: p.apply_error ?? null, questionSentAt: p.question_sent_at ?? null };
}

/** A run as the app shows it: the counts by reason, the picks. */
export function publicRun(db, run, { withPicks = true } = {}) {
  const leftOut = parse(run.left_out_json, {});
  const leftOutTotal = Object.values(leftOut).reduce((a, b) => a + (Number(b) || 0), 0);
  return {
    id: run.id, slotAt: run.slot_at, mode: run.mode, seen: run.seen, picked: run.picked, leftOut, leftOutTotal,
    expiresAt: run.expires_at, deliveredAt: run.delivery_claimed_at, summarySentAt: run.summary_sent_at,
    delivery: parse(run.delivery_json, null), createdAt: run.created_at,
    // resumeReady: "Your résumé for it" says made / not made — a current tailored résumé exists (Make it now, or a run).
    ...(withPicks ? { picks: db.prepare(`SELECT * FROM picks WHERE run_id = ? ORDER BY rank`).all(run.id)
      .map(p => ({ ...publicPick(p), resumeReady: artifactCurrency(db, { userId: run.user_id, jobId: p.job_id }).current })) } : {}),
  };
}

export function listRuns(db, userId, { limit = 20, before = null } = {}) {
  const n = Math.max(1, Math.min(50, Number(limit) || 20));
  const rows = before
    ? db.prepare(`SELECT * FROM picks_runs WHERE user_id = ? AND slot_at < ? ORDER BY slot_at DESC LIMIT ?`).all(userId, Number(before), n)
    : db.prepare(`SELECT * FROM picks_runs WHERE user_id = ? ORDER BY slot_at DESC LIMIT ?`).all(userId, n);
  return rows.map(r => publicRun(db, r));
}

/** The postings a run left out (kept 14 days), with the reason — "See what was left out". */
export function leftOutFor(db, userId, runId) {
  const run = db.prepare(`SELECT * FROM picks_runs WHERE id = ? AND user_id = ?`).get(Number(runId), userId);
  if (!run) return null;
  const rows = db.prepare(`SELECT lo.job_id, lo.reason, sj.title, sj.company FROM picks_left_out lo
    LEFT JOIN scraped_jobs sj ON sj.job_id = lo.job_id WHERE lo.run_id = ? AND lo.user_id = ? ORDER BY lo.reason, lo.job_id`).all(run.id, userId);
  return { run: publicRun(db, run, { withPicks: false }), kept: rows.length > 0 || run.created_at >= now() - LEFT_OUT_KEEP_DAYS * DAY,
    jobs: rows.map(r => ({ jobId: r.job_id, reason: r.reason, reasonLabel: LEFT_OUT_REASONS[r.reason] || r.reason, title: r.title ?? null, company: r.company ?? null })) };
}

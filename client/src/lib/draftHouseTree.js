// ============================================================
// draftHouseTree — Draft House as a tree, as data (D113 UI, owner 10-31)
// ============================================================
// The page is a VERTICAL TREE THAT GROWS INLINE with a side column for what matters now
// (docs/sketches/draft-house-tree.html; the WORKLOG row wins where the two differ). This module is
// the tree's rules, pure, so node can test them without a browser and the panel cannot grow a second
// opinion about them:
//
//   RINGS        the seven ring states (U2), each a colour TOKEN, never a colour.
//   ringFor      D102's ladder → one ring. ⛔ No second status model: the ladder is
//                shared/applicationStatus.js and every status maps to exactly one ring.
//   buildNodes   one node per JOB from the feeds AutoApplyContext already loads (+ D113's picks).
//   buildTree    the nodes hung on their runs (D113's stored runs), the rest grouped by day.
//   treeView     the filter + search (U6): in All a miss is dimmed; elsewhere a run with no match hides.
//   sideBlocks   the side column (U7), in its order, each hidden when empty except Needs you.
//   branchStep   one branch open at a time (U4); Escape closes.
//   answerRows   the Answers leaf: a guess flagged "read this", the user's own statement never filled.
//
// ⛔ No second exceptions model either: what is held, broke or waiting is still decided by
// lib/applyObstacles.js (groupByApplication, splitByFault) and lib/draftHouseExceptions.js
// (packetLife) — this module only says which ring and which sentence.
// ============================================================
import { LADDER, ladderStatus } from "../../../shared/applicationStatus.js";
import { NEVER_FILL_RE } from "../../../shared/answerKey.js";
import { RINGS, RING_ORDER } from "../styles/rings.js";
import { filterItems } from "./draftHouseExceptions.js";

// U2 · the seven rings live with the bubble standard (styles/rings.js); re-exported for the tree.
export { RINGS, RING_ORDER };

/** D102's ladder → the ring. Every ladder status is here exactly once (test/d113uiRingFromLadder). */
export const LADDER_RING = Object.freeze({
  queued: "work", in_flight: "work",
  needs_you: "need",
  ready_to_approve: "review",
  submitted: "sent",
  interview: "reply", assessment: "reply", offer: "reply", rejected: "reply",
  // D113 UI (owner 10-31): Withdrawn is Stopped's red ring, named "Withdrawn" (ringLabel) — the user ended it.
  withdrawn: "stop",
  failed: "stop", skipped: "stop",
});
/** A status whose ring is shared but whose WORD is its own (the lead card and the bubble's name say it). */
export const RING_LABEL_FOR_STATUS = Object.freeze({ withdrawn: "Withdrawn" });
/** The word a node's ring says: its status's own word where it has one, else the ring's. */
export const ringLabelOf = (node) => RING_LABEL_FOR_STATUS[node?.status] || RINGS[node?.ring]?.label || "";
export function ringFor(status) {
  return LADDER.includes(status) ? LADDER_RING[status] : null;
}

/** U6 · the filters over the tree, in order. */
export const FILTERS = Object.freeze([
  ["all", "All"], ["mine", "Needs you"], ["work", "Running"], ["done", "Sent and replies"], ["stop", "Stopped"],
]);
const FILTER_RINGS = Object.freeze({ mine: ["need", "review", "pick"], work: ["work"], done: ["sent", "reply"], stop: ["stop"] });

const ms = (t) => {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n; // seconds (sqlite unixepoch) or milliseconds (toMs)
};
const s = (v) => (v == null ? "" : String(v));

// ── the sentence per state (U5). Copy is the sketch's, tightened, never lengthened. ─────────────

function sentDay(at, now) {
  if (!at) return "Sent. No reply yet.";
  const d = dayLabel(at, now);
  return `Sent ${d === "Today" || d === "Yesterday" ? d.toLowerCase() : d}. No reply yet.`;
}

/**
 * One node per job. Each feed contributes what it knows; a job seen in two feeds keeps the LIVE one
 * (the order below), so a re-drafted job is never two bubbles.
 */
export function buildNodes({
  pending = [], heldApplications = [], gatedJobs = [], inFlight = [], line = { waiting: [] },
  brokeApplications = [], tableRows = [], picks = [], questions = [], packetFor = null,
  companyLabel = (c) => c || "Unknown company", now = Date.now(),
} = {}) {
  const byJob = new Map();
  const put = (node) => {
    const k = node.jobId != null ? `job:${node.jobId}` : node.key;
    if (!byJob.has(k)) byJob.set(k, node);
  };
  const questionFor = (jobId) => (questions || []).find(q => (q.blocking || []).some(b => String(b.jobId) === String(jobId)));

  for (const p of pending) {
    const st = ladderStatus({ runJobStatus: "held_review", reasonCode: "awaiting_approval" }).status;
    put({ key: `approval-${p.runJobId}`, kind: "approval", jobId: p.jobId ?? null, runJobId: p.runJobId,
      company: companyLabel(p.company), title: s(p.title), status: st, ring: ringFor(st), at: ms(p.createdAt), ref: p,
      say: "Filled and ready. Read it, then send it." });
  }
  for (const app of heldApplications) {
    const row = app.primary?.row || {};
    const st = ladderStatus({ runJobStatus: "held_review", reasonCode: row.reasonCode ?? "held" }).status;
    const q = questionFor(app.jobId);
    const packet = packetFor ? (packetFor(app.primary?.row) || packetFor(app)) : null;
    const missing = row.missingRequired || [];
    let say, why;
    if (app.postingGone || packet?.postingGone) { say = "Stopped: the company took the posting down."; why = "gone"; }
    else if (q) { say = `One question it couldn't answer: ${q.question}. Then it sends.`; why = "question"; }
    else if (missing.length) { say = `${missing.length} required field${missing.length === 1 ? "" : "s"} had no answer it could use.`; why = "empty"; }
    else if (packet && (packet.stale || !(Number(packet.staleAfterMs) - Number(packet.ageMs) > 0))) { say = "The prepared answers have gone stale."; why = "stale"; }
    else { say = (app.reasons || []).map(r => r?.obstacle).find(x => typeof x === "string" && x) || "Stopped and waiting for you."; why = "held"; }
    // A posting that is gone is a dead end, not a question: it reads Stopped.
    const ring = why === "gone" ? "stop" : ringFor(st);
    put({ key: `held-${app.key}`, kind: "held", why, jobId: app.jobId ?? null, company: companyLabel(app.company), title: s(app.title),
      status: why === "gone" ? "failed" : st, ring, at: ms(row.createdAt), ref: app, question: q || null, say });
  }
  for (const j of gatedJobs) {
    const st = ladderStatus({ runJobStatus: "held_gate" }).status;
    put({ key: `gated-${j.id}`, kind: "gated", jobId: j.jobId ?? null, company: companyLabel(j.company), title: s(j.title),
      status: st, ring: ringFor(st), at: ms(j.createdAt), ref: j,
      say: "The company's site wants you signed in." });
  }
  for (const j of inFlight) {
    const st = ladderStatus({ runJobStatus: j.status === "queued" ? "queued" : "running" }).status;
    put({ key: `flight-${j.id}`, kind: "inflight", jobId: j.jobId ?? null, company: companyLabel(j.company), title: s(j.title),
      status: st, ring: ringFor(st), at: ms(j.startedAt || j.createdAt), ref: j,
      say: j.status === "running" ? "Filling the form now. Nothing needed from you." : "Starting soon. Nothing needed from you." });
  }
  for (const run of line?.waiting || []) {
    for (const j of run.jobs || []) {
      const st = ladderStatus({ runJobStatus: "waiting" }).status;
      put({ key: `line-${run.runId ?? run.id}-${j.jobId}`, kind: "line", jobId: j.jobId ?? null, company: companyLabel(j.company), title: s(j.title),
        status: st, ring: ringFor(st), at: ms(run.createdAt || j.createdAt), ref: { run, job: j },
        say: "Waiting in line. You can still change it." });
    }
  }
  for (const app of brokeApplications) {
    const lead = app.primary || {};
    const row = lead.row || {};
    const unconfirmed = /verif|confirm/i.test(s(row.reasonCode));
    put({ key: `broke-${app.key}`, kind: "broke", why: unconfirmed ? "noconfirm" : "failed", jobId: app.jobId ?? null,
      company: companyLabel(app.company), title: s(app.title), status: "failed", ring: ringFor("failed"),
      at: ms(row.finishedAt || row.createdAt), ref: app,
      say: unconfirmed ? "Stopped: it pressed Submit but saw no confirmation." : `Stopped: ${lead.obstacle ? String(lead.obstacle).replace(/[.!?]?$/, ".") : "it did not complete. Nothing was sent."}` });
  }
  for (const r of tableRows) {
    const ring = ringFor(r.status);
    if (ring !== "sent" && ring !== "reply" && r.status !== "withdrawn") continue;
    const at = ms(r.updatedAt);
    const say = r.status === "interview" ? "They want to interview you."
      : r.status === "assessment" ? "They sent an online assessment."
      : r.status === "offer" ? "They made you an offer."
      : r.status === "rejected" ? "They said no. It's closed."
      : r.status === "withdrawn" ? "You withdrew it. It's closed."
      : sentDay(at, now);
    put({ key: `table-${r.id}`, kind: r.status === "withdrawn" ? "withdrawn" : ring === "sent" ? "sent" : "reply", jobId: r.jobId ?? null, applicationId: r.id,
      company: companyLabel(r.company), title: s(r.title), status: r.status, ring, at, ref: r, say });
  }
  for (const p of picks) {
    if (p.state === "passed" || p.state === "expired") continue;
    const failed = p.state === "start_failed";
    const ring = p.state === "offered" ? "pick" : failed ? "stop" : "work";
    put({ key: `pick-${p.id}`, kind: "pick", jobId: p.jobId ?? null, pickId: p.id, runId: p.runId,
      company: companyLabel(p.company), title: s(p.title), status: p.state === "offered" ? "picked" : failed ? "failed" : "queued",
      ring, at: null, ref: p, line: p.line || null,
      say: p.state === "offered" ? "Picked. Nothing is sent until you say so."
        : failed ? "Stopped: it could not start." : "You tapped Apply. Starting soon." });
  }
  return [...byJob.values()];
}

// ── days, times and the next run ─────────────────────────────────────────────────────────────

const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/** "Today" · "Yesterday" · "Thu 29". */
export function dayLabel(t, now = Date.now()) {
  if (!t) return "Earlier";
  const d = new Date(t), n = new Date(now);
  const y = new Date(now - 86400000);
  if (dayKey(d) === dayKey(n)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getDate()}`;
}

/** "5 PM" · "8:30 AM". */
export function timeLabel(t, timeZone) {
  if (!t) return "";
  const opt = { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) };
  let out;
  try { out = new Date(t).toLocaleTimeString("en-US", opt); } catch { out = new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  return out.replace(":00", "");
}

/** Minutes past midnight in `timeZone` (the user's, from Auto settings). */
function minutesIn(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(timeZone ? { timeZone } : {}) })
      .formatToParts(new Date(now));
    const h = Number(parts.find(p => p.type === "hour")?.value), m = Number(parts.find(p => p.type === "minute")?.value);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  } catch { /* an unknown zone falls through to local time */ }
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * The next run time from Auto settings' run times — the fallback when D113's runs route does not say
 * (it 404s, or sends no `nextRunAt`). Null with no run times.
 */
export function nextRunFromSettings(settings, now = Date.now()) {
  const times = Array.isArray(settings?.runTimes) ? settings.runTimes.filter(t => /^\d\d:\d\d$/.test(t)) : [];
  if (!times.length) return null;
  const cur = minutesIn(now, settings.timeZone);
  let best = null;
  for (const t of times) {
    const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const d = (m - cur + 1440) % 1440 || 1440;
    if (best == null || d < best) best = d;
  }
  return Math.floor(now / 60000) * 60000 + best * 60000;
}

// ── the tree ─────────────────────────────────────────────────────────────────────────────────

/**
 * The runs, newest first, each with its nodes. `runs` are D113's stored runs (publicRun) — null or []
 * when the route is not there yet; then every node is grouped by the DAY it was drafted ("Drafted by
 * you"), which is what the tree shows until the first run is stored. `nextRunAt` (ms) puts the dashed
 * square at the top.
 */
export function buildTree({ runs = null, nodes = [], nextRunAt = null, timeZone, now = Date.now() } = {}) {
  const pool = new Map(nodes.map(n => [n.jobId != null ? `job:${n.jobId}` : n.key, n]));
  const out = [];
  for (const r of runs || []) {
    const at = ms(r.slotAt) || ms(r.createdAt);
    const mine = [];
    for (const p of r.picks || []) {
      const k = `job:${p.jobId}`;
      const n = pool.get(k);
      if (n) { pool.delete(k); mine.push({ ...n, runId: r.id }); }
    }
    out.push({ key: `run-${r.id}`, id: r.id, real: true, at, day: dayLabel(at, now), time: timeLabel(at, timeZone),
      seen: Number(r.seen) || 0, picked: Number(r.picked) || 0, leftOut: r.leftOut || {},
      leftOutTotal: Number(r.leftOutTotal) || Object.values(r.leftOut || {}).reduce((a, b) => a + (Number(b) || 0), 0),
      mode: r.mode || null, nodes: mine });
  }
  const days = new Map();
  for (const n of pool.values()) {
    const k = n.at ? dayKey(n.at) : "earlier";
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(n);
  }
  for (const [k, list] of days) {
    list.sort((a, b) => (b.at || 0) - (a.at || 0));
    const at = list[0].at || 0;
    out.push({ key: `day-${k}`, id: null, real: false, at, day: dayLabel(at || null, now), time: at ? timeLabel(at, timeZone) : "", nodes: list });
  }
  out.sort((a, b) => (b.at || 0) - (a.at || 0));
  if (nextRunAt) {
    out.unshift({ key: "next", id: null, real: false, future: true, at: nextRunAt, day: dayLabel(nextRunAt, now),
      time: timeLabel(nextRunAt, timeZone), nodes: [] });
  }
  return out;
}

/** The words a search reads: company, title, and the node's own sentence (the reason). */
export function matchesSearch(node, q) {
  // The same narrowing Stopped always had (draftHouseExceptions.filterItems): one search, not two.
  return filterItems([{ title: `${node.company} ${node.title}`, sub: node.say }], q).length > 0;
}
export function inFilter(node, filter) {
  return filter === "all" || (FILTER_RINGS[filter] || []).includes(node.ring);
}

/**
 * U6 · what the tree shows. In All every node stays and a search MISS is dimmed; in any other filter
 * only the matches show, and a run with none is hidden. The next-run square is always shown.
 * @returns [{ run, items: [{ node, dim }] }]
 */
export function treeView(tree, { filter = "all", q = "" } = {}) {
  const out = [];
  for (const run of tree) {
    if (run.future) { out.push({ run, items: [] }); continue; }
    if (filter === "all") {
      out.push({ run, items: run.nodes.map(node => ({ node, dim: !matchesSearch(node, q) })) });
      continue;
    }
    const items = run.nodes.filter(n => inFilter(n, filter) && matchesSearch(n, q)).map(node => ({ node, dim: false }));
    if (items.length) out.push({ run, items });
  }
  return out;
}

// ── the side column ──────────────────────────────────────────────────────────────────────────

export const SIDE_ORDER = Object.freeze(["connections", "needs", "review", "running", "replies", "tidy"]);
export const TIDY_DAYS = 7;

/**
 * U7 · the side column, in order. Every block but Needs you is left out when it is empty.
 * `connections` are broken connections (a sign-in, Gmail) — one line and the fix each.
 */
export function sideBlocks({ nodes = [], connections = [], binCount = 0, now = Date.now() } = {}) {
  const ring = (r) => nodes.filter(n => n.ring === r);
  // A withdrawn application wears Stopped's ring but is a record, not a stopped job to clear.
  const old = nodes.filter(n => n.ring === "stop" && n.kind !== "withdrawn" && n.at && now - n.at > TIDY_DAYS * 86400000);
  const blocks = [
    { id: "connections", items: connections },
    // Questions, sign-ins and holds first, then the picks waiting for Apply.
    { id: "needs", items: [...ring("need"), ...ring("pick")] },
    { id: "review", items: ring("review") },
    { id: "running", items: ring("work") },
    { id: "replies", items: ring("reply").filter(n => n.status !== "rejected") },
    { id: "tidy", items: old, count: old.length, binCount },
  ];
  return blocks.filter(b => b.id === "needs" || (b.id === "tidy" ? (b.count > 0 || binCount > 0) : b.items.length > 0));
}

// ── branches and leaves ──────────────────────────────────────────────────────────────────────

/**
 * U4 · ONE branch open at a time. `open` is null or { type: "run"|"job", key }. Opening another
 * closes the first; opening the open one closes it; Escape closes.
 */
export function branchStep(open, action) {
  if (!action || action.type === "escape" || action.type === "close") return null;
  if (open && open.type === action.type && open.key === action.key) return action.toggle === false ? open : null;
  return { type: action.type, key: action.key };
}

/**
 * A leaf's data loads only when the leaf is OPENED (U4), once, and is kept while the page lives.
 * `loader(key)` returns a promise; `get(key)` → { state: "idle"|"loading"|"ready"|"error", data, error }.
 */
export function createLeafCache(loader) {
  const entries = new Map();
  return {
    get(key) { return entries.get(key) || { state: "idle" }; },
    open(key, onChange) {
      if (entries.has(key)) return entries.get(key);
      const e = { state: "loading" };
      entries.set(key, e);
      Promise.resolve().then(() => loader(key)).then(
        (data) => { entries.set(key, { state: "ready", data }); onChange?.(); },
        (err) => { entries.set(key, { state: "error", error: err?.message || "Could not load it." }); onChange?.(); });
      return e;
    },
  };
}

/** ⛔ The user's OWN statement — an attestation, a consent, a signature (shared/answerKey.js NEVER_FILL_RE) or an eligibility question. */
export function isOwnStatement(a, openQuestions = []) {
  const label = s(a?.label || a?.name || a?.question);
  if (a?.eligibility) return true;
  if (NEVER_FILL_RE.test(label)) return true;
  return (openQuestions || []).some(q => q?.eligibility && s(q.question).trim() === label.trim());
}

/**
 * The Answers leaf: every field and the value that went in. A guess (a loose label match) is flagged
 * "read this". ⛔ The user's own statements are MARKED and their value is NEVER shown as filled —
 * "left for you" — whatever the record holds: draft never makes them for the person.
 */
export function answerRows(answers = [], openQuestions = []) {
  const rows = [];
  for (const a of answers || []) {
    if (!a || a.skipped || a.policy_rejected) continue;
    const own = isOwnStatement(a, openQuestions);
    rows.push({
      label: s(a.label || a.name || a.field_id),
      value: own ? null : s(a.value),
      shown: own ? "left for you" : s(a.value),
      own, guess: !own && a.provenance === "label_fuzzy",
    });
  }
  for (const q of openQuestions || []) {
    const label = s(q?.question);
    if (!label || rows.some(r => r.label === label)) continue;
    const own = isOwnStatement(q, openQuestions);
    rows.push({ label, value: null, shown: own ? "left for you" : "waiting for your answer", own, guess: false, asked: true });
  }
  return rows;
}

/**
 * ⛔ What a question's inline box shows. A low-confidence guess is shown to be confirmed (accepting it is
 * the answer) — but the user's OWN statement never shows a value the system put there: a seeded
 * proposal reads as empty, so only what the person typed can ever be sent.
 */
export function inlineAnswerStart(q, draft = "") {
  if (!q) return "";
  const d = s(draft);
  if (isOwnStatement(q, [q]) && q.proposed != null && d === s(q.proposed)) return "";
  return d;
}

/** U4 (a) · the run card's counts by reason, largest first, zeros left out. */
export const LEFT_OUT_LABELS = Object.freeze({
  outside_filters: "outside your filters", ineligible: "not eligible", stale: "stale or reposted",
  daily_cap: "over today's limit", company: "company limit or paused", level: "above your level",
});
export function leftOutLines(leftOut = {}) {
  return Object.entries(leftOut || {})
    .map(([reason, n]) => ({ reason, n: Number(n) || 0, label: LEFT_OUT_LABELS[reason] || reason.replace(/_/g, " ") }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

/**
 * U7 · the side column's first block from buildStoppedItems (lib/draftHouseExceptions.js — the one
 * exceptions model): what blocks EVERY application (a missing profile field) and what one sign-in
 * releases for many (a portal batch). One line and the fix each.
 */
export function connectionsFromStopped(items = []) {
  return (items || []).filter(i => i.kind === "prerequisite" || i.kind === "portal").map(i => ({
    key: i.key, kind: i.kind, ref: i.ref, title: i.title, sub: i.sub,
    fix: i.kind, fixLabel: i.kind === "prerequisite" ? "Fix it"
      : (i.ref?.gateReasons || []).includes("captcha_required") ? "Open them" : "Sign in",
  }));
}

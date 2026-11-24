// ⭐ D146 · ONE APPLICATION TRACKER — what each row says, and where (owner 11-03: "merge them … a single application
// tracker that has all the capabilities"). One pure module, as D145's deckCardFacts is for the deck card, so "one
// meaning per filter", "actions by stage" and "nothing said twice" are properties a test can hold.
//
//   ROWS      Draft House's nodes (lib/draftHouseTree.js buildNodes — approvals, holds, sign-ins, runs, the line, picks,
//             the pipeline's sent rows) MERGED with The Table's history rows (shared/applicationHistory.js — pending
//             you-applied records, imported and recorded applications, Not applied). One row per job; the live node
//             wins, the history row fills in what it knows (the résumé, the reply question, the record).
//   STAGE     one per row, from the node's kind / ring / ladder status, or the history row's status. ⛔ No third status
//             model: every stage is read from those two.
//   FILTERS   All · Needs you · In progress · Sent · Replies · Stopped — each stage in exactly one.
//   COUNTS    needs you · in progress · sent · replied · interview (D145's one quiet row).
//   COLUMNS   Position · Résumé · Answers · Status · When — Status is a dot + a word, never a capsule (D60).
//   OPENED    the accent eyebrow + the headline for the stage; then the on-demand panes (The posting · Résumé ·
//             Answers · Emails); then the stage's own actions.
//   TIMELINE  which rings pulse (Needs you · Ready · Working — styles/rings.js), and nothing else.
import { RINGS } from "../styles/rings.js";
import { interviewLine } from "./draftHouseTree.js";

// ⭐ 47c (home-sketch.html, approved 11-23): Ready to send is its own filter beside Needs you, as the sketch draws it; the
// counts row and the dock badge still count it as needing the person (trackerCounts).
export const TRACKER_FILTERS = Object.freeze([
  ["all", "All"], ["needs", "Needs you"], ["ready", "Ready to send"], ["progress", "In progress"], ["sent", "Sent"], ["replies", "Replies"], ["stopped", "Stopped"],
]);
/** The one row of counts, in order. `accent` marks the one drawn in the accent. */
export const TRACKER_COUNTS = Object.freeze([
  { id: "needs", label: "needs you", accent: true }, { id: "progress", label: "in progress" }, { id: "sent", label: "sent" },
  { id: "replied", label: "replied" }, { id: "interview", label: "interview" },
]);
export const TRACKER_COLUMNS = Object.freeze([
  { key: "position", label: "Position" }, { key: "resume", label: "Résumé" }, { key: "answers", label: "Answers" },
  { key: "status", label: "Status" }, { key: "when", label: "When" },
]);
export const TRACKER_PANES = Object.freeze([["posting", "The posting"], ["resume", "Résumé"], ["answers", "Answers"], ["emails", "Emails"]]);
/** The period in the filter row. Days back from now; null = any time. */
export const TRACKER_PERIODS = Object.freeze([["any", "Any time", null], ["7", "Last 7 days", 7], ["30", "Last 30 days", 30], ["90", "Last 90 days", 90]]);

/**
 * Every stage: its filter (exactly one), the word the Status column says, the ring its dot is drawn in, the eyebrow
 * of the opened row (D182: null where it would only repeat the status word), and the stage's own actions (ids the panel wires — lib order is the order shown).
 */
export const STAGES = Object.freeze({
  question:     { filter: "needs",    word: "Needs you",      ring: "need",   eyebrow: "Only you can answer this", actions: ["answer", "skip"] },
  needs:        { filter: "needs",    word: "Needs you",      ring: "need",   eyebrow: "Waiting for you",          actions: ["open", "signin", "prepare", "again", "check", "yourself", "skip"] },
  ready:        { filter: "ready",    word: "Ready to send",  ring: "review", eyebrow: null,                       actions: ["approve", "edit", "form", "reject", "skip"] },
  picked:       { filter: "needs",    word: "Picked",         ring: "pick",   eyebrow: "Picked for you",           actions: ["apply", "pass"] },
  working:      { filter: "progress", word: "Filling",        ring: "work",   eyebrow: "Working on it",            actions: ["stop"] },
  waiting:      { filter: "progress", word: "Waiting in line", ring: "work",  eyebrow: "In line",                  actions: ["remove"] },
  pending_self: { filter: "progress", word: "Did you apply?", ring: "pick",   eyebrow: "You opened it to apply",   actions: ["record", "did_not_apply"] },
  sent:         { filter: "sent",     word: "Sent",           ring: "sent",   eyebrow: null,                       actions: ["heard", "reply_ask", "withdraw"] },
  interview:    { filter: "replies",  word: "Interview",      ring: "reply",  eyebrow: null,                       actions: ["prepare_interview", "date", "withdraw"] },
  assessment:   { filter: "replies",  word: "Assessment",     ring: "reply",  eyebrow: null,                       actions: ["prepare_interview", "date", "withdraw"] },
  offer:        { filter: "replies",  word: "Offer",          ring: "reply",  eyebrow: "An offer",                 actions: ["open_reply", "withdraw"] },
  rejected:     { filter: "replies",  word: "Not selected",   ring: "reply",  eyebrow: "They said no",             actions: ["note"] },
  no_reply:     { filter: "sent",     word: "No reply",       ring: "sent",   eyebrow: null,                       actions: ["reply_ask"] },
  withdrawn:    { filter: "stopped",  word: "Withdrawn",      ring: "stop",   eyebrow: "Closed",                   actions: [] },
  not_applied:  { filter: "stopped",  word: "Not applied",    ring: "stop",   eyebrow: null,                       actions: ["restore"] },
  stopped:      { filter: "stopped",  word: "Stopped",        ring: "stop",   eyebrow: null,                       actions: ["again", "check", "log", "yourself", "skip"] },
});

const s = (v) => (v == null ? "" : String(v));
const ms = (t) => { const n = Number(t); if (!Number.isFinite(n) || n <= 0) return null; return n < 1e12 ? n * 1000 : n; };

/** A node's stage (lib/draftHouseTree.js buildNodes). */
export function stageOfNode(node) {
  if (!node) return "stopped";
  switch (node.kind) {
    case "approval": return "ready";
    case "held": return node.why === "gone" ? "stopped" : node.why === "question" ? "question" : "needs";
    case "gated": return "needs";
    case "inflight": return "working";
    case "line": return "waiting";
    case "broke": return "stopped";
    case "pick": return node.ring === "pick" ? "picked" : node.ring === "stop" ? "stopped" : "working";
    case "sent": return "sent";
    case "withdrawn": return "withdrawn";
    case "reply": return ["interview", "assessment", "offer", "rejected"].includes(node.status) ? node.status : "offer";
    default: return node.ring === "stop" ? "stopped" : "needs";
  }
}

/** A history row's stage (shared/applicationHistory.js historyStatus) — for a row no live node covers. */
export function stageOfHistory(h) {
  if (!h) return "stopped";
  if (h.status === "in_play") return h.origin === "drafted" ? "working" : "pending_self";
  if (h.status === "sent") return "sent";
  if (h.status === "no_reply") return "no_reply";
  if (h.status === "closed") {
    // "Did not apply" (a pending record you took back) and "moved after 14 days" are Not applied; a sent one you ended is Withdrawn.
    if (h.recordState === "not_applied" || (h.recordState === "withdrawn" && h.applicationId == null)) return "not_applied";
    return "withdrawn";
  }
  if (h.status === "replied") {
    const o = h.responseOutcome || h.furthestStage;
    return o === "interview" || o === "screen" ? "interview" : o === "offer" ? "offer" : o === "rejected" ? "rejected" : "interview";
  }
  return "stopped";
}

/** The Résumé column: tailored · tailoring · default — or "—" for an application sent elsewhere (imported). */
export function resumeWord(node, hist) {
  if (hist?.imported) return "—";
  const ref = node?.ref || {};
  if (node?.kind === "approval") return ref.generationDeferred ? "Tailored on approve" : ref.resume?.available || ref.resume?.atsScore != null ? "Tailored" : "Default";
  if (node?.kind === "pick") return ref.resumeReady ? "Tailored" : node.ring === "work" ? "Tailoring" : "Default";
  if (node?.kind === "inflight" || node?.kind === "line") return "Tailoring";
  const row = ref.primary?.row || ref;
  if (row?.resumeAvailable) return "Tailored";
  if (hist?.resumeAt != null || hist?.resumeSource === "snapshot_at_record" || hist?.resumeSource === "backfill") return "Tailored";
  return "Default";
}

/** The Answers column: "12 filled" · "1 needs you" · "—". */
export function answersWord(node) {
  const ref = node?.ref || {};
  // ⭐ A181 (4): the row and the panel read ONE count — the questions really waiting (the panel said 7, the row said 1).
  if (node?.kind === "held" && node.why === "question") {
    const row = ref.primary?.row || ref;
    const n = Array.isArray(row?.heldQuestions) && row.heldQuestions.length ? row.heldQuestions.length : 1;
    return `${n} need${n === 1 ? "s" : ""} you`;
  }
  if (node?.kind === "held" && node.why === "empty") {
    const n = (ref.primary?.row?.missingRequired || []).length;
    return n ? `${n} need${n === 1 ? "s" : ""} you` : "—";
  }
  if (node?.kind === "approval" && Number(ref.answerCount) > 0) return `${ref.answerCount} filled`;
  const p = ref.progress || ref.primary?.row?.progress;
  if (p && Number(p.filled) >= 0 && Number(p.total) > 0) return `${p.filled} of ${p.total} filled`;
  return "—";
}

/** The Status column's word: the stage's word, with the facts only this stage has (the filling count, the date). */
export function statusWord(stage, node, hist) {
  const base = STAGES[stage]?.word || "";
  const ref = node?.ref || {};
  if (stage === "working") {
    const p = ref.progress;
    if (p && Number(p.total) > 0) return `Filling ${Number(p.filled) || 0} of ${p.total}`;
    return node?.kind === "pick" || ref.status === "queued" || node?.status === "queued" ? "Starting soon" : base;
  }
  if (stage === "interview" || stage === "assessment") return interviewLine(stage, ref.interview) || (stage === "interview" && hist?.responseOutcome === "screen" ? "Screen" : base);
  if (stage === "sent" && hist?.ask) return "Did they reply?";
  if (stage === "pending_self" && hist?.recordState === "recorded") return "Recorded, checking";
  return base;
}

/** A Table-only row's headline per stage — a sentence that does not repeat the Status column's word. */
export const HISTORY_HEADLINES = Object.freeze({
  sent: "No reply yet", no_reply: "No reply yet", rejected: "They went with someone else",
  interview: "They want to talk to you", assessment: "They sent an assessment", offer: "They made you an offer",
  withdrawn: "You withdrew it",
});

/** The headline of an opened row: one sentence for its stage — the question itself when it is one. */
export function headlineOf(row) {
  const n = row.node;
  // D149 (11-03): the question in quotes, as tracker-options.html says it — it is the form's words, not ours.
  if (row.stage === "question" && n?.question?.question) return `"${n.question.question}"`;
  if (row.stage === "ready") {
    const a = Number(n?.ref?.answerCount) || 0;
    return [a ? `${a} answers filled` : "Filled and checked", row.resume === "Tailored" ? "résumé tailored" : null].filter(Boolean).join(", ");
  }
  if (row.stage === "interview" || row.stage === "assessment") {
    const line = interviewLine(row.stage, n?.ref?.interview);
    return line ? line.replace(/^(Interview|Assessment) /, `${row.stage === "assessment" ? "Assessment" : "Interview"} on `) : (n?.say || "They want to talk to you.");
  }
  if (!n && row.hist) {
    if (row.stage === "pending_self") return "You opened it. Did you send it?";
    if (row.stage === "not_applied") return row.hist.label || "Not applied.";
    // ⭐ D146 walk (11-03): a sentence, never the status word again (the sketch: "They went with someone else").
    return HISTORY_HEADLINES[row.stage] || row.hist.label || STAGES[row.stage]?.word || "";
  }
  return n?.say || STAGES[row.stage]?.word || "";
}

/** The on-demand panes a row offers, in order. ⛔ Answers only once a form was filled; Emails only once it was sent. */
export function panesFor(row) {
  const sent = ["sent", "interview", "assessment", "offer", "rejected", "no_reply", "withdrawn"].includes(row.stage);
  const formed = ["question", "needs", "ready", "working", "stopped"].includes(row.stage) && row.node && row.node.kind !== "pick";
  return TRACKER_PANES.map(([id]) => id).filter(id => id === "answers" ? !!formed : id === "emails" ? sent : true);
}

/** The stage's actions (ids), in order — the panel wires each id to its handler; an id with no handler is left out. */
export const stageActions = (stage) => STAGES[stage]?.actions || [];

/**
 * The rows: one per job, the live node first, the history row's facts on it.
 * @param nodes buildNodes()'s nodes · @param history /api/applications/history rows
 */
export function trackerRows({ nodes = [], history = [], now = Date.now() } = {}) {
  const histBy = new Map((history || []).map(h => [String(h.jobId), h]));
  const seen = new Set();
  const rows = [];
  for (const node of nodes || []) {
    const hist = node.jobId != null ? histBy.get(String(node.jobId)) || null : null;
    if (node.jobId != null) seen.add(String(node.jobId));
    const stage = stageOfNode(node);
    rows.push(build({ key: node.key, node, hist, stage, now }));
  }
  for (const h of history || []) {
    if (seen.has(String(h.jobId))) continue;
    seen.add(String(h.jobId));
    rows.push(build({ key: `hist-${h.jobId}`, node: null, hist: h, stage: stageOfHistory(h), now }));
  }
  return rows;
}

function build({ key, node, hist, stage, now }) {
  const at = node?.at || ms(hist?.date) || ms(hist?.updatedAt) || null;
  const row = {
    key, node, hist, stage, filter: STAGES[stage]?.filter || "stopped", ring: STAGES[stage]?.ring || "stop",
    jobId: node?.jobId ?? hist?.jobId ?? null, company: node?.company || s(hist?.company) || "Unknown company",
    title: node?.title || s(hist?.title), at,
    resume: resumeWord(node, hist), answers: answersWord(node),
    url: node?.ref?.applyUrl || node?.ref?.url || node?.ref?.primary?.row?.applyUrl || hist?.applyUrl || null,
  };
  row.status = statusWord(stage, node, hist);
  row.when = whenWord(at, now);
  row.eyebrow = STAGES[stage]?.eyebrow || "";
  row.headline = headlineOf(row);
  row.panes = panesFor(row);
  return row;
}

/** The When column, relative: "just now" · "3 h ago" · "yesterday" · "4 days ago" · "Oct 2". */
export function whenWord(at, now = Date.now()) {
  if (!at) return "—";
  const d = now - at;
  if (d < 0) return "soon";
  const h = Math.floor(d / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The counts row. needs / progress / sent are their filters; replied = every reply; interview = interviews and assessments. */
export function trackerCounts(rows = []) {
  const c = { needs: 0, progress: 0, sent: 0, replied: 0, interview: 0 };
  for (const r of rows) {
    if (r.filter === "needs" || r.filter === "ready") c.needs++;   // 47c: ready waits on the person's Submit — still theirs to act on
    else if (r.filter === "progress") c.progress++;
    else if (r.filter === "sent") c.sent++;
    if (r.filter === "replies") c.replied++;
    if (r.stage === "interview" || r.stage === "assessment") c.interview++;
  }
  return c;
}

/** Filter + search + period. Search reads company, title and the row's own words. */
export function trackerView(rows = [], { filter = "all", q = "", periodDays = null, now = Date.now() } = {}) {
  const needle = s(q).trim().toLowerCase();
  const since = periodDays ? now - periodDays * 86400000 : null;
  return rows.filter(r => (filter === "all" || r.filter === filter)
    && (!needle || `${r.company} ${r.title} ${r.status} ${r.node?.say || ""}`.toLowerCase().includes(needle))
    && (since == null || (r.at != null && r.at >= since)));
}

/** ⭐ 46y · home-sketch.html's filter buttons carry their count (`All 7`, `Needs you 1`) — per filter, over every row. */
export function filterCounts(rows = []) {
  const c = Object.fromEntries(TRACKER_FILTERS.map(([id]) => [id, 0]));
  for (const r of rows) { c.all++; if (c[r.filter] != null) c[r.filter]++; }
  return c;
}

/**
 * ⭐ 46y · home-sketch.html's line under the title: "12 this month · 3 replies · 1 interview coming up". Applications
 * whose date falls in this calendar month, every reply, the interviews / assessments with a date today or later. A part
 * that is 0 is left out (an empty Home says nothing rather than "0 this month").
 */
export function homeSummary(rows = [], now = Date.now()) {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const today = d.toLocaleDateString("en-CA");
  const month = rows.filter(r => r.at != null && r.at >= monthStart).length;
  const replies = rows.filter(r => r.filter === "replies").length;
  const coming = rows.filter(r => (r.stage === "interview" || r.stage === "assessment") && r.node?.ref?.interview?.ymd >= today).length;
  return [month && `${month} this month`, replies && `${replies} repl${replies === 1 ? "y" : "ies"}`,
    coming && `${coming} interview${coming === 1 ? "" : "s"} coming up`].filter(Boolean).join(" · ");
}

/**
 * ⭐ 46y · home-sketch.html's .needs — at most three cards above the table, in its order: the first application that
 * needs the person (Needs you), the next interview (Interview on <weekday>), the first one ready to send. Each card names
 * its row (`key`) and what its button does (`act`: "open" opens the row in place; "interview" goes to Interview).
 */
export function homeNeeds(rows = [], now = Date.now()) {
  const out = [];
  const need = rows.find(r => r.stage === "question" || r.stage === "needs");
  if (need) {
    const q = need.node?.question?.question;
    out.push({ key: need.key, kind: "need", eyebrow: "Needs you", title: need.company,
      line: q ? `One question only you can answer: ${q}` : (need.node?.say || "Waiting for you."),
      act: "open", label: need.stage === "question" ? "Answer it" : "Open it", primary: true });
  }
  const today = new Date(now).toLocaleDateString("en-CA");
  const iv = rows.filter(r => (r.stage === "interview" || r.stage === "assessment") && r.node?.ref?.interview?.ymd >= today)
    .sort((a, b) => String(a.node.ref.interview.ymd).localeCompare(String(b.node.ref.interview.ymd)))[0];
  if (iv) {
    const w = iv.node.ref.interview;
    const [y, m, d] = w.ymd.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    out.push({ key: iv.key, kind: "interview", eyebrow: `${iv.stage === "assessment" ? "Assessment" : "Interview"} on ${weekday}`,
      title: [iv.company, iv.title].filter(Boolean).join(" · "), line: `${iv.status}.`,
      act: "interview", label: "Prepare in Interview", primary: false });
  }
  const ready = rows.find(r => r.stage === "ready");
  if (ready) out.push({ key: ready.key, kind: "ready", eyebrow: "Ready to send", title: [ready.company, ready.title].filter(Boolean).join(" · "),
    line: "Everything is filled. Submit when you're happy.", act: "open", label: "Review and submit", primary: false });
  return out;
}

/** The order "Needs you" rows sit in when the table is sorted by status: what needs the user first. */
const STATUS_ORDER = ["question", "needs", "ready", "picked", "working", "waiting", "pending_self", "interview", "assessment", "offer", "sent", "no_reply", "rejected", "not_applied", "withdrawn", "stopped"];
/** Sortable columns: position (company, then role), résumé, answers, status (by stage order), when (newest first). */
export function sortRows(rows = [], { key = "when", dir = "desc" } = {}) {
  const val = {
    position: (r) => `${r.company} ${r.title}`.toLowerCase(),
    resume: (r) => r.resume, answers: (r) => r.answers,
    status: (r) => STATUS_ORDER.indexOf(r.stage),
    when: (r) => r.at || 0,
  }[key] || ((r) => r.at || 0);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sign || String(a.key).localeCompare(String(b.key));
  });
}

/** Send all ready: every Ready-to-send row's run-job, for one confirm that lists them. */
export function readyToSend(rows = []) {
  return rows.filter(r => r.stage === "ready" && r.node?.runJobId != null)
    .map(r => ({ runJobId: r.node.runJobId, label: [r.company, r.title].filter(Boolean).join(" — ") }));
}
/** The confirm's words: what will go, by name. */
export function sendAllConfirmText(ready = [], cap = null) {
  const names = ready.slice(0, 12).map(x => `· ${x.label}`).join("\n");
  const more = ready.length > 12 ? `\n· and ${ready.length - 12} more` : "";
  const capLine = cap && cap.remaining < ready.length ? `\n\nOnly ${cap.remaining} of today's ${cap.limit} approvals are left; the rest wait.` : "";
  return `Send ${ready.length} application${ready.length === 1 ? "" : "s"} to their employers?\n\n${names}${more}${capLine}\n\nThis cannot be undone.`;
}

/** The timeline: a bubble pulses only for a live stage — Needs you, Ready, Working (styles/rings.js). */
export const pulses = (ring) => !!RINGS[ring]?.pulse;

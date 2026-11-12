// ── D110 (owner 10-30) · INTERVIEW MODE — prep that starts when the interview email arrives ──────────────
//
// P1 · the trigger: when D103 files an Interview or Assessment for an application (an inbox message matched to it, or
//      the ladder already reads interview / assessment), the application's page gains a Prep tab and a countdown to
//      the date — the date the user entered, or the ONE date an email states plainly (readDateFromEmail). Never guessed:
//      no date, two different dates, a weekday that contradicts the date, or a numeric "11/03" (US or European?) →
//      no date, and the user types it.
// P2 · the plan: the posting's skills against the profile (have / partial / missing), each linked to its PUBLISHED Atlas
//      page and that page's resources (D105 — through atlasStore's own search and read, no second resolver), and the
//      likely rounds read by rule from the posting and the emails (coding, system design, ML, behavioural; the named
//      assessment platform's format).
// P3 · the story bank: behavioural stories in STAR form, started from the Profile's experience (D101 profile_experience),
//      tagged by theme by rule, editable, stored per user and reused across every interview.
// P4 · the connector's data pack (connectorPack): the posting, the profile and the gap list AS DATA for the user's own
//      Claude — no instruction text; the interviewer's instructions are the static Skill's (Directory Policy §2F).
// P5 · the debrief: after each round, what was asked and how it went → the user's own question bank. ⛔ PRIVATE: every
//      read here is scoped by user_id; nothing aggregates across users (sharing is NOT in D110 — some employers bind
//      candidates by NDA).
//
// ⛔ D17: rules only — no model call anywhere in this file.
import crypto from "node:crypto";
import { searchNodes, readNode, profileTerms, termOf, aliasesOf } from "./atlas/atlasStore.js";
import { untrustedText } from "./byom/untrusted.js";
import { listMessages } from "./inbox.js";
import { companyOfApplication, rebuildCompanyGuide } from "./interview/companyGuides.js";

import { fullReport } from "./atsReportRead.js";   // A187 Stage 0 (46i)
const now = () => Math.floor(Date.now() / 1000);
const parse = (s, fb) => { if (s == null) return fb; try { return JSON.parse(s); } catch { return fb; } };
const err = (status, code, message) => Object.assign(new Error(message), { status, code });

export const PREP_CATEGORIES = Object.freeze(["interview", "assessment"]);
export const ROUNDS = Object.freeze(["coding", "system_design", "ml", "behavioural"]);
export const ROUND_LABELS = Object.freeze({ coding: "Coding", system_design: "System design", ml: "Machine learning", behavioural: "Behavioural", other: "Other" });
export const WENT = Object.freeze(["well", "mixed", "poorly"]);
export const STORY_THEMES = Object.freeze(["leadership", "ownership", "conflict", "failure", "impact", "collaboration", "ambiguity", "customer"]);
export const LIMITS = Object.freeze({ title: 120, field: 2000, question: 500, notes: 2000, questions: 30, seedPerEntry: 2, seedTotal: 12 });

// ── P1 · the date, read by rule ──────────────────────────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const WEEKDAY = "(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday|rsday)?";
const TIME = "(?:\\s*(?:,|at|@|from)?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)|\\s*(?:,|at|@|from)?\\s*([01]?\\d|2[0-3]):([0-5]\\d))?";
const DATE_RES = [
  // Monday, November 3, 2026 at 2:00 PM · Nov 3rd · November 3 2026
  { re: new RegExp(`\\b(?:${WEEKDAY},?\\s+)?${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b${TIME}`, "gi"),
    pick: (m) => ({ wd: m[1], mon: m[2], day: m[3], year: m[4], t: m.slice(5, 10) }) },
  // Monday 3 November 2026 · 3rd of November
  { re: new RegExp(`\\b(?:${WEEKDAY},?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}(?:,?\\s+(\\d{4}))?\\b${TIME}`, "gi"),
    pick: (m) => ({ wd: m[1], day: m[2], mon: m[3], year: m[4], t: m.slice(5, 10) }) },
  // 2026-11-03
  { re: new RegExp(`\\b(\\d{4})-(\\d{2})-(\\d{2})\\b${TIME}`, "g"),
    pick: (m) => ({ year: m[1], monNum: m[2], day: m[3], t: m.slice(4, 9) }) },
];
const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const YEARLESS_AHEAD_DAYS = 120;
const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function timeOf(t = []) {
  const [h12, m12, ap, h24, m24] = t;
  if (h12 != null && ap) {
    let h = Number(h12) % 12; if (/^p/i.test(ap)) h += 12;
    if (Number(h12) > 12 || Number(m12 ?? 0) > 59) return null;
    return `${pad(h)}:${pad(m12 ?? 0)}`;
  }
  if (h24 != null && m24 != null) return `${pad(h24)}:${m24}`;
  return null;
}

/**
 * The ONE date an email states plainly, or null. Dates before the day the email arrived are ignored (an application
 * date quoted back); a date without a year takes the year it arrived in, or the next one when that day has passed and
 * next year's falls within 120 days (otherwise it is a past date, ignored).
 * Refused (null): no date, two different dates, a weekday that does not match its date, an impossible date. A
 * numeric "11/03/2026" is never read — month-first and day-first both exist.
 * @returns {{ ymd: string, time: string|null, text: string } | null}
 */
export function readDateFromEmail({ subject = "", body = "", receivedAt = now() } = {}) {
  const text = `${subject}\n${String(body).slice(0, 4000)}`;
  const received = new Date(receivedAt * 1000);
  const receivedYmd = ymdOf(received);
  const found = new Map();
  for (const { re, pick } of DATE_RES) {
    for (const m of text.matchAll(re)) {
      const p = pick(m);
      const month = p.monNum ? Number(p.monNum) - 1 : MONTHS.indexOf(String(p.mon).slice(0, 3).toLowerCase());
      const day = Number(p.day);
      if (month < 0 || month > 11 || !(day >= 1 && day <= 31)) continue;
      let year = p.year ? Number(p.year) : received.getUTCFullYear();
      let d = new Date(Date.UTC(year, month, day));
      if (d.getUTCMonth() !== month) return null;                             // 31 November: not a date — refuse
      if (!p.year && ymdOf(d) < receivedYmd) {
        // A year-less date already past this year is next year's only when that is near (a December mail naming 3 January);
        // otherwise it is a past date quoted back ("you applied on October 12") and is ignored.
        const next = new Date(Date.UTC(year + 1, month, day));
        if ((next.getTime() - received.getTime()) / 86400000 > YEARLESS_AHEAD_DAYS) continue;
        year += 1; d = next;
      }
      const ymd = ymdOf(d);
      if (ymd < receivedYmd) continue;                                         // a date already past when it arrived
      if (p.wd && WD[d.getUTCDay()] !== String(p.wd).slice(0, 3).toLowerCase()) return null; // the weekday contradicts it
      const time = timeOf(p.t);
      const prev = found.get(ymd);
      if (!prev || (!prev.time && time)) found.set(ymd, { ymd, time, text: m[0].trim().slice(0, 80) });
      else if (prev.time && time && prev.time !== time) prev.ambiguousTime = true;
    }
  }
  if (found.size !== 1) return null;
  const only = [...found.values()][0];
  return { ymd: only.ymd, time: only.ambiguousTime ? null : only.time, text: only.text };
}

/** Whole days from today (UTC) to the date: 0 today, negative once past. */
export function daysUntil(ymd, nowSec = now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return null;
  const today = ymdOf(new Date(nowSec * 1000));
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

// ── P1 · the trigger and the date ────────────────────────────────────────────────────────────

const ownRecord = (db, userId, applicationId) =>
  db.prepare(`SELECT * FROM application_records WHERE id = ? AND user_id = ?`).get(Number(applicationId), userId) ?? null;

function bodiesOf(db, userId, ids) {
  if (!ids.length) return new Map();
  return new Map(db.prepare(`SELECT id, subject, body_text, received_at, from_domain FROM inbox_messages WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`)
    .all(userId, ...ids).map(r => [r.id, r]));
}

/**
 * Is Prep on for this application, and what date does it count down to? `emails` is the page's listMessages rows
 * (passed in by jobDetail so the mail is read once). Pure read — nothing is written on a GET.
 */
export function prepSummary(db, userId, applicationId, { status = null, emails = null, nowSec = now() } = {}) {
  let mail = emails;
  if (!mail) { try { mail = listMessages(db, userId, { applicationId }); } catch { mail = []; } }
  const triggers = mail.filter(m => PREP_CATEGORIES.includes(m.category));
  const byStatus = PREP_CATEGORIES.includes(status);
  if (!triggers.length && !byStatus) return { active: false };
  const kind = triggers[0]?.category || status;
  let date = null;
  try {
    const mine = userDateFor(db, userId, applicationId);
    if (mine) date = { ...mine, source: "you" };
  } catch { /* before migration 186 */ }
  if (!date) {
    const bodies = bodiesOf(db, userId, triggers.map(t => t.id));
    for (const t of triggers) {                                   // newest first (listMessages' order)
      const b = bodies.get(t.id);
      const r = b && readDateFromEmail({ subject: b.subject, body: b.body_text, receivedAt: b.received_at });
      if (r) { date = { ymd: r.ymd, time: r.time, source: "email", messageId: t.id, text: r.text }; break; }
    }
  }
  return { active: true, kind, triggerMessageId: triggers[0]?.id ?? null,
    date, daysLeft: date ? daysUntil(date.ymd, nowSec) : null };
}

/** Is this an IANA time zone this runtime knows ("America/New_York")? */
export function isTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/**
 * ⭐ D113 UI "Add the date": a wall-clock date and time IN a time zone → epoch seconds (interview_at). No time → the
 * start of that day there. Two passes of the zone's offset, so a date beside a daylight-saving change lands right.
 */
export function zonedEpoch(ymd, hm, tz) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = (hm || "00:00").split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const offset = (t) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = wall - offset(wall);
  t = wall - offset(t);
  return Math.floor(t / 1000);
}

/**
 * The user enters (or clears) the date — D110's one store of it. D113 UI adds the time zone (default UTC) and keeps
 * interview_at, that moment as epoch seconds, beside the wall-clock date and time the countdown reads.
 */
export function setPrepDate(db, userId, applicationId, { date = null, time = null, timeZone = null } = {}) {
  if (!ownRecord(db, userId, applicationId)) return null;
  if (date == null || date === "") {
    db.prepare(`DELETE FROM interview_prep WHERE user_id = ? AND application_id = ?`).run(userId, Number(applicationId));
    return { date: null };
  }
  const ymd = String(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || ymdOf(new Date(`${ymd}T00:00:00Z`)) !== ymd) throw err(400, "bad_date", "A date is YYYY-MM-DD.");
  const hm = time == null || time === "" ? null : String(time);
  if (hm != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hm)) throw err(400, "bad_time", "A time is HH:MM, 24-hour.");
  const tz = timeZone == null || timeZone === "" ? "UTC" : String(timeZone);
  if (!isTimeZone(tz)) throw err(400, "bad_time_zone", "A time zone is a name like America/New_York.");
  const at = zonedEpoch(ymd, hm, tz);
  db.prepare(`INSERT INTO interview_prep (user_id, application_id, date_ymd, time_hm, time_zone, interview_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, application_id) DO UPDATE SET date_ymd = excluded.date_ymd, time_hm = excluded.time_hm,
      time_zone = excluded.time_zone, interview_at = excluded.interview_at, updated_at = unixepoch()`)
    .run(userId, Number(applicationId), ymd, hm, tz, at);
  return { date: { ymd, time: hm, timeZone: tz, at, source: "you" } };
}

/** The user's own date for an application (interview_prep), as the tree's row shows it. Null when none is set. */
export function userDateFor(db, userId, applicationId) {
  try {
    const row = db.prepare(`SELECT date_ymd, time_hm, time_zone, interview_at FROM interview_prep WHERE user_id = ? AND application_id = ?`)
      .get(userId, Number(applicationId));
    return row?.date_ymd ? { ymd: row.date_ymd, time: row.time_hm ?? null, timeZone: row.time_zone ?? null, at: row.interview_at ?? null } : null;
  } catch { return null; }   // before migration 186 / 200
}

// ── P2 · the skills against the profile ──────────────────────────────────────────────────────

function postingOf(db, rec) {
  let p = null;
  try { p = db.prepare(`SELECT job_id, title, company, description, skills_json FROM scraped_jobs WHERE job_id = ?`).get(rec.job_id) ?? null; } catch { p = null; }
  const rj = db.prepare(`SELECT posting_title, posting_company FROM apply_run_jobs WHERE user_id = ? AND job_id = ? ORDER BY id DESC LIMIT 1`).get(rec.user_id, rec.job_id);
  return { jobId: rec.job_id, title: rj?.posting_title || p?.title || null, company: rj?.posting_company || p?.company || null,
    description: p?.description || "", skills: parse(p?.skills_json, []).map(s => typeof s === "string" ? s : s?.name || s?.skill).filter(Boolean) };
}

/** The ATS report the board stored for this user and job (the newest), or null. */
function storedReport(db, userId, jobId) {
  try {
    const r = db.prepare(`SELECT ats_report, domain_profile_id FROM ats_only_reports WHERE user_id = ? AND job_id = ? ORDER BY COALESCE(scored_at, created_at) DESC, id DESC LIMIT 1`).get(userId, String(jobId));
    return r?.ats_report ? fullReport(r.ats_report, { userId, profileId: r.domain_profile_id, jobId }) : null;   // A187: a slim row expanded
  } catch { return null; }
}

/** A published Atlas page for a skill — exact name or confirmed alias only, never a "contains" match. */
function atlasFor(db, name) {
  let hit = null;
  try { hit = searchNodes(db, name, { publishedOnly: true, limit: 5 }).find(r => r.via === "name" || r.via === "alias") ?? null; } catch { hit = null; }
  if (!hit) return null;
  const node = readNode(db, hit.slug, { publishedOnly: true });
  if (!node) return null;
  return { slug: node.slug, name: node.name, path: `/app/atlas/${node.slug}`,
    resources: (node.resources || []).slice(0, 3).map(r => ({ url: r.url, title: r.title, level: r.level ?? null, format: r.format ?? null, cost: r.cost ?? null })) };
}

const wordIn = (hay, term) => term && new RegExp(`(^|[^a-z0-9+#])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9+#])`, "i").test(hay);

/**
 * have — on the profile's skills (or a confirmed alias of one) · partial — not claimed, but the résumé counted it (the
 * stored ATS report's matched terms) or the experience mentions it · missing — neither. The posting's skills are the
 * ATS report's matched + missing terms, or the posting's own skills list when no report is stored.
 */
export function skillGaps(db, userId, rec) {
  const posting = postingOf(db, rec);
  const report = storedReport(db, userId, rec.job_id);
  const matched = new Set((report?.tier1_matched || []).map(termOf));
  const names = [...(report?.tier1_matched || []), ...(report?.tier1_missing || [])];
  const list = (names.length ? names : posting.skills).filter(s => typeof s === "string" && s.trim());
  const mine = profileTerms(db, userId);
  let exp = "";
  try {
    exp = db.prepare(`SELECT title, bullets_json FROM profile_experience WHERE user_id = ?`).all(userId)
      .map(r => `${r.title || ""} ${parse(r.bullets_json, []).join(" ")}`).join(" \n ").toLowerCase();
  } catch { exp = ""; }
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const t = termOf(name);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    const forms = [t, ...aliasesOf(db, t)];
    const status = forms.some(f => mine.has(f)) ? "have"
      : (matched.has(t) || forms.some(f => wordIn(exp, f))) ? "partial" : "missing";
    out.push({ name, status, atlas: atlasFor(db, name) });
    if (out.length >= 40) break;
  }
  const rank = { missing: 0, partial: 1, have: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status]);
}

// ── P2 · the likely rounds, read by rule ─────────────────────────────────────────────────────

const ROUND_RULES = Object.freeze({
  coding: /\b(coding (?:interview|round|challenge|assessment|exercise|test)|live[- ]coding|pair[- ]programming|data structures?|algorithms?|leetcode|coderpad|take[- ]home|technical (?:screen|interview|assessment)|online assessment)\b/i,
  system_design: /\b(system(?:s)? design|architecture (?:interview|round|discussion)|design (?:a|an) (?:scalable|distributed) (?:system|service)|distributed systems?)\b/i,
  ml: /\b(machine learning|ml (?:system design|design|round|interview|engineer(?:ing)?)|deep learning|model (?:training|evaluation|deployment)|statistic(?:s|al modell?ing))\b/i,
  behavioural: /\b(behaviou?ral|culture (?:fit|add)|values (?:interview|round)|leadership principles|tell (?:us|me) about a time|star (?:method|format)|hiring manager (?:interview|chat|conversation))\b/i,
});

/** The assessment platforms D103 knows (services/inbox.js ASSESS_SENDERS + CoderPad), each with its plain format. */
export const PLATFORMS = Object.freeze({
  hackerrank: { name: "HackerRank", domain: "hackerrank.com", format: "A timed test in the browser: coding questions run against hidden test cases, sometimes with multiple-choice questions. Pick your language before you start." },
  codesignal: { name: "CodeSignal", domain: "codesignal.com", format: "A timed General Coding Assessment: four coding tasks of rising difficulty in about 70 minutes, scored on correctness. Proctored with your camera on some tests." },
  codility: { name: "Codility", domain: "codility.com", format: "A timed set of coding tasks, scored on correctness and on performance against large inputs." },
  hirevue: { name: "HireVue", domain: "hirevue.com", format: "Recorded video answers to set questions, a fixed time to think and to answer; some include a coding or game section." },
  karat: { name: "Karat", domain: "karat.com", format: "A live technical interview with a Karat interviewer over video: a short discussion, then coding in a shared editor." },
  testgorilla: { name: "TestGorilla", domain: "testgorilla.com", format: "A set of short timed tests (skills, cognitive ability, personality), each scored on its own." },
  coderbyte: { name: "Coderbyte", domain: "coderbyte.com", format: "Timed coding challenges in the browser, run against test cases; sometimes multiple-choice questions." },
  byteboard: { name: "Byteboard", domain: "byteboard.dev", format: "A project-style exercise: a short design document to reason about, then a coding task in a realistic codebase." },
  qualified: { name: "Qualified", domain: "qualified.io", format: "Coding challenges with unit tests in a browser IDE, scored by the tests passed." },
  coderpad: { name: "CoderPad", domain: "coderpad.io", format: "A live shared editor that runs code; the interviewer watches and talks it through with you." },
});

/**
 * The rounds the posting and the emails name, each with where it was read; and the platform when one is named
 * (by the sender's domain or by name). A round with no evidence is not listed — nothing is assumed.
 */
export function likelyRounds({ postingText = "", emails = [] } = {}) {
  const sources = [{ from: "posting", text: String(postingText).slice(0, 20000) },
    ...emails.map(e => ({ from: "email", text: `${e.subject || ""}\n${String(e.body || "").slice(0, 6000)}`, domain: e.fromDomain || "" }))];
  const rounds = [];
  for (const round of ROUNDS) {
    const hits = [];
    for (const s of sources) { const m = ROUND_RULES[round].exec(s.text); if (m && !hits.some(h => h.from === s.from)) hits.push({ from: s.from, phrase: m[0].slice(0, 60) }); }
    if (hits.length) rounds.push({ round, label: ROUND_LABELS[round], evidence: hits });
  }
  let platform = null;
  for (const [id, p] of Object.entries(PLATFORMS)) {
    const bySender = sources.some(s => s.domain && (s.domain === p.domain || s.domain.endsWith(`.${p.domain}`)));
    const byName = sources.some(s => s.from === "email" && new RegExp(`\\b${p.name}\\b`, "i").test(s.text));
    if (bySender || byName) { platform = { id, name: p.name, format: p.format }; break; }
  }
  return { rounds, platform };
}

// ── P3 · the story bank ──────────────────────────────────────────────────────────────────────

const THEME_RULES = Object.freeze({
  leadership: /\b(led|lead|mentor(?:ed)?|managed|coached|hired|onboarded)\b/i,
  ownership: /\b(owned|launched|built|designed|architected|drove|initiated|from scratch|end[- ]to[- ]end)\b/i,
  conflict: /\b(disagree\w*|conflict\w*|negotiat\w*|aligned|pushback|trade-?offs?)\b/i,
  failure: /\b(incident|outage|postmortem|post-mortem|recovered|root cause|rollback|mistake|fixed)\b/i,
  impact: /(\d+(?:\.\d+)?\s?%|\$\s?\d|\b\d+(?:\.\d+)?x\b|\b(?:reduced|increased|improved|cut|saved|grew)\b)/i,
  collaboration: /\b(cross[- ]functional|partnered|collaborat\w*|stakeholders?|with (?:the )?(?:design|product|data|sales) team)\b/i,
  ambiguity: /\b(ambigu\w*|undefined|new area|first (?:of its kind|time)|prototype\w*|greenfield)\b/i,
  customer: /\b(customers?|clients?|users?)\b/i,
});
export const themesOf = (text) => STORY_THEMES.filter(t => THEME_RULES[t].test(String(text || "")));

const RESULT_SPLIT = /\s*(?:,|;|—|–|-)?\s*\b(resulting in|which (?:led to|resulted in|reduced|increased|cut|improved|saved)|leading to|cutting|reducing|saving|improving|increasing)\b/i;

/** One bullet as a STAR start: the Action is the bullet, the Result the clause after "resulting in", "cutting"… */
export function starFromBullet({ company, title, start, end, current }, bullet) {
  const b = String(bullet || "").replace(/^[•\-*\s]+/, "").trim();
  const m = RESULT_SPLIT.exec(b);
  const action = (m ? b.slice(0, m.index) : b).replace(/[,;\s]+$/, "");
  const result = m ? b.slice(m.index).replace(/^[\s,;—–-]+/, "").replace(/^\w/, c => c.toUpperCase()) : "";
  const when = [start, current ? "present" : end].filter(Boolean).join(" – ");
  return { title: `${company}${title ? ` — ${title}` : ""}`.slice(0, LIMITS.title),
    situation: `${title || "Role"} at ${company}${when ? `, ${when}` : ""}.`, task: "", action, result, themes: themesOf(b) };
}

const storyOut = (r) => ({ id: r.id, title: r.title, situation: r.situation, task: r.task, action: r.action, result: r.result,
  themes: parse(r.themes_json, []), source: r.source, createdAt: r.created_at, updatedAt: r.updated_at });

export function listStories(db, userId) {
  return db.prepare(`SELECT * FROM interview_stories WHERE user_id = ? ORDER BY updated_at DESC, id DESC`).all(userId).map(storyOut);
}

function cleanStory(body = {}, { partial = false } = {}) {
  const out = {};
  const txt = (k, cap) => {
    if (body[k] === undefined) { if (!partial) out[k] = ""; return; }
    const v = String(body[k] ?? "");
    if (v.length > cap) throw err(400, "too_long", `${k} is at most ${cap} characters.`);
    out[k] = v.trim();
  };
  txt("title", LIMITS.title); for (const k of ["situation", "task", "action", "result"]) txt(k, LIMITS.field);
  if (body.themes !== undefined || !partial) {
    const th = Array.isArray(body.themes) ? [...new Set(body.themes.map(String))] : [];
    const bad = th.filter(t => !STORY_THEMES.includes(t));
    if (bad.length) throw err(400, "bad_theme", `A theme is one of: ${STORY_THEMES.join(", ")}.`);
    out.themes_json = JSON.stringify(th);
  }
  if (!partial && !out.title) throw err(400, "no_title", "A story needs a title.");
  return out;
}

export function createStory(db, userId, body) {
  const s = cleanStory(body);
  const id = Number(db.prepare(`INSERT INTO interview_stories (user_id, title, situation, task, action, result, themes_json, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'user')`).run(userId, s.title, s.situation, s.task, s.action, s.result, s.themes_json).lastInsertRowid);
  return storyOut(db.prepare(`SELECT * FROM interview_stories WHERE id = ?`).get(id));
}

export function updateStory(db, userId, storyId, body) {
  const s = cleanStory(body, { partial: true });
  if (s.title === "") throw err(400, "no_title", "A story needs a title.");
  const keys = Object.keys(s);
  if (!db.prepare(`SELECT 1 FROM interview_stories WHERE id = ? AND user_id = ?`).get(Number(storyId), userId)) return null;
  if (keys.length) db.prepare(`UPDATE interview_stories SET ${keys.map(k => `${k} = ?`).join(", ")}, updated_at = unixepoch() WHERE id = ? AND user_id = ?`)
    .run(...keys.map(k => s[k]), Number(storyId), userId);
  return storyOut(db.prepare(`SELECT * FROM interview_stories WHERE id = ?`).get(Number(storyId)));
}

export function deleteStory(db, userId, storyId) {
  return db.prepare(`DELETE FROM interview_stories WHERE id = ? AND user_id = ?`).run(Number(storyId), userId).changes > 0;
}

/**
 * Start the bank from the Profile's experience: up to two bullets per entry (those with a measured result or a theme
 * first), twelve in all. Each seeded bullet is remembered by a key (company + title + bullet), so pressing it again adds
 * only what is new; a story the user edited is never overwritten (a deleted one can be seeded again by a later press).
 */
export function seedStoriesFromProfile(db, userId) {
  const rows = db.prepare(`SELECT * FROM profile_experience WHERE user_id = ? ORDER BY position, id`).all(userId);
  const have = db.prepare(`SELECT COUNT(*) FROM interview_stories WHERE user_id = ? AND seed_key IS NOT NULL`).pluck().get(userId);
  let budget = Math.max(0, LIMITS.seedTotal - have);
  const added = [];
  const ins = db.prepare(`INSERT OR IGNORE INTO interview_stories (user_id, title, situation, task, action, result, themes_json, source, seed_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'profile', ?)`);
  for (const r of rows) {
    if (budget <= 0) break;
    const entry = { company: r.company, title: r.title, start: r.start_ym, end: r.end_ym, current: !!r.is_current };
    const bullets = parse(r.bullets_json, []).filter(b => typeof b === "string" && b.trim().length >= 20);
    const ranked = bullets.map((b, i) => ({ b, i, score: (THEME_RULES.impact.test(b) ? 2 : 0) + themesOf(b).length }))
      .sort((x, y) => y.score - x.score || x.i - y.i).slice(0, LIMITS.seedPerEntry);
    for (const { b } of ranked) {
      if (budget <= 0) break;
      const key = crypto.createHash("sha256").update(`${r.company}\u0000${r.title || ""}\u0000${b.trim()}`).digest("hex").slice(0, 24);
      const s = starFromBullet(entry, b);
      const res = ins.run(userId, s.title, s.situation, s.task, s.action, s.result, JSON.stringify(s.themes), key);
      if (res.changes) { added.push(Number(res.lastInsertRowid)); budget--; }
    }
  }
  return { added: added.length, stories: listStories(db, userId) };
}

// ── P5 · the debrief and the personal question bank ──────────────────────────────────────────

const ROUND_OR_OTHER = [...ROUNDS, "other"];

export function addDebrief(db, userId, body = {}) {
  const applicationId = body.applicationId == null || body.applicationId === "" ? null : Number(body.applicationId);
  if (applicationId != null && !ownRecord(db, userId, applicationId)) throw err(404, "not_found", "That application is not yours, or it no longer exists.");
  const round = String(body.round ?? "other");
  if (!ROUND_OR_OTHER.includes(round)) throw err(400, "bad_round", `A round is one of: ${ROUND_OR_OTHER.join(", ")}.`);
  const went = body.went == null || body.went === "" ? null : String(body.went);
  if (went != null && !WENT.includes(went)) throw err(400, "bad_went", `How it went is one of: ${WENT.join(", ")}.`);
  const heldOn = body.heldOn == null || body.heldOn === "" ? null : String(body.heldOn);
  if (heldOn != null && !/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) throw err(400, "bad_date", "A date is YYYY-MM-DD.");
  const notes = String(body.notes ?? "");
  if (notes.length > LIMITS.notes) throw err(400, "too_long", `Notes are at most ${LIMITS.notes} characters.`);
  const qs = (Array.isArray(body.questions) ? body.questions : []).map(q => (typeof q === "string" ? { text: q } : q || {}))
    .map(q => ({ text: String(q.text ?? q.question ?? "").trim(), went: q.went == null || q.went === "" ? null : String(q.went), notes: String(q.notes ?? "").trim() }))
    .filter(q => q.text);
  if (qs.length > LIMITS.questions) throw err(400, "too_many", `At most ${LIMITS.questions} questions a round.`);
  for (const q of qs) {
    if (q.text.length > LIMITS.question || q.notes.length > LIMITS.notes) throw err(400, "too_long", `A question is at most ${LIMITS.question} characters.`);
    if (q.went != null && !WENT.includes(q.went)) throw err(400, "bad_went", `How it went is one of: ${WENT.join(", ")}.`);
  }
  // ⭐ D150 T12 (45n): topics (≤ 10 short words), the company + level by its application, and the EXPLICIT pool consent
  // (only a literal true; never assumed) — a consented debrief rebuilds that company's guide (k ≥ 3 people).
  const topics = (Array.isArray(body.topics) ? body.topics : []).map(t => String(t).trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  const poolConsent = body.poolConsent === true ? 1 : 0;
  const { companyKey, level } = companyOfApplication(db, userId, applicationId);
  const saved = db.transaction(() => {
    const id = Number(db.prepare(`INSERT INTO interview_debriefs (user_id, application_id, round, held_on, went, notes) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(userId, applicationId, round, heldOn, went, notes.trim()).lastInsertRowid);
    try { db.prepare(`UPDATE interview_debriefs SET company_key = ?, level = ?, topics_json = ?, pool_consent = ? WHERE id = ?`).run(companyKey, level, JSON.stringify(topics), poolConsent, id); }
    catch (e) { if (!/no such column/.test(String(e?.message))) throw e; }
    const qi = db.prepare(`INSERT INTO interview_questions (user_id, debrief_id, round, question, went, notes) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const q of qs) qi.run(userId, id, round, q.text, q.went, q.notes);
    return readDebrief(db, userId, id);
  })();
  if (poolConsent && companyKey) { try { rebuildCompanyGuide(db, companyKey); } catch (e) { console.warn("[company-guides]", e.message); } }
  return saved;
}

export function readDebrief(db, userId, debriefId) {
  const d = db.prepare(`SELECT * FROM interview_debriefs WHERE id = ? AND user_id = ?`).get(Number(debriefId), userId);
  if (!d) return null;
  return { id: d.id, applicationId: d.application_id, round: d.round, heldOn: d.held_on, went: d.went, notes: d.notes, createdAt: d.created_at,
    questions: db.prepare(`SELECT id, question, went, notes FROM interview_questions WHERE debrief_id = ? AND user_id = ? ORDER BY id`).all(d.id, userId) };
}

export function listDebriefs(db, userId, { applicationId = null } = {}) {
  const ids = db.prepare(`SELECT id FROM interview_debriefs WHERE user_id = ? ${applicationId != null ? "AND application_id = ?" : ""} ORDER BY COALESCE(held_on, '') DESC, id DESC LIMIT 200`)
    .pluck().all(...(applicationId != null ? [userId, Number(applicationId)] : [userId]));
  return ids.map(id => readDebrief(db, userId, id));
}

export function deleteDebrief(db, userId, debriefId) {
  return db.prepare(`DELETE FROM interview_debriefs WHERE id = ? AND user_id = ?`).run(Number(debriefId), userId).changes > 0;
}

/** ⛔ The user's OWN question bank — every row is theirs (user_id), with the company and role it was asked for. */
export function questionBank(db, userId, { round = null } = {}) {
  const args = round ? [userId, String(round)] : [userId];
  return db.prepare(`SELECT q.id, q.round, q.question, q.went, q.notes, d.held_on AS heldOn, d.application_id AS applicationId,
      COALESCE(rj.posting_company, sj.company) AS company, COALESCE(rj.posting_title, sj.title) AS title
    FROM interview_questions q JOIN interview_debriefs d ON d.id = q.debrief_id AND d.user_id = q.user_id
    LEFT JOIN application_records ar ON ar.id = d.application_id AND ar.user_id = q.user_id
    LEFT JOIN apply_run_jobs rj ON rj.id = (SELECT id FROM apply_run_jobs WHERE user_id = q.user_id AND job_id = ar.job_id ORDER BY id DESC LIMIT 1)
    LEFT JOIN scraped_jobs sj ON sj.job_id = ar.job_id
    WHERE q.user_id = ? ${round ? "AND q.round = ?" : ""} ORDER BY q.id DESC LIMIT 500`).all(...args);
}

// ── ⭐ D167 · Interview → Coming up ──────────────────────────────────────────────────────────
//
// One Inbox, two views (owner 11-06, "the Inbox stays in Home"): every application an Interview or Assessment email was
// matched to (D103 forwarding / D112 Gmail), each with D110's prep summary — the date the user gave, or the ONE date an
// email states plainly, never guessed. Mail matched to no application is not here: it waits in Home's Inbox to be
// attached. Order: dated and ahead (soonest first), then undated (newest mail first), then dated and past. ⛔ The user's
// own rows only.
export function upcomingInterviews(db, userId, { nowSec = now(), limit = 20 } = {}) {
  let ids = [];
  try {
    ids = db.prepare(`SELECT application_id FROM inbox_messages WHERE user_id = ? AND application_id IS NOT NULL
        AND category IN ('interview', 'assessment') GROUP BY application_id ORDER BY MAX(received_at) DESC, MAX(id) DESC LIMIT ?`)
      .pluck().all(userId, Math.max(1, Math.min(100, Number(limit) || 20)));
  } catch { ids = []; }   // before the inbox's migration
  const out = [];
  for (const id of ids) {
    const rec = ownRecord(db, userId, id);
    if (!rec) continue;
    const s = prepSummary(db, userId, rec.id, { nowSec });
    if (!s.active) continue;
    const posting = postingOf(db, rec);
    const mail = s.triggerMessageId != null
      ? db.prepare(`SELECT subject, received_at AS receivedAt FROM inbox_messages WHERE id = ? AND user_id = ?`).get(s.triggerMessageId, userId) : null;
    out.push({ applicationId: rec.id, jobId: rec.job_id, company: posting.company, title: posting.title, kind: s.kind,
      date: s.date ? { ymd: s.date.ymd, time: s.date.time ?? null, source: s.date.source } : null, daysLeft: s.daysLeft,
      subject: mail?.subject ?? null, receivedAt: mail?.receivedAt ?? null });
  }
  const rank = (x) => (x.daysLeft == null ? 1 : x.daysLeft >= 0 ? 0 : 2);
  return out.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x)
    || (rank(a.x) === 0 ? a.x.daysLeft - b.x.daysLeft : rank(a.x) === 2 ? b.x.daysLeft - a.x.daysLeft : a.i - b.i)).map(({ x }) => x);
}

// ── the Prep tab's whole read ────────────────────────────────────────────────────────────────

function triggerMail(db, userId, applicationId) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT id, subject, body_text AS body, from_domain AS fromDomain, received_at AS receivedAt, category FROM inbox_messages
      WHERE user_id = ? AND application_id = ? AND category IN ('interview', 'assessment') ORDER BY received_at DESC, id DESC LIMIT 10`).all(userId, Number(applicationId));
  } catch { rows = []; }
  return rows;
}

/** GET /api/interview/prep/:applicationId — null when the application is not this user's. */
export function readPrep(db, userId, applicationId, { status = null, nowSec = now() } = {}) {
  const rec = ownRecord(db, userId, applicationId);
  if (!rec) return null;
  const summary = prepSummary(db, userId, rec.id, { status, nowSec });
  const posting = postingOf(db, rec);
  const mail = triggerMail(db, userId, rec.id);
  return {
    applicationId: rec.id, jobId: rec.job_id, title: posting.title, company: posting.company,
    ...summary,
    skills: skillGaps(db, userId, rec),
    ...likelyRounds({ postingText: posting.description, emails: mail }),
    stories: listStories(db, userId),
    debriefs: listDebriefs(db, userId, { applicationId: rec.id }),
  };
}

// ── P4 · the connector's data pack — DATA ONLY (Directory Policy §2F; D86 DR-1, DR-4, DR-10, DR-14) ──────────────
//
// What the user's own Claude receives to run a mock interview: the job's basics and a short capped posting summary
// (untrusted text, neutralised), the profile's experience and skills (no contact details, no Application defaults —
// DR-14), the gap list, the rounds and platform read by rule, the user's own stories and their own past questions.
// Every free-text field is passed through untrustedText. There is no instruction, prompt, guidance or rules field:
// how to interview is the static Skill's (docs/plugin-skills/mock-interview/SKILL.md).

export const PACK_CAPS = Object.freeze({ experience: 8, bullets: 4, stories: 12, questions: 30, skills: 30 });
const capText = (s, n) => untrustedText(s ?? "", n).text;

/** By the JOB id (the connector's other tools name jobs, not application records). Null when the user has no record for it. */
export function connectorPack(db, userId, jobId, { nowSec = now() } = {}) {
  const rec = db.prepare(`SELECT * FROM application_records WHERE user_id = ? AND job_id = ?`).get(userId, String(jobId ?? ""));
  if (!rec) return null;
  const summary = prepSummary(db, userId, rec.id, { nowSec });
  const posting = postingOf(db, rec);
  const mail = triggerMail(db, userId, rec.id);
  const { rounds, platform } = likelyRounds({ postingText: posting.description, emails: mail });
  let experience = [], skills = [];
  try {
    experience = db.prepare(`SELECT company, title, start_ym, end_ym, is_current, bullets_json FROM profile_experience WHERE user_id = ? ORDER BY position, id LIMIT ?`)
      .all(userId, PACK_CAPS.experience).map(r => ({ company: capText(r.company, 120), title: capText(r.title, 120), start: r.start_ym, end: r.is_current ? "present" : r.end_ym,
        bullets: parse(r.bullets_json, []).slice(0, PACK_CAPS.bullets).map(b => capText(b, 300)) }));
    skills = db.prepare(`SELECT name FROM profile_skills WHERE user_id = ? ORDER BY position, id LIMIT ?`).pluck().all(userId, PACK_CAPS.skills).map(s => capText(s, 60));
  } catch { /* no profile yet */ }
  return {
    job_id: String(rec.job_id),
    job: { title: posting.title, company: posting.company, required_skills: posting.skills.slice(0, PACK_CAPS.skills),
      posting_summary: { source: "the employer's posting, as data", text: capText(posting.description, 600) } },
    stage: summary.active ? summary.kind : null,
    date: summary.date ? { date: summary.date.ymd, time: summary.date.time, source: summary.date.source } : null,
    days_left: summary.daysLeft ?? null,
    rounds: rounds.map(r => ({ round: r.round, read_from: r.evidence.map(e => e.from) })),
    platform: platform ? { name: platform.name, format: platform.format } : null,
    profile: { experience, skills },
    gaps: skillGaps(db, userId, rec).map(g => ({ skill: g.name, status: g.status })),
    stories: listStories(db, userId).slice(0, PACK_CAPS.stories).map(s => ({ title: capText(s.title, 120), themes: s.themes,
      situation: capText(s.situation, 600), task: capText(s.task, 600), action: capText(s.action, 600), result: capText(s.result, 600) })),
    past_questions: questionBank(db, userId).slice(0, PACK_CAPS.questions).map(q => ({ round: q.round, question: capText(q.question, 300), went: q.went })),
  };
}

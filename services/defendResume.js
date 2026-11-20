// services/defendResume.js — ⭐ D142 DEFEND (module four of four) · "Every line you wrote, asked about" (owner 11-02: "especially
// if we want them to defend their answers then and there"; the approved sketch docs/sketches/Interview.html → Defend your résumé:
// "The coach picks a bullet and asks the follow-ups an interviewer would").
//
// For each bullet of the person's base résumé: the follow-up an interviewer would ask, and a HARDER one after it ("what was the
// bottleneck? why that fix?"). Every question comes from a TEMPLATE filled with what the bullet itself holds — nothing is
// generated:
//   · the plausibility checks' flags (services/atsPlausibility.js → the scorer package: a technology the employer's own postings
//     never mention, one that came out after the role ended, work of a kind the employer does not post, a team too big for the
//     title or the company) — asked first, because they are the lines most likely to be probed;
//   · the honesty check's readers (services/honestyCheck.js, D141): a number the person will be asked to back, and a scope word
//     (led, owned, spearheaded …);
//   · the technologies the bullet names (the vocabulary the plausibility check reads);
//   · and, for every bullet, the sketch's own question ("Which part are you proudest of, and what would you do differently?").
// The bullets with the most to defend come first; a bullet with nothing but the sketch's question keeps its résumé order.
// ⛔ D190: nothing here calls a model. ⛔ Nothing is stored: the person's typed answers stay in their browser (the panel).
import { experienceEntries, techMentionedIn, ALL_ECOSYSTEM_TECH } from "@draft/ats-scorer";
import { plausibilityFor } from "./atsPlausibility.js";
import { honestyCheck, resumeLines, scopeWordsIn } from "./honestyCheck.js";
import { getBaseResumeRecord } from "./simpleApplyProfile.js";
import { TECHNOLOGIES } from "../shared/techVocabulary.js";

export const DEFEND_VERSION = "1.0.0";
export const MAX_BULLETS = 40;
export const MAX_QUESTIONS = 4;   // per bullet, the sketch's question included
const VOCAB = [...new Set([...TECHNOLOGIES.map(t => t[0]), ...ALL_ECOSYSTEM_TECH])];

const norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
const at = (employer) => (employer ? ` at ${employer}` : "");

/**
 * THE TEMPLATES — one per kind of thing a bullet can hold. `ask` is the interviewer's first follow-up, `harder` the one after
 * the answer; `because` is the line the person sees under the question (why it will be asked). Each reads only `c` — the
 * bullet's own facts: { tech, n, number, word, employer, title, year, end }.
 */
export const TEMPLATES = Object.freeze({
  timeline: {
    ask: (c) => `${c.tech} came out in ${c.year}, after this role ended${c.end ? ` in ${c.end}` : ""}. What did you actually use, and how?`,
    harder: (c) => `If I called your old team${at(c.employer)}, what would they say the stack was?`,
    because: (c) => `${c.tech} did not exist yet when this role ended.`,
  },
  tech: {
    ask: (c) => `Where exactly did ${c.tech} run${at(c.employer)}, and what was it replacing?`,
    harder: (c) => `What broke the first time you ran ${c.tech} in production, and how did you find out?`,
    because: (c) => `${c.employer || "This employer"}'s own postings never mention ${c.tech}.`,
  },
  domain: {
    ask: (c) => `Walk me through a normal week of this work${at(c.employer)}: who asked for it, and who used what you made?`,
    harder: () => `What is one thing about this kind of work that someone who never did it would get wrong?`,
    because: (c) => `${c.employer || "This employer"}'s postings are in other kinds of work.`,
  },
  role: {
    ask: (c) => `How was the team of ${c.n} set up: who reported to you, and who did you report to?`,
    harder: () => `Tell me about one person on that team who was struggling. What did you do?`,
    because: (c) => `Leading ${c.n} people is a claim interviewers check against the title and the company.`,
  },
  number: {
    ask: (c) => `How did you measure ${c.number}? What was it before, and over what period?`,
    harder: () => `What else changed at the same time that could explain that number?`,
    because: (c) => `A number you will be asked to back: ${c.number}.`,
  },
  scope: {
    ask: (c) => `You say "${c.word}". What exactly was your part, and who else was on it?`,
    harder: () => `What was one decision you made that someone above you disagreed with, and how did it end?`,
    because: (c) => `"${c.word}" is a scope word; interviewers ask what you personally did.`,
  },
  skill: {
    ask: (c) => `Why ${c.tech} here, and not something else?`,
    harder: (c) => `What was the bottleneck with ${c.tech}, and why that fix rather than another?`,
    because: (c) => `You name ${c.tech} on this line.`,
  },
  // The sketch's own question, for every bullet (docs/sketches/Interview.html → Defend).
  proud: {
    ask: () => `Which part of this are you proudest of, and what would you do differently?`,
    harder: () => `What was the hardest problem in it, and how did you know your fix worked?`,
    because: () => `Interviewers ask this about any line.`,
  },
});
const ORDER = ["timeline", "tech", "domain", "role", "number", "scope", "skill"];

const ask = (kind, c) => {
  const t = TEMPLATES[kind];
  return { kind, ask: t.ask(c), harder: t.harder(c), because: t.because(c) };
};

/**
 * Pure. The follow-ups for every bullet of a résumé's text.
 * @param {object} o { text, plausibility? — plausibilityFor's result for the same text (its flags carry the bullet they are on) }
 * @returns {{ version, bullets: [{ id, text, employer, title, skills, signals, questions: [{ kind, ask, harder, because }] }], total }}
 */
export function defendQuestions({ text, plausibility = null } = {}) {
  const body = String(text ?? "");
  // The bullets, with their employer and title when the experience section names them (the package's reader); otherwise the
  // honesty check's own line reader (a résumé with no experience heading still has bullets).
  let rows = experienceEntries(body).flatMap(e => (e.bullets || []).map(b => ({ text: b, employer: e.parts?.[0] || null, title: e.title || null, end: e.ongoing ? null : e.end ?? null })));
  if (!rows.length) rows = resumeLines(body).filter(l => l.kind === "bullet").map(l => ({ text: l.text, employer: null, title: null, end: null }));
  // The honesty check's numbers, by the bullet they are on (no original: every number is one to back).
  const numbers = new Map();
  for (const l of honestyCheck({ resumeText: body }).lines) {
    const f = l.flags.find(x => x.kind === "number");
    if (f) numbers.set(norm(l.text), f.terms);
  }
  // The plausibility flags, by bullet (the flag carries its bullet's text and the entry's employer).
  const flagsBy = new Map();
  for (const e of plausibility?.entries || []) {
    for (const f of e.flags || []) {
      const k = norm(f.bullet);
      if (!flagsBy.has(k)) flagsBy.set(k, []);
      flagsBy.get(k).push({ ...f, employer: e.employer || null, end: e.end ?? null });
    }
  }
  const seen = new Set();
  const out = [];
  rows.forEach((r, i) => {
    const key = norm(r.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const skills = techMentionedIn(r.text, VOCAB);
    const signals = [];
    for (const f of flagsBy.get(key) || []) {
      const year = f.kind === "timeline" ? Number(/came out in (\d{4})/.exec(f.reason || "")?.[1]) || null : null;
      const n = f.kind === "role" ? Number(/Leading (\d+)/.exec(f.reason || "")?.[1]) || null : null;
      signals.push({ kind: f.kind, c: { tech: f.tech || null, year, n, end: f.end ?? r.end, employer: f.employer || r.employer }, reason: f.reason || null });
    }
    // A measured number (%, $, ×, k / m) is the one asked about; a bare count ("a team of 8", "3 product teams") is not a
    // measurement, and "how did you measure 8?" is not a question anyone asks.
    const metric = (numbers.get(key) || []).find(x => /[%$€£×xkmb+]/i.test(x)) || null;
    if (metric) signals.push({ kind: "number", c: { number: metric } });
    const word = scopeWordsIn(r.text)[0];
    if (word) signals.push({ kind: "scope", c: { word } });
    const flaggedTech = new Set(signals.filter(s => s.c.tech).map(s => s.c.tech));
    for (const tech of skills) if (!flaggedTech.has(tech)) signals.push({ kind: "skill", c: { tech, employer: r.employer } });
    signals.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const ctx = (s) => ({ employer: r.employer, title: r.title, ...s.c });
    // One question per kind (the first of each), so a line with three technologies still gets its number and its scope asked.
    const kinds = new Set();
    const picked = signals.filter(s => (kinds.has(s.kind) ? false : (kinds.add(s.kind), true)));
    const questions = [...picked.slice(0, MAX_QUESTIONS - 1).map(s => ask(s.kind, ctx(s))), ask("proud", {})];
    out.push({ id: `b${i + 1}`, text: r.text, employer: r.employer, title: r.title, skills,
      signals: signals.filter(s => s.kind !== "skill").map(s => ({ kind: s.kind, reason: s.reason || TEMPLATES[s.kind].because(ctx(s)) })),
      questions, order: i });
  });
  // The lines with the most to defend first (a plausibility flag outweighs a number or a scope word); ties keep résumé order.
  const weight = (b) => b.signals.reduce((w, s) => w + (["timeline", "tech", "domain", "role"].includes(s.kind) ? 3 : 1), 0);
  out.sort((a, b) => weight(b) - weight(a) || a.order - b.order);
  const bullets = out.slice(0, MAX_BULLETS).map(({ order, ...b }) => b);
  return { version: DEFEND_VERSION, bullets, total: out.length };
}

/** The person's base résumé (the active job profile's; else their newest profile's; else the legacy one) — or null. Read only. */
export function baseResumeText(db, userId) {
  const profile = db.prepare(`SELECT id FROM domain_profiles WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC LIMIT 1`).get(userId);
  const rec = profile?.id ? getBaseResumeRecord(db, { userId, profileId: profile.id, seedLegacy: false }) : null;
  const text = rec?.content || getBaseResumeRecord(db, userId)?.content || null;
  return text && String(text).trim() ? String(text) : null;
}

/** GET /api/interview/defend — `{ hasResume: false }` when there is nothing to read. */
export function defendFor(db, userId) {
  const text = baseResumeText(db, userId);
  if (!text) return { version: DEFEND_VERSION, hasResume: false, bullets: [], total: 0 };
  let plausibility = null;
  try { plausibility = plausibilityFor(db, { userId, text }); } catch { plausibility = null; }   // a warning source — never blocks the questions
  return { hasResume: true, ...defendQuestions({ text, plausibility }) };
}

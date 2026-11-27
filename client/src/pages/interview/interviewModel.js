// ⭐ D167 (owner 11-06, docs/sketches/Interview.html — "taken as approved", changeable) · the Interview page's own
// navigation, and its pure helpers. Addresses: /app/interview/<id> (canonical); /interview/<id> forwards to it.
//
// ⛔ NOTHING INVENTED. Each panel draws only what the server holds today: Coming up is GET /api/interview/upcoming (the
// Inbox's interview / assessment mail matched to applications, D103 / D112 → D110's prep summary); Tracks by round and the
// story bank are D110's own question bank and stories; Drills open D142's readiness check; Defend is GET
// /api/interview/defend (D142 module four, 46y: each base-résumé bullet's follow-ups, from templates); Debrief is D110 P5.
// What is planned and not built — company guides (D150 T12–T13), the mock interview and the coach (D161), past practice
// sessions — says so plainly, and points at what exists now, if anything does.

export const INTERVIEW_BASE = "/app/interview";

export const INTERVIEW_GROUPS = Object.freeze([
  { label: "Coming up", items: [{ id: "upcoming", label: "Your interviews" }] },
  { label: "Prepare", items: [
    { id: "guides", label: "Company guides" },
    { id: "tracks", label: "Tracks by round" },
  ] },
  { label: "Practise", items: [
    { id: "mock", label: "Mock interview" },
    { id: "coach", label: "Ask the coach" },
    { id: "drills", label: "Drills" },
    { id: "defend", label: "Defend your résumé" },
  ] },
  { label: "After", items: [
    { id: "past", label: "Past sessions" },
    { id: "debrief", label: "Debrief" },
  ] },
]);

export const INTERVIEW_PANEL_IDS = Object.freeze(INTERVIEW_GROUPS.flatMap(g => g.items.map(i => i.id)));
export const INTERVIEW_DEFAULT = "upcoming";

// ⭐ D197 Wave 2 #13 (47m, M5) · PROVING GROUND: the area nav's four VIEWS are today's four groups; the nine panel ids stay
// valid forever (D200 Rule 1) and each opens its view scrolled to its section (docs/revamp/interview.md I0.3).
export const INTERVIEW_VIEWS = Object.freeze([
  { id: "upcoming", label: "Coming up", icon: "progress" },
  { id: "prepare", label: "Prepare", icon: "list" },
  { id: "practise", label: "Practise", icon: "interview" },
  { id: "after", label: "After", icon: "replies" },
]);
/** Every address id → [its view, the section it scrolls to (null = the view's top)]. */
export const INTERVIEW_HOMES = Object.freeze({
  upcoming: ["upcoming", null], prepare: ["prepare", null], practise: ["practise", null], after: ["after", null],
  guides: ["prepare", "iv-guides"], tracks: ["prepare", "iv-rounds"],
  mock: ["practise", "iv-mock"], coach: ["practise", "iv-mock"], drills: ["practise", "iv-drills"], defend: ["practise", "iv-defend"],
  past: ["after", "iv-past"], debrief: ["after", "iv-debrief"],
});
const ADDRESS_IDS = Object.keys(INTERVIEW_HOMES);
export const interviewViewOf = (id) => (INTERVIEW_HOMES[id] || INTERVIEW_HOMES[INTERVIEW_DEFAULT])[0];
export const interviewSectionOf = (id) => (INTERVIEW_HOMES[id] || [null, null])[1];

export const interviewPath = (id) => `${INTERVIEW_BASE}/${ADDRESS_IDS.includes(id) ? id : INTERVIEW_DEFAULT}`;

/** "interview/debrief" → "debrief"; "interview/practise" → "practise"; "interview" + "#tracks" → "tracks";
 *  "interview/nope" → null; not Interview → undefined. */
export function interviewPanelFor(routeKey, hash = "") {
  const m = /^interview(?:\/([^/]+))?\/?$/.exec(String(routeKey || ""));
  if (!m) return undefined;
  if (m[1]) return ADDRESS_IDS.includes(m[1]) ? m[1] : null;
  const h = String(hash || "").replace(/^#/, "");
  return ADDRESS_IDS.includes(h) ? h : INTERVIEW_DEFAULT;
}

/** The rounds the sketch practises, and the D110 bank round each one reads (null: the bank has no such round). */
export const TRACKS = Object.freeze([
  { id: "recruiter", label: "Recruiter screen", bank: null },
  { id: "coding", label: "Coding", bank: "coding" },
  { id: "system_design", label: "System design", bank: "system_design" },
  { id: "behavioural", label: "Behavioural", bank: "behavioural" },
  { id: "ai_coding", label: "AI-enabled coding", bank: null },
]);

/** How many of the user's own questions each bank round holds. */
export function bankCounts(questions = []) {
  const out = {};
  for (const q of questions) if (q?.round) out[q.round] = (out[q.round] || 0) + 1;
  return out;
}

/** "Today", "Tomorrow", "In 4 days", "3 days ago" — or null when there is no date (never guessed). */
export function whenWords(daysLeft) {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return null;
  if (daysLeft === 0) return "Today";
  if (daysLeft === 1) return "Tomorrow";
  if (daysLeft > 1) return `In ${daysLeft} days`;
  if (daysLeft === -1) return "Yesterday";
  return `${-daysLeft} days ago`;
}

/** The Coming up headline, counted from what arrived — "Two interviews to prepare for" is the sketch's shape. */
export function upcomingHeadline(items = []) {
  const ahead = items.filter(i => !(i.daysLeft != null && i.daysLeft < 0)).length;
  if (!items.length) return "No interviews yet";
  if (!ahead) return "Nothing coming up right now";
  return ahead === 1 ? "One interview to prepare for" : `${ahead} interviews to prepare for`;
}

// ⭐ D142 DEFEND (46y) · where the person is in Defend: a line (bullet), one of its questions, and its stage — "ask" (the
// follow-up, waiting), "answering" (out loud or typed), "harder" (the harder follow-up after the answer). Pure.
export const DEFEND_START = Object.freeze({ line: 0, q: 0, stage: "ask", mode: null });

/** The next position: after "harder", the line's next question; after its last, the next line (wrapping to the first). */
export function defendNext(pos, bullets = []) {
  const n = bullets.length;
  if (!n) return DEFEND_START;
  const qs = bullets[pos.line]?.questions?.length || 0;
  if (pos.stage === "ask") return pos;
  if (pos.stage === "answering") return { ...pos, stage: "harder" };
  if (pos.q + 1 < qs) return { line: pos.line, q: pos.q + 1, stage: "ask", mode: null };
  return { line: (pos.line + 1) % n, q: 0, stage: "ask", mode: null };
}

/** Another line, any time: the next one, its first question. */
export const defendAnotherLine = (pos, bullets = []) => (bullets.length ? { line: (pos.line + 1) % bullets.length, q: 0, stage: "ask", mode: null } : DEFEND_START);

/** "0:42" — the out-loud clock (it counts up; nothing is scored by it). */
export function clockWords(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

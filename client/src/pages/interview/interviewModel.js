// ⭐ D167 (owner 11-06, docs/sketches/Interview.html — "taken as approved", changeable) · the Interview page's own
// navigation, and its pure helpers. Addresses: /app/interview/<id> (canonical); /interview/<id> forwards to it.
//
// ⛔ NOTHING INVENTED. Each panel draws only what the server holds today: Coming up is GET /api/interview/upcoming (the
// Inbox's interview / assessment mail matched to applications, D103 / D112 → D110's prep summary); Tracks by round and the
// story bank are D110's own question bank and stories; Drills open D142's readiness check; Debrief is D110 P5. What is
// planned and not built — company guides (D150 T12–T13), the mock interview and the coach (D161), Defend (D142 module
// four), past practice sessions — says so plainly, and points at what exists now, if anything does.

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

export const interviewPath = (id) => `${INTERVIEW_BASE}/${INTERVIEW_PANEL_IDS.includes(id) ? id : INTERVIEW_DEFAULT}`;

/** "interview/debrief" → "debrief"; "interview" + "#tracks" → "tracks"; "interview/nope" → null; not Interview → undefined. */
export function interviewPanelFor(routeKey, hash = "") {
  const m = /^interview(?:\/([^/]+))?\/?$/.exec(String(routeKey || ""));
  if (!m) return undefined;
  if (m[1]) return INTERVIEW_PANEL_IDS.includes(m[1]) ? m[1] : null;
  const h = String(hash || "").replace(/^#/, "");
  return INTERVIEW_PANEL_IDS.includes(h) ? h : INTERVIEW_DEFAULT;
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

// services/audit/auditSession.js — ⭐ D150 T05–T07 (45l) · THE 3-MINUTE AUDIT: "Do you clear the bar?"
//
// T05 · the audit (public, no sign-in): pick a role T04 can audit (auditRoles) and a level → SIX scenario questions from the
//       owner-approved bank (learn_questions, live only), one at a time; after each answer the WHY of the chosen choice,
//       and of the right one when wrong (recordAnswer judges on the server — the correct choice never leaves before the
//       answer). An anonymous TOKEN is the only key: no résumé, no account, nothing personal; an unclaimed session is
//       deleted after 30 days (purgeUnclaimed, on every start).
// T06 · the result: per skill STRONG (every item on it right) or TO WORK ON — never a grade; "n of 6"; what closes the
//       distance = the Learn pieces and Atlas pages linked to the MISSED items only; the open roles that match the bar
//       (the role card's own count) — signed in, the board filtered to the role.
// T07 · keep it: a signed-in person claims the token ONCE — the result is theirs, the role becomes the navigator's
//       destination (setAim), the skills they were strong on become CHECKED on Your skills (skill_proofs via 'audit'),
//       and the missed ones are what the route then shows (the navigator reads the gaps against the aim).
// ⛔ D17: no model. ⛔ Copy: "strong / to work on", never a score out of 100 or a pass / fail.
import crypto from "node:crypto";
import { auditRoles, roleCard } from "./auditRoleCard.js";
import { questions, servedQuestion, recordAnswer } from "../learn/learnQuestions.js";
import { learnContent } from "../learn/learnContent.js";
import { learnStepInfo, learnStepPath } from "../learn/learnLinks.js";
import { skillKey } from "../yourSkills.js";

export const AUDIT = Object.freeze({ QUESTIONS: 6, PURGE_DAYS: 30 });
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function purgeUnclaimed(db, now = Math.floor(Date.now() / 1000)) {
  try { return db.prepare(`DELETE FROM audit_sessions WHERE claimed_at IS NULL AND created_at < ?`).run(now - AUDIT.PURGE_DAYS * 86400).changes; }
  catch { return 0; }
}

/** Six live items for the role: the level's first, then any level; at most two per skill so the six cover the role. */
export function pickItems(db, bankRole, level, { seed = "", count = AUDIT.QUESTIONS } = {}) {
  const all = questions(db, { role: bankRole });
  const rank = (q) => crypto.createHash("sha1").update(`${seed}:${q.id}`).digest("hex");
  const ordered = [...all].sort((a, b) => (Number(b.level === level) - Number(a.level === level)) || rank(a).localeCompare(rank(b)));
  const perSkill = new Map(), out = [];
  for (const q of ordered) {
    if (out.length >= count) break;
    const s = q.skills[0] || "";
    if ((perSkill.get(s) || 0) >= 2) continue;
    perSkill.set(s, (perSkill.get(s) || 0) + 1);
    out.push(q);
  }
  for (const q of ordered) { if (out.length >= count) break; if (!out.includes(q)) out.push(q); }
  return out;
}

const sessionOf = (db, token) => {
  if (!TOKEN_RE.test(String(token || ""))) return null;
  const s = db.prepare(`SELECT * FROM audit_sessions WHERE token = ?`).get(String(token));
  return s ? { ...s, items: JSON.parse(s.item_ids_json), answers: JSON.parse(s.answers_json || "[]") } : null;
};

/** T05 · start: { token, role card, total, number, question }. */
export function startAudit(db, { slug, level = null }, { now = Math.floor(Date.now() / 1000) } = {}) {
  purgeUnclaimed(db, now);
  const role = auditRoles(db).find(r => r.slug === String(slug || ""));
  if (!role) throw bad(404, "not_auditable", "We can't audit that role yet.");
  const lv = level && role.levels.includes(level) ? level : (role.levels.includes("mid") ? "mid" : role.levels[0] || null);
  const token = crypto.randomBytes(24).toString("base64url");
  const items = pickItems(db, role.bankRole, lv, { seed: token });
  if (items.length < 3) throw bad(409, "too_few_questions", "This role doesn't have enough reviewed questions yet.");
  db.prepare(`INSERT INTO audit_sessions (token, role_slug, bank_role, level, item_ids_json, answers_json, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?)`)
    .run(token, role.slug, role.bankRole, lv, JSON.stringify(items.map(q => q.id)), now);
  return { token, role: { slug: role.slug, title: role.title, level: lv }, card: roleCard(db, role.slug, { level: lv }),
    total: items.length, number: 1, question: servedQuestion(items[0]) };
}

/** T05 · answer the current question: the why now; the next question, or done. */
export function answerAudit(db, token, { questionId, chosen, ms = null }) {
  const s = sessionOf(db, token);
  if (!s) throw bad(404, "no_session", "This audit has ended — start again.");
  const at = s.answers.length;
  if (at >= s.items.length) throw bad(409, "finished", "This audit is finished.");
  if (String(questionId) !== s.items[at]) throw bad(409, "out_of_turn", "Answer the question on screen.");
  const { correct } = recordAnswer(db, { questionId, surface: "audit", chosen: Number(chosen), ms });
  const [q] = questions(db, { ids: [questionId] });
  const answers = [...s.answers, { id: questionId, chosen: Number(chosen), correct }];
  db.prepare(`UPDATE audit_sessions SET answers_json = ? WHERE token = ?`).run(JSON.stringify(answers), s.token);
  const done = answers.length >= s.items.length;
  const next = done ? null : questions(db, { ids: [s.items[answers.length]] })[0];
  return {
    correct, chosen: Number(chosen), correctIndex: q.correct,
    why: { chosen: q.why[Number(chosen)] || null, right: correct ? null : q.why[q.correct] || null, rightChoice: correct ? null : q.choices[q.correct] },
    number: answers.length + (done ? 0 : 1), total: s.items.length, done,
    question: next ? servedQuestion(next) : null,
  };
}

/** T06 · the result. `deps.atlasLinksFor(db, names)` gives Atlas pages for skills (optional). */
export function auditResult(db, token, { atlasLinksFor = null } = {}) {
  const s = sessionOf(db, token);
  if (!s) throw bad(404, "no_session", "This audit has ended — start again.");
  if (s.answers.length < s.items.length) throw bad(409, "not_finished", "Finish the questions first.");
  const items = questions(db, { ids: s.items });
  const byId = new Map(items.map(q => [q.id, q]));
  const skills = new Map();   // skill → { right, of }
  const missedPieces = new Set(), missedSkills = new Set();
  for (const a of s.answers) {
    const q = byId.get(a.id);
    if (!q) continue;
    for (const sk of q.skills) { const e = skills.get(sk) || { right: 0, of: 0 }; e.of++; if (a.correct) e.right++; skills.set(sk, e); }
    if (!a.correct) { q.pieces.forEach(p => missedPieces.add(p)); q.skills.forEach(sk => missedSkills.add(sk)); }
  }
  const words = (k) => String(k).replace(/-/g, " ");
  const strong = [...skills].filter(([, e]) => e.right === e.of).map(([k]) => words(k));
  const toWork = [...skills].filter(([, e]) => e.right < e.of).map(([k]) => words(k));
  let learn = null; try { learn = learnContent(db); } catch { learn = null; }
  const closes = [];
  for (const p of missedPieces) {
    const info = learn ? (() => { try { return learnStepInfo(learn, p); } catch { return null; } })() : null;
    if (info) closes.push({ kind: "learn", label: info.title || info.label || p, path: learnStepPath(p) });
  }
  if (atlasLinksFor) {
    try { for (const a of atlasLinksFor(db, [...missedSkills].map(words), 6)) closes.push({ kind: "atlas", label: a.name, path: `/atlas/${a.slug}` }); } catch { /* no Atlas */ }
  }
  const right = s.answers.filter(a => a.correct).length;
  let card = null; try { card = roleCard(db, s.role_slug, { level: s.level }); } catch { card = null; }   // the result stands without the card
  return {
    role: { slug: s.role_slug, title: card?.title || s.bank_role, level: s.level },
    right, of: s.items.length, strong, toWork, closes,
    line: `${right} of ${s.items.length}${strong.length ? ` · strong on ${strong.slice(0, 2).join(" and ")}` : ""}${toWork.length ? ` · to work on: ${toWork.slice(0, 2).join(" and ")}` : ""}`,
    openRoles: card?.openThisWeek ?? null,
    share: `I'm ${right} of ${s.items.length} on the ${s.level ? `${s.level} ` : ""}${card?.title || s.bank_role} bar — do you clear it?`,
    claimed: !!s.claimed_at,
  };
}

/** T07 · keep it — once. Returns the result, now the person's. */
export function claimAudit(db, token, userId, { setAim = null, now = Math.floor(Date.now() / 1000), atlasLinksFor = null } = {}) {
  const s = sessionOf(db, token);
  if (!s) throw bad(404, "no_session", "This audit has ended — start again.");
  if (s.claimed_at) throw bad(409, "already_kept", "This result has already been kept.");
  const result = auditResult(db, token, { atlasLinksFor });
  db.transaction(() => {
    const r = db.prepare(`UPDATE audit_sessions SET claimed_by = ?, claimed_at = ? WHERE token = ? AND claimed_at IS NULL`).run(userId, now, s.token);
    if (!r.changes) throw bad(409, "already_kept", "This result has already been kept.");
    // The skills they were strong on become CHECKED on Your skills (D169), proven by the audit.
    for (const sk of result.strong) {
      db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (?, ?, ?, 'checked', 'audit', ?)`)
        .run(userId, skillKey(sk), sk, now);
    }
  })();
  // The role becomes the navigator's destination (D143); its route then reads the gaps.
  let aimed = false;
  if (setAim) { try { setAim(db, userId, s.role_slug, { now }); aimed = true; } catch { aimed = false; } }
  return { ...result, claimed: true, aimed };
}

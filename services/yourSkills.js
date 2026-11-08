// services/yourSkills.js — ⭐ D169 · YOUR SKILLS LIVE IN ATLAS, ON THE SEMANTIC LAYER — and a skill is proven before it goes
// into a résumé (owner 11-06, APPROVED, revisable: *"yes, we can change this later, mark as such"*).
//
// P1 · ONE PANEL, TWO VIEWS OF THE SAME DATA. A person's skill is a POSITION on the Atlas: each one is resolved to its
//      published node by the Atlas's own resolve (D105 P5 resolveTerms — the term or a confirmed alias in skill_synonyms,
//      the one thesaurus). ⛔ An unknown skill is HELD FOR THE CURATOR (atlas_skill_holds) — never invented as a node.
//      List = manage (add · remove · prove, the state claimed · checked · built, its proof); Map = explore (the same
//      skills against the market — what's near, what opens the most roles, the gaps for the target — from D116's map).
// P2 · GATE THE USE, NOT THE ADDING. Adding stays open: a new skill lands as CLAIMED (profile_skills, the Profile's own
//      list — so it counts on the map at once). ⛔ A skill that is NOT on the person's résumé is never written into a
//      tailored résumé until it is PROVEN, by one of:
//        · a QUICK CHECK — 3–5 questions from D150's bank (learn_questions, the ONE reader questions()) for that skill's
//          Atlas node, inline, D142 Check's rules: the clock is the SERVER's, the answer key never leaves before the
//          answer, timed / EXTENDED (×2) / UNTIMED — extended and untimed are never penalised → CHECKED;
//        · a BUILD — the skill's Learn piece earned (D117 C8's earned rule; D142 Close's builds join here) → BUILT;
//        · a PROOF LINK — D109's validated https link, "supplied by the candidate", draft certifies nothing → BUILT.
//      No questions for a skill → proof is a link or a build; until then it reads "not yet checked", still counts on the
//      map, is offered for Defend practice, and stays out of generated résumés.
//      The gate is resumeClaims(): what draft SENDS to the tailoring service (resume-master) and what the BYOM patch guard
//      accepts as the candidate's claims. Scoring is unchanged (a claim still counts toward the ATS score, D152 (8)).
// ⛔ D17: no model. ⛔ Not a certificate: a check is self-awareness; nothing here is shown to an employer.

import { resolveTerms, aliasesOf, termOf, readNode } from "./atlas/atlasStore.js";
import { atlasIndex, computeYourMap } from "./atlas/atlasMe.js";
import { nodeLearnStates } from "./atlas/atlasTree.js";
import { learnStepForNode, learnStepPath } from "./learn/learnLinks.js";
import { questions, servedQuestion, recordAnswer } from "./learn/learnQuestions.js";
import { listProfileClaims, setProfileSignalClaim } from "./profileSignalAggregator.js";
import { checkEvidence, EVIDENCE_KINDS } from "./proofLinks.js";
import { readProfile } from "./structuredProfile.js";

/** ⭐ D169 · every threshold of Your skills — tuned here and nowhere else. */
export const YOUR_SKILLS = Object.freeze({
  /** a quick check asks at least this many questions — fewer live items for a skill = "no questions yet" */
  MIN_QUESTIONS: 3,
  /** …and at most this many ("≈ a minute") */
  MAX_QUESTIONS: 5,
  /** passed = at least this share answered right (and in time, in timed mode) */
  PASS_SHARE: 0.6,
  /** D142's timer: a scenario (judgment) question's seconds, a recall question's (the 10-second round) */
  SCENARIO_SECONDS: 75,
  RECALL_SECONDS: 10,
  /** the network's share of a timed answer (D142's GRACE_MS) */
  GRACE_MS: 1500,
  /** ⛔ ACCESSIBILITY (D142): extended time doubles every clock; untimed has none — neither is ever penalised */
  EXTENDED_FACTOR: 2,
  MODES: Object.freeze(["timed", "extended", "untimed"]),
  /** a typed skill: at most this many characters */
  NAME_MAX: 60,
});

/** ⭐ D169 P1 · the Profile's ONE line about skills (the Profile keeps résumés, job profiles, answers, settings). */
export const PROFILE_SKILLS_LINE = Object.freeze({ text: "Your skills live in Atlas — add, check and prove them there.", path: "/app/atlas/skills" });

export const STATES = Object.freeze(["claimed", "checked", "built"]);
const RANK = { claimed: 0, checked: 1, built: 2 };
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
export const skillKey = (s) => termOf(String(s ?? "")) || String(s ?? "").trim().toLowerCase();
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── on the résumé ──────────────────────────────────────────────────────────────────────────────

/** The text a tailored résumé is made from: the active job profile's base résumé, else the account's base. */
export function baseResumeText(db, userId) {
  const row = safe(() => db.prepare(`SELECT pbr.content FROM profile_base_resumes pbr JOIN domain_profiles dp ON dp.id = pbr.profile_id
      WHERE pbr.user_id = ? AND dp.is_active = 1 AND TRIM(COALESCE(pbr.content, '')) != '' LIMIT 1`).get(userId), null)
    || safe(() => db.prepare(`SELECT content FROM base_resume WHERE user_id = ? AND TRIM(COALESCE(content, '')) != ''`).get(userId), null);
  return row?.content || "";
}

const plain = (text) => String(text ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").toLowerCase();

/** PURE. Does the text name this term as a whole word ("Java" is not in "JavaScript"; "C++" and "C#" work)? */
export function textNamesTerm(text, term) {
  const t = String(term ?? "").toLowerCase().trim();
  if (!t) return false;
  return new RegExp(`(^|[^a-z0-9+#])${esc(t)}(?![a-z0-9+#])`, "i").test(plain(text));
}

/** Is this skill on the résumé — by its own words, its normalised term, or a confirmed alias? */
export function skillOnResume(db, resumeText, name) {
  if (!String(resumeText ?? "").trim()) return false;
  const term = skillKey(name);
  const forms = new Set([clean(name).toLowerCase(), term, ...safe(() => aliasesOf(db, term), [])]);
  for (const f of forms) if (textNamesTerm(resumeText, f)) return true;
  return false;
}

// ── proof ──────────────────────────────────────────────────────────────────────────────────────

const better = (a, b) => (!a ? b : !b ? a : RANK[b.state] > RANK[a.state] || (RANK[b.state] === RANK[a.state] && (b.at || 0) > (a.at || 0)) ? b : a);

/**
 * Every skill's best proof: skill_proofs (a passed quick check · a proof link), D142's checks passed at PASS_SHARE, and a
 * Learn piece earned (built). @returns Map(skillKey → { state: 'checked' | 'built', via: 'check' | 'build' | 'link', … })
 */
export function proofsOf(db, userId) {
  const out = new Map();
  const put = (key, p) => out.set(key, better(out.get(key), p));
  for (const r of safe(() => db.prepare(`SELECT * FROM skill_proofs WHERE user_id = ? ORDER BY created_at, id`).all(userId), [])) {
    put(r.skill_key, { state: r.state, via: r.via, url: r.url || null, label: r.label || null, kind: r.kind || null, at: r.created_at });
  }
  // D142's adaptive checks: counted as CHECKED only when passed at the same share (a check is awareness; a pass is proof).
  for (const r of safe(() => db.prepare(`SELECT skill_key, finished_at, summary_json FROM readiness_checks WHERE user_id = ? AND finished_at IS NOT NULL`).all(userId), [])) {
    const s = safe(() => JSON.parse(r.summary_json), null);
    const asked = (s?.concepts || []).reduce((a, c) => a + (c.asked || 0), 0), right = (s?.concepts || []).reduce((a, c) => a + (c.right || 0), 0);
    if (asked && right / asked >= YOUR_SKILLS.PASS_SHARE) put(r.skill_key, { state: "checked", via: "check", at: r.finished_at });
  }
  // BUILT: the skill's Learn piece earned (D117 C8 — opened, explained, the build linked), read by the tree's own reader.
  const idx = safe(() => atlasIndex(db), null);
  if (idx) {
    for (const [id, l] of safe(() => nodeLearnStates(db, userId, idx), new Map())) {
      if (!l?.state?.complete) continue;
      const n = idx.byId.get(id);
      if (n?.term) put(n.term, { state: "built", via: "build", at: null });
    }
  }
  return out;
}

const proven = (p) => p?.state === "checked" || p?.state === "built";

// ── the question bank, per skill ───────────────────────────────────────────────────────────────

/** The live, auto-gradable items of D150's bank that evidence this Atlas node (explain items are never auto-graded). */
export function quickPool(db, slug) {
  if (!slug) return [];
  return safe(() => questions(db, { skills: [slug] }), []).filter(q => q.type !== "explain" && q.type !== "match" && q.type !== "order");
}
function liveCountsBySlug(db) {
  const out = new Map();
  for (const q of safe(() => questions(db, {}), [])) {
    if (q.type === "explain" || q.type === "match" || q.type === "order") continue;
    for (const s of q.skills) out.set(s, (out.get(s) || 0) + 1);
  }
  return out;
}

// ── the list ───────────────────────────────────────────────────────────────────────────────────

/** The active job profile's id, or null. */
function activeProfileId(db, userId) {
  return safe(() => db.prepare(`SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1`).pluck().get(userId), null) ?? null;
}

/** The Profile's skills exist once it has been opened — open it the way the Profile does (D120 P1: from the résumé). */
function ensureProfileSkills(db, userId) {
  if (safe(() => db.prepare(`SELECT 1 FROM profile_sections WHERE user_id = ?`).get(userId), null)) return;
  safe(() => readProfile(db, userId), null);
}

/** The person's skills, in the Profile's order, then the ones claimed on an ATS report ("That's true of me"). */
function skillNames(db, userId, { seed = true } = {}) {
  // Your skills seeds an empty Profile from the résumé (D169); a READ elsewhere (Your map, D178-2) never writes.
  if (seed) ensureProfileSkills(db, userId);
  const out = new Map();
  for (const r of safe(() => db.prepare(`SELECT name, source FROM profile_skills WHERE user_id = ? ORDER BY position, id`).all(userId), [])) {
    const k = skillKey(r.name);
    if (k && !out.has(k)) out.set(k, { name: clean(r.name), from: "profile" });
  }
  const pid = activeProfileId(db, userId);
  if (pid != null) {
    for (const s of safe(() => listProfileClaims(db, { userId, profileId: pid }).skills, [])) {
      const k = skillKey(s);
      if (k && !out.has(k)) out.set(k, { name: clean(s), from: "posting" });
    }
  }
  return out;
}

/**
 * ⭐ D178-2 · the person's skills as Your skills reads them — the Profile's list AND the skills claimed on postings — each
 * with its D169 state (claimed · checked · built). Your map counts from this, so the two never disagree.
 * @returns [{ name, key, state }]
 */
export function yourSkillStates(db, userId) {
  const proofs = proofsOf(db, userId);
  return [...skillNames(db, userId, { seed: false }).entries()].map(([key, n]) => ({ name: n.name, key, state: proofs.get(key)?.state || "claimed" }));
}

function lineFor(e) {
  const p = e.proof;
  if (e.state === "built") return p?.via === "link" ? `proof: ${p.label || "a link you added"}` : "built: its Learn piece is earned";
  if (e.state === "checked") return e.onResume ? "on your résumé · passed its check" : "passed its quick check";
  if (e.onResume) return "on your résumé · not checked yet";
  if (!e.checkAvailable) return "not yet checked · no questions yet: add proof or build it";
  return "not on your résumé yet · check it to use it in a tailored résumé";
}

/**
 * ⭐ THE LIST — every skill the person has, resolved to its Atlas node, with its state and its proof.
 * @returns {{ skills: Entry[], counts: { total, claimed, checked, built, held }, profileLine }}
 *   Entry: { name, key, from, node: { slug, name } | null, held, onResume, state, proof, checkAvailable, questions,
 *            learn: { path, label } | null, inResume, defendOffered, action: 'check' | 'proof' | null, line }
 */
export function listYourSkills(db, userId) {
  const names = skillNames(db, userId);
  const slugs = safe(() => resolveTerms(db, [...names.values()].map(n => n.name)), {});
  const text = baseResumeText(db, userId);
  const proofs = proofsOf(db, userId);
  const live = liveCountsBySlug(db);
  const nameOf = db.prepare(`SELECT name, term FROM atlas_nodes WHERE slug = ?`);
  const skills = [...names.entries()].map(([key, n]) => {
    const slug = slugs[n.name] || null;
    const nodeRow = slug ? safe(() => nameOf.get(slug), null) : null;
    const proof = proofs.get(key) || null;
    const questionsN = slug ? (live.get(slug) || 0) : 0;
    const checkAvailable = questionsN >= YOUR_SKILLS.MIN_QUESTIONS;
    const step = nodeRow ? safe(() => learnStepForNode(db, { name: nodeRow.name, term: nodeRow.term }), null) : null;
    const onResume = skillOnResume(db, text, n.name);
    const state = proof?.state || "claimed";
    const e = { name: n.name, key, from: n.from, node: slug ? { slug, name: nodeRow?.name || n.name } : null, held: !slug,
      onResume, state, proof, checkAvailable, questions: questionsN,
      learn: step ? { path: learnStepPath(step.stepId), label: step.label || step.title || null } : null,
      // ⛔ D169 P2: on the résumé already, or proven — nothing else goes into a tailored résumé.
      inResume: onResume || proven(proof),
      defendOffered: !proven(proof),
      action: state === "claimed" ? (checkAvailable ? "check" : "proof") : null };
    return { ...e, line: lineFor(e) };
  });
  const count = (s) => skills.filter(x => x.state === s).length;
  return { skills, counts: { total: skills.length, claimed: count("claimed"), checked: count("checked"), built: count("built"), held: skills.filter(s => s.held).length },
    profileLine: PROFILE_SKILLS_LINE, proofKinds: EVIDENCE_KINDS };
}

/** One entry of the list, by key (or null). */
export function yourSkill(db, userId, key) {
  return listYourSkills(db, userId).skills.find(s => s.key === skillKey(key)) || null;
}

// ── add · remove ───────────────────────────────────────────────────────────────────────────────

/** Hold an unknown skill for the curator — once per person and term. ⛔ Never a node. */
export function holdForCurator(db, userId, name) {
  const term = skillKey(name);
  if (!term) return false;
  if (safe(() => db.prepare(`SELECT 1 FROM atlas_skill_holds WHERE user_id = ? AND term = ?`).get(userId, term), null)) return false;
  return safe(() => db.prepare(`INSERT INTO atlas_skill_holds (user_id, term, name) VALUES (?, ?, ?)`).run(userId, term, clean(name)).changes > 0, false);
}

/**
 * ⭐ P2: ADDING STAYS OPEN — the skill lands as CLAIMED on the Profile's list (so it counts on the map at once). Resolved to
 * its node when the Atlas has one; held for the curator when it hasn't.
 */
export function addSkill(db, userId, { name } = {}) {
  const n = clean(name);
  if (!n || !/[\p{L}\p{N}]/u.test(n)) throw bad(400, "bad_skill", "Type a skill, for example Terraform.");
  if (n.length > YOUR_SKILLS.NAME_MAX) throw bad(400, "bad_skill", `A skill is at most ${YOUR_SKILLS.NAME_MAX} characters.`);
  ensureProfileSkills(db, userId);
  const key = skillKey(n);
  const slug = safe(() => resolveTerms(db, [n])[n], null);
  // Resolved to a node: the list keeps the Atlas's own name for it ("kafka" → "Kafka"), so the map and the résumé gate
  // read one spelling; an unknown skill keeps the person's wording.
  const nodeName = slug ? safe(() => db.prepare(`SELECT name FROM atlas_nodes WHERE slug = ?`).pluck().get(slug), null) : null;
  const have = db.prepare(`SELECT name FROM profile_skills WHERE user_id = ?`).pluck().all(userId).some(x => skillKey(x) === key);
  if (!have) {
    const pos = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 FROM profile_skills WHERE user_id = ?`).pluck().get(userId);
    db.prepare(`INSERT INTO profile_skills (user_id, name, category, position, source) VALUES (?, ?, NULL, ?, 'user')`).run(userId, nodeName || n, pos);
  }
  const held = !slug && holdForCurator(db, userId, n);
  return { added: !have, held: !slug, newlyHeld: held, skill: yourSkill(db, userId, key) };
}

/** Remove a skill from the person's list — and withdraw it where it was claimed on an ATS report (AG2's reversible call). */
export function removeSkill(db, userId, { key } = {}) {
  const k = skillKey(key);
  if (!k) throw bad(400, "bad_skill", "Which skill?");
  let removed = 0;
  for (const r of db.prepare(`SELECT id, name FROM profile_skills WHERE user_id = ?`).all(userId)) {
    if (skillKey(r.name) === k) removed += db.prepare(`DELETE FROM profile_skills WHERE id = ?`).run(r.id).changes;
  }
  const pid = activeProfileId(db, userId);
  if (pid != null) {
    for (const label of safe(() => listProfileClaims(db, { userId, profileId: pid }).skills, [])) {
      if (skillKey(label) !== k) continue;
      safe(() => setProfileSignalClaim(db, { userId, profileId: pid, kind: "skill", label, claimed: false }), null);
      removed++;
    }
  }
  if (!removed) throw bad(404, "not_found", "That skill is not on your list.");
  return { removed: true, key: k };
}

/** The curator's desk: every held term still without a published node, with how many people typed it. */
export function curatorHolds(db, { limit = 200 } = {}) {
  const rows = safe(() => db.prepare(`SELECT term, MIN(name) AS name, COUNT(DISTINCT user_id) AS people, MIN(held_at) AS firstAt, MAX(held_at) AS lastAt
      FROM atlas_skill_holds GROUP BY term ORDER BY people DESC, lastAt DESC LIMIT ?`).all(Math.max(1, Math.min(1000, limit))), []);
  const resolved = safe(() => resolveTerms(db, rows.map(r => r.term)), {});
  return rows.filter(r => !resolved[r.term]);
}

// ── the quick check (D142 Check's rules on D150's bank) ─────────────────────────────────────────

const secondsFor = (q, mode) => {
  if (mode === "untimed") return null;
  const base = q.type === "recall" ? YOUR_SKILLS.RECALL_SECONDS : YOUR_SKILLS.SCENARIO_SECONDS;
  return mode === "extended" ? base * YOUR_SKILLS.EXTENDED_FACTOR : base;
};
const served = (q, mode) => ({ ...servedQuestion(q), seconds: secondsFor(q, mode) });

/** Start a quick check on one of the person's skills. @returns {{ checkId, skill, mode, question, number, of }} */
export function startQuickCheck(db, userId, { skill, mode = "timed", now = Date.now(), random = Math.random } = {}) {
  if (!YOUR_SKILLS.MODES.includes(mode)) throw bad(400, "bad_mode", "Pick timed, extended time, or untimed practice.");
  const n = clean(skill);
  if (!n) throw bad(400, "bad_skill", "Which skill?");
  const slug = safe(() => resolveTerms(db, [n])[n], null);
  if (!slug) throw bad(404, "no_node", `${n} is not on the Atlas yet, so there are no questions for it — add proof or build it instead.`);
  const pool = quickPool(db, slug);
  if (pool.length < YOUR_SKILLS.MIN_QUESTIONS) throw bad(404, "no_questions", `There are no questions for ${n} yet — add proof or build it instead.`);
  const order = pool.map(q => [random(), q]).sort((a, b) => a[0] - b[0]).map(([, q]) => q).slice(0, YOUR_SKILLS.MAX_QUESTIONS);
  const id = Number(db.prepare(`INSERT INTO skill_quick_checks (user_id, skill_key, skill, slug, mode, question_ids_json, position, served_at, started_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`).run(userId, skillKey(n), n, slug, mode, JSON.stringify(order.map(q => q.id)), now, Math.floor(now / 1000)).lastInsertRowid);
  return { checkId: id, skill: n, mode, question: served(order[0], mode), number: 1, of: order.length };
}

/** PURE. The end of a quick check: passed or not, in words — never a grade. */
export function quickSummary(answers, { skill, mode }) {
  const right = answers.filter(a => a.credit).length, asked = answers.length;
  const late = answers.filter(a => a.correct && !a.credit).length;
  const passed = asked >= YOUR_SKILLS.MIN_QUESTIONS && right / asked >= YOUR_SKILLS.PASS_SHARE;
  const line = passed
    ? `Passed: ${right} of ${asked}. ${skill} is checked, and can now go into a tailored résumé.`
    : `${right} of ${asked} this time${late ? ` (${late} right but past the timer)` : ""}. ${skill} stays claimed — try again whenever you like, or add proof.`;
  return { skill, mode, asked, right, late, passed, line, note: "This is for you — where you stand today, not a grade or a certificate." };
}

/**
 * Answer the question being asked. The server's clock decides "in time"; extended / untimed answers are never penalised.
 * @returns {{ correct, inTime, answer, why, question?, number?, summary?, skill? }}
 */
export function answerQuickCheck(db, userId, checkId, { questionId, chosen, now = Date.now() } = {}) {
  const c = db.prepare(`SELECT * FROM skill_quick_checks WHERE id = ? AND user_id = ?`).get(checkId, userId);
  if (!c) throw bad(404, "not_found", "No such check.");
  if (c.finished_at) throw bad(409, "finished", "This check is finished.");
  const ids = JSON.parse(c.question_ids_json);
  if (String(questionId) !== ids[c.position]) throw bad(409, "not_current", "That is not the question being asked.");
  const q = db.prepare(`SELECT * FROM learn_questions WHERE id = ?`).get(ids[c.position]);
  if (!q) throw bad(404, "no_question", "That question is not available any more.");
  const choices = JSON.parse(q.choices_json), why = JSON.parse(q.why_json);
  const picked = Number.isInteger(chosen) && chosen >= 0 && chosen < choices.length ? chosen : null;
  const ms = Math.max(0, now - c.served_at);
  const secs = secondsFor(q, c.mode);
  const inTime = secs == null || ms <= secs * 1000 + YOUR_SKILLS.GRACE_MS;
  const correct = picked === q.correct;
  // ONE BANK: the answer is the bank's too (its stats and T02's flags read it) — never a second store of right / wrong.
  if (picked != null) safe(() => recordAnswer(db, { questionId: q.id, userId, surface: "skills-check", chosen: picked, ms }), null);
  const answers = [...JSON.parse(c.answers_json || "[]"), { id: q.id, chosen: picked, correct, inTime, credit: correct && inTime }];
  const feedback = { correct, inTime, answer: q.correct, why: picked != null ? why[picked] : null, rightWhy: why[q.correct] };
  const next = c.position + 1;
  if (next < ids.length) {
    const nq = questions(db, { ids: [ids[next]] })[0] || db.prepare(`SELECT * FROM learn_questions WHERE id = ?`).get(ids[next]);
    db.prepare(`UPDATE skill_quick_checks SET position = ?, served_at = ?, answers_json = ? WHERE id = ?`).run(next, now, JSON.stringify(answers), c.id);
    const item = nq.choices ? nq : { id: nq.id, role: nq.role, level: nq.level, type: nq.type, skills: JSON.parse(nq.skills_json), stem: nq.stem, choices: JSON.parse(nq.choices_json) };
    return { ...feedback, question: served(item, c.mode), number: next + 1, of: ids.length };
  }
  const summary = quickSummary(answers, { skill: c.skill, mode: c.mode });
  db.transaction(() => {
    db.prepare(`UPDATE skill_quick_checks SET position = ?, served_at = NULL, answers_json = ?, finished_at = ?, passed = ? WHERE id = ?`)
      .run(next, JSON.stringify(answers), Math.floor(now / 1000), summary.passed ? 1 : 0, c.id);
    // ⭐ P2: passing moves the skill to CHECKED.
    if (summary.passed) db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, check_id, created_at) VALUES (?, ?, ?, 'checked', 'check', ?, ?)`)
      .run(userId, c.skill_key, c.skill, c.id, Math.floor(now / 1000));
  })();
  return { ...feedback, summary, skill: yourSkill(db, userId, c.skill_key) };
}

// ── a proof link (D109) ────────────────────────────────────────────────────────────────────────

/**
 * ⭐ P2: a proof link — D109's validator (https only, a real host, no credentials, a short label). → BUILT.
 * ⛔ draft certifies nothing: the link is what the candidate supplied; draft does not open it.
 */
export function addSkillProof(db, userId, { skill, url, kind = "repository", label = "" } = {}, now = Math.floor(Date.now() / 1000)) {
  const key = skillKey(skill);
  const mine = yourSkill(db, userId, key);
  if (!mine) throw bad(404, "not_found", "Add the skill first, then its proof.");
  const ev = checkEvidence({ kind, url, label });
  db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, url, label, kind, created_at) VALUES (?, ?, ?, 'built', 'link', ?, ?, ?, ?)`)
    .run(userId, key, mine.name, ev.url, ev.label, ev.kind, now);
  return { skill: yourSkill(db, userId, key) };
}

/** What a skill can be proven by, for the inline chooser (the ATS panel's "That's true of me" reads it). */
export function proveOptions(db, userId, { skill } = {}) {
  const n = clean(skill);
  if (!n) throw bad(400, "bad_skill", "Which skill?");
  const slug = safe(() => resolveTerms(db, [n])[n], null);
  const node = slug ? safe(() => readNode(db, slug), null) : null;
  const questionsN = slug ? quickPool(db, slug).length : 0;
  const step = node ? safe(() => learnStepForNode(db, { name: node.name, term: skillKey(node.name) }), null) : null;
  const mine = yourSkill(db, userId, n);
  return { skill: n, key: skillKey(n), node: slug ? { slug, name: node?.name || n } : null, checkAvailable: questionsN >= YOUR_SKILLS.MIN_QUESTIONS,
    questions: Math.min(questionsN, YOUR_SKILLS.MAX_QUESTIONS), learn: step ? { path: learnStepPath(step.stepId), label: step.label || step.title || null } : null,
    state: mine?.state || "claimed", onResume: mine?.onResume ?? skillOnResume(db, baseResumeText(db, userId), n), proofKinds: EVIDENCE_KINDS };
}

// ── ⛔ THE GATE: what goes into a tailored résumé ────────────────────────────────────────────────

/**
 * PURE over its inputs. Split skill names into those a tailored résumé may carry (on the résumé, or proven) and those it
 * may not yet. @returns {{ allowed: string[], held: string[] }}
 */
export function gateSkills(db, { names = [], resumeText = "", proofs = new Map() }) {
  const allowed = [], held = [];
  for (const s of names) (skillOnResume(db, resumeText, s) || proven(proofs.get(skillKey(s))) ? allowed : held).push(s);
  return { allowed, held };
}

/**
 * ⛔ D169 P2 · the claims draft SENDS to the tailoring service (resume-master) and hands the BYOM patch guard. A claimed
 * skill that is not on the base résumé goes only once proven (checked / built); action verbs are not skills and pass.
 * @returns {{ skills, actionVerbs, held }}
 */
export function resumeClaims(db, { userId, profileId, resumeText = null }) {
  const claims = profileId != null ? listProfileClaims(db, { userId, profileId }) : { skills: [], actionVerbs: [] };
  return gateClaimsForResume(db, { userId, claims, resumeText });
}

/** The same gate over a claims object already read ({ skills, actionVerbs } — listProfileClaims's shape). */
export function gateClaimsForResume(db, { userId, claims, resumeText = null }) {
  if (!claims) return claims;
  const text = resumeText ?? baseResumeText(db, userId);
  const { allowed, held } = gateSkills(db, { names: claims.skills || [], resumeText: text, proofs: proofsOf(db, userId) });
  return { skills: allowed, actionVerbs: claims.actionVerbs || [], held };
}

/**
 * ⛔ The same gate on the job profile's own tool list (domain_profiles.selected_tools — the old one-way "applied" path,
 * sent as profile.tools). Returns a COPY of the row with the unproven ones taken out; the stored row is never changed.
 */
export function gatedDomainProfile(db, { userId, domainProfile, resumeText = null }) {
  if (!domainProfile) return domainProfile;
  const tools = safe(() => JSON.parse(domainProfile.selected_tools || "[]"), []);
  if (!Array.isArray(tools) || !tools.length) return domainProfile;
  const text = resumeText ?? baseResumeText(db, userId);
  const { allowed } = gateSkills(db, { names: tools.map(String), resumeText: text, proofs: proofsOf(db, userId) });
  return allowed.length === tools.length ? domainProfile : { ...domainProfile, selected_tools: JSON.stringify(allowed) };
}

// ── the map ────────────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ THE MAP — the same skills against the market, from D116's map (GET /api/atlas/me's reader, nothing recomputed):
 * have (each with its state and postings), near (used_with neighbours), opens (roles the skills open, by coverage), gaps
 * (what the target's next level asks for). A claimed, unchecked skill COUNTS here (P2).
 */
export function yourSkillsMap(db, userId) {
  const list = listYourSkills(db, userId);
  const me = safe(() => computeYourMap(db, userId), { map: false, reason: "unavailable" });
  const idx = safe(() => atlasIndex(db), null);
  const postingsOf = new Map((idx?.nodes || []).map(n => [n.slug, n.postings || 0]));
  const have = list.skills.filter(s => s.node).map(s => ({ slug: s.node.slug, name: s.node.name, state: s.state, postings: postingsOf.get(s.node.slug) || 0 }))
    .sort((a, b) => b.postings - a.postings || a.name.localeCompare(b.name));
  const pick = (sec, f) => (sec?.items || []).map(f);
  return {
    map: !!me.map, reason: me.map ? null : (me.reason || null),
    target: me.targetRoles?.[0] || null,
    board: me.board || null,
    have,
    held: list.skills.filter(s => s.held).map(s => ({ name: s.name })),
    near: pick(me.adjacent, i => ({ slug: i.slug, name: i.name, postings: i.postings, line: i.line })),
    opens: pick(me.branches, i => ({ slug: i.slug, name: i.name, postings: i.postings, covered: i.covered, of: i.of, line: i.line })),
    gaps: pick(me.nextLevel, i => ({ slug: i.slug, name: i.name, postings: i.postings, line: i.line })),
    gapsReason: me.nextLevel?.reason || null,
  };
}

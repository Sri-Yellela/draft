// services/assistant/assistant.js — ⭐ T5 · THE ASSISTANT v1 (owner 11-10: "your rule that only résumé generation calls a
// model, OK ship it" — D17 lifted for the assistant; D162's gateway, D173 (1)'s fencing and the cost alarm apply).
// The rules it is built to: docs/ASSISTANT.md (D173 (2)/(3)) and D177 (Ask draft as the guide to Atlas).
//
//   retrieve(db, userId, question)   Atlas's own PUBLISHED lessons first (searchNodes over the question's terms), draft's
//                                    help (content/assistant/help.json), and the person's OWN facts (their skills, their
//                                    applications by state) — never another user's rows, never admin data.
//   ask(db, { userId, question, callTask, anthropic })
//                                    ONE gateway call (assistant.chat): the question and everything retrieved FENCED
//                                    (untrustedText.js); the answer is JSON — a short answer, ≤ 3 lessons, one next step,
//                                    at most one PROPOSED action. Lessons outside what was retrieved are dropped (links
//                                    only to lessons that exist); a link / email / phone the person didn't give withholds
//                                    the answer (D173). A proposed action is stored as `proposed` and runs ONLY when the
//                                    person presses Confirm (confirmAction, with the session's user id — never the model's).
//   the ask log (D177-3)             each learning question DE-IDENTIFIED (emails, phones, links, numbers, the person's own
//                                    name stripped) with covered / partial / gap — only when the person has not switched
//                                    off "Use my questions to improve Atlas"; never linked to the person.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchNodes, readNode } from "../atlas/atlasStore.js";
import { fenceUntrusted, UNTRUSTED_DATA_RULE, checkModelOutput, describeViolations } from "../untrustedText.js";
import { addSkill, yourSkillStates } from "../yourSkills.js";
import { sponsorshipFactFor } from "../kb/sponsorshipFacts.js";   // D190 T2: the company record, no model

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const HELP_FILE = path.join(ROOT, "content", "assistant", "help.json");
export const MAX_QUESTION = 600;
export const MAX_LESSONS = 3;
export const DAILY_ASKS = 40;
export const ACTION_TTL_SEC = 15 * 60;
export const ENABLED_KEY = "assistant_enabled";

// ── the tools (docs/ASSISTANT.md §1: namespaced, least privilege, read and act separate, no userId parameter) ─────────
// An act.* tool's `run(db, userId, args)` receives the user id from the SESSION (confirmAction's caller), never the model.
export const ACT_TOOLS = Object.freeze({
  "act.skills.add": Object.freeze({
    what: "add one skill to the person's Your skills list (as claimed)",
    args: (a) => { const name = String(a?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60); return name ? { name } : null; },
    summary: (a) => `Add “${a.name}” to Your skills`,
    run: (db, userId, a) => { const r = addSkill(db, userId, { name: a.name }); return { added: r.added, held: r.held }; },
  }),
});
const toolNames = new Set(Object.keys(ACT_TOOLS));
if (toolNames.size !== Object.keys(ACT_TOOLS).length) throw new Error("assistant: duplicate tool name");

let _help = null;
export function helpEntries() {
  if (_help) return _help;
  try { _help = JSON.parse(fs.readFileSync(HELP_FILE, "utf8")).entries || []; } catch { _help = []; }
  return _help;
}

const STOP = new Set("the a an and or of to in on for with what how why when where who which is are do does did can could should would i me my we you your it this that be about from into than then there their them as at by not no yes please tell explain show give learn need want get make use using".split(" "));
export function termsOf(question) {
  const words = String(question || "").toLowerCase().replace(/[^\p{L}\p{N}+#.\- ]/gu, " ").split(/\s+/).map(w => w.replace(/^[.\-]+|[.\-]+$/g, ""));
  const out = [];
  for (const w of words) if (w.length >= 2 && !STOP.has(w) && !out.includes(w)) out.push(w);
  // two-word phrases too ("machine learning", "project management")
  for (let i = 0; i + 1 < words.length; i++) { const p = `${words[i]} ${words[i + 1]}`; if (!STOP.has(words[i]) && !STOP.has(words[i + 1]) && words[i] && words[i + 1]) out.push(p); }
  return out.slice(0, 16);
}

/** What the answer may draw on. Lessons: published Atlas nodes only. Facts: the person's own. */
export function retrieve(db, userId, question) {
  const terms = termsOf(question);
  const seen = new Map();
  for (const t of terms) {
    for (const h of (() => { try { return searchNodes(db, t, { publishedOnly: true, limit: 3 }); } catch { return []; } })()) {
      if (!seen.has(h.slug)) seen.set(h.slug, h);
    }
    if (seen.size >= 6) break;
  }
  const lessons = [...seen.values()].slice(0, 6).map(h => {
    const n = (() => { try { return readNode(db, h.slug, { publishedOnly: true }); } catch { return null; } })();
    return { slug: h.slug, name: h.name, kind: h.kind, definition: String(n?.definition || n?.wiki?.extract || "").slice(0, 400) };
  });
  const words = new Set(terms);
  const help = helpEntries().filter(e => (e.keywords || []).some(k => words.has(String(k).toLowerCase()) || String(question).toLowerCase().includes(String(k).toLowerCase())))
    .slice(0, 3).map(e => ({ id: e.id, title: e.title, text: e.text, href: e.href || null }));
  const facts = {};
  try { facts.skills = db.prepare(`SELECT name FROM profile_skills WHERE user_id = ? ORDER BY position LIMIT 40`).pluck().all(userId); } catch { facts.skills = []; }
  try {
    facts.applications = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) AS n FROM apply_run_jobs WHERE user_id = ? GROUP BY status`).all(userId).map(r => [r.status, r.n]));
  } catch { facts.applications = {}; }
  return { terms, lessons, help, facts };
}

export function buildChatRequest({ question, retrieved }) {
  const lessonText = retrieved.lessons.map(l => `[lesson ${l.slug}] ${l.name} (${l.kind}): ${l.definition || "(no summary yet)"}`).join("\n");
  const helpText = retrieved.help.map(h => `[help ${h.id}] ${h.title}: ${h.text}`).join("\n");
  const factText = `Their skills: ${retrieved.facts.skills.join(", ") || "(none on the Profile)"}. Their applications by state: ${
    Object.entries(retrieved.facts.applications).map(([k, v]) => `${k} ${v}`).join(", ") || "(none)"}.`;
  const system = [
    "You are Ask draft, the assistant inside draft — a job-search site with a job board, an auto-apply helper and Atlas (lessons on skills, tools and roles).",
    "Answer from the material given below first. If it does not cover the question, say so plainly and answer briefly from general knowledge, marked as such. Never invent a draft feature, a lesson, a number or a link.",
    "Keep the answer short: at most 4 sentences, plain words.",
    `Pick at most ${MAX_LESSONS} lessons, ONLY by the slugs given in [lesson …] lines.`,
    "Give one next step the person can take on draft.",
    `You may PROPOSE at most one action, only from this list: ${[...toolNames].map(n => `${n} (${ACT_TOOLS[n].what})`).join("; ")}. The person confirms it before anything happens; never say it is done.`,
    "Say whether the material covered the question: covered, partial or gap.",
    'Reply with JSON only: {"answer": "...", "lessons": ["slug"], "next": "...", "action": null or {"tool": "act.…", "args": {…}}, "coverage": "covered" | "partial" | "gap"}',
    UNTRUSTED_DATA_RULE,
  ].join("\n");
  const user = [
    "The person's question:", fenceUntrusted("question", String(question).slice(0, MAX_QUESTION)),
    "Material retrieved for it (Atlas lessons and draft's help):", fenceUntrusted("retrieved", [lessonText, helpText].filter(Boolean).join("\n") || "(nothing found)"),
    `The person's own facts (from their Profile): ${factText}`,
  ].join("\n\n");
  return { system, messages: [{ role: "user", content: user }], untrusted: `${question}\n${lessonText}\n${helpText}` };
}

/** The model's JSON → the answer we may show. Pure. */
export function parseAnswer(text, { retrieved, own = "" }) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let j = null; try { j = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; } }
  if (!j || typeof j.answer !== "string" || !j.answer.trim()) return { ok: false, reason: "unreadable" };
  const allowed = new Map(retrieved.lessons.map(l => [l.slug, l]));
  const lessons = [...new Set(Array.isArray(j.lessons) ? j.lessons.map(String) : [])].filter(s => allowed.has(s)).slice(0, MAX_LESSONS)
    .map(s => ({ slug: s, name: allowed.get(s).name, kind: allowed.get(s).kind, href: `/atlas/${encodeURIComponent(s)}` }));
  let action = null;
  if (j.action && typeof j.action === "object" && toolNames.has(String(j.action.tool))) {
    const args = ACT_TOOLS[j.action.tool].args(j.action.args);
    if (args) action = { tool: String(j.action.tool), args };
  }
  const coverage = ["covered", "partial", "gap"].includes(j.coverage) ? j.coverage : (lessons.length ? "partial" : "gap");
  const answer = j.answer.trim().slice(0, 1200), next = typeof j.next === "string" ? j.next.trim().slice(0, 300) : "";
  const helpHrefs = retrieved.help.map(h => h.href).filter(Boolean).join(" ");
  const check = checkModelOutput(`${answer}\n${next}`, { own: `${own}\n${helpHrefs}`, untrusted: "", allowHosts: ["jobsviadraft.com"] });
  if (!check.ok) return { ok: false, reason: "withheld", detail: describeViolations(check.violations) };
  return { ok: true, answer, next, lessons, action, coverage };
}

// ── the ask log (D177-3) ─────────────────────────────────────────────────────────────────────────────────────────
export function deidentify(question, { names = [] } = {}) {
  let q = String(question || "").slice(0, MAX_QUESTION);
  q = q.replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[email]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[number]");
  for (const n of names.filter(x => x && String(x).trim().length >= 2)) {
    q = q.replace(new RegExp(`\\b${String(n).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[name]");
  }
  return q.replace(/\s+/g, " ").trim();
}

export function improveAtlasOn(db, userId) {
  try { const v = db.prepare(`SELECT improve_atlas FROM assistant_prefs WHERE user_id = ?`).pluck().get(userId); return v == null ? true : v === 1; }
  catch { return false; }   // no table: store nothing
}
export function setImproveAtlas(db, userId, on) {
  db.prepare(`INSERT INTO assistant_prefs (user_id, improve_atlas, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET improve_atlas = excluded.improve_atlas, updated_at = excluded.updated_at`).run(userId, on ? 1 : 0);
  return { improveAtlas: !!on };
}

function namesOf(db, userId) {
  try {
    const p = db.prepare(`SELECT full_name FROM user_profile WHERE user_id = ?`).pluck().get(userId);
    const u = db.prepare(`SELECT username FROM users WHERE id = ?`).pluck().get(userId);
    return [p, ...(String(p || "").split(/\s+/)), String(u || "").split("@")[0]].filter(Boolean);
  } catch { return []; }
}

export function logAsk(db, userId, question, { coverage, lessons, terms }) {
  if (!improveAtlasOn(db, userId)) return false;
  db.prepare(`INSERT INTO assistant_asks (question, coverage, lessons_json, terms_json) VALUES (?, ?, ?, ?)`)
    .run(deidentify(question, { names: namesOf(db, userId) }), coverage, JSON.stringify(lessons.map(l => l.slug)), JSON.stringify(terms.slice(0, 8)));
  return true;
}

/** Admin → Atlas → Asks: the gaps, most asked first (by term), and the latest asks. */
export function asksSummary(db, { days = 30 } = {}) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = db.prepare(`SELECT question, coverage, terms_json, at FROM assistant_asks WHERE at >= ? ORDER BY at DESC LIMIT 2000`).all(since);
  const byCoverage = { covered: 0, partial: 0, gap: 0 };
  const gapTerms = new Map();
  for (const r of rows) {
    byCoverage[r.coverage] = (byCoverage[r.coverage] || 0) + 1;
    if (r.coverage === "covered") continue;
    let t = []; try { t = JSON.parse(r.terms_json || "[]"); } catch { t = []; }
    for (const term of t.filter(x => !x.includes(" ")).slice(0, 3)) gapTerms.set(term, (gapTerms.get(term) || 0) + 1);
  }
  return { days, total: rows.length, byCoverage, topGaps: [...gapTerms].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([term, asks]) => ({ term, asks })),
    latest: rows.slice(0, 30).map(r => ({ question: r.question, coverage: r.coverage, at: r.at })) };
}

/** A gap term → the Atlas content backlog (D185-3's table), as a draft for the curator. */
export function gapToBacklog(db, term, { by = "admin" } = {}) {
  const t = String(term || "").trim().toLowerCase().slice(0, 80);
  if (!t) throw Object.assign(new Error("a term is required"), { status: 400 });
  const r = db.prepare(`INSERT INTO atlas_backlog (term, subcategory, signal_json, status, drafted_by, drafted_at) VALUES (?, 'asked', ?, 'draft', ?, unixepoch())
    ON CONFLICT(term, subcategory) DO NOTHING`).run(t, JSON.stringify({ from: "assistant_asks" }), String(by));
  return { term: t, added: r.changes > 0 };
}

// ── switch, limits, the call ──────────────────────────────────────────────────────────────────────────────────────
/**
 * ⭐ 46q (A212, owner 11-16: "link by verified email") · D95 made the admin a separate ADMIN ACCOUNT (its cookie is scoped to
 * /api/admin), so "admins always" could never reach an app session. An app account counts as the admin's own when its
 * VERIFIED email (users.email_verified_at, the user_profile email) is an active admin account's email (not disabled, a
 * password set). It opens T3 for that account only — no admin power, no other route.
 */
export function isAdminsOwnAccount(db, userId) {
  if (userId == null) return false;
  try {
    return !!db.prepare(`SELECT 1 FROM users u JOIN user_profile p ON p.user_id = u.id
      JOIN admin_accounts a ON a.email = p.email COLLATE NOCASE
      WHERE u.id = ? AND u.email_verified_at IS NOT NULL AND p.email IS NOT NULL AND TRIM(p.email) <> ''
        AND a.disabled_at IS NULL AND a.password_set_at IS NOT NULL LIMIT 1`).get(userId);
  } catch { return false; }
}
export function assistantAvailable(db, user) {
  if (user?.isAdmin || user?.is_admin || user?.role === "admin") return true;   // admins always (to try it before everyone)
  try { return /^(1|on|true)$/i.test(String(db.prepare(`SELECT value FROM app_settings WHERE key = ?`).pluck().get(ENABLED_KEY) ?? "")); }
  catch { return false; }
}
function asksToday(db, userId) {
  try {
    return db.prepare(`SELECT COUNT(*) FROM usage_events WHERE user_id = ? AND purpose = 'assistant_chat' AND created_at >= unixepoch('now', 'start of day')`).pluck().get(userId) || 0;
  } catch { return 0; }
}

export async function ask(db, { userId, question, callTask, anthropic, dataClass = "candidate" }) {
  const q = String(question ?? "").replace(/\s+/g, " ").trim();
  if (!q) throw Object.assign(new Error("Type a question."), { status: 400, code: "empty" });
  if (q.length > MAX_QUESTION) throw Object.assign(new Error(`A question is at most ${MAX_QUESTION} characters.`), { status: 400, code: "too_long" });
  if (asksToday(db, userId) >= DAILY_ASKS) throw Object.assign(new Error(`That's ${DAILY_ASKS} questions today — ask again tomorrow.`), { status: 429, code: "daily_limit" });
  const retrieved = retrieve(db, userId, q);
  const req = buildChatRequest({ question: q, retrieved });
  const message = await callTask({ task: "assistant.chat", anthropic, db, userId, dataClass, system: req.system, messages: req.messages });
  const text = String(message?.content?.[0]?.text || "");
  const parsed = parseAnswer(text, { retrieved, own: `${q}\n${retrieved.facts.skills.join(" ")}` });
  if (!parsed.ok) {
    if (parsed.reason === "withheld") console.warn(`[assistant] answer withheld (D173): ${parsed.detail}`);
    return { ok: false, message: parsed.reason === "withheld" ? "That answer was withheld: it carried a link or contact detail that isn't from you or draft. Try asking again." : "The answer could not be read. Try again." };
  }
  let proposed = null;
  if (parsed.action) {
    const tool = ACT_TOOLS[parsed.action.tool];
    const id = Number(db.prepare(`INSERT INTO assistant_actions (user_id, tool, args_json, summary) VALUES (?, ?, ?, ?)`)
      .run(userId, parsed.action.tool, JSON.stringify(parsed.action.args), tool.summary(parsed.action.args)).lastInsertRowid);
    proposed = { id, tool: parsed.action.tool, summary: tool.summary(parsed.action.args) };
  }
  try { logAsk(db, userId, q, { coverage: parsed.coverage, lessons: parsed.lessons, terms: retrieved.terms }); } catch (e) { console.warn("[assistant] ask not logged:", e.message); }
  return { ok: true, answer: parsed.answer, next: parsed.next, lessons: parsed.lessons, action: proposed, coverage: parsed.coverage,
    help: retrieved.help.filter(h => h.href).map(h => ({ title: h.title, href: h.href })) };
}

// ── ⭐ D190 · T2 — ANSWERS FROM draft's OWN DATA, WITH NO MODEL (the owner's rule, 11-14) ──────────────────────────────
// Ask draft's engine (shared/assistantEngine.js) sends here what its T2 rows name, and — for what no row matched — the
// question itself. Everything below is a read + a template sentence. ⛔ No callTask, no gateway, nothing leaves the server.
// `lookup` returns null when draft's data doesn't cover it; the panel then says so plainly and offers nothing from a model.
export const LOOKUP_INTENTS = Object.freeze(["drafted_today", "sponsorship", "my_skills", "question"]);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function lookup(db, userId, { intent, args = {}, question = "" } = {}) {
  if (intent === "drafted_today") {
    const row = db.prepare(`SELECT COUNT(*) AS drafted, SUM(CASE WHEN status IN ('submitted', 'interview', 'assessment', 'offer', 'rejected') THEN 1 ELSE 0 END) AS sent
      FROM apply_run_jobs WHERE user_id = ? AND created_at >= unixepoch('now', 'start of day')`).get(userId) || {};
    const drafted = Number(row.drafted) || 0, sent = Number(row.sent) || 0;
    return { tier: "T2", intent, text: drafted ? `Today you drafted ${plural(drafted, "job")}${sent ? `; ${sent} of them ${sent === 1 ? "has" : "have"} been sent` : ""}.` : "You haven't drafted a job today yet.",
      links: [{ title: "Your applications", href: "/app/auto-apply" }] };
  }
  if (intent === "sponsorship") {
    const company = String(args.company || "").trim().slice(0, 120);
    if (!company) return { tier: "ask", intent, text: "Which company? Say “does <company> sponsor?”, or open its posting and ask again." };
    let fact = null;
    try { fact = sponsorshipFactFor(db, company); } catch { fact = null; }
    if (!fact) return { tier: "T2", intent, text: `draft has no H-1B filing record it can show for ${company}. That isn't a no — it may file under another name, or not at all.` };
    return { tier: "T2", intent, text: `${company}: ${fact.text}.${fact.source?.through ? ` (US Department of Labor data through ${fact.source.through}.)` : ""}`,
      ...(fact.source?.url ? { links: [{ title: "The source file", href: fact.source.url }] } : {}) };
  }
  if (intent === "my_skills") {
    let states = [];
    try { states = yourSkillStates(db, userId); } catch { states = []; }
    if (!states.length) return { tier: "T2", intent, text: "Your skills list is empty. Add skills in Atlas → Your skills, or upload a résumé.", links: [{ title: "Your skills", href: "/atlas" }] };
    const proven = states.filter(s => s.state === "checked" || s.state === "built");
    const list = (xs) => xs.slice(0, 12).map(s => s.name).join(", ") + (xs.length > 12 ? `, and ${xs.length - 12} more` : "");
    return { tier: "T2", intent, text: proven.length
      ? `You've proven ${plural(proven.length, "skill")}: ${list(proven)}. ${plural(states.length - proven.length, "more is", "more are")} claimed but not checked yet.`
      : `You have ${plural(states.length, "skill")} (${list(states)}) — none proven yet. A quick check or a link to your work proves one.`,
      links: [{ title: "Your skills", href: "/atlas" }] };
  }
  if (intent === "question") {
    const q = String(question || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION);
    if (!q) return null;
    const r = retrieve(db, userId, q);
    const help = r.help[0] || null;
    // ⭐ A219 (46r, the 46q audit): a question draft's help answers is answered by the help ALONE. The Atlas lookup runs
    // on every word of the question, so "how does ask me first work?" also drew an unrelated card ("Atlas — API: …" on
    // production; "Work" on a fixture) — a wrong answer that reads as Tiny guessing. Atlas answers only what help doesn't.
    const lessons = help ? [] : r.lessons.slice(0, MAX_LESSONS);
    if (!help && !lessons.length) return null;
    const parts = [];
    if (help) parts.push(`${help.title}: ${help.text}`);
    if (lessons.length) {
      const top = lessons[0];
      parts.push(top.definition ? `Atlas — ${top.name}: ${top.definition.replace(/\s+/g, " ").slice(0, 280)}${top.definition.length > 280 ? "…" : ""}` : `Atlas has ${plural(lessons.length, "page")} on this.`);
    }
    return { tier: "T2", intent, text: parts.join("\n\n"),
      lessons: lessons.map(l => ({ slug: l.slug, name: l.name, kind: l.kind, href: `/atlas/${encodeURIComponent(l.slug)}` })),
      links: help?.href ? [{ title: help.title, href: help.href }] : [] };
  }
  return null;
}

/** The person pressed Confirm (or Cancel). `userId` is the SESSION's. Audited in assistant_actions. */
export function decideAction(db, userId, actionId, { confirm }) {
  const a = db.prepare(`SELECT * FROM assistant_actions WHERE id = ? AND user_id = ?`).get(Number(actionId), userId);
  if (!a) throw Object.assign(new Error("No such action."), { status: 404, code: "no_action" });
  if (a.status !== "proposed") throw Object.assign(new Error("This action was already decided."), { status: 409, code: "decided" });
  const now = Math.floor(Date.now() / 1000);
  if (now - a.proposed_at > ACTION_TTL_SEC) {
    db.prepare(`UPDATE assistant_actions SET status = 'expired', decided_at = ? WHERE id = ?`).run(now, a.id);
    throw Object.assign(new Error("This suggestion expired — ask again."), { status: 410, code: "expired" });
  }
  if (!confirm) { db.prepare(`UPDATE assistant_actions SET status = 'cancelled', decided_at = ? WHERE id = ?`).run(now, a.id); return { status: "cancelled" }; }
  const tool = ACT_TOOLS[a.tool];
  if (!tool) throw Object.assign(new Error("This action is no longer available."), { status: 410, code: "tool_gone" });
  try {
    const result = tool.run(db, userId, JSON.parse(a.args_json));
    db.prepare(`UPDATE assistant_actions SET status = 'done', result_json = ?, decided_at = ? WHERE id = ?`).run(JSON.stringify(result), now, a.id);
    return { status: "done", summary: a.summary, result };
  } catch (e) {
    db.prepare(`UPDATE assistant_actions SET status = 'failed', result_json = ?, decided_at = ? WHERE id = ?`).run(JSON.stringify({ error: e.message }), now, a.id);
    throw Object.assign(new Error(e.message || "The action failed."), { status: e.status || 500, code: "action_failed" });
  }
}

/** Profile → Privacy: the person's own audit log. */
export function actionLog(db, userId, { limit = 50 } = {}) {
  try {
    return db.prepare(`SELECT id, tool, summary, status, proposed_at, decided_at FROM assistant_actions WHERE user_id = ? ORDER BY id DESC LIMIT ?`).all(userId, Math.min(200, Number(limit) || 50));
  } catch { return []; }
}

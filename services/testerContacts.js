// 44b · WHO THE TESTERS ARE, AND WHAT THEY ASKED — the feedback loop (owner 11-02: "we are collecting names and emails
// but there is no details on this in the admin or the excel sheet, which we need if we want a feedback loop, because
// there are people asking questions too").
//
// ⛔ A RECORDED REVERSAL of D131's "no names anywhere; no emails in the export" — on the owner's word, for the admin
// only: Admin → Testers → People & questions and its CSV carry each person's name and email beside what they wrote, so a
// question can be answered. Every route here is requireAdmin; nothing of it reaches a tester or a public page.
//
// One row per PERSON: a trial account (its name and sign-up email, sample, drafts sent, where they are in the sequence,
// last active, every "Feedback" / "Something broke?" message from the dock, and their written survey answers) or a
// standalone survey respondent (name and email from /survey, their written answers). Accounts tagged test / internal and
// admins are left out by default (testersReport.excludedSets), counted apart.
import { excludedSets } from "./testersReport.js";
import { SURVEY, STANDALONE_SURVEY, SURVEY_AFTER_SENT } from "./survey.js";

const TEXT_KEYS = [...new Set([...SURVEY, ...STANDALONE_SURVEY]
  .flatMap(q => [q, ...(q.follow ? [q.follow] : [])])
  .filter(q => q.type === "text" && q.key !== "name").map(q => q.key))];
const LABEL = Object.fromEntries([...SURVEY, ...STANDALONE_SURVEY].flatMap(q => [q, ...(q.follow ? [q.follow] : [])]).map(q => [q.key, q.q]));

const parse = (s) => { try { return JSON.parse(s || "{}") || {}; } catch { return {}; } };
const all = (db, sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };

function written(answers) {
  return TEXT_KEYS.filter(k => typeof answers?.[k] === "string" && answers[k].trim())
    .map(k => ({ key: k, question: LABEL[k] || k, answer: answers[k].trim() }));
}

/** { people: [...], excluded: n } — newest activity first. */
export function testerContacts(db, { exclude = true } = {}) {
  const ex = exclude ? excludedSets(db) : { ids: new Set(), emails: new Set() };
  const users = all(db, `SELECT u.id, u.trial_at, u.trial_resume, u.trial_finished_at, u.trial_survey_dismissed_at,
      TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name, p.email,
      MAX(COALESCE((SELECT MAX(last_seen_at) FROM user_sessions s WHERE s.user_id = u.id), 0),
          COALESCE((SELECT MAX(last_seen_at) FROM auth_contexts a WHERE a.user_id = u.id), 0)) AS last_active
    FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE u.trial_at IS NOT NULL`);
  const sent = new Map(all(db, "SELECT user_id, COUNT(*) n FROM apply_run_jobs WHERE status = 'submitted' GROUP BY user_id").map(r => [r.user_id, r.n]));
  const surveys = new Map(all(db, "SELECT user_id, answers, created_at FROM trial_surveys").map(r => [r.user_id, r]));
  const feedback = new Map();
  for (const f of all(db, "SELECT user_id, screen, body, created_at FROM trial_feedback ORDER BY created_at")) {
    if (!feedback.has(f.user_id)) feedback.set(f.user_id, []);
    feedback.get(f.user_id).push({ at: f.created_at, screen: f.screen || null, body: f.body });
  }
  let excluded = 0;
  const people = [];
  for (const u of users) {
    if (ex.ids.has(u.id)) { excluded++; continue; }
    const drafts = sent.get(u.id) || 0;
    const s = surveys.get(u.id);
    const locked = !!u.trial_finished_at || drafts >= SURVEY_AFTER_SENT;
    const status = s ? "survey answered" : locked ? "survey due" : u.trial_resume ? "in the trial" : "signed up";
    const fb = feedback.get(u.id) || [];
    people.push({
      source: "trial", userId: u.id, name: u.name || "", email: u.email || "", signedUpAt: u.trial_at, sample: u.trial_resume || null,
      draftsSent: drafts, status, surveyAt: s?.created_at ?? null, lastActiveAt: u.last_active || null,
      feedback: fb, written: written(parse(s?.answers)),
      lastAt: Math.max(u.trial_at || 0, u.last_active || 0, s?.created_at || 0, ...fb.map(f => f.at)),
    });
  }
  for (const r of all(db, "SELECT name, email, answers, created_at, updated_at FROM standalone_surveys")) {
    if (ex.emails.has(String(r.email || "").toLowerCase())) { excluded++; continue; }
    people.push({
      source: "standalone survey", userId: null, name: r.name || "", email: r.email || "", signedUpAt: null, sample: null, draftsSent: null,
      status: "survey answered", surveyAt: r.created_at, lastActiveAt: null, feedback: [], written: written(parse(r.answers)),
      lastAt: r.updated_at || r.created_at,
    });
  }
  people.sort((a, b) => b.lastAt - a.lastAt);
  return { people, excluded, messages: people.reduce((n, p) => n + p.feedback.length, 0) };
}

const iso = (t) => (t ? new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16) + "Z" : "");

/** The same, as a spreadsheet: one row per person; their messages and written answers in two cells. */
export function testerContactsCsv(db, opts = {}) {
  const { people } = testerContacts(db, opts);
  const cell = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const cols = ["source", "name", "email", "status", "signed_up", "sample", "drafts_sent", "survey_at", "last_active",
    "messages", "questions_and_feedback", "written_survey_answers"];
  const rows = people.map(p => [p.source, p.name, p.email, p.status, iso(p.signedUpAt), p.sample ?? "", p.draftsSent ?? "",
    iso(p.surveyAt), iso(p.lastActiveAt), p.feedback.length,
    p.feedback.map(f => `[${iso(f.at)}${f.screen ? ` · ${f.screen}` : ""}] ${f.body}`).join("\n"),
    p.written.map(w => `${w.question} — ${w.answer}`).join("\n")].map(cell).join(","));
  return [cols.join(","), ...rows].join("\n") + "\n";
}

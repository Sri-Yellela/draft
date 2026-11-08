// services/interview/companyGuides.js — ⭐ D150 T12 (45n) · COMPANY GUIDES — THE DATA, FROM DEBRIEFS PEOPLE CHOSE TO SHARE.
//
// A guide for a company (and level) is grown ONLY from debriefs whose author ticked "Share anonymously to help others
// interviewing here" (interview_debriefs.pool_consent = 1, migration 249) — and only once ≥ K_MIN DISTINCT people have
// shared for that company + level; with fewer at a level, the company-wide guide (level '*') when the company reaches
// K_MIN. Never a name, a date narrower than the month, the notes, or anything identifying: the rounds people had (and
// how many), the topics they named (counted), and the questions they remember — shown as written, so a question with a
// digit, an address or a link (anything that could identify) is left out.
// ⛔ Nothing here is shown to users yet: T13's page waits on its sketch, and the consent checkbox waits on the privacy
// wording and counsel's user-content answers (WORKLOG owner list D (19)). Until then pool_consent is always 0.
import { companyNameKey } from "../../shared/companyIdentity.js";

export const K_MIN = 3;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const IDENTIFYING = /\d|@|https?:|\b(my name|i am|i'm)\b/i;

/** The company key and level for an application (via its job), or nulls. */
export function companyOfApplication(db, userId, applicationId) {
  if (applicationId == null) return { companyKey: null, level: null };
  const r = safe(() => db.prepare(`SELECT sj.company, sj.level_read FROM application_records a LEFT JOIN scraped_jobs sj ON sj.job_id = a.job_id
      WHERE a.id = ? AND a.user_id = ?`).get(Number(applicationId), userId), null);
  return { companyKey: r?.company ? companyNameKey(r.company) || null : null, level: r?.level_read || null };
}

/** Pure: a guide from consented debriefs [{ user_id, round, topics_json, questions: [text] }], or null under K_MIN. */
export function guideFrom(rows) {
  const people = new Set(rows.map(r => r.user_id));
  if (people.size < K_MIN) return null;
  const rounds = new Map(), topics = new Map(), questions = new Map();
  for (const r of rows) {
    rounds.set(r.round, (rounds.get(r.round) || 0) + 1);
    let t = []; try { t = JSON.parse(r.topics_json || "[]"); } catch { t = []; }
    for (const x of new Set(t.map(s => String(s).trim().toLowerCase()).filter(Boolean))) topics.set(x, (topics.get(x) || 0) + 1);
    for (const q of r.questions || []) { const s = String(q).trim(); if (s && s.length <= 300 && !IDENTIFYING.test(s)) questions.set(s, (questions.get(s) || 0) + 1); }
  }
  return {
    contributors: people.size,
    stages: [...rounds].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, debriefs: n })),
    topics: [...topics].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([topic, n]) => ({ topic, n })),
    questions: [...questions].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([question, n]) => ({ question, n })),
  };
}

/** Rebuild one company's guides (each level with ≥ K_MIN people, and the company-wide one). Returns the levels written. */
export function rebuildCompanyGuide(db, companyKey) {
  if (!companyKey) return [];
  const rows = safe(() => db.prepare(`SELECT d.id, d.user_id, d.round, d.topics_json, d.level FROM interview_debriefs d
      WHERE d.company_key = ? AND d.pool_consent = 1`).all(companyKey), []);
  const qs = db.prepare(`SELECT question FROM interview_questions WHERE debrief_id = ?`);
  for (const r of rows) r.questions = safe(() => qs.pluck().all(r.id), []);
  const month = new Date().toISOString().slice(0, 7);
  const put = db.prepare(`INSERT OR REPLACE INTO company_guides (company_key, level, guide_json, contributors, updated_month, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())`);
  const written = [];
  db.transaction(() => {
    db.prepare(`DELETE FROM company_guides WHERE company_key = ?`).run(companyKey);
    const levels = new Map([["*", rows]]);
    for (const r of rows) if (r.level) levels.set(r.level, [...(levels.get(r.level) || []), r]);
    for (const [level, rs] of levels) {
      const g = guideFrom(rs);
      if (g) { put.run(companyKey, level, JSON.stringify({ ...g, sources: [{ kind: "debrief", contributors: g.contributors }] }), g.contributors, month); written.push(level); }
    }
  })();
  return written;
}

/** A guide (the level's, else the company-wide one), or null. */
export function companyGuide(db, companyKey, level = null) {
  const r = safe(() => db.prepare(`SELECT * FROM company_guides WHERE company_key = ? AND level IN (?, '*') ORDER BY level = '*' LIMIT 1`).get(companyKey, level || "*"), null);
  return r ? { companyKey: r.company_key, level: r.level, updated: r.updated_month, ...JSON.parse(r.guide_json) } : null;
}

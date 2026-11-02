// ⭐ D123 P6a + P6g (2) · THE PER-EMPLOYER GISTS, built once per base résumé, and the person's own coursework (P6d).
//
// The payload tailoring (contract 1.8.0, options.tailoring "payload") sends, per employer, a short gist of the work done
// there — role, scope, domain, the kinds of systems and outcomes — and the tools service lets the model write a NEW bullet
// only inside it. The gist is built ONCE per base résumé on the Sonnet tier (POST /v1/resumes/gists, ≈ 1¢), stored here
// keyed by the résumé's hash (a changed résumé gets new ones), shown on the Profile ("How we describe your work at …",
// editable — the person's wording then wins and is never overwritten for that résumé) and reused for every tailoring.
//
// ⛔ A gist failure never blocks a tailoring: no gists = the model rewords the candidate's own bullets and writes none.
import crypto from "node:crypto";
import { recordToolsServiceUsage } from "./toolsService.js";

export const GISTS_MAX = 12;
export const GIST_TEXT_MAX = 400;
export const GIST_EMPLOYER_MAX = 200;
export const COURSES_MAX = 20;
export const COURSE_MAX = 80;

const json = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

export function resumeHash(resumeText) {
  return crypto.createHash("sha256").update(String(resumeText || "")).digest("hex").slice(0, 32);
}

/** The stored gists of this exact résumé: { gists, numberless, edited, hash } or null. */
export function readGists(db, userId, resumeText) {
  const hash = resumeHash(resumeText);
  let row;
  try { row = db.prepare("SELECT * FROM resume_gists WHERE user_id=? AND resume_hash=?").get(userId, hash); } catch { return null; }
  if (!row) return null;
  return { hash, gists: json(row.gists_json, []), numberless: json(row.numberless_json, []), edited: row.edited === 1 };
}

/** The person's most recent gists (for the Profile when the résumé text is not at hand). */
export function latestGists(db, userId) {
  let row;
  try { row = db.prepare("SELECT * FROM resume_gists WHERE user_id=? ORDER BY updated_at DESC LIMIT 1").get(userId); } catch { return null; }
  if (!row) return null;
  return { hash: row.resume_hash, gists: json(row.gists_json, []), numberless: json(row.numberless_json, []), edited: row.edited === 1 };
}

/**
 * The gists for one tailoring: the stored ones, else ONE build through the tools service, stored and metered. Returns
 * [{ employer, text }] — empty on any failure (logged), so the tailoring goes on without them.
 */
export async function ensureGists(db, tools, { userId, resumeText }) {
  const have = readGists(db, userId, resumeText);
  if (have) return have.gists;
  if (!tools?.gists || !tools.configured) return [];
  try {
    const out = await tools.gists({ baseResumeText: resumeText });
    recordToolsServiceUsage(db, out.usage, { userId, eventSubtype: "resume_gist" });
    const gists = (out.gists || []).slice(0, GISTS_MAX).map(g => ({ employer: String(g.employer).slice(0, GIST_EMPLOYER_MAX), text: String(g.text).slice(0, GIST_TEXT_MAX) }));
    db.prepare(`INSERT INTO resume_gists (user_id, resume_hash, gists_json, numberless_json, edited, updated_at)
      VALUES (?, ?, ?, ?, 0, unixepoch()) ON CONFLICT(user_id, resume_hash) DO NOTHING`)
      .run(userId, resumeHash(resumeText), JSON.stringify(gists), JSON.stringify((out.numberless || []).slice(0, 60)));
    return gists;
  } catch (e) {
    if (e?.usage) recordToolsServiceUsage(db, e.usage, { userId, eventSubtype: "resume_gist", requestError: e.code });
    console.warn("[gists] could not build the gists; tailoring without them:", e?.code || e?.message);
    return [];
  }
}

/** @returns an error message, or null when `gists` is a valid edit. */
export function validateGists(gists) {
  if (!Array.isArray(gists) || gists.length > GISTS_MAX) return `gists must be a list of at most ${GISTS_MAX}`;
  for (const g of gists) {
    if (!g || typeof g.employer !== "string" || !g.employer.trim() || g.employer.length > GIST_EMPLOYER_MAX) return "each gist needs its employer";
    if (typeof g.text !== "string" || g.text.length > GIST_TEXT_MAX) return `a gist is at most ${GIST_TEXT_MAX} characters`;
  }
  return null;
}

/** The person's edit of the gists of the résumé with this hash — their wording wins from now on. */
export function saveEditedGists(db, userId, hash, gists) {
  const clean = gists.map(g => ({ employer: g.employer.trim(), text: g.text.trim() })).filter(g => g.text);
  const r = db.prepare("UPDATE resume_gists SET gists_json=?, edited=1, updated_at=unixepoch() WHERE user_id=? AND resume_hash=?")
    .run(JSON.stringify(clean), userId, hash);
  return r.changes > 0 ? clean : null;
}

export function readCoursework(db, userId) {
  try { return json(db.prepare("SELECT coursework_json FROM user_profile WHERE user_id=?").get(userId)?.coursework_json, []); } catch { return []; }
}

/** @returns the stored list, or null when the input is not a list of short course names. */
export function saveCoursework(db, userId, courses) {
  if (!Array.isArray(courses)) return null;
  const seen = new Set();
  const clean = courses.map(c => String(c ?? "").trim()).filter(c => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
  if (clean.length > COURSES_MAX || clean.some(c => c.length > COURSE_MAX)) return null;
  const r = db.prepare("UPDATE user_profile SET coursework_json=? WHERE user_id=?").run(JSON.stringify(clean), userId);
  if (!r.changes) db.prepare("INSERT INTO user_profile (user_id, coursework_json) VALUES (?, ?)").run(userId, JSON.stringify(clean));
  return clean;
}

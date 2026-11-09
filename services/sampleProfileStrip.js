// services/sampleProfileStrip.js — ⛔ A140 (1) (owner 11-08): "all the trial accounts have the sample résumé info baked
// into their profiles, instead they need to be stripped and details need to be empty to be filled by them or the résumé."
//
// How it got there: the removed D124 trial let a tester pick a fictional sample résumé (content/trial/sample-*.json).
// startFromResume filled the EMPTY contact / education fields from it (fillEmptyProfileFields), set the job profile's
// declared role from it, and the profile page's first open filled the experience / education / skills sections from the
// active base résumé — the sample (structuredProfile.readProfile). Both now refuse a sample (A140); this removes what they
// already wrote, and — for an account that has since put its OWN résumé on the profile — re-reads the profile from it.
//
// A TRIAL ACCOUNT is found by ANY of: a contact value equal to a sample candidate's (all fictional: @example.com,
// 555-01xx); a base résumé that IS a sample; profile sections imported from a sample's text; an experience row whose
// company AND title both appear in a sample (the samples' employers are fictional). ⚠ Not by contact alone: an owner
// who uploaded their own résumé had name / phone / email replaced by the page's prefill while the sample's job title,
// city and education stayed.
// What is removed on a trial account, and only that:
//   · user_profile — contact values equal to the sample's; and every other résumé-filled field whose value appears in
//     the sample's text but NOT in the account's own current résumé (a value their own résumé states is theirs);
//   · the profile sections imported from a sample (rows the résumé wrote; rows the person added themselves stay), and
//     experience / education rows that match the sample's fictional employers / schools.
// Then, when the account's active job profile carries its OWN résumé: its declared role / titles re-read from it
// (A140's followProfileText), its sections filled from it, its emptied contact fields filled from it.
// ONCE per account: a cleaned account is recorded in a140_trial_cleaned (migration 234) and never re-read again, so a
// later hand edit of the profile is never overwritten by a boot. Idempotent besides. The sample résumé itself is not deleted (the practice-form safety rule keys on
// it); a person still on a sample is left with empty details, to fill or to replace with their own résumé.
import { trialSamples as samples, trialSampleIdForText as sampleIdForText } from "./sampleResumes.js";   // D184: never the test set
import { parseBasis } from "./payloadResume.js";
import { followProfileText, fillEmptyProfileFields } from "./resumeOnboarding.js";
import { useResumeSuggestion } from "./structuredProfile.js";

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (v) => String(v ?? "").replace(/\D/g, "");

const CONTACT = ["full_name", "email", "phone", "linkedin_url", "location"];
const RESUME_FIELDS = ["first_name", "last_name", "city", "state", "highest_degree", "field_of_study", "university",
  "graduation_year", "current_job_title", "current_company", "years_of_experience", "github_url", "website_url"];

function sampleFacts() {
  return Object.values(samples()).map(s => {
    const c = s.candidate || {};
    const [first, ...rest] = String(c.fullName || "").split(/\s+/);
    return {
      id: s.id, text: norm(s.resumeText), basis: parseBasis(s.resumeText),
      values: { full_name: norm(c.fullName), email: norm(c.email), phone: digits(c.phone), linkedin_url: norm(c.linkedinUrl),
        location: norm(c.location), first_name: norm(first), last_name: norm(rest.join(" ")) },
    };
  });
}

const matches = (field, value, s) => {
  if (value == null || String(value).trim() === "") return false;
  if (field === "phone") return !!s.values.phone && digits(value) === s.values.phone;
  return !!s.values[field] && norm(value) === s.values[field];
};
const inText = (text, v) => { const n = norm(v); return n.length >= 2 && text.includes(n); };
const tryAll = (db, sql, ...args) => { try { return db.prepare(sql).all(...args); } catch { return []; } };
const tryGet = (db, sql, ...args) => { try { return db.prepare(sql).get(...args); } catch { return null; } };

/** The account's base résumés: [{ text, isSample, profileId, active }]. */
function baseResumes(db, userId) {
  const out = tryAll(db, `SELECT pbr.content, pbr.profile_id, dp.is_active FROM profile_base_resumes pbr
      LEFT JOIN domain_profiles dp ON dp.id = pbr.profile_id WHERE pbr.user_id = ?`, userId)
    .map(r => ({ text: r.content || "", profileId: r.profile_id, active: !!r.is_active }));
  const legacy = tryGet(db, `SELECT content FROM base_resume WHERE user_id = ?`, userId);
  if (legacy?.content) out.push({ text: legacy.content, profileId: null, active: false });
  return out.map(r => ({ ...r, isSample: !!sampleIdForText(r.text) }));
}

/** Which sample this account carries, or null. */
function trialSample(db, userId, facts, profileRow) {
  for (const s of facts) if (profileRow && CONTACT.some(f => f in profileRow && matches(f, profileRow[f], s))) return s;
  for (const r of baseResumes(db, userId)) {
    if (!r.isSample) continue;
    const id = sampleIdForText(r.text);
    const s = facts.find(f => f.id === id);
    if (s) return s;
  }
  const basis = tryGet(db, `SELECT imported_basis FROM profile_sections WHERE user_id = ?`, userId)?.imported_basis;
  if (basis) { const s = facts.find(f => f.basis === basis); if (s) return s; }
  for (const e of tryAll(db, `SELECT company, title FROM profile_experience WHERE user_id = ?`, userId)) {
    const s = facts.find(f => e.company && e.title && inText(f.text, e.company) && inText(f.text, e.title));
    if (s) return s;
  }
  return null;
}

/**
 * Strip the sample's details from every trial account, then re-read each one that carries its own résumé.
 * deps.registry = the job-profile registry (routes/domainProfiles getRegistry) — without it the declared role is not re-read.
 * Returns { accounts, fields, sections, rows, refollowed }.
 */
export function stripSampleProfiles(db, { registry = null, log = console } = {}) {
  const facts = sampleFacts();
  const cols = new Set(tryAll(db, "PRAGMA table_info(user_profile)").map(c => c.name));
  const out = { accounts: 0, fields: 0, sections: 0, rows: 0, refollowed: 0 };
  const users = new Set([
    ...tryAll(db, "SELECT user_id FROM user_profile").map(r => r.user_id),
    ...tryAll(db, "SELECT DISTINCT user_id FROM profile_base_resumes").map(r => r.user_id),
    ...tryAll(db, "SELECT user_id FROM profile_sections").map(r => r.user_id),
  ]);

  const cleaned = new Set(tryAll(db, "SELECT user_id FROM a140_trial_cleaned").map(r => r.user_id));
  const mark = (userId) => { try { db.prepare("INSERT OR IGNORE INTO a140_trial_cleaned (user_id, cleaned_at) VALUES (?, unixepoch())").run(userId); } catch {} };
  for (const userId of users) {
    if (cleaned.has(userId)) continue;
    // ⭐ D186-6: a TEST account (users.test_account = 1, the owner's canary) may carry a sample's fictional details on purpose.
    if (tryGet(db, "SELECT test_account FROM users WHERE id = ?", userId)?.test_account === 1) continue;
    const row = tryGet(db, "SELECT * FROM user_profile WHERE user_id = ?", userId);
    const s = trialSample(db, userId, facts, row);
    if (!s) continue;
    const resumes = baseResumes(db, userId);
    const own = resumes.find(r => r.active && !r.isSample && r.text.trim().length >= 200)
      || resumes.find(r => !r.isSample && r.text.trim().length >= 200) || null;
    const ownText = norm(own?.text || "");
    let touched = false;

    // ── user_profile ──
    if (row) {
      const clear = [];
      for (const f of CONTACT) if (cols.has(f) && matches(f, row[f], s)) clear.push(f);
      for (const f of RESUME_FIELDS) {
        if (!cols.has(f) || row[f] == null || String(row[f]).trim() === "" || clear.includes(f)) continue;
        if (inText(s.text, row[f]) && !(ownText && inText(ownText, row[f]))) clear.push(f);
      }
      if (clear.length) {
        db.prepare(`UPDATE user_profile SET ${clear.map(f => `${f} = NULL`).join(", ")} WHERE user_id = ?`).run(userId);
        out.fields += clear.length; touched = true;
      }
    }

    // ── the sections ──
    const sec = tryGet(db, "SELECT imported_basis FROM profile_sections WHERE user_id = ?", userId);
    const fromSample = sec?.imported_basis && (sec.imported_basis === s.basis
      || resumes.some(r => r.isSample && parseBasis(r.text) === sec.imported_basis));
    db.transaction(() => {
      if (fromSample) {
        for (const t of ["profile_experience", "profile_education", "profile_skills"]) {
          try { out.rows += db.prepare(`DELETE FROM ${t} WHERE user_id = ? AND (source IS NULL OR source = 'resume')`).run(userId).changes; } catch {}
        }
        try { db.prepare("DELETE FROM profile_links WHERE user_id = ?").run(userId); } catch {}
        db.prepare("UPDATE profile_sections SET summary = NULL, imported_basis = NULL, updated_at = unixepoch() WHERE user_id = ?").run(userId);
        out.sections++; touched = true;
      }
      // Rows naming the sample's fictional employers / schools, whatever imported them.
      for (const e of tryAll(db, "SELECT rowid AS rid, company, title FROM profile_experience WHERE user_id = ?", userId)) {
        if (e.company && e.title && inText(s.text, e.company) && inText(s.text, e.title) && !(ownText && inText(ownText, e.company))) {
          db.prepare("DELETE FROM profile_experience WHERE rowid = ?").run(e.rid); out.rows++; touched = true;
        }
      }
      for (const e of tryAll(db, "SELECT rowid AS rid, school FROM profile_education WHERE user_id = ?", userId)) {
        if (e.school && inText(s.text, e.school) && !(ownText && inText(ownText, e.school))) {
          db.prepare("DELETE FROM profile_education WHERE rowid = ?").run(e.rid); out.rows++; touched = true;
        }
      }
    })();

    // ── re-read from the person's own résumé ──
    if (own) {
      try {
        const active = tryGet(db, "SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1", userId);
        const profileId = own.profileId ?? active?.id ?? null;
        if (registry && profileId) followProfileText(db, profileId, own.text, { registry });
        if (own.active) useResumeSuggestion(db, userId);
        fillEmptyProfileFields(db, userId, own.text);
        out.refollowed++; touched = true;
      } catch (e) { log.warn?.(`[a140] re-read of user ${userId} from their own résumé:`, e.message); }
    }
    if (touched) out.accounts++;
    mark(userId);
  }
  if (out.accounts) {
    log.log?.(`[a140] trial accounts cleaned: ${out.accounts} (fields ${out.fields}, sections ${out.sections}, rows ${out.rows}; re-read from their own résumé: ${out.refollowed})`);
  }
  return out;
}

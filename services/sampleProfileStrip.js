// services/sampleProfileStrip.js — ⛔ A140 (1) (owner 11-08): "all the trial accounts have the sample résumé info baked
// into their profiles, instead they need to be stripped and details need to be empty to be filled by them or the résumé."
//
// How it got there: the removed D124 trial let a tester pick a fictional sample résumé (content/trial/sample-*.json).
// startFromResume then filled the EMPTY contact / education fields from it (fillEmptyProfileFields), and the profile
// page's first open filled the experience / education / skills sections from the active base résumé — the sample
// (structuredProfile.readProfile). Both now refuse a sample (A140); this removes what they already wrote.
//
// What is removed, and only that:
//   · user_profile — a contact value EQUAL to a sample candidate's (name, email, phone, LinkedIn, location: all
//     fictional, @example.com / 555-01xx), on any account; on an account that carried one of those, also the city /
//     state / education / current job / years fields whose value appears in that sample's text.
//   · the profile sections — when they were imported from a sample (profile_sections.imported_basis is the parse basis
//     of a sample's text): the rows the résumé wrote (source 'resume'), the links, the summary; rows the person added
//     themselves (source 'user') stay. The next open fills them from the person's own résumé, or offers it.
// Idempotent: a second run finds nothing to remove. The sample résumé itself is NOT deleted (the practice-form safety
// rule keys on it); the person replaces it with their own.
import { samples, sampleIdForText } from "./sampleResumes.js";
import { parseBasis } from "./payloadResume.js";

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (v) => String(v ?? "").replace(/\D/g, "");

const CONTACT = ["full_name", "email", "phone", "linkedin_url", "location"];
const ALSO_IF_SAMPLE = ["first_name", "last_name", "city", "state", "highest_degree", "field_of_study", "university",
  "graduation_year", "current_job_title", "current_company", "years_of_experience"];

function sampleFacts() {
  return Object.values(samples()).map(s => {
    const c = s.candidate || {};
    const [first, ...rest] = String(c.fullName || "").split(/\s+/);
    return {
      id: s.id, text: norm(s.resumeText), basis: parseBasis(s.resumeText),
      values: { full_name: norm(c.fullName), email: norm(c.email), phone: digits(c.phone), linkedin_url: norm(c.linkedinUrl),
        location: norm(c.location), first_name: norm(first), last_name: norm(rest.join(" ")),
        years_of_experience: c.yearsOfExperience != null ? String(c.yearsOfExperience) : null },
    };
  });
}

const matches = (field, value, s) => {
  if (value == null || String(value).trim() === "") return false;
  if (field === "phone") return !!s.values.phone && digits(value) === s.values.phone;
  return !!s.values[field] && norm(value) === s.values[field];
};

/** Strip the sample's details from every account. Returns { profiles, fields, sections }. */
export function stripSampleProfiles(db, { log = console } = {}) {
  const facts = sampleFacts();
  const cols = new Set(db.prepare("PRAGMA table_info(user_profile)").all().map(c => c.name));
  const out = { profiles: 0, fields: 0, sections: 0 };

  // ── user_profile ──
  for (const row of db.prepare("SELECT * FROM user_profile").all()) {
    const hit = facts.find(s => CONTACT.some(f => cols.has(f) && matches(f, row[f], s)));
    if (!hit) continue;
    const clear = [];
    for (const f of CONTACT) if (cols.has(f) && matches(f, row[f], hit)) clear.push(f);
    for (const f of ALSO_IF_SAMPLE) {
      if (!cols.has(f) || row[f] == null || String(row[f]).trim() === "") continue;
      if (matches(f, row[f], hit) || hit.text.includes(norm(row[f]))) clear.push(f);
    }
    if (!clear.length) continue;
    db.prepare(`UPDATE user_profile SET ${clear.map(f => `${f} = NULL`).join(", ")} WHERE user_id = ?`).run(row.user_id);
    out.profiles++; out.fields += clear.length;
  }

  // ── the profile sections imported from a sample ──
  let secs = [];
  try { secs = db.prepare("SELECT user_id, imported_basis FROM profile_sections WHERE imported_basis IS NOT NULL").all(); } catch { secs = []; }
  const sampleBases = new Set(facts.map(s => s.basis));
  for (const { user_id: userId, imported_basis: basis } of secs) {
    let fromSample = sampleBases.has(basis);
    if (!fromSample) {
      const texts = [];
      try { for (const r of db.prepare("SELECT content FROM profile_base_resumes WHERE user_id = ?").all(userId)) texts.push(r.content); } catch {}
      try { const r = db.prepare("SELECT content FROM base_resume WHERE user_id = ?").get(userId); if (r) texts.push(r.content); } catch {}
      fromSample = texts.some(t => sampleIdForText(t) && parseBasis(t) === basis);
    }
    if (!fromSample) continue;
    db.transaction(() => {
      for (const t of ["profile_experience", "profile_education", "profile_skills"]) {
        try { db.prepare(`DELETE FROM ${t} WHERE user_id = ? AND (source IS NULL OR source = 'resume')`).run(userId); } catch {}
      }
      try { db.prepare("DELETE FROM profile_links WHERE user_id = ?").run(userId); } catch {}
      db.prepare("UPDATE profile_sections SET summary = NULL, imported_basis = NULL, updated_at = unixepoch() WHERE user_id = ?").run(userId);
    })();
    out.sections++;
  }
  if (out.profiles || out.sections) {
    log.log?.(`[a140] the sample résumé's details stripped: ${out.fields} fields on ${out.profiles} profiles, sections on ${out.sections}`);
  }
  return out;
}

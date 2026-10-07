// services/payloadResume.js — ⭐ D65 · WORK HISTORY AND SKILLS COME FROM THE RÉSUMÉ IN THE PAYLOAD.
//
// Owner, 10-07: "work history and skills would come from the parsed résumé currently being used to
// apply, the one in the payload. If that needs a migration that's what we'll do. The user might claim
// some skills and these should be filled in."
//
// Before this, a packet's work history came from the BASE résumé whatever résumé the packet carried —
// so a tailored résumé that dropped a role still had that role filled into the employer's form, and the
// form and the attached résumé disagreed. Now:
//   · the résumé the packet CARRIES (a tailored one in `resumes`, or the base one under D66) is parsed
//     by the same buildStructuredResume the renderer uses — in-house, no model (D17);
//   · the parse is STORED WITH THAT RÉSUMÉ (migration 138: parsed_json + parsed_basis), written once and
//     re-parsed only when the résumé's text changes (the basis is a hash of the text). The packet
//     references the résumé; it does not copy the parse;
//   · user-claimed skills (user_profile.confirmed_skills — the ones the user added in the app) are ADDED
//     to the résumé's skills, deduplicated, never removed by a parse, and marked as the user's claim;
//   · ⛔ a parse that reads nothing fills NOTHING for work history and the résumé's skills, and says so —
//     it never falls back to another résumé's roles (that would resurrect what the tailored one dropped).
import crypto from "node:crypto";
import { buildStructuredResume } from "./resumeFormatter.js";

export const RESUME_PARSE_VERSION = 1;
export const PARSE_FAILED_MESSAGE =
  "draft could not read the work history and skills from this résumé, so those sections are left for you to fill.";

export function parseBasis(text) {
  return `v${RESUME_PARSE_VERSION}:` + crypto.createHash("sha1").update(String(text ?? "")).digest("hex").slice(0, 16);
}

/** True when a structured résumé has anything the fill can use. */
export function parseReadSomething(structured) {
  return !!structured && Array.isArray(structured.sections) && structured.sections.some(s =>
    (s?.type === "entries" && (s.entries || []).length) || (s?.type === "skills" && (s.rows || []).length));
}

/** The résumé's skills, from its SKILLS section(s): "Languages: Java, Python" → ["Java", "Python"]. */
export function skillsOfStructured(structured) {
  const out = [];
  for (const s of structured?.sections || []) {
    if (s?.type !== "skills") continue;
    for (const r of s.rows || []) {
      for (const v of String(r?.values || "").split(/\s*(?:,|;|\||•|·)\s*/)) {
        const t = v.replace(/^[-–—\s]+|[.\s]+$/g, "").trim();
        if (t && t.length <= 60 && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
      }
    }
  }
  return out;
}

function hasColumn(db, table, col) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col); } catch { return false; }
}

/**
 * The parse of the résumé a packet carries — read from its stored parse when that parse was taken from
 * the text the résumé holds NOW, otherwise parsed and stored. `resumeId` names a row in `resumes` (the
 * packet's resume_artifact_id); without one, the user's base résumé is used.
 * @returns {{ source: "tailored"|"base"|null, resumeId: number|null, structured: object|null, ok: boolean, cached: boolean }}
 *   source null — there is no résumé at all (an answers-only packet, D66 lane B 3).
 */
export function payloadResumeParse(db, { userId, resumeId = null }) {
  let row = null, table = null, source = null, text = null;
  if (resumeId != null) {
    try { row = db.prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?").get(resumeId, userId); } catch { row = null; }
    if (row) { table = "resumes"; source = "tailored"; text = row.html; }
  }
  // The base résumé an application carries: the ACTIVE profile's first (what D66 sends), else the account's.
  if (!row) {
    try {
      row = db.prepare(`SELECT pbr.* FROM profile_base_resumes pbr JOIN domain_profiles dp ON dp.id = pbr.profile_id
        WHERE pbr.user_id = ? AND dp.is_active = 1 AND TRIM(COALESCE(pbr.content, '')) != '' LIMIT 1`).get(userId) || null;
    } catch { row = null; }
    if (row) { table = "profile_base_resumes"; source = "base"; text = row.content; }
  }
  if (!row) {
    try { row = db.prepare("SELECT * FROM base_resume WHERE user_id = ?").get(userId); } catch { row = null; }
    if (row) { table = "base_resume"; source = "base"; text = row.content; }
  }
  if (!row || !String(text || "").trim()) return { source: null, resumeId: null, structured: null, ok: false, cached: false };

  const basis = parseBasis(text);
  if (row.parsed_basis === basis && row.parsed_json) {
    try {
      const structured = JSON.parse(row.parsed_json);
      return { source, resumeId: source === "tailored" ? row.id : null, structured, ok: parseReadSomething(structured), cached: true };
    } catch { /* a damaged stored parse is re-taken below */ }
  }
  let structured = null;
  try { structured = buildStructuredResume(text); } catch { structured = null; }
  if (structured && hasColumn(db, table, "parsed_json")) {
    try {
      const key = table === "profile_base_resumes" ? "profile_id" : "id";
      db.prepare(`UPDATE ${table} SET parsed_json = ?, parsed_basis = ? WHERE ${key} = ?`).run(JSON.stringify(structured), basis, row[key]);
    } catch { /* storing is an optimisation; the parse itself is the answer */ }
  }
  return { source, resumeId: source === "tailored" ? row.id : null, structured, ok: parseReadSomething(structured), cached: false };
}

/** The user's own claimed skills — user_profile.confirmed_skills, which the user adds in the app. */
export function claimedSkillsOf(profile) {
  try {
    const raw = Array.isArray(profile?.confirmed_skills) ? profile.confirmed_skills : JSON.parse(profile?.confirmed_skills || "[]");
    const out = [];
    for (const s of Array.isArray(raw) ? raw : []) {
      const t = String(typeof s === "string" ? s : s?.name ?? s?.skill ?? "").trim();
      if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    return out;
  } catch { return []; }
}

// services/fitCard.js — ⭐ D202 · THE FIT CARD's read: GET /api/jobs/:id/fit-card (server.js).
//
// One answer for both faces of client/src/plate/FitCard.jsx — the scorer's report (every ask it read, its claims), D192's
// contextual block (the parts, their weights, their stack), WHERE each found word sits on the résumé ("Toast · bullet 2"),
// and the profile a claim goes to (AG2's reversible POST /api/domain-profiles/:id/claims).
// ⛔ No model (D190): "where" is a text lookup over the base résumé — its experience entries (the scorer package's own
// experienceEntries, the plausibility check's reader) and its section headings. A word the résumé names nowhere the reader
// can point at gets no place (null) — never a guessed one.
import { experienceEntries, techMentionedIn } from "@draft/ats-scorer";
import { technologiesIn } from "../shared/techVocabulary.js";

const SECTION = /^\s*(summary|profile|objective|about(?: me)?|education|(?:technical\s+)?skills|core\s+competencies|projects?|certifications?|publications?|awards?|volunteer\w*|interests|languages|coursework|(?:professional\s+|work\s+|relevant\s+)?experience|employment(?:\s+history)?|work\s+history)\s*:?\s*$/i;
const SECTION_NAME = (h) => {
  const t = h.trim().replace(/:$/, "").toLowerCase();
  if (/skill|competenc/.test(t)) return "Skills";
  if (/educat|coursework/.test(t)) return "Education";
  if (/project/.test(t)) return "Projects";
  if (/certif/.test(t)) return "Certifications";
  if (/summary|profile|objective|about/.test(t)) return "Summary";
  if (/experience|employment|work history/.test(t)) return "Experience";
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A matcher for one scorer term: whole word, any case; a verb also in its -ed / -ing / -s forms ("design" → "designed"). */
export function termMatcher(term, { verb = false } = {}) {
  const t = String(term || "").trim();
  if (!t) return null;
  const forms = [t, t.replace(/_/g, " ")];
  const stem = verb ? t.replace(/e$/, "") : null;
  const body = forms.map(esc).join("|") + (stem && stem.length > 2 ? `|${esc(stem)}(?:e|es|ed|ing|s)?` : "");
  return new RegExp(`(^|[^A-Za-z0-9+#])(?:${body})(?![A-Za-z0-9+#])`, "i");
}

/**
 * whereOnResume(text, terms) → { [term]: "Toast · bullet 2" | "Toast · title" | "Skills" | "Education" | … }
 * `terms` = [{ term, kind }]. Pure. The first place wins, in the résumé's own order of weight: an experience bullet, an
 * entry's header, then a named section; a term found in no line is left out.
 */
export function whereOnResume(text, terms = []) {
  const src = String(text || "");
  if (!src.trim() || !terms.length) return {};
  const entries = experienceEntries(src);
  const lines = src.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (l.length <= 60 && SECTION.test(l)) { cur = SECTION_NAME(l); continue; }
    sections.push({ section: cur, line: l });
  }
  const out = {};
  for (const { term, kind } of terms) {
    if (!term || out[term]) continue;
    const re = termMatcher(term, { verb: kind === "verb" });
    if (!re) continue;
    let at = null;
    for (const e of entries) {
      const who = e.parts?.[0] || e.title || e.header;
      const i = e.bullets.findIndex((b) => re.test(b));
      if (i >= 0) { at = `${who} · bullet ${i + 1}`; break; }
      if (re.test(e.header)) { at = `${who} · title`; break; }
    }
    if (!at) {
      const hit = sections.find((s) => s.section !== "Experience" && re.test(s.line));
      if (hit) at = hit.section || "Your résumé";
    }
    if (at) out[term] = at;
  }
  return out;
}

/** The résumé's technologies (for the Context tab's "extra" rows): the vocabulary's names it mentions. */
export function resumeTech(text) {
  try { return technologiesIn(String(text || "")).map((t) => t.name); } catch { return techMentionedIn(text, []); }
}

/** The payload: what the scorer said, where its found words sit, and where a claim goes. */
export function fitCardPayload({ scored, resumeText, profileId }) {
  const report = scored?.report || null;
  const terms = report ? [
    ...(report.tier1_matched || []).map((term) => ({ term, kind: "skill" })),
    ...(report.competencies_matched || []).map((term) => ({ term, kind: "quality" })),
    ...(report.action_verbs_matched || []).map((term) => ({ term, kind: "verb" })),
  ] : [];
  return {
    score: scored?.score ?? null, band: scored?.band ?? null,
    report, contextual: scored?.contextual || null,
    where: whereOnResume(resumeText, terms),
    resumeTech: resumeTech(resumeText),
    profileId: profileId ?? null,
  };
}

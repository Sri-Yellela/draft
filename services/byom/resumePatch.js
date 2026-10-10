// services/byom/resumePatch.js — ⭐ D86 · THE BRIEF THE USER'S MODEL READS, AND THE PATCH IT RETURNS.
//
// Bring-your-own-model résumés: the user's own ChatGPT or Claude writes the résumé; draft supplies a brief
// and VALIDATES what comes back. ⛔ Nothing here calls a model (D17) — this file is pure: no database, no
// network, so every guard below is a function of its inputs and testable as one.
//
// THE SHAPE IS THE GUARD. The model never returns a résumé. It returns a PATCH — rewritten bullets keyed by
// the ids the brief gave them, a reordering of the skills it already has, an optional summary — and the
// server renders the document from the BASE résumé's structure with the patch applied. So a date, an
// employer, a title or a section the model would like to change is not refused by a check: there is no
// field in the patch that could carry it. What a check still has to catch is in the free text, and two do:
//   · THE TERM GUARD — a skill or posting term in the rewritten text that is in neither the base résumé nor
//     the user's claims is refused (G1's "Kafka from the JD" is exactly this);
//   · the existing claim guard (services/resumeClaimGuard.js — years and seniority), run by the caller on
//     the rendered document, as every generated résumé is.
//
// ⛔ THE BRIEF CARRIES NO CONTACT DETAIL. The header (name, contact line) is not in it, and every string
// that is gets a last scrub for anything shaped like an email address, a phone number or a URL — a résumé
// whose parse misplaced its contact line into a section must not leak it into a third party's context.
// The server writes the header back itself, from the base résumé, after the patch is applied.
import crypto from "node:crypto";
import { normaliseAtsTerm } from "@draft/ats-scorer";
import { renderStructuredResume } from "../resumeFormatter.js";

export const BRIEF_TTL_SECONDS = 30 * 60;
export const MAX_ATTEMPTS = 3;
export const LIMITS = Object.freeze({ bullet: 400, summary: 800, bullets: 200, skillValue: 60 });

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?<![\w.])(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\w.])/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com)\/\S*/gi;

/** A string with anything shaped like contact detail removed. */
export function scrubContact(value) {
  return String(value ?? "").replace(EMAIL_RE, "[removed]").replace(URL_RE, "[removed]").replace(PHONE_RE, "[removed]");
}

/** The hash a brief is bound to: the base résumé's text, so an edited base résumé voids an open brief. */
export function baseHash(text) {
  return crypto.createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 32);
}

const valuesOf = (row) => String(row?.values || "").split(/\s*(?:,|;|\||•|·)\s*/).map(v => v.trim()).filter(Boolean);

/**
 * The base résumé with an id on every bullet, skills row and summary — the only things a patch may name.
 * ids are positional (s<section>.e<entry>.b<bullet>, s<section>.r<row>, s<section>.summary) and are only
 * meaningful against the base the brief was built from, which the brief stores.
 */
export function idsFor(structured) {
  const sections = (structured?.sections || []).map((s, si) => {
    if (s.type === "summary") return { id: `s${si}.summary`, type: "summary", title: s.title, text: s.text || "" };
    if (s.type === "skills") {
      return { id: `s${si}`, type: "skills", title: s.title,
        rows: (s.rows || []).map((r, ri) => ({ id: `s${si}.r${ri}`, label: r.label || "", values: valuesOf(r) })) };
    }
    return { id: `s${si}`, type: "entries", title: s.title,
      entries: (s.entries || []).map((e, ei) => ({
        id: `s${si}.e${ei}`, company: e.company || "", role: e.role || "", date: e.date || "", meta: e.meta || "",
        tech: e.tech || "", text: e.text || "",
        bullets: (e.bullets || []).map((b, bi) => ({ id: `s${si}.e${ei}.b${bi}`, text: b })),
      })) };
  });
  return { sections };
}

function scrubDeep(v) {
  if (typeof v === "string") return scrubContact(v);
  if (Array.isArray(v)) return v.map(scrubDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubDeep(x)]));
  return v;
}

// ⛔ D86 COMPLIANCE (10-09): the schema's descriptions say what a field HOLDS, never what a model should do.
// Anthropic's Software Directory Policy §2F forbids a connector making Claude pull behavioural instructions
// from an external source at runtime, so the brief is DATA ONLY — there is no `instructions` field. The
// "how to write it" guidance is a static Skill in the separate public plugin repository
// (draft-plugin), and test/d86ConnectorCompliance.test.js holds the brief and the server to it.
export const OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    bullets: { type: "array", maxItems: LIMITS.bullets, description: "The bullets that change: each by id, with new text or drop: true.",
      items: { type: "object", additionalProperties: false, required: ["id"],
        properties: { id: { type: "string" }, text: { type: "string", maxLength: LIMITS.bullet }, drop: { type: "boolean" } } } },
    skills: { type: "array", description: "A skills row's existing values, reordered or trimmed. A value the row does not have is refused.",
      items: { type: "object", additionalProperties: false, required: ["id", "values"],
        properties: { id: { type: "string" }, values: { type: "array", items: { type: "string" } } } } },
    skills_order: { type: "array", items: { type: "string" }, description: "Every skills row id of a section, once each, in display order." },
    summary: { type: "string", maxLength: LIMITS.summary, description: "Accepted only when the brief's allow_summary is true or the résumé already has a summary." },
  },
});

/**
 * The brief: the data the model needs and nothing else — no instructions (§2F, above).
 * @param {{ briefId, expiresAt, job, structured, claims, baseReport, allowSummary }} args
 *   baseReport — the scorer's report on the BASE résumé for this job; only its MATCHED terms and verbs
 *   go in (D70's keywords-only context: never the posting's unclaimed requirements).
 */
export const BRIEF_DETAIL = Object.freeze(["full", "short"]);

export function buildBrief({ briefId, expiresAt, job = {}, structured, claims = {}, baseReport = null, allowSummary = false, detail = "full" }) {
  const claimedSkills = [...new Set((claims?.skills || []).map(String))];
  const claimedVerbs = [...new Set((claims?.actionVerbs || []).map(String))];
  const short = detail === "short";
  const resume = idsFor(structured);
  // DR-6 · `short` is the frugal form: each entry keeps its ids, employer, title, date and bullets, and
  // drops its location line, technology line and free text; the action verbs are left out.
  if (short) for (const s of resume.sections) for (const e of s.entries || []) { delete e.meta; delete e.tech; delete e.text; }
  const body = {
    job: { id: String(job.job_id ?? job.id ?? ""), title: job.title || "", company: job.company || "",
      level: job.seniority || job.experience_level || "", location: job.location || "",
      // DR-1 · the job's family is DATA (the Skill carries the static rules) — never a per-job prompt.
      family: job.bucket_role || null },
    resume,
    claims: { skills: claimedSkills, ...(short ? {} : { action_verbs: claimedVerbs }) },
    keywords: {
      matched: [...(baseReport?.tier1_matched || [])],
      claimed: claimedSkills,
      ...(short ? {} : { verbs: [...new Set([...(baseReport?.action_verbs_matched || []), ...claimedVerbs])] }),
    },
    allow_summary: !!allowSummary,
    detail: short ? "short" : "full",
  };
  return { brief_id: briefId, expires_at: expiresAt, max_attempts: MAX_ATTEMPTS, ...scrubDeep(body), output_schema: OUTPUT_SCHEMA };
}

/** A refusal reason the model can act on, and a person can read. */
const reason = (code, message, id = null) => ({ code, message, ...(id ? { id } : {}) });

/**
 * Applies a patch to the base structure. Returns { ok, structured, changedText, reasons }.
 * ⛔ Every refusal here is SHAPE — an id the brief never gave, a value a skills row does not have. The
 * free-text guards run on `changedText` afterwards (termGuard) and on the rendered document (the caller).
 */
export function applyPatch(structured, patch, { allowSummary = false } = {}) {
  const reasons = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { ok: false, reasons: [reason("not_a_patch", "The patch must be an object with bullets, skills, skills_order or summary.")] };
  }
  const known = new Set(["bullets", "skills", "skills_order", "summary"]);
  for (const k of Object.keys(patch)) if (!known.has(k)) reasons.push(reason("unknown_field", `"${k}" is not part of a patch. Only bullets, skills, skills_order and summary can change.`));

  const out = JSON.parse(JSON.stringify(structured || { sections: [] }));
  const changedText = [];
  const bulletAt = new Map();
  out.sections.forEach((s, si) => (s.entries || []).forEach((e, ei) => (e.bullets || []).forEach((_, bi) => bulletAt.set(`s${si}.e${ei}.b${bi}`, [si, ei, bi]))));

  const bullets = Array.isArray(patch.bullets) ? patch.bullets : patch.bullets == null ? [] : null;
  if (bullets === null) reasons.push(reason("bad_bullets", "bullets must be a list."));
  if (bullets && bullets.length > LIMITS.bullets) reasons.push(reason("too_many", `At most ${LIMITS.bullets} bullets in one patch.`));
  const drops = new Set();
  const seen = new Set();
  for (const b of bullets || []) {
    const id = String(b?.id ?? "");
    if (!bulletAt.has(id)) { reasons.push(reason("unknown_id", `There is no bullet "${id}" in the brief. Use the ids the brief gives.`, id)); continue; }
    if (seen.has(id)) { reasons.push(reason("duplicate_id", `Bullet "${id}" appears twice.`, id)); continue; }
    seen.add(id);
    const [si, ei, bi] = bulletAt.get(id);
    if (b.drop === true) { drops.add(id); continue; }
    const text = String(b.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) { reasons.push(reason("empty_bullet", `Bullet "${id}" is empty. To remove a bullet, send drop: true.`, id)); continue; }
    if (text.length > LIMITS.bullet) { reasons.push(reason("too_long", `Bullet "${id}" is ${text.length} characters; the limit is ${LIMITS.bullet}.`, id)); continue; }
    if (scrubContact(text) !== text) { reasons.push(reason("contact_detail", `Bullet "${id}" contains an email address, phone number or link. Leave contact details out.`, id)); continue; }
    out.sections[si].entries[ei].bullets[bi] = text;
    changedText.push({ id, text });
  }
  out.sections.forEach((s, si) => (s.entries || []).forEach((e, ei) => {
    const had = (e.bullets || []).length;
    const kept = (e.bullets || []).filter((_, bi) => !drops.has(`s${si}.e${ei}.b${bi}`));
    if (had && !kept.length) reasons.push(reason("entry_emptied", `Every bullet of "${[e.role, e.company].filter(Boolean).join(", ") || `s${si}.e${ei}`}" was dropped; keep at least one.`, `s${si}.e${ei}`));
    e.bullets = kept;
  }));

  const rowAt = new Map();
  out.sections.forEach((s, si) => (s.rows || []).forEach((_, ri) => rowAt.set(`s${si}.r${ri}`, [si, ri])));
  for (const r of Array.isArray(patch.skills) ? patch.skills : []) {
    const id = String(r?.id ?? "");
    if (!rowAt.has(id)) { reasons.push(reason("unknown_id", `There is no skills row "${id}" in the brief.`, id)); continue; }
    const [si, ri] = rowAt.get(id);
    const original = valuesOf(out.sections[si].rows[ri]);
    const byKey = new Map(original.map(v => [v.toLowerCase(), v]));
    const values = (Array.isArray(r.values) ? r.values : []).map(v => String(v).trim()).filter(Boolean);
    const added = values.filter(v => !byKey.has(v.toLowerCase()));
    if (added.length) { reasons.push(reason("new_skill", `Skills row "${id}" gained ${added.map(a => `"${a}"`).join(", ")}, which it does not have. A skills row can be reordered or trimmed, never added to.`, id)); continue; }
    if (!values.length) { reasons.push(reason("row_emptied", `Skills row "${id}" would be empty.`, id)); continue; }
    out.sections[si].rows[ri].values = [...new Set(values.map(v => byKey.get(v.toLowerCase())))].join(", ");
  }
  if (patch.skills_order != null) {
    const order = Array.isArray(patch.skills_order) ? patch.skills_order.map(String) : null;
    const bySection = new Map();
    for (const id of order || []) {
      if (!rowAt.has(id)) { reasons.push(reason("unknown_id", `There is no skills row "${id}" in the brief.`, id)); continue; }
      const si = rowAt.get(id)[0];
      if (!bySection.has(si)) bySection.set(si, []);
      bySection.get(si).push(id);
    }
    for (const [si, ids] of bySection) {
      const all = out.sections[si].rows.map((_, ri) => `s${si}.r${ri}`);
      if (ids.length !== all.length || new Set(ids).size !== all.length) {
        reasons.push(reason("bad_order", `skills_order must name every row of that skills section once (${all.join(", ")}).`));
        continue;
      }
      const rows = out.sections[si].rows;
      out.sections[si].rows = ids.map(id => rows[rowAt.get(id)[1]]);
    }
  }
  if (patch.summary != null) {
    const text = String(patch.summary).replace(/\s+/g, " ").trim();
    const existing = out.sections.find(s => s.type === "summary");
    if (!allowSummary && !existing) reasons.push(reason("summary_off", "This brief does not allow a summary — the candidate has summaries switched off."));
    else if (text.length > LIMITS.summary) reasons.push(reason("too_long", `The summary is ${text.length} characters; the limit is ${LIMITS.summary}.`));
    else if (scrubContact(text) !== text) reasons.push(reason("contact_detail", "The summary contains an email address, phone number or link."));
    else if (text) {
      if (existing) existing.text = text;
      else out.sections.unshift({ type: "summary", title: "SUMMARY", text });
      changedText.push({ id: "summary", text });
    }
  }
  return { ok: reasons.length === 0, structured: out, changedText, reasons };
}

// A term whose normalised form is this short ("go", "r", "c") is an English word as often as a skill; it
// counts only when written exactly as the vocabulary writes it and not as a bullet's first word.
const SHORT_TERM = 2;

function containsTerm(normText, rawText, term) {
  const n = normaliseAtsTerm(term);
  if (!n) return false;
  if (n.length <= SHORT_TERM) {
    const esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<=[^\\s])\\s+${esc}(?![A-Za-z0-9+#])|[,(/]\\s*${esc}(?![A-Za-z0-9+#])`).test(rawText);
  }
  return ` ${normText} `.includes(` ${n} `);
}

/**
 * ⛔ THE TERM GUARD. Every term in `vocabulary` (the scorer's skills registry plus the posting's own terms)
 * that appears in the CHANGED text must appear in the base résumé or in the user's claims. Returns refusal
 * reasons, one per term.
 */
export function termGuard({ changedText = [], baseText = "", claims = {}, vocabulary = [] }) {
  const baseNorm = normaliseAtsTerm(baseText);
  const claimed = new Set([...(claims?.skills || []), ...(claims?.actionVerbs || [])].map(normaliseAtsTerm));
  const reasons = [];
  const flagged = new Set();
  const terms = [...new Set(vocabulary.map(String).filter(Boolean))];
  for (const { id, text } of changedText) {
    const norm = normaliseAtsTerm(text);
    for (const term of terms) {
      const n = normaliseAtsTerm(term);
      if (!n || flagged.has(n) || claimed.has(n)) continue;
      if (!containsTerm(norm, text, term)) continue;
      if (containsTerm(baseNorm, baseText, term)) continue;
      flagged.add(n);
      reasons.push({ ...reason("new_term", `"${term}" is not in the candidate's base résumé or claims (in ${id}). Remove it or describe the work without it.`, id), term });
    }
  }
  return reasons;
}

/** ⛔ Belt to the patch's shape: the rendered entries carry the base's employers, titles and dates, unchanged. */
export function immutablesChanged(base, patched) {
  const sig = (s) => (s?.sections || []).flatMap(x => (x.entries || []).map(e => [x.title, e.company, e.role, e.date, e.meta].join("␟")));
  const a = sig(base), b = sig(patched);
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/** The résumé, rendered: the BASE header (written by the server), the patched sections. */
export function renderPatched(baseStructured, patchedStructured) {
  return renderStructuredResume({ header: baseStructured?.header || {}, sections: patchedStructured.sections });
}

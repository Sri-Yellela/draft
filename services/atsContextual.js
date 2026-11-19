// services/atsContextual.js — ⭐ D192 (3) + (4) · THE CONTEXTUAL ATS SCORE'S INPUTS, read from draft's own tables.
//
// The scorer (@draft/ats-scorer scoreContextual, ATS contract 2.0.0) is pure: data in, score out. This file is draft's half —
// it reads what draft already holds and hands it over (owner 11-14: "draft sends them in the request — RM never stores,
// fetches or caches them"):
//   posting   job_taxonomy (D179's subcategory) + scraped_jobs.level_read (D106) + the posting's normalised text
//   résumé    the active job profile's placement (D184 B-1, services/placement.js) + the base résumé's text + its technologies
//   company   job_company → company_tech (D179 P5a: ≥ 2 postings, 180 days, stackFor) as [{ name, category, postingShare }]
//             + the company record's industry (company_facts, Wikidata)
// and the weights (Admin → Ops, app_settings `ats_contextual_weights`; the contract's defaults otherwise).
//
// ⛔ The existing skill-match score, the board's ranking, the tailoring trigger and every label read from it are UNCHANGED:
// this block is computed beside the report and never written into it (D192 (5): draft never sees an unexpected shape).
// ⛔ No model (D190): everything here is a SELECT and the package's arithmetic.
import { scoreContextual, resolveContextualWeights, DEFAULT_CONTEXTUAL_WEIGHTS } from "@draft/ats-scorer";
import { stackFor } from "./companies/companyTech.js";
import { technologiesIn } from "../shared/techVocabulary.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { companySlug } from "../shared/companyPaths.js";
import { storedPlacement } from "./placement.js";
import { getSetting, setSetting, clearSetting } from "./appSettings.js";

export const WEIGHTS_KEY = "ats_contextual_weights";
export const STACK_MAX = 20;
const safe = (fn, d = null) => { try { return fn(); } catch { return d; } };

/** The weights Admin → Ops set, else the contract's defaults. A stored value that no longer validates falls back (logged once). */
let warned = false;
export function contextualWeights(db) {
  const raw = safe(() => getSetting(db, WEIGHTS_KEY));
  if (!raw) return { ...DEFAULT_CONTEXTUAL_WEIGHTS };
  try { return resolveContextualWeights(typeof raw === "string" ? JSON.parse(raw) : raw); }
  catch (e) { if (!warned) { warned = true; console.warn(`[ats-contextual] stored weights refused (${e.message}) — the defaults apply`); } return { ...DEFAULT_CONTEXTUAL_WEIGHTS }; }
}
/** Admin → Ops: validated by the package (unknown parts / negatives / all-zero refused → TypeError), then stored. null = defaults. */
export function setContextualWeights(db, input) {
  if (input == null) { clearSetting(db, WEIGHTS_KEY); return { ...DEFAULT_CONTEXTUAL_WEIGHTS }; }
  const w = resolveContextualWeights(input);
  setSetting(db, WEIGHTS_KEY, JSON.stringify(w));
  return w;
}

/** A company record's stack in the contract's shape: [{ name, category, postingShare }], the most-posted first. */
export function companyStackOf(db, companyId, nowSec = Math.floor(Date.now() / 1000)) {
  if (!companyId) return { industry: null, techStack: [] };
  const s = safe(() => stackFor(db, companyId, nowSec), null);
  const of = s?.ofPostings || 0;
  const techStack = !s || !of ? [] : Object.entries(s.groups).flatMap(([grp, items]) => items.map(x => ({
    name: x.tech, category: grp, postingShare: Math.round(1000 * Math.min(1, x.postings / of)) / 1000 })))
    .sort((a, b) => b.postingShare - a.postingShare || a.name.localeCompare(b.name)).slice(0, STACK_MAX);
  const industry = safe(() => db.prepare(`SELECT industry FROM company_facts WHERE company_id = ? AND status = 'ok'`).pluck().get(companyId), null) || null;
  return { industry, techStack };
}

/** A company record by its name, as the public pages resolve one (the name alias, else the slug). null when none. */
export function companyIdByName(db, name) {
  const key = companyNameKey(name);
  if (!key) return null;
  return safe(() => db.prepare(`SELECT company_id FROM company_aliases WHERE alias_key = ?`).pluck().get(`name:${key}`), null)
    ?? safe(() => db.prepare(`SELECT id FROM companies WHERE slug = ?`).pluck().get(companySlug(name)), null) ?? null;
}

/**
 * ⭐ D192 (3) · GET /api/public/company-stack?name= — Resume Master's lookup when it scores on its own (no draft in the loop).
 * The same public data the company pages show; nothing about any person. { matched: false } when no record answers.
 */
export function publicCompanyStack(db, name, nowSec = Math.floor(Date.now() / 1000)) {
  const n = String(name || "").trim().slice(0, 200);
  if (!n) return { matched: false };
  const id = companyIdByName(db, n);
  if (!id) return { matched: false };
  const co = safe(() => db.prepare(`SELECT name, slug FROM companies WHERE id = ?`).get(id), null);
  if (!co) return { matched: false };
  const { industry, techStack } = companyStackOf(db, id, nowSec);
  return { matched: true, name: co.name, slug: co.slug, industry, techStack };
}

/** The posting's side: its taxonomy placement, its level read, its text, its company record. */
export function postingContext(db, job) {
  const id = job?.job_id != null ? String(job.job_id) : null;
  const tax = id ? safe(() => db.prepare(`SELECT category, subcategory FROM job_taxonomy WHERE job_id = ?`).get(id), null) : null;
  const companyId = (id ? safe(() => db.prepare(`SELECT company_id FROM job_company WHERE job_id = ?`).pluck().get(id), null) : null)
    ?? (job?.company ? companyIdByName(db, job.company) : null);
  return {
    posting: { category: tax?.category || null, subcategory: tax?.subcategory || null, level: job?.level_read || null,
      text: String(job?.description_text || job?.description || "") },
    companyId,
  };
}

/**
 * The contextual block for one posting and the person's base résumé. `report` = the skill-match report already computed for
 * this posting (never recomputed here). Returns null when there is no résumé text — nothing to compare.
 */
export function contextualFor(db, { userId, job, report, resumeText, nowSec } = {}) {
  if (!resumeText || !report) return null;
  const { posting, companyId } = postingContext(db, job);
  const placed = safe(() => storedPlacement(db, userId), null);
  const resume = placed && !placed.asks
    ? { category: placed.category, subcategory: placed.subcategory, level: placed.level, also: placed.also }
    : {};
  resume.text = String(resumeText);
  resume.tech = technologiesIn(resumeText).map(t => t.name);
  const company = companyStackOf(db, companyId, nowSec);
  return scoreContextual({
    skillMatch: report.score ?? null, skillsBoth: report.tier1_matched || [],
    posting, resume, company: company.techStack.length || company.industry ? company : null,
    weights: contextualWeights(db),
  });
}

// ============================================================
// services/qualificationResolver.js — Qualification key resolver
// ============================================================
// What this file does:
//   Resolves a raw qualification string (from resume or classifier)
//   to a standardised key in QUALIFICATION_ROLE_MAP.json.
//   Domain-module selection moved to the résumé tools service in A2/A4, which holds the one
//   definition; draft's copy here had no caller after A4 and was removed.
//
// What to change here if intent changes:
//   - To add new qualification types: add to QUALIFICATION_ROLE_MAP.json
//     (do not add aliases here directly)
//   - To change normalization patterns: edit normaliseQualification()
//
// Depends on: registry/QUALIFICATION_ROLE_MAP.json
// ============================================================

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// registry/, NOT data/ — data/ is production's runtime VOLUME, which hides image files mounted under
// it, so from data/ this map was almost certainly {} in production (see searchQueryBuilder.js).
export const QUALIFICATION_MAP_PATH = path.join(__dirname, "..", "registry", "QUALIFICATION_ROLE_MAP.json");

let _map = null;
function getMap() {
  if (!_map) {
    try { _map = JSON.parse(fs.readFileSync(QUALIFICATION_MAP_PATH, "utf8")); }
    catch (e) {
      _map = {};
      console.error(`[qualificationResolver] QUALIFICATION_ROLE_MAP.json unreadable at ${QUALIFICATION_MAP_PATH}: ${e.message}`);
    }
  }
  return _map;
}

/** For the boot log: how many qualification keys were actually loaded. */
export function qualificationKeyCount() {
  return Object.keys(getMap()).length;
}

// Normalise a raw degree string to a known key.
// Returns null if no match found.
export function normaliseQualification(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const patterns = [
    [/b\.?s\.?\s*(computer science|cs)/,                 "bs_cs"],
    [/m\.?s\.?\s*(computer science|cs)/,                 "ms_cs"],
    [/m\.?eng\.?\s*(computer|software|electrical)/,      "ms_cs"],
    [/b\.?e\.?\s*(civil|construction)/,                  "be_civil"],
    [/b\.?s\.?\s*(civil|construction)/,                  "be_civil"],
    [/m\.?s\.?\s*(construction|project management)/,     "ms_construction_mgmt"],
    [/m\.?b\.?a/,                                        "mba"],
    [/j\.?d\.?|juris\s*doctor/,                          "jd"],
    [/m\.?d\.?|doctor of medicine/,                      "md"],
    [/ph\.?d/,                                           "phd"],
    [/m\.?s\.?\s*(finance|financial)/,                   "ms_finance"],
    [/m\.?f\.?a/,                                        "mfa"],
    [/c\.?p\.?a/,                                        "cpa"],
    [/b\.?s\.?\s*(business|management)/,                 "bs_business"],
    [/b\.?a\.?\s*(psychology|sociology|history|english|communications)/, "ba_liberal_arts"],
    [/b\.?s\.?\s*(nursing|bsn)/,                         "bsn"],
    [/m\.?s\.?n|master.*nursing/,                        "msn"],
    [/m\.?p\.?h|master.*public health/,                  "mph"],
    [/m\.?s\.?\s*(data science|machine learning)/,       "ms_data_science"],
    [/m\.?s\.?\s*(electrical|electronics)/,              "ms_electrical_engineering"],
    [/m\.?s\.?\s*(mechanical)/,                          "ms_mechanical_engineering"],
    [/m\.?s\.?\s*(chemical)/,                            "ms_chemical_engineering"],
    [/pgce|postgraduate certificate.*education/,         "pgce"],
    [/p\.?m\.?p|project management professional/,        "pmp"],
    [/c\.?f\.?a|chartered financial/,                    "cfa"],
    [/f\.?r\.?m|financial risk manager/,                 "frm"],
    [/pharm\.?d|doctor of pharmacy/,                     "pharmd"],
    [/d\.?d\.?s|doctor of dental/,                       "dds"],
    [/professional engineer|p\.?e\.?\s*license/,         "pe_license"],
  ];
  for (const [pattern, key] of patterns) {
    if (pattern.test(lower)) return key;
  }
  return null;
}

// Takes classifier result + optional user-provided qualification override.
// Returns the best qualification key to use.
export function resolveFromClassifier(classifierResult, userProfileQualification = null) {
  // User-provided qualification always wins
  if (userProfileQualification) {
    const resolved = normaliseQualification(userProfileQualification);
    if (resolved) return resolved;
  }
  // Use classifier's extracted qualification
  if (classifierResult?.qualification) {
    // If already normalised (matches a key format), use directly
    const map = getMap();
    if (map[classifierResult.qualification]) return classifierResult.qualification;
    // Try normalising the raw string
    const resolved = normaliseQualification(classifierResult.qualificationRaw || classifierResult.qualification);
    if (resolved) return resolved;
  }
  return null;
}

// Get ATS boost keywords for a qualification key
export function getAtsBoost(qualKey) {
  if (!qualKey) return [];
  const map = getMap();
  return map[qualKey]?.atsBoost || [];
}

// Get search query templates for a qualification key
export function getSearchQueryTemplates(qualKey) {
  if (!qualKey) return [];
  const map = getMap();
  return map[qualKey]?.searchQueryTemplates || [];
}

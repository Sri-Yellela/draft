// ⭐ D190 (owner 11-14: nothing within draft's own data or functions calls a model) · 47m, D197 #15 M5 — the job-profile
// wizard's "more suggestions" (stop 4: keywords · tools · action verbs), WITHOUT a model. It replaces the Haiku call that
// POST /api/domain-profiles/generate-chips made (task profile.domain_chips, A80 V3 — "still a known D17 violation").
//
// Deterministic, in this order, never repeating a chip the person already has:
//   1. the person's own résumé — every chip of the taxonomy registry (this domain first, then the other domains of the same
//      role family, then any domain) that the résumé's text actually says, as a whole word or phrase;
//   2. the role family's taxonomy — the same family's OTHER domains' chips, in registry order, to fill the remaining slots
//      (this field's own chips are already on the wizard's screen as its base set).
// The limits are the old call's (10 keywords, 5 verbs, 5 tools). Each chip says where it came from (`from`).
import { mergeUniqueSignalLabels } from "../shared/profileSignals.js";

export const CHIP_LIMITS = Object.freeze({ keywords: 10, verbs: 5, tools: 5 });
const FIELD = Object.freeze({ keywords: "keywords", verbs: "actionVerbs", tools: "tools" });

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** PURE. Does `text` (already lower-cased) say `chip` as a whole word or phrase? */
export function says(text, chip) {
  const c = norm(chip);
  if (!c || c.length < 2) return false;
  return new RegExp(`(^|[^a-z0-9+#])${escape(c)}($|[^a-z0-9+#])`, "i").test(text);
}

/**
 * PURE. { registry, domain, resumeText, existing: { keywords, verbs, tools } } → { keywords, verbs, tools, from }.
 * `registry` = the domain metadata registry ({ key: { roleFamily, keywords, actionVerbs, tools } }).
 */
export function suggestChips({ registry = {}, domain, resumeText = "", existing = {} } = {}) {
  const entry = registry[domain];
  if (!entry) return { keywords: [], verbs: [], tools: [], from: {} };
  const family = entry.roleFamily;
  const order = [domain, ...Object.keys(registry).filter((k) => k !== domain && registry[k]?.roleFamily === family)];
  const anyDomain = Object.keys(registry).filter((k) => !order.includes(k));
  const text = norm(resumeText);
  const out = { from: {} };
  for (const [kind, field] of Object.entries(FIELD)) {
    const have = new Set((existing[kind] || []).map(norm));
    const picked = [];
    const take = (chip, source) => {
      const n = norm(chip);
      if (!n || have.has(n) || picked.length >= CHIP_LIMITS[kind]) return;
      have.add(n); picked.push(chip); out.from[chip] = source;
    };
    if (text) for (const k of [...order, ...anyDomain]) for (const chip of registry[k]?.[field] || []) if (says(text, chip)) take(chip, "your résumé");
    // the field's own chips are already on screen (the wizard's base set), so the fill is the family's OTHER domains
    for (const k of order.slice(1)) for (const chip of registry[k]?.[field] || []) take(chip, "the same family");
    out[kind] = mergeUniqueSignalLabels(picked, CHIP_LIMITS[kind]);
  }
  return out;
}

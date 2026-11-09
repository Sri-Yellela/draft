// services/keywordTerms.js — ⭐ D186-4 (owner 11-09: "merge what the job profiles module does into the automated workflow
// including the semantic layer for keywords") · THE TERMS THAT RANK A JOB PROFILE'S BOARD, WEIGHTED.
//
//   exact    (3) — on the résumé: the job profile's extracted skills and the profile's own skills section
//   alias    (2) — the same skill by another name: the ONE thesaurus, skill_synonyms, CONFIRMED rows only (k8s = Kubernetes)
//   related  (1) — a neighbour in Atlas's skill graph: a PUBLISHED node's requires / part_of / used_with / leads_to edges
//
// ⛔ RELATED TERMS RANK, NEVER CLAIM (D169 / the claim guard): they reach only the board's ranking (jobQuery's derived
// skills_related tier, BELOW the exact / alias tier); they are never written as the person's skills, never shown as
// skills on the profile, never sent into a tailored résumé. A term the person removes stays removed across résumé
// replaces (domain_profiles.keyword_removed_json, migration 266) — the removal lives on the profile, not on the résumé.
// Cached per profile (its skills + removals are the key), so a board load costs a map lookup.
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const lower = (s) => String(s ?? "").trim().toLowerCase();
export const WEIGHTS = Object.freeze({ exact: 3, alias: 2, related: 1 });
export const MAX_RANK_TERMS = 10, MAX_RELATED = 10;
const RELATED_EDGES = ["requires", "part_of", "used_with", "leads_to"];
const cache = new Map();

export function removedTerms(db, profileId) {
  return safe(() => JSON.parse(db.prepare(`SELECT keyword_removed_json FROM domain_profiles WHERE id = ?`).pluck().get(profileId) || "[]"), []).map(lower);
}

function exactSkills(db, profileId) {
  const out = [];
  const sap = safe(() => db.prepare(`SELECT skills_json FROM profile_simple_apply_profiles WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 1`).pluck().get(profileId), null);
  for (const s of safe(() => JSON.parse(sap || "[]"), [])) { const n = typeof s === "string" ? s : s?.name; if (n) out.push(String(n).trim()); }
  const userId = safe(() => db.prepare(`SELECT user_id FROM domain_profiles WHERE id = ?`).pluck().get(profileId), null);
  if (userId != null) for (const n of safe(() => db.prepare(`SELECT name FROM profile_skills WHERE user_id = ? ORDER BY position, id`).pluck().all(userId), [])) if (n) out.push(String(n).trim());
  const seen = new Set();
  return out.filter(n => { const k = lower(n); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

/** [{ term, weight, source: 'exact' | 'alias' | 'related', via }] — removed terms left out; highest weight first. */
export function keywordTerms(db, profileId, { useCache = true } = {}) {
  const skills = exactSkills(db, profileId);
  const removed = new Set(removedTerms(db, profileId));
  const key = `${profileId}|${skills.join(",")}|${[...removed].join(",")}`;
  if (useCache && cache.has(key)) return cache.get(key);
  const out = [], have = new Set();
  const add = (term, source, via = null) => {
    const k = lower(term);
    if (!k || have.has(k) || removed.has(k)) return;
    have.add(k); out.push({ term: String(term).trim(), weight: WEIGHTS[source], source, via });
  };
  for (const s of skills) add(s, "exact");
  for (const s of skills) {
    for (const r of safe(() => db.prepare(`SELECT term, equivalent FROM skill_synonyms WHERE status = 'confirmed' AND relation = 'alias'
        AND (LOWER(term) = ? OR LOWER(equivalent) = ?) LIMIT 6`).all(lower(s), lower(s)), [])) {
      add(lower(r.term) === lower(s) ? r.equivalent : r.term, "alias", s);
    }
  }
  let related = 0;
  for (const s of skills) {
    if (related >= MAX_RELATED) break;
    const rows = safe(() => db.prepare(`SELECT DISTINCT n2.name FROM atlas_nodes n1
        JOIN atlas_edges e ON (e.from_id = n1.id OR e.to_id = n1.id) AND e.type IN (${RELATED_EDGES.map(() => "?").join(",")})
        JOIN atlas_nodes n2 ON n2.id = CASE WHEN e.from_id = n1.id THEN e.to_id ELSE e.from_id END
       WHERE LOWER(n1.term) = ? AND n1.status = 'published' AND n2.status = 'published' AND n2.kind IN ('skill', 'tool', 'stack') LIMIT 4`)
      .pluck().all(...RELATED_EDGES, lower(s)), []);
    for (const n of rows) { if (related >= MAX_RELATED) break; const before = out.length; add(n, "related", s); if (out.length > before) related++; }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, out);
  return out;
}

/** What the board's ranking reads: the exact + alias tier, and the related tier below it. */
export function rankTerms(db, profileId) {
  const t = keywordTerms(db, profileId);
  // the résumé's own first (six), then their aliases (four) — so an alias is never crowded out by a long skills list
  const exact = t.filter(x => x.source === "exact").slice(0, 6), alias = t.filter(x => x.source === "alias").slice(0, MAX_RANK_TERMS - 6);
  return { primary: [...exact, ...alias].map(x => x.term),
    related: t.filter(x => x.source === "related").slice(0, MAX_RELATED).map(x => x.term) };
}

/** Remove a term from ranking (kept removed across résumé replaces), or put it back. */
export function setTermRemoved(db, profileId, term, removed = true) {
  const k = lower(term);
  if (!k) throw Object.assign(new Error("Which term?"), { status: 400, code: "bad_term" });
  const cur = new Set(removedTerms(db, profileId));
  if (removed) cur.add(k); else cur.delete(k);
  db.prepare(`UPDATE domain_profiles SET keyword_removed_json = ? WHERE id = ?`).run(JSON.stringify([...cur]), profileId);
  return { terms: keywordTerms(db, profileId, { useCache: false }), removed: [...cur] };
}

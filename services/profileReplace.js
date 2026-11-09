// ── D183 P2 · REPLACING THE RÉSUMÉ (owner 11-08; spec docs/sketches/Profile redesign.html, third board) ──────────────
//
// A new base résumé re-fills EVERY section straight away (A140's path, widened), then says what changed, and can be
// undone for 30 days. The rules:
//   · HAND EDITS SURVIVE. An item the person added or changed carries source 'user' (structuredProfile.saveSection marks
//     only what changed); a replace keeps those items, and a hand item wins over the résumé's item with the same key
//     (experience: company + title · education: school · skills: name · links: address). A hand-edited summary stays.
//   · PROVEN NEVER REVERTS. A skill checked or built in Atlas (D169 skill_proofs / checks / builds) stays on the list even
//     when the new résumé no longer says it — its proof lives in skill_proofs, untouched by a replace.
//   · Projects are the person's own (the résumé parse reads none) — never touched. Achievements added by hand — never.
//   · UNTOUCHED: applications already sent and tailored résumés already used (a replace never writes those tables).
//   · UNDO restores the snapshot taken before the replace: the sections (with their sources), the summary, the base
//     résumé text and name, the job profile's role / domain / level / titles / lists, and the contact fields a résumé
//     may have moved. The route then re-extracts the signals from the restored text.
// ⛔ No model reads the résumé here — the parse is the same deterministic one the page already uses.
import { profileFromResume } from "./structuredProfile.js";
import { proofsOf, skillKey } from "./yourSkills.js";
import { profilePage } from "./profilePage.js";
import { PREFILL_FIELDS } from "../shared/resumePrefill.js";

export const UNDO_DAYS = 30;
const DAY = 86400;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const low = (s) => String(s ?? "").trim().toLowerCase();
const hasCol = (db, t, c) => safe(() => !!db.prepare(`SELECT 1 FROM pragma_table_info('${t}') WHERE name = ?`).get(c), false);

const DP_FIELDS = ["profile_name", "role_family", "domain", "seniority", "target_titles", "selected_keywords", "selected_verbs", "selected_tools"];

/** Everything a replace may change, as it is NOW — what Undo puts back. */
export function snapshotForReplace(db, userId, profileId, { content = "", name = null } = {}) {
  const rows = (t) => safe(() => db.prepare(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY position, id`).all(userId), []);
  const sec = safe(() => db.prepare(`SELECT * FROM profile_sections WHERE user_id = ?`).get(userId), null);
  const dp = profileId != null ? safe(() => db.prepare(`SELECT ${DP_FIELDS.join(", ")} FROM domain_profiles WHERE id = ? AND user_id = ?`).get(profileId, userId), null) : null;
  const up = safe(() => db.prepare(`SELECT * FROM user_profile WHERE user_id = ?`).get(userId), null) || {};
  const contact = Object.fromEntries(PREFILL_FIELDS.filter(f => f in up).map(f => [f, up[f]]).concat("location" in up ? [["location", up.location]] : []));
  return {
    sections: { summary: sec?.summary ?? null, summarySource: sec?.summary_source ?? null, importedBasis: sec?.imported_basis ?? null,
      experience: rows("profile_experience"), education: rows("profile_education"), skills: rows("profile_skills"), links: rows("profile_links") },
    base: { profileId, content: String(content || ""), name },
    domainProfile: dp,
    contact,
  };
}

/** A short reading of the page for the before / after comparison. */
export function pageDigest(db, userId) {
  const p = safe(() => profilePage(db, userId), null);
  if (!p) return null;
  return {
    headline: p.header.headline || null,
    placement: p.header.placement ? { path: `${p.header.placement.categoryName} › ${p.header.placement.subName}`, sub: p.header.placement.subName,
      level: p.header.placement.levelLabel } : null,
    experience: (p.sections.experience.items || []).map(x => ({ company: x.company, title: x.title, start: x.start, end: x.current ? null : x.end,
      current: !!x.current, bullets: (x.bullets || []).length, logo: !!x.logo })),
    fromResume: (p.sections.skills.fromResume || []).map(s => s.name),
    proven: (p.sections.skills.proven || []).map(s => s.name),
  };
}

/**
 * Re-fill every section from the current base résumé, keeping hand edits and proven skills. Returns
 * { ok, kept: { hand, proven, summary } } — ok false when the résumé could not be read (nothing is changed then).
 */
export function refillFromResume(db, userId) {
  const parsed = profileFromResume(db, userId);
  if (!parsed?.ok) return { ok: false };
  const rows = (t) => safe(() => db.prepare(`SELECT * FROM ${t} WHERE user_id = ? ORDER BY position, id`).all(userId), []);
  const hand = (r) => r.source === "user";
  const linksSrc = hasCol(db, "profile_links", "source");
  const sumSrc = hasCol(db, "profile_sections", "summary_source");
  const kept = { hand: 0, proven: [], summary: false };

  // merge(list from résumé, hand rows, key): hand rows win on their key; résumé items fill the rest, in résumé order.
  const merge = (fromResume, handRows, keyOf) => {
    const handKeys = new Set(handRows.map(keyOf));
    kept.hand += handRows.length;
    return [...fromResume.filter(x => !handKeys.has(keyOf(x))).map(x => ({ ...x, source: "resume" })), ...handRows.map(r => ({ ...r, source: "user" }))];
  };
  const exp = merge(parsed.experience, rows("profile_experience").filter(hand).map(r => ({ company: r.company, title: r.title, location: r.location,
    start: r.start_ym, end: r.end_ym, current: !!r.is_current, bullets: JSON.parse(r.bullets_json || "[]") })), x => `${low(x.company)}|${low(x.title)}`);
  const edu = merge(parsed.education, rows("profile_education").filter(hand).map(r => ({ school: r.school, degree: r.degree, field: r.field,
    start: r.start_ym, end: r.end_ym })), x => low(x.school));
  let skills = merge(parsed.skills, rows("profile_skills").filter(hand).map(r => ({ name: r.name, category: r.category })), x => low(x.name));
  // ⛔ PROVEN NEVER REVERTS: a proven skill the new résumé dropped stays on the list (as the person's).
  const proofs = safe(() => proofsOf(db, userId), new Map());
  const have = new Set(skills.map(x => skillKey(x.name)));
  for (const r of rows("profile_skills")) {
    const k = skillKey(r.name);
    const p = proofs.get(k);
    if ((p?.state === "checked" || p?.state === "built") && !have.has(k)) { skills.push({ name: r.name, category: r.category, source: r.source || "resume" }); have.add(k); kept.proven.push(r.name); }
  }
  const links = linksSrc
    ? merge(parsed.links, rows("profile_links").filter(hand).map(r => ({ kind: r.kind, url: r.url })), x => low(x.url).replace(/\/+$/, ""))
    : parsed.links.map(x => ({ ...x, source: "resume" }));
  const sec = safe(() => db.prepare(`SELECT summary${sumSrc ? ", summary_source" : ""} FROM profile_sections WHERE user_id = ?`).get(userId), null);
  const keepSummary = sumSrc && sec?.summary_source === "user" && String(sec.summary || "").trim();
  if (keepSummary) kept.summary = true;

  db.transaction(() => {
    db.prepare(`INSERT INTO profile_sections (user_id, summary, imported_basis, updated_at) VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, imported_basis = excluded.imported_basis, updated_at = unixepoch()`)
      .run(userId, keepSummary ? sec.summary : parsed.summary, parsed.basis);
    for (const t of ["profile_experience", "profile_education", "profile_skills", "profile_links"]) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    exp.forEach((x, i) => db.prepare(`INSERT INTO profile_experience (user_id, company, title, location, start_ym, end_ym, is_current, bullets_json, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.company, x.title, x.location, x.start, x.current ? null : x.end, x.current ? 1 : 0, JSON.stringify(x.bullets || []), i, x.source));
    edu.forEach((x, i) => db.prepare(`INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.school, x.degree, x.field, x.start, x.end, i, x.source));
    skills.forEach((x, i) => db.prepare(`INSERT INTO profile_skills (user_id, name, category, position, source) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, x.name, x.category ?? null, i, x.source));
    links.forEach((x, i) => (linksSrc
      ? db.prepare(`INSERT INTO profile_links (user_id, kind, url, position, source) VALUES (?, ?, ?, ?, ?)`).run(userId, x.kind, x.url, i, x.source)
      : db.prepare(`INSERT INTO profile_links (user_id, kind, url, position) VALUES (?, ?, ?, ?)`).run(userId, x.kind, x.url, i)));
  })();
  return { ok: true, kept };
}

/** PURE. The What changed lines from two digests and what the refill kept. */
export function whatChanged(before, after, kept = {}, { handAchievements = 0, projects = 0 } = {}) {
  const lines = [];
  if (!before || !after) return { lines, kept: [], untouched: UNTOUCHED };
  if ((before.headline || "") !== (after.headline || "")) lines.push({ kind: "changed", what: "headline", text: `Headline: ${after.headline || "—"}`, was: before.headline || null });
  const keyOf = (x) => `${low(x.company)}|${low(x.title)}`;
  const was = new Map(before.experience.map(x => [keyOf(x), x]));
  const byCompany = new Map(before.experience.map(x => [low(x.company), x]));
  for (const x of after.experience) {
    const b = was.get(keyOf(x));
    const range = `${x.start ? x.start.slice(0, 4) : ""}${x.current ? " – now" : x.end ? ` – ${x.end.slice(0, 4)}` : ""}`;
    if (!b) {
      const sameCo = byCompany.get(low(x.company));
      lines.push({ kind: sameCo ? "changed" : "added", what: "experience",
        text: `Experience: ${x.company} · ${x.title || "—"}${range ? ` · ${range}` : ""}`,
        detail: [x.logo ? "its logo found" : null, `${x.bullets} bullet${x.bullets === 1 ? "" : "s"}`].filter(Boolean).join(" · ") });
    } else if (b.end !== x.end || b.current !== x.current || b.start !== x.start || b.bullets !== x.bullets) {
      lines.push({ kind: "changed", what: "experience",
        text: `Experience: ${x.company} ${x.current ? "is current" : x.end ? `now ends ${x.end.slice(0, 4)}` : "dates changed"}${b.bullets !== x.bullets ? ` · ${x.bullets} bullets` : ""}` });
    }
  }
  const afterKeys = new Set(after.experience.map(keyOf));
  for (const b of before.experience) if (!afterKeys.has(keyOf(b))) lines.push({ kind: "removed", what: "experience", text: `Experience: ${b.company} · ${b.title || "—"}`, detail: "no longer in the résumé" });
  const bs = new Set(before.fromResume.map(low)), as = new Set(after.fromResume.map(low));
  const addedS = after.fromResume.filter(n => !bs.has(low(n))), removedS = before.fromResume.filter(n => !as.has(low(n)));
  if (addedS.length) lines.push({ kind: "added", what: "skills", text: `Skills from your résumé: ${addedS.join(" · ")}`, detail: "not proven yet — Prove it from Skills" });
  if (removedS.length) lines.push({ kind: "removed", what: "skills", text: `Skills from your résumé: ${removedS.join(" · ")}`, detail: "no longer in the résumé" });
  const bp = before.placement, ap = after.placement;
  if ((bp?.path || "") !== (ap?.path || "") || (bp?.level || "") !== (ap?.level || "")) {
    lines.push({ kind: "changed", what: "fit",
      text: `Where you fit: ${ap ? `${ap.path} · ${bp && bp.level !== ap.level ? `${bp.level} → ${ap.level}` : ap.level}` : "not placed"}`,
      detail: "your job profiles, search terms and the board follow it" });
  }
  const keptParts = [];
  const proven = [...new Set([...(after.proven || []), ...(kept.proven || [])])];
  if (proven.length) keptParts.push(`proven skills (${proven.join(", ")})`);
  if (projects) keptParts.push(projects === 1 ? "your project" : `your ${projects} projects`);
  const handN = (kept.hand || 0) + handAchievements;
  if (handN) keptParts.push(`${handN} item${handN === 1 ? "" : "s"} you added or edited by hand`);
  if (kept.summary) keptParts.push("the summary you wrote");
  return { lines, kept: keptParts, untouched: UNTOUCHED };
}
const UNTOUCHED = "applications already sent, and tailored résumés already used";

export function recordReplacement(db, userId, profileId, snapshot, changes, { name = null } = {}) {
  return db.prepare(`INSERT INTO profile_replacements (user_id, profile_id, snapshot_json, changes_json) VALUES (?, ?, ?, ?)`)
    .run(userId, profileId ?? null, JSON.stringify(snapshot), JSON.stringify({ ...changes, name })).lastInsertRowid;
}

const shape = (r, now) => r && {
  id: r.id, status: r.status, at: r.created_at, ...JSON.parse(r.changes_json || "{}"),
  undoable: r.status !== "undone" && now - r.created_at <= UNDO_DAYS * DAY,
  undoUntil: r.created_at + UNDO_DAYS * DAY,
};

/** The newest replace still waiting for "Looks right" (status applied, within the undo window), or null. */
export function latestReplacement(db, userId, now = Math.floor(Date.now() / 1000)) {
  const r = safe(() => db.prepare(`SELECT * FROM profile_replacements WHERE user_id = ? AND status = 'applied' AND created_at >= ? ORDER BY created_at DESC, id DESC LIMIT 1`)
    .get(userId, now - UNDO_DAYS * DAY), null);
  // 45o: `.get()` answers undefined for no row — the route's JSON then had no `replacement` key at all; null says "none".
  return r ? shape(r, now) : null;
}

/** "Looks right" — the summary is put away; Undo is still offered from the replace's own record until the window ends. */
export function keepReplacement(db, userId, id) {
  const n = db.prepare(`UPDATE profile_replacements SET status = 'kept', settled_at = unixepoch() WHERE id = ? AND user_id = ? AND status = 'applied'`).run(Number(id), userId).changes;
  if (!n) throw bad(404, "not_found", "Nothing to confirm.");
}

/**
 * Undo — put back everything the replace changed. Returns { profileId, content, name } so the route re-extracts the
 * signals from the restored text. Refused after UNDO_DAYS, for someone else's record, or twice.
 */
export function undoReplacement(db, userId, id, now = Math.floor(Date.now() / 1000)) {
  const r = db.prepare(`SELECT * FROM profile_replacements WHERE id = ? AND user_id = ?`).get(Number(id), userId);
  if (!r) throw bad(404, "not_found", "No such change.");
  if (r.status === "undone") throw bad(409, "already_undone", "That change was already undone.");
  if (now - r.created_at > UNDO_DAYS * DAY) throw bad(409, "too_late", `Undo works for ${UNDO_DAYS} days.`);
  const s = JSON.parse(r.snapshot_json);
  const linksSrc = hasCol(db, "profile_links", "source");
  const sumSrc = hasCol(db, "profile_sections", "summary_source");
  db.transaction(() => {
    const sec = s.sections;
    db.prepare(`INSERT INTO profile_sections (user_id, summary, imported_basis, updated_at) VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, imported_basis = excluded.imported_basis, updated_at = unixepoch()`)
      .run(userId, sec.summary, sec.importedBasis);
    if (sumSrc) db.prepare(`UPDATE profile_sections SET summary_source = ? WHERE user_id = ?`).run(sec.summarySource, userId);
    for (const t of ["profile_experience", "profile_education", "profile_skills", "profile_links"]) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    sec.experience.forEach((x) => db.prepare(`INSERT INTO profile_experience (user_id, company, title, location, start_ym, end_ym, is_current, bullets_json, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.company, x.title, x.location, x.start_ym, x.end_ym, x.is_current, x.bullets_json, x.position, x.source));
    sec.education.forEach((x) => db.prepare(`INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.school, x.degree, x.field, x.start_ym, x.end_ym, x.position, x.source));
    sec.skills.forEach((x) => db.prepare(`INSERT INTO profile_skills (user_id, name, category, position, source) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, x.name, x.category, x.position, x.source));
    sec.links.forEach((x) => (linksSrc
      ? db.prepare(`INSERT INTO profile_links (user_id, kind, url, position, source) VALUES (?, ?, ?, ?, ?)`).run(userId, x.kind, x.url, x.position, x.source ?? null)
      : db.prepare(`INSERT INTO profile_links (user_id, kind, url, position) VALUES (?, ?, ?, ?)`).run(userId, x.kind, x.url, x.position)));
    if (s.domainProfile && s.base.profileId != null) {
      db.prepare(`UPDATE domain_profiles SET ${DP_FIELDS.map(f => `${f} = ?`).join(", ")} WHERE id = ? AND user_id = ?`)
        .run(...DP_FIELDS.map(f => s.domainProfile[f]), s.base.profileId, userId);
    }
    const cols = Object.keys(s.contact || {});
    if (cols.length) db.prepare(`UPDATE user_profile SET ${cols.map(c => `${c} = ?`).join(", ")} WHERE user_id = ?`).run(...cols.map(c => s.contact[c]), userId);
    db.prepare(`UPDATE profile_replacements SET status = 'undone', settled_at = unixepoch() WHERE id = ?`).run(r.id);
  })();
  return { profileId: s.base.profileId, content: s.base.content, name: s.base.name };
}

// ── D183 P1 · PROFILE = YOUR PAGE (owner 11-08, TOP PRIORITY; spec docs/sketches/Profile redesign.html) ─────────────
//
// One LinkedIn-like page built from the résumé. This service is the page's READ and its VISIBILITY model; the sections'
// content still lives where D101 keeps it (services/structuredProfile.js — summary, experience, projects, education,
// skills, links) and is edited in place by the same endpoints. What this adds:
//   · WHO CAN SEE IT — a page level (only_me · connections · public), DEFAULT only_me for every account; each section has
//     its own eye that may NARROW it, never widen it (effective = the narrower of the two); "Where you fit" starts at
//     only_me even on a public page. Contact details and everything under *Behind your profile* are never public — they
//     are not sections, so no setting can reach them.
//   · ENFORCED HERE, not in the page: viewFor(viewer) builds the payload a viewer may see — a section they may not see
//     is never put in the object, so it can never be sent (d183ServerOmitsHiddenSections).
//   · THE HEADER — name, headline, location, years, the placement ("Fits <subcategory> · <level> · also <second>") read
//     from the résumé with D179's taxonomy classifier and the onboarding's level rule, Open to work / referrals welcome.
//   · SKILLS IN TWO COLUMNS — Proven in Atlas (D169 checked / built, with how and when) and From your résumé (claimed).
//   · WHERE YOU FIT — D179 P6's subcategory readiness for the placement (only proven counts; claims shown as waiting).
//   · ACHIEVEMENTS — certifications / awards read from the résumé + modules finished in Atlas + hand-added ones.
//   · LINKS — each with its kind (github / linkedin get their marks in the page; anything else its domain).
// ⛔ No AI reads a profile for anyone but its owner's own features — nothing here calls a model.
import { readProfile } from "./structuredProfile.js";
import { listYourSkills, baseResumeText } from "./yourSkills.js";
import { learningProof } from "./atlas/points.js";
import { subcategoryReadiness } from "./atlas/roleReadiness.js";
import { classifyPosting, taxonomy } from "./jobs/taxonomyClassify.js";
import { yearsOfWork, seniorityOf } from "./resumeOnboarding.js";
import { readProofPage } from "./proofLinks.js";

export const PAGE_LEVELS = Object.freeze(["only_me", "connections", "public"]);
export const PAGE_SECTIONS = Object.freeze(["about", "experience", "skills", "fit", "projects", "achievements", "education", "links"]);
/** A section's own default when the person has not touched its eye: null = follows the page. */
export const SECTION_DEFAULTS = Object.freeze({ fit: "only_me" });
export const LEVEL_WORDS = Object.freeze({ only_me: "Only you", connections: "Connections", public: "Public" });
export const VIEWERS = Object.freeze(["owner", "connection", "public"]);
const RANK = Object.freeze({ only_me: 0, connections: 1, public: 2 });
const VIEWER_RANK = Object.freeze({ owner: 0, connection: 1, public: 2 });
export const ACHIEVEMENT_LIMITS = Object.freeze({ title: 120, detail: 160, max: 30 });
export const HEADLINE_MAX = 160;
const LEVEL_LABEL = Object.freeze({ junior: "early-career", mid: "mid-level", senior: "senior", executive: "leadership" });

const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** PURE. The narrower of the page's level and a section's own (a section never shows wider than the page). */
export function effectiveLevel(page, section) {
  const p = PAGE_LEVELS.includes(page) ? page : "only_me";
  if (!PAGE_LEVELS.includes(section)) return p;
  return RANK[section] < RANK[p] ? section : p;
}

/** PURE. May this viewer see something at this level? The owner sees everything; a connection sees connections + public. */
export function visibleTo(viewer, level) {
  if (viewer === "owner") return true;
  const v = VIEWER_RANK[viewer];
  if (v == null) return false;
  return RANK[level] >= v;
}

// ── the stored setting ─────────────────────────────────────────────────────────────────────────

/** { page, sections: { id: level|null }, effective: { id: level }, searchable, openToWork, referrals, headline } — no row is all private. */
export function readVisibility(db, userId) {
  const r = safe(() => db.prepare(`SELECT * FROM profile_page WHERE user_id = ?`).get(userId), null);
  const page = PAGE_LEVELS.includes(r?.page_level) ? r.page_level : "only_me";
  const stored = safe(() => JSON.parse(r?.sections_json || "{}"), {}) || {};
  const sections = {}, effective = {};
  for (const id of PAGE_SECTIONS) {
    const own = PAGE_LEVELS.includes(stored[id]) ? stored[id] : (SECTION_DEFAULTS[id] ?? null);
    sections[id] = own;
    effective[id] = effectiveLevel(page, own);
  }
  return { page, sections, effective, searchable: !!r?.searchable, openToWork: !!r?.open_to_work, referrals: !!r?.referrals,
    headline: r?.headline ?? null };
}

/**
 * Change one or more settings: { page } · { section, level } (level null = follow the page) · { searchable } ·
 * { openToWork } · { referrals } · { headline }. Unknown values are refused, never coerced.
 */
export function setVisibility(db, userId, body = {}) {
  const cur = readVisibility(db, userId);
  const stored = safe(() => JSON.parse(db.prepare(`SELECT sections_json FROM profile_page WHERE user_id = ?`).pluck().get(userId) || "{}"), {}) || {};
  let page = cur.page;
  if ("page" in body) {
    if (!PAGE_LEVELS.includes(body.page)) throw bad(400, "bad_level", "Who can see it is Only you, Connections or Public.");
    page = body.page;
  }
  if ("section" in body) {
    if (!PAGE_SECTIONS.includes(body.section)) throw bad(400, "bad_section", "No such section.");
    if (body.level != null && !PAGE_LEVELS.includes(body.level)) throw bad(400, "bad_level", "Who can see it is Only you, Connections or Public.");
    if (body.level == null) delete stored[body.section]; else stored[body.section] = body.level;
  }
  const flag = (k, v) => (k in body ? (body[k] === true ? 1 : body[k] === false ? 0 : (() => { throw bad(400, "bad_flag", `${k} is true or false.`); })()) : (v ? 1 : 0));
  let headline = cur.headline;
  if ("headline" in body) headline = body.headline == null ? null : (clean(body.headline, HEADLINE_MAX) || null);
  db.prepare(`INSERT INTO profile_page (user_id, page_level, sections_json, searchable, open_to_work, referrals, headline, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET page_level = excluded.page_level, sections_json = excluded.sections_json, searchable = excluded.searchable,
      open_to_work = excluded.open_to_work, referrals = excluded.referrals, headline = excluded.headline, updated_at = excluded.updated_at`)
    .run(userId, page, JSON.stringify(stored), flag("searchable", cur.searchable), flag("openToWork", cur.openToWork), flag("referrals", cur.referrals), headline);
  return readVisibility(db, userId);
}

// ── the pieces read from the résumé ────────────────────────────────────────────────────────────

const plain = (t) => String(t ?? "").replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
const ACHIEVE_HEAD = /^\s*(certifications?|licen[cs]es?(?: and certifications?)?|certifications? and licen[cs]es|awards?(?: and honou?rs)?|honou?rs(?: and awards?)?|achievements?)\s*:?\s*$/i;
const ANY_HEAD = /^\s*(experience|work experience|employment|professional experience|education|skills|technical skills|projects|summary|profile|publications|volunteer\w*|interests|languages|references|certifications?|awards?|honou?rs|achievements?|licen[cs]es?)\b[^a-z]*$/i;

/** PURE. Certifications and awards from the résumé's own sections: [{ title, year, kind }] (each line under the heading). */
export function achievementsFromResume(text) {
  const out = [];
  let kind = null;
  for (const raw of plain(text).split(/\r?\n/)) {
    const line = raw.replace(/^[\s•\-–*·]+/, "").trim();
    if (!line) continue;
    const h = ACHIEVE_HEAD.exec(line);
    if (h) { kind = /award|honou?r|achievement/i.test(h[1]) ? "award" : "certification"; continue; }
    if (ANY_HEAD.test(line) && line.length < 40) { kind = null; continue; }
    if (!kind || line.length < 3) continue;
    const year = /\b(19[89]\d|20[0-4]\d)\b/.exec(line)?.[1] || null;
    const title = clean(line.replace(/\(?\b(19[89]\d|20[0-4]\d)\b\)?/g, "").replace(/[\s,·|–-]+$/, ""), ACHIEVEMENT_LIMITS.title);
    if (title && !out.some(a => a.title.toLowerCase() === title.toLowerCase())) out.push({ title, year: year ? Number(year) : null, kind });
    if (out.length >= ACHIEVEMENT_LIMITS.max) break;
  }
  return out;
}

/** PURE. A link's kind for the page: github / linkedin (drawn as their marks) or web (a plain link icon + the domain). */
export function linkKind(url) {
  let host = "";
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
  if (host === "github.com" || host.endsWith(".github.com")) return { kind: "github", host };
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return { kind: "linkedin", host };
  return { kind: "web", host };
}

/** The person's links, deduplicated: the Links section first, then the profile's LinkedIn / GitHub / website fields. https only. */
export function pageLinks(sections, profileRow = {}) {
  const seen = new Set();
  const out = [];
  const add = (url) => {
    const u = String(url || "").trim();
    if (!/^https?:\/\//i.test(u)) return;
    const k = u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();
    if (seen.has(k)) return;
    const kind = linkKind(u);
    if (!kind) return;
    seen.add(k);
    out.push({ url: u, kind: kind.kind, label: k });
  };
  for (const l of sections?.links || []) add(l.url);
  for (const col of ["linkedin_url", "github_url", "website_url", "portfolio_url"]) add(profileRow[col]);
  return out;
}

/** The base résumé the page was built from: { name, at } — the active job profile's, else the account's. */
function sourceOf(db, userId) {
  return safe(() => db.prepare(`SELECT pbr.name, pbr.updated_at AS at FROM profile_base_resumes pbr JOIN domain_profiles dp ON dp.id = pbr.profile_id
      WHERE pbr.user_id = ? AND dp.is_active = 1 AND TRIM(COALESCE(pbr.content, '')) != '' LIMIT 1`).get(userId), null)
    || safe(() => db.prepare(`SELECT name, updated_at AS at FROM base_resume WHERE user_id = ? AND TRIM(COALESCE(content, '')) != ''`).get(userId), null);
}

/**
 * Where the résumé places the person: the most recent role's title (then the next distinct one) read against the
 * approved taxonomy with the résumé as its description, and the level by the onboarding's rule.
 * @returns { category, categoryName, subcategory, subName, level, levelLabel, also: { subcategory, subName } | null } | null
 */
export function placementFromResume({ titles = [], text = "", years = null }, tax = safe(() => taxonomy(), null)) {
  if (!tax) return null;
  const subName = (id) => { for (const c of tax.categories) { const s = c.subs.find(x => x.id === id); if (s) return { sub: s, cat: c }; } return null; };
  const desc = plain(text).slice(0, 6000);
  const seen = [];
  for (const t of titles.map(x => String(x || "").trim()).filter(Boolean)) {
    const r = safe(() => classifyPosting({ title: t, description: desc }, tax), null);
    if (r?.subcategory && !seen.some(x => x.subcategory === r.subcategory)) seen.push(r);
    if (seen.length >= 2) break;
  }
  if (!seen.length) return null;
  const first = subName(seen[0].subcategory);
  const level = seniorityOf(text, years);
  const second = seen[1] ? subName(seen[1].subcategory) : null;
  return {
    category: seen[0].category, categoryName: first?.cat?.name || null,
    subcategory: seen[0].subcategory, subName: first?.sub?.name || null,
    level, levelLabel: LEVEL_LABEL[level] || level,
    also: second ? { subcategory: seen[1].subcategory, subName: second.sub.name } : null,
  };
}

// ⭐ A153 (45o): moved to shared/durationLabel.js — the section editor draws the same words.
import { durationLabel } from "../shared/durationLabel.js";
export { durationLabel };

// ── the page ───────────────────────────────────────────────────────────────────────────────────

/** Hand-added achievements (source 'hand'). */
function handAchievements(db, userId) {
  return safe(() => db.prepare(`SELECT id, title, detail, year FROM profile_achievements WHERE user_id = ? ORDER BY position, id`).all(userId), [])
    .map(r => ({ id: r.id, title: r.title, detail: r.detail, year: r.year, source: "hand" }));
}

export function addAchievement(db, userId, body = {}) {
  const title = clean(body.title, ACHIEVEMENT_LIMITS.title);
  if (!title) throw bad(400, "bad_achievement", "Name the achievement, for example a certification or an award.");
  const detail = clean(body.detail, ACHIEVEMENT_LIMITS.detail) || null;
  const year = body.year == null || body.year === "" ? null : Number(body.year);
  if (year != null && !(Number.isInteger(year) && year >= 1950 && year <= 2100)) throw bad(400, "bad_year", "The year is four digits.");
  const n = db.prepare(`SELECT COUNT(*) FROM profile_achievements WHERE user_id = ?`).pluck().get(userId);
  if (n >= ACHIEVEMENT_LIMITS.max) throw bad(400, "too_many", `At most ${ACHIEVEMENT_LIMITS.max} achievements.`);
  db.prepare(`INSERT INTO profile_achievements (user_id, title, detail, year, position) VALUES (?, ?, ?, ?, ?)`).run(userId, title, detail, year, n);
}
export function removeAchievement(db, userId, id) {
  db.prepare(`DELETE FROM profile_achievements WHERE user_id = ? AND id = ?`).run(userId, Number(id));
}

/**
 * THE OWNER'S PAGE — every section with its visibility, the header, the source line, the two skill columns, where you
 * fit, achievements and links. The section CONTENT is D101's readProfile (first open fills it from the résumé).
 */
export function profilePage(db, userId, { now = new Date() } = {}) {
  const prof = readProfile(db, userId);
  const s = prof.sections;
  const vis = readVisibility(db, userId);
  const row = safe(() => db.prepare(`SELECT * FROM user_profile WHERE user_id = ?`).get(userId), null) || {};
  const account = safe(() => db.prepare(`SELECT display_name, avatar_path FROM users WHERE id = ?`).get(userId), null) || {};
  const text = safe(() => baseResumeText(db, userId), "");
  const years = Number.isFinite(Number(row.years_of_experience)) && row.years_of_experience != null && row.years_of_experience !== ""
    ? Number(row.years_of_experience) : safe(() => yearsOfWork(plain(text), now.getUTCFullYear()), null);
  const exp = (s.experience || []).map(x => ({ ...x, duration: durationLabel(x.start, x.current ? null : x.end, now) }));
  const titles = exp.map(x => x.title).concat(row.current_job_title ? [row.current_job_title] : []);
  const placement = text.trim() ? placementFromResume({ titles, text, years }) : null;
  const name = String(row.full_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || account.display_name || "").trim() || null;
  const location = String(row.location || [row.city, row.state].filter(Boolean).join(", ") || "").trim() || null;
  const headline = vis.headline || row.current_job_title || exp[0]?.title || null;

  // Skills: two columns. Proven = D169 checked / built (with how and when); From your résumé = still claimed.
  const ys = safe(() => listYourSkills(db, userId), { skills: [] });
  const proof = safe(() => learningProof(db, userId), { modules: [], skills: [], builds: [] });
  const provenAt = new Map(proof.skills.map(x => [String(x.name).toLowerCase(), x]));
  const proven = ys.skills.filter(x => x.state === "checked" || x.state === "built").map(x => {
    const p = provenAt.get(String(x.name).toLowerCase());
    return { name: x.name, key: x.key, how: x.state === "built" ? "built" : "checked", at: x.proof?.at || p?.at || null,
      url: x.proof?.url || p?.url || null, slug: x.node?.slug || null };
  });
  const fromResume = ys.skills.filter(x => x.state === "claimed" && x.from === "profile")
    .map(x => ({ name: x.name, key: x.key, slug: x.node?.slug || null, action: x.action }));

  // Where you fit: the placement's readiness (only proven counts; claims are shown as waiting).
  let fit = null;
  if (placement?.subcategory) {
    const r = safe(() => subcategoryReadiness(db, userId, placement.subcategory), null);
    fit = r?.found ? { role: r.role?.name || placement.subName, thin: !!r.thin, ready: r.ready ?? null, waiting: r.waiting ?? null,
      scope: r.scope?.line || null, moves: (r.moves || []).slice(0, 3).map(m => ({ name: m.name, adds: m.adds, action: m.action, slug: m.slug })),
      line: r.line || null } : { role: placement.subName, thin: true, line: "Not enough postings yet to say how ready you are." };
  }

  const achievements = [
    ...achievementsFromResume(text).map(a => ({ title: a.title, detail: a.kind === "award" ? "Award · from your résumé" : "From your résumé", year: a.year, source: "resume" })),
    ...proof.modules.map(m => ({ title: m.title, detail: "Finished in Atlas", at: m.at, source: "atlas" })),
    ...handAchievements(db, userId),
  ];

  // ⛔ A140 KEPT: the terms drawn bold in the experience — the active job profile's extracted skills and keywords (the
  // Skills section's own are added by the editor itself).
  const highlight = safe(() => {
    const r = db.prepare(`SELECT spa.skills_json, spa.keywords_json FROM profile_simple_apply_profiles spa JOIN domain_profiles dp ON dp.id = spa.profile_id
      WHERE spa.user_id = ? AND dp.is_active = 1 LIMIT 1`).get(userId);
    return r ? [...JSON.parse(r.skills_json || "[]"), ...JSON.parse(r.keywords_json || "[]")].map(x => String(x || "").trim()).filter(Boolean) : [];
  }, []);

  const src = sourceOf(db, userId);
  const proofPage = safe(() => readProofPage(db, userId), { enabled: false, handle: null });
  return {
    visibility: vis,
    levels: LEVEL_WORDS,
    header: { name, headline, location, years, avatar: !!account.avatar_path, handle: proofPage.handle || null,
      placement, openToWork: vis.openToWork, referrals: vis.referrals },
    source: src ? { name: src.name || "your résumé", at: src.at || null } : null,
    // ⭐ A153 (45o): the job profile a replace writes to — the page's own Replace résumé (the old form's same three steps).
    activeProfileId: safe(() => db.prepare(`SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).pluck().get(userId), null) ?? null,
    highlight,
    sections: {
      about: { summary: s.summary || null },
      experience: { items: exp },
      skills: { proven, fromResume, counts: { proven: proven.length, fromResume: fromResume.length } },
      fit: fit ? { ...fit, placement } : null,
      projects: { items: s.projects || [] },
      achievements: { items: achievements },
      education: { items: s.education || [] },
      links: { items: pageLinks(s, row) },
    },
  };
}

/**
 * ⛔ THE SERVER-SIDE FILTER: what a viewer may see of a page. A section the viewer may not see is DELETED from the object
 * (never sent); contact, application defaults and everything under Behind your profile are never in the page at all.
 * For the owner it returns the page unchanged. `viewer` is 'owner' | 'connection' | 'public'.
 */
export function viewFor(page, viewer) {
  if (viewer === "owner") return page;
  if (!VIEWERS.includes(viewer)) throw bad(400, "bad_viewer", "View as the public or a connection.");
  const eff = page.visibility.effective;
  const sections = {};
  for (const id of PAGE_SECTIONS) if (page.sections[id] != null && visibleTo(viewer, eff[id])) sections[id] = page.sections[id];
  // A visitor's skills never carry the claim-only actions (Prove it is the owner's button).
  if (sections.skills) sections.skills = { ...sections.skills, fromResume: sections.skills.fromResume.map(({ name }) => ({ name })) };
  const pageVisible = visibleTo(viewer, page.visibility.page);
  const h = page.header;
  return {
    viewer,
    private: !pageVisible,
    searchable: page.visibility.searchable,
    // The spec's public header: name, headline, location, "Open to work · <area> · referrals welcome". The level, the
    // years and the readiness stay with "Where you fit" (only you by default) — a visitor sees the area only.
    header: pageVisible ? { name: h.name, headline: h.headline, location: h.location, avatar: h.avatar, handle: h.handle,
      area: h.placement?.subName || null, openToWork: h.openToWork, referrals: h.referrals } : null,
    sections: pageVisible ? sections : {},
    hidden: PAGE_SECTIONS.filter(id => !(id in sections) || !pageVisible),
  };
}

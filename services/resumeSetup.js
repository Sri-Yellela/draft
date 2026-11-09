// services/resumeSetup.js — ⭐ D186 (owner 11-09: "theres a bunch of stuff we ask, and most of it can be automated with what we
// have … the manual options should still be there") · ONE RÉSUMÉ SETS UP EVERYTHING.
//
// THE RULE: automatic by default, manual always available. Everything a résumé can tell us is filled and marked
// "from your résumé" (resume_filled_json, migration 266); a value the person typed is never overwritten (A140's rule:
// only an EMPTY field, or one still holding the OLD résumé's value, is written); a field the person saves leaves the list.
// ONLY what a résumé can't honestly tell us is asked — the FOUR THINGS (visa status · desired salary · start date ·
// relocate), once, each skippable — and never inferred: a legal status, a person's price, their dates, their moves.
//
//   resumeExtras(db, userId, text)   current title / company (the profile's current experience row), years of work
//                                    (dated experience, overlaps counted once), country (a US state → United States),
//                                    portfolio (a portfolio / Behance / Dribbble link) — what A33's prefill doesn't cover
//   fillExtras(db, userId, text, { oldText })   writes them under the same rule, and records every filled field
//   recordFilled / clearFilled       the "from your résumé" list (written fields in; saved-by-hand fields out)
//   profileNameFromPlacement(p)      "Frontend software engineering · mid" — the job profile's name (D186-3)
//   nameAndTitlesFromPlacement(db, profileId, { force })   names an auto-named profile from its placement and adds the
//                                    subcategory's title aliases to its titles (the résumé's own stay first)
//   fourThings / setFourThing        the card (D186-2)
//   isTestAccount(db, userId)        D186-6: only test accounts may be filled from a fictional sample résumé
import { taxonomy } from "./jobs/taxonomyClassify.js";
import { storedPlacement } from "./placement.js";
import { yearsOfWork } from "./resumeOnboarding.js";

const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const lower = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
export const EXTRA_FIELDS = Object.freeze(["current_job_title", "current_company", "years_of_experience", "country", "portfolio_url"]);
export const FOUR_THINGS = Object.freeze([
  { key: "visa_type", label: "Your visa or work-authorisation status", why: "a legal status — never guessed from a résumé" },
  { key: "desired_salary", label: "Desired salary", why: "your number, not ours" },
  { key: "available_start_date", label: "When you can start", why: "" },
  { key: "willing_to_relocate", label: "Willing to relocate", why: "" },
]);

export const isTestAccount = (db, userId) => safe(() => db.prepare(`SELECT test_account FROM users WHERE id = ?`).pluck().get(userId) === 1, false);

/** What a résumé tells us beyond A33's prefill. Values only where the résumé states them. */
export function resumeExtras(db, userId, text) {
  const out = {};
  const cur = safe(() => db.prepare(`SELECT company, title FROM profile_experience WHERE user_id = ? AND is_current = 1 ORDER BY position, id LIMIT 1`).get(userId), null);
  if (cur?.title) out.current_job_title = String(cur.title).trim();
  if (cur?.company) out.current_company = String(cur.company).trim();
  const years = safe(() => yearsOfWork(text), null);
  if (Number.isFinite(years) && years > 0) out.years_of_experience = String(years);
  const state = safe(() => db.prepare(`SELECT state FROM user_profile WHERE user_id = ?`).pluck().get(userId), null);
  if (state && US_STATES.has(String(state).toUpperCase())) out.country = "United States";
  const portfolio = String(text || "").match(/https?:\/\/[^\s)]*(?:portfolio|behance\.net|dribbble\.com)[^\s)]*/i)
    || String(text || "").match(/\b(?:www\.)?(?:behance\.net|dribbble\.com)\/[^\s)]+/i);
  if (portfolio) out.portfolio_url = portfolio[0].startsWith("http") ? portfolio[0] : `https://${portfolio[0]}`;
  return out;
}

const filledList = (db, userId) => safe(() => JSON.parse(db.prepare(`SELECT resume_filled_json FROM user_profile WHERE user_id = ?`).pluck().get(userId) || "[]"), []);
/** Add fields to the "from your résumé" list. */
export function recordFilled(db, userId, fields) {
  if (!fields?.length) return filledList(db, userId);
  const next = [...new Set([...filledList(db, userId), ...fields])];
  db.prepare(`UPDATE user_profile SET resume_filled_json = ? WHERE user_id = ?`).run(JSON.stringify(next), userId);
  return next;
}
/** The person saved these fields themselves — they are theirs now, not the résumé's. */
export function clearFilled(db, userId, fields) {
  const drop = new Set(fields || []);
  const next = filledList(db, userId).filter(f => !drop.has(f));
  safe(() => db.prepare(`UPDATE user_profile SET resume_filled_json = ? WHERE user_id = ?`).run(JSON.stringify(next), userId), null);
  return next;
}
export const resumeFilledFields = filledList;

/** Write the extras under A140's rule (empty, or still the old résumé's value) and record them. → fields written. */
export function fillExtras(db, userId, text, { oldText = null } = {}) {
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  const row = db.prepare("SELECT * FROM user_profile WHERE user_id = ?").get(userId) || {};
  const old = lower(oldText || "");
  const extras = resumeExtras(db, userId, text);
  const written = [];
  for (const f of EXTRA_FIELDS) {
    const v = extras[f];
    if (!v || !(f in row)) continue;
    const cur = row[f] == null ? "" : String(row[f]).trim();
    const fromOld = cur && old && old.includes(lower(cur));
    const wasOurs = cur && filledList(db, userId).includes(f);
    if (cur && !fromOld && !wasOurs) continue;     // typed by the person — kept
    if (cur === String(v)) continue;
    db.prepare(`UPDATE user_profile SET ${f} = ? WHERE user_id = ?`).run(String(v), userId);
    written.push(f);
  }
  recordFilled(db, userId, written);
  return written;
}

/** "Frontend software engineering · mid" · "FP&A and corporate finance · senior". Pure. */
export function profileNameFromPlacement(p) {
  if (!p || p.asks || !p.categoryName) return null;
  const sub = p.subName && !/general/i.test(p.subName) ? p.subName : null;
  const word = sub && sub.split(/\s+/).length <= 2 && !/\band\b/i.test(sub);
  const base = !sub ? p.categoryName : word ? `${sub} ${p.categoryName.toLowerCase()}` : sub;
  return p.level ? `${base} · ${p.level}` : base;
}

/**
 * Name the job profile from its placement — when it still carries an automatic name (the onboarding's registry label,
 * "My job profile", or the previous placement's own name) — and add the subcategory's title aliases to its titles.
 * A name the person typed is never changed. → { name, titlesAdded }
 */
export function nameAndTitlesFromPlacement(db, profileId, { userId, previousName = null, autoNames = [] } = {}) {
  const prof = db.prepare(`SELECT profile_name, target_titles, user_id FROM domain_profiles WHERE id = ?`).get(profileId);
  if (!prof) return { name: null, titlesAdded: 0 };
  const p = storedPlacement(db, userId ?? prof.user_id);
  const name = profileNameFromPlacement(p);
  const auto = new Set(["My job profile", "General", ...autoNames, previousName].filter(Boolean));
  if (name && (auto.has(prof.profile_name) || !prof.profile_name)) db.prepare(`UPDATE domain_profiles SET profile_name = ? WHERE id = ?`).run(name, profileId);
  let added = 0;
  const sub = p && !p.asks ? safe(() => taxonomy().byId.get(p.category)?.subs?.find(s => s.id === p.subcategory), null) : null;
  if (sub?.aliases?.length) {
    const titles = safe(() => JSON.parse(prof.target_titles || "[]"), []);
    const have = new Set(titles.map(lower));
    const titleCase = (s) => s.replace(/\b[a-z]/g, c => c.toUpperCase());
    for (const a of sub.aliases.slice(0, 6)) { if (!have.has(lower(a)) && titles.length < 14) { titles.push(titleCase(a)); have.add(lower(a)); added++; } }
    if (added) db.prepare(`UPDATE domain_profiles SET target_titles = ? WHERE id = ?`).run(JSON.stringify(titles), profileId);
  }
  return { name: name && (auto.has(prof.profile_name) || !prof.profile_name) ? name : prof.profile_name, titlesAdded: added };
}

// ── D186-2 · the four things a résumé can't tell us ──────────────────────────────────────────────────────────────
const skipped = (db, userId) => safe(() => JSON.parse(db.prepare(`SELECT four_things_skipped_json FROM user_profile WHERE user_id = ?`).pluck().get(userId) || "[]"), []);
/** { items: [{ key, label, why, set, skipped }], open } — open = any not set and not skipped. */
export function fourThings(db, userId) {
  const row = safe(() => db.prepare(`SELECT * FROM user_profile WHERE user_id = ?`).get(userId), null) || {};
  const sk = new Set(skipped(db, userId));
  const items = FOUR_THINGS.map(t => ({ ...t, set: row[t.key] != null && String(row[t.key]).trim() !== "", skipped: sk.has(t.key), value: row[t.key] ?? null }));
  return { items, open: items.some(i => !i.set && !i.skipped) };
}
/** Answer one ({ key, value }) or skip it ({ key, skip: true }). The person's own words — saved as given. */
export function setFourThing(db, userId, { key, value = null, skip = false } = {}) {
  if (!FOUR_THINGS.some(t => t.key === key)) throw Object.assign(new Error("Not one of the four."), { status: 400, code: "bad_key" });
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  if (skip) {
    const next = [...new Set([...skipped(db, userId), key])];
    db.prepare(`UPDATE user_profile SET four_things_skipped_json = ? WHERE user_id = ?`).run(JSON.stringify(next), userId);
  } else {
    const v = key === "willing_to_relocate" ? (value === true || value === "yes" || value === 1 || value === "1" ? 1 : 0) : String(value ?? "").trim().slice(0, 120);
    if (v === "") throw Object.assign(new Error("Type an answer, or skip it."), { status: 400, code: "empty" });
    db.prepare(`UPDATE user_profile SET ${key} = ? WHERE user_id = ?`).run(v, userId);
    clearFilled(db, userId, [key]);
  }
  return fourThings(db, userId);
}

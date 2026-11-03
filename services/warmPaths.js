// services/warmPaths.js — ⭐ D138 · WARM PATHS (owner 11-02): who can refer you at this company, from data the user owns.
//
// Warm-intro finding sits at the top of the funnel, before a résumé is written. ⛔ Sources, ALL owned or opted in — no
// scraping (D78 stands):
//   (1) the user's own LinkedIn connections export — the CSV LinkedIn lets every member download (First Name, Last Name,
//       URL, Email Address, Company, Position, Connected On) — uploaded by the user;
//   (2) alumni — a list the user adds (a school's public alumni list, a club roster: name, company, title), tagged with
//       the school;
//   (3) past colleagues — said only as a FACT the data supports: a connection made while the user worked at an employer
//       on their own Profile ("connected while you were at Walmart"), never guessed beyond it;
//   (4) later: draft's own opt-in referral network — not built.
// On a posting: "2 people you know work at Snowflake: a LinkedIn connection (connected while you were at Walmart) and a
// Northeastern alum" → a short note DRAFTED FROM THESE FACTS for the user to edit — ⛔ draft never sends it, never
// contacts anyone, never shows one user's contacts to another. The contacts are private to the user and deletable
// (DELETE /api/warm-paths), and they cascade with the account.
// ⛔ D17: no model. The note is a template filled with facts — the user's own words go in before it leaves.

import { parseCsv } from "../shared/applicationCsv.js";
import { companyNameKey } from "../shared/companyIdentity.js";

export const WARM = Object.freeze({ MAX_ROWS: 30000, SHOWN: 5 });
export const SOURCES = Object.freeze(["linkedin", "alumni"]);
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const clip = (v, n = 200) => { const s = String(v ?? "").trim(); return s ? s.slice(0, n) : null; };
const bad = (message, code = "bad_import") => Object.assign(new Error(message), { status: 400, code });

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** LinkedIn writes "05 Mar 2024"; some exports "2024-03-05" or "3/5/2024". → epoch seconds, or null. */
export function connectedOnEpoch(v) {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()] != null) return Math.floor(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) / 1000);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return Math.floor(Date.UTC(+m[3], +m[1] - 1, +m[2]) / 1000);
  return null;
}

const col = (header, ...names) => header.findIndex(h => names.includes(h.trim().toLowerCase()));

/** The LinkedIn connections export → rows. The file opens with a few "Notes:" lines; the header is found, not assumed. */
export function parseLinkedInConnections(text) {
  const rows = parseCsv(text);
  const h = rows.findIndex(r => r.some(c => c.trim().toLowerCase() === "first name") && r.some(c => c.trim().toLowerCase() === "company"));
  if (h < 0) throw bad("That doesn't look like LinkedIn's Connections.csv — it needs First Name, Last Name and Company columns.", "not_linkedin_export");
  const head = rows[h];
  const i = { first: col(head, "first name"), last: col(head, "last name"), url: col(head, "url", "profile url"), email: col(head, "email address", "email"),
    company: col(head, "company"), position: col(head, "position", "title"), on: col(head, "connected on") };
  return rows.slice(h + 1).map(r => ({
    name: [clip(r[i.first], 80), clip(r[i.last], 80)].filter(Boolean).join(" "),
    company: clip(r[i.company]), position: clip(r[i.position]), url: i.url >= 0 ? clip(r[i.url], 300) : null,
    email: i.email >= 0 ? clip(r[i.email], 200) : null, connectedOn: i.on >= 0 ? connectedOnEpoch(r[i.on]) : null,
  })).filter(r => r.name && r.company);
}

/** An alumni list (name, company, title, link) the user adds → rows. Header names are matched loosely. */
export function parseAlumniList(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw bad("The list is empty.");
  const head = rows[0];
  const i = { name: col(head, "name", "full name"), first: col(head, "first name"), last: col(head, "last name"),
    company: col(head, "company", "employer", "organization", "organisation"), position: col(head, "title", "position", "role"),
    url: col(head, "url", "linkedin", "profile", "profile url") };
  if (i.company < 0 || (i.name < 0 && i.first < 0)) throw bad("The alumni list needs a Name (or First / Last Name) and a Company column.", "not_alumni_list");
  return rows.slice(1).map(r => ({
    name: i.name >= 0 ? clip(r[i.name], 160) : [clip(r[i.first], 80), clip(r[i.last], 80)].filter(Boolean).join(" "),
    company: clip(r[i.company]), position: i.position >= 0 ? clip(r[i.position]) : null, url: i.url >= 0 ? clip(r[i.url], 300) : null,
    email: null, connectedOn: null,
  })).filter(r => r.name && r.company);
}

/**
 * Import one source; a re-upload REPLACES that source's rows (alumni: that school's). The user's own file only.
 * @returns {{ source, school, imported, companies }}
 */
export function importContacts(db, userId, { source, text, school = null }) {
  if (!SOURCES.includes(source)) throw bad("Import LinkedIn's Connections.csv, or an alumni list.", "bad_source");
  const schoolName = source === "alumni" ? clip(school, 120) : null;
  if (source === "alumni" && !schoolName) throw bad("Which school is the alumni list for?", "school_required");
  const rows = source === "linkedin" ? parseLinkedInConnections(text) : parseAlumniList(text);
  if (rows.length > WARM.MAX_ROWS) throw bad(`That file has ${rows.length} people; up to ${WARM.MAX_ROWS} are read.`, "too_many_rows");
  const ins = db.prepare(`INSERT INTO warm_contacts (user_id, source, school, name, company, company_key, position, url, email, connected_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    db.prepare(`DELETE FROM warm_contacts WHERE user_id = ? AND source = ? AND school IS ?`).run(userId, source, schoolName);
    for (const r of rows) ins.run(userId, source, schoolName, r.name, r.company, companyNameKey(r.company), r.position, r.url, r.email, r.connectedOn);
  })();
  return { source, school: schoolName, imported: rows.length, companies: new Set(rows.map(r => companyNameKey(r.company))).size };
}

/** What the user has imported — counts only. */
export function warmSummary(db, userId) {
  const parts = safe(() => db.prepare(`SELECT source, school, COUNT(*) AS people, COUNT(DISTINCT company_key) AS companies, MAX(imported_at) AS at
      FROM warm_contacts WHERE user_id = ? GROUP BY source, school ORDER BY source, school`).all(userId), []);
  return { sources: parts, people: parts.reduce((a, p) => a + p.people, 0) };
}

/** Deletes the user's contacts — every source, or one (and for alumni, one school). @returns the rows deleted */
export function deleteContacts(db, userId, { source = null, school = null } = {}) {
  if (source && !SOURCES.includes(source)) throw bad("Unknown source.", "bad_source");
  if (!source) return db.prepare(`DELETE FROM warm_contacts WHERE user_id = ?`).run(userId).changes;
  if (school != null) return db.prepare(`DELETE FROM warm_contacts WHERE user_id = ? AND source = ? AND school = ?`).run(userId, source, school).changes;
  return db.prepare(`DELETE FROM warm_contacts WHERE user_id = ? AND source = ?`).run(userId, source).changes;
}

const ym = (s) => { const m = String(s ?? "").match(/^(\d{4})-(\d{2})/); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, 1) / 1000) : null; };

/** The user's own employers with their dates (Profile → Experience), for "connected while you were at …". */
function tenures(db, userId) {
  return safe(() => db.prepare(`SELECT company, start_ym, end_ym, is_current FROM profile_experience WHERE user_id = ?`).all(userId), [])
    .map(e => ({ company: e.company, from: ym(e.start_ym), to: e.is_current ? Infinity : (ym(e.end_ym) ?? null) }))
    .filter(t => t.from != null && t.to != null);
}

/** How the user knows one contact — only what the data says. */
export function howYouKnow(c, jobs = []) {
  if (c.source === "alumni") return `${c.school} alum`;
  const at = c.connected_on != null ? jobs.find(t => c.connected_on >= t.from && c.connected_on <= t.to + 31 * 86400) : null;
  return at ? `a LinkedIn connection (connected while you were at ${at.company})` : "a LinkedIn connection";
}

/**
 * The warm path to one company. @returns {{ count, people: [{ name, position, how, url, email, source }], line } | null}
 */
export function warmPathTo(db, userId, company) {
  const key = companyNameKey(company || "");
  if (!key) return null;
  const rows = safe(() => db.prepare(`SELECT * FROM warm_contacts WHERE user_id = ? AND company_key = ? ORDER BY source DESC, name LIMIT 50`).all(userId, key), []);
  if (!rows.length) return null;
  const jobs = tenures(db, userId);
  const seen = new Set();
  const people = rows.filter(r => !seen.has(r.name.toLowerCase()) && seen.add(r.name.toLowerCase()))
    .map(r => ({ name: r.name, position: r.position, how: howYouKnow(r, jobs), url: r.url, email: r.email, source: r.source }));
  const hows = [...new Set(people.slice(0, 2).map(p => p.how))];
  const n = people.length;
  return { count: n, people: people.slice(0, WARM.SHOWN),
    line: `${n} ${n === 1 ? "person" : "people"} you know work${n === 1 ? "s" : ""} at ${company}: ${hows.join(" and ")}${n > 2 ? " …" : ""}` };
}

/** D136's warm-path signal for many postings at once: company_key → count. */
export function warmCounts(db, userId) {
  return new Map(safe(() => db.prepare(`SELECT company_key, COUNT(DISTINCT name) AS n FROM warm_contacts WHERE user_id = ? GROUP BY company_key`).all(userId), [])
    .map(r => [r.company_key, r.n]));
}

/**
 * A short note DRAFTED FROM FACTS, for the user to edit. ⛔ Never sent by draft: the page copies it, or opens the
 * person's LinkedIn profile / an email the user sends themselves.
 */
export function draftNote({ person, job, userName = null }) {
  const first = String(person?.name ?? "").split(/\s+/)[0] || "there";
  const how = person?.source === "alumni" ? `We're both ${person.how.replace(/ alum$/, "")} alumni` : null;
  const lines = [
    `Hi ${first},`,
    "",
    `I'm applying for the ${job.title} role at ${job.company}${job.url ? ` (${job.url})` : ""}.${how ? ` ${how}, so I thought I'd reach out.` : ""}`,
    `[One line, in your words: why this role, and what you've done that fits.]`,
    `Would you be open to a quick chat about the team — or, if it seems a fit, to referring me?`,
    "",
    `Thanks${userName ? `,\n${userName}` : ","}`,
  ];
  return lines.join("\n");
}

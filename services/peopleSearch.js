// services/peopleSearch.js — ⭐ 45n (owner 11-08: "this should search users too, users profiles should be searchable when
// public and should be pairable with labels like their work place and education to identify distinction between same
// names") · PEOPLE IN THE ONE SEARCH.
//
// A person is found ONLY while their page is PUBLIC (D183's "Who can see your profile" = Public) and has a handle.
// `people_index` (migration 250) holds only what their PUBLIC page already shows — read through the page's own public
// filter (profilePage → viewFor(…, "public")), so a section they narrowed never leaks into a search label:
//   name · headline · workplace (their latest experience's company, when Experience is public) · school (their latest
//   education, when Education is public) · handle.
// Refreshed whenever the person changes anything under /api/profile (routes/profileSections.js) and once a night for
// changes made elsewhere; a page that stops being public is dropped from the index at once. ⛔ Contact details, the
// level, readiness and everything under "Behind your profile" are never in it.
import { profilePage, viewFor } from "./profilePage.js";

const safe = (fn, d) => { try { return fn(); } catch { return d; } };
export const nameKey = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** PURE. The index row from a page's PUBLIC view, or null when the person is not findable. */
export function personRow(view) {
  if (!view || view.private || !view.header?.name || !view.header?.handle) return null;
  const exp = view.sections?.experience?.items || [];
  const edu = view.sections?.education?.items || [];
  const current = exp.find(x => x.current) || exp[0] || null;
  return {
    name: view.header.name, name_key: nameKey(view.header.name), headline: view.header.headline || null,
    workplace: current?.company || null,
    school: edu[0]?.school || edu[0]?.institution || null,
    handle: view.header.handle,
  };
}

/** Re-index one person (or drop them). Never throws into the caller's request. */
export function refreshPerson(db, userId) {
  try {
    const row = personRow(viewFor(profilePage(db, userId), "public"));
    if (!row) { db.prepare(`DELETE FROM people_index WHERE user_id = ?`).run(userId); return false; }
    db.prepare(`INSERT INTO people_index (user_id, name, name_key, headline, workplace, school, handle, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key, headline = excluded.headline,
        workplace = excluded.workplace, school = excluded.school, handle = excluded.handle, updated_at = excluded.updated_at`)
      .run(userId, row.name, row.name_key, row.headline, row.workplace, row.school, row.handle);
    return true;
  } catch (e) { console.warn(`[people] refresh ${userId}: ${e.message}`); return false; }
}

/** Every public page re-read (nightly; there are few), and anyone no longer public dropped. */
export function refreshAllPeople(db) {
  const pub = safe(() => db.prepare(`SELECT user_id FROM profile_page WHERE page_level = 'public'`).pluck().all(), []);
  let kept = 0;
  for (const id of pub) if (refreshPerson(db, id)) kept++;
  const dropped = safe(() => db.prepare(`DELETE FROM people_index WHERE user_id NOT IN (SELECT user_id FROM profile_page WHERE page_level = 'public')`).run().changes, 0);
  return { kept, dropped };
}

/** People whose name (any word of it) starts with the query: [{ name, headline, workplace, school, label, path }]. */
export function searchPeople(db, q, { limit = 5 } = {}) {
  const k = nameKey(q);
  if (k.length < 2) return [];
  const like = k.replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = safe(() => db.prepare(`SELECT name, headline, workplace, school, handle FROM people_index
      WHERE name_key LIKE ? ESCAPE '\\' OR name_key LIKE ? ESCAPE '\\'
      ORDER BY (name_key LIKE ? ESCAPE '\\') DESC, name LIMIT ?`).all(`${like}%`, `% ${like}%`, `${like}%`, limit), []);
  return rows.map(r => ({ name: r.name, headline: r.headline, workplace: r.workplace, school: r.school,
    // the line that tells two people of one name apart: where they work · where they studied (what their page shows)
    label: [r.workplace, r.school].filter(Boolean).join(" · ") || r.headline || null,
    path: `/in/${encodeURIComponent(r.handle)}` }));
}

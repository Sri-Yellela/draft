// ⭐ D125 · THE OWNER CALIBRATES THE ATS BY HAND (owner 11-01: "add a manual enrichment task for me to compare and
// calibrate the ats module against here including scores and ats words detection"). D123 P6b's hand-checked list, as
// a tool: Admin → ATS calibration.
//
// P1 · THE SET — a fixed, versioned set of real postings (20 computing + 20 other fields by default, entry → senior,
//      round-robin over the level read), each FROZEN at the moment the set is made: the posting's text, which of its
//      sentences the board counts (the company's boilerplate shown faded), and draft's reading of it (skills split
//      must / nice, action verbs, competencies, the level). Paired with the trial's samples, the owner's own résumé
//      (copied from his user account by username or email — an admin account has no résumé, D95) and any he pastes. A later scorer change is
//      measured on the SAME pairs.
// P2 · THE REVIEW — per posting: each detected term right / wrong, the terms draft missed, a term moved must ↔ nice, the
//      same for verbs, and per résumé "the score feels too low · right · too high" and, optionally, his own 0–100.
//      Saved as he goes. The optional assist (a Claude chat HE runs — draft calls no model, D17) lands as SUGGESTIONS
//      he accepts or rejects, never as gold by itself.
// P3 · RESULTS — term and verb precision / recall, must / nice accuracy, Spearman ρ between draft's score and his, the
//      bias per band, the 10 worst pairs, and the fixes they point to (one press each to queue for the agent).
// P4 · IT NEVER GETS WORSE — a baseline is recorded from the results; `scripts/d125GoldGate.mjs` re-measures the
//      CURRENT scorer on the gold set and fails when precision, recall or ρ falls below it.
//
// Everything is measured against the CURRENT scorer (`score(job, resumeText)` passed in by the caller — the board's
// weights and confirmed synonyms), so a change to the scorer shows up here on the next open.
import { samples } from "./trial.js";
import { atsBandFor } from "../shared/atsBands.js";
import { ACTIVE_POSTINGS_WHERE, countedSentences, companyBoilerplate } from "./atlas/postingMatcher.js";

export const DEFAULT_SET = Object.freeze({ computing: 20, other: 20 });
export const FEELS = Object.freeze(["too_low", "right", "too_high"]);
export const MARKS = Object.freeze(["right", "wrong"]);
export const KINDS = Object.freeze(["skills", "verbs", "competencies"]);
export const TIERS = Object.freeze(["must", "nice"]);
export const FIX_KINDS = Object.freeze(["synonym", "boilerplate", "verb", "band"]);
const LEVEL_ORDER = ["intern", "entry", "early", "mid", "senior", "staff", "lead", "principal"];

const now = () => Math.floor(Date.now() / 1000);
const json = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const key = (t) => String(t || "").trim().toLowerCase();
const uniq = (a) => [...new Map(a.filter(Boolean).map(t => [key(t), t])).values()];

// ── draft's reading of a posting ────────────────────────────────────────────────────────────────

/** Where the posting's "nice to have" part begins (its heading), or -1. */
const NICE_HEAD = /^\s*(?:#+\s*)?(?:preferred|nice[- ]to[- ]have|bonus|pluses|a plus|it'?s a plus|desired|preferred qualifications|additional qualifications|good to have)\b[^\n]{0,60}$/im;
const NEXT_HEAD = /^\s*(?:#+\s*)?(?:about|benefits|what we offer|compensation|pay|salary|perks|why join|equal opportunity|responsibilities|what you'?ll do|requirements|qualifications|minimum qualifications|basic qualifications|required)\b[^\n]{0,60}$/im;
export function niceSection(text) {
  const t = String(text || "");
  const m = NICE_HEAD.exec(t);
  if (!m) return "";
  const rest = t.slice(m.index + m[0].length);
  const end = NEXT_HEAD.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = (text, term) => new RegExp(`(?<![\\w+#.])${esc(term)}(?![\\w+#])`, "i").test(text);

/**
 * draft's reading of one posting: the union of what the scorer found across the pairs' résumés (its matched and
 * missing buckets are the posting's terms), skills split must / nice by where the posting names them.
 */
export function readingOf(job, reports) {
  const all = (f) => uniq(reports.flatMap(r => [...(r?.[`${f}_matched`] || []), ...(r?.[`${f}_missing`] || [])]));
  const skills = uniq(reports.flatMap(r => [...(r?.tier1_matched || []), ...(r?.tier1_missing || [])]));
  const verbs = uniq([...all("action_verbs"), ...reports.flatMap(r => r?.action_verbs_generic || [])]);
  const competencies = all("competencies");
  const text = String(job.text || "");
  const nice = niceSection(text);
  const outside = nice ? text.replace(nice, "") : text;
  const tier = (t) => (nice && names(nice, t) && !names(outside, t) ? "nice" : "must");
  return {
    skills: skills.map(t => ({ term: t, tier: tier(t) })),
    verbs, competencies, level: job.level || null,
  };
}

// ── P1 · the set ────────────────────────────────────────────────────────────────────────────────

/** The trial's samples, copied into the set's résumés once. */
export function ensureResumes(db) {
  const have = new Set(db.prepare("SELECT source FROM ats_gold_resumes").pluck().all());
  const add = db.prepare("INSERT INTO ats_gold_resumes (label, source, resume_text) VALUES (?, ?, ?)");
  for (const s of Object.values(samples())) if (!have.has(`sample:${s.id}`)) add.run(`Sample ${s.id} · ${s.label}`, `sample:${s.id}`, s.resumeText);
  return listResumes(db);
}

/**
 * The owner's own résumé: copied from a USER account (his username or email) — its active profile's base résumé. An
 * admin account has no résumé of its own (D95), so he names the account. Copied once; a later copy refreshes it.
 */
export function copyAccountResume(db, who) {
  const w = String(who || "").trim();
  const user = w ? db.prepare(`SELECT u.id, u.username FROM users u LEFT JOIN user_profile p ON p.user_id = u.id
    WHERE u.username = ? COLLATE NOCASE OR p.email = ? COLLATE NOCASE LIMIT 1`).get(w, w) : null;
  if (!user) throw Object.assign(new Error("No account by that username or email."), { status: 404, code: "no_account" });
  const text = db.prepare(`SELECT pbr.content FROM profile_base_resumes pbr JOIN domain_profiles dp ON dp.id = pbr.profile_id
    WHERE pbr.user_id = ? AND dp.is_active = 1 AND pbr.content IS NOT NULL ORDER BY pbr.updated_at DESC LIMIT 1`).pluck().get(user.id);
  if (!text) throw Object.assign(new Error("That account has no résumé on its active profile."), { status: 404, code: "no_resume" });
  const source = `account:${user.id}`;
  const had = db.prepare("SELECT id FROM ats_gold_resumes WHERE source = ?").get(source);
  if (had) db.prepare("UPDATE ats_gold_resumes SET resume_text = ? WHERE id = ?").run(text, had.id);
  else db.prepare("INSERT INTO ats_gold_resumes (label, source, resume_text) VALUES (?, ?, ?)").run(`Your résumé (${user.username})`, source, text);
  return listResumes(db);
}
export const listResumes = (db) => db.prepare("SELECT id, label, source, created_at FROM ats_gold_resumes ORDER BY id").all();

/** A résumé the owner uploads for the set (its text). */
export function addResume(db, { label, text }) {
  const t = String(text || "").trim();
  if (t.length < 200) throw Object.assign(new Error("Paste the whole résumé (at least 200 characters)."), { status: 400, code: "too_short" });
  const r = db.prepare("INSERT INTO ats_gold_resumes (label, source, resume_text) VALUES (?, 'upload', ?)").run(String(label || "Uploaded résumé").slice(0, 80), t);
  return { id: Number(r.lastInsertRowid) };
}

/** Postings for the set: active, in a shown category, with text; round-robin over the level read so entry → senior is covered. */
export function pickPostings(db, { computing = DEFAULT_SET.computing, other = DEFAULT_SET.other, minChars = 600 } = {}) {
  const rows = db.prepare(`SELECT job_id, title, company, COALESCE(description_text, description) AS text, board_category, discipline, level_read
    FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE} AND COALESCE(board_category, '') NOT IN ('', 'held')
      AND LENGTH(COALESCE(description_text, description, '')) >= ? ORDER BY job_id`).all(minChars);
  const take = (list, n) => {
    const byLevel = new Map();
    for (const r of list) { const l = r.level_read || "unknown"; if (!byLevel.has(l)) byLevel.set(l, []); byLevel.get(l).push(r); }
    const levels = [...byLevel.keys()].sort((a, b) => (LEVEL_ORDER.indexOf(a) + 99) % 99 - (LEVEL_ORDER.indexOf(b) + 99) % 99);
    const out = [], seen = new Set();
    while (out.length < n && levels.some(l => byLevel.get(l).length)) {
      for (const l of levels) {
        const q = byLevel.get(l);
        if (!q.length || out.length >= n) continue;
        // a company not yet in the set first, so one employer never fills it
        const at = Math.max(0, q.findIndex(r => !seen.has(key(r.company))));
        const [r] = q.splice(at, 1);
        out.push(r); seen.add(key(r.company));
      }
    }
    return out;
  };
  return [...take(rows.filter(r => r.board_category === "computing"), computing), ...take(rows.filter(r => r.board_category !== "computing"), other)];
}

/**
 * Make (or return) a set version: the picked postings, frozen with their text, the sentences the board counts, and
 * draft's reading. Idempotent per version — a set is never re-picked under the same number.
 */
export function buildSet(db, { score, computing, other } = {}) {
  ensureResumes(db);
  const version = (db.prepare("SELECT MAX(version) FROM ats_gold_items").pluck().get() || 0) + 1;
  const resumes = db.prepare("SELECT id, resume_text FROM ats_gold_resumes").all();
  const ins = db.prepare(`INSERT INTO ats_gold_items (version, job_id, category, discipline, level, title, company, posting_text, counted_json, reading_json)
    VALUES (@version, @job_id, @category, @discipline, @level, @title, @company, @text, @counted, @reading)`);
  const picked = pickPostings(db, { computing, other });
  db.transaction(() => {
    for (const p of picked) {
      let counted = [];
      try { counted = countedSentences(p.text, companyBoilerplate(db, p.company)); } catch { counted = []; }
      const job = { title: p.title, company: p.company, description: p.text, text: p.text, level: p.level_read };
      const reports = resumes.map(r => { try { return score(job, r.resume_text); } catch { return null; } }).filter(Boolean);
      ins.run({ version, job_id: p.job_id, category: p.board_category, discipline: p.discipline, level: p.level_read, title: p.title,
        company: p.company, text: p.text, counted: JSON.stringify(counted), reading: JSON.stringify(readingOf(job, reports)) });
    }
  })();
  return { version, items: picked.length };
}

export const latestVersion = (db) => db.prepare("SELECT MAX(version) FROM ats_gold_items").pluck().get() || null;

// ── P2 · the review ─────────────────────────────────────────────────────────────────────────────

const EMPTY_REVIEW = () => ({ marks: { skills: {}, verbs: {}, competencies: {} }, added: { skills: [], verbs: [] }, tiers: {}, scores: {}, suggestions: null, done: false });

export function readReview(db, itemId) {
  const r = db.prepare("SELECT * FROM ats_gold_reviews WHERE item_id = ?").get(itemId);
  if (!r) return EMPTY_REVIEW();
  return { marks: { ...EMPTY_REVIEW().marks, ...json(r.marks_json, {}) }, added: { ...EMPTY_REVIEW().added, ...json(r.added_json, {}) },
    tiers: json(r.tiers_json, {}), scores: json(r.scores_json, {}), suggestions: json(r.suggestions_json, null), done: !!r.done, updatedAt: r.updated_at };
}

/** Clean what the screen sends: only known kinds, marks, tiers and feels; terms trimmed; own scores 0–100. */
export function cleanReview(input = {}) {
  const out = EMPTY_REVIEW();
  for (const k of KINDS) for (const [t, m] of Object.entries(input.marks?.[k] || {})) if (MARKS.includes(m) && key(t)) out.marks[k][String(t).trim().slice(0, 80)] = m;
  for (const k of ["skills", "verbs"]) out.added[k] = uniq((input.added?.[k] || []).map(t => String(t).trim().slice(0, 80))).slice(0, 60);
  for (const [t, v] of Object.entries(input.tiers || {})) if (TIERS.includes(v) && key(t)) out.tiers[String(t).trim().slice(0, 80)] = v;
  for (const [id, s] of Object.entries(input.scores || {})) {
    if (!/^\d+$/.test(id)) continue;
    const own = s?.own === "" || s?.own == null ? null : Math.round(Number(s.own));
    out.scores[id] = { feel: FEELS.includes(s?.feel) ? s.feel : null, own: Number.isFinite(own) && own >= 0 && own <= 100 ? own : null };
  }
  out.done = !!input.done;
  return out;
}

export function saveReview(db, itemId, input, { userId = null } = {}) {
  if (!db.prepare("SELECT 1 FROM ats_gold_items WHERE id = ?").get(itemId)) throw Object.assign(new Error("No such posting in the set."), { status: 404, code: "not_found" });
  const r = cleanReview(input);
  const keep = readReview(db, itemId).suggestions;
  db.prepare(`INSERT INTO ats_gold_reviews (item_id, marks_json, added_json, tiers_json, scores_json, suggestions_json, done, reviewed_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET marks_json = excluded.marks_json, added_json = excluded.added_json,
    tiers_json = excluded.tiers_json, scores_json = excluded.scores_json, done = excluded.done, reviewed_by = excluded.reviewed_by,
    updated_at = excluded.updated_at`)
    .run(itemId, JSON.stringify(r.marks), JSON.stringify(r.added), JSON.stringify(r.tiers), JSON.stringify(r.scores),
      keep ? JSON.stringify(keep) : null, r.done ? 1 : 0, userId, now());
  return readReview(db, itemId);
}

/** One posting for the screen: the frozen posting and reading, and per résumé the CURRENT score, band and breakdown. */
export function itemView(db, itemId, { score }) {
  const it = db.prepare("SELECT * FROM ats_gold_items WHERE id = ?").get(itemId);
  if (!it) return null;
  const job = { title: it.title, company: it.company, description: it.posting_text };
  const pairs = db.prepare("SELECT id, label, resume_text FROM ats_gold_resumes ORDER BY id").all().map(r => {
    let rep = null; try { rep = score(job, r.resume_text); } catch { /* unscorable */ }
    return { resumeId: r.id, label: r.label, score: rep?.score ?? null, band: atsBandFor(rep), declined: rep?.decline_reasons || [],
      matched: rep?.tier1_matched || [], missing: rep?.tier1_missing || [] };
  });
  const order = db.prepare("SELECT id FROM ats_gold_items WHERE version = ? ORDER BY id").pluck().all(it.version);
  return { id: it.id, version: it.version, jobId: it.job_id, title: it.title, company: it.company, category: it.category,
    discipline: it.discipline, level: it.level, text: it.posting_text, counted: json(it.counted_json, []),
    reading: json(it.reading_json, {}), pairs, review: readReview(db, it.id),
    position: order.indexOf(it.id) + 1, of: order.length, prev: order[order.indexOf(it.id) - 1] ?? null, next: order[order.indexOf(it.id) + 1] ?? null };
}

export function setOverview(db, version = latestVersion(db)) {
  if (!version) return { version: null, items: [], resumes: listResumes(db), done: 0 };
  const items = db.prepare(`SELECT i.id, i.title, i.company, i.category, i.discipline, i.level, COALESCE(r.done, 0) AS done, r.updated_at
    FROM ats_gold_items i LEFT JOIN ats_gold_reviews r ON r.item_id = i.id WHERE i.version = ? ORDER BY i.id`).all(version);
  return { version, items, resumes: listResumes(db), done: items.filter(i => i.done).length,
    versions: db.prepare("SELECT version, COUNT(*) n FROM ats_gold_items GROUP BY version ORDER BY version").all() };
}

// ── the optional assist: a batch for a Claude chat the owner runs; its answer lands as suggestions ─────────

export const ASSIST_INSTRUCTIONS =
  "You are checking an ATS's reading of job postings. For each posting below, compare the posting's text with draft's reading. " +
  "Answer ONLY with JSON: {\"items\":[{\"id\":<id>,\"wrong\":[terms draft found that are not real requirements],\"missed\":[skills the posting asks for that draft did not find]," +
  "\"verbsMissed\":[action verbs it missed],\"nice\":[found skills that are only nice-to-have]}]}. Use the posting's own words. Do not invent requirements.";

export function assistBatch(db, ids) {
  const items = db.prepare(`SELECT id, title, company, posting_text, reading_json FROM ats_gold_items WHERE id IN (${ids.map(() => "?").join(",") || "NULL"})`).all(...ids);
  return { instructions: ASSIST_INSTRUCTIONS,
    items: items.map(i => { const r = json(i.reading_json, {}); return { id: i.id, title: i.title, company: i.company, posting: i.posting_text.slice(0, 6000),
      draftFound: { skills: (r.skills || []).map(s => s.term), verbs: r.verbs || [] } }; }) };
}

/** The pasted answer: kept per posting as SUGGESTIONS (only terms, only known ids) — gold only when he accepts them. */
export function importAssist(db, answer) {
  const parsed = typeof answer === "string" ? json(answer.replace(/^```(?:json)?|```$/gm, "").trim(), null) : answer;
  const list = Array.isArray(parsed?.items) ? parsed.items : null;
  if (!list) throw Object.assign(new Error("That is not the JSON the instructions ask for ({\"items\": [...]})."), { status: 400, code: "bad_json" });
  const terms = (a) => uniq((Array.isArray(a) ? a : []).filter(t => typeof t === "string").map(t => t.trim().slice(0, 80))).slice(0, 40);
  let n = 0;
  for (const s of list) {
    const id = Number(s?.id);
    if (!Number.isInteger(id) || !db.prepare("SELECT 1 FROM ats_gold_items WHERE id = ?").get(id)) continue;
    const sug = { wrong: terms(s.wrong), missed: terms(s.missed), verbsMissed: terms(s.verbsMissed), nice: terms(s.nice), at: now() };
    db.prepare(`INSERT INTO ats_gold_reviews (item_id, suggestions_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET suggestions_json = excluded.suggestions_json`).run(id, JSON.stringify(sug), now());
    n++;
  }
  return { items: n };
}

// ── P3 · results ────────────────────────────────────────────────────────────────────────────────

/** Spearman's ρ (average ranks for ties). null under 3 pairs. */
export function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(n);
    for (let i = 0; i < n;) { let j = i; while (j + 1 < n && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
  const rx = rank(xs), ry = rank(ys), mx = (n + 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - mx); dx += (rx[i] - mx) ** 2; dy += (ry[i] - mx) ** 2; }
  return dx && dy ? Math.round((num / Math.sqrt(dx * dy)) * 1000) / 1000 : null;
}

const pr = (tp, fp, fn) => ({ precision: tp + fp ? Math.round((tp / (tp + fp)) * 1000) / 1000 : null, recall: tp + fn ? Math.round((tp / (tp + fn)) * 1000) / 1000 : null, tp, fp, fn });

/**
 * The results over the REVIEWED postings (done), measured on the CURRENT scorer: a term the scorer finds now is a hit
 * when he marked it right or added it, a false positive when he marked it wrong (unjudged new detections are counted
 * apart, never guessed); a term he marked right or added that it no longer finds is a miss.
 */
export function results(db, { score, version = latestVersion(db) } = {}) {
  const items = version ? db.prepare(`SELECT i.*, r.marks_json, r.added_json, r.tiers_json, r.scores_json FROM ats_gold_items i
    JOIN ats_gold_reviews r ON r.item_id = i.id WHERE i.version = ? AND r.done = 1 ORDER BY i.id`).all(version) : [];
  const resumes = db.prepare("SELECT id, label, resume_text FROM ats_gold_resumes").all();
  const acc = { skills: [0, 0, 0], verbs: [0, 0, 0] }, byDiscipline = {}, unjudged = { skills: 0, verbs: 0 };
  let tierRight = 0, tierAll = 0;
  const xs = [], ys = [], pairs = [], feels = {};
  const missedTerms = new Map(), wrongTerms = new Map(), missedVerbs = new Map();
  for (const it of items) {
    const marks = json(it.marks_json, {}), added = json(it.added_json, {}), tiers = json(it.tiers_json, {}), scores = json(it.scores_json, {});
    const job = { title: it.title, company: it.company, description: it.posting_text, text: it.posting_text, level: it.level };
    const reports = resumes.map(r => { try { return [r, score(job, r.resume_text)]; } catch { return [r, null]; } });
    const now_ = readingOf(job, reports.map(x => x[1]).filter(Boolean));
    const frozen = json(it.reading_json, {});
    const disc = it.discipline || it.category || "other";
    byDiscipline[disc] ||= [0, 0, 0];
    for (const [kind, found] of [["skills", now_.skills.map(s => s.term)], ["verbs", now_.verbs]]) {
      const m = marks[kind] || {};
      const gold = new Set([...Object.entries(m).filter(([, v]) => v === "right").map(([t]) => key(t)), ...(added[kind] || []).map(key)]);
      const wrong = new Set(Object.entries(m).filter(([, v]) => v === "wrong").map(([t]) => key(t)));
      const f = new Set(found.map(key));
      let tp = 0, fp = 0;
      for (const t of f) { if (gold.has(t)) tp++; else if (wrong.has(t)) { fp++; if (kind === "skills") wrongTerms.set(t, (wrongTerms.get(t) || 0) + 1); } else unjudged[kind]++; }
      const missed = [...gold].filter(t => !f.has(t));
      acc[kind][0] += tp; acc[kind][1] += fp; acc[kind][2] += missed.length;
      if (kind === "skills") { const d = byDiscipline[disc]; d[0] += tp; d[1] += fp; d[2] += missed.length; }
      for (const t of missed) (kind === "skills" ? missedTerms : missedVerbs).set(t, (kind === "skills" ? missedTerms : missedVerbs).get(t) + 1 || 1);
    }
    // must / nice: draft's tier (frozen reading) against his (a move he made, else draft's stands as right)
    for (const s of frozen.skills || []) {
      if ((marks.skills || {})[s.term] !== "right") continue;
      tierAll++; if (!tiers[s.term] || tiers[s.term] === s.tier) tierRight++;
    }
    for (const [r, rep] of reports) {
      const s = scores[r.id];
      if (!s || rep?.score == null) continue;
      const band = atsBandFor(rep);
      if (s.feel) { feels[band] ||= { too_low: 0, right: 0, too_high: 0 }; feels[band][s.feel]++; }
      if (s.own != null) { xs.push(rep.score); ys.push(s.own); pairs.push({ itemId: it.id, title: it.title, company: it.company, resume: r.label, draft: rep.score, own: s.own, gap: rep.score - s.own }); }
    }
  }
  const top = (m, n = 15) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([term, count]) => ({ term, count }));
  const bias = Object.fromEntries(Object.entries(feels).map(([b, f]) => [b, { ...f, n: f.too_low + f.right + f.too_high }]));
  const fixes = [
    ...top(missedTerms).map(t => ({ kind: "synonym", term: t.term, count: t.count, why: `missed on ${t.count} posting${t.count > 1 ? "s" : ""}: an alias in the one thesaurus (skill_synonyms / Atlas)` })),
    ...top(wrongTerms).filter(t => t.count >= 2).map(t => ({ kind: "boilerplate", term: t.term, count: t.count, why: `wrongly read as a requirement on ${t.count} postings: the boilerplate or common-phrase list` })),
    ...top(missedVerbs).map(t => ({ kind: "verb", term: t.term, count: t.count, why: `a verb missed on ${t.count} posting${t.count > 1 ? "s" : ""}: the verb list` })),
    ...Object.entries(bias).filter(([, f]) => f.n >= 5 && (f.too_low / f.n >= 0.6 || f.too_high / f.n >= 0.6))
      .map(([band, f]) => ({ kind: "band", term: band, count: f.n, why: `${band}: ${f.too_low / f.n >= 0.6 ? "too low" : "too high"} on ${Math.max(f.too_low, f.too_high)} of ${f.n} — the band cut-points` })),
  ];
  return {
    version, reviewed: items.length,
    skills: pr(...acc.skills), verbs: pr(...acc.verbs), unjudged,
    tierAccuracy: tierAll ? Math.round((tierRight / tierAll) * 1000) / 1000 : null,
    byDiscipline: Object.fromEntries(Object.entries(byDiscipline).map(([d, a]) => [d, pr(...a)])),
    rho: spearman(xs, ys), rhoPairs: xs.length, bias,
    worst: pairs.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 10),
    fixes,
  };
}

/** One press: a suggested fix queued for the agent (kept in the database; the agent reads Admin's export). */
export function queueFix(db, { kind, term, why = "" }, { userId = null } = {}) {
  if (!FIX_KINDS.includes(kind) || !key(term)) throw Object.assign(new Error("Which fix?"), { status: 400, code: "bad_fix" });
  db.prepare(`INSERT INTO ats_gold_fixes (kind, term, why, queued_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(kind, term) DO UPDATE SET why = excluded.why`).run(kind, String(term).slice(0, 80), String(why).slice(0, 300), userId);
  return db.prepare("SELECT id, kind, term, why, status, created_at FROM ats_gold_fixes ORDER BY id DESC").all();
}
export const listFixes = (db) => db.prepare("SELECT id, kind, term, why, status, created_at FROM ats_gold_fixes ORDER BY id DESC").all();

// ── P4 · the baseline, and the gate ─────────────────────────────────────────────────────────────

export const GATE_METRICS = Object.freeze(["skills.precision", "skills.recall", "verbs.precision", "verbs.recall", "rho"]);
const metricOf = (r, m) => m.split(".").reduce((o, k) => o?.[k], r);

export function recordBaseline(db, r, { userId = null } = {}) {
  db.prepare("INSERT INTO ats_gold_baselines (version, metrics_json, recorded_by) VALUES (?, ?, ?)")
    .run(r.version, JSON.stringify(Object.fromEntries(GATE_METRICS.map(m => [m, metricOf(r, m)]))), userId);
  return latestBaseline(db, r.version);
}
export function latestBaseline(db, version = latestVersion(db)) {
  const row = version ? db.prepare("SELECT metrics_json, created_at FROM ats_gold_baselines WHERE version = ? ORDER BY id DESC LIMIT 1").get(version) : null;
  return row ? { metrics: json(row.metrics_json, {}), at: row.created_at } : null;
}

/** The gate: every metric the baseline has must not fall (a 0.005 tolerance for rounding). Returns the drops. */
export function gate(current, baseline, { tolerance = 0.005 } = {}) {
  const drops = [];
  for (const m of GATE_METRICS) {
    const was = baseline?.metrics?.[m], is = metricOf(current, m);
    if (was == null) continue;
    if (is == null || is < was - tolerance) drops.push({ metric: m, was, is });
  }
  return { ok: drops.length === 0, drops };
}

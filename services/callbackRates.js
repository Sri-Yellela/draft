// services/callbackRates.js — ⭐ D111 · WHAT IS WORKING — the user's own callback rates (owner 10-30).
//
// Reply and interview counts per application, split four ways — the résumé version it was sent with (D90: the base
// upload the tailored version was made from), the role, the posting's liveness at the time (D107), and the days from
// posting to application — and ONE headline on The Table: "Applications sent within 3 days of posting got 3× the
// replies." ⛔ D17: rules and arithmetic, no model.
//
//   · THE ANSWERS come from what is already stored, never a third vocabulary: job_applications.response_outcome /
//     first_response_at (shared/applicationResponse.js — the D102 ladder reads the same columns) and the D103 inbox's
//     categories on messages matched to the application (services/inbox.js). An Interview / Assessment / Offer /
//     Rejection mail is a reply; an "applied" receipt, a verification code or a reminder is the system talking, not
//     a person — not a reply.
//   · THE DENOMINATOR is shared/applicationResponse.js's responseBucket: an application counts once it has a reply or
//     is MATURITY_DAYS (30) old. A week-old application with no reply yet is UNRESOLVED and in no count — otherwise
//     every rate reads low early on, which is exactly when someone first looks.
//   · ⛔ NEVER A BARE PERCENTAGE. Every figure leaves here as "6 of 20"; no percent is computed for display at all.
//   · ⛔ A MINIMUM COUNT (MIN_COUNT, 15). Below it in total the card is not shown; a group below it is listed as too
//     few and never enters the headline — so a headline always compares two groups of at least 15 each.
//   · ⛔ D106's verdict AT THE TIME is NOT a split: the one line is computed live from the posting and nothing records
//     it when an application is sent (job_applications has no such column). Splitting by today's verdict would
//     describe the posting now, not the choice the user made — so the split is skipped, and the payload says so.
//
// callbackRates() is PURE (rows in, the card's data out — no database, no clock of its own); gatherCallbackApps()
// is the one reader that turns the tables into those rows.
import { responseBucket } from "../shared/applicationResponse.js";
import { livenessOf, titleKey } from "./jobs/jobHistory.js";

export const MIN_COUNT = 15;
const DAY = 86400;
/** The headline needs at least this ratio between two groups' reply rates — a small gap is noise, not a finding. */
export const HEADLINE_MIN_RATIO = 1.5;

/** Inbox categories that are a person answering (D103 CATEGORIES). */
export const REPLY_CATEGORIES = Object.freeze(["interview", "assessment", "offer", "rejection"]);
const INTERVIEW_CATEGORIES = new Set(["interview", "offer"]);
const INTERVIEW_OUTCOMES = new Set(["screen", "interview", "offer"]);

export const SPLITS = Object.freeze([
  { key: "daysToApply", title: "Days from posting to application" },
  { key: "version", title: "Résumé version" },
  { key: "role", title: "Role" },
  { key: "liveness", title: "The posting when you applied" },
]);

/** What D106's verdict would need, and why it is not split. */
export const NOT_SPLIT = Object.freeze([
  { key: "verdict", title: "The \"should I apply\" line at the time",
    reason: "Not split: the line is worked out from the posting each time it is shown, and is not recorded when an application is sent." },
]);

// ── the four groupings ───────────────────────────────────────────────────────────────────────

/** Days from posting to application → a group. Unknown when the posting's date is not known. */
export function daysGroup(days) {
  if (!Number.isFinite(days)) return null;
  if (days <= 3) return { key: "d0_3", label: "Within 3 days of posting", phrase: "Applications sent within 3 days of posting", order: 0 };
  if (days <= 14) return { key: "d4_14", label: "4 to 14 days after posting", phrase: "Applications sent 4 to 14 days after posting", order: 1 };
  return { key: "d15", label: "More than 14 days after posting", phrase: "Applications sent more than 14 days after posting", order: 2 };
}

/** D107 liveness kind at the time of applying → a group. */
export function livenessGroup(kind) {
  if (kind === "reposted") return { key: "reposted", label: "Reposted", phrase: "Applications to reposted postings", order: 2 };
  if (kind === "open_long") return { key: "open_long", label: "Open 30 days or more", phrase: "Applications to postings open 30 days or more", order: 1 };
  if (kind === "new" || kind === "open") return { key: "fresh", label: "First posting, open under 30 days", phrase: "Applications to first-time postings under 30 days old", order: 0 };
  return null;
}

const SENIORITY = /\b(senior|sr|junior|jr|staff|principal|lead|distinguished|associate|entry level|entry|new grad(uate)?|graduate|early career|mid level|mid|intern(ship)?|i{1,3}|iv|[1-5])\b/g;

/** "Senior Software Engineer II, Payments (R-123)" → "software engineer". Seniority and the team after a comma go. */
export function roleKey(title) {
  const head = String(title ?? "").split(/,|\s[-–—|]\s|\s@\s/)[0];
  return titleKey(head).replace(SENIORITY, " ").replace(/\s+/g, " ").trim();
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Ios|Ml|Ai|Qa|Ui|Ux|Sre|Api)\b/g, (w) => w.toUpperCase());

export function roleGroup(title) {
  const k = roleKey(title);
  if (!k) return null;
  const label = titleCase(k);
  return { key: `role:${k}`, label, phrase: `Applications for ${label} roles`, order: 0 };
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (sec) => { const d = new Date(sec * 1000); return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

/**
 * The résumé version an application was sent with → a group. D90: a tailored version records the base upload it was
 * made from, so the comparable "version" across jobs is that UPLOAD (a per-job version number 1 means nothing across
 * jobs). `version` = { tailored, uploadId, uploadedAt } or null (nothing tailored for that job).
 */
export function versionGroup(version) {
  if (!version || !version.tailored) return { key: "untailored", label: "Not tailored", phrase: "Applications sent without a tailored résumé", order: 9 };
  if (version.uploadId == null) return { key: "upload:unknown", label: "Tailored, base not recorded", phrase: "Applications with a tailored résumé whose base was not recorded", order: 8 };
  const when = Number.isFinite(version.uploadedAt) ? dayLabel(version.uploadedAt) : `upload ${version.uploadId}`;
  return { key: `upload:${version.uploadId}`, label: `Résumé uploaded ${when}`, phrase: `Applications with the résumé uploaded ${when}`,
    order: -(version.uploadedAt ?? 0) };
}

// ── the answer per application ───────────────────────────────────────────────────────────────

/**
 * One application → { counted, replied, interviewed }. `counted` is false while it is too young to tell (and for a
 * withdrawal with no reply): it is then in no denominator at all.
 */
export function answerOf(app, { now }) {
  const cats = app.inboxCategories ?? [];
  const inboxReply = cats.some(c => REPLY_CATEGORIES.includes(c));
  const bucket = responseBucket({ response_outcome: app.responseOutcome ?? null, first_response_at: app.firstResponseAt ?? null,
    applied_at: app.appliedAt ?? null }, { now });
  const replied = bucket === "responded" || inboxReply;
  const interviewed = INTERVIEW_OUTCOMES.has(app.responseOutcome) || INTERVIEW_OUTCOMES.has(app.furthestStage)
    || cats.some(c => INTERVIEW_CATEGORIES.has(c));
  return { counted: replied || bucket === "silent", replied, interviewed: replied && interviewed };
}

// ── the pure core ────────────────────────────────────────────────────────────────────────────

const ofText = (k, n) => `${k} of ${n}`;

function ratioText(r) {
  if (!Number.isFinite(r)) return "more";
  const x = Math.round(r * 10) / 10;
  return `${String(x).replace(/\.0$/, "")}×`;
}

/**
 * The card's data.
 * @param {Array<{ appliedAt, responseOutcome?, furthestStage?, firstResponseAt?, inboxCategories?, version?, role?,
 *   livenessKind?, daysToApply? }>} apps — gatherCallbackApps' rows
 * @returns {{ shown, minCount, counted, replied, interviewed, waiting, headline, splits, notSplit }}
 */
export function callbackRates(apps, { now = Math.floor(Date.now() / 1000), minCount = MIN_COUNT } = {}) {
  const rows = [];
  let waiting = 0;
  for (const a of apps ?? []) {
    const ans = answerOf(a, { now });
    if (!ans.counted) { waiting++; continue; }
    rows.push({ ...ans, groups: {
      daysToApply: daysGroup(a.daysToApply),
      version: versionGroup(a.version),
      role: roleGroup(a.role),
      liveness: livenessGroup(a.livenessKind),
    } });
  }
  const counted = rows.length;
  const replied = rows.filter(r => r.replied).length;
  const interviewed = rows.filter(r => r.interviewed).length;
  const base = { minCount, counted, replied, interviewed, waiting, notSplit: NOT_SPLIT,
    total: { replies: ofText(replied, counted), interviews: ofText(interviewed, counted) } };
  if (counted < minCount) return { shown: false, ...base, headline: null, splits: [] };

  const splits = SPLITS.map(({ key, title }) => {
    const by = new Map();
    for (const r of rows) {
      const g = r.groups[key];
      if (!g) continue;
      if (!by.has(g.key)) by.set(g.key, { ...g, n: 0, replied: 0, interviewed: 0 });
      const e = by.get(g.key);
      e.n++; if (r.replied) e.replied++; if (r.interviewed) e.interviewed++;
    }
    const groups = [...by.values()]
      .sort((a, b) => a.order - b.order || b.n - a.n || a.label.localeCompare(b.label))
      .map(g => ({ key: g.key, label: g.label, phrase: g.phrase, n: g.n, replied: g.replied, interviewed: g.interviewed,
        enough: g.n >= minCount,
        replies: ofText(g.replied, g.n), interviews: ofText(g.interviewed, g.n) }));
    return { key, title, groups, unknown: counted - groups.reduce((s, g) => s + g.n, 0) };
  });

  // The headline: across every split, the two qualifying groups whose reply rates differ most.
  let best = null;
  for (const s of splits) {
    const ok = s.groups.filter(g => g.enough);
    for (const hi of ok) for (const lo of ok) {
      if (hi === lo || hi.replied < 2) continue;
      const rHi = hi.replied / hi.n, rLo = lo.replied / lo.n;
      if (rHi <= rLo) continue;
      const ratio = lo.replied === 0 ? Infinity : rHi / rLo;
      if (ratio < HEADLINE_MIN_RATIO) continue;
      const score = lo.replied === 0 ? 1e6 + hi.replied : ratio;
      if (!best || score > best.score) best = { score, ratio, split: s.key, hi, lo };
    }
  }
  const headline = best ? {
    split: best.split,
    text: `${best.hi.phrase} got ${ratioText(best.ratio)} the replies.`.replace("got more the replies", "got more replies"),
    detail: `${ofText(best.hi.replied, best.hi.n)} vs ${ofText(best.lo.replied, best.lo.n)}`,
    a: { label: best.hi.label, replied: best.hi.replied, n: best.hi.n },
    b: { label: best.lo.label, replied: best.lo.replied, n: best.lo.n },
  } : {
    split: null,
    text: `${replied} of ${counted} applications got a reply, and ${interviewed} of ${counted} an interview.`,
    detail: `No split differs enough to call yet — each side needs ${minCount} applications.`,
  };
  return { shown: true, ...base, headline, splits };
}

// ── the one reader ───────────────────────────────────────────────────────────────────────────

const toEpoch = (v) => {
  if (v == null || v === "") return null;
  if (Number.isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

/** The user's sent applications as callbackRates() rows. Read-only; own data only. */
export function gatherCallbackApps(db, userId) {
  const apps = db.prepare(`SELECT ja.job_id, ja.role, ja.applied_at, ja.response_outcome, ja.furthest_stage, ja.first_response_at
    FROM job_applications ja WHERE ja.user_id = ? AND ja.applied_at IS NOT NULL ORDER BY ja.id`).all(userId);
  if (!apps.length) return [];

  // D103: categories of the inbox messages matched to each application record (by job).
  const cats = new Map();
  for (const m of safe(() => db.prepare(`SELECT ar.job_id, im.category FROM inbox_messages im
      JOIN application_records ar ON ar.id = im.application_id AND ar.user_id = im.user_id
      WHERE im.user_id = ?`).all(userId), [])) {
    if (!cats.has(m.job_id)) cats.set(m.job_id, []);
    cats.get(m.job_id).push(m.category);
  }

  // D90: the tailored versions per job and the uploads they were made from.
  const versions = new Map();
  for (const v of safe(() => db.prepare(`SELECT job_id, version, base_upload_id, created_at FROM resume_versions
      WHERE user_id = ? ORDER BY job_id, version`).all(userId), [])) {
    if (!versions.has(v.job_id)) versions.set(v.job_id, []);
    versions.get(v.job_id).push(v);
  }
  const uploads = new Map(safe(() => db.prepare(`SELECT id, uploaded_at FROM base_resume_uploads WHERE user_id = ?`).all(userId), [])
    .map(u => [u.id, u.uploaded_at]));

  const histStmt = safe(() => db.prepare(`SELECT * FROM job_history WHERE job_id = ?`), null);
  const groupStmt = safe(() => db.prepare(`SELECT * FROM job_history WHERE company_key = ? AND title_key = ? ORDER BY first_seen`), null);
  const boardStmt = safe(() => db.prepare(`SELECT posted_at, discovered_at, scraped_at FROM scraped_jobs WHERE job_id = ?`), null);
  const groups = new Map();

  return apps.map(a => {
    const jobId = String(a.job_id);
    // The version it was sent with: the newest made before it was sent (else the first, made the same moment).
    const vs = versions.get(jobId) ?? [];
    const v = [...vs].reverse().find(x => x.created_at <= a.applied_at + 60) ?? vs[0] ?? null;
    const version = v ? { tailored: true, uploadId: v.base_upload_id ?? null, uploadedAt: v.base_upload_id != null ? (uploads.get(v.base_upload_id) ?? null) : null } : null;

    // D107 at the time: the posting's history row and its company + title group, read as of the applied date.
    let livenessKind = null, start = null;
    const h = histStmt ? safe(() => histStmt.get(jobId), null) : null;
    if (h) {
      const gk = `${h.company_key}\u0000${h.title_key}`;
      if (!groups.has(gk)) groups.set(gk, groupStmt ? safe(() => groupStmt.all(h.company_key, h.title_key), []) : []);
      livenessKind = safe(() => livenessOf(h, groups.get(gk), { now: a.applied_at }).kind, null);
      start = Math.min(...[h.first_seen, h.posted_at].filter(Number.isFinite));
    } else {
      const b = boardStmt ? safe(() => boardStmt.get(jobId), null) : null;
      if (b) start = Math.min(...[toEpoch(b.posted_at), toEpoch(b.discovered_at), toEpoch(b.scraped_at)].filter(Number.isFinite));
    }
    const daysToApply = Number.isFinite(start) ? Math.max(0, Math.floor((a.applied_at - start) / DAY)) : null;

    return { appliedAt: a.applied_at, responseOutcome: a.response_outcome, furthestStage: a.furthest_stage,
      firstResponseAt: a.first_response_at, inboxCategories: cats.get(jobId) ?? [], version, role: a.role,
      livenessKind, daysToApply };
  });
}

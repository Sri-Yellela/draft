// ── D56 · THE MANUAL ROUTE FILLS TOO — which job a page is, and what the extension may say about it ──
//
// The product has two routes to an application: Draft (the queue, which builds a packet when a run
// holds) and MANUAL (the user generates a résumé by hand and applies themselves). Only the first was
// built end to end: a hand-made résumé produced no packet, so the extension said "Nothing is
// prepared … Open the application from your Draft queue" — to someone who had never used the queue.
//
// This module answers the questions the extension's three truthful messages need, from the database
// and the adapter table (services/applyOrigins.js) — never from anything the request asserts:
//
//   resolvePageJob   which of THIS USER's jobs a page is — by its exact URL, or by the job id its ATS
//                    puts in the path on any of that ATS's origins (account.amazon.jobs/…/jobs/<id>)
//   packetAddressing a stored packet's origin list and job ids
//   pageNotice       (§8 row 10) "You applied here 28 Sep · 2 other roles at Amazon" — on demand
//   copySheetRows    (§8 row 17) the prepared answers as label/value rows, for the popup's Copy sheet
//
// Every read is guarded: a fixture without a table must lose a notice, never the handoff.
import { APPLY_ORIGIN_FAMILIES, familyOf, familyOfBoardJobId, jobIdOf, originOf, packetJobIds, packetOrigins, hostsSentence } from "./applyOrigins.js";
import { listHistory } from "./applicationRecords.js";
import { companyRows, matchCompany } from "../shared/companyIdentity.js";
import { pageKeyOf, ownJobByTitleCompany, jobIdForAtsKey } from "./jobPageKey.js";
import { normaliseQuestion } from "../shared/savedAnswers.js";

const one = (db, sql, ...args) => { try { return db.prepare(sql).get(...args) ?? null; } catch { return null; } };

/** A stored packet row (with the posting's sj_url / sj_apply_url joined) → { origins, jobIds }. */
export function packetAddressing(row, families = APPLY_ORIGIN_FAMILIES) {
  // ⭐ own_urls: the pages the user captured this job from (ownPageUrls) — a Workday tenant joins the packet's
  // addresses only through the user's own capture, and then only for this requisition (pageKeys below).
  const own = Array.isArray(row.own_urls) ? row.own_urls : [];
  const urls = [row.apply_url, row.sj_url, row.sj_apply_url, ...own].filter(Boolean);
  const origins = packetOrigins({ expectedOrigin: row.expected_origin, urls }, families);
  // the tenant itself: packetOrigins adds only an ATS family's origins, and Workday has no family row (D67C)
  for (const u of own) { try { const o = new URL(u).origin; if (!origins.includes(o)) origins.push(o); } catch { /* skip */ } }
  // ⭐ T11: a feed job's own id names its ATS (greenhouse::8198280) — that family's origins and that id join, so the form
  // an employer embeds from the ATS (Stripe → job-boards.greenhouse.io/embed/job_app?token=8198280) is this job's address.
  const board = familyOfBoardJobId(row.job_id, families);
  if (board) for (const o of board.family.origins) if (!origins.includes(o)) origins.push(o);
  const jobIds = packetJobIds(urls, families);
  if (board && !jobIds.includes(board.id)) jobIds.push(board.id);
  return {
    origins,
    jobIds,
    pageKeys: [...new Set(urls.map(u => pageKeyOf(u)?.key).filter(Boolean))],
  };
}

/**
 * Is this job the user's? A posting in the global pool is everyone's; a job is THIS user's when they
 * saved it, made a résumé for it, drafted it, recorded it, or hold a packet for it.
 */
export function userHasJob(db, userId, jobId) {
  const id = String(jobId);
  return [
    "SELECT 1 FROM resumes WHERE user_id=? AND job_id=?",
    "SELECT 1 FROM user_jobs WHERE user_id=? AND job_id=? AND (starred=1 OR applied=1)",
    "SELECT 1 FROM application_records WHERE user_id=? AND job_id=?",
    "SELECT 1 FROM apply_run_jobs WHERE user_id=? AND job_id=?",
    "SELECT 1 FROM apply_gate_packets WHERE user_id=? AND job_id=?",
    "SELECT 1 FROM job_applications WHERE user_id=? AND job_id=?",
    // ⭐ Extension (owner 10-12): a capture puts the job in the user's imports — so it is theirs. Before this, a
    // capture (which writes starred = 0) read "isn't on your board yet" on the very page it was captured from.
    "SELECT 1 FROM job_captures WHERE user_id=? AND job_id=? AND (action IS NULL OR action NOT LIKE 'refused%')",
  ].some(sql => !!one(db, sql, userId, id));
}

/**
 * ⛔ D99 (owner 10-13): "a job from the board is on the board". The user's own job (userHasJob), OR a posting that
 * is LIVE on the board — active and canonical (not folded into another source's row), which every signed-in user
 * is shown. Before this, a job the user had only seen on the board, opened in a tab the board bound, was "not on
 * your board" to fill, the Copy sheet and résumé generation. A retired or held-out posting still needs the user's
 * own record; an id that names nothing is false.
 */
export function jobOnUsersBoard(db, userId, jobId) {
  if (jobId == null || jobId === "") return false;
  if (userHasJob(db, userId, jobId)) return !!one(db, "SELECT 1 FROM scraped_jobs WHERE job_id=?", String(jobId));
  return !!one(db, "SELECT 1 FROM scraped_jobs WHERE job_id=? AND is_active=1 AND duplicate_of IS NULL", String(jobId));
}

export { recordPageKey } from "./jobPageKey.js";

/**
 * The addresses THIS USER showed belong to this job: the pages they captured it from, when those pages carry a
 * job key (a Workday tenant). Per user, never shared — the user's own capture is the evidence, as D67's learned
 * pairs are for submissions. Returned as canonical posting URLs.
 */
export function ownPageUrls(db, userId, jobId) {
  if (userId == null || jobId == null) return [];
  let rows = [];
  try { rows = db.prepare("SELECT DISTINCT url FROM job_captures WHERE user_id=? AND job_id=? AND url IS NOT NULL").pluck().all(userId, String(jobId)); }
  catch { return []; }
  return [...new Set(rows.map(u => pageKeyOf(u)?.canonicalUrl).filter(Boolean))];
}

const JOB_COLS = "job_id, title, company, url, apply_url, duplicate_of";

/**
 * Which job is this page? Returns { job, mine, how } — job null when nothing in the pool matches.
 *   how "url"     the page's own address is the posting's url / apply_url (query, hash, slash dropped)
 *   how "job_id"  the page is on an ATS origin in the adapter table and names the same job id
 * A duplicate resolves to its canonical row, as the import path does. When several rows match, one
 * that is the user's wins.
 */
export function resolvePageJob(db, userId, url, families = APPLY_ORIGIN_FAMILIES) {
  const none = { job: null, mine: false, how: null };
  const origin = originOf(url);
  if (!origin) return none;
  const canon = (row) => (row?.duplicate_of ? one(db, `SELECT ${JOB_COLS} FROM scraped_jobs WHERE job_id=?`, row.duplicate_of) || row : row);
  const shape = (row, how) => ({
    job: { jobId: String(row.job_id), title: row.title ?? null, company: row.company ?? null,
           url: row.url ?? null, applyUrl: row.apply_url ?? null },
    mine: userHasJob(db, userId, row.job_id), how,
  });
  const pick = (rows, how) => {
    const c = rows.map(canon).filter(Boolean);
    if (!c.length) return null;
    return shape(c.find(r => userHasJob(db, userId, r.job_id)) || c[0], how);
  };

  let bare = url;
  try { const u = new URL(url); bare = `${u.origin}${u.pathname}`.replace(/\/+$/, ""); } catch {}
  const candidates = [...new Set([url, bare, `${bare}/`])];
  const marks = candidates.map(() => "?").join(",");
  let rows = [];
  try {
    rows = db.prepare(`SELECT ${JOB_COLS} FROM scraped_jobs WHERE url IN (${marks}) OR apply_url IN (${marks})
                       ORDER BY updated_at DESC LIMIT 10`).all(...candidates, ...candidates);
  } catch {
    try { rows = db.prepare(`SELECT ${JOB_COLS} FROM scraped_jobs WHERE url IN (${marks}) OR apply_url IN (${marks}) LIMIT 10`).all(...candidates, ...candidates); }
    catch { rows = []; }
  }
  const byUrl = pick(rows, "url");
  if (byUrl) return byUrl;

  // ⭐ T2 (field report 10-14): the ATS's OWN job id in the address — the board's id for that job is
  // `${ats}::${id}` (services/jobPageKey.js atsJobKeyOf). Stripe's careers page carries ?gh_jid=8198280; the board holds
  // greenhouse::8198280 under another path on the same site. ⛔ An id read from a query parameter on a host that is NOT
  // the ATS's (`embedded`) is accepted only for a job of THAT site — its stored address is on the same site, or its
  // company is the site's name — since any page can carry the parameter.
  const atsId = jobIdForAtsKey(db, url);
  if (atsId) {
    const row = one(db, `SELECT ${JOB_COLS} FROM scraped_jobs WHERE job_id=?`, atsId);
    const got = row && pick([row], "ats_id");
    if (got) return got;
  }

  // ⭐ The page's JOB KEY — the same requisition at any stage (/apply, /apply/applyManually, …), with the locale
  // and tracking dropped: first what a capture recorded, then a posting whose own address carries the key.
  const pk = pageKeyOf(url);
  if (pk) {
    const keyed = one(db, "SELECT job_id FROM job_page_keys WHERE page_key=?", pk.key);
    if (keyed) {
      const row = one(db, `SELECT ${JOB_COLS} FROM scraped_jobs WHERE job_id=?`, keyed.job_id);
      const got = row && pick([row], "page_key");
      if (got) return got;
    }
    let host = "";
    try { host = new URL(url).host.toLowerCase(); } catch {}
    let keyRows = [];
    try {
      keyRows = db.prepare(`SELECT ${JOB_COLS} FROM scraped_jobs WHERE (url LIKE ? OR apply_url LIKE ?) AND (url LIKE ? OR apply_url LIKE ?) LIMIT 50`)
        .all(`https://${host}/%`, `https://${host}/%`, `%${pk.requisition}%`, `%${pk.requisition}%`);
    } catch { keyRows = []; }
    const same = keyRows.filter(r => [r.url, r.apply_url].some(u => u && pageKeyOf(u)?.key === pk.key));
    const got = pick(same, "page_key");
    if (got) return got;
    // ⭐ (company, title): a job THIS user captured elsewhere (LinkedIn) whose title is the page's and whose company is
    // the tenant — exactly one, or none (services/jobPageKey.js ownJobByTitleCompany).
    const own = ownJobByTitleCompany(db, userId, pk);
    if (own) {
      const row = one(db, `SELECT ${JOB_COLS} FROM scraped_jobs WHERE job_id=?`, own);
      const hit = row && pick([row], "title_company");
      if (hit) return hit;
    }
  }

  // The same job on another of its ATS's origins: account.amazon.jobs/en-US/applicant/jobs/2912345/apply
  // is www.amazon.jobs/en/jobs/2912345/<slug>. Narrowed in SQL by origin and id, confirmed by the rule.
  const fam = familyOf(origin, families);
  const pageId = fam ? jobIdOf(url, families) : null;
  if (!fam || !pageId) return none;
  const likes = fam.origins.map(o => `${o}/%`);
  const where = likes.map(() => "(url LIKE ? OR apply_url LIKE ?)").join(" OR ");
  let fam_rows = [];
  try {
    fam_rows = db.prepare(`SELECT ${JOB_COLS} FROM scraped_jobs WHERE (${where}) AND (url LIKE ? OR apply_url LIKE ?) LIMIT 50`)
      .all(...likes.flatMap(l => [l, l]), `%${pageId}%`, `%${pageId}%`);
  } catch { fam_rows = []; }
  const same = fam_rows.filter(r => [r.url, r.apply_url].some(u => u && jobIdOf(u, families) === pageId));
  return pick(same, "job_id") || none;
}

// "28 Sep", as the owner wrote it and as D54's notice does — fixed, never the runtime's locale.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (sec) => { const d = new Date(sec * 1000); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const SENT = new Set(["sent", "no_reply", "replied"]);

/**
 * ⭐ §8 row 10 — on demand, at the point of action: "You applied here 28 Sep · 2 other roles at Scale AI".
 * D54's company identity (one company however many boards), never the display name alone. Null when
 * there is nothing to say. ⛔ Never a block: it is a sentence, and the fill still runs.
 * @param job  { jobId, company, url, applyUrl } — the page's job, or null (then only the company is known)
 * @param company  the company name the page shows, when no job matched
 */
export function pageNotice(db, userId, { job = null, company = null } = {}) {
  let rows;
  try { rows = listHistory(db, userId, {}); } catch { return null; }
  if (!rows?.length) return null;
  const here = job ? rows.find(r => String(r.jobId) === String(job.jobId)) : null;
  const groups = companyRows(rows);
  let key = here?.companyKey ?? null;
  if (!key && (job || company)) {
    const members = new Map(groups.map(g => [g.key, g.roles.map(r => ({ company: r.company, url: r.applyUrl }))]));
    key = matchCompany({ company: job?.company ?? company, url: job?.applyUrl || job?.url || null }, members);
  }
  const g = key ? groups.find(x => x.key === key) : null;
  const parts = [];
  if (here && SENT.has(here.status)) parts.push(here.sentAt ? `You applied here ${fmtDay(here.sentAt)}` : "You applied here");
  else if (here && here.status === "in_play") parts.push("This one is already in your Table");
  const others = g ? g.roles.filter(r => String(r.jobId) !== String(job?.jobId) && r.status !== "closed") : [];
  if (others.length) parts.push(`${others.length} other role${others.length === 1 ? "" : "s"} at ${g.name || job?.company || company || "this company"}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * §8 row 17 — the Copy sheet: the prepared answers as rows, eligibility first (they are attestations,
 * §6), with no value invented for an unanswered question — those are listed as unanswered.
 */
export function copySheetRows(packet = {}) {
  // ⭐ D96 §4 (J9's browser pass, 10-14): ONE row per question. A packet GUESS whose question the candidate has an
  // answer of their own to (a saved answer, below) — the sheet listed both, the guess labelled "profile" beside "you
  // acknowledged". The candidate's own answer is the one that fills (the extension's yieldGuessesToStated), so it is
  // the one the sheet shows.
  const own = new Set((packet.savedAnswers || []).filter(s => s?.question && s.answer != null && String(s.answer).trim() !== "" && !s.optIn)
    .map(s => normaliseQuestion(s.question)));
  // Only a GUESS is dropped — an exact profile answer keeps its control in the fill, so it keeps its row here.
  const guessed = (a) => ["label_fuzzy", "default", "sponsorship_assumed_future"].includes(a.provenance);
  const answers = (packet.answers || []).filter(a => a && a.value != null && a.value !== ""
    && !(guessed(a) && own.has(normaliseQuestion(a.field || ""))));
  const rows = answers.map(a => ({
    label: a.field || a.name || "Answer", value: String(a.value), name: a.name ?? null,
    eligibility: !!a.eligibility, provenance: a.provenance ?? null,
  }));
  rows.sort((a, b) => Number(b.eligibility) - Number(a.eligibility));
  // ⭐ (owner 10-12: "the Copy sheet lists only 4 answers") — everything the packet carries, not only the 16
  // canonical fields: the saved answers for this employer, the worked-here fact, and the work and education history.
  for (const s of packet.savedAnswers || []) {
    if (s?.question && s.answer != null && String(s.answer).trim() !== "" && !s.optIn) {
      // ⭐ D96 §4: where it came from and when it was acknowledged; an eligibility row says "you are attesting to this".
      rows.push({ label: s.question, value: String(s.answer), name: null, eligibility: !!s.eligibility, provenance: "saved_answer",
        source: s.source ?? null, acknowledgedAt: s.acknowledgedAt ?? null, attesting: !!(s.attesting ?? s.eligibility) });
    }
  }
  if (packet.workedHere?.answer) rows.push({ label: `Worked at ${packet.workedHere.company} before?`, value: packet.workedHere.answer, name: null, eligibility: false, provenance: "work_history" });
  const when = (d) => (d?.year ? `${d.month ? String(d.month).padStart(2, "0") + "/" : ""}${d.year}` : "");
  (packet.entries?.work || []).forEach((w, i) => {
    const span = [when(w.from), w.current ? "present" : when(w.to)].filter(Boolean).join(" – ");
    const v = [w.title, w.company, w.location, span].filter(Boolean).join(" · ");
    if (v) rows.push({ label: `Work ${i + 1}`, value: v, name: null, eligibility: false, provenance: "work_history", group: "work" });
  });
  (packet.entries?.education || []).forEach((e, i) => {
    const v = [e.degree, e.field, e.school, when(e.to)].filter(Boolean).join(" · ");
    if (v) rows.push({ label: `Education ${i + 1}`, value: v, name: null, eligibility: false, provenance: "education", group: "education" });
  });
  rows.sort((a, b) => Number(b.eligibility) - Number(a.eligibility));
  const unanswered = (packet.unresolved || []).map(u => ({ label: u.field || u.name, eligibility: !!u.eligibility }));
  return { rows, unanswered };
}

/**
 * ⛔ D56 · THE THREE TRUTHFUL MESSAGES (plus the expired case) — and never "from your Draft queue" to
 * someone on the manual route. The extension shows these in the toolbar tooltip (the hotkey) and the
 * popup.
 *   not_this_address  a packet exists for this page's job, but this page is not one of its addresses
 *   prepare           no packet, but the page is a job of the user's → Fill prepares it, then fills
 *   stale             a packet matched, and it has gone off (72h) → Fill prepares fresh ones, then fills
 *   not_on_board      the posting is in draft's pool, not on the user's board → the Capture button adds it
 *   unknown           draft does not know this job → the Capture button adds it
 * ⛔ T16 (field report 10-14): no sentence tells the user to run an earlier step ("press … in the draft popup",
 * "capture it first"). Where the extension does the step itself (Fill prepares — extension/tabState.js runFillChain),
 * the sentence says so; where it cannot (a capture writes a job into the user's account), it names ONE button.
 */
export function handoffMessage(state, { job = null, addresses = [], resume = "none" } = {}) {
  const what = job ? [job.title, job.company].filter(Boolean).join(" at ") || "this job" : "this job";
  switch (state) {
    case "not_this_address":
      return `This page isn't one of this application's addresses. It fills on ${hostsSentence(addresses) || "another address"}.`;
    case "prepare":
      return resume === "ready"
        ? `Nothing is prepared for this page yet — draft has your résumé for ${what}, and Fill prepares your answers before it fills.`
        : `Nothing is prepared for this page yet — ${what} is on your board, and Fill prepares your answers before it fills.`;
    case "stale":
      return `The answers prepared for ${what} have expired — Fill prepares fresh ones before it fills.`;
    case "not_on_board":
      return "This job isn't on your board yet — Capture adds it.";
    case "unknown":
    default:
      return "draft doesn't know this job — Capture adds it.";
  }
}

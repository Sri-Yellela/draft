// ============================================================
// draftHouseRuns — Draft House's ONE adapter to D113's routes (the remote auto-apply loop)
// ============================================================
// Every call the tree makes to a D113 route is here and nowhere else, so when the server's routes
// land (lane d113server: services/picks.js publicRun / publicPick / leftOutFor) there is one file to
// align. Each call DEGRADES: a route that is not there yet (404), or answers with a page instead of
// JSON, reads as "no D113 data" — the tree then shows today's attempts grouped by day and puts the
// next-run square from Auto settings' run times (lib/draftHouseTree.js nextRunFromSettings).
//
// ALIGNED at merge (43t) with the shipped routes (routes/picksConfirm.js):
//   GET  /api/picks/runs?limit=N           → { runs: [publicRun], state: { nextRunAt, mode, … } } (GET /api/picks/state's shape)
//            publicRun = { id, slotAt, mode: "ask"|"apply", seen, picked, leftOut: { reason: n }, leftOutTotal,
//                          expiresAt, picks: [publicPick] }
//            publicPick = { id, runId, jobId, rank, title, company, line, score, state, review, actedAt, expiresAt }
//   GET  /api/picks/runs/:id/left-out      → leftOutFor: { run, kept, jobs: [{ jobId, reason, reasonLabel, title, company }] }
//   POST /api/picks/:id/apply              → the app's own Apply (the email's link is /p/confirm/<token>)
//   POST /api/picks/:id/pass               → Pass
//   POST /api/picks/:id/resume             → "Make it now": the pick's tailored résumé before Apply; nothing is sent
//            (each pick in a run carries resumeReady: a current tailored résumé exists)
//   Auto settings (existing PUT /api/apply/auto-settings) carry D113's two switches:
//            picks: boolean                  "Ask me first" sends one picks message per run
//            showFormBeforeSending: boolean  off: a tap on Apply sends
// The other reads here are EXISTING routes the tree needs on the same rhythm (the pipeline's Table
// rows for Sent and Replied, the portals and Gmail for broken connections, a run-job's answers).
// ============================================================
import { api } from "./api.js";

export const D113_ROUTES = Object.freeze({
  runs: "/api/picks/runs",
  leftOut: (runId) => `/api/picks/runs/${encodeURIComponent(runId)}/left-out`,
  pick: (pickId, act) => `/api/picks/${encodeURIComponent(pickId)}/${act}`,
  resume: (pickId) => `/api/picks/${encodeURIComponent(pickId)}/resume`,
});

const missing = (e) => e && (e.status === 404 || e.status === 405 || e.status === 501);
const asMs = (t) => { const n = Number(t); return Number.isFinite(n) && n > 0 ? (n < 1e12 ? n * 1000 : n) : null; };

/**
 * D113's stored runs, newest first. `{ available, runs, nextRunAt }` — available false when the
 * route is not there (or answered with something that is not a runs list): the tree falls back.
 */
export async function loadRuns({ limit = 20 } = {}, call = api) {
  try {
    const d = await call(`${D113_ROUTES.runs}?limit=${Number(limit) || 20}`);
    if (!d || !Array.isArray(d.runs)) return { available: false, runs: [], nextRunAt: null };
    // The server sends the next run inside `state` (GET /api/picks/state's shape); a top-level one is read too.
    return { available: true, runs: d.runs, nextRunAt: asMs(d.state?.nextRunAt ?? d.nextRunAt) };
  } catch (e) {
    return { available: false, runs: [], nextRunAt: null, error: missing(e) ? null : (e?.message || null) };
  }
}

/** "See what was left out" — the postings a run left out (kept 14 days). Null when unavailable. */
export async function loadLeftOut(runId, call = api) {
  try {
    const d = await call(D113_ROUTES.leftOut(runId));
    return d && Array.isArray(d.jobs) ? d : null;
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

/** Apply / Pass on a pick from the app. `{ ok, message }` — a missing route says where to do it instead. */
export async function actOnPick(pickId, act, call = api) {
  if (act !== "apply" && act !== "pass") throw new Error("bad pick action");
  try {
    const d = await call(D113_ROUTES.pick(pickId, act), { method: "POST" });
    return { ok: true, message: d?.message || (act === "apply" ? "Applying. It is sent when it is filled." : "Passed.") };
  } catch (e) {
    if (missing(e)) return { ok: false, message: "Use the Apply or Pass link in your picks email for now." };
    return { ok: false, message: e?.message || "That did not work. Nothing changed." };
  }
}

/**
 * U4 · "Make it now" — the pick's tailored résumé, made now instead of after Apply. Nothing is sent and the pick stays a
 * pick. `{ ok, message, atsScore }`; a refusal (no drafts left, the posting gone) says why in the server's words.
 */
export async function makePickResume(pickId, call = api) {
  try {
    const d = await call(D113_ROUTES.resume(pickId), { method: "POST" });
    return { ok: true, message: d?.message || "Made. Nothing was sent.", atsScore: d?.atsScore ?? null };
  } catch (e) {
    return { ok: false, message: e?.message || "The résumé was not made. Nothing changed." };
  }
}

/** Auto settings, read once for the header and the next-run square. Null when unavailable. */
export async function loadAutoSettings(call = api) {
  try { const d = await call("/api/apply/auto-settings"); return d?.settings || null; } catch { return null; }
}

/**
 * "Ask me first" turns D113's picks on; "Apply for me" is FULL AUTO (POST /api/apply/mode, through the
 * context's setApplyMode). The picks switch is stored with the rest of Auto settings, sent whole.
 */
export async function setPicksSwitch(on, call = api) {
  const cur = await loadAutoSettings(call);
  if (!cur) return null;
  if (cur.picks === !!on) return cur;
  try {
    const r = await call("/api/apply/auto-settings", { method: "PUT", body: JSON.stringify({ settings: { ...cur, picks: !!on } }) });
    return r?.settings || null;
  } catch { return null; }
}

/** The Table's rows (sent and replied), from the pipeline's one ladder. [] when unavailable. */
export async function loadTableRows(call = api) {
  try { const d = await call("/api/pipeline?surface=table"); return Array.isArray(d?.rows) ? d.rows : []; } catch { return []; }
}

/**
 * Broken connections for the side column's first block: a portal session that expired, Gmail that
 * disconnected. Each { key, title, sub, fix } — `fix` names what the panel does ("settings" | "gmail").
 */
export async function loadConnections(call = api) {
  const out = [];
  try {
    const d = await call("/api/portals");
    for (const p of d?.portals || []) {
      if (p.status === "expired") out.push({ key: `portal-${p.id}`, title: `Your ${p.originHost} sign-in expired`, sub: "Jobs there wait until you reconnect.", fix: "settings", fixLabel: "Reconnect" });
    }
  } catch { /* no portals feed — nothing to warn about */ }
  try {
    const g = await call("/api/gmail/status");
    if (g?.available && g.status === "expired") out.push({ key: "gmail", title: "Gmail disconnected", sub: "Codes and replies are not read until you reconnect.", fix: "gmail", fixLabel: "Reconnect Gmail" });
  } catch { /* Gmail not configured */ }
  return out;
}

/**
 * U5 · the actions on a sent row (services/pipelineWorkspace.js ROW_ACTIONS; D110's date route). Each records the user's
 * own word in draft — ⛔ none sends anything to the employer. `{ ok, message }`.
 */
const rowAct = async (call, path, init, done) => {
  try { await call(path, init); return { ok: true, message: done }; }
  catch (e) { return { ok: false, message: e?.message || "That did not work. Nothing changed." }; }
};
export const ROW_ROUTES = Object.freeze({
  withdrawn: (applicationId) => `/api/pipeline/applications/${encodeURIComponent(applicationId)}/withdrawn`,
  note: (applicationId) => `/api/pipeline/job/${encodeURIComponent(applicationId)}/note`,
  date: (applicationId) => `/api/interview/prep/${encodeURIComponent(applicationId)}/date`,
});
/**
 * "I withdrew it" — the user withdrew on the company's own site; this records it (the ladder's `withdrawn`).
 * ⛔ draft withdraws nothing itself: the tree's Withdraw only opens the company's page.
 */
export function confirmWithdrawn(applicationId, call = api) {
  return rowAct(call, ROW_ROUTES.withdrawn(applicationId), { method: "POST" }, "Marked withdrawn.");
}
/** "Note why" — saved on the application (The Table's Notes). */
export function saveNoteWhy(applicationId, note, call = api) {
  return rowAct(call, ROW_ROUTES.note(applicationId), { method: "PUT", body: JSON.stringify({ note }) }, "Saved.");
}
/** "Add the date" — an interview's or an assessment's date (optional time, time zone): D110's countdown and Prep tab. */
export function setInterviewDate(applicationId, date, time = null, timeZone = null, call = api) {
  return rowAct(call, ROW_ROUTES.date(applicationId),
    { method: "PUT", body: JSON.stringify({ date, time: time || null, timeZone: timeZone || null }) }, "Date saved.");
}

/** The Answers leaf's data: every field and value, and the open questions (existing review read). */
export async function loadAnswers(runJobId, call = api) {
  const d = await call(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/review`);
  return { answers: Array.isArray(d?.answers) ? d.answers : [], openQuestions: Array.isArray(d?.openQuestions) ? d.openQuestions : [],
    screenshotAvailable: !!d?.screenshotAvailable, resume: d?.resume || null };
}

// routes/picksConfirm.js — ⭐ D113 P3 / P4 · THE CONFIRM PAGE and the picks API.
//
// GET  /p/confirm/<token>   ⛔ NEVER ACTS. Mail scanners and link previews open links; a GET only SHOWS the pick (the job,
//                           its one line) and ONE Confirm button, which is a POST form. Pass is the same page, "Pass".
//                           Apply all for the run is a second form on the same page.
// POST /p/confirm/<token>   acts — once. The token is signed (HMAC, a key derived from SESSION_SECRET — services/picks.js
//                           pickSecret), bound to (user, pick) — or (user, run) for Apply all — and expires at the next run
//                           time; single use is the row's own stamp (picks.token_used_at, picks_runs.all_used_at), so a
//                           second press, a replay or a Pass after an Apply does nothing.
// Works signed out (the link is the capability) and shows ONLY that pick. Plain server-rendered HTML like the proof page:
// every value escaped, noindex, no cache, no referrer (the token is in the address).
//
// THE API (signed in; the Draft House tree, D113 UI):
//   GET  /api/picks/state                  the mode, the next run time, the switches
//   POST /api/picks/mode {mode}            "ask" (Ask me first) | "apply" (Apply for me) | "off"
//   GET  /api/picks/runs?limit&before      runs newest first, each with its counts by reason and its picks
//   GET  /api/picks/runs/:id/left-out      the postings a run left out (kept 14 days), with the reason
//   POST /api/picks/:id/apply · /pass      the same actions as the confirm page, signed in
//   POST /api/picks/:id/resume             D113 UI U4 "Make it now": the pick's tailored résumé, made on the user's press
//                                          — before Apply, never a send (makePickResume below)
//   POST /api/picks/runs/:id/apply-all
import express from "express";
import { readPickToken, signPickToken, publicRun, publicPick, listRuns, leftOutFor, claimRun, questionsForPick,
  nextSlotAfter, LEFT_OUT_REASONS } from "../services/picks.js";
import { readAutoSettings } from "../shared/autoSettings.js";
import { lastSlotAt, localClock } from "../services/autoScheduler.js";
import { userHeld } from "../services/applyUserHold.js";
import { fullAutoDisabled } from "../services/appSettings.js";
import { artifactCurrency } from "../services/resumeCurrency.js";
import { draftSlots, slotsExhausted, recordGenerationSlot } from "../services/draftSlots.js";
import { baseResumeOnlyState } from "../services/baseResumeOnly.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => Math.floor(Date.now() / 1000);

// ── the actions (shared by the confirm page and the API) ─────────────────────────────────────

function settingsOf(db, userId) {
  return readAutoSettings(db.prepare(`SELECT auto_settings FROM users WHERE id = ?`).pluck().get(userId));
}

/**
 * Apply to these offered picks of one user — once each. The tap is recorded FIRST (state 'applied', the single-use stamp,
 * whether the form is shown first), then the run starts (startPickRun → startRun, the same admission as every Draft). A
 * refused start puts the pick in 'start_failed', which carries no send authority.
 */
export function applyPicks(db, { startPickRun }, userId, pickIds, nowSec = now()) {
  const review = settingsOf(db, userId).showFormBeforeSending === true;
  const claim = db.prepare(`UPDATE picks SET state = 'applied', token_used_at = ?, acted_at = ?, review = ?
    WHERE id = ? AND user_id = ? AND state = 'offered' AND token_used_at IS NULL AND expires_at > ?`);
  const claimed = [];
  db.transaction(() => { for (const id of pickIds) if (claim.run(nowSec, nowSec, review ? 1 : 0, id, userId, nowSec).changes) claimed.push(id); })();
  if (!claimed.length) return { ok: false, status: 409, error: "already_done" };
  const jobs = claimed.map(id => db.prepare(`SELECT job_id FROM picks WHERE id = ?`).pluck().get(id));
  let r;
  try { r = startPickRun(userId, jobs, { review }); } catch (e) { r = { status: 500, body: { error: "start_failed", message: e.message } }; }
  const ok = r?.status === 202 || r?.status === 200;
  const mark = db.prepare(`UPDATE picks SET apply_status = ?, apply_error = ?, state = CASE WHEN ? THEN state ELSE 'start_failed' END WHERE id = ?`);
  for (const id of claimed) mark.run(r?.status ?? null, ok ? null : String(r?.body?.message || r?.body?.error || "not started").slice(0, 300), ok ? 1 : 0, id);
  return { ok, status: ok ? 202 : (r?.status || 500), review, applied: claimed, error: ok ? null : (r?.body?.error || "not_started"), message: r?.body?.message || null };
}

export function passPick(db, userId, pickId, nowSec = now()) {
  const ok = db.prepare(`UPDATE picks SET state = 'passed', token_used_at = ?, acted_at = ? WHERE id = ? AND user_id = ? AND state = 'offered'
    AND token_used_at IS NULL`).run(nowSec, nowSec, pickId, userId).changes === 1;
  return ok ? { ok: true, status: 200 } : { ok: false, status: 409, error: "already_done" };
}

/**
 * ⭐ D113 UI U4 · "MAKE IT NOW" — the tailored résumé for ONE offered pick, on the user's press, before Apply.
 * Tailoring otherwise waits for Apply (D113 P4: the model cost is spent on jobs the user wants); this press IS the user
 * wanting it. It only makes the résumé: the pick stays offered, no run starts, nothing is filled or sent, and the job is
 * not tagged Pending. It is the apply path's own generation (deps.generateResume = server.js generateResumeForApply), so
 * the run after Apply reuses this résumé while it is current instead of writing another.
 * A63: a NEW résumé costs one of the day's Draft slots — refused at zero, debited only when one was written; a current
 * résumé already there costs nothing and is never refused. The generation itself checks the plan's résumé limit
 * (checkLimit), as every generation does.
 * D66: a user on "send my base résumé" has no tailoring to make (the run sends the base résumé, no model call) → 409.
 * REUSE (owner 10-31: "a later Apply reuses that résumé"): it is stored as the 'generate' tool's artifact for the job,
 * the tool a pick's run uses (startAutoRun sets none → run.tool_type 'generate'), and generateResumeForApply's first
 * step returns a CURRENT artifact (artifactCurrency) without a model call.
 */
export async function makePickResume(db, { generateResume } = {}, userId, pickId) {
  const pick = db.prepare(`SELECT * FROM picks WHERE id = ? AND user_id = ?`).get(pickId, userId);
  if (!pick) return { ok: false, status: 404, error: "not_found" };
  if (pick.state !== "offered") {
    return { ok: false, status: 409, error: "not_offered", message: "This one is no longer a pick waiting for you, so its résumé is made in its run." };
  }
  if (typeof generateResume !== "function") return { ok: false, status: 503, error: "unavailable", message: "Résumés cannot be made on this server right now." };
  if (baseResumeOnlyState(db, userId).on) {
    return { ok: false, status: 409, error: "base_resume_only", message: "You send your base résumé with every application, so there is nothing to tailor." };
  }
  if (!artifactCurrency(db, { userId, jobId: pick.job_id }).current) {
    const slots = draftSlots(db, userId);
    if (slots.remaining <= 0) return { ok: false, status: 429, ...slotsExhausted(slots) };
  }
  let r;
  try { r = await generateResume(userId, pick.job_id, "generate"); } catch (e) { r = { error: e?.message || "generation failed" }; }
  if (!r || r.error) {
    const status = r?.limitReached ? 429 : r?.error === "job_not_found" ? 410 : 502;
    return { ok: false, status, error: r?.errorCode || (status === 410 ? "posting_gone" : "generation_failed"),
      message: status === 410 ? "The posting is gone, so there is nothing to tailor it to." : (r?.error || "The résumé was not made. Try again.") };
  }
  // fromCache true = a current résumé was reused (free); undefined = joined a generation another press already paid for.
  if (r.fromCache === false) recordGenerationSlot(db, userId, pick.job_id);
  return { ok: true, status: 200, resumeReady: true, fromCache: r.fromCache === true, atsScore: r.atsScore ?? null, draftSlots: draftSlots(db, userId),
    message: "Made. Nothing was sent." };
}

export function applyAll(db, deps, userId, runId, nowSec = now()) {
  const run = db.prepare(`SELECT * FROM picks_runs WHERE id = ? AND user_id = ?`).get(runId, userId);
  if (!run) return { ok: false, status: 404, error: "not_found" };
  if (run.expires_at <= nowSec) return { ok: false, status: 410, error: "expired" };
  const ids = db.prepare(`SELECT id FROM picks WHERE run_id = ? AND state = 'offered' AND token_used_at IS NULL ORDER BY rank`).pluck().all(run.id);
  if (!ids.length || !claimRun(db, run.id, "all_used_at", nowSec)) return { ok: false, status: 409, error: "already_done" };
  return applyPicks(db, deps, userId, ids, nowSec);
}

// ── the page ─────────────────────────────────────────────────────────────────────────────────

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --ink: #1d1f24; --muted: #5d6270; --line: #d9dce3; --bg: #fbfbfc; --accent: #3b5bdb; --on-accent: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --ink: #e8e9ee; --muted: #a3a8b6; --line: #333845; --bg: #15171c; --accent: #8ea6ff; --on-accent: #10131a; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .company { color: var(--muted); margin: 0 0 12px; }
  .line { border-left: 3px solid var(--accent); padding: 4px 0 4px 10px; margin: 12px 0 20px; }
  .note { color: var(--muted); font-size: 13px; }
  form { margin: 12px 0; }
  button { font: inherit; padding: 10px 18px; border-radius: 8px; border: 1px solid var(--accent); cursor: pointer; }
  .primary { background: var(--accent); color: var(--on-accent); }
  .secondary { background: transparent; color: var(--accent); }
  label { display: block; margin: 12px 0 4px; }
  input[type=text], textarea, select { width: 100%; box-sizing: border-box; font: inherit; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: var(--ink); }
  ul { padding-left: 18px; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

const message = (title, text) => page(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p>`);

function send(res, status, html) {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Referrer-Policy", "no-referrer");
  res.status(status).type("html").send(html);
}

/** Read a token and the row it is bound to. { ok, kind, pick?, run?, payload } or { ok:false, status, html }. */
function resolve(db, secret, token, nowSec) {
  const t = readPickToken(secret, token, nowSec);
  const notValid = { ok: false, status: 404, html: message("This link is not valid", "Open draft to see your picks.") };
  if (!t.ok && t.error !== "expired") return notValid;
  const p = t.payload;
  if (p.k === "all") {
    const run = db.prepare(`SELECT * FROM picks_runs WHERE id = ? AND user_id = ?`).get(p.id, p.u);
    if (!run) return notValid;
    if (!t.ok) return { ok: false, status: 410, html: message("This link has expired", "Picks last until your next run time. Open draft to see the new ones.") };
    return { ok: true, kind: "all", run, payload: p };
  }
  const pick = db.prepare(`SELECT * FROM picks WHERE id = ? AND user_id = ?`).get(p.id, p.u);
  if (!pick) return notValid;
  if (!t.ok) {
    return { ok: false, status: 410, html: p.k === "answer"
      ? message("This link has expired", "Open draft to answer the question.")
      : message("This link has expired", "Picks last until your next run time. Open draft to see the new ones.") };
  }
  return { ok: true, kind: p.k, pick, payload: p };
}

const doneText = (pick) => pick.state === "passed" ? "You passed on this job."
  : pick.state === "applied" ? (pick.review ? "You applied. The form waits for your review in draft." : "You applied. draft is sending it.")
  : pick.state === "start_failed" ? `It could not start: ${pick.apply_error || "try again in draft"}.`
  : "This pick is no longer open.";

function pickHeader(pick) {
  return `<h1>${esc(pick.title || "A job picked for you")}</h1>
${pick.company ? `<p class="company">${esc(pick.company)}</p>` : ""}
${pick.line ? `<p class="line">${esc(pick.line)}</p>` : ""}`;
}

function renderPick(db, secret, r, nowSec) {
  const { pick, kind } = r;
  if (pick.token_used_at != null || pick.state !== "offered") return page("Already done", `${pickHeader(pick)}<p>${esc(doneText(pick))}</p>`);
  const review = settingsOf(db, pick.user_id).showFormBeforeSending === true;
  const confirm = kind === "pass"
    ? `<form method="post"><button class="primary" type="submit">Confirm: pass on this job</button></form>
<p class="note">It will not be offered again.</p>`
    : `<form method="post"><button class="primary" type="submit">Confirm: ${review ? "fill the application" : "send my application"}</button></form>
<p class="note">${review ? "draft fills the form and waits for you to review it before anything is sent."
      : "A tap on Confirm sends the application. A question only you can answer comes back to you first."}</p>`;
  const others = db.prepare(`SELECT COUNT(*) FROM picks WHERE run_id = ? AND state = 'offered' AND token_used_at IS NULL`).pluck().get(pick.run_id);
  const run = db.prepare(`SELECT * FROM picks_runs WHERE id = ?`).get(pick.run_id);
  const all = kind !== "pass" && others > 1 && run && run.all_used_at == null
    ? `<form method="post" action="/p/confirm/${esc(signPickToken(secret, { k: "all", id: run.id, u: pick.user_id, exp: run.expires_at }))}">
<button class="secondary" type="submit">Apply to all ${others} picks from this run</button></form>` : "";
  return page(kind === "pass" ? "Pass on this job" : "Apply to this job", `${pickHeader(pick)}${confirm}${all}`);
}

function renderAll(db, r) {
  const picks = db.prepare(`SELECT * FROM picks WHERE run_id = ? AND state = 'offered' AND token_used_at IS NULL ORDER BY rank`).all(r.run.id);
  if (r.run.all_used_at != null || !picks.length) return message("Already done", "Every pick from this run has been answered.");
  const review = settingsOf(db, r.run.user_id).showFormBeforeSending === true;
  return page("Apply to all", `<h1>Apply to all ${picks.length} picks</h1>
<ul>${picks.map(p => `<li>${esc(p.title || "A job")}${p.company ? ` — ${esc(p.company)}` : ""}</li>`).join("")}</ul>
<form method="post"><button class="primary" type="submit">Confirm: ${review ? "fill all" : "send all"} ${picks.length}</button></form>
<p class="note">${review ? "Each form waits for your review before anything is sent." : "Confirm sends each application."}</p>`);
}

function renderAnswer(db, r) {
  const { pick, payload } = r;
  if (pick.question_sent_at !== payload.n || (pick.question_answered_at != null && pick.question_answered_at >= pick.question_sent_at)) {
    return message("Already answered", "Thank you. draft continues with this application.");
  }
  const qs = questionsForPick(db, pick);
  if (!qs.length) return message("Nothing to answer", "This application is no longer waiting on a question.");
  const field = (q, i) => {
    const opts = Array.isArray(q.options) ? q.options.map(o => (typeof o === "object" ? (o.label ?? o.value) : o)).filter(o => o != null && String(o).trim()) : [];
    const name = `a${i}`;
    return `<label for="${name}">${esc(q.question)}</label>
<input type="hidden" name="q${i}" value="${esc(q.question)}">
${opts.length ? `<select id="${name}" name="${name}"><option value=""></option>${opts.map(o => `<option>${esc(o)}</option>`).join("")}</select>`
      : `<textarea id="${name}" name="${name}" rows="2"></textarea>`}`;
  };
  return page("A question for you", `${pickHeader(pick)}
<p>${qs.length === 1 ? "One question" : `${qs.length} questions`} only you can answer. Nothing was sent.</p>
<form method="post">${qs.map(field).join("")}<p><button class="primary" type="submit">Save and continue</button></p></form>
<p class="note">Your answers are saved to draft for this application. ${pick.review ? "The form then waits for your review." : "draft then sends it."}</p>`);
}

// ── mount ────────────────────────────────────────────────────────────────────────────────────

/**
 * @param deps { secret (pickSecret(SESSION_SECRET)), startPickRun, saveAnswers, generateResume (Make it now), startAutoRun? , env? }
 */
export default function picksConfirmRoutes(app, db, requireAuth, deps) {
  const form = express.urlencoded({ extended: false, limit: "32kb" });

  app.get("/p/confirm/:token", (req, res) => {
    const nowSec = now();
    let r;
    try { r = resolve(db, deps.secret, req.params.token, nowSec); } catch { r = { ok: false, status: 404, html: message("This link is not valid", "Open draft to see your picks.") }; }
    if (!r.ok) return send(res, r.status, r.html);
    try {
      if (r.kind === "all") return send(res, 200, renderAll(db, r));
      if (r.kind === "answer") return send(res, 200, renderAnswer(db, r));
      return send(res, 200, renderPick(db, deps.secret, r, nowSec));
    } catch (e) { return send(res, 500, message("Something went wrong", "Open draft to see your picks.")); }
  });

  app.post("/p/confirm/:token", form, (req, res) => {
    const nowSec = now();
    let r;
    try { r = resolve(db, deps.secret, req.params.token, nowSec); } catch { r = { ok: false, status: 404, html: message("This link is not valid", "Open draft to see your picks.") }; }
    if (!r.ok) return send(res, r.status, r.html);
    try {
      if (r.kind === "pass") {
        const out = passPick(db, r.pick.user_id, r.pick.id, nowSec);
        return send(res, out.ok ? 200 : 409, out.ok ? message("Passed", "It will not be offered again.")
          : page("Already done", `${pickHeader(r.pick)}<p>${esc(doneText(db.prepare(`SELECT * FROM picks WHERE id = ?`).get(r.pick.id)))}</p>`));
      }
      if (r.kind === "apply" || r.kind === "all") {
        const out = r.kind === "all" ? applyAll(db, deps, r.run.user_id, r.run.id, nowSec) : applyPicks(db, deps, r.pick.user_id, [r.pick.id], nowSec);
        if (out.ok) {
          const n = out.applied.length;
          return send(res, 200, message(out.review ? "Filling it now" : "Sending it now",
            out.review ? `draft is filling ${n === 1 ? "the application" : `${n} applications`}. Review ${n === 1 ? "it" : "them"} in draft before anything is sent.`
              : `draft is applying to ${n === 1 ? "this job" : `${n} jobs`}. A question only you can answer comes back to you.`));
        }
        if (out.error === "already_done") return send(res, 409, message("Already done", "This pick has already been answered."));
        if (out.error === "expired") return send(res, 410, message("This link has expired", "Picks last until your next run time."));
        return send(res, out.status >= 400 ? out.status : 409, message("It could not start", `${out.message || out.error}. Open draft to try again.`));
      }
      if (r.kind === "answer") {
        const { pick, payload } = r;
        const answers = {};
        for (let i = 0; i < 50; i++) {
          const q = req.body?.[`q${i}`], a = req.body?.[`a${i}`];
          if (q == null) break;
          if (String(a ?? "").trim()) answers[String(q).slice(0, 500)] = String(a).slice(0, 2000);
        }
        // MAX(…, question_sent_at): the round counts as answered even if a clock reads earlier than the send.
        const claimed = db.prepare(`UPDATE picks SET question_answered_at = MAX(?, question_sent_at) WHERE id = ? AND question_sent_at = ?
          AND (question_answered_at IS NULL OR question_answered_at < question_sent_at)`).run(nowSec, pick.id, payload.n).changes === 1;
        if (!claimed) return send(res, 409, message("Already answered", "Thank you. draft continues with this application."));
        const planTier = db.prepare(`SELECT plan_tier FROM users WHERE id = ?`).pluck().get(pick.user_id);
        const out = deps.saveAnswers(pick.user_id, planTier, { answers, retryJobIds: [pick.job_id], approvalMode: pick.review ? null : "auto" });
        if (out.status === 400) {
          // Nothing usable was typed: the link stays open for another try.
          db.prepare(`UPDATE picks SET question_answered_at = NULL WHERE id = ?`).run(pick.id);
          return send(res, 400, message("Nothing was saved", "Type an answer to each question and press Save again."));
        }
        if (out.status >= 200 && out.status < 300) return send(res, 200, message("Saved", "Thank you. draft continues with this application."));
        return send(res, 200, message("Saved", `Your answers are saved. ${out.body?.message || "Open draft to continue this application."}`));
      }
      return send(res, 404, message("This link is not valid", "Open draft to see your picks."));
    } catch (e) { return send(res, 500, message("Something went wrong", "Nothing was sent. Open draft to try again.")); }
  });

  // ── the API ──

  const stateOf = (userId, nowSec = now()) => {
    const u = db.prepare(`SELECT send_mode, auto_settings, auto_last_run_at FROM users WHERE id = ?`).get(userId) || {};
    const settings = readAutoSettings(u.auto_settings);
    const mode = u.send_mode === "auto" ? "apply" : settings.picks === true ? "ask" : "off";
    const nextRunAt = mode === "off" ? null : nextSlotAfter(lastSlotAt(nowSec, settings), settings, localClock);
    return { mode, held: userHeld(db, userId), nextRunAt, runTimes: settings.runTimes, timeZone: settings.timeZone, dailyCap: settings.dailyCap,
      showFormBeforeSending: settings.showFormBeforeSending === true, reasons: LEFT_OUT_REASONS };
  };

  app.get("/api/picks/state", requireAuth, (req, res) => res.json(stateOf(req.user.id)));

  app.post("/api/picks/mode", requireAuth, (req, res) => {
    const mode = req.body?.mode;
    if (!["ask", "apply", "off"].includes(mode)) return res.status(400).json({ error: "bad_mode", message: 'POST {"mode": "ask" | "apply" | "off"}.' });
    if (mode === "apply" && fullAutoDisabled(db, deps.env || process.env)) {
      return res.status(409).json({ error: "full_auto_disabled", message: "Automatic sending is paused by the operator, so Apply for me cannot be chosen right now." });
    }
    const raw = (() => { try { return JSON.parse(db.prepare(`SELECT auto_settings FROM users WHERE id = ?`).pluck().get(req.user.id) || "{}") || {}; } catch { return {}; } })();
    const settings = readAutoSettings(JSON.stringify(raw));
    const picks = mode === "ask" ? true : mode === "off" ? false : settings.picks;
    // savedAt is kept as it was, so switching mode does not make a run time already past today fire.
    db.prepare(`UPDATE users SET send_mode = ?, auto_settings = ? WHERE id = ?`)
      .run(mode === "apply" ? "auto" : "semi", JSON.stringify({ ...settings, picks, savedAt: raw.savedAt ?? now() }), req.user.id);
    res.json(stateOf(req.user.id));
  });

  app.get("/api/picks/runs", requireAuth, (req, res) => {
    res.json({ runs: listRuns(db, req.user.id, { limit: req.query.limit, before: req.query.before || null }), state: stateOf(req.user.id) });
  });

  app.get("/api/picks/runs/:id/left-out", requireAuth, (req, res) => {
    const r = leftOutFor(db, req.user.id, req.params.id);
    if (!r) return res.status(404).json({ error: "not_found" });
    res.json(r);
  });

  const apiReply = (res, out, userId, pickId) => res.status(out.ok ? (out.status || 200) : out.status).json({
    ...out, ...(pickId ? { pick: publicPick(db.prepare(`SELECT * FROM picks WHERE id = ? AND user_id = ?`).get(pickId, userId) || {}) } : {}) });

  app.post("/api/picks/:id/apply", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare(`SELECT 1 FROM picks WHERE id = ? AND user_id = ?`).get(id, req.user.id)) return res.status(404).json({ error: "not_found" });
    apiReply(res, applyPicks(db, deps, req.user.id, [id]), req.user.id, id);
  });

  app.post("/api/picks/:id/pass", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare(`SELECT 1 FROM picks WHERE id = ? AND user_id = ?`).get(id, req.user.id)) return res.status(404).json({ error: "not_found" });
    apiReply(res, passPick(db, req.user.id, id), req.user.id, id);
  });

  app.post("/api/picks/:id/resume", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const out = await makePickResume(db, deps, req.user.id, id);
    if (out.status === 404) return res.status(404).json({ error: "not_found" });
    apiReply(res, out, req.user.id, id);
  });

  app.post("/api/picks/runs/:id/apply-all", requireAuth, (req, res) => {
    const out = applyAll(db, deps, req.user.id, Number(req.params.id));
    const run = db.prepare(`SELECT * FROM picks_runs WHERE id = ? AND user_id = ?`).get(Number(req.params.id), req.user.id);
    res.status(out.ok ? 202 : out.status).json({ ...out, ...(run ? { run: publicRun(db, run) } : {}) });
  });
}

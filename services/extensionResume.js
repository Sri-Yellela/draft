// services/extensionResume.js — ⭐ D98 P1 · A RÉSUMÉ GENERATED ON THE PAGE, the server's half.
//
// The extension asks draft's server for a tailored résumé for the job its tab is bound to. It never calls a model
// and never calls the tools service: this file calls the SAME generation the web app's Generate uses (server.js passes
// coreGenerateResume in as `generate`), so the claim guard and the ATS scorer run, the result is stored as a normal
// tailored résumé linked to the job, and a Draft slot is spent. D17 holds: résumé generation is the one model call.
//
// ⛔ USER-TRIGGERED ONLY. Nothing here runs on a timer, at boot or on a read: a generation exists only because
// POST /api/extension/resume was sent from a click (routes/extensionResume.js refuses a request without the
// click's `trigger`). A GET never starts one.
//
// THE LIFE OF ONE GENERATION (extension_resume_generations, migration 165):
//   queued ──► generating ──► ready
//     │            ├────────► refused     (the claim guard withheld it: nothing stored, nothing attached)
//     │            ├────────► failed      (the tools service or the store failed — one fixed sentence)
//     └────────────┴────────► cancelled   (the user's Cancel)
//
// ⛔ THE SLOT RULE (D98 §3; the P0 report §8 states it in full):
//   · SPENT when the generation starts — the draft_slot_uses row is written in the same transaction as the queued
//     row, so a double click cannot spend twice;
//   · ONCE per (job, base-résumé hash): the same request again returns the same generation and spends nothing; a
//     résumé already made for this job from this base (the web's Generate) is reused for nothing, as the web does;
//   · REFUNDED (the row deleted — draftSlots counts rows) on a cancel while queued, a cancel that lands before the
//     model call is sent, any server failure, and — provisional, owner decides — a claim-guard refusal;
//   · KEPT on a cancel after the model call was sent: the work was done; nothing is stored or attached.
//
// ⛔ NO MONEY, TOKEN COUNTS, MODEL NAMES OR TOOL NAMES reach the user: every response is built here from named fields
// and then passed through userSafe(), which drops the cost-visibility keys at every depth. Errors are one of
// USER_ERRORS — never an upstream message.
import crypto from "node:crypto";
import { draftSlots, slotsExhausted } from "./draftSlots.js";
import { hashBase } from "./baseResumeHistory.js";
import { getBaseResumeRecord } from "./simpleApplyProfile.js";
import { compareResumes } from "./resumeChanges.js";
import { listProfileClaims } from "./profileSignalAggregator.js";
import { jobOnUsersBoard } from "./manualHandoff.js";
import { USER_HIDDEN_GENERATION_FIELDS } from "./costVisibility.js";
import { sanitiseResumeHtml } from "./resumePreviewSanitiser.js";
import { findPdf, storePdf, readPdf, linkPdfToRecord, PdfStoreError } from "./resumePdfArtifacts.js";

// ── ⚠ PROVISIONAL — THE OWNER DECIDES (D98 §9). The spec's recommendations, as named constants. ─────────────────
/** ⚠ provisional, owner decides: the attached file's name — `FirstName_LastName_Company_Role.pdf`, letters/digits/_ only. */
export const PDF_FILE_NAME_PATTERN = "FirstName_LastName_Company_Role.pdf";
/** ⚠ provisional, owner decides: Attach also keeps the version (is_kept) and makes it the job's current résumé. */
export const ATTACH_SAVES_VERSION = true;
/** ⚠ provisional, owner decides: Regenerate spends another slot, and the response says so in plain words. */
export const REGENERATE_SPENDS_SLOT = true;
/** ⚠ provisional, owner decides: a claim-guard refusal gives the slot back (the web's Generate charges nothing for one). */
export const REFUND_ON_GUARD_REFUSAL = true;
export const REGENERATE_WARNING = "Generating again uses another of your drafts.";
/** ⚠ provisional: generations run at most this many at once across the server; the rest wait as `queued`. */
export const MAX_CONCURRENT_GENERATIONS = 2;

export const STATUSES = Object.freeze(["queued", "generating", "ready", "refused", "failed", "cancelled"]);

/** ⛔ The only words a user is ever shown when something goes wrong — a small fixed set, no upstream text. */
export const USER_ERRORS = Object.freeze({
  unavailable:       { status: 503, message: "Résumé generation is unavailable right now." },
  not_your_job:      { status: 404, message: "This job is not on your board." },
  no_job:            { status: 400, message: "Open a job you captured first." },
  no_base_resume:    { status: 409, message: "Upload your résumé in draft first." },
  slots_exhausted:   { status: 429, message: "You have used all of your drafts for the last 24 hours." },
  plan_limit:        { status: 429, message: "You have reached your plan's résumé limit for now." },
  upgrade_required:  { status: 403, message: "Résumé generation is not part of your plan." },
  rate_limited:      { status: 429, message: "Too many requests — wait a minute and try again." },
  not_found:         { status: 404, message: "There is no such résumé." },
  not_ready:         { status: 409, message: "This résumé is not ready yet." },
  extension_only:    { status: 403, message: "This is for the draft extension." },
  trigger_required:  { status: 400, message: "Generating a résumé starts from a click." },
  pdf_unavailable:   { status: 503, message: "The PDF could not be made right now." },
});

export class GenerationCancelledError extends Error {
  /** `stage`: "before_model" (nothing was sent — the slot goes back) or "after_model" (the work was done). */
  constructor(stage) { super("generation cancelled"); this.name = "GenerationCancelledError"; this.stage = stage; }
}

export function userError(key, extra = {}) {
  const e = USER_ERRORS[key] || USER_ERRORS.unavailable;
  return { status: e.status, body: { error: e.message, code: USER_ERRORS[key] ? key : "unavailable", ...extra } };
}

/** Drops every cost-visibility key at every depth (services/costVisibility.js names them). */
export function userSafe(value) {
  if (Array.isArray(value)) return value.map(userSafe);
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([k]) => !USER_HIDDEN_GENERATION_FIELDS.includes(k))
    .map(([k, v]) => [k, userSafe(v)]));
}

/**
 * ⭐ T6 (field report 10-14) · WHY a generation failed, as "<stage>:<code>" — stored in `cause` (migration 167) and shown in
 * the extension's "Show details" view, never in the user's sentence. A CODE, never a message: the owner's failure was the
 * tools service refusing the model call ("tools_service:upstream_model_failure"), which read as "unavailable" like a crash.
 *   stage  tools_service (a ToolsServiceError, or a code the service names) · job · server
 */
export function causeOf(e) {
  const code = (v) => (typeof v === "string" && /^[a-z][a-z0-9_]{0,47}$/.test(v) ? v : null);
  const c = code(e?.code);
  if (c === "job_vanished") return "job:job_vanished";
  if (e?.name === "ToolsServiceError" || (c && /^(tools_service_|upstream_|model_|auth_unconfigured|limit_exceeded|internal_error|invalid_request)/.test(c))) {
    // ⭐ T19 (10-15): "upstream_model_failure" covered both production failures — the account out of credit (10-14) and a
    // key not scoped to a workspace (10-15) — and neither is fixable by a retry or by the user. The provider's message is
    // read HERE, once, to pick a fixed code; the message itself is never stored or sent on.
    if (c === "upstream_model_failure") {
      const m = String(e?.message || "");
      if (/not scoped to a workspace|anthropic-workspace-id|invalid x-api-key|authentication_error|permission_error/i.test(m)) return "tools_service:model_key_rejected";
      if (/credit balance|billing/i.test(m)) return "tools_service:model_billing_refused";
    }
    return `tools_service:${c || "error"}`;
  }
  return `server:${c || code(String(e?.name || "").toLowerCase()) || "error"}`;
}

/** The stored cause, read back as { stage, code } — or null. */
export function causeView(cause) {
  const m = typeof cause === "string" ? cause.match(/^([a-z_]{1,24}):([a-z0-9_]{1,48})$/) : null;
  return m ? { stage: m[1], code: m[2] } : null;
}

/** `FirstName_LastName_Company_Role.pdf` — ASCII letters, digits and underscores only (⚠ provisional pattern). */
export function pdfFileName({ firstName, lastName, company, role } = {}) {
  const part = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const name = [firstName, lastName, company, role].map(part).filter(Boolean).join("_").replace(/_+/g, "_");
  return `${name || "Resume"}.pdf`;
}

/** A per-key sliding-window limiter (in memory: a restart forgets it, which only ever lets a request through). */
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const list = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (list.length >= limit) { hits.set(key, list); return false; }
    list.push(t); hits.set(key, list);
    return true;
  };
}

const sha = (s) => crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
const parseJson = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

/** The base résumé a generation is made from — the active job profile's, else the account's — as coreGenerateResume reads it. */
export function baseResumeFor(db, userId) {
  const profile = db.prepare("SELECT id FROM domain_profiles WHERE user_id=? AND is_active=1").get(userId);
  const rec = profile ? getBaseResumeRecord(db, { userId, profileId: profile.id }) : getBaseResumeRecord(db, userId);
  const text = String(rec?.content ?? "").trim();
  if (text.length < 100) return null;
  if ([/your name/i, /your\.email@example/i, /\[your name\]/i].some(p => p.test(text.slice(0, 300)))) return null;
  return { text, hash: hashBase(text), profileId: profile?.id ?? null };
}

/**
 * @param {object} deps
 *   db
 *   generate({ userId, jobId, job, isCancelled }) → { version, html, atsScore, baseAtsScore, atsReport }  (server.js:
 *       coreGenerateResume with the web route's A+ swap; throws ToolsServiceError / ResumeStoreError / GenerationCancelledError)
 *   preflight(userId) → null | USER_ERRORS key       (tools service configured, the plan's tool, the plan's limit)
 *   renderPdf(html) → Buffer                          (server.js htmlToPdf)
 *   guardFindings(userId, html) → string[]            (draft's additive check on what it serves — optional)
 *   defer(fn)                                         (how the queue is pumped; setImmediate by default)
 */
export function createExtensionResumeService({ db, generate, preflight = () => null, renderPdf, guardFindings = () => [],
  defer = (fn) => setImmediate(fn), concurrency = MAX_CONCURRENT_GENERATIONS, log = console } = {}) {
  const queue = [];
  let running = 0;
  const cancelledNow = new Set();

  const row = (id) => db.prepare("SELECT * FROM extension_resume_generations WHERE id = ?").get(id) || null;
  const own = (userId, id) => db.prepare("SELECT * FROM extension_resume_generations WHERE id = ? AND user_id = ?").get(String(id ?? ""), userId) || null;

  function refund(id, reason) {
    return db.transaction(() => {
      const r = row(id);
      if (!r || r.slot_use_id == null || r.slot_refunded_at != null) return false;
      db.prepare("DELETE FROM draft_slot_uses WHERE id = ? AND user_id = ?").run(r.slot_use_id, r.user_id);
      db.prepare("UPDATE extension_resume_generations SET slot_refunded_at = unixepoch(), refund_reason = ? WHERE id = ?").run(String(reason).slice(0, 120), id);
      return true;
    })();
  }

  // A queued or running generation does not survive a restart (the queue is in memory): it failed on our side, so
  // its slot goes back. This is recovery, not a start — it never begins a generation.
  try {
    for (const r of db.prepare("SELECT id FROM extension_resume_generations WHERE status IN ('queued','generating')").all()) {
      db.prepare("UPDATE extension_resume_generations SET status = 'failed', error_code = 'unavailable', finished_at = unixepoch() WHERE id = ?").run(r.id);
      try { db.prepare("UPDATE extension_resume_generations SET cause = 'server:restarted' WHERE id = ?").run(r.id); } catch { /* before migration 167 */ }
      refund(r.id, "server restarted before it finished");
    }
  } catch (e) { if (!/no such table/.test(String(e?.message))) throw e; }

  function pump() {
    while (running < concurrency && queue.length) {
      const id = queue.shift();
      running++;
      run(id).catch(e => log.error?.("[extension-resume] runner:", e?.message)).finally(() => { running--; defer(pump); });
    }
  }

  async function run(id) {
    // queued → generating, only if still queued (a Cancel may have landed first)
    if (db.prepare("UPDATE extension_resume_generations SET status = 'generating', started_at = unixepoch() WHERE id = ? AND status = 'queued'").run(id).changes === 0) return;
    const g = row(id);
    const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(g.job_id);
    const isCancelled = () => cancelledNow.has(id) || row(id)?.status === "cancelled";
    try {
      if (!job) throw Object.assign(new Error("job vanished"), { code: "job_vanished" });
      const result = await generate({ userId: g.user_id, jobId: g.job_id, job, isCancelled });
      if (isCancelled()) return;          // the generate dep stored it before the cancel was seen; it stays unattached
      db.prepare(`UPDATE extension_resume_generations SET status = 'ready', resume_version = ?, score_before = ?, score_after = ?,
        guard_json = ?, finished_at = unixepoch() WHERE id = ? AND status = 'generating'`)
        .run(result.version ?? null, result.baseAtsScore ?? null, result.atsScore ?? null, JSON.stringify({ passed: true }), id);
    } catch (e) {
      if (e instanceof GenerationCancelledError || e?.name === "GenerationCancelledError") {
        if (e.stage === "before_model") refund(id, "cancelled before the work began");
        return;
      }
      if (e?.code === "resume_claim_violation") {
        const reasons = (e.violations || []).map(v => typeof v === "string" ? v : v?.message).filter(Boolean).slice(0, 12);
        db.prepare("UPDATE extension_resume_generations SET status = 'refused', guard_json = ?, finished_at = unixepoch() WHERE id = ? AND status = 'generating'")
          .run(JSON.stringify({ passed: false, reasons }), id);
        if (REFUND_ON_GUARD_REFUSAL) refund(id, "withheld by the claim guard");
        return;
      }
      log.error?.(`[extension-resume] generation ${id} failed:`, e?.code || e?.name, String(e?.message || "").slice(0, 200));
      db.prepare("UPDATE extension_resume_generations SET status = 'failed', error_code = 'unavailable', finished_at = unixepoch() WHERE id = ? AND status = 'generating'").run(id);
      // T6: the cause, apart from the user's sentence (a database before migration 167 simply does not keep it)
      try { db.prepare("UPDATE extension_resume_generations SET cause = ? WHERE id = ?").run(causeOf(e), id); } catch { /* before 167 */ }
      refund(id, "server failure");
    } finally {
      cancelledNow.delete(id);
    }
  }

  function allowance(userId) {
    try { const s = draftSlots(db, userId); return { used: s.used, limit: s.limit, remaining: s.remaining, nextFreeAt: s.nextFreeAt, windowHours: s.windowHours }; }
    catch { return null; }
  }

  /** The newest version for this job made from THIS base — a résumé the web app (or an earlier run) already made. */
  function existingVersionFromBase(userId, jobId, baseHash) {
    try {
      return db.prepare(`SELECT v.version, v.ats_score, v.base_ats_score FROM resume_versions v
        JOIN base_resume_uploads u ON u.id = v.base_upload_id
        WHERE v.user_id = ? AND v.job_id = ? AND u.content_hash = ? ORDER BY v.version DESC LIMIT 1`).get(userId, jobId, baseHash) || null;
    } catch { return null; }
  }

  /**
   * Starts (or returns) the generation for this job. `jobId` must be the user's own job or live on the board (D99:
   * a tab the board opened — manualHandoff.js jobOnUsersBoard).
   * → { status, body } for the route.
   */
  function start(userId, { jobId, regenerate = false }) {
    if (!jobId) return userError("no_job");
    const id = String(jobId).slice(0, 128);
    if (!jobOnUsersBoard(db, userId, id)) return userError("not_your_job");
    const base = baseResumeFor(db, userId);
    if (!base) return userError("no_base_resume");

    const live = db.prepare(`SELECT * FROM extension_resume_generations WHERE user_id = ? AND job_id = ? AND base_hash = ?
      AND superseded_at IS NULL AND status IN ('queued','generating','ready') ORDER BY created_at DESC LIMIT 1`).get(userId, id, base.hash);
    // ⛔ ONCE per (job, base): the same request returns the same generation and spends nothing. Regenerate while one is
    // still running returns that one too — a second click must never be a second spend.
    if (live && (!regenerate || live.status !== "ready")) return { status: 200, body: view(live, { reusedRequest: true }) };
    if (!live && !regenerate) {
      const made = existingVersionFromBase(userId, id, base.hash);
      if (made) {
        const gid = newId();
        db.prepare(`INSERT INTO extension_resume_generations (id, user_id, job_id, base_hash, status, reused, resume_version, score_before, score_after, guard_json, started_at, finished_at)
          VALUES (?, ?, ?, ?, 'ready', 1, ?, ?, ?, ?, unixepoch(), unixepoch())`)
          .run(gid, userId, id, base.hash, made.version, made.base_ats_score ?? null, made.ats_score ?? null, JSON.stringify({ passed: true }));
        return { status: 200, body: view(row(gid)) };
      }
    }
    const refused = preflight(userId);
    if (refused) return userError(refused, { allowance: allowance(userId) });
    const slots = draftSlots(db, userId);
    if (slots.remaining <= 0) {
      const s = slotsExhausted(slots);
      return userError("slots_exhausted", { allowance: allowance(userId), detail: s.message });
    }
    const gid = newId();
    db.transaction(() => {
      if (live && regenerate) db.prepare("UPDATE extension_resume_generations SET superseded_at = unixepoch() WHERE id = ?").run(live.id);
      const slotId = db.prepare("INSERT INTO draft_slot_uses (user_id, kind, job_id) VALUES (?, 'generate', ?)").run(userId, id).lastInsertRowid;
      db.prepare(`INSERT INTO extension_resume_generations (id, user_id, job_id, base_hash, status, regenerate, slot_use_id)
        VALUES (?, ?, ?, ?, 'queued', ?, ?)`).run(gid, userId, id, base.hash, regenerate ? 1 : 0, slotId);
    })();
    queue.push(gid);
    defer(pump);
    return { status: 202, body: { ...view(row(gid)), ...(regenerate && REGENERATE_SPENDS_SLOT ? { warning: REGENERATE_WARNING } : {}) } };
  }

  function cancel(userId, id) {
    const g = own(userId, id);
    if (!g) return userError("not_found");
    if (g.status === "queued") {
      db.prepare("UPDATE extension_resume_generations SET status = 'cancelled', cancelled_at = unixepoch(), finished_at = unixepoch() WHERE id = ? AND status = 'queued'").run(g.id);
      const i = queue.indexOf(g.id); if (i >= 0) queue.splice(i, 1);
      refund(g.id, "cancelled before the work began");
      return { status: 200, body: view(row(g.id)) };
    }
    if (g.status === "generating") {
      cancelledNow.add(g.id);
      db.prepare("UPDATE extension_resume_generations SET status = 'cancelled', cancelled_at = unixepoch(), finished_at = unixepoch() WHERE id = ? AND status = 'generating'").run(g.id);
      return { status: 200, body: view(row(g.id)) };
    }
    return { status: 409, body: { ...userError("not_ready").body, error: "This résumé can no longer be cancelled.", code: "not_cancellable", generation: view(g) } };
  }

  function versionRow(g) {
    if (g.resume_version == null) return null;
    return db.prepare("SELECT * FROM resume_versions WHERE user_id = ? AND job_id = ? AND version = ?").get(g.user_id, g.job_id, g.resume_version) || null;
  }

  function changesFor(g, v) {
    try {
      const upload = v.base_upload_id ? db.prepare("SELECT content, profile_id FROM base_resume_uploads WHERE id = ? AND user_id = ?").get(v.base_upload_id, g.user_id) : null;
      if (!upload) return null;
      const claims = upload.profile_id != null ? listProfileClaims(db, { userId: g.user_id, profileId: upload.profile_id }) : { skills: [] };
      const out = compareResumes({ before: upload.content, after: v.html, base: upload.content, claims, afterReport: parseJson(v.ats_report) });
      return { summary: out.summary, sections: out.sections, roleChanges: out.roleChanges };
    } catch (e) { log.warn?.("[extension-resume] change set:", e?.message); return null; }
  }

  /** The user's view of one generation — named fields only. */
  function view(g, { reusedRequest = false } = {}) {
    const job = db.prepare("SELECT job_id, title, company FROM scraped_jobs WHERE job_id = ?").get(g.job_id) || { job_id: g.job_id };
    const out = {
      id: g.id, status: g.status,
      job: { jobId: String(job.job_id), title: job.title ?? null, company: job.company ?? null },
      createdAt: g.created_at, startedAt: g.started_at ?? null, finishedAt: g.finished_at ?? null,
      regenerated: !!g.regenerate, fromExisting: !!g.reused, ...(reusedRequest ? { alreadyRequested: true } : {}),
      slot: { spent: g.slot_use_id != null && g.slot_refunded_at == null, refunded: g.slot_refunded_at != null },
      allowance: allowance(g.user_id),
      openUrl: `/app/jobs?job=${encodeURIComponent(g.job_id)}`,
    };
    const guard = parseJson(g.guard_json);
    if (g.status === "refused") out.guard = { passed: false, reasons: guard?.reasons || [] };
    if (g.status === "failed") {
      out.error = { code: "unavailable", message: USER_ERRORS.unavailable.message };
      // T6: the code behind it, for the extension's "Show details" view only — the panel never shows it
      const cause = causeView(g.cause);
      if (cause) out.cause = cause;
    }
    if (g.status === "ready") {
      const v = versionRow(g);
      if (!v) { out.status = "failed"; out.error = { code: "unavailable", message: USER_ERRORS.unavailable.message }; return userSafe(out); }
      out.preview = { html: sanitiseResumeHtml(v.html).html };
      out.score = { before: g.score_before ?? v.base_ats_score ?? null, after: g.score_after ?? v.ats_score ?? null };
      out.changes = changesFor(g, v);
      let findings = [];
      try { findings = (guardFindings(g.user_id, v.html) || []).map(f => typeof f === "string" ? f : f?.message).filter(Boolean); } catch { findings = []; }
      out.guard = { passed: true, findings };
      const pdf = findPdf(db, g.user_id, g.id, sha(v.html));
      out.pdf = pdf ? pdfView(g, pdf) : null;
    }
    return userSafe(out);
  }

  function pdfView(g, pdf) {
    return { fileName: pdf.file_name, bytes: pdf.byte_size, attached: pdf.attached_at != null, keptWithApplication: pdf.record_id != null,
      url: `/api/extension/resume/${encodeURIComponent(g.id)}/pdf/file` };
  }

  function get(userId, id) {
    const g = own(userId, id);
    return g ? { status: 200, body: view(g) } : userError("not_found");
  }

  /** Renders (once) and stores the PDF; with `attach`, marks it attached, keeps the version and links the snapshot. */
  async function pdf(userId, id, { attach = false } = {}) {
    const g = own(userId, id);
    if (!g) return userError("not_found");
    if (g.status !== "ready") return userError("not_ready");
    const v = versionRow(g);
    if (!v) return userError("not_ready");
    const htmlSha = sha(v.html);
    let stored = findPdf(db, userId, g.id, htmlSha);
    if (!stored) {
      const profile = db.prepare("SELECT first_name, last_name, full_name FROM user_profile WHERE user_id = ?").get(userId) || {};
      const [first, ...rest] = String(profile.full_name || "").trim().split(/\s+/);
      const job = db.prepare("SELECT title, company FROM scraped_jobs WHERE job_id = ?").get(g.job_id) || {};
      const fileName = pdfFileName({ firstName: profile.first_name || first, lastName: profile.last_name || rest.at(-1),
        company: job.company ?? v.company, role: job.title ?? v.role });
      let bytes;
      try { bytes = await renderPdf(sanitiseResumeHtml(v.html).html); }
      catch (e) { log.error?.("[extension-resume] pdf render:", e?.code || e?.name, String(e?.message || "").slice(0, 200)); return userError("pdf_unavailable"); }
      try { stored = storePdf(db, { userId, jobId: g.job_id, generationId: g.id, version: g.resume_version, htmlSha256: htmlSha, fileName, pdf: bytes }); }
      catch (e) { log.error?.("[extension-resume] pdf store:", e instanceof PdfStoreError ? e.code : e?.message); return userError("pdf_unavailable"); }
    }
    if (attach) {
      db.transaction(() => {
        db.prepare("UPDATE resume_pdf_artifacts SET attached_at = unixepoch() WHERE id = ?").run(stored.id);
        if (ATTACH_SAVES_VERSION) keepVersion(userId, g.job_id, v);
      })();
      linkPdfToRecord(db, userId, stored.id);
      stored = db.prepare("SELECT id, file_name, byte_size, attached_at, record_id FROM resume_pdf_artifacts WHERE id = ?").get(stored.id);
    }
    return { status: 200, body: userSafe({ id: g.id, pdf: pdfView(g, stored) }) };
  }

  /** The same writes as POST /api/resumes/:jobId/keep: this version is kept and is the job's current résumé. */
  function keepVersion(userId, jobId, v) {
    db.prepare("UPDATE resume_versions SET is_kept = 0 WHERE user_id = ? AND job_id = ?").run(userId, jobId);
    db.prepare("UPDATE resume_versions SET is_kept = 1 WHERE id = ?").run(v.id);
    db.prepare(`UPDATE resumes SET html = ?, ats_score = ?, ats_report = ?, ats_cache_key = ?, ats_prompt_version = ?, base_ats_score = ?, updated_at = unixepoch()
      WHERE user_id = ? AND job_id = ?`).run(v.html, v.ats_score, v.ats_report, v.ats_cache_key, v.ats_prompt_version, v.base_ats_score, userId, jobId);
  }

  function pdfFile(userId, id) {
    const g = own(userId, id);
    if (!g) return null;
    const p = db.prepare("SELECT id FROM resume_pdf_artifacts WHERE user_id = ? AND generation_id = ? ORDER BY id DESC LIMIT 1").get(userId, g.id);
    return p ? readPdf(db, userId, p.id) : null;
  }

  return { start, get, cancel, pdf, pdfFile };
}

function newId() { return `erg_${crypto.randomBytes(12).toString("hex")}`; }

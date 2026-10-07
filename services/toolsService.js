/**
 * draft's client for the résumé tools service — the second product, Resume Master (A4).
 *
 * ⛔ THIS FILE (with services/toolsServiceRequests.js and contract/resume-master/) IS WHERE THE
 * OTHER PRODUCT IS NAMED, per docs/BRAND.md's vendor rule: here "Resume Master" is a third party's
 * name, as "Anthropic" is. Everything a draft USER can see says "the résumé tools service", and
 * server.js calls it toolsService — so the brand guard keeps its full force on server.js.
 *
 * ⛔ draft is a THIRD-PARTY CALLER here, holding a service token exactly as any other client would:
 * RESUME_MASTER_URL + RESUME_MASTER_TOKEN, no shared cookie, session secret or database. The API's
 * shape is the vendored, generated contract in contract/resume-master/ — this module sends the
 * request bodies it declares and reads the responses it declares, and test/toolsService.test.js
 * checks both against that contract.
 *
 * ⛔ PERSONAL DATA CROSSES THIS BOUNDARY. A résumé carries a home address, a phone number and an
 * employment history. Resume Master processes it and does not retain it (its docs/API.md), and
 * both privacy policies say so. Nothing here logs a request or response body.
 *
 * ── WHAT HAPPENS WHEN RESUME MASTER IS UNREACHABLE — decided in A4 ─────────────────────────────
 *
 *   generate / A+ / enhance   FAIL FAST, retryable, and say which service failed. Not queued: the
 *                             apply pipeline already holds a job whose generation failed for review
 *                             (held_review), and a silent queue would hold a user's approval
 *                             without telling them.
 *   parse-pdf                 DEGRADES to local text extraction (pdf-parse) — reduced quality,
 *                             never zero. Capture learned this: /api/import/job had a hard model
 *                             dependency and an unfunded balance took it to nothing.
 *   ATS scoring, the board,   UNAFFECTED — the scorer is a local package, not a network hop. That
 *   capture, autofill         is why it is a package.
 *
 * ⛔ A NON-RETRYABLE FAILURE SAYS SO. Every error thrown here is a ToolsServiceError carrying
 * `retryable` and `permanent` taken from Resume Master's own answer where it gave one — an
 * exhausted balance arrives as 502 with permanent:true, and inferring from the status (502 reads as
 * transient) would tell the user to retry a billing failure.
 */

import { trackApiCall } from "./usageTracker.js";

export class ToolsServiceError extends Error {
  constructor(message, { code, status = null, retryable, permanent, violations = null, usage = [] } = {}) {
    super(message);
    this.name = "ToolsServiceError";
    this.code = code;                     // "resume_claim_violation" keeps failureAttribution's meaning
    this.status = status;
    this.retryable = retryable;
    this.permanent = permanent;
    this.violations = violations;
    this.usage = usage;                   // spend Resume Master reports even on failure — meter it
  }
}

// The two 4xx statuses that mean "not now" rather than "fix the request" — the same pair
// shared/failureAttribution.js files as TRANSIENT_HTTP. 400/401/403/404/413/422 stay permanent.
const TRANSIENT_4XX = new Set([408, 429]);

const TIMEOUT_MS = { generate: 150_000, enhance: 120_000, "parse-pdf": 90_000, default: 20_000 };

export function createToolsServiceClient({
  baseUrl = process.env.RESUME_MASTER_URL,
  token = process.env.RESUME_MASTER_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const configured = !!(base && token);

  async function call(method, path, body, timeoutKey = "default") {
    if (!configured) {
      throw new ToolsServiceError("The résumé tools service is not configured on this server",
        // The setting names are for the operator and are logged at boot; this message reaches users.
        { code: "tools_service_unconfigured", retryable: false, permanent: true });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[timeoutKey] ?? TIMEOUT_MS.default);
    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      throw new ToolsServiceError(`The résumé tools service is unreachable: ${e.name === "AbortError" ? "timed out" : e.message}`,
        { code: "tools_service_unreachable", retryable: true, permanent: false });
    } finally { clearTimeout(timer); }

    // ⛔ A 200 IS NOT EVIDENCE. Before Phase B, resumemaster.one answers with draft's own HTML shell;
    // a misconfigured URL must read as misconfiguration, not as an empty answer.
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    let json = null;
    if (/^application\/json\b/.test(contentType)) { try { json = JSON.parse(text); } catch { /* handled below */ } }
    if (!json || typeof json !== "object") {
      // The setting name is for the operator's log, not the user's screen.
      console.warn(`[tools-service] ${method} ${path} answered ${res.status} ${contentType || "(no content type)"}, not JSON — check RESUME_MASTER_URL`);
      throw new ToolsServiceError(`The résumé tools service answered ${res.status} with ${contentType || "no content type"}, not JSON — ` +
        "its address is probably misconfigured", { code: "tools_service_bad_response", status: res.status,
        retryable: false, permanent: true });
    }
    if (res.ok) return json;
    // ⛔ A88: Resume Master's explicit verdict wins, field by field — and `retryable: true` on its
    // own IS a verdict. This used to infer `permanent` from `status < 500` whenever the body sent no
    // `permanent`, so the service's own 429 `{ error: "limit_exceeded", retryable: true }` was filed
    // permanent=yes, "retry will fail identically", beside a Retry button. Absent any verdict, a 408
    // (timeout) or 429 (rate limit) is "not now", not "never"; any other 4xx is ours to fix; a 5xx
    // may clear. The client does not retry on its own (no Retry-After handling — the service sends
    // none), so nothing here can loop: the verdict only says whether a PERSON's retry can work.
    const transientStatus = res.status >= 500 || TRANSIENT_4XX.has(res.status);
    const retryable = typeof json.retryable === "boolean" ? json.retryable : transientStatus;
    throw new ToolsServiceError(json.message || json.error || `The résumé tools service answered ${res.status}`, {
      code: json.error || "tools_service_error", status: res.status,
      retryable,
      permanent: typeof json.permanent === "boolean" ? json.permanent : !retryable,
      violations: json.violations ?? null, usage: Array.isArray(json.usage) ? json.usage : [],
    });
  }

  return {
    configured,
    version: () => call("GET", "/v1/version"),
    generate: (req) => call("POST", "/v1/resumes/generate", req, "generate"),
    enhance: (req) => call("POST", "/v1/resumes/enhance", req, "enhance"),
    parsePdf: (req) => call("POST", "/v1/resumes/parse-pdf", req, "parse-pdf"),
  };
}

/**
 * How a draft route answers its own caller when a Resume Master call failed. ⛔ Replaces the
 * `res.status(500).json({ error: e.message })` these routes used to send for every failure, which
 * gave an exhausted balance, an overload and a withheld résumé the same 500 and no retry advice.
 */
export function httpErrorFor(e, fallback = "The request failed") {
  if (e?.code === "resume_claim_violation") {
    return { status: 422, body: { error: "The generated résumé claimed more than your profile states, so it was withheld — nothing was saved or sent. Generating again may produce an honest one.",
      code: e.code, retryable: true, violations: (e.violations || []).map(v => v.message).filter(Boolean) } };
  }
  if (e instanceof ToolsServiceError) {
    const retryable = e.retryable === true && e.permanent !== true;
    const status = e.code === "invalid_request" ? 400 : e.code === "payload_too_large" ? 413 : 503;
    return { status, body: { error: e.message || fallback, code: e.code, retryable,
      ...(retryable ? {} : { detail: "Retrying will not help until this is fixed on the server." }) } };
  }
  return { status: 500, body: { error: fallback, code: "internal_error", retryable: false } };
}

/**
 * Records the service's usage records in usage_events — counts, never content — with the same
 * purpose/event_type draft's own calls used, so limitEnforcer and the admin cost panel keep working
 * unchanged. Returns the row id of the first record whose purpose matches `idFor` (resume_generate
 * needs it: the post-generation ATS score is filled in later by recordAtsOutcome).
 */
export function recordToolsServiceUsage(db, usage, { userId, eventSubtype = null, jobId = null,
                                                                    company = null, domainModule = null, atsScoreBefore = null, idFor = null,
                                                                    // e.g. { resume_generate: "standalone_generate" } — keeps a surface's
                                                                    // spend attributed as it was before the call moved
                                                                    renamePurpose = {},
                                                                    // A94: the failed REQUEST's code (e.g.
                                                                    // "resume_claim_violation"), passed from a
                                                                    // catch. A call that completed and was billed
                                                                    // stays success = 1 — the call did succeed —
                                                                    // but its row now says the request did not
                                                                    requestError = null } = {}) {
  let id = null;
  for (const u of Array.isArray(usage) ? usage : []) {
    if (!u || typeof u !== "object") continue;
    const purpose = renamePurpose[u.purpose] || u.purpose;
    const eventId = trackApiCall(db, {
      userId, eventType: purpose, eventSubtype, purpose, model: u.model, provider: "anthropic",
      usage: u, durationMs: u.duration_ms, success: u.success !== false,
      errorText: u.success === false ? "failed inside Resume Master"
        : (typeof requestError === "string" && requestError ? `request failed: ${requestError}` : null),
      jobId, company, domainModule,
      atsScoreBefore: u.purpose === idFor ? atsScoreBefore : null,
    });
    if (id === null && u.purpose === idFor) id = eventId;
  }
  return id;
}

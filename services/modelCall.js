// services/modelCall.js
// PURPOSE: The ONE path every Anthropic model call goes through, so that calling a model and
// recording what it cost cannot come apart.
//
// WHY THIS FILE EXISTS: an audit found cost observability covered 4 of 14 call sites. The other
// 10 — including per-job enrichment across hundreds of rows and three UNAUTHENTICATED standalone
// endpoints — spent real money and recorded nothing. The admin cost panel was not empty; it was
// confidently wrong, showing a total that omitted most of the traffic. A partial number nobody
// knows is partial is worse than no number.
//
// A wrapper alone would rot exactly the way the hardcoded model IDs did, so it ships with an
// absence guard (test/modelCallGuard.test.js) that fails the build if a bare
// anthropic.messages.create appears anywhere outside this module.
//
// TO ADD A CALL SITE: call callModel({ anthropic, db, model, purpose, userId, ...params }).
// `purpose` is required and should be a stable snake_case feature name — it is what lets spend be
// grouped by feature rather than only by model.

import { trackApiCall } from "./usageTracker.js";
import { assertOutboundFields } from "../shared/piiPolicy.js";

// ── ONE PROVIDER: ANTHROPIC ─────────────────────────────────────────────────────────────────────
//
// Every call this wrapper makes goes to the Anthropic SDK. There is no second provider.
//
// ⛔ A87 (10-05) DELETED THE GROQ/GEMINI STACK. shared/modelProviders.js (the free-tier catalog),
// services/providerTransport.js (their fetch adapters, pacing and max_tokens floor) and the
// ENRICH_PROVIDER / ENRICH_MODEL / GROQ_API_KEY / GOOGLE_API_KEY switches existed to route PUBLIC
// job-advert text — enrich_job, classify_job, import_job — to a free tier. D17 deleted all three
// model calls (A80 V4, V7; D33), so the route had no traffic left, and the provider-comparison
// script went with A80 V9.
//
// ── WHOSE DATA IT IS ─────────────────────────────────────────────────────────────────────────────
//
// A call site still declares WHAT it sends, because one class carries a guard:
//
// CANDIDATE — anything derived from a person: cover letters, domain-profile suggestions, the AL5
//             harness's untokenized arm. The default, so a site that declares nothing is CANDIDATE.
// TOKENIZED — a payload built from shared/piiPolicy.js's allow-list. callModel REFUSES to send it
//             unless every field passes assertOutboundFields; see below.
//
// PUBLIC is gone with the route it existed for. An unknown class (`"public"` included) is refused
// rather than read as CANDIDATE, so a stale declaration is a loud error, not a silent relabel.
export const DATA_CLASS = Object.freeze({
  /** Anything derived from a person: resumes, profiles, cover letters, parsed PDFs. */
  CANDIDATE: "candidate",
  /**
   * TASK F — a payload built from an explicit field ALLOW-LIST and tokenized, so it carries the
   * structure of a candidate's history without their identity. callModel refuses it unless the
   * whitelist assertion passes. See shared/piiPolicy.js.
   */
  TOKENIZED: "tokenized",
});

/** The provider recorded on every usage_events row this wrapper writes. */
const PROVIDER_ANTHROPIC = "anthropic";

// Background work — enrichment, import extraction, job classification, and the unauthenticated
// standalone endpoints — has no user in scope, but usage_events.user_id is NOT NULL REFERENCES
// users(id). id 0 can never collide with a real account because users.id is AUTOINCREMENT and
// starts at 1.
//
// It is NOT a bare sentinel: migration 075 inserts an actual 'system' users row for it.
// better-sqlite3 turns foreign_keys ON by default (no PRAGMA in this codebase — the default
// does it), so an id with no matching row is rejected outright. A real run proved that: every
// background insert failed with "FOREIGN KEY constraint failed", which would have left the
// single largest untracked spender still untracked while everything looked wired up.
export const SYSTEM_USER_ID = 0;

/**
 * Invoke a model and record its usage. Returns the message UNCHANGED, so adopting this at an
 * existing call site is a one-line edit and nothing downstream has to know.
 *
 * Failures are recorded too (success=0 with the upstream message). That is deliberate: the dead
 * claude-sonnet-4 model ID 404'd on every call for two months while the cost table simply showed
 * nothing, because a call that throws never reached the tracking line. A failed call is a fact
 * worth having. It does not affect quotas — services/limitEnforcer.js counts `success = 1` only.
 */
export async function callModel({
  anthropic,
  db,
  model,
  purpose,
  userId = SYSTEM_USER_ID,
  eventType = null,
  eventSubtype = null,
  jobId = null,
  company = null,
  domainModule = null,
  atsScoreBefore = null,
  atsScoreAfter = null,
  // AK1 — receives the usage_events row id once the call has been recorded.
  //
  // A CALLBACK RATHER THAN A RETURN VALUE, because callModel returns the model's message and every
  // one of its ~20 call sites destructures that. Changing the return shape to hand back an id that
  // exactly one caller wants would touch all of them. This fires from the same `finally` that
  // records the row, so it runs on success AND on failure, and a throwing callback cannot escape
  // into the caller's error path.
  onTracked = null,
  // WHOSE DATA THIS CALL SENDS. See the note at the top of this file. Defaults to CANDIDATE.
  dataClass = DATA_CLASS.CANDIDATE,
  // TASK F — the STRUCTURED payload a TOKENIZED prompt was rendered from. Required for that class
  // and asserted field-by-field against shared/piiPolicy.js before anything is sent. Not forwarded
  // to any provider; it exists to be checked.
  piiFields = null,
  ...params
} = {}) {
  if (!purpose) throw new Error("callModel: `purpose` is required — it is how spend is attributed to a feature");
  if (!model) throw new Error(`callModel(${purpose}): no model — import MODEL_SONNET/MODEL_HAIKU from shared/anthropicModels.js`);

  // Checked before the timer and outside the try: a bad declaration is a code error, not a call, so
  // no usage row is written for it.
  if (!Object.values(DATA_CLASS).includes(dataClass)) {
    throw new Error(
      `callModel(${purpose}): unknown dataClass "${dataClass}". Known: ${Object.values(DATA_CLASS).join(", ")}. ` +
      `PUBLIC was removed with the free-tier route (A87).`
    );
  }

  // ── TASK F: THE FIELD-LEVEL WHITELIST ASSERTION ON THE OUTBOUND PAYLOAD ────────────────────────
  //
  // Enforced HERE, in the one wrapper every call passes through, rather than at the call site that
  // built the payload — a guard living next to the code it guards is a guard that gets edited in
  // the same commit as the mistake.
  //
  // ⛔ IT REFUSES, IT DOES NOT SANITISE. Dropping the offending field would mean the send succeeds
  // and nobody ever learns the payload was wrong; the next payload built the same way would be
  // wrong too, silently. Refusing is the only outcome a caller cannot ignore.
  //
  // A TOKENIZED call with no declared fields is also refused: the class asserts a property, and a
  // call claiming it without supplying anything to check is claiming it vacuously.
  if (dataClass === DATA_CLASS.TOKENIZED) {
    if (!piiFields || typeof piiFields !== "object") {
      throw new Error(
        `callModel(${purpose}): dataClass TOKENIZED requires \`piiFields\` — the structured payload ` +
        `the prompt was rendered from. Without it there is nothing to assert, and the class would ` +
        `be a label rather than a guarantee.`
      );
    }
    assertOutboundFields(piiFields, { where: `callModel(${purpose})` });
  }
  if (!anthropic) throw new Error(`callModel(${purpose}): no anthropic client`);

  const startedAt = Date.now();
  let message = null;
  let success = true;
  let errorText = null;

  try {
    message = await anthropic.messages.create({ model, ...params });
    return message;
  } catch (e) {
    success = false;
    errorText = String(e?.message ?? e).slice(0, 500);
    throw e;
  } finally {
    // `finally` so a throw is still recorded, and so a tracking problem can never swallow the
    // model's own result or error — trackApiCall catches internally and counts its own failures.
    if (db) {
      const eventId = trackApiCall(db, {
        userId,
        // event_type keeps its existing vocabulary because limitEnforcer keys quotas on it;
        // purpose is the new, always-populated feature name. Sites that had no event_type before
        // fall back to purpose so the column is never empty for a new row.
        eventType: eventType || purpose,
        eventSubtype,
        purpose,
        model,
        // usage_events.provider (migration 096) stays populated; it is always anthropic now.
        provider: PROVIDER_ANTHROPIC,
        usage: message?.usage || {},
        durationMs: Date.now() - startedAt,
        jobId,
        company,
        domainModule,
        atsScoreBefore,
        atsScoreAfter,
        success,
        errorText,
      });
      if (typeof onTracked === "function") {
        // Swallowed on purpose. This is a measurement hook; it may not turn a successful
        // generation into a failure, nor replace the model's own error with its own.
        try { onTracked(eventId); } catch (hookError) {
          console.error(`[modelCall] onTracked hook threw for ${purpose}: ${hookError.message}`);
        }
      }
    }
  }
}

// ── IS THIS WORTH RETRYING? ─────────────────────────────────────────────────────────────────────
//
// "Could not import this job. Please try again" was shown for an EXHAUSTED BILLING BALANCE. No
// number of retries can clear that, so the message sent every user into a loop that could only
// fail, and told whoever read the report that capture was flaky rather than unfunded. A wrong
// remedy is worse than no remedy: it hides the real one.
//
// Lives here because this is the one path every model call passes through, so every caller can ask
// the same question and get the same answer. It classifies the CONDITION, not the feature — the
// import route was simply the first place the distinction mattered.
//
// ⛔ MATCHES ON THE PROVIDER'S OWN WORDING, which is fragile, so it fails SAFE: anything it does
// not recognise is treated as retryable, which is the status quo. A false "retryable" costs one
// pointless retry; a false "permanent" would tell a user to give up on a blip.
const PERMANENT_SIGNATURES = [
  /credit balance is too low/i,        // Anthropic, billing exhausted
  /insufficient[_ ]quota/i,            // quota consumed, not rate-limited
  /billing/i,
  /invalid[_ ]api[_ ]key/i,
  /authentication[_ ]error/i,
  /permission[_ ]error/i,
];

/**
 * True when retrying CANNOT succeed without a human changing something — funding an account,
 * fixing a key, granting access.
 *
 * ⛔ A 429 is NOT permanent. Rate limiting is the case retrying exists for, and it carries billing
 * words often enough ("quota") that it has to be excluded before the signature scan, not after.
 */
export function isPermanentModelFailure(err) {
  const status = err?.status ?? err?.statusCode ?? null;
  if (status === 429) return false;
  const text = `${err?.message ?? ""} ${err?.error?.message ?? ""}`;
  return PERMANENT_SIGNATURES.some(re => re.test(text));
}

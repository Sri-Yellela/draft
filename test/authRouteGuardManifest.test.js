import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * TASK AH1 — the guard on every /api route, enumerated, so a new one cannot skip it.
 *
 * WHY A MANIFEST AND NOT A SET OF SPOT CHECKS
 * scripts/ah1SessionIdentity.mjs proves cross-user access is denied on the endpoints IT NAMES.
 * That is the strong evidence, and it is also the weakness: a route added next month is not in its
 * list, so it is not checked, and nothing says so. FE-3 applied user scoping per endpoint for
 * tracked searches; whether that was universal or one-off was an open question in this task
 * precisely because no artefact recorded the answer for the whole surface.
 *
 * So this test enumerates every /api route from source and requires each one to appear in exactly
 * one of the three lists below. Add a route without classifying it and this test fails naming it.
 * That is the point: the failure is the design review.
 *
 * WHAT IT CAN AND CANNOT SEE
 * It reads guards, not behaviour — it cannot tell you a handler scoped its query correctly. The
 * harness does that. What this catches is the two mistakes a reviewer misses by eye: a route
 * mounted with NO guard at all, and a route whose guard is weaker than its siblings'.
 */

const SERVER = fs.readFileSync("server.js", "utf8");

// ── PUBLIC: reachable with no credential, deliberately ───────────────────────────────────────
// Every entry here is a decision. A route joins this list only if an unauthenticated stranger
// SHOULD be able to call it.
const PUBLIC = new Set([
  "GET /api/atlas/bar/:code",   // A154 (45s): a SHARED Beat-the-bar score — the person chose to share a link; it carries the score line and the role, nothing about who
  // D151 Rule 6 (45n; classified 45o): /api/diag answers ONLY a valid, unexpired 24-hour token (its hash stored, audited);
  // anything else is a 404. Public by route, gated by the token — the support read without an admin session.
  "GET /api/diag",
  // D179 step 4 (45l): the open board, company pages and the search dropdown — signed out by design, read-only, no user data.
  "GET /api/public/jobs",
  "GET /api/public/jobs/entry",   // A147 (45o): the signed-out /jobs entry — open-board aggregates only
  "GET /api/public/jobs/facets",
  "GET /api/public/companies",   // A144 (45o): the Companies tab's list — public facts only
  "GET /api/public/companies/:slug",
  "GET /api/public/suggest",
  "GET /api/public/company-stack",   // D192 (3): a company's public stack + industry for the tools service scoring on its own — the company pages' data, nothing personal
  // D150 T05–T06 (45l): the 3-minute audit — anonymous by design (a random token), nothing personal.
  "POST /api/audit/start",
  "POST /api/audit/:token/answer",
  "GET /api/audit/:token/result",
  "GET /api/health",
  // D151 Rule 1: liveness / readiness for Railway's healthcheck — no session, no user data.
  "GET /api/health/live",
  "GET /api/health/ready",
  // D150 T04: the audit's role card — public (the audit needs no sign-in); board aggregates only, no user data.
  "GET /api/audit/roles",
  "GET /api/audit/role/:slug",
  // D115: the owner's learning path — public like the Atlas it lives in; links and the owner's words only, no user data.
  "GET /api/learn/",
  // D117: the circle's links, taught terms, live P5 links and routes — the same public content, no user data.
  "GET /api/learn/circle",
  // D172 (2): the path as a course (modules, lessons, their links and register sources) — the same public content, no user data.
  "GET /api/learn/course/:id",
  // D172 (2b): the Library's guides and a deck — the approved decks' own words; a check question served without its answer.
  "GET /api/learn/guides",
  // ⭐ D155 Part C: the approved plan of pathways and topics — public, like the guides (no person's data).
  "GET /api/learn/pathways",
  "GET /api/learn/how-it-works",   // A154 (45o): each approved deck's idea as one flow — the decks' own words, public like them
  "GET /api/learn/deck/:id",
  // A deck's check answer: public like the deck (recorded with no user when signed out, as the audit's answers are); no points.
  "POST /api/learn/deck/:id/answer",
  "GET /api/auth/me",                      // reports authenticated:false rather than 401 by design
  "POST /api/auth/login",
  "POST /api/auth/register",
  "POST /api/auth/logout",                  // signing out must work even with a half-dead credential
  "GET /api/auth/oauth/status",
  "POST /api/auth/provider/:provider",
  "POST /api/auth/password-reset/request",
  "POST /api/auth/password-reset/confirm",
  // The monetisation lever's only client-facing reader. Anonymous BY NECESSITY: the pages carrying
  // the commercial copy (/pricing, /features, /how-it-works) render logged out, so the client must
  // learn the flag's value before it knows whether anyone is signed in. Behind auth, an anonymous
  // visitor would fall back to the safe default — hide — which would hide the pricing page from
  // logged-out visitors even with monetisation ON. It discloses one boolean about the product's
  // own configuration and nothing user-scoped. See shared/monetisation.js.
  "GET /api/config",
  // AH-1. Anonymous on purpose: its entire job is to answer "what is deployed?" from outside, and
  // a deploy check that needs credentials is one nobody runs. It discloses a short commit SHA, the
  // contract version and which migrations have applied — facts about the build, not about anyone's
  // data. The SHA is already public: this is an open deployment of a repository whose history the
  // owner controls, and knowing which commit is live is exactly what a reviewer, a mobile client
  // or a future reconciliation of docs/NEXT_WORK.md needs.
  "GET /api/version",
  "GET /api/domain-metadata",
  "GET /api/domain-metadata/:key",
  "POST /api/contact",
  // The landing page's job feed. Deliberately anonymous: scraped_jobs is a GLOBAL pool of public
  // postings with no user column, the query is capped at 20 rows a page, and the page it feeds is
  // reachable without an account. Nothing user-scoped is in scope for it to leak.
  "GET /api/jobs/generic",
  // D130: the standalone survey is for people with NO account (jobsviadraft.com/survey). The form is public; a response
  // is guarded by a honeypot, ≤ 5 an hour per address and one response per email (services/survey.js saveStandaloneSurvey).
  "GET /api/survey/form",
  "POST /api/survey",
  // A77: a company's stored LOGO, by company key. company_logos has no user column — a logo is a fact
  // about an employer, and the anonymous landing feed shows logos too. Image bytes only (raster, nosniff,
  // CSP default-src 'none').
  "GET /api/company-logo/:key",
  // Standalone tool pages: a separate, deliberately anonymous surface with its own
  // standalone_users table and its own rate limiting. Not the signed-in application.
  "POST /api/standalone/auth/google",
  "POST /api/standalone/auth/email-otp/send",
  "POST /api/standalone/auth/phone-otp/send",
  "POST /api/standalone/auth/otp/verify",
  "GET /api/standalone/auth/me",
  "POST /api/standalone/auth/logout",
  "POST /api/standalone/ats",
  "POST /api/standalone/honesty",          // D141: the free résumé honesty check — parsed in memory, nothing kept
  "POST /api/standalone/generate",
  "POST /api/standalone/apply",
]);

// ── ADMIN: requires an admin session ─────────────────────────────────────────────────────────
const ADMIN = new Set([
  // 45n (classified 45o): D150 T09 market week, T16 Phase 1 measures, D151 Rule 6 diagnostics + its 24 h token — requireAdmin.
  "GET /api/admin/market-week",
  "GET /api/admin/phase1",
  "GET /api/admin/system/diagnostics",
  "POST /api/admin/system/diag-token",
  // D179 P4a / P5a / P2 (45l): the company records, a company's stack, the review decisions, the taxonomy counts.
  "GET /api/admin/company-records",
  "GET /api/admin/company-records/health",   // A142 (45o)
  "GET /api/admin/runs",   // (A)-2 (45o): the run trace
  "GET /api/admin/runs/:id",
  "GET /api/admin/network",   // D180 P1 (45o): the network switch + counts
  "GET /api/admin/atlas-compete", "PUT /api/admin/atlas-compete",
  "GET /api/admin/posting-archive", "PUT /api/admin/posting-archive",   // D151 Rule 4 (45s): the archive's switch + numbers   // A154 (45s): the league / challenges / live count switches
  // D187 HB-10: Admin → System → Hirebase — the state, the caps, the free sizing and the one-page sample
  "GET /api/admin/hirebase", "PUT /api/admin/hirebase", "POST /api/admin/hirebase/sizing", "POST /api/admin/hirebase/sample",
  "GET /api/admin/hirebase/sample-report", "GET /api/admin/hirebase/feed", "PUT /api/admin/hirebase/feed",
  // T5: the assistant's admin side — the de-identified asks, a gap to the backlog, the switch for everyone
  "GET /api/admin/assistant/asks", "POST /api/admin/assistant/asks/backlog", "PUT /api/admin/assistant/enabled",
  "PUT /api/admin/network",
  "GET /api/admin/network/reports",   // D180 P2: the moderation queue
  "POST /api/admin/network/reports/:id",
  "GET /api/admin/company-records/:id/stack",
  "POST /api/admin/company-records/review/:id",
  "GET /api/admin/board/taxonomy",
  // 11-07: the D124 trial and Admin → Trial were removed; the research routes below live in routes/survey.js.
  "GET /api/admin/appearance",           // D133: whether users are offered the Studio theme
  "POST /api/admin/appearance",
  "GET /api/admin/testers",              // D131: the readable testers page (read-only)
  "GET /api/admin/testers/export.csv",   // D131: the responses, no names, no emails
  // D125: Admin → ATS calibration (routes/atsCalibration.js).
  "GET /api/admin/ats-calibration", "POST /api/admin/ats-calibration/build", "POST /api/admin/ats-calibration/resume",
  "GET /api/admin/ats-calibration/item/:id", "PUT /api/admin/ats-calibration/item/:id", "POST /api/admin/ats-calibration/assist",
  "POST /api/admin/ats-calibration/assist/import", "GET /api/admin/ats-calibration/results", "POST /api/admin/ats-calibration/fix",
  "POST /api/admin/ats-calibration/baseline",
  // D130: the standalone responses; contact details only with ?contact=1.
  "GET /api/admin/survey/export.csv",
  // D130: both surveys side by side and combined, and the YC numbers.
  "GET /api/admin/survey/sources",
  // AF residual. The full-auto kill switch, reachable without a SQL console. Admin-only and
  // deliberately not user-facing: it stops applications going out to real employers for EVERY
  // user, not for the caller.
  "GET /api/admin/full-auto",
  "PUT /api/admin/full-auto",
  "GET /api/admin/full-auto/prerequisites",   // D175 FA6: the four checks an unattended send waits for
  "POST /api/admin/full-auto/prerequisites",
  "DELETE /api/admin/full-auto",
  "GET /api/admin/testers/people",     // 44b: testers by name and email with what they wrote
  "GET /api/admin/testers/people.csv",
  "GET /api/admin/tailoring",      // D123: the tailoring mode, default model and models offered
  "PUT /api/admin/tailoring",
  "DELETE /api/admin/tailoring",
  "GET /api/admin/match-alerts",   // D185-2: time from posting to alert, per source
  "GET /api/admin/outcomes",
  "GET /api/admin/jobs",                // D151 Rule 2: the background job queue per kind
  "GET /api/admin/atlas-backlog",       // D185-3: rising skills → the Atlas content backlog
  "POST /api/admin/atlas-backlog/draft",
  "GET /api/admin/atlas-backlog/item",
  "POST /api/admin/atlas-backlog/:id/review",       // D185-5: interviews per application and per active person
  "GET /api/admin/backups",
  "POST /api/admin/backups",
  "POST /api/admin/backups/restore",
  // The board's fit precompute, run on purpose (dry-run by default). Admin-only: it scores every
  // user's active profile, which is an operator's decision, not a candidate's.
  "POST /api/admin/board-fit/precompute",
  // D118 P2: Admin → Atlas → Import content — the owner replaces the Learn content (validated JSON, diffed, applied on
  // Apply). Admin-only: it changes what every reader of /atlas/learn sees.
  "GET /api/admin/ghost-rates",                     // D137 P3: aggregates only
  "GET /api/admin/readiness",                       // D142: the bank and the most-claimed skills
  "POST /api/admin/readiness/questions/:id/review",  // D142: a person approves, edits or retires a question
  "GET /api/admin/questions",                       // D150 T02: the question bank's review desk (every status, stats, flags)
  "POST /api/admin/questions/:id/review",            // D150 T02: ⛔ the only way an item becomes live
  "GET /api/admin/learn/content",
  "POST /api/admin/learn/import/preview",
  "POST /api/admin/learn/import/apply",
  // D117 C9: the circle's data and Admin → Learn → Before-this review — the owner accepts, edits or rejects the drafted
  // links every reader's circle and routes use; the P5 link check and the routes. Admin-only.
  "GET /api/admin/learn/circle",
  "POST /api/admin/learn/circle/import",
  "POST /api/admin/learn/circle/needs/:step",
  "PUT /api/admin/learn/circle/needs/:step",
  "POST /api/admin/learn/circle/accept-all",
  "POST /api/admin/learn/circle/links/check",
  "PUT /api/admin/learn/circle/routes/:id",
  "DELETE /api/admin/learn/circle/routes/:id",
  // D162 G2–G4: the model gateway — every task's route, the switch / rollback (audited), evals, telemetry.
  "GET /api/admin/model-gateway/",
  "GET /api/admin/model-gateway/telemetry",
  "GET /api/admin/model-gateway/tasks/:task",
  "POST /api/admin/model-gateway/tasks/:task/change",
  "POST /api/admin/model-gateway/tasks/:task/rollback",
  "POST /api/admin/model-gateway/tasks/:task/evals",
  // D171 FIX 2: every model call's spend by hour / key / who started it, and the daily cost alarm (set: audited).
  "GET /api/admin/model-gateway/usage",
  "GET /api/admin/model-gateway/cost-alarm",
  "POST /api/admin/model-gateway/cost-alarm",
  // A50 step 3: the daily glance. Read-only, but it reads every user's apply outcomes and spend.
  "GET /api/admin/glance",
  "GET /api/admin/costs",                   // cost visibility (10-09): résumé economics, admin-only
  "POST /api/admin/costs/funding-alert/clear",
  "GET /api/admin/tools-service",
  "GET /api/admin/users",
  "POST /api/admin/users",
  "DELETE /api/admin/users/:id",
  // A58 (a): what an admin delete would remove, per table. Read-only, but it reads any user's data.
  "GET /api/admin/users/:id/delete-preview",
  "PATCH /api/admin/users/:id/password",
  "PATCH /api/admin/users/:id/plan",
  "GET /api/admin/users/:id/profile",
  "GET /api/admin/users/:id/applications",
  "GET /api/admin/upgrade-requests",
  "PATCH /api/admin/upgrade-requests/:id/grant",
  "GET /api/admin/domain-profile-requests",
  "PATCH /api/admin/domain-profile-requests/:id/status",
  "GET /api/admin/contact-messages",
  "PATCH /api/admin/contact-messages/:id/read",
  "POST /api/company-kb/:company/org-units/:orgUnit/confirm",
]);

// ── AUTHENTICATED: requires a signed-in session, any role ────────────────────────────────────
const AUTHENTICATED = new Set([
  // D180 P1 (45o): connections — requireAuth AND the network switch (404 while off); every one scoped to req.user.id;
  // :handle is the OTHER person, acted on only as the signed-in person's own relation to them.
  "GET /api/network/status",   // whether the dock draws Network — the only one answering while off
  // A154 / D172 (4) (45s): Atlas → Compete, each 404 while its switch is off.
  "GET /api/atlas/compete", "GET /api/atlas/league", "POST /api/atlas/league/join", "DELETE /api/atlas/league",
  "GET /api/atlas/challenges", "POST /api/atlas/challenges/time-attack", "POST /api/atlas/challenges/duel",
  "POST /api/atlas/challenges/:runId/answer", "POST /api/atlas/challenges/bar/:token/share",
  // D185-1 (45s): the posting's own questions the person hasn't answered yet, and a drafted answer (switch, OFF).
  "GET /api/apply/questions/:jobId", "POST /api/apply/questions/:jobId/draft",
  // T5: the assistant — the person's own asks, their confirm / cancel of a proposed action, their audit log and switch
  "GET /api/assistant/status", "POST /api/assistant/ask", "POST /api/assistant/actions/:id/confirm", "POST /api/assistant/actions/:id/cancel",
  "GET /api/assistant/actions", "PUT /api/assistant/settings",
  // D190: Ask draft's T2 — answers from the person's own data and draft's help / Atlas, no model
  "POST /api/assistant/lookup",
  "GET /api/network",
  "GET /api/network/suggestions",
  "GET /api/network/relation/:handle",
  "POST /api/network/request",
  "POST /api/network/:handle/:action",
  // D180 P2: messages — requireAuth + the switch; a thread / message id is read only as the signed-in person's own
  // (services/network/messages.js threadFor: not one of its two people → 404).
  "GET /api/network/messages",
  "POST /api/network/messages",
  "GET /api/network/messages/:threadId",
  "POST /api/network/messages/:threadId/:action",
  "POST /api/network/message/:messageId/hide",
  "POST /api/network/report",
  // D180 P3 (45r): the feed — requireAuth + the switch; a post / comment id is acted on only when the signed-in person can
  // see it (their own or a connection's, never across a block — services/network/feed.js postFor → 404); remove = own only.
  "GET /api/network/feed",
  "POST /api/network/feed",
  "POST /api/network/feed/:id/helpful",
  "GET /api/network/feed/:id/comments",
  "POST /api/network/feed/:id/comments",
  "POST /api/network/feed/:kind/:id/remove",
  "GET /api/network/share",
  "PUT /api/network/share",
  // D180 P4 (45r): connections at a company — only the signed-in person's own connections who show their experience.
  "GET /api/network/at-company",
  // 45l–45n (classified 45o): D183 the profile page + replace / undo, D154 P9 stack exposure + the daily reminder — requireAuth,
  // every one scoped by req.user.id (an :id another person owns is not found under this user).
  "GET /api/profile/page",
  "PUT /api/profile/page/visibility",
  "PUT /api/profile/placement",   // (B)-1 (45o): the person's own role pick, their active job profile
  "POST /api/profile/apply-for-me/:answer",   // (B)-3 (45o): Keep / Change back on Apply for me's new family, their active profile
  "PUT /api/profile/page/handle",
  "POST /api/profile/page/achievements",
  "DELETE /api/profile/page/achievements/:id",
  "GET /api/profile/replacements/latest",
  "POST /api/profile/replacements/:id/keep",
  "POST /api/profile/replacements/:id/undo",
  "GET /api/learn/stack-exposure",
  "GET /api/learn/today/reminder",
  "PUT /api/learn/today/reminder",
  "GET /api/profile/credit-draft",      // D185-7: the person's own "how did you hear" choice
  "PUT /api/profile/credit-draft",
  "GET /api/atlas/unlocks",             // D185-4: the jobs a proven skill moves THIS person up a tier on
  "GET /api/alerts/matches/settings",   // D185-2: the person's own new-match alert choice
  "PUT /api/alerts/matches/settings",
  // D179 P4b (45l): Your match on a company page — the person's own skills, signed in.
  "GET /api/companies/:slug/match",
  "POST /api/companies/:slug/follow",
  // D159 T2–T4 (46y): trackers — the person's own saved searches, followed companies and tracked pages (routes/trackers.js).
  "GET /api/trackers/", "POST /api/trackers/pages", "DELETE /api/trackers/pages/:id",
  "POST /api/trackers/companies/:id/seen", "POST /api/trackers/searches/:profileId/seen",
  "POST /api/audit/:token/claim",   // D150 T07: keep the result — signed in
  "GET /api/learn/today",           // D154 P1: today's question
  "POST /api/learn/today/answer",
  "GET /api/learn/practice-progress", // D154 P6: the practice card (46q: moved off the shadowed /api/learn/progress)
  // 11-07: the D124 trial's /api/trial/* routes were removed with it. The sample résumés' practice form stays at
  // /try/practice/:jobId (routes/survey.js), outside /api, behind an HMAC naming one (account, posting).
  // D115 P3: a learner's own progress marks.
  "GET /api/learn/progress", "PUT /api/learn/progress", "POST /api/learn/progress/import",
  // D117 C8: earned progress — the learner's own record (their explanations are theirs alone), an item opened from
  // draft, a checkpoint explained, a build linked; C5: the route from the user's own map.
  "GET /api/learn/earned", "POST /api/learn/opened", "PUT /api/learn/explained", "PUT /api/learn/built",
  "GET /api/learn/circle/my-route",
  "GET /api/auth/extension-token",
  "POST /api/auth/revoke-extension-token",
  // AJ1 6b. Exchanges a session-bound login token for a sessionLess one, so it needs the same
  // guard as the extension's: you must already be authenticated to mint a durable credential.
  "GET /api/auth/mobile-token",
  "POST /api/auth/revoke-mobile-token",
  "GET /api/auth/active-profile",
  "PATCH /api/auth/complete-profile",
  "GET /api/sync/events",
  "GET /api/notifications",
  "PATCH /api/notifications/read-all",
  "PATCH /api/notifications/:id/read",
  "GET /api/dock-preferences",
  "PUT /api/dock-preferences",
  "PATCH /api/settings/apply-mode",
  "GET /api/settings",
  "GET /api/integrations/status",
  "POST /api/integrations/:provider",
  "DELETE /api/integrations/:provider",
  "GET /api/plans",
  "POST /api/plans/request-upgrade",
  "GET /api/profile",
  "POST /api/profile",
  // D55 (f): the caller's OWN saved answers (user_profile.custom_answers / custom_answer_overrides), always
  // req.user.id. Remember one, manage, export / import, and test a question against them.
  "POST /api/saved-answers/remember",
  "GET /api/saved-answers",
  "PUT /api/saved-answers",
  "DELETE /api/saved-answers",
  "GET /api/saved-answers/export",
  "POST /api/saved-answers/import",
  "POST /api/saved-answers/test",
  // D165 (3): forget one of the caller's OWN scoped salary answers (user_profile.custom_answer_scoped).
  "DELETE /api/saved-answers/scoped",
  // D96 §4 (J8): the answer lifecycle — the caller's OWN saved_answers / answer_history rows, always req.user.id.
  "POST /api/saved-answers/acknowledge",
  "POST /api/saved-answers/change",
  "PUT /api/saved-answers/lifecycle/:id",
  "DELETE /api/saved-answers/lifecycle/:id",
  "GET /api/saved-answers/fillable",
  "GET /api/saved-answers/review",
  "POST /api/saved-answers/review",
  "PATCH /api/profile/skills",
  "GET /api/autofill",
  "GET /api/extension/autofill",
  "GET /api/company/:company",
  "POST /api/company/:company/consistency-check",
  "GET /api/categories",
  "GET /api/jobs",
  "GET /api/draft/today",        // UI step 3b: the user's own daily deck
  "GET /api/best-bets",          // D136: the user's own shortlist from their own board
  "GET /api/navigator",          // D143: the user's own destination, route and progress
  "PUT /api/navigator/aim",      // D143: the user's own aim
  "GET /api/warm-paths",         // D138: the user's own imported contacts (counts)
  "POST /api/warm-paths/import", // D138: the user's own LinkedIn export / alumni list
  "DELETE /api/warm-paths",      // D138: delete them
  "GET /api/readiness",                       // D142: the user's own skills and check states
  "POST /api/readiness/checks",               // D142: start the user's own check
  "POST /api/readiness/checks/:id/answer",    // D142: answer it (scoped to the user)
  "GET /api/warm-paths/job/:jobId", // D138: the people the user knows at this posting's company
  "GET /api/settings/theme",     // follow-up 18: the account's light/dark preference
  "PUT /api/settings/theme",
  "GET /api/settings/appearance",   // D91 P5: the account's theme + shape cues
  "PUT /api/settings/appearance",
  "GET /api/settings/tailoring-model",   // D123: the person's model, from what the admin offers
  "PUT /api/settings/tailoring-model",
  "GET /api/profile/gists",              // D123 P6a/P6g: their gists and numberless bullets; P6d coursework
  "PUT /api/profile/gists",
  "PUT /api/profile/coursework",
  "GET /api/settings/deck-geometry",   // queue 38: the deck's geometry preset / sliders, with the account
  "PUT /api/settings/deck-geometry",
  "GET /api/settings/deck-size",       // D152 (3): picks per day, with the account (migration 220)
  "PUT /api/settings/deck-size",
  "GET /api/jobs/facets",
  "GET /api/jobs/suggest",
  "GET /api/jobs/pending",
  // AH2: resolves ONE posting for a job-detail deep link. User-scoped in the sense that matters —
  // the user_jobs flags on the row are the caller's own — over a global postings table.
  "GET /api/jobs/by-id/:jobId",
  "GET /api/jobs/:jobId/sponsorship",   // D121: one posting's sponsorship signal + the viewer's own "needed"
  // Y2B. AUTHENTICATED, and deliberately not PUBLIC even though the description it returns is
  // public text on the employer's own careers page: this route SPENDS — it makes an outbound
  // third-party request and writes a row — so an unauthenticated caller could drive our
  // outbound traffic to Ubisoft, Bosch and Adobe at will.
  "POST /api/jobs/by-id/:jobId/description",
  "GET /api/jobs/poll",
  "POST /api/jobs/search",
  "PATCH /api/jobs/interact",
  "PATCH /api/jobs/:id/visited",
  "PATCH /api/jobs/:id/starred",
  "PATCH /api/jobs/:id/disliked",
  "GET /api/jobs/:id/recruiter",
  "GET /api/jobs/:id/contextual",
  "GET /api/resume/plausibility",   // D192 (4d): the person's own base résumé
  "GET /api/resumes/:id/plausibility",   // D192 (4d): the person's own generated résumé (user_id in the query)
  "POST /api/resume/plausibility/dismiss",   // D192 (4d): the person's own dismissals   // D192 (4): the contextual ATS score for the person's own base résumé
  "POST /api/jobs/:id/keywords",
  "POST /api/scrape",
  "GET /api/base-resume",
  "POST /api/base-resume",
  "GET /api/base-resume/enhance-status",
  "POST /api/base-resume/enhance",
  "PATCH /api/base-resume/adopt-enhanced",
  "GET /api/domain-profiles/:id/enhance-status",
  "POST /api/domain-profiles/:id/enhance",
  "PATCH /api/domain-profiles/:id/adopt-enhanced",
  "GET /api/simple-apply/profile",
  "POST /api/simple-apply/profile/refresh",
  "POST /api/parse-pdf",
  "POST /api/generate",
  "GET /api/account/allowance",           // D88 P5: the user's own plan and allowance, read-only
  "GET /api/generate/cost",                // D70 Phase 3: what the caller's next résumé costs, before it runs
  "POST /api/export-pdf",
  "GET /api/export/excel",
  "GET /api/history",
  "GET /api/resumes",
  "GET /api/resumes/:jobId",
  "DELETE /api/resumes/:jobId",
  "GET /api/resumes/:jobId/versions",
  "GET /api/resumes/:jobId/pdf",
  "POST /api/resumes/:jobId/html",
  "POST /api/resumes/:jobId/keep",
  "GET /api/applications",
  "POST /api/applications",
  "PATCH /api/applications/:jobId",
  "DELETE /api/applications/:jobId",
  "POST /api/cover-letter/generate",
  "GET /api/debug/verify-isolation",
  // Mounted routers, guarded at the mount
  "POST /api/import/job",
  "POST /api/import/context",               // D13: the companion popup's board lookup (read-only; URL in the body)
  "GET /api/extension/status",               // D12: is this user's extension connected
  // D55 decision B: "Save link to draft" — AUTHENTICATED, not PUBLIC, because it SPENDS: it makes an
  // outbound request to an ATS's listing API and writes a row, so a stranger could drive our traffic.
  "POST /api/import/link",
  // D64: automated capture — AUTHENTICATED: it writes to the user's board (a relevant posting) and is
  // braked per user; the list and the undo read and change only the caller's own captures.
  "POST /api/import/auto",
  "GET /api/import/auto",
  "POST /api/import/auto/:jobId/undo",
  // v1.5.2: "Captured: N today · M already on your board" — the caller's own captures, counted.
  "GET /api/import/today",
  // D66: "Use my base résumé for applications" — the caller's own switch.
  "GET /api/settings/base-resume-only",
  "PUT /api/settings/base-resume-only",
  // D67 (2): the learned origin pairs — admin only.
  "GET /api/admin/apply-origins",
  "POST /api/admin/apply-origins/:id/revoke",
  // D75: the owner promotes a pair the crawler OBSERVED (the crawler never promotes) — admin only.
  "POST /api/admin/apply-origins/:id/promote",
  // A186-CAPTCHA (4): the checks after Submit counted by kind — admin only.
  "GET /api/admin/quick-checks",
  "GET /api/admin/submit-outcomes",   // A187 S3
  "GET /api/admin/submit-share",   // A207 (d)
  "POST /api/admin/submit-families/:ats/clear",   // A207 (b): the owner clears a family's mark
  "GET /api/admin/ats-contextual-weights",   // D192 (4c)
  "PUT /api/admin/ats-contextual-weights",
  // D76: the Railway deploy events — admin only. (The hook itself, POST /api/hooks/railway, is a mounted
  // router authenticated by its own Bearer header; it is not a session route.)
  "GET /api/admin/deploy-events",
  // D77: the disk gauge — admin only.
  "GET /api/admin/disk",
  // D78 A: the board's age policy and its braked sweep — admin only.
  "GET /api/admin/board-policy",
  "PUT /api/admin/board-policy",
  "POST /api/admin/board-policy/sweep",
  "POST /api/admin/board-policy/scope-sweep",
  // D127 P2: the categories measured, the spot-check sample, and "Wrong category" — admin only.
  "GET /api/admin/board-categories",
  "POST /api/admin/board-categories/report",
  // D55 decision E: "Report this form" — host + field labels, stored against the reporter's own
  // account (deleted with it, rate-limited per user). Signed in only: an anonymous report has no one
  // to rate-limit and no account for its rows to be deleted with.
  "POST /api/form-reports",
  "GET /api/company-kb/:company/org-units",
  "GET /api/company-kb/:company/form-schemas",
  "GET /api/company-kb/:company/lca",
  "GET /api/company-kb/:company/hiring-signals",
  "GET /api/domain-profiles/",
  "POST /api/domain-profiles/",
  "POST /api/domain-profiles/from-resume",   // A104: the résumé starts the first job profile
  "POST /api/domain-profiles/requests",
  "PUT /api/domain-profiles/:id",
  "DELETE /api/domain-profiles/:id",
  "POST /api/domain-profiles/:id/activate",
  "GET /api/domain-profiles/:id/base-resume",
  "POST /api/domain-profiles/:id/base-resume",
  "GET /api/domain-profiles/:id/signals",
  // D186 (45s): the weighted ranking terms, where a résumé would place, and the four things.
  "GET /api/domain-profiles/:id/keywords", "PUT /api/domain-profiles/:id/keywords", "POST /api/domain-profiles/resume-preview",
  "GET /api/profile/four-things", "PUT /api/profile/four-things",
  "POST /api/domain-profiles/:id/signals/refresh",
  "PUT /api/domain-profiles/:id/signals",
  "GET /api/domain-profiles/:id/suggestions",
  "PUT /api/domain-profiles/:id/suggestions",
  "POST /api/domain-profiles/:id/suggestions",
  "POST /api/domain-profiles/:id/claims",
  "GET /api/domain-profiles/:id/enhancement-history",
  "GET /api/domain-profiles/:id/tracked-search",
  "PUT /api/domain-profiles/:id/tracked-search",
  "GET /api/domain-profiles/metadata/:domain",
  "GET /api/domain-profiles/metadata",
  "POST /api/domain-profiles/generate-chips",
  // routes/accountManagement.js — the signed-in user's OWN account, always req.user.id. The merge
  // routes take the other account only from req.session.mergeCandidate, set after proving it.
  "GET /api/account",
  "POST /api/account/reauth",
  "PATCH /api/account/profile",
  "POST /api/account/avatar",
  "GET /api/account/avatar/:userId",   // A148: answers only the signed-in person's own id (another → 404)
  "GET /api/account/avatar",
  "DELETE /api/account/avatar",
  "GET /api/account/sessions",
  "DELETE /api/account/sessions/:id",
  "POST /api/account/sessions/revoke-others",
  "DELETE /api/account/apps/:id",
  "POST /api/account/password",
  "POST /api/account/email",
  "POST /api/account/email/confirm",
  "DELETE /api/account/sign-in/:provider",
  "GET /api/account/export",
  "POST /api/account/merge/verify-password",
  "GET /api/account/merge/preview",
  "DELETE /api/account/merge",
  "POST /api/account/merge",
  "POST /api/account/delete",
  // routes/applicationRecords.js (A63 / D15 / D55) — mounted as applicationRecordRoutes(app, db, requireAuth, …);
  // every one reads or writes the caller's OWN records and history, always req.user.id. Enumerated from
  // D55 (i), which added the CSV import — before that this file's routes were not scanned at all.
  "GET /api/draft/slots",
  "GET /api/applications/pending",
  "GET /api/applications/history",
  "POST /api/applications/import",
  "POST /api/applications/pending",
  "POST /api/applications/pending/:jobId/record",
  "POST /api/applications/pending/:jobId/withdraw",
  "POST /api/applications/pending/withdraw",   // A105 finding 2: many at once, the caller's own pending rows only
  "POST /api/applications/not-applied/:jobId/restore",   // D112 c2: the caller's own Not applied row back to Pending
  // routes/apply.js — every one of these is mounted with requireAuth
  "POST /api/apply",
  "GET /api/apply/status/:jobId",
  "GET /api/apply/applications",
  // A186-CAPTCHA (1): the live check — requireAuth, and each answers only the run job's OWNER (liveSessionFor checks the user)
  "GET /api/apply/live", "GET /api/apply/live/:runJobId/stream", "POST /api/apply/live/:runJobId/input",
  // 46j: the viewer's frame poll (replaces the app's held-open stream) — requireAuth + liveSessionFor's owner check
  "GET /api/apply/live/:runJobId/frame",
  // A186-CAPTCHA (1b): Solve it here on a held check, and the batch queue — requireAuth; storedPieces reads the row
  // WHERE user_id = the caller, so another person's run job answers 404
  "POST /api/apply/run-jobs/:runJobId/solve-check", "POST /api/apply/solve-checks",
  // AK1. Both are per-user history: one records what an employer did with YOUR application, the
  // other correlates YOUR scores against YOUR outcomes. Each is scoped by user_id in its query and
  // the PATCH 404s on a job the caller has not applied to, so neither can be used to read another
  // account's application history.
  "PATCH /api/apply/applications/:jobId/response",
  "GET /api/apply/response-correlation",
  "GET /api/apply/readiness",
  "GET /api/apply/health",   // ⭐ A179 F6: the run processor's health for the signed-in person (their own queue only)
  "POST /api/apply/runs",
  "POST /api/apply/run-now",   // A166 (2): the person's own batch, at once
  "GET /api/apply/runs",
  "GET /api/apply/runs/:runId",
  // A59: the user's own line of waiting Drafts — viewed and edited by its owner only.
  "GET /api/apply/line",
  "PATCH /api/apply/line/:runId",
  "POST /api/apply/line/order",
  "DELETE /api/apply/line/:runId",
  "DELETE /api/apply/line/:runId/jobs/:runJobId",
  // D25: the run bar and the user's Stop everything.
  "GET /api/apply/run-bar",
  "POST /api/apply/hold",
  // D100: the run bar's SEMI / FULL AUTO switch — the user's own mode.
  "POST /api/apply/mode",
  // D102: the pipeline workspace's rows and one job's detail; P4 the FULL AUTO standing instruction.
  "GET /api/pipeline",
  "GET /api/pipeline/job/:applicationId",
  "GET /api/pipeline/job-for/:jobId",   // D102 P5: the same detail found by the job — the caller's own record only
  "GET /api/pipeline/callback-rates",   // D111: the caller's own reply / interview counts only
  // D113 UI U5: "I withdrew it" / Note why on the caller's own sent row — recorded in draft, nothing sent to the employer.
  "POST /api/pipeline/applications/:applicationId/withdrawn",
  "PUT /api/pipeline/job/:applicationId/note",
  "GET /api/apply/auto-settings",
  "PUT /api/apply/auto-settings",
  // D100 P2: the user's portals — sealed sessions (ciphertext only), connect, remove, and approving a remote run.
  // (The worker's own doors, /api/worker/*, are a token-gated Router like /api/crawler — not user routes.)
  "GET /api/portals",
  "POST /api/portals/connect/start",
  "POST /api/portals/upload",
  "DELETE /api/portals/:id",
  "POST /api/portals/approve/:runJobId",
  // D100 (a): consent for draft to create a portal account for the user; removing it.
  "POST /api/portals/accounts",
  "DELETE /api/portals/accounts/:id",
  // D101: the profile in sections and Application defaults.
  "GET /api/profile/sections",
  "POST /api/profile/sections/use-resume",
  "PUT /api/profile/sections/:section",
  "PUT /api/profile/defaults/:key",
  // D112 d2: the Education section's Change override for the degree the forms are given.
  "PUT /api/profile/education-override",
  // D109: evidence links on a bullet or project, and the proof page's own setting. (The public page itself is
  // GET /p/:handle — not under /api; it shows only what the user turned on, and nothing private.)
  "PUT /api/profile/evidence",
  "GET /api/profile/proof-page",
  "PUT /api/profile/proof-page",
  // D103: the inbox — the user's forwarding address, its filter file, the messages, re-filing, attaching, code opt-ins.
  // (The hook itself, POST /api/hooks/inbound, is a mounted router, Svix-signed — like /api/hooks/resend.)
  "GET /api/inbox/address",
  "POST /api/inbox/address/revoke",
  "GET /api/inbox/gmail-filter.xml",
  "GET /api/inbox",
  "POST /api/inbox/:id/category",
  "POST /api/inbox/:id/attach",
  "PUT /api/inbox/code-optins/:portal",
  "DELETE /api/inbox/:id",
  "DELETE /api/inbox",
  // D110: interview mode — the Prep tab, the user's date, the connector's data pack (the caller's own application only),
  // the story bank, debriefs and the user's OWN question bank.
  "GET /api/interview/prep/:applicationId",
  "PUT /api/interview/prep/:applicationId/date",
  "GET /api/interview/prep/:applicationId/connector-data",
  "GET /api/interview/stories",
  "POST /api/interview/stories",
  "POST /api/interview/stories/from-profile",
  "PUT /api/interview/stories/:id",
  "DELETE /api/interview/stories/:id",
  "GET /api/interview/debriefs",
  "POST /api/interview/debriefs",
  "DELETE /api/interview/debriefs/:id",
  "GET /api/interview/questions",
  // D167: Interview → Coming up — the caller's own Inbox invites matched to the caller's own applications.
  "GET /api/interview/upcoming",
  // D113: the picks API for the Draft House tree — the caller's own picks and runs only (routes/picksConfirm.js; the
  // signed-out confirm page is /p/confirm/<token>, outside /api). U4 "Make it now": the caller's own offered pick's résumé.
  "GET /api/picks/state",
  "POST /api/picks/mode",
  "GET /api/picks/runs",
  "GET /api/picks/runs/:id/left-out",
  "POST /api/picks/:id/apply",
  "POST /api/picks/:id/pass",
  "POST /api/picks/:id/resume",
  "POST /api/picks/runs/:id/apply-all",
  "GET /api/apply/review",
  "GET /api/apply/run-jobs/:runJobId/review",
  // AH5: the fill log — what this run put in the form and what it did not. On demand, so it is
  // its own endpoint rather than weight on every row of the review list.
  "GET /api/apply/run-jobs/:runJobId/fill-log",
  "GET /api/apply/run-jobs/:runJobId/resume",
  "GET /api/apply/run-jobs/:runJobId/screenshot",
  "POST /api/apply/run-jobs/:runJobId/abort",
  "POST /api/apply/run-jobs/:runJobId/generate-resume",   // (A)-1 (45o): ownedRunJob — the signed-in person's own run job
  "DELETE /api/apply/run-jobs/:runJobId",
  // D53: the 7-day bin — the user's own cleared items, bulk clear, restore, delete now.
  "POST /api/apply/bin/clear",
  "GET /api/apply/bin",
  "POST /api/apply/bin/:runJobId/restore",
  "DELETE /api/apply/bin/:runJobId",
  "GET /api/apply/history",
  // AH6: the date of your most recent activity. One MAX, no rows — the cheap question the panel
  // asks on mount so it can open on the day something last happened instead of on a blank board.
  "GET /api/apply/history/latest",
  "GET /api/apply/history/months/:month",
  "GET /api/apply/gate-packets",
  "POST /api/apply/gate-packets/:packetId/token",
  "POST /api/apply/gate-packets/:packetId/reopen",
  // D56: a PREPARED packet's résumé (no run-job to go through) — owner-checked on packet and artifact.
  "GET /api/apply/gate-packets/:packetId/resume",
  // D56: the extension on a page — which packets may fill it (origin list + job id), Prepare this
  // application, "I submitted it", and §8 row 17's Copy sheet. All the session user's own.
  "POST /api/apply/handoff/match",
  "POST /api/apply/prepare",
  "POST /api/apply/copy-sheet",
  "POST /api/apply/handoff/submitted",
  "POST /api/apply/gate-packet/exchange",
  "GET /api/apply/form-schema",
  "POST /api/apply/form-schema",
  "GET /api/apply/form-schema/consent",
  "POST /api/apply/form-schema/consent",
  "POST /api/apply/gate-review",
  "GET /api/apply/pending",
  "POST /api/apply/approve",
  "POST /api/apply/reject",
  "GET /api/apply/questions",
  "POST /api/apply/answers",
  "POST /api/apply/close/:jobId",
  // RETIRED, and still guarded: both answer 410. They kept requireAuth for the same reason
  // /api/scrape did — a retired route is not a public one, and the guard is what keeps it out of
  // the PUBLIC list where nobody would look at it again.
  "POST /api/apply/session/save",
  "GET /api/apply/session/:domain",
]);

// Routers whose every route is admin-gated INSIDE the router rather than at the mount. Enumerating
// their individual paths here would duplicate two large files; what matters is the invariant that
// not one route in them is reachable without requireAdmin, which is asserted directly below.
const INTERNALLY_ADMIN_GATED = {
  "routes/admin.js": "/api/admin/analytics",
  "routes/adminDb.js": "/api/admin/db",
};

// ── enumeration ──────────────────────────────────────────────────────────────────────────────
const METHODS = "get|post|put|patch|delete";

// app.get("/api/...", guard, handler) — server.js and routes/apply.js, which takes `app`.
function directRoutes(source) {
  const found = [];
  const re = new RegExp(`\\bapp\\.(${METHODS})\\(\\s*"(/api/[^"]*)"\\s*(,\\s*[A-Za-z_$][\\w$]*)?`, "g");
  for (const m of source.matchAll(re)) {
    found.push({ method: m[1].toUpperCase(), path: m[2], guard: (m[3] || "").replace(/[,\s]/g, "") || null });
  }
  return found;
}

// router.get("/sub", guard, handler) inside a router file, composed with its mount prefix.
function routerRoutes(source, prefix) {
  const found = [];
  const re = new RegExp(`\\brouter\\.(${METHODS})\\(\\s*"([^"]*)"\\s*(,\\s*[A-Za-z_$][\\w$]*)?`, "g");
  for (const m of source.matchAll(re)) {
    found.push({
      method: m[1].toUpperCase(),
      path: prefix + m[2],
      guard: (m[3] || "").replace(/[,\s]/g, "") || null,
    });
  }
  return found;
}

// app.use("/prefix", requireAuth, createXRouter(...)) — the guard applied at the mount.
function mountGuards(source) {
  const guards = new Map();
  const re = /\bapp\.use\(\s*"(\/api\/[^"]*)"\s*,\s*([A-Za-z_$][\w$]*)\s*,/g;
  for (const m of source.matchAll(re)) guards.set(m[1], m[2]);
  return guards;
}

function collect() {
  const mounts = mountGuards(SERVER);
  // A route's third argument is only a GUARD if it is one of these. `router.post("/job", async (...`
  // captures "async", and treating that as a guard would let an unguarded route look guarded — and,
  // worse, would suppress the mount-level fallback below. Normalise first, then fall back.
  const KNOWN = new Set(["requireAuth", "requireAdmin"]);
  const named = (g) => (KNOWN.has(g) ? g : null);
  const routes = [
    ...directRoutes(SERVER),
    ...directRoutes(fs.readFileSync("routes/apply.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/applicationRecords.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/pipeline.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/applyWorker.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/profileSections.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/network.js", "utf8")),   // D180 P1 (45o)
    ...directRoutes(fs.readFileSync("routes/atlasCompete.js", "utf8")),   // A154 (45s)
    ...directRoutes(fs.readFileSync("routes/inbox.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/interview.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/picksConfirm.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/survey.js", "utf8")),
    ...directRoutes(fs.readFileSync("routes/atsCalibration.js", "utf8")),
    // account.js is mounted with app.use(createAccountRouter({...})) at the ROOT, so its routes
    // already carry their full /api path and their own per-route guard.
    ...routerRoutes(fs.readFileSync("routes/account.js", "utf8"), ""),
    ...routerRoutes(fs.readFileSync("routes/accountManagement.js", "utf8"), ""),
    ...routerRoutes(fs.readFileSync("routes/savedAnswers.js", "utf8"), ""),
    ...routerRoutes(fs.readFileSync("routes/domainProfiles.js", "utf8"), "/api/domain-profiles")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/domain-profiles") })),
    ...routerRoutes(fs.readFileSync("routes/importJob.js", "utf8"), "/api/import")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/import") })),
    // D159 T2–T4 (46y): mounted at /api/trackers behind requireAuth — the mount's guard is every route's.
    ...routerRoutes(fs.readFileSync("routes/trackers.js", "utf8"), "/api/trackers")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/trackers") })),
    ...routerRoutes(fs.readFileSync("routes/companyKb.js", "utf8"), "/api/company-kb")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/company-kb") })),
    // D115: mounted at /api/learn with NO mount guard — each progress route carries requireAuth itself.
    ...routerRoutes(fs.readFileSync("routes/learn.js", "utf8"), "/api/learn"),
    // D118 P2: mounted at /api/admin/learn behind requireAdmin — the mount's guard is every route's.
    ...routerRoutes(fs.readFileSync("routes/learnAdmin.js", "utf8"), "/api/admin/learn")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/admin/learn") })),
    // D162: mounted at /api/admin/model-gateway behind requireAdmin — the mount's guard is every route's.
    ...routerRoutes(fs.readFileSync("routes/modelGateway.js", "utf8"), "/api/admin/model-gateway")
      .map(r => ({ ...r, guard: named(r.guard) || mounts.get("/api/admin/model-gateway") })),
  ];
  return routes.map(r => ({ ...r, guard: named(r.guard) }));
}

test("every /api route is classified — a new endpoint fails this test until it is", () => {
  const routes = collect();
  // A floor, not a target. If the enumeration regexes ever stop matching, `unclassified` goes empty
  // and every assertion below passes vacuously — which is the failure mode this guards.
  assert.ok(routes.length > 160, `only found ${routes.length} routes — the enumeration itself broke`);

  const classified = new Set([...PUBLIC, ...ADMIN, ...AUTHENTICATED]);
  const unclassified = [...new Set(routes.map(r => `${r.method} ${r.path}`))]
    .filter(key => !classified.has(key))
    .sort();

  assert.deepEqual(unclassified, [],
    "These /api routes are not in PUBLIC, ADMIN or AUTHENTICATED in this file. Decide which each " +
    "one is and add it. If it belongs in PUBLIC, say why in a comment — an unauthenticated route " +
    "is a decision, not a default:\n  " + unclassified.join("\n  "));
});

test("no route is classified that does not exist — the manifest cannot rot", () => {
  const live = new Set(collect().map(r => `${r.method} ${r.path}`));
  // Mounted-router entries whose prefix the enumeration composes are all live; a stale entry here
  // means a route was deleted and its classification left behind, which quietly weakens the first
  // test by shrinking what it can catch.
  const stale = [...new Set([...PUBLIC, ...ADMIN, ...AUTHENTICATED])].filter(k => !live.has(k)).sort();
  assert.deepEqual(stale, [], "Classified but no longer defined:\n  " + stale.join("\n  "));
});

test("every route classified AUTHENTICATED or ADMIN actually carries a guard", () => {
  const unguarded = collect()
    .filter(r => {
      const key = `${r.method} ${r.path}`;
      return (AUTHENTICATED.has(key) || ADMIN.has(key)) && !r.guard;
    })
    .map(r => `${r.method} ${r.path}`)
    .sort();
  assert.deepEqual(unguarded, [],
    "Classified as needing a session, but mounted with no requireAuth/requireAdmin:\n  " + unguarded.join("\n  "));
});

test("every route classified ADMIN is gated by requireAdmin, not merely requireAuth", () => {
  const weak = collect()
    .filter(r => ADMIN.has(`${r.method} ${r.path}`) && r.guard !== "requireAdmin")
    .map(r => `${r.method} ${r.path} (guard: ${r.guard})`)
    .sort();
  assert.deepEqual(weak, [], "Admin routes gated by something weaker than requireAdmin:\n  " + weak.join("\n  "));
});

test("every route classified PUBLIC really is mounted without a guard", () => {
  // The mirror of the test above, and the more important direction: a route sitting in PUBLIC that
  // has since gained requireAuth is harmless, but this catches the reverse mistake of moving a
  // route into PUBLIC by accident while it still needs a session.
  const guarded = collect()
    .filter(r => PUBLIC.has(`${r.method} ${r.path}`) && r.guard)
    .map(r => `${r.method} ${r.path} (${r.guard})`)
    .sort();
  assert.deepEqual(guarded, [],
    "In PUBLIC but guarded — move it to AUTHENTICATED/ADMIN so the manifest tells the truth:\n  " + guarded.join("\n  "));
});

test("the two internally-gated admin routers gate EVERY route with requireAdmin", () => {
  for (const [file, prefix] of Object.entries(INTERNALLY_ADMIN_GATED)) {
    const source = fs.readFileSync(file, "utf8");
    const routes = [...source.matchAll(new RegExp(`\\brouter\\.(${METHODS})\\(\\s*"([^"]*)"\\s*(,\\s*[A-Za-z_$][\\w$]*)?`, "g"))];
    assert.ok(routes.length > 5, `${file}: enumeration found only ${routes.length} routes`);
    const ungated = routes
      .filter(m => (m[3] || "").replace(/[,\s]/g, "") !== "requireAdmin")
      .map(m => `${m[1].toUpperCase()} ${prefix}${m[2]}`);
    assert.deepEqual(ungated, [], `${file} has routes not gated by requireAdmin:\n  ` + ungated.join("\n  "));
    // And the guard it uses must actually DECIDE something rather than merely existing.
    //
    // It must decide it through shared/authPolicy.js, not by reading req.user.isAdmin itself.
    // These two routers each wrote their own `!req.user?.isAdmin` check, and that is exactly how
    // the extension reached the DB inspector: the credential was fixed in server.js and these two
    // were left open. mayActAsAdmin is the one predicate that also refuses an extension
    // credential — see docs/EXTENSION_DIAGNOSIS.md §6.5.
    assert.match(source, /function requireAdmin[\s\S]{0,400}?mayActAsAdmin\(req\)/,
      `${file}: requireAdmin must decide via shared/authPolicy.js`);
    assert.doesNotMatch(source, /function requireAdmin[\s\S]{0,400}?!req\.user\?\.isAdmin/,
      `${file}: requireAdmin must not decide from req.user.isAdmin alone — an extension credential ` +
      `hydrates a full user and would pass`);
  }
});

test("every authenticated route taking an id from the request derives the owner from the session", () => {
  // The shape this catches: `app.get("/api/jobs/:id/recruiter", requireAuth, (_req, res) => {` —
  // a handler that names its request `_req` to say it does not read it, on a route whose whole
  // input is an id supplied by the caller. Ownership then cannot be checked, because the only
  // thing that could establish it (req.user) was never consulted.
  const sources = {
    "server.js": SERVER,
    "routes/apply.js": fs.readFileSync("routes/apply.js", "utf8"),
    "routes/account.js": fs.readFileSync("routes/account.js", "utf8"),
    "routes/domainProfiles.js": fs.readFileSync("routes/domainProfiles.js", "utf8"),
  };
  const offenders = [];
  for (const [file, source] of Object.entries(sources)) {
    const re = new RegExp(`\\b(?:app|router)\\.(${METHODS})\\(\\s*"([^"]*:[^"]*)"([\\s\\S]{0,1400}?)\\n(?=(?:app|router|function|const)\\b|\\s{0,2}\\}\\);\\n)`, "g");
    for (const m of source.matchAll(re)) {
      const [, method, routePath, body] = m;
      // Ownership can be established directly (req.user) or by delegating to a helper that takes
      // the session and resolves the owned row — ownedRunJob(id, req.user.id) and the
      // enhance-status/enhance/adopt trio, all of which read req.user internally.
      if (!/req\.user|ownedRunJob|ownedProfile|getResumeRouteProfile|sendEnhanceStatus|enhanceProfileResume|adoptEnhancedProfileResume|requireAdmin/.test(body)) {
        offenders.push(`${file}: ${method.toUpperCase()} ${routePath}`);
      }
    }
  }
  // Known and reviewed: these take an id but own nothing user-scoped, so there is nothing to scope.
  const REVIEWED = new Set([
    "server.js: GET /api/domain-metadata/:key",                    // a static registry file
    "server.js: GET /api/audit/role/:slug",                        // D150 T04: a role's board aggregates, public, no owner
    "server.js: GET /api/public/companies/:slug",                  // D179 P4b: a company's public page, no owner
    "server.js: GET /sitemap-jobs-:n.xml",                         // D179 P7: a numbered public sitemap file, no owner
    "server.js: GET /jobs/role/:id",                               // D179 P7: a public landing page, no owner
    "server.js: POST /api/audit/:token/answer",                    // D150 T05: an anonymous token, no owner
    "server.js: GET /api/audit/:token/result",                     // D150 T06: an anonymous token, no owner
    "server.js: GET /jobs/role/:id/in/:metro",                     // D179 P7: a public landing page, no owner
    "server.js: GET /jobs/tech/:slug",                             // D179 P7: a public landing page, no owner
    "server.js: GET /jobs/sponsor-h1b/:id",                        // D185-6: a public landing page, no owner
    "server.js: GET /companies/:slug",                             // A157: a 301 to the company's own address, no owner
    "server.js: GET /:company/:id",                                // A157: a public posting page under its company, no owner
    "server.js: GET /jobs/sponsor-h1b/:id/in/:metro",              // D185-6: a public landing page, no owner
    "server.js: POST /api/auth/provider/:provider",                // pre-auth, by definition
    // Retired: answers 410 and reads nothing at all, so there is no owner to scope to.
    "routes/apply.js: GET /api/apply/session/:domain",
    "routes/domainProfiles.js: GET /metadata/:domain",             // the same static registry
    // Company KB, addressed by company NAME. company_* tables are a shared knowledge base with no
    // user column, so there is no owner to scope to; every signed-in user sees the same answer.
    "server.js: GET /api/company/:company",
    "server.js: POST /api/company/:company/consistency-check",
    // Stubs. Each responds with a fixed body and reads nothing at all: the recruiter surface is
    // {comingSoon:true}, and server-side PDF export is a 503 pointing at client-side print.
    "server.js: GET /api/jobs/:id/recruiter",
    // A77: a company logo by company key — company_logos has no user column, nothing to scope.
    "server.js: GET /api/company-logo/:key",
    "server.js: GET /api/resumes/:jobId/pdf",
    // D128 P1: the public page per posting (not /api) — scraped_jobs is the global pool with no user column, a shown
    // category only, and the page is the same signed in or out (services/jobs/publicJobPage.js). Nothing to scope.
    "server.js: GET /jobs/:slug",
  ]);
  const real = offenders.filter(o => !REVIEWED.has(o)).sort();
  assert.deepEqual(real, [],
    "These routes take an id from the caller and never read req.user, so they cannot be scoping to " +
    "the authenticated user:\n  " + real.join("\n  "));
});

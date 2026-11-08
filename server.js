// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
// ============================================================
// server.js — Draft v5
// ============================================================
import "dotenv/config";
import express        from "express";
import cors           from "cors";
import cron           from "node-cron";
import Database       from "better-sqlite3";
import Anthropic      from "@anthropic-ai/sdk";
import passport       from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session        from "express-session";
import { SqliteSessionStore } from "./services/sqliteSessionStore.js";
import { launchBrowser, probeBrowserAvailability } from "./services/browserLauncher.js";
import multer         from "multer";
import ExcelJS        from "exceljs";
import crypto         from "crypto";
import { fileURLToPath } from "url";
import path           from "path";
import fs             from "fs";
import { createBackup, listBackups, restoreBackup } from "./scripts/backup.js";
// The migration LOOP, shared with scripts/migration.js. Only the loop — the MIGRATIONS list below
// is still this file's own copy on purpose; see the note at the top of scripts/migration.js.
import { applyPendingMigrations } from "./scripts/applyMigrations.js";
import applyRoutes, { capturedAtsAtApply } from "./routes/apply.js";
import applicationRecordRoutes from "./routes/applicationRecords.js";
import pipelineRoutes from "./routes/pipeline.js";
import interviewRoutes from "./routes/interview.js";
import inboxRoutes, { createInboundHookRouter } from "./routes/inbox.js";
import { sweepInbox } from "./services/inbox.js";
import gmailRoutes from "./routes/gmail.js";
import { createGoogleGmailClient, startGmailPoll, disconnect as disconnectGmail } from "./services/gmail.js";
import profileSectionRoutes from "./routes/profileSections.js";
import { withApplicationDefaults } from "./services/structuredProfile.js";
// D109: evidence on the Profile's bullets and projects, the backed / unbacked marks tailoring reads, the public proof page.
import { backedBulletKeys, evidenceKey, evidenceForRequest } from "./services/proofLinks.js";
import proofPageRoutes from "./routes/proofPage.js";
import { userEligibilityInputs, hasEligibilityInputs, eligibilityForRow, ineligibleOrderKey } from "./services/jobEligibility.js";
import portalRoutes, { createApplyWorkerRouter } from "./routes/applyWorker.js";
import { recordSubmissionFromPipeline } from "./services/applicationRecords.js";
import { runAutoTick, runPicksFollowUps } from "./services/autoScheduler.js";
import { sweepTestingRecords } from "./services/testingRecords.js";
import { runCanaryCheck } from "./services/fullAutoCanary.js";
import { startedByMiddleware, withStartedBy, SCHEDULER_STARTED } from "./services/startedByContext.js";
import { requestIdMiddleware } from "./services/requestContext.js";
import { prodKeyOutsideProduction } from "./services/modelUsage.js";
import { configureNotify, notifyEvent } from "./services/notify.js";
import { pickSecret, userLevelFor } from "./services/picks.js";
import picksConfirmRoutes from "./routes/picksConfirm.js";
import notifyRoutes from "./routes/notify.js";
import generatedResumeRoutes from "./routes/generatedResumes.js";
import applicationArtifactRoutes from "./routes/applicationArtifacts.js";
import { draftSlots, slotsExhausted, recordGenerationSlot } from "./services/draftSlots.js";
import { GENERATION_EXPECT_SECONDS, userSafeGeneration, userCostView, userSafeResumeRow } from "./services/costVisibility.js";
import { isSuspended, UserAdminError, selfAllowance, writeAudit } from "./services/userAdmin.js";
// ⛔ D95 · an admin is not a user: its own accounts, sessions and sign-in; every admin write names a coded actor.
import { ADMIN_REFUSAL, ensureOwnerAdmin, emailBelongsToAdmin } from "./services/adminAccounts.js";
import { adminEnforced, createAdminSessionBinder, createRequireAdmin, refuseAdmin } from "./services/adminGuard.js";
import { actorOf, actorRef, actorUserId } from "./services/actor.js";
import { createAdminAuthRouters } from "./routes/adminAuth.js";
import { createAdminPeopleRouter } from "./routes/adminPeople.js";
import { createSupportRouters } from "./routes/tickets.js";
import { createResumeChangesRouter } from "./routes/resumeChanges.js";
import { createResumeEditorRouter } from "./routes/resumeEditor.js";
import { createApplicationPostingRouter } from "./routes/applicationPosting.js";
import { createExtensionResumeService, GenerationCancelledError, baseResumeFor as extensionBaseResumeFor } from "./services/extensionResume.js";
import { createExtensionResumeRouter } from "./routes/extensionResume.js";
import { createExtensionJobRouter } from "./routes/extensionJob.js";
import { createExtensionDraftRouter } from "./routes/extensionDraft.js";
import { purgeSolvedTickets } from "./services/tickets.js";
import { storeGeneratedResume, refundGeneration, ResumeStoreError, STORE_FAILED_SENTENCE, listGeneratedResumes,
         deleteGeneratedResume, sweepExpiredResumes, resumeRetentionDays, resumeContentLoss } from "./services/generatedResumes.js";
import { markPending, movePendingExpired } from "./services/applicationRecords.js";
import { purgeSweep } from "./services/draftBin.js";
import { createAccountRouter } from "./routes/account.js";
import { loadSecretKey, createSecretBox, saveIntegrationSecret } from "./services/secretBox.js";
import { createAdminRouter } from "./routes/admin.js";
import { createAdminDbRouter } from "./routes/adminDb.js";
import { buildGlance } from "./services/adminGlance.js";
import { enrichBudget, onEnrichmentApplied } from "./services/jobs/enrichJob.js";
import { createEnrichmentRouter } from "./routes/enrichment.js";
import { createJobDataRouter } from "./routes/jobData.js";
import { createCompaniesRouter } from "./routes/companies.js";
import { createSlugHarvestRouter } from "./routes/slugHarvest.js";
import { createCrawlerWorkerRouter, createCrawlerAdminRouter } from "./routes/crawler.js";
import { runSchedule as runCrawlerSchedule } from "./services/crawlerQueue.js";
import { readPolicy as readBoardPolicy, setPolicy as setBoardPolicy, sweepAged } from "./services/jobs/boardAge.js";
import { sweepScope } from "./services/jobs/boardScope.js";
import { createClassifyBacklog } from "./services/jobs/classifyBacklog.js";
import { stripSampleProfiles } from "./services/sampleProfileStrip.js";
import { profileCategory, categoryOf as categoryOfPosting } from "./services/jobs/professionalScope.js";
import { touchBoardVisit, visitMark, visitSince, FIRST_SEEN_SQL } from "./services/boardVisit.js";
import { heatReport } from "./services/companyHeat.js";
import { runHnDiscovery, runCandidateProbe } from "./services/companyCandidates.js";
import { createRailwayHookRouter, deployEventsSummary } from "./routes/railwayHook.js";
import { readGauge, projectTranche, trancheGate, AMBER_AT as DISK_AMBER_AT, RED_AT as DISK_RED_AT } from "./services/diskGauge.js";
import { checkDiskAlert, CHECK_EVERY_MS as DISK_ALERT_EVERY_MS } from "./services/diskAlert.js";
import { createJobTagsRouter } from "./routes/jobTags.js";
import { createDomainProfilesRouter } from "./routes/domainProfiles.js";
import { createImportJobRouter } from "./routes/importJob.js";
import { extensionStatusHandler } from "./routes/extensionStatus.js";
import { formReportHandler, purgeExpiredFormReports } from "./services/formReports.js";
import { createCompanyKbRouter } from "./routes/companyKb.js";
import { runOrgLayerRollup } from "./services/kb/orgLayer.js";
import { runHiringSignalsRollup } from "./services/jobs/hiringSignals.js";
// ⭐ D107: every posting's first seen / last seen / closed, kept after its board row goes; reposts read from it.
import { recordJobHistory, livenessForRows } from "./services/jobs/jobHistory.js";
import { scoreGhosts, ghostForRows, calibrateGhostThreshold, ghostRates } from "./services/jobs/ghostScore.js";
import { bestBetsFor, refitBestBets, bestBetSignalsFor, warmVelocity } from "./services/bestBets.js";
import { bestBetOf } from "./shared/bestBets.js";
import { readAutoSettings } from "./shared/autoSettings.js";
import { honestyCheck } from "./services/honestyCheck.js";
import { navigatorFor, setAim, aimRoleFor } from "./services/navigator.js";
import { importContacts, warmSummary, deleteContacts, warmPathTo, draftNote, warmCounts } from "./services/warmPaths.js";
import { startCheck, answerCheck, readinessStates, mostClaimed, reviewQuestion, seedReadinessDrafts } from "./services/readiness.js";
// ⭐ D105: the Atlas — roles, skills, tools, linked; seeded as drafts from the scorer's own registry, stats from the board.
import { createAtlasRouter, createAtlasAdminRouter } from "./routes/atlas.js";
import { createLearnRouter } from "./routes/learn.js";
// ⭐ D169: Your skills in Atlas — and the gate: a skill not on the résumé goes into a tailored one only once proven.
import { createYourSkillsRouter, createYourSkillsAdminRouter } from "./routes/yourSkills.js";
import { gateClaimsForResume, gatedDomainProfile } from "./services/yourSkills.js";
import { createThumbsRouter, createThumbsAdminRouter, resourceItems } from "./routes/thumbs.js";
import surveyRoutes from "./routes/survey.js";
import atsCalibrationRoutes from "./routes/atsCalibration.js";
import { ingestForUser } from "./services/inbox.js";
import { refreshThumbs } from "./services/thumbs/resourceThumbs.js";
import { createLearnAdminRouter } from "./routes/learnAdmin.js";
import { seedLearnContentIfEmpty } from "./services/learn/learnImport.js";
import { importQuestionFiles, reviewList, unknownPieces, reviewQuestion as reviewLearnQuestion,
  QUESTION_LEVELS, QUESTION_TYPES, QUESTION_STATUSES } from "./services/learn/learnQuestions.js";
import { importDeckQuestions } from "./services/learn/learnDecks.js";
import { auditRoles, roleCard } from "./services/audit/auditRoleCard.js";
import { seedCircleData, checkExtraItems } from "./services/learn/learnCircle.js";
import { seedAtlasFromRegistry } from "./services/atlas/atlasSeed.js";
import { importLearnConcepts, publishLearnConcepts } from "./services/atlas/atlasLearnImport.js";
import { learnContent } from "./services/learn/learnContent.js";
import { importLearnPatterns } from "./services/learn/learnLinks.js";
import { seedAtlasFamilies } from "./services/atlas/atlasFamilies.js";
import { seedDraftedDefinitions } from "./services/atlas/atlasDefinitions.js";
import { seedBoardRoles } from "./services/atlas/atlasRoles.js";
import { computeAtlasStats } from "./services/atlas/atlasStats.js";
import { liveVersion, atlasPostingsChanged, startAtlasDrainer, atlasQueueLength } from "./services/atlas/atlasLive.js";
import { atlasSitemapRoutes } from "./services/atlas/atlasSitemap.js";
import { publicJobFor, renderPublicJobPage, renderMissingJobPage, jobsSitemapRoutes } from "./services/jobs/publicJobPage.js";
import { checkAtlasLinks } from "./services/atlas/atlasLinkCheck.js";
import { runRegisterLinkCheck } from "./services/atlas/sourceRegistry.js";
import { autoPublish, runAtlasAutoPipeline } from "./services/atlas/atlasPublish.js";
// ⭐ D108: a company's sponsorship fact (the existing LCA match, with its source and date) and the dated "What changed".
import { sponsorshipFactsForRows } from "./services/kb/sponsorshipFacts.js";
import { sponsorshipSignalsForRows, sponsorshipSignal } from "./services/kb/sponsorshipSignal.js";
import { redactRows } from "./services/adminSafety.js";
import { createWhatChangedRouter, createWhatChangedAdminRouter } from "./routes/whatChanged.js";
// trackScrape dropped from this import in cleanup 5.8 — it was imported here and never called.
// Every model call goes through callModel, which records usage on one path — see
// services/modelCall.js. trackApiCall is no longer imported here: server.js called it
// directly at 4 of 14 call sites, which is how the other 10 went unrecorded.
import { SYSTEM_USER_ID } from "./services/modelCall.js";
// ⛔ D162 G1 · a feature names a TASK, never a model; the gateway picks the model (services/modelGateway.js).
import { callTask } from "./services/modelGateway.js";
// ⛔ D173 (1): untrusted text (postings) reaches a model only fenced, and the output is checked.
import { buildCoverLetterRequest, checkCoverLetter } from "./services/coverLetterPrompt.js";
import { describeViolations } from "./services/untrustedText.js";
import { createModelGatewayAdminRouter } from "./routes/modelGateway.js";
// AK1: the ONE exception to "server.js does not touch the tracker directly", and it is not a
// second recording path — recordAtsOutcome only fills ats_score_before/after on a row callModel
// has already written. It cannot create a usage_events row, so the reason the note above exists
// (call sites that recorded spend independently, and went unrecorded) does not apply to it.
import { recordAtsOutcome } from "./services/usageTracker.js";
// A4 — generation, the A+ rewrite and PDF parsing belong to the résumé tools service; draft calls it as a client.
import { createToolsServiceClient, recordToolsServiceUsage, httpErrorFor, ToolsServiceError, isFundingFailure } from "./services/toolsService.js";
import { generateRequest as toolsGenerateRequest } from "./services/toolsServiceRequests.js";
import { aPlusOverride, servedPromptMode, APLUS_OVERRIDE_KEY } from "./services/leanTailoring.js";
import { tailoringFor, tailoringState, leanJobKeywords, payloadJobKeywords, fullPostingText, LEAN_LEDGER_RENAME, TAILORINGS, TAILORING_KEY,
         MODEL_CHOICES, MODEL_LABELS, MODEL_DEFAULT_KEY, MODELS_OFFERED_KEY, modelSettings, modelFor, userModelChoice } from "./services/leanTailoring.js";
import { cleanLinkPath } from "./services/linkPunctuation.js";
import { ensureGists, latestGists, validateGists, saveEditedGists, readCoursework, saveCoursework } from "./services/resumeGists.js";
import { retryReasonFor } from "./services/generationRetry.js";
import { generationCostSummary } from "./services/generationCost.js";
import { drainInto as drainTrackingFailureSink } from "./services/trackingFailureSink.js";
import { pinnedModelIds } from "./shared/modelTasks.js";
import { assertPinnedModelsLive } from "./services/modelCatalogue.js";
import { workspaceHeaders, checkModelKey, keyCheckLine, KEY_CHECK_EVERY_MS } from "./services/modelKeyCheck.js";
import { classifyGenerationError } from "./shared/failureAttribution.js";
import { checkLimit } from "./services/limitEnforcer.js";
import { DATA_CLASS } from "./services/modelCall.js";
import { qualificationKeyCount } from "./services/qualificationResolver.js";
// buildProfileTitleVariants (was buildProfileTitleVariants) and buildProfileSearchTerms dropped from this import in cleanup
// 5.1: both were imported here and never called. The functions themselves are KEPT — unlike
// 5.7's module they still have real callers, in scripts/tracePipeline.js, scripts/rawTrace.js and
// scripts/conditionTests.js (all three verified to still run) plus their own unit tests. Dead in
// the production path, live in tooling; only the server's unused reference goes.
import { getRoleKeyForProfile as _getRoleKeyForProfile } from "./services/jobClassifier.js";
import { inferWorkType, jobHash, normaliseItem, isFullTimeNorm, isEmploymentTypeWanted, parseYearsExperience, ghostJobScoreNorm, isReposted } from "./services/jobNormalization.js";
import { usEligibility } from "./services/jobs/usLocation.js";
// profileTitleSql still narrows the poll and pending QUEUES — see the verdict recorded at its
// remaining call sites. parseProfileArray is the same parser it uses, so the board's ranking
// and those queues cannot disagree about what target_titles contains.
import { profileTitleSql, parseProfileArray } from "./services/profileTitleFilter.js";
import { resolveSponsorshipNeed } from "./services/applyAutomation.js";
import { readAnswerStore, effectiveCustomAnswers } from "./services/customAnswers.js";
import { hashPassword, verifyPassword, validatePassword } from "./services/authSecurity.js";
import { createPasswordReset, consumePasswordReset, findUserForPasswordReset } from "./services/passwordResetService.js";
import { sendPasswordResetEmail, sendVerificationCodeEmail, emailConfigured, sendEmail } from "./services/emailService.js";
import { EncryptedSessionStore } from "./services/encryptedSessionStore.js";
import { rejectCrossSiteWrites } from "./services/originGuard.js";
import { AccountError, forgetSessions, recordSession, sidsToRevoke } from "./services/accountService.js";
import { adminDeletePreview, adminDeleteUser, checkAdminDeleteConfirmed, removeDataFiles } from "./services/adminUserDelete.js";
import { createAccountManagementRouter } from "./routes/accountManagement.js";
import { createSavedAnswersRouter } from "./routes/savedAnswers.js";
import { workHistoryCompanies } from "./shared/savedAnswers.js";
import { allowedModesForTier, canUseAPlusResume, canUseGenerate, canUseMode, hasPlanAtLeast, nextPlan, normalisePlanTier, planForMode } from "./services/entitlements.js";
import { monetisationEnabledFromEnv } from "./shared/monetisation.js";
import { fullAutoState, setSetting, clearSetting, FULL_AUTO_KEY } from "./services/appSettings.js";
import { fullAutoPrerequisites, recordAttestation } from "./services/fullAutoGate.js";
import { getSetting } from "./services/appSettings.js";
import { stripResumeHtml as formatterStripResumeHtml } from "./services/resumeFormatter.js";
import {
  buildAtsResumeBasis,
  extractUserYearsExperience,
  getBaseResumeRecord,
  loadOrCreateSimpleApplyProfile,
  loadSimpleApplyProfile,
  normaliseStructuredFacts,
  profileHasBaseResume,
  saveBaseResumeRecord,
  upsertSimpleApplyProfile,
} from "./services/simpleApplyProfile.js";
import {
  buildSelectedEnhancementSkills,
  computeEnhancementStatus,
  insertProfileEnhancementHistory,
  listProfileClaims,
  listProfileEnhancementHistory,
  markSelectedSuggestionsApplied,
} from "./services/profileSignalAggregator.js";
import {
  buildRuntimeAtsBasis,
  LOCAL_ATS_SOURCE,
  ATS_REPORT_CACHE_KEY,
  scoreAtsLocally,
} from "./services/localAtsScorer.js";
import {
  loadTermWeights, atsWeightStatus, maybeRecomputeTermWeightsAsync, REFRESH_WEIGHT_AGE_DAYS,
  MAX_WEIGHT_AGE_DAYS,
} from "./services/atsTermWeights.js";
// The band, not the number, is what a user is shown — see the header of shared/atsBands.js.
import { atsBandFor } from "./shared/atsBands.js";
import { standaloneAtsResult } from "./services/standaloneAts.js";
import { todaysDeck, validDraftDate, DECK_ORDERS, deckSizeOf } from "./services/dailyDraft.js";
import { roleFamilyForTitle, roleAliasCount } from "./services/searchQueryBuilder.js";
import {
  INTEGRATION_PROVIDERS,
  getAutomationReadiness,
  publicIntegrationRow,
} from "./services/integrationReadiness.js";
import { searchJobs, cacheJobs, reconcileFingerprint } from "./services/jobs/aggregator.js";
// profileMatcher.js deleted in cleanup 5.7. filterAndRankForProfile was imported here and never
// called — the board has been ranked in SQL (ORDER BY in the /api/jobs query) since the pivot,
// so scoreJob's in-memory weighting had no call site. Flagged as dead in bb24241; removed now.
import { isResumeRelevant } from "./services/jobs/relevanceFilter.js";
import {
  buildJobFilters, buildSelectColumns, resolveFacetDimensions, computeSkillsFacet,
  FACET_DIMENSIONS, facetsFromCrossTab, postedSinceSql, roleScopeExtraSql,
} from "./services/jobs/jobQuery.js";
// D24 · GET /api/jobs/facets — the sentence's counts, measured through boardPageResponse itself.
import { boardFacetsResponse } from "./services/jobs/boardFacets.js";
import { createFacetsCache, facetsKey } from "./services/jobs/facetsCache.js";
// ⭐ D151 (45k) · the board's held read ("N more being matched"), kept per user + statement, refreshed behind the answer.
import { createHeldCountCache, heldKey } from "./services/jobs/heldCountCache.js";
import { mapJobRow } from "./services/jobs/mapJobRow.js";
import { describeEmptyBoard, activeFilterNames } from "./services/jobs/emptyBoardReason.js";
// Board ordering AND keyset pagination, generated from one key-list declaration so the ORDER BY
// and the cursor's resume predicate cannot disagree. See services/jobs/jobCursor.js.
import {
  buildOrderKeys, orderByClause, cursorProjection, cursorPredicate, encodeCursor, decodeCursor,
  ordersByFit, ordersByScore, fitBandsSql,
} from "./services/jobs/jobCursor.js";
// The board's fit precompute. It holds no scoring code — server.js injects the panel's own
// basis builder and scorer call (atsBasisForProfile / scoreJobForBasis).
import { createBoardFitPrecompute, atsBasisHash, atsJobInputHash, storedScoreSql, presentedScore, registerScoreFreshness, currentScoreSql } from "./services/jobs/boardFitPrecompute.js";
import { deriveAutomationTier } from "./services/jobs/automationTier.js";
import { backfillAutomationTier } from "./services/jobs/backfillAutomationTier.js";
import { backfillRoleMap } from "./services/jobs/backfillRoleMap.js";
import { remapGeneralRows, REMAP_MATCHED_BY } from "./services/jobs/remapGeneralRoles.js";
import { tagStaleJobs } from "./services/jobs/jobTags.js";
// ⭐ D106: the level a posting's text ASKS for, beside its title's ("Titled Junior · asks for 3+ years and system design").
import { readStaleLevels, levelOfRow } from "./services/jobs/levelRead.js";
import { backfillDescriptionText, withPostingText, refreshDescriptionText, postingText, registerDescriptionBasis, sweepStaleDescriptionBasis } from "./services/jobs/descriptionText.js";
import { backfillProvenanceSlice } from "./services/jobs/enrichmentProvenance.js";
import { nextRowidRange, ACTIVE_JOB_INDEX } from "./services/jobs/rowidWalk.js";
import { listPairs as listLearnedPairs, setPairRevoked, setPairPromoted, PROMOTE_AT_USERS } from "./services/learnedOrigins.js";
import { CRAWLER_PAGE_HTML } from "./services/crawlerPage.js";
import { resolvePlaceText, roleScopeExtra } from "./shared/jobTagVocabulary.js";
import { userReferencedSql } from "./services/jobs/userReferences.js";
import { deliverPipelineAlerts } from "./services/jobs/alertDelivery.js";
import { recordPipelineRun } from "./services/jobs/pipelineRunLog.js";
import { backfillCompanyLogosSlice } from "./services/jobs/backfillCompanyLogos.js";
// A77 — per-company logos, resolved during enrichment and stored first-party.
import { resolveCompanyLogos, resolveCaptureLogo, storedLogo } from "./services/jobs/companyLogoStore.js";
import { deriveProfileFilters } from "./services/jobs/profileFilterBridge.js";
import { suggest, warmSuggestionIndex } from "./services/jobs/searchSuggestions.js";
// Bounds the blast radius of one expiry pass — see services/jobs/cleanupBrake.js and cleanup_log 85.
import { assessCleanupScope, cleanupBrakeOptions } from "./services/jobs/cleanupBrake.js";
// CC3 — the confirmed synonym map, read on the scoring path. See atsSynonyms() below.
import { loadConfirmedSynonyms } from "./services/kb/skillSynonyms.js";
// A72 — the board's ranked local search (tiers, whole words, the same synonym map).
import { registerBoardSearch, boardSearchSql, searchVariants } from "./services/jobs/boardSearch.js";
import { createReadPool } from "./services/db/readWorker.js";
import { createScorePool } from "./services/jobs/scoreWorker.js";
// Y2B — the SAME fetcher and the SAME writer the enrichment pass uses. One implementation, two
// triggers: the background pass buys descriptions for rows it is about to enrich, and this buys
// one for a job a user actually opened. See services/jobs/detailFetch.js.
import { fetchDescription, persistDetailOutcome, hasDetailFetcher } from "./services/jobs/detailFetch.js";
// The filter option contract — the ONE definition of every board filter's value vocabulary.
// GET /api/jobs validates against it (rejectInvalidFilterValues below) so an unknown value is a
// 400 rather than a board that silently matches nothing. See shared/jobFilterOptions.js.
import { FILTER_DIMENSIONS, invalidEntries, ageDaysMap } from "./shared/jobFilterOptions.js";
import { BRAND, SUPPORT_EMAIL, EXTENSION_USER_AGENT, MOBILE_USER_AGENT } from "./shared/brand.js";
import { isExtensionRequest, isExtensionCredential, mayActAsAdmin } from "./shared/authPolicy.js";
import { validateResumeClaims, checkCandidateConsistency } from "./services/kb/failsafe.js";
// The generation-time assertion (assertResumeClaims) runs in the tools service since A4; draft keeps the
// guard's finding form for the kbFindings review surface.
import { profileContradictionFindings, checkResumeClaims } from "./services/resumeClaimGuard.js";
import { createByomRouters } from "./routes/byom.js";
import { purgeByomData } from "./services/byom/policy.js";
import { securityTxt } from "./services/securityTxt.js";
import { createEmailRouters } from "./routes/email.js";
import { sweepEmailEvents } from "./services/emailHealth.js";
import { setMarketingConsent } from "./services/emailConsent.js";
import { resolveEntitlement } from "./services/entitlementResolver.js";
import { buildStructuredResume } from "./services/resumeFormatter.js";
import { skillVocabularyTerms } from "./services/skillVocabulary.js";
import { getCompanyProfile } from "./services/kb/companyProfile.js";
import { artifactCurrency, currencySentence, modeForTool } from "./services/resumeCurrency.js";
import { createBootWarmup } from "./services/boot/bootWarmup.js";

console.log("[boot] server module loaded");
// ⛔⛔ D151 Rule 1: the boot's timeline, and the warm-up that runs AFTER the listener binds (services/boot/bootWarmup.js).
// startedAt is the process's own start, so listenMs is "start → port bound", the number Rule 1 budgets (≤ 3 s).
const BOOT = createBootWarmup({ startedAt: Number(process.hrtime.bigint() / 1000000n) - Math.round(process.uptime() * 1000) });

// ── Config ────────────────────────────────────────────────────
const PORT           = process.env.PORT           || 3001;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY  || "";
// ⭐ A108 (owner 11-01): Apify is gone — no route, no client, no stored token (migration 206 cleared users.apify_token).
// The cron job borrows the most recently active user's token.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET || (IS_PRODUCTION ? "" : "dev-session-secret-change-me");
if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.error("[auth] FATAL: SESSION_SECRET is not set");
  process.exit(1);
}
if (IS_PRODUCTION && process.env.COOKIE_DOMAIN) {
  console.warn("[auth] COOKIE_DOMAIN is set but ignored; host-only session cookies are used for domain migration safety");
}
const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET || SESSION_SECRET;
const OAUTH_PROVIDER_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || process.env.LINKEDIN_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || process.env.LINKEDIN_OAUTH_CLIENT_SECRET || "",
    redirectUri: process.env.LINKEDIN_CALLBACK_URL || process.env.LINKEDIN_OAUTH_REDIRECT_URI || "",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "email"],
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    redirectUri: process.env.GITHUB_CALLBACK_URL || "",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    scopes: ["user:email"],
  },
};
const OAUTH_PROVIDERS = ["google", "linkedin", "github"];
const CACHE_TTL_MS        = 12 * 60 * 60 * 1000;
// The key that seals stored integration secrets — services/secretBox.js. ⛔ Production refuses to
// boot without a valid one, as it does without SESSION_SECRET: until 09-30 an unset key silently
// became a random per-boot key, and production ran that way.
let SECRET_BOX, SECRET_KEY;
try {
  const { key, source } = loadSecretKey(process.env, { isProduction: IS_PRODUCTION });
  SECRET_KEY = key;
  SECRET_BOX = createSecretBox(key);
  console.log(`[boot] secret key: ${source === "env" ? "configured" : "EPHEMERAL (development)"}`);
} catch (e) {
  console.error(`[auth] FATAL: ${e.message}`);
  process.exit(1);
}

// ── Scaling notes ─────────────────────────────────────────────
// Current: single Node.js process + SQLite + @sparticuz/chromium.
// Appropriate for ~50-100 concurrent users.
//
// Migration order when scaling to SaaS:
//
// 1. PDF → Gotenberg (see htmlToPdf() comment block above)
//    Add as Railway Docker sidecar: gotenberg/gotenberg:8
//    Set GOTENBERG_URL env var. Zero per-call RAM overhead.
//    Handles concurrent PDF exports natively.
//
// 2. SESSIONS → Redis (connect-redis replaces connect-sqlite3)
//    npm install connect-redis ioredis
//    store: new RedisStore({ client: new Redis(process.env.REDIS_URL) })
//
// 3. DATABASE → PostgreSQL (pg replaces better-sqlite3)
//    npm install pg
//    All db.prepare().get/all/run() become async pool.query()
//    Railway: add PostgreSQL plugin, use DATABASE_URL env var
//    Migration runner pattern stays the same
//
// 4. JOB SCRAPING → Queue (BullMQ + Redis)
//    Move scrapeJobs() into a worker process
//    API enqueues job, client polls for completion
//    Prevents scrape timeouts on Railway's 30s request limit
//
// 5. STATIC FILES → CDN
//    Push client/dist to Cloudflare R2 or S3
//    Reduces Railway egress costs at scale

// ABSOLUTE EXCLUSION LIST: these companies never appear in generated output.
// To modify this list edit ABSOLUTE COMPANY EXCLUSION in layer1_global_rules.md
// and update this array in sync.
const EXCLUDED_COMPANIES = [
  'apple', 'netflix', 'fidelity',
  'tiktok', 'bytedance',
];

// Strip excluded companies from any employer list before passing to prompt
function sanitiseEmployers(employers) {
  if (!employers?.length) return employers;
  return employers.filter(e =>
    !EXCLUDED_COMPANIES.includes((e || '').toLowerCase().trim())
  );
}

const ATS_SCORE_PROMPT_VERSION = "local-ats-v1";

// RESUME_STYLE_BLOCK lived here unused — a stale copy of the renderer's old design, one of three that
// had drifted apart. The stylesheet is services/resumeFormatter.js's (and the tools service's) since A4.

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function stripResumeHtml(html) {
  return formatterStripResumeHtml(html);
}

function jobAtsSource(job = {}) {
  return [
    job.company || "",
    job.title || "",
    job.category || "",
    job.description || job.title || "",
  ].join("\n");
}

function buildAtsCacheKey(html, job) {
  return hashText([
    ATS_SCORE_PROMPT_VERSION,
    hashText(stripResumeHtml(html)),
    hashText(jobAtsSource(job)),
  ].join(":"));
}

function parseJsonMaybe(text, fallback = null) {
  try { return JSON.parse(text || "null"); } catch { return fallback; }
}

// Delegates to services/resumeCurrency.js, which needs the same mapping to decide whether a stored
// artifact was built by the tool this run wants. Two copies of it would drift the first time a
// third tool is added, and the currency rule would then quietly stop matching anything.
function legacyModeForTool(tool) {
  return modeForTool(tool);
}

function promptModeForTool(tool) {
  return tool === "a_plus_resume" ? "A_PLUS" : "GENERATE";
}

function eventSubtypeForTool(tool) {
  return tool === "a_plus_resume" ? "A_PLUS" : "GENERATE";
}



const INDUSTRY_CATEGORIES = [
  "Fintech / Banking","E-commerce / Retail","Healthcare / Health Tech",
  "Hardware / Embedded / Robotics","Cybersecurity","Data Science / ML / AI",
  "DevOps / Infrastructure / SRE","Product Management","Design / UX",
  "Consulting / Professional Services","Sales / Business Development",
  "Marketing / Growth","Software Engineering","Research / Academia",
  "Operations / Supply Chain","Legal / Compliance","Other",
];

// ── Paths ─────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// RM_DATA_DIR exists so the auth stack can be exercised end to end against a THROWAWAY database.
// Sessions, auth contexts and requireAuth only exist as a whole — passport, the session store and
// bindAuthContext are wired together here in server.js and cannot be mounted piecemeal on a bare
// express app the way routes/*.js can. Verifying them therefore means booting this file, and
// booting this file used to mean writing to the developer's real database. Defaults to exactly the
// previous path, so nothing changes unless something asks it to.
const DATA_DIR  = process.env.RM_DATA_DIR || path.join(__dirname, "data");
const DB_PATH   = path.join(DATA_DIR, "resume_master.db");

// Read from the environment EVERY TIME it is consulted, through the one shared parser, rather than
// cached into a module constant. The env var does not change under a running process in any real
// deployment, so this costs a string compare on gated requests and buys the thing a cached copy
// took away: both states are reachable in one test process, so "lever on refuses / lever off
// serves" can be asserted against the real gate instead of against its source text.
// ⛔ Read shared/monetisation.js before flipping it: ON obliges you to update the Chrome Web Store
// trader declaration in the same change.
const monetisationEnabled = () => monetisationEnabledFromEnv(process.env);
console.log(`[boot] monetisation: ${monetisationEnabled() ? "ENABLED — commercial surfaces live, trader declaration must say TRADER" : "disabled — product presents as free and untiered"}`);
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
console.log(`[boot] data directory ready: ${path.dirname(DB_PATH)}`);

// ── DB ────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
// WAL mode: allows concurrent readers alongside a single writer.
// Critical for multi-user deployments — prevents SQLITE_BUSY lock errors.
db.pragma("journal_mode = WAL");
// A112: a WAL is never shrunk by default — one crawl of 3,916 companies left a 594 MB -wal beside a 1.19 GB database
// (the volume at 70 %). After each checkpoint the file is now truncated back to 64 MB.
db.pragma("journal_size_limit = 67108864");
db.pragma("busy_timeout = 5000");
// A72 — the search tier function the board's WHERE and ORDER BY call (services/jobs/boardSearch.js).
registerBoardSearch(db);
// A85 · the fit filter's "is this stored score current?" — the badge's own test, as a SQL function.
registerScoreFreshness(db);
// D59 · the eligibility filter's "was req_* read from THIS description?" — the readers' freshness rule.
registerDescriptionBasis(db);
console.log(`[boot] database ready: ${DB_PATH}`);
// ⛔ A126 (hotfix 11-05) · the board's heavy reads (GET /api/jobs, /api/jobs/facets, the daily deal) run in worker threads
// with their own read-only connections, so one person's board never freezes everyone's site (services/db/readWorker.js).
// Any failure there falls back to this connection. DRAFT_READ_WORKERS=off turns it off without a deploy of code.
const readPool = createReadPool({
  dbPath: DB_PATH, fallbackDb: db,
  enabled: String(process.env.DRAFT_READ_WORKERS || "on").toLowerCase() !== "off",
  size: Math.max(1, Math.min(4, Number(process.env.DRAFT_READ_WORKERS_SIZE) || 2)),
});
// ⭐ D151 Rule 3 (11-08) · board-fit scoring in a worker thread (services/jobs/scoreWorker.js): the precompute's batches
// are scored off the event loop; any failure scores them here as before. DRAFT_SCORE_WORKER=off turns it off.
const scorePool = createScorePool({
  enabled: String(process.env.DRAFT_SCORE_WORKER || "on").toLowerCase() !== "off",
  size: Math.max(1, Math.min(2, Number(process.env.DRAFT_SCORE_WORKER_SIZE) || 1)),
});
// D153 (3) · the backlog classification walk — created inside the migration block below, used by /api/version and the
// listen callback, so it is declared out here.
let classifyBacklog = null;

// ── Inline migration runner (additive only — never drops data) ─
{
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  );`);

  const MIGRATIONS = [
    {
      id: "001_initial_schema",
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          is_admin INTEGER NOT NULL DEFAULT 0,
          apply_mode TEXT NOT NULL DEFAULT 'SIMPLE',
          apify_token TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS user_profile (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          full_name TEXT, email TEXT, phone TEXT,
          linkedin_url TEXT, github_url TEXT, location TEXT,
          address_line1 TEXT, address_line2 TEXT,
          city TEXT, state TEXT, zip TEXT, country TEXT DEFAULT 'United States',
          gender TEXT, ethnicity TEXT, veteran_status TEXT, disability_status TEXT,
          requires_sponsorship INTEGER NOT NULL DEFAULT 0,
          has_clearance INTEGER NOT NULL DEFAULT 0,
          clearance_level TEXT, visa_type TEXT, work_auth TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS job_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          search_query TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'combined',
          scraped_at INTEGER NOT NULL,
          jobs_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resumes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          category TEXT,
          apply_mode TEXT NOT NULL DEFAULT 'SIMPLE',
          html TEXT NOT NULL,
          ats_score INTEGER,
          ats_report TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS resume_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          category TEXT,
          html TEXT NOT NULL,
          ats_score INTEGER,
          ats_report TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS base_resume (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS job_applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          job_url TEXT,
          source TEXT,
          location TEXT,
          apply_mode TEXT,
          resume_file TEXT,
          applied_at INTEGER,
          notes TEXT,
          UNIQUE(user_id, job_id)
        );
        -- refresh_log removed from the bootstrap schema in cleanup 5.9: zero writers, zero
        -- readers, zero rows. Migration 071 drops it from databases that already have it.
      `,
    },
    {
      id: "002_scraped_jobs_pool",
      sql: `
        CREATE TABLE IF NOT EXISTS scraped_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL UNIQUE,
          search_query TEXT NOT NULL,
          company TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT,
          location TEXT,
          work_type TEXT,
          source TEXT,
          url TEXT,
          posted_at TEXT,
          description TEXT,
          ghost_score INTEGER DEFAULT 0,
          years_experience INTEGER,
          is_frequent_repost INTEGER DEFAULT 0,
          _hash TEXT NOT NULL,
          scraped_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_query
          ON scraped_jobs(search_query, scraped_at);
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_hash
          ON scraped_jobs(_hash);
      `,
    },
    {
      id: "003_user_job_views",
      sql: `
        CREATE TABLE IF NOT EXISTS user_job_views (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          viewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_job_views_user
          ON user_job_views(user_id, job_id);
      `,
    },
    {
      id: "004_user_job_searches",
      sql: `
        CREATE TABLE IF NOT EXISTS user_job_searches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          search_query TEXT NOT NULL,
          last_scraped_at INTEGER,
          UNIQUE(user_id, search_query)
        );
      `,
    },
    {
      id: "005_scraped_jobs_new_columns",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN compensation TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN company_icon_url TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN source_platform TEXT;
        UPDATE scraped_jobs SET source_platform = LOWER(source) WHERE source IS NOT NULL;
      `,
    },
    {
      id: "006_user_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS user_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          visited INTEGER NOT NULL DEFAULT 0,
          applied INTEGER NOT NULL DEFAULT 0,
          starred INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_jobs_user ON user_jobs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_jobs_job ON user_jobs(job_id);
        INSERT OR IGNORE INTO user_jobs (user_id, job_id, applied)
          SELECT user_id, job_id, 1 FROM job_applications;
      `,
    },
    {
      id: "007_scraped_jobs_v5_columns",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN apply_url TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN salary_min REAL;
        ALTER TABLE scraped_jobs ADD COLUMN salary_max REAL;
        ALTER TABLE scraped_jobs ADD COLUMN salary_currency TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_html TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN applicant_count INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN min_years_exp REAL;
        ALTER TABLE scraped_jobs ADD COLUMN max_years_exp REAL;
        ALTER TABLE scraped_jobs ADD COLUMN exp_raw TEXT;
      `,
    },
    {
      id: "008_disliked_and_linkedin_sessions",
      sql: `
        ALTER TABLE user_jobs ADD COLUMN disliked INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_user_jobs_disliked ON user_jobs(user_id, disliked);
        CREATE TABLE IF NOT EXISTS user_linkedin_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          cookies_enc TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      id: "009_profile_name_split_and_pending",
      sql: `
        ALTER TABLE user_profile ADD COLUMN first_name TEXT;
        ALTER TABLE user_profile ADD COLUMN middle_name TEXT;
        ALTER TABLE user_profile ADD COLUMN last_name TEXT;
        ALTER TABLE user_profile ADD COLUMN name_suffix TEXT;
        ALTER TABLE user_jobs ADD COLUMN resume_generated INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "010_apply_automation",
      sql: `
        ALTER TABLE job_applications ADD COLUMN auto_status TEXT;
        ALTER TABLE job_applications ADD COLUMN screenshot_path TEXT;
      `,
    },
    {
      id: "011_cleanup_log",
      sql: `
        CREATE TABLE IF NOT EXISTS cleanup_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_at INTEGER NOT NULL DEFAULT (unixepoch()),
          jobs_deleted INTEGER NOT NULL DEFAULT 0,
          orphans_cleaned INTEGER NOT NULL DEFAULT 0,
          details TEXT
        );
      `,
    },
    {
      id: "012_clear_all_dislikes",
      sql: `UPDATE user_jobs SET disliked = 0 WHERE disliked = 1;`,
    },
    {
      id: "013_employment_type",
      sql: `ALTER TABLE scraped_jobs ADD COLUMN employment_type TEXT;`,
    },
    {
      id: "admin_usage_events",
      sql: `
        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_subtype TEXT,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          cache_read_tokens INTEGER DEFAULT 0,
          cache_creation_tokens INTEGER DEFAULT 0,
          cached INTEGER NOT NULL DEFAULT 0,
          model TEXT,
          cost_usd REAL DEFAULT 0,
          ats_score_before INTEGER,
          ats_score_after INTEGER,
          duration_ms INTEGER,
          job_id TEXT,
          company TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_usage_events_user
          ON usage_events(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_usage_events_type
          ON usage_events(event_type, created_at);
      `,
    },
    {
      id: "admin_user_limits",
      sql: `
        CREATE TABLE IF NOT EXISTS user_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          monthly_resumes INTEGER,
          monthly_ats_scores INTEGER,
          monthly_job_scrapes INTEGER,
          monthly_pdf_exports INTEGER,
          monthly_apply_runs INTEGER,
          monthly_token_budget INTEGER,
          daily_resumes INTEGER,
          daily_job_scrapes INTEGER,
          warning_threshold REAL DEFAULT 0.8,
          notes TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_by INTEGER REFERENCES users(id)
        );
      `,
    },
    {
      id: "admin_cache_events",
      sql: `
        CREATE TABLE IF NOT EXISTS cache_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          layer TEXT,
          domain_module TEXT,
          tokens_in_cache INTEGER DEFAULT 0,
          tokens_saved INTEGER DEFAULT 0,
          cost_saved_usd REAL DEFAULT 0,
          model TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_cache_events_user
          ON cache_events(user_id, created_at);
      `,
    },
    {
      id: "admin_scrape_events",
      sql: `
        CREATE TABLE IF NOT EXISTS scrape_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          search_query TEXT NOT NULL,
          raw_count INTEGER DEFAULT 0,
          filtered_count INTEGER DEFAULT 0,
          inserted_count INTEGER DEFAULT 0,
          duplicate_count INTEGER DEFAULT 0,
          ghost_count INTEGER DEFAULT 0,
          irrelevant_count INTEGER DEFAULT 0,
          duration_ms INTEGER,
          success INTEGER NOT NULL DEFAULT 1,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_scrape_events_user
          ON scrape_events(user_id, created_at);
      `,
    },
    {
      id: "ats_only_reports",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_only_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          ats_report TEXT NOT NULL,
          ats_score INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, job_id)
        );
      `,
    },
    {
      id: "contact_messages",
      sql: `
        CREATE TABLE IF NOT EXISTS contact_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          subject TEXT,
          message TEXT NOT NULL,
          read INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    // ── Phase 2A: Domain profiles ──────────────────────────────
    {
      id: "013_domain_profiles",
      sql: `
        CREATE TABLE IF NOT EXISTS domain_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_name TEXT NOT NULL,
          role_family TEXT NOT NULL,
          domain TEXT NOT NULL,
          seniority TEXT NOT NULL DEFAULT 'mid',
          target_titles JSON NOT NULL DEFAULT '[]',
          selected_keywords JSON NOT NULL DEFAULT '[]',
          selected_verbs JSON NOT NULL DEFAULT '[]',
          selected_tools JSON NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_domain_profiles_user
          ON domain_profiles(user_id, is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_profiles_active
          ON domain_profiles(user_id) WHERE is_active = 1;
      `,
    },
    {
      id: "014_profile_onboarding_flag",
      sql: `
        ALTER TABLE users ADD COLUMN domain_profile_complete INTEGER NOT NULL DEFAULT 0;
      `,
    },
    // ── Phase 5A: Standalone users ─────────────────────────────
    {
      id: "015_standalone_users",
      sql: `
        CREATE TABLE IF NOT EXISTS standalone_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          phone TEXT UNIQUE,
          google_id TEXT UNIQUE,
          display_name TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS standalone_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          standalone_user_id INTEGER REFERENCES standalone_users(id) ON DELETE CASCADE,
          session_id TEXT,
          service TEXT NOT NULL,
          used_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_user
          ON standalone_usage(standalone_user_id, service);
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_session
          ON standalone_usage(session_id, service);
      `,
    },
    // ── Phase 6A: Profile-isolated job pools ──────────────────
    {
      id: "016_scraped_jobs_profile_tag",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL;
        ALTER TABLE user_jobs ADD COLUMN
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_profile
          ON scraped_jobs(domain_profile_id);
        CREATE INDEX IF NOT EXISTS idx_user_jobs_profile
          ON user_jobs(user_id, domain_profile_id);
      `,
    },
    // ── Phase 6B: ATS scoring at scrape time ──────────────────
    {
      id: "017_scraped_jobs_ats",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN ats_score INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN ats_report TEXT;
      `,
    },
    // ── Phase 6C: Resume Enhancer ────────────────────────────
    {
      id: "018_base_resume_enhance",
      sql: `
        ALTER TABLE base_resume ADD COLUMN enhanced_at INTEGER;
        ALTER TABLE base_resume ADD COLUMN enhanced_content TEXT;
        ALTER TABLE base_resume ADD COLUMN enhanced_ats_delta INTEGER;
        ALTER TABLE users ADD COLUMN enhance_used INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN enhance_paid INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "019_notifications",
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type       TEXT    NOT NULL,
          message    TEXT    NOT NULL,
          payload    TEXT,
          read       INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user
          ON notifications(user_id, created_at);
      `,
    },
    {
      id: "020_dock_preferences",
      sql: `
        CREATE TABLE IF NOT EXISTS dock_preferences (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          items_json TEXT    NOT NULL DEFAULT '["profile_switcher","notifications","quick_actions","settings","user_avatar"]',
          dock_enabled INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    // ── Phase 7: Profile isolation backfill ──────────────────
    {
      id: "021_backfill_profile_tags",
      sql: `
        -- Disable foreign key enforcement for this migration
        -- The -1 sentinel approach violates the FK constraint
        -- on domain_profile_id. Use NULL instead of -1 for
        -- unmatched legacy rows and handle exclusion in queries.

        -- Best-effort tag: assign user_jobs rows to the user's
        -- active profile where one exists
        UPDATE user_jobs
        SET domain_profile_id = (
          SELECT dp.id
          FROM domain_profiles dp
          WHERE dp.user_id = user_jobs.user_id
            AND dp.is_active = 1
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL;
      `
    },
    {
      id: "022_clear_legacy_user_jobs",
      sql: `
        -- Remove user_jobs rows that could not be matched
        -- to any domain profile (domain_profile_id still NULL
        -- after backfill means no active profile exists for
        -- that user — safe to clear, they will re-populate
        -- on next search with a profile set)
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications
          );
        -- Applied jobs are always protected regardless
      `
    },
    {
      id: "023_clean_wrong_profile_jobs",
      sql: `
        -- Keep only user_jobs that belong to a valid profile or are applied.
        -- Uses temp table to avoid correlated-subquery limitations in older SQLite.
        CREATE TEMP TABLE IF NOT EXISTS jobs_to_keep AS
          SELECT uj.rowid FROM user_jobs uj
          WHERE uj.domain_profile_id IN (
            SELECT id FROM domain_profiles WHERE user_id = uj.user_id
          )
          OR uj.job_id IN (SELECT job_id FROM job_applications);

        DELETE FROM user_jobs
        WHERE rowid NOT IN (SELECT rowid FROM jobs_to_keep);

        DROP TABLE IF EXISTS jobs_to_keep;
      `
    },
    {
      id: "024_clean_crossprofile_jobs",
      sql: `
        -- Remove user_jobs rows whose domain_profile_id belongs to a different user
        DELETE FROM user_jobs
        WHERE rowid IN (
          SELECT uj.rowid FROM user_jobs uj
          WHERE uj.domain_profile_id IS NOT NULL
            AND uj.domain_profile_id NOT IN (
              SELECT id FROM domain_profiles WHERE user_id = uj.user_id
            )
            AND uj.job_id NOT IN (
              SELECT job_id FROM job_applications WHERE user_id = uj.user_id
            )
        );

        -- Remove NULL-tagged rows that are not applied jobs
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
          );
      `
    },
    {
      id: "025_clean_wrong_profile_jobs",
      sql: `
        -- Remove user_jobs rows with NULL profile tag
        -- that are not applied jobs.
        -- These were inserted by the old search_query
        -- sync before this fix and will never match
        -- any profile filter.
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
        AND job_id NOT IN (
          SELECT job_id FROM job_applications
          WHERE user_id = user_jobs.user_id
        );
      `
    },
    {
      id: "026_backfill_scraped_jobs_profile_tag",
      sql: `
        -- Tag scraped_jobs to the active profile of the user whose
        -- search_query matches, using user_job_searches as the link.
        -- Not perfect for historical data but far better than NULL.
        UPDATE scraped_jobs
        SET domain_profile_id = (
          SELECT dp.id
          FROM user_job_searches ujs
          JOIN domain_profiles dp
            ON dp.user_id = ujs.user_id
            AND dp.is_active = 1
          WHERE LOWER(ujs.search_query) = LOWER(scraped_jobs.search_query)
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL;
      `,
    },
    {
      id: "027_backfill_user_jobs_profile_tag",
      sql: `
        -- Pull domain_profile_id from the scraped_job onto any user_jobs
        -- rows that are still NULL-tagged but whose scraped_job is now tagged.
        UPDATE user_jobs
        SET domain_profile_id = (
          SELECT sj.domain_profile_id
          FROM scraped_jobs sj
          WHERE sj.job_id = user_jobs.job_id
            AND sj.domain_profile_id IS NOT NULL
          LIMIT 1
        )
        WHERE domain_profile_id IS NULL
          AND job_id IN (
            SELECT job_id FROM scraped_jobs WHERE domain_profile_id IS NOT NULL
          );

        -- Remove any remaining NULL-tagged user_jobs that couldn't be matched
        -- and are not applied jobs (safe to drop — they'd never appear anyway).
        DELETE FROM user_jobs
        WHERE domain_profile_id IS NULL
          AND job_id NOT IN (
            SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
          );
      `,
    },
    {
      id: "028_remove_irrelevant_swe_jobs",
      sql: `
        -- Remove from user_jobs any job tagged to an engineering profile
        -- whose title contains no SWE-relevant keyword. These were incorrectly
        -- inserted when the title relevance filter was broken and then backfilled.
        DELETE FROM user_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'engineering'
        )
        AND job_id IN (
          SELECT job_id FROM scraped_jobs
          WHERE (
            LOWER(title) NOT LIKE '%engineer%'
            AND LOWER(title) NOT LIKE '%developer%'
            AND LOWER(title) NOT LIKE '%software%'
            AND LOWER(title) NOT LIKE '%programmer%'
            AND LOWER(title) NOT LIKE '%devops%'
            AND LOWER(title) NOT LIKE '%sre%'
            AND LOWER(title) NOT LIKE '%architect%'
            AND LOWER(title) NOT LIKE '%data%'
            AND LOWER(title) NOT LIKE '%machine learning%'
            AND LOWER(title) NOT LIKE '%ml%'
            AND LOWER(title) NOT LIKE '%ai%'
            AND LOWER(title) NOT LIKE '%backend%'
            AND LOWER(title) NOT LIKE '%frontend%'
            AND LOWER(title) NOT LIKE '%fullstack%'
            AND LOWER(title) NOT LIKE '%full stack%'
            AND LOWER(title) NOT LIKE '%platform%'
            AND LOWER(title) NOT LIKE '%infrastructure%'
            AND LOWER(title) NOT LIKE '%cloud%'
            AND LOWER(title) NOT LIKE '%systems%'
            AND LOWER(title) NOT LIKE '%technical%'
            AND LOWER(title) NOT LIKE '%technology%'
            AND LOWER(title) NOT LIKE '%security%'
            AND LOWER(title) NOT LIKE '%analyst%'
            AND LOWER(title) NOT LIKE '%scientist%'
          )
        )
        AND job_id NOT IN (
          SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
        );

        -- Also purge from scraped_jobs if no user has applied to them
        DELETE FROM scraped_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'engineering'
        )
        AND (
          LOWER(title) NOT LIKE '%engineer%'
          AND LOWER(title) NOT LIKE '%developer%'
          AND LOWER(title) NOT LIKE '%software%'
          AND LOWER(title) NOT LIKE '%programmer%'
          AND LOWER(title) NOT LIKE '%devops%'
          AND LOWER(title) NOT LIKE '%architect%'
          AND LOWER(title) NOT LIKE '%data%'
          AND LOWER(title) NOT LIKE '%machine learning%'
          AND LOWER(title) NOT LIKE '%platform%'
          AND LOWER(title) NOT LIKE '%infrastructure%'
          AND LOWER(title) NOT LIKE '%cloud%'
          AND LOWER(title) NOT LIKE '%systems%'
          AND LOWER(title) NOT LIKE '%technical%'
          AND LOWER(title) NOT LIKE '%security%'
          AND LOWER(title) NOT LIKE '%analyst%'
          AND LOWER(title) NOT LIKE '%scientist%'
        )
        AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications);
      `,
    },
    {
      id: "029_remove_irrelevant_pm_jobs",
      sql: `
        -- Remove from user_jobs any job tagged to a PM profile
        -- whose title contains no PM-relevant keyword.
        DELETE FROM user_jobs
        WHERE domain_profile_id IN (
          SELECT id FROM domain_profiles WHERE role_family = 'pm'
        )
        AND job_id IN (
          SELECT job_id FROM scraped_jobs
          WHERE (
            LOWER(title) NOT LIKE '%project%'
            AND LOWER(title) NOT LIKE '%program%'
            AND LOWER(title) NOT LIKE '%product%'
            AND LOWER(title) NOT LIKE '%manager%'
            AND LOWER(title) NOT LIKE '%coordinator%'
            AND LOWER(title) NOT LIKE '%director%'
            AND LOWER(title) NOT LIKE '%lead%'
            AND LOWER(title) NOT LIKE '%agile%'
            AND LOWER(title) NOT LIKE '%scrum%'
            AND LOWER(title) NOT LIKE '%pmo%'
            AND LOWER(title) NOT LIKE '%delivery%'
            AND LOWER(title) NOT LIKE '%operations%'
          )
        )
        AND job_id NOT IN (
          SELECT job_id FROM job_applications WHERE user_id = user_jobs.user_id
        );
      `,
    },
    {
      id: "030_repair_profile_isolation_contamination",
      sql: `
        -- Repair non-applied profile contamination left by legacy active-profile
        -- and user_job_searches backfills. Applied rows are preserved in
        -- job_applications and hidden from active boards by applied filters.

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
            OR NOT EXISTS (
              SELECT 1 FROM scraped_jobs sj
              WHERE sj.job_id = user_jobs.job_id
                AND sj.domain_profile_id = user_jobs.domain_profile_id
            )
          );

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'engineering')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%engineer%'
          AND LOWER(title) NOT LIKE '%developer%'
          AND LOWER(title) NOT LIKE '%software%'
          AND LOWER(title) NOT LIKE '%programmer%'
          AND LOWER(title) NOT LIKE '%devops%'
          AND LOWER(title) NOT LIKE '%sre%'
          AND LOWER(title) NOT LIKE '%architect%'
          AND LOWER(title) NOT LIKE '%backend%'
          AND LOWER(title) NOT LIKE '%frontend%'
          AND LOWER(title) NOT LIKE '%fullstack%'
          AND LOWER(title) NOT LIKE '%full stack%'
          AND LOWER(title) NOT LIKE '%platform%'
          AND LOWER(title) NOT LIKE '%infrastructure%'
          AND LOWER(title) NOT LIKE '%cloud%'
          AND LOWER(title) NOT LIKE '%systems%'
          AND LOWER(title) NOT LIKE '%security%';

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'pm')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%project%'
          AND LOWER(title) NOT LIKE '%program%'
          AND LOWER(title) NOT LIKE '%product%'
          AND LOWER(title) NOT LIKE '%manager%'
          AND LOWER(title) NOT LIKE '%coordinator%'
          AND LOWER(title) NOT LIKE '%director%'
          AND LOWER(title) NOT LIKE '%lead%'
          AND LOWER(title) NOT LIKE '%agile%'
          AND LOWER(title) NOT LIKE '%scrum%'
          AND LOWER(title) NOT LIKE '%pmo%'
          AND LOWER(title) NOT LIKE '%delivery%'
          AND LOWER(title) NOT LIKE '%operations%';

        UPDATE scraped_jobs
        SET domain_profile_id = NULL
        WHERE domain_profile_id IN (SELECT id FROM domain_profiles WHERE role_family = 'data')
          AND job_id NOT IN (SELECT DISTINCT job_id FROM job_applications)
          AND LOWER(title) NOT LIKE '%data%'
          AND LOWER(title) NOT LIKE '%analytics%'
          AND LOWER(title) NOT LIKE '%analyst%'
          AND LOWER(title) NOT LIKE '%scientist%'
          AND LOWER(title) NOT LIKE '%machine learning%'
          AND LOWER(title) NOT LIKE '%ml%'
          AND LOWER(title) NOT LIKE '%ai%'
          AND LOWER(title) NOT LIKE '%business intelligence%'
          AND LOWER(title) NOT LIKE '%bi%'
          AND LOWER(title) NOT LIKE '%research%'
          AND LOWER(title) NOT LIKE '%quantitative%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND NOT EXISTS (
            SELECT 1 FROM scraped_jobs sj
            WHERE sj.job_id = user_jobs.job_id
              AND sj.domain_profile_id = user_jobs.domain_profile_id
          );
      `,
    },
    // Add future migrations here — never edit existing ones
    {
      id: "031_shared_job_role_map",
      sql: `
        CREATE TABLE IF NOT EXISTS job_role_map (
          job_id TEXT NOT NULL REFERENCES scraped_jobs(job_id) ON DELETE CASCADE,
          role_key TEXT NOT NULL,
          role_family TEXT,
          domain TEXT,
          source_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE SET NULL,
          confidence REAL NOT NULL DEFAULT 1.0,
          matched_by TEXT NOT NULL DEFAULT 'profile_scrape',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (job_id, role_key)
        );
        CREATE INDEX IF NOT EXISTS idx_job_role_map_role
          ON job_role_map(role_key, job_id);
        CREATE INDEX IF NOT EXISTS idx_job_role_map_job
          ON job_role_map(job_id);

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by)
        SELECT sj.job_id,
               LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain)),
               dp.role_family,
               dp.domain,
               dp.id,
               0.8,
               'legacy_domain_profile_id'
        FROM scraped_jobs sj
        JOIN domain_profiles dp ON dp.id = sj.domain_profile_id;

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'engineering', 'engineering', 'engineering', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%engineer%'
           OR LOWER(title) LIKE '%developer%'
           OR LOWER(title) LIKE '%software%'
           OR LOWER(title) LIKE '%devops%'
           OR LOWER(title) LIKE '%sre%'
           OR LOWER(title) LIKE '%backend%'
           OR LOWER(title) LIKE '%frontend%'
           OR LOWER(title) LIKE '%full stack%'
           OR LOWER(title) LIKE '%fullstack%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'pm', 'pm', 'pm_general', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%project%'
           OR LOWER(title) LIKE '%program%'
           OR LOWER(title) LIKE '%product%'
           OR LOWER(title) LIKE '%scrum%'
           OR LOWER(title) LIKE '%pmo%'
           OR LOWER(title) LIKE '%delivery manager%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.6, 'title_heuristic'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%data%'
           OR LOWER(title) LIKE '%analytics%'
           OR LOWER(title) LIKE '%analyst%'
           OR LOWER(title) LIKE '%scientist%'
           OR LOWER(title) LIKE '%machine learning%'
           OR LOWER(title) LIKE '%business intelligence%';
      `,
    },
    {
      id: "032_password_reset_tokens",
      sql: `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          otp_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          request_ip TEXT,
          user_agent TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_password_reset_user
          ON password_reset_tokens(user_id, used_at, expires_at);
        CREATE INDEX IF NOT EXISTS idx_password_reset_expires
          ON password_reset_tokens(expires_at);
      `,
    },
    {
      id: "033_plan_tiers_and_simple_apply_profile",
      sql: `
        ALTER TABLE users ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'BASIC';
        UPDATE users
        SET plan_tier = CASE
          WHEN apply_mode = 'CUSTOM_SAMPLER' THEN 'PRO'
          WHEN apply_mode = 'TAILORED' THEN 'PLUS'
          ELSE 'BASIC'
        END;

        CREATE TABLE IF NOT EXISTS plan_upgrade_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          requested_tier TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          decided_at INTEGER,
          decided_by INTEGER REFERENCES users(id),
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_plan_upgrade_requests_status
          ON plan_upgrade_requests(status, requested_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_upgrade_one_pending
          ON plan_upgrade_requests(user_id) WHERE status = 'pending';

        CREATE TABLE IF NOT EXISTS simple_apply_profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          titles_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          search_terms_json TEXT NOT NULL DEFAULT '[]',
          source_hash TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      id: "034_plan_reset_and_profile_repair",
      sql: `
        UPDATE users
        SET plan_tier = 'BASIC'
        WHERE plan_tier IS NULL
           OR plan_tier NOT IN ('BASIC','PLUS','PRO');

        UPDATE users
        SET apply_mode = CASE plan_tier
          WHEN 'PRO' THEN 'CUSTOM_SAMPLER'
          WHEN 'PLUS' THEN 'TAILORED'
          ELSE 'SIMPLE'
        END
        WHERE apply_mode IS NULL
           OR apply_mode NOT IN ('SIMPLE','TAILORED','CUSTOM_SAMPLER')
           OR (plan_tier = 'BASIC' AND apply_mode != 'SIMPLE')
           OR (plan_tier = 'PLUS' AND apply_mode != 'TAILORED')
           OR (plan_tier = 'PRO' AND apply_mode != 'CUSTOM_SAMPLER');

        DELETE FROM password_reset_tokens
        WHERE used_at IS NOT NULL
           OR expires_at <= unixepoch() - 86400;

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
          );
      `,
    },
    {
      id: "035_prune_stale_role_maps",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%engineer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%developer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%software%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%programmer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%devops%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%sre%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%architect%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%backend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%frontend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%fullstack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%full stack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%platform%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%infrastructure%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%cloud%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%systems%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%security%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND NOT EXISTS (
            SELECT 1 FROM job_role_map jrm
            JOIN domain_profiles dp
              ON dp.id = user_jobs.domain_profile_id
             AND jrm.role_key = LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain))
            WHERE jrm.job_id = user_jobs.job_id
          );
      `,
    },
    {
      id: "036_console_tier_profile_repair",
      sql: `
        UPDATE users
        SET plan_tier = 'BASIC'
        WHERE plan_tier IS NULL
           OR plan_tier NOT IN ('BASIC','PLUS','PRO');

        UPDATE users
        SET apply_mode = CASE plan_tier
          WHEN 'PRO' THEN 'CUSTOM_SAMPLER'
          WHEN 'PLUS' THEN 'TAILORED'
          ELSE 'SIMPLE'
        END
        WHERE apply_mode IS NULL
           OR apply_mode NOT IN ('SIMPLE','TAILORED','CUSTOM_SAMPLER')
           OR (plan_tier = 'BASIC' AND apply_mode != 'SIMPLE')
           OR (plan_tier = 'PLUS' AND apply_mode != 'TAILORED')
           OR (plan_tier = 'PRO' AND apply_mode != 'CUSTOM_SAMPLER');

        DELETE FROM job_role_map
        WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs);

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%engineer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%developer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%software%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%programmer%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%devops%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%sre%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%architect%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%backend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%frontend%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%fullstack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%full stack%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%platform%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%infrastructure%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%cloud%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%systems%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%security%';

        DELETE FROM job_role_map
        WHERE role_key = 'pm'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%project%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%program%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%product%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%manager%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%coordinator%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%director%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%agile%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%scrum%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%pmo%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%delivery%';

        DELETE FROM job_role_map
        WHERE role_key = 'data'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%data%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%analytics%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%analyst%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%scientist%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%machine learning%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%ml%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%ai%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%business intelligence%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%bi%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%research%'
          AND LOWER((SELECT title FROM scraped_jobs sj WHERE sj.job_id = job_role_map.job_id)) NOT LIKE '%quantitative%';

        DELETE FROM user_jobs
        WHERE applied = 0
          AND (
            domain_profile_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM domain_profiles dp
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
            OR NOT EXISTS (
              SELECT 1
              FROM domain_profiles dp
              JOIN job_role_map jrm
                ON jrm.job_id = user_jobs.job_id
               AND jrm.role_key = LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain))
              WHERE dp.id = user_jobs.domain_profile_id
                AND dp.user_id = user_jobs.user_id
            )
          );
      `,
    },
    {
      id: "037_domain_profile_requests",
      sql: `
        CREATE TABLE IF NOT EXISTS domain_profile_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          desired_title TEXT NOT NULL,
          role_family TEXT,
          target_titles_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          tools_json TEXT NOT NULL DEFAULT '[]',
          industries_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          seniority TEXT,
          work_preference TEXT,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_domain_profile_requests_status
          ON domain_profile_requests(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_domain_profile_requests_user
          ON domain_profile_requests(user_id, created_at);
      `,
    },
    {
      id: "038_role_map_ml_pm_repair",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%machine learning%'
               OR LOWER(title) LIKE '%ml engineer%'
               OR LOWER(title) LIKE '%ai engineer%'
               OR LOWER(title) LIKE '%artificial intelligence%'
               OR LOWER(title) LIKE '%llm%'
               OR LOWER(title) LIKE '%genai%'
               OR LOWER(title) LIKE '%generative ai%'
               OR LOWER(title) LIKE '%project manager%'
               OR LOWER(title) LIKE '%program manager%'
               OR LOWER(title) LIKE '%product manager%'
               OR LOWER(title) LIKE '%project coordinator%'
               OR LOWER(title) LIKE '%scrum master%'
               OR LOWER(title) LIKE '%pmo%'
          );

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.95, 'ml_ai_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%machine learning%'
           OR LOWER(title) LIKE '%ml engineer%'
           OR LOWER(title) LIKE '%ai engineer%'
           OR LOWER(title) LIKE '%artificial intelligence%'
           OR LOWER(title) LIKE '%llm%'
           OR LOWER(title) LIKE '%genai%'
           OR LOWER(title) LIKE '%generative ai%';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'pm', 'pm', 'pm_general', 0.95, 'pm_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%project manager%'
           OR LOWER(title) LIKE '%program manager%'
           OR LOWER(title) LIKE '%product manager%'
           OR LOWER(title) LIKE '%project coordinator%'
           OR LOWER(title) LIKE '%scrum master%'
           OR LOWER(title) LIKE '%pmo%';
      `,
    },
    {
      id: "039_resume_version_tool_artifacts",
      sql: `
        ALTER TABLE resume_versions ADD COLUMN tool_type TEXT NOT NULL DEFAULT 'generate';
        ALTER TABLE resume_versions ADD COLUMN is_kept INTEGER NOT NULL DEFAULT 0;
        UPDATE resume_versions
        SET tool_type = CASE
          WHEN EXISTS (
            SELECT 1 FROM resumes r
            WHERE r.user_id = resume_versions.user_id
              AND r.job_id = resume_versions.job_id
              AND r.apply_mode = 'CUSTOM_SAMPLER'
          ) THEN 'a_plus_resume'
          ELSE 'generate'
        END
        WHERE tool_type IS NULL OR tool_type = '';
      `,
    },
    {
      id: "040_tab_scoped_auth_contexts",
      sql: `
        CREATE TABLE IF NOT EXISTS auth_contexts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          revoked_at INTEGER,
          user_agent TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_user
          ON auth_contexts(user_id, revoked_at, expires_at);
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_expiry
          ON auth_contexts(expires_at, revoked_at);
      `,
    },
    {
      id: "041_resume_ats_cache_metadata",
      sql: `
        ALTER TABLE resumes ADD COLUMN ats_cache_key TEXT;
        ALTER TABLE resumes ADD COLUMN ats_prompt_version TEXT;
        ALTER TABLE resume_versions ADD COLUMN ats_cache_key TEXT;
        ALTER TABLE resume_versions ADD COLUMN ats_prompt_version TEXT;
        CREATE INDEX IF NOT EXISTS idx_resume_versions_ats_cache
          ON resume_versions(user_id, job_id, tool_type, ats_cache_key);
      `,
    },
    {
      id: "042_apply_runs_queue",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          mode TEXT NOT NULL DEFAULT 'auto',
          tool_type TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          total_jobs INTEGER NOT NULL DEFAULT 0,
          submitted_count INTEGER NOT NULL DEFAULT 0,
          held_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          started_at INTEGER,
          finished_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS apply_run_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL REFERENCES apply_runs(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          reason_code TEXT,
          reason_detail TEXT,
          ats_score INTEGER,
          resume_id INTEGER,
          resume_file TEXT,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          locked_at INTEGER,
          started_at INTEGER,
          finished_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(run_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS apply_job_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER,
          run_job_id INTEGER,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT,
          level TEXT NOT NULL DEFAULT 'info',
          event TEXT NOT NULL,
          message TEXT,
          details_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_apply_runs_user_status ON apply_runs(user_id, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_user_status ON apply_run_jobs(user_id, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_apply_logs_run ON apply_job_logs(run_id, run_job_id, created_at);
      `,
    },
    {
      id: "043_user_integrations",
      sql: `
        CREATE TABLE IF NOT EXISTS user_integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          account_email TEXT,
          status TEXT NOT NULL DEFAULT 'connected',
          scopes_json TEXT NOT NULL DEFAULT '[]',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          secret_enc TEXT,
          iv TEXT,
          auth_tag TEXT,
          expires_at INTEGER,
          last_checked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, provider)
        );
        CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider
          ON user_integrations(user_id, provider, status);
      `,
    },
    {
      id: "044_auth_provider_links",
      sql: `
        ALTER TABLE users ADD COLUMN google_auth_id TEXT;
        ALTER TABLE users ADD COLUMN linkedin_auth_id TEXT;
        ALTER TABLE user_integrations ADD COLUMN provider_user_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_auth_id
          ON users(google_auth_id) WHERE google_auth_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linkedin_auth_id
          ON users(linkedin_auth_id) WHERE linkedin_auth_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_user_integrations_provider_identity
          ON user_integrations(provider, provider_user_id);
      `,
    },
    {
      id: "053_github_auth_provider_link",
      sql: `
        ALTER TABLE users ADD COLUMN github_auth_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_auth_id
          ON users(github_auth_id) WHERE github_auth_id IS NOT NULL;
      `,
    },
    {
      // Repair: firmware/embedded jobs were bulk-assigned role_key='engineering' by
      // the title_heuristic in migration 031 and were never corrected.  This migration:
      //   1. Adds role_key='engineering_embedded_firmware' for jobs scraped under
      //      firmware domain profiles.
      //   2. Adds role_key='engineering_embedded_firmware' for jobs whose title
      //      clearly indicates firmware/embedded work (title heuristic).
      //   3. Removes the stale role_key='engineering' entries that arrived via the
      //      generic title_heuristic for those same jobs — so SWE users never see
      //      them even if roleKeyForProfile returns 'engineering'.
      //   Jobs that were explicitly scraped under a SWE profile (matched_by =
      //   'profile_scrape') keep their 'engineering' entry so they remain visible
      //   to the scraping user; the roleTitleSql firmware exclusions still prevent
      //   them from surfacing in SWE results for other users.
      id: "045_firmware_role_map_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT jrm.job_id,
               'engineering_embedded_firmware',
               'engineering',
               'engineering_embedded_firmware',
               0.95,
               'firmware_profile_repair'
        FROM job_role_map jrm
        JOIN domain_profiles dp ON dp.id = jrm.source_profile_id
        WHERE jrm.role_key = 'engineering'
          AND dp.domain = 'engineering_embedded_firmware';

        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id,
               'engineering_embedded_firmware',
               'engineering',
               'engineering_embedded_firmware',
               0.9,
               'firmware_title_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%firmware%'
           OR LOWER(title) LIKE '%embedded%'
           OR LOWER(title) LIKE '%bsp%'
           OR LOWER(title) LIKE '%device driver%'
           OR LOWER(title) LIKE '%silicon validation%'
           OR LOWER(title) LIKE '%post-silicon%'
           OR LOWER(title) LIKE '%post silicon%'
           OR LOWER(title) LIKE '%soc bring%'
           OR LOWER(title) LIKE '%board bring%'
           OR LOWER(title) LIKE '%chip bring%'
           OR LOWER(title) LIKE '%bootloader%'
           OR LOWER(title) LIKE '%rtos%'
           OR LOWER(title) LIKE '% bios %'
           OR LOWER(title) LIKE 'bios %'
           OR LOWER(title) LIKE '%uefi%';

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by = 'title_heuristic'
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%firmware%'
               OR LOWER(title) LIKE '%embedded%'
               OR LOWER(title) LIKE '%bsp%'
               OR LOWER(title) LIKE '%device driver%'
               OR LOWER(title) LIKE '%silicon validation%'
               OR LOWER(title) LIKE '%post-silicon%'
               OR LOWER(title) LIKE '%post silicon%'
               OR LOWER(title) LIKE '%soc bring%'
               OR LOWER(title) LIKE '%board bring%'
               OR LOWER(title) LIKE '%chip bring%'
               OR LOWER(title) LIKE '%bootloader%'
               OR LOWER(title) LIKE '%rtos%'
               OR LOWER(title) LIKE '% bios %'
               OR LOWER(title) LIKE 'bios %'
               OR LOWER(title) LIKE '%uefi%'
          );
      `,
    },
    {
      // Repair: data scientist / data engineer / analytics engineer titles
      // were incorrectly assigned role_key='engineering' in two ways:
      //   1. Scraped under an engineering profile (assignJobRoleMap => 'engineering')
      //   2. Title matched '%engineer%' / '%developer%' in migration 031 heuristic
      // Migration 038 already handled ML/AI/PM titles.  This migration extends that
      // repair to cover data-family specialty titles that were missed.
      //
      // Only removes heuristic and profile-scrape engineering entries — manual_review
      // entries are preserved (admin override must win).
      id: "046_data_specialty_role_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT job_id, 'data', 'data', 'data', 0.95, 'data_specialty_repair'
        FROM scraped_jobs
        WHERE LOWER(title) LIKE '%data scientist%'
           OR LOWER(title) LIKE '%data engineer%'
           OR LOWER(title) LIKE '%analytics engineer%'
           OR LOWER(title) LIKE '%research scientist%'
           OR LOWER(title) LIKE '%applied scientist%'
           OR LOWER(title) LIKE '%ml platform engineer%'
           OR LOWER(title) LIKE '%mlops engineer%';

        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by IN ('title_heuristic', 'legacy_domain_profile_id',
                             'duplicate_profile_scrape', 'profile_scrape')
          AND job_id IN (
            SELECT job_id FROM scraped_jobs
            WHERE LOWER(title) LIKE '%data scientist%'
               OR LOWER(title) LIKE '%data engineer%'
               OR LOWER(title) LIKE '%analytics engineer%'
               OR LOWER(title) LIKE '%research scientist%'
               OR LOWER(title) LIKE '%applied scientist%'
               OR LOWER(title) LIKE '%ml platform engineer%'
               OR LOWER(title) LIKE '%mlops engineer%'
          );
      `,
    },
    {
      // 047 — Repair existing orphaned jobs that have no job_role_map entry.
      //
      // These are jobs that were scraped without a domainProfile (admin scrapes,
      // profiles deleted post-scrape, or pre-046 legacy ingests) and therefore
      // fell through the assignJobRoleMap() guard.  The ingest-time classifier
      // now handles new orphans; this migration back-fills the historical gap
      // using the same high-confidence title patterns.
      //
      // Only assigns role_key when the title strongly matches a single family.
      // Preserves manual_review entries — admin overrides are never touched.
      id: "047_orphaned_job_classifier_repair",
      sql: `
        INSERT OR IGNORE INTO job_role_map
          (job_id, role_key, role_family, domain, confidence, matched_by)
        SELECT sj.job_id,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering_embedded_firmware'
                 WHEN LOWER(sj.title) LIKE '%machine learning engineer%'
                   OR LOWER(sj.title) LIKE '%data scientist%'
                   OR LOWER(sj.title) LIKE '%data engineer%'
                   OR LOWER(sj.title) LIKE '%analytics engineer%'
                   OR LOWER(sj.title) LIKE '%ml engineer%'
                   OR LOWER(sj.title) LIKE '%ai engineer%'
                   OR LOWER(sj.title) LIKE '%research scientist%'
                   OR LOWER(sj.title) LIKE '%applied scientist%'
                 THEN 'data'
                 WHEN LOWER(sj.title) LIKE '%product manager%'
                   OR LOWER(sj.title) LIKE '%project manager%'
                   OR LOWER(sj.title) LIKE '%program manager%'
                   OR LOWER(sj.title) LIKE '%scrum master%'
                   OR LOWER(sj.title) LIKE '%product owner%'
                 THEN 'pm'
                 WHEN LOWER(sj.title) LIKE '%software engineer%'
                   OR LOWER(sj.title) LIKE '%backend engineer%'
                   OR LOWER(sj.title) LIKE '%frontend engineer%'
                   OR LOWER(sj.title) LIKE '%full stack engineer%'
                   OR LOWER(sj.title) LIKE '%devops engineer%'
                   OR LOWER(sj.title) LIKE '%site reliability engineer%'
                   OR LOWER(sj.title) LIKE '%software developer%'
                   OR LOWER(sj.title) LIKE '%platform engineer%'
                   OR LOWER(sj.title) LIKE '%mobile engineer%'
                 THEN 'engineering'
               END AS role_key,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering'
                 WHEN LOWER(sj.title) LIKE '%machine learning engineer%'
                   OR LOWER(sj.title) LIKE '%data scientist%'
                   OR LOWER(sj.title) LIKE '%data engineer%'
                   OR LOWER(sj.title) LIKE '%analytics engineer%'
                   OR LOWER(sj.title) LIKE '%ml engineer%'
                   OR LOWER(sj.title) LIKE '%ai engineer%'
                   OR LOWER(sj.title) LIKE '%research scientist%'
                   OR LOWER(sj.title) LIKE '%applied scientist%'
                 THEN 'data'
                 ELSE role_key
               END AS role_family,
               CASE
                 WHEN LOWER(sj.title) LIKE '%firmware engineer%'
                   OR LOWER(sj.title) LIKE '%embedded systems engineer%'
                   OR LOWER(sj.title) LIKE '%bsp engineer%'
                   OR LOWER(sj.title) LIKE '%uefi engineer%'
                   OR LOWER(sj.title) LIKE '%device driver engineer%'
                   OR LOWER(sj.title) LIKE '%bootloader engineer%'
                   OR LOWER(sj.title) LIKE '%rtos engineer%'
                 THEN 'engineering_embedded_firmware'
                 WHEN LOWER(sj.title) LIKE '%software engineer%'
                   OR LOWER(sj.title) LIKE '%backend engineer%'
                   OR LOWER(sj.title) LIKE '%frontend engineer%'
                   OR LOWER(sj.title) LIKE '%full stack engineer%'
                   OR LOWER(sj.title) LIKE '%devops engineer%'
                   OR LOWER(sj.title) LIKE '%site reliability engineer%'
                   OR LOWER(sj.title) LIKE '%software developer%'
                   OR LOWER(sj.title) LIKE '%platform engineer%'
                   OR LOWER(sj.title) LIKE '%mobile engineer%'
                 THEN 'it_digital'
                 ELSE role_key
               END AS domain,
               0.85 AS confidence,
               'orphan_repair' AS matched_by
        FROM scraped_jobs sj
        LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id
        WHERE jrm.job_id IS NULL
          AND (
            LOWER(sj.title) LIKE '%firmware engineer%'
            OR LOWER(sj.title) LIKE '%embedded systems engineer%'
            OR LOWER(sj.title) LIKE '%bsp engineer%'
            OR LOWER(sj.title) LIKE '%uefi engineer%'
            OR LOWER(sj.title) LIKE '%device driver engineer%'
            OR LOWER(sj.title) LIKE '%bootloader engineer%'
            OR LOWER(sj.title) LIKE '%rtos engineer%'
            OR LOWER(sj.title) LIKE '%machine learning engineer%'
            OR LOWER(sj.title) LIKE '%data scientist%'
            OR LOWER(sj.title) LIKE '%data engineer%'
            OR LOWER(sj.title) LIKE '%analytics engineer%'
            OR LOWER(sj.title) LIKE '%ml engineer%'
            OR LOWER(sj.title) LIKE '%ai engineer%'
            OR LOWER(sj.title) LIKE '%research scientist%'
            OR LOWER(sj.title) LIKE '%applied scientist%'
            OR LOWER(sj.title) LIKE '%product manager%'
            OR LOWER(sj.title) LIKE '%project manager%'
            OR LOWER(sj.title) LIKE '%program manager%'
            OR LOWER(sj.title) LIKE '%scrum master%'
            OR LOWER(sj.title) LIKE '%product owner%'
            OR LOWER(sj.title) LIKE '%software engineer%'
            OR LOWER(sj.title) LIKE '%backend engineer%'
            OR LOWER(sj.title) LIKE '%frontend engineer%'
            OR LOWER(sj.title) LIKE '%full stack engineer%'
            OR LOWER(sj.title) LIKE '%devops engineer%'
            OR LOWER(sj.title) LIKE '%site reliability engineer%'
            OR LOWER(sj.title) LIKE '%software developer%'
            OR LOWER(sj.title) LIKE '%platform engineer%'
            OR LOWER(sj.title) LIKE '%mobile engineer%'
          );
      `,
    },
    {
      // Migration 048 — Re-classify existing job_role_map entries that were assigned
      // role_key='engineering' via automated classifiers but whose title clearly indicates
      // firmware/embedded. Runs in two idempotent steps:
      //
      // Step 1: DELETE stale 'engineering' rows for jobs that already have an
      //   'engineering_embedded_firmware' row — these are duplicates from migration 047,
      //   the ingest classifier, or a prior partial run of 048. Updating them would hit
      //   the UNIQUE(job_id, role_key) constraint. Deleting them is safe because the
      //   correct mapping already exists.
      //
      // Step 2: UPDATE remaining 'engineering' firmware-title rows to
      //   'engineering_embedded_firmware'. After Step 1, no conflict is possible.
      //   Both steps are no-ops on a clean or already-processed database.
      id: "048_firmware_reclassify",
      sql: `
        DELETE FROM job_role_map
        WHERE role_key = 'engineering'
          AND matched_by IN ('profile_scrape','orphan_repair','strong_anchor','strong_anchor+desc')
          AND job_id IN (
            SELECT jrm2.job_id FROM job_role_map jrm2
            WHERE jrm2.role_key = 'engineering_embedded_firmware'
          )
          AND job_id IN (
            SELECT sj.job_id FROM scraped_jobs sj
            WHERE LOWER(sj.title) LIKE '%firmware%'
               OR LOWER(sj.title) LIKE '%embedded system%'
               OR LOWER(sj.title) LIKE '% bsp %'
               OR LOWER(sj.title) LIKE 'bsp %'
               OR LOWER(sj.title) LIKE '%bsp engineer%'
               OR LOWER(sj.title) LIKE '% uefi %'
               OR LOWER(sj.title) LIKE '%uefi engineer%'
               OR LOWER(sj.title) LIKE '%device driver%'
               OR LOWER(sj.title) LIKE '%bootloader%'
               OR LOWER(sj.title) LIKE '% rtos %'
               OR LOWER(sj.title) LIKE '%rtos engineer%'
          );

        UPDATE job_role_map
        SET role_key    = 'engineering_embedded_firmware',
            role_family = 'engineering',
            domain      = 'engineering_embedded_firmware',
            confidence  = 0.88,
            matched_by  = 'firmware_reclassify'
        WHERE role_key = 'engineering'
          AND matched_by IN ('profile_scrape','orphan_repair','strong_anchor','strong_anchor+desc')
          AND job_id IN (
            SELECT sj.job_id FROM scraped_jobs sj
            WHERE LOWER(sj.title) LIKE '%firmware%'
               OR LOWER(sj.title) LIKE '%embedded system%'
               OR LOWER(sj.title) LIKE '% bsp %'
               OR LOWER(sj.title) LIKE 'bsp %'
               OR LOWER(sj.title) LIKE '%bsp engineer%'
               OR LOWER(sj.title) LIKE '% uefi %'
               OR LOWER(sj.title) LIKE '%uefi engineer%'
               OR LOWER(sj.title) LIKE '%device driver%'
               OR LOWER(sj.title) LIKE '%bootloader%'
               OR LOWER(sj.title) LIKE '% rtos %'
               OR LOWER(sj.title) LIKE '%rtos engineer%'
          );
      `,
    },
    {
      id: "049_simple_apply_profile_yoe",
      sql: `
        ALTER TABLE simple_apply_profiles ADD COLUMN years_experience INTEGER;
      `,
    },
    {
      id: "050_profile_scoped_resume_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_base_resumes (
          profile_id INTEGER PRIMARY KEY REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT,
          content TEXT NOT NULL,
          enhanced_content TEXT,
          enhanced_at INTEGER,
          enhanced_ats_delta INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_base_resumes_user
          ON profile_base_resumes(user_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS profile_simple_apply_profiles (
          profile_id INTEGER PRIMARY KEY REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          titles_json TEXT NOT NULL DEFAULT '[]',
          keywords_json TEXT NOT NULL DEFAULT '[]',
          skills_json TEXT NOT NULL DEFAULT '[]',
          search_terms_json TEXT NOT NULL DEFAULT '[]',
          source_hash TEXT,
          years_experience INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_simple_apply_profiles_user
          ON profile_simple_apply_profiles(user_id, updated_at DESC);
      `,
    },
    {
      id: "051_imported_saved_jobs",
      sql: `
        CREATE TABLE IF NOT EXISTS imported_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source_key TEXT NOT NULL,
          source_label TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          external_job_id TEXT,
          dedupe_key TEXT NOT NULL,
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          location TEXT,
          job_url TEXT,
          apply_url TEXT,
          work_type TEXT,
          employment_type TEXT,
          compensation TEXT,
          posted_at TEXT,
          description TEXT,
          company_icon_url TEXT,
          payload_json TEXT,
          visited INTEGER NOT NULL DEFAULT 0,
          starred INTEGER NOT NULL DEFAULT 0,
          disliked INTEGER NOT NULL DEFAULT 0,
          applied INTEGER NOT NULL DEFAULT 0,
          import_count INTEGER NOT NULL DEFAULT 1,
          first_imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, source_key, dedupe_key)
        );
        CREATE INDEX IF NOT EXISTS idx_imported_jobs_user_source
          ON imported_jobs(user_id, source_key, last_imported_at DESC);
        CREATE INDEX IF NOT EXISTS idx_imported_jobs_user_flags
          ON imported_jobs(user_id, disliked, starred, applied);
      `,
    },
    {
      id: "052_profile_enhancement_signals",
      sql: `
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN citizenship_status TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN work_authorization TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN requires_sponsorship INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN has_clearance INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN clearance_level TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN degree_level TEXT;
        ALTER TABLE profile_simple_apply_profiles ADD COLUMN enhancement_notified_at INTEGER;

        CREATE TABLE IF NOT EXISTS profile_signal_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          signal_key TEXT NOT NULL,
          signal_label TEXT NOT NULL,
          signal_kind TEXT NOT NULL,
          structured_field TEXT,
          frequency INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'inactive',
          first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          selected_at INTEGER,
          applied_at INTEGER,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(profile_id, signal_key)
        );
        CREATE INDEX IF NOT EXISTS idx_profile_signal_suggestions_profile
          ON profile_signal_suggestions(profile_id, status, signal_kind, frequency DESC);

        CREATE TABLE IF NOT EXISTS profile_resume_enhancements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES domain_profiles(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          base_resume_content TEXT NOT NULL,
          enhanced_content TEXT NOT NULL,
          selected_skills_json TEXT NOT NULL DEFAULT '[]',
          ats_delta INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          adopted_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_profile_resume_enhancements_profile
          ON profile_resume_enhancements(profile_id, created_at DESC);
      `,
    },
    {
      id: "054_aplus_resume_flag",
      sql: `ALTER TABLE users ADD COLUMN aplus_resume INTEGER NOT NULL DEFAULT 0;`,
    },
    {
      id: "055_user_profile_skills",
      sql: `
        ALTER TABLE user_profile ADD COLUMN confirmed_skills TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_skills    TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_domains   TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN target_locations TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE user_profile ADD COLUMN seniority_level  TEXT;
        ALTER TABLE user_profile ADD COLUMN onboarded        INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      id: "056_company_ats_list",
      sql: `
        CREATE TABLE IF NOT EXISTS company_ats_list (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          company     TEXT NOT NULL,
          ats_type    TEXT NOT NULL,
          ats_slug    TEXT NOT NULL,
          active      INTEGER NOT NULL DEFAULT 1,
          bucket_role TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(ats_type, ats_slug)
        );
        INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, bucket_role) VALUES
          ('Stripe',     'greenhouse','stripe',        'software_engineer'),
          ('Airbnb',     'greenhouse','airbnb',        'software_engineer'),
          ('Figma',      'greenhouse','figma',         'software_engineer'),
          ('Notion',     'greenhouse','notionhq',      'software_engineer'),
          ('OpenAI',     'greenhouse','openai',        'software_engineer'),
          ('Anthropic',  'greenhouse','anthropic',     'software_engineer'),
          ('Rippling',   'greenhouse','rippling',      'software_engineer'),
          ('Brex',       'greenhouse','brex',          'software_engineer'),
          ('Duolingo',   'greenhouse','duolingo',      'software_engineer'),
          ('Scale AI',   'greenhouse','scaleai',       'software_engineer'),
          ('Ramp',       'lever',     'ramp',          'software_engineer'),
          ('Mercury',    'lever',     'mercury',       'software_engineer'),
          ('Retool',     'lever',     'retool',        'software_engineer'),
          ('Linear',     'ashby',     'linear',        'software_engineer'),
          ('Vercel',     'ashby',     'vercel',        'software_engineer');
      `,
    },
    {
      id: "057_scraped_jobs_buckets",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN bucket_role      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN bucket_seniority TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN bucket_domain    TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN direct_apply     INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE scraped_jobs ADD COLUMN source_label     TEXT;
      `,
    },
    {
      id: "058_scraped_jobs_via",
      sql: `ALTER TABLE scraped_jobs ADD COLUMN via TEXT;`,
    },
    {
      // Adds collar + confidence columns to scraped_jobs and the rejected_jobs
      // audit table used by the blue-collar eject gate (Phase 4+).
      // ALTER TABLE ADD COLUMN runs once; idempotency is guaranteed by the
      // schema_migrations tracker (this id is never re-applied).
      // CREATE TABLE/INDEX IF NOT EXISTS are unconditionally idempotent.
      id: "059_jobs_segregation",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN collar TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN classification_confidence REAL;
        CREATE TABLE IF NOT EXISTS rejected_jobs (
          job_id      TEXT    PRIMARY KEY,
          title       TEXT,
          company     TEXT,
          source      TEXT,
          reason      TEXT,
          rejected_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_rejected_at ON rejected_jobs(rejected_at);
      `,
    },
    {
      id: "060_user_profile_extended",
      sql: `
        ALTER TABLE user_profile ADD COLUMN website_url TEXT;
        ALTER TABLE user_profile ADD COLUMN portfolio_url TEXT;
        ALTER TABLE user_profile ADD COLUMN desired_salary INTEGER;
        ALTER TABLE user_profile ADD COLUMN salary_currency TEXT;
        ALTER TABLE user_profile ADD COLUMN available_start_date TEXT;
        ALTER TABLE user_profile ADD COLUMN willing_to_relocate INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE user_profile ADD COLUMN highest_degree TEXT;
        ALTER TABLE user_profile ADD COLUMN field_of_study TEXT;
        ALTER TABLE user_profile ADD COLUMN university TEXT;
        ALTER TABLE user_profile ADD COLUMN graduation_year INTEGER;
        ALTER TABLE user_profile ADD COLUMN current_job_title TEXT;
        ALTER TABLE user_profile ADD COLUMN current_company TEXT;
        ALTER TABLE user_profile ADD COLUMN years_of_experience INTEGER;
        ALTER TABLE user_profile ADD COLUMN custom_answers TEXT NOT NULL DEFAULT '{}';
      `,
    },
    {
      id: "061_scraped_jobs_enrichment",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN normalized_title      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN summary               TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN experience_level      TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN workplace_type        TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN valid_through         INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_min_usd        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_max_usd        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN salary_period         TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN skills_json           TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN is_h1b_sponsor        INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN requires_work_auth    INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN is_clearance_required INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN discovered_at         INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN updated_at            INTEGER;
      `,
    },
    {
      id: "062_incremental_sync",
      sql: `
        CREATE TABLE IF NOT EXISTS sync_state (
          source         TEXT    PRIMARY KEY,
          cursor         TEXT,
          last_watermark INTEGER,
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        ALTER TABLE scraped_jobs ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
      `,
    },
    {
      id: "063_cross_source_dedup",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN fingerprint   TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN sources_seen  TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_fingerprint ON scraped_jobs(fingerprint);
      `,
    },
    {
      id: "064_job_enrichment",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN content_hash TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN enriched_at  INTEGER;
        CREATE TABLE IF NOT EXISTS company_technographics (
          company        TEXT    NOT NULL,
          skill          TEXT    NOT NULL,
          weight         REAL    NOT NULL DEFAULT 0,
          last_seen      INTEGER NOT NULL,
          posting_count  INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (company, skill)
        );
      `,
    },
    {
      id: "065_req_uid_fingerprint_hardening",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN req_uid TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_req_uid ON scraped_jobs(req_uid);
      `,
    },
    {
      id: "066_company_org_units",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN org_unit_raw TEXT;
        CREATE TABLE IF NOT EXISTS company_org_units (
          company               TEXT    NOT NULL,
          org_unit              TEXT    NOT NULL,
          domain                TEXT,
          stacks_json           TEXT,
          seniority_json        TEXT,
          confidence            REAL    NOT NULL DEFAULT 0,
          corroboration_count   INTEGER NOT NULL DEFAULT 0,
          status                TEXT    NOT NULL DEFAULT 'proposed',
          first_seen            INTEGER NOT NULL,
          last_seen             INTEGER NOT NULL,
          source_postings_json  TEXT,
          PRIMARY KEY (company, org_unit)
        );
        CREATE INDEX IF NOT EXISTS idx_company_org_units_status ON company_org_units(company, status);
      `,
    },
    {
      id: "067_company_hiring_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS company_hiring_signals (
          company               TEXT    NOT NULL,
          window_start          INTEGER NOT NULL,
          window_end            INTEGER NOT NULL,
          open_count            INTEGER NOT NULL DEFAULT 0,
          new_count             INTEGER NOT NULL DEFAULT 0,
          expired_count         INTEGER NOT NULL DEFAULT 0,
          domain_breakdown_json TEXT,
          growth_score          REAL,
          updated_at            INTEGER NOT NULL,
          PRIMARY KEY (company, window_end)
        );
        CREATE INDEX IF NOT EXISTS idx_company_hiring_signals_company ON company_hiring_signals(company);
      `,
    },
    {
      id: "068_profile_tracked_search",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN tracked_search_json TEXT;
      `,
    },
    {
      id: "069_pipeline_runs",
      sql: `
        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          run_kind     TEXT    NOT NULL,
          source       TEXT,
          status       TEXT    NOT NULL,
          started_at   INTEGER NOT NULL,
          finished_at  INTEGER,
          duration_ms  INTEGER,
          fetched      INTEGER NOT NULL DEFAULT 0,
          written      INTEGER NOT NULL DEFAULT 0,
          unchanged    INTEGER NOT NULL DEFAULT 0,
          merged       INTEGER NOT NULL DEFAULT 0,
          dropped      INTEGER NOT NULL DEFAULT 0,
          ejected      INTEGER NOT NULL DEFAULT 0,
          failed       INTEGER NOT NULL DEFAULT 0,
          skipped      INTEGER NOT NULL DEFAULT 0,
          expired      INTEGER NOT NULL DEFAULT 0,
          error_text   TEXT,
          details_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_kind_source ON pipeline_runs(run_kind, source, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at DESC);
      `,
    },
    {
      // Four of the seeded ATS rows in 056 were wrong. Every company below was re-probed
      // against the live provider APIs before changing anything — no slug is guessed.
      //
      //   Notion    greenhouse/notionhq -> ashby/notion       (gh 404s; ashby returns 128)
      //   OpenAI    greenhouse/openai   -> ashby/openai       (gh 404s; ashby returns 732)
      //   Vercel    ashby/vercel        -> greenhouse/vercel  (ashby board is EMPTY, gh has 83)
      //   Rippling  greenhouse/rippling -> DEACTIVATED        (404 on greenhouse, ashby AND
      //                                                        lever; no board found)
      //
      // Identities confirmed from board content, not just a 200: OpenAI's departments include
      // Research/Safety Systems/Applied AI, and Vercel's postings resolve to
      // job-boards.greenhouse.io/vercel.
      //
      // Vercel is the subtlest of the four: ashby/vercel returns HTTP 200 with zero jobs, so it
      // never raised an error and never even logged the per-company warning a 404 produces — it
      // just silently contributed nothing to the board.
      //
      // Rippling is deactivated rather than deleted or guessed. active=0 is honoured by
      // cacheJobs (`WHERE active = 1`), so it stops costing a failed request every crawl while
      // the row survives as a record to reactivate once someone finds the real board. Guessing
      // a slug is exactly the failure this codebase already learned from twice.
      //
      // Corrected forward rather than by editing 056, which has already run everywhere. Each
      // guard is narrow enough to be idempotent and to not clobber a hand-fixed row.
      id: "070_fix_dead_ats_slugs",
      sql: `
        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'openai'
         WHERE company = 'OpenAI' AND ats_type = 'greenhouse';

        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'notion'
         WHERE company = 'Notion' AND ats_type = 'greenhouse';

        UPDATE company_ats_list
           SET ats_type = 'greenhouse', ats_slug = 'vercel'
         WHERE company = 'Vercel' AND ats_type = 'ashby';

        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Rippling' AND ats_type = 'greenhouse' AND ats_slug = 'rippling';
      `,
    },
    {
      // Cleanup 5.9. refresh_log had zero writers, zero readers and zero rows — grep-verified
      // across the repo, its only mention anywhere was its own CREATE TABLE in the bootstrap
      // schema, which this release also removes. Dropping it here clears it from databases that
      // already created it. Safe: no data is lost because none was ever written.
      //
      // NOT dropped, deliberately: scrape_events. Its writer (usageTracker.trackScrape) is gone
      // in the same release, but routes/admin.js still READS it in four analytics queries, so
      // dropping it would break the admin dashboard. Those panels now report a permanent zero,
      // which is accurate rather than broken. See docs/PIPELINE_DIAGNOSIS.md §5.12.
      id: "071_drop_refresh_log",
      sql: `
        DROP TABLE IF EXISTS refresh_log;
      `,
    },
    {
      id: "072_apply_submit_guards",
      sql: `
        CREATE TABLE IF NOT EXISTS app_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS apply_idempotency (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          idem_key      TEXT    NOT NULL,
          endpoint      TEXT    NOT NULL,
          status_code   INTEGER NOT NULL DEFAULT 200,
          response_json TEXT    NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, idem_key)
        );
        ALTER TABLE apply_run_jobs ADD COLUMN answers_json TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN resume_artifact_id INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN resume_ats_score INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN screenshot_path TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN submit_verified INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN submit_evidence TEXT;
      `,
    },
    {
      id: "073_apply_open_questions",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN open_questions_json TEXT;
      `,
    },
    {
      // Queue-then-approve. approval_mode is left NULL on existing rows deliberately: those runs
      // predate the flow and were never approved by anyone, so backfilling them to 'required' would
      // put a claim in the audit trail that is not true. NULL reads as "predates approval".
      //   'required' — the run previews only and parks each job for a human decision
      //   'auto'     — full-auto, submitted without approval (now opt-in)
      //   'approved' — this run exists BECAUSE a human approved; it submits
      // approved_from_run_job_id points at the preview row whose answers were approved, which is what
      // lets the submitting run refuse if the form has changed since.
      id: "074_apply_approval_flow",
      sql: `
        ALTER TABLE apply_runs     ADD COLUMN approval_mode TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN approved_at INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN approved_from_run_job_id INTEGER;
      `,
    },
    {
      // Cost observability. `purpose` names the FEATURE a model call served, separately from
      // event_type — which stays exactly as it is because services/limitEnforcer.js enforces
      // per-user quotas with `WHERE event_type = ?`, so repurposing that column would silently
      // change what counts against a limit.
      //
      // Additive and nullable on purpose: every row written before this migration was recorded by
      // a call site that had no notion of purpose, and inventing one for them would put a claim in
      // the cost history that nothing verified. NULL reads as "recorded before purpose existed" —
      // routes/admin.js groups it as 'unattributed' rather than dropping it.
      //
      // The 'system' user (id 0) is what background work — enrichment, import extraction, job
      // classification, the unauthenticated standalone endpoints — is attributed to.
      // usage_events.user_id is NOT NULL REFERENCES users(id), and better-sqlite3 turns
      // foreign_keys ON by default, so a bare sentinel id with no row is REJECTED: verified by a
      // real run, where every background insert failed with "FOREIGN KEY constraint failed" and
      // the largest untracked spender stayed untracked.
      // id 0 can never collide with a real account (users.id is AUTOINCREMENT, so it starts at 1)
      // and the password hash is a literal that no hash function can produce, so it is not a
      // login. INSERT OR IGNORE keeps this migration safe to re-run.
      id: "075_usage_events_purpose",
      sql: `
        ALTER TABLE usage_events ADD COLUMN purpose TEXT;
        CREATE INDEX IF NOT EXISTS idx_usage_events_purpose
          ON usage_events(purpose, created_at);
        INSERT OR IGNORE INTO users (id, username, password_hash, is_admin)
          VALUES (0, 'system', '!unusable', 0);
      `,
    },
    {
      // Persisted tracking failures. The in-process counters added with 075 reset on restart, so
      // a failure that happened and was then followed by a deploy left no trace at all: the cost
      // panel would report healthy coverage for a gap that really occurred.
      //
      // user_id carries NO foreign key, deliberately. The first real run of the wrapper failed
      // with "FOREIGN KEY constraint failed" on usage_events.user_id — an FK violation is one of
      // the reasons a usage insert fails, so putting an FK here would make the failure record
      // itself fail for exactly the cases most worth recording. Every column except created_at is
      // nullable for the same reason: a partial record beats no record.
      //
      // This still cannot capture a database that is entirely unreachable — that case degrades to
      // the in-process counter and the error log, and routes/admin.js says so rather than
      // implying the persisted count is complete.
      id: "076_usage_tracking_failures",
      sql: `
        CREATE TABLE IF NOT EXISTS usage_tracking_failures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT,
          purpose TEXT,
          user_id INTEGER,
          error_text TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_usage_tracking_failures_created
          ON usage_tracking_failures(created_at);
      `,
    },
    {
      // Distinguishes a failure recorded LIVE from one recovered out of the out-of-process sink
      // (services/trackingFailureSink.js) after the database came back. Conflating them would hide
      // the more serious fact: a sink-recovered row means the database itself was unreachable at
      // the time, not merely that one insert was rejected.
      //
      // Nullable: rows written by 076 predate the distinction, and NULL reads as "recorded live,
      // before this column existed" rather than being backfilled with a claim nothing verified.
      id: "077_tracking_failure_source",
      sql: `
        ALTER TABLE usage_tracking_failures ADD COLUMN source TEXT;
      `,
    },
    {
      // Automation tier — what the candidate will face at the apply destination, decided at
      // browse time. services/jobs/automationTier.js owns the mapping; this column stores its
      // output so services/jobs/jobQuery.js can filter on it in SQL. Deriving it at read time
      // instead would force that mapping to be re-expressed as a CASE expression here, and a
      // second copy of a mapping is exactly what left model ids half-migrated across the
      // codebase.
      //
      // NULLABLE, AND NOT BACKFILLED BY THIS MIGRATION — deliberately. The backfill needs
      // deriveAutomationTier(), which is JavaScript; writing it as a SQL CASE would create the
      // duplicate this column exists to avoid. Existing rows are populated instead by the
      // boot-time backfill immediately below this runner and by
      // scripts/recomputeAutomationTier.js, both of which call that one function.
      //
      // So NULL is a state the board must survive: it means "written before this column
      // existed and not yet recomputed", which is indistinguishable from 'unknown' as far as
      // any promise to the user goes. jobQuery.js's tiers_include/tiers_exclude therefore
      // COALESCE it to 'unknown' rather than letting `NULL IN (...)` (which is NULL, not
      // false) silently drop the row from BOTH directions of the filter.
      id: "078_scraped_jobs_automation_tier",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN automation_tier TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_automation_tier
          ON scraped_jobs(automation_tier, is_active);
      `,
    },
    {
      // The prepared packet for a gated portal (docs/GATED_HANDOFF_ARCHITECTURE.md §3 step 3). A run
      // that hits a login wall or a CAPTCHA cannot finish on the server, so everything already
      // decided is parked here for the human who will cross that gate, and handed to the extension
      // in exchange for a single-use token.
      //
      // expected_origin is stored SEPARATELY from apply_url rather than derived at read time. It is
      // the value the extension target-matches before releasing anything, and this packet carries a
      // home address and work-authorization answers — so the thing being compared has to be a stored
      // fact, decided once when the run observed the gate, not a re-parse of a URL that may have been
      // rewritten since.
      //
      // token_hash, not the token: a database read must not yield a usable credential. The token
      // exists only in the response that mints it. consumed_at is what makes it single-use, and it is
      // set in the same statement that claims the packet, so two concurrent exchanges cannot both win.
      //
      // exchange_attempts counts every attempt including rejected ones, so a packet being probed is
      // visible on the row itself and not only in the log.
      id: "079_apply_gate_packets",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_gate_packets (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_id             INTEGER,
          run_job_id         INTEGER REFERENCES apply_run_jobs(id) ON DELETE CASCADE,
          job_id             TEXT    NOT NULL,
          apply_url          TEXT    NOT NULL,
          expected_origin    TEXT    NOT NULL,
          gate_reason        TEXT    NOT NULL,
          answers_json       TEXT    NOT NULL,
          resume_artifact_id INTEGER,
          token_hash         TEXT    NOT NULL UNIQUE,
          expires_at         INTEGER NOT NULL,
          consumed_at        INTEGER,
          exchange_attempts  INTEGER NOT NULL DEFAULT 0,
          created_at         INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_gate_packets_user_job
          ON apply_gate_packets(user_id, job_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_gate_packets_origin
          ON apply_gate_packets(user_id, expected_origin, consumed_at);
      `,
    },
    {
      // What a human actually saw before an application went out (TASK G3, §4's review-as-provenance).
      // The audit trail already records what was ANSWERED and with what provenance; this records what
      // was REVIEWED — which fields the candidate approved as-is, which they corrected, and which
      // low-confidence guesses they had to acknowledge before the overlay would call itself ready.
      //
      // Separate from answers_json rather than merged into it: those are two different claims made at
      // two different times by two different parties, and collapsing them would make it impossible to
      // say afterwards whether a value was the resolver's or the candidate's. For a gated application
      // this is the ONLY record of human review, because the submission itself happens in a browser we
      // never see.
      //
      // Nullable, not backfilled: a NULL means the application predates the overlay or was never
      // reviewed through it, which is not the same as "reviewed and nothing changed".
      id: "080_apply_gate_review",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN gate_review_json TEXT;
      `,
    },
    {
      // A company's application form, as a KB fact (TASK G4). Behind a gate is a place the server
      // can never reach, but the extension is standing inside it — so the form's STRUCTURE comes
      // back and the next candidate's packet arrives pre-mapped. It is the mechanism that replaces
      // hand-writing platformDetector's PLATFORM_LABEL_MAPS one ATS at a time.
      //
      // KEYED BY APPLY HOST, not by job. One careers page serves every posting behind it, so a
      // schema captured once from any of them serves all the others — which is the only reason this
      // compounds rather than being a per-application cache.
      //
      // STRUCTURE ONLY. fields_json holds labels, types, required flags, option lists and order.
      // Never a value, never anything about the candidate. discoverFields returns current_value and
      // this store must never receive it, which is enforced by a whitelist in formSchemaLayer.js and
      // asserted by test rather than promised by a comment.
      //
      // shape_hash is what makes a CHANGED form observable. Forms change; a stale schema that is
      // trusted is worse than no schema, so a differing hash is treated as a new claim about the
      // form — corroboration resets and a confirmed schema drops back to proposed. That last part
      // deliberately DIVERGES from company_org_units, which never demotes: an org unit that stops
      // appearing may simply not be hiring, whereas a form that comes back different is positive
      // evidence the stored one is now wrong.
      //
      // `source` distinguishes a capture made by a candidate standing behind a gate from one our own
      // crawl of a public careers page produced. Both write the same shape on purpose — this is the
      // store imported-careers-page support needs too, and a gated-only variant would have to be
      // merged into it later.
      //
      // users.form_schema_capture is the consent switch, DEFAULT 0. Capture reports on a page behind
      // that candidate's own authenticated session, and opt-in is the only answer to "what does it
      // send from behind my login?" that does not rest on trusting our filter.
      id: "081_company_form_schemas",
      sql: `
        CREATE TABLE IF NOT EXISTS company_form_schemas (
          apply_host           TEXT    NOT NULL PRIMARY KEY,
          company              TEXT,
          platform             TEXT,
          fields_json          TEXT    NOT NULL,
          field_count          INTEGER NOT NULL DEFAULT 0,
          unmapped_json        TEXT,
          unmapped_count       INTEGER NOT NULL DEFAULT 0,
          shape_hash           TEXT    NOT NULL,
          confidence           REAL    NOT NULL DEFAULT 0,
          corroboration_count  INTEGER NOT NULL DEFAULT 0,
          status               TEXT    NOT NULL DEFAULT 'proposed',
          source               TEXT    NOT NULL,
          first_seen           INTEGER NOT NULL,
          last_seen            INTEGER NOT NULL,
          changed_at           INTEGER,
          previous_shape_hash  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_company_form_schemas_company
          ON company_form_schemas(company, status);
        ALTER TABLE users ADD COLUMN form_schema_capture INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // H-1B sponsorship as a COMPANY fact, from DOL/OFLC LCA disclosure data (TASK X3).
      //
      // WHY THIS IS NOT ON scraped_jobs. The posting-level is_h1b_sponsor experiment is over and it
      // failed on the evidence: of 1,261 postings, 0 mention "H-1B", 36 mention sponsorship at all,
      // and the LLM backfill produced 3 non-null values, all false. The signal is not in the source
      // material. Every H-1B-sponsoring employer, by contrast, MUST file a Labor Condition
      // Application, and those filings are public and quarterly. So this is a fact the company emits
      // about itself, and it belongs beside company_technographics and company_org_units.
      //
      // is_h1b_sponsor SURVIVES UNCHANGED and is not populated from here. Two different claims:
      // "this employer filed 47 petitions last quarter" is not "this role sponsors". Nothing in this
      // migration touches scraped_jobs, by design and by test
      // (test/lcaPostingFlagUntouched.test.js).
      //
      // THREE TABLES, because they answer to three different owners:
      //
      //   lca_source_files     — the import ledger. One row per quarterly file, so a re-import
      //                          RECONCILES (delete-then-insert that period) instead of doubling
      //                          the counts, same discipline as the job pipeline's req_uid.
      //   lca_employer_periods — LCA employers as filed, one row per (employer, FEIN, quarter).
      //                          Keeping the whole employer universe rather than only the companies
      //                          we happen to know today is what lets a company added tomorrow be
      //                          matched without re-downloading ~2 GB of spreadsheets.
      //   company_lca_sponsorship — the derived KB fact for one of OUR company strings, carrying
      //                          the match tier and confidence, provenance and last_seen like every
      //                          other KB store.
      //
      // fein is NOT NULL with a '' sentinel rather than nullable: it is in a PRIMARY KEY, and SQLite
      // permits NULLs in a non-INTEGER primary key, which would silently stop de-duplicating the
      // rows this table exists to de-duplicate.
      //
      // match_status is the integrity mechanism, not decoration. 'ambiguous' means two or more
      // distinct FEINs answer to the same brand name (measured: 2.3% of reachable brands — Mercury
      // Insurance vs Mercury Technologies, and Mercury Insurance also files for "Senior Software
      // Engineer", so no title heuristic can separate them). An 'ambiguous' row renders NOTHING —
      // not a zero, not "no data" — because a wrong sponsor claim is worse than a missing one.
      //
      // periods_covered vs periods_with_filings is how staleness stays honest. Quora filed 1
      // certified LCA in FY2025 Q4 and 0 in FY2026 Q1; a single-quarter snapshot cannot tell "does
      // not sponsor" from "did not file last quarter", so the store records how many quarters were
      // SEARCHED alongside how many had filings, and latest_period carries the recency the UI
      // decays against.
      id: "082_company_lca_sponsorship",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_source_files (
          file_name       TEXT    NOT NULL PRIMARY KEY,
          fiscal_period   TEXT    NOT NULL,
          fiscal_year     INTEGER NOT NULL,
          fiscal_quarter  INTEGER NOT NULL,
          period_start    INTEGER,
          period_end      INTEGER,
          sheet_rows      INTEGER NOT NULL DEFAULT 0,
          case_rows       INTEGER NOT NULL DEFAULT 0,
          employer_rows   INTEGER NOT NULL DEFAULT 0,
          byte_size       INTEGER,
          source_url      TEXT,
          ingested_at     INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS lca_employer_periods (
          employer_key    TEXT    NOT NULL,
          fein            TEXT    NOT NULL,
          fiscal_period   TEXT    NOT NULL,
          employer_name   TEXT    NOT NULL,
          dba_keys_json   TEXT,
          state           TEXT,
          certified       INTEGER NOT NULL DEFAULT 0,
          denied          INTEGER NOT NULL DEFAULT 0,
          withdrawn       INTEGER NOT NULL DEFAULT 0,
          positions       INTEGER NOT NULL DEFAULT 0,
          top_titles_json TEXT,
          last_decision   INTEGER,
          PRIMARY KEY (employer_key, fein, fiscal_period)
        );
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_key
          ON lca_employer_periods(employer_key);
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_period
          ON lca_employer_periods(fiscal_period);
        CREATE TABLE IF NOT EXISTS company_lca_sponsorship (
          company              TEXT    NOT NULL PRIMARY KEY,
          match_status         TEXT    NOT NULL,
          match_tier           TEXT,
          match_confidence     REAL    NOT NULL DEFAULT 0,
          match_key            TEXT,
          match_reason         TEXT,
          matched_entities_json TEXT,
          candidate_count      INTEGER NOT NULL DEFAULT 0,
          certified_total      INTEGER NOT NULL DEFAULT 0,
          denied_total         INTEGER NOT NULL DEFAULT 0,
          positions_total      INTEGER NOT NULL DEFAULT 0,
          by_period_json       TEXT,
          by_fiscal_year_json  TEXT,
          top_titles_json      TEXT,
          latest_period        TEXT,
          latest_filing_at     INTEGER,
          periods_covered      INTEGER NOT NULL DEFAULT 0,
          periods_with_filings INTEGER NOT NULL DEFAULT 0,
          source               TEXT    NOT NULL DEFAULT 'dol_oflc_lca',
          provenance_json      TEXT,
          first_seen           INTEGER NOT NULL,
          last_seen            INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_company_lca_sponsorship_status
          ON company_lca_sponsorship(match_status, certified_total);
      `,
    },
    {
      // The OFLC record layout CHANGED, and the corpus has to be able to say where (TASK X3).
      //
      // EMPLOYER_FEIN does not exist in the FY2021, FY2022 or FY2023 disclosure files. Those sheets
      // are 96 columns with no employer tax ID anywhere in them; FY2024 Q1 onward is 98 columns with
      // it. That matters because FEIN is what services/kb/lcaMatch.js counts to decide whether a
      // brand-prefix (tier C) match is unambiguous — and counting FEINs over a file that has none
      // returns zero, which would have read as "one employer" and switched the ambiguity guard OFF
      // for twelve of the twenty-one available quarters. countDistinctEntities() falls back to
      // counting distinct legal names instead, which is strictly more cautious.
      //
      // Stored rather than derived. It IS derivable ("do all this period's rows have fein = ''?"),
      // but a derived answer cannot distinguish a file that had no FEIN column from a file whose
      // FEIN column happened to be empty, and the second would be a parser bug we would want to see
      // rather than absorb. One column in the import ledger, written from the header row itself.
      //
      // Nullable with no default: rows written before this migration predate the check and must not
      // claim either answer. Re-running the ingester for those periods fills them in.
      id: "083_lca_source_fein_presence",
      sql: `
        ALTER TABLE lca_source_files ADD COLUMN has_employer_fein INTEGER;
      `,
    },
    {
      // OFLC CHANGED WHAT A QUARTERLY FILE MEANS, and the corpus has to survive both conventions
      // (TASK X3). Measured from the decision dates in the files themselves:
      //
      //   FY2021 Q1   2020-10-01 → 2020-12-31     one quarter
      //   FY2021 Q2   2020-10-01 → 2021-03-31     TWO quarters — contains Q1
      //   FY2021 Q3   2020-10-01 → 2021-06-30     THREE quarters — contains Q2
      //   FY2025 Q1   2024-10-01 → 2024-12-31     one quarter
      //   FY2025 Q2   2025-01-01 → 2025-03-31     one quarter — disjoint from Q1
      //
      // The old files are FISCAL-YEAR CUMULATIVE; the new ones are per-quarter. Migration 082's
      // ingester summed across periods on the strength of the FY2025/FY2026 evidence, which is
      // correct there and TRIPLE-COUNTS FY2021 Q1. Nothing about the filename says which convention
      // a file follows, so the ingester now derives each file's true window from its own decision
      // dates and drops any period whose window is contained in another's.
      //
      // quarters_covered is that window expressed in quarters, and it is stored because two things
      // need it and neither can recompute it: periods_covered ("how long did we look?") must count
      // QUARTERS rather than files, or a four-year corpus reports as nine; and the per-period chips
      // must not label a full fiscal year "FY2021 Q4", which would claim a year's filings happened
      // in one quarter.
      //
      // Nullable: rows written before this migration have not had their window measured, and
      // guessing 1 would silently reassert the bug this exists to fix.
      id: "084_lca_period_span",
      sql: `
        ALTER TABLE lca_source_files ADD COLUMN quarters_covered INTEGER;
      `,
    },
    {
      // TASK AC4: a USER-SIDE DELETE that is a soft hide, and the index the dated history reads on.
      //
      // WHY SOFT, AND WHY FOR EVERYTHING. The requirement asks for the decision to be made and
      // stated. A submitted application is evidence that reached a real employer; that record is
      // exactly what the candidate needs when an interview lands three weeks later, and a hard
      // delete would destroy it on a click made while tidying up. So submitted rows are never
      // hard-deleted — and rather than two code paths, NOTHING is: `hidden_at` is set on any row
      // the user removes, and every user-facing feed filters it out. Three things fall out of that
      // which a DELETE would have cost:
      //
      //   - apply_job_logs.run_job_id and apply_gate_packets.run_job_id both cascade on DELETE, so
      //     hard-deleting one run-job would silently take its whole audit trail and its prepared
      //     handoff with it.
      //   - apply_runs.submitted_count / held_count / failed_count are stored counters, not
      //     derived. Removing a row would leave the run claiming work that no longer exists.
      //   - It is reversible. `UPDATE apply_run_jobs SET hidden_at=NULL` restores anything an
      //     operator is asked to restore; a DELETE is a support ticket that cannot be answered.
      //
      // Nullable with no default and no backfill: NULL means visible, which is what every existing
      // row is. A row written before this migration cannot have been hidden.
      //
      // The index is what makes the dated view a lookup rather than a scan. AC4 requirement 5 says
      // the history must be date-scoped AND user-scoped on the SERVER — "do not fetch all history
      // and filter client-side" — and (user_id, created_at) is the exact shape of that query. The
      // existing idx_apply_run_jobs_user_status leads with status, so it cannot serve a date range.
      id: "085_apply_run_jobs_hidden",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN hidden_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_user_created
          ON apply_run_jobs(user_id, created_at);
      `,
    },
    {
      // The sponsorship SITUATION, replacing a stored ANSWER. `requires_sponsorship` is one
      // boolean, and the standard Greenhouse question is "do you NOW OR IN THE FUTURE require
      // sponsorship" — two tenses that disagree for anyone on a time-limited status. An F-1 STEM
      // OPT candidate needs no sponsorship today and will need H-1B when OPT expires, so the
      // boolean answered the future-tense question "No": a false material attestation, submitted
      // at confidence 1.0. See docs/auto-apply-a5-live-run.md §4.1.
      //
      // NULLABLE ON PURPOSE, with no default. 'none' is not a safe default — it is precisely the
      // wrong guess for the population this exists to protect — and resolveSponsorshipNeed refuses
      // (holding the run for a human) rather than inventing a situation it cannot derive. The
      // legacy boolean is left in place: it still answers the present tense, and it is what the
      // derivation falls back to.
      id: "086_user_profile_sponsorship_need",
      sql: `
        ALTER TABLE user_profile ADD COLUMN sponsorship_need TEXT;
      `,
    },
    {
      // Per-company overrides for a `{company}`-templated custom answer (AF1).
      //
      // A separate column rather than a reserved key inside custom_answers, because buildAnswers
      // iterates that map's values and stringifies them: a nested object there would be typed into
      // a real employer's form as "[object Object]". Shape is {companyKey: {question: answer}}.
      id: "087_user_profile_answer_overrides",
      sql: `
        ALTER TABLE user_profile ADD COLUMN custom_answer_overrides TEXT NOT NULL DEFAULT '{}';
      `,
    },
    {
      // AF5's campaign record. Two facts a semi run already had in hand and threw away:
      //
      //   fields_discovered — the DENOMINATOR for discovery reliability. answers_json says what was
      //     resolved; without the count of what was FOUND, "12 fields filled" cannot be read as good
      //     or bad, and per-ATS discovery reliability is not computable at all.
      //   corrections_json — what the HUMAN changed after the resolver filled it. Each entry is
      //     either a resolver defect or a missing custom answer, which makes this the most valuable
      //     output of a semi run and the one thing nothing recorded.
      id: "088_apply_run_jobs_campaign_record",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN fields_discovered INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN corrections_json TEXT;
      `,
    },
    {
      // profile_signal_suggestions.status was doing two independent jobs at once.
      //
      //   QUEUE      is this skill queued for the base-resume enhancement rewrite?
      //   ASSERTION  has the candidate said this is true of them?
      //
      // One column cannot hold two orthogonal facts, so every value crowded out the others.
      // 'claimed' (added by AG2) and 'applied' had to pretend they were not queued, and
      // syncSelectedSkillSuggestions — which reconciles the QUEUE — reconciled the whole column and
      // silently withdrew claims it had never heard of. That was patched by teaching it which
      // values to avoid, which is a guard around a modelling error rather than a fix for it. The
      // next value added would have needed the same guard, in every reader, forever.
      //
      // status is KEPT and still written, derived from the two new columns, so anything reading it
      // — an old process mid-deploy, a manual query — keeps working. It is lossy by construction:
      // a row that is both queued AND claimed can only say one of those, and assertion wins. That
      // lossiness is the whole reason for the split, so the new columns are the source of truth and
      // status is a legacy projection.
      id: "089_profile_signal_queue_and_assertion",
      sql: `
        ALTER TABLE profile_signal_suggestions ADD COLUMN queue_state TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE profile_signal_suggestions ADD COLUMN assertion TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE profile_signal_suggestions ADD COLUMN claimed_at INTEGER;
        UPDATE profile_signal_suggestions SET queue_state = 'queued' WHERE status = 'selected';
        UPDATE profile_signal_suggestions SET assertion = 'applied' WHERE status = 'applied';
        UPDATE profile_signal_suggestions
           SET assertion = 'claimed', claimed_at = selected_at, selected_at = NULL
         WHERE status = 'claimed';
        CREATE INDEX IF NOT EXISTS idx_profile_signal_suggestions_axes
          ON profile_signal_suggestions(profile_id, signal_kind, queue_state, assertion, frequency DESC);
      `,
    },
    {
      // AH1 root cause: signing out did not sign you out.
      //
      // /api/auth/logout revoked the presenting tab's auth-context token and RETURNED EARLY,
      // leaving the connect.sid session — the durable, 7-day, rolling credential — alive in
      // sessions.db. Any request without a token then re-authenticated off that cookie, and a new
      // tab sends no token because sessionStorage is per-tab and starts empty. That is the
      // long-standing "a hard refresh auto-authenticates" report: not a refresh bug, a sign-out
      // that only ever signed out one tab's fallback credential.
      //
      // Revoking the browser's tokens on sign-out means knowing WHICH browser a token belongs to,
      // so one browser profile signing out cannot revoke another's. session_sid is the connect.sid
      // the context was issued under.
      //
      // NULL session_sid means either a row predating this migration or a deliberately
      // session-less credential (the extension token, which the user revokes separately via
      // /api/auth/revoke-extension-token). Neither is swept by a browser sign-out — a sign-out
      // revokes the presented token plus its session siblings, never an unattributable row.
      id: "090_auth_context_session_binding",
      sql: `
        ALTER TABLE auth_contexts ADD COLUMN session_sid TEXT;
        CREATE INDEX IF NOT EXISTS idx_auth_contexts_session
          ON auth_contexts(session_sid, revoked_at);
      `,
    },
    {
      // AH5. Two columns, for the two halves of "say what happened".
      //
      // apply_run_jobs.blanks_json — every discovered field the run did NOT fill, with why
      //   (low_confidence / no_answer / unmatched / fill_failed). Read off the POST-FILL discovery
      //   pass, so it is the state of the form and not a gate's opinion of it. answers_json has
      //   always held the filled half with its provenance; the blank half had nowhere to live, so a
      //   run could say "Autofilled 7 fields" and hold for review with no way to learn which 7 or
      //   what was still empty. missingRequired existed but only inside an apply_job_logs event,
      //   which no surface reads.
      //
      // resumes.domain_profile_id — which job profile an artifact was generated under.
      //   processRunJob reuses any `resumes` row for (user, job), newest first, and that is the
      //   right instinct: regenerating work already done costs a model call and minutes of the
      //   candidate's time. But with no record of the profile it also reuses an artifact built for
      //   a DIFFERENT profile, and there was no way to tell. Stamping it makes "is this current?"
      //   a question the code can answer instead of assume. NULL means an artifact written before
      //   this migration, and the reuse rule treats that as unknown-but-usable rather than
      //   forcing a regeneration of every existing artifact.
      id: "091_fill_log_and_artifact_provenance",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN blanks_json TEXT;
        ALTER TABLE resumes ADD COLUMN domain_profile_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_resumes_currency
          ON resumes(user_id, job_id, domain_profile_id, updated_at DESC);
      `,
    },
    {
      // AI1. The summary section becomes a per-profile choice, and its default is OFF.
      //
      // WHY A COLUMN AND NOT A SETTINGS BLOB
      // domain_profiles has no settings JSON to extend — every preference on it is its own typed
      // column (seniority, target_titles, selected_*). A blob added for one boolean would be the
      // odd one out and the first place a later setting hid from a query.
      //
      // DEFAULT 0 CHANGES WHAT EXISTING USERS GET, ON PURPOSE, AND THE UI SAYS SO.
      // Every resume generated before this had a summary, so a default of 0 means the next resume
      // an existing candidate generates will not. Backfilling 1 for existing rows was the other
      // option and was rejected: it would leave two populations with different defaults and no way
      // to tell them apart, and the product decision is that a summary is opt-in for everyone.
      // The cost of the change is a section the candidate can turn back on in one click; the cost
      // of hiding it is a resume that silently differs from the last one they read. So the toggle
      // states in the UI that it changes the next generated resume, rather than leaving it found.
      id: "092_profile_summary_opt_in",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN include_summary INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // AK1. Corpus-derived term weights for the local ATS scorer.
      //
      // WHY A TABLE AND NOT A JSON FILE ON DISK
      // The weights are DERIVED FROM scraped_jobs and go stale as the board is re-scraped. A file
      // checked into data/ would be a snapshot of one machine's board pretending to be a constant,
      // and every other deployment would score against a corpus it does not have. The table is
      // recomputed from whatever board the deployment actually holds.
      //
      // computed_at AND corpus_size ARE NOT DECORATION.
      // A weight table that ages silently is this project's most repeated defect shape, so the
      // provenance is stored per row and the loader refuses weights older than
      // MAX_WEIGHT_AGE_DAYS rather than scoring against a corpus that no longer exists. corpus_size
      // is stored too because a weight is only interpretable against the N it was derived from.
      //
      // NO FOREIGN KEY TO scraped_jobs, ON PURPOSE. Rows here are aggregates over the whole corpus,
      // not facts about one posting; a deleted job must not delete a weight, it must wait for the
      // next recompute.
      id: "093_ats_term_weights",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_term_weights (
          role_family TEXT    NOT NULL,
          term        TEXT    NOT NULL,
          df          INTEGER NOT NULL,
          corpus_size INTEGER NOT NULL,
          weight      REAL    NOT NULL,
          computed_at INTEGER NOT NULL,
          PRIMARY KEY (role_family, term)
        );
        CREATE INDEX IF NOT EXISTS idx_ats_term_weights_family
          ON ats_term_weights(role_family);
      `,
    },
    {
      // AK1 — record the ATS score AT THE MOMENT OF APPLYING, so it can be correlated with the
      // outcome later.
      //
      // THIS IS THE ONLY HONEST TEST OF WHETHER THE SCORE PREDICTS ANYTHING, AND IT IS
      // UNRECOVERABLE IF NOT CAPTURED AT THE TIME. Nobody can compute a true ATS score; the number
      // is defensible only if applications that scored higher actually get more responses. That
      // question needs (score, outcome) pairs, and the score half cannot be reconstructed
      // afterwards — the resume changes, the profile changes, the corpus weights change, and the
      // scorer itself changes. Re-scoring an old application next year answers a different
      // question. n is ZERO today and no claim is being made from this; the fields exist so the
      // data starts accumulating from the next application onward.
      //
      // ats_scorer_version IS NOT OPTIONAL, and AK1 is the proof. This very change moved the scale:
      // the same fit that scored 45 under local_ats_v3 scores about 28 under v4, because skills went
      // from 50 to 70 points, experience stopped being a cliff, and constraints stopped paying for
      // the absence of a problem. Pooling scores across that boundary without knowing which scorer
      // produced them would silently mix two scales and produce a confident, meaningless
      // correlation. Every stored score carries the version that produced it.
      //
      // The full report is stored beside the number because "which TERMS were missing when this
      // application got a response" is the more useful question, and it is the one targeted
      // generation (Phase 4) would be tuned against.
      id: "094_application_ats_provenance",
      sql: `
        ALTER TABLE job_applications ADD COLUMN ats_score_at_apply INTEGER;
        ALTER TABLE job_applications ADD COLUMN ats_scorer_version TEXT;
        ALTER TABLE job_applications ADD COLUMN ats_report_at_apply TEXT;
        ALTER TABLE job_applications ADD COLUMN ats_scored_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_job_applications_ats_score
          ON job_applications(ats_scorer_version, ats_score_at_apply);
      `,
    },
    {
      // AK1 — the other half of the pair: what the EMPLOYER did.
      //
      // 094 made the ATS score at the moment of applying recordable. That is one half. Without what
      // came back, the score can never be validated against anything, and validating it is the only
      // honest test of a number nobody can compute exactly. See shared/applicationResponse.js for
      // the vocabulary and for why this is a different axis from shared/applyOutcomeGroups.js —
      // that one says whether WE managed to submit, this one says whether THEY replied.
      //
      // THREE COLUMNS, NOT ONE, BECAUSE THEY ANSWER THREE QUESTIONS AND NONE DERIVES FROM ANOTHER:
      //
      //   first_response_at  Did they engage at all, and how fast? Set ONCE, never moved. This is
      //                      the column the ATS score should actually be correlated against — a
      //                      resume screening score can plausibly predict "did you get a reply",
      //                      and has no business predicting whether you got the job.
      //   furthest_stage     How far did it get? Monotonic. An application that goes screen ->
      //                      interview -> rejected must not read as though it were rejected off the
      //                      resume; the interview is the most informative fact on the row and a
      //                      single current-state column would erase it.
      //   response_outcome   How did it end? The current disposition.
      //
      // NULL IS NOT "NO RESPONSE". An application sent yesterday with nothing recorded is
      // UNRESOLVED, not a negative — counting it as silence biases every early response-rate toward
      // zero, which is exactly when someone will first look at this and conclude the resume is bad.
      // MATURITY_DAYS in the shared module is what separates the two, and the analysis query
      // applies it rather than trusting NULL.
      id: "095_application_response_outcome",
      sql: `
        ALTER TABLE job_applications ADD COLUMN response_outcome TEXT;
        ALTER TABLE job_applications ADD COLUMN furthest_stage TEXT;
        ALTER TABLE job_applications ADD COLUMN first_response_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN outcome_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN outcome_source TEXT;
        CREATE INDEX IF NOT EXISTS idx_job_applications_response
          ON job_applications(user_id, response_outcome, applied_at);
      `,
    },
    {
      // AL1 — which PROVIDER served each call, alongside the model that already exists.
      //
      // WHY MODEL ALONE IS NOT ENOUGH. It nearly is — model IDs are globally unique in practice, so
      // "llama-3.1-8b-instant" could only have come from Groq today. But the cost report groups by
      // model and the whole point of the tracking work was that a report which silently omits part
      // of the traffic is worse than no report. The moment the same open-weights model is served by
      // two providers (which is the normal case for Llama — Groq, Together, SambaNova and Fireworks
      // all serve it), a model-only column makes two different tiers with two different prices and
      // two different data policies indistinguishable in the one table that is supposed to be the
      // record of what was sent where.
      //
      // BACKFILLED TO 'anthropic' RATHER THAN LEFT NULL. Every row that exists before this
      // migration was an Anthropic call — there was no other path. A NULL would say "unknown",
      // which is a different and false claim, and it would make the honest query
      // (`GROUP BY provider`) grow a bucket that never corresponded to anything.
      id: "096_usage_events_provider",
      sql: `
        ALTER TABLE usage_events ADD COLUMN provider TEXT;
        UPDATE usage_events SET provider = 'anthropic' WHERE provider IS NULL;
        CREATE INDEX IF NOT EXISTS idx_usage_events_provider
          ON usage_events(provider, created_at);
      `,
    },
    {
      // AL2 — generation is deferred to APPROVAL, and the free base-resume fit is recorded instead.
      //
      // WHY. Generation costs ~$0.04 on Sonnet and fired at QUEUE time. A swipe is ~1 second, so
      // five idle minutes of swiping is ~60 jobs and ~$2.40 spent by a gesture that cost the user
      // no thought at all. Nothing was decided at that point — the user had not seen the
      // application and had not approved sending it.
      //
      // A USER CANNOT APPROVE BLIND, which is why this is three columns and not a feature flag.
      // scoreAtsLocally runs with NO model call and NO generated artifact, so the approval screen
      // can show a real fit band computed against the BASE resume, for free, before anything is
      // spent. That is also a MORE HONEST number than the one it replaces: the old score was
      // computed against the GENERATED resume, so it reflected tailoring the user had not yet
      // decided to pay for. A base-resume band is an honest floor — tailoring can only raise it.
      //
      //   generate_at_queue  per-profile, DEFAULT 0 (off). Restores the old behaviour for testing.
      //                      On domain_profiles beside include_summary (092), because it is the
      //                      same kind of thing: a per-profile choice about what a run does.
      //   base_ats_score     the free score, INTEGER and nullable — NULL is the scorer DECLINING,
      //                      which is not a zero and must never render as one.
      //   base_ats_json      the matched/missing terms behind it, so the approval screen can say
      //                      WHY rather than showing a bare number the user cannot check.
      id: "097_generation_deferred_to_approval",
      sql: `
        ALTER TABLE domain_profiles ADD COLUMN generate_at_queue INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE apply_run_jobs ADD COLUMN base_ats_score INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN base_ats_json TEXT;
      `,
    },
    {
      // AL3 (G1) — the skill synonym table: the ONLY thing on the horizon that moves rho UPWARD.
      //
      // THE MEASURED CEILING IT ATTACKS. AK1's worst inversion was -19 ranks: a reliability role
      // whose JD said "log analysis" where the resume said "observability tooling". AK1 called that
      // "a ceiling on the approach, not a bug" — the scorer matches terms, and two names for one
      // skill are two terms. Everything else queued moves rho sideways.
      //
      // ⛔ WHY status IS HERE AND DEFAULTS TO 'proposed'. A FALSE EQUIVALENCE IS A CONFIDENTLY
      // WRONG MATCH, which is the failure mode that costs the most trust — the same class as the
      // "coffee machine vendor" credited with machine learning (22.8% of all multi-word matches
      // before AK1's proximity fix). An LLM proposing "kubernetes ~ docker" is plausible-sounding
      // and wrong, and it would silently inflate scores on every posting mentioning either. So the
      // scorer reads ONLY 'confirmed' rows, promotion is a human act, and corroboration alone can
      // never promote. This is deliberately STRICTER than company_org_units, which self-promotes at
      // 3 postings / 0.6 confidence: an org unit that is wrong is a wrong label on a card, while a
      // synonym that is wrong changes every score on the board.
      //
      // relation SEPARATES TWO DIFFERENT CLAIMS that must not be conflated:
      //   'alias'   — the same thing under another name. k8s = kubernetes, postgres = postgresql.
      //               Symmetric and safe.
      //   'related' — adjacent, not identical. log analysis ~ observability. This is the one that
      //               earns the rho and the one that produces false matches, so review is stricter.
      //
      // confidence and provenance follow services/kb/orgLayer.js exactly (corroboration_count,
      // source_postings_json, decay against last_seen) rather than inventing a second convention.
      id: "098_skill_synonyms",
      sql: `
        CREATE TABLE IF NOT EXISTS skill_synonyms (
          term                TEXT    NOT NULL,
          equivalent          TEXT    NOT NULL,
          relation            TEXT    NOT NULL DEFAULT 'related',
          confidence          REAL    NOT NULL DEFAULT 0,
          corroboration_count INTEGER NOT NULL DEFAULT 0,
          source_postings_json TEXT,
          status              TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at         INTEGER,
          reviewed_by         TEXT,
          first_seen          INTEGER,
          last_seen           INTEGER,
          updated_at          INTEGER,
          PRIMARY KEY (term, equivalent)
        );
        CREATE INDEX IF NOT EXISTS idx_skill_synonyms_status
          ON skill_synonyms(status, confidence);
        CREATE INDEX IF NOT EXISTS idx_skill_synonyms_term
          ON skill_synonyms(term, status);
      `,
    },
    {
      // AL4 (G2) — human-reviewed identity resolutions for LCA company matching.
      //
      // WHAT IS ACTUALLY UNRESOLVED, measured rather than assumed. The task described the gap as
      // "legal-entity vs brand mismatches — META PLATFORMS, INC. vs Meta". That is NOT what the
      // 6 unresolved rows are: tier A already strips legal suffixes, so those cases match. The
      // real split is
      //   3 UNMATCHED  Bolt Farm Treehouse, Epia Neuro, Physical Superintelligence — ZERO candidate
      //                employers in 144,584. There is nothing to resolve TO, and a model "finding"
      //                one would be inventing an attestation about a third party.
      //   3 AMBIGUOUS  Linear, Mercury, Ramp — real candidates that the matcher refuses to choose
      //                between. This is the only place outside knowledge can help.
      //
      // ⛔ WHY A SEPARATE TABLE AND NOT A CONFIDENCE BUMP. Saying "Company A sponsors H-1Bs" when
      // the filings belong to a similarly-named Company B is a FALSE ATTESTATION ABOUT A THIRD
      // PARTY — worse than a wrong score, because it is a factual claim about someone who is not
      // the user and cannot correct it. lcaMatch.js already declines these deliberately (see the
      // Linear case in its header: "Linear Labs LLC" is an electric-motor company and Linear.app
      // has never filed). Loosening the matcher would re-open exactly that. So resolutions live
      // beside the matcher, are proposed by a model, and reach it ONLY after a human confirms.
      //
      // resolved_employer_name NULL IS A REAL ANSWER, and the most likely correct one for Linear:
      // "none of these candidates is this company". Recording it keeps the negative pinned so a
      // later pass does not re-propose the wrong entity, exactly as a rejected skill synonym stays
      // rejected.
      id: "099_lca_company_resolutions",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_company_resolutions (
          company                TEXT    NOT NULL PRIMARY KEY,
          resolved_employer_name TEXT,
          resolved_match_key     TEXT,
          candidates_json        TEXT,
          model_confidence       REAL,
          model_reason           TEXT,
          status                 TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at            INTEGER,
          reviewed_by            TEXT,
          proposed_at            INTEGER,
          updated_at             INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_lca_company_resolutions_status
          ON lca_company_resolutions(status);
      `,
    },
    {
      // AL8 (H) — label to field mappings DERIVED from captured form structure.
      //
      // PLATFORM_LABEL_MAPS is hand-written for greenhouse, lever and workday; every other ATS falls
      // through to `generic`. G4's capture collects real form STRUCTURE from live pages, so the
      // mapping can be derived from what employers actually label their fields rather than authored
      // one ATS at a time.
      //
      // ⛔ THIS TABLE PRODUCES A TABLE, NOT A MODEL CALL AT FILL TIME. buildAnswers stays
      // deterministic — Jobo's integration terms say "No AI-generated answers" and §7 says the same.
      // Nothing here is consulted by a model; the resolver reads confirmed rows and nothing else.
      //
      // ⛔ NO ELIGIBILITY FIELD MAY EVER BE STORED HERE. Work authorisation, sponsorship, clearance,
      // visa, criminal history, EEO and years of experience resolve by EXACT HANDLER MAPPING or not
      // at all. Two live defects say why label matching must not get clever near an attestation:
      //   · `login_email` labelled "Email" resolved to the email handler and typed the candidate's
      //     address into a portal's SIGN-IN box at 0.9 confidence.
      //   · a work_authorization key substring-matched "do you now or in the future require
      //     sponsorship for work authorization" — a semantically INVERTED question, and a materially
      //     false attestation to an employer.
      // The exclusion is enforced in services/kb/formFieldMappings.js and asserted by a test, not
      // left as a comment.
      //
      // status DEFAULTS TO 'proposed' and only a human moves it. A wrong mapping fills the wrong
      // answer into a real employer's form, which cannot be recalled — so corroboration orders the
      // review queue and never promotes, exactly as with skill synonyms.
      id: "100_form_field_mappings",
      sql: `
        CREATE TABLE IF NOT EXISTS form_field_mappings (
          platform            TEXT    NOT NULL,
          label               TEXT    NOT NULL,
          field_key           TEXT    NOT NULL,
          confidence          REAL    NOT NULL DEFAULT 0,
          corroboration_count INTEGER NOT NULL DEFAULT 0,
          source_hosts_json   TEXT,
          status              TEXT    NOT NULL DEFAULT 'proposed',
          reviewed_at         INTEGER,
          reviewed_by         TEXT,
          first_seen          INTEGER,
          last_seen           INTEGER,
          PRIMARY KEY (platform, label)
        );
        CREATE INDEX IF NOT EXISTS idx_form_field_mappings_status
          ON form_field_mappings(platform, status);
      `,
    },
    {
      // U4 — BATCH PROVENANCE FOR ENRICHMENT, and the cheap version of it on purpose.
      //
      // The owner asked whether enrichment should move into its own table so it could be
      // manipulated and joined separately. It could, and the cost is the reason it does not:
      // mapJobRow is a field whitelist feeding the board, the mobile contract, the ATS scorer and
      // the KB rollups, and every one of those would need the join. This codebase's bug history is
      // contract mismatches; buying provenance with four new read paths would be paying in the
      // exact currency it keeps losing.
      //
      // So the enrichment columns STAY ON scraped_jobs and this migration adds only a pointer.
      // NO READ PATH CHANGES — mapJobRow is untouched and the board response is byte-identical.
      // What it buys: which run wrote a row, what that run cost, what it actually filled, and the
      // ability to identify and revert one bad batch.
      //
      // enrichment_batch_rows IS WHY A REVERT IS SAFE. Knowing "batch 7 touched these 25 rows" is
      // not enough to undo batch 7: enrichment writes through COALESCE, so it only ever filled
      // columns that were NULL — but on any given row it is unknowable afterwards WHICH columns
      // those were. Nulling every enrichment column would destroy values that came from ingestion
      // and predate the batch entirely. That is the same shape as the bug that nulled 120 rows
      // from the inside. So the before-image is recorded per row, and a revert restores it
      // exactly rather than reconstructing it.
      id: "101_enrichment_batches",
      sql: `
        CREATE TABLE IF NOT EXISTS enrichment_batches (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          source         TEXT    NOT NULL,
          provider       TEXT,
          model          TEXT,
          started_at     INTEGER NOT NULL,
          finished_at    INTEGER,
          rows_attempted INTEGER NOT NULL DEFAULT 0,
          rows_written   INTEGER NOT NULL DEFAULT 0,
          rows_failed    INTEGER NOT NULL DEFAULT 0,
          rows_empty     INTEGER NOT NULL DEFAULT 0,
          input_tokens   INTEGER NOT NULL DEFAULT 0,
          output_tokens  INTEGER NOT NULL DEFAULT 0,
          est_cost_usd   REAL    NOT NULL DEFAULT 0,
          coverage_json  TEXT,
          reverted_at    INTEGER,
          notes          TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_enrichment_batches_source
          ON enrichment_batches(source, started_at);
        CREATE TABLE IF NOT EXISTS enrichment_batch_rows (
          batch_id    INTEGER NOT NULL REFERENCES enrichment_batches(id) ON DELETE CASCADE,
          job_id      TEXT    NOT NULL,
          before_json TEXT    NOT NULL,
          filled_json TEXT,
          written_at  INTEGER NOT NULL,
          PRIMARY KEY (batch_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_enrichment_batch_rows_job
          ON enrichment_batch_rows(job_id);
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_batch_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_enrichment_batch
          ON scraped_jobs(enrichment_batch_id);
      `,
    },
    {
      // Task W. The lever seed in 056 has recorded `no_results` on every crawl since it landed —
      // five consecutive runs, watermark never advanced, zero lever rows ever on the board — and
      // the cause is neither a broken fetcher nor a missing company list. Lever's public postings
      // API is alive (api.lever.co/v0/postings/spotify?mode=json → 200, 75 postings); all THREE
      // seeded slugs return 404 {"ok":false,"error":"Document not found"} because those companies
      // have since moved off Lever. The plugin swallows per-company failures, so three dead slugs
      // are indistinguishable from one healthy empty board.
      //
      // Each company was re-probed across all three single-slug providers before being moved:
      //   Mercury → greenhouse/mercury   200, 59 postings (40 survive classification)
      //   Ramp    → ashby/ramp           200, 141 postings (96 survive classification)
      //   Retool  → 404 on greenhouse, lever AND ashby alike — no board found.
      //
      // Retool is deactivated rather than deleted or guessed, exactly as 070 did for Rippling:
      // active=0 is honoured by cacheJobs (`WHERE active = 1`), so it stops costing a failed
      // request every crawl while the row survives as a record to reactivate once someone finds
      // the real board. Guessing a slug is the failure this codebase has already learned from.
      //
      // Corrected forward rather than by editing 056, which has already run everywhere.
      id: "102_fix_dead_lever_slugs",
      sql: `
        UPDATE company_ats_list
           SET ats_type = 'greenhouse', ats_slug = 'mercury'
         WHERE company = 'Mercury' AND ats_type = 'lever' AND ats_slug = 'mercury';

        UPDATE company_ats_list
           SET ats_type = 'ashby', ats_slug = 'ramp'
         WHERE company = 'Ramp' AND ats_type = 'lever' AND ats_slug = 'ramp';

        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Retool' AND ats_type = 'lever' AND ats_slug = 'retool';
      `,
    },
    {
      // Task W. Company lists for the ATS providers that were registered in aggregator.js, wired
      // into cacheJobs and mapped in automationTier.js, but had never held a single company row —
      // so every crawl recorded `skipped_unconfigured` and the board carried greenhouse and ashby
      // only. The missing piece was the list, not the code.
      //
      // Every slug below was probed live and every number is measured, not estimated. `fetched`
      // is what the provider's API returns; `kept` is what survives classifyJob's blue-collar
      // eject and its roleKey===null drop inside cacheJobs — the only figure that becomes board
      // rows. All ACTIVE entries carry 100% description coverage, checked on the normalized rows.
      //
      // ACTIVE — adds ~141 rows to a ~1266-active board:
      //   lever/spotify       75 → 54     lever/matchgroup    74 → 54
      //   lever/wealthfront   23 → 17     lever/openx          7 →  4    lever/tala   7 → 2
      //   workable/blueground 20 →  2     workable/skroutz    12 →  2    workable/persado 3 → 2
      //   recruitee/channable 12 →  3     recruitee/hygraph    2 →  1
      //
      // INACTIVE — seeded as a record with its measured reason, the Rippling/Retool pattern.
      // Neither reason is "we did not check":
      //   lever/veeva            899 → 596 — real, complete rows, but +47% board size from one
      //                          company while enrichment drains at 25/day. Volume, not quality.
      //   smartrecruiters/Ubisoft2   282 →  97  ⎫ 0% description coverage. SmartRecruiters' and
      //   smartrecruiters/BoschGroup 900 → 334  ⎬ Workday's list endpoints carry no job text at
      //   workday/adobe              300 → 217  ⎭ all — unlike Workable, whose text turned out to
      //   need only `?details=true` on the same request, these two genuinely require a
      //   per-posting detail fetch, and an N+1 of that size has no budget model in cacheJobs'
      //   shared crawl loop. enrichJob.js skips description-less rows, so switching these on
      //   would add 648 permanently unenrichable rows to the board. See docs/w1-ats-providers.md.
      //
      // Workday's ats_slug is "wdNumber|tenant|site" (sources/workday.js parseSlug), not a bare
      // slug: a Workday board is per-tenant and needs three pieces of information, and the wd#
      // subdomain varies per tenant. Stored in the same column by encoding rather than by adding
      // Workday-only columns every other provider would leave null.
      id: "103_seed_remaining_ats_companies",
      sql: `
        INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active, bucket_role) VALUES
          ('Spotify',     'lever',          'spotify',                     1, 'software_engineer'),
          ('Match Group', 'lever',          'matchgroup',                  1, 'software_engineer'),
          ('Wealthfront', 'lever',          'wealthfront',                 1, 'software_engineer'),
          ('OpenX',       'lever',          'openx',                       1, 'software_engineer'),
          ('Tala',        'lever',          'tala',                        1, 'software_engineer'),
          ('Blueground',  'workable',       'blueground',                  1, 'software_engineer'),
          ('Skroutz',     'workable',       'skroutz',                     1, 'software_engineer'),
          ('Persado',     'workable',       'persado',                     1, 'software_engineer'),
          ('Channable',   'recruitee',      'channable',                   1, 'software_engineer'),
          ('Hygraph',     'recruitee',      'hygraph',                     1, 'software_engineer'),
          ('Veeva Systems','lever',         'veeva',                       0, 'software_engineer'),
          ('Ubisoft',     'smartrecruiters','Ubisoft2',                    0, 'software_engineer'),
          ('Bosch',       'smartrecruiters','BoschGroup',                  0, 'software_engineer'),
          ('Adobe',       'workday',        '5|adobe|external_experienced',0, 'software_engineer');
      `,
    },
    {
      // Task AA. `salary_period` is a three-value vocabulary — annual | hourly | monthly — shared
      // by the board filters, enrichJob's validation and the enrichment importer. 30 production
      // rows held the string `peryearsalary`, every one of them from lever.
      //
      // Ingestion put it there. sources/lever.js passes `salaryRange.interval` through verbatim,
      // Lever's own value is `per-year-salary`, and schema.js's normalizeSalaryPeriod stripped the
      // separators and then FELL THROUGH TO `return p` — so an unrecognised token became the
      // stored value instead of null. Fixed in the same commit as this migration; that stops new
      // rows acquiring it, and this repairs the ones that already have.
      //
      // FOUND BY THE EXPORT -> IMPORT ROUND TRIP, which is the part worth keeping: posting a
      // 500-row export straight back reported `wouldWrite 0` (correct — nothing changed) and
      // `rejected 30`. The importer validates against the same vocabulary and is all-or-nothing by
      // design, so these 30 rows made every export batch containing one of them un-importable. A
      // silent ingestion defect was disabling the transfer path, and nothing else had noticed.
      //
      // Mapped rather than nulled where Lever's meaning is unambiguous: per-year-salary IS annual.
      // The intervals with no honest target in the vocabulary (`per-week-salary`, `per-day-wage`,
      // `one-time-payment`) are set to NULL instead of being rounded to the nearest allowed value,
      // because inventing a period would misstate the pay. The final catch-all nulls anything
      // outside the vocabulary, so this repairs values no one has seen yet as well.
      id: "104_repair_salary_period_vocabulary",
      sql: `
        UPDATE scraped_jobs SET salary_period = 'annual'
         WHERE salary_period IN ('peryearsalary', 'per-year-salary', 'per_year_salary');
        UPDATE scraped_jobs SET salary_period = 'hourly'
         WHERE salary_period IN ('perhourwage', 'per-hour-wage', 'per_hour_wage');
        UPDATE scraped_jobs SET salary_period = 'monthly'
         WHERE salary_period IN ('permonthsalary', 'per-month-salary', 'per_month_salary');
        UPDATE scraped_jobs SET salary_period = NULL
         WHERE salary_period IS NOT NULL
           AND salary_period NOT IN ('annual', 'hourly', 'monthly');
      `,
    },
    {
      // 105 — ANONYMOUS SPEND WAS BOUNDED BY A COOKIE THE CALLER CONTROLS.
      // standaloneRateLimit counted an anonymous caller's runs by req.sessionID, so the quota
      // reset with a new cookie: clearing site data, or a fresh incognito window, restored a full
      // allowance. /api/standalone/generate runs Sonnet at 8192 max_tokens and is the single
      // largest per-call cost in the system, so the bound that mattered most was the one anybody
      // with a browser could step around. client_ip is the coarse identity that does not reset on
      // demand. Nullable and additive: existing rows keep counting under their session id.
      id: "105_standalone_usage_client_ip",
      sql: `
        ALTER TABLE standalone_usage ADD COLUMN client_ip TEXT;
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_ip
          ON standalone_usage(client_ip, service, used_at);
        CREATE INDEX IF NOT EXISTS idx_standalone_usage_service_time
          ON standalone_usage(service, used_at);
      `,
    },
    {
      // 106 — CREDENTIAL-SHAPED RESIDUE OF A DELETED FEATURE.
      // The extension token copy/paste flow was removed in c818b9c. SQLite does not drop a table
      // when its CREATE statement leaves the source, so production kept `import_extension_tokens`
      // — 3 rows of token hashes bound to users(id) that no code can expire, consume or rotate,
      // because the code that did was deleted. Zero references repo-wide, verified before writing
      // this: the only mentions are docs and the schema-diff harness that reports the table.
      // Filed by task T, restated by AH-2, never done.
      //
      // IF EXISTS because the table is PRODUCTION-ONLY — a local checkout that never ran the
      // removed feature has nothing to drop, and this must be a no-op there rather than a failure.
      id: "106_drop_import_extension_tokens",
      sql: `
        DROP TABLE IF EXISTS import_extension_tokens;
      `,
    },
    {
      // 107 — DETAIL-FETCH BOOKKEEPING (task Y phase 2).
      //
      // ⛔ THIS LIST AND scripts/migrations.js ARE TWO COPIES OF THE SAME THING, AND *THIS* ONE IS
      // THE RUNNER. The loop below is what executes at boot; scripts/migration.js reads the other
      // copy. A migration added only to scripts/migrations.js never runs in production, and a
      // migration added only here is invisible to the standalone tool. Both were updated together
      // for 107. test/migrationListsAgree.test.js pins them to each other so the next one cannot
      // land in only one.
      //
      // The three columns exist because the description for a SmartRecruiters or Workday posting
      // now arrives from a SECOND HTTP request, made inside the enrichment pass rather than the
      // crawl (services/jobs/detailFetch.js explains that seam):
      //
      //   detail_fetched_at      when a fetch last SUCCEEDED — distinguishes "the list carried a
      //                          description" from "we bought one", per row rather than per guess.
      //   detail_fetch_attempts  what this row has COST. Yield is descriptions-obtained per
      //                          request-SPENT, and spend is not derivable from outcomes: a
      //                          description-less row might have cost zero requests or three.
      //                          Also the bound on re-spending on a posting deleted upstream.
      //   detail_fetch_error     the last reason ('http_404', 'no_text', 'http_429', …). A count
      //                          with no reason cannot tell "the posting is gone" from "we were
      //                          rate-limited", and those want opposite responses.
      //
      // ⛔ NOTHING HERE MARKS A ROW DONE. content_hash and enriched_at remain the only "processed"
      // signals and the detail fetch writes neither, on success OR failure — stamping a row
      // complete when nothing was filled is what once nulled 120 rows, and a 429 mid-fetch is the
      // obvious way to recreate it. A row that has burned its attempts stays a candidate forever;
      // it has only stopped being worth another request, which one UPDATE re-arms.
      id: "107_detail_fetch_bookkeeping",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetched_at     INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetch_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE scraped_jobs ADD COLUMN detail_fetch_error    TEXT;

        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_detail_pending
          ON scraped_jobs(is_active, source, detail_fetch_attempts)
          WHERE description IS NULL OR TRIM(description) = '';
      `,
    },
    {
      // 108 — THE ATS REPORT CACHE IS PER (USER, PROFILE, JOB), NOT PER (USER, JOB).
      //
      // ⛔ THE SERIOUS DEFECT CC5 FIXED IS NOT THIS ONE — it was `scraped_jobs.ats_report`, one cell
      // per JOB, served to any user who opened the posting (a candidate's matched/missing terms,
      // computed against their résumé, handed to a stranger). That is removed in server.js and needs
      // no migration. This is the narrower sibling: `ats_only_reports` was correctly scoped to a
      // user and incorrectly scoped across their PROFILES, so a user with an engineering profile and
      // a data profile got one cached report per posting and the second profile read the first's.
      //
      // SQLite cannot widen a UNIQUE constraint in place, so the table is rebuilt and refilled.
      // Existing rows carry `domain_profile_id NULL`, which honestly means "cached before profiles
      // were distinguished" — the reads treat it as a last-resort fallback rather than deleting
      // history. There are 0 rows on this database, so the rebuild is a no-op here and the code path
      // still has to be right for a deployment that has some.
      //
      // ⛔ scorer_version AND scored_at ARE NOT DECORATION. A stored score with neither is
      // unfalsifiable: the one row that ever carried a score stored 43 and scored null on the same
      // day, and nothing recorded which engine produced the 43 — so a stale cache and a changed
      // scorer were indistinguishable. Any surviving stored score now says what computed it, which
      // is what lets a later version invalidate it instead of guessing.
      id: "108_ats_reports_per_profile",
      sql: `
        -- The per-user ATS report cache was UNIQUE(user_id, job_id): one row per user per job, with
        -- no profile. A user with an engineering profile and a data profile got ONE cached report
        -- for a posting, whichever they opened first, and the other profile silently read it.
        --
        -- SQLite cannot drop or widen a UNIQUE constraint in place, so the table is rebuilt. It is
        -- additive in the sense that matters: every existing row is carried over with
        -- domain_profile_id NULL, which reads as "cached before profiles were distinguished" and is
        -- honoured by the reads as a last-resort fallback rather than being thrown away.
        --
        -- scorer_version and scored_at exist because a stored score with neither is UNFALSIFIABLE.
        -- The one row that used to carry a score stored 43 while scoring null on the same day, and
        -- nothing recorded which engine produced the 43, so there was no way to tell a stale cache
        -- from a changed scorer. Any stored score now says what computed it and when.
        CREATE TABLE IF NOT EXISTS ats_only_reports_v2 (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          domain_profile_id INTEGER REFERENCES domain_profiles(id) ON DELETE CASCADE,
          job_id            TEXT NOT NULL,
          ats_report        TEXT NOT NULL,
          ats_score         INTEGER,
          scorer_version    TEXT,
          scored_at         INTEGER,
          created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(user_id, domain_profile_id, job_id)
        );

        INSERT INTO ats_only_reports_v2
          (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, created_at)
        SELECT user_id, NULL, job_id, ats_report, ats_score, NULL, created_at, created_at
        FROM ats_only_reports;

        DROP TABLE ats_only_reports;
        ALTER TABLE ats_only_reports_v2 RENAME TO ats_only_reports;

        -- The board LEFT JOINs this per (user, profile, job) on every page, so the lookup has to be
        -- an index seek rather than a scan of one user's whole history.
        CREATE INDEX IF NOT EXISTS idx_ats_only_reports_lookup
          ON ats_only_reports(user_id, domain_profile_id, job_id);
      `,
    },
    {
      // 109 — RESTORE THE SENIORITY ENRICHMENT STRIPPED OUT OF normalized_title.
      //
      // ccfef0f stopped enrichment overwriting this column. This repairs what it already did — but
      // only the part of it that measurement can defend, which is NARROWER than the audit that
      // prompted it first claimed.
      //
      // ⛔ THE OBVIOUS REPAIR IS WRONG AND WAS MEASURED BEFORE BEING REJECTED. 475 production rows
      // had normalized_title rewritten and 469 were made SHORTER, which docs/PART1_RECONCILED
      // -2026-09-18.md §4 read as systematic truncation. Looking at the largest losses says
      // otherwise — several are the column doing its job:
      //
      //     "senior fullstack engineer (f/m/d) - berlin i germany | eu i remote"
      //          -> "senior fullstack engineer"                        BETTER
      //     "fraud analyst (revenue protection) - 12-month fixed-term"
      //          -> "fraud analyst"                                    BETTER
      //
      // Restoring all 469 would push location, EEO and contract-duration noise back into a column
      // whose entire purpose is to strip it. Length was a bad proxy for harm.
      //
      // WHAT IS DEFENSIBLE IS SENIORITY LOSS. Of the sampled rows that carried a seniority token,
      // 27 LOST it against 10 that kept it, and those are unambiguous:
      //
      //     "senior / staff product engineer"                -> "product engineer"
      //     "lead product marketing manager - verticals"      -> "product marketing manager"
      //     "senior manager, account executive | mid-market"  -> "account executive manager"
      //
      // `detectSeniority` in services/jobs/classifyJob.js matches exactly these tokens on the title
      // to decide a posting's level, and the ATS scorer prices seniority mismatch. There is no
      // reading in which dropping "senior" makes a normalised title better. 54 rows on production.
      //
      // ⛔ THE EARLIEST BEFORE-IMAGE, NOT THE LATEST. 28 jobs appear in more than one enrichment
      // batch, so the most recent before_json for those holds a value a PREVIOUS pass had already
      // truncated. Restoring that would restore the damage. ROW_NUMBER() ordered by written_at
      // picks the original ingested value. Verified against a fixture carrying exactly that shape.
      //
      // Naturally idempotent: after the restore the WHERE cannot match again, because the token it
      // looks for is present. Re-running changes 0 rows.
      //
      // NOT PRESERVED, and stated rather than discovered: the truncated values are overwritten and
      // not recorded anywhere. They are the damage; the authoritative value stays in
      // enrichment_batch_rows.before_json, so the direction that matters remains recoverable.
      id: "109_restore_stripped_seniority_titles",
      sql: `
        WITH earliest AS (
          SELECT e.job_id,
                 json_extract(e.before_json, '$.normalized_title') AS orig,
                 ROW_NUMBER() OVER (PARTITION BY e.job_id ORDER BY e.written_at, e.batch_id) AS rn
          FROM enrichment_batch_rows e
          WHERE json_extract(e.before_json, '$.normalized_title') IS NOT NULL
            AND TRIM(json_extract(e.before_json, '$.normalized_title')) <> ''
        )
        UPDATE scraped_jobs AS s
        SET normalized_title = (SELECT x.orig FROM earliest x WHERE x.job_id = s.job_id AND x.rn = 1)
        WHERE EXISTS (
          SELECT 1 FROM earliest x
          WHERE x.job_id = s.job_id AND x.rn = 1
            AND s.normalized_title <> x.orig
            AND (   (x.orig LIKE '%staff%'         AND s.normalized_title NOT LIKE '%staff%')
                 OR (x.orig LIKE '%senior%'        AND s.normalized_title NOT LIKE '%senior%')
                 OR (x.orig LIKE '%principal%'     AND s.normalized_title NOT LIKE '%principal%')
                 OR (x.orig LIKE '%lead%'          AND s.normalized_title NOT LIKE '%lead%')
                 OR (x.orig LIKE '%distinguished%' AND s.normalized_title NOT LIKE '%distinguished%')
                 OR (x.orig LIKE '%director%'      AND s.normalized_title NOT LIKE '%director%')
                 OR (x.orig LIKE '%head of%'       AND s.normalized_title NOT LIKE '%head of%'))
        );
      `,
    },
    {
      // 110 — EVERY STORED ATS REPORT SAYS WHICH CANDIDATE BASIS PRODUCED IT.
      //
      // The board now ranks by fit, read from ats_only_reports, and a precompute fills that table
      // for every active posting ahead of time (services/jobs/boardFitPrecompute.js). A precomputed
      // score is only reusable while the résumé, claims and profile it was computed from are
      // unchanged — so each row records a hash of those inputs, and a row whose hash no longer
      // matches is re-scored instead of served.
      //
      // ⛔ REUSED ats_only_reports RATHER THAN A NEW board_fit_scores TABLE, deliberately. The card's
      // badge (matchScore), the ATS panel's cached report and the apply stamp already read this row.
      // A second table holding the same score would be two stores of one fact, free to disagree —
      // a card sorted as Strong while its badge and its report say Weak. Cost, measured: ~850 bytes
      // of report per row, ~2.2 MB per profile over a 2,616-posting board.
      //
      // Additive: one nullable column. Existing rows read NULL, which the precompute treats as
      // "basis unknown" (stale), never as fresh. The existing 108 index on
      // (user_id, domain_profile_id, job_id) already serves the board's join and the plan's scan.
      id: "110_ats_reports_basis_hash",
      sql: `
        -- The hash of the candidate-side inputs a stored report was scored against: the runtime
        -- basis (résumé text, signal profile, domain profile, claims) plus the scorer version.
        -- NULL on rows written before this migration, which reads as "basis unknown" — stale,
        -- never fresh — so nothing written without a hash can be mistaken for a current score.
        ALTER TABLE ats_only_reports ADD COLUMN basis_hash TEXT;
      `,
    },
    {
      // UI step 3a (09-30) — the daily draft. docs/UI_REDESIGN.md §3.1, services/dailyDraft.js.
      // Stores the DEAL — which cards, in what order, what they looked like at deal time — and NOT
      // the decisions, which already live in apply_run_jobs and user_jobs. The PRIMARY KEY makes a
      // concurrent first deal lose cleanly; UNIQUE(job) keeps a job to one slot per day.
      id: "111_daily_drafts",
      sql: `
        CREATE TABLE IF NOT EXISTS daily_drafts (
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_id  INTEGER NOT NULL,
          draft_date  TEXT    NOT NULL,
          position    INTEGER NOT NULL,
          job_id      TEXT    NOT NULL,
          band        TEXT    NOT NULL,
          card_json   TEXT    NOT NULL,
          dealt_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, profile_id, draft_date, position),
          UNIQUE (user_id, profile_id, draft_date, job_id)
        );
      `,
    },
    {
      // Follow-up 18 (09-30): the light/dark preference stored with the ACCOUNT, so it follows the
      // user between devices (UI_REDESIGN §Step 6 said per user; it was per device). NULL = never set,
      // which means "system" and lets a device keep its own until the user chooses.
      id: "112_users_theme_preference",
      sql: `
        ALTER TABLE users ADD COLUMN theme_preference TEXT;
      `,
    },
    {
      // Account management (09-30): a registry of each user's sessions (the store is sealed and keyed
      // by sid alone, so it cannot list "my sessions"); whether the password was ever SET by the user
      // (OAuth accounts got a random one — backfilled: no provider id means a password account);
      // the uploaded picture; a verified-email stamp; one-time email codes; and the merge log.
      id: "113_account_management",
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          sid TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          user_agent TEXT,
          ip_hint TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
        ALTER TABLE users ADD COLUMN password_set INTEGER NOT NULL DEFAULT 0;
        UPDATE users SET password_set = CASE WHEN google_auth_id IS NULL AND linkedin_auth_id IS NULL AND github_auth_id IS NULL THEN 1 ELSE 0 END;
        ALTER TABLE users ADD COLUMN avatar_path TEXT;
        ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
        CREATE TABLE IF NOT EXISTS email_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          purpose TEXT NOT NULL,
          email TEXT,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes(user_id, purpose);
        -- no foreign keys: the FROM account is gone by design, and the log outlives both
        CREATE TABLE IF NOT EXISTS account_merges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          into_user_id INTEGER NOT NULL,
          from_user_id INTEGER NOT NULL,
          summary_json TEXT,
          merged_at INTEGER NOT NULL
        );
      `,
    },
    {
      // Queue 38 (10-01): the deck's geometry — a preset or the three sliders — with the ACCOUNT, as
      // theme_preference is (112). JSON in shared/deckGeometry.js's shape; NULL = never set = standard.
      id: "114_users_deck_geometry",
      sql: `
        ALTER TABLE users ADD COLUMN deck_geometry TEXT;
      `,
    },
    {
      // Owner, 10-02 (A44): Skroutz's Workable board is alive but every posting is in Greece, and draft
      // is US-only (A37). Deactivated, not deleted — as 102 did for Retool: active=0 is honoured by
      // cacheJobs, the crawl stops spending a request on it, and the row stays as the record should
      // it ever post in the US. Its existing rows are held out by the A37 gate on the next crawl.
      // (Hygraph's empty board is KEPT, also the owner's call.)
      id: "115_deactivate_skroutz_outside_us",
      sql: `
        UPDATE company_ats_list
           SET active = 0
         WHERE company = 'Skroutz' AND ats_type = 'workable' AND ats_slug = 'skroutz';
      `,
    },
    {
      // A49 (10-02): a duplicate is RETIRED, recorded and restorable — never just demoted, never
      // hard-deleted. duplicate_of names the canonical row; retired_reason/retired_at say why and
      // when. job_dedup_log keeps what moved with each retirement (users' Saves, Passes,
      // applications, resumes) so services/jobs/dedupRetire.js can put it back; restored_at marks a
      // pair someone kept apart, which dedup then never merges again. Additive only.
      id: "116_dedup_retire_and_log",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN duplicate_of   TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN retired_reason TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN retired_at     INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_duplicate_of ON scraped_jobs(duplicate_of);
        CREATE TABLE IF NOT EXISTS job_dedup_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          from_job_id TEXT NOT NULL,
          to_job_id   TEXT NOT NULL,
          reason      TEXT NOT NULL,
          moved_json  TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          restored_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_job_dedup_log_from ON job_dedup_log(from_job_id);
        CREATE INDEX IF NOT EXISTS idx_job_dedup_log_to   ON job_dedup_log(to_job_id);
      `,
    },
    {
      // 118 (A52) — EVERY STORED ATS REPORT SAYS WHICH VERSION OF THE POSTING IT SCORED.
      // 110's basis_hash covers the candidate side only, so a posting scored before its enrichment
      // landed kept that verdict forever: a board card read "No signal" while the ATS panel, scoring
      // the same posting fresh, read "Strong match". job_hash is services/jobs/boardFitPrecompute.js
      // atsJobInputHash over the columns the scorer reads; a row is fresh only when both hashes
      // match. Additive: NULL on existing rows reads as stale, never fresh, so the first pass after
      // deploy re-scores each active profile's board once.
      id: "118_ats_reports_job_hash",
      sql: `
        ALTER TABLE ats_only_reports ADD COLUMN job_hash TEXT;
      `,
    },
    {
      // A58 (10-02): what an admin write CHANGED, with the value it replaced, so it can be undone and
      // so it can be read afterwards. Job Review's Save/Unclassify rewrote a posting's role map with no
      // record of the old one; an admin user delete left no trace that it happened. One row per write.
      // admin_user_id deliberately has NO foreign key and is not named user_id: deleting an admin must
      // not cascade away the record of what that admin did, and this is not a per-user table.
      id: "119_admin_audit_log",
      sql: `
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at INTEGER NOT NULL DEFAULT (unixepoch()),
          admin_user_id INTEGER,
          action TEXT NOT NULL,
          target TEXT,
          before_json TEXT,
          after_json TEXT,
          undone_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
          ON admin_audit_log(action, target);
      `,
    },
    {
      // A59 (10-02): A DRAFT WAITS IN LINE (owner, O44). A Draft made while one of the user's runs is
      // active used to be refused 429 run_already_active; it now waits as an apply_runs row with
      // status 'waiting', and line_position is its place (lowest starts next). NULL on every other
      // status, so existing rows need nothing. The waiting run's jobs keep status 'queued', which is
      // what keeps the duplicate filter, the caps and the outcome partition unchanged.
      id: "120_apply_run_line",
      sql: `
        ALTER TABLE apply_runs ADD COLUMN line_position INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_runs_line
          ON apply_runs(user_id, status, line_position);
      `,
    },
    {
      // A63 (owner, O45c, 10-02): PENDING -> VERIFIED -> SUBMITTED, and a résumé generation costs one
      // of the day's Draft slots. application_records holds a job the user generated for, opened the
      // posting of, or exported a résumé for — PENDING until they record the submission (when, how,
      // a confirmation) and it is VERIFIED; only then is job_applications written. Nothing becomes
      // "submitted" on a click alone. draft_slot_uses is the ledger of board generations; Drafts are
      // counted from apply_run_jobs, so a generation and a Draft share one daily allowance.
      // The backfill makes every résumé generated before this a PENDING record, unless it was already
      // applied to or belongs to a Draft (the pipeline tracks those).
      id: "121_application_records",
      sql: `
        CREATE TABLE IF NOT EXISTS application_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'pending',
          origin TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          submitted_at INTEGER,
          method TEXT,
          reference TEXT,
          evidence_text TEXT,
          evidence_url TEXT,
          recorded_at INTEGER,
          verified_at INTEGER,
          verification_json TEXT,
          withdrawn_at INTEGER,
          UNIQUE(user_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_application_records_user_state
          ON application_records(user_id, state, updated_at);
        CREATE TABLE IF NOT EXISTS draft_slot_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          job_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_draft_slot_uses_user_time
          ON draft_slot_uses(user_id, created_at);
        INSERT OR IGNORE INTO application_records (user_id, job_id, state, origin, created_at, updated_at)
          SELECT r.user_id, r.job_id, 'pending', 'generated', COALESCE(r.created_at, unixepoch()), unixepoch()
          FROM resumes r
          WHERE r.job_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM job_applications ja WHERE ja.user_id = r.user_id AND ja.job_id = r.job_id)
            AND NOT EXISTS (SELECT 1 FROM apply_run_jobs rj WHERE rj.user_id = r.user_id AND rj.job_id = r.job_id);
      `,
    },
    {
      // A62 (owner, 10-02): ONE GATEWAY FOR JOB DATA IN. job_captures records every job a user brought
      // in (extension capture, imported URL, pasted text) or an admin imported, with the ATS host and
      // slug read from its URL — what A45's slug harvesting reads — and what the gateway did with it
      // (inserted, or attached to an existing row; held out of market). user_id is SET NULL on account
      // deletion: the URL and slug are a fact about an employer's board, not about the person.
      // job_import_batches makes an admin import revertible: the rows a batch INSERTED are retired
      // (soft, A49's columns), never deleted.
      id: "122_job_captures",
      sql: `
        CREATE TABLE IF NOT EXISTS job_captures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          job_id TEXT NOT NULL,
          url TEXT,
          ats_type TEXT,
          ats_slug TEXT,
          origin TEXT NOT NULL,
          action TEXT NOT NULL,
          out_of_market INTEGER NOT NULL DEFAULT 0,
          batch_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_job_captures_slug ON job_captures(ats_type, ats_slug);
        CREATE INDEX IF NOT EXISTS idx_job_captures_batch ON job_captures(batch_id);
        CREATE TABLE IF NOT EXISTS job_import_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          rows_in INTEGER NOT NULL DEFAULT 0,
          inserted INTEGER NOT NULL DEFAULT 0,
          attached INTEGER NOT NULL DEFAULT 0,
          held_out_of_market INTEGER NOT NULL DEFAULT 0,
          refused INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          reverted_at INTEGER,
          reverted_rows INTEGER
        );
      `,
    },
    {
      // A72 (owner, 10-03): "normalise synonyms with equal weight: ai = artificial intelligence, ml =
      // machine learning". The owner's brief IS the review that services/kb/skillSynonyms.js requires
      // before a pair may be confirmed, so the two land confirmed, as aliases, reviewed_by the brief.
      // Stored as canonicalPair orders them (term < equivalent). An earlier proposal or rejection of
      // the same pair is overruled: the owner's word is the newest review. The board's search
      // (services/jobs/boardSearch.js) and the scorer (CC3) both read loadConfirmedSynonyms, so these
      // two rows reach both; there is no second synonym table.
      id: "123_owner_skill_aliases",
      sql: `
        INSERT INTO skill_synonyms
          (term, equivalent, relation, confidence, corroboration_count, status, reviewed_at, reviewed_by,
           first_seen, last_seen, updated_at)
        VALUES
          ('ai', 'artificial intelligence', 'alias', 1, 0, 'confirmed', unixepoch(), 'owner (A72 brief, 10-03)',
           unixepoch(), unixepoch(), unixepoch()),
          ('machine learning', 'ml', 'alias', 1, 0, 'confirmed', unixepoch(), 'owner (A72 brief, 10-03)',
           unixepoch(), unixepoch(), unixepoch())
        ON CONFLICT(term, equivalent) DO UPDATE SET
          relation = 'alias', status = 'confirmed', reviewed_at = excluded.reviewed_at,
          reviewed_by = excluded.reviewed_by, updated_at = excluded.updated_at;
      `,
    },
    {
      // A77 (owner, 10-03): company logos resolved ONCE PER COMPANY during enrichment and STORED — the
      // bytes, served first-party from /api/company-logo/<key> (services/jobs/companyLogoStore.js), so
      // a provider that dies later cannot take stored logos with it. status 'none' records a company
      // nothing could serve (re-tried after 30 days); no URL is ever stored for it.
      id: "124_company_logos",
      sql: `
        CREATE TABLE IF NOT EXISTS company_logos (
          company_key TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          domain TEXT,
          status TEXT NOT NULL,
          provider TEXT,
          mime TEXT,
          bytes BLOB,
          error TEXT,
          checked_at INTEGER NOT NULL
        );
      `,
    },
    {
      // D16 (owner, 10-03): the résumé an application SENT, kept with the application and downloadable
      // from The Table months later. resumes.html is the working copy and a regeneration overwrites
      // it, so it cannot answer "what did I send?". Stored as the HTML, brotli-compressed
      // (services/applicationArtifacts.js: ~1.7 KB a résumé, measured; a stored PDF is ~56x that), with
      // the sha256 of the uncompressed bytes so a corrupt row FAILS on read instead of serving an empty
      // file. A PDF is printed from it on demand and never stored. No user_id: the artifact belongs to
      // its record and goes with it (and with the account, through the record's cascade).
      id: "125_application_artifacts",
      sql: `
        CREATE TABLE IF NOT EXISTS application_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL REFERENCES application_records(id) ON DELETE CASCADE,
          kind TEXT NOT NULL DEFAULT 'resume',
          media_type TEXT NOT NULL,
          encoding TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          raw_bytes INTEGER NOT NULL,
          stored_bytes INTEGER NOT NULL,
          body BLOB NOT NULL,
          source TEXT NOT NULL,
          resume_id INTEGER,
          resume_updated_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(record_id, kind)
        );
      `,
    },
    {
      // A76 under D17 (owner, 10-03: "only résumé generation may call a model"): the validation
      // corpus is graded OUTSIDE the product — export a blind file, grade it, import the grades. The
      // grades REUSE the enrichment manual path's provenance, not a second batch system: an import
      // is an enrichment_batches row (kind 'ats_grade'), each graded posting an enrichment_batch_rows
      // before-image, and revertBatch dispatches on kind. `kind` defaults to 'enrichment', so every
      // existing batch reads exactly as before. A grade is a judgement of a posting AGAINST A PROFILE,
      // so it cannot live on scraped_jobs like an enrichment column; it gets its own table, keyed by
      // grader so the owner's, an external model's and the 10-03 model grades sit side by side.
      // content_hash is the staleness interlock: a grade is about the text that was graded.
      id: "126_ats_grade_corpus",
      sql: `
        ALTER TABLE enrichment_batches ADD COLUMN kind TEXT NOT NULL DEFAULT 'enrichment';
        CREATE TABLE IF NOT EXISTS ats_corpus_grades (
          corpus       TEXT    NOT NULL,
          job_id       TEXT    NOT NULL,
          grader       TEXT    NOT NULL,
          profile_id   INTEGER,
          fit          INTEGER NOT NULL CHECK (fit BETWEEN 1 AND 5),
          content_hash TEXT    NOT NULL,
          batch_id     INTEGER REFERENCES enrichment_batches(id),
          graded_at    INTEGER NOT NULL,
          note         TEXT,
          PRIMARY KEY (corpus, job_id, grader)
        );
      `,
    },
    {
      // D20 (owner, 10-04): the slug harvest rides in the daily manual sweep. A sweep runs a handful
      // of SerpApi google_jobs searches by hand (no cron, no model), pools every ATS URL in the
      // results' apply_options as an UNORDERED set of (ats_type, slug) — never attached to the job it
      // was found under, because Google clusters different employers' postings into one result — and
      // the owner reviews an export and imports decisions. Numbered 127: 125 and 126 are taken by the
      // unmerged D16 and A76 branches.
      //   slug_harvest_sweeps        one row per sweep: what was searched, what it found, per query
      //   slug_harvest_pool          one row per (ats_type, slug) ever seen, its last validation and
      //                              the owner's decision
      //   slug_harvest_imports       provenance for an imported decision file (revertable whole)
      //   slug_harvest_import_rows   each row's before-image, so a revert restores it exactly
      id: "127_slug_harvest",
      sql: `
        CREATE TABLE IF NOT EXISTS slug_harvest_sweeps (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at    INTEGER NOT NULL,
          finished_at   INTEGER,
          admin_user_id INTEGER,
          searches      INTEGER NOT NULL DEFAULT 0,
          links         INTEGER NOT NULL DEFAULT 0,
          ats_links     INTEGER NOT NULL DEFAULT 0,
          pairs         INTEGER NOT NULL DEFAULT 0,
          new_pairs     INTEGER NOT NULL DEFAULT 0,
          queries_json  TEXT NOT NULL,
          error         TEXT
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_pool (
          ats_type        TEXT NOT NULL,
          slug_key        TEXT NOT NULL,
          ats_slug        TEXT NOT NULL,
          sample_url      TEXT,
          first_sweep_id  INTEGER,
          first_query     TEXT,
          first_seen_at   INTEGER NOT NULL,
          last_seen_at    INTEGER NOT NULL,
          times_seen      INTEGER NOT NULL DEFAULT 1,
          state           TEXT,
          validation_json TEXT,
          validated_at    INTEGER,
          decision        TEXT,
          company         TEXT,
          decided_at      INTEGER,
          import_id       INTEGER,
          company_id      INTEGER,
          PRIMARY KEY (ats_type, slug_key)
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_imports (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          imported_at     INTEGER NOT NULL,
          admin_user_id   INTEGER,
          file_sha256     TEXT NOT NULL,
          rows_written    INTEGER NOT NULL DEFAULT 0,
          companies_added INTEGER NOT NULL DEFAULT 0,
          reverted_at     INTEGER
        );
        CREATE TABLE IF NOT EXISTS slug_harvest_import_rows (
          import_id   INTEGER NOT NULL REFERENCES slug_harvest_imports(id),
          ats_type    TEXT NOT NULL,
          slug_key    TEXT NOT NULL,
          before_json TEXT NOT NULL,
          after_json  TEXT NOT NULL,
          company_id  INTEGER,
          PRIMARY KEY (import_id, ats_type, slug_key)
        );
      `,
    },
    {
      // D29 (owner, 10-04): FILTERS QUERY OUR OWN TAGS, NOT FREE TEXT. services/jobs/jobTags.js
      // derives them deterministically (no model call, D17) and the owner fills the rest through
      // export -> tag -> import (routes/jobTags.js). Every tag is nullable and NULL means UNKNOWN —
      // every predicate over them is soft-null. Numbered 128: 125 (D16) and 126 (A76) are held by
      // unmerged branches and 127 is the slug harvest.
      //   scraped_jobs.tag_*     the scalar tags; tag_owner_json holds owner-set values, which a
      //                          re-tag never overwrites; tag_basis/tag_version say when to re-tag
      //   job_tag_places         a posting's places as a SET (country, state, metro) — one posting
      //                          can be in several places, so location is not a column
      id: "128_job_tags",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN tag_level TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_function TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_employment TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_workplace TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_remote INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN tag_us TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_basis TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tag_version INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN tag_owner_json TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN tagged_at INTEGER;
        CREATE TABLE IF NOT EXISTS job_tag_places (
          job_id  TEXT NOT NULL,
          country TEXT NOT NULL,
          state   TEXT,
          metro   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_job   ON job_tag_places(job_id);
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_metro ON job_tag_places(metro, job_id);
        CREATE INDEX IF NOT EXISTS idx_job_tag_places_state ON job_tag_places(state, job_id);
      `,
    },
    {
      // D43 (10-06): AN APPLICATION RECORD MUST SURVIVE ITS POSTING. job_applications already held the
      // company, title, URL and location; the pay was read from the posting through a LEFT JOIN, so a
      // deleted posting blanked it. apply_run_jobs held only the job_id. Both now snapshot what the user
      // applied to at the moment they applied, so the record stands without the posting.
      id: "129_application_snapshots",
      sql: `
        ALTER TABLE job_applications ADD COLUMN salary_min INTEGER;
        ALTER TABLE job_applications ADD COLUMN salary_max INTEGER;
        ALTER TABLE job_applications ADD COLUMN salary_currency TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_title TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_company TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_url TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN posting_location TEXT;
      `,
    },
    {
      // D53 (10-07): CLEAR GOES TO A 7-DAY BIN. Draft House's Remove was already a SOFT hide (hidden_at);
      // it now also sets purge_after, so a cleared item can be restored for 7 days and is then purged by
      // services/draftBin.js's sweep — which sets purged_at once it has scrubbed the row's answers, packets
      // and screenshot. A row hidden before this migration has purge_after NULL: it is not in the bin and
      // is never purged (still restorable by an operator, as before).
      id: "130_draft_bin",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN purge_after INTEGER;
        ALTER TABLE apply_run_jobs ADD COLUMN purged_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_apply_run_jobs_bin ON apply_run_jobs(user_id, purge_after);
      `,
    },
    {
      // D58 (10-07): BASE → TAILORED, STORED AS ONE PAIR. A generation already measures the base résumé's
      // score for the posting just before the model call (AK1's atsScoreBefore, the same scorer and job as
      // the tailored score). It is now kept beside the tailored score on the résumé, so "Base 58 → tailored
      // 71" is one stored statement every surface reads. NULL: generated before this, or the scorer declined.
      id: "131_resume_score_pair",
      sql: `
        ALTER TABLE resumes ADD COLUMN base_ats_score INTEGER;
        ALTER TABLE resume_versions ADD COLUMN base_ats_score INTEGER;
      `,
    },
    {
      // D55 (i) (10-07): THE TABLE'S CSV IMPORT KEEPS THE COMPANY'S WEBSITE. Duplicates and By company are
      // keyed by the D54 company identity, whose strongest evidence is the DOMAIN — and a past application
      // imported from a file has no posting and no logo-store row to carry one. Without this column two
      // same-named companies imported with different websites would merge the moment they were stored.
      // NULL: every row written before this, and every row whose domain comes from the logo store instead.
      id: "135_application_company_domain",
      sql: `
        ALTER TABLE job_applications ADD COLUMN company_domain TEXT;
      `,
    },
    {
      // D55 decision E (10-07): "REPORT THIS FORM" — a user-invoked report, from the extension, that an
      // application form is not recognised. It carries the form page's HOST and its field LABELS, never a
      // value and never a URL path or query (services/formReports.js refuses any other key). Linked to the
      // reporter so it is deleted with the account; kept 30 days (expires_at), then purged. The narrow
      // slice of D3's bug reporting (docs/BUG_REPORTING.md, not yet built) — folds into bug_reports later.
      id: "136_form_reports",
      sql: `
        CREATE TABLE IF NOT EXISTS form_reports (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          host              TEXT NOT NULL,
          labels_json       TEXT NOT NULL,
          field_count       INTEGER NOT NULL DEFAULT 0,
          extension_version TEXT,
          received_at       INTEGER NOT NULL,
          expires_at        INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_form_reports_user ON form_reports(user_id, received_at);
        CREATE INDEX IF NOT EXISTS idx_form_reports_expires ON form_reports(expires_at);
        CREATE INDEX IF NOT EXISTS idx_form_reports_host ON form_reports(host, received_at);
      `,
    },
    {
      // D59 (10-07): POSTINGS THAT ARRIVE AS RAW HTML AND LABEL BLOCKS. The normalised text goes in a NEW
      // column — `description` and `content_hash` are never rewritten, because A76's grades and the
      // enrichment imports are keyed on content_hash = sha1(title|description). description_text is NULL
      // when it would equal description (readers COALESCE); description_fields holds the label block's
      // fields; req_* the posting's stated citizenship / clearance (NULL = not read yet, never "none").
      // description_basis is a hash of the description they were read from: a reader serves them only
      // while it still matches, so a re-crawled posting's old text is never shown, and the next pass
      // re-reads it. services/jobs/descriptionText.js fills them (boot pass + backfill script).
      id: "137_description_text",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN description_text TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_fields TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN description_basis TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_citizenship TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_clearance TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_clearance_status TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN req_polygraph INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_description_basis ON scraped_jobs(description_basis);
      `,
    },
    {
      // D65 (owner, 10-07): WORK HISTORY AND SKILLS COME FROM THE RÉSUMÉ IN THE PAYLOAD. The parse is
      // stored WITH the résumé it was read from — the tailored one in `resumes`, the base one in
      // `profile_base_resumes` (the active profile's) or `base_resume` — so a packet references it. parsed_basis is a hash of the
      // text it was parsed from: a résumé rewritten since is re-parsed on its next read, never served a
      // stale parse. services/payloadResume.js reads and writes them. NULL = not parsed yet.
      id: "138_resume_parse",
      sql: `
        ALTER TABLE resumes ADD COLUMN parsed_json TEXT;
        ALTER TABLE resumes ADD COLUMN parsed_basis TEXT;
        ALTER TABLE base_resume ADD COLUMN parsed_json TEXT;
        ALTER TABLE base_resume ADD COLUMN parsed_basis TEXT;
        ALTER TABLE profile_base_resumes ADD COLUMN parsed_json TEXT;
        ALTER TABLE profile_base_resumes ADD COLUMN parsed_basis TEXT;
      `,
    },
    {
      // D66 (owner, 10-07): A BASE-RÉSUMÉ-ONLY PAYLOAD. The user's switch: when 1, an application carries
      // the base résumé and no model is called for it (services/baseResumeOnly.js). Default 0 — nothing
      // changes for anyone who has not switched it on.
      id: "139_base_resume_only",
      sql: `
        ALTER TABLE users ADD COLUMN base_resume_only INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // D67 (2) (owner, 10-07): THE SELF-LEARNING ORIGIN TABLE. A pair (posting host → apply host) learned
      // from a user's own verified "I submitted" on a host outside the job's family. apply_origin_pairs is
      // SHARED and carries no user identity — hostnames and a count; apply_origin_sightings counts the
      // DISTINCT users (promoted at 3) and offers a pair to the user who saw it, and goes with the account.
      // Hostnames only — never a path, a query or a URL. services/learnedOrigins.js.
      id: "140_apply_origin_pairs",
      sql: `
        CREATE TABLE IF NOT EXISTS apply_origin_pairs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          posting_host TEXT NOT NULL,
          apply_host TEXT NOT NULL,
          users_seen INTEGER NOT NULL DEFAULT 0,
          first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          promoted_at INTEGER,
          revoked_at INTEGER,
          UNIQUE(posting_host, apply_host)
        );
        CREATE TABLE IF NOT EXISTS apply_origin_sightings (
          pair_id INTEGER NOT NULL REFERENCES apply_origin_pairs(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (pair_id, user_id)
        );
      `,
    },
    {
      // D71 (owner, 10-08): PAY STATED IN THE PROSE. The derivation pass (services/jobs/descriptionText.js)
      // reads pay anywhere in the text into description_fields.pay (as stated, with its unit, source and
      // per-location lines); these two hold it as a USD-per-year ESTIMATE for the sort and the salary
      // filter only. The provider's salary_* columns are never written by it. NULL = none stated / not read.
      id: "141_pay_from_text",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN pay_text_min_usd INTEGER;
        ALTER TABLE scraped_jobs ADD COLUMN pay_text_max_usd INTEGER;
      `,
    },
    {
      // D75 (owner, 10-08): THE CRAWLER WORKER's queue, deny-list and observations — docs/CRAWLER_WORKER.md.
      // The worker holds no DB credentials; it leases from crawler_tasks and returns a signed result, and
      // draft decides what the result writes (services/crawlerQueue.js). crawler_denylist is DATA,
      // owner-editable, and wins over every task at queue AND lease time; seeded with the owner's list.
      // apply_origin_pairs gains what the crawler OBSERVED (J2): never promoted by it — the owner promotes.
      id: "142_crawler_worker",
      sql: `
        CREATE TABLE IF NOT EXISTS crawler_tasks (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          type           TEXT NOT NULL,
          input_json     TEXT NOT NULL,
          target_host    TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'queued',
          lease_until    INTEGER,
          attempts       INTEGER NOT NULL DEFAULT 0,
          result_status  TEXT,
          result_json    TEXT,
          refused_reason TEXT,
          created_by     INTEGER,
          created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          finished_at    INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_crawler_tasks_status ON crawler_tasks(status, id);
        CREATE TABLE IF NOT EXISTS crawler_denylist (
          domain   TEXT PRIMARY KEY,
          reason   TEXT,
          added_by INTEGER,
          added_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        INSERT OR IGNORE INTO crawler_denylist (domain, reason) VALUES
          ('linkedin.com', 'terms restrict automated access'), ('indeed.com', 'terms restrict automated access'),
          ('glassdoor.com', 'terms restrict automated access'), ('ziprecruiter.com', 'terms restrict automated access'),
          ('monster.com', 'terms restrict automated access');
        ALTER TABLE apply_origin_pairs ADD COLUMN crawler_seen_at INTEGER;
        ALTER TABLE apply_origin_pairs ADD COLUMN crawler_hops_json TEXT;
      `,
    },
    {
      // D76 (owner, 10-09): RAILWAY WEBHOOK EVENTS — deploy status changes and alerts, so a failed deploy, a
      // crash or a volume alert is SEEN (a FAILED tools-service deploy went unnoticed; the volume once
      // reached 481 / 500 MB). Written ONLY by POST /api/hooks/railway (routes/railwayHook.js), which keeps
      // ids, never a commit message or an author, and never acts on what it records.
      id: "143_deploy_events",
      sql: `
        CREATE TABLE IF NOT EXISTS deploy_events (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type       TEXT NOT NULL,
          family           TEXT NOT NULL,
          state            TEXT,
          severity         TEXT,
          project_name     TEXT,
          environment_name TEXT,
          service_name     TEXT,
          service_id       TEXT,
          deployment_id    TEXT,
          commit_hash      TEXT,
          occurred_at      TEXT,
          received_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_deploy_events_service ON deploy_events(service_name, id);
      `,
    },
    {
      // D75 STEP 0b (owner, 10-09): ADMIN → CRAWLER — the controls live in DRAFT's database, not in environment
      // variables, so changing them needs no redeploy. ONE row. It starts PAUSED and in DRY-RUN: nothing runs
      // until the owner presses Resume, and nothing reaches a website until the owner chooses Live.
      // CRAWLER_PAUSED (env) stays a second, independent kill switch. crawler_tasks records the mode a task
      // was leased in, where it came from, and the owner's "wrong answer" flag.
      id: "144_crawler_controls",
      sql: `
        CREATE TABLE IF NOT EXISTS crawler_state (
          id                 INTEGER PRIMARY KEY CHECK (id = 1),
          paused             INTEGER NOT NULL DEFAULT 1,
          mode               TEXT NOT NULL DEFAULT 'dry',
          per_run_cap        INTEGER NOT NULL DEFAULT 25,
          schedule_enabled   INTEGER NOT NULL DEFAULT 0,
          schedule_hhmm      TEXT NOT NULL DEFAULT '09:00',
          schedule_tasks     INTEGER NOT NULL DEFAULT 10,
          schedule_last_date TEXT,
          updated_at         INTEGER,
          updated_by         INTEGER
        );
        INSERT OR IGNORE INTO crawler_state (id) VALUES (1);
        ALTER TABLE crawler_tasks ADD COLUMN mode TEXT;
        ALTER TABLE crawler_tasks ADD COLUMN source TEXT;
        ALTER TABLE crawler_tasks ADD COLUMN flagged_wrong INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE crawler_tasks ADD COLUMN flag_note TEXT;
      `,
    },
    {
      // D75 STEP 1c (owner, 10-09): THE WORKER HAS NO DOMAIN AND NO HEALTHCHECK — so draft records when it last
      // heard from it, and what it answered, on every authenticated call (lease, status, result, release).
      // Admin → Crawler shows "worker last seen"; silence past a few polls reads as "not running".
      id: "145_crawler_worker_seen",
      sql: `
        ALTER TABLE crawler_state ADD COLUMN worker_last_seen INTEGER;
        ALTER TABLE crawler_state ADD COLUMN worker_last_call TEXT;
      `,
    },
    {
      // D78 (owner, 10-09): THE BOARD'S POLICY — one row, changed from Admin with no redeploy. The age limit
      // (120 days) applies to NEW postings at once (a too-old posting is never written); retiring EXISTING ones
      // (age_enforce) and the CS-only scope (scope_enforce) start OFF — each waits for the owner's go after its
      // dry run. services/jobs/boardAge.js reads it.
      id: "146_board_policy",
      sql: `
        CREATE TABLE IF NOT EXISTS board_policy (
          id             INTEGER PRIMARY KEY CHECK (id = 1),
          age_limit_days INTEGER NOT NULL DEFAULT 120,
          age_enforce    INTEGER NOT NULL DEFAULT 0,
          scope_enforce  INTEGER NOT NULL DEFAULT 0,
          updated_at     INTEGER,
          updated_by     INTEGER
        );
        INSERT OR IGNORE INTO board_policy (id) VALUES (1);
      `,
    },
    {
      // D80 (owner, 10-09): WHY IS THIS COMPANY HERE — the evidence stored with each configured company, so any
      // company's presence can be explained ("hn 2026-10, 4 months hiring; probe: 12 in-scope, 75% <= 120d").
      // services/companyList.js addCompany refuses an add without it.
      id: "147_company_evidence",
      sql: `
        ALTER TABLE company_ats_list ADD COLUMN evidence TEXT;
      `,
    },
    {
      // D82 B/C (owner, 10-09): THE CANDIDATE POOL — companies a discovery job FOUND, never companies it
      // added. Fed by HN "Who is hiring?" (services/jobs/hnDiscovery.js); probed read-only each night
      // (services/companyCandidates.js); approved or rejected by the owner in Admin -> Companies ->
      // Candidates. status: new -> probed -> approved / rejected -> added / dormant. A rejected row stays,
      // so the next sweep never re-queues it. discovery_breakers: one row per discovery source, opened
      // after 3 consecutive failures (D82 E); only the owner closes it.
      id: "148_company_candidates",
      sql: `
        CREATE TABLE IF NOT EXISTS company_candidates (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          company       TEXT    NOT NULL,
          ats_type      TEXT    NOT NULL,
          ats_slug      TEXT    NOT NULL COLLATE NOCASE,
          source        TEXT    NOT NULL,
          source_json   TEXT,
          evidence_json TEXT,
          rank_score    INTEGER,
          status        TEXT    NOT NULL DEFAULT 'new',
          status_reason TEXT,
          first_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
          last_seen     INTEGER NOT NULL DEFAULT (unixepoch()),
          probed_at     INTEGER,
          decided_at    INTEGER,
          decided_by    INTEGER,
          UNIQUE (ats_type, ats_slug)
        );
        CREATE INDEX IF NOT EXISTS idx_company_candidates_status ON company_candidates(status, rank_score DESC);
        CREATE TABLE IF NOT EXISTS discovery_breakers (
          source     TEXT    PRIMARY KEY,
          failures   INTEGER NOT NULL DEFAULT 0,
          open       INTEGER NOT NULL DEFAULT 0,
          opened_at  INTEGER,
          last_error TEXT,
          updated_at INTEGER
        );
      `,
    },
    {
      // D74 P1 (owner, 10-08): "NEW SINCE YOUR LAST VISIT" — on FIRST SEEN, not the company's posted date.
      // board_seen_at is the last board load; board_prev_seen_at is the one before the current visit (a
      // gap of 30 minutes or more starts a new visit). services/boardVisit.js reads and rolls them.
      id: "149_board_visit",
      sql: `
        ALTER TABLE users ADD COLUMN board_seen_at INTEGER;
        ALTER TABLE users ADD COLUMN board_prev_seen_at INTEGER;
      `,
    },
    {
      // D84 F1 (owner, 10-09): THE EXPORT MUST NOT CUT THE MIDDLE. `description` is capped at ingest (5,000
      // characters, head + tail, "[…]" between — services/jobs/htmlToText.js) and `content_hash` is computed
      // from it, so it stays as it is: a rewrite would mark every enrichment and grade stale. The FULL plain
      // text goes in a new column, filled by the crawl; the enrichment export reads it, cleaned of boilerplate.
      // enrichment_partial = 1: the row's enrichment was read from CUT text, so it re-enters the backlog and its
      // skills_json may be replaced by the next import. Backfilled for every live import that read a cut text.
      id: "150_description_full",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN description_full TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_partial INTEGER NOT NULL DEFAULT 0;
        UPDATE scraped_jobs SET enrichment_partial = 1
         WHERE enriched_at IS NOT NULL AND instr(description, '[…]') > 0
           AND job_id IN (SELECT r.job_id FROM enrichment_batch_rows r JOIN enrichment_batches b ON b.id = r.batch_id
                           WHERE b.source = 'import' AND b.reverted_at IS NULL);
      `,
    },
    {
      // D84 F2 (owner, 10-09): CRAWLER PLACEHOLDERS ARE NOT ENRICHMENT. A JSON map, enrichment column -> where its
      // value came from: crawler_fallback (a guess — the first 300 characters as summary, the lowercased title, the
      // title's level), source (the ATS stated it), board_location (the board's own location), import, owner.
      // A crawler_fallback value counts as EMPTY for the importer's "fill empty only"; an import or owner value is
      // never replaced without OVERWRITE. Written on insert by the crawl and by every import; a row from before this
      // migration is backfilled by DETECTION at boot (services/jobs/enrichmentProvenance.js).
      id: "151_enrichment_provenance",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN enrichment_provenance TEXT;
      `,
    },
    {
      // ⛔ D86 (owner, 10-09): BRING-YOUR-OWN-MODEL RÉSUMÉ. draft is an OAuth 2.1 authorization server for an MCP
      // client (Claude, ChatGPT): a CONNECTION is one user's grant to one client, revocable from Settings → Connected
      // apps; codes and tokens hang off it and are stored as SHA-256 hashes, never the value. A BRIEF is single-use,
      // bound to (user, job, base-résumé hash), expires, and allows 3 submissions. mcp_audit is one row per tool call.
      // users.byom_enabled is the user's master switch, OFF by default: nothing connects until they turn it on.
      // No column holds a model's output except through the résumé store. services/byom/.
      id: "152_byom_oauth",
      sql: `
        CREATE TABLE IF NOT EXISTS oauth_clients (
          client_id TEXT PRIMARY KEY,
          client_name TEXT,
          host TEXT NOT NULL,
          redirect_uris TEXT NOT NULL,
          registration TEXT NOT NULL DEFAULT 'dcr',
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS oauth_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          client_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          revoked_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_connections_user ON oauth_connections(user_id);
        CREATE TABLE IF NOT EXISTS oauth_codes (
          code_hash TEXT PRIMARY KEY,
          connection_id INTEGER NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,
          redirect_uri TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          resource TEXT NOT NULL,
          scope TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS oauth_tokens (
          token_hash TEXT PRIMARY KEY,
          connection_id INTEGER NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          scope TEXT NOT NULL,
          resource TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_tokens_connection ON oauth_tokens(connection_id);
        CREATE TABLE IF NOT EXISTS byom_briefs (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          connection_id INTEGER,
          job_id TEXT NOT NULL,
          base_hash TEXT NOT NULL,
          base_json TEXT NOT NULL,
          base_ats_score INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          last_refusal TEXT,
          patch_hash TEXT,
          resume_version INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_byom_briefs_user ON byom_briefs(user_id, created_at);
        CREATE TABLE IF NOT EXISTS mcp_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          connection_id INTEGER,
          tool TEXT NOT NULL,
          job_id TEXT,
          outcome TEXT NOT NULL,
          detail TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit(user_id, at);
        ALTER TABLE users ADD COLUMN byom_enabled INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⛔ Sessions A′ (owner, 10-09): THE STEP-UP CHECK READS THE IDENTITY THAT IS ACTING. A tab's token and the
      // browser's cookie can belong to two different accounts (two tabs, two sign-ins); the recent-sign-in check
      // for sensitive account changes read the COOKIE session's authAt while acting as the TOKEN's user. Each
      // auth context now carries its own sign-in time: set when a browser sign-in issues it, refreshed by
      // POST /api/account/reauth, NULL for session-less tokens (the extension, the phone).
      id: "153_auth_context_auth_at",
      sql: `
        ALTER TABLE auth_contexts ADD COLUMN auth_at INTEGER;
      `,
    },
    {
      // ⭐ D73 §B (owner, 10-09: email set up — Cloudflare Email Routing, Resend verified, EMAIL_FROM set). Marketing
      // consent stored honestly (a sign-up checkbox, OFF by default; when and where), the one-click unsubscribe's
      // stamp, the suppression list the Resend webhook fills (hard bounces, spam complaints — nothing is sent to an
      // address on it), and the notice log (who, when, which audience, how many — never the content).
      id: "154_email_consent",
      sql: `
        ALTER TABLE users ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN marketing_opt_in_at INTEGER;
        ALTER TABLE users ADD COLUMN marketing_opt_in_source TEXT;
        ALTER TABLE users ADD COLUMN unsubscribed_at INTEGER;
        CREATE TABLE IF NOT EXISTS email_suppressions (
          email TEXT PRIMARY KEY,
          reason TEXT NOT NULL,
          event_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS notice_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER,
          audience TEXT NOT NULL,
          recipients INTEGER NOT NULL,
          sent INTEGER NOT NULL DEFAULT 0,
          skipped INTEGER NOT NULL DEFAULT 0,
          failed INTEGER NOT NULL DEFAULT 0,
          test INTEGER NOT NULL DEFAULT 0,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D88 P2 · user management: an account's status (suspend with a reason), per-user entitlement
      // overrides with a reason and an expiry (the resolver's second override source), private notes, and
      // the reason behind every admin write. Additive only.
      id: "155_user_management",
      sql: `
        ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        ALTER TABLE users ADD COLUMN suspended_reason TEXT;
        ALTER TABLE users ADD COLUMN suspended_at INTEGER;
        ALTER TABLE admin_audit_log ADD COLUMN reason TEXT;
        CREATE TABLE IF NOT EXISTS user_entitlement_overrides (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          feature_key TEXT NOT NULL,
          value_json TEXT NOT NULL,
          reason TEXT NOT NULL,
          set_by INTEGER,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER,
          revoked_at INTEGER,
          revoked_by INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_user_entitlement_overrides_live
          ON user_entitlement_overrides(user_id, feature_key, revoked_at);
        CREATE TABLE IF NOT EXISTS user_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          author_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(user_id, created_at);
      `,
    },
    {
      // ⭐ D88 P3 · support tickets: a user's request and its thread. Deleted with the account (cascade) and 24
      // months after it is solved (services/tickets.js). An internal note is a message with internal = 1.
      id: "156_support_tickets",
      sql: `
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          subject TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          priority TEXT NOT NULL DEFAULT 'normal',
          assignee INTEGER,
          source TEXT NOT NULL DEFAULT 'app',
          context_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          due_at INTEGER,
          solved_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tickets_queue ON tickets(status, due_at);
        CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, updated_at);
        CREATE TABLE IF NOT EXISTS ticket_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          author_type TEXT NOT NULL,
          author_id INTEGER,
          body TEXT NOT NULL,
          internal INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, id);
      `,
    },
    {
      // ⭐ D90 (owner 10-10): "base is the résumé the user uploaded — any change is compared against that, or the user
      // picks which two to compare." So no upload is lost: every distinct base the user saves is kept here (the
      // profile's base_resumes row is still the CURRENT one), and each tailored version records the upload it was
      // made from. content_hash is filled by the app (services/baseResumeHistory.js); the backfill's rows get theirs
      // on first read. Deleted with the account (cascade); moved on an account merge.
      id: "157_base_resume_uploads",
      sql: `
        CREATE TABLE IF NOT EXISTS base_resume_uploads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          profile_id INTEGER,
          name TEXT,
          content TEXT NOT NULL,
          content_hash TEXT,
          source TEXT NOT NULL DEFAULT 'upload',
          uploaded_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_base_resume_uploads_user ON base_resume_uploads(user_id, profile_id, uploaded_at);
        INSERT INTO base_resume_uploads (user_id, profile_id, name, content, source, uploaded_at)
          SELECT user_id, profile_id, name, content, 'backfill', COALESCE(updated_at, unixepoch())
          FROM profile_base_resumes WHERE TRIM(COALESCE(content, '')) != '';
        ALTER TABLE resume_versions ADD COLUMN base_upload_id INTEGER;
      `,
    },
    {
      // ⭐ D94 (owner 10-11): EMAIL HEALTH. Each verified Resend webhook event of a HANDLED type, keyed by its Svix id
      // so a retried delivery is recorded once — type, time, Resend's email_id and the provider's reason, NEVER the
      // recipient (services/emailHealth.js). Deleted after 90 days by the daily sweep. email_domain_status holds the
      // sending domain's last reported verification (domain.updated), so Admin can be told when it lapses.
      id: "158_email_events",
      sql: `
        CREATE TABLE IF NOT EXISTS email_events (
          svix_id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          received_at INTEGER NOT NULL DEFAULT (unixepoch()),
          email_id TEXT,
          detail TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON email_events(type, received_at);
        CREATE TABLE IF NOT EXISTS email_domain_status (
          domain_id TEXT PRIMARY KEY,
          name TEXT,
          status TEXT NOT NULL,
          sending_ok INTEGER NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⛔ D95 (owner 10-12): AN ADMIN IS NOT A USER. Admin accounts get their own table, their own sign-in links and
      // their own sessions — never a users row, so never a profile, résumé, draft, ticket, token or connected app.
      // Identities carry their kind in their shape: public_id adm_…, session tokens dft_adm_…, links dft_adml_…
      // (services/adminAccounts.js). Every admin-side write names its actor as a coded string — admin:adm_… · user:N ·
      // system (services/actor.js) — in admin_audit_log.actor and in an *_actor column beside each older integer
      // column, which keeps holding a users.id or NULL, never an admin id. The backfill is truthful: rows written by a
      // users row acting under the legacy is_admin flag are user:N; rows with no actor are system. Additive; the
      // switch (ADMIN_ACCOUNTS_ENFORCE) is off until the owner has proved the new sign-in.
      id: "159_admin_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS admin_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT,
          password_set_at INTEGER,
          is_owner INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          created_by TEXT,
          disabled_at INTEGER,
          disabled_reason TEXT,
          last_sign_in_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
          token_hash TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          last_seen_at INTEGER,
          revoked_at INTEGER,
          user_agent TEXT,
          ip_hint TEXT,
          break_glass INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id, revoked_at);
        CREATE TABLE IF NOT EXISTS admin_sign_in_links (
          token_hash TEXT PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          used_at INTEGER
        );
        ALTER TABLE admin_audit_log ADD COLUMN actor_kind TEXT;
        ALTER TABLE admin_audit_log ADD COLUMN actor TEXT;
        UPDATE admin_audit_log
          SET actor_kind = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user' END,
              actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END
          WHERE actor_kind IS NULL;
        ALTER TABLE user_entitlement_overrides ADD COLUMN set_by_actor TEXT;
        ALTER TABLE user_entitlement_overrides ADD COLUMN revoked_by_actor TEXT;
        UPDATE user_entitlement_overrides SET set_by_actor = 'user:' || set_by WHERE set_by IS NOT NULL AND set_by_actor IS NULL;
        UPDATE user_entitlement_overrides SET revoked_by_actor = 'user:' || revoked_by WHERE revoked_by IS NOT NULL AND revoked_by_actor IS NULL;
        ALTER TABLE user_notes ADD COLUMN author_actor TEXT;
        UPDATE user_notes SET author_actor = 'user:' || author_id WHERE author_id IS NOT NULL AND author_actor IS NULL;
        ALTER TABLE tickets ADD COLUMN assignee_actor TEXT;
        UPDATE tickets SET assignee_actor = 'user:' || assignee WHERE assignee IS NOT NULL AND assignee_actor IS NULL;
        ALTER TABLE ticket_messages ADD COLUMN author_actor TEXT;
        UPDATE ticket_messages SET author_actor = 'user:' || author_id WHERE author_id IS NOT NULL AND author_actor IS NULL;
        ALTER TABLE plan_upgrade_requests ADD COLUMN decided_by_actor TEXT;
        UPDATE plan_upgrade_requests SET decided_by_actor = 'user:' || decided_by WHERE decided_by IS NOT NULL AND decided_by_actor IS NULL;
        ALTER TABLE user_limits ADD COLUMN updated_by_actor TEXT;
        UPDATE user_limits SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE board_policy ADD COLUMN updated_by_actor TEXT;
        UPDATE board_policy SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE crawler_state ADD COLUMN updated_by_actor TEXT;
        UPDATE crawler_state SET updated_by_actor = 'user:' || updated_by WHERE updated_by IS NOT NULL AND updated_by_actor IS NULL;
        ALTER TABLE crawler_tasks ADD COLUMN created_by_actor TEXT;
        UPDATE crawler_tasks SET created_by_actor = 'user:' || created_by WHERE created_by IS NOT NULL AND created_by_actor IS NULL;
        ALTER TABLE crawler_denylist ADD COLUMN added_by_actor TEXT;
        UPDATE crawler_denylist SET added_by_actor = 'user:' || added_by WHERE added_by IS NOT NULL AND added_by_actor IS NULL;
        ALTER TABLE company_candidates ADD COLUMN decided_by_actor TEXT;
        UPDATE company_candidates SET decided_by_actor = 'user:' || decided_by WHERE decided_by IS NOT NULL AND decided_by_actor IS NULL;
        ALTER TABLE slug_harvest_sweeps ADD COLUMN actor TEXT;
        UPDATE slug_harvest_sweeps SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE slug_harvest_imports ADD COLUMN actor TEXT;
        UPDATE slug_harvest_imports SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE job_import_batches ADD COLUMN actor TEXT;
        UPDATE job_import_batches SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
        ALTER TABLE notice_log ADD COLUMN actor TEXT;
        UPDATE notice_log SET actor = CASE WHEN admin_user_id IS NULL THEN 'system' ELSE 'user:' || admin_user_id END WHERE actor IS NULL;
      `,
    },
    {
      // ⭐ D86/D88 follow-up (owner 10-12, item 3): People → Users shows EVERY account by default; an account an admin
      // marks internal, test or beta can be hidden by a filter, and the list then says how many are hidden. One row per
      // (user, tag); who set it is a coded actor (D95). Gone with the account (cascade).
      id: "160_user_tags",
      sql: `
        CREATE TABLE IF NOT EXISTS user_tags (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tag TEXT NOT NULL,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          set_by_actor TEXT,
          PRIMARY KEY (user_id, tag)
        );
      `,
    },
    {
      // ⭐ Extension, owner 10-12 (Zoom's Workday posting): ONE JOB, ONE KEY across the posting, /apply,
      // /apply/applyManually and /apply/useMyLastApplication (services/jobPageKey.js — workday|tenant|site|requisition).
      // A capture records which board job its key folded into, so every later stage resolves to the same job — even
      // when the board's copy of the job came from another ATS. Shared like the posting pool: a key and a job id,
      // never who captured it (job_captures keeps that, per user).
      id: "161_job_page_keys",
      sql: `
        CREATE TABLE IF NOT EXISTS job_page_keys (
          page_key TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          rev INTEGER,
          canonical_url TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_job_page_keys_job ON job_page_keys(job_id);
      `,
    },
    {
      // ⛔ D95 PHASE 2 (owner 10-13: "password set and signed in with the admin email, now enforce"). An admin is an
      // admin account; no users row is one. The former admin row loses every credential it held (connected apps,
      // their tokens, its tab / extension / phone tokens) BEFORE its flag is cleared — cleared first, its Claude
      // connection would have started working as a person's — and is suspended (kept, with its reason, until it is
      // deleted after a backup; it owns no user data — WORKLOG 42). Each cleared row leaves an audit row. Then the
      // database itself refuses an admin flag on any users row, on insert and on update. server.js takes a backup
      // on the volume before this migration and holds it back if the backup fails.
      id: "162_no_admin_in_users",
      sql: `
        UPDATE oauth_tokens SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND connection_id IN (SELECT id FROM oauth_connections WHERE user_id IN (SELECT id FROM users WHERE is_admin = 1));
        UPDATE oauth_connections SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE is_admin = 1);
        UPDATE auth_contexts SET revoked_at = unixepoch()
          WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE is_admin = 1);
        INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
          SELECT NULL, 'system', 'system', 'user.admin_flag_cleared', 'user:' || id,
                 '{"is_admin":1}', '{"is_admin":0,"status":"suspended"}', 'D95 Phase 2: admins are admin accounts'
          FROM users WHERE is_admin = 1;
        UPDATE users SET status = 'suspended', suspended_at = unixepoch(),
          suspended_reason = 'Former admin row (D95): admins are admin accounts now. Kept until it is deleted after a backup.'
          WHERE is_admin = 1;
        UPDATE users SET is_admin = 0 WHERE is_admin = 1;
        CREATE TRIGGER IF NOT EXISTS users_no_admin_insert BEFORE INSERT ON users
          WHEN NEW.is_admin IS NOT NULL AND NEW.is_admin != 0
          BEGIN SELECT RAISE(ABORT, 'D95: an admin is an admin account, never a users row'); END;
        CREATE TRIGGER IF NOT EXISTS users_no_admin_update BEFORE UPDATE OF is_admin ON users
          WHEN NEW.is_admin IS NOT NULL AND NEW.is_admin != 0
          BEGIN SELECT RAISE(ABORT, 'D95: an admin is an admin account, never a users row'); END;
      `,
    },
    {
      // ⛔ D95, the owner's word (10-13): "delete the suspended admin row". Only a row 162 retired — suspended with the
      // "Former admin row (D95)" reason — and nothing else. It owned no user data (WORKLOG 42); what it does hold goes
      // with it by the existing cascades (its notifications, sessions, tokens, its revoked connection, its plugin-call
      // log). The one reference that would block the delete — a plan request it decided (decided_by, a foreign key with
      // no cascade) — is cleared; the decision keeps its coded actor (decided_by_actor 'user:1'). History rows that name
      // it (the audit log, an override's set_by, a crawler setting's updated_by) are not constraints and stay as written,
      // each with its *_actor. An audit row records the delete. server.js backs up first and holds this back if it cannot.
      id: "163_delete_former_admin_row",
      sql: `
        UPDATE plan_upgrade_requests SET decided_by = NULL
          WHERE decided_by IN (SELECT id FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%');
        UPDATE user_limits SET updated_by = NULL
          WHERE updated_by IN (SELECT id FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%');
        INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, reason)
          SELECT NULL, 'system', 'system', 'user.delete', 'user:' || id, '{"username":"' || username || '","status":"suspended"}',
                 'D95: the former admin row, deleted on the owner''s word (10-13)'
          FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%';
        DELETE FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%';
      `,
    },
    {
      // ⭐ D96 §4 (owner 10-13): THE SAVED-ANSWER LIFECYCLE — one tick and an answer is remembered (eligibility and
      // disclosures included: the person's own stated answer, never a guess); an edit is RECORDED, the new value NOT
      // stored until re-acknowledged, the old one no longer auto-used. A TABLE, not more JSON on the profile: the key
      // is the normalised label + widget kind + option wording (shared/answerKey.js), so one label can hold two
      // questions (a different option list is a new question), and each answer needs its own state, source and dates.
      // custom_answers (label-only, the web's answers) stays as it is and keeps filling: those entries are marked
      // acknowledged at migration time, source legacy. answer_history: every change, from → to · when · which job.
      // The 90-day review reminder reads acknowledged_at / reviewed_at; answer_review_reminded_at makes the panel say
      // it once. Additive; both cascade with the account. services/answerLifecycle.js.
      id: "164_saved_answer_lifecycle",
      sql: `
        CREATE TABLE IF NOT EXISTS saved_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_key TEXT NOT NULL,
          widget_kind TEXT NOT NULL CHECK (widget_kind IN ('text','select','radio','checkbox','date')),
          options_key TEXT NOT NULL DEFAULT '',
          question TEXT NOT NULL,
          answer TEXT,
          state TEXT NOT NULL CHECK (state IN ('acknowledged','changed')),
          source TEXT NOT NULL CHECK (source IN ('you_typed','you_acknowledged','legacy')),
          category TEXT,
          acknowledged_at INTEGER,
          reviewed_at INTEGER,
          changed_at INTEGER,
          last_job_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (user_id, question_key, widget_kind, options_key)
        );
        CREATE TABLE IF NOT EXISTS answer_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_key TEXT NOT NULL,
          widget_kind TEXT NOT NULL,
          options_key TEXT NOT NULL DEFAULT '',
          question TEXT NOT NULL,
          event TEXT NOT NULL CHECK (event IN ('changed','acknowledged','edited')),
          from_value TEXT,
          to_value TEXT,
          job_id TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_answer_history_key ON answer_history(user_id, question_key, widget_kind, options_key);
        ALTER TABLE user_profile ADD COLUMN custom_answers_acknowledged_at INTEGER;
        ALTER TABLE user_profile ADD COLUMN answer_review_reminded_at INTEGER;
        UPDATE user_profile SET custom_answers_acknowledged_at = unixepoch()
          WHERE custom_answers IS NOT NULL AND json_valid(custom_answers) AND json_type(custom_answers) = 'object'
            AND EXISTS (SELECT 1 FROM json_each(user_profile.custom_answers) WHERE trim(CAST(value AS TEXT)) != '');
      `,
    },
    {
      // ⭐ D98 P1 (lane J3, 10-13): a résumé generated ON THE PAGE, asked for by the extension and made by the same
      // generation the web app uses (services/extensionResume.js). One row per request: its job, the hash of the base
      // résumé it is made from (once per job and base — the partial unique index), its status (queued · generating ·
      // ready · refused · failed · cancelled), the Draft slot it spent (a draft_slot_uses id, NULL-safe: a refund deletes
      // that row and stamps slot_refunded_at with the reason), the version it produced, the score pair, and the claim
      // guard's plain-words result. No content: the résumé itself is the resume_versions row. Cascades with the account.
      id: "165_extension_resume_generations",
      sql: `
        CREATE TABLE IF NOT EXISTS extension_resume_generations (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          base_hash TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('queued','generating','ready','refused','failed','cancelled')),
          regenerate INTEGER NOT NULL DEFAULT 0,
          reused INTEGER NOT NULL DEFAULT 0,
          slot_use_id INTEGER,
          slot_refunded_at INTEGER,
          refund_reason TEXT,
          resume_version INTEGER,
          score_before INTEGER,
          score_after INTEGER,
          guard_json TEXT,
          error_code TEXT,
          superseded_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          started_at INTEGER,
          finished_at INTEGER,
          cancelled_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_ext_resume_gen_user_job ON extension_resume_generations(user_id, job_id, base_hash);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_resume_gen_live ON extension_resume_generations(user_id, job_id, base_hash)
          WHERE superseded_at IS NULL AND status IN ('queued','generating','ready');
      `,
    },
    {
      // ⭐ D98 P1: the PDF the extension attaches, KEPT — ⚠ the one path where D16's "never store a PDF" is reversed,
      // so What we sent can show the exact file the page received (services/resumePdfArtifacts.js). The bytes with their
      // sha256 (checked on read), D16's 2 MB cap, the generation and version it was printed from (and the hash of that
      // HTML), when it was attached, and — once the application is recorded — its record and HTML snapshot row. A PDF on
      // a record lives as long as the record (cascade); one not on a record goes with the job's résumé or the account.
      id: "166_resume_pdf_artifacts",
      sql: `
        CREATE TABLE IF NOT EXISTS resume_pdf_artifacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id TEXT NOT NULL,
          generation_id TEXT REFERENCES extension_resume_generations(id) ON DELETE SET NULL,
          resume_version INTEGER,
          html_sha256 TEXT NOT NULL,
          file_name TEXT NOT NULL,
          media_type TEXT NOT NULL DEFAULT 'application/pdf',
          sha256 TEXT NOT NULL,
          byte_size INTEGER NOT NULL,
          body BLOB NOT NULL,
          attached_at INTEGER,
          record_id INTEGER REFERENCES application_records(id) ON DELETE CASCADE,
          snapshot_artifact_id INTEGER REFERENCES application_artifacts(id) ON DELETE SET NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_user_job ON resume_pdf_artifacts(user_id, job_id);
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_generation ON resume_pdf_artifacts(generation_id);
        CREATE INDEX IF NOT EXISTS idx_resume_pdf_record ON resume_pdf_artifacts(record_id);
      `,
    },
    {
      // ⭐ T6 (field report 10-14): WHY a generation failed. Every failure was written error_code 'unavailable', so the owner's
      // Stripe failure (the tools service refused the model call) read the same as a crash. `cause` is "<stage>:<code>"
      // (services/extensionResume.js causeOf) — a code, never a message, a model name or money. The user's sentence stays
      // the generic one; the extension's "Show details" view shows the code.
      id: "167_extension_resume_cause",
      sql: `
        ALTER TABLE extension_resume_generations ADD COLUMN cause TEXT;
      `,
    },
    {
      // ⭐ T24 (field report 10-15) · the intent model's two settings and the remembered choice, with the ACCOUNT — not a
      // new browser storage key. JSON { onDraft: "queue" | "ask", manualResume: "on_cue" | "never", remembered: null |
      // "drafted" | "manual" } (routes/extensionDraft.js parseIntentSettings); NULL reads as the defaults.
      id: "168_extension_intent_settings",
      sql: `
        ALTER TABLE users ADD COLUMN extension_intent TEXT;
      `,
    },
    {
      // ⭐ D100 (owner 10-30, gates lifted): FULL AUTO is a per-user MODE, not a server constant. `send_mode` is
      // 'semi' | 'auto'; NULL reads as 'semi' (the default). `submitted_by` records whose submit it was — 'user' (they
      // approved these values) or 'auto' (their standing instruction) — on the run-job that sent it (D36 amended).
      id: "169_send_mode_submitted_by",
      sql: `
        ALTER TABLE users ADD COLUMN send_mode TEXT;
        ALTER TABLE apply_run_jobs ADD COLUMN submitted_by TEXT;
      `,
    },
    {
      // ⭐ D102 P4 / D100 P7: Auto settings — the user's FULL AUTO standing instruction (shared/autoSettings.js: daily cap,
      // run times + time zone, per-company limit, pause after an interview / offer, the board filters, the job profile) as
      // JSON, NULL = the defaults; and when the scheduler last ran for the user (services/autoScheduler.js).
      id: "170_auto_settings",
      sql: `
        ALTER TABLE users ADD COLUMN auto_settings TEXT;
        ALTER TABLE users ADD COLUMN auto_last_run_at INTEGER;
      `,
    },
    {
      // ⭐ D100 P2 / D79 · THE APPLY WORKER'S DATA (docs/APPLY_WORKER.md §3). draft stores CIPHERTEXT it cannot read: a
      // portal session sealed in the user's app to a per-session key the worker minted (key_id); revoke = the worker
      // destroys that key, so every copy — here and in backups — becomes unreadable. `portal_session_uses` is the use log
      // the user sees. `apply_remote_runs` is the worker's queue: one row per run-job sent to the worker, leased over the
      // signed API (routes/applyWorker.js), with the field list it filled (labels + values, never pixels).
      id: "171_apply_worker",
      sql: `
        CREATE TABLE IF NOT EXISTS portal_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          origin_host TEXT NOT NULL,
          key_id TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          consent_at INTEGER NOT NULL,
          expires_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          revoked_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_portal_sessions_user ON portal_sessions(user_id, revoked_at);
        CREATE TABLE IF NOT EXISTS portal_session_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES portal_sessions(id) ON DELETE CASCADE,
          apply_run_job_id INTEGER,
          started_at INTEGER NOT NULL DEFAULT (unixepoch()),
          outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS apply_remote_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_job_id INTEGER NOT NULL UNIQUE,
          packet_id INTEGER,
          session_id INTEGER REFERENCES portal_sessions(id) ON DELETE SET NULL,
          mode TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'queued',
          worker_id TEXT,
          lease_until INTEGER,
          attempts INTEGER NOT NULL DEFAULT 0,
          field_list_json TEXT,
          approved_values_json TEXT,
          outcome TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_apply_remote_runs_state ON apply_remote_runs(state, lease_until);
      `,
    },
    {
      // ⭐ D100 (a), owner 10-30: "yes we are creating portal accounts". `portal_accounts` — an account the apply worker
      // creates FOR the user on a portal (Amazon first), with the user's OWN email (no alias) and a password the WORKER
      // generates. The credential is sealed to a key the worker minted for that account; draft stores ciphertext only and
      // never sees the password. Consent is per portal. `apply_remote_runs.account_id` — a run that signs in (or signs up)
      // with that account instead of an uploaded session.
      id: "172_portal_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS portal_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          origin_host TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'requested',
          key_id TEXT,
          ciphertext TEXT,
          consent_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_stop TEXT,
          removed_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_portal_accounts_user ON portal_accounts(user_id, removed_at);
        ALTER TABLE apply_remote_runs ADD COLUMN account_id INTEGER;
      `,
    },
    {
      // ⭐ D101 P1 / P2 (owner 10-30) · THE PROFILE IN SECTIONS, AND APPLICATION DEFAULTS. One PERSON profile shared by all
      // of a user's job profiles, filled from the base résumé's parse (D65) on first open and offered — never applied
      // silently — after a new upload. ⛔ Editing it never rewrites the uploaded base résumé (the document stays the
      // document). `application_defaults` holds ONLY what the user SET (or answered in Needs you, D96): a row that is
      // absent is "not set", never a default pretending to be an answer (D72: every user read requires_sponsorship = 0).
      id: "173_structured_profile",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_sections (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          summary TEXT,
          imported_basis TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS profile_experience (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          company TEXT NOT NULL,
          title TEXT,
          location TEXT,
          start_ym TEXT,
          end_ym TEXT,
          is_current INTEGER NOT NULL DEFAULT 0,
          bullets_json TEXT NOT NULL DEFAULT '[]',
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_education (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          school TEXT NOT NULL,
          degree TEXT,
          field TEXT,
          start_ym TEXT,
          end_ym TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          url TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS application_defaults (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          source TEXT NOT NULL,
          set_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, key)
        );
        CREATE INDEX IF NOT EXISTS idx_profile_experience_user ON profile_experience(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_education_user ON profile_education(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_skills_user ON profile_skills(user_id, position);
      `,
    },
    {
      // ⭐ D103 (owner 10-30) · THE INBOX — a FORWARDED COPY of the replies to the user's applications, never mailbox
      // access. Each user gets a private address `<token>@in.jobsviadraft.com` (a subdomain: its MX never touches the
      // root's), revocable at once. Messages are stored as capped TEXT (HTML stripped, attachments never stored), sorted
      // by rule (D17 — no model), matched to an application where they can be. A user's re-filing is counted per rule
      // (the input to improving them). `inbox_code_optins` / `inbox_code_uses` are D103 P5: the apply worker may read a
      // verification code for a portal ONLY where the user opted in for that portal, each read logged.
      id: "174_inbox",
      sql: `
        CREATE TABLE IF NOT EXISTS inbox_addresses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          revoked_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS inbox_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          address_id INTEGER,
          provider_id TEXT,
          from_addr TEXT,
          from_domain TEXT,
          subject TEXT,
          body_text TEXT,
          received_at INTEGER NOT NULL DEFAULT (unixepoch()),
          category TEXT NOT NULL,
          category_source TEXT NOT NULL DEFAULT 'rule',
          rule TEXT,
          code TEXT,
          application_id INTEGER,
          UNIQUE(user_id, provider_id)
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_messages_user ON inbox_messages(user_id, received_at);
        CREATE TABLE IF NOT EXISTS inbox_corrections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id INTEGER NOT NULL,
          rule TEXT,
          from_category TEXT,
          to_category TEXT,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS inbox_code_optins (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          portal_family TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, portal_family)
        );
        CREATE TABLE IF NOT EXISTS inbox_code_uses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message_id INTEGER NOT NULL,
          portal_family TEXT NOT NULL,
          remote_run_id INTEGER,
          at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D107 (owner 10-30) · IS THIS POSTING ALIVE. One row per posting id that OUTLIVES its scraped_jobs row (the
      // cleanup deletes expired rows; dedup folds others), so a repost can be recognised after the posting it replaced
      // is gone: same company + title key + location, a near-same description (desc_sig, a minhash), first seen after
      // the earlier one. Written by services/jobs/jobHistory.js recordJobHistory — a rollup, never inside the crawl's
      // upsert. first_seen only moves earlier; closed_at clears when a closed posting is seen active again.
      id: "175_job_history",
      sql: `
        CREATE TABLE IF NOT EXISTS job_history (
          job_id      TEXT PRIMARY KEY,
          company_key TEXT NOT NULL,
          title_key   TEXT NOT NULL,
          loc_key     TEXT NOT NULL DEFAULT '',
          desc_sig    TEXT,
          posted_at   INTEGER,
          first_seen  INTEGER NOT NULL,
          last_seen   INTEGER NOT NULL,
          closed_at   INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_job_history_group ON job_history(company_key, title_key, first_seen);
      `,
    },
    {
      // ⭐ D106 P1 (owner 10-30) · THE REAL LEVEL. What the posting's text ASKS for (years, system design, leading
      // others, a prior internship, an advanced degree) → entry | early | mid | senior, beside the title's own level.
      // Written by services/jobs/levelRead.js with the tag pass; level_read_basis makes it idempotent. The board's
      // "Truly entry level" filter reads it (services/jobs/jobQuery.js truly_entry).
      id: "176_level_read",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN level_read TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN level_reasons TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN level_read_basis TEXT;
      `,
    },
    {
      // ⭐ D105 (owner 10-30) · THE ATLAS — a wiki of roles, skills, tools and stacks, linked. ⛔ ONE THESAURUS: there is
      // no alias table here — `alias_of` IS skill_synonyms (relation 'alias', confirmed), the scorer's own, so an alias
      // the Atlas shows is an alias the scorer scores (services/atlas/atlasStore.js). Nodes are seeded as DRAFT and only
      // a person publishes (D17: nothing generated by a model). atlas_node_stats is COMPUTED from active postings
      // (services/atlas/atlasStats.js) — never typed. atlas_wiki_cache holds Wikipedia's summary as WIKIPEDIA'S
      // (CC BY-SA, attributed), never blended into `definition`, which is draft's own words.
      id: "177_atlas",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_nodes (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          slug         TEXT NOT NULL UNIQUE,
          kind         TEXT NOT NULL CHECK (kind IN ('role', 'skill', 'tool', 'stack')),
          name         TEXT NOT NULL,
          term         TEXT NOT NULL,
          definition   TEXT,
          status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          source       TEXT NOT NULL,
          wiki_title   TEXT,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          published_at INTEGER,
          published_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_term ON atlas_nodes(term);
        CREATE TABLE IF NOT EXISTS atlas_edges (
          from_id    INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          to_id      INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          type       TEXT NOT NULL CHECK (type IN ('requires', 'part_of', 'used_with', 'alternative_to', 'leads_to')),
          source     TEXT NOT NULL CHECK (source IN ('owner', 'registry', 'wikidata', 'onet', 'board')),
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (from_id, to_id, type)
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_edges_to ON atlas_edges(to_id, type);
        CREATE TABLE IF NOT EXISTS atlas_resources (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          node_id      INTEGER NOT NULL REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          url          TEXT NOT NULL,
          title        TEXT NOT NULL,
          level        TEXT,
          format       TEXT,
          hours        REAL,
          cost         TEXT,
          checked_at   INTEGER,
          check_status TEXT,
          added_by     TEXT,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (node_id, url)
        );
        CREATE TABLE IF NOT EXISTS atlas_wiki_cache (
          node_id       INTEGER PRIMARY KEY REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          title         TEXT NOT NULL,
          extract       TEXT,
          thumbnail_url TEXT,
          page_url      TEXT NOT NULL,
          fetched_at    INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS atlas_node_stats (
          node_id         INTEGER PRIMARY KEY REFERENCES atlas_nodes(id) ON DELETE CASCADE,
          postings        INTEGER NOT NULL,
          top_skills_json TEXT NOT NULL DEFAULT '[]',
          top_roles_json  TEXT NOT NULL DEFAULT '[]',
          pay_min_usd     INTEGER,
          pay_median_usd  INTEGER,
          pay_max_usd     INTEGER,
          pay_n           INTEGER NOT NULL DEFAULT 0,
          computed_at     INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D108 P2 (owner 10-30) · "WHAT CHANGED" — a short dated list of rule changes that affect students and workers.
      // Each line is a fact with an OFFICIAL source link (services/kb/sponsorshipFacts.js addWhatChanged refuses any
      // other); no advice, no opinion. Removed lines are kept, marked, for the record.
      id: "178_what_changed",
      sql: `
        CREATE TABLE IF NOT EXISTS what_changed (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          happened_on TEXT NOT NULL,
          text        TEXT NOT NULL,
          source_url  TEXT NOT NULL,
          source_name TEXT NOT NULL,
          added_by    TEXT NOT NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          removed_at  INTEGER
        );
      `,
    },
    {
      // ⭐ D112 d2 + e2 (owner 10-30 night). d2 · THE EDUCATION SECTION IS THE SOURCE OF THE DEGREE: the old Education
      // block's values (user_profile.highest_degree / field_of_study / university / graduation_year) move into the
      // section (profile_education) — NOT when an entry for the same school is already there (its empty degree / field are
      // filled instead), so nothing is listed twice. What cannot be a section entry is kept as the per-profile override
      // (user_profile.education_override, JSON): a degree with no school (only when the section is empty), and a graduation
      // year still to come (D101's date rule refuses a future end date on an entry). The forms and eligibility read the
      // derived value or that override (services/structuredProfile.js educationOf) — never the old columns again.
      // e2 · a job profile made from a résumé (A104) carries made_from_resume = 1 and shows "Refine your job profile"
      // until the wizard has been opened and SAVED for it (refined_at). Profiles made before this are not marked.
      id: "179_education_source",
      sql: `
        ALTER TABLE user_profile ADD COLUMN education_override TEXT;
        ALTER TABLE domain_profiles ADD COLUMN made_from_resume INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE domain_profiles ADD COLUMN refined_at INTEGER;
        UPDATE profile_education SET
          degree = COALESCE(NULLIF(TRIM(COALESCE(degree, '')), ''), (SELECT NULLIF(TRIM(COALESCE(up.highest_degree, '')), '') FROM user_profile up WHERE up.user_id = profile_education.user_id)),
          field = COALESCE(NULLIF(TRIM(COALESCE(field, '')), ''), (SELECT NULLIF(TRIM(COALESCE(up.field_of_study, '')), '') FROM user_profile up WHERE up.user_id = profile_education.user_id))
          WHERE EXISTS (SELECT 1 FROM user_profile up WHERE up.user_id = profile_education.user_id
            AND TRIM(COALESCE(up.university, '')) != '' AND LOWER(TRIM(up.university)) = LOWER(TRIM(profile_education.school)));
        INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source)
          SELECT up.user_id, TRIM(up.university),
            NULLIF(TRIM(COALESCE(up.highest_degree, '')), ''),
            NULLIF(TRIM(COALESCE(up.field_of_study, '')), ''),
            NULL,
            CASE WHEN CAST(up.graduation_year AS INTEGER) BETWEEN 1900 AND CAST(strftime('%Y', 'now') AS INTEGER)
              THEN printf('%04d-01', CAST(up.graduation_year AS INTEGER)) END,
            COALESCE((SELECT MAX(pe.position) + 1 FROM profile_education pe WHERE pe.user_id = up.user_id), 0),
            'profile'
          FROM user_profile up
          WHERE TRIM(COALESCE(up.university, '')) != ''
            AND NOT EXISTS (SELECT 1 FROM profile_education pe WHERE pe.user_id = up.user_id
              AND LOWER(TRIM(pe.school)) = LOWER(TRIM(up.university)));
        UPDATE user_profile SET education_override = json_object(
            'degree', NULLIF(TRIM(COALESCE(highest_degree, '')), ''),
            'field', NULLIF(TRIM(COALESCE(field_of_study, '')), ''),
            'year', CASE WHEN CAST(graduation_year AS INTEGER) BETWEEN 1900 AND 2100 THEN CAST(graduation_year AS INTEGER) END)
          WHERE education_override IS NULL AND TRIM(COALESCE(university, '')) = ''
            AND (TRIM(COALESCE(highest_degree, '')) != '' OR TRIM(COALESCE(field_of_study, '')) != '')
            AND NOT EXISTS (SELECT 1 FROM profile_education pe WHERE pe.user_id = user_profile.user_id);
        UPDATE user_profile SET education_override = json_object('year', CAST(graduation_year AS INTEGER))
          WHERE education_override IS NULL AND TRIM(COALESCE(university, '')) != ''
            AND CAST(graduation_year AS INTEGER) > CAST(strftime('%Y', 'now') AS INTEGER) AND CAST(graduation_year AS INTEGER) <= 2100;
      `,
    },
    {
      // ⭐ D112 item 2 (owner 10-30) · THE GMAIL CONNECTION — beside D103's forwarding; the user picks either. Google OAuth
      // with gmail.readonly ONLY; draft reads only the messages a search query built from the applicant-tracking senders and
      // the user's applications' companies returns (services/gmail.js gmailQueryFor), never the rest of the mailbox, and each
      // goes through D103's one path (services/inbox.js ingestForUser). One row per user. The refresh token is SEALED with
      // the app's secret box (secret_enc / iv / auth_tag — the names the export's scrub drops), never stored plain.
      // `watermark` is the newest internalDate (seconds) read — the next poll's `after:`. Disconnect revokes the token at
      // Google and deletes the row. `inbox_messages.source` records which door a message came by ('forward' | 'gmail').
      id: "181_gmail_connection",
      sql: `
        CREATE TABLE IF NOT EXISTS gmail_connections (
          user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          google_email   TEXT,
          scope          TEXT NOT NULL,
          secret_enc     TEXT NOT NULL,
          iv             TEXT NOT NULL,
          auth_tag       TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'connected',
          watermark      INTEGER,
          last_polled_at INTEGER,
          last_error     TEXT,
          messages_read  INTEGER NOT NULL DEFAULT 0,
          connected_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
        ALTER TABLE inbox_messages ADD COLUMN source TEXT NOT NULL DEFAULT 'forward';
      `,
    },
    {
      // ⭐ 43s (owner, the Amazon run: "try to log into it, try resetting the password"). A portal account request may say
      // what to do when the user's email ALREADY has an account there: reset_existing = 1 lets the worker use the portal's
      // own Forgot password to set a new generated password (sealed like a created one; the emailed code comes only through
      // the user's code opt-in). 0 (the default): the run stops, account_exists — draft never guesses or holds a password.
      id: "182_portal_reset_existing",
      sql: `
        ALTER TABLE portal_accounts ADD COLUMN reset_existing INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⭐ D112 item 8 (owner 10-30: "Web Push (VAPID, no vendor) + email through Resend now; FCM with Android"). Each event
      // stays ONE row in `notifications` (019); these two tables decide its copies. push_subscriptions: one row per browser
      // endpoint (the browser's own push service — services/webPush.js PUSH_HOSTS only), its RFC 8291 keys; a 404 / 410 from the
      // push service deletes the row. notification_prefs: the person's per-event switches (services/notify.js NOTIFY_EVENTS);
      // no row = the event's default. Both cascade with the user; the export drops endpoint and keys (secret columns).
      id: "183_web_push",
      sql: `
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          endpoint        TEXT    NOT NULL UNIQUE,
          key_p256dh      TEXT    NOT NULL,
          key_auth        TEXT    NOT NULL,
          user_agent      TEXT,
          failures        INTEGER NOT NULL DEFAULT 0,
          last_success_at INTEGER,
          created_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
        CREATE TABLE IF NOT EXISTS notification_prefs (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event      TEXT    NOT NULL,
          push       INTEGER NOT NULL DEFAULT 0,
          email      INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, event)
        );
      `,
    },
    {
      // ⭐ D109 (owner 10-30) · PROOF — every claim on the résumé can carry its evidence. `profile_projects` is the Profile's
      // projects section (D101's shape). `profile_evidence` links a repository / live demo / paper / write-up (https only,
      // a kind, a short label) to an experience BULLET or a PROJECT, keyed by the bullet's normalised text or the project's
      // normalised name (services/proofLinks.js evidenceKey) so a reorder or a re-import keeps it. `proof_pages` is the
      // optional public page /p/<handle> — OFF by default (no row, or enabled = 0, is off); it lists projects and their links
      // and nothing private. ⛔ draft certifies nothing: the page says the links are supplied by the candidate.
      id: "184_proof_links",
      sql: `
        CREATE TABLE IF NOT EXISTS profile_projects (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          description TEXT,
          position    INTEGER NOT NULL DEFAULT 0,
          source      TEXT NOT NULL DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS profile_evidence (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target     TEXT NOT NULL CHECK (target IN ('bullet', 'project')),
          target_key TEXT NOT NULL,
          kind       TEXT NOT NULL,
          label      TEXT NOT NULL,
          url        TEXT NOT NULL,
          position   INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS proof_pages (
          user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          handle     TEXT NOT NULL UNIQUE COLLATE NOCASE,
          enabled    INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_profile_projects_user ON profile_projects(user_id, position);
        CREATE INDEX IF NOT EXISTS idx_profile_evidence_user ON profile_evidence(user_id, target, target_key);
      `,
    },
    {
      // ⭐ D110 (owner 10-30) · INTERVIEW MODE — prep that starts when the interview email arrives (services/interviewPrep.js).
      // interview_prep: ONLY the date the user typed for an application (an emailed date is read by rule at read time, never
      // stored as theirs). interview_stories: the STAR story bank, per user, reused across interviews; `seed_key` remembers a
      // bullet already seeded from profile_experience so a second press adds only what is new. interview_debriefs and
      // interview_questions: after each round, what was asked and how it went — the user's OWN question bank, never shared
      // across users. All cascade with the user; a debrief outlives a deleted application (SET NULL) so the bank stays whole.
      id: "186_interview_mode",
      sql: `
        CREATE TABLE IF NOT EXISTS interview_prep (
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          application_id INTEGER NOT NULL REFERENCES application_records(id) ON DELETE CASCADE,
          date_ymd       TEXT,
          time_hm        TEXT,
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, application_id)
        );
        CREATE TABLE IF NOT EXISTS interview_stories (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title       TEXT    NOT NULL,
          situation   TEXT    NOT NULL DEFAULT '',
          task        TEXT    NOT NULL DEFAULT '',
          action      TEXT    NOT NULL DEFAULT '',
          result      TEXT    NOT NULL DEFAULT '',
          themes_json TEXT    NOT NULL DEFAULT '[]',
          source      TEXT    NOT NULL DEFAULT 'user',
          seed_key    TEXT,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_stories_seed ON interview_stories(user_id, seed_key);
        CREATE TABLE IF NOT EXISTS interview_debriefs (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          application_id INTEGER REFERENCES application_records(id) ON DELETE SET NULL,
          round          TEXT    NOT NULL,
          held_on        TEXT,
          went           TEXT,
          notes          TEXT    NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_interview_debriefs_user ON interview_debriefs(user_id, application_id);
        CREATE TABLE IF NOT EXISTS interview_questions (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          debrief_id INTEGER NOT NULL REFERENCES interview_debriefs(id) ON DELETE CASCADE,
          round      TEXT    NOT NULL,
          question   TEXT    NOT NULL,
          went       TEXT,
          notes      TEXT    NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_interview_questions_user ON interview_questions(user_id, round);
      `,
    },
    {
      // ⭐ D108 P1 · sponsorship facts: the median wage, and the USCIS H-1B Employer Data Hub (owner 10-30).
      // WAGES — the LCA disclosure file's WAGE_RATE_OF_PAY_FROM / WAGE_UNIT_OF_PAY, annualised (Hour × 2080, Week × 52,
      // Bi-Weekly × 26, Month × 12) over CERTIFIED cases, kept per (employer, FEIN, period) as a histogram of $1k buckets
      // (services/kb/lcaWages.js) so a company's median over several entities and quarters is exact, not a median of
      // medians. company_lca_sponsorship.wage_by_fiscal_year_json is the roll-up, written by reconcileCompanyLca.
      // USCIS HUB — uscis_hub_employer_years holds the hub's rows summed per (employer key, tax-ID last four, fiscal
      // year); uscis_hub_source_files is the ledger (source URL, the file's own date). ⛔ ONE LCA MATCHER: the hub's
      // employers reach a company ONLY through the entities the LCA resolution already matched (lcaLayer.js) — the
      // same companyMatchKey, joined, never a second name matcher. company_lca_sponsorship.uscis_by_fiscal_year_json is
      // that roll-up. Additive only.
      id: "187_sponsorship_facts",
      sql: `
        ALTER TABLE lca_employer_periods ADD COLUMN wage_cases INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE lca_employer_periods ADD COLUMN wage_hist_json TEXT;
        ALTER TABLE company_lca_sponsorship ADD COLUMN wage_by_fiscal_year_json TEXT;
        ALTER TABLE company_lca_sponsorship ADD COLUMN uscis_by_fiscal_year_json TEXT;
        CREATE TABLE IF NOT EXISTS uscis_hub_employer_years (
          employer_key         TEXT    NOT NULL,
          tax_id4              TEXT    NOT NULL,
          fiscal_year          INTEGER NOT NULL,
          employer_name        TEXT    NOT NULL,
          state                TEXT,
          approvals            INTEGER NOT NULL DEFAULT 0,
          denials              INTEGER NOT NULL DEFAULT 0,
          initial_approvals    INTEGER,
          initial_denials      INTEGER,
          continuing_approvals INTEGER,
          continuing_denials   INTEGER,
          categories_json      TEXT,
          file_name            TEXT    NOT NULL,
          PRIMARY KEY (employer_key, tax_id4, fiscal_year)
        );
        CREATE INDEX IF NOT EXISTS idx_uscis_hub_employer_years_key ON uscis_hub_employer_years(employer_key);
        CREATE TABLE IF NOT EXISTS uscis_hub_source_files (
          file_name     TEXT    NOT NULL PRIMARY KEY,
          fiscal_years  TEXT    NOT NULL,
          source_url    TEXT,
          file_date     TEXT,
          layout        TEXT,
          data_rows     INTEGER NOT NULL DEFAULT 0,
          employer_rows INTEGER NOT NULL DEFAULT 0,
          byte_size     INTEGER,
          ingested_at   INTEGER NOT NULL
        );
      `,
    },
    {
      // ⭐ D113 P1 (owner 10-31) · REMOTE AUTO-APPLY — the picks loop on top of the FULL AUTO scheduler (services/picks.js,
      // services/autoScheduler.js). picks_runs: ONE row per (user, run time) — UNIQUE, so a crash or a second tick never
      // creates a run twice — with what the run looked at (seen), what it picked, the left-out counts BY REASON (JSON), when
      // its picks expire (the next run time), and the claim stamps that make the message / the start / the summary at most
      // once. picks: one row per picked job (rank, the D106 one line, its state offered | applied | passed | expired | auto,
      // whether the form is shown before sending, the single-use stamp of its confirm link). picks_left_out: the job ids
      // a run left out and why, kept 14 days (swept by the tick). Additive only.
      id: "188_picks",
      sql: `
        CREATE TABLE IF NOT EXISTS picks_runs (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          slot_at             INTEGER NOT NULL,
          mode                TEXT    NOT NULL,
          seen                INTEGER NOT NULL DEFAULT 0,
          picked              INTEGER NOT NULL DEFAULT 0,
          left_out_json       TEXT    NOT NULL DEFAULT '{}',
          expires_at          INTEGER NOT NULL,
          delivery_claimed_at INTEGER,
          delivery_json       TEXT,
          all_used_at         INTEGER,
          summary_sent_at     INTEGER,
          apply_run_id        INTEGER,
          created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (user_id, slot_at)
        );
        CREATE TABLE IF NOT EXISTS picks (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          run_id               INTEGER NOT NULL REFERENCES picks_runs(id) ON DELETE CASCADE,
          job_id               TEXT    NOT NULL,
          rank                 INTEGER NOT NULL,
          title                TEXT,
          company              TEXT,
          line                 TEXT,
          score                REAL,
          state                TEXT    NOT NULL DEFAULT 'offered',
          review               INTEGER NOT NULL DEFAULT 0,
          token_used_at        INTEGER,
          acted_at             INTEGER,
          apply_status         INTEGER,
          apply_error          TEXT,
          question_sent_at     INTEGER,
          question_answered_at INTEGER,
          expires_at           INTEGER NOT NULL,
          created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (run_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_picks_user_job ON picks(user_id, job_id);
        CREATE INDEX IF NOT EXISTS idx_picks_user_state ON picks(user_id, state);
        CREATE TABLE IF NOT EXISTS picks_left_out (
          run_id     INTEGER NOT NULL REFERENCES picks_runs(id) ON DELETE CASCADE,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id     TEXT    NOT NULL,
          reason     TEXT    NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (run_id, job_id)
        );
        CREATE INDEX IF NOT EXISTS idx_picks_left_out_created ON picks_left_out(created_at);
      `,
    },
    {
      // ⭐ D105 P7–P9 (amended 10-31) · THE ATLAS PUBLISHES ITSELF. Additive only.
      // atlas_nodes.unpublished_by / unpublished_at — a PERSON's un-publish, recorded so the nightly auto-publish never
      // re-publishes that node (services/atlas/atlasPublish.js; the person publishing again clears it).
      // atlas_nodes.wiki_title_by — 'auto' (the nightly matcher: an exact, non-disambiguation article title) or 'owner'
      // (the curator set or cleared it; the matcher never overwrites it). wiki_checked_at — the matcher's last try.
      // atlas_nodes.wikidata_id (Q…, from the article's pageprops) and wikidata_checked_at — read once per item.
      // atlas_resources.source — 'wikidata' (P856 official website, P2078 user manual), 'wikipedia' (the article),
      // 'owner' (the curator's); the page lists them in that order (atlasStore.RESOURCE_ORDER_SQL).
      id: "189_atlas_publish",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN unpublished_by TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN unpublished_at INTEGER;
        ALTER TABLE atlas_nodes ADD COLUMN wiki_title_by TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN wiki_checked_at INTEGER;
        ALTER TABLE atlas_nodes ADD COLUMN wikidata_id TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN wikidata_checked_at INTEGER;
        ALTER TABLE atlas_resources ADD COLUMN source TEXT;
        UPDATE atlas_nodes SET wiki_title_by = 'owner' WHERE wiki_title IS NOT NULL;
        UPDATE atlas_resources SET source = 'owner' WHERE source IS NULL;
      `,
    },
    {
      // ⭐ BUG 10-31 · atlas_nodes.wiki_match — what the title matcher's last ANSWER for this node was: matched · missing ·
      // not_in_answer · disambiguation · inexact · not_software · no_item (services/atlas/atlasWikidata.js
      // WIKI_MATCH_CLASSES). Written with wiki_checked_at; NULL = never answered. Additive only.
      id: "190_atlas_wiki_match",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN wiki_match TEXT;
      `,
    },
    {
      // ⭐ BUG 10-31 · the nodes the matcher set a title on BEFORE 190 carry no class, so Admin → Atlas counted them as
      // "never answered" (production: 62). An auto title, or a title with its Wikidata item, is a match.
      id: "191_atlas_wiki_match_backfill",
      sql: `
        UPDATE atlas_nodes SET wiki_match = 'matched'
          WHERE wiki_match IS NULL AND wiki_title IS NOT NULL AND TRIM(wiki_title) != ''
            AND (wiki_title_by = 'auto' OR wikidata_id IS NOT NULL);
      `,
    },
    {
      // ⭐ D105 P11 · drafted definitions, reviewed by the owner (services/atlas/atlasDefinitions.js). A definition pasted
      // back from a chat waits in definition_draft (definition_by = 'drafted') — never in `definition`, which is what
      // the public page shows and the publish bar counts; accepting moves it there with definition_by = 'owner'.
      id: "192_atlas_definition_draft",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN definition_draft TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN definition_by TEXT;
        UPDATE atlas_nodes SET definition_by = 'owner' WHERE TRIM(COALESCE(definition, '')) != '';
      `,
    },
    {
      // ⭐ D114 P5 · how often a posting's Atlas link is used: popup opens and Atlas visits, per day. A COUNT only — no
      // user, no term, no posting (services/atlas/atlasLinks.js countLinkEvent).
      id: "193_atlas_link_counts",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_link_counts (
          day   TEXT NOT NULL,
          event TEXT NOT NULL CHECK (event IN ('open', 'visit')),
          n     INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (day, event)
        );
      `,
    },
    {
      // ⭐ D115 P4 · two new kinds of Atlas node: 'concept' (the owner's tracker's 385 terms that are no existing node)
      // and 'pattern' (its 28 LeetCode patterns). SQLite cannot widen a CHECK in place, so atlas_nodes is REBUILT —
      // every column and row carried over with the same ids. ⛔ foreignKeys: "off" (scripts/applyMigrations.js): with
      // foreign keys on, the DROP cascades — rehearsed 10-31, it deleted every edge, stat, summary and resource.
      // The runner checks every reference inside the transaction and restores foreign keys after.
      id: "194_atlas_concept_pattern_kinds",
      foreignKeys: "off",
      sql: `
        CREATE TABLE atlas_nodes_new (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          slug                TEXT NOT NULL UNIQUE,
          kind                TEXT NOT NULL CHECK (kind IN ('role', 'skill', 'tool', 'stack', 'concept', 'pattern')),
          name                TEXT NOT NULL,
          term                TEXT NOT NULL,
          definition          TEXT,
          status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
          source              TEXT NOT NULL,
          wiki_title          TEXT,
          created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),
          published_at        INTEGER,
          published_by        TEXT,
          unpublished_by      TEXT,
          unpublished_at      INTEGER,
          wiki_title_by       TEXT,
          wiki_checked_at     INTEGER,
          wikidata_id         TEXT,
          wikidata_checked_at INTEGER,
          wiki_match          TEXT,
          definition_draft    TEXT,
          definition_by       TEXT
        );
        INSERT INTO atlas_nodes_new (id, slug, kind, name, term, definition, status, source, wiki_title, created_at, updated_at,
          published_at, published_by, unpublished_by, unpublished_at, wiki_title_by, wiki_checked_at, wikidata_id,
          wikidata_checked_at, wiki_match, definition_draft, definition_by)
        SELECT id, slug, kind, name, term, definition, status, source, wiki_title, created_at, updated_at,
          published_at, published_by, unpublished_by, unpublished_at, wiki_title_by, wiki_checked_at, wikidata_id,
          wikidata_checked_at, wiki_match, definition_draft, definition_by FROM atlas_nodes;
        DROP TABLE atlas_nodes;
        ALTER TABLE atlas_nodes_new RENAME TO atlas_nodes;
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_term ON atlas_nodes(term);
      `,
    },
    {
      // ⭐ D115 P3 · a learner's progress on the owner's tracker, so it follows them across devices: an ITEM done
      // (mark_id = the item's id, "s1-code") or a CHECKPOINT explained ("s1#c0" — the step and the checkpoint's place),
      // with the date. Signed out, the same marks live in the browser and are offered to the account on sign-in.
      id: "195_learn_progress",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_progress (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          mark_id TEXT NOT NULL,
          state   TEXT NOT NULL CHECK (state IN ('done', 'explained')),
          at      INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, mark_id)
        );
      `,
    },
    {
      // ⭐ D118 P2 · the Learn content IN THE DATABASE — the owner's tracker (PARTS · ATLAS · INDEX · its copy) as one
      // validated JSON document per source. Production reads this, never the file: Admin → Atlas → Import content
      // replaces it (validated, diffed by id, applied on Apply), and content/learn/*.json seeds it ONLY while the table
      // is empty (a first install) — never over newer database content. `version` moves on every apply.
      // ⭐ D118 P2 (b) · atlas_changes: ONE counter, moved by triggers on every write to atlas_nodes and skill_synonyms,
      // so the in-memory Atlas indexes (the search, the posting links) rebuild on the next read after ANY change. Their
      // old key (count · newest updated_at · published count) missed two curator edits in the same second — measured:
      // publish B then unpublish A within a second left A in the public search. ⚠ A table rebuild (194's kind) drops
      // these triggers with the table: re-create them after it.
      id: "198_learn_content",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_content (
          id          TEXT PRIMARY KEY,
          data        TEXT NOT NULL,
          version     INTEGER NOT NULL DEFAULT 1,
          imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
          imported_by TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS atlas_changes (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          n  INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO atlas_changes (id, n) VALUES (1, 0);
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_ins AFTER INSERT ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_upd AFTER UPDATE ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS atlas_nodes_changed_del AFTER DELETE ON atlas_nodes BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_ins AFTER INSERT ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_upd AFTER UPDATE ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
        CREATE TRIGGER IF NOT EXISTS skill_synonyms_changed_del AFTER DELETE ON skill_synonyms BEGIN UPDATE atlas_changes SET n = n + 1 WHERE id = 1; END;
      `,
    },
    {
      // ⭐ D118 P1 · COUNTS MOVE WITH THE BOARD (services/atlas/atlasLive.js). The Atlas's counts are adjusted when a
      // posting is ingested, changed or closed, not only by the nightly recount:
      //   atlas_posting_match   each ACTIVE posting's reading by the one matcher — the nodes it is counted for, the nodes
      //                         it links (D114, published or not; a read keeps the published ones), its role, level and
      //                         company, its sentence hashes (the company's boilerplate counts) and the vocabulary key.
      //                         What a posting ADDED is what its close SUBTRACTS — never re-guessed.
      //   atlas_role_level_stats per role: its postings and the postings asking for each node, in all (level '') and per
      //                         level read; node_id 0 = the role's own postings (D116 YOUR MAP, D105 P12 role pages)
      //   atlas_live_state      the store's version (caches key on it), the baseline, the board's totals, the last drift
      //   atlas_posting_dirty   postings written since the last pass. ⛔ Filled by TRIGGERS on scraped_jobs, so no write
      //                         path can be missed — a crawl, an update, a close, an expiry, a delete, a script.
      // ⚠ A rebuild of scraped_jobs drops these triggers — re-create them in that migration.
      // ⛔ The triggers insert only when absent (WHERE NOT EXISTS), never INSERT OR IGNORE: the writing statement's own
      // conflict clause overrides a trigger body's, so the crawl's upsert (ON CONFLICT DO UPDATE) turned IGNORE into ABORT.
      id: "199_atlas_live_counts",
      sql: `
        CREATE TABLE IF NOT EXISTS atlas_posting_match (
          posting_id  INTEGER PRIMARY KEY,
          company_key TEXT NOT NULL DEFAULT '',
          role_id     INTEGER,
          level       TEXT,
          asked       TEXT NOT NULL DEFAULT '',
          linked      TEXT NOT NULL DEFAULT '',
          sentences   TEXT NOT NULL DEFAULT '',
          vocab       TEXT NOT NULL,
          matched_at  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_posting_match_company ON atlas_posting_match(company_key);
        CREATE TABLE IF NOT EXISTS atlas_role_level_stats (
          role_id  INTEGER NOT NULL,
          level    TEXT NOT NULL,
          node_id  INTEGER NOT NULL,
          postings INTEGER NOT NULL,
          PRIMARY KEY (role_id, level, node_id)
        );
        CREATE TABLE IF NOT EXISTS atlas_live_state (
          k TEXT PRIMARY KEY,
          v TEXT
        );
        CREATE TABLE IF NOT EXISTS atlas_posting_dirty (
          posting_id INTEGER PRIMARY KEY
        );
        CREATE TRIGGER IF NOT EXISTS atlas_posting_ins AFTER INSERT ON scraped_jobs
          WHEN NEW.is_active = 1 AND NEW.duplicate_of IS NULL
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT NEW.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = NEW.id); END;
        CREATE TRIGGER IF NOT EXISTS atlas_posting_upd AFTER UPDATE OF is_active, duplicate_of, title, company, description, description_text, skills_json, level_read ON scraped_jobs
          WHEN ((OLD.is_active = 1 AND OLD.duplicate_of IS NULL) OR (NEW.is_active = 1 AND NEW.duplicate_of IS NULL))
            AND (OLD.is_active IS NOT NEW.is_active OR OLD.duplicate_of IS NOT NEW.duplicate_of OR OLD.title IS NOT NEW.title
              OR OLD.company IS NOT NEW.company OR OLD.description IS NOT NEW.description OR OLD.description_text IS NOT NEW.description_text
              OR OLD.skills_json IS NOT NEW.skills_json OR OLD.level_read IS NOT NEW.level_read)
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT NEW.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = NEW.id); END;
        CREATE TRIGGER IF NOT EXISTS atlas_posting_del AFTER DELETE ON scraped_jobs
          WHEN OLD.is_active = 1 AND OLD.duplicate_of IS NULL
          BEGIN INSERT INTO atlas_posting_dirty (posting_id) SELECT OLD.id WHERE NOT EXISTS (SELECT 1 FROM atlas_posting_dirty WHERE posting_id = OLD.id); END;
      `,
    },
    {
      // ⭐ D113 UI · the Draft House tree's leftovers, as the owner defined them 10-31 (WORKLOG). No new table.
      // interview_prep (D110's ONE store of the user's interview date) gains the time zone the user picked and
      // interview_at — that date and time in that zone as epoch seconds — so "Add the date" (an interview or an
      // assessment) is one source of truth: D110's countdown and Prep tab read the same row the tree's line does.
      // job_applications gains Note why's two private fields: rejection_note (≤ 500 characters, the user's words, never
      // read by a model — D17) and rejection_reasons (a JSON list of the quick picks, what D111 may later count).
      id: "200_draft_house_leftovers",
      sql: `
        ALTER TABLE interview_prep ADD COLUMN time_zone TEXT;
        ALTER TABLE interview_prep ADD COLUMN interview_at INTEGER;
        ALTER TABLE job_applications ADD COLUMN rejection_note TEXT;
        ALTER TABLE job_applications ADD COLUMN rejection_reasons TEXT;
      `,
    },
    {
      // ⭐ D116 M1 · THE TREE'S FAMILIES (owner 10-31): `family` is a STORED field on atlas_nodes — ML · Systems · Infra ·
      // Data · Backend (shared/atlasFamilies.js; more may be added there, so no CHECK: SQLite cannot widen one, see 194).
      // Assigned ONCE per node: the boot seed (content/atlas/families.json, reviewed by the owner) fills only a node whose
      // `family_by` is NULL, and a curator's choice in Admin → Atlas — set or cleared — writes `family_by` and sticks.
      // A node with no family is not drawn on the tree; it stays in search and on its page. After 200 (the Draft House leftovers).
      id: "201_atlas_node_family",
      sql: `
        ALTER TABLE atlas_nodes ADD COLUMN family TEXT;
        ALTER TABLE atlas_nodes ADD COLUMN family_by TEXT;
        CREATE INDEX IF NOT EXISTS idx_atlas_nodes_family ON atlas_nodes(family);
      `,
    },
    {
      // ⭐ D117 · LEARN AS A CIRCLE (owner 10-31, approved with C8: "make a progress bar the user may not mark themselves
      // complete"). The owner's tracker text stays in learn_content, untouched; the circle's own data sits beside it:
      //   learn_needs        "Before this" per piece (C2) — imported 'drafted' from content/learn/d117-data.json (C9); the
      //                      owner's review in Admin → Learn makes each 'accepted' or 'rejected'. A re-import never moves a
      //                      status (INSERT OR IGNORE by (step, need)), so his review is never undone.
      //   learn_teaches      the concept terms a piece teaches (C2, derived from the concept index) — resolved to Atlas
      //                      nodes on read, through the one thesaurus, so a new alias or node is picked up without a re-import
      //   learn_extra_items  D115 P5's games / exercises / practice links, optional, appended to their pieces on read;
      //                      'pending' until the dead-link checker has seen them, 'held' (listed for the owner) when dead
      //   learn_routes       guided routes as DATA (C5: a name + its target pieces; '*' = the whole circle), seeded here once
      //   learn_opened · learn_explanations · learn_builds — C8, progress EARNED, never ticked: an item opened FROM draft,
      //                      a checkpoint explained in the user's own words (private, never read by a model — D17), a link
      //                      to what was built. learn_progress (195, the old ticks) is kept as it is and no longer counts.
      // After 201 (the tree's families).
      id: "202_learn_circle",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_needs (
          step_id     TEXT NOT NULL,
          need_id     TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'accepted', 'rejected')),
          source      TEXT NOT NULL DEFAULT 'import',
          position    INTEGER NOT NULL DEFAULT 0,
          reviewed_by TEXT,
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (step_id, need_id)
        );
        CREATE TABLE IF NOT EXISTS learn_teaches (
          step_id  TEXT NOT NULL,
          term     TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (step_id, term)
        );
        CREATE TABLE IF NOT EXISTS learn_extra_items (
          id          TEXT PRIMARY KEY,
          step_id     TEXT NOT NULL,
          k           TEXT NOT NULL,
          t           TEXT NOT NULL,
          s           TEXT,
          u           TEXT NOT NULL,
          o           INTEGER NOT NULL DEFAULT 1,
          position    INTEGER NOT NULL DEFAULT 0,
          status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'held')),
          checked_at  INTEGER,
          check_note  TEXT,
          imported_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS learn_routes (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          targets    TEXT NOT NULL,
          position   INTEGER NOT NULL DEFAULT 0,
          updated_by TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        INSERT OR IGNORE INTO learn_routes (id, name, targets, position, updated_by) VALUES
          ('all', 'The whole circle', '*', 0, 'seed:202'),
          ('k8s', 'Make sense of Kubernetes', '["o4"]', 1, 'seed:202'),
          ('backend-senior', 'Backend → senior', '["x2","x1","b2","w2","o3","l2"]', 2, 'seed:202'),
          ('system-design', 'System design interviews', '["x2","x1","b2","d3","g4"]', 3, 'seed:202');
        CREATE TABLE IF NOT EXISTS learn_opened (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          at      INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, item_id)
        );
        CREATE TABLE IF NOT EXISTS learn_explanations (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          checkpoint_id TEXT NOT NULL,
          step_id       TEXT NOT NULL,
          body          TEXT NOT NULL,
          words         INTEGER NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, checkpoint_id)
        );
        CREATE TABLE IF NOT EXISTS learn_builds (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          step_id    TEXT NOT NULL,
          url        TEXT NOT NULL,
          kind       TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, step_id)
        );
        CREATE INDEX IF NOT EXISTS idx_learn_needs_need ON learn_needs(need_id);
      `,
    },
    {
      // ⭐ D121 P2 · H-1B SPONSORSHIP SIGNALS — the title level. The DOL OFLC LCA disclosure file's certified cases,
      // per employer × fiscal period × TITLE FAMILY (shared/lcaTitleKey.js: the job title with its level words removed,
      // so "Senior Software Engineer II" and "Software Engineer" are one family), written by scripts/ingestLca.mjs in the
      // SAME transaction as lca_employer_periods (a re-import of a period deletes and re-inserts both):
      //   certified       certified cases for that family
      //   wage_cases · wage_hist_json   the offered wage (WAGE_RATE_OF_PAY_FROM, annualised — services/kb/lcaWages.js),
      //                   $1k-bucket histogram, so a median over many entities and quarters is exact to the bucket
      //   level_json      the prevailing-wage level the case was filed at (PW_WAGE_LEVEL: I · II · III · IV) → count
      // Only employers with certified cases, only the top families per employer (the ingest's cap). Public data; no
      // person's name, contact or wage is stored — counts and buckets only. After 202 (the circle).
      id: "203_lca_employer_titles",
      sql: `
        CREATE TABLE IF NOT EXISTS lca_employer_titles (
          employer_key   TEXT    NOT NULL,
          fein           TEXT    NOT NULL,
          fiscal_period  TEXT    NOT NULL,
          title_key      TEXT    NOT NULL,
          certified      INTEGER NOT NULL DEFAULT 0,
          wage_cases     INTEGER NOT NULL DEFAULT 0,
          wage_hist_json TEXT,
          level_json     TEXT,
          PRIMARY KEY (employer_key, fein, fiscal_period, title_key)
        );
        CREATE INDEX IF NOT EXISTS idx_lca_employer_titles_period ON lca_employer_titles(fiscal_period);
      `,
    },
    {
      // ⭐ D119 · THUMBNAILS — every resource shows what it is before it is opened (owner 10-31). One row per resource URL
      // (url_hash = sha256 of the URL, hex), written by services/thumbs/resourceThumbs.js and read by GET /api/thumbs:
      //   kind        what the picture is: youtube (a watch URL's own thumbnail) · youtube_search (no single video, so no
      //               picture is invented) · book (Open Library's cover for the title + author) · site (the page's own
      //               og:image / twitter:image) · none (a fallback tile)
      //   bytes / content_type   the picture as FETCHED ONCE and stored (≤ 2 MB, sniffed by its first bytes — never
      //               hot-linked); null when there is none
      //   title · attribution    YouTube oEmbed's title and channel; "Cover: Open Library"; the site's host
      //   pinned_url  Admin → Learn "Pin a video": a watch URL an admin chose for a search link → the real thumbnail
      //   hidden_at / hidden_by  Admin's one-press takedown; a hidden picture is never served (the tile falls back)
      //   status      ok · none · failed — a failed fetch keeps the fallback tile and is tried again on the next refresh
      // After 203 (the LCA title families).
      id: "204_resource_thumbs",
      sql: `
        CREATE TABLE IF NOT EXISTS resource_thumbs (
          url_hash     TEXT PRIMARY KEY,
          url          TEXT NOT NULL,
          kind         TEXT NOT NULL CHECK (kind IN ('youtube', 'youtube_search', 'book', 'site', 'none')),
          status       TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('ok', 'none', 'failed')),
          bytes        BLOB,
          content_type TEXT,
          title        TEXT,
          attribution  TEXT,
          note         TEXT,
          pinned_url   TEXT,
          pinned_by    TEXT,
          hidden_at    INTEGER,
          hidden_by    TEXT,
          fetched_at   INTEGER,
          updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D124 · THE TRIAL (owner 11-01, twice amended): THE TRIAL IS THE MAIN FRAME — every account made from now on is a
      // trial account unless an admin grants it full access; 2 Drafts, then the whole site locks and ends in the survey and
      // a coming-soon page. A sample résumé sends to draft's practice form, the tester's own sends for real.
      //   users.full_access     NULL = by age (an account made before trial_since keeps full access) · 1 = granted · 0 = trial
      //   users.full_access_at / full_access_by   when and by which admin it was last set
      //   users.trial_at        when the account was first seen in the trial; users.trial_resume 'A' | 'B' | 'own'
      //   users.trial_survey_dismissed_at   the survey was skipped at the end · users.trial_finished_at "Finish the trial"
      //   trial_config          trial_since = when this migration ran (no existing row is changed)
      //   trial_events          the trial's analytics: pages visited and active minutes — names and counts, no content
      //   trial_surveys         the survey's answers, one row per account (answers JSON: the D124 questions)
      //   trial_feedback        "Something broke? / Feedback": a short text and the screen it came from
      //   practice_submissions  a send that reached draft's practice form — counts only, never the form's values
      // After 204 (the resource thumbnails).
      id: "205_trial",
      sql: `
        ALTER TABLE users ADD COLUMN trial_at INTEGER;
        ALTER TABLE users ADD COLUMN trial_resume TEXT;
        ALTER TABLE users ADD COLUMN trial_survey_dismissed_at INTEGER;
        ALTER TABLE users ADD COLUMN trial_finished_at INTEGER;
        ALTER TABLE users ADD COLUMN full_access INTEGER;
        ALTER TABLE users ADD COLUMN full_access_at INTEGER;
        ALTER TABLE users ADD COLUMN full_access_by TEXT;
        CREATE TABLE IF NOT EXISTS trial_config (
          key   TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO trial_config (key, value) VALUES ('trial_since', unixepoch());
        CREATE TABLE IF NOT EXISTS trial_events (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          event      TEXT NOT NULL,
          detail     TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_trial_events_user ON trial_events(user_id, event);
        CREATE TABLE IF NOT EXISTS trial_surveys (
          user_id    INTEGER PRIMARY KEY,
          answers    TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS trial_feedback (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER NOT NULL,
          screen     TEXT,
          body       TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_trial_feedback_user ON trial_feedback(user_id);
        CREATE TABLE IF NOT EXISTS practice_submissions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER,
          job_id          TEXT NOT NULL,
          fields_filled   INTEGER NOT NULL DEFAULT 0,
          resume_attached INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_practice_submissions_user ON practice_submissions(user_id);
      `,
    },
    {
      // ⭐ A108 · APIFY, SCRAPPED (owner 11-01): "scrap the entire apify module and pathways". No route writes or reads a
      // token any more; the ones people once pasted are third-party credentials draft should not keep. A DATA migration
      // (it changes rows): backed up first, like 162 / 163 / 194 (server.js DATA_MIGRATIONS). The column stays — dropping
      // it on the volume buys nothing and nothing reads it.
      // After 205 (the trial).
      id: "206_scrub_apify_tokens",
      sql: `
        UPDATE users SET apify_token = NULL WHERE apify_token IS NOT NULL;
      `,
    },
    {
      // ⭐ D126 + D127 · EVERY POSTING IN ONE CATEGORY (owner 11-01): the CS-only gate lifted to all professional roles,
      // and nothing shown from an unknown category. services/jobs/professionalScope.js decides; the crawl's gate and a
      // boot backfill write it here (board_category: sj.category is an older, unwritten column). NULL = not classified yet (shown, like CC1b's soft null); 'held' = never
      // shown on any board (the red-flag rule); category_reason says why. After 206.
      id: "207_posting_category",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN board_category TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN soc TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN discipline TEXT;
        ALTER TABLE scraped_jobs ADD COLUMN category_confidence REAL;
        ALTER TABLE scraped_jobs ADD COLUMN category_reason TEXT;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_board_category ON scraped_jobs(board_category);
      `,
    },
    {
      // ⭐ 43y FIX (11-01): D121's sponsorship signal reads lca_employer_periods BY EMPLOYER NAME for every board row
      // (sponsorshipSignal.titleFacts), and nothing indexed employer_name — a 2.5 s scan of 481,588 rows per row, 50 rows
      // a page: the daily deck's deal blocked the whole server for minutes on a new account (the owner's trial walk,
      // 11-01: "no jobs or picks"). Measured on a copy: 2,562 ms -> 0 ms a lookup; the index builds in 0.5 s. After 207.
      id: "208_lca_employer_name_index",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_lca_employer_periods_name ON lca_employer_periods(employer_name);
      `,
    },
    {
      // ⭐ D130 (owner 11-01) · THE STANDALONE SURVEY — jobsviadraft.com/survey, no account: a response's name and email
      // are its only identity, one response per email (email_key, lower-cased; a second submission updates the first).
      // Beside trial_surveys (keyed by the account), not in it: that table's key is the user, and these have none.
      // After 208.
      id: "209_standalone_surveys",
      sql: `
        CREATE TABLE IF NOT EXISTS standalone_surveys (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          email      TEXT NOT NULL,
          email_key  TEXT NOT NULL UNIQUE,
          answers    TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ THE TRIAL'S DEMONSTRATION (owner 11-01): a sample's tailored résumé for a posting — simulated, no model (the
      // sample re-arranged for the posting's terms) — made once and replayed for every later tester on that sample
      // (services/trialDemo.js). No person's data: the sample is a fictional person. After 209.
      id: "210_trial_demo_tailoring",
      sql: `
        CREATE TABLE IF NOT EXISTS trial_demo_tailoring (
          sample_id    TEXT NOT NULL,
          job_id       TEXT NOT NULL,
          changes_json TEXT NOT NULL,
          ats_after    INTEGER,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (sample_id, job_id)
        );
      `,
    },
    {
      // ⭐ D125 (owner 11-01): the owner calibrates the ATS by hand (services/atsCalibration.js, Admin → ATS calibration).
      // A set is FROZEN per version — each posting's text, the sentences the board counts and draft's reading at the time —
      // so every later scorer change is measured on the same pairs. Résumés: the admin's own (copied in), the trial's
      // samples, any he uploads. Reviews hold his marks; suggestions from the optional assist stay apart until he accepts
      // them. Fixes are queued for the agent; baselines feed the regression gate (scripts/d125GoldGate.mjs). After 210.
      id: "211_ats_gold",
      sql: `
        CREATE TABLE IF NOT EXISTS ats_gold_items (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          version       INTEGER NOT NULL,
          job_id        TEXT NOT NULL,
          category      TEXT,
          discipline    TEXT,
          level         TEXT,
          title         TEXT,
          company       TEXT,
          posting_text  TEXT NOT NULL,
          counted_json  TEXT NOT NULL DEFAULT '[]',
          reading_json  TEXT NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (version, job_id)
        );
        CREATE TABLE IF NOT EXISTS ats_gold_resumes (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          label         TEXT NOT NULL,
          source        TEXT NOT NULL,
          resume_text   TEXT NOT NULL,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS ats_gold_reviews (
          item_id          INTEGER PRIMARY KEY REFERENCES ats_gold_items(id) ON DELETE CASCADE,
          marks_json       TEXT NOT NULL DEFAULT '{}',
          added_json       TEXT NOT NULL DEFAULT '{}',
          tiers_json       TEXT NOT NULL DEFAULT '{}',
          scores_json      TEXT NOT NULL DEFAULT '{}',
          suggestions_json TEXT,
          done             INTEGER NOT NULL DEFAULT 0,
          reviewed_by      INTEGER,
          updated_at       INTEGER
        );
        CREATE TABLE IF NOT EXISTS ats_gold_fixes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          kind        TEXT NOT NULL,
          term        TEXT NOT NULL,
          why         TEXT,
          status      TEXT NOT NULL DEFAULT 'queued',
          queued_by   INTEGER,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (kind, term)
        );
        CREATE TABLE IF NOT EXISTS ats_gold_baselines (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          version      INTEGER NOT NULL,
          metrics_json TEXT NOT NULL,
          recorded_by  INTEGER,
          created_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `,
    },
    {
      // ⭐ D123 P6a / P6d / P6g + the owner's model choice (11-01, contract 1.8.0). users.tailoring_model: the model a
      // person picked for their tailorings (haiku · sonnet · open), honoured only while Admin → Ops offers it
      // (services/leanTailoring.js modelFor). resume_gists: the per-employer gists of a base résumé, built ONCE on the
      // Sonnet tier (POST /v1/resumes/gists) and keyed by the résumé's hash, so a changed résumé gets new ones; `edited`
      // marks the person's own wording (never overwritten by a rebuild of the same résumé); numberless_json lists the
      // bullets with no number for the optional "add a real number" prompt (P6g). user_profile.coursework_json: the
      // person's own courses, for P6d's Relevant Coursework row. After 211.
      id: "212_tailoring_choice",
      sql: `
        ALTER TABLE users ADD COLUMN tailoring_model TEXT;
        ALTER TABLE user_profile ADD COLUMN coursework_json TEXT;
        CREATE TABLE IF NOT EXISTS resume_gists (
          user_id          INTEGER NOT NULL,
          resume_hash      TEXT NOT NULL,
          gists_json       TEXT NOT NULL DEFAULT '[]',
          numberless_json  TEXT NOT NULL DEFAULT '[]',
          edited           INTEGER NOT NULL DEFAULT 0,
          cost_usd         REAL,
          created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, resume_hash)
        );
      `,
    },
    {
      // ⭐ D137 (owner 11-02) · THE GHOST SCORE. scraped_jobs.ghost_level: NULL = nothing against the posting,
      // 1 = Uncertain, 2 = Likely not hiring — the board's order (ranked down, never removed) and its "Hide likely not
      // hiring" filter read it. job_ghost: the evidence the card shows, and flagged_at — the FIRST time a posting was
      // flagged, never cleared, so the monthly calibration reads applications sent after the flag. Written by
      // services/jobs/ghostScore.js scoreGhosts after D107's history rollup. Not a trigger column of 199. After 212.
      id: "213_ghost_score",
      sql: `
        ALTER TABLE scraped_jobs ADD COLUMN ghost_level INTEGER;
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_ghost ON scraped_jobs(ghost_level) WHERE ghost_level IS NOT NULL;
        CREATE TABLE IF NOT EXISTS job_ghost (
          job_id         TEXT PRIMARY KEY,
          level          INTEGER NOT NULL,
          points         INTEGER NOT NULL DEFAULT 0,
          evidence_json  TEXT NOT NULL DEFAULT '[]',
          scored_at      INTEGER NOT NULL,
          flagged_at     INTEGER
        );
      `,
    },
    {
      // ⭐ D136 P3 (owner 11-02) · BEST BETS' CALIBRATION. The signals an application had when it was SENT (fit against the
      // must-haves, level, freshness, the ghost level, the company's closings), stored once per (user, posting) by
      // services/bestBets.js recordApplicationSignals from writeApplication; the first send wins. The monthly refit joins
      // it to job_applications' outcome. Merge plan keepInto. After 213.
      id: "214_application_signals",
      sql: `
        CREATE TABLE IF NOT EXISTS application_signals (
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          job_id        TEXT NOT NULL,
          signals_json  TEXT NOT NULL,
          score         INTEGER,
          recorded_at   INTEGER NOT NULL,
          PRIMARY KEY (user_id, job_id)
        );
      `,
    },
    {
      // ⭐ D143 (owner 11-02) · THE NAVIGATOR. One row per user: their own aim (a role's slug; NULL = follow draft's
      // recommendation), the route as last shown (the skills in order, what they had at the start) and the re-routing
      // changes with their reasons. Written by services/navigator.js. Merge plan keepInto. After 214.
      id: "215_navigator",
      sql: `
        CREATE TABLE IF NOT EXISTS navigator_routes (
          user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          aim_slug      TEXT,
          aim_set_by    TEXT,
          aim_at        INTEGER,
          route_json    TEXT,
          route_at      INTEGER,
          changes_json  TEXT NOT NULL DEFAULT '[]'
        );
      `,
    },
    {
      // ⭐ D138 (owner 11-02) · WARM PATHS. The user's OWN contacts: their LinkedIn connections export, or an alumni list
      // they add (school). Private to the user, deletable (DELETE /api/warm-paths), cascading with the account; never
      // shown to anyone else, never used to contact anyone. company_key = shared/companyIdentity.js companyNameKey, so a
      // posting's company finds its people. services/warmPaths.js. Merge plan move. After 215.
      id: "216_warm_contacts",
      sql: `
        CREATE TABLE IF NOT EXISTS warm_contacts (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source        TEXT NOT NULL,
          school        TEXT,
          name          TEXT NOT NULL,
          company       TEXT NOT NULL,
          company_key   TEXT NOT NULL,
          position      TEXT,
          url           TEXT,
          email         TEXT,
          connected_on  INTEGER,
          imported_at   INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_warm_contacts_company ON warm_contacts(user_id, company_key);
      `,
    },
    {
      // ⭐ D142 (owner 11-02) · READINESS — CHECK. readiness_questions: the bank, per skill and concept, difficulty 1–3,
      // seconds per question; ⛔ status 'draft' until a person reviews it ('live'), so a wrong answer key never reaches a
      // user. readiness_checks: one adaptive check (mode timed / extended / untimed; the question being asked and when
      // the SERVER served it — the timer is the server's). readiness_answers: each answer, right or not, in time or not.
      // services/readiness.js. Merge plan move (checks, answers). After 216.
      id: "217_readiness",
      sql: `
        CREATE TABLE IF NOT EXISTS readiness_questions (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          skill         TEXT NOT NULL,
          skill_key     TEXT NOT NULL,
          concept       TEXT NOT NULL,
          difficulty    INTEGER NOT NULL,
          prompt        TEXT NOT NULL,
          options_json  TEXT NOT NULL,
          answer        INTEGER NOT NULL,
          explanation   TEXT,
          seconds       INTEGER NOT NULL DEFAULT 20,
          status        TEXT NOT NULL DEFAULT 'draft',
          written_by    TEXT NOT NULL,
          reviewed_by   TEXT,
          reviewed_at   INTEGER,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_readiness_questions_skill ON readiness_questions(skill_key, status, difficulty);
        CREATE TABLE IF NOT EXISTS readiness_checks (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key     TEXT NOT NULL,
          mode          TEXT NOT NULL,
          current_q     INTEGER,
          served_at     INTEGER,
          started_at    INTEGER NOT NULL,
          finished_at   INTEGER,
          summary_json  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_readiness_checks_user ON readiness_checks(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS readiness_answers (
          check_id      INTEGER NOT NULL REFERENCES readiness_checks(id) ON DELETE CASCADE,
          question_id   INTEGER NOT NULL,
          chosen        INTEGER,
          correct       INTEGER NOT NULL,
          in_time       INTEGER NOT NULL,
          ms            INTEGER NOT NULL,
          answered_at   INTEGER NOT NULL,
          PRIMARY KEY (check_id, question_id)
        );
      `,
    },
    {
      // ⭐ D150 T01 (owner 11-03) · THE QUESTION BANK — one reviewed bank used by the audit, Check, Play, Learn, Defend and the
      // company guides (services/learn/learnQuestions.js, ONE reader). learn_questions: the item (role, level, type
      // scenario | recall | explain, a stem, choices, the correct one and a WHY for every choice, the skills and Learn
      // pieces it evidences); ⛔ status 'draft' until a person approves it in Admin → Learn → Questions ('live'), 'retired'
      // after; a re-import never resets status or stats. learn_question_answers: each answer (the choice, the time) — the
      // stats and T02's flags read them; user_id is NULL for the public audit (no sign-in). Merge plan: move. After 217.
      id: "218_learn_questions",
      sql: `
        CREATE TABLE IF NOT EXISTS learn_questions (
          id             TEXT PRIMARY KEY,
          role           TEXT,
          level          TEXT,
          type           TEXT NOT NULL,
          skills_json    TEXT NOT NULL DEFAULT '[]',
          pieces_json    TEXT NOT NULL DEFAULT '[]',
          families_json  TEXT NOT NULL DEFAULT '[]',
          stem           TEXT NOT NULL,
          choices_json   TEXT NOT NULL,
          correct        INTEGER NOT NULL,
          why_json       TEXT NOT NULL,
          source         TEXT,
          status         TEXT NOT NULL DEFAULT 'draft',
          version        INTEGER NOT NULL DEFAULT 1,
          content_hash   TEXT NOT NULL,
          imported_from  TEXT,
          reviewed_by    TEXT,
          reviewed_at    INTEGER,
          created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_learn_questions_pick ON learn_questions(status, role, level, type);
        CREATE TABLE IF NOT EXISTS learn_question_answers (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id    TEXT NOT NULL REFERENCES learn_questions(id) ON DELETE CASCADE,
          user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
          surface        TEXT NOT NULL,
          chosen         INTEGER NOT NULL,
          correct        INTEGER NOT NULL,
          ms             INTEGER,
          answered_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_learn_question_answers_q ON learn_question_answers(question_id);
      `,
    },
    {
      // D151 / A123 (2) (44r, 11-04): THE DESCRIPTION PASS'S STALE SCAN BECOMES AN INDEX READ. A changed description now
      // clears its description_basis here, so services/jobs/descriptionText.js finds stale rows by the basis alone
      // (NULL, or another normaliser version's prefix) instead of hashing every description on the board twice a pass
      // (18.6 s of blocked event loop at 84k postings, on every boot and every 10 minutes). Schema only (D151 Rule 1:
      // no data step in a migration); rows changed before this trigger existed are caught by a one-time sliced sweep.
      // (The cleanup's scraped_at index is built by the boot warm-up, not here: 29 s on the 82k copy, so not before listen.)
      id: "219_boot_bounded_scans",
      sql: `
        CREATE TRIGGER IF NOT EXISTS d151_description_basis_reset AFTER UPDATE OF description ON scraped_jobs
          WHEN NEW.description IS NOT OLD.description AND NEW.description_basis IS NOT NULL
        BEGIN
          UPDATE scraped_jobs SET description_basis = NULL WHERE rowid = NEW.rowid;
        END;
      `,
    },
    {
      // D152 (3) (11-05): PICKS PER DAY — how many cards the Daily Deck deals, the person's own choice (Customise → Daily
      // Deck; shared/deckGeometry.js DECK_SIZES). NULL = never chosen = the standard 10. Schema only (D151 Rule 1).
      id: "220_users_deck_size",
      sql: `
        ALTER TABLE users ADD COLUMN deck_size INTEGER;
      `,
    },
    {
      // D162 G3 + G4 (11-05): THE MODEL GATEWAY. usage_events.task = the model task a call served (shared/modelTasks.js)
      // and .route = how the gateway routed it (default · cohort · shadow · fallback · tools-service); NULL on older rows,
      // which the telemetry attributes by purpose. model_eval_records = one measured evaluation run per task × provider ×
      // model, its verdict computed by the pass rule (services/modelEvals.js) — the gate a model must pass before it
      // serves users on a task. The route switch itself needs no table: app_settings + admin_audit_log (who / when / why).
      // Schema only (D151 Rule 1): two O(1) column adds and a new, empty table — no index on usage_events.
      id: "221_model_gateway",
      sql: `
        ALTER TABLE usage_events ADD COLUMN task TEXT;
        ALTER TABLE usage_events ADD COLUMN route TEXT;
        CREATE TABLE IF NOT EXISTS model_eval_records (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          task             TEXT    NOT NULL,
          provider         TEXT    NOT NULL,
          model            TEXT    NOT NULL,
          eval_set         TEXT    NOT NULL,
          eval_set_version INTEGER NOT NULL,
          passed           INTEGER NOT NULL,
          metrics_json     TEXT    NOT NULL,
          baseline_json    TEXT,
          reasons_json     TEXT    NOT NULL,
          actor            TEXT,
          reason           TEXT,
          at               INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_model_eval_records_lookup
          ON model_eval_records(task, provider, model, at);
      `,
    },
    {
      // D165 (3) (11-06): A SAVED SALARY ANSWER IS SCOPED PER ROLE + LOCATION (D165 R2: "scoped: per role / location
      // for salary, global for eligibility"). user_profile.custom_answer_scoped = a JSON array of
      // { question, answer, kind, roleKey, locationKey, savedAt } (services/scopedAnswers.js); the fill picks the most
      // specific entry whose scope matches the job. NULL = none saved. Eligibility and every other answer stay in
      // custom_answers (global). A column on user_profile, not a new user table, so the account-merge plan and the
      // profile row's lifecycle already cover it. Schema only (D151 Rule 1): one O(1) column add.
      id: "222_saved_answer_scopes",
      sql: `
        ALTER TABLE user_profile ADD COLUMN custom_answer_scoped TEXT;
      `,
    },
    {
      // ⭐ D169 (owner 11-06, approved, revisable) · YOUR SKILLS IN ATLAS — a skill is proven before it goes into a résumé.
      // skill_proofs: what proved a person's skill (a passed quick check → 'checked'; a proof link, D109's validator →
      // 'built'); the gate (services/yourSkills.js resumeClaims) reads it. skill_quick_checks: one quick check — 3–5 items
      // of D150's bank, the item being asked and when the SERVER served it (D142's clock), the answers, passed or not.
      // atlas_skill_holds: a skill a person typed that the Atlas has no published node for — held for the curator, never
      // invented as a node. Schema only (D151 Rule 1). Merge plan: move. Export: all three. After 222.
      id: "223_your_skills",
      sql: `
        CREATE TABLE IF NOT EXISTS skill_proofs (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key     TEXT NOT NULL,
          skill         TEXT NOT NULL,
          state         TEXT NOT NULL,
          via           TEXT NOT NULL,
          url           TEXT,
          label         TEXT,
          kind          TEXT,
          check_id      INTEGER,
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_skill_proofs_user ON skill_proofs(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS skill_quick_checks (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          skill_key          TEXT NOT NULL,
          skill              TEXT NOT NULL,
          slug               TEXT NOT NULL,
          mode               TEXT NOT NULL,
          question_ids_json  TEXT NOT NULL,
          position           INTEGER NOT NULL DEFAULT 0,
          served_at          INTEGER,
          answers_json       TEXT NOT NULL DEFAULT '[]',
          started_at         INTEGER NOT NULL,
          finished_at        INTEGER,
          passed             INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_skill_quick_checks_user ON skill_quick_checks(user_id, skill_key);
        CREATE TABLE IF NOT EXISTS atlas_skill_holds (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          term          TEXT NOT NULL,
          name          TEXT NOT NULL,
          held_at       INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_atlas_skill_holds_term ON atlas_skill_holds(term);
      `,
    },
    {
      // ⛔ D171 FIX 1 + FIX 2 (owner 11-06: "the prophetic job run took place, which i suppose the agent triggered" ·
      // "theres also an unknown run at 6am utc"): EVERY RUN AND EVERY MODEL CALL SAYS WHO STARTED IT, AND WHICH KEY PAID.
      // apply_runs.started_by = user · scheduler · admin · agent · test · system (shared/startedBy.js) and
      // .started_by_ref = the actor (user:3, admin:adm_…, a script's name). usage_events.started_by = the same kinds, from
      // the request / the run / the scheduler that made the call (services/startedByContext.js); usage_events.key_label =
      // the key that paid — draft's ANTHROPIC_KEY_LABEL ("draft-prod", "local-dev"), or the tools service's for the
      // résumé generations it makes, so Admin → System → Model usage separates local-dev and production spend.
      // users.test_account = 1 for an account made for checks: in production an agent- or test-started run is refused on
      // any other account (FIX 1's rule). NULL on every older row = "not recorded". Schema only (D151 Rule 1): five O(1)
      // column adds, no index, no backfill.
      id: "224_started_by_and_key_label",
      sql: `
        ALTER TABLE apply_runs ADD COLUMN started_by TEXT;
        ALTER TABLE apply_runs ADD COLUMN started_by_ref TEXT;
        ALTER TABLE usage_events ADD COLUMN started_by TEXT;
        ALTER TABLE usage_events ADD COLUMN key_label TEXT;
        ALTER TABLE users ADD COLUMN test_account INTEGER;
      `,
    },
    {
      // ⭐ D171 FIX 3 (owner 11-06: he could not open the job from Home to compare the JD with the résumé): THE JOB
      // DESCRIPTION, AS IT READ WHEN THE APPLICATION WAS MADE. 129 snapshotted the posting's title, company, URL and
      // location onto the run-job; the description stayed on scraped_jobs, where a re-crawl rewrites it and a closed
      // posting stops being the one applied to. It is now copied at the same moment, in the same transaction
      // (routes/apply.js), and served by routes/applicationPosting.js. NULL: made before this — the reader falls back to
      // the live posting and says so. No backfill: today's text is not what was applied to. Merge plan: apply_run_jobs
      // moves already. After 224.
      id: "225_posting_description_snapshot",
      sql: `
        ALTER TABLE apply_run_jobs ADD COLUMN posting_description TEXT;
      `,
    },
    {
      // ⭐ D172 (3) · POINTS ONLY FROM PROOF (atlas-redesign-sketch.html → Your run): one row per piece of proof — an
      // explanation in the person's own words, a build, a skill checked (a passed quick check) or built (a proof link) —
      // keyed (user, kind, ref), so the same proof can never pay twice. Filled from the proof records themselves
      // (services/atlas/points.js syncPoints), so it is retroactive and cannot drift from them; a week's points (the
      // league, later) read it by earned_at. Merge plan: keepInto (a clash keeps INTO's row). After 225.
      id: "226_proof_points",
      sql: `
        CREATE TABLE IF NOT EXISTS proof_points (
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind       TEXT NOT NULL,
          ref        TEXT NOT NULL,
          points     INTEGER NOT NULL,
          earned_at  INTEGER NOT NULL,
          PRIMARY KEY (user_id, kind, ref)
        );
        CREATE INDEX IF NOT EXISTS idx_proof_points_earned ON proof_points(earned_at, user_id);
      `,
    },
    {
      // ⭐ D178-4 · THE PROOF PAGE SHOWS WHAT WAS PROVEN IN ATLAS — only when the person says so. The public page (D109 P3,
      // /p/<handle>) is opt-in already, but people who turned it on agreed to their projects, not their learning: a
      // second switch, OFF for every existing and new page. When on, the page adds the modules finished, the skills
      // passed in a quick check or backed by a proof link, and the builds — each with its date
      // (services/atlas/points.js learningProof). Only ADDS a column. After 226.
      id: "227_proof_page_learning",
      sql: `
        ALTER TABLE proof_pages ADD COLUMN show_learning INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      // ⭐ D151 Rule 4 (measured 11-08 on the 100k fixture: the board's COUNT and id page show "SCAN jc" inside a correlated
      // subquery per posting) · job_captures had no index for (user_id, job_id) — the board's "my captures" EXISTS, the +
      // view, the capture lookups in autoCapture / captureOutcome all filter on exactly that. One index; only ADDS. After 227.
      id: "228_job_captures_user_job",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_job_captures_user_job ON job_captures(user_id, job_id);
      `,
    },
    {
      // ⭐ D151 Rule 4 (measured 11-08 on the 100k fixture): the board's "being matched" read — the newest postings not yet
      // scored for the person, ORDER BY COALESCE(posted_at, discovered_at) DESC LIMIT 2000 — sorted the whole active board
      // to pick 2,000 (4.9 s on a copy; SCAN sj). A partial index on that recency, active postings only, lets it walk
      // newest-first and stop (160 ms). The expression is the board's own, character for character. Only ADDS. After 228.
      id: "229_scraped_jobs_active_recency",
      sql: `
        CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_recency ON scraped_jobs(COALESCE(posted_at, discovered_at) DESC) WHERE is_active = 1;
      `,
    },
  ];

  console.log("[boot] migrations: checking schema");
  const migrationsStartedAt = Date.now();
  // ⛔ ONE TRANSACTION PER MIGRATION, INCLUDING THE ROW THAT RECORDS IT. The loop that stood here
  // called `db.exec(m.sql)` bare, so a migration failing partway kept whatever it had already
  // committed — survivable while every migration was additive, and not survivable from 108, which
  // DROPs a table to widen a UNIQUE constraint. See scripts/applyMigrations.js for the two failure
  // shapes and why the unit is one migration rather than the whole loop.
  //
  // The loop is shared with scripts/migration.js; the MIGRATIONS list above is still deliberately
  // its own copy, guarded by test/migrationListsAgree.test.js.
  let migrationCount = 0;
  // ⛔ D95 PHASE 2: migration 162 CHANGES data (it clears the admin flag, revokes and suspends the former admin row).
  // A backup is taken on the volume first; if it cannot be taken, 162 is held back this boot and says so — the site
  // still starts, on today's behaviour, and the next boot tries again.
  // The same rule for 163 (the former admin row deleted, the owner's word 10-13): ONE backup before every pending
  // data migration that has something to change, and all of them held back if it cannot be taken.
  const DATA_MIGRATIONS = [
    { id: "162_no_admin_in_users", changes: "SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1" },
    { id: "163_delete_former_admin_row", changes: "SELECT 1 FROM users WHERE status = 'suspended' AND suspended_reason LIKE 'Former admin row (D95)%' LIMIT 1" },
    // ⭐ D115: 194 REBUILDS atlas_nodes (a CHECK widened) — rehearsed safe, and backed up first all the same.
    { id: "194_atlas_concept_pattern_kinds", changes: "SELECT 1 FROM atlas_nodes LIMIT 1" },
    // ⭐ A108: 206 clears the Apify tokens people once pasted — backed up first when there is one to clear.
    { id: "206_scrub_apify_tokens", changes: "SELECT 1 FROM users WHERE apify_token IS NOT NULL LIMIT 1" },
  ];
  const heldBack = new Set();
  const isPending = (id) => { try { return !db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(id); } catch { return true; } };
  const hasWork = (sql) => { try { return !!db.prepare(sql).get(); } catch { return false; } };
  // 162 leaves the row 163 deletes, so 163 has work whenever 162 does
  const due = DATA_MIGRATIONS.filter(m => isPending(m.id) && (hasWork(m.changes) || (m.id.startsWith("163") && isPending("162_no_admin_in_users") && hasWork(DATA_MIGRATIONS[0].changes))));
  if (due.length) {   // a fresh database has nothing for them to change, so nothing to back up
    const label = `pre-${due.map(m => m.id.slice(0, 3)).join("-")}`;
    try {
      const b = createBackup(label);
      if (!b) throw new Error("the backup returned nothing");
      console.log(`[migrate] backup taken before ${due.map(m => m.id).join(", ")}`);
    } catch (e) {
      console.error(`[migrate] ⛔ ${due.map(m => m.id).join(", ")} HELD BACK — no backup could be taken first: ${e.message}`);
      for (const m of due) heldBack.add(m.id);
    }
  }
  try {
    migrationCount = applyPendingMigrations(db, MIGRATIONS, { hold: heldBack,
      onApplied: (m) => console.log(`[migrate] ✓ ${m.id}`),
    });
  } catch (e) {
    // Still fatal, and deliberately so: booting on a schema the code does not expect fails later,
    // further from the cause. What changed is that the failing migration left nothing behind, so a
    // fix and a restart resume from a real migration boundary.
    console.error(`[migrate] ✗ FAILED:`, e.message);
    process.exit(1);
  }
  console.log(`[boot] migrations complete (${migrationCount} applied)`);
  BOOT.note(`migrations (${migrationCount} applied)`, Date.now() - migrationsStartedAt);

// D126 + D127: every active posting gets its category (migration 207) — the rows from before it, and any a crawl wrote
// without one. NULL-only, so a no-op after the first boot; pure regex over titles, milliseconds.
// ⛔⛔ D151 Rule 1 (11-04): every board pass from here to the tracking sink is queued with BOOT.add and runs AFTER the
// listener binds, in this same order (the tags read the role map's bucket). On an 81k-posting copy they held the port
// for over a minute. /api/health/ready answers 503 until they have run, so no deploy takes traffic before them.
// ⛔ 44r (11-04, D151 / A123) · the startup / 03:00 cleanup's two expiry statements (scraped_at < cutoff AND …) were full
// scans of the board — 19 s + 26 s on the 82k copy, matching 0 rows — because nothing indexed scraped_at. With the index
// they are 3 ms. Built here, after listen, once (29 s on the 82k copy; IF NOT EXISTS is instant after).
BOOT.add("index: scraped_jobs.scraped_at", () => {
  db.exec("CREATE INDEX IF NOT EXISTS idx_scraped_jobs_scraped_at ON scraped_jobs(scraped_at)");
});
// ⛔ A123 (9) (11-05) · job_role_map's "active postings with no bucket" read (backfillRoleMap UNMAPPED_SQL, ORDER BY
// job_id) scanned the job_id key and fetched EVERY row to test is_active — which sits after `description`, so on a cold
// volume it read all 83,623 rows' overflow chains to find nothing: 36.2 s / 36.4 s of production's last two boots. With
// (job_id, is_active) the scan reads the index alone and touches the table only for an unmapped row (10.5 s → 142 ms on
// the 82k copy; the 'general' re-file's read 10.8 s → 2.6 s). ⚠ NOT (is_active, job_id): with it the planner moved the
// category backfill (is_active = 1 AND board_category IS NULL) off its board_category index (3 ms → 513 ms warm, a
// whole-table read cold) — an active-row filter with a sharper index of its own must keep it. Built here, after listen,
// for the scraped_at index's reason: the build reads every row once (≈ the cold read it replaces, on one boot only);
// IF NOT EXISTS is instant after.
BOOT.add("index: scraped_jobs (job_id, is_active)", () => {
  db.exec(`CREATE INDEX IF NOT EXISTS ${ACTIVE_JOB_INDEX} ON scraped_jobs(job_id, is_active)`);
});
// ⛔⛔ D153 (3) (11-05) · THE CATEGORY BACKFILL IS A BACKGROUND JOB, AFTER READY. It was a warm-up step here: ONE
// statement + ONE transaction over every active posting with no category (LIMIT 100k) — whole-board work on the event
// loop at A112's 80k board, and a deploy's ready waited for it. services/jobs/classifyBacklog.js walks the board in
// rowid pages of 500 with a setImmediate yield between pages, writes D127's category where it is missing AND the kind
// of work (tag_function) where the role bucket named none ('general' — 82 % of the owner's 11-04 board said "no kind of
// work on file"), never for a held posting (D127's leak rule). Idempotent (conditional writes); the walk's state and the
// coverage it measured are in /api/version (`classify`). New postings are classified at ingest (aggregator → the
// category; jobTags.deriveTags → the kind of work, the same rule), and the walk runs again every 6 hours for rows other
// writers left behind.
// Started from the listen callback, on the warm-up's ready (running the warm-up here would start it before the port
// is bound).
// ⚠ This line sits inside the migration runner's bare { … } block: assign the module-level `let` (declared above the
// block) — a `const` here was block-scoped, and the listen callback and /api/version threw "classifyBacklog is not
// defined" (found by the 44z boot smoke; the wiring test read the source, not a booted server).
classifyBacklog = createClassifyBacklog(db);
setInterval(() => classifyBacklog.run("interval"), 6 * 60 * 60 * 1000).unref();

// Populate migration 078's automation_tier for rows written before it existed. This is here
// rather than inside the migration because the derivation is JavaScript
// (services/jobs/automationTier.js) and re-expressing it as a SQL CASE would create the second
// copy of the mapping the stored column exists to avoid.
//
// NULL-only by default, so it is a no-op on every boot after the first and costs one indexed
// scan. It does NOT re-derive existing values: a mapping change needs
// `node scripts/recomputeAutomationTier.js --all`, which is the documented admin action, because
// silently rewriting stored tiers on every restart would hide when the mapping moved.
//
// Never fatal. A board whose tiers are NULL still works — jobQuery.js reads NULL as 'unknown' in
// both directions of the tier filter — so failing the boot over it would trade a degraded label
// for an outage.
BOOT.add("automation tier", () => { try {
  const tierFill = backfillAutomationTier(db);
  if (tierFill.updated > 0) {
    console.log(`[boot] automation_tier backfilled: ${tierFill.updated} of ${tierFill.scanned} rows ` +
      `(${Object.entries(tierFill.byTier).map(([t, n]) => `${t}=${n}`).join(" ")})`);
  }
} catch (e) {
  console.error("[boot] automation_tier backfill failed (board falls back to 'unknown'):", e.message);
} });

// ── D84 F2 · enrichment provenance backfill ────────────────────────────────────────────────────────
// Every row with no provenance map gets one by DETECTION (a summary equal to the first 300 characters, a
// lowercased title, the title's guessed level — each a crawler placeholder the import may replace; an import
// batch's own record wins over every rule). NULL-only and bounded, so a no-op after the first boot. A guessed
// level is re-derived with the shared mapping (Staff / Principal were stored as `senior`). Never fatal: without
// a map the importer detects the same thing per row at plan time.
// ⛔ A123 (8) (11-05) · A ROWID WALK FROM A HIGH-WATER MARK, 500 rows a slice, a 50 ms yield between slices: the
// NULL-only statement had no index and read every row's overflow chain to find nothing — 18.7 s of the 66297c3 boot's
// 44.4 s to ready (production, 11-05). The warm-up runs the first slice; the rest run after it. A settled board starts
// at its mark, so a boot reads only the rows inserted since the last one (enrichmentProvenance.backfillProvenanceSlice).
const PROVENANCE_SLICE_ROWS = 500;
BOOT.add("enrichment provenance", () => {
  const slice = () => { try {
    const provFill = backfillProvenanceSlice(db, { rows: PROVENANCE_SLICE_ROWS });
    if (provFill.written > 0) {
      console.log(`[boot] enrichment provenance backfilled: ${provFill.written} row(s) in rowid ${provFill.from}–${provFill.to}, ` +
        `${provFill.placeholders} crawler placeholder value(s) found, ${provFill.remappedLevels} guessed level(s) re-mapped`);
    }
    if (!provFill.done) setTimeout(slice, 50).unref();
  } catch (e) {
    console.error("[boot] enrichment provenance backfill failed (the importer detects per row instead):", e.message);
  } };
  slice();
});

// ── job_role_map backfill (CC1b's follow-up) ────────────────────────────────────────────────────
//
// Same shape and the same reasoning as automation_tier above: a derived value that some rows never
// got, re-derived at boot through the SAME function the ingest writer uses, and a no-op once every
// active posting carries a bucket.
//
// WHY IT HAS TO RUN HERE AND NOT ONLY IN THE SCRIPT. scripts/backfillJobRoleMap.mjs runs against
// whatever database the operator can reach, which is a laptop's. Production's lives inside the
// deployment and no script on a developer machine can touch it — so without a boot hook the fix
// would be permanently local, which is how the rows got into this state in the first place (a
// restore path that nobody re-ran anywhere else).
//
// ⛔ AND IT CHANGES WHAT USERS SEE, WHICH NOTHING ELSE IN THIS BLOCK DOES. automation_tier fills in
// a LABEL. This changes BOARD MEMBERSHIP: a posting nobody had classified appears on every
// profile's board under CC1b's soft-null, and once it is bucketed it appears only on its own. The
// local run moved the owner-shaped engineering board 849 -> 655. That is the intended correction —
// the rows that left were sales and PM roles that were only ever there because they were
// unclassified — but it is not a silent kind of change, so:
//
//   · it LOGS, with the bucket breakdown, whenever it does anything at all;
//   · it logs how to undo itself, because 277 rows appearing in a scoping table with no way to
//     tell them from the crawler's is how a backfill becomes permanent by accident;
//   · ROLE_MAP_BACKFILL=off disables it, which automation_tier has no need of. An operator who
//     sees a board change after a deploy needs a way to stop it that does not require a revert.
//
// Never fatal, for automation_tier's reason: an unbucketed board still works — CC1b's soft-null
// predicate keeps those rows visible — so failing the boot over this would trade a scoping
// imprecision for an outage.
//
// COST: 0.163 ms/row measured over 2,460 real postings, so even a whole unbucketed board is ~0.4 s
// once, and nothing on every boot after.
if (String(process.env.ROLE_MAP_BACKFILL || "").toLowerCase() === "off") {
  console.log("[boot] job_role_map backfill: DISABLED by ROLE_MAP_BACKFILL=off");
} else BOOT.add("job_role_map", () => {
  try {
    const roleFill = backfillRoleMap(db);
    if (roleFill.inserted > 0) {
      console.log(`[boot] job_role_map backfilled: ${roleFill.inserted} of ${roleFill.scanned} `
        + `unbucketed posting(s) classified `
        + `(${Object.entries(roleFill.byBucket).sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k}=${n}`).join(" ")})`);
      console.log(`[boot] job_role_map backfill is reversible: `
        + `DELETE FROM job_role_map WHERE matched_by LIKE 'backfill_classifier%';`);
    }
    // Loud, because "left unmapped" means a blue-collar posting is sitting on the board and will
    // stay on EVERY profile's board until somebody ejects it. Deliberately not ejected here.
    if (roleFill.skippedBlue > 0) {
      console.warn(`[boot] job_role_map backfill: ${roleFill.skippedBlue} blue-collar posting(s) `
        + `left unmapped — they remain visible on every board. See scripts/reclassifyJobs.js.`);
    }
  } catch (e) {
    console.error("[boot] job_role_map backfill failed (unbucketed rows stay visible everywhere):", e.message);
  }
  // D74: a stored posting the old anchors filed under 'general' (invisible on every board) is re-filed
  // when the classifier now names its family. Classifier rows only; reversible by its matched_by.
  try {
    const remap = remapGeneralRows(db, { skipIfSettled: true });   // 44r: skipped while the classifier is unchanged
    if (remap.moved > 0) {
      console.log(`[boot] job_role_map: re-filed ${remap.moved} of ${remap.scanned} 'general' posting(s) `
        + `(${Object.entries(remap.byBucket).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(" ")}); `
        + `reversible: matched_by = '${REMAP_MATCHED_BY}'`);
    }
  } catch (e) {
    console.error("[boot] job_role_map 'general' re-file failed (those rows stay in 'general'):", e.message);
  }
});

// ── D29 · the board's own tags (services/jobs/jobTags.js) ───────────────────────────────────────
//
// Every filter on the board reads these, so they are derived here at boot, after the role map
// (job_function reads its bucket), and again every 10 minutes for whatever a crawl wrote or changed
// since. Deterministic and local — no model call (D17) — and idempotent: an unchanged posting is
// skipped on its tag_basis, so a pass over a settled board writes nothing.
//
// Never fatal: an untagged row is NULL on every tag, which every board predicate reads as UNKNOWN
// and keeps (soft-null). Failing the boot over it would trade precision for an outage.
//
// ⛔ 44p (11-04) · IN SLICES THAT YIELD. At 81k postings one pass of 2,000 descriptions + 1,000 levels
// (≈ 3.5 ms a level) held the event loop for seconds every 10 minutes, with the Atlas drain on top
// (11-02 19:02Z: every request stalled). A slice is 200 descriptions + 100 levels; the next slice runs
// 50 ms later while the last one found work, up to 10 slices a pass — the same 2,000 / 1,000 (until A123 (8) below).
// ⛔ A123 (8) (11-05) · A PASS WALKS THE BOARD IN ROWID RANGES. On a settled board nothing is stale, so the tag and
// level scans never reached their limits and each slice read every active row (is_active and the bases sit after
// `description`, so every row's overflow chain): the first slice was 22.5 s of the 66297c3 boot (production, 11-05),
// and the same pass held the loop every 10 minutes. Now a slice reads JOB_TAG_SLICE_ROWS consecutive rowids, a 50 ms
// yield between slices; a range whose tag or level limit was reached is read again (the rest of its stale rows) before
// the walk moves on, at most JOB_TAG_RANGE_REPEATS times. One walk at a time: an interval that finds one running skips.
// ⛔ D151 Rule 3 (11-08, measured on the 100k fixture with a main-thread profile): a slice of 200 tags + 100 levels held
// the loop ≈ 0.5 s (readLevel ≈ 3.5 ms a posting — 816 ms of a 4 s profile, the tag walk 1.5 s), five times the 100 ms
// slice budget (D151 Rule 5), and a board load waited behind it. A slice is now ≈ 50 ms of work: 50 tags + 15 levels;
// a range is re-read up to 60 times (was 10), so a backlog still clears in the same walk — in more, shorter slices.
const JOB_TAG_SLICE_ROWS = 500;
const JOB_TAG_SLICE_TAGS = 50;
const JOB_TAG_SLICE_LEVELS = 15;
const JOB_TAG_RANGE_REPEATS = 60;
let jobTagWalk = null;
function runJobTagPassSliced(trigger) {
  if (jobTagWalk) return;
  jobTagWalk = { trigger, from: 0, first: true, repeats: 0 };
  runJobTagWalkSlice();
}
function runJobTagWalkSlice() {
  const w = jobTagWalk;
  let next = null;
  try {
    const range = nextRowidRange(db, w.from, JOB_TAG_SLICE_ROWS);
    const r = runJobTagPass(w.trigger, { descriptions: w.first, range });
    const again = r.full && w.repeats < JOB_TAG_RANGE_REPEATS;
    w.repeats = again ? w.repeats + 1 : 0;
    next = again ? w.from : (range.more ? range.to : null);
  } catch (e) { console.error(`[tags] (${w.trigger}) slice failed:`, e.message); }
  w.first = false;
  if (next == null) { jobTagWalk = null; return; }
  w.from = next;
  setTimeout(runJobTagWalkSlice, 50).unref();
}
function runJobTagPass(trigger, { descriptions = true, range = null } = {}) {
  let full = false;   // a limit was reached: the range may hold more stale rows
  let worked = false;
  // ⛔ D59 · the description pass first — the tags read its label fields (workstyle, location). Writes
  // only description_text / description_fields / req_* (never description or content_hash), at most
  // 500 rows a pass, so a large board fills over a few passes. Migration 137's trigger re-queues a
  // posting whose description changed. 44p: the FIRST slice only — its stale scan over the whole board
  // (≈ 4 s at 81k) is the cost, not the rows, so slicing it would pay the scan ten times.
  if (descriptions) try {
    const d = backfillDescriptionText(db, { dryRun: false, limit: 500, ceiling: 500 });
    if (d.written > 0) worked = true;
    if (d.written > 0) console.log(`[description] (${trigger}) normalised ${d.written} of ${d.due} posting(s) — ${d.changedText} with new text, ${d.withFields} with a label block`);
  } catch (e) {
    console.error(`[description] (${trigger}) normalising failed (readers fall back to the stored description):`, e.message);
  }
  try {
    const r = tagStaleJobs(db, { limit: JOB_TAG_SLICE_TAGS, range });
    if (r.tagged > 0) worked = true;
    if (r.tagged >= JOB_TAG_SLICE_TAGS) full = true;
    if (r.tagged > 0) console.log(`[tags] (${trigger}) tagged ${r.tagged} of ${r.scanned} posting(s)`);
  } catch (e) {
    console.error(`[tags] (${trigger}) tagging failed (untagged rows read as unknown and stay visible):`, e.message);
  }
  try {
    const l = readStaleLevels(db, { limit: JOB_TAG_SLICE_LEVELS, range });
    if (l.read > 0) { worked = true; console.log(`[level] (${trigger}) read the asked level of ${l.read} of ${l.scanned} posting(s)`); }
    if (l.read >= JOB_TAG_SLICE_LEVELS) full = true;
  } catch (e) {
    console.error(`[level] (${trigger}) reading levels failed (an unread posting has no level line):`, e.message);
  }
  return { worked, full };
}
BOOT.add("job tags (first slice)", () => runJobTagPassSliced("boot"));
// ⛔ 44r · migration 219's one-time catch-up (descriptionText.sweepStaleDescriptionBasis): 1,000 rows a slice, a 50 ms
// yield between slices, started after the warm-up so it never holds a deploy's ready. Resumable across restarts.
function runDescriptionBasisSweep() {
  try {
    const r = sweepStaleDescriptionBasis(db, { rows: 1000 });
    if (r.reset > 0) console.log(`[description] basis sweep: ${r.reset} posting(s) changed since their last read, rowid ${r.from}–${r.to}; re-read by the next pass`);
    if (r.done) { if (r.from != null) console.log("[description] basis sweep: done"); return; }
  } catch (e) { console.error("[description] basis sweep failed (the next boot resumes it):", e.message); return; }
  setTimeout(runDescriptionBasisSweep, 50).unref();
}
setTimeout(runDescriptionBasisSweep, 120 * 1000).unref();
setInterval(() => runJobTagPassSliced("interval"), 10 * 60 * 1000).unref();

// ── ATS term weights: say what state they are in, then fix it if it needs fixing ────────────────
//
// ⛔ THE STATE THIS EXISTS TO MAKE VISIBLE WAS PRODUCTION'S ACTUAL STATE. `ats_term_weights` was
// EMPTY there — never computed, not once — so every ATS score the product has ever served was
// computed unweighted. Nothing said so: the only warning in the codebase required
// `loaded.weights.size` to be non-zero, so an empty table was silent by construction. Measured
// cost of unweighted scoring against this board: 20.4% of scores differ by up to 5 points, 2.8%
// land in a different band, and rho against the owner's own grades falls 0.476 -> 0.415.
//
// So the status line below prints on EVERY boot, including the healthy case. "Weighted scoring is
// on" is exactly the fact nobody could establish, and a log that only speaks up when something is
// wrong cannot answer it. /api/version carries the same status for the same reason.
//
// The refresh is idempotent and costs 60 ms over 881 enriched postings, measured — which is what
// makes doing it at boot reasonable rather than merely convenient.
try {
  const before = atsWeightStatus(db);
  console.log(`[boot] ats_term_weights: ${before.state}`
    + (before.state === "absent"
        ? " — NEVER COMPUTED; every score is unweighted until this is fixed"
        : ` — ${before.terms} terms over ${before.families.length} famil${before.families.length === 1 ? "y" : "ies"}, `
          + `${before.ageDays?.toFixed(1)}d old (refresh at ${REFRESH_WEIGHT_AGE_DAYS}d, refused at ${MAX_WEIGHT_AGE_DAYS}d)`
          // ⭐ D170 (3b): "fresh" at 34 days read as healthy for 20 days; past the refresh age it says so.
          + (before.overdue ? ` — ⚠ OVERDUE: ${(before.ageDays - REFRESH_WEIGHT_AGE_DAYS).toFixed(1)}d past the refresh, `
              + `dropped in ${Math.max(0, MAX_WEIGHT_AGE_DAYS - before.ageDays).toFixed(1)}d` : "")));
  // A failing refresh is silent by construction — it is never-fatal on purpose — so the streak is
  // printed at boot rather than left for whoever thinks to curl /api/version. Nothing is printed
  // in the healthy case: this line is the exception to the "speak even when fine" rule above,
  // because "0 consecutive failures" on every boot forever is how a warning stops being read.
  const health = termWeightRefreshHealth();
  if (health.consecutiveFailures > 0) {
    console.error(`[boot] ⛔ ats_term_weights REFRESH HAS FAILED ${health.consecutiveFailures}x IN A ROW`
      + ` (${health.failuresBeforeCliff} reaches the ${MAX_WEIGHT_AGE_DAYS}d refusal, after which every`
      + ` score is unweighted). Last error: ${health.lastRun?.error ?? "unknown"}`);
  }
  // ⛔ DEFERRED ONE TICK, AND NOT FOR LATENCY. This block runs during module evaluation, ~2,200
  // lines before `_atsWeightCache` is declared — and `runTermWeightRefresh` clears that cache, so
  // calling it here throws "Cannot access '_atsWeightCache' before initialization". The
  // never-fatal wrapper caught it and the boot survived, which is precisely how a refresh that
  // never runs would have gone unnoticed. setImmediate runs after the module finishes evaluating,
  // when every declaration below exists.
  // ⛔ 44r (11-04) · NOT ON EVERY DEPLOY. A volume-backed Railway service never overlaps its old and new
  // containers, so the boot's synchronous work is an outage: the 20:31Z deploy held the loop ≈ 18 s here
  // (a recompute over 84k postings, refused for a thin corpus) with nothing else serving. The nightly cron
  // runs this same refresh; the boot only runs it when no attempt (ok, refused or failed) is on record in
  // the last 24 h — a fresh database, or a cron that has stopped.
  setImmediate(() => {
    if (termWeightRefreshRanWithin(24 * 3600)) {
      console.log("[ats-weights] (boot) skipped — a refresh ran in the last 24 h (the nightly cron owns it)");
      return;
    }
    runTermWeightRefresh("boot");
  });
} catch (e) {
  console.error("[boot] ats_term_weights check failed (scoring continues, possibly unweighted):", e.message);
}

// Repair company_icon_url rows still pointing at a retired logo provider (TASK X). Same reasoning
// as the tier backfill above and never fatal for the same reason: a row whose logo URL is wrong
// renders CompanyIcon's lettered tile, so failing the boot over it would trade a missing image for
// an outage. Offline — no HEAD request — because a boot path that waits on a third party is a boot
// path that hangs when that third party is precisely what broke.
// ⛔ A123 (9) (11-05) · A ROWID WALK FROM A HIGH-WATER MARK, as the provenance step: the whole-column read
// (company_icon_url IS NOT NULL, no index, after `description`) was 3.2 s of every production boot and the next cold
// whole-table read once job_role_map's was gone. The warm-up runs the first slice; the rest run after it, 50 ms apart.
const LOGO_SLICE_ROWS = 500;
BOOT.add("company logo urls", () => {
  const slice = () => { try {
    const logoFill = backfillCompanyLogosSlice(db, { rows: LOGO_SLICE_ROWS });
    if (logoFill.updated > 0 || logoFill.cleared > 0) {
      console.log(`[boot] company_icon_url repaired: ${logoFill.updated} repointed, ` +
        `${logoFill.cleared} cleared to NULL, ${logoFill.kept} feed-supplied left untouched ` +
        `(of ${logoFill.scanned} scanned, rowid ${logoFill.from}–${logoFill.to})`);
    }
    if (!logoFill.done) setTimeout(slice, 50).unref();
  } catch (e) {
    console.error("[boot] company_icon_url backfill failed (board falls back to lettered tiles):", e.message);
  } };
  slice();
});

// A77 — resolve and STORE each company's logo (services/jobs/companyLogoStore.js). In the background,
// never at boot's expense: 20 s after start, then every 6 hours, 40 companies a pass. COMPANY_LOGOS=off
// turns it off (a throwaway or test server has no business fetching employers' homepages).
// ⛔ A provider with attempts and no success is NAMED in the log — the line that would have caught Clearbit.
async function runCompanyLogoPass(trigger) {
  try {
    const r = await resolveCompanyLogos(db, { limit: 40, read: readPool });   // A126: the company list off the loop
    if (r.scanned) console.log(`[logos] ${trigger}: ${r.ok} stored, ${r.none} without a logo (of ${r.scanned}); providers ${JSON.stringify(r.providers)}`);
    if (r.dead.length) console.error(`[logos] ⛔ provider(s) with attempts and NO success: ${r.dead.join(", ")} — check scripts/a77LogoProvidersLive.mjs`);
  } catch (e) {
    console.error(`[logos] ${trigger} pass failed (cards keep their letters):`, e.message);
  }
}
if (process.env.COMPANY_LOGOS !== "off") {
  setTimeout(() => runCompanyLogoPass("boot"), 20_000).unref?.();
  setInterval(() => runCompanyLogoPass("interval"), 6 * 3600_000).unref?.();
}

// Drain the out-of-process failure sink now that the database is known reachable. Anything the
// sink caught while it was NOT reachable is imported as source='sink_recovered', so coverage
// becomes complete again instead of permanently short by however many calls happened during the
// outage. Runs after migrations so the source column (077) exists; never fatal — a sink that
// cannot be drained is left in place for the next boot rather than discarded.
try {
  const drain = drainTrackingFailureSink(db);
  if (drain.drained || drain.failed || drain.corrupt) {
    console.warn(`[boot] tracking-failure sink drained: recovered=${drain.drained} ` +
      `failed=${drain.failed} corrupt=${drain.corrupt}` + (drain.error ? ` error=${drain.error}` : "") +
      " — these are model calls whose spend was NOT recorded at the time.");
  }
} catch (e) {
  console.error("[boot] tracking-failure sink drain failed:", e.message);
}
}

// The layered prompt system moved to the tools service in A4; draft loads no prompts.

// ── Backfill: split full_name into first_name / last_name ─────
{
  const rows = db.prepare("SELECT user_id, full_name FROM user_profile WHERE full_name IS NOT NULL AND first_name IS NULL").all();
  if (rows.length > 0) {
    const upd = db.prepare("UPDATE user_profile SET first_name=?, last_name=? WHERE user_id=?");
    db.transaction(() => {
      rows.forEach(r => {
        const parts = (r.full_name || "").trim().split(/\s+/);
        const first = parts[0] || "";
        const last  = parts.length > 1 ? parts[parts.length - 1] : "";
        upd.run(first, last, r.user_id);
      });
    })();
    console.log(`[backfill] Split full_name for ${rows.length} profiles`);
  }
}

// ── Seed admin user ───────────────────────────────────────────
// Cache cleanup — removes scraped_jobs older than 7 days, then re-warms if empty
function runCacheCleanup() {
  try {
    // ⛔ A49 fix 5 — this was a second, UNGUARDED expiry: a bare delete of every scraped_jobs row
    // whose scraped_at was past the cutoff, on a 24h setInterval from boot. It deleted
    // starred and APPLIED rows (which runExpiredJobsCleanup exempts), retired duplicates, and ran
    // with no blast-radius brake and no cleanup_log record — the cleanup_log id-85 shape, unlogged.
    // There is one expiry policy, and this now runs it.
    runExpiredJobsCleanup();
    const remaining = db.prepare("SELECT COUNT(*) as n FROM scraped_jobs WHERE is_active = 1").get()?.n || 0;
    if (remaining === 0) {
      console.log("[Cache] Empty after cleanup — re-warming from ATS...");
      cacheJobs(db, ANTHROPIC_KEY ? anthropic : null).then(n => console.log(`[Cache] Re-warm complete: ${n} jobs`))
                   .catch(e => console.error("[Cache] Re-warm failed:", e.message));
    }
  } catch (e) {
    console.error("[Cache cleanup]", e.message);
  }
}

// ── Anthropic ─────────────────────────────────────────────────
// Guard: if ANTHROPIC_KEY is missing, log a clear warning at startup
// (endpoints that call Anthropic will return 500 with a descriptive error)
// Declared here (before the ATS cache warm below) so cacheJobs() can pass it through for
// background job-description enrichment (services/jobs/enrichJob.js) at every call site.
if (!ANTHROPIC_KEY) {
  console.error("[startup] WARNING: ANTHROPIC_KEY is not set — the model calls draft still makes itself (cover letters, domain-chip suggestions) will fail. Résumé generation does not use it: it runs in the tools service (A88).");
}
// ⭐ T19 hardening: ANTHROPIC_WORKSPACE_ID, when set, puts the `anthropic-workspace-id` header on every request
// (services/modelKeyCheck.js) — a key that is not workspace-scoped is refused without it (10-15).
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY, defaultHeaders: workspaceHeaders(process.env) });
// A97 (10-14): which key pays. ANTHROPIC_KEY_LABEL is the key's NAME in the Console ("draft-prod",
// "local-dev"); the fp is 8 hex of the key's sha256 — the tools service logs the same pair, so two
// processes sharing one key (the T4 follow-up found draft, the tools service and the local .env did)
// show the same fp. Neither is secret; no part of the key is printed.
if (ANTHROPIC_KEY) {
  console.log(`[boot] model key: label=${process.env.ANTHROPIC_KEY_LABEL || "(unlabelled)"} fp=${crypto.createHash("sha256").update(ANTHROPIC_KEY).digest("hex").slice(0, 8)} workspace-header=${workspaceHeaders(process.env)["anthropic-workspace-id"] ? "on" : "off"}`);
  // D171 FIX 2 / O103: a production-labelled key on a process that is not production says so, loudly.
  const prodKeyWarning = prodKeyOutsideProduction(process.env);
  if (prodKeyWarning) console.error(prodKeyWarning);
}
// RESUME_MASTER_URL + RESUME_MASTER_TOKEN. Unset is a supported state: every route that needs the
// service answers 503 with retryable:false and says which setting is missing (see the client).
const toolsService = createToolsServiceClient();
console.log(`[boot] tools service client: ${toolsService.configured ? "configured" : "NOT configured (set RESUME_MASTER_URL and RESUME_MASTER_TOKEN) — generation and A+ will answer 503, PDF parsing degrades to local extraction"}`);
// The static registries, COUNTED, so "does production read them?" is one log line and not an
// inference. Until 09-29 they lived in data/, the runtime volume that hides image files; a 0 here
// means every title resolves to no role family and the ATS weights form for __global__ only.
console.log(`[boot] registries: ${roleAliasCount()} role aliases, ${qualificationKeyCount()} qualification keys`);

// ── PINNED-MODEL LIVENESS (task AD, requirement 2) ────────────────────────────────────────────
//
// Ask Anthropic whether the models we are pinned to still exist. This file's own history is
// the argument: a Haiku bump updated 8 of ~20 inline model literals and left Sonnet on
// `claude-sonnet-4-20250514`, which Anthropic retired on 2026-06-15 — every Sonnet call 404'd and
// four features degraded silently for about two months. Nothing asked, so nothing knew.
//
// ⛔ IT REFUSES TO START RATHER THAN SUBSTITUTING. A model picked for you is a model whose
// behaviour nobody checked; the last automatic replacement on this project returned HTTP 200 with
// an empty extraction 49 times in 50. See services/modelCatalogue.js.
//
// Deliberately NOT awaited: the probe is a network call and the server must not refuse to serve
// static pages because a catalogue endpoint was slow. It runs alongside boot and exits the process
// on a definite GONE verdict — which is the "refuse to start" the requirement asks for, a second
// later. An UNREACHABLE verdict warns and is not fatal: that is evidence about the network, not
// about the catalogue, and converting a blip into an outage is worse than the problem.
assertPinnedModelsLive({
  anthropic: ANTHROPIC_KEY ? anthropic : null,
  // D162: every model the task registry pins (defaults and fallbacks) — today Haiku and Sonnet, as before.
  anthropicModels: pinnedModelIds(),
}).catch(err => {
  if (err?.code === "PINNED_MODEL_GONE") {
    console.error("\n" + err.message + "\n");
    process.exit(1);
  }
  console.error("[models] liveness check itself failed (not fatal):", err?.message || err);
});

// Warm job cache from ATS sources (non-blocking — runs after server starts)
{
  const scraped = db.prepare("SELECT COUNT(*) as n FROM scraped_jobs WHERE is_active = 1").get()?.n || 0;
  if (scraped === 0) {
    console.log("[boot] scraped_jobs empty — warming ATS cache...");
    cacheJobs(db, ANTHROPIC_KEY ? anthropic : null).then(n => {
      console.log(`[boot] ATS cache warm complete: ${n} jobs cached`);
    }).catch(err => {
      console.error("[boot] ATS cache warm failed:", err.message);
    });
  } else {
    console.log(`[boot] scraped_jobs: ${scraped} rows already cached`);
  }
  // Schedule daily cleanup
  setInterval(runCacheCleanup, 24 * 60 * 60 * 1000);
}

// ⛔ D53 · THE BIN'S PURGE IS A MECHANISM: every 6 hours, a REAL pass (dryRun:false) with the ceiling —
// it refuses past PURGE_CEILING and logs every pass to cleanup_log. The read-time filter already hides an
// expired item, so a late sweep is a delay in scrubbing, never an item shown past its date.
function runDraftBinPurge(trigger) {
  try {
    const out = purgeSweep(db, { dryRun: false });
    if (out.refused) console.warn(`[draft-bin] ${trigger}: REFUSED — ${out.due} due, over the ceiling; nothing purged`);
    else if (out.purged) console.log(`[draft-bin] ${trigger}: purged ${out.purged} cleared item(s) past their 7 days`);
  } catch (e) { console.warn(`[draft-bin] ${trigger}: ${e.message}`); }
}
setTimeout(() => runDraftBinPurge("boot"), 60_000).unref?.();
setInterval(() => runDraftBinPurge("interval"), 6 * 3600_000).unref?.();
// ⭐ D112 c2 · a PENDING row nobody acted on for 14 days MOVES to Not applied — an UPDATE of its state, never
// a delete (services/applicationRecords.js movePendingExpired). Every read of Pending, The Table and /d moves
// the reader's own rows first, so this sweep only keeps rows nobody is looking at honest.
function runPendingMoveSweep(trigger) {
  try {
    const n = movePendingExpired(db);
    if (n) console.log(`[pending-move] ${trigger}: moved ${n} pending row(s) past 14 days to Not applied`);
  } catch (e) { console.warn(`[pending-move] ${trigger}: ${e.message}`); }
}
setTimeout(() => runPendingMoveSweep("boot"), 60_000).unref?.();
setInterval(() => runPendingMoveSweep("interval"), 6 * 3600_000).unref?.();
// D55 decision E: a form report is kept 30 days, then deleted — here as well as on every new report.
function runFormReportPurge(trigger) {
  try {
    const n = purgeExpiredFormReports(db);
    if (n) console.log(`[form-reports] ${trigger}: purged ${n} report(s) past their 30 days`);
  } catch (e) { console.warn(`[form-reports] ${trigger}: ${e.message}`); }
}
setTimeout(() => runFormReportPurge("boot"), 60_000).unref?.();
// D88 P3: a ticket solved more than 24 months ago is deleted with its thread (services/tickets.js).
setInterval(() => { try { const n = purgeSolvedTickets(db); if (n) console.log(`[tickets] purged ${n} solved ticket(s) past 24 months`); } catch (e) { console.warn("[tickets] purge:", e.message); } }, 24 * 3600_000).unref?.();
setInterval(() => runFormReportPurge("interval"), 6 * 3600_000).unref?.();
// D86 compliance: a finished brief's résumé copy is emptied a day later; the audit is kept 12 months (services/byom/policy.js).
setInterval(() => { try { const n = purgeByomData(db); if (n.briefs || n.audit) console.log(`[byom] emptied ${n.briefs} finished brief(s), deleted ${n.audit} audit row(s) past 12 months`); } catch (e) { console.warn("[byom] purge:", e.message); } }, 6 * 3600_000).unref?.();

// ⭐ D57 · A CONVENIENCE COPY EXPIRES. A generated résumé not tied to a Draft or an application is kept
// RESUME_RETENTION_DAYS (90) from its latest generation — the date Settings shows on it — and then
// deleted; a tied one is kept for good. Daily, with the same refusal shape as the bin: a pass that would
// delete more than half of all stored résumés (and more than 20) deletes nothing and says so.
function runResumeRetentionSweep(trigger) {
  try {
    const out = sweepExpiredResumes(db, { days: resumeRetentionDays() });
    if (out.refused) console.warn(`[resume-retention] ${trigger}: REFUSED — ${out.due} of ${out.total} due; nothing deleted`);
    else if (out.swept.length) console.log(`[resume-retention] ${trigger}: deleted ${out.swept.length} résumé(s) older than ${out.days} days with no Draft or application`);
  } catch (e) { console.warn(`[resume-retention] ${trigger}: ${e.message}`); }
}
setTimeout(() => runResumeRetentionSweep("boot"), 90_000).unref?.();
setInterval(() => runResumeRetentionSweep("interval"), 24 * 3600_000).unref?.();

// ⛔ D95 break glass (i): ADMIN_OWNER_EMAIL names the owner's ADMIN ACCOUNT; boot makes sure it exists (no password —
// a sign-in link sets one). ⛔ Phase 2 (10-13): the legacy ADMIN_USER / ADMIN_PASSWORD bootstrap into `users` is gone —
// an admin is never a users row (migration 162 makes the database refuse one), and its "admin" / "changeme" default
// was a standing hazard. A server with no admin account is set up with ADMIN_OWNER_EMAIL.
ensureOwnerAdmin(db, process.env.ADMIN_OWNER_EMAIL);

// PRICING lives in shared/anthropicModels.js — see that file to update per-token costs.
// This module used to carry its own ANTHROPIC_PRICING table plus a calculateCost() that had
// ZERO callers: the live cost path is services/usageTracker.js. Two tables that nothing kept
// in sync is how the Haiku entry ended up holding Haiku 3.5's prices, so the dead copy is gone
// rather than duplicated a third time.
//
// Historical cost calculations still use the price at insert time (stored in
// usage_events.cost_usd), so changing pricing does not retroactively alter past records.

// ── Multer ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  preservePath: true,
});

// ATS_SYSTEM_PROMPT (the model-scored ATS) was deleted under D17 (A80 V2): its last caller,
// /api/standalone/generate, now scores with the deterministic scorer like everything else.

// ── Helpers (extracted to services/jobNormalization.js) ───────
// inferWorkType, jobHash, normaliseItem, isFullTimeNorm,
// isEmploymentTypeWanted, parseYearsExperience, ghostJobScoreNorm,
// isReposted are now imported from services/jobNormalization.js

// encryptCookies/decryptCookies were defined here over the key above. They are SECRET_BOX now
// (services/secretBox.js); decrypt had no caller then and has none now.

// classifyJob (the `classify_job` model call) was deleted under D17 (A80 V7): it had no caller.
// Ingest classifies with the deterministic services/jobs/classifyJob.js.

// ── Job expiry cleanup — runs at startup and daily at 03:00 ──────
// Extracts into a named function so it can be called at startup (to
// catch any window missed if the server was down during the cron time)
// and also scheduled daily.
// ⛔ 44r (11-04, D151 / A123 (4)) · at BOOT the two whole-board rollups run only when they have not run in the last 20 h.
// They held production's 20:31Z boot ≈ 8 s with nothing else serving (a volume-backed Railway service never overlaps its
// deploys), and the cron runs both after every crawl and at 03:00. The deletes below are bounded and stay.
const ROLLUP_AT_KEY = "d151_history_rollup_at";
function rollupsRanWithin(seconds) {
  try {
    const v = Number(db.prepare("SELECT value FROM app_settings WHERE key = ?").get(ROLLUP_AT_KEY)?.value);
    return Number.isFinite(v) && v >= Math.floor(Date.now() / 1000) - seconds;
  } catch { return false; }
}
function markRollupsRan() {
  try {
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(ROLLUP_AT_KEY, String(Math.floor(Date.now() / 1000)));
  } catch { /* the next boot runs them again, as before */ }
}
let cleanupRunsThisProcess = 0;   // the first run in a process is the startup one (its BOOT.add step)
function runExpiredJobsCleanup() {
  const cutoff = Math.floor(Date.now()/1000) - 7*24*60*60;
  const startup = cleanupRunsThisProcess++ === 0;
  if (startup && rollupsRanWithin(20 * 3600)) {
    console.log("[job-history] cleanup (boot): history + ghost score skipped — they ran in the last 20 h");
  } else {
    // ⭐ D107: the history is written BEFORE anything is deleted — a deleted posting is the one a later repost points back to.
    try { const h = recordJobHistory(db); console.log(`[job-history] cleanup: ${h.seen} seen, ${h.closed} closed`); }
    catch (e) { console.warn("[job-history] cleanup:", e.message); }
    // ⭐ D137: the ghost score over that history (it never removes a row — closing is the cleanup's, below).
    try { const g = scoreGhosts(db); console.log(`[ghost-score] cleanup: ${g.scored} scored, ${g.notHiring} likely not hiring, ${g.changed} changed`); }
    catch (e) { console.warn("[ghost-score] cleanup:", e.message); }
    markRollupsRan();
  }

  // STARRED ROWS ARE RETIRED, NEVER REMOVED.
  //
  // This DELETE exempted `applied = 1` and nothing else, so a job the user had explicitly saved —
  // or imported, since importJob.js stars every import for its importer — was hard-deleted seven
  // days later, and the cascade below then took its user_jobs star with it. The row did not become
  // inactive, it stopped existing: no is_active flag to inspect, no record that it had ever been
  // there, and nothing for the Saved tab to show. Observed on the local board (cleanup_log id 34):
  // 35 jobs and 35 user_jobs rows gone in one pass.
  //
  // "I saved this" is at least as strong a statement of intent as "I applied to this", and the whole
  // point of saving a posting is that it is still there tomorrow. So a starred row expires as a
  // LISTING — is_active = 0, out of discovery, which is true, it has not been re-seen in seven days
  // — while the row itself survives.
  //
  // Deliberately NOT extended to the un-starred majority: that stays a hard DELETE. Retiring
  // everything would grow scraped_jobs without bound for no one's benefit, and the reason to keep a
  // row is that somebody asked for it.
  //
  // Applied rows are untouched by BOTH statements, exactly as before — they stay active and present.
  // ⛔ D43 (10-06): widened from STARRED to every row a user's record references — user_jobs of any
  // kind, job_applications, apply_run_jobs, application_records, a capture (services/jobs/
  // userReferences.js). Production held 4 + 4 orphaned records the narrower rule let through.
  const retiredStarred = db.prepare(`
    UPDATE scraped_jobs SET is_active = 0
    WHERE scraped_at < ? AND is_active = 1
      AND ${userReferencedSql("scraped_jobs.job_id")}
      AND job_id NOT IN (SELECT DISTINCT job_id FROM user_jobs WHERE applied = 1)
  `).run(cutoff);

  // Delete jobs older than 7 days based on when they entered our DB.
  // Applied and starred jobs are exempt — see above.
  //
  // The cascades below key off `job_id NOT IN (SELECT job_id FROM scraped_jobs)`, i.e. on the row
  // having actually gone. A retired-but-present row therefore keeps its job_role_map entry, its
  // star, its views and its resumes with no extra guard needed — which is the reason to retire it
  // rather than delete it.
  //
  // ⛔ COUNTED BEFORE IT IS RUN — see services/jobs/cleanupBrake.js. cleanup_log id 85 deleted 1288
  // of 1291 rows in one unattended startup pass and there was no point at which anything could have
  // objected, because the DELETE was the first thing that knew how big it was. The same predicate is
  // used for the count and for the statement, so the two cannot disagree.
  // ⛔ D43: a row any user's record references is NEVER deleted (it was retired above) — the applied
  // and starred exemptions this held are both inside userReferencedSql, with the rest beside them.
  const EXPIRED_PREDICATE = `
    scraped_at < ?
    AND NOT ${userReferencedSql("scraped_jobs.job_id")}
    AND NOT (duplicate_of IS NOT NULL
             AND duplicate_of IN (SELECT job_id FROM scraped_jobs))
  `;
  // ⛔ A49 fix 5 — A RETIRED DUPLICATE IS NOT EXPIRED. Dedup retires a row (is_active = 0,
  // duplicate_of, retired_reason — services/jobs/dedupRetire.js) and never refreshes its scraped_at,
  // so seven days later this DELETE took every one of them: a wrong merge became unrecoverable on a
  // timer. It stays, restorable, for as long as the row it was merged into exists; once that
  // canonical row is itself gone there is nothing left to restore it against, and it expires
  // with the ordinary rule on a later pass.
  const boardTotal = db.prepare("SELECT COUNT(*) c FROM scraped_jobs").get().c;
  const wouldDelete = db.prepare(`SELECT COUNT(*) c FROM scraped_jobs WHERE ${EXPIRED_PREDICATE}`).get(cutoff).c;
  const scope = assessCleanupScope({ total: boardTotal, deletable: wouldDelete, ...cleanupBrakeOptions() });

  let deletedJobs = { changes: 0 };
  let brakedRetired = 0;
  if (scope.allowed) {
    if (scope.reason) console.warn(`[cleanup] ${scope.reason}`);
    deletedJobs = db.prepare(`DELETE FROM scraped_jobs WHERE ${EXPIRED_PREDICATE}`).run(cutoff);
  } else {
    // NOT a silent skip. The rows still leave discovery — that part of the policy is correct and
    // unchanged — but the text survives, so the decision stays reversible by anyone who reads this.
    console.error(`[cleanup] ⛔ MASS DELETE REFUSED — ${scope.reason}`);
    brakedRetired = db.prepare(
      `UPDATE scraped_jobs SET is_active = 0 WHERE is_active = 1 AND ${EXPIRED_PREDICATE}`
    ).run(cutoff).changes;
    console.error(`[cleanup] retired ${brakedRetired} row(s) instead (is_active=0); ` +
                  `${wouldDelete} row(s) remain on the board and will be re-offered to the next pass.`);
  }
  // ⭐ D118 P1: the retired and deleted postings leave the Atlas's counts now (queued by the scraped_jobs triggers in
  // the statements above), not at the nightly recount.
  const atlasMoved = atlasPostingsChanged(db);
  if (atlasMoved?.postings) console.log(`[cleanup] atlas counts: ${atlasMoved.postings} posting(s) out, ${atlasMoved.changed} node count(s) moved`);

  // Cascade: remove orphaned user records for expired jobs (exempt applied rows)
  const deletedRoleMap = db.prepare(
    "DELETE FROM job_role_map WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs)"
  ).run();
  const deletedViews = db.prepare(
    "DELETE FROM user_job_views WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs)"
  ).run();
  const deletedUserJobs = db.prepare(
    "DELETE FROM user_jobs WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs) AND applied != 1"
  ).run();

  // Clean orphaned resumes/versions for expired jobs (preserve applied-job data)
  const deletedResumes = db.prepare(`
    DELETE FROM resumes
    WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs)
    AND job_id NOT IN (SELECT DISTINCT job_id FROM user_jobs WHERE applied = 1)
  `).run();
  const deletedVersions = db.prepare(`
    DELETE FROM resume_versions
    WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs)
    AND job_id NOT IN (SELECT DISTINCT job_id FROM user_jobs WHERE applied = 1)
  `).run();

  const orphans = deletedRoleMap.changes + deletedViews.changes + deletedUserJobs.changes
                + deletedResumes.changes + deletedVersions.changes;

  const details = JSON.stringify({
    jobRoleMap: deletedRoleMap.changes,
    resumes: deletedResumes.changes,
    resumeVersions: deletedVersions.changes,
    userJobs: deletedUserJobs.changes,
    userJobViews: deletedViews.changes,
    // Counted separately from jobs_deleted on purpose: these rows are still here. Folding them into
    // the delete count would report a removal that did not happen, and this log is the only record
    // of what a cleanup pass did.
    starredRetired: retiredStarred.changes,
    // ⛔ THE REFUSAL IS PART OF THE RECORD. cleanup_log id 85 is how the mass deletion was
    // eventually found at all; a pass that DECLINED to delete has to be just as findable, or the
    // next reader sees "jobs_deleted: 0" and concludes there was nothing to do.
    ...(scope.braked ? { brakedDeletable: wouldDelete, brakedBoardTotal: boardTotal, brakedRetired } : {}),
  });
  db.prepare(
    "INSERT INTO cleanup_log (jobs_deleted, orphans_cleaned, details) VALUES (?,?,?)"
  ).run(deletedJobs.changes, orphans, details);

  if (scope.braked) {
    console.warn(`[cleanup] REFUSED to expire ${wouldDelete} of ${boardTotal} jobs; retired ${brakedRetired} instead, ` +
                 `retired ${retiredStarred.changes} starred jobs, pruned ${orphans} orphaned rows`);
  } else {
    console.log(`[cleanup] Expired ${deletedJobs.changes} jobs (by DB age), retired ${retiredStarred.changes} starred jobs (kept, is_active=0), pruned ${orphans} orphaned rows`);
  }
}

// ── Cron: daily backup 02:00, re-scrape 07:00, cleanup 03:00 ──
cron.schedule("0 3 * * *", runExpiredJobsCleanup);
// ⛔ Owner 11-07 · the early-testing records the privacy page keeps 90 days are deleted after them (survey answers exempt).
cron.schedule("40 3 * * *", () => {
  try {
    const r = sweepTestingRecords(db);
    console.log(`[testing-records] swept before ${new Date(r.cutoff * 1000).toISOString().slice(0, 10)}: ${Object.entries(r.deleted).map(([t, n]) => `${t} ${n}`).join(" · ")} (survey answers kept)`);
  } catch (e) { console.error("[testing-records] sweep failed:", e.message); }
});
// ⛔ D175 FA2 · the FULL AUTO canary: each test account in Apply for me on a sample résumé (its sends go to draft's
// practice form, never an employer) — its last 36 h run read step by step; a red step is a line in pipeline health.
cron.schedule("20 12 * * *", () => {
  try { runCanaryCheck(db); } catch (e) { console.error("[canary] check failed:", e.message); }
});

// Refresh ATS job cache daily at 04:00 ET
cron.schedule("0 4 * * *", async () => {
  console.log('[Cron] Daily ATS cache refresh starting...');
  try {
    const count = await cacheJobs(db, ANTHROPIC_KEY ? anthropic : null);
    console.log('[Cron] Daily ATS cache refresh complete —', count, 'jobs cached');
  } catch(e) {
    console.error('[Cron] ATS cache refresh error:', e.message);
  }
  // ── The term-weight SCHEDULE, which is what this system never had ────────────────────────────
  //
  // Weights are document frequencies over the board, so they drift as the board does — and the
  // board just changed, two lines up. scripts/recomputeAtsTermWeights.js's header has always said
  // this "belongs beside the enrichment pass"; nothing ever put it there.
  //
  // ⛔ THE ONLY MECHANISM THAT EXISTED WAS A REFUSAL. MAX_WEIGHT_AGE_DAYS (45) makes the scorer
  // DROP weights it considers too old, which is a safety net and not a schedule: left alone, the
  // system degrades to unweighted and calls that safe. REFRESH_WEIGHT_AGE_DAYS (14) rebuilds well
  // before the cliff, so a single failed nightly run cannot reach it.
  //
  // Runs after the crawl rather than before, deliberately: weights computed from the corpus as it
  // was an hour ago describe a board that no longer exists.
  runTermWeightRefresh("cron");

  // ── Deliver the pipeline alerts to somebody ──────────────────────────────────────────────────
  //
  // ⛔ EVERY FAILURE THIS PIPELINE HAS HAD WAS ALREADY DETECTED. On 2026-09-18 the health check was
  // simultaneously and correctly reporting an Anthropic credit outage, Jobo's HTTP 402 wallet, two
  // sources fetching rows and writing none, and three companies silent for 234 hours — including an
  // alert that names its own history: "the last 2 enrichment runs wrote nothing — this is the shape
  // that ran for three days undetected". Nobody saw any of it, because it lives behind an admin
  // route that nothing polls. Detection without delivery is a diary.
  //
  // Runs LAST in the tick, after the crawl, the enrichment drain and the weight refresh, so it
  // reports on the night that just happened rather than the one before it.
  //
  // Edge-triggered — see services/jobs/alertDelivery.js. Most of these are STANDING conditions and
  // sending them nightly is the alarm nobody reads.
  deliverPipelineAlerts(db, {
    readHealth: () => adminDbRouter.pipelineHealth(),
    // The in-app channel the product already has. Admins only: these name providers and spend, and
    // a candidate has no use for "recruitee wrote 0 rows".
    notify: (summary, message, payload) => {
      for (const a of db.prepare("SELECT id FROM users WHERE is_admin = 1").all()) {
        insertNotification(a.id, "pipeline_alert", `${summary}\n${message}`, payload);
      }
    },
    webhookUrl: process.env.PIPELINE_ALERT_WEBHOOK || null,
  }).catch(e => console.error("[alerts] delivery threw:", e.message));
  // D78 C: Jobo's paid feed sync ran here, after the ATS refresh. Retired — we run our own crawls,
  // and production held 0 source='jobo' rows. 'jobo' survives only as filter/tier vocabulary.
  // ── The board's fit, brought up to date with what the crawl just added ─────────────────────
  //
  // After the crawl, so one pass covers every new posting. Incremental: each (user, active
  // profile) scores only the postings it has no fresh row for — on a quiet night that is the day's
  // arrivals, not the board. Sequential across users and yielding inside each, so it shares the
  // event loop with live requests rather than taking it. Its summary line says how many profiles
  // had nothing to do versus how many scored, so "0 scored" is never ambiguous.
  scheduleBoardFitForAll("crawl");
  // Company KB rollups (Tasks 9.5/9.7) — reuse this same cron tick, no new scheduler. Both are
  // read-only aggregations over scraped_jobs/its enrichment columns. ⛔ Nothing in this tick fills
  // org_unit_raw any more: the model enrichment pass that did (once fired inside cacheJobs and
  // the since-retired cacheJoboFeed) lost its triggers in A80 V4 and was deleted under D17 (A80, 10-05). The column
  // fills only through the manual export → import (routes/enrichment.js), so the org rollup sees
  // whatever has been imported as of now and picks up newly imported rows on the next day's run.
  try {
    runOrgLayerRollup(db);
  } catch(e) {
    console.error('[Cron] Org layer rollup error:', e.message);
  }
  try {
    runHiringSignalsRollup(db);
  } catch(e) {
    console.error('[Cron] Hiring signals rollup error:', e.message);
  }
  // ⭐ D107: after the crawl, so today's sightings and closings are in the history.
  try {
    const h = recordJobHistory(db);
    console.log(`[Cron] job history: ${h.seen} seen, ${h.closed} closed`);
  } catch(e) {
    console.error('[Cron] Job history rollup error:', e.message);
  }
  // ⭐ D137: the ghost score from the history just written; monthly, the "Likely not hiring" cut is checked on outcomes.
  try {
    const g = scoreGhosts(db);
    markRollupsRan();
    console.log(`[Cron] ghost score: ${g.scored} scored, ${g.uncertain} uncertain, ${g.notHiring} likely not hiring (cut ${g.notHiringMin}), ${g.changed} changed`);
    const c = calibrateGhostThreshold(db);
    if (c.ran) console.log(`[Cron] ghost calibration: ${c.measure.replied} of ${c.measure.withOutcomes} flagged postings replied — cut ${c.from}${c.raised ? ` → ${c.to}` : " (kept)"}`);
  } catch(e) {
    console.error('[Cron] Ghost score error:', e.message);
  }
  // ⭐ D136 P3: on the 1st of the month, best bets' weights are refit on real outcomes — only once 500 exist.
  if (new Date().getUTCDate() === 1) {
    try {
      const f = refitBestBets(db);
      console.log(f.ready ? `[Cron] best bets refit: ${f.outcomes} outcomes, held-out loss ${f.testLogLoss?.toFixed(3)} vs ${f.baselineLogLoss?.toFixed(3)} — ${f.used ? "used" : "not used"}`
        : `[Cron] best bets refit: ${f.outcomes} of ${f.needed} outcomes — signals only`);
    } catch(e) { console.error('[Cron] Best bets refit error:', e.message); }
  }
  // ⭐ D105 P3: the Atlas's "On the board" — every number computed from today's active postings, never typed.
  // ⭐ P9 (amended 10-31): the same pass rebuilds the 'board' edges; ⭐ P7: then the auto-publish bar is re-checked
  // (≥ 5 postings + a Wikipedia summary or a definition; a person's un-publish wins — services/atlas/atlasPublish.js).
  try {
    const a = computeAtlasStats(db);
    console.log(`[Cron] atlas stats: ${a.nodes} node(s) over ${a.postings} posting(s), ${a.boardEdges} board edge(s)`);
    // ⭐ D118 P1: the recount is the reconciliation of the live counts — what it corrected, as a number (0 = none missed).
    console.log(`[Cron] atlas drift: ${a.drift ? `${a.drift.drift} (${a.drift.rowsOff} row(s) off${a.drift.vocabChanged ? "; nodes or aliases changed since the last pass" : ""})` : "no live baseline before this pass"}`);
    const p = autoPublish(db);
    if (p.published.length) console.log(`[Cron] atlas auto-publish: ${p.published.length} page(s) published`);
  } catch(e) {
    console.error('[Cron] Atlas stats error:', e.message);
  }
}, { timezone: 'America/New_York' });
console.log('[Cron] Daily ATS cache refresh scheduled: 04:00 ET');

// ⭐ D105 P6 · the Atlas's dead-link checker (two consecutive failures → dead, hidden from the page) and the weekly
// Wikipedia summaries (nodes with a wiki_title — the curator's or an exact match; drafts too since 10-31). Polite: one request at a time, a pause,
// a User-Agent naming draft, a per-run cap. The curator's buttons in Admin → Data → Atlas run the same code now.
cron.schedule('30 5 * * *', async () => {
  try {
    const r = await checkAtlasLinks(db);
    if (!r.busy) console.log(`[Cron] atlas links: ${r.checked} checked, ${r.ok} ok, ${r.failing} failing, ${r.dead} dead (${r.newlyDead.length} new)`);
  } catch (e) { console.error('[Cron] Atlas link check error:', e.message); }
  // ⛔ D176-4: the learning-centre register's own links — monthly (runRegisterLinkCheck skips until 30 days have passed).
  try {
    const r = await runRegisterLinkCheck(db);
    if (r.ran) console.log(`[Cron] source register links: ${r.checked} checked, ${r.dead.length} dead${r.dead.length ? ` (${r.dead.join(", ")})` : ""}`);
  } catch (e) { console.error('[Cron] source register link check error:', e.message); }
  // ⭐ D117 C9: D115 P5's links too — a new one waits for its first check, a held one is tried again.
  try {
    const r = await checkExtraItems(db);
    if (r.checked) console.log(`[Cron] learn P5 links: ${r.checked} checked, ${r.live} live, ${r.held.length} held back`);
  } catch (e) { console.error('[Cron] learn P5 link check error:', e.message); }
  // ⭐ D119 P2: the thumbnails, with the dead-link check — each picture refreshed monthly, a capped, polite run a night.
  try {
    const r = await refreshThumbs(db, resourceItems(db));
    if (r.checked) console.log(`[Cron] thumbnails: ${r.checked} checked, ${r.ok || 0} stored, ${r.failed || 0} failed, ${r.none || 0} none`);
  } catch (e) { console.error('[Cron] thumbnails error:', e.message); }
  // ⭐ D105 P7/P8 (amended 10-31): Wikipedia titles (exact matches only) + Wikidata items → the official site / docs
  // from Wikidata → Wikipedia summaries (drafts too) → the auto-publish bar again, so tonight's summaries count tonight.
  try {
    const r = await runAtlasAutoPipeline(db);
    (r.ok ? console.log : console.error)(`[Cron] atlas auto: ${r.line}`);   // describeAutoRun — a failure is named, never "0 matched"
  } catch (e) { console.error('[Cron] Atlas auto-publish run error:', e.message); }
}, { timezone: 'America/New_York' });

cron.schedule("0 2 * * *", () => {
  try { createBackup("auto-daily"); }
  catch(e) { console.error("[backup-cron]", e.message); }
});

// The 07:00 daily re-scrape cron was removed here (§5.12). It picked what to re-crawl from the
// most recent `user_job_searches` row, and that table has ZERO writers anywhere in the repo —
// every remaining reference is its CREATE TABLE, two legacy migration backfills, one admin
// read-only view, and the cron's own SELECT. So `if (!last) return` fired on every single tick
// and the crawl could never run. Dead by data flow, not merely by absent callers, which is why
// it survived earlier caller-grep passes.
//
// `scrapeJobs` was KEPT for POST /api/admin/db/force-scrape, its one entry point. A58 (10-02) removed
// that route — it spent a USER'S OWN Apify token and nothing called it — and the follow-up (10-02, 18)
// deleted scrapeJobs, scrapeHarvestAPI and the helpers only they used. It could not have run anyway:
// `ApifyClient` was never imported here, so its first line was a ReferenceError. See
// docs/PIPELINE_DIAGNOSIS.md §5.12.

/// ── Prompt injection ──────────────────────────────────────────
// buildRuntimeInputs moved to the tools service in A4 (src/generation/runtimeInputs.js), byte-identical
// over 324 cases. draft maps its rows onto the request in services/toolsServiceRequests.js.

// ── PDF generation ─────────────────────────────────────────────
//
// CURRENT: @sparticuz/chromium + puppeteer-core
// Lightweight Chromium binary, single Railway service.
// Per-call RAM spike: ~70MB. Safe for low-to-medium traffic.
//
// ── FUTURE MIGRATION PATH → Gotenberg ─────────────────────────
// When scaling to SaaS (concurrent PDF exports, 100+ users):
// Gotenberg runs Chromium as a persistent Docker sidecar — zero
// per-call RAM spike, handles concurrency natively.
//
// Migration steps (when ready):
//   1. In Railway: "+ New Service" → Docker Image → gotenberg/gotenberg:8
//   2. Add env var to main service: GOTENBERG_URL=<railway internal URL>
//   3. npm uninstall @sparticuz/chromium puppeteer-core
//   4. npm install  (form-data is built into Node 18+ via FormData global)
//   5. Replace this entire function with:
//
//   async function htmlToPdf(html) {
//     const GOTENBERG_URL = process.env.GOTENBERG_URL;
//     if (!GOTENBERG_URL) throw new Error("GOTENBERG_URL not set");
//     const fullHtml = html.includes("<html") ? html
//       : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
//     const form = new FormData();
//     form.append("files", new Blob([fullHtml], { type:"text/html" }),
//       "index.html");
//     form.append("paperWidth",      "8.5");
//     form.append("paperHeight",     "11");
//     form.append("marginTop",       "0.5");
//     form.append("marginBottom",    "0.5");
//     form.append("marginLeft",      "0.5");
//     form.append("marginRight",     "0.5");
//     form.append("printBackground", "true");
//     const r = await fetch(
//       `${GOTENBERG_URL}/forms/chromium/convert/html`,
//       { method:"POST", body:form }
//     );
//     if (!r.ok) throw new Error(`Gotenberg: ${r.status} ${await r.text()}`);
//     return Buffer.from(await r.arrayBuffer());
//   }
//
//   6. Remove the chromium + puppeteer-core imports above
//   7. Delete this comment block
// ──────────────────────────────────────────────────────────────

async function htmlToPdf(html) {
  if (!html.trimStart().toLowerCase().startsWith("<!doctype")) {
    html = "<!DOCTYPE html>" + html;
  }
  // launchBrowser resolves the best available binary and applies container-safe args.
  // On failure it throws with a structured reasonCode (browser_runtime_missing_dependency, etc.)
  const browser = await launchBrowser({
    headless: true,
    viewport: { width:1240, height:1754 },
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:1240, height:1754 });
    // ⛔ e2e 11-05 (step 4): "load", not "networkidle0". What is printed here names nothing to fetch (the extension's
    // résumé is resumePreviewSanitiser's output — url(), @import, link and img removed — and the base PDF is our own
    // template), so there is no network to go idle; measured in real Chrome on the 18k copy, networkidle0 timed out at
    // 30 s on 8 of 17 renders (every tailored one) while the board was busy — every "Attach tailored" answered "The PDF could not be made" —
    // and "load" answered in 0.5–4.8 s. The font wait below is unchanged.
    await page.setContent(html, { waitUntil:"load", timeout:30000 });
    // Wait for fonts to settle
    await new Promise(r => setTimeout(r, 1500));
    const pdf = await page.pdf({
      format:           "Letter",
      printBackground:  true,
      preferCSSPageSize:false,
      margin: {
        top:    "0",
        bottom: "0",
        left:   "0",
        right:  "0",
      },
    });
    if (!pdf || pdf.length === 0) throw new Error("PDF generation produced empty output");
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Field normalisers (server-side, mirrors client normalisers) ──
function normalisePhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const local  = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return raw;
  return `+1 (${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}`;
}
function normaliseUrl(raw) {
  if (!raw) return "";
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("http://") || t.startsWith("https://") ? t : "https://" + t;
}

// ── Autofill payload builder ──────────────────────────────────
/**
 * @param {object} profile  the user_profile row
 * @param {string} mode     "APPLY" | "CUSTOM_SAMPLER"
 * @param {string=} company the employer this payload is for. OPTIONAL, and its absence is
 *   meaningful rather than a default: `{company}`-templated custom answers are DROPPED when the
 *   employer is unknown (the gate packet's profile-only case), because expanding a template
 *   against nothing would misstate the question that was asked. See services/customAnswers.js.
 */
// ⭐ D101 P2 / D104: every caller gets the payload with its eligibility, preference and self-ID values taken ONLY from the
// user's Application defaults (services/structuredProfile.js withApplicationDefaults) — a 0 column default is never an answer.
function buildAutofillPayload(profile, mode, company = null) {
  return withApplicationDefaults(db, profile?.user_id ?? null, buildAutofillPayloadFromProfile(profile, mode, company));
}
function buildAutofillPayloadFromProfile(profile, mode, company = null) {
  const loc   = mode==="CUSTOM_SAMPLER" ? "" : (profile?.location||"");
  const city  = mode==="CUSTOM_SAMPLER" ? "" : (profile?.city||loc.split(",")[0]?.trim()||"");
  const state = mode==="CUSTOM_SAMPLER" ? "" : (profile?.state||loc.split(",")[1]?.trim()||"");

  const phone       = normalisePhone(profile?.phone||"");
  const linkedinUrl = normaliseUrl(profile?.linkedin_url||"");
  const githubUrl   = normaliseUrl(profile?.github_url||"");

  const nameParts  = (profile?.full_name||"").trim().split(/\s+/).filter(Boolean);
  const firstName  = profile?.first_name  || nameParts[0] || "";
  const lastName   = profile?.last_name   || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
  const middleName = profile?.middle_name || (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
  const suffix     = profile?.name_suffix || "";

  return {
    full_name:profile?.full_name||"", email:profile?.email||"", phone,
    location:loc, linkedin_url:linkedinUrl, github_url:githubUrl,
    // The tri-state the resolver answers sponsorship questions FROM. The yes/no strings below are
    // kept for the extension's autofill payload and for non-sponsorship consumers, but buildAnswers
    // deliberately ignores them for sponsorship-class fields: a stored answer cannot be right for
    // both "do you require sponsorship now" and "now or in the future". See
    // docs/auto-apply-a5-live-run.md §4.1 and resolveSponsorshipNeed.
    sponsorship_need:resolveSponsorshipNeed(profile),
    requires_sponsorship:!!profile?.requires_sponsorship,
    has_clearance:!!profile?.has_clearance,
    clearance_level:profile?.clearance_level||"",
    visa_type:profile?.visa_type||"", work_auth:profile?.work_auth||"",
    field_map:{
      first_name:firstName, firstName, fname:firstName, given_name:firstName,
      last_name:lastName,   lastName,  lname:lastName,  family_name:lastName, surname:lastName,
      middle_name:middleName, middleName, middle:middleName,
      suffix, name_suffix:suffix, nameSuffix:suffix,
      name:profile?.full_name||"", fullName:profile?.full_name||"", full_name:profile?.full_name||"",
      email:profile?.email||"", email_address:profile?.email||"", emailAddress:profile?.email||"",
      phone, phone_number:phone, phoneNumber:phone, mobile:phone, telephone:phone,
      location:loc, city, state,
      zip:profile?.zip||"", zipCode:profile?.zip||"", postal_code:profile?.zip||"", postalCode:profile?.zip||"",
      country:profile?.country||"United States",
      address:profile?.address_line1||"", address_line1:profile?.address_line1||"", addressLine1:profile?.address_line1||"",
      address_line2:profile?.address_line2||"", addressLine2:profile?.address_line2||"",
      linkedin:linkedinUrl, linkedinUrl, linkedin_url:linkedinUrl, linkedin_profile:linkedinUrl,
      github:githubUrl, githubUrl, github_url:githubUrl,
      // No fallback to github/linkedin. A "Website" field receiving the candidate's GitHub — or
      // worse, their LinkedIn — is wrong information submitted to an employer, and it made this
      // field_map entry contradict handler_map's 'website', which was always strict. Since
      // handler_map is consulted first, the fallback only ever fired when website_url was EMPTY,
      // i.e. exactly when there was nothing true to say. Blank is the honest answer; the
      // completeness gate holds the run if the form requires it.
      website:normaliseUrl(profile?.website_url||""),
      portfolio:normaliseUrl(profile?.portfolio_url||""),
      gender:profile?.gender||"", ethnicity:profile?.ethnicity||"", race:profile?.ethnicity||"",
      veteran_status:profile?.veteran_status||"", veteranStatus:profile?.veteran_status||"",
      disability_status:profile?.disability_status||"", disabilityStatus:profile?.disability_status||"",
      visa_type:profile?.visa_type||"", visaType:profile?.visa_type||"",
      work_authorization:profile?.work_auth||"", workAuthorization:profile?.work_auth||"",
      requires_sponsorship:profile?.requires_sponsorship?"Yes":"No",
      sponsorship:profile?.requires_sponsorship?"Yes":"No",
      clearance_level:profile?.clearance_level||"", clearanceLevel:profile?.clearance_level||"",
      // D36: has_clearance is NOT NULL DEFAULT 0, and a 0 means "never ticked", not "holds none" — a
      // clearance question is left to the candidate (refused, held, asked once), never answered "No".
      has_clearance:profile?.has_clearance?"Yes":"",
      // New fields
      desired_salary:profile?.desired_salary ? String(profile.desired_salary) : "",
      available_start_date:profile?.available_start_date||"",
      willing_to_relocate:profile?.willing_to_relocate ? "Yes" : "No",
      highest_degree:profile?.highest_degree||"",
      field_of_study:profile?.field_of_study||"",
      university:profile?.university||"",
      graduation_year:profile?.graduation_year ? String(profile.graduation_year) : "",
      current_job_title:profile?.current_job_title||"",
      current_company:profile?.current_company||"",
      years_of_experience:profile?.years_of_experience ? String(profile.years_of_experience) : "",
    },
    handler_map:{
      'first-name': firstName,
      'last-name': lastName,
      'full-name': profile?.full_name || '',
      'email': profile?.email || '',
      'phone': phone,
      'linkedin': linkedinUrl,
      'github': githubUrl,
      'website': normaliseUrl(profile?.website_url || ''),
      'portfolio': normaliseUrl(profile?.portfolio_url || ''),
      'address1': profile?.address_line1 || '',
      'address2': profile?.address_line2 || '',
      'city': city,
      'state': state,
      'zip': profile?.zip || '',
      'country': profile?.country || 'United States',
      'location': loc,
      'sponsorship': profile?.requires_sponsorship ? 'Yes' : 'No',
      'work-auth': profile?.work_auth || '',
      'gender': profile?.gender || '',
      'ethnicity': profile?.ethnicity || '',
      'veteran': profile?.veteran_status || '',
      'disability': profile?.disability_status || '',
      'salary': profile?.desired_salary ? String(profile.desired_salary) : '',
      'start-date': profile?.available_start_date || '',
      'relocate': profile?.willing_to_relocate ? 'Yes' : 'No',
      'degree': profile?.highest_degree || '',
      'field-of-study': profile?.field_of_study || '',
      'school': profile?.university || '',
      'grad-year': profile?.graduation_year ? String(profile.graduation_year) : '',
      'years-experience': profile?.years_of_experience ? String(profile.years_of_experience) : '',
      'current-title': profile?.current_job_title || '',
      'current-company': profile?.current_company || '',
    },
    // Resolved for THIS employer: templates expanded, per-company overrides applied, and motivation
    // templates withheld so the run holds on them instead of interpolating a company name into
    // borrowed enthusiasm. buildAnswers still receives nothing but literal question text, so its
    // exact-match tier is unchanged.
    custom_answers: effectiveCustomAnswers(readAnswerStore(profile), company),
    // D55 (f): what "have you worked here before?" is answered from — the employers the candidate has
    // stated. Here only current_company; routes/apply.js adds the base résumé's EXPERIENCE companies
    // (the packet's entries.work) for every run and packet. See shared/savedAnswers.js.
    worked_here: { company: company || null, history: workHistoryCompanies({ profile }) },
    dropdown_map:{
      gender:   profile?.gender          ? [profile.gender]          : [],
      work_auth:profile?.work_auth       ? [profile.work_auth]        : [],
      clearance:profile?.clearance_level ? [profile.clearance_level]  : [],
    },
  };
}

// ── Auth ──────────────────────────────────────────────────────
// A127 (O101 (a), 11-06): the store runs on better-sqlite3 (services/sqliteSessionStore.js) — the same sessions.db and
// rows connect-sqlite3 wrote, so nobody is signed out; connect-sqlite3 and its `sqlite3` driver (tar, node-gyp) are gone.
// Same DATA_DIR as the main database: a throwaway boot must not share the real sessions.db, or the
// session-revocation assertions would be destroying the developer's own sessions.
// Sessions are SEALED at rest (services/encryptedSessionStore.js): AES-256-GCM under a key derived
// from COOKIE_ENCRYPTION_KEY. Plain rows written before this still read, and are resealed on write.
const SStore = new EncryptedSessionStore(new SqliteSessionStore({ db:"sessions.db", dir:DATA_DIR }), SECRET_KEY);

passport.use(new LocalStrategy((username, password, done) => {
  const login = String(username || "").trim();
  const user = db.prepare(`
    SELECT u.*
    FROM users u
    LEFT JOIN user_profile up ON up.user_id = u.id
    WHERE LOWER(u.username) = LOWER(?)
       OR LOWER(up.email) = LOWER(?)
    LIMIT 1
  `).get(login, login);
  const passwordOk = user ? verifyPassword(password, user.password_hash) : false;
  if (!user || !passwordOk) {
    // TEMPORARY DIAGNOSTIC: remove after production login is confirmed stable.
    console.warn("[auth-login-debug] local login rejected", {
      hasIdentifier: !!login,
      matchedUser: !!user,
      passwordOk,
    });
    return done(null, false, { message:"Invalid credentials." });
  }
  // ⭐ D88 (39d): a suspended account cannot sign in — the same words every time, and no hint of why to the caller.
  if (user.status === "suspended") return done(null, false, { message:"This account is suspended. Write to support@jobsviadraft.com." });
  // ⛔ D95: once the switch is on, the legacy admin row cannot sign in as a user — the SAME answer as a wrong password,
  // so the user sign-in never says which addresses are admin.
  if (user.is_admin && adminEnforced()) return done(null, false, { message:"Invalid credentials." });
  return done(null, {
    id:user.id,
    username:user.username,
    isAdmin:!!user.is_admin,
    applyMode:user.apply_mode,
    planTier:normalisePlanTier(user.plan_tier),
    domainProfileComplete:!!user.domain_profile_complete,
  });
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    const user = db.prepare("SELECT id,username,is_admin,apply_mode,plan_tier,domain_profile_complete FROM users WHERE id=?").get(id);
    if (!user) {
      // User was deleted or session references a stale ID from another environment.
      // done(null, false) cleanly de-authenticates — Passport calls req.logout() internally.
      // done(new Error(...)) would propagate to the global error handler and return 500.
      console.warn(`[auth] deserializeUser: user id=${id} not found — session will be cleared`);
      return done(null, false);
    }
    done(null, {
      id:user.id,
      username:user.username,
      isAdmin:!!user.is_admin,
      applyMode:user.apply_mode,
      planTier:normalisePlanTier(user.plan_tier),
      domainProfileComplete:!!user.domain_profile_complete,
    });
  } catch(e) {
    console.error("[auth] deserializeUser error:", e.message);
    done(null, false); // safe fallback — don't crash the request
  }
});

function hydrateAuthUser(id) {
  const user = db.prepare("SELECT id,username,is_admin,apply_mode,plan_tier,domain_profile_complete FROM users WHERE id=?").get(id);
  if (!user) return null;
  return {
    id:user.id,
    username:user.username,
    isAdmin:!!user.is_admin,
    applyMode:user.apply_mode,
    planTier:normalisePlanTier(user.plan_tier),
    domainProfileComplete:!!user.domain_profile_complete,
  };
}

function authContextHash(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

// ── AUTH CONTEXT LIFETIME — AJ1 decision 6a ──────────────────────────────────────────────────
//
// TWO windows, not one, and they answer different questions.
//
//   IDLE       how long a token survives with NOBODY USING IT. Unchanged at 7 days, so an
//              abandoned token still dies in a week exactly as before.
//   ABSOLUTE   how long a token can live AT ALL, however active. New, and it is what makes the
//              renewal below safe: a stolen token cannot be kept alive forever by using it.
//
// WHY THIS CHANGED. Until now expires_at was set once at issue and never moved, so the idle window
// was really a HARD window: a user of a native mobile app — which, unlike a browser, has no rolling
// connect.sid cookie to fall back on — was signed out every seventh day no matter how much they
// used it. For the extension that is tolerable. For a phone it is the single worst thing an app
// can do, and it would have been discovered from a store review.
//
// WHY SLIDING RENEWAL RATHER THAN A REFRESH ENDPOINT. A refresh endpoint means a SECOND credential
// kind with its own rotation, replay and revocation story, and a second thing every one of the four
// clients has to implement correctly. Sliding renewal gets the same result by moving a column that
// bindAuthContext ALREADY WRITES on every request (last_seen_at) — no new endpoint, no new token
// kind, nothing for a client to do, and it applies to the extension and the browser too.
const AUTH_CONTEXT_IDLE_SECONDS = 7 * 24 * 60 * 60;        // 7 days without a request
const AUTH_CONTEXT_ABSOLUTE_SECONDS = 90 * 24 * 60 * 60;   // 90 days from issue, whatever happens

function issueAuthContext(userId, req, options = {}) {
  if (options.sessionLess && isAdminUserRow(userId)) throw Object.assign(new Error(ADMIN_REFUSAL), { status: 403 });   // ⛔ D95
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM auth_contexts WHERE expires_at <= ? OR revoked_at IS NOT NULL").run(now - 86400);
  db.prepare(`
    INSERT INTO auth_contexts (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent, session_sid, auth_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    authContextHash(token),
    userId,
    now,
    now,
    now + AUTH_CONTEXT_IDLE_SECONDS,
    options.userAgent || req.get("user-agent") || null,
    // The browser session this token belongs to, so signing out of THIS browser revokes this
    // browser's tokens and nobody else's. sessionLess:true is for the extension token, which is
    // deliberately not tied to a browser session and is revoked on its own endpoint.
    options.sessionLess ? null : (req.sessionID || null),
    // Sessions A′ (153): a browser token is issued AT a sign-in, so that is its sign-in time — the
    // step-up check reads it for the identity that is acting. A session-less token was not a sign-in.
    options.sessionLess ? null : now * 1000,
  );
  return token;
}

// Sessions A′: the acting token's own sign-in time (ms) and the session it was issued under — "this browser"
// for that tab — and the refresh of the sign-in time by POST /api/account/reauth.
function authContextAuthAt(token) {
  if (!token) return null;
  try {
    const r = db.prepare("SELECT auth_at, session_sid FROM auth_contexts WHERE token_hash = ? AND revoked_at IS NULL").get(authContextHash(token));
    return r ? { authAt: r.auth_at ?? null, sid: r.session_sid ?? null } : null;
  } catch { return null; }
}
function stampAuthContextAuthAt(token, atMs = Date.now()) {
  if (!token) return;
  try { db.prepare("UPDATE auth_contexts SET auth_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(atMs, authContextHash(token)); }
  catch { /* the stamp is a convenience; the check fails closed without it */ }
}

// Revoke every credential belonging to ONE browser: the token the request presented, plus every
// other auth context issued under the same connect.sid. A different browser profile has a
// different sid and is untouched, which is the whole point of keying on it.
//
// Deliberately does NOT sweep session_sid IS NULL rows: those are extension tokens and pre-090
// rows, and revoking on a NULL match would revoke every such row for every browser at once.
function revokeBrowserAuthContexts(sid, presentedToken) {
  const now = Math.floor(Date.now() / 1000);
  if (presentedToken) {
    db.prepare("UPDATE auth_contexts SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL")
      .run(now, authContextHash(presentedToken));
  }
  if (!sid) return;
  db.prepare("UPDATE auth_contexts SET revoked_at=? WHERE session_sid=? AND revoked_at IS NULL")
    .run(now, sid);
}

// Revoke EVERYTHING for a user, across every browser and the extension: every auth context, and
// every cookie session in the session store that deserialises to them.
//
// A password change is the one moment a user is telling us a credential may be compromised, so
// leaving a 7-day rolling cookie and a fleet of tokens alive is the opposite of what they asked
// for.
//
// The store's public all() is unusable here: it returns the sessions without their sids, and the sid
// is the one thing destroy() needs. So the sids come from the store itself (sessionsForUser → the
// store's rows(), on its own connection — never a second handle on sessions.db). Deletion still goes
// through the store's destroy() so the table name stays its business.
//
// AWAITED by its callers, deliberately. The token revocation below is a synchronous better-sqlite3
// write, but the cookie sweep answers through the store's callbacks (on the next tick) — so returning
// before it finished would answer "your password is changed" while the old session was still, for a
// few milliseconds, a working credential. On this path that window is the whole point of the call.
function revokeAllUserSessions(userId, reason) {
  const now = Math.floor(Date.now() / 1000);
  const revoked = db.prepare(
    "UPDATE auth_contexts SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL"
  ).run(now, userId).changes;
  return new Promise((resolve) => {
    const done = (destroyed) => {
      console.log(`[auth] revoked all credentials for user ${userId} (${reason}): ${revoked} tokens, ${destroyed} cookie sessions`);
      resolve({ revokedTokens: revoked, destroyedSessions: destroyed });
    };
    try {
      // Sessions are sealed at rest: the store opens them to find this user's (sessionsForUser).
      SStore.sessionsForUser(userId, (err, sids) => {
        if (err) console.warn("[auth] session sweep query failed:", err.message);
        const mine = [...new Set([...(sids || []), ...sidsToRevoke(db, userId)])];
        forgetSessions(db, mine);
        if (!mine.length) return done(0);
        let outstanding = mine.length;
        for (const sid of mine) {
          SStore.destroy(sid, () => { if (--outstanding === 0) done(mine.length); });
        }
      });
    } catch(e) {
      console.warn("[auth] session sweep failed:", e.message);
      done(0);
    }
  });
}

function getRequestAuthContextToken(req) {
  const header = req.get("x-rm-auth-context");
  const authHeader = req.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  return header || bearer || req.query?.authContext || null;
}

function requestCookieNames(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map(part => part.trim().split("=")[0])
    .filter(Boolean);
}


// ⛔ Owner 11-01: "user last active … says 50s ago, i tested it 40 min ago". Last active is "the person did something",
// not "a request arrived": a tab left open polls (the D124 trial's /api/trial/state did, every minute — removed 11-07),
// and opening the ADMIN page in the same browser sends the tester's cookie with /api/auth/me. Those reads keep the
// credential alive (expiry still slides) but never move last_seen_at or the session registry. Measured on production
// 21:24–22:28Z: one open tab, 60+ polls.
const BACKGROUND_READS = new Set(["/api/auth/me", "/api/sync/events", "/api/config", "/api/version"]);
function isBackgroundRead(req) {
  if (req.method !== "GET") return false;
  const p = String(req.path || req.originalUrl || "").split("?")[0];
  return BACKGROUND_READS.has(p) || p.startsWith("/api/admin/");
}

function bindAuthContext(req, _res, next) {
  const token = getRequestAuthContextToken(req);
  if (!token) return next();
  try {
    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare(`
      SELECT ac.user_id, ac.created_at, ac.expires_at, ac.user_agent
      FROM auth_contexts ac
      WHERE ac.token_hash = ?
        AND ac.revoked_at IS NULL
        AND ac.expires_at > ?
      LIMIT 1
    `).get(authContextHash(token), now);
    if (!row) {
      // Token was sent but is expired, revoked, or unknown.
      // Log so we can diagnose "session expired" reports without leaking the token itself.
      console.warn(`[auth-context] token not found/expired — ${req.method} ${req.path} | ua:${(req.get("user-agent")||"").slice(0,60)}`);
      return next();
    }
    const user = hydrateAuthUser(row.user_id);
    if (!user) {
      console.warn(`[auth-context] token valid but user_id=${row.user_id} not in users table`);
      return next();
    }
    // ⛔ D95: a session-LESS token (the extension's, the phone's) is a user credential and never an admin's. One that
    // was issued to the legacy admin row before D95 is not honoured: requireAuth answers it with the plain refusal.
    if (user.isAdmin && (row.user_agent === EXTENSION_USER_AGENT || row.user_agent === MOBILE_USER_AGENT)) {
      req.adminCredentialRefused = true;
      return next();
    }
    req.user = user;
    req.authContextToken = token;
    // WHICH KIND of credential this is, carried forward so an authorisation decision can depend on
    // it. The column is already written by issueAuthContext; it was simply never read back, which
    // is why requireAdmin could not tell an extension's token from a browser tab's.
    req.authContextUserAgent = row.user_agent || null;
    // AJ1 6a — SLIDING RENEWAL, in the write that was already happening.
    //
    // The new expiry is the idle window from now, CLAMPED to the absolute window from issue. The
    // clamp is the whole safety property: without it "active" would mean "immortal", and a leaked
    // token in the hands of anything that polls would never expire.
    //
    // Guarded by `> expires_at` so this only ever moves the deadline FORWARD. A clock skew or a
    // token already past its absolute cap can therefore shorten nothing — Math.min could otherwise
    // hand back a value BEHIND the stored one and quietly expire a live session early, which would
    // be a worse bug than the one this fixes.
    const slidTo = Math.min(now + AUTH_CONTEXT_IDLE_SECONDS,
                            (row.created_at || now) + AUTH_CONTEXT_ABSOLUTE_SECONDS);
    const background = isBackgroundRead(req);   // a poll keeps the token alive but is not activity (owner 11-01)
    if (slidTo > row.expires_at) {
      if (background) db.prepare("UPDATE auth_contexts SET expires_at=? WHERE token_hash=?").run(slidTo, authContextHash(token));
      else db.prepare("UPDATE auth_contexts SET last_seen_at=?, expires_at=? WHERE token_hash=?")
        .run(now, slidTo, authContextHash(token));
    } else if (!background) {
      db.prepare("UPDATE auth_contexts SET last_seen_at=? WHERE token_hash=?").run(now, authContextHash(token));
    }
  } catch(e) {
    console.warn("[auth-context] bind failed:", e.message);
  }
  next();
}

function requireAuth(req, res, next) {
  // ⭐ D170 (6): the "[auth-debug]" dump that stood here (a TEMPORARY DIAGNOSTIC for a Railway session-cookie issue
  // long resolved) printed ≈ 208 multi-line blocks into one 11-hour production log — one per authenticated request.
  // Accept either a valid Passport session OR a valid auth context token.
  // bindAuthContext (which runs before this) sets req.authContextToken only when the
  // token is non-expired, non-revoked, and the user exists in the DB.
  // Without this second check, users whose Passport session was wiped (e.g. server
  // restart on ephemeral storage) but whose auth context token is still valid in
  // resume.db would always receive 401 even though they are authenticated.
  // ⛔ D95: an extension or phone token held by the legacy admin row — "This is an administrator account. Use a personal account."
  if (req.adminCredentialRefused) return refuseAdmin(res);
  if (req.isAuthenticated() || req.authContextToken) {
    // ⭐ D88 (39d): a suspended account is refused on every request, whichever credential it holds (an admin
    // cannot be suspended — services/userAdmin.js setStatus refuses it).
    if (req.user?.id != null && isSuspended(db, req.user.id)) return res.status(403).json({ error:"This account is suspended.", code:"account_suspended" });
    // ⛔ D95: once the switch is on, the legacy admin row is not a user either — user routes refuse it.
    if (req.adminEnforced && req.user?.isAdmin) return refuseAdmin(res);
    return next();
  }
  const hasCookie = !!req.headers.cookie?.includes("connect.sid");
  const hasToken  = !!getRequestAuthContextToken(req);
  console.warn(`[auth] 401 ${req.method} ${req.path} | cookie:${hasCookie} token_sent:${hasToken} ip:${req.ip}`);
  res.status(401).json({ error:"Unauthorized." });
}
// Admission is decided by shared/authPolicy.js — the SAME predicate routes/admin.js and
// routes/adminDb.js use. Three independent copies of this check are what let the extension reach
// the DB inspector while a fix sat in one of them; see docs/EXTENSION_DIAGNOSIS.md §6.
//
// Refused on the KIND of credential rather than by omitting isAdmin from the hydrated user,
// because req.user is shared with every other consumer and a half-populated user object reads as
// a data bug three files away. This says no in one place, for one reason.
//
// ⛔ D95: the admin is an ADMIN ACCOUNT — its own table, its own draft_admin cookie (services/adminGuard.js sets
// req.admin). The legacy is_admin users row passes only while ADMIN_ACCOUNTS_ENFORCE is off.
function requireAdmin(req, res, next) {
  return adminGuard(req, res, next);
}
// The legacy question, asked only while the switch is off: a signed-in users row that the shared predicate admits.
function legacyAdmin(req) {
  return (req.isAuthenticated() || !!req.authContextToken) && mayActAsAdmin(req);
}
const adminGuard = createRequireAdmin({ isExtensionRequest, legacy: legacyAdmin });
// ⛔ D95: is this users row the legacy admin? Every door that turns a session into a token refuses it.
function isAdminUserRow(userId) {
  if (userId == null) return false;
  try { return !!db.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId)?.is_admin; } catch { return false; }
}

function envOrigin(value) {
  try { return value ? new URL(value).origin : ""; }
  catch { return ""; }
}

const APP_BASE_ORIGIN = envOrigin(process.env.APP_BASE_URL);
const FRONTEND_ORIGIN = envOrigin(process.env.FRONTEND_URL) || APP_BASE_ORIGIN;
const ALLOWED_CORS_ORIGINS = new Set([APP_BASE_ORIGIN, FRONTEND_ORIGIN].filter(Boolean));
const CROSS_ORIGIN_FRONTEND = APP_BASE_ORIGIN && FRONTEND_ORIGIN && APP_BASE_ORIGIN !== FRONTEND_ORIGIN;
if (IS_PRODUCTION && !ALLOWED_CORS_ORIGINS.size) {
  console.warn("[auth] APP_BASE_URL or FRONTEND_URL should be set in production for credentialed CORS");
}

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (!IS_PRODUCTION) return callback(null, true);
  if (ALLOWED_CORS_ORIGINS.has(origin)) return callback(null, true);
  return callback(null, false);
}

function corsOriginExtension(origin, callback) {
  if (!origin) return callback(null, true);
  if (!IS_PRODUCTION) return callback(null, true);
  if (ALLOWED_CORS_ORIGINS.has(origin)) return callback(null, true);
  if (/^chrome-extension:\/\//.test(origin)) return callback(null, true);
  return callback(null, false);
}

logOAuthReadiness();

function publicUser(user) {
  const planTier = normalisePlanTier(user.planTier || user.plan_tier);
  const allowedModes = allowedModesForTier(planTier);
  const applyMode = allowedModes.includes(user.applyMode || user.apply_mode)
    ? (user.applyMode || user.apply_mode)
    : allowedModes[0];
  return {
    id:user.id,
    username:user.username,
    isAdmin:!!(user.isAdmin ?? user.is_admin),
    applyMode,
    planTier,
    allowedModes,
    capabilities: {
      canUseGenerate: canUseGenerate(planTier),
      canUseAPlusResume: canUseAPlusResume(planTier),
    },
    domainProfileComplete:!!(user.domainProfileComplete ?? user.domain_profile_complete),
  };
}

function makeUniqueUsername(base) {
  const stem = String(base || "user").toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "user";
  let candidate = stem;
  let n = 1;
  while (db.prepare("SELECT 1 FROM users WHERE username=?").get(candidate)) {
    candidate = `${stem}-${++n}`;
  }
  return candidate;
}

function providerColumnFor(provider) {
  if (provider === "linkedin") return "linkedin_auth_id";
  if (provider === "github") return "github_auth_id";
  return "google_auth_id";
}

function findUserByAuthProvider(provider, providerUserId, email, { allowEmailMatch = true } = {}) {
  const providerColumn = providerColumnFor(provider);
  if (providerUserId) {
    const byProvider = db.prepare(`SELECT * FROM users WHERE ${providerColumn}=?`).get(providerUserId);
    if (byProvider) return byProvider;
    const byIntegration = db.prepare(`
      SELECT u.*
      FROM user_integrations ui
      JOIN users u ON u.id = ui.user_id
      WHERE ui.provider=? AND ui.provider_user_id=?
      LIMIT 1
    `).get(provider, providerUserId);
    if (byIntegration) return byIntegration;
  }
  if (email && allowEmailMatch) {
    return db.prepare(`
      SELECT u.*
      FROM user_profile up
      JOIN users u ON u.id = up.user_id
      WHERE LOWER(up.email)=LOWER(?)
      LIMIT 1
    `).get(email);
  }
  return null;
}

function upsertAuthIntegration(userId, provider, { providerUserId, email, displayName, sessionState, scopes = [], expiresAt = null, metadata = {} }) {
  // ⛔ This call had no binding in this module until 09-30 — saveIntegrationSecret was defined only
  // inside routes/account.js — so every OAuth sign-in threw a ReferenceError here.
  const encrypted = saveIntegrationSecret(SECRET_BOX.encrypt, sessionState || null);
  const mergedMetadata = { authLinked: true, displayName: displayName || null, ...metadata };
  db.prepare(`
    INSERT INTO user_integrations
      (user_id, provider, provider_user_id, account_email, status, scopes_json, metadata_json,
       secret_enc, iv, auth_tag, expires_at, last_checked_at, updated_at)
    VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(user_id, provider) DO UPDATE SET
      provider_user_id=COALESCE(excluded.provider_user_id, user_integrations.provider_user_id),
      account_email=COALESCE(excluded.account_email, user_integrations.account_email),
      status='connected',
      scopes_json=excluded.scopes_json,
      metadata_json=excluded.metadata_json,
      secret_enc=COALESCE(excluded.secret_enc, user_integrations.secret_enc),
      iv=COALESCE(excluded.iv, user_integrations.iv),
      auth_tag=COALESCE(excluded.auth_tag, user_integrations.auth_tag),
      expires_at=COALESCE(excluded.expires_at, user_integrations.expires_at),
      last_checked_at=excluded.last_checked_at,
      updated_at=excluded.updated_at
  `).run(
    userId, provider, providerUserId || null, email || null,
    JSON.stringify(scopes), JSON.stringify(mergedMetadata),
    encrypted.enc, encrypted.iv, encrypted.tag, expiresAt,
  );
}

function profileParts(displayName) {
  const parts = String(displayName || "").split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || null,
    last: parts.length > 1 ? parts[parts.length - 1] : null,
  };
}

async function findOrCreateOAuthUser({ provider, providerId, email, name, emailVerified = undefined, picture = null, tokenSet = null, linkUserId = null }) {
  const providerColumn = providerColumnFor(provider);
  const providerUserId = String(providerId || "").trim();
  const emailForStorage = String(email || "").trim().toLowerCase() || null;
  const displayName = String(name || emailForStorage || provider).trim();
  const emailForMatch = emailVerified === false ? null : emailForStorage;
  if (!providerUserId) throw new Error("OAuth provider did not return a stable user id.");

  let user = null;
  let created = false;
  let linked = false;

  if (linkUserId) {
    const existing = findUserByAuthProvider(provider, providerUserId, null, { allowEmailMatch: false });
    if (existing && existing.id !== linkUserId) {
      const err = new Error(`That ${provider} sign-in belongs to another Draft account. To bring the two together, use Merge accounts in Account settings.`);
      err.status = 409;
      throw err;
    }
    user = db.prepare("SELECT * FROM users WHERE id=?").get(linkUserId);
    if (!user) {
      const err = new Error("Authenticated account no longer exists.");
      err.status = 401;
      throw err;
    }
    db.prepare(`UPDATE users SET ${providerColumn}=? WHERE id=?`).run(providerUserId, user.id);
    user = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    linked = true;
  } else {
    user = findUserByAuthProvider(provider, providerUserId, emailForMatch, { allowEmailMatch: !!emailForMatch });
    if (!user) {
      const username = makeUniqueUsername(emailForStorage || displayName || provider);
      const password = hashPassword(crypto.randomBytes(24).toString("base64url"));
      db.prepare(`INSERT INTO users (username,password_hash,is_admin,apply_mode,plan_tier,${providerColumn}) VALUES (?,?,0,'SIMPLE','BASIC',?)`)
        .run(username, password, providerUserId);
      user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
      const { first, last } = profileParts(displayName);
      db.prepare(`
        INSERT OR IGNORE INTO user_profile (user_id, full_name, first_name, last_name, email)
        VALUES (?, ?, ?, ?, ?)
      `).run(user.id, displayName || null, first, last, emailForStorage);
      created = true;
    } else if (user[providerColumn] !== providerUserId) {
      db.prepare(`UPDATE users SET ${providerColumn}=? WHERE id=?`).run(providerUserId, user.id);
      user = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
      linked = true;
    }
  }

  if (emailForStorage) {
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id, email) VALUES (?, ?)").run(user.id, emailForStorage);
    db.prepare("UPDATE user_profile SET email=COALESCE(email, ?) WHERE user_id=?").run(emailForStorage, user.id);
  }

  const obtainedAt = Math.floor(Date.now() / 1000);
  const expiresAt = tokenSet?.expires_in ? obtainedAt + Number(tokenSet.expires_in) : null;
  upsertAuthIntegration(user.id, provider, {
    providerUserId,
    email: emailForStorage,
    displayName,
    sessionState: tokenSet ? {
      provider,
      tokenType: tokenSet.token_type || "Bearer",
      accessToken: tokenSet.access_token || null,
      refreshToken: tokenSet.refresh_token || null,
      idToken: tokenSet.id_token || null,
      scope: tokenSet.scope || null,
      obtainedAt,
    } : null,
    scopes: OAUTH_PROVIDER_CONFIG[provider]?.scopes || [],
    expiresAt,
    metadata: {
      oauth: true,
      emailVerified: emailVerified ?? null,
      picture: picture || null,
    },
  });

  return { user, created, linked };
}

function completeProviderAuth(provider, identity, { linkUserId = null, tokenSet = null } = {}) {
  // ⛔ D95: once the switch is on, a provider sign-in never lands on the legacy admin row (the same failure as any other).
  const refuseAdminRow = (out) => {
    if (out?.user?.is_admin && adminEnforced()) throw Object.assign(new Error("Sign-in failed."), { status: 401 });
    return out;
  };
  return Promise.resolve(findOrCreateOAuthUser({
    provider,
    providerId: identity.providerUserId,
    email: identity.email,
    name: identity.displayName,
    emailVerified: identity.emailVerified,
    picture: identity.picture,
    tokenSet,
    linkUserId,
  })).then(refuseAdminRow);
}

function authUserFromDbRow(row) {
  return {
    id: row.id,
    username: row.username,
    isAdmin: !!row.is_admin,
    applyMode: row.apply_mode,
    planTier: normalisePlanTier(row.plan_tier),
    domainProfileComplete: !!row.domain_profile_complete,
  };
}

function appBaseUrl(req) {
  return (process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function isHttpsOrLocalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function oauthRedirectUri(req, provider) {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  return cfg?.redirectUri || `${appBaseUrl(req)}/auth/${provider}/callback`;
}

function oauthProviderReadiness(provider, req = null) {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  if (!cfg) return { provider, configured: false, status: "unsupported", missing: ["provider"], warnings: [] };
  const missing = [];
  const warnings = [];
  if (!cfg.clientId) missing.push("client_id");
  if (!cfg.clientSecret) missing.push("client_secret");
  if (!process.env.APP_BASE_URL && process.env.NODE_ENV === "production") warnings.push("app_base_url_missing");
  const base = req ? appBaseUrl(req) : (process.env.APP_BASE_URL || "");
  const redirectUri = req || cfg.redirectUri ? oauthRedirectUri(req, provider) : "";
  if (!redirectUri) missing.push("redirect_uri_or_app_base_url");
  if (redirectUri && !isHttpsOrLocalUrl(redirectUri)) warnings.push("redirect_uri_not_https_or_localhost");
  if (base && !isHttpsOrLocalUrl(base)) warnings.push("app_base_url_not_https_or_localhost");
  if (provider !== "github" && (!cfg.scopes?.includes("openid") || !cfg.scopes?.includes("email"))) warnings.push("openid_email_scopes_missing");
  const configured = missing.length === 0;
  const envPrefix = provider.toUpperCase();
  return {
    provider,
    configured,
    healthy: configured && warnings.length === 0,
    status: configured ? (warnings.length ? "configured_with_warnings" : "configured") : (missing.length === 3 ? "missing" : "partial"),
    missing,
    warnings,
    redirectUri: redirectUri || null,
    requiredEnv: [
      `${envPrefix}_CLIENT_ID`,
      `${envPrefix}_CLIENT_SECRET`,
      `${envPrefix}_CALLBACK_URL or APP_BASE_URL`,
    ],
  };
}

function oauthReadiness(req = null) {
  return Object.fromEntries(OAUTH_PROVIDERS.map(provider => [provider, oauthProviderReadiness(provider, req)]));
}

function logOAuthReadiness() {
  for (const provider of OAUTH_PROVIDERS) {
    const status = oauthProviderReadiness(provider);
    if (status.configured) {
      console.log(`[oauth:${provider}] ${status.status}${status.warnings.length ? ` (${status.warnings.join(", ")})` : ""}`);
    } else {
      // ⭐ D170 (6): a provider with no credentials is simply not offered (production offers Google only) — info, not a warning.
      console.log(`[oauth:${provider}] not offered — ${status.status}; missing ${status.missing.join(", ")}`);
    }
  }
}

function oauthReturnUrl(req, returnTo, params = {}) {
  const fallback = req.user ? "/app/integrations" : "/app";
  const rawPath = String(returnTo || fallback);
  let safePath = fallback;
  try {
    const parsed = new URL(rawPath, appBaseUrl(req));
    const sameOrigin = parsed.origin === new URL(appBaseUrl(req)).origin;
    if (sameOrigin && rawPath.startsWith("/") && !rawPath.startsWith("//")) {
      safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {}
  const url = new URL(safePath, appBaseUrl(req));
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function oauthConfigFor(provider, req) {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  const readiness = oauthProviderReadiness(provider, req);
  if (!readiness.configured) {
    const err = new Error(`${provider} OAuth is not configured (${readiness.missing.join(", ")} missing).`);
    err.status = 503;
    err.oauthReadiness = readiness;
    throw err;
  }
  return { ...cfg, redirectUri: oauthRedirectUri(req, provider) };
}

function normalizeOAuthIdentity(provider, claims) {
  const email = String(claims.email || claims.emailAddress || "").trim().toLowerCase() || null;
  const displayName = String(claims.name || claims.login || [claims.given_name, claims.family_name].filter(Boolean).join(" ") || email || provider).trim();
  return {
    providerUserId: String(claims.sub || claims.id || "").trim(),
    email,
    emailVerified: claims.email_verified === undefined ? undefined : !!claims.email_verified,
    displayName,
    picture: claims.picture || null,
  };
}

async function exchangeOAuthCode(provider, code, req) {
  const cfg = oauthConfigFor(provider, req);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const tokenResponse = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body,
  });
  const tokenSet = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenSet.access_token) {
    const err = new Error(tokenSet.error_description || tokenSet.error || `${provider} token exchange failed.`);
    err.status = 502;
    throw err;
  }
  return tokenSet;
}

async function fetchOAuthUserInfo(provider, tokenSet, req) {
  const cfg = oauthConfigFor(provider, req);
  const infoResponse = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenSet.access_token}`, Accept: "application/json", "User-Agent": "resume-master" },
  });
  const claims = await infoResponse.json().catch(() => ({}));
  if (!infoResponse.ok) {
    const err = new Error(claims.error_description || claims.message || `${provider} userinfo lookup failed.`);
    err.status = 502;
    throw err;
  }
  if (provider === "github" && !claims.email && cfg.emailsUrl) {
    const emailResponse = await fetch(cfg.emailsUrl, {
      headers: { Authorization: `Bearer ${tokenSet.access_token}`, Accept: "application/json", "User-Agent": "resume-master" },
    });
    const emails = await emailResponse.json().catch(() => []);
    if (emailResponse.ok && Array.isArray(emails)) {
      const primary = emails.find(row => row?.primary && row?.verified) || emails.find(row => row?.verified) || emails[0];
      if (primary?.email) {
        claims.email = primary.email;
        claims.email_verified = !!primary.verified;
      }
    }
  }
  return normalizeOAuthIdentity(provider, claims);
}

// The three gates below are the ONLY places a 403 upgrade_required is minted in this file, so the
// lever is consulted here rather than at each of their six call sites. A call site that forgot to
// ask would be a gate that still refuses with the lever off — the "two switches that disagree"
// shape shared/monetisation.js exists to prevent. The gate bodies are untouched: with the lever on
// they compute exactly what they computed before this flag existed.
function requireModeEntitlement(req, res, mode = req.user?.applyMode) {
  if (!monetisationEnabled()) return true;
  const planTier = normalisePlanTier(req.user?.planTier);
  if (canUseMode(planTier, mode)) return true;
  res.status(403).json({
    error: "upgrade_required",
    message: `${mode} requires the ${planForMode(mode)} plan.`,
    requiredTier: planForMode(mode),
    planTier,
  });
  return false;
}

function requireToolEntitlement(req, res, tool) {
  if (!monetisationEnabled()) return true;
  const planTier = normalisePlanTier(req.user?.planTier);
  // ⭐ D88 P1: the decision is the resolver's (generate_enabled / a_plus_enabled: the same plan rule —
  // PLUS for Generate, PRO for A+ — while monetisation is on).
  const allowed = resolveEntitlement(db, req.user?.id, tool === "a_plus_resume" ? "a_plus_enabled" : "generate_enabled",
    { ctx: { planTier, monetisation: true } }).value === true;
  if (allowed) return true;
  const requiredTier = tool === "a_plus_resume" ? "PRO" : "PLUS";
  res.status(403).json({
    error: "upgrade_required",
    message: `${tool === "a_plus_resume" ? "A+ Resume" : "Generate"} requires the ${requiredTier} plan.`,
    requiredTier,
    planTier,
  });
  return false;
}

function requirePlan(req, res, requiredTier) {
  if (!monetisationEnabled()) return true;
  const planTier = normalisePlanTier(req.user?.planTier);
  if (hasPlanAtLeast(planTier, requiredTier)) return true;
  res.status(403).json({
    error: "upgrade_required",
    message: `This feature requires the ${requiredTier} plan.`,
    requiredTier,
    planTier,
  });
  return false;
}

// assertUserOwns — use this when fetching a record by ID WITHOUT user_id in the
// WHERE clause, then verifying ownership. Returns the row on success; sends the
// appropriate error response and returns null if the check fails.
// NOTE: Most routes in this file use the safer pattern:
//   WHERE user_id=? AND id=?  ← returns null for both "not found" and "not yours"
// which leaks no information about whether the record exists. assertUserOwns is
// most useful for admin-adjacent lookups or any future route that must fetch a
// shared resource then check whether the caller may mutate it.
function assertUserOwns(row, userId, res) {
  if (!row) { res.status(404).json({ error:"Not found" }); return null; }
  if (row.user_id !== userId) { res.status(403).json({ error:"Forbidden" }); return null; }
  return row;
}

// Canonical role-key derivation — delegates to services/jobClassifier.js.
// To change the mapping logic, edit getRoleKeyForProfile() in that module.
/** D40 · when, and from which site, a user captured a job — the + view card's one extra line. */
function captureMeta(row) {
  let from = null;
  try { from = row?.captured_url ? new URL(row.captured_url).hostname.replace(/^www\./, "") : null; } catch { from = null; }
  return { at: row?.captured_at ? row.captured_at * 1000 : null, from };
}

function roleKeyForProfile(profile) {
  const family = String(profile?.role_family || "").trim().toLowerCase();
  const domain = String(profile?.domain    || "").trim().toLowerCase();
  // engineering_embedded_firmware is the only engineering sub-domain with a
  // strict, non-overlapping title set.  Use the domain itself as the role key
  // so firmware profiles get their own isolated bucket in job_role_map and
  // never share the broad "engineering" key with standard SWE profiles.
  // engineering_systems_low_level and engineering_specialist intentionally
  // stay on the shared "engineering" key — their title sets overlap too much
  // with SWE to warrant a separate bucket without a full re-scrape.
  if (family === "engineering" && domain === "engineering_embedded_firmware") {
    return "engineering_embedded_firmware";
  }
  return _getRoleKeyForProfile(profile);
}

function userHasBaseResume(userId) {
  const activeProfile = getOrRepairActiveProfile(userId);
  if (!activeProfile) return false;
  return profileHasBaseResume(db, { userId, profileId: activeProfile.id });
}

function getOrRepairActiveProfile(userId) {
  let active = db.prepare("SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1").get(userId);
  if (active) return active;
  const fallback = db.prepare("SELECT * FROM domain_profiles WHERE user_id=? ORDER BY updated_at DESC, created_at ASC LIMIT 1").get(userId);
  if (!fallback) {
    try { db.prepare("UPDATE users SET domain_profile_complete=0 WHERE id=?").run(userId); } catch {}
    return null;
  }
  db.prepare("UPDATE domain_profiles SET is_active=0 WHERE user_id=?").run(userId);
  db.prepare("UPDATE domain_profiles SET is_active=1, updated_at=unixepoch() WHERE id=? AND user_id=?").run(fallback.id, userId);
  try { db.prepare("UPDATE users SET domain_profile_complete=1 WHERE id=?").run(userId); } catch {}
  return db.prepare("SELECT * FROM domain_profiles WHERE id=? AND user_id=?").get(fallback.id, userId);
}

function assignJobRoleMap(jobId, profile, matchedBy = "profile_scrape", confidence = 1.0) {
  if (!jobId || !profile) return;
  db.prepare(`
    INSERT OR IGNORE INTO job_role_map
      (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(jobId),
    roleKeyForProfile(profile),
    profile.role_family || null,
    profile.domain || null,
    profile.id || null,
    confidence,
    matchedBy,
  );
}

function resolveUserJobDomainProfileId(userId, jobId) {
  const userActiveProfile = getOrRepairActiveProfile(userId);
  if (!userActiveProfile) return null;
  const activeRoleKey = roleKeyForProfile(userActiveProfile);

  const existing = db.prepare(`
    SELECT uj.domain_profile_id
    FROM user_jobs uj
    JOIN domain_profiles dp ON dp.id = uj.domain_profile_id AND dp.user_id = uj.user_id AND dp.is_active = 1
    JOIN job_role_map jrm ON jrm.job_id = uj.job_id AND jrm.role_key = ?
    JOIN scraped_jobs sj ON sj.job_id = uj.job_id
    WHERE uj.user_id=? AND uj.job_id=?
  `).get(activeRoleKey, userId, String(jobId));
  if (existing?.domain_profile_id) return existing.domain_profile_id;

  const activeProfile = db.prepare(`
    SELECT dp.*
    FROM domain_profiles dp
    JOIN job_role_map jrm ON jrm.role_key = LOWER(COALESCE(NULLIF(dp.role_family, ''), dp.domain))
    JOIN scraped_jobs sj ON sj.job_id = jrm.job_id
    WHERE dp.user_id = ? AND dp.is_active = 1 AND jrm.job_id = ?
  `).get(userId, String(jobId));
  if (activeProfile?.id) return activeProfile.id;

  return null;
}

// ── Express ───────────────────────────────────────────────────
const app = express();
/**
 * AK1 — the corpus term weights that apply to one posting, by its role family.
 *
 * Cached for the process lifetime and keyed by family, because the alternative is a SELECT per job
 * and the scrape-time path scores the whole board in a loop. The cache is dropped whenever the
 * weight table is recomputed (scripts/recomputeAtsTermWeights.js runs out of process, so a restart
 * is what picks new weights up — a long-lived server keeps serving the weights it booted with,
 * which is why loadTermWeights stamps and checks computed_at rather than trusting the cache).
 *
 * A STALE OR ABSENT TABLE RETURNS null, NOT OLD WEIGHTS. The scorer treats null as "score
 * unweighted", which is exactly v3 behaviour — degraded, never wrong.
 */
const _atsWeightCache = new Map();

/**
 * ⛔ A RECOMPUTE THAT DOES NOT CLEAR THIS TAKES EFFECT ONLY AFTER A RESTART, which is
 * indistinguishable from "the recompute did nothing". _atsWeightCache holds one entry per role
 * family for the lifetime of the process — including the NULL entry meaning "unweighted" — so the
 * nightly rebuild would write a perfectly good table that nothing read until the next deploy.
 * CC3 hit the identical shape with the synonym cache; its note is the precedent.
 */
function invalidateAtsWeightCache() { _atsWeightCache.clear(); }

/**
 * Run the weight refresh and say what happened, in one line per outcome.
 *
 * Shared by the boot check and the nightly cron so the two cannot report the same event
 * differently. Never throws: a scorer on 20-day-old weights beats a dead cron tick, and both beat
 * a boot that fails over a ranking refinement.
 */
// ⭐ D170 (3): async — the count runs in a worker thread (services/atsTermWeightsWorker.js, its own read-only
// connection), only the write runs here. Callers fire and forget it (boot, cron); it still never throws.
async function runTermWeightRefresh(trigger) {
  const startedAt = Math.floor(Date.now() / 1000);
  try {
    const r = await maybeRecomputeTermWeightsAsync(db, { onInvalidate: invalidateAtsWeightCache, dbPath: DB_PATH });
    if (r.ran) {
      const fams = (r.result?.families || []).map(f => `${f.family}:${f.weighted}`).join(" ");
      console.log(`[ats-weights] (${trigger}) rebuilt — ${r.before.state} -> ${r.after.state}, `
        + `${r.after.terms} terms over ${r.result?.corpusSize ?? "?"} postings (${r.result?.scanned ?? "?"} read, `
        + `counted by ${r.result?.counted ?? "?"}) [${fams}]`);
      recordPipelineRun(db, {
        runKind: "term_weights", source: trigger, status: "ok", startedAt,
        written: r.after.terms,
        details: { before: r.before.state, after: r.after.state, corpusSize: r.result?.corpusSize ?? null,
                   families: r.after.families },
      });
    } else if (r.reason.startsWith("refused") || r.reason.startsWith("failed")) {
      console.error(`[ats-weights] (${trigger}) NOT rebuilt — ${r.reason}`);
      // 'no_results' for a refusal, 'failed' for a throw inside the recompute. A refusal is the
      // thin-board guard doing its job and keeping a good table; a failure is the pass not working.
      // Conflating them would make the consecutive-failure count below fire on a healthy refusal.
      recordPipelineRun(db, {
        runKind: "term_weights", source: trigger,
        status: r.reason.startsWith("refused") ? "no_results" : "failed",
        startedAt, errorText: r.reason, details: { before: r.before?.state ?? null },
      });
    }
    return r;
  } catch (e) {
    console.error(`[ats-weights] (${trigger}) refresh threw: ${e.message}`);
    recordPipelineRun(db, {
      runKind: "term_weights", source: trigger, status: "failed", startedAt,
      errorText: `threw: ${e.message}`,
    });
    return null;
  }
}

/**
 * How many times in a row the weight refresh has failed, most recent first.
 *
 * ⛔ WHY THIS EXISTS. docs/ATS_TERM_WEIGHTS_SCHEDULE.md §7 left one thing open, and named it:
 * "if the 45-day refusal is ever hit, that means the nightly pass has failed three times running,
 * which is worth a louder signal than this task builds." The refresh is deliberately never-fatal —
 * a scorer on 20-day-old weights beats a dead cron tick — but never-fatal plus console-only means
 * a pass that fails EVERY night is indistinguishable from one that has never needed to run. The
 * table stays fresh-looking until REFRESH (14d) is passed, then stays "stale" until someone reads
 * a log line, and the scorer silently drops to unweighted at 45d.
 *
 * With REFRESH at 14 and REFUSAL at 45 there are two further nightly chances after the first miss,
 * so THREE consecutive failures is the point at which the cliff becomes reachable. That is the
 * number this reports against, and it is derived from the two thresholds rather than picked.
 *
 * A refusal ('no_results') is NOT a failure — it is the thin-board guard keeping a good table —
 * so it neither increments nor resets the streak: it is not evidence either way about whether the
 * pass works. Only 'ok' resets it.
 */
/** 44r: whether any term-weight refresh (any status, any trigger) is on record within `seconds`. */
function termWeightRefreshRanWithin(seconds, now = Math.floor(Date.now() / 1000)) {
  try {
    const row = db.prepare(
      `SELECT 1 FROM pipeline_runs WHERE run_kind = 'term_weights' AND started_at >= ? LIMIT 1`
    ).get(now - seconds);
    return !!row;
  } catch { return false; }
}

function termWeightRefreshHealth() {
  try {
    const rows = db.prepare(
      `SELECT status, started_at, error_text FROM pipeline_runs
        WHERE run_kind = 'term_weights' ORDER BY started_at DESC, id DESC LIMIT 20`
    ).all();
    let consecutiveFailures = 0;
    for (const r of rows) {
      if (r.status === "failed") consecutiveFailures++;
      else if (r.status === "ok") break;
      // 'no_results' (refused): skip without breaking — see the note above.
    }
    const last = rows[0] || null;
    return {
      consecutiveFailures,
      // The threshold is DERIVED: after a missed refresh there are (MAX-REFRESH)/... nightly
      // retries before the refusal is reachable. Stated as a number so /api/version can be read
      // without knowing the arithmetic.
      failuresBeforeCliff: 3,
      lastRun: last ? { status: last.status, at: last.started_at, error: last.error_text ?? null } : null,
    };
  } catch {
    // pipeline_runs missing (pre-migration-069) is not a reason to fail /api/version.
    return { consecutiveFailures: 0, failuresBeforeCliff: 3, lastRun: null };
  }
}
/**
 * CC3 · THE SYNONYM MAP, ON THE SCORING PATH AT LAST.
 *
 * G1 built `skill_synonyms` and a review UI for it. `scoreAtsLocally` has always accepted a
 * `synonyms` argument. NOT ONE CALL SITE PASSED IT — the table's only production reader was
 * enrichJob.js's technographics de-dup, so the owner was being asked to review 196 proposals for a
 * table nothing that scores read. That is why it measured "+0.000": not a weak effect, NO EFFECT
 * PATH. This is the path.
 *
 * ⛔ CONFIRMED ROWS ONLY, and that gate is in loadConfirmedSynonyms rather than here. A false
 * equivalence is a CONFIDENTLY WRONG match — the same class as the coffee machine, and worse in
 * reach, because a wrong synonym moves every score on the board in one direction invisibly. The
 * 196 proposals stay out until a human moves them.
 *
 * Memoised per database inside skillSynonyms.js, and invalidated by its own writers, so scoring 25
 * jobs in a batch costs one read and a confirmation takes effect without a restart.
 */
function atsSynonyms() {
  return loadConfirmedSynonyms(db);
}

/**
 * CC4 · THE TERMS THE CANDIDATE HAS CLAIMED, on the scoring path.
 *
 * A claim used to reach exactly one place: the generation prompt. `listProfileClaims` had a single
 * consumer and AG2's own copy said so — "it does not change this score" — which was literally
 * true. So the user-enrichable layer that changes RANKING did not exist: the only way to influence
 * the board was an unlabelled "Extracted …" textarea that a résumé re-upload silently overwrote.
 *
 * ⛔ KEYED OFF `profile.user_id`, NOT A `userId` IN SCOPE. A profile's claims belong to its owner
 * by definition, and eight call sites with eight different local variable names is eight chances to
 * pass the wrong one. Reading the owner off the row makes that impossible rather than unlikely.
 *
 * Returns null on any failure: a claim lookup may never be the reason a score does not happen.
 */
function atsClaims(profile) {
  if (!profile?.id || !profile?.user_id) return null;
  try {
    return listProfileClaims(db, { userId: profile.user_id, profileId: profile.id });
  } catch (e) {
    console.warn(`[ats-claims] could not load claims for profile ${profile.id}: ${e.message}`);
    return null;
  }
}

function atsTermWeightsForJob(job) {
  let family = null;
  try {
    family = roleFamilyForTitle(job?.normalized_title || job?.title || "");
  } catch { family = null; }
  const key = family || "__none__";
  if (!_atsWeightCache.has(key)) {
    let loaded = null;
    try { loaded = loadTermWeights(db, family); } catch { loaded = null; }
    // ⛔ THE OLD GUARD COULD NOT SEE THE STATE PRODUCTION WAS ACTUALLY IN. It read
    // `loaded.stale && loaded.weights.size`, so it fired only for a table that EXISTS and is old.
    // An EMPTY table has size 0, so it said nothing at all — and production's ats_term_weights had
    // never been computed, which meant every score there was unweighted, forever, in silence.
    // "Absent" and "stale" are different states and both mean "not scoring the way we think".
    if (!loaded || !loaded.weights.size) {
      console.warn(`[ats] NO term weights for ${key} — scoring UNWEIGHTED. `
        + `The table has never been computed, or holds nothing for this family.`);
    } else if (loaded.stale) {
      console.warn(`[ats] term weights are STALE for ${key} (computed_at ${loaded.computedAt}); `
        + `scoring unweighted. The nightly refresh should have prevented this.`);
    }
    _atsWeightCache.set(key, loaded && !loaded.stale && loaded.weights.size ? loaded.weights : null);
  }
  return _atsWeightCache.get(key);
}

/**
 * THE SCORING PATH, AS ONE DEFINITION — the basis a profile is scored against, and the call that
 * scores one posting against it.
 *
 * These two lines were written out inline at every call site: the ATS panel, the apply worker's
 * base-résumé score, and now the board's fit precompute. The board RANKS by the precomputed score
 * and the panel SHOWS the panel's, so if those were two copies of the call they could come apart
 * — a card sorted as Strong whose report reads Weak. One function each is what makes them the same
 * computation rather than two that agree today.
 *
 * `resumeText` may be passed (the panel receives it from the client, which loaded the same base
 * résumé); otherwise the profile's stored base résumé is read. Returns null when there is none —
 * there is nothing to score against, and a basis built from "" would score every posting Weak.
 *
 * `basisHash` identifies the candidate-side inputs (migration 110). It is computed from the BASIS
 * ITSELF, not from where it came from, so the panel and the precompute agree on a hash whenever
 * they scored against the same text — which is what lets a report the panel wrote count as fresh.
 */
function atsBasisForProfile(userId, profile, { resumeText = null } = {}) {
  const text = resumeText ?? (profile?.id ? getBaseResumeRecord(db, { userId, profileId: profile.id })?.content : null);
  if (!text) return null;
  const runtimeBasis = buildRuntimeAtsBasis({
    resumeText: text,
    signalProfile: profile?.id ? loadOrCreateSimpleApplyProfile(db, { userId, profileId: profile.id }) : null,
    // undefined, not null, when there is no profile: the package defaults an absent domainProfile
    // to {} and dereferences a null one.
    domainProfile: profile ?? undefined,
    claims: atsClaims(profile),
  });
  // ATS_REPORT_CACHE_KEY, not LOCAL_ATS_SOURCE: a stored REPORT is stale when its buckets change
  // (G6), not only when the number does. See the package's note.
  return { runtimeBasis, basisHash: atsBasisHash(runtimeBasis, { scorerVersion: ATS_REPORT_CACHE_KEY }) };
}

/** Score one posting against a basis. Local and deterministic: no model call, no network. */
// ⛔ D59: the scorer reads the NORMALISED text (description_text) — raw HTML's `text-align` and a label
// block's "Date Posted" are not requirements. withPostingText swaps it in; `description` is never rewritten.
function scoreJobForBasis(job, runtimeBasis) {
  job = withPostingText(job);
  return scoreAtsLocally({ job, runtimeBasis, termWeights: atsTermWeightsForJob(job), synonyms: atsSynonyms() });
}
/**
 * ⭐ D151 Rule 3 · THE SAME CALL, A BATCH AT A TIME, IN THE SCORE WORKER: exactly scoreJobForBasis's inputs — the
 * normalised posting (withPostingText), its role family's term weights (atsTermWeightsForJob — sent once per family, not
 * per posting), the synonyms once — scored by the worker's import of the same scoreAtsLocally. Rejects when the pool
 * cannot answer; the precompute then scores the batch here (boardFitPrecompute scoreMany).
 */
function scoreBatchForBasis(jobs, runtimeBasis) {
  const weights = {};
  const items = jobs.map((raw) => {
    const job = withPostingText(raw);
    let fam = null;
    try { fam = roleFamilyForTitle(job?.normalized_title || job?.title || ""); } catch { fam = null; }
    const wk = fam || "__none__";
    if (!(wk in weights)) weights[wk] = atsTermWeightsForJob(job);
    return { job, wk };
  });
  return scorePool.score({ items, weights, synonyms: atsSynonyms(), runtimeBasis });
}

/**
 * CC5 · THE ONE PLACE A COMPUTED ATS REPORT IS STORED, and it is keyed by whose résumé produced it.
 *
 * Every writer in this file used to `UPDATE scraped_jobs SET ats_score=?, ats_report=?` — one cell
 * per POSTING for a number that is a statement about (résumé, posting). Three writers did it (the
 * scrape scorer, adopt-enhanced, the keywords route) and four readers served it, so the same
 * mistake had to be found and fixed seven times. It is one function now.
 *
 * ⛔ DELETE-THEN-INSERT RATHER THAN `ON CONFLICT`, AND THE REASON IS SQLITE'S NULL SEMANTICS.
 * `UNIQUE(user_id, domain_profile_id, job_id)` does NOT constrain rows whose profile is NULL —
 * NULLs compare distinct in a unique index — so `ON CONFLICT(user_id, domain_profile_id, job_id)`
 * never fires for a user who has no active profile, and every open of the ATS panel would append
 * another row. `WHERE domain_profile_id IS ?` is null-safe, so this holds one row per key including
 * that one. Wrapped in a transaction because between the two statements there is no row at all.
 *
 * `scorer_version` is not decoration: a stored score with no engine and no timestamp is
 * unfalsifiable. The one row that ever carried a stored score on this board held 43 while the
 * scorer returned null on the same day, and nothing recorded which engine produced the 43 — a
 * stale cache and a changed scorer were indistinguishable. The version comes off the REPORT's own
 * `source`, never today's constant, for the same reason capturedAtsAtApply reads it that way.
 */
//
// `basisHash` (migration 110) records WHICH candidate basis produced the report — see
// atsBasisForProfile. The board's fit precompute re-scores any row whose hash does not match the
// profile's current basis, so a writer that omits it (NULL) is treated as "basis unknown" and its
// row gets re-scored, never trusted as fresh.
let _storeAtsReportTxn = null;
//
// `jobHash` (migration 118, A52) records WHICH VERSION OF THE POSTING was scored — atsJobInputHash
// over the columns the scorer reads. Omitted (NULL) reads as stale exactly like a NULL basis_hash:
// the precompute re-scores it and the board never presents it as a verdict.
function storeAtsReportForProfile({ userId, profileId = null, jobId, report, basisHash = null, jobHash = null }) {
  if (!userId || !jobId || !report) return;
  // A declaration rather than a `const` holding db.transaction(...), because the scrape scorer 1,500
  // lines above calls this: a const would sit in its temporal dead zone for any caller that ran
  // during module evaluation, and "it happens to be called from a callback" is not a property worth
  // depending on. The transaction is built once, on first use.
  if (!_storeAtsReportTxn) {
    // Prepared once with the transaction, not per call: the board's fit precompute stores a whole
    // board through this writer, and re-preparing two statements per row was measured as ~30% of
    // that commit.
    const del = db.prepare(
      "DELETE FROM ats_only_reports WHERE user_id=? AND job_id=? AND domain_profile_id IS ?"
    );
    const ins = db.prepare(`
        INSERT INTO ats_only_reports
          (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash)
        VALUES (?, ?, ?, ?, ?, ?, unixepoch(), ?, ?)
      `);
    _storeAtsReportTxn = db.transaction((args) => {
      del.run(args.userId, args.jobId, args.profileId);
      ins.run(
        args.userId, args.profileId, args.jobId,
        JSON.stringify(args.report), args.report.score ?? null,
        args.report.source || LOCAL_ATS_SOURCE,
        args.basisHash, args.jobHash,
      );
    });
  }
  _storeAtsReportTxn({ userId, profileId: profileId ?? null, jobId: String(jobId), report,
                       basisHash: basisHash ?? null, jobHash: jobHash ?? null });
}

// ── THE BOARD'S FIT PRECOMPUTE ──────────────────────────────────────────────────────────────────
//
// The board ranks by fit (services/jobs/jobCursor.js FIT_KEYS), which needs a score on every row,
// and scoring the whole board per request costs seconds. So this fills ats_only_reports ahead of
// time — incrementally, bounded, yielding — and the board reads it. See
// services/jobs/boardFitPrecompute.js.
//
// ⛔ WIRED TO THE PANEL'S OWN FUNCTIONS. basisFor/scoreJob/store are the three the ATS panel and the
// apply worker call; the module has no scoring code of its own.
//
// Lazy for the reason _storeAtsReportTxn is: callers include callbacks declared far above this line.
//
// BOARD_FIT_PRECOMPUTE=off stops every AUTOMATIC trigger (boot, crawl, résumé change, board load).
// The admin route still runs on request — an operator who turned the automation off still needs a
// way to run it once, on purpose.
let _boardFit = null;
function boardFit() {
  if (!_boardFit) {
    _boardFit = createBoardFitPrecompute({
      db, basisFor: atsBasisForProfile, scoreJob: scoreJobForBasis, store: storeAtsReportForProfile,
      // D151 Rule 3: the batches go to the score worker; scoreJob stays the fallback (and the panel's path).
      scoreBatch: scoreBatchForBasis,
      // ⭐ D151 (45k): the plan's keyset pages are read AND judged in the A126 read workers (15.2 s of the 100k suite's
      // main-thread window was planPageRows); the pool answers on the main connection when it cannot.
      read: readPool,
      // 43y: a new profile's first scores — its own category (D127), newest first — written within seconds.
      primeFor: (_userId, profile) => {
        const cat = profileCategory(profile || {});
        return db.prepare(`SELECT job_id FROM scraped_jobs WHERE is_active = 1 AND (? IS NULL OR board_category = ?)
          ORDER BY COALESCE(posted_at, discovered_at) DESC LIMIT 120`).pluck().all(cat, cat);
      },
      // A112: only the postings the profile's default board shows (its category, /api/jobs's categorySql) are
      // precomputed — not every active posting (418,711 stored reports for 15 users at 79k postings).
      scopeFor: (_userId, profile) => {
        const cat = profileCategory(profile || {});
        return cat && /^[a-z_]+$/.test(cat) ? cat : null;
      },
    });
  }
  return _boardFit;
}
function boardFitAutomationEnabled() {
  return String(process.env.BOARD_FIT_PRECOMPUTE || "").toLowerCase() !== "off";
}
/**
 * The trigger every automatic path calls. Never throws and never awaits: a scoring pass must not be
 * the reason a résumé save or a crawl fails. `profile` defaults to the user's active profile, the
 * one the board is ranked for.
 */
const _boardFitBoardTriggerAt = new Map();   // "user:profile" -> ms of the last board-load trigger
const BOARD_FIT_BOARD_TRIGGER_EVERY_MS = 60_000;
function scheduleBoardFit(userId, reason, profile = null) {
  if (!boardFitAutomationEnabled() || !userId) return;
  try {
    const p = profile || getOrRepairActiveProfile(userId);
    if (!p?.id) return;
    // The board-load trigger is a catch-all, not an event, so it is rate-limited: once a minute per
    // (user, profile). Every explicit trigger (résumé saved, crawl finished, profile edited) is not.
    if (reason === "board") {
      const key = `${userId}:${p.id}`;
      const last = _boardFitBoardTriggerAt.get(key) || 0;
      if (Date.now() - last < BOARD_FIT_BOARD_TRIGGER_EVERY_MS) return;
      _boardFitBoardTriggerAt.set(key, Date.now());
    }
    boardFit().schedule({ userId, profile: p, reason })
      .catch(e => console.error(`[board-fit] ${reason} pass threw for user ${userId}:`, e.message));
  } catch (e) {
    console.error(`[board-fit] could not schedule (${reason}) for user ${userId}:`, e.message);
  }
}
// ⛔ A139 (45h): the whole-board passes score only accounts that may look soon. Production 11-07: every former trial
// account joined the boot pass (≈ 26 s each the first time, ≈ 1 s each after; a new account's first full score 160 s),
// and most never return. Idle = no board load, no sign-up and no Apply for me / Ask me first in BOARD_FIT_ACTIVE_DAYS
// (30); an idle account is scored the moment it loads its board again (scheduleBoardFit "board", which is unfiltered).
const BOARD_FIT_ACTIVE_DAYS = Number(process.env.BOARD_FIT_ACTIVE_DAYS) > 0 ? Number(process.env.BOARD_FIT_ACTIVE_DAYS) : 30;
function boardFitIdle(userId) {
  const u = db.prepare(`SELECT board_seen_at, created_at, send_mode, auto_settings FROM users WHERE id = ?`).get(userId);
  if (!u) return false;
  const since = Math.floor(Date.now() / 1000) - BOARD_FIT_ACTIVE_DAYS * 86400;
  if ((u.board_seen_at || 0) >= since || (u.created_at || 0) >= since) return false;
  if (u.send_mode === "auto" || /"picks":true/.test(u.auto_settings || "")) return false;   // the scheduler ranks by these scores
  return true;
}
function scheduleBoardFitForAll(reason) {
  if (!boardFitAutomationEnabled()) return;
  boardFit().runAll({ reason, idle: boardFitIdle })
    .catch(e => console.error(`[board-fit] ${reason} pass threw:`, e.message));
}
// A52 follow-up: a pass that enriched rows moved their job_hash, so their stored scores are stale.
// Rescore them now rather than at the next crawl. Debounced: a drain runs many passes in a row, and
// the precompute is incremental (only changed postings are scored), so one trailing pass is enough.
let _enrichmentRescoreTimer = null;
onEnrichmentApplied(() => {
  if (_enrichmentRescoreTimer) clearTimeout(_enrichmentRescoreTimer);
  _enrichmentRescoreTimer = setTimeout(() => { _enrichmentRescoreTimer = null; scheduleBoardFitForAll("enrichment"); }, 30_000);
  _enrichmentRescoreTimer.unref?.();
});


const atsScoreQueue = [];
let atsScoreQueueRunning = false;
let anthropicAtsUnavailableUntil = 0;

function enqueueAtsScoreWork(label, worker) {
  atsScoreQueue.push({ label, worker });
  if (atsScoreQueueRunning) return;
  atsScoreQueueRunning = true;
  setImmediate(async () => {
    while (atsScoreQueue.length) {
      const item = atsScoreQueue.shift();
      try {
        await item.worker();
      } catch(e) {
        console.warn(`[ats-queue] ${item.label || "job"} failed:`, e.message);
      }
    }
    atsScoreQueueRunning = false;
  });
}

function getProfileSearchFacts(signalProfile = null) {
  return normaliseStructuredFacts(signalProfile?.structuredFacts || {});
}

function evaluateProfileFactEligibility(jobLike = {}, signalProfile = null) {
  const facts = getProfileSearchFacts(signalProfile);
  const text = [
    jobLike.title || "",
    jobLike.location || "",
    jobLike.description || "",
    jobLike.descriptionHtml || "",
  ].join(" ").toLowerCase();

  const requiresClearance = /\b(ts\/sci|top secret|secret clearance|security clearance required|active clearance|clearance required|public trust)\b/i.test(text);
  if (requiresClearance && !facts.hasClearance) {
    return { ok: false, reason: "clearance", facts };
  }

  const citizenOnly = /\b(u\.?s\.?\s+citizen(ship)?\s+(required|only)|must be a u\.?s\.?\s+citizen|citizens only)\b/i.test(text);
  const hasCitizenEligibility = /\b(citizen|permanent resident|green card)\b/i.test(String(facts.citizenshipStatus || ""));
  if (citizenOnly && !hasCitizenEligibility) {
    return { ok: false, reason: "citizenship", facts };
  }

  const noSponsorship = /\b(no (visa )?sponsorship|unable to sponsor|cannot sponsor|sponsorship not available|must be authorized to work in the united states)\b/i.test(text);
  if (noSponsorship && facts.requiresSponsorship) {
    return { ok: false, reason: "sponsorship", facts };
  }

  return { ok: true, reason: null, facts };
}

// SYNC CLIENTS: in-memory SSE registry.
// Clients reconnect on server restart automatically.
// To add a new sync event type: call emitToUser() from the relevant route handler
// and handle the event type in the frontend useSyncEvents hook.
const syncClients = new Map(); // key: userId, value: Set of res objects

// ⛔ A126 (7) (hotfix 11-05) · THE BOARD'S MATCH QUEUE. One worker per (user, profile): it takes the postings a board
// load held back (unscored for the current basis), scores them in chunks through the precompute's own scorer
// (boardFit().scoreIds — the same scorer, store, slices and yields), and after each chunk that scored something sends
// the person's open tabs `board_scored`, on which the board refetches its current view (new postings land in the
// current sort). Bounded: at most BOARD_MATCH_MAX ids waiting per profile.
const BOARD_MATCH_BATCH = 2000;
const BOARD_MATCH_MAX = 6000;
const BOARD_MATCH_CHUNK = 250;
const _boardMatch = new Map();   // "user:profile" -> { ids: Set, running: boolean, profile }
// ⭐ D151 (45k) · the held read's kept answers (services/jobs/heldCountCache.js); dropped when the person's scoring lands.
const heldCounts = createHeldCountCache();
function enqueueBoardMatch(userId, profile, jobIds) {
  if (!boardFitAutomationEnabled() || !userId || !profile?.id || !jobIds?.length) return;
  const key = `${userId}:${profile.id}`;
  let q = _boardMatch.get(key);
  if (!q) { q = { ids: new Set(), running: false, profile }; _boardMatch.set(key, q); }
  q.profile = profile;
  for (const id of jobIds) { if (q.ids.size >= BOARD_MATCH_MAX) break; q.ids.add(String(id)); }
  if (q.running) return;
  q.running = true;
  (async () => {
    try {
      while (q.ids.size) {
        const chunk = [...q.ids].slice(0, BOARD_MATCH_CHUNK);
        for (const id of chunk) q.ids.delete(id);
        const r = await boardFit().scoreIds({ userId, profile: q.profile, jobIds: chunk, reason: "board-queue" });
        if (r?.scored) { heldCounts.clearUser(userId); emitToUser(userId, { type: "board_scored", profileId: profile.id, scored: r.scored, waiting: q.ids.size }); }
        if (r?.status === "no_basis" || r?.status === "skipped" || r?.status === "failed") { q.ids.clear(); break; }
      }
    } catch (e) {
      console.warn(`[board-match] ${key}:`, e.message);
    } finally {
      q.running = false;
      if (!q.ids.size) _boardMatch.delete(key);
    }
  })();
}
function emitToUser(userId, event) {
  const clients = syncClients.get(userId);
  if (!clients?.size) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(res => {
    try { res.write(data); }
    catch(e) { clients.delete(res); }
  });
}
// ⭐ D112 item 8: the notification dispatcher, configured before any run can finish (routes/notify.js is mounted below).
configureNotify({ db, emitToUser, appUrl: APP_BASE_ORIGIN || "" });
// trust proxy: required for Railway/Render — without this, secure: true cookies
// fail behind their HTTPS reverse proxy and all sessions silently break.
app.set("trust proxy", 1);
// ⛔ D171 FIX 1: FIRST — each request is its own "who started this" context (services/startedByContext.js), read lazily
// at the model call / the run's insert, after the session and the admin binder have run.
// ⛔ D173 (5): and before it, the request's id (x-request-id in and out) — sent on to the tools service (docs/SERVICES.md).
app.use(requestIdMiddleware);
app.use(startedByMiddleware);
app.use(cors({ origin:corsOrigin, credentials:true }));
// ⛔ D75: the crawler worker's doors come BEFORE the JSON parser — a result's HMAC is over its exact bytes.
app.use("/api/crawler", createCrawlerWorkerRouter(db));
// ⭐ D100 P2: the apply worker's doors, before the JSON parser for the same reason. A submit it reports is recorded the
// way every pipeline submit is (A63: pending → verified → submitted; job_applications with the score at apply).
app.use("/api/worker", createApplyWorkerRouter(db, { hooks: {
  onSubmitted: ({ userId, jobId, runJobId }) => recordSubmissionFromPipeline(db, { userId, jobId, runJobId, capturedAtsAtApply }),
},
  // Called at request time, after applyLine (below) exists: the same payload and résumé a local run uses.
  payloadFor: (run) => applyLine.workerPayload({ userId: run.userId, jobId: run.jobId, resumeArtifactId: run.resumeArtifactId }),
  resumePdf: (x) => applyLine.workerResumePdf(x),
}));
// ⛔ D76: Railway's webhook — public, header-authenticated, its own 16 KB cap, read-only (deploy_events).
app.use("/api/hooks", createRailwayHookRouter(db));
// ⭐ D103: the inbox's inbound mail (Resend inbound, Svix-signed over the RAW body) — before the JSON parser.
app.use(createInboundHookRouter(db));
// ⭐ D73 §B: Resend's webhook (Svix-signed over the RAW body) — before the JSON parser, like Railway's.
const emailRouters = createEmailRouters({ db, requireAuth, requireAdmin });
app.use(emailRouters.hooksRouter);
// ⛔ D86: bring-your-own-model résumés. The doors a host calls server-to-server (OAuth metadata, register,
// token, revoke, /mcp) come BEFORE the session and auth-context middleware — an OAuth token is the only
// credential they read; the consent screen and the settings come after, on the person's session.
const byomRouters = createByomRouters({
  db, deps: byomDeps(), production: IS_PRODUCTION, requireAuth, requireAdmin,
  issuerFor: (req) => APP_BASE_ORIGIN || `${req.protocol}://${req.get("host")}`,
});
app.use(byomRouters.tokenRouter);
app.use(express.json({ limit:"4mb" }));
// TODO: reduce cookie maxAge to 30 min + implement sliding renewal
// once useInactivityLogout (30-min idle) is deployed on the client.
// ⛔ SameSite=LAX (09-30). Production sent "none", so the browser attached the session cookie to
// requests from ANY site — the precondition for cross-site request forgery. "none" is only needed
// when the frontend is served from a different origin than the API, and here it is not (the server
// serves the client). The extension authenticates with a header token (extension/auth.js), not the
// cookie, except one GET for that token. The Origin check below is the second layer.
const SESSION_SAMESITE = IS_PRODUCTION && CROSS_ORIGIN_FRONTEND ? "none" : "lax";
app.use(session({
  store: SStore,
  secret:SESSION_SECRET, resave:false, saveUninitialized:false,
  // rolling:true resets the cookie maxAge on every response so active users never
  // hit session expiry mid-session (the 7-day clock restarts on each request).
  rolling: true,
  cookie:{
    httpOnly:true,
    secure:process.env.NODE_ENV === "production",
    sameSite:SESSION_SAMESITE,
    maxAge:7*24*60*60*1000,
  },
}));
app.use(passport.initialize());
app.use(passport.session());
// ⭐ D156 (6) · the facets cache (services/jobs/facetsCache.js): any write by a signed-in user drops their kept counts, so
// the filter sentence never shows a count from before their own decision, star, import or profile change.
// (Its middleware runs after bindAuthContext, below — a token-authenticated request's user is bound there.)
const facetsCache = createFacetsCache();
// Account management: every sign-in is STAMPED (sensitive changes need a recent one — see
// routes/accountManagement.js) and every signed-in browser is kept in a registry, because the sealed
// store is keyed by sid alone and cannot answer "where am I signed in?". req.logIn is passport's,
// wrapped per request; passport regenerates the session inside it, so the stamp lands on the new one.
const sessionSeen = new Map();   // sid -> last registry write (ms), so a busy tab writes once per 5 min
const ipHint = (req) => {
  const ip = String(req.ip || "").replace(/^::ffff:/, "");
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip.split(".").slice(0, 2).join(".") + ".x.x" : null;   // coarse, never the full address
};
app.use((req, res, next) => {
  const logIn = req.logIn;
  req.login = req.logIn = function stampedLogIn(user, options, done) {
    if (typeof options === "function") { done = options; options = {}; }
    return logIn.call(this, user, options, (err) => {
      if (!err && req.session) {
        req.session.authAt = Date.now();
        try { recordSession(db, { sid: req.sessionID, userId: user.id, userAgent: req.get("user-agent"), ipHint: ipHint(req) }); } catch {}
        sessionSeen.set(req.sessionID, Date.now());
      }
      done?.(err);
    });
  };
  const uid = req.session?.passport?.user;
  if (uid && req.sessionID && !isBackgroundRead(req) && Date.now() - (sessionSeen.get(req.sessionID) || 0) > 5 * 60 * 1000) {
    sessionSeen.set(req.sessionID, Date.now());
    if (sessionSeen.size > 5000) sessionSeen.clear();
    try { recordSession(db, { sid: req.sessionID, userId: uid, userAgent: req.get("user-agent"), ipHint: ipHint(req) }); } catch {}
  }
  next();
});
app.use(bindAuthContext);
// ⭐ D156 (6): any write by a signed-in user (session or auth-context token) drops their kept facets counts.
app.use((req, _res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.user?.id != null) facetsCache.clearUser(req.user.id);
  next();
});
// ⛔ D95: the admin's own session (the draft_admin cookie, Path=/api/admin) — and no admin credential anywhere else.
app.use(createAdminSessionBinder({ db }));
// ⛔ CROSS-SITE REQUEST FORGERY, refused at the door (09-30). A state-changing request that carries
// an Origin (or, failing that, a Referer) from anywhere but this site is a 403. Exempt: requests
// authenticated by a HEADER token (the extension, mobile) — a forged cross-site request cannot set
// one — and server-to-server calls, which send no Origin. Browsers always send Origin on a
// cross-origin POST, so the attack cannot simply omit it.
app.use(rejectCrossSiteWrites({ allowedOrigins: ALLOWED_CORS_ORIGINS, hasHeaderToken: (req) => !!getRequestAuthContextToken(req) }));
app.use(byomRouters.sessionRouter);
app.use(emailRouters.appRouter);

const CLIENT_DIST = path.join(__dirname,"client","dist");
// 44b: "(jobsviadraft.com/try):" in a message opened `/try):` on a tester's phone and drew the app's 404. A page path
// with trailing punctuation goes to the clean path (services/linkPunctuation.js).
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const clean = cleanLinkPath(req.path);
  if (!clean) return next();
  const q = req.originalUrl.indexOf("?");
  res.redirect(301, clean + (q >= 0 ? req.originalUrl.slice(q) : ""));
});
// 11-07 (owner): the D124 trial is removed — every account gets the whole site. /try was the trial's one link; an old
// invite still opens the front door instead of the app's 404 (query kept). /try/practice/:jobId is a different route.
app.get("/try", (req, res) => {
  const q = req.originalUrl.indexOf("?");
  res.redirect(302, "/" + (q >= 0 ? req.originalUrl.slice(q) : ""));
});
app.use(express.static(CLIENT_DIST));

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, ch => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[ch]));
}

// ⭐ D128 P1 · every OPEN public posting (a shown category, not a duplicate); a closed one leaves the same day.
app.get("/sitemap-jobs.xml", (req, res) => {
  res.type("application/xml").send(sitemapXml(appBaseUrl(req), jobsSitemapRoutes(db)));
});

// ⭐ D128 P1 · a public, server-rendered page per posting (services/jobs/publicJobPage.js): no sign-in, the
// employer credited and linked, JobPosting JSON-LD while open; closed → says so, noindex, no structured data.
app.get("/jobs/:slug", (req, res) => {
  let found = null;
  try { found = publicJobFor(db, req.params.slug); } catch { found = null; }
  if (found?.kind === "redirect") return res.redirect(301, found.path);
  const page = found ? renderPublicJobPage(db, found.row, { base: appBaseUrl(req), open: found.open }) : renderMissingJobPage();
  res.set("Cache-Control", "public, max-age=600").status(page.status).type("html").send(page.html);
});

app.get("/sitemap.xml", (req, res) => {
  const base = appBaseUrl(req);
  const routes = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/login", changefreq: "monthly", priority: "0.8" },
    { path: "/features", changefreq: "monthly", priority: "0.6" },
    { path: "/pricing", changefreq: "monthly", priority: "0.6" },
    { path: "/about", changefreq: "monthly", priority: "0.5" },
    { path: "/contact", changefreq: "monthly", priority: "0.5" },
    // ⭐ D105: /atlas and every PUBLISHED Atlas page — never a draft (d105SitemapPublishedOnly).
    ...atlasSitemapRoutes(db),
  ];
  res.type("application/xml").send(sitemapXml(base, routes));
});

// One urlset writer for /sitemap.xml and /sitemap-jobs.xml (D128 P1).
function sitemapXml(base, routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${xmlEscape(`${base}${route.path === "/" ? "" : route.path}`)}</loc>
${route.lastmod ? `    <lastmod>${xmlEscape(route.lastmod)}</lastmod>
` : ""}    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
}

app.get("/robots.txt", (req, res) => {
  const base = appBaseUrl(req);
  res.type("text/plain").send([
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /profile",
    "Allow: /",
    "Allow: /login",
    // ⭐ D128 P1: /jobs/ was disallowed — the public posting pages live there now.
    "Allow: /jobs/",
    `Sitemap: ${base}/sitemap.xml`,
    `Sitemap: ${base}/sitemap-jobs.xml`,
    "",
  ].join("\n"));
});

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
app.post("/api/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ error:info?.message||"Invalid credentials." });
    req.logIn(user, e => e ? next(e) : res.json({ ok:true, user:publicUser(user), authContext:issueAuthContext(user.id, req) }));
  })(req, res, next);
});

app.post("/api/auth/register", (req, res) => {
  const { username, password, profile={} } = req.body;
  if (!username||!password) return res.status(400).json({ error:"username and password required" });
  const passwordError = validatePassword(password);
  if (passwordError)       return res.status(400).json({ error:passwordError });
  if (!profile.email)       return res.status(400).json({ error:"email is required" });
  if (!profile.first_name)  return res.status(400).json({ error:"first name is required" });
  if (!profile.last_name)   return res.status(400).json({ error:"last name is required" });
  // ⛔ D95: an admin account's email is never a user account's — a person who is both has two emails.
  if (emailBelongsToAdmin(db, profile.email)) return res.status(400).json({ error:"This email can't be used to create an account here." });

  // Build full_name from parts for backwards compat
  const fullName = [
    profile.first_name?.trim(),
    profile.middle_name?.trim() || null,
    profile.last_name?.trim(),
    profile.name_suffix?.trim() || null,
  ].filter(Boolean).join(" ");

  try {
    db.prepare("INSERT INTO users (username,password_hash,is_admin,apply_mode,plan_tier) VALUES (?,?,0,'SIMPLE','BASIC')")
      .run(username, hashPassword(password));
    const newUser = db.prepare("SELECT id FROM users WHERE username=?").get(username);
    db.prepare("UPDATE users SET password_set=1 WHERE id=?").run(newUser.id);   // a password the user chose
    db.prepare(`INSERT INTO user_profile
      (user_id,full_name,first_name,middle_name,last_name,name_suffix,
       email,phone,linkedin_url,github_url,location,
       address_line1,address_line2,city,state,zip,country,
       gender,ethnicity,veteran_status,disability_status,
       requires_sponsorship,has_clearance,clearance_level,visa_type,work_auth)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        newUser.id,
        fullName||null,
        profile.first_name||null, profile.middle_name||null,
        profile.last_name||null,  profile.name_suffix||null,
        profile.email||null, profile.phone||null,
        profile.linkedin_url||null, profile.github_url||null,
        profile.city&&profile.state ? `${profile.city}, ${profile.state}` : (profile.location||null),
        profile.address_line1||null, profile.address_line2||null,
        profile.city||null, profile.state||null, profile.zip||null, profile.country||"United States",
        profile.gender||null, profile.ethnicity||null,
        profile.veteran_status||null, profile.disability_status||null,
        profile.requires_sponsorship?1:0, profile.has_clearance?1:0,
        profile.clearance_level||null, profile.visa_type||null, profile.work_auth||null
      );
    // ⭐ D73 §B 2: product news only when the sign-up box was TICKED (it starts unticked) — never inferred,
    // never bundled with the terms; recorded with when and where.
    if (req.body?.marketingOptIn === true) setMarketingConsent(db, newUser.id, true, "signup");
    const sessionUser = { id:newUser.id, username, isAdmin:false, applyMode:"SIMPLE", planTier:"BASIC", domainProfileComplete:false };
    req.logIn(sessionUser, e => {
      if (e) return res.status(500).json({ error:"Account created but login failed. Please sign in." });
      res.json({ ok:true, user:publicUser(sessionUser), authContext:issueAuthContext(newUser.id, req) });
    });
  } catch(e) {
    res.status(400).json({ error:e.message.includes("UNIQUE")?"Username already taken.":e.message });
  }
});

app.get("/api/auth/oauth/status", (req, res) => {
  res.json({ providers: oauthReadiness(req) });
});

app.get(["/api/auth/oauth/:provider/start", "/auth/:provider"], (req, res) => {
  const provider = String(req.params.provider || "").toLowerCase();
  if (!OAUTH_PROVIDERS.includes(provider)) return res.status(400).json({ error: "Unsupported auth provider" });
  // mode=merge: prove ANOTHER Draft account (the one this sign-in belongs to) is yours, so it can be
  // merged into the signed-in one. It signs nobody in and creates nothing.
  const mode = ["link", "merge"].includes(req.query?.mode) ? req.query.mode : "login";
  const returnTo = String(req.query?.returnTo || (mode === "link" ? "/app/integrations" : mode === "merge" ? "/app/account" : "/app"));
  if (mode !== "login" && !req.isAuthenticated()) {
    return res.redirect(oauthReturnUrl(req, "/login", {
      oauthError: "Sign in before linking an OAuth provider.",
      oauthProvider: provider,
    }));
  }
  try {
    const cfg = oauthConfigFor(provider, req);
    const state = crypto.randomBytes(32).toString("base64url");
    req.session.oauthStates = req.session.oauthStates || {};
    for (const [key, entry] of Object.entries(req.session.oauthStates)) {
      if (Date.now() - Number(entry?.createdAt || 0) > 10 * 60 * 1000) delete req.session.oauthStates[key];
    }
    req.session.oauthStates[state] = {
      provider,
      mode,
      returnTo,
      linkUserId: mode === "link" && req.isAuthenticated() ? req.user.id : null,
      mergeIntoUserId: mode === "merge" && req.isAuthenticated() ? req.user.id : null,
      createdAt: Date.now(),
    };
    const authUrl = new URL(cfg.authUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
    authUrl.searchParams.set("scope", cfg.scopes.join(" "));
    authUrl.searchParams.set("state", state);
    if (provider === "google") {
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", mode === "link" ? "consent" : "select_account");   // merge: pick the OTHER account
    }
    res.redirect(authUrl.toString());
  } catch(e) {
    console.warn(`[oauth:${provider}] start blocked:`, e.message);
    const target = oauthReturnUrl(req, mode !== "login" ? returnTo : "/login", { oauthError: e.message, oauthProvider: provider });
    res.redirect(target);
  }
});

app.get(["/api/auth/oauth/:provider/callback", "/auth/:provider/callback"], async (req, res, next) => {
  const provider = String(req.params.provider || "").toLowerCase();
  const state = String(req.query?.state || "");
  const code = String(req.query?.code || "");
  const stored = req.session.oauthStates?.[state];
  const fail = (message, returnTo = stored?.mode === "link" || stored?.mode === "merge" ? stored.returnTo : "/login") =>
    res.redirect(oauthReturnUrl(req, returnTo, { oauthError: message, oauthProvider: provider }));

  if (!OAUTH_PROVIDERS.includes(provider)) return fail("Unsupported auth provider.");
  if (req.query?.error) {
    console.warn(`[oauth:${provider}] provider returned error:`, String(req.query.error));
    return fail(String(req.query.error_description || req.query.error));
  }
  if (!state || !stored || stored.provider !== provider) {
    console.warn(`[oauth:${provider}] callback rejected: invalid state`);
    return fail("OAuth session expired. Try again.");
  }
  if (Date.now() - Number(stored.createdAt || 0) > 10 * 60 * 1000) {
    delete req.session.oauthStates[state];
    console.warn(`[oauth:${provider}] callback rejected: expired state`);
    return fail("OAuth session expired. Try again.");
  }
  if (!code) {
    console.warn(`[oauth:${provider}] callback rejected: missing authorization code`);
    return fail("OAuth callback did not include an authorization code.");
  }

  try {
    delete req.session.oauthStates[state];
    const tokenSet = await exchangeOAuthCode(provider, code, req);
    const identity = await fetchOAuthUserInfo(provider, tokenSet, req);
    if (stored.mode === "merge") {
      // Find the account this sign-in belongs to — by the provider id ONLY (an email match proves
      // nothing about who holds the other account) — and remember it as the merge candidate.
      const intoId = stored.mergeIntoUserId;
      if (!req.isAuthenticated() || req.user.id !== intoId) return fail("Sign in to the account you want to keep, then try again.");
      const from = findUserByAuthProvider(provider, identity.providerUserId, null, { allowEmailMatch: false });
      if (!from) return fail(`No other Draft account signs in with that ${provider} account — there is nothing to merge.`);
      if (from.id === intoId) return fail(`That ${provider} account already signs in to this account.`);
      req.session.mergeCandidate = { fromId: from.id, intoId, via: provider, at: Date.now() };
      return res.redirect(oauthReturnUrl(req, stored.returnTo, { oauthProvider: provider, oauthStatus: "merge_ready" }));
    }
    const { user, created, linked } = await completeProviderAuth(provider, identity, {
      linkUserId: stored.linkUserId || null,
      tokenSet,
    });
    const sessionUser = authUserFromDbRow(user);
    req.logIn(sessionUser, e => {
      if (e) return next(e);
      const authContext = issueAuthContext(user.id, req);
      res.redirect(oauthReturnUrl(req, stored.returnTo, {
        authContext,
        oauthProvider: provider,
        oauthStatus: stored.linkUserId ? "linked" : created ? "created" : linked ? "linked" : "signed_in",
      }));
    });
  } catch(e) {
    const status = e.status || 500;
    if (status >= 500) console.error(`[oauth:${provider}] callback failed:`, e.message);
    return fail(e.message || "OAuth sign-in failed.");
  }
});

app.post("/api/auth/provider/:provider", async (req, res, next) => {
  const provider = String(req.params.provider || "").toLowerCase();
  if (!OAUTH_PROVIDERS.includes(provider)) return res.status(400).json({ error: "Unsupported auth provider" });
  const email = String(req.body?.email || req.body?.accountEmail || "").trim().toLowerCase() || null;
  const providerUserId = String(req.body?.providerUserId || req.body?.id || "").trim() || (email ? `${provider}:${email}` : null);
  const displayName = String(req.body?.displayName || req.body?.name || "").trim() || email || provider;
  if (!providerUserId && !email) return res.status(400).json({ error: "Provider identity or email required" });

  try {
    const { user, created, linked } = await completeProviderAuth(provider, {
      providerUserId,
      email,
      displayName,
      emailVerified: true,
    }, {
      linkUserId: req.isAuthenticated() ? req.user.id : null,
      tokenSet: null,
    });
    if (req.body?.sessionState || req.body?.cookies) {
      upsertAuthIntegration(user.id, provider, {
        providerUserId,
        email,
        displayName,
        sessionState: req.body.sessionState || req.body.cookies,
        scopes: OAUTH_PROVIDER_CONFIG[provider]?.scopes || [],
      });
    }

    const sessionUser = authUserFromDbRow(user);
    req.logIn(sessionUser, e => {
      if (e) return next(e);
      res.json({
        ok: true,
        created,
        linked,
        provider,
        user: publicUser(sessionUser),
        authContext: issueAuthContext(user.id, req),
        readiness: getAutomationReadiness(db, user.id),
      });
    });
  } catch(e) {
    next(e);
  }
});

app.post("/api/auth/password-reset/request", async (req, res) => {
  // No email provider means no reset email can be sent — so say so, for EVERY request. It is a fact
  // about the deployment, not about any account, so it discloses nothing. (It used to say "sent".)
  if (!emailConfigured()) {
    return res.status(503).json({ error: "email_unconfigured",
      message: "Password reset by email isn't available yet. Contact support to reset your password." });
  }
  const email = String(req.body?.email || "").trim();
  const generic = {
    ok: true,
    message: "If an account exists for that email, a reset link and OTP have been sent.",
  };
  if (!email) return res.json(generic);

  try {
    const throttleSince = Math.floor(Date.now() / 1000) - 10 * 60;
    const recentRequests = db.prepare(`
      SELECT COUNT(*) as c
      FROM password_reset_tokens
      WHERE requested_at > ?
        AND (request_ip = ? OR email = LOWER(?))
    `).get(throttleSince, req.ip, email).c;
    if (recentRequests >= 5) return res.json(generic);

    const user = findUserForPasswordReset(db, email);
    if (user) {
      const reset = createPasswordReset(db, user, {
        pepper: PASSWORD_RESET_SECRET,
        requestIp: req.ip,
        userAgent: req.get("user-agent") || null,
      });
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl.replace(/\/$/, "")}/login?resetToken=${encodeURIComponent(reset.token)}`;
      let mailResult = null;
      try {
        mailResult = await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
          otp: reset.otp,
          expiresAt: reset.expiresAt,
        }, { db });   // D73 §B: never to a suppressed address
      } catch(e) {
        console.error("[password-reset] email send failed:", e.message);
      }
      if (!mailResult?.ok) {
        db.prepare("UPDATE password_reset_tokens SET used_at=unixepoch() WHERE id=?").run(reset.id);
        console.warn("[password-reset] email send skipped or failed for configured user");
      }
    }
  } catch(e) {
    console.error("[password-reset] request failed:", e.message);
  }
  res.json(generic);
});

app.post("/api/auth/password-reset/confirm", async (req, res) => {
  const result = consumePasswordReset(db, {
    token: req.body?.token,
    otp: req.body?.otp,
    password: req.body?.password,
  }, {
    pepper: PASSWORD_RESET_SECRET,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });
  // A password reset is a statement that the old credential may be compromised. Changing the hash
  // while leaving the 7-day rolling cookie and every issued token alive would have changed nothing
  // for whoever was already signed in.
  await revokeAllUserSessions(result.userId, "password_reset");
  res.json({ ok: true });
});

// Signing out signs out THIS BROWSER.
//
// The old handler revoked the presenting tab's token and returned early, so the connect.sid
// session survived. The cookie is the durable credential: it is what a reopened tab, a hard
// refresh, or any request with an empty sessionStorage authenticates with. Leaving it alive meant
// "Sign out" only ever discarded the fallback, and the next page load signed the user straight
// back in — for up to seven more days, because the session is rolling.
//
// There is no coherent middle ground here. The cookie is shared by every tab in the browser
// profile, so a sign-out either destroys it (and signs the profile's tabs out) or it does not
// (and signs nobody out). Signing out is a deliberate act at a machine, so it takes the machine:
// the cookie session, and every auth context issued under it.
//
// A DIFFERENT browser profile keeps its own cookie jar and its own sid, so it is unaffected —
// that is the guarantee that matters, not per-tab scoping within one profile.
//
// ⛔ SESSIONS A′ (owner, 10-09): ONE EXCEPTION — TWO ACCOUNTS IN ONE BROWSER. Each tab carries its own token,
// and the shared cookie belongs to whichever account signed in last. Measured on a throwaway server: the admin
// in tab A, the owner's own account in tab B — when the ADMIN signed out, tab B was signed out too, because
// this route destroyed the cookie, which was tab B's. So when the tab's token belongs to a DIFFERENT account
// than the cookie, the sign-out takes that tab's account — its token, and anything issued under that
// account's own session — and leaves the cookie (the other account) alone. In every other case, the rule
// above: the machine.
app.post("/api/auth/logout", (req, res) => {
  const token = getRequestAuthContextToken(req);
  const cookieUserId = req.session?.passport?.user ?? null;
  if (token && cookieUserId != null && req.authContextToken && req.user && req.user.id !== cookieUserId) {
    const ctx = authContextAuthAt(token);
    revokeBrowserAuthContexts(ctx?.sid && ctx.sid !== req.sessionID ? ctx.sid : null, token);
    return res.json({ ok:true, scope:"tab" });
  }
  // req.logout() regenerates the session, so read the sid we are revoking against BEFORE it runs.
  const sid = req.sessionID;
  revokeBrowserAuthContexts(sid, token);
  try { forgetSessions(db, [sid]); } catch {}
  req.logout(() => {
    // Destroy rather than leave the regenerated-but-empty session behind, so nothing survives
    // this request that could be replayed.
    req.session?.destroy?.(() => {
      res.clearCookie("connect.sid", {
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:SESSION_SAMESITE,
      });
      res.json({ ok:true, scope:"browser" });
    });
  });
});

app.get("/api/auth/me", (req, res) =>
  req.isAuthenticated() || req.authContextToken
    ? res.json({ authenticated:true, user:publicUser(req.user) })
    : res.json({ authenticated:false })
);

app.get("/api/auth/extension-token", requireAuth, (req, res) => {
  if (req.user?.isAdmin) return refuseAdmin(res);   // ⛔ D95: never a user token for an admin identity
  // sessionLess: the extension is not a tab of this browser profile, so signing out of the
  // browser must not silently kill it. It has its own revoke endpoint below.
  const token = issueAuthContext(req.user.id, req, { userAgent: "resume-master-extension", sessionLess: true });
  res.json({ token });
});

app.post("/api/auth/revoke-extension-token", requireAuth, (req, res) => {
  db.prepare(`
    UPDATE auth_contexts
    SET revoked_at=unixepoch()
    WHERE user_id=? AND revoked_at IS NULL AND user_agent='resume-master-extension'
  `).run(req.user.id);
  res.json({ ok: true });
});

// ── AJ1 decision 6b — THE MOBILE CREDENTIAL ──────────────────────────────────────────────────
//
// A native app is not a tab. It keeps no cookie jar, so the connect.sid session that a browser
// falls back on does not exist for it, and the token IS the whole credential.
//
// THE DEFECT THIS AVOIDS. POST /api/auth/login issues a token bound to `req.sessionID`. For a
// cookie-less caller that sid is a throwaway the client will never present again, so the binding
// is meaningless — and worse than meaningless, because revokeBrowserAuthContexts() revokes every
// token sharing a sid. A phone's token would be filed under a session nobody can sign out of and
// nobody can audit. That is the same class of defect as a row written under the wrong
// domain_profile_id: self-consistent on both sides, and joined to the wrong thing.
//
// So mobile does what the extension does: signs in once to get a session-bound token, exchanges it
// HERE for a sessionLess one, and discards the first. sessionLess:true stores session_sid NULL,
// which revokeBrowserAuthContexts deliberately never sweeps.
//
// WHY A SECOND ENDPOINT RATHER THAN REUSING THE EXTENSION'S. The revoke below keys on user_agent,
// so a shared endpoint would mean "sign out my phone" also killing the extension, and vice versa.
// Two independent credentials must be independently revocable. The two handlers are deliberately
// near-identical rather than folded into one helper: test/authCredentialLifecycle.test.js asserts
// the extension's guarantees as source strings INSIDE its route block, and hiding them behind a
// shared helper would weaken a guard in order to save four lines.
app.get("/api/auth/mobile-token", requireAuth, (req, res) => {
  if (req.user?.isAdmin) return refuseAdmin(res);   // ⛔ D95: an admin identity is never given a user token
  const token = issueAuthContext(req.user.id, req, { userAgent: "resume-master-mobile", sessionLess: true });
  res.json({ token, idleSeconds: AUTH_CONTEXT_IDLE_SECONDS, absoluteSeconds: AUTH_CONTEXT_ABSOLUTE_SECONDS });
});

app.post("/api/auth/revoke-mobile-token", requireAuth, (req, res) => {
  db.prepare(`
    UPDATE auth_contexts
    SET revoked_at=unixepoch()
    WHERE user_id=? AND revoked_at IS NULL AND user_agent='resume-master-mobile'
  `).run(req.user.id);
  res.json({ ok: true });
});

app.get("/api/auth/active-profile", requireAuth, (req, res) => {
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) return res.status(404).json({ error: "No active profile" });
  res.json({
    profileId: activeProfile.id,
    targetRole: activeProfile.profile_name || "",
    name: activeProfile.profile_name || "",
    location: activeProfile.location || "",
  });
});

// ═══════════════════════════════════════════════════════════════
// DOMAIN PROFILES
// ═══════════════════════════════════════════════════════════════
// /api/domain-profiles        — CRUD + activate
// /api/domain-profiles/metadata[/:domain]  — registry (no auth)
// /api/domain-profiles/generate-chips      — AI chip generation
app.use("/api/domain-profiles", requireAuth, createDomainProfilesRouter(db, anthropic, emitToUser, {
  // Résumé, signals, claims, profile fields, activation: any of them can change the basis the
  // board's fit is scored against. Only the ACTIVE profile is re-scored — it is the one the board
  // is ranked for; a background profile catches up when it is activated (activation is a write
  // here too).
  onProfileWrite: (userId, profileId, what) => {
    const p = db.prepare("SELECT * FROM domain_profiles WHERE id = ? AND user_id = ? AND is_active = 1")
      .get(profileId, userId);
    if (p) scheduleBoardFit(userId, `profile ${what}`, p);
  },
}));
// D41(c): a captured company's logo is queued at capture time — off wherever A77's pass is off.
app.use("/api/import", requireAuth, createImportJobRouter(db, {
  queueLogo: process.env.COMPANY_LOGOS === "off" ? null : (target) => resolveCaptureLogo(db, target),
}));
// D12: is this user's extension connected (a live extension token)? Drives Full House's first-run prompt.
app.get("/api/extension/status", requireAuth, extensionStatusHandler(db));
// D55 decision E: "Report this form" — the form's HOST and field LABELS, never a value (services/formReports.js).
app.post("/api/form-reports", requireAuth, formReportHandler(db));
app.use("/api/company-kb", requireAuth, createCompanyKbRouter(db, requireAdmin));
// RETIRED (E2). imported_jobs had exactly one writer — save-job, above — and zero rows. Its reading
// surface was a board panel promising that captured jobs "appear here", which they never did: the
// hotkey has always written to scraped_jobs. Converged captures are starred into user_jobs by
// importJob's attachImportToUser, so they now appear in the board's own "Saved" tab, which already
// queries starred=1. One populated surface instead of two, one of which was always empty.
app.all(/^\/api\/imported-jobs(\/.*)?$/, (_req, res) => {
  res.status(410).json({
    error: "Imported jobs have been merged into the main board. Captured jobs appear under Saved.",
  });
});

// FE-4 company view — aggregates technographics (Task 5) + org units (9.5) + hiring signals
// (9.7) into one read-only payload. Same auth tier as /api/company-kb (session only, no admin
// gate — these are all evidence-labeled reads, not ground truth).
app.get("/api/company/:company", requireAuth, (req, res) => {
  res.json(getCompanyProfile(db, req.params.company));
});

// FE-6 recruiter surface — candidate-claim consistency check. Reuses the 9.6 failsafe
// validator; advisory only (consistent / flagged / no_claim + evidence), never a verdict on
// the person. Stateless: resumeText is read from the request body and never persisted —
// no INSERT anywhere in this path.
app.post("/api/company/:company/consistency-check", requireAuth, (req, res) => {
  const { resumeText } = req.body || {};
  if (!resumeText || typeof resumeText !== "string") {
    return res.status(400).json({ error: "resumeText is required" });
  }
  res.json(checkCandidateConsistency(db, req.params.company, resumeText));
});

// ─── CHROME EXTENSION — save-job, RETIRED (E2) ───────────────────────────────
// The extension had two capture paths: this one wrote to imported_jobs keyed by dedupe_key, while
// the hotkey wrote to scraped_jobs keyed by req_uid. Same button-shaped promise, two destinations,
// two dedup identities — so a job captured both ways existed twice and neither copy knew about the
// other. They are now one path: /api/import/job into scraped_jobs, which is the BYO-1 reconciler and
// the only writer that participates in cross-source dedup (direct ATS > provider > aggregator >
// import).
//
// 410 rather than deletion, following the /api/scrape precedent: a caller that still exists learns
// what happened instead of getting an ambiguous 404. imported_jobs itself is left in place —
// migrations here are additive-only — but nothing writes to it any more.
app.all("/api/extension/save-job",
  cors({ origin: corsOriginExtension, credentials: true }),
  (_req, res) => {
    res.status(410).json({
      error: "The save-job endpoint has been removed. Capture now uses /api/import/job, which is " +
             "the same path the capture shortcut uses.",
    });
  });

// /api/extension/save-jobs-bulk REMOVED (cleanup 5.4). Its only client was the extension's
// saved-jobs-content.js, deleted in v1.2.0 along with the LinkedIn bulk-scraping capability
// BYO-2 retired. The endpoint outlived its caller and still accepted bulk writes into
// imported_jobs. The single-job save-job endpoint above is now retired too (E2), so nothing
// writes to imported_jobs at all.

// Metadata is also public — mount without requireAuth at a sub-path so
// the chip registry is accessible from the wizard before login
app.get("/api/domain-metadata",       (_req, res) => res.redirect(307, "/api/domain-profiles/metadata"));
app.get("/api/domain-metadata/:key",  (req, res) => res.redirect(307, `/api/domain-profiles/metadata/${req.params.key}`));

// Mark onboarding complete (called by wizard on profile save, also done inside createDomainProfilesRouter)
// Helper: insert a notification and emit SSE so badges update live.
function insertNotification(userId, type, message, payload = null) {
  try {
    const row = db.prepare(
      "INSERT INTO notifications (user_id, type, message, payload) VALUES (?,?,?,?)"
    ).run(userId, type, message, payload ? JSON.stringify(payload) : null);
    emitToUser(userId, { type: "notification", id: row.lastInsertRowid, notif_type: type, message });
  } catch(e) {
    console.warn("[notification] insert failed:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN · BOARD FIT PRECOMPUTE
// ═══════════════════════════════════════════════════════════════
// POST /api/admin/board-fit/precompute   { dryRun?: boolean = true, userId?: number, force?: boolean }
//
// DRY RUN BY DEFAULT: the plan per active profile — active / fresh / missing / stale / todo — with
// nothing scored and nothing written. `dryRun: false` runs the same incremental pass the automatic
// triggers run and returns each profile's status (scored / nothing_to_do / failed / no_basis) with
// its counts and timing. `force: true` re-scores fresh rows too — the way to pick up a term-weight
// refresh, which is deliberately not part of the basis hash.
//
// Works when BOARD_FIT_PRECOMPUTE=off: that switch stops the AUTOMATIC triggers, and an operator
// who turned them off still needs a way to run a pass on purpose.
//
// Awaited, because an admin asking "what happened" wants the answer: ~7 ms per posting per profile
// on an idle machine, so a single profile over a 2,600-posting board answers in well under a minute.
app.post("/api/admin/board-fit/precompute", requireAdmin, async (req, res) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    const userId = req.body?.userId != null ? Number(req.body.userId) : null;
    const out = await boardFit().runAll({ dryRun, force: !!req.body?.force, reason: "admin", userId });
    res.json({ success: true, dryRun, ...out });
  } catch (e) {
    console.error("[board-fit] admin run failed:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN BACKUP / RESTORE
// ═══════════════════════════════════════════════════════════════
app.get("/api/admin/backups", requireAdmin, (_req, res) => {
  try { res.json(listBackups()); } catch(e) { res.status(500).json({ error:e.message }); }
});
app.post("/api/admin/backups", requireAdmin, (req, res) => {
  try {
    const result = createBackup(req.body.label||"manual");
    res.json({ ok:true, ...result });
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.post("/api/admin/backups/restore", requireAdmin, (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error:"filename required" });
  try {
    const result = restoreBackup(filename);
    res.json({ ok:true, ...result, message:"Restore complete. Restart the server to apply." });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════
// ⛔ D95: user lists are USER accounts — never an admin, never the system row.
app.get("/api/admin/users", requireAdmin, (req, res) => {
  res.json(db.prepare("SELECT id,username,apply_mode,plan_tier,created_at FROM users WHERE id != 0 AND COALESCE(is_admin,0) = 0 ORDER BY created_at DESC").all());
});
// ⛔ D95: this creates a USER account and nothing else. There is no admin flag to set — an admin is an admin account
// (Admin → System → Admins), never a users row. An `isAdmin` in the body is ignored.
app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, password, planTier } = req.body;
  if (!username||!password) return res.status(400).json({ error:"username and password required" });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error:passwordError });
  const tier = normalisePlanTier(planTier || "BASIC");
  try {
    db.prepare("INSERT INTO users (username,password_hash,password_set,is_admin,apply_mode,plan_tier) VALUES (?,?,1,0,?,?)")
      .run(username, hashPassword(password), allowedModesForTier(tier)[0], tier);
    const u = db.prepare("SELECT id FROM users WHERE username=?").get(username);
    db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(u.id);
    res.json({ ok:true });
  } catch(e) { res.status(400).json({ error:e.message.includes("UNIQUE")?"Username taken":e.message }); }
});
// A58 (a): the admin delete is the user's own delete (accountService.deleteAccount — files, sessions,
// usage_tracking_failures), behind a per-table preview and the target's username typed back. It
// refuses the `system` account (id 0), every admin, and the caller. See services/adminUserDelete.js.
const adminDeleteError = (res, e) => e instanceof AccountError
  ? res.status(e.status).json({ error: e.message, code: e.code })
  : res.status(500).json({ error: e.message });
app.get("/api/admin/users/:id/delete-preview", requireAdmin, (req, res) => {
  try { res.json(adminDeletePreview(db, Number(req.params.id), actorOf(req))); }
  catch (e) { adminDeleteError(res, e); }
});
app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const confirmUsername = req.body?.confirmUsername;
  try {
    checkAdminDeleteConfirmed(db, id, { actorId: actorOf(req), confirmUsername });
    // Sessions first: the sealed store is found through rows the cascade is about to remove.
    await revokeAllUserSessions(id, "admin_delete");
    const { files, counts } = adminDeleteUser(db, id, { actorId: actorOf(req), confirmUsername });
    removeDataFiles(DATA_DIR, files);
    console.log(`[admin] user ${id} deleted by ${actorRef(req)}`);
    res.json({ ok:true, counts, filesRemoved: files.length });
  } catch (e) { adminDeleteError(res, e); }
});
app.patch("/api/admin/users/:id/password", requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error:"password required" });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error:passwordError });
  const targetId = parseInt(req.params.id);
  if (isAdminUserRow(targetId)) return res.status(404).json({ error:"No such user." });   // ⛔ D95: user accounts only
  db.prepare("UPDATE users SET password_hash=?, password_set=1 WHERE id=?")
    .run(hashPassword(password), targetId);
  // Same reasoning as the self-service reset: an admin resetting someone's password is locking an
  // account, and it does not lock anything if the existing sessions keep working.
  await revokeAllUserSessions(targetId, "admin_password_change");
  res.json({ ok:true });
});
app.patch("/api/admin/users/:id/plan", requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const rawTier = String(req.body?.planTier || "").toUpperCase();
  if (!["BASIC","PLUS","PRO"].includes(rawTier)) return res.status(400).json({ error:"Invalid plan tier" });
  const tier = normalisePlanTier(rawTier);
  const mode = allowedModesForTier(tier)[0];
  if (isAdminUserRow(userId)) return res.status(404).json({ error:"No such user." });   // ⛔ D95: user accounts only
  db.prepare("UPDATE users SET plan_tier=?, apply_mode=? WHERE id=?").run(tier, mode, userId);
  db.prepare(`
    UPDATE plan_upgrade_requests
    SET status='approved', decided_at=unixepoch(), decided_by=?, decided_by_actor=?
    WHERE user_id=? AND status='pending'
  `).run(actorUserId(req), actorRef(req), userId);
  emitToUser(userId, { type:"plan_updated", planTier:tier, applyMode:mode });
  res.json({ ok:true, planTier:tier, applyMode:mode });
});
app.get("/api/admin/upgrade-requests", requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT pur.*, u.username, u.plan_tier
    FROM plan_upgrade_requests pur
    JOIN users u ON u.id = pur.user_id
    ORDER BY pur.status = 'pending' DESC, pur.requested_at DESC
  `).all();
  res.json(rows);
});
app.patch("/api/admin/upgrade-requests/:id/grant", requireAdmin, (req, res) => {
  const request = db.prepare("SELECT * FROM plan_upgrade_requests WHERE id=? AND status='pending'").get(parseInt(req.params.id));
  if (!request) return res.status(404).json({ error:"Not found" });
  const tier = normalisePlanTier(request.requested_tier);
  const mode = allowedModesForTier(tier)[0];
  db.prepare("UPDATE users SET plan_tier=?, apply_mode=? WHERE id=?").run(tier, mode, request.user_id);
  db.prepare(`
    UPDATE plan_upgrade_requests
    SET status='approved', decided_at=unixepoch(), decided_by=?, decided_by_actor=?
    WHERE id=?
  `).run(actorUserId(req), actorRef(req), request.id);
  db.prepare(`
    UPDATE plan_upgrade_requests
    SET status='superseded', decided_at=unixepoch(), decided_by=?, decided_by_actor=?
    WHERE user_id=? AND status='pending'
  `).run(actorUserId(req), actorRef(req), request.user_id);
  emitToUser(request.user_id, { type:"plan_updated", planTier:tier, applyMode:mode });
  res.json({ ok:true, userId:request.user_id, planTier:tier, applyMode:mode });
});
app.get("/api/admin/domain-profile-requests", requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT dpr.*, u.username
    FROM domain_profile_requests dpr
    JOIN users u ON u.id = dpr.user_id
    ORDER BY dpr.status = 'pending' DESC, dpr.created_at DESC
  `).all();
  res.json(rows.map(r => ({
    ...r,
    target_titles: JSON.parse(r.target_titles_json || "[]"),
    skills: JSON.parse(r.skills_json || "[]"),
    tools: JSON.parse(r.tools_json || "[]"),
    industries: JSON.parse(r.industries_json || "[]"),
    keywords: JSON.parse(r.keywords_json || "[]"),
  })));
});
app.patch("/api/admin/domain-profile-requests/:id/status", requireAdmin, (req, res) => {
  const status = String(req.body?.status || "").trim();
  if (!["pending","reviewing","resolved","dismissed"].includes(status)) {
    return res.status(400).json({ error:"Invalid status" });
  }
  const result = db.prepare(`
    UPDATE domain_profile_requests
    SET status=?, updated_at=unixepoch()
    WHERE id=?
  `).run(status, parseInt(req.params.id));
  if (!result.changes) return res.status(404).json({ error:"Not found" });
  res.json({ ok:true, status });
});
// ⛔ 10-09 (release check / D88: "eligibility answers (sponsorship, work authorisation, clearance, EEO) are NEVER
// shown"): this was `SELECT *` — every self-identification and eligibility answer, the phone, the street
// address and the saved custom answers, to any admin. Now an ALLOW-LIST of what support work needs.
const ADMIN_PROFILE_FIELDS = Object.freeze(["user_id", "full_name", "first_name", "last_name", "email", "location", "city", "state",
  "country", "current_job_title", "current_company", "years_of_experience", "seniority_level", "target_domains",
  "target_locations", "onboarded", "updated_at"]);
app.get("/api/admin/users/:id/profile", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(parseInt(req.params.id)) || {};
  res.json(Object.fromEntries(ADMIN_PROFILE_FIELDS.filter(k => k in row).map(k => [k, row[k]])));
});
// ── AF residual: A WRITE PATH FOR THE FULL-AUTO KILL SWITCH ────────────────────────────
//
// The switch has worked since 072. `fullAutoDisabled()` reads app_settings first and falls back to
// APPLY_FULL_AUTO_DISABLED, and routes/apply.js re-checks it PER JOB, not only at admission — so a
// run already in flight stops submitting the moment it flips. What was missing was any way to flip
// it without opening a SQL console or redeploying, and a kill switch you cannot reach in a hurry
// is not a kill switch. That is the whole of this change: reach, not mechanism.
//
// THREE STATES, NOT TWO, which is why DELETE exists alongside PUT. "forced off", "forced on" and
// "inherit whatever the deploy sets" are genuinely different, and without a way to remove the row
// there is no way back to the third. A PUT of `false` is NOT the same as clearing: it pins the
// switch open even if a later deploy sets APPLY_FULL_AUTO_DISABLED=1.
app.get("/api/admin/full-auto", requireAdmin, (_req, res) => {
  res.json(fullAutoState(db));
});

app.put("/api/admin/full-auto", requireAdmin, (req, res) => {
  // Strict boolean. A kill switch must never be flipped by a typo coercing to truthy — "flase"
  // would otherwise read as ON and quietly resume submitting to real employers.
  const { disabled } = req.body || {};
  if (typeof disabled !== "boolean") {
    return res.status(400).json({
      error: "disabled must be a boolean",
      hint: 'PUT {"disabled": true} to stop full-auto submission, {"disabled": false} to pin it on, DELETE to inherit the deploy default.',
    });
  }
  setSetting(db, FULL_AUTO_KEY, disabled);
  const state = fullAutoState(db);
  // Logged rather than silent: this is the one setting whose change has a real-world consequence
  // — applications going out to employers — and app_settings keeps only the current value, so the
  // log is the only record that it moved and who moved it.
  console.warn(`[killswitch] full-auto ${state.disabled ? "DISABLED" : "ENABLED"} by ${actorRef(req)} (override)`);
  res.json(state);
});

// ⛔ D175 FA6: the four checks an unattended send waits for — read, and an admin records the two that are tests
// (POST { check: "kill_switch_verified" | "never_twice_verified", reason } — or { check, clear: true }). Audited.
app.get("/api/admin/full-auto/prerequisites", requireAdmin, (_req, res) => res.json(fullAutoPrerequisites(db)));
app.post("/api/admin/full-auto/prerequisites", requireAdmin, (req, res) => {
  const { check, reason = null, clear = false } = req.body || {};
  try {
    const out = recordAttestation(db, String(check || ""), { actor: actorOf(req), reason, clear: clear === true });
    console.warn(`[full-auto] prerequisite ${check} ${clear === true ? "CLEARED" : "recorded"} by ${actorRef(req)}`);
    res.json(out);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.delete("/api/admin/full-auto", requireAdmin, (req, res) => {
  clearSetting(db, FULL_AUTO_KEY);
  const state = fullAutoState(db);
  console.warn(`[killswitch] full-auto override CLEARED by ${actorRef(req)}; now ${state.disabled ? "disabled" : "enabled"} from env`);
  res.json(state);
});

// ── D123 (owner 11-01): "switch the prompt between lean or the payload from the admin panel, or the model being used from
// the users side". Same three states as the kill switch above: PUT pins a value, DELETE inherits the deploy default.
const tailoringAdminView = () => ({ ...tailoringState(db), models: { ...modelSettings(db), choices: [...MODEL_CHOICES], labels: MODEL_LABELS } });
app.get("/api/admin/tailoring", requireAdmin, (_req, res) => res.json(tailoringAdminView()));
app.put("/api/admin/tailoring", requireAdmin, (req, res) => {
  const { mode, modelDefault, modelsOffered, aPlus } = req.body || {};
  if (aPlus !== undefined && typeof aPlus !== "boolean") return res.status(400).json({ error: "aPlus must be true or false" });
  if (mode !== undefined && !TAILORINGS.includes(mode)) return res.status(400).json({ error: `mode must be one of ${TAILORINGS.join(", ")}` });
  if (modelDefault !== undefined && modelDefault !== "service" && !MODEL_CHOICES.includes(modelDefault)) {
    return res.status(400).json({ error: `modelDefault must be service or one of ${MODEL_CHOICES.join(", ")}` });
  }
  if (modelsOffered !== undefined && (!Array.isArray(modelsOffered) || modelsOffered.some(m => !MODEL_CHOICES.includes(m)))) {
    return res.status(400).json({ error: `modelsOffered must be a list of ${MODEL_CHOICES.join(", ")}` });
  }
  if (mode !== undefined) setSetting(db, TAILORING_KEY, mode);
  if (modelDefault !== undefined) setSetting(db, MODEL_DEFAULT_KEY, modelDefault);
  if (modelsOffered !== undefined) setSetting(db, MODELS_OFFERED_KEY, [...new Set(modelsOffered)].join(","));
  if (aPlus !== undefined) {
    const before = aPlusOverride(db);
    if (aPlus) setSetting(db, APLUS_OVERRIDE_KEY, "on"); else clearSetting(db, APLUS_OVERRIDE_KEY);
    try { writeAudit(db, { actor: actorOf(req), action: "tailoring_aplus_override", target: APLUS_OVERRIDE_KEY, before: { on: before }, after: { on: aPlus } }); }
    catch (e) { console.warn("[tailoring] the A+ override's audit row was not written:", e.message); }
  }
  const view = tailoringAdminView();
  console.warn(`[tailoring] mode ${view.mode} (${view.source}), model default ${view.models.default}, offered ${view.models.offered.join(",") || "none"}, A+ override ${view.aPlusOverride ? "ON" : "off"} — set by ${actorRef(req)}`);
  res.json(view);
});
app.delete("/api/admin/tailoring", requireAdmin, (req, res) => {
  clearSetting(db, TAILORING_KEY);
  const view = tailoringAdminView();
  console.warn(`[tailoring] mode override CLEARED by ${actorRef(req)}; now ${view.mode} (${view.source})`);
  res.json(view);
});

// The person's side: which model tailors their résumés (only what the admin offers), their gists and their courses.
app.get("/api/settings/tailoring-model", requireAuth, (req, res) => {
  const s = modelSettings(db);
  const mine = userModelChoice(db, req.user.id);
  res.json({ choice: mine && s.offered.includes(mine) ? mine : null, default: s.default,
             offered: s.offered.map(id => ({ id, label: MODEL_LABELS[id] })), defaultLabel: MODEL_LABELS[s.default] });
});
app.put("/api/settings/tailoring-model", requireAuth, (req, res) => {
  const choice = req.body?.choice ?? null;
  if (choice !== null && !modelSettings(db).offered.includes(choice)) return res.status(400).json({ error: "That model is not offered." });
  db.prepare("UPDATE users SET tailoring_model=? WHERE id=?").run(choice, req.user.id);
  res.json({ choice });
});
app.get("/api/profile/gists", requireAuth, (req, res) => {
  const g = latestGists(db, req.user.id);
  res.json({ gists: g?.gists || [], numberless: g?.numberless || [], edited: !!g?.edited, hash: g?.hash || null,
             coursework: readCoursework(db, req.user.id) });
});
app.put("/api/profile/gists", requireAuth, (req, res) => {
  const { hash, gists } = req.body || {};
  const problem = typeof hash !== "string" ? "hash is required" : validateGists(gists);
  if (problem) return res.status(400).json({ error: problem });
  const saved = saveEditedGists(db, req.user.id, hash, gists);
  if (!saved) return res.status(404).json({ error: "No gists for that résumé." });
  res.json({ gists: saved, edited: true });
});
app.put("/api/profile/coursework", requireAuth, (req, res) => {
  const saved = saveCoursework(db, req.user.id, req.body?.coursework);
  if (!saved) return res.status(400).json({ error: "coursework must be a list of at most 20 course names" });
  res.json({ coursework: saved });
});

app.get("/api/admin/users/:id/applications", requireAdmin, (req, res) => {
  // ⛔ A107: a whole row carries Note why's private text — redacted like every raw row an admin reads (adminSafety.js).
  res.json(redactRows(db.prepare("SELECT * FROM job_applications WHERE user_id=? ORDER BY applied_at DESC").all(parseInt(req.params.id))));
});
// (quota reset routes removed — no refresh cap)

// Analytics admin routes (usage tracking, limits, timeseries)
app.use("/api/admin/analytics", createAdminRouter(db));
// ⭐ D88 P2 + P4 · Admin → People → Users: the list, a person's page, the utilities (routes/adminPeople.js).
// "Send a password-reset link" is the same reset the user can ask for themselves — D88: never set a password.
async function adminSendResetLink(userId, req) {
  const row = db.prepare("SELECT u.id, p.email FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE u.id = ?").get(userId);
  if (!row) throw new UserAdminError("No such user.", 404);
  if (!row.email) return { sent: false, why: "The account has no email address to send a link to." };
  const user = findUserForPasswordReset(db, row.email);
  if (!user || user.id !== userId) return { sent: false, why: "That email address does not lead back to this account alone." };
  const reset = createPasswordReset(db, user, { pepper: PASSWORD_RESET_SECRET, requestIp: req.ip, userAgent: "admin: reset link" });
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/login?resetToken=${encodeURIComponent(reset.token)}`;
  let mail = null;
  try { mail = await sendPasswordResetEmail({ to: user.email, resetUrl, otp: reset.otp, expiresAt: reset.expiresAt }, { db }); }
  catch (e) { console.error("[admin-people] reset link send failed:", e.message); }
  if (!mail?.ok) {
    db.prepare("UPDATE password_reset_tokens SET used_at=unixepoch() WHERE id=?").run(reset.id);
    return { sent: false, why: "Email is not configured on this server, or the send failed — nothing was sent." };
  }
  return { sent: true, why: null };
}
// ⭐ D88 P5 · Settings → Your plan and allowance: the user's own, read-only — never money, never the A+ swap.
app.get("/api/account/allowance", requireAuth, (req, res) => {
  try { res.json(selfAllowance(db, req.user.id)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// ⭐ D88 P3 · support tickets — the user's own (Settings → Help) and the admin queue (Admin → People → Support).
{
  const support = createSupportRouters({ db, requireAuth, requireAdmin, sendEmail, supportEmail: SUPPORT_EMAIL,
    appUrl: (req) => (process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "") });
  app.use("/api/support", requireAuth, support.user);
  app.use("/api/admin/tickets", requireAdmin, support.admin);
}
// ⭐ D90 P1 · "what we changed" — any two of a job's résumés compared (routes/resumeChanges.js). Read-only, own data only.
app.use(createResumeChangesRouter({ db, requireAuth }));
// ⭐ D157 / D171 FIX 4 · the embedded résumé editor's two reads (routes/resumeEditor.js): where it lives, and an attempt's résumé as HTML.
app.use(createResumeEditorRouter({ db, requireAuth }));
// ⭐ D171 FIX 3 · an application's posting from its Home row, as stored when it was made (routes/applicationPosting.js).
app.use(createApplicationPostingRouter({ db, requireAuth }));
// ⛔ D95 · the admin's own door (public: sign-in, links, break glass) and Admin → System → Admins (owner only).
{
  const adminAuth = createAdminAuthRouters({ db, requireAdmin, production: IS_PRODUCTION, sendEmail,
    baseUrl: (req) => process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}` });
  app.use("/api/admin/auth", adminAuth.authRouter);
  app.use("/api/admin/admins", adminAuth.adminsRouter);
}
app.use("/api/admin/people", requireAdmin, createAdminPeopleRouter({
  db, requireAdmin, signOutEverywhere: (id, why) => revokeAllUserSessions(id, why), sendResetLink: adminSendResetLink,
}));
// Captured, not just mounted: the nightly alert delivery calls `adminDbRouter.pipelineHealth()` —
// the SAME computation this route serves. See the note above that function in routes/adminDb.js.
const adminDbRouter = createAdminDbRouter(db, { dbPath: DB_PATH });
app.use("/api/admin/db", adminDbRouter);
// A50 step 3 — the daily glance (docs/ADMIN_PANEL_REVAMP.md §2A). Ingestion and enrichment come
// from adminDbRouter.pipelineHealth() — the one computation the nightly alert also reads — and are
// only SELECTED from here, never recomputed. Read-only; every section states when it was measured.
// A50 step 7 (ADMIN_PANEL_REVAMP §3 — the second service had no health, no per-client usage and no
// token status): the tools service (toolsService), as draft sees it. Health and version are its public routes (no token
// sent); whether draft HOLDS a token is a yes/no, never the token. Per-client usage lives in the
// service's own metering log and is not visible from here — said, not hidden.
app.get("/api/admin/tools-service", requireAdmin, async (_req, res) => {
  const base = String(process.env.RESUME_MASTER_URL || "").replace(/\/+$/, "");
  const out = { configured: !!toolsService.configured, url: base || null, tokenHeld: !!process.env.RESUME_MASTER_TOKEN,
    measuredAt: Math.floor(Date.now() / 1000), health: null, version: null, error: null,
    usageNote: "Per-client usage is in the tools service's own metering log (one line per call); it is not readable from draft." };
  if (!base) return res.json({ ...out, error: "RESUME_MASTER_URL is not set" });
  const get = async (path) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    try { const r = await fetch(base + path, { signal: ctl.signal }); return { status: r.status, body: await r.json().catch(() => null) }; }
    finally { clearTimeout(t); }
  };
  try {
    const [h, v] = await Promise.all([get("/health"), get("/v1/version")]);
    out.health = h; out.version = v.body;
  } catch (e) { out.error = e.name === "AbortError" ? "no answer within 5 s" : e.message; }
  res.json(out);
});

app.get("/api/admin/glance", requireAdmin, (_req, res) => {
  try {
    res.json(buildGlance(db, {
      health: adminDbRouter.pipelineHealth(),
      enrichBudget: enrichBudget(),
      fullAuto: fullAutoState(db),
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// U1/U2/U3/U4 — the manual enrichment path: dry-run trigger, JSONL export/import, and batch
// provenance. Enrichment previously had three triggers and all three were automatic, which is how
// 837 of ~1252 active production rows sat unenriched through the Groq 404 outage with no way to
// intervene. The router is admin-gated and every spending or writing route is DRY BY DEFAULT.
app.use("/api/admin/enrichment", requireAdmin, createEnrichmentRouter(db, requireAdmin, { anthropic }));
// A62: the JOBS themselves in and out (NDJSON), through the one gateway; dry by default, revertible.
app.use("/api/admin/job-data", requireAdmin, createJobDataRouter(db, requireAdmin));
// A50 step 4: the company list as a surface — probe a board before adding it; enable / disable, logged.
app.use("/api/admin/companies", requireAdmin, createCompaniesRouter(db, requireAdmin, { dataDir: DATA_DIR }));
// ⭐ D67 (2): the learned origin pairs — hostnames and counts only — and the revoke switch, logged.
app.get("/api/admin/apply-origins", requireAdmin, (_req, res) => res.json({ pairs: listLearnedPairs(db), promoteAtUsers: PROMOTE_AT_USERS }));
app.post("/api/admin/apply-origins/:id/revoke", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const revoked = req.body?.revoked !== false;
  const before = db.prepare("SELECT * FROM apply_origin_pairs WHERE id=?").get(id);
  if (!before) return res.status(404).json({ error: "pair_not_found" });
  setPairRevoked(db, id, revoked);
  const after = db.prepare("SELECT * FROM apply_origin_pairs WHERE id=?").get(id);
  writeAudit(db, { actor: actorOf(req), action: revoked ? "apply_origin_revoke" : "apply_origin_restore", target: `apply_origin_pairs:${id}`, before, after });
  res.json({ ok: true, pair: after });
});
// D75: a pair the crawler OBSERVED (J2) is never promoted by the crawler — the owner promotes it here, logged.
app.post("/api/admin/apply-origins/:id/promote", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const before = db.prepare("SELECT * FROM apply_origin_pairs WHERE id=?").get(id);
  if (!before) return res.status(404).json({ error: "pair_not_found" });
  const r = setPairPromoted(db, id, req.body?.promoted !== false);
  if (!r.ok) return res.status(409).json({ error: r.reason });
  const after = db.prepare("SELECT * FROM apply_origin_pairs WHERE id=?").get(id);
  writeAudit(db, { actor: actorOf(req), action: "apply_origin_promote", target: `apply_origin_pairs:${id}`, before, after });
  res.json({ ok: true, pair: after });
});
// D20: the slug harvest in the daily manual sweep — SerpApi searches started by a person, an export the
// owner reviews, an import that adds companies. No cron, no model call.
app.use("/api/admin/slug-harvest", requireAdmin, createSlugHarvestRouter(db, requireAdmin, {
  gate: (companies) => trancheGate(db, DATA_DIR, { companies }) }));
// ⛔ D77: the disk gauge (in place of Railway's Pro-only volume alert) and what a D74 tranche of 25 would do to it.
app.get("/api/admin/disk", requireAdmin, (_req, res) => {
  try {
    const gauge = readGauge(DATA_DIR);
    res.json({ ...gauge, amberAt: DISK_AMBER_AT, redAt: DISK_RED_AT, tranche25: projectTranche(db, gauge, { companies: 25 }) });
  } catch (e) { res.status(500).json({ error: "disk_unreadable", detail: e.message }); }
});
// Owner 11-02 (the volume filled and sign-ups failed): past 80% the owner is EMAILED and the log says so — the banner
// above only shows on an open Admin page. Checked every 10 minutes (services/diskAlert.js).
setInterval(() => {
  checkDiskAlert(db, DATA_DIR, { send: sendEmail, to: process.env.ADMIN_OWNER_EMAIL })
    .catch(e => console.error("[disk-alert] check failed:", e.message));
}, DISK_ALERT_EVERY_MS).unref();
// D75: the crawler's queue, deny-list and tally (the owner's controls).
app.use("/api/admin/crawler", requireAdmin, createCrawlerAdminRouter(db, requireAdmin));
// D75 STEP 0b: the crawler's schedule (Admin → Crawler) — once a day at the owner's HH:MM UTC draft ENQUEUES up to N
// tasks from the captured companies. It never leases: a task still waits for Resume, the mode and a worker.
setInterval(() => {
  runCrawlerSchedule(db).then(r => { if (r.ran) console.log(`[crawler] schedule queued ${r.queued} of ${r.offered} candidate(s)`); })
    .catch(e => console.error("[crawler] schedule failed:", e.message));
}, 5 * 60 * 1000).unref();
// D76: the last Railway event per service (a failed or crashed deploy is the card's red) and the stream.
app.get("/api/admin/deploy-events", requireAdmin, (_req, res) => res.json(deployEventsSummary(db)));
// ⛔ D78 A: the board's age policy and its sweep. GET = the policy + a DRY RUN of the sweep · PUT = change the policy
// (no redeploy) · POST /sweep = run it — dry unless { apply: true, expectCandidates: <the dry run's count> }. No share
// ceiling (removed on the owner's word 10-08). Applied postings are always kept; nothing is deleted.
app.get("/api/admin/board-policy", requireAdmin, (_req, res) => {
  res.json({ policy: readBoardPolicy(db), dryRun: sweepAged(db, { dryRun: true }), scopeDryRun: sweepScope(db, { dryRun: true }) });
});
app.put("/api/admin/board-policy", requireAdmin, (req, res) => {
  try { res.json({ policy: setBoardPolicy(db, req.body || {}, { by: actorOf(req) }) }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.post("/api/admin/board-policy/sweep", requireAdmin, (req, res) => {
  const dry = sweepAged(db, { dryRun: true });
  if (req.body?.apply !== true) return res.json({ applied: false, ...dry, note: `Nothing changed. POST again with apply: true and expectCandidates: ${dry.candidates}.` });
  if (Number(req.body.expectCandidates) !== dry.candidates) return res.status(409).json({ applied: false, ...dry, error: `expectCandidates must equal the dry run's ${dry.candidates}` });
  const out = sweepAged(db, { dryRun: false,
    log: (e) => writeAudit(db, { actor: actorOf(req), action: "board_age_sweep", target: "scraped_jobs", before: { active: e.active }, after: e }) });
  res.json({ applied: true, ...out });
});
// ⛔ D78 B: the same contract for computer-science scope — dry unless { apply: true, expectCandidates }; applied
// postings kept; retired with reason out_of_scope, never deleted.
app.post("/api/admin/board-policy/scope-sweep", requireAdmin, (req, res) => {
  const dry = sweepScope(db, { dryRun: true });
  if (req.body?.apply !== true) return res.json({ applied: false, ...dry, note: `Nothing changed. POST again with apply: true and expectCandidates: ${dry.candidates}.` });
  if (Number(req.body.expectCandidates) !== dry.candidates) return res.status(409).json({ applied: false, ...dry, error: `expectCandidates must equal the dry run's ${dry.candidates}` });
  const out = sweepScope(db, { dryRun: false,
    log: (e) => writeAudit(db, { actor: actorOf(req), action: "board_scope_sweep", target: "scraped_jobs", before: { active: e.active }, after: e }) });
  res.json({ applied: true, ...out });
});
// ⛔ D127 P2 · THE CATEGORIES, MEASURED: postings by category and discipline on the active board, the held count and
// reasons (stored 'held' rows, and the refusals the enforced gate recorded, re-read for their reason), and a fresh
// random sample of up to 20 shown postings per category for the spot-check. A wrong category is one press to report:
// POST …/report writes the audit log (action board_category_report) — the spot-check log the leak rate is read from.
app.get("/api/admin/board-categories", requireAdmin, (_req, res) => {
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };
  const byCategory = Object.fromEntries(all(`SELECT COALESCE(board_category, '(not yet)') k, COUNT(*) n FROM scraped_jobs
    WHERE is_active = 1 GROUP BY k ORDER BY n DESC`).map(r => [r.k, r.n]));
  const byDiscipline = Object.fromEntries(all(`SELECT discipline k, COUNT(*) n FROM scraped_jobs WHERE is_active = 1
    AND board_category = 'engineering' GROUP BY k ORDER BY n DESC`).map(r => [r.k || "(none)", r.n]));
  const heldRows = [
    ...all(`SELECT job_id, title, company, category_reason reason, 'stored' via FROM scraped_jobs WHERE is_active = 1 AND board_category = 'held'`),
    ...all(`SELECT job_id, title, company, NULL reason, 'refused' via FROM rejected_jobs WHERE reason = 'out_of_scope'
      ORDER BY rejected_at DESC LIMIT 2000`),
  ].map(r => ({ ...r, reason: r.reason || categoryOfPosting({ title: r.title, roleKey: null }).reason }));
  const heldByReason = {};
  for (const r of heldRows) heldByReason[r.reason] = (heldByReason[r.reason] || 0) + 1;
  const sample = Object.fromEntries(Object.keys(byCategory).filter(k => /^[a-z_]+$/.test(k) && k !== "held").map(k => [k,
    all(`SELECT job_id, title, company, discipline, category_reason reason FROM scraped_jobs WHERE is_active = 1 AND board_category = ?
      ORDER BY random() LIMIT 20`, k)]));
  const reports = all(`SELECT at, before_json, after_json FROM admin_audit_log WHERE action = 'board_category_report' ORDER BY id DESC LIMIT 50`);
  res.json({ byCategory, byDiscipline, held: { total: heldRows.length, byReason: heldByReason, recent: heldRows.slice(0, 50) },
             sample, reports });
});
app.post("/api/admin/board-categories/report", requireAdmin, (req, res) => {
  const jobId = String(req.body?.jobId || "").slice(0, 200);
  const row = jobId && db.prepare("SELECT job_id, title, board_category, category_reason FROM scraped_jobs WHERE job_id = ?").get(jobId);
  if (!row) return res.status(404).json({ error: "no such posting" });
  writeAudit(db, { actor: actorOf(req), action: "board_category_report", target: "scraped_jobs",
    before: { jobId: row.job_id, title: row.title, category: row.board_category, reason: row.category_reason },
    after: { wrong: true, note: String(req.body?.note || "").slice(0, 300) } });
  res.json({ ok: true });
});
// D78 A: the daily sweep — 03:30 UTC, after the 03:00 cleanup, and ONLY once the owner switched age_enforce on.
// Retire, never delete; applied postings kept. No share ceiling (owner, 10-08).
// ⛔ D80 E: the weekly hiring-heat line — Mondays 05:00 UTC (⭐ D170 (4): its PROPOSED list also names a company whose every
// posting is outside the US — services/companyHeat.js) (container time; BEFORE that day's crawl, which is
// 04:00 America/New_York = 08:00 UTC — it reads the week through Sunday's crawl). It only REPORTS: dormant companies are
// proposed in Admin → Companies for the owner to disable; nothing here deactivates anything.
cron.schedule("0 5 * * 1", () => {
  try {
    const h = heatReport(db);
    const s = h.summary;
    console.log(`[company-heat] ${s.active} active · hot ${s.hot} · warm ${s.warm} · dormant ${s.dormant} · probation ${s.probation} · ` +
      `${s.hotShare == null ? "—" : Math.round(s.hotShare * 100) + "%"} with a new in-scope posting in ${h.hotDays} days (target ${Math.round(h.target * 100)}%)` +
      (h.proposals.length ? ` · PROPOSED for deactivation: ${h.proposals.map((p) => `${p.company} (${p.why})`).join("; ")}` : ""));
  } catch (e) { console.error("[company-heat] failed:", e.message); }
});
// ⛔ D82 B/C: company DISCOVERY — HN "Who is hiring?" weekly (Mondays 06:00, after the crawl and the heat line) and the
// read-only probe of new candidates nightly (06:30, 25 a night, ≥ 1 s between boards). Both write ONLY the candidate
// pool (company_candidates) and a pipeline_runs row; adding a company stays the owner's approval in Admin → Companies →
// Candidates. DISCOVERY_PAUSED=1 stops both; three consecutive failures open that source's breaker until the owner resets it.
cron.schedule("0 6 * * 1", () => {
  runHnDiscovery(db).then((r) => console.log(`[discovery:hn] ${r.ran === false ? `skipped (${r.reason})` : r.failed ? `FAILED: ${r.error}` :
    `${r.candidates} companies from ${r.threads} threads (${r.requests} requests) → ${r.inserted} new candidate(s), ${r.refreshed} seen again`}`))
    .catch((e) => console.error("[discovery:hn] failed:", e.message));
});
cron.schedule("30 6 * * *", () => {
  runCandidateProbe(db).then((r) => console.log(`[discovery:probe] ${r.ran === false ? `skipped (${r.reason})` : r.failed ? `FAILED: ${r.error}` :
    `probed ${r.probed} of ${r.considered} candidate(s), ${r.errored} errored`}`))
    .catch((e) => console.error("[discovery:probe] failed:", e.message));
});
cron.schedule("30 3 * * *", () => {
  // ⭐ D94: email_events are kept 90 days (type, time, email_id, reason — never a recipient).
  try { const n = sweepEmailEvents(db); if (n) console.log(`[email-health] daily sweep: deleted ${n} event(s) older than 90 days`); }
  catch (e) { console.error("[email-health] daily sweep failed:", e.message); }
  // ⛔ Each sweep is guarded on its own: no early return, so the age switch being off never skips the scope sweep.
  try {
    if (readBoardPolicy(db).age_enforce) {
      const r = sweepAged(db, { dryRun: false });
      console.log(`[board-age] daily sweep: retired ${r.retired} of ${r.active} active (past ${r.limitDays} days)`);
    }
  } catch (e) { console.error("[board-age] daily sweep failed:", e.message); }
  // D78 B: the scope sweep, in the same tick, ONLY once the owner switched scope_enforce on.
  try {
    if (readBoardPolicy(db).scope_enforce) {
      const r = sweepScope(db, { dryRun: false });
      console.log(`[board-scope] daily sweep: retired ${r.retired} of ${r.active} active (out of scope, v${r.version})`);
    }
  } catch (e) { console.error("[board-scope] daily sweep failed:", e.message); }
});
// D29 · the board's own tags: coverage, and the owner's export -> tag -> import (no model call, D17).
app.use("/api/admin/job-tags", requireAdmin, createJobTagsRouter(db, requireAdmin));
// ⭐ D105 · the Atlas: pages are PUBLIC (published nodes only, no sign-in); the curator's list and publish are admin.
app.use("/api/atlas", createAtlasRouter(db));
app.use("/api/learn", createLearnRouter(db, { requireAuth }));
// ⭐ D169 · Your skills (signed in, the person's own): the list, the map, add / remove, the quick check, a proof link.
app.use("/api/your-skills", createYourSkillsRouter(db, { requireAuth }));
app.use("/api/admin/your-skills", requireAdmin, createYourSkillsAdminRouter(db));
// ⭐ D119 · thumbnails: stored pictures for Learn's resources (public), and the admin's Pin a video / Hide / refresh.
app.use("/api/thumbs", createThumbsRouter(db));
// ⭐ D130 / D131 · the standalone survey (public), Admin → Testers (the research over the trial's stored answers and the
// survey's), and draft's practice form (/try/practice/:jobId), which a sample résumé's Drafts send to instead of a real
// employer (routes/apply.js asks services/sampleResumes.js practiceSendUrl). The D124 trial itself was removed 11-07.
surveyRoutes(app, db, { requireAdmin, secret: SESSION_SECRET,
  upload: multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 4, fields: 60 } }),
  deliver: (m) => ingestForUser(db, m) });
// ⭐ D125 · Admin → ATS calibration: the owner's hand-checked gold set, scored by the board's own scorer (its weights and
// confirmed synonyms), so the results move when the scorer does.
atsCalibrationRoutes(app, db, { requireAdmin,
  score: (job, resumeText) => scoreAtsLocally({ job, resumeText, termWeights: atsTermWeightsForJob(job), synonyms: atsSynonyms() }) });
app.use("/api/admin/thumbs", requireAdmin, createThumbsAdminRouter(db));   // ⭐ D115 · Learn (public content; progress signed in)
app.use("/api/admin/atlas", requireAdmin, createAtlasAdminRouter(db));
// ⭐ D118 P2 · Admin → Atlas → Import content: the extracted JSON validated, diffed by id, applied on Apply — no deploy.
app.use("/api/admin/learn", requireAdmin, createLearnAdminRouter(db));
// ⭐ D162 G2–G4 · the model gateway: each task's route, the switch / rollback (no deploy, audited), evals, telemetry.
app.use("/api/admin/model-gateway", requireAdmin, createModelGatewayAdminRouter(db));
// ⭐ D108 P2 · "What changed": facts with official source links only; public to read, the curator's to write.
app.use("/api/what-changed", createWhatChangedRouter(db));
app.use("/api/admin/what-changed", requireAdmin, createWhatChangedAdminRouter(db));
// Seeded at boot (idempotent: a second run adds nothing, and never touches a curator's node) — every node a DRAFT.
try { const s = seedAtlasFromRegistry(db); if (s.nodes || s.edges) console.log(`[atlas] seeded ${s.nodes} draft node(s), ${s.edges} edge(s)`); }
catch (e) { console.warn("[atlas] seed:", e.message); }
// ⭐ D142: the drafted readiness questions go in as DRAFTS on an empty table only — nothing is served until reviewed.
try { const n = seedReadinessDrafts(db); if (n) console.log(`[readiness] ${n} drafted question(s) await review`); }
catch (e) { console.warn("[readiness] seed:", e.message); }
// ⭐ D150 T01: the question bank's files (content/learn/audit-questions-vN.json) go in as DRAFTS — idempotent, a re-import
// never resets a reviewed item; nothing is live until Admin → Learn → Questions approves it.
try {
  for (const r of importQuestionFiles(db)) {
    if (r.error) console.warn(`[questions] ${r.file} NOT imported — ${r.error}`);
    else if (r.refused.length) console.warn(`[questions] ${r.file} NOT imported — ${r.refused.length} item(s) refused: ${r.refused.slice(0, 3).map(x => `${x.id}: ${x.problems.join(", ")}`).join("; ")}`);
    else if (r.added.length || r.changed.length || r.requeued.length) console.log(`[questions] ${r.file}: ${r.added.length} added, ${r.changed.length} changed, ${r.requeued.length} back to review`);
  }
  // ⭐ D155 (11-08): the deck batches' check questions (content/decks/decks-vN.json); an owner-approved batch's go live.
  for (const r of importDeckQuestions(db)) {
    if (r.error) console.warn(`[questions] ${r.file} NOT imported — ${r.error}`);
    else if (r.refused.length) console.warn(`[questions] ${r.file} NOT imported — ${r.refused.length} item(s) refused: ${r.refused.slice(0, 3).map(x => `${x.id}: ${x.problems.join(", ")}`).join("; ")}`);
    else if (r.added.length || r.changed.length || r.live) console.log(`[questions] ${r.file}: ${r.added.length} added, ${r.changed.length} changed, ${r.live} live (owner-approved batch)`);
  }
  const drafts = db.prepare(`SELECT COUNT(*) FROM learn_questions WHERE status = 'draft'`).pluck().get();
  if (drafts) console.log(`[questions] ${drafts} drafted question(s) await review (Admin → Data → Question bank)`);
} catch (e) { console.warn("[questions] import:", e.message); }
// ⭐ D118 P2 (c): the Learn content lives in the DATABASE (learn_content). content/learn/*.json goes in ONLY on an empty
// table — a first install — and never over newer database content (Admin → Atlas → Import content replaces it).
try {
  const s = seedLearnContentIfEmpty(db);
  if (s.seeded.length) console.log(`[learn] first install: ${s.seeded.join(", ")} imported into the database`);
  for (const k of s.skipped) console.warn(`[learn] ${k.file} NOT imported — ${k.errors.slice(0, 3).map(e => `${e.at} ${e.reason}`).join("; ")}`);
} catch (e) { console.warn("[learn] content seed:", e.message); }
// ⭐ D115 P4(a): the owner's tracker's 385 definitions — empty definitions filled, the rest as concept drafts (idempotent).
try {
  const r = importLearnConcepts(db, learnContent(db));
  if (r.filled.length || r.created.length) console.log(`[atlas] learn: ${r.filled.length} definition(s) filled, ${r.created.length} concept(s) added`);
  if (r.skipped.length) console.log(`[atlas] learn: left out ${r.skipped.map(s => `${s.term} (${s.why})`).join("; ")}`);
  // Owner 10-31: the tracker's concepts are published as learning pages (a person's un-publish sticks).
  const pub = publishLearnConcepts(db);
  if (pub.published) console.log(`[atlas] learn: ${pub.published} concept page(s) published (owner, 10-31)`);
  // ⭐ D115 P4(c): the 28 LeetCode patterns as pattern nodes, their problems as Practice resources (idempotent).
  const p = importLearnPatterns(db, learnContent(db));
  if (p.created.length || p.promoted.length || p.resources) console.log(`[atlas] learn: ${p.created.length} pattern(s) added, ${p.promoted.length} promoted from concepts, ${p.resources} practice link(s), ${p.edges} edge(s)`);
} catch (e) { console.warn("[atlas] learn import:", e.message); }
// ⭐ D117 C9 (after the D115 imports, so the taught terms resolve against the concepts they add): the circle's data (content/learn/d117-data.json — "Before this" links as drafts, the terms each piece
// teaches, D115 P5's links) goes in by its own import, idempotent by id: every boot adds only what is missing and never
// moves a status the owner reviewed; learn_content (the tracker's text) is not touched. P5's links wait for the
// dead-link checker before they show (shortly after boot, then daily with the Atlas's links).
try {
  const c = seedCircleData(db);
  if (!c.ok) console.warn(`[learn] circle data NOT imported — ${(c.errors || []).slice(0, 3).map(e => `${e.at} ${e.reason}`).join("; ")}`);
  else if (!c.missing && (c.needs.added || c.teaches.added || c.p5.added)) console.log(`[learn] circle: ${c.needs.added} "Before this" link(s) (drafted), ${c.teaches.added} taught term(s) (${c.teaches.unresolved.length} unresolved), ${c.p5.added} P5 link(s) waiting for the link check`);
  if (c.ok && !c.missing && c.p5.pending) {
    setTimeout(() => { checkExtraItems(db, { include: ["pending"] }).then(r => console.log(`[learn] P5 links: ${r.checked} checked, ${r.live} live, ${r.held.length} held back`)).catch(e => console.warn("[learn] P5 link check:", e.message)); }, 60_000).unref();
  }
} catch (e) { console.warn("[learn] circle data:", e.message); }
// ⭐ D116 M1: each node's family, seeded ONCE from content/atlas/families.json (the owner reviews it); a node a curator
// set or cleared in Admin → Atlas is never touched again (family_by). Idempotent.
try {
  const f = seedAtlasFamilies(db);
  if (f.assigned) console.log(`[atlas] families: ${f.assigned} node(s) assigned from content/atlas/families.json`);
} catch (e) { console.warn("[atlas] families:", e.message); }
// ⭐ A112/Atlas (11-03): the board's own roles (content/atlas/roles.json) — roles the registry never named, as drafts that
// publish on their postings; the matcher reads every listed role's alternate titles. Idempotent; a curator's family wins.
try {
  const r = seedBoardRoles(db);
  if (r.created.length) console.log(`[atlas] ${r.created.length} board role(s) added from content/atlas/roles.json`);
} catch (e) { console.warn("[atlas] board roles:", e.message); }
// ⭐ A112/Atlas (11-03): the agent's drafted definitions for the non-computing families (content/atlas/definitions-drafted.json)
// wait as DRAFTS for the owner (Admin → Atlas → Drafted definitions); each slug is offered once, so a rejection sticks.
try {
  const d = seedDraftedDefinitions(db);
  if (d.drafted.length) console.log(`[atlas] ${d.drafted.length} drafted definition(s) await review (Admin → Atlas)`);
  if (d.refused.length) console.warn(`[atlas] drafted definitions refused: ${d.refused.map(r => `${r.slug} (${r.reason})`).join("; ")}`);
} catch (e) { console.warn("[atlas] drafted definitions:", e.message); }
// ⭐ D118 P1: the live counts need a baseline — one full pass. A database that has none (the first boot with migration
// 199) gets it shortly after boot, not on the request path; until then the queue waits and pages read the last nightly.
try {
  if (liveVersion(db) == null && db.prepare(`SELECT 1 FROM atlas_nodes LIMIT 1`).get()) {
    setTimeout(() => {
      try { const a = computeAtlasStats(db); console.log(`[atlas] live baseline: ${a.nodes} node(s) over ${a.postings} posting(s)`); }
      catch (e) { console.warn("[atlas] live baseline:", e.message); }
    }, 90_000).unref();
  }
} catch (e) { console.warn("[atlas] live baseline check:", e.message); }

app.use(createAccountRouter({
  db,
  requireAuth,
  emitToUser,
  syncClients,
  buildAutofillPayload,
  requireModeEntitlement,
  normalisePlanTier,
  allowedModesForTier,
  canUseGenerate,
  canUseAPlusResume,
  nextPlan,
  getAutomationReadiness,
  oauthReadiness,
  probeBrowserAvailability,
  encryptSecret: SECRET_BOX.encrypt,
  INTEGRATION_PROVIDERS,
  publicIntegrationRow,
  providerColumnFor,
  INDUSTRY_CATEGORIES,
}));

// Account management — profile, picture, sessions, password, email, sign-in methods, export,
// merge and delete. routes/accountManagement.js; the data layer is services/accountService.js.
// D55 (f): the candidate's saved answers — remember, list/edit/delete, export/import, test a question.
app.use(createSavedAnswersRouter({ db, requireAuth, buildAutofillPayload }));

app.use(createAccountManagementRouter({
  db,
  // D112: deleting the account revokes its Gmail grant at Google first (the row itself cascades with the user).
  beforeDelete: (userId) => disconnectGmail(db, { box: SECRET_BOX, client: GMAIL_CLIENT, userId }),
  requireAuth,
  store: SStore,
  dataDir: DATA_DIR,
  multer,
  hashPassword,
  verifyPassword,
  emailConfigured,
  sendVerificationCodeEmail,
  codePepper: PASSWORD_RESET_SECRET,
  revokeBrowserAuthContexts,
  authContextAuthAt,
  stampAuthContextAuthAt,
  clearSessionCookie: (res) => res.clearCookie("connect.sid", { httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:SESSION_SAMESITE }),
  findLoginUser: (identifier) => identifier ? db.prepare(`
    SELECT u.* FROM users u LEFT JOIN user_profile up ON up.user_id = u.id
    WHERE LOWER(u.username) = LOWER(?) OR LOWER(up.email) = LOWER(?) LIMIT 1
  `).get(identifier, identifier) : null,
}));

// ═══════════════════════════════════════════════════════════════
// ── /api/jobs/facets — the filter sentence's counts (D24) ─────────────────────────────────────────
//
// REPLACES a facets endpoint that answered a different board. It took NO query params (so its
// counts ignored every active filter), INNER-joined job_role_map (dropping the unclassified rows
// the board has shown since CC1b), excluded applied rows (the board does not), used its own 30-day
// window, and bucketed posting age with parseInt() over an ISO posted_at — parseInt("2026-10-01…")
// is 2026, so every dated row landed in '1w'. No web control read it; the mobile contract did.
//
// Now: the SAME params as GET /api/jobs, validated by the same rejectInvalidFilterValues (a 400 for
// an unknown value, with the board's body), and every count measured through boardPageResponse's
// own join / where / args — services/jobs/boardFacets.js. The shape is shared/filterSentence.js's
// FacetsResponse.
// ⭐ D156 (6) / D151 (44v, measured): KEPT per user + active profile + query for FACETS_TTL_MS, one count in flight per key,
// dropped on the user's own writes (the middleware after passport.session). X-Facets-Cache says hit / shared / miss and
// X-Facets-As-Of when the counts were taken. Before: every Home render re-ran 5 + N whole-board aggregates on the loop.
app.get("/api/jobs/facets", requireAuth, async (req, res) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const profileId = (() => { try { return getOrRepairActiveProfile(req.user.id)?.id ?? null; } catch { return null; } })();
  // The "since your last visit" cutoff rolls on a GET (a board load, D74 P1) — no write clears the cache then, so the
  // stored visit mark is part of the key: a new visit is a new entry (never the first-visit fallback, which moves with now).
  const lens = { nowSec, visitSinceSec: visitSince(db, req.user.id, { now: nowSec }) };
  const key = facetsKey(req.user.id, profileId, { ...req.query, "~visit": visitMark(db, req.user.id) ?? "first" });
  const { value: { status, body }, cache, asOf } = await facetsCache.get(key, () => facetsAnswer(req, lens));
  res.set("X-Facets-Cache", cache);
  res.set("X-Facets-As-Of", new Date(asOf).toISOString());
  res.status(status).json(body);
});
async function facetsAnswer(req, { nowSec, visitSinceSec }) {
  return boardFacetsResponse({
    query: req.query, nowSec,
    // D74 P1: the "since your last visit" option's cutoff — read, never rolled (counting is not visiting); read once by
    // the route (it is part of the cache key).
    visitSinceSec,
    measureBoard: (query, measure) => boardPageResponse({ ...req, query }, { measure, nowSec }),
    // D35 · the /d view's count — the Pending list's own query, counted.
    countPending: () => pendingJobsQuery(req.user.id, { count: true }),
  });
}


// ── /api/jobs/suggest — typeahead for the search bar ──────────────
// Titles and locations DERIVED FROM scraped_jobs, scoped to the caller's active role and ranked by
// how often each actually occurs. There is no hand-maintained list of roles behind this: if a title
// is not on the board it is not offered, and when the board changes the suggestions change with it.
//
// Additive. Nothing else calls it, no existing response shape changes, and search BEHAVIOUR is
// untouched — this only proposes text for the input; the double-click local->live pattern still
// decides what actually happens with it.
//
// Cached in services/jobs/searchSuggestions.js: one query per role scope per TTL, then in-memory
// filtering. That is the requirement that this must not become a query per keystroke against the
// jobs table — with the client's debounce on top, a fast typist costs zero additional queries.
app.get("/api/jobs/suggest", requireAuth, async (req, res) => {
  try {
    const field = req.query.field === "location" ? "location" : "title";
    const q     = String(req.query.q || "").slice(0, 100);
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 8));

    const profile = getOrRepairActiveProfile(req.user.id);
    // No profile is not an error here. The board itself reports needsProfileSetup and says so
    // properly; a typeahead has nothing useful to add and must not put an error under the input.
    if (!profile) return res.json({ suggestions: [] });

    const roleKey = roleKeyForProfile(profile);
    // ⛔ D151 · the index's first build (one read over every active posting of the role) in the read-worker pool, off
    // the event loop; suggest() below then filters the warm cache. A failed warm leaves suggest() to build it as before.
    if (String(q).trim()) await warmSuggestionIndex(db, roleKey, { read: readPool });
    const suggestions = suggest(db, {
      roleKey: roleKeyForProfile(profile),
      field, q, limit,
    });
    // An empty array is a normal result, not a failure — the client renders nothing for it.
    res.json({ suggestions });
  } catch (err) {
    console.error('[GET /api/jobs/suggest]', err.message);
    // Degrade to "no suggestions" rather than surfacing a failure on a purely additive convenience.
    res.json({ suggestions: [] });
  }
});

// JOBS — shared pool with pagination, filters, sort
// ═══════════════════════════════════════════════════════════════
/**
 * Reject a filter value the vocabulary does not contain — LOUDLY.
 *
 * The failure this replaces is the one shared/jobFilterOptions.js exists for: a select emitting
 * 'mid level' at a column holding 'mid' did not error, it returned zero rows. To the user that is
 * indistinguishable from "there are no mid-level jobs", and it stayed shipped through two rounds of
 * filter fixes because nothing anywhere said the value was wrong.
 *
 * WHAT IS CHECKED. Every dimension in FILTER_DIMENSIONS, under every param name it answers to — its
 * own `param`, plus `excludeParam` and `legacyParam` where it has them, so `sources_exclude=LinkedIn`
 * is caught as surely as `sources_include=LinkedIn`.
 *
 * WHAT IS NOT CHECKED, DELIBERATELY:
 *   - An ABSENT or EMPTY param. "No opinion on this dimension" is the default board, and 400ing it
 *     would break every caller.
 *   - The PROFILE-DERIVED defaults. Those come from deriveProfileFilters, i.e. from our own code, so
 *     an invalid one is an internal bug and not the caller's fault — a 400 would blame the user for
 *     it. test/filterOptionContract.test.js covers that direction instead, by asserting the bridge's
 *     own level table only emits values this contract knows.
 *   - Free-text and numeric params (q, role, location, salary_min_usd, skills_include...). They have
 *     no enumerated vocabulary to check against.
 *
 * Returns a problem string, or null when everything present is recognised.
 */
function rejectInvalidFilterValues(query) {
  for (const [name, dim] of Object.entries(FILTER_DIMENSIONS)) {
    const params = [dim.param, dim.excludeParam, dim.legacyParam].filter(Boolean);
    for (const key of params) {
      const bad = invalidEntries(dim, query[key]);
      if (bad.length) {
        // Name the offending VALUES, not just the dimension. A multi-valued param arrives as
        // "remote,hybrid" and "invalid work_models" with no indication of which entry is wrong is
        // the same dead end as the silent empty board.
        return `Unknown ${name} value${bad.length === 1 ? "" : "s"} for "${key}": ${bad.join(", ")}`;
      }
    }
  }
  return null;
}

app.get("/api/jobs", requireAuth, async (req, res) => {
  touchBoardVisit(db, req.user.id);   // D74 P1: a board load is a visit (never in boardPageResponse — see boardVisit.js)
  const { status, body } = await boardPageResponse(req);
  res.status(status).json(body);
});

// ── THE BOARD, AS A FUNCTION (09-30) ────────────────────────────────────────────────────────────
//
// GET /api/jobs was one 690-line inline handler. It is this function now, called by that route and
// by the daily deal (GET /api/draft/today, services/dailyDraft.js), because the deal must deal from
// EXACTLY the board's default order (FIT_KEYS) — the same query, not a copy of it. Nothing inside
// changed: it reads req.query, req.user and the active profile, and every response it used to send
// it now returns as { status, body }.
const boardReply = (status, body) => ({ status, body });
// D24 · `opts.measure`: GET /api/jobs/facets' way in. When given, the board is built exactly as for a
// list — same validation, same profile scope, same join / where / args — and then, INSTEAD of fetching
// a page, `measure({ db, joinClause, whereClause, baseArgs, unclassifiedSql })` runs over those
// bindings and its value is returned as { measured: true, value }. One board, two readers: a count the
// list cannot reproduce is not possible when both are the same statement's WHERE. `opts.nowSec` pins
// the ageFilter cutoff so a facets response's options and its base sets read one clock.
async function boardPageResponse(req, { measure = null, nowSec = null } = {}) {
  try {
    // Validate the enumerated filter vocabularies BEFORE any work — a bad value must not reach the
    // query builder and come back as an empty board. 400 rather than 200-with-nothing: the caller
    // sent something this endpoint does not understand, and saying so is the whole point.
    const filterProblem = rejectInvalidFilterValues(req.query);
    if (filterProblem) {
      return boardReply(400, { success: false, error: filterProblem, jobs: [], total: 0 });
    }

    const {
      q              = '',
      role           = '',
      location       = '',
      page           = '1',
      pageSize       = '10',
      sort           = '',
      employmentType = '',
      workType       = '',
      ageFilter      = '',
      maxYoe         = null,
      minYoe         = null,
      category       = '',
      source         = '',
      maxApplicants  = null,
      visited        = '',
      localSearch    = '',
      starred        = '',
      // D40: the + view — ALL restricted to the jobs this user imported (job_captures).
      imported       = '',
      // A91: the /d view — ALL restricted to the jobs this user drafted (pendingMembershipSql).
      pending        = '',
      domain         = '',
      applied        = '',
      // Keyset pagination, opt-in. When present it REPLACES page/OFFSET; when absent this endpoint
      // behaves exactly as it always has, which is what keeps client/ and extension/ working.
      cursor: rawCursor = '',
    } = req.query;

    // NOTE: bare `q` is not consumed here — no existing caller sends it (checked: the
    // frontend only ever sends role/localSearch for this), so it's reserved below for the
    // new rich query vocabulary (OR terms / "-"-exclude / "quoted"-exact-title) instead of
    // the legacy simple-substring behavior, without changing any real existing call.
    const rawQuery = (role || localSearch || '').slice(0, 200).trim();
    const pg       = Math.max(1, parseInt(page, 10) || 1);
    const ps       = Math.min(50, Math.max(1, parseInt(req.query.page_size || pageSize, 10) || 10));

    // Phase 6: board is profile-scoped via job_role_map join — profile required
    // D102 P4: FULL AUTO's scheduler may name WHICH of the user's own job profiles its run reads (Auto settings' profileId);
    // anything else — or a profile that is not theirs — is the active one, as before.
    const namedProfile = Number.isInteger(req.boardProfileId)
      ? db.prepare("SELECT * FROM domain_profiles WHERE id = ? AND user_id = ?").get(req.boardProfileId, req.user.id) : null;
    const sessionActiveProfile = namedProfile || getOrRepairActiveProfile(req.user.id);
    if (!sessionActiveProfile) {
      return boardReply(200, {
        success:           true,
        jobs:              [],
        total:             0,
        page:              pg,
        pageSize:          ps,
        totalPages:        0,
        needsProfileSetup: true,
        reason:            'no_active_profile',
        // The same shape every other empty board now uses, so a client reads ONE field rather than
        // special-casing this branch. `reason` above is kept for the clients already reading it.
        emptyReason: {
          code:    'no_active_profile',
          message: 'Create a job profile to see jobs — results are scoped to a profile.',
        },
      });
    }

    const roleKey = roleKeyForProfile(sessionActiveProfile);

    // The Saved ★ tab is a record of what the user already chose, not a discovery surface — so none
    // of the DISCOVERY narrowing applies to it: not the job_role_map role_key join, not
    // profileTitleSql, not the profile bridge. Their own explicit filters still do; those are
    // deliberate acts too.
    //
    // Measured before this: user 14 had starred three imports (a Quora req, a Figma AE req, a
    // RemoteOK posting) and the Saved tab returned ONE. The other two were bucketed 'sales' and
    // 'general' by the classifier, and this board joins job_role_map with an INNER JOIN on the ACTIVE
    // PROFILE's role_key — so a job the user explicitly saved was hidden from the tab whose entire
    // meaning is "the jobs I picked", on the strength of a classifier guess they never saw and
    // cannot change. For an imported job that is the reported bug all over again: the import
    // succeeds, the row is starred, and it is nowhere. ROLE_KEY_FALLBACK ('general') makes an
    // unclassifiable import reachable in principle, but only to a profile whose own role_key is
    // 'general' — which is nobody's.
    const savedTab = starred === '1';

    // ── CC1 · TARGET TITLES RANK HERE, THEY NO LONGER EXCLUDE ──────────────────────────────────
    //
    // This was `profileTitleSql("sj.title", sessionActiveProfile)` spliced into the WHERE clause,
    // and it was HARD BOARD MEMBERSHIP: a posting whose title did not contain every token of some
    // target title was not on the board at all, for either scorer to rank.
    //
    // Measured on 2,460 active rows for profile 5 (target_titles ["Software Engineer"]): it kept
    // 405 rows, and of the 30 postings the OWNER personally graded it kept 8 — excluding 5 of the
    // 12 they graded 5. All five are titled "...Engineer": Frontend Engineer/Expansion, Full Stack
    // Engineer/Fleet Scheduling, Backend Engineer/Credit Decisions, Applied AI Engineer/Digital
    // Natives, Full Stack Engineer/Link. The scorer rates Backend Engineer/Credit Decisions its
    // SECOND HIGHEST of the corpus. Spearman rho between the scorer's score and the owner's own
    // grades was -0.1769 under this filter and +0.5340 without it: the filter was actively
    // ANTI-correlated with the judgement it exists to serve.
    //
    // The reason is X2's rule, applied one level deeper than X2 applied it. The user SET
    // `target_titles`; they did not set the substring-AND MATCHING RULE. Somebody who typed
    // "Software Engineer" was taken to have asked for "every title containing both the token
    // software and the token engineer". That rule is DERIVED, and a derived rule ranks.
    //
    // So the titles now flow into buildJobFilters as two DERIVED rank dimensions
    // (target_title_exact, target_title_role) and the WHERE clause keeps nothing. The rows that
    // made up the old board still LEAD the new one — target_title_exact is byte-for-byte the old
    // predicate — so this is a reordering with a longer tail, not a different board.
    //
    // ⛔ SCOPE IS STILL HARD, and that is not a contradiction. The job_role_map role_key INNER JOIN
    // below is untouched: it is the profile's DECLARED role, a value and a rule the user chose
    // together when they created the profile. It bounds the board to 572 engineering rows out of
    // 2,460. What changed is only the rule nobody chose.
    //
    // ⛔ THE SAVED TAB IS UNAFFECTED, and now trivially so — with no title predicate there is
    // nothing for it to opt out of. `savedTab` still skips the role_key join and the bridge.
    const titleFilter = { sql: "1 = 1", params: [] };

    // Keyword (opt-in) — A72: a RANKED, whole-word search (services/jobs/boardSearch.js). This was
    // `title/company/description LIKE %q%`, a substring filter that ranked nothing: "ai" matched
    // 2,525 of 2,616 active rows, so a search changed nothing. Now each row gets a tier — title
    // starts with · title contains · company or skill · description only — and a row in no tier is
    // OMITTED. The tier leads the order (buildOrderKeys' `search`), ATS match breaks ties. The term's
    // synonyms are the scorer's own confirmed map (CC3), with equal weight.
    const searchPhrases = rawQuery ? searchVariants(rawQuery, atsSynonyms()) : [];
    const boardSearch   = searchPhrases.length ? boardSearchSql(searchPhrases) : null;
    const keyFilter = boardSearch ? `AND ${boardSearch.sql} IS NOT NULL` : '';
    const keyArgs   = boardSearch ? boardSearch.params : [];
    // Location (opt-in) — ⛔ D29: NOT `sj.location LIKE %x%` ANY MORE. That substring matched "IN"
    // inside Washington and Berlin, "MA" inside Omaha and "CA" inside Canada, and found none of 370
    // San Francisco rows for "Bay Area" (D27). The text is RESOLVED into the tag vocabulary instead
    // ("Boston" -> metro:boston, "CA" -> state:CA) and filtered over the place set by buildJobFilters'
    // `places`, soft-null; "Remote" means the workplace, not a place. Only text that names nothing in
    // the vocabulary keeps the old substring match — it is what the caller typed, and saved searches
    // and API callers still send it.
    const locationPlace  = location ? resolvePlaceText(location) : null;
    const locationRemote = !!location && !locationPlace && /^s*remotes*$/i.test(location);
    const locFilter = location && !locationPlace && !locationRemote ? `AND sj.location LIKE ?` : '';
    const locArgs   = locFilter ? [`%${location}%`] : [];

    // Work-type / employment-type / category (opt-in) — SOFT-NULL, the same pattern and for the
    // same reason as services/jobs/jobQuery.js's workplace_type / experience_level / skills_json
    // clauses; read those comments alongside these. These three columns are written only by paths
    // that have the value to write, and on a real ATS-crawled board that is none of them: all 35
    // active rows in production carry NULL in all three. A hard `= ?` makes `NULL = 'Remote'` NULL,
    // i.e. not-true, so each of these three controls took the board to exactly 0 rows and read as
    // "no remote jobs exist" rather than "not classified yet". A row must never be hidden purely
    // because we have not classified it — only on an explicit mismatch once we have.
    const wtFilter = workType ? `AND (sj.work_type IS NULL OR sj.work_type = ?)` : '';
    const wtArgs   = workType ? [workType]                                      : [];

    // employmentType additionally had a SHAPE bug independent of the NULL one: buildParams sends a
    // comma-joined multi-select (employmentTypePrefs.join(",")) and this bound it to a scalar `= ?`,
    // so "full-time,contract" could not match a row even with data present. Split to an IN list —
    // the shape services/jobs/jobQuery.js already uses for its own `employment_types` key.
    const etValues = String(employmentType).split(',').map(v => v.trim()).filter(Boolean);
    const etFilter = etValues.length
      ? `AND (sj.employment_type IS NULL OR sj.employment_type IN (${etValues.map(() => '?').join(',')}))`
      : '';
    const etArgs   = etValues;

    const catSql  = category ? `AND (sj.category IS NULL OR sj.category = ?)` : '';
    const catArgs = category ? [category]                                    : [];

    // Domain — sj.bucket_domain, written by classifyJob's detectDomain. This is the column the
    // Category note above already named as "a domain filter worth having": sj.category is dead
    // (nothing writes it, and /api/categories' marketing taxonomy never matched its vocabulary
    // even in principle), while bucket_domain carries real values on every row — measured on this
    // database: general 714, fintech 439, edtech 43, ai_ml 25, saas 12, devtools 10, healthtech 9,
    // ecommerce 1, and zero NULLs across all 1,253 rows.
    //
    // It exists because the search bar's "Any Domain" select has always rendered exactly this
    // vocabulary and been wired to nothing at all. Soft-null, the same call as work_type /
    // employment_type / category beside it: bucket_domain has no NULLs today, but the rule this
    // codebase applies is that a row is never hidden purely because we have not classified it —
    // only on an explicit mismatch once we have.
    const domSql  = domain ? `AND (sj.bucket_domain IS NULL OR sj.bucket_domain = ?)` : '';
    const domArgs = domain ? [domain]                                                 : [];

    // source stays a HARD match, deliberately, for the reason jobQuery.js's sources_include comment
    // already records: every scraped_jobs writer sets `source`, so there is no "not classified yet"
    // state to protect, and a soft-null escape would make the filter unable to exclude anything the
    // moment a NULL appeared.
    const srcSql  = source   ? `AND sj.source   = ?` : '';
    const srcArgs = source   ? [source]              : [];

    // Starred (opt-in) — the Saved ★ tab. buildParams has always emitted starred=1 for
    // boardTab === "saved"; this handler destructured it nowhere and built no clause for it, so the
    // Saved tab silently returned the ENTIRE unfiltered board. Measured against production before
    // this fix: starred=1 returned 27 of 27 rows for a user with zero starred rows. `uj` is already
    // LEFT JOINed per (user, profile) below, so this reads that user's own flag and nobody else's.
    // Any value other than '1' emits nothing, so the default board querystring is unchanged.
    // ⭐ D151 Rule 4 (11-08): the person's starred set as a driving IN-list (a necessary condition — the same rows), so the
    // ★ view starts from their few user_jobs rows, not every posting (the 20-user suite: the facets' view totals).
    const starUid = Number.isSafeInteger(Number(req.user.id)) ? Number(req.user.id) : -1;
    const starredSql = savedTab ? `AND uj.starred = 1 AND sj.job_id IN (SELECT s.job_id FROM user_jobs s WHERE s.user_id = ${starUid} AND s.starred = 1)` : '';

    // Applied — the search bar's Status > "Applied". Reads uj.applied, the per-(user, profile) flag
    // on the LEFT JOIN already in place, for the same reason starredSql reads uj.starred and not
    // sj.*: it is one user's own record of what they did, and must never surface another's.
    // Parameterless, so like starredSql it can sit anywhere in the WHERE clause without shifting
    // baseArgs.
    const appliedSql = applied === '1' ? `AND uj.applied = 1` : '';

    // Applicant count cap (opt-in)
    const maxAppVal = maxApplicants !== null && maxApplicants !== '' ? parseInt(maxApplicants, 10) : null;
    const maxAppSql  = maxAppVal !== null ? `AND (sj.applicant_count IS NULL OR sj.applicant_count <= ?)` : '';
    const maxAppArgs = maxAppVal !== null ? [maxAppVal] : [];

    // Visited filter (opt-in)
    const visitedSql  = visited === '1' ? `AND uj.visited = 1`
                      : visited === '0' ? `AND (uj.visited IS NULL OR uj.visited = 0)` : '';

    // Age filter — support named intervals ("1d","2d","3d","1w","1m") + raw day counts
    let ageSql  = '', ageArgs = [];
    // The second copy of this table lived in JobsPanel's AGE_DAYS_MAP. Both read the shared
    // POSTING_AGE definition now, so the client's derived `posted_after` and this clause cannot
    // come to disagree about how many days "past week" is.
    const AGE_MAP = ageDaysMap();
    const ageDays = AGE_MAP[ageFilter] ?? parseInt(ageFilter, 10);
    // ⛔ D24 · NOT `sj.scraped_at >= ?` ANY MORE. scraped_at is "last touched by a crawl" — every
    // crawl rewrites it for every row it sees, changed or not — so "Past 24h" kept every posting the
    // nightly crawl re-saw: on a daily-crawled board, the whole board. It filtered only because the
    // web client ALSO sends posted_after; a client sending ageFilter alone (the mobile contract, the
    // sentence's facets) got nothing. postedSinceSql is the one "posted within" predicate, the same
    // one posted_after applies: posted_at, else first seen, else scraped_at.
    if (ageFilter && !isNaN(ageDays) && ageDays > 0) {
      const since = postedSinceSql((nowSec ?? Math.floor(Date.now() / 1000)) - ageDays * 86400);
      ageSql  = `AND ${since.sql}`;
      ageArgs = since.params;
    } else if (ageFilter === "visit") {
      // ⭐ D74 P1: FIRST SEEN since this user's previous visit (services/boardVisit.js), resolved here so a
      // client — web or mobile — sends only the value.
      ageSql  = `AND ${FIRST_SEEN_SQL}`;
      ageArgs = [visitSince(db, req.user.id, { now: nowSec ?? Math.floor(Date.now() / 1000) })];
    }

    // D24 · the fit filter, fit_bands=strong,moderate,weak. HARD: an unscored row matches no band
    // (jobCursor.js fitBandsSql). Validated with every other dimension above (FIT_BANDS is in
    // FILTER_DIMENSIONS), so only known bands reach here. No bound params — the cutpoints are
    // shared/atsBands.js constants — so it can sit anywhere in the WHERE without shifting baseArgs.
    const fitBands = String(req.query.fit_bands || "").split(",").map(v => v.trim()).filter(Boolean);
    // ⛔ A85 · the filter bands the CURRENT score — the one the card's badge shows (presentedScore) —
    // not the raw stored cell. A score stored against an earlier résumé or an earlier version of the
    // posting is in no band, exactly as it shows no badge. Built only when something reads it.
    let fitScoreSql = "NULL";
    if (fitBands.length || measure) {
      try { fitScoreSql = currentScoreSql(atsBasisForProfile(req.user.id, sessionActiveProfile)?.basisHash ?? null); }
      catch (e) { console.warn("[jobs] basis for the fit filter:", e.message); }
    }
    const fitBandSql = fitBands.length ? `AND ${fitBandsSql(fitBands, { scoreSql: fitScoreSql })}` : '';

    // YoE range: auto-apply from stored signals when no explicit maxYoe is set
    const signals = loadSimpleApplyProfile(db, { userId: req.user.id, profileId: sessionActiveProfile.id });
    const explicitMaxYoe = maxYoe !== null && maxYoe !== '' ? parseInt(maxYoe, 10) : null;
    const effectiveMaxYoe = explicitMaxYoe !== null
      ? explicitMaxYoe
      : (signals?.yearsExperience != null ? signals.yearsExperience + 2 : null);
    const yoeSql  = effectiveMaxYoe !== null ? `AND (sj.min_years_exp IS NULL OR sj.min_years_exp <= ?)` : '';
    const yoeArgs = effectiveMaxYoe !== null ? [effectiveMaxYoe] : [];
    const minYoeVal = minYoe !== null && minYoe !== '' ? parseInt(minYoe, 10) : null;
    const minYoeSql  = minYoeVal !== null ? `AND (sj.min_years_exp IS NULL OR sj.min_years_exp >= ?)` : '';
    const minYoeArgs = minYoeVal !== null ? [minYoeVal] : [];

    // Rich filter vocabulary (all optional/default-off — see services/jobs/jobQuery.js).
    // Every param it reads defaults to absent, so richFilters.sql/.params are '' / [] and
    // this branch is byte-identical to before whenever none of these are passed.
    //
    // Profile→Board Bridge: derives DEFAULTS for a handful of these dimensions (q, skills,
    // experience level, sponsorship-friendliness) from the active profile's stored signals —
    // reusing `signals` already loaded above for the YoE constraint, no extra DB call. An
    // explicit query param for the same dimension always wins (checked per-key below);
    // ?curate=off skips derivation entirely, reproducing pre-bridge behavior exactly.
    const baseFilterParams = { q, ...req.query };
    // ── CC4 · CLAIMED TERMS REACH THE BOARD'S RANKING, not only the generation prompt ────────────
    //
    // Requirement 6: the bridge could not see anything the user asserted. It reads
    // `profile_simple_apply_profiles`, which is EXTRACTED from the résumé — and CC2 measured that
    // extraction to be largely noise ("near", "provided", "tasks", "college"). So the one store
    // holding what the person actually said about themselves reached neither scorer.
    //
    // ⛔ CLAIMS ARE PREPENDED, AND THE ORDER IS THE POINT. profileFilterBridge caps the derived
    // skills at MAX_DERIVED_SKILLS = 6 by taking the FIRST six, so appending would mean a profile
    // with six extracted terms silently drops every claim. An explicit assertion outranks an
    // extraction — that is the whole premise of letting a person claim anything — so they go first.
    //
    // A SEPARATE object rather than mutating `signals`, which has another reader (the YoE
    // constraint above). Widening a value in place for one consumer is how the other one starts
    // disagreeing about what it holds.
    const boardClaims = savedTab ? null : atsClaims(sessionActiveProfile);
    const curationSignals = boardClaims?.skills?.length
      ? { ...signals, skills: [...boardClaims.skills, ...(signals?.skills || [])] }
      : signals;
    const derivedFilters = (req.query.curate === 'off' || savedTab)
      ? {}
      : deriveProfileFilters(sessionActiveProfile, curationSignals);
    const filterParams = { ...baseFilterParams };
    // D29 · the legacy location text, resolved above, joins the place set / the workplace.
    if (locationPlace) {
      filterParams.places = [...String(filterParams.places || "").split(",").map(v => v.trim()).filter(Boolean), locationPlace];
    }
    if (locationRemote && !filterParams.work_models) filterParams.work_models = "remote";
    // Which derived keys ACTUALLY took effect (an explicit query param for the same dimension wins,
    // so a derived key can be computed and then not used). Only these are reported to the client,
    // and only these are removed to compute the uncurated total below — reporting the ones that
    // lost to an explicit value would blame the profile for the user's own filter.
    const appliedDerivedKeys = [];
    for (const key of Object.keys(derivedFilters)) {
      const explicitVal = baseFilterParams[key];
      const isExplicit  = explicitVal !== undefined && explicitVal !== null && explicitVal !== '';
      if (!isExplicit) { filterParams[key] = derivedFilters[key]; appliedDerivedKeys.push(key); }
    }
    // CC1 — the profile's target titles, as a RANK rather than the WHERE predicate they used to be.
    // Declared derived for the same reason every bridge key is: the VALUE is the user's, the
    // matching RULE is ours, and under X2's rule ours may only rank. Skipped on the Saved tab,
    // which is a record of what the user already chose and not a discovery surface.
    //
    // Both keys are named in appliedDerivedKeys so `curation.rankedKeys` discloses them and
    // `rank.demotedSql` counts the rows they push down — the count that makes requirement 3's "the
    // user must be able to see that N rows exist and are ranked below" true rather than claimed.
    const profileTargetTitles = savedTab ? [] : parseProfileArray(sessionActiveProfile?.target_titles);
    if (profileTargetTitles.length) {
      filterParams.target_titles = profileTargetTitles;
      appliedDerivedKeys.push('target_title_exact', 'target_title_role');
    }
    // CC1b — rank the rows the softened role join now admits. A posting in the profile's declared
    // bucket leads; one nobody has classified follows. It ranks AHEAD of the title keys (see
    // DERIVED_RANK_ORDER) because the declared role is coarser than a target title: "the kind of
    // work you said you do" before "the words you used for it".
    //
    // ⛔ Only on a board that HAS the jrm join. The Saved tab drops the join, so asking for this
    // key there would reference an alias that does not exist.
    if (!savedTab) appliedDerivedKeys.push('role_key');
    // D42 · the scope's extra buckets (engineering's is data) rank with the declared one.
    if (!savedTab) filterParams.role_scope_extra = roleScopeExtra(roleKey);
    // PROVENANCE, carried rather than re-derived. buildJobFilters cannot tell a value the user typed
    // from one this bridge inferred — the merged object looks identical either way — and X2's rule
    // turns entirely on that distinction: a filter the USER SET excludes rows, a filter DERIVED on
    // their behalf ranks them. appliedDerivedKeys is already the authoritative answer, computed by
    // the merge loop directly above from the only place that knows. Passing it down is what makes
    // the rule structural; having the query builder guess again would be a second opinion that can
    // disagree with this one.
    const richFilters = buildJobFilters(filterParams, { derivedKeys: appliedDerivedKeys });
    // THE UNCURATED SECOND QUERY IS GONE, because the quantity it measured no longer exists.
    //
    // It used to build the same board minus the profile-derived defaults, so the response could say
    // how many rows the bridge was HIDING — disclosure being the previous pass's answer to a bridge
    // that narrowed silently. Every key the bridge derives now ranks instead of excluding, so the
    // curated and uncurated row SETS are identical by construction and that count is always zero.
    // Keeping the query would be paying for a COUNT to learn a constant.
    //
    // What is worth disclosing changed with it: not "N are hidden" but "N are further down". That is
    // richFilters.rank.demotedSql — rows explicitly outside at least one derived window, i.e.
    // precisely the rows this endpoint used to delete from the answer. Counted below, and only when
    // something actually ranks.
    const rankApplied = !!richFilters.rank.sql;
    const selectCols  = buildSelectColumns(req.query.include_fields);
    const facetDims   = resolveFacetDimensions(req.query.include_facets);

    // ⛔ D151 · "is there any board at all" — an existence probe, not a count of every active row (the only use is > 0),
    // read in the read-worker pool like the rest of the board's reads (A126). Every board page asked it: /api/jobs,
    // facets' 5 + N measures, and each page of best-bets' and the deal's fetchBoardPage.
    const cacheCount = (await readPool.get("SELECT EXISTS(SELECT 1 FROM scraped_jobs WHERE is_active = 1) AS n", []))?.n || 0;
    if (cacheCount > 0) {
      // ── ORDERING AND PAGINATION ────────────────────────────────────────────────────────────
      //
      // The sorts themselves live in services/jobs/jobCursor.js, declared as KEY LISTS rather than
      // as ORDER BY strings, because two things now have to agree about them: the ORDER BY, and the
      // keyset cursor's resume predicate. Written twice they would drift, and a cursor that
      // disagrees with its ORDER BY does not raise an error — it silently returns the wrong rows.
      // So both are generated from one declaration. That module also documents why the leading key
      // is discovered_at rather than scraped_at, why NULLs sort last on every keyed sort, and why
      // every sort must end in sj.job_id.
      // buildOrderKeys decides for itself whether the relevance prefix applies — "relevance leads
      // the DEFAULT order only" is one rule, and it lives with the keys it governs rather than
      // being re-decided at each call site.
      //
      // ── FIT · POSITION ENCODES FIT (owner decision 2026-09-29) ─────────────────────────────────
      //
      // On the default order the board now ranks by the caller's own precomputed fit, between the
      // rank keys and recency (jobCursor.js FIT_KEYS: band ordinal, then score). Off on the Saved
      // tab (a record of what the user chose, ordered as they chose it) and under ?curate=off,
      // which is the user saying "don't sort for me" — fit is sorting for them, so it obeys that.
      const fitRequested = !savedTab && req.query.curate !== 'off';
      // ⭐ D112 item 6 · the user's eligibility answers, read ONCE: the order's lead key (a posting whose STORED
      // requirements contradict an answer they SET goes to the end of the BOARD) and the per-row mark below.
      // Nothing set → ineligibleOrderKey is null → no key; the order, the cursor and the count are as before.
      const boardEligInputs = (() => { try { return userEligibilityInputs(db, req.user.id); } catch { return { defaults: {}, degrees: [] }; } })();
      // ⭐ D137 · postings scored Likely not hiring go to the end of the board — only when there are any (one indexed
      // probe), so a board with none keeps its order and its cursors exactly as before.
      const boardHasGhosts = (() => { try { return !!db.prepare("SELECT 1 FROM scraped_jobs WHERE ghost_level IS NOT NULL AND ghost_level >= 2 AND is_active = 1 LIMIT 1").get(); } catch { return false; } })();
      const orderKeys = buildOrderKeys(sort, richFilters.rank.keys,
        { fit: fitRequested, search: boardSearch, established: richFilters.established.keys,
          ineligible: ineligibleOrderKey(boardEligInputs.defaults), ghost: boardHasGhosts });
      const fitApplied = ordersByFit(orderKeys);
      // The fit keys sort on scores a precompute pass can rewrite while this user pages, so the
      // cursor is signed with an EPOCH that moves whenever their scores do: the newest report row
      // id for (user, profile) — every write is a DELETE + INSERT through storeAtsReportForProfile,
      // so any write produces a new, larger id. A cursor issued before a pass commit is then
      // refused as cursor_sort_mismatch instead of resuming over rows that moved. One index-only
      // MAX over the 108 index; only when fit is actually ordering.
      // D24 · ANY key reading the score (ordersByScore), not only the curated fit keys: the atsScore
      // sort and Newest's best-fit tie-break order by the same cell a precompute pass rewrites.
      const fitEpoch = ordersByScore(orderKeys)
        ? (db.prepare(
            "SELECT COALESCE(MAX(id), 0) AS e FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ?"
          ).get(req.user.id, sessionActiveProfile.id)?.e ?? 0)
        : null;
      // A52 · the caller's CURRENT basis hash, so a score stored against an earlier résumé, claim set
      // or profile is not presented as theirs (presentedScore below). Built, never scored: a few ms.
      // null when there is no base résumé — then no stored score is current, which is true.
      let boardBasisHash = null;
      // (Not needed to MEASURE — nothing is presented — so facets skip its few ms per clause.)
      if (!measure) try { boardBasisHash = atsBasisForProfile(req.user.id, sessionActiveProfile)?.basisHash ?? null; }
      catch (e) { console.warn("[jobs] basis for stored-score check:", e.message); }
      const order     = orderByClause(orderKeys);
      // Projects each sort key into the SELECT as __cursor_kN, so the DATABASE computes the values
      // the cursor carries. Re-deriving COALESCE(discovered_at, scraped_at) or the experience-level
      // CASE in JavaScript would be a second copy of the ordering — the thing this design exists to
      // avoid.
      const cursorCols = cursorProjection(orderKeys);

      // KEYSET vs OFFSET. `?cursor=` is opt-in and `page`/`pageSize` are untouched, so client/ and
      // extension/ keep working exactly as before.
      //
      // Offset paging assumes a stable result set. The board is not stable: a dislike sets
      // disliked=1 and the default board EXCLUDES disliked rows, so the set shrinks BEHIND the
      // reader. Swipe away four rows on page 1 and page 2 starts four rows further down than it
      // should — those four are never shown, the total still counts them, and nothing reports it.
      // A cursor anchors to the last row's own sort VALUES instead of to a position, so deletions
      // behind the anchor cannot move it.
      let cursorClause = { sql: "", params: [] };
      if (rawCursor) {
        const decoded = decodeCursor(rawCursor, orderKeys, { epoch: fitEpoch });
        if (!decoded.ok) {
          // A cursor issued under a different ordering (the user changed the sort, or their
          // profile's derived relevance changed) would otherwise resume against keys that no longer
          // mean the same thing and return an arbitrary slice, with no error. Saying so lets the
          // client do the one correct thing: ask for the first page again.
          return boardReply(400, {
            success: false,
            error: decoded.error === "cursor_sort_mismatch"
              ? "This cursor was issued for a different sort or profile. Request the first page again."
              : "Malformed cursor.",
            code: decoded.error,
            jobs: [], total: 0,
          });
        }
        cursorClause = cursorPredicate(orderKeys, decoded.values);
      }
      const offset  = (pg - 1) * ps;

      // ── CC1b · THE ROLE JOIN IS NOW A *LEFT* JOIN, AND ABSENCE NO LONGER HIDES A ROW ──────────
      //
      // This was an INNER JOIN, and it was the board's last silent exclusion: 277 of 2,460 active
      // rows have no job_role_map row at all — 148 of them titled "...Engineer" — and were
      // unreachable on EVERY profile, whatever their title. Three of the four graded-5 postings
      // CC1 still could not reach were in that set. `am3RestoreBoard` restores scraped_jobs without
      // job_role_map, so a restore silently un-boards a quarter of what it restores.
      //
      // ⛔ role_key STAYS IN THE ON CLAUSE, and that is a correctness requirement rather than a
      // leftover. job_role_map's PRIMARY KEY is (job_id, role_key), so a job MAY hold several
      // buckets; joining on job_id alone would emit one board row per bucket and duplicate
      // postings. With role_key in the ON clause at most one row can ever match. (Zero jobs hold
      // more than one bucket today — but the schema permits it, and a duplicate-emitting board is
      // not a failure anyone would read as a join bug.)
      //
      // The consequence is that `jrm.role_key IS NULL` now means EITHER "never classified" OR
      // "classified as something else", which are exactly the two states that must be told apart —
      // hence the NOT EXISTS in the WHERE clause below. It costs one indexed probe on the PK.
      //
      // On the Saved tab the join is dropped entirely (see savedTab above): the user's own star
      // already answers "does this belong on your board?", and no classifier bucket may overrule it.
      // ── CC5 · THE SCORE ON A CARD COMES FROM THE CALLER'S OWN CACHE, NOT A SHARED CELL ────────
      //
      // `matchScore` used to be read from `scraped_jobs.ats_score` — ONE CELL PER JOB, written at
      // ingest from whichever user's résumé basis triggered the crawl. Every user saw the same
      // stranger's number. An earlier task wired that column up deliberately, to fix a mobile
      // client banding every job "Not enough signal"; it was right about the symptom and wrong
      // about the cure.
      //
      // The score now comes from `ats_only_reports`, keyed (user_id, domain_profile_id, job_id) as
      // of migration 108 — so it is THIS caller's score for THIS profile or it is absent. The ATS
      // panel writes that cache when a user opens a report, so opening a job is what makes its
      // badge appear, per profile.
      //
      // ⛔ A JOIN AND NOT PER-REQUEST SCORING, AND THAT IS A MEASUREMENT RATHER THAN A PREFERENCE.
      // Scoring is local and costs no money, but it is not free in time: 6.67ms mean per posting
      // (median 6.32, p95 9.99, n = 300 real rows, term weights and synonyms warm, median
      // description 5,000 chars). A board PAGE is 50 rows = 0.33s, the owner's curated board is
      // 849 = 5.7s, and SORTING by score needs every row scored — 2,458 = 16.4s. So the board reads
      // a cache and the panel does the scoring. Re-measure with scripts/, not from this comment.
      //
      // The profile match is `IS` rather than `=` so a row cached before migration 108 — which
      // carries domain_profile_id NULL — is not silently unreachable; it simply never matches a
      // real profile id, which is the honest reading of "we do not know which profile this was for".
      const joinClause = `
        FROM scraped_jobs sj
        ${savedTab ? '' : 'LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ?'}
        LEFT JOIN user_jobs uj
          ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
        LEFT JOIN ats_only_reports aor
          ON aor.job_id = sj.job_id AND aor.user_id = ? AND aor.domain_profile_id IS ?
      `;
      // Parameterised over the rich-filter fragment alone so the curated and uncurated counts are
      // guaranteed to differ in nothing else — a hand-copied second WHERE would drift the first time
      // any clause above changes.
      // `is_active = 1` is a DISCOVERY predicate — "this listing is still live" — and on every other
      // board it stays. The Saved tab relaxes it for the same reason it drops the role join: these
      // are the user's own picks, and a saved posting that has since closed must be shown as closed,
      // not quietly removed from the list they built.
      //
      // This is the half that makes runExpiredJobsCleanup's retirement mean anything. That pass now
      // sets is_active = 0 on an expired starred row instead of deleting it — but with a hard
      // `is_active = 1` here the row would have been preserved in the database and still invisible to
      // its owner, which is the same disappearance with extra steps. mapJobRow exposes isActive so
      // the card can label it.
      // CC1b — the soft-null role predicate. "On the board if it is in my declared bucket, OR if
      // nobody has classified it yet." An explicit mismatch is still excluded, which is what keeps
      // the board's SCOPE hard; only ABSENCE was ever the defect. Same shape and same reasoning as
      // the work_type / employment_type / category clauses above, which say it outright: a row must
      // never be hidden purely because we have not classified it, only on an explicit mismatch once
      // we have. Takes no bound parameter — the roleKey is already bound in the LEFT JOIN.
      //
      // ⛔ A72 · A SEARCH LIFTS THE ROLE SCOPE. Measured on an engineering profile: "data engineer"
      // returned 0 while 19 titles named it (bucketed 'data'), "product manager" returned 4
      // description-only hits while 145 titles named it ('pm'). The scope is the profile's DEFAULT —
      // what to show unasked; a typed term is the user asking, and the newer, narrower instruction
      // wins. Every filter the user SET still applies, and so do is_active and dislikes. The LEFT JOIN
      // stays (its placeholder is in argsFor), so only this predicate moves.
      // ⛔ D30 · SO DOES AN EXPLICIT FUNCTION ("design jobs"). The domain dial names the kind of work, so
      // choosing one is the user overriding the profile's declared role for this view, exactly as a
      // typed search does — its own soft-null predicate (jobQuery.js job_functions) then scopes the board.
      // ⭐ D42 (owner, 10-06) · the dial's "all" — nothing chosen — is the profile's scope WIDENED by
      // its extra buckets: an engineering profile's "all" is engineering + data (ROLE_SCOPE_EXTRA).
      const functionChosen = String(req.query.job_functions || "").trim() !== "";
      const scopeExtraSql = roleScopeExtraSql(roleScopeExtra(roleKey));
      // ⛔ D41(a) (owner, 10-06): ALL IS THE WHOLE SET — ★ Saved, /d Drafted and + Imported are views of
      // it, not separate stores. The scope is a DISCOVERY default, so it must never hide a row the user
      // made their own: one they starred, captured or drafted is in ALL whatever its role bucket — and
      // search and every filter then find it there. The id is inlined as an integer (never text).
      const ownUid = Number.isSafeInteger(Number(req.user.id)) ? Number(req.user.id) : -1;
      const ownRowsSql = `uj.starred = 1
            OR uj.resume_generated = 1
            OR EXISTS (SELECT 1 FROM job_captures jc WHERE jc.job_id = sj.job_id AND jc.user_id = ${ownUid})
            OR EXISTS (SELECT 1 FROM application_records ar WHERE ar.job_id = sj.job_id AND ar.user_id = ${ownUid})`;
      // ⭐ D40 · THE + VIEW: the same statement as ALL, restricted to this user's captures. Like ★, a
      // capture whose listing has since closed stays in it, labelled — the one exception.
      const importedTab = imported === '1';
      // ⭐ A91 · /d IS ALL RESTRICTED BY ONE PREDICATE — the board's search, sentence and drawer filters
      // now apply to it exactly as to ALL (it used to be /api/jobs/pending, a query of its own).
      const pendingTab = pending === '1';
      // ⭐ D151 Rule 4 (11-08): /d's membership needs a résumé or an application record of this person's — that union,
      // as a driving IN-list (a necessary condition; the predicate still decides), so /d starts from their few rows.
      const pendingSql = pendingTab ? `AND ${pendingMembershipSql(ownUid)}
          AND sj.job_id IN (SELECT pr.job_id FROM resumes pr WHERE pr.user_id = ${ownUid} UNION SELECT ar.job_id FROM application_records ar WHERE ar.user_id = ${ownUid})` : '';
      if (pendingTab) { try { movePendingExpired(db, { userId: ownUid }); } catch { /* D112 c2: the sweep catches up */ } }
      // ⭐ D151 Rule 4 (11-08): + also names the captured set as a driving IN-list (migration 228's index), the same rows.
      const importedSql = importedTab
        ? `AND EXISTS (SELECT 1 FROM job_captures jc WHERE jc.job_id = sj.job_id AND jc.user_id = ${ownUid})
          AND sj.job_id IN (SELECT c.job_id FROM job_captures c WHERE c.user_id = ${ownUid})` : '';
      const roleSql = (savedTab || boardSearch || functionChosen) ? '' : `AND (
            jrm.role_key IS NOT NULL${scopeExtraSql ? `
            OR ${scopeExtraSql}` : ''}
            OR NOT EXISTS (SELECT 1 FROM job_role_map m WHERE m.job_id = sj.job_id)
            OR ${ownRowsSql}
          )`;
      // ⛔ D126 + D127 · THE CATEGORY, SOFT-NULL LIKE THE ROLE ABOVE. A 'held' posting is never shown on any board (the
      // red-flag rule); a posting in another category is an explicit mismatch, excluded unless the user asked (a search,
      // a chosen function lift it, as they lift the role); NULL is "not classified yet" and shows until the boot backfill
      // fills it. The category comes from professionalScope's closed set (checked against /^[a-z_]+$/ before inlining).
      const boardCategory = (savedTab || boardSearch || functionChosen) ? null : profileCategory(sessionActiveProfile || {});
      const categorySql = savedTab ? '' : `AND (sj.board_category IS NULL OR (sj.board_category <> 'held'${
        boardCategory && /^[a-z_]+$/.test(boardCategory) ? ` AND sj.board_category = '${boardCategory}'` : ''}) OR ${ownRowsSql})`;
      // ⛔ A126 (7) (hotfix 11-05) · A POSTING REACHES THE BOARD AFTER THE ENGINES, NOT BEFORE. Discovery views (ALL, the
      // sentence's filters, a search, the deck that deals from this board) show only postings scored against the
      // profile's CURRENT résumé basis; the rest are counted as `beingMatched` and handed to the match queue
      // (enqueueBoardMatch → boardFit().scoreIds), which scores them and tells the open board (sync event
      // `board_scored`). ★ / + / /d and ?curate=off are the person's own lists — never gated. The cheap half of the
      // badge's "current" test (basis_hash), not the per-row posting re-hash: that would cost seconds a load at 52k
      // rows; a posting edited after scoring is rescored by the precompute's postingChanged pass. Before: ≈ 80 % of the
      // owner's widened board read "ATS pending". DRAFT_BOARD_SCORED_ONLY=off turns it off.
      const scoreGateOn = String(process.env.DRAFT_BOARD_SCORED_ONLY || "on").toLowerCase() !== "off"
        && !savedTab && !importedTab && !pendingTab && req.query.curate !== 'off';
      let gateBasis = null;
      if (scoreGateOn) { try { gateBasis = atsBasisForProfile(req.user.id, sessionActiveProfile)?.basisHash ?? null; } catch { gateBasis = null; } }
      // ⭐ D151 Rule 4 (11-08): the gate also names the person's scored set as an IN-list, so SQLite starts from those
      // ≈ hundreds of ats_only_reports rows (their (user, profile, job) index) and looks each posting up by job_id —
      // instead of scanning every active posting to keep the scored ones (the 20-user suite at 100k: read-pool throughput).
      // Same rows as before (aor already required that score); the ids are integers and the hash is hex-checked above.
      const gateProfileId = Number.isSafeInteger(Number(sessionActiveProfile?.id)) ? Number(sessionActiveProfile.id) : -1;
      const scoreGateSql = scoreGateOn && typeof gateBasis === "string" && /^[0-9a-f]{8,128}$/.test(gateBasis)
        ? `AND aor.id IS NOT NULL AND aor.basis_hash = '${gateBasis}'
          AND sj.job_id IN (SELECT r.job_id FROM ats_only_reports r WHERE r.user_id = ${ownUid} AND r.domain_profile_id IS ${gateProfileId} AND r.basis_hash = '${gateBasis}')` : '';
      const whereClauseFor = (rich, { gate = true } = {}) => `
        WHERE ${(savedTab || importedTab) ? '1 = 1' : 'sj.is_active = 1'}
          ${roleSql}
          ${categorySql}
          ${keyFilter}
          ${locFilter}
          AND ${titleFilter.sql}
          ${wtFilter}
          ${etFilter}
          ${catSql}
          ${domSql}
          ${srcSql}
          ${maxAppSql}
          ${visitedSql}
          ${starredSql}
          ${importedSql}
          ${pendingSql}
          ${appliedSql}
          ${ageSql}
          ${yoeSql}
          ${minYoeSql}
          ${rich.sql}
          ${fitBandSql}
          ${gate ? scoreGateSql : ''}
          AND (uj.disliked IS NULL OR uj.disliked = 0)
      `;
      const argsFor = (rich) => [
        // Must track joinClause exactly: no role_key placeholder on the Saved tab, so no roleKey arg.
        ...(savedTab ? [] : [roleKey]),
        req.user.id, sessionActiveProfile.id,
        // CC5 · the ats_only_reports join, in TEXT ORDER after user_jobs.
        req.user.id, sessionActiveProfile.id,
        ...keyArgs, ...locArgs, ...titleFilter.params,
        ...wtArgs, ...etArgs, ...catArgs, ...domArgs, ...srcArgs,
        ...maxAppArgs, ...ageArgs, ...yoeArgs, ...minYoeArgs,
        ...rich.params,
      ];
      const whereClause = whereClauseFor(richFilters);
      const baseArgs    = argsFor(richFilters);
      // D24 · GET /api/jobs/facets stops here, with the board's own bindings (see boardPageResponse's
      // `measure` note). No page is fetched, no fit pass is scheduled, nothing is logged as a board load.
      if (measure) {
        return boardReply(200, { measured: true, value: await measure({
          db, read: readPool, joinClause, whereClause, baseArgs, unclassifiedSql: richFilters.established.unclassifiedSql,
          fitScoreSql,
        }) });
      }

      // ONE EXTRA ROW. Fetching ps+1 and trimming is what makes `hasMore` a fact rather than an
      // inference: comparing rows.length to ps cannot distinguish "exactly a full last page" from
      // "a full page with more behind it", and a cursor feed that guesses wrong either stops one
      // page early or offers a next page that returns nothing.
      //
      // PARAMETER ORDER IS SQL TEXT ORDER, and this statement now has four param groups instead of
      // two. Placeholder binding is positional, so they must be passed exactly as they appear:
      // SELECT (cursor projection) -> JOIN/WHERE (baseArgs) -> AND cursor predicate -> ORDER BY
      // (rank params) -> LIMIT. Getting this wrong does not throw; it returns plausible wrong rows.
      const cursorSql = cursorClause.sql ? `AND ${cursorClause.sql}` : "";
      // ⛔ A126 · read in the worker pool (readPool), off the event loop — the same statement, the same params.
      const fetched = await readPool.all(
        // CC5 · `matchScore` is selected from the CALLER's cache, aliased to the name mapJobRow
        // reads. sj.ats_score is deliberately not selected under that name any more — see the
        // joinClause note.
        // A62 follow-up · `held_outside_us`: a capture the US-only gate held off the board is
        // is_active = 0, exactly like an expired listing, so the Saved tab told its owner it was
        // "NO LONGER LISTED". It is listed; the board is US-only. The gate's own record
        // (rejected_jobs, `out_of_market:`, cleared when a later crawl admits the posting) says
        // which. A literal projection, not a fragment: only an inactive row can be held, so every
        // board but Saved short-circuits on is_active, and the count needs no matching change.
        `SELECT ${selectCols}, uj.visited, uj.applied, uj.starred, uj.disliked,
                (sj.is_active = 0 AND EXISTS (SELECT 1 FROM rejected_jobs rj WHERE rj.job_id = sj.job_id AND rj.reason LIKE 'out_of_market:%')) AS held_outside_us,
                aor.ats_score AS matchScore, ${storedScoreSql("sj", "aor")}${cursorCols.sql}
         ${joinClause} ${whereClause} ${cursorSql} ORDER BY ${order.sql} LIMIT ?${rawCursor ? "" : " OFFSET ?"}`,
        [
        ...cursorCols.params,
        ...baseArgs,
        ...cursorClause.params,
        ...order.params,
        ps + 1,
        ...(rawCursor ? [] : [offset]),
        ],
      );
      const hasMore = fetched.length > ps;
      const rows    = hasMore ? fetched.slice(0, ps) : fetched;
      // Issued from the LAST ROW ACTUALLY RETURNED, so it is valid whether the caller paged by
      // cursor or by offset — an offset-paging client can adopt cursors mid-feed without a reset.
      const nextCursor = hasMore && rows.length ? encodeCursor(orderKeys, rows[rows.length - 1], { epoch: fitEpoch }) : null;
      // ⛔ THE COUNT AND THE LIST MUST BE THE SAME QUESTION, ASKED TWICE.
      //
      // `joinClause`, `whereClause` and `baseArgs` are the SAME VALUES the list statement above
      // used — not a re-derivation, the identical bindings. That is the whole guarantee: a count
      // that reports rows the list cannot return is unfalsifiable from the UI, and this project
      // has already shipped one pair of queries that counted different things (the source-health
      // false critical, where `written` and `unchanged` came from different predicates and "the
      // board didn't change" read as "the source stopped working").
      //
      // ⚠ THE ONE DELIBERATE ASYMMETRY IS `cursorSql`, AND IT IS NOT A DIVERGENCE. `total` means
      // "rows matching the filters", not "rows still ahead of this cursor" — a feed that counted
      // only the remainder would show the number shrinking as you scroll. So the cursor predicate
      // belongs on the list and must NOT be added here. describeEmptyBoard() below is what keeps
      // that honest, by naming the end-of-feed case instead of letting it look like an empty board.
      //
      // test/boardCountMatchesList.test.js asserts the two statements are built from these same
      // three variables, so a future edit cannot fork one without failing.
      const total = (await readPool.get(`SELECT COUNT(*) as n ${joinClause} ${whereClause}`, baseArgs))?.n || 0;
      // ⛔ A126 (7) · what the gate held back: counted (the board says "N more being matched") and queued, newest first.
      // First page only — paging the same board must not re-queue it.
      let beingMatched = 0;
      let beingMatchedMore = false;
      if (scoreGateSql && pg === 1 && !rawCursor) {
        try {
          const heldSql = `${whereClauseFor(richFilters, { gate: false })} AND (aor.id IS NULL OR aor.basis_hash IS NOT '${gateBasis}')`;
          // ⭐ D151 Rule 4 (11-08): ONE read, not a COUNT over the whole board plus this list. Newest first through
          // migration 229's partial recency index, stopping at BOARD_MATCH_BATCH + 1: fewer is the exact number, one
          // more means "2,000+" (measured on the 100k copy: the COUNT 0.4 s + the list 4.9 s → the list 0.16 s).
          // ⭐ D151 (45k): KEPT per user + this exact statement (heldCountCache.js) — fresh for 20 s, then answered at once
          // while one refresh runs behind it; the read (and the re-queue) happens only on a miss or a refresh. Measured:
          // this statement was 203 of the 204 slow reads in the 20-user suite, asked by every first page.
          const heldStatement = `SELECT sj.job_id AS id ${joinClause} ${heldSql} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ${BOARD_MATCH_BATCH + 1}`;
          const heldProfile = sessionActiveProfile;
          const { value: heldNow } = await heldCounts.get(heldKey(req.user.id, heldStatement, baseArgs), async () => {
            const rows = await readPool.all(heldStatement, baseArgs);
            const held = rows.slice(0, BOARD_MATCH_BATCH);
            if (held.length) enqueueBoardMatch(req.user.id, heldProfile, held.map(r => r.id));
            return { count: held.length, more: rows.length > BOARD_MATCH_BATCH };
          });
          beingMatchedMore = heldNow.more;
          beingMatched = heldNow.count;
        } catch (e) { console.warn("[board-match] count / queue:", e.message); }
      }
      const totalPages = Math.ceil(total / ps);
      // A73 · of `total`, how many are on the board only because a filter the user set could not
      // judge them (the column is not classified yet). They are ordered last; this says how many.
      const unclassifiedSql = richFilters.established.unclassifiedSql;
      const unclassified = unclassifiedSql
        ? { count: (await readPool.get(`SELECT COUNT(*) as n ${joinClause} ${whereClause} AND ${unclassifiedSql}`, baseArgs))?.n || 0,
            filters: richFilters.established.filters }
        : null;

      // WHY THE PAGE IS EMPTY, WHEN IT IS. Absent whenever rows came back, so a healthy response is
      // byte-identical to before and no client has to learn a new field to keep working.
      const emptyReason = describeEmptyBoard({
        total, returned: rows.length, page: pg, totalPages,
        usedCursor: !!rawCursor, activeFilters: activeFilterNames(req.query),
      });

      console.log(JSON.stringify({ msg: '[jobs]', profile: sessionActiveProfile.profile_name, sort, total, returned: rows.length,
        ...(emptyReason ? { emptyReason: emptyReason.code } : {}) }));
      // ⛔ A COUNT/LIST DISAGREEMENT IS A DEFECT AND GETS ITS OWN LINE, at error level. Every other
      // empty-board code is an ordinary state a user can cause; this one cannot be reached by any
      // input and means the two statements above stopped asking the same question.
      if (emptyReason?.diagnostic) {
        console.error(`[jobs] ⛔ COUNT/LIST MISMATCH — total=${total} returned=0 page=${pg}/${totalPages} `
          + `profile=${sessionActiveProfile.id} sort="${sort}" — the count and the list have diverged`);
      }

      // D40 · the + view's capture meta, read for THIS PAGE's rows after the list — not spliced into the
      // list statement, which must interpolate exactly what the count does (boardCountMatchesList).
      const capturedBy = new Map();
      if (importedTab && rows.length) {
        const ids = rows.map(r => r.job_id);
        for (const c of db.prepare(`SELECT job_id, MAX(created_at) AS captured_at,
              (SELECT c2.url FROM job_captures c2 WHERE c2.user_id = c1.user_id AND c2.job_id = c1.job_id ORDER BY c2.id DESC LIMIT 1) AS captured_url
            FROM job_captures c1 WHERE user_id = ? AND job_id IN (${ids.map(() => "?").join(",")}) GROUP BY job_id`).all(req.user.id, ...ids)) {
          capturedBy.set(c.job_id, c);
        }
      }
      // A91 · the /d card's résumé fields (the panel opens the generated résumé without a second fetch),
      // read for THIS PAGE's rows after the list, like the + view's capture meta.
      const resumeBy = new Map();
      if (pendingTab && rows.length) {
        const ids = rows.map(r => r.job_id);
        for (const r of db.prepare(`SELECT job_id, ats_score, ats_report, html AS resume_html, apply_mode FROM resumes
            WHERE user_id = ? AND job_id IN (${ids.map(() => "?").join(",")})`).all(req.user.id, ...ids)) resumeBy.set(r.job_id, r);
      }
      // ⭐ D104 P1 · the board MARKS a posting whose stated requirements contradict what THIS user set ("U.S. citizens only",
      // "no visa sponsorship") and DEMOTES it within the page — never hides it: the user can still open it and apply by
      // hand. Computed only when the user has set something a requirement could contradict.
      // ⭐ D112 item 6 · ACROSS pages now for citizenship and clearance: the ORDER BY's lead key (ineligibleOrderKey,
      // above) reads the stored req_* columns, so those rows are already last on the board. ⚠ Sponsorship and degree
      // are not stored columns — for them (and a row whose stored reading is stale) this within-page move remains.
      const eligInputs = boardEligInputs;
      const ineligible = new Map();
      if (hasEligibilityInputs(eligInputs)) {
        for (const j of rows) { const e = eligibilityForRow(j, eligInputs); if (e.status === "ineligible") ineligible.set(j.job_id, e.reasons); }
      }
      // ⭐ D121 P3 · the ONE sponsorship signal per posting. With the "company sponsors" filter on, a posting whose OWN words
      // say it won't sponsor is demoted to the end of the page (its text is not SQL; the company half is in the query).
      const signals = (() => { try { return sponsorshipSignalsForRows(db, rows); } catch { return new Map(); } })();
      if (req.query.company_sponsorship) for (const j of rows) if (signals.get(j.job_id)?.level === "says_no" && !ineligible.has(j.job_id)) ineligible.set(j.job_id, null);
      const pageRows = ineligible.size ? [...rows.filter(j => !ineligible.has(j.job_id)), ...rows.filter(j => ineligible.has(j.job_id))] : rows;
      // ⭐ D107 P2 · is this posting alive — "Reposted 4 times since June" · "Open 94 days" · "New — first seen yesterday".
      const liveness = (() => { try { return livenessForRows(db, pageRows); } catch { return new Map(); } })();
      // ⭐ D137 · the ghost score with its evidence — "Likely not hiring · Reposted 4 times since June · Open 94 days".
      // Only Uncertain and Likely not hiring are sent; nothing against a posting sends nothing.
      const ghost = (() => { try { return ghostForRows(db, pageRows); } catch { return new Map(); } })();
      // ⭐ D108 P1 · "Filed 290 certified LCAs in FY2025" — the company's public filings, with the source and its date.
      const sponsorship = (() => { try { return sponsorshipFactsForRows(db, pageRows); } catch { return new Map(); } })();
      // ⭐ D121 · the ONE sponsorship signal per posting (company · title family · the posting's own words) — the card's
      // chip and the job page's block draw it; `sponsorshipNeeded` (the user's own Application defaults) only sets how
      // prominent the chip is.
      const sponsorshipNeeded = boardEligInputs?.defaults?.sponsorship_now === "yes" || boardEligInputs?.defaults?.sponsorship_later === "yes";
      const responseBody = {
        success:    true,
        // ⛔ A52 · A STORED SCORE IS SHOWN ONLY WHILE IT IS STILL ABOUT THIS POSTING AND THIS BASIS.
        // A card read "No signal" beside a panel reading "Strong match" because the stored row
        // predated the posting's enrichment. presentedScore nulls a stale score — null is "no
        // opinion", which the card renders as nothing — and the precompute this board load schedules
        // replaces it. The ORDER may still use it until then; the verdict is never shown.
        jobs:       pageRows.map(j => ({ ...mapJobRow({ ...j, matchScore: presentedScore(j, { basisHash: boardBasisHash }) }),
                                     scrapedAt: j.scraped_at,
                                     ...(ineligible.get(j.job_id) ? { eligibility: { status: "ineligible", reasons: ineligible.get(j.job_id) } } : {}),
                                     ...(liveness.has(String(j.job_id)) ? { liveness: liveness.get(String(j.job_id)) } : {}),
                                     ...(ghost.has(String(j.job_id)) ? { ghost: ghost.get(String(j.job_id)) } : {}),
                                     ...(levelOfRow(j) ? { levelRead: levelOfRow(j) } : {}),
                                     ...(sponsorship.get(j.company) ? { sponsorshipFact: sponsorship.get(j.company) } : {}),
                                     ...(signals.get(j.job_id) ? { sponsorship: { ...signals.get(j.job_id), needed: sponsorshipNeeded } } : {}),
                                     // D40 · the + view's one extra line: "captured <date> · from <host>".
                                     ...(importedTab ? { captured: captureMeta(capturedBy.get(j.job_id)) } : {}),
                                     ...(pendingTab && resumeBy.has(j.job_id) ? (({ job_id, ...r }) => r)(resumeBy.get(j.job_id)) : {}) })),
        total,
        // A73 · present only when a user-set filter kept rows it could not judge; they sort last.
        ...(unclassified ? { unclassified } : {}),
        // D121 · whether this user said they need sponsorship — how prominent each card's sponsorship chip is.
        sponsorshipNeeded,
        page:       pg,
        pageSize:   ps,
        totalPages,
        sources:    ['scraped_jobs'],
        fromCache:  true,
        // Only present when the page came back empty — see describeEmptyBoard. An empty board that
        // cannot say why is how two NULL-propagation bugs in this project stayed invisible.
        ...(emptyReason ? { emptyReason } : {}),
        // ALWAYS emitted, on both paging modes. A client that never sends `cursor` simply ignores
        // it, and one that wants to switch to keyset paging can adopt the cursor from any page it
        // already has rather than restarting the feed.
        //
        // null means THIS IS THE LAST PAGE, established by fetching ps+1 rows rather than by
        // comparing a count — see the query above.
        nextCursor,
        // `page` and `totalPages` describe OFFSET paging and are meaningless while paging by
        // cursor: there is no page number to be on. Said in the body rather than left for a client
        // to infer from a number that looks valid — rendering "page 1 of 34" on every cursor page
        // is precisely the kind of quietly-wrong surface this codebase keeps finding.
        paging: rawCursor ? 'cursor' : 'offset',
        // A126 (7): postings this board would show once matched — queued now; the board refreshes on `board_scored`.
        ...(beingMatched ? { beingMatched } : {}),
        ...(beingMatchedMore ? { beingMatchedMore: true } : {}),
      };

      // Curation disclosure — now a statement about ORDER, not about a withheld remainder.
      //
      // The old shape (total / uncuratedTotal / hidden) said "Showing 210 of 241". Under ranking that
      // sentence would be a lie in the only way that matters: all 241 are on the board, and claiming
      // otherwise would send users to hunt for rows that are two screens down rather than missing.
      // `demoted` replaces `hidden` and counts the rows explicitly outside a derived window — the
      // same rows the old `hidden` counted, now described by where they went instead of by their
      // absence. `applied` is unchanged so a client that has not been updated still renders something
      // truthful rather than throwing.
      //
      // Only emitted when something actually ranked AND something is actually demoted, so a profile
      // with no signals still gets a byte-identical response to before.
      //
      // FIT is disclosed the same way, as `rankedKeys: [..., 'fit']`, and it LAST because it is the
      // last derived key applied: it orders what the rank keys leave tied. It does not add to
      // `demoted` — a Weak row is lower, not outside a window the user was told about — and it is
      // disclosed even when nothing is demoted, because an ordering the user cannot account for is
      // exactly what this block exists to prevent. Same Curation shape: rankedKeys was always a
      // string list, so no client has to learn a field.
      if (rankApplied || fitApplied) {
        // ⛔ A126 · a whole-board count — in the worker pool, off the event loop (the 11-05 profile's largest stretch).
        const demotedRows = rankApplied ? ((await readPool.get(
          `SELECT COUNT(*) as n ${joinClause} ${whereClause} AND ${richFilters.rank.demotedSql}`,
          [...baseArgs, ...richFilters.rank.demotedParams]))?.n || 0) : 0;
        if (demotedRows > 0 || fitApplied) {
          responseBody.curation = {
            applied:    true,
            ranked:     true,
            rankedKeys: fitApplied ? [...richFilters.rankedKeys, 'fit'] : richFilters.rankedKeys,
            total,
            demoted:    demotedRows,
          };
        }
      }
      // The board loading is itself a trigger: it covers every basis change no hook named (and a
      // user whose rows were never scored at all). First page only, and the precompute coalesces,
      // so paging or re-rendering costs nothing; when the cache is complete this is one plan query
      // that answers "nothing to do", off the request path.
      // D24 · also when the user asked for score order (Best fit) or filtered by fit: before, only the
      // CURATED board scheduled a pass, so a user who only ever sorted by Best fit, or chose "where my
      // fit is Strong", read a cache nothing was filling. Not on the Saved tab or under curate=off.
      const wantsScores = fitApplied
        || (!savedTab && req.query.curate !== 'off' && (sort === 'atsScore' || fitBands.length > 0));
      if (wantsScores && !rawCursor && pg === 1) scheduleBoardFit(req.user.id, "board", sessionActiveProfile);

      // include_facets (optional, default-off): facet counts over the SAME filtered result
      // set, using the identical joinClause/whereClause/baseArgs as the main query.
      if (facetDims.length) {
        const facets = {};
        // ⭐ D151 (45k) · ONE GROUP BY over every asked dimension, not one statement each: the board's WHERE runs once and
        // each dimension's expression (tag-layer lookups for level / workplace / employment) is evaluated once per row.
        // The cross-tab's rows are summed per dimension in JS — the same per-value counts a GROUP BY of that dimension
        // alone gives (each board row is in exactly one cross-tab row), in the same ascending value order. Before: five
        // whole-result statements per Full House load, each a full pass over the board (the 20-user suite's worst p95).
        const plainDims = facetDims.filter(dim => dim !== 'skills');   // skills: computed separately below (JSON column)
        if (plainDims.length) {
          // ⛔ D151 · whole-result GROUP BYs — in the read-worker pool (A126), off the event loop.
          const facetRows = await readPool.all(`
            SELECT ${plainDims.map((dim, i) => `${FACET_DIMENSIONS[dim].column} AS f${i}`).join(', ')}, COUNT(*) as count
            ${joinClause} ${whereClause}
            GROUP BY ${plainDims.map((_d, i) => `f${i}`).join(', ')}
          `, baseArgs);
          Object.assign(facets, facetsFromCrossTab(plainDims, facetRows));
        }
        if (facetDims.includes('skills')) {
          const skillsRows = await readPool.all(`SELECT sj.skills_json as skills_json ${joinClause} ${whereClause}`, baseArgs);
          facets.skills = computeSkillsFacet(skillsRows.map(r => r.skills_json));
        }
        responseBody.facets = facets;
      }

      return boardReply(200, responseBody);
    }

    // --- Empty cache: an explained empty board, NOT a live aggregator feed ---
    //
    // This used to fall through to searchJobs() — an unauthenticated-shaped, global Adzuna/SerpAPI
    // query. Everything that makes this endpoint "your board" was skipped on that path: the
    // job_role_map role_key scoping, profileTitleSql, the profile bridge, every key in
    // buildJobFilters, the Saved (starred) tab, visited, and the disliked exclusion. `sanitized`
    // forwarded exactly five of them (query/location/country/employmentType/remote) and dropped the
    // rest silently.
    //
    // Measured on a real run with an empty cache and an ENGINEERING profile: the default board, the
    // Saved tab, tiers_include=gated, experience_levels=executive and sources_include=ashby all
    // returned the SAME 6,213,918-row result led by "Occupational Therapist" — which is precisely
    // the reported "the same set of listings renders regardless of search or filters". A Saved tab
    // showing 6.2M jobs the user never saved is the read-side twin of the write-side defect this
    // codebase keeps hitting: a surface reporting something it did not do.
    //
    // Live search is still available and is unaffected — it has its own endpoint (POST
    // /api/jobs/search), which the client already calls, plus the public GET /api/jobs/generic.
    // What is removed is the silent substitution of a global feed for a profile-scoped board.
    console.warn(`[jobs] cache empty — returning explained empty board for profile ${sessionActiveProfile.id}`);
    return boardReply(200, {
      success:    true,
      jobs:       [],
      total:      0,
      page:       pg,
      pageSize:   ps,
      totalPages: 0,
      sources:    ['scraped_jobs'],
      fromCache:  true,
      reason:     'cache_empty',
      // Shaped identically to a populated answer, deliberately. An empty board is a NORMAL state,
      // and a client that reads `nextCursor` unconditionally must not have to special-case it —
      // null already means "no more", which is the truth here.
      nextCursor: null,
      paging:     rawCursor ? 'cursor' : 'offset',
    });
  } catch (err) {
    console.error('[GET /api/jobs] Error:', err.message);
    return boardReply(500, {
      success: false,
      error:   'Failed to fetch jobs. Please try again.',
      jobs:    [],
    });
  }
}

// ⭐ D136 · GET /api/best-bets — "This week's best bets": the few postings on the user's own curated board most likely to
// lead to a real conversation, each with its band (Best bet · Good bet · Long shot) and its reasons. Hard filters first
// (eligibility, won't sponsor, closed, already drafted / applied), then the signals in shared/bestBets.js. ⛔ A ranked
// score from signals — never a probability until P3's calibration has 500 outcomes. ?size= (3–20) else Auto settings'
// bestBets (default 5).
app.get("/api/best-bets", requireAuth, async (req, res) => {
  try {
    const profile = getOrRepairActiveProfile(req.user.id);
    if (!profile) return res.json({ size: 0, considered: 0, matches: 0, calibrated: false, bets: [] });
    const settings = readAutoSettings(db.prepare("SELECT auto_settings FROM users WHERE id = ?").get(req.user.id)?.auto_settings);
    const size = req.query.size != null ? Number(req.query.size) : settings.bestBets;
    const fetchBoardPage = async (cursor) => {
      const { status, body } = await boardPageResponse({ ...req, query: { pageSize: "50", ...(cursor ? { cursor } : {}) } });
      return { ok: status === 200 && body?.success !== false, jobs: body?.jobs || [], nextCursor: body?.nextCursor || null, total: body?.total };
    };
    // ⛔ D151 · the board pages read through boardPageResponse (its list and counts in the read-worker pool, A126); the
    // cards' company velocity through the pool too (`read`) — the cold-cache job_history walk off the event loop.
    res.json(await bestBetsFor(db, { userId: req.user.id, profileId: profile.id, size, fetchBoardPage, read: readPool }));
  } catch (e) {
    console.error("[best-bets]", e.message);
    res.status(500).json({ error: "best_bets_failed", message: "Best bets could not be worked out. Try again." });
  }
});

// ⭐ D143 · THE NAVIGATOR — GET: the destination (recommended with reasons, the alternatives, or the user's own aim), the
// route (skills in order with their Learn steps, and the bridge roles to apply to now), this week's progress and the
// re-routing changes with their reasons. PUT /aim { slug | null }: the user's own aim (null = follow the recommendation).
app.get("/api/navigator", requireAuth, (req, res) => {
  try { res.set("Cache-Control", "private, no-store"); res.json(navigatorFor(db, req.user.id)); }
  catch (e) { console.error("[navigator]", e.message); res.status(500).json({ error: "navigator_failed", message: "The navigator could not be worked out. Try again." }); }
});
app.put("/api/navigator/aim", requireAuth, (req, res) => {
  try { res.json(setAim(db, req.user.id, req.body?.slug ?? null)); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "navigator_failed", message: e.message }); }
});

// ⭐ D138 · WARM PATHS — the user's OWN contacts (LinkedIn's Connections.csv, an alumni list they add), matched to a
// posting's company, with a note drafted from the facts for them to edit. Private, deletable; draft never sends the note
// nor contacts anyone. The file's text is read by the browser and posted here (no upload stored).
app.get("/api/warm-paths", requireAuth, (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json(warmSummary(db, req.user.id));
});
app.post("/api/warm-paths/import", requireAuth, (req, res) => {   // the app's 4 MB JSON limit: ≈ 30,000 connections
  try { res.json(importContacts(db, req.user.id, { source: req.body?.source, text: String(req.body?.text ?? ""), school: req.body?.school ?? null })); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "import_failed", message: e.message }); }
});
app.delete("/api/warm-paths", requireAuth, (req, res) => {
  try { res.json({ deleted: deleteContacts(db, req.user.id, { source: req.query.source || null, school: req.query.school ?? null }) }); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "delete_failed", message: e.message }); }
});
app.get("/api/warm-paths/job/:jobId", requireAuth, (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const job = db.prepare("SELECT job_id, title, company, apply_url, url FROM scraped_jobs WHERE job_id = ?").get(String(req.params.jobId));
  if (!job) return res.status(404).json({ error: "not_found" });
  const path = warmPathTo(db, req.user.id, job.company);
  if (!path) return res.json({ count: 0, people: [] });
  const userName = db.prepare("SELECT full_name FROM user_profile WHERE user_id = ?").pluck().get(req.user.id) || null;
  res.json({ ...path, people: path.people.map(p => ({ ...p,
    note: draftNote({ person: p, job: { title: job.title, company: job.company, url: job.apply_url || job.url }, userName }) })) });
});

// ⭐ D142 · READINESS — CHECK: the user's skills (claimed → checked → built), an adaptive check per skill whose clock is
// the server's, and its awareness summary (never a grade). Only reviewed questions are served; the answer key never
// leaves the server before the answer. Admin reviews the bank (Data → Readiness questions).
app.get("/api/readiness", requireAuth, (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json({ skills: readinessStates(db, req.user.id) });
});
app.post("/api/readiness/checks", requireAuth, (req, res) => {
  try { res.json(startCheck(db, req.user.id, { skill: req.body?.skill, mode: req.body?.mode || "timed" })); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "check_failed", message: e.message }); }
});
app.post("/api/readiness/checks/:id/answer", requireAuth, (req, res) => {
  try { res.json(answerCheck(db, req.user.id, Number(req.params.id), { questionId: req.body?.questionId, chosen: req.body?.chosen })); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "answer_failed", message: e.message }); }
});
// ⭐ D137 P3 · the ghost-posting rate by category and company (aggregates only) — the Skills Index's data, for the owner
// until the Index exists.
app.get("/api/admin/ghost-rates", requireAdmin, (_req, res) => res.json(ghostRates(db)));
app.get("/api/admin/readiness", requireAdmin, (req, res) => {
  const status = ["draft", "live", "retired"].includes(req.query.status) ? req.query.status : "draft";
  res.json({ mostClaimed: mostClaimed(db, 10),
    questions: db.prepare("SELECT * FROM readiness_questions WHERE status = ? ORDER BY skill_key, difficulty, id").all(status)
      .map(q => ({ ...q, options: JSON.parse(q.options_json) })) });
});
app.post("/api/admin/readiness/questions/:id/review", requireAdmin, (req, res) => {
  try { res.json(reviewQuestion(db, Number(req.params.id), { action: req.body?.action, edits: req.body?.edits || null,
    reviewer: req.user?.username || req.admin?.email || null })); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "review_failed", message: e.message }); }
});
// ⭐ D150 T02 · Admin → Data → Question bank: every item (any status) with its stats and flags; ⛔ the review route is the
// ONLY way an item becomes live (services/learn/learnQuestions.js reviewQuestion).
app.get("/api/admin/questions", requireAdmin, (req, res) => {
  const pick = (k, allowed) => (allowed ? (allowed.includes(req.query[k]) ? req.query[k] : null) : (typeof req.query[k] === "string" && req.query[k].trim() ? req.query[k].trim() : null));
  const items = reviewList(db, { role: pick("role"), level: pick("level", QUESTION_LEVELS), type: pick("type", QUESTION_TYPES),
    status: pick("status", QUESTION_STATUSES), flagged: req.query.flagged === "1" });
  const counts = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) n FROM learn_questions GROUP BY status`).all().map(r => [r.status, r.n]));
  const roles = db.prepare(`SELECT DISTINCT role FROM learn_questions WHERE role IS NOT NULL ORDER BY role`).pluck().all();
  res.json({ items, counts, roles, unknownPieces: unknownPieces(db) });
});
// ⭐ D150 T04 · the audit's role card — PUBLIC (the audit needs no sign-in): the board's own numbers, counted and dated,
// pay hidden under 20 postings that state it. services/audit/auditRoleCard.js.
app.get("/api/audit/roles", (req, res) => {
  try { res.json({ roles: auditRoles(db, { field: typeof req.query.field === "string" && req.query.field ? req.query.field : null }) }); }
  catch (e) { res.status(500).json({ error: "audit_roles_failed", message: e.message }); }
});
app.get("/api/audit/role/:slug", (req, res) => {
  try {
    const card = roleCard(db, String(req.params.slug), { level: typeof req.query.level === "string" ? req.query.level : null });
    if (!card) return res.status(404).json({ error: "not_found", message: "We can't audit that role yet." });
    res.json(card);
  } catch (e) { res.status(500).json({ error: "audit_card_failed", message: e.message }); }
});
app.post("/api/admin/questions/:id/review", requireAdmin, (req, res) => {
  try { res.json(reviewLearnQuestion(db, String(req.params.id), { action: req.body?.action, edits: req.body?.edits || null,
    reviewer: req.user?.username || req.admin?.email || null })); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "review_failed", message: e.message }); }
});

// GET /api/draft/today — today's deck (UI step 3b; docs/UI_REDESIGN.md §3.2, services/dailyDraft.js).
//
// Dealt on the first call of the user's LOCAL day from the board's own default order (the same
// boardPageResponse the board route answers with — one ordering), then frozen. Decisions are the
// existing calls, not new ones: Draft = POST /api/apply/runs with surface:"deck" and NO approvalMode
// (the route refuses one from that surface); Pass/Save = PATCH /api/jobs/interact.
const DECK_REDEAL_EVERY_MS = 3 * 60_000;
const _deckRedealAt = new Map();   // "user:profile:date" -> ms of the last re-deal check (A126 (9))
app.get("/api/draft/today", requireAuth, async (req, res) => {
  // ⛔ 44e (testers on iPhone Safari, 11-02): a page built before the fix sent toLocaleDateString("en-CA"), which some
  // browsers write as "11/2/2026"; the 400 here left their deck — and the tour that starts on it — empty. A date this
  // route cannot read now deals the SERVER's day (UTC) instead of refusing: the deal is per day, so at worst a person
  // near midnight sees yesterday's or tomorrow's deal, never nothing.
  const asked = String(req.query.date || "");
  const date = validDraftDate(asked) ? asked : new Date().toISOString().slice(0, 10);
  // A75 — "ATS match" as a sort on the daily draft: the deal is frozen, the READ is reordered by the
  // caller's own stored score (services/dailyDraft.js orderByAts). The score is not sent.
  const order = String(req.query.order || "dealt");
  if (!DECK_ORDERS.includes(order)) {
    return res.status(400).json({ error: "invalid_order", message: `order must be one of: ${DECK_ORDERS.join(", ")}` });
  }
  try {
    // A brand-new account — which is what a first Google sign-in creates — has no profile and no
    // résumé. That is a STATE the deck explains and points past, not an error (§3.6; found 09-30
    // when the owner's Google sign-in created a fresh account and Today showed "could not be dealt.
    // no_active_profile"). Nothing is dealt: a deck without a résumé would 409 on every Draft.
    const noDeal = (reason, profileId = null) =>
      res.json({ date, profileId, size: 0, dealtNow: false, thin: false, reason, cards: [], order });
    const profile = getOrRepairActiveProfile(req.user.id);
    if (!profile) return noDeal("no_profile");
    const hasResume = db.prepare(
      "SELECT content FROM profile_base_resumes WHERE profile_id = ? AND TRIM(content) != ''").get(profile.id);
    if (!hasResume) return noDeal("no_resume", profile.id);
    const resumeText = String(hasResume.content || "");
    // ⛔ A133 (owner 11-06, "the deck shows jobs that has 65 while many new jobs touch 90"): the deal's candidates are the
    // board's top BY ATS (sort=atsScore - the same boardPageResponse, so the role scope, the ineligible-last and ghost-last
    // keys and the user's own filters still hold), NOT the curated order, whose title / role / skills rank keys lead the
    // fit. services/dailyDraft.js then ranks that pool by shared/dealRanking.js (ATS + best bets + role similarity,
    // earlier days' undecided cards rotated down).
    const fetchBoardPage = async (cursor) => {
      const { status, body } = await boardPageResponse({ ...req, query: { pageSize: "50", sort: "atsScore", ...(cursor ? { cursor } : {}) } });
      return { ok: status === 200 && body?.success !== false, jobs: body?.jobs || [], nextCursor: body?.nextCursor || null, error: body?.error };
    };
    const reportStmt = db.prepare(
      "SELECT ats_report FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?");
    const reportFor = (jobId) => {
      try { return JSON.parse(reportStmt.get(req.user.id, profile.id, jobId)?.ats_report || "null"); }
      catch { return null; }
    };
    const scoreStmt = db.prepare(
      "SELECT ats_score FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?");
    const scoreFor = (jobId) => scoreStmt.get(req.user.id, profile.id, jobId)?.ats_score ?? null;
    // ⭐ D152 (3): every card's best-bets reading (bestBetOf over its signals) — the one ranking the "best" order reads and
    // the reason line the card says. The eligibility inputs, level, aim and warm paths are read once for the deal.
    const tryOr = (fn, dflt) => { try { return fn(); } catch { return dflt; } };
    const betInputs = { inputs: tryOr(() => userEligibilityInputs(db, req.user.id), { defaults: {}, degrees: [] }),
                        userLevel: tryOr(() => userLevelFor(db, req.user.id), null),
                        aim: tryOr(() => aimRoleFor(db, req.user.id), null), warm: tryOr(() => warmCounts(db, req.user.id), new Map()) };
    const betFor = (job) => bestBetOf(bestBetSignalsFor(db, { userId: req.user.id, profileId: profile.id, job: { id: job.id }, ...betInputs }));
    // ⛔ D151 · the cards' company velocity read in the read-worker pool before betFor runs (off the event loop).
    const warmBets = (jobs) => warmVelocity(db, jobs.map(j => j?.company), { read: readPool });
    // ⭐ D152 (3): picks per day — the person's own count (Customise → Daily Deck, migration 220), 10 when never chosen.
    // It sizes the NEXT deal; a deal already frozen today is read as it was dealt.
    const size = deckSizeOf(db, req.user.id);
    // ⛔ A126 (9): today's undecided cards are re-dealt when the board now holds a better match — OFF the request path.
    // This request answers with the deal as it stands (refresh: false — no board read, as fast as before); after it is
    // sent, at most every DECK_REDEAL_EVERY_MS per (user, profile, day), the re-deal runs in the background and, only
    // if it changed the deal, tells the person's open tabs `deck_reshuffled` — the deck then fetches the new deal and
    // plays the deal animation when it has it. (Measured: the check inside this request read the board and the
    // client's 8 s deck timeout cut it off on a slow server.)
    const redealKey = `${req.user.id}:${profile.id}:${date}`;
    const redealDue = Date.now() - (_deckRedealAt.get(redealKey) || 0) >= DECK_REDEAL_EVERY_MS;
    if (redealDue) {
      _deckRedealAt.set(redealKey, Date.now());
      const redealUser = req.user.id;
      res.on("finish", () => {
        todaysDeck(db, { userId: redealUser, profileId: profile.id, date, fetchBoardPage, reportFor, order, scoreFor, size, betFor, warmBets, resumeText, refresh: true })
          .then(d => { if (d?.reshuffled) emitToUser(redealUser, { type: "deck_reshuffled", date, profileId: profile.id }); })
          .catch(e => console.warn("[deck] re-deal:", e.message));
      });
    }
    const deck = await todaysDeck(db, { userId: req.user.id, profileId: profile.id, date, fetchBoardPage, reportFor, order, scoreFor, size, betFor, warmBets, resumeText, refresh: false });
    // 43y (the owner's trial walk, 11-01: "no jobs or picks" on a new account): an empty deal for a profile whose
    // scores have not landed yet is not "empty" — it is SCORING. The pass is (re)asked for, the client says so and asks
    // again; the deal is not frozen (an empty one never is), so the next request deals from the first scores.
    if (!deck.size) {
      const scoredSoFar = db.prepare("SELECT COUNT(*) FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ?").pluck().get(req.user.id, profile.id);
      if (scoredSoFar < 30) { scheduleBoardFit(req.user.id, "deck", profile); return res.json({ ...deck, reason: "scoring" }); }
    }
    // ⭐ 11-01 (the owner's tour bug report): "the trial cards show the number, not only Strong match". A75 kept the score
    // off the client; a TRIAL account's cards carried their stored score. ⭐ A117 (owner 11-03, "number for everyone"):
    // EVERY account's card carries its own stored score now — D145's card shows it at the top right. The frozen snapshot
    // still holds no number (G5, services/dailyDraft.js); the score is the caller's own, read here at serve time.
    deck.cards = deck.cards.map(c => ({ ...c, score: scoreFor(c.job.id) }));
    res.json(deck);
  } catch (e) {
    console.error("[GET /api/draft/today]", e.message);
    res.status(500).json({ error: "The deck could not be dealt. Try again." });
  }
});

// GET /api/company-logo/:key — A77. A company's stored logo, first-party (services/jobs/companyLogoStore.js).
// Public: a logo is a fact about an employer, and the landing feed shows them too. Raster only (the
// store refuses SVG); nosniff + a deny-all CSP so the bytes can only ever be an image.
app.get("/api/company-logo/:key", (req, res) => {
  const logo = storedLogo(db, req.params.key);
  if (!logo) return res.status(404).json({ error: "no_logo" });
  res.set({ "Content-Type": logo.mime, "Cache-Control": "public, max-age=604800",
            "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" });
  res.send(logo.bytes);
});

// GET /api/jobs/generic -- public cached feed (no auth, no personalization)
app.get("/api/jobs/generic", async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const ps     = Math.min(20, parseInt(req.query.pageSize, 10) || 12);
    const offset = (page - 1) * ps;

    const rows = db.prepare(`
      SELECT job_id, title, company, location, work_type, url, source, source_label,
             bucket_role, bucket_seniority, bucket_domain, posted_at, scraped_at,
             salary_min, salary_max, salary_currency, compensation,
             company_icon_url, via
      FROM scraped_jobs
      WHERE direct_apply = 1 AND is_active = 1
      ORDER BY scraped_at DESC
      LIMIT ? OFFSET ?
    `).all(ps, offset);

    const total = db.prepare("SELECT COUNT(*) as n FROM scraped_jobs WHERE direct_apply = 1 AND is_active = 1").get()?.n || 0;
    const filteredRows = rows.filter(r => isResumeRelevant(r.title));

    res.json({ success: true, jobs: filteredRows.map(mapJobRow), total, page, pageSize: ps });
  } catch (err) {
    console.error('[GET /api/jobs/generic]', err.message);
    res.status(500).json({ success: false, error: 'Failed to load jobs.', jobs: [] });
  }
});

// -- POST /api/jobs/search -- live search (auth required) ----------------------
app.post("/api/jobs/search", requireAuth, async (req, res) => {
  try {
    const {
      query = '', location = '', experience, domain,
      contractType, remote, page = 1, pageSize = 20,
    } = req.body || {};

    if (!query.trim() && !location.trim()) {
      return res.status(400).json({ success: false, error: 'Enter a job title or location to search.', jobs: [] });
    }

    // Load ATS company lists for direct-ATS plugins. Passed as ONE list, not pre-split per
    // provider: searchJobs groups it by ats_type through the same helper cacheJobs uses, so
    // every registered ATS source is polled. Splitting it here into three named parameters is
    // what capped live search at greenhouse/lever/ashby while four other plugins sat wired but
    // permanently empty-handed.
    const _atsCompanies = db.prepare("SELECT * FROM company_ats_list WHERE active = 1").all();

    // `domain` and `experience` arrive as the UI's ENUM values (bucket_domain /
    // experience_level), and this endpoint folds them into a free-text aggregator query rather
    // than filtering on them — so they have to be humanised first. Without this, the search bar's
    // AI / ML option contributes the literal token `ai_ml`, which matches nothing any job board
    // has ever written. Underscores become spaces and nothing else; every other value in both
    // vocabularies is already an ordinary word.
    const asKeywords = (v) => String(v || '').replace(/_/g, ' ').trim();

    const result = await searchJobs({
      query: [query.trim(), asKeywords(domain), asKeywords(experience)].filter(Boolean).join(' '),
      location, contractType, remote, page, pageSize,
      sort: 'dateDesc',
      _atsCompanies,
    });

    // Attach user interaction state for returned jobs
    const interactionMap = {};
    if (result.jobs.length) {
      const placeholders = result.jobs.map(() => '?').join(',');
      const jobIds = result.jobs.map(j => j.id);
      const rows = db.prepare(
        `SELECT job_id, starred, disliked FROM user_jobs WHERE user_id=? AND job_id IN (${placeholders})`
      ).all(req.user.id, ...jobIds);
      rows.forEach(r => { interactionMap[r.job_id] = r; });
    }

    const jobs = result.jobs.map(j => mapJobRow({
      ...j,
      starred:  !!(interactionMap[j.id]?.starred),
      disliked: !!(interactionMap[j.id]?.disliked),
    }));

    res.json({ ...result, jobs, success: true });

    // Non-blocking write-back of live search results to scraped_jobs
    if (result.jobs.length > 0) {
      setImmediate(() => {
        try {
          const insert = db.prepare(`
            INSERT OR IGNORE INTO scraped_jobs
              (job_id, _hash, title, company, location, url, source, source_label,
               via, bucket_role, bucket_seniority, bucket_domain,
               company_icon_url, direct_apply, posted_at, scraped_at,
               fingerprint, sources_seen, req_uid, automation_tier,
               description, salary_min, salary_max, salary_currency,
               salary_min_usd, salary_max_usd, salary_period)
            VALUES
              (@job_id, @_hash, @title, @company, @location, @url, @source, @source_label,
               @via, @bucket_role, @bucket_seniority, @bucket_domain,
               @company_icon_url, @direct_apply, @posted_at, strftime('%s','now'),
               @fingerprint, @sources_seen, @req_uid, @automation_tier,
               @description, @salary_min, @salary_max, @salary_currency,
               @salary_min_usd, @salary_max_usd, @salary_period)
          `);
          const insertMany = db.transaction((jobs) => {
            for (const j of jobs) {
              const id = j.id || j.url || '';
              if (!id) continue;
              // Queue 37 — a live search result outside the US is shown (the user searched for it)
              // but never written back to the shared board.
              if (!usEligibility({ location: j.location, description: j.description }).admit) continue;

              // Cross-source dedup: collapse into an existing higher-(or-equal-)priority
              // canonical row (e.g. this same role's direct-ATS listing) if one exists.
              const dedup = reconcileFingerprint(db, {
                id, url: j.url || '', title: j.title || '', company: j.company || '',
                location: j.location || '', source: j.source || 'serpapi',
                description:      j.description || null,
                company_icon_url: j.companyIconUrl || j.company_icon_url || j.thumbnail || null,
                workplace_type:   j.workplaceType || j.workplace_type || null,
                posted_at:        j.postedAt || j.posted_at || null,
                // A49 fix 3 — the pay goes into the deduper too, so a fold DONATES it to the
                // canonical row (unionMergeFields fills blanks only) instead of dropping it.
                salary_min:       j.salary_min      ?? null,
                salary_max:       j.salary_max      ?? null,
                salary_currency:  j.salary_currency ?? null,
                salary_min_usd:   j.salary_min_usd  ?? null,
                salary_max_usd:   j.salary_max_usd  ?? null,
                salary_period:    j.salary_period   ?? null,
              });
              if (dedup.action === 'fold') continue; // no separate row for this duplicate
              const canonical = dedup.job;

              insert.run({
                job_id:           id,
                _hash:            id,
                title:            j.title        || '',
                company:          j.company       || '',
                location:         j.location      || '',
                url:              j.url           || '',
                source:           j.source        || 'serpapi',
                source_label:     j.sourceLabel || j.source_label || '',
                via:              j.via           || null,
                bucket_role:      j.bucketRole  || j.bucket_role  || 'other',
                bucket_seniority: j.bucketSeniority || j.bucket_seniority || null,
                bucket_domain:    j.bucketDomain || j.bucket_domain || null,
                company_icon_url: canonical.company_icon_url || null,
                direct_apply:     (j.directApply ?? j.direct_apply) ? 1 : 0,
                posted_at:        canonical.posted_at || null,
                fingerprint:      dedup.fingerprint,
                sources_seen:     dedup.sourcesSeen,
                req_uid:          dedup.reqUid,
                // This insert writes no apply_url column at all, so `url` IS the apply
                // destination — the same value mapJobRow will hand the client as applyUrl.
                automation_tier:  deriveAutomationTier(j.source || 'serpapi', j.url || ''),
                // A49 fix 3 — this INSERT carried no description and no pay at all, so a live
                // result that WON (outranked an aggregator row) lost what that row donated, and a
                // new row was born empty. canonical.* is the result already union-merged.
                description:      canonical.description     || null,
                salary_min:       canonical.salary_min      ?? null,
                salary_max:       canonical.salary_max      ?? null,
                salary_currency:  canonical.salary_currency ?? null,
                salary_min_usd:   canonical.salary_min_usd  ?? null,
                salary_max_usd:   canonical.salary_max_usd  ?? null,
                salary_period:    canonical.salary_period   ?? null,
              });
            }
            atlasPostingsChanged(db);   // ⭐ D118 P1: the Atlas counts move in this transaction
          });
          const relevantJobs = result.jobs.filter(j => isResumeRelevant(j.title));
          insertMany(relevantJobs);
          console.log(`[Search] Persisted ${relevantJobs.length} live results (skipped ${result.jobs.length - relevantJobs.length} irrelevant)`);
        } catch(e) {
          console.warn('[Search] Write-back non-fatal:', e.message);
        }
      });
    }
  } catch (err) {
    console.error('[POST /api/jobs/search]', err.message);
    res.status(500).json({ success: false, error: 'Search failed.', jobs: [] });
  }
});

// -- PATCH /api/profile/skills -- toggle confirmed/target skill -----------------
app.patch("/api/profile/skills", requireAuth, (req, res) => {
  const { skill, action } = req.body || {};
  if (!skill || !action) return res.status(400).json({ error: 'skill and action required' });

  const validActions = ['add_confirmed', 'add_target', 'remove'];
  if (!validActions.includes(action)) return res.status(400).json({ error: 'invalid action' });

  try {
    const row = db.prepare("SELECT confirmed_skills, target_skills FROM user_profile WHERE user_id=?").get(req.user.id);
    const confirmed = JSON.parse(row?.confirmed_skills || '[]');
    const target    = JSON.parse(row?.target_skills    || '[]');
    const key       = skill.toLowerCase();

    const remove = arr => arr.filter(s => s.toLowerCase() !== key);

    let newConfirmed = remove(confirmed);
    let newTarget    = remove(target);

    if (action === 'add_confirmed') newConfirmed = [...newConfirmed, key];
    if (action === 'add_target')    newTarget    = [...newTarget,    key];

    db.prepare(
      "UPDATE user_profile SET confirmed_skills=?, target_skills=?, updated_at=unixepoch() WHERE user_id=?"
    ).run(JSON.stringify(newConfirmed), JSON.stringify(newTarget), req.user.id);

    res.json({ success: true, confirmed_skills: newConfirmed, target_skills: newTarget });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/interact -- unified star/dislike/status persist for board jobs
/**
 * Star or dislike a job from a card that has no parent handler.
 *
 * THIS ENDPOINT HAS NEVER ONCE SUCCEEDED. It was added in a55151d selecting a `status` column that
 * user_jobs has never had, in any migration, so every call threw SqliteError("no such column:
 * status") and returned 500. JobCard's caller wraps it in `catch (e) { console.warn(...) }`, so the
 * failure was invisible: the star filled in optimistically and reverted on the next load.
 *
 * It is reachable. JobsPanel passes onStar so the board uses its own handler, but BOTH JobCard call
 * sites in DatabasePanel pass only onDislike — so starring on the Database panel, and unstarring a
 * job in Saved Jobs, fell through to here and did nothing.
 *
 * WHAT `status` WAS FOR: nothing. It was read into `newStatus`, which was never referenced again
 * and was never written to any column. The request body's `status`, `title`, `company` and `source`
 * were all accepted and silently discarded in the same way. Dead input is removed rather than
 * wired up, because there is no column for it and inventing one to justify a parameter nobody
 * sends would be the wrong direction.
 *
 * THE JOB IS RESOLVED, NEVER INVENTED. The old insert used the URL as the job_id, and every other
 * writer of this table uses a real job_id — so simply deleting the `status` reference would have
 * traded a loud crash for a silent one: a second, URL-keyed row for the same job, which no board
 * query joins to and no user could ever see. A URL is accepted (the card has one to hand) but it is
 * resolved against scraped_jobs; a job we do not know is a 404, not a phantom row.
 */
app.patch("/api/jobs/interact", requireAuth, (req, res) => {
  const { jobId, url, starred, disliked } = req.body || {};
  if (!jobId && !url) return res.status(400).json({ error: "jobId or url required" });
  if (starred == null && disliked == null) {
    return res.status(400).json({ error: "nothing to change: send starred or disliked" });
  }
  try {
    // jobId first — the caller usually has it, and it needs no lookup. A URL is matched against
    // both columns because scraped_jobs stores the posting URL and the apply URL separately and a
    // card carries whichever it has.
    const resolved = jobId
      ? db.prepare("SELECT job_id FROM scraped_jobs WHERE job_id=?").get(String(jobId))
      : db.prepare("SELECT job_id FROM scraped_jobs WHERE url=? OR apply_url=? LIMIT 1").get(url, url);
    if (!resolved?.job_id) return res.status(404).json({ error: "Job not found" });
    const resolvedJobId = resolved.job_id;

    const existing = db.prepare(
      "SELECT starred, disliked FROM user_jobs WHERE user_id=? AND job_id=?"
    ).get(req.user.id, resolvedJobId);

    const newStarred  = starred  != null ? (starred  ? 1 : 0) : (existing?.starred  ?? 0);
    const newDisliked = disliked != null ? (disliked ? 1 : 0) : (existing?.disliked ?? 0);

    // The SAME resolution the sibling endpoints use (/api/jobs/:id/starred and /disliked), rather
    // than a looser "whatever profile is active" lookup of its own. The board filters on
    // domain_profile_id, so a row written under a different one is a star the user cannot see.
    const profileId = resolveUserJobDomainProfileId(req.user.id, resolvedJobId);

    db.prepare(`
      INSERT INTO user_jobs (user_id, job_id, domain_profile_id, starred, disliked, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id, job_id) DO UPDATE SET
        starred    = excluded.starred,
        disliked   = excluded.disliked,
        updated_at = unixepoch()
    `).run(req.user.id, resolvedJobId, profileId, newStarred, newDisliked);

    // Same as the siblings: other tabs showing this job update instead of going stale. AH2 made
    // several tabs on one session an ordinary thing to do, which makes this worth more than it was.
    emitToUser(req.user.id, { type: "job_flag", jobId: resolvedJobId, starred: !!newStarred });

    res.json({ success: true, jobId: resolvedJobId, starred: !!newStarred, disliked: !!newDisliked });
  } catch (err) {
    console.error(`[jobs/interact] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/poll -- returns new jobs since <since> ms timestamp + scraping status
// Used by frontend to stream live results during an active background scrape.
// LIVE POLLING: polls every 4s during active scrape (POLL_INTERVAL_MS on client).
// Stops when scraping:false returned. Stale entries cleaned up every poll (>10 min).
app.get("/api/jobs/poll", requireAuth, (req, res) => {
  const since  = parseInt(req.query.since) || 0;
  const qRaw   = (req.query.query || "").trim().toLowerCase();
  if (!qRaw) return res.status(400).json({ error:"query required" });

  const sinceSeconds = Math.max(0, Math.floor((since - 1000) / 1000));
  const userId = req.user.id;
  const activeProfile = getOrRepairActiveProfile(userId);
  if (!activeProfile) {
    console.warn(`[jobs] poll for "${qRaw}" has no active profile for user ${userId}`);
    return res.json({
      jobs: [],
      scraping: false,
      total: 0,
      needsProfileSetup: true,
      reason: "no_active_profile",
    });
  }
  if (!userHasBaseResume(userId)) {
    return res.json({
      jobs: [],
      scraping: false,
      total: 0,
      needsBaseResume: true,
      reason: "no_base_resume",
    });
  }
  const roleKey = roleKeyForProfile(activeProfile);
  const pollProfileTitleFilter = profileTitleSql("sj.title", activeProfile);
  const pollSignals = loadSimpleApplyProfile(db, { userId, profileId: activeProfile.id });
  const pollMaxYoe = pollSignals?.yearsExperience != null ? pollSignals.yearsExperience + 2 : null;
  // F2 (10-03): no crawl runs per request any more (scrapeJobs went in 2e4ada0), so nothing wrote the
  // scrape state this route used to read — `scraping` was always false and the client's loop stops
  // after one read of new rows. The state, its eviction and its key are gone; the answer says so.

  const rows = db.prepare(`
    SELECT sj.*, uj.visited, uj.applied, uj.starred, uj.disliked
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ?
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
    WHERE sj.is_active = 1
      AND LOWER(sj.search_query) = ?
      AND ${pollProfileTitleFilter.sql}
      AND (? IS NULL OR sj.min_years_exp IS NULL OR sj.min_years_exp <= ?)
      AND sj.scraped_at >= ?
      AND (uj.disliked  IS NULL OR uj.disliked  = 0)
      AND (uj.applied   IS NULL OR uj.applied   = 0)
    -- Same ordering as the board (see /api/jobs' RECENCY): a crawl writes its batch within a second
    -- or two, so scraped_at alone leaves these 50 slots to whichever employer was inserted first —
    -- and it ranks by when we last TOUCHED a row rather than when we first saw it, which buries
    -- anything that did not arrive in the newest crawl batch. The WHERE clause above still gates on
    -- scraped_at, which is correct there: "changed since you last polled" is genuinely a
    -- last-touched question. Only the ORDER BY changes.
    ORDER BY COALESCE(sj.discovered_at, sj.scraped_at) DESC, (sj.posted_at IS NULL) ASC, sj.posted_at DESC, sj.job_id
    LIMIT 50
  `).all(roleKey, userId, activeProfile.id, qRaw, ...pollProfileTitleFilter.params, pollMaxYoe, pollMaxYoe, sinceSeconds);

  const profileSafeRows = rows.filter(j => evaluateProfileFactEligibility({
    title: j.title,
    location: j.location,
    description: j.description,
    descriptionHtml: j.description_html,
  }, pollSignals).ok);

  const jobs = profileSafeRows.map(j => ({
    jobId:           j.job_id,
    company:         j.company,
    title:           j.title,
    category:        j.category,
    location:        j.location,
    workType:        j.work_type,
    source:          j.source,
    sourcePlatform:  j.source || j.source_label || 'direct',
    url:             j.url,
    applyUrl:        j.apply_url,
    postedAt:        j.posted_at,
    description:     j.description,
    descriptionHtml: j.description_html,
    ghostScore:      j.ghost_score,
    minYearsExp:     j.min_years_exp,
    maxYearsExp:     j.max_years_exp,
    expRaw:          j.exp_raw,
    // ⛔ CC5 · THE SECOND SURFACE OF THE SAME LEAK. These read scraped_jobs.ats_score/ats_report —
    // ONE CELL PER JOB, written at ingest from whichever user's résumé basis triggered the crawl —
    // and served them to whoever polled. An ATS report is a statement about a particular résumé
    // against a particular posting, so a per-job cell cannot hold one for anybody.
    //
    // Now always null, which is what they ALREADY were on 100% of rows (0 of 2,460 carry either
    // value), so no client loses anything it was actually receiving. The field names stay so the
    // response shape is unchanged for the desktop and mobile clients that read them; what changes
    // is that they can no longer carry another candidate's answer.
    //
    // A real per-(user, profile) score reaches the client through the ATS panel, which scores
    // against the CALLER's basis on demand (6.67ms mean for one posting, measured over 300 real
    // rows). See docs/CC5_PER_PROFILE_SCORES.md for why the board cannot do that for 50 at once.
    baseAtsScore:    null,
    baseAtsReport:   null,
    salaryMin:       j.salary_min,
    salaryMax:       j.salary_max,
    salaryCurrency:  j.salary_currency,
    applicantCount:  j.applicant_count,
    compensation:    j.compensation,
    companyIconUrl:  j.company_icon_url,
    via:             j.via || null,
    isFrequentRepost: !!j.is_frequent_repost,
    visited:         !!j.visited,
    alreadyApplied:  !!j.applied,
    starred:         !!j.starred,
    disliked:        !!j.disliked,
  }));

  // Which profile facts shaped this read — the line that used to sit behind a scrape that never ran.
  const pollFacts = getProfileSearchFacts(pollSignals);
  console.log(JSON.stringify({ msg: "[poll]", profile: activeProfile.profile_name, query: qRaw, returned: jobs.length,
    profileFactsUsed: {
      citizenship: !!pollFacts.citizenshipStatus, workAuthorization: !!pollFacts.workAuthorization,
      requiresSponsorship: !!pollFacts.requiresSponsorship, hasClearance: !!pollFacts.hasClearance,
      clearanceLevel: !!pollFacts.clearanceLevel, yearsExperience: pollSignals?.yearsExperience != null,
    } }));
  res.json({
    jobs,
    scraping: false,
    total: jobs.length,
    scrapeUnavailable: false,
    scrapeError: null,
    message: null,
  });
});

// VALID_EMP_TYPES / VALID_WORKPLACE_TYPES / VALID_POSTED_LIMITS were removed here.
//
// All three were DECLARED AND NEVER READ — grep-proven, zero references in this file or any other.
// Apify left them behind. They mattered because they looked exactly like the validation this
// endpoint was missing while being a decoy: VALID_WORKPLACE_TYPES said "office" where every live
// definition of that dimension says "onsite", and VALID_EMP_TYPES listed "temporary", which
// schema.js's synonym table folds into "contract" and the column therefore can never hold. A
// validation set nothing reads does not stay correct; it just stays convincing.
//
// The real validation is rejectInvalidFilterValues() on GET /api/jobs, which reads
// shared/jobFilterOptions.js — the same definition the controls render from.

function isAnthropicCreditError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("credit balance is too low")
      || msg.includes("insufficient credit")
      || msg.includes("billing")
      || msg.includes("payment required")
      || msg.includes("quota exceeded");
}

app.post("/api/scrape", requireAuth, (_req, res) => {
  res.status(410).json({ error: "External scraping has been removed. Job search now uses /api/jobs." });
});

// Visited / Starred flags
app.patch("/api/jobs/:id/visited", requireAuth, (req, res) => {
  const jobId = req.params.id;
  const profileId = resolveUserJobDomainProfileId(req.user.id, jobId);
  if (!profileId) return res.status(404).json({ error:"Job not available for active profile" });
  db.prepare(`
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id, visited, updated_at)
    VALUES (?, ?, ?, 1, unixepoch())
    ON CONFLICT(user_id, job_id) DO UPDATE SET visited = 1, updated_at = unixepoch()
  `).run(req.user.id, jobId, profileId);
  res.json({ ok:true });
});

app.patch("/api/jobs/:id/starred", requireAuth, (req, res) => {
  const jobId = req.params.id;
  const profileId = resolveUserJobDomainProfileId(req.user.id, jobId);
  if (!profileId) return res.status(404).json({ error:"Job not available for active profile" });
  const current = db.prepare(
    "SELECT starred FROM user_jobs WHERE user_id = ? AND job_id = ?"
  ).get(req.user.id, jobId);
  const newStarred = current ? (current.starred ? 0 : 1) : 1;
  db.prepare(`
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id, starred, disliked, updated_at)
    VALUES (?, ?, ?, ?, 0, unixepoch())
    ON CONFLICT(user_id, job_id) DO UPDATE SET starred = ?, disliked = 0, updated_at = unixepoch()
  `).run(req.user.id, jobId, profileId, newStarred, newStarred);
  emitToUser(req.user.id, { type: "job_flag", jobId, starred: !!newStarred });
  res.json({ ok:true, starred: !!newStarred });
});

app.patch("/api/jobs/:id/disliked", requireAuth, (req, res) => {
  const jobId = req.params.id;
  const profileId = resolveUserJobDomainProfileId(req.user.id, jobId);
  if (!profileId) return res.status(404).json({ error:"Job not available for active profile" });
  const current = db.prepare(
    "SELECT disliked FROM user_jobs WHERE user_id = ? AND job_id = ?"
  ).get(req.user.id, jobId);
  const newDisliked = current ? (current.disliked ? 0 : 1) : 1;
  db.prepare(`
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id, disliked, starred, updated_at)
    VALUES (?, ?, ?, ?, 0, unixepoch())
    ON CONFLICT(user_id, job_id) DO UPDATE SET disliked = ?, starred = 0, updated_at = unixepoch()
  `).run(req.user.id, jobId, profileId, newDisliked, newDisliked);
  emitToUser(req.user.id, { type: "job_flag", jobId, disliked: !!newDisliked });
  res.json({ ok:true, disliked: !!newDisliked });
});

app.get("/api/jobs/:id/recruiter", requireAuth, (_req, res) => {
  res.json({ comingSoon: true, available: false });
});

// ── Keyword analysis for a job (no generated resume needed) ──────
app.post("/api/jobs/:id/keywords", requireAuth, async (req, res) => {
  if (!requirePlan(req, res, "PLUS")) return;
  const userId = req.user.id;
  const jobId  = req.params.id;
  const { resumeText } = req.body;
  if (!resumeText) return res.status(400).json({ error: "resumeText required" });

  const keywordsProfile = getOrRepairActiveProfile(userId);
  const keywordsProfileId = keywordsProfile?.id ?? null;

  // Priority 1: return ats_report from an existing generated resume (most accurate).
  //
  // ⛔ CC5 · NOW SCOPED TO THE PROFILE. `resumes` has carried `domain_profile_id` since it was
  // added and this read ignored it, so a user with an engineering profile and a data profile was
  // served whichever résumé they generated FIRST for that posting — a report computed against a
  // different résumé of their own. Less serious than the cross-USER leak below, and the same
  // mistake one level in.
  //
  // Rows predating the column carry NULL, so they are accepted as a fallback rather than discarded:
  // an old report of your own is worth more than none, and `ORDER BY domain_profile_id IS NULL`
  // puts the profile-matched one first when both exist.
  const existingResume = db.prepare(`
    SELECT ats_report FROM resumes
    WHERE user_id = ? AND job_id = ?
      AND (domain_profile_id IS NULL OR domain_profile_id = ?)
    ORDER BY (domain_profile_id IS NULL) ASC
    LIMIT 1
  `).get(userId, jobId, keywordsProfileId);
  if (existingResume?.ats_report) {
    try {
      const parsed = JSON.parse(existingResume.ats_report);
      // A52: says WHICH résumé it is about. This is the GENERATED résumé's report, not the base
      // résumé's — the board must not adopt it as the card's base verdict.
      if (parsed?.source === LOCAL_ATS_SOURCE) return res.json({ ...parsed, report_basis: "generated_resume" });
    } catch {}
  }

  // ── CC5 · PRIORITY 2 IS DELETED, AND IT WAS A CROSS-USER LEAK ────────────────────────────────
  //
  // It read:
  //
  //     const scrapeTimeReport = db.prepare(
  //       "SELECT ats_report FROM scraped_jobs WHERE job_id=?"
  //     ).get(jobId);
  //     if (scrapeTimeReport?.ats_report) { … return res.json(parsed); }
  //
  // ⛔ NO user_id. NO profile. `scraped_jobs.ats_report` is ONE CELL PER JOB, written at ingest
  // from whichever user's résumé basis happened to trigger the crawl, and overwritten wholesale by
  // adopt-enhanced for one profile. So this served ONE CANDIDATE'S ATS REPORT — their matched and
  // missing terms, computed against their résumé — TO ANY OTHER USER who opened the same posting.
  //
  // There is no version of this cache that is correct. An ATS report is a statement about a
  // particular résumé against a particular posting; a per-job cell cannot hold one, so the fix is
  // removal rather than a narrower read. The remaining chain is already per-user
  // (`resumes`, `ats_only_reports`) and priority 4 scores against the caller's own basis.
  //
  // Not currently exploitable, which is luck rather than design: `ats_report` is non-NULL on 0 of
  // 2,460 active rows today, so there was nothing to serve. The ingest writer at the top of this
  // file still populates it, so the next crawl that scores a row would have armed it.

  // Priority 3: return cached ats_only_reports entry (avoids re-running the scorer).
  //
  // CC5 · keyed on the profile too, as of migration 108. Same reasoning as priority 1, and the same
  // NULL fallback for rows cached before profiles were distinguished.
  //
  // ⛔ AND ON THE BASIS, as of migration 110. The board's fit precompute now fills this table for
  // every active posting, so a cached row is no longer "a report this user opened" — it is "a
  // report computed against SOME résumé of theirs". Serving it without checking which would show a
  // report for last week's résumé to a user who has since edited it. The basis is built first (a
  // few ms, no scoring) so the read can ask for THIS basis; a row written before 110 carries NULL
  // and is re-scored rather than served, which costs one local score.
  let panelBasis = null;
  try {
    panelBasis = atsBasisForProfile(userId, keywordsProfile, { resumeText });
  } catch (e) {
    console.error("[keywords] basis", e.message);
    return res.status(500).json({ error: "Keyword analysis failed" });
  }
  //
  // ⛔ A52 · AND ON THE POSTING. A row whose basis matched was served even when the posting had
  // changed under it — enrichment landing skills_json is the common case — so the panel repeated a
  // verdict the scorer would no longer give. The job is read first now (it was read below anyway)
  // and the cache is accepted only when its job_hash matches the posting as it is.
  const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const panelJobHash = atsJobInputHash(job);
  const cached = db.prepare(`
    SELECT ats_report FROM ats_only_reports
    WHERE user_id = ? AND job_id = ?
      AND (domain_profile_id IS NULL OR domain_profile_id = ?)
      AND basis_hash IS ?
      AND job_hash IS ?
    ORDER BY (domain_profile_id IS NULL) ASC
    LIMIT 1
  `).get(userId, jobId, keywordsProfileId, panelBasis?.basisHash ?? null, panelJobHash);
  if (cached?.ats_report) {
    try {
      const parsed = JSON.parse(cached.ats_report);
      if (parsed?.source === LOCAL_ATS_SOURCE) return res.json(parsed);
    } catch {}
  }

  // Priority 4: run the in-house deterministic scorer on the job read above.

  // Resolved once at the top of the route now (keywordsProfile), because the cache reads above
  // need it too and resolving it twice is two chances to disagree about which profile is active.
  // The basis and the scorer call are the SAME two functions the board's fit precompute runs
  // (atsBasisForProfile / scoreJobForBasis), so the report opened here and the score the board
  // sorted this card by are one computation.
  try {
    const runtimeBasis = panelBasis.runtimeBasis;
    const result = scoreJobForBasis(job, runtimeBasis);

    // Save to cache, through the one writer every scoring path in this file shares.
    //
    // ⛔ IT IS NOT AN `ON CONFLICT` UPSERT, and that is not a style choice — a user with no active
    // profile writes `domain_profile_id NULL`, SQLite treats NULLs as distinct in a unique index,
    // and `ON CONFLICT(user_id, domain_profile_id, job_id)` would therefore never fire for them:
    // every open of this panel would append another row forever. See storeAtsReportForProfile.
    //
    // This write is also what makes the board's badge appear: GET /api/jobs reads `matchScore` out
    // of this table for (caller, active profile, job), so opening a report is what scores a row for
    // the user who opened it — per profile, and visible to nobody else.
    storeAtsReportForProfile({
      userId, profileId: keywordsProfileId, jobId, report: result, basisHash: panelBasis.basisHash,
      jobHash: panelJobHash,
    });

    res.json(result);
  } catch (e) {
    console.error("[keywords]", e.message);
    res.status(500).json({ error: "Keyword analysis failed" });
  }
});

// ── Pending jobs (resume generated but not yet applied or disliked) ──
// GET /api/jobs/by-id/:jobId — resolve ONE posting, for a deep link.
//
// AH2 made a job detail addressable (/app/jobs?job=<id>), which needs a way to answer "give me that
// one job" for a tab that was opened straight onto the link. The board's own query cannot do it: it
// is paginated, profile-scoped and filtered, so whether a given posting is in the response depends
// on which page and which filters the tab happens to have restored. A deep link that resolves only
// when the job is coincidentally on the current page is the "wired to a no-op" failure mode, so it
// gets its own read.
//
// DELIBERATELY NOT profile-scoped and NOT is_active-filtered. The caller has named a specific
// posting; refusing it because the active profile classifies it into a different role, or because
// the listing has since closed, would answer a question nobody asked. mapJobRow exposes isActive so
// the panel can label a closed posting as closed. The user's own flags still come from the
// user_jobs row for the ACTIVE profile, which is the same join the board uses.
//
// `by-id` rather than /api/jobs/:id so it cannot be confused with the interaction routes that
// already own that shape (/api/jobs/:id/starred, /:id/visited, /:id/keywords).
// ⭐ D121 P3 · one posting's sponsorship signal — for a surface that lists jobs from many sources (Draft House's branches,
// the application page): the ONE module's answer, with the viewer's own "needed" (their Application defaults) for prominence.
app.get("/api/jobs/:jobId/sponsorship", requireAuth, (req, res) => {
  const row = db.prepare("SELECT job_id, company, title, description, description_full FROM scraped_jobs WHERE job_id = ?").get(String(req.params.jobId));
  if (!row) return res.status(404).json({ error: "not_found" });
  const d = (() => { try { return userEligibilityInputs(db, req.user.id).defaults || {}; } catch { return {}; } })();
  const needed = d.sponsorship_now === "yes" || d.sponsorship_later === "yes";
  let signal = null;
  try { signal = sponsorshipSignal(db, row.company, { title: row.title, posting: row }); } catch { signal = null; }
  res.set("Cache-Control", "private, max-age=300");
  res.json({ sponsorship: signal ? { ...signal, needed } : null });
});
app.get("/api/jobs/by-id/:jobId", requireAuth, (req, res) => {
  const userId  = req.user.id;
  const jobId   = String(req.params.jobId || "");
  if (!jobId) return res.status(400).json({ error: "jobId required" });
  const profile = getOrRepairActiveProfile(userId);
  const row = db.prepare(`
    SELECT ${buildSelectColumns(req.query.include_fields)},
           uj.visited, uj.applied, uj.starred, uj.disliked
    FROM scraped_jobs sj
    LEFT JOIN user_jobs uj
      ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
    WHERE sj.job_id = ?
  `).get(userId, profile?.id ?? null, jobId);
  if (!row) return res.status(404).json({ error: "Job not found" });
  res.json({ success: true, job: { ...mapJobRow(row), scrapedAt: row.scraped_at } });
});

// POST /api/jobs/by-id/:jobId/description — Y2B, FETCH ON OPEN.
//
// SmartRecruiters and Workday postings arrive with no description: their list endpoints carry
// none, and Phase 1 proved no list-level parameter changes that (11 and 19 variants respectively,
// every response byte-identical). The background pass buys descriptions for the rows it is about
// to enrich, bounded by the enrichment day's row budget — which means on any given day most
// description-less rows still have none. This is the other trigger: a user opened this specific
// job, so buy exactly this one.
//
// ⛔ ONE REQUEST FOR A JOB SOMEBODY ACTUALLY CARES ABOUT. That is the whole economic argument of
// this task. A crawl would spend 1,500 requests a day on rows nobody opens; this spends one, on
// demand, and caches it permanently.
//
// ⛔ THE SAME FETCHER AND THE SAME WRITER AS THE PASS, imported rather than reimplemented. Two
// implementations of "get this row's text and store it" is how the pass and the panel would come
// to disagree about what a fetch means — the popup-vs-hotkey split, again, and this codebase's
// bug history is almost entirely two sides that each made sense alone.
//
// POST rather than GET because it SPENDS: it makes an outbound third-party request and writes a
// row. A GET that does both would be cached, prefetched and retried by things that assume GETs
// are free.
//
// ⛔ IT MUST DEGRADE HONESTLY. Every failure path returns `success: false` WITH a reason, never an
// empty description and never a 200 that looks like it worked. The panel renders the reason. A
// route that reported success over a missing description would be this pipeline's own signature
// defect — success-shaped output over an empty result — on the one surface a user sees directly.
app.post("/api/jobs/by-id/:jobId/description", requireAuth, async (req, res) => {
  const jobId = String(req.params.jobId || "");
  if (!jobId) return res.status(400).json({ error: "jobId required" });

  const row = db.prepare(`
    SELECT job_id, source, url, company, title, description, description_text, description_basis, detail_fetch_attempts
    FROM scraped_jobs WHERE job_id = ?
  `).get(jobId);
  if (!row) return res.status(404).json({ error: "Job not found" });

  // CACHED PERMANENTLY. content_hash already exists to notice a posting whose text CHANGED; a
  // description we already hold is never re-bought, so an open on an already-described job costs
  // nothing and the panel's retry is idempotent. ⛔ D59: the normalised text when there is one.
  if (row.description && String(row.description).trim()) {
    return res.json({ success: true, description: postingText(row), cached: true });
  }

  // Not every source needs a second request — greenhouse and the rest carry their text in the
  // list — so "this source has no detail door" is a distinct answer from "the fetch failed", and
  // the panel says different things about them.
  if (!hasDetailFetcher(row.source)) {
    return res.json({
      success: false, reason: "no_fetcher",
      message: `The ${row.source || "source"} feed does not publish a separate description for this posting.`,
    });
  }

  try {
    const outcome = await fetchDescription(row);
    // ⛔ The attempt cap is deliberately NOT consulted here. It bounds the BACKGROUND pass's
    // re-spending on a posting that keeps failing; a person who just opened this job asked for
    // this request, and refusing them to protect a budget measured in single requests against an
    // API that produced zero 429s in 124 requests would be a cost saving of nothing. The attempt
    // is still RECORDED, so the yield metric stays true.
    persistDetailOutcome(db, jobId, outcome);

    if (outcome.ok) {
      // ⛔ D59: read the fresh text through the one normaliser now, rather than at the next pass.
      let text = outcome.text;
      try { const cols = refreshDescriptionText(db, jobId); text = cols?.description_text ?? text; } catch { /* the pass will */ }
      return res.json({ success: true, description: text, cached: false });
    }
    return res.json({
      success: false, reason: outcome.reason,
      message: outcome.reason === "http_404"
        ? "This posting is no longer available at the source."
        : outcome.reason === "no_text"
          ? "The source returned this posting without any description text."
          : "Could not load the description from the source just now.",
    });
  } catch (err) {
    // fetchDescription is documented never to throw; this is the belt for the braces, and it must
    // still not report success.
    console.error(`[POST /api/jobs/by-id/${jobId}/description]`, err.message);
    return res.status(502).json({ success: false, reason: "fetch_error", message: "Could not load the description from the source just now." });
  }
});

// ⛔ A91 (10-06 (33)) · /d's MEMBERSHIP, ONE COPY — the board's `?pending=1` view and this legacy route
// both read it, so /d is ALL restricted by this predicate (D41(a)). A63: Pending is a generated résumé
// OR an application record still pending / not verified (the posting was opened from the board, or a
// résumé exported); "I did not apply" and a verified submission both leave it. Written over the board's
// own aliases (sj, uj), and needs no join of its own.
// ⛔ D51: the record half keys on the USER, never on uj — the board LEFT JOINs user_jobs per profile, so a
// job drafted with no user_jobs row for the active profile had uj.user_id NULL and matched no record: a
// Draft could never reach /d. `uid` is inlined as an integer (never text), like ownRowsSql's ownUid.
const pendingMembershipSql = (uid) => `((uj.resume_generated = 1
           AND EXISTS (SELECT 1 FROM resumes pr WHERE pr.user_id = uj.user_id AND pr.job_id = sj.job_id AND pr.html IS NOT NULL))
         OR EXISTS (SELECT 1 FROM application_records ar WHERE ar.user_id = ${uid} AND ar.job_id = sj.job_id
                      AND ar.state IN ('pending', 'recorded')))
      AND NOT EXISTS (SELECT 1 FROM application_records ar WHERE ar.user_id = ${uid} AND ar.job_id = sj.job_id
                        AND ar.state IN ('withdrawn', 'not_applied', 'verified'))
      AND (uj.applied IS NULL OR uj.applied = 0)`;

app.get("/api/jobs/pending", requireAuth, (req, res) => {
  res.json(pendingJobsQuery(req.user.id));
});

// D35 · the Pending view's rows, and their COUNT for the board's view segment (GET /api/jobs/facets'
// `views.pending`). One query for both, so the /d count and the /d list cannot disagree.
function pendingJobsQuery(userId, { count = false } = {}) {
  try { movePendingExpired(db, { userId }); } catch { /* D112 c2: a row past 14 days leaves /d on read; the sweep catches up */ }
  const activeProfile = getOrRepairActiveProfile(userId);
  if (!activeProfile) return count ? 0 : [];
  // ⛔ D41(a): /d is the jobs the user DRAFTED — their own act, like ★. It used to INNER JOIN the role
  // map on the profile's bucket and apply the profile's title filter, so a drafted job the classifier
  // bucketed elsewhere (or whose title missed a target word) was in no list at all. Both are gone;
  // ALL admits the same rows (server.js ownRowsSql), so every /d job is also in ALL.
  const stmt = db.prepare(`
    SELECT ${count ? "COUNT(*) AS n" : `sj.*, uj.starred, uj.applied, uj.disliked, uj.visited, uj.resume_generated,
           r.ats_score, r.ats_report, r.html as resume_html, r.apply_mode`}
    FROM scraped_jobs sj
    JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
    LEFT JOIN resumes r ON r.user_id = ? AND r.job_id = sj.job_id
    WHERE sj.is_active = 1
      AND ${pendingMembershipSql(Number.isSafeInteger(Number(userId)) ? Number(userId) : -1)}
      AND (uj.disliked IS NULL OR uj.disliked = 0)
    ${count ? "" : "ORDER BY uj.updated_at DESC"}
  `);
  const args = [userId, activeProfile.id, userId];
  return count ? stmt.get(...args).n : stmt.all(...args);
}

app.get("/api/categories", requireAuth, (_req,res) => res.json(INDUSTRY_CATEGORIES));

// ═══════════════════════════════════════════════════════════════
// BASE RESUME
// ═══════════════════════════════════════════════════════════════
app.get("/api/base-resume", requireAuth, (req, res) => {
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) return res.json({ content: null, profileId: null });
  const row = getBaseResumeRecord(db, { userId: req.user.id, profileId: activeProfile.id });
  res.json(row ? {
    content: row.content,
    name: row.name,
    updatedAt: row.updated_at,
    profileId: activeProfile.id,
  } : {
    content: null,
    profileId: activeProfile.id,
  });
});
app.post("/api/base-resume", requireAuth, (req, res) => {
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) return res.status(400).json({ error: "No active profile" });
  const { content, name } = req.body;
  if (content===undefined) return res.status(400).json({ error:"content required" });
  saveBaseResumeRecord(db, { userId: req.user.id, profileId: activeProfile.id }, content, name || "resume.txt");
  const roleTitles = (() => {
    try { return JSON.parse(activeProfile.target_titles || "[]"); } catch { return []; }
  })();
  upsertSimpleApplyProfile(db, { userId: req.user.id, profileId: activeProfile.id }, content, roleTitles);
  // A new résumé is a new scoring basis: every precomputed board score for this profile is stale.
  scheduleBoardFit(req.user.id, "base-resume", activeProfile);
  res.json({ ok:true, profileId: activeProfile.id });
});
app.get("/api/simple-apply/profile", requireAuth, (req, res) => {
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) {
    return res.json({ titles: [], keywords: [], skills: [], searchTerms: [], profileId: null });
  }
  const profile = loadOrCreateSimpleApplyProfile(db, { userId: req.user.id, profileId: activeProfile.id });
  res.json(profile || { titles: [], keywords: [], skills: [], searchTerms: [] });
});
app.post("/api/simple-apply/profile/refresh", requireAuth, (req, res) => {
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) return res.status(400).json({ error: "No active profile" });
  const base = getBaseResumeRecord(db, { userId: req.user.id, profileId: activeProfile.id });
  if (!base?.content) return res.status(400).json({ error:"No base resume uploaded for the active profile" });
  const roleTitles = (() => {
    try { return JSON.parse(activeProfile.target_titles || "[]"); } catch { return []; }
  })();
res.json(upsertSimpleApplyProfile(db, {
    userId: req.user.id,
    profileId: activeProfile.id,
  }, base.content, roleTitles));
});

function getResumeRouteProfile(req, res) {
  const rawProfileId = req.params.id;
  if (rawProfileId != null) {
    const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=? AND user_id=?")
      .get(rawProfileId, req.user.id);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return null;
    }
    return profile;
  }
  const activeProfile = getOrRepairActiveProfile(req.user.id);
  if (!activeProfile) {
    res.status(400).json({ error: "No active profile" });
    return null;
  }
  return activeProfile;
}

function sendEnhanceStatus(req, res) {
  const profile = getResumeRouteProfile(req, res);
  if (!profile) return;
  const status = computeEnhancementStatus(db, { userId: req.user.id, profileId: profile.id });
  res.json({
    enhanceUsed: !status.eligible,
    enhancePaid: false,
    ...status,
    history: listProfileEnhancementHistory(db, { userId: req.user.id, profileId: profile.id, limit: 5 }),
  });
}

async function enhanceProfileResume(req, res) {
  const profile = getResumeRouteProfile(req, res);
  if (!profile) return;
  if (!requirePlan(req, res, "PLUS")) return;
  if (!toolsService.configured) {
    const { status, body } = httpErrorFor(new ToolsServiceError("The résumé tools service is not configured on this server",
      { code: "tools_service_unconfigured", retryable: false, permanent: true }));
    return res.status(status).json(body);
  }

  const baseResumeRow = getBaseResumeRecord(db, { userId: req.user.id, profileId: profile.id });
  if (!baseResumeRow?.content) return res.status(400).json({ error: "No base resume uploaded for this profile" });
  const enhanceStatus = computeEnhancementStatus(db, { userId: req.user.id, profileId: profile.id });
  if (!enhanceStatus.eligible) {
    return res.status(400).json({
      error: "enhance_not_ready",
      message: `Select at least ${enhanceStatus.threshold} ATS-backed profile suggestions before enhancing this resume.`,
      status: enhanceStatus,
    });
  }

  const originalText = baseResumeRow.content;
  const selectedAdditions = buildSelectedEnhancementSkills(db, {
    userId: req.user.id,
    profileId: profile.id,
  });
  const selectedLabels = selectedAdditions.map(item => item.label);

  try {
    // A4 — the rewrite runs in the tools service (same system prompt, same user message; its
    // src/generation/enhance.js). Scoring the two versions and persisting stay here.
    let enhanced;
    try {
      enhanced = await toolsService.enhance({
        resumeText: originalText,
        profile: { name: profile.profile_name, roleFamily: profile.role_family, domain: profile.domain },
        selectedAdditions: selectedLabels,
      });
    } catch (e) {
      recordToolsServiceUsage(db, e?.usage, { userId: req.user.id, eventSubtype: "enhance", requestError: e?.code });
      throw e;
    }
    recordToolsServiceUsage(db, enhanced.usage, { userId: req.user.id, eventSubtype: "enhance" });
    const enhancedText = enhanced.text;

    const templateJd = "Software Engineer, Product Manager, Data Scientist, Data Engineer, Machine Learning Engineer";
    const scoreSignalProfile = loadOrCreateSimpleApplyProfile(db, {
      userId: req.user.id,
      profileId: profile.id,
    });
    const scoreFor = (resumeContent) => {
      try {
        const runtimeBasis = buildRuntimeAtsBasis({
          resumeText: resumeContent,
          signalProfile: scoreSignalProfile,
          domainProfile: profile,
          claims: atsClaims(profile),
        });
        return scoreAtsLocally({ job: { title: profile.profile_name, description: templateJd }, runtimeBasis,
          termWeights: atsTermWeightsForJob({ title: profile.profile_name }),
          synonyms: atsSynonyms() });
      } catch { return null; }
    };

    const [origReport, enhReport] = [scoreFor(originalText), scoreFor(enhancedText)];
    const delta = (enhReport?.score ?? 0) - (origReport?.score ?? 0);

    db.prepare(`
      UPDATE profile_base_resumes
      SET enhanced_content=?, enhanced_at=unixepoch(), enhanced_ats_delta=?
      WHERE profile_id=? AND user_id=?
    `).run(enhancedText, delta, profile.id, req.user.id);
    insertProfileEnhancementHistory(db, {
      userId: req.user.id,
      profileId: profile.id,
      baseResumeContent: originalText,
      enhancedContent: enhancedText,
      selectedSkills: selectedLabels,
      atsDelta: delta,
    });

    insertNotification(req.user.id, "enhance_ready",
      `Enhanced resume ready${delta > 0 ? ` (+${delta} ATS pts)` : ""}`,
      { delta, profileId: profile.id, selectedSkills: selectedLabels });
    res.json({
      profileId: profile.id,
      selectedSkills: selectedLabels,
      original: { text: originalText, atsScore: origReport?.score ?? null },
      enhanced: { text: enhancedText, atsScore: enhReport?.score ?? null },
      delta,
      improvements: enhReport?.improvements || [],
    });
  } catch(e) {
    noteGenerationFailure(e, "enhance");
    const { status, body } = httpErrorFor(e, "Enhancement failed");
    res.status(status).json(body);
  }
}

async function adoptEnhancedProfileResume(req, res) {
  const profile = getResumeRouteProfile(req, res);
  if (!profile) return;
  const row = getBaseResumeRecord(db, { userId: req.user.id, profileId: profile.id });
  if (!row?.enhanced_content) return res.status(400).json({ error: "No enhanced resume available" });
  const latestEnhancement = db.prepare(`
    SELECT id, selected_skills_json
    FROM profile_resume_enhancements
    WHERE user_id = ? AND profile_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(req.user.id, profile.id);

  // ADOPTING IS ONE ACT, so it is one transaction.
  //
  // These four writes used to run loose, in this order, with the destructive one first. When
  // markSelectedSuggestionsApplied threw — it called an undefined symbol and did so for every
  // adoption that had skills selected, which is every adoption the UI can reach — the base resume
  // had ALREADY been replaced. The candidate got a 500 for an operation that had half happened:
  // their resume overwritten, the suggestions still sitting at 'selected'.
  //
  // The symbol is fixed, but the ordering was what turned a typo into data loss. All of this is
  // synchronous better-sqlite3 work, so a transaction is available and nothing here can half-apply
  // again.
  const adopt = db.transaction(() => {
    db.prepare(`
      UPDATE profile_base_resumes
      SET content = enhanced_content, updated_at = unixepoch()
      WHERE profile_id = ? AND user_id = ?
    `).run(profile.id, req.user.id);
    upsertSimpleApplyProfile(db, {
      userId: req.user.id,
      profileId: profile.id,
    }, row.enhanced_content);
    if (latestEnhancement?.id) {
      db.prepare(`
        UPDATE profile_resume_enhancements
        SET adopted_at = unixepoch()
        WHERE id = ?
      `).run(latestEnhancement.id);
    }
    markSelectedSuggestionsApplied(db, {
      userId: req.user.id,
      profileId: profile.id,
      selectedLabels: (() => {
        try { return JSON.parse(latestEnhancement?.selected_skills_json || "[]"); } catch { return []; }
      })(),
    });
  });
  adopt();

  const userId = req.user.id;
  const profileId = profile.id;
  enqueueAtsScoreWork(`adopt-enhanced:${userId}:${profileId}`, async () => {
    try {
      // The panel's basis builder and scorer call (atsBasisForProfile / scoreJobForBasis): the
      // adopted text IS the base résumé now, so this is exactly the basis the panel and the board's
      // fit precompute will use, and the rows written here carry a hash they will accept as fresh.
      const basis = atsBasisForProfile(userId, profile);
      if (!basis) return;
      const { runtimeBasis, basisHash } = basis;

      // ⛔ `sj.*`, NOT the four columns this used to select (job_id, description, title, company).
      // The scorer also reads skills_json, normalized_title, experience_level and more, so a
      // four-column row scored differently from the full row the panel scores — and with migration
      // 110 that lower-fidelity score would have carried the same basis hash as a real one and been
      // accepted as fresh by the board's precompute.
      const jobsToRescore = db.prepare(`
        SELECT sj.* FROM scraped_jobs sj
        JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
        WHERE sj.description IS NOT NULL
      `).all(userId, profileId);

      // ⛔ CC5 · THE MOST DESTRUCTIVE OF THE THREE WRITERS, AND IT IS THE ONE THE BRIEF NAMED.
      //
      // It read this user's rows out of `user_jobs` — correctly scoped to (user, profile) — scored
      // them against THIS profile's newly enhanced résumé, and then wrote the results to
      // `scraped_jobs.ats_score`, which is not scoped to anything. Adopting an enhanced résumé
      // therefore overwrote, for every other user of every posting this one had saved, the score
      // they were being shown. One user pressing a button changed strangers' boards.
      //
      // Same rows, same basis, same batching; the destination is now keyed by whose résumé it was.
      for (let i = 0; i < jobsToRescore.length; i += 25) {
        const batch = jobsToRescore.slice(i, i + 25);
        await Promise.all(batch.map(async job => {
          try {
            const report = scoreJobForBasis(job, runtimeBasis);
            storeAtsReportForProfile({ userId, profileId, jobId: job.job_id, report, basisHash, jobHash: atsJobInputHash(job) });
          } catch(e) {
            console.warn(`[adopt-enhanced] rescore failed for ${job.job_id}:`, e.message);
          }
        }));
      }
      console.log(`[adopt-enhanced] Re-scored ${jobsToRescore.length} jobs for user ${userId}, profile ${profileId}`);
    } catch(e) {
      console.warn("[adopt-enhanced] background rescore failed:", e.message);
    } finally {
      // The résumé changed, so every precomputed board score for this profile is now stale. The
      // rows above are the user's own saved postings; this re-scores the rest of the board.
      scheduleBoardFit(userId, "adopt-enhanced", profile);
    }
  });

  res.json({ ok: true, profileId });
}
// ENHANCE GATING: profile-scoped and ATS-signal-driven.
// Eligibility depends on selected, broadly useful profile suggestions rather than a one-time user flag.

// GET /api/base-resume/enhance-status
app.get("/api/base-resume/enhance-status", requireAuth, (req, res) => {
  sendEnhanceStatus(req, res);
});

// POST /api/base-resume/enhance — legacy wrapper for the active profile
app.post("/api/base-resume/enhance", requireAuth, async (req, res) => {
  return await enhanceProfileResume(req, res);
});

// PATCH /api/base-resume/adopt-enhanced — legacy wrapper for the active profile
app.patch("/api/base-resume/adopt-enhanced", requireAuth, async (req, res) => {
  return await adoptEnhancedProfileResume(req, res);
});

app.get("/api/domain-profiles/:id/enhance-status", requireAuth, (req, res) => {
  sendEnhanceStatus(req, res);
});

app.post("/api/domain-profiles/:id/enhance", requireAuth, async (req, res) => {
  await enhanceProfileResume(req, res);
});

app.patch("/api/domain-profiles/:id/adopt-enhanced", requireAuth, async (req, res) => {
  await adoptEnhancedProfileResume(req, res);
});

app.post("/api/parse-pdf", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error:"No file" });
  // D17 (A80 V1, O16e): PDF → text reads the file's own text layer, here, with no model call. It used
  // to send the PDF to the tools service, which had Sonnet transcribe it; local extraction was the
  // fallback. Measured 10-03 on synthetic résumés (one column, two columns, a two-column TABLE whose
  // draw order interleaves rows, and an image-only scan): pdf-parse keeps every line of the first two
  // in its own section; the table layout comes out row-interleaved (sections mixed — the model's
  // "preserve section structure" could untangle that); a scan has no text layer at all (the model
  // read images). Neither of those is guessed at: a scan is refused with what to do instead.
  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const text = ((await pdfParse(req.file.buffer)).text || "").trim();
    if (text.length < 50) {
      return res.status(422).json({ error: "This PDF has no readable text — it looks like a scan or an image",
        code: "pdf_no_text_layer", retryable: false,
        detail: "Export the résumé from your editor as a PDF (File → Save as PDF), or paste its text instead." });
    }
    res.json({ text, chars: text.length, source: "local", degraded: false });
  } catch (e) {
    res.status(422).json({ error: "Could not read this PDF", retryable: false, detail: String(e?.message || e).slice(0, 200) });
  }
});


// ═══════════════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════════════
const generationInFlight = new Set();
// Tracks in-flight apply-worker-triggered generations: key → Promise<{html,atsScore,resumeId}|{error}>
const pendingGenerationPromises = new Map();

// ── coreGenerateResume ─────────────────────────────────────────────────────────
// Shared generation kernel used by the HTTP /api/generate handler AND the apply
// worker via generateResumeForApply().  Does NOT do HTTP req/res or rate-limit
// checks — those live in the caller.  Throws on error; returns artifact on success.
// D70 Phase 3: `cache` is the CALLER's prompt-cache choice — false from the interactive route (a one-shot:
// 0 cache reads in 11 in production), unset from the apply worker (bursts). services/toolsServiceRequests.js.
// ⭐ D98 P1: `isCancelled` — the extension's Cancel. Checked before the model call (nothing sent: the caller refunds the
// slot) and before the store (the work was done: nothing is stored). The web route and the apply worker pass none.
async function coreGenerateResume({ userId, jobId, job, tool, resumeText = "", employers = [], cache = undefined, isCancelled = null }) {
  const mode         = legacyModeForTool(tool);
  // ⛔ Owner 11-07: A+ is off the default path — an A+ request is served as a Generate with the admin's strategy × model
  // unless the owner's override (Admin → Ops → Tailoring) is on. The artifact keeps the tool that was asked — its
  // lookups key on it; the ledger says what was actually served.
  const promptMode   = servedPromptMode(db, tool);
  const eventSubtype = promptMode;

  const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
  const activeDomainProfile = db.prepare(
    "SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1"
  ).get(userId);
  const storedResume = activeDomainProfile
    ? getBaseResumeRecord(db, { userId, profileId: activeDomainProfile.id })
    : null;
  const authoritativeResumeText = storedResume?.content || resumeText;

  // A4. Domain resolution, prompt assembly, the model call, formatting and the claim guard now run
  // in the tools service (services/toolsService.js). With an active profile draft sends its role
  // family and domain and the tools service resolves the module exactly as qualificationResolver did;
  // without one, the tools service classifies. What stays here is everything that is draft's: the
  // database reads and writes, scoring with draft's own weights, notifications.

  // AG2. Read fresh on every generation, so a claim made after an earlier resume was produced
  // affects the NEXT one and never reaches back into an artifact already saved.
  // ⛔ D169 P2: a claimed skill NOT on this base résumé reaches the résumé only once proven (checked / built) —
  // services/yourSkills.js. Scoring is not gated (atsClaims reads the claims whole).
  const profileClaims = activeDomainProfile
    ? gateClaimsForResume(db, { userId, claims: listProfileClaims(db, { userId, profileId: activeDomainProfile.id }), resumeText: authoritativeResumeText })
    : null;

  // AI1. The summary is opt-in per job profile and defaults OFF, so a profile that predates the
  // column (or a generation with no active profile at all) gets no summary — the documented
  // default, not an accident of a NULL. The flag reaches the MODEL, not a post-processor: with it
  // off the SUMMARY rules are absent from the assembled prompt, so no summary is generated to
  // strip. Both tools route through here, so A+ and Generate honour it identically.
  const includeSummary = activeDomainProfile?.include_summary === 1;
  // ⭐ D123 P2 · THE LEAN CALL: Haiku edits bullets and skills from keywords draft computes here (the full posting text,
  // draft's scorer, the KB's placements at the candidate's own employers); the posting's text is not sent. Off unless
  // DRAFT_TAILORING=lean (services/leanTailoring.js). Any failure to build the keywords falls back to the full call.
  // D123 (11-01): Admin → Ops → Tailoring's switch (app_settings) wins over DRAFT_TAILORING; "payload" adds the job block
  // and the per-employer gists (built once per résumé), "code" calls no model (P6d). The model is the person's pick while
  // the admin offers it, else the admin's default (services/leanTailoring.js modelFor).
  const tailoring = promptMode === "GENERATE" ? tailoringFor({ db, env: process.env }) : "full";
  let leanKeywords = null;
  let tailorGists = null;
  if (tailoring !== "full") {
    try {
      const kwProfile = getOrRepairActiveProfile(userId);
      const report = scoreAtsLocally({
        job: { ...job, description: fullPostingText(job) },
        runtimeBasis: buildRuntimeAtsBasis({
          resumeText: authoritativeResumeText,
          signalProfile: kwProfile ? loadOrCreateSimpleApplyProfile(db, { userId, profileId: kwProfile.id }) : null,
          domainProfile: kwProfile,
          claims: atsClaims(kwProfile),
        }),
        termWeights: atsTermWeightsForJob(job),
        synonyms: atsSynonyms(),
      });
      const kwArgs = { job, report, claims: profileClaims, resumeText: authoritativeResumeText, synonyms: atsSynonyms() };
      leanKeywords = tailoring === "lean" ? leanJobKeywords(db, kwArgs) : payloadJobKeywords(db, kwArgs);
      if (tailoring === "payload") tailorGists = await ensureGists(db, toolsService, { userId, resumeText: authoritativeResumeText });
    } catch (e) {
      console.warn("[generate] lean keywords failed, using the full call:", e.message);
      leanKeywords = null;
    }
  }
  const generateBody = toolsGenerateRequest({
    profile, job, baseResumeText: authoritativeResumeText, mode: promptMode, employers,
    domainProfile: gatedDomainProfile(db, { userId, domainProfile: activeDomainProfile, resumeText: authoritativeResumeText }), claims: profileClaims, includeSummary, cache,
    tailoring: leanKeywords ? tailoring : "full", keywords: leanKeywords,
    model: leanKeywords ? modelFor(db, { userId, tailoring }) : null,
    gists: tailorGists, coursework: leanKeywords && tailoring !== "lean" ? readCoursework(db, userId) : null,
    // D109 P2: which Profile bullets carry evidence — on the wire once the tools service declares it.
    evidence: evidenceForRequest(db, userId),
  });

  // ── AK1: measure the LIFT, not just the spend ────────────────────────────────────────────────
  //
  // usage_events has carried ats_score_before/ats_score_after since the table existed and
  // routes/admin.js renders an "avg before -> avg after" panel from them, but every row was NULL,
  // so the panel had never shown anything and "does generation actually improve the score?" had no
  // answer in a system built to answer it.
  //
  // BEFORE is scored HERE, against the base resume, before the model sees anything — the same
  // scorer, same job, same corpus weights the generated document will be scored with 130 lines
  // below. Anything else would make the delta a comparison of two different measurements rather
  // than a lift. It is local and deterministic (~10ms, no model call), so it costs nothing.
  //
  // Wrapped: a measurement may never fail a generation the user is waiting for.
  let atsScoreBefore = null;
  try {
    const beforeProfile = getOrRepairActiveProfile(userId);
    atsScoreBefore = scoreAtsLocally({
      job: withPostingText(job),
      runtimeBasis: buildRuntimeAtsBasis({
        resumeText: authoritativeResumeText,
        signalProfile: beforeProfile
          ? loadOrCreateSimpleApplyProfile(db, { userId, profileId: beforeProfile.id })
          : null,
        domainProfile: beforeProfile,
        claims: atsClaims(beforeProfile),
      }),
      termWeights: atsTermWeightsForJob(job),
      synonyms: atsSynonyms(),
    }).score;
  } catch (e) {
    console.warn("[generate] could not score the base resume for lift measurement:", e.message);
  }

  // The row is written when the call returns; the AFTER score does not exist until the document
  // has been formatted and claim-checked. Capture the id now, fill the score in later.
  let usageEventId = null;

  const genStart = Date.now();
  // ⛔ the tools service runs the claim guard (AF2) on this document BEFORE returning it, and on a
  // violation returns 422 with the violations and NO document — which the client throws as
  // code "resume_claim_violation", the same code failureAttribution has always classified. So a
  // withheld résumé still never reaches the writes below: nothing is persisted, scored or sent.
  // ⭐ D70 Phase 3: a generation that follows a FAILED one for this job is a retry, and says why — in
  // its ledger row and in the response. Draft makes no AUTOMATIC retry (services/generationRetry.js:
  // the cap is 1, draft makes 0); this is the person's own. ONE tools-service call below, no loop.
  const retryReason = retryReasonFor(db, { userId, jobId: String(jobId) });
  if (isCancelled?.()) throw new GenerationCancelledError("before_model");
  let generated;
  try {
    generated = await toolsService.generate(generateBody);
    clearFundingAlert();
  } catch (e) {
    noteGenerationFailure(e, "generate");
    // Spend the tools service reports on a failed request is still spend — meter it, then rethrow.
    // A94: a claim-guard refusal is a BILLED call that succeeded, so its row says success = 1; the
    // request's code is what tells it apart from a delivered résumé.
    recordToolsServiceUsage(db, e?.usage, { userId, eventSubtype, jobId: String(jobId), company: job.company, renamePurpose: LEAN_LEDGER_RENAME, requestError: e?.code, retryReason });
    throw e;
  }
  const domainModuleKey = generated.domainModuleKey;
  usageEventId = recordToolsServiceUsage(db, generated.usage, {
    userId, eventSubtype, jobId: String(jobId), company: job.company, domainModule: domainModuleKey,
    atsScoreBefore, idFor: "resume_generate", retryReason, renamePurpose: LEAN_LEDGER_RENAME,
  });
  const formattedHtml = generated.html;
  console.log(
    `[generate] via the tools service in ${Date.now() - genStart}ms, module ${domainModuleKey}; claim guard inspected ` +
    `${generated.claimCheck.inspected.documentChars} chars, headline region "${generated.claimCheck.inspected.headlineRegion}", ` +
    `summary ${includeSummary ? "on" : "off"}`
  );


  const resumeStripped = stripResumeHtml(formattedHtml);
  // ⛔ 44x (e2e walk): a résumé that came back without most of the base (the tools service's parser lost every section
  // of an "Education:"-style base — header only) is WITHHELD before anything is scored, stored, debited, marked Pending
  // or packed for an application. Its usage row is refunded like a failed store. services/generatedResumes.js says why.
  const contentLoss = resumeContentLoss(authoritativeResumeText, resumeStripped);
  if (contentLoss) {
    const refunded = refundGeneration(db, usageEventId, "résumé came back incomplete — withheld, refunded");
    console.error(`[generate] job=${jobId}: the tools service returned ${contentLoss.keptChars} of ${contentLoss.baseChars} characters ` +
      `of the base résumé (${contentLoss.ratio}) — withheld; generation count ${refunded ? "refunded" : "not found to refund"}`);
    throw new ToolsServiceError("The tailored résumé came back missing most of the base résumé",
      { code: "resume_incomplete", status: 502, retryable: false, permanent: true });
  }
  const activeProfile = getOrRepairActiveProfile(userId);
  const signalProfile = activeProfile
    ? loadOrCreateSimpleApplyProfile(db, { userId, profileId: activeProfile.id })
    : null;
  const runtimeBasis = buildRuntimeAtsBasis({
    resumeText: resumeStripped,
    signalProfile,
    domainProfile: activeProfile,
    claims: atsClaims(activeProfile),
  });
  const atsReport = scoreAtsLocally({ job: withPostingText(job), runtimeBasis, termWeights: atsTermWeightsForJob(job), synonyms: atsSynonyms() });
  const atsScore = atsReport.score;
  const atsCacheKey = buildAtsCacheKey(formattedHtml, job);

  // AK1: close the loop on the lift measurement opened before the model call. Both values now
  // exist and were produced by the same scorer against the same job, so before -> after is a real
  // delta. Either may legitimately be null (the scorer declines when a posting carries too little
  // signal); null is recorded as null, because a fabricated 0 in this column would corrupt the one
  // dataset that can show whether generation is worth what it costs.
  recordAtsOutcome(db, usageEventId, { scoreBefore: atsScoreBefore, scoreAfter: atsScore });
  console.log(`[generate] ATS lift: ${atsScoreBefore ?? "n/a"} -> ${atsScore ?? "n/a"}` +
    (atsScoreBefore != null && atsScore != null ? ` (${atsScore - atsScoreBefore >= 0 ? "+" : ""}${atsScore - atsScoreBefore})` : ""));

  // ⛔ D57 · ONE STORE, AND IT IS ALWAYS THE NEWEST. The version, the job's current résumé and the
  // user_jobs flag are one transaction (services/generatedResumes.js). `resumes` used to be written
  // only while no version was KEPT — so a generation after an exported (kept) one, charged a slot and shown
  // once, was in resume_versions and nowhere a reader looks. A store that fails gives the plan's
  // generation count back (the usage row above is the spend; it is marked unsuccessful) and throws a
  // ResumeStoreError the route answers with STORE_FAILED_SENTENCE — the Draft slot is debited only
  // after this returns, so none was taken.
  if (isCancelled?.()) throw new GenerationCancelledError("after_model");
  let stored;
  try {
    stored = storeGeneratedResume(db, {
      userId, jobId: String(jobId), job, tool, mode, html: formattedHtml, atsScore, atsReport,
      // ⭐ D58: the pair, written once — the base résumé's score measured above (same scorer, same job).
      baseAtsScore: atsScoreBefore,
      atsCacheKey, promptVersion: ATS_SCORE_PROMPT_VERSION, domainProfileId: activeDomainProfile?.id ?? null,
      userJobProfileId: resolveUserJobDomainProfileId(userId, String(jobId)),
    });
  } catch (e) {
    const refunded = refundGeneration(db, usageEventId);
    console.error(`[generate] the résumé for job=${jobId} could not be stored (${e?.code || e?.name}: ${e?.message}); ` +
      `generation count ${refunded ? "refunded" : "not found to refund"}`);
    throw new ResumeStoreError(STORE_FAILED_SENTENCE, { cause: e, refunded });
  }
  const { version } = stored;

  emitToUser(userId, { type: "resume_generated", jobId: String(jobId), atsScore });
  insertNotification(userId, "resume_generated",
    `Resume ready for ${job.company}${atsScore != null ? ` (ATS: ${atsScore})` : ""}`,
    { jobId: String(jobId), company: job.company, atsScore });

  return { html: formattedHtml, atsScore, atsReport, baseAtsScore: atsScoreBefore ?? null, version, resumeId: stored.resumeId, generatedAt: Date.now(),
    retry: retryReason ? { reason: retryReason } : null };
}

// ── COST VISIBILITY (owner, 10-09): a generation failure's RAW reason is the admin's, never the user's ──────
// The user gets one of a few fixed sentences (services/toolsService.js USER_GENERATION_MESSAGES). The raw text
// goes to the server log; a FUNDING failure (an exhausted credit balance, a bad key) also raises the admin's
// banner (Admin → Costs and quotas), cleared by the next generation that succeeds.
const FUNDING_ALERT_KEY = "generation_funding_alert";
function noteGenerationFailure(e, where) {
  console.error(`[generation] ${where} failed:`, e?.code || e?.name, String(e?.message || "").slice(0, 300));
  if (!isFundingFailure(e)) return;
  try {
    setSetting(db, FUNDING_ALERT_KEY, JSON.stringify({ at: Math.floor(Date.now() / 1000), where, code: e?.code ?? null,
      message: String(e?.message || "").slice(0, 200) }));
  } catch { /* the banner is best effort; the log line above stands */ }
}
function clearFundingAlert() {
  try { if (getSetting(db, FUNDING_ALERT_KEY) !== null) clearSetting(db, FUNDING_ALERT_KEY); } catch { /* best effort */ }
}
function fundingAlert() {
  try { const v = getSetting(db, FUNDING_ALERT_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

// ── D86 · BRING-YOUR-OWN-MODEL: what the tools need from this file's closure ─────────────────────
//
// ⛔ No model call anywhere below (D17): the user's own model wrote the patch. Scoring is the same basis
// and scorer as the ATS panel; storing is D57's one store, as coreGenerateResume's; the job becomes
// Pending and Prepared exactly as a Generate makes it (A63, D56) — but NO Draft slot is debited and no
// plan generation is counted: draft paid nothing for this résumé. The per-user daily cap is policy.js's.
function byomDeps() {
  const textOf = (t) => /<(html|body|div|ul|p)[\s>]/i.test(String(t || "")) ? stripResumeHtml(t) : String(t || "");
  return {
    db,
    appUrl: APP_BASE_ORIGIN || `http://localhost:${PORT}`,
    // D86 DR-3: the brief is a signed token; its key is derived from the session secret, never stored.
    briefSecret: crypto.createHmac("sha256", SESSION_SECRET || "dev-session-secret-change-me").update("byom-brief-v1").digest(),
    // ⛔ D110 P4: draft_get_interview_prep is built but NOT in the catalogue under directory review (D86 Appendix A) —
    // served only when BYOM_INTERVIEW_TOOL=1, which waits for the owner's catalogue decision.
    interviewTool: process.env.BYOM_INTERVIEW_TOOL === "1",
    jobFor: (jobId) => db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId)) || null,
    mapJob: (row) => mapJobRow(row),
    // D86 draft_search_jobs: the BOARD itself — boardPageResponse, the same query and order as GET /api/jobs.
    async searchBoard(userId, { query, location, level, postedWithin, limit }) {
      const q = { pageSize: String(limit || 10) };
      if (query) q.role = query;
      if (location) q.location = location;
      if (level) q.experience_levels = level;
      if (postedWithin) q.ageFilter = postedWithin;
      const { status, body } = await boardPageResponse({ query: q, user: { id: userId } });
      if (status !== 200) throw new Error(body?.error || `board ${status}`);
      return { jobs: body.jobs || [], total: body.total ?? (body.jobs || []).length, needsProfile: !!body.needsProfileSetup };
    },
    baseFor(userId) {
      const dp = getOrRepairActiveProfile(userId);
      if (!dp) return null;
      const text = getBaseResumeRecord(db, { userId, profileId: dp.id })?.content || "";
      if (!text.trim()) return null;
      return {
        text, structured: buildStructuredResume(text), domainProfile: dp,
        userProfile: db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {},
        // ⛔ D169 P2: the claims the patch guard accepts — an unproven skill not on this base is refused like any new term.
        claims: gateClaimsForResume(db, { userId, claims: listProfileClaims(db, { userId, profileId: dp.id }), resumeText: text }), allowSummary: dp.include_summary === 1,
        // D109 P2: a brief bullet is backed when the Profile has evidence on a bullet with the same text.
        backedFor: ((keys) => (text) => keys.has(evidenceKey(text)))(backedBulletKeys(db, userId)),
      };
    },
    scoreText(userId, job, text) {
      const basis = atsBasisForProfile(userId, getOrRepairActiveProfile(userId), { resumeText: textOf(text) });
      return basis ? scoreJobForBasis(job, basis.runtimeBasis) : null;
    },
    claimCheck: (args) => checkResumeClaims(args),
    vocabulary: (_job, baseReport) => [...Array.from(skillVocabularyTerms()), ...(baseReport?.tier1_matched || []), ...(baseReport?.tier1_missing || [])],
    storeResume({ userId, jobId, job, html, atsScore, atsReport, baseAtsScore, domainProfileId }) {
      const stored = storeGeneratedResume(db, {
        userId, jobId: String(jobId), job, tool: "byo_model", mode: "BYO_MODEL", html, atsScore, atsReport, baseAtsScore,
        atsCacheKey: buildAtsCacheKey(html, job), promptVersion: ATS_SCORE_PROMPT_VERSION, domainProfileId,
        userJobProfileId: resolveUserJobDomainProfileId(userId, String(jobId)),
      });
      try { markPending(db, userId, jobId, "generated"); } catch (e) { console.warn("[byom] pending:", e.message); }
      try { applyLine.prepareManualPacket({ userId, jobId: String(jobId), via: "generate", toolType: "byo_model" }); }
      catch (e) { console.warn("[byom] prepare packet:", e.message); }
      emitToUser(userId, { type: "resume_generated", jobId: String(jobId), atsScore });
      insertNotification(userId, "resume_generated",
        `Resume ready for ${job.company}${atsScore != null ? ` (ATS: ${atsScore})` : ""} — written with your own model`,
        { jobId: String(jobId), company: job.company, atsScore });
      return stored;
    },
    notify: (userId, event) => emitToUser(userId, event),
  };
}

// ── scoreBaseResumeForApply ────────────────────────────────────────────────────
//
// THE FREE HALF OF THE QUEUE-THEN-APPROVE SPLIT (AL2).
//
// Generation costs ~$0.04 and now waits for approval. A user cannot approve blind, so the approval
// screen needs a real fit signal that costs nothing — and this is it: the candidate's BASE resume
// scored against the posting by the deterministic in-house scorer. NO model call, NO generated
// artifact, and no network. server.js already does exactly this for /api/jobs/:id/keywords; this
// is that path made reusable so the apply worker is not a second, drifting copy of it.
//
// IT IS A MORE HONEST NUMBER THAN THE ONE IT REPLACES. The score shown before this change was
// computed against the GENERATED resume, so it reflected tailoring the user had not yet decided to
// buy — the preview flattered the thing it was asking them to pay for. A base-resume score is an
// honest FLOOR: tailoring can only raise it, so approving on it can only be a pleasant surprise.
//
// NULL IS NOT ZERO. scoreAtsLocally DECLINES (score null, with decline_reasons) when there is too
// little signal to judge. That is returned as null and banded as "not enough signal", never
// coerced to 0 — collapsing them would render the most honest answer the engine gives as the
// worst grade it has.
// ⭐ T9: `withReport` adds the scorer's OWN report — the JSON the web app's ATS panel draws — for the extension's
// routes (routes/extensionJob.js), which hand it to the one ATS component. The apply worker never asks for it: its
// copy is stored (apply_run_jobs.base_ats_json) and stays the small summary.
function scoreBaseResumeForApply(userId, jobId, { withReport = false } = {}) {
  try {
    const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId));
    if (!job) return null;
    const activeProfile = getOrRepairActiveProfile(userId);
    if (!activeProfile) return null;
    // The same basis and scorer call as the ATS panel and the board's fit precompute — so the
    // approval screen's band is the band the board sorted this posting by.
    const basis = atsBasisForProfile(userId, activeProfile);
    if (!basis) return null;
    const report = scoreJobForBasis(job, basis.runtimeBasis);
    return {
      score: report.score,
      band: atsBandFor(report),
      scorable: report.scorable,
      declineReasons: report.decline_reasons || [],
      matched: report.tier1_matched || [],
      missing: report.tier1_missing || [],
      resumeDepth: report.resume_depth || null,
      ...(withReport ? { report } : {}),
    };
  } catch (e) {
    // A missing free score must not take down the run that was going to show it. The approval
    // screen renders "not enough signal" and says so, which is the same state the scorer itself
    // produces when it declines — and is honest here for the same reason.
    console.warn(`[scoreBaseResumeForApply] job=${jobId}: ${e.message}`);
    return null;
  }
}

/**
 * ⭐ T3 (field report 10-14) · the base résumé scored against a page draft does not hold — THE PAGE'S OWN TEXT, read by
 * the capture's reader (routes/extensionJob.js pageJobForExtension). The same basis and the same scorer as
 * scoreBaseResumeForApply above, so a page and the board job it later becomes read the same number. Nothing is stored.
 */
function scorePageTextForBase(userId, job) {
  try {
    if (!job?.description && !job?.description_text) return null;
    const activeProfile = getOrRepairActiveProfile(userId);
    if (!activeProfile) return null;
    const basis = atsBasisForProfile(userId, activeProfile);
    if (!basis) return null;
    const report = scoreJobForBasis(job, basis.runtimeBasis);
    // T9: the scorer's own report travels too — the extension draws the web app's ATS component from it.
    return { score: report.score, band: atsBandFor(report), scorable: report.scorable,
             matched: report.tier1_matched || [], missing: report.tier1_missing || [], report };
  } catch (e) {
    console.warn(`[scorePageTextForBase] ${e.message}`);
    return null;
  }
}

// ── generateResumeForApply ─────────────────────────────────────────────────────
// Called by the apply worker to resolve or trigger a resume artifact in the
// background.  Returns a Promise that resolves to { html, atsScore, resumeId }
// or { error: string }.  Multiple callers for the same (userId, jobId, tool)
// share the same in-flight Promise to prevent duplicate generation.
function generateResumeForApply(userId, jobId, toolType) {
  const tool = toolType === "a_plus_resume" ? "a_plus_resume" : "generate";
  const key  = `${userId}:${String(jobId)}:${tool}`;

  // 1. Existing artifact in DB — reused only when it is still CURRENT (AH5). It used to be reused
  //    unconditionally, so an artifact built for another profile, or before the base resume was
  //    rewritten, was silently sent to an employer.
  const currency = artifactCurrency(db, { userId, jobId, tool });
  if (currency.current) {
    return Promise.resolve({
      html: currency.artifact.html,
      atsScore: currency.artifact.ats_score ?? null,
      resumeId: currency.artifact.id,
      fromCache: true,
      reuse: { reused: true, reason: currency.reason },
    });
  }
  if (currency.artifact) {
    console.log(`[generateResumeForApply] regenerating job=${jobId}: ${currency.reason}` +
      (currency.detail ? ` (${currency.detail})` : ""));
  }

  // 2. In-flight Promise from another worker call — share it
  if (pendingGenerationPromises.has(key)) return pendingGenerationPromises.get(key);

  // 3. HTTP handler is already generating (generationInFlight) — poll DB until done
  if (generationInFlight.has(key)) {
    console.log(`[generateResumeForApply] attaching to in-flight HTTP generation for key=${key}`);
    const waitP = new Promise(resolve => {
      const POLL_MS = 2500, MAX_MS = 120_000, start = Date.now();
      const poll = () => {
        const row = db.prepare(
          "SELECT id, ats_score, html FROM resumes WHERE user_id=? AND job_id=? ORDER BY updated_at DESC LIMIT 1"
        ).get(userId, String(jobId));
        if (row?.html) return resolve({ html: row.html, atsScore: row.ats_score ?? null, resumeId: row.id });
        if (Date.now() - start > MAX_MS) return resolve({ error: "generation_timed_out" });
        setTimeout(poll, POLL_MS);
      };
      poll();
    });
    return waitP;
  }

  // 4. Trigger new generation
  const jobRow = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId));
  if (!jobRow) return Promise.resolve({ error: "job_not_found" });

  // PER-USER GENERATION LIMIT, on the apply path too.
  //
  // checkLimit's LIMIT_MAP has carried `resume_generate` (daily_resumes / monthly_resumes) all
  // along, but it had exactly ONE call site — the HTTP /api/generate route — and this function
  // calls coreGenerateResume directly. coreGenerateResume's own header says it does no rate-limit
  // checks because "those live in the caller", and on this path the caller did not. So the apply
  // pipeline was the one generation path a user's plan limits did not apply to, and queueing is
  // what makes that expensive: a queued job generates a resume AND a cover letter before anything
  // is submitted or even approved.
  //
  // Deliberately placed AFTER the reuse and in-flight checks above: reusing a current artifact
  // costs nothing and must never be refused, and attaching to a generation already running is not
  // a new generation either. Only a genuinely new model call is metered.
  //
  // Returned in the SAME structured shape as an upstream failure, with errorPermanent:true — a
  // limit does not clear on retry the way a 529 does. processRunJob reads errorCode/errorDetail
  // into genFailure and files the job as held_review, so the run reports "you are at your limit"
  // against the job it happened to, instead of dying as a browser or generator error.
  const applyLimit = checkLimit(db, userId, "resume_generate");
  if (!applyLimit.allowed) {
    console.warn(`[generateResumeForApply] limit reached for user=${userId} job=${jobId}: ${applyLimit.reason}`);
    return Promise.resolve({
      error: applyLimit.reason,
      errorCode: "generation_limit_reached",
      errorDetail: applyLimit.reason,
      errorPermanent: true,
      limitReached: true,
      limitCurrent: applyLimit.current ?? null,
      limitValue: applyLimit.limit ?? null,
      limitPeriod: applyLimit.period ?? null,
    });
  }

  console.log(`[generateResumeForApply] starting background generation for user=${userId} job=${jobId} tool=${tool}`);
  // ⭐ D123 P-1 (the audit): the prompt cache pays only when a LATER call reads it within 5 minutes. A Draft is a burst only
  // when the account has other Drafts queued or running behind it; a single Draft is a one-shot and sends cache:false — the
  // 10-31 production call WROTE 7,897 cache tokens at 1.25x that nothing read.
  const applyBurst = (() => { try { return db.prepare("SELECT COUNT(*) n FROM apply_run_jobs WHERE user_id = ? AND status IN ('queued','running')").get(userId).n > 1; } catch { return true; } })();
  const callOnce = () => coreGenerateResume({ userId, jobId: String(jobId), job: jobRow, tool, cache: applyBurst ? undefined : false });
  // ⛔ D165 R1 + A135 (45a, measured: 4 of 5 local generations for a Staff posting on a "mid" profile were withheld for a
  // "director" claim): generation is stochastic, so ONE withheld résumé is retried once, automatically, before the run
  // says "The résumé couldn't be made". Only for a claim violation (the guard's refusal), and only within the person's
  // generation limit — every other failure goes straight to the caller as before.
  const p = callOnce()
    .catch(e => {
      if (e?.code !== "resume_claim_violation" || !checkLimit(db, userId, "resume_generate").allowed) throw e;
      console.log(`[generateResumeForApply] job=${jobId}: the résumé was withheld (claim guard) — retrying once`);
      return callOnce();
    })
    .then(r => ({ html: r.html, atsScore: r.atsScore, resumeId: r.resumeId, fromCache: false }))
    // Keep the upstream failure STRUCTURED. This used to be `{ error: e.message }`, which threw
    // away the HTTP status, the API error type and the request_id — so a 404 on a retired model
    // and a transient 529 overload were the same opaque string to every caller downstream, and
    // nothing could tell "retrying is pointless" from "retry in a moment".
    .catch(e => {
      const f = classifyGenerationError(e);
      return {
        error: f.message,
        errorCode: f.code,
        errorStatus: f.status,
        errorType: f.apiType,
        errorRequestId: f.requestId,
        errorPermanent: f.permanent,
        errorIsDeadModel: f.isDeadModel,
        errorDetail: f.detail,
      };
    })
    .finally(() => pendingGenerationPromises.delete(key));
  pendingGenerationPromises.set(key, p);
  return p;
}

// ⭐ T19 hardening (G1, 10-30): IS THE KEY ACCEPTED — the cheapest authenticated call at boot and once a day
// (services/modelKeyCheck.js). FAILED raises the same admin banner a funding failure does (where: "model_key_check");
// the next OK clears only a banner this check raised. UNREACHABLE is the network's, not the key's: logged, no banner.
// (Here, not beside fundingAlert(): A88's guard keeps the word `anthropic` out of coreGenerateResume's region.)
async function runModelKeyCheck() {
  if (!ANTHROPIC_KEY) return null;
  const r = await checkModelKey(anthropic).catch((e) => ({ state: "unreachable", reason: String(e?.message || e).slice(0, 200) }));
  (r.state === "failed" ? console.error : console.log)(`[boot] ${keyCheckLine(r)}`);
  try {
    if (r.state === "failed") {
      setSetting(db, FUNDING_ALERT_KEY, JSON.stringify({ at: Math.floor(Date.now() / 1000), where: "model_key_check", code: "model_key_rejected", message: r.reason }));
    } else if (r.state === "ok" && fundingAlert()?.where === "model_key_check") clearFundingAlert();
  } catch { /* the banner is best effort; the log line above stands */ }
  return r;
}
if (process.env.NODE_ENV !== "test") {
  void runModelKeyCheck();
  setInterval(() => { void runModelKeyCheck(); }, KEY_CHECK_EVERY_MS).unref();
}

// ── generateCoverLetterForApply ───────────────────────────────────────────────
// Called by the apply worker to produce a JD-tailored cover letter for a job.
// Returns { html, text } on success, or { error } on any failure.
// Non-fatal: the worker logs cover_letter_unavailable and proceeds without it.
async function generateCoverLetterForApply(userId, jobId) {
  if (!ANTHROPIC_KEY) return { error: 'no_api_key' };

  const jobRow = db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(String(jobId));
  if (!jobRow) return { error: 'job_not_found' };

  // ⛔ 10-09 (release check A2): THIS job's résumé — it was `ORDER BY updated_at DESC LIMIT 1` over every job,
  // so a cover letter for job B could be written from the résumé tailored for job A. The apply line generates
  // this job's résumé before the letter; without one, the base résumé — never another job's.
  const resumeRow = db.prepare("SELECT html FROM resumes WHERE user_id=? AND job_id=?").get(userId, String(jobId));
  let resumeText = resumeRow?.html
    ? resumeRow.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
    : '';
  if (!resumeText) {
    const dp = getOrRepairActiveProfile(userId);
    const base = dp ? getBaseResumeRecord(db, { userId, profileId: dp.id })?.content : null;
    resumeText = base ? String(base).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000) : '';
  }
  if (!resumeText || resumeText.length < 50) return { error: 'no_resume_text' };

  const targetLine = [jobRow.title, jobRow.company].filter(Boolean).join(' at ');
  // ⛔ D173 (1): the posting is UNTRUSTED — fenced as data, the rule in the system prompt, and the letter checked before
  // it is attached to an application (services/coverLetterPrompt.js). One builder for both cover-letter callers.
  const clReq = buildCoverLetterRequest({ resumeText, targetLine, jobDescription: jobRow.description || '', toneDesc: 'formal and professional' });

  try {
    const message = await callTask({
      task: "cover_letter.write", anthropic, db, purpose: "cover_letter_apply", userId, jobId: String(jobId),
      // CANDIDATE: the candidate's resume and profile. Never routed off Anthropic.
      dataClass: DATA_CLASS.CANDIDATE,
      system: clReq.system,
      messages: clReq.messages,
    });
    const text = message.content?.[0]?.text || '';
    if (!text) return { error: 'empty_response' };
    const check = checkCoverLetter(text, { resumeText, untrusted: clReq.untrusted });
    if (!check.ok) {
      console.warn(`[generateCoverLetterForApply] withheld (D173): ${describeViolations(check.violations)}`);
      return { error: 'untrusted_output_violation' };
    }
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:650px;margin:40px auto;line-height:1.6;font-size:14px;color:#222"><div style="white-space:pre-wrap">${escaped}</div></body></html>`;
    return { html, text };
  } catch (e) {
    console.error('[generateCoverLetterForApply] error:', e.message);
    return { error: e.message };
  }
}

// ⭐ D70 Phase 3 · what the caller's next résumé costs, BEFORE it runs — and which tool the button will
// actually run (the admin A+ flag below silently upgrades a Generate). Ledger medians, no model call.
// ⛔ COST VISIBILITY (owner, 10-09): what a résumé costs US is the admin's. A non-admin gets only what is
// theirs — the allowance, in the unit they already have (drafts in the last 24 hours), and what to expect.
app.get("/api/generate/cost", requireAuth, (req, res) => {
  const allowance = draftSlots(db, req.user.id);
  if (!mayActAsAdmin(req)) return res.json(userCostView(allowance));
  let aplusFlag = false;
  // D88 P1: the same flag /api/generate upgrades with — the resolver's a_plus_default.
  try { aplusFlag = resolveEntitlement(db, req.user.id, "a_plus_default").value === true; } catch { /* no flag column: a plain Generate */ }
  res.json({ ...generationCostSummary(db, { aplusFlag }), allowance, expectSeconds: GENERATION_EXPECT_SECONDS });
});

// ⭐ COST VISIBILITY · Admin → Costs & quotas: everything the user surfaces no longer show — the per-résumé
// medians, the recent generation calls with their cost, tokens, cache and retry notes, and the funding banner
// (set when the model account ran out of credit or lost its key; cleared by the next success, or here).
const GENERATION_PURPOSES_SQL = "(e.purpose LIKE '%generate%' OR e.purpose LIKE '%enhance%' OR e.purpose LIKE 'cover_letter%' OR e.purpose = 'a_plus_resume')";
app.get("/api/admin/costs", requireAdmin, (req, res) => {
  const recent = db.prepare(`SELECT e.id, e.user_id AS userId, u.username, e.purpose, e.event_subtype AS kind, e.model,
      e.input_tokens AS inputTokens, e.output_tokens AS outputTokens, e.cache_read_tokens AS cacheReadTokens,
      e.cached, e.cost_usd AS costUsd, e.duration_ms AS durationMs, e.success, e.error_text AS note, e.created_at AS at
    FROM usage_events e LEFT JOIN users u ON u.id = e.user_id
    WHERE ${GENERATION_PURPOSES_SQL}
    ORDER BY e.id DESC LIMIT 50`).all();
  const day = Math.floor(Date.now() / 1000) - 86400;
  const today = db.prepare(`SELECT COUNT(*) AS calls, COALESCE(SUM(e.cost_usd), 0) AS costUsd FROM usage_events e
    WHERE ${GENERATION_PURPOSES_SQL} AND e.created_at >= ?`).get(day);
  res.json({ summary: generationCostSummary(db), last24h: today, recent, fundingAlert: fundingAlert() });
});
app.post("/api/admin/costs/funding-alert/clear", requireAdmin, (req, res) => {
  clearFundingAlert();
  res.json({ ok: true });
});

app.post("/api/generate", requireAuth, async (req, res) => {
  // ⛔ COST VISIBILITY: every answer below passes through the filter — a non-admin never sees the tool that ran
  // (an admin's silent A+ swap shows as Generate), the retry reason, or usage / cost / tokens / model / cache.
  { const json = res.json.bind(res); res.json = (body) => json(userSafeGeneration(body, { admin: mayActAsAdmin(req) })); }
  const { jobId, job, resumeText, forceRegen } = req.body;
  // Strip excluded companies from employer list before any processing
  const employers = sanitiseEmployers(req.body.employers);
  if (!job||!resumeText) return res.status(400).json({ error:"job and resumeText required" });
  let tool = req.body?.tool === "a_plus_resume" ? "a_plus_resume" : "generate";
  // If the user has the admin-granted A+ flag, silently upgrade "generate" to A+ pipeline
  if (tool === "generate") {
    // ⭐ D88 P1: the swap flag is the resolver's a_plus_default (override: users.aplus_resume).
    const userFlags = { aplus_resume: resolveEntitlement(db, req.user.id, "a_plus_default").value };
    if (userFlags?.aplus_resume) tool = "a_plus_resume";
  }
  if (!requireToolEntitlement(req, res, tool)) return;
  const mode = legacyModeForTool(tool);
  const promptMode = promptModeForTool(tool);
  const eventSubtype = eventSubtypeForTool(tool);
  // ⛔ A88: this route used to refuse with 500 "ANTHROPIC_KEY not configured" — but nothing in it
  // calls a model. A new résumé comes from coreGenerateResume → toolsService.generate (the tools
  // service holds the model key, D17); a cached one is served and re-scored locally. So the key
  // gated the wrong dependency: a server with the key and no tools service passed it and then
  // failed inside generation, and one with the tools service and no key refused a working route.
  // The tools-service gate sits below, on the NEW-generation branch only.

  // Guard: reject obviously empty or template-placeholder resume content
  const resumeTrimmed = resumeText.trim();
  if (resumeTrimmed.length < 100) {
    return res.status(400).json({ error:"Base resume is too short or empty. Please re-upload your resume and try again." });
  }
  const PLACEHOLDER_PATTERNS = [/your name/i, /your\.email@example/i, /\[your name\]/i, /YOUR NAME/];
  if (PLACEHOLDER_PATTERNS.some(p => p.test(resumeTrimmed.slice(0, 300)))) {
    return res.status(400).json({ error:"Base resume data failed to load — placeholder text detected. Please re-upload your resume and try again." });
  }

  const existing = db.prepare("SELECT * FROM resumes WHERE user_id=? AND job_id=?").get(req.user.id, String(jobId));
  const existingVersion = db.prepare(`
    SELECT * FROM resume_versions
    WHERE user_id=? AND job_id=? AND tool_type=?
    ORDER BY version DESC, created_at DESC
    LIMIT 1
  `).get(req.user.id, String(jobId), tool);
  const cachedArtifact = existingVersion || (existing?.apply_mode === mode ? existing : null);

  // Company KB failsafe gate (Task 9.6) — additive only: flags/suggests, never rewrites the
  // resume, never blocks generation. Never let a validator bug break a real generate response.
  //
  // AF2 extends it INWARD: the same rule that flags a resume contradicting a company's KB flags one
  // contradicting the candidate's own profile. These findings are belt to the generation-time
  // assertion's braces — the assertion refuses a fresh violation, and this catches one in an
  // artifact CACHED before the assertion existed, which would otherwise be served unexamined.
  const kbFindingsFor = (html) => {
    let findings = [];
    try { findings = validateResumeClaims(db, html); }
    catch (e) { console.warn('[kb-failsafe] validation failed:', e.message); }
    try {
      const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(req.user.id) || {};
      const activeDomainProfile = db.prepare(
        "SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1"
      ).get(req.user.id);
      const base = activeDomainProfile
        ? getBaseResumeRecord(db, { userId: req.user.id, profileId: activeDomainProfile.id })
        : null;
      findings = findings.concat(
        profileContradictionFindings({
          html, profile, baseResumeText: base?.content || "", domainProfile: activeDomainProfile,
        })
      );
    } catch (e) { console.warn('[kb-failsafe] profile contradiction check failed:', e.message); }
    return findings;
  };

  // Limit check only applies to new generation (not cache hits)
  if (!cachedArtifact || forceRegen) {
    // A88: a NEW résumé needs the tools service (RESUME_MASTER_URL + RESUME_MASTER_TOKEN) — say so,
    // as 503 not-retryable, before a limit is checked or a slot is spent. A cached résumé needs
    // nothing remote and is still served when the service is not configured.
    if (!toolsService.configured) {
      const { status, body } = httpErrorFor(new ToolsServiceError("The résumé tools service is not configured on this server",
        { code: "tools_service_unconfigured", retryable: false, permanent: true }));
      return res.status(status).json(body);
    }
    const limitCheck = checkLimit(db, req.user.id, "resume_generate");
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: limitCheck.reason, limitReached: true,
        current: limitCheck.current, limit: limitCheck.limit, period: limitCheck.period,
      });
    }
    // ⛔ A63 (owner, O45c): A NEW résumé costs one of the day's Draft slots — the same allowance a
    // Draft uses (services/draftSlots.js). A cached one costs nothing. Refused at zero, with the
    // sentence every surface shows; debited below only once the résumé exists.
    const slots = draftSlots(db, req.user.id);
    if (slots.remaining <= 0) return res.status(429).json(slotsExhausted(slots));
  }
  if (cachedArtifact && !forceRegen) {
    const cachedAtsKey = buildAtsCacheKey(cachedArtifact.html, job);
    const cachedReport = parseJsonMaybe(cachedArtifact.ats_report, null);
    const hasStoredScore = cachedArtifact.ats_score != null && cachedReport;
    if (hasStoredScore && (!cachedArtifact.ats_cache_key || (
      cachedArtifact.ats_cache_key === cachedAtsKey &&
      (!cachedArtifact.ats_prompt_version || cachedArtifact.ats_prompt_version === ATS_SCORE_PROMPT_VERSION)
    ))) {
      if (!cachedArtifact.ats_cache_key) {
        db.prepare("UPDATE resumes SET ats_cache_key=?,ats_prompt_version=?,updated_at=unixepoch() WHERE user_id=? AND job_id=?")
          .run(cachedAtsKey, ATS_SCORE_PROMPT_VERSION, req.user.id, String(jobId));
        if (existingVersion) {
          db.prepare("UPDATE resume_versions SET ats_cache_key=?,ats_prompt_version=? WHERE id=?")
            .run(cachedAtsKey, ATS_SCORE_PROMPT_VERSION, existingVersion.id);
        }
      }
      return res.json({
        html:cachedArtifact.html,
        atsScore:cachedArtifact.ats_score,
        atsReport:cachedReport,
        cached:true,
        atsCached:true,
        tool,
        toolLabel: tool === "a_plus_resume" ? "A+ Resume" : "Generate",
        version: cachedArtifact.version || existingVersion?.version || null,
        kbFindings: kbFindingsFor(cachedArtifact.html),
        baseAtsScore: cachedArtifact.base_ats_score ?? null,
      });
    }
    try {
      const cachedResumeText = stripResumeHtml(cachedArtifact.html);
      const activeProfile = getOrRepairActiveProfile(req.user.id);
      const signalProfile = activeProfile
        ? loadOrCreateSimpleApplyProfile(db, { userId: req.user.id, profileId: activeProfile.id })
        : null;
      const runtimeBasis = buildRuntimeAtsBasis({
        resumeText: cachedResumeText,
        signalProfile,
        domainProfile: activeProfile,
        claims: atsClaims(activeProfile),
      });
      const freshReport = scoreAtsLocally({ job: withPostingText(job), runtimeBasis, termWeights: atsTermWeightsForJob(job), synonyms: atsSynonyms() });
      const freshScoreVal = freshReport.score;
        db.prepare(
          "UPDATE resumes SET ats_score=?,ats_report=?,ats_cache_key=?,ats_prompt_version=?,updated_at=unixepoch() WHERE user_id=? AND job_id=?"
        ).run(freshScoreVal, JSON.stringify(freshReport), cachedAtsKey, ATS_SCORE_PROMPT_VERSION, req.user.id, String(jobId));
        if (existingVersion) {
          db.prepare("UPDATE resume_versions SET ats_score=?,ats_report=?,ats_cache_key=?,ats_prompt_version=? WHERE id=?")
            .run(freshScoreVal, JSON.stringify(freshReport), cachedAtsKey, ATS_SCORE_PROMPT_VERSION, existingVersion.id);
        }
      return res.json({
        html:cachedArtifact.html,
        atsScore:freshScoreVal,
        atsReport:freshReport,
        cached:true,
        atsCached:false,
        tool,
        toolLabel: tool === "a_plus_resume" ? "A+ Resume" : "Generate",
        version: cachedArtifact.version || existingVersion?.version || null,
        kbFindings: kbFindingsFor(cachedArtifact.html),
        baseAtsScore: cachedArtifact.base_ats_score ?? null,
      });
    } catch {
      return res.json({
        html:cachedArtifact.html,
        atsScore:cachedArtifact.ats_score,
        atsReport:JSON.parse(cachedArtifact.ats_report||"null"),
        cached:true,
        atsCached:true,
        tool,
        toolLabel: tool === "a_plus_resume" ? "A+ Resume" : "Generate",
        version: cachedArtifact.version || existingVersion?.version || null,
        kbFindings: kbFindingsFor(cachedArtifact.html),
        baseAtsScore: cachedArtifact.base_ats_score ?? null,
      });
    }
  }

  const inFlightKey = `${req.user.id}:${String(jobId)}:${tool}`;
  if (generationInFlight.has(inFlightKey)) {
    return res.status(409).json({ error:"Resume generation already in progress for this job and tool.", inFlight:true, tool });
  }
  generationInFlight.add(inFlightKey);

  try {
    // D70 Phase 3: the interactive route is a one-shot — it asks for no prompt cache.
    const result = await coreGenerateResume({ userId: req.user.id, jobId: String(jobId), job, tool, resumeText, employers, cache: false });
    // A63: debit the slot on SUCCESS, and tag the job Pending — a résumé made for a job is the
    // first sign the user may apply; it stays Pending until they record and verify a submission.
    let slots = null, pending = null;
    try {
      recordGenerationSlot(db, req.user.id, jobId);
      slots = draftSlots(db, req.user.id);
      if (jobId) pending = markPending(db, req.user.id, jobId, "generated").state;
    } catch (e) { console.warn("[generate] slot/pending:", e.message); }
    // ⭐ D56: THE MANUAL ROUTE PRODUCES A PACKET. Generating a résumé for a job makes that job PREPARED —
    // the profile's answers plus this résumé — so the extension fills it without a Draft. Never fails
    // the generation: a job with no fillable address, or an empty profile, simply stays unprepared and
    // the extension's "Prepare this application" says why.
    let prepared = null;
    try {
      if (jobId) {
        const p = applyLine.prepareManualPacket({ userId: req.user.id, jobId: String(jobId), via: "generate", toolType: tool });
        prepared = p.ok ? { packetId: p.packetId, resume: p.resume } : { error: p.error, message: p.message };
      }
    } catch (e) { console.warn("[generate] prepare packet:", e.message); }
    res.json({ html: result.html, atsScore: result.atsScore, atsReport: result.atsReport, cached:false, version: result.version, tool, toolLabel: tool === "a_plus_resume" ? "A+ Resume" : "Generate", kbFindings: kbFindingsFor(result.html),
      draftSlots: slots, pending, generatedAt: result.generatedAt, resumeId: result.resumeId, baseAtsScore: result.baseAtsScore, prepared,
      retry: result.retry ?? null });
  } catch(e) {
    // ⛔ Was `500 { error: e.message }` for everything — an exhausted balance, an overload and a
    // withheld résumé looked identical and none said whether retrying could help.
    console.error("[generate]", e?.code || e?.name, e?.message);
    // ⛔ D57: written but not stored → refunded, and SAID: no slot was taken, the count is back.
    if (e instanceof ResumeStoreError) {
      let slots = null;
      try { slots = draftSlots(db, req.user.id); } catch { /* the sentence stands without the count */ }
      return res.status(503).json({ error: e.message, code: e.code, retryable: true, refunded: true,
        planRefunded: e.refunded, draftSlots: slots });
    }
    const { status, body } = httpErrorFor(e, "Resume generation failed");
    res.status(status).json(body);
  }
  finally { generationInFlight.delete(inFlightKey); }
});


// ═══════════════════════════════════════════════════════════════
// SANDBOX + PDF
// ═══════════════════════════════════════════════════════════════
app.post("/api/resumes/:jobId/html", requireAuth, (req, res) => {
  const { html, tool, version } = req.body;
  if (!html) return res.status(400).json({ error:"html required" });
  db.prepare("UPDATE resumes SET html=?,ats_cache_key=NULL,ats_prompt_version=NULL,updated_at=unixepoch() WHERE user_id=? AND job_id=?")
    .run(html, req.user.id, req.params.jobId);
  if (tool || version) {
    db.prepare(`
      UPDATE resume_versions SET html=?, ats_cache_key=NULL, ats_prompt_version=NULL
      WHERE user_id=? AND job_id=?
        AND (? IS NULL OR tool_type=?)
        AND (? IS NULL OR version=?)
    `).run(html, req.user.id, req.params.jobId, tool || null, tool || null, version || null, version || null);
  }
  res.json({ ok:true });
});
app.post("/api/resumes/:jobId/keep", requireAuth, (req, res) => {
  const tool = req.body?.tool === "a_plus_resume" ? "a_plus_resume" : "generate";
  // ⛔ e2e 11-05: `version: null` (every résumé opened from the store) is "no version", not 0 — Number(null) is 0, so
  // the lookup asked for version 0, found nothing, and every PDF export of a stored résumé answered 404.
  const rawVersion = req.body?.version;
  const version = rawVersion == null || rawVersion === "" ? null : (Number.isFinite(Number(rawVersion)) ? Number(rawVersion) : null);
  const row = db.prepare(`
    SELECT * FROM resume_versions
    WHERE user_id=? AND job_id=? AND tool_type=?
      AND (? IS NULL OR version=?)
    ORDER BY version DESC, created_at DESC
    LIMIT 1
  `).get(req.user.id, req.params.jobId, tool, version, version);
  if (!row) return res.status(404).json({ error:"Resume artifact not found" });
  const mode = legacyModeForTool(tool);
  db.prepare("UPDATE resume_versions SET is_kept=0 WHERE user_id=? AND job_id=?")
    .run(req.user.id, req.params.jobId);
  db.prepare("UPDATE resume_versions SET is_kept=1 WHERE id=?").run(row.id);
  db.prepare(`INSERT INTO resumes (user_id,job_id,company,role,category,apply_mode,html,ats_score,ats_report,ats_cache_key,ats_prompt_version,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch())
    ON CONFLICT(user_id,job_id) DO UPDATE SET company=excluded.company,role=excluded.role,category=excluded.category,
    apply_mode=excluded.apply_mode,html=excluded.html,ats_score=excluded.ats_score,ats_report=excluded.ats_report,
    ats_cache_key=excluded.ats_cache_key,ats_prompt_version=excluded.ats_prompt_version,updated_at=excluded.updated_at`)
    .run(req.user.id, req.params.jobId, row.company, row.role, row.category, mode, row.html, row.ats_score, row.ats_report, row.ats_cache_key, row.ats_prompt_version);
  res.json({ ok:true, tool, version: row.version, applyMode: mode });
});
app.post("/api/export-pdf", requireAuth, (_req, res) => {
  res.status(503).json({ error: "Server-side PDF export is not available. Use client-side print instead.", useClientSide: true });
});
app.get("/api/resumes/:jobId/pdf", requireAuth, (_req, res) => {
  res.status(503).json({ error: "Server-side PDF export is not available. Use client-side print instead.", useClientSide: true });
});

// ═══════════════════════════════════════════════════════════════
// RESUME HISTORY
// ═══════════════════════════════════════════════════════════════
// ⛔ The admin's A+ swap stays silent on a reload (services/costVisibility.js userSafeResumeRow).
function resumeRowView(req) {
  let swapActive = false;
  try { swapActive = resolveEntitlement(db, req.user.id, "a_plus_default").value === true; } catch { /* no flag: nothing to hide */ }
  const admin = mayActAsAdmin(req);
  return (row) => userSafeResumeRow(row, { admin, swapActive });
}
app.get("/api/resumes", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.job_id, r.company, r.role, r.category,
           r.apply_mode, r.ats_score, r.ats_report, r.created_at, r.updated_at,
           r.base_ats_score,
           COUNT(v.id) as versions,
           -- D57: when this job's résumé was last GENERATED — the posting panel's "Résumé ready · 2h ago"
           COALESCE(MAX(v.created_at), r.created_at) AS generated_at
    FROM resumes r
    LEFT JOIN resume_versions v ON v.user_id=r.user_id AND v.job_id=r.job_id
    WHERE r.user_id=? GROUP BY r.id ORDER BY r.updated_at DESC
  `).all(req.user.id);
  const view = resumeRowView(req);
  res.json(rows.map(r => view({ ...r, atsReport: JSON.parse(r.ats_report || "null"), html: undefined })));
});
app.get("/api/resumes/:jobId", requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT r.*, COUNT(v.id) as versions
    FROM resumes r
    LEFT JOIN resume_versions v ON v.user_id=r.user_id AND v.job_id=r.job_id
    WHERE r.user_id=? AND r.job_id=?
    GROUP BY r.id
  `).get(req.user.id, req.params.jobId);
  if (!row) return res.status(404).json({ error: "Resume not found" });
  res.json(resumeRowView(req)({ ...row, atsReport: JSON.parse(row.ats_report || "null") }));
});
app.get("/api/resumes/:jobId/versions", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM resume_versions WHERE user_id=? AND job_id=? ORDER BY version DESC").all(req.user.id, req.params.jobId);
  const view = resumeRowView(req);
  res.json(rows.map(r => view({ ...r, atsReport: JSON.parse(r.ats_report || "null") })));
});
app.delete("/api/resumes/:jobId", requireAuth, (req, res) => {
  // The DELETE was always correctly SCOPED — it could never remove another user's resume. What it
  // did do was answer {ok:true} for a job_id it had not touched, so a request aimed at somebody
  // else's resume was indistinguishable from a successful deletion of your own. Nothing leaked, but
  // nothing said so either, and "did that work?" is exactly the question an ownership check answers.
  // D57: one delete (services/generatedResumes.js) for this route and Settings' list — and every open
  // board hears it, so the job's Résumé button is free again at once.
  if (!deleteGeneratedResume(db, req.user.id, req.params.jobId)) return res.status(404).json({ error:"Resume not found" });
  emitToUser(req.user.id, { type: "resume_deleted", jobId: String(req.params.jobId) });
  res.json({ ok:true });
});
generatedResumeRoutes(app, db, requireAuth, { emitToUser });
app.get("/api/history", requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT r.job_id,r.company,r.role,r.category,r.ats_score,r.apply_mode,r.updated_at,COUNT(v.id) as versions
    FROM resumes r LEFT JOIN resume_versions v ON v.user_id=r.user_id AND v.job_id=r.job_id
    WHERE r.user_id=? GROUP BY r.job_id ORDER BY r.updated_at DESC`).all(req.user.id);
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════
// JOB APPLICATIONS
// ═══════════════════════════════════════════════════════════════
// ⛔ A63: THIS NO LONGER RECORDS AN APPLICATION. Its two callers were the résumé PDF exports (the
// board and the Saved sheet), and exporting a PDF is not submitting one — yet it wrote
// job_applications, so an export appeared as "applied". It now tags the job PENDING
// (services/applicationRecords.js); job_applications is written only when a recorded submission
// VERIFIES. Kept as a route so an older client's export still lands somewhere true.
app.post("/api/applications", requireAuth, (req, res) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ error:"jobId required" });
  try {
    const out = markPending(db, req.user.id, jobId, "exported_resume");
    res.json({ ok:true, pending: out.state === "pending" || out.state === "recorded", state: out.state,
      message: "Tagged Pending — record the submission in Database → Pending once you have sent it." });
  } catch(e) { res.status(e.status || 500).json({ error: e.code || e.message, message: e.message }); }
});
app.get("/api/applications", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ja.*,
      sj.description      AS sj_description,
      sj.description_html AS sj_description_html,
      sj.url              AS sj_url,
      sj.apply_url        AS sj_apply_url,
      sj.salary_min       AS sj_salary_min,
      sj.salary_max       AS sj_salary_max,
      sj.salary_currency  AS sj_salary_currency,
      sj.applicant_count  AS sj_applicant_count,
      sj.min_years_exp    AS sj_min_years_exp,
      sj.max_years_exp    AS sj_max_years_exp,
      sj.exp_raw          AS sj_exp_raw,
      sj.category         AS sj_category,
      sj.work_type        AS sj_work_type,
      sj.company_icon_url AS sj_company_icon_url
    , sj.job_id AS sj_job_id
    FROM job_applications ja
    LEFT JOIN scraped_jobs sj ON sj.job_id = ja.job_id
    WHERE ja.user_id = ?
    ORDER BY ja.applied_at DESC
  `).all(req.user.id);
  res.json(rows.map(r => ({
    ...r,
    // ⛔ D43: a record of what the user DID must not depend on a row the system can delete. When the
    // posting is gone the record renders from its own snapshot (company, role, job_url, location,
    // pay) and says "posting no longer listed" — never a blank row.
    postingListed:   r.sj_job_id != null,
    description:     r.sj_description     || null,
    descriptionHtml: r.sj_description_html || null,
    url:             r.sj_url             || null,
    applyUrl:        r.sj_apply_url        || r.job_url || null,
    salaryMin:       r.sj_salary_min       || r.salary_min      || null,
    salaryMax:       r.sj_salary_max       || r.salary_max      || null,
    salaryCurrency:  r.sj_salary_currency  || r.salary_currency || null,
    applicantCount:  r.sj_applicant_count  || null,
    minYearsExp:     r.sj_min_years_exp    || null,
    maxYearsExp:     r.sj_max_years_exp    || null,
    expRaw:          r.sj_exp_raw          || null,
    category:        r.sj_category         || r.category || null,
    workType:        r.sj_work_type        || null,
    companyIconUrl:  r.sj_company_icon_url || null,
  })));
});
app.patch("/api/applications/:jobId", requireAuth, (req, res) => {
  const allowed = ["company","role","location","notes","applied_at"];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error:"No editable fields provided" });
  const set  = updates.map(([k]) => `${k}=?`).join(",");
  const vals = updates.map(([,v]) => v||null);
  // Same reasoning as DELETE /api/resumes/:jobId — scoped all along, but silent about whether the
  // row it was scoped to actually exists.
  const changed = db.prepare(`UPDATE job_applications SET ${set} WHERE user_id=? AND job_id=?`)
    .run(...vals, req.user.id, req.params.jobId).changes;
  if (!changed) return res.status(404).json({ error:"Application not found" });
  res.json({ ok:true });
});
app.delete("/api/applications/:jobId", requireAuth, (req, res) => {
  const removed = db.prepare("DELETE FROM job_applications WHERE user_id=? AND job_id=?")
    .run(req.user.id, req.params.jobId).changes;
  if (!removed) return res.status(404).json({ error:"Application not found" });
  res.json({ ok:true });
});

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════
app.get("/api/export/excel", requireAuth, async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND;
  const hdrFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF1E3A5F" } };
  const hdrFont = { bold:true, color:{ argb:"FFFFFFFF" } };
  const altFill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF1F5F9" } };

  const ws1 = wb.addWorksheet("Job Applications");
  ws1.columns = [
    {header:"#",key:"n",width:5},{header:"Company",key:"company",width:22},
    {header:"Role",key:"role",width:30},{header:"Location",key:"location",width:18},
    {header:"Source",key:"source",width:12},{header:"Mode",key:"apply_mode",width:16},
    {header:"Date Applied",key:"applied_at",width:18},{header:"Resume File",key:"resume_file",width:40},
    {header:"Job URL",key:"job_url",width:50},{header:"Notes",key:"notes",width:30},
  ];
  ws1.getRow(1).font = hdrFont; ws1.getRow(1).fill = hdrFill;
  db.prepare("SELECT * FROM job_applications WHERE user_id=? ORDER BY applied_at DESC").all(req.user.id)
    .forEach((a,i) => {
      ws1.addRow({
        n:i+1,company:a.company,role:a.role,location:a.location||"",
        source:a.source||"",apply_mode:a.apply_mode||"",
        applied_at:a.applied_at?new Date(a.applied_at*1000).toLocaleDateString():"",
        resume_file:a.resume_file||"",job_url:a.job_url||"",notes:a.notes||"",
      });
      if (i%2===1) ws1.getRow(i+2).fill = altFill;
      if (a.job_url) {
        const c = ws1.getRow(i+2).getCell("job_url");
        c.value = { text:a.job_url.slice(0,60), hyperlink:a.job_url };
        c.font  = { color:{ argb:"FF2563EB" }, underline:true };
      }
    });

  const ws2 = wb.addWorksheet("Resume History");
  ws2.columns = [
    {header:"Company",key:"company",width:22},{header:"Role",key:"role",width:30},
    {header:"Category",key:"category",width:24},{header:"ATS Score",key:"ats_score",width:12},
    {header:"Mode",key:"apply_mode",width:16},{header:"Generated",key:"created_at",width:18},
    {header:"Updated",key:"updated_at",width:18},
  ];
  ws2.getRow(1).font = hdrFont; ws2.getRow(1).fill = hdrFill;
  db.prepare("SELECT * FROM resumes WHERE user_id=? ORDER BY updated_at DESC").all(req.user.id)
    .forEach((r,i) => {
      ws2.addRow({
        company:r.company,role:r.role,category:r.category||"",
        ats_score:r.ats_score??"",apply_mode:r.apply_mode||"",
        created_at:r.created_at?new Date(r.created_at*1000).toLocaleDateString():"",
        updated_at:r.updated_at?new Date(r.updated_at*1000).toLocaleDateString():"",
      });
      if (i%2===1) ws2.getRow(i+2).fill = altFill;
    });

  res.set({
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":`attachment; filename="ResuMaster_${req.user.username}_${new Date().toISOString().slice(0,10)}.xlsx"`,
  });
  await wb.xlsx.write(res);
  res.end();
});

// ── /api/smart-search: DELETED (D17, A80 V6) ─────────────────────────────────────────────────────
// It sent 2,000 characters of the résumé to a Haiku classifier (services/classifier.js) to pick a
// search query. The only UI that called it, Smart Search in JobsPanel, lost its button in a68c6c0
// (2026-04-14) — no screen has reached it since, and the local board's usage_events holds no
// `classifier` row from draft. D17 confines model calls to résumé generation; a route nobody calls is not worth a
// deterministic rewrite. The classifier inside the tools service's generate is generation's own.

// ═══════════════════════════════════════════════════════════════
// LINKEDIN SESSION COOKIES (AES-256-GCM encrypted at rest)
// Future: use stored cookies to skip re-auth in HarvestAPI actor
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// APPLY AUTOMATION (Playwright)
// ═══════════════════════════════════════════════════════════════
const applyLine = applyRoutes(app, db, requireAuth, buildAutofillPayload, generateResumeForApply, htmlToPdf, generateCoverLetterForApply,
            scoreBaseResumeForApply);
// A59: a run left 'running' by the last process is reset before anything can start a new one, or
// that user's line never moves; then the ticker keeps every line moving (kill switch released, a
// lost dispatch).
applyLine.recoverInterruptedRuns();
applyLine.startLineTicker();
// ⭐ D100 P7 / D102 P4 · FULL AUTO's scheduler (services/autoScheduler.js): every 5 minutes, each FULL AUTO user whose run
// time has come gets ONE run of jobs from THEIR board — boardPageResponse, the board's own query, with the filters saved in
// Auto settings — after their drafted jobs, the per-company rules and the daily cap. startAutoRun is startRun: the same
// admission as every Draft.
const AUTO_TICK_MS = 5 * 60 * 1000;
const autoFetchBoard = async (userId, filters, settings = {}) => {
  const { status, body } = await boardPageResponse({ query: { pageSize: "50", ...filters }, user: { id: userId },
    boardProfileId: Number.isInteger(settings.profileId) ? settings.profileId : undefined });
  if (status !== 200) throw new Error(body?.error || `board ${status}`);
  // ⭐ D113 P1: the title, the ATS match (picks are ranked by it) and the D106 level read travel with each candidate.
  // ⭐ D136 P2: and its best-bet score — picks draw from the shortlist first.
  const profileId = Number.isInteger(settings.profileId) ? settings.profileId : (getOrRepairActiveProfile(userId)?.id ?? null);
  const userLevel = (() => { try { return userLevelFor(db, userId); } catch { return null; } })();
  const aim = (() => { try { return aimRoleFor(db, userId); } catch { return null; } })();
  return (body.jobs || []).map(j => {
    const t = j.postedAt ? Date.parse(j.postedAt) : NaN;
    let bestBet = null;
    try { bestBet = bestBetOf(bestBetSignalsFor(db, { userId, profileId, job: { id: j.id }, userLevel, aim })).score; } catch { bestBet = null; }
    return { jobId: j.id, company: j.company, title: j.title ?? null, score: Number.isFinite(j.matchScore) ? j.matchScore : null,
      levelRead: j.levelRead ?? null, postedAt: Number.isFinite(t) ? Math.floor(t / 1000) : null, bestBet,
      // ⛔ D175 FA4: what the run will face (direct = finishes on its own) — Apply for me spends its cap on those first.
      automationTier: j.automationTier ?? null };
  });
};
// ⭐ D113: the picks links' key (derived from SESSION_SECRET, never stored) and where the links point.
const PICKS_SECRET = pickSecret(SESSION_SECRET);
const PICKS_APP_URL = APP_BASE_ORIGIN || `http://localhost:${PORT}`;
setInterval(() => withStartedBy(SCHEDULER_STARTED, async () => {   // D171 FIX 1: everything this tick starts is the daily run's
  try {
    // ⭐ D113: the same tick builds the picks runs — Ask me first (one picks message) and Apply for me (straight to the run).
    const ran = await runAutoTick(db, { fetchBoard: autoFetchBoard, startAutoRun: applyLine.startAutoRun,
      notify: (userId, event, data) => notifyEvent(userId, event, data), secret: PICKS_SECRET, appUrl: PICKS_APP_URL });
    for (const r of ran) if (r.started || r.picked || r.error || r.skipped === "board_failed") console.log(`[auto] ${JSON.stringify(r)}`);
    // ⭐ D113: Apply for me's one summary after each run; a question that came back on a tapped pick.
    const followed = await runPicksFollowUps(db, { notify: (userId, event, data) => notifyEvent(userId, event, data), secret: PICKS_SECRET, appUrl: PICKS_APP_URL });
    if (followed.summaries.length || followed.questions.length) console.log(`[picks] summaries: ${followed.summaries.length}, questions: ${followed.questions.length}`);
    // (the 8 pm daily summary was retired 10-31 by the owner — Apply for me gets runPicksFollowUps' summary after each run)
  } catch (e) { console.error(`[auto] tick failed: ${e.message}`); }
}), AUTO_TICK_MS).unref();
// A63: the Pending table (pending -> verified -> submitted) and the day's Draft slots.
applicationRecordRoutes(app, db, requireAuth, { capturedAtsAtApply });
// D102: the pipeline workspace — one row per job, one detail panel (services/pipelineWorkspace.js).
pipelineRoutes(app, db, requireAuth);
// D103: the inbox — the forwarding address, the messages, re-filing, the worker's code opt-ins (services/inbox.js).
inboxRoutes(app, db, requireAuth);
// D110: interview mode — the Prep tab, the story bank, debriefs and the user's own question bank (services/interviewPrep.js).
interviewRoutes(app, db, requireAuth);
// ⭐ D112 item 8 · notifications: every event stays a `notifications` row (the bell, the SSE badge); by the person's own
// per-event switches it is also a Web Push (VAPID + RFC 8291 on node:crypto, no vendor — offered only when VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT are set) and an email through the Resend sender. services/notify.js, routes/notify.js.
notifyRoutes(app, db, requireAuth);
// ⭐ D112 item 2: the Gmail connection beside the forwarding (services/gmail.js) — gmail.readonly, the ATS senders and the
// user's applications' companies only, each message through the inbox's one path. Offered only when the owner has set
// GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET; polled every 15 minutes for connected users.
const GMAIL_CLIENT = createGoogleGmailClient();
gmailRoutes(app, db, requireAuth, { box: SECRET_BOX, client: GMAIL_CLIENT, originFor: (req) => APP_BASE_ORIGIN || `${req.protocol}://${req.get("host")}` });
startGmailPoll(db, { box: SECRET_BOX, client: GMAIL_CLIENT });
// D103 P1 → ⭐ D112 item 3: the inbox's retention sweep — 180 days unless INBOX_RETENTION_DAYS overrides it ("0" = no
// sweep; services/inbox.js inboxRetentionDays). The privacy policy promises 6 months. Once a minute after boot (a deploy
// restarts the process more often than daily, so a daily-only timer could never fire), then daily.
const sweepInboxNow = () => { try { const n = sweepInbox(db, process.env.INBOX_RETENTION_DAYS); if (n) console.log(`[inbox] retention swept ${n}`); } catch (e) { console.error(`[inbox] sweep: ${e.message}`); } };
setTimeout(sweepInboxNow, 60 * 1000).unref();
setInterval(sweepInboxNow, 24 * 3600 * 1000).unref();
// D101: the profile in sections and Application defaults (services/structuredProfile.js).
profileSectionRoutes(app, db, requireAuth);
// D109 P3: the public proof page /p/<handle> — OFF by default, nothing private, links supplied by the candidate.
proofPageRoutes(app, db);
// ⭐ D113 P3: the picks confirm page /p/confirm/<token> (a GET never acts; the POST does, once) and the picks API.
picksConfirmRoutes(app, db, requireAuth, { secret: PICKS_SECRET, startPickRun: applyLine.startPickRun, saveAnswers: applyLine.saveAnswers,
  generateResume: generateResumeForApply });
// D100 P2: the user's portals (sealed sessions, ciphertext only) and approving a remote Ready-to-approve run.
portalRoutes(app, db, requireAuth);
// D16: the résumé an application sent, expanded from its compressed copy (HTML; the browser prints it).
applicationArtifactRoutes(app, db, requireAuth);

// ⭐ D98 P1 · A RÉSUMÉ GENERATED ON THE PAGE — the extension asks, and THIS server generates (services/extensionResume.js,
// routes/extensionResume.js). The same generation as POST /api/generate: the A+ swap and its silence, the tool's plan
// rule, the plan's limit, the Draft slot, coreGenerateResume (claim guard + ATS scorer + D57's one store), then the job
// is Pending and Prepared as a Generate leaves it. The extension's own token only; user-triggered only.
const extensionResume = createExtensionResumeService({
  db,
  generate: async ({ userId, jobId, job, isCancelled }) => {
    const tool = resolveEntitlement(db, userId, "a_plus_default").value === true ? "a_plus_resume" : "generate";
    const result = await coreGenerateResume({ userId, jobId: String(jobId), job, tool,
      resumeText: extensionBaseResumeFor(db, userId)?.text || "", employers: [], cache: false, isCancelled });
    try { markPending(db, userId, jobId, "generated"); } catch (e) { console.warn("[extension-resume] pending:", e.message); }
    try { applyLine.prepareManualPacket({ userId, jobId: String(jobId), via: "generate", toolType: tool }); }
    catch (e) { console.warn("[extension-resume] prepare packet:", e.message); }
    return result;
  },
  preflight: (userId) => {
    if (!toolsService.configured) return "unavailable";
    const tool = resolveEntitlement(db, userId, "a_plus_default").value === true ? "a_plus_resume" : "generate";
    if (monetisationEnabled()) {
      const planTier = normalisePlanTier(db.prepare("SELECT plan_tier FROM users WHERE id = ?").pluck().get(userId));
      const allowed = resolveEntitlement(db, userId, tool === "a_plus_resume" ? "a_plus_enabled" : "generate_enabled",
        { ctx: { planTier, monetisation: true } }).value === true;
      if (!allowed) return "upgrade_required";
    }
    if (!checkLimit(db, userId, "resume_generate").allowed) return "plan_limit";
    return null;
  },
  renderPdf: htmlToPdf,
  // draft's additive check on what it serves, as the web route's kbFindings
  guardFindings: (userId, html) => {
    let findings = [];
    try { findings = validateResumeClaims(db, html); } catch { findings = []; }
    try {
      const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
      const dp = db.prepare("SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1").get(userId);
      const base = dp ? getBaseResumeRecord(db, { userId, profileId: dp.id }) : null;
      findings = findings.concat(profileContradictionFindings({ html, profile, baseResumeText: base?.content || "", domainProfile: dp }));
    } catch { /* the check is additive; it never fails a read */ }
    return findings;
  },
});
app.use(createExtensionResumeRouter({ service: extensionResume, requireAuth, isExtension: isExtensionCredential }));
// ⭐ D99 J11 · the board hands a job to the extension: the canonical address, the card and draft's own ATS report
// (routes/extensionJob.js). The same score as the approval screen — scoreBaseResumeForApply.
app.use(createExtensionJobRouter({ db, requireAuth, isExtension: isExtensionCredential,
  scoreFor: (userId, jobId) => scoreBaseResumeForApply(userId, jobId, { withReport: true }),
  scoreText: (userId, job) => scorePageTextForBase(userId, job),
  hasBaseResume: (userId) => !!extensionBaseResumeFor(db, userId) }));
// ⭐ T24 · the extension's Draft button IS the board's Draft (routes/apply.js startRun via draftForExtension) and queues the
// résumé through the same generation as above (extensionResume.start — once per job and base). The tells only the server
// holds, and the account's two intent settings (migration 168), in routes/extensionDraft.js.
app.use(createExtensionDraftRouter({ db, requireAuth, isExtension: isExtensionCredential,
  draftForExtension: applyLine.draftForExtension, draftStateOf: applyLine.draftStateOf, runBar: applyLine.runBar, resume: extensionResume }));

// ── Contact form (public — no auth required) ──────────────────
app.post("/api/contact", (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim())
    return res.status(400).json({ error: "name, email, and message are required" });
  db.prepare(`INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)`)
    .run(name.trim(), email.trim(), subject?.trim() || null, message.trim());
  res.json({ ok: true });
});

app.get("/api/admin/contact-messages", requireAdmin, (req, res) => {
  const where = req.query.unread === "1" ? "WHERE read = 0" : "";
  const rows = db.prepare(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC`).all();
  res.json(rows);
});

app.patch("/api/admin/contact-messages/:id/read", requireAdmin, (req, res) => {
  db.prepare("UPDATE contact_messages SET read = 1 WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// STANDALONE TOOL PAGES — AUTH INFRASTRUCTURE (Phase 5B)
// ═══════════════════════════════════════════════════════════════
// Placeholder OTP store (in-memory; replace with Redis/DB in production)
const _otpStore = new Map(); // contact → { otp, expiresAt }

app.post("/api/standalone/auth/google", (_req, res) => {
  // TODO: validate Google ID token with google-auth-library
  res.json({ ok: true, mock: true });
});

app.post("/api/standalone/auth/email-otp/send", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  _otpStore.set(email, { otp: "123456", expiresAt: Date.now() + 10 * 60 * 1000 });
  // TODO: send real email via SendGrid/Resend
  res.json({ ok: true, mock: true });
});

app.post("/api/standalone/auth/phone-otp/send", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });
  _otpStore.set(phone, { otp: "123456", expiresAt: Date.now() + 10 * 60 * 1000 });
  // TODO: send real SMS via Twilio
  res.json({ ok: true, mock: true });
});

app.post("/api/standalone/auth/otp/verify", (req, res) => {
  const { contact, otp } = req.body;
  if (!contact || !otp) return res.status(400).json({ error: "contact and otp required" });
  const stored = _otpStore.get(contact);
  if (!stored || stored.otp !== otp || Date.now() > stored.expiresAt) {
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }
  _otpStore.delete(contact);
  // Find or create standalone user
  const isEmail = contact.includes("@");
  let user = isEmail
    ? db.prepare("SELECT * FROM standalone_users WHERE email=?").get(contact)
    : db.prepare("SELECT * FROM standalone_users WHERE phone=?").get(contact);
  if (!user) {
    const r = isEmail
      ? db.prepare("INSERT INTO standalone_users (email) VALUES (?)").run(contact)
      : db.prepare("INSERT INTO standalone_users (phone) VALUES (?)").run(contact);
    user = db.prepare("SELECT * FROM standalone_users WHERE id=?").get(r.lastInsertRowid);
  } else {
    db.prepare("UPDATE standalone_users SET last_seen_at=unixepoch() WHERE id=?").run(user.id);
  }
  req.session.standaloneUserId = user.id;
  res.json({ ok: true, user: { id: user.id, email: user.email, phone: user.phone } });
});

app.get("/api/standalone/auth/me", (req, res) => {
  const uid = req.session?.standaloneUserId;
  if (!uid) return res.json({ authenticated: false });
  const user = db.prepare("SELECT id, email, phone, display_name FROM standalone_users WHERE id=?").get(uid);
  res.json({ authenticated: !!user, user: user || null });
});

app.post("/api/standalone/auth/logout", (req, res) => {
  req.session.standaloneUserId = null;
  res.json({ ok: true });
});

// ── STANDALONE SPEND CONTROLS ──────────────────────────────────────────
//
// ⛔ THESE ARE COST CONTROLS, NOT COMMERCIAL SURFACES. They protect the owner's bill, which is the
// only real money in this system today, and they are deliberately NOT behind the monetisation
// lever — an unmetered public endpoint that calls a paid model needs bounding whether or not the
// product is ever commercial. See shared/monetisation.js.
//
// THE QUOTA USED TO BE KEYED ON A COOKIE THE CALLER CONTROLS. An anonymous caller was counted by
// req.sessionID, so the allowance reset with a new cookie: clear site data, or open an incognito
// window, and the "1 free run per 30 days" started over. It was not a bound, it was a speed bump.
// Anonymous callers are now counted by client IP (migration 105), which is coarse — a shared
// office NAT counts as one caller — and accepted as such, because the alternative on an
// unauthenticated route is no bound at all.
//
// ANON_DAILY_SERVICE_CEILING is the backstop for the case where IP keying is itself circumvented,
// which for anyone willing to rotate addresses it can be. It caps TOTAL anonymous runs of a
// service per 24h across every caller, so the worst case is bounded by a number rather than by
// how many addresses an attacker has. It is a blunt instrument and it is meant to be: it trades
// availability for a ceiling on the bill, and the ceiling is the point.
const ANON_DAILY_SERVICE_CEILING = Number(process.env.ANON_DAILY_SERVICE_CEILING || 50);

// req.ip is trustworthy here: app.set("trust proxy", 1) above, required for Railway anyway.
// Falls back to the session id rather than to a constant — one shared bucket for every caller
// whose address could not be read would let one of them exhaust the allowance for all of them.
function anonKey(req) {
  return req.ip || req.socket?.remoteAddress || `session:${req.sessionID}`;
}

// anonMax: max uses per IP per 30 days (anonymous); userMax: max per registered user per month
function standaloneRateLimit(service, anonMax, userMax) {
  return (req, res, next) => {
    const userId    = req.session?.standaloneUserId;
    const sessionId = req.sessionID;
    const ip        = anonKey(req);
    const since     = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const dayAgo    = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    if (!userId) {
      // The global backstop is checked BEFORE the per-caller one. A caller who is inside their own
      // allowance must still be refused once the service's daily total is spent, or the ceiling
      // would only ever bind callers who were already over their individual limit — which is to
      // say, never.
      const today = db.prepare(
        "SELECT COUNT(*) as c FROM standalone_usage WHERE standalone_user_id IS NULL AND service=? AND used_at>?"
      ).get(service, dayAgo).c;
      if (today >= ANON_DAILY_SERVICE_CEILING) {
        console.warn(`[standalone] anonymous daily ceiling hit for ${service}: ${today}/${ANON_DAILY_SERVICE_CEILING}`);
        return res.status(429).json({
          error: "service_busy", service,
          message: `Free ${service} runs are at today's limit. Sign in, or try again tomorrow.`,
        });
      }
    }

    const count = userId
      ? db.prepare("SELECT COUNT(*) as c FROM standalone_usage WHERE standalone_user_id=? AND service=? AND used_at>?").get(userId, service, since).c
      : db.prepare("SELECT COUNT(*) as c FROM standalone_usage WHERE client_ip=? AND service=? AND used_at>?").get(ip, service, since).c;

    const limit = userId ? userMax : anonMax;
    if (count >= limit) {
      return res.status(429).json({
        error: "limit_reached", service, count, limit,
        message: `You have used ${count} of ${limit} free ${service} runs this month.`,
      });
    }
    db.prepare("INSERT INTO standalone_usage (standalone_user_id, session_id, service, client_ip) VALUES (?,?,?,?)")
      .run(userId || null, sessionId, service, userId ? null : ip);
    next();
  };
}

// Standalone auth guard. 401 with a machine-readable reason, so the tools page can prompt for a
// sign-in rather than showing a generic failure for what is a normal, recoverable state.
function requireStandaloneAuth(req, res, next) {
  if (req.session?.standaloneUserId) return next();
  return res.status(401).json({
    error: "standalone_auth_required",
    message: "Sign in to generate a resume. Scoring a resume stays free without an account.",
  });
}

// Multer for standalone uploads
const standaloneUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ═══════════════════════════════════════════════════════════════
// STANDALONE TOOL API ROUTES (Phase 5C)
// ═══════════════════════════════════════════════════════════════

// POST /api/standalone/ats — the public ATS tool. No account, no quota, no model call.
//
// ⛔ SAME SCORER AS THE BOARD (owner, 09-30). This used to send the résumé and the JD to Haiku with
// ATS_SYSTEM_PROMPT and print the model's own 0–100 on a ≥75/≥50 donut — a different number on a
// different scale from the one the board, the panel and the tools service's score_ats_fit use, so the
// public tool and the product could disagree about the same pair. It is now the deterministic v4
// scorer, with the same term weights and confirmed synonyms the panel uses.
//
// A BAND, NOT THE NUMBER. The response carries the band and the evidence, and no score: ρ = 0.746
// supports coarse ordering, not a printed figure (G5), and the mobile contract already marks the
// number INTERNAL. A decline is `band: "not_enough_signal"` with its reasons — never a low score.
//
// FREE AND UNLIMITED (owner, 09-30): the monthly quota (1 anonymous / 3 signed-in) existed because
// each call cost a Haiku request. It costs a PDF parse now. The 5 MB upload cap still applies.
app.post("/api/standalone/ats", standaloneUpload.single("resume"), async (req, res) => {
  const jdText = String(req.body?.jd_text || "");
  if (!req.file || !jdText.trim()) return res.status(400).json({ error: "resume PDF and jd_text required" });
  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(req.file.buffer);
    const resumeText = parsed.text?.trim();
    if (!resumeText || resumeText.length < 50) return res.status(400).json({ error: "Could not extract text from PDF" });
    res.json(standaloneAtsResult({ resumeText, jdText, jobTitle: req.body?.job_title,
                                   termWeightsFor: atsTermWeightsForJob, synonyms: atsSynonyms() }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ D141 · POST /api/standalone/honesty — THE RÉSUMÉ HONESTY CHECK. Free, no account (the hook: "Will your AI résumé get
// you caught?"). The résumé (PDF `resume` or `resume_text`), optionally the original it came from (`original` /
// `original_text`) and the job (`jd_text`); line by line, what the original does not support, the interview risk, and the
// fix (services/honestyCheck.js). ⛔ Nothing is kept: the files are parsed in memory and the text is never written —
// not to the database, not to a log line. No model call (D17).
app.post("/api/standalone/honesty", standaloneUpload.fields([{ name: "resume", maxCount: 1 }, { name: "original", maxCount: 1 }]), async (req, res) => {
  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const textOf = async (field) => {
      const f = req.files?.[field]?.[0];
      if (f) return ((await pdfParse(f.buffer)).text || "").trim();
      return String(req.body?.[`${field}_text`] || "").slice(0, 60000).trim();
    };
    const resumeText = await textOf("resume");
    if (resumeText.length < 50) return res.status(400).json({ error: "resume_required", message: "Upload the résumé as a PDF, or paste its text." });
    const originalText = await textOf("original");
    const jdText = String(req.body?.jd_text || "").slice(0, 30000);
    const keywordsFor = (text) => {
      const a = standaloneAtsResult({ resumeText: text, jdText, jobTitle: req.body?.job_title, termWeightsFor: atsTermWeightsForJob, synonyms: atsSynonyms() });
      return { matched: a.matched_skills, missing: a.missing_skills };
    };
    res.json(honestyCheck({ resumeText, originalText, jdText, keywordsFor }));
  } catch (e) {
    res.status(422).json({ error: "honesty_check_failed", message: "That file could not be read. Paste the text instead." });
  }
});

// POST /api/standalone/generate — Generate resume (requires STANDALONE auth, not main-app auth)
//
// ⛔ THE ONE ANONYMOUS SURFACE WORTH CLOSING OUTRIGHT. This runs Sonnet at 8192 max_tokens and
// was the largest per-call cost in the system reachable by anyone with a browser.
// /api/standalone/ats stays anonymous on purpose: it is Haiku at 900 max_tokens, it is the hook
// that makes the tools pages worth visiting, and a free ATS score costs little enough to give
// away. A free tailored resume does not. Requiring a standalone account here costs almost nothing
// in funnel terms — the caller has already uploaded a resume by this point — and removes the
// expensive unauthenticated surface entirely.
//
// requireStandaloneAuth runs BEFORE the rate limiter, so an anonymous caller is refused without
// writing a usage row. anonMax is 0 rather than 1 to say the anonymous allowance is gone, instead
// of leaving a number behind that reads like one.
app.post("/api/standalone/generate", requireStandaloneAuth, standaloneRateLimit("generate", 0, 2), standaloneUpload.single("resume"), async (req, res) => {
  const jdText = req.body?.jd_text || "";
  if (!req.file || !jdText.trim()) return res.status(400).json({ error: "resume PDF and jd_text required" });
  if (!toolsService.configured) {
    const { status, body } = httpErrorFor(new ToolsServiceError("The résumé tools service is not configured on this server",
      { code: "tools_service_unconfigured", retryable: false, permanent: true }));
    return res.status(status).json(body);
  }

  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(req.file.buffer);
    const resumeText = parsed.text?.trim();
    if (!resumeText || resumeText.length < 50) return res.status(400).json({ error: "Could not extract text from PDF" });

    // A4 — through the tools service, which classifies (no job profile here) and — ⛔ NEW FOR THIS
    // ROUTE — runs the claim guard. This path used to assemble its own prompt and call the model
    // directly, so its résumés never passed the guard: the AG3 test that "every resume-generating
    // path funnels through coreGenerateResume" counted that function's callers and could not see it.
    // With no profile, the years check is skipped and the seniority ceiling is the base résumé's.
    // It also now returns the deterministic render rather than the model's raw HTML.
    const includeSummary = req.body?.include_summary === true || req.body?.include_summary === "true";
    const fakeJob = { title: "Role", company: "Company", description: jdText, category: "", stack: "" };
    let generated;
    const meter = { userId: SYSTEM_USER_ID, eventSubtype: "standalone",
      renamePurpose: { resume_generate: "standalone_generate" } };
    try {
      generated = await toolsService.generate({
        mode: "GENERATE", candidate: {}, profile: null, claims: null, employers: [],
        job: fakeJob, baseResumeText: resumeText, options: { includeSummary },
      });
    } catch (e) {
      recordToolsServiceUsage(db, e?.usage, { ...meter, requestError: e?.code });
      throw e;
    }
    recordToolsServiceUsage(db, generated.usage, meter);
    const html = generated.html;


    // The fit of the generated résumé — the SAME deterministic scorer and bands as
    // /api/standalone/ats and the board (D17, A80 V2). This used to be a Haiku call returning the
    // model's own 0–100, which the page then cut with the product's band cutpoints: a different
    // scale read through the wrong thresholds. Terms and a band, no number (as /api/standalone/ats).
    const cachedText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const ats = standaloneAtsResult({ resumeText: cachedText, jdText, jobTitle: req.body?.job_title,
                                      termWeightsFor: atsTermWeightsForJob, synonyms: atsSynonyms() });

    res.json({ html, ats });
  } catch(e) {
    noteGenerationFailure(e, "standalone");
    const { status, body } = httpErrorFor(e, "Resume generation failed");
    res.status(status).json(body);
  }
});

// POST /api/standalone/apply — auto-apply (requires standalone auth)
app.post("/api/standalone/apply",
  (req, res, next) => { if (!req.session?.standaloneUserId) return res.status(401).json({ error: "Authentication required" }); next(); },
  standaloneRateLimit("apply", 0, 2),
  standaloneUpload.single("resume"),
  async (req, res) => {
    // Delegates to the same apply logic as the main app via applyRoutes
    // For now: return a structured response indicating the run was accepted
    res.json({ ok: true, results: [], message: "Apply automation not yet wired for standalone mode" });
  }
);

// ═══════════════════════════════════════════════════════════════
// ── Cover Letter Generation ────────────────────────────────────────────────────
app.post("/api/cover-letter/generate", requireAuth, async (req, res) => {
  const { resumeText, jobDescription, tone = "professional", jobTitle, company } = req.body;
  if (!resumeText) return res.status(400).json({ error: "resumeText is required" });
  // A88: this route DOES call the model directly (callModel, purpose cover_letter), so the key
  // check stays — but a missing setting is the server's configuration, not a crash: 503, said
  // plainly, not retryable. The setting's name goes to the operator's log, not the user's screen.
  if (!ANTHROPIC_KEY) {
    console.warn("[cover-letter] refused: ANTHROPIC_KEY is not set");
    return res.status(503).json({ error: "Cover letters are unavailable right now.",
      code: "model_unconfigured", retryable: false, detail: "Retrying will not help until this is fixed on the server." });
  }

  const resumeTrimmed = resumeText.trim();
  if (resumeTrimmed.length < 50) {
    return res.status(400).json({ error: "Resume is too short to generate a cover letter." });
  }

  const toneMap = {
    professional: "formal and professional",
    conversational: "warm and personable while remaining professional",
    enthusiastic: "energetic and passionate about the opportunity",
  };
  const toneDesc = toneMap[tone] || toneMap.professional;

  const targetLine = [jobTitle, company].filter(Boolean).join(" at ");
  // ⛔ D173 (1): the posting is UNTRUSTED — fenced, the rule in the system prompt, the letter checked (services/coverLetterPrompt.js).
  const clReq = buildCoverLetterRequest({ resumeText: resumeTrimmed, targetLine, jobDescription: jobDescription || "", toneDesc });

  try {
    const message = await callTask({
      task: "cover_letter.write", anthropic, db, purpose: "cover_letter", userId: req.user.id, company: company || null,
      // CANDIDATE: the candidate's resume and profile. Never routed off Anthropic.
      dataClass: DATA_CLASS.CANDIDATE,
      system: clReq.system,
      messages: clReq.messages,
    });
    const text = message.content?.[0]?.text || "";
    const check = checkCoverLetter(text, { resumeText: resumeTrimmed, untrusted: clReq.untrusted });
    if (text && !check.ok) {
      console.warn(`[cover-letter] withheld (D173): ${describeViolations(check.violations)}`);
      return res.status(422).json({ error: "This cover letter was withheld: it carried a link or contact detail that isn't in your résumé, or text the posting asked for. Try again.",
        code: "untrusted_output_violation", retryable: true });
    }
    res.json({ success: true, coverLetter: text });
  } catch (err) {
    console.error("[cover-letter] Anthropic error:", err.message);
    res.status(500).json({ error: "Failed to generate cover letter. Please try again." });
  }
});

// HEALTH + SPA
// ═══════════════════════════════════════════════════════════════
app.get("/api/health", (_req,res) => res.json({ ok:true, time:new Date().toISOString() }));
// ⛔⛔ D151 Rule 1: /live = the process is up (answers the moment the port binds); /ready = the database answers AND the
// boot warm-up has run — Railway's healthcheck (railway.toml), so a deploy takes traffic only when ready, never mid-warm-up.
app.get("/api/health/live", (_req, res) => res.json({ ok: true, state: BOOT.state, uptimeMs: Math.round(process.uptime() * 1000) }));
app.get("/api/health/ready", (_req, res) => { let dbOk = false; try { dbOk = db.prepare("SELECT 1 AS one").get()?.one === 1; } catch { /* reported below */ }
  const s = BOOT.snapshot();
  if (BOOT.ready && dbOk) return res.json({ ok: true, listenMs: s.listenMs, readyMs: s.readyMs });
  res.status(503).json({ ok: false, error: dbOk ? "warming up" : "database not answering", state: s.state, pending: s.pending }); });
// D86 §6: RFC 9116 security.txt — the security contact the connector directory requires (shared/brand.js).
app.get("/.well-known/security.txt", (_req, res) => res.type("text/plain").send(securityTxt()));

// PUBLIC, AND DELIBERATELY SO. The marketing pages that carry the commercial copy — /pricing,
// /features, /how-it-works — are reachable logged out, so the client has to be able to learn the
// lever's state before it knows who (or whether) anyone is signed in. Requiring auth here would
// mean an anonymous visitor rendering the default, and the default has to be "hide", which would
// then hide the pricing page from logged-out visitors even with monetisation ON.
//
// This is the client's ONLY source for the flag. It is not baked into the bundle at build time,
// because a client built with one value and served by a server holding the other is exactly the
// two-sources-of-truth failure shared/monetisation.js forbids.
// ⭐ D133 · whether Settings → Appearance offers the Studio theme to users — off until the owner turns it on in
// Admin → System → Appearance. Public like the rest of /api/config: one boolean about the product, nothing user-scoped.
const STUDIO_FOR_USERS_KEY = "studio_for_users";
const studioForUsers = () => { try { return getSetting(db, STUDIO_FOR_USERS_KEY) === "1"; } catch { return false; } };
// ⭐ D144 · Dusk likewise — its own switch, off by default ("Dusk offered to users only when the owner switches it on").
const DUSK_FOR_USERS_KEY = "dusk_for_users";
const duskForUsers = () => { try { return getSetting(db, DUSK_FOR_USERS_KEY) === "1"; } catch { return false; } };
app.get("/api/config", (_req, res) => res.json({ monetisationEnabled: monetisationEnabled(), studioForUsers: studioForUsers(), duskForUsers: duskForUsers() }));
app.get("/api/admin/appearance", requireAdmin, (_req, res) => res.json({ studioForUsers: studioForUsers(), duskForUsers: duskForUsers() }));
app.post("/api/admin/appearance", requireAdmin, (req, res) => {
  // Each switch is changed only when the body names it (an older client sends studioForUsers alone).
  const flip = (key, v) => { if (typeof v !== "boolean") return; if (v) setSetting(db, key, "1"); else clearSetting(db, key); };
  try { flip(STUDIO_FOR_USERS_KEY, req.body?.studioForUsers); flip(DUSK_FOR_USERS_KEY, req.body?.duskForUsers); }
  catch (e) { return res.status(500).json({ error: "error", message: e.message }); }
  res.json({ studioForUsers: studioForUsers(), duskForUsers: duskForUsers() });
});

// ── AH-1: WHAT IS ACTUALLY RUNNING ─────────────────────────────────────────────
//
// This exists because answering "is X deployed?" has repeatedly cost an archaeology pass, and has
// repeatedly been answered WRONG. docs/NEXT_WORK.md carried a banner saying six commits were
// undeployed while all six were live; the cleanup brake was "confirmed deployed" by a probe that
// only ever saw the SPA catch-all; and a policy was verified against a page whose text lives in a
// JS bundle. The standing lesson is "assert a JSON key, never a 200" — this is the JSON key.
//
// ⛔ IT MUST NEVER REPORT A COMMIT IT IS NOT SURE OF. A confidently wrong SHA is worse than no
// SHA: it ends the investigation with the wrong answer, which is exactly the failure mode above.
// So `commit` is null and `commitSource` is "unknown" when it cannot be established, and the
// caller can tell the difference.
function resolveCommit() {
  // Platform-injected first. Railway sets RAILWAY_GIT_COMMIT_SHA on every build; the others are
  // here so this keeps working if the host changes, rather than silently returning to "unknown".
  for (const key of ["RAILWAY_GIT_COMMIT_SHA", "SOURCE_COMMIT", "GIT_COMMIT", "VERCEL_GIT_COMMIT_SHA"]) {
    const v = process.env[key];
    if (v && /^[0-9a-f]{7,40}$/i.test(v.trim())) return { commit: v.trim().slice(0, 7), commitSource: key };
  }
  // Local checkouts: read .git directly rather than shelling out to git, which may not exist in a
  // container and would be a process spawn on a route that should be free to call.
  try {
    const head = fs.readFileSync(path.join(__dirname, ".git", "HEAD"), "utf8").trim();
    const ref = head.startsWith("ref: ") ? head.slice(5).trim() : null;
    const sha = ref
      ? fs.readFileSync(path.join(__dirname, ".git", ref), "utf8").trim()
      : head;
    if (/^[0-9a-f]{40}$/i.test(sha)) return { commit: sha.slice(0, 7), commitSource: "git" };
  } catch { /* not a checkout, or .git not copied into the image */ }
  return { commit: null, commitSource: "unknown" };
}
// The contract version is READ from the contract, not restated here. A second copy of "1.1.1"
// in this file is the two-sources-of-truth shape this repo keeps getting bitten by, and it would
// drift the moment generateMobileContract.mjs bumps the real one.
function resolveContractVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "contract", "mobile-api.v1.json"), "utf8"))?.info?.version ?? null;
  } catch { return null; }
}
const CONTRACT_VERSION = resolveContractVersion();
const BUILD_INFO = { ...resolveCommit(), startedAt: new Date().toISOString() };
console.log(`[boot] version: commit ${BUILD_INFO.commit || "unknown"} (${BUILD_INFO.commitSource})`);

app.get("/api/version", (_req, res) => {
  // ⛔ NOT `ORDER BY id DESC`. The ids are TEXT and the table holds both numbered migrations and
  // legacy named ones — `contact_messages` sorts after `105_...`, so ordering by id reports a
  // migration from years ago as the newest. Ordering by applied_at answers "what ran last", and
  // the numeric high-water mark answers "has NNN landed", which is the question actually asked.
  let migrations = { count: null, latestApplied: null, highestNumbered: null };
  try {
    // rowid is the tie-break, and it is load-bearing. On a freshly migrated database every row
    // gets the same applied_at second, so ordering by applied_at alone resolved the tie
    // arbitrarily and reported `001_initial_schema` as the most recent migration — a confidently
    // wrong answer, which is the exact failure this endpoint exists to stop. rowid is insertion
    // order, which is application order.
    const rows = db.prepare("SELECT rowid AS seq, id, applied_at FROM schema_migrations").all();
    const numbered = rows
      .map(r => ({ id: r.id, n: /^(\d+)_/.test(r.id) ? Number(r.id.match(/^(\d+)_/)[1]) : null }))
      .filter(r => r.n !== null)
      .sort((a, b) => a.n - b.n);
    migrations = {
      count: rows.length,
      latestApplied: rows.slice().sort((a, b) => (b.applied_at - a.applied_at) || (b.seq - a.seq))[0]?.id ?? null,
      highestNumbered: numbered.length ? numbered[numbered.length - 1].id : null,
    };
  } catch { /* reported as nulls rather than failing the endpoint */ }

  // ⛔ "IS THE SCORER ACTUALLY WEIGHTED?" WAS NOT ANSWERABLE FROM OUTSIDE, and the answer in
  // production was no. ats_term_weights was empty, the only warning in the codebase required a
  // non-empty table to fire, and every score served was unweighted in silence. This endpoint
  // already exists to answer "what is deployed" in one curl; the scorer's degraded mode belongs
  // in the same breath, because a deployment that is scoring unweighted is not the deployment
  // anyone thinks they shipped.
  //
  // Deliberately not behind auth: it carries no term, no weight and no posting — a state name, a
  // count and an age, which is exactly what the rest of this response already is.
  let atsWeights = { state: "unknown" };
  try {
    const w = atsWeightStatus(db);
    atsWeights = {
      state: w.state,                                   // fresh | stale | absent
      weightedScoring: w.state === "fresh",             // the question, answered directly
      terms: w.terms,
      families: w.families,
      ageDays: w.ageDays == null ? null : Number(w.ageDays.toFixed(1)),
      corpusSize: w.corpusSize,
      refreshAtDays: REFRESH_WEIGHT_AGE_DAYS,
      refusedAtDays: MAX_WEIGHT_AGE_DAYS,
      // ⛔ "fresh" answers whether the TABLE is usable, not whether the mechanism that keeps it
      // that way still works. A refresh failing every night looks identical to one that has not
      // been due, right up until the 45-day refusal drops the scorer to unweighted. This is the
      // difference, and it is the last open item in docs/ATS_TERM_WEIGHTS_SCHEDULE.md §7.
      refresh: termWeightRefreshHealth(),
    };
  } catch (e) { atsWeights = { state: "unknown", error: e.message }; }

  res.json({
    ...BUILD_INFO,
    contract: CONTRACT_VERSION,
    migrations,
    atsWeights,
    // ⭐ 44p: the Atlas live-count backlog — a number, nothing user-scoped. The deck bug's cause was this queue drained
    // whole on the request path; the background drainer now counts it, and this says how much is left.
    atlasQueue: atlasQueueLength(db),
    // A126 · the board's read workers: ready / served / fallback — fallback climbing means the workers are not serving.
    readPool: readPool.status(),
    scorePool: scorePool.status(),
    // ⛔⛔ D153 (3): the backlog classification walk — state, writes, and the coverage it measured (shown share of the
    // active board; share of the shown board with a kind of work). Counts only, nothing user-scoped.
    classify: classifyBacklog.status(),
    // ⭐ D151 Rule 1: the last boot's timeline — start → listen, → ready, and each warm-up step's duration.
    boot: BOOT.snapshot(),
    monetisationEnabled: monetisationEnabled(),
  });
});


// ── Profile isolation diagnostic ─────────────────────────────
app.get("/api/debug/verify-isolation", requireAuth, (req, res) => {
  const userId  = req.user.id;
  const profile = db.prepare(
    "SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1"
  ).get(userId);
  const wrongJobs = profile ? db.prepare(`
    SELECT sj.title, uj.domain_profile_id, sj.domain_profile_id as scraped_domain_profile_id
    FROM user_jobs uj JOIN scraped_jobs sj ON sj.job_id=uj.job_id
    WHERE uj.user_id=?
      AND (uj.domain_profile_id != ? OR sj.domain_profile_id != ?)
    LIMIT 10
  `).all(userId, profile.id, profile.id) : [];
  const totalJobs   = db.prepare("SELECT COUNT(*) as c FROM user_jobs WHERE user_id=?").get(userId);
  const profileJobs = profile
    ? db.prepare("SELECT COUNT(*) as c FROM user_jobs WHERE user_id=? AND domain_profile_id=?").get(userId, profile.id)
    : { c: 0 };
  res.json({
    activeProfile:        profile?.profile_name ?? null,
    totalJobsInPool:      totalJobs.c,
    jobsMatchingProfile:  profileJobs.c,
    wrongJobsStillPresent: wrongJobs.length,
    wrongJobSamples:      wrongJobs,
    isolated:             wrongJobs.length === 0,
  });
});

// ⛔ D75: the page the crawler's User-Agent names — what it is, what it reads, and how to be excluded.
app.get("/crawler", (_req, res) => {
  res.type("html").send(CRAWLER_PAGE_HTML);
});
app.get("*", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

// ⛔ D33 · ONE STRAY PROMISE MUST NOT TAKE THE WHOLE SITE TO 502. Node 15+ exits on an unhandled
// rejection, and Express 4 does not catch a rejected async handler — so a single throw in any async
// route killed the process, and until Railway restarted it EVERY page, /extension included, was the
// edge's 502 (nothing the app itself can send for a document: its only 502s are under /api/).
// Logged loudly with the stack instead, and the process keeps serving.
process.on("unhandledRejection", (reason) => {
  console.error("[process] ⛔ UNHANDLED REJECTION — logged, process kept alive:", reason?.stack || reason);
});

console.log(`[boot] binding HTTP listener on :${PORT}`);
app.listen(PORT, () => {
  BOOT.listening();
  console.log(`[server] ${BRAND} v5 on :${PORT} (listening ${BOOT.snapshot().listenMs} ms after start)`);
  // Warm up browser availability probe in background so /api/integrations/status
  // returns a cached result without delay on first user request.
  // ⭐ 44p · the Atlas live-count queue drains HERE, in the background, in slices that yield — never whole on a request
  // (services/atlas/atlasLive.js: one whole drain held the loop for minutes after A112's crawler boost).
  const queued = atlasQueueLength(db);
  if (queued) console.log(`[atlas live] ${queued} posting(s) queued at boot — counted in the background`);
  startAtlasDrainer(db);
  console.log("[boot] scheduling background browser probe");
  probeBrowserAvailability().then(r => {
    if (r.available) console.log(`[server] browser ready — source=${r.source}`);
    else console.warn(`[server] browser unavailable — ${r.reasonCode}: ${r.error}`);
  }).catch(() => {});
  // Run startup cleanup to expire any stale jobs that accumulated while server was
  // down and the 03:00 cron window was missed.
  // ⛔ D151 Rule 1: the last warm-up step, so /api/health/ready stays 503 until it has run — production's took 8 s
  // (job-history 3.5 s + ghost-score 4.5 s) right AFTER the healthcheck had switched traffic (11-03 23:35Z dial timeouts).
  BOOT.add("startup expired-jobs cleanup", () => {
    console.log("[boot] running startup expired-jobs cleanup");
    try { runExpiredJobsCleanup(); }
    catch(e) { console.warn("[cleanup] startup cleanup failed:", e.message); }
  });
  // The board's fit, reconciled once after boot. Incremental, so on every boot after the first it
  // is one plan per active profile and "nothing to do". It is what backfills a deployment
  // that gained migration 110 with users already on it — without it their boards would sit on
  // "not established" until the 04:00 crawl. BOARD_FIT_PRECOMPUTE=off disables it with every other
  // automatic trigger.
  // ⛔ A123 (7): the delay counts from READY, not from listen. On a timer from listen it landed inside the
  // warm-up (production 11-04 21:24Z: ≈ 18 s of plans, user 3's alone 13.9 s, between job_role_map and
  // the tag slice) — and every request in a deploy window waits for ready. The plan itself now yields
  // between pages (services/jobs/boardFitPrecompute.js planSliced).
  BOOT.run().then(() => setTimeout(() => {
    if (!boardFitAutomationEnabled()) {
      console.log("[board-fit] boot pass: DISABLED by BOARD_FIT_PRECOMPUTE=off");
      return;
    }
    scheduleBoardFitForAll("boot");
  }, Number(process.env.BOARD_FIT_BOOT_DELAY_MS ?? 30000)).unref?.()).then(() => {
    // ⛔⛔ D153 (3): the backlog classification walk, from READY (never inside the warm-up; it yields between pages).
    // On the same ready as the board-fit pass — the warm-up is started once (test/a123BoardFitReconcile A123 (7)).
    // ⛔ A140 (1): the removed trial's fictional sample details out of every profile — small (one row per account),
    // idempotent, once per boot on ready.
    try { stripSampleProfiles(db); } catch (e) { console.warn("[a140] sample strip:", e.message); }
    classifyBacklog.run("boot");
  });
});





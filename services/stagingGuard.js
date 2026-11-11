// ⛔ A188 (46g, owner 11-11: "approved … build the guard") · STAGING NEVER ACTS AS PRODUCTION.
//
// docs/STAGING_PLAN.md: the staging environment is a Railway DUPLICATE of production, and a duplicate carries every
// production variable — the live Stripe key, the mail key, the model key, the OAuth secrets. The plan changes them before
// the staged deploy is approved; this guard is what makes a missed one stop the BOOT instead of charging, emailing or
// texting a real person, crawling real employers twice, or spending the production model key.
//
// With DRAFT_ENV=staging:
//   · REFUSED (the server exits before it listens): a live-looking credential — any Stripe key that is not a TEST key,
//     the mail / SMS / push / paid-feed / OAuth secrets, a cookie domain, alert webhooks — and any URL variable that
//     names the live site's host; a model key whose label is not STAGING_MODEL_KEY_LABEL.
//   · FORCED OFF (set before anything reads them): discovery, the daily employer-board crawl, billing, marketing sends,
//     Hirebase, the reminder / match-alert / network-digest timers, market week, full-auto submission, the crawler worker
//     in dry run.
//   · MARKED: /api/version reports env "staging"; every response carries X-Robots-Tag: noindex, nofollow and robots.txt
//     disallows everything (server.js).
// Without DRAFT_ENV=staging nothing here changes anything.
import { CANONICAL_HOST, LEGACY_HOST } from "../shared/brand.js";

export const STAGING_MODEL_KEY_LABEL = "draft-staging";

/** Must be BLANK on staging — each one reaches a real person, a paid account or a production system. */
export const STAGING_MUST_BE_BLANK = Object.freeze([
  // messages to real people
  "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "RESEND_INBOUND_SECRET",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID",
  "VAPID_PRIVATE_KEY",
  // paid feeds / APIs
  "HIREBASE_API_KEY", "HIREBASE_KEY", "SERPAPI_KEY", "ADZUNA_APP_KEY", "MYSOURCE_API_KEY", "GITHUB_TOKEN",
  // production's OAuth apps (staging gets its own, later)
  "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_OAUTH_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  // cookies shared with the live site; alerts into production's channels
  "COOKIE_DOMAIN", "PIPELINE_ALERT_WEBHOOK", "USAGE_FAILURE_WEBHOOK_URL",
]);

/** Must not name the live site — a staging link, callback or service call must never land on production. */
export const STAGING_URL_VARS = Object.freeze([
  "APP_BASE_URL", "FRONTEND_URL", "RESUME_MASTER_URL", "CRAWLER_DRAFT_URL",
  "GOOGLE_CALLBACK_URL", "GOOGLE_OAUTH_REDIRECT_URI", "LINKEDIN_CALLBACK_URL", "LINKEDIN_OAUTH_REDIRECT_URI",
  "GITHUB_CALLBACK_URL", "EXTENSION_DOWNLOAD_URL",
]);

/** Forced on staging, whatever the duplicate carried. Each value is what its reader treats as OFF. */
export const STAGING_FORCED = Object.freeze({
  DISCOVERY_PAUSED: "1",              // server.js seed import, discovery jobs (/^(1|true|yes|on)$/)
  JOB_CRAWL: "off",                   // services/jobs/aggregator.js cacheJobs — the daily employer-board crawl
  BILLING_ENABLED: "",                // services/billing/config.js truthy()
  BILLING_LIVE_CONFIRMED: "",
  MARKETING_SENDS_ENABLED: "",        // only "1|true|yes|on" sends
  HIREBASE_ENABLED: "",
  DAILY_REMINDERS: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", MARKET_WEEK: "off",
  APPLY_FULL_AUTO_DISABLED: "1",      // services/appSettings.js — the env default a fresh database inherits
  CRAWLER_DRY_RUN: "1",
});

const blank = (v) => v == null || String(v).trim() === "";
const LIVE_HOSTS = [CANONICAL_HOST, LEGACY_HOST].map(h => String(h).toLowerCase());
function namesLiveHost(v) {
  const s = String(v || "").toLowerCase();
  return LIVE_HOSTS.some(h => s.includes(`//${h}`) || s.includes(`.${h}`) || s === h);
}

export const isStaging = (env = process.env) => String(env.DRAFT_ENV || "").trim().toLowerCase() === "staging";

/** What staging would refuse and force — pure, for the boot and the tests. Values are never returned, only names. */
export function checkStaging(env = process.env) {
  if (!isStaging(env)) return { staging: false, refused: [], forced: {} };
  const refused = [];
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]) {
    const v = String(env[k] || "").trim();
    if (!v) continue;
    if (k === "STRIPE_WEBHOOK_SECRET") { refused.push(`${k}: set (staging uses no production Stripe webhook)`); continue; }
    if (!/^(sk|pk|rk)_test_/.test(v)) refused.push(`${k}: not a Stripe TEST key`);
  }
  for (const k of STAGING_MUST_BE_BLANK) if (!blank(env[k])) refused.push(`${k}: must be blank on staging`);
  for (const k of STAGING_URL_VARS) if (!blank(env[k]) && namesLiveHost(env[k])) refused.push(`${k}: names the live site`);
  if (!blank(env.ANTHROPIC_KEY) && String(env.ANTHROPIC_KEY_LABEL || "").trim() !== STAGING_MODEL_KEY_LABEL) {
    refused.push(`ANTHROPIC_KEY: its label must be "${STAGING_MODEL_KEY_LABEL}" (a capped staging key), not "${String(env.ANTHROPIC_KEY_LABEL || "").trim() || "(none)"}"`);
  }
  return { staging: true, refused, forced: { ...STAGING_FORCED } };
}

/** At boot: refuse (exit 1) or force the switches into env. Returns checkStaging's answer. */
export function applyStagingGuard(env = process.env, { exit = (code) => process.exit(code), log = console } = {}) {
  const r = checkStaging(env);
  if (!r.staging) return r;
  if (r.refused.length) {
    log.error(`[staging] ⛔ REFUSED TO START — ${r.refused.length} production setting(s) on a staging deploy (docs/STAGING_PLAN.md §4):`);
    for (const line of r.refused) log.error(`[staging]   · ${line}`);
    exit(1);
    return r;
  }
  for (const [k, v] of Object.entries(r.forced)) env[k] = v;
  log.log(`[staging] DRAFT_ENV=staging — forced off: ${Object.keys(r.forced).join(", ")}; noindex on every response`);
  return r;
}

# Staging — the plan (APPROVED 11-11; guard BUILT `47d3bcd8`; staging CREATED 11-11 21:04Z — see §11)

46g, 2026-11-11 (WORKLOG A188). The owner: *"we would soon need to separate deploys for users and testing and also A/B"* — then *"start with staging, draft it first"*.

**What staging is for:** every scale measurement (A175 / A187), every real-browser walk and every risky change runs on production-class hardware **before** it reaches people — never against the live site, never on the 8 GB laptop's paging numbers. Later it is where A/B variants and rollouts are rehearsed.

## 1 · What exists today (measured 11-11 with Railway's `describe-environment`)

Project `resume-master`, one environment `production`, three services — all deploy from `main`:

| Service | Repo | Volume | Role |
|---|---|---|---|
| `draft` | Sri-Yellela/draft | `draft-data` 50 GB at `/app/data` (DB 6.2 GB + 7 backups) | the site and API |
| `resume-master` | Sri-Yellela/resume-master | `resume-master-data` 5 GB | the résumé tools service (accounts, credits, documents) |
| `crawler` | Sri-Yellela/draft | none | D75's discovery worker; polls draft's `/api/crawler/next` |

Production: 24 vCPU / 24 GB a service (limits), average use 0.11 vCPU over 7 days.

## 2 · The shape

- A second Railway environment **`staging`**, created with **Duplicate environment** from `production`. Railway copies the services, variables and config and **stages** the deploys — nothing runs until they are approved. ⛔ The copy includes every live key; section 4 is changed **before** approving.
- Each staging service gets its **own, new volume** (empty — production's data is not copied; section 5).
- **Branches:** `staging` deploys to the staging environment, `main` to production. The flow: work lands on `staging` → its suite / walks / scale run there → merged to `main` on the owner's word (the existing "push" rule moves to the merge). Railway PR environments (one per pull request, deleted on close) are a later step.
- **Domain:** the Railway-generated `*.up.railway.app` domain for staging — **not** a subdomain of the live domain (keeps cookies, OAuth and search engines apart). `robots.txt` on staging says `Disallow: /` (see §6).

## 3 · Per service

| Service | In staging |
|---|---|
| `draft` | deployed, new volume **10 GB** to start (synthetic data ≈ 1.5–3 GB + online backups) |
| `resume-master` | deployed with its own new volume, so staging never writes production's accounts / credits / documents; draft-staging's `RESUME_MASTER_URL` → it |
| `crawler` | **not deployed** at first (D75 stays paused anyway); if deployed later, `CRAWLER_DRAFT_URL` = staging's URL and `CRAWLER_DRY_RUN=1` |

## 4 · Variables — what changes in staging (names only; values never written here)

The code reads 134 names (`grep env.X` over server.js, routes, services, shared, crawler, packages). Grouped by what they would do from staging with production's value:

| Group | Names | In staging |
|---|---|---|
| **Takes money / bills people** | `STRIPE_SECRET_KEY` `STRIPE_PUBLISHABLE_KEY` `STRIPE_WEBHOOK_SECRET` `BILLING_ENABLED` `BILLING_LIVE_CONFIRMED` | **blank** (billing off); Stripe TEST keys only if billing itself is being tested |
| **Messages real people** | `RESEND_API_KEY` `RESEND_WEBHOOK_SECRET` `RESEND_INBOUND_SECRET` `EMAIL_FROM` `PASSWORD_RESET_FROM` `MARKETING_SENDS_ENABLED` `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_VERIFY_SERVICE_SID` `VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` `DAILY_REMINDERS` `MATCH_ALERTS` `NETWORK_DIGEST` | **blank / off** — with no Resend key the reset link shows in the app (emailService), with no VAPID push is not offered (webPush), with no Twilio phone checks are off |
| **Spends on paid APIs** | `ANTHROPIC_KEY` `ANTHROPIC_KEY_LABEL` `HIREBASE_API_KEY` `HIREBASE_KEY` `HIREBASE_ENABLED` `SERPAPI_KEY` `ADZUNA_APP_ID` `ADZUNA_APP_KEY` `MYSOURCE_API_KEY` | model: a **separate staging key with a low monthly cap**, label `draft-staging`; Hirebase / SerpAPI / Adzuna **blank** (`HIREBASE_ENABLED` off) |
| **Signs people in** | `GOOGLE_*` `LINKEDIN_*` `GITHUB_CLIENT_ID` `GITHUB_CLIENT_SECRET` `GITHUB_CALLBACK_URL` | **blank** at first (password sign-in only); later a separate staging OAuth app per provider with staging's callback URL |
| **Secrets that sign things** | `SESSION_SECRET` `PASSWORD_RESET_SECRET` `APPLY_GATE_TOKEN_SECRET` `OG_IMAGE_SECRET` `RESUME_MASTER_TOKEN` `CRAWLER_TOKEN` `RAILWAY_WEBHOOK_TOKEN` | **new values** (a production session / token must not work on staging, nor the reverse) |
| **Where things point** | `APP_BASE_URL` `FRONTEND_URL` `COOKIE_DOMAIN` `RESUME_MASTER_URL` `GOTENBERG_URL` `REDIS_URL` `CRAWLER_DRAFT_URL` `EXTENSION_DOWNLOAD_URL` `EXTENSION_STORE_URL` | staging's own URLs; `COOKIE_DOMAIN` **blank** (host-only cookies) |
| **Alerts to people / systems** | `PIPELINE_ALERT_WEBHOOK` `USAGE_FAILURE_WEBHOOK_URL` `ADMIN_OWNER_EMAIL` `DRAFT_ADMIN_REPORTS` | blank, or a staging channel |
| **Reaches other sites** | `DISCOVERY_PAUSED` `PIPELINE_PAUSED_SOURCES` `BOARD_FIT_PRECOMPUTE` | `DISCOVERY_PAUSED=1`; the posting feeds paused (staging never crawls employers — production already does, and a second crawler doubles their load) |
| **Everything else** | `DRAFT_READ_WORKERS_SIZE`, `BG_JOBS`, `READ_SLOW_MS`, the `DRAFT_*` switches … | copied as production has them — staging must behave like production; `READ_SLOW_MS` may be set for measurement |

**The guard in code (BUILT `47d3bcd8`, `services/stagingGuard.js`, test `a188StagingGuard`; staging sets `DRAFT_ENV=staging`):** `DRAFT_ENV=staging` makes the server **refuse to start** if any live-looking credential is present (a `sk_live_` Stripe key, the production model-key label or fingerprint, a Resend / Twilio / VAPID / Hirebase key, a `COOKIE_DOMAIN`) and forces the kill switches on (`DISCOVERY_PAUSED`, billing off, marketing sends off). A mistake in the variable table then stops the boot instead of emailing real people. `/api/version` reports `env: staging`; every page shows a small "staging" mark.

## 5 · Data — synthetic only

- ⛔ **Production's database is never copied to staging.** It holds real people's résumés, answers and messages (CLAUDE.md: test data uses SYNTHETIC people), and a copy outlives any later deletion.
- Staging is seeded with the **synthetic 100k fixture** (`scripts/scaleFixture.mjs` — 100,000 synthetic postings, 20 synthetic users with scores) built ON staging as a one-off command, plus the synthetic walk accounts the real-Chrome walks already use.
- Measurements then compare like with like: the same fixture locally and on staging; production only through its own logs and metrics.
- Later (with Postgres, A187 Stage 1): a **scrubbed** branch of production (people replaced by synthetic ones, postings kept — postings are public) if realistic data is needed.

## 6 · What else must not leak out of staging

- `robots.txt` `Disallow: /` and `X-Robots-Tag: noindex` on every response (staging must never be indexed beside the live site).
- No sitemap pings, no IndexNow / search-engine submissions.
- The browser extension's published build keeps pointing at production; a staging build is side-loaded only.

## 7 · Who does what

| Step | Who |
|---|---|
| Approve this plan; read Railway's current per-GB / per-vCPU rates (the agent fetches them before creating anything) | owner |
| Build the `DRAFT_ENV=staging` guard + noindex + the staging mark, tested, merged | agent |
| Create the `staging` environment (Duplicate), change the variables per §4 **before** approving the staged deploys, new volumes | agent, with the owner's go-ahead at each create (they cost money) |
| A staging model key with a cap; staging OAuth apps (later) | owner (accounts are the owner's) |
| Seed the synthetic fixture, run the scale suite and the walks on staging, compare with the laptop numbers | agent |
| The `staging` → `main` flow; branch protection on `main` | agent proposes, owner approves |

## 8 · Cost and what it buys

- Cost: Railway bills compute by use and volumes per GB-minute. Staging idles most of the day (low CPU), with a 10 GB volume for draft and a small one for the tools service; runs of the scale suite are short bursts. The agent reads the current rates and states the month's estimate before anything is created.
- It buys: the A187 measurements on production-class hardware (read workers, warm-on-boot, score-only storage), real-browser walks against a deployed build, a place to rehearse migrations (the 6 GB VACUUM for score-only storage) and, later, A/B rollouts — none of it against real people.

## 9 · The owner's answers (11-11)

1. `resume-master` IS deployed in staging, with its own volume.
2. ~~The staging model key: $20 a month cap~~ → **NO model key for now** (owner, 11-11): `ANTHROPIC_KEY` blank on staging — the AI features show as unavailable and staging spends $0 on the model. A capped key (`draft-staging`, $20) only when an AI feature is tested there.
4. ⛔ **The tools service (`resume-master`) is NOT covered by draft's guard** — staging's duplicate carries production's `tools-prod` model key and its own secrets. Before its staged deploy is approved: its model key BLANK, its signing secrets NEW, its URLs staging's; a matching boot guard in the resume-master repo is a separate change.
3. `staging` → `main` merges only on the owner's word.

## 10 · Estimate (approximate — Railway's published per-minute rates as last known: ≈ $20 / vCPU-month, ≈ $10 / GB-RAM-month, ≈ $0.15 / GB-volume-month; check the Usage page)

| | Assumed | ≈ / month |
|---|---|---|
| draft (idle most of the day; 100k fixture in memory) | ~0.05 vCPU, ~1.5 GB RAM | ~$16 |
| resume-master | ~0.02 vCPU, ~0.3 GB | ~$3.5 |
| volumes | 10 GB + 5 GB | ~$2.3 |
| scale-suite runs | 10 min × 8 vCPU a run | ~$0.05 a run |
| **total** | | **≈ $20–25 + the $20 model cap** |

RAM dominates; a memory limit on staging's services caps it.

## 11 · What exists (created 11-11, 21:04Z — re-measure with `describe-environment`)

- Environment **`staging`** (`1e452736-7647-4576-adde-86179c1de27a`), made with `railway environment new staging --duplicate production` and every §4 override passed as `--service-config` AT CREATION (the CLI applied it at once — no staged review — which is why nothing was left to change afterwards). New secrets were minted locally and never printed; the tools-service token is `rmk_draft.…` with only its sha256 on the service.
- All three services deploy from the **`staging`** branch (draft's and resume-master's `staging` branches created from their `main`).
- Domains: draft `https://draft-staging-a0359db5.up.railway.app`, resume-master `https://resume-master-staging.up.railway.app` (Railway-generated; not under the live domain).
- Volumes: per-environment instances of `draft-data` and `resume-master-data` — **empty** (staging's first boot applied all 270 migrations to a fresh database, `scraped_jobs empty`).
- Limits: draft 8 vCPU / 8 GB, resume-master 1 / 1, crawler 1 / 1.
- Boot checks: draft `[staging] DRAFT_ENV=staging — forced off: …`, `/api/version` env `staging`, `X-Robots-Tag: noindex, nofollow`; resume-master `model: false, modelKey: null, clients: ["draft"]`; crawler `dry-run true`, pointed at staging, `paused by draft — idling`. Production unchanged (`/api/version` env `production`).
- **No model key** anywhere in staging (owner, 11-11). Staging's public database holds no accounts.
- **The synthetic fixture** is built INSIDE the staging container under `/tmp/fixture-100k` (100k postings, 20 users, 12 s; `/tmp` is lost on a redeploy — rebuild with `scripts/scaleFixture.mjs`, then re-date `scraped_at` as `scaleSuite` does BEFORE any boot on it, or the expiry retires 88 %). It is never served publicly (its synthetic accounts share a password that is in the repo); the scale suite boots its own private server on a copy, inside the container.
- **The tools service guard** (resume-master `0c6a1cf`, `RM_ENV=staging` set on staging): boot line `[staging] RM_ENV=staging — forced off: RM_MCP_ANONYMOUS; noindex on every response`, no refusal.

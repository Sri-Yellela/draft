# Model calls — every path that spends Anthropic credit

Traced 2026-10-14 (43g) from source in draft, resume-master (the tools service), draft-claude-plugin and
draft-browser. Purpose: one list to hang spend meters on (A97). Re-trace when a call site is added — the
guards below fail the build if one bypasses its wrapper, but they do not update this file.

## The one-sentence picture

**Only two processes hold a key and call the model: draft (three small Haiku features) and the tools
service (every résumé).** The plugin and draft-browser make no model calls. Nothing calls the model on a
timer or at boot in either service since D17/A80 deleted `enrich_job` (10-03/10-05). **One key** is
shared by draft (`ANTHROPIC_KEY`), the tools service (`ANTHROPIC_API_KEY`) and the local `.env` — so the
Console cannot tell them apart (T4 follow-up).

## Wrappers and their guards

| Process | Wrapper | Guard | Ledger |
|---|---|---|---|
| draft | `services/modelCall.js` `callModel` (records success AND failure) | `test/modelCallGuard.test.js` — no bare `messages.create` | `usage_events` (purpose, model, tokens, `cost_usd`) |
| tools service | `src/model/anthropicCall.js` `callAnthropic` | `test/d17ModelCallSites.test.js` | **stdout only** — one `metering:true` JSON line per request (tokens, no $); the site path also writes its credits ledger on success |
| draft → tools service | `services/toolsService.js` client; `recordToolsServiceUsage` | — | the response's `usage[]` copied into draft's `usage_events` (success and failure) |

## Call sites

### draft (key: `ANTHROPIC_KEY`, client `server.js:5467`)

| purpose | where | trigger | model · max_tokens |
|---|---|---|---|
| `cover_letter` | `server.js:12150` | `POST /api/cover-letter/generate` (signed in) | Haiku · 800 |
| `cover_letter_apply` | `server.js:11214` `generateCoverLetterForApply` | apply runs — `routes/apply.js:1611/1676/1863`, one per job approved | Haiku · 800 |
| `domain_chips` | `routes/domainProfiles.js:656` | `POST /api/domain-profiles/generate-chips` | Haiku · 600 |
| (harness) | `scripts/al5TokenizedGeneration.mjs:134,183` | run by hand, local `.env` | Sonnet — records only if given a db |

Boot prints `[models] … LIVE` for Haiku and Sonnet — that is `client.models.retrieve`
(`services/modelCatalogue.js:65`), a metadata lookup, not a billed message.

### draft → the tools service (no key in draft; billed to the tools service's key)

| route in draft | where | calls |
|---|---|---|
| web generate | `server.js:11449` → `coreGenerateResume` (`:10735`, `toolsService.generate` `:10821`) | 1 generate |
| apply runs | `server.js:11139` `generateResumeForApply` | 1 generate **+ 1 `cover_letter_apply`** per job |
| extension résumé | `server.js:11777` (services/extensionResume.js) | 1 generate |
| standalone | `server.js:12031` `POST /api/standalone/generate` (standalone auth, rate-limited 2) | 1 generate |
| enhance | `server.js:10462` `enhanceProfileResume` → `toolsService.enhance` | 1 enhance |

Draft makes no automatic retry (`services/generationRetry.js`); a user retry is labelled in the ledger.

### the tools service (key: `ANTHROPIC_API_KEY`, client `server.js:26`, SDK `maxRetries: 1`)

| purpose | where | trigger | model · max_tokens |
|---|---|---|---|
| `classifier` | `src/generation/classifier.js:46` | inside generate, only when the request has neither `domainModuleKey` nor `roleFamily` | Haiku · 400 (inputs truncated) |
| `resume_generate` | `src/generation/generate.js:93` | `POST /v1/resumes/generate` (service token) · `POST /v1/site/tools/generate` (site user, 1 credit) | **Sonnet 5 · 8192**, thinking disabled, prompt caching on (≤3 breakpoints) |
| `resume_format` | `src/generation/generate.js:109` | same, only if `RESUME_MASTER_LLM_FORMAT=1` (off) | Haiku · 4096 |
| `resume_enhance` | `src/generation/enhance.js:23` | `POST /v1/resumes/enhance` · `POST /v1/site/tools/enhance` (1 credit) | Sonnet 5 · 8000 |
| (live harness) | `scripts/verifyContract.mjs --metered` | run by hand | 1 generate + 1 enhance against the deployed service |

**Per résumé:** 1 Sonnet call (2 with the Haiku classifier), worst case 3 with the format pass; ×2 HTTP
attempts if the SDK retries. No multi-pass, critique or per-section loop.

## Where spend can hide from every ledger (what the meters must close)

1. **The shared key.** Local scripts using the local `.env` record nowhere unless given a db; the
   Console shows one key. ⭐ Separate keys per process (draft prod, tools service prod, local) is the
   cheapest meter there is — the Console's usage page then splits by key. **A97 (43g): code side
   BUILT** — both services print `label` + an 8-hex sha256 `fp` of their key at boot
   (`ANTHROPIC_KEY_LABEL`), so a shared key shows as one fp. ⏸ The keys themselves are the owner's
   (Console → create `draft-prod`, `tools-prod`, `local-dev`; set them and the labels on Railway and in
   the local `.env`).
2. ~~**The tools service has no durable ledger**~~ **A97 (43g): BUILT** — `model_usage` (store
   migration `005_model_usage`), one row per model call from both surfaces via `metering.record`:
   client, route, purpose, model, success, four token counts, duration, `cost_usd`, `key_label`,
   `key_fp`; no content, no person. Read: `node scripts/modelUsageReport.mjs --since <date>` on the
   service.
3. **SDK retries are not counted** (`usage[]` counts logical calls; a billed 5xx retry is invisible).
4. ~~**The classifier's paid call is dropped**~~ **A97: FIXED** — an unparseable reply now throws
   with its usage attached, and generate's degradation path meters it.
5. **No input cap on generate/enhance** — the body limit is 15 MB and the résumé and posting text go to
   Sonnet untruncated. One oversized call is the single biggest per-call risk.
6. **No model-call limit by default** — `RM_LIMITS_PER_DAY` unset; the counter is in memory.
7. **The claim guard runs after the paid call** — a 422 is a full Sonnet bill and invites a retry.
8. **The tools service's public site** (`/v1/site/tools/*`) spends on the same key for any signed-in
   site user with credits (rate 30/min/IP).

## Measured 10-14 (43g), read-only

- Tools service metering log, 10-07 → 10-14 22:46Z: **one** model request, the owner's 19:37:03Z
  generate — `failed_calls 1`, 0 tokens (credit too low). No successful generate or enhance, from draft
  or the site, since 10-07. 19:37Z → 22:46Z otherwise: bot scans only (`/.env` probes, 404).
- Local `data/resume_master.db` `usage_events` since 10-06: **0 rows**.
- No key has ever been committed to any of the four repositories' history (searched all refs for
  `sk-ant-`; the only hit is the README placeholder).
- Claude Code on this machine bills an enterprise subscription, not the API key; no
  `ANTHROPIC_API_KEY` is set in the user or machine environment.
- ⚠ Production draft `usage_events` since 10-03 was NOT read (the production read was not permitted
  this session).

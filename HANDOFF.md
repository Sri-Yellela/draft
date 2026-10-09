# Handoff — start here

**Everything below was measured on 2026-09-24, not carried forward from another document.** Every
figure in the docs this replaces had been wrong at least once. If a number here disagrees with
something you read elsewhere in `docs/`, re-measure before you believe either.

## State, right now

| | |
|---|---|
| deployed commit | **read it from `/api/version`** — any value written here is stale by the next push, which is why the doc guard deliberately does not assert one |
| contract | `2.5.0` in source (10-08: D74 P1 — `ageFilter` gains `visit`, *since your last visit*, a new enum value; additive), after `2.4.0` (10-07: D71 — additive: `Job.salaryPeriod`, `Job.salarySource`, `Job.payLocations`, `Job.descriptionMissing`; salaryMin/Max may now come from pay stated in the posting's text). Before: `2.3.0` (10-07: D59 — additive: `Job.requirements` (the posting's stated citizenship / clearance; null = not read yet) and `Job.postingFields` (the label block's travel / relocation / requisition / pay); `description` is the normalised text when there is one). Before: `2.2.1` (10-07: D50 — annotation only: the ATS-score notes read "SHOWN ON THE WEB, PROVISIONAL"; mobile still renders the band). Before: `2.2.0` (10-05: D35 — additive: `FacetsResponse.coverage` and `FacetsResponse.views`, the Full House header's coverage lines and view counts). Before: `2.1.0` (10-05: D32 — additive: `Job.tagFunction`/`tagLevel`/`tagWorkplace`, `DeckReport.experienceState`). Before: `2.0.0` (10-04: D24 — MAJOR: GET /api/jobs/facets replaced by the filter sentence's FacetsResponse, `companyAsc` sort, `ageFilter`/`fit_bands` params; ⚠ check what draft-android reads before it re-vendors). Before: `1.5.0` (10-03, 21: A75 — `?order=ats` on the daily draft, `DeckResponse.order`; the score annotations read "NOT DISPLAYED YET"). Before: `1.4.0` (10-02, 18: `Job.heldOutsideUs`, additive) — production `1.3.0` until pushed (A40: `DeckCard.report`, `DeckWhy.missingTotal`); draft-android still vendors `1.2.0` |
| migration high-water | `155_user_management` in **both** runners (D88 P2, 10-09 — `users.status` / `suspended_reason` / `suspended_at` (a suspended account cannot sign in or call the API), `admin_audit_log.reason` (every admin write says why), `user_entitlement_overrides` (an admin's per-user value with a reason and an expiry — the entitlement resolver's first override source; never deleted, revoked) and `user_notes`), after `154_email_consent` (D73 §B, 10-09 — `users.marketing_opt_in` / `_at` / `_source` / `unsubscribed_at`, `email_suppressions` (filled by the Svix-signed Resend webhook; nothing is sent to an address on it) and `notice_log` (who, when, which audience, how many — never the content)), after `153_auth_context_auth_at` (sessions A′, 10-09 — `auth_contexts.auth_at`: each browser token's own sign-in time, so the step-up check reads the identity that is acting when two accounts share one browser), after `152_byom_oauth` (D86, 10-08 — bring-your-own-model résumés: `oauth_clients` / `oauth_connections` / `oauth_codes` / `oauth_tokens` (draft as an OAuth 2.1 authorization server for Claude and ChatGPT; codes and tokens stored as SHA-256 hashes), `byom_briefs` (single-use, bound to the base résumé, 3 attempts), `mcp_audit` (one row per tool call, never content) and `users.byom_enabled` (the user's switch, OFF by default)), after `151_enrichment_provenance` (D84 F2, 10-09 — `scraped_jobs.enrichment_provenance`: where each enrichment value came from; a crawler guess counts as empty for the importer, an import or owner value is never replaced without OVERWRITE; backfilled at boot by detection), after `150_description_full` (D84 F1, 10-09 — `scraped_jobs.description_full`: the whole posting text the crawl stores beside the capped `description`, for the enrichment export; `enrichment_partial`: a row filled from cut text, back in the backlog), after `149_board_visit` (D74 P1, 10-08 — `users.board_seen_at` / `board_prev_seen_at`: the board visit stamps behind *since your last visit*), after `148_company_candidates` (D82, 10-08 — `company_candidates`, the pool the discovery jobs write (HN weekly; the nightly read-only probe stores its evidence there), and `discovery_breakers`, one per source, opened after 3 consecutive failures; a discovery job never adds a company — the owner approves in Admin → Companies → Candidates), after `147_company_evidence` (D80, 10-08 — `company_ats_list.evidence`: why each configured company is on the board; `addCompany` refuses an add without it), after `146_board_policy` (D78, 10-07 — one row: the 120-day age limit, and the switches that retire EXISTING old postings and enforce the CS-only scope, both starting OFF until the owner's go), after `145_crawler_worker_seen` (D75 STEP 1c, 10-07 — `crawler_state.worker_last_seen` / `worker_last_call`: the worker has no domain or healthcheck, so draft records every authenticated call it makes), after `144_crawler_controls` (D75 STEP 0b, 10-07 — `crawler_state`, one row: Pause, Dry-run / Live, the per-run cap and the schedule, in the database so Admin → Crawler changes them with no redeploy; it starts PAUSED and DRY; `crawler_tasks` gains `mode`, `source` and the wrong-answer flag), after `143_deploy_events` (D76, 10-07 — Railway's webhook events: deploy status changes and alerts, written only by the header-authenticated `POST /api/hooks/railway`, ids only, never acted on), after `142_crawler_worker` (D75, 10-07 — `crawler_tasks` (the worker's queue: it leases and returns signed results, holds no DB credentials), `crawler_denylist` (owner-editable, seeded with the five named job boards, wins at queue and lease time), and `apply_origin_pairs.crawler_seen_at` / `crawler_hops_json` (an OBSERVED Apply hop, never promoted by the crawler)), after `141_pay_from_text` (D71, 10-07 — two scraped_jobs columns, `pay_text_min_usd` / `pay_text_max_usd`: pay stated in the posting's own text as a USD-per-year estimate for the sort and the salary filter; the provider's `salary_*` are never written), after `140_apply_origin_pairs` (D67 (2), 10-07 — the self-learning origin table: hostnames and a count, shared; sightings per user, promoted at 3, revocable), after `139_base_resume_only` (D66, 10-07 — `users.base_resume_only`: applications carry the base résumé, no model call), after `138_resume_parse` (D65, 10-07 — a résumé's parse stored with it: `resumes.parsed_json` / `parsed_basis`, the same on `profile_base_resumes` and `base_resume`), after `137_description_text` (D59, 10-07 — postings that arrive as raw HTML and label blocks: the normalised text in `scraped_jobs.description_text`, the label fields in `description_fields`, the stated citizenship / clearance in `req_*`; `description` and `content_hash` untouched), after `136_form_reports` (D55 decision E, 10-07 — the extension's "Report this form": `form_reports`, the form page's host and field labels only, kept 30 days; 132–134 unused), after `135_application_company_domain` (D55 (i), 10-07 — The Table's CSV import keeps an imported application's company website: `job_applications.company_domain`; 132–134 unused here), after `131_resume_score_pair` (D58, 10-07 — the base → tailored pair kept with a generated résumé: `resumes.base_ats_score` / `resume_versions.base_ats_score`), after `130_draft_bin` (D53, 10-07 — Draft House's 7-day bin: `apply_run_jobs.purge_after` / `purged_at`), after `129_application_snapshots` (D43, 10-06 — the application snapshot: `job_applications` pay, `apply_run_jobs` posting title/company/URL/location), after `128_job_tags` (D29, 10-04 — the board's own filter tags: `scraped_jobs.tag_*` and the `job_tag_places` set), after `127_slug_harvest` (D20, 10-04 — the slug-harvest sweep, pool, decision imports and their before-images; 125/126 reserved by the unmerged D16 and A76 branches), after `126_ats_grade_corpus` (A76 under D17, 10-03 — grades imported from an external grading file into `ats_corpus_grades`, provenance through `enrichment_batches` kind `ats_grade`; merged 10-05 after 127/128 were live, and it still runs because the runner applies by id), after `125_application_artifacts` (D16, 10-03 — the résumé an application sent, kept compressed with its record; merged 10-05 after 127/128 were live, and it still runs because the runner applies by id), after `124_company_logos` (A77, 10-03 — company logos stored per company, served first-party), after `123_owner_skill_aliases` (A72, 10-03 — ai ≡ artificial intelligence and ml ≡ machine learning, confirmed aliases from the owner's brief; read by the board's search and the scorer), after `122_job_captures` (A62, 10-02 — one gateway for job data in; captures + revertible admin imports), after `121_application_records` (A63, 10-02 — Pending → verified → Submitted; Draft slots), after `120_apply_run_line` (A59, 10-02 — a Draft waits in line), after `119_admin_audit_log` (A58, 10-02), after `118_ats_reports_job_hash` (A52, 10-02; 117 unused), after `116_dedup_retire_and_log` (A49, 10-02), after `115_deactivate_skroutz_outside_us` (A44, owner 10-02). Production applied through `119_admin_audit_log` — **read from `/api/version`** 10-02 (commit `bfef596`, 125 applied, `latestApplied`), not from this table |
| test baseline | see `CLAUDE.md` § "Deliberate test failures" — the one place the count is kept (this line said 2675 until 10-02) |
| monetisation | **disabled** — the product presents as free and untiered |
| Anthropic balance | **funded — verified 09-28** by real generation, A+ and PDF calls (WORKLOG CURRENT STATE). The "exhausted" behaviour below — 502s, capture degrading — is what happens if it runs out again |

## What this is

A job-application system for one candidate at a time. It crawls applicant-tracking systems
directly (Greenhouse, Lever, Ashby and others), reconciles postings into a single board, enriches
them with a model, scores them against a stored profile, and then either fills an application form
automatically or hands the filled form to the candidate in their own browser to review and submit.
A published Chrome extension captures a posting from any job page and fills applications behind
login gates the server cannot cross. The candidate reviews and submits; **the system never submits
on their behalf without a gate.**

## ⛔ What works, and what only exists

**Working** — verified this session:

- **Ingestion.** Production scraped at `2026-09-24 08:00`. 2776 rows, 2662 active.
- **The board and its ranking.** Post-CC1 it ranks by a three-valued sieve, recency as tiebreak.
- **Weighted ATS scoring.** Production: `state: fresh`, `weightedScoring: true`, 493 terms.
- **Auth and identity.** Three credentials, deliberately separate. Re-verified in a real browser.
- **Migrations.** 116 applied; **1 defined-but-unapplied** in production once A52 ships (`118_ats_reports_job_hash`, additive).

**Built but never completed** — this is the section that matters:

- ⛔ **The apply pipeline has never submitted an application. Not one.** 9 attempts in production:
  7 `held_review`, 1 `held_gate`, 1 `failed`. **Zero** rows carry any submit evidence. Earlier docs
  say "one real application" — that is wrong. The 5 `job_applications` rows are unrelated: four are
  `CUSTOM_SAMPLER` logged from LinkedIn in April, one is `MANUAL`.
- **Enrichment is dead** and has been since 2026-09-17, on the exhausted balance. 1559 production
  rows have never been enriched. `skills_json` sits at **41.0% production / 35.8% local**.
- **Capture still works, degraded.** Since 2026-09-25 `/api/import/job` files the posting without
  a model when the balance is out — title, company, location and description, from the block the
  extension already sends. Salary and skills stay NULL and enrichment completes the row once
  funded. The extension says "Saved (partial)". `ARCHITECTURE.md` §10.
- **`workday` and `smartrecruiters` produce zero rows** in both databases, while appearing in the
  boot log as active. *Owner confirmed 2026-09-24: not wired properly — a defect, not dormancy.*
- **`scraped_jobs.ats_score` is NULL on every row**, both databases. *Owner confirmed 2026-09-24:
  by design — CC5 made scoring per (user, profile, job), so the global column is vestigial.*
- **`usage_events` never carries `ats_score_before/after`** — 0 of 1971 production rows, though
  AK1 built the callback. *Intent could not be established; recorded as unresolved.*
- **The recruiter surface, and features behind the monetisation lever.** See `ARCHITECTURE.md` §9.

## How to check state yourself

- **Deployed:** `GET https://jobsviadraft.com/api/version` and **read a JSON key.**
  ⛔ **A 200 is not evidence.** The SPA catch-all answers 200 with `index.html` for any unknown
  path. That has produced a false finding four times, most recently `/api/admin/stats` "returning
  200" for a route that does not exist. Judge by **response body and content-type**, always.
- **Local:** `npm test`. Expect 2675 / 2675 / 0. ⛔ A red is now a REAL failure — the two deliberate
  ones cleared at P4 on 2026-09-26. Check `CLAUDE.md` before assuming otherwise.
- **Real behaviour:** `npm run verify:harness` (needs the app on `:3001`). A green node suite is
  **not** evidence about anything a browser does — see the note in `package.json`.

## The six defect shapes

Every significant bug here has been one of six, all silent, none threw. One line each; the full
account with examples is in `docs/FINDINGS_ARCHIVE.md`.

1. **Two sides of a contract that don't meet** — `tool` sent, `toolType` read.
2. **A handler wired to nothing** — search by identifier, never by call-site shape.
3. **Silence reported as success** — "sync complete — 0 jobs cached", for months.
4. **NULL-hostile predicates over optional data** — took the board to zero three separate times.
5. **A test that pins a defect** — the bug written down as a guarantee.
6. **A claim with no code** — docs describing behaviour that does not exist.

A seventh, newer: **a guard blind to what it guards.** A guard never seen to fail is not evidence —
verify it by injecting a violation.

## ⛔ Three rules for anyone writing in this repository

1. **Product and engineering only.** Nothing personal, legal, immigration-related or financial — that
   lives outside the repo. Check visibility before writing anything that touches a person: the repo
   was public until 2026-10-01 and history still carries the owner's personal details. `CLAUDE.md`
   § "What may go in this repository".
2. **WORKLOG rows are O## (owner) and A## (agent)** — O34–O40 and A34–A40 were different tasks.
3. **CURRENT STATE is re-derived, never carried forward** — five of the 10-01 audit's twelve findings
   were stale state.

## What needs the owner, not an agent

- **Funding the Anthropic balance.** Enrichment, résumé generation and cover letters do nothing
  until then, and no agent can do it. Capture degrades rather than waiting.
- **The Chrome Web Store.** ⛔ **Uploading v1.1.0 is the owner's, and it is the only thing P4 did
  not finish.** P4 (2026-09-26) rebuilt the package for the new origin and brand, regenerated the
  three listing screenshots and rewrote the listing copy — all of it sitting in
  `extension/submission/`. The dashboard steps are manual: replace the package in place if the
  pending v1.0.0 item allows it, re-paste the **storage** and **host permission** justifications
  (both changed materially), and confirm the reviewer's test account signs in on the new domain.
  A rename plus a host-permission change triggers an in-depth review; expect a longer queue.
- **DNS, Railway env, and the OAuth consoles** — see `docs/DOMAIN_MIGRATION.md` Phase 0.
- **Two mailboxes** that may not exist yet: `privacy@` and `noreply@` on the new domain.
- **Whether the apply pipeline should ever auto-submit.** It never has; that is a product decision.

## Where to look next

| | |
|---|---|
| `ARCHITECTURE.md` | how the system actually works, written from the code |
| `docs/FINDINGS_ARCHIVE.md` | the six defect shapes, and findings worth not rediscovering |
| `docs/CORRECTIONS_REGISTER.md` | **how the docs went wrong** — method, not backlog. Read before trusting any figure |
| `docs/EXTENSION_DIAGNOSIS.md` | the extension's four defects and what was fixed |
| `docs/DOMAIN_MIGRATION.md` | the rebrand, and what only the owner can do |
| `CLAUDE.md` | repo rules, the deliberate test failures, and the line-ending trap |

**The mobile repos are out of scope here** and keep their own docs (`ANDROID.md`, `IOS.md`). This
document should be good enough to shape that work from; it does not describe it.

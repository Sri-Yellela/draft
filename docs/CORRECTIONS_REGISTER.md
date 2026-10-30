# Corrections Register

**Purpose:** every claim made in a planning doc or a task brief that later turned out to be wrong,
with what replaced it. Kept because several of these were repeated across multiple sessions before
anyone measured them, and a wrong figure in a brief becomes a wrong premise in the work.

**Last reconciled:** 2026-10-03 (D4 — `COMPANY_LIST_STRATEGY.md` §3C).

> **The pattern worth naming:** almost every entry below was corrected by an agent *measuring* a
> premise it had been handed, not by anyone noticing the error. The standing instruction —
> *re-derive state from the repo, not from status documents* — is what caught all of them. Three
> briefs in a row had their central premise inverted by the first measurement taken.

---

## Numbers that were wrong

| Claim | Repeated in | Reality | Consequence if believed |
|---|---|---|---|
| **`skills_json` coverage 37%** (465/1255) | `NEXT_WORK.md`, the curation brief, several chat turns | **99.8%** — 1,263 of 1,266 active | Led to "the data is the constraint". It is not. The constraint is whole-value `LIKE` against a 6,130-string vocabulary that is 70% singletons, capped at 6 terms. **Wrong by 2.7×** |
| **`skills_json` coverage 99.8%** — the correction above | this register, `NEXT_WORK.md`, CC2 | **43.7%** in production (1,140 / 2,610 active), 2026-09-18 | THIRD value for one metric. 37% and 99.8% were both right about boards that no longer exist. The lesson is not the number: a coverage figure quoted without its board size has a shelf life of weeks |
| **Enrichment backlog "790 candidates"** | `RECONCILE_AND_RESIDUAL.md` item 3d | **1,470** and growing — 1,373 `enrich_job` events in 30 days and still losing ground | The crawl outruns the drain. This is the binding constraint `DETAIL_FETCH_ECONOMICS.md` names |
| **Enrichment "drains at 25 rows/day"** | `NEXT_WORK.md` lessons | Superseded by AE's bounded loop, now live | Would have justified a second batching mechanism |
| **Migration high-water 068 → 090 → 095 → 101 → 106** | every prompt doc, repeatedly | **109** as of `2e4429e`, read from `/api/version` 2026-09-21 | A new migration written at a stale id collides |
| **Test baseline 45 → 600 → 1006 → 1858 → 2301 → 2443** | every prompt doc | **2596** (2,591 at `2e4429e`) | Comparing against a stale baseline hides introduced failures |
| ⛔ **"workable fetched 23 and wrote 0, recruitee 16 → 0"** — reported as two sources failing | `PART1_RECONCILED_2026-09-18.md` §3a, `ENRICHMENT_BACKLOG_2026-09-18.md` §6, and **delivered as two CRITICAL alerts** | **Both sources were working.** On the crawl side `written` counts new-or-changed upserts only; unchanged postings are counted under `unchanged`, which the health query did not even SELECT. 2026-09-21 | The first entry here whose wrong claim came from **the monitor**, not from a brief. It was harmless while nothing read the route and stopped being harmless four days earlier, when `2e4429e` began delivering it. `docs/SOURCE_HEALTH_FALSE_CRITICAL.md` |
| **`ats_score` non-NULL on 4 of 1,296 rows** | the CC5 brief, the ATS/curation audit | **0 of 2,460.** The board restore left more rows and no scored ones; the 4 were `aj2fixture::*` seeds that no longer exist | Requirement 6's "stored 43 vs scores null" row cannot be reproduced. The requirement was implemented anyway |
| **Scoring costs ~5.5ms/job, 279ms a page, 13.4s a board** | comments an earlier CC5 pass left in `server.js` and `jobCursor.js` | **6.67ms mean** (median 6.32, p95 9.99, n = 300 real postings, weights and synonyms warm) — 0.33s a page, **16.4s** for all 2,458 | ~20% optimistic. Conclusion unchanged and slightly stronger: the board must read a cache |
| **`ran_at` column missing in production** | reported as prod/dev schema drift | **Typo.** The column is `run_at`, and `SELECT ran_at` fails identically locally. Migration `011_cleanup_log` is byte-identical in both dual paths | Invented a schema-divergence investigation |
| **Screenshots ≈ 186 KB** | a commit estimate | **5.8 MB** — 31× | — |
| **The seniority guard moved ρ 0.643 → 0.732** | `PRODUCT_MODEL.md`, `AUDIT_AND_REPLAN.md`, the Phase A brief | **0.645 → 0.746**, re-measured in A1 2026-09-27 by clearing the profile's seniority on the graded 30 (one posting capped, Figma intern 59 → 20). The source comment at `SENIORITY_CAP` already said 0.746 | Understates the guard by 0.014 — the single largest ranking lever measured |
| **`am1GradedCorpusVerify` tolerance tightened 0.02 → 0.005** | the Phase A brief | Only `al3SynonymRhoEffect` and `an3FamilyWeightRho` were tightened on 2026-09-26. **The script the published ρ rests on was still 0.02** until A1 | The one check the brief called THE acceptance test was the one still loose enough to absorb the drift that motivated tightening |
| **`requireToolEntitlement` at ~:4067** | the monetisation brief | **:5530** | — |

---

## Things asserted to exist that did not

| Claim | Reality |
|---|---|
| **`shared/entitlements.js`** | It is `services/entitlements.js` |
| **`ProfilePanel` hardcodes "Admin • Pro"** | No such literal anywhere in the repo. The monetisation brief's requirement 5 had nothing to fix |
| **Mobile modules exist in the main repo** | `git log --all --diff-filter=A` shows no mobile project file was ever added on any branch. The apps are in two sibling repos. `docs/MOBILE_STATE.md` audited the wrong repo and concluded the premise was false — true of that repo, false of the project |
| **AF3's guards were never built** | Cap, concurrency, idempotency, the kill switch and the AE1 fix had **all landed**. Two genuine gaps remained: the kill switch was tested only at admission, and the low-confidence gate had never seen a form |
| **Tasks 1 and 3 (Outcome UI, web cursor paging) were pending** | Both had landed in commits the doc listed as open |
| **Tasks B and C were pending** | Both complete; the head commit read *"docs: Phase 2a is complete"* |
| **Six commits unpushed and undeployed — "the highest-value action"** | All six were on `main` **and** `origin/main`. Sixth time `NEXT_WORK.md` was stale about its own headline |
| **`GROQ_API_KEY` absent from local `.env`** | It was present all along |
| ⛔ **"An aggregator result's URL contains the ATS host and the company slug" — for Adzuna** (`COMPANY_LIST_STRATEGY.md` §3C, 10-01) | **Adzuna's URLs are its own click-tracking redirect** (`adzuna.com/land/ad/…`; 50 of 50, D4), in the API and the browser alike; the employer URL is two hops away, outside the API; descriptions are excerpts. Adzuna is retired as a slug source (owner, 10-03). It was true of SerpApi's `apply_options` only |
| **"Both keys are already configured and already paid for"** (§3C) | SerpApi is on the **free plan, 250 searches/month** (D4). Adzuna's plan was not read; ⚠ a licence may be needed for commercial use (owner row) |
| **A Google Jobs result's `apply_options` are apply routes for that job** (implicit in §3C's "every search finds a company" pairing) | **Google clusters similar postings** — one result's options belonged to Coder, Western Alliance Bank and Mural (owner's live call, 10-03). Harvested slugs are a POOL; never attached to the job they came under |
| **"SerpApi: 0 new companies"** (D4, 10-03, this same day) | **50 of 50 distinct pairs new** over 20 searches with `location` and `hl/gl` set (`SERPAPI_SLUG_YIELD.md`). D4 read only `apply_options[0]` (the URL the plugin keeps) on 20 jobs, two of three searches without a location. Corrected within hours — by the next measurement, as this file predicts |

---

## Premises that inverted on measurement

**`discovered_at` is not `scraped_at`.** The brief said "most of the 837 unenriched rows are stale —
do not enrich what does not matter." By `discovered_at`, 96.7% looked 14–60 days old. By
`scraped_at`, which `aggregator.js:319` re-stamps on every re-sight, **all 837 had been seen within
three days.** Same rows, opposite answers. A `discovered_at` age gate would have refused 809 live
postings and looked like it was working. The shipped gate keys on `scraped_at`.

**Export CSV does not mangle `skills_json`.** Asserted as near-certain in the import brief. 200 real
rows through the actual escape in `routes/adminDb.js`, parsed with a strict RFC4180 parser: **zero
mismatches.** JSONL is still right, for a reason that survives testing — CSV cannot distinguish
"not supplied" from "explicitly null", and both the fill-nulls-only default and the tri-state visa
flags depend on that.

**The three export paths are not duplicates.** The brief said to retire one. `Download .sql` is DDL
only; `Export CSV` is rows over ten allow-listed tables; the JSONL export carries the staleness
interlock. Three different things with similar names.

**Targeted generation's premise was false.** Proposed as the big token saving. Mean 9.08 missing
weighted terms per job, **78.8% of jobs have zero rephrasable gaps**, 64.8% of missing terms
genuinely absent. Handing the model a gap list gives it nine things it is rewarded for claiming,
two-thirds of which the candidate lacks — a more dangerous prompt, not a cheaper one. The real cost
split is output 51% / cache write 40% / input 8.6%, so prompt shortening is nearly worthless.

**Removing the cache breakpoints would cost money, not save it.** The brief said remove them. Net
saved is $0.3632 — removal forfeits $0.39 to recover $0.02, and task D made the one zero-read caller
bursty. A lever was added instead, defaulted to the measured-best setting, with a test that fails if
the net ever flips.

**The lever brief's own headline claim.** "Can the product take money?" — no processor, no key,
twelve probed payment routes all answering with the SPA shell. But `/pricing` was live saying *"paid
upgrades are being prepared"* against a **non-trader** Web Store declaration. One sentence, and the
only outright false commercial claim.

**Task Y's N+1 may not be necessary.** `workable.js` carried a comment asserting descriptions
*required* an N+1; `?details=true` returns them in the **same request**. The comment was wrong and a
five-minute probe disproved it. `detailBudget.js` exists because that comment was believed. The same
probe has not yet been run against SmartRecruiters or Workday — see
`docs/DETAIL_FETCH_ECONOMICS.md`.

**`job_applications` is not empty in production — it has 5 rows — and the pair is still empty
anyway.** Read directly from the deployment on 2026-09-18 (`/api/admin/db/raw-query`, read-only).
0 of the 5 carry `ats_score_at_apply`, a scorer version or an outcome, and the reason is timing
rather than a broken writer: AK1's migration `094_application_ats_provenance` was applied at
1788135030 and the **newest application predates it by two weeks** (1786928129). No application has
been recorded since the stamping path existed, so the nulls are rows from before the columns. CC5
pinned both writers with tests; the path is ready and has never been exercised.

**`usage_events` carrying an ATS delta is 23, not 0.** The audit recorded "1,638 rows with 0
carrying `ats_score_before`/`after`". Production now has 23, so the generation-lift half of the
outcome dataset *is* collecting — it is only the application half that has never fired.

**Production never had the `job_role_map` restore damage.** The 277 unbucketed postings were a
LOCAL artefact of `am3RestoreBoard`. Production reports 0 unbucketed across 2,610 active rows and
`job_role_map` holds only `ats_cache` rows, so the boot-time backfill correctly did nothing there.
It stays as a guard against the next restore, not as a repair of a live defect.

**The admin router is mounted at `/api/admin/db`, not `/api/admin-db`.** Worth recording because
the wrong path returns **HTTP 200 with the SPA shell**, so a status-only probe reads as success and
a `.json()` on it fails with `Unexpected token '<'`. Same catch-all trap as the cleanup-brake probe.

**The cross-user ATS cache was on seven paths, not one.** The CC5 brief named the keywords route's
priority-2 read. Measuring found **three writers** (`scrape`, `adopt-enhanced`, the keywords route)
and **four readers** (board `matchScore`, the poll shape, that priority-2 read, and
`capturedAtsAtApply`). The two the brief did not name are the worse ones: adopt-enhanced rewrote the
score *every other user* saw on every posting the adopter had saved, and the apply stamp wrote a
stranger's score permanently into `job_applications` — the only table that can ever validate the
scorer — with a provenance version attached. See `docs/CC5_PER_PROFILE_SCORES.md` §1.

**"A row with no stored score has no route to the term list" was true for a second reason too.** The
brief blamed the badge's null guard. The handler behind the badge was *also* gated on a score
existing, so even a visible chip would have done nothing. Two independently correct decisions
composing into a dead end on 100% of rows.

**G1's synonym table did not measure "+0.000" — it has no effect path.** No server call site passes
`synonyms` to `scoreAtsLocally`; only a measurement script and one that passes `null` explicitly. Its
only production reader de-dups the technographics rollup. 196 proposals await review for a table
nothing that scores reads.

**"The board is gone" described the dev database only.** `cleanup_log` id 85 deleted 1,288 rows
locally. Production held **1,399 rows / 1,248 active** and was never affected.

---

## Verification methods that proved nothing

These are the durable lessons. Each one passed while measuring nothing.

**A 200 is not evidence a route exists.** The SPA catch-all answers 200 with `index.html` for any
unknown path. `GET /api/admin/enrichment/coverage` "confirmed" a deployment that had not happened.
**Assert a specific JSON key.** Now caught three times — the enrichment routes, `approvalCap`, and
`/api/admin/enrichment/run`.

**Loading the privacy URL proves nothing.** `resumemaster.one/privacy` returns 200 anonymously with
no redirect, and the body is a **2,044-byte SPA shell containing zero policy text.** Verifying the
wording requires fetching the content-hashed bundle and grepping it. I advised "check it in a private
window" twice; that check would have passed on an empty page.

**A guard never seen to fail is not evidence.** Six have now shipped inert:
`modelCallGuard` missing `messages.batches.create` · its comment stripper erasing `https://` URLs as
comments · three dead source anchors in passing tests, over-slicing by up to 4.8× because `indexOf`
returns `-1` and `slice(-1)` means "one from the end" · `ae5BoardUi` stubbing `logo.clearbit.com`
with a 1×1 PNG so its logo assertions passed while **every logo on the board was dead** ·
`ak2BandSurfaces` green for months on a fixture that **invented the field under test** (`baseAtsScore`,
a key `/api/jobs` has never emitted) · the monetisation lever cached as a boot constant, making both
states unreachable in one test process.

**Stubs answer for retired model IDs.** Task A's +33 tests all used fetch stubs, so nothing noticed
that `llama-3.1-8b-instant` no longer exists — Groq serves **no** Llama model. Stubs verify plumbing,
never existence.

**An unauthenticated refusal is not a gate opening.** The lever harness's "user is served" check
passed on a **401**, because registration had failed and nobody was logged in.

**Host liveness is the easy check and the rare failure.** A DNS sweep found one dead host of 24 — and
would have caught only **one of three** real failures. Groq's model id and Lever's company slugs were
*identifiers* retired while their hosts stayed up. What catches those is asserting **rows arrived
with populated key fields**, which is how `workable 0/20 → 20/20 descriptions` was found.

**Source-string tests caught almost none of the real defects.** What did: booting the real server,
driving real Chrome, and measuring field coverage on written rows.

---

## Silent failures, all found by someone happening to look

| | Duration | Instrumented? |
|---|---|---|
| **Jobo never ran** — `JOBO_API_KEY` unset, logged *"sync complete — 0 jobs cached"* | months | the log was there |
| **Enrichment 404'd on a retired model** | 3 days | `usage_events` recorded 25 calls/day with 0 ok, perfectly |
| **Lever's three company slugs all 404'd** after those companies moved off Lever | 5 crawls | `pipeline_runs` had the per-source cause |
| **Every board card read "No signal"** — `/api/jobs` emits `matchScore`, every desktop surface read `baseAtsScore` | unknown | zero client references to `matchScore` |
| **`logo.clearbit.com` dead** — no A record. Its fallback for "provider unreachable" **was Clearbit** | unknown | 1,290/1,296 dead rows |
| **The cleanup brake committed, documented, undeployed** | 1 day | — |
| **`/api/standalone/generate`** Sonnet 8192, unauthenticated, quota keyed on a cookie the caller controls | until `857fa32` | — |
| ⛔ **Production scored against an EMPTY vocabulary.** `.dockerignore` excludes `data/` (all but `ROLE_ALIAS_MAP.json`) since 2026-04-23; Railway builds that Dockerfile; `skillVocabulary.js` fell back to empty by design, citing "Railway filesystem restrictions" that were this repo's own ignore file. `routes/domainProfiles.js` grew a `BUILTIN_REGISTRY` copy for the same symptom. **Structural finding** (A1, 2026-09-27) — from the ignore rules and the documented builder, not from a production read; confirm with `[domain-registry] JSON file not found` in Railway logs | ~5 months | none — and the fallback *raises* graded ρ (0.746 → 0.791) while moving 27 of 30 scores, so no metric would ever have flagged it. Fixed for the SCORER by A1 (registries ship inside `@draft/ats-scorer` and a missing one throws); the picker, `qualificationResolver` and `searchQueryBuilder` still read the excluded `data/` |
| **`.gitignore`'s unanchored `data/` swallowed `packages/ats-scorer/data`** | caught before the first commit | only by staging and reading `git status` — every test passed on the machine that had the files. Now guarded by `atsScorerPackage.test.js` (manifest files must be TRACKED) |

**`AC`'s health check would have caught the first four.** It has been scoped and deferred roughly
fifteen times.

---

---

## Decisions deliberately reversed

A reversal is not an error, but it leaves two documents disagreeing unless it is written down —
this project's most expensive recurring failure. Each entry: what was decided, what replaced it,
who decided, and where the code enforces the new line.

| Was (decided) | Now (reversed) | By | Enforced by |
|---|---|---|---|
| **Resume Master is STATELESS — no database, nothing retained** (owner, 2026-09-26; `PRODUCT_MODEL.md`, resume-master `docs/API.md` and `docs/PRIVACY.md`) | **Accounts, a credit ledger and OPT-IN storage — for people on the site only** (A57, owner 2026-10-02): separate accounts, no SSO; credits granted only (no price, no purchase path); debit on success; documents kept only when the user asks, 90 days. The service-token API stays stateless and uncharged (draft exempt) | owner, 10-02 | resume-master `3e48123`: `test/stateless.test.js` narrowed to "the token API never reaches the store", `test/accounts.test.js` "a token call leaves every table untouched"; `docs/PRIVACY.md` rewritten to say what IS kept |
| **resumemaster.one answers a JSON 404 at "/"** (resume-master: "every answer is JSON, including not found") | **"/" is the site** (A54, owner 2026-10-02); every other unknown path is still a JSON 404 | owner, 10-02 | resume-master `5ab72ff`: `test/site.test.js`; the contract harness no longer declares the root scenario |
| **A Draft while a run is active is refused 429 `run_already_active`** (`APPLY_MAX_ACTIVE_RUNS_PER_USER=1`, A3) | **It waits in line**, viewable and editable until it starts (A59, O44, owner 2026-10-02); runs still never stack | owner, 10-02 | draft `0040f1e`: `test/a59DraftLine.test.js`, `applyGuards` "the second WAITS" |
| **Pressing Apply on the board / exporting a résumé PDF records an application** | **Nothing becomes submitted on a click alone**: Pending → recorded → verified → Submitted; only a verified record writes `job_applications` (A63, O45c, owner 2026-10-02) | owner, 10-02 | draft `1a3b123`: `atsRankingHonesty` (no route but the verified record writes `job_applications`), `test/a63BoardToolsPending.test.js` |
| **Aggregators (Adzuna AND SerpApi) are the discovery layer; each harvested slug pairs with its job** (`COMPANY_LIST_STRATEGY.md` §3C, owner 10-01) | **SerpApi only; Adzuna retired; an unordered POOL of (ats_host, slug), the job association discarded** — and nothing is built until the yield is read (measured: `SERPAPI_SLUG_YIELD.md`) | owner, 10-03 (D4 addendum) | doc only — nothing harvests yet. `test/serpapiLocale.test.js` pins `hl=en&gl=us` on the one google_jobs call site |
| **FULL AUTO is LOCKED by the server** — `FULL_AUTO_PROVEN = false` in `routes/apply.js`, opened only after AF5 and a supervised full-auto run (D22, D25, D36, D79 §4 "unattended is locked"); O73's attended runs a gate | **Gates lifted (D100):** FULL AUTO is a **per-user mode** (`users.send_mode`, migration 169, default SEMI) the user picks on Draft House's run bar (`POST /api/apply/mode`); the constant is removed; the operator's kill switch and the user's Stop everything stay (controls, not gates); each submit records `submitted_by` ('user' approved / 'auto' standing instruction — D36 amended); the owner's first runs are the TEST plan, not a gate. Still to reverse under D100: `/api/apply/session/*` 410 (Lane B) | owner, 10-30 | draft (43q, local): `test/d36ApplyPaths.test.js` §7 (a SEMI user is refused at admission and held at processing; FULL AUTO is admitted), `test/d100FullAutoIsUserMode.test.js` |

## Why this file stays

⛔ **RECOMMENDED KEEP, and not as a backlog.** The checklist that used to end this file was closed
out during the P5 documentation reset on 2026-09-24 and removed, because a checklist is the one
part of this document with an expiry date.

What remains has none. This is the record of **HOW the docs went wrong** — the shapes, the
verification methods that proved nothing, the silent failures and how long each ran. That outlives
every individual entry, because the next wrong figure will be new but the way it becomes wrong
will not.

"Current" has a half-life of about one session in this repository. A register of *methods* does
not.

**How the checklist closed, 2026-09-24:**

| item | outcome |
|---|---|
| `NEXT_WORK.md` — delete the "25 rows/day" lesson | **File deleted.** Superseded by `HANDOFF.md`; it was stale eight times and only ever named in comments, never read by code |
| `FINDINGS_ARCHIVE.md` — add three blind guards | **Done.** `ak2BandSurfaces`, `ae5BoardUi` and the cached monetisation lever added to the seventh defect shape, with the shape they share named |
| `shared/atsBands.js` — 5 of 12, not 4 | **Corrected** in the source comment |
| `am1-ats-graded-corpus.json` — 26 of 30 drifted, rho 0.737 | **Documented** in `ARCHITECTURE.md` §3, alongside the 0.746 the tests assert. Owner 2026-09-24: record both figures and the drift — the drift is the finding |
| `PRIVACY_RECONCILIATION.md` — DuckDuckGo in, Clearbit out | **Already done.** Verified in the file: DuckDuckGo is the live logo provider, Clearbit and Google Fonts are both named as retired recipients |
| mobile "two phases behind" | **No action needed.** No document made the claim except this checklist |

⛔ **One correction this register itself needs.** Its `skills_json` row records 37% → 99.8% → 43.7%.
Measured 2026-09-24: **41.0% production, 35.8% local.** That metric has now had five values. Do not
quote it from any document, including this one — measure it.

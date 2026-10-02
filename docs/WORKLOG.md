# WORKLOG — the single source of truth

**This file is the only place work is tracked.** Every other doc is reference material for a task
named here. If a task is not in this file, it is not being worked on.

**Last updated:** 2026-10-01

---

## How to use this file

**Owner:** read *NOW* and *OWNER QUEUE*. Everything you need to do is there, in order, with nothing
else mixed in.

**Agent:** read *NOW* and *AGENT QUEUE*. Run the top item. When finished, write a report into
*SESSION LOG* at the top, move the task into *DONE* with one line, and update *CURRENT STATE* with
measured figures. ⛔ Do not create a new session-report file — P5 established those fold in here.

**Assistant (chat):** read the newest *SESSION LOG* entry, update *CURRENT STATE*, move finished
items to *DONE*, add new work to the queues, and record confirmed decisions in *DECISIONS*.

**Row IDs (10-01):** owner rows are **O##**, agent rows **A##** — always with the letter. O34–O40 and
A34–A40 were different tasks and were confused for a whole session. In SESSION LOG and DONE, the older
wording "queue N" means **AN** and "OWNER N" means **ON**; those entries are history and are not rewritten.

⛔ **CURRENT STATE is re-derived, never carried forward** — and the rules in `CLAUDE.md` § "What may go in
this repository" apply to every line written here.

**At handover:** delete *AGENT QUEUE*, *OWNER QUEUE* and *SESSION LOG*. What remains — current
state, decisions, done, and the doc directory — is the handover document.

---

## CURRENT STATE

⚠ **Every figure here is measured, never carried forward.** This project's planning docs have been
stale **eight times**, twice about their own headline. Re-derive before trusting.

| | |
|---|---|
| Production (draft) | `jobsviadraft.com` ONLY — **`d592603` pushed 10-01 on the owner's go** (queues 37–40, migration 114): bundle `index-Qj9zxpNC.js` carries the deck layout control and Collapse, `GET /api/settings/deck-geometry` → 401 (route live), `/api/health` ok; ⚠ boot log not read (`railway logs` returned nothing). Before that **`3af6c5e`**, pushed 10-01 (queues 27–31); the live bundle verified ~60 s later to carry the new login copy, the signup hook, the fan and the card-back filter, `/api/health` → `{"ok":true}`. ⚠ Boot log not read this session. Before that: **`9108a15`**, deployed 09-30 20:18Z on the owner's go (O7b), after the owner set `COOKIE_ENCRYPTION_KEY` (O20). Boot log, read by the agent: `[boot] secret key: configured` · `migrations complete (1 applied)` (110) · `registries: 148 role aliases, 28 qualification keys` · `[board-fit] … scored 2688, failed 0, 34.6 s, longest slice 59 ms`. Carries the OAuth sign-in fix (`ef6071f`), UI 2/2b, fit ranking, the copy sweep. ⚠ A completed Google sign-in is not yet observed (O25). `[oauth:linkedin]`/`[oauth:github]` still missing |
| Production (Resume Master) | **LIVE at `https://resumemaster.one`** (since B step 4, 09-28 — verifier 21/21 ON THE DOMAIN; certificate **VALID**, `DETAILED_COMPLETE`, re-read 09-29; DNS Railway-managed and already repointed — see the correction in the step-4 session entry) and `https://resume-master-production-d960.up.railway.app`, commit **`814356d`**, service `resume-master` in draft's Railway project `resume-master` (owner's choice: kept there). Boot log: `model=true clients=["draft"]`. Certificate re-read by the agent 09-29 over TLS: Let's Encrypt, CN=resumemaster.one, valid to 12-27 |
| Resume Master repo | `github.com/Sri-Yellela/resume-master`, `main` = **`661b758`** = `origin/main` (checked 10-01) — G3 `6ec0dd3` and the G6 re-vendor are PUSHED, so deployed (auto-deploy on push; ⚠ the deploy itself not observed). **235** tests per queues 21–22 (not re-run). Before that `6e1837d` (E1, live 09-29 15:48Z, 232/232) |
| draft ↔ Resume Master | draft's `RESUME_MASTER_URL` → the Railway URL above; token set. ⭐ **First real generation, 09-28**: through the live service AND through draft's own client on draft's production env — both passed the claim guard; **first cache READ ever on generation** (7,009 read, 0 written) once two requests fell inside five minutes. ⚠ Not yet run through draft's HTTP route by a signed-in user (O2) |
| Resume Master contract | **v1.1.0** (E1, additive; live 09-29), generated; vendored in draft at 1.1.0 (`8472416`). **Live verifier: 24/24 conform against the deployed service, including the three metered scenarios** |
| Test baseline (draft) | **2936 / 2936 / 0** — measured 10-02 after A51 (+7 `adminSafety`). Before that **2929 / 2929 / 0** — measured 10-02 on `main` after A40 + the A44 merge (A44's branch alone 2922 on a fresh CRLF worktree). Before that **2913 / 2913 / 0** — measured 10-01 after audit item 7 (+1 net: the promises test became two). ⚠ `sealedSessionSweep` can hit a Windows EPERM in its temp-dir cleanup (6/6 alone). Before that **2912 / 2912 / 0** on `main` after merging queues 37–40 (`eea1162`; +26 deck 38–40, +10 `usOnlyBoard`). queue-37 alone read 2886/2886/0 on a fresh CRLF worktree. ⚠ `accountSecurity` "a session is SEALED at rest" is flaky ~1.7% (random ciphertext can contain "42"; fix: match `"user":42`) — not fixed. Before that 2876 after the top bar + /features (+5 featuresPageHonest). 2871 after A31 (+7 landingFindFitApply). 2864 after A30 (+7 signupFirstImpression). 2857 after queues 27–29 (+15 deckFan, +9 viewTransitions). 2833 after the mark reached the text-wordmark surfaces. 2831 after A24 (+10 R1). 2821 after A23 (+10 K1). 2811 after A22 (+6 G6). 2805 after A21 (+3 G3). Before that 2802, account management, run alone. Before that 2785 at `6c3b12b`, 2777 at `6788a8e`. ⚠ Not yet re-measured on a fresh CRLF worktree |
| Migration high-water | **114** (`114_users_deck_geometry`) — ✅ **production APPLIED, read 10-02 from `/api/version`** (`latestApplied: 114_users_deck_geometry`, 121 migrations, commit `94cad9f`, started 02:00:01Z). ⭐ `/api/version` answers what the boot log was needed for — read it first |
| Contract | mobile **1.3.0** in source (A40, additive), **1.2.0** in production and in draft-android until pushed / re-vendored · Resume Master 1.1.0 (above) |
| Extension | **v1.1.1 reuploaded by the owner, 09-28** (built at `5e7f72e`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| draft volume | `resume-master-volume` (draft's DB, `/app/data`) — **481 / 1,000 MB** after the owner grew it 09-29. It was 481/500 and the 09-29 02:00 backup failed with ENOSPC. ⚠ The backup policy still allows ~640 MB steady; policy fixed in `3b9dbe9` (budget from the volume, refuse before the copy) — **deployed** (on `origin/main`, checked 10-01); pruning done 09-30 (O9) |
| ATS ρ | ⚠ **0.723 over the US-only graded postings (n=24, A37, local)** — 0.746 was over n=30 incl. 6 non-US/unparseable. Was: **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — VERIFIED 09-28** by real generation, A+ and PDF calls (Resume Master references draft's `ANTHROPIC_KEY`, owner's choice) |
| ⛔ Fabrication | **2 of 2 real generations contained material the candidate never stated** (a JD skill; two invented responsibility bullets and an unsourced skill). The claim guard enforces years and seniority only. Resume Master's `docs/API.md` now says so. ✅ **AF5 is UNBLOCKED** (owner 09-30 — supervision, every document read before it is sent, is the control) **but ⏸ HELD** (owner 10-01) until résumé generation and ATS scoring are each tested individually — and the ATS test waits on A48 ("not enough signal" 0.1% → 20.5%). G1 itself (A2) is deferred, not fixed |
| Users | **none** |
| draft volume backups | ✅ **Pruned 09-30 on the owner's approval: 4 backups, volume 124 / 879 MB** (was 392). ⛔ The retention bug that made the 09-17..09-29 hole is fixed in `b628ee6` — **deployed** (on `origin/main`, checked 10-01; O7c is closed by the later pushes) |
| Android (draft-android) | `main` = `14b18d4`, local. **58/58 JVM, 15/15 instrumented** on `rm_api36` (09-30). Today's draft on the shared deal; right = server Draft. Contract 1.2.0 vendored |
| `job_applications` | **empty** — nothing has ever validated the product against an employer |
| Board | ⚠ **Local, A37: 2,616 active → 1,866 US (71.3%); 750 held out** (710 non-US · 12 unqualified "Remote" · 28 unparseable). NOT majority non-US locally — only lever is (69/130). Production not measured; the gate is local, and the retire script has not been run there. Local entry+intern over the US board **1.7%** (31/1866). Was: ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

---

## NOW

**10-02 (end of session):** production = `fbeeeef` (docs) on top of `94cad9f` — migration **114 applied**
(`/api/version`). **Local, NOT pushed:** A40 rebuilt (two panels, contract **1.3.0**), A44 merged (`a95bae0`,
migration **115**), A51 (`a56e931`) — `main` is **2936 / 2936 / 0**. ⛔ `docs/business/` and
`COMPANY_AND_MONETISATION.md` stay out of the repo.

- **Owner:** push `main` when ready (ships contract 1.3.0 — Android stays on 1.2.0 until re-vendored — and the
  one-time Ashby re-date on the next crawl) · then O42 (`PIPELINE_PAUSED_SOURCES=jobo`, only meaningful after the
  push) · O41 (production reads/writes, or install the Railway CLI) · O35 · AF5 (held; use ENRICHED postings).
- **Agent, next session, in order:** A52 (one ATS-report implementation + the stored-vs-fresh disagreement) ·
  A53 (vocabulary, then styling) · A49's dedup fixes 1 + 4 before A43, 1–5 before A45 · A50's order from step 2
  (wrong numbers → curl-only UIs → daily glance). ⛔ Read SESSION LOG (13)–(15) first.

## OWNER QUEUE

| | Task | Why it is here |
|---|---|---|
| O1 | ~~At name.com, point `resumemaster.one` at the new target~~ ⛔ **WITHDRAWN — the agent was wrong.** The domain was bought THROUGH Railway; the name.com nameservers are Railway's registrar partner, the owner has no account there, and Railway exposes no editable records. Railway repointed it itself: 09-29 it resolves to `69.46.46.41`, the same address as the new target `hhdv8gnd.up.railway.app`. Nothing to do. (Original text kept below for the record:) change the apex record from `b8h66npc.up.railway.app` to **`hhdv8gnd.up.railway.app`** (ANAME/CNAME-flattened at `@`, as today). Then tell the agent, who checks `railway domain status a2ac6249-2c0d-4450-9352-ba915c6b9b41` for a VALID certificate | The certificate cannot issue or renew until this is done; today's working state is an edge-routing coincidence |
| O1b | ~~Generate ONE résumé in the app~~ ✅ done 09-28 — recorded end to end (see G2 answer) | Closes B step 3's last gap: the HTTP route, the `usage_events` row and the lift measurement have not run on the new path. ⚠ READ the result — see *Fabrication* in CURRENT STATE |
| O2 | ~~B step 4 go-ahead~~ ✅ given and done 09-28 — domain moved, except the DNS edit in row 1 | New certificate; a quiet hour. See NOW for the pre-check |
| O3 | At a quiet moment: delete the stray `RESUME_MASTER_CLIENT_TOKENS` from the **draft** service | Inert (draft never reads it), but Railway's `variable delete` cannot skip the redeploy, so it restarts production |
| O4 | ~~Replace the store icon in the dashboard~~ ✅ done by the owner, 09-28 | Uploaded separately from the zip — the package upload does not carry it |
| O5 | ~~B step 5: remove the stale `resumemaster.one` OAuth redirect URI~~ ✅ **done by the owner, 09-29. ⭐ PHASE A+B IS CLOSED** | — |
| O6 | **AF5 — 30 supervised applications** | ⭐ **UNBLOCKED by the owner, 09-30 — ⏸ HELD 10-01** until generation and ATS scoring are each tested individually (the ATS test waits on A48). ⚠ Premise correction the owner should see: the Kafka document was NOT A+ — both fabrications came from `mode: "GENERATE"`, the standard Generate prompt (see G1). AF5 is supervised, so every generated document is read before it is sent; that reading is the control. Run ONE first and confirm `job_applications` gets a row with `ats_score_at_apply` populated |
| O7 | ~~Go-ahead to push draft `main`~~ ✅ given 09-29; `dad1114` live 14:30Z. ✅ The `[boot] registries:` line is read (148 / 28, non-zero) and the first 02:00 backup on the new policy succeeded — both by the agent, 09-30 | — |
| O7b | ~~Push draft `main`~~ ✅ **pushed on the owner's go 09-30** (`dad1114..9108a15`), after the key was set; live 20:18Z, `[boot] secret key: configured` | — |
| O7c | **Push draft `main`** — approved 09-30, then BLOCKED by the session's permission guard; the owner runs it: `! git -C C:\Users\duggi\WebstormProjects\draft push origin main`. Carries: `b628ee6` (⛔ retention — before 02:00), `fc668be` (public ATS on v4, bands, free/unlimited), `3f448e7` (crisp leather, the glass material, the board off its cream slab), `be26aa7` `4a139af` `9464bae` (the daily deal, `/api/draft/today`, contract 1.2.0, migration **111**), `be8833a` (Today's draft — the deck), `6788a8e` (dark mode), and docs | Push = auto-deploy. Then the agent reads the boot log (migration 111, the deck route) and checks Today in production |
| O8 | ~~Optional: re-run `verify:live` on the domain~~ ✅ **run by the owner with the token, 09-29** | — |
| O9 | ~~Approve the prune set~~ ✅ **approved by the owner and DONE 09-30 21:32Z**: dry run first (exactly 22 listed), then deleted over SSH — **276.2 MB freed, volume 392 → 124 MB**, manifest 26 → 4 entries. Kept: 09-30 auto-daily · 09-16 auto-daily · 09-09 pre-migration-102-103 · 08-22 manual. ⚠ Still suggested: `BACKUP_MAX_BYTES=125829120`, or the nightly job refills toward its 351 MB budget | — |
| O10 | Decide which iOS branch is canonical: `main` (`f8be63c`, 05-09) or `feat/api-layer-feed-review-queue` (`aad5a3a` + the P3 sweep) — and a Mac for A7 | The rebrand's "three repos" is only true on the branch |
| O11 | ~~UI redesign: does POSITION encode fit?~~ ✅ **Decided 09-29 by the owner: YES — rank the board by fit.** Ranking by fit is now a hard dependency of the deck (A13) | Unblocks UI step 3 once 13 lands |
| O12 | Review `docs/E3_SECURITY_DESIGN.md` — its §9 checklist. ⛔ It corrects the parent doc: a streamed sign-in passes the password through our workers, so it recommends device sign-in + session upload | Review is prerequisite 4; building stays behind AF5 regardless |
| O13 | ~~Check that `COOKIE_ENCRYPTION_KEY` is SET~~ ✅ **checked by the owner 09-29: ABSENT.** Answered by the agent 09-30 — see O20 and the session entry. ⛔ **Not a plaintext exposure:** nothing is stored unencrypted because of it. ⛔ **But two defects:** (1) the key was silently random per boot, so any secret sealed with it died at the next deploy — nothing noticed, because nothing ever decrypts (`decryptCookies` had no caller); (2) looking at who seals with it found that **every OAuth sign-in throws a ReferenceError** — `server.js` called `saveIntegrationSecret`, which existed only inside `routes/account.js`. Both fixed in `ef6071f` | — |
| O14 | ~~Android: what does a left swipe mean?~~ ✅ **Decided 09-29 by the owner: a SAVED pass** (a persisted dislike; the card never returns). Being wired in A14 | — |
| O15 | Android store readiness — no signing config, no Data Safety form, `versionCode 1`, launcher icon, and `com.draft.android` availability on Play unchecked; plus the admin flavour (hardcoded "Sri Yellela / Admin • Pro", literal dashboard counts) — ship it, hide it, or delete it? | Owner-only: the Play console, the keystore, and the product call |
| O16 | **E1 decisions** (resume-master `6e1837d`): ~~(a) push = deploy~~ ✅ pushed 09-29 on the owner's go and **LIVE 15:48:54Z** (GitHub status "Success - resumemaster.one"; `POST /mcp` 404 → 401 `{"error":"unauthenticated"}` unauthenticated and with a bogus token; `/health` ok); `verify:live` still needs your token (O8) · ~~(b) metering~~ ✅ **decided 09-29: ATS stays FREE and UNLIMITED** (distribution, not revenue) · (c) who gets `rmk_` tokens — a public free connector needs a token policy (no OAuth/anonymous today) · (d) the contract-hash gap: accept, or fix in a new version (changes the recorded 1.0.0 hash) · (e) build a local PDF extractor so parsing can ship deterministic? | Nothing deploys until (a) |
| O17 | ~~Paper-grain strength~~ ✅ **owner 09-30, second look: bench C, "crisp leather", and more gloss** — `3f448e7` (the floor token moved for it and every pair re-proved) | — |
| O18 | ~~Copy: the login page's "Upgrade from Plans…" line~~ ✅ **removed on the owner's call, 09-29** (`4e0f96d`, screenshotted) | — |
| O19 | **Fit-ranking calls** (`28b8a33`): (a) should a `skills_include` MISS still outrank fit? 4 of the 9 reachable graded-5 postings sit at 499–644 because of that key, not their score (e.g. "Full Stack Engineer, Link" scores Strong 54 and lands at 499) · (b) a pre-adoption score: base résumé or the unadopted enhanced draft? (the crawl scorer uses the draft; panel and precompute use the base) · (c) should the nightly term-weight refresh force a rescore? (weights are deliberately outside the hash) · (d) on deploy, the boot pass backfills automatically (~2.5 min per active profile at local speed; production has no users) — fine, or set `BOARD_FIT_PRECOMPUTE=off` and run it by hand? | (a) is the biggest remaining lever on where good jobs land |
| O20 | ~~Set `COOKIE_ENCRYPTION_KEY`~~ ✅ **set by the owner 09-30**; boot line `[boot] secret key: configured` | — |
| O21 | **Two production checks the agent was not permitted to make** (permission guard: production reads): (a) ⚠ `ADMIN_PASSWORD` — if it was unset when this database first booted, an `admin` account was seeded with the password **`changeme`** (`server.js` seeds it once, then never again). Try signing in as admin/changeme at `jobsviadraft.com`; if it works, change it at once. (b) Optional: whether `user_integrations` holds any rows (the OAuth fix says it could not have from a sign-in) | (a) is a security question with a one-minute answer |
| O22 | ~~The public `/tools/ats` donut~~ ✅ **owner 09-30: switch to the main scorer and bands** — done in `fc668be` (v4 scorer with the panel's weights and synonyms, band + evidence, no number) | — |
| O23 | ~~ATS free and unlimited on draft's public tool?~~ ✅ **owner 09-30: yes, for now (no monetisation yet)** — the rate limit is removed in `fc668be` | — |
| O24 | Android LinkedIn import (A15) needs **LinkedIn OAuth configured in production** — the boot log says `[oauth:linkedin] missing; missing client_id, client_secret, redirect_uri_or_app_base_url`. And note: LinkedIn's OIDC gives name, email and picture — the app's "import" can never be more than that | Blocks A15 |
| O25 | ~~One Google sign-in~~ ✅ **done 09-30**: works end to end (the integration row written, its token sealed by the key). ⚠ It created a NEW account (user 10) — O27 | — |
| O27 | **Two accounts: user 3 (yours, password) and user 10 (Google, empty) — MERGE them** (once the account-management push is live). Sign in to user 3 with the password → avatar menu → *Account & security* → *Merge another account into this one* → **Use Google** → pick the Google account. Review the preview (user 10 has no data), confirm. User 10 is deleted and its Google sign-in moves to user 3, so Google then signs you in to YOUR account. ⛔ Linking Google under Integrations would refuse — that Google identity already belongs to user 10; the refusal now points at Merge | The only route that moves an identity between accounts; nothing is lost from either |
| O28 | **Set `RESEND_API_KEY` on draft** (and `EMAIL_FROM`, a sender on a domain verified in Resend, e.g. `Draft <no-reply@jobsviadraft.com>`) | Without it **forgot-password and email change cannot work** — and now SAY so (503 `email_unconfigured`) instead of claiming an email was sent. Before `6c3b12b` production logged the reset link and its code to the server log. Setting a variable redeploys |
| O29 | ~~The audience decision~~ ✅ **DECIDED 09-30: SERVE BOTH, segmented.** Students and experienced candidates, one board, per-profile curation. ⛔ **This makes the ingestion work a REAL dependency, not an option** — the board is 3.0% entry/intern and the sources genuinely do not carry them (measured: the classifier is fine, one misclassification on the whole board; the discard path is fine, 12 of 1,089 dropped rows carry student vocabulary and the drop skews SENIOR). 80 postings shared across all users is not a product. **New agent work — see A25 and 26** | — |
| O30 | ~~AF5 vs K1 timing~~ ✅ **DECIDED 09-30: build K1, but keep it DECOUPLED from generation until both are tested individually.** K1 ships as a check that can be exercised on its own, not wired into the generation path. AF5 is not gated on it; supervision remains the control for now. ⛔ Wiring K1 into generation is a SEPARATE, later decision — see A23 | — |
| O31 | **Two ATS fixes that MOVE THE SCORE — ship them, and re-derive the bands?** Found in A22 (G6), measured, NOT shipped: (a) count a competency the résumé shows as a verb (*Collaborated* → collaboration) in the score, ρ 0.746 → **0.761**; (b) three dead entries in the competency registry ("cross" normalises to "cros", so cross-functional terms are filed as SKILLS), ρ → **0.755**. Both are already fixed in the REPORT where that was possible without moving a number | Both are n=30 improvements inside what the set can distinguish; the cost is that Strong ≥ 44 was calibrated on today's scores, so shipping either means re-deriving the cutpoints. Recommendation: (b) yes — it is a plain defect — with the cutpoints re-derived in the same change |
| O32 | **Student ingestion — which route?** (A25 measured it; nothing is built) (a) **add the top Greenhouse/Lever/Ashby boards** to `company_ats_list` — existing adapters, 1 request each, every student posting described; top 100 ≈ 855 roles, ~130 MB a crawl plus giants (SpaceX 30 MB, Anduril 42 MB); (b) **Workday** — 2,518 roles, the largest host, but whole-site paging (100–244 pages on the big tenants) and `workday.js`'s 300-posting cap must change first; (c) **the public curated index** as discovery (2 requests a day) — ⛔ no license declared on either repository | (a) is the cheap, proven start and needs only rows. ⛔ Not SmartRecruiters or Oracle (0% described). ⚠ The board's role-taxonomy refusal will drop design/data/ops internships exactly as it drops their senior equivalents — that is A26's question, not ingestion's |
| O33 | **A student reference set, graded blind by someone in that audience** (A26) | `am1-ats-graded-corpus.json` is 30 senior roles graded by an experienced engineer and cannot validate a student segment. Needs ~30 student/new-grad postings — once O32's route puts them on the board — graded for fit by a student or recent graduate who has not seen the engine's scores. Only a person can do this |
| O34 | ~~Company logos on the deck's card backs, blurred and tinted orange — acceptable?~~ ✅ **owner 10-01: ship as is (a)** — live since `3af6c5e` | — |
| O35 | **Measure the fan's flip on a real mid-range Android phone** (A27). Open Today in Chrome on the phone, rotate with the ‹ › buttons and tap-to-expand; Chrome DevTools remote → Performance, or just say whether it stutters | The agent measured Chrome at 4× CPU throttle (Lighthouse's mid-tier proxy): **2.7–4.7% frames > 25 ms, p95 17 ms** after moving rotation and flip to the compositor (it was 13–26% before). A throttled desktop CPU is not a phone GPU — only a device settles it |
| O36 | ~~The landing promised "It will not claim anything you did not." — false today~~ ⛔ **SUPERSEDED 10-01 (audit item 7): ALL the promises are DITCHED as a selling point** — the reworded line below is removed too, as is "Nothing is sent until you approve it" on the login page and footer. ⭐ **Exception:** the sentence stays where it is FUNCTIONAL — the auto-apply flow (`AutoApplyPanel`, the queue toast in `AutoApplyContext`) and the deck's Draft toast — an operational notice, not a pitch; `landingFindFitApply` pins both directions. Was: ✅ **owner 10-01: reworded (a)** — "It will not inflate your years or seniority — and you read every draft before anything is sent." (FindFitApply's promise and its Tailoring line); `landingFindFitApply` now REFUSES the stronger line. ⛔ Restore it only once G1 is closed (unsupported-content check wired) | — |
| O37 | ~~Push draft `main`~~ ✅ **pushed on the owner's go 10-01** (`1a50c77..d592603`, queues 37–40, migration 114). Live ~1 min later: bundle `index-Qj9zxpNC.js` carries Customise / Collapse / deck-geometry; `GET /api/settings/deck-geometry` → **401** (route live; an unknown path → 200 SPA); `/api/health` ok. ⚠ Boot log NOT read (`railway logs` returned nothing) — migration 114 applied is inferred, not seen | The non-US gate is now live at ingestion: the next crawl starts retiring non-US rows (see O38b) |
| O38 | ✅ **DECIDED 10-01:** (a) an unqualified "Remote" STAYS held out · (b) RUN `scripts/q37RetireOutOfMarket.mjs` on production, **dry run first** · (c) ⛔ do NOT re-derive Weak < 26 from the shrinking 24-posting set — **grade a fresh US-only set** · (d) re-measure the 3.0% entry/intern figure on production. Was: **Non-US filter (A37) — four calls:** (a) does an unqualified "Remote" stay held out (12 local rows)? (b) run `scripts/q37RetireOutOfMarket.mjs --apply` on production, or let the next crawl retire them? (c) re-take the Weak < 26 calibration over the US board (24 graded postings left; Strong ≥ 44 holds) (d) re-measure the 3.0% entry/intern figure on production | The gate admits only positive US evidence; locally 750 of 2,616 rows are held out. SESSION LOG (11) |
| O39 | ✅ **DECIDED 10-01:** (a) ⛔ **no ATS submission integration** · (b) SmartRecruiters **NO for now** — revisit when an EMPLOYER asks · (c) the relabel is A46. Was: **ATS partnership (A34) — three calls:** (a) confirm no ATS submission integration is built (b) is a SmartRecruiters marketplace application worth it (0 local rows)? (c) "Not linked" → "Not connected" is queued as A46 | Every ATS needs the employer's credential to submit; partnering grants nothing across their customers. `ATS_PARTNERSHIP_FINDING.md` |
| O40 | ✅ **DECIDED 10-01: yes — but only AFTER A48** (the panel renders band content; a fifth of the board currently declines to score). Was: **Deck snapshot: surface more of the stored ATS report in the left panel?** (experience summary, action verbs, competencies, hard-constraint misses, résumé depth) | A40 rearranged only what the card already carried (6 matched / 4 missing). More is a `services/dailyDraft.js` change |
| O41 | **Three PRODUCTION reads/writes the agent cannot reach (no Railway CLI on this machine — `railway` not installed, `railway logs` silently empty):** (a) O38b's retire script, dry run first: `railway run --service draft node scripts/q37RetireOutOfMarket.mjs` then `--apply` (b) enrichment coverage: `SELECT COUNT(*), SUM(enriched_at IS NOT NULL) FROM scraped_jobs WHERE is_active=1` (c) O38d's entry/intern share on the US board. Or install the CLI (`npm i -g @railway/cli`, `railway login`, `railway link`) and the agent runs them | A48: coverage sets the board's decline rate; the non-US gate is live, the retire pass is not |
| O42 | **Set `PIPELINE_PAUSED_SOURCES=jobo` on the draft service** (owner's call 10-02; Railway → Variables, or the CLI per O41). ⚠ Takes effect only once A44's code is deployed; setting a variable redeploys | Clears jobo's permanent CRITICAL (402, wallet exhausted — paused deliberately). ✅ Also decided 10-02: **keep Hygraph** (alive, empty) · **deactivate Skroutz** (Greece only) — migration 115, on A44's branch |
| O26 | ~~Confirm the deck's four proposals~~ ✅ **confirmed by the owner 09-30** and built (`be26aa7`) | — |

✅ **Done by the owner:** the A2 file copy · Anthropic balance funded · extension v1.1.1 rebuilt,
committed and reuploaded · `marketing.md` deferred — **the pilot is gated to CS anyway** · **service
tokens minted and live** (09-28) — draft's in its Railway env as `RESUME_MASTER_TOKEN`, the entry in
Resume Master's `RESUME_MASTER_CLIENT_TOKENS`. ⚠ Owner-reported; the agent never saw the token, by
design.

---

## AGENT QUEUE

Run top to bottom. One commit per task. Report into *SESSION LOG* between each.
**09-29 pass:** the queue was run to the end without stopping; each row says where it landed. Rows
marked ✅ move to *DONE* at the next tidy; ⏸/⛔ rows are what is left, and why.
⚠ **10-01: every row below that says "local", "unpushed" or "not deployed" (3, 4, 8, 10, 11, 20–31) is now
PUSHED** — draft to `d592603`, Resume Master to `661b758`; checked with `git merge-base` against `origin/main`. ⛔ **Except draft-android** (rows 6, 10's
Android part, 14, 17, 19's launcher icon): its `main` is **16 commits ahead of origin** — still local.

| | Task | Status 09-29 | Blocked on |
|---|---|---|---|
| A1 | B step 4 close-out — VALID certificate + `verify:live` on the domain | ✅ **Closed.** The DNS edit it waited on never existed (O1, withdrawn). Re-read 09-29: `resumemaster.one` presents a Let's Encrypt cert, CN=resumemaster.one, 09-28 17:19Z → 12-27; `/health` = `{"ok":true,"service":"resume-master"}`. The 21/21 domain run is 09-28's; a re-run needs `RESUME_MASTER_TOKEN`, which the agent never holds by design — optional, O8 | — |
| A2 | Unsupported-content check for generation (G1) | ⏸ Deferred by the owner (09-28); AF5 unblocked by the owner 09-30 — supervision (reading every document) is the control. G1's prompt question answered: both fabrications were `GENERATE` | owner deferral |
| A3 | Delete draft's two dead `getDomainModuleKey` copies | ✅ `f29f273` (09-29), pushed | — |
| A4 | Static registries out of `data/` (was: `.dockerignore` excludes `data/`) | ✅ `983a0ed` (09-29), pushed and live (`[boot] registries: 148 / 28`) — the premise was one layer short: the VOLUME hides `/app/data`. ⛔ ATS scores move on deploy (per-family weights). Verify after deploy: `[boot] registries:` shows non-zero counts | deploy = O7 |
| A5 | Reconcile `DONE` against `git log` | ✅ 09-29 — DONE rewritten from all four repos' logs: 15 rows corrected, 1 removed, 5 flagged, 46 added. Findings outside DONE are in the session entry | — |
| A6 | Mobile corruption sweep (Android) | ✅ 09-29 — `cd814f1`..`af98492` in draft-android (7 commits, local). Report: `draft-android/docs/CORRUPTION_SWEEP_ANDROID.md`. Unit tests 40 → **49 / 0 fail**; the 13 instrumented tests not run (no device). ⭐ Worst find: every swiped card came BACK when the next page loaded. Also: the template picker selected nothing; the expanded card appended an invented "Requirements include strong Kotlin…" to every employer; SYNC.md's Android column rewritten to the truth (LinkedIn import and application tracking ✅ → ❌). Follow-ups → 14 | — |
| A7 | iOS Phase 1 audit | ⛔ **Needs a Mac** — skipped. ⚠ Reconciliation found the iOS work (`aad5a3a`, the P3 sweep) sits on the unmerged branch `feat/api-layer-feed-review-queue`; `main` is still `f8be63c` (05-09). The audit should start by deciding which branch it audits | Mac |
| A8 | Volume pruning + backup policy | (a) ✅ `3b9dbe9`, live. ⛔ **(c) `b628ee6` — retention skipped big recent backups to keep small old ones** (found listing the volume 09-30); local. (b) the manual prune: list made, O9 | O7c, 9 |
| A9 | **UI redesign, step 2** — tokens + paper substrate | ✅ `1fd46dc` `0b76191` `76cc044` (09-29, local). One token file (`client/src/styles/colorTokens.js`, published as `--c-*`, the `zLayers` pattern); a still SVG paper grain; the night-sky VIDEO background and the per-session random accent (and its picker) deleted. ⛔ The premise was bigger than a reskin — the old UI was fully DARK, so every text colour flipped. Literals 887 → 554 (22 budgeted files + 3 permanent exemptions), ratchet `colorLiteralGuard` seen to fail 3 ways. **44 contrast pairs pass AA** — ⛔ the logo orange is 2.96:1 on cream, so it is a FILL only; orange text uses `#A33200`; text on orange is ink, not white (3.47:1). Two more /pricing-shaped invisible buttons fixed. 2712/2712; 18 routes screenshotted at 1440/390, looked at (agent and me) | — |
| A9b | UI step 2b — **the signed-in app** | ✅ `2356153` (09-30, local) + copy sweep `b8882f8`. **549 literals → 0**, budget EMPTY, rewritten by AST position choosing the token by CSS role (the interrupted run's regex rewriter was not used). Bands on `BAND_*` tokens, all ≥ 4.5:1 as text; ⛔ **Not enough signal = no fill, no hue, dashed outline, "no judgement"** — not a paler Weak. ⭐ **G5 done: no ATS number shown** — the header's "Score {n}", "Best possible: {n}", and DatabasePanel's "ATS {n}" on a 4th copy of the v3 ramp. 21 signed-in scenes screenshotted at 1440/390 on stubbed `/api/*`, compared with the 09-29 before set. 2745/2745 | — |
| A10 | UI redesign, steps 3–6 | ✅ **BUILT 09-30** — the deal (`be26aa7`), the API + contract 1.2.0 (`4a139af` `9464bae`), the deck (`be8833a`), Android on the deck (draft-android `f7fdc2c`), dark mode (`6788a8e`). See `UI_REDESIGN.md` §Steps 3–6 status, with its three recorded deviations | O7c (deploy) |
| A11 | **E1 · MCP connectors** in Resume Master | ✅ `6e1837d` in resume-master (09-29, **local — RM auto-deploys on push**). `POST /mcp`, stateless Streamable HTTP, same token auth before the body is read (401 / 503 `auth_unconfigured`), metered per call with `via:"mcp"`. Tools: `score_ats_fit` (0 model calls; a decline is `outcome:"not_enough_signal"`, `score:null`, "NOT a low score") and `format_resume_print_html` (HTML, not PDF). Schemas GENERATED from the HTTP contract (`x-mcp`), drift-tested; contract **1.0.0 → 1.1.0**, additive. 197 → **232/232**, 22 injected violations caught. ⛔ Premise corrected: parsing has NO deterministic path (it is a Sonnet call) — left out. Generation deferred per the design. Found: the formatter reorders/renames sections and folds unknown headings into the previous one (described in the tool); the contract hash ignores every key named `description` (not fixed) | deploy = O16 |
| A16 | Re-vendor Resume Master contract 1.1.0 into draft | ✅ `8472416` (09-29, local) — 14/14 contract tests. Also: two root scanners (`modelCallGuard`, `dropImportExtensionTokens`) walked into agent worktrees under `.claude/` and reported the repo twice; both now skip it | — |
| A12 | E3 · Remote browser profiles — the **security design** only | ✅ written 09-29, `docs/E3_SECURITY_DESIGN.md`; nothing built. ⛔ Building waits on AF5, full-auto proven on the direct tier, the kill switch verified mid-batch, and the design reviewed | AF5 · O12 |
| A13 | ⭐ **Rank the board by fit** | ✅ merged `28b8a33` (09-29, local; commits `269e7e3` `0cfb427` `52b1261`). Migration **110** adds `basis_hash` to `ats_only_reports` (REUSED rather than a second score table — the card, panel and apply stamp already read it). ONE scoring definition (`atsBasisForProfile`/`scoreJobForBasis`); precompute incremental, chunked writes, explicit status per run, kill switch `BOARD_FIT_PRECOMPUTE=off`, admin `POST /api/admin/board-fit/precompute` (dry run by default). Default order = rank keys → band (Strong, Moderate, not established, Weak) → score → recency; a cursor spanning a score write is refused and restarts (a 681-row walk had returned 680). Measured on a local copy: graded-5 in the top 50 **2 → 3**; top 20 **20 unscored → 20 Strong**; fit-FIRST was worse (1). 2738/2738 | — |
| A14 | Android open defects from the sweep | ✅ `8445e88` + `b94a0e0` (09-30, draft-android, local), verified on the emulator: 401 → sign-in with a notice, credential cleared (relaunch lands on sign-in); **left swipe and X = saved pass** (PATCH `disliked:true` seen; Skip deleted); dead Filter button removed; failed Star → snackbar; section delete confirmed — ⛔ and found: the delete arm was UNREACHABLE (a stale swipe lambda painted "Delete" and un-hid); drag handle removed. 55/55 JVM, **15/15 instrumented**. Open: the optimistic "Saved to starred" badge shows before a failed write's snackbar; admin `AssistChip(onClick={})` left with 2b1 (O15) | — |
| A15 | Android: LinkedIn import — needs a mobile import endpoint in draft | ⏸ **Blocked, 09-30.** The interrupted run "started" it and left nothing (no worktree, no branch). ⛔ LinkedIn OAuth is not configured in production at all (O24), so an endpoint could not be exercised end to end — not built | O24 |
| A17 | Android's look onto the leather and glass, and dark there | ✅ draft-android `d2f0e3a` (09-30): the web's tokens, theme-aware at the source; the web's own leather tile; the glass card with blank slabs behind; the "/draft" mark on sign-in. Verified on the emulator, light and dark | — |
| A18 | The theme preference with the account | ✅ `c39dff7` (09-30): migration 112, `GET/PUT /api/settings/theme`; the account wins on a device and reloads only when the screen would change | — |
| A19 | The redesigned mark everywhere | ✅ `9feac48` (web: "/draft" expanded, "/d" condensed, favicons) · draft-android `ef2bae4` (launcher icon, every density) — from the owner's artwork, like for like with the extension | — |
| A20 | Account management — merge, sessions, picture, password, email, export, delete | ✅ (09-30), pushed in `3af6c5e`: `6c3b12b` (sessions sealed at rest, SameSite=Lax, cross-site writes refused, honest email) + the account-management commit (migration 113, `services/accountService.js`, `routes/accountManagement.js`, `/app/account`). ⚠ Not deployed; email-dependent parts wait on O28 |
| A21 | ⛔ **G3 — AG4's duplication defect is LIVE AGAIN** | ✅ **09-30, local** (Resume Master + draft's copy): the tests asserted narrower than the behaviour — renderer-vocabulary fixtures and an identical-lines-only detector; the model nests the role in the org and writes the date as a span, and **every date was being dropped**. Fixed in the classifier; 3 behaviour tests fail on the old code. ⚠ Not deployed. SESSION LOG (6). *Was:* ⏸ Never queued — recorded in OBSERVED IN PRODUCTION on 09-29 and no task was ever made.** A generated résumé states the role THREE times: the header line, an italic restatement, then the location alone. ⛔ AG4's tests PASS while this ships — *"a model's plain-text restatement of the header and bullets is read, not reprinted"* · *"a nested entry-header does not leak its date into the body"*. **Green tests, live defect.** ⚠ A2 rebuilt `FORMATTING_SYSTEM` from `RESUME_STYLE_BLOCK`, which fixed G4 — it did NOT fix this, which is in the renderer/output path. Start by establishing whether the tests assert something narrower than the behaviour, or whether the path moved under them | — |
| A22 | **G6 — the generic-language classifier has gaps** | ✅ **09-30, local** (package + Resume Master's vendored copy): not a threshold — a stated list missing 11 verbs, and "collaboration" a false NEGATIVE (the résumé says *Collaborated*). Fixed report-only; ρ 0.746 unchanged; cached reports re-keyed. Two score-moving fixes measured → O31. SESSION LOG (6). *Was:* ⏸ Never queued — same origin as 21.** The "Generic language" section correctly holds *Managed, Partnered, Coordinated, Grew*, but **"Defined" and "Created" surface as MISSING VERBS** and **"collaboration" as a MISSING COMPETENCY**. All three are claimable by almost any candidate, so showing them as gaps implies a deficiency that is not real. AH3 built this suppression and set the threshold; these sit the wrong side of it. ⚠ The corpus head is SOFT SKILLS, not technologies — *collaboration* appears 199 times — so the threshold is under-tuned, not absent | — |
| A23 | ⭐ **K1 — KB sanity check on generation** | ✅ **09-30, built DECOUPLED** — `scripts/k1KbSanityCheck.mjs --verify` passes both directions on the real KB: G1's invented Stripe teams flag, the owner's real résumé flags nothing. ⛔ KB-only fails both ways (G1 is company-PLAUSIBLE; absence flags true claims), so a finding needs a company-shaped claim AND an unsupporting source. Not wired. SESSION LOG (6). *Was:* ⏸ Queued 09-30, blocks on nothing. `RECRUITER_LAYER_EXECUTION.md` §K1. ⭐ **Attacks the live fabrication defect.** ⛔ **O30: BUILD IT DECOUPLED.** It ships as a check that can be run on its own — a script, a test harness, an admin route — and is **NOT wired into the generation path** until both it and generation have been tested individually. AF5 is not gated on it. ⛔ EXTEND the 9.6 failsafe; never build a second checker. ⛔ Acceptance is BOTH directions: the two G1 documents must flag, AND the owner's real résumé (Stripe, Bangalore) must flag NOTHING — the Bangalore precedent is a false "does not match" against a TRUE claim. ⛔ Say what it cannot catch; "Kafka" is not a company fact. ⛔ The KB learns from company-emitted data ONLY | — |
| A24 | ⭐ **R1 — grade the employer's posting** | ✅ **09-30, built + measured, no public route** — detection 17/17 visible on 20; it discriminates over 50 (peer percentiles sd 25–30), but specificity is coarse (engineering median 2 tools) and seniority incoherence never fires on this board. ⛔ The board's text is capped at 3k+2k chars — requirements are read on full text and compared with uncapped peers only. SESSION LOG (6). *Was:* ⏸ Queued 09-30, blocks on nothing. `RECRUITER_LAYER_EXECUTION.md` §R1. The existing extractor pointed at a JD. **Zero model calls** — that is what lets it be a free public tool, and the recruiter-side acquisition hook before the two-sided product exists. ⛔ COMPARATIVE, never absolute ("names 3 technologies; the median names 11") — the "58 beside Strong match" lesson. ⛔ Never a public league table of employers. ⚠ Measure the requirements-section detection rate on 20 postings FIRST, and verify it discriminates over 50 — the v3 engine's whole spread was sd 2.87 on a 0–100 scale | — |
| A25 | ⛔ **Ingestion for the student segment — MEASURE FIRST, build nothing** | ✅ **09-30, measured, nothing built** — 7,486 active student roles at ~2,200 companies (public curated lists); our 25 companies carry 48. Workday 34% · custom 28% · Greenhouse/Lever/Ashby 22% (1 request/board, 100% described). ⛔ Workday needs whole-site paging and `workday.js` caps at 300; SmartRecruiters 0/4 and Oracle 0/6 described. Route = O32. SESSION LOG (6). *Was:* ⏸ Queued 09-30 by O29 (**serve both, segmented**). The board is 3.0% entry/intern and the cause is **the configured companies do not post these roles here** — already proven, do not re-litigate it. **Establish, and report before changing anything:** where student and new-grad roles actually live (separate ATS tenants? seasonal windows? university boards? a different Greenhouse board per company?) · what a realistic volume looks like per source · what it would cost per crawl. ⚠ `DETAIL_FETCH_ECONOMICS.md`'s lesson applies: **a probe before a budget model** — workable's own comment claimed an N+1 was required and `?details=true` disproved it in five minutes. ⛔ Do NOT enable a source whose description coverage is 0% — Ubisoft, Bosch and Adobe were seeded inactive for exactly that, 648 rows that could never be enriched | — |
| A26 | **Segmented curation — both audiences on one board** | ⏸ **09-30: blocked on O32 (the route) + O33 (the student reference set).** ⛔ Premise corrected, measured: `SKILL_HINTS` is NOT the gate — removing it changes 4 of 67 scores; the gate is the POSTING-side registry vocabulary (no *data structures, algorithms, coursework, TA, hackathon*). The guard is profile-relative one way only (0/300 senior postings capped for a student). SESSION LOG (6). *Was:* ⏸ Queued 09-30 by O29. Blocked on 25's measurement. ⛔ **The seniority guard becomes PROFILE-RELATIVE, not deleted.** It currently demotes intern postings and is worth **0.645 → 0.746** — a senior posting shown to a student needs demoting exactly as much as an intern posting shown to a senior engineer did, so it is needed in BOTH directions. ⛔ **`am1-ats-graded-corpus.json` is 30 SENIOR roles graded by an experienced engineer** — it stays (irreplaceable; the originals were destroyed in the id-85 deletion) but it does NOT validate a student segment. A second reference set is needed, graded blind by someone in that audience. ⚠ The résumé-side extractor is a hardcoded 32-item `SKILL_HINTS` list with no vocabulary for coursework, projects, clubs or teaching assistantships — that is the real gate on what segmented curation can achieve | A25 | — |

| A27 | ⭐ **The deck — the fan, the flip, click-to-expand** | ✅ **10-01, local (one commit with 28 + 29).** Palette FIRST: the deck is NOT dark by design — built after 2b on tokens; "dark" is step 6's dark mode following the OS. Fan built: `lib/fanGeometry.js`, the logo back (`CardBack.jsx`, SVG filter flooded with the ACCENT token — CORS rules out `mask-image`), `--z-bg < --z-fan < --z-content < --z-nav`. **reach fixed: horizontal 800, vertical 1100 (+ vertical zoom 0.86)** — each the edge of a stated constraint. ⛔ **Flip measured, failed, fixed:** framer's JS transforms dropped 13–26% of frames at 4× CPU; moved to compositor CSS → 2.7–4.7%, p95 17 ms. Real-device check = O35; trademark = O34. SESSION LOG (7). *Was:* ⏸ Queued 09-30, ✅ **MODEL DECIDED 09-30** after five interactive sketches. `BRAND_OUTLAY_AND_MOTION.md` §"THE DECK — DECIDED". ⛔ **Read the DECIDED section, not the SUPERSEDED one below it** — the file carries both, deliberately. **A fan of full-size cards on a shallow arc, pulled back so the whole dealt stack is in frame.** Front card face-up and square-on, exactly the ~700×380 card that ships today; the rest face-DOWN falling away either side. ⭐ **Two orientations, one model: desktop pivots RIGHT with HORIZONTAL cards; mobile/portrait pivots BELOW with VERTICAL cards.** The pivot and the orientation move together — mixing them is what made the early sketches unreadable, because a narrow card tilted 10° is unreadable while a 700px-wide one is fine. ⭐ **The back carries the COMPANY'S OWN LOGO, blurred, in accent orange** — that is what fixes the fan's fatal flaw, since a blank back meant rotating blind. Logos, never letters. ⛔ Click expands IN PLACE — no second view to route to, so the shared-element transition is free. ⚠ Geometry: zoom ~0.72, spread ~7°, reach ~900px — **`reach` is the parameter that decides whether the arc reads as a circle and cannot be split the difference.** ⚠ Scroll capture is an accessibility cost; the keyboard must do everything scroll does. ⚠ Measure the flip's frame budget on a real mid-range phone | — |
| A28 | **The deal, and the end-of-deck moment** | ✅ **10-01, local** — the deal (once per DAY: plays only when the server's `dealtNow` says this request dealt; front card arrives face-down, turns up last) and the end as a moment (what you drafted, with logos · what waits for review · "that is it until tomorrow", with the time to the next deal). SESSION LOG (7). *Was:* ⏸ Queued 09-30. Cards dealt one at a time on first view — ⛔ **once per day, not per navigation**, or the signal that today's draft is new means nothing. ⭐ **The end of the deck is a MOMENT, not an empty state**: a board is infinite and you never finish it; a deck has a bottom, and that is the product's only natural ending. What you drafted, what awaits review, and that is it until tomorrow | A27 |
| A29 | ⭐ **Shared-element transitions everywhere** | ✅ **10-01, local** — title morphs deck → board detail → review queue line, and Today → Auto Apply via the tab row. ⛔ **Premise corrected:** RR's `viewTransition` prop is a no-op under this app's `<BrowserRouter>`, and the `flushSync` fix ALSO did nothing (RR 7 commits navigations as React transitions) — a browser probe caught it after source tests passed; the callback now waits for the route's commit (≤ 200 ms cap; measured 73–151 ms in production). Draft flies to the measured counter; Pass drops under the fan by tier; overlay takes no pointer events. SESSION LOG (7). *Was:* ⏸ Queued 09-30. Highest perceived-quality return per unit of work. A job's title on a card **becomes** the heading in detail, **becomes** the line in the queue — same DOM node, no cross-fade, via the View Transitions API. ⛔ Every transition answers *"where did that go?"*: drafting flies the card to the queue indicator and the count moves; passing drops it **under** the fan, because direction encodes finality. ⛔ Neither may gate input — a card mid-flight must not swallow the next decision. ⛔ `prefers-reduced-motion` on every one; the chevron animation already has a test and that is the standard | — |
| A30 | **Login and signup, reimagined** | ✅ **10-01, local.** The deal behind the form (the deck's own logo backs, CSS, FAN tier) · type that sets once per page session · paper drifting ≤ 4px with a fine pointer · the `/` filling across the two signup steps · **a real ATS check as the hook** (the public deterministic scorer, a band, zero model calls) whose résumé is CARRIED, in memory only, into the new account's first profile. ⛔ **The form now waits for nothing:** its 200 ms entrance animation is gone — form ready **233–295 ms vs 452–754 ms before** (production, unthrottled); the deal costs it nothing measurable. SESSION LOG (8). *Was:* ⏸ Queued 09-30. ⛔ It is the first impression and it is currently a form. ⭐ **The deal as the sign-in background** — the product's own motion, not stock animation. ⭐ **A live ATS score as the signup hook**: paste a JD, get a real score, then sign up to keep it — free, deterministic, **zero model calls**, works for an anonymous visitor. Value first, account second. Type that sets once on first paint; paper that shifts with the pointer; the `/` as stepped-signup progress. ⛔ **None of it may delay the form** | — |
| A31 | **The landing page as find → fit → apply** | ✅ **10-01, local, screenshotted.** `FindFitApply.jsx` replaces the numbered feature grid (`BelowFoldContent`) and the feature marquee (`PosterBanner`, which promised "Claude rewrites every bullet") with one line: find → fit → apply, each tool a stop written as what it does for a person, both promises in display type, links only to what is public today (recruiter side: "Soon"). Hero, signup prompt and footer copy follow. 7 tests, 6 injected violations red, build clean, suite **2871 / 2871 / 0**. Screenshotted on the owner's go (10-01): 42 shots + 10 videos, `draft-screenshots/landing/`; found and fixed the hero tagline running to 4px of the edge at 390px. *Was:* ⏸ Queued 09-30. ⛔ draft is a **wrapper over several products** and the site advertises one. ⛔ **The failure mode is a feature grid** — six cards saying "ATS Scoring · Resume Generation · Auto Apply" tells a visitor nothing about which is for them. ⭐ **One verb, many surfaces:** the tools are stations along find → fit → apply, introduced where they belong, not in a catalogue. ⛔ Write each as what it does for a person, never as a feature name. ⭐ **The restraint IS the pitch** — *"nothing is submitted until you approve it"* and *"it will not claim anything you did not"* are differentiators, not disclaimers; every competitor sells volume and draft sells not-volume | — |

---

## QUEUED — added 2026-10-01

| | Task | Notes |
|---|---|---|
| A32 | ⛔ **Legal: terms, disclaimer, liability waiver** | **The candidate is responsible for what their résumé claims.** Users can overstate; models can hallucinate; neither should land on us. Needs Terms of Service · acceptable use · limitation of liability and indemnity · an explicit AI-output disclaimer · and the privacy policy aligned with all of it. ⚠ **Neither I nor the agent is a lawyer** — draft the structure and plain-language clauses, then have it reviewed before it goes live.<br><br>✅ **DONE 10-01 (audit item 7): removed from the landing page, login and footer; kept only as an operational notice inside the auto-apply flow and the deck's Draft toast.** ✅ **O10-01: the marketing lines are DITCHED** — *"nothing is submitted until you approve it"* and *"it will not claim anything you did not"* are not a selling point worth holding. They currently ship in display type on the landing page (A31) and must come out. That also **removes the terms-vs-marketing contradiction**, so the waiver can be written plainly.<br><br>⛔ **WHAT ACTUALLY APPLIES, and two of three are live TODAY:**<br>• **Trader status governs CONSUMER CONTRACT LAW** — mandatory contact disclosure, withdrawal rights on paid digital services, and unfair-terms rules. Under the EU Unfair Contract Terms Directive a blanket "not liable for anything" clause against a consumer is **likely unenforceable however it is worded**. ⚠ Almost none of this bites yet: no entity, no payments, free, non-trader declared. **It arrives the moment money moves** — so the declaration changes in the same pass as `monetisationEnabled`, and the waiver should be drafted for the trader case rather than rewritten later.<br>• ⛔ **GDPR APPLIES REGARDLESS of trader status** — free or paid, entity or individual, to anyone processing EEA residents' personal data. There is no geographic gate on signup.<br>• ⛔⭐ **WE STORE SPECIAL CATEGORY DATA.** The tokenization exclusion list names `gender`, `ethnicity`, **`veteran_status`**, **`disability_status`**, plus `work_auth` and `visa_type`. Under **GDPR Article 9**, ethnic origin and health data are special categories requiring **explicit consent** on top of a normal lawful basis, with heightened retention, purpose-limitation and onward-transfer obligations. They exist because US employers ask EEO questions and the resolver needs answers — a legitimate reason that does not remove the obligation. **This is the most concrete current exposure and should be reviewed BEFORE the terms page.**<br><br>⚠ **AND THE PART NO DOCUMENT FIXES: there is no LLC, so there is no corporate veil.** A claim over a fabricated résumé claim, or a breach of those columns, reaches the owner **personally**. A disclaimer lowers the chance a claim succeeds; an entity limits what a successful one can reach. The owner's stated bar is ~1000 applications before incorporating — ⛔ **the exposure started when the first real résumé with a disability field was stored**, not at a volume number |
| A33 | ⭐ **Résumé upload → profile prefill** | Standard practice, and **the machinery exists** — `parse-pdf` is live in Resume Master and the intake form already collects these fields. On upload, extract name, email, phone, location, titles, skills, education, dates and drop them in as a **PREFILL the user confirms**. ⛔ **Prefilled, never auto-accepted** — an extracted value the user never saw is a claim they did not make, the same line AG2's claims copy draws. ⛔ **Eligibility fields are NEVER prefilled from a résumé**: work authorisation, sponsorship, visa, clearance, EEO. Those are attestations. ⭐ It also improves the extension's handoff — a fuller profile fills more of an employer's form |
| A34 | ✅ **Done 10-01, read-only — SESSION LOG (11), O39.** ⛔ **ATS partnership — INVESTIGATE, build nothing** | ⛔ **Correct the premise first.** Reading a public job board (what we do) and SUBMITTING an application are different surfaces. **Partnering with an ATS vendor does NOT grant submission rights to their customers' postings** — each employer controls their own instance and authorises access individually. There is no single deal that unlocks "apply directly" across an ATS's customer base. ⚠ The admin panel's "not linked" almost certainly refers to **source configuration**, not a partnership — read what that flag actually means before concluding anything. **Establish:** what each ATS's submission API requires · whether any permits a third party to submit on a candidate's behalf · and **how comparable products actually do it** — browser automation like ours, a redirect, or real integrations. ⛔ Do not assume; several expensive detours here began with an assumed integration model |
| A35 | **Extension revamp to the new design** | The site is rebranded and re-palette'd; the extension still carries the old visual language. Popup, options page and the G3 review overlay need the cream/ink/orange tokens, the unified `StampLogo` and the new type scale. ⛔ **The review overlay matters most** — it is what a Web Store reviewer sees and what proves fill-and-review rather than auto-submit. ⚠ Any visual change means **regenerating the three store screenshots** (1280×800, 24-bit, no alpha, checked against the owner's real profile values) and a version bump. ⚠ **Coordinate with 36** — if the VM work changes the extension's data flow, do both in ONE submission rather than two reviews |
| A36 | ⭐ **VM / remote browser profiles — V1 to V5** | Owner: **build and wire BEFORE AF5 completes**, so testing moves straight from supervised applications into the VM path. `VM_EXECUTION.md`, extending `E3_SECURITY_DESIGN.md` — ⛔ read the security design first, do not re-derive it. ⛔ **Device sign-in + session upload, NOT a streamed sign-in** — the security design corrected its own parent: a streamed sign-in passes the password through our servers. The user signs in on their own machine; only the SESSION leaves. ⛔ Envelope encryption, KEK **outside the app env**, crypto-shred revocation, cookies and localStorage only. ⛔ **The `/api/apply/session/*` 410 reversal must be RECORDED**, not quietly arrive. ⚠ **SEQUENCING RISK:** one real application completed, semi mode runs neither the completeness nor the low-confidence gate, full-auto has never run unattended against a real employer. **V5 is the mitigation — build it all, but it may not submit unattended until AF5 AND a supervised full-auto run have both passed.** ⚠ V2 changes the extension's data flow and therefore its Web Store declaration, policy and reconciliation join |
| A37 | ✅ **Done 10-01, local (`da04146`, merged `eea1162`) — SESSION LOG (11), O38. Locally 28.7% held out, not a majority.** ⛔⭐ **THE BOARD IS MAJORITY NON-US AND THE PLATFORM IS US-ONLY** | ⏸ Queued 10-01 by the owner. Dublin, Bangalore, Singapore and Hyderabad postings have all been observed on the board. ⛔ **draft is strictly US-based** — non-US postings are not just noise, they are **rows a user can never act on**, and they dilute every curation measurement taken so far. **MEASURE FIRST:** how many active rows are non-US, by source, before changing anything. ⚠ **"Remote" is the hard case** — remote-from-where is often unstated, and `workplace_type` does not answer it. Decide explicitly how an unqualified "Remote" is treated, and ⛔ **do NOT let an unparseable location default to INCLUDED** — that is the NULL-propagation shape that took this board to zero four times, in the other direction. ⚠ **Decide WHERE to filter.** Ingestion means never storing what cannot be used; query-time is consistent with the store-then-filter architecture. ⛔ Ingestion is probably right here, because unlike a curation filter this is not a per-user preference — it is a property of the whole product. ⚠ **Every figure measured to date was taken over a board containing rows that should not exist** — ρ, the band cutpoints, the 3.0% entry/intern finding. Say which need re-deriving after the fix |
| A38 | ✅ **Done 10-01, local (`ecb1906`, migration 114) — SESSION LOG (11).** **Deck geometry as a user control** | ⏸ Queued 10-01 by the owner. The sketches exposed **zoom, spread and reach** as sliders and the look was *found*, not specified. ⭐ Shipping them as a user control is a real engagement idea — and ⭐ **it is also an accessibility feature if framed that way**: letting someone flatten the arc and reduce the sweep is the same thing as reducing motion. ⚠ Not raw sliders in a settings page — most people do not want to tune a radius. **Presets with a reveal for the sliders** is the shape: *tight / standard / wide*, plus the three controls behind "customise". ⛔ **Clamp the ranges.** The sketch had values that break the layout at the extremes; the UI must not be able to produce them. ⛔ Persist per user. ⛔ `prefers-reduced-motion` still overrides everything, whatever the user picked |
| A39 | ✅ **Done 10-01, local (`0bcc7a0`) — SESSION LOG (11).** **Collapse control at the top, and one word** | ⏸ Queued 10-01. Collapse is only reachable at the **bottom** of an expanded card, so you scroll the whole posting to get out of it. Put it at the **top** as well — sticky, so it is reachable at any scroll position. ⛔ **The label is "Collapse".** One word. Not "click to collapse", not "collapse the card". ⚠ Same reasoning as the Pass / Save / Draft row sticking rather than scrolling away with the content |
| A40 | ✅ **REBUILT 10-02 as two equal panels (`e5722f8`, `596d6b4`; contract 1.3.0) — SESSION LOG (14).** ⛔ **REOPENED 10-01 — WHAT SHIPPED IS NOT THE DESIGN.** ⭐ **Expanded card — TWO equal panels: ATS │ card** | ✅ **MODEL DECIDED 10-01 after three HTML sketches. `BRAND_OUTLAY_AND_MOTION.md` §"THE EXPANDED CARD — DECIDED" is authoritative; the text below describes the WRONG three-column build (`8c38dd2`, `da73ff9`).** ⛔ **TWO equally sized panels, not three.** The posting stays **INSIDE the card**, growing downward — it does NOT move to a third right-hand column. ⭐ **The collapsed card is COMPACT:** logo, company, title, and **one ATS signal line** (*"Strong match · 9 of 12 matched · tap for the report"*). No chip rows — it is a two-second decision. ⭐ **On click FOUR things move on ONE clock — same duration, same easing, NO stagger:** the grid goes `0fr 1fr → 1fr 1fr` · the deck arc translates right · the ATS signal collapses to zero height · the posting grows inside the card. ⭐ **The `0fr → 1fr` grid transition is the trick** — the card is not animated to a new position; the left column grows from nothing and **pushes** it. That is "makes way", not "slides over". ⛔ **NO STAGGER** — a 0.2s delay on the ATS panel read as two separate events instead of one motion. ⚠ **Duration ~0.9–1.3s**, deliberately slower than a normal transition; expose it as **ONE CSS custom property** so it is tunable without touching four rules. ⭐ **The expanded card carries NO ATS chips** — the report is beside it. The chips collapse via `max-height` on the same curve as the posting grows, so it is **one continuous height change, not two jerks** (verified in the sketch). ⛔ **The left panel is the FULL ATS report** — fit band, skills matched/missing with the claim note, verbs matched/missing, generic language, experience fit — **not** the "Why it's here" chip summary. ⚠ The two panels will be different heights; accepted. ✅ **MOBILE: keep the vertical fan. The ATS signal line is the tap target and opens the report as a SHEET.** ⛔⭐ **SWIPE IS DISABLED WHEN THE CARD IS EXPANDED** — collapsed is triage (swipe freely), expanded is consideration (buttons only). Axis-locking alone is not enough: reading a long posting means heavy vertical scrolling, thumbs drift, and **a Pass is final by design**. This removes the conflict rather than tuning a threshold that will still misfire | ⏸ Queued 10-01 by the owner. Today expansion grows **downwards** and leaves the left and right thirds empty. **On expand:** the card shifts slightly right · the **deck arc slides right** behind everything · an **ATS panel opens on the LEFT** · the **job description sits on the RIGHT**. ⭐ Three columns, the full width used, and the depth comes from the arc moving behind the new panels. ⭐ **The content already exists** — this rearranges the ATS report and the posting, it does not invent anything. ⛔ **The card is still the element that expanded** — the panels flank it, they are not a second view, so the no-routing property holds. ⚠ **Needs a narrow fallback**: below the three-column width the panels stack or tab, and the deck returns to the vertical orientation. ⚠ The old UI had JD, ATS and PDF as **stacked overlays fighting for one z-tier** — this replaces that, so check nothing still routes to the old panel surface |
| A41 | ⛔ **Real email on `jobsviadraft.com` — transactional AND mailboxes** | ⏸ Queued 10-01. Two separate needs: **transactional** (password reset, email change, support replies) and **named mailboxes** (`yellela.s@jobsviadraft.com`, pattern `lastname.firstinitial@`). ⛔ **THE CONFLICT TO CATCH FIRST: Cloudflare Email Routing and a real mailbox provider BOTH want the domain's MX records, and you can only have one set.** Routing currently forwards `privacy@`; it **cannot send as** an address, so named mailboxes need a real provider — Zoho (free tier for a handful of users), Google Workspace (~$6/user/mo), Fastmail. **Moving to one means replacing Cloudflare's MX and re-creating every forward there.** ⛔ **ONE SPF RECORD ONLY** — a domain with two SPF TXT records fails validation entirely and *both* inbound and outbound start getting quarantined. Resend is already verified via CNAMEs, so merge any provider `include:` into the single existing record rather than adding a second. ⚠ DKIM can coexist (different selectors). ⚠ The inherited `_dmarc` is `p=quarantine` with `rua` pointing at **GoDaddy's** reporting service — so misconfigured mail fails **silently** and nobody sees the reports. Update `rua` to an address you read. ⚠ `RESEND_API_KEY` and `EMAIL_FROM` are still unset on draft (O28) — until they are, forgot-password **correctly** 503s rather than claiming it sent |
| A42 | ⭐ **Recruiter signup gated to corporate domains** | ⏸ Queued 10-01 by the owner. Recruiter accounts require a company domain — no Gmail, Yahoo, Outlook, Proton, iCloud or the rest. ⛔ **Blocked on 41**, because testing it needs a real address on our own domain. ⚠ **BUT A DOMAIN IS NOT AN EMPLOYER.** Anyone can buy one for $10 and have a "corporate" address, and disposable-domain services exist. **A generic-provider blocklist is a first filter, not verification** — and a static list goes stale, so it needs a maintained source. ⭐ **Pair it with the company-KB check already designed in `RECRUITER_LAYER.md`**: match the email domain against known employers. That is what makes *"a recruiter at Stripe"* mean something rather than being a claim. ⚠ **Independent and agency recruiters are legitimate and will have their own domains** — do not design a rule that only admits F500 employees. ⛔ Say plainly what the check does and does not prove, in the UI and to the candidate |
| A43 | ⛔⭐ **THE COMPANY LIST IS THE BOTTLENECK — audit and expand it** | ⏸ Queued 10-01 after the owner found Ashby jobs by hand that are not on the board. ⭐ **Full strategy: `COMPANY_LIST_STRATEGY.md`.** ⛔ **ANSWER THE PREMISE FIRST, IN WRITING: `ashby/linear` means LINEAR'S JOBS, HOSTED ON ASHBY.** There is no "all jobs from Ashby" endpoint — each employer has its own board and no ATS publishes a cross-customer feed. ⭐ **The board grows by adding COMPANIES, not SOURCES.** ~25 configured against ~2,200 that exist. ⛔ **STEP 1 IS A MEASUREMENT, NOT A BUILD:** take ten hand-found missing jobs and ask per job *was the company configured?* — **coverage and freshness are different problems and a coverage project will not fix a freshness bug.** ⚠ **And ask the uncomfortable question first:** a daily draft is 10 jobs/user/day against ~2,616 active rows locally (~1,866 US after A37; production ~2,663 before it) — for pure volume 25 companies is already more than one user can consume, so establish whether the real gap is specific companies, staleness, or the non-US majority. ⭐ The two channels that compound are **the extension as a discovery channel** (a capture URL reveals ATS + slug, perfectly targeted, zero cost) and **mining adzuna/serpapi results for slugs** (both configured, both contributing 0 rows today). ⛔ **A list is MAINTAINED, not imported** — companies move ATS, and a 404 must be distinguishable from an empty-but-alive board. ⚠ Growth is paced by enrichment capacity; sequence behind 37 |
| A44 | ✅ **Done 10-02, MERGED `a95bae0` (`1d81e96` + migration 115 `0aea3cf`) — SESSION LOG (13).** Liveness, not cadence; OUTSIDE US / NOT ENABLED / PAUSED states; enrichment-stopped alert; Ashby dates fixed. **Pipeline Health — verify each warning, and check the threshold itself** | ⏸ Queued 10-01. Panel shows **4 CRITICAL, 10 WARNING**. ⛔ **Triage into three kinds, because they are not the same problem:** • **Genuinely unconfigured:** `workday` and `smartrecruiters` have **no active companies** — that is accurate, they were never enabled. `jobo` is a **402 payment-required**, wallet exhausted, last OK **50 days** ago — ✅ **owner 10-01: waiting, deliberately.** • **A real defect:** `recruitee/hygraph` is an active company with **zero rows** — the panel's own words are "a dead slug, or its postings were dropped before they were written". Find out which. • ⚠ **Possible alarm fatigue:** ten WARNs are all "no row seen in Nh (threshold 48h)". **MOST COMPANIES DO NOT POST A NEW JOB EVERY TWO DAYS**, so a 48h threshold may be flagging healthy small boards. ⛔ **Check the threshold before chasing the warnings** — this project already shipped a source-health panel that reported a working source as critical because it counted the wrong column. ⭐ **BUT THREE ARE SUSPICIOUS AND WORTH REAL ATTENTION:** `lever/openx`, `workable/persado` and `workable/skroutz` all read **542h** — identical to the hour. That is not independent companies going quiet; that is a set of slugs that died together. ⚠ Also: `lever` shows **6 rows with no description** |
| A45 | ⭐⭐ **SLUG HARVESTING — aggregators are the discovery layer, ATS boards are the freshness layer** | ⏸ Queued 10-01. ⭐ **The central idea in `COMPANY_LIST_STRATEGY.md` §3C, and the owner's own insight.** `adzuna` and `serpapi` see the **whole market** at 2–3 days old; the ATS boards see only ~25 configured companies, same-day. ⭐ **An aggregator result's URL contains the ATS host AND the company slug** — so every search does not just find a job, **it finds a company, permanently.** Configure that company once and every future posting arrives on day one, direct, for free. **Each search converts a slice of the market from "2–3 days late" to "same day" and never needs repeating for that company.** ⚠ **This is also why a one-person list cannot win** — the owner can name twenty companies; the market has thousands. **HARVEST FROM ALL FREE SOURCES:** (a) aggregator search results · (b) extension captures — the URL is already sent to us · (c) **jobs opened from our own board** — we already hold the URL · (d) **apply / handoff targets** — we already hold the origin. ⛔ **ALL FOUR ARE FREE AND DISCLOSE NOTHING NEW.** ⛔⛔ **BUT "VISITED JOBS" IN THE BROWSER IS NOT** — reading pages the user did not invoke on needs a content script or broad host permissions, and the published listing says in terms: *"No background activity: there is no content script, so nothing runs on page load."* That would be a **fundamental change to the extension's privacy model**, a new Web Store declaration and a fresh review. ⛔ **Do not build it. Use (a)–(d), which cost nothing and change no disclosure.** ⛔ **Validate every harvested slug before enabling** — §4; a URL proves a page existed, not that a board is worth crawling. ⚠ Track the new-company conversion rate per search: when it falls toward zero the market is covered for that role family |
| A46 | ✅ **Done 10-02** — "Connected" / "Not connected"; `accountSignInLabel` refuses "linked" (injected: red). **"Not linked" → "Not connected" on the Account page** | ⏸ Queued 10-01, trivial but worth doing. `AccountPanel.jsx:137`. It means *you have not connected a Google, LinkedIn or GitHub sign-in* — and the owner read it as an **ATS integration status**, which triggered a whole strategy investigation. ⭐ **A label that causes a strategy question is the best possible argument for fixing the label.** One word |
| A47 | ⛔⭐ **AF5 PRE-FLIGHT — do these before the thirty applications** | ⏸ Queued 10-01. ✅ **CORRECTED 10-01: the board is NOT 58% non-US. Measured locally it is 71.3% US** — 750 of 2,616 rows held out (710 non-US, 12 "Remote" with no region, 28 unreadable). **I wrote 58% from an unverified remark and propagated it; Agent B measured it.** • ⛔ **TEST THE RECORDING PATH FIRST, WITH ONE APPLICATION.** `recordAtsOutcome` has **never fired** — every `resume_generate` event since it landed carried `job_id = null`. Run ONE, confirm `job_applications` holds a row with `ats_score_at_apply` populated, THEN run the rest. **That data is unrecoverable once the applications are sent.** • **Test ATS scoring broadly** — deterministic and free. Ten jobs you know; do the bands match your judgement? • **Test generation narrowly** — ~4¢ a run. Three jobs, read for **content never claimed** and **the role stated three times** (A21). • ⭐ **HAND-PICK THE THIRTY** — still right, but for a different reason than I gave: not because the board is mostly non-US, but because it is **missing companies you care about** and ~20% of rows currently score "not enough signal" (A48). AF5 tests the **pipeline**, not the curation. ⚠ These go to real employers under your real name. ⭐ It also produces the hand-found URLs A43 needs |
| A48 | ✅ **EXPLAINED 10-02 — not a scorer defect: ENRICHMENT COVERAGE.** SESSION LOG (12). Unblocks A40, O40 and AF5's ATS test. ⛔⭐ **"NOT ENOUGH SIGNAL" JUMPED FROM 0.1% TO 20.5% — UNEXPLAINED** | ⏸ Queued 10-01, found by Agent B while measuring something else. **537 of 2,616 local rows now score "not enough signal", against 0.1% recorded earlier.** That is a **200× change** and nobody has explained it. ⛔ **DO NOT QUOTE ANY BAND POPULATION UNTIL THIS IS RESOLVED** — Agent B said so explicitly, and the deck shows bands, so this is not cosmetic. ⚠ **"Not enough signal" is the scorer DECLINING, which is a correctness state, not a low score** — if a fifth of the board cannot be scored, the daily draft has a real problem. **Candidate causes, measure do not guess:** the scorer's own decline conditions (JD too short to extract from · base résumé missing · a role family with no weight table · near-zero extracted terms) · `ats_term_weights` staleness — the table was ~19.6 days old against a 45-day limit and goes stale **~2026-10-13**, days away · anything CC1–CC5 or the seniority guard changed · or the measurement itself differing from the one that produced 0.1%. ⛔ **Establish WHICH, with evidence.** This project has repeatedly found that a number moving 200× means a guard or a measurement changed, not that reality did |

| A49 | ✅ **Audited 10-02, nothing built — SESSION LOG (13).** Six defects; A43 needs 1 + 4 fixed first, A45 needs 1–5 + a production re-measure. ⛔⭐ **DEDUPLICATION — audit the pipeline before adding sources to it** | ⏸ Queued 10-01 by the owner. ⛔ **Every growth decision on this page multiplies duplicates.** A43 adds companies, A45 harvests slugs from aggregators, and users import their own URLs — so **the same posting will arrive from several directions**: an aggregator result AND the company's own ATS board AND a user's capture. ⚠ **MEASURE BEFORE CHANGING ANYTHING.** How many duplicate groups exist on the board today, by what criterion, and which sources collide most? ⭐ **The machinery already exists** — `reconcileFingerprint` and `computeReqUid`, with a canonical priority of **direct ATS > provider > aggregator > import**. ⛔ **Do not build a second deduper.** Audit the one that exists: where does it key, what does it miss, and does every writer actually route through it? A new source bypassing it is the recurring Shape 1 defect. **The hard cases, each needing a stated rule:** • **the same job from a different source** — an aggregator URL and an ATS board URL for one posting. Canonical priority says the ATS row wins, but ⛔ **the duplicate must DONATE anything the canonical row lacks** (a salary, a description) rather than being discarded, as the salary-donation path already does. • **the same job reposted** by the employer with a new id — same title, same company, days apart. ⚠ Genuinely ambiguous: a repost and a second opening look identical. • **near-identical postings for different locations** — one role listed in three cities is three real jobs, not one. ⛔ **Do not collapse these.** • **a user's own imported URL** colliding with a board row. ⛔ **Dedup must never silently drop a user's own capture** — it should attach to the existing row and say so. ⚠ **Soft-delete, never hard-delete, and log the reason.** A duplicate that is actually a distinct job and gets deleted is unrecoverable; one that is retired can be restored |
| A50 | ✅ **Audited 10-02 — SESSION LOG (13); stop-the-harm queued as A51.** ⛔⭐ **ADMIN PANEL REVAMP — it is from the Resume Master era and the product has pivoted repeatedly** | ⏸ Queued 10-01 by the owner. ⛔ **Design doc first: `ADMIN_PANEL_REVAMP.md`. Do not start building from this row.** The panel was designed when this was a single-user résumé tool; it is now a two-sided job platform with a second stateless service, an extension, two mobile clients and a recruiter side. **It has not been redesigned once in that time**, and ⚠ one of its labels ("Not linked") was misread as an ATS integration status and triggered a whole strategy investigation — **that is what an outdated panel costs.** ⚠ **It is also the most load-bearing surface in the project for diagnosis** — Pipeline Health, the DB inspector and the usage ledger are how almost every defect in this codebase was found. ⛔ **Do not break that while making it prettier** |
| A51 | ✅ **DONE 10-02 (`a56e931`) — SESSION LOG (15).** ⛔⭐ **ADMIN — STOP THE HARM (A50 step 1). Queued 10-02 by the owner: run AFTER A40.** | Three fixes, nothing cosmetic: **(1) "🧹 Clean Pool" deletes users' Saves and PASSES in one click** (`DBInspector.jsx:1458-1464`, `:1622-1625` → `routes/adminDb.js:1170-1196`: `DELETE FROM user_jobs` for every row not applied and not tagged to the active profile — no confirm, no dry run, no count). Passes are the persisted "never deal again" decision, so one click re-deals passed jobs and wipes other profiles' decisions — the `cleanup_log` id-85 class. ⛔ Remove it, or dry-run by default with the exact count and a typed confirm, and never touch passes/saves. **(2) Raw query is not read-only** — a keyword blocklist, not a read-only connection; it materialises the whole result in production memory before trimming to 200. ⛔ Open a `readonly: true` connection and enforce the LIMIT in SQL. **(3) Table Browser serves any table** (`assertReadableTable`) — including `users.password_hash`, tokens and sessions — while the export route uses an allowlist. ⛔ Redact secret columns (or reuse the allowlist). ⛔ Do not break diagnosis: Table Browser, Job Trace and Schema must keep working. Tests with injected violations; the rest of A50's order (wrong numbers → curl-only UIs → daily glance → restyle) stays in A50 |

---

## ⛔ OWNER — company and compliance → **lives OUTSIDE this repository (10-01)**

⛔ **Owner-only business, legal and financial material is kept out of the repo entirely** (`CLAUDE.md` §
"What may go in this repository"). Do not restate it here and do not put product tasks there.

**The three that touch engineering, and only these:**

| | |
|---|---|
| ⛔ **GDPR / Article 9** | `gender`, `ethnicity`, `veteran_status`, `disability_status` are stored. **Applies today** — no entity, payment or trader threshold. Affects consent UI, retention and the cross-service flow to Resume Master |
| **Monetisation gates** | The flag stays off until the entity, terms, privacy, processor and the trader declaration are all in place. Flipping it is not a code decision alone |
| **A42** | Recruiter domain gating is a product task, but what it *proves* is a legal question — see `LEGAL_AND_COMPLIANCE.md` |

⚠ **Where funding is concerned, the honest position: one real application sent, zero users,
`job_applications` empty.** That is pre-seed by any measure. ⭐ **The cheapest thing that changes it
is not more product — it is AF5 plus real users.** Investors fund evidence of demand, and there is
none yet because nobody has used it.

---

## QUEUED — added 2026-10-01 (second batch; ids A52–A53, renumbered 10-02)

| | Task | Notes |
|---|---|---|
| **A52** | ⛔⭐ **THE ATS REPORT IS ONE MODULAR COMPONENT, NOT A DESTINATION** — ⚠ **10-02: renumbered from "A51" (that id was already queued and pushed as admin stop-the-harm). Partly overtaken: the A40 rebuild (`596d6b4`) renders the board's OWN `ATSPanel` in place in the deck's left panel and in the mobile sheet — the redirect observed was the three-column build. Still open: confirm ONE implementation across the board's side panel, the deck, the sheet and the public tool, and a guard that refuses a second.** | ⛔ **A40's expanded card REDIRECTS TO THE BOARD instead of rendering the report in place.** The owner's point: **it can be shown anywhere modularly — there is no reason to navigate to it.** ⭐ **One implementation, four surfaces:** the deck's left panel · the board's side panel · the mobile sheet · and the free public ATS tool (R1). ⛔ **This is the StampLogo lesson exactly** — three implementations of one mark existed, the rebrand swept two, and the third shipped the legacy name on every page while the guard passed green. **A second ATS-report implementation will drift the same way.** ⛔ A redirect here is not a UI decision, it is a **missing component**. ⚠ Check what the card snapshot holds — if it carries only 6 matched / 4 missing, the component renders a truncated report, and that is a `services/dailyDraft.js` dependency, not styling |
| **A53** | ⭐ **UNIFORM STYLING SITE-WIDE — the old board is still pre-rebrand** | ⛔ **VOCABULARY FIRST; it matters more than the styling.** The board card offers **Generate · Apply · Queue Auto · Save · Pass · Cover Letter**; the deck offers **Pass · Save · Draft**. ⭐ **"Queue Auto" IS "Draft"** — the product's verb is *draft*, the brand is *draft*, and two names for one action teaches two mental models. Rename it and audit every surface for the same split. ⚠ **Six buttons against three also means the two surfaces disagree about what a user DOES with a job** — decide which is right rather than restyling both. **Then the styling:** cream/ink/orange tokens, `StampLogo`, the new type scale, the deck's button treatment. ⛔ Use the token file — the guard fails on any colour outside it. ⚠ **Sweep every surface:** Auto Apply, Job Profiles, Database and the Recruiter stub were all built at different times and none has been through the rebrand |
🔸 ⚠ **10-02: NOT explained by A48** (A48 = enrichment coverage, measured with ONE scoring path; this is two paths disagreeing) — **still open, attach to A52.** **A48 evidence, observed 10-01:** a board card header reads **"No signal"** while its ATS panel, open beside it, reads **"Strong match"**. ⛔ **Two scoring reads disagreeing on one screen.** The card badge reads a **stored** value; the panel computes **fresh**. Precedent: `aj2fixture::moderate-upper` stored 43 (Moderate) and scored null (No signal). **Feed this into A48** — it may be the whole explanation for 0.1% → 20.5%, or an independent stored-vs-fresh defect, and the difference matters.

---

## QUEUED — recruiter layer and KB (accepted 09-30, not yet scheduled)

Full detail: **`RECRUITER_LAYER.md`** (reasoning) and **`RECRUITER_LAYER_EXECUTION.md`** (the work).
All proposals accepted by the owner. ⛔ **Nothing here is in the running queue yet** — this is the
next body of work once the current one is through.

### ⭐ These two block on NOTHING — build when there is capacity

| | Task | Why it is free to start |
|---|---|---|
| **K1** | **KB sanity check on generation** | ⭐ **Attacks G1 directly.** Extends the 9.6 failsafe to check GENERATED output against company facts — a claimed team, title or technology at a named employer. ⛔ Will NOT catch everything ("Kafka" is not a company fact); say so rather than over-claiming. ⛔ Extend the failsafe, never build a second checker. ⛔ The Bangalore precedent: a false "this does not match" against a TRUE claim is the costly error |
| **R1** | **Grade the employer's posting** | ⭐ No candidates, no consent surface, no matching, no recruiter accounts — just the existing extractor pointed at a JD. Zero model calls. The recruiter-side acquisition hook before the two-sided product exists. ⛔ Comparative, never absolute: *"your posting names 3 technologies; the median names 11"*, not a score — the "58 beside Strong match" lesson. ⛔ Never a public league table of employers |

⚠ **Status 10-01:** K1 and R1 are BUILT (A23, A24 — decoupled; K1 is not wired into generation).

### The rest — regenerated 10-01 from `RECRUITER_LAYER_EXECUTION.md` (the 09-30 originals were lost to a truncation)

| | Task | Blocked on | The constraint that matters |
|---|---|---|---|
| **K2** | KB in ATS scoring | K1 | ⛔ `scoreAtsLocally` stays deterministic, local, free, ZERO model calls — load-bearing for the daily draft, the free band and the free MCP tool. **Precompute into the scoring input, never query per score**; if that cannot be done cleanly, stop and report. ⚠ Measure ρ before and after — G1's synonym table moved ρ by +0.000 |
| **K3** | KB over API + MCP | ⚠ ATS scoring exposed first | ✅ **Premise answered by A11:** Resume Master's `/mcp` serves `score_ats_fit` (0 model calls) since `6e1837d`. ⛔ Companies and roles only — **no individual dossiers**, and that becomes a contractual promise once it is an API. ⛔ Every answer carries confidence and provenance. ⚠ `is_h1b_sponsor` NULL = no signal, never "does not sponsor" |
| **P1** | Job profiles into account management | nothing (low value alone) | ⛔ Relocate the EDITING surface, change NO schema — `domain_profiles` scopes the board, scorer, bridge, generation and CC5's keys. ⭐ The value is the fix: `/signals/refresh` and a résumé re-upload SILENTLY OVERWRITE user edits; auto-extracted vs user-asserted terms must be distinguishable in the store |
| R2 | Public candidate profiles | real users (⛔ not before AF5) | Opt-in PER PROFILE · blind by construction · revocable · nothing shared by default · both privacy policies and the Web Store declaration change · state the §7 line (a consented profile is not a "dossier") in code and policy |
| R3 | Recruiter accounts + verification | R2 | Separate signup, session scope and role — not a flag. ⭐ Employer verification via the company KB (pairs with A42). ⛔ The ATS-partner tier is NOT this — it buys the scorer/parser as an API and never touches candidate data (A34 confirms: no partnership grants submission) |
| R4 | The reverse draft | R2, R3 | ⭐ The SAME scorer both directions — no second engine. Show BOTH bands, never averaged. ⛔ Caps on both sides; unlimited recruiter search destroys the model. Reuse the deck |
| R5 | Double opt-in + contact | R4 | ⭐ The single most important mechanic: contact only after both accept. ⛔ A pass is final — no re-surfacing nudges. Each side sees which terms matched |
| R6 | Accountability signals | volume | Recruiter response rate MEASURED, never self-reported; meaningless below real volume |

**Sequence:** R1, K1 (done) → K2 → K3 · P1 any time · AF5 → real users → R2 → R3 → R4 → R5 → R6.
⛔ Everything from R2 waits on AF5 and real users — a two-sided marketplace with no candidates and
unvalidated matching is a demo, not a product.

---

## ⛔ OBSERVED IN PRODUCTION — 2026-09-29, first real generations

The first time anyone read real output end to end. **Seven findings, none blocking the domain move,
several blocking AF5.** Recorded so they are not lost in the split's momentum.

### ⛔ G1 · Generation invents content — AF5 unblocked by the owner 09-30 (supervised)

Agent-found. Two real documents said things the candidate never did: **Kafka, lifted from the job
ad**, and two unsourced responsibility bullets ("Collaborated with risk and infrastructure
teams…", "Instrumented service-level metrics…") plus an unsourced skill.

⛔ **The prompt forbids this. The claim guard only checks YEARS and SENIORITY, so both passed.**
Not new with the split — the same prompt draft always used. An unsupported-content check is queued.

⚠ Two samples on a deliberately thin test résumé show the problem exists; they do not give a rate.

✅ **Which prompt — answered 09-30, from the 09-28 run's own scripts** (`draft-e2e.mjs` and
`draft-e2e-save.mjs`, kept in that session's scratchpad): **both documents are `mode: "GENERATE"`** —
the standard Generate prompt, module `engineering`, the SAME request sent twice through draft's own
client, against a JD whose stack was "Go, Kafka". The first run listed **Kafka**; the second (the one
saved) invented the two responsibility bullets. ⛔ **Neither was A+.** The live verifier's generate
scenario ("Build services in Go.") mentions no Kafka and is not the source. So "A+ is deliberately
generative" is true and does not cover this: the prompt that fabricated is the one that says
"Generate bullets ONLY from the candidate's real experience". The owner's unblock of AF5 stands on
supervision — every document read before it is sent — not on the fabrication being A+'s.


### G2 · The generated résumé looks barely changed — owner-observed

Against the owner's real (thick) résumé, output reads close to the input. ⚠ **In tension with G1**,
which was measured on a thin one — a thin résumé may invite padding while a thick one gets almost
nothing. **Neither the change rate nor the invention rate is measured.** Both need a real sample,
not two anecdotes.

⛔ Open and unverified: **is generation even being triggered on the web route?** The usage record
from the owner's run is the check, and the agent is waiting to read it.

✅ **Answered, agent-measured 09-28 from both services' logs: YES.** The owner's run went
`/api/generate` → the tools service in 28.6 s, module `engineering`; the claim guard inspected 5,678
chars; `usage_events` got a `resume_generate` row (user 3, Sonnet 5, 3,979 in / 3,798 out,
**$0.0635**, a cold 7,009-token cache write); and the lift was recorded **42 → 58 (+16)**. Resume
Master's metering line matches to the token. So the model ran and the scorer saw a 16-point change —
"barely changed" is then a question about WHAT changed, which still needs the real sample above.

### ⛔ G3 · AG4's duplication defect is LIVE AGAIN

The generated résumé shows a role stated three times:

```
Stripe | Software Development Engineer, Payments Infrastructure Bangalore
Software Development Engineer, Payments Infrastructure        ← italic restatement
Bangalore
```

⛔ This is **exactly** AG4's shape, and AG4's tests pass: *"a model's plain-text restatement of the
header and bullets is read, not reprinted"* · *"a nested entry-header does not leak its date into
the body"*. **Green tests, live defect** — the eighth instance of that pattern. The tests assert
something narrower than the behaviour, or the path has changed under them.

Corroborated independently, agent 09-28: the agent's own second real generation (synthetic résumé,
Stripe role) extracted as `Stripe | Software Engineer 2021 - 2025 Software Engineer 2021 - 2025` and
`B.S. Computer Science 2021 B.S. Computer Science 2021` — the same role-restatement shape, on a
different résumé. Two independent documents, so it is not a one-off input.

### G4 · Formatting need not be a model call at all — and mostly already is not

⭐ **The owner is right, and it is closer to true than it looks.** Formatting is deterministic
(`resumeFormatter.js`). The LLM formatting pass is behind `RESUME_MASTER_LLM_FORMAT=1` and A2 found
**zero `resume_format` events ever** — it has never run.

⛔ But the stale artifact remains: `FORMATTING_SYSTEM` still carries **35 of the renderer's 43 CSS
lines describing a design the renderer ABANDONED**. So the prompt spends tokens on, and could
instruct a model toward, a layout that no longer exists.

⚠ **Correction, agent 09-28: that artifact is already gone.** A2 rebuilt `FORMATTING_SYSTEM` in Resume
Master FROM `RESUME_STYLE_BLOCK` (a test fails if its source restates any CSS), and A4 deleted
draft's copy along with the unused `server.js` stylesheet. What is left is only the decision below —
and it is now a decision about Resume Master's code, off by default and never run.

**Decide:** delete the LLM format path outright, or rebuild its prompt from the renderer's CSS.
Deleting is cheaper and nothing uses it.

### ⛔ G5 · The ATS panel shows a NUMBER and a BAND, and they read as contradictory

The panel shows **"ATS Score 58"** beside **"Strong match"**.

⛔ **The band is CORRECT** — the Strong cutpoint is 44 at 100% precision, and v4's median is 28, so
58 is comfortably Strong. **The defect is showing the number at all.** 58/100 reads as a failing
grade to a human; ρ = 0.746 supports coarse ordering and not a displayed figure; and the mobile
contract already marks `matchScore` **INTERNAL — DO NOT DISPLAY**. The desktop panel never got the
same treatment.

**Fix: show the band, drop the number.** `UI_REDESIGN.md` already says this; it is live today and
does not need to wait for the redesign.

### G6 · The generic-language classifier has gaps

A "Generic language" section exists and correctly holds *Managed, Partnered, Coordinated, Grew* —
but **"Defined" and "Created" are listed as MISSING VERBS**, and **"collaboration" as a MISSING
COMPETENCY**.

All three are things almost any candidate could claim, so surfacing them as gaps implies a
deficiency that is not real. ⛔ AH3 built exactly this suppression and set a specificity threshold;
these three sit the wrong side of it. Note the corpus head is **soft skills, not technologies** —
*collaboration* appears 199 times — so the threshold is under-tuned rather than absent.

### G7 · Resume Master's Railway URL errors in a browser — ⚠ CHECK BEFORE THE DOMAIN MOVE

`resume-master-production-d960.up.railway.app` returns an error when opened directly, while the
agent's live verifier passes **24 of 24 scenarios** against it.

⚠ **Most likely benign** — an API-only service has no route at `/`, so a bare visit 404s. But
⛔ **confirm what the root returns and that it is intentional BEFORE moving `resumemaster.one` onto
it.** A domain move onto a service that genuinely errors makes the failure public, and this project
has five precedents of a status code being read as evidence in the wrong direction.

✅ **Confirmed before the move, agent 09-28, with a browser's own request** (Chrome user-agent,
`Accept: text/html…`): `/` → **404 `application/json` `{"error":"not_found"}`**, and `/favicon.ico` and
`/robots.txt` the same. INTENTIONAL: the service has no root route, its catch-all answers every
unknown path with a JSON 404 by design (the opposite of draft's SPA catch-all), and that is declared
in the contract (`x-not-found`) and pinned by two envelope-harness scenarios. A browser renders it as
raw JSON on a 404 — which reads as an error, and is not one. ⚠ Consequence accepted: since step 4,
anyone opening `resumemaster.one` sees that JSON. A human-facing root is a contract change (a route,
so a version bump) if ever wanted.

✅ **Re-confirmed 09-29 by SCREENSHOT in real Chrome** (headless, driven by puppeteer): both
`https://resumemaster.one/` and the Railway URL render Chrome's JSON viewer showing
`{"error":"not_found"}`, HTTP 404, no page title, no failed sub-requests; `/v1/version` on the same
domain renders 200 with `service: "resume-master"`. **Owner decision: keep the JSON 404.** Closed.

---

## DONE

Newest first. One line each; detail lives in `SESSION LOG`, the named doc, or the commit message.
Reconciled against `git log` (draft, resume-master, draft-android, draft-ios) on 2026-09-29; every hash was checked there.

### The split (Phase A + B)

| | |
|---|---|
| **Backup policy fix** (`3b9dbe9`, 09-29) | Queue item 8(a). Budget = 40% of the volume via statfs (was a 512 MB constant > the 500 MB volume); a disk ceiling binds MIN_KEEP and the newest; room is PROVEN from on-disk sizes, then pruned, before the copy — or `BackupRefused` with nothing deleted. Restore's safety copy obeys the same rule. ⛔ Its first test deleted two LOCAL dev backups (production untouched) — which exposed the prune-then-refuse bug it now pins. 2702/2702. ⚠ Local only. 8(b), pruning production, waits on the owner |
| **Registries out of `data/`** (`983a0ed`, 09-29) | Queue item 4, done. The four static JSON registries move `data/` → `registry/`, because production's `/app/data` is a VOLUME that hides whatever the image put there — `ROLE_ALIAS_MAP.json` included, so production's term weights formed for `__global__` only. The domain picker's fallback measured identical to the file (17 domains), so the picker does not change. New boot line `[boot] registries: N role aliases…`. ⚠ **Local only, not pushed** (`origin/main` = `a7a9c7f`). ⛔ On deploy, role families start resolving and ATS scores move at the next weight recompute |
| **`getDomainModuleKey` copies deleted** (`f29f273`, 09-29) | Queue item 3, done. Both draft copies were dead since A4; one definition lives in Resume Master. No behaviour change, 2691/2691. ⚠ **Local only, not pushed** |
| **B step 4** (`a7a9c7f`, 09-28; corrected `cfa63ff`, 09-29) | `resumemaster.one` moved to Resume Master, verified 21/21 on the domain; the policy's two now-false sentences fixed and checked in the built bundle. Certificate **VALID**: there was no DNS edit to make, since the domain was bought through Railway and Railway repointed it (`cfa63ff` corrects `617fdd0`). Root is an intentional JSON 404 (G7, owner keeps it). Step 5, the stale OAuth URI, is the owner's |
| **B steps 1–3** (RM `1bb6694` `fc5ed5c` `814356d`; draft `6b8b2a5`, 09-28) | Resume Master live on Railway at `814356d`, verified 24/24 including the metered scenarios; draft deployed at `e046b7c` (the A4 tree) and calling it; first real generations and the first cache read. Found and fixed: a provider-rejected request reported retryable (`fc5ed5c`). ⛔ Found: generation invents content (2/2) — `814356d` makes `docs/API.md` say the guard enforces years and seniority only. Blocks AF5 |
| **A4** (draft `8a3eb53`, RM `1fbb9bb`, 09-28) | draft calls the tools service for generation, A+ and PDF reading, as a third-party client with its own token; contract vendored and checksum-pinned. ⛔ **`/api/standalone/generate` had never passed the claim guard** — fixed by routing it through the service. PDF reading degrades to local extraction. Every error says whether retrying helps. draft's prompt copy and its assembler deleted; the prompt's tests moved to resume-master (195/195 there). Privacy: policy + reconciliation's fifth column; Web Store declaration re-checked, unchanged |
| **A3 · contract** (RM `a76074f`, 09-28) | Generated OpenAPI 3.1 + TypeScript, v1.0.0, LF-normalised checksums, append-only version → shape-hash ledger. Four shapes **derived by execution**; envelopes declared. ⛔ The envelope harness boots the real app on every `npm test` — 47 scenarios, every declared (route, status) covered, keys AND types checked. Live verifier for Phase B |
| **A3 · service token** (RM `1ad17a3`, 09-28) | `rmk_<client>.<secret>`; Resume Master stores only the hash in `RESUME_MASTER_CLIENT_TOKENS`. Rejected before the body is read · **503 with no clients configured rather than open** · a malformed token list stops boot · rotate by adding the new hash beside the old. Per-client accounting logs token counts only, failed calls included, limits off. 122/122, **each new check seen to fail when deliberately broken**; the token and its hash appear in no log |
| **Extension v1.1.1** (`5e7f72e`, 09-28) | ⛔ **v1.1.0 shipped with the old "RM" icon in all three sizes** while its name and listing said draft. Shipped the `/d` monogram, the only set that stayed consistent across sizes. ⛔ The manifest had carried **no top-level `icons` key since `c818b9c` (05-08)**. Version bumped because the store refuses an upload at or below the version under review. The two red `extensionSubmission` tests went green. Rebuilt and committed; ⚠ **reupload is owner-reported** |
| **A2** (RM `5112249`, 09-27; draft `083ad39` BRAND rule) | Tools moved, copied byte-for-byte from draft at `85570d4`. ⛔ Only the STATELESS part crossed — `coreGenerateResume` mixes draft's DB reads and writes, notifications and weighted scoring with prompt assembly, the model call, formatting and the claim guard. Runtime-inputs text byte-identical to draft's over 324 cases. The drifted `FORMATTING_SYSTEM` CSS is rebuilt from `RESUME_STYLE_BLOCK` |
| **A1** (`3c3fd1d`, 09-27) | `@draft/ats-scorer` extracted as a package. ✅ ρ = 0.746, drift 0.000, at tolerance 0.005 against the package, plus 1,065 full reports deep-equal before and after; the seniority guard re-measured at 0.645 → 0.746. The wrong weights shape is now a TypeError. Carries the scorer registries into the image. ✅ Pushed and deployed (an ancestor of `origin/main` `a7a9c7f`) — **production ATS scores changed on that deploy** |
| **Fresh-clone test fix** (`e2e732f`, 09-27) | Four source-string tests failed on a fresh Windows (CRLF) clone and passed locally only by accident. Fixed on the test side; the `server.js` ↔ `migrations.js` byte-identity reads are deliberately left alone |

### Migration and rebrand — complete (09-23 → 09-27)

| | |
|---|---|
| **Repo rename** (`69bc240` draft, `a6ea57a` android, `4bb321f` ios, 09-27) | `resume-master` → `draft` on GitHub and locally; sibling paths fixed. ⛔ Creating the new empty `resume-master` repo silently stopped GitHub's rename redirect, and `origin` still pointed at it. Caught before a push sent draft's history to the wrong repo |
| **The logo** (`123af31`, `d8d16ef`, 09-26) | Three implementations of one mark collapsed into one `StampLogo`. ⛔ The rebrand guard had been **blind to the most visible instance in the product**: `TopBar` split the name across two spans, and two tests *required* the legacy name to render. Found by screenshotting production |
| **P4 — extension to `jobsviadraft.com`** (`bde7d24`, `fec9cd6`, 09-26) | Extension v1.1.0, named draft, pointed at the new origin; the two deliberate `extensionSubmission` failures cleared by the rebuild. ⛔ The policy said the extension keeps four things (it keeps six) and that nothing is sent (its token is). `fec9cd6`: `resumemaster.one` is a product, not a former address, so a 301 is never safe |
| **Brand — P2/P3** (`11728e4` draft, `e195f40` android, `42224d1` ios, 09-23) | Resume Master → **draft** across 84 changed files (53 + 16 + 15). `shared/brand.js` is the single source; a guard fails on any legacy literal outside an allowlist that **self-prunes**, and it was seen to fail four ways. ⛔ **The iOS sweep is on the unmerged branch `feat/api-layer-feed-review-queue`**; iOS `main` is still `f8be63c` (05-09) |
| **Domain** (owner action; no commit) | `jobsviadraft.com` became the app's address: DNS on Cloudflare (GoDaddy cannot `CNAME` at an apex), certificate live. `resumemaster.one` has served Resume Master since B step 4 (above) |
| **OAuth** (owner action; no commit) | Google and LinkedIn redirect URIs moved; `APP_BASE_URL`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL` updated. ⚠ The stale `resumemaster.one` URI is still registered (O5) |
| **Email** (owner action; no commit) | Cloudflare Email Routing for `privacy@`, Resend verified for `noreply@`. ⚠ Owner-reported: `11728e4` recorded that neither mailbox was yet known to route |

### Extension — the v1.1.0 work (09-24 → 09-25; superseded in review by v1.1.1)

| | |
|---|---|
| **Capture degrades** (`e602a5f`, 09-25) | Parses the labelled block the published build already posts, so users benefit with no store update. ⛔ "Localhost" was filed as a company before the registrable-domain check landed |
| **Privilege escalation + identity** (`ccdbf7b`, 09-24) | ⛔ A fetch from the extension origin reached **7 of 7 admin routes**. Closed on the server, which protects already-published builds too (0/7 against v1.0.0). Three separate `requireAdmin` definitions collapsed into `shared/authPolicy.js`. The extension has its own `sessionLess` token, and the popup names the account it acts as |
| **Dead routes, fill path, non-retryable errors** (`a8f4f6f`, 09-24) | `/resume` and `/ats-score` never existed, and the catch-all sent admins to `/admin`. Both tool pages threw `ReferenceError` on render and **had never worked** (`vite build` exits 0 on that). A fill now reads back what it set, and a reverted value is reported skipped. Comboboxes, multi-selects, dates and contenteditable are supported. "Please try again" is no longer the answer to a billing failure |
| **Diagnosis** (`73952df`, 09-24) | Five reported symptoms turned out to be four defects, and one of them was not a bug. `docs/EXTENSION_DIAGNOSIS.md` |

### Board and measurement fixes (09-24 → 09-26)

| | |
|---|---|
| **The "empty board"** (`6e34a26`, `df69815`, `5209289`, 09-26) | Diagnosed on production as CWS_test_user: the server returned 688 rows while the client replaced the board with a setup block and kept showing the count. A missing résumé now gates the ATS sort, not the board, and an empty page says which kind of empty |
| **Harnesses scored unweighted** (`b417b54`, 09-26) | Four measurement harnesses passed the weights ENVELOPE as `termWeights`, took the unweighted branch and reported themselves weighted |
| **Reproducible submission bundle** (`dd41f1e`, `00b37fd`, 09-26) | The zip is a function of the commit, not of the machine that built it. A markdown parser that broke on CRLF was fixed on the test side |
| **Weight refresh visible** (`d64b046`, 09-26) | A nightly failing recompute is now distinguishable from one that is not yet due; verified by moving `computed_at` into the future state |
| **Student board measured** (`6158b1d`, 09-26) | 29 interns in 2,663: the sources genuinely do not carry them (not the classifier, not the discard path) |
| **Docs — P5 reset** (`25c1be1`, 09-24) | `README`, `HANDOFF`, `ARCHITECTURE` written from measured state, plus a doc guard. ⛔ Measured: **the apply pipeline has never submitted an application** (9 production attempts, 0 submitted) |

### Curation — CC1 to CC5 (09-17 → 09-18)

| | |
|---|---|
| **CC5** (`690bc1f`, 09-18) | Every stored score keyed `(user_id, domain_profile_id, job_id)` (migration 108). ⛔ The brief named one cross-user read; there were **seven**, and the two it missed were worse |
| **Role-map backfill** (`1a59296`, `a110365`, 09-18) | The 277 unclassified postings, which CC1b put on every board, classified the way ingest would classify them. Every board shrinks, as intended. Runs at boot, loudly |
| **CC4** (`a1fe3c7`, 09-17) | A claimed term now reaches the band and the board, not only generation. Anything matched only by a claim is named in `claimed_matches` |
| **CC3** (`586b840`, 09-17) | `skill_synonyms` wired into all 8 scorer call sites. ⛔ The earlier "+0.000" was never a weak effect — **there was no effect path at all**. ρ delta after wiring: +0.0000 |
| **CC2** (`03cedb6`, 09-17) | The bridge matches a term inside a phrase; `'[]'` stopped meaning mismatch. Multi-word match rate 53.0% → 75.5% |
| **CC1 / CC1b** (`d3a79c3`, `727f5dd`, 09-17) | `target_titles` stopped deciding board membership and became rank keys; the `job_role_map` INNER JOIN became LEFT with soft-null. Graded-corpus reachability **8/30 → 30/30**, 277 permanently invisible postings restored |
| ⛔ **Still true** (`25c1be1`) | **The board does not rank by fit.** The CC1 rank keys apply, but each is three-valued: about 700 rows tie at MATCH for an engineering profile, so what a candidate sees is recency inside that band, and an explicit sort drops ranking entirely |

### Pipeline, enrichment, infrastructure (09-04 → 09-21)

| | |
|---|---|
| **Pipeline alerts delivered** (`260e656` 09-09, `2e4429e` 09-18, `b65d813` 09-18, `75ce355` 09-21) | Health is read from `written`, not `status`, per company slug. Alerts are delivered edge-triggered instead of being filed. A run that wrote nothing no longer calls itself ok, and a source with nothing new is not an outage |
| **Term weights in production** (`f45f983`, `700e7c0`, 09-18) | Weights on a schedule, with all three states visible. Production was weighted for the first time: 493 terms, **global family only** (the cause is fixed in `983a0ed`, above) |
| **`normalized_title` + migration 109** (`ccfef0f`, `2494629`, 09-18) | Enrichment stopped rewriting a column it shortened in 469 of 475 rewrites. Only the 54 stripped seniority titles were restored, and the commit corrects the audit's own "lossy" claim |
| **Migrations** (`87b2bfb`, 09-18) | Now transactional, with the bookkeeping row inside the transaction. ⛔ Migration 108 was the first to destroy anything; a failure partway would have been a **boot loop with no way in** |
| **Crawl throughput** (`0de67c8` 09-09, `1e1f91a` 09-13, `eecbe09` `e71a602` 09-16/17) | ⛔ All seven ATS plugins capped the CONCATENATION at 900, so **1,551 postings a crawl** went nowhere while runs reported ok. Enrichment drains on a budget instead of 25 rows a day. The SmartRecruiters/Workday N+1 was probed and moved out of the crawl |
| **Provider routing** (`e683df3` 09-04, `1212cd1` 09-07, `34bb047` 09-13) | Public-data calls can route to a free tier; the guard covering 14 sites was seen to fail first. ⛔ Verdict: **keep Haiku** — Groq scored 30.5% Jaccard, and its pinned model had been **deleted entirely**. Pacing uses the token limit, and boot is refused on a retired model |
| **Enrichment control** (`339c9d1`, `54d43da`, 09-08) | Freshness gate on `scraped_at` (⛔ not `discovered_at` — same rows, opposite answers), a manual trigger with dry run by default, export/import, batch provenance and revert; the import side got a UI |
| **Sources** (`a0b0fcc`, 09-08) | Lever's three slugs were dead and moved or deactivated; +141 rows. Four companies seeded inactive at 0% description coverage. ⛔ Live search had been **structurally capped at three of seven sources** |
| **Logos** (`8abd5a4`, 09-08) | Clearbit is dead — no A record. ⛔ Its fallback for "provider unreachable" **was Clearbit**, and a silent Google-favicon fallback was sending browsing to an undisclosed third party. Web fonts were self-hosted for the same reason (`16484c5`, 09-15) |
| **Board restore** (`cae5442`, 09-07) | 5 → 1,296 rows from a pinned evidence DB. ρ reproduces from the table (0.737), not only from a fixture |
| **Cleanup brake** (`bd95d20` 09-06, `cae5442` 09-07, `b0129f4` 09-07) | `cleanup_log` id 85 deleted 1,288 rows **locally** — production was never affected (`b0129f4`). The graded corpus is committed as evidence. ⛔ The brake was committed, documented and **not deployed** for a day |
| **Monetisation lever** (`c4320e1`, 09-16) | One flag, off. `/pricing` had claimed paid upgrades against a **non-trader** declaration |
| **Anonymous spend** (`857fa32`, 09-16) | `/api/standalone/generate` was Sonnet at 8192 tokens, unauthenticated, with its quota keyed on a cookie the caller controls. Bounded three ways |
| **Version endpoint + hygiene** (`2cd5653`, `d8a124f`, `1bb2a29`, 09-16) | `/api/version` — "what is deployed" went from git archaeology to one curl. Extension-token credential residue dropped. The full-auto kill switch is reachable in a hurry |
| **Apply spend** (`0510a27` 09-04, `abea2c9` 09-06) | Generation fires on approval, not on queueing (it was ~$2.40 per five minutes of swiping). Approvals are capped, because that is where the money went |
| **Company facts (G1–G4)** (`7ecb867`, `ac25de2`, `39c4e73`, `b7ddcaa`, 09-04/05) | Skill synonym table (does not move ρ), LCA identity resolution, canonical company stack, derived label mappings. ⛔ G4 found that AH4's fix had silently reverted |

### ATS engine and generation integrity (08-24 → 09-01)

| | |
|---|---|
| **Bands + seniority guard** (`7494289`, 08-31) | Bands set from the owner's graded 30; a seniority guard worth 0.10 of ρ (0.643 at the time; 0.746 today per `3c3fd1d`) |
| **Outcome loop** (`33c5136`, `82800ff`, `9edb91a`, 08-30) | The generation lift is recorded (it had been NULL on every row), the auto-apply gate is back on the new scale, and employer outcomes are recorded beside the score |
| **AK1 — honest ranking** (`d56b0ad`, `e07948d`, `89173bd`, 08-28/29) | Audit: the score was 96% one binary flag. It is now ordinally honest and stopped crediting skills a résumé does not have; ρ 0.504 proved on 30 graded postings. ⛔ "The number should not be shown" (G5 is still open) |
| **ATS report quality** (`815e4f4`, `4c168f8`, `eee62e9`, 08-24/25) | ⛔ 26 of 26 "missing skills" were sentence fragments mined from prose. The fix reaches cached reports too, and skills are separated from qualities |
| **Generation integrity** (`f9e527b`, `d997a07`, `8943c5d`, `2c07029`, `8847163`, `21cd16e`, 08-24/25) | The JD steers emphasis, never a quantity, and this is proven before save. The claims block stopped inflating seniority, and the candidate decides their level. A withheld résumé is our refusal, not a provider failure. The summary rule is consistent across 14 prompt files, and SUMMARY is opt-in |
| **Formatter duplicate** (`6781372`, 08-24) | The formatter was manufacturing a repeated role line (three regexes that could not count). ⛔ The same shape is **live again** in real output — see G3 |

### Repository hygiene (08-12 → 09-01)

| | |
|---|---|
| **matchScore** (`54eb06e`, 09-01) | Null on every row of every response since it was written — the column is `ats_score` |
| **History rewrite** (`dfde303`, 08-31) | AI co-author trailers stripped: 292 commits, 320 SHAs changed (everything from 05-23 on), tree byte-identical. Doc references repointed |
| **Encoding + line endings** (`82a5f74`, `d199f6e`, 08-30) | ⛔ A mojibake bullet had painted into **every generated résumé**. LF normalisation became the repository's guarantee (`.gitattributes`) |
| **Suite green** (`543c3dc`, 08-12) | 593/593, 0 failing, for the first time. Every earlier commit had carried "44 unique failures (baseline unchanged)" |

### Auto-apply, handoff and capture (08-12 → 08-25)

| | |
|---|---|
| **Auto Apply UI** (`5274713` 08-20, `fb51256`, `0e32fe1` 08-23, `614fedc` 08-25) | Auto Apply is its own tab: a dated run history in three outcome groups, company → application → problems. Search-bar controls had all been wired to no-ops (`e74d504`) |
| **Session + transport** (`33347ce`, `f491d1b` 08-22, `3a8ec58` 08-25) | ⛔ SSE connections starved the board of a socket (one stream per tab still did). Signing out did not sign you out: the cookie outlived it |
| **Backups** (`cd47110`, `563f3a2`, `9c34935`, 08-22) | ⛔ Importing `backup.js` wrote a full DB copy on every boot (27 of 30 "backups"), and backups skipped the WAL, so every live copy could be stale. ⚠ The budget and floor that filled the volume on 09-29 are still open — AGENT QUEUE 8 |
| **H-1B as a company fact** (`e3200dc`, `743f0f1`, 08-22) | 0 of 1,261 postings mention H-1B; sponsorship now comes from 21 quarters of DOL LCA filings |
| **Extension capture v2** (`6554473`, `456dfa0`, `23f8bbf`, `43fffed`, 08-18) | Captures any job page via `activeTab`, with the six host permissions and the content script gone; Ashby/Workday selectors; a policy that describes the shipped extension |
| **Gated handoff** (`378298a`, `7d744f6`, `583304e`, `cfac820`, `acd4fb1`, 08-17) | A portal that wants an account parks what it prepared; the candidate signs in, presses a key, and the form fills. It never submits. Portal learning is shared |
| **Observability** (`a8e3cac` 08-13, `33537fb` `bc44396` `7d65405` `e766ebc` `ef9e8f1` 08-14) | ⛔ Four features were calling a retired model. One logged path for every model call (coverage was 4 of 14 sites), with a guard; the failure sink survives an unreachable DB |
| **Submit safety** (`ad931ad`, `b23e3cd`, `92bf293`, `6a3fa42`, `ca1f329`, `39405ad`, 08-12) | Idempotency, cap, audit trail and kill switch (migration 072). Queue-then-approve made full-auto opt-in. Pending-approval surface, validation-correction loop, cross-frame submission. ⛔ One payload mismatch on `/api/apply/runs` was auto-submitting |

### Pipeline rebuild (07-23 → 08-11)

| | |
|---|---|
| **Pipeline diagnosis** (`6daf9f2`, `e1bbac1`, `cae0d7f`, `448d2b9`, `a8bc438` 08-10; `95830f5`, `3f6c4d8` 08-11) | ⛔ **No job description had ever been stored** (Greenhouse and Ashby wrote NULL). Enrichment overwrote good data with NULL and stamped rows complete. Jobo's 402 was swallowed as success. Four wrong ATS rows meant 8 of 10 companies were crawled (migration 070). `discovered_at` reset on every re-crawl |
| **Enriched board** (`8ffa59b`, `4241e98`, `6d9ed04`, `ccf27f7`, `11087db` 08-05; `2beda44` 08-06) | Jobo feed; bring-your-own-job import and hotkey capture (the saved-jobs scraper removed); profile→board bridge; company KB; FE-1 to FE-6 filters, company and recruiter views |
| **Ingestion** (`4c4ce74`, `8b780e0`, `72777b8`, `7748ddb`, 07-23) | Incremental ATS sync with expiry, cross-source dedup (the ATS listing wins), LLM description enrichment + technographics, Workday/SmartRecruiters/Workable/Recruitee adapters |

### Mobile

| | |
|---|---|
| **Android base URL** (`c40b343`, 09-09) | The LinkedIn import used a `YOUR_DOMAIN.com` template placeholder, so it **could never have worked** on Android |
| **Android Phase 2a** (`d8e0611`, `01c1221` 09-01, `6cb7a91` 09-02, `2bbd242` 09-03) | First verified assemble (four failures deep). Auth via `/api/auth/mobile-token`, a board parser generated from the contract, contract 1.1.1 vendored, Room persistence. ⛔ Builder and preview held **separate repositories**, so "Export as PDF" shipped the mock résumé |
| **Android constraint fix** (`e35b6f8`, 09-01) | "Hard throw right: apply" was implemented in **five places** and reached a badge reading **"Application sent"** — having sent nothing. Found by the Phase 1 audit, which had no commit of its own |
| **Mobile API contract** (draft `12ad1eb`, `1dcf4d7`, `5d11da7`, 08-28) | Generated from `mapJobRow`, vendored to both apps; `/api/jobs` pages by cursor, since offset paging silently skipped jobs |
| **iOS** (`aad5a3a`, 08-30, branch only) | ⛔ **Never compiled — no Mac session has ever run.** `aad5a3a` repaired the pbxproj, deleted the duplicate `JobRepository.swift`, added the auth service to the target and wired an API layer, feed and review queue — written on Windows. ⛔ It and the P3 sweep sit on the unmerged `feat/api-layer-feed-review-queue`; iOS `main` (`f8be63c`) still has the 30-of-32 build-target defect |

### Before August — the original build (04-06 → 06-05)

| | |
|---|---|
| **Apply pipeline v1** (`3ffc66a` 05-30 → `ad7e36a` 06-05) | Async apply queue, field discovery, cover letters, completeness gate, production browser readiness |
| **Jobs taxonomy** (`2078445` 05-29 → `dca838b` 05-30) | Unified taxonomy, collar classifier, blue-collar ejected at ingest, board queried by `job_role_map` |
| **Cinematic redesign** (`6887ac9` 05-23, `567ad2c` 05-28) | Theme framework and unified app shell, Steps 0–19 |
| **Sources + OIDC** (`c818b9c` 05-08, `d8b4629` 05-09, `2d93807` 05-11) | Apify scraping removed, LinkedIn OIDC, extension rebuilt as MV3. Plugin aggregator (Adzuna, then Greenhouse/Lever/Ashby) |
| **Local ATS scorer** (`499c4e5`, 04-23) | Deterministic in-house scorer replaced LLM ATS scoring. ⛔ The same day's `.dockerignore` (`a81830e`) is what kept `data/` out of the image until `983a0ed` |
| **v5** (`a780d91` 04-06, `8418ea3` 04-13) | Initial commit; domain-profile system with profile-driven search and generation |
```

---

## SESSION LOG

Newest first. ⛔ Agents append here rather than creating a new file.

### 2026-10-02 (15) · A51 — the admin inspector stops doing harm (`a56e931`)

The A51 agent hit the session limit mid-wiring (`services/adminSafety.js` written, routes half-wired, UI and
tests untouched). The coordinator audited what it left, finished it and verified it. Local; not pushed.

- **Clean Pool REMOVED** — route and button. Built 04-15 (`bb0ceab`) when `user_jobs` was a per-user scraped
  pool; it ran `DELETE FROM user_jobs` for every row not applied and not on the active profile, with no
  confirm, dry run or count. `user_jobs` now holds Saves and PASSES on every profile, so one click re-dealt
  passed jobs. Nothing else called it. A test refuses any `DELETE FROM user_jobs` in the inspector.
- **Raw query read-only BY CONNECTION** — a separate `readonly: true` better-sqlite3 connection (SQLite refuses
  any write however spelled), iterated and stopped at 200 with `truncated` reported, never `.all()` into
  production memory. Keyword check kept as defence in depth; ATTACH refused (a read-only ATTACH still reads
  other files). No file path → no raw query (fails closed).
- **Credentials redacted everywhere the inspector returns raw rows** — Table Browser, peek, Job Trace, CSV
  export, and the raw query by ORIGIN column (an alias does not unmask); a statement naming a credential column
  is refused. Content/basis hashes stay visible (they debug ranking and dedup); NULL stays NULL.
- `adminSafety` 7 tests; 7 injected violations, 6 red — the 7th (dropping `password_hash` from the explicit
  list) stays green because the `_hash` pattern catches it too. **`npm test` 2936 / 2936 / 0.**
- **WORKLOG ids:** another session queued "A51"/"A52" (uncommitted) while A51 was already pushed as stop-the-harm —
  renumbered to **A52** (one ATS-report implementation) and **A53** (site-wide vocabulary and styling). A52 is
  partly overtaken by the A40 rebuild, which already renders the board's own `ATSPanel` in place. Its
  stored-vs-fresh note ("No signal" on the card, "Strong match" in the panel) is NOT explained by A48 — still open.
  The recruiter section's header, fused into one line by that edit, is restored.

### 2026-10-02 (14) · A40 rebuilt as TWO equal panels; A44 merged (`a95bae0`)

⛔ What shipped in `8c38dd2` / `da73ff9` (ATS │ card │ posting, the posting moved OUT of the card) was not the
design. Rebuilt to `BRAND_OUTLAY_AND_MOTION.md` §"THE EXPANDED CARD — DECIDED": **two equal panels**, the FULL
ATS report left, the posting INSIDE the card growing down, one clock, no stagger, a `0fr → 1fr` grid; a sheet on
a phone, swipe off while expanded. **`npm test` 2929 / 2929 / 0** on `main` after the A44 merge. ⛔ Not pushed.

- **Server + contract (`e5722f8`):** `deckReport()` in `services/dailyDraft.js` freezes the FULL report with each
  card — skills, competencies and verbs matched/missing, generic language, experience fit, profile facts
  missing, decline reasons, the seniority note, résumé depth — as a WHITELIST, so no number can leak in; a
  declined report stays `scorable: false`. `whyFromReport` gains `missingTotal` (the "13 of 14 matched" line).
  A card frozen BEFORE this reads back `report: null` and says the full report is on the board. ⚠ **Mobile
  contract 1.2.0 → 1.3.0** (additive: `DeckCard.report`, `DeckWhy.missingTotal`) — Android vendors 1.2.0.
- **Client (`596d6b4`):** the report column grows `0fr → 1fr` and pushes the card's column; the fan and the action
  row ride with it. The card is ONE column wide at rest and open (692 | 692 at 1440, 612 | 612 at 1280), so it
  never resizes on click. One `--deck-t` (1.1 s) / `--deck-ease` drives the grid, the signal line and the
  posting; reduced motion → 0 s. Left panel = the board's own `ATSPanel` with the card's band, never a number;
  a declined report reads "Not enough signal". Below **1176px** the vertical fan stays and the signal line opens
  the report as a SHEET. Swipe disabled while expanded (pinned). A39's sticky Collapse kept; hidden content inert.
- **Premises corrected while looking:** the fan's ease-out had the move 97% done at 550 ms (fast, then waiting)
  → an even ease-in-out; `marginLeft: auto` made the report wipe in from the screen edge → pinned to the card's
  side so it emerges from behind the card; the 700px rest card → one column wide.
- **Tests:** `deckExpandedFlank.test.js` deleted (it pinned the wrong three-column design) — ⚠ the deletion rode
  in the coordinator's WORKLOG commit `fbeeeef` because it was already staged. Replaced by
  `deckExpandedTwoPanel.test.js` (11); `deckCollapseTop` / `deckFan` anchors re-pointed. 14 injected violations
  red — a stagger slipped through the first run (the test missed the `transitionDelay` spelling), widened.
- **Screenshots:** 130 in `draft-screenshots/expand-two-panel/` (rest, mid-clock, open, open-scrolled,
  signal/sheet, sheet-scrolled × 1440/1280/820/390 × light/dark × full/reduced) + 10 walk videos + a 1150px
  sheet frame + a pre-change card's fallback. No horizontal overflow at any width; a swipe on an expanded card
  decides nothing.
- ⚠ **`client/node_modules` had lost 211 packages** (last touched 10-01 19:18) — almost certainly the
  coordinator's failed `git worktree remove` of `wt-37`, which deleted THROUGH that worktree's junctions into
  the main tree. Restored with `npm install` (lockfile unchanged); root and client both `npm ls` clean 10-02.
  ⛔ **Lesson: never `git worktree remove` a worktree whose `node_modules` are junctions into another tree —
  delete the junctions themselves first (non-recursively), then remove the worktree.**
- **For the owner:** pushing ships contract 1.3.0; cards already dealt today show the "on the board" fallback until
  tomorrow's deal.

### 2026-10-02 (13) · A44, A49, A50 in parallel with A40; A46 shipped; production at 114

Run beside A40 (main tree): **A44** in its own worktree (branch `a44-pipeline-health`), **A49** and **A50**
read-only. A46 shipped first (`94cad9f`, pushed, live — "Not connected" in bundle `index-x_OHwg4X.js`).
⭐ **`/api/version` reports `latestApplied: 114_users_deck_geometry`** (121 applied, commit `94cad9f`) — the
deployed commit and migration state no longer need a boot log.

#### A44 · Pipeline Health — liveness, not cadence (`1d81e96`, `0aea3cf`; NOT merged — after A40)
- **The 542h cluster was the panel, not the slugs.** openx (6), persado (2), skroutz (11, all Greece) are alive.
  The company check measured MAX(`discovered_at`) — a company's newest NEW posting; 103 seeded the three
  together and one crawl first wrote them, so they aged in lockstep. **Stale now = the last successful crawl
  did not return the company** (`scraped_at`, or the A37 gate's `rejected_at`); time since a new posting is
  reported (`quietHours`) and never alerts.
- **hygraph:** alive, `{"offers":[]}` — empty, not dead, not dropped. **Owner: keep.**
- **48h threshold, local, 22 companies:** old rule flags 5; "newest posted_at > 2 days" 13; a cadence model 5
  (4 of them Ashby's missing dates); **liveness (built) 0**. Median posting gap ≈ 0.3 days on big boards,
  6–43 days on small ones — a fixed 48h flags every small company.
- **A37's false CRITICALs fixed** (A50 found them): held-out rows lived only in `details_json.outOfMarket`, so an
  all-held-out run read "wrote nothing" and an all-non-US company read "dead slug". Held-out now counts as a
  refusal; a company whose postings are all outside the US reads **OUTSIDE US** (warning).
- **New states:** **NOT ENABLED** (keyed source, no active companies — workday, smartrecruiters) and **PAUSED**
  (`PIPELINE_PAUSED_SOURCES`, O42 for jobo); neither alerts. **Enrichment stopped** = CRITICAL when nothing has
  been enriched for 72h while rows wait; the coverage box says unenriched rows are the ones that score "not
  enough signal". ⛔ A48's "nothing shows coverage" was wrong — per-column coverage already existed.
- **Defect found: Ashby rows had NO dates** — the adapter read `job.publishedDate`; the API sends `publishedAt`
  (1,155 / 1,155 across four boards; 794 / 794 local rows undated). Fixed; each Ashby row is rewritten once on
  the next crawl (first-seen and enrichment kept). Lever's description-less rows: 3, all Seoul — the gate retires them.
- **Migration 115 — Skroutz deactivated** (owner 10-02; `active = 0`, as 102 did for Retool). Both runners, CRLF.
- 11 + 1 injected violations red; worktree **2922 / 2922 / 0**.

#### A49 · Dedup audit — measured, nothing built
Local (09-26 snapshot, 2,616 rows, all direct-ATS — **no aggregator rows exist locally**): 10 fingerprint groups
(all distinct req ids — correctly kept; 4 identical-text pairs are repost-or-second-opening), 110
identical-description groups (70 = one role in several cities, correctly kept). Simulated aggregator variants
through the real fingerprint: "City, ST" merges 35%, "City, State" 5%, ", Inc." 0%, " - Remote" 0%.
Every production writer goes through `upsertCanonicalJob` (A37's paths included); 17 bypasses are scripts/fixtures.

| # | Defect | Where |
|---|---|---|
| 1 | Source-namespaced req ids BLOCK cross-source merges (ATS + aggregator, or a company on two ATSs) — dormant only because jobo is paused | `aggregator.js:542-548`, `schema.js:125` |
| 2 | Fingerprint needs exact company + title + first location | `schema.js:109` |
| 3 | Write-back loses donated data: live-search INSERT carries no description/salary; LinkedIn writes its own salary | `server.js:8333-8380`, ~4486 |
| 4 | Demotion leaves `user_jobs` / applications on the demoted row | — |
| 5 | Soft → hard delete: the 7-day age cleanup deletes demoted rows (`scraped_at` never refreshed) | `server.js` ~4780-4800 |
| 6 | `import` and `jobo` rank mid-tier, above adzuna/serpapi — not "import last" | `aggregator.js:96-100` |

**A43 needs 1 + 4 first; A45 needs 1–5 and a production re-measure** (aggregator rows exist only there).
Rules still to state: repost vs second opening (needs Greenhouse's real first-published date — `posted_at` is its
`updated_at`), and cross-source matching that never merges different cities.

#### A50 · Admin panel audit — read-only
- ⛔ **Harm, queued as A51:** Clean Pool deletes Saves and PASSES in one click; raw query is a keyword blocklist,
  not a read-only connection; Table Browser serves secret columns.
- **Wrong numbers:** "Jobs Scraped" / "Scrapes" read `scrape_events`, unwritten since cleanup 5.8 (always 0);
  Backups copy says "last 30 snapshots" (now a byte budget, max 30 / min 3); the ledger UI hides
  `success`/`error_text`, so the Groq outage would not have shown; "A+ Resume: ON" silently swaps that user's
  Generate prompt. Stale "SCHEDULED FOR REMOVAL" headers, the yellow "Lucy" header, old theme object.
- **Curl-only:** the full-auto kill switch, board-fit precompute, `/api/version`, `/spend`, applications.
- **Must preserve:** `pipelineHealth()` as the ONE function the nightly alert reads · health from written +
  unchanged + merged · per-company grain and suppression under a stale source · coverage over active rows ·
  run-failure alerts · the distinct states · `generatedAt`/`staleAfterHours` · Job Trace, Table Browser,
  Schema · the raw ledger (`model IS NOT NULL`) · `mayActAsAdmin` · dry-run enrichment.
- **Design doc premises wrong:** "Not linked" was never an admin label (A46); coverage already exists; "User
  Pool" is pre-pivot framing; the kill switch's missing UI is not in §3.
- **Order:** A51 (harm) → wrong numbers → curl-only UIs → daily glance → company list (after A49/A44) → Job
  Trace → restyle → extension / RM / mobile / recruiter surfaces.

### 2026-10-02 (12) · A48 — "not enough signal" 0.1% → 20.5% is ENRICHMENT COVERAGE, not the scorer

Run alone, read-only; nothing built. Reproduced **537 / 2,616** exactly, twice — B's harness AND the
server's board-fit path (full rows, claims, synonyms, weights) — so the MEASUREMENT is the same as the
0.1% one (`docs/ak2-ats-bands.md`, 08-31: 1 of 1,291, every row enriched then). The POPULATION changed.

| local, active | declined |
|---|---|
| enriched (`skills_json` set) — 802 | **0** |
| the same 802 with `skills_json` stripped | 238 (29.7%) |
| unenriched — 1,814 | **537 (29.6%)** |

- The scorer has two decline conditions; **all 537 are "fewer than 4 scorable terms"** (447 with 2–3, 90
  with 1); 0 for "no résumé/profile skills"; description length is not a factor (3 null, 1 short). Abstractly
  written postings (Stripe "AI Engineer", 5,000 chars → 2 terms) defeat the 543-term registry, the only
  extractor without enrichment. **Local enrichment stopped 08-24** (latest `enriched_at`).
- ⛔ Ruled out: CC1–CC5, the seniority guard (caps an existing score only), the A37 gate, term weights.
- **Board-wide decline ≈ unenriched share × ~30%.** Production: 1,140 / 2,610 enriched on 09-18; `/api/version`
  now reports a 1,179-posting weight corpus → roughly **15–17% declining**, unless enrichment caught up after
  the balance was funded (09-28). ⚠ NOT measured on production (no CLI access this session — O41).
- ⛔ **Row A48's "term weights go stale ~10-13" was wrong:** the cliff was closed 09-18 (nightly refresh at
  14 days; 45 days is only the refusal limit), and a stale table falls back to UNWEIGHTED scoring — it never
  declines. Production `/api/version` 10-02 01:50Z: fresh, 13.1 days, 0 consecutive failures. Local stale 11-02.
- **Unblocked:** A40 / O40 (bands and the decline are correct; the deck deals only Strong/Moderate, so an
  unscored row is never dealt) · AF5's ATS test (use ENRICHED postings — an unenriched hand-pick shows "Not
  enough signal" until the nightly pass reaches it). **Band populations:** quote only beside enrichment
  coverage. **Follow-up (A44/A50):** show enriched ÷ active on Pipeline Health — it sets the decline rate and
  nothing shows it. Retiring non-US rows (O38b) shrinks the enrichment backlog (300 rows/day, newest first).

### 2026-10-01 (11) · Queues 40 → 39 → 38, 37 and 34 — three agents, on the owner's go

Run IN PARALLEL on the owner's explicit ask, split so nothing could collide: **A** the deck (40 → 39 → 38,
sequential) in the main tree · **B** row 37 in its own worktree (`queue-37`, own port, fresh CRLF checkout)
· **C** row 34 read-only. No agent edited this file. Merged `eea1162`; **`npm test` 2912 / 2912 / 0** on
`main`. ⛔ Nothing pushed. Screenshots: `draft-screenshots/expand-flank/`, `collapse-top/`, `deck-layout/`
(1440/1280/820/390 × light/dark × full/reduced, + videos at all four widths in both motion settings).

#### 40 · ATS │ card │ posting (`8c38dd2`, fix `da73ff9`)
- From **1280px** an expanded card shifts 32px right, the ATS report (band, blurb, matched/missing) opens LEFT,
  the posting RIGHT, the arc slides right behind it. Both panels render inside the deck's stage — no route.
  Pure `expandedLayout()` in `fanGeometry.js` (280px min per panel + 560px card → first fits at 1272).
- ⛔ **Premise adjusted:** "the deck returns to vertical when the panels stack" holds only below 1100. Between
  1100 and 1279 the deck stays horizontal and the card stacks its panels inside, as before.
- **Found and fixed:** expanded, the page scrolled SIDEWAYS (1820px wide at 1440); queue 27 also left 1px at
  1100. A full-width `overflow-x: clip` wrapper fixes both without breaking the sticky rows.
- **Old overlay audit:** the deck mounts none of the stacked JD / ATS / PDF overlays; a test refuses them. The
  one path back is "Full report on the board →" (`/app/jobs?job=…` → the board's JD drawer via `PanelShell`),
  kept as queue 29's shared-element route.
- ⚠ **More report exists than the deck shows:** the stored `ats_report` also has an experience summary, action
  verbs, competencies, hard-constraint misses and a résumé-depth note; the frozen deck snapshot keeps only 6
  matched / 4 missing / a total. Surfacing more is a `services/dailyDraft.js` change — not done.

#### 39 · Collapse (`0bcc7a0`)
"Collapse" — one word — at the top of an expanded card as well as the bottom; the top one sticks just under the
top bar at its measured height. The bottom label and the legend's Esc line say "Collapse" too.

#### 38 · Deck layout as a user control (`ecb1906`)
- A "Layout" button: **Tight / Standard / Wide** first, Size / Spread / Reach behind "Customise"; the copy frames
  Tight as the calmest.
- ⛔ **Premise corrected: clamping each slider is not enough — the three are coupled.** In-range 0.64 / 3 / 600
  hides the next card entirely; 0.8 / 10 / 1400 runs the stack out of frame. `clampGeometry` fits the
  COMBINATION against queue 27's own constraints (horizontal: first back peeks ≥ 40px, 3rd back inside
  1440×900; vertical: first back peeks ≥ 80px, its logo on a 390px screen). A test walks ~4,500 combinations
  plus junk; the slider ends move to the fitted range as the others change.
- **Per user:** migration **`114_users_deck_geometry`** (byte-identical in `server.js` ↔ `scripts/migrations.js`,
  CRLF kept), `GET/PUT /api/settings/deck-geometry`, cached on the device for first paint.
- **Reduced motion:** the deck uses Tight, does not animate, and the control says so and is disabled.
- **Found in screenshots and fixed:** the popover sat under the front card (clicks expanded the card) and opened
  off-screen on a phone — now floats above everything, clamped to the screen.
- Injected violations 15+2 (40), 9 (39), 16 (38) — all red, files restored byte-for-byte.
- Noticed, not changed: at 390px the top bar's "AUTO APPLY" runs under the avatar.

#### 37 · The board admits only postings with positive US evidence (`da04146`, merged `eea1162`)
**Measured first — LOCAL board** (`data/resume_master.db` copy, 2,616 active; production not read):

| source | US | non-US | Remote, region unstated | unparseable | total |
|---|---|---|---|---|---|
| greenhouse | 1166 | 478 | 9 | 28 | 1681 |
| ashby | 638 | 156 | 0 | 0 | 794 |
| lever | 61 | 69 | 0 | 0 | 130 |
| workable | 1 | 4 | 2 | 0 | 7 |
| recruitee | 0 | 3 | 1 | 0 | 4 |
| **all** | **1866 (71.3%)** | **710** | **12** | **28** | **2616** |

- ⛔ **"Majority non-US" is wrong locally** — 28.7% held out; only lever is majority non-US. (Row 47's "58%
  non-US" disagrees with this measurement — re-measure on production before quoting either.)
- **Rule:** only positive US evidence admits (state, city+state, US city, "US"/"United States", a region
  containing the US); multi-location admits if ANY is US; ambiguous codes read with their city ("Bangalore, IN"
  ≠ Indiana, "Dublin, CA" = California). ⛔ **NULL / blank / "N/A" / unparseable → held out**, tested.
  Unqualified "Remote" admits only on US evidence in the description and none elsewhere — all 12 held out today
  (11 say nothing, 1 non-US).
- **Where:** ingestion — a product property, not a preference. The gate sits BEFORE the "unchanged" check in both
  loops, because that path sets `is_active = 1` and would revive every stored non-US row on each crawl. Held
  out = `is_active = 0` + `rejected_jobs` `out_of_market:<reason>`, cleared if the posting later shows a US
  location. `jobNormalization` no longer defaults a blank location to "United States" (the include-by-default
  shape — its old test pinned it and now asserts the opposite). `hiringSignals` excludes held-out rows, or the
  first crawl would read every London posting as a role closing.
- `scripts/q37RetireOutOfMarket.mjs` — dry run default, refuses > 50% of the board; local dry run 750. ⛔ NOT run
  on production. `scripts/q37RederiveOverUsBoard.mjs` re-derives:

| figure | was | US-only (local) |
|---|---|---|
| ρ | 0.746 (n=30) | **0.723** (n=24) |
| Strong ≥ 44 | lowest cut at 100% precision | **holds** |
| Weak < 26 | owner rated 36.7% as 1–2 | **41.7%** — re-take |
| entry + intern | 2.6% local (3.0% prod) | **1.7%** (held-out rows were 4.8% entry/intern) |

- ⚠ **Unexplained:** 537 of 2,616 local rows (20.5%) score "not enough signal" against profile 6 — the cutpoint
  notes recorded 0.1%. Do not quote band populations until explained.
- Noticed: greenhouse writes `'Remote'` for a missing location and lever falls back to `workplaceType` — the
  gate now holds those out, but the board would still label them "Remote".
- 10 tests (`usOnlyBoard`), 12 injected violations all red. 2886 / 2886 / 0 on the fresh CRLF worktree.

#### 34 · ATS partnership — investigated, nothing built
- ⛔ **"Not linked" is not about ATS partnerships.** The only "Not linked" is Account → Sign-in methods
  (`client/src/panels/AccountPanel.jsx:137`, from `services/accountService.js:166-168`: is
  `google/linkedin/github_auth_id` set). The nearest admin flag is Pipeline Health's "NOT CONFIGURED"
  (`routes/adminDb.js:222,226`): no env key, or skipped for no active companies. All 7 ATS adapters'
  `isConfigured()` return `true` — public boards need no key. (Row 46 queues the relabel.)
- ⛔ **Premise confirmed: no vendor deal grants submission.** Every ATS's submit API needs the EMPLOYER's
  credential — Greenhouse Job Board key (Candidate Ingestion: per-customer OAuth/partner key + customer service
  user) · Lever per-site key · Ashby `candidatesWrite` key · Workable account token · Workday an integration user
  in the employer's tenant (even StepStone needs that) · SmartRecruiters a partner program, still connected per
  employer. Recruitee's candidate POST is keyless but meant for the company's own careers site — unauthorised
  for us, 4 of 2,616 rows. ⛔ Do not build on it.
- **Comparable products:** candidate-side tools (Simplify, Jobright, LazyApply) all automate or autofill the
  employer's own form. Real "apply directly" (LinkedIn Apply Connect, Indeed Apply, StepStone→Workday) is
  EMPLOYER-side: the ATS/platform owns the connection and each employer opts in. Teal, Handshake not verified.
- **Conclusion:** fill-and-review is the industry norm, not a stopgap. Optional long shot: SmartRecruiters'
  marketplace (0 local rows). The real "partner" line is `RECRUITER_LAYER.md`'s tooling tier (scorer/parser as an
  API), which carries no submission rights. Full report: session scratchpad `agentC-34-report.md`.
- Noticed: `services/integrationReadiness.js`'s comment says sources report "configured" only with a key —
  misleading for the ATS adapters.

### 2026-10-01 (10) · The top bar and /features — on the owner's ask

- **The top bar was transparent** — not a decision: the leftover of the retired pill's p < 0.02 branch.
  With the deck's in-place expansion a long card scrolled through the tab labels. Now frosted `SURFACE_2`
  (blur 18px) with the `GLASS_EDGE` hairline; INK / INK_MUTED on SURFACE_2 are declared AA pairs in both
  themes. `appScrollProgressRemoved` pinned the old transparent constants; its intent (constants, never the
  dead interpolation) is kept and its values moved, with a guard against an interpolated blur.
  Screenshots: `draft-screenshots/topbar/` (expanded card scrolled under the bar, 4 widths × themes × motion).
- **/features was the feature grid** — five emoji cards under "Everything you need to land the interview",
  one promising "One click fills the application form at any portal". Now "What each tool is for": the
  find → fit → apply stations, every tool with what it does, **the one thing it will not do**, where it lives
  and its real limit; tier names only with the monetisation lever on (kept, as before).
- ⛔ **Premise found wrong while writing it:** "it will not claim anything you did not" — the brief's line, on
  the landing page I shipped in `3af6c5e` — is false today (CURRENT STATE · Fabrication). /features says what
  the guard really does and tells the reader to read every draft; a test refuses the false promise there.
  The landing is NOT changed — owner decision, **OWNER 36**.
- 5 tests (`featuresPageHonest`) + the updated top-bar test; 4 injected violations all red. **2876 / 2876 / 0.**
  Screenshots: `draft-screenshots/features/` (4 widths × light/dark × full/reduced, + full-page).

### 2026-10-01 (9) · Agent queue 31 — the landing page as find → fit → apply

The landing page's feature grid and feature marquee are replaced by ONE line, find → fit → apply
(`client/src/components/FindFitApply.jsx`): three stations, two surfaces each, every one a sentence about
what it does for a person; the two promises (*nothing is submitted until you approve it* · *it will not
claim anything you did not*) in display type after "Most job tools sell volume… This one is built the other
way round"; links only to `/register` and `/tools/ats`, because grade-the-posting has no public route and
the connectors no public token policy — the recruiter line says "Soon". The line draws on scroll
(IntersectionObserver + CSS), content visible until the observer is armed, nothing hidden under reduced
motion. Hero: "Find the job. Fit the résumé. Apply when you say so." Footer: "Find, fit, apply — and
nothing is sent until you approve it." (was "AI-powered resumes for the modern job search.")
`BelowFoldContent.jsx` and `PosterBanner.jsx` deleted (no other users); the colour guard's literal-free list
re-pointed to `FindFitApply.jsx`, as its own message instructs.

Claude Code stopped the dev and preview servers for low memory before the screenshot pass; restarted on
the owner's go. ⚠ Found doing it: the "stopped" servers' node processes had survived, orphaned, still
listening on 4173/4174/5173 — two were killed, one reused. **Verified:** 42 screenshots + 10 videos
(`draft-screenshots/landing/`: 1440/1280/820/390 × light/dark × full/reduced; `home-walk-*.webm` scrolls the
line and shows each stop revealing). Fixed from them: the hero tagline had NO side gutter — at 390px it ran
to within 4px of both edges with "so." alone on the last line; now a 16px gutter and `text-wrap: balance`.
(Full-page captures stitch the fixed nav mid-page — a capture artefact, judged from viewport frames
instead.) 7 tests (`landingFindFitApply`), 6 injected violations all red, `npm test` **2871 / 2871 / 0**. Noticed, out of scope: `/features` (`FeaturesPage.jsx`) is still a feature list.

### 2026-10-01 (8) · Agent queue 30 — login and signup as the first impression

Run after 27–29, alone in the tree. Local; nothing pushed. **2864 / 2864 / 0** after (+7).

**What it was:** "Land / your next / role / faster" in four tiles, "Start with the shared jobs console, ATS
Search, and Simple Apply.", and the form — which itself faded and scaled in over 200 ms.

**What it is** (`AuthScreen.jsx`, `DealBackdrop.jsx`, `SignupAtsHook.jsx`, `lib/signupCarry.js`):
- **"Ten jobs a day, picked for you."** — the doc's honest sentence for the daily draft — with "Not a search
  box… **Nothing is sent until you approve it.**" The restraint is in the second line, not a footnote.
- **The deal behind the form** — the deck's own card backs (company logos in blurred orange), dealt slowly
  onto a hand-fan, outermost first. aria-hidden, no pointer events, `Z.FAN`, CSS transform/opacity only.
- **Type that sets once** — letter by letter on the first paint of the page SESSION (a module flag, so
  /login → /register does not replay it); the h1 carries the sentence as its accessible name. ⚠ Found in
  the screenshots: inline-block letters let a line break inside a word ("for y / ou." at 390px) — each
  word is now a no-wrap span.
- **Paper that reacts** — the leather drifts up to 4px against the pointer; fine pointers only, scaled
  1.02 so no edge shows, restored on leave.
- **The `/` as signup progress** — fills a third at step 1, two thirds at step 2.
- **⭐ The hook** — "Try it before you sign up": a résumé PDF and one posting → the public
  `/api/standalone/ats` (the board's v4 scorer, free, unlimited, zero model calls — asserted on the route)
  → a BAND and its blurb, never a number. "Create my account" switches the form to signup. **"Keep it"
  is literal:** the scored PDF is carried in MEMORY (never browser storage — a résumé must not outlive the
  tab on a shared computer) and Job Profiles offers it to the first profile without a base résumé, once.
  ⚠ It needs a profile to exist first; a reload drops it (the safe failure).
- ⛔ **None of it delays the form.** The entrance animation is removed. Measured on production builds of
  the OLD and NEW pages (first frame at which the first input exists, fully opaque, untransformed):

| | form ready | after first paint |
|---|---|---|
| old, unthrottled | 452–754 ms | +230–410 ms |
| **new, unthrottled** | **233–295 ms** | **+20–110 ms** |
| old, 4× CPU | 1030–1303 ms | +570–720 ms |
| new, 4× CPU | 701–1868 ms (noisy) | +260–900 ms |
| new 4× with the deal hidden vs shown (5 each) | median 990 vs **882** ms | — the deal costs nothing measurable |

**Verified:** 90 screenshots + 10 videos (`draft-screenshots/auth/`: login, register, step 2, hook scored,
hook → keep × 1440/1280/820/390 × light/dark × full/reduced; `story-*.webm`). In the desktop video the form
is fully drawn while the headline is still setting. 8 injected violations, all red (entrance animation
back, backdrop taking pointer events, deal or drift ignoring reduced motion, headline replaying per
route, a number in the hook, the résumé in sessionStorage, step 2 losing its slash). ⚠ First injection
run was VOID — my own over-broad regex was already red, so every case "fired"; fixed and re-run.

**Not done / noticed:** OAuth buttons render only when a provider is configured (unchanged). The footer
still says "AI-powered resumes for the modern job search" — that is the site's one-product framing, and
it is row 31's problem.

### 2026-10-01 (7) · Agent queue 27–29 — the deck's fan, the deal, shared-element transitions

27 → 28 → 29 run as ONE sequential task (same files), one commit. Rows 30–31 follow, separately.
Everything below is local; nothing pushed. Baseline re-derived first: 2833 / 2833 / 0; after: **2857 / 2857 / 0**.

#### First, before any motion work: is the deck dark on purpose? — **No, and it is not dark.**

The premise was that the shipped deck is dark while 2b settled on cream. Git says otherwise: the deck
(`be8833a`, 09-30 20:08) was built **after** 2b (`2356153`, 09-30 00:30) and reads every colour from
`colorTokens.js`; its own screenshots (`draft-screenshots/deck/`) are cream. Dark mode (`6788a8e`, step 6)
landed 20 minutes later and re-points the same tokens — and the preference defaults to **"system"**, so a
machine set to dark sees the charcoal leather (`draft-screenshots/dark/dark-today-*`). What the owner saw
is dark mode following the OS, not a deck that predates 2b. No palette was assumed: the fan is tokens only
and every state was shot in both themes.

#### 27 · The fan

- **Built:** `client/src/lib/fanGeometry.js` (pure; every number), `components/CardBack.jsx`, DeckView rebuilt
  as the fan. Front card face-up, square-on, **exactly the 700×380 card** (it is not scaled — "pulled back"
  applies to the cards behind, which is how 0.72 and "nothing shrinks" are both true). Desktop ≥ 1100px:
  pivot right, horizontal cards; below: pivot below, vertical cards. Width-driven (`FAN_SWITCH_PX = 1100`),
  so a portrait tablet (820) gets the vertical fan.
- **The back:** the company's logo through an SVG filter (alpha − luminance, flooded with `C.ACCENT`,
  blurred), a 5% orange weave, the `/` in the corner. ⚠ Not `mask-image`: masks are fetched CORS-mode and
  DuckDuckGo's icon host does not answer CORS. No logo → weave and mark only; ⛔ never a letter.
  Trademark → **OWNER 34**.
- **Layering:** `Z.BG` / `Z.FAN` added below `Z.CONTENT` in the one z-scale (`--z-bg`, `--z-fan` published);
  `PaperBackground`'s Tailwind `-z-10` became `Z.BG`. The fan passes behind header and action row; only the
  face-up card is CONTENT. A test refuses any `zIndex:` number in the deck — it caught one of mine (the swipe
  stamps), now ordered by DOM instead.
- **Interaction:** wheel over the stack rotates it, captured ONLY when a rotation is possible (at either end,
  and while a card is expanded, the page scrolls). J/K and ↑/↓ do what the wheel does; ‹ › buttons beside
  the counter do it for touch; a peeking back is tappable; Enter expands IN PLACE (no `<Detail>` block, no
  route), Esc folds; the action row sticks. Reducer gained `step` / `stepTarget` / `fanOrder` (decided cards
  leave the fan; it closes up).

**⚠ GEOMETRY — the reach sweep** (550 / 700 / 900 / 1100 / 1400, both orientations, mid-stack; sheets in
the scratchpad, finals in `draft-screenshots/fan/`). Each fixed number is the edge of a constraint, written
into `fanGeometry.js` and pinned by a test that names the constraint:

| | fixed | why |
|---|---|---|
| horizontal reach | **800** | largest that keeps the opening stack in 1440×900 — 4th card's bottom edge at ~899px. 900 clips (933px); 550–700 step < 70px per card and the backs bunch out of sight |
| vertical reach | **1100** | smallest at which the first back clears a 318px card far enough to show its logo |
| vertical zoom | **0.86** (was 0.72) | ⚠ premise adjusted: at 0.72 a narrow back's logo sits entirely BEHIND the front card — a phone rotates blind, the exact failure the logo back exists to fix. 0.86 shows ~90px of the first back |
| spread / horizontal zoom | 7° / 0.72 | held as briefed |

At 1280×800 the faint 4th card clips at ANY reach — height is the binding dimension there; the opacity fade
and the counter carry it.

**⛔ THE FLIP'S FRAME BUDGET — measured, failed, fixed.** No real phone here, so: Chrome at Lighthouse's
mid-tier-mobile proxy (4× CPU, plus 6×), 390×844 @ DPR 2.75, rAF intervals across six rotations,
**production build**:

| | > 25 ms frames | p95 | worst |
|---|---|---|---|
| framer-motion transforms (first build), 4× | **13–26%** | 33–67 ms | 117–217 ms |
| …without logos / filter / shadows / 3D, or at DPR 1 | no change | | |
| …with only 3 cards | ~6% | | |
| **CSS transitions of transform + opacity (shipped)**, 4× | **2.7–4.7%** | **17 ms** | 100–133 ms |
| same, 6× | 16.8% | 83 ms | 267 ms |
| desktop, unthrottled | 0% | 16.9 ms | 17 ms |

Card count mattered and raster did not, so it was main-thread scripting: framer computes x/y/rotate/scale
per card per frame in JS. Rotation and flip now run on the compositor; framer keeps only the once-a-day
deal, the drag and the exit flights. The remaining long frames are ~1 per keypress (React re-render on
input). ⚠ A throttled desktop CPU is not a phone GPU → **OWNER 35**.

**Edge clipping:** the opacity fade reaches zero exactly past `visible` (4), and the counter (`4 / 10`)
says where you are in a stack that runs past the frame.

#### 28 · The deal and the end

- **Once per day:** `setDealing(!!deck.dealtNow)` — the server's "this request dealt" — and nothing else.
  Cards arrive from the pivot side face-down, farthest first; the front card turns up last. Reduced motion:
  no deal.
- **The end is a moment:** the slash draws full; "That's today's draft."; dealt · drafted · saved · passed;
  the drafted jobs listed with their logos; "Nothing has been sent… N things need you in the queue now"
  (AutoApplyContext's `needsAttentionCount`, the same number as the tab badge); "That is it until tomorrow:
  the next draft is dealt in 22h 38m"; Review your drafts / All jobs / Undo.

#### 29 · Shared-element transitions — ⛔ two premises corrected

1. **React Router's `viewTransition` prop does nothing here.** It needs a data router; App.jsx mounts a
   declarative `<BrowserRouter>`. Wired as briefed it would have looked done and never run. Replaced by
   `lib/viewTransitions.js`.
2. **The first replacement did nothing either — caught only in a browser.** `startViewTransition` +
   `flushSync(navigate)` passed every source test; a probe wrapping `startViewTransition` showed the only
   named element on BOTH sides of the snapshot was the deck's own title. Cause, read in
   `react-router/dist`: `BrowserRouter` commits history updates inside `React.startTransition`, which
   `flushSync` cannot force — the browser snapshotted the old page twice. Fix: the update callback awaits
   `<RouteCommitSignal/>` (a layout effect inside the router), capped at **200 ms**; a destination title
   that renders a beat later (the board's detail fetches its job) is awaited within the same cap.
   Re-probed: deck `h2` → board detail `DIV` "Software Engineer, Platform"; Today → Auto Apply lands on the
   queue's `SPAN`. **Production wait 73–97 ms (tab), 131–151 ms (deck → detail)** — mostly the route's own
   render, which happens with or without a transition.

- **Unique names:** the queue can show one job in several sections, and a duplicate name makes the browser
  abandon the whole transition — so components mark titles `data-vt-title` and `nameSharedTitles()` names
  the first VISIBLE one per job at each snapshot.
- **Never gates input:** `:root::view-transition { pointer-events: none }`; 180 ms; reduced motion starts no
  transition at all (and CSS drops the animation). Deck decisions do not use view transitions: Draft flies
  to the measured Drafted counter, Pass drops under the fan by tier (`Z.FAN − 20`), and the reducer already
  commits before any animation.

#### Verification

- **Screenshots: 100** (`draft-screenshots/fan/`) — rest, rotated, expanded, after-draft, finished × 1440,
  1280, 820, 390 × light/dark × full/reduced. **Videos: 10** (`story-*.webm`: deal → wheel → keys → expand →
  fold → draft → pass → save) — all four breakpoints in both motion settings, plus desktop and mobile dark.
  Watched as filmstrips: the front card arrives showing Figma's blurred logo, turns up; rotation flips one
  down as the next arrives face-down; reduced motion cuts.
- **Injected violations: 25, all red** — reach 900 and 650, vertical zoom 0.72, a 900px switch, the wheel
  captured before the end check and while expanded, a zIndex literal, the flip ignoring reduced motion, the
  position animated by `top`, a deal per navigation, a letter on the back, a literal flood colour, a
  wrapping step, FAN above CONTENT; dedupe removed, reduced motion starting a transition, the overlay
  taking input, a 400 ms transition, a tab bypassing the helper, Pass flying forward, an untagged queue
  line; flushSync restored, the commit wait removed, a 400 ms cap, the signal outside the router.
- **Also fixed, found by the harness:** `AppRouter` called `useMonetisationEnabled()` after an early
  return — React warned "change in the order of Hooks" on every load. Moved above the return. The deck's
  toast was centred with `left:50%` + translate, which shrink-wraps it to half the viewport (eight lines on
  a phone); now margin-centred.
- **Observed, not changed:** the top bar is transparent, so a long expanded card scrolls visibly behind the
  nav labels. That predates this work (it holds on every page) — a one-line follow-up if wanted.

### 2026-09-30 (6) · Agent queue 21–26

Run in order, one at a time, one commit per row (per repo where a row touches two).

#### 26 · Segmented curation — ⏸ blocked, and one of its premises corrected

⏸ **Not built.** It is blocked on the board CARRYING student roles (queue 25 measured where they are;
the route is OWNER 32) and on a blind-graded student reference set (OWNER 33) — without both there is
nothing to curate and nothing to validate against. Its three premises were measured instead
(`scripts/studentSegmentPremises.mjs`, read-only):

1. ⛔ **"The résumé-side `SKILL_HINTS` list is the real gate" — WRONG as stated.** The list is real
   (33 items, not 32, and matched by SUBSTRING — "api" matches "capital", "rest" matches "interest",
   "java" matches "javascript"). But the scorer matches the résumé TEXT directly; `SKILL_HINTS` only
   adds `basis.skills`. Scoring a student-shaped résumé (coursework, projects, a TA role, a hackathon)
   against all **67** entry/intern postings with and without those skills: **63/67 identical.**
   **The real gate is the POSTING-side vocabulary** — the registries the scorer extracts terms with.
   *data structures, algorithms, computer networks, coursework, teaching assistant, GPA, hackathon,
   compilers, Django, pytest, object-oriented programming* are **not in it** (only *operating systems*
   and *LLVM* are). A posting asking for data structures cannot be scored on it unless enrichment's
   `skills_json` happened to carry the term (it did once). So the work is registry vocabulary, not the
   résumé extractor.
2. ✅ **The seniority guard is profile-relative in ONE direction only** — confirmed. It caps a junior
   posting for a non-entry profile; for a STUDENT profile, **0 of 300** senior/lead postings are capped.
   The missing direction is the build. It would not move ρ (the graded 30 are scored for profile 6,
   which is not an entry seniority) — but it cannot be validated without OWNER 33's set.
3. ✅ `am1-ats-graded-corpus.json` — 30 senior roles graded by an experienced engineer — stays and does
   not validate a student segment. Unchanged.

Also seen: the board's 67 entry/intern postings are scored mostly on SALES vocabulary (*onboarding,
Salesforce, go-to-market, pipeline generation, cold prospecting*) — most "entry" rows are BDR/SDR roles,
as the finding said. The student *software* supply is what queue 25 is about.

### Queue 21–26, summary

| | Landed | Commits |
|---|---|---|
| 21 G3 | ✅ local — tests asserted narrower than the behaviour; the model's real shape dropped every date and printed the role twice; fixed in the classifier | RM `6ec0dd3` · draft `a1a14d8` |
| 22 G6 | ✅ local — 11 verbs to generic; verb-evidenced competencies off the missing list; cached reports re-keyed; ρ 0.746 unchanged. Two score-moving fixes → OWNER 31 | draft `eae68e1` · RM `661b758` |
| 23 K1 | ✅ local, DECOUPLED — `--verify` passes both directions on the real KB | draft `18bef21` |
| 24 R1 | ✅ local — measured first; discriminates; no public route | draft `03836c0` |
| 25 | ✅ measured, nothing built — route → OWNER 32 | draft `c618e0d` |
| 26 | ⏸ blocked on OWNER 32 + 33; premise 1 corrected | this commit |

⛔ **Nothing is pushed.** Resume Master's `main` (G3 + the re-vendored scorer) and draft's `main` both
auto-deploy on push — the owner's go. **draft 2831 / 2831 / 0 · Resume Master 235 / 235 / 0.**

#### 25 · Ingestion for the student segment — measured, nothing built

Nothing re-tested from `STUDENT_BOARD_FINDING.md` (classifier, discard path, cause A stand). Read-only
probes of public endpoints only; nothing enabled, nothing written to any table.

**Where student and new-grad roles actually live.** The two public curated lists (SimplifyJobs
*Summer2026-Internships* and *New-Grad-Positions*, `listings.json`, one GET each, 12.8 + 13.4 MB) hold
**4,429 active internships + 3,057 active new-grad roles = 7,486, at ~2,200 companies.** Of those,
**our 25 configured companies carry 48** — the same order as the board's 19 distinct. The roles are at
OTHER companies, not hidden in ours. By host:

| Host | Active student roles | Adapter today | Description coverage (probed) |
|---|---|---|---|
| **Workday** | **2,518 (34%)** — 590 sites | `workday.js`, 1 site configured (inactive) | ✅ 4/4 via the public page's JSON-LD (5.7–17.8k chars) — what `detailFetch.js` already reads |
| Custom career sites | 2,070 (28%) | none | ⚠ 6/16 have JSON-LD (TikTok, ByteDance, Apple: 0) |
| **Greenhouse / Lever / Ashby** | **1,613 (22%)** — 637 boards | ✅ all three | ✅ **14/14 boards, every student posting described, in the list call** |
| Oracle / Taleo | 505 | none | ⛔ **0/6** — JS-rendered, no JSON-LD |
| iCIMS · Eightfold | 307 · 64 | none | ✅ 4/4 live (2 were 410) · ✅ 4/4 |
| SmartRecruiters | 282 | adapter, 2 inactive | ⛔ **0/4** on the page — the Ubisoft/Bosch shape. Do not enable |

Seasonal, and in season now: internship postings by month peak **Aug 2,348 → Sep 3,870**; median listed
age 27 days (intern) / 49 (new grad); **591 posted in the last 7 days (~85/day)**. Student roles also sit
on SEPARATE sites inside one tenant — the one configured Workday row is Adobe's
`external_experienced` site, which by its name excludes them.

**Realistic volume per source — concentrated, but not very.** Greenhouse/Lever/Ashby: median **1**
student role per board; the top 100 boards hold **53%** (~855), top 200 68%; 64 boards have ≥5.
Workday: median 2 per site; top 100 sites hold 59% (~1,470); 143 sites have ≥5.

**Cost per crawl — probed, not modelled:**
- **Greenhouse/Lever/Ashby: 1 request per board**, description included. Mid-size boards 0.6–2.4 MB
  and 76–200 ms (Jane Street 230 jobs / 5 student, IMC 169 / 23, Astranis 174 / 58, Palantir 318 / 79).
  ⚠ The giants are the cost: **SpaceX 29.5 MB (55 student), Anduril 41.7 MB (34), TSMG 33.8 MB and 11.6 s
  for 3.** Across the 14 probed: 131.6 MB for 344 student postings; **without the three giants, 26.6 MB
  for 252 (~0.1 MB each).** Top-100 boards ≈ 100 requests, ~130 MB at the probed median plus whatever
  giants are in it.
- **Workday: the list call has no description, and `searchText` is not a filter** — "intern" returned
  all 3,076 of Micron's postings, 2,436 of RTX's 4,868. So it is the WHOLE site, 20 per page: **RTX 244
  pages, Northrop 188, Micron 154, NVIDIA 100** (13–79 KB each), then one ~20–44 KB page GET per student
  posting for the description. ⛔ `workday.js` stops at **15 pages (300 postings)**, so on those four it
  would see 6–15% of the site — it cannot serve these tenants as written.
- **The index route:** the two `listings.json` files are a 2-request daily discovery index with the
  ATS URL of every role; descriptions would come from the company's own page, ~85 new a day. ⛔ **Neither
  repository declares a license** (GitHub's license API: none) — using it as a feed is a terms question,
  not an engineering one.

⛔ **Never enable** SmartRecruiters (0/4) or Oracle/Taleo (0/6) on this evidence. The decision between
the routes is **OWNER 32**.

#### 24 · R1 — grade the employer's posting

✅ **Built and measured; no public surface yet.** `services/postingGrade.js` (`gradePosting`,
`boardBaseline`, `requirementsSections`) + `scripts/r1PostingGradeMeasure.mjs`. **Zero model calls**
(a test checks the imports). **Comparative only** — every line is the posting beside its peers' median
or rate; there is **no total score**, and a test fails if a grade names another employer.

⛔ **A premise the doc did not know about: the board's text is CAPPED.** `htmlToText` stores the first
~3,000 + last 2,000 characters with the middle elided — **1,853 of 2,613** local postings. The middle
is where requirements sit: **2 of the 20 sampled postings (OpenAI, Scale AI) have their requirements
section cut out of the stored text.** So the counts (tools, generic share, boilerplate) cap the submitted
posting the same way, to compare like with like; requirements are read from the posting's FULL text
and compared only with the **759 uncapped** board postings. The result says so (`comparedOn`).

**1. Requirements-section detection, measured first (20 postings, hand-labelled from the stored
text):** **17 of the 17 whose section is visible — 100%**, agreement 20/20; the other 3 are 2 elided
by the cap and 1 Match Group posting with no structure. Board-wide it then read 69%; reading 20 + 12
of the NEGATIVES found 7 real phrasings it missed ("We're Seeking", "Your background might look
something like", "✅ You have…", "WHAT YOU NEED", "The ideal candidate…") — added. **Uncapped board:
82% (626/759).** The remaining 60 uncapped negatives are **Spotify 27, Match Group 22, Wealthfront 7** —
feeds that store a ~1,450-character summary, not the posting. Not a detector miss; the section is not
in what we hold.

**2. Discrimination over 50 postings** (the v3 engine's failure was sd 2.87 on 0–100):
| Measure | Raw spread | As a peer percentile |
|---|---|---|
| Specificity (registry tools named) | 0–7, median 1, sd 1.48, **7 distinct values** | 14–95, sd 24.8, 20 distinct |
| Generic-language share | 13–68%, sd 0.11 | 2–99, sd 29.7 |
| Boilerplate share (recurs in ≥3 of the company's other postings) | 4–100%, sd 0.23 | 2–98, sd 29.4 |
| Requirements section / separates preferred | 38/50 · 19/50 | — |
| Seniority incoherence | **0/50 — and 0 board-wide**: 48 junior titles, 1 states years | — |

It discriminates — but **specificity is coarse**: the tools vocabulary is the registry's 172 and the
text is capped, so the **median ENGINEERING posting names 2 tools (p90 6)**, not the "11" §R1 used as
its example. Peers are the role family (`bucket_role`, ≥30 postings; `category` is NULL on every row) —
a sales posting naming no technologies is not under-specified (sales median 0).

**Not built, on purpose:** narrowing language — §R1 allows an evidence-based list only, and none was
verified against its source here. A public route — it needs the rate limit §R1 requires and the
anonymous-spend lesson, and it is the outward-facing step; the measure is ready for it.

10 tests. **2831 / 2831 / 0.**

#### 23 · K1 — the KB sanity check, built decoupled

✅ **Built as a standalone check, NOT wired into generation (OWNER 30).** `kbSanityCheck` in
`services/kb/failsafe.js` — an EXTENSION of the 9.6 failsafe (same extraction, same org-unit key,
same place detection), not a second checker — run by **`node scripts/k1KbSanityCheck.mjs`**
(`--html … --base …`, `--html … --profile N`, or `--verify`). A test fails if `server.js`, `routes/`
or `services/` call it. ⚠ `validateResumeClaims` IS already on the generation route (`server.js`
`kbFindingsFor`) and is left exactly as it was — changing it would have wired K1 in by the back door.

⛔ **The premise needed measuring, and the obvious design fails in BOTH directions.** On this KB:
- **The G1 fabrications are company-PLAUSIBLE.** Stripe's own postings mention **Kafka (12)**, and
  Stripe has **Risk Operations** and **Payments and Risk** units. "Kafka at Stripe" and "worked with
  the risk team at Stripe" are TRUE company facts. A KB-only check can never flag them.
- **A KB-only absence check flags the owner's TRUE résumé.** Stripe's KB has **no "GCP Pub/Sub"**, and
  "Payments Infrastructure" is not a unit (Jaccard 0.5 to "Payments" — the old 9.6 rule would say
  *suggest_fix*); the title "Software Development Engineer" is not a Stripe title shape. The owner
  really used, belonged to and held all three. That is Bangalore again.
- ⚠ And the existing 9.6 check is **silent on every real generation**: `extractTeamClaim` expects
  "Title, Team" in one field, the model now writes the title in `entry-role` and "Payments
  Infrastructure, Bangalore" in the meta, so no team claim is ever extracted. Not changed (it is on
  the generation path); recorded.

**So a finding needs BOTH:** a company-shaped claim at a named employer — a team, or a technology the
KB knows that employer uses (filtered to the registry's TOOLS: Stripe's technographics also hold
"financial reporting", "APIs", "payment processing", which the first run called technologies) — AND
a source résumé that does not support it. The KB says whether the claim is plausible at that
company; the source says whether it is the candidate's. A sourced claim is never flagged. No source
→ it declines.

**Acceptance, on the real KB (`--verify`, exit 0):**

| | Result |
|---|---|
| G1 document 2 (saved 09-28, bullets verbatim) | ⚑ **"risk" and "infrastructure" teams at Stripe** — *plausible (Stripe has Risk Operations / Core Infrastructure), not in the source* |
| Same request regenerated 09-30 | ⚑ the same two (the model invented them again) |
| Stand-in for G1 doc 1 — **Kafka claimed AT Stripe** | ⚑ *Stripe's postings use it (12), your source never mentions it* |
| ⛔ **Owner's real résumé** (profile 6, Stripe, Bangalore), as its own generation | **no findings** — 1 team and 3 technologies checked on the Stripe entry |
| Owner's real résumé, generated 09-30 through the live prompt | **no findings** — 1 team, 3 technologies checked |

⚠ G1 document 1 (the one that "listed Kafka") was **never saved** — the 09-28 run printed 160
characters of it. A Kafka-at-Stripe line stands in, and the harness shows **Kafka in a SKILLS list
NOT flagging**, because that is a limit, not a pass.

⛔ **What it cannot catch** (carried on every result as `cannotCatch`, printed by the script):
anything in the skills section ("Kafka" is not a company fact) · a technology the employer's postings
never mention · responsibilities, metrics, outcomes (G1 doc 2's "Instrumented service-level
metrics…" is NOT flagged) · title shape · any employer outside the KB (7 companies with org units,
10 with technographics — **Amazon is not one**, so half the owner's résumé is unchecked) · a claim the
source makes at a different employer (support is document-wide, on purpose).

⚠ **Overlap to see:** K1 reads the SOURCE résumé, which is what queue 2's deferred unsupported-content
check would do — narrowed here to company-shaped claims, which is what lets the G1 documents flag at
all. Decoupled, it changes nothing the owner deferred. Wiring it is the later decision OWNER 30 names.

10 tests (both directions on a KB that mirrors Stripe's real rows; decoupling; never writes).
**2821 / 2821 / 0.** `RECRUITER_LAYER.md` and `RECRUITER_LAYER_EXECUTION.md`, untracked until now,
are committed with this row — K1 is built from them, and the directory table says they were lost once.

#### 22 · G6 — the generic-language gaps

⚠ **The premise was half wrong: there is no threshold to tune.** AH3 deliberately rejected a frequency
threshold for verbs (Managed is in 44% of postings, Built in 93% — frequency keeps the wrong ones) and
set the generic list by a STATED semantic criterion. "Defined" and "Created" were simply not on it.
And "collaboration" was not a genericness problem at all — it was a **false negative in matching**.

**Measured first** — the owner's real résumé (profile 6) scored against all **2,079 scorable local
postings**, every bucket tallied:
- Verbs reported MISSING: Created **55%** · Improved 39% · Planned 37% · Defined **33%** · Increased 28%
  · Influenced 20% · Surfaced 14% · Structured 14% · Prioritised 11% · Iterated 11% · Facilitated 8%.
  Several are not even the posting asking: "increase" is Stripe's mission statement ("increase the
  GDP of the internet"), "surface" mostly the noun ("API surfaces"), "plan" the noun ("account
  plans").
- Competencies reported MISSING: cross-functional collaboration **15%**, collaboration **6%** —
  ⛔ while the résumé says **"Collaborated with cross-functional teams"**. Lexically "collaborated" is
  not "collaboration". The report told the candidate who had written the quality down that they lacked
  it.

**Fixed:**
1. Those eleven verbs join `GENERIC_ACTION_VERB_WORDS` by AH3's own criterion (an outcome or stance
   anyone can assert, not a checkable act). **Kept as gaps on purpose:** Led, Scaled, Shipped,
   Deployed, Launched, Architected, Prototyped, Researched, Recruited, Administered.
2. A competency the résumé shows **as a verb** is not reported missing (`hasCompetencyAsVerb`, a
   short explicit noun→verb map, the same adjacency window as any term — "collaborated with
   cross-functional teams" satisfies "cross-functional collaboration"; the two words a page apart do
   not). ⛔ **REPORT ONLY** — by AH3's rule a change to how the report reads must not move the number.
3. ⛔ **The fix would not have been SEEN without this:** cached reports are served whenever
   `source === local_ats_v4`. Bumping the source would split one scorer into two in the outcome
   analysis (it groups by source), so the package now exports **`ATS_REPORT_CACHE_KEY`**
   (`local_ats_v4/buckets-2`), and both basis-hash sites in `server.js` use it — panel and precompute
   still agree, and every stored panel report is re-scored on next read. ⚠ A report saved WITH a
   generated résumé (`resumes.ats_report`, priority 1) keeps its buckets — it is that document's record.

**After, same 2,079:** Defined, Created, Improved, Planned, Increased… are in Generic Language;
cross-functional collaboration and collaboration are **gone from missing**. ⭐ **ρ = 0.746, drift 0.000**
(`am1GradedCorpusVerify`; τ-b 0.596 → 0.595 — moving verbs between buckets moves which survive the
per-bucket caps, which is a hair of score movement, inside tolerance).

**Found, measured, NOT shipped — both move the score, so both are OWNER 31:**
- Counting verb-evidenced competencies in the SCORE: ρ **0.746 → 0.761**.
- ⛔ `COMPETENCY_REGISTRY_TERMS` has three dead entries — the normaliser turns "cross" into "cros", so
  "cross-functional", "cross functional" and "cross-functional collaboration" are looked up as
  "cros functional…" and every registry-path hit is filed under **SKILLS**. AH3's own defect, through
  the mistake AH3 documents for the verb set. Keying the set through `normaliseAtsTerm` moves ρ to
  **0.755** (reclassification changes what survives the caps).
  Each is n=30 and inside what that set can distinguish; the real cost is that the band cutpoints
  (Strong ≥ 44 at 100% precision) were calibrated on today's numbers.
- Not touched, recorded: "culture" is reported missing on 20% and "strategy" on 40% — "culture" is a
  registry term from the HR domain. A candidate cannot lack "culture"; it is the next G6.
- ⚠ The wider cause: verbs are read from the WHOLE posting, boilerplate included. That is R1's
  requirements-section question (queue 24).

6 new tests (the old scorer gives exactly the owner's report on the fixture: *Defined, Planned,
Created, Improved* missing; *collaboration, cross-functional collaboration* missing). Package
checksums rewritten, re-vendored into Resume Master byte-identical. **draft 2811 / 2811 / 0 · Resume
Master 235 / 235 / 0.** ⚠ Not deployed.

#### 21 · G3 — why AG4's tests did not see it, and the fix

⛔ **The answer to the question first: the tests asserted something narrower than the behaviour. The
path did NOT move.** `generate.js` → `normalizeResumeHtml` is the same code A2 carried over byte for
byte (draft's `services/resumeFormatter.js` and Resume Master's copy were identical at HEAD). Two
narrownesses, both in the test file, not in the code it tested:

1. **Every AG4 fixture was written in the renderer's OWN vocabulary** — `entry-date` as a `<div>`,
   `entry-role` a sibling of the header, `entry-meta` inside it. The prompt names the classes
   (layer 1, one line) and never the structure, and **the model does not write that structure.**
   Captured 09-30 from two real generations through the live prompt (the owner's base résumé from the
   local DB, and the 09-28 synthetic one; ~$0.13; run with the kernel in-process, raw output captured
   before the formatter, nothing persisted outside the scratchpad):
   ```
   <span class="entry-org">Stripe <span class="sep">|</span> <span class="entry-role">Software Development Engineer</span></span>
   <span class="entry-date">Aug 2022 - Dec 2023</span>
   </div>
   <div class="entry-meta">Payments Infrastructure, Bangalore</div>
   ```
   The role is NESTED IN the org; the date is a SPAN; the meta sits OUTSIDE the header.
2. **The detector, `duplicatedLinesPerEntry`, counts IDENTICAL lines only** — "Stripe | Software
   Development Engineer" and "Software Development Engineer" are different lines, so a role printed
   twice reads clean. Run on the real output it reports `[]`. And **nothing asserted content was
   KEPT**, so a loss was invisible to it by construction.

⛔ **It was worse than G3 recorded: every date was being DROPPED.** The date reader looked only for
`<div class="entry-date">`; the model writes a span. **10 of 10 dates (owner) and 3 of 3 (synthetic)
vanished** from the formatted document — the header then showed `Stripe | Software Development
Engineer | Payments Infrastructure, Bangalore` with no dates at all, which is the owner's G3 shape.
(The 09-28 run that DID show dates had a different shape on the day: the shape varies per call, which
is the other reason hand-written fixtures cannot stand in for it.)

**Fix — in the classifier, not the renderer (AG4's own rule):** each field is read as its element's
text MINUS any other field nested inside it, found by class whatever its tag (`readEntryField`); a
field element outside the header leaves the leftover text only if it IS the field read
(`isReadField`), so a second, different `entry-meta` is kept as prose rather than lost. The div-only
date reader is deleted. Re-run on both captured documents: dates 10/10 and 3/3, role once, a fixed
point.

**Tests assert the behaviour now:** `assertEachFieldOnce` — every field of the source renders exactly
once, neither lost nor repeated — against entries copied from the captured output. **3 new tests,
all 3 FAIL on the old formatter** (verified by stashing the fix), pass on the new.

- Resume Master: **235 / 235 / 0** (was 232). draft: the same formatter and test file mirrored —
  **2805 / 2805 / 0** (was 2802), working tree.
- ⚠ Not deployed: Resume Master's is a push (auto-deploys); draft's copy is used by the 9.6 failsafe's
  extraction (`services/kb/failsafe.js` → `buildStructuredResume`), so the fix matters to K1 too.
- ⚠ Seen on the way, not this row's: both replays were REFUSED by the claim guard — the model wrote
  the JD's title, "Senior Backend Engineer", as the tagline. The guard working as designed (G1 is
  about what it does not check).

### 2026-09-30 (5) · Account management

Owner: *"for the two accounts there should be a provision to be able to merge them, and we need to
wire all the basic account management … cookie encrypted sessions, profile and management profile
pictures, forgot password, delete account and everything else."*

- **Foundations, `6c3b12b`:** sessions SEALED at rest (`EncryptedSessionStore`, AES-256-GCM, key
  HKDF-derived from `COOKIE_ENCRYPTION_KEY`; legacy rows still read, so nobody was signed out);
  SameSite=None → Lax unless a cross-origin frontend needs it; cross-site state-changing requests
  refused (`originGuard`); email honest — ⛔ production had been answering "reset email sent" while
  sending nothing and LOGGING the reset link and code.
- ⛔ **A regression from that commit, found and fixed in this one:** `revokeAllUserSessions` read the
  session rows as plain JSON. Behind the sealed store that read threw and was swallowed, so a
  password reset destroyed NO cookie session. Now `SStore.sessionsForUser()` opens each row
  (`test/sealedSessionSweep.test.js`, real connect-sqlite3); the old pin that asserted the raw read
  was replaced.
- **Migration 113** (both runners): `user_sessions` (a registry — the sealed store cannot list "my
  sessions"), `users.password_set` (backfilled: no provider id ⇒ a password account; OAuth accounts
  got a random password nobody knows), `avatar_path`, `email_verified_at`, `email_codes`,
  `account_merges`.
- **`services/accountService.js`** — tested on the REAL migrated schema (10 tests). Merge has a plan for
  every one of the 37 user tables (move / keep-into / fill / drop) and ⛔ REFUSES if a table without a
  plan appears — a new table would otherwise be silently cascade-deleted with the merged account; a
  test fails the moment one is added. Provider identities move; admins and two different identities of
  one provider refuse. Delete clears the one table without an FK and returns the files to remove.
- **`routes/accountManagement.js`** (20 routes, in the guard manifest; 5 HTTP tests): profile name;
  picture (sniffed by BYTES — an SVG named .png is a 415; served with nosniff and CSP; new name per
  upload); sessions and app tokens listed by a hash, never the sid, and signed out IN THE STORE;
  password change/set (set needs a recent sign-in; a change signs out everywhere else); email change by
  a 6-digit code to the new address (HMAC'd, 15 min, 5 tries); unlink (never the last method);
  export; merge (prove the other account by its password, or by `/auth/:provider?mode=merge`, which
  finds it by provider id only and signs nobody in; preview; confirm); delete (recent sign-in + the
  username typed). Every sign-in is stamped (`req.session.authAt`) by wrapping `req.logIn`.
- **`/app/account`** — light, dark and 390 px screenshotted against a locally booted server (paid keys
  blanked, throwaway data dir), and the flows driven live: registry row, wrong/right password,
  email 503 without a provider, merge OAuth redirect. Avatar in the top bar (uploaded, else Google's).
- Already there and kept: forgot-password (`/api/auth/password-reset/*`) — it needs OWNER 28 to send.
- Tests **2802 / 2802 / 0**, run alone.

### 2026-09-30 (4) · Live checks; a new-account Today fixed; the redesigned mark; Android on the leather; the account theme

- **Deploy `ee4b1bd` checked**: migration 111 applied, contract 1.2.0, clean boot. The owner's Google
  sign-in **works** — the integration row written, its token sealed by the key — but created a NEW,
  empty account (user 10), and Today answered "could not be dealt. no_active_profile". Fixed in
  `ed1a42d` (deployed): no profile / no résumé are set-up states with a way forward, on web and Android.
- **The mark** (`9feac48`, android `ef2bae4`): "/draft" and "/d" cut from the owner's artwork (the
  orange keyed out, the glyphs separated as connected shapes so the italic slash and the d part
  cleanly), the same vertical crop for both so the condensed mark sits exactly on the expanded one;
  StampLogo renders them; favicons (there were none); the Android launcher icon (it was the template
  robot). Seen on the landing page, Today, light and dark, and the emulator's app drawer.
- **Account theme** (`c39dff7`): migration 112, the preference follows the account.
- **Android's look** (android `d2f0e3a`): web tokens, theme-aware; the web's leather tile; glass
  cards — found on the emulator that see-through cards showed the NEXT card's text, so the cards
  behind are blank slabs now, as on the web.

**Measured:** draft 2779/2779/0 run alone; android 58/58 JVM, 15/15 instrumented.


### 2026-09-30 (3) · The redesign built: crisp leather, lit glass, Today's draft, Android on the deck, dark mode

The owner confirmed the deck proposals and found the board "mundane … like 2012"; wanted bench C's
crisp leather and more gloss. Done in that order, each slice tested, screenshotted and committed:

- **Grain + glass** (`3f448e7`): bench C needs a 12% shadow, past the old floor — so the FLOOR token
  moved and every pair was re-proved (one moved). A lit glass material. Two causes of the flat look
  found: a grey static overlay on every card, and the board sitting on `theme.bg` — which is the
  GLASS token, a 58% cream sheet over the leather.
- **The deal** (`be26aa7`): the 690-line `/api/jobs` handler became `boardPageResponse`, so the deck
  deals from the board's own query. Migration 111 stores the deal, not the decisions.
- **The API** (`4a139af` `9464bae`): `/api/draft/today`, contract 1.2.0, the deck surface refuses
  any `approvalMode` (tested in-process for every value), frozen evidence per card.
- **The deck** (`be8833a`): Today's draft. Keys, web swipe with a following, tilting card and
  stamps, a visible stack, fly-outs, the slash as progress, every state; a pure reducer proves no
  animation gates input and a refused call is never a success.
- **Android** (draft-android `f7fdc2c`): the same deal; right drafts ON THE SERVER (it never reached
  one before); two gestures. Found on the way: the deck's null score would have shown every card as
  "Not enough signal" — the dealt band is carried instead.
- **Dark mode** (`6788a8e`): both palettes proved; it found a real avatar failure the light theme
  could not; the leather's floor inverts in dark and is tested for both.

**Measured:** draft 2777/2777/0 run alone; client build OK; android 58/58 JVM + 15/15 instrumented.
Screenshots: `draft-screenshots\` (`deck`, `dark`, `gloss`, `grain`, `android`). Nothing pushed — the
approved push was blocked by the session's permission guard (OWNER 7c).


### 2026-09-30 (2) · Pushed; backups listed and a retention bug found; public ATS on the v4 scorer; leather grain; steps 3–6 designed

**Push** (owner's go, key set first): `dad1114..9108a15`, live 20:18Z. Boot log: secret key
configured, migration 110 applied, the fit backfill scored 2,688 jobs in 35 s with 0 failures.

**Backups, listed over SSH** (owner-granted): 26 files, 350 MB; volume 392/879 MB. ⛔ **Nothing from
09-17 to 09-29 survives.** The manifest is correctly newest-first; the defect is `selectRetained`,
which `continue`d past a backup that did not fit the byte budget and kept going — so as the DB grew
(14 → 28 MB) every recent backup was the misfit and every small August one was kept. Fixed
(`b628ee6`): past the protected head, retention keeps a contiguous newest run. The uniform-size
tests could not see it; the new one uses production's shape and fails on the old code. Prune list →
OWNER 9. (The manifest came back empty through a shell redirect — Railway's SSH writes to the TTY —
so it was printed in place.)

**G1 answered** — see the G1 section: both fabrications were GENERATE, not A+. AF5 unblocked by
the owner, on supervision.

**Public ATS tool** (`fc668be`): the Haiku call and its donut are gone; the v4 scorer with the
panel's weights and synonyms, answering with a band and evidence and no number; no rate limit.
Found: draft's scorer wrapper defaulted the profiles to `null`, crashing any caller without a basis
(the public tool is the first); and the thin-résumé note would have fired for EVERY anonymous
visitor (its `few_skills` arm counts profile skills). The upsell promised "hit every missing
keyword" — G1's fabrication as a feature — and now says "from what you have actually done". Checked
end to end in a browser against the real result shape.

**Grain** (`0d67462`): measured before choosing — the old grain's luminance sd was 0.95 (flat).
A bench of six rendered side by side; 0.28 × 2 octaves with a white sheen layer (the contrast floor
caps the shadow, not the light). sd 3.6, darkest pixel still above `CANVAS_SHADE`, and the floor is
now a test (seen to fail at a stronger setting). ⚠ The first bench measured every cell as flat — the
bench was broken (a `url("…")` inside a double-quoted style attribute), not the grain. Screenshots
moved to `C:\Users\duggi\WebstormProjects\draft-screenshots\` — the owner could not find the scratchpad.

**Design** (`d1f50d5`): steps 3–6 in full — see `UI_REDESIGN.md`. One claim verified before being
written (a Draft costs nothing: AL2 defers generation to approval, except for a profile with
`generate_at_queue` on). One finding on the way: Android's right swipe queues NOTHING on any server
while its badge said "Queued for review" — the badge now says what is true (draft-android
`ce213f3`); 2c revised to the deck.

**Measured:** draft 2753/2753/0 run alone; client build OK; android compile + 55/55 JVM.


### 2026-09-30 · Three dead agents audited; UI 2b, Android 14 done; OAuth sign-in found broken in production

**The audit, before anything resumed.** The session limit killed "UI step 2b", "Rank the board by
fit" and "Fix Android open UI defects" mid-flight. What each left:

- **Fit ranking** had FINISHED — merged `28b8a33` (2738/2738) and recorded before the limit. Nothing
  to redo. `docs/UI_REDESIGN.md` was read first as asked: position encodes fit (OWNER 11), so ranking
  was the deck's hard dependency, and it is met.
- **UI 2b** (draft, uncommitted): the band layer was complete and consistent — `bandStyle.js`, the
  `BAND_*` tokens, six band surfaces, the re-pinned test; the only red was the ratchet asking for a
  LOWER budget. Its 22-file literal rewriter (`migrate2b.py`) was written and **never run**. Not
  half-applied.
- **Android 14** (draft-android, uncommitted): the 401 → sign-in route, coherent. Sign-out was
  already committed (`3d51f77`).
- **Queue 15** had been marked started: no worktree, no branch, nothing.
- ⚠ **The interference is explained:** the Android agent and the UI 2b agent shared ONE stub server
  on port 3001 (its log mixes the app's feed calls with the web client's `/api/apply/runs`). This
  session ran everything sequentially — one tree, one test run, one stub at a time — and saw no
  flakiness: the full suite twice, clean.

**Owner steps 1–5, answered.**
1. `[boot] registries: 148 role aliases, 28 qualification keys` — read by the agent from the deploy
   log. The `.dockerignore` concern is **closed, and moot rather than fixed**: `983a0ed` moved the
   registries out of `data/`, so neither `.dockerignore`'s `data/` rule nor the volume mounted on
   `/app/data` can hide them now; the boot line on `dad1114` is the proof. (A local read of
   `.dockerignore` this session was refused by the permission guard, so its current text is not
   re-quoted here.)
2. **`COOKIE_ENCRYPTION_KEY`, absent.** Readers: one — `server.js`'s `encryptCookies`, used to seal
   `user_integrations.secret_enc` (OAuth token sets on sign-in; session state posted to
   `/api/integrations/:provider`). Missing ⇒ a random key per boot, **no warning**. ⛔ **Nothing is
   stored unencrypted** — every writer seals with AES-256-GCM. What IS true: anything sealed died at
   the next restart, unnoticed, because **`decryptCookies` has no caller**. Setting it signs nobody
   out (it is not the session secret). ⛔ **And the finding under it:** `upsertAuthIntegration` called
   `saveIntegrationSecret`, which existed only inside `routes/account.js` — no binding in
   `server.js`. `findOrCreateOAuthUser` reaches it unconditionally, so **every Google, LinkedIn and
   GitHub sign-in throws a ReferenceError after the user row is written**, before the session exists.
   Tests matched source text and stayed green. Static finding — the users table was not readable
   this session — but the path has no branch around it. **Fixed in `ef6071f`**: `services/secretBox.js`
   owns key + box + helper, both modules import it, production refuses to boot without a valid
   64-hex key, dev gets a per-boot key and says so. 7 tests, seen to fail on HEAD. → OWNER 20, 7b.
   Also found: `ADMIN_PASSWORD` falls back to `changeme` at the first seed → OWNER 21a.
3. SSH key: the Railway CLI works (`npx @railway/cli`) — logs read. `railway ssh` to list the volume
   was refused by the session's permission guard, and not retried.
4. Phase A+B closed. 5. Noted.

**Owner decisions applied.** Login line: removed in `4e0f96d` (before the limit). The **sweep** was
not done then; done now (`b8882f8`): all tier copy was already gated on the lever EXCEPT
FeaturesPage's metered "1 free score / month…" lines (numbers kept — the server enforces them) and
JobsPanel's "one-time free enhancement". Also found: ApplyToolPage said resume generation needs no
account — false since the spend controls. Grain: untouched.

**UI 2b** — `2356153`. 549 literals by AST position (`@babel/parser`), the token chosen by the CSS
role, because dark → light inverts neutrals (dark-era `#fff` text on a button → paper-white, or ink
on the accent; `#0f0f0f` fill → paper). The interrupted run's regex rewriter was NOT used: its string
pattern spans apostrophes in JSX text, and it mapped `#fff` the same as background and as text. Two
old-yellow constants were fill AND text; each gained an `ACCENT_INK` twin. Every pair the migration
created was computed: all ≥ 4.5:1 but LinkedIn blue as text on the canvas (4.23) — used only as a
fill. Bands per the brief, with No-signal drawn as the absence of a grade. **G5**: "Score {n}" → band;
also "Best possible: {n}" and DatabasePanel's "ATS {n}" on a **fourth** copy of the v3 ≥80/≥60 ramp —
the test now catches the ramp in any paint. The public `/tools/ats` number stays (a Haiku score;
OWNER 22). Screens looked at: board (before: dark-grey cards, illegible chips), job detail, ATS
Strong/Weak/No-signal, auto-apply, admin, mobile. Pre-existing warnings noted, not caused: a
Rules-of-Hooks order warning on every signed-in route, a forwardRef warning in JobsPanel, a missing
key in ContactMessagesSection.

**Android 14** — `8445e88`, on the emulator. See the agent-queue row. The one to remember: the
section delete arm was **unreachable** — Material's swipe state keeps the first composition's
lambda, so a hidden row painted "Delete" and the gesture un-hid it. A control whose paint and action
disagree, found only by doing it on a device.

**Push:** there is now a reason — OWNER 7b, after OWNER 20.

**Measured:** draft 2745 / 2745 / 0 (run alone, twice); build OK; android 55/55 JVM, 15/15
instrumented. Nothing pushed.


### 2026-09-29 · The agent queue run to its end — 1, 3, 4, 5, 8(a) done; 6 in progress; 2, 7, 8(b) wait

The owner's instruction: run the queue without stopping; log anything needing a manual step or an
approval and move on. The previous session ran out of context mid-queue (after 4, during 5 and 6);
this one audited where it stopped and carried on. Nothing is pushed — see OWNER 7.

- **1 · B step 4 close-out — closed.** Its blocker (the owner's DNS edit) was withdrawn: Railway
  repointed the domain itself. Measured 09-29 over TLS, not from a dashboard: Let's Encrypt,
  CN=resumemaster.one, issued 09-28 17:19Z, expires 12-27; `/health` → `{"ok":true,
  "service":"resume-master"}` (a JSON key, not a 200). `verify:live` needs `RESUME_MASTER_TOKEN`,
  which the agent never holds — 09-28's 21/21 on the domain stands; a re-run is optional (OWNER 8).
  The Railway CLI is not on this shell's PATH, so `railway domain status` was not re-run.
- **3, 4** were already committed by the previous session (`f29f273`, `983a0ed`) and still listed
  as open — the reconciliation caught it.
- **5 · DONE reconciled** against all four repos' logs (by a sub-agent, read-only; merged here):
  15 corrected, 1 removed, 5 flagged, 46 added, every row now carries hashes. The ones that matter:
  - ⛔ **The iOS work is not on iOS `main`.** `aad5a3a` and the P3 rebrand sweep sit on the
    unmerged `feat/api-layer-feed-review-queue`; `main` is `f8be63c` (05-09). "The rebrand covered
    three repos" is only true on that branch → OWNER 10
  - A1's "⚠ Unpushed" was stale — `3c3fd1d` is deployed. B step 4's "certificate waits on the DNS
    edit" was never true. The CC "still true" row was outdated (`25c1be1`: rank keys apply, ~700
    rows tie). "79 files across three repos" is 84 by git
  - CURRENT STATE's Resume Master row contradicted itself ("still points at draft") — removed
  - Extension version history is non-monotonic: 1.2.0 (`4d12fb9`) → 1.3.0 listing (`67e61b1`) →
    back to 1.0.0 (`456dfa0`) before 1.1.0/1.1.1. Recorded, not changed
- **8(a) · backup policy fixed** (`3b9dbe9`) — budget from the volume, a disk ceiling that MIN_KEEP
  cannot override, room proven then made before the copy, the same rule for a restore's safety copy.
  Injected violations caught; 2702/2702.
  - ⛔ **Incident, my fault:** the first draft of its refusal test faked a full disk IN-PROCESS
    against the real `data/` and **permanently deleted two local backups** —
    `resume_master_2026-08-24T06-20-39-928Z_manual.db` and
    `resume_master_2026-09-17T06-00-01-052Z_auto-daily.db` (+ sidecars). Local dev only;
    production, the live local DB (127 MB) and the two untracked `pre-*` snapshots are untouched;
    no copy exists elsewhere. It exposed a real bug (prune, then refuse anyway, trusting manifest
    sizes), which is now pinned — and the test runs in a child process against a scratch
    `BACKUP_DATA_DIR`, so a test cannot reach `data/` again
- **8(b) · prune production — not done, needs approval** (OWNER 9): irreversible, needs an SSH key on
  the Railway account, and should follow the deploy so the new policy is what runs next.
- **2** stays deferred (owner, 09-28). **7** needs a Mac — skipped.
- **6 · Android sweep** — see the entry below when it lands.

### 2026-09-28 · B step 3 close-out + step 4 — the owner's generation, and the domain move

**The owner's web-route generation, read from both services' logs** (the production database is not
reachable without an SSH key): `/api/generate` → tools service in 28.6 s; claim guard inspected
5,678 chars; `usage_events` row written ($0.0635, 3,979 in / 3,798 out, cold 7,009 cache write);
lift **42 → 58**. Resume Master's metering line matches to the token. Step 3 is closed.

**The root URL, before the move — confirmed, not assumed:** a browser's own request (Chrome UA,
`Accept: text/html`) gets `404 application/json {"error":"not_found"}` at `/`, `/favicon.ico` and
`/robots.txt`. Intentional and contract-pinned; it only LOOKS like an error. See G7.

**Pre-check that changed the move:**
- draft's config referenced the old domain nowhere; but ⛔ **two privacy-policy sentences would have
  gone false the moment it moved** ("reachable at the former address… the same servers"; "sent to
  either address… both reach the same servers"). Rewritten and deployed in the same window (`a7a9c7f`)
  — verified by grepping the BUILT bundle, the page URL being a 2,029-byte shell.
- ⛔ **The repo contradicted itself about v1.0.0** — tests called it "published… on users' machines",
  the listing "never published". The owner: **published UNLISTED**. It posts to the former address, so
  its captures stop being received — accepted, and now said in the policy and the listing.

**The move:** `resumemaster.one` detached from draft and attached to Resume Master on port 8080.
Railway issued a new DNS target (`hhdv8gnd` replacing `b8h66npc`). ⭐ The domain served Resume Master
immediately — `verify:live --base https://resumemaster.one`: **21/21**, where this morning every check
failed there. ⛔ That is Railway's edge routing by hostname while the OLD A record still reaches it —
**not** the DNS being right. The certificate is `VALIDATING_OWNERSHIP` until the owner's name.com edit.

⛔ **CORRECTED 09-29 — two claims in this entry were wrong, the owner caught both:**
1. **There was no name.com edit to make.** `resumemaster.one` was bought through Railway; the
   name.com nameservers are Railway's registrar partner, the owner has no account there, and the
   records are not editable. Railway repointed the domain itself — it resolves to `69.46.46.41`, the
   new target's address. The agent read the nameservers and inferred an owner-held registrar account.
2. **The certificate was never stuck.** The same domain ID (`a2ac6249…`, the right one) read
   `VALIDATING_OWNERSHIP` ONE SECOND after creation; on 09-29 it reads **VALID, `DETAILED_COMPLETE`**.
   A snapshot taken at creation was reported as a state. Re-read before calling a thing pending.

**Root URL, rendered in real Chrome (headless, the owner's screenshot concern):** both
`resumemaster.one/` and the Railway URL show Chrome's JSON viewer with `{"error":"not_found"}` on a
404 — reads as an error, is the intentional contract answer; `/v1/version` on the same domain answers
200. Owner decision: **keep the JSON 404.**

**The "volume warning" — real, and not Resume Master's.** The project's only volume,
`resume-master-volume` (a pre-rebrand name), is **draft's** database volume at `/app/data`; Resume
Master has none, correctly. It was **481/500 MB**, and ⛔ **the 09-29 02:00 backup had already failed:**
`ENOSPC: no space left on device, copyfile … resume_master_2026-09-29T02-00-00-095Z_auto-daily.db`.
The cause is the policy, by construction: `BACKUP_MAX_BYTES` defaults to **512 MB — larger than the
whole volume** — backups share the volume with the live DB (~125 MB), a `BACKUP_MIN_KEEP` floor of 3
overrides the budget, and the job COPIES BEFORE IT PRUNES, so each night needs a full extra copy of
headroom first. No `SQLITE_FULL` in the 39 retained log lines, so writes had not yet failed. The
owner grew the volume to **1,000 MB** (481 used). File contents are unobserved — listing the volume
needs an SSH key on the Railway account.

**draft after:** `jobsviadraft.com` only; sign-in redirects to the `jobsviadraft.com` callback; the
capture endpoint answers JSON; 2691/2691.

### 2026-09-28 · B steps 1–3 — Resume Master live; draft calls it; the first real generations

**Step 1 — the service existed, and was half-configured.** The owner had created `resume-master` as a
service INSIDE draft's Railway project (kept there, owner's choice; an empty `vibrant-tenderness`
project also exists). It auto-deploys from GitHub. ⛔ "Tokens are live" held for draft only: the
client list `RESUME_MASTER_CLIENT_TOKENS` was on the **draft** service, and Resume Master had **no
model key** (it reads `ANTHROPIC_API_KEY`; draft's is `ANTHROPIC_KEY`). Fixed: the hash entry copied
across (format-checked; hashes only), and `ANTHROPIC_API_KEY = ${{draft.ANTHROPIC_KEY}}` as a Railway
reference (owner's choice) — no secret passed through the agent. ⚠ Agent slip: `railway domain` with
no arguments CREATES a domain; it generated the `*.up.railway.app` URL step 1 needed, unintended.

**Step 2 — verified by JSON key.** `/v1/version` → `service: "resume-master"` at the deployed
commit; JSON 404s; auth fails closed until the list is set, then `model=true clients=["draft"]` in the
boot log. `verify:live` via `railway run --service draft` (draft's real token, never seen): 21/21.

**Step 3 — draft pointed at it and pushed.** `RESUME_MASTER_URL` set with `--skip-deploys`, so draft
restarted once — on the push of A1…A4 (`e046b7c`). Boot: `tools service client: configured`. The
stray client list on draft is left (inert; `variable delete` cannot skip a redeploy).

**The first real generations this project has run end to end:**
- `verify:live --metered`: generation and A+ passed; **parse-pdf failed** — two findings:
  1. ⛔ **A request the provider REJECTED was reported retryable.** An invalid PDF → provider 400
     `invalid_request_error` → service `502 retryable:true`. Retrying an invalid document fails
     identically forever. Fixed in resume-master `fc5ed5c`: 400/401/403/404/413/422 are permanent
     (draft's `failureAttribution` set). No contract change.
  2. The fixture was a zero-page stub whose comment called it "well-formed" — green in every
     in-process test, rejected on first contact. Replaced with a real one-page PDF with a computed
     xref, read back by all four bundled `pdf.js` versions.
  → re-run after the fix: **24/24 conform against the live service**.
- **Through draft's own client on draft's production env** (synthetic candidate, JD asking 8+ years,
  profile 4): the claim guard passed a real document that claims no years figure and keeps the
  candidate's own level ("Backend Engineer", not the JD's "Senior…"). ⭐ **First cache READ ever on
  generation: 7,009 read, 0 written** — two requests inside five minutes, which confirms A2's finding
  that placement was right and arrival rate was the constraint.
- ⛔ **FABRICATION, the most important finding of B:** 2 of 2 real documents stated things the
  candidate never did — one listed Kafka from the JD; the other added two bullets describing
  responsibilities with no source ("Collaborated with risk and infrastructure teams…",
  "Instrumented service-level metrics…") and an unsourced skill. The prompt forbids exactly this
  ("Never fabricate … responsibilities"; "Generate bullets ONLY from the candidate's real
  experience"); the claim guard enforces years and seniority only, so both passed. Not a regression
  — the same prompt draft always used; the first time real output was read. The base résumé was
  deliberately thin, which may invite padding; 2 samples is a finding, not a rate. Resume Master's
  `docs/API.md` (`814356d`) now separates what is ENFORCED from what is only INSTRUCTED. Queued as
  agent task 2, ⛔ blocking AF5.
- ⚠ Also seen, unconfirmed: the role and education lines appeared twice in the extracted text —
  possibly an entry-header/entry-role render duplication, possibly the extraction; needs a render.

**Not verified:** the HTTP route, `usage_events` row and lift measurement on the new path need a
signed-in user (OWNER 1). The empty-vocabulary claim about production stays structural — and the
listing showed `/app/data` is a volume, which changes the mechanism (agent task 4).

### 2026-09-28 · A4 — draft calls the tools service (`8a3eb53` draft · `1fbb9bb` resume-master)

**What moved.** `coreGenerateResume`, `enhanceProfileResume`, `/api/parse-pdf` and
`/api/standalone/generate` now call `services/toolsService.js`; the request body is built by
`services/toolsServiceRequests.js` with the exact mapping the 324-case prompt-parity check used.
draft keeps its database work, scoring with its own weights, the lift measurement and notifications.

**Premises that did not hold:**
1. ⛔ **Not every résumé passed the claim guard.** `/api/standalone/generate` assembled its own prompt
   and called the model directly, with no guard and no deterministic render. AG3's test "every path
   funnels through `coreGenerateResume`" counted that function's callers and could not see it. Now
   routed through the service; the test asserts the cause instead — no prompt assembly or generation
   call left in draft.
2. ⛔ **The brief's "four-column join" is the PERMISSIONS table, but the cross-service flow has no
   permission** — résumé data reaches the service server-side. So the fifth column went on the
   data-flow join, where the flow is, plus its own row; the third-party table gained the recipient.
3. ⛔ **`menuSurfaceStyle`'s "real bullet" test was guarding dead code** — it counted `content: "•"` in
   `server.js`'s unused stylesheet copy and the formatting prompt, never the renderer, which uses
   `list-style: disc`. Rewritten against the renderer.
4. **"One logged path" (modelCallGuard) could not survive two services** — the service's calls are
   made elsewhere. Restated as one path per CALLER; the client may record calls it did not make and
   is asserted to make none itself.

**Decided and stated:**
- **Degradation:** generation / A+ fail fast, retryable, not queued (the apply pipeline already holds
  a failed generation for review). **PDF reading degrades** to local `pdf-parse` and says so
  (`source`, `degraded`, `degradedReason`). Board, scoring, capture, autofill never touch the service.
- **Non-retryable says so:** the four routes answered `500 {error: e.message}` for everything; now a
  real status and `retryable`. ⛔ And `failureAttribution` honours an explicit `permanent` — the
  service reports an exhausted balance as 502 permanent:true, and 502 is in TRANSIENT_HTTP.
- **Usage:** records land in `usage_events` under the same purpose/event_type, so limits and the cost
  panel are unchanged; the standalone surface keeps its own attribution.
- **Brand (vendor rule):** only the client, its mapping, the vendored contract, the policy's
  Third-Party section and the reconciliation name the product. `server.js` says `toolsService`. ⛔ The
  client's first draft leaked "Resume Master" and the env-var names into USER-FACING errors — caught
  by a test. A new guard pins the policy's literal to its Third-Party section.
- **Privacy:** the policy names the recipient ("processes, does not retain"), effective 09-28 — the
  first bump that ADDS a recipient; advance notice would apply from the first user on. Resume Master
  has `docs/PRIVACY.md`. **Web Store declaration re-checked: unchanged** — the extension's own flows
  did not move.

**Deleted from draft:** `services/promptAssembler.js`, `prompts/`, `buildRuntimeInputs`, the dead
`RESUME_STYLE_BLOCK` copy, and four live-generation harnesses that would now measure a prompt
production no longer runs.

**Tests — every failure given a verdict, nothing lost.** Moved to resume-master: 9 prompt tests +
the only-carrier rule from `summaryOptIn`, 2 from `resumeArtifacts`, the claims wording, the 1h-TTL
guard (the risk now spans the boundary: draft prices the service's cache writes). Rewritten for the
new wiring: withheld-never-persisted, claims reach the request, the lift row id, A+ untokenized, the
classifier count. Removed: one test of a deleted script. draft 2696 → **2691** by moving, not dropping.

⚠ **Incident:** a stray `sed -i` converted `server.js` to LF mid-work. Caught by the line-ending count
immediately, restored to CRLF (10,288 lines, 0 bare LF, byte-identity tests green) before anything
else ran. Afterwards `server.js` was touched only by the Edit tool and a byte-checked splice.
⚠ Also: scripts piped to `node -` through this shell's heredoc **lose backslashes** — two generated
test rewrites lost their regex escapes (one silently loosened a match). Found, fixed with the Edit
tool; moved tests were diffed against `HEAD` to confirm they were copied as data, intact.

**Verified:** draft 2691/2691, resume-master 195/195. Eight injected violations each caught. **A real
cross-service run** — draft's client against resume-master's real server, no fakes: the draft-built
body passes the service's validation; wrong token, invalid body and a non-PDF are refused before any
spend; no model key answers 503 `retryable:false` through every layer; unreachable is the only
retryable case; the service log held neither the token nor the résumé.
⛔ **NOT A RUN:** no generation has been exercised end to end — that is Phase B step 3, and it is also
the first real check of the funded balance.

### 2026-09-28 · A3 — the API contract (`a76074f`, `0b84a5d` resume-master)

**Generated, never hand-written.** `contract/resume-master-api.v1.json` (OpenAPI 3.1) and `.d.ts`
from `scripts/generateContract.mjs`; `CHECKSUMS.json` LF-normalised for a consumer's copy;
`VERSIONS.json` an append-only version → shape-hash ledger.

- **Derived by execution**, where there is one chokepoint — the mapJobRow approach: `AtsReport`
  (scoreAtsLocally, 9 variant scenarios), `UsageRecord`, `ClaimViolation`, `ClaimInspection`.
  Execution found what a hand-written schema would miss: a violation's `claimed`/`allowed` are
  **numbers** for years and **strings** for seniority. Generation refuses if a derived array's
  item type was never observed — the first run left **five ATS arrays untyped**; a scenario was
  added rather than a guess.
- ⛔ **Premise that differs from the mobile contract's, in this service's favour.** Mobile envelopes
  had to be declared and checked by an occasional script because building them meant booting a
  server with a database. Resume Master has none, so **the envelope harness boots the real app on
  every `npm test`**: 47 scenarios, every endpoint × every declared outcome; each real response
  checked for JSON, a declared status, and every key AND value type declared (real → declared,
  one direction on purpose). Fails if any declared (route, status) is exercised by nothing, or if
  the route table and the app disagree.
- ⛔ **"Eight fields arrive ABSENT, not null" was mapJobRow's defect, not a law.** Over 1,065 real
  ATS reports every top-level key is always present. Inference round-trips through JSON so an
  `undefined` field would be declared optional.
- **Version guard fired twice on real shape changes during the work** — a nullable enum JSON Schema
  would have rejected as null (and TypeScript had silently dropped `| null`), and an undeclared 413
  on `/v1/ats/score`. 1.0.0 had never been committed, so the ledger was reset; from `a76074f` on, the
  same change needs a bump.
- **Live verifier** (`npm run verify:live -- --base <url>`): 21/21 against a local boot of
  `server.js`; **every check fails against `resumemaster.one` today** (draft's SPA), where a 200
  would have passed. That is Phase B's "verify there".
- **Found by running the suite repeatedly:** `auth.test`'s tampered token was a no-op for the 1 in
  64 tokens ending in "A". Fixed; 0 failures in 300 runs.
- **Structural vs real:** model TEXT in-process is canned; the body SHAPES come from the real
  handlers. No metered scenario has been run live.
- 171/171 (fresh CRLF clone too). Seven injected violations each caught — an undeclared key, a type
  change, an HTML 404, a dropped scenario, a hand-edited contract, an undocumented route, and a new
  field in the scorer's report (caught through the derivation alone).
- ⚠ `.idea/` was swept into `a76074f` by `git add -A`; untracked and ignored in `0b84a5d`.

### 2026-09-28 · Worklog brought up to date (before A3)

Measured, not carried: production `/api/version` → commit `e2e732f`, contract 1.1.1, 116
migrations applied, latest 109 · both runners' high-water 109 (110 entries each) · draft suite
2696/2696/0 · Resume Master `main` = `1ad17a3`, 122/122.

⛔ **`resumemaster.one/v1/version` answers 200 — and is draft's 2,029-byte SPA shell** (`text/html`),
because the domain still points at draft. That would have been a sixth "confirmed deployment" from a
200. Phase B's verify step must assert `service: "resume-master"`.

**DOC DIRECTORY was wrong in four places** (corrected below): `ARCHITECTURE.md` and `HANDOFF.md` are
at the repo root, not in `docs/`; `PRIVACY_RECONCILIATION.md` is in `extension/submission/`;
`NEXT_WORK.md` was listed "retire it" but was **already deleted** in P5 (CORRECTIONS_REGISTER says
so); and ~80 docs in `docs/` were unlisted.

**The `.dockerignore` task was narrower than the defect** — rewritten as agent task 5.
`searchQueryBuilder.js` was suspected and checked: it reads only the re-included `ROLE_ALIAS_MAP`.

**Owner-reported, not measured:** Anthropic balance funded; v1.1.1 reuploaded. No real generation
has run since, so the balance is unverified until the first one.

### 2026-09-28 · Service token + extension v1.1.1

**Token (`1ad17a3`, resume-master).** Built on the `sessionLess` SHAPE — a bearer secret per
audience, revocable independently — but ⛔ **not its storage**: draft's tokens are rows in draft's
database, and Resume Master has none. So it stores only `sha256(token)` in env. Rejected before the
body is parsed; zero clients fails closed (503); a malformed list refuses to boot; rotation by two
overlapping hashes. Per-client metering line per model request, failed calls included; the limit hook
runs before spend and allows everything. 122/122, four injected violations each caught. A real boot
with a throwaway token: 401 without, 200 with, neither token nor hash in the log.

**Icons (`5e7f72e`, draft).** ⛔ The committed icons — so every icon in the v1.1.0 package in review —
were the old **"RM"** mark. Two uncommitted sets differed: the wordmark set's 16px was a bare slash;
the `/d` set was consistent. Shipped `/d`. The manifest had had **no top-level `icons` key since
c818b9c (05-08)** — added. v1.1.1 because the listing's own checklist says the store refuses an
upload at or below the version in review. `publishExtension --dry-run` preflight OK; suite 2696/0.

### 2026-09-27 · A2 complete (`5112249` resume-master · `083ad39` draft)

Resume Master built from the copied modules plus a re-written kernel, runtime inputs, model path and
HTTP layer — **no database, no content logged**, usage records returned for the caller to meter.
The integrity rules are contractual in its `docs/API.md`: the claim guard runs before return, a
violation withholds the document (422), it cannot be skipped, an unread document is refused.

- **Prompt unchanged:** runtime-inputs text byte-identical to draft's `buildRuntimeInputs` —
  executed from `server.js` — over **324 cases, 0 differ**; a draft-rendered golden fixture pins it.
- **CSS:** `FORMATTING_SYSTEM` is now built from `RESUME_STYLE_BLOCK`; a test fails if its source
  restates CSS.
- **Cache:** breakpoints kept exactly; a test pins that no per-request value reaches a cached block.
- ⛔ **Caught by reading, not memory:** the seniority vocabulary is `junior|mid|senior|executive`;
  written from memory as "lead", which would have changed the classifier prompt.
- **Structural vs real:** every model-backed test uses a fake client and says so. Real runs: the
  324-case parity, the deterministic routes, a boot asserting `/v1/version`'s JSON key and a JSON 404.
- 111/111 at A2, also on a fresh CRLF clone; each new guard seen to fail on an injected violation.
- BRAND.md: the carve-out premise was wrong — the second product is its own repository, which
  draft's guard never scans. Replaced with the vendor-naming RULE, to land with A4's client.

### 2026-09-27 · A1 — `@draft/ats-scorer` (`3c3fd1d`, `85570d4`)

- ✅ **ρ = 0.746, drift 0.000, at tolerance 0.005** against the extracted package. ⛔ The brief's
  premise that the tolerance had been tightened was wrong for THIS script: only `al3` and `an3` had
  been; `am1GradedCorpusVerify` was still 0.02. Tightened.
- **ρ is too coarse on its own:** 16 of 30 postings already differ from the grading key while ρ
  holds, and an EMPTY vocabulary *raises* ρ to 0.791. So A1 also required **1,065 full reports
  deep-equal** before/after (graded 30 ± synonyms, 5 thin-résumé, 1,000 board rows).
- **Seniority guard:** not in `atsBands.js` — it was already in the scorer, and is worth
  **0.645 → 0.746** re-measured (the 0.643 → 0.732 in three docs was stale; corrected). What did NOT
  separate cleanly was `resume_depth`: the scorer embedded band presentation in every report, so the
  package stopped emitting it and draft's wrapper attaches it.
- **The remaining silent fallback:** any wrong `termWeights` shape still resolved to "unweighted".
  Now a TypeError; `termWeightEnvelope.test`'s "malformed → null" assertion inverted, reason recorded.
- ⛔ **Production has scored against an EMPTY vocabulary since April** — `.dockerignore` excludes
  `data/`, and the loader's "deliberate" empty fallback blamed Railway. Structural finding.
- ⛔ `.gitignore`'s unanchored `data/` would have left the package's registries **out of the
  commit** with every local test green. Caught at staging; now guarded.
- Suite 2696/2696/0 on a fresh CRLF worktree.

### 2026-09-27 · A2 inventory (paused before writing)

**Three brief premises were wrong:**

1. ⛔ **The prompt cache is already placed correctly.** The three breakpoints sit on the static
   system layers with per-request material (JD, résumé, candidate details) in the user message
   after them — exactly what the API guidance prescribes. Three blocks is far inside the 20-block
   lookback and three breakpoints is within the limit of four. **"Written every time and read
   never" is what a CORRECT breakpoint does when no second request arrives within five minutes.**
   Nine `resume_generate` calls locally, 6,704 written, 0 read. Nothing to move; pre-warming waits
   for D1.
2. **The duplicated CSS has drifted into THREE copies, not one corrupt character.** The live
   renderer moved to a new design and no longer draws its own bullet — that fix already landed.
   An unused copy at `server.js:271` and the `FORMATTING_SYSTEM` prompt still carry the old design;
   only 35 of the renderer's 43 lines survive in the prompt. So the optional reformatting pass
   would tell the model to reformat toward a design the renderer abandoned. Behind
   `RESUME_MASTER_LLM_FORMAT=1`, zero `resume_format` events. Fix by building the prompt from the
   renderer's CSS.
3. **There is no server-side PDF to move.** `/api/export-pdf` returns 503 by design ("use
   client-side print"). The PDF is the renderer's print-ready HTML printed by the browser. The
   editor is draft's UI and stays; Resume Master serves the print-ready HTML.

**⛔ `coreGenerateResume` cannot move as one piece.** It mixes draft's database reads and writes,
notifications and weighted scoring with the stateless part — prompt assembly, the model call,
formatting, the claim guard. Only the stateless part crosses.

**Usage tracking:** Resume Master returns token counts per call and draft records them in
`usage_events`. Keeps Resume Master stateless and gives per-client accounting a home.

**Also found:** two `getDomainModuleKey` functions disagree · `prompts/layer2_domains/marketing.md`
is never used · `QUALIFICATION_ROLE_MAP.json` is excluded from the production image · the brand-guard
carve-out is unnecessary, since Resume Master is a separate repo draft's guard never scans.

---

## DECISIONS

Confirmed and applied. ⛔ Do not re-litigate; if one is wrong, measure and record the reversal.

| Date | Decision |
|---|---|
| 2026-10-01 | **The deck's card backs carry each company's own logo, blurred and tinted orange — shipped as is** (owner, OWNER 34). Fetched from DuckDuckGo's icon service like the board's logos; no logo → weave and mark only, never a letter |
| 2026-09-29 | **ATS scoring stays free and unlimited** (owner), over HTTP and MCP — it costs no model call, and the doc's framing holds: distribution, not revenue. Metering still RECORDS every call per client; it just never refuses one for ATS. Generation, when it ships as a tool, is a separate decision |
| 2026-09-29 | **A left swipe is a saved pass** (owner). Persisted as a dislike, so the card never returns — on any client. Right = draft (queue). ⛔ No gesture ever submits |
| 2026-09-29 | **Position encodes fit** (owner). The deck orders by fit, so the board ranks by fit: the ordering work scoped out of CC1–CC5 is now a hard dependency of UI step 3. A declined score ("Not enough signal") ranks as NOT ESTABLISHED — never as a low score |
| 09-29 | **Resume Master's root stays a JSON 404** — it is an API; no human-facing root |
| 09-29 | **draft's volume grown to 1,000 MB; pruning and the backup-policy fix run LAST** — storage is billed by use |
| 09-29 | **`resumemaster.one` DNS is Railway-managed** (bought through Railway) — no registrar account, no editable records; Railway repoints it when the domain moves between services |
| 09-28 | **The résumé guards (G1) are deferred to post-migration** — "a work in progress". Resume Master's `docs/API.md` states what is enforced and what is not in the meantime |
| 09-28 | **Resume Master stays in draft's Railway project**, as its own service; its model key is a reference to draft's (`${{draft.ANTHROPIC_KEY}}`) |
| 09-28 | **`resumemaster.one` belongs to Resume Master** (B step 4). Its root answers a JSON 404 by design. **v1.0.0 of the extension is published UNLISTED** and posts there — accepted: its captures are no longer received |
| 09-28 | **`marketing.md` deferred** — the pilot is gated to CS. Resume Master carries today's behaviour (no mapping selects it) |
| 09-28 | Extension icon is the **`/d` monogram** at every size; v1.1.1 |
| 09-27 | **Bands stay in draft, the score travels.** The score is a fact about a résumé and a JD; the band is a product decision. Cutpoints were calibrated on draft's board. ✅ **Checked in A1: the seniority guard was never in `atsBands.js`** — it is in the scorer and travels with it. `resume_depth` was the part that had to be lifted out |
| 09-27 | **Service token for draft → Resume Master**, on the existing `sessionLess` pattern. ⛔ Not a shared secret — draft holds a token exactly as any third party would, or the API is an internal call wearing HTTP. Per-client accounting built from the start, limits off |
| 09-27 | Commit trailers off in both repos |
| 09-26 | **AF5 runs LAST**, against the final path. Two-day build window kills the parallel argument |
| 09-26 | **Two unlinked products.** Separate users, databases, deployments. `resumemaster.one` is **never retired**; ⛔ **the 301 never happens** — a credentialed fetch returns an opaque response reading as an empty answer, forever |
| 09-26 | Resume Master is **stateless, no database** |
| 09-26 | The ATS scorer is an **npm package, not an HTTP call** |
| 09-25 | Brand is **draft**, lowercase wordmark. `com.draft.android` / `com.draft.ios` |
| 09-25 | Audience is **students and new grads**. ⛔ Blocked on ingestion — the board is 3.0% entry/intern |
| — | Enrichment stays on **Haiku**. Groq measured 30.5% Jaccard on `skills_json` |

---

## DOC DIRECTORY

✅ **Verified against the tree 2026-09-28.** Paths are from the repo root. Four entries were wrong
when this was written from memory — the root-level and extension paths below, and `NEXT_WORK.md`,
which P5 had already deleted.

**Live — read these**

| File | For |
|---|---|
| `docs/WORKLOG.md` | ⭐ this file. The only place work is tracked |
| `docs/PHASE_A_B_EXECUTION.md` | the current split. A1–A4 and B |
| `docs/ROADMAP.md` | sequencing across all phases and both products |
| `docs/PRODUCT_MODEL.md` | the reasoning behind the two-product split and the daily draft |
| `docs/BRAND.md` | naming, canonical host, permanent identifiers — and the vendor-naming rule for A4 |
| `ARCHITECTURE.md` | ⚠ **repo root**, not `docs/`. What the system actually does, measured |
| `HANDOFF.md` | ⚠ **repo root**. Orientation for a new session |
| `docs/CORRECTIONS_REGISTER.md` | ⭐ every wrong claim and what replaced it. **Read as method, not fact** |
| `docs/FINDINGS_ARCHIVE.md` | the defect shapes and their precedents |
| `docs/STUDENT_BOARD_FINDING.md` | why the audience pivot is blocked on ingestion |
| `extension/submission/PRIVACY_RECONCILIATION.md` | ⚠ **not in `docs/`**. ⛔ Enforced by a test; its third-party row is manually maintained and NOT covered |
| `extension/submission/STORE_LISTING.md` | the Web Store copy and the upload checklist — now v1.1.1 |
| `docs/am1-ats-graded-corpus.json` | ⛔ **irreplaceable** — the original postings were destroyed in the id-85 deletion |
| `../resume-master/docs/API.md` | Resume Master's API and its contractual promises |

**Reference — superseded but kept for reasoning** (all in `docs/`)

`MIGRATION_AND_REBRAND.md` (done; retirement steps struck) · `DOMAIN_MIGRATION.md` (superseded) ·
`AUDIT_AND_REPLAN.md` · `RECONCILE_AND_RESIDUAL.md` · `CURATION_CONSOLIDATION.md` ·
`P5_DOCUMENTATION_RESET.md` · `MOBILE_STATE.md` · `DETAIL_FETCH_ECONOMICS.md` (open; Phase 1 and 2
findings in `DETAIL_FETCH_PHASE1_FINDINGS.md` / `DETAIL_FETCH_PHASE2_VERIFY.md`) ·
`CORRUPTION_SWEEP.md` (desktop done, mobile pending) · `EXTENSION_DIAGNOSIS.md` (the extension's
history, §6.6 the deliberate-failure record)

**Task records, one per task — detail behind DONE entries** (all in `docs/`)

`CC1_BOARD_MEMBERSHIP` · `CC1B_ROLE_KEY_SOFT_NULL` · `CC2_SKILL_MATCHING` · `CC3_SYNONYMS_WIRED` ·
`CC4_CLAIMS_REACH_CURATION` · `CC5_PER_PROFILE_SCORES` · the `af*`, `ai*`, `aj*`, `ak*`, `al*`, `am*`
reports · `auto-apply-*` · `GATED_HANDOFF_*` · `ATS_TERM_WEIGHTS_SCHEDULE` · `MONETISATION_AUDIT` ·
`PIPELINE_DIAGNOSIS` · `ENRICHMENT_BACKLOG_2026-09-18` · `PART1_RECONCILED*` · `ROLE_MAP_BACKFILL` ·
`SOURCE_HEALTH_FALSE_CRITICAL` · `SWIPE_FEED_DESIGN` · `w1-ats-providers` · `x1-clearbit-dead` ·
`jobo-auto-apply-analysis` · `jobs-segregation-architecture` · `linkedin-extension-audit` ·
`mobile-linkedin-import` · `profile-isolation-note` · `privacy-policy.md`

**Prompt collections** — `EXECUTION_PROMPTS.md` · `QUEUED_PROMPTS.md` · `AUTOAPPLY_PROMPTS.md` ·
`GATED_HANDOFF_PROMPTS.md`. ⚠ Superseded as a queue by this file; not yet classified by a retirement
pass.

**Design documents — ⛔ NOTHING IN THESE IS BUILT.** Do not write any of them into
`ARCHITECTURE.md`, which documents what exists.

| File | For | Gated on |
|---|---|---|
| `UI_REDESIGN.md` | ⭐ The deck model replacing listings-into-cards, the cream/orange/glass palette, the transition inventory. Keyboard is acceleration, never the only path — mobile has none, and the gestures must mean the same things | Phase B. ⛔ **Its one blocking decision: does position encode fit?** If yes, the board's ordering problem becomes a hard dependency, and the board still ranks by `discovered_at DESC` |
| `POST_MIGRATION_DESIGN.md` | ⭐ MCP connectors (the **deterministic** tools — scoring, parsing, formatting; generation is the weakest candidate) and remote browser profiles for the gated tier | MCP: Phase B. ⛔ Profiles: AF5, proven full-auto, **and a security design as the first task** |
| `E3_SECURITY_DESIGN.md` | E3's security design, written 09-29 — **unreviewed**. ⛔ Corrects its parent: a streamed sign-in DOES pass the password through our servers; recommends device sign-in + session upload instead. Envelope encryption with a KEK outside the app env (not `COOKIE_ENCRYPTION_KEY`), crypto-shred revocation, the breach sentence, the 410 reversal recorded | Review = OWNER 12. Building: AF5 and the rest of §E3's prerequisites |
| `RECRUITER_LAYER.md` | ⭐ **The two-sided product** — reverse matching, **double opt-in**, blind-first candidates, caps on BOTH sides, and ⭐ **grade-the-employer's-posting**. Also the **KB expansion** and moving job profiles into account management. ⛔ The four mechanics are MECHANICS, not UI: a calm interface over a search box is still a job board | ⛔ Candidate supply, which does not exist. Zero users, `job_applications` empty — a two-sided product whose matching is unvalidated fails on both sides at once |
| `RECRUITER_LAYER_EXECUTION.md` | ⭐ The build document for the above, task by task with its constraints and verification. **All proposals accepted by the owner 09-30** | ⭐ **K1 and R1 block on NOTHING.** K1 attacks G1 (live fabrication); R1 needs no users at all. K2→K1, K3→a verification, R2–R6→candidate supply |

⚠ All five are experimental and may be reverted or absorbed. They are kept because the reasoning is
expensive to rebuild, not because any of them is committed.

⛔ **These two have been dropped from this table once already** — added 09-30, lost when the
directory was re-verified against the tree. If a design doc exists in `docs/` and is not listed
here, the table is wrong, not the doc.

**Directories** — `ai1-summary/` · `migration/` · `monetisation-lever/` · `privacy/` ·
`store-screenshots/`

---

## STANDING RULES

Prepend to every agent task.

```
Session-aware: read by SYMBOL, not line number. Regression-proof: dependents and children in the
SAME pass with verdicts. Migrations additive + dual-path, byte-identical in BOTH runners, and
transactional. Re-derive the test baseline first; introduced failures must be 0.

⛔ A 200 IS NOT EVIDENCE. The SPA catch-all answers 200 with index.html for any unknown path and has
produced a false finding FIVE times. Assert a specific JSON key.

⛔ A GUARD NEVER SEEN TO FAIL IS NOT EVIDENCE. Seven have shipped inert. Verify by INJECTING a
violation.

⛔ SCREENSHOT ANYTHING USER-VISIBLE. In one session four things were green and wrong: a policy a
single request falsifies, a harness scoring unweighted while labelling itself weighted, a guard
proving a sweep complete on the one component it could not see, and two tests REQUIRING the legacy
brand to stay.

⛔ NO sed -i, NO Python whole-file writes on server.js or scripts/migrations.js. The byte-identity
tests depend on line endings and the failure shows as CLEAN in git diff. Three incidents.

⛔ WHERE A PREMISE IS WRONG, SAY SO AND MEASURE. Three briefs in a row had their central premise
inverted by the first measurement, and each time that was the most valuable thing in the session.
```

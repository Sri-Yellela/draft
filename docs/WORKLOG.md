# WORKLOG — the single source of truth

**This file is the only place work is tracked.** Every other doc is reference material for a task
named here. If a task is not in this file, it is not being worked on.

**Last updated:** 2026-09-30

---

## How to use this file

**Owner:** read *NOW* and *OWNER QUEUE*. Everything you need to do is there, in order, with nothing
else mixed in.

**Agent:** read *NOW* and *AGENT QUEUE*. Run the top item. When finished, write a report into
*SESSION LOG* at the top, move the task into *DONE* with one line, and update *CURRENT STATE* with
measured figures. ⛔ Do not create a new session-report file — P5 established those fold in here.

**Assistant (chat):** read the newest *SESSION LOG* entry, update *CURRENT STATE*, move finished
items to *DONE*, add new work to the queues, and record confirmed decisions in *DECISIONS*.

**At handover:** delete *AGENT QUEUE*, *OWNER QUEUE* and *SESSION LOG*. What remains — current
state, decisions, done, and the doc directory — is the handover document.

---

## CURRENT STATE

⚠ **Every figure here is measured, never carried forward.** This project's planning docs have been
stale **eight times**, twice about their own headline. Re-derive before trusting.

| | |
|---|---|
| Production (draft) | `jobsviadraft.com` ONLY — **`9108a15`**, deployed 09-30 20:18Z on the owner's go (OWNER 7b), after the owner set `COOKIE_ENCRYPTION_KEY` (OWNER 20). Boot log, read by the agent: `[boot] secret key: configured` · `migrations complete (1 applied)` (110) · `registries: 148 role aliases, 28 qualification keys` · `[board-fit] … scored 2688, failed 0, 34.6 s, longest slice 59 ms`. Carries the OAuth sign-in fix (`ef6071f`), UI 2/2b, fit ranking, the copy sweep. ⚠ A completed Google sign-in is not yet observed (OWNER 25). `[oauth:linkedin]`/`[oauth:github]` still missing |
| Production (Resume Master) | **LIVE at `https://resumemaster.one`** (since B step 4, 09-28 — verifier 21/21 ON THE DOMAIN; certificate **VALID**, `DETAILED_COMPLETE`, re-read 09-29; DNS Railway-managed and already repointed — see the correction in the step-4 session entry) and `https://resume-master-production-d960.up.railway.app`, commit **`814356d`**, service `resume-master` in draft's Railway project `resume-master` (owner's choice: kept there). Boot log: `model=true clients=["draft"]`. Certificate re-read by the agent 09-29 over TLS: Let's Encrypt, CN=resumemaster.one, valid to 12-27 |
| Resume Master repo | `github.com/Sri-Yellela/resume-master`, `main` = **`6e1837d`** (E1, live 09-29 15:48Z), auto-deploys on push. **232 tests, 232 pass** at that commit; **235** locally after queues 21–22 (G3; G6 re-vendored — not pushed) |
| draft ↔ Resume Master | draft's `RESUME_MASTER_URL` → the Railway URL above; token set. ⭐ **First real generation, 09-28**: through the live service AND through draft's own client on draft's production env — both passed the claim guard; **first cache READ ever on generation** (7,009 read, 0 written) once two requests fell inside five minutes. ⚠ Not yet run through draft's HTTP route by a signed-in user (OWNER 2) |
| Resume Master contract | **v1.1.0** (E1, additive; live 09-29), generated; vendored in draft at 1.1.0 (`8472416`). **Live verifier: 24/24 conform against the deployed service, including the three metered scenarios** |
| Test baseline (draft) | **2831 / 2831 / 0** — measured 09-30 in the working tree after queue 24 (+10 R1). 2821 after queue 23 (+10 K1). 2811 after queue 22 (+6 G6). 2805 after queue 21 (+3 G3). Before that 2802, account management, run alone. Before that 2785 at `6c3b12b`, 2777 at `6788a8e`. ⚠ Not yet re-measured on a fresh CRLF worktree |
| Migration high-water | **113** defined (`113_account_management`, local); production applied **112** (`112_users_theme_preference`, 09-30) |
| Contract | v1.1.1 (mobile) · v1.0.0 (Resume Master, above) |
| Extension | **v1.1.1 reuploaded by the owner, 09-28** (built at `5e7f72e`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| draft volume | `resume-master-volume` (draft's DB, `/app/data`) — **481 / 1,000 MB** after the owner grew it 09-29. It was 481/500 and the 09-29 02:00 backup failed with ENOSPC. ⚠ The backup policy still allows ~640 MB steady; policy fixed locally in `3b9dbe9` (budget from the volume, refuse before the copy — NOT deployed); pruning is agent queue 8(b), waiting on OWNER 9 |
| ATS ρ | **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — VERIFIED 09-28** by real generation, A+ and PDF calls (Resume Master references draft's `ANTHROPIC_KEY`, owner's choice) |
| ⛔ Fabrication | **2 of 2 real generations contained material the candidate never stated** (a JD skill; two invented responsibility bullets and an unsourced skill). The claim guard enforces years and seniority only. Resume Master's `docs/API.md` now says so. ⛔ **Blocks AF5** — agent queue 2 |
| Users | **none** |
| draft volume backups | ✅ **Pruned 09-30 on the owner's approval: 4 backups, volume 124 / 879 MB** (was 392). ⛔ The retention bug that made the 09-17..09-29 hole is fixed in `b628ee6` — NOT yet deployed (the push was blocked by the session's permission guard; OWNER 7c) |
| Android (draft-android) | `main` = `14b18d4`, local. **58/58 JVM, 15/15 instrumented** on `rm_api36` (09-30). Today's draft on the shared deal; right = server Draft. Contract 1.2.0 vendored |
| `job_applications` | **empty** — nothing has ever validated the product against an employer |
| Board | ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

---

## NOW

**09-30 (fifth pass): account management is built and local — merge, sessions, picture, password, email, export, delete.**

- **Owner:** push draft `main` (`! git -C C:\Users\duggi\WebstormProjects\draft push origin main`) — carries
  the security foundations (`6c3b12b`) and account management (migration **113**). Then OWNER 27 (merge
  your two accounts from Account → *Merge another account*) and OWNER 28 (an email provider).
- **Agent:** after the push — read the boot log (113 applied), sign in, open `/app/account`. What else is
  left needs the owner (19 a–d, 10 iOS, 15 store, 16 c–e, 24 LinkedIn OAuth) or a Mac (7).

## OWNER QUEUE

| | Task | Why it is here |
|---|---|---|
| 1 | ~~At name.com, point `resumemaster.one` at the new target~~ ⛔ **WITHDRAWN — the agent was wrong.** The domain was bought THROUGH Railway; the name.com nameservers are Railway's registrar partner, the owner has no account there, and Railway exposes no editable records. Railway repointed it itself: 09-29 it resolves to `69.46.46.41`, the same address as the new target `hhdv8gnd.up.railway.app`. Nothing to do. (Original text kept below for the record:) change the apex record from `b8h66npc.up.railway.app` to **`hhdv8gnd.up.railway.app`** (ANAME/CNAME-flattened at `@`, as today). Then tell the agent, who checks `railway domain status a2ac6249-2c0d-4450-9352-ba915c6b9b41` for a VALID certificate | The certificate cannot issue or renew until this is done; today's working state is an edge-routing coincidence |
| 1b | ~~Generate ONE résumé in the app~~ ✅ done 09-28 — recorded end to end (see G2 answer) | Closes B step 3's last gap: the HTTP route, the `usage_events` row and the lift measurement have not run on the new path. ⚠ READ the result — see *Fabrication* in CURRENT STATE |
| 2 | ~~B step 4 go-ahead~~ ✅ given and done 09-28 — domain moved, except the DNS edit in row 1 | New certificate; a quiet hour. See NOW for the pre-check |
| 3 | At a quiet moment: delete the stray `RESUME_MASTER_CLIENT_TOKENS` from the **draft** service | Inert (draft never reads it), but Railway's `variable delete` cannot skip the redeploy, so it restarts production |
| 4 | ~~Replace the store icon in the dashboard~~ ✅ done by the owner, 09-28 | Uploaded separately from the zip — the package upload does not carry it |
| 5 | ~~B step 5: remove the stale `resumemaster.one` OAuth redirect URI~~ ✅ **done by the owner, 09-29. ⭐ PHASE A+B IS CLOSED** | — |
| 6 | **AF5 — 30 supervised applications** | ⭐ **UNBLOCKED by the owner, 09-30.** ⚠ Premise correction the owner should see: the Kafka document was NOT A+ — both fabrications came from `mode: "GENERATE"`, the standard Generate prompt (see G1). AF5 is supervised, so every generated document is read before it is sent; that reading is the control. Run ONE first and confirm `job_applications` gets a row with `ats_score_at_apply` populated |
| 7 | ~~Go-ahead to push draft `main`~~ ✅ given 09-29; `dad1114` live 14:30Z. ✅ The `[boot] registries:` line is read (148 / 28, non-zero) and the first 02:00 backup on the new policy succeeded — both by the agent, 09-30 | — |
| 7b | ~~Push draft `main`~~ ✅ **pushed on the owner's go 09-30** (`dad1114..9108a15`), after the key was set; live 20:18Z, `[boot] secret key: configured` | — |
| 7c | **Push draft `main`** — approved 09-30, then BLOCKED by the session's permission guard; the owner runs it: `! git -C C:\Users\duggi\WebstormProjects\draft push origin main`. Carries: `b628ee6` (⛔ retention — before 02:00), `fc668be` (public ATS on v4, bands, free/unlimited), `3f448e7` (crisp leather, the glass material, the board off its cream slab), `be26aa7` `4a139af` `9464bae` (the daily deal, `/api/draft/today`, contract 1.2.0, migration **111**), `be8833a` (Today's draft — the deck), `6788a8e` (dark mode), and docs | Push = auto-deploy. Then the agent reads the boot log (migration 111, the deck route) and checks Today in production |
| 8 | ~~Optional: re-run `verify:live` on the domain~~ ✅ **run by the owner with the token, 09-29** | — |
| 9 | ~~Approve the prune set~~ ✅ **approved by the owner and DONE 09-30 21:32Z**: dry run first (exactly 22 listed), then deleted over SSH — **276.2 MB freed, volume 392 → 124 MB**, manifest 26 → 4 entries. Kept: 09-30 auto-daily · 09-16 auto-daily · 09-09 pre-migration-102-103 · 08-22 manual. ⚠ Still suggested: `BACKUP_MAX_BYTES=125829120`, or the nightly job refills toward its 351 MB budget | — |
| 10 | Decide which iOS branch is canonical: `main` (`f8be63c`, 05-09) or `feat/api-layer-feed-review-queue` (`aad5a3a` + the P3 sweep) — and a Mac for agent queue 7 | The rebrand's "three repos" is only true on the branch |
| 11 | ~~UI redesign: does POSITION encode fit?~~ ✅ **Decided 09-29 by the owner: YES — rank the board by fit.** Ranking by fit is now a hard dependency of the deck (agent queue 13) | Unblocks UI step 3 once 13 lands |
| 12 | Review `docs/E3_SECURITY_DESIGN.md` — its §9 checklist. ⛔ It corrects the parent doc: a streamed sign-in passes the password through our workers, so it recommends device sign-in + session upload | Review is prerequisite 4; building stays behind AF5 regardless |
| 13 | ~~Check that `COOKIE_ENCRYPTION_KEY` is SET~~ ✅ **checked by the owner 09-29: ABSENT.** Answered by the agent 09-30 — see OWNER 20 and the session entry. ⛔ **Not a plaintext exposure:** nothing is stored unencrypted because of it. ⛔ **But two defects:** (1) the key was silently random per boot, so any secret sealed with it died at the next deploy — nothing noticed, because nothing ever decrypts (`decryptCookies` had no caller); (2) looking at who seals with it found that **every OAuth sign-in throws a ReferenceError** — `server.js` called `saveIntegrationSecret`, which existed only inside `routes/account.js`. Both fixed in `ef6071f` | — |
| 14 | ~~Android: what does a left swipe mean?~~ ✅ **Decided 09-29 by the owner: a SAVED pass** (a persisted dislike; the card never returns). Being wired in agent queue 14 | — |
| 15 | Android store readiness — no signing config, no Data Safety form, `versionCode 1`, launcher icon, and `com.draft.android` availability on Play unchecked; plus the admin flavour (hardcoded "Sri Yellela / Admin • Pro", literal dashboard counts) — ship it, hide it, or delete it? | Owner-only: the Play console, the keystore, and the product call |
| 16 | **E1 decisions** (resume-master `6e1837d`): ~~(a) push = deploy~~ ✅ pushed 09-29 on the owner's go and **LIVE 15:48:54Z** (GitHub status "Success - resumemaster.one"; `POST /mcp` 404 → 401 `{"error":"unauthenticated"}` unauthenticated and with a bogus token; `/health` ok); `verify:live` still needs your token (OWNER 8) · ~~(b) metering~~ ✅ **decided 09-29: ATS stays FREE and UNLIMITED** (distribution, not revenue) · (c) who gets `rmk_` tokens — a public free connector needs a token policy (no OAuth/anonymous today) · (d) the contract-hash gap: accept, or fix in a new version (changes the recorded 1.0.0 hash) · (e) build a local PDF extractor so parsing can ship deterministic? | Nothing deploys until (a) |
| 17 | ~~Paper-grain strength~~ ✅ **owner 09-30, second look: bench C, "crisp leather", and more gloss** — `3f448e7` (the floor token moved for it and every pair re-proved) | — |
| 18 | ~~Copy: the login page's "Upgrade from Plans…" line~~ ✅ **removed on the owner's call, 09-29** (`4e0f96d`, screenshotted) | — |
| 19 | **Fit-ranking calls** (`28b8a33`): (a) should a `skills_include` MISS still outrank fit? 4 of the 9 reachable graded-5 postings sit at 499–644 because of that key, not their score (e.g. "Full Stack Engineer, Link" scores Strong 54 and lands at 499) · (b) a pre-adoption score: base résumé or the unadopted enhanced draft? (the crawl scorer uses the draft; panel and precompute use the base) · (c) should the nightly term-weight refresh force a rescore? (weights are deliberately outside the hash) · (d) on deploy, the boot pass backfills automatically (~2.5 min per active profile at local speed; production has no users) — fine, or set `BOARD_FIT_PRECOMPUTE=off` and run it by hand? | (a) is the biggest remaining lever on where good jobs land |
| 20 | ~~Set `COOKIE_ENCRYPTION_KEY`~~ ✅ **set by the owner 09-30**; boot line `[boot] secret key: configured` | — |
| 21 | **Two production checks the agent was not permitted to make** (permission guard: production reads): (a) ⚠ `ADMIN_PASSWORD` — if it was unset when this database first booted, an `admin` account was seeded with the password **`changeme`** (`server.js` seeds it once, then never again). Try signing in as admin/changeme at `jobsviadraft.com`; if it works, change it at once. (b) Optional: whether `user_integrations` holds any rows (the OAuth fix says it could not have from a sign-in) | (a) is a security question with a one-minute answer |
| 22 | ~~The public `/tools/ats` donut~~ ✅ **owner 09-30: switch to the main scorer and bands** — done in `fc668be` (v4 scorer with the panel's weights and synonyms, band + evidence, no number) | — |
| 23 | ~~ATS free and unlimited on draft's public tool?~~ ✅ **owner 09-30: yes, for now (no monetisation yet)** — the rate limit is removed in `fc668be` | — |
| 24 | Android LinkedIn import (agent queue 15) needs **LinkedIn OAuth configured in production** — the boot log says `[oauth:linkedin] missing; missing client_id, client_secret, redirect_uri_or_app_base_url`. And note: LinkedIn's OIDC gives name, email and picture — the app's "import" can never be more than that | Blocks queue 15 |
| 25 | ~~One Google sign-in~~ ✅ **done 09-30**: works end to end (the integration row written, its token sealed by the key). ⚠ It created a NEW account (user 10) — OWNER 27 | — |
| 27 | **Two accounts: user 3 (yours, password) and user 10 (Google, empty) — MERGE them** (once the account-management push is live). Sign in to user 3 with the password → avatar menu → *Account & security* → *Merge another account into this one* → **Use Google** → pick the Google account. Review the preview (user 10 has no data), confirm. User 10 is deleted and its Google sign-in moves to user 3, so Google then signs you in to YOUR account. ⛔ Linking Google under Integrations would refuse — that Google identity already belongs to user 10; the refusal now points at Merge | The only route that moves an identity between accounts; nothing is lost from either |
| 28 | **Set `RESEND_API_KEY` on draft** (and `EMAIL_FROM`, a sender on a domain verified in Resend, e.g. `Draft <no-reply@jobsviadraft.com>`) | Without it **forgot-password and email change cannot work** — and now SAY so (503 `email_unconfigured`) instead of claiming an email was sent. Before `6c3b12b` production logged the reset link and its code to the server log. Setting a variable redeploys |
| 29 | ~~The audience decision~~ ✅ **DECIDED 09-30: SERVE BOTH, segmented.** Students and experienced candidates, one board, per-profile curation. ⛔ **This makes the ingestion work a REAL dependency, not an option** — the board is 3.0% entry/intern and the sources genuinely do not carry them (measured: the classifier is fine, one misclassification on the whole board; the discard path is fine, 12 of 1,089 dropped rows carry student vocabulary and the drop skews SENIOR). 80 postings shared across all users is not a product. **New agent work — see queue 25 and 26** | — |
| 30 | ~~AF5 vs K1 timing~~ ✅ **DECIDED 09-30: build K1, but keep it DECOUPLED from generation until both are tested individually.** K1 ships as a check that can be exercised on its own, not wired into the generation path. AF5 is not gated on it; supervision remains the control for now. ⛔ Wiring K1 into generation is a SEPARATE, later decision — see queue 23 | — |
| 31 | **Two ATS fixes that MOVE THE SCORE — ship them, and re-derive the bands?** Found in queue 22 (G6), measured, NOT shipped: (a) count a competency the résumé shows as a verb (*Collaborated* → collaboration) in the score, ρ 0.746 → **0.761**; (b) three dead entries in the competency registry ("cross" normalises to "cros", so cross-functional terms are filed as SKILLS), ρ → **0.755**. Both are already fixed in the REPORT where that was possible without moving a number | Both are n=30 improvements inside what the set can distinguish; the cost is that Strong ≥ 44 was calibrated on today's scores, so shipping either means re-deriving the cutpoints. Recommendation: (b) yes — it is a plain defect — with the cutpoints re-derived in the same change |
| 32 | **Student ingestion — which route?** (queue 25 measured it; nothing is built) (a) **add the top Greenhouse/Lever/Ashby boards** to `company_ats_list` — existing adapters, 1 request each, every student posting described; top 100 ≈ 855 roles, ~130 MB a crawl plus giants (SpaceX 30 MB, Anduril 42 MB); (b) **Workday** — 2,518 roles, the largest host, but whole-site paging (100–244 pages on the big tenants) and `workday.js`'s 300-posting cap must change first; (c) **the public curated index** as discovery (2 requests a day) — ⛔ no license declared on either repository | (a) is the cheap, proven start and needs only rows. ⛔ Not SmartRecruiters or Oracle (0% described). ⚠ The board's role-taxonomy refusal will drop design/data/ops internships exactly as it drops their senior equivalents — that is queue 26's question, not ingestion's |
| 26 | ~~Confirm the deck's four proposals~~ ✅ **confirmed by the owner 09-30** and built (`be26aa7`) | — |

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

| | Task | Status 09-29 | Blocked on |
|---|---|---|---|
| 1 | B step 4 close-out — VALID certificate + `verify:live` on the domain | ✅ **Closed.** The DNS edit it waited on never existed (OWNER 1, withdrawn). Re-read 09-29: `resumemaster.one` presents a Let's Encrypt cert, CN=resumemaster.one, 09-28 17:19Z → 12-27; `/health` = `{"ok":true,"service":"resume-master"}`. The 21/21 domain run is 09-28's; a re-run needs `RESUME_MASTER_TOKEN`, which the agent never holds by design — optional, OWNER 8 | — |
| 2 | Unsupported-content check for generation (G1) | ⏸ Deferred by the owner (09-28); AF5 unblocked by the owner 09-30 — supervision (reading every document) is the control. G1's prompt question answered: both fabrications were `GENERATE` | owner deferral |
| 3 | Delete draft's two dead `getDomainModuleKey` copies | ✅ `f29f273` (09-29). ⚠ local, unpushed | — |
| 4 | Static registries out of `data/` (was: `.dockerignore` excludes `data/`) | ✅ `983a0ed` (09-29) — the premise was one layer short: the VOLUME hides `/app/data`. ⚠ local, unpushed; ⛔ ATS scores move on deploy (per-family weights). Verify after deploy: `[boot] registries:` shows non-zero counts | deploy = OWNER 7 |
| 5 | Reconcile `DONE` against `git log` | ✅ 09-29 — DONE rewritten from all four repos' logs: 15 rows corrected, 1 removed, 5 flagged, 46 added. Findings outside DONE are in the session entry | — |
| 6 | Mobile corruption sweep (Android) | ✅ 09-29 — `cd814f1`..`af98492` in draft-android (7 commits, local). Report: `draft-android/docs/CORRUPTION_SWEEP_ANDROID.md`. Unit tests 40 → **49 / 0 fail**; the 13 instrumented tests not run (no device). ⭐ Worst find: every swiped card came BACK when the next page loaded. Also: the template picker selected nothing; the expanded card appended an invented "Requirements include strong Kotlin…" to every employer; SYNC.md's Android column rewritten to the truth (LinkedIn import and application tracking ✅ → ❌). Follow-ups → 14 | — |
| 7 | iOS Phase 1 audit | ⛔ **Needs a Mac** — skipped. ⚠ Reconciliation found the iOS work (`aad5a3a`, the P3 sweep) sits on the unmerged branch `feat/api-layer-feed-review-queue`; `main` is still `f8be63c` (05-09). The audit should start by deciding which branch it audits | Mac |
| 8 | Volume pruning + backup policy | (a) ✅ `3b9dbe9`, live. ⛔ **(c) `b628ee6` — retention skipped big recent backups to keep small old ones** (found listing the volume 09-30); local. (b) the manual prune: list made, OWNER 9 | OWNER 7c, 9 |
| 9 | **UI redesign, step 2** — tokens + paper substrate | ✅ `1fd46dc` `0b76191` `76cc044` (09-29, local). One token file (`client/src/styles/colorTokens.js`, published as `--c-*`, the `zLayers` pattern); a still SVG paper grain; the night-sky VIDEO background and the per-session random accent (and its picker) deleted. ⛔ The premise was bigger than a reskin — the old UI was fully DARK, so every text colour flipped. Literals 887 → 554 (22 budgeted files + 3 permanent exemptions), ratchet `colorLiteralGuard` seen to fail 3 ways. **44 contrast pairs pass AA** — ⛔ the logo orange is 2.96:1 on cream, so it is a FILL only; orange text uses `#A33200`; text on orange is ink, not white (3.47:1). Two more /pricing-shaped invisible buttons fixed. 2712/2712; 18 routes screenshotted at 1440/390, looked at (agent and me) | — |
| 9b | UI step 2b — **the signed-in app** | ✅ `2356153` (09-30, local) + copy sweep `b8882f8`. **549 literals → 0**, budget EMPTY, rewritten by AST position choosing the token by CSS role (the interrupted run's regex rewriter was not used). Bands on `BAND_*` tokens, all ≥ 4.5:1 as text; ⛔ **Not enough signal = no fill, no hue, dashed outline, "no judgement"** — not a paler Weak. ⭐ **G5 done: no ATS number shown** — the header's "Score {n}", "Best possible: {n}", and DatabasePanel's "ATS {n}" on a 4th copy of the v3 ramp. 21 signed-in scenes screenshotted at 1440/390 on stubbed `/api/*`, compared with the 09-29 before set. 2745/2745 | — |
| 10 | UI redesign, steps 3–6 | ✅ **BUILT 09-30** — the deal (`be26aa7`), the API + contract 1.2.0 (`4a139af` `9464bae`), the deck (`be8833a`), Android on the deck (draft-android `f7fdc2c`), dark mode (`6788a8e`). See `UI_REDESIGN.md` §Steps 3–6 status, with its three recorded deviations | OWNER 7c (deploy) |
| 11 | **E1 · MCP connectors** in Resume Master | ✅ `6e1837d` in resume-master (09-29, **local — RM auto-deploys on push**). `POST /mcp`, stateless Streamable HTTP, same token auth before the body is read (401 / 503 `auth_unconfigured`), metered per call with `via:"mcp"`. Tools: `score_ats_fit` (0 model calls; a decline is `outcome:"not_enough_signal"`, `score:null`, "NOT a low score") and `format_resume_print_html` (HTML, not PDF). Schemas GENERATED from the HTTP contract (`x-mcp`), drift-tested; contract **1.0.0 → 1.1.0**, additive. 197 → **232/232**, 22 injected violations caught. ⛔ Premise corrected: parsing has NO deterministic path (it is a Sonnet call) — left out. Generation deferred per the design. Found: the formatter reorders/renames sections and folds unknown headings into the previous one (described in the tool); the contract hash ignores every key named `description` (not fixed) | deploy = OWNER 16 |
| 16 | Re-vendor Resume Master contract 1.1.0 into draft | ✅ `8472416` (09-29, local) — 14/14 contract tests. Also: two root scanners (`modelCallGuard`, `dropImportExtensionTokens`) walked into agent worktrees under `.claude/` and reported the repo twice; both now skip it | — |
| 12 | E3 · Remote browser profiles — the **security design** only | ✅ written 09-29, `docs/E3_SECURITY_DESIGN.md`; nothing built. ⛔ Building waits on AF5, full-auto proven on the direct tier, the kill switch verified mid-batch, and the design reviewed | AF5 · OWNER 12 |
| 13 | ⭐ **Rank the board by fit** | ✅ merged `28b8a33` (09-29, local; commits `269e7e3` `0cfb427` `52b1261`). Migration **110** adds `basis_hash` to `ats_only_reports` (REUSED rather than a second score table — the card, panel and apply stamp already read it). ONE scoring definition (`atsBasisForProfile`/`scoreJobForBasis`); precompute incremental, chunked writes, explicit status per run, kill switch `BOARD_FIT_PRECOMPUTE=off`, admin `POST /api/admin/board-fit/precompute` (dry run by default). Default order = rank keys → band (Strong, Moderate, not established, Weak) → score → recency; a cursor spanning a score write is refused and restarts (a 681-row walk had returned 680). Measured on a local copy: graded-5 in the top 50 **2 → 3**; top 20 **20 unscored → 20 Strong**; fit-FIRST was worse (1). 2738/2738 | — |
| 14 | Android open defects from the sweep | ✅ `8445e88` + `b94a0e0` (09-30, draft-android, local), verified on the emulator: 401 → sign-in with a notice, credential cleared (relaunch lands on sign-in); **left swipe and X = saved pass** (PATCH `disliked:true` seen; Skip deleted); dead Filter button removed; failed Star → snackbar; section delete confirmed — ⛔ and found: the delete arm was UNREACHABLE (a stale swipe lambda painted "Delete" and un-hid); drag handle removed. 55/55 JVM, **15/15 instrumented**. Open: the optimistic "Saved to starred" badge shows before a failed write's snackbar; admin `AssistChip(onClick={})` left with 2b1 (OWNER 15) | — |
| 15 | Android: LinkedIn import — needs a mobile import endpoint in draft | ⏸ **Blocked, 09-30.** The interrupted run "started" it and left nothing (no worktree, no branch). ⛔ LinkedIn OAuth is not configured in production at all (OWNER 24), so an endpoint could not be exercised end to end — not built | OWNER 24 |
| 17 | Android's look onto the leather and glass, and dark there | ✅ draft-android `d2f0e3a` (09-30): the web's tokens, theme-aware at the source; the web's own leather tile; the glass card with blank slabs behind; the "/draft" mark on sign-in. Verified on the emulator, light and dark | — |
| 18 | The theme preference with the account | ✅ `c39dff7` (09-30): migration 112, `GET/PUT /api/settings/theme`; the account wins on a device and reloads only when the screen would change | — |
| 19 | The redesigned mark everywhere | ✅ `9feac48` (web: "/draft" expanded, "/d" condensed, favicons) · draft-android `ef2bae4` (launcher icon, every density) — from the owner's artwork, like for like with the extension | — |
| 20 | Account management — merge, sessions, picture, password, email, export, delete | ✅ local (09-30): `6c3b12b` (sessions sealed at rest, SameSite=Lax, cross-site writes refused, honest email) + the account-management commit (migration 113, `services/accountService.js`, `routes/accountManagement.js`, `/app/account`). ⚠ Not deployed; email-dependent parts wait on OWNER 28 |
| 21 | ⛔ **G3 — AG4's duplication defect is LIVE AGAIN** | ✅ **09-30, local** (Resume Master + draft's copy): the tests asserted narrower than the behaviour — renderer-vocabulary fixtures and an identical-lines-only detector; the model nests the role in the org and writes the date as a span, and **every date was being dropped**. Fixed in the classifier; 3 behaviour tests fail on the old code. ⚠ Not deployed. SESSION LOG (6). *Was:* ⏸ Never queued — recorded in OBSERVED IN PRODUCTION on 09-29 and no task was ever made.** A generated résumé states the role THREE times: the header line, an italic restatement, then the location alone. ⛔ AG4's tests PASS while this ships — *"a model's plain-text restatement of the header and bullets is read, not reprinted"* · *"a nested entry-header does not leak its date into the body"*. **Green tests, live defect.** ⚠ A2 rebuilt `FORMATTING_SYSTEM` from `RESUME_STYLE_BLOCK`, which fixed G4 — it did NOT fix this, which is in the renderer/output path. Start by establishing whether the tests assert something narrower than the behaviour, or whether the path moved under them | — |
| 22 | **G6 — the generic-language classifier has gaps** | ✅ **09-30, local** (package + Resume Master's vendored copy): not a threshold — a stated list missing 11 verbs, and "collaboration" a false NEGATIVE (the résumé says *Collaborated*). Fixed report-only; ρ 0.746 unchanged; cached reports re-keyed. Two score-moving fixes measured → OWNER 31. SESSION LOG (6). *Was:* ⏸ Never queued — same origin as 21.** The "Generic language" section correctly holds *Managed, Partnered, Coordinated, Grew*, but **"Defined" and "Created" surface as MISSING VERBS** and **"collaboration" as a MISSING COMPETENCY**. All three are claimable by almost any candidate, so showing them as gaps implies a deficiency that is not real. AH3 built this suppression and set the threshold; these sit the wrong side of it. ⚠ The corpus head is SOFT SKILLS, not technologies — *collaboration* appears 199 times — so the threshold is under-tuned, not absent | — |
| 23 | ⭐ **K1 — KB sanity check on generation** | ✅ **09-30, built DECOUPLED** — `scripts/k1KbSanityCheck.mjs --verify` passes both directions on the real KB: G1's invented Stripe teams flag, the owner's real résumé flags nothing. ⛔ KB-only fails both ways (G1 is company-PLAUSIBLE; absence flags true claims), so a finding needs a company-shaped claim AND an unsupporting source. Not wired. SESSION LOG (6). *Was:* ⏸ Queued 09-30, blocks on nothing. `RECRUITER_LAYER_EXECUTION.md` §K1. ⭐ **Attacks the live fabrication defect.** ⛔ **OWNER 30: BUILD IT DECOUPLED.** It ships as a check that can be run on its own — a script, a test harness, an admin route — and is **NOT wired into the generation path** until both it and generation have been tested individually. AF5 is not gated on it. ⛔ EXTEND the 9.6 failsafe; never build a second checker. ⛔ Acceptance is BOTH directions: the two G1 documents must flag, AND the owner's real résumé (Stripe, Bangalore) must flag NOTHING — the Bangalore precedent is a false "does not match" against a TRUE claim. ⛔ Say what it cannot catch; "Kafka" is not a company fact. ⛔ The KB learns from company-emitted data ONLY | — |
| 24 | ⭐ **R1 — grade the employer's posting** | ✅ **09-30, built + measured, no public route** — detection 17/17 visible on 20; it discriminates over 50 (peer percentiles sd 25–30), but specificity is coarse (engineering median 2 tools) and seniority incoherence never fires on this board. ⛔ The board's text is capped at 3k+2k chars — requirements are read on full text and compared with uncapped peers only. SESSION LOG (6). *Was:* ⏸ Queued 09-30, blocks on nothing. `RECRUITER_LAYER_EXECUTION.md` §R1. The existing extractor pointed at a JD. **Zero model calls** — that is what lets it be a free public tool, and the recruiter-side acquisition hook before the two-sided product exists. ⛔ COMPARATIVE, never absolute ("names 3 technologies; the median names 11") — the "58 beside Strong match" lesson. ⛔ Never a public league table of employers. ⚠ Measure the requirements-section detection rate on 20 postings FIRST, and verify it discriminates over 50 — the v3 engine's whole spread was sd 2.87 on a 0–100 scale | — |
| 25 | ⛔ **Ingestion for the student segment — MEASURE FIRST, build nothing** | ✅ **09-30, measured, nothing built** — 7,486 active student roles at ~2,200 companies (public curated lists); our 25 companies carry 48. Workday 34% · custom 28% · Greenhouse/Lever/Ashby 22% (1 request/board, 100% described). ⛔ Workday needs whole-site paging and `workday.js` caps at 300; SmartRecruiters 0/4 and Oracle 0/6 described. Route = OWNER 32. SESSION LOG (6). *Was:* ⏸ Queued 09-30 by OWNER 29 (**serve both, segmented**). The board is 3.0% entry/intern and the cause is **the configured companies do not post these roles here** — already proven, do not re-litigate it. **Establish, and report before changing anything:** where student and new-grad roles actually live (separate ATS tenants? seasonal windows? university boards? a different Greenhouse board per company?) · what a realistic volume looks like per source · what it would cost per crawl. ⚠ `DETAIL_FETCH_ECONOMICS.md`'s lesson applies: **a probe before a budget model** — workable's own comment claimed an N+1 was required and `?details=true` disproved it in five minutes. ⛔ Do NOT enable a source whose description coverage is 0% — Ubisoft, Bosch and Adobe were seeded inactive for exactly that, 648 rows that could never be enriched | — |
| 26 | **Segmented curation — both audiences on one board** | ⏸ Queued 09-30 by OWNER 29. Blocked on 25's measurement. ⛔ **The seniority guard becomes PROFILE-RELATIVE, not deleted.** It currently demotes intern postings and is worth **0.645 → 0.746** — a senior posting shown to a student needs demoting exactly as much as an intern posting shown to a senior engineer did, so it is needed in BOTH directions. ⛔ **`am1-ats-graded-corpus.json` is 30 SENIOR roles graded by an experienced engineer** — it stays (irreplaceable; the originals were destroyed in the id-85 deletion) but it does NOT validate a student segment. A second reference set is needed, graded blind by someone in that audience. ⚠ The résumé-side extractor is a hardcoded 32-item `SKILL_HINTS` list with no vocabulary for coursework, projects, clubs or teaching assistantships — that is the real gate on what segmented curation can achieve | queue 25 | — |

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

> ⚠ **INCOMPLETE — restored 09-30 by the agent after it truncated this file by mistake.** This section
> was uncommitted, written by another session; only the lines above were recoverable (from a `git
> diff | head -20` in the agent's transcript). The rest of the section — about 30 more lines — is lost.
> Regenerate it from `RECRUITER_LAYER_EXECUTION.md`.

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
| **OAuth** (owner action; no commit) | Google and LinkedIn redirect URIs moved; `APP_BASE_URL`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL` updated. ⚠ The stale `resumemaster.one` URI is still registered (OWNER 5) |
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

### 2026-09-30 (6) · Agent queue 21–26

Run in order, one at a time, one commit per row (per repo where a row touches two).

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

# WORKLOG — the single source of truth

**This file is the only place work is tracked.** Every other doc is reference material for a task
named here. If a task is not in this file, it is not being worked on.

**Last updated:** 2026-10-06 (session 33)

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

⛔ **NUMBERING (10-02, owner): the A## sequence belongs to the owner and the chat assistant.** An agent may mark an A row done, correct its facts or flag it wrong — it may NOT add A rows. ⭐ **Findings an agent raises are F##**, numbered independently (F1, F2, …). A51/A52 and A66–A70 both collided because agents extended the A sequence; F1 and F2 were first numbered A66 and A67.

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
| Production (draft) | ⭐ **10-06 (33): `1b6b31c` LIVE** — `/api/version` (started 07:00:47Z, `latestApplied: 129_application_snapshots`), `/api/health` 200. Local `main` = `37a46ff`, **3 code commits ahead (perf, A91, A92) + docs, NOT pushed**. Before: ⭐ **10-06 (32), read from git:** `origin/main` = `b093afa` (session 30 docs); local `main` = **`19f1e0c`, 8 commits ahead, NOT pushed** (A89·D44.1, D42, D41, D43, D40, D39, D38, D37) — ⛔ pushing deploys them, and with them migration 129 and a full re-tag (TAGGER_VERSION 2). ⚠ `/api/version` not read this session. Before: ⭐ **10-03 (23): `0e97dbe` LIVE** — `/api/version` (started 09:31Z; contract 1.5.0; 130 migrations, `latestApplied: 124_company_logos`), = `origin/main`, so session 22b is live. **`main` is 5 commits ahead, LOCAL** (D10 `654d4fd` · D11 `ff1c92c` · D12 `6e823dd` · D13 `0fe7226` · D14 `fd32c2b`) — ⛔ pushing deploys them (O55d). Before: ⭐ **10-03 (20b): `3141123` PUSHED on the owner's go and LIVE** — `/api/version` 02:14Z, `/api/health` ok (F3 in draft's formatter, F2). Before: ⭐ **10-03 (19c): `9dec15c` PUSHED on the owner's go and LIVE** — `/api/version` 01:24Z, `/api/health` ok; the live bundle carries no PDF-tools code (0 matches). Before: ⭐ **10-03 (19): `0e8bdd9` LIVE** — `/api/version` 00:20Z (session 18's six fixes + WORKLOG, contract 1.4.0, pushed by the owner). **`main` is 4 commits ahead, local** (A68–A70 rows, the F## rule, A69 ×2). Before: ⭐ **10-02 (18): `143569e` LIVE** — `/api/version` 20:52Z (started 19:50Z; contract 1.3.0; 128 applied, `latestApplied: 122_job_captures`). **`main` is 6 commits AHEAD of it, local** (session 18 — `git log origin/main..HEAD`); ⛔ pushing deploys them, and they carry contract **1.4.0** (additive). Before: ⭐ **10-02 (17d): `5dfe8c3` PUSHED on the owner's go and LIVE** (`/api/version` 19:14Z; A64). Before: **10-02 (17c): `db401d9` PUSHED on the owner's go and LIVE — `/api/version` 18:55Z (started 18:43Z, 128 applied, `latestApplied: 122_job_captures`), `/api/health` ok.** Before: **10-02 (17): `e9fd9c3` is LIVE — read from `/api/version` 18:23Z (started 17:15Z; 128 applied, `latestApplied: 122_job_captures`; `/api/health` ok; `/api/draft/slots`, `/api/apply/line`, `/api/applications/pending` → 401, `/api/admin/job-data/…` → 403, i.e. live and gated).** ⚠ **Not pushed by the agent:** `origin/main` moved to `e9fd9c3` during the session (A59, A63, A61, A62 + migrations 120–122) by someone else's push; the agent ran no push. `main` is now **8 commits ahead** of it (A52/A53/A50 follow-ups, the CORRECTIONS_REGISTER entry, this WORKLOG). Before that: **10-02 (16): pushed `main` with A49 + A50 + A52** — see NOW for the deployed commit as read from `/api/version`. Before that **`876da3d`** (`/api/version` 10-02 04:29Z start: contract 1.3.0, migration 115, 122 applied) — A51 and the session-15 docs WERE pushed (the 10-02 hand-off said they were not; `git ls-remote` and `/api/version` disagree with it). Older: `jobsviadraft.com` ONLY — **`d592603` pushed 10-01 on the owner's go** (queues 37–40, migration 114): bundle `index-Qj9zxpNC.js` carries the deck layout control and Collapse, `GET /api/settings/deck-geometry` → 401 (route live), `/api/health` ok; ⚠ boot log not read (`railway logs` returned nothing). Before that **`3af6c5e`**, pushed 10-01 (queues 27–31); the live bundle verified ~60 s later to carry the new login copy, the signup hook, the fan and the card-back filter, `/api/health` → `{"ok":true}`. ⚠ Boot log not read this session. Before that: **`9108a15`**, deployed 09-30 20:18Z on the owner's go (O7b), after the owner set `COOKIE_ENCRYPTION_KEY` (O20). Boot log, read by the agent: `[boot] secret key: configured` · `migrations complete (1 applied)` (110) · `registries: 148 role aliases, 28 qualification keys` · `[board-fit] … scored 2688, failed 0, 34.6 s, longest slice 59 ms`. Carries the OAuth sign-in fix (`ef6071f`), UI 2/2b, fit ranking, the copy sweep. ⚠ A completed Google sign-in is not yet observed (O25). `[oauth:linkedin]`/`[oauth:github]` still missing |
| Production (Resume Master) | ⭐ **10-03 (20b): `6d58ea7` PUSHED on the owner's go and LIVE** — `/v1/version` 02:14Z. Live end to end on production: PDF → Word (valid .docx), PDF → Excel (valid .xlsx, 3 columns), OCR (42 words, 96 %, a searchable PDF), Compress → Maximum (2.6 MB → 22 KB, warned); no page error, no third-party request, zero request bodies; the OCR files served with the wasm type and the 2.9 MB data. Before: ⭐ **10-03 (19c): `28818eb` PUSHED on the owner's go and LIVE** — `/v1/version` 01:24Z; the first build with pdf.js + @cantoo/pdf-lib succeeded. Live: look C with the Sky Blue accent, `/pdf/` + ten tool pages, sitemap, robots, the libraries served as JavaScript; `/v1/site/config` → `accounts: true`. Every tool re-run END TO END on the live `/pdf/merge-pdf/` (zero request bodies); the live free PDF → text read a PDF anonymously with `usage: []`. Before: ⭐ **10-03 (19b): still `6415646`** (`/v1/version` 00:56Z); **`main` is 5 ahead, local: A70 `114bfcd` · A69 `5626a89` `ce2ecf8` · the toolkit made Resume Master's own `c212a04` · look C + the PDF pages `21c8520`** — ⚠ the first deploy with pdfjs-dist/@cantoo/pdf-lib; Docker not run here (watch the build). Before: ⭐ **10-02 (18): `6415646` LIVE (A65) — `/v1/version` 20:52Z; `/v1/site/config` → `accounts: true`** — the store is on, so user data can now exist there; `passwordReset: false` (no Resend yet, O47). Before: ⭐ **10-02 (17d): `908c275` PUSHED and LIVE** (re-vendored scorer, A64; `/v1/version` 908c275, site 200). Before: **10-02 (17c): `3e3539f` PUSHED on the owner's go and LIVE** (GitHub status success; `/v1/version` commit `3e3539f`; `/` serves the site 200 HTML; anonymous `/v1/site/tools/ats` scores; the token API's 401 carries the new sentence; `/v1/site/config` → `accounts: false` until `RM_DB_PATH` — O47). ⛔ The first push, `40614e4`, FAILED to deploy (Railway kept `661b758` serving): `better-sqlite3` 12.11.1 has linux prebuilts for Node 22+ only and `node:20-bookworm-slim` cannot compile; fixed by `node:22-bookworm-slim` (`3e3539f`). Before: ⚠ **10-02 (17): `main` = `40614e4` LOCAL, 3 commits ahead of `origin/main` `661b758`** (A57 accounts/credits/storage, A54 the site, A55 legible errors + limits policy) — re-read 18:23Z: production root still answers 404 and `/health` ok. ⛔ Pushing RM `main` deploys it (O47). Before: **LIVE at `https://resumemaster.one`** (since B step 4, 09-28 — verifier 21/21 ON THE DOMAIN; certificate **VALID**, `DETAILED_COMPLETE`, re-read 09-29; DNS Railway-managed and already repointed — see the correction in the step-4 session entry) and `https://resume-master-production-d960.up.railway.app`, commit **`814356d`**, service `resume-master` in draft's Railway project `resume-master` (owner's choice: kept there). Boot log: `model=true clients=["draft"]`. Certificate re-read by the agent 09-29 over TLS: Let's Encrypt, CN=resumemaster.one, valid to 12-27 |
| Resume Master repo | **10-02 (18): `main` = `6415646` = `origin/main`** (re-read; nothing local). 260 / 260 / 0 per 17e (not re-run). Before: **10-02 (17): `main` = `40614e4`, 3 ahead of `origin/main` `661b758`; 250 / 250 / 0** (A57 +11, A54 +4, A55 +1). Before: `github.com/Sri-Yellela/resume-master`, `main` = **`661b758`** = `origin/main` (checked 10-01) — G3 `6ec0dd3` and the G6 re-vendor are PUSHED, so deployed (auto-deploy on push; ⚠ the deploy itself not observed). **235** tests per queues 21–22 (not re-run). Before that `6e1837d` (E1, live 09-29 15:48Z, 232/232) |
| draft ↔ Resume Master | draft's `RESUME_MASTER_URL` → the Railway URL above; token set. ⭐ **First real generation, 09-28**: through the live service AND through draft's own client on draft's production env — both passed the claim guard; **first cache READ ever on generation** (7,009 read, 0 written) once two requests fell inside five minutes. ⚠ Not yet run through draft's HTTP route by a signed-in user (O2) |
| Resume Master contract | **v1.1.0** (E1, additive; live 09-29), generated; vendored in draft at 1.1.0 (`8472416`). **Live verifier: 24/24 conform against the deployed service, including the three metered scenarios** |
| Test baseline (draft) | **3434 / 3434 / 0** — measured 10-06 (33) on local `main` `37a46ff` (+8: perf +4, A91 +3, A92 +1); the client builds. Before that **3426 / 3426 / 0** — measured 10-06 (32) on local `main` `19f1e0c` (+40 since 3386: A89/D44.1 +1, D42 +8, D41 +10, D43 +4, D40 +6, D39 +5, D38 +3, D37 +3); the client builds. Before that **3168 / 3168 / 0** — measured 10-03 (23) on `main` `fd32c2b` (+27: D10 5, D11 4, D12 5, D13 8, D14 5). Before that **3141** on `97747f1` (22b). Before that **3088 / 3088 / 0** — measured 10-03 (19b) on `main` `02bbca0`, after the PDF tools LEFT draft (owner: independent product; −17). Resume Master **292 / 292 / 0** on `21c8520`. Before that **3105 / 3105 / 0** — measured 10-03 (19) on `main` `9bb1d80` (+15 `packages/pdf-toolkit`, +2 `pdfToolkitA69`). Resume Master **285 / 285 / 0** on `5626a89` (+8 A70, +2 A69, +15 vendored toolkit). Before that **3088 / 3088 / 0** — measured 10-02 (18) on `main` `90f2360` (−2 tests that pinned only the deleted crawl, +3 `savedOutsideUs` +1, +3 `testSinkIsolation`, +1 A50 deploy card, +1 A33). ⚠ `npm test` now preloads `test-support/isolateTrackingSink.mjs`; a bare `node --test` fails `testSinkIsolation` on purpose. Before that **3081 / 3081 / 0** — measured 10-02 (17e) on `main` `234f89a`. Before that **3080 / 3080 / 0** — measured 10-02 (17d) on `main` `5dfe8c3` (+3 A64). Before that **3077 / 3077 / 0** — measured 10-02 (17b) on `main` `2217a89` (+1 P1, +4 A33). Before that **3072 / 3072 / 0** — measured 10-02 (17) on `main` `68beb18` (+16 A59, +12 A63 +1, +2 A61, +6 A62, +3 A52 follow-ups, +4 +1 A50 company list / tools service, +2 A50 trace; one red commit `d3c5333` fixed in `68beb18`). Before that **3025 / 3025 / 0** — measured 10-02 (16b) on `main` after merging A58 (+18) and A53 (+20). Before that **2987 / 2987 / 0** — measured 10-02 (16) on `main` after merging A49 (+30), A50 (+11), A52 (+10) and fixing the two known flakes at their cause (`888f84c`: `sealedSessionSweep` awaited sqlite's async close; `accountSecurity` matches `"user":42`, not a bare 42). Before that **2936 / 2936 / 0** — measured 10-02 after A51 (+7 `adminSafety`). Before that **2929 / 2929 / 0** — measured 10-02 on `main` after A40 + the A44 merge (A44's branch alone 2922 on a fresh CRLF worktree). Before that **2913 / 2913 / 0** — measured 10-01 after audit item 7 (+1 net: the promises test became two). ⚠ `sealedSessionSweep` can hit a Windows EPERM in its temp-dir cleanup (6/6 alone). Before that **2912 / 2912 / 0** on `main` after merging queues 37–40 (`eea1162`; +26 deck 38–40, +10 `usOnlyBoard`). queue-37 alone read 2886/2886/0 on a fresh CRLF worktree. ⚠ `accountSecurity` "a session is SEALED at rest" is flaky ~1.7% (random ciphertext can contain "42"; fix: match `"user":42`) — not fixed. Before that 2876 after the top bar + /features (+5 featuresPageHonest). 2871 after A31 (+7 landingFindFitApply). 2864 after A30 (+7 signupFirstImpression). 2857 after queues 27–29 (+15 deckFan, +9 viewTransitions). 2833 after the mark reached the text-wordmark surfaces. 2831 after A24 (+10 R1). 2821 after A23 (+10 K1). 2811 after A22 (+6 G6). 2805 after A21 (+3 G3). Before that 2802, account management, run alone. Before that 2785 at `6c3b12b`, 2777 at `6788a8e`. ⚠ Not yet re-measured on a fresh CRLF worktree |
| Migration high-water | **129** in source (`129_application_snapshots`, D43, 10-06 (32) — `job_applications` pay, `apply_run_jobs` posting snapshot), both runners byte-identical; ⚠ production not read (it applies on the push). Before: **122** in source AND production (`120_apply_run_line` A59 · `121_application_records` A63 · `122_job_captures` A62 — production `latestApplied: 122_job_captures`, `/api/version` 10-02 18:23Z). Before that **119** in source (`119_admin_audit_log`, A58, 16b; ⚠ production applies it on this push — read `/api/version`). Before that **118** in source (`116_dedup_retire_and_log` A49 · `118_ats_reports_job_hash` A52 · **117 unused**; 119 is on A58's unmerged branch). ⚠ Production: see NOW (`/api/version`). ⚠ 118 makes every stored ATS report stale once, so the first pass after deploy rescores each active profile (~95–135 s each locally); until then stored scores show "Check match" or no badge. Before that: **115** (`115_deactivate_skroutz_outside_us`, A44) — ✅ **production APPLIED, read 10-02 02:59Z from `/api/version`** (`latestApplied`, 122 migrations, commit `c9a6131`, contract 1.3.0). ⭐ `/api/version` answers what the boot log was needed for — read it first |
| Contract | mobile **1.4.0** in source (10-02, 18: `Job.heldOutsideUs`, additive), **1.3.0** in production until pushed. Before: mobile **1.3.0** in source (A40, additive), **1.2.0** in production and in draft-android until pushed / re-vendored · Resume Master 1.1.0 (above) |
| Extension | **10-03 (23): v1.2.0 BUILT locally (D13, the companion popup) — NOT uploaded** (`extension/submission/resume-master-extension-v1.2.0.zip`; v1.1.1's zip removed, the `5e7f72e` precedent) — O55c. No new permission, host or storage key. Before: **v1.1.1 reuploaded by the owner, 09-28** (built at `5e7f72e`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| draft volume | ✅ **10-02 (17d): renamed `draft-data`** (owner-reported; Resume Master has its own, `resume-master-data`). Was `resume-master-volume` (draft's DB, `/app/data`) — **481 / 1,000 MB** after the owner grew it 09-29. It was 481/500 and the 09-29 02:00 backup failed with ENOSPC. ⚠ The backup policy still allows ~640 MB steady; policy fixed in `3b9dbe9` (budget from the volume, refuse before the copy) — **deployed** (on `origin/main`, checked 10-01); pruning done 09-30 (O9) |
| ATS ρ | ⚠ **0.723 over the US-only graded postings (n=24, A37, local)** — 0.746 was over n=30 incl. 6 non-US/unparseable. Was: **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — VERIFIED 09-28** by real generation, A+ and PDF calls (Resume Master references draft's `ANTHROPIC_KEY`, owner's choice) |
| ⛔ Fabrication | **2 of 2 real generations contained material the candidate never stated** (a JD skill; two invented responsibility bullets and an unsourced skill). The claim guard enforces years and seniority only. Resume Master's `docs/API.md` now says so. ✅ **AF5 is UNBLOCKED** (owner 09-30 — supervision, every document read before it is sent, is the control) **but ⏸ HELD** (owner 10-01) until résumé generation and ATS scoring are each tested individually — and the ATS test waits on A48 ("not enough signal" 0.1% → 20.5%). G1 itself (A2) is deferred, not fixed |
| Users | **none** |
| draft volume backups | ✅ **Pruned 09-30 on the owner's approval: 4 backups, volume 124 / 879 MB** (was 392). ⛔ The retention bug that made the 09-17..09-29 hole is fixed in `b628ee6` — **deployed** (on `origin/main`, checked 10-01; O7c is closed by the later pushes) |
| Android (draft-android) | **10-02 (18): `main` = `c8aaea4`, 17 commits ahead of origin** (+1: a refused swipe takes its badge down); JVM **58 / 58 / 0** run fresh (JAVA_HOME = Android Studio's jbr). ⏸ The owner pushes it. Before: `main` = **`d2f0e3a`**, **16 commits ahead of origin** (re-read 10-02; `14b18d4` is an ancestor — the row had not followed A17/A19). Was: `main` = `14b18d4`, local. **58/58 JVM, 15/15 instrumented** on `rm_api36` (09-30). Today's draft on the shared deal; right = server Draft. Contract 1.2.0 vendored |
| `job_applications` | ⛔ **CORRECTED 10-06 (32) per D43: NOT empty** — O43's production read (10-06 (31)) found at least **4** rows, all orphaned from their postings. Whose they are and when they were written is NOT read (production reads were refused this session) — if they are early test applications they are not validation. ⭐ The proof that recording works is now a DELTA (O73): count before → one real application → count + 1, and the new row's `ats_score_at_apply` non-null. Was: **empty** — nothing has ever validated the product against an employer |
| Board | ⭐ **PRODUCTION 10-06 (31), measured in the container:** 1,917 active → retire pass removed 59 (3.1%) → **1,858 active, all US-admitted**; 98.0% enriched; entry+intern **3.4%** (63); direct-ATS sources only (greenhouse 1,142 · ashby 650 · lever 65 · workable 1). ⚠ **Local, A37: 2,616 active → 1,866 US (71.3%); 750 held out** (710 non-US · 12 unqualified "Remote" · 28 unparseable). NOT majority non-US locally — only lever is (69/130). Production not measured; the gate is local, and the retire script has not been run there. Local entry+intern over the US board **1.7%** (31/1866). Was: ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

---

## NOW

**10-06 (33):** session 32 **pushed on the owner's go and LIVE** (`1b6b31c`, migration 129 applied). Then, on the owner's ask: **the lag** — `GET /api/jobs/facets` took **9.7 s** (the location clause: 74 options × correlated EXISTS) and the client fetches it on every word press and search → **0.09–0.17 s**; search **~1 s → 0.25 s** (`62a89a9`). **A91** ✅ /d is ALL + one predicate (`28fc86b`). **A92** ✅ the browser pass, run in the app on a throwaway local server: D37 both themes × 4 widths ok, D38 ok, D39 ok after fixing a **lone panel sliding across** when the ATS card closed; stale "into ★ Saved" capture copy fixed (`37a46ff`). `npm test` **3434 / 3434 / 0**. ⏸ **Not pushed** — O77.

**10-06 (32):** the owner's D37–D44 batch, run one at a time in the owner's order (D42 → D41 → D43 → D44 → D40 → D39 → D38 → D37), no parallel agents. **All eight built, one commit each, LOCAL — NOT pushed** (`main` `19f1e0c`, 8 ahead of `origin/main`), `npm test` **3426 / 3426 / 0**, the client builds. ⛔ **Production reads were REFUSED by the permission layer this session**, so D41's lookup of the owner's capture by job_id, D43's orphan job_ids against cleanup_log 85, and D42's production recall are **not done** → **O76**. Two owner calls taken in-session: D42 "all" = engineering + data; domain (the job's work) and sector (the employer's) are separate tags, sector in the drawer, "+ add" into the panel. New: **A91** (/d's list onto the board query), **A92** (browser pass for D37/D38/D39). **Owner next: O76.**

**10-06 (31):** the owner's O-row run, on "all, no stops", with the Railway CLI now on this machine (`railway ssh`, never `railway run`, which would open the LOCAL DB). ✅ **O41** — 59 non-US rows retired on production (3.1%), coverage 98.0%, entry+intern 3.4% · ✅ **O43** — production has no aggregator rows; dedup exposure 0; 4+4 orphans → **A90** · ◐ **O51** (a)(b) · ◐ **O74** names set · ⏸ **O42, O71** — the agent's variable writes were refused by the permission layer; still the owner's · ✅ **A89 / O72(b)** — `PrivacyPage.jsx` five corrections + 6 pinning tests, **local, NOT pushed**, `npm test` **3386 / 3386 / 0**. ⏸ O72(a) waits on the owner.

**10-06 (30), cycle 3:** **🚀 LIVE 10-06 (30): `875b43b` (`/api/version`) — 3380 / 3380 / 0, client builds.** **A88** — the tools service's retryable 429 is transient again; `/api/generate` gates on the tools service, as a 503. Worktree removed safely. ⭐ **The agent queue is drained:** every remaining open row waits on the owner — A56 (O12), A60 (O45a), F1 (held for the owner's say), D36's attended applications (O73), and the owner rows O56–O74. No new rows since cycle 2.

**10-06 (29), cycle 2:** **A80** live (`699a30d` + resume-master `574de80`: V5/V6/V8–V12 closed; only V3 left, an owner call) · **A87** live (`814f182`: the Groq/Gemini stack deleted, Anthropic-only ratcheted) · **D36** live (`65a9838`: every apply path walked against the local fake ATS; the kill switch now stops a run in flight; FULL AUTO locked server-side; eligibility never guessed; ⛔ DONE waits on the owner's attended real applications, O73). D36 and A87 each died once at the session limit and were resumed from their worktrees (WIP backed up; D36's orphaned :3131 server stopped). Every merged worktree removed safely. draft **3366 / 3366 / 0**. **In build:** A88. Owner: **O71–O73**.

**10-05 (28), cycle 1 of the owner's "complete all the log items, then check for additions and repeat":** **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **A86** (D32 rebuilt to `pair2.html`) and **D16 + A76** (integrated on one branch; 125/126 ran after 128 — the runner applies by id) + O56(a) + A80 V4. Worktrees `draft-wt-a86`, `-integ`, `-d16`, `-a76` removed safely (main's package counts identical). Then **🚀 LIVE 10-05 (28): `77b1948` (`/api/version`), merged on the owner's "complete all the log items" — 3348 / 3348 / 0, client builds; mobile contract 2.2.0 (additive).** **D34 + D35** — the Full House header built to `header.html` (worktree `draft-wt-d35` removed). **In build:** A80 V3/V5/V6/V8–V12 (`a80-d17-remaining`) · **D36** (every apply path end to end — ⛔ the agent walks them against the local fake ATS; a REAL application under the owner's name stays the owner's, attended, O70g). Owner: **O69, O70**.

**10-05 (27):** 🚀 **D32 LIVE** (`47c0373`, contract 2.1.0) and **D33 LIVE** (`0f97ca3`, 20:32Z) — built in parallel in their own worktrees, each merged + pushed on the owner's "when green"; draft **3332 / 3332 / 0**, client builds. ⭐ D33 found the 502: Railway had no healthcheck. ⛔ **D33's acceptance is the owner's (O67)** — the capture SQL, one live capture, the v1.4.0 upload. **D34 + D35 wait on the sketch files (O68).** Twelve merged worktrees removed safely (each junction internal, deleted first; the main trees' package counts identical before/after); left: `draft-wt-a76`, `draft-wt-d16` (unmerged), `draft-wt-d32`, `draft-wt-d33`. Owner: **O66–O68**.

**10-05 (26b):** **🚀 LIVE 10-05 (26b): draft `6521afe` (`/api/version`, started 15:42Z) + resume-master `a4fef7b` (`/v1/version`, `scorer: @draft/ats-scorer@1.2.0`).** The experience re-tune merged and pushed on the owner's go (O61a ✅): draft **3291 / 3291 / 0**, client builds; resume-master **351 / 351 / 0**. resume-master finally deployed with it — A82 · A83 · A81 · A84 are LIVE there (O65 closed; the first push's deploy never ran, cause unseen). ⭐ **D32** (owner, added 10-04) is being built on branch `d32-ink-pair` (worktree `draft-wt-d32`); owner: merge + push when green.

**10-05 (26):** 🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65). Three lanes run IN PARALLEL on the owner's ask, each in its own worktree: **D27 → D29 → A85 → D30 + D26/D28's bar strip** (`d29-filter-tags`), **D31** (`d31-simple-ats-card`), **A82 · A83 · A81 · A84** (resume-master `a81-a83-rm` + draft `a81-scorer-text-facts`). The filters lane died once at the session limit mid-D30 and was resumed from its worktree (WIP backed up first; its orphaned :3031 server stopped). Merged on the owner's "merge and push when all three are green": draft **3284 / 3284 / 0**, client builds; resume-master **344 / 344 / 0**. Migration high-water **128** (`128_job_tags`; 125 D16 and 126 A76 still unmerged — they go BEFORE 128 in both runners). ⚠ A81 lowers the assistant-path ρ 0.637 → 0.592 — pushed on the owner's word; the experience re-tune is built on `exp-weight-retune` and waits for a merge go (O61a). Owner: **O60–O65**.

**10-03 (23):** ✅ **D10–D14 built, one at a time, in the main tree, all LOCAL** (`654d4fd` → `fd32c2b`; `npm test` **3168 / 3168 / 0**). **D10** the bar reads Daily Deck · Full House · Draft · The Table, no Job Profiles tab (page kept, route-only) · **D11** "Let's get to work.", `/d` Pending chip, IMPORT gone, 3 per row, 50 per page · **D12** `/extension` page, "+ Add jobs" where IMPORT was, a first-run prompt until the extension connects — ⛔ the store link is **null** until the owner gives the item id · **D13** the companion popup (concept C, chosen mid-session), extension **v1.2.0** built, not uploaded · **D14** Stopped | Queued at 75 / 25, stacked below 1080px. ⛔ **Push D11 and D12 together** — D11 alone removes the only import path. Owner: **O55**. ⚠ D15 and D16 were added to the D queue during the session — not started (outside "D10 through 14").

**10-03 (22b):** ✅ **D5** (`effef72`, Recruiter tab gone, route kept) and ✅ **D6** (`5dad7d0`/`97747f1`, the nav says **Draft** with the `/d` mark; android `195a10a`) built in parallel — D6 in its own worktree, merged clean; **D7 = D3, done**. ✅ **D4 addendum**: §3C rewritten (SerpApi only, a pool not a pairing, Adzuna retired); 20 searches measured 50 / 50 new slugs, mostly Ashby + Workday, 0 Greenhouse (`SERPAPI_SLUG_YIELD.md`). Owner: O52 (Adzuna licence), O53 (D5/D6 calls + pushes), O54 (build the harvester?). `npm test` **3141 / 3141 / 0**. Nothing pushed.

**10-03 (22):** ✅ **D3 designed** (`docs/BUG_REPORTING.md`; decisions → O50) and ✅ **D4 probed** (`docs/LIVE_SEARCH_FINDING.md`; ⛔ §3C does not work as written; production reads → O51), run in parallel on the owner's ask. Nothing built. Production re-read at write time: `/api/version` = **`131e721`, migrations 124** — i.e. session 21 is live.

**10-03 (21):** ⭐ **New owner batch A71–A79** (section "QUEUED — added by the OWNER, 2026-10-03", above STANDING RULES): A71 the ATS panel regression · A72 ranked local search · A73 filters · A74 jobs-page removals · A75 the ATS number + sort (display gated on A76) · A76 LLM-graded corpus · A77 logos · A78 company links · A79 cards in the draft look. Running in order, one at a time.

**10-03 (20):** The A/O queues hold nothing new and nothing agent-actionable (all owner-gated, as 17b lists). Done: **F3** (the formatter pooled every job's bullets when jobs had no blank line between them — Resume Master `6e430bb`, draft's copy `75f00b5`) · **F2** (`/api/jobs/poll`'s dead scrape state removed; its profile-facts log line made live — `77312df`) · ⭐ **A69 tier 2, on the owner's word that the "not offered" lines were draft's contract, not Resume Master's**: PDF → Word, PDF → Excel, OCR (with a searchable PDF) and Compress → Maximum, all in the browser, with pages (`6d58ea7`). ✅ **Pushed on the owner's go and LIVE (20b): Resume Master `6d58ea7`, draft `3141123`** — verified end to end on production. F1 stays held (a product call).

**10-03 (19c):** ✅ **Accent: Sky Blue `#A8D8EA` (owner).** ✅ **Both pushed on the owner's go and LIVE** — draft `9dec15c`, Resume Master `28818eb` (see CURRENT STATE). Nothing of 19 is local any more except this entry.

**10-03 (19b), the owner's answers — "go with C, I'll pick the accent, static sky"; "the pdf products are independent and are not designed for draft":** **A68 BUILT** — Resume Master in look C (the white boxed stamp, the glass bar and cards, Barlow Condensed + DM Sans + serif numerals, the old fonts self-hosted) over a STATIC generated sky; ⏸ **the accent is one variable — OWNER: pick Sky Blue `#A8D8EA` · Lemon `#F0EF8A` (set until you choose) · Celtic Green `#88C87A` · Sunset Orange `#FFB07A`** (one line in `public/site.css`). **A69** — the PDF tools are Resume Master's own product: its source now (`src/pdf-toolkit`), REMOVED from draft (`02bbca0`: `/tools/pdf`, the nav link, the package and its dependencies — draft is back to its pre-A69 bytes), and given product pages: `/pdf/` and a page per tool, sitemap, robots. Resume Master `main` is 5 ahead, draft 8 — ⛔ push both when ready.

**10-03 (19):** **A70 done** (Resume Master: PDF → text reads the PDF's own text layer — free, anonymous, no model, no credit; the token API's model path unchanged, O16e) · **A69 done** (`packages/pdf-toolkit` — ten PDF tools that run in the browser, the file never uploaded; draft `/tools/pdf`, Resume Master's PDF tab; one component, vendored) · **A68 at its checkpoint — ⏸ OWNER: choose the look** (see the A68 row: three eras rebuilt from history and shot; recommendation C; the night-sky video was a hotlinked third-party file and the accent was random per session — both need your call). The F## rule is in CLAUDE.md and this header; A66/A67 → F1/F2; **F3** new. ⛔ **Push both repos when ready** — Resume Master's first deploy with the PDF libraries. ⛔ Read SESSION LOG (19).

**10-02 (18):** Both 17e pushes confirmed LIVE (draft `143569e`; Resume Master `6415646`, `accounts: true`). Then the follow-ups the agent could do, each committed with tests and injected violations, **6 commits local** — **push draft `main` when ready** (contract 1.4.0, additive): the dead LinkedIn crawl deleted (A58 follow-up) · a saved capture held outside the US says so (A62 follow-up) · `npm test` stopped polluting the developer's tracking sink · admin looked at in a browser for the first time (A50/A61): two defects fixed · Pipeline Health's inactive rows labelled · A33's prefill looked at in a browser: the school/field defect fixed. draft-android +1 (A14's badge). ⭐ New rows **F1** (ATS-suggested skills have no writer) and **F2** (`/api/jobs/poll`'s dead scrape state) — first numbered A66/A67, renumbered under the F## rule. Everything else left is owner-gated, unchanged (see 17b below). ⛔ Read SESSION LOG (18).

**10-02 (17e):** **A65** done — Resume Master's store opens on its volume with draft's backup policy (one package), pins, a space guard; draft **3081**, Resume Master **260**. **10-02 (17d):** A64 done and live (draft `5dfe8c3`, Resume Master `908c275`); volumes now `draft-data` and `resume-master-data` (owner); **A65** queued — switch Resume Master's store on with the backup policy. **10-02 (session 17, end):** the whole "next session, in order" list is done except the two that wait on the owner (A60 ← O45a; A56 ← A36 ← O12). draft: **A59** line · **A63** Apply-in-the-name / Draft slots / Pending→verified→Submitted · **A61** enrichment button · **A62** one gateway for job data · **A53** follow-ups · **A52** open items · **A50** steps 4–7 — **3072 / 3072 / 0**. Resume Master: **A57** accounts + credits + opt-in storage · **A54** the site · **A55** outsider walk — **250 / 250 / 0**, local. ⚠ Production draft is `e9fd9c3` (pushed by someone else mid-session); 8 newer commits are local. ⛔ Read SESSION LOG (17) first.

- **Owner, new:** **O46** (Drafts now share the day's 10 slots — confirm the number) · **O47** (Resume Master: push, and a volume + `RM_DB_PATH` before accounts can exist) · push draft `main` (8 local commits) · O16c is now THE blocker for A55 (API token policy).
- **Agent, done after that (17b):** **K2** measured and NOT shipped (no variant beats ρ 0.746 beyond noise; larger credits hurt) · **P1** re-extraction warns and says what it replaced · **A33** résumé → profile prefill, confirmed, never eligibility. **K3 held** (see its row) · new **A64** (the company-authenticity registry looks wrong for Stripe). Everything else left is owner-gated: A60 (O45a), A56/A36 (O12), A55's token policy (O16c), A43 (ten hand-found URLs), A45 (O43), A41/A42 (email), A35 (store resubmission), A47/AF5, A2 (deferred), A7 (Mac), A15 (O24), A26 (O32/O33), R2+ (AF5 + real users).

**10-02 (session 16, end):** `main` carries **A49** (dedup fixes 1–5, migration 116), **A50** (admin: wrong numbers,
Operations tab, the daily glance) and **A52** (stored ATS score tied to the posting, migration 118; ONE report
component) — **2987 / 2987 / 0** — pushed on the owner's go ("push when merged and green"). ✅ **LIVE: `/api/version` 13:41Z reads commit `e66cdf4`, `latestApplied: 118_ats_reports_job_hash` (124 applied), contract 1.3.0; `/api/health` ok.** The first board pass rescores every active profile once (118).
⛔ `docs/business/` and `COMPANY_AND_MONETISATION.md` stay out of the repo. The repo is **private** (API 404, re-checked 10-02).

- **Owner:** O43 (A49's production re-measure — SQL in SESSION LOG (16)) · O45(a) (the five unenforced limit fields — table in the row) · push draft-android · ✅ O44 and the rest of O45 decided 10-02 → A59–A63 · O19b (base résumé for the crawl scorer — now the ONLY remaining stored/fresh split) · O42 · O41 · O35 · AF5 (held).
- ⭐ **10-02 (16b), on the owner's "push everything to main": A58 and A53 MERGED and PUSHED** — `main` **3025 / 3025 / 0**, client build clean; migration **119** (`admin_audit_log`). Three failures from merging them together were fixed (`b86b057`): A58's admin-inspector fixture predated 119, PRIVACY_RECONCILIATION's Apify row cited the removed force-scrape, and new tests used bare `indexOf` anchors. ⚠ **A53 ships O44's issue to the board** — a second Draft while a run is active is 429; decide O44.
- **Agent, next session, in order:** ⭐ **A59** (Draft waits in line — the board hits the 429 since A53) · **A63** (Apply in the company link; Generate costs a Draft; Pending → verified → Submitted) · **A61** (enrichment button) · **A62** (job data in/out + captures through the one gateway) · A60 after the owner's O45(a) · then **A54–A57** (Resume Master site, tools end to end, VM interface, RM accounts/credits) · A53 follow-ups (SESSION LOG (16) § A53: DM Sans vs Inter, the FAQ's "queue", Database's dead Pass handler, ~48 after-shots not looked at) · A52 open items · A50's remaining order. ⛔ Read SESSION LOG (16) first.
- **Only on this machine (re-audited 16b):** `main` = `origin/main`. **draft-android** `main` = `d2f0e3a`, 16 commits ahead of origin — ⏸ **the owner will push it (10-02)**; re-read before assuming. Worktrees REMOVED 10-02 (16b, owner's ask): A52, A49, A53, A50/A58 and the scratchpad `crlf-wt`, plus four empty May folders. Also `agent-a21c56c27de28ffd1` (09-29), deleted once the owner had WebStorm's Tailwind `oxide-helper` stopped (it held a `.node` file open). **`.claude/worktrees` is now empty; `git worktree list` shows only `main`.** ⛔ **Near-miss, repaired:** `crlf-wt`'s `node_modules` and `client/node_modules` were THEMSELVES junctions into the main tree; the per-package check walked through them, so removing it deleted 14 main client packages and the main `@draft/ats-scorer` link. Restored with `npm install` (root + client, lockfiles unchanged), `npm ls` clean, **3025 / 3025 / 0**, build clean. Check the node_modules DIRECTORY itself for a reparse point before removing any worktree. Untracked on purpose: `Agent report.txt`, `extension/icons/draft logo*.jpg`, draft-ios `.idea/`.

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
| O41 | ✅ **ALL THREE DONE 10-06 (31) by the agent, on the owner's "all, no stops"** — the Railway CLI is now installed and logged in here. ⛔ **Use `railway ssh -s draft -- "<cmd>"`, NOT `railway run`**: `run` executes on THIS machine with production's variables, so a script would open the LOCAL `data/resume_master.db`. (a) dry run `active 1917 · would retire 59 (3.1%)` (non_us_location 33 · location_unparseable 15 · remote_region_unstated 11; greenhouse 57 · workable 1 · recruitee 1) → **`--apply`: retired 59** (`is_active = 0` + `rejected_jobs`, reversible). (b) **coverage 1,821 / 1,858 active enriched (98.0%)**. (c) **entry + intern 63 / 1,858 = 3.4%** (entry 44 · intern 19; mid 777 · senior 700 · lead 292 · executive 26) — after the retire every active row is US-admitted. Was: **Three PRODUCTION reads/writes the agent cannot reach (no Railway CLI on this machine — `railway` not installed, `railway logs` silently empty):** (a) O38b's retire script, dry run first: `railway run --service draft node scripts/q37RetireOutOfMarket.mjs` then `--apply` (b) enrichment coverage: `SELECT COUNT(*), SUM(enriched_at IS NOT NULL) FROM scraped_jobs WHERE is_active=1` (c) O38d's entry/intern share on the US board. Or install the CLI (`npm i -g @railway/cli`, `railway login`, `railway link`) and the agent runs them | A48: coverage sets the board's decline rate; the non-US gate is live, the retire pass is not |
| O42 | ⏸ **STILL THE OWNER'S — 10-06 (31): the agent's Railway variable writes were refused by the session's permission layer** (not worked around). Read 10-06: the variable is **not set**; `JOBO_API_KEY` is; production holds **0 jobo rows**, and the aggregator's boot line lists active sources without jobo. **Set `PIPELINE_PAUSED_SOURCES=jobo` on the draft service on the draft service** (owner's call 10-02; Railway → Variables, or the CLI per O41). ⚠ Takes effect only once A44's code is deployed; setting a variable redeploys | Clears jobo's permanent CRITICAL (402, wallet exhausted — paused deliberately). ✅ Also decided 10-02: **keep Hygraph** (alive, empty) · **deactivate Skroutz** (Greece only) — migration 115, on A44's branch |
| O43 | ✅ **DONE 10-06 (31) by the agent, read-only, in the container.** `latestApplied: 126_ats_grade_corpus` (past 118). Production holds **only direct-ATS rows** — ashby 650 / greenhouse 1,142 / lever 65 / workable 1 active; **no adzuna, serpapi, jobo, LinkedIn or import rows at all**. So: #1 cross-namespace pairs **0** · #4 stranded user state **0** · #3 write-back gaps **none (no such rows)** · retired duplicates **0**, `job_dedup_log` **0** · `cleanup_log` last 10 runs deleted **0**. ⚠ **Orphans: 4 `user_jobs` and 4 `job_applications` point at a `job_id` no longer in `scraped_jobs`** → A90. `a49FingerprintMeasure` on a `/tmp` backup copy (deleted after): 1,858 active, **7 fingerprint groups, 0 merges / 0 retirements on replay, 0 multi-city collapses**; simulated echoes merged 99.2% ("City, ST" / "City, State") and 99.8% (", Inc." / " - Remote"), **0 into a different city**. ⭐ A45 is unblocked as far as this measure goes — but production has no aggregator rows to harvest from. Was: **A49's production re-measure** (aggregator rows exist only in production; O41 — no CLI here). After deploy, `/api/version` should read `latestApplied: 118_ats_reports_job_hash`; then run the queries in SESSION LOG (16) § A49 and `node scripts/a49FingerprintMeasure.mjs <copy of the production DB>` (read-only) | Gates A45 (slug harvesting). A43 is unblocked by the deploy alone |
| O44 | ✅ **DONE 10-02 (17) — A59, live in `e9fd9c3`.** ✅ **DECIDED 10-02 (owner): a Draft WAITS IN LINE** behind the active run — and every waiting Draft is **viewable and editable before it begins**. → **A59**. Was: one active apply run per user (`APPLY_MAX_ACTIVE_RUNS_PER_USER=1`), so a second Draft was refused 429 `run_already_active` — on the deck, and since A53 on the board; a run left "running" by a restart is never reset | — |
| O45 | ✅ **DECIDED 10-02 (owner), except (a), which the owner will look at:** (b) **yes — an enrichment button in the admin panel** → A61 · (c) **yes, keep the board's tools, but reshaped** → A63 · and a related plan restated → A62. **(a) THE LIMITS MODAL, field by field** (`user_limits`, `services/limitEnforcer.js`; `checkLimit` is called ONLY for `resume_generate`, at `server.js` ~9851 and ~10021): **enforced (3):** `daily_resumes`, `monthly_resumes`, `monthly_token_budget` · **stored, never enforced (5):** `monthly_ats_scores` (ATS is free and unlimited by decision — O23 — so this one should probably go) · `monthly_job_scrapes` and `daily_job_scrapes` (users have not scraped since the pivot; the only Apify path was removed in A58 — dead) · `monthly_pdf_exports` (PDF export is a Resume Master call — enforce, or leave to A57's credit ledger) · `monthly_apply_runs` (apply runs are real browser work — the one worth enforcing, alongside A59's queue). Also stored: `warning_threshold` (0.8), `notes`. ⛔ A modal offering a limit that does nothing is the wrong-number class (A50) — each field is either enforced or removed | Owner: decide (a) per field |
| O46 | **A63 made Drafts share the day's 10 slots with new résumés — confirm the number** (`DAILY_DRAFT_SLOTS`, default `DECK_SIZE` = 10, trailing 24 h). Consequence to see: a user can now make at most 10 Drafts + generations per 24 h, which sits BELOW `APPLY_DAILY_QUEUE_CAP` (40) and `APPLY_DAILY_CAP` (25) — so those two caps are no longer reachable by Drafts (approvals and answers-retries are exempt from slots). Keep 10, or raise `DAILY_DRAFT_SLOTS`? Decide with O45(a)'s `monthly_apply_runs` | Owner: the number |
| O47 | ✅ **Pushed and live 10-02 (17c), `3e3539f` (Node 22).** ⏸ **Still yours:** the volume + `RM_DB_PATH` (accounts are off until then), `RM_ADMIN_EMAILS`, Resend for resets. Was: **Resume Master: three commits wait to deploy (A57 accounts/credits/storage, A54 the site, A55)** — pushing RM `main` deploys. ⚠ The site's account routes stay off (503 `accounts_unconfigured`) until you **attach a Railway volume to the resume-master service and set `RM_DB_PATH`** to a file on it; also `RM_ADMIN_EMAILS` (who may grant/refund credits) and, for password reset, `RESEND_API_KEY` + `EMAIL_FROM`. The free ATS check and formatting work without any of it. ⚠ First deploy with a native dependency (`better-sqlite3`, prebuilt for linux/node 20) — watch the build. Optional: `RM_LIMITS_PER_DAY` turns per-client limits on (A55) | Owner: push; volume + variables |
| O48 | ⛔ **URGENT — THE ANTHROPIC API CREDIT RAN OUT, 10-03 ~04:40Z.** A76's grading got "Your credit balance is too low to access the Anthropic API" after 71 calls, with this machine's `ANTHROPIC_KEY`. ⚠ **If production uses the same Anthropic account, résumé generation is failing for users now.** Top up; then the agent re-runs A76 (it resumes where it stopped). | The agent cannot buy credit, and cannot see production's key or its errors (no Railway CLI here). |
| O49 | **Push draft `main` — and three calls.** ⚠ `87d2c33` (A71, A72, migration 123) was pushed by someone else and is LIVE (04:05Z). Local since: A73 `92d2f3c`, A74 `1f9df8e`, A75 `c60ec0c` (contract 1.5.0), A76 `afbbf95`, A77 `e240e6b` (migration 124 — the server then fetches employers' homepages and icons in the background; `COMPANY_LOGOS=off` disables), D1 `c6bd112`, D2 `568b556`. **Calls:** (a) A72 — a search lifts the profile's role scope (else "data engineer" returned 0 on an engineering profile); keep or revert? (b) A73 — Employment Type and Sponsor-friendly filter dead columns (0.3% / 0.1%); remove the controls, or wait for enrichment? (c) D2's four open questions — see the D2 row's status. | Pushing auto-deploys production. |
| O50 | **D3 — four decisions** (`docs/BUG_REPORTING.md` §11; the agent's recommendation in bold): (1) build or service — **in-house for BOTH layers in v1**, with a seam so Sentry (EU region) or self-hosted GlitchTip can be added at ~50 automatic reports/day (⚠ differs from the brief's split on purpose: at zero users the third-party privacy cost starts day one, the benefit does not) · (2) **beside A50**, `/admin/tickets` as a sibling route; one nav-link line, after A50's audit closes · (3) retention — **automatic 30 days; user reports until the ticket closes + 30, capped at 180; tickets (no personal data) kept**; hourly sweep; backups ~30 days, stated honestly; `contact_messages` gets the same rule (kept forever today) · (4) **one panel per product**, shared code vendored (the `packages/sqlite-backup` precedent). Also: a read-only GitHub token for the "deployed" check | D3 is designed; nothing is built until these are answered |
| O51 | ◐ **(a)(b) DONE 10-06 (31) by the agent; (c)(d) and the call stay the owner's.** (a) **production has 0 rows from adzuna, serpapi or jobo** — not one, active or inactive. (b) `job_captures` holds **1** capture, unconfigured: `ashby` / `hims-and-hers` (1 person); `apply_gate_packets` **5** rows. (c) not read (it needs the key's value, which the agent did not pull). Was: **D4 — what the agent could not read** (`docs/LIVE_SEARCH_FINDING.md` § Owner actions): (a) production rows per source — `SELECT source, COUNT(*), SUM(is_active), MAX(scraped_at) FROM scraped_jobs WHERE source IN ('adzuna','serpapi','jobo') GROUP BY source;` · (b) unconfigured companies already in production `job_captures` / `apply_gate_packets` (the admin Company list's suggestions table answers the first) · (c) if production's `SERPAPI_KEY` differs from local, its usage: `curl "https://serpapi.com/account.json?api_key=KEY"` (free) · (d) whether following Adzuna apply pages to the employer URL is allowed by its API terms. ⏸ And a call: **rewrite §3C** and **relabel/remove "live search only"** (both recommended, neither done) | No Railway CLI here; the production admin login was refused by the session's permission layer |
| O52 | ⚠ **Adzuna — a commercial licence may be required.** The account was upgraded to "general access, 300/min", far above any documented free tier. ⛔ The rate limit is not the question: **ongoing commercial use may need a licence agreement** — check Adzuna's terms / ask them; do not assume either way. (Adzuna is retired as a slug source, so this matters only if it is kept for anything at all; O51 (d) is folded in here) | Not a code task |
| O53 | **D5 / D6 calls:** (a) the two in-app links into the Recruiter view (JobCard's "View company KB →", CompanyViewModal's "Open in Recruiter view →") — keep, or remove like the tab? · (b) "Today" is also called "Today's draft", next to the new **Draft** tab — fine, or rename one? · (c) iOS strings once O10 settles the branch: on `feat/api-layer-feed-review-queue`, `APIError.swift:44` "Auto-apply is unavailable right now." and `JobsView.swift:98` "Auto-apply is paused right now." (`main` not scanned) · (d) push draft `main` (`effef72`, `97747f1` + docs) and draft-android (`195a10a`) | Display decisions; pushing draft auto-deploys |
| O54 | **D4 — build the SerpApi slug harvester?** Measured yield is high (50 / 50 new over 20 searches) but it feeds **Ashby (ready) and Workday (a separate project)**, not Greenhouse. Agent's recommendation: a small batch job into the existing `harvestedSuggestions` → `validateBoard` → admin add-company path, never auto-enabling, **Ashby first**; add description coverage to `validateBoard` before any enable; Workday only as its own decision (site parse, validation, the 300-posting cap). Free plan: 226 searches left this month | ⛔ Owner: measure-then-decide was the instruction; it is measured |
| O55 | **D10–D14 — calls, the store link, the upload, the push.** (a) **D10**: the tab reads **Draft** (kept) or **Draft / Queue**? · the deck's own heading and the marketing feature still say **"Today's draft"** beside the **Daily Deck** tab — rename? · draft-android's nav (Jobs / Resume / Templates / Profile) is a different set and was not swept · (b) **D12**: ⛔ **the Chrome Web Store item id** → one line, `shared/extension.js` `EXTENSION_STORE_URL` (`https://chromewebstore.google.com/detail/<id>`); until then `/extension` says the link is not published and offers nothing to click · and **public or unlisted** (an unlisted item installs from its link either way) · (c) **D13**: read the new privacy-policy sentence (the popup sends the tab's URL to check the board) and `STORE_LISTING.md`'s v1.2.0 note, then **upload v1.2.0** — it supersedes the v1.1.1 in review; the three store screenshots were NOT regenerated (A35, the restyle, is still open) · (d) **push draft `main`** (5 commits `654d4fd`…`fd32c2b`, auto-deploys) — ⛔ D11 and D12 in the SAME push, or production has no import path | Display calls, a store id only the owner has, a store upload, a deploy |
| O56 | **(a) ✅ DONE 10-05 (28)** — D16 merged and live (`291c906`), `hasResume` wired. (b)–(f) unchanged. **D15 / D16 — the merge, and D15's calls.** (a) ⛔ **Merge D16** — the agent's merge was refused by the session's permission layer: `! git -C C:\Users\duggi\WebstormProjects\draft merge --no-ff d16-artifacts` (migration 125; then the agent re-runs `npm test` on the merge and wires D15's `hasResume` to D16's artifact) · (b) D15: should **Closed** also hold rejections (today a rejection sits under Replied only)? · (c) keep the other Table sheets (Spreadsheet, Resumes, Saved Jobs, Pending Apply) behind History, or retire some? · (d) a rejected row reads **green** (it counts as a reply) — neutral instead? · (e) at 390 px the top bar clips "The Table" and part of "Draft" (since D10) · (f) D16 `--backfill` on production: backfilled copies are the résumé as it is NOW, labelled so | (a) blocks D15's download link from working end to end |
| O57 | **D17 follow-ups (A80):** (a) **`PrivacyPage.jsx` says ATS analysis is sent to Anthropic** — false since V2/V1; reword (the agent left user-facing privacy copy for you) · (b) **V3** profile wizard's "generate more chips": drop it, or replace with a local suggestion from the role family's skills? · (c) **V5** capture/paste: plain paste and unknown URLs have no local extractor — build one (JSON-LD `JobPosting`, meta tags) or refuse with "use the extension, or paste a labelled block"? · (d) **V6** smart-search: build a local résumé classifier, or take role family + domain from the active profile? · (e) scripts al3 / al4 → export → import, al1 / runEnrichment deleted — ok? · (f) push Resume Master `1636a01` (contract 1.2.0) and draft | Each is a product or copy call; the code paths are in A80 |
| O58 | **D21 — before anything is public (anonymous ATS check over MCP).** (a) **Merge + deploy** resume-master `d21-mcp-anonymous` (pushing main deploys; `1636a01` is also unpushed) · (b) **Set** `RM_MCP_ANONYMOUS="perIpPerMinute=10,perIpPerDay=200,perDay=5000"` (or your numbers — all three) and consider `RM_FREE_LIMITS_PER_DAY`; then from outside, `initialize` with no Authorization header must answer JSON-RPC and `tools/list` one tool · (c) **Railway log retention** for your plan → one line in the policy · (d) **OpenAI identity verification**; the policy names no operator and its contact is a jobsviadraft.com address · (e) ⛔ **a TERMS page** — resumemaster.one has none, submission requires one · (f) a **support** URL · (g) a raster **logo** · (h) run P1–P5 / N1–N3 (`docs/CHATGPT_APP.md`) in ChatGPT developer mode, then **submit** · (i) re-vendor contract 1.3.0 into draft `contract/resume-master/` after deploy (additive) |
| O59 | **D22 / E3 — two owner checks before ANY E3 build for Workday** (`docs/E3_SECTION6_WORKDAY.md`). (a) ⛔ **Legal reading of Workday's Terms of Service** (updated 08/13/2026): *"Develop or use any applications that interact with our Sites without our prior written consent"* and *"allow any other person or entity to use your account"* — do they reach a candidate's per-employer account, and the desktop extension's handoff? §6: prohibited = not built. · (b) **The idle test, no automation:** sign in to one Workday tenant on your phone, leave it, reload at **30 / 60 / 120 minutes**, note when it signs you out. Dead within ~an hour = the datacenter-replay question is moot for Workday. · (c) If both pass, decide whether to authorise one replay of the same cookies from a headful worker as a GET of Candidate Home only — never a submit |
| O60 | **D30 / D29 — the board's defaults (26).** (a) The board is scoped to the profile's role, so the unset domain dial reads "engineering jobs", not D30's "all" — confirm, or make "all" lift the scope. (b) Soft-null on the OPEN sets is noisy: "in Boston" = 1 known match + 32 country-only/remote kept after it; "design jobs" keeps 436 'general' rows — accept as "kept, not hidden", or treat them as a mismatch for those two dials. | D30's sentence must not imply precision the tags lack |
| O61 | **A81 / A84 — three scorer calls (26).** (a) ✅ **MERGED + LIVE 10-05 (26b) on the owner's go — draft `6521afe`, resume-master `a4fef7b`.** Was: Experience re-tune: ⏸ READY TO MERGE — branch `exp-weight-retune`, draft `1b4cbb4` (worktree `draft-wt-exp`) + resume-master `d3e8d1c` (worktree `resume-master-wt-exp`, vendor byte-identical), NOT merged, NOT pushed.** A MET years requirement now pays the no-requirement rate (0.85 of 22), not a bonus; shortfalls still cost; unknown stays 0.55 (`local_ats_v5`, scorer 1.2.0). ρ: draft 0.746 → 0.746 · draft with profile years 0.672 → 0.685 · assistant 0.592 → 0.595 — ⚠ gains inside the CI (noise); kept on principle (meeting a gate is not evidence of fit) and because no path falls. 3 variants, chosen in advance. ⚠ Pushing re-scores EVERY stored ATS row once (basis hash changes); visible numbers move only for profiles with years set, −1 to −4. Decide: merge both + push. (b) Should the scorer EVER read citizenship / work authorisation from résumé text? Engineering recommends **no** (sensitive, unreliable); today a "U.S. citizenship required" posting is always a hard-constraint miss for a caller without a profile. (c) A84: is parse-over-MCP worth having at all (hosts read PDFs themselves)? If yes: the allowlist value, anonymous vs token, the caps. | Each changes what a public tool scores or reads |
| O62 | **D29 — the first tagging sweep, and provider in admin (26).** (a) `GET /api/admin/job-tags/export?tag=level` (and `employment` 7.7%, `workplace` 47.5%) → tag → `import` (dry first). Decide whether a plain title with no stated years means mid. (b) The provider filter left the user surface — is an admin provider breakdown wanted? | Coverage is what makes the dials honest |
| O63 | **D30 — look at it on production (26).** No screenshots were taken (the throwaway server was reaped for memory). Check Full House's headline and dials live, light and dark, phone and desktop. | Built and tested, never seen |
| O64 | **D31 — five judgement calls to confirm or reverse (26).** (a) "9 of 12" counts job-specific verbs too, and verbs are claimable · (b) verdict / experience line / strengths in a third fold "More about this match" · (c) missing required items (citizenship, clearance, sponsorship) are a note in the band card, not a section · (d) the public tool shows "You could claim" read-only · (e) when the score shows, it sits right of the band row, hidden on a declined report. Also: re-share `jd2.html` to check the shots against the sketch. | Built from the row text; the sketch was not found |
| O65 | ✅ **CLOSED 10-05 (26b) — resume-master deployed `a4fef7b` (which contains `02a600d`) after the re-tune push; `/v1/version` reads it.** Was: **resume-master did not deploy (26).** `02a600d` is on `origin/main` (ls-remote, 10-05 ~14:45Z) but `/v1/version` still read `cbd2716` 20+ min later, and `/privacy.html` still serves the "Loading…" page. No Railway CLI on this machine — check the resume-master service's deploy log in Railway (build failed? auto-deploy off?) and redeploy. Until then A82/A83/A81 are NOT live. | Only the Railway dashboard can see it |
| O66 | **D32 — seven calls to confirm or reverse (27).** (a) In the deck the masthead drops title + company (the card's own heading shows them), so the company is not in the logo face there · (b) on the board's job detail the masthead REPEATS the pinned header's title + company — accept, or slim the header · (c) the Experience cell tints only in the deck (the board's detail has no report to hand) · (d) a posting with no tags shows no kicker (4.9%; one tag 23.8%) — or say "not tagged yet" · (e) a *quality* is claimed through the skill route — or give it its own claim kind · (f) the hover link exists only in the deck's pair · (g) mobile contract **2.1.0** (additive) — re-vendor in the apps when you choose. | Built from the row text; `pair2.html` not found (O68) |
| O67 | **D33 — the acceptance, on production (27).** (a) **Run the capture SQL** (in the D33 report, scratchpad / SESSION LOG): `SELECT id, user_id, job_id, url, ats_type, ats_slug, origin, action, out_of_market, datetime(created_at,'unixepoch') FROM job_captures ORDER BY id DESC LIMIT 5;` then `scraped_jobs` / `rejected_jobs` / `user_jobs` for the newest `job_id` — it says which of attached · held · inserted-but-hidden the 10-05 capture was. (b) In Railway's draft service settings, confirm the healthcheck reads `/api/health`. (c) Load v1.4.0 unpacked, **capture one US-remote posting**, record the popup text and whether it is in ★ Saved. (d) Upload `extension/submission/resume-master-extension-v1.4.0.zip` to the Web Store (replaces the never-uploaded v1.3.0). (e) Decide whether a user's OWN capture counts as US evidence for a bare "Remote" posting (today it is held). | Only the owner can capture as the owner |
| O68 | ✅ **DELIVERED 10-05 (28)** — `header.html`, `jd2.html`, `pair2.html` in Downloads; D34/D35 building from them, A86 built from `pair2.html`. **The sketch files (27).** ⛔ **D35 says build from `header.html` and STOP if it cannot be reached; D34 checks against `jd2.html` tab C.** Neither is on this machine (searched Downloads, Desktop, Documents, WebstormProjects, OneDrive, the Claude temp dir) — they are in the chat outputs. Save `header.html`, `jd2.html` (and `pair2.html`, for D32's shots) into `C:\Users\duggi\Downloads`. | D34 + D35 wait on it |
| O69 | **D16 + A76 follow-ups (28), now live.** (a) ✅ merged + live (`291c906`). (b) D16 `--backfill` on production — still O56. (c) A76: grade `draft-a76-grading\a76-grade-export.jsonl`, then `--import … --grader owner` (dry) → `--apply`; and `--carry-over --apply` for the 71 pre-D17 grades. (d) `al1ProviderQualityDiff.mjs` now holds the only copy of the retired enrichment prompt — keep or delete (O57e). (e) The SmartRecruiters/Workday description fetch and the `company_technographics` writer have had no trigger since A80 V4 — retire them, or give them a manual route. (f) A86: compare `draft-screenshots/a86-pair-fidelity/` with the sketch shots beside them; the 400px score column is a separate call. | Owner calls on now-live work |
| O70 | **D34 / D35 / D36 — calls and the attended step (28).** (a) **ADD JOBS:** the sketch draws a labelled "＋ ADD JOBS" pill; the row's §3 says `+` alone in a 40px square — **built as the row**. Keep, or the sketch's pill? (b) **The sentence's face:** Georgia (as sketched, built) or the app's Instrument Serif like every other display heading? (c) Should the panel copy carry the sketch's ⛔ / ⚠ glyphs (built without)? (d) Salary, sponsorship, sources, YOE stay in the FiltersPanel drawer behind "+ add → salary & more" — keep, or bring into words? (e) The dials' "Clear all ×" and "N jobs match" footer are gone per the sketch — want a one-press reset anywhere? (f) `jd2.html` has no tab C and sets its tokens in two faces — confirm `header.html` settles D34's type. (g) **D36:** the agent walks every apply path against the local fake ATS and writes `docs/D36_ATTENDED_RUNBOOK.md`; ⛔ **the one REAL application per path is yours, attended** — the agent never submits to an employer. | Sketch-vs-row calls; a real application under the owner's name |
| O71 | ⏸ **STILL THE OWNER'S — 10-06 (31): the agent's delete was refused by the session's permission layer** (not worked around). Read 10-06 from the service's variable names: **`GROQ_API_KEY` and `GOOGLE_API_KEY` are SET; `ENRICH_PROVIDER` / `ENRICH_MODEL` are not** — so two deletes, plus the Groq revoke. Re-grepped: no code reads either. **A87 — remove the dead provider variables from Railway (29).** From the draft service, delete if set: `ENRICH_PROVIDER`, `ENRICH_MODEL`, `GROQ_API_KEY`, `GOOGLE_API_KEY` — no code reads them since `814f182`. ⚠ Keep `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` (Google sign-in). Revoke the Groq key at console.groq.com. | Only the owner has Railway |
| O72 | ◐ **(b) DONE 10-06 (31) as A89; (a), (c), (d) wait on the owner.** **A80 — the last D17 calls (29).** (a) **V3, the profile wizard's "Load more AI suggestions"** (`/api/domain-profiles/generate-chips`, Haiku) — the last non-generation model call in production: (1) drop the button · (2) replace with local suggestions — skills seen in postings of that role family the user has not picked (thin: finance 8 postings, healthcare 0; registry siblings alone give nothing for 9 of 16 domains) · (3) keep it as a recorded D17 exception. The "AI" label must change for (1)/(2). (b) **`PrivacyPage.jsx` is wrong in 5 places** (O57a): ~239–241 says captured job descriptions go to Anthropic for ATS scoring (they don't) · ~440–448 says the tools service reads uploaded PDFs with a fallback (draft reads them itself) · ~451 "ATS analysis" (there is none) · ~452–453 omits that cover-letter material goes to Anthropic directly and that V3 sends domain/role/chips · ~34–36 a stale code comment. (c) The tools service's standalone generate classifies with Haiku when no role family is sent — keep (pinned as generation), or default to `general`? (d) A80 V10/V11: fill the al3 synonym batches and the 2 al4 lines by hand when you want them. | User-facing copy and a feature to drop |
| O73 | **D36 — the attended real applications, and five calls (29).** ⛔ **D43 (10-06 (32)): the check is a DELTA, not "a row appears"** — `job_applications` already holds ≥ 4 (orphaned) rows. Count before → one real application → count + 1, and the NEW row's `ats_score_at_apply` non-null. (a) ⛔ **ONE real application on MANUAL** per `docs/D36_ATTENDED_RUNBOOK.md`; confirm the `job_applications` row and its `ats_score_at_apply` BEFORE anything else; then one on SEMI, then one on GATED. First set Profile → Visa Sponsorship — an unset value now holds and asks. FULL AUTO stays locked. (b) Should the GATED path generate a résumé, and when? (today none, so no upload and a NULL score) · (c) should ⏸ Stop everything also stop the job being filled (D25 says no; the copy says so)? · (d) a per-company cap? (none exists; the Submitted cap ignores manual applications; FULL AUTO generation bypasses the approval cap) · (e) should a failed run refund its Draft slot and approval cap? · (f) should previews (which never send) be admitted under the kill switch? · (g) upload extension **v1.4.1** (supersedes v1.4.0, O67d). | Real applications under the owner's name |
| O74 | ◐ **Names checked 10-06 (31) by the agent:** `RESUME_MASTER_URL`, `RESUME_MASTER_TOKEN` and `ANTHROPIC_KEY` are **all set** on the draft service (Railway's variable-name list; values not read). ⚠ Not done: Admin → tools service `configured: true, tokenHeld: true` was not read (needs an admin login), and no 500 "ANTHROPIC_KEY not configured" was looked for in the logs. **A88 — the draft service's generation settings on Railway (30).** (a) `RESUME_MASTER_URL` + `RESUME_MASTER_TOKEN` must both be set — every new résumé needs them; since `875b43b` a missing one answers 503 "The résumé tools service is not configured on this server". Check Admin → tools service (`/api/admin/tools-service`) reads `configured: true, tokenHeld: true`. (b) `ANTHROPIC_KEY` is now needed ONLY for cover letters (the Cover Letter tool and the apply path's letter) and the wizard's "Load more AI suggestions" (V3, O72a). ⚠ If production ever answered 500 "ANTHROPIC_KEY not configured", the key is unset there and cover letters are down too — set it, or decide cover letters stay off (now an honest 503 `model_unconfigured`). | Only the owner has Railway |
| O75 | ◐ **(a) DONE 10-06 (32)** — committed (`4fcfff2`) with the cover-letter payload traced (D44.1); ⛔ still not pushed (O76a). **Session 31 — what is left for the owner, in the order I'd do it (10-06).** The agent now has the Railway CLI (`railway ssh` reads production; ⛔ **never `railway run`, which opens the LOCAL database**) and ran O41 / O43 / O51(a)(b) / O74's name check itself. **Still yours:** **(a)** ⛔ **tell the agent to commit + push session 31** — the live privacy page still carries five false claims. Let it trace the cover-letter payload first (D44.1); it is minutes. **(b) O42 + O71 in ONE Railway deploy** — stage `PIPELINE_PAUSED_SOURCES=jobo` and the deletion of `GROQ_API_KEY` and `GOOGLE_API_KEY`, then deploy once (each change restarts production; staged together it restarts once). ⚠ **Keep** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`; `ENRICH_*` are not set. Then **revoke the Groq key** at console.groq.com. Production has **no jobo rows**, so the pause only silences a CRITICAL — low urgency. **(c) O74:** read Admin → tools service (`/api/admin/tools-service`) — expect `configured: true, tokenHeld: true`; the agent verified the three variables' NAMES, not their values. **(d)** ⭐ **O72(a) — recommendation: DROP the button.** It is the last non-generation model call; the local replacement is thin (finance 8 postings, healthcare 0, role-family siblings give nothing for 9 of 16 domains), so it would return nothing for most domains — a button that mostly returns nothing is worse than none — and dropping it removes the third Anthropic bullet from the privacy page. The "AI" label goes with it, and the sixth test makes all three move together. **(e) O51(c)(d):** production's `SERPAPI_KEY` usage — `curl "https://serpapi.com/account.json?api_key=KEY"` (free) · Adzuna's terms (O52). Production has **no** adzuna / serpapi / jobo rows, so the *"live search only"* label describes nothing — recommendation: remove it. **(f) A90 / D43:** keep or remove the 4 + 4 orphaned rows — recommendation: **keep**, shown as *"posting no longer listed"*. **(g)** the capture surfaced an unconfigured Ashby slug, **`hims-and-hers`**. Add it through the admin dry-run add-company route (`validateBoard` first), or leave it? ⚠ Until it is configured nothing re-crawls it, so that job is **never refreshed and can age out** (D41) | Only the owner has Railway's variable writes (the permission layer refused the agent's); and decisions |
| O76 | **Session 32 — the owner's, in order (10-06).** **(a)** ⛔ **push `main`** (`19f1e0c`, 8 commits: A89·D44.1, D42, D41, D43, D40, D39, D38, D37) — the live privacy page still carries the five false claims until this ships. ⚠ The deploy applies **migration 129** and **re-tags every row** (TAGGER_VERSION 1 → 2) on boot. **(b) Production reads the agent could not make** — the permission layer refused `railway ssh` this session (it worked in 31). Either allow it, or run: (1) D41 — the owner's capture (`job_captures` `ashby/hims-and-hers`): its `job_id`, whether that `scraped_jobs` row exists, `is_active`, and whether it is in the 59 the O41 retire pass deactivated (the code path that produced "in ★, not ALL" is found and fixed either way) · (2) D43 — the 4 + 4 orphan `job_id`s against `cleanup_log` id 85; whose the 4 `job_applications` rows are and when written · (3) D42 — the Boston / finance acceptance against production's own strings (it passed on the 10-06 local board's 2,616). **(c)** D42's sector list (`shared/companySectors.js`) names 35 companies from the code's seed lists; production's other ~admin-added companies read "no sector on file" until a row is added — add them, or say so. **(d)** D37: the `nothing matches` verb is lower-case to follow `discovering` — keep? **(e)** A92's browser pass needs a signed-in run of the app (both themes) — say when. **(f)** still open from before: O42 + O71 (one Railway deploy), O72(a) (recommendation: drop the button), O73 (the attended applications — as a delta), O74(c), O75(e)(g), D44.3 (counsel) | Push deploys; production access; decisions |
| O77 | **Push `main`** (`37a46ff`: the lag fix, A91, A92) — pushing deploys; no migration in these three. Everything else in O76 stands (production reads, the sector list, the lower-case "nothing matches", O42/O71/O72a/O73/O74c) | Push deploys |
| O26 | ~~Confirm the deck's four proposals~~ ✅ **confirmed by the owner 09-30** and built (`be26aa7`) | — |

✅ **Done by the owner:** the A2 file copy · Anthropic balance funded · extension v1.1.1 rebuilt,
committed and reuploaded · `marketing.md` deferred — **the pilot is gated to CS anyway** · **service
tokens minted and live** (09-28) — draft's in its Railway env as `RESUME_MASTER_TOKEN`, the entry in
Resume Master's `RESUME_MASTER_CLIENT_TOKENS`. ⚠ Owner-reported; the agent never saw the token, by
design.

---

## AGENT QUEUE

Run top to bottom. One commit per task. Report into *SESSION LOG* between each.

| **A89** | ⛔ **`PrivacyPage.jsx` IS WRONG IN FIVE PLACES — fix the copy (O72b / O57a)** | ✅ **DONE 10-06 (31), local, NOT pushed.** All five corrected; effective date → October 5, 2026, with a dated comment entry (advance notice not triggered: nothing new leaves). The Anthropic paragraph is now prose naming exactly three features (generation + enhancement through the tools service · cover letters direct · "Load more AI suggestions" with what it sends) and "Nothing else is sent to Anthropic"; the tools-service paragraph says it does not read uploaded PDFs. `PRIVACY_RECONCILIATION.md`'s two ⚠ "page over-discloses" notes → ✅. No removed provider (Groq/Gemini) is named. ⭐ **`test/privacyO72Corrections.test.js` (+6)** — one per claim, on comment-stripped prose, plus a pairing guard: the disclosure, the wizard's "AI" label and the route's model call must all stand or fall together (O72a). Mutation-checked: all 6 fail against the old page. ⚠ A nested list was tried first and broke `privacyReconciliation`'s third-party join (first `<Strong>` per `<LI>` = a recipient) — the convention was kept, the copy changed. `npm test` **3386 / 3386 / 0**. Was: ✅ Owner 10-06: the agent does this; it is code, not a product call. ⛔ **A privacy page that describes data flows which do not exist is a legal surface, not a copy nit** — and this product stores **Article 9 data** (`ethnicity`, `disability_status`, `veteran_status`). **The five:** `~239–241` says captured job descriptions go to Anthropic for ATS scoring — ⛔ **they do not; the scorer makes zero model calls** · `~440–448` says the tools service reads uploaded PDFs with a fallback — **draft reads them itself** · `~451` "ATS analysis" — **there is none** · `~452–453` **omits** that cover-letter material goes to Anthropic directly and that V3 sends domain/role/chips · `~34–36` a stale code comment. ⚠ **Say what is true now, not what was once planned.** ⛔ **Check it against `PRIVACY_RECONCILIATION.md`'s four-column join and update that too** — if the page and the join disagree, one of them is the defect. ⚠ **Pin a test** that fails if the page claims a flow the code does not make, the way the reconciliation join already works. ⚠ A87 deleted the Groq/Gemini stack — **check the page does not still name a provider that no longer exists** |
| **A90** | **Orphaned user state in PRODUCTION** (agent-raised 10-06 (31), from O43's read) | ✅ **Covered by D43, 10-06 (32)** (`3e9c4f5`): the path found (the expiry cleanup exempted only starred/applied `user_jobs`), every delete path now refuses a referenced posting, records snapshot at apply, and orphans render "posting no longer listed". The 4 + 4 kept as tombstones; ⚠ not confirmed by job_id against cleanup_log 85 (O76b). Was: ⏸ **Measured, nothing changed.** **4 `user_jobs` rows and 4 `job_applications` rows reference a `job_id` that is no longer in `scraped_jobs`.** A49 #5 made retirement soft and routed expiry through the guarded cleanup, so these predate it or came from a path that still hard-deletes. ⚠ `job_applications` holds what a user applied to — find which path deleted the posting under them before cleaning anything; do not delete the orphans to make the count zero |
| **A91** | **/d's LIST is still its own endpoint** (agent-raised 10-06 (32), from D41(a)) | ✅ **DONE 10-06 (33), `28fc86b`, local.** `/api/jobs?pending=1` = the board's statement + `PENDING_MEMBERSHIP_SQL` (one copy, the legacy route reads it too); résumé fields attached after the list; the client fetches /d through `fetchJobs`; the /d count is the board's. Live on the throwaway server: /d 2 → 1 with a NYC filter, count likewise. Was: ⏸ D41 made ALL admit every drafted job and dropped /d's hard role join and title filter, so every /d job is in ALL. But `/api/jobs/pending` is a separate query: /d does not take the board's search, sentence or drawer filters, so a filter that hides a row in ALL does not hide it in /d. ⭐ Fix as D41 asked: /d = `GET /api/jobs?pending=1` (the board's statement + the pending predicate), with the résumé fields the pending card reads (resume_html, ats_report, apply_mode) joined for that view only; then retire `/api/jobs/pending` (countPending reads the same predicate). |
| **A92** | **Browser pass on D37 / D38 / D39** (agent-raised 10-06 (32)) | ✅ **DONE 10-06 (33), `37a46ff`, local** — headless Chrome on a throwaway local server (copy of the local board, synthetic account, keys blanked, every employer request aborted). D37: both themes × 390/1280/1920/2560 ok (edges equal, margins equal, bar 760 / 358). D38: link 57px of a 272px line; beside → the card opens the posting panel, no tab; on the text → the posting. D39: clicks inside either panel move nothing; each X closes its own — ⛔ **found: closing the ATS card slid the posting panel across** (right-anchored dock) → fixed (`reserveAfterClose`). Also found: the first-run prompt, empty ★ and extension page still said captures land in ★ → fixed. Was: ⏸ Proven on CSS, the layout function and a headless static page, NOT in the running app: (D37) screenshot both themes at 390 / 1280 / 1920 / 2560 — the geometry is `scripts/d37HeaderGeometry.mjs`, all ok; (D38) a click beside the company name navigates nowhere, on the text it does; (D39) open both panels, click each, both bounding boxes unchanged; each X closes its own. Needs a signed-in session (O76e). |
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
| A14 | Android open defects from the sweep | ✅ **Last open item DONE 10-02 (18), draft-android `c8aaea4` (local):** a refused swipe takes its optimistic badge down. Still open from this row: the admin `AssistChip(onClick={})` (with O15). ✅ `8445e88` + `b94a0e0` (09-30, draft-android, local), verified on the emulator: 401 → sign-in with a notice, credential cleared (relaunch lands on sign-in); **left swipe and X = saved pass** (PATCH `disliked:true` seen; Skip deleted); dead Filter button removed; failed Star → snackbar; section delete confirmed — ⛔ and found: the delete arm was UNREACHABLE (a stale swipe lambda painted "Delete" and un-hid); drag handle removed. 55/55 JVM, **15/15 instrumented**. Open: the optimistic "Saved to starred" badge shows before a failed write's snackbar; admin `AssistChip(onClick={})` left with 2b1 (O15) | — |
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
| A33 | ✅ **Looked at in a browser 10-02 (18) — one defect fixed (`90f2360`):** "B.S. Computer Science, University of Texas at Austin, 2021" proposed university "B.S. Computer Science" and field "Texas at Austin"; each field is now read from its own part of the line. Everything else on the screen was right. ✅ **DONE 10-02 (17), `2217a89`** — `shared/resumePrefill.js` (deterministic, local) proposes name, email, phone, links, city/state, degree, field, school, year, each with its source line; the Profile panel shows only what would change, overwrites unticked by default, fills the form, saves nothing. ⛔ Eligibility and EEO fields can never be proposed (tested). ⚠ Not looked at in a browser. ⭐ **Résumé upload → profile prefill** | Standard practice, and **the machinery exists** — `parse-pdf` is live in Resume Master and the intake form already collects these fields. On upload, extract name, email, phone, location, titles, skills, education, dates and drop them in as a **PREFILL the user confirms**. ⛔ **Prefilled, never auto-accepted** — an extracted value the user never saw is a claim they did not make, the same line AG2's claims copy draws. ⛔ **Eligibility fields are NEVER prefilled from a résumé**: work authorisation, sponsorship, visa, clearance, EEO. Those are attestations. ⭐ It also improves the extension's handoff — a fuller profile fills more of an employer's form |
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

| A49 | ✅ **FIXES 1–5 DONE 10-02 (16), merged + pushed — SESSION LOG (16); migration 116.** A43 unblocked by the deploy; A45 waits on O43. Was: ✅ **Audited 10-02, nothing built — SESSION LOG (13).** Six defects; A43 needs 1 + 4 fixed first, A45 needs 1–5 + a production re-measure. ⛔⭐ **DEDUPLICATION — audit the pipeline before adding sources to it** | ⏸ Queued 10-01 by the owner. ⛔ **Every growth decision on this page multiplies duplicates.** A43 adds companies, A45 harvests slugs from aggregators, and users import their own URLs — so **the same posting will arrive from several directions**: an aggregator result AND the company's own ATS board AND a user's capture. ⚠ **MEASURE BEFORE CHANGING ANYTHING.** How many duplicate groups exist on the board today, by what criterion, and which sources collide most? ⭐ **The machinery already exists** — `reconcileFingerprint` and `computeReqUid`, with a canonical priority of **direct ATS > provider > aggregator > import**. ⛔ **Do not build a second deduper.** Audit the one that exists: where does it key, what does it miss, and does every writer actually route through it? A new source bypassing it is the recurring Shape 1 defect. **The hard cases, each needing a stated rule:** • **the same job from a different source** — an aggregator URL and an ATS board URL for one posting. Canonical priority says the ATS row wins, but ⛔ **the duplicate must DONATE anything the canonical row lacks** (a salary, a description) rather than being discarded, as the salary-donation path already does. • **the same job reposted** by the employer with a new id — same title, same company, days apart. ⚠ Genuinely ambiguous: a repost and a second opening look identical. • **near-identical postings for different locations** — one role listed in three cities is three real jobs, not one. ⛔ **Do not collapse these.** • **a user's own imported URL** colliding with a board row. ⛔ **Dedup must never silently drop a user's own capture** — it should attach to the existing row and say so. ⚠ **Soft-delete, never hard-delete, and log the reason.** A duplicate that is actually a distinct job and gets deleted is unrecoverable; one that is retired can be restored |
| A50 | ✅ **Looked at in a browser 10-02 (18)** — real server on a throwaway DB, every Admin + DB Inspector tab at 1440 light/dark and 390 (`draft-screenshots/s18-admin`): no page errors, no failed call. Fixed: the deploy card's `lastRun: [object Object]` and the panel pinned left of a wide window (`243962e`); Pipeline Health's inactive rows read "UNENRICHED" (`a94c34d`). ⚠ The DB Inspector scrolls sideways at 390 (admin desktop tool — recorded, not changed). ✅ **Steps 4–7 DONE 10-02 (17):** company list management (`a21cd42` — probe dead/empty/live before adding, harvested slugs, enable/disable, audit-logged) · Job Trace lifecycle (`2c26633`) · restyle (`b6590bf`) · the tools-service card (`d3c5333`, `68beb18`). ⚠ Admin not screenshotted (no admin fixture). ✅ **Steps 1–3 DONE + step 4 audited 10-02 (16), merged + pushed (`ea76c88`) — SESSION LOG (16).** Two A51-level harms found → **A58**. Left in its order: company list, Job Trace, restyle (with A53), newer surfaces. Was: ✅ **Audited 10-02 — SESSION LOG (13); stop-the-harm queued as A51.** ⛔⭐ **ADMIN PANEL REVAMP — it is from the Resume Master era and the product has pivoted repeatedly** | ⏸ Queued 10-01 by the owner. ⛔ **Design doc first: `ADMIN_PANEL_REVAMP.md`. Do not start building from this row.** The panel was designed when this was a single-user résumé tool; it is now a two-sided job platform with a second stateless service, an extension, two mobile clients and a recruiter side. **It has not been redesigned once in that time**, and ⚠ one of its labels ("Not linked") was misread as an ATS integration status and triggered a whole strategy investigation — **that is what an outdated panel costs.** ⚠ **It is also the most load-bearing surface in the project for diagnosis** — Pipeline Health, the DB inspector and the usage ledger are how almost every defect in this codebase was found. ⛔ **Do not break that while making it prettier** |
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
| **A52** | ✅ **Open items DONE 10-02 (17), `b9d002c`:** enrichment finishing schedules a rescore (debounced, incremental); a stale stored score is no longer stamped at apply; the experience summary renders once; /tools/ats clears the ScrollDock. O19b stays the owner's. ✅ **DONE 10-02 (16), merged + pushed — SESSION LOG (16); migration 118.** The disagreement was a SECOND defect (stored score blind to the posting changing); A48 stands. Was: ⛔⭐ **THE ATS REPORT IS ONE MODULAR COMPONENT, NOT A DESTINATION** — ⚠ **10-02: renumbered from "A51" (that id was already queued and pushed as admin stop-the-harm). Partly overtaken: the A40 rebuild (`596d6b4`) renders the board's OWN `ATSPanel` in place in the deck's left panel and in the mobile sheet — the redirect observed was the three-column build. Still open: confirm ONE implementation across the board's side panel, the deck, the sheet and the public tool, and a guard that refuses a second.** | ⛔ **A40's expanded card REDIRECTS TO THE BOARD instead of rendering the report in place.** The owner's point: **it can be shown anywhere modularly — there is no reason to navigate to it.** ⭐ **One implementation, four surfaces:** the deck's left panel · the board's side panel · the mobile sheet · and the free public ATS tool (R1). ⛔ **This is the StampLogo lesson exactly** — three implementations of one mark existed, the rebrand swept two, and the third shipped the legacy name on every page while the guard passed green. **A second ATS-report implementation will drift the same way.** ⛔ A redirect here is not a UI decision, it is a **missing component**. ⚠ Check what the card snapshot holds — if it carries only 6 matched / 4 missing, the component renders a truncated report, and that is a `services/dailyDraft.js` dependency, not styling |
| **A53** | ✅ **Follow-ups DONE 10-02 (17), `8027e87`:** one body font (DM Sans — what renders; the dead Inter import removed), the FAQ's stale "queue" answer and /features' "Queue an application", Database's dead Pass handler gone with A63's table, all 28 signed-in scenes reshot (s17-*) — one defect fixed: the avatar sat on the AUTO APPLY tab at 390. ✅ **MERGED + PUSHED 10-02 (16b)** (owner: "push everything to main"). ⏸ was: **10-02 (16): vocabulary DONE on its branch (`f8279fe`, 2950 green), styling WIP (`1f43fa8`) — NOT merged; waits on O44. Owner decisions recorded: Queue Auto → Draft (same behaviour), Save/Pass SET, shared Undo. SESSION LOG (16).** Was: ⭐ **UNIFORM STYLING SITE-WIDE — the old board is still pre-rebrand** | ⛔ **VOCABULARY FIRST; it matters more than the styling.** The board card offers **Generate · Apply · Queue Auto · Save · Pass · Cover Letter**; the deck offers **Pass · Save · Draft**. ⭐ **"Queue Auto" IS "Draft"** — the product's verb is *draft*, the brand is *draft*, and two names for one action teaches two mental models. Rename it and audit every surface for the same split. ⚠ **Six buttons against three also means the two surfaces disagree about what a user DOES with a job** — decide which is right rather than restyling both. **Then the styling:** cream/ink/orange tokens, `StampLogo`, the new type scale, the deck's button treatment. ⛔ Use the token file — the guard fails on any colour outside it. ⚠ **Sweep every surface:** Auto Apply, Job Profiles, Database and the Recruiter stub were all built at different times and none has been through the rebrand |
🔸 ✅ **10-02 (16): EXPLAINED AND FIXED in A52** — a second defect, not A48.  ⚠ **10-02: NOT explained by A48** (A48 = enrichment coverage, measured with ONE scoring path; this is two paths disagreeing) — **still open, attach to A52.** **A48 evidence, observed 10-01:** a board card header reads **"No signal"** while its ATS panel, open beside it, reads **"Strong match"**. ⛔ **Two scoring reads disagreeing on one screen.** The card badge reads a **stored** value; the panel computes **fresh**. Precedent: `aj2fixture::moderate-upper` stored 43 (Moderate) and scored null (No signal). **Feed this into A48** — it may be the whole explanation for 0.1% → 20.5%, or an independent stored-vs-fresh defect, and the difference matters.

---

## QUEUED — added 2026-10-02

| | Task | Notes |
|---|---|---|
| **A54** | ⛔⭐ **RESUME MASTER HAS NO SITE — the domain serves nothing to a human** | ✅ **DONE 10-02 (17), resume-master `5ab72ff`, LOCAL (O47) — SESSION LOG (17).** `/` serves the site (public/, no framework, no third-party request; self-hosted fonts): the old night-blue cinematic look + Instrument Serif/Inter + glass, a sibling not a clone. Every tool a full flow — ATS (free, anonymous, band + evidence), Format (free, preview/download/print), Tailor (1 credit, says what the guard does and does not catch), PDF→text (1 credit) — plus the account. Privacy page = `docs/PRIVACY.md` served. Looked at 1440/390. +4 tests ⏸ Queued 10-02 by the owner. `resumemaster.one` is **live and verified 21/21**, but as an **API only** — its root is a JSON 404 by design. ⛔ **A person who visits it sees an error.** It is a product with a domain, a certificate, real uptime and **no front door.** ⭐ **Give it the old site's UI** — the pre-rebrand background, fonts and styling the owner liked — **plus the newer pieces where they fit** (the token system, the glass material, the type scale). It must read as a **sibling** of draft, not a clone: same craft, different product. ⛔ **Each tool needs a COMPLETE end-to-end flow, not a demo:** résumé generation · formatting · the PDF tools · ATS scoring. Upload or paste → result → download. ⚠ **It is STATELESS by decision** — ⛔ **SUPERSEDED 10-02 by A57: accounts, credits and opt-in storage.** The stateless constraint no longer holds; build the UI for a signed-in user with a credit balance, and for an anonymous visitor using the free ungated tools. ⚠ Anything model-backed costs money and there is no monetisation; the ATS scorer is **free and unlimited** by decision because it makes **zero model calls**. ⛔ Decide per tool what an anonymous visitor may run before a gate, and bound it — `/api/standalone/generate` was once Sonnet at 8192 tokens, unauthenticated, with a quota keyed on a cookie the caller controlled |
| **A55** | ⛔ **THE TOOLS MUST WORK INDIVIDUALLY — inspect every endpoint end to end** | ✅ **DONE 10-02 (17), resume-master `40614e4`, LOCAL — SESSION LOG (17).** `scripts/outsiderWalk.mjs` → `docs/OUTSIDER_WALK.md`: every route + MCP method as a stranger. Fixed: 401 now says what to send and how a token is got; `invalid_json`/`payload_too_large`/`not_found`/`limit_exceeded` carry a sentence. `RM_LIMITS_PER_DAY` limits policy (OFF unless set). ⛔ **The blocker is the token policy — O16c (owner)** ⏸ Queued 10-02. **Each tool must stand alone three ways: in its own UI (A54), over the API, and over MCP** — reachable by an external caller who has never touched draft. ⛔ **INSPECT, do not assume.** The live verifier passes 24/24 and `/mcp` answers 401 unauthenticated — ⚠ **neither proves a tool is usable by a stranger.** Walk each endpoint as an outsider: what does it need, what does it return, what happens on bad input, and **is the error legible to someone without our source?** ⭐ **The known blocker is the TOKEN POLICY (O16c):** every client needs an `rmk_` token minted by hand, there is no OAuth and no anonymous path — so **"an external user visiting the address" cannot currently get in.** That is the blocker, not the endpoints. ⛔ Decide: self-serve issuance, an anonymous free tier for the zero-cost tools, or keys by request. ⚠ Per-client accounting exists with limits OFF — turn them on before anything is public. ⛔ **ATS scoring over MCP ships first:** deterministic, free, zero model calls, and it does something an assistant genuinely cannot do |
| **A56** | ⭐ **A VM / remote-browser INTERFACE — controls and settings** | ⛔ **BLOCKED (10-02, 17): built WITH the worker, and the worker (A36, V1–V5) waits on the owner's review of `E3_SECURITY_DESIGN.md` (O12).** Nothing built — an interface with no worker would be the wired-to-nothing shape ⏸ Queued 10-02 by the owner, alongside A36 (`VM_EXECUTION.md`). The worker has **no surface at all** — no way to see a run, stop one, or know what is stored. ⛔ **Build the interface WITH the worker, not after.** **Needs:** stored profiles per portal, each showing **what is held** (cookies and localStorage only — never credentials) and when it expires · ⛔ **a REVOKE control that crypto-shreds**, visible to the USER, not only the admin · runs in flight with portal, job and stage · ⛔ **a kill switch verified MID-BATCH, not only at admission** · a per-run log of what was filled and what was refused · the attended/unattended toggle, ⛔ **locked to attended until AF5 and a supervised full-auto run have both passed** (V5). ⚠ **A user must be able to see and destroy their own sessions** — an admin-only view of someone's portal sessions is the wrong default. ⚠ Settings: per-portal consent, per-user caps, and a paused-portals list — the shape `PIPELINE_PAUSED_SOURCES` already uses |

| **A57** | ⛔⭐ **RESUME MASTER GETS ACCOUNTS, CREDITS AND OPT-IN STORAGE — and this REVERSES a recorded decision** | ✅ **DONE 10-02 (17), resume-master `3e48123`, LOCAL (O47) — SESSION LOG (17).** The light version: separate accounts (scrypt, hashed session cookie, reset ends sessions, export, delete); the ledger with economics BLANK — monthly grant + admin grant + refund-once, debit on SUCCESS with route + tokens recorded, 402 before any spend; opt-in storage of OUTPUTS only, 90 days, secure_delete. The token API stays stateless and draft is exempt — `stateless.test.js` narrowed to that, a behavioural test proves it. Off without `RM_DB_PATH` (503). Reversal recorded in `CORRECTIONS_REGISTER.md`. +11 tests, 4 injected red ⏸ Queued 10-02 by the owner. ⛔ **RECORD THIS AS A DELIBERATE REVERSAL, not a drift.** `PRODUCT_MODEL.md` and `COMPANY_FORMATION.md` both say **"Resume Master is STATELESS — no database, input in, output back, nothing retained"** (owner, 09-26). That is now overturned. Write the reversal and its reasoning into `CORRECTIONS_REGISTER.md`, the way the `/api/apply/session/*` 410 reversal has to be — otherwise the next reader finds two documents disagreeing, which is this project's most expensive recurring failure. **WHAT IT NOW NEEDS:** • **a database** — the service has none • **accounts**: signup, sign-in, sessions, password reset ⚠ **which needs email, and `RESEND_API_KEY` is still unset even on draft (O28)** • **a credit ledger** — balance, debit per call, refund on failure. ⛔ **Debit on SUCCESS, never on attempt**: a 502 from an exhausted balance or a rejected PDF must not cost a credit, and "retryable vs permanent" is already distinguished in `modelCall.js` • **opt-in storage** of résumés and PDFs. ⭐ **"On the user's demand" is the right default and should stay literal** — nothing retained unless they ask, per artifact, with a delete that deletes. **WHAT IT DRAGS IN, all of it real:** ⛔ **a stored résumé is personal data**, and US résumés routinely carry addresses, phone numbers and sometimes veteran or disability status — **that is GDPR Article 9 territory, the same exposure `LEGAL_AND_COMPLIANCE.md` §1 already flags for draft.** Retention limits, real deletion, and an access path are not optional • **the stateless promise was the trust story** (*"we process it and keep nothing"*) — losing it means the privacy page has to say what IS kept, for how long, and why • ⚠ **credits GIVEN are not trading; credits SOLD are.** Free allocation needs no entity. The moment one is bought, the whole monetisation gate applies: entity, trader declaration, terms, processor, VAT — `COMPANY_AND_MONETISATION.md` §5 • ⛔ **ATS scoring stays FREE, UNLIMITED AND UNGATED** (O23, O16b) — it makes **zero model calls**, so there is nothing to meter and gating it would forfeit the distribution argument. **The gate is only on model-backed tools: generation, A+, cover letters.** ⛔ **OWNER DECISION 10-02 — BUILD THE LIGHT VERSION; the credit MODEL is still open.** ⭐ **Separate accounts, no SSO** — it keeps the "not linked" decision true, needs no cross-service identity, and SSO can be added later without undoing anything. ⭐ **draft's service token is EXEMPT from credits** — it is an internal client on a contract, not a customer, and metering it would mean draft's own cost showing up twice. ⭐ **Build the ledger, leave the ECONOMICS blank:** balance, debit-on-success, refund-on-failure, an admin grant. ⛔ **No price, no packs, no purchase path** — credits are GRANTED only, so nothing here makes the owner a trader and none of the monetisation gate applies yet. ⚠ **The one thing to get right now because it is expensive later: every debit records WHAT it was for and WHAT it cost in tokens.** Change the price per call later and the history still reconciles; omit it and the ledger can never be re-priced. ⚠ Also keep a free monthly grant — it is how the product is usable before any of this is decided |
| **A58** | ✅ **Follow-up DONE 10-02 (18), `2e4ada0`:** `scrapeJobs`, `scrapeHarvestAPI` and their helpers deleted — no caller, and it could not have run (`ApifyClient` was never imported). Found: `aggregateAtsMissingSignals` has no caller → **F1** (was A66); `apify-client` has no importer. ✅ **MERGED + PUSHED 10-02 (16b)** — full suite green after the merge fixes (`b86b057`). ⛔⭐ **ADMIN — STOP THE HARM II** (found by A50's audit, 10-02; first numbered A54 — renumbered because the owner's session queued A54–A57) | ⏸ **WIP `51b9066` on branch `a54-stop-the-harm-ii`** (worktree `agent-a6d9b189b3b56586f`): all five built, 18 tests, 22 injected violations red; ⚠ full suite, client build and screenshots NOT run. **(a)** Delete user refuses `system` (id 0) and admins, goes through `deleteAccount`, typed-username confirm with per-table counts **(b)** Job Review never writes `user_jobs`; "Hide" → "Unclassify" with an impact count, logged + undoable (migration **119** `admin_audit_log`); Re-tag Pool removed **(c)** restore checkpoints the WAL first **(d)** Revert batch dry-runs first (409 unless `expectRestorable` matches) **(e)** dead `force-scrape` removed. Follow-ups: `scrapeJobs()` now has no caller; `extension/submission/PRIVACY_RECONCILIATION.md` still describes the force-scrape path |
| **A59** | ⭐ **DRAFT WAITS IN LINE — a viewable, editable queue** (O44, owner 10-02) | ✅ **DONE 10-02 (17), `0040f1e` — LIVE in `e9fd9c3` — SESSION LOG (17).** Migration **120** (`apply_runs.line_position`, status `waiting`). A Draft over the limit WAITS (202 `waiting:true`, `line:{position,length}`); it also waits behind a non-empty line, so nothing jumps it. Viewable + editable until it starts: `GET /api/apply/line` (and `line` on `GET /api/apply/runs`), `PATCH /api/apply/line/:id` (the résumé tool; A+ gated; an approved run is locked), `POST /api/apply/line/order` (the whole order; stale → 409 `line_changed`), `DELETE` a run or one job; after start → 409 `run_started` with a sentence. Kill switch holds the line; boot recovery (`recoverInterruptedRuns`) resets the orphan; an unref'd 30 s ticker. Auto Apply shows "Waiting in line"; the toast says "waits in line (2 of 3)". +16 tests, 6 injected red; 8 shots `draft-screenshots/a59-line` ⏸ Queued 10-02. A Draft while a run is active is **queued, not refused** (today: 429 `run_already_active`, `APPLY_MAX_ACTIVE_RUNS_PER_USER=1`). ⭐ **Every waiting Draft is viewable and editable BEFORE it begins** — the user sees the line (order, job, what will be filled/generated), can reorder, edit what the run will use, or remove one; ⛔ a run that has STARTED is not editable (say so). The deck's and board's Draft keep ONE call (`client/src/lib/jobDecisions.js`, A53) — the queue lives server-side and persists, never a client basket again (A53 removed one). ⛔ Duplicates stay refused (`already_drafted`, A53). ⚠ **Also fix the orphan:** a run left `running` by a restart is never reset, so that user's line never moves — reset/resume at boot. ⚠ The kill switch must stop the LINE, not only the active run. Tests: a second Draft queues; an edit before start lands; an edit after start is refused; a restart recovers |
| **A60** | **Limits modal — enforce or remove each field** | ⏸ **Still waits on the owner's O45(a), field by field (10-02, 17).** ⚠ Note for that decision: A63's Draft slots (O46) now bound Drafts + new résumés to 10/24 h, which overlaps `monthly_apply_runs` and `daily_resumes` ⏸ Waits on the owner's call per field — **O45(a)** has the field-by-field table. Then: enforced fields get a `checkLimit` at their route with a test; removed fields leave the modal (keep or drop the column per the migration rules) |
| **A61** | **Enrichment run — a button in the admin panel** (O45b, owner 10-02) | ✅ **Looked at 10-02 (18)** with the A50 shots: Dry run renders, Enrich… unlocks only after it. ✅ **DONE 10-02 (17), `e9aff67` — LIVE in `e9fd9c3` — SESSION LOG (17).** `EnrichmentSection` in the Operations tab: Dry run → "Enrich N…" only for the planned parameters; the confirm states the cost ceiling, the 100/request cap and the nightly drain's budget (and that a manual run is NOT counted against it); result = coverage before/after. +2 tests, 2 injected red. ⚠ Not screenshotted (no admin fixture in the shot scripts) ⏸ Queued 10-02. `POST /api/admin/enrichment/run` is curl-only. In A50's Operations tab, A50's pattern: **dry run by default** (candidates and estimated cost from `/candidates`), "Run N" unlocks only after a dry run with the same parameters, the confirm states the spend and the daily cap; the result shows coverage before/after (`/coverage`). ⛔ It spends real money per row — never a one-click default |
| **A62** | ⭐ **JOB DATA IN AND OUT AT WILL — and captured jobs through the ONE gateway** (owner 10-02, a plan restated) | ✅ **Follow-up DONE 10-02 (18), `072fbe4`:** a saved capture held outside the US shows OUTSIDE THE US, not NO LONGER LISTED (`Job.heldOutsideUs`, contract 1.4.0); looked at on the Saved tab at 1440/390. ✅ **DONE 10-02 (17), `e9fd9c3` — LIVE (pushed by someone else) — SESSION LOG (17).** Migration **122**. `services/jobs/jobGateway.js` `ingestJob`: the ONE deduper, canonical write and US-only gate, now used by every capture/import (importJob no longer writes itself); a capture outside the US is kept for the user but held off the board, and says so; `job_captures` records the ATS + slug (A45's harvest). Admin `/api/admin/job-data`: NDJSON export, import dry by default (per-row insert/replace/attach/held from a read-only `previewFingerprint`), batches revertible (soft, count-checked). +6 tests, 3 injected red. ⚠ An out-of-market capture shows in Saved as "closed" (inactive), not "outside the US" — follow-up ⏸ Queued 10-02. **What exists:** `routes/enrichment.js` — `GET /export` (JSONL, admin-gated) and `POST /import` (dry by default, revertible batches, coverage not row counts) — but the import only ENRICHES rows that already exist (`job_id` + `content_hash` + enrichment); and `routes/importJob.js` `POST /job` (a user's URL). **Wanted:** (1) export and import of JOB data, not only enrichment, at will — for enrichment by an outside filler and other purposes — admin-gated, dry run, revertible, through `upsertCanonicalJob` / the A49 deduper (⛔ never a second writer — Shape 1); (2) ⭐ **the jobs a user brings in (extension captures, imported URLs) are ingested through that same gateway**, so a capture becomes a normal board row (deduped, A37-gated, enriched) and, per A49 #4, a capture that matches an existing row ATTACHES and says so. ⚠ A45 (slug harvesting) reads the same captures — let the gateway record the ATS host + slug. ⚠ Extension privacy: captures are user-invoked and already sent to us; nothing new is read |
| **A63** | ⭐ **THE BOARD'S TOOLS, RESHAPED — Apply in the company link; Generate costs a Draft; PENDING → verified → SUBMITTED** (O45c, owner 10-02) | ✅ **DONE 10-02 (17), `1a3b123` — LIVE in `e9fd9c3` — SESSION LOG (17).** Migration **121** (`application_records`, `draft_slot_uses`). (1) the company name is the apply link (board panel + card); Apply / "Apply directly" gone; KB on the logo. (2) `services/draftSlots.js`: ONE allowance of 10 / trailing 24 h shared by Drafts and NEW résumés; refused at zero (`draft_slots_exhausted`); shown before pressing. ⚠ **This bounds Drafts to 10/24 h — O46.** (3) Pending → recorded → **verified** → Submitted (`services/applicationRecords.js`): verified = statement + plausible date + one piece of evidence matching THIS employer (confirmation URL on the posting's host/ATS, confirmation text naming the company, a reference number on trust, or the automation's verified submit); it does NOT prove receipt. Only a verified record writes `job_applications` (score at apply — A47's path now fires); POST `/api/apply`, POST `/api/applications` and the pipeline's submit all go through it. Found: the old board Apply recorded the job as APPLIED on the click (the route ignored `mode`). +12 tests, 4 injected red; 8 shots `draft-screenshots/a63-board-tools` ⏸ Queued 10-02. **(1) Apply is merged into the COMPANY NAME, baked in as its hyperlink** (to the posting/apply URL) — no separate Apply button. ⚠ The old Apply opened a pre-filled form in a VISIBLE browser, which cannot work headless in production (A53) — the link replaces it. **(2) Generating a résumé consumes ONE of the day's 10 Draft slots — 1/10** (✅ confirmed by the owner 10-02: the deck's daily allowance, `DECK_SIZE = 10` in `services/dailyDraft.js`; a generation counts against the same 10 as a Draft). Say so BEFORE the user generates, and show what is left. **(3) A PENDING state:** a generated / applied-for job gets a **Pending** tag and goes to a **Pending table**; the user **records the submission** (when, how, optionally a confirmation or reference) and it is **VERIFIED** before it moves to the **Submitted** list. ⛔ Nothing becomes "submitted" on a click alone. Write `job_applications` (with `ats_score_at_apply` — the recording path that has never fired, A47) when it is verified, not before. ⚠ Define "verify" explicitly in the design (user attestation plus evidence? an employer email?) and state what it proves and what it does not |
| **A64** | **The company-authenticity registry: audit every entry against sources** (found 10-02, 17) | ✅ **DONE 10-02 (17d), draft `5dfe8c3` + resume-master `908c275`, LIVE — SESSION LOG (17d).** ⛔ **The premise was wrong first:** nothing enforces company authenticity with this file — its one reader is the ATS scorer, which admits a stack term only when the company's OWN posting names it, so no entry can score a term the posting did not ask for; `notStack` had no reader. **Stripe corrected** (AWS, Ruby/Sorbet, Java, Go — sourced; it had a GCP stack), Airbnb and Spotify sourced (the three on the board), **`notStack` removed** (75 unsourced negative claims), header tells the truth, 57 of 60 marked UNVERIFIED. ρ 0.746 → 0.746. +3 tests. ⏸ Queued 10-02 by the agent. `packages/ats-scorer/data/DOMAIN_TOOL_REGISTRY.json` — "used by classifier.js and the generation model to enforce company authenticity" — says **Stripe**: stack GCP, Pub/Sub, BigQuery, GKE, Dataflow; notStack AWS Lambda, DynamoDB. That conflicts with Stripe being widely reported as a large AWS customer. Not changed from memory: ⛔ each of the ~60 entries needs a cited public source (engineering blog, conference talk, the company's own postings) or removal. ⚠ Why it matters: an authenticity rule built on a wrong "notStack" flags a TRUE claim — the Bangalore precedent. Re-vendor into Resume Master after (its checksum test) |
| **A65** | **Switch Resume Master's store on — with draft's backup policy, on its own volume** (A57 follow-up; owner's note under the A57 table) | ✅ **DONE 10-02 (17e), draft `12dfd1b`+`234f89a`, resume-master `6415646` — SESSION LOG (17e).** One policy: draft's `scripts/backup.js` moved unchanged into `packages/sqlite-backup` (paths configurable), vendored + checksummed into Resume Master. Store at `RAILWAY_VOLUME_MOUNT_PATH/resume-master.db` (`RM_DB_PATH` overrides); daily copy 02:00 UTC, never at boot. **Pinning decided:** a pinned document is kept until unpinned or deleted (≤ 20 per user), unpinning restarts its 90 days. Saves refused (`storage_full`) under a max(64 MB, 15 %) reserve. ⛔ Pushing Resume Master is the first boot with the store on — `accounts` reads true from then. ⏸ Queued 10-02 (17d). The volume `resume-master-data` exists (owner). (1) Open the store from `RAILWAY_VOLUME_MOUNT_PATH` (keep `RM_DB_PATH` as an override); (2) ⛔ port draft's backup policy (budget from the volume, refuse before the copy, retention per `b628ee6`) — one policy, not a second; (3) decide pinning vs the 90-day expiry; (4) only then does `accounts` read true. ⚠ The first boot with the store on is when user data starts to exist |
| **F1** | **The ATS-suggested skills feed has no writer** (found 10-02, 18; first numbered A66) | ⏸ **Queued 10-02 (18), agent's call to hold — say if you want it.** `aggregateAtsMissingSignals` (services/profileSignalAggregator.js) turned the scrape scorer's reports into `profile_signal_suggestions` — what Profile's "Inactive ATS-Suggested Skills" shows. Its only caller was the crawl inside `scrapeJobs`, which could not have run for a long time (no `ApifyClient` import) and was deleted in `2e4ada0`, so the list fills from nothing. **Options:** (a) call it from the ONE per-profile writer (`storeAtsReportForProfile`), so the board-fit precompute and the panel feed it; (b) remove the feature and its UI. ⚠ (a) changes what users see (suggestions start appearing) and runs on every stored report; measure the write volume first. Not built: it is a product change, not a repair |
| **F2** | **`/api/jobs/poll` reads scrape state nothing writes** (found 10-02, 18; first numbered A67) | ✅ **DONE 10-03 (20), `77312df`** — the route stays (JobsPanel reads new rows from it); `activeScrapes`, its eviction and `scrapeStateKey` are gone and it answers `scraping: false`. The dead "scrape done" log line was the only place profile facts were logged — that line is now live on every poll. ⏸ Queued, low value. `activeScrapes` has no writer since the crawl went, so `stillScraping` is always false and the route is a filtered board read. Narrow it or retire it after checking whether the client still polls it; the same cleanup class as `2e4ada0` |
| **F3** | **The formatter moves a later role's header above an earlier role's bullets** (found 10-03, 19, measuring A70) | ✅ **DONE 10-03 (20)** — Resume Master `6e430bb`, draft's copy `75f00b5` (read by `kb/failsafe.js`). The model's classed HTML was never affected; plain text and generic HTML with no blank line between jobs were (the site's Format tool invites exactly that). A plain line after bullets now starts a new entry; a date-only line is the date. ⏸ Repro: `formatResume({ html })` with two `<h3>Org — Role</h3><p>dates</p><ul>…</ul>` entries renders "Northwind — Senior Software Engineer / 2021 – 2025 / Fabrikam — Software Engineer 2018 – 2021 / [Northwind's bullets] / [Fabrikam's bullet]" — the second header is folded into the first entry, ahead of its bullets. A11 recorded that the formatter "reorders/renames sections and folds unknown headings"; this is a concrete, damaging case (bullets read as the wrong employer's). Check against the model's real output shape first — it may only bite on this HTML shape |

#### A57 · Resume Master's storage and backup (owner's note, 10-02 — moved here from inside the A57 row, words unchanged)

⛔⭐ **STORAGE AND BACKUP — do not treat the volume as a checkbox.** Resume Master has **no volume
today** (it was designed stateless). Railway allows **one volume per service**, so it needs its own,
mounted at **`/app/data`** to match draft's convention, with the code reading
**`RAILWAY_VOLUME_MOUNT_PATH`** rather than a hardcoded path. ⚠ Adding it restarts the service.

⛔ **IT STARTS WITH NO BACKUP POLICY, AND IT WILL HOLD USER DATA.** draft's backup machinery was
hard-won: the budget is computed **from the volume**, it **refuses before the copy** rather than
filling the disk, and the retention bug that left a **12-day hole (09-17..09-29)** is fixed in
`b628ee6`. Resume Master would have none of that while holding **accounts, a credit ledger, and
résumés and PDFs the user explicitly asked to keep.** ⭐ **Those are not crawled rows — they are the
thing the user trusted us with, and they are unrecoverable.** Port draft's policy; do not write a
second one.

⚠ **SIZE IT FOR PDFs, NOT ROWS.** draft's volume sits at **481 / 1,000 MB** holding a job board, and
it already failed once with **ENOSPC at 481/500**. A few hundred stored résumés and generated PDFs
move faster than that. ⛔ **Decide the retention rule NOW, in this row:** stored artifacts expire
unless the user pins them — rather than discovering it at ENOSPC a second time.

⚠ **NAMING, and it is a live hazard:** draft's volume is called **`resume-master-volume`** — a
leftover from before the rename. ⛔ **Rename it BEFORE adding Resume Master's**, or the project will
hold two volumes where the one named after Resume Master belongs to draft. That is a 2am mistake
waiting to happen. Suggested: `draft-data` and `resume-master-data`.

**Status 10-02 (17d), owner-reported:** ✅ **the volumes exist under the suggested names** — draft's was renamed **`draft-data`**, and Resume Master has its own, **`resume-master-data`**. ⚠ Not agent-visible (no Railway CLI here); live `/v1/site/config` still reads `accounts: false`, so the code is not using it yet. ⏸ **Still open (agent, A65):** read `RAILWAY_VOLUME_MOUNT_PATH` (today the store opens only on `RM_DB_PATH`), port draft's backup policy before any account exists, and the retention rule — A57 already expires a saved document after 90 days (`RM_ARTIFACT_RETENTION_DAYS`) with no pinning. ⛔ Switching the store on is the moment user data starts to exist: do it with the backup policy, not before.

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
| **K2** | ✅ **MEASURED 10-02 (17), NOT SHIPPED (`fefa487`)** — the employers' KB stack precomputed into the basis: ρ 0.746 → 0.735…0.580 (KB by weight), 0.752…0.559 (technical only), 0.734 (curated registry). +0.006 at best, inside n=30's noise; more credit hurts. The technographics are mostly soft skills mined from ADS. Recorded in `RECRUITER_LAYER_EXECUTION.md` §K2. KB in ATS scoring | K1 | ⛔ `scoreAtsLocally` stays deterministic, local, free, ZERO model calls — load-bearing for the daily draft, the free band and the free MCP tool. **Precompute into the scoring input, never query per score**; if that cannot be done cleanly, stop and report. ⚠ Measure ρ before and after — G1's synonym table moved ρ by +0.000 |
| **K3** | ⏸ **HELD 10-02 (17), agent's call — say if you disagree.** ATS-over-MCP is live (the precondition), but K2 just measured what the KB would answer "what is its stack" with: soft skills mined from job ads (Stripe's top: communication, stakeholder management…), and the curated registry has a suspect Stripe entry (A64). Publishing that over an API as company fact — even with confidence attached — is the low-confidence-rendered-as-fact failure the section warns about. Also: the KB lives in draft's DB, Resume Master has none of it. Prerequisite: a KB answer good enough to publish (technical stack separated from ad prose; A64). KB over API + MCP | ⚠ ATS scoring exposed first | ✅ **Premise answered by A11:** Resume Master's `/mcp` serves `score_ats_fit` (0 model calls) since `6e1837d`. ⛔ Companies and roles only — **no individual dossiers**, and that becomes a contractual promise once it is an API. ⛔ Every answer carries confidence and provenance. ⚠ `is_h1b_sponsor` NULL = no signal, never "does not sponsor" |
| **P1** | ✅ **The fix part DONE 10-02 (17), `b2b3eb1`:** CC4 had already put claims in their own table; Refresh now confirms first, Refresh and a résumé upload both show the server's "hand edits replaced, claims kept", and the editable lists are no longer labelled "Extracted". The relocation into account management is not done ("low value alone"); no schema touched. Job profiles into account management | nothing (low value alone) | ⛔ Relocate the EDITING surface, change NO schema — `domain_profiles` scopes the board, scorer, bridge, generation and CC5's keys. ⭐ The value is the fix: `/signals/refresh` and a résumé re-upload SILENTLY OVERWRITE user edits; auto-extracted vs user-asserted terms must be distinguishable in the store |
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

### 10-06 (33)

- **The board lag** (facets 9.7 s → 0.09 s, search 1.0 s → 0.25 s), **A91** (/d on the board query), **A92** (browser pass; the panel slide on close fixed) — local, not pushed. 3434 / 3434 / 0.

### 10-06 (32)

- **D37–D44 + A89/A90, local, not pushed** (`4fcfff2`…`19f1e0c`): the filter invariant and the sector tag (D42), the captured job in ALL with its salary and logo, and the US-only refusal (D41), application records that survive their postings (D43), the privacy follow-ups (D44), + as the fourth view (D40), the rigid panel pair (D39), one company link (D38), the owner's sentence and the centred header (D37). 3426 / 3426 / 0.

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

### 10-03 (19b)

- **A68** look C on Resume Master, static sky, accent pending the owner (`21c8520`) · **A69** the PDF tools as Resume Master's own product with pages (`c212a04` `21c8520`), removed from draft (`02bbca0`)

### 10-03 (19)

- **A70** PDF → text free and deterministic (Resume Master `114bfcd`) · **A69** the in-browser PDF toolkit, one component on both sites (draft `9bb1d80` `9df5a6d`, Resume Master `5626a89`)
- The F## numbering rule (`d171491`) · A68 at its checkpoint (three eras shot)

### 10-02 (18)

- **A58** follow-up: the dead LinkedIn crawl deleted (`2e4ada0`) · **A62** follow-up: OUTSIDE THE US on a saved held capture, contract 1.4.0 (`072fbe4`)
- `npm test` no longer writes fake tracking failures into `data/` (`11eb61f`) · admin: deploy card + centring (`243962e`), Pipeline Health inactive labels (`a94c34d`) · **A33** prefill school/field (`90f2360`)
- draft-android: **A14**'s last open item, the badge on a refused swipe (`c8aaea4`, local)

### 10-02 (17)

- **A65** Resume Master's store on the volume with draft's backup policy (one package, vendored), pins vs the 90-day expiry, saves refused when the volume is low (draft `12dfd1b` `234f89a`; Resume Master `6415646`)
- **A64** company stack registry audited: Stripe corrected and sourced, `notStack` removed, the header's false authenticity claim corrected (`5dfe8c3`; Resume Master re-vendored `908c275`)
- **A59** a Draft waits in line, editable until it starts; boot recovery of orphaned runs; the kill switch holds the line (`0040f1e`, migration 120)
- **A63** Apply is the company name; a new résumé costs one of the day's 10 Draft slots; Pending → verified → Submitted, `job_applications` written only on verification (`1a3b123`, migration 121)
- **A61** enrichment button, dry run first (`e9aff67`) · **A62** one gateway for job data in + admin job export/import (`e9fd9c3`, migration 122)
- **A53** follow-ups (`8027e87`) · **A52** open items (`b9d002c`) · **A50** steps 4–7 (`a21cd42` `2c26633` `b6590bf` `d3c5333` `68beb18`) · CORRECTIONS_REGISTER reversals (`51d4713`)
- Resume Master: **A57** accounts/credits/storage (`3e48123`) · **A54** the site (`5ab72ff`) · **A55** outsider walk (`40614e4`) — local

### 10-02 (16)

- **A52** stored ATS score tied to the posting (`job_hash`, migration 118) + ONE report component (`4debf80` `b49bc72` `62d9f5e`, merged `500d9a4`)
- **A49** dedup fixes 1–5, migration 116 (`2152bd0`..`be1d338`, merged `042133f`)
- **A50** admin wrong numbers, Operations tab, the daily glance, the button audit (`ea76c88`, merged `56a7b07`)
- The two known flakes fixed at their cause (`888f84c`)

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

### 2026-10-06 (33) · Pushed 32; the lag; A91; A92

- **Pushed on the owner's go** — `1b6b31c` live 07:00:47Z, `latestApplied: 129_application_snapshots`, health and /privacy 200.
- **The lag ("on the board rendering in each of the panels or search trigger")** — measured on a throwaway local server (`RM_DATA_DIR` on a copy of the local board, `scraped_at` refreshed so the boot cleanup does not retire it into a live crawl; model / search keys blanked; `COMPANY_LOGOS=off`; a synthetic account). `/api/jobs` 0.05–0.3 s, but **`/api/jobs/facets` 9–10 s**, fetched on every press. Cause: the location clause — 74 options each asking the place predicate (correlated EXISTS) per row, 27.8 s unscoped. Fix: read the board's places once, count all 74 in memory with the same rule (`placeFacetCounts`, held equal to the SQL for every option by test). Search: the tier function's cache hit still copied every description into JS on every pass (93 ms vs 17 ms) — stamp moved into SQL (`octet_length`), description sent only on a miss. **Facets 9.7 s → 0.09 s; search 1.0 s → 0.25 s; in the browser, a press → sentence 72 ms, cards 305 ms.** `62a89a9`.
- **A91** `28fc86b` — /d is `/api/jobs?pending=1`; filters apply; count = list. Verified live on the throwaway server.
- **A92** `37a46ff` — the browser pass (see the row). One real D39 defect found and fixed (the slide on close), and stale ★ capture copy.
- `npm test` **3434 / 3434 / 0**; the client builds. **Not pushed** (O77). The throwaway server is stopped; its data lives only in the session scratchpad.

### 2026-10-06 (32) · The owner's D37–D44 batch, one at a time, in the owner's order

- **Order** (owner, at the start): D42 → D41 → D43 → D44 → D40 → D39 → D38 → D37; A90 folded into D43. No parallel agents; one commit per task, each gated on a full `npm test` with `ℹ fail 0` and the client build. Final: **3426 / 3426 / 0** on local `main` `19f1e0c`, **8 commits ahead of `origin/main` (`b093afa`), NOT pushed** — pushing deploys (O76a).
- **⛔ Production reads were refused by the permission layer this session** (`railway ssh`, which worked in 31). Not worked around. What it left unverified is named in each D row and collected in **O76(b)**. The owner then also declined a local migrate-and-tag of a DB copy; D42 was measured instead by running the tagger **in memory, read-only**, over the local board (2,616 rows).
- **Two owner calls, in-session (D42):** (1) the domain dial's "all" = **engineering + data** for an engineering profile — the board is not engineering-only (688 engineering, 219 data, 441 sales, 304 product locally); (2) **domain and sector are different tags** — "a finance job at OpenAI is more of a finance job the user cares about than an SDE role at Fidelity": domain stays the sentence's word, the company's sector is a drawer filter, and **"+ add" moves out of the sentence into the panel**.
- **A89 / D44.1** `4fcfff2` — the session-31 privacy corrections committed, after tracing both cover-letter prompts: the page had said "profile details"; they send none. +1 pinning test (field list).
- **D42** `e57d930` — H1 IN, H2 IN, H3 OUT, H4 IN (see the row): the sector tag, the engineering + data scope, non-US no longer "unknown", "Seattle WA", the strict toggle, the split wording, "+ add" into the panel. +8.
- **D41** `8caefbb` — ALL admits the user's own rows; a capture no longer stars; /d's hard narrowing gone; stated salary kept (three loss points); capture-time logo; no US evidence → refused with two messages. +10. → **A91** (/d's list).
- **D43** `3e9c4f5` — the deletion cause (the cleanup's starred/applied-only exemption), one user-reference predicate on every delete path, migration **129**, orphans rendered as "posting no longer listed". +4. A90 closed.
- **D40** `d8c2f84` — + is the fourth view, the + square gone, the extension page stops listing captures. +6.
- **D39** `f2151b2` — the swap was focus-ordered slots; rigid `SPATIAL_ORDER` now; backdrop / Escape close the most recently opened. +5.
- **D38** `a9a378f` — one `CompanyLink`; the stretched anchor was a flex child / a block; four call sites swept, a ratchet on the rest. +3.
- **D37** `19f1e0c` — the owner's sentence verbatim; one centred column; a 760px bar ceiling, measured headless on the real CSS at four widths. +3.
- **Not done, and why:** browser checks for D37 themes / D38 hit area / D39 boxes (**A92**, needs a signed-in run) · production reads (**O76b**) · `/d` on the board query (**A91**). ⚠ Four times this session a shell `sed -i` or a whole-file rewrite turned a CRLF file LF; each was caught by `file` and converted back before commit — no source-string test was weakened.

### 2026-10-03 (23) · D10–D14, one after the other, in the main tree

- Run sequentially on the owner's "D10 through 14 one after the other"; one commit each, every commit gated on its own suite run's `ℹ fail 0` with new files staged first. Each D has a guard test, mutation-checked (the injected violation restored from saved bytes), and screenshots on stubbed `/api/*` (`scripts/d10d14Shots.mjs`; the D13 popup via `scripts/d13CompanionShots.mjs`).
- **D10** `654d4fd` — renames + two-line labels + 74 px bar / 30 px mark; Job Profiles route-only. **D11** `ff1c92c` — header, `/d` chip, IMPORT + its modal deleted, 3 per row, 50 per page. **D12** `6e823dd` — `/extension`, "+ Add jobs", first-run prompt driven by `GET /api/extension/status`, Saved empty state; store URL null (O55b). **D13** `0fe7226` — the companion popup, `POST /api/import/context`, extension v1.2.0 built (not uploaded), privacy policy + STORE_LISTING updated. **D14** `fd32c2b` — Stopped | Queued 75 / 25.
- ⚠ **Found and fixed:** D12's `/api/extension/status` first shipped as a router's `"/"` route mounted at a full path, which `authRouteGuardManifest`'s scanner cannot see — so it passed "every /api route is classified" unclassified. Now a plain `app.get` handler, and both new routes are in AUTHENTICATED. (The scanner's blind spot itself is unchanged — any `app.use(<full path>, router)` with a `"/"` route would slip the same way.)
- ⚠ **This file changed under the session**: D13 was rewritten as CHOSEN (concept C) and D15, D16 were added while D10–D12 were being built. D13 was built to the new row; D15 and D16 were not started (outside the request). Statuses here were prepended to a fresh read.
- Production re-read at write time: `/api/version` = `0e97dbe` (22b live). Nothing pushed. `npm test` **3168 / 3168 / 0**.

### 2026-10-03 (22b) · D4 addendum measured, D5 and D6 built in parallel

- **D4 addendum** (owner's live call): §3C rewritten as a deliberate correction; `CORRECTIONS_REGISTER.md` +4 numbers rows, +1 reversal; `LIVE_SEARCH_FINDING.md` addendum (its §2 "defect" corrected — Adzuna left the crawl by decision, `4c4ce74`). A read-only agent ran **20 SerpApi searches** (hl/gl set) → `SERPAPI_SLUG_YIELD.md`. `hl=en&gl=us` was already on the one call site; pinned by a test.
- **D5** `effef72` (coordinator, main tree). **D6** `5dad7d0` (agent, own worktree, `npm ci` — no junctions to the main tree), merged `97747f1` clean. The agent's sandbox could not reach draft-android, so the coordinator applied its one-line patch → `195a10a`. Worktree removed (its only junction was npm's own workspace link, removed first).
- `npm test` **3141 / 3141 / 0** after the merge (+9: serpapiLocale 2, recruiterTabRemoved 2, d6DraftNavLabel 5); client builds. Searches spent today: SerpApi 3 + 20 (24 / 250 incl. the owner's 1), Adzuna 1.

### 2026-10-03 (22) · D3 designed and D4 probed — in parallel, nothing built

- Two agents on the owner's ask, disjoint files, neither touched WORKLOG, D1, D2 or A50. Coordinator folded both in.
- **D3** → `docs/BUG_REPORTING.md` (payload field by field, structural privacy, fingerprint, migration-125 sketch, 20 planted-PII tests, retention). Decisions → **O50**.
- **D4** → `docs/LIVE_SEARCH_FINDING.md`. ⛔ §3C does not work as written: Adzuna 50/50 wrapped, SerpApi 0/20 kept-URL ATS hits. The receiving half of the harvest exists; the input does not. Spent: Adzuna 1, SerpApi 3 (3 / 250 this month). Production reads → **O51**.
- No code changed, so no suite run was needed for correctness; the docs were staged before the suite (guards read tracked files).

### 2026-10-03 (21) · The owner's A71–A79 and the assistant's D1/D2 — all built, A76 half-graded

- **A71** `1a2f6ab` — neither a revert nor a broken wire: the A40 breakpoint left 1100–1175px horizontal screens with a lone expanding card. Two panels from 1100 now.
- **A72** `5635c5d` — search was `LIKE %q%` ("ai" matched 2,525 / 2,616). Ranked whole-word tiers, migration 123 (ai/ml aliases, confirmed), title recall 1.000 on 10 terms through the API. Lifts the role scope while searching (O49a).
- **A73** `92d2f3c` — filters were wired; soft-null kept unclassified rows on top (400 of 463 "Remote" rows unclassified) and failed requests were silent. Known matches lead; failures say so. Dead columns: Employment Type, Sponsor-friendly (O49b).
- **A74** `1f9df8e` — the four removals. **A75** `c60ec0c` — "ATS match" sort on the board and the deck (contract 1.5.0); the number waits on A76.
- **A76** `afbbf95` — ⏸ **71 / 230 graded, then the API credit ran out (O48)**. Model vs owner on the 30: ρ 0.855 (engine 0.736). Cutpoints unchanged (no held-out gain).
- **A77** `e240e6b` — per-company stored logos with an evidence rule and a three-source fallback; 22 / 22 on the local copy. ⚠ the first live run would have shown ramp.app's logo for Ramp — caught, fixed, tested.
- **D1** `c6bd112` (closes A78, A79) — bubbles. **D2** `568b556` — the weave.
- ⚠ **`87d2c33` (A71, A72, migration 123) was pushed by someone else and is LIVE** (04:05Z). Everything after it is local — O49. `npm test` **3132 / 3132 / 0**.
- Throwaway server on a copy of the local board (synthetic user `a72probe`); no production data was read or written.


Newest first. ⛔ Agents append here rather than creating a new file.

### 2026-10-03 (20) · F3, F2, and the PDF product made whole

- **F3:** reproduced on three input shapes — the model's classed HTML kept order; plain text and generic HTML did not. Fixed in both formatter copies (byte-identical parsers), +4 tests each; against the old code 3 of 4 red.
- **The owner's correction mid-session:** Resume Master offers Word, Excel, OCR and flatten-compress; the limits were draft's contract. Built in `src/pdf-toolkit` (office.js for OOXML via fflate; render.js for OCR and flatten), served self-hosted. Caught on the way: pdf.js fills word gaps with whitespace items as wide as the gap (every column joined until skipped); the 10.9 MB legacy language set was served first (corrected to the 2.9 MB LSTM set); tesseract's ESM build has only a default export; my first "scan" fixture was black-on-black (headless Chrome's dark background) and was replaced by a realistic grainy JPEG scan; a new test hung the suite on unread response bodies.
- **F2:** the poll route's dead state removed; the profile-facts log made live (a test had pinned a log line that never ran).
- Suites: Resume Master **299 / 299 / 0**, draft **3092 / 3092 / 0**. Nothing pushed — the owner's go.

### 2026-10-03 (19b) · The owner's answers: look C with a static sky; the PDF tools are Resume Master's alone

- **The PDF tools left draft** (`02bbca0`): the package, `/tools/pdf`, the tools-nav link, the wrapper, its test, and both libraries — `git diff 9bb1d80^` over the dependency files, `App.jsx` and `ScrollDock.jsx` is empty; 3105 → 3088. Resume Master owns the toolkit as `src/pdf-toolkit` (`c212a04`); the vendoring checksum test went with the copy.
- **A68, look C** (`21c8520`), rebuilt from the 09-21 source, not imitated: the stamp's exact box, border, tilt and type; the old site's own font files (DM Sans, Barlow Condensed incl. 800 italic, Instrument Serif), OFL, self-hosted; the glass bar and cards; the night. **The sky is a generated SVG star field** (seeded PRNG) — the hotlinked video is not used and a test refuses any video or CDN reference. **The accent is one variable**, Lemon until the owner picks from the four the old site offered.
- **A69's product pages:** `/pdf/` and ten pages named for what people search (merge, compress, split, organize, watermark, protect, unlock, JPG→PDF, PDF→JPG, PDF→text), each opening its own tool; sitemap, robots (the site in, `/v1/` and `/mcp` out), a stamp favicon. Every tool re-run end to end on `/pdf/merge-pdf/`: zero request bodies.
- Shared header/footer generated into every page; a phone gets a Menu; the home page follows `/#tool` and `/#dialog`. Looked at: home, hub, a tool page and privacy at 1440 and 390 — no error, no failed or third-party request, no overflow. Injected: a video, an untilted stamp, a hand-edited generated page, a second accent — each red. Commits gated on the run's own fail count, files staged first.

### 2026-10-03 (19) · A68–A70: the old look found (owner's call), the PDF toolkit, PDF → text free

Sequential, main trees. draft **3105 / 3105 / 0**; Resume Master **285 / 285 / 0**. The owner pushed session 18 (`0e8bdd9` live). Committed the owner's A68–A70 rows as written (`cef3730`), then the F## rule into CLAUDE.md + the header, A66/A67 → F1/F2 (`d171491`).

- **A70 first** (it sits in front of A69): the site's PDF → text was a Sonnet document call at 1 credit — case (a). Built the deterministic reader on pdf.js and made the site route free/anonymous with a daily ceiling; the token API left on the model (O16e). Measured on Chrome-printed PDFs; the one oddity (a later role's header above an earlier role's bullets) is the FORMATTER's own output → **F3**. Injected: no column split, no OCR flag, the cost entry back — each red; the two column guards cover each other (both off: red).
- **A69:** `packages/pdf-toolkit` in draft, vendored into Resume Master (A65's pattern); A70's reader moved into it so server and browser share the file. Verified before building on it: @cantoo/pdf-lib encrypts (AES-256), refuses a wrong password, and decrypts to a file with no `/Encrypt`. A correctness catch while writing compress: a canvas only re-encodes RGB, so CMYK/grey pictures are left alone (tested). End to end on BOTH built sites in Chrome: every tool, no page error, no overflow at 390, **zero request bodies**. Found and fixed on the way: a missing `/lib/…` file answered 500 (now the JSON 404); the contract's route table rejected `/lib` as routes (now static middleware); the lede and the component repeated the promise (now once).
- **A68 — stopped at the checkpoint, as the row asks.** Rebuilt three eras from history with `git archive` exports (no worktrees, no junctions), served and shot them. The white boxed logo is `StampLogo` (C, 05-30 → 09-22). Two owner questions in the row: the hotlinked third-party video and the random accent.
- ⛔ **Self-inflicted, fixed before any push:** `9bb1d80` (and the WORKLOG commit after it) went in with `brandAndOriginGuard` RED — seven new A69 files named the tools service by its legacy name in comments. The pre-commit run was green because the guard reads TRACKED files and they were untracked: the `d3c5333` trap again. Fixed in `aa3f020` (re-vendored `ce2ecf8`); commits are now gated on the run's own fail count.
- ⚠ **Resume Master's next push is its first with the PDF libraries.** No Docker here; the only native piece is pdf.js's optional `@napi-rs/canvas` (prebuilt linux-x64). Read the deploy.

### 2026-10-02 (18) · The 17e pushes confirmed live; the follow-ups the agent could do

Run sequentially in the main trees. draft **3088 / 3088 / 0**; draft-android JVM **58 / 58 / 0**. Every change: tests, an injected violation seen red, full suite, client build; UI looked at in a real browser.

- **Live, re-measured 20:52Z:** draft `143569e` (contract 1.3.0, 128 applied); Resume Master `6415646`, `accounts: true` — A65's store is on. The repo is private (API 404). **6 draft commits are local** — the owner's go pushes them.
- **A58 follow-up (`2e4ada0`):** `scrapeJobs` + `scrapeHarvestAPI` + their helpers and imports deleted (−622 lines of `server.js`, byte-preserving, CRLF kept). ⛔ It could not have run: `ApifyClient` was never imported. Ten test files quoted its source; each narrowed to what still exists, two became absence guards (seen red with the code put back), two removed with a note. Found → **A66**, **A67**; `apify-client` has no importer.
- **A62 follow-up (`072fbe4`):** a capture the US gate held is `is_active = 0` like an expired listing, so Saved said NO LONGER LISTED. Now `held_outside_us` (the gate's own `out_of_market:` record) → `Job.heldOutsideUs` → OUTSIDE THE US. Contract **1.3.0 → 1.4.0**, additive, `contract/` regenerated; HANDOFF says so.
- ⛔ **`npm test` was writing fake "spend not recorded" into the developer's real sink (`11eb61f`).** Found booting a throwaway server: a fresh DB came up with `recovered=6863`. `trackingFailureSink` ignored `RM_DATA_DIR` and tests fail usage writes on purpose — one run appended 109 lines; a local boot then imported them as `sink_recovered` failures. All 6,863 were fixtures; nothing real lost; production unaffected (it never runs tests). Fixed: a `--import` preload gives each test process a temp sink; the sink follows `RM_DATA_DIR`. ⚠ The throwaway boot DRAINED the developer's `data/usage-tracking-failures.jsonl` into the throwaway DB (job scratchpad) — that file is gone from `data/`; its contents were the fixtures above.
- **Admin, first look in a browser (A50/A61):** the real server on a throwaway DB (`RM_DATA_DIR`, every paid key blanked; it crawled the public ATS boards on boot — free), a synthetic admin, every tab at 1440 light/dark + 390 → `draft-screenshots/s18-admin`. No page errors, no failed call. Fixed `lastRun: [object Object]` + the panel pinned left (`243962e`) and Pipeline Health labelling held/inactive rows UNENRICHED (`a94c34d` — first committed with two fixture tests red and "suite green" in the message; caught on the next run, fixed and the local commit amended before anything was pushed).
- **A33 in a browser (`90f2360`):** synthetic person, Profile › Fill from your résumé: the common one-line education entry put the degree in University and "Texas at Austin" in Field. Fixed by reading each field from its own part of the line; six shapes pinned.
- **draft-android (`c8aaea4`, local):** a refused swipe takes its optimistic badge down (A14's last item).
- **Not done, and why:** A35 (extension revamp) stays held — its row ties it to A36 for one store submission, A36 waits on O12, and the store screenshots need the owner's real profile. K3 stays held (17b). The rest is owner-gated as listed in NOW (17b).

### 2026-10-02 (17e) · A65 — Resume Master's store switched on, with draft's backup policy

- **One policy, not two.** draft's `scripts/backup.js` moved unchanged into `packages/sqlite-backup` (`@draft/sqlite-backup`), its paths set by `configureBackups({ dataDir, dbFile, filePrefix })`; `scripts/backup.js` is now a wrapper that points it at `data/` and keeps the CLI. Resume Master vendors a checksummed copy (`vendor/sqlite-backup`), as it does the scorer. draft's behaviour unchanged: the backup tests read the package source. ⚠ `12dfd1b` named the legacy brand in the package prose and went in with `brandAndOriginGuard` red — fixed in `234f89a`.
- **Resume Master:** the store opens at `RAILWAY_VOLUME_MOUNT_PATH/resume-master.db` (`RM_DB_PATH` still overrides). With a store: the hourly purge, and a backup daily at 02:00 UTC — ⛔ never at boot. Admin `GET/POST /v1/site/admin/backups`; `scripts/backup.mjs list|verify|create|restore` (restore takes a pre-restore copy). The migrations table is now `schema_migrations`, the table the policy's verify reads.
- **Pinning vs the 90-day expiry (the owner's "decide"):** decided — a pinned document is kept until unpinned or deleted, at most 20 per user; unpinning restarts its 90 days (an unpin never silently deletes). Migration `004_artifact_pins`; `POST /v1/site/documents/:id/pin`; the account page has Pin/Unpin.
- **Space:** stored documents are text/HTML (a PDF is printed by the browser, never stored), 2 MB each, 200 per user; a save is REFUSED (`storage_full`) when the volume would drop below max(64 MB, 15 %), so the database and its backups keep room. The site says why a save was refused.
- **PRIVACY.md:** pins, and backups stated honestly — a deleted document can remain inside a backup copy until it rotates out (≤ 30 copies).
- Tests: Resume Master **260 / 260 / 0** (+9 `storeA65`, incl. the vendored checksums); draft **3081 / 3081 / 0**.
- ⛔ **Not deployed by this entry's commits alone:** pushing Resume Master is the first boot with the store on the `resume-master-data` volume — user data starts to exist from then, and `/v1/site/config` reads `accounts: true`.

### 2026-10-02 (17d) · A64 — the company stack registry audited; both repos pushed and live

- ⛔ **Premise corrected first:** the header said the registry is "used by classifier.js and the generation model to enforce company authenticity". Nothing does. Its one reader is `@draft/ats-scorer` (vocabulary.js → scorer.js `candidateTermsFromJob`), which admits a company's stack term as a skill only when that company's own posting names it and the ambiguity guard passes. Measured: 288 of 565 stack terms add anything beyond the global vocabulary; Stripe, Airbnb and Spotify are the only registry companies on the local board, and 5 of their marginal terms ever matched. `notStack` had no reader.
- **Stripe** said GCP/Pub/Sub/BigQuery/GKE/Dataflow with notStack "AWS Lambda": AWS's own case study and engineering blog describe Stripe on AWS; Stripe writes mostly Ruby (Sorbet), with Java and Go. Corrected with sources. Airbnb and Spotify sourced; unsupported terms dropped. `notStack` removed everywhere. `scripts/a64RegistryAudit.mjs` applies it; `registry/` mirror synced; checksums rewritten; Resume Master re-vendored. ρ unchanged (0.746).
- The owner's storage-and-backup note (committed `83a6ee7`) had landed inside the A57 row and split it; the row is rejoined and the note sits, unchanged, under that table, with its status: volumes renamed/created (owner) → **A65**.

### 2026-10-02 (17) · The "next session" list, in order — A59 → A63 → A61 → A62 → A54–A57 → A53/A52 follow-ups → A50 4–7

Run sequentially in the main trees (no parallel agents). draft **3072 / 3072 / 0**; Resume Master **250 / 250 / 0**. Every task: tests with injected violations, full suite, client build; UI looked at in a real browser where a fixture exists.

⚠ **Production moved under the session:** `origin/main` became `e9fd9c3` (A59–A62, migrations 120–122) — **the agent ran no push**; `/api/version` 18:23Z confirms it live and healthy, new routes gated. 8 later commits are local. Resume Master is NOT pushed.

#### A59 · The line (`0040f1e`)
- A run over `APPLY_MAX_ACTIVE_RUNS_PER_USER` is admitted `waiting` with a `line_position`; it also waits behind a non-empty line (nothing jumps). Every other admission check runs at Draft time. `dispatchLine` starts the head only (synchronous claim), from `processRun`'s finally and a 30 s unref'd ticker.
- Editable until it starts: tool (A+ gated; an approved run is locked), whole-order reorder (stale → 409), remove a run or one job; after start → 409 `run_started`. Undo on a waiting Draft cancels the run.
- ⛔ Kill switch holds the line. Boot: `recoverInterruptedRuns` — a `running` job becomes failed/`interrupted_by_restart` (honest about whether it could have submitted), never-started jobs resume, lines move.
- The twelve `scripts/` harnesses gained `line_position` (harnessSchemaCoverage). Auto Apply "Waiting in line"; toast "waits in line (2 of 3)".

#### A63 · Board tools reshaped (`1a3b123`)
- ⛔ **Found:** the board's Apply POSTed `/api/apply` with `mode:"semi"`, which the route ignored — it recorded the job as APPLIED on the click; nothing opened. Exporting a PDF did the same via `/api/applications`. And the automation's real submits never wrote `job_applications` at all (why A47's path "never fired").
- (1) company name = apply link; KB on the logo. (2) `services/draftSlots.js`: one 10/24 h allowance for Drafts and NEW résumés, refused at zero, shown before pressing — ⚠ **O46**. (3) `application_records`: pending (generated / opened / exported / manual) → recorded → **verified** (statement + plausible date + one piece of evidence matching THIS employer) → `job_applications`; the pipeline's verified submits go the same way. It proves the statement and the evidence's match, not receipt — the UI says so. Database "Pending Apply" is the table.

#### A61 (`e9aff67`) · A62 (`e9fd9c3`)
- A61: Operations-tab enrichment card; confirm states cost ceiling, 100/request cap and the nightly budget (a manual run is NOT counted against it).
- A62: `ingestJob` is the one gateway (dedup + canonical write + US gate + `job_captures` with ATS slug); admin NDJSON export/import, dry by default, revertible batches.

#### Resume Master — A57 (`3e48123`), A54 (`5ab72ff`), A55 (`40614e4`) — LOCAL
- A57: store optional (`RM_DB_PATH`), accounts, ledger with economics blank, debit on success, opt-in output storage 90 days; token API untouched and proven so.
- A54: the site at `/` (old cinematic look, self-hosted fonts, no third-party request), four complete tool flows + account; privacy page renders `docs/PRIVACY.md`. Shots: `draft-screenshots/a54-rm-site`.
- A55: outsider walk; legible errors; limits policy (off). ⛔ The token policy (O16c) is the real blocker.

#### Follow-ups
- A53 (`8027e87`): font tokens truthful (DM Sans), Inter import dropped; FAQ/features vocabulary; the avatar-over-tabs defect at 390.
- A52 (`b9d002c`): rescore on enrichment; no stale stamp at apply (a missing posting still stamps); experience summary once; ScrollDock clearance.
- A50 4–7: company list (probe → add, harvest suggestions, audit log), Job Trace lifecycle, restyle (bands, not the v3 70/50 ramp), tools-service card. ⛔ `d3c5333` was committed with brandAndOriginGuard red (the legacy name in the admin card) — fixed in `68beb18`; the full suite is now run before every commit.
- `CORRECTIONS_REGISTER.md` gains "Decisions deliberately reversed" (A57, A54, A59, A63).
- ⚠ Self-inflicted, repaired: a mutation check restored `routes/enrichment.js` with `git checkout`, discarding the uncommitted A61 edit; re-applied before commit.

### 2026-10-02 (16) · A49, A50, A52 merged and pushed; A53 and A58 parked on branches

Run IN PARALLEL on the owner's ask, one worktree per agent (own ports, own migration number, real `npm install`,
no junctions), no agent editing this file. Three agents hit the session limit mid-flight; their uncommitted work was
backed up and each was resumed from its transcript. **`main` = 2987 / 2987 / 0.** The owner ended the session after
the push: A53 and A58 stay on their branches.

**Premises corrected at the start:** A51 (`a56e931`) and the session-15 docs were ALREADY pushed — `origin/main` and
production were `876da3d` (`/api/version`, started 04:29Z). The repo read public on one unauthenticated call and 404
(private) on the re-check minutes later; it is private.

#### A52 · The "No signal" / "Strong match" disagreement — a SECOND defect, and one report component
- **Cause:** `ats_only_reports.basis_hash` (110) covers the CANDIDATE side only. Nothing on the posting side —
  enrichment landing `skills_json`, a re-crawl, a fetch-on-open — made a stored score stale, so a posting scored before
  enrichment kept that verdict forever and the precompute called it fresh. The board card read the stored score; the
  panel scored fresh. The literal "No signal" was `JobDetailPanel`'s header chip printing it for any null.
- **A48 stands:** its 537 / 2,616 is a FRESH measurement (reproduced for both synthetic profiles); none of it is a stale
  read. ⚠ But what a stored board SHOWS is worse — reproduced through the real server on scratch copies (local
  `ats_only_reports` has 0 rows, so: strip enrichment → boot old code → restore → old plan calls all 2,616 fresh):

  | per profile | p5 | p6 |
  |---|---|---|
  | stored "not enough signal", fresh scores | 238 | 238 |
  | wrong band | 63 | 277 |
  | stored declined / fresh declined | 775 (29.6%) / 537 (20.5%) | same |

- **Fix:** migration **118** `job_hash` over the columns the scorer reads; a row is fresh only when BOTH hashes match
  (NULL = stale); precompute rescores changed postings (801 flagged per profile in the reproduction; 0 mismatches
  after one pass); the board hides a stale stored score ("Check match"), the deck never deals on one; the crawl scorer
  scores the stored row, not its thin in-memory item; generated-résumé reports carry `report_basis`.
- **One component:** A40 had already put the board's `ATSPanel` in the deck panel and the sheet. Left: `/tools/ats` drew
  its own (already drifted thinner — no competencies, generic language or matched verbs), the signup hook its own band
  card, the deck its own adapter. Now `client/src/components/AtsReport.jsx` is the ONLY file that draws a report;
  `atsReportOneImplementation` refuses a second (StampLogo-style). 15 injected violations red. +10 tests.
- **Open:** O19b is the only remaining stored/fresh split · the board's SORT can use a stale score until the next pass ·
  nothing triggers a rescore when enrichment finishes · `routes/apply.js` reads the stored report without `job_hash` ·
  on `/tools/ats` the ScrollDock overlaps the report's top · the experience summary renders twice (pre-existing).

#### A49 · Dedup fixes 1–5 (migration 116)
- **#1** a req id is namespaced by the ATS that HOSTS the posting (`atsPostingIdentity`), so an aggregator's or a second
  ATS's copy merges; across namespaces the fingerprint decides, and >1 candidate refuses to merge.
- **#4** wider than audited: a Save on a folded live-search result was deleted by the orphan cascade. Retirement now moves
  Saves, Passes, applications, résumés and views to the canonical row (`services/jobs/dedupRetire.js`); restorable,
  and a restored pair is kept apart. An import that matches attaches and says so.
- **#2** fingerprint keys on the PLACE (A37's split; a state filled only for an unambiguous city). 1,624 US rows with
  simulated copies: "City, ST" 35% → 99%, "City, State" 5% → 99%, ", Inc." / " - Remote" 0 → 99.7%; **merged into a
  different city: 0 → 0**; one-role-several-cities groups collapsed: 0.
- **#3** live-search and LinkedIn write-back carry the donated description/salary. ⛔ Premise corrected: those two writers
  do NOT go through `upsertCanonicalJob` (they use `reconcileFingerprint`, the one deduper) — left so.
- **#5** a retired duplicate survives expiry while its canonical exists. ⛔ **Second deleting path found:** `runCacheCleanup`
  hard-deleted every row past the cutoff on a 24h timer — starred and applied included, no brake, no `cleanup_log` —
  now it calls the guarded `runExpiredJobsCleanup`.
- #6 (recommendation): move `import` last; keep `jobo` at provider tier. +30 tests.
- **O43 — the production re-measure** (read-only; after deploy `latestApplied` should be `118_ats_reports_job_hash`):
  ```sql
  SELECT source, is_active, COUNT(*) FROM scraped_jobs GROUP BY source, is_active;
  -- #1 exposure: active pairs, same fingerprint, req ids in different namespaces
  SELECT a.job_id, a.req_uid, b.job_id, b.req_uid FROM scraped_jobs a JOIN scraped_jobs b
    ON a.fingerprint = b.fingerprint AND a.job_id < b.job_id
   WHERE a.is_active = 1 AND b.is_active = 1 AND a.req_uid IS NOT NULL AND b.req_uid IS NOT NULL
     AND substr(a.req_uid, 1, instr(a.req_uid, ':') - 1) != substr(b.req_uid, 1, instr(b.req_uid, ':') - 1);
  -- #4 exposure: user state stranded on demoted rows, and orphans
  SELECT COUNT(*), SUM(uj.starred), SUM(uj.disliked), SUM(uj.applied) FROM user_jobs uj
    JOIN scraped_jobs d ON d.job_id = uj.job_id
   WHERE d.is_active = 0 AND EXISTS (SELECT 1 FROM scraped_jobs c
         WHERE c.fingerprint = d.fingerprint AND c.is_active = 1 AND c.job_id != d.job_id);
  SELECT COUNT(*) FROM user_jobs WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs);
  SELECT COUNT(*) FROM job_applications WHERE job_id NOT IN (SELECT job_id FROM scraped_jobs);
  -- #3 write-back rows missing description or pay
  SELECT source, COUNT(*), SUM(description IS NULL), SUM(salary_min IS NULL AND salary_min_usd IS NULL)
    FROM scraped_jobs WHERE source IN ('adzuna', 'serpapi', 'LinkedIn', 'jobo', 'import') GROUP BY source;
  -- #5 and after deploy
  SELECT * FROM cleanup_log ORDER BY id DESC LIMIT 10;
  SELECT retired_reason, COUNT(*) FROM scraped_jobs WHERE duplicate_of IS NOT NULL GROUP BY 1;
  SELECT COUNT(*), SUM(restored_at IS NOT NULL) FROM job_dedup_log;
  ```
  Fingerprint before/after on production data: `node scripts/a49FingerprintMeasure.mjs <copy of the production DB>`.

#### A50 · Admin panel, steps 1–4
- **Wrong numbers fixed:** "Jobs Scraped" → "Postings Discovered" (`discovered_at`, crawl runs, failures; "—" when unknown);
  the ledger shows Result / `error_text` and "N of M FAILED"; Backups copy states the byte budget (test reads `backup.js`);
  "A+ Resume: ON" → "A+ override" — ⚠ worse than recorded: with monetisation on, a user below PRO gets 403 from
  Generate; stale banners and "Lucy" labels gone.
- **Operations tab:** `/api/version`, kill switch (three states, consequences), board-fit precompute (dry run first;
  **defect fixed:** the dry run dropped `force`), `/spend`, per-user applications.
- **"Today" glance** (`GET /api/admin/glance`) reads `pipelineHealth()` itself; every section says when it was measured.
- **Audit — two A51-level harms** (→ A58): Delete user can delete `system` (id 0) and cascade the background ledger;
  Job Review Save/Hide rewrites every user's Saves and Passes for the job, unrecoverably, and "Hide" un-hides. Risky:
  restore skips the WAL checkpoint, Revert batch skips the dry run, Re-tag Pool (pre-pivot), the dead `force-scrape`.
  +11 tests, 9 injected red.

#### A53 · Vocabulary (on its branch, not merged)
- ⛔ **Premise corrected:** the six buttons are on `JobDetailPanel`, not the card; and **"Queue Auto" was NOT the deck's
  Draft** — it filled an in-memory basket lost on reload, sent later as one batch from Auto Apply. Save/Pass on the
  board were TOGGLES (a retry silently undid a decision); the deck SETS.
- **Owner decisions, 10-02:** Queue Auto → **Draft, same behaviour** (immediate `POST /api/apply/runs`, basket removed) ·
  Save and Pass **set, never toggle** · **Undo like the deck's** (shared `DecisionToast`). Built in `f8279fe`
  (`lib/jobDecisions.js` = the one set of calls), 2950 green on the branch. **Bug fixed:** a draft awaiting review could
  be drafted again (another preview run each time).
- **Why it is not merged:** a second Draft while a run is active is 429 (O44) — the board now reaches it too. The styling
  sweep (`1f43fa8`: `type.js`, `.rm-btn` → the deck's pill — restyles the admin pages too — glass sheets off, a 390px
  card-grid overflow fixed) is WIP; full suite not re-run, ~8 of 56 after-shots looked at.
- Also: the signed-in app renders DM Sans, not Inter (`cinematic.js` overrides `index.css`) — left alone.

#### A58 · Admin stop-the-harm II — merged in 16b (see the queue row)

#### 16b · "Push everything to main"
- A58 merged (`d4488d6`; 116/118/119 kept in order in both runners, CRLF preserved; ARCHITECTURE/HANDOFF counts → 119), A53 merged cleanly. First full run **3022 / 3025** — three integration failures, none a logic defect: an admin fixture without 119's table and columns, a privacy-doc citation of the removed force-scrape (Apify is now reached by NO code path), and bare-`indexOf` anchors in the new tests. Fixed in `b86b057`; **3025 / 3025 / 0**, build clean.
- The earlier refusal to push the two branches is moot: they are on `main`.

#### Coordinator
- **The two known flakes fixed at their cause** (`888f84c`): `sealedSessionSweep` removed its temp dir before
  node-sqlite3's ASYNC close finished (Windows EPERM) — the hook now awaits it, 8/8; `accountSecurity` refused a bare
  `42`, which random ciphertext contains ~1.7% of the time — now `"user":42`.
- **A50 × A52 integration:** A50's board-fit dry-run fixture predated `job_hash` (SQLITE_ERROR after the merge) — the fixture now carries the posting columns and the real hash (`7882b18`); both assertions unchanged.
- Merge conflicts: 116 and 118 added at the same spot in both runners — resolved byte-preserving (CRLF kept); the
  ARCHITECTURE count of defined migrations → 118.
- The owner's session left A54–A57 and a `PRODUCT_MODEL.md` reversal uncommitted in the main tree; backed up, kept, and
  committed with this entry.


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
| 2026-10-06 | **The domain dial's "all" is engineering + data for an engineering profile** (owner, D42) — not "no scope" (the board is not engineering-only); any other profile keeps its declared bucket. `ROLE_SCOPE_EXTRA` |
| 2026-10-06 | **Domain and sector are different tags** (owner, D42): the job's DOMAIN (its kind of work) is the sentence's word; the employer's SECTOR is a drawer filter, read from a closed company list, never guessed. And **"+ add" lives in the panel a word opens, not in the sentence** |
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

## QUEUED — added by the ASSISTANT, 2026-10-02 (session 18)

⚠ **Numbered A68–A70 because the agent took A66 and A67 in session 18.** ⛔ This is exactly the
collision the numbering rule exists to prevent — see the note at the end of this section.

| | Task | Notes |
|---|---|---|
| **A68** | **RESUME MASTER'S LOOK — the OLD site, not an interpretation of it** | ✅ **DONE and LIVE 10-03 (19c), Resume Master `28818eb` — look C, a static sky, the accent SKY BLUE `#A8D8EA` (owner's pick).** Was: ✅ **BUILT 10-03 (19b), Resume Master `21c8520`, LOCAL — owner chose C, a STATIC sky; ⏸ the owner picks the accent** (`--accent` in `public/site.css`; Lemon until then). Header, footer, PDF pages and sitemap generated by `scripts/site/buildSite.mjs` (a test fails if stale); `public/sky.svg` generated by a seeded PRNG — no video, nothing third-party. Shots: `draft-screenshots/a68-rm-look-c`. Was: ⏸ **AT THE CHECKPOINT 10-03 (19) — the owner chooses before any restyle.** Found in history and rebuilt (client exported with `git archive`, built, served, shot — `draft-screenshots/a68-resume-master-eras/`): **A** `60d6539` (before 05-19): light, green, a rounded icon + "Resume Master" wordmark — no stamp. **B** `1904af3` (05-19): light; the white stamp on a coloured shadow rectangle. **C** `75ce355` (09-21, the last Resume Master build; the look from 05-30): ⭐ **the white boxed logo** — `StampLogo`: white box, 2.5 px black border, rotated −2°, "RESUMEMASTER" in Barlow Condensed 800 italic capitals, collapsing to "RM" on scroll — over an animated night-sky illustration (people reading among books and flowers), glass search bar, serif numbered cards, DM Sans body. **Recommendation: C.** ⛔ **Two things only the owner can settle:** (1) C's background is a VIDEO **hotlinked from a third-party CloudFront URL** (`…/user_…/hf_20260314_….mp4`, an AI-video service's account) — bringing it back means self-hosting it (the site makes no third-party request) and **confirming you hold the rights**; (2) C had **no fixed accent** — a random one per session (`rm_session_accent`: light blue, yellow, …, deleted in UI step 2) — pick one. ⏸ Owner, 10-02, after seeing A54. A54 shipped *"the old night-blue cinematic look + Instrument Serif/Inter + glass"*. ⛔ **That is not what the owner meant.** They want **the actual previous Resume Master site** — its styling, and specifically **the WHITE BOXED LOGO**. ⛔ **Do not interpret "old" — go and find it.** The assets are in git history: walk back through `client/` before the rebrand sweep (the P2/P3 commits, and `StampLogo`'s three pre-collapse implementations) and recover the real background, type, spacing and boxed-logo treatment. ⚠ **Show the owner what you found BEFORE restyling** — there were several looks across the Resume Master era and picking the wrong one twice is worse than asking. ⭐ Keep from A54: self-hosted fonts, no third-party request, the full end-to-end flows, the privacy page. ⚠ Still a **sibling** of draft — but it should look like **what Resume Master was**, not like draft in a different palette |
| **A69** | ⭐⭐ **A PDF TOOLKIT — and the best version of it beats SmallPDF** | ✅ **TIER 2 DONE 10-03 (20), Resume Master `6d58ea7`, LOCAL — owner: "these lines only apply to draft contract, resume master itself should have them all".** PDF → Word (.docx: headings, paragraphs, page breaks) · PDF → Excel (.xlsx: columns from aligned text, numbers numeric) · OCR (tesseract.js, self-hosted, English LSTM data 2.9 MB; text + a searchable PDF) · Compress → Maximum (pages become pictures, warned). Pages `/pdf/pdf-to-word/`, `/pdf/pdf-to-excel/`, `/pdf/ocr-pdf/`; the "do not do" list is gone. Verified in a browser: valid Office files, OCR 95 % on a realistic scan, zero request bodies. ✅ **DONE 10-03 (19b) as an INDEPENDENT Resume Master product (owner: "not designed for draft")** — Resume Master `c212a04` (the toolkit is its own source, `src/pdf-toolkit`) + `21c8520` (`/pdf/` hub and ten tool pages titled for search, canonical/og tags, sitemap.xml, robots.txt); draft `02bbca0` removed every trace from draft. Tier 2 (Word/Excel, OCR) stays NOT offered, as this row plans. The draft-only items below ("inherited by draft", the upload-cap hook) are void. Was: ✅ **TIER 1 DONE 10-03 (19) — draft `9bb1d80` `9df5a6d`, Resume Master `5626a89`, LOCAL.** `packages/pdf-toolkit` (@draft/pdf-toolkit): merge · split · organise (reorder/rotate/delete with thumbnails) · compress · watermark · protect (AES-256) · unlock · images → PDF · PDF → images · PDF → text — **in the browser; no request carries the file** (verified end to end on both sites: zero request bodies). Compress shrinks the RGB JPEG pictures and leaves text untouched (2.6 MB → 206 KB in the test); compress-by-flattening is listed as NOT offered because it would blind an ATS. Word/Excel and OCR: NOT offered, said on the page. ONE component: draft mounts it (`/tools/pdf`, tools nav), Resume Master vendors it with checksums (PDF tab); a test refuses a second client copy. Libraries: @cantoo/pdf-lib (the maintained fork with encryption) + pdf.js, self-hosted. ⚠ Not done: the apply-flow hook (offer Compress when a portal rejects an upload size) — no portal size error is captured today. ⏸ Queued 10-02 by the owner: *"everything SmallPDF provides"*, on Resume Master, **inherited by draft**. ⛔ **"Everything they provide" is a company, not a task — split it.** ⭐ **TIER 1, DETERMINISTIC, FREE, ZERO MODEL CALLS:** merge · split · extract pages · reorder · rotate · delete · compress · watermark · password protect/remove · images→PDF · PDF→images. Library work (`pdf-lib`, `pdf.js`). **No marginal cost, so free and ungated** — the same argument that made ATS scoring free. ⚠ **TIER 2, GENUINELY HARD:** PDF→Word/Excel with real fidelity, and OCR. ⛔ **Do not promise these — say plainly what is not offered** rather than shipping a bad converter. ⭐⭐ **THE IDEA THAT BEATS SMALLPDF: run Tier 1 ENTIRELY IN THE BROWSER.** `pdf-lib` works client-side, so **the file never leaves the user's machine** — no upload, no storage, no account, no credit, nothing to breach. **SmallPDF uploads your file to their servers; this would not.** ⭐ It also restores part of the trust story A57 cost us. **WHY IT IS WORTH DOING:** (a) *merge pdf* / *compress pdf* are enormous search categories — real acquisition for a product with **zero users** · (b) ⭐ **it serves draft's apply flow: ATS portals routinely CAP UPLOAD SIZE**, and compress is the fix for a problem candidates actually hit · (c) merging a cover letter onto a résumé is a one-click thing people do by hand · (d) it makes **O16e** worth building. ⛔ **Inherit into draft as the SAME component, not a copy** — A52's lesson, and StampLogo's before it |
| **A70** | ⛔ **PDF→TEXT MUST NOT COST A CREDIT** | ✅ **10-03 (19b):** also on `/pdf/pdf-to-text/`, in the browser; the reader lives in `src/pdf-toolkit/pdfText.js` with the server route reading the same file. The token API's model path is draft's résumé-upload endpoint, not a PDF product — unchanged. ✅ **DONE 10-03 (19), Resume Master `114bfcd`, LOCAL.** **Why it was priced: case (a)** — the site sent the whole PDF to Sonnet as a document; what the model did that a library cannot is read SCANS (vision) and guess reading order on odd layouts. Now: a deterministic text-layer reader (pdf.js; lines, paragraphs, two columns left then right; a scan → `needsOcr` with a sentence, never charged), free, anonymous, a per-IP rate + daily ceiling (`RM_PDF_TEXT_PER_DAY`, 100), the cost entry and every credit mention gone, and a test that fails if a debit, `paid()` or a model call returns. ⛔ **Not changed — the owner's call (O16e):** the TOKEN API's `/v1/resumes/parse-pdf` (draft's résumé upload) still uses the model. Measured on Chrome-printed résumés (plain, two-column, the formatter's own output) the reader is faithful; switching draft's upload to it would drop the cost and OCR — recommend switching with a scan fallback message. ⏸ Owner decision, 10-02. A54 prices it at **1 credit**. ⛔ **It costs nothing to run and must be free and ungated.** ⛔ **ESTABLISH WHY IT IS PRICED BEFORE CHANGING IT — three possibilities, three different fixes:** **(a)** it calls a model to parse → **O16e is the real task**: build the local deterministic extractor, and the credit disappears as a consequence. ⚠ Report what the model is actually doing that a library cannot — the answer may be *nothing*. **(b)** it is already deterministic and the debit is a leftover from the ledger being wired per-route by default → remove the debit. **(c)** it falls back to a model only for scanned PDFs with no text layer → ⭐ **free for the deterministic path, and SAY the file needs OCR** rather than silently charging. ⛔ **Read the route; do not guess.** **THEN:** free, ungated, anonymous — the same standing as ATS scoring, for the same reason: **zero model calls means nothing to meter.** Remove the debit, its 402 path, and any copy mentioning a cost. ⚠ **Keep a per-day ceiling** — free is not unbounded, and an anonymous endpoint with none is the `/api/standalone/generate` shape. ⛔ **A test that fails if a debit is reintroduced on this route** — the ledger wires debits by route, so the next person adding one will not otherwise notice. ⚠ **Sits in front of A69** — shipping a deterministic free toolkit beside a parser that charges for a library call contradicts itself on one page |

⛔ **NUMBERING — this collided in session 18 and will again.** The **A## sequence belongs to the
owner and the chat assistant.** ⭐ **Agent-raised findings get their own letter, `F##`**, numbered
independently. The agent may mark an A row done, correct its facts, or flag it wrong — it may not
extend the sequence. **A66/A67 were agent-created and forced these three to renumber; the same thing
happened at A51/A52.** Record the rule in `CLAUDE.md` and this file's header.

---

## QUEUED — added by the OWNER, 2026-10-03 (session 21; ids A71–A79)

Words are the owner's; run order as listed. ⛔ A75's displayed number waits on A76; its sort does not.

| | Task | Notes |
|---|---|---|
| **A71** | ⛔ **REGRESSION: the ATS panel on the draft page does not open** — reverted to the single-expandable-panel version | ✅ **DONE 10-03 (21), `1a2f6ab`, LOCAL — neither a revert NOR a broken wire: the A40 breakpoint.** Production serves `3141123` = origin/main (index.html max-age=0, no service worker, the live bundle carries the two-panel code); the exact live bundle with only `/api/*` stubbed opens two panels at 1440 and 1280. But the horizontal deck starts at **1100** and two panels started at **1176**: from 1100 to 1175 (a zoomed or unmaximised window) a click on the card expanded the HORIZONTAL card alone, which is the pre-A40 look, and the report opened only from the signal line. Fix: two panels from 1100 (columns ≥ 522); below 1100 the vertical fan + sheet, unchanged. Checked in a browser at 1100–1176, no sideways scroll; test red with the old value. Shots: `draft-screenshots/a71-deck-two-panel/`. ⚠ The owner's actual window width was not measured; if it is ≥ 1176, say so and this is reopened. ⏳ **Queued 10-03 (21).** A52 made it one component; something has unwired it or an older build is being served. ⛔ Establish WHICH before fixing — a revert and a broken wire need opposite fixes. Owner-visible on production. |
| **A72** | ⛔ **SEARCH IS COMPLETELY BROKEN — "ai" returns no change at all.** Rebuild as a RANKED LOCAL search | ✅ **DONE 10-03 (21), `5635c5d`, LOCAL.** Cause: `LIKE %q%` substring, no ranking — "ai" matched **2,525 / 2,616** (maint-ai-n). Now `services/jobs/boardSearch.js`: whole words, the owner's four tiers, the rest omitted; ATS match (the fit keys) breaks ties; migration **123** puts ai ≡ artificial intelligence and ml ≡ machine learning into `skill_synonyms` as CONFIRMED aliases (the same map the scorer reads — ⚠ so those scores can move; A76 re-measures). **Recall, through `/api/jobs` walking every page:** title recall **1.000** on 10 terms (ai 230/230, ml 79/79, data engineer 17/17, product manager 145/145 …), tiers monotone, walked = total. ⛔ **Decision the owner can reverse: a search lifts the profile's role scope** — on an engineering profile "data engineer" returned **0** (19 titles, bucketed `data`) and "product manager" 4 (145 titles, `pm`). ⚠ "ai" still returns 1,522 description-only rows (tier 4) — AI is a word in 1,938 of 2,616 descriptions. Cost 0.45–0.54 s warm vs 0.17 s unsearched. ⏳ **Queued 10-03 (21).** No live scraping any more, so local-only by definition. RANKING (owner's spec): 1 title STARTS WITH the term · 2 title CONTAINS the term · 3 other structured fields (company, skills, requirements) · 4 description only · ⛔ everything else OMITTED — not ranked last, omitted. ⭐ Normalise synonyms with EQUAL weight: ai ≡ artificial intelligence, ml ≡ machine learning. ⚠ `skill_synonyms` already exists and is wired to the scorer (CC3) — reuse it, no second synonym table. ⭐ Tie-break within a tier = ATS match, descending. ⚠ Measure recall on a few real terms and report it — "search returns nothing" shipped once. |
| **A73** | **FILTERS DO NOTHING** — no filter changes the board for any value | ✅ **DONE 10-03 (21), `92d2f3c`, LOCAL.** NOT a broken wire — the drawer works in the local AND the live bundle (Remote 681 → 463). Two real causes, both fixed: **(1)** soft-null filters kept unclassified rows IN THEIR PLACES — of 463 "Remote" rows **400 are unclassified, 63 known remote**, and the unclassified held the top; now known matches lead, the rest follow, and the response carries `unclassified: {count, filters}`. **(2)** a failed `/api/jobs` was silent (old board stayed, unexplained) — now the board says "The board could not be updated — …". **Per filter:** works — Role/search, Location, Experience, Provider, Salary, Date Posted (via posted_after), Domain, Status; works but sparse — Work Model (42% classified), Skills (31%); ⛔ **wired to a dead column — Employment Type (0.3%), Sponsor-friendly (0.1%)**; Company sponsors needs DOL data; nothing silently dropped by the query builder. Owner call in O49. ⏳ **Queued 10-03 (21).** ⛔ Fix the function before the form: a filter panel that looks better and still does nothing is worse. Report PER FILTER whether it was never wired, wired to a dead column, or silently dropped by the query builder. |
| **A74** | **REMOVE FROM THE JOBS PAGE** — owner-confirmed dead weight | ✅ **DONE 10-03 (21), `1f9df8e`, LOCAL.** All four gone (checked in a browser at 1440/390): the CHECK FOR NEW JOBS strip, the "Sorted for your profile" disclaimer (with its "Don't sort for me" toggle), the 5-second double-click (one click, one search), the job count + "N filters active" chip (the icon badge carries it). ⏳ **Queued 10-03 (21).** · the "CHECK FOR NEW JOBS" bar · the "Sorted for your profile (role keywords, role_key, …)" disclaimer · the 5-second re-click guard on the search button · the "567 jobs" count bar — ⭐ the filter icon already signals active filters. |
| **A75** | ⛔ **ATS SCORE RETURNS AS A NUMBER** — owner decision, reversing the band-only call | ✅ **SORT DONE 10-03 (21), `c60ec0c`, LOCAL — the NUMBER still waits on A76.** "ATS match" on the jobs page (renamed) and on the daily draft (`?order=ats`, a "Dealt | ATS match" control; the score orders the cards server-side and is never sent). Contract **1.5.0**; the three score annotations now read "NOT DISPLAYED YET — will be shown once A76 validates it". ⏳ **Queued 10-03 (21).** Show the number again, and ⭐ add "ATS match" as a SORT OPTION on BOTH the jobs page and the daily draft. ⚠ Why it was removed: "58" beside "Strong match" read as contradictory, and ρ ≈ 0.746 on 30 postings graded by one person does not support a displayed figure. ⭐ The owner's answer is to EARN it: validate and tune against external LLM grading. ⛔ That validation is A76 and it is the CONDITION, not an optional follow-up. ⚠ Sorting by score does NOT require displaying it — the sort can ship immediately. ⛔ The mobile contract marks matchScore INTERNAL — DO NOT DISPLAY; update that annotation with this decision rather than leaving the contract contradicting the product. |
| **A76** | ⭐ **BUILD A LARGER GRADED CORPUS BY LLM, then re-tune** | **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **✅ MERGED via `d16-a76-integrate`** (`2d5cf21`); 126 between 125 and 127 in both runners, applied after 128 in production. Dry runs on a DB copy: carry-over 71 VALID; the owner's file is 186 rows, all ungraded. ⏸ **The owner grades** (O69c). **Status 10-03 (24): ✅ REBUILT under D17, `11b0678` on branch `a76-export-import` (worktree `draft-wt-a76`), NOT merged — migration 126** (⚠ merge after D16's 125; `ARCHITECTURE.md` / `HANDOFF.md` high-water lines will conflict → 126). No model call: `--grade` removed (exits 6, names D17); a credit check before the rework was still refused (O48). EXPORT → external grade → IMPORT through the enrichment manual path (same JSONL, `content_hash` interlock, all-or-nothing refusal, `enrichment_batches.kind = 'ats_grade'` + before-images, `revertBatch`/`revertPreview` dispatch on kind); grades in `ats_corpus_grades` keyed by grader. Guards seen RED: invalid_value · stale · unknown id · concurrency (one immediate transaction → `concurrent_import`) · refusal that reconciles — plus revert dispatch (without it a grade revert would NULL enrichment columns), blind export, D17 no-model, trace; idempotent. The 71 10-03 grades carried over as grader "model:claude-sonnet-5 (10-03, API, pre-D17)". ⏸ **OWNER: grade the blind file** — `C:\Users\duggi\WebstormProjects\draft-a76-grading\a76-grade-export.jsonl` (outside the repo; 186 = your 30 unlabelled + 156 sampled, seed 76; README beside it), then `node scripts/a76LlmGradedCorpus.mjs --db <copy> --import <file> --grader owner` (dry run) → `--apply`; report: `--db <copy> [--out report.json]`. Found: the 10-03 report ranked 20 declined (null) engine scores as 0 — now excluded and counted. Carried-over figures: model vs owner ρ 0.855 / τ-b 0.750; engine vs model (scored, n=51) ρ 0.656; held-out 63/44 κ 0.725 vs 44/26 0.425 on a skewed single-proxy set — ⛔ not evidence to move the bands. Branch alone **3183 / 3183 / 0**. Was: ⏸ **PARTIAL 10-03 (21), `afbbf95` — STOPPED AT 71 / 230: the Anthropic API credit ran out (O48).** `scripts/a76LlmGradedCorpus.mjs` grades blind (no score in the prompt) through callModel. So far: **model vs OWNER on the 30: ρ 0.855, τ-b 0.750** (engine vs owner 0.736) — the proxy orders like the owner, but grades harsher (exact 5/30). Cutpoints: held-out shows no gain over 44/26 (κ 0.688 vs 0.684). ⚠ the 41 new rows so far are low-bin only (ρ −0.107 is range restriction, now shuffled). Re-run after the top-up: `node scripts/a76LlmGradedCorpus.mjs --db <copy> --n 200 --grade --yes`. ⏳ **Queued 10-03 (21).** Today: 30 postings, one grader, ρ 0.746 → 0.723 after the US filter, only 24 survive — ⛔ too thin to justify a displayed number. · Sample N postings against a real profile, grade with an external model, join to scores. · ⛔ GRADE BLIND — scores withheld from the grader, as the original corpus was. · Report ρ, τ-b and mis-ordered %, and re-derive the band cutpoints. ⚠ An LLM grader is not ground truth either — a bigger, cheaper, more consistent proxy. ⭐ The real ground truth is still `job_applications`, which is still empty. |
| **A77** | **COMPANY LOGOS MISSING FOR SOME COMPANIES** | ✅ **DONE 10-03 (21), `e240e6b`, LOCAL.** Measured: 11 of 22 companies had a logo — exactly the hand-kept table. Now `services/jobs/companyLogoStore.js`: per company, a domain WITH EVIDENCE (the table, the company's own careers host, or `<name>.com` only if its homepage names the company — ⛔ the first live run resolved Ramp to **ramp.app, a different company**; guesses are .com-only now), the icon BYTES stored (migration **124** `company_logos`) and served first-party from `/api/company-logo/<key>`; a fallback chain of three DIFFERENT sources (site-declared → /favicon.ico → DuckDuckGo); all dead → nothing stored, the letter stays. Live on the local copy: **22 / 22 stored**. `scripts/a77LogoProvidersLive.mjs` exits 1 on a dead provider (proven with Clearbit's host). ⏳ **Queued 10-03 (21).** Resolve during enrichment: fetch, cache, and store PER COMPANY rather than per job. ⚠ Precedent: logo.clearbit.com died and its FALLBACK for "provider unreachable" was Clearbit itself, so 1,290/1,296 rows showed nothing while the code looked fine. ⛔ Any new provider needs a real fallback and a test that fails when it is dead. |
| **A78** | **COMPANY NAME LINKS** — keep the hyperlink, lose the underline and the ↗ | ✅ **DONE in D1, `c6bd112`, LOCAL.** No underline, no ↗; the underline returns on hover AND keyboard focus (a non-colour cue). ⚠ Set in D1's logo face, not the deck's serif — D1 (written after A78, "the specification") says so. ⏳ **Queued 10-03 (21).** Use the daily draft's serif treatment. ⚠ Keep a NON-COLOUR hover affordance — removing underline AND arrow leaves only colour, which fails for colour-blind users. |
| **A79** | **JOB CARDS ADOPT THE DRAFT LOOK** — hover-revealed buttons | ✅ **DONE as D1, `c6bd112`, LOCAL** — D1 supersedes this row's explorations. ⏳ **Queued 10-03 (21).** See the visualisation. ⚠ The visualisation was referenced but not attached to the brief — ask the owner for it if the daily draft's own card is not the intended reference. |
| **A80** | **D17 COMPLIANCE — every model call outside generation, found 10-03 (24)** (agent-raised; read-only audit of draft + Resume Master) | **🚀 LIVE 10-05 (29): draft `699a30d` + resume-master `574de80` — merged on the owner's "complete all the log items"; draft 3364 / 3364 / 0, resume-master 354 / 354 / 0.** **V6 ✅** `75dd01a` (smart-search + `classifier.js` deleted; no UI since `a68c6c0`) · **V5 ✅** already `77ac3e8` (D33) · **V8 ✅** A76, pinned by a new scripts ratchet `0a04abb` (only `al5TokenizedGeneration.mjs` may call a model — it verifies generation) · **V9 ✅** `2337540` al1 deleted · **V10 ✅** `eb6c6e0` al3 synonyms → export → owner → import (740 terms, 13 batches; the table moved ρ +0.000) · **V11 ✅** `423f8fd` al4 LCA resolution → export → owner → import (2 open: Mercury) · **V12 ✅** `337837e` · resume-master's classifier-inside-generate = generation, pinned `2165dd0` · reconciliation doc `e8ad298`. **KNOWN_VIOLATIONS = {domain_chips (V3)}** — the profile wizard's "Load more AI suggestions" — an owner call (O72a). ⚠ `PrivacyPage.jsx` is wrong in 5 places (O72b). Then **A87** removed the Groq/Gemini stack. **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **V4 CLOSED — `enrich_job`'s call deleted** (`979d209`: `buildPrompt` / `runEnrichment` / `drainEnrichment` gone; the manual import now fires the A52 rescore hook). Ratchets agree: KNOWN_VIOLATIONS = V3, V6; providerRouting's PUBLIC set is empty. Stale `server.js` comment fixed (`3864022`); the privacy reconciliation's citation fixed (`49431a3`). 37 tests retired with the code, 1 added. ⚠ The SmartRecruiters/Workday description fetch and the technographics writer have no trigger (O69e). **⏳ V3, V5, V6, V8–V12 in build (28), branch `a80-d17-remaining`.** **Status 10-03 (24): V7 ✅ `a161121` · V2 ✅ `309944a` · V1 ✅ draft `ec852d4` + Resume Master `1636a01` (contract 1.2.0, parse-pdf free, `parsePdf.js` deleted; draft's vendored contract stays 1.1.0 — it no longer calls the route) · V4 ✅ for reachability `82455de` (no drain, no post-import pass, `/run` apply → 410, the admin section counts the backlog) — all LOCAL; draft 3186 / 3186 / 0, Resume Master 300 / 300 / 0.** A ratchet, `test/d17ModelCallSites.test.js`, holds every model call in production code to generation or a named A80 item. **Measured cost:** V1 — the text layer keeps one- and two-column résumés whole (1.000), mixes sections in a row-drawn TABLE layout (0.31 of lines in their own section) and reads nothing from a scan (now a stated 422/400); Resume Master's column-aware reader is no better on those. V4 — local board 802 / 2,616 enriched (30.7%), last model enrichment ~08-24; new rows (~28/day) stay unenriched until an export → import round trip, so A48's "not enough signal" share will climb. ⚠ `enrich_job`'s call still sits unreachable in `enrichJob.js` (delete after A76 merges) · ⚠ **`PrivacyPage.jsx` still says ATS analysis goes to Anthropic — no longer true (over-discloses; user-facing copy, O57)** · stale comment in `server.js` ~4596. Open: V3, V5, V6, V8–V12. Was: ⏳ **Open — nothing changed yet.** Every draft call goes through `services/modelCall.js` `callModel` (Anthropic, or Groq/Gemini only under `ENRICH_PROVIDER`); Resume Master's through `src/model/anthropicCall.js`. **Allowed:** RM generate (+ the off-by-default LLM formatter), RM A+ enhance, draft's two cover-letter calls · ⚠ borderline: RM's classifier inside generate runs when no `roleFamily` is sent (fix: make it mandatory or default `general`). **Violations, cheapest first:** **V7** dead `classifyJob` in `server.js` (~4398) — delete · **V2** `/api/standalone/generate`'s ATS step calls Haiku — use `standaloneAtsResult`, as `/api/standalone/ats` already does · **V1 (O16e)** `/api/parse-pdf` → RM `/v1/resumes/parse-pdf` → Sonnet — use draft's `pdf-parse` path or RM's `extractPdfText` (A70 already does on the site route); clears RM `verifyContract --metered`'s parse case too · **V4** enrichment runs automatically (04:00 cron via `drainEnrichment`, boot warm, after every import, `POST /api/admin/enrichment/run`, `runEnrichment.mjs`, `am4Enrich run`) — stop the automatic triggers; the export → import path (`enrichmentTransfer.js`) becomes primary · **V3** `/api/domain-profiles/generate-chips` — keep the registry chips, drop or replace "generate more" (UI change) · **V8–V12** scripts: a76 (being reworked, see A76), al1 (delete), al3 / al4 (→ export → import), runEnrichment / am4 run (delete) · **V5** capture/paste: the model is the DEFAULT, `jobFromLabelledText` only after a model failure — invert; plain paste / unknown URLs need a local extractor (JSON-LD `JobPosting`, meta tags) or a stated refusal · **V6** `/api/smart-search` sends the résumé to a classifier — needs a local résumé/JD classifier, or take role family + domain from the active profile. Once V4/V5 are done the Groq/Gemini stack (`shared/modelProviders.js`, `providerTransport.js`, `ENRICH_PROVIDER`) has no production caller and can go. ⚠ D17 asks for the cost of NOT using a model to be measured — V4 (enrichment coverage) and V5/V6 are where it will show |
| **A81** | **ATS SCORER: years, clearance and citizenship are never read from résumé TEXT** (agent-raised 10-04, D21) | **🚀 LIVE 10-05 (26b): draft `6521afe` (`/api/version`, started 15:42Z) + resume-master `a4fef7b` (`/v1/version`, `scorer: @draft/ats-scorer@1.2.0`).** **Experience re-tune MERGED + PUSHED on the owner's go** (draft `1b4cbb4` → merge `6521afe`, 3291 / 3291 / 0, client builds; resume-master `d3e8d1c` → merge `a4fef7b`, 351 / 351 / 0). `local_ats_v5`: a met years requirement is neutral (0.85 of 22), not a bonus. ⚠ Every stored ATS row re-scores once on this deploy (basis hash changed). **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26): draft `4c376b2` (`@draft/ats-scorer` 1.1.0) + resume-master `7cf422b` (re-vendored byte-identical, contract 1.4.0).** `src/textFacts.js`: years = union of dated roles (rounded down; a stated "N years" only when nothing is dated); a clearance only when stated as held (hedged lines don't count). Opt-in `factsFromText`; a profile fact always wins. ⛔ **Citizenship NOT read** (O61b). **Draft scores unchanged** — `am1GradedCorpusVerify` byte-identical, ρ 0.746; a ratchet test refuses the flag in draft code. ⚠ **Assistant path ρ 0.637 → 0.592** (7 of 30 move; Δ −0.045, CI −0.160…+0.035) — the existing experience weight acting on known years; draft with profile years set would read 0.672. Owner pushed anyway ("push it with the others"). **Re-tune done, not merged — O61(a)** ("meets" made neutral; draft-with-years 0.672 → 0.685, assistant 0.592 → 0.595, both noise; nothing falls). ⚠ draft's own public ATS tool still does not read text facts. Found building the ChatGPT test cases. `packages/ats-scorer` `buildRuntimeAtsBasis` takes `yearsExperience` and `structuredFacts` (`hasClearance`, `citizenshipStatus`) from `signalProfile` only. With `job` + `resumeText` — all an assistant sends — the experience line says the years are not set, and a clearance / citizenship requirement is **always** a hard-constraint miss, even when the résumé says "Active TS/SCI". Mitigated in resume-master `3e9347c` (the tool description says so and forbids asking the user for the status). Fix in draft's package, then re-vendor: read years from the text (dated roles) and a stated clearance — ⚠ citizenship from text is sensitive; decide whether it is read at all. draft's own users are unaffected (draft passes `signalProfile`). |
| **A82** | **resume-master: the site's free-tool limiters hold RAW IP addresses** (agent-raised 10-04, D21) | **🚀 LIVE 10-05 (26b): resume-master `a4fef7b` (contains `02a600d`).** **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ DONE (26): resume-master `386d88c`.** The free-tool limiters key on a salted per-process hash (`createAddressHasher`, shared with the MCP limiter), each map emptied when its window turns (a minute; the UTC day for the PDF ceiling); the 10,000-entry sweep is gone. `docs/PRIVACY.md` states the one thing held. +6 tests, 3 injected red. `src/http/siteRoutes.js` `createRateLimiter` / `createDailyLimiter` key on `req.ip` unhashed, swept only past 10,000 entries — while `docs/PRIVACY.md` says the free tools "keep nothing" and never mentions addresses. Bring them to the MCP limiter's standard (salted hash; emptied when the window turns) or disclose. |
| **A83** | **resume-master: the privacy page is JavaScript-rendered and its renderer splits wrapped lines** (agent-raised 10-04, D21) | **🚀 LIVE 10-05 (26b): resume-master `a4fef7b` (contains `02a600d`).** `/privacy.html` checked live: no "Loading…", the policy is in the HTML. **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ DONE (26): resume-master `76fa561`, rendered on the server.** `src/http/privacyPage.js` renders `docs/PRIVACY.md` (paragraphs, bullets, tables; wrapped lines joined) into `public/privacy.html` on every request; the inline script is gone; the whole policy is in the HTML with no JS. `/v1/site/privacy` JSON unchanged. +4 tests, 3 injected red. `public/privacy.html` shows "Loading…" until it fetches `/v1/site/privacy`; a no-JS reviewer sees no policy (OpenAI's review reads the URL). Its `render()` makes one paragraph per LINE, so every hard-wrapped paragraph and bullet in `docs/PRIVACY.md` renders broken today (D21's new section is one line per paragraph for that reason). Render server-side, or join wrapped lines. |
| **A84** | **D21 step 2 — parsing over MCP needs a file design, not base64** (agent-raised 10-04) | **🚀 LIVE 10-05 (26b): resume-master `a4fef7b` (contains `02a600d`).** **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ DESIGN WRITTEN (26), nothing built: resume-master `70e4ee1` `docs/PARSE_OVER_MCP.md`.** One `file` argument (`openai/fileParams` `download_url` only); HTTPS + host allowlist `RM_MCP_FETCH_HOSTS` (absent = off); SSRF refusals, no redirects; 10 s, streamed 5 MB cap, `%PDF-` check; memory only, URL never logged. ⚠ URL lifetime and size limit are not documented — measure on a real call. Owner calls: O61c. `/v1/resumes/parse-pdf` is deterministic since `1636a01` (unpushed), so D17 no longer blocks it. But an assistant hands a tool a **file reference** (ChatGPT: file IDs / a download link valid minutes), not a base64 string; and the review's minimum-necessary rule applies. Design the input (fetch-by-link with a host allowlist, size cap, no retention) before declaring the tool. |
| **A85** | **FIT FILTER vs THE BADGE: a stale stored score can file a card under "Strong" while its badge is blank** (agent-raised 10-04, D24) | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26) into draft `main` — 3284 / 3284 / 0 on the merge, client builds.** **✅ FIXED (26): `3b0134a`.** The fit filter bands the CURRENT score with the badge's own test (current basis hash + `atsJobInputHash`, a registered SQL function); a stale score is in no band; facets' fit options and "unscored" read the same expression. Left on purpose: the atsScore sort and curated fit keys still order by the raw cell. `fit_bands` filters on the raw stored per-user score, as the `atsScore` sort already does; the card's badge reads a freshness-checked report. When the stored score is stale, the filter and the badge disagree. Decide one source for both (and what "stale" means), or have the filter exclude stale scores the way the badge does. |
| **A86** | **D32 FIDELITY — the ink pair rebuilt to the owner's sketch `pair2.html`** (agent-raised 10-05, from comparing the shipped CSS with the sketch once O68 delivered it) | **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **✅ BUILT: `3a29002`** (branch `a86-pair-fidelity`). Every value is the sketch's, through `PAIR_*` tokens (new: `PAIR_HI`, the ok/no/gen QUIET + EDGE pairs, `PAIR_MAST_TINT`, `PAIR_CARD_SHADOW`, `PAIR_KIND_ALPHA`). **Posting:** the strip in serif 20px · the body in Georgia 15.5/1.78 in the secondary ink · uppercase headings with the rule UNDER · `::marker` bullets · the masthead's orange wash + bottom rule · title 36px. **Score:** the band as a logo-face heading · a flush square 6px bar (generic grey) · ruled sections with mono counts · toned boxes (green "already yours", grey generic, red claim with a filled `+` square → ✓) · the 7.5px kind label behind a hairline. **Four sketch values failed AA and moved the minimum:** light dim → `#726960`, light accent → `#FC4600` (on the wash), dark generic → `#91887D`, kind opacity .62 → .91 / .75. **Kept from D31/D32 on purpose:** no motion (the sketch eases .15s), the declined band dashed and colourless, the A76 number gate, one component, the dark-surface guard, nothing pre-selected, a11y, the folds closed, the strip 2×2 on a phone. New `pairFidelityA86` (+5) fails if the strip or body leave the serif face and checks every token and ~90 CSS values against the sketch; 23/23 injected red. Shots `draft-screenshots/a86-pair-fidelity/` — 64 built + 8 of the sketch itself, for comparison. ⚠ Not done: the sketch's 400px score column — the deck's report column is A40 geometry, not panel styling. |
| **A87** | **Dead code A80 left behind: the smart-search client and the Groq/Gemini provider stack** (agent-raised 10-05) | **🚀 LIVE 10-05 (29): `814f182` (23:56Z) — 3336 / 3336 / 0, client builds.** **✅ DONE:** `2a39957` · `f6640b1` · `bc14ee9`. (1) JobsPanel's orphaned `handleSmartSearch`, its two states and its error row deleted; the D17 V6 pin now covers the client. (2) **`shared/modelProviders.js` and `services/providerTransport.js` deleted** after checking every importer: no production caller; the only ways in were an `ENRICH_PROVIDER`-gated route and a `GROQ_API_KEY`-gated boot probe that could refuse the boot. `callModel` is Anthropic-only; `DATA_CLASS` = {CANDIDATE, TOKENIZED} lives in `modelCall.js` and an unknown class (`"public"` included) is refused; `modelCatalogue` checks Anthropic only; `.env.example` and ARCHITECTURE §8 updated. 33 tests retired (each read first), 7 re-pointed. (3) `test/a87AnthropicOnly.test.js` (+5): a ratchet against any non-Anthropic module, SDK, host, env var or dependency; 9 injections red. Owner: **O71**. |
| **A88** | **Generation-call errors found by D36** (agent-raised 10-06): `toolsService.js` treats the tools service's 429 `{retryable:true}` as permanent; `/api/generate` answers 500 "ANTHROPIC_KEY not configured" though generation runs in the tools service | **🚀 LIVE 10-06 (30): `875b43b` (`/api/version`) — 3380 / 3380 / 0, client builds.** **✅ DONE:** `c0bcb89` · `0d7f2fc`. **(1)** With no `permanent` in the body the client inferred `permanent = status < 500`, so the tools service's own 429 `limit_exceeded {retryable:true}` read "permanent=yes (retry will fail identically)" on the apply line and "Retrying will not help" on `/api/generate`. Now the service's own true/false wins field by field; with no verdict, 5xx / 408 / 429 are transient and 400/401/403/404/413/422 stay permanent. Callers traced (`classifyGenerationError` → `genFailure`, `httpErrorFor`, `classifyRuntimeError`); Draft admission and D36·3 key on `reason_code` and were already re-Draftable; nothing auto-retries. `a88ToolsServiceRetryable` +9, 4 injections red. **(2)** `/api/generate` makes no model call (`coreGenerateResume` → `toolsService.generate`): the `ANTHROPIC_KEY` gate is replaced, on the new-generation branch only, by `toolsService.configured` → 503 `tools_service_unconfigured`; cached résumés still serve. The cover letter calls the model itself, so it keeps its key check — now 503 `model_unconfigured`, not 500. Boot warning corrected. `a88GenerateConfigGate` +5, 4 injections red. Walked on a throwaway :3141. Owner: **O74**. Was: ⏳ In build 10-06 (29). |

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

---

## ⛔⛔ D37–D42 · OWNER BATCH, 2026-10-06 — from using the live product

✅ **10-06 (32): ALL SIX BUILT, one commit each, in the owner's order — LOCAL, NOT pushed (O76a).** Status under each row. ⛔ Production reads were refused this session; each row says what that left unverified.

⏸ Queued 2026-10-06 by the owner. ⛔ **The agent is mid-flight on O41–O43, O51, O71, O72(b) and O74. These queue behind it — and the ORDER matters:**

```
1  D42   filtering returns WORSE results than none            ← correctness, core function
2  D41   ★ and ALL are separate stores; non-US must be refused  ← D33's acceptance is still failing
3  D40   the import panel (+ as a fourth view)
4  D39   the panel pair swaps sides and will not close
5  D38   company-name links: the panel, and the hit area
6  D37   the header: sentence wording, centring, bar width
```

⛔ D42 and D41 are **correctness** — a filter that hides the right jobs and a capture that cannot be
found are the product failing at its one job. D37–D40 are UI. ⛔ **Fix the first two before
restyling anything**, or a prettier surface sits on top of results nobody can trust.

---

### D42 · ⛔⛔ TAGGING MADE THE BOARD WORSE. Prove the tags before any UI leans on them.

✅ **BUILT 10-06 (32), `e57d930`, local.** Measured on the 10-06 local board (2,616 rows, the tagger in memory, read-only — production reads refused): **H1 IN** — `finance` was the job FUNCTION (18 rows: tax directors, controllers); the 189 fintech-sector engineers carry `engineering`. **Owner, in-session:** domain (the job's work) and sector (the employer's) are DIFFERENT tags — domain stays the sentence's word; **sector** (`shared/companySectors.js`, a closed company list, 35 companies) is a drawer filter. **H2 IN** — a chosen domain replaces the scope (D30); **owner: "all" = engineering + data** (`ROLE_SCOPE_EXTRA`; every other profile keeps its bucket). **H3 OUT** — Boston recall 5/5 on the raw strings; the one metro miss was "Seattle WA" with no comma (fixed; TAGGER_VERSION → 2). **H4 IN** — the location's "unknown" admitted NON-US rows (716 of 902 kept for Boston) — fixed. Kept rows labelled ("1 in Boston · 32 with no city on file, shown after"), a **strict toggle** (strict_tags) in the panels, **"+ add" moved into the panel** (owner). Acceptance as a test on real strings (+8). ⚠ Not re-run on production (O76b-3). ⚠ Level / workplace dials still carry their coverage note; employment stays dimmed (unchanged).

**The owner's level-1 test.** Every other filter removed. **Boston alone. Finance alone.** ⛔ The jobs
they could ALREADY SEE — finance-sector engineering jobs, jobs in Boston — **disappeared, and
irrelevant jobs appeared in their place.** *"Plain stupid. I don't know if the tagging even worked or
if it did a worse job."*

⛔ **THE INVARIANT, stated once so it can be tested:** **applying a filter must never remove a row that
carries the tag it asks for.** Every row visible with no filter whose tag is F is visible with F
applied, and **known matches rank before kept-unknowns.** The owner's observation violates both.

#### The four hypotheses — rule each IN or OUT with evidence, in order. ⛔ Do not skip to a fix.

**H1 · The "finance" tag may not mean what the owner means.** ✅ **Owner, 10-06: *finance*, *data* and the rest are SUB-DOMAINS OF ENGINEERING.** The board holds only engineering, so the domain dial's values are its verticals and **"all" means no domain filter.** Yet `O72(a)` says finance has only **8 postings** by role family. So **what is the `finance` value derived from — the role, or the company's sector?** A **fintech engineer** is *engineering* by role and *finance* by sector. ⭐ **If `finance` is derived from the role, the filter returns a handful of finance-role rows and drops every finance-sector engineer — exactly the jobs the owner saw vanish.** Report **the domain tag's value set, what each value is derived from, and its precision and recall.** If sector is not a tag at all, it is a **missing dimension** rather than a bad one — add it at the **COMPANY** level, deterministic first (the company KB, known lists), then **export → tag → import** for the rest (D17).

**H2 · The domain dial REPLACES the profile's role scope instead of narrowing it.** ✅ **Decided 10-06 — this answers `O60(a)`: an unset domain reads "all", not "engineering".** The board is engineering throughout, so **`all` lifts the profile's role scope** and *finance*, *data* etc. **narrow** it. ⛔ **Verify the built behaviour matches:** with no domain set, **no role scope is applied**; with *finance* set, what remains is a **subset** of what was visible — never a different set.

**H3 · The location tagger misses real Boston rows.** `O60(b)` measured *"in Boston"* = **1 known
match + 32 country-only/remote kept after it.** **One** Boston match on a board where the owner can
see several means metro **recall is bad** — *"Boston, Massachusetts"*, *"Greater Boston"*,
*"Cambridge, MA"*, *"Boston, MA (HQ)"*, *"Remote — Boston"*. ⚠ **Coverage is not accuracy**: D29
reported metro at 91.7%, and a tagger can fill a column 100% with wrong values.

**H4 · Soft-null keeps unknown rows, and they surface among or above the known matches.** *"Kept,
not hidden"* was right for **honesty** and wrong for **relevance**. ⛔ **Report the composition of the
32 kept rows** — country-only? remote? a **different known metro**? ⛔ **Unknown is not different:** a
row tagged *New York* must be **excluded** for Boston; only a row with **no city on file** may be
kept — and it ranks after, labelled.

#### ⛔ What to report BEFORE any fix

Per tag value (Boston, finance, and every other dial value): **PRECISION and RECALL from a
hand-checked sample** — 50 rows carrying the tag and 50 rows the raw string suggests should carry it.
**List the false negatives by pattern.** ⛔ **Coverage alone is not evidence** — it is how this shipped.

#### Rules that hold whatever the evidence says

- **Narrowing never replaces scope.** · **Known matches rank first.** · **Kept rows are labelled and
  ranked after.** · **Unknown ≠ different.**
- ⭐ **The sentence and dial say exactly what happened:** *"1 in Boston · 32 with no city on file,
  shown after."* A count that blends the two is the lie.
- ⭐ Offer a **strict toggle** — *"only jobs known to be in Boston."*
- ⚠ Dials that cannot carry a filter must not look like they can: level **65.2%**, workplace
  **47.5%**, employment **7.7%**.

#### ✅ Acceptance — the owner's own test, as a test

**Boston alone** returns a **superset** of the Boston rows visible unfiltered · **finance alone**
returns the finance-sector jobs the owner saw · **both** return their **intersection, ranked** · each
reproduced against a **fixture of the real location strings**. ⛔ "The tags have 91% coverage" is not
an answer to this row.

---

### D41 · ⛔ THE CAPTURED JOB: not findable, no salary, no logo

✅ **BUILT 10-06 (32), `8caefbb`, local.** ⚠ The owner's capture was NOT looked up by job_id (production reads refused — O76b-1); the mechanism was found in the code: a capture with no POSITIVE US evidence was inserted, **held** (is_active 0) and **auto-starred** → in ★, not ALL. **(a)** which query backs each chip: ALL and ★ = one statement (★ adds `uj.starred = 1`, relaxes is_active — the labelled exception); /d = a separate query that hard-joined the role bucket and title filter. Now ALL admits the user's own rows (starred · drafted · captured), /d drops its hard narrowing, and a capture no longer stars. ⚠ /d's list is still its own endpoint → **A91**. **(b)** salary was lost in three places (the extractor's `Salary:` line dropped; JSON-LD `baseSalary` ignored; Ashby's summary strings ignored) — read deterministically now (`salaryText.js`), with the failing formats as fixtures. **(c)** logo queued at capture time from the employer's own site; never an ATS host. **(d)** no US evidence → refused before any write, two messages, recorded as `refused_not_us`; the route's 422 `error` is what every extension build shows — no release needed. +10 tests.

The owner captured a job. It was **in ★ but not in ALL**, so search never found it; they reached it only through the `/extension` page. It also had **no salary** (the original did) and **no company logo.** ⛔ **D33's acceptance is not met until all of it is fixed.** Start from `job_captures` and the URL.

⭐ **Production evidence, 10-06 (O43, read in the container).** `scraped_jobs` holds **no rows with source `import`** — only greenhouse 1,142 · ashby 650 · lever 65 · workable 1 — and `job_captures` holds **one** capture from a company that is not on the list: **`ashby/hims-and-hers`** (the owner's). ⚠ **Do not read the missing `import` source as proof the row is absent:** a capture of a known-ATS URL is refetched and may be stored under source `ashby` with origin `import`. **Look the capture's `job_id` up directly** and report, in order:

1. does a `scraped_jobs` row exist for it, and is it `is_active = 1`?
2. ⛔ **was it one of the 59 rows the O41 retire pass deactivated on 10-06?** That pass retires rows with no *positive* US evidence, and a bare-*Remote* capture has none — so it would sit in ★ (labelled *outside the US*) and vanish from ALL, which is **exactly what the owner saw.** Check the retire log for that `job_id`.
3. is there a `user_jobs` row, and what does it carry?
4. does it have tags and an `enriched_at`?

⚠ **Three different mechanisms** — *never inserted* · *inserted, then retired* · *active but excluded by ALL's query* — give the **same symptom and opposite fixes.** The model in (a) is the requirement either way; this says which bug produced it.

⚠ **And `hims-and-hers` is not on `company_ats_list`, so nothing re-crawls it.** A captured job from an unconfigured company is **never refreshed and can age out** — see `O75(g)`.

**(a) ROOT CAUSE, FOUND BY THE OWNER: ★ AND ALL ARE TREATED AS SEPARATE TABLES.** The capture was written to **★ (`user_jobs`)** and **not to the ALL view** — so ALL, and therefore search, never saw it. ✅ **THE MODEL, decided 10-06: ALL is the whole set. ★ Saved, /d Drafted and + Imported are SUB-TABLES of it — filtered views of ALL, not separate stores.** Everything a user stars, drafts or imports **is a row in ALL**, and each chip is **ALL plus a membership predicate.**

⛔ **Verify and report:** which query backs each of the four chips today, and **where the model splits.** ⛔ **Fix it structurally — one query, one card list, one predicate per chip** — rather than patching the capture path to write to a second place.

⛔ **Invariants, each a test:** every job in ★, /d or + **also appears in ALL** · search and every filter find it **there** · the ★ / /d / + results are **exactly** ALL's results restricted by the predicate — so a filter that hides a row in ALL hides it in ★ too.

⚠ **One labelled exception:** a starred job since **retired** (aged out, or the older *"outside the US"* saves) stays in ★ marked *no longer listed* — it is no longer an active row of ALL, and the existing labels already say so. State it in the report; do not let it break the invariant silently.

⛔ **A capture no longer auto-stars.** The gateway stars every capture today so it can be found; the `+` membership replaces that (D40). ★ is for what the user chose to save.

✅ With **(d)** below a non-US posting can no longer be captured at all, so the old question — *does a capture bypass the US gate?* (`O67(e)`) — is **closed: it does not.**

**(b) SALARY.** Re-fetch the captured URL and compare the live posting with the stored row. **Say where
it was lost:** the client text never carried it · the extractor missed the format (JSON-LD
`baseSalary`, *"$150,000 – $180,000 USD"*, hourly, *"150K–180K"*) · the normaliser rejected it · the
gateway **attached the capture to an existing row and did not donate the salary** (the donation path
exists) · or it is stored and not shown. ⛔ Fix **at the cause**, and add the failing format as a
fixture. Deterministic only — D17.

**(c) LOGO.** A77 fetches logos in the background from the employer's homepage. A company the board has
never crawled is **never queued.** ⛔ **Derive the company's domain from the capture** and queue the
fetch **at capture time**; show the letter tile until it lands. ⛔⛔ **Never use the ATS host's
favicon as the company's logo** — a Greenhouse mark on every Greenhouse job is the Clearbit-fallback
failure again, with a different provider.

**(d) NO US EVIDENCE → NO CAPTURE.** ✅ Owner, 10-06: *"if it lacks US evidence it shouldn't be captured at all"*, and **the extension must tell the user, in a popup, that the job is not based in the US.**

- **The server decides, the extension shows.** `POST /api/import/job` runs the US test **before** anything is written. On failure it writes **no job row and no `user_jobs` row**, answers a **refusal with a plain message**, and records the **attempt** in `job_captures` (`action = 'refused_not_us'`) so the owner can see what was turned away.
- ⭐ **A capture has far more evidence than a crawl does** — it holds the **whole page**, not a location string: the stated location, a US state or city anywhere in the text, **USD salary figures**, *"United States"* in the description, work-authorisation lines. Use all of it. A posting that says only *"Remote"* is no longer a dead end if the page says *"US-based"* or lists a USD range.
- ⚠ **TWO messages, because they are different facts.** **Positive non-US evidence** → *"This job is based outside the US."* · **No evidence either way** → *"We couldn't confirm this job is in the US."* ⛔ Saying *"not based in the US"* about a US remote role would be **false**, and a false refusal on the owner's own capture is the worst outcome here.
- **Prefer a server-supplied message** the extension already displays, so no extension release is needed. If the popup must change, **bundle it with the v1.4.1 already awaiting upload** (`O73g`). ⛔ No new permission, host or storage key.
- ⛔ **Tests:** a non-US page → refused, **zero rows written** · a bare-*Remote* page with a USD range → accepted · a bare-*Remote* page with **no** evidence → refused with the *couldn't confirm* message · the refusal is recorded and visible.

✅ **Acceptance:** (1) capture ONE US posting that states a salary → it is **in ALL**, found by its title within seconds, with the salary, and with a logo or a letter tile plus a queued fetch · (2) capture ONE non-US posting → the popup says so and **nothing** is written.

---

### D40 · ⭐ THE IMPORT PANEL — `+` becomes the fourth view

✅ **BUILT 10-06 (32), `d8c2f84`, local.** ALL · ★ · /d · + in one segment; the + square deleted; `/api/jobs?imported=1` = the board's statement + one predicate (job_captures); the head: Import jobs → /extension, "Get the extension →" (or "listing not published" while EXTENSION_STORE_URL is null), and for a connected extension neither — only ⌃⇧K; the card's one extra line "captured <date> · from <host>"; the /extension page's capture list replaced by a pointer to `/app/jobs?view=imported`. +6 tests.

✅ **Owner's decisions, 10-06:**

- The view control in the bar is **ALL · ★ · /d · +** — **`+` is a FOURTH VIEW**, in the same
  segmented style.
- ⛔ **Remove the standalone import `+` / ADD JOBS control** on the right of the bar.
- ⛔ **Imports do NOT go into ★.** ★ is *"saved for later by the user"*; an import is a different act.
- The `+` view holds **the Import jobs button, the link to the extension page, and the user's imported jobs.**
- ✅ **Imported jobs are a SUB-TABLE of ALL, not a separate store** — the same rule as ★ and /d (D41(a)). The `+` view is **ALL restricted to the jobs this user imported**, rendered with **the same job card** as every other view.
- ✅ **No sketch needed** (owner, 10-06): the view is the board's own card list plus a header.
- ⛔ The **`/extension` page stops listing captures at a random spot** — it explains the extension and carries **the Web Store listing link**; the `+` view is where imports live.

**THE `+` VIEW:**

```
HEADER   [ Import jobs ]   Get the extension →   (the /extension page)
BELOW    the user's imported jobs — the board's own card, ALL filtered to imports,
         with the board's search, sort and the filter sentence working on it
```

- **The Import jobs button** takes the user to capturing: the `/extension` page, which holds the **three install states** (D33 §4) — *not installed → install* · *installed, not signed in → connect* · *installed and connected → "capture any posting with ⌃⇧K"* — and **never offers a download to someone who already has it.**
- **The extension page links to the Web Store listing.** ⛔ `EXTENSION_STORE_URL` is still **null** until the owner supplies the item id (`O55b`) — until then the page must say the listing is not published rather than show a dead link.
- **Each imported card adds one meta line:** *captured <date> · from <host>*. That is the only difference from ALL.
- **There is no status column.** With D41(d) a non-US job is **refused at capture**, so there is no "held off the board" import. A capture that **merged into an existing posting** simply *is* that posting's row, shown here with the captured badge.
- **Membership:** `job_captures` says *which* jobs this user imported; the rows themselves come from ALL. One row per job per user — capturing twice does not duplicate. ⛔ **A capture no longer auto-stars** (D41(a)).
- **Empty state:** how to capture one, with the button.

⛔ **Tests:** the bar has exactly **four** views · no standalone import control remains · an import is in ALL **and** in `+`, and **not in ★** unless the user stars it · `+` is ALL restricted by a predicate (the D41(a) invariants) · an installed extension is never offered a download · the extension page shows no stray capture list.

---

### D39 · ⛔ THE PANEL PAIR: rigid positions, and Close closes

✅ **BUILT 10-06 (32), `f2151b2`, local.** **Found:** `usePanelHost` assigned slots by FOCUS order ("most recently focused takes slot 0") through CSS `order: -slot` — a click focused, so the pair swapped; the X's pointerdown swapped them under the pointer before its click landed. **Deleted:** slots come from a fixed `SPATIAL_ORDER` (posting · PDF · ATS). Backdrop and Escape close the most recently OPENED first; focus returns to the opener. +5 tests. ⚠ Not verified on bounding boxes in a browser → **A92**.

**Observed, with the posting panel left and the ATS card right:**
· clicking the left panel **swaps the two** · the **X button swaps them** instead of closing · a click
on the background closes **one panel at a time**.

⛔ **RIGID.** **Posting LEFT, ATS RIGHT, always** — whichever opened first, whichever was clicked last.
Nothing a click *inside* a panel does may change either panel's position. ⭐ **Likely cause:** a
"bring to front" built as a **reorder** (flex `order`, an array swap, or a left/right class toggled on
focus). **Find it, report it, delete it.** Stacking order is fixed too.

**CLOSE:** ✅ **Owner, 10-06: X closes ITS OWN panel.** *"The X closes neither — it just swaps their places. It should close its respective panel."* The X on the posting panel closes the posting panel; the X on the ATS card closes the ATS card; **the other does not move.** ⛔ A lone panel **stays where it belongs** (posting left, ATS right) — it does not slide across to fill the gap. A click on the background closes **one panel at a time, as it does now** (the owner did not object to that); ⚠ make the order **deterministic — the most recently opened closes first** — and say so in the report. Esc does the same. Focus returns to what opened the panel.

⛔ **Tests (each red when the fix is removed):** click inside each panel → both bounding boxes unchanged · the left X → only the left panel gone, the right **unmoved** · the right X → only the right gone, the left **unmoved** · opening in either order gives the same left/right · backdrop and Esc close the most recent first · focus returns to the opener.

---

### D38 · COMPANY NAMES — the same everywhere, and the link is the TEXT ONLY

✅ **BUILT 10-06 (32), `a9a378f`, local.** **(b) found:** the card's anchor was a flex child of a column (stretched to the line); the panel's was display:block — no overlay. **One `CompanyLink`** (logo face, no underline, no arrow, underline on hover/focus, inline-block fit-content). **(c) call sites:** board card (JobBubble, also the + view) · JobCard · posting panel · Pending Apply. Plain text, not links: deck, ATS header, The Table's History, admin; the extension page shows none. A ratchet fails on any other apply link. +3 tests. ⚠ Hit area not clicked in a browser → **A92**.

**(a) The posting panel never got the treatment.** The job card's company name is **bold italic in the
logo face, no underline, no arrow — still a link** (A78). The posting panel **still shows the underline
and the ↗.** Apply the card's treatment. ⚠ Keep a **non-colour hover affordance**, as A78 required —
without underline or arrow, colour alone fails for colour-blind users.

**(b) The hit area is wrong.** On the board, **a click on the same horizontal line as the company
name — where there is no text — still follows the link.** The anchor is stretched: a block or flex
child, a pseudo-element overlay, or a click handler on the row. ⛔ **Make the link `inline` /
`width: fit-content` and remove any overlay.** ⭐ *The card's own click (open the posting) must still
work everywhere else on the card.*

**(c) SWEEP, because this is the StampLogo lesson.** One company-link component, on **every**
surface: board cards · deck · Draft House · The Table · the posting panel · the ATS panel header · the
`+` view · the extension page · admin. ⛔ **Report each call site.** Three implementations of one mark
is how the legacy brand shipped on every page while the guard passed green.

⛔ **Test:** a click at a point on the name's row but **outside its text box** → **no navigation**; a
click on the text → navigates; the posting panel's name is not underlined and has no arrow.

---

### D37 · FULL HOUSE HEADER — the sentence, where it sits, and how wide the bar is

✅ **BUILT 10-06 (32), `19f1e0c`, local.** The sentence verbatim (lower-case d, token + noun, plural unset / singular set); one centred column (margin-inline auto) shared by the sentence, panel and bar; the bar's ceiling 760px. **Measured headless** on the real CSS (`scripts/d37HeaderGeometry.mjs`): 390 → 16/358 · 1280 → 260/760 · 1920 → 580/760 · 2560 → 900/760, margins equal at every width. ⚠ Both themes not screenshotted in the running app → **A92**. ⚠ "nothing matches" is lower-case too (O76d). +3 tests.

**(1) THE SENTENCE — REWORDED BY THE OWNER, 10-06.** *"The sentence with so many commas is vague."* ✅ **The new sentence, verbatim:**

```
discovering all roles at all career levels and workstyles in the United States.
```

⛔ **The `d` is LOWERCASE** — matching the lowercase wordmark (`/draft`). ⚠ It is lowercase **in the same face and size as every other word** (D34: one font, one size across the whole sentence), **not** a second face for the first letter. *If the owner meant the `d` set in the logo face, that breaks D34 — ask before building it.*

**The slots are the same four dials; the commas are gone because the connectives do the work:**

```
default   discovering [all] roles at [all] career levels and [all] workstyles in [the United States].
narrowed  discovering [finance] roles at [senior] career level and [remote] workstyle in [Boston].
```

- `roles` = the **domain** dial · `career levels` = **level** · `workstyles` = **workplace** · `in …` = **location.** *Posted* and *fit* still **append only when set**, after the location (D30): *…in Boston, posted this week, strong fits only.*
- ⚠ **Plural when unset, singular when set** (*all career levels* → *senior career level*). The connective text changes with the token, so build each slot as **a token plus its noun**, not a token dropped into fixed prose.
- ✅ **`all` for domain, not `engineering`.** The board holds only engineering and its sub-domains, so **`all` already means engineering**, and clicking it offers *finance*, *data* and the rest. ⭐ **This answers `O60(a)`:** an unset domain **lifts** the profile's role scope; it never reads *"engineering jobs"*.
- ⛔ **The location floor stands:** *the United States* can be narrowed to *Boston*, never cleared.
- **Superseded:** the D28 wording, the *"which older sentence"* question, and the *"that are anywhere"* / *"remote or not"* choice — the owner has settled the phrasing.

**(2) CENTRED — as a BLOCK, not as text.** ✅ *"The positioning of the sentence needs to be centred to
the screen"* — ⛔ **not `text-align: center`.** The sentence, the open panel and the bar are **one column**,
**centred on the page**, sharing the **same width and the same left and right edges.** Today the
sentence sits to the **left** of the bar and looks odd. Fix: one wrapper, `margin-inline: auto`, one
`max-width`; text stays left-aligned *inside* it.

**(3) THE BAR IS TOO LONG.** It spans nearly the whole window. ✅ **Content-sized with a ceiling:**
full width on a narrow window; on a wide one it **stops growing once there is room for** *the four
views + the search text + the sort icon* — **"and that's it; anything longer is not necessary."**
Ceiling around **720–800 px** — tune to the longest placeholder. The open panel and the sentence use the
same width.

⛔ **Tests:** at **1280 / 1920 / 2560** the sentence's left edge equals the bar's left edge · left and
right page margins differ by ≤ 1 px · the bar's width never exceeds its ceiling · at **390** it fills
the window. ⚠ **Screenshot both themes at all four widths** — D30 shipped unseen, and its typography
was wrong.

---

⛔ **DONE MEANS, for the whole batch:** the owner opens the live site and can (1) apply *Boston* and
*finance* and **see the jobs they saw before, ranked first** · (2) capture a US posting and **find it in ALL by its title**, with its salary and a logo — and capture a non-US one and **be told it was refused** · (3) open the `+` view and **see that import there, on the same card as ALL** · (4) open the posting and ATS panels, click either, **nothing moves**, and each X closes its own panel · (5) read the new sentence **centred above a bar that is not the width of the screen.**

---

## ⛔ D43–D44 · FROM SESSION 31's PRODUCTION READS AND PRIVACY WORK — 2026-10-06

### D43 · ⛔ AN APPLICATION RECORD MUST SURVIVE ITS POSTING — and `job_applications` is not empty

✅ **BUILT 10-06 (32), `3e9c4f5`, local.** **1:** CURRENT STATE corrected (not empty) and O73's check is now a delta; ⚠ whose the 4 rows are and when — not read (O76b-2). **2:** the cause in code — the expiry cleanup's DELETE exempted only starred / applied `user_jobs`; ⚠ not confirmed by job_id against cleanup_log 85. **Fix:** one predicate (`services/jobs/userReferences.js`) — no delete path removes a posting any user record references (the cleanup, the blue-collar reject, the reclassify script); migration 129 snapshots the pay onto `job_applications` and the posting onto `apply_run_jobs`; The Table renders an orphan from its snapshot as "posting no longer listed". Orphans kept as tombstones (recommendation). +4 tests.

The agent's O43 read of production found **4 `user_jobs` rows and 4 `job_applications` rows pointing at postings that no longer exist** (logged **A90**; nothing changed). Two things follow.

**1 · ⛔ THE "EMPTY" CLAIM IS WRONG.** CURRENT STATE, D36 and O73 all say `job_applications` is **empty**, and treat *"a row appears"* as the proof that recording works. **It holds at least 4 rows**, so that proof means nothing as written.
⛔ **Correct CURRENT STATE, and change O73's check to a delta:** *count before → one real application → count + 1, and the NEW row's `ats_score_at_apply` is non-null.* Also report **whose** the 4 rows are and **when** they were written — if they are early test applications they are not validation, and if they pre-date `recordAtsOutcome` their scores will be NULL.

**2 · ⛔ THE ORPHANS ARE PROBABLY THE `cleanup_log` id 85 DELETION'S DEBRIS** (1,288 rows hard-deleted) — *confirm by `job_id` against that log.* The rule it exposes is structural: **a record of something the user DID must not depend on a row the system can delete.** `job_applications` joins to a posting for its title, company and URL, so **deleting the posting blanks the user's own history.** ⛔ **The Table (D15) joins the same way — render these 4 and see what the owner sees.**

**THE FIX:**

- ⛔ **Snapshot at apply time:** company, title, URL, location, salary and the posting's id go **into** `job_applications` (and `apply_run_jobs`), so the record stands without the posting. D16 already stores the résumé artifact the same way.
- ⛔ **A posting with a user relationship is never hard-deleted** — it is retired (`is_active = 0`). The retire pass already works that way; **make deletion refuse rows referenced by `user_jobs`, `job_applications` or `apply_run_jobs`.**
- **The 4 + 4 orphans:** ⛔ **do not delete them yet.** Show them in The Table as *"posting no longer listed"* using whatever columns survive. If the 09-16 or 09-09 backup still holds the postings, **restore the snapshot fields from it**; otherwise they stay as tombstones. ⚠ *Owner: keep or remove* — recommendation: **keep.**

⛔ **Tests:** apply → hard-delete the posting → the application still renders with its company and title · a delete of a referenced row is refused.

### D44 · PRIVACY PAGE FOLLOW-UPS — one sentence unverified, and the policy must match the store listing

✅ **10-06 (32), `4fcfff2`, local.** **1:** both cover-letter prompts traced — they send the résumé text, job title and company, the job description and the tone, **no profile field**; the sentence now says exactly that and a test pins the interpolation list. **2:** the store listing's Privacy-practices answers re-read against the corrected policy — they agree (no third-party scoring claim on either side). **3:** untouched — counsel's (O76f).

A89 / O72(b) corrected `PrivacyPage.jsx` in five places with a pinning test per claim (all six red against the old page; `npm test` 3386). **Local, not pushed.** Three things remain:

1. ⛔ **THE COVER-LETTER SENTENCE IS UNTRACED.** The page now says cover letters send *"your résumé, the profile details and the job description"* — the agent wrote it **without reading the call in `server.js`** (its reads were blocked partway). ⛔ **Trace the actual payload** — every field the cover-letter call puts in the Anthropic request — and make the sentence say **exactly** that. **Pin the field list** in a test that fails if a field is added without the page changing. ⚠ Overstating is the safer error, but the page is a legal surface and *"nothing else is sent to Anthropic"* is an **absolute**, and absolutes are only as true as the last audit.
2. ⛔ **THE POLICY AND THE STORE LISTING MUST AGREE BEFORE v1.4.1 IS UPLOADED.** The effective date moved to **10-05-2026** and the extension section was rewritten. Re-run the **`PRIVACY_RECONCILIATION` join** against v1.4.1's data-use declaration and `STORE_LISTING.md` — a reviewer compares the policy URL to the declarations. ⚠ This gates `O73g`.
3. ⚠ **"Why advance notice doesn't apply."** The page now carries a dated entry arguing that. ⛔ It is a **legal judgement, not a code decision** — the owner takes it to counsel; **do not remove or expand it in code.**

⛔ **And `O72(a)`** (the wizard's *"Load more AI suggestions"*) is still open. The sixth test **forces the label, the privacy disclosure and the route's model call to change together**, so whichever is chosen, all three move in one commit.

---

## ⛔ D45–D48 · OWNER BATCH, 2026-10-07 — load lag, dead cards, the sentence's type, the posting panel header

⏸ Queued 2026-10-07 by the owner, from the live site. ⛔ **Suggested place in the queue:** D45 goes **right after D42 and D41** — a board that shows nothing for seconds on every panel makes every other fix look broken. D46 follows D40 (it touches the same `+` view). D47 and D48 are UI and go last.

### D45 · ⛔ EVERY PANEL SHOWS AN EMPTY BOARD FOR THE FIRST SECONDS — on every switch, not just the first load

The owner: *"any panel I open takes a second before it loads and shows empty for the first few seconds"* — ALL, ★, /d and `+`, **every time**, not only when the site opens.

⛔ **Two defects, and they need separate fixes:**

**1 · An EMPTY STATE IS SHOWN WHILE LOADING.** ⛔ This is **"silence reported as success"** — the board says *nothing here* when it means *not here yet*. Whatever the speed, **loading and empty must be different states**, and the empty copy must never render until a response has actually arrived and been empty.

**2 · THE FETCH IS SLOW, OR IS REPEATED NEEDLESSLY.** The production board is **1,858 rows** — a table that size should answer in tens of milliseconds, so *seconds* means something is wrong, not that the data is big.

**MEASURE FIRST, per panel — report the numbers before changing anything:**
- time to first byte and time to first card for each of ALL / ★ / /d / `+`, on production data
- **server time per endpoint** (`/api/jobs`, `/api/jobs/facets`, the draft and import queries) — ⚠ which one is slow
- **is it a waterfall?** profile → facets → jobs fetched one after another, when they could run together
- **does a switch refetch from scratch?** (the panel unmounts and loses its data) · is the same request made twice?
- ⚠ **does the server score or rescore on the request path?** `A52`'s migration 118 made stored reports stale once, and a board pass that scores per request would be slow *every* time, not once
- ⚠ **D41(a) just made ★, /d and `+` views of ALL** — if each is now a separate heavy query over ALL, four panels pay the cost four times

**THE FIXES, in this order:**
1. ⛔ **Never show an empty state while loading.** Skeleton cards in the card's own geometry from the first frame.
2. ⭐ **Stale-while-revalidate:** keep the previous panel's data on screen, mounted, and refresh behind it. Switching ALL → ★ → ALL should be **instant** the second time.
3. **Do not unmount panels on a switch.** The state the user built (the sentence, the search, the scroll position) survives.
4. **Fire requests together, not in a chain.** **Prefetch** the other views on idle, or on hover of their control.
5. **Fix the slow query itself** once measured — an index, a join that should not be there, or work that belongs off the request path.

⛔ **Do not mask a slow server with a spinner.** If a query takes seconds, the fix is the query; the skeleton is for the honest tens of milliseconds.

✅ **Acceptance:** switching between the four panels shows **content or skeletons in the first frame**, **never an empty state**, and a warm switch is instant. Report p50 and p95 per panel on production data. ⛔ Tests: **the empty copy does not render while a request is in flight** · a second visit to a panel renders from cache before the network answers.

### D46 · ⛔ CARD DEFECTS IN THE `+` AND /d VIEWS

**(a) `+` imported cards — the text is clipped, only the upper half of the letters shows.** That is **vertical clipping**: a text block with a fixed height and `overflow: hidden`. D1 fixed the block at the **logo's height (52px) for three lines** — company, title, meta. D40 then added a **fourth line** (*captured date · from host*) to the `+` card, so four lines sit in a three-line box and the bottom is cut. ⛔ **Fix:** `min-height`, never a fixed `height`, on any text block; either **fold the captured/from info into the existing meta line** or let the `+` card grow by one line. ⛔ **No glyph may ever be clipped** — `line-height ≥ 1.2`, and the test renders each card at **100 / 125 / 150% zoom** and fails if any text node's box exceeds its container's.

**(b) /d (drafted) cards — stale, they do not open, and their logos do not open or load.** The cards render and do nothing when clicked; the logo does not appear or does not respond. ⛔ **This is the D41(a) model failing on the /d chip:** /d should be **ALL restricted to drafted jobs, rendered by the SAME card component** — a separate renderer or a missing `onClick` is how a card goes dead. **Report which:** a different component · a handler never wired (defect shape 2) · `pointer-events` · a stale snapshot row with no job to open. And **why the logo is missing** — the same logo lookup as the board, or a second one? (D41(c); A77.)

⛔ **The structural fix, because this is the third time:** **one `JobCard` component, rendered by all four views.** Pin it with a test that fails if any view imports a different card — three implementations of one mark is how the legacy brand shipped on every page while the guard passed green. ⛔ **Tests:** clicking a card in **each of the four views** opens the posting panel · each view's card is the same component · no text node is clipped.

### D47 · THE FILTER SENTENCE IS SET IN THE LOGO FACE, AT THE LOGO'S SIZE

✅ Owner 10-07: *"use the same font as the draft logo and the same size — it currently features a different font and styling."*

**This replaces the serif.** D34/D35's sketch set the prose in Georgia. The sentence is now **the logo's own face** — the heavy italic geometric sans of the `/draft` wordmark — **at the wordmark's size** (the top-bar mark, ~30px per D10). ⛔ **Tie the size to the wordmark's CSS variable**, not to a copied number, so the two cannot drift apart.

- ⛔ **D34 still holds:** **one family, one size, one line-height across the whole sentence.** Only the box (fill, border, radius, shadow) distinguishes a token. The family just changes from the serif to the logo face.
- It starts **lowercase** (*discovering…*), exactly as the wordmark is lowercase — which also settles the earlier question about the `d` (D37): the sentence is simply in the logo's lettering.
- ⚠ **At ~30px this is a LARGE sentence.** *"discovering all roles at all career levels and workstyles in the United States."* will wrap to about **two lines** in the 720–800px column. The owner chose it knowingly — **report how it wraps at 1280 / 1920 / 390**, and let the size scale down with the wordmark on a phone rather than overflowing.
- Tokens keep D34's boxes: active filled accent, inactive paper with depth, `+ add` dashed and shadowless. ⚠ Bold italic is heavy inside a box — check the padding so the token does not look cramped.

⛔ **Tests:** the sentence's computed `font-family`, `font-weight` and `font-style` **equal the wordmark's** · its `font-size` **equals** the wordmark's · prose and tokens share all three.

### D48 · THE POSTING PANEL'S HEADER, ACTIONS AND DECK — ✅ DECIDED 10-07

Sketch: **`posting-header2.html`** — ⛔ **build to the file, not to this prose** (D30, D31, D34, D35 all drifted when built from a description). The owner chose **a combination of all three concepts** from the first sketch; v2 is that combination.

**HEADER** (scrolls away): `[logo]  Company name (logo face, a link per D38)  ····  [ATS number box]  [×]`
- ✅ **The company name stays.** ⚠ It now appears twice — here and as the masthead's company line; drop the masthead's if it reads redundant (owner's call). ⛔ **DEFAULT: keep both** — the masthead was approved as it is.
- ⛔ **Out of the header:** the title (the masthead has it) · *On-site · location · salary · 3d · Strong* · the keyword chips (the ATS card has them).
- ✅ **THE ATS BOX shows the NUMBER, not the band.** A small square (~50px) with D1 depth, the number in **the ATS card's own display face** (the serif its header number uses) with a tiny *ATS* caption beneath. In light mode the number uses `--atx`, not `--accent` (2.96:1). Click → opens the ATS card beside the posting (D39); open = an outline, as on the sentence's words. **No score → the dashed box with the bars icon and no digits** — *"not enough signal"* is the scorer declining, never a 0. See D50.

**ACTIONS — A and B are ONE component with two renderings, chosen by the PANEL's width, not the window's:**
- ✅ **A · labelled boxes when the panel is wide enough** (~600px of panel width): *Pass · Save · /d Draft | Résumé · Cover letter*.
- ✅ **B · icon squares when it is condensed:** 48px squares, `/d` on Draft with the quota as a badge, a tooltip each.
- ⛔ **Use a CONTAINER query on the panel, not a viewport media query.** With the ATS card open the posting panel is roughly half the window — a 1280px window can need B while a 1920px one shows A. The panel's width decides.
- ⚠ **B has no tooltips on touch.** On `(pointer: coarse)` the squares carry a small caption beneath, so a phone is never left guessing which icon is *Résumé* and which is *Cover letter*.
- The quota (*"10 of 10 drafts left in the last 24 hours"*) is a muted line in A and a badge + tooltip in B.

**STICKY AT THE TOP, not the bottom.** ✅ The action bar sticks to the top of the posting panel's scroll area while the posting scrolls beneath it — **exactly as the board's bar sticks on the home page.** It is built from **the shared `StickyBar` module (D49)**, not copied. ⚠ *Open question for the owner:* the header scrolls away, so **×** is out of reach in a long posting (Esc and the backdrop still close it) — should × live in the sticky bar? At ~620px it does not fit beside A's five boxes. ⛔ **DEFAULT, so the build is not blocked: × stays OUT of the sticky bar** (it is in the header; Esc and the backdrop close from anywhere). Change it only if the owner says so.

**THE DECK STRIP** (the editorial masthead, D32 — a shared component, so **every surface that renders it changes**): *Experience · **Workstyle** · Salary · Posted.* ✅ **"Workstyle" replaces "Where"**; the value is the workstyle (*On-site · Hybrid · Remote*). ⚠ **Location loses its cell** — the header chip that carried it is gone — so it sits on a **muted second line under the workstyle** (*On-site / New York, NY; Pittsburgh, PA*). *If the owner wants location dropped from the strip altogether, say so — it would then appear nowhere on the panel.*

**⛔ THE BUTTON SWEEP — the larger half of this row.** The owner: *"probe the entire site for these Apple-styled buttons and replace them with the latest box-styled depth ones."*
1. **Find every interactive control in the old pill style** — fully-rounded, dark or flat, no depth: the posting panel's Pass / Saved / Draft / Generate résumé / Cover letter, and wherever else the pill survives. **List every call site and class.**
2. **Replace them with ONE depth-box button component** — D1's rest / hover / press values, the orange-tinted primary — and have every site use it.
3. ⛔ **The rule, pinned by a guard:** *pills are for non-interactive tags and status; interactive controls are depth boxes.* A guard that fails when a `<button>` is given a fully-rounded radius outside the allow-list (the segmented views control is the one deliberate exception).
4. ⚠ **Screenshot every surface before and after** — four things were once green and wrong, and the only thing that disagreed was looking at the output.

### D49 · THE `StickyBar` MODULE — one sticky-at-the-top section, reused

✅ Owner 10-07: *"use the same code modularly … make it a modular section that can be reused and reuse it here."*

**Extract it from the board.** The Full House bar already sticks to the top as the page scrolls. Lift that behaviour into **one component (or hook + CSS) — `StickyBar`** — and make **both** consumers use it: **the board's bar** and **the posting panel's action bar** (D48). ⛔ Two implementations of one behaviour is how the mark, the cards and the buttons all drifted.

**The module owns:**
- `position: sticky; top: 0` against **the nearest scroll container** — the page for the board, the panel's own scroll area for the posting — chosen by the consumer, never a hard-coded `window`.
- a **stuck state** (`is-stuck`), found with an **IntersectionObserver on a 1px sentinel** placed just before the bar — **not scroll listeners** — that adds the hairline and the shadow only when it is actually stuck.
- a translucent surface with a blur, so content passes under it legibly; a **named z-index token** (`--z-sticky`, above content and below `--z-nav`) — no literals.
- `prefers-reduced-motion`: no transition on the shadow.

⛔ **Tests:** both consumers import the same module · the stuck class appears after scrolling past the sentinel and **not before** · the bar stays inside its container (it does not escape the panel) · removing the module breaks both. ⚠ **Sticky fails silently under any `overflow: hidden` ancestor** — so the test must render it in the **real panel**, not an isolated div. The sketch's tab 2 runs the board's bar on the same module.

### D50 · THE ATS NUMBER IS SHOWN — ✅ owner decision 10-07, tuning to follow

Owner: *"show ats number not band — we will get around tuning it by end of day."*

**This overrides the earlier condition** — the number stayed off (`ATS_NUMBER_SHOWN`) until A76's validation justified it. ⛔ Record it as **the owner's decision to show it now and tune after**, *not* as validation having passed: ρ is **0.723 over the US-only graded set (n = 24)** and the engine scored **−0.166 on 21 held-out postings.** That is exactly why **a provisional note belongs on it** — *"match score — still being tuned"* as the box's tooltip and a footnote in the ATS card.

**Where the number appears:** the posting header's box (D48) · the ATS card's header (D31 — the number beside the band; the band stays in the card) · the board card's ATS square (D1 — already specified to carry the score). The sort control's *Best fit* stays a word. ⛔ **In the ATS card the band, the number and *"9 of 12"* stay together**, so the number is never the only claim.

⚠ **Web only.** The mobile contract still marks `matchScore` *INTERNAL — DO NOT DISPLAY* and Android is vendored at 1.2.0 — **update the contract's annotation in the same commit** (A75's rule) so it does not contradict the product, and leave the apps as they are until the owner says otherwise.

⛔ **No score → no digits.** *Not enough signal* stays the dashed box (D1) — **never a 0.** ⛔ **Tests:** the number renders in the posting box, the ATS card and the card square · a null score renders **no digit anywhere** · the provisional note is present wherever the number is.

---

## ⛔⛔ D36 · EVERY APPLY PATH, END TO END — the same treatment D33 gave capture

**🚀 LIVE 10-06 (29): `65a9838` — 3366 / 3366 / 0, client builds.** **🔨 BUILT, ⛔ NOT DONE — DONE needs the owner's ATTENDED real application on each path (O73), per `docs/D36_ATTENDED_RUNBOOK.md`.** Walked as a user against the LOCAL fake ATS only (synthetic user, keys blanked, a no-model tools stub; FULL AUTO in a harness copy) — nothing reached an employer. **Measured per path** (rows, score, provenance, gates, caps, response, artifact) in the D36 report: MANUAL → `job_applications` with `ats_score_at_apply` 90 (`local_ats_v5`) · SEMI → preview superseded → approved run submitted + verified, score 90 · GATED → held `login_required`, ⚠ no résumé and a NULL score on that path (O73b) · FULL AUTO (harness) → Ashby submitted, Lever/Greenhouse held. ⭐ **Refuted:** "in SEMI the completeness and low-confidence gates don't run" — D25's preview + approve are both unattended and both gates fired live; only the legacy `run.mode='semi'` skips them, and nothing starts it. ⭐ `recordAtsOutcome` DOES fire with the job id — the null rows were user 0's 09-05 scripts. **Fixed, one commit each:** ⛔ the kill switch did not stop a run IN FLIGHT — now checked right before the submit click, fail-closed (`18c6794`) · ⛔ FULL AUTO was admitted via approvalMode `auto` from two routes — locked at admission (403 `full_auto_locked`) and processing (`ed6e7d2`) · ⛔ **eligibility was guessed** — on a trap page the old code submitted ethnicity = city, sponsorship "No" ×3 from a DEFAULT, clearance "no", citizenship = country; now blank + refusal recorded (`8a08222`) · an approved run said "No resume was generated" over one that existed (a `::` in a Windows temp name, swallowed; `8d73869`) · a refused answers-retry lost the held application (`8df5f53`) · approving refunded the Draft slot (`eb4e0c3`) · the contradictory preview log (`bc6cbcf`) · kill-switch copy offered a mode that doesn't exist (`8f75dde`) · a failed review overlay read as success — **extension v1.4.1** (`051958e`; zip built, not uploaded) · a gated handoff never reached Pending (`e7327cc`). Proofs pinned: `ca13b7a` (the row + score), `70abb4b` (429 / dead container / timeout stay retryable), `b7c3051` (nothing submits on a gesture); g3's real-Chrome overlay run passed. Two generation-call defects → **A88**.

⏸ Queued 2026-10-05 by the owner. ⭐ **D33 asked one question of the capture path — "does a real job
reach the board?" — and it found a 502, a missing job and a page asserting something it could have
checked.** ⛔ **Ask the same question of every apply path, before AF5 sends thirty applications
through them.**

### ⛔ Why now, and not after AF5

- **The pipeline has completed ONE real application.** Every state below has been exercised in tests
  and essentially never against a live employer.
- ⛔ **`recordAtsOutcome` has NEVER fired** — every `resume_generate` event since it landed carried
  `job_id = null`. **`job_applications` is empty.**
- ⛔ **In SEMI, `isUnattended = isFullAuto || isPreview`** — so **neither the completeness gate nor the
  low-confidence gate runs.** The human is the only check, and that check has never been load-tested.
- ⚠ **The kill switch is verified at ADMISSION only**, not mid-batch.
- ⭐ **Thirty applications go to real employers under the owner's real name.** A defect found on
  application nineteen is nineteen applications too late.

### The paths, each walked ONCE with a real posting

```
1  MANUAL          generate → review → the user applies on the employer's site themselves
2  SEMI            queue → prepare → the user approves → submit
3  GATED HANDOFF   the extension fills a portal form under activeTab → THE USER submits
4  FULL AUTO       queue → prepare → gates → submit, unattended   ⛔ NEVER RUN against a real employer
```

⛔ **Walk each one as a user, not as a test.** A passing test proves the code does what it was
written to do. ⭐ **This project has had NINE instances of green tests beside a live defect** — that is
the whole reason D33 existed.

### ⛔ What to report for EACH path

```
THE ROW         which table got what. ⛔ apply_run_jobs AND job_applications, by id.
                If job_applications is still empty after a submit, SAY SO — that is the finding.
THE SCORE       ⛔ is ats_score_at_apply populated? base_ats_score was NULL on the one row we have.
THE PROVENANCE  per field: handler_map · field_map · fuzzy · custom_answers.
                ⚠ Report the FUZZY ones by name — that is where login_email matched the email
                handler at 0.9 and typed a home address into a sign-in box.
THE GATES       which fired, which were SKIPPED, and why. ⛔ In semi, two do not run at all —
                confirm that is still true rather than assuming it.
THE CAPS        per-run, per-day, per-company — did each decrement, and does the UI agree?
THE RESPONSE    ⛔ what the USER was told, verbatim. A path that succeeds silently and a path that
                fails silently look identical from the outside.
THE ARTIFACT    can the generated résumé be retrieved afterwards? That is what D15/D16 promise.
```

### ⛔ The specific things to prove, not assume

1. ⛔ **ONE application first, then the rest.** Run a single end-to-end submit and **confirm
   `job_applications` holds a row with `ats_score_at_apply` populated** before anything else runs.
   ⭐ **That data is unrecoverable once the applications are sent**, and four cents buys the check.
2. ⛔ **THE KILL SWITCH, MID-BATCH.** It was proven once at admission — 1 of 3 submitted, 2 held.
   **Prove it stops a run already in flight**, on every path that can run unattended.
3. ⛔ **A FAILED RUN STAYS RETRYABLE.** A 429, a dead container or a timeout must not stamp an
   application as attempted — the `enrichJob` rule.
4. ⚠ **ELIGIBILITY FIELDS ARE NEVER GUESSED.** Work authorisation, sponsorship, visa, clearance, EEO:
   exact mapping or **flag and stop**. ⛔ A `work_authorization` key once substring-matched an
   **inverted** sponsorship question. Check every one by hand.
5. ⚠ **NOTHING SUBMITS ON A GESTURE OR A KEYSTROKE.** Draft queues; approval is separate and
   deliberate. The Android build once displayed **"Application sent"** for 2.5 seconds having sent
   nothing.
6. ⚠ **THE REVIEW OVERLAY ACTUALLY APPEARS** on the gated path — it is what proves fill-and-review
   rather than auto-submit, and it is what a Web Store reviewer looks for.
7. ⛔ **FULL AUTO RUNS ATTENDED ONLY.** A human approves every submit until this audit and AF5 have
   both passed. The toggle may exist; it may not be flipped.

### ⚠ Where the defects will be, if D33 is any guide

⭐ **D33 found three things and none of them were in the code that does the work:** a page that threw,
a job that arrived and was never mentioned, and a surface asserting something it could have checked.
⛔ **Look hardest at the seams** — what the user is told, what the row says afterwards, and whether a
success response and a silent failure are distinguishable.

✅ **DONE MEANS:** one real application completed on **each** path, with the row, the score, the
provenance, the gates and the user-facing response in the report — **or a named defect for each path
that could not complete.** ⛔ "The tests pass" is not an answer to this row.

---

# D — DESIGN DECISIONS (visualised, chosen, specified)

⛔ **`D##` is a THIRD sequence, separate from `O##` and `A##`.** These are designs the owner and the
assistant worked out through interactive HTML sketches and **chose**. ⭐ **The sketch is the
specification** — build to the spec below, not to an interpretation of it.

⛔ **The agent does not create or renumber `D##` rows.** Agent-raised findings are `F##`. Two writers
on one sequence is what produced the duplicate A51/A52 and A66/A67 collisions.

---

## ⛔⭐ D17 · **ONLY RÉSUMÉ GENERATION MAY CALL A MODEL — everything else is in-house or manual.** DECIDED 2026-10-03

⛔ **This is a standing constraint, not a task.** It governs every row above and below it, and it is the
reason the manual export/import paths exist at all.

### The rule

```
MAY CALL A MODEL     résumé generation (and its A+ / cover-letter siblings)

⛔ MAY NOT           everything else. No exceptions without an explicit owner decision
                     recorded here.
```

**Where that bites, by name:**

| | |
|---|---|
| **A76 — the validation corpus** | ⛔ **NOT an API call loop.** Build the **export → grade → import** path: emit the sample as a file the owner grades externally, and import the grades back. ⭐ The machinery already exists — `enrichment_batches`, `enrichment_batch_rows`, the five import guards, the staleness interlock, the revert path. **Reuse it; do not write a second one.** ⛔ The import must **grade blind** the same way the original corpus did — scores withheld from the grader |
| **Enrichment** | Already has the manual path. ⭐ That path is now the **primary** one, not a fallback |
| **PDF→text (A70)** | ⛔ Already decided free and ungated. **O16e's local deterministic extractor is now REQUIRED**, not optional — a model call for a library job is exactly what this rule forbids |
| **ATS scoring** | ⭐ Already zero model calls. **This is the model for everything else** |
| **Capture** | ⭐ Already degrades deterministically via `jobFromLabelledText()`. ⛔ The model path becomes the exception, not the default |
| **Job classification, dedup, slug harvesting, R1 grade-the-posting** | ⛔ Deterministic by construction. None of them may acquire a model call |

### ⭐ Why this is the right call, recorded so it is not re-argued

1. **Cost is bounded and attributable.** One call site, one purpose, one line in `usage_events`.
   Everything else becomes a fixed cost of running the code rather than a per-row charge.
2. ⭐ **Deterministic beats a model at most of these anyway.** Scoring, extraction, dedup and
   classification are **reproducible, testable and free** — and a model made several of them *worse*:
   Groq measured **30.5% Jaccard** on `skills_json`, and `max_tokens: 500` silently truncated
   reasoning models twice.
3. ⭐ **It makes the product survivable.** An unfunded balance currently takes enrichment,
   generation and cover letters to zero. Under this rule it takes **one feature** to zero and the
   rest keeps working — which is what the capture fallback already proved.
4. **The owner can complete the work by hand**, with a free subscription elsewhere, at no cost to
   the project. ⚠ That is only true if **every batch job has an export and an import**.

### ⛔ What every in-house/manual path must have

```
EXPORT     a file the owner can work on outside the product, in a stated format
IMPORT     validated on the way back in. ⛔ The five existing guards are the standard:
           invalid_value · stale · unknown id · concurrency · refusal that reconciles
PROVENANCE a batch row, so a bad import can be identified and reverted whole
REVERT     dry-run first, showing before/after pairs — as the enrichment revert already does
IDEMPOTENT re-importing the same file twice changes nothing
```

⚠ **Measure what it costs to NOT use a model, and say so.** Several of these were justified by a
model being better. ⛔ If the deterministic version is materially worse, **report it rather than
quietly shipping a regression** — the synonym table moved ρ by **+0.000** and that was worth knowing.

### ⚠ The one open question

**Generation itself still calls a model, and it is the most expensive call in the product.** This
rule does not change that — it isolates it. ⭐ **That also makes prompt caching matter more, not
less**, since generation is now the only workload worth optimising.

---

## QUEUED 2026-10-04 — batch five

| | Task | Notes |
|---|---|---|
| **D34** | ⛔ **THE SENTENCE'S TYPE AND THE BOARD'S VERTICAL ORDER — corrections to shipped D30** | **🚀 LIVE 10-05 (28): `77b1948` (`/api/version`), merged on the owner's "complete all the log items" — 3348 / 3348 / 0, client builds; mobile contract 2.2.0 (additive).** **✅ BUILT with D35** (`2c72c75`). **One family, size and line-height:** Georgia 23px/1.85 from `header.html` (`styles/type.js` `FULL_HOUSE_TYPE`, published as `--fh-*`); every token rule inherits — only background, border, radius and shadow differ. **Measured in the browser at every width: prose = token = Georgia 23px / 42.55px.** The sketch's `.tok` `line-height: 1.3` survives only as the box height. Order: sentence → open panel → bar → jobs. The dials became the words (D35); the filter icon is deleted. Test ④ fails on any token font rule (3 injected red). ⚠ `jd2.html` in Downloads has **no tab C**, and its filter tokens are Poppins inside Georgia — the very divergence this row forbids — so `header.html` set the type (O70f). **⏸ WAITS ON THE SKETCH 10-05 (27) — O68.** `jd2.html` is not on this machine; the row says check against it, not the prose. ✅ Owner 10-05, with a reference screenshot of `jd2.html` tab C. ⛔ **D30 shipped with the typography changed from the approved sketch. Put it back.**<br><br>### ⛔ 1 · ONE FONT, ONE SIZE, ACROSS THE WHOLE SENTENCE<br>⛔ **The built version changed the face and the size between the prose and the tokens. That is the defect.** In the approved sketch the sentence reads as **one continuous line of type**: the connective prose and the filter words are the **same family at the same size**, and the tokens are distinguished **only** by their box — fill, border and depth.<br>⚠ **The box is the whole signal.** It does not need a second face or a second size to help it, and using both is what made the built line read as two things stitched together rather than a sentence.<br>⛔ **Do not re-letter the tokens.** Same font-family, same font-size, same line-height as the words around them; only `background`, `border`, `border-radius` and `box-shadow` change.<br><br>### ⛔ 2 · THE TOKENS ARE BOXED, PER THE ORIGINAL MODEL<br>Reference: the attached shot of `jd2.html` tab C — *"Show me **Senior** jobs that are **Remote**, posted **this month**, where my fit is **Strong**"* with **+ add**.<br>· **Active token** — filled `--accent`, orange-tinted depth, dark text.<br>· **Inactive token** — `--paper` fill, `--edge` border, `--lift` depth, ink text.<br>· ⭐ **`+ add`** — same box, **dashed border**, `--faint` text, no shadow. It is how a filter that is not yet set stays discoverable **inside** the sentence.<br>· **Hover** — `translateY(-2px)` + `--lift2` + `--atext` border, exactly D1.<br>· **Radius ~9–10**, padding tight enough that the box hugs the word without breaking the line's rhythm.<br>⚠ Every value comes from the **token file**; the guard fails on anything outside it.<br><br>### ⛔ 3 · VERTICAL ORDER ON THE BOARD<br>✅ **Owner's order, top to bottom:**<br>`1` **the sentence** — the page's headline<br>`2` **the dials** — immediately beneath it<br>`3` **the search bar**<br>`4` **the board**<br>⚠ **This is a change from what shipped**, where the bar sits above. ⭐ **It is the right order:** the sentence states what you are looking at, the dials are how you change it, and search is a narrower action **within** that state — so it belongs after the thing it narrows, not before it.<br>⛔ **The dials stay visible, not behind the filter icon.** D30's "both panels closed by default" applied to the old drawer model; the dials are the inventory and the owner wants them on the page. ⚠ **Then say what the filter ICON still does** — if the dials are always visible, the icon's badge may be the only thing left for it, and a control with nothing behind it is the A73 shape.<br><br>⚠ **CHECK AGAINST THE SKETCH, NOT THE DESCRIPTION.** `jd2.html` was reported as *"not found"* when D31 was built, and that row was built from prose instead — ⛔ **which is how the type drifted in the first place.** The sketches live in the chat's outputs; ask for the file rather than inferring it |
| **D35** | ✅⭐⭐ **FULL HOUSE HEADER — SHIP AS SKETCHED. `header.html` is the specification.** | **🚀 LIVE 10-05 (28): `77b1948` (`/api/version`), merged on the owner's "complete all the log items" — 3348 / 3348 / 0, client builds; mobile contract 2.2.0 (additive).** **✅ BUILT: `2f49f2a`** (facets gains live `coverage {level, where, employment}` + `views {all, saved, pending}`; one `pendingJobsQuery` for the list and its count) **+ `2c72c75`** (the header). **Words are the widgets:** one panel beneath the sentence; the same word closes it; one at a time (`nextBoardPanel`); `aria-pressed` = the active fill, `aria-expanded` = the open outline — separate, and a word can carry both. Zero-count options `aria-disabled`, dimmed, never hidden; the US floor is the location panel's first pill. **The bar:** `[ALL · ★ · /d with counts] [search] [⇅ 40px] [+ 40px]`; on a phone (≤ 600px) two rows — views + the two squares / search full width. Panel copy is LIVE from facets — a test fails on the row's literal figures (47.5, 7.7%, 537, 2626, 674). **Deleted, every call site:** `BoardPanelIcons.jsx`, `FilterDials.jsx`, `BoardPanels.css`, `activeClauseCount`, `focusDial`, `ExtensionAddJobsLink`, the board's `UnifiedSearchBar` render (the landing page keeps it); the FiltersPanel drawer stays, behind "+ add → salary & more". `FH_*` tokens, dark re-derived; every pair AA (lowest: the open outline 4.84 light). §7's seven tests pinned, 25 injected red. Shots `draft-screenshots/d35-full-house-header/` — 24 built + 16 of `header.html` at the same widths. Owner calls: **O70**. **⏸ STOPPED AS THE ROW INSTRUCTS 10-05 (27) — O68.** `header.html` is not on this machine; nothing built. D34 + D35 run as ONE lane once the files are here (same components). ✅ Owner 10-05: *"ship it as it is shown to me with respect to the UI."* ⛔ **Build to the sketch file, not to this prose.** `header.html` is in the chat outputs — ⚠ **ask for it.** `jd2.html` was reported *"not found"* when D31 was built and that row was built from a description instead, **which is exactly how D30's typography drifted** (D34).<br><br>### ⭐ 1 · THE FILTER WORDS ARE THE WIDGETS<br>⛔ **The filter icon and its panel are REMOVED.** Once the words became the controls the icon had nothing behind it — **a control with no purpose is the A73 shape**, and D34 flagged it as an open question. This closes it: delete it.<br>⭐ **Click a filter word → its options open directly beneath the sentence. Click the SAME word again → it closes.** No drawer, no icon, nothing to discover.<br>⛔ **Only ONE panel open at a time** — opening another closes the first, or the sentence jumps as panels stack.<br>⛔ **"Open" and "active" must be DIFFERENT signals.** An open word carries an **outline** (`outline: 2px solid --atx; offset 2px`) in addition to whatever fill its active state already has. ⚠ A word can be both.<br><br>### ⛔ 2 · TYPE, per D34 — unchanged and non-negotiable<br>**One family, one size, one line-height** across the prose and the tokens. Only `background`, `border`, `border-radius` and `box-shadow` differ. ⭐ **The box is the whole signal.** `+ add` stays **dashed and shadowless**.<br><br>### ✅ 3 · THE CONDENSED BAR — one row, below the sentence, above the jobs<br>`[ ALL · ★ · /d ]  [ search ———————— ]  [ ⇅ ]  [ + ]`<br>· **The three views as one segmented control**, each with its count — `ALL 2626` · `★ 14` · `/d 9`.<br>· **The search field fills the middle**, inset shadow, magnifier glyph, no separate Search button.<br>· ✅ **SORT USES THE SAME SYMBOL AS THE SKETCH** — the two-arrow up/down glyph, in a **40px square icon button** with the D1 depth values, **open = filled accent**, matching the filter words' open treatment.<br>· ✅ **ADD JOBS BECOMES JUST `+`** — ⛔ **bold italic in the logo face**, no label, in the **same 40px square** as the sort button. Accent fill with the orange-tinted shadow, since it is the one creative action in the bar.<br>⚠ **Both squares are the same size as each other and as the sort icon** — the bar reads as one rhythm, not as a toolbar of mismatched controls.<br><br>### ✅ 4 · VERTICAL ORDER (D34 §3, confirmed)<br>`1` the sentence · `2` the open panel, when a word is clicked · `3` the condensed bar · `4` the jobs.<br><br>### ⚠ 5 · WHAT THE PANELS MUST SAY<br>· **location** — ⛔ *"The United States is the floor — it can be narrowed, never cleared."*<br>· **workplace** — ⚠ *"47.5% coverage — postings with no workplace on file are kept, not hidden."*<br>· **level** — *"3 postings have no level on file — kept, not hidden."* · **intern** at 0 is **dimmed, not hidden**.<br>· **`+ add`** — lists what is available, and ⛔ **says employment type is at 7.7% and cannot carry a filter yet.**<br>· **sort** — keeps *"537 jobs have no ATS score yet, so they sort last whatever you pick. Newest shows everything."*<br><br>### ⛔ 6 · ACCESSIBILITY, or this is mouse-only<br>⛔ **Tab order follows reading order**, and the panel must be **reachable from the word that opened it**. `aria-expanded` on each word, `aria-pressed` for active state, `aria-checked` on the options. ⚠ Hover-only affordances are not enough — the same `:focus-within` rule as D1.<br><br>✅ **Both themes from one token set**, as in the sketch. ⚠ The dark values are **re-derived, not converted**.<br><br>### ⛔ 7 · EXECUTION — for the agent<br>⛔ **ASK FOR `header.html` BEFORE WRITING ANY CODE.** It is in the chat outputs and it **is** the specification — the markup, the CSS, the toggle behaviour and both themes. ⚠ **Do not build from this row's prose.** `jd2.html` was reported *"not found"* for D31 and that row was built from a description instead, **which is how D30's typography drifted** (D34). If the file cannot be reached, **say so and stop** rather than inferring it.<br><br>**WHAT CHANGES, by component:**<br>· **`BoardHeadline`** — keep its derivation. ⭐ **The sentence remains a projection of filter state, never a second source of truth** (D30). Only its **type and token styling** change, per D34 §1–2.<br>· **`FilterDials`** — ⛔ **replaced.** The six always-visible dials become **the words themselves**, each opening one shared panel beneath the sentence.<br>· **The filter icon and its drawer** — ⛔ **deleted.** Report every call site touched; a removed control must not leave a dangling handler (defect shape 2).<br>· **The search bar** — condensed to one row per §3. ⚠ The views segment, search, sort and `+` were separate elements; they become one bar.<br>· **`/api/jobs/facets`** — unchanged. The counts and coverage figures the panels show already come from it.<br><br>**PIN THESE AS TESTS — each must go RED when removed:**<br>`1` clicking a word opens its panel; **clicking the SAME word closes it** · `2` opening a second word **closes the first** · `3` the open outline and the active fill are **separate attributes**, and a word can carry both · `4` **prose and token share font-family, font-size and line-height** — ⛔ this is the D30 regression, so it needs a test that fails on divergence, not a screenshot · `5` the location panel **cannot clear the United States floor** · `6` a zero-count option is **dimmed and not selectable**, never hidden · `7` every word is **reachable by keyboard**, and the panel is reachable from the word that opened it.<br><br>⚠ **SCREENSHOT BOTH THEMES AT EVERY BREAKPOINT**, with a panel open and closed. ⛔ D30 shipped with **no screenshots** because the throwaway server was reaped (O63) — **and that is the build whose typography was wrong.** If screenshots cannot be taken, **say so in the report**; do not mark it done.<br><br>⚠ **Report the phone answer.** At narrow widths the one-row bar cannot hold four elements — say what it becomes rather than letting it wrap into something nobody chose |
| **D33** | ⛔⛔ **ONE CAPTURED JOB, END TO END. Owner-blocked on production 10-05.** | **🚀 LIVE 10-05 (27): `0f97ca3` (`/api/version` 20:32Z; `/extension` 200, `/api/health` ok), merged on the owner's go — 3332 / 3332 / 0, client builds. ⛔ ACCEPTANCE IS THE OWNER'S: O67.** **✅ BUILT (27), branch `d33-capture-end-to-end`.** **1 · the 502** (`b40aa02`): the app cannot 502 the document (the route exists; every 502 server.js writes is under `/api/`) — it was Railway's edge with no listener: `railway.toml` had **no healthcheck** (three deploys on 10-05 during the owner's session) and an unhandled rejection exited the process. Now `healthcheckPath = "/api/health"` (timeout 300) + a logging `unhandledRejection` handler; a test pins the path to a real API route ahead of the catch-all. **2 · the path** (`4c79155`): ⛔ the 24h freshness fast path returned before `ingestJob` and wrote **no `job_captures` row** (now `action='attached'`) · a bare "Remote" with no US evidence is held `remote_region_unstated` (D29 rule unchanged) · ⛔ the ★ upsert never moved `domain_profile_id` or cleared a pass, so a starred capture could be missing from ★ Saved (fixed) · the extractor sent no location for remote JSON-LD postings (now `Remote (United States)`). **3 · says why** (`1b9a417`): one `capture` object worded in `captureOutcome.js` — inserted · attached + link · held + why · closed — shown as given in the popup (green only when on the board) and on `/extension`; a 2xx with no capture object is a failure. **Extension v1.4.0**, zip built, ⏸ not uploaded. **4 · install** (`7641278`): `connected` / `not_connected` / `not_installed`; no "Get the extension" for a connected user. **5 · D17** (`77ac3e8`): import is deterministic only (JSON-LD → labelled block); `IMPORT_MODEL_ID`, the model call, the 503 and `degraded` are gone; the D17 ratchets agree. +30 tests, all injected red. Shots `draft-screenshots/d33-capture/` (`responses.json` beside them). ⚠ Seen, not changed: the marketing header says "Sign In" while signed in; the ★ card pill says "Outside the US" for "Remote, region unstated". ⭐ **The acceptance test is one sentence: the owner captures a posting with the extension and sees it on their board.** That has never been demonstrated, and D12 made the extension **the only import route** — so until this works, there is no way to get a job into draft by hand at all.<br><br>**WHAT THE OWNER OBSERVED:** captured a job (US, remote) · ⛔ **it is not on the board** · ⛔ **`/extension` returns 502** · ⚠ the page offers *"download extension"* **while the extension is installed and enabled**.<br><br>### ⛔ 1 · THE 502 FIRST — it is a thrown error, not a missing page<br>⛔ **A 502 means something threw server-side.** The SPA catch-all returns **200** for unknown paths — that has produced a **false finding five times** — so a real 502 is a route failing, not an absent one. ⚠ The console shows `extension:1`, so **the document request itself fails**, not an asset. **Establish:** was D12's `/extension` page built at all · is there a route that throws on render · does it depend on something unset in production.<br><br>### ⛔ 2 · FIND THE JOB. `job_captures` WAS BUILT FOR THIS QUESTION.<br>⭐ Migration 122 records **what came in, from where, the ATS host and slug, and what the gateway did.** Run it before changing any code:<br>`SELECT id, job_id, url, ats_type, ats_slug, origin, action, out_of_market FROM job_captures ORDER BY id DESC LIMIT 5;`<br>**Three outcomes, three different problems — report which:**<br>· ⭐ **`action='attached'`** — **most likely.** The job IS on the board, merged into an existing row under a different id (A49 #4 attaches and says so rather than duplicating). ⛔ **Then the defect is that nothing TOLD the owner** — and possibly that the star went to the wrong row. **Check `user_jobs` for the attached `job_id`, not the captured one.**<br>· ⚠ **`out_of_market=1`** — held off the shared board. The owner says US + remote, so this should not fire — ⛔ **but a posting that says only "Remote" with no region carries no POSITIVE US evidence, and D29's gate admits only positive evidence.** That is the most likely false negative here. `gateOutOfMarket` logs to `rejected_jobs` — look there.<br>· **`inserted`, `out_of_market=0`** — it is on the board and starred, so the bug is in the ★ view, not ingestion.<br>⛔ **If there is NO `job_captures` row at all, the capture never reached `ingestJob`** — then it failed at extraction, and ⚠ **import makes a model call**, which returns **503 `retryable:false`** on an unfunded balance. Check `usage_events` for the attempt.<br><br>### ⛔ 3 · THE GATEWAY MUST SAY WHY A CAPTURE IS NOT ON THE BOARD<br>`jobGateway.js` already says it in a comment: *"the caller still attaches it to the user and must say why it is not on the board."* ⛔ **Verify the caller actually does.** A capture that returns success and then cannot be found is **"silence reported as success"** — defect shape 3, and the most common one in this codebase. The response must distinguish: **inserted · attached to an existing posting (with a link to it) · held off the board, and why.**<br><br>### ⛔ 4 · THE INSTALL STATE IS KNOWABLE — STOP ASKING<br>⭐ **`routes/extensionStatus.js` already exists.** The extension holds its own token and announces itself. ⛔ A page that offers a download to someone who has it installed is the same class as the **"Not linked"** label — **a surface asserting something it could have checked.** Three states, not one: **not installed** → install · **installed, not signed in** → connect · **installed and connected** → what to do with it.<br><br>### ⚠ 5 · AND THE D17 CONTRADICTION, while this path is open<br>⛔ **Import still calls a model** (`IMPORT_MODEL_ID = MODEL_HAIKU`), and **D17 confines model calls to résumé generation.** ⭐ The deterministic fallback `jobFromLabelledText()` already exists and already works — ⛔ **invert the order: deterministic first, model never.** That also removes the 503-on-unfunded failure mode from the only import route the product has.<br><br>✅ **DONE MEANS:** the owner captures one posting and **sees it on their board**, or is **told precisely why it is not** — with the `job_captures` row, the response text and a screenshot in the report |
| **D32** | ✅⭐⭐ **THE POSTING AND THE SCORE AS AN INK-ON-DARK PAIR — CHOSEN 10-04** | ⚠ **D32's type and boxes drifted from `pair2.html`** (built from prose; the sketch was not on the machine — O68). **Corrected by A86** — **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **🚀 LIVE 10-05 (27): `47c0373` (`/api/version`, contract 2.1.0), merged on the owner's go — 3302 / 3302 / 0, client builds.** **✅ BUILT (27): `801968b` + `b9b62b3` on `d32-ink-pair`.** **Score half** (`AtsReport.jsx`, still the one component): band · *"You cover 9 of 12 things this posting asks for"* · the number in serif accent (⛔ still gated on A76) · a three-segment bar (matched · missing · generic; generic not counted). Rectangular boxes, radius 9, `--c-pair-lift/-lift2/-press`, no transition. ONE "You could claim" block with **kind labels** (skill · verb · quality — the scorer's own bucket, carried, not flattened); an **Experience row** (met / short / unknown / none); "Already yours" + "Generic — not a gap" folded. **Posting half** (`PostingPanel.jsx`, new): kicker from D29's tags + serif title + logo-face company + the four-cell strip ("not stated" as an italic-serif value; Experience tints when met); the body is the employer's text via `shared/postingFormat.js` (drop cap, small-caps headings, accent bullets — **0 / 2,616 word-order mismatches**); years = regex + word-number map (`shared/postingFacts.js`). No model call. **The only dark surface is a RULE:** `PAIR_*` tokens in both palettes, `.ink-pair` worn by the two halves only, guarded; the extension skips `PAIR_*`. 29 contrast pairs pass in both themes (lowest: UI edge 3.87 light / 4.35 dark). Wide: sticky report column; phone: the score header collapses above the posting. Hover link built (hover/focus only, deck pair only). **Coverage (2,616 local):** function 76.0 · level 66.7 · workplace 44.3 · years 50.9 · salary 52.0; kicker with no tag 4.9%. `atsSimpleCardD31` (8) retired into `inkPairD32` (19); 22/22 injected red. Shots `draft-screenshots/d32-ink-pair/` (64). ⚠ `pair2.html` not found — built from the row text (O68). Owner: **O66**. Sketch: `pair2.html` (theme toggle). Supersedes the JD explorations in `jd.html`–`jd4.html`.<br><br>⛔⭐ **ZERO MODEL CALLS, AND THAT IS WHY THIS VERSION WAS CHOSEN.** The kicker comes from **D29's tags**; title, company, where, salary and posted are **already columns**; `4+ yrs` is a **regex** on `\d+\+?\s*years?`; the drop cap is **CSS**; the body is **the original description, formatted**. ⭐ **The only parts that needed judgement — the "what they need / would be nice / said-not-counted" sectioning and the pull quote — are exactly the parts the owner cut.** D17 is satisfied at no cost. ⚠ One bounded gap: *"a minimum of four years"* needs a **word-number map** — deterministic, just a list to maintain.<br><br>**THE POSTING PANEL — keep the masthead, format the rest plainly:**<br>· **Masthead** (as approved): orange kicker *domain · level · workplace* · serif display title · company in the logo face · then the **four-cell deck strip** — Experience · Where · Salary · Posted. ⭐ **"not stated" is rendered in italic serif as a VALUE**, never a blank. The Experience cell tints when met.<br>· **Below it: the employer's original description, neatly formatted — nothing fancy.** ⛔ **No sectioning, no pull quote, no re-ordering of their words.** A drop cap on the first paragraph, their headings as small-caps rules, their bullets with accent markers. ⛔ **The posting stays the employer's document.**<br>· ⛔ **The ATS content is OUT of the description entirely** — it lives in its own card, which is how it already works.<br><br>**THE SCORE CARD — the slab header plus the old taxonomy, reordered:**<br>· **Header:** band + *"you cover 9 of the 12 things this posting asks for"* + the number in serif accent + a **three-segment bar** (matched · missing · generic).<br>· ⭐ **RECTANGULAR DEPTH BOXES REPLACE THE PILLS.** Radius ~9, `--lift` at rest, `translateY(-2px)` + `--lift2` on hover, settle on press — D1's values, **re-derived per theme**.<br>· ⭐⭐ **THE OLD TAXONOMY IS KEPT BUT REORDERED.** *Skills missing*, *verbs missing* and *competencies missing* were **three sections with the claim note repeated under each**. They become **one "You could claim" block**, with a small `kind` label on each box — `skill` · `verb` · `quality`. ⛔ **The distinction survives; the fragmentation does not**, and the claim note appears **once**.<br>· **Experience gets its own row**, not a footnote — it is the one requirement that is genuinely pass/fail.<br>· **Then** *Already yours* and *Generic — not a gap*, both with their existing copy.<br><br>⛔ **BOTH THEMES FROM ONE TOKEN SET.** The dark surface is for dark mode, the cream for light. ⚠ **The dark greens, reds and blues are NOT the light palette's values** — they are **re-derived**, which is the only way either side passes contrast. ⛔ Re-derive every pair; do not convert.<br><br>⚠ **WHAT THE BUILD STILL NEEDS:** ⛔ **the `kind` label requires the term's type to be stored** — skills, verbs and competencies are already separate inside the scorer, so the box must carry which bucket it came from rather than flattening them · **a phone answer** — the sticky score column collapses above the posting · ⛔ **this is the product's only dark surface and that must be a RULE, not a per-screen choice**, or the aesthetic fragments · ⚠ **thin tags give a beautiful empty masthead** — the deck strip needs a fallback when a fact is not on file, and D29's coverage must be measured first.<br><br>⚠ **D31 stands but is narrowed:** the ATS card is simple and the weave is gone — ⭐ **and the connection the weave tried to draw is now free**, as a hover link between the pair's two halves (a requirement on the left lighting its term on the right), available only when asked for |
| **D30** | ✅⭐⭐ **FILTER DIALS + THE DECLARATIVE SENTENCE — APPROVED 10-04. Supersedes D24's popover model and D28's phrasing.** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26) into draft `main` — 3284 / 3284 / 0 on the merge, client builds.** **✅ BUILT (26): `7c40e8e`.** `BoardHeadline` replaces "Let's get to work.", derived from dial state: *"Now showing all jobs, at any level, in the United States, any workplace."* · nothing matches → *"Nothing matches …"* (same clauses) · the US floor cannot be cleared. `FilterDials` (replaces FilterSentence): six dials always visible with value + count; closed sets inline, domain/location get a picker; zero-count options dimmed ("Would show no jobs"); thin coverage on the dial, never in the sentence. `/api/jobs/facets` gained domain + location clauses (additive; the apps don't call it). 4/4 injected red. ⚠ **No screenshots** — the throwaway server was reaped for memory (O63). Owner calls: O60, O61. Sketch: `jd2.html` tab *Filters · dials*.<br><br>⭐ **THE SENTENCE IS A PROJECTION OF DIAL STATE, NEVER A SECOND SOURCE OF TRUTH.** That resolves D28's tension: the sentence is the **readable headline**, the dials are the **complete inventory**. ⛔ They can never disagree because one is derived from the other.<br><br>**THE SENTENCE — four permanent clauses:**<br>`Now showing ⟦domain⟧ jobs, at ⟦level⟧, ⟦location⟧, ⟦workplace⟧.`<br>**All defaults:** *"Now showing **all** jobs, at **any level**, **in the United States**, **any workplace**."*<br>**Fully narrowed:** *"Now showing **design** jobs, at **senior level**, **in Boston**, **remote only**, **posted this week**, **strong fits only**."*<br>⚠ **`posted` and `fit` APPEND ONLY WHEN SET** — the dials make them discoverable, so the sentence need not carry them at rest. Six clauses is the extreme case and the user opted into every one.<br><br>**THE SLOTS:**<br>· `domain` — default **all** → design · engineering · data · product<br>· `level` — default **any level** → senior level · mid-level · entry level<br>· `location` — default **in the United States** → in Boston · in California · in the Bay Area<br>· `workplace` — default **any workplace** → remote only · hybrid · on-site<br>· `posted` — **absent** by default → posted today · this week · this month<br>· `fit` — **absent** by default → strong fits only · strong or moderate<br><br>⛔⭐ **LOCATION'S FLOOR IS "in the United States" AND CANNOT BE CLEARED — only narrowed.** The product is US-only, so the sentence states that as a **fact** rather than letting someone believe they can search globally. ⭐ That is the honest version of a constraint that would otherwise be hidden.<br><br>**THE DIALS — beneath the sentence, all six always visible:** each shows its **dimension, its current value and its count** (*LEVEL · Senior · 674 jobs*). Active dials are filled accent with the D1 depth values; inactive read *"no filter"*. ⛔ **No popovers for the four small closed sets** — tapping a dial cycles or opens an inline list. ⚠ **Location and domain are OPEN sets and still need a picker** — they cannot be a segmented row.<br><br>⛔ **TWO STATES TO SPECIFY NOW, not discover later:**<br>· **Nothing matches** → *"**Nothing matches** design jobs, at senior level, in Boston, remote only."* ⭐ **Same clauses, different verb**, so you can see which one to loosen. ⛔ Far better than an empty board with a generic message — **this board has emptied four times.**<br>· **A dimension with thin tag coverage** → the **dial** says so (*"3 have no level on file — kept, not hidden"*) and ⛔ **the sentence stays unchanged. The sentence never implies precision the tags do not have.**<br><br>⚠ **DEPENDS ON D29.** Dial counts and location narrowing are only meaningful against the **normalised tag layer** — *"in Boston"* over free-text location strings is the bug that started this. ⛔ **Build D29 first, or the dials show confident numbers over broken matching.**<br><br>⚠ **What this changes from shipped D24:** the popover-per-token model is replaced by dials for the four closed sets; the badge logic stays; both panels still closed by default; the icons keep their positions and their depth treatment |
| **D31** | ✅ **THE ATS CARD IS SIMPLE — the weave is dropped** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26) into draft `main` — 3284 / 3284 / 0 on the merge, client builds.** **✅ BUILT (26): `951c74b`.** The weave is gone; `AtsReport.jsx` stays the one component. Summary: band chip · score · "9 of 12 on your résumé" · one two-segment bar. ⛔ The score is still hidden (`ATS_NUMBER_SHOWN` false until A76 merges). "You could claim" is the only open section (`+` chips; claim copy once; read-only on the public tool). Folded: "Already on your résumé", "Generic — not a gap", and "More about this match" (verdict, experience line, strengths). "Not enough signal" dashed and colourless. No animation, no min-width; tokens in `AtsReport.css`. `atsWeaveD2` (5) retired, constraints re-pinned in `atsSimpleCardD31` (8); 16 injected red. Shots `draft-screenshots/d31-simple-ats-card/` (40). ⚠ `jd2.html` not found — built from the row text. Owner calls: O64. ✅ Owner 10-04, **reverses D2**. Sketch: `jd2.html` tab *The simple ATS card*.<br><br>⛔ **THE WEAVE ADDED NOTHING.** Drawing threads between two columns looked good and told the reader nothing a count does not. ⚠ It also needed a thread cap, a replay rule and a layout minimum — three constraints bought for zero information. **D2's choice is reversed; the four-concept comparison stands as the record of why.**<br><br>**WHAT THE CARD IS:** **score · band · "9 of 12" · one two-segment bar** — that is the whole summary. Then ⭐ **"You could claim" is the ONLY open section**, as claim chips with the `+` affordance and the claim copy beneath it. **Already on your résumé** and **Generic — not a gap** both fold away.<br><br>⭐ **It renders anywhere identically** — deck panel, board, mobile sheet, the public tool. **No animation, no layout minimum, no replay question.** That is what makes A52's one-component rule actually hold.<br><br>⛔ **EVERY CONSTRAINT SURVIVES:** band-first · *"not enough signal"* visually distinct from *"weak"* · generic language separated from real gaps and labelled **not a gap** · the claim copy appears **once**, where the action is · nothing pre-selected · D1 depth on every control · tokens only.<br><br>⚠ The number is still the largest element, so **A76's corpus remains the condition for showing it** |
| **D29** | ⛔⭐⭐ **FILTERS MUST QUERY OUR OWN TAGS, NOT FREE TEXT. The root cause under D27.** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26) into draft `main` — 3284 / 3284 / 0 on the merge, client builds.** **✅ BUILT (26): `d279a09`, migration `128_job_tags` (both runners).** `services/jobs/jobTags.js` + `shared/jobTagVocabulary.js`: location as a SET (`job_tag_places`: country/state/metro, 23 metros) + a separate remote flag; level/function/employment/workplace in `scraped_jobs.tag_*`, closed vocabularies; NULL = unknown (no 'mid' fallback, no 'full-time' default); soft-null predicates, known matches first. Deterministic only (D17); derived at boot and every 10 min; owner export → tag → import at `/api/admin/job-tags` (dry by default, all-or-nothing; owner tags survive a re-tag). **Coverage (1,866 local):** country 100% · state 91.9% · metro 91.7% · workplace 47.5% · level 65.2% · function 76.6% · ⚠ employment 7.7%. **US-only re-derived: tag verdict = ingest gate on all 2,616 rows** — it was not resting on the substring match. Bay Area 0 → 422; CA no longer matches Canada. 6/6 injected red. ✅ Owner 10-04, and it is the most important architectural point in this batch. ⛔ **"We need to tag the filtering criteria ourselves rather than metasearch, so that we can work the tags for filtering."**<br><br>**WHY "Boston" DID NOTHING.** The board holds free-text location strings from a dozen ATS vendors — `"New York, NY; San Francisco, CA"`, `"Remote within Canada or U…"`, `"Boston, MA (HQ)"`, `"na"`, `"USA"`. ⛔ A `LIKE '%boston%'` over that **misses Cambridge, misses "Greater Boston", and cannot tell Boston MA from Boston, Lincolnshire.** The data is there; **the comparison is wrong.**<br><br>⭐ **THIS IS THE SAME DISEASE THE SCORER ALREADY HAD AND ALREADY FIXED.** `skills_json` matched **17% of a 99.8%-covered board** because it did **whole-value equality against a 6,130-string free-text vocabulary**, 70% of it singletons. CC2 fixed it by matching inside a phrase with a bounded normaliser. ⛔ **Location, level, domain and employment type are that same bug, one column over.**<br><br>**WHAT TO BUILD — a normalised tag layer, queried by every filter:**<br>· **location** → structured: `country` · `state` · `metro` · and ⛔ **a separate `remote` flag**, because *remote* is not a place. One posting can carry several locations — **model it as a set, not a string.**<br>· **level, domain, employment type** → ⛔ **closed controlled vocabularies**, not free text. A tag that can be anything filters nothing.<br>· ⛔ **Every tag is nullable and NULL means UNKNOWN, never NO.** The soft-null pattern already in use: `(col IS NULL OR col <predicate>)`. **This board has gone empty four times from NULL-hostile predicates**, and A73 already fixed one instance of it.<br><br>⭐ **TAGGING FITS D17 EXACTLY.** Deterministic where it can be — a US state abbreviation, a known metro, `remote` in a title — and **export → the owner tags → import** for the rest, in the same manual enrichment sweep as D20. **No model call.**<br><br>⛔ **MEASURE COVERAGE PER TAG BEFORE ANY UI LEANS ON IT.** A filter is only as good as the share of rows carrying the tag. ⚠ **Report it, and show it in the UI** — *"3 have no level on file yet — kept, not hidden"* is the pattern D24 already uses and it is the honest one.<br><br>⚠⛔ **CHECK THE US-ONLY FILTER AGAINST THIS.** It was built and measured on the same free-text location strings. **If location matching is weak, that work may be resting on it** — re-derive its numbers once tags exist. ⚠ Same for the *Remote* filter: a posting can be remote with no stated region, which is why *kept-rather-than-hidden* is right and why a Remote filter must not claim precision it does not have |
| **D28** | ⭐ **THE SENTENCE IS DECLARATIVE, NOT IMPERATIVE — amends D26's phrasing** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ BUILT as D30 10-05 (26), `7c40e8e`.** The declarative sentence is D30's headline; D26's bar strip is in the same commit. ✅ Owner 10-04. ⛔ **"Deal me…" is replaced.** The owner's shape: **"Now showing all jobs, any level, in the United States, that are remote."**<br><br>⭐ **WHY IT IS BETTER, and it is not only tone.** *"Deal me X"* is a **command**, so tokens only appear once set — a filter you have never used is **invisible**. *"Now showing…"* is a **statement of what you are looking at**, so ⛔ **every slot is always present carrying its current value, defaulting to "all" or "any".** ⭐ **You can see every dimension you are able to filter by, at all times, without opening anything** — which is exactly what the old dropdown row did badly and what a chip rail cannot do at all.<br><br>**THE SLOTS, always filled:** `all` / `[domain]` jobs · at `any level` / `[level]` · in `the United States` / `[location]` · that are `anywhere` / `[remote · hybrid · on-site]` · (and optionally) posted `any time` / `[window]`.<br><br>⚠ **FIVE SLOTS IS AT THE EDGE OF READABLE** — D24 capped the sentence at four clauses for good reason. ⛔ **Decide which four are permanent and whether the fifth folds**, rather than discovering the run-on later. ⭐ Defaults reading as words (*all*, *any level*, *anywhere*) is what keeps it a sentence rather than a form.<br><br>✅ **D26's other decisions stand:** the sentence **replaces the "Let's get to work." caption** · the search bar keeps **only the search input**, the ALL / ★ / `/d` chips, the filter and sort icons, and **+ ADD JOBS** · ⛔ the **"All Jobs" dropdown, "Any Level", "Any Domain" and the Location field all come out** — they are now slots in the sentence · ⛔ **the provider filter leaves the user surface entirely.** ✅ This also settles D24's open question (a): **the "Any Level" dropdown goes; the sentence owns level** |
| **D26** | ⭐⭐ **THE SENTENCE IS THE HEADLINE — and the search bar loses almost everything** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ BAR STRIPPED 10-05 (26), in `7c40e8e` (with D30).** The board's bar is the search input + ALL/★//d chips + filter/sort icons + "+ ADD JOBS"; "All Jobs", Any Level, Any Domain and Location gone; a search publishes `query` alone. Provider left the user drawer (params still honoured server-side; no admin view yet — O62). **Save Search kept** — it works (one slot per profile, `tracked_search_json`). Phrasing superseded by D28 → D30. ✅ Owner 10-04, amends D24. ⭐ **Replace the "Let's get to work." caption WITH THE FILTER SENTENCE ITSELF.** The thing you are looking for becomes the page's title — one element instead of a dead caption above a control.<br><br>**✅ CHOSEN PHRASING:** ⭐ **"Deal me Senior Backend roles — Remote, fit Strong."** · empty state **"Deal me anything."** ⭐ *Deal* is what you do with a deck and it sits beside Daily Deck, Full House and Draft House without announcing itself. ⚠ Alternatives considered: *"Hit me with…"* (blackjack, more energetic), *"I'll take…"* (quietest), *"Show me…"* (the sketch's, forgettable).<br><br>⛔ **STRIP THE SEARCH BAR TO THE SEARCH INPUT.** Remove: the **"All Jobs" dropdown** — ⛔ **redundant, the ALL / ★ / `/d` chips beside it already do starred and applied** · **"Any Level"** and **"Any Domain"** · the **Location** field. ⭐ **Level, domain and location all become TOKENS IN THE SENTENCE** — one place to express a search instead of three.<br><br>✅ **What stays in the bar:** the search input, the ALL / ★ / `/d` chips, the **filter** and **sort** icons with their D24 depth treatment, and **+ ADD JOBS**.<br><br>⛔ **THE PROVIDER FILTER COMES OUT OF THE USER SURFACE.** *Greenhouse (229) · Lever (4) · Ashby (60) · Workday · SmartRecruiters · Workable · Recruitee · Jobo · Adzuna · Google Jobs* is an **admin concept** — ⚠ a candidate does not care which ATS a posting was crawled from, and exposing it invites the same misreading as the "Not linked" label. **It belongs in the admin panel, not here.**<br><br>⚠ **"Save Search" needs a decision** — it implies saved searches exist as a feature. Either build it or remove it; a control that does nothing is the shape A73 is already about |
| **D27** | ⛔⛔ **SEARCH AND FILTERING ARE BROKEN — OWNER-CONFIRMED ON PRODUCTION. FIX BEFORE ANY REDESIGN.** | **🚀 DRAFT LIVE 10-05 (26): `/api/version` reads `8420c48` (started 14:48Z, `latestApplied: 128_job_tags`). ⚠ resume-master `02a600d` is on `origin/main` but NOT deployed — `/v1/version` still reads `cbd2716` 20+ min after the push (O65).** **✅ MERGED 10-05 (26) into draft `main` — 3284 / 3284 / 0 on the merge, client builds.** **✅ DIAGNOSED (26): `f8f7fb4`, `docs/D27_FILTER_DIAGNOSIS.md`.** ⛔ **LOCATION was a wrong comparison** (`LIKE %x%`: "IN" matched Washington/Berlin, "MA" Omaha, "CA" Canada; "Bay Area" 0 of 370 SF rows) and its box had no Enter handler. ⛔ **LEVEL was a dead column in disguise** — 0% NULL only because the normaliser made every unmarked title 'mid' (592 of 868). **DOMAIN** the same ('general' 57%, the industry). **Dead:** employment type (2,609/2,616 NULL), min/max YOE, max applicants, workType, category. **Dropped client-side:** a bar search cleared "posted"; the bar's Any Level overwrote the sentence's and dropped Saved. **Works:** keyword (A72), salary, skills, provider, work model. **Counts are TRUE** counts of the role-scoped board (293 = role scope, not a page). Measured on a local 09-26 snapshot through today's US gate (1,866 active), not production. ⛔ **This gates D24 and D26 entirely.** A prettier panel that still does nothing is worse than an ugly one that works.<br><br>**CONFIRMED BROKEN, by the owner, live:** · **no filter changes the board** (A73) · ⛔ **the LOCATION filter returns irrelevant results** — a specific, reproducible case worth starting from · **search returns nothing** for ordinary terms (A72) · the filter panel is *"broken and ugly and not functional to use"*.<br><br>**REPORT PER FILTER, before changing anything:** was it **never wired** · wired to a **dead or renamed column** · or **silently dropped by the query builder**? ⚠ Those have three different fixes and they look identical from the UI.<br><br>⛔ **START WITH LOCATION** — it is the one with a concrete failing example, and it touches the **US-only filter** that was just built and measured. ⚠ If location matching is wrong, that work may be resting on it. ⛔ Check `workplace_type` and the location strings together: a row can be *Remote* with no stated region, which the panel's own help text admits (*"postings not yet tagged are kept rather than hidden"*) — **kept-rather-than-hidden is the right call and it means a Remote filter must not claim precision it does not have.**<br><br>⚠ **The counts in the panel look plausible and may not be** — *Intern (1), Entry (5), Mid (88), Senior (121), Lead (76), Executive (2)* totals **293** against a board of ~2,600. ⛔ **Establish whether those are filtered counts, page counts, or wrong** before building a UI that leans on them: D24's whole design rests on counts being true |
| **D25** | ✅ **DRAFT HOUSE WORKSPACE — BUILT + MERGED** | **✅ BUILT + MERGED 10-04 (25): `8e97099` (branch `d25-draft-house-workspace`), merged onto main as `8c09802` — 3258/3258/0, client builds.** Map: `docs/DRAFT_HOUSE_WORKSPACE.md`. **Server support found:** the three caps (queue 40 · approval 30 · submission 25) were enforced but their usage was only reported in a run's response; the kill switch is global and admin-only. **Missing and added:** a **per-user hold** (`app_settings`, no migration) checked when the line picks the next run, when a new Draft arrives (it waits) and in `processRun` before a run and before each next job; `GET /api/apply/run-bar`, `POST /api/apply/hold`. AUTO is locked by a server constant `FULL_AUTO_PROVEN = false` — never client-side. Client: the run bar (SEMI active; AUTO disabled with *"Auto has never run unattended against a real employer"*; caps with usage; ⏸ Stop everything, saying it does not recall what was sent); Stopped lists only exceptions with D1's rail; the fold lists guessed answers + *"12 of 14 needed no attention"*; no Sent column, no flow boxes; the AD1/AH6/AC3 chrome removed; `AutoApplyContext`/`PanelControls` reused (Database panel pinned). 17 tests describing the removed UI deleted (checked: all removed-UI; D14's Stopped-first rule was renamed, not dropped). 13/13 injected violations red — one first HUNG the suite (a held run ping-ponged between the line and `processRun`), fixed with a `parked` flag and pinned. RecruiterPanel stays: still reachable (route-only tab + JobCard/CompanyViewModal links). **Owner:** (a) lifting the AUTO lock (D22: AF5 + a supervised full-auto run) · (b) broken applications now appear as Stopped items, held-on-purpose ones do not — confirm · (c) `scripts/abPanelUi.mjs` drives the removed tabs (not in npm test) — retire or rewrite. Shots `draft-screenshots/d25/`. **Status 10-04 (25): 🔨 IN PROGRESS (worktree `draft-wt-d25`, branch `d25-draft-house-workspace`).** ⛔ **PREMISE CORRECTED: D14 and D18 HAVE shipped** — both on origin/main and in the LIVE bundle (`index-CFInnekL.js`: "Draft House" ×3, `data-draft-stopped`, `data-draft-queued`); the tab reads Draft House (`App.jsx:337`) and `AutoApplyPanel.jsx` renders Stopped │ Queued, stacking below 1080px. They were built INSIDE `AutoApplyPanel.jsx`, not as a new file, and that file's header is stale AD1 prose — which is what this row read. ✅ **What IS unbuilt, and is plausibly the "old UI" the owner sees:** the AD1 chrome still fills those columns (sub-tabs, search, date filter, company TILES, obstacle grouping), and **none of the workspace model exists** — no run bar, no user-facing SEMI/AUTO toggle, no caps, no ⏸ Stop everything in the client (the kill switch is admin-side). That is what is being built: the run bar (AUTO visibly locked unless the server says otherwise), exceptions as the main surface, the auto-mode fold, no Sent column, no flow boxes, reusing AutoApplyContext + PanelControls. ⚠ The owner reported still seeing the old UI. **Confirmed by reading `client/src/panels/`:** ⛔ **`AutoApplyPanel.jsx` is still the AD1-era file** — its own header says *"the strip that used to sit between the search bar and the postings, plus the review modal it opened, MOVED here whole"*. It renders `PanelSubTabs` + `PanelSearch` + `DateFilterButton`, company **tiles** via `TileGrid`, and obstacle grouping through `groupByApplication / groupByCompany / splitByFault / resolutionPlan`. ⛔ **There is no `DraftHousePanel`, no Stopped/Queued split, and no rename anywhere.**<br><br>**SO THESE ARE SPECIFIED AND UNBUILT, not shipped:**<br>· **D14** — **Stopped (75) │ Queued (25)** side by side. Stopped is the working surface; Queued is a glance. ⚠ Below ~1080px they stack, Stopped first.<br>· **D18** — `AUTO APPLY` → **"Draft House"**, two-line label, ⛔ **no mark on the tab**. (`JOB PROFILES` → Settings, `RECRUITER` removed by D5.)<br>· The **workspace model** from `workspace3.html`: a **run bar** carrying the SEMI/AUTO toggle, the three caps and ⏸ Stop everything · **exceptions as the main surface** with the D1 hover rail · ⛔ **no Sent column** (that is The Table, D15) · ⛔ **no numbered flow boxes** · "Queued", not "Running fine".<br><br>⭐ **THE REFRAME THAT MATTERS, and the current panel does not do it:** in **auto**, the panel's job is not showing twenty filled fields — **it is showing the three that stopped.** Everything working stays quiet. ⛔ Exact matches are **not listed at all**; they are the 12 of 14 needing no attention, reduced to one line inside the fold.<br><br>⚠ **WHAT TO PRESERVE FROM THE EXISTING PANEL** — it is not all legacy. `AutoApplyContext` exists **so the panel and the board can both reach the state**; `PanelControls` was extracted rather than reimplemented and the Database panel uses the same components, which is the only proof an extraction is not a clone. ⛔ **Reuse those; do not fork them.**<br><br>⚠ **ALSO CHECK:** `RecruiterPanel.jsx` still exists — D5 removes the **nav item**, not the file, so that is consistent, but confirm nothing still links to it. · **D22's VM surface slots into this panel** once built, so D14's structure should anticipate a remote run appearing in Queued and an expired session appearing in Stopped |
| **D24** | ✅ **FULL HOUSE — FILTERS AS A SENTENCE, BEHIND THE ICON. CHOSEN 10-04.** | **🚀 LIVE 10-04 (25): `b6072e3` — pushed to origin by someone other than this session minutes after the local merge; `/api/version` reads `b6072e3`, contract `2.0.0`; the live bundle carries the sentence, "For you" and the sort-semantics rule.** **✅ MERGED 10-04 (25) into local draft `main` (`b6072e3`, clean) — 3251/3251/0, client builds. NOT pushed. ⚠ Mobile contract 2.0.0 ships with it (apps unaffected: neither calls the old facets).** **✅ BUILT + INTEGRATED 10-04 (25): branch `d24-integrated` (worktree `draft-wt-d24`) = contract `217d140` + server `45f0f27` + client `bb9d311` + integration fix `a199de1` — 3251/3251/0, client builds. NOT merged to main, NOT pushed (merge as ONE unit: the halves depend on each other's sort semantics).** Client: both panels closed by default and mutually exclusive, icons in place with D1 depth, badge = active clauses; the sentence from SENTENCE_CLAUSES (cap 4); popovers with counts, zero DIMMED with *"Would show no jobs"*, unclassified rows explained (*"3 have no level on file yet — kept, not hidden"*); the sort panel with subtitles and visible tie-breaks; the default board sends NO sort (curated) — *"For you"* is the first row; 11/11 injected violations red. Integration found and fixed: ⛔ **every pre-D24 cached board stored `dateDesc` (it meant curated then) and would have reopened as strict Newest** — snapshots now carry a sort-semantics version; an untagged `dateDesc` reads as curated. **Owner decisions:** (a) **two level controls** — the search bar's *"Any Level"* dropdown still sits beside the sentence's level word (shot `draft-screenshots/d24/d24-sentence-popover-1280.png`) — keep, or remove from the bar? · (b) **D12's first-run extension prompt** sits between the search bar and the first card, which D24 forbids — which row wins? · (c) the **curated order has no declared tie-break** ("For you" shows none) · (d) the drawer's non-clause filters (provider, tier, salary, saved search) live behind *"More filters (n on)"* and are NOT on the badge — confirm. **Server half ✅ BUILT 10-04 (25): `45f0f27` on `d24-server`, NOT merged — ⛔ merge ONLY TOGETHER with the client half** (see sort below). 3225/3225/0, 7/7 injected violations red. **Per filter, re-measured:** experience_levels works (soft-null, matches first) · work_models works-but-sparse (A73's 42% — not re-measured) · ⛔ **ageFilter was filtering on `scraped_at`, which every crawl rewrites** — "Past 24h" kept the whole re-crawled board; it only looked right because the web client also sends posted_after. Fixed: one "posted within" predicate (posting date, else first seen) · fit: never existed — `fit_bands` now a HARD filter on the user's own score. `companyAsc` added; every sort ordered by its declared tie-break chain to a unique key. `GET /api/jobs/facets`: median 126 ms / p95 236 ms unfiltered, 54 ms with four clauses (2,600 synthetic rows); 180 option counts over 10 combinations equal GET /api/jobs exactly. ⚠ **Mobile contract 2.0.0 (MAJOR):** the old `/api/jobs/facets` shape is replaced — checked: **neither app's code calls it** (only their vendored contracts: Android 1.2.0, iOS 1.1.1), nor does the web client; also fixed the contract's `employment_type` → `employment_types`. ⛔ **SORT SEMANTICS CHANGED:** explicit `sort=dateDesc` is now truly newest-first; the CURATED order needs `sort` omitted. The live web client always sends dateDesc — so the server half alone would silently turn the board newest-first. The client half was told to omit sort by default. **Status 10-04 (25): 🔨 IN PROGRESS, two halves in parallel off the contract `217d140` (local main, `shared/filterSentence.js`) — server in `draft-wt-d24-server`, client in `draft-wt-d24-client`.** ⚠ **Premise check:** the row's *"A73 says no filter changes the board today"* quotes A73's TITLE; A73's finding (`92d2f3c`, live) is that the filters WORK — soft-null kept unclassified rows on top, fixed. The server half re-measures the four sentence filters on today's code anyway. ⚠ **Two things the row assumed exist do not:** there is **no fit filter** ("where my fit is Strong" is a new, HARD dimension — an unscored job matches no band) and **no Company A–Z sort**; both are in the server half. Sketch: `filters2.html`. Three shapes were built (chips+drawer, facet columns, the sentence); ⭐ **the sentence won.**<br><br>⛔ **BOTH PANELS ARE CLOSED BY DEFAULT.** The board starts **right under the search bar**. ⛔ Nothing sits between the search and the first card. Filters open from the **filter icon**, sorting from the **sort icon** — **mutually exclusive**, opening one closes the other.<br><br>✅ **THE ICONS KEEP THEIR CURRENT POSITIONS** — to the right of the search bar, where they already are. ⛔ Do not move them; only their contents and their look change.<br><br>⭐ **THE DEPTH TREATMENT ON THE ICONS IS THE SHIP-IT DETAIL** — exactly D1's values: rest `0 3px 8px rgba(0,0,0,.11), inset 0 1px 0 rgba(255,255,255,.66)` · hover `translateY(-2px)` + `0 7px 17px rgba(0,0,0,.15)` + `--atext` border and icon · **open = filled `--accent`** with `0 3px 9px rgba(253,70,0,.34)`, so an open panel is unmistakable. 46px, radius 12, **icon not label**.<br><br>**THE SENTENCE:** *"Show me **Senior** jobs that are **Remote**, posted **this month**, where my fit is **Strong**"* — ⭐ serif prose with the **logo face** as editable tokens; active ones filled accent, the rest paper with depth. **Tap a word → a popover with the options AND their counts.** ⭐ **That is how the sentence keeps the counts** the other shapes had — not in the prose, but on the token being edited. ⛔ **Zero-count options are DIMMED, NOT HIDDEN** — *Intern 0* is information; hiding it looks like a bug. ⛔ **A filter that would empty the board says so before it is pressed** — this board has gone empty for NULL-handling reasons four times. Below: **"142 jobs match — tap any word to change it"** and **Clear all ×**.<br><br>⭐ **THE FILTER ICON CARRIES A COUNT BADGE** (`2`). Active filters are visible **without opening anything** — ⛔ which is precisely why D11's removal of the **"567 jobs"** bar is correct and not a loss.<br><br>**SORTING, same panel treatment:** *Best fit · Newest · Salary · Company A–Z*, each with a plain-words subtitle. ⭐ **"Ties broken by" is VISIBLE** — a coarse score produces many ties, and today they fall to insertion order silently. ⛔ **It says plainly that 537 jobs have no score** and sort last whatever is picked, with *Newest shows everything*. ⚠ Sorting by fit is only as good as the score — **A76's corpus is what earns it**.<br><br>⚠ **THE SENTENCE CANNOT HOLD SIX CLAUSES.** Four reads well; past that it is a run-on. ⭐ **Treat the cap as a feature** — if someone needs six simultaneous filters on a daily-draft product, curation is doing the wrong job. ⛔ Decide the ceiling deliberately rather than discovering it.<br><br>⛔ **FUNCTION BEFORE FORM: A73 SAYS NO FILTER CHANGES THE BOARD TODAY.** ⛔ Fix that first — a prettier panel that still does nothing is worse than an ugly one that works. Report per filter whether it was never wired, wired to a dead column, or dropped by the query builder |

---

## QUEUED 2026-10-04 — batch four

| | Task | Notes |
|---|---|---|
| **D23** | ⭐ **EXTENSION — "THE COMPANION" (C) WITH A MANUAL CONTEXT TRIGGER, AND THE SITE'S EXACT VISUAL LANGUAGE** | **🚀 PUSHED 10-04 (25): `4dfbef0` live (`/api/version`). The site's privacy page now describes the v1.3.0 behaviour (read only on press); the Web Store still carries v1.2.0 until you submit the v1.3.0 zip.** **✅ MERGED 10-04 (25) into local draft `main` (`4dfbef0`, clean, on top of D20–D22 and the D24 contract) — 3226 / 3226 / 0, client builds. NOT pushed; v1.3.0 NOT submitted to the Web Store.** **Status 10-04 (25): ✅ BUILT, `78bf2fe` on branch `d23-companion-trigger` (worktree `draft-wt-d23`, from `53c7ff2`), NOT merged, NOT submitted — v1.3.0 + zip.** Opening the popup reads nothing and asks nothing; the four actions show with **"Read this page"** (or R) — only that press reads the page and calls D13's existing route (no second parser). Look: `extension/tokens.css`/`tokens.js` GENERATED from `colorTokens.js` (the build refuses a stale set; the colour-literal guard now covers `extension/`); the D19 mark and the self-hosted logo face (Poppins 800 italic, DM Sans) copied byte-for-byte — no Google Fonts; the review overlay loads the face through FontFace, so no `web_accessible_resources`. 3211/3211/0 at its tip; **13 of 13** injected violations red. ⚠ **Premise corrections:** permissions are activeTab + scripting + **storage** (unchanged from v1.2.0; now pinned) · the row's `--paper`/`--atext` are the sketch's names, the site's are `--c-*` · the site's depth tokens use ink `rgba(30,25,21,…)`, not black — the tokens were used · *"no new disclosure"*: D13 had added one (the URL sent on popup OPEN) — D23 **narrows** it to the press, and `PrivacyPage.jsx` says so (**owner: review that sentence and `STORE_LISTING.md`'s v1.3.0 note**) · dark mode follows the OS (reading the account theme would need storage). **Owner:** the three store screenshots exist with SYNTHETIC data (`draft-screenshots/d23/store/`); the real-value check needs `npm run store:screenshots` on your machine. ✅ Owner 10-04. Supersedes the open half of D13. Sketch: `ext.html` tab C.<br><br>⭐ **THE MODEL:** the popup offers **the right action for where you are**, not a menu of four. On a **job posting** → *Capture it* + *Score it*, and it can say **"not on your board yet"**. On an **application form you drafted** → *Fill it*, with **"you drafted this 2 days ago · résumé ready · 14 fields prepared"**. On neither → recent captures. ⭐ **It costs nothing to know this** — the URL names the ATS and the slug, and D4 confirmed that parsing is already live at `importJob.js:82-165`.<br><br>✅ **MANUAL CONTEXT TRIGGER — owner decision, and it answers the one real objection.** Context detection is **never automatic on popup open**. The user presses a control to read the page; until then the popup shows the four actions unchanged. ⛔ **A wrong primary action is worse than a menu**, and this removes that failure mode entirely rather than tuning a confidence threshold. ⭐ It also keeps the product's defining property exact: **every read of every page still begins with a click or a keystroke.** ⚠ And it removes the per-open lookup — nothing is fetched until asked.<br><br>⛔ **NO NEW STORAGE, NO NEW PERMISSION, NO NEW DISCLOSURE.** The six keys stand; only the token is transmitted. `activeTab` + `scripting` + one host. ⚠ **That is the whole reason C won**, and the next submission already carries a rename and a host change.<br><br>**⭐ THE VISUAL LANGUAGE — EXACTLY THE SITE'S, not an approximation:**<br>· **Tokens only** — `--paper` `--card` `--edge` `--ink` `--soft` `--faint` `--accent` `--atext` and the band colours. ⛔ The guard fails on any colour outside the token file; the extension gets the same file, not a copy.<br>· **The logo face** for the mark, company names and headings — the heavy italic geometric sans, **self-hosted**, ⚠ never a Google Fonts request (it is already an open privacy-reconciliation item).<br>· **The mark is `/draft`**, orange slash + near-black wordmark in light mode (D19). The **Draft action carries `/d`** as on the job cards.<br>· ⛔ **Depth on every control**, the exact D1 values: rest `0 3px 8px rgba(0,0,0,.11), inset 0 1px 0 rgba(255,255,255,.66)` · hover `0 7px 17px rgba(0,0,0,.15)` + `translateY(-2px)` · press `translateY(0)` + `0 2px 5px rgba(0,0,0,.13)` · primary `0 3px 9px rgba(253,70,0,.34)`, **tinted orange** so it reads as orange rather than grey-made-orange.<br>· **The same square button geometry** — logo-sized, radius 11–13, icons not labels.<br>· **`prefers-reduced-motion`** respected, as everywhere else.<br><br>⛔ **THE REVIEW OVERLAY GETS THE SAME TREATMENT AND MATTERS MOST** — it is what a Web Store reviewer sees, and what proves **fill-and-review, not auto-submit**.<br><br>⚠ **Bundle with A35's restyle in ONE submission.** Regenerate the three screenshots (1280×800, 24-bit, no alpha, checked against the owner's real profile values) and bump the version. ⚠ **D12 ships it** — removing IMPORT from Full House makes the extension the only import route, and it is still **unlisted**.<br><br>⏸ **B (the pocket workspace) stays held, not dropped.** Signed-out capture, free local scoring, six saved jobs plus "sync to draft" — **value first, sign-up after**. ⛔ But a local store of captured jobs is a **new disclosure** on both counts the listing makes, and it has an unanswered question: **it needs the résumé on the device to score.** After this submission clears |
| **D22** | ⭐⭐ **THE VM DASHBOARD, WIRED INTO DRAFT HOUSE — not a separate page** | **🚀 docs live 10-04 (25) with `f4a3ab8`.** **✅ §6/§4 work MERGED 10-04 (25) into local draft `main` (`f4a3ab8`). NOT pushed. The build stays blocked (O12, AF5, O59).** **Status 10-04 (25): the build stays ⏸ blocked (O12, AF5). What D22 asked to be done FIRST is done — `19e7bca` on branch `d22-section6`, NOT merged.** ⭐ **§6 measured for Workday** (`docs/E3_SECTION6_WORKDAY.md`; every claim VERIFIED / MEASURED / UNVERIFIED; cookies and ToS re-checked independently): it **constrains rather than eliminates — but two findings could still eliminate it.** ⛔ **Terms:** Workday's ToS forbid *"any applications that interact with our Sites without our prior written consent"* and letting *"any other person or entity … use your account"* — binding at least on the "Continue with MyWorkday" sign-in; tenants add their own. **Owner/legal reading before any build (O59)** — ⚠ read broadly the first clause touches the desktop extension's handoff too. ⛔ **Session lifetime:** cookies are host-only per tenant and carry **no `Expires`** — Workday's server idle timeout decides, unknown for candidates (employees: 15–30 min). If similar, "sign in on the phone, apply later from the worker" **fails for Workday**; and D22's *"Meta will sign you out on 5 Oct"* copy cannot exist for Workday (no date to read). Detection: Cloudflare Bot Management on every tenant; datacenter blocking unconfirmed. **Two design corrections applied:** §1's key was the *registrable domain* — every Workday tenant shares `myworkdayjobs.com`, so it would merge every employer into one profile; **the key is the host.** §4 now says what a **database-only** breach yields (the employer list) and why the host stays in the clear: `job_applications` already holds company/role/URL in plaintext, so encrypting the host alone protects nothing. **Cheapest decisive next test (O59): owner signs in to one tenant on a phone, reloads at 30/60/120 idle minutes.** ⏸ Queued 10-04. Sketch: `vm.html` tab 2. ⛔ **Blocked on O12** (the `E3_SECURITY_DESIGN.md` review) and on E3's prerequisites — **AF5, full-auto proven on the direct tier, and the kill switch verified MID-BATCH.** This row is the surface; `VM_EXECUTION.md` is the build.<br><br>⛔ **IT IS NOT A NEW TAB.** D14 already settled Draft House as **Stopped (75) │ Queued (25)**, and a remote-browser run is **an application in flight** — the same object, the same queue, the same caps, the same kill switch. ⭐ **A separate "VM" page would split one pipeline across two surfaces** and is exactly the recruiter-tab mistake D5 is deleting.<br><br>**WHERE EACH PIECE GOES**<br>· **A remote run appears in the existing Queued column**, with its own phase text (`signing in · filling · waiting for you`) and a small portal glyph. ⛔ **No second list.**<br>· **An expired or missing session becomes a STOPPED card**, beside *"2 questions had no answer"* and *"the portal wants you signed in"*. ⭐ **That is the correct home for it** — the pipeline stopped and needs the user, which is precisely what Stopped means. Its fold reads: *"Meta will sign you out on 5 Oct. Two queued applications need it — sign in again from your own browser and the extension picks it up."*<br>· **The run bar already carries the mode toggle, the three caps and ⏸ Stop everything.** ⛔ E3 runs obey the same switch — **checked per run, BEFORE the cookies are decrypted**, which is a stronger and more testable claim than "no application was submitted".<br><br>⭐ **THE ONE GENUINELY NEW SURFACE: "Portals you are signed in to"** — and ⛔ **it belongs in ACCOUNT/SETTINGS, not Draft House.** It is a standing permission the user granted, not a job in flight. Per portal: **what is held** (*your signed-in session — cookies and site storage*), **what is not** (⛔ *no password, no card, nothing you typed into a form*), **encrypted**, **expires** (⛔ the portal's own date, never one we invent), and ⭐ **a per-portal USE LOG** — *"used to apply to X at Y"*. ⚠ **A session the user cannot see being used is one they cannot know to revoke.**<br><br>⛔ **REVOKE IS THE USER'S, NOT THE ADMIN'S.** One button per portal plus *Disconnect all*. The copy must say what it actually does: **"Removing this destroys the key. The stored data becomes unreadable immediately — not marked deleted, unreadable. Applications already sent are unaffected."** ⚠ An admin-only view of someone's portal sessions is the wrong default for a feature whose entire argument is that the user stays in control.<br><br>⚠ **THE ATTENDED/UNATTENDED TOGGLE EXISTS AND IS LOCKED.** ⛔ It may not be flipped until AF5 **and** a supervised full-auto run have both passed. The panel says so plainly rather than hiding the control — *"Auto has never run unattended against a real employer."*<br><br>⭐ **SCOPE CORRECTION, from the 10-04 review:** desktop already has the gated handoff, which works and stores nothing. ⛔ **E3's unique value is MOBILE**, where there is no extension. **Make E3 mobile-only** and the extension needs no `cookies` permission — which preserves D13's deciding argument (*no new storage, no new permission, no new disclosure*) and keeps the next Web Store submission shallow. ⚠ It makes E3 depend on the Android app, which is at Phase 2a — but it was always behind AF5 anyway.<br><br>⚠ **TWO GAPS THE SECURITY DESIGN DOES NOT COVER, raised 10-04:** ⛔ **the portal domain is unencrypted metadata, and it is sensitive** — *"this user has a session at metacareers.com"* says they are applying to Meta, so a database breach yields ciphertext **plus a list of every employer each user is pursuing**, which §4's breach sentence does not mention. Either encrypt it or say so. · ⛔ **§6 could eliminate the feature** — if Workday, Meta and Amazon all flag datacenter submission or forbid it in terms, E3 has no customers. **Measure §6 for ONE platform before building anything** |
| **D21** | ⭐⭐ **CONNECTORS — ONE MCP SERVER, EVERY HOST. ⛔ REWRITTEN 10-04 after evaluating ChatGPT Apps.** | **🚀 LIVE 10-04 (25): resume-master pushed `cbd2716` (`/v1/version` reads it — D17's `1636a01` went with it); draft `f4a3ab8`. Anonymous `/mcp` is OFF in production (no-token `tools/list` → 401) until O58(b) sets `RM_MCP_ANONYMOUS`.** **✅ MERGED 10-04 (25): resume-master local `main` `cbd2716` (323 / 323 / 0; main is 4 ahead of origin — `1636a01` D17 included) and draft local `main` `fe5b214`. NOT pushed, NOT deployed (O58).** **Status 10-04 (25): ✅ STEP 1 BUILT — resume-master `3eae7f1` + `3e9347c` on branch `d21-mcp-anonymous` (contract **1.3.0**), draft `7692736` on branch `d21-privacy-row`. NOT merged, NOT deployed.** ⚠ **VERIFIED against OpenAI's own docs (links in resume-master `docs/CHATGPT_APP.md`) — one premise corrected:** a ChatGPT plugin reaches an MCP server **anonymously** (*"many plugin MCP servers can operate in a read-only, anonymous mode"*) **or by OAuth 2.1** — ⛔ **no static key, so `rmk_` tokens cannot be what ChatGPT sends**; per-user auth is optional, not inherent. **Owner chose ANONYMOUS FIRST (10-04).** Also verified: custom GPTs — no new ones from Oct 26, stop working Dec 11 2026, Actions do not migrate (press quoting OpenAI; the help FAQ answered 403) · apps may sell **physical goods only** — no credits in-app · review needs 5+3 test cases, verified identity, privacy + **terms** URLs · the UI standard (`text/html;profile=mcp-app`, `_meta.ui.resourceUri`) is shared with Claude, so the weave can travel. **What shipped:** `score_ats_fit` on `/mcp` with NO token, ⛔ **ON ONLY WHEN `RM_MCP_ANONYMOUS` sets all three caps** (perIpPerMinute · perIpPerDay · perDay; partial = refuses to boot), checked before the body is read, 512 KB body cap; the caller is `(anonymous)` (no token can carry it), sees only `score_ats_fit` (`securitySchemes: noauth`), a token-only tool is refused; a PRESENTED token is judged as a token (never downgraded). Address = salted hash in memory, ≤ 1 minute / never past its UTC day, never logged. **Limits on the free side:** `RM_FREE_LIMITS_PER_DAY` caps deterministic `/v1` + MCP calls (MCP tool calls had been drawing on the MODEL budget). Privacy: resume-master `docs/PRIVACY.md` *Through an AI assistant* (host first under its own terms; what we receive/keep/share; controls) + two rows in `PRIVACY_RECONCILIATION.md` — ⛔ OpenAI is NOT added to draft's recipients (draft sends it nothing). Submission pack + 5/3 test cases: `docs/CHATGPT_APP.md`. resume-master 323/323/0 (9 of 10 injected violations red; the 10th was an unreachable check, removed); draft 3198/3198/0. **Not yet:** OAuth 2.1 (O16c as an auth flow) · parsing over MCP (step 2 — O16e landed as `1636a01`, unpushed; an assistant passes files by ID, not base64 — design first) · PDF tier-1 · the weave as an MCP-App UI. Owner steps → **O58**; findings → **A81–A84**. ⛔ **THE FIRST VERSION OF THIS ROW WAS WRONG and is superseded.** It proposed generating an OpenAPI schema for **GPT Actions** as a third channel, and accepted a shared creator key because only zero-cost tools would go public. **Both premises are obsolete.**<br><br>⭐⭐ **THE FINDING: OpenAI's Apps SDK IS BUILT ON MCP** — the open Model Context Protocol. *"Building an app requires an MCP server that defines tools, plus an optional web UI rendered in a sandboxed iframe."* ⛔ **Resume Master's `/mcp` is already live and answers 401 unauthenticated. That server IS the thing a ChatGPT App needs.**<br><br>⭐ **So this is not "one schema, three channels". It is ONE MCP SERVER, EVERY HOST THAT SPEAKS MCP** — Claude, ChatGPT, and anything else adopting the standard, which is open and portable by design. ⛔ **Do NOT build an OpenAPI/Actions path.** It is a second declaration of the same tools, and divergent declarations of one thing is the defect this codebase has paid for more than any other.<br><br>✅ **THE SHARED-KEY PROBLEM DISAPPEARS.** Actions carry one key — the creator's. **Apps authenticate users individually** ("Authenticate users" is a step in the Apps SDK). ⭐ Per-client accounting then works as designed, and limits are per-user rather than global. ⚠ **The earlier "only zero-cost tools may go public" constraint was a workaround for a problem this path does not have** — though ATS-scoring-first still stands on its own merits. ⚠ It does make **O16c** (self-serve token issuance) a real prerequisite, but as an **auth flow** rather than hand-minted keys, which is what it should have been.<br><br>⭐ **TWO THINGS THAT MAKE THIS BETTER THAN A PLAIN API:**<br>· **An optional UI component in a sandboxed iframe** — ⭐ **the weave (D2) could render INSIDE ChatGPT** rather than returning text. That component already exists.<br>· **Safety annotations** — `readOnlyHint`, `destructiveHint`, `openWorldHint`, so the host applies the right confirmations. ⭐ **ATS scoring is purely read-only**, the safest category to launch in.<br><br>**WHAT SHIPS, IN ORDER** — unchanged: **1.** ATS scoring (deterministic, zero model calls, does what an assistant cannot). **2.** Résumé parsing, ⚠ only after O16e's local extractor, since A70 made PDF→text free and D17 forbids a model call for a library job. **3.** PDF tier-1 per A69. ⛔ **Not generation.**<br><br>⚠ **TURN THE LIMITS ON BEFORE PUBLISHING.** Per-client accounting exists with limits **off**. ⛔ "Free" is not "unbounded" — an assistant in a loop calls a tool far more often than a human, and a zero-model endpoint still costs CPU. The `/api/standalone/generate` shape is the precedent.<br><br>⛔ **PRIVACY — a real line.** ⚠ **A résumé pasted into ChatGPT reaches OpenAI before it reaches us**, for a product handling Article 9 data. Policy line + a row in `PRIVACY_RECONCILIATION.md`'s join. ⚠ Same question for any MCP host.<br><br>⚠ **VERIFY BEFORE BUILDING, do not assume:** Apps go through **submission and review** with a directory, like the Web Store · **Apps and Actions coexist** and the naming is muddled in third-party write-ups (*"a GPT can use either apps or actions, but not both"*; plugins wound down in 2024 and builders were pointed at Actions; Apps came later, on MCP) — **read OpenAI's own docs, not summaries** · **there is monetisation in the Apps SDK docs** — read it before building, not after |
| **D20** | ⭐ **SLUG HARVEST AS PART OF THE MANUAL ENRICHMENT SWEEP** | **🚀 LIVE 10-04 (25): pushed `f4a3ab8`; `/api/version` reads commit `f4a3ab8`, `latestApplied: 127_slug_harvest`. The card is in Admin → Operations; no search has been spent.** **✅ MERGED 10-04 (25) into local draft `main` (`9bfc784`, clean) — 3213 / 3213 / 0, client builds. NOT pushed.** ⚠ Migration 127 is now on main ahead of D16's 125 and A76's 126: when those merge, put them BEFORE 127 in BOTH runners. **Status 10-03 (25): ✅ BUILT, `4a9f804` + `097ab1e` on branch `d20-slug-harvest` (main tree), NOT merged — migration `127_slug_harvest` (125/126 are D16's and A76's, both unmerged; whoever merges orders them 125 → 126 → 127 in BOTH runners). NOT pushed.** Admin → Operations → **Slug harvest**: *Plan today's sweep* (dry; reads the SerpApi quota, free) → *Run N searches* (spends exactly the planned ones; unreadable quota or too few left refuses; a failed search stops the rest) → *Export for review* (JSONL, one undecided pair per line) → set `decision` add/skip + company → *Import decisions* (dry; whole file or nothing; guards invalid_value · unknown_pair · concurrency · stale — an add is re-validated and refused if the board changed; same file twice changes nothing) → *Revert* per import (dry; disables, never deletes). **Cap 8 searches/day**; one per family on a fresh pool; a family whose last 3 searches found nothing new leaves the default plan; conversion per family and per sweep on the card. **A pool, never a pairing** — no column records the job a slug came from (tested). Workday site parsed from the URL (case kept), Greenhouse embed form parsed; adapter-less vendors counted, never pooled. ⛔ **`validateBoard` now refuses 0% description coverage** (`no_descriptions`: none inline AND the enrichment detail fetch returns none on a 3-posting sample) — the admin add-company route inherits it. The plugin and the harvest share ONE pinned SerpApi call (`googleJobs`, hl/gl written after caller params). On D4's 20 saved responses (now `test/fixtures/serpapiD20`) the pool reproduces the yield doc exactly: 1,031 links · 52 ATS · 40 crawlable pairs + 10 adapter-less. **0 searches spent** building it. 15 tests (`d20SlugHarvest`), 10 injected violations seen red; **3213 / 3213 / 0** at the branch tip; client builds. Shots `draft-screenshots/d20/` (throwaway server, fixture-seeded). ⚠ Not done: A49 dedup is untouched (it applies when an added board is crawled, as for every source); the Workday 300-posting cap on giant tenants (Wells Fargo, Boeing…) stands — review those by hand. ✅ Owner 10-04. The owner is doing a **daily manual sweep of the enrichment influx**; the slug harvest rides in the same pass. ⛔ **No extension, no cron, no model call** — exactly D17's shape.<br><br>⛔ **THE CORRECTION THAT SHAPES IT: board-row URLs are useless for discovery.** A Greenhouse row came from a slug we already configured, so its URL points back at the same company. ⛔ **Harvesting from the board rediscovers the ~25 companies we already have** — the enrichment pass only ever sees rows that arrived through a configured source, so it structurally cannot surface a company we have never crawled.<br><br>⭐ **THE VERSION THAT WORKS: run the AGGREGATOR SEARCHES in the same sweep.** D4 proved the mechanism — SerpAPI's `apply_options` carries **unwrapped ATS URLs**, and those are companies we do not have. **Shape, per D17:** export the results → the owner reviews → import the slugs. ⭐ **The receiving half is already live** — URL→(ats, slug) parsing, `job_captures`, unconfigured-slug suggestions, `validateBoard` and a **dry-run add-company route**. **Wiring, not building.**<br><br>⛔ **CARRY D4'S FINDINGS IN:** `apply_options` are **NOT all the same job** — Google clusters similar postings, so job 1's Ashby link was Coder's and its Workday link was Western Alliance Bank. ⛔ **NEVER ATTACH A HARVESTED SLUG TO THE JOB IT WAS FOUND UNDER** — treat each search as an unordered **pool** of (ats_host, slug). That is the "Localhost" and "Physical Superintelligence → Intel" class. ⛔ **Pin `&hl=en&gl=us`** — an unpinned call came back in Spanish, which would wreck the US-only filter.<br><br>⚠ **SerpAPI is on the FREE plan — 250 searches/month.** ~8/day fits; nothing more does. ⛔ Report the **new-company conversion rate** per sweep; stop searching a role family when it nears zero. ⚠ **Adzuna is retired as a slug source.**<br><br>⛔ **Validate every slug before enabling.** ⛔ **Never enable at 0% description coverage** (Ubisoft, Bosch, Adobe — 648 rows that could never be enriched). ⚠ **A49's dedup gates volume.**<br><br>⭐ **The extension path stays and is NOT replaced.** It adds **targeting** — a capture means *a real person cared about this job*. Already wired, costs nothing, and D12 ships it anyway |

---

## QUEUED 2026-10-03 — batch three (owner, 10-03 late)

| | Task | Notes |
|---|---|---|
| **D18** | ⭐ **NAV AMENDMENTS — supersede the relevant parts of D10** | **✅ MERGED 10-03 (25), `53c7ff2` on local `main` (--no-ff, clean, after D17's four commits) — 3198 / 3198 / 0 on the merge, client builds. NOT pushed (pushing deploys).** **Status 10-03 (24): ✅ DONE, `e7a3dd4` on branch `d18-d19-nav-mark` (worktree `draft-wt-d18`), NOT merged.** The tab reads **Draft House** (two lines, like the other three); **no symbol on any tab** — the /d mark stays on the card's Draft square, the board's Pending chip (D11), the extension prompt and /extension's install button. **Job Profiles lives in SETTINGS**: the avatar menu's settings block has a "Settings" heading with Job Profiles first (beside Account & security, Integrations); "Manage Job Profiles" is gone (one home); the page stays route-only; Profile's and the Daily Deck's links kept. Recruiter stays off the nav. "on the Draft tab" → "in Draft House" (two tooltips, the line toast, two server sentences, the panel heading). Answers **O55(a)**. Pinned tests changed on purpose (d6, d10, autoApplyPanelMove, profileAtsUiFixes, topBarChrome, jobsUiProfileFilters); new `d18NavAmendments`. **O56e partial** (`03051e4`): at 390 px four tabs + the wordmark need ~470 px; the row now tightens and fades at the edge while a tab is hidden — the real fix (the /d monogram on phones) is an owner call (O56e). Shots `draft-screenshots/d18-d19/`. **3192 / 3192 / 0** at the branch tip. Spec: ✅ Owner 10-03. **`AUTO APPLY` → "Draft House"**, amended from "Draft" — ⭐ it rhymes with **Full House** beside it and the card family holds across all four tabs. ⛔ **REMOVE THE DRAFT MARK FROM THAT TAB** — all four tabs are two-line text in the same format, **no symbol on any of them**. ⭐ It also resolves the clash where the `/draft` mark and the tab read as the same thing. ✅ **`JOB PROFILES` lives in SETTINGS** — that answers D10's open question about where it goes, so it is not orphaned. ✅ **`RECRUITER` is not a user tab at all** — it is a different side of the site (D5) |
| **D19** | ⭐ **THE MARK IN LIGHT MODE: ORANGE SLASH, BLACK WORDMARK** | **✅ MERGED 10-03 (25), `53c7ff2` on local `main` (--no-ff, clean, after D17's four commits) — 3198 / 3198 / 0 on the merge, client builds. NOT pushed (pushing deploys).** **Status 10-03 (24): ✅ DONE, `1172405` on branch `d18-d19-nav-mark`, NOT merged.** ⚠ Premise step: the mark was single-colour orange PNGs, so no token could reach "draft" — `scripts/d19SplitMark.mjs` cuts each into slash + letters masks (sum asserted per pixel; refuses a fused slash; a test fails if stale). The one StampLogo draws them as CSS masks from new tokens **LOGO_SLASH / LOGO_WORD** — light #FD4600 / #1E1915 (ink), dark #FD4600 / #FD4600; no theme branch, no page special-case (guarded); `forced-color-adjust: none`. Contrast re-derived: the light word **12.12–16.69** (the orange was 2.41–3.32); dark 4.02–5.08 unchanged. Dark: pixel diff of every mark shows max **2/255** on anti-aliased edges — visually identical, not byte-identical. Favicons and extension icons unchanged. 7 injected violations seen red. Shots `draft-screenshots/d18-d19/`. Spec: ✅ Owner 10-03. In **light mode** the `/` stays `--accent` and **"draft" becomes near-black `--ink`** rather than orange. ⛔ **Dark mode unchanged; every other surface unchanged.** ⚠ **This is a TOKEN change, not a per-surface one** — there is **one `StampLogo`**, collapsed from three implementations, and the rebrand once shipped the legacy name on every page precisely because a third copy existed that the guard could not see. ⛔ **Change the component and the token file; do not special-case a page.** ⭐ Contrast **improves** — orange on cream is **2.96:1**, which is why orange is fill-only and text uses `#A33200`, so a black wordmark is strictly better — ⚠ but the pair still gets **re-derived, not assumed**: the `/pricing` card once shipped an invisible badge and CTA for exactly that reason |

---

## QUEUED 2026-10-03 — batch two (owner, after the Draft-panel sketches)

| | Task | Notes |
|---|---|---|
| **D10** | ⭐ **NAV RENAMES — the card-game family** | **Status 10-03 (23): ✅ DONE, `654d4fd`, LOCAL.** DAILY DECK · FULL HOUSE · DRAFT · THE TABLE, each two-word label on two lines; bar **74 px**, mark **30 px**, two-line tab text ≈28 px (measured in a browser at 1440/1100/820/390). Ids and routes unchanged. Job Profiles is a ROUTE-ONLY page (the D5 pattern), reached from the avatar menu ("Manage Job Profiles"), Profile ("Open Job Profiles") and the Daily Deck's set-up state — all pinned by `test/d10NavRenames.test.js`. In-app copy naming tabs updated (The Table's empty states, the deck's "All jobs" links → Full House, the Draft panel's intro). Tab kept as **Draft**; Draft / Queue is **O55a**. Shots `draft-screenshots/d10-nav-renames/`. Spec: ✅ Decided. `TODAY` → **Daily Deck** · `JOBS` → **Full House** · `AUTO APPLY` → **Draft** · `DATABASE` → **The Table** (a database table and a card table — the pun works without being a joke) · ⛔ **`JOB PROFILES` IS REMOVED FROM THE TOP BAR ENTIRELY** · `RECRUITER` removed by D5. ⚠ **Two-line labels**, each fitting the mark's height; **top bar ~74px, mark ~30px**. ⛔ **Display strings only** — do not rename routes, identifiers or tables (BRAND.md). ⚠ **"Draft" now appears twice** — the `/draft` mark and the tab. Owner to confirm whether the tab reads **Draft** or **Draft / Queue**. ⚠ Removing Job Profiles from the nav ⛔ **does not remove the page** — say where it is reachable from instead, or it becomes an orphan like the recruiter surface |
| **D11** | **Full House — header, filters and density** | **Status 10-03 (23): ✅ DONE, `ff1c92c`, LOCAL.** "Let's get to work." (one line; it also replaces "Welcome back, <name>.") · the Pending chip is the `/d` mark · IMPORT and `ImportJobModal.jsx` DELETED — the `/api/import/job` route stays (the extension posts to it) · max **3** per row (D1's 4th column at ≥ 1700 px dropped; D1's grow/give-way geometry untouched) · **50** per page (the server already caps at 50). Shots `d11-full-house/`. ⛔ Ship with D12. Spec: `"Your jobs. / Pick up where you left off."` → **"Let's get to work."** · the pending **hourglass** chip becomes the **draft mark** · ⛔ **remove the IMPORT control entirely** — importing is the extension's job now (see D12) · **max 3 tiles per row**, and **~50 per page** rather than the current page size. ⚠ D1's bubble geometry still governs: grow 1.55 on hover, neighbours give up width, nothing reflows |
| **D12** | ⭐⭐ **SHIP AND ADVERTISE THE EXTENSION — it is the import path now** | **Status 10-03 (23): ✅ BUILT, `6e823dd` (route registration fixed in `0fe7226`), LOCAL — ⏸ the store link is O55b.** `/extension` (public; footer + marketing nav): what it does, from STORE_LISTING's own claims · "+ ADD JOBS" exactly where IMPORT sat · a first-run prompt under the search bar until `GET /api/extension/status` reports a live extension token, or "Not now" · the empty ★ Saved tab points at it. ⛔ `shared/extension.js` `EXTENSION_STORE_URL` is **null** — the item id is not in the repo — so the page says the link is not published and links nowhere. Slug discovery needs nothing new (captures already reach `job_captures`). Shots `d12-extension/`. Spec: ⛔ **Removing IMPORT from Full House leaves NO import route unless the extension is installed.** That makes install a dependency, not a nice-to-have. **Needs:** a real place on the site that explains and installs it · an empty-state and first-run prompt where IMPORT used to be · ⚠ the Web Store link, which is **unlisted** — decide whether it goes public. ⚠ **It is also the slug-discovery channel** (D4 confirmed extension captures are already wired, and the aggregator path is not), so installs feed the company list |
| **D13** | ✅ **THE EXTENSION — "THE COMPANION" (C). CHOSEN 10-03.** | **Status 10-03 (23): ✅ BUILT as C, `0fe7226`, LOCAL — extension v1.2.0, ⏸ NOT uploaded (O55c).** `extension/companion.js` picks: a form you drafted → **Fill it** + "You drafted this 2 days ago · résumé ready · 14 fields prepared" + the unanswered questions ("answer once and draft reuses it" — `custom_answers`, checked) · a posting → **Capture it** + **Score it** + "Not on your board yet" / "Saved on your board" · neither → recent captures. All four stay under "Everything" (Capture disabled, never hidden, on unreadable pages). Fill from the popup = the same `handleGatedHandoff()` as ⌃⇧Y. Server: `POST /api/import/context` (read-only; URL in the BODY, not logged) + the existing `gate-packets?origin=`. ⛔ No new permission, host, content script or storage key. ⚠ **One new transmission** — the tab's URL when the popup opens — now in the privacy policy (owner to review). A35's restyle NOT done. Shots `d13-companion/`. Sketch: `ext.html`. Three concepts were built: **A stay narrow** · **B the pocket workspace** · **C the companion**. ⭐⭐ **C WINS BECAUSE IT DOES THE SAME FOUR THINGS AND PICKS THE RIGHT ONE** — not because it does more.<br><br>**WHAT IT DOES TODAY, for the record:** `⌃⇧K` **capture** injects the extractor under `activeTab`, reads JSON-LD + per-host selectors, posts a **labelled block**; ⭐ since the deterministic fallback it **degrades instead of failing** when the model is down · `⌃⇧Y` **fill** pulls a prepared packet for that origin, fills, shows the **review overlay** — ⛔ **you press submit** · **ATS score** and **open draft** are links. It holds **six things**: three persist (last capture, account name, **its own token — the only one ever transmitted**), three die with the browser (packet at 10-min expiry, last fill result, batch origin + count). ⛔ **No password, no cookie, no portal credential.**<br><br>**THE DESIGN:** on a **job posting** → *Capture it* + *Score it*, and it can say **"not on your board yet"** · on an **application form you drafted** → *Fill it*, and it says **"you drafted this 2 days ago · résumé ready · 14 fields prepared"** · on neither → recent captures. ⭐ **It can do this for free: the URL names the ATS and the slug, and D4 confirmed that parsing is already live** (`importJob.js:82-165`). ⭐ It surfaces the **unanswered questions at the moment they matter**, and says the answer is **reusable** — the `custom_answers` exact-question-text point.<br><br>⛔ **NO NEW STORAGE, NO NEW PERMISSION, NO NEW DISCLOSURE.** That is the deciding argument: the next submission already carries a rename plus a host change, which is the shape that triggers in-depth review. ⚠ **Context detection can be wrong, and a wrong primary action is worse than a menu** — keep a visible fallback to all four. ⚠ "You drafted this" means a lookup per popup open; cheap, but it is a call.<br><br>⏸ **B IS HELD, NOT DROPPED — build it after this submission clears.** ⭐ It is the better *strategy*: works **signed out**, free local scoring (⭐ the scorer makes **zero model calls**, so giving it away costs nothing), and six saved jobs plus a "sync to draft" link is a far better pitch than a signup form — **value first, sign-up after.** ⛔ **But a local store of captured jobs is a NEW DISCLOSURE**: the listing says six keys and that only the token is transmitted, and B changes both. ⚠ And it has an unanswered question — **it needs the résumé on the device to score. Where does that come from without an account?**<br><br>⚠ Still open and unchanged: **A35's restyle** to the new design language · ⛔ **the review overlay is what a Web Store reviewer sees** and what proves fill-and-review rather than auto-submit · **V2 of the VM work would have it upload a portal session**, changing its data flow, declaration and policy — **bundle or submit twice** |
| **D14** | **Draft panel — Stopped and Queued side by side, 75 / 25** | **Status 10-03 (23): ✅ DONE, `fd32c2b`, LOCAL.** Pending tab: **Stopped** (Needs review) `3fr` | **Queued** (Waiting in line + In flight) `1fr` from a 1080 px viewport; one column below, Stopped first (DOM order). Each column has a counted eyebrow and an empty line; the sections moved verbatim. Shots `d14-draft-split/`. Spec: ✅ Decided from the v3 sketch. Stopped is the working surface; Queued is a glance. ⚠ Below ~1080px they stack, Stopped first |
| **D15** | ⭐ **THE TABLE — the user's application history** | **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **The download is wired to D16's kept copy** (`50f6110`): `resumeSource` = kept copy · backfilled copy · working résumé · none, and the link is labelled by it; a kept copy whose working résumé is gone is now offered. **Status 10-03 (24): ✅ DONE, `2fdf757`, LOCAL.** The Table opens on **History** (the spreadsheet stays behind it as "Spreadsheet"; `?sheet=pending` unchanged). One row per application from `application_records` + `job_applications`, ONE status (`shared/applicationHistory.js`): In play · Sent (after 30 days it ASKS "Did they reply?" — NULL is never "no reply") · Replied (⛔ a rejection counts) · No reply (only on "Still nothing") · Closed (did not apply / withdrew). Chips = filters + counts (summary strip REMOVED); date range; sort newest / oldest / A–Z / awaiting longest; search covers company, title and the posting text (matched on the server, never returned — `GET /api/applications/history`); each row expands into drafted → résumé → approved → sent → waiting with days; "Waiting longest" nudge; D1 rail + depth tokens. Replies go through the AK1 merge endpoint (`PATCH /api/apply/applications/:jobId/response`) into `job_applications`. "Download résumé" → D16's `/api/applications/:recordId/resume`, failure stated. ⚠ **Premise corrected:** `recordAtsOutcome` is the generation-lift recorder (already called on generate), not the employer-reply path. +12 tests, 5 injected violations caught; **3180 / 3180 / 0**. Shots `draft-screenshots/d15-the-table/` (stubbed-`/api` harness, synthetic rows). **Open (O56):** does Closed include rejections · keep the other sheets · a rejected row shown green · the 390 px top bar clips "The Table" (from D10). Spec: ✅ Chosen from `table.html`. ⛔ **This is the USER-FACING panel in the top bar, not the admin DB inspector.** It manages **every application, pending and sent**. **✅ DECIDED:** search across **company, title and the posting text** · a **date range** · a sort (newest / oldest / A–Z / awaiting longest) · **status chips that double as filters AND as the counts** — In play · Sent · Replied · No reply · Closed · ⛔ **NO STATUS BAR** — the chips carry the counts, so the summary row is redundant and comes out · each row **expands into a timeline** (drafted → résumé → approved → sent → waiting, with days elapsed) · D1's hover rail and depth tokens throughout. ⭐⭐ **THE REAL POINT OF THIS PAGE IS CAPTURING OUTCOMES.** `job_applications` has never held a row and `recordAtsOutcome` has never fired — **that is the only validation the whole product has.** A matured, unanswered application shows **"Did they reply?"** as its status, with *Interview / Rejected / Still nothing* in the fold. ⛔ Reuse `shared/applicationResponse.js`: **a rejection COUNTS as a response** (an ATS score is a screening score; it has no business predicting hiring outcomes) and `MATURITY_DAYS = 30` — **NULL is not "no response" yet.** ⚠ Surface the oldest unanswered somewhere; it is the nudge that works |
| **D16** | ⛔ **GENERATED RÉSUMÉS: COMPRESS AT REST, DECOMPRESS ON DEMAND** | **🚀 LIVE 10-05 (28): `291c906` (`/api/version` 22:11Z; 134 migrations, `latestApplied: 126_ats_grade_corpus`, `highestNumbered: 128_job_tags`) — merged on the owner's "complete all the log items"; 3337 / 3337 / 0, client builds.** **✅ MERGED via `d16-a76-integrate`** (`babb847`). 125 sits before 127 in both runners; the runner applies by id, so it ran on production's database already at 128 (pinned: `test/lateLowerMigrations`, + a proof on a DB copy). The Table's download follows the kept copy (O56a, `50f6110`). `--backfill` stays dry (O56). **Status 10-03 (24): ✅ BUILT, `2d1bbfa` on branch `d16-artifacts` (worktree `draft-wt-d16`) — ⏸ NOT merged (the session's permission layer refused the merge; owner runs it, O56) — migration 125.** Found first: nothing kept the résumé actually SENT — `resumes.html` is overwritten on every regeneration and apply-run PDFs are temp files. Now the résumé is copied ONCE when the application is recorded (user or pipeline) into `application_artifacts`: brotli HTML + sha256, deleted with its record and the account. Measured on six synthetic résumés through draft's own formatter: HTML 9.0 KB → brotli 1.67 KB (5.4×); PDF 94 KB → 77 KB (1.2×) — a stored PDF costs ~56× — so **HTML is kept and the browser prints it** (draft's server PDF routes already 503), **~1.7 MB per 1,000 applications**. `GET /api/applications/:recordId/resume[?inline=1]` → HTML with `X-Artifact-Source` snapshot_at_record / backfill / current_resume; 404 not_found / artifact_missing; ⛔ 500 artifact_corrupt, never an empty file (4 injected violations seen red). Shares the tools service's A65 guards (2 MB cap, refuse when the volume is low), NOT its 90-day expiry. ✅ **Retention DECIDED by the owner 10-03 (24): keep the defaults** — kept as long as its application record exists, deleted with the account. `scripts/d16CompressArtifacts.mjs` (dry run; `--backfill` labels copies 'backfill' — run on production is an owner call). ⚠ draft's DB does not set `secure_delete` (Resume Master's store does). Branch alone **3182 / 3182 / 0**. Spec: ✅ Owner decision 10-03. Every application's artifact must be **downloadable from The Table**, months later — it is the thing a user actually wants back. ⛔ **But store it compressed and expand only when asked**, to bound the volume. ⚠ **Precedent, and it is recent:** draft's volume hit **ENOSPC at 481/500 MB** and the backup budget now refuses before copying rather than filling the disk. **PDFs grow far faster than rows.** ⚠ **A57 already set 90-day expiry with secure delete on Resume Master's stored artifacts** — ⛔ **reconcile the two policies rather than writing a second one**: does an application's résumé expire at 90 days, or is it kept because it is evidence of something the user did? ⭐ **They are different things and probably want different answers.** ⛔ **Decompression must not be silent on failure** — a corrupted artifact must say so, not return an empty PDF. ⚠ Measure the compression ratio on real generated résumés before committing to a budget; HTML compresses very well, PDF much less |

---


⛔ **D5, D6 and D7 touch different surfaces and do not collide.** D8 and D9 are design work and wait
for the owner to choose from the sketches.

| | Task | Notes |
|---|---|---|
| **D5** | ⛔ **REMOVE THE RECRUITER TAB FROM THE USER-SIDE NAV** | **Status 10-03 (22): ✅ DONE, `effef72`, LOCAL.** Tab gone from `appTabs`; `RecruiterPanel` and `/app/recruiter` kept (a `ROUTE_ONLY_TABS` entry, reachable by link, never in the bar). ⚠ **Two in-app links still lead into it** — JobCard's "Recruiter · View company KB →" row (logged-in cards, the Database panel) and CompanyViewModal's "Open in Recruiter view →" (from the bubble and the detail panel); without the route entry both would bounce to the board. Whether they go too → **O53**. `GET /api/jobs/:id/recruiter` is a fixed-body stub, untouched. Guard: `test/recruiterTabRemoved.test.js` (mutation-checked). Spec: It sits in the top bar and **goes nowhere** — FE-6 built a recruiter surface with no front door, no recruiter role and no signup path. ⛔ **A nav item that leads nowhere is worse than a missing one**: it advertises a product that does not exist, and it is the same class as the "Not linked" label that triggered a whole ATS-partnership investigation. ⚠ **Remove the TAB, keep the CODE** — `RECRUITER_LAYER.md` and `RECRUITER_LAYER_EXECUTION.md` are the plan, and R2–R6 are blocked on candidate supply, not on this surface. ⛔ Report what the route does today and whether anything else links to it |
| **D6** | ⭐ **RENAME "AUTO APPLY" → "DRAFT", with the mark in the top bar** | **Status 10-03 (22): ✅ DONE, `5dad7d0` (merged `97747f1`), LOCAL.** 14 display strings: the tab (`/d` mark via one shared `DraftMark.jsx`, also used by the bubble's Draft square), badge sentence, 2 tooltips, the waiting toast, panel heading, history empty state, the tools dock link, `/tools/apply` gate (2), the ATS/Generate upsell (2 — "Apply in one click" now says nothing is sent until you approve), 2 server toasts in `routes/apply.js`. Untouched: ids, `/app/auto-apply`, tables, `applyAutomation.js`, log lines, the mobile contract descriptions, the FAQ "Does Draft auto-apply…?" (search words; allowlisted with its reason). **Extension: no hits — no re-upload.** Badge: counts approvals + review holds + open questions, not all Drafts — its tooltip / screen-reader text now says "N drafts need your attention". Android `195a10a` (admin queue subtitle; local, not pushed). iOS not edited (O10) — 2 hits listed in O53. Guard: `test/d6DraftNavLabel.test.js`. Spec: ⛔ **Vocabulary before styling**, as A53 established. The product's verb is *draft*, the brand is *draft*, the card button says **Draft**, and the nav says **AUTO APPLY** — **two names for one action teaches two mental models.** ⭐ Use the `/d` mark in the tab, as the card's primary button does. ⚠ **Sweep for the same split everywhere**: panel headings, the queue page, toasts, empty states, emails, the extension's copy, and both mobile repos. ⛔ Do NOT rename identifiers, routes, table names or `applyAutomation.js` — those are internal and renaming them is cost without benefit (BRAND.md's rule). **Display strings only.** ⚠ It also changes what the nav badge counts mean to a reader — check the count label still makes sense |
| **D7** | **Bug reporting — the design doc (was D3)** | **Status 10-03 (22): ✅ DONE as D3** — `docs/BUG_REPORTING.md` (`5fbe96a`); its four decisions are **O50**. Spec: ⏸ Unchanged. `docs/BUG_REPORTING.md` first, build nothing. Three layers, the context payload, ⛔ the Article 9 allowlist. See the D3 section below |

⚠ **D8 (Database panel) and D9 (the Draft/auto-apply panel) are being sketched now.** ⛔ Do not start
either until the owner has chosen from the visualisations — the last two surfaces built ahead of a
chosen design (A40's three columns, A54's palette) both had to be redone.

---

## ✅ D4 · WHAT DOES "LIVE SEARCH ONLY" ACTUALLY MEAN? — ~~RUN THIS NEXT~~ **PROBED 10-03 (22)**

**Status 10-03 (22b) — ADDENDUM, the owner's live call + 20 measured searches: ⛔ §3C REWRITTEN (`COMPANY_LIST_STRATEGY.md`, a deliberate correction; 4 rows in `CORRECTIONS_REGISTER.md`).** ⛔ **Adzuna RETIRED as a slug source** (click-tracking redirects, excerpted descriptions, UK/EU-first, second-hand relistings) — and its absence from the board was **deliberate**, `4c4ce74` 07-23, not a defect. ⭐ **SerpApi works**: `apply_options[].link` carries unwrapped ATS URLs; ⛔ **a POOL, not a pairing** — Google clusters similar postings, so a slug is never attached to the job it came under. **Yield (`docs/SERPAPI_SLUG_YIELD.md`): 20 searches → 200 jobs, 1,031 links, 5.0 % ATS, 83.4 % board-to-board; 50 distinct pairs, 50 NEW** — ashby 9 · lever 1 · smartrecruiters 3 · workable 1 · recruitee 1 (15 crawlable today) · **workday 25** (not harvest-ready: site parse + 300-posting cap) · 10 on no adapter · ⛔ **greenhouse 0**. Free plan, 24 / 250 used, renews 10-12. Jobright in 12 of 20 queries. `hl=en&gl=us`: already sent since `462618f`; pinned by `test/serpapiLocale.test.js` (`effef72`). ⛔ **Nothing built** — a harvester is the owner's call (O54). Harvest infrastructure that EXISTS: URL→(ats, slug) parse, `job_captures`, `harvestedSuggestions`, `validateBoard` (no description-coverage check), dry-by-default add-company route, `company_ats_list` table. Missing: any SerpApi→pool input; Workday site parse; parsers for icims/jazzhr/oracle/eightfold/gem/pinpoint. **Before that — 10-03 (22): ✅ PROBED, nothing built → `docs/LIVE_SEARCH_FINDING.md`.** ⛔ **§3C DOES NOT WORK AS WRITTEN — rewrite it.** (1) "live search only" is a **static label** (`routes/adminDb.js:258`: has a key, not in the crawl list) — not a status; the only live-search path (`POST /api/jobs/search`) needs login but its one caller is the logged-out landing page → 401 in production: **a dead branch, by defect**. (2) **0 adzuna / 0 serpapi rows** in every local copy (production not read — O51). (3) **Adzuna 50 / 50 URLs are its own wrapper**, no ATS host in the API; followed by hand 4 / 12 reach greenhouse/lever/ashby (scraping, terms unclear). **SerpApi: the URL the code keeps is an ATS 0 / 20 times**; 73 % are LinkedIn/Indeed-type boards; new companies found: 0. (4) ⭐ The **receiving half EXISTS and is live**: URL→(ats, slug) parsing (`importJob.js:82-165`), `job_captures`, unconfigured-slug suggestions, `validateBoard`, a dry-by-default add-company route; the list is a table (`company_ats_list`, 29 / 22 active). Missing: any input from aggregators, a **description-coverage check** in the validator, Workday. (5) SerpApi is the **free plan, 250 / month** ("already paid for" is wrong); spend today ≈ 0 only because the path is dead. Searches spent: Adzuna 1, SerpApi 3. (6) Extension captures **wired**; board-opened jobs and apply handoffs **not** (and point at already-configured companies). Recommended (not built): grow from the curated lists + extension captures through the existing add-company path, add description coverage to `validateBoard` first, relabel or remove the label.

⏸ Queued 2026-10-02 by the owner. ⛔ **PROBE AND REPORT. Build nothing in this pass.**

### Why it is urgent

Pipeline Health shows `adzuna` and `serpapi` as **LIVE SEARCH ONLY · 0 active rows**. ⚠ **Nobody
knows what that status actually means**, and two things depend on the answer:

⭐ **(1) Volume.** The board is ~25 configured companies against ~2,200 that exist. Aggregators see
the **whole market**.
⭐ **(2) ⭐ THE SLUGS.** `COMPANY_LIST_STRATEGY.md` §3C is built on this: **an aggregator result's URL
contains the ATS host AND the company slug.** So every search does not just find a job — **it finds
a company, permanently.** Configure that company once and every future posting arrives same-day,
direct from its board, for free. **That is the engine for ingesting fresh jobs from ATS partner
portals**, and it is the owner's stated reason this matters.

⛔ **If that path is not actually wired, the whole company-growth strategy rests on nothing.**

### What to establish — answer each in writing, with evidence

```
1  WHAT "LIVE SEARCH ONLY" MEANS. Read the code that sets it. Is it a label for
   "queried on demand, never persisted", a dead branch, or something else entirely?
   ⚠ Do not infer it from the panel — the panel has already lied once (A50's audit found
   Pipeline Health mislabelling non-US and inactive rows as "UNENRICHED").

2  ARE WE INGESTING FROM THEM AT ALL? 0 active rows is the panel's claim. Verify against the
   database, not the panel. If zero: is that by design, by configuration, or by defect?

3  ⛔ DO THEIR RESULTS ACTUALLY CARRY ATS URLs? This is the load-bearing question.
   Run a real search against each and REPORT ACTUAL RESULT URLs. Then:
     · what fraction point at a known ATS host (greenhouse / lever / ashby / workable /
       recruitee / smartrecruiters / workday)?
     · what fraction are the aggregator's own redirect wrapper, an employer's careers page, or a
       dead end?
   ⚠ ⛔ IF MOST RESULTS ARE WRAPPED REDIRECTS, THE SLUG-HARVEST IDEA DOES NOT WORK AS WRITTEN and
     COMPANY_LIST_STRATEGY.md §3C needs rewriting. Say so plainly rather than working around it.

4  IS THE HARVEST INFRASTRUCTURE THERE? The owner asks whether "all this discussed infrastructure
   is there and wired". Check honestly, per piece:
     · is there any code that extracts (ats_host, slug) from a URL?
     · is there a validator that tests a candidate slug against its ATS board before enabling it?
     · is the company list a table, or config files?
     · is there any path from "a URL was seen" to "a company was added"?
   ⛔ THE LIKELY ANSWER IS "NONE OF IT" — A45 was queued and never run. Report what exists rather
   than what was planned. ⚠ This project has repeatedly found documents describing machinery that
   was never built.

5  COST AND LIMITS. Both keys are configured. What is the quota, what does a search cost, and is
   anything being spent today for 0 rows?

6  THE OTHER THREE FREE SOURCES of slugs, per A45 — are any wired?
     extension captures · jobs opened from our own board · apply / handoff targets.
   ⛔ All three are URLs we ALREADY HOLD and that disclose nothing new.
```

### ⚠ Constraints on whatever comes next

- ⛔ **Do not enable a source or company at 0% description coverage.** Ubisoft, Bosch and Adobe were
  seeded inactive for exactly that: 648 rows that could never be enriched.
- ⛔ **Validate every harvested slug before enabling it.** A URL proves a page existed, not that a
  board is worth crawling.
- ⚠ **Growth is paced by enrichment capacity**, and the board is still being filtered for US-only.
- ⚠ **A49's dedup work gates this** — an aggregator and an ATS board will return the same posting,
  and every new source multiplies duplicates.

---

## ✅ D1 · JOB CARDS AS BUBBLES — chosen 2026-10-02

**Status 10-03 (21): ✅ BUILT, `c6bd112`, LOCAL** (closes A78, A79) — rows of 2/3/4, grow 1.55 on hover/focus-within, the three-square rail, depth tokens in both themes, Poppins 800 italic self-hosted. Decided: the rail is **always shown on touch**, and on a phone it sits on its own line under the text. ⛔ The ATS square shows the **bar mark, not the number**, until A76 (`ATS_NUMBER_SHOWN` in `shared/atsBands.js`). Shots: `draft-screenshots/d1-bubbles/`.

Replaces the jobs-page card. Sketch: `bubbles2.html`. ⚠ Supersedes the A79 explorations.

### Layout

```
2, 3 or 4 cards PER ROW by viewport width — 3 is the default
flex row · each card flex: 1 1 0 · gap 18px · page padding 28px

HOVER / FOCUS-WITHIN   the card grows to flex-grow 1.55
                       ⛔ THE NEIGHBOURS GIVE UP THE WIDTH. They do NOT reflow to another row,
                         and the row height never changes.
```

⛔ **Sizing is deliberate so compression never truncates.** Card padding `16px 20px`, gaps 18px, and
growth capped at 1.55× — the resting card has enough slack that neighbours compress into
**whitespace**, not into text. Titles ellipsis on one line; nothing wraps or rearranges.
⚠ An earlier sketch used 2.1× growth and 12px gaps and it truncated.

### The card

```
[ logo 52px ] [ company / title / meta ] [ rail — zero width until hover ]

logo        52×52, radius 13, shadow 0 2px 6px rgba(0,0,0,.14)
text block  height 52px, vertically centred — shares the logo's exact top and bottom edge
company     ⭐ THE LOGO FACE — heavy italic geometric sans, 17px, letter-spacing -.015em
title       12.5px, --soft
meta        11px, --faint      (all three single-line, ellipsis)
```

⛔ **The company name keeps its hyperlink and loses the underline and the ↗.** ⚠ Keep a non-colour
hover affordance — removing both leaves only colour, which fails for colour-blind users.

⛔ **NO BAND AND NO NUMBER on the card body.** The score lives on the ATS button only.
⚠ **Consequence, and it is deliberate:** nothing on the row shows fit, so **the sort order becomes
the signal** — which is why A75's "ATS match" sort matters more than it looks.

### The rail — three squares, 52px, matching the logo

```
ATS     ⭐ SHOWS THE SCORE when there is one — e.g. 58 with a small "ats" caption,
          green on --okbg.
        ⛔ NO SCORE → the bar icon on --paper, NOT a zero. "Not enough signal" is the scorer
          DECLINING, a correctness state, not a low score.
SAVE    star outline
DRAFT   ⭐ the mark: /d  · --accent fill · shadow tinted orange so it sits in its own colour

⛔ GENERATE and APPLY are REMOVED from the card.
```

**Rail motion:** `max-width: 0 → 196px`, opacity 0 → 1, `margin-left: 0 → 4px`, 0.42s on
`cubic-bezier(.3,.8,.25,1)`. The rail growing is what pushes the neighbours — one motion, not two.

### ⭐ Depth — use it on every control

```
rest   box-shadow: 0 3px 8px rgba(0,0,0,.11), inset 0 1px 0 rgba(255,255,255,.66)
hover  0 7px 17px rgba(0,0,0,.15) + translateY(-2px)
press  translateY(0) + 0 2px 5px rgba(0,0,0,.13)
draft  0 3px 9px rgba(253,70,0,.34)  — tinted, so it reads as orange rather than grey-made-orange
```

The inset top highlight is what makes it feel lit rather than merely dropped.

### ⛔ Before this ships

- **`:focus-within`, not only `:hover`.** Hover-only buttons are unreachable by keyboard.
- ⚠ **Touch has no hover.** Decide: always-visible on touch, or tap-to-reveal. Same shape as the
  swipe/scroll conflict resolved on the deck.
- ⛔ **Self-host the logo typeface.** The sketch loads Poppins from Google Fonts; ⚠ Google Fonts is
  already an open item on the privacy reconciliation and a second third-party request makes it
  worse. A54 established self-hosted fonts with no third-party request — follow it.
  ⚠ Poppins Bold Italic is an **approximation** of the mark; check the source artwork.
- **Tokens only.** The guard fails on any colour outside the token file.
- ⚠ **4-per-row is a wide-monitor column count.** At 1280px the resting cards ellipsis early.

---

## ✅ D3 · BUG REPORTING AND A TICKET PANEL — queued 2026-10-02, ~~not yet designed~~ **DESIGNED 10-03 (22)**

**Status 10-03 (22): ✅ DESIGNED, nothing built → `docs/BUG_REPORTING.md`; ⏸ the four decisions are O50.** ⛔ **Error handling today is ZERO in draft**: no React error boundary (a render error blanks the app), no `window.onerror`/`unhandledrejection`, no Express error middleware, no `process.on`, no telemetry. Build order: **A** shared payload module (allowlist schema + scrubber + fingerprint) **+ Layer 2 + Layer 1** together, so Layer 2 cannot slip · **B** Layer 3, `/admin/tickets` · **C** "deployed" check, regression reopen, reporter notification · **D** Resume Master's own copy. ⚠ The inspector's redaction covers credentials only (`services/adminSafety.js:17-20`) — reused as an intake refusal; content safety comes from the allowlist in `shared/piiPolicy.js` + server-side scrubbing against what the server knows of the reporter. ⚠ Query strings can carry a session token (`api.js:45`) — never captured. Client SHA compiled into the bundle, not fetched. Production has no `.git` → "deployed" needs the GitHub compare API (a read-only token) or a by-hand check. ⚠ Source maps would publish the source via `express.static` — move them out first.

⛔ **Design the data model and the capture payload first. The panel is the easy half.**

### Why it is worth building now, with zero users

⭐ **The owner IS the first reporter.** Every defect this session — the ATS panel not opening, search
returning nothing, filters doing nothing, "analysing" then erroring — was found by the owner using
the product and relayed through chat. ⚠ **That relay is lossy:** no URL, no job id, no console
error, no build SHA. Half of each investigation has been reconstructing what the owner was looking
at. A report button would have carried all of it for free.

⭐ **And it is the only channel that will exist when strangers arrive.** A user who hits a bug today
has no way to tell anyone.

### How this is normally built — three layers, and most products need all three

```
1  USER-INITIATED        a "Report a problem" control. The user knows something is wrong.
2  AUTOMATIC CAPTURE     an error boundary + a global handler. The product knows before the user
                         says anything — and often before they notice.
3  TRIAGE                somewhere the reports land, get a status, and get closed.
```

⚠ **Most teams build 1 and 3, skip 2, then wonder why the inbox is empty while the product is
broken.** ⭐ **Layer 2 is where the real signal is** — people do not report, they leave.

### ⭐ The context payload is what makes a report useful

A bare "it is broken" costs more to chase than it saves. **Attach automatically, without asking:**

```
WHERE       route, the component, the job / profile / run id in view
WHAT        the console error + stack, the last failed request (method, path, status)
BUILD       ⭐ the commit SHA from /api/version — "which build was this" has been the first
            question in almost every investigation here
WHO         user id, plan, browser, viewport.  ⛔ NOT the résumé. NOT profile contents.
WHEN        timestamp, and the last few user actions if a breadcrumb trail is cheap
```

⛔ **PRIVACY IS THE WHOLE RISK.** A naive reporter scoops up whatever is on screen — which here
means résumé text, addresses, phone numbers, and the **Article 9 columns** (`ethnicity`,
`disability_status`, `veteran_status`). ⛔ **ALLOWLIST the fields captured; never serialise the page
or the store.** The admin inspector already redacts passwords, tokens and session ids — the same
redaction applies here, **by construction, not by remembering**.

⚠ **A screenshot is the highest-value attachment and the highest-risk one.** If offered at all:
opt-in per report, previewed before sending, never automatic.

### The ticket panel

```
STATUS       new → triaged → in progress → fixed → closed   (+ won't fix, duplicate)
SEVERITY     set at TRIAGE, not by the reporter — ⚠ everyone picks "critical"
GROUPING     ⭐ identical stack + route = ONE ticket with a count, not forty.
             The dedup lesson (A49) applies to tickets too.
LINKS        to the job, the run, the user, the build
RESOLUTION   ⭐ the commit that fixed it, AND whether it is DEPLOYED — not merely merged.
             This project has shipped a fix that sat undeployed for a day while being treated
             as done.
```

⭐ **Close the loop with the reporter.** A ticket fixed and never acknowledged teaches people not to
report again — which is the failure mode that makes the whole feature worthless.

### ⚠ Decisions needed before building

1. **Build it, or use a service?** Sentry and similar do layer 2 far better than a first attempt
   will. ⚠ But they are a **third party receiving error payloads from a product that handles
   special-category data** — that is a privacy-reconciliation entry and a policy line. ⭐ A plausible
   split: **in-house for user reports, a service for automatic error capture.** Decide deliberately.
2. **Does the ticket panel live inside the admin panel (A50) or beside it?** A50 is mid-audit; this
   must not collide with it.
3. **Retention.** A report carries personal data, so it needs a stated lifetime and real deletion —
   the same obligation A57 created for stored artifacts.
4. ⚠ **Resume Master needs this too and it is a separate deployment.** One panel reading both, or
   one each? ⛔ The products are *not linked* by decision.

---

## ✅ D2 · THE ATS REPORT — "THE WEAVE" — chosen 2026-10-02

**Status 10-03 (21): ✅ BUILT, `568b556`, LOCAL**, inside the one report component (all four surfaces). The four open questions answered — **owner, reverse any**: (1) cap **8** threads, the rest folded; (2) plays **once per report per browser session**; (3) the score count-up is built and **dormant until A76** (`ATS_NUMBER_SHOWN`); (4) one component. Also: the drawing starts when the weave is on screen (the deck mounts it mid-slide). Shots: `draft-screenshots/d2-weave/`.

Sketch: `concepts.html` tab 2. Four concepts were built and compared: the scan, the weave, the
stamp, the sieve.

### ⭐ Why the weave won

**A match IS a pairing between two documents, and this draws exactly that.** It was the only one of
the four that is **informative at rest** — when the motion stops, the picture still says something:
asks paired on the left, asks with nothing attached dangling.

⭐ **Dangling asks communicate "missing" better than a red chip does**, because the absence is the
visual rather than a label.

**Why the others lost, recorded so they are not re-proposed:**

| | |
|---|---|
| **The scan** | ⭐ Strong second — the only one showing **where** in the résumé you matched, and it makes the product's own line literal. ⚠ Needs a loaded résumé, so it cannot run everywhere |
| **The stamp** | ⭐ Best on brand — cream paper, the tilted mark. ⛔ **Least informative: a satisfying reveal of a list you could have read.** Wears out fastest on repeat opens |
| **The sieve** | ⛔ **Tone problem.** Watching your terms *fail to pass a filter* reads as rejection. The product's voice is *"here is what you could claim"* — the animation argues the opposite of the copy |

### The design

```
TWO COLUMNS          left: what this posting asks     right: what your résumé has
ON OPEN              curves draw between pairs, one at a time, ~260ms apart
                     each pair turns green as its thread lands
AFTER THE PAIRS      unmatched asks switch to a dashed outline — nothing attached
THEN                 the score counts up, ~900ms, eased
```

Thread: `stroke-dasharray` + `stroke-dashoffset` animated to 0, a cubic Bézier with horizontal
control points so it leaves and arrives flat.

### ⛔ Constraints that carry over and must survive

- ⛔ **"Not enough signal" stays visually DISTINCT from "Weak"** — declining is a correctness state.
- ⛔ **Generic language stays separated from genuine gaps**, folded away and labelled **not a gap**.
  Surfacing *Managed* or *collaboration* as a deficiency is a claim that is not true.
- ⛔ **Claim copy unchanged**, and it appears **once**, where the action is — not verbatim three
  times as today: *"claiming a term says it is true of you"*. Nothing is ever pre-selected.
- ⛔ **Depth on every claim control**, per D1.
- ⛔ `prefers-reduced-motion` renders the final state with no drawing.

### ⚠ Open, and they need deciding before build

1. ⛔ **A CAP ON THREADS.** Six is elegant; twenty is spaghetti. Show the top N asks and fold the
   rest — or fall back to the segmented bar above a threshold.
2. **Does it replay on every open?** A panel opened repeatedly will wear out. Once per job, once per
   session, or always — the same question the deck's deal animation had.
3. ⚠ **The score is now the largest element.** That is a stronger claim than a band chip, and
   ⛔ **A76's validation corpus is the condition for it, not a follow-up** — 30 postings graded by
   one person does not support the most prominent element in the product's most-seen free feature.
4. ⭐ **One component, four surfaces** (A52): the deck's left panel, the board, the mobile sheet,
   the public `/tools/ats`. ⛔ Build it once. **Three StampLogo implementations is how the legacy
   brand shipped on every page while the guard passed green.**

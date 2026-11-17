# WORKLOG ARCHIVE — sessions 2026-08 → 2026-10-13 (42k and older), and the CURRENT STATE table before 10-30

Moved here from `docs/WORKLOG.md` on 2026-10-30 (session 43p, the reconciliation's G6) because the WORKLOG had grown
past 1.2 MB. **Nothing below was edited.** It is history: every figure in it was true when written and may be stale now —
the live state is the WORKLOG's CURRENT STATE.

## CURRENT STATE — the table as it stood on 2026-10-29

| | |
|---|---|
| Production (draft) | ⭐ **10-12 (41), measured: `7ebed68` LIVE — D92 + D93** (`/api/version` commit `7ebed68`, started 05:36:53Z, `latestApplied: 157_base_resume_uploads`; `/app/customise` 200; the served pre-paint script sets `data-nav` / `data-sentence`; health 200). ⚠ Pushed by someone other than the agent (01:35:53 local, from this machine). `b8be215` (D90 P3) went live before it (the 10-12 monitor). Local `main` = `7ebed68` + **`a7f3700` (D94, migration 158) — NOT pushed.** Before: ⭐ **10-11 (40), measured: `00ffab3` LIVE — D91 (four themes, shape cues, Settings → Appearance)** (`/api/version` commit `00ffab3`, `latestApplied: 157_base_resume_uploads` — D91 adds no migration; the served page carries the pre-paint theme script; `/api/settings/appearance` answers 401 signed out). Before: ⭐ **10-10 (39l, audit), measured: `7f4715d` LIVE** (`/api/version`, started 05:55:15Z, **`latestApplied: 157_base_resume_uploads`**, contract 2.5.0; health 200) = `origin/main`; local `main` is that plus **this audit's docs commit only (not pushed — no go asked)**. The plugin `draft-hq/draft-plugin` = `df44ff6`, **PUBLIC** (`"private": false`), local = origin. The tools service `4e89300` LIVE = origin. Before: ⭐ **10-10 (39h), measured: `0b4aae9` LIVE** (`/api/version`; pushed on the owner's "push both" after the security@ route was set up). `/docs/claude`, `/privacy`, `/terms`, `/.well-known/security.txt`, the OAuth metadata → 200; `/mcp` → 401 without a token. Local `main` **3 commits ahead, NOT pushed:** `07e981f` (CIMD + the reviewer reset in People) · `4b4068d` (the listing pack) · this docs commit — no migration. **The plugin: `github.com/draft-hq/draft-plugin` at `df44ff6` (PUSHED; ⚠ the repository is PRIVATE).** Before: ⭐ **10-10 (39g), measured: `ff4a721` LIVE** (`/api/version`, started 2026-10-10 01:45:07Z, migration 156, contract 2.5.0) = `origin/main` after fetch — pushed on the owner's "push it" (O92 (a)). Local `main` **10 commits ahead, NOT pushed:** `d3b01fb` · `2583312` · `14b8d53` · `fcd7cfa` · `203b4e4` · `a658cca` · `bf52d07` · `141c798` · `ab7ec74` · `6643ac6` + this docs commit — **no migration.** The plugin repository: `github.com/Sri-Yellela/draft-plugin` at `29ebf14`; local `a12a464` is 1 ahead (the v1 tool names — push WITH draft). Before: ⭐ **10-09 (39f), measured 10-10 ~01:00Z: `76595d8` LIVE** (`/api/version`, `RAILWAY_GIT_COMMIT_SHA`, started 00:53:39Z), **`latestApplied: 156_support_tickets`** (159 applied), contract 2.5.0; `origin/main` = `76595d8` after fetch — ⛔ **so the 16 commits O91 (a) asked to push ARE LIVE** (pushed outside this session). Local `main` **1 code commit ahead, NOT pushed:** `4e1e9b1` (D86 compliance — no migration) + this docs commit. Before: ⭐ **10-09 (38z), measured 05:16Z: `ce54f40` LIVE** (`/api/version`), migration 152, contract 2.5.0 — pushed on the owner's "push both". `d89269f` (sessions A′, migration 153) and `da31747` (contract 1.5.0 re-vendored, cache:false) are LOCAL. Before: ⭐ **10-09 (38x), measured 04:18Z: `4884af4` LIVE** (`/api/version`, `RAILWAY_GIT_COMMIT_SHA`; started 03:43Z), **`latestApplied: 152_byom_oauth`**, health 200, contract 2.5.0. `origin/main` = `4884af4` — nothing local is unpushed. D86 (bring-your-own-model) is deployed **OFF** (the operator's switch defaults off). Before: ⭐ **10-08 (38q), measured in the container: `c95e97c` LIVE, `latestMigration: 149_board_visit`** (148 `company_candidates` live too — 0 candidates until the first Monday HN sweep); 3,749 active; contract 2.5.0. Nothing local is unpushed. Before: ⭐ **10-08 (38o), measured 2026-10-08 03:39Z in the container (`railway ssh`, read-only): `5122f9b` LIVE** (`RAILWAY_GIT_COMMIT_SHA`), `latestMigration: 147_company_evidence`. `board_policy`: limit 120, **age_enforce 1, scope_enforce 1**. Crawler: **still paused, dry**, 0 tasks, last call *"lease → 423 paused"*. ⚠ `44d661a` (D81 chips on) is LOCAL, not pushed. Before: ⭐ **10-07 (38g, latest), measured: `7c631d8` LIVE** on draft (`latestApplied: 145_crawler_worker_seen`, health 200) **and on the crawler** (deploy `92c483d5` SUCCESS; log *"up — … browser true"* then *"paused by draft — idling"*, once). Production's `crawler_state`: **paused, dry**, `worker_last_seen` 56 s old, *"lease → 423 paused"*. ⚠ The container this deploy replaced ran `815cb73`, before the SIGTERM handling — the first real release-on-shutdown is the NEXT crawler redeploy. Before: ⭐ **10-07 (38g, late), measured: `1b8b99c` LIVE** (migration 144, health 200) — then ONE batch deploy (Railway `accept-deploy`, 23:07Z, both SUCCESS): draft with `CRAWLER_TOKEN`, `RAILWAY_WEBHOOK_TOKEN`, `PIPELINE_PAUSED_SOURCES=jobo`, and **`GROQ_API_KEY` + `GOOGLE_API_KEY` removed** (`GOOGLE_CLIENT_*` kept) · **the `crawler` service created and LIVE** (Root Directory `/crawler`, 2 vCPU / 2 GB, `CRAWLER_TOKEN`, `CRAWLER_DRAFT_URL`) — its log: *"up — draft https://jobsviadraft.com, dry-run false, browser true"*, then **423 (paused)**: it authenticated and idles until Admin → Crawler → Resume. Before: ⭐ **10-07 (38g), measured: `78633eb` LIVE** — `/api/version` started 21:47:06Z, `latestApplied: 143_deploy_events` (146 applied), contract 2.4.0; `/api/health` 200; local `main` = `origin/main` (`git rev-list origin/main..HEAD` = 0) before D77's commit. Pushed this session on the owner's go, each read after deploy: `49f898c`–`2a4897d` (D70 P0, A94, D71 measure) · `faffa4d` (D71, migration 141 — the Amazon row read Boston, MA · 143.7–194.4k on production) · `313fef9` · `493f10f` (D67 c) · `5210f15` (A95) · `4e7cc57` + `b40e2cf` (D72 P0) · `f4575b2` (D74 P0) · `25b7b95` (D74 classifier — 54 `general` rows re-filed at boot) · `9435d61` (D75 STEP 0, migration 142 — `/crawler` 200, the worker door 503 until `CRAWLER_TOKEN`) · `78633eb` (D76, migration 143 — the hook 401 without its header). Before: ⭐ **10-07 (38e), measured: still `ab984e3`** — `/api/version` started 06:06:30Z, `latestApplied: 140_apply_origin_pairs` (143), contract 2.3.0; `/api/health` 200. Local `main` **6 commits ahead, NOT pushed** (`git rev-list origin/main..HEAD`): the 38d docs `f257b12` · D60+D61 `db0c88e` · D62 `8f4b935` · D63 `bc69e41` · D67 (1) `cd41bef` · release v1.5.0 `43fbf90` — no migration. Before: ⭐ **10-07 (38d), measured: `ab984e3` LIVE** — pushed on the owner's go after the add-only check; `/api/version` started 06:06:30Z, `latestApplied: 140_apply_origin_pairs` (143 migrations), contract 2.3.0; `/api/health` 200. D65–D69 are in production; local `main` = origin + this docs commit only. Before: ⭐ **10-07 (38c), measured: `33cc276` LIVE** — pushed on the owner's "push it, keep the five sites"; `/api/version` started 05:06:15Z, contract 2.3.0, `latestApplied: 137_description_text`; `/api/health` 200. D59's answers and D64 are in production. Local `main` **5 code commits ahead + this docs commit, NOT pushed**: D65 `11ae171` (**138**) · D66 `6bf6d99` (**139**) · D67 (2) + D69 (c) `7187476` (**140**) · D69 (a)(b) `6d404fa` · D68 `74a1b14`. Before: ⭐ **10-07 (38b), measured: `ea32be3` LIVE** — pushed on the owner's "push it"; `/api/version` started 04:39:25Z, `latestApplied: 137_description_text` (140 migrations), contract **2.3.0**; `/api/health` 200. D59 is in production; its boot pass backfills `description_text` 2,000 rows a pass. Local `main` **3 code commits ahead + this docs commit, NOT pushed**: `b12cb7f` (D59 answers) · `d1211aa` + `c25c39d` (D64) — no migration. Before: ⭐ **10-07 (38), measured:** `/api/version` → **`3682fdc`** (started 01:46:54Z, `latestApplied: 136_form_reports`, 139 migrations, contract 2.2.1) = `origin/main` after fetch — ⛔ **so the six lanes (migrations 131, 135, 136) ARE LIVE; 37d's "not pushed" was wrong by the time it was read.** Local `main` **6 commits ahead, NOT pushed**: the 37d docs `e47d1dd` + D59 (`7981546` · `de8a127` · `403df38` · `bf2754f` · merge `6528ed7`, **migration 137**) — plus this docs commit. Before: ⭐ **10-07 (37c), from git:** `origin/main` = `20602f0` (live per 37b); local `main` **4 commits ahead, NOT pushed** — `445f35a` (docs 37b) · O80c `0dbca51` (packets carry a résumé) · the browser-pass fixes `e18e7dc` · this docs commit. No migration. Before: ⭐ **10-07 (37b), measured 19:13Z: `20602f0` LIVE** — pushed on the owner's "push it"; `/api/version` started 19:13:01Z, `latestApplied: 130_draft_bin` (136 migrations), contract 2.2.1; `/api/health` 200. Sessions 36 and 37 are live; local `main` = this docs commit only (unpushed, rides the next push — owner). Before: ⭐ **10-07 (37), measured 18:40Z:** `/api/version` → `fbbbd86` = `origin/main` (after fetch); local `main` **7 commits ahead, NOT pushed** — `dd2e500` (session 36) + this session's `86813b8` (docs) · D51 `b6c1d07` · D52 `d55b2e4` · D53 `a3e1275` (**migration 130**) · D54 `e860854`, + this docs commit. ⛔ Pushing applies `130_draft_bin` and starts the bin's purge sweep (every 6 h). Before: ⭐ **10-07 (36), measured:** `/api/version` → `fbbbd86` (started 17:25:14Z) = `origin/main`; local `main` **1 code commit ahead + this docs commit, NOT pushed** (`dd2e500` — no migration). Before: ⭐ **10-07 (35), measured:** `/api/version` → `c220a7f` (started 16:33:11Z, `latestApplied: 129_application_snapshots`, contract 2.2.1) = `origin/main` after fetch; local `main` **1 commit ahead, NOT pushed** (`29358ef`, D48 — no migration). Before: ⭐ **10-07 (34), from git:** `origin/main` = `c5f6cb6` (live per `/api/version` 10-06 15:50Z); local `main` **7 commits ahead, NOT pushed** (the owner's D45–D50 rows + D45, D46, D47, D49, D50). Before: ⭐ **10-06 (33): `365c244` LIVE** — `/api/version` (started 07:00:47Z, `latestApplied: 129_application_snapshots`), `/api/health` 200. Local `main` = `dcfbc14`, **3 code commits ahead (perf, A91, A92) + docs, NOT pushed**. Before: ⭐ **10-06 (32), read from git:** `origin/main` = `5103cf0` (session 30 docs); local `main` = **`b1d0460`, 8 commits ahead, NOT pushed** (A89·D44.1, D42, D41, D43, D40, D39, D38, D37) — ⛔ pushing deploys them, and with them migration 129 and a full re-tag (TAGGER_VERSION 2). ⚠ `/api/version` not read this session. Before: ⭐ **10-03 (23): `59a4ff2` LIVE** — `/api/version` (started 09:31Z; contract 1.5.0; 130 migrations, `latestApplied: 124_company_logos`), = `origin/main`, so session 22b is live. **`main` is 5 commits ahead, LOCAL** (D10 `93b0e7c` · D11 `4257a68` · D12 `a64f25c` · D13 `6531cf9` · D14 `b4ecf2f`) — ⛔ pushing deploys them (O55d). Before: ⭐ **10-03 (20b): `a12379c` PUSHED on the owner's go and LIVE** — `/api/version` 02:14Z, `/api/health` ok (F3 in draft's formatter, F2). Before: ⭐ **10-03 (19c): `c1deedc` PUSHED on the owner's go and LIVE** — `/api/version` 01:24Z, `/api/health` ok; the live bundle carries no PDF-tools code (0 matches). Before: ⭐ **10-03 (19): `cf051df` LIVE** — `/api/version` 00:20Z (session 18's six fixes + WORKLOG, contract 1.4.0, pushed by the owner). **`main` is 4 commits ahead, local** (A68–A70 rows, the F## rule, A69 ×2). Before: ⭐ **10-02 (18): `5282972` LIVE** — `/api/version` 20:52Z (started 19:50Z; contract 1.3.0; 128 applied, `latestApplied: 122_job_captures`). **`main` is 6 commits AHEAD of it, local** (session 18 — `git log origin/main..HEAD`); ⛔ pushing deploys them, and they carry contract **1.4.0** (additive). Before: ⭐ **10-02 (17d): `8c23c86` PUSHED on the owner's go and LIVE** (`/api/version` 19:14Z; A64). Before: **10-02 (17c): `7ba3d48` PUSHED on the owner's go and LIVE — `/api/version` 18:55Z (started 18:43Z, 128 applied, `latestApplied: 122_job_captures`), `/api/health` ok.** Before: **10-02 (17): `a509d6f` is LIVE — read from `/api/version` 18:23Z (started 17:15Z; 128 applied, `latestApplied: 122_job_captures`; `/api/health` ok; `/api/draft/slots`, `/api/apply/line`, `/api/applications/pending` → 401, `/api/admin/job-data/…` → 403, i.e. live and gated).** ⚠ **Not pushed by the agent:** `origin/main` moved to `a509d6f` during the session (A59, A63, A61, A62 + migrations 120–122) by someone else's push; the agent ran no push. `main` is now **8 commits ahead** of it (A52/A53/A50 follow-ups, the CORRECTIONS_REGISTER entry, this WORKLOG). Before that: **10-02 (16): pushed `main` with A49 + A50 + A52** — see NOW for the deployed commit as read from `/api/version`. Before that **`5b45130`** (`/api/version` 10-02 04:29Z start: contract 1.3.0, migration 115, 122 applied) — A51 and the session-15 docs WERE pushed (the 10-02 hand-off said they were not; `git ls-remote` and `/api/version` disagree with it). Older: `jobsviadraft.com` ONLY — **`fa77481` pushed 10-01 on the owner's go** (queues 37–40, migration 114): bundle `index-Qj9zxpNC.js` carries the deck layout control and Collapse, `GET /api/settings/deck-geometry` → 401 (route live), `/api/health` ok; ⚠ boot log not read (`railway logs` returned nothing). Before that **`a085d09`**, pushed 10-01 (queues 27–31); the live bundle verified ~60 s later to carry the new login copy, the signup hook, the fan and the card-back filter, `/api/health` → `{"ok":true}`. ⚠ Boot log not read this session. Before that: **`eaa2537`**, deployed 09-30 20:18Z on the owner's go (O7b), after the owner set `COOKIE_ENCRYPTION_KEY` (O20). Boot log, read by the agent: `[boot] secret key: configured` · `migrations complete (1 applied)` (110) · `registries: 148 role aliases, 28 qualification keys` · `[board-fit] … scored 2688, failed 0, 34.6 s, longest slice 59 ms`. Carries the OAuth sign-in fix (`041d4c2`), UI 2/2b, fit ranking, the copy sweep. ⚠ A completed Google sign-in is not yet observed (O25). `[oauth:linkedin]`/`[oauth:github]` still missing |
| Production (Resume Master) | ⭐ **10-09 (38z), measured: `4e89300` LIVE** (`resumemaster.one/v1/version`) — **contract 1.5.0** (`options.cache`, `options.jobContext`, `job.keywords`; the shape-hash fix; SDK retries capped at 1); `origin/main` = `4e89300`. Before: ⭐ **10-09 (38x), measured: still `574de80` LIVE** (`resumemaster.one/v1/version`; scorer 1.2.0); `origin/main` = `574de80`. Before: ⭐ **10-07 (38g), measured: `574de80` LIVE** (`resumemaster.one/v1/version`: commit `574de80c…`, scorer `@draft/ats-scorer@1.2.0`, `llmFormat: false`). Before: ⭐ **10-03 (20b): `6d58ea7` PUSHED on the owner's go and LIVE** — `/v1/version` 02:14Z. Live end to end on production: PDF → Word (valid .docx), PDF → Excel (valid .xlsx, 3 columns), OCR (42 words, 96 %, a searchable PDF), Compress → Maximum (2.6 MB → 22 KB, warned); no page error, no third-party request, zero request bodies; the OCR files served with the wasm type and the 2.9 MB data. Before: ⭐ **10-03 (19c): `28818eb` PUSHED on the owner's go and LIVE** — `/v1/version` 01:24Z; the first build with pdf.js + @cantoo/pdf-lib succeeded. Live: look C with the Sky Blue accent, `/pdf/` + ten tool pages, sitemap, robots, the libraries served as JavaScript; `/v1/site/config` → `accounts: true`. Every tool re-run END TO END on the live `/pdf/merge-pdf/` (zero request bodies); the live free PDF → text read a PDF anonymously with `usage: []`. Before: ⭐ **10-03 (19b): still `6415646`** (`/v1/version` 00:56Z); **`main` is 5 ahead, local: A70 `114bfcd` · A69 `5626a89` `ce2ecf8` · the toolkit made Resume Master's own `c212a04` · look C + the PDF pages `21c8520`** — ⚠ the first deploy with pdfjs-dist/@cantoo/pdf-lib; Docker not run here (watch the build). Before: ⭐ **10-02 (18): `6415646` LIVE (A65) — `/v1/version` 20:52Z; `/v1/site/config` → `accounts: true`** — the store is on, so user data can now exist there; `passwordReset: false` (no Resend yet, O47). Before: ⭐ **10-02 (17d): `908c275` PUSHED and LIVE** (re-vendored scorer, A64; `/v1/version` 908c275, site 200). Before: **10-02 (17c): `3e3539f` PUSHED on the owner's go and LIVE** (GitHub status success; `/v1/version` commit `3e3539f`; `/` serves the site 200 HTML; anonymous `/v1/site/tools/ats` scores; the token API's 401 carries the new sentence; `/v1/site/config` → `accounts: false` until `RM_DB_PATH` — O47). ⛔ The first push, `40614e4`, FAILED to deploy (Railway kept `661b758` serving): `better-sqlite3` 12.11.1 has linux prebuilts for Node 22+ only and `node:20-bookworm-slim` cannot compile; fixed by `node:22-bookworm-slim` (`3e3539f`). Before: ⚠ **10-02 (17): `main` = `40614e4` LOCAL, 3 commits ahead of `origin/main` `661b758`** (A57 accounts/credits/storage, A54 the site, A55 legible errors + limits policy) — re-read 18:23Z: production root still answers 404 and `/health` ok. ⛔ Pushing RM `main` deploys it (O47). Before: **LIVE at `https://resumemaster.one`** (since B step 4, 09-28 — verifier 21/21 ON THE DOMAIN; certificate **VALID**, `DETAILED_COMPLETE`, re-read 09-29; DNS Railway-managed and already repointed — see the correction in the step-4 session entry) and `https://resume-master-production-d960.up.railway.app`, commit **`814356d`**, service `resume-master` in draft's Railway project `resume-master` (owner's choice: kept there). Boot log: `model=true clients=["draft"]`. Certificate re-read by the agent 09-29 over TLS: Let's Encrypt, CN=resumemaster.one, valid to 12-27 |
| Resume Master repo | ⭐ **10-09 (38z): `main` = `4e89300` = `origin/main` — PUSHED and live.** Before: ⭐ **10-09 (38y): `main` = `4e89300`, 3 ahead of `origin/main` `574de80` — LOCAL, not pushed:** `f14df2d` (the contract hash sees a property named `description`) · `3489502` (D70 P3: `options.cache` declared + forwarded; SDK `maxRetries` 1) · `4e89300` (D70 P1: `options.jobContext` + `job.keywords`) — **contract 1.5.0, additive; 371 / 371 / 0.** ⛔ draft must NOT re-vendor 1.5.0 or send either option until it is live (1.4.0 would 400). Before: ⭐ **10-07 (38g): `main` = `574de80` = `origin/main`** (re-read; nothing local; not touched this session). Before: **10-02 (18): `main` = `6415646` = `origin/main`** (re-read; nothing local). 260 / 260 / 0 per 17e (not re-run). Before: **10-02 (17): `main` = `40614e4`, 3 ahead of `origin/main` `661b758`; 250 / 250 / 0** (A57 +11, A54 +4, A55 +1). Before: `github.com/Sri-Yellela/resume-master`, `main` = **`661b758`** = `origin/main` (checked 10-01) — G3 `6ec0dd3` and the G6 re-vendor are PUSHED, so deployed (auto-deploy on push; ⚠ the deploy itself not observed). **235** tests per queues 21–22 (not re-run). Before that `6e1837d` (E1, live 09-29 15:48Z, 232/232) |
| draft ↔ Resume Master | draft's `RESUME_MASTER_URL` → the Railway URL above; token set. ⭐ **First real generation, 09-28**: through the live service AND through draft's own client on draft's production env — both passed the claim guard; **first cache READ ever on generation** (7,009 read, 0 written) once two requests fell inside five minutes. ⚠ Not yet run through draft's HTTP route by a signed-in user (O2) |
| Resume Master contract | **v1.1.0** (E1, additive; live 09-29), generated; vendored in draft at 1.1.0 (`7b77bc5`). **Live verifier: 24/24 conform against the deployed service, including the three metered scenarios** |
| Test baseline (draft) | ⭐ **4639 / 4639 / 0** — measured 10-22 (43n) on the `67076e9` tree before its commit (+5 `t25CardRailSeam`; `jobBubbleD1` and `d25DraftHouseWorkspace` brought to the new reveal rule on purpose). Before: ⭐ **4634 / 4634 / 0** — measured 10-21 (43m) on the `db882f5` tree before its commit and push (+2 `pickerFields`, +2 `pageAnswerMemory`). Before: ⭐ **4630 / 4630 / 0** — measured 10-21 (43m) on `main` `b1444dc` (= `origin/main`), the full `npm test` before its push (+6 `pickerFields`). Before: ⭐ **4624 / 4624 / 0** — measured 10-17 (43l) on local `main` `df4d714` (Chrome closed). Before: ⭐ **4357 / 4357 / 0** — measured 10-14 (43c) on `main` `c1255a6` after the ingestion fixes. Before: ⭐ **4342 / 4342 / 0** — measured 10-14 (43) on local `main` `554fed8` after the D96–D98 extension run (+144; migrations 164–166). Before: ⭐ **4197 / 4197 / 0** — measured 10-13 (42h) after D95 Phase 2 (+1 `d95AdminAccounts`; migration 162). Before: **4196 / 4196 / 0** — measured 10-13 (42g) after the admin setup fix (+1 `d95AdminAccounts`). Before: **4195 / 4195 / 0** — measured 10-13 (42f) after the admin sign-in fix (+1 `d95AdminAccounts`). Before: **4194 / 4194 / 0** — measured 10-13 (42e) after the walk's fixes (+1 `workdayStages`). Before: **4193 / 4193 / 0** — measured 10-13 (42d) on the local tree after item 3 (+3 `d88TagsHidden`) and extension v1.5.2 (+11 `workdayStages`). Before: **4179 / 4179 / 0** — measured 10-12 (42b) on the local D95 Phase 1 tree (uncommitted; +14 `d95AdminAccounts`, from **4164** after `d86GrantTypes` +4 — one more than that arithmetic, not chased). Before: **4160 / 4160 / 0** — measured 10-12 (41) on local `a7f3700` after D94 (+8: `d94EmailHealth`); **4152 / 4152 / 0** on `7ebed68` after D92 + D93 (+16: d92SurfaceContinuity 6, d93Customise 10). Before: **4136 / 4136 / 0** — measured 10-11 (40) after D90 P3 (+4: `d90P3`), local. Before: **4132 / 4132 / 0** — measured 10-11 (40) on local `180e3b2` after D91 P0–P7 (+36: d91ThemeModule 8, d91Documents 3, d91ContrastThemes 8, d91ShapeCues 5, d91Appearance 9, d91Coverage 3), LOCAL, not pushed. Before: **4096 / 4096 / 0** — re-measured 10-10 (39k) on `7f4715d` before its push (D90 P2 added no tests to the count; P1's +10 stand). Before: **4096 / 4096 / 0** — measured 10-10 (39i) on local `main` `640fd6e` (+10: `d90ResumeChanges`). Before: **4086 / 4086 / 0** — measured 10-10 (39h) on local `main` `07e981f` (+5: `d86Cimd`). Before: **4081 / 4081 / 0** — measured 10-10 (39g) on local `main` `6643ac6` (+22: d86ConnectorCompliance +10, d86Byom +5, d86ConnectorDocs +4, d86ReviewerDemo +4, minus none; d88Resolver's pin widened). Before: **4059 / 4059 / 0** — measured 10-09 (39f) on local `main` `4e1e9b1` (+8: `d86ConnectorCompliance`); before that **4051 / 4051 / 0** at 39e (`1a0321c`). Before: **4043 / 4043 / 0** — measured 10-09 (39d) on local `main` `b5cc937` (+30 since 39b: v1.5.1's guard +2, A+ silent +1, the D83 map +5, the panel rules +8, D88 +9, the near-capsule family and others +5). Before: **4013 / 4013 / 0** — measured 10-09 (39b) on local `main` with the cost-visibility tree (+8: `costVisibility`). Before: **4005 / 4005 / 0** — measured 10-09 (39a) on local `main` `fc85cb3` (+10: D73 §B +8, the release-check fixes +2). Before: **3995 / 3995 / 0** — measured 10-09 (38z) on local `main` `da31747` (+6: sessions A′). Before: **3989 / 3989 / 0** — measured 10-09 (38y) on local `main` `fe96f67` (+14: D88 P1 +10, D70 P1 keywords +4); **a fresh CRLF clone read 3975 / 3975 / 0 at `4884af4`** (lane 2, 38x — the first fresh-clone count since 09). Before: **3975 / 3975 / 0** — measured 10-08 (38v) on local `main` after D86 Phase 1 (+21). Before: **3954 / 3954 / 0** — measured 10-08 (38u) on local `main` after D87 (+3). Before: **3951 / 3951 / 0** — measured 10-08 (38t) after D84 (+25). Before: **3926 / 3926 / 0** — measured 10-08 (38s) after D83's screenshot fixes (+1). Before: **3925 / 3925 / 0** — measured 10-08 (38r) on local `main` after D83 (`9b100c4`, +20). Before: ⭐ **3855 / 3855 / 0** — measured 10-08 (38o) on local `main` `44d661a` (session +36 since 3819: D75 1c +5, D78 A +7, D78 C −22+4, D78 B +11, D79 S0.2 +7, D78 ceiling/counters +1, D80 +7, D80 E +3, D81 +4, D76 fix +1, D75 0b +8). Before: ⭐ **3827 / 3827 / 0** — measured 10-07 (38g) on local `main` after D75 STEP 0b (+8). Before: **3819 / 3819 / 0** — measured 10-07 (38g) on local `main` with D77 staged (session +59: A94 +2, D71 +10, A95 +3, D72 P0 +4, D74 +4, D75 +15, D76 +7, D77 +6, D70/D72 scripts 0; plus the A93 manifest wording fix). The D75 browser-stage test SKIPS, with its reason, where no Chrome exists. Before: ⭐ **3760 / 3760 / 0** — measured 10-07 (38e) on local `main` `43fbf90` (+23: D60 +5, D61 +5, D62 +5, D63 +7, D67 (1) +1); ✅ **the two zip checks are GREEN** — cleared by the v1.5.0 bump + zip, no assertion edited; the client builds. Before that **3737 / 3735 / 2** — measured 10-07 (38c) on local `main` `74a1b14` (+31: D65 +10, D66 +8, D67 +8, D69 +4, D68 +1; the 2 = the expected zip checks); the client builds. Before that **3706 / 3704 / 2** — measured 10-07 (38b) on local `main` `c25c39d` (+21: D59 answers +1, D64 +20; the 2 = the expected zip checks); the client builds. Before that **3685 / 3683 / 2** — measured 10-07 (38) on local `main` `6528ed7` (D59 merged; the 2 = the two expected extension zip checks, which clear at the release's version bump + zip rebuild); the client builds. Before that **3664 / 3662 / 2** on `3682fdc` (37d, the six lanes). Before that **3495 / 3495 / 0** — measured 10-07 (37c) on local `main` `e18e7dc` (+4: O80c); the client builds. Before that **3491 / 3491 / 0** — measured 10-07 (37) on local `main` `e860854` (+33: D51 +11, D52 +5, D53 +9, D54 +8); the client builds. Before that **3458 / 3458 / 0** — measured 10-07 (36) on local `main` `dd2e500` (+2: the logo Draft button, the unheaded Workstyle cell); the client builds. Before that **3456 / 3456 / 0** — measured 10-07 (35) on local `main` (the D48 tree, committed as `29358ef`) (+9: `d48PostingHeader`); the client builds. Before that **3447 / 3447 / 0** — measured 10-07 (34) on local `main` `cca6c37` (+13: D45 +4, D46 +2, D47 +2, D49 +2, D50 +3); the client builds. Before that **3434 / 3434 / 0** — measured 10-06 (33) on local `main` `dcfbc14` (+8: perf +4, A91 +3, A92 +1); the client builds. Before that **3426 / 3426 / 0** — measured 10-06 (32) on local `main` `b1d0460` (+40 since 3386: A89/D44.1 +1, D42 +8, D41 +10, D43 +4, D40 +6, D39 +5, D38 +3, D37 +3); the client builds. Before that **3168 / 3168 / 0** — measured 10-03 (23) on `main` `b4ecf2f` (+27: D10 5, D11 4, D12 5, D13 8, D14 5). Before that **3141** on `03b086f` (22b). Before that **3088 / 3088 / 0** — measured 10-03 (19b) on `main` `204a4fe`, after the PDF tools LEFT draft (owner: independent product; −17). Resume Master **292 / 292 / 0** on `21c8520`. Before that **3105 / 3105 / 0** — measured 10-03 (19) on `main` `46597d8` (+15 `packages/pdf-toolkit`, +2 `pdfToolkitA69`). Resume Master **285 / 285 / 0** on `5626a89` (+8 A70, +2 A69, +15 vendored toolkit). Before that **3088 / 3088 / 0** — measured 10-02 (18) on `main` `cb7001d` (−2 tests that pinned only the deleted crawl, +3 `savedOutsideUs` +1, +3 `testSinkIsolation`, +1 A50 deploy card, +1 A33). ⚠ `npm test` now preloads `test-support/isolateTrackingSink.mjs`; a bare `node --test` fails `testSinkIsolation` on purpose. Before that **3081 / 3081 / 0** — measured 10-02 (17e) on `main` `f487302`. Before that **3080 / 3080 / 0** — measured 10-02 (17d) on `main` `8c23c86` (+3 A64). Before that **3077 / 3077 / 0** — measured 10-02 (17b) on `main` `2cfe71c` (+1 P1, +4 A33). Before that **3072 / 3072 / 0** — measured 10-02 (17) on `main` `6a61fc5` (+16 A59, +12 A63 +1, +2 A61, +6 A62, +3 A52 follow-ups, +4 +1 A50 company list / tools service, +2 A50 trace; one red commit `552e45b` fixed in `6a61fc5`). Before that **3025 / 3025 / 0** — measured 10-02 (16b) on `main` after merging A58 (+18) and A53 (+20). Before that **2987 / 2987 / 0** — measured 10-02 (16) on `main` after merging A49 (+30), A50 (+11), A52 (+10) and fixing the two known flakes at their cause (`a96ae88`: `sealedSessionSweep` awaited sqlite's async close; `accountSecurity` matches `"user":42`, not a bare 42). Before that **2936 / 2936 / 0** — measured 10-02 after A51 (+7 `adminSafety`). Before that **2929 / 2929 / 0** — measured 10-02 on `main` after A40 + the A44 merge (A44's branch alone 2922 on a fresh CRLF worktree). Before that **2913 / 2913 / 0** — measured 10-01 after audit item 7 (+1 net: the promises test became two). ⚠ `sealedSessionSweep` can hit a Windows EPERM in its temp-dir cleanup (6/6 alone). Before that **2912 / 2912 / 0** on `main` after merging queues 37–40 (`1046be9`; +26 deck 38–40, +10 `usOnlyBoard`). queue-37 alone read 2886/2886/0 on a fresh CRLF worktree. ⚠ `accountSecurity` "a session is SEALED at rest" is flaky ~1.7% (random ciphertext can contain "42"; fix: match `"user":42`) — not fixed. Before that 2876 after the top bar + /features (+5 featuresPageHonest). 2871 after A31 (+7 landingFindFitApply). 2864 after A30 (+7 signupFirstImpression). 2857 after queues 27–29 (+15 deckFan, +9 viewTransitions). 2833 after the mark reached the text-wordmark surfaces. 2831 after A24 (+10 R1). 2821 after A23 (+10 K1). 2811 after A22 (+6 G6). 2805 after A21 (+3 G3). Before that 2802, account management, run alone. Before that 2785 at `2e30cf8`, 2777 at `84e93be`. ⚠ Not yet re-measured on a fresh CRLF worktree |
| Migration high-water | ⭐ **10-14 (43): 166 in source** (`164_saved_answer_lifecycle` J8, `165_extension_resume_generations` + `166_resume_pdf_artifacts` J3 — all additive, both runners byte-identical; 167 reserved for J3, unused). **166 in production** (measured 10-14 (43b): `/api/version` commit `d608bd2`, started 06:35:15Z, `latestApplied: 166_resume_pdf_artifacts`; boot log `[migrate] ✓ 164 / 165 / 166`, "3 applied"). Before: ⭐ **10-12 (41): 158 in source** (`158_email_events`, D94 — additive: `email_events`, `email_domain_status`), **157 in production** until `a7f3700` is pushed. Before: ⭐ **10-10 (39l): 157 in source AND production** (`/api/version` `latestApplied: 157_base_resume_uploads`). Before: ⭐ **10-10 (39i): 157 in source** (`157_base_resume_uploads`, D90 P1 — additive: one table, one column, a backfill of the current bases), **156 in production** until the push. Before: ⭐ **10-09 (39f): 156 in source AND production** (`/api/version` `latestApplied: 156_support_tickets`); 39f adds none. Before: ⭐ **10-09 (39a): 154 in source** (`154_email_consent`, D73 §B; `153_auth_context_auth_at`, sessions A′), **152 in production** until the push. Before: ⭐ **10-09 (38z): 153 in source** (`153_auth_context_auth_at`, sessions A′), **152 in production** until the push. Before: ⭐ **10-09 (38x): 152 in source AND production** (`/api/version` `latestApplied: 152_byom_oauth`). Before: ⭐ **10-08 (38v): 152 in source** (`152_byom_oauth`, D86), **151 in production** (`/api/version` read 10-08: `1ac17de` LIVE, `latestApplied: 151_enrichment_provenance`) until the push. Before: ⭐ **10-08 (38t): 151 in source** (`150_description_full` · `151_enrichment_provenance`, D84), **149 in production** until the push — read `/api/version` after it. Before: ⭐ **10-08 (38o): 147 in source AND production** (`147_company_evidence`, D80; `146_board_policy`, D78; `145_crawler_worker_seen`, D75 1c). Before: ⭐ **10-07 (38g, later): 144 in source (`144_crawler_controls`, D75 STEP 0b), 143 in production** until the push. Before: ⭐ **10-07 (38g): 143 in source AND production** (`latestApplied: 143_deploy_events`) — this session added `141_pay_from_text` (D71) · `142_crawler_worker` (D75) · `143_deploy_events` (D76); D77 adds none. Before: ⭐ **10-07 (38e): 140 in source AND production** (`/api/version` `latestApplied: 140_apply_origin_pairs`); 38e adds none. Before: ⭐ **10-07 (38c): 140 in source, 137 in production** — `138_resume_parse` (D65) · `139_base_resume_only` (D66) · `140_apply_origin_pairs` (D67), each byte-identical in both runners and applied on a fresh in-memory schema by the tests; production applies them on the push. Before: ⭐ **10-07 (38b): 137 in source AND production** (`/api/version` `latestApplied: 137_description_text`). D64 adds none. Before: ⭐ **10-07 (38): 137 in source, 136 in production** — `137_description_text` (D59, merged `6528ed7`; both runners byte-identical, applied at boot on a throwaway copy); production `latestApplied: 136_form_reports` (`/api/version`). Production applies 137 on the push, and the boot pass then backfills `description_text` 2,000 rows a pass. Before: ⭐ **130 in source AND production** (`/api/version` 10-07 (37b), `latestApplied: 130_draft_bin`). Before: **130 in source, 129 in production** — `130_draft_bin` (D53, 10-07 (37): `apply_run_jobs.purge_after`, `purged_at`), both runners byte-identical; applied at boot on the throwaway server's copy of the local DB. Production applies it on the push. Before: ⭐ **129 in source AND production** — production `latestApplied: 129_application_snapshots` (`/api/version` 10-07 (35)). Before: **129** in source (`129_application_snapshots`, D43, 10-06 (32) — `job_applications` pay, `apply_run_jobs` posting snapshot), both runners byte-identical; ⚠ production not read (it applies on the push). Before: **122** in source AND production (`120_apply_run_line` A59 · `121_application_records` A63 · `122_job_captures` A62 — production `latestApplied: 122_job_captures`, `/api/version` 10-02 18:23Z). Before that **119** in source (`119_admin_audit_log`, A58, 16b; ⚠ production applies it on this push — read `/api/version`). Before that **118** in source (`116_dedup_retire_and_log` A49 · `118_ats_reports_job_hash` A52 · **117 unused**; 119 is on A58's unmerged branch). ⚠ Production: see NOW (`/api/version`). ⚠ 118 makes every stored ATS report stale once, so the first pass after deploy rescores each active profile (~95–135 s each locally); until then stored scores show "Check match" or no badge. Before that: **115** (`115_deactivate_skroutz_outside_us`, A44) — ✅ **production APPLIED, read 10-02 02:59Z from `/api/version`** (`latestApplied`, 122 migrations, commit `4c5ee54`, contract 1.3.0). ⭐ `/api/version` answers what the boot log was needed for — read it first |
| Contract | ⭐ **10-07 (38g): mobile 2.4.0 in source AND production** (D71: `salaryPeriod`, `salarySource`, `payLocations`, `descriptionMissing`, additive). Before: ⭐ **10-07 (38b): mobile 2.3.0 in source AND production** (`/api/version`). Before: ⭐ **10-07 (38): mobile 2.3.0 in source** (D59: `Job.requirements`, `Job.postingFields`, additive), **2.2.1 in production** (`/api/version`). Before: ⭐ mobile **2.2.1 in source AND production** (`/api/version` `contract: 2.2.1`, 10-07 (35)). Before: mobile **2.2.1** in source (10-07, D50 — annotation only: the ATS-score notes read "SHOWN ON THE WEB, PROVISIONAL"). Before: mobile **1.4.0** in source (10-02, 18: `Job.heldOutsideUs`, additive), **1.3.0** in production until pushed. Before: mobile **1.3.0** in source (A40, additive), **1.2.0** in production and in draft-android until pushed / re-vendored · Resume Master 1.1.0 (above) |
| Extension | ⭐ **10-21 (43m): v1.5.2 REBUILT again, no bump — NOT uploaded** (`extension/submission/resume-master-extension-v1.5.2.zip`, 444,316 bytes, `npm run build:extension`, committed in `db882f5`): carries all three 43m fixes. Before: 441,624 bytes in `b1444dc`. Before: ⭐ **10-14 (43): v1.5.2 REBUILT locally — NOT uploaded** (`extension/submission/resume-master-extension-v1.5.2.zip`, 273,932 bytes, `npm run build:extension`, `--check` passes; no version bump, owner 10-13). Carries D96–D98: progress, the panel, answer memory, automatic reading (Workday optional hosts), the résumé panel. ⛔ The listing's fields must be re-pasted at the upload (STORE_LISTING's 10-14 banner). Before: ⭐ **10-07 (38e): v1.5.0 BUILT locally — NOT uploaded** (`extension/submission/resume-master-extension-v1.5.0.zip`, 193,587 bytes, `npm run build:extension`; v1.4.1's never-uploaded zip removed). Carries D55–D58, D63, D64, D67, D68 since v1.4.1. **`STORE_LISTING.md` written fresh for v1.5.0** (single purpose, optional host permissions, seven-value storage, the Privacy practices answers, Limited Use). Published: v1.0.0 only (unlisted); v1.1.1 uploaded for review 09-28 (owner-reported). ⏸ Upload is the owner's (O85). Before: **10-03 (23): v1.2.0 BUILT locally (D13, the companion popup) — NOT uploaded** (`extension/submission/resume-master-extension-v1.2.0.zip`; v1.1.1's zip removed, the `e9e0535` precedent) — O55c. No new permission, host or storage key. Before: **v1.1.1 reuploaded by the owner, 09-28** (built at `e9e0535`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| draft volume | ⭐ **10-08 (38o): `draft-data` 5 GB — statfs 4,469 MB usable, 3,913 MB free (12.4% used)**; DB 103 MB; 6 backups, 419 MB. Before: ⭐ **10-07 (38g): `draft-data` is 1,000 MB** (`railway volume list`), statfs 879 MB usable, **463 MB free (47% used)** (D74 P0's read); the app's backups are daily `resume_master_*_auto-daily.db` at 45–55 MB in `/backups` (`railway volume files --volume draft-data list /backups`), newest 2026-10-07 02:00Z. ⚠ D77's *"Free volumes are capped at 0.5 GB"* does not describe this volume. Before: ✅ **10-02 (17d): renamed `draft-data`** (owner-reported; Resume Master has its own, `resume-master-data`). Was `resume-master-volume` (draft's DB, `/app/data`) — **481 / 1,000 MB** after the owner grew it 09-29. It was 481/500 and the 09-29 02:00 backup failed with ENOSPC. ⚠ The backup policy still allows ~640 MB steady; policy fixed in `d8af703` (budget from the volume, refuse before the copy) — **deployed** (on `origin/main`, checked 10-01); pruning done 09-30 (O9) |
| ATS ρ | ⚠ **0.723 over the US-only graded postings (n=24, A37, local)** — 0.746 was over n=30 incl. 6 non-US/unparseable. Was: **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — VERIFIED 09-28** by real generation, A+ and PDF calls (Resume Master references draft's `ANTHROPIC_KEY`, owner's choice) |
| ⛔ Fabrication | **2 of 2 real generations contained material the candidate never stated** (a JD skill; two invented responsibility bullets and an unsourced skill). The claim guard enforces years and seniority only. Resume Master's `docs/API.md` now says so. ✅ **AF5 is UNBLOCKED** (owner 09-30 — supervision, every document read before it is sent, is the control) **but ⏸ HELD** (owner 10-01) until résumé generation and ATS scoring are each tested individually — and the ATS test waits on A48 ("not enough signal" 0.1% → 20.5%). G1 itself (A2) is deferred, not fixed |
| Users | ⭐ **10-08 (38o): 12 user accounts** (production read). Before: ⭐ **10-07 (38g), production (D72 P0's read): 10 user accounts, 11 job profiles** — the "none" below is stale. ⚠ All 10 read `requires_sponsorship = 0` with no `sponsorship_need` answer and `has_clearance = 0` — defaults, not answers (D72). Before: **none** |
| draft volume backups | ⭐ **10-08 (38o): pruned on the owner's word** — 7 removed (10-01…10-06 dailies, 09-09, 08-22; 271 MB freed); now 6: the 10-07 and 10-08 dailies + the four D78/D80 rollback points (`pre-d78-scope-tranche`, `pre-d78-age-enforce`, `pre-d78-tranche2`, `pre-d80-tranche`), 419 MB. Before: ✅ **Pruned 09-30 on the owner's approval: 4 backups, volume 124 / 879 MB** (was 392). ⛔ The retention bug that made the 09-17..09-29 hole is fixed in `81a5483` — **deployed** (on `origin/main`, checked 10-01; O7c is closed by the later pushes) |
| Android (draft-android) | **10-02 (18): `main` = `c8aaea4`, 17 commits ahead of origin** (+1: a refused swipe takes its badge down); JVM **58 / 58 / 0** run fresh (JAVA_HOME = Android Studio's jbr). ⏸ The owner pushes it. Before: `main` = **`d2f0e3a`**, **16 commits ahead of origin** (re-read 10-02; `14b18d4` is an ancestor — the row had not followed A17/A19). Was: `main` = `14b18d4`, local. **58/58 JVM, 15/15 instrumented** on `rm_api36` (09-30). Today's draft on the shared deal; right = server Draft. Contract 1.2.0 vendored |
| `job_applications` | ⛔ **CORRECTED 10-06 (32) per D43: NOT empty** — O43's production read (10-06 (31)) found at least **4** rows, all orphaned from their postings. Whose they are and when they were written is NOT read (production reads were refused this session) — if they are early test applications they are not validation. ⭐ The proof that recording works is now a DELTA (O73): count before → one real application → count + 1, and the new row's `ats_score_at_apply` non-null. Was: **empty** — nothing has ever validated the product against an employer |
| Board | ⭐ **PRODUCTION 10-08 (38o), measured 2026-10-08 03:39Z in the container (`railway ssh`, read-only): 3,749 active of 5,970** — greenhouse 2,417 · ashby 1,028 · lever 281 · workable 21 · import 2 · **205 active companies (216 listed), 0 without evidence** · **every active posting is computer science, US-admitted and ≤ 120 days** (1 active row past 120 d, retired at the next sweep) · `rejected_jobs`: out_of_scope 5,936 · aged_out 648 · too_old 4,310. **The arc tonight: 1,942 → 997 (CS sweep) → 2,431 (+25) → 2,020 (≤120 d) → 3,482 (+100) → 3,775 (+62 HN) → 3,749 (03:30 sweep).** Before: ⭐ **PRODUCTION 10-07 (38g), measured (D74 P0):** **1,942 active of 2,771** (829 inactive: 702 held by the US gate, 409 stale-prunes since 09-24, 0 deleted) · **20 active companies** (29 listed); OpenAI 481 · Anthropic 358 · Stripe 311 = 59% · ~30 genuinely new postings a day, one crawl at 08:00 UTC · **pay on 78.1%** after D71 (260 rows gained) · the D74 classifier fix live (`25b7b95`): drops rescued from the next crawl, 54 `general` rows re-filed. Before: ⭐ **PRODUCTION 10-06 (31), measured in the container:** 1,917 active → retire pass removed 59 (3.1%) → **1,858 active, all US-admitted**; 98.0% enriched; entry+intern **3.4%** (63); direct-ATS sources only (greenhouse 1,142 · ashby 650 · lever 65 · workable 1). ⚠ **Local, A37: 2,616 active → 1,866 US (71.3%); 750 held out** (710 non-US · 12 unqualified "Remote" · 28 unparseable). NOT majority non-US locally — only lever is (69/130). Production not measured; the gate is local, and the retire script has not been run there. Local entry+intern over the US board **1.7%** (31/1866). Was: ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

## SESSION LOG — 2026-10-13 (42k) and older

### 2026-10-13 (42k) · ✅ DECIDED — "R19749-1 is the same job, keep it"

The owner's answer to 42c / 42d (a): a Workday repost suffix (`-1`, `-2`) is the SAME job. The key stays `workday|tenant|site|requisition` with the suffix kept as `rev`; no behaviour changed — the comment in `services/jobPageKey.js` now records the decision instead of a recommendation awaiting one.

### 2026-10-13 (42j) · the owner's URLs — the Workday stage (twice) and the LinkedIn search page it came from

**What they answered:** there is NO separate sign-in / create-account address — Workday showed sign-in on the same `/apply/applyManually?source=linkedin` URL (the step changes, the URL does not), which the key and the tab binding already cover; no fixture URL was invented. **What they added:** the job was found on LinkedIn (`/jobs/search-results/?currentJobId=4478302778`) — a capture there stores the job under LinkedIn's address, which shares neither address nor key with the Workday page, so Workday still said "capture it first", and a second capture on Workday would fingerprint-miss on the location wording and make a SECOND job. **Built (the addendum's "the key or (company, title)", whose second half was missing):** `ownJobByTitleCompany` (services/jobPageKey.js) — the job THIS user captured in the last 60 days whose title is the page's title slug and whose company is the tenant, only when exactly ONE matches; never another user's, never the shared pool. `resolvePageJob` uses it after the key (`how: title_company`), and a Workday capture with an unknown key JOINS that job (key recorded), so Prepare then fills on Workday through the user's own capture there. `test/workdayStages.test.js` +1 with the owner's exact URLs (resolution, another user refused, Prepare offered, the capture joins, fills; two candidates → no guess); 3 injections, all red. Suite **4198 / 4198 / 0**. ⏸ Still the owner's: R19749-1 = R19749 (treated so).

### 2026-10-13 (42i) · "delete the suspended admin row"

✅ **LIVE — measured:** `/api/version` commit `a9537c0`, `latestApplied: 163_delete_former_admin_row`; Railway logs 17:55:26Z `[migrate] backup taken before 163_delete_former_admin_row`, 17:55:28Z `[migrate] ✓ 163_delete_former_admin_row`.

Migration **`163_delete_former_admin_row`** (both runners): deletes ONLY a row 162 retired (suspended with the "Former admin row (D95)" reason). Measured on a copy of the `pre-162` backup (17:31:40Z) with 162 applied: the row held 21 notifications, 2 tokens, 1 session, the revoked Claude connection and 3 plugin-call rows (all go by the existing cascades) and ONE blocking reference — a plan request it decided (`plan_upgrade_requests.decided_by`, a foreign key with no cascade), now NULL with `decided_by_actor` still `user:1`. History rows that name it (4 audit rows, an override's `set_by`, a crawler setting's `updated_by`) are not constraints and stay. An audit row `user.delete` (actor system) records it. On that copy: users 13 → 12, nothing left behind, `foreign_key_check` empty, integrity ok, the owner's personal account and the admin account untouched. `server.js`'s backup-first rule now covers every pending data migration (162, 163): one backup, and all held back if it cannot be taken. `test/d95AdminAccounts.test.js` extended (only that row goes — another suspended account stays — the reference cleared, its own rows gone, FK clean, audited). Suite **4197 / 4197 / 0**.

### 2026-10-13 (42h) · D95 PHASE 2 — "password set and signed in with the admin email, now enforce"

✅ **LIVE — measured:** `/api/version` commit `ba465d4`, `latestApplied: 162_no_admin_in_users`; Railway logs 17:31:42Z `[migrate] backup taken before 162_no_admin_in_users`, 17:31:44Z `[migrate] ✓ 162_no_admin_in_users`; `/api/admin/auth/me` → `{ enforced: true, legacyAvailable: false, accountsExist: true }`.

The owner proved the new path (an admin account, its password set in the console, signed in with its email). **Enforced:**
- **`adminEnforced()` is ON by default** (`services/adminGuard.js`) — enforcement ships with the deploy; no Railway variable was touched. `ADMIN_ACCOUNTS_ENFORCE=0` is the rollback. Admin routes now read ONLY an admin session; the "Old admin sign-in" disappears from `/admin/login`; the legacy row cannot reach the console or a user route.
- **Migration `162_no_admin_in_users`:** the former admin row's connected apps and their tokens, and its tab / extension / phone tokens, are revoked FIRST (cleared first, the Claude connection on row 1 would have started working as a person's); the row is **suspended** with its reason (kept until it is deleted after a backup — it owns no user data, WORKLOG 42); an audit row `user.admin_flag_cleared` per row (actor system); `is_admin` cleared; triggers **`users_no_admin_insert` / `users_no_admin_update`** make the database refuse an admin flag on any users row.
- **Backup first:** at boot, when 162 is pending and an admin row exists, `server.js` takes `createBackup("pre-162")` on the volume; if it cannot, 162 is HELD BACK that boot (logged; the shared runner gained a `hold` option) and the next boot tries again. The newest volume backup before this was 02:00Z — before the owner's admin account existed — so the pre-162 backup is the one that holds the account.
- **The legacy `ADMIN_USER` / `ADMIN_PASSWORD` ("admin" / "changeme") bootstrap is deleted.** A server with no admin account is set up with `ADMIN_OWNER_EMAIL`. ⚠ Old verification harnesses that signed in through it (`scripts/ah1SessionIdentity.mjs`, `aj1MobileBearer`, `d91ThemeShots`, `dx1` / `dx2`, `am3` / `am4`) need an admin account to run again — not changed in this pass.
- **On a scratch copy of the 10-13 02:00Z production backup:** 159–162 applied once (then 0, integrity ok); row 1 `is_admin 0, suspended`; its Claude connection revoked; its live tokens 0; row 3 (the owner's personal account) active with its extension token live; one audit row; an `UPDATE users SET is_admin = 1` refused by the trigger.
- **Tests:** `test/d95AdminAccounts.test.js` (+1 Phase 2: credentials revoked first, suspended, audited, the triggers refuse on insert and update, a person can still be made, the backup-first wiring, no changeme; default ON with "0" as the rollback). Fixtures that model a pre-162 admin row say so with `test-support/legacyAdminRows.js` (drops the two triggers in that in-memory DB only); three tests that split migration SQL on ";" now run each migration whole, as the runner does (a trigger body holds a ";"); the transaction guard skips a CREATE TRIGGER body and checks it for a real transaction statement instead. HANDOFF / ARCHITECTURE high-water 162. Suite **4197 / 4197 / 0**.
- **Rollback (owner's word only):** `ADMIN_ACCOUNTS_ENFORCE=0`, `DROP TRIGGER users_no_admin_insert; DROP TRIGGER users_no_admin_update;`, and `UPDATE users SET is_admin = 1, status = 'active' WHERE id = 1` — the audit row holds the before-state; or restore the `pre-162` backup.
- **⏸ Later (owner):** delete row 1 after a backup (it is suspended, owns nothing); O28 email.

### 2026-10-13 (42g) · "created the admin account, but it said link not sent … second time: Only an owner admin account can manage admin accounts … no mail"

**Measured (Railway logs, 16:46Z and 16:49Z):** `[email] not sent — no email provider configured (set RESEND_API_KEY). Subject: "Your draft admin sign-in link"` — **production has no `RESEND_API_KEY`, so draft sends NO email at all** (password resets included). That is the owner's open **O28**; the agent did not set the key (a secret). The sign-in page's "a link is on its way" is generic on purpose and hid it.
**Two defects fixed (the setup must not depend on email):**
- The bootstrap rule allowed the legacy admin only the FIRST add, so a link that never arrived could not even be sent again ("Only an owner admin account…"). Now, **until any enabled admin account has a password**, the legacy admin (switch off, already in the console) may list, add (the first is an owner), resend a link and **set an account's FIRST password** in Admin → System → Admins ("Set the password…" — the person types it; nothing is displayed; audited `admin.password_set_bootstrap` with the actor). Once ONE admin account has a password, the door shuts (the legacy admin gets 403 on every Admins route) — then links, or an owner, do the rest.
- "Email not set up" is now said plainly — the add / resend answers carry it, the panel shows a warning, and the sign-in page's link request answers 503 with it (a fact about the server, the same for every address — no enumeration).
**Seen in a real Chrome on a throwaway server:** old login → Admins → add → "Set the password…" → set → a fresh browser: the email form leads and signs in to `/admin` as the new account. `test/d95AdminAccounts.test.js` +1. Suite **4196 / 4196 / 0**.
**⏸ The owner:** after the deploy, sign in with the old login → Admin → System → Admins → **Set the password…** on your account → sign in with that email. And **O28: set `RESEND_API_KEY` (+ `EMAIL_FROM`) on Railway** — no reset, notice or link email can go out until then.

### 2026-10-13 (42f) · "trying to sign in and it's asking for an @ in the email while the admin was never an email, what changed"

**What changed:** D95 Phase 1 made the MAIN form on `/admin/login` the new admin-account sign-in, which is by email — and no admin account existed yet, so that form could not work for anyone. The old `admin` login was intact, one button down ("Old admin sign-in (retiring)"), and the browser's `type="email"` check stopped the username before draft saw it. A defect in the page, not the account.
**Fixed:** `/api/admin/auth/me` says whether any admin account exists (`accountsExist`); with none, the page OPENS on the old login with the next step in words ("No admin account exists yet. Sign in with your current admin login, then add your admin account (its own email) in Admin → System → Admins."). In the new form, a username (no "@") is taken to the old login, filled in, with a plain note — no browser email check. Seen in a real Chrome on a throwaway server (dark): the old login leads on open and signs in to `/admin`; typing `admin` in the new form lands on the old login with `admin` filled. `test/d95AdminAccounts.test.js` +1. Suite **4195 / 4195 / 0**.

### 2026-10-13 (42e) · "pin the base image and redeploy and continue" — LIVE; the full extension walk run, and what it found

**The deploys.** `cbe5942` and `5532fd1` both FAILED at BUILD_IMAGE (`npm install`): the moving `node:20-bookworm-slim` tag had rolled to Node 20.20.2, which invalidated the cached install layer, and **better-sqlite3 12.11.1 ships no prebuilt binary for Node 20** (its Linux x64 prebuilds are ABI 127 / 137 / 141 / 147 = Node 22 / 24 / 25 / 26), so it compiled from source and node-gyp's download of Node's headers from nodejs.org got **502** (checksums on one build, the headers tarball on the other). **Fixed `c5bcdbd`:** `FROM node:22.23.2-bookworm-slim@sha256:48e4…` — Node 22 has the prebuilt binary (no compile, no nodejs.org on the build path), and the digest pins the image. ✅ **LIVE — measured `/api/version`: commit `c5bcdbd`, started 04:47:17Z, `latestApplied: 161_job_page_keys`**; `/api/health` 200; `/api/admin/auth/me` answers `{ authenticated: false, enforced: false, legacyAvailable: true }`. So **D95 Phase 1, item 3 and the v1.5.2 server half are in production**; the admin console still opens for the legacy row (switch off) and the new admin sign-in is ready for the owner.

**THE FULL EXTENSION WALK (42d's "not done") — `scripts/workdayStagesWalk.mjs`:** the real extension (test build) in headless Chrome, the real routes on the full schema, a synthetic user, and Chrome's resolver rule mapping **`zoom.wd5.myworkdayjobs.com` onto the fake ATS**, so every URL is the owner's own shape. **21 / 21 PASS** after three fixes it found: capture on `/apply/applyManually?source=linkedin` → stored as the posting, key recorded, tab bound · a second capture on `/apply/useMyLastApplication` → the same job, "Already captured" · Captured today = 1 · the popup's context on a stage → captured + bound · Fill → "Prepare this application" (never "capture it first") · **Prepare fills the stage's form** (first name, last name, email) · the step changes WITHOUT the URL changing → the Copy sheet opens in the page with the **prepared** answers (incl. the employer's saved answer), Esc closes it · the tab closes → the binding is gone.
- **Found 1 — a stage page was refused as "not one of this application's addresses":** the canonical posting URL forced `https`, so the user's own capture added an origin the page was not on. Now the page's own scheme (Workday is https, so production behaves as before; the rule is now right).
- **Found 2 — after a fill the Copy sheet fell back to "your profile":** the fill releases (consumes) the packet, and the sheet's fallback query (a) required an unconsumed packet and (b) referenced the `p` alias it never declared — the error was swallowed, so that fallback had never worked. Both fixed: the newest FRESH packet for the job, released or not (the sheet fills nothing).
- **Found 3 — the extractor took the role from `<title>`**, which on a stage reads "… — Apply": on a Workday host it now reads Workday's own job header (`data-automation-id="jobPostingHeader"`) when there is no JSON-LD title. The fixture now uses Workday's real ids (`jobPostingHeader`, `locations`, `jobPostingDescription`).
- Pinned in `test/workdayStages.test.js` (+1, and the binding test now checks the sheet after a fill). The v1.5.2 zip was rebuilt with the extractor change (201 319 bytes; v1.5.2 is not uploaded yet, so the version stands). Suite **4194 / 4194 / 0**.

### 2026-10-13 (42d) · "commit and push D95 Phase 1 and continue till end of pass to complete all tasks and push at the end" — D95 P1 pushed; follow-up item 3; extension v1.5.2 (Workday Phase 1)

**D95 Phase 1 — committed `cbe5942` and PUSHED** on the owner's word. ⚠ When measured later in this pass `/api/version` still answered `22fec07` (started 10-12 06:14Z) — the Railway deploy of `cbe5942` had not gone live; see the end of this entry.

**Follow-up item 3 — People → Users "N hidden" (built under "complete all tasks"; the tag question in 42 went unanswered, so the agent's recommendation stood).** Migration **`160_user_tags`** (`user_tags(user_id, tag, set_at, set_by_actor)`, cascade; tags `internal · test · beta`). Every account shows by default; a **"Hide internal and test accounts"** filter (OFF by default) hides those two and the list says **"N hidden"** beside it — counted within the current search; beta is never hidden; the numbers on top still count everyone. A person's page gains Tag / Untag buttons (a reason each, audited `user.tag.add / remove` with the coded actor). Merge drops the merged-away account's tags. `test/d88TagsHidden.test.js` (+3).

**EXTENSION v1.5.2 — Workday Phase 1, under "complete all tasks" with the agent's recommendations on 42c's three questions:** (1) **`R19749-1` is treated as the same job as `R19749`** — the repost suffix is kept as `rev`, not in the key (the owner may overrule); (2) **no sign-in / create-account URL was invented** — none was pasted, so those stages resolve through the tab binding; (3) Phase 1 as written.
- **ONE KEY (`services/jobPageKey.js`, migration `161_job_page_keys`).** `workday|tenant|site|requisition`; the owner's URL and the plain posting resolve to `workday|zoom|zoom|R19749` (rev 1, stage applyManually, locale en-US, location "Remote (US)", canonical posting URL with stage / query / locale stripped). A capture stores the page as its POSTING and records key → the board job it folded into, so every later stage resolves to that job — even though the board's Zoom copy came from another ATS (the owner's case). ⚠ The extension still parses no ATS URL: the canonical posting URL is derived on the SERVER from the URL the extension sends — the prompt asked the extension to send it; one parser is the codebase's rule (`applyOrigins.js`), so the agent kept it there.
- **The second defect 42c found is fixed:** `userHasJob` now reads `job_captures` — a captured job is the user's, so fill and prepare say "Prepare this application", not "capture it first" / "not on your board".
- **Packet addresses:** a Workday tenant joins a packet's origins ONLY through the user's OWN capture (`ownPageUrls`), and a page naming a different requisition on that tenant is refused (`pageMatchesPacket` → `other_job`). Nothing shared can widen where a packet fills.
- **THE TAB BINDING (`extension/tabBinding.js`):** `bind:{tabId}` in `chrome.storage.session` = { origin, jobId, title, company, via, boundAt, dock }; set by a capture and by a recognised posting (a different one replaces it); valid only on its origin; cleared on tab close and by "Unlink this page"; sent ONLY as `boundJobId`, a hint the server honours for the user's own job (`routes/apply.js boundJob`) — match, prepare, Copy sheet and "I submitted it" use it. ⛔ No new permission (manifest unchanged, pinned). ⚠ **It IS a new stored item, so the data story changed:** the privacy policy's storage list (now **eight** things; effective **October 13, 2026**), `STORE_LISTING.md` (**Eight values — re-paste the storage field**) and `PRIVACY_RECONCILIATION.md` were updated together, and the D23 / privacy tests moved with them.
- **The popup** shows "Captured ✓ — Software Engineer at Zoom" on a bound or captured job (any stage), with Unlink; the posting's button reads "Captured ✓"; a repeat capture answers "Already captured — … is on your board and in your imports." (idempotent, no new prompt). **The fill** says "Using Software Engineer at Zoom, captured 10:42." when the binding named the job.
- **THE COPY SHEET is an in-page panel (`extension/copy-sheet-panel.js`, shadow DOM):** stays through page clicks and field focus; Close, Esc, Minimise; dock left / right remembered with the binding; a Copy button per answer that says "Copied" (or selects the value where the page has no clipboard); says the job, the source and the unanswered count; eligibility rows keep "you are attesting to this"; never reads or writes a field; painted from the tokens (no colour literal). The popup's button opens it and closes itself. **The sheet now carries everything the packet does** — the saved answers for the employer (never an opt-in), the worked-here fact, work and education history — and uses the bound job's newest fresh packet where no packet fills the page (the "only 4 answers" cause).
- **"Captured today"** = `GET /api/import/today`: distinct jobs captured in 24 h by any route, shown as "Captured: N today · M already on your board" (asked on popup open — account-level, like the ring; the D23 pin moved with it). The automatic list is renamed "Captured automatically today".
- **One wording** after a capture that matched a board job: "<title> at <company> is on your board and in your imports."
- **Fixture:** the owner's Zoom paths in `scripts/fakeAts.js` (posting, /apply, /applyManually, /useMyLastApplication, en-US, ?source=linkedin; a Save-and-Continue that changes the step without changing the URL).
- **Release:** manifest + README **1.5.2**, zip rebuilt (`resume-master-extension-v1.5.2.zip`, 201 187 bytes; the v1.5.0 / v1.5.1 zips stay beside it), `buildExtension --check` passes, the `extensionSubmission` checks green.
- **Tests:** `test/workdayStages.test.js` (+11) — the owner's exact URL and every stage, the resolution, capture → yours, the binding (own job only; another user refused), the Copy sheet rows, capture idempotency + today = 1, the binding module, the manifest, the popup lines, and **the Copy sheet panel in a REAL Chrome on the Workday-shaped fixture, light and dark** (survives a field focus and a page click, the field keeps what was typed, Close, Esc, Minimise, dock, painted from each theme's tokens, max corner radius ≤ 10px — D60). **Every rule broken on purpose and seen red** (10 injections). Re-pointed: d23ExtensionLook (the eighth key; the open-time ask), privacyReconciliation / privacyO72Corrections (eight; the new date), d33CaptureSaysWhy + dedupRetiresUserState (the one wording), accountService (merge plan), authRouteGuardManifest (the route).
- ⚠ **Not done:** the FULL extension walk in Chrome (the extension loaded; capture → binding → fill across the stages) — the server flows run in node against the real routes and the panel runs in real Chrome, but the extension's own chrome.* path is exercised with stubs; 42c's screenshots were not taken.

**Migrations 159–161 applied to a scratch copy of the 10-13 02:00Z production backup:** each once, a second run 0, integrity ok. **Suite 4193 / 4193 / 0** (`npm test`); the client builds.

**⏸ THE OWNER:** (a) confirm or overrule "R19749-1 = R19749"; (b) paste the Workday sign-in / create-account URLs you saw, for the fixture; (c) upload v1.5.2 and **re-paste the storage field** (eight values) and the privacy practices; (d) D95 Phase 2 — prove the admin sign-in, then say *enforce* (Phase 2's migration is now **162**, not 160 — 160 and 161 were taken by this pass); (e) the deploy of `cbe5942` and this commit — see the final report.

### 2026-10-12 (42c) · EXTENSION — job identity across Workday stages, the Copy sheet, "Captured today": PHASE 0 (read-only, from the code) · ⏸ STOPPED FOR THE OWNER

Code read only (nothing changed); key claims spot-checked against the source. ⚠ **Not done in this pass:** the Workday-shaped fake-ATS fixture and the screenshots the prompt asks for — they need a code change and a browser run, so they open Phase 1.

**(a) ONE PAGE, SIX IDENTITIES — where they diverge.** The extension never normalises a URL (`pageUrlOf` = `tab.url`; a test forbids it parsing ATS URLs). The server matches the page by **stored URL** (`scraped_jobs.url / apply_url IN (href, origin+path, origin+path/)`, `routes/importJob.js:113`, `services/manualHandoff.js:74`), then a **family fallback** (`resolvePageJob` → `services/applyOrigins.js familyOf / jobIdOf`) that knows only Amazon, Greenhouse, Lever, Ashby and Workable — **no Workday**. **CAPTURE** dedupes by FINGERPRINT (company | title | location, `aggregator.js`): a capture from `/apply/applyManually` misses the URL, folds into the board's existing Zoom row (from another ATS), keeps THAT row's URL, and records the Workday URL only in `job_captures.url` — which **no read path consults**. So: CONTEXT (`/api/import/context`, URL only), FILL / the hotkey (`/api/apply/handoff/match`), PREPARE, SUBMITTED and COPY SHEET all miss on every Workday stage → `unknown` → *"draft doesn't know this job — capture it first"* (`manualHandoff.js:175`), while the capture says *"already on the board … now in your imports"* (`captureOutcome.js:74`). **A second defect even when the URL matches:** `userHasJob` (`manualHandoff.js:37`) needs `starred = 1 OR applied = 1` (or a résumé / record / packet) and ignores `job_captures`, but a capture now writes `starred = 0` → a captured job reads *"isn't on your board yet"*, and the popup's "Capture again" never shows. `lastCapture` (with its `jobId`) is read only by the popup's status line. `detectKnownAtsMatch` reads Workday's tenant and `wd5` but never the requisition (`R19749`).
**The owner's URL, parsed for the key:** tenant `zoom` · `wd5` · locale `en-US` · site `Zoom` · location `Remote--(US)` · title `Software-Engineer` · requisition `R19749` + `-1` · stage `/apply/applyManually` · `source=linkedin` → key `zoom|Zoom|R19749`, `rev 1`. `docs/D67C_WORKDAY_FAMILY.md` (design only) proposes the same key shape and says the wizard / login URLs were never observed — the login / createAccount stages carry no requisition, so they can only resolve through the tab binding, as the prompt says.

**(b) "CAPTURED TODAY"** (`popup-auto.js`, shown only with auto-capture on) counts `job_captures` rows with `origin = 'auto_capture'` in 24 h, one per job (`services/jobs/autoCapture.js:98`). A manual capture is `origin = 'capture'` → **0**; and auto-capture never runs on Workday (its origins are the four families). The ring is the Draft-slot cap, not captures. Two captures of one job should read **1**.

**(c) THE COPY SHEET** is markup in the action popup (`popup.html:150`, `popup.js:375`) — Chrome closes the popup when the page takes focus, and it has no close. Its rows are a fresh packet's answers, else a packet built from the profile; `copySheetRows` keeps only the non-empty of the 16 canonical gate fields (`applyGatePacket.js:53`) and drops entries / saved answers — so a thin profile gives ~4 rows (the exact 4 not checked). ⚠ The "review overlay" is light DOM (`review-overlay.js`), not shadow DOM; the only shadow-DOM overlay is the autofill badge (`autofill-badge.js:160`) — the in-page panel would be the first full shadow-DOM panel.

**(d)(e)(f)** No canonical key per ATS exists for Workday anywhere (`schema.js atsPostingIdentity`, `applyOrigins.js` — none). Manifest permissions: `activeTab, contextMenus, scripting, storage` (+ host `jobsviadraft.com`, 5 optional ATS origins); **`chrome.storage.session` is already used** (`gate:<tabId>` packets, `lastGatedHandoff`) — the tab binding needs no new permission. Workday fixtures exist only as localhost wizards (`/workday-replica`, `/workday`) and URL strings in tests — none with stage URLs.

**⏸ THE OWNER DECIDES before Phase 1:** **(1) is `R19749-1` the same job as `R19749` / `R19749-2`?** (the addendum's question — recommended: same job, `rev` kept, unless Zoom reuses the base id for a different role); (2) paste the login / create-account / later-stage URLs you saw (they are not invented); (3) go for Phase 1 as written (the key on the server, the tab binding, `userHasJob` reading captures, the shadow-DOM Copy sheet, "N today · M already on your board", v1.5.2).

### 2026-10-12 (42b) · D95 PHASE 1 BUILT, behind the switch (OFF) — admin accounts are their own kind · the D86/D88 follow-up items 1, 2, 4 · ⏸ STOPPED FOR THE OWNER

**Owner:** "approved, refuse on consent, go with Phase 1 … the admin account is not remotely close to a user account … this segregation has to clearly exist and [be] tokenised, which can be used to identify it, and everything else written accordingly. This is for the extension-related same bug" + the addendum (the extension popup said "Signed in as admin": every door that mints a token from a session refuses an admin) + "complete scheduled tasks and stop and report". **Local, uncommitted, nothing pushed.**

**THE TOKENISED IDENTITY (services/adminAccounts.js, services/actor.js).** An admin account's public id is `adm_<16>`, its session token `dft_adm_<43>` (the `draft_admin` cookie: HttpOnly · SameSite=Strict · **Path=/api/admin** · 8 h idle / 24 h absolute), its one-time sign-in link `dft_adml_<43>` (30 min, sets the password, kills every other link and session). Every admin-side write names a **coded actor** — `admin:adm_…` · `user:N` (the legacy row, until the switch) · `system` — in `admin_audit_log.actor_kind` / `actor` and in an `*_actor` column beside each older integer actor column (overrides, notes, tickets + messages, plan requests, limits, board policy, crawler state / tasks / deny-list, company candidates, slug-harvest sweeps / imports, job-import batches, the notice log). The integer columns keep a users.id or NULL — never an admin id (two are foreign keys to users; FKs are ON).

**THE DOOR (services/adminGuard.js).** A global binder after `bindAuthContext`: an admin credential sent as a header or in the query is refused everywhere (`admin_credential`); on `/api/admin/*` the cookie sets `req.admin` + `req.actor` and **removes any user identity from the request**. `requireAdmin` = an admin session; the legacy `is_admin` users row only while `ADMIN_ACCOUNTS_ENFORCE` is off (default OFF). `shared/authPolicy.js mayActAsAdmin` honours the same switch, so the three guards still share one predicate.

**EVERY TOKEN DOOR REFUSES AN ADMIN — now, flag or no flag** ("This is an administrator account. Use a personal account."): `GET /api/auth/extension-token` · `GET /api/auth/mobile-token` · `issueAuthContext` (no session-less token for an admin row, the backstop) · `bindAuthContext` no longer honours an extension / phone token already held by the admin row (so the owner's popup stops saying "Signed in as admin" — the server half; the popup shows signed-out until a personal sign-in) · **the consent screen refuses an admin session** with one way on, *Use a personal account* (→ `/oauth/switch-account`, back to the same screen) · `issueCode`, the authorization-code and refresh grants, and `verifyAccessToken` all refuse an admin row (so the existing Claude connection on row 1 stops working at deploy).

**THE ADMIN'S OWN SIGN-IN (routes/adminAuth.js, client AdminLoginPage).** `/api/admin/auth/me · login · link · set-password · break-glass · logout` — one generic failure for unknown / disabled / unset / wrong; a link request always answers the same. `/admin/login` posts there; the old sign-in stays below it, marked *retiring*, while the switch is off. `/admin/set-password?token=…` (the token leaves the address bar at once). **Break glass:** (i) `ADMIN_OWNER_EMAIL` — boot ensures that owner account exists (no password; ask for a link); (ii) `ADMIN_BREAK_GLASS_HASH` (a bcrypt hash of an offline passphrase) — owners only, audited `admin.break_glass`, every owner emailed. The last enabled owner cannot be disabled. The legacy `ADMIN_USER` / `changeme` bootstrap runs only while the switch is off.

**ADMIN → SYSTEM → ADMINS (panels/adminAdmins.jsx, owner only):** list (email, `adm_` id, owner, enabled, password set, last sign-in), add (sends the link; refuses an email any user account uses — two accounts, two emails), disable with a reason (ends its sessions), enable, resend a link. No password ever shown. **Bootstrap:** while NO admin account exists, the legacy admin may add the first one, and it is an owner — so the owner can prove the switch without touching Railway's variables.

**USERS NEVER SHOW AN ADMIN:** `listPeople` (rows, counts, search, the old `admins` filter removed), the person page and every People write answer *No such user* for an admin row; `GET /api/admin/users` excludes it; `POST /api/admin/users` has no admin flag (`is_admin` is the literal 0 — no route sets it); plan / password routes refuse an admin row; delete and merge already did. User sign-up refuses an admin account's email; under the switch the user sign-in and provider sign-in answer an admin row exactly like a wrong password.

**THE D86/D88 FOLLOW-UP:** **1** the consent screen REFUSES (owner's choice) ✅ · **2** Admin → System → Plugin lists each connected account by **email**, host, connected, last used, and marks an administrator row in red ✅ · **3 ⏸ not built** — the list already shows every account by default; there is no internal/test filter and no `user_tags` table yet, so nothing is hidden to count (the owner's call on building the tags, asked in 42) · **4** a connector token is refused on every `/api/admin` route — pinned live and by a walk of every mounted admin route ✅.

**MIGRATION `159_admin_accounts`** (both runners byte-identical; additive; `users` untouched). Applied to a scratch COPY of the 10-13 02:00Z production backup: applies once, a second run applies 0, integrity ok; backfill — 195 audit rows `system`, 2 `user:1`; the reviewer override `set_by_actor = user:1`.

**SEEN WORKING** on a throwaway server (temp data dir, synthetic owner `owner@example.org`, port 3195, stopped after by PID): link → set-password → the `draft_admin` cookie (Path `/api/admin`, `dft_adm_…`) → Today 200 · People lists no admin · Admins lists the owner · a reused link refused · the admin cookie on a user route 401 · the admin token as a Bearer 403 `admin_credential` · wrong / unknown admin password the same answer · the legacy admin: extension token 403, phone token 403, console 200 (switch off) · user sign-in with the admin email "Invalid credentials." · sign-out → 403.

**TESTS:** `test/d95AdminAccounts.test.js` (+14); **every rule broken on purpose and seen red** (8 injections: admins in People, the consent refusal, the extension-token refusal, the audit actor kind, the token verify refusal, the user identity stripped on admin paths, the switch in the guard, an admin flag on the user-create route — two were green at first, so the tests were tightened). Re-pointed (the old behaviour was reversed on the owner's word, so the pins follow it): adminStopHarmII (2), authRouteBootstrap (2), d67LearnedOrigins, d88People (the list now excludes the admin), fullAutoKillSwitch, adminDbInspector + d86ConnectorCompliance + the reviewer fixture (the 159 columns), HANDOFF / ARCHITECTURE high-water. Suite **4179 / 4179 / 0** (`npm test`, this tree); the client builds.

**⏸ THE OWNER — Phase 2 is yours to start:** (a) review and say *commit / push*; at deploy the Claude connection on row 1 stops working (correct) and the extension, if still holding the admin token, shows signed-out — sign it in with the personal account; (b) prove the new path: Admin → System → Admins → add your ADMIN email (one no user account uses) → the link → set the password → sign in at `/admin/login` (or set `ADMIN_OWNER_EMAIL` and ask for a link); (c) then say *enforce*: set `ADMIN_ACCOUNTS_ENFORCE=1`, migration 160 clears `is_admin` and adds the triggers, row 1 is deleted later after a backup; (d) optional: `ADMIN_BREAK_GLASS_HASH`; (e) item 3's tags, yes or no; (f) reconnect Claude from the personal account.

### 2026-10-12 (42) · D95 PHASE 0 (read-only) — admin accounts apart from user accounts · and the D86/D88 follow-up's findings — ⏸ STOPPED FOR THE OWNER

**Nothing was changed** except this entry. **Source:** the newest production backup, pulled with `node scripts/pullBackup.mjs` (`resume_master_2026-10-13T02-00-00-786Z_auto-daily.db`, integrity ok, last migration `158_email_events`, kept OUTSIDE the repository), opened READ-ONLY; the code at `22fec07`. Rows are named by number and role only — no address or name of a real person is written here (CLAUDE.md). ⚠ The D95 row and the follow-up have no section yet; the D sequence is the owner's and the assistant's to add.

**(a) THE ROWS — 13 in `users` (incl. the `system` row id 0).** **Exactly ONE has `is_admin = 1`: row 1, username `admin`** — created 04-06, plan PLUS, password sign-in only (no Google), **no profile, no email, no résumé, no draft, no application, no ticket.** It holds: **the one live Claude connection** (`oauth_connections` 1, host `claude`, made 10-12, last used 10-12; its two `draft_search_jobs` calls were REFUSED, which fits an account with no profile), `byom_enabled = 1`, 3 `mcp_audit` rows, 20 notifications (pipeline alerts — the only admin-addressed in-app channel), and the browser's only `user_sessions` row plus one live browser auth context (last seen 10-13 01:35Z). **The owner's PERSONAL data is on row 3** — not an admin; Google-linked; profile, base résumé, 5 résumés / 7 versions, 2 applications, 130 daily drafts, 6214 ATS reports, 14 apply runs, byom on; its only live credential is an EXTENSION token (no browser session at all; last seen 10-07). **No row is both.** The split is already clean in the data; what is mixed is the CREDENTIAL — see the follow-up below.

**(b) WHERE ADMIN IS DECIDED TODAY.**
- **One column, one predicate.** `users.is_admin`, read by `shared/authPolicy.js` `mayActAsAdmin(req)` = *not an extension request* AND `req.user.isAdmin`. The three `requireAdmin`s (`server.js:6057`, `routes/admin.js:17`, `routes/adminDb.js:70`) all use it; routers (`adminPeople`, `email`, `tickets`, `byom`, `crawler`, `companyKb`, `enrichment`, `jobData`, `companies`, `slugHarvest`, `jobTags`) take `server.js`'s by injection. ~85 `/api/admin/*` endpoints.
- ⚠ **A PHONE-APP token of an admin account passes `requireAdmin`** — `mayActAsAdmin` refuses only the extension's kind (`resume-master-mobile` tokens are not refused). No admin uses the phone today; the split removes the case entirely.
- **ONE sign-in for both kinds.** `AdminLoginPage.jsx` posts to the same `POST /api/auth/login` as users and checks `isAdmin` AFTER the server answered. ⚠ **A non-admin who signs in on the admin page IS signed in** — the server set the cookie and issued a token before the page said "admin access only".
- **Sessions A′ (migration 153) do not tell admin from user.** They tell CREDENTIAL kinds apart — browser cookie, per-tab browser auth context (with its own `auth_at`), session-less extension token, session-less phone token (`auth_contexts.user_agent`) — and a tab token overrides the cookie's user in `bindAuthContext`. Admin is only whatever `is_admin` says about the user the credential resolves to.
- **Who can SET the flag:** only `POST /api/admin/users` (`server.js:7743`, `isAdmin` in the body → `is_admin`), admin-only. No route updates it on an existing row. ⚠ **Boot creates `ADMIN_USER` with `ADMIN_PASSWORD` if that username is missing — defaults `admin` / `changeme`** (`server.js:248`, `5233`). Not triggered today (row 1 exists); not checked whether production sets either variable.
- **Admin-side columns that point at `users.id` (plain integers unless noted):** `admin_audit_log.admin_user_id` (195 rows NULL = system/boot, 2 rows = row 1: the reviewer seed and its override); `user_entitlement_overrides.set_by` / `revoked_by` (1 row, by row 1); `user_notes.author_id` (none); `tickets.assignee` (none; `services/tickets.js:155` requires `is_admin = 1`); `ticket_messages.author_id` (none; already has `author_type`); `plan_upgrade_requests.decided_by` **`REFERENCES users(id)`** (1 row, row 1) and `user_limits.updated_by` **`REFERENCES users(id)`** — ⛔ **foreign keys are ON**, so these two cannot hold an admin-account id; `board_policy.updated_by`, `crawler_state.updated_by`, `crawler_tasks.created_by`, `crawler_denylist.added_by`, `company_candidates.decided_by` (all NULL today). Admin notifications go to `users WHERE is_admin = 1` (`server.js:5449`).
- **Guards that already treat admins as special** (and become moot): delete (`adminUserDelete.js:55`, `accountService.js:216`), merge (`accountService.js:279`), suspend (`userAdmin.js:95`), the People filter `admins`, the plan column showing "admin".

**(c) WOULD SPLITTING LOSE USER DATA? No.** Row 1 owns no profile, résumé, draft, application or ticket. What goes with it: the Claude connection (re-made on a personal account), 3 audit rows of refused/connect calls, 20 regenerable alerts, one browser session.

**(d) PROPOSAL — ⏸ the owner approves or amends before Phase 1.**
1. **`admin_accounts`** — `id, email (UNIQUE, NOCASE), password_hash, password_set_at, created_at, created_by (admin id), disabled_at, disabled_reason, last_sign_in_at, is_owner`. No profile, no plan, nothing a user feature can read. Creating one REFUSES an email any user account uses (principle 5).
2. **Its own session, its own door.** `admin_sessions(token_hash, admin_id, created_at, expires_at, last_seen_at, auth_at, revoked_at, user_agent, ip_hint)`; cookie `draft_admin` — HttpOnly, Secure, **SameSite=Strict, Path=/api/admin** — so a user route, the consent screen and `/mcp` never even RECEIVE it. Sign-in at `POST /api/admin/auth/login` (email + password, its own rate limit, the same generic failure for every wrong case); `/admin/login` posts there and nowhere else. Shorter windows than users (proposed: 8 h idle, 24 h absolute). Not Passport, not `auth_contexts`: no tab token, extension token, phone token or connector token can ever be an admin credential, because the admin guard reads ONE cookie and nothing else.
3. **Refusals both ways.** `requireAdmin` (flag on) = a live `admin_sessions` row, full stop. User routes refuse a request that resolves to no `users` row (already true) — and since admins are not in `users`, a user session cannot be an admin and an admin session cannot be a user. The consent screen and `issueCode` refuse a `users` row with `is_admin = 1` during the transition ("This is an administrator account. Connectors use a personal account.").
4. **Audit carries the actor kind.** `admin_audit_log ADD actor_kind TEXT` (`admin | user | system`) + `actor_id`; backfill: NULL → `system`, row 1's two → `admin` mapped to the owner's new admin id (the mapping kept in the migration's note). New admin-actor columns (`decided_by_admin`, `updated_by_admin`, …) beside the two foreign-keyed ones rather than writing an admin id into a `users` reference. Admin alerts move to an admin-side list (Today), not `notifications`.
5. **Break glass, two independent paths.** (i) `ADMIN_OWNER_EMAIL` (env): boot ensures an enabled owner row for it exists (no password); `/admin/login` → "send me a sign-in link" emails a one-time set-password link (Resend). (ii) If mail is down: `ADMIN_BREAK_GLASS_HASH` (env, a scrypt hash of a long passphrase kept offline) signs in once from `/admin/login`, is audited as `admin` + `break_glass`, and notifies the owner. The last enabled owner admin cannot be disabled. The boot `admin` / `changeme` bootstrap into `users` is DELETED.
6. **Migration steps.** **P1 (`159_admin_accounts`, additive, both runners byte-identical):** the two tables, the audit columns + backfill. Flag `ADMIN_ACCOUNTS_ENFORCE` default **OFF**: admin routes accept the OLD path OR an admin session (so the owner can prove the new one without losing the old); People excludes `is_admin` rows already (display only). The owner's admin account is created by the owner-email link, not by copying row 1's hash. **P2 (after the owner proves it):** back up; flag ON (admin routes read only `admin_sessions`); revoke row 1's connection, sessions and tokens; **`160_no_admin_in_users`**: `UPDATE users SET is_admin = 0`, and `BEFORE INSERT` / `BEFORE UPDATE OF is_admin` triggers that ABORT on a non-zero value (SQLite cannot add a CHECK by ALTER; a trigger is what the database enforces); `POST /api/admin/users` loses `isAdmin`. Row 1, now an empty user account, is deleted in a later, separate step (a week on, after a backup), not in the flip.
7. **Rollback.** P1: flag OFF is today's behaviour; the new tables are inert. P2: flag OFF + drop the two triggers + restore `is_admin = 1` on row 1 (recorded in the audit row's `before`) — a written SQL, run only on the owner's word; row 1's deletion is undone only from the backup, which is why it is not part of the flip.

**THE D86/D88 FOLLOW-UP — the owner's four items (the agent's NEXT task, after D95's approval; findings only).**
- **WHY THE CONNECTION BOUND TO ADMIN — measured:** the consent screen reads the browser COOKIE session (`routes/byom.js:199`, `req.isAuthenticated()`); a top-level navigation to `/oauth/authorize` sends no tab token, so `req.user` is whoever last signed in in that browser. That browser's only session was row 1's (the admin page signs in through the same route and sets the same cookie); row 3 has no browser session at all. The page did say "Signed in as `admin`" — row 1 has no email, so it fell back to the username — and offered "Not you?", but nothing warned that it was an admin.
- **1 · consent for an admin:** not built; one condition in GET + POST `/oauth/authorize`. ⚠ **Overlaps D95 principle 2**, which says REFUSE, not warn. Recommended: refuse Allow for an admin and offer only "Use a personal account" (it satisfies both rows); the owner picks.
- **2 · Admin → System → Plugin by email:** today it shows a COUNT of connected users and recent calls by username (`/api/admin/byom`, `adminOps.jsx:1399`, `1428`). A connections table (email, host, connected, last used) needs one query; `oauth_connections.last_used_at` exists. Row 1 would show "no email" — another reason for D95.
- **3 · People → Users, all by default + "N hidden":** **the list already shows every account by default** (filter `all` excludes only the `system` row); **no internal/test filter exists** and **no `user_tags` table exists** (D88 specified both; neither was built). So there is nothing hidden to count yet. ⚠ **Overlaps D95 principle 4** — admins leave the list and the hidden counter never counts them. Likely why row 3 was hard to find: the default sort is *recently active*, and row 3's last activity is an extension token from 10-07 while row 1 is active today; its row also shows a username the owner may not search by. Proposed: tag `internal` / `test` (the reviewer account, the test rows), filter off by default, "N hidden" beside it when on.
- **4 · a connector token on `/api/admin`:** **already refused, not yet pinned.** `getRequestAuthContextToken` reads `Authorization: Bearer`, but looks the hash up in `auth_contexts`; a connector token (`dft_at_…`) lives in `oauth_tokens`, so no user is bound and `requireAdmin` answers 403. A test would walk every mounted `/api/admin` route with a live connector token. (Side note: `getRequestAuthContextToken` also accepts `?authContext=` in the query string — a token in a URL lands in logs.)

**⏸ THE OWNER DECIDES:** approve / amend (d) · warn or refuse on consent (item 1) · the admin session windows · whether admin sign-in gets a second factor now or later · whether the `internal` / `test` tags are built with item 3. Nothing pushed; this entry is uncommitted.

### 2026-10-12 (41) · D92 + D93 (one piece of work), then D94 — "pick up worklog, D92, 93 … end with pending items" · "D94 added, complete in full"

- **D92 P0** on a throwaway server (the frozen D91 fixture, keys blanked, :3192): the seam's layer found (JobsPanel's 160° tint + the fit notice's hairline); the stuck bar measured as the column. **D92 P2 + D93 P1–P3** as attribute variants with custom properties; **P4** matrix + probe. `7ebed68`. **D94** P0 from Resend's docs, P1–P2 built, seen with signed synthetic events. `a7f3700`.
- ⚠ **`7ebed68` was PUSHED by someone other than the agent** — `origin/main` moved to it at 01:35:53 (local) by a push from this machine, two minutes after the commit; the agent ran no `git push` this session. It is LIVE (`/api/version` commit `7ebed68`, started 05:36:53Z, migration 157 unchanged — D92/D93 add none). `a7f3700` (D94) is LOCAL, not pushed.
- Test re-points (the old designs were removed on the owner's word, so tests that pinned them now pin the new CSS): topBarChrome, d18NavAmendments, d60NoPills, d69SmallOnes, appScrollProgressRemoved (anchor), d35 / d47 (`.bh` line-height × `--bh-room`, still one for prose and tokens), d55f (the NAVIGABLE list gained `customise`), d91Appearance (the answer gained the layout keys; Appearance moved).
- Agent slips, each caught: two `python -` heredocs hung (stopped); the throwaway server ran stale code after a route change (restarted — the orphan on :3192 stopped by PID after checking its command line); a seam-test fixture placed the stuck bar off the chrome's edge (fixed to match `top: var(--app-chrome-height)`).
- Suite **4160 / 4160 / 0**. The owner's uncommitted D92 / D93 / D94 rows were backed up before editing and are committed with this entry.

### 2026-10-11 (40, later) · D91 P1–P7 — the module, the contrast themes, cues, Appearance, the matrix, the guide

- **Owner:** "defaults approved, keep going through P7" (§13's five defaults).
- **P1 `1ee7d1b`:** palettes moved byte for byte into `themes/paper-light.js` / `charcoal-dark.js`; `themes/index.js` the one decider; the no-flash pre-paint script generated by Vite from the registry (dark users saw white until the bundle loaded); the vestigial registry (`rm_theme_id`, `isDark`, the hidden picker) gone. **Identity:** `scripts/d91ThemeShots.mjs` on a frozen throwaway DB (fixture copied from an earlier session's scratch DB; its admin password reset to a synthetic one) — 120 + 8 screens before and after; 123 byte-identical, 5 differ only in clock-driven text (checked by eye).
- **P2 `3f5caa2`:** the guard now scans `client/index.html` and every `shared/` module the client imports; `RESPONSE_LABELS` / `OUTCOME_LABELS` carry a `tone`, not raw hex; DockPortal's fallbacks tokens; the cover letter and The Table's résumé frame on `DOC_PAPER` / `DOC_INK` (same in every theme).
- **P3 `505377b`:** the derivation script; Contrast Dark `BAND_WEAK #FF8080 → #FF8C8C` and `PAIR_MISSING → #FF8383`, Contrast Light `PAIR_GENERIC #5A5A5A → #575757` (pairs the sketch never computed); exactly eight pairs held at AA.
- **P4 `448af59` · P5 `df017fa` · P7 `9a6ae13`:** as their commit messages say. P5 needs no migration and leaves the mobile contract unchanged (it never carried the theme).
- **P6:** a smoke matrix (Contrast Dark vs Paper Light) found the fill orange used as text (9 places, incl. the shared sub-tab bar at 3.32:1 in Paper Light) and ~20 controls with no keyboard focus — both older than D91, both fixed in `180e3b2`, guarded by `test/d91Coverage.test.js`. The full matrix ran after; its numbers are in the D91 row.
- **Tests:** 4096 → **4132 / 4132 / 0**; every new rule broken on purpose (36 injections across P1–P5) and seen red, restored from saved bytes. Two of my own test slices used a bare `indexOf` — the project's anchor guard caught it.
- **Not touched:** production (nothing pushed); `Agent report.txt` and the two extension jpgs.

### 2026-10-11 (40) · D91 P0 — the theme audit

- **Measured:** local `main` `9d36794` (1 ahead of origin, docs only); `npm test` **4096 / 4096 / 0** before any change. The scanners reuse `colorLiteralGuard`'s regex and comment-stripping over more roots (client, `index.html`, `public/`, extension, `shared/`, server).
- **Delivered:** `docs/THEME_AUDIT.md` — literals by area (§1), the three colour channels and 30 hex-alpha sites (§2), the theme branches and the two deciders (§3), the 55-file status bypass list (§4), the hue-only places (§5), dark's reachability and the flash (§6), the extension pipeline (§7), system preferences (§8), the tests D91 collides with (§9), documents and third-party colours (§10), the sketch against the site's ~150 pairs (§11), the estimate per phase and area (§12), five added decisions (§13).
- **Tracked:** the owner's `docs/THEME_MODULE.md` and `docs/themes-contrast.html` (the spec and the sketch), with the sketch path corrected in both the spec and the row.
- **Not touched:** the product (P0 is read-only); `Agent report.txt` and the two extension jpgs (not the agent's).

### 2026-10-10 (39l) · audit — "audit pending tasks and verify logs to check if it's up to date"

- **Measured:** `/api/version` `7f4715d`, `latestApplied: 157_base_resume_uploads`; draft local = origin (0 ahead, 0 behind); the plugin `df44ff6` local = origin, public; the tools service `4e89300` = origin and live. Tests last measured 4096 / 4096 / 0 (39k, the commit that was pushed).
- **Corrected:** CURRENT STATE (production, migration high-water, plugin, test note); the D86 v1, D90 P1 / sketch and launch-instructions status lines that still said LOCAL or private; O92–O94 now each open with the list of what is still open. NOW 39l lists every open item — **all the owner's.**
- **Not touched:** history entries (dated, left as written); three untracked files not the agent's.

### 2026-10-10 (39i) · D90 P1 on the owner's answer

- **Built (`640fd6e`):** migration 157 (`base_resume_uploads`, `resume_versions.base_upload_id`, a backfill), `services/baseResumeHistory.js` (recorded on every base save; every stored version stamped), `services/resumeChanges.js` (pure; ~14 ms on a real résumé), `routes/resumeChanges.js` (three endpoints). The privacy policy's Data Storage paragraph and `PRIVACY_RECONCILIATION.md`; HANDOFF and ARCHITECTURE quote 157.
- **Tests:** `test/d90ResumeChanges.test.js` +10 — every spec §7 rule that applies to P1 (identical → zero; no ids → a reworded bullet aligns to its own original; the word diff; terms gained with source and untraced counted; roles never change, shown; pure and < 100 ms; uploads kept and versions stamped; the default pair survives a newer upload; any two; "what we sent" immutable after regeneration; another user's data 404; no eligibility / EEO / contact field). Six injected violations each red, restored from saved bytes. `profileScopedResumeSignals`' strict fake database learned the new statements (a test fake, not a behaviour change).
- **Throwaway server:** 157 applied at boot (`[migrate] ✓ 157_base_resume_uploads`, backfill row); as the reviewer, a connector-made version recorded the re-uploaded base and compared 1 rewritten / 9 unchanged. ⚠ A copied database without its `-wal` file is an OLDER snapshot — it explained a null-score run; nothing in D90.

### 2026-10-10 (39h) · the owner's agent prompt — the plugin, connector readiness, D90 P0

**Preconditions.** `docs/` had the compliance and expansion documents and the UI addendum; `PLUGIN_LAUNCH_INSTRUCTIONS.md` and `WHAT_WE_CHANGED_SPEC.md` were in Downloads (10-10 00:40) and were copied in (`07e981f`) — read in full first. Pushed on "push both": draft `0b4aae9` LIVE.

**PASS / FAIL**

| Item | Result | Evidence |
|---|---|---|
| A1.1 remote + push | ✅ PASS | `drafthq/draft-plugin` did not exist; the owner gave `draft-hq/draft-plugin`; pushed with the saved Git Credential Manager login (no token stored) — `df44ff6` |
| A1.2 only the five files | ✅ PASS | `git ls-files`: `.claude-plugin/plugin.json`, `.mcp.json`, `LICENSE`, `README.md`, `skills/tailor-resume/SKILL.md`; every commit authored with the GitHub noreply address; no secret, no draft source |
| A1.2 public from the first push | ❌ **FAIL — owner** | the repository is PRIVATE (anonymous `api.github.com` → 404) |
| A1.3 LICENSE | ✅ PASS | MIT, "Copyright (c) 2026 the drafthq contributors" (owner's wording) |
| A1.4 name / slug | ✅ PASS | `jobsviadraft` (owner's choice); description neutral; version 0.2.0 |
| A1.5 README | ✅ PASS | what it does, every tool with read / write, the check, retention (1 day / 12 months), the user's own Claude, no model call and no training, the AI notice, disconnect, contacts; no promotion |
| A1.6 `claude plugin validate` | ✅ PASS | `✔ Validation passed` (re-run after every edit) |
| A1.7 auto-publish off | ⏸ owner | a portal setting |
| A2.1 compliance tests + G3 lint | ✅ PASS | 56 / 56 across d86ConnectorCompliance, d86Byom, d86Cimd, d86ConnectorDocs, d86ReviewerDemo — **CIMD was the missing G3 item: built (`07e981f`)** |
| A2.2 v1 read-only tools | ✅ PASS | built 39g (`fcd7cfa`); live since `0b4aae9` |
| A2.3 reviewer account + Reset in People | ✅ PASS (code) / ⏸ owner (production) | Admin → People → Users → "Reset demo account", driven in Chrome; the four prompts re-verified on this build |
| A2.4 public pages 200 | ✅ PASS | production: `/docs/claude`, `/privacy`, `/terms` → 200 (SPA routes; the content checked in 39g's browser pass) |
| A2.5 security.txt + disclosure | ✅ PASS | `/.well-known/security.txt` live (Contact security@, Expires, Policy, Canonical); the disclosure paragraph is `/docs/claude#security`; the mailbox route is the owner's (set up) |
| A2.6 data-handling answers | ✅ PASS | `docs/DIRECTORY_LISTING.md` |
| A2.7 listing pack + evidence | ✅ PASS | `docs/DIRECTORY_LISTING.md` — one-liner 53 chars, description 1,130 |

**`claude plugin validate` output (draft-claude-plugin, HEAD `df44ff6`):**
```
Validating plugin manifest: C:\Users\duggi\WebstormProjects\draft-claude-plugin\.claude-plugin\plugin.json

✔ Validation passed
```

**The lint suite (G3):** `node --test test/d86ConnectorCompliance.test.js test/d86Byom.test.js test/d86Cimd.test.js test/d86ConnectorDocs.test.js test/d86ReviewerDemo.test.js` → **56 tests, 56 pass, 0 fail.** Covered: descriptions (no orders, no second person, no links, DR-2's words, no plan / price words) · `title` + the three hints on every tool · names ≤ 64 and `draft_`-prefixed · one write tool · no instruction text in the brief or at initialize · brief ≤ ~2,500 tokens · `401` + `WWW-Authenticate` with `resource_metadata` · metadata advertises CIMD (`client_id_metadata_document_supported`, `none`) and DCR · `https://claude.ai/api/mcp/auth_callback` exact and the loopback port-agnostic · no content in any log call · no free-text context parameter · the retention sweep · untrusted posting text · Origin. Full suite **4086 / 4086 / 0**.

**⛔ BLOCKS SUBMISSION**
1. **`draft-hq/draft-plugin` is private** — make it public (O94 (a)).
2. **The A/B (D86 Phase 2) has not run** — "nothing is submitted until the A/B passes".
3. **G4 not done** — the owner adds the connector to a personal Claude account and calls every tool (the portal asks you to confirm it).
4. **The reviewer account does not exist on production** (O94 (c)).
5. **CIMD and the People reset are local** — push (O94 (b)); the CIMD flag must be live before claude.ai is tested, or Claude falls back to DCR (which also works).
6. **A Pro (or Max) account to submit from** — Free cannot submit (D86 owner decision).
7. **Counsel** on the Terms sections (Q1–Q8) **and a trademark clearance for "Draft"** before the slug becomes permanent.
8. The Sign in with ChatGPT Terms page snapshot (O93 (f)) — ChatGPT only, not the Claude submission.

**D90 PHASE 0 — the inventory (read-only; no code)**

| Input (spec §4) | Exists? | Where | Gap |
|---|---|---|---|
| 1 · the base résumé and its structure | ✅ text; ⚠ no stable bullet ids | `profile_base_resumes.content` (per job profile; legacy `base_resume`), `parsed_json` / `parsed_basis` (D65); sections / roles / bullets are derived at read time by `buildStructuredResume` | ⛔ **overwritten on re-upload — no history of earlier bases.** Bullet ids exist only inside a D86 brief (positional, `s2.e0.b1`) |
| 2 · each tailored résumé | ✅ every version kept | `resume_versions` (html, `version`, `tool_type`, `ats_score`, `ats_report`, `base_ats_score`, `created_at`) + `resumes` (the working copy, overwritten on regenerate) | ⛔ **no provenance and no record of WHICH base text a version was made from** (no base hash or base copy) |
| 3 · the ATS history | ✅ per version; ⚠ base only current | each version's own report on its `resume_versions` row (the tie is the row itself); the base's report in `ats_only_reports` (user, profile, job, `basis_hash`, `job_hash` — so a stale one is detectable) | the base report is the CURRENT basis only — an older base's report is replaced; each version keeps the base *score* (`base_ats_score`), not the base *report* |
| 4 · the apply snapshot | ✅ the résumé AS SENT, immutable | `application_artifacts` kind `resume` (HTML, brotli, `sha256`, `resume_id`, `resume_updated_at`) per `application_records`; `job_applications.ats_score_at_apply` + `ats_report_at_apply` | not linked to a version number (match by `sha256` against a version's HTML). ⚠ The spec's table name `application_snapshots` does not exist — migration 129 of that name added posting columns to `apply_run_jobs` and pay to `job_applications` |
| 5 · the plugin path's patch | ❌ not kept | `byom_briefs` keeps only `patch_hash` and `resume_version`; `base_json` is emptied a day after (the D86 retention rule) | the id-keyed alignment cannot be used after the fact — **similarity alignment (spec §4, step 2) applies to every path** |

**Must be ADDED for D90 as specified:** **(a) the base résumé as it was at each version** — a base hash and a base copy per `resume_versions` row (or a base-history table). Without it a diff against *today's* base misattributes changes the user made to the base. It copies text the user already stores; the privacy policy's résumé paragraph should say versions keep their base. **Optional:** (b) a source map for plugin versions — tailored bullet → base bullet id, **ids only** (keeps the 1-day text rule); (c) `application_artifacts.resume_version` instead of the sha match. Everything else D90 needs exists. **The owner decides (a) before P1** (O94 (e)).

### 2026-10-10 (39g) · "push it and move on" · "push the plugin repo too" · "the docs are in downloads, go ahead"

- **Pushed:** draft `76595d8..ff4a721` (read live: `/api/version` 01:45Z, health 200, `/mcp` 401 without a token). The plugin: `gh` is not installed and the auto-mode classifier refused creating a public repo through the API; the owner created `Sri-Yellela/draft-plugin` and `29ebf14` was pushed (author email changed to the GitHub noreply address first).
- **Docs:** the four D86 / D89 documents and D86's UI addendum + sketch copied from Downloads into `docs/` (private repo checked; synthetic people only).
- **Built (10 commits, NOW 39g).** End to end on a throwaway server (`RM_DATA_DIR`, keys blanked): the v1 tools against the real board; the reviewer's four prompts; the admin card through its confirm; `/docs/claude` at 1440 (both themes) and 390 (a `minWidth: 0` fix for the table; list numbering restored).
- **Found:** the per-user BYOM cap and switch-off were displayed and not enforced (fixed, `a658cca`); the first sample postings were too short to score (rewritten; all twelve 55–74); the test fake board trimmed results, hiding a mutation (fixed).
- **Mutation checks:** 8 for the v1 guards (brief writing a row, injection neutralising, Origin, an unbounded string, any claude.ai path, the search cap, the MAC, prose by default) — each red, restored from saved bytes.
- ⚠ **Session slips:** a stray `python -I -` hung one command (killed, nothing lost — the memory note covers it); two long heredocs failed to parse (moved to scratch files).

### 2026-10-09 (39f) · "pick up the work log and complete it" — D86's compliance redesign

- **Audit first:** git clean but for the WORKLOG's on-disk D89 + D86 compliance text (backed up to the scratchpad before editing) and three untracked files left alone (`Agent report.txt`, two extension jpgs); 13 old agent worktrees under `.claude/worktrees/` left as they are. Production measured: `76595d8` LIVE, migration 156 — 39d/39e are deployed.
- **`4e1e9b1` D86 compliance:** the brief and the MCP server send no instructions (§2F); descriptions state what a tool does; refusals and result lines state what happened; `purgeByomData` (1 day / 12 months); the privacy paragraph + `PRIVACY_RECONCILIATION.md` rows; the AI-assistance notice (result + Done card); the pasted request no longer says "follow its instructions". `test/d86ConnectorCompliance.test.js` +8 — six injected violations each turned it red, restored from saved bytes. Suite **4059 / 4059 / 0**, the client builds.
- **`draft-plugin` `29ebf14`** (a new local repo beside draft, no remote): `.claude-plugin/plugin.json`, `.mcp.json` → `https://jobsviadraft.com/mcp`, `skills/tailor-resume/SKILL.md` (the flow, the patch, refusals, reporting, the AI notice), README. `claude plugin validate` passes. Nothing personal in it — it is meant to be public.
- **Not done:** the four docs D86 / D89 cite are missing; D89 is all owner / developer gates; A96 (CIMD) still waits on the ChatGPT side. → O92.

### 2026-10-09 (39e) · the /loop's second tick — D88 P3 and P5

- **Tickets** (`2b20794`): migration 156, `services/tickets.js`, `routes/tickets.js`; Settings → Help (contact support, your requests, the thread, reply); Admin → People → Support (the queue by due date, a ticket with internal notes marked, canned replies, Send / Send and mark solved). Replies are emailed from support@ with Reply-To support@ and a link back; an internal note sends nothing. Walked through the real UI, 11 / 11.
- **Found and fixed:** `deleteAccount` relied on foreign-key cascades, and migration 155's two tables have none — a deleted account left its overrides and notes. Cleared explicitly now; the ticket tables cascade.
- **The privacy policy** gained one paragraph (Data Storage and Security) and `PRIVACY_RECONCILIATION.md` a D88 section — what a request keeps, when it is deleted, that admin changes are kept with their reason.
- **Self-service** (`1a0321c`): Settings → Your plan and allowance, read-only — never money, never the A+ swap, never a value's source.
- **The queue is empty for the agent**; what remains is the owner's (O91). The loop stopped.

### 2026-10-09 (39d) · /loop "finish all pending tasks; go with your recommended decisions; record them"

- **The decisions taken** are listed in NOW (39d) and in each commit; every one is reversible and none changes a default a user sees, except that the admin's A+ swap is now silent on a reload too.
- **Order, to avoid rebuilding:** the admin MAP first (so no panel was rebuilt and then moved), then one shared kit (Enrichment's parts moved, plus `Panel` and `useConfirm`), then each panel in the decided order, People last so D88 is built once, as People, inside the map.
- **Found and fixed on the way:** the backup button turned into a capsule on hover (a `999px` in an event handler the pill guard cannot see) · the inspector's Assign dropdown lacked roles the classifier suggests, so it SHOWED engineering while Save wrote sales · the inspector's auto-refresh toggles were capsules · the sticky admin header was translucent · a share under half a percent read 0%.
- **Every panel walked** on a throwaway server, light and dark, 1440 and 390 — no page errors, no horizontal scroll (`draft-screenshots/d83-map/`, `d83-rebuild/`, `d88-people/`); D88 end to end 14 / 14.
- ⛔ **Not done:** O86 (c) — the production read was refused by the auto-mode classifier; not retried another way.

### 2026-10-09 (39c) · extension v1.5.1 — the near-capsule fix, on a branch

- **The shape.** `d60NoPills` catches FULLY rounded shapes; a 28px control at radius 11 is not fully rounded and still reads as a capsule. Fixed: `.rm-btn` 11 → 8 and `.rm-edit` 11 → 6 (`extension/review-overlay.js`), `.link` 11 → 8 (`extension/ui.css`; `.mb` keeps 11 on its own 38px rule). Larger controls (`.sq`, `.btn`, `.mb`, `.nb`, `.tile`) were already ≤ 30%.
- **The guard.** `test/d60CompactRadius.test.js` scans every CSS rule in `extension/` (stylesheets and injected template strings) with a px radius and a px height: radius / height ≤ 0.3, squares and circles excluded. Run on the pre-fix tree it named exactly `.rm-btn` and `.link, .mb` (39%). D23's `.rm-btn` pin moved 11 → 8.
- **The release.** v1.5.1: manifest, README header (the build syncs it), STORE_LISTING (heading, artifact, a note that nothing but the shape changed), zip rebuilt (v1.5.0's zip kept beside it). Store screenshots regenerated (`A1_RESUME=data/a5-fixture/…`, `STORE_SHOT_DIR` to a scratch folder first, read, then installed) — a 5× crop of *acknowledge* before/after is in `draft-screenshots/ext-1.5.1-radius/compare-ack.png`.

### 2026-10-09 (39b) · cost visibility — the owner's "go ahead and build it"

- **Server.** `httpErrorFor` answers a fixed sentence per status (`USER_GENERATION_MESSAGES`) — never the tools service's message; `code` and `retryable` unchanged, the claim-violation 422 unchanged. `isFundingFailure` (credit balance / billing / insufficient quota / invalid key) sets the `generation_funding_alert` setting from the generate, enhance and standalone catches; the next delivered generation clears it. `GET /api/generate/cost` → a non-admin gets `{ allowance, expectSeconds: [10, 20] }`; an admin gets the old summary too. `/api/generate`'s every answer passes `userSafeGeneration` (`services/costVisibility.js`): no `tool`, `toolLabel`, `retry`, usage, cost, tokens, model or cache keys for a non-admin — an admin's silent A+ swap now reads as Generate. The cover letter's 503 says *"Cover letters are unavailable right now."* New: `GET /api/admin/costs`, `POST /api/admin/costs/funding-alert/clear` (requireAdmin; in the route manifest).
- **Client.** The posting panel's cost line, the *"one model call, 7¢"* tooltip, *"(A+)"* and the cost fetch are gone; the Résumé tooltip and a quota-class line say *"Takes about 10–20 seconds."*; at zero the panel names the local clock time (`clockLabel`). Admin → **Costs & quotas** (`CostsTab`).
- **Kept, by the inventory:** D86's *"uses a draft credit"*, the plans page's *"A+ Resume"* feature name, the Draft button's *"Resets in 4h"*, the `slotsExhausted` refusal (counts, no money). The mobile contract has no such fields (test g).
- **Tests.** `test/costVisibility.test.js` a–h; six injected violations each went red and were restored from saved bytes. Pins moved: D70 P3's panel-cost test now asserts the admin side; A88's two message pins read the generic sentences.
- **Seen** on a throwaway server, both themes, 2400 / 1440 / 390: no ¢ anywhere on the user's page, no request to either cost route, no page errors, no horizontal scroll; the admin tab shows the banner and the rows (`draft-screenshots/cost-visibility/`). ⚠ The panel tops out at 558px, below the 600px container width at which the quota lines show — so on the desktop the allowance is the badge and the tooltip, as it already was.
- ⚠ **Noted, not changed:** a stored A+ résumé's listing (`/api/resumes`) still carries its `tool`, so a user whose Generate the admin flag swapped could see "A+" on a reload. A data question for D88 (whether the swap stays silent), not a cost leak.

### 2026-10-09 (39a) · /loop "complete all pending tasks" — one tick did all the agent-doable work

- **The release check's two behavioural defects** (`fe03a1b`): the apply-time cover letter read the user's newest résumé for ANY job → this job's, else the base; `GET /api/admin/users/:id/profile` returned `SELECT *` (gender, ethnicity, veteran, disability, sponsorship, clearance, visa, work authorisation, phone, address, custom answers) → an allow-list. No client read that route.
- **Store screenshots** (`be274e7`): `npm run store:screenshots` into a scratch folder first, read, then installed — ALL PASS, the synthetic Ada Lovelace fixture. ⚠ Found: the overlay's small buttons (`.rm-btn`, radius 11 on a ~26px control) read as capsules — logged for the next extension version, not changed mid-release.
- **D73 §B** (`fc85cb3`) — as the D73 row. Walked in both themes; no page errors.
- **What is left is the owner's** (O90). The loop stopped.

### 2026-10-09 (38z) · pushed both; sessions A′; D70 Phase 3's last step

- **Pushed on "push both":** the tools service first (`574de80..4e89300`), then draft (`4884af4..ce54f40`); both read live.
- **Sessions A′** (`d89269f`): (1) `/api/auth/logout` — a tab whose token is a DIFFERENT account than the cookie signs out that tab only (scope `tab`); otherwise AH1's machine sign-out, unchanged. (2) Migration 153 `auth_contexts.auth_at` — a browser token carries its sign-in time; `recentAuth`, `requireRecentAuth` (password, email, delete) and reauth read the ACTING identity, and reauth stamps the cookie session only for the same account; "this browser" in the session list, sign-out-elsewhere and a password change is the acting tab's session. (3) The user and admin sign-in pages show their form to a browser signed in as the other kind, with "…in another tab — that tab stays signed in". Proof: `test/sessionsTwoAccounts.test.js` (6; mutation-checked) and `scripts/sessionsTwoTabs.mjs` **9 / 9** in a real Chrome against a fresh throwaway server; the notice in both themes at 1280 and 390 (`draft-screenshots/sessions-a-prime/`).
- **D70 Phase 3** (`da31747`): draft had vendored the tools service's contract **1.1.0** since 09-29; re-vendored 1.5.0 verbatim, the gate test went red as designed, `RESUME_MASTER_ACCEPTS_CACHE_OPTION` → true — the interactive Generate sends `cache: false`. Keywords mode stays unwired (14% recall).

### 2026-10-09 (38y) · the owner's four tasks, consecutively — release check, sessions Phase 0, cost visibility, D88 P0–P1; D70's leftovers

**How it ran.** The owner asked for parallel lanes, then said *"drop parallel agents, do consecutively"*. Lane 1 (the tools service) had committed `f14df2d` and `3489502` — kept; its half-edit was stashed, then finished here as `4e89300`. Lane 2 had only measured the fresh-clone suite (**3975 / 3975 / 0** at `4884af4`); its worktree was removed (junctions checked first; main-tree package counts unchanged).

#### TASK A · THE EXTENSION RELEASE CHECK — `92089fe`

| | check | result |
|---|---|---|
| A1 | zip | ✅ `resume-master-extension-v1.5.0.zip` 193,616 B · SHA-256 `0e7c6c4efa8eedc3967c17bd7ed3d3ff93efcfefff32bbf79b7f3011faad5bd2` · 32 files, manifest at the root · v1.5.0 in the manifest, zip, README and listing · no source maps, tests, secrets or JPGs (the two strays are excluded) · the DEV SWITCH on production in both files · byte-identical to `extension/` |
| A2 | privacy reconciliation | ⚠ → ✅ wording fixed (below) · ⛔ two behavioural findings reported, not changed |
| A3 | store pack | ⚠ → ✅ the paste-ready section added to `STORE_LISTING.md` · ⛔ the screenshots are stale |
| A4 | server compatibility | ✅ all 21 endpoints the extension calls answer **401** on their own method unauthenticated (no 404 / 500); `/api/auth/me` → `{authenticated:false}`; no extension-ID pin, so an unpacked build and the Store build are both admitted; the extension reads no contract version |
| A5 | safety scan | ✅ MV3 · `activeTab`, `contextMenus`, `scripting`, `storage` · one host · five optional hosts · CSP `script-src 'self'` · no content scripts, web-accessible resources, `eval` or remote code · no token or profile data in any log · automatic capture gated on the switch AND the granted permission |
| A6 | dev handoff | ✅ `docs/E2E_TRACK_B.md`; the zip SHA-256 above · ⚠ the dev's package lacks `E2E_TEST_GUIDE.md` and the two CSV templates (not on this machine) |

**A2 — the discrepancies, and what was done:**
1. The policy's email line: *"transactional emails (password reset, account confirmation) — no marketing emails without explicit opt-in"*. **There is no account-confirmation email and no marketing email at all.** Fixed: the two that exist — the reset link, and the code confirming a new email address.
2. **Resend** (outbound) and **Cloudflare Email Routing** (inbound mail to `privacy@` / `support@`) were recipients the policy never named. Fixed: both in Third-Party Services and in the reconciliation table.
3. **`support@` appeared nowhere** — not in the policy, the listing, the Terms or the code. Fixed: `shared/brand.js` `SUPPORT_EMAIL`, the policy's contact section, the Terms' Contact clause, the listing's support fields. (The extension shows no contact address; the site footer links /contact.)
4. The date → **October 9, 2026**.
5. Verified as already right: the cover-letter payload (résumé text, title, company, description, tone — both paths) · the Limited Use statement (policy and listing) · the seven storage keys, exactly · host / optional hosts / automatic capture · Report this form (host and labels, never values) · Terms exists and is linked · every URL in the listing, policy and Terms returns 200.
6. ⛔ **Reported, not changed (behavioural):** (a) the apply-time cover letter (`generateCoverLetterForApply`) reads `resumes ORDER BY updated_at DESC LIMIT 1` — **the user's newest résumé for ANY job**, not this job's; its tone is fixed. (b) Both cover-letter paths call Anthropic directly — disclosed, pre-existing, but outside D17's "only résumé generation calls a model". (c) **D73 §B: nothing is built** — no consent columns, no unsubscribe, no webhook, no `SUPPORT_EMAIL` env.

**A3 — the checklist** is in `STORE_LISTING.md` › *The dashboard, field by field* (20 numbered steps, in the dashboard's order).

**⛔ BLOCKS UPLOAD:** (1) **the store screenshots are from 09-26, before D63** redesigned the popup, badge and overlay — regenerate; (2) **push `92089fe`** so the live policy carries the October 9 date and the corrections; (3) the reviewer account and test instructions (the owner); (4) the owner's choices and ticks: category, visibility, regions, the trader declaration, the four certifications.

#### TASK B · SESSIONS — PHASE 0 (read-only, measured)

**1 · Today.** One cookie, `connect.sid` (express-session, SEALED store — `EncryptedSessionStore` over SQLite), HttpOnly, Secure in production, **SameSite Lax**, 7 days rolling; regenerated at sign-in. **Plus a per-tab token:** the web client keeps an auth context in **`sessionStorage`** (`rm_auth_context`) and sends it as `X-RM-Auth-Context`; when present, it **wins over the cookie** (`bindAuthContext` sets `req.user`). Tokens: 7 days idle, 90 absolute, bound at issue to the cookie's session id.
**2 · Admin.** The same session plus a role — `requireAdmin` = `req.user.isAdmin` and not the extension. **No separate login. An admin account cannot open `/app`** (`UserRouteGate` redirects every admin to /admin), so the owner's admin and the owner's profile are necessarily two accounts. (Production's accounts were not read.)
**3 · Measured on a throwaway server** (one browser profile, two tabs; a second browser as the second device; shots `draft-screenshots/b0-sessions/`, not committed):

| step | result |
|---|---|
| tab A: admin signs in | admin ✅ |
| tab B (new tab) opens /admin | admin (the cookie) |
| tab B signs in as the normal user | user ✅ |
| **tab A reloads /admin** | **still admin ✅** (its own token) |
| tab C (a FRESH tab) opens /admin | **the user** — a fresh tab has no token, so it gets whoever signed in last |
| tab B signs out | tab A **still admin ✅** |
| a second device signs the admin in | tab A still admin ✅ |
| ⛔ **tab A (the ADMIN) signs out** | **tab B (the user) is signed out too** |

**⇒ The goal already mostly works, with two accounts.** Three defects stand in the way: **(i)** an admin sign-out revokes everything on the shared cookie's session — the user tab's too; **(ii)** ⛔ **the "recent sign-in" check for sensitive account changes reads the COOKIE session's `authAt` while acting as the HEADER token's user** (`routes/accountManagement.js:52`) — in tab A, an admin-account change is judged against the user's recent sign-in; **(iii)** a fresh tab, or a browser restart, takes the last sign-in.
**4 · Consumers a change could break:** the extension's bootstrap (`GET /api/auth/extension-token` with the COOKIE → it connects **whichever account signed in last** — possibly the admin's, though admin routes refuse the extension) · Android (its own token) · D86's consent (the cookie's user — the same "last sign-in" rule) · the crawler (HMAC) and the Railway webhook (header) — independent · CSRF: header-token requests exempt, cookie writes origin-checked.
**5 · "One active session":** background tabs poll (the event stream), so "active" is ambiguous; a refresh keeps the tab token; sleep only ages it; a mobile network changes the IP, not the session; the extension's token is session-less — a one-session rule must exempt it or sign it out.

**B1 · OPTIONS — ⏸ the owner picks; nothing built.**
- **A′ (recommended) — two accounts, per-tab tokens, as today, plus three fixes:** a sign-out revokes only the presenting tab's token and the session that token was issued on; the step-up check reads the acting identity (stamp the auth context, not the cookie); a fresh tab says plainly whose session it is. Smallest change; every consumer unchanged.
- **B — named session slots:** a `draft_admin` cookie for /admin and /api/admin, independent of the user's. Survives fresh tabs and restarts. Costs a second sign-in flow and every admin route reading the slot.
- **C — an admin host** (`admin.jobsviadraft.com`, host-only cookie): the cleanest isolation; DNS + a second custom domain on the draft service (⚠ the plan's domain allowance not checked) + a second origin for CORS and OAuth.
- **D — "one active session per account":** only as an OPTION — Settings already has *Sign out other sessions*. As a default it breaks two devices, the extension, Android, the D86 plugin, and the goal itself.

#### COST VISIBILITY — STEP 1 INVENTORY (read-only)

| # | where | what a non-admin gets | proposed |
|---|---|---|---|
| 1 | `GET /api/generate/cost` (`server.js`), any signed-in user | cents, ledger medians, which tool runs, *"one model call — 7¢"* | **ADMIN-ONLY**; non-admins get the allowance |
| 2 | posting panel (`JobDetailPanel.jsx` — the cost line, the Résumé tooltip *"one model call, 6.7¢"*, *"(A+)"*) | the price and the tool | **REMOVE** → Admin → Costs |
| 3 | `/api/generate` response `retry: { reason: "after: <code>" }` | internal retry reasons | **REMOVE** for non-admins |
| 4 | `/api/generate` `tool` / `toolLabel` when the admin's swap applies | "A+ Resume" the user did not choose | **REPLACE** with "Generate" when the swap is the admin's flag |
| 5 | ⛔ tools-service errors → `ToolsServiceError(json.message)` → `httpErrorFor` → `error` | **the provider's own words** — *"Your credit balance is too low…"* travels from the tools service's 502 to the browser | **REPLACE** with a fixed message; raw text to the admin log; a funding failure raises an ADMIN banner |
| 6 | cover letter 503 *"its model key is not configured"* | server configuration | **REPLACE** with the generic message |
| 7 | the mobile contract | no cost / usage / token fields (only `toolType`) | nothing to do |
| 8 | client analytics | none carry cost | nothing to do |
| 9 | D86 copy — *"uses a draft credit"*, *"free to you — your own ChatGPT"* | allowance language, no money | keep |
| 10 | marketing / plans — *"A+ Resume"* as a plan feature | a feature name, no price | keep |
| 11 | limit messages (`checkLimit`, `slotsExhausted`) | counts and resets, no money | keep |
| 12 | Admin → Usage / Users (tokens, cost) | admin only | keep |

**STEP 2 — the proposed user wording — ⏸ the owner confirms:** allowance *"3 of 10 drafts left in the last 24 hours"* (the unit that exists) · expectation *"Takes about 10–20 seconds"* · spent *"You've used your drafts for now — the next one frees up at 4:12 pm"* (the window is a trailing 24 hours, so "reset at midnight" would be false) · failure *"Résumé generation is unavailable right now — try again shortly"* · A+ under a plain feature name only where the PLAN allows the user to choose it; an admin-flag swap shows "Generate". **Step 3 will read the allowance from the D88 resolver** — the order chosen so nothing is built twice.

#### D88 · P0 INVENTORY (read-only)
- **users:** `id, username, password_hash, is_admin, apply_mode, plan_tier, aplus_resume, email_verified_at, byom_enabled, …` — **no status / suspend, no role other than `is_admin`**.
- **Caps and where they are enforced** (now all behind the P1 resolver): draft slots (`/api/generate`, drafting in `routes/apply.js`, The Table) · résumé limits (`checkLimit` ← `user_limits`, edited in Admin → Users → Limits) · the plan gate (`requireToolEntitlement`, while monetisation is on) · the A+ swap (`users.aplus_resume`) · the three apply caps (env) · the full-auto lock (`FULL_AUTO_PROVEN` + the kill switch) · the plugin (operator switch + cap; the user's own switch).
- **Admin → Users today:** System → Users (create **with a password**, change plan, **set a password** — `PATCH /api/admin/users/:id/password`, which D88 forbids — delete with a preview) · Users analytics (per-user résumés / tokens / cost — zeros since D17 — and the Limits editor) · ⛔ **`GET /api/admin/users/:id/profile` returns `SELECT *` — every eligibility and EEO answer**, which D88 says no module may show · the applications view.
- **Reusable:** `usage_events` (the ledger) · `admin_audit_log` (action, target, before / after, undo — **no `reason` column**; D88 needs one) · `user_sessions` + sign-out-elsewhere (module 5) · D86's `oauth_connections` (module 5) · `accountService` export / delete / merge · the password-reset service ("send a reset link") · **`contact_messages` (shown in Admin → System) — the precursor of tickets** · notifications. **Resend-verification has nothing to resend** (sign-up sends no verification) until D73.
- **Overlap with `docs/ADMIN_AUDIT.md`:** rows #15 and #17 are the two Users surfaces D88's list replaces.

#### D70 · the leftovers
The tools service: `f14df2d` · `3489502` · `4e89300` (contract 1.5.0, 371 / 371 / 0, LOCAL). draft: `fe96f67` (the keyword context, unwired) and the pre-check — **mean recall 0.142** (the D70 row).

### 2026-10-08 (38w) · D86's UI rebuilt to the owner's sketch

- The sketch and addendum landed in `Downloads/` at 23:18 — after 38v's search, which found nothing. The five placements were rebuilt to the file; the differences from the prose build were the split button's behaviour (the caret CHOOSES, the main half runs), the four status cards, the Settings layout and activity table, the consent tiles and ✓ / ✕ rows, and Admin's switches.
- The activity table names the job, so `mcp_audit` gained `job_id` — migration 152 amended in both runners (never applied in production). D57's button pin now names both renderings of the Résumé control.

### 2026-10-08 (38v) · pushed 38u; D86 Phase 1 built on Claude first

- **Pushed on the owner's "push it"** (`f7a6657..1ac17de`) and read live. The WORKLOG gained the D86 UI addendum on disk mid-session; it was built in, and is committed with this entry.
- **Measured before building:** draft already vendors the claim guard (identical to the tools service's but for a comment), so no call or copy was needed; the brief reuses the parser the payload uses (`buildStructuredResume`); the store is D57's. The board's View on a stored résumé READS it — but a résumé saved from outside the panel never reached the board's state, so the `resume_generated` handler now marks it stored; otherwise only Generate was offered.
- **Bugs caught by the build's own checks:** a refusal thrown inside a better-sqlite3 transaction rolled back the replay revocation it reported (now returned, then thrown); the phone scrub needed a country code to match (the test's synthetic number slipped through); a connection-only revocation was masked by the token revocation beside it (own test now). Mutation pass: 11 guards, each red when removed.
- **Phase 0 addendum:** *Sign in with ChatGPT* exists but its plan usage is open-source partners and selected clients only; prefill links are third-party-documented, so the request is also copied.

### 2026-10-08 (38u) · D87 the dev handoff, D86 Phase 0

- **Picked up from the file:** D86 and D87 had been added on disk (uncommitted) since 38t; both committed with this entry. Production re-read first: D84 already LIVE (`f7a6657`).
- **D87:** `build:extension --check` validates the source only — the zip proof is `extensionSubmission` (8 / 8). Fixed: line B → `:3001` (+ a test against server.js's PORT), the README's version written by the build, Track B documented. Answered: no email needed to sign up; no extension-ID pin in production (probed with a made-up ID: 401, not 403). The two jpgs are the icons' source art — left for the owner.
- **D86 Phase 0:** OpenAI's help centre refuses the fetch tool; read with curl. The plan limit on write tools (Business / Enterprise / Edu) is OpenAI's own text; the row's *"write on Business, read-only on Pro"* guide was right. Two corrections to the row's auth list (CIMD preferred, refresh tokens optional). Stopped before Phase 1, as the row asks.

### 2026-10-07 (38g) · D70 → D77, measured first, each pushed on the owner's go

- **Measure before building, every time — and the first measurement overturned the premise each time:** D70 (the 13¢ was two résumés, not the description) · D71 (260 production postings state pay; one was the owner's) · D72 (level disagrees with itself on 27% of the board; 10 users whose sponsorship is a default) · D74 (the biggest leak was the classifier, not new sources) · D77 (the volume is 1,000 MB, not 500).
- **Production reads** were made on the owner's explicit go, read-only (`railway ssh`; plain scripts piped as files) — never `railway run`. Writes to production happened only through deploys the owner approved (boot passes: D71's re-read, D74's re-file).
- **Each guard was mutation-tested** — disabled in turn, its test red: D75 (6), D76 (4), D77 (5), D74's anchors, A94, A95, D71.
- ⚠ **Slips, caught and fixed before any push:** two commits briefly held the legacy brand word (the guard scans tracked files and comments) · `server.js` was rewritten to LF by a `sed -i` and restored to CRLF before commit · a D74 anchor draft collided ten times (narrowed; now regression tests) · a D77 test pinned the wrong failure (fixed: an orphaned-page corruption that `integrity_check` itself reports).

### 2026-10-07 (38e) · D60–D63 in order; D67's manual sweep; the release finalised; no parallel agents

- **The sketch first:** `extension-latest.html` was not on the machine; asked — the owner put it in Downloads. Read, never committed.
- **D60** — the guard written first, its ~100 offenders driving the sweep; the nav tabs (radius 14 on ~26px) were found by reading, not by the scan, so a named-offender test pins them. Four older tests pinned the barred shapes (uppercase ATTESTATION / OUTSIDE THE US, `bandChipStyle`, the moved tab styling) — updated, as D60 supersedes them.
- **D61** — the probe answered with measurements (headless Chrome decoding every known logo), not a guess; the opaque list is data with its method in the source.
- **D62** — History now means this job's versions; Settings' list and History are one component. Removing Barlow made the self-hosted-fonts test fail on an unused face — the import went with it.
- **D63** — built to the file; one deliberate deviation (the four squares stay, D13). The first attempt at the packet scores joined `resumes` into the list SQL and broke 11 tests on a minimal schema — moved to a guarded per-packet read. ⛔ Caught before moving on: the owner's two untracked `extension/icons/draft logo*.jpg` were swept into the D63 commit by `git add -A extension/` — taken back out (an amend of my own unpushed commit); untracked again, as found.
- **D67 (1)** — ~20 unauthenticated GETs of real postings on the five ATSs; no new cross-origin pair; three job-id rows that tighten matching.
- **Release** — the bump and zip cleared the two deliberate reds; the store listing rewritten (its single purpose was false since D64). ⛔ The policy promises advance email for a new collection → O85 (b), the owner's.
- ⚠ **Browser:** the D60 nav pass and the first board screenshots ran (`scripts/d60d62Shots.mjs`; a throwaway server on a `.backup()` copy, keys blanked, only the logo host let through); then the system stopped the server for low memory. Not restarted. Screenshots owed → O85 (e).
- `npm test` **3760 / 3760 / 0**; the client builds. **Not pushed.** No servers running.

### 2026-10-07 (38c) · Pushed; D65, D66, D67 (2), D68, D69 built; stopped before D60–D63

- **Push** on the owner's "push it, keep the five sites": `33cc276` — `/api/version` started 05:06:15Z; health 200. O83 (b) decided.
- **D65** — the packet's résumé is parsed and the parse stored with it (138); work history and skills come from it; claimed skills added. Found while building D66: the parse looked only at the account's base résumé, not the active profile's — widened, and 138 (unpushed) amended.
- **D66** — one wrapper over the router's generator; tested through the real apply router with a counting model stub (0 calls on). The tailored artifact is never overwritten (one `resumes` row per job).
- **D67 (2)** — the learning table (140); the trigger is a user's own "I submitted" outside the job's addresses; tested end to end through the router. (1) not done — O84.
- **D68** — five points checked; two policy gaps fixed (the Copy sheet unnamed; the Limited Use affirmation missing).
- **D69** — (a) Archived → withdrawn; (b) the nav measured in Chrome on a throwaway server (port 3169, a throwaway cookie key — the server refuses to boot without `COOKIE_ENCRYPTION_KEY`; the app's session is a sessionStorage token, not a cookie), first fit 390 exactly and overflowed 360 by 17px, then tightened until all four widths fit; (c) the evidence URL's id-only query.
- Guards that went red and were satisfied, none loosened: the migration figures in ARCHITECTURE / HANDOFF (now 140), the route inventory (+7 routes), the account-merge plan (the new per-user table), and two older TopBar tests that pinned the exact style strings.
- `npm test` **3737 / 3735 / 2**; the client builds. **Not pushed** (O84). No servers running.

### 2026-10-07 (38b) · Pushed and live; D59's answers; D64 built; stopped at the context limit before D65

- **Push** on the owner's "push it": `ea32be3` — `/api/version` started 04:39:25Z, `latestApplied: 137_description_text`, contract 2.3.0; health 200.
- **D59's four answers** (owner): grade export raw · the eligibility notice **only in the panel** — the Draft-time confirm removed · `unspecified` kept · Marlborough is not Greater Boston (already true in the metro table; now pinned). `b12cb7f`.
- **D64, the server** (`d1211aa`): `services/jobs/autoCapture.js` + importJob's `auto` mode + `/api/import/auto` (capture · list · undo). Relevance before any write; irrelevant → zero rows in five tables (tested), while a manual capture of the same page still records its refusal. Mutations: the role gate, the US discard, the no-fetch rule and the origin each turn tests red.
- **D64, the extension** (`c25c39d`): the module, the worker's tab listener, the Settings switch, the popup's *Captured today*, `optional_host_permissions`. ⭐ **One deliberate narrowing, flagged (O83 b):** the row said "the D67 family table" for the origins; that table names gated portals, and the extension's documented invariant is no standing access to them — so five public posting hosts only. The new storage key has one write site, so the privacy count (now seven) is the code's. Nine guard tests went red on first run, each correctly (D23's pins, the policy count, the listing, the route inventory, D33's no-503 rule on the import router — the kill switch answers 403); each was satisfied by disclosure or a fix, none loosened.
- **Tooling note:** an `Edit` and a `sed -i` each flipped a CRLF file to LF this session (`server.js` in 38, `routes/importJob.js` here) — both caught by `file` and restored before commit; the CRLF files were patched by a script that keeps line endings.
- `npm test` **3706 / 3704 / 2**; client builds. **Not pushed** (O83). No servers running.

### 2026-10-07 (38) · D59 finished and merged; the owner's D69 (c) decision; stopped at the context limit before D64

- **Run:** one agent, no parallel agents (owner). Picked up the 37d order: D59's four steps on its branch, then merge.
- **D59 step 1** — `scripts/d59Backfill.mjs` on a `.backup()` copy of the local DB: 2,616 read, 4 texts changed, 0 raw-HTML rows locally, `description`/`content_hash` byte-identical. Reading every clearance tag against its posting found five misreadings (public trust as prose, the floor of several levels, wish-list headings, preference asides, a level-less "active security clearance") — fixed with tests `de8a127`.
- **Step 2** — `scripts/d59NormaliseRho.mjs`: ρ 0.746 raw = 0.746 normalised on the graded 30; 0 board scores or bands moved (`403df38`).
- **Step 3** — `scripts/d59BrowserPass.mjs` in headless Chrome on a throwaway server (port 3159, keys blanked; stopped after): every D59 behaviour seen (the D59 row lists them). Caught an older defect — any posting without a stated workstyle read "On-site" (`remote: Boolean(null)` read as on-site) — fixed in `normalizeApiJob` (`bf2754f`).
- **Step 4** — moved from "clear `req_*` in the writers" (broke 33 hand-built-schema tests and could miss a writer) to the filter: `req_*` count only while fresh (`bf2754f`). `server.js` edited byte-preserving; an Edit had flipped it to LF and it was converted back before commit (diff = 3 lines).
- **Merged** `6528ed7`; `npm test` on `main` **3685 / 3683 / 2** (the expected zip checks).
- ⭐ **Measured: production is `3682fdc`** — the six lanes are live; O82(a) corrected.
- **Owner's decisions recorded:** D69 (c) — id-type parameters only. D64–D68 were already written up in 37d in the owner's words; nothing in this session's paste changes them.
- ⏸ **Release finalisation moved to LAST** (NOW explains why). **Not pushed.** No servers left running. The D59 worktree (`agent-a240a0b455e2742a2`) and the six lane worktrees are still on disk — merged, safe to remove once their `node_modules` junctions are checked (16b's near-miss).

### 2026-10-07 (37d) · The six lanes merged; D59 part-built; the owner's answers queued as D64–D69; stopped for a restart

- **Lanes, one at a time after the owner paused parallel work:** A (D57 + D58, migration 131) · B (D56 + popup) · C (the fill engine, Workday replica) · D (saved answers) · E (The Table funnel + CSV, migration 135) · F (right-click save, Report this form, the fill places saved answers / EEO decline, the full-URL disclosure, migration 136). Merged at `3682fdc`: **3664 / 3662 / 2** (the expected zip checks); the client builds.
- **D59** run as its own lane; stopped on the owner's restart at `7981546` on `worktree-agent-a240a0b455e2742a2` — branch **3683 / 3681 / 2**; backfill counts, ρ re-measure and browser pass not run (D59 row).
- **The owner's answers** to every lane question recorded in the D64–D69 table; new builds D64 (automated capture — reverses decision A, the held-off auto-start and the LinkedIn/Indeed refusal, with guard rails), D65, D66, D67, D68, D69. The owner's D60–D63 rows (screenshots; extension redesign) committed with this entry.
- **Not pushed** (O82). No servers left running.
### 2026-10-07 (37c) · O80 answered; packets carry a résumé; the D51–D54 browser pass

- **The owner's answers to O80:** no per-company cap; packets must carry a résumé ("that's the whole point"); pre-D53 removals stay unsurfaced; asked what "company collision" meant (answered in chat — D54's one-company-or-two question; the production count stays O80d).
- **O80c** `0dbca51` — `attachPacketResume`: every packet stored without a résumé gets one in the background — a current artifact reused, otherwise the one D17 generation, after the kill switch; linked on the packet (column + body) and the run-job; no second Draft slot; a failure never changes the hold. Found while building: the early holds run before `const toolType` is declared — reading it there would throw (TDZ) and silently lose the packet; they pass `run.tool_type`. +4 tests.
- **The browser pass** (`scripts/d51d54BrowserPass.mjs`): headless Chrome on a throwaway server (a copy of the local DB, a synthetic account, `DAILY_DRAFT_SLOTS=4`, postings at the local fake ATS, every page request off localhost aborted — 6 were), 1280 and 390, dark theme. **Seen:** D51 Draft → Drafted in place, /d 0 → 1, Drafted opens Draft House, out of drafts after 4 with its reason on the button and the toast · D52 every Draft at a stated hold, Fill says how fresh · D53 Clear → the bin → Restore, no overflow at 390 · D54 the confirm at the 2nd, 3rd, 4th OpenAI role, By company "4 roles: 4 in play". No page errors.
- **Caught and fixed** `e18e7dc`: the Draft controls' accessible names said their state twice; The Table's "Pending Apply" read **0** with four Drafts in play (loaded only when opened).
- **Not seen:** O80c's success path in a browser (no tools service locally — the failure path showed as designed) → O81b.
- `npm test` **3495 / 3495 / 0**; the client builds. **Not pushed** (O81a). Servers and the fake ATS stopped.

### 2026-10-07 (37) · The owner's final list — D51, D52, D53, D54 built; the rest already live

- **The list** (D42, D41, D51, D45, D43, D44, D40, D46, D52, D53, D54, D39, D38, D37, D47, D49, D48, D50): fourteen were built and live before this session (sessions 32–36, from `git log`); the four new rows ran in the owner's order, one at a time, in the main tree. The owner's D51–D54 rows were committed first (`86813b8`).
- **Measured on a throwaway server** — a copy of the local DB in the scratchpad, synthetic accounts, every key blanked, every posting URL pointed at the local fake ATS; nothing reached an employer. The copy is from 09-26, so the boot cleanup retired every row; they were re-activated in the copy only.
- **D51** `b6c1d07` — one Draft wrote only `apply_run_jobs`: in Draft House (under Stopped), absent from /d and The Table, its button grey with only a tooltip. Now the record is written in the run-job's own transaction (origin `drafted`) and released on Undo / Stop / line removal. /d's predicate keyed on `uj.user_id`, NULL under the per-profile LEFT JOIN, so a Draft could never reach /d — it keys on the user now. `jobIds:[null]` was admitted as the job "null" and spent a slot — refused. A refused Draft rendered the SUCCESS toast with Undo — it now says why. Drafted ✓ opens Draft House; each refusal (paused · setup · out of drafts, resets in Nh) says its reason, on a press too. Re-measured: /d count 1, The Table in_play, Draft House — within a second.
- **D52** `d55b2e4` — ⛔ **refuted**: one Draft per tier left "queued" within 30 s (greenhouse → awaiting approval; lever, ashby → packet ready; workable → provider_review_only, packet ready). The "~10-minute packet" is the token; the packet goes stale at 72 h, and a stale one had no button to prepare it again — now **Prepare again**, and Fill says how fresh it is; the Draft button states its cost.
- **D53** `a3e1275` — Remove was already a soft hide, but it **cancelled held items** (held_review counts as "pending"), Remove from the line cancelled with no way back, approvals had no Clear, and a removed item's packet stayed fillable. Now one `clearRunJob` everywhere → the bin (migration **130**): Restore exact, Delete now, multi-select, older than 7 / 30 days with a measured count; the sweep is dry-run by default, ceilinged, logged and scheduled; the privacy page and the reconciliation say 7 days. Live on the DB copy: the migration applied; clear → bin → restore, with its packet.
- **D54** `e860854` — keying measured first (local only): no cross-board collisions; `workable:j` held three companies (Workable URLs name no company). One identity (board · domain · name, never merging two known domains; a slug across ATSs only with agreeing names) → The Table **By company**, a confirm before a second Draft at a company, and the company's other applications on a stopped card. Live: rows carry `d:stripe.com`-style keys from the logo store.
- **Not built, for the owner (O80):** a per-company cap (none exists, though D51 and D54 assume one); a résumé for the packet tier (O73b).
- **Found on the way:** Git Bash's `sed -i` strips CRLF — it converted `ApplicationHistory.jsx` to LF (restored before commit). Use the Edit tool or a byte-preserving script.
- `npm test` **3491 / 3491 / 0**; the client builds. **Not pushed** (O80a). The throwaway servers and the fake ATS are stopped.

### 2026-10-07 (36) · D48 live; the Draft button is the logo; Workstyle without a heading

- **D48 pushed by the owner** — `fbbbd86` live (`/api/version` started 17:25:14Z).
- **Owner follow-up** `dd2e500`: *"it should be the logo /draft, reuse the logo here so its orange in dark mode, orange and black in white, just use modularly"* — DraftButton `logo` renders the one StampLogo ("/draft" in A, "/d" in B) on the neutral depth box, so the mark keeps its tokens (D19); measured fills orange + ink light, orange dark. *"its remote/hybrid/onsite and then location if any, no need for a side heading"* — the cell's term is screen-reader only and its value stays on the row's line (0px off).
- `npm test` **3458 / 3458 / 0**; the client builds. **Not pushed** (O79a). The throwaway server is stopped.

### 2026-10-07 (35) · Session 34 pushed; D48 built to its file, and the button sweep

- **Pushed on the owner's go** — `c220a7f` live (`/api/version` started 16:33:11Z; migration 129 and contract 2.2.1 in production).
- **D48** `29358ef` — built to `posting-header2.html` once the owner supplied it, plus the owner's *"the ATS number switches colour"*. The row carries what was measured. Verified in the running app on the throwaway local server (synthetic account; a synthetic résumé seeded so a real score reaches the box and the card), headless Chrome, 1920 / 1280 / 390, both themes; before/after screenshots of 16 surfaces with the pushed tree in a worktree on a second port.
- **Found while building:** the location line lost a specificity fight to `.posting__cell dd` (drew in the 20px value serif); `resumeArtifacts` had been pinning `disabled={!!st}` against a COMMENT since A63; a pill radius inside a style constant ("Continue with Google") that no tag scan sees — the guard now covers `…ButtonStyle` constants; the codemod's whitespace-line cleanup left a lone CR in JobsPanel.jsx (CRLF) — caught by a mixed-ending check before commit, fixed.
- **Token placement:** the header box cannot read the pair's tokens (inkPairD32), so it has `PP_ATS_NUMBER` = PAIR_KICKER; `PP_*` does not travel to the extension (the generator's filter, like PAIR_/FH_), so `extension/` and its submission zip are unchanged.
- `npm test` **3456 / 3456 / 0**; the client builds. **Not pushed** (O79a). Both throwaway servers stopped; the worktree removed.

### 2026-10-07 (34) · The owner's queue — D45, D46, D47, D49, D50 built; D48 blocked on its sketch

- **Queue** (owner): D42, D41, D45, D43, D44, D40, D46, D39, D38, D37, D47, D49, D48, D50. D37–D44 were built and live in session 32 — not redone. The owner's new rows were committed unchanged first (`61870b4`).
- **D45** `1d43506` · **D46** `a64a96d` · **D47** `4e1d4f9` · **D49** `4c43636` · **D50** `cca6c37` — each row carries what was measured. All measured in the running app on the throwaway local server (copy of the local board, synthetic account, keys blanked, employer requests aborted), headless Chrome, both themes where it matters.
- **D48 not built:** `posting-header2.html` is not on this machine; the row says build to the file (O78a).
- **Two premises corrected by measurement:** the board bar did not stick (D49) — so D48's "exactly as the board's bar sticks" now has something true to point at; and D46(b)'s dead /d cards were the pre-A91 raw rows, already fixed in production by A91.
- `npm test` **3447 / 3447 / 0**; the client builds. **Not pushed** (O78b). The throwaway server is stopped.

### 2026-10-06 (33) · Pushed 32; the lag; A91; A92

- **Pushed on the owner's go** — `365c244` live 07:00:47Z, `latestApplied: 129_application_snapshots`, health and /privacy 200.
- **The lag ("on the board rendering in each of the panels or search trigger")** — measured on a throwaway local server (`RM_DATA_DIR` on a copy of the local board, `scraped_at` refreshed so the boot cleanup does not retire it into a live crawl; model / search keys blanked; `COMPANY_LOGOS=off`; a synthetic account). `/api/jobs` 0.05–0.3 s, but **`/api/jobs/facets` 9–10 s**, fetched on every press. Cause: the location clause — 74 options each asking the place predicate (correlated EXISTS) per row, 27.8 s unscoped. Fix: read the board's places once, count all 74 in memory with the same rule (`placeFacetCounts`, held equal to the SQL for every option by test). Search: the tier function's cache hit still copied every description into JS on every pass (93 ms vs 17 ms) — stamp moved into SQL (`octet_length`), description sent only on a miss. **Facets 9.7 s → 0.09 s; search 1.0 s → 0.25 s; in the browser, a press → sentence 72 ms, cards 305 ms.** `d84322d`.
- **A91** `542a641` — /d is `/api/jobs?pending=1`; filters apply; count = list. Verified live on the throwaway server.
- **A92** `dcfbc14` — the browser pass (see the row). One real D39 defect found and fixed (the slide on close), and stale ★ capture copy.
- `npm test` **3434 / 3434 / 0**; the client builds. **Not pushed** (O77). The throwaway server is stopped; its data lives only in the session scratchpad.

### 2026-10-06 (32) · The owner's D37–D44 batch, one at a time, in the owner's order

- **Order** (owner, at the start): D42 → D41 → D43 → D44 → D40 → D39 → D38 → D37; A90 folded into D43. No parallel agents; one commit per task, each gated on a full `npm test` with `ℹ fail 0` and the client build. Final: **3426 / 3426 / 0** on local `main` `b1d0460`, **8 commits ahead of `origin/main` (`5103cf0`), NOT pushed** — pushing deploys (O76a).
- **⛔ Production reads were refused by the permission layer this session** (`railway ssh`, which worked in 31). Not worked around. What it left unverified is named in each D row and collected in **O76(b)**. The owner then also declined a local migrate-and-tag of a DB copy; D42 was measured instead by running the tagger **in memory, read-only**, over the local board (2,616 rows).
- **Two owner calls, in-session (D42):** (1) the domain dial's "all" = **engineering + data** for an engineering profile — the board is not engineering-only (688 engineering, 219 data, 441 sales, 304 product locally); (2) **domain and sector are different tags** — "a finance job at OpenAI is more of a finance job the user cares about than an SDE role at Fidelity": domain stays the sentence's word, the company's sector is a drawer filter, and **"+ add" moves out of the sentence into the panel**.
- **A89 / D44.1** `3eb82f4` — the session-31 privacy corrections committed, after tracing both cover-letter prompts: the page had said "profile details"; they send none. +1 pinning test (field list).
- **D42** `d3e7fd2` — H1 IN, H2 IN, H3 OUT, H4 IN (see the row): the sector tag, the engineering + data scope, non-US no longer "unknown", "Seattle WA", the strict toggle, the split wording, "+ add" into the panel. +8.
- **D41** `9b2fd3a` — ALL admits the user's own rows; a capture no longer stars; /d's hard narrowing gone; stated salary kept (three loss points); capture-time logo; no US evidence → refused with two messages. +10. → **A91** (/d's list).
- **D43** `1c7d7a2` — the deletion cause (the cleanup's starred/applied-only exemption), one user-reference predicate on every delete path, migration **129**, orphans rendered as "posting no longer listed". +4. A90 closed.
- **D40** `384a065` — + is the fourth view, the + square gone, the extension page stops listing captures. +6.
- **D39** `bbc674e` — the swap was focus-ordered slots; rigid `SPATIAL_ORDER` now; backdrop / Escape close the most recently opened. +5.
- **D38** `4c01ea2` — one `CompanyLink`; the stretched anchor was a flex child / a block; four call sites swept, a ratchet on the rest. +3.
- **D37** `b1d0460` — the owner's sentence verbatim; one centred column; a 760px bar ceiling, measured headless on the real CSS at four widths. +3.
- **Not done, and why:** browser checks for D37 themes / D38 hit area / D39 boxes (**A92**, needs a signed-in run) · production reads (**O76b**) · `/d` on the board query (**A91**). ⚠ Four times this session a shell `sed -i` or a whole-file rewrite turned a CRLF file LF; each was caught by `file` and converted back before commit — no source-string test was weakened.

### 2026-10-03 (23) · D10–D14, one after the other, in the main tree

- Run sequentially on the owner's "D10 through 14 one after the other"; one commit each, every commit gated on its own suite run's `ℹ fail 0` with new files staged first. Each D has a guard test, mutation-checked (the injected violation restored from saved bytes), and screenshots on stubbed `/api/*` (`scripts/d10d14Shots.mjs`; the D13 popup via `scripts/d13CompanionShots.mjs`).
- **D10** `93b0e7c` — renames + two-line labels + 74 px bar / 30 px mark; Job Profiles route-only. **D11** `4257a68` — header, `/d` chip, IMPORT + its modal deleted, 3 per row, 50 per page. **D12** `a64f25c` — `/extension`, "+ Add jobs", first-run prompt driven by `GET /api/extension/status`, Saved empty state; store URL null (O55b). **D13** `6531cf9` — the companion popup, `POST /api/import/context`, extension v1.2.0 built (not uploaded), privacy policy + STORE_LISTING updated. **D14** `b4ecf2f` — Stopped | Queued 75 / 25.
- ⚠ **Found and fixed:** D12's `/api/extension/status` first shipped as a router's `"/"` route mounted at a full path, which `authRouteGuardManifest`'s scanner cannot see — so it passed "every /api route is classified" unclassified. Now a plain `app.get` handler, and both new routes are in AUTHENTICATED. (The scanner's blind spot itself is unchanged — any `app.use(<full path>, router)` with a `"/"` route would slip the same way.)
- ⚠ **This file changed under the session**: D13 was rewritten as CHOSEN (concept C) and D15, D16 were added while D10–D12 were being built. D13 was built to the new row; D15 and D16 were not started (outside the request). Statuses here were prepended to a fresh read.
- Production re-read at write time: `/api/version` = `59a4ff2` (22b live). Nothing pushed. `npm test` **3168 / 3168 / 0**.

### 2026-10-03 (22b) · D4 addendum measured, D5 and D6 built in parallel

- **D4 addendum** (owner's live call): §3C rewritten as a deliberate correction; `CORRECTIONS_REGISTER.md` +4 numbers rows, +1 reversal; `LIVE_SEARCH_FINDING.md` addendum (its §2 "defect" corrected — Adzuna left the crawl by decision, `e3935b4`). A read-only agent ran **20 SerpApi searches** (hl/gl set) → `SERPAPI_SLUG_YIELD.md`. `hl=en&gl=us` was already on the one call site; pinned by a test.
- **D5** `4e1ba81` (coordinator, main tree). **D6** `1141ade` (agent, own worktree, `npm ci` — no junctions to the main tree), merged `03b086f` clean. The agent's sandbox could not reach draft-android, so the coordinator applied its one-line patch → `195a10a`. Worktree removed (its only junction was npm's own workspace link, removed first).
- `npm test` **3141 / 3141 / 0** after the merge (+9: serpapiLocale 2, recruiterTabRemoved 2, d6DraftNavLabel 5); client builds. Searches spent today: SerpApi 3 + 20 (24 / 250 incl. the owner's 1), Adzuna 1.

### 2026-10-03 (22) · D3 designed and D4 probed — in parallel, nothing built

- Two agents on the owner's ask, disjoint files, neither touched WORKLOG, D1, D2 or A50. Coordinator folded both in.
- **D3** → `docs/BUG_REPORTING.md` (payload field by field, structural privacy, fingerprint, migration-125 sketch, 20 planted-PII tests, retention). Decisions → **O50**.
- **D4** → `docs/LIVE_SEARCH_FINDING.md`. ⛔ §3C does not work as written: Adzuna 50/50 wrapped, SerpApi 0/20 kept-URL ATS hits. The receiving half of the harvest exists; the input does not. Spent: Adzuna 1, SerpApi 3 (3 / 250 this month). Production reads → **O51**.
- No code changed, so no suite run was needed for correctness; the docs were staged before the suite (guards read tracked files).

### 2026-10-03 (21) · The owner's A71–A79 and the assistant's D1/D2 — all built, A76 half-graded

- **A71** `716281e` — neither a revert nor a broken wire: the A40 breakpoint left 1100–1175px horizontal screens with a lone expanding card. Two panels from 1100 now.
- **A72** `c7eca9d` — search was `LIKE %q%` ("ai" matched 2,525 / 2,616). Ranked whole-word tiers, migration 123 (ai/ml aliases, confirmed), title recall 1.000 on 10 terms through the API. Lifts the role scope while searching (O49a).
- **A73** `13f74b0` — filters were wired; soft-null kept unclassified rows on top (400 of 463 "Remote" rows unclassified) and failed requests were silent. Known matches lead; failures say so. Dead columns: Employment Type, Sponsor-friendly (O49b).
- **A74** `a32579f` — the four removals. **A75** `d3d6e5b` — "ATS match" sort on the board and the deck (contract 1.5.0); the number waits on A76.
- **A76** `1b8359e` — ⏸ **71 / 230 graded, then the API credit ran out (O48)**. Model vs owner on the 30: ρ 0.855 (engine 0.736). Cutpoints unchanged (no held-out gain).
- **A77** `43f24c3` — per-company stored logos with an evidence rule and a three-source fallback; 22 / 22 on the local copy. ⚠ the first live run would have shown ramp.app's logo for Ramp — caught, fixed, tested.
- **D1** `58547af` (closes A78, A79) — bubbles. **D2** `35cc912` — the weave.
- ⚠ **`6eacc07` (A71, A72, migration 123) was pushed by someone else and is LIVE** (04:05Z). Everything after it is local — O49. `npm test` **3132 / 3132 / 0**.
- Throwaway server on a copy of the local board (synthetic user `a72probe`); no production data was read or written.


Newest first. ⛔ Agents append here rather than creating a new file.

### 2026-10-03 (20) · F3, F2, and the PDF product made whole

- **F3:** reproduced on three input shapes — the model's classed HTML kept order; plain text and generic HTML did not. Fixed in both formatter copies (byte-identical parsers), +4 tests each; against the old code 3 of 4 red.
- **The owner's correction mid-session:** Resume Master offers Word, Excel, OCR and flatten-compress; the limits were draft's contract. Built in `src/pdf-toolkit` (office.js for OOXML via fflate; render.js for OCR and flatten), served self-hosted. Caught on the way: pdf.js fills word gaps with whitespace items as wide as the gap (every column joined until skipped); the 10.9 MB legacy language set was served first (corrected to the 2.9 MB LSTM set); tesseract's ESM build has only a default export; my first "scan" fixture was black-on-black (headless Chrome's dark background) and was replaced by a realistic grainy JPEG scan; a new test hung the suite on unread response bodies.
- **F2:** the poll route's dead state removed; the profile-facts log made live (a test had pinned a log line that never ran).
- Suites: Resume Master **299 / 299 / 0**, draft **3092 / 3092 / 0**. Nothing pushed — the owner's go.

### 2026-10-03 (19b) · The owner's answers: look C with a static sky; the PDF tools are Resume Master's alone

- **The PDF tools left draft** (`204a4fe`): the package, `/tools/pdf`, the tools-nav link, the wrapper, its test, and both libraries — `git diff 46597d8^` over the dependency files, `App.jsx` and `ScrollDock.jsx` is empty; 3105 → 3088. Resume Master owns the toolkit as `src/pdf-toolkit` (`c212a04`); the vendoring checksum test went with the copy.
- **A68, look C** (`21c8520`), rebuilt from the 09-21 source, not imitated: the stamp's exact box, border, tilt and type; the old site's own font files (DM Sans, Barlow Condensed incl. 800 italic, Instrument Serif), OFL, self-hosted; the glass bar and cards; the night. **The sky is a generated SVG star field** (seeded PRNG) — the hotlinked video is not used and a test refuses any video or CDN reference. **The accent is one variable**, Lemon until the owner picks from the four the old site offered.
- **A69's product pages:** `/pdf/` and ten pages named for what people search (merge, compress, split, organize, watermark, protect, unlock, JPG→PDF, PDF→JPG, PDF→text), each opening its own tool; sitemap, robots (the site in, `/v1/` and `/mcp` out), a stamp favicon. Every tool re-run end to end on `/pdf/merge-pdf/`: zero request bodies.
- Shared header/footer generated into every page; a phone gets a Menu; the home page follows `/#tool` and `/#dialog`. Looked at: home, hub, a tool page and privacy at 1440 and 390 — no error, no failed or third-party request, no overflow. Injected: a video, an untilted stamp, a hand-edited generated page, a second accent — each red. Commits gated on the run's own fail count, files staged first.

### 2026-10-03 (19) · A68–A70: the old look found (owner's call), the PDF toolkit, PDF → text free

Sequential, main trees. draft **3105 / 3105 / 0**; Resume Master **285 / 285 / 0**. The owner pushed session 18 (`cf051df` live). Committed the owner's A68–A70 rows as written (`401abbd`), then the F## rule into CLAUDE.md + the header, A66/A67 → F1/F2 (`532f726`).

- **A70 first** (it sits in front of A69): the site's PDF → text was a Sonnet document call at 1 credit — case (a). Built the deterministic reader on pdf.js and made the site route free/anonymous with a daily ceiling; the token API left on the model (O16e). Measured on Chrome-printed PDFs; the one oddity (a later role's header above an earlier role's bullets) is the FORMATTER's own output → **F3**. Injected: no column split, no OCR flag, the cost entry back — each red; the two column guards cover each other (both off: red).
- **A69:** `packages/pdf-toolkit` in draft, vendored into Resume Master (A65's pattern); A70's reader moved into it so server and browser share the file. Verified before building on it: @cantoo/pdf-lib encrypts (AES-256), refuses a wrong password, and decrypts to a file with no `/Encrypt`. A correctness catch while writing compress: a canvas only re-encodes RGB, so CMYK/grey pictures are left alone (tested). End to end on BOTH built sites in Chrome: every tool, no page error, no overflow at 390, **zero request bodies**. Found and fixed on the way: a missing `/lib/…` file answered 500 (now the JSON 404); the contract's route table rejected `/lib` as routes (now static middleware); the lede and the component repeated the promise (now once).
- **A68 — stopped at the checkpoint, as the row asks.** Rebuilt three eras from history with `git archive` exports (no worktrees, no junctions), served and shot them. The white boxed logo is `StampLogo` (C, 05-30 → 09-22). Two owner questions in the row: the hotlinked third-party video and the random accent.
- ⛔ **Self-inflicted, fixed before any push:** `46597d8` (and the WORKLOG commit after it) went in with `brandAndOriginGuard` RED — seven new A69 files named the tools service by its legacy name in comments. The pre-commit run was green because the guard reads TRACKED files and they were untracked: the `552e45b` trap again. Fixed in `424c792` (re-vendored `ce2ecf8`); commits are now gated on the run's own fail count.
- ⚠ **Resume Master's next push is its first with the PDF libraries.** No Docker here; the only native piece is pdf.js's optional `@napi-rs/canvas` (prebuilt linux-x64). Read the deploy.

### 2026-10-02 (18) · The 17e pushes confirmed live; the follow-ups the agent could do

Run sequentially in the main trees. draft **3088 / 3088 / 0**; draft-android JVM **58 / 58 / 0**. Every change: tests, an injected violation seen red, full suite, client build; UI looked at in a real browser.

- **Live, re-measured 20:52Z:** draft `5282972` (contract 1.3.0, 128 applied); Resume Master `6415646`, `accounts: true` — A65's store is on. The repo is private (API 404). **6 draft commits are local** — the owner's go pushes them.
- **A58 follow-up (`d02c5fc`):** `scrapeJobs` + `scrapeHarvestAPI` + their helpers and imports deleted (−622 lines of `server.js`, byte-preserving, CRLF kept). ⛔ It could not have run: `ApifyClient` was never imported. Ten test files quoted its source; each narrowed to what still exists, two became absence guards (seen red with the code put back), two removed with a note. Found → **A66**, **A67**; `apify-client` has no importer.
- **A62 follow-up (`c4584e0`):** a capture the US gate held is `is_active = 0` like an expired listing, so Saved said NO LONGER LISTED. Now `held_outside_us` (the gate's own `out_of_market:` record) → `Job.heldOutsideUs` → OUTSIDE THE US. Contract **1.3.0 → 1.4.0**, additive, `contract/` regenerated; HANDOFF says so.
- ⛔ **`npm test` was writing fake "spend not recorded" into the developer's real sink (`781b822`).** Found booting a throwaway server: a fresh DB came up with `recovered=6863`. `trackingFailureSink` ignored `RM_DATA_DIR` and tests fail usage writes on purpose — one run appended 109 lines; a local boot then imported them as `sink_recovered` failures. All 6,863 were fixtures; nothing real lost; production unaffected (it never runs tests). Fixed: a `--import` preload gives each test process a temp sink; the sink follows `RM_DATA_DIR`. ⚠ The throwaway boot DRAINED the developer's `data/usage-tracking-failures.jsonl` into the throwaway DB (job scratchpad) — that file is gone from `data/`; its contents were the fixtures above.
- **Admin, first look in a browser (A50/A61):** the real server on a throwaway DB (`RM_DATA_DIR`, every paid key blanked; it crawled the public ATS boards on boot — free), a synthetic admin, every tab at 1440 light/dark + 390 → `draft-screenshots/s18-admin`. No page errors, no failed call. Fixed `lastRun: [object Object]` + the panel pinned left (`fbc2216`) and Pipeline Health labelling held/inactive rows UNENRICHED (`52ac439` — first committed with two fixture tests red and "suite green" in the message; caught on the next run, fixed and the local commit amended before anything was pushed).
- **A33 in a browser (`cb7001d`):** synthetic person, Profile › Fill from your résumé: the common one-line education entry put the degree in University and "Texas at Austin" in Field. Fixed by reading each field from its own part of the line; six shapes pinned.
- **draft-android (`c8aaea4`, local):** a refused swipe takes its optimistic badge down (A14's last item).
- **Not done, and why:** A35 (extension revamp) stays held — its row ties it to A36 for one store submission, A36 waits on O12, and the store screenshots need the owner's real profile. K3 stays held (17b). The rest is owner-gated as listed in NOW (17b).

### 2026-10-02 (17e) · A65 — Resume Master's store switched on, with draft's backup policy

- **One policy, not two.** draft's `scripts/backup.js` moved unchanged into `packages/sqlite-backup` (`@draft/sqlite-backup`), its paths set by `configureBackups({ dataDir, dbFile, filePrefix })`; `scripts/backup.js` is now a wrapper that points it at `data/` and keeps the CLI. Resume Master vendors a checksummed copy (`vendor/sqlite-backup`), as it does the scorer. draft's behaviour unchanged: the backup tests read the package source. ⚠ `bce8e3b` named the legacy brand in the package prose and went in with `brandAndOriginGuard` red — fixed in `f487302`.
- **Resume Master:** the store opens at `RAILWAY_VOLUME_MOUNT_PATH/resume-master.db` (`RM_DB_PATH` still overrides). With a store: the hourly purge, and a backup daily at 02:00 UTC — ⛔ never at boot. Admin `GET/POST /v1/site/admin/backups`; `scripts/backup.mjs list|verify|create|restore` (restore takes a pre-restore copy). The migrations table is now `schema_migrations`, the table the policy's verify reads.
- **Pinning vs the 90-day expiry (the owner's "decide"):** decided — a pinned document is kept until unpinned or deleted, at most 20 per user; unpinning restarts its 90 days (an unpin never silently deletes). Migration `004_artifact_pins`; `POST /v1/site/documents/:id/pin`; the account page has Pin/Unpin.
- **Space:** stored documents are text/HTML (a PDF is printed by the browser, never stored), 2 MB each, 200 per user; a save is REFUSED (`storage_full`) when the volume would drop below max(64 MB, 15 %), so the database and its backups keep room. The site says why a save was refused.
- **PRIVACY.md:** pins, and backups stated honestly — a deleted document can remain inside a backup copy until it rotates out (≤ 30 copies).
- Tests: Resume Master **260 / 260 / 0** (+9 `storeA65`, incl. the vendored checksums); draft **3081 / 3081 / 0**.
- ⛔ **Not deployed by this entry's commits alone:** pushing Resume Master is the first boot with the store on the `resume-master-data` volume — user data starts to exist from then, and `/v1/site/config` reads `accounts: true`.

### 2026-10-02 (17d) · A64 — the company stack registry audited; both repos pushed and live

- ⛔ **Premise corrected first:** the header said the registry is "used by classifier.js and the generation model to enforce company authenticity". Nothing does. Its one reader is `@draft/ats-scorer` (vocabulary.js → scorer.js `candidateTermsFromJob`), which admits a company's stack term as a skill only when that company's own posting names it and the ambiguity guard passes. Measured: 288 of 565 stack terms add anything beyond the global vocabulary; Stripe, Airbnb and Spotify are the only registry companies on the local board, and 5 of their marginal terms ever matched. `notStack` had no reader.
- **Stripe** said GCP/Pub/Sub/BigQuery/GKE/Dataflow with notStack "AWS Lambda": AWS's own case study and engineering blog describe Stripe on AWS; Stripe writes mostly Ruby (Sorbet), with Java and Go. Corrected with sources. Airbnb and Spotify sourced; unsupported terms dropped. `notStack` removed everywhere. `scripts/a64RegistryAudit.mjs` applies it; `registry/` mirror synced; checksums rewritten; Resume Master re-vendored. ρ unchanged (0.746).
- The owner's storage-and-backup note (committed `b338453`) had landed inside the A57 row and split it; the row is rejoined and the note sits, unchanged, under that table, with its status: volumes renamed/created (owner) → **A65**.

### 2026-10-02 (17) · The "next session" list, in order — A59 → A63 → A61 → A62 → A54–A57 → A53/A52 follow-ups → A50 4–7

Run sequentially in the main trees (no parallel agents). draft **3072 / 3072 / 0**; Resume Master **250 / 250 / 0**. Every task: tests with injected violations, full suite, client build; UI looked at in a real browser where a fixture exists.

⚠ **Production moved under the session:** `origin/main` became `a509d6f` (A59–A62, migrations 120–122) — **the agent ran no push**; `/api/version` 18:23Z confirms it live and healthy, new routes gated. 8 later commits are local. Resume Master is NOT pushed.

#### A59 · The line (`e47fb7a`)
- A run over `APPLY_MAX_ACTIVE_RUNS_PER_USER` is admitted `waiting` with a `line_position`; it also waits behind a non-empty line (nothing jumps). Every other admission check runs at Draft time. `dispatchLine` starts the head only (synchronous claim), from `processRun`'s finally and a 30 s unref'd ticker.
- Editable until it starts: tool (A+ gated; an approved run is locked), whole-order reorder (stale → 409), remove a run or one job; after start → 409 `run_started`. Undo on a waiting Draft cancels the run.
- ⛔ Kill switch holds the line. Boot: `recoverInterruptedRuns` — a `running` job becomes failed/`interrupted_by_restart` (honest about whether it could have submitted), never-started jobs resume, lines move.
- The twelve `scripts/` harnesses gained `line_position` (harnessSchemaCoverage). Auto Apply "Waiting in line"; toast "waits in line (2 of 3)".

#### A63 · Board tools reshaped (`0bf0ad6`)
- ⛔ **Found:** the board's Apply POSTed `/api/apply` with `mode:"semi"`, which the route ignored — it recorded the job as APPLIED on the click; nothing opened. Exporting a PDF did the same via `/api/applications`. And the automation's real submits never wrote `job_applications` at all (why A47's path "never fired").
- (1) company name = apply link; KB on the logo. (2) `services/draftSlots.js`: one 10/24 h allowance for Drafts and NEW résumés, refused at zero, shown before pressing — ⚠ **O46**. (3) `application_records`: pending (generated / opened / exported / manual) → recorded → **verified** (statement + plausible date + one piece of evidence matching THIS employer) → `job_applications`; the pipeline's verified submits go the same way. It proves the statement and the evidence's match, not receipt — the UI says so. Database "Pending Apply" is the table.

#### A61 (`e57f356`) · A62 (`a509d6f`)
- A61: Operations-tab enrichment card; confirm states cost ceiling, 100/request cap and the nightly budget (a manual run is NOT counted against it).
- A62: `ingestJob` is the one gateway (dedup + canonical write + US gate + `job_captures` with ATS slug); admin NDJSON export/import, dry by default, revertible batches.

#### Resume Master — A57 (`3e48123`), A54 (`5ab72ff`), A55 (`40614e4`) — LOCAL
- A57: store optional (`RM_DB_PATH`), accounts, ledger with economics blank, debit on success, opt-in output storage 90 days; token API untouched and proven so.
- A54: the site at `/` (old cinematic look, self-hosted fonts, no third-party request), four complete tool flows + account; privacy page renders `docs/PRIVACY.md`. Shots: `draft-screenshots/a54-rm-site`.
- A55: outsider walk; legible errors; limits policy (off). ⛔ The token policy (O16c) is the real blocker.

#### Follow-ups
- A53 (`1289e05`): font tokens truthful (DM Sans), Inter import dropped; FAQ/features vocabulary; the avatar-over-tabs defect at 390.
- A52 (`6b16bd9`): rescore on enrichment; no stale stamp at apply (a missing posting still stamps); experience summary once; ScrollDock clearance.
- A50 4–7: company list (probe → add, harvest suggestions, audit log), Job Trace lifecycle, restyle (bands, not the v3 70/50 ramp), tools-service card. ⛔ `552e45b` was committed with brandAndOriginGuard red (the legacy name in the admin card) — fixed in `6a61fc5`; the full suite is now run before every commit.
- `CORRECTIONS_REGISTER.md` gains "Decisions deliberately reversed" (A57, A54, A59, A63).
- ⚠ Self-inflicted, repaired: a mutation check restored `routes/enrichment.js` with `git checkout`, discarding the uncommitted A61 edit; re-applied before commit.

### 2026-10-02 (16) · A49, A50, A52 merged and pushed; A53 and A58 parked on branches

Run IN PARALLEL on the owner's ask, one worktree per agent (own ports, own migration number, real `npm install`,
no junctions), no agent editing this file. Three agents hit the session limit mid-flight; their uncommitted work was
backed up and each was resumed from its transcript. **`main` = 2987 / 2987 / 0.** The owner ended the session after
the push: A53 and A58 stay on their branches.

**Premises corrected at the start:** A51 (`c9ea3f2`) and the session-15 docs were ALREADY pushed — `origin/main` and
production were `5b45130` (`/api/version`, started 04:29Z). The repo read public on one unauthenticated call and 404
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
  Save and Pass **set, never toggle** · **Undo like the deck's** (shared `DecisionToast`). Built in `d81b2bf`
  (`lib/jobDecisions.js` = the one set of calls), 2950 green on the branch. **Bug fixed:** a draft awaiting review could
  be drafted again (another preview run each time).
- **Why it is not merged:** a second Draft while a run is active is 429 (O44) — the board now reaches it too. The styling
  sweep (`bcec9fc`: `type.js`, `.rm-btn` → the deck's pill — restyles the admin pages too — glass sheets off, a 390px
  card-grid overflow fixed) is WIP; full suite not re-run, ~8 of 56 after-shots looked at.
- Also: the signed-in app renders DM Sans, not Inter (`cinematic.js` overrides `index.css`) — left alone.

#### A58 · Admin stop-the-harm II — merged in 16b (see the queue row)

#### 16b · "Push everything to main"
- A58 merged (`e045685`; 116/118/119 kept in order in both runners, CRLF preserved; ARCHITECTURE/HANDOFF counts → 119), A53 merged cleanly. First full run **3022 / 3025** — three integration failures, none a logic defect: an admin fixture without 119's table and columns, a privacy-doc citation of the removed force-scrape (Apify is now reached by NO code path), and bare-`indexOf` anchors in the new tests. Fixed in `db5fa5f`; **3025 / 3025 / 0**, build clean.
- The earlier refusal to push the two branches is moot: they are on `main`.

#### Coordinator
- **The two known flakes fixed at their cause** (`a96ae88`): `sealedSessionSweep` removed its temp dir before
  node-sqlite3's ASYNC close finished (Windows EPERM) — the hook now awaits it, 8/8; `accountSecurity` refused a bare
  `42`, which random ciphertext contains ~1.7% of the time — now `"user":42`.
- **A50 × A52 integration:** A50's board-fit dry-run fixture predated `job_hash` (SQLITE_ERROR after the merge) — the fixture now carries the posting columns and the real hash (`7a9791a`); both assertions unchanged.
- Merge conflicts: 116 and 118 added at the same spot in both runners — resolved byte-preserving (CRLF kept); the
  ARCHITECTURE count of defined migrations → 118.
- The owner's session left A54–A57 and a `PRODUCT_MODEL.md` reversal uncommitted in the main tree; backed up, kept, and
  committed with this entry.


### 2026-10-02 (15) · A51 — the admin inspector stops doing harm (`c9ea3f2`)

The A51 agent hit the session limit mid-wiring (`services/adminSafety.js` written, routes half-wired, UI and
tests untouched). The coordinator audited what it left, finished it and verified it. Local; not pushed.

- **Clean Pool REMOVED** — route and button. Built 04-15 (`2df26cd`) when `user_jobs` was a per-user scraped
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

### 2026-10-02 (14) · A40 rebuilt as TWO equal panels; A44 merged (`63f7f82`)

⛔ What shipped in `5935ba5` / `043acf1` (ATS │ card │ posting, the posting moved OUT of the card) was not the
design. Rebuilt to `BRAND_OUTLAY_AND_MOTION.md` §"THE EXPANDED CARD — DECIDED": **two equal panels**, the FULL
ATS report left, the posting INSIDE the card growing down, one clock, no stagger, a `0fr → 1fr` grid; a sheet on
a phone, swipe off while expanded. **`npm test` 2929 / 2929 / 0** on `main` after the A44 merge. ⛔ Not pushed.

- **Server + contract (`3afbbe5`):** `deckReport()` in `services/dailyDraft.js` freezes the FULL report with each
  card — skills, competencies and verbs matched/missing, generic language, experience fit, profile facts
  missing, decline reasons, the seniority note, résumé depth — as a WHITELIST, so no number can leak in; a
  declined report stays `scorable: false`. `whyFromReport` gains `missingTotal` (the "13 of 14 matched" line).
  A card frozen BEFORE this reads back `report: null` and says the full report is on the board. ⚠ **Mobile
  contract 1.2.0 → 1.3.0** (additive: `DeckCard.report`, `DeckWhy.missingTotal`) — Android vendors 1.2.0.
- **Client (`a9ab8c4`):** the report column grows `0fr → 1fr` and pushes the card's column; the fan and the action
  row ride with it. The card is ONE column wide at rest and open (692 | 692 at 1440, 612 | 612 at 1280), so it
  never resizes on click. One `--deck-t` (1.1 s) / `--deck-ease` drives the grid, the signal line and the
  posting; reduced motion → 0 s. Left panel = the board's own `ATSPanel` with the card's band, never a number;
  a declined report reads "Not enough signal". Below **1176px** the vertical fan stays and the signal line opens
  the report as a SHEET. Swipe disabled while expanded (pinned). A39's sticky Collapse kept; hidden content inert.
- **Premises corrected while looking:** the fan's ease-out had the move 97% done at 550 ms (fast, then waiting)
  → an even ease-in-out; `marginLeft: auto` made the report wipe in from the screen edge → pinned to the card's
  side so it emerges from behind the card; the 700px rest card → one column wide.
- **Tests:** `deckExpandedFlank.test.js` deleted (it pinned the wrong three-column design) — ⚠ the deletion rode
  in the coordinator's WORKLOG commit `ad8a604` because it was already staged. Replaced by
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
read-only. A46 shipped first (`d755587`, pushed, live — "Not connected" in bundle `index-x_OHwg4X.js`).
⭐ **`/api/version` reports `latestApplied: 114_users_deck_geometry`** (121 applied, commit `d755587`) — the
deployed commit and migration state no longer need a boot log.

#### A44 · Pipeline Health — liveness, not cadence (`7075b48`, `5c4ec66`; NOT merged — after A40)
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
· **C** row 34 read-only. No agent edited this file. Merged `1046be9`; **`npm test` 2912 / 2912 / 0** on
`main`. ⛔ Nothing pushed. Screenshots: `draft-screenshots/expand-flank/`, `collapse-top/`, `deck-layout/`
(1440/1280/820/390 × light/dark × full/reduced, + videos at all four widths in both motion settings).

#### 40 · ATS │ card │ posting (`5935ba5`, fix `043acf1`)
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

#### 39 · Collapse (`56ef074`)
"Collapse" — one word — at the top of an expanded card as well as the bottom; the top one sticks just under the
top bar at its measured height. The bottom label and the legend's Esc line say "Collapse" too.

#### 38 · Deck layout as a user control (`18a4d69`)
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

#### 37 · The board admits only postings with positive US evidence (`ea51450`, merged `1046be9`)
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
  the landing page I shipped in `a085d09` — is false today (CURRENT STATE · Fabrication). /features says what
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
(`0a4b9ef`, 09-30 20:08) was built **after** 2b (`052a43f`, 09-30 00:30) and reads every colour from
`colorTokens.js`; its own screenshots (`draft-screenshots/deck/`) are cream. Dark mode (`84e93be`, step 6)
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
| 21 G3 | ✅ local — tests asserted narrower than the behaviour; the model's real shape dropped every date and printed the role twice; fixed in the classifier | RM `6ec0dd3` · draft `0ae9801` |
| 22 G6 | ✅ local — 11 verbs to generic; verb-evidenced competencies off the missing list; cached reports re-keyed; ρ 0.746 unchanged. Two score-moving fixes → OWNER 31 | draft `b795abb` · RM `661b758` |
| 23 K1 | ✅ local, DECOUPLED — `--verify` passes both directions on the real KB | draft `6fa0647` |
| 24 R1 | ✅ local — measured first; discriminates; no public route | draft `15d348b` |
| 25 | ✅ measured, nothing built — route → OWNER 32 | draft `679c39f` |
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

- **Foundations, `2e30cf8`:** sessions SEALED at rest (`EncryptedSessionStore`, AES-256-GCM, key
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

- **Deploy `8c4e5c9` checked**: migration 111 applied, contract 1.2.0, clean boot. The owner's Google
  sign-in **works** — the integration row written, its token sealed by the key — but created a NEW,
  empty account (user 10), and Today answered "could not be dealt. no_active_profile". Fixed in
  `2def64c` (deployed): no profile / no résumé are set-up states with a way forward, on web and Android.
- **The mark** (`9a0179e`, android `ef2bae4`): "/draft" and "/d" cut from the owner's artwork (the
  orange keyed out, the glyphs separated as connected shapes so the italic slash and the d part
  cleanly), the same vertical crop for both so the condensed mark sits exactly on the expanded one;
  StampLogo renders them; favicons (there were none); the Android launcher icon (it was the template
  robot). Seen on the landing page, Today, light and dark, and the emulator's app drawer.
- **Account theme** (`322ea41`): migration 112, the preference follows the account.
- **Android's look** (android `d2f0e3a`): web tokens, theme-aware; the web's leather tile; glass
  cards — found on the emulator that see-through cards showed the NEXT card's text, so the cards
  behind are blank slabs now, as on the web.

**Measured:** draft 2779/2779/0 run alone; android 58/58 JVM, 15/15 instrumented.


### 2026-09-30 (3) · The redesign built: crisp leather, lit glass, Today's draft, Android on the deck, dark mode

The owner confirmed the deck proposals and found the board "mundane … like 2012"; wanted bench C's
crisp leather and more gloss. Done in that order, each slice tested, screenshotted and committed:

- **Grain + glass** (`e3f21f0`): bench C needs a 12% shadow, past the old floor — so the FLOOR token
  moved and every pair was re-proved (one moved). A lit glass material. Two causes of the flat look
  found: a grey static overlay on every card, and the board sitting on `theme.bg` — which is the
  GLASS token, a 58% cream sheet over the leather.
- **The deal** (`2ffad4a`): the 690-line `/api/jobs` handler became `boardPageResponse`, so the deck
  deals from the board's own query. Migration 111 stores the deal, not the decisions.
- **The API** (`d7e52a7` `16aea18`): `/api/draft/today`, contract 1.2.0, the deck surface refuses
  any `approvalMode` (tested in-process for every value), frozen evidence per card.
- **The deck** (`0a4b9ef`): Today's draft. Keys, web swipe with a following, tilting card and
  stamps, a visible stack, fly-outs, the slash as progress, every state; a pure reducer proves no
  animation gates input and a refused call is never a success.
- **Android** (draft-android `f7fdc2c`): the same deal; right drafts ON THE SERVER (it never reached
  one before); two gestures. Found on the way: the deck's null score would have shown every card as
  "Not enough signal" — the dealt band is carried instead.
- **Dark mode** (`84e93be`): both palettes proved; it found a real avatar failure the light theme
  could not; the leather's floor inverts in dark and is tested for both.

**Measured:** draft 2777/2777/0 run alone; client build OK; android 58/58 JVM + 15/15 instrumented.
Screenshots: `draft-screenshots\` (`deck`, `dark`, `gloss`, `grain`, `android`). Nothing pushed — the
approved push was blocked by the session's permission guard (OWNER 7c).


### 2026-09-30 (2) · Pushed; backups listed and a retention bug found; public ATS on the v4 scorer; leather grain; steps 3–6 designed

**Push** (owner's go, key set first): `e29bc83..eaa2537`, live 20:18Z. Boot log: secret key
configured, migration 110 applied, the fit backfill scored 2,688 jobs in 35 s with 0 failures.

**Backups, listed over SSH** (owner-granted): 26 files, 350 MB; volume 392/879 MB. ⛔ **Nothing from
09-17 to 09-29 survives.** The manifest is correctly newest-first; the defect is `selectRetained`,
which `continue`d past a backup that did not fit the byte budget and kept going — so as the DB grew
(14 → 28 MB) every recent backup was the misfit and every small August one was kept. Fixed
(`81a5483`): past the protected head, retention keeps a contiguous newest run. The uniform-size
tests could not see it; the new one uses production's shape and fails on the old code. Prune list →
OWNER 9. (The manifest came back empty through a shell redirect — Railway's SSH writes to the TTY —
so it was printed in place.)

**G1 answered** — see the G1 section: both fabrications were GENERATE, not A+. AF5 unblocked by
the owner, on supervision.

**Public ATS tool** (`56dc1ab`): the Haiku call and its donut are gone; the v4 scorer with the
panel's weights and synonyms, answering with a band and evidence and no number; no rate limit.
Found: draft's scorer wrapper defaulted the profiles to `null`, crashing any caller without a basis
(the public tool is the first); and the thin-résumé note would have fired for EVERY anonymous
visitor (its `few_skills` arm counts profile skills). The upsell promised "hit every missing
keyword" — G1's fabrication as a feature — and now says "from what you have actually done". Checked
end to end in a browser against the real result shape.

**Grain** (`79be625`): measured before choosing — the old grain's luminance sd was 0.95 (flat).
A bench of six rendered side by side; 0.28 × 2 octaves with a white sheen layer (the contrast floor
caps the shadow, not the light). sd 3.6, darkest pixel still above `CANVAS_SHADE`, and the floor is
now a test (seen to fail at a stronger setting). ⚠ The first bench measured every cell as flat — the
bench was broken (a `url("…")` inside a double-quoted style attribute), not the grain. Screenshots
moved to `C:\Users\duggi\WebstormProjects\draft-screenshots\` — the owner could not find the scratchpad.

**Design** (`cc0a4e9`): steps 3–6 in full — see `UI_REDESIGN.md`. One claim verified before being
written (a Draft costs nothing: AL2 defers generation to approval, except for a profile with
`generate_at_queue` on). One finding on the way: Android's right swipe queues NOTHING on any server
while its badge said "Queued for review" — the badge now says what is true (draft-android
`ce213f3`); 2c revised to the deck.

**Measured:** draft 2753/2753/0 run alone; client build OK; android compile + 55/55 JVM.


### 2026-09-30 · Three dead agents audited; UI 2b, Android 14 done; OAuth sign-in found broken in production

**The audit, before anything resumed.** The session limit killed "UI step 2b", "Rank the board by
fit" and "Fix Android open UI defects" mid-flight. What each left:

- **Fit ranking** had FINISHED — merged `60a668d` (2738/2738) and recorded before the limit. Nothing
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
   log. The `.dockerignore` concern is **closed, and moot rather than fixed**: `dff775e` moved the
   registries out of `data/`, so neither `.dockerignore`'s `data/` rule nor the volume mounted on
   `/app/data` can hide them now; the boot line on `e29bc83` is the proof. (A local read of
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
   this session — but the path has no branch around it. **Fixed in `041d4c2`**: `services/secretBox.js`
   owns key + box + helper, both modules import it, production refuses to boot without a valid
   64-hex key, dev gets a per-boot key and says so. 7 tests, seen to fail on HEAD. → OWNER 20, 7b.
   Also found: `ADMIN_PASSWORD` falls back to `changeme` at the first seed → OWNER 21a.
3. SSH key: the Railway CLI works (`npx @railway/cli`) — logs read. `railway ssh` to list the volume
   was refused by the session's permission guard, and not retried.
4. Phase A+B closed. 5. Noted.

**Owner decisions applied.** Login line: removed in `bb734b3` (before the limit). The **sweep** was
not done then; done now (`3221e8d`): all tier copy was already gated on the lever EXCEPT
FeaturesPage's metered "1 free score / month…" lines (numbers kept — the server enforces them) and
JobsPanel's "one-time free enhancement". Also found: ApplyToolPage said resume generation needs no
account — false since the spend controls. Grain: untouched.

**UI 2b** — `052a43f`. 549 literals by AST position (`@babel/parser`), the token chosen by the CSS
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
- **3, 4** were already committed by the previous session (`b346e6c`, `dff775e`) and still listed
  as open — the reconciliation caught it.
- **5 · DONE reconciled** against all four repos' logs (by a sub-agent, read-only; merged here):
  15 corrected, 1 removed, 5 flagged, 46 added, every row now carries hashes. The ones that matter:
  - ⛔ **The iOS work is not on iOS `main`.** `aad5a3a` and the P3 rebrand sweep sit on the
    unmerged `feat/api-layer-feed-review-queue`; `main` is `f8be63c` (05-09). "The rebrand covered
    three repos" is only true on that branch → OWNER 10
  - A1's "⚠ Unpushed" was stale — `d34d95e` is deployed. B step 4's "certificate waits on the DNS
    edit" was never true. The CC "still true" row was outdated (`7f458d4`: rank keys apply, ~700
    rows tie). "79 files across three repos" is 84 by git
  - CURRENT STATE's Resume Master row contradicted itself ("still points at draft") — removed
  - Extension version history is non-monotonic: 1.2.0 (`b3a00c8`) → 1.3.0 listing (`90a4a4c`) →
    back to 1.0.0 (`d11b185`) before 1.1.0/1.1.1. Recorded, not changed
- **8(a) · backup policy fixed** (`d8af703`) — budget from the volume, a disk ceiling that MIN_KEEP
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
  either address… both reach the same servers"). Rewritten and deployed in the same window (`356775e`)
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
restarted once — on the push of A1…A4 (`55386fa`). Boot: `tools service client: configured`. The
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

### 2026-09-28 · A4 — draft calls the tools service (`42b8675` draft · `1fbb9bb` resume-master)

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

Measured, not carried: production `/api/version` → commit `2365599`, contract 1.1.1, 116
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

**Icons (`e9e0535`, draft).** ⛔ The committed icons — so every icon in the v1.1.0 package in review —
were the old **"RM"** mark. Two uncommitted sets differed: the wordmark set's 16px was a bare slash;
the `/d` set was consistent. Shipped `/d`. The manifest had had **no top-level `icons` key since
ee2c3b0 (05-08)** — added. v1.1.1 because the listing's own checklist says the store refuses an
upload at or below the version in review. `publishExtension --dry-run` preflight OK; suite 2696/0.

### 2026-09-27 · A2 complete (`5112249` resume-master · `2653c2c` draft)

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

### 2026-09-27 · A1 — `@draft/ats-scorer` (`d34d95e`, `b0b03f5`)

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


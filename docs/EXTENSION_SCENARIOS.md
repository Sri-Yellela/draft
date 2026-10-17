# Extension scenarios — the T10 upload gate

**What this is.** The scenario matrix the owner set on 10-14 (WORKLOG **T10 · THE UPLOAD GATE**: *"not uploading until it
works as intended on all fronts, in all possible scenarios"*). **v1.5.2 is not uploaded until every row passes** — each
row needs an expected result, an automated test (a fixture, in a real Chrome) **and the owner's walk**.

**Where the rows come from — quoted, not invented.** Rows (1)–(30) are the WORKLOG's **T10 · THE UPLOAD GATE** entry;
(31)–(37) are **"T10 additions — scenario rows (the upload gate)"**; (38)–(42) are **"T10 additions — more scenario
rows"** (added after the 43k merges: T17 dock, T18 + T23, T20). Each row's wording below is the WORKLOG's own. A new
row is added to the WORKLOG first, then here, with the same number. `test/t10ScenarioRows.test.js` fails if a number
1–42 is missing from this table or appears twice.

**Measured** 2026-10-15 on local `main` `9f3864c` (43k: binding-first, T9, D97R + T12, T17 dock, T22 launcher,
T18 + T23, T20; then T25 + T21, T24 (migration 168) and the live-markup lane — `test/liveFormMarkup.test.js`,
`docs/LIVE_FORM_MEASUREMENT.md`, the Greenhouse fixture rewritten to measured markup). First mapped on `7e9c0c1`,
re-checked after that merge. See *Test runs* at the end. **Updated 2026-10-17** (open items 4 and 5): rows 5, 6, 7, 12, 13, 17, 34
and 39 → COVERED, rows 16, 18 and 19 gained tests and stay PARTIAL — each row's cell says what was added.

**Live forms.** `docs/LIVE_FORM_MEASUREMENT.md` ran the extension's own probe and classifier, read-only, on six live
forms (Stripe's embedded Greenhouse, two Greenhouse boards, Lever, Ashby, Workable): structure only, nothing typed or
attached. `test/liveFormMarkup.test.js` reproduces those structures in miniature with synthetic words. **That is reading,
not filling: no automated test fills, attaches to or walks a LIVE form** — that stays the owner's walk.

## How to read the status

| Status | Meaning |
|---|---|
| **COVERED** | The row's expected behaviour is asserted by an automated test, and the user-facing part runs in a **real Chrome** with the real extension loaded against draft's fixtures. Fixtures are synthetic (Ada Example, `example.test`) and stand in for the live sites — the live site is the owner's walk. |
| **PARTIAL** | Some of the row is tested, but part is only unit-tested against stubs (`chrome.*` stubs, a stubbed tools service, a stubbed `window`), or part of the row has no test. The cell says which part. |
| **NOT COVERED** | No test asserts the row's behaviour. |

"Real Chrome" means a test that launches Chrome with the unpacked extension (`test-support/extensionBrowser.mjs`;
walks in `test-support/walks/*.mjs`, run by `test-support/walkExtension.mjs`). It **SKIPS with its reason** on a
machine with no Chrome. **Headless Chrome cannot answer Chrome's real permission prompt** — every walk stands the
grant in by listing the hosts in the test build's `host_permissions`. The real prompt was walked only by
`scripts/t20RealPromptWalk.mjs card|always|deny` (Windows, headed, **not part of `npm test`**), which passed all three
after T20's fix (WORKLOG 43k).

**Owner's production walk** is **"not yet"** on every row. T8 stands: *nothing is "complete" until the owner's walk
passes on production with the real Stripe job and the Zoom Workday flow.*

## The matrix

### Identification

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 1 | opened from the board by the bridge | `d99Bridge` › "⛔ J11 walk: a trusted click opens the SERVER's address bound 'via board'; no click, nothing; not on the board → the page's link — in a real Chrome" (`walks/boardBridge.mjs` §1–4); `d99Bridge` › "⛔ OPEN_JOB: opens the SERVER's address for a job on the user's board, binds the tab 'board', with the report", "⛔ openPosting: with the extension it hands over a JOB ID only…"; `t24IntentModel` › "T24 · the board's apply vs view intent is carried by the bridge…", "T24 · through the bridge the board's intent sets the tab's TabState…" | yes (+ stubs) | **COVERED** | not yet |
| 2 | a board job's URL pasted into a new tab | `t13t14FillChain` › "⛔ T13 + T14 in a REAL Chrome — … the apply URL in a NEW tab: the real popup shows the job…" (`walks/fillChain.mjs` §4–5); `bindingFirst` › "⭐ BINDING FIRST in a REAL Chrome — the matrix…" §1 (on your board, cold tab); `t13t14FillChain` › "⛔ T14: a NEW tab on a known address binds at once — no read, no request…" | yes | **COVERED** | not yet |
| 3 | a company site embedding Greenhouse (**Stripe**) | `t11EmbeddedChrome` › "⭐ (a) with Greenhouse allowed: the fill lands INSIDE the embedded frame…", "⭐ (c) a frame as tall as the form…", "⭐ (b) without Greenhouse: 'Allow draft on Greenhouse'…"; `d97rT12Chrome` › "⭐ the one-time card → ONE grant → … 'Always read here' on the careers origin reads its Greenhouse frame"; `t20AutoReadChrome` › "⭐ (b) 'Always read here' on a company's careers page reads its EMBEDDED Greenhouse frame at once"; `fieldReport1014` › "⭐ T2 · a capture of the Stripe page LINKS to the board job — no second row", "⭐ BINDING FIRST · an employer page naming no job is identified by its embedded ATS form's frame (≤ 3 frames)"; `t11EmbeddedForm` (12 unit tests) | yes — a two-origin fixture (the fake ATS on two ports, one embedding the other) | **COVERED** (fixture) — the live Stripe page was READ by the extension's probe, read-only (`docs/LIVE_FORM_MEASUREMENT.md` form 1: 29 fields in the `job-boards.greenhouse.io/embed/job_app` frame, 0 Unlabelled, 1 résumé row); no test fills it | not yet |
| 4 | **Workday** posting and every apply stage | `j9FullPass` › "⛔ J9 full pass (light/dark): capture → bound → read → fill → panel → … résumé → attach…" (`walks/fullPass.mjs` §1–9, every step to Sign In); `workdayStages` › "⛔ the owner's exact URL resolves to the same key as the plain posting URL — and every stage does" + 12 more; `j4PanelBrowser` (5 walks); `j2WorkdayFixture` (12 fixture tests); `j2ExtensionHarness` › "the harness boots the real extension, drives the fixture…" | yes | **COVERED** (fixture) — the Workday replica's shapes are partly ASSUMED (O73 caveat, asserted by `j2WorkdayFixture` › "⚠ every assumed shape says so") | not yet |
| 5 | **Lever** | `j9FullPass` walk §10 "the plain fake-ATS form — the non-Workday control" fills `scripts/fakeAts.js /lever` (a "Lever-flavoured" localhost form); `fieldReport1014` › "T2 · atsJobKeyOf names the board's id for every family…", "⭐ T2 · the popup's lookup (resolvePageJob) finds the board job…" (Lever apply page); `t11EmbeddedForm` › "atsSiteOf…", "familyOfBoardJobId…"; `liveFormMarkup` › "LIVE (4, Chrome): Lever's wrapping label — the question before the field, not its status text; a wrapped select's options never"; `t10AtsFamiliesChrome` › "⭐ T10 rows 5–7 + 34 walk (real extension): Lever, Workable and Ashby forms as measured are filled in ONE press…" (`walks/atsFamilies.mjs` §1, `/lever-live` = `scripts/fakeAtsLiveShapes.js`) | yes — the measured Lever structure (fixture) | **COVERED** (fixture, 10-17) — ONE press fills name, email, phone, location, LinkedIn, GitHub on the MEASURED wrapping-label structure; one résumé row; EEO untouched; "Name Pronunciation" not EEO. Lever's ✱ mark no longer stays in the labels (fixed). No live Lever form was filled | not yet |
| 6 | **Ashby** | `fieldReport1014` › "T2 · atsJobKeyOf…" (incl. `?ashby_jid=` embedded); `ashbySpaFixture` (11 tests of the `/ashby-spa` fixture itself — the live Ashby form's measured shape); `liveFormMarkup` › "LIVE (5, Chrome): Ashby's autofill drop zone is labelled by its own words — and the panel draws ONE résumé row, the real field's", "LIVE (3, Chrome): a long label the page ties to its field is the label…"; `t10AtsFamiliesChrome` › "⭐ T10 rows 5–7 + 34 walk (real extension): Lever, Workable and Ashby forms as measured are filled in ONE press…" (`walks/atsFamilies.mjs` §3, `/ashby-spa?delay=0`) | yes — the replica of a live Ashby posting | **COVERED** (fixture, 10-17) — ONE press fills Legal Name, Email, Phone Number; the autofill drop zone is not a second résumé row; the self-identification radios untouched. No live Ashby form was filled | not yet |
| 7 | **Workable** | `fieldReport1014` › "T2 · atsJobKeyOf…" (both Workable URL shapes); `j5AutoRead` › "⛔ D97 · the manifest's optional hosts ARE the site table…"; `liveFormMarkup` › "LIVE (1, Chrome): Workable's real radios are aria-hidden with tabindex -1 behind role=radio — they stay fields", "LIVE (2, Chrome): Workable's upload — the svg preview label and 'Choose file' are not its label; 'Resume' is, and it is the résumé"; `t10AtsFamiliesChrome` › "⭐ T10 rows 5–7 + 34 walk (real extension): Lever, Workable and Ashby forms as measured are filled in ONE press…" (`walks/atsFamilies.mjs` §2, `/workable-live`) | yes — the measured Workable structure (fixture) | **COVERED** (fixture, 10-17) — ONE press fills first / last name, email, phone on the MEASURED span-label structure; the svg upload is ONE "Resume" row; the role=radio screening question and the combobox's backing input untouched; the ≈ 330-character question listed by its words. No live Workable form was filled | not yet |
| 8 | **SmartRecruiters** | `fieldReport1014` › "T2 · atsJobKeyOf…", "⭐ T2 · the popup's lookup…" (SmartRecruiters URL); `d97rT12Chrome` (the consent card lists SmartRecruiters, its host granted); `j5AutoRead` › manifest optional hosts | consent card only | **PARTIAL** — key, lookup and the consent card; no SmartRecruiters form fixture | not yet |
| 9 | a job NOT on the board (a capture; an irrelevant posting discarded) | `bindingFirst` › REAL Chrome matrix §7 "NOT ON THE BOARD — nothing bound, nothing prepared; ONE button (Capture), which binds, and Fill fills"; `j9FullPass` walk §1 capture; `j5AutoRead` › "⛔ D97 · a DISCARDED automatic capture changes no table's row count — the whole database, before and after"; `d64AutoCaptureServer` | capture: yes · discard: no | **PARTIAL** — the irrelevant-posting discard is a server test only; no walk shows the user what a discarded capture looks like | not yet |
| 10 | a page that is not a job | `bindingFirst` › REAL Chrome matrix §8 "NOT A JOB — … nothing bound, nothing prepared"; `bindingFirst` › "⛔ identifyAndBind: a failed identify binds NOTHING…"; `d64AutoCaptureExtension` › "⛔ D64 · a page that is NOT a posting sends NOTHING"; `t13t14FillChain` walk §6 "a page with no application form says why" | yes | **COVERED** | not yet |
| 11 | a page that **redirects to another site** after opening | `d99Bridge` › "⛔ OPEN_JOB…" (the `boards.greenhouse.io` → `job-boards.greenhouse.io` "redirect twin keeps the binding" — stubs); `t13t14FillChain` › "⛔ T14: a seen address claims the same page, a page under it and the page in another language — and nothing else"; `bindingFirst` › "⛔ runFillChain (a)(b): … a page naming no job keeps the binding…" | no | **PARTIAL** — only the Greenhouse twin host, against stubs. No walk follows a real cross-site redirect; note `workdayStages` › "the binding: … valid only on its origin" — what a redirect to an unrelated origin shows is untested | not yet |
| 12 | two tabs, two jobs | `workdayStages` › "⛔ the binding: set by a capture, used first, valid only on its origin, cleared on tab close, replaced by another job"; `t11EmbeddedForm` › "⛔ a packet already released into the tab is reused only in the frame it was released for — never another job's"; `j4PanelLifecycle` › "⛔ J4 (measured): ONE fill per tab…"; `t10AtsFamiliesChrome` walk (`walks/atsFamilies.mjs` §5): a Lever tab and a Workable tab, each Filled with the real Fill press; each bound to ITS job; Fill again in the first still fills its own (10-17) | yes | **COVERED** (fixture, 10-17) | not yet |
| 13 | the same job in two tabs | `t13t14FillChain` walk §4–5 (a second tab on the same job's apply URL binds and fills); `t13t14FillChain` › "⛔ T14: a NEW tab on a known address binds at once…"; `j1Progress` › "⛔ J1: ONE record per job…"; `t10AtsFamiliesChrome` walk (`walks/atsFamilies.mjs` §6): the same job open in two tabs, Fill in each — both filled, both bound to the job, ONE progress record holding the fill (10-17) | yes | **COVERED** (fixture, 10-17) — two panels, one record | not yet |
| 14 | a tab restored after a browser restart | `j1Progress` › "⛔ J1: progress SURVIVES — the popup closing, the page reloading, a browser restart (session storage gone)"; `t13t14FillChain` › "⛔ T14: a NEW tab on a known address binds at once…"; `j9FullPass` walk §6 "reload the page — progress and binding survive" | reload: yes · restart: no (stubbed storage) | **PARTIAL** — a restart is simulated by clearing a stubbed `chrome.storage.session`; no walk restarts Chrome | not yet |

### State and account

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 15 | signed out | `bindingFirst` › REAL Chrome matrix §9 "UNREACHABLE and SIGNED OUT — nothing bound, nothing prepared, each its own sentence"; `bindingFirst` › "⭐ lookupPage … a 401 is 'signed out'"; `j1Progress` › "⛔ J1: sign-out clears it; an unreachable server does NOT…" | yes | **COVERED** | not yet |
| 16 | the extension's token expired (a silent refresh, or one clear reconnect) | `j1Progress` › "⛔ J1: sign-out clears it…" (a revoked token with no session → signed out); `t13t14FillChain` › "⛔ T13: … an expired token gets one fresh attempt" (the **hand-off** token, not the account token); `t10TokenRefresh` (5 tests, 10-17): a 401 → ONE bootstrap and the SAME request resent with the NEW token (the cookie on the bootstrap only); no session → null, the token forgotten, nothing resent, `token_refused` noted; unreachable mid-refresh → `reconnect_unreachable`; a second 401 is not refreshed again (no loop) | no | **PARTIAL** — the silent refresh is now tested (stubbed `chrome.storage` and `fetch`, the real `authedFetch`); no real-Chrome walk revokes a token mid-session | not yet |
| 17 | the extension disabled (the website falls back to the plain link) | `d99Bridge` › "⛔ openPosting: no extension → the page opens its own link, exactly as before", "⛔ openPosting: the extension says no … → the page opens its own link", "⛔ openPosting: a reply with the wrong nonce…"; J11 walk §4 (not on the board → the page's link, with the extension present); `t10ExtensionAbsent` (real Chrome, the popup blocker ON, the web app's real `openPosting.js`): no extension → the page's own link at once; the extension gone AFTER the board loaded (a nonce nobody answers) → the link after the hand-off's 4 s wait, still inside the click's activation window, one tab (10-17) | yes (no extension loaded) | **COVERED** (10-17) — a Chrome with no extension stands in for disabled; no walk toggles the switch at chrome://extensions | not yet |
| 18 | no base résumé | `d99AtsOnPage` › "⛔ J12 walk (light/dark): the report at once, "Add your résumé", "Read this page now" — in a real Chrome"; `d99BoardJob` › "⛔ J12: no base résumé → no_base_resume…"; `d99AtsOnPage` › "J12 · no base résumé → "Add your résumé in draft" and no score…"; `t10AccountStates` › "⭐ row 18 · NO BASE RÉSUMÉ: the answers are still prepared…", "⛔ row 18 · … no 'Attach my résumé', no 'Generate and attach' — and a Generate sent anyway spends nothing" (the real routes, 10-17) | yes (the ATS face); the real routes for the rest | **PARTIAL** — Prepare / Fill (answers prepared, "attach one yourself"), the Copy sheet, the base-résumé route and Generate (409 before anything is spent) are tested on the real routes; the review row no longer offers *Generate and attach* without a résumé (fixed, 10-17). No real-Chrome walk on an account with no résumé | not yet |
| 19 | a résumé but no job profile | `d64AutoCaptureServer` (an automatic capture answers `no_active_profile`); `t10AccountStates` › "⭐ row 19 · A RÉSUMÉ BUT NO JOB PROFILE: the account's résumé is the base — prepare works, Attach my résumé is offered and served, a generation starts" (the real routes, generation stubbed, 10-17) | no (the real routes) | **PARTIAL** — Prepare, *Attach my résumé* (offered and served) and a generation are tested on the real routes; the popup / dock / ATS words for an account with no job profile have no walk | not yet |
| 20 | Draft slots exhausted | `j6ResumePanel` › "⛔ J6: no cost, token or model word in anything the panel shows…" (the `slots_exhausted` model says "You have used all of your drafts…"); `a63BoardToolsPending` (the board's `draft_slots_exhausted`); `t24IntentModel` › "⭐ T24 · server: 0 of 10 slots is said BEFORE queuing — nothing is written", "T24 · 0 of 10 slots: said on the dock, and nothing is sent", "T24 · 0 of 10 slots is said BEFORE queuing; 1 left for a Draft + résumé offers the Draft alone" | no (the T24 walk runs with slots to spare) | **PARTIAL** — the server refuses before queuing and the dock says so (server + stubbed dock); no real-Chrome walk reaches 0 of 10 | not yet |
| 21 | the plan's limit | `test/t10PlanLimit.test.js` — `plan_limit` (429) and `upgrade_required` (403) each refused before anything is spent (no slot, no generation row, no model call), the allowance beside it; the résumé view shows each refusal's own sentence; server.js's preflight pinned (43k) | stubs (the service with a stubbed preflight; the view model) | **PARTIAL** — no real-Chrome walk reaches it, and production has `RM_LIMITS_PER_DAY` unset | not yet |
| 22 | the server unreachable | `bindingFirst` › REAL Chrome matrix §9 "UNREACHABLE and SIGNED OUT…"; `j1Progress` › "⛔ J1: … an unreachable server does NOT [clear progress]"; `bindingFirst` › "⛔ identifyAndBind: a failed identify binds NOTHING…" | yes | **COVERED** | not yet |

### Generation

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 23 | a tools-service failure (the slot refunded, the cause visible in T6's view) | `d98ExtensionResume` › "⛔ refunded on a server failure — and the user reads one fixed sentence…"; `fieldReport1014` › "⭐ T6 regression · the owner's failure: the tools service refuses the model call → cause recorded, sentence generic, slot back", "⛔ T6 · Show details: off by default, the Options page only…", "T6 · causeOf names the stage and the code…" | no (stubbed tools service) | **PARTIAL** — refund and cause are server-tested; no walk shows a failure in the dock and in Options → Show details. T19 still owes naming `model_key_rejected` (the workspace-key 400) by name, with its regression test | not yet |
| 24 | a claim-guard refusal | `d98ExtensionResume` › "⛔ a guard refusal stores nothing and attaches nothing — the reasons in plain words"; `j6ResumePanel` › "⛔ J6: a claim-guard refusal shows its reasons and attaches nothing…"; `j6ResumePanelBrowser` › "⛔ J6 walk (light/dark): generate on the page, …, cancel, refuse, attach…"; `resumeClaimGuard` (the guard itself) | yes (tools service stubbed: `test-support/extensionResumeStub.mjs`) | **COVERED** (stubbed tools service) | not yet |
| 25 | cancel mid-generation | `d98ExtensionResume` › "⛔ refunded on a cancel before the work begins…", "⛔ cancel during the work: nothing is stored or attached; the slot stays spent"; `j6ResumePanel` › "⛔ J6: Cancel stops it…"; `j6ResumePanelBrowser` walk (cancel) | yes (tools service stubbed) | **COVERED** (stubbed tools service) | not yet |
| 26 | the PDF attached; and the drop-zone fallback | `j6ResumePanelBrowser` › "⛔ J6: Attach — a plain input is set and verified, Workday's drop zone is set and the page shows the name, a zone that shows nothing is NOT verified…"; `j6ResumePanel` › "⛔ J6: Attach — … not verified falls back to Download PDF and says so; never silent"; `t18GreenhouseChrome` › "⭐ T18 (Chrome): Attach puts the PDF in the row's own upload and the page shows its name; a drop zone that shows nothing is not verified"; `d98ExtensionResume` › "⛔ the PDF is printed from the SANITISED HTML, stored, and linked…" | yes (tools service stubbed) | **COVERED** (stubbed tools service) | not yet |

### Answers and fill

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 27 | remembered answers reused; a changed answer re-asked; **terms / consent / attestation / signature boxes never ticked** | `j4PanelBrowser` › "⛔ J4 walk (light/dark): every field listed, Ready means ready, one tick remembers (eligibility too), a change is not stored, consent / signature / password untouched…", "⛔ J4 (D96 §4 safeguard 2 / §7): a Workday dropdown whose choices changed … is ASKED"; `j9FullPass` walk §9 "a NEW fill reuses what was remembered"; `d96AnswerLifecycle` (12 tests); `t25NearMatchSavedAnswers` (6 tests: a near-worded question reuses a saved answer under Check, never for eligibility / EEO / consent / salary); `j4PanelLifecycle` › "⛔ J4 (D96 §4 safeguard 1): a terms / consent / attestation / signature control is NEVER given a value"; `d55AutofillRules` | yes | **COVERED** | not yet |
| 28 | auto-read per site, on and off; a permission refused | `d97rT12Chrome` (one consent → a preset host read; *Always read here*); `t20AutoReadChrome` › "⭐ (a) consent reads the tabs ALREADY OPEN … · the kill switch stops it", "⛔ (c) the REAL request with no grant (Chrome's prompt, never answered): … NOTHING is turned on or read"; `j5AutoRead` (24 tests: default off, on/off per site, kill switch); `d97rT12AlwaysRead` › "⛔ a refusal of the card's prompt leaves EVERYTHING off…", "⭐ T12 · the switch asks Chrome INSIDE the click … a refusal leaves it off", "⭐ T12 · revoking removes the registration…"; `t20AutoReadOpenTabs` › "⛔ T20 · a grant with NO click behind it, … or a refused one turns NOTHING on" | yes, grant stood in | **PARTIAL** — a *pressed* Deny exists only in `scripts/t20RealPromptWalk.mjs deny` (manual, headed, Windows). D97R's refusal, second click and Options → Remove are stub-tested only | not yet |

### Everywhere

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 29 | all four themes, cues off and on | `t17DockChrome` › "⛔ T17: the four themes — the frame is painted from the palette it is handed, light and dark by the OS, and the shape cues add a shape"; `t9AtsReportComponent` › "⭐ T9 · REAL CHROME: the popup and the web app draw the same pixels — four themes, cues off and on…"; `j4PanelBrowser`, `j6ResumePanelBrowser`, `d99AtsOnPage` walks (light and dark); `t17Dock` › "T17: the account's appearance picks the palettes…" | yes | **PARTIAL** — the dock frame and the ATS card are checked in all four themes with cues; the Fill / Résumé / Copy sheet views and the rest of the popup are checked in light and dark only, cues not toggled | not yet |
| 30 | keyboard-only | `t17DockChrome` › "⛔ T17: keyboard-operable — Move (arrows, Ctrl+arrow snaps), Resize (arrows), the tabs (arrows), Esc closes"; `t9AtsReportComponent` › "⭐ T9 · REAL CHROME: the keyboard claims a term…"; `j4PanelBrowser` › "… Esc and Close close"; `t22PopupLauncher` › "⛔ T22: every removed action is still reachable — Ctrl+Shift+K and Ctrl+Shift+Y…" | yes (pieces) | **PARTIAL** — no walk completes a whole application (popup → dock → fill → résumé row → I submitted it) with the keyboard alone | not yet |

### T10 additions — scenario rows (31)–(37)

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 31 | **an application form in a cross-origin iframe** (Stripe / Greenhouse) — detected, permission asked once, filled | `t11EmbeddedChrome` › "⭐ (a) with Greenhouse allowed: the fill lands INSIDE the embedded frame…" (two-origin fixture); `t11EmbeddedForm` › "⭐ the fill goes INTO the Greenhouse frame — every step targets frameId 5…", "framePermissionResult names the site and asks for exactly its origins"; `j5AutoRead` › "⛔ D97 · permissions.request lives in click handlers only — … T11's 'Allow draft on <site>'…" | yes, grant stood in | **PARTIAL** — detected and filled in a real Chrome; "asked once" is source- and stub-tested — Chrome's real prompt is not pressed in any `npm test` walk | not yet |
| 32 | the same, permission refused | `t11EmbeddedChrome` › "⭐ (b) without Greenhouse: 'Allow draft on Greenhouse' — nothing filled, nothing released"; `t11EmbeddedForm` › "⭐ an unreadable Greenhouse frame → 'Allow draft on Greenhouse', and the page's own small form is NOT filled"; `d97rT12AlwaysRead` › "⭐ T12 · the switch asks Chrome INSIDE the click … a refusal leaves it off" | yes (no grant) | **PARTIAL** — "no grant" is walked; a *pressed* Deny on the frame prompt is not | not yet |
| 33 | a form in **shadow DOM** | — (the extension's field reader and filler do not walk into shadow roots; `shadowRoot` appears only in draft's own UI files) | — | **NOT COVERED** | not yet |
| 34 | a form that **renders late** | `j5AutoRead` › "⛔ D97 · the watcher: ten mutation bursts in one second make exactly ONE read…", "⛔ D97 · the watcher's pass is one at a time per tab — a step change during a pass runs ONE more pass after it"; `d55WorkdayReplica` › "dropdown listboxes and typeahead results arrive LATE, in a portal…" (walked by `j9FullPass` / `j4PanelBrowser`); `formReadiness` (the SERVER-side apply automation's readiness wait, against `/spa`); `t10AtsFamiliesChrome` › "⭐ T10 rows 5–7 + 34 walk (real extension): Lever, Workable and Ashby forms as measured are filled in ONE press…" (`walks/atsFamilies.mjs` §4: Fill pressed at "Loading application form…" on `/ashby-spa?delay=2500`) | yes | **COVERED** (fixture, 10-17) — measured first: the press answered "No application form found" in 159 ms and never filled. Fixed: when a packet fills the page, the handoff waits (≤ `LATE_FORM_WAIT_MS`, 6 s) for the form and runs once more; the late form filled 2.4 s after the press | not yet |
| 35 | Lever's, Ashby's and Workable's embedded forms | `t11EmbeddedForm` › "atsFramesOf: one per site, the page's own site excluded…" (a Lever frame recognised), "routes: /handoff/match with frameUrl…" (a Lever frame outside the origin list refused); `fieldReport1014` › "T2 · atsJobKeyOf …" (`?ashby_jid=` embedded); `liveFormMarkup` (Lever / Ashby / Workable structures, top frame) | no | **PARTIAL** — frame and key recognition, and the forms' own structures read in their TOP frame; only the embedded **Greenhouse** form is walked, and no live Lever / Ashby / Workable form embedded on a company site was measured | not yet |
| 36 | a new tab for the same job — no re-capture, no re-read | `t13t14FillChain` › "⛔ T13 + T14 in a REAL Chrome — … the apply URL in a NEW tab…" (`walks/fillChain.mjs` §4–5; the file's header names rows (36) and (37)); `t13t14FillChain` › "⛔ T14: a NEW tab on a known address binds at once — no read, no request…", "⛔ T14: the popup draws the tab's state on open…" | yes | **COVERED** | not yet |
| 37 | *Fill* from a cold tab with every auto switch off | `t13t14FillChain` › REAL Chrome §2 "Fill from a cold tab, every auto switch off: read, prepare and fill in ONE press"; `t13t14FillChain` › "⛔ T13: Fill from a COLD tab reads, prepares and fills in ONE press…"; `bindingFirst` › REAL Chrome matrix §1 | yes | **COVERED** | not yet |

### T10 additions — more scenario rows (38)–(42)

| # | Scenario (WORKLOG wording) | Test(s) — file › test | Real Chrome? | Status | Owner's production walk |
|---|---|---|---|---|---|
| 38 | a standard Greenhouse form classified with no "Unlabelled" | `t18GreenhouseChrome` › "⭐ T18 (Chrome): the standard Greenhouse form is read with every field named — no 'Unlabelled', no 'Attach'", "⭐ T23 (Chrome): ≥ 80 % of the standard fields filled with NO typing…"; `t18FieldSemantics` › "⭐ T18: the standard Greenhouse form has NO 'Unlabelled' row…"; `liveFormMarkup` › "LIVE (1, Chrome): a required picker's hidden backing input is not a field — in the probe AND in applyPlan…" | yes | **COVERED** (fixture) — the fixture (`scripts/fakeAtsGreenhouseStandard.js`, driven by `test-support/greenhouseStandard.mjs`) now copies the MEASURED Greenhouse markup (react-select pickers and their backing inputs, the upload's nesting); live Stripe / Discord / Figma read 0 Unlabelled. Still transcribed: Discipline, start / end month and year, picker options | not yet |
| 39 | résumé field detected; tailored, base and skip all work; a custom drop zone falls back | `t18GreenhouseChrome` › "⭐ T18 walk (real extension): Attach my résumé lands on the drop zone and the page shows its name; Generate and attach starts one; Skip keeps a required upload…" (`walks/resumeField.mjs`), "T18 (Chrome): a file input beneath a heading is typed `resume`…", "⛔ T18 (Chrome): the résumé row — a page script's click sends nothing…", "⭐ T18 (Chrome): Attach puts the PDF … a drop zone that shows nothing is not verified"; `t18FieldSemantics` › "⛔ T18: a file is never attached without the user's click…"; `liveFormMarkup` › "LIVE (5, Chrome): … the panel draws ONE résumé row…"; `t24IntentModel` › "T24 · a résumé already known is attached, one in flight is JOINED — never a second", "T24 · Fill with no Draft is the manual path and never generates…"; `t18GreenhouseChrome` › "⭐ T18 walk … Attach tailored — that generation, once ready — lands and the page shows its name" (`walks/resumeField.mjs` §5, 10-17) | yes | **COVERED** (stubbed tools service, 10-17) — base, skip, *Generate and attach*, and now **Attach tailored end to end**: the generation ready → the row offers *Attach tailored* first → ONE PDF from the sanitised HTML, recorded attached → the page shows its name → the row Filled with it. Fixed on the way: a tailored attach that landed was called "Could not attach" on the row. No file was ever attached to a live form | not yet |
| 40 | **the dock never mounts in a child frame** and never extends past the viewport | `t17DockChrome` › "⛔ T17: the dock mounts in the TOP frame and NEVER inside a child frame (a cross-origin iframe, as Greenhouse's on stripe.com)", "⛔ T17: at four viewport sizes the dock never extends past the viewport…"; `t11EmbeddedChrome` › (a), (c); `t17Dock` › "⛔ T17: dock.js refuses a child frame…", "⛔ T17: at FOUR viewport sizes…", "⛔ T17: the service worker draws the dock and EVERY view at frame 0 only…" | yes | **COVERED** | not yet |
| 41 | the dock's rectangle is remembered per site | `t17DockChrome` › "⛔ T17: drag by the header, resize from an edge and a corner, snap…, collapse — each is sent to be remembered, and a new page restores it"; `t11EmbeddedChrome` › "⭐ T17 (d): the dock dragged ACROSS the embedded form's frame keeps moving, and its rectangle is remembered for the SITE…"; `t17Dock` › "⛔ T17: the rectangle is remembered PER SITE…", "⛔ T17: only a web page's TOP frame may write the place…"; `j4PanelLifecycle` › "⛔ J4 → T17: where the review panel sits is the DOCK's…" | yes | **COVERED** | not yet |
| 42 | auto-read after consent reads the open tab at once | `t20AutoReadChrome` › "⭐ (a) consent reads the tabs ALREADY OPEN with no press · a new tab reads on load · a single-page step change reads ONCE · the kill switch stops it", "⭐ (b) 'Always read here' … reads its EMBEDDED Greenhouse frame at once — no reload"; `t20AutoReadOpenTabs` (9 tests, incl. "⭐ T20 · THE POPUP CLOSED AT THE PROMPT: the pending click + Chrome's grant (onAdded) finish the consent in the worker, and the open tab is read") | yes, grant stood in | **COVERED** — the real-prompt path (popup closes at the prompt) is unit-tested and was walked headed by `scripts/t20RealPromptWalk.mjs`, outside `npm test` | not yet |

### Behaviour added since the numbered rows (T21, T24, T25)

These are not T10 rows — the WORKLOG has not numbered them — but they change what the owner's walk must check. They
are listed so the walk covers them; the guard counts only rows 1–42.

| Item | What | Test(s) | Real Chrome? | State |
|---|---|---|---|---|
| T24 | the intent model: Draft before any fill → ONE drafted application + ONE résumé; a fill is the manual path and never generates; conflicting tells ask ONCE and *Remember* keeps the answer with the account; full auto refused; the board's apply / view intent through the bridge | `t24IntentModel` (30 tests; migration 168) incl. "⭐ T24 walk: the dock asks once and remembers with the account; ONE application and ONE résumé; a second Draft queues nothing; the switch — in a real Chrome" (`walks/intentPath.mjs`) | yes | automated; owner's walk not yet |
| T25 | near-match saved answers ("…about this job?" reuses "…about us?"), shown under Check, never across eligibility / EEO / consent / salary | `t25NearMatchSavedAnswers` (6 tests) | no (unit) | unit only; owner's walk not yet |
| T21 | no flicker: the dock, the Fill view and the status line are patched in place; the Fill button keeps its width | `t21NoFlicker` › "⛔ T21 in a REAL Chrome — through a fill … ≤ 1 frame repaint…" (`walks/fillFlicker.mjs`) + 2 source tests | yes | automated; owner's walk not yet |

## Counts

| Status | Rows | Count |
|---|---|---|
| COVERED | 1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 15, 17, 22, 24, 25, 26, 27, 34, 36, 37, 38, 39, 40, 41, 42 | **25** |
| PARTIAL | 8, 9, 11, 14, 16, 18, 19, 20, 21, 23, 28, 29, 30, 31, 32, 35 | **16** |
| NOT COVERED | 33 | **1** |

**COVERED here means automated, not done.** Every COVERED row runs against a fixture and synthetic data; rows 24–26 run
against a stubbed tools service. None of the 42 has had the owner's production walk.

## The owner's production walk — in order

T8: nothing is "complete" until this passes on **production** with the real Stripe job and the Zoom Workday flow. Use
the rebuilt v1.5.2 loaded unpacked (it is not uploaded — the T10 gate). Tick a row in the matrix only when its step
below passes. The order follows a real application, so earlier steps set up later ones.

1. **Fresh install, the consent card, Chrome's REAL prompt** (rows 28, 42). Load v1.5.2 unpacked on a clean profile,
   sign in, open a Greenhouse or Workday application tab **first**, then open the popup and accept the card. Expect
   one Chrome prompt; after *Allow*, the already-open tab is read with no press ("Reading automatically on this site ·
   last read HH:MM"). Repeat once on a second profile and press **Deny**: nothing on, nothing read.
2. **The board → the real Stripe job** (rows 1, 3, 31). On jobsviadraft.com click the Stripe posting; the tab opens
   bound "from your board" with its ATS. On the Stripe page press *Allow draft on Greenhouse* — Chrome's real prompt,
   **once**; the form inside the embedded Greenhouse frame fills; the dock sits in the top frame and never inside the
   form's frame (row 40). Do not submit.
3. **The Stripe form's fields** (rows 38, 39, 27). No "Unlabelled" row; the résumé upload is typed *résumé*, the cover
   letter *cover letter*; Location (City) and School are filled from the profile / base résumé. On the résumé row:
   **Attach my résumé** (the page shows the file name), then **Generate and attach** → wait for ready → **Attach
   tailored** (the tailored PDF replaces it, the page shows its name) — *Attach tailored end to end has run only on the
   fixture with a stubbed generation (10-17)*.
   Confirm no terms / consent / attestation / signature box was ticked, and that the Fill button does not flicker
   while it runs (T21).
4. **The same row refused** (row 32). On a fresh profile, open the Stripe page and press **Deny** on the Greenhouse
   prompt: "Allow draft on Greenhouse" stays, nothing is filled.
5. **The dock** (rows 40, 41, 29, 30). Drag, resize, snap and collapse it on stripe.com; reload — the rectangle comes
   back for that site. Switch the account through all four themes, cues off and on, and look at the Fill, ATS, Résumé
   and Copy sheet tabs in each. Then do one whole application **with the keyboard only**.
6. **Zoom on Workday, every stage** (rows 4, 27, 34). Apply URL → My Information → My Experience (résumé on the drop
   zone; the drop-zone fallback if the page shows no name — row 26) → Application Questions → Voluntary Disclosures →
   Self Identify → Review. Late-opening dropdowns fill; Submit is never pressed by draft. Re-run a second Workday
   application: remembered answers are reused; change one and it is asked again; a question worded slightly
   differently ("How did you hear about this job?") offers the saved answer under Check, never as Filled (T25).
7. **Tabs** (rows 2, 12, 13, 36, 37, 14, 11). Paste a board job's URL into a new tab and press *Fill* with every auto
   switch off (one press: read, prepare, fill). Open the same job in a second tab — no re-capture, no re-read; fill
   both. Open two different jobs in two tabs and fill both — each keeps its own job. Quit Chrome, restore the tabs:
   each is still bound. Open a posting whose link redirects to another site and see what the popup says.
8. **The other ATS families on live postings** (rows 5, 6, 7, 8, 35). One real application page each on **Lever,
   Ashby, Workable and SmartRecruiters** (identify → bind → prepare → fill, stop before submit), and one company site
   embedding a Lever / Ashby / Workable form. Ashby's form hydrates late (row 34) — Fill must wait for it, and its
   autofill drop zone must NOT become a second résumé row. These live forms have only been READ by the probe; the
   MEASURED structures are filled on fixtures (10-17), the live ones never.
9. **Off the board** (rows 9, 10). A real posting not on the board → *Capture* binds it and Fill fills; an irrelevant
   posting is discarded with a sentence; a page that is not a job binds nothing.
10. **Account states** (rows 15, 16, 18, 19, 22). Signed out; revoke the extension's token from the website and press
    again (one silent refresh, or one clear reconnect); an account with no base résumé (ATS says "Add your résumé";
    what do Prepare and Generate say?); an account with a résumé but **no job profile**; draft unreachable
    (disconnect the network).
11. **Generation edges** (rows 20, 21, 23, 24, 25). Cancel a generation mid-way; use the last Draft slot and try one
    more (the sentence, said before anything is queued); the plan's limit (needs `RM_LIMITS_PER_DAY` or a plan without
    résumés — currently unset in production, so this needs the owner's setup); a tools-service failure is shown by its
    cause in Options → Show details and the slot comes back; a claim-guard refusal shows its reasons and attaches
    nothing.
12. **Draft vs Fill — the intent model** (T24; rows 1, 20). From the board's *Draft*: one drafted application and one
    résumé, and a second Draft queues nothing. On a cold application form, *Open dock* asks once (*Draft this job…, or
    just fill this form yourself?*) and *Remember* holds on the next job. Filling by hand never generates until the
    résumé row's press. With 0 of 10 slots the dock says so before anything is queued.
13. **Extension disabled** (row 17). Disable the extension at `chrome://extensions` and click a posting on the board —
    the website opens its own link.
14. **Shadow DOM** (row 33). There is no known shadow-DOM application form in draft's fixtures and the extension does
    not read into shadow roots — if the owner meets one, record the site; this row stays open until it is built and
    tested.

## Test runs (2026-10-15, this worktree)

Every file cited above was run with `node --import ./test-support/isolateTrackingSink.mjs --test test/<file>`.

On `7e9c0c1`, before the merge:
- **Run 1 — 26 files together, default concurrency (many Chromes at once): 323 tests, 317 pass, 6 fail.** The 6 were
  real-Chrome walks under load (`bindingFirst` matrix, `d99AtsOnPage` J12 dark, `j9FullPass` light, `t9` pixel parity,
  `workdayStages` Copy sheet) and `d99Bridge` › "openPosting: with the extension…" (a 7.9 s wait that fell back to the
  link). Load, not rot: every one passed in run 2.
- **Run 2 — 22 files, `--test-concurrency=1` (every real-Chrome walk cited, the reds of run 1, the guard): 211 tests,
  210 pass, 1 fail** — `t9AtsReportComponent`'s pixel test, *"host.html could not load the card's faces"*, because this
  worktree had no `client/node_modules`.

On `9f3864c` merged (after T25 + T21, T24 and the live-markup lane):
- **The guard and every cited non-browser file — 26 files: 328 tests, 328 pass, 0 fail.** (`t10ScenarioRows`,
  `d97rT12AlwaysRead`, `d98ExtensionResume`, `d99BoardJob`, `d96AnswerLifecycle`, `fieldReport1014`, `j1Progress`,
  `j2WorkdayFixture`, `j4PanelLifecycle`, `j5AutoRead`, `j6ResumePanel`, `t11EmbeddedForm`, `t17Dock`,
  `t18FieldSemantics`, `t20AutoReadOpenTabs`, `t22PopupLauncher`, `d64AutoCaptureExtension`, `d64AutoCaptureServer`,
  `d55AutofillRules`, `d55AutofillResume`, `ashbySpaFixture`, `d55WorkdayReplica`, `formReadiness`, `resumeClaimGuard`,
  `a63BoardToolsPending`, `t25NearMatchSavedAnswers`.)
- **`t9AtsReportComponent` alone, with `client/` dependencies installed (`npm ci`): 16 tests, 16 pass, 0 fail** —
  the run-2 red was this worktree's setup, not the extension.
- Not re-run after the merge here: the real-Chrome walks and the newly merged files that carry one (`t24IntentModel`,
  `t21NoFlicker`, `liveFormMarkup`) — the coordinator's full run measures them.

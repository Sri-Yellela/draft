# A232 · The test pruning audit (46t, owner 11-17)

> *"full suites are taking so much time everyday, we should schedule a full pruning of tests after auditing for redundancy
> and necessity"* — the owner, 11-17.

**Status: the audit — nothing is deleted or moved yet.** ⛔ Pruning starts after the owner's pick (§6). Every figure below is
measured 11-17 on `e6ee0788` (46t): each of the 830 files run ALONE with the suite's own command (`node --test
--test-concurrency=1 --import ./test-support/isolateTrackingSink.mjs <file>`, `scripts/a232TimeFiles.mjs`); the static
inventory is `scripts/a232TestInventory.mjs`. Raw data: `tmp/a232/timings.tsv`, `tmp/a232/inventory.json` (untracked).

## 1. What the time is spent on

**830 files · 6,468 tests · 51.1 min run one file at a time, every file green** (0 failures,
0 time-outs). The 16-batch suite takes ~70 min on this machine because each batch also pays memory pressure; the sum is the floor.

| | files | tests | time | share of time |
|---|---:|---:|---:|---:|
| **Drive a real browser** (real Chrome, the real extension, or a vite dev server + Chrome) | 75 | 529 | **38.9 min** | **76 %** |
| · of which: fidelity probes through `scripts/fidelityShots.mjs` (each starts its own vite + Chrome) | 14 | 71 | 12.2 min | 24 % |
| **Everything else** (unit, source pins, routes in-process, the scale fixtures) | 755 | 5939 | 12.2 min | 24 % |

By runtime:

| a file takes | files | time |
|---|---:|---:|
| < 1 s | 557 | 3.1 min |
| 1–5 s | 211 | 7.8 min |
| 5–20 s | 36 | 6.0 min |
| 20–60 s | 10 | 5.7 min |
| ≥ 60 s | 16 | 28.5 min |

**The finding:** the time is in **16 files (28.5 min, 56 %)**, and every one of them drives a browser.
557 files run in under a second and together cost 3.1 min — deleting
even half of them would save about a minute and lose guards. **So "pruning" here is mostly about WHEN the browser files run and how
often they boot, not about deleting tests.** Redundancy among the fast files is real (§4) but it is a maintenance cost, not a time cost.

The slowest files:

| time | tests | file | what it guards |
|---:|---:|---|---|
| 5.7 min | 13 | `j9FullPass` | J9 · what the integration browser pass found, as unit rules — and the pass itself, in a real Ch |
| 3.8 min | 5 | `j4PanelBrowser` | J4 · D96 §4–§7 IN A REAL CHROME. (1) The whole walk — the REAL extension (test build, with the  |
| 3.1 min | 5 | `d163OtherScreens` | D163 · USE THE SPACE, the remaining screens (owner 11-05: "the menu dock, the deck and all are  |
| 1.8 min | 6 | `d100PortalAccounts` | D100 (a), owner 10-30: "yes we are creating portal accounts … test it on amazon." The worker cr |
| 1.5 min | 2 | `a201ShrinkGracefully` | A201 (46k, owner 11-13: "the content of the home panel rows are garbled when shrunken probe the |
| 1.3 min | 13 | `bindingFirst` | BINDING FIRST (owner 10-15) + T15 + T16 — identify and bind BEFORE anything else; one truth for |
| 1.3 min | 7 | `t18GreenhouseChrome` | T18 + T23 IN A REAL CHROME — the standard Greenhouse form (scripts fakeAtsGreenhouseStandard.js |
| 1.2 min | 4 | `j6ResumePanelBrowser` | J6 · D98 §4–§5 IN A REAL CHROME. (1) The whole walk — the REAL extension (test build) on the Wo |
| 1.2 min | 3 | `d153FactsNeverBreakWords` | D153 (5) · THE FACTS BOX NEVER BREAKS A WORD (owner 11-04: production showed "Rem ote", "not st |
| 1.2 min | 1 | `fidelityFullHouse` | D149 RULE 3 · FULL HOUSE + THE OPENED POSTING (docs sketches fullhouse-declutter.html), COMPUTE |
| 1.1 min | 4 | `t10AtsFamiliesChrome` | T10 rows 5, 6, 7, 12, 13 and 34 (open item 4) · Lever, Workable and Ashby forms as MEASURED, fi |
| 1.0 min | 10 | `t13t14FillChain` | T13 + T14 (field report 10-14) · ONE PRESS DOES THE WHOLE CHAIN, AND A TAB FOR THE SAME JOB KNO |
| 1.0 min | 17 | `d167Dock` | D167 · THE SITE'S MAP — THE DOCK (owner 11-06; home-sketch.html updated 11-06). Six places — d  |
| 1.0 min | 7 | `d168OneWayToOpen` | D168 · ONE WAY TO OPEN, ONE JOB FOR THE SCROLL WHEEL (owner 11-06, concept B approved): "the sc |
| 1.0 min | 2 | `a210QuestionsThreadNewRun` | A199 (2) walked + A210 (46l). scripts a199Walk.mjs drives the held questions thread in a real C |
| 1.0 min | 2 | `a131NoSidewaysOverflow1280` | A131 · NO SIDEWAYS OVERFLOW AT 1280 WITH A POSTING + ITS MATCH OPEN. The Full House bar's stuck |
| 55 s | 4 | `t25CardRailSeam` | T25 (owner, 10-19) · THE BOARD CARD'S BUTTON BOX — "the three buttons (ATS, star, Draft) have a |
| 52 s | 11 | `d156Home` | D156 · HOME, REVISED (owner 11-05; the second pass (1b) wins where it differs). Measured in a r |
| 44 s | 3 | `t20AutoReadChrome` | T20 · IN A REAL CHROME — consent reads the tab ALREADY OPEN, with no press; a new tab reads on  |
| 33 s | 4 | `a200AskDraftThread` | A200 (46k, owner 11-13: "the content of the questions is going behind the dock, format it and a |
| 32 s | 6 | `d163UseTheSpace` | D163 · USE THE SPACE (owner 11-05: "the menu dock, the deck and all are crammed into a corner w |
| 29 s | 7 | `a207ExtensionPrimarySubmit` | A207 (46l, owner 11-13): "Make the extension path the primary submit for ATS boards that flag s |
| 27 s | 14 | `d99Bridge` | D99 J11 · THE BRIDGE — the draft board hands a job to the extension (owner, 10-14: "build the b |
| 25 s | 1 | `d191SidePanelWalk` | D191 (46o rebuild, walked 46p) · THE SIDE PANEL WITH THE REAL EXTENSION LOADED — test-support w |
| 25 s | 11 | `d152Home` | D152 (1) · HOME (owner 11-04, home-sketch.html approved): the Daily Deck and Full House become  |

## 2. Recommendations (the owner picks — §6)

**R1 · Two tiers (no test deleted). Saves ~39 min on every run that isn't a push.**
`npm run test:fast` = the 755 files that drive no browser (12.2 min at concurrency 1; with no Chrome open they run at
concurrency 3 in **302 s — measured 11-17: 5,963 tests, 5,962 pass, 0 fail, 1 opt-in skip**) — run on every change. `npm run test:browser` = the 75
browser files — run **before a push**, and when `client/`, `extension/` or a walk changes. The whole suite (both tiers) stays the
gate for a push and for the count in CLAUDE.md. A guard file in `test/` decides the tier from the same regex this audit used, so a new
browser test can't land in the fast tier by accident.

**R2 · One fidelity probe instead of 14. Saves ~9 min of the browser tier.**
Each fidelity file runs `scripts/fidelityShots.mjs` itself, and each run starts a **vite dev server** (cold transform of the whole
client) and a Chrome. One run per suite (all the styles at once, against a `vite build` served statically, which is faster to load
than the dev server) writes its probe JSON to `tmp/`, keyed by a hash of `client/src` + `docs/sketches`; the 14 files read it.
⚠ These test runs also **rewrite the tracked `docs/fidelity-shots/*.png`** — that is why ~87 screenshots show as modified after every
suite. The tests should write to `tmp/`; `docs/fidelity-shots/` is refreshed only when someone runs the script on purpose.

**R3 · The two longest walks, one theme each. Saves ~5 min.** `j9FullPass` (5.7 min) and
`j4PanelBrowser` (3.8 min) walk the real extension once **per theme**; `j6ResumePanelBrowser` likewise. The
theme is a token swap that `d91ThemeModule` / `d91Coverage` / `colorLiteralGuard` already pin for every theme; walking Dusk only
keeps the behaviour, and a pure test keeps "the panel paints from the tokens in both themes". j9's 12 unit rules move to a fast file.

**R4 · One boot for the real-extension walks. Saves ~1 min and the launch flake.** Six one-test files
(`a207RealExtensionWalk`, `a211RealExtensionWalk`, `a211BackgroundWalk`, `d191SidePanelWalk`, `d112GlobalReadChrome`,
`d97rT12Chrome`) each launch Chrome with the extension (~8–10 s) for one walk; one file with six tests boots once. 46s's only red
(`d191SidePanelWalk`: Chrome closed at launch) was in that boot. `j2ExtensionHarness` (does the harness boot?) is covered by every
walk and can go.

**R5 · Split pure tests out of browser files.** `bindingFirst`, `t24IntentModel`, `t9AtsReportComponent`, `t31ToolbarPress`,
`d99Bridge` hold mostly pure tests behind one Chrome walk; split, the pure part joins the fast tier (time ≈ same, but they then run on
every change instead of only before a push).

**R6 · The fast files: merge, don't delete (§4).** 7 file pairs share three or more assertions word for word; 3
assertions are copied into four or more files (mostly local re-implementations of the colour / pill guards that
`colorLiteralGuard` and `d60NoPills` already enforce site-wide). Merging them is cleanup: maybe a minute in all.

**Together, R1–R5: a daily run drops from ~70 min to the fast tier (5 min, measured); the browser tier drops from 38.9 min to about
22.6 min; a full pre-push run from ~70 min to roughly 35 min at concurrency 1.**
No guard is deleted except `j2ExtensionHarness`.

## 3. Never deleted, whatever the audit says

`a188StagingGuard` · `a93ModuleManifest` · `authRouteGuardManifest` · `brandAndOriginGuard` · `brandMarkEverywhere` · `colorLiteralGuard` · `d171TestsNeverCallLiveModels` · `d17ModelCallSites` · `d190Assistant` · `d60NoPills` · `d91Coverage` · `d91ThemeModule` · `extensionSubmission` · `handoffDocCurrent` · `manifestMinimumPermission` · `migrationsByteIdentity` · `modelCallGuard` · `pageWidthGuard` · `resumeClaimGuard` · `sourceAnchorGuard` · `testSinkIsolation` — plus every file that asserts the `server.js` ↔ `scripts/migrations.js`
byte identity (CLAUDE.md). A guard deleted is a defect that comes back (D60, A93, the colour literals, the CRLF checks, D17).

## 4. Redundancy among the fast files

**File pairs sharing ≥ 3 assertions word for word (merge candidates):**

| shared | files |
|---:|---|
| 10 | `jobsPipelineHardening` + `profileIsolation` |
| 6 | `d113ui` + `d146Tracker` |
| 5 | `d148SettingsDrawer` + `d25DraftHouseWorkspace` |
| 4 | `applyObstacleSurfaces` + `applyPanelLayoutAdoption` |
| 3 | `boardControlRowConsolidation` + `panelPeers` |
| 3 | `d24FilterSentenceClient` + `d35FullHouseHeader` |
| 3 | `jobsBoardParamContract` + `jobsUiTierFilters` |

**Assertions copied into four or more files:**

| files | assertion |
|---:|---|
| 8 | `/#[0-9a-f]{3,8}\b\|rgba?\(\|hsla?\(/i` — d115Learn, d117CircleUi, d172CoursePages, d172MapTrackBoard, d172YourRun, d178FlyMyRoute, d178PatternsCourse, d190TinyFloating |
| 5 | `/border-radius:\s*(999\|50%)/` — a228SkillMapPage, d105AtlasPages, d167Atlas, d178FlyMyRoute, t10AtsFamiliesChrome |
| 4 | `/999px\|border-radius:\s*50%/` — d115Learn, d116TreeUi, d117CircleUi, d86Byom |

**Absence pins:** 264 files
pin that a retired feature stays gone (`doesNotMatch` + "retired / removed"). They are cheap (< 1 s each) and each one guards a
removal the owner asked for, so the audit keeps them. One sweep worth doing later: where several files pin the SAME removal, keep one.

## 5. Every file

Verdicts: **KEEP (guard)** — protected · **keep · browser tier** — stays, runs before a push (R1) · **faster** / **split** / **merge**
/ **delete** — R2–R5 · **keep** — a fast file (R1 runs it every time). "Saves" is the estimated time off the suite.

| file | time | tests | kind | verdict | why | saves |
|---|---:|---:|---|---|---|---:|
| `j9FullPass.test.js` | 5.7 min | 13 | browser | faster | 12 of its 13 tests are unit rules: move them to a fast file; walk the browser pass in ONE theme (both themes' tokens are pinned by d91ThemeModule / d91Coverage) | 2.8 min |
| `j4PanelBrowser.test.js` | 3.8 min | 5 | browser | faster | the walk runs once per theme: walk Dusk only, keep the both-themes token assertions as a pure test | 1.8 min |
| `d163OtherScreens.test.js` | 3.1 min | 5 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 2.3 min |
| `d100PortalAccounts.test.js` | 1.8 min | 6 | browser | keep · browser tier | three real-Chrome portal walks (sign-up stops at terms / CAPTCHA / emailed code) — D36's never-send rules on a real page |  |
| `a201ShrinkGracefully.test.js` | 1.5 min | 2 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 1.1 min |
| `bindingFirst.test.js` | 1.3 min | 13 | browser | split | 12 of 13 tests are pure (identifyAndBind, lookupPage): split the Chrome walk into its own file; the rest joins the fast tier | 5.0 s |
| `t18GreenhouseChrome.test.js` | 1.3 min | 7 | browser | keep · browser tier | the standard Greenhouse form end to end |  |
| `j6ResumePanelBrowser.test.js` | 1.2 min | 4 | browser | faster | as j4: one theme in Chrome, the theme check pure | 35 s |
| `d153FactsNeverBreakWords.test.js` | 1.2 min | 3 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 53 s |
| `fidelityFullHouse.test.js` | 1.2 min | 1 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 53 s |
| `t10AtsFamiliesChrome.test.js` | 1.1 min | 4 | browser | keep · browser tier | Lever / Workable / Ashby measured forms, real extension |  |
| `t13t14FillChain.test.js` | 1.0 min | 10 | browser | keep · browser tier | one press does the whole chain — the field report's main bug |  |
| `d167Dock.test.js` | 1.0 min | 17 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 45 s |
| `d168OneWayToOpen.test.js` | 1.0 min | 7 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 45 s |
| `a210QuestionsThreadNewRun.test.js` | 1.0 min | 2 | browser | keep · browser tier | the held questions thread walked end to end (A199 / A210) |  |
| `a131NoSidewaysOverflow1280.test.js` | 1.0 min | 2 | browser | faster | its own probe script boots vite + Chrome for one width: fold into the shared fidelity probe (below) | 40 s |
| `t25CardRailSeam.test.js` | 55 s | 4 | browser | faster | the seam test boots Chrome for one hover shadow: read the computed style once at one width | 30 s |
| `d156Home.test.js` | 52 s | 11 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 38 s |
| `t20AutoReadChrome.test.js` | 44 s | 3 | browser | keep · browser tier | consent reads already-open tabs — a permission path |  |
| `a200AskDraftThread.test.js` | 33 s | 4 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 24 s |
| `d163UseTheSpace.test.js` | 32 s | 6 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 23 s |
| `a207ExtensionPrimarySubmit.test.js` | 29 s | 7 | browser | keep · browser tier |  |  |
| `d99Bridge.test.js` | 27 s | 14 | browser | split | most of the 14 are openPosting rules (pure): split the walk out | 5.0 s |
| `d191SidePanelWalk.test.js` | 25 s | 1 | browser | merge | → realExtensionWalks (see a207RealExtensionWalk); its launch flake (46s) is the boot this saves | 8.0 s |
| `d152Home.test.js` | 25 s | 11 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 18 s |
| `t11EmbeddedChrome.test.js` | 21 s | 4 | browser | keep · browser tier | the embedded (iframe) form |  |
| `fidelitySettings.test.js` | 15 s | 1 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 11 s |
| `a186LiveCheck.test.js` | 15 s | 3 | unit | keep | guards A186 |  |
| `a211BackgroundWalk.test.js` | 14 s | 1 | browser | merge | → realExtensionWalks (see a207RealExtensionWalk) | 8.0 s |
| `t9AtsReportComponent.test.js` | 14 s | 16 | browser | split | 16 tests, the token / manifest checks are pure: split them out | 2.0 s |
| `d101StructuredProfile.test.js` | 14 s | 13 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `modelCallGuard.test.js` | 14 s | 6 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `j2ExtensionHarness.test.js` | 14 s | 1 | browser | delete | proves the harness boots — every other real-extension walk (j4, j6, j9, t10, t13t14, t18 …) fails first if it doesn't | 13 s |
| `d97rT12Chrome.test.js` | 14 s | 1 | browser | merge | → realExtensionWalks (see a207RealExtensionWalk) | 8.0 s |
| `a207RealExtensionWalk.test.js` | 14 s | 1 | browser | merge | → one `realExtensionWalks.test.js` with a211RealExtensionWalk, a211BackgroundWalk, d191SidePanelWalk, d112GlobalReadChrome, d97rT12Chrome: one extension boot instead of six | 8.0 s |
| `a211RealExtensionWalk.test.js` | 13 s | 1 | browser | merge | → realExtensionWalks (see a207RealExtensionWalk) | 8.0 s |
| `d100AmazonRunFindings.test.js` | 13 s | 7 | unit | keep | guards D100 |  |
| `t21NoFlicker.test.js` | 12 s | 3 | browser | keep · browser tier |  |  |
| `a186SolveLater.test.js` | 11 s | 7 | unit | keep | guards A186 |  |
| `fidelity.test.js` | 11 s | 1 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 8.1 s |
| `pickerFields.test.js` | 11 s | 8 | browser | keep · browser tier |  |  |
| `fidelityTracker.test.js` | 11 s | 1 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 7.8 s |
| `d99AtsOnPage.test.js` | 11 s | 7 | browser | keep · browser tier | the J12 report in every state, real extension |  |
| `t31ToolbarPress.test.js` | 10 s | 7 | browser | split | ①–④ are pure: split them out | 2.0 s |
| `t24IntentModel.test.js` | 9.9 s | 30 | browser | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d92SurfaceContinuity.test.js` | 9.6 s | 6 | browser | keep · browser tier |  |  |
| `d112GlobalReadChrome.test.js` | 9.5 s | 1 | browser | merge | → realExtensionWalks (see a207RealExtensionWalk) | 5.0 s |
| `pageAnswerMemory.test.js` | 9.2 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `d77DiskAndBackups.test.js` | 8.8 s | 6 | unit | keep | guards D77, D74 |  |
| `a93ModuleManifest.test.js` | 8.8 s | 8 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `t17DockChrome.test.js` | 8.4 s | 8 | browser | keep · browser tier | drives a real browser |  |
| `t27Popups.test.js` | 7.3 s | 4 | browser | keep · browser tier | drives a real browser |  |
| `d99ConsentSwitch.test.js` | 7.1 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `t10ExtensionAbsent.test.js` | 6.8 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `j11BatchAdvance.test.js` | 6.6 s | 4 | other | keep |  |  |
| `a158ReclassifyNeverBlocksTheLoop.test.js` | 5.6 s | 5 | unit | keep | guards A158, A141 |  |
| `d95AdminAccounts.test.js` | 5.5 s | 17 | unit | keep | guards D95 |  |
| `boardFitRanking.test.js` | 5.5 s | 26 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d116Tree.test.js` | 5.4 s | 17 | unit | keep | guards D116 |  |
| `t29SettingsPage.test.js` | 5.2 s | 6 | unit | keep |  |  |
| `applyGuards.test.js` | 5.2 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `backupAsync46g.test.js` | 5.1 s | 4 | unit | keep |  |  |
| `d98ExtensionResume.test.js` | 4.8 s | 18 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d113Picks.test.js` | 4.8 s | 18 | unit | keep | guards D113 |  |
| `a208ConsentPickers.test.js` | 4.7 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `profileSignalClaims.test.js` | 4.5 s | 17 | unit | keep |  |  |
| `d16ApplicationArtifacts.test.js` | 4.3 s | 14 | browser | keep · browser tier | drives a real browser |  |
| `a209ThankYouIsNotSent.test.js` | 4.2 s | 3 | browser | keep · browser tier | drives a real browser |  |
| `d105AtlasSilentZero.test.js` | 4.1 s | 8 | unit | keep |  |  |
| `d183ProfilePage.test.js` | 4.1 s | 15 | unit | keep | guards D183 |  |
| `applyRunPayloadContract.test.js` | 4.0 s | 7 | unit | keep |  |  |
| `d84EnrichmentFixes.test.js` | 4.0 s | 25 | unit | keep | guards D84 |  |
| `d121SponsorshipSignal.test.js` | 3.9 s | 16 | unit | keep | guards D121 |  |
| `d20SlugHarvest.test.js` | 3.8 s | 15 | unit | keep | guards D20, D4 |  |
| `workdayStages.test.js` | 3.8 s | 13 | browser | keep · browser tier | drives a real browser |  |
| `hbFeed.test.js` | 3.8 s | 12 | unit | keep |  |  |
| `d25UserHold.test.js` | 3.8 s | 11 | unit | keep | guards D25 |  |
| `a187AshbySpamFlags.test.js` | 3.6 s | 9 | browser | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d36ApplyPaths.test.js` | 3.6 s | 32 | unit | keep | guards D36 |  |
| `d170TermWeights.test.js` | 3.6 s | 7 | unit | keep | guards D170 |  |
| `d96AnswerLifecycle.test.js` | 3.6 s | 12 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d56ManualHandoff.test.js` | 3.6 s | 11 | server | keep | guards D56 |  |
| `d186OneResumeSetsUpEverything.test.js` | 3.5 s | 10 | unit | keep | guards D186, D184 |  |
| `d117Earned.test.js` | 3.4 s | 10 | unit | keep | guards D117, D115 |  |
| `d108SponsorshipWagesHub.test.js` | 3.4 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a123BootWarmupBounded.test.js` | 3.4 s | 15 | unit | keep | guards A123, D151 |  |
| `d153ClassifyBacklog.test.js` | 3.4 s | 12 | unit | keep | guards D153, D127 |  |
| `d57GeneratedResumeFound.test.js` | 3.2 s | 12 | unit | keep | guards D57 |  |
| `fieldReport1014.test.js` | 3.2 s | 14 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `hbPipeline.test.js` | 3.2 s | 9 | unit | keep | guards D187 |  |
| `d75Crawler.test.js` | 3.2 s | 15 | browser | keep · browser tier | drives a real browser |  |
| `adminStopHarmII.test.js` | 3.2 s | 18 | unit | keep | guards A58, A50, A51 |  |
| `d67LearnedOrigins.test.js` | 3.1 s | 12 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a163AdminReports.test.js` | 3.1 s | 4 | scale | keep | guards A163, A162 |  |
| `d24FitFacetsSorts.test.js` | 3.1 s | 13 | unit | keep | guards D24 |  |
| `accountService.test.js` | 3.0 s | 11 | unit | keep |  |  |
| `d112ApplyAway.test.js` | 3.0 s | 7 | unit | keep | guards D112, D100 |  |
| `d131Testers.test.js` | 3.0 s | 11 | unit | keep | guards D131 |  |
| `d115Learn.test.js` | 3.0 s | 13 | unit | keep | guards D115 |  |
| `d105Atlas.test.js` | 3.0 s | 6 | unit | keep | guards D105 |  |
| `a112CrawlChunks.test.js` | 3.0 s | 3 | unit | keep | guards A112 |  |
| `d164SemiAutoPipeline.test.js` | 3.0 s | 3 | unit | keep | guards D164, D100 |  |
| `d102PipelineWorkspace.test.js` | 3.0 s | 11 | unit | keep | guards D102 |  |
| `a154LeagueChallenges.test.js` | 3.0 s | 11 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d53DraftBin.test.js` | 2.9 s | 9 | unit | keep | guards D53 |  |
| `d64AutoCaptureServer.test.js` | 2.9 s | 10 | unit | keep | guards D64 |  |
| `d103Inbox.test.js` | 2.9 s | 13 | unit | keep | guards D103 |  |
| `a63BoardToolsPending.test.js` | 2.9 s | 13 | unit | keep | guards A52, A63 |  |
| `d112dEducationSource.test.js` | 2.9 s | 5 | unit | keep | guards D112 |  |
| `d59PostingNormalize.test.js` | 2.8 s | 20 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `pipelineAlertDelivery.test.js` | 2.8 s | 13 | unit | keep |  |  |
| `profileEnhancementAggregation.test.js` | 2.8 s | 15 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d83AdminEnrichment.test.js` | 2.8 s | 21 | unit | keep | guards D83 |  |
| `a80LcaResolutionTransfer.test.js` | 2.8 s | 5 | unit | keep | guards A80, D17 |  |
| `a111AtlasCategories.test.js` | 2.7 s | 4 | unit | keep | guards A111, D127, D105 |  |
| `j6ResumePanel.test.js` | 2.7 s | 13 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d112Gmail.test.js` | 2.7 s | 6 | unit | keep | guards D112, D103 |  |
| `d125AtsCalibration.test.js` | 2.7 s | 9 | unit | keep | guards D125 |  |
| `j5AutoRead.test.js` | 2.7 s | 25 | unit | keep | guards D97 |  |
| `d117CircleUi.test.js` | 2.6 s | 11 | unit | keep | guards D117 |  |
| `dedupCrossSourceIdentity.test.js` | 2.6 s | 10 | unit | keep | guards A49 |  |
| `atsTermWeightsSchedule.test.js` | 2.6 s | 19 | unit | keep |  |  |
| `d114AtlasInPostings.test.js` | 2.6 s | 15 | unit | keep | guards D114 |  |
| `d116YourMap.test.js` | 2.6 s | 8 | unit | keep | guards D116 |  |
| `t5Assistant.test.js` | 2.6 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d118AtlasLive.test.js` | 2.6 s | 6 | unit | keep | guards D118 |  |
| `d88People.test.js` | 2.6 s | 10 | unit | keep | guards D88 |  |
| `d117CircleData.test.js` | 2.5 s | 6 | unit | keep | guards D117, D115 |  |
| `d113ui.test.js` | 2.5 s | 24 | unit | keep (merge candidate) | shares 6 assertions with `d146Tracker` |  |
| `a80SynonymTransfer.test.js` | 2.5 s | 6 | unit | keep | guards A80, D17 |  |
| `d137GhostScore.test.js` | 2.5 s | 12 | unit | keep | guards D137 |  |
| `d100ApplyWorker.test.js` | 2.5 s | 8 | unit | keep | guards D100 |  |
| `d123P6eDraftSide.test.js` | 2.5 s | 3 | unit | keep | guards D123 |  |
| `d105AtlasEditor.test.js` | 2.5 s | 8 | unit | keep |  |  |
| `d173OneDefinitionPerMetric.test.js` | 2.5 s | 2 | unit | keep | guards D173 |  |
| `d76RailwayHook.test.js` | 2.5 s | 8 | unit | keep | guards D76 |  |
| `t11EmbeddedForm.test.js` | 2.5 s | 12 | browser | keep · browser tier | drives a real browser |  |
| `d112WebPush.test.js` | 2.5 s | 11 | unit | keep | guards D112 |  |
| `a228SkillMap.test.js` | 2.5 s | 9 | unit | keep | guards A228 |  |
| `d94EmailHealth.test.js` | 2.4 s | 8 | unit | keep | guards D94 |  |
| `syncEventsSingleConnection.test.js` | 2.4 s | 15 | source-pin | keep |  |  |
| `d118LiveCounts.test.js` | 2.4 s | 6 | scale | keep | guards D118 |  |
| `d119Thumbnails.test.js` | 2.4 s | 11 | unit | keep | guards D119 |  |
| `d136BestBets.test.js` | 2.4 s | 10 | unit | keep | guards D136 |  |
| `d180Connections.test.js` | 2.4 s | 8 | unit | keep | guards D180, D183 |  |
| `d169YourSkills.test.js` | 2.4 s | 7 | unit | keep | guards D169 |  |
| `d143Navigator.test.js` | 2.4 s | 9 | unit | keep | guards D143 |  |
| `d180Messages.test.js` | 2.3 s | 9 | unit | keep | guards D180 |  |
| `brandAndOriginGuard.test.js` | 2.3 s | 12 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d55TableCsv.test.js` | 2.3 s | 7 | unit | keep | guards D55, D54 |  |
| `atsRankingHonesty.test.js` | 2.3 s | 18 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d150AuditRoleCard.test.js` | 2.3 s | 4 | unit | keep | guards D150, D123 |  |
| `d82Discovery.test.js` | 2.3 s | 9 | unit | keep | guards D82 |  |
| `atlasSearchNormalize.test.js` | 2.2 s | 8 | unit | keep | guards D115, D114 |  |
| `d33InstallState.test.js` | 2.2 s | 5 | unit | keep | guards D33 |  |
| `d112DemoteAcrossPages.test.js` | 2.2 s | 5 | unit | keep | guards D112, D104 |  |
| `a111ProfessionalVocabulary.test.js` | 2.2 s | 4 | unit | keep | guards A111 |  |
| `a167Monetisation.test.js` | 2.2 s | 8 | unit | keep | guards A167 |  |
| `d65PayloadResume.test.js` | 2.2 s | 11 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d33CapturePath.test.js` | 2.2 s | 7 | unit | keep | guards D33, D29 |  |
| `d66BaseResumeOnly.test.js` | 2.2 s | 8 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a123AtlasPassOffloaded.test.js` | 2.2 s | 3 | scale | keep | guards A123 |  |
| `atlasBoilerplateNotSkills.test.js` | 2.2 s | 6 | unit | keep |  |  |
| `dedupRetiresUserState.test.js` | 2.1 s | 7 | unit | keep | guards A49 |  |
| `applicationResponseOutcome.test.js` | 2.1 s | 24 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `deckBugNoBlockedLoop.test.js` | 2.1 s | 9 | unit | keep | guards A112 |  |
| `customAnswersPlumbing.test.js` | 2.1 s | 15 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d75bCrawlerControls.test.js` | 2.1 s | 8 | unit | keep | guards D75 |  |
| `d51DraftSeenEverywhere.test.js` | 2.1 s | 11 | unit | keep | guards D51 |  |
| `d99BoardJob.test.js` | 2.1 s | 6 | unit | keep | guards D99 |  |
| `d105AtlasPages.test.js` | 2.1 s | 9 | unit | keep | guards D105 |  |
| `d180Feed.test.js` | 2.0 s | 7 | unit | keep | guards D180 |  |
| `d109Proof.test.js` | 2.0 s | 6 | unit | keep | guards D109 |  |
| `d142Readiness.test.js` | 2.0 s | 7 | unit | keep | guards D142 |  |
| `d105AtlasPublish.test.js` | 2.0 s | 6 | unit | keep | guards D105 |  |
| `d73Email.test.js` | 2.0 s | 8 | unit | keep | guards D73 |  |
| `learnPanelOverflow.test.js` | 1.9 s | 5 | browser | keep · browser tier | drives a real browser |  |
| `hbInfra.test.js` | 1.9 s | 9 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `crawlNoRoleRescue.test.js` | 1.9 s | 6 | unit | keep |  |  |
| `d110InterviewMode.test.js` | 1.9 s | 5 | unit | keep | guards D110 |  |
| `j1Progress.test.js` | 1.9 s | 12 | server | keep | guards D96, D23 |  |
| `d75J1Score.test.js` | 1.9 s | 14 | unit | keep | guards D75 |  |
| `a126ReadWorkerPool.test.js` | 1.9 s | 5 | unit | keep | guards A126 |  |
| `a179ApplyHonesty.test.js` | 1.9 s | 13 | unit | keep | guards A179 |  |
| `d107Liveness.test.js` | 1.8 s | 7 | unit | keep | guards D107 |  |
| `d55ContextMenuFormReport.test.js` | 1.8 s | 13 | unit | keep | guards D55 |  |
| `hnCompanyNames.test.js` | 1.8 s | 10 | unit | keep |  |  |
| `t26DockSurface.test.js` | 1.8 s | 9 | browser | keep · browser tier | drives a real browser |  |
| `accountManagementRoutes.test.js` | 1.8 s | 5 | unit | keep |  |  |
| `d33CaptureSaysWhy.test.js` | 1.8 s | 10 | unit | keep | guards D33 |  |
| `d80CompanyEvidence.test.js` | 1.8 s | 7 | browser | keep · browser tier | drives a real browser |  |
| `crawlSkipCounters.test.js` | 1.8 s | 5 | unit | keep |  |  |
| `d138WarmPaths.test.js` | 1.8 s | 7 | browser | keep · browser tier | drives a real browser |  |
| `d54CompanyTracking.test.js` | 1.8 s | 8 | unit | keep | guards D54 |  |
| `d150QuestionBank.test.js` | 1.7 s | 7 | unit | keep | guards D150 |  |
| `d185MatchAlerts.test.js` | 1.7 s | 5 | unit | keep | guards D185 |  |
| `d88Tickets.test.js` | 1.7 s | 7 | unit | keep | guards D88 |  |
| `d130StandaloneSurvey.test.js` | 1.7 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d128PublicJobPages.test.js` | 1.7 s | 6 | unit | keep | guards D128 |  |
| `a62JobGateway.test.js` | 1.7 s | 6 | unit | keep | guards A62, A45 |  |
| `b3FamilyPause.test.js` | 1.7 s | 4 | unit | keep |  |  |
| `d171StartedByAndUsage.test.js` | 1.7 s | 6 | unit | keep | guards D171 |  |
| `d105AtlasDefinitions.test.js` | 1.7 s | 6 | unit | keep | guards D105 |  |
| `d184ResumeChange.test.js` | 1.7 s | 11 | unit | keep | guards D184 |  |
| `t30Acceptance.test.js` | 1.7 s | 1 | browser | keep · browser tier | drives a real browser |  |
| `d41CapturedJob.test.js` | 1.7 s | 10 | unit | keep | guards D41 |  |
| `t10AccountStates.test.js` | 1.6 s | 3 | unit | keep |  |  |
| `d82RetireRule.test.js` | 1.6 s | 4 | unit | keep | guards D82 |  |
| `o100DockSubmitted.test.js` | 1.6 s | 4 | browser | keep · browser tier | drives a real browser |  |
| `autofillCompleteness.test.js` | 1.6 s | 6 | browser | keep · browser tier | drives a real browser |  |
| `d111SplitByVersion.test.js` | 1.6 s | 4 | unit | keep | guards D111, D90, D107 |  |
| `a50CompanyList.test.js` | 1.6 s | 5 | unit | keep | guards A50 |  |
| `deckGeometryControl.test.js` | 1.6 s | 14 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `baseHashTrim.test.js` | 1.5 s | 4 | unit | keep |  |  |
| `d33ImportDeterministic.test.js` | 1.5 s | 6 | unit | keep | guards D33, D17 |  |
| `d78BoardAge.test.js` | 1.5 s | 7 | unit | keep | guards D78 |  |
| `t28Launcher.test.js` | 1.5 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `d167Atlas.test.js` | 1.5 s | 8 | unit | keep | guards D167, D114, D115 |  |
| `d105RolePages.test.js` | 1.5 s | 3 | unit | keep | guards D105, D106, D116 |  |
| `j4PanelLifecycle.test.js` | 1.5 s | 19 | browser | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d43ApplicationSurvivesPosting.test.js` | 1.5 s | 4 | unit | keep | guards D43, O43, A90 |  |
| `a159CompanyTechAggOffLoop.test.js` | 1.5 s | 4 | unit | keep | guards A159 |  |
| `d86Byom.test.js` | 1.5 s | 26 | unit | keep | guards D86 |  |
| `a202AnswersTakenByForm.test.js` | 1.5 s | 5 | browser | keep · browser tier | drives a real browser |  |
| `d71PayFromText.test.js` | 1.5 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d120ResumeMap.test.js` | 1.5 s | 4 | unit | keep | guards D120, D101, D65 |  |
| `d58TailoredScore.test.js` | 1.5 s | 6 | unit | keep | guards D58 |  |
| `d123PayloadDraft.test.js` | 1.5 s | 5 | unit | keep | guards D123 |  |
| `d78CsScope.test.js` | 1.5 s | 12 | unit | keep | guards D78 |  |
| `b1Placement.test.js` | 1.5 s | 4 | unit | keep |  |  |
| `atsStoredScoreCurrent.test.js` | 1.5 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a112AtlasBoardRoles.test.js` | 1.4 s | 6 | unit | keep | guards A112 |  |
| `a158PublicOpenJobs.test.js` | 1.4 s | 3 | unit | keep | guards A158 |  |
| `d151BoardFitPlanOffLoop.test.js` | 1.4 s | 3 | scale | keep | guards D151, A126 |  |
| `d80CompanyHeat.test.js` | 1.4 s | 5 | unit | keep | guards D80 |  |
| `d112cPendingMoves.test.js` | 1.4 s | 3 | unit | keep | guards D112, D43 |  |
| `savedOutsideUs.test.js` | 1.4 s | 4 | unit | keep | guards A62 |  |
| `dedupRetiredSurvivesExpiry.test.js` | 1.3 s | 4 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d105AtlasRealAnswers.test.js` | 1.3 s | 6 | unit | keep |  |  |
| `d65WorkedHere.test.js` | 1.3 s | 3 | unit | keep | guards D65, D55 |  |
| `d104Eligibility.test.js` | 1.3 s | 10 | unit | keep | guards D104 |  |
| `hbAdmin.test.js` | 1.3 s | 4 | unit | keep | guards D187 |  |
| `d151RequestPathPool.test.js` | 1.3 s | 7 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `o80cPacketResume.test.js` | 1.3 s | 4 | unit | keep | guards D52 |  |
| `liveFormMarkup.test.js` | 1.3 s | 9 | browser | keep · browser tier | drives a real browser |  |
| `a148AccountSwitch.test.js` | 1.3 s | 5 | unit | keep | guards A148 |  |
| `workdaySuggestionSlug.test.js` | 1.3 s | 3 | unit | keep |  |  |
| `d13Companion.test.js` | 1.3 s | 4 | unit | keep | guards D13 |  |
| `d139CareerChangers.test.js` | 1.3 s | 5 | unit | keep | guards D139 |  |
| `a104ResumeStartsProfile.test.js` | 1.2 s | 4 | unit | keep | guards A104 |  |
| `a189SubmitRetryBackoff.test.js` | 1.2 s | 10 | browser | keep · browser tier | drives a real browser |  |
| `d29JobTags.test.js` | 1.2 s | 11 | unit | keep | guards D29, D27 |  |
| `d167Profile.test.js` | 1.2 s | 7 | unit | keep | guards D167 |  |
| `a198PayloadPartsKept.test.js` | 1.2 s | 7 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `jobRoleMapBackfill.test.js` | 1.2 s | 13 | unit | keep |  |  |
| `a112AtlasDraftedDefinitions.test.js` | 1.2 s | 5 | unit | keep | guards A112, D105 |  |
| `a123BoardFitReconcile.test.js` | 1.2 s | 4 | unit | keep | guards A123 |  |
| `d75cWorkerLifecycle.test.js` | 1.2 s | 5 | unit | keep | guards D75 |  |
| `a126BoardMatchQueue.test.js` | 1.2 s | 6 | unit | keep | guards A126 |  |
| `b2BoardFollows.test.js` | 1.2 s | 4 | unit | keep |  |  |
| `a176PostingInputHashes.test.js` | 1.2 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `enrichmentChunks.test.js` | 1.2 s | 3 | unit | keep |  |  |
| `sessionsTwoAccounts.test.js` | 1.1 s | 6 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `t34GenericExtractor.test.js` | 1.1 s | 5 | browser | keep · browser tier | drives a real browser |  |
| `d157ResumeEditorEmbed.test.js` | 1.1 s | 8 | unit | keep | guards D157, D171 |  |
| `seedNonTechCandidates.test.js` | 1.1 s | 2 | unit | keep | guards D82 |  |
| `t10PlanLimit.test.js` | 1.1 s | 3 | unit | keep |  |  |
| `dedupDonationWriteBack.test.js` | 1.1 s | 4 | unit | keep | guards A49 |  |
| `d81HarvestPlan.test.js` | 1.1 s | 4 | unit | keep | guards D81, D20 |  |
| `d151TeachIndexOnce.test.js` | 1.0 s | 2 | scale | keep | guards D151 |  |
| `d15TheTable.test.js` | 1.0 s | 12 | unit | keep | guards D15 |  |
| `d97rT12AlwaysRead.test.js` | 1.0 s | 16 | unit | keep | guards D97 |  |
| `d55FunnelOutcomes.test.js` | 1.0 s | 5 | unit | keep | guards D55, D15 |  |
| `a139BoardFitIdleAccounts.test.js` | 1.0 s | 3 | unit | keep | guards A139 |  |
| `a166RunNowAndBatch.test.js` | 1.0 s | 3 | unit | keep | guards A166 |  |
| `a181HeldAndRerun.test.js` | 1.0 s | 9 | unit | keep | guards A181 |  |
| `a228SkillMapPage.test.js` | 1.0 s | 8 | unit | keep | guards A228 |  |
| `d63ExtensionRedesign.test.js` | 1.0 s | 4 | unit | keep | guards D63, D50 |  |
| `d180Leftovers45s.test.js` | 1.0 s | 3 | unit | keep | guards D180 |  |
| `a59DraftLine.test.js` | 1.0 s | 16 | unit | keep | guards A59, O44 |  |
| `a190PasswordOffThread.test.js` | 1.0 s | 3 | unit | keep | guards A190 |  |
| `d151ArchiveClosedPostings.test.js` | 1.0 s | 3 | unit | keep | guards D151 |  |
| `d154AtsSourceReminder.test.js` | 1.0 s | 2 | unit | keep | guards D154 |  |
| `d112GlobalRead.test.js` | 1.0 s | 12 | unit | keep | guards D112, D78, D64 |  |
| `d185SponsorPagesMinimumCount.test.js` | 1.0 s | 3 | unit | keep | guards D185, D121 |  |
| `d178ProofPage.test.js` | 1.0 s | 7 | scale | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `m7FirstResumePlaced.test.js` | 1.0 s | 2 | unit | keep | guards D184 |  |
| `a112BoardFitScope.test.js` | 0.9 s | 3 | unit | keep | guards A112 |  |
| `authPasswordReset.test.js` | 0.9 s | 4 | unit | keep |  |  |
| `d108SponsorshipFacts.test.js` | 0.9 s | 3 | unit | keep | guards D108 |  |
| `a175BoardKeptOrder.test.js` | 0.9 s | 7 | scale | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d106RealLevel.test.js` | 0.9 s | 6 | unit | keep | guards D106 |  |
| `d175FullAutoPrerequisitesGate.test.js` | 0.9 s | 4 | unit | keep | guards D175, D173 |  |
| `a2RunTrace.test.js` | 0.9 s | 3 | unit | keep |  |  |
| `d185RisingSkillsDraftOnly.test.js` | 0.9 s | 2 | unit | keep | guards D185 |  |
| `a128DockFootInset.test.js` | 0.9 s | 2 | browser | keep · browser tier | drives a real browser |  |
| `aplusOverride.test.js` | 0.9 s | 3 | unit | keep |  |  |
| `termsOptIn.test.js` | 0.9 s | 4 | unit | keep | guards A103 |  |
| `a174OrphanSweepBounded.test.js` | 0.9 s | 3 | scale | keep | guards A174, A173 |  |
| `b4OtherProfilesUntouched.test.js` | 0.9 s | 1 | unit | keep |  |  |
| `d164ResumeControls.test.js` | 0.9 s | 4 | source-pin | keep | guards D164, D147 |  |
| `d162NoFeatureNamesAModel.test.js` | 0.9 s | 2 | source-pin | keep | guards D162 |  |
| `a53DecisionVocabulary.test.js` | 0.9 s | 14 | unit | keep | guards A53 |  |
| `a160WorkdaySeed.test.js` | 0.9 s | 2 | unit | keep | guards A160 |  |
| `d105AtlasFind.test.js` | 0.9 s | 4 | unit | keep | guards D105 |  |
| `d12ExtensionInstall.test.js` | 0.9 s | 5 | unit | keep | guards D12, D11 |  |
| `o56aHistoryResumeArtifact.test.js` | 0.9 s | 4 | unit | keep | guards O56, D15, D16 |  |
| `d100PortalsUi.test.js` | 0.9 s | 2 | unit | keep | guards D100 |  |
| `a105ClickSweep.test.js` | 0.9 s | 8 | unit | keep | guards A105 |  |
| `d74CrawlAge.test.js` | 0.9 s | 3 | unit | keep | guards D74 |  |
| `d171PostingFromHome.test.js` | 0.9 s | 3 | unit | keep | guards D171 |  |
| `a188StagingGuard.test.js` | 0.9 s | 8 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d40ImportView.test.js` | 0.9 s | 6 | unit | keep | guards D40, D156 |  |
| `a50JobLifecycle.test.js` | 0.8 s | 2 | unit | keep | guards A50 |  |
| `d111NeverReadsRejectionNote.test.js` | 0.8 s | 3 | unit | keep | guards D111, D17 |  |
| `applyRunHistory.test.js` | 0.8 s | 37 | unit | keep |  |  |
| `d123CompareHarness.test.js` | 0.8 s | 4 | unit | keep | guards D123 |  |
| `pipelineHealth.test.js` | 0.8 s | 37 | unit | keep |  |  |
| `applyApprovalFlow.test.js` | 0.8 s | 17 | unit | keep |  |  |
| `generationDeferral.test.js` | 0.8 s | 19 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `gatePortalBatch.test.js` | 0.8 s | 13 | unit | keep |  |  |
| `d152PicksPerDay.test.js` | 0.8 s | 6 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `applyHeldResumable.test.js` | 0.8 s | 19 | unit | keep |  |  |
| `dedupFingerprintVariants.test.js` | 0.8 s | 5 | unit | keep | guards A49 |  |
| `approvalCap.test.js` | 0.8 s | 14 | unit | keep |  |  |
| `customAnswersCapture.test.js` | 0.8 s | 13 | unit | keep |  |  |
| `d185QuestionsAndDrafts.test.js` | 0.8 s | 3 | unit | keep | guards D185, D173 |  |
| `applyCorrectionLoop.test.js` | 0.8 s | 11 | unit | keep |  |  |
| `applyReviewArtifacts.test.js` | 0.8 s | 11 | unit | keep | guards A3, A2 |  |
| `a189SubmitAfterAnswers.test.js` | 0.8 s | 6 | unit | keep | guards A189, A185 |  |
| `a61EnrichmentButton.test.js` | 0.8 s | 2 | unit | keep | guards A61, D17 |  |
| `d165ScopedSalary.test.js` | 0.8 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `formLearningConsentUi.test.js` | 0.8 s | 12 | unit | keep |  |  |
| `applyPendingUi.test.js` | 0.8 s | 11 | unit | keep | guards D171 |  |
| `applyQuestionsUi.test.js` | 0.8 s | 6 | unit | keep |  |  |
| `d190Assistant.test.js` | 0.8 s | 24 | browser | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `applySessionRetired.test.js` | 0.7 s | 5 | unit | keep | guards D100, D79 |  |
| `d120Home.test.js` | 0.7 s | 2 | unit | keep | guards D120, A228 |  |
| `a189StuckSubmittingSweeper.test.js` | 0.7 s | 7 | unit | keep | guards A189, A185 |  |
| `applyRunsUiContract.test.js` | 0.7 s | 8 | unit | keep |  |  |
| `autoApplyRecentDefault.test.js` | 0.7 s | 8 | unit | keep | guards D25, D113 |  |
| `d165SaveScopeLabel.test.js` | 0.7 s | 4 | unit | keep | guards D165 |  |
| `applyAuditResilience.test.js` | 0.7 s | 8 | unit | keep |  |  |
| `d86ConnectorCompliance.test.js` | 0.7 s | 17 | unit | keep | guards D86 |  |
| `d155DeckQuestionsImport.test.js` | 0.7 s | 2 | unit | keep | guards D155 |  |
| `d126d127Categories.test.js` | 0.7 s | 12 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d185UnlockJobsMoveATier.test.js` | 0.7 s | 2 | unit | keep | guards D185 |  |
| `trackingFailureWebhook.test.js` | 0.7 s | 9 | unit | keep |  |  |
| `ingestFunnel.test.js` | 0.7 s | 8 | unit | keep | guards D78 |  |
| `d88TagsHidden.test.js` | 0.7 s | 3 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d172CoursePages.test.js` | 0.7 s | 6 | unit | keep | guards D172 |  |
| `accessLevels.test.js` | 0.7 s | 3 | unit | keep |  |  |
| `d151JobCapturesIndex.test.js` | 0.7 s | 3 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `deckFirstScores.test.js` | 0.7 s | 4 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d100FullAutoIsUserMode.test.js` | 0.7 s | 4 | unit | keep | guards D100, D36 |  |
| `a87AnthropicOnly.test.js` | 0.7 s | 5 | source-pin | keep | guards A87, D17 |  |
| `d74VisitLens.test.js` | 0.7 s | 4 | unit | keep | guards D74 |  |
| `a170UsageWithoutUser.test.js` | 0.7 s | 2 | unit | keep | guards A170 |  |
| `t18FieldSemantics.test.js` | 0.7 s | 17 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d86GrantTypes.test.js` | 0.7 s | 4 | unit | keep | guards D86 |  |
| `adminDbInspector.test.js` | 0.7 s | 3 | unit | keep | guards A50 |  |
| `colorLiteralGuard.test.js` | 0.7 s | 6 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a178LogoPassBounded.test.js` | 0.7 s | 2 | scale | keep | guards A178 |  |
| `d72TagRegistry.test.js` | 0.7 s | 4 | unit | keep | guards D72 |  |
| `campaignRecord.test.js` | 0.7 s | 19 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a85FitFilterMatchesBadge.test.js` | 0.7 s | 2 | unit | keep | guards A85 |  |
| `d78JoboRetired.test.js` | 0.6 s | 4 | unit | keep | guards D78 |  |
| `d100ApplyWorkerService.test.js` | 0.6 s | 6 | unit | keep | guards D100 |  |
| `viewTransitions.test.js` | 0.6 s | 9 | source-pin | keep |  |  |
| `d17ModelCallSites.test.js` | 0.6 s | 11 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `enrichmentRoutes.test.js` | 0.6 s | 14 | unit | keep |  |  |
| `inkPairD32.test.js` | 0.6 s | 19 | unit | keep | guards D32, D31, D29 |  |
| `pdfTextFallback.test.js` | 0.6 s | 2 | unit | keep | guards D17 |  |
| `d126AtsDisciplines.test.js` | 0.6 s | 4 | unit | keep | guards D126 |  |
| `registryPlacement.test.js` | 0.6 s | 5 | unit | keep |  |  |
| `taleoSource.test.js` | 0.6 s | 3 | unit | keep | guards A161 |  |
| `a112Bamboohr.test.js` | 0.6 s | 5 | unit | keep | guards A112 |  |
| `boardSecondLoadParity.test.js` | 0.6 s | 8 | unit | keep |  |  |
| `a161Icims.test.js` | 0.6 s | 6 | unit | keep | guards A161 |  |
| `d147FullHousePosting.test.js` | 0.6 s | 12 | source-pin | keep | guards D147 |  |
| `jobsImport.test.js` | 0.6 s | 15 | other | keep |  |  |
| `a1RunJobAlwaysHasResumeOrReason.test.js` | 0.6 s | 2 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d178PatternsCourse.test.js` | 0.6 s | 4 | unit | keep | guards D178 |  |
| `d93Customise.test.js` | 0.6 s | 11 | unit | keep | guards D93, D92 |  |
| `filterOptionContract.test.js` | 0.6 s | 17 | unit | keep |  |  |
| `a197RunAgainAnswersMore.test.js` | 0.6 s | 8 | unit | keep |  |  |
| `automationTier.test.js` | 0.5 s | 14 | unit | keep |  |  |
| `oracleSource.test.js` | 0.5 s | 3 | unit | keep | guards A161 |  |
| `adminPanelA50.test.js` | 0.5 s | 12 | unit | keep | guards A50 |  |
| `productionOriginConsistency.test.js` | 0.5 s | 4 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `jobsImportReachability.test.js` | 0.5 s | 12 | unit | keep |  |  |
| `usOnlyBoard.test.js` | 0.5 s | 10 | unit | keep |  |  |
| `a182AutomateFromResume.test.js` | 0.5 s | 5 | unit | keep | guards A182 |  |
| `d185SchemaFromAtsEndpoints.test.js` | 0.5 s | 7 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a112DiscoverBoards.test.js` | 0.5 s | 4 | unit | keep | guards A112 |  |
| `a189HostedGreenhouseForm.test.js` | 0.5 s | 3 | unit | keep | guards A189 |  |
| `d55fSavedAnswersManage.test.js` | 0.5 s | 6 | unit | keep | guards D55 |  |
| `successFactorsSource.test.js` | 0.5 s | 5 | unit | keep |  |  |
| `a199AskDraftCompanion.test.js` | 0.5 s | 3 | unit | keep | guards A199 |  |
| `detailFetch.test.js` | 0.5 s | 33 | unit | keep |  |  |
| `salaryCurrencyPersistence.test.js` | 0.5 s | 7 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d55fSavedAnswerReuse.test.js` | 0.5 s | 10 | unit | keep | guards D55, D36 |  |
| `d23ExtensionLook.test.js` | 0.5 s | 7 | unit | keep | guards D23, D13, D19 |  |
| `reimportPreservesEnrichment.test.js` | 0.5 s | 6 | unit | keep |  |  |
| `d191Extension.test.js` | 0.5 s | 17 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d184PublicExperienceLinks.test.js` | 0.5 s | 1 | unit | keep | guards D184 |  |
| `atsCompanyGrouping.test.js` | 0.5 s | 5 | unit | keep |  |  |
| `jobsEmploymentType.test.js` | 0.5 s | 5 | unit | keep |  |  |
| `costVisibility.test.js` | 0.5 s | 10 | unit | keep | guards D17 |  |
| `d151ScoreWorker.test.js` | 0.5 s | 3 | unit | keep | guards D151 |  |
| `atsReportOneImplementation.test.js` | 0.5 s | 4 | source-pin | keep | guards A52 |  |
| `d183P4Message.test.js` | 0.5 s | 2 | unit | keep | guards D183, D180 |  |
| `formReadiness.test.js` | 0.5 s | 10 | source-pin | keep |  |  |
| `a76GradeTransfer.test.js` | 0.5 s | 15 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `dropImportExtensionTokens.test.js` | 0.5 s | 4 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `atsEngineWeighting.test.js` | 0.5 s | 20 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a195FacetsParallel.test.js` | 0.5 s | 3 | scale | keep | guards A195 |  |
| `a148SearchScopes.test.js` | 0.5 s | 2 | unit | keep | guards A148 |  |
| `d6DraftNavLabel.test.js` | 0.4 s | 5 | source-pin | keep | guards D6, A53 |  |
| `enrichmentTransfer.test.js` | 0.4 s | 42 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d172Guides.test.js` | 0.4 s | 4 | unit | keep | guards D172 |  |
| `d172YourRun.test.js` | 0.4 s | 6 | scale | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d42FilterInvariant.test.js` | 0.4 s | 9 | unit | keep | guards D42, D30 |  |
| `d179DeckAndSearch.test.js` | 0.4 s | 4 | unit | keep | guards A150, D179, A145 |  |
| `serpapiLocale.test.js` | 0.4 s | 2 | unit | keep | guards D4, A37 |  |
| `assistantAdminsOwnAccount.test.js` | 0.4 s | 3 | unit | keep | guards A212, D95 |  |
| `migrationsAreTransactional.test.js` | 0.4 s | 9 | unit | keep |  |  |
| `testingRecordsRetention.test.js` | 0.4 s | 3 | unit | keep |  |  |
| `boardCurationDisclosure.test.js` | 0.4 s | 11 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `lcaSponsorshipSurface.test.js` | 0.4 s | 16 | unit | keep |  |  |
| `a107AdminReadsOmitRejectionNote.test.js` | 0.4 s | 2 | unit | keep | guards A107 |  |
| `postingGrade.test.js` | 0.4 s | 10 | unit | keep |  |  |
| `lateLowerMigrations.test.js` | 0.4 s | 3 | unit | keep | guards D16, A76 |  |
| `a142CompanyRecordsAdmin.test.js` | 0.4 s | 3 | unit | keep | guards A142, D179 |  |
| `a144CompaniesTab.test.js` | 0.4 s | 3 | unit | keep | guards A144 |  |
| `d74ClassifierAnchors.test.js` | 0.4 s | 4 | unit | keep | guards D74 |  |
| `derivedFiltersRank.test.js` | 0.4 s | 7 | unit | keep |  |  |
| `d185OutcomesPerUser.test.js` | 0.4 s | 3 | unit | keep | guards D185, D111 |  |
| `jobQueryFilters.test.js` | 0.4 s | 7 | unit | keep |  |  |
| `atsScoreIsPerProfile.test.js` | 0.4 s | 8 | unit | keep |  |  |
| `formSchemaCapture.test.js` | 0.4 s | 26 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a91PendingView.test.js` | 0.4 s | 3 | unit | keep | guards A91, D41, D51 |  |
| `mobileApiContract.test.js` | 0.4 s | 21 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `matchScoreReachesTheClient.test.js` | 0.4 s | 8 | unit | keep |  |  |
| `a171ManagementNotProduct.test.js` | 0.4 s | 2 | unit | keep | guards A171, D127 |  |
| `publicCompanyJoinOrder.test.js` | 0.4 s | 2 | scale | keep | guards D191 |  |
| `costBreakdown46a.test.js` | 0.4 s | 1 | unit | keep |  |  |
| `d175PicksPreferUnattendedFamilies.test.js` | 0.4 s | 6 | unit | keep | guards D175 |  |
| `jobQueryTierFilters.test.js` | 0.4 s | 12 | unit | keep |  |  |
| `salaryPeriodVocabulary.test.js` | 0.4 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d123LeanTailoringDraft.test.js` | 0.4 s | 7 | unit | keep | guards D123 |  |
| `menuSurfaceStyle.test.js` | 0.4 s | 12 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d111ExcludesWithdrawn.test.js` | 0.4 s | 1 | unit | keep | guards D111 |  |
| `restoreStrippedSeniority.test.js` | 0.4 s | 7 | unit | keep |  |  |
| `a155OneStreak.test.js` | 0.4 s | 3 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `boardSkillMatching.test.js` | 0.4 s | 11 | unit | keep |  |  |
| `boardFiltersVisible.test.js` | 0.4 s | 5 | unit | keep | guards A73 |  |
| `d111CountsRejectionPicks.test.js` | 0.4 s | 4 | unit | keep | guards D111 |  |
| `a153ProfileGaps.test.js` | 0.4 s | 4 | unit | keep | guards A153, D183 |  |
| `d156FacetsOffTheLoop.test.js` | 0.4 s | 7 | unit | keep | guards D156, D151 |  |
| `d178Readiness.test.js` | 0.4 s | 5 | unit | keep | guards D178, A228 |  |
| `a175ClosenessMemo46g.test.js` | 0.4 s | 2 | unit | keep | guards A175 |  |
| `a147JobsEntry.test.js` | 0.4 s | 2 | unit | keep | guards A147 |  |
| `starredJobsSurviveExpiry.test.js` | 0.4 s | 10 | unit | keep |  |  |
| `unenrichedRowSurvivesBoard.test.js` | 0.4 s | 6 | unit | keep |  |  |
| `d151FacetsOneGroupBy.test.js` | 0.4 s | 2 | unit | keep | guards D151 |  |
| `d55AutofillEntries.test.js` | 0.4 s | 8 | unit | keep | guards D55 |  |
| `d178RunStreakMarks.test.js` | 0.4 s | 3 | unit | keep | guards D178, A155 |  |
| `d79SpikeSession.test.js` | 0.4 s | 7 | browser | keep · browser tier | drives a real browser |  |
| `resumeCurrencyAndFillLog.test.js` | 0.4 s | 23 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `backupRetention.test.js` | 0.4 s | 28 | unit | keep | guards A65 |  |
| `placeholderLocation.test.js` | 0.4 s | 5 | unit | keep | guards D156 |  |
| `d55fWorkedHere.test.js` | 0.4 s | 7 | unit | keep | guards D55 |  |
| `applyGatePacket.test.js` | 0.4 s | 20 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d55SavedAnswersExtension.test.js` | 0.4 s | 11 | unit | keep | guards D55 |  |
| `d86ConnectorDocs.test.js` | 0.4 s | 4 | unit | keep | guards D86 |  |
| `extensionSubmission.test.js` | 0.4 s | 8 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `atsBadgeAbsentWithoutScore.test.js` | 0.4 s | 4 | unit | keep |  |  |
| `d90ResumeChanges.test.js` | 0.4 s | 10 | unit | keep | guards D90 |  |
| `d18NavAmendments.test.js` | 0.4 s | 6 | source-pin | keep | guards D18, D10, D6 |  |
| `d185SourceAttribution.test.js` | 0.4 s | 2 | unit | keep | guards D185 |  |
| `d52StartTheQueue.test.js` | 0.4 s | 5 | unit | keep | guards D52, D17 |  |
| `a113TitleFirstHeader.test.js` | 0.4 s | 3 | unit | keep | guards A113, D138 |  |
| `credentialFields.test.js` | 0.4 s | 29 | source-pin | keep |  |  |
| `d178ConceptsInGlossary.test.js` | 0.4 s | 2 | unit | keep | guards D178 |  |
| `applyAnswerProvenance.test.js` | 0.4 s | 12 | other | keep | guards A2, A1 |  |
| `applyAnswerPolicy.test.js` | 0.3 s | 14 | source-pin | keep |  |  |
| `customAnswers.test.js` | 0.3 s | 24 | unit | keep |  |  |
| `d165ResumeFirst.test.js` | 0.3 s | 6 | unit | keep | guards D165, A6, A135 |  |
| `platformLabelMaps.test.js` | 0.3 s | 14 | unit | keep |  |  |
| `submitButton.test.js` | 0.3 s | 8 | unit | keep | guards A1 |  |
| `trackingFailureSink.test.js` | 0.3 s | 7 | unit | keep |  |  |
| `reviewOverlay.test.js` | 0.3 s | 18 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d55fEeoDecline.test.js` | 0.3 s | 8 | unit | keep | guards D55 |  |
| `applyFieldDiscovery.test.js` | 0.3 s | 16 | source-pin | keep |  |  |
| `sponsorshipTense.test.js` | 0.3 s | 24 | other | keep | guards A5, A1 |  |
| `a187Flags.test.js` | 0.3 s | 5 | unit | keep | guards A187, D162 |  |
| `optionConstraint.test.js` | 0.3 s | 8 | other | keep | guards A1 |  |
| `a180CaptchaBadge.test.js` | 0.3 s | 3 | unit | keep | guards A180 |  |
| `d86ReviewerDemo.test.js` | 0.3 s | 4 | unit | keep | guards D86 |  |
| `sponsorshipPolarity.test.js` | 0.3 s | 17 | other | keep | guards A1 |  |
| `browserLauncher.test.js` | 0.3 s | 27 | browser | keep · browser tier | drives a real browser |  |
| `otherNameSubject.test.js` | 0.3 s | 11 | other | keep | guards A1 |  |
| `privacyReconciliation.test.js` | 0.3 s | 14 | unit | keep |  |  |
| `d175AutoNeverListFromSavedOnly.test.js` | 0.3 s | 5 | unit | keep | guards D175 |  |
| `k1KbSanityCheck.test.js` | 0.3 s | 10 | unit | keep |  |  |
| `adminSpend.test.js` | 0.3 s | 6 | unit | keep |  |  |
| `j2WorkdayFixture.test.js` | 0.3 s | 12 | browser | keep · browser tier | drives a real browser |  |
| `d170Crawl.test.js` | 0.3 s | 6 | unit | keep | guards D170 |  |
| `d35FullHouseHeader.test.js` | 0.3 s | 12 | unit | keep (merge candidate) | shares 3 assertions with `d24FilterSentenceClient` |  |
| `trackingFailurePersistence.test.js` | 0.3 s | 6 | unit | keep |  |  |
| `harnessSchemaCoverage.test.js` | 0.3 s | 8 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d173RequestIdAcrossServices.test.js` | 0.3 s | 4 | unit | keep | guards D173 |  |
| `adminAnalyticsUsage.test.js` | 0.3 s | 4 | unit | keep | guards A50 |  |
| `a138LogoutOnce.test.js` | 0.3 s | 2 | source-pin | keep | guards A138 |  |
| `d60CompactRadius.test.js` | 0.3 s | 2 | source-pin | keep | guards D60 |  |
| `t17Dock.test.js` | 0.3 s | 13 | unit | keep |  |  |
| `atsBandSurfaces.test.js` | 0.3 s | 12 | unit | keep |  |  |
| `selfHostedFonts.test.js` | 0.3 s | 5 | source-pin | keep |  |  |
| `a81DraftScoresNoTextFacts.test.js` | 0.3 s | 2 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `companyAtsList.test.js` | 0.3 s | 13 | unit | keep |  |  |
| `a172WorkdayBulletsAndCityDashState.test.js` | 0.3 s | 2 | unit | keep | guards A172 |  |
| `jobDescriptionIngestion.test.js` | 0.3 s | 12 | unit | keep |  |  |
| `d24FilterSentenceClient.test.js` | 0.3 s | 12 | unit | keep (merge candidate) | shares 3 assertions with `d35FullHouseHeader` |  |
| `d60NoPills.test.js` | 0.3 s | 5 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `ashbyPublishedAt.test.js` | 0.3 s | 1 | unit | keep | guards A44 |  |
| `d173PoisonedSetOnPromptChange.test.js` | 0.3 s | 2 | unit | keep | guards D173 |  |
| `d48PostingHeader.test.js` | 0.3 s | 11 | source-pin | keep | guards D48, D30, D31 |  |
| `d19MarkLightMode.test.js` | 0.2 s | 6 | source-pin | keep | guards D19 |  |
| `gatePacketsCap.test.js` | 0.2 s | 11 | source-pin | keep |  |  |
| `a116RedesignedTextSize.test.js` | 0.2 s | 6 | source-pin | keep | guards A116, D145, D146 |  |
| `d62AtsPanelFrame.test.js` | 0.2 s | 5 | source-pin | keep | guards D62, D38, D50 |  |
| `d61CompanyLogo.test.js` | 0.2 s | 5 | source-pin | keep | guards D61 |  |
| `d172NodePageOneCard.test.js` | 0.2 s | 3 | unit | keep | guards D172 |  |
| `toolsService.test.js` | 0.2 s | 16 | unit | keep | guards A4 |  |
| `d116TreeUi.test.js` | 0.2 s | 19 | source-pin | keep | guards D116 |  |
| `d178PathwaysPlan.test.js` | 0.2 s | 6 | unit | keep | guards D155 |  |
| `jsxIdentifiersResolve.test.js` | 0.2 s | 3 | source-pin | keep |  |  |
| `d91Coverage.test.js` | 0.2 s | 3 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d91ThemeModule.test.js` | 0.2 s | 8 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `pageWidthGuard.test.js` | 0.2 s | 4 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a88ToolsServiceRetryable.test.js` | 0.2 s | 5 | unit | keep | guards A88, D36 |  |
| `d146Tracker.test.js` | 0.2 s | 14 | unit | keep (merge candidate) | shares 6 assertions with `d113ui` |  |
| `sourceAnchorGuard.test.js` | 0.2 s | 2 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `providerRouting.test.js` | 0.2 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `t22PopupLauncher.test.js` | 0.2 s | 3 | unit | keep |  |  |
| `clientCssParses.test.js` | 0.2 s | 1 | source-pin | keep | guards A201 |  |
| `d171TestsNeverCallLiveModels.test.js` | 0.2 s | 1 | other | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d38CompanyLink.test.js` | 0.2 s | 3 | source-pin | keep | guards D38, A78 |  |
| `a127SessionStore.test.js` | 0.2 s | 4 | unit | keep | guards A127, O101 |  |
| `authCredentialLifecycle.test.js` | 0.2 s | 12 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `dockerClientBuildInputs.test.js` | 0.2 s | 1 | source-pin | keep |  |  |
| `packages/ats-scorer/test/experienceNeutral.test.js` | 0.2 s | 7 | other | keep |  |  |
| `packages/ats-scorer/test/package.test.js` | 0.2 s | 14 | unit | keep |  |  |
| `a133DeckRanking.test.js` | 0.2 s | 4 | unit | keep | guards A133 |  |
| `jobsKeysetCursor.test.js` | 0.2 s | 12 | source-pin | keep |  |  |
| `d162ModelGateway.test.js` | 0.2 s | 15 | unit | keep | guards D162 |  |
| `extensionGatedHandoff.test.js` | 0.2 s | 14 | unit | keep |  |  |
| `appScrollProgressRemoved.test.js` | 0.2 s | 7 | unit | keep |  |  |
| `authRouteGuardManifest.test.js` | 0.2 s | 7 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d141HonestyCheck.test.js` | 0.2 s | 8 | unit | keep | guards D141 |  |
| `placeFacetCounts.test.js` | 0.2 s | 2 | unit | keep |  |  |
| `publishExtension.test.js` | 0.2 s | 19 | unit | keep |  |  |
| `boardOrderingTieBreak.test.js` | 0.2 s | 13 | unit | keep |  |  |
| `d148SettingsDrawer.test.js` | 0.2 s | 7 | source-pin | keep (merge candidate) | shares 5 assertions with `d25DraftHouseWorkspace` |  |
| `d166InventoryComplete.test.js` | 0.2 s | 3 | source-pin | keep | guards D166 |  |
| `d87DevHandoff.test.js` | 0.2 s | 3 | unit | keep | guards D87 |  |
| `localAtsScorer.test.js` | 0.2 s | 17 | unit | keep |  |  |
| `skillSynonyms.test.js` | 0.2 s | 19 | unit | keep |  |  |
| `derivationsRefuseAPurgedBoard.test.js` | 0.2 s | 9 | unit | keep |  |  |
| `atsScorerPackage.test.js` | 0.2 s | 6 | unit | keep | guards A1 |  |
| `brandMarkEverywhere.test.js` | 0.2 s | 2 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d70Phase3.test.js` | 0.2 s | 10 | unit | keep | guards D70 |  |
| `d64AutoCaptureExtension.test.js` | 0.2 s | 10 | source-pin | keep | guards D64, D97, D6 |  |
| `detailBudget.test.js` | 0.2 s | 11 | other | keep |  |  |
| `piiTokenization.test.js` | 0.2 s | 21 | unit | keep |  |  |
| `sealedSessionSweep.test.js` | 0.2 s | 2 | unit | keep | guards A127 |  |
| `adminSafety.test.js` | 0.2 s | 7 | unit | keep | guards A51 |  |
| `d88Resolver.test.js` | 0.2 s | 10 | unit | keep | guards D88 |  |
| `atsTermCategories.test.js` | 0.2 s | 19 | unit | keep |  |  |
| `companyLogoStore.test.js` | 0.2 s | 10 | unit | keep | guards A77 |  |
| `failsafeLocationClaims.test.js` | 0.2 s | 19 | unit | keep |  |  |
| `searchSuggestions.test.js` | 0.2 s | 21 | source-pin | keep |  |  |
| `summaryOptIn.test.js` | 0.2 s | 17 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d86Cimd.test.js` | 0.2 s | 5 | unit | keep | guards A96 |  |
| `t19KeyHardening.test.js` | 0.2 s | 5 | unit | keep |  |  |
| `claimedTermsReachScorers.test.js` | 0.2 s | 10 | unit | keep |  |  |
| `d151HeldCountCache.test.js` | 0.2 s | 5 | unit | keep | guards D151 |  |
| `d176SourceRegister.test.js` | 0.2 s | 8 | source-pin | keep | guards D176 |  |
| `t25NearMatchSavedAnswers.test.js` | 0.2 s | 7 | other | keep | guards D96 |  |
| `extensionCredential.test.js` | 0.1 s | 13 | unit | keep |  |  |
| `accountSecurity.test.js` | 0.1 s | 6 | unit | keep |  |  |
| `d173HiddenTextStripped.test.js` | 0.1 s | 4 | unit | keep | guards D173 |  |
| `d91ContrastThemes.test.js` | 0.1 s | 8 | source-pin | keep | guards D91 |  |
| `dailyDraft.test.js` | 0.1 s | 15 | unit | keep |  |  |
| `a195BoardMainThread.test.js` | 0.1 s | 3 | scale | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d175CanaryPracticeFormOnly.test.js` | 0.1 s | 5 | unit | keep | guards D175 |  |
| `formFieldMappings.test.js` | 0.1 s | 14 | unit | keep |  |  |
| `pipelineStages.test.js` | 0.1 s | 78 | scale | keep |  |  |
| `resumeClaimGuard.test.js` | 0.1 s | 40 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `boardSearch.test.js` | 0.1 s | 11 | unit | keep | guards A72 |  |
| `d55AutofillRules.test.js` | 0.1 s | 6 | unit | keep | guards D55 |  |
| `a195KeptOrderDecision.test.js` | 0.1 s | 4 | unit | keep | guards A195 |  |
| `d180OwnPages46f.test.js` | 0.1 s | 5 | source-pin | keep |  |  |
| `profileIsolation.test.js` | 0.1 s | 16 | unit | keep (merge candidate) | shares 10 assertions with `jobsPipelineHardening` |  |
| `t20AutoReadOpenTabs.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `a154AtlasD172Pieces.test.js` | 0.1 s | 3 | unit | keep | guards A154, D172 |  |
| `applyObstacleSurfaces.test.js` | 0.1 s | 34 | unit | keep (merge candidate) | shares 4 assertions with `applyPanelLayoutAdoption` |  |
| `jobsPipelineHardening.test.js` | 0.1 s | 29 | unit | keep (merge candidate) | shares 10 assertions with `profileIsolation` |  |
| `sampleSwap.test.js` | 0.1 s | 2 | unit | keep |  |  |
| `cleanupBlastRadius.test.js` | 0.1 s | 7 | source-pin | keep |  |  |
| `d55Autofill.test.js` | 0.1 s | 10 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d55AutofillWizard.test.js` | 0.1 s | 11 | source-pin | keep | guards D55 |  |
| `t32ReadFailurePopup.test.js` | 0.1 s | 4 | unit | keep |  |  |
| `a88GenerateConfigGate.test.js` | 0.1 s | 5 | unit | keep | guards A88, D36, D17 |  |
| `technographicCanonicalisation.test.js` | 0.1 s | 14 | unit | keep |  |  |
| `companyLogoProvider.test.js` | 0.1 s | 11 | source-pin | keep |  |  |
| `harnessNoLiveKey.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `e2eTailorContentLoss.test.js` | 0.1 s | 4 | unit | keep |  |  |
| `fullAutoKillSwitch.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `a157CompanyPaths.test.js` | 0.1 s | 3 | unit | keep | guards A157 |  |
| `boardControlRowConsolidation.test.js` | 0.1 s | 9 | unit | keep (merge candidate) | shares 3 assertions with `panelPeers` |  |
| `pairFidelityA86.test.js` | 0.1 s | 5 | source-pin | keep | guards A86, D32, D34 |  |
| `t20AlreadyGranted.test.js` | 0.1 s | 3 | other | keep |  |  |
| `handoffDocCurrent.test.js` | 0.1 s | 7 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `jobsInteract.test.js` | 0.1 s | 13 | source-pin | keep |  |  |
| `monetisationLever.test.js` | 0.1 s | 8 | unit | keep |  |  |
| `multiTabNavigation.test.js` | 0.1 s | 11 | source-pin | keep |  |  |
| `diskAlert.test.js` | 0.1 s | 4 | unit | keep |  |  |
| `lcaMigration.test.js` | 0.1 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d25DraftHouseWorkspace.test.js` | 0.1 s | 14 | unit | keep (merge candidate) | shares 5 assertions with `d148SettingsDrawer` |  |
| `collarClassifier.test.js` | 0.1 s | 65 | unit | keep |  |  |
| `d151JobQueue.test.js` | 0.1 s | 3 | unit | keep | guards D151 |  |
| `packages/ats-scorer/test/textFacts.test.js` | 0.1 s | 7 | other | keep | guards A81 |  |
| `applyCompanyAttribution.test.js` | 0.1 s | 10 | unit | keep |  |  |
| `d165HeldView.test.js` | 0.1 s | 5 | unit | keep | guards D165, O108 |  |
| `lcaResolution.test.js` | 0.1 s | 14 | source-pin | keep |  |  |
| `sessionConcurrency.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `a138SignInEverywhere.test.js` | 0.1 s | 4 | source-pin | keep | guards A138 |  |
| `a173ExpirySliced.test.js` | 0.1 s | 3 | source-pin | keep | guards A173 |  |
| `applyPipeline.test.js` | 0.1 s | 22 | browser | keep · browser tier | drives a real browser |  |
| `boardSearchStamp.test.js` | 0.1 s | 2 | unit | keep |  |  |
| `d55AutofillResume.test.js` | 0.1 s | 5 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `profileLifecycleSearchGating.test.js` | 0.1 s | 8 | source-pin | keep |  |  |
| `resumeArtifacts.test.js` | 0.1 s | 6 | source-pin | keep |  |  |
| `salaryAnswer.test.js` | 0.1 s | 7 | unit | keep |  |  |
| `standaloneAts.test.js` | 0.1 s | 5 | unit | keep |  |  |
| `termWeightEnvelope.test.js` | 0.1 s | 7 | unit | keep |  |  |
| `d173InjectedPostingNoEffect.test.js` | 0.1 s | 6 | unit | keep | guards D173 |  |
| `d190TinyFloating.test.js` | 0.1 s | 7 | browser | keep · browser tier | drives a real browser |  |
| `eeoPronounWord.test.js` | 0.1 s | 2 | other | keep |  |  |
| `jobClassifier.test.js` | 0.1 s | 75 | unit | keep |  |  |
| `atsSort.test.js` | 0.1 s | 1 | other | keep |  |  |
| `d112PrivacyText.test.js` | 0.1 s | 7 | unit | keep | guards D112, D100, D101 |  |
| `d144DuskTheme.test.js` | 0.1 s | 6 | source-pin | keep | guards D144 |  |
| `d176LearnItemsHaveSource.test.js` | 0.1 s | 4 | unit | keep | guards D176, D178 |  |
| `d55AutofillRecognised.test.js` | 0.1 s | 5 | unit | keep | guards D55 |  |
| `d91Appearance.test.js` | 0.1 s | 9 | source-pin | keep | guards D91 |  |
| `a165HeldReasonQuestions.test.js` | 0.1 s | 4 | unit | keep | guards A165 |  |
| `boardListingLayout.test.js` | 0.1 s | 15 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d151ListenFirst.test.js` | 0.1 s | 6 | unit | keep | guards D151 |  |
| `d70Phase1Keywords.test.js` | 0.1 s | 4 | unit | keep | guards D70 |  |
| `skroutzDeactivated.test.js` | 0.1 s | 1 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `atsCompanyCap.test.js` | 0.1 s | 9 | unit | keep |  |  |
| `colorTokens.test.js` | 0.1 s | 11 | source-pin | keep | guards D149 |  |
| `j10Disclosures.test.js` | 0.1 s | 4 | source-pin | keep | guards D96, D98, D64 |  |
| `panelPeers.test.js` | 0.1 s | 19 | unit | keep (merge candidate) | shares 3 assertions with `boardControlRowConsolidation` |  |
| `profileAtsUiFixes.test.js` | 0.1 s | 5 | source-pin | keep | guards A53, D51 |  |
| `searchSurfaceLayering.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `d39PanelPair.test.js` | 0.1 s | 6 | unit | keep | guards D39 |  |
| `d91ShapeCues.test.js` | 0.1 s | 5 | source-pin | keep | guards D91 |  |
| `versionEndpoint.test.js` | 0.1 s | 5 | source-pin | keep |  |  |
| `migrationListsAgree.test.js` | 0.1 s | 3 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `resumeFormatter.test.js` | 0.1 s | 15 | source-pin | keep |  |  |
| `searchBarControlsWired.test.js` | 0.1 s | 8 | unit | keep |  |  |
| `applyReviewModalStructure.test.js` | 0.1 s | 16 | source-pin | keep |  |  |
| `d133StudioTheme.test.js` | 0.1 s | 5 | source-pin | keep | guards D133 |  |
| `learnRouteShadow.test.js` | 0.1 s | 2 | source-pin | keep | guards D154 |  |
| `nonRetryableModelFailure.test.js` | 0.1 s | 7 | unit | keep |  |  |
| `storeScreenshots.test.js` | 0.1 s | 20 | unit | keep |  |  |
| `a195StatementCache.test.js` | 0.1 s | 2 | unit | keep | guards A195 |  |
| `authProviderIntegrations.test.js` | 0.1 s | 8 | source-pin | keep | guards A138 |  |
| `d102JobWorkspace.test.js` | 0.1 s | 6 | source-pin | keep | guards D102, D105 |  |
| `secretBox.test.js` | 0.1 s | 7 | unit | keep |  |  |
| `signupFirstImpression.test.js` | 0.1 s | 7 | source-pin | keep |  |  |
| `d173InjectedEmailNoEffect.test.js` | 0.1 s | 3 | unit | keep | guards D173, D17 |  |
| `d83PanelRules.test.js` | 0.1 s | 2 | source-pin | keep | guards D83 |  |
| `a52FollowUps.test.js` | 0.1 s | 3 | source-pin | keep | guards A52, A80, D17 |  |
| `boardCountMatchesList.test.js` | 0.1 s | 12 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `d117Links.test.js` | 0.1 s | 5 | unit | keep | guards D117 |  |
| `d69SmallOnes.test.js` | 0.1 s | 5 | unit | keep | guards D69 |  |
| `d83AdminMap.test.js` | 0.1 s | 5 | unit | keep | guards D83 |  |
| `extensionImportPipeline.test.js` | 0.1 s | 12 | source-pin | keep |  |  |
| `jobBubbleD1.test.js` | 0.1 s | 9 | source-pin | keep | guards D1, D149 |  |
| `semiRequiredFields.test.js` | 0.1 s | 11 | source-pin | keep |  |  |
| `t10TokenRefresh.test.js` | 0.1 s | 5 | other | keep |  |  |
| `a141SubcategoryCoverage.test.js` | 0.1 s | 3 | unit | keep | guards A141 |  |
| `a187SlimReports.test.js` | 0.1 s | 4 | unit | keep | guards A187 |  |
| `a64RegistryAudit.test.js` | 0.1 s | 3 | source-pin | keep | guards A64 |  |
| `d153FilterCountsKnownOnly.test.js` | 0.1 s | 6 | unit | keep | guards D153 |  |
| `d178CoursePage.test.js` | 0.1 s | 2 | unit | keep | guards D178 |  |
| `deckOrderAts.test.js` | 0.1 s | 4 | unit | keep | guards A75, A76 |  |
| `domainProfileExpansion.test.js` | 0.1 s | 6 | unit | keep |  |  |
| `searchProfileIntent.test.js` | 0.1 s | 4 | source-pin | keep |  |  |
| `a204DraftHostsTheSandbox.test.js` | 0.1 s | 2 | source-pin | keep | guards A204, A203 |  |
| `a53SurfaceStyling.test.js` | 0.1 s | 6 | source-pin | keep | guards A53 |  |
| `applyPanelLayoutAdoption.test.js` | 0.1 s | 13 | unit | keep (merge candidate) | shares 4 assertions with `applyObstacleSurfaces` |  |
| `autoApplyPanelMove.test.js` | 0.1 s | 7 | source-pin | keep | guards A53 |  |
| `d129TourAnalytics.test.js` | 0.1 s | 4 | unit | keep | guards D129, D124 |  |
| `d145DeckCardNav.test.js` | 0.1 s | 12 | source-pin | keep | guards D145 |  |
| `d46BoardCards.test.js` | 0.1 s | 2 | source-pin | keep | guards D46, D1, D40 |  |
| `deckFan.test.js` | 0.1 s | 15 | source-pin | keep |  |  |
| `rm19ResumeUnparsed.test.js` | 0.1 s | 2 | unit | keep |  |  |
| `a184a185BoardKeptCountsIdleBackoff.test.js` | 0.1 s | 2 | scale | keep | guards A184, A185 |  |
| `a211Runner.test.js` | 0.1 s | 7 | unit | keep | guards A211, A207 |  |
| `d33DeployHealthcheck.test.js` | 0.1 s | 3 | source-pin | keep | guards D33 |  |
| `deckExpandedTwoPanel.test.js` | 0.1 s | 8 | source-pin | keep | guards A40 |  |
| `e2eApplyPdfRender.test.js` | 0.1 s | 2 | unit | keep |  |  |
| `jobTaxonomy.test.js` | 0.1 s | 31 | other | keep |  |  |
| `jobsBoardParamContract.test.js` | 0.1 s | 10 | source-pin | keep (merge candidate) | shares 3 assertions with `jobsUiTierFilters` |  |
| `jobsUiProfileFilters.test.js` | 0.1 s | 8 | source-pin | keep |  |  |
| `profileScopedResumeSignals.test.js` | 0.1 s | 5 | source-pin | keep | guards D90 |  |
| `simpleApplyProfile.test.js` | 0.1 s | 4 | other | keep |  |  |
| `themeCardChoiceSticks.test.js` | 0.1 s | 2 | unit | keep |  |  |
| `topBarChrome.test.js` | 0.1 s | 10 | unit | keep |  |  |
| `a157InAppCompanyRoute.test.js` | 0.1 s | 2 | source-pin | keep | guards A157, D179 |  |
| `anthropicModels.test.js` | 0.1 s | 7 | source-pin | keep |  |  |
| `ashbySpaFixture.test.js` | 0.1 s | 11 | source-pin | keep |  |  |
| `boardPagingCursor.test.js` | 0.1 s | 14 | unit | keep |  |  |
| `d156ReadStates.test.js` | 0.1 s | 4 | source-pin | keep | guards D156 |  |
| `d178FlyMyRoute.test.js` | 0.1 s | 4 | unit | keep | guards D178 |  |
| `d91Documents.test.js` | 0.1 s | 3 | source-pin | keep | guards D91 |  |
| `lastActiveNotPolls.test.js` | 0.1 s | 2 | source-pin | keep | guards D124 |  |
| `modelCatalogue.test.js` | 0.1 s | 8 | unit | keep | guards A87 |  |
| `privacyO72Corrections.test.js` | 0.1 s | 7 | source-pin | keep | guards O72 |  |
| `a146AllFilters.test.js` | 0.1 s | 3 | unit | keep | guards A146, D179 |  |
| `boardSearchClears.test.js` | 0.1 s | 2 | source-pin | keep |  |  |
| `consoleArchitecture.test.js` | 0.1 s | 3 | source-pin | keep | guards D152 |  |
| `d165ModelReport.test.js` | 0.1 s | 1 | unit | keep | guards D165, A6 |  |
| `d47SentenceLogoFace.test.js` | 0.1 s | 2 | unit | keep | guards D47 |  |
| `jobsUiFollowups.test.js` | 0.1 s | 4 | source-pin | keep |  |  |
| `resumeFormatterDuplication.test.js` | 0.1 s | 11 | scale | keep |  |  |
| `standaloneSpendControls.test.js` | 0.1 s | 7 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a111CategoryLeak.test.js` | 0.1 s | 3 | unit | keep | guards A111, D127 |  |
| `a156SendEverywhere.test.js` | 0.1 s | 2 | source-pin | keep | guards A156, D180 |  |
| `d11FullHouseHeader.test.js` | 0.1 s | 4 | source-pin | keep | guards D11, D1, D26 |  |
| `d178RealLinks.test.js` | 0.1 s | 4 | unit | keep | guards D178, D176 |  |
| `failsafeGate.test.js` | 0.1 s | 9 | other | keep |  |  |
| `landingFindFitApply.test.js` | 0.1 s | 8 | source-pin | keep |  |  |
| `packages/sqlite-backup/test/checksums.test.js` | 0.1 s | 1 | unit | keep |  |  |
| `d111PicksRespectMinimumSample.test.js` | 0.1 s | 3 | unit | keep | guards D111 |  |
| `d151BgJobsPanel.test.js` | 0.1 s | 2 | unit | keep | guards D151 |  |
| `d55FunnelBoard.test.js` | 0.1 s | 5 | source-pin | keep | guards D55 |  |
| `integrationsArchitecture.test.js` | 0.1 s | 5 | source-pin | keep |  |  |
| `lcaCompanyMatch.test.js` | 0.1 s | 19 | scale | keep |  |  |
| `profileFilterBridge.test.js` | 0.1 s | 11 | other | keep |  |  |
| `progressNewestCounts.test.js` | 0.1 s | 3 | other | keep |  |  |
| `t10ScenarioRows.test.js` | 0.1 s | 3 | source-pin | keep |  |  |
| `a183KeywordsPanelKeepsCaches.test.js` | 0.1 s | 2 | scale | keep | guards A183, D156 |  |
| `a33ResumePrefill.test.js` | 0.1 s | 5 | unit | keep | guards A33 |  |
| `d178OldAtlasFixes.test.js` | 0.1 s | 3 | unit | keep | guards D178 |  |
| `d37FullHouseHeader.test.js` | 0.1 s | 3 | unit | keep | guards D37 |  |
| `failureAttribution.test.js` | 0.1 s | 8 | unit | keep |  |  |
| `d111MinimumCountShown.test.js` | 0.1 s | 4 | unit | keep | guards D111 |  |
| `d149DuskDefault.test.js` | 0.1 s | 4 | source-pin | keep | guards D149 |  |
| `d178EveryOldAddressRedirects.test.js` | 0.1 s | 3 | unit | keep | guards D178 |  |
| `deckView.test.js` | 0.1 s | 5 | source-pin | keep | guards A53 |  |
| `importDegradedFallback.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `d10NavRenames.test.js` | 0.1 s | 5 | source-pin | keep | guards D10, D18, D152 |  |
| `d172MapTrackBoard.test.js` | 0.1 s | 3 | unit | keep | guards D172 |  |
| `d45BoardLoading.test.js` | 0.1 s | 4 | unit | keep | guards D45 |  |
| `d90P3.test.js` | 0.1 s | 4 | source-pin | keep | guards D90, D113, D146 |  |
| `manifestMinimumPermission.test.js` | 0.1 s | 14 | source-pin | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `profileSeniorityRegistry.test.js` | 0.1 s | 5 | unit | keep |  |  |
| `registrationDefaults.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `t31StubJsonLd.test.js` | 0.1 s | 3 | source-pin | keep |  |  |
| `a155AtlasPieces.test.js` | 0.1 s | 3 | unit | keep | guards A155, D178 |  |
| `a191BootCleanupSkip.test.js` | 0.1 s | 1 | source-pin | keep | guards A191 |  |
| `a194ApproveKeepsPreviewTool.test.js` | 0.1 s | 2 | source-pin | keep | guards A194 |  |
| `atsOneReadPerScreen.test.js` | 0.1 s | 1 | source-pin | keep | guards A52, D48, D58 |  |
| `companyKb.test.js` | 0.1 s | 9 | unit | keep |  |  |
| `d179SentenceFilterCarriesTaxonomy.test.js` | 0.1 s | 3 | unit | keep | guards D179, A145 |  |
| `d55AutofillBadge.test.js` | 0.1 s | 4 | unit | keep | guards D55 |  |
| `d55WorkdayReplica.test.js` | 0.1 s | 10 | source-pin | keep | guards D55 |  |
| `e2eSandboxEditExport.test.js` | 0.1 s | 6 | source-pin | keep |  |  |
| `entitlements.test.js` | 0.1 s | 4 | other | keep |  |  |
| `jobsBoardColdLoad.test.js` | 0.1 s | 6 | source-pin | keep |  |  |
| `authRouteBootstrap.test.js` | 0.1 s | 4 | source-pin | keep |  |  |
| `cacheBreakpoints.test.js` | 0.1 s | 4 | unit | keep | guards A4 |  |
| `chromeContentOffset.test.js` | 0.1 s | 5 | source-pin | keep |  |  |
| `companyCardIdiom.test.js` | 0.1 s | 3 | source-pin | keep |  |  |
| `d102OneStatusModule.test.js` | 0.1 s | 7 | unit | keep | guards D102, D113 |  |
| `d151ScaleSuite.test.js` | 0.1 s | 3 | scale | keep | guards D151 |  |
| `d49StickyBar.test.js` | 0.1 s | 2 | source-pin | keep | guards D49, D48 |  |
| `d55AutofillRequired.test.js` | 0.1 s | 6 | source-pin | keep | guards D55 |  |
| `featuresPageHonest.test.js` | 0.1 s | 5 | source-pin | keep |  |  |
| `formatterEntriesF3.test.js` | 0.1 s | 3 | unit | keep |  |  |
| `panelLayoutDefaults.test.js` | 0.1 s | 8 | source-pin | keep |  |  |
| `visaSignalCoverage.test.js` | 0.1 s | 3 | source-pin | keep |  |  |
| `boardMatchingRefresh.test.js` | 0.1 s | 2 | source-pin | keep | guards A126 |  |
| `d111NoBarePercent.test.js` | 0.1 s | 3 | unit | keep | guards D111 |  |
| `d175FullAutoPrerequisitesCard.test.js` | 0.1 s | 2 | source-pin | keep | guards D175, D123 |  |
| `deckCollapseTop.test.js` | 0.1 s | 4 | source-pin | keep |  |  |
| `enrichmentDrain.test.js` | 0.1 s | 1 | unit | keep | guards A80, D17 |  |
| `jobsUiTierFilters.test.js` | 0.1 s | 8 | source-pin | keep (merge candidate) | shares 3 assertions with `jobsBoardParamContract` |  |
| `recruiterTabRemoved.test.js` | 0.1 s | 2 | source-pin | keep | guards D5, D10 |  |
| `searchBarDropdownTheme.test.js` | 0.1 s | 9 | source-pin | keep |  |  |
| `searchSignalsQueue.test.js` | 0.1 s | 2 | source-pin | keep |  |  |
| `d162G4GatewayCard.test.js` | 0.1 s | 3 | source-pin | keep | guards D162, A187 |  |
| `d50AtsNumberShown.test.js` | 0.1 s | 3 | unit | keep | guards D50, D48 |  |
| `profileSwitchCache.test.js` | 0.1 s | 3 | source-pin | keep |  |  |
| `reviewWriteOrder.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `toastTier.test.js` | 0.1 s | 5 | unit | keep |  |  |
| `a151UsernameOpensAbout.test.js` | 0.1 s | 1 | source-pin | keep | guards A151 |  |
| `approveAllCandidates.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `d149FidelityShots.test.js` | 0.1 s | 1 | browser · fidelity | faster | boots its OWN vite dev server + Chrome through `scripts/fidelityShots.mjs` — read the shared probe instead (R2) | 0.1 s |
| `deckState.test.js` | 0.1 s | 5 | other | keep |  |  |
| `releaseCheckFixes.test.js` | 0.1 s | 2 | source-pin | keep | guards A2 |  |
| `testSinkIsolation.test.js` | 0.1 s | 3 | unit | KEEP (guard) | on the protected list — stays whatever the audit says |  |
| `a149CompanyPageGaps.test.js` | 0.1 s | 2 | source-pin | keep | guards A149, D179, D147 |  |
| `accountSignInLabel.test.js` | 0.1 s | 1 | source-pin | keep | guards A46, A34 |  |
| `apiErrorMessages.test.js` | 0.1 s | 5 | source-pin | keep | guards A3 |  |
| `byomMenuInBounds.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `d180FeedClient.test.js` | 0.1 s | 3 | source-pin | keep | guards D180 |  |
| `demoVideoRefusesSend.test.js` | 0.1 s | 2 | source-pin | keep | guards D36 |  |
| `harnessRunnerPrereq.test.js` | 0.1 s | 4 | source-pin | keep |  |  |
| `a189PracticeFormAcceptance.test.js` | 0.1 s | 2 | source-pin | keep | guards A189, A185, D186 |  |
| `d175SentOnlyOnEvidence.test.js` | 0.1 s | 2 | source-pin | keep | guards D175, A1 |  |
| `p1ProfileSignalsHonest.test.js` | 0.1 s | 1 | source-pin | keep |  |  |
| `buildScriptsSafety.test.js` | 0.1 s | 5 | source-pin | keep |  |  |

## 6. For the owner

1. **R1 (two tiers)** — yes / no. It changes when the browser files run, not whether.
2. **R2 (one fidelity probe; the tests stop rewriting `docs/fidelity-shots/`)** — yes / no.
3. **R3 (one theme in the long walks)** — yes / no.
4. **R4 (one boot for six walks; drop `j2ExtensionHarness`)** — yes / no.
5. **R5 / R6 (split pure tests out; merge the duplicate pairs)** — yes / no.

After the pick: one commit per group, the pruned suite run whole, the new count and time in CLAUDE.md (step (d) of A232).

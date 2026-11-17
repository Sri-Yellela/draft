# OBJECT_MAP — D122 P1 audit

*Dated 2026-10-31. This is a read-only audit; it lists facts only. P2 decides what changes, after the owner has read it. The spec is WORKLOG D122.*

⚠ **About the line numbers.** `server.js` lines were measured after `a6a892c`. That commit added 27 lines near the top of `server.js` and did not touch the other files cited. The D121 surfaces lane, committed after this audit, adds a few more lines around the board route (≈ 10620–10660), so `server.js` numbers below that point may be a few lines off.

⚠ **No `resume_version_id` column exists anywhere in the schema.** D122's rule, *"has a résumé = `application.resume_version_id`"*, has nothing behind it today. A résumé is stored in these places, and each one answers "is there a résumé?" its own way:

| Store | What it holds | Where |
|---|---|---|
| `resumes` | one row per user and job (`UNIQUE(user_id, job_id)`) | `server.js:529-543` |
| `resume_versions` | versions of a résumé | `server.js:544-556` |
| `apply_run_jobs.resume_artifact_id` | a `resumes.id` | `server.js:2544` |
| `application_artifacts` | a kept copy per application record | `server.js:4141-4157` |
| `user_jobs.resume_generated` | a flag, per job profile | `server.js:703` |
| `extension_resume_generations` | the extension's generations | `services/extensionResume.js:172-173` |

## 1. Résumé version (tailored: `resumes` / `resume_versions` · base: `base_resume` / `profile_base_resumes` / `base_resume_uploads`)

### 1a. Read paths — "does this job have a tailored résumé?"

| # | Where | Rule it applies | file:line |
|---|---|---|---|
| R1 | `artifactCurrency()` — calls itself "the one definition" | a `resumes` row with html, the same tool, the same active profile, and newer than the base's last edit → `current` | `services/resumeCurrency.js:47-108` |
| R1 callers | apply pipeline, picks, "Make it now", `generateResumeForApply` | R1 | `routes/apply.js:1072, 1321, 1632, 2561, 4375` · `routes/picksConfirm.js:93` · `services/picks.js:389` · `server.js:12333` |
| R2 | `GET /api/resumes` | a row exists (any profile, no currency check) | `server.js:12836-12850` |
| R3 | `GET /api/resumes/:jobId` | a row exists, else 404 | `server.js:12851-12861` |
| R4 | the board's `/d` (pending) membership | `uj.resume_generated = 1` AND a `resumes` row with html | `server.js:11595-11601` |
| R5 | the board's ALL "own rows" | `uj.resume_generated = 1` (the flag alone) | `server.js:10439-10442` |
| R6 | `/d` page rows carry `resume_html` | a separate `SELECT … FROM resumes`, only when on the pending tab | `server.js:10600-10603`; also `pendingJobsQuery` LEFT JOIN at `server.js:11621-11622` |
| R7 | `GET /api/jobs/by-id/:jobId` | **no résumé fields at all** | `server.js:11486-11499` |
| R8 | The Table (`listHistory` → `buildHistory`) | `hasResume` only when an application record exists; then the kept copy, else a `resumes` row | `services/applicationRecords.js:456` · `shared/applicationHistory.js:230-242` |
| R9 | the application page (`jobDetail`) | the latest non-superseded run's `apply_run_jobs.resume_artifact_id` | `services/pipelineWorkspace.js:23-27, 196-200` |
| R9b | the same page's "Résumé tailored" check | `!!rj?.resume_artifact_id \|\| sent` | `services/pipelineWorkspace.js:171` |
| R10 | Draft House approvals | `resumeAvailable: resume_artifact_id != null`, `generationDeferred` | `routes/apply.js:2704, 3172-3186, 3902, 4769-4781` |
| R11 | the extension's `/context` (the popup) | a `resumes` row with `length(html) > 0` | `routes/importJob.js:142-148` |
| R12 | the extension dock's Résumé tab | only a generation id held in the tab's own local progress record | `extension/resumePanel.js:756-761` (its no-résumé text at `:202-203`) |
| R13 | the BYOM tool `draft_list_my_drafts` | `EXISTS resumes` (no html check) | `services/byom/tools.js:356-361` |
| R14 | "is this job the user's?" | any `resumes` row | `services/manualHandoff.js:52-64` |
| R15 | Settings → Generated résumés | `resumes` rows with html, plus `resumeTie` | `services/generatedResumes.js:150-170` (route at `routes/generatedResumes.js:10`) |
| R16 | the "What we changed" comparison | `resume_versions` + `application_artifacts` | `routes/resumeChanges.js:23-31` |
| R17 | the Atlas's "has any résumé" (D120 P1, this session) | any base (profile or legacy) or any generated row | `services/atlas/atlasStore.js:103-108` |
| R18 | migration 121's backfill | a `resumes` row → a pending record | `server.js:4040-4047` |

**Four download / view routes, each reading a different store:**

| Surface | Route | Reads | file:line |
|---|---|---|---|
| the board | `GET /api/resumes/:jobId` | `resumes` | `server.js:12851` |
| Draft House | `GET /api/apply/run-jobs/:id/resume` | re-renders from `resumes.html` | `routes/apply.js:3271-3290` |
| The Table | `GET /api/applications/:recordId/resume` | the kept copy, else the working résumé | `routes/applicationArtifacts.js:26` · `services/applicationArtifacts.js:130-134, 185-200` |
| the extension | `GET /api/extension/resume/:id/pdf/file` | the extension's generation | `routes/extensionResume.js:51` |

### 1b. Read paths — "does the user have a base résumé?"

| Where | Rule | file:line |
|---|---|---|
| `getBaseResumeRecord` | `profile_base_resumes` when a profile is given, else the legacy `base_resume` | `services/simpleApplyProfile.js:243-257` |
| the daily deck's `no_resume` | the active profile's `profile_base_resumes` only | `server.js:10804-10806` |
| the Atlas | any profile's, the legacy one, or a generated résumé | `services/atlas/atlasStore.js:103-108` |
| the extension's "Attach my résumé" | `baseResumeFor` / `baseResumeInfo` | `services/extensionResume.js:147-149, 432-433` |
| the packet payload | the active profile's, then the legacy one | `services/payloadResume.js:70-78` |
| base-résumé-only mode | the active profile's, then the legacy one | `services/baseResumeOnly.js:38-45` |
| the structured profile's basis | the active profile's, then the legacy one | `services/structuredProfile.js:151-153` |
| saved answers' work history | **the legacy `base_resume` only** | `routes/savedAnswers.js:118` |
| the Saved Jobs pane | `!!baseResume` from `/api/domain-profiles/:id/base-resume` | `client/src/panels/DatabasePanel.jsx:351, 703` |

### 1c. Every component that shows a résumé, and whether it offers the editor

| Viewer | Where it is mounted | Editor? | file:line |
|---|---|---|---|
| **SandboxPanel** (A4 iframes, `DocToolbar`, autosave) | the board's panel dock only | **always editable** — `contentEditable = "true"` with no condition, the toolbar always drawn, and no check of the application's state | `client/src/panels/SandboxPanel.jsx:245, 262-268, 570`; mounted at `JobsPanel.jsx:4064`; composition at `modules.manifest.js:243` |
| JobDetailPanel "View" → SandboxPanel | the board's posting panel | through SandboxPanel; View shows when `done && g?.html` | `JobDetailPanel.jsx:112, 148, 170` · `JobsPanel.jsx:1975-1979` |
| the board card's open → SandboxPanel | the board | only when the html is in memory (not `__exists__`) | `JobsPanel.jsx:4283-4288` |
| AtsReportPanel History (ResumeList) → SandboxPanel | the board's ATS panel | through SandboxPanel | `AtsReportPanel.jsx:141` · `JobsPanel.jsx:4077` |
| `/d` auto-open → SandboxPanel | the board's pending tab | opens when `resume_html` is present | `JobsPanel.jsx:2017-2044` |
| JobWorkspacePanel, the Résumé tab | `/app/job/:id`; embedded in The Table (`DatabasePanel.jsx:743`) and Draft House (`AutoApplyPanel.jsx:981`) | **no editor** — a sentence and an "Open the résumé" PDF link | `JobWorkspacePanel.jsx:119-129` |
| Draft House's résumé leaf | Draft House | **no editor** — "Résumé PDF ↗" + `ChangesSummaryLine` | `AutoApplyPanel.jsx:662-697, 721` |
| The Table (ApplicationHistory) | Database → History | **no editor** — download + "What we sent" | `ApplicationHistory.jsx:513-518, 587-595` |
| ResumeChangesPanel | JobDetailPanel, Draft House, The Table | read-only comparison | `ResumeChangesPanel.jsx:226-283` |
| Database → Resumes / Spreadsheet `DetailModal` | Database | **no editor** — a sandboxed read-only iframe | `DatabasePanel.jsx:135-261, 585-604` |
| the Saved Jobs pane (JobCard) | Database → Saved Jobs | **no view for a stored résumé** — `onViewSandbox` is not passed; JobCard hides View and Export when `__exists__` | `DatabasePanel.jsx:1110-1131` · `JobCard.jsx:777-783` |
| Settings → Generated résumés (ResumeList) | Account | download and delete only | `AccountPanel.jsx:263-288` |
| GenerateToolPage | tools | a read-only iframe | `pages/tools/GenerateToolPage.jsx:139` |
| the extension dock's Résumé tab | the extension | preview only; "Edit in a full page" opens the board (`/app/jobs?job=<id>`) | `extension/resumePanel.js:128, 584, 1001-1007` · `services/extensionResume.js:340` (`EDIT_NOT_RECHECKED` at `resumePanel.js:70`) |
| the **base** résumé's editor | Profile | a plain `<textarea>`, not SandboxPanel | `ProfilePanel.jsx:1260` (save at `:675-683`); upload only in `JobProfilesPanel.jsx:80-95` |

### 1d. Divergences

**D-R1 · The board and Draft House disagree on "has a résumé".**
- The board's card, posting panel and JobCard read "a row in `/api/resumes`", with no tool, profile or base-edit check (`JobsPanel.jsx:2618-2632, 1951-1952, 4293`).
- Draft House's picks read R1, `artifactCurrency().current` (`services/picks.js:389`; `AutoApplyPanel.jsx:662-669`).
- So after a profile switch or a base edit, the board says "résumé ready" while Draft House says "Not made yet".

**D-R2 · The application page says "No tailored résumé" when a `resumes` row exists.**
- It reads only `apply_run_jobs.resume_artifact_id` (`pipelineWorkspace.js:196-200`) and prints "No tailored résumé for this one — your base résumé is used." (`JobWorkspacePanel.jsx:127`).
- A résumé generated on the board is not consulted.

**D-R3 · The Table hides a résumé the board shows.**
- `hasResume` is null without an application record (`applicationHistory.js:238-242`), so there is no résumé button (`ApplicationHistory.jsx:513, 587`).

**D-R4 · The extension has two answers, and the dock uses neither server store.**
- `/context` returns `resumeReady` from `resumes` (`importJob.js:142-148`), but no reader of `resumeReady` was found in `extension/*.js`.
- The dock reads only its local generation id (`resumePanel.js:756-761`) and says "No résumé has been made for this job yet." (`:202-203`).

**D-R5 · The Spreadsheet shows a CV button on every row** (`DatabasePanel.jsx:1033-1036`).
- With no row, `/api/resumes/:jobId` returns 404 (`server.js:12858`), and the modal alerts (`DatabasePanel.jsx:603`).

**D-R6 · Whether a résumé can be edited depends on where it is shown, not on its state.**
- SandboxPanel is always editable (`SandboxPanel.jsx:245`), including for a job already sent.
- Its save overwrites `resumes.html` (`JobsPanel.jsx:3327`; `server.js:12781-12794`).
- Draft House's run-job PDF re-renders from that html (`routes/apply.js:3271, 3287-3288`), and The Table's fallback serves the working résumé (`applicationArtifacts.js:130-134`; `applicationHistory.js:231-240`).
- No other viewer offers an editor.

**D-R7 · Saved Jobs and the board treat the same stored résumé differently.**
- The board's D57 fetch-on-demand opens a stored résumé (`JobsPanel.jsx:1975-1990`).
- Saved Jobs shows "✓ Resume" (`JobCard.jsx:601-604`) but offers no View or Export (`DatabasePanel.jsx:1124-1125`; `JobCard.jsx:777`).

**D-R8 · `/d` gets its résumé data three ways:**
- the `pendingJobsQuery` LEFT JOIN (`server.js:11621-11622`)
- the board route's `resumeBy` side query (`server.js:10600-10603`)
- the boot `/api/resumes` map (`JobsPanel.jsx:2618`)

**D-R9 · `user_jobs.resume_generated` is a per-profile flag** (written at `generatedResumes.js:104-110`, cleared at `:180`).
- ALL uses it alone (`server.js:10440`); `/d` uses it together with a row check (`server.js:11595-11596`).

**D-R10 · Five wordings for one fact:**
- "résumé ready" (`JobBubble.jsx`)
- "Résumé ready · 2h ago" (`JobDetailPanel.jsx:181`)
- "✓ Resume" / "📄 Resume" (`JobCard.jsx:601-604, 750-756`)
- "A tailored résumé was made for this application." (`JobWorkspacePanel.jsx:123`)
- "Made / Not made yet" (`AutoApplyPanel.jsx:667-669`)

**D-R11 · "Does the user have a base résumé?" is asked at three scopes:**
- the deck: the active profile only (`server.js:10804-10805`)
- the Atlas: any base or a generated résumé (`atlasStore.js:103-108`)
- saved answers: the legacy `base_resume` only (`routes/savedAnswers.js:118`)

**D-R12 · The base résumé and the tailored résumé have different editors.**
- The base is edited in a textarea (`ProfilePanel.jsx:1260`); the tailored one uses the A4 SandboxPanel editor.

## 2. Application (`application_records` + `job_applications` + `apply_run_jobs`)

**Read paths:**

| Function | Routes | file:line |
|---|---|---|
| `listPipeline` / `jobDetail` (the ladder) | `GET /api/pipeline`, `/api/pipeline/job/:id`, `/api/pipeline/job-for/:jobId` | `services/pipelineWorkspace.js:29-71, 73, 184-232` · `routes/pipeline.js:21-45` |
| `listHistory` (The Table) | `GET /api/applications/history` | `services/applicationRecords.js:451-485` · `routes/applicationRecords.js:34-37` |
| `listRecords` (Pending) | `GET /api/applications/pending` | `services/applicationRecords.js:424` · `routes/applicationRecords.js:21-27` |
| the Spreadsheet's join (`job_applications` ⋈ `scraped_jobs`) | `GET /api/applications` | `server.js:12903-12925` |
| run-job reads (Draft House) | — | `routes/apply.js:2704, 3172-3186, 4735-4781` |

**Components:**

| Component | Mode | Mounted at | file:line |
|---|---|---|---|
| JobWorkspacePanel | detail | `/app/job/:id`, `/app/job/for/:jobId` (`App.jsx:345-346, 608`); The Table's side (`DatabasePanel.jsx:743`); Draft House's side (`AutoApplyPanel.jsx:981`) | `JobWorkspacePanel.jsx:43` |
| ApplicationHistory | row | `DatabasePanel.jsx:734` | `ApplicationHistory.jsx:495-600` |
| PendingApplications | row | `DatabasePanel.jsx:714` | — |
| DraftHouseTree / DraftHouseSide (CompanyBubble) | card | `AutoApplyPanel.jsx:965, 984` | — |
| the Spreadsheet table | row | — | `DatabasePanel.jsx:799-1060` |

**Divergences:**

**D-A1 · Two status vocabularies for one application.**
- the ladder: `shared/applicationStatus.js:21-31`, used by `pipelineWorkspace.js:40-53` and `lib/draftHouseTree.js:23, 88-124`
- The Table's status and stage: `shared/applicationHistory.js:35-56, 110-135`

**D-A2 · Two row sources for The Table.**
- `loadTableRows` reads `/api/pipeline?surface=table` (`lib/draftHouseRuns.js:108-111`, used at `AutoApplyPanel.jsx:147`).
- The Table itself reads `/api/applications/history` (`ApplicationHistory.jsx:250`). Draft House's "Also at …" (`AutoApplyPanel.jsx:172-185`) and the board (`JobsPanel.jsx:1484-1489`) read it too.

**D-A3 · Status labels and colours are drawn in several places:**
- `STATUS_COLOUR` (`JobWorkspacePanel.jsx:26-27, 85`)
- `attemptStatusChip` (`lib/applyObstacles.js:644-657`)
- the posting panel's "Pending · record it / Pending · not verified" (`JobDetailPanel.jsx:348-352`), from its own `/api/applications/pending` fetch (`:290-294`)
- The Table's "Recorded — not verified yet" (`applicationHistory.js:135`)

**D-A4 · The application page needs an application record.**
- `job-for` looks up `application_records` (`routes/pipeline.js:39-41`), and `jobDetail` returns null without one (`pipelineWorkspace.js:185-186`).

## 3. Posting (`scraped_jobs`)

**Read paths:**

| Read | file:line |
|---|---|
| the board, `GET /api/jobs` | `server.js:9880` |
| `GET /api/jobs/by-id/:jobId` | `server.js:11486-11499` |
| `GET /api/jobs/pending` → `pendingJobsQuery` | `server.js:11603-11633` |
| the deck, `GET /api/draft/today` | `server.js:10783` |
| the pipeline's posting snapshot | `services/pipelineWorkspace.js:33-37, 56-58` |
| the extension's `/context` | `routes/importJob.js:111-160` |
| the extension's job and page routes | `routes/extensionJob.js:107-117, 129-144` |
| the history's job info | `services/applicationRecords.js:459-464` |

**Detail renderers:**

| Renderer | Body | Where | file:line |
|---|---|---|---|
| JobDetailPanel → PostingPanel | `formatPosting` + Atlas terms | the board | `JobDetailPanel.jsx:397` · `PostingPanel.jsx:17-25, 173-176, 201` |
| DeckView `CardPosting` → PostingPanel | the same | Today | `DeckView.jsx:182-187` |
| JobWorkspacePanel's Job tab | raw `pre-wrap` + `AtlasText`, no PostingPanel | the application page | `JobWorkspacePanel.jsx:167-176` |
| JobCard expanded | its own `DescriptionText` | Saved Jobs, the landing page | `JobCard.jsx:368, 796-804` · `DatabasePanel.jsx:1115` · `LandingPage.jsx:36` |
| Draft House's "The job" leaf | a line and links only | Draft House | `AutoApplyPanel.jsx:699-708` |

The card-mode renderers are JobBubble (board, `JobsPanel.jsx:4288`), JobCard (Saved Jobs and landing) and the DeckView card (`DeckView.jsx:338, 487`).

**Divergences:**

**D-P1 · Four description renderers**, and none at all in Draft House.

**D-P2 · The posting panel's actions are the board's alone.**
- Generate, View, Download, Draft, Save and Pass come from `selectedJobMeta`, which only JobsPanel builds (`JobsPanel.jsx:1948-2008`).
- The application page, the deck card and JobCard each carry another button set.

**D-P3 · Only JobDetailPanel fetches the description when the posting is opened** (`JobDetailPanel.jsx:244-273`).
- The application page says instead that the text "is not stored" (`JobWorkspacePanel.jsx:174`).

## 4. Profile (`user_profile` + D101 `profile_*`)

**Read paths:**

| Read | file:line |
|---|---|
| `GET /api/profile` — the raw `user_profile` row | `routes/account.js:357-360` |
| `GET /api/profile/sections` → `readProfile` (the D101 tables, the defaults, completeness) | `routes/profileSections.js:29-31` · `services/structuredProfile.js:342-364` |
| `GET /api/autofill`, `/api/extension/autofill` → `buildAutofillPayload` (the `user_profile` row) | `routes/account.js:420-435` |
| the Atlas's terms → `haveTerms` (`profile_skills`, else the résumé's parse — D120 P1) | `services/atlas/atlasStore.js:88-98` |

**Components:** ProfilePanel (`panels/ProfilePanel.jsx`) mounts ProfileSections (`:955`, which reads `/api/profile/sections`). JobsPanel reads `/api/profile` for eligibility (`JobsPanel.jsx:1494`).

**Divergences:**

**D-Pr1 · Two profile shapes.**
- The raw `user_profile` row (`account.js:357-360`), which the autofill payload is built from, and the D101 sections (`structuredProfile.js:342`).

**D-Pr2 · `readProfile` writes the sections on first open**, from the résumé's parse (`structuredProfile.js:344-350`).
- `haveTerms` carries the fallback for users who never opened the Profile (`atlasStore.js:81-95`) — the cause of D120 P1's bug.

## 5. Company

**Read paths:**

| Read | file:line |
|---|---|
| `GET /api/company/:company` → `getCompanyProfile` | `server.js:9153-9155` · `services/kb/companyProfile.js:93` |
| the company KB routes | `routes/companyKb.js:13-55` |
| the logo, `GET /api/company-logo/:key` | `server.js:10830` |
| identity: `companyNameKey` / `groupCompanies` | `shared/companyIdentity.js:23` (used at `services/applicationRecords.js:476-482`) |

**Components:**

| Component | Used at |
|---|---|
| CompanyBubble | `DraftHouseTree.jsx:60, 96` · `DraftHouseSide.jsx:35` |
| CompanyLogo | JobBubble `:83` · JobCard `:591, 615, 658` · JobDetailPanel `:335` · DeckView `:338, 537` · ResumeList `:32` · AtsReportPanel `:68` |
| CompanyLink | JobBubble `:88` · JobCard `:668` · JobDetailPanel `:340` · PendingApplications `:50, 190` · AtsReportPanel `:72` |
| CompanyViewModal | JobBubble `:123` · JobCard `:884` · JobDetailPanel `:367` |
| CardBack | `DeckView.jsx:487` · `DealBackdrop.jsx:42` |

**Divergences:**

**D-C1 · Four company-name normalisers:**
- `shared/companyIdentity.js:23`
- `services/applicationRecords.js:50`
- `services/customAnswers.js:73`
- `services/jobs/companyLogoStore.js:46`

**D-C2 · CompanyBubble is adopted by Draft House only.**
- Its own header lists the board, The Table and the Atlas as next (`CompanyBubble.jsx:13-14`).

## 6. Atlas node (`atlas_nodes`)

**Read paths:**

| Read | file:line |
|---|---|
| `readNode` (the page) → `GET /api/atlas/node/:slug` | `atlasStore.js:154` · `routes/atlas.js:147-165` |
| `peekNode` (the popup) → `/api/atlas/peek/:slug` | `atlasLinks.js:110-135` · `routes/atlas.js:119-127` |
| `searchNodes`, `resolveTerms`, `atlasTermsForPosting` | `atlasStore.js:141, 208` · `atlasLinks.js:89` · `routes/atlas.js:97-117` |
| `computeYourMap` and the trees | `atlasMe.js` · `routes/atlas.js:129-145` |
| the editor, `readNodeForEditor` | `atlasEditor.js:79` · `routes/atlas.js:208-212` |

**Client:** the pages are `AtlasPage.jsx`, `AtlasTree.jsx`, `AtlasGraph.jsx` and `YourMap.jsx`; the popup is `components/AtlasTerm.jsx`; the links are `lib/atlasLinks.js:26, 71, 93`; the admin is `panels/adminAtlas.jsx`.

**Divergences:**

**D-N1 · "You have this skill" is computed in four places:**
- `youAgainst`: the term only, and ≥ 0.6 counts as "have" (`routes/atlas.js:82-93`)
- `peekNode`: the term or an alias (`atlasLinks.js:130-133`)
- the tree's viewer: the term only (`atlasTree.js:250-253`)
- interview prep, separately (`services/interviewPrep.js:255-262`; shown at `JobWorkspacePanel.jsx:28-29, 247-250`)

All four now read the one `profileTerms` / `haveTerms` set, which includes confirmed aliases (D120 P1). What differs is the matching and the threshold.

## 7. Learn piece

**Read paths:**

| Read | file:line |
|---|---|
| `GET /api/learn`, `/circle`, `/circle/my-route`, `/earned` | `routes/learn.js:31-66` |
| Atlas → piece, `learnStepForNode` | `services/learn/learnLinks.js:33` · `routes/atlas.js:156-157` · `atlasLinks.js:125-128` |
| a step's state | `shared/learnStepState.js:44` · `pages/atlas/learnModel.js:67` |

**Components:** `PieceBody` is shared by the circle (`LearnCircle.jsx`) and the path view (`LearnView.jsx:98`).

**Divergences: none found.** There is one body component and one link function.

## Divergences, worst first

1. **D-R6** — The only tailored-résumé editor is always editable and exists on the board only. Its save overwrites what Draft House's PDF re-renders, and no other viewer has an editor.
2. **D-R1** — The board's "a row exists" and Draft House's `artifactCurrency` disagree on "has a résumé".
3. **D-R2** — The application page reads only `resume_artifact_id` and says "No tailored résumé" when a row exists.
4. **D-R3** — The Table needs an application record before it shows a résumé.
5. **D-R4** — The extension dock reads only its local generation id; the popup's `resumeReady` is unread.
6. **D-R7 / D-R5** — Saved Jobs shows "✓ Resume" with no View or Export; the Spreadsheet's CV button shows on every row and 404s.
7. **D-P1** — Four posting-description renderers.
8. **D-A1 / D-A2 / D-A3** — Two status vocabularies, two Table row sources, and three or more local status-colour maps.
9. **D-R8 / D-R9** — `/d` gets its résumé data three ways; the per-profile flag is used alone in one place.
10. **D-R10** — Five wordings for "a résumé exists".
11. **D-R11 / D-R12** — Three scopes for "has a base résumé"; a textarea editor for the base.
12. **D-N1** — "You have this skill" has four matchers.
13. **D-C1 / D-C2** — Four company-name normalisers; CompanyBubble used in Draft House only.
14. **D-Pr1** — Two profile read shapes.

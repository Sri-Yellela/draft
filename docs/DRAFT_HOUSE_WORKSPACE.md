# Draft House — the tree, mapped against the code (D113 UI)

Rewritten 2026-10-31 for the tree as built (D113 UI U1–U10, `5c2239f`, pushed in 43t; the leftovers — Make it now,
Withdraw / Add the date / Note why — after it, to the owner's own definition: the WORKLOG block "THE DRAFT HOUSE TREE'S
LEFTOVERS, DEFINED", 10-31). The decision is the WORKLOG's **D113 UI — DECIDED** row; the sketch
is `docs/sketches/draft-house-tree.html`; **where the two differ, the row wins.** This file replaces the D25 write-up
of the run bar and its two columns; §6 says what of D25 is still in force.

⭐ **D146 (owner 11-03) — ONE APPLICATION TRACKER.** Draft House and The Table merged: a plain table
(`components/ApplicationTracker.jsx`, what each row says from `lib/trackerRows.js`) with the tree restyled as the
**auto-apply timeline** beside it. A job's lead card and leaves became the table's **opened row** (`RowOpen`, its panes
*The posting · Résumé · Answers · Emails*); the side column was removed — its blocks went to the counts, the filters and
a broken-connection banner (§5). The WORKLOG's D146 row wins where this file and it differ.

## 0 · One page, three parts

The tab reads **Draft House** (D18); the file is still `client/src/panels/AutoApplyPanel.jsx` and the route
`/app/auto-apply` (renaming them is cost without benefit — `docs/BRAND.md`). The state is `AutoApplyContext`'s, so the
board and this page read one pipeline.

| Part | What it is | Where |
|---|---|---|
| **Header** (U1) | one sentence (*"On. Next look at 5 PM. 3 of 10 sent today. You tap Apply on each pick."* / *"… Good matches are sent for you."* / *"Paused. Nothing new is picked or sent until you resume."*), the mode switch **Ask me first \| Apply for me**, **Pause / Resume**, **Settings** | `AutoApplyPanel.jsx` |
| **Table** (D146) | left: counts, filters + search + period, Position · Résumé · Answers · Status · When; a row opens in place | `components/ApplicationTracker.jsx` |
| **Timeline** (U3, D146) | right, 300 px: the next run, a Now line, each run newest first with its jobs as bubbles; a bubble opens its row | `components/DraftHouseTree.jsx` |
| **Settings** (U8) | ONE drawer, three groups | `components/AutoSettingsDrawer.jsx` |

The rules are pure and live in `client/src/lib/draftHouseTree.js` (`buildNodes`, `buildTree`, `treeView`,
`branchStep`, `createLeafCache`, `answerRows`, `inlineAnswerStart`, `leftOutLines`, `nextRunFromSettings`); the components
take every piece of state as a prop. Styles: `components/DraftHouse.css`.

## 1 · No second model

- **Status:** every ring is D102's ladder, `shared/applicationStatus.js` (derived from `apply_run_jobs` and
  `job_applications.response_outcome`; nothing stores a ladder value). `ringFor` maps each ladder status to exactly one
  ring; **Picked** is a D113 pick, not a ladder status.
- **Exceptions:** what is held, broke or blocking is still `client/src/lib/draftHouseExceptions.js`
  (`buildStoppedItems`, `filterItems`, `packetLife`) and `client/src/lib/applyObstacles.js` (`groupByApplication`,
  `splitByFault`). The tree shows them; it does not decide them.
- **D113 data:** ONE adapter, `client/src/lib/draftHouseRuns.js` — runs, picks, left-out, Apply / Pass / Make it now,
  and the existing routes the tree reads on the same rhythm (The Table's rows, the portals and Gmail, a run-job's answers,
  a sent row's actions). Every D113 call degrades on a 404: no runs → today's attempts grouped by day, the next-run square
  from Auto settings' run times.

## 2 · The bubble and the rings (U2)

`components/CompanyBubble.jsx` is the **bubble standard** (product-wide): a rounded SQUARE in the draft logo's shape
(radius 27 % of the side — never a circle, never a pill, D60), the company mark inside through `CompanyLogo`, a raised
look, and ONE status ring of the same shape. Contrast themes swap the shadow for a solid outline.

Seven rings, colour **tokens** only (`client/src/styles/rings.js`), seven distinct colours in all four themes:

| Ring | Token | Pulses | Ladder |
|---|---|---|---|
| Needs you | ACCENT | ✓ | `needs_you` |
| Ready for your review | WARNING | ✓ | `ready_to_approve` |
| Picked | INK_FAINT | | a D113 pick waiting for Apply |
| Working on it | INFO | ✓ | `queued`, `in_flight` |
| Sent | SUCCESS | | `submitted` |
| Replied | VIOLET | | `interview`, `assessment`, `offer`, `rejected` |
| Stopped | DANGER | | `failed`, `skipped`; and `withdrawn`, whose ring says **Withdrawn** |

`prefers-reduced-motion` stops the pulse. A legend sits under the tree.

## 3 · The tree (U3, U4, U6)

- **Runs.** The next run is a dashed square (*"Next look. You'll get one email with the picks."*); each stored run
  (`picks_runs`, D113 P1) shows its time, its square on the trunk and a meta line (*"214 looked at · 4 picked · why
  these"*). Detail − / +: bubbles only · bubbles + the meta line (default) · bubbles + company names. Day headings are
  sticky.
- **One branch open at a time** (`branchStep`; opening another closes the first; Escape closes).
  - **A run** → its card: picked, left out, the counts **by reason** (outside your filters · not eligible · stale or
    reposted · over today's limit · company · level) + **Change filters** (Settings at *Which jobs*) · **See what was
    left out** (`GET /api/picks/runs/:id/left-out`, kept 14 days).
  - **A job** → ⭐ since D146 its **row in the table** opens in place (the old lead card) with ONE headline and the
    stage's actions, then the panes (the old leaves, grouped: *Answers* = What happened + Answers + The form as filled),
    each loaded only when opened (`createLeafCache`): **What happened** (attempts, the run's log, the scoped review) ·
    **Answers** (a loose match flagged *read this*; the user's own statements — attestation, eligibility — marked and
    never shown or seeded as filled) · **The form as filled** (the picture) · **Your résumé for it** · **The job**.
- **Filters + search** — ⭐ since D146 the TABLE's: **All · Needs you · In progress · Sent · Replies · Stopped**, a search
  field and the period (`trackerView`). The timeline shows every run and dims nothing.

## 4 · The sentences and actions per state (U5)

| State | Actions in the lead card |
|---|---|
| a question | the question inline + *Save this answer for next time* · **Answer** / **Stop this one** |
| sign-in expired | **Sign in again** / Apply yourself |
| ready | **Approve & send** / Reject / Clear (D90 P3's changes above them) |
| picked | **Apply** / **Pass**; the résumé leaf: *"made after you tap Apply"* + **Make it now** |
| working | *"Filling the form now…"* + **Stop this one** |
| required fields empty | **Answer them** / Apply yourself |
| no confirmation after submit | **Check it** / Run it again / Apply yourself |
| answers too old | **Prepare again** (D52) / Clear |
| posting removed | **Clear** (Restore is in the bin, under Tidy up) |
| sent, no reply | **I heard back** (the job's page) / **Withdraw** |
| interview | **Open interview prep** / **Add the date** (then **Change the date**) |
| assessment | **Prep for it** / **Add the date** (then **Change the date**) |
| offer | **Open it** (the job's page) |
| rejected | **Note why** |

**Make it now** — `POST /api/picks/:id/resume` (`routes/picksConfirm.js` `makePickResume`): the tailored résumé for an
offered pick, on the user's press — the one exception to "tailoring only after Apply", because the user asked — through
the normal generation path (`generateResumeForApply`: the plan's résumé limit applies), plus one of the day's Draft
slots (A63), refused at zero; a current résumé is free. The pick stays a pick; no run starts; nothing is filled or
sent; the job is not tagged Pending. A user on "send my base résumé" (D66) has nothing to tailor → 409. The leaf then
shows the result — *"Made. Résumé: <band>. Nothing was sent."* and **What we changed** (D90 P3). **A later Apply reuses
it:** it is the `generate` tool's artifact for the job, the tool a pick's run uses, and `generateResumeForApply` returns
a current artifact without a model call. Each pick on `GET /api/picks/runs` carries `resumeReady`.

**Withdraw / Add the date / Note why** — on the ladder status the row reads now (`services/pipelineWorkspace.js`
`ROW_ACTIONS`). ⛔ **None of them tells the employer anything**; they record the user's own word in draft.
- **Withdraw** — ⛔ draft cannot withdraw an application on most employers' systems and never pretends to. The button
  opens the company's own page for the application in a new tab and shows *"Withdraw it on <company>'s site; then
  confirm here"* with **I withdrew it**. Only that confirmation calls `POST /api/pipeline/applications/:applicationId/withdrawn`
  (the row's owner only; any sent status but a rejection; once): `job_applications.response_outcome` becomes `withdrawn`
  through `mergeResponse`, and the ladder reads its terminal **`withdrawn`** — on The Table (its own tab; History reads
  "Withdrawn"), Stopped's red ring named *Withdrawn* in the tree (*"You withdrew it. It's closed."*), never in Tidy up,
  and in no count of D111's rates (neither a reply nor silence). A recorded but not yet verified submission has no record
  to write → 409.
- **Add the date** — `interview` and `assessment`: a date, an optional time and a time zone (the viewer's by default),
  inline in the lead card, through D110's `PUT /api/interview/prep/:applicationId/date`. D110's `interview_prep` stays
  the ONE store of it: migration 200 adds `time_zone` and `interview_at` (that moment as epoch seconds) beside the date
  and time, so D110's countdown and Prep tab read the same row the tree does. The row carries it (`interview`) and
  says it — *"Interview Wed 4 Nov, 2 PM"* — and the action becomes **Change the date**, opened with what was saved.
- **Note why** — `PUT /api/pipeline/job/:applicationId/note` `{ note, reasons }`, `rejected` only, the row's owner only:
  a short private note (≤ 500 characters) and optional quick picks — *Not a fit · Level · Location · Visa / eligibility
  · No reason given* (`shared/applicationResponse.js` `REJECTION_REASONS`) — in their own fields
  (`job_applications.rejection_note` / `rejection_reasons`, migration 200; The Table's Notes column is left alone).
  D111 may later count by the picks only; the note is never read by a model (D17). Inline in the lead card, opened
  with what was saved.

**Full page** opens the application's own page (`JobWorkspacePanel`, `/app/job/for/<jobId>`): beside the tree on a wide
screen, the page itself below that.

## 5 · Where the side column went (D146) and Settings (U8)

The side column (U7) is REMOVED; each of its blocks, in its old order, now lives here:

1. **Broken connections** — one banner line each, with its fix, above the table.
2. **Needs you** — the accented count and the *Needs you* filter (questions, sign-ins, picks).
3. **Ready for your review** — the *Ready to send* rows; **Review all** under the timeline (the deep review modal;
   **Approve all lives inside it**, with its second confirm); **Send all ready (n)** in the header, one confirm listing them.
4. **Running** — the *In progress* filter; the A59 line (move, tool, remove) under the timeline.
5. **Replies** — the *Replies* filter.
6. **Tidy up** — under the timeline: Clear older than 7 / 30 days; the D53 bin (Restore / Delete now).

A timeline bubble opens that job's row in the table and scrolls to it.

**Settings** — one drawer (`AutoSettingsDrawer`), three groups (+ D146's fourth, *View*: The Table's other layouts — the full sheet): *When and how much* (daily cap, run times, picks arrive
by, **Show me the form before sending**, what Pause does) · *Which jobs* (board filters, per-company limit, skip after an
interview, **Skip stale or reposted jobs** = D107 P3) · *Accounts on job sites* (D100's portals and accounts with
Remove, Gmail, **Agree to a job site's terms for me**). The old Portals drawer merged into it.

**Narrow (U10, below 900 px):** one column and a switch, *Applications · Auto-apply timeline* (D146 layout 3); branches
indent 16 px, actions wrap.

## 6 · What of D25 is still in force

- **Pause / Resume = D25's per-user hold.** `POST /api/apply/hold` (`services/applyUserHold.js`): nothing new starts —
  waiting drafts stay in line, a run in progress starts no further application; an application already being filled
  finishes (Stop this one cancels it); ⛔ **it does not recall anything already sent.** Covered by
  `test/d25UserHold.test.js`.
- **`GET /api/apply/run-bar`** still feeds the header (mode, the three caps, the hold); the bar itself is gone.
- **`abortable`** on the in-flight feed gives a working row its Stop.

**Removed (U9):** `DraftRunBar.jsx`, `StoppedItem.jsx` (and its hover rail), `PortalsDrawer.jsx`, the separate Stopped list
and its search, the tabbed list, and select mode (*Done selecting* — Review all covers its one bulk use). Restore and
Delete now live in a stopped job's branch and in Tidy up.

## 7 · Verification

- `test/d113ui.test.js` — the named D113 UI tests (`d113uiOneBranchOpen`, `d113uiRingFromLadder`, … `d113uiNarrow`) and
  the leftovers as the owner defined them (`d113uiMakeItNowTailorsOnceAndReuses`, `d113uiWithdrawNeverClaimsToWithdraw`,
  `d113uiWithdrawnStatus`, `d113uiAddDateStartsPrep`, `d113uiNoteWhySaved`, `d113uiWorkspaceDocCurrent`,
  `d113uiHarnessesCurrent`) and `test/d111ExcludesWithdrawn.test.js`. The components are rendered with esbuild +
  react-dom/server; the routes run on an in-memory database built by the real migrations.
- `test/d113Picks.test.js` — the server loop (P1–P4, P6). `test/d25DraftHouseWorkspace.test.js` — the header's
  Pause / mode / caps and the exceptions model's order.
- The owner's walk on production is the acceptance: one bubble of each ring, one run's *why these*, Review all,
  Settings, each filter.

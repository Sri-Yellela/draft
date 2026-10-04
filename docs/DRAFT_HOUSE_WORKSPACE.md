# Draft House — the workspace model, mapped against the code (D25)

Written 2026-10-04 on branch `d25-draft-house-workspace`, from `main` `217d140`. Every line number in
§1 and §2 is from that commit, before D25 changed anything; §3 says what D25 added.

## 0 · The premise, corrected

The D25 row says "Draft House has not shipped". That is wrong for **D14** and **D18**: the tab reads
**Draft House** (`client/src/App.jsx:337`) and `client/src/panels/AutoApplyPanel.jsx:651-867` renders
**Stopped │ Queued** side by side from 1080 px (`data-draft-stopped`, `data-draft-queued`), stacking
Stopped-first below it. Both were built *inside* `AutoApplyPanel.jsx`, whose header comment
(`:38-57`) was still the W5/AD1-era "the strip that used to sit between the search bar and the
postings … MOVED here whole" — which is what the row read.

What *was* true: the AD1 chrome still filled the panel, and none of the workspace model existed.

## 1 · What the panel rendered at `217d140`, item by item

| # | Piece | Where | Workspace model says |
|---|---|---|---|
| 1 | Title "Draft House" + lead line | `AutoApplyPanel.jsx:456-465` | keep |
| 2 | "Nothing drafted yet" empty state | `:468-473` | keep |
| 3 | Autofill-unavailable line, `applyMsg` line | `:480-487` | keep |
| 4 | **`PanelSubTabs`** — COMPLETED / PENDING / ABORTED, date-scoped counts | `:512-533` | ⛔ remove — COMPLETED is a **Sent** column (D15 owns Sent) |
| 5 | The tab's one-line note (`data-rm-tab-note`) | `:543-547` | remove with 4 |
| 6 | Control row: **`PanelSearch`** + **`DateFilterButton`** + "Counts are for …" | `:555-591` | remove — the calendar was AD1's *primary navigation*; the workspace's primary surface is the exceptions |
| 7 | "Showing <day> — your most recent activity" (AH6) | `:598-614` | remove with 6 |
| 8 | "Waiting on you right now — not filtered by the date above" | `:643-649` | remove — there is no date above any more |
| 9 | **D14 split** — Stopped (3fr) │ Queued (1fr), only on the PENDING sub-tab | `:657-868` | keep the split; show it always |
| 9a | Stopped: "Needs review" heading, "Review all N →" | `:675-690` | keep "Review all" (AB3's deliberate unscoped entry) |
| 9b | Stopped: `PrerequisiteCards` | `:698-700` | becomes stopped items |
| 9c | Stopped: portal batches (`ObstacleCard` per origin), truncation notice | `:711-741` | becomes stopped items; keep the truncation notice |
| 9d | Stopped: three question cards (confirm / attest / other) | `:744-785` | becomes stopped items |
| 9e | Stopped: approvals card with the approval-cap sentence | `:788-812` | becomes one stopped item **per application**; the cap moves to the run bar |
| 9f | Stopped: handoff message | `:817-829` | keep |
| 9g | Queued: `WaitingLine` (A59) | `:849-851` | keep — "Queued" is a glance |
| 9h | Queued: In flight (`ApplicationRow variant="inFlight"`) | `:853-865` | keep; give it Stop (`abortRunJob`), which until now was only reachable from the dated listing |
| 10 | Date empty states (`no-date`, `empty-date`, `empty-tab`/`no-match`) | `:890-921` | remove with 6 |
| 11 | PENDING listing: `TileGrid` of `CompanyTile`s, `groupByApplication` → `groupByCompany`, `CompanyApplicationRow` | `:930-996` | ⛔ remove — company tiles; held applications become stopped items, one per application (AB2's `groupByApplication` stays: it is a correctness rule, not chrome) |
| 12 | COMPLETED listing: `CompanyTile`s of `ApplicationRow variant="submitted"` | `:1005-1026` | ⛔ remove — that is **Sent**, The Table's (D15) |
| 13 | ABORTED listing: `splitByFault` → broke / held-on-purpose tiles | `:1035-1112` | remove — terminal, nothing waits on the user; history is The Table's |
| 14 | The review modal (approvals, questions, portal batches, company → application → problems with `resolutionPlan`, attempts, logs) | `:1115-1680` | keep — it is the deep review behind every stopped item, not column chrome |

Also: `AutoApplyContext.jsx:449-467` fetched `GET /api/apply/history/latest` (and then a dated
listing) once per sign-in to pre-pick the day for item 6. With 6 gone that is two requests for
nothing.

## 2 · The workspace model's pieces — what the server already had

| Piece | Server support at `217d140` | Where |
|---|---|---|
| **Mode** (SEMI / AUTO) | ⚠ Per RUN only, no per-user setting. Every Draft from the deck or board is `mode:"auto"` with no `approvalMode`, which **previews and parks for approval** — i.e. what the user experiences as SEMI. Unattended sending needs `approvalMode:"auto"`, which the deck and board are forbidden to send. Nothing anywhere records that full-auto has ever been proven. | `routes/apply.js:1808-1822` (mode/approval resolution), `:2084-2087` (surface refusal), `client/src/lib/jobDecisions.js:78` |
| Cap 1 — **queue** (previews opened / 24 h) | ✅ enforced, usage counted, reported only in a run's 202 body | `APPLY_DAILY_QUEUE_CAP=40` `:404`, `queuedLast24h` `:566`, refusal `:1938-1949` |
| Cap 2 — **approval** (model spend / 24 h) | ✅ enforced; usage on `GET /api/apply/pending` and the 202 body | `APPLY_DAILY_APPROVAL_CAP=30` `:424`, `approvedLast24h` `:591`, refusal `:1960-1976` |
| Cap 3 — **submission** (sent / 24 h) | ✅ enforced at admission and re-checked per job; usage only in the 202 body | `APPLY_DAILY_CAP=25` `:371`, `submittedLast24h` `:527`, `:1160-1167`, `:1982-1991` |
| A single read of all three for a page | ❌ none | — |
| **Kill switch** state | ✅ global, admin-only. Read per request (`services/appSettings.js:53`), enforced at admission (`routes/apply.js:1843`), per job before any browser opens (`:1151-1157`) and on the line (`lineHeldBy`, `:647-650`). Admin write path `server.js:6997-7027`. A user can see it only as the line's `held` sentence (`:2294-2297`). | |
| **User "Stop everything"** | ❌ none. Abort exists per run-job (`POST /api/apply/run-jobs/:id/abort`, `:2926`) and the line's remove per waiting run (`:2363`), but nothing user-scoped stops what has not started. | — |

## 3 · What D25 added

**Server** (`routes/apply.js` + `services/applyUserHold.js`; no migration, no `server.js` change):

- **A per-user hold.** Stored in `app_settings` as `apply_user_hold:<userId>`, the same table and the
  same read-at-request-time rule as the kill switch, so no migration. Checked by the same three
  doors the kill switch already guards for the *line*:
  - `lineHeldBy(run)` returns `"user_hold"` first, so `dispatchLine` — the ticker, a finishing run,
    boot recovery's last step — starts nothing for a held user;
  - `startRun` admits a held user's new Draft as **waiting** rather than starting it (every other
    admission check still runs at the moment of the Draft);
  - `processRun` checks the hold **before it marks the run running and before each next job is
    launched**; a held run goes back to the head of the line with its unstarted jobs still queued.
    This is the check that covers boot recovery and any race with the two above. A run parked here
    does not re-dispatch the line on its way out, so the two checks can never ping-pong a run
    between `waiting` and `queued` (an injected-violation check found that loop — see §6).
- **`abortable` on the inFlight feed** (`GET /api/apply/runs`), the same expression the dated history
  uses, so Draft House's In flight rows carry Stop without the client deciding what can be stopped.
- **`GET /api/apply/run-bar`** — the mode (current `"semi"`; AUTO `locked:true` with the reason, and
  the kill-switch state alongside), the three caps with `used / limit / remaining`, and the hold.
  ⛔ AUTO's lock is a server constant: it opens only when the server says so (D22 gates that on AF5
  and a supervised full-auto run). The client never unlocks it.
- **`POST /api/apply/hold`** `{ held: true|false }` — set or release; releasing dispatches the line.

**What Stop does and does not do** (the bar says the same): nothing new starts — waiting drafts stay
in line, a run in progress starts no further application; an application already being filled
finishes (Stop on that row in Queued cancels it); ⛔ **it does not recall anything already sent.**

**Client:** the run bar (`client/src/components/DraftRunBar.jsx`), the Stopped column rebuilt as
exception items with D1's rail and depth (`client/src/components/StoppedItem.jsx`, built from
`client/src/lib/draftHouseExceptions.js`), the fold's one line for exact matches, and items 4-8 and
10-13 above removed. `AutoApplyContext` and `PanelControls` are reused, not forked (PanelSearch
narrows Stopped once it has six or more items; the Database panel still renders all three controls).

Stopped lists, in order: missing prerequisites · portal sign-ins (one per portal, with its count) ·
question groups (guesses / attestations / blanks) · one item per application waiting for approval ·
one per held application · one per application that **broke** (the broke half of `splitByFault`;
held-on-purpose is history, not an exception). An approval's fold lists only the guessed answers
and says "12 of 14 needed no attention"; Approve & send is in the fold, after the reading, never on
the rail.

Removed from `AutoApplyPanelSections.jsx` with nothing left rendering them: `ObstacleCard`,
`PrerequisiteCards`, `CompanyTile`, `CompanyApplicationRow`. AH6's mount-time
`/api/apply/history/latest` bootstrap was removed from the context (it fed only the calendar); the
endpoint and `loadHistory` remain.

## 4 · Anticipated, not built (D22)

A remote run will be a Queued row with its own phase text; an expired portal session will be a
Stopped item whose fold says when the portal signs the user out. `draftHouseExceptions.js` keys
items by `kind`, so each is one more kind — no second list.

## 5 · RecruiterPanel (D5 follow-up)

**Reachable — not removed.** `/app/recruiter` is in `ROUTE_ONLY_TABS` (`App.jsx:360`) and two in-app
links lead to it: `JobCard.jsx:855` (logged-in cards; the Database panel renders JobCard,
`DatabasePanel.jsx:1053`) and `CompanyViewModal.jsx:77` (opened from `JobBubble.jsx:125`, i.e. every
Full House card, and from `JobDetailPanel.jsx:403`). Whether those links go is O53.

## 6 · Verification

- Tests: `test/d25UserHold.test.js` (the hold, end to end against the real routes and migration 120),
  `test/d25DraftHouseWorkspace.test.js` (the bar, the fold, no Sent column, D1 rail, reuse, the
  Recruiter finding). Tests that pinned AD1 / AC3 / AH6 chrome were re-pinned or deleted on purpose;
  each file says which.
- Screenshots (real server, throwaway database, synthetic user): `draft-screenshots/d25/` — SEMI,
  AUTO locked, a stopped item open, the fold, Stop everything held; 1280 and 390 px.
- ⚠ `scripts/abPanelUi.mjs` (the AD1/AC3 real-browser harness) still drives the sub-tabs and tiles
  D25 removed; it is not part of `npm test` and was not rewritten here.

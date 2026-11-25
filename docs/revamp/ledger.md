# D197 Wave 1 · #3 — THE LEDGER (Home) · M1 feature inventory

Read from the code on 2026-11-25 (47h, lane *ledger*, from local `main` `01684fd2`). Paths are under `client/src/`. Home is
`/app/auto-apply` (`App.jsx:797` → `panels/AutoApplyPanel.jsx`, 2,240 lines; the dock's *Home*, `components/AppNav.jsx:62`).
The board is `Ledger` on the approved canvas (`docs/sketches/final/project/Ledger.dc.html`): **the run · Needs you one at a
time · the register · tickets out** (D199 C1: the market's old *Tickets out* joins it). D200 Rule 1: three columns per row —
the element · what it DID · where it does that NOW. A row whose "where now" is empty blocks the merge.

The header follows **D200 Rule 3**, not the board: the ledger is a working page, so its 100 px *"The ledger."* + the lead
become one plain serif line (≈ 40 px, *Your applications*) under a mono kicker (*THE LEDGER · WEEK 47*). Listed as a
disagreement below.

The plate ledger is on with the plate market (`plate/marketPlate.js` — one switch, `?plate=0` turns both off in a browser);
`?plate=0` keeps today's Home exactly (the classic render branch is untouched).

## 1 · The header (`AutoApplyPanel.jsx:1482-1503`)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | *Home* title (44 px serif) | names the page | the one serif line *Your applications* (`plate/Ledger.jsx` `LedgerHeader`, `data-ledger-title`) + the kicker *THE LEDGER · YOUR APPLICATIONS · WEEK N* |
| ☑ | Summary line `data-home-summary` (*12 this month · 3 replies · 1 interview coming up*, `lib/trackerRows.js homeSummary`) | the month at a glance | the same line under the title (one short sentence — Rule 3 allows it: it says what the counts don't) |
| ☑ | *Today's question · 2 minutes* `data-daily-line` (D154 P1) | one line to the daily question | the header's actions row, a plain link (same href) |
| ☑ | Import `data-import-open` → `ImportPanel` | The Table's CSV import | the header's actions (a plate button, same handler, same panel) |
| ☑ | Export `data-export-open` → Excel / CSV `data-export-kind` | every application / the rows shown | the header's actions; the two choices open under it as before |
| ☑ | *Send all ready (n)* `data-send-all-ready` (one confirm listing them) | approves every Ready-to-send row | the header's actions, ink button, same confirm |
| ☑ | (new) the counts | — | the stats strip *NEEDS YOU · IN PROGRESS · SENT · REPLIED · INTERVIEW* (`lib/trackerRows.js filterCounts`); **every cell filters the register** (D200 Rule 2) and *NEEDS YOU* goes clay when > 0 |

## 2 · The auto-apply bar (`AutoApplyPanel.jsx:1519-1543`) → the run (the board's right column)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | Live dot + *Auto-apply is running · 4 of 10 today · next run at 3:00 pm* / *is paused* | the run's state | **THE WORKER** card: the dot (green running / clay paused / red stalled) + the line; *If it stops, this turns red and drafts say so* |
| ☑ | Mode *Ask me first* / *Apply for me* `data-mode` (locked with `data-auto-locked-reason`) | the mode, the operator's lock | the run card's kicker says the mode; the two segments sit under the worker card as plate buttons with the same handlers, `aria-pressed`, lock and reason |
| ☑ | Pause / Resume `data-stop-everything` (the safety stop) | stops everything | beside the mode, same handler and title |
| ☑ | Settings `data-settings-open` → `AutoSettingsDrawer` | when / which jobs / accounts / view | beside Pause; the drawer is unchanged |
| ☑ | *Run now* `data-run-now` (timeline head, A166 / A179 F5) + its result `data-run-now-msg` | starts the next batch at once | **the clay ticket *Run now*** (the board's), kicker *ASK ME FIRST / APPLY FOR ME · N OF CAP · NEXT RUN*, line *N of M new drafts left today · re-runs are free* (`applySlots`), the result under it |
| ☑ | Runner stalled `data-runner-stalled` | *N drafts waiting: the form filler has been stuck…* | the worker card turns red and says it |
| ☑ | (new) the run's route | — | **the route drawing** (`LedgerRun`): the front application's `runSteps` (`lib/heldApplication.js`) as stops — *READ · TAILORED · ATTACHED · FILLED · YOU · SENT*, lit only when the worker reported it; the front = the first that needs you, else the newest in progress, else the newest; tapping it opens that row in the register |

## 3 · Needs you (`AutoApplyPanel.jsx:1545-1559` the cards; `:130-238` the stepper inside an opened row)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | Needs-you card `data-home-need="need"` (*Answer it* / *Open it*) | the first application that needs you, opens its row | **section 01**: the held questions of that application asked ONE AT A TIME in the board's question ticket (`HeldQuestionStepper` in its plate face: kicker *ONLY YOU CAN ANSWER THIS*, the dots, *QUESTION 1 OF 4*, the 44 px question, Yes / No as big buttons, *Save this answer for next time*, Back, *See all N*); *All answered* → *Ready to approve* with *Finish the form* (the board's done card). A need with no named questions shows its line + *Open it* |
| ☑ | The stepper's free-text draft via Ask draft (A199, `draft:ask-question` / `draft:use-answer`) | the draft is written in Ask draft, never in the box | the same events from the plate face; *Ask again* kept |
| ☑ | *Answer them with Ask draft* / *answer here instead* (`QuestionsInAskDraft`) | the thread opens once per held run | in the opened register row as before; section 01 answers here and links *Answer with Ask draft instead* |
| ☑ | Interview card `data-home-need="interview"` → `/app/interview` | the next interview | the ticket *INTERVIEW · ON <WEEKDAY>* in **Tickets out** (*Prepare before they reply* when none is booked and something was sent) |
| ☑ | Ready card `data-home-need="ready"` (*Review and submit*) | the first ready row | section 01's second state when nothing needs answering: *Ready to approve* + *Review and submit* (opens the row) |
| ☑ | (new) *Filled for you* | — | the side sheet (`FactSheet`): the answers the run filled from your résumé / profile (`answerRows`), *Nothing here is guessed*; none reported → it says so |

## 4 · Notes and banners (`AutoApplyPanel.jsx:1562-1590`)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | *Autofill is unavailable right now* | a note | above section 01, unchanged (`dh-note`) |
| ☑ | apply / history / pick / pending messages, the capped queue note | status lines | unchanged, same place |
| ☑ | `LiveCheck` (A186) | a run waiting on a visible check | unchanged, same place |
| ☑ | Handoff message + dismiss | what to expect in the other tab | unchanged |
| ☑ | Broken connection banners `data-connection-banner` + fix | one line with its fix | unchanged, above the register |
| ☑ | Held-before-update `data-held-before-update` (A181 5c) | *N drafts were stopped before draft's latest update — try again (free)* | **the register's blue banner** (the board's *3 drafts were held by a problem we've fixed · Re-run all 3*), same handler; *Not now* kept |

## 5 · The register (`AutoApplyPanel.jsx:1597-1652`; `components/ApplicationTracker.jsx`)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | Applications n · Inbox n new `data-home-tabs` | Home's two parts | binder tabs on the register's edge *Applications · Inbox* (same state); the Inbox is unchanged |
| ☑ | Phone switch Applications · Inbox · Auto-apply timeline `data-phone-switch` | one column on a phone | kept (it shows below 900 px as before) |
| ☑ | Filters All · Needs you · In progress · Sent · Replies · Stopped, each with its count; Find (search + period) | narrows the table | plate filter chips with their counts over the register; Find opens the search + period as before |
| ☑ | The table: Position · Résumé · Answers · Status · When, sortable | every application | **the register** rows (the board's): tile, company + role, the six squares (what the worker reported), where it stands (`headlineOf` / the status), the status tag, the row's first action; a *Sort* select (When · Status · Position · Résumé · Answers, both directions) in the register's ink bar keeps the column sorts |
| ☑ | A row opens IN PLACE (`RowOpen`: the panes The posting · Résumé · Answers · Emails, the stage's actions, the stepper, withdraw / date / note edits, the row message) | the application's detail | the register row's action *View* / *Open* opens the SAME `RowOpen` under that row |
| ☑ | Select + bulk | (the timeline's *Choose which* for held drafts) | the register's *SELECT ALL* + *Re-run selected · free* / *Cancel selected* act on the ticked held drafts (`rerunHeld` / `clearRunJobs`); a ticked row that isn't held is skipped and the line says so |
| ☑ | Settings → View → The full sheet (`DatabasePanel`) | The Table's own views | unchanged (the register gives way to it) |
| ☑ | Side detail (`JobWorkspacePanel` + *Its own page* / Close) | an application's page beside the table | unchanged |

## 6 · The auto-apply timeline (`components/DraftHouseTree.jsx`, `AutoApplyPanel.jsx:1336-1476, 1653-1664`)

| ☑ | Element | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | Runs by day, bubbles ringed by stage, a bubble opens its row; *Runs at 9 AM and 6 PM* + the runs note | the run history | beside the register as before (the board has no timeline; kept — Rule 1) |
| ☑ | Review all `data-review-all` (Approve all inside its modal) | every application needing review | the timeline's foot, unchanged |
| ☑ | Try N waiting again / Cancel N held / Choose which `data-rerun-held` `data-cancel-held` `data-choose-held` | held drafts in bulk | the foot, unchanged (also the register's bulk bar) |
| ☑ | Slots line, bulk message, approval budget | the limits where they bite | the foot, unchanged |
| ☑ | The waiting line (`WaitingLine`: tool, move, remove) | the queue before a Draft starts | the foot, unchanged |
| ☑ | Tidy up: clear older than 7 / 30 days; the bin (Restore / Delete now) | housekeeping | the foot, unchanged |
| ☑ | The review modal (runs, packets, approve) | the deep review | unchanged |

## 7 · Tickets out (new on Home — D199 C1 moves the market's section 03 here)

| ☑ | Element (market, `plate/MarketOpenings.jsx` `MarketTickets`) | What it did | Where it does that now |
| --- | --- | --- | --- |
| ☑ | *THE LEDGER · N NEEDS YOU* → `/app/auto-apply` | from the market to here | on Home it IS the page: section 01 + the clay *NEEDS YOU* cell (the board draws no ledger ticket on the ledger) |
| ☑ | *SURVEY SHEET · <the company on top of the deck>* | the survey sheet of the best match | **ticket 2** *SURVEY SHEET · YOUR BEST MATCH* → `/app/companies/<slug>` |
| ☑ | *⇄ INTERCHANGE · ATLAS · <the gap>* | learn the missing technology | **ticket 4** *⇄ INTERCHANGE · ATLAS* (the front application's first missing technology with an Atlas page) |
| ☑ | (new) *THE MARKET · N NEW TODAY · Find the next one* | — | **ticket 1** → `/app/jobs` (the best match's figure from the market's own read) |
| ☑ | (new) *INTERVIEW · N SENT · Prepare before they reply* | — | **ticket 3** → `/app/interview` (the next booked interview names its day instead) |

Each ticket is drawn only when the page can back it (the market's rule): no best match → no survey ticket; no missing
technology with an Atlas page → no interchange.

## Disagreements (board vs today's behaviour — the behaviour kept, the look followed)

1. **The header** — the board's 100 px *"The ledger."* + its lead are D200 Rule 3's example of what to remove on a working
   page; built as one 40 px line + kicker. The header's F5 pair is therefore a LOOK pair, not a gate.
2. **The timeline** is not on the board; kept beside the register (Rule 1).
3. **Filters, Find, Sort, the Inbox tab, Import / Export / Send all ready** are not on the board; kept, in plate dress.
4. **The board's *Approve and send*** on the done card: draft never submits from the stepper (A181: *Finish the form* re-runs
   the job, which ends Ready to approve; approving is the row's own action). The done card keeps *Finish the form*.
5. **A free-text question's draft** (the stepper's *Use this · Edit* once Ask draft has written it): in the plate face the
   draft lands in the question's own box (same `draft:use-answer` event), editable in place, and *Next* uses it — one
   control instead of two; the classic face keeps both.
6. **The register's row button** is the board's: the stage's own *Cancel* / *Re-run · free* (the same handlers the opened row
   shows), else *View*; the company name opens the row in place (the board has no separate open control).

## Built (47h, lane *ledger*)

`plate/Ledger.jsx` (the pieces) · `plate/ledgerModel.js` (pure: the front application, its route's stops, the register's
squares and tags, the counts, tickets out) · `panels/AutoApplyPanel.jsx` (the plate arm: `lgHeader` · `lgNeeds` ·
`lgRegister` · `LedgerTicketsSlot`; the held stepper's plate face) · F5 pairs `ledger-*` in `scripts/d196Regress.mjs`.

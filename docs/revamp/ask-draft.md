Status: M1–M3 done (47j, lane w2-practice) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #12 · **Ask draft** (D177 / D190 — Tiny on draft)

Wave 2's row: *"Ask draft — answers plotted as a route to the places that teach them; Tiny shares the panel on Resume
Master. Must keep: D190's T1 / T2 / T3 tiers, voice, the gap log, side-panel position."* The route view is still **"to
design"** in the log (PIVOTS · LEFT MIDWAY: *Ask draft as a route*), so the mock draws the panel in plate tokens and leaves the
route as a labelled placeholder. **No live change until Wave 1 has landed and the owner has looked (M4).**
Mock: `client/src/pages/dev/platePages/AskDraft.jsx` → `/dev/plate?page=ask-draft` (`&w=390` = the phone sheet).

## M1 · Every control, view, state, link and behaviour today (from the code, 47j)

Files: `client/src/components/AppNav.jsx` (the panel `AskDraftPanel` :301-536, the launcher `TinyBubble` :201-210, the dock's
*Ask draft* item :695, open / close :545-552, :632, :676, :708-709), `AppNav.css:155-235`, `components/AskDraftThread.jsx`
(A199 (2)), `lib/assistantBridge.js`, `shared/assistantEngine.js` (ONE engine, mirrored byte-identical into resume-master),
`shared/assistantVoice.js`, `shared/tinyMascot.js`, `content/assistant/commands-v1.json` (18 draft rows),
`services/assistant/assistant.js` (T3 + the ask log), `server.js:17485-17530`.

### Opening, closing, where it sits

| # | Element | What it does today | file:line | API | Where it lives now |
|---|---|---|---|---|---|
| K1 | **The fox bubble** (Tiny's face, a 60 px circle, fixed bottom-right of every app page; *Ask Tiny* / *Close Tiny*; `aria-expanded`, `aria-controls`) | Opens / closes the card | `AppNav.jsx:201-210`, `AppNav.css:155-160` | — | Kept (D190, owner 11-15): the bubble restyled in plate tokens — a perfect circle stays round (D60 allows it), 1.5 px ink border, 4 px hard shadow; Tiny's face is an illustration, unchanged |
| K2 | The dock's **Ask draft** item after its rule (*Ask draft — opens Tiny*) | The same toggle from the dock | `AppNav.jsx:695`, `plate/Shell.jsx` Dock `ask` | — | Unchanged (Wave 1 #1's dock) |
| K3 | Open state remembered for the tab's session (`draft-ask:open`) | Survives a page change / reload | `:200, 545-546` | — | Kept |
| K4 | Opening focuses the input; `data-ask-open` on `<html>` (A200's timeline fold reads it) | — | `:607-613` | — | Kept |
| K5 | **Esc** closes it (after the profile peek) and returns focus to the bubble; **Close** button | — | `:632, 708`, `:463` | — | Kept |
| K6 | Closed = `inert` + `aria-hidden` (never tabbable) | — | `:458-459` | — | Kept |
| K7 | **Position:** a floating card over the page, right 20 / bottom 92 px, 560 px tall max, above the dock and the peek, below modals; **phone (< 980 px): a bottom sheet, full width, 72 vh**, the bubble hidden while open | Never covers the dock | `AppNav.css:166-170, 232-235` | — | Kept as the card's two placements (the mock shows both). Resume Master: **Tiny's side panel moves the page over, never on top** (D190 (c)) — Wave 2 #20 (Resume Master) owns that placement; the card is the same piece |
| K8 | `draft:ask-question` (Home's held stepper asks for a draft) opens the card | — | `:547-552` | — | Kept |

### The conversation (the one engine — D190: act first, ask a model last)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| T0 | Head: Tiny's face, the name, *draft's helper — no AI for anything draft already holds*, Close | — | `:460-464` | — | The card's strip: the name in serif + the rule in mono (`AskDraftCard`) |
| T1 | The intro (*Tell me what to do — "show me senior remote jobs in Boston", … Anything draft already holds is done without AI.*) | Examples | `:476` | — | The card's intro, same words |
| T2 | Every line → `bot.handle()`: **T1 action** (navigate, draft this job, cancel that draft, save, pass, set the filter sentence, open the résumé editor, open a held application's questions, help, undo), **T2 lookup** (how many need me, drafted today, my match, missing keywords, sponsorship, my skills), **ask back** (ambiguous), **T3** only on an explicit ask (*write …*), labelled | No model for site data (D190, owner 11-14) | `:333-364, 413-424`, `shared/assistantEngine.js:5-19, 167-`, `commands-v1.json` | T1 / T2: the page's own calls; T3: `POST /api/assistant/ask` | Unchanged engine; each of draft's turns carries its tier as a plain mono word (**T1 • ACTION · T2 • FROM YOUR DATA · T3 • WRITTEN BY THE ASSISTANT · ASKS BACK**) — the D152 mark, no box |
| T3 | The turns list (`aria-live="polite"`), *You:* / *Question:* prefixes, the answer text | — | `:479-483` | — | The card's turns (`aria-live` kept) |
| T4 | **Lessons** (1–3 Atlas lessons that exist, with their kind) and **links** | Points to where it's taught | `:486-495` | (from T2 / T3) | Kept as links — and the place where **"answers plotted as a route"** would draw (see M2) |
| T5 | ***Next:*** one next step | — | `:496` | — | Kept |
| T6 | **Undo** on every T1 change (in memory only), *Undone.* / *Couldn't undo.* | Reverses the action | `:425-432, 497-498` | the action's own undo | Kept |
| T7 | Ask-back / are-you-sure: **Yes** / **No** | Confirms a destructive or ambiguous one | `:446, 499-504` | — | Kept (No is dashed: "not yet / cancel") |
| T8 | A **proposed action**: summary + **Confirm** / **Cancel** → *Done.* / *Cancelled.* (the server runs it with the session's user, never the model's) | — | `:447-452, 505-513` | `POST /api/assistant/actions/:id/confirm|cancel` | Kept |
| T9 | *Thinking…* while busy; a failed turn says so | — | `:518, 422` | — | Kept (`THINKING…` mono; a failed turn dashed) |
| T10 | Kept for the tab's session (the last 60 turns, `sessionStorage`), cleared on sign-out (`ASK_CLEAR_EVENT`); newest turn kept in view | — | `:323-331, 367-369` | — | Kept |
| T11 | `/api/assistant/status` on open: `available` decides whether T3 can run and whether the opt-in shows | — | `:396-401` | `GET /api/assistant/status` | Kept |

### Applications (A199)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| P1 | A held question asked from Home (`draft:ask-question`): *Question:* turn → draft's suggestion from the résumé → **Use as my answer** (fills Home's box, `draft:use-answer`) → *In your answer — edit it there.* | Companion drafting | `:370-395, 487-490` | `POST /api/apply/questions/:jobId/draft` | Kept: the card's *Use as my answer* |
| P2 | *Answering <question> — tell Tiny about it in your own words and it writes the answer.* + **Done**; what you type / say becomes the `note` | Your words → the answer | `:471-475, 402-410` | same `{ note }` | Kept (the line above the turns) |
| P3 | A held application's questions as a **thread** (`draft:open-questions`, Draft House's row): one at a time, Yes / No / choice buttons (no model), short typed answers, written answers with *Use this* or your words, **Back**, **Finish the form** (saves to this job, re-runs free) | — | `AskDraftThread.jsx`, `AppNav.jsx:303-316, 466-469` | `POST /api/apply/questions/:jobId/draft`, `POST /api/apply/answers` | Kept: the thread sits above the turns (the card's `children`) — drawn with `QuestionTicket` (the ledger's held stepper wears it already) |

### Voice and the input

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| V1 | The input (600 chars, 2 rows; Enter sends, Shift+Enter a new line; the placeholder changes while answering an application question) + **Ask** (disabled while empty / busy) | — | `:522-528` | — | The card's form, same rules |
| V2 | **Speak** / **Stop** (only where the browser can listen): the browser's speech-to-text → the same engine (or the application `note`); the note (*listening locally* / why it stopped) | D190 P4 voice | `:434-445, 526, 529`, `shared/assistantVoice.js` | — (browser) | Kept: *Speak* beside *Ask*, `aria-pressed`, the note `aria-live` |

### The gap log (D177-3) and the opt-in

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| G1 | **Use my questions to improve Atlas (stored without your name or contact details)** — shown when the assistant is available | Opt-in to the ask log | `:530-533, 453-456` | `PUT /api/assistant/settings { improveAtlas }` | Kept, the card's last line |
| G2 | The ask log: each learning question de-identified, with *covered / partial / gap* — only with the opt-in on | Finds what Atlas can't answer | `services/assistant/assistant.js:14-17, 160-168` | (server) | Unchanged |
| G3 | **Admin → Atlas → Asks**: coverage counts, the top gap terms, the latest asks; a gap term → the Atlas content backlog | The curator's view | `assistant.js:171-193`, `server.js:17521-17530` | `GET /api/admin/assistant/asks`, `POST …/asks/backlog` | Admin (Wave 2 #21); under D201 a gap term → **a Gazetteer entry not yet written** (the backlog) |

### Rows whose home is unclear (for the owner at M4)

- **U1** — *Answers plotted as a route* (the row's idea) is "to design": which answers get a route (a T2 lesson answer with 2–3
  lessons? every learning answer?), and does the route open in the card or on Atlas's Routes? The mock leaves a placeholder.
- **U2** — Tiny's face (`shared/tinyMascot.js`) is an illustration in its own colours; in a plate card it is the only
  non-plate colour. Keep it (as a logo is kept), or draw a plate-ink Tiny?
- **U3** — The extension's Tiny (D191's panel) is Wave 2 #19's; whether it wears this same card is that row's call.

## M2 · The brief (the page recipe)

- **Atlas name:** **Ask draft** (the owner's name; Tiny is the helper who answers). Parts: **the card** (the strip, the
  conversation, the input), **tier marks** (T1 / T2 / T3 / asks back), **the thread** (a held application's questions),
  **the route** (an answer plotted to the places that teach it — *to design*).
- **Region palette:** none of its own — it floats over whatever page is open and **wears that page's region** (the card's
  tints come from `--pl-region*`); the mock shows it over a Region IV page. Clay, green and ink as everywhere.
- **The single clay point:** **Ask** (the send button) — the one primary action in the card. T3's tier word is clay text
  (it's the one turn written by a model — the eye should land on it).
- **Hero plate:** none (a panel, not a page).
- **Sections, each with one drawing:** the card has one section (the conversation); its one drawing is **the route** —
  **drawing needed: "the answer's route: the question as a start flag, the 1–3 lessons as stops on Atlas's physical map, the
  next step as the waypoint"** (D201: a route is a saved order of entries; this is one made on the spot, as D203 (8)'s
  *Make sense of…*). Mock: a labelled placeholder under the answer that has lessons.
- **The one operable model:** **the conversation** — type or speak, the engine answers with its tier, Undo / Yes / No /
  Confirm act on the turn; the mock runs a scripted engine over its fixture (no network).
- **Squares:** none (asking proves nothing; a lesson's square lights on the entry, D201).
- **Onward tickets:** inside an answer — its lessons (→ entries), *Next:*, and the route (*to design*).

## M3 · The mock

`client/src/pages/dev/platePages/AskDraft.jsx` — `AskDraftMock({ width })`: a Region IV page behind (a paper stub with the
area nav), the card in its two placements — floating bottom-right at 1280, the bottom sheet at 390 — with a fixture
conversation that shows every row above: T2 *how many need me?*, T1 *draft this job* with Undo, an ask-back with Yes / No,
a T2 learning answer with lessons, *Next:* and the route placeholder, a T3 with Confirm / Cancel, a held application question
with *Use as my answer*; Speak + the voice note, the opt-in. The fox bubble itself is not drawn (no plate piece yet — at M5 it is a round `pl-btn--icon` with Tiny's face; the dock's *Ask draft* item is Wave 1's). Typing a line runs a tiny scripted matcher (three phrases) so the
model is operable. Library piece added: **`AskDraftCard`** (`plate/Cards.jsx`, registry entry with four states + ask-back
and T3 variants + extremes); the placeholder is **`DrawingToCome`**.

## M5 · What was built (47m, lane practice + the coordinator — the 47n record)

- **The card:** AppNav's `AskDraftPanel` draws `plate/Cards.jsx` `AskDraftCard` inside the same `#appnav-ask` box — the
  fixed placement, open / close, `inert` and the phone's bottom sheet unchanged; `AppNav.css` only places it. The engine is
  untouched (D190: act first, a model last). The card gains `face` (Tiny's, U2 kept as a logo), `renderTurn`, the
  `data-ask-*` hooks the walks read, and `AskNote` (the card's own note line, so AppNav wears no card classes).
- **The answer as a route** (board `AskRoute`): an answer with 2–3 entries → the route card in `plate/RouteMap.jsx`
  (`askRouteWaypoint`: the first unlit stop with a practice step; start flag, stops, the waypoint ticket, the board's curve
  handles and plate mark; `AskRouteBigger`); one entry → its link; more than three → the course's route.
- **Save to my routes:** migration **283** `atlas_question_routes` (both runners, byte-identical) + `routes/atlasQuestionRoutes.js`
  — `GET / POST / DELETE /api/atlas/question-routes`, `requireAuth`, `req.user.id` only, no model; in MERGE_PLAN and the export.
- **F5:** `askroute-card` 0.002 % against the board (was declared LOOK by the lane; built to the board in 47m).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

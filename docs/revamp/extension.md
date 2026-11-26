Status: M1–M3 done (47j, lane w2-outside) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #19 — The extension (D191): the floating panel + the `/d` square, in plate tokens

Nothing in `extension/` changes in this lane. M1 is read from the code (file:line at `a393442e`); M2 is the brief; M3 is
the mock at `/dev/plate?page=extension-panel` (`client/src/pages/dev/platePages/ExtensionPanel.jsx`).

**D191 in one line (WORKLOG 11-14 / 11-18 / 11-19):** ONE panel (not a widget + a docked panel), opening by itself on a
recognised board's posting, drawn from the page first (before draft answers), as long as its content, never over the
employer's Apply; closing leaves the `/d` square, one click reopens it; no model call (D190 / D191 rule); D36 — nothing
submits, the person presses the employer's Submit.

## M1 · What the extension's panel has today (from the code)

### 1 · How the panel arrives

| Behaviour | Where |
| --- | --- |
| Opens BY ITSELF on a posting on the six recognised board families — Greenhouse (`boards.` / `job-boards.greenhouse.io`), Lever, Ashby (`jobs.ashbyhq.com`), Workable (`apply.workable.com`), Workday (`*.myworkdayjobs.com`, `*.myworkdaysite.com`), SmartRecruiters | `extension/autoRead.js:58-78` (`AUTO_SITES`), `extension/panelArrive.js` (content script) → `PANEL_ARRIVE` `background.js:1048-1081` |
| Only: the top frame · `autoOpen` on and the kill switch off · a posting (the URL shape; on Workday the page's own title + company) · never an `/apply` step · once per page load | `background.js:1062-1068` |
| **Page first:** the first frame is drawn from the page's own words (title, company, location — extracted in the page, nothing sent) while the panel says *Checking draft…*; draft's answer redraws it | `pageFirstRead` `background.js:1018-1032`, `jobPanelModel.js:63` (`arriving`) |
| Closed on this site before → arrives as the `/d` square, not the panel | `background.js:1071` (`expand = !meta.place.collapsed`) |
| Signed out → the employer's public card (`GET /api/extension/company`, no account) | `background.js:980`, `:1077` |
| The toolbar press opens the panel on its home (draws it, reads nothing until asked); the shortcut / right-click *Ask draft…* opens the **other-page view** | `background.js:308`, `:594`, `:874`, `openPanelHere` `:1135`, `DOCK_ACTS['open-ask']` `:1334` |
| The badge on the toolbar icon: today's undecided matches (`GET /api/extension/home`) | `background.js:962-979` |

### 2 · The panel (the dock's home tab `draft`, "This job") — `extension/jobPanel.js` draws, `extension/jobPanelModel.js` words

| Row | What it is / does | Where |
| --- | --- | --- |
| Status line | A dot + words (`role=status`), tone quiet / ok / busy; the match % coloured by its band (strong · moderate · weak), no band word | `jobPanel.js:31-46,102`, `jobPanelModel.js:19-24` |
| The job | Logo (draft's company record, https only) or the letter tile; the title (wraps); company · location (one line, ellipsis + tooltip) | `jobPanel.js:94-95`, `jobOf` `jobPanelModel.js:35-43`; a logo that fails → the letter `:111` |
| THE ONE button | depth box, radius 10 (D60) — its label and act per state below; busy while its act runs; then the worker re-reads and redraws (`PANEL_REFRESH`) | `jobPanel.js:104,208-213` |
| The note | at most one line under the button; sometimes a link (`sign-up`, `open-runner`) | `jobPanel.js:96` |
| The *said* line | the worker's sentence after an act (refusals, "Taken off your board.") — `role=alert` | `jobPanel.js:107,211` |
| The middle | stretches only when the person made the panel taller | `jobPanel.js:63,108` |
| **How I apply** (group) | heading + *All settings* (`auto-setup`) · **Résumé: <job profile> ▾** (lists ≤ 8 profiles via `PANEL_PROFILES` → `GET /api/domain-profiles`; a pick → `POST /api/domain-profiles/:id/activate`, redraws) · **✓ Review before I submit** (= the account's mode: on = Ask me first / off = Apply for me; `POST /api/apply/mode`, refused 409 while the operator paused sending — the switch goes back and says why) · **✓ Open by itself on job boards** (`PANEL_SETTING autoOpen`) | `jobPanel.js:97-100,170-204`, `background.js:1082-1133` |
| Foot | *Open draft ↗* (`open-draft` → `/app`) | `jobPanel.js:109`, `background.js:1331` |
| **The other-page view** (`kind: other`) | *Your day*: three counts, each opens draft — **new matches** (`/app`), **need you**, **drafted** (`/app/auto-apply`); a note "N waiting to send from this browser" → the runner; **the box** *Search jobs, or ask draft* (Enter = Go; `PANEL_ASK` — the site's engine, T1 / T2, no model) with the reply under it (its tier label; Yes / No when the engine asks first) | `jobPanelModel.js:71-74`, `jobPanel.js:103,105-106,142-165` |
| Height | as long as its content (natural height → `dock.fit`; capped at the viewport; a person's own resize wins); a ResizeObserver follows the résumé list / reply / said line | `jobPanel.js:112-129`, `dock.js:450-455` |
| **Never over the employer's Apply** | finds a visible control whose words are *Apply / Apply now / Apply for this job / Easy apply*; if the panel covers it, the dock steps to the other side (only while the person hasn't placed it; not remembered) | `jobPanel.js:131-138`, `dock.avoid` `dock.js:1007-1022` |
| Clicks | only the person's own (`isTrusted`); every button → `DOCK_ACT` on THIS tab | `jobPanel.js:166-214` |

**The panel's states (`kind`) — status · button · note** (`jobPanelModel.js:57-113`):

| kind | Status | THE button (act) | Note |
| --- | --- | --- | --- |
| `signed-out` | the public facts ("sponsors visas · N open jobs") or *Not signed in* | *Sign in to see your match* / *Sign in to draft* (`sign-in` → `/login`) | *New here? Get started* (`sign-up` → `/register?from=extension`) |
| `arriving` | *Checking draft…* | *Draft this job* (`add-draft`; disabled with no job) | — |
| `other` | *Your day* | — (the three counts + the box) | *N waiting to send from this browser* (`open-runner`) |
| `form` | *Your answers are ready* (busy) | *Fill this form* (`fill`) | *Then press the employer's Submit.* |
| `drafting` | *Tailoring your résumé…* | *Drafting…* (disabled) | — |
| `needs` | *Needs you* | *Answer in draft* (`open-needs` → `/app/auto-apply`) | — |
| `sent` | *Sent* (ok) | *Open in draft* | — |
| `failed` | *Didn't go through* | *Open in draft* (`open-needs`) | — |
| `ready` | *Résumé ready · 86% match* (ok, the % in its band colour) | *Apply from here* (`fill`) | *Fills the form. You press Submit.* |
| `drafted` | *Drafted · waits for your approval* | *Open in draft* (`open-needs`) | — |
| `job` | *86% match · sponsors visas*, else *On your board* / *New to draft* | *Draft this job* (`draft`, or `add-draft` when draft doesn't hold it: capture then draft) | — |

### 3 · The window it sits in — the dock (`extension/dock.js`)

| Row | Where |
| --- | --- |
| Default place: 380 px wide, top-right (16 px in), up to 680 px tall (then its content's height); min 300 × 220, max 760 wide | `dock.js:50,120-124` |
| Header (drag handle): the `/draft` mark · **Move** (arrow keys move, Ctrl+arrow snaps) · **Collapse** · **Settings** (gear) · **Close (Esc)**; with other tabs open also **Snap left / right** and **Open this tab in its own window** (pop-out); a **Submitted** mark when the job is sent | `dock.js:486-500,548-566` |
| **Collapsed / closed → the `/d` square** (52 px, on the nearest screen edge, drags along it, remembered per site): its name and tooltip *Open draft — <what needs you>*; a dot when something needs you; one click reopens the last state | `dock.js:50,143-191,512-523` |
| A pop-out window collapses to a slim bar (`/draft`, the words, Move · Expand · Close) | `dock.js:525-532` |
| Resize from every edge and corner + a keyboard resize grip; snap to an edge by dragging to it; z-order; reduced motion | `dock.js:8-10,339-347,571` |
| **The tab row** (only once a second view exists — D191's "one quiet panel"): **This job** · **Fill** · **ATS** · **Résumé** · **Copy sheet** (icons with aria-label + tooltip, arrow keys) | `dock.js:40-46,534-538,938` |
| Empty / loading / load-error per tab (an icon + a `!` mark with the words) | `dock.js:542-546` |
| The status slot under the header (a view's status line) | `dock.js:567` |
| Placement per site (`meta.place`): rect, edge, collapsed, the square's spot, popped tabs restored | `dock.js:229, 1025` |

### 4 · The other tabs (same window; each its own file — named here so they keep a home)

| Tab | What it carries | Where |
| --- | --- | --- |
| **Fill** | the fill button (*Fill this page*, Ctrl+Shift+Y; busy; what it said) and the field counts the collapsed square reports | `dock.js:545`, `progress.js`, `gated-handoff.js` |
| **ATS** | the ATS card = **D202's FitCard mirrored** (count, bar, *Lines up / Missing*, *Turn over*, the contextual score, the lesson link, *Full report in draft*) | `extension/atsReport.js` (`:968`, `:1084`), `boardJob.js:61`; the client original `client/src/plate/FitCard.jsx` |
| **Résumé** | the tailored résumé: state mark, elapsed, the claim-guard findings, plausibility, preview, *View résumé*, *Attach* / *Attach again*, *Download PDF*, *Cancel*, *Try again*, *Tailor my résumé for this job*, *Read this page now*, *Add your résumé in draft*, *Attach it yourself*; the FitCard's faces | `extension/resumePanel.js:125-171,268,362,476-478,507` |
| **Copy sheet** | the copy sheet (values to paste by hand) | `extension/copy-sheet-panel.js` |

### 5 · Theme today
The panel takes draft's **Dusk / Plain** palette for the person's light / dark scheme from `extension/tokens.js` (no
colour literal), drawn in a shadow root; the system UI font. `MIRRORS` (`client/src/modules.manifest.js:395-401`) lists
what the extension re-draws from the client: `.nb` (AtsNumberBox), `.tile` (CompanyLogo), `.mkr` (marks), `.rm-pill`
(the review overlay's marks), `.btn` (DepthButton) — **the panel itself is not yet a MIRROR row**, and FitCard's mirror is
recorded only in comments (`boardJob.js:61`, `resumePanel.js:167`).

## M2 · The brief

**Atlas name and parts.** Plain names (it lives on someone else's page): **the panel** and **the `/d` square**. Parts:
the **masthead** (the `/d` tile + the move / collapse / settings / close icons, on a 6 px ruler), the **status line** (a
mono kicker: `CHECKING DRAFT…`, `86% MATCH · FILED H-1B`), **the opening** (the letter tile / logo, the serif title, the
company · place — `Opening`'s top half, small), **THE button** (one), **the note**, **How I apply** (three switches as
`pl-btn` toggles, a mono label), and the foot *Open draft ↗*. Other tabs keep their parts (the ATS tab = the FitCard the
plate already has).

**Palette.** Region **IV** (the market's) for rules and the match number's region tone; **clay = THE button only** (the
single clay point; the `/d` slash is clay as everywhere); **green only for proven** — *Sent* and the résumé-skills squares;
paper ground inside the panel (`--pl-paper`), card-white opening, ink 1.5 px borders, hard 5 px shadow (the dock is a
plate on the page). ⛔ The theme leak rule holds: the panel is plate paper in every theme until a dark plate exists
(today it follows Dusk / Plain — the owner decides at M4 whether the panel moves to paper-only, as plate pages did).

**Hero plate.** None — the panel is 380 px on someone else's page; the opening's letter tile is the only picture. Owner
note: D191's "no draft branding louder than the `/d` pill" stands.

**Sections, each with one drawing.** One section (the job); its "drawing" is the match as **lit squares** (the fit
card's skills: *4 of your 5 top skills*) — optional, behind *More* (the owner's 11-19 "few words" rule keeps the
collapsed panel to status · job · button · note).

**The one operable model.** THE button, and the panel itself (drag / collapse to the square / reopen).

**Squares.** The skills squares (above), green = on your résumé.

**Onward tickets.** *Open draft ↗* (foot) · *Answer in draft* / *Open in draft* (by state) · the ATS tab's *Full report in
draft*.

**The `/d` square.** A 52 px square tile (radius `--pl-r-input`, never a capsule — D60), white, 1.5 px ink border, 4 px
hard shadow, the ink *d* with the clay slash (= `PlateLogo`); a clay dot (a perfect circle — allowed) when something needs
you; the same corner / edge it was closed on.

**MIRRORS (M5).** The extension can't import client code, so at M5: a `MIRRORS` row for the panel (`plate/Panels.jsx`
`FloatingPanel` ⇄ `extension/jobPanel.js`), one for the square (`ReopenTab` ⇄ `dock.js .launch`), and FitCard's mirror made a
row (today a comment). The plate token values reach the extension through `extension/tokens.js` (a generated plate
block, as the Dusk / Plain palettes are).

### Where each M1 row lives (D200 Rule 1)

| M1 rows | Where it lives |
| --- | --- |
| §1 arrival (boards, page-first, closed → square, signed out, toolbar press, shortcut, right-click, badge) | unchanged behaviour (`background.js`); only the drawing changes |
| §2 status line | the panel's mono status kicker; the % in the IV ink with its band as a word-free tone (the owner's 11-19 rule) |
| §2 the job | `Opening`-style head: `LetterTile` (logo or letter) + serif title + company · place |
| §2 THE button, per `kind` (11 states) | `pl-btn--primary` (clay) — every label and act kept; disabled = dashed (`pl-btn[disabled]`); busy = `aria-busy` |
| §2 note, said line | `pl-muted` line under the button; the said line `role=alert` |
| §2 How I apply (Résumé ▾, Review, Open by itself, All settings) | a mono `HOW I APPLY` label + `pl-btn` toggles (`aria-checked`, ✓ word); Résumé ▾ = a `pl-btn` with the plate menu (`.pl-menu`) |
| §2 the other-page view (three counts, the box, the reply) | `StatsStrip` with three linked cells (D200 Rule 2 — every number answers) + `NavSearch`-style input + the reply line (tier label in mono) |
| §2 height to content, never over Apply | unchanged (`dock.fit`, `dock.avoid`) |
| §3 the dock's header, move / snap / resize / pop-out / settings / close / Esc | `FloatingPanel`'s header icons (`pl-btn--icon`); the geometry code unchanged |
| §3 the `/d` square + its need dot | `ReopenTab` |
| §3 the tab row (This job · Fill · ATS · Résumé · Copy sheet) | `BinderTabs` with icons (shown only once a second view exists — unchanged rule) |
| §4 Fill tab | a `pl-btn--primary` + its counts as `StatsStrip` |
| §4 ATS tab | **`FitCard`** (the plate's own) — mirrored |
| §4 Résumé tab | `FactSheet` (state, elapsed) + `pl-btn`s for its actions; findings as `StatusTag` marks. **Unclear home:** the preview frame (a sanitised fragment in a shadow root) has no plate piece — proposed: a `PlateHero`-framed paper sheet, owner to confirm |
| §4 Copy sheet | `FactSheet` rows with a copy `pl-btn` each. **Unclear home:** no plate "copy" control exists yet |
| §5 theme (Dusk / Plain) | **Owner's call at M4:** paper-only (as plate pages) or keep following Dusk / Plain until the dark plate variant |

## M3 · The mock

`/dev/plate?page=extension-panel` — a synthetic employer page (a Greenhouse-like posting: *Kestrel Payments · Frontend
Engineer II, Checkout*, its own *Apply* button at the top right) with the panel at its real width (380 px) stepped to the
left of the Apply button, then the states side by side: **job** (86 % match · FILED H-1B), **arriving** (page first),
**ready** (Apply from here), **signed out** (the public card), **the other-page view** (your day + the box), and **the `/d`
square** (with its need dot). At 390 the page column stacks and the panel takes the phone width (min 300). New library
pieces: **`FloatingPanel`** and **`ReopenTab`** (`client/src/plate/Panels.jsx`, registry group "Panels").

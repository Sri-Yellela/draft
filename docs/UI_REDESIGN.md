# draft — UI redesign

**Design document.** Steps 2 and 2b are BUILT (tokens, the paper substrate, the signed-in app on it —
see their status sections at the end); steps 3–6 are designed in full below and NOT built. ⛔ Do not
write the unbuilt parts into `ARCHITECTURE.md`, which documents what exists. Owner decisions recorded
2026-09-27, 09-29 (position encodes fit) and 09-30 (the grain; the deck unblocked).

This is a **UX model change**, not a reskin. The current UI was built for a full board that a user
scans; the product is becoming a daily draft of ten that a user considers. Those need different
shapes.

⛔ **Sequenced after Phase B.** A redesign against a half-split backend means doing it twice.

---

## The decisions

| | |
|---|---|
| **Listings → cards is dropped** | The card **is** the page |
| **Palette** | Cream, orange, glass — from the logo. Kill the dynamic background |
| **Per-session random accent** | ⛔ **Killed.** Fights a two-colour identity, and it meant screenshot diffs needed a same-origin control to tell a change from noise |
| **Keyboard** | Acceleration, **not** the only path. Visible buttons, key shown beside the label |
| **Dark / light mode** | Deferred until after shipping — but ⛔ **every colour is a token from day one** |
| **Kept unchanged** | Glass surfaces, the `StampLogo`, `DockPortal`, the z-scale, the existing panel primitives |

---

## ⛔ The palette problem, and its answer

**Glass needs something behind it to refract.** Over a flat cream field a frosted panel reads as a
slightly different shade of cream and the effect vanishes. Dropping the dynamic background for flat
minimal removes glass's reason to exist.

**The answer is already the brand asset: the logo is photographed on textured paper.** Use a subtle
paper grain as the substrate instead of a gradient. Glass over texture works, it is far quieter than
a moving background, and it is literally where the mark came from.

```
CANVAS          the paper grain — the substrate everything sits on
SURFACE         glass over it — cards, panels, the dock
INK             near-black for text. ⛔ NOT pure black on cream; it vibrates
ACCENT          the logo orange, #FD4600, keyed from the source
ACCENT-QUIET    a desaturated orange for states that are not calls to action
```

⛔ **Every one is a token.** Dark mode later means re-pointing tokens, not hunting literals. The
z-scale was collapsed into one named file for exactly this reason after literals were found
scattered across surfaces — do not repeat that.

⚠ **Contrast is a requirement, not a preference.** Orange on cream is a low-contrast pair. Check
every text-on-background combination against WCAG AA. ⛔ A precedent exists: the `/pricing`
recommended card rendered `--color-primary-text` on a `--color-primary` fill and the badge and CTA
were **invisible**. It shipped and nobody noticed until a screenshot.

---

## The core shift — a deck, not a list

**A list exists to scan many things. The daily draft has ten.** You do not scan ten, you consider
each one.

**One job at full viewport. Navigation is next / previous, not open / close.**

That deletes an entire layer of the current z-stack: no listing → no card overlay → no panels
stacked above it. Detail moves **vertically** instead — job at the top, scroll for matched terms,
the JD, the company. The JD panel, ATS panel and PDF panel stop competing for the same tier.

⭐ **This is a simplification, not an addition.** Considerable machinery exists purely to manage
panels-over-a-board. Most of it can go.

### The draft is dealt

Ten cards arrive with physicality — stacked, then dealt one at a time. It makes "today's draft" a
**discrete event** rather than a page you visit, and it gives the day a natural end: you reach the
bottom of the deck and you are done.

⭐ **The current UI has no such moment.** A board is infinite; you leave it, you never finish it.

⛔ **On a thin day, deal fewer cards. Never pad the deck.** Padding is fabrication in a different
costume, and `PRODUCT_MODEL.md` already names it. An honest four-card day is a feature.

### Band as position, not badge

Let fit be **spatial** — stronger matches earlier in the deck, or occupying more vertical space.

⭐ **ρ = 0.746 supports coarse ordering, and position IS coarse ordering.** A badge reading "Strong"
implies a precision the engine does not have; sequence does not. The band label can still appear on
demand, but the primary signal should be where the card sits.

✅ **The dependency is met.** The owner decided position encodes fit (09-29), and the board ranks by
it since `28b8a33` (deployed 09-30 in `9108a15`; the boot pass scored all 2,688 active jobs):
rank keys → band (Strong, Moderate, *not established*, Weak) → score → recency. *Not established*
— a declined score or one not yet computed — sorts between Moderate and Weak and is never coerced to
a number. The deck deals from exactly this order; see §Step 3.

---

## Keyboard — acceleration, not the only path

⛔ **Decided: visible affordances first.** Buttons on the card, with the key shown beside the label.
Everyone can use it; the shortcut teaches itself through repetition.

**Why not keyboard-first:** a mail client earns `J`/`K` because people live in it daily for years.
draft is opened once a day for ten decisions, and the audience is students, who skew mobile. **A
feature nobody discovers does not exist** — the extension's second hotkey was bound, working and
unmentioned for months, and the fix was a UI that named it.

```
D / →      draft this one          button: "Draft"    D
X / ←      pass                    button: "Pass"     X
Enter      expand detail
J / K      next / previous         (arrows also)
?          shortcut legend
```

⛔ **Mobile has no keyboard, and the gestures must mean the SAME things.** Swipe right = draft,
swipe left = pass, tap = expand. Two clients teaching contradictory habits is worse than either
alone. `ANDROID.md` Phase 2c/2d specify a swipe feed against the **board** model — ⛔ both need
revising before they are built.

⛔ **A gesture or key NEVER submits an application.** Draft queues; approval is a separate,
deliberate act. Every safeguard in this system assumes a human reviews before an application
reaches an employer, and a keystroke is at least as easy to fire accidentally as a swipe. The
Android build once displayed **"Application sent"** for 2.5 seconds having sent nothing — the
failure is not hypothetical.

---

## Transitions that carry information

The current ones are mundane because they are decoration. **Each one should answer: where did that
go?**

| Transition | What it tells the user |
|---|---|
| **Drafted card flies to the queue indicator** | Where it went, and the count incrementing |
| **Passed card slides away and does not return** | Direction encodes finality |
| ⭐ **Shared-element: the card's title becomes the detail heading** | Same element, no fade. The View Transitions API does this natively and it is the single highest-impact change for perceived quality |
| **The slash as progress** | The mark is `/` — already a diagonal. Four of ten drafted fills it proportionally. Brand as instrumentation, not decoration |
| **Deal-in on load** | The draft arriving as an event |

⛔ **`prefers-reduced-motion` on every one.** The chevron animation already respects it and there is
a test; keep that standard.

⛔ **No transition may gate an action.** If a card is mid-flight and the user presses D again, the
next decision registers. An animation that swallows input is worse than no animation.

---

## What is kept

**Do not rebuild these.** They work, they are tested, and several were hard-won:

- `StampLogo` — ⛔ **one implementation**, collapsed from three. The 33-pixel clipping finding lives
  in it and must survive
- `DockPortal` and the portalled listbox — built because a native `<select>` popup cannot be styled
  and inherits OS colours
- The z-scale — named constants in one file, no literals. A test asserts it
- `PanelControls` primitives — extracted, and the Database panel actually uses them, which is the
  only proof an extraction is not a clone
- Glass surfaces and the existing type scale
- The band vocabulary itself: Strong / Moderate / Weak / **Not enough signal**. ⛔ The fourth is a
  correctness state, not a population — the scorer declines rather than fabricating, and that must
  reach the user as its own thing, never as a low score

---

## Dark and light mode — deferred, prepared for

Not in this pass. ⛔ **But build tokens from day one.** If the design lands with literal colours,
adding a theme means finding every one of them.

Notes for when it happens:
- The paper grain is a light-mode substrate. Dark mode needs its own, or glass loses its refraction
  again — designed in §Step 6
- The orange works on both but needs different luminance against dark
- ⛔ Contrast must be re-checked per theme; passing AA on cream says nothing about dark

---

## ⛔ Verification — this project's rule, and it earned it

**Screenshot everything user-visible, at every breakpoint, in both states of every toggle.**

In one session four separate things were green and wrong: a privacy policy a single request
falsifies · a harness scoring unweighted while labelling itself weighted · a guard proving a sweep
complete on the one component it could not see · **two tests requiring the legacy brand to stay**.

Code wired, tests passing, documentation agreeing — **the only thing that disagreed was looking at
the output.**

Specific to this work:
- ⚠ **The current UI is desktop-shaped: 13 media queries in the entire client.** The deck model has
  to work on a phone, and the audience skews mobile. This is a responsive rebuild, not a reskin
- ⚠ Any UI verification done against a local board may be measuring fixtures — check
  `job_role_map`'s row count against the board before trusting a local screenshot
- Verify the band surface renders "Not enough signal" distinctly from "Weak"
- Verify `prefers-reduced-motion` actually suppresses each transition

---

## Sequence

1. ⛔ **Phase B completes first.** A redesign against a half-split backend is done twice
2. **Tokens and the paper substrate** — smallest change, everything else depends on it
3. **The deck**, replacing the board's listing/card split
4. **Transitions**
5. **Mobile** — `ANDROID.md` 2c/2d revised for the deck, not the board
6. **Dark mode**

✅ **Decided 09-29: position encodes fit**, and the ranking landed (`28b8a33`). Step 3 is unblocked.

---

## Step 2 status — tokens and the paper substrate (2026-09-29, `1fd46dc` + `0b76191`; LIVE since `9108a15`, 09-30)

**Built:** `client/src/styles/colorTokens.js` is the one named token file (mirrors `zLayers.js`:
one object `C`, published once as `--c-*` custom properties). The video background and the
per-session random accent (and its four-swatch picker in the profile menu) are gone; the substrate
is `PaperBackground.jsx`, a still, generated feTurbulence grain on `CANVAS #F3ECE0`.
`themes/cinematic.js` maps every long-lived `theme.*` / `--bg-*` / `--color-*` name onto a token,
which is what moved ~1,600 `theme.*` reads and ~550 `var(--…)` reads with no edit.

**Measured:** colour literals in `client/src` 887 (60 files) before → 554 in 22 not-yet-migrated
files after, plus 3 decided exemptions (StampLogo, DockPortal, the vendored chart). Ratcheted by
`test/colorLiteralGuard.test.js` (self-pruning budget; seen to fail by injection three ways).
Darkest rendered substrate pixel `#EDE5D9`, lighter than the `CANVAS_SHADE #E6DDCF` floor every
contrast pair is computed against.

**Contrast findings** (`test/colorTokens.test.js`, all declared pairs pass AA):
⛔ the logo orange `#FD4600` is **2.96:1** on the cream — fails body text AND the 3:1 UI bar, so
it is a FILL only; orange text/icons/focus rings are `ACCENT_INK #A33200` (5.18:1 worst case).
⛔ White on the orange is **3.47:1** — text on the fill is ink (`ON_ACCENT`, 5.0:1). Google's
`#4285F4` carries white at 3.56:1; the sign-in button uses `#1A73E8` (4.51:1).

**Not done / open:** the 22 budgeted files are the signed-in app (board, panels, admin). Their
dark-era literals (e.g. `#0a1f0a` fills, `#22c55e` text) now sit on cream and were NOT
screenshotted — step 2 photographed only what renders without a backend. Band/score colours
(`#16a34a` 2.81:1, `#d97706` 2.71:1 on cream) FAIL AA as text and are in that remainder. The grain
is deliberately faint (measured spread 6 levels); how much texture glass needs is an owner call.

## Step 2b status — the signed-in app (2026-09-30, `2356153`; LIVE since `9108a15`)

**Built:** the 22 budgeted files are migrated — **549 literals, 0 left**; `BUDGET` in
`test/colorLiteralGuard.test.js` is empty and the 22 files (plus `styles/bandStyle.js`) are pinned
in its migrated list. The rewrite was by AST position (`@babel/parser`), not by regex, and chose the
token by the CSS ROLE each literal played — text, fill, edge, shadow, or a positional helper
argument (`btn(bg, fg, bd)`, `chip(bg, fg, …)`) — because the dark → light flip inverts the neutrals:
dark-era `#fff` TEXT sat on coloured buttons (→ paper-white `SURFACE_SOLID`, or ink `ON_ACCENT`
when the fill is the accent); a `#0f0f0f` FILL was a dark panel (→ paper); `#0f0f0f` TEXT was text
on the accent (→ `ON_ACCENT`). Hue families map tone → tone and dark-era tint fills → the `*_QUIET`
fill. Two old-yellow constants (`ACCENT` in DBInspector, `ADMIN_ACCENT` in AdminPanel) were used as
fills AND as text; each keeps the orange for fills and gained an `ACCENT_INK` twin for every text,
edge and stroke use.

**The bands.** Paint moved out of `shared/atsBands.js` (shared with the server; raw hex there sat
outside the token file) into `client/src/styles/bandStyle.js` on `BAND_*` tokens. Each filled band
has a text tone ≥ 4.5:1 on paper and glass and a quiet fill it and ink both pass on, replacing
`#16a34a` 2.81:1 and `#d97706` 2.71:1. ⛔ **Not enough signal is drawn as the ABSENCE of a grade**:
no fill, no hue, muted ink in a dashed outline, captioned "no judgement" where the others say "fit
band". The old grey fill was Weak's shape in a paler colour — a fourth grade. The test now requires
the fill, the text AND the edge style to differ from Weak's.

**The number (G5).** The panel header's "Score {n}" (the "ATS Score 58" beside "Strong match") is a
band chip; a decline shows the dashed No-signal chip, never a blank. Also removed: ATSPanel's "Best
possible: {n}" (now the band), and DatabasePanel's "ATS {n}" chip on a FOURTH surviving copy of the
v3 ≥80/≥60 ramp. The band test now scans for the ramp in any paint and for the best-possible number.
⚠ Kept: the public `/tools/ats` donut prints a number, but it is a **Haiku model's** score on its own
scale, not v4's — v4's cutpoints cannot be applied to it. Owner question (see WORKLOG).

**Screenshotted:** 21 signed-in scenes × 1440/390 against stubbed `/api/*` (Puppeteer request
interception; no server booted), compared with the 09-29 "before" set of the same scenes. Looked at:
board, job detail, ATS Strong / Weak / Not enough signal, auto-apply, admin, mobile detail. No page
errors. Pre-existing, not from this pass, present in the "before" log too: a Rules-of-Hooks order
warning on every signed-in route, a forwardRef warning in JobsPanel, and a missing list key in
ContactMessagesSection.

**Grain, 09-30 (owner: "fairly coarse … like a leather, not too coarse").** The fine paper tooth
measured a luminance sd of 0.95 — flat. Six candidates were rendered and measured side by side
(`draft-screenshots/grain/bench-2.png`); chosen: pebble frequency 0.28 × 2 octaves (0.14 was
blotchy), with a white SHEEN layer for the lit side of each pebble — the contrast floor caps the
shadow, not the light. sd 0.95 → 3.6; darkest substrate pixel `#E6DED2`, still above
`CANVAS_SHADE`, and the floor is now a test computed from the component's constants (`0d67462`).

---

# Steps 3–6 — the full design (2026-09-30)

⭐ **Unblocked:** fit ranking landed and is live. Everything below is designed against code that
exists — each backing call is named with its route — and NOTHING below is built.

**Rules this design inherits, restated because each is load-bearing:**

1. ⛔ **No gesture, key or click on the deck submits an application.** Draft queues for REVIEW;
   `POST /api/apply/approve` is the only release, and it takes a human request.
2. ⛔ **Never pad the deck.** Fewer honest cards beats ten with filler.
3. ⛔ **No ATS number anywhere.** The band, on demand; position carries the rest (G5).
4. ⛔ **Not enough signal is not a low grade.** It is drawn as the absence of one (step 2b).
5. ⛔ **Every colour is a token; every motion honours `prefers-reduced-motion`; no animation gates
   input.**

---

## Step 3 — the deck

### 3.0 The four product questions (`PRODUCT_MODEL.md` left them open)

⚠ **Proposed by the agent, 09-30 — owner to confirm.** The design is built so each answer is ONE
constant or ONE branch; none of them is structural.

| Question | Proposal | Why |
|---|---|---|
| **How many per day?** | **Up to 10** (`DECK_SIZE = 10`, server-side) | Ten decisions is one sitting. The number is a ceiling, not a target — see thin day |
| **Thin day?** | **Deal only Strong and Moderate.** Fewer than 10 → deal fewer; 0 → the honest empty state (§3.6) | Weak is a poor fit and *not established* is no judgement; dealing either as "today's pick" is padding. They stay reachable on the board |
| **Does an undrafted card return?** | **Yes, if it still ranks.** An UNDECIDED card is simply eligible again tomorrow; a DECIDED one (drafted, passed, saved) never re-deals | A one-time offer punishes a user for not opening the app on a Tuesday. Ranking already decides what is best; the deck should not add scarcity the data does not have |
| **Is the full board reachable?** | **Yes — as "All jobs", one level down,** fit-ranked as today | AF5, power users and the extension's capture flow all need it. It stops being the landing page, not a capability |

### 3.1 What a "draft" is, in data

The deck is **dealt once per user, per profile, per local day, and then frozen.** Re-ranking during
the day (a new crawl, a rescore) must not reshuffle cards the user has already seen — a card that
moves is a card the user cannot find again.

**Migration (next number) — `daily_drafts`:**

```sql
CREATE TABLE daily_drafts (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  INTEGER NOT NULL REFERENCES domain_profiles(id) ON DELETE CASCADE,
  draft_date  TEXT    NOT NULL,              -- the user's LOCAL date, YYYY-MM-DD, sent by the client
  position    INTEGER NOT NULL,              -- 0-based, the deal order
  job_id      TEXT    NOT NULL,
  band        TEXT    NOT NULL,              -- the band AT DEAL TIME (strong | moderate)
  basis_hash  TEXT,                          -- ats_only_reports.basis_hash that produced the band
  dealt_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, profile_id, draft_date, position),
  UNIQUE (user_id, profile_id, draft_date, job_id)
);
```

**Decisions are NOT stored here.** They already have homes, and a second copy is how two tables come
to disagree: *drafted* = an `apply_run_jobs` row for the job; *passed* = `user_jobs.disliked = 1`;
*saved* = `user_jobs.starred = 1`. The deck READS them to show state and to exclude decided jobs from
tomorrow's deal.

**The deal**, run on the first `GET` of the day and never again for that key:

1. The profile's board in the **default order** (`FIT_KEYS`, `jobCursor.js`) — the same query, not a
   copy of it — excluding decided jobs (the default board already excludes `disliked`; add
   *drafted* and *starred*).
2. Keep rows whose band is Strong or Moderate. ⛔ The band comes from the stored report
   (`ats_only_reports`, `basis_hash` current), never recomputed inline — one scoring definition.
3. Take the first `DECK_SIZE`. Insert them in one transaction. A concurrent second `GET` loses the
   insert on the primary key and reads the winner's deal.

⚠ **The local date is the client's.** The server validates it is within ±1 day of its own UTC date
(a clock-skew guard, not a timezone model) and refuses anything else. A user who flies east gets a
new deck at their new midnight; that is correct.

### 3.2 The API (contract v1.2.0, additive — generated and guarded like the rest)

```
GET  /api/draft/today?profileId=&date=YYYY-MM-DD
     -> { date, profileId, size, cards: [DeckCard], thin: boolean, reason?: "thin" | "empty" }
     DeckCard = the board's job shape (mapJobRow) + { position, band, decision }
     decision = null | "drafted" | "passed" | "saved"      -- read live from the three homes
```

**No decision endpoint is added.** The deck uses the existing calls, which are already idempotent
and already safe:

| Action | Call | Why this one |
|---|---|---|
| **Draft** | `POST /api/apply/runs` `{ jobIds:[id], mode:"auto", tool }` — ⛔ **`approvalMode` omitted** | The server's default is `"required"`: the job is previewed and held `awaiting_approval`. It physically cannot submit (SWIPE_FEED_DESIGN §Finding 1) |
| **Pass** | `PATCH /api/jobs/interact` `{ jobId, disliked:true }` | Explicit value, not the toggle — a retried pass cannot un-pass |
| **Save** | `PATCH /api/jobs/interact` `{ jobId, starred:true }` | Same |
| **Undo draft** | `POST /api/apply/run-jobs/:id/abort` | Claims only from PENDING; 409 `not_abortable` says what it reached |
| **Undo pass/save** | `interact` with `false` | Cheap, no expiry |

⛔ **Hardening, required before the deck ships** (SWIPE_FEED_DESIGN's "real gap"): `POST
/api/apply/runs` still ACCEPTS `approvalMode:"auto"` from any client. The deck sends a surface marker
(`surface:"deck"`), and the route refuses `approvalMode` from that surface exactly as it refuses
`"approved"` today. The trigger that cannot review is not permitted to ask for no review. A test
posts the forbidden combination and expects the refusal.

Generation is **deferred to approval** (AL2, verified 09-30 in `routes/apply.js` — the tailored
résumé and cover letter are written when the user approves), so a Draft costs nothing — ⚠ unless the
profile has opted into `generate_at_queue` (default off; the deck should say so on the card when it
is on); the §2.6 volume ceiling in SWIPE_FEED_DESIGN still applies to
runs.

### 3.3 The card — one job, full viewport

The card IS the page (the decision: "listings → cards is dropped"). Top to bottom:

```
┌──────────────────────────────────────────────────────────────┐
│  ◢ 4 / 10                                   today · profile ▾ │  ← the slash as progress (§4)
│                                                              │
│  [logo]  Stripe                                              │
│  Senior Backend Engineer, Payments                           │  ← display serif, the decision
│  Boston, MA · Remote-friendly · $120k–$160k · 2d             │
│                                                              │
│  Why it's here   Go · PostgreSQL · Kubernetes · +4 you show  │  ← matched skills, from the report
│  What's missing  Kafka · gRPC                                │  ← honest, never "you need"
│                                                              │
│  ─────────────── scroll for the posting, the company ──────  │
│                                                              │
│   [ Pass  X ]        [ Save  S ]        [ Draft  D ]         │  ← thumb zone on phones
└──────────────────────────────────────────────────────────────┘
```

- **Earns its place** (SWIPE_FEED_DESIGN §2.2, kept): title, company + logo, location + work model,
  salary (omitted when null, never one bound), freshness, the apply platform (derived from the apply
  URL, never `sourcePlatform`).
- ⭐ **New: "Why it's here"** — the report's matched skills, capped at 3 + a count. Position says
  *how good*; this says *why*, which position cannot. It is evidence the user can check against
  their own résumé, and it makes a bad pick visibly bad instead of mysteriously ranked.
- **The band label is on demand**, not on the card: in the detail header and on hover/long-press of
  the progress mark. ⛔ Never a number.
- **Scrolling down is detail** — the posting, the matched/missing sections (the ATS panel's own
  component, reused), the company. No panel opens over the card: the JD, ATS and PDF panels stop
  competing for one z-tier because there is no tier.

### 3.4 Actions, keys and gestures — one vocabulary on every client

| Intent | Button | Key | Web touch / Android gesture |
|---|---|---|---|
| **Draft** (queue for review) | "Draft" | `D` or `→` | swipe right |
| **Pass** (saved; never returns) | "Pass" | `X` or `←` | swipe left |
| **Save** for later | "Save" | `S` | ⛔ **button only** — no gesture |
| Detail | tap / scroll | `Enter` | tap |
| Next / previous card | — | `J` / `K` | vertical swipe between cards is NOT used (it fights scroll-for-detail) |
| Undo last | toast action | `U` | toast |
| Legend | "?" | `?` | — |

⛔ **Changes to Android (2c revised, see ANDROID.md):** right is **Draft on the server**, not the
local `Queue` it is today (the Android right-swipe records local intent only — it reaches no server
and is lost on restart; see finding below). The **diagonal Star and the hard-right "Queue first" are
removed**: two of the most accident-prone motions on a phone were bound to two different intents, and
"Queue first" has no server meaning. Save becomes a button, as on the web.

**Undo is a toast, not a gate.** Five seconds, then it folds into the queue indicator's own undo.
It is a convenience: the gate is the approval step, and nothing expires into a submission.

### 3.5 Components — what the deck replaces, and what it keeps

| Today | In the deck |
|---|---|
| `JobsPanel` listing + `JobCard` grid | `DeckView` (new) — one `DeckCard` at a time. The board survives as `/app/jobs` ("All jobs") unchanged |
| `JobDetailPanel` (slide-over) | The card's lower half — no overlay |
| `AtsReportPanel` (peer drawer) | Its body (`ATSPanel`) rendered inline in detail; the drawer stays for the board |
| `usePanelHost` / `useBoardLock` / panel geometry | Not used by the deck (they keep serving the board) |
| **Kept, unchanged:** `StampLogo`, `DockPortal`, the z-scale, `PanelControls`, glass, `bandStyle.js`, `colorTokens.js` | — |

**Routes:** `/app` lands on `/app/today` (the deck); `/app/jobs` is "All jobs". The top bar gains
"Today" before "Jobs". Deep links to a job (`?job=`) keep opening the board's detail, not the deck.

### 3.6 States — every one designed, because an undesigned state ships as a blank

| State | What the user sees |
|---|---|
| Dealing (first open of the day) | The deal-in (§4). Skeleton only if the `GET` exceeds 300 ms |
| Mid-deck | Card *n* of *size*; the slash fills |
| ⭐ **Thin day** (`size < 10`) | "Four good ones today." — the count stated plainly, as a fact about the day, not an apology. No filler |
| ⭐ **Empty day** (`size = 0`) | "Nothing strong enough today." + why (the profile's board is small, or everything good is decided) + two exits: **All jobs** and **Improve your profile** (the resume-depth note when it applies) |
| Deck finished | "That's today's draft." The queue count + **Review your drafts** (the Auto Apply pending tab — the product's promise, per ANDROID 2d). ⛔ Not "come back tomorrow for more" — no engagement bait |
| A drafted job the server refused (409 prerequisite, 429 cap, duplicate) | The card stays, marked with the server's own sentence and its fix (the 409 names what is missing). ⛔ Never a success toast for a refused call (the Android "Application sent" precedent) |
| Offline / 5xx | The card stays undecided; the action retries idempotently. Undecided is always the safe state |
| Profile has no base résumé | The deck does not deal; the empty state points to the upload (Draft would 409 on every card) |

### 3.7 Accessibility

- The card is a `<article>` with the title as its heading; the three actions are real buttons with
  their keys in `aria-keyshortcuts`.
- After an action, focus moves to the NEXT card's heading, and a polite live region says what
  happened ("Drafted. 5 of 10."). Undo is reachable by keyboard from the live message.
- Keys never fire while focus is in a text field or a menu (the dock precedent).
- Touch targets ≥ 44 px; the action bar sits in the bottom 25% on phones (thumb reach).

---

## Step 4 — transitions

**framer-motion** (already a dependency, v11), not the View Transitions API: `layoutId` gives the
shared element across React mounts in every browser the audience uses, and `MotionConfig
reducedMotion="user"` applies the OS setting to every animation from ONE place — so a new transition
cannot forget it.

| Transition | Motion | Duration | Reduced motion |
|---|---|---|---|
| **Deal-in** (first open of the day) | cards fan in from a stack, staggered 40 ms, the first lands in front | ≤ 600 ms total | the first card simply appears |
| **Draft** | the card lifts and flies to the queue indicator; the indicator's count ticks | 280 ms | crossfade to the next card, count updates |
| **Pass** | slides left and fades — direction encodes finality | 220 ms | crossfade |
| **Save** | shrinks toward the Save indicator | 240 ms | crossfade |
| ⭐ **Title → detail heading** | `layoutId` on the title; scrolling to detail pins it as the heading | continuous | static |
| **The slash as progress** | the `/` of the mark fills along its diagonal, *drafted ÷ size* — passed cards do not fill it | 200 ms per step | the fill steps without easing |

⛔ **No transition gates input.** Each action commits its call and advances the index IMMEDIATELY;
the animation plays on a detached copy of the card. Pressing `D` twice fast drafts two cards. A test
fires two actions inside one animation frame and asserts two calls.

⛔ A test per transition asserts the reduced-motion branch renders the end state with no animation
(the chevron test is the precedent).

---

## Step 5 — mobile

### 5.1 Mobile web (the deck is phone-first; the audience skews mobile)

- **One breakpoint model for the deck**, not per component: `compact < 640 ≤ regular < 1100 ≤ wide`.
  Compact: the card is the viewport, action bar pinned to the bottom (safe-area inset), detail
  scrolls under a collapsing header. Regular: the card is a centred sheet, max 720 px. Wide: the card
  plus a right rail for detail on demand (never both collapsed and expanded content).
- **Swipe on the web too** (pointer events, horizontal only, with the same 80 px commit threshold
  as Android's `SOFT_OFFSET`) — the same meanings, so a user switching devices keeps one habit.
- ⚠ The current client has 13 media queries in total. The deck is a new surface; it does not
  retrofit the board's layout.

### 5.2 Android (2c and 2d revised — see `draft-android/ANDROID.md`)

- **2c becomes the deck,** fed by `GET /api/draft/today`, not the paged board: the same frozen deal
  as the web, so a card drafted on the phone is decided on the laptop.
- Gestures per §3.4. ⛔ Right = server Draft (`POST /api/apply/runs`, `approvalMode` omitted, surface
  `deck`); the local-only `Queue` goes.
- **2d (review) is unchanged in model** — it is the product's promise. The deck's finished state
  links to it.

⚠ **Finding (09-30), for the Android queue:** `JobsViewModel` records a right swipe (`Queue`,
`QueuePriority`) in an in-memory list and **never calls the server**. The header says so ("Queue and
QueuePriority record local intent"), but the user-facing badge says "Queued for review" — and
nothing is queued anywhere a review screen could find, and it is gone on restart. Until 2c lands the
badge should say what is true.

---

## Step 6 — dark mode

**Mechanism.** `colorTokens.js` gains a second object, `C_DARK`, with the SAME keys; `installColorVars`
publishes both, under `:root` and `:root[data-theme="dark"]` (and `prefers-color-scheme: dark` when
the user has not chosen). Components read `var(--c-*)` or `C.*` exactly as now — ⭐ step 2's token
work is what makes this a data change and not a hunt.

⛔ **The key sets must be identical** — a test asserts `Object.keys(C) ≡ Object.keys(C_DARK)`, so a
token added to one theme cannot be missing from the other.

**The substrate.** Not black: a deep warm charcoal leather, `CANVAS ≈ #1C1815`, with the SAME pebble
generator — the grain in near-black and the sheen in a warm grey at low opacity. ⛔ The floor inverts:
in dark mode the SHEEN is the dangerous layer (it lightens toward the text), so the test's bound is
computed on the light side for `C_DARK` — the lightest substrate pixel must stay darker than
`CANVAS_SHADE_DARK`, the worst case every dark pair is measured against.

**The orange.** `#FD4600` on charcoal is ~5:1 — usable as TEXT in dark mode, where on cream it is
fill-only. `ACCENT_INK` in dark becomes the orange itself or a lighter `#FF6A2B`; `ON_ACCENT` stays
ink (black on orange ~4.3:1 fails for small text — so the dark CTA label uses `#1E1915` at bold 15 px+
or the button uses the darker orange fill). Decided by the contrast test, not by eye.

**Bands in dark.** Each `BAND_*` tone gets a dark counterpart that passes 4.5:1 on the dark glass, and
its quiet fill; Not enough signal keeps its identity (no fill, dashed, no hue) — the step 2b test
runs against both themes.

⛔ **`CONTRAST_PAIRS` runs once per theme.** Passing AA on cream says nothing about charcoal. The
pair list is shared; the values are per theme.

**Theme choice** is per user, stored with the dock settings (`/api/account` dock items), defaulting
to the OS. The logo (`StampLogo`) does not recolour — it is artwork (its PERMANENT exemption stands).

---

## Build sequence for steps 3–6 — each slice ships alone and is screenshotted before the next

| Slice | Content | Done when |
|---|---|---|
| **3a** | Migration `daily_drafts`; the deal (§3.1) as a service with tests: frozen per day, Strong/Moderate only, decided excluded, thin and empty days, concurrent deal, the ±1-day date guard | the deal is deterministic on a fixture board and a second GET returns the identical deck |
| **3b** | `GET /api/draft/today`; contract 1.2.0 generated; the `surface:"deck"` refusal on `/api/apply/runs` | contract drift test green; the forbidden `approvalMode` is refused by test |
| **3c** | `DeckView` + `DeckCard` (web), the three actions on the existing calls, keys, live region, states §3.6 | every state screenshotted at 390/1440 on stubbed `/api/*` |
| **3d** | `/app` → `/app/today`; "Today" in the top bar; "All jobs" | old deep links still open the board's detail |
| **4** | the transitions, `MotionConfig reducedMotion="user"`, the no-gating test | reduced-motion shots show end states |
| **5a / 5b** | mobile web breakpoints + web swipe; Android 2c on the deck | the same deal drafted on phone shows decided on web |
| **6** | `C_DARK`, the dark substrate, per-theme contrast | every pair passes in both themes; both themes screenshotted |

**Open, owner:** the four §3.0 proposals. Nothing in 3a–3b depends on the answers beyond
`DECK_SIZE` and the band filter, both one constant each.

---

## Steps 3–6 status — BUILT (2026-09-30, local, not pushed)

The owner confirmed the §3.0 proposals (09-30) and, looking at the board, said it felt "very
mundane … like something from 2012", the leather should be "C or D … crisp", and "the glossy effect
can be more apparent". In order:

| | Commit | What |
|---|---|---|
| Grain + glass | `3f448e7` | Bench C exactly; the floor token moved for it (`CANVAS_SHADE` → `#DFD6C9`) and every pair re-proved (`WARNING` darkened). `styles/glass.js`: a lit glass material — specular top edge, upper-left sheen, a body clearer at the bottom, rim and underside, a warm resting shadow. Found: the board sat on `theme.bg`, which is the GLASS token, so the listing was a 58% cream sheet over the leather |
| 3a | `be26aa7` | Migration 111 `daily_drafts`; the deal service; the board handler became `boardPageResponse` so the deal uses the board's own query |
| 3b | `4a139af` `9464bae` | `GET /api/draft/today`; contract 1.2.0; the deck surface may not send any `approvalMode`; frozen evidence ("why") per card |
| 3c/3d/4 | `be8833a` | `DeckView` — Today's draft; keys, web swipe, the stack, the stamps, the fly-outs, the slash; one `MotionConfig`; `/app` → Today |
| 5b | draft-android `f7fdc2c` | Android's Jobs tab is Today on the same deal; right is a server Draft; two gestures only |
| 6 | `6788a8e` | Dark mode — both palettes proved; the leather per theme with the floor inverted |

**Deviations from the design, recorded:** the theme preference is per DEVICE (local storage), not
stored with the account; Android keeps its earlier Material look (no leather/glass, no dark theme);
a deck transition test is a reducer test plus a reduced-motion screenshot, not a rendered-DOM test
(the client has no DOM test harness). Screenshots: `C:\Users\duggi\WebstormProjects\draft-screenshots\`
(`deck/`, `dark/`, `gloss/`, `grain/`, `android/`).

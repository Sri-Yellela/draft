# draft — UI redesign

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md`, which
documents what exists. Owner decisions recorded 2026-09-27.

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

⛔ **This depends on the board actually ranking by fit, and today it does NOT** — it ranks by
`discovered_at DESC`. CC1–CC5 bought reachability and correctness, and the ordering problem was
explicitly scoped out each time. **If position encodes fit, the ordering work becomes a hard
dependency of this design.** Name it before building.

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
  again
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

⛔ **Decide before step 3:** does position encode fit? If yes, **the ordering problem is a hard
dependency** and the board must rank by fit first. If no, the deck is chronological and the band is
shown some other way. That is the one decision this design cannot proceed without.

---

## Step 2 status — tokens and the paper substrate (2026-09-29, `1fd46dc` + `0b76191`, local, not pushed)

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

## Step 2b status — the signed-in app (2026-09-30, local, not pushed)

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

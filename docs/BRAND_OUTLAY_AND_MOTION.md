# Brand Outlay and Motion — design

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md`.
Extends `UI_REDESIGN.md`, which settled the palette, the deck and the token rules. This is the
**brand surface**, the **motion language**, and the **deck's real interaction**.

Owner direction, 2026-09-30.

---

## ⛔ The wrapper problem

**draft is becoming a wrapper over several products** — the board and auto-apply, the extension,
Resume Master's tools, the ATS scorer, the MCP connectors, and soon a recruiter side. Today the site
advertises **one** of them.

⛔ **The failure mode is a feature list.** A grid of six cards saying "ATS Scoring · Resume
Generation · Auto Apply" is what every SaaS homepage does and it tells a visitor nothing about which
one is for them.

⭐ **The organising idea: one verb, many surfaces.** Everything draft does is a step in one motion —
**find → fit → apply**. The products are not a catalogue, they are stations along that line.

```
FIND            FIT                      APPLY
the board       the ATS score            auto-apply
the daily draft the résumé you tailor    the extension
                grade-the-posting        the handoff
```

**Each tool is introduced where it belongs in that line, not in a grid.** A visitor scrolling the
landing page walks the line once, and the tools appear as they become relevant.

⚠ **The recruiter side is the same line, reversed** — find candidates → fit → reach out. That
symmetry is the brand's best asset and nothing currently expresses it.

---

## The tools, and what each is actually for

⛔ **Write these as what they do for a person, never as feature names.**

| Surface | The honest sentence |
|---|---|
| **The daily draft** | Ten jobs a day, picked for you. Not a search box |
| **The ATS score** | What a machine sees in your résumé before a human does. **Free, no account** |
| **Résumé tailoring** | One résumé, shaped for one posting — and ⛔ **it will not claim anything you did not** |
| **The extension** | Capture a job from any page. Fill the form you signed in to reach. **You submit** |
| **Auto-apply** | Queue it, review it, approve it. ⛔ Nothing is sent without you |
| **Grade-the-posting** ⭐ | For the other side. Free, and nobody else does it |
| **The connectors** | The scorer and parser as tools inside an assistant |

⛔ **The restraint IS the pitch.** *"Nothing is submitted until you approve it"* and *"it will not
claim anything you did not"* are differentiators, not disclaimers. Every competitor in this space
sells volume; **draft sells not-volume**, and the copy should be proud of that rather than
apologetic.

---

# The deck — the real interaction

⛔ **What ships today is not the deck.** One card, fully expanded, with the whole description. The
design was a deck and the implementation is a list of one.

## ✅ THE DECK — DECIDED 2026-09-30, after five interactive sketches

> **BUILT 2026-10-01 (queues 27–29), local.** The numbers below were the starting point; the fixed ones
> live in `client/src/lib/fanGeometry.js` with the constraint each sits on — horizontal reach **800**,
> vertical reach **1100** at zoom **0.86**. The flip was measured and moved to the compositor. The deck
> was found NOT to be dark by design (it is dark mode following the OS). WORKLOG SESSION LOG (7).

⛔ **"Card" means the panel in the product.** Not a playing card in the sense of a small rectangle —
but it DOES have a back, and the back matters. An earlier draft of this document got this wrong in
both directions.

### The model

```
LAYOUT      a fan. Full-size cards on a shallow arc, pulled back so the WHOLE dealt stack is
            in frame — nothing clips off the edges
FRONT CARD  face-up, square-on, dominant. Exactly the card that ships today: ~700×380, same
            content, same hierarchy. Nothing shrinks
THE REST    face-DOWN, falling away either side along the arc
SCROLL      pointer over the stack + scroll rotates through it. The page does not move
ARRIVING    a card reaching the front FLIPS face-up as it arrives
CLICK       ⭐ the front card EXPANDS IN PLACE. Same element, grown
PASS/DRAFT  it leaves; the fan closes up
```

### ⭐ Two orientations, one model

| | Pivot | Cards | Where |
|---|---|---|---|
| **Desktop** | off to the **right** | **horizontal** — content runs across | wide viewports |
| **Mobile + portrait tablet** | **below** | **vertical** — portrait cards, like E | narrow viewports |

⛔ **The pivot and the card orientation move together.** A right pivot gets horizontal cards; a
bottom pivot gets vertical ones. Mixing them is what made the early sketches unreadable.

⭐ **Why horizontal content survives rotation:** a 196px vertical card tilted 10° is hard to read; a
700px wide one at the same angle is fine. That single fact is why the desktop fan works at all, and
why the mobile fan has to turn the cards upright instead.

⚠ **The switch is WIDTH-driven, not device-driven.** A 700px card on an arc wants roughly 1100px of
viewport. Below that the sweep gets cramped and the vertical treatment is better — earlier than a
typical tablet breakpoint.

### ⭐ The card back — the detail that makes the fan work

A face-down card used to tell you nothing, which was the fatal flaw in every fan sketch. The fix:

- **the company's own logo**, blurred, in the accent orange, at low opacity, filling the back
- a fine diagonal weave in the same orange at ~5% opacity
- the `/` mark small in the top-left corner

⭐ **You are never rotating blind** — you recognise Figma's circles or Airbnb's loop through the blur
without reading a word. It is also the first use of orange at scale with no contrast problem, since
it is decorative fill rather than text.

⛔ **Logos, never letters or names.** An initial in a box is a placeholder; the real mark is what
makes it legible at a glance.

⚠ **Trademark question to answer deliberately, not discover.** Company logos are trademarked, and
the board already fetches them from a third party (Clearbit died; DuckDuckGo replaced it). Blurring
and tinting one orange is a derivative use. Probably fine; decide before it ships.

### Geometry — the four parameters

The sketch exposed these as sliders because the look is found, not described. Starting point:

```
zoom     ~0.72   how far back you are standing
spread   ~7deg   between adjacent cards
reach    ~900px  how far away the pivot sits
visible  ~4      cards either side before opacity reaches zero
```

⛔ **`reach` is the parameter that decides whether the arc reads as a circle.** At ~550 it is a
pronounced curve; at 1400 it is almost a straight overlap. It cannot be split the difference — find
the number, then fix it.

### ⛔ Layering — named tokens, no literals

```
--z-bg       the paper substrate
--z-fan      the fan. Above the paper, BELOW every piece of content
--z-content  header, the face-up card, the ATS report
--z-nav      the top bar and the action row
```

**The fan passes behind the nav and behind the action buttons.** Only the face-up card rises into
the content layer. ⛔ Enforced by the token, not by a number someone can nudge — the z-scale was
collapsed into one named file after literals were found scattered across surfaces.

### ⭐ Expansion is the detail

No navigation, no modal, no panel. The card grows; the posting, the full ATS report and company
context live inside it.

⭐ **There is no separate detail view to route to**, which removes a layer of routing AND makes the
shared-element transition free: the element never changes identity.

⚠ **The expanded card is tall.** The Pass / Save / Draft row must stay reachable without scrolling
back — it sticks rather than scrolling away with the content.

### Motion

| | |
|---|---|
| **The deal** | On first view the stack is dealt, cards arriving and settling. ⛔ **Once per day, not per navigation**, or the signal that today's draft is new means nothing |
| **Draft** | The card lifts and flies toward the Drafted counter. You see where it went and the count move |
| **Pass** | It drops away behind the fan. Direction encodes finality |
| **The flip** | A card reaching the front turns face-up as it arrives |
| **End of the stack** | ⛔ A **moment**, not an empty state. A board is infinite and you never finish it; a stack has a bottom, and that is the product's only natural ending |

⛔ **No transition may gate input.** A card mid-flight must not swallow the next decision.
⛔ **`prefers-reduced-motion` on every one.** The chevron animation already has a test; that is the
standard.

### ⚠ Three things to resolve in the build

1. **Scroll capture is an accessibility cost.** The page must still scroll when the pointer leaves
   the stack, and the keyboard must do everything scroll does — otherwise the deck is unreachable
   without a mouse.
2. **The flip is a frame-budget question on mobile.** A `rotateY` on a 300×400 element with a
   blurred child is cheap on desktop and not always cheap on a mid-range Android. **Measure on a
   real device**; the deck is the product's core surface.
3. **Edge clipping must read as deliberate.** Cards leave the viewport at the extremes of the arc.
   Either the fade does that work or the counter does; it cannot look accidental.

### ⚠ One thing to check against the live build first

The shipped deck is **dark** — dark textured ground, light text — while `UI_REDESIGN.md` and UI step
2 settled on **cream paper with dark ink**, and step 2b replaced 549 dark-theme colours in the
signed-in app. ⛔ **Establish whether the deck is deliberately dark or predates 2b before any motion
work assumes a palette.**


## ⛔ SUPERSEDED — the stack-not-fan draft of 2026-09-30

Everything from here to the next `#` heading is **wrong and kept only so the reasoning is not
rebuilt**. It denied backs and a fan outright; five interactive sketches then showed that a fan
works *provided* the backs carry the company's own blurred logo, and that full-size cards pulled
back read as a dealt stack. The decided model is the section above.

⛔ **"Card" here means the panel in the product** — the rounded surface carrying company, title,
matched and missing chips. **Not a playing card.** There are no backs, no flipping, no fan, and no
mark printed on a reverse side. An earlier draft of this document assumed playing cards and was
wrong throughout.

```
IDLE        a STACK. The current card in front; the ones behind show as offset edges
SCROLL      the stack advances — the front card leaves, the next rises into place
HOVER       the card under the pointer lifts slightly and tilts toward the pointer
CLICK       ⭐ IT EXPANDS IN PLACE. The SAME card grows to carry the full posting
PASS/DRAFT  it leaves. The stack closes up
```

⭐ **The single most important correction: click-to-expand, in place.** Today the card ends with
*"Scroll for the posting ↓"* and the full description sits below it as a separate block. **The card
itself should expand** — same element, growing — rather than handing off to a region underneath.

⛔ That also means there is no separate detail *view* to navigate to. The expansion IS the detail,
which removes a whole layer of routing and makes the shared-element transition trivial: the element
never changes identity.

## Ideas worth building

### ⭐ The deal, once a day

On first view the stack is **dealt** — cards arriving and settling, fast. **Once per day**, not on
every navigation. Returning mid-afternoon shows the stack as you left it.

⛔ The deal is the signal that *today's draft is new*. If it plays every time it means nothing.

### The stack thins as the day empties

Ten cards show several offset edges behind the front one. Three cards show one. **The depth of the
stack is the progress indicator** — alongside the `1/10` already in the header, not instead of it.

### ⭐ Depth of field

Cards behind the front one are **dimmed and slightly blurred**. The eye goes where the product wants
it, and it makes a flat stack read as physical.

⛔ `prefers-reduced-motion` drops this to a static offset — it is motion-adjacent even though
nothing moves.

### The expansion is the detail

No navigation, no modal, no panel. The card grows; the posting, the full ATS report and the company
context live inside it. Collapsing returns it to the stack.

⚠ **The expanded card is tall.** Decide what happens to the Pass / Save / Draft row — it should
stay reachable without scrolling back, which probably means it sticks to the bottom of the expanded
card rather than scrolling away with the content.

### Drafting and passing look different in kind

**Draft:** the card lifts and flies toward the `Drafted 0` counter. You see where it went and the
count move.
**Pass:** the card drops away and *behind* the stack. Direction encodes finality.

⛔ Neither may gate input. If a card is mid-flight and the user acts again, the next decision
registers.

### The end of the stack is a moment

⛔ **Not an empty state.** A board is infinite and you never finish it; a stack has a bottom, and
reaching it is the product's only natural ending. What you drafted, what is waiting for review, and
that is it until tomorrow.

### The card is the same object everywhere

The same surface is the saved job, the queued application, the review item. ⭐ **One object moving
between states**, not four components that happen to look alike.

### ⚠ One thing to check against the live build

The shipped deck is **dark** — dark textured ground, light text. `UI_REDESIGN.md` and UI step 2
settled on **cream paper with dark ink**, and step 2b replaced 549 dark-theme colours in the
signed-in app. ⛔ **Establish whether the deck is deliberately dark or predates 2b**, before any
motion work assumes a palette.

---

# Login and signup

⛔ **It is the first impression and it is currently a form.**

## The direction

**Motion that is computational, not decorative.** The owner's reference images were dark, high
contrast, one thing per screen. ⛔ The palette is now **cream paper, dark ink, one orange** — so the
motion has to carry what the dark gradient used to.

### Ideas

**⭐ The deal, as the sign-in background.** Cards dealing slowly behind the form — the product's own
motion, not a stock animation. Someone signing in sees what the product does before they are in it.

**⭐ A live ATS score as the signup hook.** Not a hero image: *paste a job description, get a real
score, now sign up to keep it.* It is **free, deterministic, zero model calls** and it works for an
anonymous visitor. **Value first, account second** — the free tier as the funnel, which is already
the recorded strategy.

**Type that moves once.** The serif display heading sets, letter by letter, on first paint only.
Restraint is the whole point — one gesture, then stillness.

**Paper that reacts.** The grain substrate shifts almost imperceptibly with pointer position. Not
parallax — a suggestion that the surface is physical.

**The slash as the progress indicator.** Stepped signup, and the `/` fills as you advance. ⭐ Brand
as instrumentation, which is the rule for every transition here.

⛔ **None of it may delay the form.** A sign-in page that makes someone wait for an animation is a
worse sign-in page. Motion is behind, around and after — never in front.

---

# Navigation

⛔ **Current transitions are mundane because they are decoration.** The rule: **every transition
answers "where did that go?"**

| | |
|---|---|
| ⭐ **Shared-element between every surface** | A job's title on a card becomes the heading in detail, becomes the line in the queue. Same element, no fade. The View Transitions API, natively |
| **Tabs slide, they do not cut** | Direction tells you where you are in the order |
| **The queue indicator is a destination** | Things fly to it. Clicking it flies you there |
| **Back is the forward transition reversed** | Exactly, not a generic slide |
| **The mark reflects state** | The `/` fills with the day's progress, everywhere, always visible |

⛔ **`prefers-reduced-motion` on every one.** The chevron animation already respects it and there is
a test — that is the standard.

⛔ **Budget them.** A transition that costs more than ~200ms of perceived delay is a cost, not a
feature. Measure on a phone, not a desktop.

---

## ⛔ What this does NOT change

- **The palette, the tokens, the contrast work.** All 44 declared pairs pass AA; the logo orange is
  **fill-only at 2.96:1** with `#A33200` for text. ⛔ Motion must not reintroduce a colour outside
  the token file — the guard fails on it
- **Band, never number.** "58" beside "Strong match" was the defect and the number is gone
- ⛔ **"Not enough signal" stays visually distinct from "Weak"** — a dashed outline, no fill. It is a
  correctness state, not a low score
- **No gesture or keystroke submits.** Draft queues; approval is separate and deliberate
- **Keyboard stays an accelerator** with visible buttons. Mobile has no keyboard and the gestures
  must mean the same things

---

## Sequence

1. **The deck's real interaction** — the fan, the flip, click-to-expand. ⭐ The biggest gap between
   design and implementation, and the product's core surface
2. **The deal and the end-of-deck moment** — small, and they give the day a shape
3. **Shared-element transitions** — highest perceived-quality return per unit of work
4. **Login and signup**, with the free ATS score as the hook
5. **The landing page as find → fit → apply**, with the tools on the line
6. **The recruiter side as the same line reversed** — ⛔ needs the recruiter layer to exist

⚠ **Verify by screenshot and by video at every breakpoint, in both motion settings.** The current UI
had **13 media queries in the entire client** and the audience skews mobile. In one session four
separate things were green and wrong, and the only thing that disagreed was looking at the output.

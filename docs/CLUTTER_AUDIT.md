# D145 · Step 1 — the clutter audit (read-only)

**Measured 2026-11-03 (session 44k)** in a real Chrome, at **1280 × 800** and **390 × 844**, against a LOCAL draft at `14c9cf4`.
That draft ran on a copy of the local database (board as of 10-31, 746 matches for this account) with the synthetic
reviewer account (`services/reviewerDemo.js`, "Alex Rivera"). It had 12 sample applications (8 waiting in Draft House,
4 sent) and 6 synthetic rows in The Table. **Nothing on production was read or changed.** No screen was changed: this
step is read-only, as D145 says.

- **Re-run:** `scripts/d145ClutterAudit.mjs` (the header says how to boot and seed). Numbers: `docs/clutter-shots/audit.json`.
  Shots: `docs/clutter-shots/<screen>-<width>.jpg`, the first screenful as a person lands on it.
- **Words** = visible words, nothing expanded beyond what the row says it opens. *Above the fold* = the first screenful
  without scrolling; *page* = everything rendered on the page, scrolled or not. **Draft's words only:** an employer's
  posting text, a résumé's text and what a person typed are left out (the raw total, with them, is in `audit.json`).
  ⚠ The board's and the deck's counts still include the job titles and company names on the cards.
- **Actions** = buttons, links, tabs and fields a person can press or fill.
- **Features** = the distinct things the product does that the screen shows (match, sponsorship, freshness, pay, ATS
  score, drafts, auto-apply, tracking, inbox, referrals, Atlas / map, Learn / readiness, filters, extension, plans,
  profiles / saved answers). They're read from the screen's own words. The top bar is the same on every screen, so it is
  left out of this count.
- **Ranked by words × features** (the larger page count of the two widths × the features shown).

---

## 1 · The ranking

| # | Screen | Words 1280 (fold / page) | Words 390 (fold / page) | Actions 1280 (fold / page) | Actions 390 (fold / page) | Features | Words × features |
|---|---|---|---|---|---|---|---|
| 1 | Account | 105 / 1,990 ⚠ | 90 / 1,998 ⚠ | 9 / 188 | 8 / 189 | 7 | 13,986 |
| 2 | Full House — a posting opened | 286 / 807 | 229 / 970 | 45 / 194 | 34 / 345 | 9 | 8,730 |
| 3 | Full House (the board) | 206 / 727 | 142 / 883 | 34 / 182 | 23 / 333 | 8 | 7,064 |
| 4 | Profile | 52 / 834 | 52 / 834 | 13 / 81 | 13 / 81 | 8 | 6,672 |
| 5 | Draft House → Settings | 263 / 401 | 268 / 401 | 34 / 39 | 35 / 39 | 9 | 3,609 |
| 6 | The job page (public, `/jobs/…`) | 209 / 687 | 209 / 687 | 4 / 4 | 4 / 4 | 5 | 3,435 |
| 7 | Learn (the circle) | 228 / 699 | 119 / 699 | 62 / 142 | 17 / 142 | 4 | 2,796 |
| 8 | Atlas home (Your map's tree is on it) | 249 / 746 | 143 / 746 | 27 / 187 | 9 / 187 | 3 | 2,238 |
| 9 | Learn — a piece opened | 191 / 549 | 119 / 549 | 25 / 41 | 23 / 41 | 4 | 2,196 |
| 10 | Atlas — Your map, *Your skills* pressed | 255 / 671 | 143 / 671 | 28 / 187 | 9 / 187 | 3 | 2,013 |
| 11 | Landing (signed out) | 107 / 265 | 52 / 257 | 20 / 30 | 11 / 25 | 6 | 1,590 |
| 12 | Daily Deck — the card's report opened | 144 / 152 | 95 / 161 | 18 / 24 | 18 / 25 | 7 | 1,127 |
| 13 | Daily Deck | 141 / 150 | 86 / 152 | 17 / 23 | 17 / 24 | 7 | 1,064 |
| 14 | Trial — the tour's first step (on the deck) | 156 / 163 | 152 / 166 | 21 / 23 | 22 / 24 | 6 | 996 |
| 15 | The Table — a row opened | 139 / 173 | 90 / 179 | 44 / 46 | 31 / 52 | 4 | 716 |
| 16 | Trial — choose a sample | 91 / 91 | 84 / 84 | 9 / 9 | 4 / 4 | 5 | 455 |
| 17 | The Table | 127 / 141 | 88 / 147 | 39 / 40 | 33 / 46 | 3 | 441 |
| 18 | Draft House — an application opened | 78 / 124 | 74 / 124 | 31 / 35 | 27 / 35 | 3 | 372 |
| 19 | Trial — `/try` (signed out) | 63 / 63 | 55 / 55 | 9 / 9 | 4 / 4 | 4 | 252 |
| 20 | The Table — Inbox | 80 / 80 | 70 / 80 | 25 / 25 | 20 / 25 | 3 | 240 |
| 21 | Draft House | 69 / 69 | 69 / 69 | 26 / 26 | 26 / 26 | 3 | 207 |
| 22 | Atlas — the readiness check | 127 / 127 | 127 / 127 | 9 / 9 | 9 / 9 | 1 | 127 |

⚠ **Account** loads its sections late: one run read 1,648 words and the next 1,990, so treat it as ≈ 1,650–2,000.
⚠ **The job page** read the same 209 words above the fold at both widths in the final run (an earlier run read 114 at
390). It's the one number here I'd re-check before setting a budget from it.
No screen scrolls sideways at either width (`overflowX` = 0 everywhere).

**What the ranking says, in one line each:**
- **The pages people read to decide are the busy ones:** the posting panel (290 words and 45 actions on the first
  screenful, 9 features), the board (34 actions above the fold, 182 on the page), Draft House → Settings (263 words in
  one sheet).
- **The pages people *act* on are short but crowded with controls:** The Table has **39 actions above the fold for 127
  words** (7 sub-tabs, 4 layouts, 3 export / import buttons, 8 status counts). Draft House has 26 actions for 69 words.
- **Account and Profile are long forms:** about 2,000 and 834 words, 188 and 81 actions. They rank high but are reference
  pages. A budget there is about grouping, not cutting.
- **The Daily Deck is closest to the D145 rule already:** 141 words, Pass · Save · Draft. But 7 features show on one card
  (match, sponsorship, freshness, pay, ATS score, drafts, the order toggle), and the card's report adds 3 more lines.

---

## 2 · Per screen — features, actions, and the terms a person can read

*Terms come from the detector (`TERMS` in the script), and I checked each hit by its context. Hits that were really an
employer's or a résumé's words were dropped (e.g. "API" in a job title, "caching" in a résumé bullet, "Node.js" as a
skill). **"Seen"** lines are terms I read off the screenshots that the detector has no pattern for.*

### Full House — a posting opened · `board-posting-*.jpg`
- **Features (9):** match / fit, eligibility / sponsorship, freshness / ghost, pay, ATS score, drafts, tracking, filters, extension.
- **Above the fold (1280):** the panel's five icon buttons (✕ ★ /d 📄 ✉, labelled only by icon) and *I submitted it*,
  the **41 / ATS** box, four facts (experience · workstyle · salary · posted), *Requirements*, *History*, *Hiring?*,
  *In short*, *Sponsorship* with its sources and a legal notice. All of it comes before the posting itself.
- **Terms:** **ATS** ×3 · **signals** (*"ranked from signals, not a probability"*). **Seen:** *LCAs*, *FY2025*, *OFLC*,
  *DSO*, *U.S. persons only*, *382d ago*, the **/d** mark as a button with a count.

### Full House (the board) · `board-*.jpg`
- **Features (8):** match, freshness, pay, drafts, tracking, filters, extension, ATS score.
- **Above the fold:** the headline sentence (*"discovering all roles at all companies …"*; each word is a filter), the
  view counts **ALL 746 · ★ 0 · /d 0 · + 0** (symbols, no words), *Sort: For you*, the extension prompt, page numbers
  3–18, and "Best bet" rows. **34 actions above the fold at 1280; 333 on the page at 390.**
- **Terms:** **ATS** ×2 · **signals** ×1. **Seen:** */d* as a view name, *+* for imported.

### Draft House → Settings · `auto-settings-*.jpg`
- **Features (9):** sponsorship, freshness, drafts, auto-apply, tracking, inbox / email, filters, extension, saved answers.
- **One sheet holds:** the daily limit, *Last 24 h: Previews 12 of 40 · Approvals 0 of 30 · Submitted 4 of 25* (three
  internal limits), run times and time zone, *Picks arrive by*, Pause, *Show me the form before sending*, *Start from my
  board filters*, sponsorship-only, a per-company limit …
- **Terms:** **picks** ×2 · **run** ×3 (*"Each run takes the jobs posted since the last"*). **Seen:** *Previews*, *Approvals*.

### Draft House · `draft-house-*.jpg` and an application opened · `draft-house-branch-*.jpg`
- **Features (3):** drafts, auto-apply, tracking.
- **Above the fold:** the mode switch *Ask me first · Apply for me*, Pause, Settings, 5 filters, search, − / +, **the
  applications as letter tiles (I J T Q L R S O)**: a company's first letter is the only label until one is pressed.
  Also a **7-colour legend** (Needs you · Ready for your review · Picked · Working on it · Sent · Replied · Stopped).
  The left two-thirds is empty until something is chosen.
- **Terms (opened):** **Run** (*Run it again*). **Seen:** *What happened · 1 attempt, stopped*, *Full page*.

### The Table · `table-*.jpg`, a row · `table-row-*.jpg`, Inbox · `inbox-*.jpg`
- **Features:** tracking, inbox / email, filters (drafts too when a row is open).
- **Above the fold:** **7 sub-tabs** (History · Spreadsheet · Resumes · Saved Jobs · Pending Apply · Not applied · Inbox),
  Refresh, **Export Excel**, search, two date fields, **4 layouts** (List · By company · Board · Funnel), sort,
  **Export CSV · Import CSV**, **8 status counts**, *Waiting longest … Did they reply?*. That's 39 actions before the first
  row. Inbox adds 10 category filters.
- **Terms:** none from the list. **Seen:** *Pending Apply* and *Not applied* (two near-synonyms of "not sent"), three
  export controls, *Spreadsheet* as the name of a view.

### Atlas home · `atlas-*.jpg` and Your map with *Your skills* pressed · `your-map-*.jpg`
- **Features (3):** Atlas / map, Learn / readiness, tracking.
- **Above the fold:** *Next on your route to …*, *Where you're headed*, *Also reachable*, *Your route* (5 steps, each with
  a percentage), *Other fields you could move into*, *Apply now, while you learn*, *Progress*, the Atlas search, *The
  families*, *Recently published* (an alphabetical list: 5G, A-GPS, ACH and SEPA …).
- **Terms:** **ring** ×3 (*"Orange ring: rises toward senior"*), **branch** ×3 (*"Each family is a branch from you"*),
  **family / families** ×3, **seniority**. **Seen:** *Aim there*, *Also reachable*.

### Learn (the circle) · `learn-*.jpg` and a piece opened · `learn-piece-*.jpg`
- **Features (4):** Learn, Atlas, tracking, saved progress.
- **Above the fold:** a 4-line introduction, **4 tabs** (The circle · Learning path · LeetCode pattern atlas · Concept
  index), *0 finished · 0 started · 108 to go*, **5 guided routes + a "Make a route" field**, then the circle:
  **62 actions above the fold at 1280** (the numbered pieces).
- **Terms:** **gate(s)** ×2. **Seen:** *Part 1 · Part 1: Foundations* (the part named twice), *0 % · 0 of 3 opened ·
  0 of 3 explained · 0 of 1 extras*, *pieces*.

### Profile · `profile-*.jpg`
- **Features (8)** across 834 words: personal details, address *"for autofill"*, the base résumé, ATS suggestions,
  keywords, saved answers, voluntary self-ID, job-profile signals.
- **Terms (the most of any screen):** **ATS** ×9, **signals** ×6, **Held runs**, **scraped jobs**, **Pick**,
  **Keywords**, **normalised**. Examples: *"This base resume belongs only to the selected profile and drives profile …"*,
  *"Pick broadly useful ATS suggestions here. Enhancement unlocks …"*, *"Held runs offer to save the answers you write"*,
  *"ATS suggestions will appear here after enough scraped jobs …"*.

### Account · `account-*.jpg`
- **Features (7):** drafts, tracking, inbox / email, referrals, extension, plans, profiles.
- **Terms:** **model** ×3 (*"The model that rewrites your bullets …"*, with **Haiku** / **Sonnet** named), **JSON**
  (*"… as JSON"*), **provider** (*"if it signs in with a provider"*).

### Daily Deck · `deck-*.jpg`, the card's report · `deck-card-*.jpg`
- **Features (7):** match, sponsorship, freshness, pay, ATS score, drafts, filters.
- **Above the fold:** *Layout · Dealt / ATS match · ‹ 1 / 7 › · Drafted 0*, the card (company, place · workstyle · pay ·
  age, title, *Strong match · 3 of 6 skills · open the report*, *Open the posting ↓*), Pass · Save · Draft with
  keyboard keys.
- **Terms:** **ATS** (*ATS match*, the order toggle). **Seen:** *Dealt* (an order named after the card metaphor),
  *Layout* (a control whose purpose isn't stated), the X / S / D key hints.

### The trial · `try-*.jpg`, `try-samples-*.jpg`, `try-tour-*.jpg`
- `/try` and the sample choice are short (63 and 91 words). The tour's first step sits over the deck: **156 words above
  the fold at 390**, the tour caption *and* the full deck controls (*Layout · Dealt · ATS match · ‹ 6 / 10 › · Best
  match first · Drafted 0 of 2*), and a card with a 56 % ring, skills and *tap for the report*.
- **Terms:** **picks** (*"Pick a sample résumé"*, *"These jobs were picked …"*), **ATS**, **deck** (*"Watch the deck deal"*).

### The job page, Landing, readiness check
- **Job page:** 4 actions only (sign in · the original posting · *Draft this job*). Most of its 687 words are the posting.
- **Landing:** 107 words above the fold at 1280, 52 at 390; *"The same line runs the other way"* (for hiring) is the
  one figurative line.
- **Readiness check:** 127 words, 1 feature. **claim / Claimed** ×10 (*"A short check on a skill you claim"*), the word
  the whole page turns on.

---

## 3 · Across the product

**Feature names shown without plain words.** The top bar reads **Daily Deck · Full House · Draft House · The Table ·
Atlas**: five branded names, two set on two lines, and none paired with what it does (D145 rule 5). Inside them:
*Dealt*, */d*, *Spreadsheet*, *Pending Apply*, *Learning path* vs *The circle*, *Concept index*, *LeetCode pattern atlas*.

**Internal terms, by how many screens show them:**

| Term | Screens | Where |
|---|---|---|
| **ATS** (alone, as a label or a score box) | 6 | Deck order toggle, board, posting panel's 41 / ATS box, Profile ×9, trial tour |
| **picks / Pick** | 4 | `/try`, sample choice, Draft House → Settings, Profile |
| **run(s)** | 3 | Draft House → Settings ×3, an application (*Run it again*), Profile (*Held runs*) |
| **signals** | 3 | Board and posting (*"ranked from signals"*), Profile ×6 |
| **ring / branch / family** | 2 | Atlas home, Your map |
| **seniority** | 2 | Atlas home, Your map |
| **claim / Claimed** | 1 (×10) | Readiness check |
| **gate(s)** | 1 | Learn |
| **Held / scraped / normalised / Keywords** | 1 | Profile |
| **model / Haiku / Sonnet / JSON / provider** | 1 | Account |
| **LCA / FY2025 / OFLC / DSO** (seen) | 2 | Posting panel and deck card's sponsorship block |
| **Previews / Approvals** as limits (seen) | 1 | Draft House → Settings |

Not found on any screen: D-numbers, "liveness", "tier", "leaf", "payload", "lean", "BYOM", "KB". (Account's
*"up to 2 MB"* is the one size unit, in a file-upload hint.)

**Symbols standing in for words:** */d* (a view, a button and a count), *★ 0*, *+ 0*, the posting panel's five
icon-only buttons, Draft House's letter tiles, X / S / D key hints on the deck's buttons.

**Controls before content:** The Table (39 actions before the first row), Draft House (26, with the left two-thirds
empty), the board (34 above the fold at 1280), Learn (62 above the fold at 1280, mostly the circle's numbers).

---

## 4 · The feedback, tagged — ⏸ NOT DONE: production wasn't read

The testers' answers and *Feedback* / *Something broke?* notes are in **production's** database (the invites went out
11-01; the local copy is from 10-31 and holds only synthetic walks). The agent tried to read them read-only, through the
same `testersReport()` that draws Admin → Testers, and **the session's permission rules refused the production read.**
So this section has only what is already written down:

| Feedback (summarised, no names) | Points to | Already in |
|---|---|---|
| Wants fewer clicks to apply, and less text | The deck → Draft → Draft House path; the posting panel | D145's row |
| Wants fewer clicks to use it, and simpler formatting | Not stated (the app in general) | D145's row |

**To finish this section, either:** (a) allow the agent a read-only production query for this one read (`railway ssh`
on the draft service, `testersReport(db, { period: "invites" })`, output to the agent's terminal only, nothing written),
or (b) download **Admin → Testers → CSV** (no names) and put it **outside** the repository. The agent then tags every
answer that mentions text, clicks, confusion or complexity by the screen it points to and adds it here.

---

## 5 · Inputs for Step 2 (the rules), from these numbers

Proposals only. D145 Step 2 is the owner's and the chat assistant's to agree.

- **Word budgets, set against today:** the Daily Deck card (141 above the fold today) → **≤ 60**; the posting panel's
  first screenful (286) → **≤ 120**, posting text excluded; Draft House → Settings (263 in one sheet) → **≤ 120**, the
  rest behind *More settings*; Atlas home (249) → **≤ 120**; Learn's first screenful (228) → **≤ 100**.
- **Action budgets:** The Table's 39 actions before the first row → **≤ 12** (one view switch, search, the status
  counts); the board's 34 → **≤ 15**.
- **The banned-term list for `d145NoInternalTermsVisible`** starts from §3's table: ATS (alone), picks, run, signals,
  ring, branch, family, seniority, claim, gate, held, scraped, normalised, model names, JSON, provider,
  LCA / OFLC / FY / DSO. Each one needs its plain-word replacement agreed (e.g. *ATS score → résumé match score*,
  *run → check for new jobs*, *picks → jobs we chose for you*, *claim → a skill you listed*).
- **The three Step 3 sketches D145 names are well chosen by these numbers:** the Daily Deck card (most-seen, 7
  features on one card), Draft House (26 actions, letter tiles, an empty two-thirds), Atlas home (249 words, the most
  internal terms of any main screen). **The posting panel and The Table rank higher** than two of those three. I'd add
  them as sketches 4 and 5, or fold the posting panel into the Deck card's sketch, since the card opens it.

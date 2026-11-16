# AUDIT 46q — the product end to end, as a newcomer, in real Chrome (2026-11-16)

**What draft offers (the yardstick for every row below).** draft finds the jobs that fit you and gets your applications
out without you retyping anything: you add your résumé once; draft reads your field, level and skills, ranks every open
posting against it (the board, and ten picked for today), tailors the résumé for a job when you press **Draft**, fills the
employer's form from what you have already said, and holds it for your review — **nothing is sent until you approve it**
(Ask me first) unless you choose Apply for me. Around that loop: **Atlas** shows where your skills stand against the market
and what to learn next; **Tiny** answers from your own data and runs the site's actions by request (no model for anything
draft already knows); the **extension** adds a job from any site and fills application forms in your own browser.

**How this was walked.** A NEW synthetic person (`newcomer…`, `robin.…@example.invalid`) signed up through the real
`/register` form on a **local boot of the current tree** over a synthetic fixture (3,000 postings, `scripts/scaleFixture.mjs`,
no model key, no real person's data, no live employer form) at 1440 × 900, then added a résumé through the real upload
control. Scripts: `tmp/walk46q/audit.mjs` (before the résumé), `audit2.mjs` (after it), `auditRm.mjs` (resumemaster.one,
signed out, read-only). Shots: `docs/audit46q/NN-<screen>-1440.png`; per-screen page errors / failed requests / residue
words: `docs/audit46q/report-1440.json`, `report2-1440.json`. The full-width work (item 2) was measured separately
(`scripts/fidelityShots.mjs --styles screens163`, before / after at 1280 · 1440 · 1920 · 2560 · phone).

**Not walked here (said plainly):** a Draft reviewed end to end (the tailoring runs in the tools service, which a local
boot does not have — the board's Draft is drawn, the review screen is covered by `d146Tracker` / `fidelityTracker`); the
extension's side panel and runner (walked with the real extension in 46p — `d191SidePanel`, `a211Background` ALL PASS —
not again this session); Interview beyond its page; four themes (Dusk Dark only); the phone beyond the width probe.

Size: **S** < 1 h, no design · **M** a few hours or a small design choice · **L** a decision or a redesign.

## Fixed in this session (each with its commit and a TECH note in the WORKLOG)

| # | Screen | What | Why it matters | The fix | Size |
|---|---|---|---|---|---|
| F1 | Atlas → Today's question | The whole app went **blank** (`TypeError … reading 'level'`) — shot 21 | every signed-in person who opened it since D154 P6 (45n) lost the page | the practice card's route was **shadowed** by the learn router's `/progress` (lesson marks); moved to `/api/learn/practice-progress`, the card refuses an unknown shape; guard `learnRouteShadow` — `3e6887be` | S |
| F2 | Tiny (T3), production | "rewrite this bullet…" answered *"assistant.chat fallback … has no passing evaluation … (G3)"* | T3 could never answer on production | an un-evaluated **default** fallback is dropped, not fatal — `16dcf30f` (needs the push) | S |
| F3 | Every page | content crammed into a ~1,200 px centred column (Atlas 666 px free each side at 2560) | the owner's 11-16 spec | FULL WIDTH: the rule in BRAND.md, `styles/pageWidth.css`, 21 caps removed, guard `pageWidthGuard` — `c3a58c31` | M |
| F4 | Landing | the job cards, the count and the sign-up band sat on the window's edge (x = 0) — shot 01 | the first thing a visitor sees looked broken | the page gutter in both landing modes; the guard reads a px fallback inside `var()` — `98fa9f21` | S |
| F5 | Home (applications) | "Review all **2** →" under "**0** needs you" — shot 16 | two numbers for one thing on the same screen | Review all counts applications only (the 2 were the setup blockers) — `98fa9f21` | S |
| F6 | Profile → Privacy · Admin → Atlas | still "Ask draft" (Tiny since 46n); the admin switch said "Open Ask draft to everyone" | retired name; the switch didn't say it means model spend | "Tiny"; "Let Tiny write for everyone (model calls)" — `98fa9f21` | S |
| F7 | Home (applications) | "Nothing to show yet." on the table card's left edge | looked unfinished | padded inside the card — `98fa9f21` | S |
| F·A224 | Account | "member since **12/31/1969**" when the account's created date is missing | an epoch date reads as a bug | no date → nothing — `50232bc6` | S |
| F·A225 | Sign-up | the `<h1>` carries a `<style>` block (the type-set animation) — its CSS is the heading's text content | screen readers and anything reading the heading get CSS | the <style> moved beside the heading — `50232bc6` | S |
| F·A226 | Tiny | the card's sub-line "draft's helper — no AI for anything draft alr…" is cut | the honest line about AI is the one that's cut | the line wraps — `50232bc6` | S |

## To act on — ranked (A rows in the WORKLOG)

| # | Screen | What | Why it matters | The fix | Size | Owner decision? |
|---|---|---|---|---|---|---|
| A213 | Tiny | A filter said to Tiny ("show remote data engineer jobs in Boston") **reset the person's career level** — the sentence went from *senior … Boston* to *all career levels … remote … Boston* (shots 43 → 53) | Tiny silently undoes a choice the person made | merge Tiny's filter into the current sentence; replace only the clauses it names | M | n |
| A214 | Home (jobs), a newcomer | **Two identical "Start with your résumé" cards** side by side — the deck's and the board's empty state, each with Upload / the audit / set up by hand (shot 13) | the first screen after sign-up says the same thing twice | keep the deck's; the board's empty state says "Your jobs show here once your résumé is in" | S | n |
| A215 | Naming, site-wide | The dock's **Home** is the applications page (h1 "Home", subtitle "Today's question · 2 minutes"); the jobs board is the **/draft** wordmark at `/app/today`; `/app/jobs` draws the same page; `/app/companies` redirects to it; the empty text says "Draft jobs from the Daily Deck or Full House" and Customise's preview names "Daily Deck · Full House · Home · The Table" | a newcomer can't tell where their jobs are vs their applications; four retired / parallel names | one name per place, written once (D167's map), then the copy follows | L | **y** |
| A216 | Home (applications) | "No base resume on this profile" and "No active job profile" — **two blocker rows for one cause** (no résumé yet), each "Fix it" | redundant; the newcomer has one thing to do | one row: "Add your résumé — draft sets up your profile from it" | S | n |
| A217 | The posting (board) | "55 days ago · posted" and "Open 55 days · history" — **the same fact twice** in the facts box; Draft / Save are below the long description, out of view at 1440 (shot 45) | the box spends a cell on a repeat; the main action is hidden | drop the repeat; keep the actions sticky at the card's top or bottom | S / M | n |
| A218 | Board rows | titles cut ("Senior Software Engin…") in the two-column rows at 1440 even now the page is wider (shot 43) | the role is the thing being read | let the title wrap to two lines, or three columns from ~1700 px with the same card width | S | n |
| A219 | Tiny (production) | the FAQ answer to "how does ask me first work?" **appended an unrelated Atlas card** ("Atlas — API: …") | a wrong answer looks like Tiny guessed | the FAQ match should not also run the Atlas term lookup on a word inside the question ("ask"/"API") | S | n |
| A220 | Landing | "Apply path?" on every job card; the count says **"12 jobs of 3000"** while `/jobs` says **"2,885 open jobs"**; "Hiring? … Soon." | an unexplained label; two numbers for the open board; a promise of something not built | say what "Apply path" means or drop it; count active postings the same way on both; owner: keep or cut "Soon" | S | y (the "Soon" line) |
| A221 | The board's search | an "All filters" label above the search field at ~6 px — unreadable (shots 13, 43, 45) | an affordance nobody can read | the label at the page's small size, or fold it into the sort icon | S | n |
| A222 | Network · Feed · Messages | each answers "This isn't available yet" (the switch A169 is off) but the pages exist at their addresses | dead ends if anything links to them | either hide the routes while the switch is off or keep — **owner's switch** | S | **y** |
| A223 | Profile → Your profile (full width) | "Add a photo" floats mid-row in the cover strip now the row is wide (screens163-profile-1920) | looks misplaced | sit it beside the avatar | S | n |
| A227 | resumemaster.one | still a centred ~1,010 px column at 1440 (shot 61) — the same issue the owner raised for draft | consistency across the two products | apply the FULL WIDTH rule there too (its own repository) | M | **y** |
| A212 | Tiny / admin | "the assistant is available to admins always" can never be true under D95's admin accounts | T3 is reachable only by switching it on for everyone | key it on an admin-account session, or drop the clause | S | **y** |

**Unknowns, noted not acted on:** "what is dbt?" → Tiny "can't do that here" on the fixture (it has no published Atlas page
for dbt; production answered "what is Spark?" from Atlas — not a defect unless production fails too) · the answer draft
for "Current Company" came back UNKNOWN on the owner's account (the résumé's current employer may be phrased differently
— not checked) · the find / fit / apply section renders as empty space in a full-page screenshot (its scroll-reveal; in
a real scroll it draws — not verified).

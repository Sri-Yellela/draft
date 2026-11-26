Status: M1–M3 done (47j, lane w2-outside) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #18 — Emails → **Dispatches**

Nothing here changes a live email. M1 is read from the code (file:line at `a393442e`); M2 is the brief; M3 is the mock at
`/dev/plate?page=dispatches` (`client/src/pages/dev/platePages/Dispatches.jsx`, `&w=390` for the phone frame).

## M1 · Every email today (from the code)

**The one sender.** `services/emailService.js:24` `sendEmail({ to, subject, text, html, headers, replyTo, db })` → Resend
(`POST https://api.resend.com/emails`, :29). **Every email draft sends today is plain text only** — no caller passes
`html` (the D73 §B comment, :20: "SERVICE mail stays plain text"). So *the plain-text part* of each row below IS the
whole email today. Shared behaviour of every row:

| Behaviour | Where |
| --- | --- |
| Refuses with no `to` / `subject` / `text` (`invalid_message`) | `emailService.js:26` |
| A suppressed address (hard bounce / spam complaint, the Resend webhook) is never sent to when `db` is passed | `emailService.js:27`, `services/emailSuppression.js` |
| From `EMAIL_FROM` → `PASSWORD_RESET_FROM` → `SENDER_FROM` (`shared/brand.js`); replies to `SUPPORT_EMAIL` by default | `emailService.js:24,32` |
| No provider in production → `{ ok:false, reason:"email_unconfigured" }`, the subject logged, never the body (no link / code in logs) | `emailService.js:38-41` |
| Development: printed to the console, marked `[email:dev]` | `emailService.js:42` |
| The person's per-event email switch (Account → Notifications) gates every notify email; only when Resend is configured | `services/notify.js:289-299`, `readPrefs` :174, `channelsOffered` :254 |
| A burst is one email per event per throttle window (15 min for needs_you / quick_check / switched_to_extension / apply_complete) | `notify.js:33-47,288` |

### A · Notification dispatches (`services/notify.js` — the event's in-app line, push and email say the same words)

Default email: the event's in-app line + `Open draft: <appUrl><url>` + the foot "You chose to get this by email. Change it
in draft → Account → Notifications." (`notify.js:304-306`). Subject `draft · <title>`. **No company, no value** in the
default (D100 P4); the four D113-style emails below name the job and company (the person's own inbox).

| # | Event (`NOTIFY_EVENTS`) | Who sends it | Subject | Content blocks (plain text) | Links | Email default |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | `needs_you` (:32) | `notifyRunJobOutcome` :334, `applyWorker.js:316,329,344,365` | `draft · Needs you` / `draft · Ready for your approval` | "An application is waiting for you in Home." / "A job is ready for your approval." (:79-80) · foot | Open draft → `/app/auto-apply` | off |
| A2 | `quick_check` (:37) | `notify.js:330` (a CAPTCHA after Submit, `held_gate` + `captcha_required`) | `draft · A quick check` | "An application needs a quick check." (:82) · foot | Open draft → `/app/auto-apply?check=<runJobId>` (the held row, :278) | **on** |
| A3 | `switched_to_extension` (:42) | `notifySwitchedToExtension` :343 (A207 (c): a spam flag on draft's submit) | `draft · <Company> — ready in your extension` | "<Company>: the site flagged draft's submit — it's ready in your extension, one press sends it." · "Nothing was sent. Open it in draft (Open & fill) or from the extension's queue: …" · foot (:157-162) | Open draft → `/app/auto-apply` (or `data.url`) | **on** |
| A4 | `inbox_reply` (:44) | `services/inbox.js:178` | `draft · An interview` / `draft · An offer` | "A reply from an employer was filed as an interview / an offer." (:86-87) · foot | Open draft → `/app/database?sheet=inbox` | off |
| A5 | `apply_complete` (:46) | `applyWorker.js:357`, `notify.js:324` | `draft · Application sent` | "An application was sent." · foot | Open draft → `/app/database` | off |
| A6 | `picks` (:52) — **"Ask me first" run dispatch** | `services/picks.js:308` (`picksMessageData` :285) | `draft · 1 new pick` / `draft · N new picks` | lead "N jobs were picked for you." · "A tap on Apply, then Confirm, sends the application. Pass removes it." · per pick (≤ 25): `n. <title> — <company>`, its `line`, `Apply: <url>`, `Pass: <url>` · "Apply to all N: <url>" (N > 1) · "These links work until your next run time." · foot (:118-131) | Apply / Pass per pick and Apply to all → `/p/confirm/<signed token>` (GET only shows; POST acts — `routes/picksConfirm.js:259,271`) | **on** |
| A7 | `picks_summary` (:54) — **the run summary** ("Apply for me") | `picks.js:361` | `draft · Apply for me` | "This run sent N applications." + " N need you." + " N more need you to sign in." (D175 FA4) (:92-96) · foot (:164-167) | Open draft → `/app/auto-apply` | **on** |
| A8 | `pick_question` (:56) | `picks.js:389` | `draft · a question on a job you applied to` | "<title> — <company> stopped on a question / N questions only you can answer:" · `- <question>` per question · "Nothing was sent. It continues once you answer." · foot (:132-137) | Answer here → `data.answer` | **on** |
| A9 | `daily_question` (:60) | `services/learn/dailyReminder.js:69` | `draft · Today's question` | "Today's question is waiting — about two minutes." · foot | Open draft → `/app/atlas/todays-question` | off |
| A10 | `new_match` (:64) — **the D185-2 alert** (digest by default, instant opt-in, ≤ 10 jobs a day) | `services/jobs/newMatchAlerts.js:212` (`alertMessage` :161-164; modes :23, `setMatchAlertSettings` :65) | `draft · 1 new job fits you` / `draft · N new jobs fit you` | lead "New jobs that fit your résumé." or, sponsorship needed + a sponsor in the list, "… — companies with an H-1B filing record first." · per job (≤ 25): `n. <title> — <company>`, facts `posted <ago> · asks for <m> of your <of> top skills · has filed H-1B petitions before`, its URL · the H-1B small print "A filing record is history, not a promise — confirm with the employer. Not legal advice." (only when a sponsor is listed) · "Daily digest, or as they arrive: draft → Account → Notifications." · foot (:138-156) | each job → `/app/jobs?job=<id>` (the board's deep link) | **on** |
| A11 | `messages_unread` (:68) — the Network digest (listed only while Network is on) | `services/network/unreadDigest.js:35` | `draft · Unread messages` | "N messages are waiting for you in Network." — never who or what · foot | Open draft → `/app/messages` | off |
| — | `auto_daily_summary` | **retired 10-31** (`notify.js:48`) — past rows keep their bell text; no email | — | — | — | — |

### B · Account mail (transactional — no opt-in, never suppressible by the notify switches)

| # | Email | Where | Subject | Content | Links |
| --- | --- | --- | --- | --- | --- |
| B1 | Password reset (the person asks) | `server.js:11672` → `emailService.js:46-56` | `Reset your draft password` | "Use this one-time link…" · the link · `Code: <otp>` · `Expires: <local time>` · "If you didn't ask for this, ignore this email…" | `/login?resetToken=<token>` |
| B2 | Password reset (Admin → People → a person → *Send a password-reset link*) | `server.js:12313` (`adminSendResetLink` :12303) | same as B1 | same as B1 | same |
| B3 | Verification code — a new email address | `routes/accountManagement.js:205` → `emailService.js:58-65` | `Your draft code: <code>` | "Use this code to confirm your new Draft email address:" · the code · "It expires in 15 minutes…" | none |
| B4 | Verification code — sign-up / billing phase 1 | `routes/billing.js:104` | same | "… confirm this email address for draft" | none |
| B5 | Support reply to the person (Admin → Support, not an internal note) | `routes/tickets.js:60-61` | `Re: <subject> [#<id>]`, reply-to support | the admin's reply · "Read the whole thread, or reply, in draft: …/app/account#help (Or reply to this email.)" | `/app/account#help` |
| B6 | Service notice (Admin → Email → Send a notice: dry run, ceiling, test-to-me, paced 550 ms) | `services/notices.js:49-58`, `routes/email.js:72` | the admin's subject | the admin's body + the footer "You are receiving this service notice because you have a draft account: <why>. It is not marketing…" (`noticeFooter` :45) | none (reply to support) |
| B7 | Marketing (**not called by any route**; guarded: `MARKETING_SENDS_ENABLED`, postal address, opt-in, suppression) | `services/emailConsent.js:71-81` | caller's | caller's text + "You are receiving this because you asked for product news… Unsubscribe: <url>" + postal address; `List-Unsubscribe` + one-click headers (:57-60) | `/u/<token>` (`routes/email.js:41-48`, GET page + RFC 8058 POST) |

### C · Operator mail (to the support inbox / admins — not to users)

| # | Email | Where | Subject | Content | Links |
| --- | --- | --- | --- | --- | --- |
| C1 | A new support request | `routes/tickets.js:29-30` | `[draft support #<id>] <subject>` | "<username> (account <id>) opened a request — <category>." · message (≤ 4000) · "Answer it in draft: …" | `/admin?g=people&s=support&t=<id>` |
| C2 | A user's reply on a request | `routes/tickets.js:37-38` | `[draft support #<id>] a reply from <username>` | the reply · "In draft: …" | same |
| C3 | Admin sign-in link | `routes/adminAuth.js:64-65` | `Your draft admin sign-in link` | "…set your draft admin password and sign in. It works once, for 30 minutes." · link · "If you did not ask for it…" | `/admin/set-password?token=` |
| C4 | Break-glass used | `routes/adminAuth.js:124-125` | `draft: the admin break-glass passphrase was used` | who and when · "rotate ADMIN_BREAK_GLASS_HASH and disable the session from Admin → System → Admins." | none |
| C5 | Disk alert (bands, once a day while high) | `services/diskAlert.js:42-44` | `draft: data volume N% full` | used / total / free · what fails at 100 % · Admin → Ops · when it repeats | none |
| C6 | Email-health test (bounce / complaint to Resend's test addresses) | `routes/email.js:96` | `draft email-health test (<kind>)` | one line | none |

### D · Not an email (named so nobody looks for it): the practice form's "Thank you for applying to <company>"
(`services/sampleResumes.js:174`) is delivered into draft's own Inbox (`deliver`), never sent.

### Pages the dispatches link to (server-rendered, not in this page's scope — they keep their behaviour)
`/p/confirm/<token>` (picks: GET shows, POST acts once, `routes/picksConfirm.js`) · `/u/<token>` (unsubscribe, `routes/email.js:41`)
· `/login?resetToken=` · `/admin/set-password?token=`. Their look belongs to #16 / #17 / #21.

## M2 · The brief — *Dispatches*

**Atlas name and parts.** A **dispatch** = one email. Its parts: the **masthead** (the `/d` tile + the wordmark and a mono
kicker: `DISPATCH · <KIND> · <DATE>`) over a ruled edge (the ruler as a 1.5 px rule + a 6 px tick strip drawn with table
cells), the **title** (serif, the plain thing: *"4 new jobs fit you"*), the **lead** (one sentence), the **entries** (each
job / pick / question a ruled row — the email form of the Gazetteer: a mono number, the serif title, the company,
the mono facts line, its links), the **one action** (the clay button), the **small print** (H-1B, link expiry) and the
**foot** (why you get it + where to change it). Kinds: `ALERT` (A1–A5, A9, A11), `PICKS` (A6), `RUN SUMMARY` (A7),
`QUESTION` (A8), `DIGEST` (A10), `ACCOUNT` (B1–B5), `NOTICE` (B6), `NEWS` (B7). Operator mail (C1–C6) stays plain text
(see "where it lives").

**Palette.** One region: **IV (navy)** — the v3 boards' palette the market wears — for the entry numbers' tags and the
rule ticks. **Clay = the single action** (one per dispatch: *Open in draft*, *Answer it*, *Review the picks*). **Green only
for proven** — the run summary's "Sent N" number. Ink for every rule. Paper ground, white card.

**The single clay point.** The dispatch's one button. Per-entry links (Apply / Pass / Open) are ink text links, never clay.

**Hero plate.** Email clients strip SVG and ignore most CSS, so **no live drawing**: the hero is the masthead + a
*stats strip* as a 3–4-cell table (serif numbers, mono labels — e.g. `4 NEW · 3 FILED H-1B · 10 TODAY'S CAP`).
**Drawing needed (optional, owner's call):** one raster plate per kind (a 560 × 140 PNG at 2×, hosted on draft's domain,
`alt` = what it shows), exported from the plate drawings — none exists yet; the mock shows the rule-and-table hero only.

**Sections, each with one drawing.** A dispatch is one section; its drawing is the hero above (or none). The digest's
entries carry **lit squares as table cells** (`asks for 4 of your 5 top skills` → five 10 px cells, 4 green) — the one
"drawing" that survives every client.

**The one operable model.** None runs in an email (no script). The model is the **links**: Apply / Pass go to
`/p/confirm` (GET shows, POST acts — kept exactly); every other link opens draft at the deep link today's text carries.

**Squares.** The digest's skill squares (above). No other squares.

**Onward tickets.** The foot: *Change it in Account → Notifications* (every notify dispatch) · *Unsubscribe* (B7 only) ·
*Reply to this email* (B5, B6).

**Email-safe rules (M5 must keep them).**
- **Two parts, always:** the HTML part is new; **the plain-text part stays exactly today's text** (each row above), so
  nothing a text-only client or a screen reader got today is lost.
- 600 px table, `role="presentation"`, every style inline; no `<style>` reliance (a `<style>` block may add the
  @media phone rule — 100 % width under 620 px — as an enhancement only).
- **No web fonts required:** serif `'Instrument Serif', Georgia, 'Times New Roman', serif` · sans `'Inter Tight',
  Arial, Helvetica, sans-serif` · mono `'JetBrains Mono', Menlo, Consolas, monospace`. Instrument Serif loads only
  where the client allows a `<link>` (Apple Mail); Georgia is the design's fallback.
- **Borders:** 1.5 px ink renders as 1 or 2 px in Outlook (Word engine) — write `2px` in the Outlook conditional, 1.5 px
  elsewhere. Hard shadows: an ink cell 4 px right / below the card (a two-cell table), not `box-shadow` (Outlook drops it).
  Radii are ignored by Outlook (square corners are acceptable there; still no capsule anywhere — D60).
- The button is a bulletproof link (a table cell with the clay fill, the link inside, `mso` padding), ≥ 44 px tall.
- Colours: the token VALUES below are written into the template at build time from `client/src/styles/plate.css`
  (one map, so a token change reaches the email). The mock reads the same tokens live (`var(--pl-*)`).
- Dark-mode clients: set `color-scheme: light` + `supported-color-schemes`; the paper stays paper (the plate rule —
  no dark plate variant yet).
- Privacy unchanged: push and in-app stay count-only (D100 P4); only the four D113-style dispatches name a company.

**Token → value (from `client/src/styles/plate.css`):** paper `--pl-paper` #F4EFE9 · card `--pl-card` #FFFFFF · paper warm
`--pl-paper-warm` #FBF8F4 · ink `--pl-ink` #1B1B1B · ink soft `--pl-ink-soft` #3F3A36 · muted `--pl-muted` #55504C · rule
`--pl-rule` #E6DED8 · clay `--pl-clay` #C2593A · on clay `--pl-on-clay` #FFFFFF · clay text / tint `--pl-clay-text` #8A3A22 /
`--pl-clay-tint` #FBEFEA · lit `--pl-lit` #3E6B5A · region IV `--pl-r4` #1F3A63 / tint `--pl-r4-tint` #EDF1F7.

### Where each M1 row lives (D200 Rule 1)

| M1 rows | Where it lives in Dispatches |
| --- | --- |
| A6 picks | `PICKS` dispatch: title "N jobs picked for you", lead = today's two sentences, entries = picks (title, company, line, **Apply · Pass** links), the clay action = *Apply to all N* (N > 1; else *Open in draft*), small print "These links work until your next run time.", foot |
| A7 run summary | `RUN SUMMARY` dispatch: stats strip `SENT` (green — proven) · `NEED YOU` · `NEED A SIGN-IN`, lead = today's sentence, clay *Open the ledger* (`/app/auto-apply`), foot |
| A8 pick question | `QUESTION` dispatch: entry = the job, the questions as a ruled list, "Nothing was sent…", clay *Answer it* (`data.answer`) |
| A10 new match (D185-2) | `DIGEST` dispatch (the mock): stats strip, lead (sponsor-first wording kept), entries (number tag, serif title, company, mono facts, skill squares, *Open* link → `/app/jobs?job=`), the H-1B small print verbatim when a sponsor is listed, the cadence line, clay *See them on the market*, foot |
| A1–A5, A9, A11 | `ALERT` dispatch (the mock's first): kicker, title = the event's `title`, lead = its `body` (unchanged words, count-only), clay *Open in draft* → the event's `url` (incl. A2's `?check=<id>`), foot. A3 keeps its two sentences and names the company |
| B1–B4 | `ACCOUNT` dispatch: the code in a mono cell (large, letter-spaced) or the link as the clay button, expiry in mono, the "ignore this email" line |
| B5, B6 | `ACCOUNT` / `NOTICE` dispatch: the body as written (no reformatting of an admin's words), the footer sentence verbatim |
| B7 | `NEWS` dispatch: unsubscribe link + postal address in the foot, the headers unchanged |
| C1–C6 | **Unclear home — proposed: stay plain text** (operator mail to support / admins; Admin is "tokens and components only" and these are read in a support inbox). Owner to confirm at M4. |
| The shared behaviours (suppression, throttle, prefs, no-provider honesty, dev console) | unchanged — the sender (`sendEmail`) gains an `html` part only |
| D (practice "Thank you") | not an email — no change |

## M3 · The mock

`/dev/plate?page=dispatches` — two dispatches as they'd render in a mail client, each a 600 px email table inside a
"mail client" frame drawn from the library (`Kickers`, `LegHeader`, `Ticket`): **an alert** (A2 *A quick check* — the
count-only words) and **the D185-2 digest** (A10, four synthetic jobs: Kestrel Payments, Northwind Analytics, Halcyon
Robotics, Brightline Health), each with its plain-text part shown beside it (the text the template already sends). At
390 the frame is the phone width (the table at 100 %). The email body is the new library piece **`Dispatch`**
(`client/src/plate/Dispatch.jsx`: `DispatchFrame`, `DispatchEntry`, `DispatchButton`, registry entries "Dispatches") —
inline styles only inside the email body, every value a `var(--pl-*)` token (the template resolves them to the values
above at M5).

# D197 Wave 2 · #17 — SETTINGS, APPEARANCE, PRIVACY, ACCOUNT, SIGN-IN / SIGN-UP · M1 inventory + M2 brief + M3 mocks

Status: M1–M3 done (47j, lane w2-person) · ⏸ awaiting the owner's M4 look

Read from the code on 2026-11-26 (47j, lane *w2-person*, from local `main` `a393442e`). Paths under `client/src/`.
**Nothing live changed.** Two mocks: `pages/dev/platePages/Settings.jsx` (`/dev/plate?page=settings`) and
`pages/dev/platePages/SignIn.jsx` (`/dev/plate?page=signin`), each with `&w=390` for the phone.

**D197 #17's rule:** *plain names (the metaphor doesn't help here) in plate styling; Appearance offers the plate look +
Dusk / Plain until a dark plate variant exists; keep every setting and A138's one sign-in component with Google.*

**⛔ THE OWNER'S WORD ON APPEARANCE — KEEP IT EXACTLY.** `pages/profile/ProfilePage.jsx:206-207`: *"⛔ RETAINED EXACTLY
(owner 11-06: "customise screen design is very good right now"): the Customise screen, alone."*; `ProfilePage.jsx:15`
(*"⛔ the Customise screen (D93), RETAINED exactly as it is — mounted alone, no head, no wrapper style"*); WORKLOG
`docs/WORKLOG.md:6094` (D181: *"the current Customise screen is kept — Plain is added to it, nothing removed"*). So
**Appearance's M2 is tokens-only**: the same layout (the live preview card beside the column of sections), the same
sections in the same order, the same words, the same controls — redrawn in the plate tokens (paper, 1.5 px ink, hard
shadows, the three faces). The one addition D197 #17 asks for is a **Plate** card in the Theme section (beside Dusk and
Plain) — flagged for the owner below, since it adds to a screen the owner said to keep.

---

## M1 · what these pages have today

### 1 · Where they live

| # | Element (file:line) | What it does today | Home (M2) |
| --- | --- | --- | --- |
| T1 | Profile's group *You and draft*: Appearance · Notifications · Privacy and your data · Account (`pages/profile/profilePanels.js:260-265`) | four panels in Profile's nav | Profile's area nav → **More** (`profile.md` P4) — four plain names, unchanged |
| T2 | Legacy routes `/app/customise` → appearance, `/app/account` → account (`profilePanels.js:272-278`) | | unchanged |
| T3 | `AccountPanel only=[…]` draws each panel's cards (`ProfilePage.jsx:43-49`) | one component, cards by key | unchanged composition; each card becomes a `SettingsSheet` (new, `plate/Person.jsx`) |

### 2 · Appearance — `panels/CustomisePanel.jsx` (D93; ⛔ retained exactly)

| # | Element (file:line) | What it does today · API | Home (M2: tokens only) |
| --- | --- | --- | --- |
| AP1 | Head *Customise* + *How draft looks and is laid out for you — saved to your account, so it follows you to every device.* (`:97-100`) | | the same words; the title in the serif at the working-page size (D200 Rule 3, one plain line) |
| AP2 | **Live preview** card: *Live preview*, the summary line (theme · each layout choice · shape cues), *Hide* / *Show* (`aria-expanded`), `CustomisePreview part="all"`, the note (*Choosing here changes only this preview until you leave…*) (`:102-113`) | the page never changes under the pointer | the same card, left column (a plate card, 5 px shadow) |
| AP3 | **Theme** — radio cards of `THEME_LIST` (Dusk, Dusk light, Plain light / dark, Studio when on, high contrast) with previews, *in use*; *Follow my system's light / dark setting* (`components/AppearanceSettings.jsx:44-80`) → `saveAppearance` (reload) | D144 / D149 / D181 / 46t | the same section; radio cards as plate cards (`aria-pressed` look = ink fill + clay shadow, the filter-chip state). **+ a *Plate* card** (D197 #17) — see the unclear list |
| AP4 | **Accessibility** — *Shape cues* switch + its explanation (`AppearanceSettings.jsx:82-99`) | | unchanged words, a plate switch |
| AP5 | **Narration voice** — the device's voices select, *This browser can't read aloud…* (`components/NarrationSettings.jsx:24-38`) | D194 (2), kept in this browser | unchanged |
| AP6 | One section per `LAYOUT_OPTIONS` entry — **Filter sentence** (Marked words · Calm boxes), **Learning links** (Quiet · Shown), **Text size** (Smaller · Default · Larger · Largest), each with a mini preview and *recommended* (`CustomisePanel.jsx:117-123`; `themes/layoutOptions.js:20-50`) → `PUT /api/settings/appearance` | plug and play from the registry | unchanged (the registry still draws them); the *recommended* tag is a plain mono word, no pill |
| AP7 | **Today's picks** — *Cards a day* radio cards + the note, *Layout* (deck presets) + the custom note, *Fine-tune the fan* (`DeckGeometryControl`, three sliders), *Order* (`CustomisePanel.jsx:36-58`) → `GET/PUT /api/settings/deck-size`, `/api/settings/deck-geometry` | D152 (3), D149 | unchanged ⚠ the deck's *fan* presets describe the classic fan; the plate deck (D196) draws a pile — see the unclear list |
| AP8 | **Reset** — *Reset to defaults* (`:125-127`) → deck geometry, deck size, `saveAppearance({ pref: "system", … })` | | unchanged |
| AP9 | Apply on leave (`:76`) | | unchanged |
| AP10 | `ContrastOffer` — *Your system asks for more contrast… Use high contrast / Not now* (`AppearanceSettings.jsx:103-118`, app-wide) | | unchanged (it is the shell's, not this page's) |

### 3 · Notifications — `AccountPanel only=["news","notifications"]`

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| N1 | Head *Notifications · When we tell you things* (`ProfilePage.jsx:210`) | | one plain line *When we tell you things* |
| N2 | **Product news** switch (*Occasional email about what's new in draft. Account and policy notices come either way*) (`AccountPanel.jsx:43-63`, `:152-154`) → `GET/PUT /api/account/marketing` | D73 §B, = the email's unsubscribe | `SettingsSheet` *PRODUCT NEWS*, one switch row |
| N3 | **Notifications** — *Push on this browser* switch (subscribe / unsubscribe, VAPID) → `POST /api/push/subscribe`, `/api/push/unsubscribe` (`components/NotificationSettings.jsx:55-96`) | D112 item 8 | `SettingsSheet` *NOTIFICATIONS*, first row |
| N4 | The per-event × channel table (Event · push · email switches, each `data-notify-pref`) (`:97-114`) → `PUT /api/notify/prefs` | | a `Gazetteer`-shaped table (EVENT · PUSH · EMAIL) with plate switches; scrolls in its own box at 390 |
| N5 | **Send a test notification** (`:117-121`) → `POST /api/push/test` | | the sheet's action |
| N6 | *Notifications never name a company or show your answers — only what happened.* | | the sheet's foot |
| N7 | **New jobs that fit you** — mode select (off / instant / digest) + digest hour + the rule line (*at most N a day*) (`MatchAlertChoice`, `:133-159`) → `GET/PUT /api/alerts/matches/settings` | D185-2 | a row in the sheet |
| N8 | *Push and email notifications are not switched on for draft yet* / *This setting is unavailable right now* (`:43`, `:83-85`) | | the sheet's `empty` / `error` states |
| N9 | ⚠ The **notifications list** and **Mark all read** are reachable nowhere (`docs/revamp/shell.md`, A236 (b)) | the avatar menu that held them is dead | **not this page** — the shell build gives them the peek's Notifications row; listed so it isn't lost |

### 4 · Privacy and your data — `AccountPanel only=["data","delete"]` + `AssistantPrivacy`

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| PV1 | Head *Privacy and your data · What we keep, and for how long* + *Application emails in your Inbox are deleted after 6 months. Download everything draft keeps for you, or delete it all.* (`ProfilePage.jsx:216-217`) | | one plain line + that sentence (it says what you'd otherwise miss — Rule 3) |
| PV2 | **Download my data** (JSON, `draft-account-<date>.json`) (`AccountPanel.jsx:192-201`) → `GET /api/account/export` | | `SettingsSheet` *YOUR DATA*, its first action |
| PV3 | **Base résumé only** switch (forced by plan, says so) (`BaseResumeOnly`, `:326-354`) → `GET/PUT /api/settings/base-resume-only` | | a switch row in YOUR DATA |
| PV4 | **Generated résumés** — per job: status (*Kept — you applied with it / Kept — the job is in Home / expires in N days*), download, delete; empty / error lines (`GeneratedResumes`, `:356-397`; `generatedResumeStatus :238-250`) → `GET /api/generated-resumes`, `GET /api/resumes/:jobId`, `DELETE /api/generated-resumes/:jobId` | D57 | a `Gazetteer` (JOB · STATUS · ACTIONS) inside YOUR DATA |
| PV5 | **Ask draft** — *Use my questions to improve Atlas* switch + the log *What Ask draft did for you (each one only after you pressed Confirm)*, *Nothing yet.* (`AssistantPrivacy`, `ProfilePage.jsx:133-159`) → `GET /api/assistant/actions`, `GET /api/assistant/status`, `PUT /api/assistant/settings` | T5 | `SettingsSheet` *ASK DRAFT*: the switch row + the log as a register (summary · status · when) |
| PV6 | **Delete account** — *Delete my account…*, type the username, *Delete forever* (needs recent sign-in), *Cancel* (`DeleteSection`, `AccountPanel.jsx:607-633`) → `POST /api/account/delete` (via `post`) | | `SettingsSheet` tone *danger* (ink border dashed red is NOT a plate colour — the danger is said in words + the struck-through dashed button; see unclear) |
| PV7 | The *Notice* line (ok / error / info + ×) (`AccountPanel.jsx:65-75`) | | a `pl-notice` line at the top of the panel |

### 5 · Account — `AccountPanel only=["profile","email","plan","security","sessions","merge","allowance","help","signout"]`

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| AC1 | Head *Account · Signing in and your plan* (`ProfilePage.jsx:224`) | | one plain line |
| AC2 | **Profile** — picture (*Upload / Change picture*, *Remove*), display name + *Save* (`ProfileSection`, `AccountPanel.jsx:399-437`) → `POST /api/account/avatar` (remove: `DELETE`), `POST /api/account/profile` | the one avatar (also on the passport) | `SettingsSheet` *PROFILE* (the photo square = `PassportIdentity`'s tile, small) |
| AC3 | **Email** — current, new address + *Send code*, the 6-digit code + *Confirm* / *Cancel* (`EmailEditor`, `:439-469`) → `POST /api/account/email`, `/api/account/email/confirm` | used to sign in and reset | `SettingsSheet` *EMAIL*, `LabelledField`s |
| AC4 | **Your plan** (billing on): headline, tiers with *Choose <tier>* (*Not on sale yet*), *test price*, *Manage billing* (`components/PlanSettings.jsx:20-55`) → `GET /api/billing/status`, `POST /api/billing/checkout`, `/api/billing/portal` | A167 | `SettingsSheet` *YOUR PLAN*; tiers as plain `Ticket`s (no pills) |
| AC5 | **Your phone** — confirmed / `OtpVerify` (*Text me a code*, code, *Confirm*, *Send again*) (`PlanSettings.jsx:57-77`; `components/OtpVerify.jsx`) → `GET /api/verify/status`, `POST /api/verify/start`, `/api/verify/check`, `/api/account/phone` | one account per phone, never marketing | `SettingsSheet` *YOUR PHONE*; `OtpVerify` restyled (it is built once — the sign-up uses the same) |
| AC6 | **Sharing your details with employers** — consent switch, off by default (`LeadSharingCard`, `:79-97`) → `GET/PUT /api/account/lead-sharing` | | a switch row (its long sentence kept as the row's note) |
| AC7 | **The draft extension** — links (`ExtensionPanelBody`) (`PlanSettings.jsx:106-110`) | | a row with the links (also on Connections — `profile.md` C2) |
| AC8 | **Sign-in & security** — re-auth box (*Confirm* with password), **Change / Set a password** (current, new, confirm, *Cancel*), **Sign-in methods** Google · LinkedIn · GitHub with *Link* / *Unlink* (disabled when it is the only way in, with the reason) (`AccountPanel.jsx:165-184`, `ReauthBox :471-489`, `PasswordEditor :491-527`) → `POST /api/account/reauth`, `/api/account/password`, `oauthUrl(p, "link")`, `DELETE /api/account/sign-in/:p` | | `SettingsSheet` *SIGN-IN & SECURITY*: the three provider rows as a small index (PROVIDER · STATE · ACTION) |
| AC9 | **Where you're signed in** — sessions (this one / *Sign out*), apps (*Sign out of the …*), *Sign out everywhere else* (`SessionsList`, `:529-554`) → `GET /api/account/sessions`, `DELETE /api/account/sessions/:id`, `/api/account/apps/:id`, `POST /api/account/sessions/revoke-others` | | a register (DEVICE · WHERE · LAST SEEN · ACTION) |
| AC10 | **Merge another account into this one** — identifier + password *Check*, the preview, *Merge and delete the other account* / *Cancel* (`MergeSection`, `:556-605`) → `GET /api/account/merge/preview`, `POST /api/account/merge/verify-password`, `POST/DELETE /api/account/merge` | | `SettingsSheet` *MERGE*, the preview as a `FactSheet` |
| AC11 | **Your plan and allowance** (read-only) — plan, *N of M drafts left in the last 24 hours — the next frees up at …*, résumés today / 30 days, the feature list (`AllowanceSection`, `:723-743`) → `GET /api/account/allowance` | D88 P5, never money | a `StatsStrip` (*DRAFTS LEFT · RÉSUMÉS TODAY · 30 DAYS*) + the feature `FactSheet` |
| AC12 | **Help** — *Contact support* (category, subject, message, *Send* / *Cancel*), your requests with *Open* / *Close*, the thread, *Reply* (`HelpSection`, `:635-718`) → `GET/POST /api/support/tickets`, `GET /api/support/tickets/:id`, `POST …/:id/messages` | D88 P3 | `SettingsSheet` *HELP*; the requests as a register; the thread as letters |
| AC13 | **Sign out** — *On this device…* (`:217-228`) → `POST /api/auth/logout` | | the panel's last row, a plain button |

### 6 · Sign-in / sign-up — `/login`, `/register` (`App.jsx:1170-1187` → `components/AuthScreen.jsx`)

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| SI1 | Routes `/login` and `/register` (`initialTab="register"`), redirect when signed in (`PublicLoginRoute`) | | unchanged |
| SI2 | **The intro**: `StampLogo`, the headline *Ten jobs a day, picked for you.* set once (letters rise once per session, still under reduced motion) (`SetOnceHeading :398-426`), the lead *Not a search box. Every job on the board is read against your résumé, and the best ten are dealt to you each morning.* (`:467-476`) | | the left column: the `/draft` wordmark, the same headline in the 82 px serif (signed-out landing = a destination), the same lead; the set-once motion kept (it is one gesture) |
| SI3 | **DealBackdrop** (the deck's card backs dealt slowly behind) + **paper drift** with the pointer (`:428-453`, `DealBackdrop`) | motion behind, never in front | the backdrop becomes the plate's paper with faint contours; **drawing to come** — *the market plate, faint, behind the form* (drift kept, stops under reduced motion) |
| SI4 | Layout: two columns ≥ 980 px (intro + hook \| the form), one column below with the form straight after the headline, the hook after it (`:478-498`) | | unchanged order |
| SI5 | **SignupAtsHook** — *Try it before you sign up.* *Your résumé — PDF, up to 5 MB*, *Paste a job posting…*, **Check the fit** → `POST /api/standalone/ats` (zero model calls), the band card (`AtsBandCard`), *Keep it: create an account…*, **Create my account →**, *Try another posting*; the honesty-check carry (*… comes with you*) (`components/SignupAtsHook.jsx`) | value first, account second; `carryResume` | **the onward ticket on the sign-in page**: a `Ticket` *TRY IT FIRST · NO ACCOUNT* that opens the same form; the result as the plate `FitCard`'s band (the one report implementation — A52) |
| SI6 | The tabs **Sign In** · **Create Account** (`:204-219`) | | `BinderTabs` (existing) |
| SI7 | Sign-in: *Username or email*, *Password*, **Sign In →**, error / notice lines, **Forgot password?** (`:221-247`) → `POST /api/auth/login` | | `LabelledField`s + the ink button; the notice line `role="status"` |
| SI8 | **A138's ONE provider block** — *Continue with Google* first, then LinkedIn, GitHub, each only when configured (`components/SignInProviders.jsx`), returning to where `/login` was opened from (`returnToFromSearch`) | Google always shown while loading | unchanged component, restyled: three plate buttons (Google first) under an *or* rule |
| SI9 | OAuth returns: `?oauthError`, `?oauthStatus` + `oauthProvider` notices; `?resetToken` opens the reset (`:77-90`) | | unchanged |
| SI10 | **Forgot password** — *Email* → *send*; then *Email OTP*, *New password*, *Confirm* → reset; *Back to sign in* (`:248-298`) → `POST /api/auth/password-reset/request`, `…/confirm` | | a third tab state (no tab shown — as today) |
| SI11 | **Create account step 1** — *Username*, *Password (min 8)*, *Confirm*, *Continue* (`:299-320`), the slash as progress (`SlashSteps :25-41`, *Step n of 2*) | step 1 kept in React only | `LabelledField`s; the progress = the `/d` logo's slash filling (kept — the brand as the step marker) or two progress squares |
| SI12 | **Create account step 2** — first name, M.I., last name, suffix, *Email*, `OtpVerify` email, *Phone* (required when verification is on) + `OtpVerify` sms, the **product news** box (unticked, never tied to the terms), *Back* / **Create Account →** (`:321-365`) → `POST /api/auth/register` | D73 §B 2, A167 (d) | `LabelledField`s; the two `OtpVerify`s; the opt-in as a plate checkbox, unticked |
| SI13 | Leaving step 2 warns (`beforeunload`) (`:92-98`) | | unchanged |
| SI14 | **Admin? Sign in here →** (`/admin/login`) on the sign-in tab (`:369-380`) | | the form's foot, a quiet link |
| SI15 | The footer (`Footer`) (`:497`) | | the plate footer (D197 #16's) |

---

## M2 · the brief

**Atlas names: plain** (D197 #17 — *the metaphor doesn't help here*): *Appearance*, *Notifications*, *Privacy and your
data*, *Account*, *Sign in*, *Create your account*. They live in **Your passport's** More menu (Profile's area,
`profile.md`), so they wear its palette.

- **Palette — Region V** (the passport's; the lock = privacy and sign-in). Sign-in, signed out, wears **Region IV**
  (the market's, the public pages' — D197 #16) since no passport exists yet.
- **The one clay point:** per panel, the one thing that needs the person — Notifications: *Push on this browser* when off;
  Privacy: none (a quiet page — *Download my data* is ink); Account: an unconfirmed phone / email; Sign in: **Sign in →**
  (Create account: **Create account →**); Appearance: none (its preview card stays the focus, as today).
- **Hero:** working pages, so **no hero plate** (D200 Rule 3): one plain serif line (34–44 px) + a mono kicker
  (*YOUR PASSPORT · ACCOUNT*). Sign-in is the exception: a destination — the 82 px headline and **drawing to come — the
  market plate, faint, as the paper behind the form** (SI3).
- **Sections, each one drawing** — kept small: these are settings, so each `SettingsSheet` carries a **region emblem**
  as its drawing where one fits (Privacy → `lock`; Notifications → drawing needed, *a signal lamp*; Account → `lock`;
  Sign-in-methods → `net`); Appearance draws nothing new (retained).
- **The one operable model:** Settings — **the per-event notification table** (switch any cell; the caption says *Interview
  scheduled: push on, email off*, `aria-live`); Appearance — its **live preview** (unchanged); Sign in — **the binder tabs**
  Sign in ⇄ Create account.
- **Squares:** none.
- **Onward tickets:** Privacy → *Download my data*; Account → *Help* (*Ask us anything*); Sign in → *Try it before you sign
  up* (the ATS hook).
- **New library pieces** (in `plate/Person.jsx`): `SettingsSheet` (a strip + serif title + rows of label · control · note,
  tone *danger* says it in words), `LabelledField` (a mono label over a 1.5 px ink input, its error line `role="alert"`).
- **Every M1 row's home:** the right-hand column above.

## M3 · the mocks

- `pages/dev/platePages/Settings.jsx` (`SettingsMock`): the passport's area nav with More open on the four settings,
  `BinderTabs` *Appearance · Notifications · Privacy · Account* switching the panel below; **Appearance shown unchanged in
  plate tokens** (the preview card + Theme / Accessibility / Text size / Today's picks / Reset in their order, with the
  Plate card marked *ASK THE OWNER*); Notifications with the working table; Privacy's YOUR DATA + ASK DRAFT + Delete;
  Account's sheets.
- `pages/dev/platePages/SignIn.jsx` (`SignInMock`): the intro + the form (tabs, fields, Google first) + the *Try it first*
  ticket, at 1280 (two columns) and 390 (form after the headline).

## Unclear homes (for the owner)

- **AP3 the *Plate* theme card.** D197 #17 says Appearance *offers the plate look + Dusk / Plain*; the owner said keep the
  Customise screen exactly (11-06). Adding one Theme card changes nothing else — but it is a change to a retained screen.
- **AP7 *Today's picks* → Layout / Fine-tune the fan** describe the classic deck's fan; the plate market (D196) draws its own
  pile (`plate/deckGeometry.js`). Do the fan presets still apply, or does this section shrink to *Cards a day* + *Order*?
- **N9 the notifications list / Mark all read** — no page owns it (the shell's peek should; A236 (b)).
- **PV6 the danger tone** — the plate palette has no red; the brief says it in words (*This can't be undone*) and keeps the
  dashed border. Confirm, or name a danger token.
- **AC7 the extension card** appears in both Account and Connections — keep both rows or only Connections?
- **SI3 the deal backdrop** — the card backs are the classic deck's art; the brief replaces it with the market plate
  (drawing to come). Confirm.

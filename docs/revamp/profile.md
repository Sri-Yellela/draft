# D197 Wave 2 · #9 — PROFILE → *Your passport* · M1 inventory + M2 brief + M3 mock

Status: M1–M3 done (47j, lane w2-person) · ⏸ awaiting the owner's M4 look

Read from the code on 2026-11-26 (47j, lane *w2-person*, from local `main` `a393442e`). Paths are under `client/src/` unless
they start with `routes/` or `services/`. **Nothing live changed** — Wave 2 waits on Wave 1 #8 and on the owner's M4 look.
The mock is `pages/dev/platePages/Profile.jsx`, served at `/dev/plate?page=profile` (`&w=390` for the phone).

**Scope.** Profile is `/app/profile/<panel>` (`pages/profile/ProfilePage.jsx`, nav `pages/profile/profilePanels.js`). This
file covers the four panels that are *the person's page and how they apply* — **Your profile** (`about`), **Saved answers**,
**Auto-apply**, **Connections** — plus Profile's own nav and the public page **`/in/<handle>`** (`routes/publicProfile.js`).
The other four panels Profile mounts — **Appearance, Notifications, Privacy and your data, Account** — are D197 #17's and
are inventoried in full in [`settings.md`](settings.md) (one row each below points there), so no row is listed twice.

D200 Rule 1: every row has a home in the new page; a row whose home is unclear is listed at the end for the owner.

---

## M1 · what Profile has today

### 1 · Profile's own navigation (`ProfilePage.jsx:161-235`, `profilePanels.js`)

| # | Element (file:line) | What it does today · API | Home in *Your passport* (M2) |
| --- | --- | --- | --- |
| P1 | `PlaceNav` card beside the dock (`ProfilePage.jsx:230`) — eyebrow *You and your résumé*, title *Profile*, three groups | Profile's own nav (D167) | **the area nav** (`plate/Shell.jsx AreaNav`, area *Your passport*, no pill — Profile has no panel to open): views *Your passport · Saved answers · Auto-apply · Connections*; **More** → *Appearance · Notifications · Privacy and your data · Account* |
| P2 | Group *You*: Your profile (`about`), Saved answers (`answers`) (`profilePanels.js:252-255`) | two panels | the first two views |
| P3 | Group *Applying*: Auto-apply (meta *Ask me first / Apply for me*), Connections (`:256-259`, meta `ProfilePage.jsx:164-166`) | the meta reads the run bar's mode | views 3–4; the mode word rides the Auto-apply view as its mono sub-label (`AUTO · ASK ME FIRST`) |
| P4 | Group *You and draft*: Appearance (meta = theme label), Notifications, Privacy and your data, Account (`:260-265`) | four settings panels | **More** menu (see `settings.md`); the theme label stays in the menu row |
| P5 | Addresses `/app/profile/<id>`, `/profile/<id>` forward, `#<id>` hash, unknown id → About you, `resumes` → about (`profilePanels.js:280-293`) | routing | unchanged (routing only; the area nav writes the same hrefs) |
| P6 | Legacy routes `/app/customise`, `/app/saved-answers`, `/app/integrations`, `/app/account`, `/app/profile` forward with their query kept (OAuth / Gmail returns) (`profilePanels.js:272-278`) | nothing lost from pre-D167 links | unchanged |
| P7 | Scroll to top on panel change (`ProfilePage.jsx:169`) | | unchanged |
| P8 | The dock's *Profile* item with its badge (*12 to finish*) (`components/AppNav.jsx`, D196 dock) | opens Profile | the dock (D196 shell) — unchanged; the badge counts the same thing |

### 2 · Your profile (`about`) — `pages/profile/YourProfile.jsx` (D183 P1 / P2, A153, D186)

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| A1 | Panel head *Your profile · Your page, from your résumé · Only you can see it until you choose otherwise* (`ProfilePage.jsx:185-186`) | | the hero's mono kicker *YOUR PASSPORT · ONLY YOU CAN SEE IT* (the words follow the page level) |
| A2 | **Who can see your profile** — *Only you* (default) · *Connections* · *Public* segmented (`YourProfile.jsx:114-130`) → `PUT /api/profile/page/visibility` (`:559`) | the page level | **01 · Who can see it** — `VisibilityControl` (new, `plate/Person.jsx`) at page size; the operable model (below) |
| A3 | Consent before widening: *If you make it public / show it to connections* ✓ / ✕ promises (`PUBLIC_CONSENT_ITEMS`, `:96-111`), *Make it …* / *Keep it as it is* (`:132-138`) | D113 consent wording, A233 promises | **01**, a `FactSheet`-style promise card under the control (same items, same two buttons); nothing widens without it |
| A4 | *Let search engines find it* (off; only when Public) `data-searchable` (`:143`) | noindex by default | **01**, a plate checkbox under the control, disabled unless Public (same rule) |
| A5 | Each section's **eye** (`Eye`, `:77-90`) — a select that narrows, never widens, the page level → `PUT …/visibility { section, level }` | per-section visibility | every section header carries `VisibilityControl` at `compact` size (the same narrowing rule: levels above the page are disabled) |
| A6 | Cover band + photo or its letter (`:252-256`) | | **the identity page** — `PassportIdentity` (new): the photo in a 1.5 px ink square tile, or the letter tile |
| A7 | **Add a photo / Change photo** (`PhotoUpload`, `:215-235`) → `POST /api/account/avatar` | the account's one picture | `PassportIdentity`'s photo button (same upload, same API) |
| A8 | **View as the public** / *Back to your view* (`:260-261`) → `GET /api/profile/page?as=public` (`:565`) → `PublicPreview` (`:488-522`) | the server's own public view | the identity page's actions; the operable model flips the whole page to its public face (the server's answer, never a client filter) |
| A9 | **Share link** (copies `/in/<handle>`, *Copied*) (`:262-263`) | disabled with a reason until the page is public | the identity page's actions (same rule and title) |
| A10 | **Edit** / *Done* (`:264`) → headline form *Save* (`:268-272`) → `PUT …/visibility { headline }` | edit the header | the identity page's actions; the headline field opens in place (`LabelledField`, new) |
| A11 | Name, headline (or *No headline yet — Edit to add one*) (`:266-273`) | | the identity page: name = the page's serif title (82 px, a destination per D200 Rule 3), headline = the lead |
| A12 | **Your public link** handle editor `/in/<input>` + *Save link* (`HandleEditor`, `:152-174`) → `PUT /api/profile/page/handle` | the address | the identity page's mono field *HANDLE · draft.work/in/…*; the editor opens under it when Edit is on or there is no handle (same rule) |
| A13 | Location · years · the public link (live link when Public; plain text with the *private* title when not) (`:275-280`) | | the identity page's mono fields *LOCATION · YEARS · /IN/HANDLE* |
| A14 | *Fits <subcategory> · <level> · also <second>* (`:281-286`) | the placement from the résumé | the identity page's mono field *FITS* + **05 · Where you fit** |
| A15 | **Pick your role** when the placement is unsure (`PickRole`, `:191-213`) → `PUT /api/profile/placement` | never a guess below the confidence line | the identity page, in the *FITS* field's place (same select + Save) |
| A16 | *Open to work* · *Referrals welcome* switches (edit) / the line (view) (`:288-297`) → `PUT …/visibility` | the person's switches | the identity page's last line, a plain mark (no pill); switches when Edit is on |
| A17 | **The source line** — *Built from <file> · read <date>*, **Replace résumé** / *Add your résumé*, **Open in the editor** (`SourceLine`, `:302-329`) → `GET/POST /api/base-resume`, `openResumeEditor` | D157 | the hero's caption strip (mono) with the two buttons beside it |
| A18 | Replace résumé file pick + *Reading your new résumé and re-filling every section…* (`:567-603`, `:634-636`) → `POST /api/parse-pdf`, `POST /api/domain-profiles/:id/base-resume`, `…/signals/refresh`, or `POST /api/domain-profiles/from-resume` (first résumé makes the job profile, D186-3) | | unchanged handler; the status line under the source strip |
| A19 | Replace error + the choice drawn where the button is (45s fix) (`:640-643`) | | under the source strip (the same place, the same scroll-into-view) |
| A20 | **A résumé for another kind of job** — *Make this its own job profile* / *Replace the current one* / *Cancel* (`SecondFamilyChoice`, `ResumeSetup.jsx:74-87`) → `POST /api/domain-profiles/resume-preview`, `…/from-resume { asNew }` | D186-3 | a `Ticket` pair under the source strip (two choices + Cancel) |
| A21 | **What changed** after a replace — each change (*was: …*, *— N picks today* `GET /api/draft/today`), Kept, Untouched, **Looks right**, **Undo — back to the old résumé** (30 days), **Review each change** (`ReplaceWhatChanged`, `:460-486`) → `GET /api/profile/replacements/latest`, `POST …/:id/keep`, `POST …/:id/undo` | D183 P2 | a `FieldCard`-shaped card at the top (*LINES UP* = kept/untouched, the changes as items), its three buttons; it takes the page's one clay point while it is open |
| A22 | **The four things your résumé can't tell us** (`FourThingsCard`, `ResumeSetup.jsx:9-45`) — select / text / date per item, *Save*, *Skip* → `GET/PUT /api/profile/four-things` | D186-2, asked once, each skippable | the clay waypoint while open: **a `QuestionTicket`, one thing at a time** (kind choice / text, *Skip* in its foot) — same API; see `onboarding.md` O14 |
| A23 | The D101 section editors (`components/ProfileSections.jsx`) for **About** (summary, *Edit* / *Cancel* / *Save*, `:441-460`) → `PUT /api/profile/sections/summary` | | **02 · About** (the same editor inside a plate card) |
| A24 | **Experience** — roles with logos (`LogoTile`), dates + duration, bullets with your skills / keywords **bold** (`BoldTerms`, a tech word links to `/app/jobs` filtered), the company's stack line (`CompanyStackLine`), *+ Add a role* list editor (`ProfileSections.jsx:462-500`) | A140 kept | **03 · The road so far** — the same rows on a route (each employer a stop: logo tile, title, dates); bullets and bold terms unchanged |
| A25 | Evidence links per bullet / project (`EvidenceLinks`, `:91-140`, ≤ 5) → `PUT /api/profile/evidence` | proof links | under each bullet / project, unchanged |
| A26 | *Terms the résumé lists but never says* (`data-terms-unsaid`, `:496`) | | under 03, unchanged |
| A27 | **Skills** in two columns — *Proven in Atlas* (how + proof link + date) / *From your résumé* with **Prove it · 5 min** → `/app/atlas/your-skills?prove=…`; *Your skills map in Atlas* (`SkillsColumns`, `YourProfile.jsx:340-366`) | D169, green = proven only | **04 · Stamps** — `PassportStamps` (new): each proven skill a green stamp (how · date · proof link); each résumé skill a dashed *not yet* tile with *Prove it · 5 min*; the *Your skills map* link is the section's onward ticket |
| A28 | **Where you fit** — ready % for the role, thin-data line, **Fly my route** → `/app/atlas/your-map` (`WhereYouFit`, `:368-390`) | | **05 · Where you fit** (drawing below), same words, *Fly my route* as its ticket |
| A29 | The apply-for-me family decision *Keep* / *Change back* (`FamilyDecision`, `:424-442`) → `POST /api/profile/apply-for-me/:a` | | in 05, under the fit line (same two buttons) |
| A30 | *— N picks today* on the fit line (`usePicksToday`, `:447-458`) | B-2 | in 05, unchanged |
| A31 | **Projects** (*Counts as proof for …*, evidence, *+ Add a project*) (`ProfileSections.jsx:503-519`) | | **06 · Work you can show** |
| A32 | **Achievements** — list, *Remove* (hand-added only), add form title + year + *Add* (`Achievements`, `YourProfile.jsx:392-422`) → `POST /api/profile/page/achievements`, `DELETE …/:id` | | **06** |
| A33 | **Education** + *Highest degree* override (*Use the section*) (`ProfileSections.jsx:282-333`, `:531-544`) → `PUT /api/profile/education-override` | | **07 · Schooling** |
| A34 | **Links** as logos (GitHub, LinkedIn marks; else a link icon) (`LinkMark`, `YourProfile.jsx:47-75`), *+ Add a link* | | **06**, the marks drawn as plate letter tiles (GitHub / LinkedIn keep their own logos — owner 11-08) |
| A35 | Completeness mark + *Use it* (the résumé suggestion) (`ProfileSections.jsx:426-436`) → `POST /api/profile/sections/use-resume` | | the stats strip's *COMPLETE n / m* cell (tap = the first empty section); *Use it* under the source line |
| A36 | **Behind your profile** — folded, *Only you · used to apply and to rank your jobs · never public* (`YourProfile.jsx:657-679`), one row at a time (`BehindRow`) | A153 | **08 · The sealed pages** (drawing: the lock emblem) — the same six folded rows as plate rows, one open at a time |
| A37 | ↳ **Contact details for application forms** → `ProfilePanel section="about"` (Personal: Full name, Email, Phone, LinkedIn URL, GitHub URL; Address: street, apt, city, state, ZIP, country; Visa / immigration status; Application extras: website, portfolio, current title, current company, years, desired salary + currency, start date) (`panels/ProfilePanel.jsx:853-1062`) → `GET/POST /api/profile` | | 08 row 1, the same fields as `LabelledField`s; the save bar stays at its foot |
| A38 | ↳ **Fill from your résumé…** — proposed values with *from:* lines, ticked if empty, *Fill the ticked fields* / *Close* (`ProfilePanel.jsx:857-905`) | A33, never auto-accepted | 08 row 1, unchanged behaviour |
| A39 | ↳ The save bar *Unsaved changes* / *Save* (`ProfilePanel.jsx:1560-1575`) | | 08 row 1's foot |
| A40 | ↳ **Application defaults** (status + defaults: a select or text per key, *not set* allowed, the rule line) (`ProfileSections.jsx:251-281`, `:565-580`) → `PUT /api/profile/defaults/:key` | | 08 row 2 |
| A41 | ↳ **Base résumés and job profiles** → `ProfilePanel section="resumes"`: switch job profile select, *Manage* → `/app/job-profiles`, profile name / family / domain key / target titles / keywords / verbs / tools + *Save profile settings*, *Upload / Replace PDF*, *Save résumé*, *Refresh signals*, the base résumé text, **Enhance Base Resume** (ATS suggestions ≥ threshold) + preview *Adopt*, citizenship / work authorisation / clearance / degree, titles + years, keywords, skills / tools, ATS suggested skills (add / remove), search terms + *Save signals*; *Refine your job profile* prompt (`ProfilePanel.jsx:1152-1555`; `components/RefineJobProfile.jsx`) → `/api/domain-profiles/*` (base-resume, signals, signals/refresh, enhance, enhance-status, enhancement-history, adopt-enhanced, suggestions, activate) | | 08 row 3 (the same editors); *Manage* → the Job profiles page (`jobprofiles.md`) |
| A42 | ↳ **Skills and keywords that rank your board** — the skills list editor (*Edit your skills (n)*, Atlas links) + **RankingTerms** (term · weight · source, *Remove*, *Put back*) (`ProfileSections.jsx:546-563`, `ResumeSetup.jsx:49-71`) → `PUT /api/profile/sections/skills`, `GET/PUT /api/domain-profiles/:id/keywords` | D186-4 | 08 row 4 |
| A43 | ↳ **How your résumés are tailored** → `AccountPanel only=["tailoring"]` — the model choice, *Save descriptions* (gists), *Save courses* (`AccountPanel.jsx:252-324`) → `GET/PUT /api/settings/tailoring-model`, `/api/profile/gists`, `/api/profile/coursework` | D123 | 08 row 5 |
| A44 | ↳ **Proof page** — handle, *Turn on* / *Turn off* (`ProofPageSetting`, `ProfileSections.jsx:146-190`) → `GET/PUT /api/profile/proof-page` | | 08 row 6 (see the unclear list: it overlaps the passport's own public page) |
| A45 | Loading line *Loading your profile…* / error (`YourProfile.jsx:617`) | | `plateState` loading skeleton / `ErrorLine` with *Try again* |

### 3 · Saved answers (`answers`) — `ProfilePage.jsx:195-203`

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| S1 | Head *Saved answers · Answered once, used every time* + the never-makes-up line | | the view's one plain line (D200 Rule 3) *Answers on file* + that sentence |
| S2 | **Custom answers** (`ProfilePanel section="answers"`, `:1064-1150`): each question, its answer, rename, *Delete*, **company overrides** (`CompanyOverrides`, `:205-283`, needs-own-words), **CustomAnswerAdder** (Question / Answer + add) | saved with the Profile save → `POST /api/profile` | a `Gazetteer` of the answers (QUESTION · ANSWER · FOR · UPDATED); a row opens its editor below it (overrides kept) |
| S3 | **The bank** (`panels/SavedAnswersPanel.jsx`) — *Review due* line + **Still right** (`:31-36`, `:136`) → `POST /api/saved-answers/review` | | a clay-tint `Ticket` above the index when a review is due (the panel's one clay point) |
| S4 | *Remembered on application pages* — lifecycle rows: answer, history (*History (n)*), *You are attesting to this*, **Edit** → *Save and remember*, **Delete** (`:140-192`) → `PUT/DELETE /api/saved-answers/lifecycle/:id` | | the index's second group (mono group label *REMEMBERED ON PAGES*) |
| S5 | **Test a question** — question + employer, *Test* → which answer fills it and why, or that it stops (`:195-212`) → `POST /api/saved-answers/test` | | **the panel's operable model**: a `QuestionTicket` (kind text) whose answer area shows the match and the reason (`aria-live`) |
| S6 | **Add**, **Export JSON**, **Export CSV** (`:217-222`) | download | the panel's actions row |
| S7 | Add / edit form (Question, Your answer, *Save*, *Cancel*) + per-entry *Edit* / *Delete* (`:224-252`) → `PUT/DELETE /api/saved-answers` | | inline under the index row |
| S8 | **Import** — paste, *Check*, *Import* (accepted / rejected lines) (`:255-280`) → `POST /api/saved-answers/import` | | the actions row's *Import*, opening a `pl-textarea` + *Check* / *Import* |
| S9 | Empty line *Nothing saved yet. Answers you give in Home with "Save this answer for next time" ticked appear here.* | | the `plateState` empty drawer, same words |
| S10 | **Credit draft** — *When an application asks How did you hear about us?, answer draft* (switch, only for jobs found on draft) (`CreditDraftChoice`, `ProfilePage.jsx:53-66`) → `GET/PUT /api/profile/credit-draft` | D185-7 | the panel's foot, a plate switch row |

### 4 · Auto-apply (`autoapply`) — `ProfilePage.jsx:68-93` + `components/AutoSettingsDrawer.jsx` inline

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| U1 | Head *How draft applies for you · every change is saved as you make it* | | one plain line |
| U2 | Mode *Ask me first* / *Apply for me* (locked, with the reason) (`AutoSettingsDrawer.jsx:233-240`; `chooseAsk` `ProfilePage.jsx:76-80`) | the tracker's own mode | two plate buttons `aria-pressed`, the lock reason under them (the same handlers as the ledger's run card — `ledger.md` §2) |
| U3 | Fold **When** — run times (remove, add `type=time`, *Add a time*), the zone (`:244-266`) | `PUT /api/apply/auto-settings` | a plate fold row (folds = binder-tab-like rows: title · value · *Done*) |
| U4 | Fold **How many** — daily cap − / + (`:268-275`) | | fold row |
| U5 | Fold **Which jobs** — stale reposts, days open, per-company limit, job profile select, the *Never sent automatically* promises (`:277-330`) | `GET /api/domain-profiles` | fold row |
| U6 | Fold **Before sending** — check each form yourself (`:331-350`) | | fold row |
| U7 | Fold **Salary** — mode radios, amount, preset, when no range, floor (`:351-410`) | | fold row |
| U8 | Fold **Tell me** — picks notifications per channel (`:411-424`) → `GET /api/notify/settings`, `PUT /api/notify/prefs` | | fold row |
| U9 | Fold **Pausing** — *Pause now* (the safety stop) + *Stop everything* promises (`:425-438`) | | fold row; *Pause now* keeps its ink weight |
| U10 | Fold **Accounts** — portals: remove, accounts made, create one (`Accounts`, `:485-572`) → `GET /api/portals`, `DELETE /api/portals/:id`, `…/accounts/:id`, `POST /api/portals/accounts`, `GET /api/gmail/status` | | fold row (the same list Connections shows — C5) |
| U11 | Fold **View** — table / sheet (`:447-457`) | the ledger's list view | fold row |
| U12 | *Today: n sent of cap · Details* limits (`:462-480`) | | the stats strip *SENT TODAY · CAP · NEXT RUN* (each cell opens its fold) |
| U13 | The drawer's *Close* (`:226`) | meaningless inline | dropped inline (the drawer keeps it where it is a drawer — the ledger) |

### 5 · Connections (`connections`) — `ProfilePage.jsx:97-129`

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| C1 | Head *What draft is connected to · Each one says what draft does with it* | | one plain line |
| C2 | **Browser extension** — *Connected on this computer / Installed, not signed in / Not installed*, *About it* / *Get it* (`:105-109`, `useExtensionStatus`) | | a `Gazetteer` row per connection: NAME · STATE (a status word) · WHAT IT DOES · action |
| C3 | **Android app** — *Sites you connect from the draft app show under Managed portals below* (`:110-114`) | | a row (state word *see Managed portals*) |
| C4 | **Gmail** — Connect / Reconnect / Disconnect, what it reads, the weekly reconnect note (`components/ApplicationInbox.jsx:27-99`) → `GET /api/gmail/status`, `/api/gmail/connect`, `POST /api/gmail/disconnect` | D112 | a row; the *what it reads* sentence under it |
| C5 | **Managed portals** — sealed sessions + accounts draft made (`PortalAccounts`, `AutoSettingsDrawer.jsx:573`) | D100 / D158 | a row group *MANAGED PORTALS* |
| C6 | **Integrations** (`panels/IntegrationsPanel.jsx` embedded): *Connected apps* (BYOM: on/off, connections, *Disconnect*, *Open ChatGPT/Claude…*, *Copy the plugin link*) → `/api/byom*`; *LinkedIn Profile Import* (Connect / Disconnect) → `/api/integrations/*`; *Job Feed*; *Form Learning* consent switch → `/api/apply/form-schema/consent`; *Resume and Profile* status | | rows in the same index, each with its own action |
| C7 | **Warm paths** — *Upload Connections.csv*, school + *Upload alumni list*, per-source *Delete*, *Delete all my contacts* (`components/WarmPathsSettings.jsx`) → `/api/warm-paths*` | D138 (only you see them) | a row group *WARM PATHS* |

### 6 · The settings panels Profile mounts (inventoried in `settings.md`)

| # | Panel | Home |
| --- | --- | --- |
| X1 | Appearance = `panels/CustomisePanel.jsx` (⛔ retained exactly, owner 11-06) | More → Appearance — `settings.md` §2 |
| X2 | Notifications = Account's *Product news* + `NotificationSettings` | More → Notifications — `settings.md` §3 |
| X3 | Privacy and your data = Account's *Your data*, *Delete account* + `AssistantPrivacy` | More → Privacy — `settings.md` §4 |
| X4 | Account = profile picture + name, email, plan, security, sessions, merge, allowance, help, sign out | More → Account — `settings.md` §5 |

### 7 · The public page `/in/<handle>` (server-rendered, `routes/publicProfile.js`)

| # | Element (file:line) | What it does today | Home (M2) |
| --- | --- | --- | --- |
| H1 | `GET /in/:handle` (`:210-221`) → `publicViewFor` → `renderPublicProfile` (`:157-194`) | the visitor's view, decided on the server (`services/profilePage.js viewFor`) | unchanged route; the HTML wears the plate tokens (server CSS, no React) |
| H2 | **noindex by default** — `<meta robots noindex>` + `X-Robots-Tag` unless *Let search engines find it* (`:7`, `:77`, `:215`) | | unchanged |
| H3 | Private page → *This profile is private · Its owner has not made it public* (`:158-161`) | | an *Off the map* plate (D197 #22's look) with the same words |
| H4 | 404 for an unknown handle (`:208`, `:214`) | noindex | unchanged |
| H5 | Top bar *draft · Jobs · Atlas · Sign in · Get started* (`:110`) | | the signed-out top bar (D196 phone/top bar, `/draft` wordmark) |
| H6 | Header: cover, photo (`/in/:handle/photo`, `:223-233`, no-store, CSP) or letter, name, headline, location, open-to-work, *Share: draft.work/in/…* (`:166-173`) | | `PassportIdentity` drawn as static HTML (the same anatomy) |
| H7 | *Connect on draft* · *Message* (when the viewer is signed in, D180) (`:174`) | | the identity page's actions |
| H8 | Sections About, Experience (logos, company link → its survey sheet, the company's stack line), Skills (*Proven on draft* / *Also lists* + the proven note), Where they fit, Projects, Achievements, Education, Links (`:176-189`) | only what the server allows | the same sections in the same order, each a plate card; Skills as the stamps |
| H9 | *Not shown to the public* card (`:190`) | says what is withheld | the sealed-pages card, closed (lock emblem) |
| H10 | **Report this profile** — reason + details form → `POST /in/:handle/report` (rate-limited, *Thank you* / *several reports today*) (`:130-146`, `:235-248`) | moderation | a `Ticket` at the foot (*REPORT · this profile*), the form opening under it |
| H11 | Admin: `GET /api/admin/profile-reports`, `POST /api/admin/profile-reports/:id` (`:251-262`) | | Admin (D197 #21) — unchanged |

---

## M2 · the brief (the design doc's *The page recipe*)

**Atlas name: *Your passport*** (D197 #9's proposal). A passport is the document a traveller carries across every border on the
map: who you are, where you may go, and the stamps you earned. Its parts:

| Part | Is | Today's piece |
| --- | --- | --- |
| **The identity page** | photo, name, headline, the mono fields (HANDLE · FITS · LOCATION · YEARS), the open-to-work line | the header (A6–A16) |
| **The visa page** | who may read the passport — Only you · Connections · Public; each page's own eye | Who can see (A2–A5) |
| **Stamps** | one per skill you proved in Atlas (green, dated, *how*); a dashed *not yet* tile per résumé skill | Skills (A27) |
| **The road so far** | experience as a route of employers | Experience (A24) |
| **Where you fit** | your bearing on the market's map | A28–A30 |
| **The sealed pages** | the back of the book: never public, used to apply | Behind your profile (A36–A44) |
| **Answers on file** | Saved answers | §3 |
| **Standing orders** *(working name; the view label stays the plain "Auto-apply")* | how draft applies for you | §4 |
| **Connections** | what the passport is linked to | §5 |

- **Palette — Region V (Security & money, `#6A3E73`, tint `#F4EDF5`).** A passport is an identity document and its first
  job is privacy; V's emblem is the lock. ✅ V's 10-step ramp is built (47k): `--pl-v-0…9` in `styles/plate.css`, listed in
  the design doc's ramp table (#6A3E73 at step 7). Green = proven stamps only.
- **The one clay point:** the passport's **next stamp** — a waypoint ticket *YOUR NEXT STAMP · Prove TypeScript · 5 min*
  (the top unproven résumé skill → Atlas). While *What changed* (A21) or *the four things* (A22) is open, the clay moves to
  it instead (still one per screen).
- **Nav:** the D196 area nav (no pill — the area has no panel), views *Your passport · Saved answers · Auto-apply ·
  Connections*, More = the four settings panels; search *Search your passport…* (sections, answers); the chip = the stamps
  chip (*3 STAMPS*). Profile stays in the dock only (no avatar in the area nav — the addendum).
- **Hero plate:** **drawing to come — *the passport, open at its identity page*** (a 640 / 520 plate: the open booklet,
  the photo square, the mono fields as printed lines, three stamps fanned on the facing visa page, one beacon on the visa
  stamp that says who can see it). Beside it: the name as the 82 px serif title (the person's page is a destination,
  D200 Rule 3), the headline as the lead, a stats strip **PROVEN · FROM YOUR RÉSUMÉ · SECTIONS SHOWN · COMPLETE n / m**
  (each cell answers — D200 Rule 2: it jumps to its section), and the actions *View as the public · Share link · Edit*.
- **Sections, each one drawing:**

| # | Section | Drawing |
| --- | --- | --- |
| 01 | **Who can see it** (the visa page) | `PlaceHazardSeal` relabelled: *your page behind a sealed door; connections and the public wait outside until you open it* (existing) |
| 02 | **About** | drawing needed — *a field-book page with a pencilled summary* |
| 03 | **The road so far** (experience) | drawing needed — *employers as stops on a route, the current one beaconed* (`RouteLine` is its model) |
| 04 | **Stamps** (skills) | `CompassDial` — proven of listed (existing) |
| 05 | **Where you fit** | `MarketSurveyPlate` — *you are here* in your sector (existing) |
| 06 | **Work you can show** (projects, achievements, links) | drawing needed — *a specimen drawer of projects* |
| 07 | **Schooling** (education) | drawing needed — *a schoolhouse on the ground strip* |
| 08 | **The sealed pages** (behind your profile) | `RegionEmblem kind="lock"` (Region V, existing) |

- **The one operable model:** **the visa switch** — *Only you · Connections · Public*, with *View as the public* flipping the
  whole passport to the server's public face; a caption says *Seen by the public: 6 sections shown, 2 sealed* (`aria-live`).
  Saved answers' own model is *Test a question* (S5); Auto-apply's is the fold set.
- **Squares:** the stamps — a stamp is a lit square (proof, never progress); the dashed tiles are *not yet*. No other squares.
- **Onward tickets:** *Your next stamp* (→ Atlas, Your survey) · *Your public page* (→ `/in/<handle>`, only when public) ·
  *Job profiles* (→ `/app/job-profiles`, `jobprofiles.md`).
- **New library pieces** (all in `plate/Person.jsx`, styles `plate/person.css`, each in `plate/registry.js` with its states):
  `PassportIdentity` · `VisibilityControl` · `PassportStamps` · `LabelledField` · `SettingsSheet` · `DrawingToCome`
  (the last three are shared with `settings.md` / `onboarding.md`).
- **Every M1 row's home** is the right-hand column of §1–§7 above.

## M3 · the mock

`pages/dev/platePages/Profile.jsx` (`Profile` → `ProfileMock({ width })`), fixture person *Maya Chen* (synthetic, the
gallery's), Region V. It shows the area nav, the hero (the drawing-to-come plate + `PassportIdentity` + stats), the visa
switch working (Only you · Connections · Public, the consent card on widening, *View as the public* flipping sections),
the stamps, the road so far, where you fit, the sealed pages (folded rows), and the onward tickets — at 1280 and 390.

## Unclear homes (for the owner)

- **A44 Proof page vs the passport's public page.** Two public pages exist: the D183 profile (`/in/<handle>`) and the older
  Atlas proof page (`ProofPageSetting`, its own handle + on/off). The brief keeps both rows in *the sealed pages*; the owner
  may want the proof page folded into the passport's stamps.
- **U13 the drawer's Close** inline does nothing; dropped inline only — confirm.
- **P4 the four settings panels under More** — D197 puts them in #17 with plain names; the owner may prefer them as their
  own area (a gear) rather than inside the passport's nav.
- **C3 Android app** has no state of its own (a sentence) — keep the row or fold it into Managed portals?

## M5 · What was built (47m, lane person + the coordinator — the 47n record)

- **D197 #9 Your passport** (`pages/profile/YourProfile.jsx`, `ProfilePage.jsx`, `plate/personPages.css`): the hero with
  the ported passport drawing (`PassportIdentityPage` / `PassportRoad` take the person's data as props), the four answering
  stats, your next stamp, 01 the visa page with every section's eye, 02–08 with their drawings, the proof page folded into
  the stamps; the passport's area nav in the shell (the stamps chip). The kicker reads *HOW DRAFT APPLIES* (D6).
- **Retired:** `PlaceNav`, `ProfilePage.css`, `YourProfile.css`.
- ⭐ Agent's pick — the page keeps the plate's centred measure (named in d163).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

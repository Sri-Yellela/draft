# D197 Wave 1 · #4 — THE SURVEY SHEET (the company page) · M1 feature inventory

Read from the code on 2026-11-25 (47h, lane *ledger*, from local `main` `01684fd2`). Paths are under `client/src/`. The page
is `pages/companies/CompanyPage.jsx` (254 lines), at `/app/companies/<slug>` inside the shell (`App.jsx:806`, `inApp`) and
public at `/companies/<slug>` (`App.jsx:872-880`, the marketing nav above it). ONE read: `GET /api/public/companies/:slug`
(`services/companies/publicCompany.js`); signed in also `GET /api/companies/:slug/match` (Your match + following) and
`GET /api/network/status`. The board is `Survey` on the approved canvas (`docs/sketches/final/project/Survey.dc.html`).
D200 Rule 1: element · what it DID · where it does that NOW. D200 Rule 2: every mark answers.

A destination, not a working page (D200 Rule 3): the survey sheet keeps the big serif title (86 px, the company's name).

**The stack legend is live data** (D200 Rule 2): `stackFor()` (`services/companies/companyTech.js`, table `company_tech`,
≥ 2 postings in 180 days, each technology with its evidence count) + your marks from `/match` (proven / listed). Not
`company_technographics` (the old table — 47h's check).

## Today's page, row by row

| ☑ | Element | What it did | file:line | Where it does that now (`plate/SurveySheet.jsx`) |
| --- | --- | --- | --- | --- |
| ☑ | ‹ Back `data-company-back` (in the shell) | returns to where you were | CompanyPage.jsx:67 | the breadcrumb's first link *‹ BACK* (same `navigate(-1)`), then *MKT / <SECTOR> / <COMPANY>* |
| ☑ | Logo (`CompanyLogo`, D61) | the company's mark | :70 | the 76 px tile beside the title (the logo when there is one, else the letter on its sector colour) |
| ☑ | Name `<h1>` | | :72 | the 86 px serif title with the clay stop |
| ☑ | Facts line: industry · HQ · domain · N open jobs · hires through <ATS> | at a glance | :73-76 | the kicker row *SURVEY SHEET · <INDUSTRY> · <HQ> · HIRES THROUGH <ATS>* + the stats strip (*OPEN ROLES · PEOPLE · FOUNDED · H-1B FY*) — each cell answers: open roles → the market at this company; H-1B → section 03; people / founded → their source (Wikidata) |
| ☑ | *part of <parent>* link | the parent company's page | :77 | in the kicker row, a link |
| ☑ | Follow / Following `data-company-follow` (signed in) | `POST /api/companies/:slug/follow` | :80-84 | the ink *Follow* button (same call, `aria-pressed`) |
| ☑ | Careers site ↗ | the employer's board | :85 | *Careers site ↗* beside Follow |
| ☑ | About `data-company-about` (one line + *From public facts: Wikidata*) | who they are, sourced | :88-94 | the lead under the title + *Written by draft from public facts · <domain> · Wikidata · Suggest a correction* |
| ☑ | Tech stack `data-company-stack` by group, each: name, *new this quarter*, your mark (proven / on your résumé), *Learn it* (Atlas), *in N of M postings · last seen … · teams* | the stack with evidence | :96-117 | **01 · What they build with**: the legend — per group a column, per technology the square (■ on your résumé / proven, ⬚ not yet — signed out: no square claim, the legend says *sign in to see yours*), the name (→ its Atlas page when it has one), the evidence bar (postings / M), *in N of M postings · teams*, *NEW THIS QUARTER* (a button that says when it was first seen), *last seen* in the row's title |
| ☑ | On GitHub `data-company-github` | languages by repos + the org link | :119-125 | the legend's foot *PUBLIC GITHUB*: the share bar + *Go 61 % · …*, the org link |
| ☑ | From their website `data-company-website` | light homepage signals, labelled | :127-133 | a second foot row *THEIR WEBSITE · …* (labelled: what the site runs on) |
| ☑ | Your match `data-company-match` (proven N of top M, listed, missing → Atlas, *check and prove your skills*) | your fit with their stack | :135-145 | **04 · N of their top M**: the compass dial (lit ticks = on your résumé), *N of M · OF THEIR TOP TECHNOLOGIES*, the named ones; the missing ones with an Atlas page as ⇄ interchange tickets *Learn it →*; *Check and prove your skills →* kept as the section's link |
| ☑ | What they ask for most `data-company-asked` (top 6 by share, Learn it) | the most-posted technologies | :147-159 | folded into 01 (the legend is sorted by evidence within each group and the bar IS the share); the top six's share is each row's *N of M* |
| ☑ | Open jobs by role `data-company-roles` (category → the market filtered; subcategories with counts) | where the openings sit | :161-175 | **02**'s line figure *THE <COMPANY> LINE · N OPEN, BY ROLE*: one stop per role (its count in the stop), each stop a link to the market filtered to it; the foot *N open in <your stop>* + *See them on the market →* |
| ☑ | Hiring trend `data-company-trend` (six months of bars) | new postings per month | :177-190 | **02 · <Climbing / Holding steady / Slowing>**: the elevation profile (area + line + each month's number, the flag on the latest), *+N % SINCE <MONTH>* |
| ☑ | Visa sponsorship `data-company-sponsorship` (the text, *not a promise*, the DOL source + through) | past filings | :192-198 | **03 · They have sponsored before / No filings found**: the strip (certified LCAs FY · median wage · USCIS approvals · approved %), the *SPONSORED · FY25* stamp (a button → the source), the source line and *not a promise to sponsor you* |
| ☑ | Where they're hiring `data-company-locations` | top locations with counts | :200-205 | 02's foot line *WHERE · Boston (12) · Remote (8) …* |
| ☑ | The job you opened `data-company-focus` (+ Apply at ↗) | came from a posting (`?job=`) | :209-215 | **05**'s first ticket *THE JOB YOU OPENED* with its Apply link (else *NEWEST OPENING HERE*) |
| ☑ | Works here → Ask for a referral (`WorksHere`, network on) | a connection at the company | :216 | **05**: `WorksHere` under the tickets (its own component, unchanged) |
| ☑ | Newest open jobs `data-company-jobs` (title link, location, Apply ↗ (A157), Send (network on), `SendJobPicker`) | the openings themselves | :217-229 | **02**'s register of the newest openings under the figures (title → the posting, where, *Apply ↗*, *Send*); *All N open jobs →* |
| ☑ | Correction / removal footer | ask to fix or remove the page | :232-234 | **05**'s ticket *IS THIS YOUR COMPANY? · Correct or remove this sheet · Request a change →* (same `/contact?topic=company&company=<slug>`) |
| ☑ | Missing company / failed / loading states | | :58-60 | the plate's empty / error (Try again) / loading states, same words |

## Disagreements and gaps (board vs data; the data's truth kept, the look followed)

1. **The hero plate (the team diorama)** draws three teams with a beacon on yours. The data has teams only per technology
   (`company_tech.teams_json`): the build draws the board's isometric plate with the three teams the postings name most
   (the callouts: *LARGEST TEAM* + its open count and top technologies; *YOU'D JOIN HERE* only when a focus / best job names a
   team). A company with no team names gets the plate with *NO TEAMS NAMED IN THEIR POSTINGS*.
2. **Sponsorship cells.** The board's *H-1B APPLICATIONS · FOR SOFTWARE ROLES · CERTIFIED % · PERM* and *MOST FILED TITLES* are
   not in our records; `sponsorshipFactFor` has certified LCAs (FY), the median wage, and USCIS approvals / denials. The strip
   shows those (each cell names its source); the titles list is not drawn.
3. **Section 04's title** is written from the numbers (*Four of their top twelve*); signed out the section says *Sign in to
   see your match* (today: hidden).
4. **The best opening here · 91 % MATCH** needs a per-company best-match read we don't have; the ticket is the job you opened,
   else the newest opening (no %).
5. **The referral ticket** (*Ask Divya for a referral*) is `WorksHere`'s own UI, kept whole.

## Built (47h, lane *ledger*)

`plate/SurveySheet.jsx` (draws) · `plate/surveySheet.js` (pure model of the read) · `plate/surveyDrawings.jsx` (the team
plate, the elevation profile, the line of roles, the dial — drawn from the data) · `plate/Marks.jsx` `Legend` (rebuilt to the
final board) · `pages/companies/CompanyPage.jsx` (the reads; `?plate=0` keeps the classic page) · `services/companies/
publicCompany.js` `focusJob` (+ the subcategory, for your stop on the line) · F5 pairs `survey-*`.

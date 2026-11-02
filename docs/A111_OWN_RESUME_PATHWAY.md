# A111 · The trial's "Use my own résumé" pathway — every professional field, end to end

**Raised 2026-11-02 (44g) on the owner's word:** *"im trying to open up the upload resume path for the trial cause people
would be more hands on and interested in it but for that we need to expand the job postings beyond cs and eng into other
professional fields, have proper ats and atlas material to properly map their role against their resume. this way they get
a proper idea as to what is being offered … when it works we can add the pathway to the trial. it should work end to end."*

Builds on D124 (the trial), D127 (every professional role, one category, leak rate 0), D126 P3 (the scorer's engineering
vocabulary), D116 (Your map) and the 11-01 demonstration (`services/trialDemo.js`). It **reverses nothing**: the owner's
*"omit own resumes entirely for the tour"* (11-01) stays in force on `/try` until the owner switches the pathway on.

## ⛔ Constraints

- **The deploy freeze holds** (testers are on `f177b99`+). Everything is LOCAL; nothing is pushed; production is not touched.
  Adding employers on production, switching the pathway on, and pushing are the owner's (O-rows below).
- **Behind a switch, off by default:** app setting `trial_own_resume` (Admin → Trial, a toggle). Off → `/try` is exactly
  today's sample-only page and `POST /api/trial/resume {choice:"own"}` answers 409 `own_resume_off`.
- **No model** in the trial's pathway (D17 / the demonstration's rule): scoring is the local ATS, tailoring is simulated.
- **D127's red-flag rule:** a résumé whose field is held or unknown gets an honest *"your field isn't live yet"* — never another
  category's picks. A pick is never a held posting.
- **Synthetic people only** in fixtures, walks and screenshots.

## The pathway (what "end to end" means)

1. **Upload** on `/try`: PDF, DOCX or pasted text (the existing résumé upload / `POST /api/domain-profiles/from-resume`
   onboarding) → a job profile with its category (`profileCategory`) and seniority.
2. **Your field, honestly:** the category in plain words (*"Business & finance · analyst"*). If it is held / unknown, or the
   category has < 10 good picks today: the honest line + *"Try a sample instead"* — the samples still offered.
3. **10 picks from the résumé's own category**, each card with the score ring + why chips (matched / missing skills — the same
   reading as the board and the samples, one scorer), best first.
4. **What's on offer, mapped to you** (the new piece): opening a pick shows the role against the résumé —
   the ATS report (matched, missing, the level line) **and the Atlas reading for that role** (its top required skills from the
   board: *"you cover 9 of this role's top 15"*, have / missing, the next-level skills, the role page link).
5. **Draft 2** → the demonstration runs on the tester's OWN résumé: the simulated tailored version beside their original
   (only terms the résumé already has — tailoring never adds a skill), the practice form filled from the résumé's own contact
   lines, Sent, the confirmation in the Inbox, The Table shows both Sent.
6. **The survey** → explore view-only, exactly as the sample path.

## Parts (lanes)

| Part | What | Done when |
|---|---|---|
| **P1 · Sources** (D127 P2) | Probe public boards (Greenhouse / Lever / Ashby / Workday / SmartRecruiters) for ≈ 100 employers across industries that hire business, finance, management, marketing, sales, legal, design / media and science professionals; write `data/a111/approve-me.json` + a tranche script in the shape of `data/d126/`. Crawl them into a **copy** of the local DB and measure good picks per category. | the per-category pick counts measured; production untouched |
| **P2 · ATS vocabulary** (D127 P3, after D126 P3) | Registry domains for every live category (business / finance / accounting / consulting / business analysis, management / operations / project / product, marketing, sales, legal, arts & media / communications / design, science / research), O*NET-seeded tools + named practices, generic words removed so computing scores do not move. The three copies identical; `@draft/ats-scorer` 1.4.0; checksums. | a posting of each category scores against a résumé of that category (not declined); computing's graded-corpus ρ unchanged |
| **P3 · Atlas material** | Atlas seeds every category's registry domains (not only `CS_DOMAINS`), families per category in `content/atlas/families.json`, non-CS role pages publish on board data (D105 P12), and `GET /api/atlas/me` + a new per-role reading work for a non-CS résumé. | a business-analyst résumé gets have / missing / next-level / branches from real nodes |
| **P4 · The pathway** | Steps 1–6 above behind `trial_own_resume`; the demonstration keyed per user × posting for an own résumé; the role-vs-résumé panel; Admin → Trial toggle; tests; a real-Chrome walk (desktop + phone) with two synthetic non-CS résumés. | the walk passes with the switch on; with it off `/try` is byte-for-byte today's behaviour |

## Tests (named)

`a111OwnResumeOffByDefault` · `a111OwnResumeHonestFieldNotLive` · `a111OwnPicksOwnCategoryOnly` · `a111OwnPickShowsScoreAndWhy` ·
`a111RoleAgainstResume` · `a111DemoTailorsOwnResume` (never adds a skill) · `a111DemoFormFromOwnResume` · `a111TableShowsBothSent` ·
`a111ProfessionalVocabularyScores` · `a111ComputingScoresUnchanged` · `a111AtlasSeedsEveryCategory` · `a111AtlasMeNonCs`.

## ⛔ The owner's (O-rows; the agent does not do these)

1. Approve `data/a111/approve-me.json` and run its tranche on production (after the freeze).
2. Push (draft, then the tools service's re-vendored scorer if changed).
3. Switch `trial_own_resume` on in Admin → Trial once he has walked it.

## Status

See the A111 entry in `docs/WORKLOG.md` NOW (updated as each part lands).

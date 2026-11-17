# D164 T1 — every action the posting and the deck card had before D145, and where it lives now

**Before** = `529dad8c` (A115), the parent of `3877b140` (D145 Step 3, the first restyle commit that changed a
screen — D145 Step 1, `b71f7892`, was a read-only audit). **Now** = `42026160` (local `main`, this branch's base),
before D164 T2. Line numbers are at those commits. `test/d164NoActionLost.test.js` is this table as a checklist
(every row's "now" anchor must still be in the source).

Surfaces: **JDP** = `client/src/components/JobDetailPanel.jsx` (the opened posting; since D156 (1c) it is the deck
card's long post, portalled into `DECK_POST_SLOT_ID`), **Deck** = `client/src/panels/DeckView.jsx`,
**Bubble** = `client/src/components/JobBubble.jsx` (the board's card), **TopBar** = `client/src/components/TopBar.jsx`.

## The posting (JobDetailPanel)

| Action | Before (file:line @529dad8c) | Now (file:line @42026160) |
|---|---|---|
| Pass | JDP:138 (`PassButton`, row A; square in row B :160) | JDP:156 `data-decision="pass"` — main row |
| Save | JDP:139 (`SaveButton`) | JDP:162 `data-decision="save"` — main row |
| Draft (starts the Ask-me-first pipeline: `POST /api/apply/runs`, parked for review) | JDP:140 (`DraftButton logo`) | JDP:172 `data-decision="draft"` — main row |
| Résumé — generate for this job without drafting (`onGenerate(false)` → `POST /api/generate`) | JDP:142–147 (`Résumé`, BYOM split or DepthButton) | JDP:183–188 `data-more="resume"` — **folded under More** |
| View / preview-edit the résumé (`onViewSandbox` → `panels/SandboxPanel.jsx`) | JDP:149 (`View`) | JDP:190 `data-more="view"` — **folded under More** |
| Download the résumé as PDF (`onExport` → `printResume`) | JDP:150 (`Download`) | JDP:191 `data-more="download"` — **folded under More** |
| Download as HTML | not on the posting — only inside the sandbox (`SandboxPanel.jsx` `downloadHtml`) | the same: sandbox only (`SandboxPanel.jsx:230`) |
| Regenerate (`onRegenerate` → `generate(job, true)`) | JDP:151–155 | JDP:192–196 `data-more="regenerate"` — **folded under More** |
| Cover letter (the ✉ — there is no "email it to me" feature; measured, D147's note) | JDP:157 | JDP:198 `data-more="cover-letter"` — under More |
| "Résumé ready · 2h ago · What we changed" (D57 / D90 P2) | JDP:182 | JDP:210 `data-resume-ready` (only once a résumé exists) |
| Bring-your-own-model status (D86) | JDP:184 `<ByomStatus>` | JDP:212 |
| I submitted it / I applied myself (D56) | JDP:187 `<ManualSubmitted>` | JDP:200 — under More |
| Drafts left today (A63) | JDP:189 `data-draft-slots` | JDP:205 under More; JDP:214 when out of drafts |
| "Takes about 10–20 seconds" (D70) | JDP:191 `data-generate-expect` | JDP:202 — under More |
| Company notice before Draft (D54) | JDP:193 | JDP:217 |
| Eligibility notice before Draft (D59) | JDP:196 | JDP:220 |
| The company's hiring data (logo → `CompanyViewModal`) | JDP:334 | JDP:409 `data-company-hiring` |
| The original posting / apply (the company name, A63) | JDP:341 `<CompanyLink>` | JDP:414 |
| The ATS report (the number box) | JDP:343 `<AtsNumberBox>` → the ATS panel beside | JDP:487 the facts box's match → the report inside the posting (D152 (8)) |
| Résumé versions — view / download one (D62) | in the old ATS panel (`AtsReportPanel.jsx`) | JDP:374–375 (inside the match) |
| Close | JDP:345 | JDP:418 `data-posting-close` ("Fold it back" on the deck) |
| Pending · record it | JDP:350 `data-pending-tag` | JDP:422 |
| Retry the description | JDP:409 | JDP:497 |
| Which résumé / job profile to tailor from | not on the posting — TopBar:324 `ProfileSelectorDropdown` (switches the whole board's profile) | not on the posting — TopBar:271 (the Profile panel) |
| Generation state on the posting | "Generating…" on the button only; a failure was shown only in the sandbox | the same — **a failure on the posting falls back to "Résumé for this job"**, i.e. reads as "no résumé" |

## The deck card (DeckView) and the board's card (JobBubble)

| Action | Before (file:line @529dad8c) | Now (file:line @42026160) |
|---|---|---|
| Pass · Save · Draft (and X / S / D, swipe) | Deck:1044–1046 | Deck:1258–1260 |
| Previous / next card | Deck:915, 919 (`StepButton`) | Deck:1224–1225 (`FlipButton`), J / K, wheel |
| Open the posting (expand) | Deck:432 (`deck-detail`) | Deck:369 `data-deck-full-posting` → the long post (JDP in the slot) |
| The ATS report | Deck:174 / 193 / 235 signal → Deck:334 sheet / Deck:1003 aside | Deck:1243 `onSignal` → the match inside the posting |
| The posting ↗ / Full report on the board | Deck:247–248, 273 | Deck:204–205 |
| Order (Dealt / ATS match) | Deck:300 `data-deck-order` | `panels/CustomisePanel.jsx:54` (D149: Settings → Customise) |
| End of deck: drafted today · Draft House · Full House · Undo | Deck:581, 603, 608, 610 | Deck:643, 665, 670, 671 |
| Keyboard shortcuts | Deck:1063 | Deck:1269 |
| Bubble: company profile · Save · Draft | Bubble:83, 110, 119 | Bubble:64, 102, 111 |
| Bubble: ATS square | Bubble:105 | removed by D152 (5); the match is in the opened posting (JDP:487) |

## MISSING (bugs for T2)

No pre-D145 action is gone from the code. What the owner met as "gone":

1. **The résumé controls are folded under "More"** with the cover letter and "I applied myself" — Résumé for this
   job, View, Download and Regenerate are reachable only by opening a control whose name says nothing about a
   résumé. Not discoverable; read as removed. → T2: one quiet **Résumé** control beside Draft.
2. **A failed generation reads as "no résumé" on the posting** (D156 6): `generateActual` (JobsPanel) clears the
   job's loading flag and shows the error only in the sandbox, so the posting draws "Résumé for this job" again;
   and when the profile's résumé text has not loaded, `if (!resumeText) return;` makes the button do nothing.
   → T2: *Generating… · Ready · Failed — Try again*, kept per job.
3. **Which résumé** (base or a job profile) was never on the posting — only the Profile menu's switcher, which
   swaps the whole board. → T2: choose the job profile whose base résumé is tailored, for this posting only.
4. **Download as HTML** was never on the posting (sandbox only). → T2: Download PDF and HTML, one HTML helper.

## After T2 (where the four MISSING items live now)

| Item | Now (file:line, after D164 T2) |
|---|---|
| One quiet **Résumé** control beside Draft (opens in place) | JDP:196 `data-posting-resume-toggle` → the group `data-posting-resume` |
| Which résumé (a job profile's base résumé, this posting only) | JDP:206 `data-resume-source` → `JobsPanel.jsx` `generateFrom` (reads `GET /api/domain-profiles/:id/base-resume`, never switches the board) |
| Résumé for this job · Preview / edit · What we changed · Regenerate · Download PDF · Download HTML | JDP:220, 224, 225, 228, 232, 233 (`data-more="resume" / "view" / "changes" / "regenerate" / "download" / "download-html"`) |
| Generating… · Ready · Failed — Try again | JDP:252–259 `data-resume-state`, from `lib/jobDecisions.js` `resumeControlState`; the failure kept per job in `JobsPanel.jsx` `genFailed` |
| Cover letter · I applied myself · drafts left | JDP:241–247 — under More, as before |

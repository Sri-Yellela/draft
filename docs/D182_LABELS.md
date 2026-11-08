# D182 · labels that restate what's already on the screen — the inventory for the owner's approval

**The rule (owner 11-07):** a label, chip, tag or caption appears only if it tells the person something they can't
already read on that screen. Keep a word only where the value would be ambiguous without it (*86%* needs *match*;
*$165k–$205k* does not need *salary*; *Hybrid* does not need *work mode*).
**Kept by the owner, never a candidate:** the job postings' bubbles and the utility buttons that appear on hover.

**How this list was made (45l, 11-08):** read from the code — each row names the file and line that draws the label.
⚠ No screenshots yet: real-Chrome walks are deferred by the 45l rule (no checks mid-session); they are taken with the
end-of-log runs, before the removal pass. **Nothing is removed until the owner approves.**

**How to approve:** mark each row ✅ (remove) or ❌ (keep). Then one pass removes the ✅ rows and pins them
(`d182UnitLabelsOnlyWhereAmbiguous` — the value cells that keep a word; `d182NoTaxonomyChipsOnCards`).

**⭐ DONE 45n (owner approved 11-08, decision (8)):** every REMOVE row below is removed in ONE commit (so any one can be
put back) — marked ✅ with what was done. The KEEP rows, P3, P5 and J19 are untouched; the carve-outs (the job postings'
bubbles, the hover utility buttons) were not touched by any row. ⚠ UNTESTED (45n: the owner tests; one suite at the end);
the pins named above are not written yet.

## 1 · The jobs page (draft screen)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| J1 | deck card info row — `client/src/lib/deckCardFacts.js:60` (drawn `DeckView.jsx:304`, `:445`) | **$165k–$205k** over *salary* | the value is a money range | ✅ REMOVED *salary* (the info row's `label` field and both cards' grey line gone) |
| J2 | deck card info row — `deckCardFacts.js:61` | **Full-time** over *job type* | the value is the type | ✅ REMOVED *job type* |
| J3 | deck card info row — `deckCardFacts.js:62` | **Hybrid** over *work mode* | the value is the mode (the owner's own example) | ✅ REMOVED *work mode* |
| J4 | deck card stats — `deckCardFacts.js:40` (`level`) | **Senior** over *level* | the value is a level word; the title usually carries it too | ✅ REMOVED *level* (Home card: the caption is screen-reader only, `labelHidden`; the stat is dropped when the title holds the same level word, whole-word match) |
| J5 | deck card stats — `deckCardFacts.js:40` (`experience`) | **5+ yrs** over *experience* | "5+ yrs" alone could be tenure or experience asked | KEEP — ambiguous |
| J6 | deck card stats — `deckCardFacts.js:40` (`posted`) | **3 days** over *since posted* | "3 days" alone means nothing | KEEP — ambiguous |
| J7 | deck card stats — `deckCardFacts.js:102` | **3 of 8** over *skills matched* | "3 of 8" alone means nothing | KEEP — ambiguous |
| J8 | deck card match — `deckCardFacts.js:54` | **86%** over *résumé match* | the owner's own example of a needed word | KEEP |
| J9 | opened posting's facts box — `PostingPanel.jsx:121` (`<dt>`; cells from `shared/postingFacts.js:143`) | **$165k–$205k** under *Salary* | the value is a money range | ✅ REMOVED *Salary* in the opened posting's box (screen-reader label kept, `posting__k--sr`; the deck strip keeps its visible *Salary*, where "not stated" would be ambiguous alone) |
| J10 | opened posting's facts box — `PostingPanel.jsx:121` (`postingFacts.js:140`) | **Hybrid** under *Workstyle* | the value is the mode; the deck strip already hides this label (owner 10-07) | ✅ REMOVED *Workstyle* here too (its `labelHidden` now honoured in the panel; screen-reader label kept) |
| J11 | opened posting's facts box — `postingFacts.js:135` | **5+ years** under *Experience* | as J5 | KEEP — ambiguous |
| J12 | opened posting's facts box — `postingFacts.js:145` | **9 hours ago** under *Posted* | "9 hours ago" alone is ambiguous (posted? seen? checked?) | KEEP |
| J13 | opened posting — `PostingPanel.jsx:198` | *Level* · "this posting reads two steps above its title" | the sentence names the level itself | ✅ REMOVED *Level* |
| J14 | opened posting — `PostingPanel.jsx:173` | *History* · "Reposted 4 times since June" | the sentence is plainly the posting's history | ✅ REMOVED *History* (the line; the panel's facts-box cell keeps its *History* label — not this row) |
| J15 | opened posting — `PostingPanel.jsx:210` | *In short* · the should-I-apply sentence | a caption that only names what follows | ✅ REMOVED *In short* |
| J16 | opened posting — `PostingPanel.jsx:187` | *Hiring?* · "Likely not hiring · Reposted 4 times" | the sentence says it | ✅ REMOVED *Hiring?* |
| J17 | opened posting — `PostingPanel.jsx:232` | *Visa filings* · "Filed 290 certified LCAs in FY2025 …" | "LCAs" / "H-1B" in the sentence say it — but only to someone who knows the words | KEEP — ambiguous to most readers |
| J18 | opened posting — `PostingPanel.jsx:254` | *Travel* · *Relocation* · *Employment* · *Site* · *Req* before each value | values like "Up to 25%", "Yes", "R-10422" mean nothing alone | KEEP — ambiguous |
| J19 | D179 sketch's taxonomy chip (*Software engineering › Backend · Senior*) | not built | the title | NEVER BUILT (owner 11-07) — pinned by `d182NoTaxonomyChipsOnCards` |

## 2 · The pattern behind most of the rest — the eyebrow that repeats the nav

`PlaceHead` / `PanelHead` draw an accent eyebrow over each panel's title, and the nav card beside it already shows the
same name in bold as the current item. In ≈ 20 panels the eyebrow is that nav label word for word. **One change clears
them all:** `PlaceHead` (`components/PlaceNav.jsx:61`) and `PanelHead` (`pages/atlas/AtlasPanels.jsx:34`) stop drawing
an eyebrow equal to the current nav item. Rows marked **(nav)** below are that case.

✅ **DONE 45n:** `PlaceNav` now provides the current item's label and its group's label to its panel (a context in
`components/PlaceNav.jsx`, `useRepeatsNav`); `PlaceHead` and Atlas's `PanelHead` skip an eyebrow equal to either (case-
insensitive). That covers I1 (the group *Coming up*), all of I2, all of P1, A2's two eyebrows, A8 (the group *Explore*),
A9 and A10. The eyebrows that were not word-for-word the nav (A1, A3, A4, A5, A6, A7) and the ones not drawn by these
heads were removed one by one. Admin (X1) got the same idea in `panels/adminKit.jsx` (`AdminSection`).

## 3 · Home (the tracker, the Inbox)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| H1 | `lib/trackerRows.js:43–56` (drawn `components/ApplicationTracker.jsx:170`) | opened-row eyebrows *Ready to send · Sent · Interview · Assessment · No reply · Not applied · Stopped* | the row's status word right above, same words | ✅ REMOVED the seven (`eyebrow: null`; the opened row draws no empty eyebrow). Kept: *Only you can answer this*, *They said no*, *Picked for you*, and the unlisted *Waiting for you · Working on it · In line · You opened it to apply · An offer · Closed* |
| H2 | `lib/heldApplication.js:42` | *Sent* over "Applied to {company}" | the status column + the headline | ✅ REMOVED |
| H3 | `components/AutoSettingsDrawer.jsx:90` | an open fold's eyebrow (*When*, *How many* …) | the fold's own button just above | ✅ REMOVED (+ its CSS). ⚠ Correction: an OPEN fold hides its button (`DraftHouse.css`), so the headline ("At most this many a day" …) now names the fold alone — the owner may want to look |
| H4 | `components/AutoSettingsDrawer.jsx:87` | *When* · 9 AM and 6 PM · *Tell me* · off | "Tell me · off" can't be read without its word | KEEP — ambiguous |
| H5 | `panels/AutoApplyPanel.jsx:1053` | timeline line "Ask me first · runs at 9 AM and 6 PM" | the mode switch on the same screen | ✅ REMOVED the mode words — the line is "Runs at 9 AM and 6 PM", and is not drawn with no run times |
| H6 | `panels/AutoApplyPanel.jsx:1134` | "Every application, from draft to reply." under *Home* | names what the table obviously is | ✅ REMOVED |
| H7 | `components/DraftHouseTree.jsx:98–99` | run card "{day}, {time}" + "Looked at N new postings" | the run line just above (day, time, N looked at · M picked) | ✅ REMOVED (the card's head keeps only its ×; `.dht-card__who` CSS gone) |
| H8 | `components/DraftHouseTree.jsx:106` | "left out: {reason}" on each line | "Picked M, left out K." just above | ✅ REMOVED the "left out:" prefix |
| H9 | `panels/AutoApplyPanel.jsx:1761` | caption *EVERY ATTEMPT AT THIS APPLICATION* | the button just pressed, "Show N attempts" | ✅ REMOVED |
| H10 | `panels/AutoApplyPanelSections.jsx:129` | "One application · N things to resolve" | the card is one application; the big N "to resolve" beside it | ✅ REMOVED (the line keeps "N attempts · date" when known) |
| H11 | `panels/AutoApplyPanelSections.jsx:172` | "one action, N applications" | the big N "unblocked" beside it | ✅ REMOVED |
| H12 | `components/ApplicationInbox.jsx:157` | a category mark on each message (*Interview*, *Rejection*) | "File as [category]" on the same message | ✅ REMOVED the mark (the select and the category filter stay) |

## 4 · Atlas

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| A1 | `pages/atlas/YourRun.jsx:36`, `:45` | *Your run* | (nav) | ✅ REMOVED (both kickers) |
| A2 | `AtlasPage.jsx:409`, `:416` + `YourMap.jsx:225` | *Your map* eyebrow, then an h2 *Your map* a few lines below | (nav) and each other | ✅ REMOVED both — the eyebrows by the general fix, the h2 in `YourMap.jsx` by hand |
| A3 | `AtlasPanels.jsx:154` + `Navigator.jsx:64` | *Your route* eyebrow, then a card heading *Your route* | each other | ✅ REMOVED the eyebrow (Navigator's card heading kept) |
| A4 | `YourSkillsPanel.jsx:157` | *Your skills* | (nav) | ✅ REMOVED (+ `.ysk__eyebrow` CSS) |
| A5 | `LibraryPanel.jsx:75` | *Library* | (nav) | ✅ REMOVED |
| A6 | `AtlasPanels.jsx:169` | "Today's question · picked from your route" | (nav) + the lead says the same | ✅ REMOVED as far as it still exists: the code had moved on (D154, 45l) to *Picked for you · {reason}* or the fallback *Picked from your route*. The fallback is gone; the reason-bearing eyebrow is KEPT — it says why this question was picked, which nothing else on the screen does (H1 keeps *Picked for you* for the same reason) |
| A7 | `AtlasPanels.jsx:221` | *The 3-minute audit* | (nav) *The audit* | ✅ REMOVED (the "Take the 3-minute audit" link still says the 3 minutes) |
| A8 | `AtlasPanels.jsx:247` | *Explore* over *Roles and skills* | the nav group *Explore* and item *Roles and skills* | ✅ REMOVED by the general fix (the group label) |
| A9 | `AtlasPanels.jsx:265` | *This week's market* | (nav) | ✅ REMOVED by the general fix |
| A10 | `AtlasPanels.jsx:335` | *Glossary* | (nav) | ✅ REMOVED by the general fix |
| A11 | `AtlasTree.jsx:103`, `AtlasPage.jsx:292` | *Family* / the kind before a node's name | "Python" or "Data" is ambiguous alone | KEEP |

## 5 · Interview

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| I1 | `pages/interview/InterviewPage.jsx:45` | *Coming up* | the nav group *Coming up* (one item) | ✅ REMOVED by the general fix (the group label) |
| I2 | `InterviewPage.jsx:78, 103, 170, 218, 226, 231, 239, 245` | *Company guides · Tracks by round · Debrief · Mock interview · Ask the coach · Drills · Defend your résumé · Past sessions* | (nav), word for word | ✅ REMOVED all 8 by the general fix |
| I3 | `InterviewPage.jsx:81` | "Company guides are not built yet —" | the title "Guides are coming" | ✅ REMOVED the clause ("They will be grown from debriefs …") |
| I4 | `InterviewPage.jsx:65` | "From your Inbox: “subject”" on each row | the lead: "Found in your Inbox and matched to your applications." | ✅ REMOVED "From your Inbox:" |
| I5 | `InterviewPage.jsx:63` | *Interview* / *Assessment* on each row | one list holds both | KEEP |

## 6 · Profile

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| P1 | `pages/profile/ProfilePage.jsx:72, 91, 133, 141, 149, 161, 167, 174` | *Auto-apply · Connections · About you · Your résumés · Saved answers · Notifications · Privacy and your data · Account* | (nav), word for word | ✅ REMOVED by the general fix (A140 / D183 had since merged About you + Your résumés into *Your profile*; its eyebrow equals the nav too) |
| P2 | `panels/ProfilePanel.jsx:958` | section *Visa status* around one field *Visa / Immigration Status* | the field's own label | ✅ REMOVED the section title (`PSec`'s title is optional now) |
| P3 | `panels/ProfilePanel.jsx:1039` | *Custom Answers* | separates it from the bank further down | KEEP — rename to say how it differs |
| P4 | `components/ProfileSections.jsx:448` | "linkedin: https://linkedin.com/in/…" | the URL itself | ✅ REMOVED the "{kind}:" prefix (the default link row; a caller's own `renderLink` is unchanged) |
| P5 | `components/PlaceNav.jsx:33` (from Profile / Interview / Atlas) | nav slogans *You and your résumé · Ready for the room · Your way through the market* | not a repeat — a slogan that gives no fact | owner's call |

## 7 · Admin (the obvious cases only)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| X1 | `panels/adminKit.jsx:98` (`Panel` h2 — e.g. Atlas, Admins, Email health, Deployments, Disk and backups) | a panel heading equal to the selected tab above it | the tab (`panels/adminMap.js`) | ✅ REMOVED generically: `AdminPanel` provides the selected tab's label (`AdminSection`, `panels/adminKit.jsx`); a `Panel` whose title equals it draws no h2, its `Help` tip leads the purpose line, and the section keeps the title as its aria-label |
| X2 | `panels/adminEnrichment.jsx:244` | *Enrichment* | the selected tab | ✅ REMOVED (the block keeps it as its aria-label) |

*(Sections 2–7 swept by a read-only search agent and spot-checked by the agent on three rows — A10, H6, I1 — each as reported.)*

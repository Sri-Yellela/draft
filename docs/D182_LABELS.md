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

## 1 · The jobs page (draft screen)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| J1 | deck card info row — `client/src/lib/deckCardFacts.js:60` (drawn `DeckView.jsx:304`, `:445`) | **$165k–$205k** over *salary* | the value is a money range | REMOVE *salary* |
| J2 | deck card info row — `deckCardFacts.js:61` | **Full-time** over *job type* | the value is the type | REMOVE *job type* |
| J3 | deck card info row — `deckCardFacts.js:62` | **Hybrid** over *work mode* | the value is the mode (the owner's own example) | REMOVE *work mode* |
| J4 | deck card stats — `deckCardFacts.js:40` (`level`) | **Senior** over *level* | the value is a level word; the title usually carries it too | REMOVE *level* (and drop the stat when the title already says the same level) |
| J5 | deck card stats — `deckCardFacts.js:40` (`experience`) | **5+ yrs** over *experience* | "5+ yrs" alone could be tenure or experience asked | KEEP — ambiguous |
| J6 | deck card stats — `deckCardFacts.js:40` (`posted`) | **3 days** over *since posted* | "3 days" alone means nothing | KEEP — ambiguous |
| J7 | deck card stats — `deckCardFacts.js:102` | **3 of 8** over *skills matched* | "3 of 8" alone means nothing | KEEP — ambiguous |
| J8 | deck card match — `deckCardFacts.js:54` | **86%** over *résumé match* | the owner's own example of a needed word | KEEP |
| J9 | opened posting's facts box — `PostingPanel.jsx:121` (`<dt>`; cells from `shared/postingFacts.js:143`) | **$165k–$205k** under *Salary* | the value is a money range | REMOVE *Salary* (screen-reader label kept, as the deck strip's Workstyle already does — `labelHidden`) |
| J10 | opened posting's facts box — `PostingPanel.jsx:121` (`postingFacts.js:140`) | **Hybrid** under *Workstyle* | the value is the mode; the deck strip already hides this label (owner 10-07) | REMOVE *Workstyle* here too (D149 had kept it for the sketch) |
| J11 | opened posting's facts box — `postingFacts.js:135` | **5+ years** under *Experience* | as J5 | KEEP — ambiguous |
| J12 | opened posting's facts box — `postingFacts.js:145` | **9 hours ago** under *Posted* | "9 hours ago" alone is ambiguous (posted? seen? checked?) | KEEP |
| J13 | opened posting — `PostingPanel.jsx:198` | *Level* · "this posting reads two steps above its title" | the sentence names the level itself | REMOVE *Level* |
| J14 | opened posting — `PostingPanel.jsx:173` | *History* · "Reposted 4 times since June" | the sentence is plainly the posting's history | REMOVE *History* |
| J15 | opened posting — `PostingPanel.jsx:210` | *In short* · the should-I-apply sentence | a caption that only names what follows | REMOVE *In short* |
| J16 | opened posting — `PostingPanel.jsx:187` | *Hiring?* · "Likely not hiring · Reposted 4 times" | the sentence says it | REMOVE *Hiring?* |
| J17 | opened posting — `PostingPanel.jsx:232` | *Visa filings* · "Filed 290 certified LCAs in FY2025 …" | "LCAs" / "H-1B" in the sentence say it — but only to someone who knows the words | KEEP — ambiguous to most readers |
| J18 | opened posting — `PostingPanel.jsx:254` | *Travel* · *Relocation* · *Employment* · *Site* · *Req* before each value | values like "Up to 25%", "Yes", "R-10422" mean nothing alone | KEEP — ambiguous |
| J19 | D179 sketch's taxonomy chip (*Software engineering › Backend · Senior*) | not built | the title | NEVER BUILT (owner 11-07) — pinned by `d182NoTaxonomyChipsOnCards` |

## 2 · The pattern behind most of the rest — the eyebrow that repeats the nav

`PlaceHead` / `PanelHead` draw an accent eyebrow over each panel's title, and the nav card beside it already shows the
same name in bold as the current item. In ≈ 20 panels the eyebrow is that nav label word for word. **One change clears
them all:** `PlaceHead` (`components/PlaceNav.jsx:61`) and `PanelHead` (`pages/atlas/AtlasPanels.jsx:34`) stop drawing
an eyebrow equal to the current nav item. Rows marked **(nav)** below are that case.

## 3 · Home (the tracker, the Inbox)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| H1 | `lib/trackerRows.js:43–56` (drawn `components/ApplicationTracker.jsx:170`) | opened-row eyebrows *Ready to send · Sent · Interview · Assessment · No reply · Not applied · Stopped* | the row's status word right above, same words | REMOVE (keep the ones that add: *Only you can answer this*, *They said no*, *Picked for you*) |
| H2 | `lib/heldApplication.js:42` | *Sent* over "Applied to {company}" | the status column + the headline | REMOVE |
| H3 | `components/AutoSettingsDrawer.jsx:90` | an open fold's eyebrow (*When*, *How many* …) | the fold's own button just above | REMOVE |
| H4 | `components/AutoSettingsDrawer.jsx:87` | *When* · 9 AM and 6 PM · *Tell me* · off | "Tell me · off" can't be read without its word | KEEP — ambiguous |
| H5 | `panels/AutoApplyPanel.jsx:1053` | timeline line "Ask me first · runs at 9 AM and 6 PM" | the mode switch on the same screen | REMOVE the mode words, keep "runs at …" |
| H6 | `panels/AutoApplyPanel.jsx:1134` | "Every application, from draft to reply." under *Home* | names what the table obviously is | REMOVE |
| H7 | `components/DraftHouseTree.jsx:98–99` | run card "{day}, {time}" + "Looked at N new postings" | the run line just above (day, time, N looked at · M picked) | REMOVE |
| H8 | `components/DraftHouseTree.jsx:106` | "left out: {reason}" on each line | "Picked M, left out K." just above | REMOVE the "left out:" prefix |
| H9 | `panels/AutoApplyPanel.jsx:1761` | caption *EVERY ATTEMPT AT THIS APPLICATION* | the button just pressed, "Show N attempts" | REMOVE |
| H10 | `panels/AutoApplyPanelSections.jsx:129` | "One application · N things to resolve" | the card is one application; the big N "to resolve" beside it | REMOVE "One application ·" and the count |
| H11 | `panels/AutoApplyPanelSections.jsx:172` | "one action, N applications" | the big N "unblocked" beside it | REMOVE |
| H12 | `components/ApplicationInbox.jsx:157` | a category mark on each message (*Interview*, *Rejection*) | "File as [category]" on the same message | REMOVE the mark (the select stays) |

## 4 · Atlas

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| A1 | `pages/atlas/YourRun.jsx:36`, `:45` | *Your run* | (nav) | REMOVE |
| A2 | `AtlasPage.jsx:409`, `:416` + `YourMap.jsx:225` | *Your map* eyebrow, then an h2 *Your map* a few lines below | (nav) and each other | REMOVE both — "Your skills, against the market" is the title |
| A3 | `AtlasPanels.jsx:154` + `Navigator.jsx:64` | *Your route* eyebrow, then a card heading *Your route* | each other | REMOVE the eyebrow |
| A4 | `YourSkillsPanel.jsx:157` | *Your skills* | (nav) | REMOVE |
| A5 | `LibraryPanel.jsx:75` | *Library* | (nav) | REMOVE |
| A6 | `AtlasPanels.jsx:169` | "Today's question · picked from your route" | (nav) + the lead says the same | REMOVE |
| A7 | `AtlasPanels.jsx:221` | *The 3-minute audit* | (nav) *The audit* | REMOVE (3 minutes into the lead if wanted) |
| A8 | `AtlasPanels.jsx:247` | *Explore* over *Roles and skills* | the nav group *Explore* and item *Roles and skills* | REMOVE the eyebrow |
| A9 | `AtlasPanels.jsx:265` | *This week's market* | (nav) | REMOVE |
| A10 | `AtlasPanels.jsx:335` | *Glossary* | (nav) | REMOVE |
| A11 | `AtlasTree.jsx:103`, `AtlasPage.jsx:292` | *Family* / the kind before a node's name | "Python" or "Data" is ambiguous alone | KEEP |

## 5 · Interview

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| I1 | `pages/interview/InterviewPage.jsx:45` | *Coming up* | the nav group *Coming up* (one item) | REMOVE |
| I2 | `InterviewPage.jsx:78, 103, 170, 218, 226, 231, 239, 245` | *Company guides · Tracks by round · Debrief · Mock interview · Ask the coach · Drills · Defend your résumé · Past sessions* | (nav), word for word | REMOVE all 8 |
| I3 | `InterviewPage.jsx:81` | "Company guides are not built yet —" | the title "Guides are coming" | REMOVE the clause |
| I4 | `InterviewPage.jsx:65` | "From your Inbox: “subject”" on each row | the lead: "Found in your Inbox and matched to your applications." | REMOVE "From your Inbox:" |
| I5 | `InterviewPage.jsx:63` | *Interview* / *Assessment* on each row | one list holds both | KEEP |

## 6 · Profile

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| P1 | `pages/profile/ProfilePage.jsx:72, 91, 133, 141, 149, 161, 167, 174` | *Auto-apply · Connections · About you · Your résumés · Saved answers · Notifications · Privacy and your data · Account* | (nav), word for word | REMOVE all 8 |
| P2 | `panels/ProfilePanel.jsx:958` | section *Visa status* around one field *Visa / Immigration Status* | the field's own label | REMOVE the section title |
| P3 | `panels/ProfilePanel.jsx:1039` | *Custom Answers* | separates it from the bank further down | KEEP — rename to say how it differs |
| P4 | `components/ProfileSections.jsx:448` | "linkedin: https://linkedin.com/in/…" | the URL itself | REMOVE the "{kind}:" prefix |
| P5 | `components/PlaceNav.jsx:33` (from Profile / Interview / Atlas) | nav slogans *You and your résumé · Ready for the room · Your way through the market* | not a repeat — a slogan that gives no fact | owner's call |

## 7 · Admin (the obvious cases only)

| # | Where | Visible now | Already says it | Proposal |
|---|---|---|---|---|
| X1 | `panels/adminKit.jsx:98` (`Panel` h2 — e.g. Atlas, Admins, Email health, Deployments, Disk and backups) | a panel heading equal to the selected tab above it | the tab (`panels/adminMap.js`) | REMOVE the duplicate text (its `Help` tip moves first) |
| X2 | `panels/adminEnrichment.jsx:244` | *Enrichment* | the selected tab | REMOVE |

*(Sections 2–7 swept by a read-only search agent and spot-checked by the agent on three rows — A10, H6, I1 — each as reported.)*

# A233 · The text audit (46u, owner 11-17)

**The owner's words (11-17):** *"one thing about text jargon, just like we are designing everything lines of text are to be
restyled and designed in a similar manner, do an audit for where this excluding the glossary and show me plans on what to do"*

**The plans, as a sketch for the owner's pick:** https://claude.ai/artifact/9p5By1mB4hURLb2Fn6y3XQ (private) — five real
lines, each in three treatments (A facts, not sentences · B one line and a fold · C note cards), the plain-words pass and
the build order. ⛔ Nothing changes before the owner picks (D149 rule 3).

**How it was measured:** a read-only sweep of `client/src` and `extension/` (11-17), every screen below; the worst lines
spot-checked by hand against the files (`AtlasPanels.jsx:459`, `ProfilePanel.jsx:1541`, `IntegrationsPanel.jsx:357`,
`AtlasPage.jsx:314`, `HowItWorksPage.jsx:14` — all as quoted). Word counts are approximate; line numbers are as of `b70f8cb8`.

**Left out, as asked or by nature:** the Glossary (`AtlasPanels.jsx` GlossaryPanel / GlossaryView); admin pages
(`panels/AdminPanel.jsx`, `panels/admin*.jsx`, `pages/admin/*`, `AdminLoginPage`, `AdminLayout`, `IngestFunnel`); the legal
pages (`PrivacyPage.jsx`, `TermsPage.jsx` — prose by nature). Not swept: Network / Feed / Messages (`pages/network/*`, ~32 quiet
lines) — on the list for the build.

## What the audit found

About **400 prose lines** across the app and the extension, in three kinds of problem:

1. **Long.** Explanations and empty states of 30–75 words where one line and an action would do (the empty board's two
   blocks, 46 and 41 words; the public-profile explainer, ~75; the extension's disclosures, 50–70 each).
2. **Our own words.** Names from how draft is built, not what a job seeker says: *postings* (60+ lines), *ATS score / fit
   band*, *pool / crawl / computed*, *coverage*, *dealt*, *lit*, *piece*, *curator*, *runner / held*, *profile-scoped*,
   *LCA / FY*, *Full House / Draft House / SEMI / FULL AUTO* — and one internal ticket code on a page.
3. **Run-on meta lines.** Facts strung with " · " into a sentence ("Course · 8 modules · 108 lessons", "0 of 108 lit · sign in
   to light them", "Visa filings · Filed 41 certified LCAs in FY2025 · median $162k · …") instead of shown as figures.

And one structural finding: **the Atlas has one set of text classes** (`atl__quiet` ×149, `atl__lede`, `atl__kicker`,
PanelHead's `lead=`), so a restyle reaches all of it at once — but **the board, Settings, Integrations, ProfilePanel and the
Deck mostly use inline styles with no class** (`style={muted}` ×71, raw font sizes), so they need a shared text component
before they can be restyled at all.

## Per screen

| Screen | Prose lines | Words | Worst line |
|---|---|---|---|
| Home / the deck (`panels/DeckView.jsx`) | 5 | ~140 | `:1225` the first-visit empty state (37w: dealt, ranked, job profile) |
| The board (`panels/JobsPanel.jsx`, `lib/filterSentenceModel.js`) | ~20 | ~550 | `:4956` "the shared job pool itself is empty … the next scheduled crawl" (46w); `:4986` (41w) |
| The posting panel | ~12 | ~170 | `PostingPanel.jsx:234` "Visa filings · Filed N certified LCAs in FY2025 …" |
| Applications / tracker (`AutoApplyPanel`, `AutoSettingsDrawer`, `lib/draftHouse*`) | ~45 | ~900 | `AutoApplyPanel.jsx:1330` "draft's application runner hasn't started one in N minutes"; `STOP_DOES` (34w) |
| Saved answers | ~8 | ~140 | `ProfilePanel.jsx:235` "the run holds and asks you …" |
| Profile (`YourProfile`, `ProfilePanel`, `JobProfilesPanel`, `DomainProfileWizard`) | ~40 | ~750 | `ProfilePanel.jsx:1541` "profile-scoped search shaping and ATS basis signals"; `YourProfile.jsx:94` (~75w) |
| Settings (`AccountPanel`, `PlanSettings`, `NotificationSettings`) | ~25 | ~500 | `PlanSettings.jsx:90` (46w) |
| Customise | ~12 | ~230 | `CustomisePanel.jsx:124` "Back to how draft ships … shape cues off …" |
| Integrations | ~10 | ~220 | `:357` "No job feed providers configured. Contact the app operator."; `:402` "local profile readiness" |
| Interview | ~14 | ~330 | `InterviewPage.jsx:81` (40w) |
| Atlas · Your map (tree, family page, Navigator) | ~15 | ~280 | `AtlasTree.jsx:109` the 48-word legend |
| Atlas · Your run | ~10 | ~150 | `YourRun.jsx:100` (37w, "lights", "proof link") |
| Atlas · Your skills | ~12 | ~150 | `YourSkillsPanel.jsx:50` "held for the curator" |
| Atlas · Library / course / guide | ~31 | ~440 | `LearnView.jsx:105` (35w); `LibraryGuides.jsx:85` "drafted, waiting for review" |
| Atlas · Today's question | ~12 | ~150 | `AtlasPanels.jsx:224` "From postings draft has read …" |
| Atlas · The audit, Roles and skills, a node page | ~23 | ~315 | `AtlasPage.jsx:314` "Not computed yet — … active postings after the nightly crawl" |
| Atlas · This week's market | 4 | ~45 | `AtlasPanels.jsx:459` "The weekly market read (D150 T09) is not built yet" — a ticket code on the page |
| Marketing pages | ~30 | ~700 | `AboutPage.jsx:14` (45w); stale: `HowItWorksPage.jsx:14` "ATS Search and ATS Sort run in the shared jobs console", `:20` "match score", `FAQPage.jsx:12` "We do not scrape any job boards" |
| Sign-up / login | 4 | ~95 | `SignupAtsHook.jsx:74` (29w, "dealt") |
| Onboarding (résumé setup, profile wizard) | ~7 | ~120 | `DomainProfileWizard.jsx:633` "search profile … support review … scoped" |
| The extension | ~35 | ~1,100 | `applyAway.js:80` "sealed … apply worker … Draft House … SEMI … FULL AUTO"; `autoRead.js:428` disclosures (~70w); `atsReport.js:192` (46w) |
| Ask draft / Tiny | ~8 | ~190 | `AppNav.jsx:527` the 48-word intro; `assistantDraft.js:146` "Home (your applications)" — Home means the deck elsewhere |

## The worst 15, site-wide

1. `pages/atlas/AtlasPanels.jsx:459` — an internal ticket code shown to users.
2. `panels/ProfilePanel.jsx:1541` — "profile-scoped search shaping and ATS basis signals".
3. `panels/JobsPanel.jsx:4956` — the shared job pool, the scheduled crawl (46w).
4. `panels/JobsPanel.jsx:4986` — "classified under that role … active profile" (41w).
5. `extension/applyAway.js:80` — sealed, apply worker, Draft House, SEMI, FULL AUTO.
6. `panels/IntegrationsPanel.jsx:357` + `:402` — "job feed providers configured … app operator", "local profile readiness".
7. `panels/JobProfilesPanel.jsx:213` — "ATS scoring, new scrapes, and enhancement are blocked … Extracted metadata".
8. `pages/atlas/AtlasPage.jsx:314` — "Not computed yet — … active postings after the nightly crawl".
9. `extension/atsReport.js:192` — "Bands are computed by comparing your resume's wording …" (46w).
10. `pages/profile/YourProfile.jsx:94` — the public-profile explainer (~75w).
11. `extension/autoRead.js:428` — the disclosures (50–70w each).
12. `panels/JobsPanel.jsx:872` — "LCA disclosure data … the quarters we hold" (34w).
13. `pages/atlas/AtlasTree.jsx:109` — the 48-word tree legend.
14. `panels/AutoApplyPanel.jsx:1330` — "draft's application runner hasn't started one".
15. `pages/marketing/HowItWorksPage.jsx:14` / `:20` — stale and jargon ("ATS Search and ATS Sort", "match score").

## The plain-words pass (proposed; the owner may change any row)

| Today | Say instead | ~Lines |
|---|---|---|
| posting(s) | job(s) | 60+ |
| ATS score · fit band · Strong / Moderate | fit · good fit / close fit | 15 |
| pool · crawl · computed · active | the jobs we've found · we look again tonight · open | 17 |
| coverage · on file | "most jobs don't say" | 6 |
| dealt · the fan | picked for you · your cards | 8 |
| lit · lights | done · counts today | 6 |
| piece · Learn piece · circle | lesson · the course map | 7 |
| claimed · curator · proof | on your list · we'll review it · shown | 10 |
| runner · held · re-run | draft's form filler · waiting · try again | 12 |
| profile-scoped · search focus · signals | for this job profile · what you search for · what we match on | 6 |
| LCA · certified filings · FY | visa sponsorship records · approved · last year | 8 |
| Full House · Draft House · SEMI / FULL AUTO | your board · your applications · ask me first / send for me | 4 |

⚠ Some of these names are approved product names (Full House, Draft House, the deck's "deal"). Changing what a page *says*
is the pass; renaming a feature is the owner's call, row by row.

## The three treatments (the sketch shows each on the same five lines)

- **A · Facts, not sentences** — a line that carries numbers or a list becomes figures (a serif number, a short caption) and
  checkmarks (what happens ✓ / what never does ✕). Prose shrinks most. Best for meta lines, limits, disclosures.
- **B · One line and a fold** — each block becomes one short serif line; the rest stays, folded under "How this works".
  Nothing is lost; closest to today's layout.
- **C · Note cards** — an explanation or an empty state becomes a small card in the 46u pastels: a serif title, at most two
  lines, the action it is about. Most visual; matches the Library and the decks.

## The build, after the pick

1. **One shared text component** (A93) for the kinds found — lede, note, fact row, empty state, disclaimer — in the chosen
   treatment. The board, Settings, Profile and Integrations move onto it first (they have no class today); the Atlas's
   classes are restyled in place.
2. **The plain-words pass**, screen by screen, with a **guard** that fails on the retired words in user-facing strings (as
   D6 does for the old brand) — with an allow-list for the Glossary, admin and legal pages.
3. **Order:** the worst 15 first, then the Atlas, the board, applications, profile, settings, Interview, the extension (its
   disclosures keep their full meaning — the store review read them), marketing (and fix the stale claims there).
4. The legal pages stay prose; the Glossary is left as it is.

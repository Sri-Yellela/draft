# M1 · the market — the classic board's search, sort, filters and pager, and where each lives on the plate (D199 C2 / C3)

Read from the code on 11-25 (47h), before C1–C8 are built. One row per control: **what it DID**, the API it calls, and **where it does that on the plate today**. Under D200 Rule 1, a row whose "plate today" is empty must have a home before D199 merges.

## Three facts that change how C2 / C3 read

1. **The plate market already renders the classic search, sort, views, counts and list, but only inside the Index tab.** `App.jsx:792` passes `homeBoard` (`App.jsx:708-726`: `BoardBar`, `BoardViews`, `BoardCounts`, `JobsConsole`; only the classic sentence header is skipped, `!marketPlate`) to `MarketOpenings` as `index`. `BinderTabs` keeps each panel mounted but `hidden` (`plate/Plates.jsx:132-134`; `.pl-tabpanel[hidden]{display:none}`). On the default Deck tab there is no search and no sort on screen: the owner's PDF defect (e).
2. **The classic board has no pager either.** D147 (`afc1c751`, 11-03) replaced it with endless scroll, so `?plate=0` scrolls endlessly too. The numbered pager exists only in git: `git show afc1c751^:client/src/panels/JobsPanel.jsx`, lines 4217-4262 and 4359-4444.
3. **The page has never been in the URL**, and Back / Forward has never paged. The board writes only `?job=` (`replaceState`, `JobsPanel.jsx:2430-2441`). It reads `?view=`, `?tracker=` and `?plate=`. Filters and sort aren't in the URL. So C3's `?page=` is new work, not a carry-over.

All list fetches go through `buildParams` (`panels/JobsPanel.jsx:2477-2577`) → **`GET /api/jobs`** (`server.js:12905` → `boardPageResponse`). Live counts come from **`GET /api/jobs/facets`** with the same querystring minus page / pageSize / cursor (`lib/jobFacets.js`, `hooks/useJobFacets.js`; `server.js:12798`). This is **the one counts source C4's stats box must read** (A239's lesson).

## Search

| element | file:line | what it did | API | plate today |
|---|---|---|---|---|
| `BoardSearch` ("Search a company, title or skill") | `components/BoardBar.jsx:45-78`; `App.jsx:172-196` | Enter commits; emptied or × → "" (all jobs); Esc clears. Publishes `{query}` → `setLocalSearch` (`JobsPanel.jsx:3027-3031`). ⚠ The input's text is local state, so "Clear all filters" empties the search and leaves the old text in the box | `localSearch=` on `/api/jobs` + facets (`JobsPanel.jsx:2513`) | Index tab only |
| Grouped suggestions `UsbSuggest` | `components/UsbSuggest.jsx:83-325` | 180 ms debounce; Companies (`N open`) · People · Roles · Technologies · Titles (`:136-142`) | `GET /api/public/suggest?q=&kind=` (q ≥ 2; `server.js:11246`), `GET /api/jobs/suggest?field=title` (`server.js:12835`) | Index tab only |
| A pick | `UsbSuggest.jsx:174-191`; `App.jsx:192-194` | Company → `/app/companies/<slug>` · Person → `/in/<handle>` · Role → `onPatch({subcategory, category})` · Tech → `onPatch({tech})` · Title → fills the box | role / tech refetch `/api/jobs` | Index tab only |
| Scope labels (A148): People · Company · Role · Stack / Skill | `UsbSuggest.jsx:80, 276-288` | One kind only; Enter opens the row; Backspace in an empty box clears the scope | `kind=` | Index tab only |
| Search handed over from the dock | `App.jsx:174-187` (`lib/boardSearch.js`) | Applies `query` / `role` / `tech` when the board mounts | — | Index tab only |

## Sort

| element | file:line | what it did | API | plate today |
|---|---|---|---|---|
| Sort ⇅ inside the search field | `BoardBar.jsx:87-97`; `App.jsx:344-368` | Opens the shared panel; label "Sort: <current>"; `data-active` when not the default; Best fit falls back when the résumé goes | — | Index tab only |
| `SortPanel` | `components/SortPanel.jsx:22-66`; rows `lib/filterSentenceModel.js:359-377`, `shared/filterSentence.js:245-253` | **For you** (default, no `sort`) · **Best fit** `atsScore` (hidden without a résumé) · **Newest** `dateDesc` · **Salary** `compHigh` · **Company A–Z** `companyAsc`; a tie-break line and a live unscored line; a pick closes the panel and goes to page 1; kept only in the board's profile snapshot, not the URL | `sort=`; the server also takes `dateAsc`, `compLow`, `yoeLow`, `yoeHigh`, `applicantCount` (`shared/jobFilterOptions.js:236-256`) | Index tab only. The deck's own order (Best bets / Dealt / ATS) is a Customise setting (`lib/deckOrder.js`) |

⚠ **D199 C2's sort list is "Best match · Newest · Salary · Company A–Z"; the code's is For you · Best fit · Newest · Salary · Company A–Z.** The build keeps the code's five and words the default "Best match" per the sketch, unless the owner says otherwise.

## Filters (the sentence words — `components/BoardHeadline.jsx`, `components/WordPanel.jsx`, state `JobsPanel.jsx:2626-2694`)

Each word opens one panel. Options show live counts; a zero is dimmed, never hidden; a coverage note sits under them; a press applies at once (`applyClausePatch`, page 1). The words come from `shared/filterSentence.js:71-82`.

| element | file:line | what it did | API param | plate today |
|---|---|---|---|---|
| **Role / Domain** | `filterSentence.js:72`; `RolePicker` `WordPanel.jsx:187-232` | Category → Subcategory with counts; "Any role", "All of X"; "Or by kind of work" (Engineering … Legal, multi); strict toggle | `subcategory`, `also_subcategory`, `category`, `job_functions`, `strict_tags=1` | ✅ the same word in `PlateBearing.jsx:241-252` → the same `WordPanel` |
| **Level** | `filterSentence.js:73`; `jobFilterOptions.js:60-70` | Intern · Entry · Mid · Senior · Lead · Executive; "N jobs don't say their level; kept, not hidden"; strict | `experience_levels` | ✅ same |
| **Location** | `filterSentence.js:74`; `shared/jobTagVocabulary.js:130-138` | The US is the floor (narrowed, never cleared); metros + states (multi); "Remote (US)"; strict | `places` | ✅ same |
| **Workstyle** | `filterSentence.js:75`; `jobFilterOptions.js:106-113` | Remote · Hybrid · Onsite; coverage % | `work_models` | ✅ same |
| **Posted** (optional) | `filterSentence.js:76`; `jobFilterOptions.js:266-279` | Any time · Since your last visit · 24 h · 2 d · 3 d · week · month | `ageFilter` + `posted_after` | ✅ via Add a filter / All filters |
| **Fit** (optional) | `filterSentence.js:28-34, 77` | Strong · Moderate · Weak (hard; unscored excluded, counted in the note) | `fit_bands` | ✅ same |
| **Sponsorship** (optional) | `filterSentence.js:79` | "Employers with H-1B filings" | `company_sponsorship=filed` | ✅ same |
| **Technology** (optional) | `filterSentence.js:19-20, 82`; `WordPanel.jsx:145-148` | ≈ 180; top 40 by postings, the find box reaches all | `tech` | ✅ same |
| **All filters** | `WordPanel.jsx:113-131` | Every clause at once + "Salary & more · N on" | — | ✅ `PlateBearing.jsx:256-259` |
| **Add a filter** row | `WordPanel.jsx:94-100, 256-273` | posted · fit · sponsorship · technology · salary & more · **employment type (dimmed: coverage too low)** | — | ✅ same |
| **Salary & more** drawer `FiltersPanel` | `JobsPanel.jsx:390-1000` (mounted `:4090-4133`) | **Staged until Apply**; Reset All. New in 24 h · Save Search · Role text · **Employment Type** (Full-time · Contract · Internship · Part-time) · Work Model · Experience · Automation tier · Date posted · Visited · **Salary min / max (USD)** · Skills must include · Sponsor-friendly · Hide no-H-1B · Hide clearance / citizenship · Truly entry · Hide likely not hiring · Company sector | `ageFilter`, `role`, `employmentType`, `work_models`, `experience_levels`, `tiers_include/exclude`, `visited`, `salary_min_usd/max_usd`, `skills_include`, `sponsorship_friendly`, `company_sponsorship=1`, `hide_eligibility_required`, `truly_entry`, `hide_ghost`, `sectors`; counts `include_facets=…` (`:2585-2593`) | ✅ via All filters / Add a filter |
| Views: All jobs · Starred · Imported (+ Import a job) | `App.jsx:307-336, 395-414`; `BoardBar.jsx:25-41, 106-139` | Counts from `facets.views`; Import → `POST /api/import/job` | `starred=1`, `imported=1`, `?view=pending` | Index tab only |
| Counts strip "N jobs · N new today · N saved" | `App.jsx:458-472` | From facets | `/api/jobs/facets` | Index tab only. **C4: the hero's stats box replaces it** (`MarketHero.jsx:161-168`, `marketFigures` `filterSentenceModel.js:345-350`) |
| **Removable active chips + Clear all** | not in the current code: last in D30 `FilterDials.jsx`, deleted by D35 `b9e83b5c`; the "N filters active" chip removed by A74 `a32579f5` | Today the only "Clear all" is the empty state's **Clear all filters** (`JobsPanel.jsx:4953-4975` → `clearAllFilters` `:2013-2022`) + the drawer's Reset All | — | ❌ none. An unwired `FilterChips` exists in `plate/Marks.jsx:83` (gallery only). **C2 builds it new** |

**One store?** Yes for the sentence words: `PlateBearing` and the classic `BoardHeadline` both render `boardHeadline.params` (published from JobsPanel's committed filters through `JobBoardContext`) and write back through `applyClausePatch`. Three caveats C2 must settle:
- **(i)** The drawer's filters are staged until Apply and show in the sentence only as "salary & more · N on".
- **(ii)** The Sponsorship word writes `company_sponsorship=filed`, while the drawer's toggle writes `"1"`: the same variable with two values.
- **(iii)** The search text lives in `JobBoardContext.localSearch`, and the input keeps a local copy.

## Pager

| element | file:line | what it did | plate today |
|---|---|---|---|
| Page size | `JobsPanel.jsx:2259-2260` | **`PAGE_SIZE = 50`** (D11, was 25); the server clamps 1–50 (`server.js:12982`) | 50 (shared). ⚠ **The sketch says "24 per page"**; the build follows the sketch (24) unless the owner keeps 50 |
| Paging modes | `lib/boardPaging.js:33-99`; `goPage` `JobsPanel.jsx:3911-3934` | ±1 page by keyset `cursor` (+ a stack of earlier cursors), a jump by `page`; a rejected cursor retries once by offset (`:2770-2782`) | the machinery is there, but only the empty state's "first page" calls `goPage` |
| The old numbered pager (removed by D147) | `git show afc1c751^:client/src/panels/JobsPanel.jsx` `:4359-4422`, `buildVisiblePageItems` `:4431-4444`, the jump box `:4217, 4250-4262` | Shown when `totalPages > 1`: Prev · 1, current ± 2, last with "…" · Next · "Go to page" + Go (clamped); each move scrolls to the list's top; no "Page X of Y" | ❌ none. C3 brings it back in the plate style + "Page N of M · 24 per page" |
| URL + Back / Forward | — | never; `currentPage` is component state, reset on every filter / sort / tab change | ❌. C3: `?page=` new |
| Paging errors | `JobsPanel.jsx:4669-4671, 4875` | `page_out_of_range` → back to page 1; `count_list_mismatch` reported as a server defect | shared |

## The endless loading C3 removes

| element | file:line | what it does |
|---|---|---|
| `BoardMore` | `JobsPanel.jsx:4817-4843` (rendered `:4800-4802`, for the bubble list AND the plate `MarketIndexTable`) | An IntersectionObserver (`rootMargin 600px`) calls `onLoadMore`; the line "Showing 50 of N · scroll for more" → "Showing all N". It only loads while Index is showing |
| `loadMore` | `JobsPanel.jsx:3963-3971` | Fetches `currentPage + 1` and appends (cursor plan), one load at a time |
| The Index table | `JobsPanel.jsx:4629, 4749-4760`; `plate/MarketIndex.jsx:105-126` | Draws the same `jobs`; past 200 rows only windowed (`INDEX_WINDOW_AFTER`) |
| The Deck | `DeckView.jsx:931, 977-1000` | No paging: the daily deal (`GET /api/draft/today`), re-fetched on `board_scored` / `deck_reshuffled`; `EndOfDeck` at its end. ⚠ **C3's "the Deck pages through the same order (25 of 11,247 · page 2)" means the deck reads the board's list, not the daily deal: a real change of what the deck is**, to settle with the owner before C3 |

## M5 · What was built (47m, lane market + the coordinator — the 47n record)

- **MATCH → the sheet's 02.** The deck's MATCH opens the opening sheet at `/app/jobs/<id>#fit`; the sheet scrolls its
  overlay to the hash once drawn. `OPEN_MATCH_EVENT` / `openMatchInPosting` and JobsPanel's listener are deleted.
- **The dead search-intent chain deleted** — the live search tick (nothing passed `live` since D26), `handleSearch` /
  `handleSetRole` / `ensureSearchProfileAlignment` / `activateProfileForSearch`, the intent guard tables,
  `SearchIntentDialog` and JobsPanel's `DomainProfileWizard` mount (the wizard file stays — three other importers).
- **UsbSuggest is a plate card** (`.pl-suggest`, inside a `PlateRoot` in its portal): one list for /jobs, the market's
  search and the dock search; the classic `.usb__suggest-*` / `.usb__scope*` rows deleted.
- **The peek's notifications** carry a plate line icon per type (`plate/icons.jsx` `NOTIF_ICON` / `notifIcon`; an unknown
  type is the bell).
- **A250 Send on the Index rows** (`RowBubble onSend`: network on → the one `SendJobPicker`, off → the public link shared or
  copied). ⭐ Agent's pick — owner may reverse: **Send hides at ≤ 600 px** (A201: at 390 Draft fell off the row); it stays
  on the deck card and the sheet.
- **The posting's one home is the sheet.** 06 *Your application* (`plate/SheetResume.jsx`: the résumé for this job, the
  sandbox's live view, History, More, the notices, ManualSubmitted); 04's description is fetched on open; the sheet tells
  the board which job is open (`boardOpenSheet` / `boardCloseSheet`) so the sandbox and Ask draft's `currentJob` follow it.
  `?job=<id>` redirects to `/app/jobs/<id>` (and since 47n every server writer emits the new address).
- **Deleted:** DeckView's long post + swap (D156 1c / D168), MarketOpenings' A240 listener, `JobDetailPanel(.jsx/.css)`,
  `SandboxPanel`, `ATSPanel` (the sheet draws FitCard itself), the mobile bottom nav, the URL sync; in 47n
  `components/PanelShell.jsx` (it rendered nowhere) — its two drawer insets live in `lib/panelGeometry.js`.
- **The ledger (47j leftovers):** the measure is a named d163 exception (agent's pick); the held questions keep their way
  (asks in place; Ask draft's thread only from its link, placed so the open card cannot cover it at 1440 × 900).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

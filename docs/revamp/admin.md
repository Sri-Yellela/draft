Status: M1–M3 done (47j, lane w2-outside) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #21 — Admin and `/dev`: tokens and components only (no new art); readable, dense

Nothing in the admin console changes in this lane. M1 is read from the code (file:line at `a393442e`); the earlier
inventories `docs/ADMIN_AUDIT.md` (D83, 10-08 — 32 read endpoints, the six rules) and `docs/ADMIN_PANEL_REVAMP.md`
(the three jobs: glance · investigate · change) are reused, not repeated. M3 = `/dev/plate?page=admin` (People → Users).

## M1 · What the admin console has today

### 0 · The frame (`client/src/panels/AdminPanel.jsx`, the map `client/src/panels/adminMap.js`)
| Row | Where |
| --- | --- |
| Title *Admin* + the **DB Inspector** shortcut card (→ `/admin/db`, "Pipeline Health · Schema · Tables · Trace") | `AdminPanel.jsx:644-670` |
| **The disk banner** on every tab while the volume is amber / red (`GET /api/admin/disk`) | `AdminPanel.jsx:673`, `adminOps.jsx:378` |
| **Five groups** (depth buttons, label + its question): Today *What needs me?* · The board *What is on it, and why?* · People *Who is using it?* · Data *What is stored?* · System *Is it set up right?* | `AdminPanel.jsx:676-687`, `adminMap.js:5-57` |
| **The group's sections** as tabs (underline on the current) | `AdminPanel.jsx:689-702` |
| The place in the URL (`?g=&s=`; unknown ids fall back, never strand) | `adminMap.js:59-64` |
| Delete-user dialog, limits modal, the upgrade / profile request queues (pending only) | `AdminPanel.jsx:640, 781-830`, `adminPeople.jsx:452` |

### 1 · Every panel (group → section → component → controls → API)
Controls are the buttons / inputs each draws (from the code); "read" = a read-only panel.

| Group · section | Component (file:line) | Controls | API |
| --- | --- | --- | --- |
| Today · At a glance | `GlanceTab` adminOps.jsx:1615 | read: Apply · Deploy · Enrichment · Ingestion · Scoring · Spend tiles | `/api/admin/glance`, `/api/version` |
| Today · Deployments | `DeploymentsPanel` adminOps.jsx:124 | read | `/api/admin/deploy-events` |
| Today · Disk and backups | `DiskPanel` adminOps.jsx:185 | restore a backup (confirm) | `/api/admin/disk`, `/api/admin/backups`, `…/backups/restore` |
| Today · Costs & quotas | `CostsTab` adminOps.jsx:1994 | clear the funding alert | `/api/admin/costs`, `…/funding-alert/clear` |
| Today · Activity | `UsageTab` AdminPanel.jsx:142 | read: active users, résumés generated, postings discovered, avg ATS Δ, model calls (model, error) | `/api/admin/analytics/overview`, `…/timeseries`, `…/model-calls` |
| Today · Outcomes | `OutcomesSection` adminOps.jsx:736 | read (D185-5, by week) | `/api/admin/outcomes` |
| Today · Phase 1 measures | `Phase1Tab` adminPhase1.jsx:13 | read: started · finished · kept · debriefs per interview, each vs target | `/api/admin/phase1` |
| Board · Companies and candidates | `CompaniesSection` adminOps.jsx:1116 | find a company or slug, show (filter), add a board (company, board type, slug or careers URL) — *Add it*; per company actions | `/api/admin/companies`, `…/:id` |
| Board · Company records | `CompanyRecordsTab` adminCompanyRecords.jsx:31 | review queue: *Same domain* / *Keep apart*; health counts | `/api/admin/company-records`, `…/health`, `…/review/:id` |
| Board · Scope and age | `BoardPolicySection` adminOps.jsx:245 | the sweep, the scope sweep (confirm) | `/api/admin/board-policy`, `…/sweep`, `…/scope-sweep` |
| Board · Crawler | `CrawlerTab` adminOps.jsx:397 | queue domains (one per line), deny / allow again a domain, flag a task (*What is wrong*), captures | `/api/admin/crawler`, `…/state`, `…/deny`, `…/tasks`, `…/tasks/:id/flag`, `…/tasks/captures` |
| Board · Slug harvest | `SlugHarvestSection` adminOps.jsx:1385 | *Run the searches — this spends them*, *Export for review (JSONL)*, import, revert an import | `/api/admin/slug-harvest`, `…/sweep`, `…/export`, `…/import`, `…/imports/:id/revert` |
| Board · Enrichment | `EnrichmentTab` adminEnrichment.jsx:81 | *Count what needs enriching*, *Export a batch*, *Download all pieces (.zip)*, the model instructions, drop reply files, *Join the pieces*, *Dry run*, *Apply this import?*, *Check — or undo*, Undo (per batch), per column | `/api/admin/enrichment/overview`, `…/export`, `…/batches`, `…/batches/:id/revert` |
| People · Users | `PeopleUsers` adminPeople.jsx:297 → `PeopleList` :66 (*Find a person* — name, email, username or id; Show; Sort; hide internal and test accounts; Open; Next →) → `PersonPage` :141 (Account & status · Plan & usage · Feature access · Activity · Notes; *Suspend…* / *Restore…*, *Sign out everywhere*, *Send the link* (reset), *Change the plan*, *Set the access* (Standard / Full / No access), *Set the override* / *Clear it*, *Add the tag* / *Remove the tag*, a note) + `LimitsModal` :452 + delete | `/api/admin/people`, `…/people/:id`, `…/overrides/:key/clear`, `/api/admin/analytics/limits/:id` |
| People · Support | `SupportQueue` adminPeople.jsx:317 → `TicketView` :366 | filter by category / status; reply, internal note, solve; open the person | `/api/admin/tickets`, `…/:id`, `…/:id/messages` |
| People · Messages | `ContactMessagesSection` AdminPanel.jsx:349 | unread only, ↻ Refresh, mark read | `/api/admin/contact-messages`, `…/:id/read` |
| People · New-match alerts | `MatchAlertsSection` adminOps.jsx:776 | read (posting → alert time per source) | `/api/admin/match-alerts` |
| People · Network | `NetworkTab` adminNetwork.jsx:56 | the switch (OFF) + counts | `/api/admin/network` |
| People · Profile reports | `ProfileReportsTab` adminReports.jsx:13 | *Dismiss* / *Actioned* / *Re-open*, a note | `/api/admin/profile-reports`, `…/:id` |
| People · Testers | `TestersTab` adminTesters.jsx:132 + `TesterDetails` adminTesterDetails.jsx:162 (in a `<details>`) | search answers, *Copy the YC numbers*, export CSV | `/api/admin/testers`, `…/export.csv` |
| Data · Job data in and out | `JobDataSection` adminOps.jsx:1000 | *Export the active board (NDJSON) ↓*, postings to import → *Check it — writes nothing* → *Import it*, revert a batch | `/api/admin/job-data/export`, `…/import`, `…/import/batches`, `…/batches/:id/revert` |
| Data · Board-fit scoring | `BoardFitSection` adminOps.jsx:898 | whose profiles → precompute | `/api/admin/board-fit/precompute`, `/api/admin/users` |
| Data · ATS calibration | `CalibrateTab` adminCalibrate.jsx:251 | résumé label + text, your account, the gold set (queued for the agent) | (adminCalibrate.jsx's own calls) |
| Data · Readiness questions | `ReadinessTab` adminReadiness.jsx:9 | *Back to draft* / *Retire* / approve | `/api/admin/readiness`, `…/questions/:id/review` |
| Data · Question bank | `QuestionBankTab` adminQuestions.jsx:52 | filters, *Edit*, *Retire*, approve | `/api/admin/questions`, `…/:id` |
| Data · Database | AdminPanel.jsx:757-766 | → *Open the database inspector* | — |
| Data · Atlas | `AtlasTab` adminAtlas.jsx:625 + `AtlasBacklogSection` :560 + `AtlasCompeteSection` :530 | filter by name / kind / status, *Open page*, *Run auto-publish now*, *Check links now*, *Refresh Wikipedia*, *Ask Wikipedia again*, *Recompute On the board*; backlog *Reject* / draft; compete read | `/api/admin/atlas`, `…/:slug`, `…/auto/run`, `…/links/check`, `…/stats`, `…/wiki/refresh`, `…/wiki/ask-again`, `/api/admin/atlas-backlog`, `/api/admin/atlas-compete` |
| System · Runs | `RunsTab` adminRuns.jsx:45 | *Trace* a run, *‹ All runs* | `/api/admin/runs`, `…/:id` |
| System · Feature switches | `KillSwitchSection` adminOps.jsx:532 · `FullAutoPrerequisitesSection` :589 · `QuickChecksSection` :648 · `SubmitOutcomesSection` :672 · `TailoringAdminSection` :811 · `PluginTab` :1768 (+ `ReviewerAccount` :1861) | the full-auto kill switch, safety checks, A137 minimum score, the BYOM plugin switch, reviewer account password | `/api/admin/full-auto`, `…/prerequisites`, `/api/admin/quick-checks`, `/api/admin/submit-share`, `/api/admin/submit-families/:f`, `/api/admin/tailoring`, `/api/admin/byom`, `…/byom/reviewer` |
| System · Tools service | `ToolsServiceSection` adminOps.jsx:1540 | read | `/api/admin/tools-service` |
| System · Diagnostics | `DiagnosticsTab` adminDiagnostics.jsx:13 · `BackgroundJobsSection` :59 · `PostingArchiveSection` :81 · `HirebaseSection` :102 · `HirebaseFeedSection` :159 | Refresh, *Issue a 24-hour read token*; Hirebase day / month caps → *Save caps*; feed shares → *Save shares*, *Sample report* | `/api/admin/system/diagnostics`, `…/diag-token`, `/api/admin/jobs`, `/api/admin/posting-archive`, `/api/admin/hirebase`, `…/feed`, `…/sample-report` |
| System · Model usage | `ModelUsageTab` adminUsage.jsx:19 · `ModelGatewaySection` adminGateway.jsx:123 · `FlagsSection` adminFlags.jsx:86 | the cost alarm (dollars a day, why) → *Set the alarm*; gateway telemetry; runtime flags | `/api/admin/model-gateway/usage`, `…/cost-alarm`, `/api/admin/model-gateway`, `…/telemetry`, `/api/admin/flags` |
| System · Notices | `NoticesTab` adminOps.jsx:1902 | audience, subject, body, why, test to me, ceiling → dry run → *Send a notice* | `/api/admin/notices`, `…/dry-run`, `…/send` |
| System · Email health | `EmailHealthTab` adminEmail.jsx:17 | search the suppression list, *Remove* (why, required) / *Undo*, send a bounce / complaint test | `/api/admin/email-health`, `…/suppressions`, `…/remove`, `…/undo`, `…/test` |
| System · Admins | `AdminsTab` adminAdmins.jsx:17 (owner only) | add (email) → *Add and send a sign-in link*, set a password (twice), disable (why, required), Cancel | `/api/admin/admins`, `…/:email` |
| System · Appearance | `AppearanceTab` adminAppearance.jsx:15 | the Admin pages' look; *Offer Studio to users* / *Offer Dusk to users* — Offer it / Don't offer it | `/api/admin/appearance` |

### 2 · The DB inspector (`/admin/db`, `client/src/pages/admin/DBInspector.jsx`)
| Row | Where |
| --- | --- |
| Header: *← Admin Dashboard*, *Refresh*, *Auto-refresh* | `DBInspector.jsx:2099-2160` |
| Tabs: **Pipeline Health** (scrape monitor, refusal reasons) · **Schema Explorer** (tables, graph, export, a table's rows / data, export a table) · **User Pool** (one user's pool) · **Job Review** (reassign, impact, undo) · **Job Trace** (one posting's path) · **Query Simulator** (read-only SQL, simulate jobs) | `DBInspector.jsx:30-37` |
| API: `/api/admin/db/pipeline-health`, `scrape-monitor`, `refusal-reasons`, `schema`, `schema/graph`, `schema/export`, `tables`, `table-rows/`, `table-data/`, `export/`, `user-pool/`, `job-review`, `job-review/reassign`, `…/impact/`, `…/undo/`, `job-trace/`, `raw-query?sql=`, `simulate-jobs/` | `DBInspector.jsx` |

### 3 · Admin sign-in (`client/src/pages/AdminLoginPage.jsx:106`)
*Admin Access*: admin email + password (`POST /api/admin/auth/login`) · *email me a sign-in link* (`/api/admin/auth/link` → the C3 email, `/admin/set-password?token=`) · the **break-glass passphrase** (`/api/admin/auth/break-glass` → the C4 email) · the legacy user sign-in (`/api/auth/login`, username or email).

### 4 · `/dev`
`/dev/plate` — the plate gallery (`client/src/pages/dev/PlateGallery.jsx`: every component × state, `?w=390`, `?only=`,
`?state=`, `?extremes=1`, `?plain=1`, and the Wave 2 mocks `?page=<id>`). Already plate; nothing to move.

## M2 · The brief — tokens and components only

No atlas name, no drawings, no hero plate, no squares (the D197 row). **Palette:** Region **IV** for rules and the
selected tab's shadow; **clay = the one primary write per panel** (*Add it*, *Send a notice*, *Import it* — never a read);
**green only for proven** (a check that passed, a deploy that is live); amber / red states are words with a dot, never fills.
**Density:** the gazetteer's row height trimmed to 36 px (a `dense` variant — the one library addition this page wants,
proposed not built; the mock uses the existing Gazetteer), the mono 10 px labels, a 1280 column with two-part rows.

**Each kind of control → its library piece:**

| Kind today | Plate piece |
| --- | --- |
| The five groups (depth buttons with a question) | `AreaNav` views (group label; its question as the view's `title`) |
| A group's sections (underlined tabs) | `BinderTabs` |
| A number / tile / "state as numbers" (D83 rule ②) | `StatsStrip` (each cell answers — D200 Rule 2: it filters or opens) |
| A table of rows (users, tickets, runs, companies, batches, crawler tasks, suppressions, questions) | `Gazetteer` (sideways scroll inside its box; a row opens) |
| A search box | `NavSearch` (in the area nav) or a plate input row |
| A filter row (Show, Sort, category, status, kind, unread only, hide test accounts) | `FilterChips` |
| A status (active, suspended, pending, failed, amber / red, published / draft) | `StatusTag` (a word; a mark) |
| A harmless read action (Refresh, Open, Trace, Show) | `pl-btn` (paper) |
| THE one write of a panel | `pl-btn--primary` (clay) |
| A destructive / guarded write (Suspend, Delete, Restore a backup, Revert, Disable, Remove) | `pl-btn--secondary` that opens a confirm `Ticket` with the *Why* field + *Undo* after (D83 rule ⑤) |
| A switch (kill switch, offer a theme, network on/off, plugin) | a `pl-btn` with `role=switch` + the word (*ON* / *OFF* as `StatusTag`) |
| A detail page (a person, a ticket, a run trace) | `FactSheet` (label / value rows) + the panel's actions |
| A banner (disk amber / red, the funding alert) | `Ticket` (`tone="clay-tint"` only when it needs the admin now) |
| A dialog (delete user, limits, set password) | a `Ticket` with its fields, over a dimmed page |
| The DB inspector's tabs / tables / query box | `BinderTabs` / `Gazetteer` / `CodePlate` (the SQL and the trace) |
| Admin sign-in | the plate's sign-in (shared with #17's A138 component) in plate tokens |

### Where each M1 row lives (D200 Rule 1)
Every §1 row keeps its panel, its controls and its API; only the pieces change per the table above. The frame's rows: the
DB Inspector card → a `Ticket` in the area nav's *More*; the disk banner → a `Ticket` above the tabs; the URL place →
unchanged. **Unclear homes (owner at M4):** (a) the **Appearance** panel's *the Admin pages' look* (Studio, D133) — the
plate replaces Studio on Admin, so this switch may be struck; (b) **Enrichment**'s file drop ("drop reply files here")
has no plate piece — proposed a `Drawer`-styled drop target; (c) **Calibrate**'s large paste areas and **Notices**' body
— a plate textarea style is not in the library (inputs are, via `NavSearch` / Cartouche only); (d) the DB inspector's
**schema graph** (a drawing) — "no new art" says keep it as is, restyled to ink lines.

## M3 · The mock
`/dev/plate?page=admin` — **People → Users** drawn densely: the area nav (the five groups as views, *Find a person*),
the sections as binder tabs, the stats strip (people · active in 7 days · suspended · overrides), the filter chips,
the users as a Gazetteer (12 synthetic people), and an open person (FactSheet + the actions: one clay write, the
guarded writes dashed-confirm). At 390 the table scrolls inside its box and the person stacks below.

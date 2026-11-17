# UI_PRIMITIVES — D122 P1 audit

*2026-10-31 · read-only audit of `client/src/` and `extension/` · spec: WORKLOG D122 (P1) · rules: D60 no pills, A93 one implementation (CLAUDE.md). Paths are relative to `client/src/` unless they start `extension/`. Counts come from grep / awk over `*.jsx` / `*.js` / `*.css`. A `<button>` was classified by its own tag text (up to 8 lines), so a button styled by a spread, a parent selector or a computed className counts as "no class / inline style". The counts are approximate. Facts only: P2 decides what to change, after the owner has read this.*

> Recorded at the time of the audit: the session's own fix to the Learn panel (`7e48205`) added DepthButton's `wrap` variant. It is used at one call site (`LearnCircle.jsx`), and D121's `SponsorshipSignal.jsx` was being added as this was written.

## 1 · The primitives at a glance

| Primitive | File | What it is | Importers | Hand-rolled copies |
|---|---|---|---|---|
| **DepthButton** / `.dbx` / `.dbx-depth` skin | `components/DepthButton.jsx:16`, `DepthButton.css:2,56` | the depth box (D48) — box 42px / compact 30px / square 48px, optional `wrap` | 16 files, 107 `<DepthButton>` call sites; `.dbx-depth` worn in 33 files | **≈ 417 of ≈ 480 `<button>` sites carry no `dbx` class** — two parallel class systems (`.rm-btn` 86, `.dh-btn` 20), ≈ 123 inline-style buttons, 9 local button components, 1 raw-class copy |
| **CompanyBubble** | `components/CompanyBubble.jsx:21` | the bubble standard: rounded square, CompanyLogo, one status ring | **2** (`DraftHouseSide.jsx:2`, `DraftHouseTree.jsx:2`) | JobBubble's logo button and squares, ProfileSections `LogoTile`, `.pp__logo`, Atlas `.atree__fsq`, extension `.tile` (declared mirror) |
| CompanyLogo | `components/CompanyLogo.jsx` | the one company mark (D61) | 7 | `ProfileSections.jsx:50` LogoTile; `CardBack.jsx:52` (the blurred back, intentional) |
| **Status ring** | `styles/rings.js:8` | 7 ring states as colour tokens | 3 (`CompanyBubble.jsx:17`, `DraftHouseTree.jsx:4`, `lib/draftHouseTree.js:25`) | the Atlas's own 3-state ring, twice (`AtlasTree.css:61-65`, `:84-87`) |
| **Fan / card** | `panels/DeckView.jsx:411` FanCard, `lib/fanGeometry.js`, `components/JobBubble.jsx`, `components/JobCard.jsx:444` | deck card · board card · legacy card | fanGeometry 3 · JobBubble 1 (`JobsPanel.jsx:20`) · JobCard 2 (`DatabasePanel.jsx:9`, `LandingPage.jsx:29`) | at least 7 job renderers (§5) |
| **SectionHeading** | `components/SectionHeading.jsx:8` | title · count · note · rule | **1 real consumer** (`WaitingLine.jsx:9`) + a re-export (`AutoApplyPanelSections.jsx:25`) | `CompanyHeading`, `SectionLabel`, `.rc__head`, `.dh-drawer__head`, admin `h2`, 32 inline uppercase eyebrows in DBInspector |
| SettingsSection | `components/SettingsSection.jsx:11` | a titled settings card | 5 | `IntegrationsPanel.jsx:51` wraps it in a private `Section` (a thin wrapper, not a copy) |
| **Drawers / overlays** | `components/PanelShell.jsx`, `components/AutoSettingsDrawer.jsx` (`.dh-drawer`, `DraftHouse.css:215`) | the dock overlay frame; Draft House's right-edge drawer | PanelShell 4 · AutoSettingsDrawer 1 | a second drawer + ≥ 14 scrim+modal copies (§7) |
| **Toasts** | `components/DecisionToast.jsx:24` | the undo toast | 2 (`DeckView.jsx:52`, `JobsPanel.jsx:17`) | shadcn `ui/toast` + `toaster` (mounted, never called), `.lrc__toast`, the extension's `rm-capture-toast` |
| **EmptyState** | `components/EmptyState.jsx:4` | display-serif title + a sentence | 2 (`DatabasePanel.jsx:39`, `JobsPanel.jsx:5`) | 6 inline copies, 7 CSS-class copies (§9) |
| **Mark** | `styles/mark.js`; `.mark` at `DepthButton.css:64` | the D60 status / tag rectangle | mark.js in 23 files; `.mark` class in 8 | `.ah__status`, `.posting__pill`, `.cz-opt__tag`, `TilePill`, `.rm-badge`, DBInspector `Pill`, `CA_CHIP` |
| **StatCard** | `components/StatCard.jsx:4` | a figure with its label | 2 (`DBInspector.jsx:10`, `AdminPanel.jsx:19`) | `adminKit.jsx:32` NumberBox |
| ResourceTile (D119) | — | named in the spec | **not built yet** | — |

## 2 · DepthButton (`.dbx`, `.dbx-depth`)

The component is at `DepthButton.jsx:16-34` and `.dbx` at `DepthButton.css:2-9`. `.dbx-depth` is the skin for an element that keeps its own markup (`:56-59`). The extension mirror is declared at `modules.manifest.js:268` (`extension/ui.css .btn`).

**Importers (107 calls).** adminAtlas 30 · adminEnrichment 17 · JobDetailPanel 10 · adminAdmins 9 · LearnCircle 9 · adminLearnCircle 8 · adminEmail 6 · AtlasTree 5 · 1–2 each in DecisionButtons, ByomResumeChoice, AppearanceSettings, adminKit, adminLearnImport, CustomisePanel, AtlasPage, ResumeChangesPanel.

**`.dbx-depth` wearers (top four).** JobsPanel 16 · AutoApplyPanelSections 9 · AtlasTree 7 · AuthScreen 7.

**The gap.** Of ≈ 480 `<button` sites, ≈ 63 carry a `dbx` class and ≈ 417 do not. By first class:

| Kind | Sites |
|---|---|
| inline style | 123 |
| no class or inline style | 100 |
| `rm-btn` | 86 |
| `dh-btn` | 20 |
| `ah__btn` | 7 |
| `dh-bulk`, `byom__link`, `ah__chip` | 4 each |
| one-off classes (`jb__sq`, `fh-ct`, `lrn__jump`, `navbar__btn`, `lp__page-btn`, `dht-x` …) | ≈ 50 |

### 2a · Parallel button class systems (→ DepthButton)

- **`.rm-btn`** (`themes/cinematic.js:162-197`) is a depth box by its own comment ("the same values as DepthButton", `:158-161`). It is a second implementation, with `-primary`, `-ghost`, `-sm` and `-icon` variants and `white-space: nowrap` (`:172`).
  - Sites per file: ProfileSections 20, ProfilePanel 18, JobWorkspacePanel 18, ApplicationInbox 8, JobProfilesPanel 7, AdminPanel 7, DatabasePanel 6, PendingApplications 6, ExtensionPrompt 3, RecruiterPanel 2, AutoApplyPanel 2, JobsPanel 1, ExtensionPage 1.
  - Examples: `ProfileSections.jsx:90,108,112,115,116,152,153,175` · `JobWorkspacePanel.jsx:67,80,159,235,237,275,276` · `ProfilePanel.jsx:137,165,170,254,824` · `DatabasePanel.jsx:660,664,740,741` · `JobsPanel.jsx:4136` (on a `<Link>`).
- **`.dh-btn`** (`DraftHouse.css:36-46`) is a third depth box, with `data-kind` primary / danger.
  - Sites per file: AutoApplyPanel 15, AutoSettingsDrawer 7, DraftHouseTree 5.
  - Examples: `AutoApplyPanel.jsx:610,639,642,673,742,744,777,779` · `DraftHouseTree.jsx:110`.
- **`.ah__btn` / `.ah__chip` / `.ah__link`** (`ApplicationHistory.css:26-34`, a depth box by its comment at `:27`): `ApplicationHistory.jsx:114,141,145,346,357,362,375,387`.
- **`.dht-chip`** (`DraftHouse.css:71`, radius 4, no depth) at `DraftHouseTree.jsx:24`; its `.dht-zoom` +/− at `:30-31`.
- **Flat buttons with no depth:** `.navbar__btn` (`NavBar.css:69`) and `.usb__btn` (`UnifiedSearchBar.css:268`).
- **`.byom__go`** (`ByomResumeChoice.jsx:159`) sets the raw class `dbx dbx--box dbx--p byom__go` instead of using the component. It is the only raw-class copy.

### 2b · Inline-style button objects

| File:line | Objects | Buttons |
|---|---|---|
| `panels/AccountPanel.jsx:30-33` | `btn` / `btnQuiet` / `btnDanger` (radius 8, flat) | **27, 0 dbx** (e.g. `:69,161,178,312,314,321,347,355`) |
| `panels/SavedAnswersPanel.jsx:116` | `btn` | **15, 0 dbx** (`:135,157,158,187,188,202,218,219`) |
| `components/NotificationSettings.jsx:13` | `btnQuiet` | — |
| `components/WaitingLine.jsx:16` | `btn(theme, disabled)` | — |
| `components/CoverLetterModal.jsx:69` | `btn(accent, secondary)` | — |
| `panels/IntegrationsPanel.jsx:287` | `buttonStyle` | — |
| `panels/SandboxPanel.jsx:295` | `btnStyle()` | — |

Inline buttons with no object behind them:

- `JobsPanel.jsx:3763`, `:4628-4637` (SearchIntentDialog)
- `AutoApplyPanelSections.jsx:182,291,300,307`
- `DBInspector.jsx:175,178,181,372,853,864,884` (24 non-dbx in the file)
- `DocToolbar.jsx` (6)
- `pages/tools/*` (≈ 9)

### 2c · Local button components (a second primitive under another name)

| File:line | Component | What it is |
|---|---|---|
| `panels/JobsPanel.jsx:243` | `LucyBtn` | glass at rest, orange on hover, `whiteSpace: nowrap, flexShrink: 0` (`:261`); 7 uses |
| `panels/DeckView.jsx:117` | `ActionButton` | `motion.button`, glass, radius 16, minHeight 48/54; 3 uses |
| `panels/DeckView.jsx:133,263` | `StepButton`, `CollapseButton` | `.dbx-depth` + glass, 32×32 |
| `components/JobCard.jsx:384` | `IconBtn` | — |
| `pages/AdminLoginPage.jsx:77,90` | `PrimaryButton`, `QuietButton` | `.dbx-depth` + inline styles |
| `components/ui/PanelControls.jsx:132` | `DateFilterButton` | inline, nowrap (`:149`) |
| `pages/marketing/ExtensionPage.jsx:38` | `ExtensionInstallButton` | — |
| `components/DecisionButtons.jsx:16` | `DecisionPill` | **correct** — it wraps DepthButton (`:19`); only the name says Pill |

### 2d · Extension button sets

- `extension/ui.css:40` `.sq`, `:53` `.btn`, `:77` `.link` / `.mb` (the declared mirror)
- `extension/dock.js:291,296,303` (`.btn`, `[data-role=fill]`, `.btn.ibtn`)
- `extension/resumePanel.js:354` `.btn`
- `extension/review-overlay.js:514` `#ID .rm-btn`
- `extension/popup-layer.js:58` `button, .tg`

### Worst files for the button gap (non-dbx / dbx)

| File | Non-dbx / dbx |
|---|---|
| AutoApplyPanel | 29 / 1 |
| AccountPanel | 27 / 0 |
| DBInspector | 24 / 1 |
| ProfilePanel | 23 / 2 |
| ProfileSections | 20 / 0 |
| ApplicationHistory | 18 / 0 |
| JobsPanel | 17 / 16 |
| JobWorkspacePanel | 16 / 0 |
| SavedAnswersPanel | 15 / 0 |
| DatabasePanel | 14 / 1 |
| TopBar | 13 / 0 (`:148,211,246,298,333,363,372,376`) |
| DraftHouseTree | 11 / 0 |

## 3 · CompanyBubble

`components/CompanyBubble.jsx:21-40` is a rounded square around CompanyLogo with one ring from `styles/rings.js`. Its header names who should adopt it next: JobBubble's squares, The Table's company column and the Atlas's company nodes (`:13-14`). It has **2 importers**: `DraftHouseSide.jsx:2` and `DraftHouseTree.jsx:2`.

Copies:

- `components/JobBubble.jsx:81-83` — the `.jb__logo` button around `CompanyLogo size={52} radius={13}` (`JobBubble.css:30`), with no ring. The board's squares are `.jb__sq` (`JobBubble.jsx:101,107,113`; `JobBubble.css:91`, 52px).
- `components/ProfileSections.jsx:50-56` — `LogoTile` (32px, radius 6). It has its own letter fallback and bypasses CompanyLogo.
- `components/JobDetailPanel.css:11` — `.pp__logo`.
- `components/ApplicationHistory.jsx` (The Table) imports neither CompanyLogo nor CompanyBubble; its company column is text only (`.ah__company`, `ApplicationHistory.css:56`).
- `pages/atlas/AtlasTree.css:61` — `.atree__fsq`, a 28px rounded square with its own ring via box-shadow (`:62-65`), used at `AtlasTree.jsx:57` and `YourMap.jsx:36`.
- `extension/ui.css:106` — `.tile`, the declared mirror of CompanyLogo (`modules.manifest.js:265`).

## 4 · Status ring

`styles/rings.js:8-17` defines 7 states, plus `ringVar` (`:21`). Its importers are CompanyBubble, DraftHouseTree and `lib/draftHouseTree.js:25`.

The Atlas has its own ring, twice: `AtlasTree.css:84-88` (`.atree__ring--have/--rises/--other`; an SVG rect at `AtlasTree.jsx:40`) and `:62-65` (`.atree__fsq--*`). Both use success / accent / info colours outside the RINGS vocabulary.

## 5 · Fan / card

- **The fan:** `panels/DeckView.jsx:411` FanCard on `lib/fanGeometry.js`, used by DeckView `:53`, `DealBackdrop.jsx:13` and `DeckGeometryControl.jsx:17`. Card backs come from `CardBack.jsx` (DeckView `:43`, DealBackdrop `:11`).
- **The board card:** `JobBubble.jsx`, used only by `JobsPanel.jsx:20,4288`.
- **The legacy card:** `JobCard.jsx:444`, marked "scheduled for removal" (`modules.manifest.js:79`) but still live at `DatabasePanel.jsx:9,1115` and `LandingPage.jsx:29,36`.

Other job / application renderers:

| File:line | Renderer |
|---|---|
| `components/DraftHouseTree.jsx:90` | `LeadCard` (`.dht-card`, `DraftHouse.css:132`) |
| `components/DraftHouseTree.jsx:138` | `RunCard` |
| `panels/AutoApplyPanelSections.jsx:88,332,624` | `ApplicationObstacleCard`, `ApplicationRow`, `AttemptRow` (used at `AutoApplyPanel.jsx:630,634,1452,1486`) |
| `components/ApplicationHistory.jsx:408,445,490` | `.ah__row`, `.ah__card` |
| `components/PendingApplications.jsx` | 6 title / company field reads |
| `pages/admin/DBInspector.jsx` | 17 field reads, in row grids |
| `components/ui/TileCard.jsx:77` | `TileCard` / `TileGrid` (profiles, `JobProfilesPanel.jsx:206`) |

## 6 · SectionHeading (and SettingsSection)

`components/SectionHeading.jsx:8-23` is a display-serif h3 with count, note and rule; the h3 itself is `whiteSpace: "nowrap"` (`:12`). It has one consumer, `WaitingLine.jsx:9` (`:32`). `AutoApplyPanelSections.jsx:25` re-exports it, but nothing else renders it.

Copies:

- `AutoApplyPanelSections.jsx:38` `CompanyHeading` (deliberately "a tier below", `:34`)
- `CompanyKbSections.jsx:19` `SectionLabel`
- `adminKit.jsx:42` `h2` style
- CSS headings: `ResumeChangesPanel.css:9-10` `.rc__head h2` · `DraftHouse.css:190` `.dh-group__h` · `:220-221` `.dh-drawer__head h2` · `AtlasPage.css:11-13` `.atl__head` / `__kicker` / `__title` · `LearnCircle.css:61` `.lrc__title`
- Inline uppercase eyebrows: DBInspector 32 · ProfilePanel 5 · AutoApplyPanelSections 5 · JobsPanel 4 · AdminPanel 4 (e.g. `thStyle`, `AdminPanel.jsx:607-612`)

SettingsSection (`components/SettingsSection.jsx:11`) has 5 importers. `IntegrationsPanel.jsx:51` wraps it in a private `Section`, which is fine.

## 7 · Drawers and overlays

The shared ones are `components/PanelShell.jsx` (PanelShell, PanelScrim, PanelDock, `:77,112`; imported by `JobDetailPanel.jsx:8`, `AtsReportPanel.jsx:2`, `SandboxPanel.jsx:18`, `JobsPanel.jsx:27`) and `components/AutoSettingsDrawer.jsx` (`.dh-scrim` / `.dh-drawer`, `DraftHouse.css:214-224`; imported by `AutoApplyPanel.jsx:23`).

**A second right-edge drawer.** `panels/JobsPanel.jsx:484-500`, the filters drawer, has its own portal, scrim and `motion.div x:360`.

**Scrim + modal copies** (each `position: fixed; inset: 0` with its own card):

| File:line | What | Notes |
|---|---|---|
| `components/CompanyViewModal.jsx:27` | — | |
| `components/CoverLetterModal.jsx:56` | — | |
| `components/DomainProfileWizard.jsx:294` | — | |
| `components/ResumeChangesPanel.jsx:161` | `.rc__scrim` | `ResumeChangesPanel.css:5` |
| `panels/JobsPanel.jsx:3784` | Enhance | |
| `panels/JobsPanel.jsx:4615` | SearchIntentDialog | z 750 literal |
| `panels/JobsPanel.jsx:4654` | CompanyReuseModal | z 1000 literal |
| `panels/AutoApplyPanel.jsx:995` | Review | |
| `panels/DatabasePanel.jsx:164` | — | |
| `panels/DeckView.jsx:288-292` | bottom sheet | |
| `panels/DeckView.jsx:975` | shortcuts | |
| `panels/AdminPanel.jsx:489` | — | z 1100 |
| `panels/adminPeople.jsx:472` | — | z 1100, although the file imports adminKit's `Dialog` (`:39`) |
| `panels/adminKit.jsx:72-80` | `Dialog` | the admin's own shared dialog, z 50 |

`components/NavBar.css:113` `.navbar__drawer` is the marketing mobile drawer.

## 8 · Toasts

`components/DecisionToast.jsx:24-35` is centred by margins; its comment explains why `left: 50%` + translate is wrong (`:9-10`). Its importers are `DeckView.jsx:52` and `JobsPanel.jsx:17,3585`.

Copies:

- **shadcn `components/ui/toast.jsx` + `ui/toaster.jsx` + `hooks/use-toast.js`.** Mounted at `App.jsx:642`. `JobsPanel.jsx:36` imports `toast` but never calls it, and no `toast({` / `useToast` caller exists outside the hook. It is a second toast system with no callers, styled `rounded-md` (`ui/toast.jsx:40`).
- **`pages/atlas/LearnCircle.jsx:333` `.lrc__toast`** (`LearnCircle.css:117-120`) uses `left: 50%; transform: translateX(-50%)` — the pattern `DecisionToast.jsx:9-10` says shrink-wraps a toast to half the viewport.
- **Extension:** `extension/extractor.js:385-395` `showCaptureToast` (`#rm-capture-toast`, inline styles), besides the popup layer's `kind: 'toast'` (`autofill-badge.js:240`, `applyAway.js:236`).

## 9 · EmptyState

`components/EmptyState.jsx:4-12` has two importers: `DatabasePanel.jsx:39` (TableEmptyState, `:1153-1155`) and `JobsPanel.jsx:5` (BoardEmptyState, `:4412-4416`).

**Inline copies:**

- `ExtensionPrompt.jsx:98-110` SavedEmptyState
- `JobsPanel.jsx:4434` Paging, `:4498` Filtered, `:4535` NoPool and `:4564` RoleScoped empty states, each with its own flex-centred div (`:4439,4502,4539,4568`)
- `JobsPanel.jsx:4144` ImportedEmptyState
- `DeckView.jsx:877-882`

**CSS-class copies:**

- `ApplicationHistory.css:42` `.ah__empty` (`ApplicationHistory.jsx:188,404,436,475,480,482`)
- `ResumeChangesPanel.css:48` `.rc__empty` (`ResumeChangesPanel.jsx:168,179,189`)
- `ResumeList.css:9` `.rl__empty`
- `DraftHouse.css:111` `.dht-empty` (`AutoApplyPanel.jsx:971`)
- `LandingPage.css:127` `.lp__empty`
- `DraftHouseSide.jsx:30` `dhs-quiet`
- `YourMap.jsx:113` `atl__quiet`

## 10 · Marks

`styles/mark.js` (`markStyle`, `LOGO_FACE`) and its CSS twin `DepthButton.css:64-78` are the mark. mark.js is imported in 23 files (e.g. `ApplicationInbox.jsx:16`, `JobCard.jsx:17`, `DBInspector.jsx:8`, `adminKit.jsx:6`). The `.mark` class appears in ByomResumeChoice 6, ResumeChangesPanel 10, AtlasPage 4, LearnCircle 4 and others.

Re-declared marks:

| File:line | Copy |
|---|---|
| `ApplicationHistory.css:62-64` | `.ah__status` ("D60: a mark" by its own comment) |
| `PostingPanel.css:68` | `.posting__pill` |
| `Customise.css:55` | `.cz-opt__tag` |
| `ui/TileCard.jsx:151` | `TilePill` (no leading bar, uppercase) |
| `themes/cinematic.js:210-213` | `.rm-badge` (used at `DatabasePanel.jsx:974`) |
| `DBInspector.jsx:53-65` | `Pill` |
| `ProfilePanel.jsx:181-184` | `CA_CHIP` |
| `JobCard.jsx:90,112,173,191,252,261,336` | the legacy card's `WorkBadge`, `VisaBadge`, `TierChip`, `NewPill`, `OutsideUsPill`, `ClosedPill`, `ATSBadge` |
| `PricingPage.jsx:95` | badge |
| `extension/ui.css:91`, `extension/review-overlay.js:510` | `.mkr` — declared mirrors (`modules.manifest.js:266-267`) |

`adminKit.jsx:30` `Mark` and `IntegrationsPanel.jsx:9` `StatusPill` both wrap `markStyle`, which is correct.

## 11 · StatCard

`components/StatCard.jsx:4-20` is used by `DBInspector.jsx:10` (13 uses) and `AdminPanel.jsx:19` (4). Its copy is `adminKit.jsx:32-39` NumberBox, used at `adminKit.jsx:102` and `adminEnrichment.jsx:253-257`.

## 12 · Fixed-width / nowrap sweep (the owner's "fixed and not fluid")

**The root.** `.dbx` itself is `flex-shrink: 0; white-space: nowrap` (`DepthButton.css:4,7`), with a fixed height of 42px for a box (`:24`) and 30px for compact (`:25`). The fluid `wrap` variant is used at exactly one call site (`LearnCircle.jsx`, the go-back button). `.rm-btn` copies the same nowrap (`cinematic.js:172`).

Legend: ⚠ likely overflow (variable or long text that cannot shrink and has no ellipsis) · ○ clipped or a fixed label · · intentional.

| File:line | Pattern | Holds | Risk |
|---|---|---|---|
| `DepthButton.css:4,7,24,25` | nowrap + no-shrink + fixed height | every DepthButton label | ⚠ root |
| `themes/cinematic.js:172` | `.rm-btn` nowrap | 86 labels | ⚠ |
| `ByomResumeChoice.jsx:159` + `.css:41` | raw `.dbx` + `height: 32px` | "Open {label} →" in the 2-column `.byom__flow` (`.css:27`) | ⚠ |
| `ByomResumeChoice.jsx:120-122` | box, no wrap | `mainLabel` ("Write it in {host}") | ⚠ |
| `AtlasTree.jsx:294,298` | compact, no wrap | waypoint names, `flyRouteLabel(tree)` | ⚠ |
| `LearnCircle.jsx:297` | compact, no wrap | route names | ⚠ |
| `adminEnrichment.jsx:322,361,397,434` | compact, no wrap | long sentences | ⚠ |
| `adminEmail.jsx:77-78` | box, no wrap | "Send a test to bounced@resend.dev" | ⚠ |
| `adminAdmins.jsx:114` | no wrap | "Disable — ends every session" | ⚠ |
| `adminKit.jsx:87` | no wrap | `{confirmLabel}` (e.g. `adminEnrichment.jsx:567`) | ⚠ |
| `AutoApplyPanelSections.jsx:182-186` | nowrap + flexShrink 0 | `{item.action}` | ⚠ |
| `AutoApplyPanelSections.jsx:300-303` | nowrap | `{resolveLabel \|\| "Open"}` | ⚠ |
| `AutoApplyPanelSections.jsx:228,241,274,291,307,345,422,530,688,708,740` | nowrap on `.dbx-depth` | fixed labels; `:345` is `{text}` | ⚠ at `:345`, ○ elsewhere |
| `JobsPanel.jsx:261` | `LucyBtn` nowrap + flexShrink 0 | 7 board labels | ⚠ |
| `JobCard.jsx:323,876` | nowrap + noshrink | "Check match", "View company KB →" | ○ |
| `ui/PanelControls.jsx:66` | tab nowrap | `{label}` | ⚠ in a narrow panel |
| `ui/PanelControls.jsx:149` | nowrap | date filter label | ○ |
| `TopBar.css:41-43` | `.tbar-tab` nowrap + noshrink | tabs | ○ (the row scrolls, `:36`) |
| `NavBar.css:45,53,69,76` | nowrap | marketing links, auth buttons | ○ |
| `UnifiedSearchBar.css:152,169,191,268` | nowrap; `.usb__btn` noshrink | select label, options, Search | ⚠ `.usb__sel` / `.usb__opt` (no ellipsis) |
| `SectionHeading.jsx:12` | h3 nowrap | the title | ⚠ in a narrow column |
| `ApplicationHistory.css:62-63` | `.ah__status` nowrap + noshrink | status words | ○ |
| `JobBubble.css:57` | mark nowrap + noshrink | mark text | ○ |
| `DepthButton.css:67` / `mark.js:54` | mark nowrap | every mark | ○ (a long tag can overflow) |
| `ui/TileCard.jsx:162` | `TilePill` nowrap + noshrink | tags | ○ |
| `AdminPanel.jsx:440` | `rm-btn` + nowrap | "Mark read" | ○ |
| `DatabasePanel.jsx:832` | nowrap | date | ○ |
| `DatabasePanel.jsx:1020` | `td` width 120 + nowrap | an action cell | ⚠ |
| `PricingPage.jsx:95` | badge nowrap | `{t.badge}` | ⚠ |
| `ScrollDock.jsx:228,280` | nowrap | `{label}` | ○ |
| `FullHouse.css:66` | `.tok` nowrap | a word | · |
| `DraftHouse.css:109` | `.dht-name` max-width 62px + ellipsis | company name | ○ (hard truncation) |
| `extension/ui.css:83` | `.mb { height: 38px; flex: 1 1 0 }` | small-action text | ⚠ fixed height on wrapping text |
| `extension/dock.js:296` | 64×52 nowrap | "12/43" | · (T21, `:294`) |
| `extension/atsReport.js:687,707` | nowrap | Atlas link word, experience mark | ○ |
| `extension/ui.css:95` | `.mkr` nowrap | mark text | ○ |

### Grids split by the WINDOW where the panel's width is what matters

| File:line | Split |
|---|---|
| `AutoApplyPanel.jsx:201`, `DatabasePanel.jsx:320` | `sideDetail = viewportWidth >= 1280` — the window chooses the side detail, not the panel |
| `DraftHouse.css:51-60` | `.dh-main` 1fr + **340px** side column, collapsed at window 899 |
| `ResumeChangesPanel.css:13,28,34` → `:55-61` | 3- and 2-column grids collapse at window 720, inside a modal |
| `ApplicationHistory.css:99` → `:125-130` | `.ah__timeline` `repeat(5, …)`, collapsed at window 640 |
| `LearnCircle.css:26-27` | 2 columns until window 980 |
| `AtlasTree.css:27-28` | 2 columns until window 940 |
| `Customise.css:8,60-61` | 2 columns until window 980 |
| `JobBubble.css:80` | card reflow at window 640 |
| `PostingPanel.css:108` | strip 2×2 at window 560, although it renders inside the deck and the posting panel (`.pp` is container-based: `JobDetailPanel.css:8,56-57`) |
| `DBInspector.jsx:1174,1839` | `280px 1fr` / `240px 1fr` with no breakpoint, plus 7-column fixed-px row grids at `:459,574,671` |

Already container-based: `.pp` (`JobDetailPanel.css:8`) and `.lrc__piece-body` (`LearnCircle.css`).

## 13 · Worst first

1. **Buttons.** ≈ 417 of ≈ 480 `<button>` sites are not DepthButton, and the primitive itself is the "fixed, not fluid" bug: nowrap + no-shrink + fixed height (`DepthButton.css:4,7,24-25`), with `wrap` used once. `.rm-btn` (86 sites) and `.dh-btn` (20) are full parallel systems.
   - Worst files: AccountPanel 27/0, AutoApplyPanel 29/1, DBInspector, ProfilePanel, ProfileSections, ApplicationHistory, JobWorkspacePanel, SavedAnswersPanel.
   - `LucyBtn` and `ActionButton` → DepthButton.
2. **Modals and drawers.** ≈ 14 scrim+card copies and a second drawer (`JobsPanel.jsx:484`), with literal z-indexes (`JobsPanel.jsx:4615,4654`, `AdminPanel.jsx:489`, `adminPeople.jsx:472`) → PanelShell / AutoSettingsDrawer, or one dialog (adminKit's `Dialog` is the nearest).
3. **Cards.** At least 7 job renderers (JobBubble · JobCard, legacy, live in 2 places · FanCard · LeadCard / RunCard · ApplicationRow / AttemptRow / ObstacleCard · `.ah__row` / `.ah__card` · DBInspector rows) → the fan / card.
4. **Bubbles.** CompanyBubble has 2 importers. JobBubble's logo and squares, `LogoTile`, `.pp__logo`, `.atree__fsq` and the Atlas's own ring → CompanyBubble + rings.js.
5. **Empty states.** 6 inline + 7 CSS copies against 2 users → EmptyState.
6. **Marks.** 7+ re-declared marks plus JobCard's badge family → `.mark` / markStyle.
7. **Toasts.**
   - The shadcn toaster is mounted with no callers.
   - `.lrc__toast` uses the half-width centring DecisionToast forbids.
   - The extension has a second toast.
   - → DecisionToast (or one toast built on it).
8. **Window-width splits inside panels.** `AutoApplyPanel.jsx:201`, `DatabasePanel.jsx:320`, `DraftHouse.css:51-60`, `PostingPanel.css:108`.
9. **Section headings.** SectionHeading has one consumer and is nowrap. `CompanyHeading`, `SectionLabel`, adminKit `h2` and ≈ 50 inline eyebrows → SectionHeading.
10. **StatCard.** adminKit NumberBox → StatCard.
11. **ResourceTile (D119)** is not built yet.

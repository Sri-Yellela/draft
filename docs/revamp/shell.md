# D197 Wave 1 · #1 — THE SHELL · M1 feature inventory

Read from the code on 2026-11-24 (47g, `b9dfcf16`). Paths are under `client/src/`. The shell is the dock, each area's nav, the
narrow / phone layout and the `/d` logo. The rule (D197 M1): the plate shell keeps every row below, or the owner strikes it.
The PR that lands the shell ticks each row.

The sketch is v3 *The shell · dock and area nav* (`docs/sketches/Atlas plate system.html`; ⚠ A236: the v4 export holds
only the explainer pages). The plate components already exist in `plate/Shell.jsx` (`PlateLogo`, `Wordmark`, `Ruler`,
`Dock` + its `bar` variant, `NavChip`, `NavSearch`, `AreaNav`). They are mounted only in `/dev/plate`.

## 1 · The dock (`components/AppNav.jsx`, mounted by `components/TopBar.jsx:558`, fed by `App.jsx:500-523, 757-766`)

| ☐ | Item / behaviour | Today | file:line |
| --- | --- | --- | --- |
| ☐ | One navigation | `<nav aria-label="Main" data-nav-dock>` portalled to `<body>`; the side Menu is retired (45n) | AppNav.jsx:774, 717 |
| ☐ | Order | Search · /d · Home · Atlas · Interview · [Network · Feed · Messages] · Profile | AppNav.jsx:69, 185-201 |
| ☐ | **Search** | turns the dock into `DockSearch` ("Search people, companies, jobs", ✕ to close). A role / tech / words + Enter → `requestBoardSearch` → `/app/jobs`; a company or person opens its page; Esc / ✕ closes; widens a top / phone dock to min(640px, 100vw − 32) | AppNav.jsx:142-169, 782-785; AppNav.css:299 |
| ☐ | **/d → the market** | aria "draft"; `/app/today` → `/app/jobs`; the click bumps the board's refresh key; active on the board | AppNav.jsx:211-218; App.jsx:573-602, 627-629, 760 |
| ☐ | **Home** | `/app/auto-apply`; badge = needs-attention count, "N drafts need your attention", "9+" over 9 | AppNav.jsx:86-92, 171-182; App.jsx:254-275 |
| ☐ | **Atlas** | `/app/atlas`; active on any `/app/atlas…` | AppNav.jsx:93-99; App.jsx:486 |
| ☐ | **Interview** | `/app/interview/upcoming` | AppNav.jsx:100-106, 187-190 |
| ☐ | **Network · Feed · Messages** | only while `app_settings.network_enabled` is on (`GET /api/network/status`, polled every 60 s); Messages carries the unread badge ("N unread"), refetched on `rm:network-read` | AppNav.jsx:108-129, 195-199, 606-615 |
| ☐ | **Profile** | the avatar (initials as a fallback); opens the ProfilePeek, doesn't navigate; badge = unread notifications; signed-in only | AppNav.jsx:243-264; TopBar.jsx:80-107, 559-560 |
| ☐ | **ProfilePeek** (`#appnav-peek`, dialog) | picture · name → About · email · Saved answers · the auto-apply segment *Ask me first / Apply for me* (`POST /api/apply/mode`; Apply for me locked with its reason) · Connections ("N need you" — ⚠ never fed) · Appearance (theme name) · Notifications (unread) · Open Profile · Sign out; modified clicks open a new tab | AppNav.jsx:290-334 |
| ☐ | **Tiny** (Ask draft, D190) | the fox bubble bottom-right (60 px) → `AskDraftPanel` (380 × 560): the thread, *Use as my answer*, Undo, Yes / No, Confirm / Cancel, Enter sends / Shift+Enter new line, Speak (when supported), Ask, the opt-in "Use my questions to improve Atlas" (`PUT /api/assistant/settings`); opens on `draft:ask-question` / `draft:open-questions` | AppNav.jsx:274-282, 350-603; AppNav.css:198-210 |
| ☐ | Expand / fold | rail 60 px at rest, 196 px open, names fade in after 0.1 s; opens on hover (hover devices only), focus-within, M; folds on leave, blur, outside press, Esc; a tap on touch navigates at once; stays open while the peek is open | AppNav.jsx:629-632, 706-715, 774-780; AppNav.css:83-103 |
| ☐ | Peek timing / placement | opens after 350 ms hover, closes 250 ms after leaving; a press toggles it and focuses its first control; beside a side dock or below a top dock, kept on screen | AppNav.jsx:738-766 |
| ☐ | Active item | `aria-current="page"`, the surface-2 fill | AppNav.css:21 |
| ☐ | `<html>` attributes | `data-dock-open`, `data-dock-place`, `data-ask-open` (A200's timeline fold reads the last) | AppNav.jsx:692-704; DraftHouse.css:180 |
| ☐ | Reduced motion | every transition instant | AppNav.css:281-286 |
| ☐ | Keyboard | **M** toggles (not in inputs or with modifiers; `aria-keyshortcuts="M"`); **Esc** closes the peek → Tiny → folds the dock, returning focus; in search Enter / Esc; every item is a real link | AppNav.jsx:158-162, 213-216, 719-733, 776 |
| ☐ | Placement | `phone` ≤ 600 px; `side` when the content's left margin is ≥ 244 px (196 + 2 × 24); otherwise `top` (a centred row that scrolls away, a reserve spacer above the content); re-measured on resize, main's ResizeObserver and font load | dockPlace.js:7-16; AppNav.jsx:652-691; AppNav.css:56-57, 107-125 |

## 2 · Each area's nav

| ☐ | Area | Today | file:line |
| --- | --- | --- | --- |
| ☐ | **Market** (`/app/jobs`) | the plate (default since `4fe6fe15`; `?plate=0/1`, stored `draft.plate.market`): hero → bearing → openings with BinderTabs **Deck / Terrain / Index** (tablist, ← →; Terrain a "not yet" drawer), onward tickets (Ledger with the needs-you count, company sheet, Atlas) | plate/marketPlate.js:8-40; plate/MarketOpenings.jsx:22-26, 85-116; plate/Plates.jsx:115-127 |
| ☐ | Market — the board row | `ViewSegment` **All jobs · Starred · Imported** with counts; *Import a job* (opens `ImportJobBox`, switches to Imported); the search bar + the sort panel (Best fit only with a résumé); sticky at `--app-chrome-height`; counts row (jobs · new today · saved); `?view=pending` still read, not offered | App.jsx:293-457, 701 |
| ☐ | **Home** (`/app/auto-apply`) | header *Home* + summary + "Today's question · 2 minutes"; Import · Export (Excel / CSV) · *Send all ready (n)*; the auto-apply bar (status, mode with the lock's reason, Pause / Resume, Settings → the drawer with *The full sheet*); up to 3 needs-you cards; tabs **Applications n · Inbox n new**; ≤ 899 px one column and **Applications · Inbox · Auto-apply timeline** | panels/AutoApplyPanel.jsx:1485-1621; DraftHouse.css:183-186 |
| ☐ | **Atlas** (`/app/atlas/<panel>`) | PlaceNav "Your way through the market": **You** (Your map · Your run · Your skills) · **Grow** (Library · How it works · Today's question · The audit) · **Explore** (Roles and skills · This week's market · Glossary) · **Compete** (league, challenges — only when `/api/atlas/compete` turns each on; signed in); aliases; the signed-out Overview; the role / skill search | pages/atlas/atlasPanels.js:13-77; pages/atlas/AtlasPage.jsx:388-472 |
| ☐ | **Profile** (`/app/profile/<panel>`) | PlaceNav "You and your résumé": **You** (Your profile · Saved answers) · **Applying** (Auto-apply with its mode · Connections) · **You and draft** (Appearance with the theme · Notifications · Privacy and your data · Account); the legacy routes forward; `/app/job-profiles` its own page; `/app/plans` only with monetisation; Appearance holds the layout options (Filter sentence, Learning links, Text size) | pages/profile/profilePanels.js:15-56; ProfilePage.jsx:160-230; themes/layoutOptions.js:39-40 |
| ☐ | **Interview** (`/app/interview/<panel>`) | PlaceNav "Ready for the room": **Coming up** (Your interviews + count) · **Prepare** (Company guides · Tracks by round) · **Practise** (Mock interview · Ask the coach · Drills · Defend your résumé) · **After** (Past sessions · Debrief); unbuilt panels say so | pages/interview/interviewModel.js:13-30; InterviewPage.jsx:296-339 |
| ☐ | PlaceNav itself | a sticky 232 px card, groups of links, `aria-current`, a meta; ↑ / ↓ wrap, Home / End; ≤ 900 px wrapping rows, group labels hidden | components/PlaceNav.jsx:15-63; PlaceNav.css:36-48 |
| ☐ | **Network / Feed / Messages** | no sub-nav; old `?tab=` links forward; "not available yet" while the switch is off | pages/network/NetworkPage.jsx:36-43; networkSwitch.js |
| ☐ | **Admin** (`/admin`) | its own shell, no dock (admins sent from `/app`): StampLogo · Admin Panel · Logged in as · Sign Out; DB Inspector; 5 groups (Today, The board, People, Data, System), each a tablist of sections (no arrow keys); `?g=&s=`; Admins owner-only; `/dev/plate` admin-gated | components/AdminLayout.jsx:13-53; panels/AdminPanel.jsx:570-702; panels/adminMap.js:5-55 |
| ☐ | Signed-out public nav | Products · Atlas · Pricing (with monetisation) · About · Blog; signed in: Dashboard (+ Admin); signed out: login + Get Started; the hamburger drawer | components/NavBar.jsx:16-113 |

## 3 · Narrow / phone

| ☐ | Behaviour | Today | file:line |
| --- | --- | --- | --- |
| ☐ | The phone dock | **no bottom bar today**: ≤ 600 px the dock is a centred icon row at the TOP (below the safe-area inset), names hidden, "/d" only, scrolls away | AppNav.css:128-134 |
| ☐ | The peek | min(268 px, 100vw − 24) | AppNav.css:190 |
| ☐ | Tiny | a bottom sheet 100vw × 72vh; the bubble hides while it's open | AppNav.css:274-279 |
| ☐ | Area breakpoints | Home 899 · PlaceNav 900 · Profile kv 700 · the board 600 / 860 / 980 / 1440; the plate 980 / 860 | as above; FullHouse.css; plate/plate.css:48, 326 |

## 4 · The /d logo

| ☐ | Behaviour | Today | file:line |
| --- | --- | --- | --- |
| ☐ | The mark | `<DraftMark drawOut logo/>` — Poppins 800 italic, `--c-logo-slash` / `--c-logo-word` | components/DraftMark.jsx:23-31 |
| ☐ | Draw-out | "/d" at rest; opening slides the mark and unclips "raft" → "/draft" (0.38 s; width measured once after fonts load); top place always "/draft", phone always "/d" | AppNav.jsx:636-645; AppNav.css:83-98, 124-134 |

## 5 · Persisted settings the shell reads

| ☐ | Key | Where |
| --- | --- | --- |
| ☐ | `draft-theme` (localStorage) — the theme, cues, layout flags; mirrored to `/api/settings/appearance` | themes/index.js:48; App.jsx:613-615 |
| ☐ | `draft.plate.market` (localStorage) | plate/marketPlate.js:8 |
| ☐ | `draft-ask:open`, `draft-ask:turns` (sessionStorage; the turns cleared on sign-out) | AppNav.jsx:273, 594-595; lib/assistantBridge.js:25-28 |
| ☐ | Server: `network_enabled`, the compete switches, the apply-mode unlock, the monetisation lever; per user the apply mode, Tiny's opt-in, the active job profile, notifications read | as above |

## 6 · What the plate `Shell.jsx` lacks against today (each is work, or the owner's strike)

1. Dock **Search** (DockSearch: people / companies / roles), hover-expand, the peek, **M**, the Esc chain, the place measuring (side / top / phone).
2. **Feed / Messages** and their switch; the needs-attention / unread badge feeds (the components take a badge, nothing feeds it yet).
3. The `bar` variant is a **bottom** bar; today's phone dock is at the top. The sketch decides (v3 *The shell*) — the bar is the sketch's.
4. The plate Dock has an **Ask draft** slot; since D190 Ask is the floating Tiny. Today's behaviour stays unless the owner says otherwise.
5. `NavSearch` registers a window-wide **Ctrl/Cmd K** per instance (two on a page conflict); `AreaNav`'s menus have no Esc / outside-click close.
6. The plate Dock labels from `item.label`; App labels both `today` and `auto-apply` "Home" and only `DOCK_NAMES` renames today to "draft".

## 7 · Found while inventorying (A236 (b))

- **`ProfileMenuPanel` (TopBar.jsx:217-360) is mounted but nothing opens it.** AppNav never calls `profile.onOpen` (only a comment names it, AppNav.jsx:239). Three things live only in that panel: the notifications **list with Mark all read**, the **QuickScheme** (System / Light / Dark), and (possibly — `panels/JobsPanel.jsx:36` also imports it) the job-profile **switcher / delete**. **Traced (47g):** the job-profile switcher / delete → still reachable at `/app/job-profiles` (`panels/JobProfilesPanel.jsx:53-55, 280`) · System / Light / Dark → Profile → Appearance (`CustomisePanel`) · **the notifications LIST and *Mark all read* → reachable NOWHERE**: Profile → Notifications is `NotificationSettings` (what to send), not the list; `/api/notifications/read-all` is called only from TopBar.jsx. So the Profile avatar's unread badge counts notifications a person can't open. ⛔ **The shell build (M5) must give the list a home** (the peek's Notifications row is the natural one) — logged as A236 (b).
- The peek's **Connections · N need you** never shows (TopBar never passes `connectionsNeedYou`).
- Admin's section tablist has no arrow keys. Admin is Wave 2 #21 (tokens and components only).

## 8 · Landed — D197 Wave 1 #1 (47i), against the approved canvas board `Shell` (docs/sketches/final/project/Shell.dc.html)

The live dock IS the plate library's `Dock` (plate/Shell.jsx), rendered by `components/AppNav.jsx` inside a `PlateRoot`; the
area nav is the plate `AreaNav` (`ShellAreaNav`, mounted by App across the content column). F5 against the board:
`shell-rail` 0.69 % · `shell-active` 0 % · `shell-areanav` 1.22 % · `shell-phonebar` 1.92 % · `shell-phonetop` 1.01 %.

**§1 kept:** the one `<nav aria-label="Main" data-nav-dock>` · the order /d · Home · Atlas · Interview · [Network · Feed ·
Messages under the switch] · Profile (+ the board's rule and Ask draft, which opens Tiny) · the badges (Home's needs-you,
Messages' unread, Profile's notifications; "9+") · /d → the market (refresh bump) · Profile → the peek (press, 350 ms rest,
250 ms leave; beside the rail / above the bar) · the peek's rows + the mode switch · Tiny (bubble + card, D190) ·
`data-dock-open` / `data-dock-place` / `data-ask-open` · reduced motion · M (now: into the dock and out) · the Esc chain ·
real links. **Search** (people / companies / roles / tech, UsbSuggest): moved into the area nav (Ctrl K) and the phone's
top-bar search button (a sheet). **Placement:** A237 — the rail at the left from 980 px (14 px from the edges, the shell
padded 98 px), the bottom bar below.
**§2:** the market's area nav = Today's picks (presses the openings' Deck tab) · All jobs · Starred · Imported (the board's
views; presses Index) + the drafts chip (`/api/draft/slots`, the last 24 h) + search; other areas get search only for now
(their in-page PlaceNavs stay). **§3:** the phone dock is the bottom bar; the top bar holds /d + search. **§4:** the /d mark
is the plate tile. **§5:** unchanged. **§6:** items 1–6 done (6: the labels are DOCK_NAMES'). **§7 / A236 (b):** the peek's
Notifications row opens the list + Mark all read ("What to send me" links to the settings).
**Retired with the 60 px rail (the board draws the names always):** the hover-expand to 196 px and the /d → /draft draw-out.
**Not drawn by the board, kept:** Feed and Messages (the board's Network carries a badge; today's unread is on Messages);
Profile's badge on the phone bar; Tiny's bubble on wide screens beside the rail's Ask draft.

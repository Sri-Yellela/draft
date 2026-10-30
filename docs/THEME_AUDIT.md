# D91 P0 — THEME AUDIT (read-only)

**Measured 2026-10-11 on local `main` `f04c927`** (one commit ahead of `origin/main`, docs only). Spec: `docs/THEME_MODULE.md`. Sketch: `docs/sketches/themes-contrast.html`. ⚠ The spec and the WORKLOG give the sketch's path as `docs/sketches/themes-contrast.html`. That folder does not exist; this project keeps its sketches in `docs/` (for example `docs/sketches/what-we-changed.html`, D90's). The file is the same.

Nothing in the product was changed to write this. The scanners are the guard's own regex and comment-stripping (`test/colorLiteralGuard.test.js`), run over more roots than the guard covers.

---

## 0 · The headline: the job is a different size from the one the spec plans for

1. **The literal burn-down (spec §10's "real work") is already done.** `client/src` has **4 colour literals outside the token file**: 3 in `components/DockPortal.jsx` (PERMANENT, fallbacks no caller uses) and 1 in `client/index.html`, which the guard does not scan. The guard's `BUDGET` has been empty since UI step 2b (09-30). The extension has **0** outside its two generated token files. So **P2 is small** (§1). Its real job is to widen the guard to the places it cannot see.
2. **Dark mode is already real and a user can reach it.** "`theme.jsx` hard-codes `isDark = false`" is true, but nothing reads `isDark`: **0 readers**. The palette is chosen in `colorTokens.js`: `THEME = resolveTheme()` → `C = THEME === "dark" ? C_DARK : C_LIGHT`. It is resolved **once, at load**. The **TopBar avatar menu has an Appearance row (System / Light / Dark)**. The choice is **saved to the account** (`PUT /api/settings/theme`, `users.theme_preference`), and `App.jsx` adopts it on sign-in (`adoptAccountTheme`, which reloads only if the screen would change). The theme picker, persistence and system default that P5 describes **exist for two themes**. D91 extends them from 2 themes to 4; it does not build them from scratch.
3. **So the real work is P1 (one decider instead of two), P3 (2 × 104 token values), P4 (shape cues across about 55 files that paint status directly) and P6 (the matrix).** The size estimate is in §11.

---

## 1 · Colour literals, by area

| Area | Files with a literal | Literals | Notes |
|---|---|---|---|
| `client/src` (the guard's scope) | 2 | **238** | 235 in `styles/colorTokens.js` (the palette itself, allowed) · **3** in `components/DockPortal.jsx` (PERMANENT: `rgba(20,20,20,0.98)`, `rgba(255,255,255,0.1)`, `rgba(0,0,0,0.3)`) |
| `client/index.html` | 1 | **1** | `.site-title { color: #0f0f0f }`: a dead "Lucy brand" rule. ⚠ **Not scanned by the guard** |
| `client/src/components/ui/toast.jsx` | 1 | **3 Tailwind palette classes** (`text-red-*` family) | Recorded but not guarded, by the guard's own rule. Vendored shadcn. Its destructive variant paints a fixed red |
| `extension/` | 2 | **324** | `tokens.css` 162 + `tokens.js` 162. Both **generated** (allowed). Every other extension file has **0** |
| ⚠ **`shared/`, which reaches the UI** | 2 | **9** | `shared/applicationResponse.js` `RESPONSE_LABELS[*].color` (6 hex: `#6b7280 #dc2626 #d97706 #2563eb #16a34a`). **`panels/DatabasePanel.jsx:863–896` paints them** as the outcome chip's border, its text and the menu's dots. These are **raw Tailwind-500 hex that bypass every token, every contrast pair and both palettes**: on cream, `#d97706` is about 2.7:1. `shared/applyOutcomeGroups.js` `OUTCOME_LABELS[*].color` (3 hex). No client reader paints it today (AD1 moved the labels), so it is a dead field |
| Server-rendered pages (out of scope) | — | — | `server.js:10802` (the cover-letter download, a document), `services/resumeFormatter.js` (the résumé, a document, `#ffffff` ground), `routes/email.js` (emails), `services/crawlerPage.js` (the crawler's public info page; it has its own light and dark), `scripts/*` (test fixtures and screenshot harnesses) |

**P2 is therefore:** retire DockPortal's fallbacks · delete the dead `.site-title` rule · token the toast's destructive variant · **move `RESPONSE_LABELS` colour to a client-side `tone` mapped to tokens** (and drop `OUTCOME_LABELS.color`) · **widen the guard** to `client/index.html` and to any `shared/` file the client imports. The guard's count then reaches zero. **About 0.5 day.**

---

## 2 · How colour reaches the screen today: three channels, all from `C`

| Channel | Count | What it is |
|---|---|---|
| `theme.*` (ThemeContext → `themes/cinematic.js` `baseTheme`) | **1,627 reads** | A name map: most entries are `C.*` values (baked hex), and some are `var(--bg-*)` strings |
| `C.*` direct (`import { C }`) | **944 reads in 47 files** | Baked hex/rgba, chosen at load |
| `var(--c-*)` | **699 reads** | CSS, published by `installColorVars()` from `C` |
| `var(--bg-*/--color-*/--border-*)` | **492 reads** | Bridges in `theme.jsx` and `cinematic.js` that point at `--c-*` |

⭐ **Consequence for the module:** every channel derives from the single `C` object. So **a theme switch is "resolve a different object at load, then reload"**, which is exactly what dark does today. No component needs to change for a new theme to paint, provided it supplies every key (§9).

⚠ **Hex-alpha suffixes: 30 sites** append two hex digits to a token: `${theme.accent}22` ×8, `${C.DANGER}44` ×7, `${C.SUCCESS}…` ×4, `${theme.border}…` ×2, `${theme.accentMuted}40` ×2, `${C.INFO}…` ×2, and one each on `warning`, `danger`, `t.accent`, `t.accentText` and `C.ACCENT_INK`. Add to these `bandChipStyle`'s `edgeAlpha` and `ProfileSelectorDropdown.jsx:133` (`C.DANGER + "44"`). **Every theme must keep these tokens as 6-digit hex.** That holds for all of §3's table. The contract test (#6) pins it. ⚠ These tints are **not in `CONTRAST_PAIRS`**. They are decorative borders and washes today, and P6's scan will measure them.

---

## 3 · Inline `theme.*` / `isDark` branches

- **`isDark`: 0 readers.** The field in `theme.jsx` is dead.
- **Branches on the resolved theme: 1.** `components/PaperBackground.jsx:37`: `PAPER[THEME] || PAPER.light` (`styles/paper.js` has `light` and `dark` grain parameters). The four-theme registry needs a `substrate` per theme. The spec already has a field for it.
- **Theme selection lives in two places, which P1 must collapse into one.**
  - `colorTokens.js` decides the palette (`THEME`, `C`, the storage key `draft-theme`, `setThemePreference`, `adoptAccountTheme`).
  - `themes/index.js` plus `theme.jsx` keep a **second, vestigial registry**. It has one theme (`cinematic`), its own storage key **`rm_theme_id`**, and a "Theme picker — hidden until more than one theme is registered" stub in TopBar. `cinematic.js` is really a name map (`theme.*` → `C.*`) plus the global stylesheet, not a palette.
- **`theme.jsx` writes `html { color-scheme: light }`** in its style block, while `installColorVars` sets an inline `color-scheme: <THEME>`. The inline style wins, so dark works, but the two disagree. P1 removes the hard-coded one.
- **A dead pre-paint script: `client/index.html:19–24`** reads `localStorage['rm-bg-mode']` and sets `data-bg`, and **nothing reads `data-bg`**. This is the natural slot for the no-flash script (§8).

---

## 4 · Places that paint their own status, band or chart colour (shape-cue bypass list for P4)

**The shared components:** `styles/mark.js` (`markStyle`, `bandMarkStyle`, `countStyle`), `styles/bandStyle.js` (`bandStyle`, `bandChipStyle`) and their CSS twins `.mark` / `.mark-count` (`components/DepthButton.css`).

**Direct status-token reads** (`C.SUCCESS|WARNING|DANGER|INFO|BAND_*|VIOLET|TEAL(_QUIET)`, `theme.success…`, `var(--c-success…)`) total **579 in 55 files**. "shared" is how often that file also calls the shared components.

| Status reads | Shared calls | File | Area |
|---|---|---|---|
| 106 | 0 | `pages/admin/DBInspector.jsx` | admin |
| 95 | 12 | `panels/adminOps.jsx` | admin |
| 29 | 9 | `panels/AutoApplyPanelSections.jsx` | Draft House |
| 27 | 16 | `components/JobCard.jsx` | board |
| 26 | 6 | `panels/AutoApplyPanel.jsx` | Draft House |
| 20 | 0 | `panels/adminEnrichment.jsx` | admin |
| 20 | 0 | `panels/AdminPanel.jsx` | admin |
| 18 | 0 | `components/ApplicationHistory.css` | The Table |
| 17 | 3 | `panels/IntegrationsPanel.jsx` | Settings |
| 15 | 7 | `panels/adminPeople.jsx` | admin |
| 14 | 0 | `panels/JobsPanel.jsx` | board |
| 13 | 0 | `components/ResumeChangesPanel.css` | posting panel (D90) |
| 13 | 1 | `panels/DatabasePanel.jsx` | The Table |
| 9 | 0 | `lib/applyObstacles.js` | Draft House |
| 8 each | 0–1 | `CompanyKbSections.jsx`, `DepthButton.css`, `DraftHouse.css`, `AccountPanel.jsx`, `ProfilePanel.jsx`, `RecruiterPanel.jsx`, `SandboxPanel.jsx` | mixed |
| ≤ 7 | — | 37 more files (full list: `scratchpad status.mjs`, reproducible) | — |

By area: **admin about 238** (DBInspector, adminOps, adminEnrichment, AdminPanel, adminPeople, adminKit), **app about 300**, **auth 8**, **marketing about 7**. Not every read is a status *mark*. Many are error text (`color: C.DANGER` on a sentence that says "failed"), which already carries its meaning in words. **P4's first step is to classify the 579 reads** into mark / band / segment / text. Only the first three need cues.

**Chart segments, which need patterns under cues:** `components/AtsReport.css` (the pair's three-segment bar: `PAIR_MATCHED / MISSING / GENERIC`, 15 refs), `components/ApplicationHistory.css:186–196` (the funnel's `.ah__fseg` fills, with a legend), `components/DraftHouse.css:35` (the cap meter), and the `<svg>`/`<rect>` draws in `ResumeList.jsx`, `JobBubble.jsx`, `BoardBar.jsx`, `IntegrationsPanel.jsx` and `AdminPanel.jsx`. These are not all charts; P4 classifies them.

---

## 5 · Where meaning rides on hue alone (found so far; P4 extends the list)

| Where | What | Why it is hue-only |
|---|---|---|
| `panels/AutoApplyPanelSections.jsx:194, 209` | a 5px dot: **WARNING** = protective, **DANGER** = blocking | The same shape, separated only by **amber versus red**, which is the pair spec §10 calls close |
| `panels/DatabasePanel.jsx:863–896` | the reply-outcome chip and the menu dots | Off-token hex (§1); the label is present, but the dot is colour-only |
| `components/DraftHouse.css:58–60` | `.dh-item[data-tone]` left edge: danger / warning / info | The edge colour is the only tone signal |
| `components/ResumeChangesPanel.css:40–42` | `.rc__cell--add/del/rew` left edge: success / danger / warning | Edge colour only. (`del` text also has a strike-through, `ins` is bold, so the inline diff has a second cue but the cell does not) |
| `components/ApplicationHistory.css:156–162` | column-head underline per stage | The heading text names the stage, so this is acceptable and only the underline is hue |
| `components/ApplicationHistory.css:186–196` | funnel segments | There is a legend, but the segment fill is hue-only, so it needs a pattern under cues |
| `components/DraftHouse.css:11` | `data-held` outline in WARNING | Outline colour only |
| `components/AtsReport.css` | the pair's three-segment bar | Matched / missing / generic separated by hue (generic is grey). Under cues it needs a pattern |

`mark.js` already puts a **3px leading bar** on every mark ("the colour-blind-safe version of a capsule"). The bar's *style* (solid / dashed / double / dotted), plus a glyph, is how P4 adds the cue in **one place**. `bandStyle` already sets "Not enough signal" apart by its dashed edge.

---

## 6 · What `C_DARK` is used for, and whether a user can reach dark

- **Reachable: yes.** Avatar menu → Appearance → System / Light / Dark (`TopBar.jsx:308–328`). It is **stored in the account** (`routes/account.js:135–144`, `users.theme_preference`, values `system|light|dark`) and cached in `localStorage['draft-theme']`. A change reloads the page. `adoptAccountTheme` applies the account's choice on another device.
- **`C_DARK`** supplies every token when `THEME === "dark"`. It is proved key for key and pair for pair against `C_LIGHT` (`test/colorTokens.test.js`: "IDENTICAL keys", "every declared pair passes AA in DARK too"). The ink pair is darkest in dark (`test/inkPairD32.test.js`).
- **Flash:** ⚠ **there is one today for dark users.** `installColorVars()` runs when the JS bundle loads (`main.jsx` imports `colorTokens.js` first). Until then `<body>` is `background: transparent` (`index.html`), the browser paints white, and a dark user sees **a white flash** before the bundle arrives. The pre-paint `<script>` in `index.html` sets an attribute nobody reads (§3).

---

## 7 · The extension's token pipeline

- `scripts/buildExtensionTokens.mjs` generates `extension/tokens.css` (light under `:root`, dark under `@media (prefers-color-scheme: dark)`) and `extension/tokens.js` (`C_LIGHT`, `C_DARK`) from the site's `colorTokens.js`. It **excludes `PAIR_*` and `FH_*`, and keeps one `PP_*` (`PP_ATS_NUMBER`)**. `test/d23ExtensionLook.test.js` fails when they are stale, and `scripts/buildExtension.mjs` refuses to package a stale set.
- **Consumers:** `popup.html` and `options.html` link `tokens.css` and so **follow the OS, not the account** ("no new storage key, D23"). `background.js` paints the toolbar badge from **`C_LIGHT` only** (`:364–365`) and the capture toast from `{light, dark}`. `gated-handoff.js` passes `{light, dark}` to the review overlay (`review-overlay.js:188`), and `autofill-badge.js:191` and `extractor.js:342` pick one by the page's `prefers-color-scheme`.
- **What D91 changes:** the payload shape becomes a theme id plus its tokens, not `{light, dark}`. For the popup to follow the *account's* theme, the extension must learn the theme id. Spec §6 says "receives the chosen theme id with its token". ⚠ **That is a new field on the existing token handoff.** It is not a new permission or request, but it **is new data crossing into the extension**, and D23 explicitly chose "no new storage key". **The owner decides:** (a) the popup keeps following the OS with light or dark of the **Paper** pair, or (b) the theme id rides on the existing token handoff and the extension stores it in its existing storage (no new permission, but a new key).

---

## 8 · System preferences: what exists

| Preference | Today |
|---|---|
| `prefers-color-scheme` | ✅ the default ("system") follows it |
| `prefers-contrast: more` | ❌ not read anywhere |
| `prefers-reduced-transparency` | ❌ not read. Glass is `styles/glass.js` plus **`backdrop-filter` in 15 client files** (`cinematic.js` ×8, `LandingPage.css`, `index.css`, `UnifiedSearchBar.css`, `NavBar.css`, `PanelShell.jsx`, `StickyBar.css`, `ScrollDock.jsx`, …). The opaque switch needs a token route (`GLASS_*` → `SURFACE_SOLID`) **plus** a `backdrop-filter: none` rule over those 15 files |
| `forced-colors: active` | ❌ not read. Controls are depth boxes, whose edges are **box-shadows**, and **forced-colors mode drops box-shadow**. So `DepthButton`, `.dbx-depth`, marks and inputs lose their edges. P5 needs a `@media (forced-colors: active)` rule that gives each a real `border: 1px solid CanvasText/ButtonText` |

---

## 9 · Tests that pin `C_LIGHT` / `C_DARK`, and what D91 forces on them

| Test | What it pins | Conflict with D91 |
|---|---|---|
| `test/colorTokens.test.js` (13 tests) | AA on every pair in both palettes; identical keys; 6-digit hex; the forbidden pairs fail; the grain floor; the preference logic | ⛔ **"INK is near-black and NOT pure black"** (`:74–83`, asserted on the live `C`). Contrast Light's INK is `#000000` by design. The rule is right for Paper Light (cream vibrates against pure black) and wrong for the contrast pair. P1 must scope it **per theme**, which is a change to an existing assertion and so needs the owner's go. ⚠ **`FORBIDDEN_PAIRS` are theme-relative:** "the logo orange as text on paper" is **6.05:1 in Contrast Dark** (it passes AA), and "orange as a focus ring" passes in both contrast themes. The test must evaluate forbids per theme, not assume they fail everywhere |
| `test/inkPairD32.test.js` | ⛔ **"no file but colorTokens.js decides a theme"**, with a regex on the literal line `export const C = THEME === "dark" ? C_DARK : C_LIGHT;` · "the ink pair is the only dark surface; nothing in the light palette is dark" · "PAIR_* re-derived, never carried across themes" | D91 says **`themes/index.js` is the ONLY place a theme is chosen.** The two rules agree in spirit ("one decider") and disagree on the file and the line. P1 moves the decider and must **re-point this test**: the owner's sentence supersedes D32's pin. In the contrast themes the pair should simply be the theme's own neutral (white / black), and "nothing dark in light" still holds for Contrast Light |
| `test/d23ExtensionLook.test.js` | the generated `tokens.css`/`.js` equal the generator's output; the prefixes excluded | The generator moves to the registry (four palettes). The test follows |
| `test/d19MarkLightMode.test.js` | the mark: an orange slash with an ink word in light, all-orange in dark | Contrast Light has an ink word, Contrast Dark is all orange (the spec's default) |
| `test/d61CompanyLogo.test.js` | `LOGO_TILE` is paper in both | The contrast themes use `#FFFFFF` (spec §3). The "never follows the theme" rule stands |
| `test/d35FullHouseHeader.test.js`, `test/d48PostingHeader.test.js`, `test/pairFidelityA86.test.js` | FH_* / PP_ATS_NUMBER / PAIR_* values against their sketches, `PP_ATS_NUMBER === PAIR_KICKER` | The contrast themes need derived FH_/PP_/PAIR_ values. These tests pin *Paper's* values to *their* sketches and must stay scoped to Paper and Charcoal |
| `test/menuSurfaceStyle.test.js`, `test/colorLiteralGuard.test.js`, `test/topBarChrome.test.js`, `test/jobBubbleD1.test.js`, `test/d55AutofillBadge.test.js`, `test/panelPeers.test.js`, `test/authRouteGuardManifest.test.js` | incidental reads of the token file or the theme route | Expected to pass unchanged. P1 confirms |

---

## 10 · Documents, logos and third-party colour

- **The résumé** (`services/resumeFormatter.js`) carries its own `--color-bg: #ffffff` and black text, and renders in an `<iframe srcDoc>` (`GenerateToolPage.jsx:137`, `SandboxPanel.jsx:481, 546`, `DatabasePanel.jsx:249`). ✅ It is never themed. ⚠ `DatabasePanel.jsx:251` gives the iframe a **themed** backdrop (`C.SURFACE_SOLID`) and a themed "No resume HTML stored." line (`C.INK_FAINT`). That is harmless, because the document paints its own white, but the test "documents render black on white in every theme" should load the iframe in each theme.
- ⚠ **The cover letter is themed today:** `components/CoverLetterModal.jsx:143–144` shows the generated letter as `theme.text` on `theme.bg`. In dark it is light text on charcoal, which breaks spec §1 ("the cover letter … stays black on white in every theme"). P2 or P3 fixes it with a document surface: a `DOC_PAPER` / `DOC_INK` pair that is the same in every theme, like `LOGO_TILE`.
- **D90's "What we changed"** (`ResumeChangesPanel.css`) shows résumé *text* in a themed panel. It is an analysis view, not the document, so **it stays themed** unless the owner says otherwise.
- **Company logos:** `LOGO_TILE` is paper in both themes today (D61). The contrast themes use `#FFFFFF`. ✅
- **Third-party:** `PROVIDER_GOOGLE #1A73E8`, `PROVIDER_LINKEDIN #0A66C2`, `PROVIDER_GITHUB #24292E`, `PROVIDER_INDEED #003A9B`, with `ON_PROVIDER #FFFFFF`. ⚠ **White on Google's `#1A73E8` is 4.51:1**: AA, **not AAA**. Spec §4.4 keeps the brand colours, so **the contrast themes' pair test must exempt the `ON_PROVIDER` pairs from the 7:1 target** (keeping them at 4.5) and say so. Otherwise the rule "every declared pair passes at the theme's target" fails at once.

---

## 11 · The sketch's values against the site's full pair list (a P3 preview)

The sketch's table computes **22 pairs**. The site declares **about 150** (`CONTRAST_PAIRS`). Running §3's representative values through every declared pair whose keys §3 covers (AAA: text 7, large and UI 4.5, the CTA label 4.5; translucent grounds composited over `CANVAS_SHADE`, exactly as `colorTokens.test.js` does):

| | Pass | Fail | Lowest text pair |
|---|---|---|---|
| Contrast Light | 73 | **0** | 7.13 (matches the sketch) |
| Contrast Dark | 72 | **1**: `BAND_WEAK on SURFACE_2` = **6.52** < 7 | 7.17 |

⇒ **The sketch's Contrast Dark red `#FF8080` fails a pair the sketch did not compute** (a weak band as text on a raised panel, `rgba(36,36,36,.84)` over `#1A1A1A`). P3's derivation will lighten it, the smallest step on the same hue. `DANGER` shares the value and will move with it if the same surface is declared for it. Keys §3 does not cover, which **P3 derives**: `VIOLET(_QUIET)`, `TEAL`, `PROVIDER_*`/`ON_PROVIDER` (kept, §10), the 14 `PAIR_*` text and surface keys, `FH_SURFACE`, `FH_WELL`, `FH_ON_ACCENT`, `PP_ATS_NUMBER`, plus every non-text key (shadows, glass, grain).

---

## 12 · Size estimate per phase and per area

| Phase | What, given the measurements above | Estimate |
|---|---|---|
| **P1 · the module, zero visual change** | `themes/{paper-light,charcoal-dark}.js` generated from `C_LIGHT`/`C_DARK`; `themes/index.js` becomes the one decider (`resolve(preference, system)`), absorbing `THEME`/`C`/`installColorVars` from `colorTokens.js` (which keeps `CONTRAST_PAIRS` and re-exports `C` for the 47 importers); `cinematic.js` stays as the `theme.*` name map; `rm_theme_id`, `isDark` and the hidden picker are removed; the no-flash inline script replaces the dead `rm-bg-mode` one; contract tests 1, 2, 4 and 6; `inkPairD32` and `colorTokens` re-pointed (§9). **Pixel identity:** a screenshot harness (puppeteer-core is already a dependency; ~30 `scripts/*Shots.mjs` precedents) shoots a fixed route list before and after, and a byte or pixel comparison proves identity. pngjs/pixelmatch are not installed, so the decision is to compare PNG bytes first and add a pixel diff only if fonts or anti-aliasing make bytes unstable | **1.5–2 days** |
| **P2 · literals to zero** | §1's list (DockPortal, `index.html`, the toast, `RESPONSE_LABELS`) plus the document surface for the cover letter (§10) plus widening the guard | **0.5 day** |
| **P3 · the contrast token sets** | `scripts/deriveThemeTokens.mjs` (hue-preserving lightness search over the declared pairs), 2 × 104 keys, §3's representative set fixed, the R=G=B and brand-only-chromatic test, the inversion test, the provider exemption, per-theme forbids, the substrate (`PAPER` entries for contrast), the extension generator from four palettes | **1.5 days** |
| **P4 · shape cues** | classify the 579 status reads (about 55 files); route the marks, bands and segments through `mark.js` / `bandStyle.js` / one segment helper; `data-cues="shape"` CSS (glyph via `::before`, edge style, hatch / dot `background-image` patterns); a no-reflow test. **Admin is about 40% of the reads** (DBInspector alone 106) | **2–3 days** |
| **P5 · Settings → Appearance** | The menu row already exists (3 radios). It becomes four preview cards plus a Shape-cues switch, inside Settings. `theme_preference` widens from `system/light/dark` to theme ids plus `cues` (an additive migration; the mobile contract bumps additively); `prefers-contrast` banner; reduced transparency (tokens plus 15 `backdrop-filter` files); forced-colors borders on depth boxes, marks and inputs | **1.5 days** |
| **P6 · coverage** | 25 public routes, the 5 app tabs and 2 route-only pages, the 5 admin sections and `/admin/db`, modals and menus, the extension's popup, options, badge and overlay; × 4 themes × desktop and phone × cues off and on ≈ **40 surfaces × 16 ≈ 640 shots**, plus an in-page contrast scan (computed styles; axe-core is not installed, so either add it as a dev dependency or write a WCAG computed-style walker) and focus-visible checks | **2 days** |
| **P7 · `docs/THEMES.md`** | five steps | **0.25 day** |
| **Total** | | **≈ 9–11 days** (the spec's literal burn-down would have dominated; it is gone) |

Per area, for P4 and P6 (the phases that touch screens): **admin** ≈ 40% of status reads in 6 files (dense, few screens) · **app** (board, Draft House, The Table, posting panel, Settings) ≈ 52% in about 35 files · **auth** and **marketing** ≈ 3% (almost all text, so few marks) · **extension**: 0 literals, 5 consumers of the token payload (§7).

---

## 13 · Decisions this audit adds to spec §11 (the defaults are what the agent will do)

7. **Re-pointing two existing test assertions** (§9: "INK not pure black" scoped to Paper; D32's "colorTokens.js decides the theme" moved to `themes/index.js`). *Default: re-point both in P1, with the reasons in the commit.*
8. **Third-party sign-in pairs are exempt from 7:1** in the contrast themes (they stay at 4.5, unchanged). *Default: exempt, named in the test.*
9. **The extension follows the account's theme** (a theme id on the existing token handoff, stored in the extension's existing storage) **or keeps following the OS** with the Paper pair. *Default: keep following the OS until the owner says otherwise. The four themes reach the popup only through the OS's light or dark, mapped to Paper or Charcoal.*
10. **A cover-letter document surface** (`DOC_PAPER`/`DOC_INK`, the same in every theme). *Default: build it in P2.*
11. **The P1 identity proof**: compare screenshot bytes first, adding pixelmatch as a dev dependency only if needed. *Default: as stated.*

# Resume Master site-wide audit (D192 P0): 2026-11-19

This audit measures every route on resumemaster.one against D189's workspace shell, D149's tokens with D181's Plain themes, D182 (no label that restates what is already on screen) and D60 (no pills). It is input for the owner to approve. Nothing here has been built.

**How it was measured.** The live site was browsed read-only in one headless Chrome (puppeteer-core) at 1440 × 900 and 390 × 844. No form was submitted and nothing was uploaded. Each page was probed in the browser for rendered capsules (radius ≥ half the short side on a non-square), sideways scroll, page errors and the fonts in use. The source was read at resume-master `62e37ec`. Screenshots are in `rm-audit-shots/` (72 PNGs) and the per-shot probe results are in `rm-audit-shots/index.json`. This audit builds on the D189 P0 audit (`rm-site-audit.md`, 11-13), which was taken before the workspace existed.

⚠ **The live site is not HEAD.** `GET /v1/version` returns commit `d02f11c` with `scorer: @draft/ats-scorer@1.4.0`. The three D192 commits after it are local only: `a4d1dd6` (POST /v2/ats/score, contract 1.10.0), `adf5499` (the site's ATS check runs v2) and `62e37ec` (vendored scorer 1.5.0). None of them touches `public/`, so the screenshots still match the source UI.

## Summary

- **Routes covered: 29.** These are the 20 sitemap URLs, `/editor/` (plus `/editor/?sample=1` and `/editor`, which redirects to `/editor/`), and the home page's 8 sections (ATS check, Format, Tailor, PDF tools, Sign in, Create account, Reset password, Account). The Documents block was shot with the home page. The workspace's 5 modes were also shot on the empty workspace. Every page answered 200 (or 304 on repeat). There were 0 page errors and 0 pages that scroll sideways.
- **Rendered pills: 0 real.** A203 (3)'s override block flattened every capsule on screen. The only hit is the phone workspace's closed bottom sheet (`.ws-strip`, radius 18 on a 33 px empty box, translated off-screen), which is a false positive. **But 8 capsule rules remain in source.** They are shadowed, not removed:
  - `site.css` lines 122, 141, 155, 174, 184, 190
  - `src/pdf-toolkit/styles.css` lines 18 and 31, which are live on any host that does not wrap the toolkit in `.pdf-tools`
- **Near-capsules: 5 on screen, all in the résumé editor.** `.grp select` and `.grp button.txt` have radius 13 on a 34 px height (`editor.css:51`). The source calls that bar "the tool pill".
- **Tokens:** the site has **4 copies of the Dusk palette:**
  - `site.css :root`
  - `workspace.css :root`
  - `editor.css :root`
  - `styles.css .pt-sb`

  There is no Dusk light, Plain light or Plain dark theme, and no Appearance picker, anywhere on RM (D181 is unmet). The one exception is the embedded editor, which takes draft's live tokens over rm-editor/1. Hard-coded `rgba()` literals:
  - `site.css`: 21
  - `workspace.css`: 13
  - `styles.css`: 29
- **The ATS check is the oldest module.** It shows a band word ("Strong / Moderate / Weak match") with a blurb that restates it, and term chips. It says "never a bare number", while draft shows the number (D50, `AtsNumberBox`). It ignores the `contextual` block that the site route already computes (`siteRoutes.js:252–253`, HEAD).
- **Two parallel PDF stacks.** The workspace (D189) covers 10 tools. The old 16-tab toolkit (`src/pdf-toolkit/ui.js`) still runs on the home page's PDF tab and on 6 tool pages: split, watermark, unlock, jpg-to-pdf, pdf-to-excel and html-to-pdf. The workspace has no Split, Watermark, Unlock, Images → PDF (as a new document), Excel or HTML → PDF tool yet.
- **Correction to the D192 row (owner, please read):** the row says draft calls RM "for every ATS score" (`@draft/ats-scorer@1.2.0`, contract 1.6.0). It does not:
  - Draft scores in-process with its own package: `packages/ats-scorer`, version **1.5.0**, through `services/localAtsScorer.js`.
  - No draft code calls `/v1/ats/score` or `/v2/ats/score`.
  - The only reference is a version pin in `test/d123PayloadDraft.test.js`.
  - Draft's pinned RM contract copy (`draft/contract/resume-master/`) is at **1.10.0**.
  - What draft does call is listed in M22.

  So P2 ("draft's client reads v2") needs a decision: either draft starts calling `/v2/ats/score`, or draft runs the vendored contextual code locally.

### Action counts (22 modules)

| Action | Count | Modules |
|---|---|---|
| Revamp to D189's shell | 3 | M5 ATS check · M10 Résumé editor · M14 the six old-toolkit tool pages |
| Restyle only | 6 | M1 chrome · M2 hero · M11 workspace · M12 /pdf/ hub · M16 sign-in dialogs · M20 tokens and themes |
| Merge into another module | 3 | M6 Format → editor · M7 Tailor → editor · M17 Account → workspace Settings panel |
| Retire | 5 | M4 home tool tabs · M8 home PDF tab · M9 "Everything here" cards · M15 the 16-tab toolkit UI · M21 dead code and routes |
| Unchanged | 5 | M3 Documents home · M13 the ten tool landing pages · M18 Privacy · M19 Assistant · M22 token API + rm-editor/1 |

### Questions for the owner (they gate P1 and P2)

1. **ATS for draft:** should draft call RM's `/v2/ats/score`, or compute the contextual score locally from the shared package? Today draft calls neither endpoint.
2. **The number on RM:** should RM's ATS panel show the number the way draft does (D50, provisional, with the "still being tuned" note)? RM shows a band only today.
3. **Tailor and D190:** Tailor calls a model for a visitor (1 credit). The output is new text, not site data, so D190 does not obviously bar it. Confirm that it stays.
4. **Push order:** the v2 ATS commits (`a4d1dd6`, `adf5499`, `62e37ec`) are not live. P1's RM-side panel needs them deployed first.

## Route coverage

| Route | Desktop | Phone | Module |
|---|---|---|---|
| `/` (full page) | [home-desktop](rm-audit-shots/home-desktop.png) | [home-phone](rm-audit-shots/home-phone.png) | M1–M9 |
| `/#ats` | [home_ats-desktop](rm-audit-shots/home_ats-desktop.png) | [home_ats-phone](rm-audit-shots/home_ats-phone.png) | M5 |
| `/#format` | [home_format-desktop](rm-audit-shots/home_format-desktop.png) | [home_format-phone](rm-audit-shots/home_format-phone.png) | M6 |
| `/#generate` | [home_generate-desktop](rm-audit-shots/home_generate-desktop.png) | [home_generate-phone](rm-audit-shots/home_generate-phone.png) | M7 |
| `/#pdf` | [home_pdf-desktop](rm-audit-shots/home_pdf-desktop.png) | [home_pdf-phone](rm-audit-shots/home_pdf-phone.png) | M8 |
| `/#signin` · `/#signup` · `/#reset` | [signin](rm-audit-shots/home_signin-desktop.png) · [signup](rm-audit-shots/home_signup-desktop.png) · [reset](rm-audit-shots/home_reset-desktop.png) | [signin](rm-audit-shots/home_signin-phone.png) · [signup](rm-audit-shots/home_signup-phone.png) · [reset](rm-audit-shots/home_reset-phone.png) | M16 |
| `/#account` (signed out: an error line only) | [home_account-desktop](rm-audit-shots/home_account-desktop.png) | [home_account-phone](rm-audit-shots/home_account-phone.png) | M17 |
| `/workspace/` + 5 modes | [workspace](rm-audit-shots/workspace-desktop.png) · [edit](rm-audit-shots/workspace_edit-desktop.png) · [annotate](rm-audit-shots/workspace_annotate-desktop.png) · [sign](rm-audit-shots/workspace_sign-desktop.png) · [pages](rm-audit-shots/workspace_pages-desktop.png) · [convert](rm-audit-shots/workspace_convert-desktop.png) | [workspace](rm-audit-shots/workspace-phone.png) · [convert](rm-audit-shots/workspace_convert-phone.png) | M11 |
| `/pdf/` | [pdf-desktop](rm-audit-shots/pdf-desktop.png) | [pdf-phone](rm-audit-shots/pdf-phone.png) | M12 |
| `/pdf/{merge,organize,compress,edit,sign,protect,pdf-to-jpg,pdf-to-text,pdf-to-word,ocr}-pdf/` (landing → workspace) | `pdf_<tool>-desktop.png` | `pdf_<tool>-phone.png` | M13 |
| `/pdf/{split-pdf,watermark-pdf,unlock-pdf,jpg-to-pdf,pdf-to-excel,html-to-pdf}/` (old toolkit) | e.g. [pdf_split-pdf-desktop](rm-audit-shots/pdf_split-pdf-desktop.png) | e.g. [pdf_split-pdf-phone](rm-audit-shots/pdf_split-pdf-phone.png) | M14 |
| `/editor/` · `/editor/?sample=1` · `/editor` | [editor](rm-audit-shots/editor-desktop.png) · [sample](rm-audit-shots/editor-sample-desktop.png) | [editor](rm-audit-shots/editor-phone.png) · [sample](rm-audit-shots/editor-sample-phone.png) | M10 |
| `/privacy.html` | [privacy-desktop](rm-audit-shots/privacy-desktop.png) | [privacy-phone](rm-audit-shots/privacy-phone.png) | M18 |

⚠ `public/sitemap.xml` lists `/workspace/` but **not `/editor/`**.

Fonts rendered across all shots:
- DM Sans: body
- Instrument Serif: display
- Barlow Condensed: the stamp
- Arial Narrow: the assistant's logo SVG
- Georgia: the editor's italic "I", and the serif fallback
- monospace

`styles.css:127` names "Inter Tight", which is not self-hosted (`public/fonts` has none), so Edit PDF's old sandbox falls back to Inter or the system face.

## Modules

### M1 · Site chrome (header + footer, injected into every page except the workspace and the editor)
| | |
|---|---|
| Route(s) | every page in `/`, `/pdf/*`, `/privacy.html` (`public/chrome.js`, `site.css` 92–128, 223–226) |
| Styling | Tokens (`--glass*`, `--ink*`, `--accent`). The stamp is hard-coded `#ffffff / #0f0f0f` (`site.css:95–96`, the brand mark, acceptable). `.nav__menu summary` was `border-radius: 999px` (`site.css:122`), shadowed at line 259. `.nav__menu-panel` is a hard-coded `rgba(0,30,50,.92)` (`site.css:125`, the old night-sky blue, shadowed at line 255). |
| Features | The stamp; ATS check · Format · Tailor · PDF tools (anchors into the home tabs); Sign in / Get started / the account bar (shown only on `/`, hidden by `chrome.js` elsewhere); the phone Menu; the footer links. |
| Outdated / redundant | The links point at home tabs that this audit retires (M4–M8). The footer still says "Bands are calibrated on human-graded postings and are coarse by design" (A68-era copy; contradicts D50's shown number). The account controls exist on one page only. |
| Draft contract | none |
| **Action** | **Restyle only.** Re-point the links to the workspace and editor modes, move Sign in / Account to the workspace top bar's panel, delete the shadowed rules and the stale footer line. |

### M2 · Home hero
| | |
|---|---|
| Route(s) | `/` (`index.html:40–46`) |
| Styling | Tokens. `.hero__cta` was 999px (`site.css:141`), shadowed at 259. A `fade-rise` animation. |
| Features | A large stamp, the headline, a tagline, "Check a résumé free →". |
| Outdated / redundant | The tagline repeats the nav and the tools ("free, with no account" also appears in the tabs, the cards and the footer; D182). |
| Draft contract | none |
| **Action** | **Restyle only.** Keep one line plus the Documents drop target as the page's first screen. Drop the repeated "free" claims. |

### M3 · Documents home (D189 P4)
| | |
|---|---|
| Route(s) | `/#documents` (`index.html:50–77`, `docs-home.js`) |
| Styling | Tokens; depth boxes; no capsules. The thumbnail paper is `#fff` (`site.css:304`, the page's own colour, correct). |
| Features | Drop or open a PDF / .docx (handed to the workspace via IndexedDB); Recent on this device; Start from (blank, sample, ATS check); an 8-tool grid that opens the workspace. |
| Outdated / redundant | The heading "Tools — each opens the workspace with that tool on" is a caption the tiles already show (D182, minor). |
| Draft contract | none |
| **Action** | **Unchanged.** It is already D189's design. The only change is to shorten that one heading, which can go with M2. |

### M4 · Home tool tabs (the tab strip over ATS / Format / Tailor / PDF)
| | |
|---|---|
| Route(s) | `/#tools` (`index.html:79–85`, `site.js:37–48`) |
| Styling | `.tab` was 999px (`site.css:155`), now a radius-11 depth box (259–269). Each tab carries a `.tag` ("free", "1 credit"). |
| Features | Switches between four form panels on one page. |
| Outdated / redundant | It is a second navigation for the same four tools (beside the nav, the Documents grid, the "Everything here" cards and the footer). The "free / 1 credit" tags restate the lede of each panel (D182). D189 replaces in-page tabs with the workspace's mode tabs. |
| Draft contract | none |
| **Action** | **Retire,** once M5 / M6 / M7 / M8 have moved. |

### M5 · ATS check
| | |
|---|---|
| Route(s) | `/#ats` (`index.html:88–106`, `site.js:25–34, 69–97`), `POST /v1/site/tools/ats` (`siteRoutes.js:250–257`) |
| Styling | `.band` was a 999px capsule (`site.css:184`) with tinted fills `rgba(125,219,163,.16)`, `rgba(245,195,91,.16)` and `rgba(255,154,139,.14)` (185–187). The tints are now `!important`-overridden to a word with a 6 px dot (272–273). `.chip` was 999px (190), now radius 6 (274). Its colours (`--good`, `--bad`) come from tokens. |
| Features | Paste a résumé, a job title and a description → a band word plus a blurb, then six chip groups: skills shown, skills missing, competencies shown / missing, action verbs, hard requirements not met. It also shows experience facts and an optional "Save the report to my account". |
| Outdated / redundant | (a) **Band only:** it says "never a bare number". Draft shows the number (D50, `AtsNumberBox`, "Match score — still being tuned") and the "N of M" counts. (b) The blurb restates the band ("Strong match" → "Most of what the posting asks for, your résumé shows."; D182). (c) **The v2 response is thrown away:** the route returns `contextual` (role fit, responsibility overlap, tech-stack compatibility, similarities, dissimilarities) at HEAD, and `site.js` never reads it. (d) Plain textareas: no file input, though the workspace and editor already hold the document. (e) The chips are the last chip-style labels on the site (D152 7b: a plain word). (f) The lede and the footer still describe A68-era "coarse bands". |
| Draft contract | The site route is `/v1/site/…` (not a draft contract). The scorer is the vendored `@draft/ats-scorer` 1.5.0 at HEAD (1.4.0 live). Draft itself does **not** call `/v1/ats/score` or `/v2/ats/score` (see Summary). The token API declares both, contract 1.10.0. |
| **Action** | **Revamp to D189's shell.** Make it the **Résumé tab of the workspace's properties panel** (D189 (2)) and the editor's (M10): the number as draft draws it, the four contextual components shown separately, similarities and dissimilarities with their next steps (D192 (4d)), and the job pasted or picked in the panel. Retire `bandOf`, the blurbs and `.chip`. |

### M6 · Format
| | |
|---|---|
| Route(s) | `/#format` (`index.html:109–121`, `site.js:109–135`), `POST /v1/site/tools/format` |
| Styling | Tokens. The preview iframe's paper is `#fff` (`site.css:193`, correct). |
| Features | Paste HTML or text → the deterministic formatter's page in a preview, then "Download HTML", "Print / save as PDF", and an optional save. |
| Outdated / redundant | It is the same job as the résumé editor (M10): a fixed layout applied to a résumé, then download. The editor already opens "an HTML résumé (for example one you downloaded from Format …)", so Format is a step before the editor. Its output is a one-shot preview with no editing, no undo and no save state. |
| Draft contract | `POST /v1/resumes/format` exists in the token API (1.10.0). Draft does not call it (`services/toolsService.js` has no format call). |
| **Action** | **Merge into M10.** Pasted text or HTML opens in the structured editor already formatted. Download PDF / HTML live in its top bar. The `/v1/resumes/format` API stays as it is. |

### M7 · Tailor a résumé (generate)
| | |
|---|---|
| Route(s) | `/#generate` (`index.html:124–148`, `site.js:137–161`), `POST /v1/site/tools/generate` (signed in, 1 credit) |
| Styling | Tokens; the inline `style="display:flex…"` and `margin-top:10px` are in the HTML (`index.html:95, 133, 140`). |
| Features | Résumé, name, years, job title, company and description → a tailored résumé (model), checked by the claim guard, then preview, download, print and an optional save. The credit gate line is shown. |
| Outdated / redundant | Like Format, its output is a résumé that the editor should hold. Today it is a preview the person cannot edit. The person types their name, years and job again, though the ATS panel already has the job. |
| Draft contract | Draft uses the token API's `POST /v1/resumes/generate` (`services/toolsService.js:141`, contract 1.10.0 pinned). The site route is separate and draft is unaffected. |
| **Action** | **Merge into M10** as a "Tailor for this job" action in the editor's Résumé tab (next to M5's score). The result opens as a new version in the editor, with D157's Review changes. The credit rule is unchanged. See owner question 3 (D190). |

### M8 · Home "PDF tools" tab (the old toolkit, mounted lazily)
| | |
|---|---|
| Route(s) | `/#pdf` (`index.html:151–156`, `pdf-tools.js`) |
| Styling | The toolkit's `.pt-tab` / `.pt-btn` are 999px (`styles.css:18, 31`), overridden by `site.css:279–291` under `.pdf-tools`. It uses native file inputs ("Choose File"). |
| Features | 16 tabs of single-purpose forms. |
| Outdated / redundant | It duplicates the workspace and `/pdf/`. D189 (4): "not separate mini-apps". |
| Draft contract | none (draft does not embed the PDF toolkit) |
| **Action** | **Retire.** The Documents block (M3) already opens the workspace. |

### M9 · "Everything here, and what it costs" cards
| | |
|---|---|
| Route(s) | `/` (`index.html:207–220`) |
| Styling | Tokens; numbered cards (`.card__num` 01–04 in Instrument Serif, `site.css:200–215`). |
| Features | Four links (ATS, Format, Tailor, PDF tools) with the cost of each. |
| Outdated / redundant | It is the fifth listing of the same four tools on one page. The 01–04 numerals carry no information (D182). |
| Draft contract | none |
| **Action** | **Retire.** One line on cost can live in the hero (M2). |

### M10 · Résumé editor
| | |
|---|---|
| Route(s) | `/editor/`, `/editor/?sample=1` (`public/editor/*`, `src/editor/sections.js`); embedded in draft (`client/src/components/ResumeEditorHost.jsx`) |
| Styling | **The best on the site for tokens:** 14 hex, all in `:root` (`editor.css:9–21`); tints derived with `color-mix`; 1 `rgba`. **But it is its own design:** the floating "tool pill" bar (`.bar`, radius 22, `editor.css:46–48`); near-capsule controls (radius 13 on 34 px, `editor.css:51`, 5 on screen); gradient buttons with glow (`.grp.cta`, `.btnlike.cta`, `editor.css:63–64, 116`) instead of depth boxes; card radius 28. The section numbers are 22 px circles (allowed). |
| Features | Font, size, line spacing, margins, B / I / U, colour, lists, indent, align, clear, undo / redo, Fit to one page, Reset, Review changes, Saved state, HTML, Download PDF. The section menu has drag / Alt+arrow reorder and "+ Add a section". The start page opens HTML, PDF or a sample. Autosave to this browser. |
| Outdated / redundant | It is not D189's shell: no top bar (file name, history, Download ▾, the primary action), no mode tabs, no properties panel (no Résumé tab, so no ATS), no page strip or navigator. The labels restate each other: eyebrow "Your résumé", title "Résumé editor", sub "Edit each section in place." (D182). The "Saved" dot sits mid-toolbar. The phone layout stacks the menu over the paper. It is missing from `sitemap.xml`. |
| Draft contract | **rm-editor/1** (`src/editor/sections.js:21`, D157). Draft embeds it, sends its live theme tokens and receives `export` messages. This is the one RM UI draft uses today. |
| **Action** | **Revamp to D189's shell** as the workspace's **structured editor** mode (D189 (3)): the bar's tools become the tool bar, the section menu takes the left column, and the Résumé tab (M5 + M7) goes in the properties panel. The cover letter becomes a document type here (D192 (2)). ⛔ The rm-editor/1 messages and draft's focused mode stay byte-compatible ("none of what draft already features should change"). |

### M11 · Workspace (D189, the standard)
| | |
|---|---|
| Route(s) | `/workspace/` (`public/workspace/*`) |
| Styling | Tokens in `:root` (14 hex). 5 hex outside `:root`: the stamp `#fff / #0f0f0f` (`workspace.css:44`), the thumbnail paper `#fff` (69) and the mark ink `#111` (112). All are paper or brand colours, which is allowed. 13 `rgba` literals, including `.ws-nav` background `rgba(38,38,38,.96)` (`workspace.css:84`, the `--card` value written out). Depth boxes radius 9; no capsules. Dark only. |
| Features | Top bar: name (rename), meta, kind label, saved state, history, undo / redo, Download PDF, Print, Make this an editable résumé, shortcuts, Done. Modes: Edit · Annotate · Fill & sign · Pages · Convert. Tool bar, page strip, canvas with navigator, properties (Text / Page), the phone bottom sheets. |
| Outdated / redundant | (a) **Download is one button.** D189 (1) asks for Download ▾ (PDF · Word · text); Word and text sit in Convert. (b) **Native `prompt()`** for the Compress limit and the Protect password (`workspace.js:108, 141`) instead of the properties panel. (c) The Compress message sends people to "Compress on the PDF tools page at Maximum" (`workspace.js:111`), which is the old toolkit M15 retires. (d) No Share. (e) **Missing tools** that only the old toolkit has: Split, Watermark, Unlock, Images → PDF as a new document, PDF → Excel, HTML → PDF. (f) No light or Plain themes (M20). |
| Draft contract | none (draft does not embed the workspace) |
| **Action** | **Restyle only.** Its shell is the reference. Add the Download ▾ menu, move the two prompts into the properties panel, fix the Compress message, and take the tokens from M20. Tools (e) arrive with M14. |

### M12 · `/pdf/` hub
| | |
|---|---|
| Route(s) | `/pdf/` (generated, `scripts/site/buildSite.mjs`) |
| Styling | `site.css` cards; tokens. |
| Features | 16 numbered cards (01–16), one per tool page. |
| Outdated / redundant | The numerals carry nothing (D182). The grid differs from the Documents home's tool grid (M3), which shows 8 tools in another style. Six of the cards lead to old-toolkit pages (M14). |
| Draft contract | none |
| **Action** | **Restyle only.** Use the Documents home's `.docs-tool` grid (no numerals). Keep it as the SEO landing page for all the tools. |

### M13 · The ten tool landing pages (already D189 P4)
| | |
|---|---|
| Route(s) | `/pdf/{merge,organize,compress,edit,sign,protect,pdf-to-jpg,pdf-to-text,pdf-to-word,ocr}-pdf/` |
| Styling | Tokens; the Documents drop target; no capsules. |
| Features | Breadcrumb, hero, a three-step list, a drop target that opens the workspace with the tool on, an "open it empty" link, and More PDF tools links. |
| Outdated / redundant | Nothing material. The three-step list is instruction, not a restated label. |
| Draft contract | none |
| **Action** | **Unchanged.** |

### M14 · The six tool pages still on the old toolkit
| | |
|---|---|
| Route(s) | `/pdf/{split,watermark,unlock,jpg-to-pdf,pdf-to-excel,html-to-pdf}/` (`data-initial` = split / watermark / unlock / images / excel / html) |
| Styling | The full 16-tab toolkit under `.pdf-tools` (capsule base rules in `styles.css:18, 31`, overridden by `site.css`); native "Choose File" inputs. |
| Features | One form per tool, a result link, and the other 15 tabs. |
| Outdated / redundant | They are separate mini-apps, which D189 (4) retires. The other 15 tabs on each page duplicate the workspace. |
| Draft contract | none |
| **Action** | **Revamp to D189's shell.** Add the six tools to the workspace tool bar: Pages → Split; Edit or Annotate → Watermark; Convert → Excel; Unlock as a password step when a locked PDF is opened; Images → PDF and HTML → PDF as "Start from" entries. Then regenerate these six as landing pages like M13. The operations in `core.js` / `render.js` / `office.js` are reused, not rewritten. |

### M15 · The 16-tab toolkit UI (`mountPdfToolkit`)
| | |
|---|---|
| Route(s) | used by M8 and M14 (`src/pdf-toolkit/ui.js`, `styles.css` 1–60, `.pt-sb` 117–176, `textEditor.js`) |
| Styling | 32 hex (16 outside token defaults). Some are paper and annotation ink, which is fine. Others are UI colour: `.pt-sb` repeats the Dusk palette (`styles.css:120–121`), the status colours `#9fd8a8 / #f2a090` (133), the redact outline `#f2a090` (184–185) and `#888` (109). It has 29 `rgba` (the selection blue `rgba(30,90,200,…)` about 12 times), 999px tabs and buttons (18, 31), and the "Inter Tight" font, which is not self-hosted (127). |
| Features | The same operations as the workspace, plus the six in M14. |
| Outdated / redundant | It is a second UI over the same operations, with its own copy of the tokens. |
| Draft contract | none |
| **Action** | **Retire** the UI layer (tabs, panels, `.pt-sb`) after M14. Keep the operation modules and the `.pt-ed-*` / `.pt-tx` / `.pt-fm` page-layer styles the workspace uses. |

### M16 · Sign in / Create account / Reset password
| | |
|---|---|
| Route(s) | `/#signin`, `/#signup`, `/#reset` (`index.html:159–191`, `site.js:193–223`) |
| Styling | `.panel.glass` cards in the page flow; tokens; depth boxes. |
| Features | Email and password; reset by email link (`passwordReset: false` on live `/v1/site/config`, so no mail is sent today). |
| Outdated / redundant | They are panels scrolled into the page flow, not a dialog. They exist only on `/`, and every other page hides the account controls. There is no Google sign-in (draft's A138 made one shared component). "Get started" restates "Create account". |
| Draft contract | none (RM accounts are separate from draft's) |
| **Action** | **Restyle only.** Make one modal dialog opened from the workspace top bar and the header, using the same tokens. Same routes and same server. |

### M17 · Account (saved documents, credits, export, delete)
| | |
|---|---|
| Route(s) | `/#account` (`index.html:192–204`, `site.js:225–259`) |
| Styling | Tokens; `table.ledger`; a native `prompt()` for the delete password (`site.js:255`). |
| Features | Saved documents (open, pin, delete; retention days from the server), the credit ledger, export as JSON, delete the account. |
| Outdated / redundant | **Two document lists that do not meet.** Saved documents live on the server under the account, and "Recent on this device" (M3) lives in IndexedDB. A saved document opens as a raw blob tab, not in the workspace or editor. Delete uses `prompt()`. |
| Draft contract | none |
| **Action** | **Merge into a workspace Settings panel** reachable from the top bar (D192 (2)): account, credits, export, delete, and Appearance (M20). Saved documents join Recent as one list, and each opens in the workspace or editor. |

### M18 · Privacy
| | |
|---|---|
| Route(s) | `/privacy.html` (server-rendered from `docs/PRIVACY.md`, `src/http/privacyPage.js`) |
| Styling | The site chrome and `.ledger` tables; tokens. |
| Features | The privacy statement; also served as JSON at `/v1/site/privacy`. |
| Outdated / redundant | Nothing in the page. It takes M1's footer fix. |
| Draft contract | none (draft's privacy page names RM) |
| **Action** | **Unchanged.** |

### M19 · The assistant (D190; files still named `tiny*`)
| | |
|---|---|
| Route(s) | every page (`public/assistant/*`) |
| Styling | **Tokens only** (`tiny.css`: 0 hex, `--t-*` mapped from either token set). The launcher is a 60 px circle (allowed). The only hex is the RM logo's own colours (`tiny.js:18–20`). |
| Features | A floating bot: FAQ answers and site commands, no model (D190), voice where supported. |
| Outdated / redundant | Code names and comments still say "Tiny" and "fox" (`tiny.css:1`, `tiny.js:1–6`), though the name was retired in 46v. This is cosmetic. |
| Draft contract | Mirrored byte-identical from draft (engine, vocabulary, voice). |
| **Action** | **Unchanged.** A file and comment rename can ride along with M20. |

### M20 · Design tokens and themes (cross-cutting)
| | |
|---|---|
| Route(s) | all |
| Styling | There are 4 hand-copied Dusk palettes with three naming schemes:<br>• `site.css:32–66`: `--night`, `--glass`, `--glass-strong`…<br>• `workspace.css :root`: `--bg`, `--card`, `--well`…<br>• `editor.css:9–21`: `--bg`, `--card`, `--raise`…<br>• `styles.css .pt-sb`: `--sb-*`<br>Hard-coded `rgba` literals: 21 + 13 + 1 + 29. `site.css:33–37` still lists the A68 accents. |
| Features | — |
| Outdated / redundant | D181's Plain light / dark and D149's Dusk light are absent, and there is no Appearance picker. D189 (5) asks for "one design system with draft … every colour from tokens (`d181PlainTokensOnly` extends to Resume Master)". |
| Draft contract | The editor's rm-editor/1 `theme` message already accepts draft's tokens (`THEME_TOKENS`, `sections.js:286`). Those names are the natural common set. |
| **Action** | **Restyle only.** Make one generated `tokens.css`: the four themes from draft's `themes/*.js`, named after the rm-editor/1 token set. Every RM stylesheet reads it. Shadows and tints become tokens. Add an Appearance picker in the M17 Settings panel, and a tokens-only guard like draft's `colorLiteralGuard`. |

### M21 · Dead code, assets and routes
| | |
|---|---|
| Route(s) | — |
| Styling | The A68 night sky: `body::before` with `url("/sky.svg")` and a `#00466e` gradient (`site.css:77–83`), overridden at line 250. `public/sky.svg` is unused. The six shadowed capsule rules (`site.css:122, 141, 155, 174, 184, 190`) and the `rgba(0,30,50,…)` / `rgba(0,19,31,…)` night tints (125, 224). |
| Features | `site.js:168–190`: the `#pdf-form` (PDF → text) handler. No page has that form. `POST /v1/site/tools/parse-pdf` (`siteRoutes.js:294–303`) has no caller in `public/`, and its scan message says "Reading scans (OCR) is not offered", which is false now that the workspace has OCR. `POST /v1/site/tools/enhance` has no UI caller. |
| Outdated / redundant | All of the above. |
| Draft contract | None of these are draft contracts. ⛔ The **token API's** `/v1/resumes/parse-pdf` and `/v1/resumes/enhance` are draft's and stay (M22). |
| **Action** | **Retire.** Note that `test/pdfTextA70.test.js` pins the site parse-pdf route. Retiring the route means moving that pin on purpose, so the owner approves it. |

### M22 · The token API and the editor contract (what draft uses)
| | |
|---|---|
| Route(s) | `/v1/*`, `/mcp`; `/editor/` embedded |
| Styling | — |
| Features | Declared at contract **1.10.0** (`src/contract/endpoints.js`, `contract/VERSIONS.json` through 1.10.0): `/v1/version`, `/v1/resumes/format`, `/v1/ats/score`, `/v2/ats/score` (ATS contract 2.0.0, not yet live), `/v1/resumes/generate`, `/enhance`, `/gists`, `/parse-pdf`, `/mcp`. |
| Outdated / redundant | The live `/v1/version` reports `scorer: @draft/ats-scorer@1.4.0`; the vendored copy and draft's package are 1.5.0. The live service also predates `/v2`. |
| Draft contract | **Draft calls:** `GET /v1/version`, `POST /v1/resumes/generate`, `/v1/resumes/enhance`, `/v1/resumes/parse-pdf` and `/v1/resumes/gists` (`draft/services/toolsService.js:140–145`), against its pinned copy `draft/contract/resume-master/` at **1.10.0**. It also embeds the editor over **rm-editor/1**. It does **not** call `/v1/ats/score` or `/v2/ats/score`, because ATS scoring runs in draft's own `packages/ats-scorer` 1.5.0. |
| **Action** | **Unchanged.** Deploy the three local commits, then settle owner question 1 before P2. |

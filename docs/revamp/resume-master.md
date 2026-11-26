Status: M1–M3 done (47j, lane w2-outside) · ⏸ awaiting the owner's M4 look — M1 + M2 only (no mock: a separate repository; see M3)

# D197 Wave 2 #20 — Resume Master (D189 / D192): the document workspace in plate tokens

Resume Master is a **separate repository** (`C:\Users\duggi\WebstormProjects\resume-master`, read READ-ONLY at `6ae996a`
for this inventory — nothing there was changed). Its pages are static HTML + vanilla JS under `public/`, themed by one
generated token file (`public/tokens.css` — draft's four themes, Dusk / Plain × dark / light, from
`scripts/site/themes.mjs`). Paths below are relative to that repository.

## M1 · What it has today (from the code)

### 1 · The shell (D189) — every page
| Row | Where |
| --- | --- |
| The nav: the **RM stamp** (home), *ATS check* (`/workspace/?panel=resume`), *Résumé editor* (`/editor/`), *Tailor* (`/editor/?panel=tailor`), *PDF tools* (`/pdf/`); a phone *Menu* (`<details>`, + Privacy); *Settings* (opens the settings dialog: appearance + account) | `public/index.html:16-31` (the `chrome:nav` block, stamped into every page by `scripts/site/buildSite.mjs`), `public/chrome.js`, `public/site-settings.js:20` |
| The footer: stamp, two lines, links (ATS check · editor · Tailor · PDF tools · *Privacy — what is kept, and for how long*) | `public/index.html:73-79` |
| Theme: `<html data-theme>` from Settings → Appearance (Dusk / Plain × dark / light) | `public/theme.js`, `public/tokens.css` |
| Account panel (sign-in, credits) through `/v1/site/*` | `public/account-panel.js:7`, `public/settings-panel.js` |

### 2 · Documents home (`/`, D189 P4)
| Row | Where |
| --- | --- |
| One line + the tagline | `index.html:36-39` |
| **Drop a PDF here** / *Open a PDF* (PDF or .docx; opens the workspace; never leaves the device) | `index.html:44-48` |
| *Recent on this device* (IndexedDB, thumbnails) | `index.html:49-52`, `public/docs-home.js` |
| *Start from*: a blank résumé · a sample · a cover letter · check a résumé against a job · paste a résumé | `index.html:53-56` |
| *Tools*: Edit PDF · Fill & sign · Compress · Convert · Merge & organise · Redact · OCR · Protect (D188's adopted tools) | `index.html:57-69` |
| Tiny's bubble | `index.html:84` (`assistant/tiny-boot.js`) |

### 3 · The workspace (`/workspace/`, D189 P1–P3) — the document workspace
| Row | Where |
| --- | --- |
| Top bar: RM stamp · **file name** (click to rename) · Version history (this browser) · Undo · Redo · **Download ▾** · Print · *Make this an editable résumé* · Settings · Keyboard shortcuts (?) · **Done** | `public/workspace/index.html:24-38` |
| **Modes** (tabs): Edit · Annotate · Fill & sign · Pages · Convert · *Structured ↗* (opens the résumé editor) | `workspace/index.html:40-47` |
| **Tools per mode** (toolbar): Edit — Select, Text box, Erase, Image, Sign, Check, Cross, Date, Redact, Find text in pictures · Fill & sign — Select, Signature, Initials, Name, Date, Text, Check, Cross · Annotate — Select, Highlight, Draw, Box, Note, Watermark · Pages — Rotate left / right, Duplicate, Delete, Move earlier / later, Blank page, Add files, Split · Convert — Compress, Word, Text, Excel, Images, Searchable (OCR), Protect, From Word, From pictures, From HTML | `public/workspace/workspace.js:69-82` |
| Page strip (thumbnails, choose a page) | `workspace/index.html:51` |
| **The canvas** (the document) + the empty state (*Open a PDF*) + the **ATS-first** state (`?panel=resume`: "ATS check — your résumé against one job…") | `workspace/index.html:52-63` |
| Page nav (‹ ›), zoom (− +), Fit width, Fit page | `workspace/index.html:67-75` |
| **Properties** panel: tool options; tabs **Text · Page · Résumé**; *the changes* list (live) | `workspace/index.html:78-90` |
| Phone: a sheet bar — *Pages* / *Properties* | `workspace/index.html:94-96` |
| The signature dialog | `workspace/index.html:100` |
| Versions kept in this browser; Download writes a version | `workspace.js:377,501` |

### 4 · The ATS panel (D192 — the ATS contract; the vendored `@draft/ats-scorer`)
| Row | Where |
| --- | --- |
| The form: Job title · Company (optional, for their stack) · Job description · Your résumé (paste, or from the open PDF) · *Check against this job* | `public/ats-panel.js:183-188` |
| Result card: the number (band colour) · facts · the contextual parts (name, bar, line, number) · *Biggest gain* | `ats-panel.js:119-125` |
| **Not enough signal** — the scorer declined (never shown as a low score) + why | `ats-panel.js:165-166` |
| **Does your résumé add up?** (D192 (4d) plausibility): per flag the reason, employer + bullet, *Dismiss* / *Bring it back*, *N dismissed — show* | `ats-panel.js:141-147` |
| API: `POST /v1/site/tools/ats` | `ats-panel.js:152` |

### 5 · The résumé editor (`/editor/`)
| Row | Where |
| --- | --- |
| Toolbar: Font · text size − + · line spacing (tight / normal / airy) · margins (narrow / normal / wide) · Bold · Italic · Bullets · Underline · Text colour · Numbered list · indent − + · align left / centre / right / justify · Clear formatting · Undo · Redo · *Fit to one page* · *Reset* · *Review changes* · *HTML* · **Download PDF** | `public/editor/index.html:19-73` |
| Sections menu: eyebrow, title, sub · the section list (drag, or Alt+↑/↓; name and contact stay on top) · *+ Add a section* | `editor/index.html:77-88` |
| The paper (the résumé) | `editor/index.html:89` |
| Start: *Open an HTML résumé* · *Open a PDF* · *Start from a sample* | `editor/index.html:95-100` |
| Embedded only by draft (else "This editor can be embedded only by draft…") | `editor/index.html:105` |
| Tailor side (`?panel=tailor`), via `/v1/site/*` | `public/editor/editor-side.js:25` |

### 6 · Tiny (D190) — **a floating bot, not a side panel today**
| Row | Where |
| --- | --- |
| The fox bubble bottom-right on every page (a perfect circle), opening a floating chat card above it; a bottom sheet on phones | `public/assistant/tiny.css:1-4` |
| The card: the conversation, the input (*"e.g. replace 2023 with 2024 on line 3"* on a document, else *"e.g. open the compress tool · is my file uploaded?"*), **Speak a command** (voice), Close | `public/assistant/tiny.js:65-88,144` |
| T1 / T2 from `commands-v1.json` + `faq-rm.json` (no model) | `tiny.js:43`, `assistant/assistantEngine.js` |

### 7 · The PDF tool pages (`/pdf/<tool>/`, D188) — 16
compress · edit · html-to-pdf · jpg-to-pdf · merge · ocr · organize · pdf-to-excel · pdf-to-jpg · pdf-to-text · pdf-to-word ·
protect · sign · split · unlock · watermark (`public/pdf/*/`), plus `/pdf/` (the index). Each a landing page that opens the
workspace in its mode (inventory per page left to M5 — **row whose depth is unclear**).

## M2 · The brief

**Atlas name and parts.** Plain names (it is a tool, D197 row 20): **the workspace** (the document on its paper), **the
toolbar** (modes as `BinderTabs`, tools as `pl-btn--icon`), **the properties panel**, **the ATS card** (= draft's
`FitCard` — one card on both sites, D197's "one design system"), **Tiny**.

**Palette.** Region **VI** (Languages & media — the closest region for documents) for rules and the active mode's
shadow; **clay = the one primary action per screen** (Done in the workspace, Download PDF in the editor, *Check against
this job* in the ATS form); **green only for proven** (the ATS band "strong" stays the band colour, not a button).

**⛔ The page stays paper-white in every theme** (the owner's row): the document and its canvas are `--pl-card` on
`--pl-paper` in Dusk and Plain alike; the theme reaches only the chrome around it until a dark plate variant exists.

**Hero plate.** None on the workspace (the document is the hero). The **Documents home** gets one: *drawing needed* — an
isometric desk tile (a page, a pen, a stamp) in Region VI's ramp (to sketch first; the ramp has to be built — only IV's and
III's exist in `styles/plate.css`).

**Sections, each with one drawing.** Home: the drop target (a dashed "not yet" drawer = `Drawer`), Recent (catalogue
cards — `CatalogueCard` with the file's name as the title and pages · size as the call number), Start from (`Ticket`s),
Tools (`Ticket`s). The workspace and the editor: no drawings (tool surfaces).

**The one operable model.** The document itself (edit in place).

**Squares.** None.

**Onward tickets.** Home's *Start from* and *Tools*; the ATS card's *Learn it →* links to draft's Atlas (as the
FitCard does).

**Tiny.** The row says "Tiny in its side panel"; the code since 11-15 is a floating fox bubble + card (owner 11-15). **Owner
to decide at M4:** a side panel (the plate's `FloatingPanel` from `client/src/plate/Panels.jsx` — the same frame as the
extension's panel) or keep the bubble restyled (a 1.5 px ink circle with a hard shadow).

**How the tokens get there.** RM can't import draft's client. At M5: `scripts/site/themes.mjs` gains a `plate` block
generated from draft's `client/src/styles/plate.css` (as the four themes are generated today), and RM's `public/tokens.css`
carries the `--pl-*` names — one design system, two sites. RM commits need the owner's authorisation (D190 granted it for
Tiny only).

### Where each M1 row lives (D200 Rule 1)
| M1 rows | Where |
| --- | --- |
| §1 nav, footer, settings, account | the plate `AreaNav` (no pill; views = ATS check · Résumé editor · Tailor · PDF tools; *Settings* as the chip's place); footer as a `Ruler` + mono links; the stamp → the plate's RM mark (**unclear: RM's own logo in plate linework — to sketch**) |
| §2 home rows | Drawer (drop), CatalogueCard (recent), Ticket (start from, tools) |
| §3 top bar, modes, tools, strip, canvas, page nav, zoom, properties, sheet bar, dialog, versions | `pl-btn` / `pl-btn--icon` / `BinderTabs` / a `pl-card` properties panel / `FactSheet` for *the changes*; behaviour unchanged |
| §4 ATS panel | form in plate inputs; the result = **`FitCard`** (the number, parts, gain, "not enough signal"); plausibility rows as `StatusTag` marks with *Dismiss* / *Bring it back* |
| §5 editor toolbar, sections menu, paper, start, embed refusal | `pl-btn--icon` groups; the section list as a `TrailRail`-like list (**unclear: drag-to-reorder has no plate piece**); the paper stays white; start = `Ticket`s |
| §6 Tiny | `FloatingPanel` or the restyled bubble — owner's call (above) |
| §7 the 16 tool pages | each as a small `TitleBlock` + one `Ticket` into the workspace — M5 inventory first |

## M3
No mock: Resume Master's pages are not React and live in another repository, so a `/dev/plate` mock would show draft's
components, not RM's pages. The two library pieces RM would wear are already drawn here: `FitCard` (the ATS card) and
`FloatingPanel` (Tiny, if the owner picks the side panel) — see `/dev/plate?page=extension-panel`.

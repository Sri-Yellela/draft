# Resume Master site audit (D189 P0) — 2026-11-13

What resumemaster.one is today, measured on the code at resume-master `f1af96f` (served locally by its own `createApp`),
before D189's redesign into one document workspace. Screenshots of every page at desktop (1440 × 900) and phone
(390 × 844): `docs/research/rm-site-audit/*.png`, with `index.json` (title, page errors, sideways scroll, control count,
the toolkit's tabs). All 40 shots: **0 page errors, 0 pages that scroll sideways.**

## Routes

| Route | What it is | Kind |
|---|---|---|
| `/` | Home: hero + four tabs — **ATS check** (free), **Format** (free), **Tailor a résumé** (1 credit, account), **PDF tools** (free, the toolkit mounted lazily) | hand-written page, chrome injected |
| `/pdf/` | The PDF hub: 16 numbered cards, one per tool | generated (`scripts/site/buildSite.mjs`) |
| `/pdf/<tool>/` × 16 | One page per tool (merge, split, organize, compress, **edit**, **sign**, watermark, protect, unlock, jpg-to-pdf, pdf-to-jpg, pdf-to-text, pdf-to-word, pdf-to-excel, ocr, html-to-pdf): breadcrumb, hero, a 3-step list, then the WHOLE toolkit with that tool's tab open, then "More PDF tools" links | generated |
| `/editor/` | The résumé editor (D157): a floating tool pill over a section menu + the paper; standalone opens an HTML résumé, a sample, or (A203 (2)) a PDF; embedded in draft via `rm-editor/1` | hand-written app |
| `/privacy.html` | Privacy | hand-written |
| `/v1/*`, `/mcp` | The API (format, ATS score, parse-pdf, generate, enhance, gists, site accounts) and the MCP tools | server |
| `/lib/*` | The browser libraries, self-hosted: pdf-lib, pdf.js, the toolkit, the editor model, fflate, tesseract (+ core, English data) | static |

## Components

- **The chrome** — one header (the stamp; ATS check · Format · Tailor · PDF tools; Sign in / Get started or the account bar) and one footer, injected into every page between `<!-- chrome:* -->` markers. Phone: the links collapse into **Menu**.
- **The PDF toolkit** (`src/pdf-toolkit/`, framework-free) — `mountPdfToolkit()` draws a promise line, **a wrap of 16 tool tabs**, and the open tool's panel. Each tool is its own small form (a file picker, a few options, one button, a download link). Exceptions with a canvas: **Organize** (thumbnails), **Edit** (A203 (2)–(4): the pages with an editable field on every line, OCR, draft's sandbox toolbar), **Sign** (pages + placed items + the signature maker).
- **The résumé editor** (`public/editor/`) — tool pill (font, size, line spacing, margins, B / I / U, colour, lists, indent, align, clear, undo / redo, Fit, Reset, Review changes, HTML, Download PDF), a section menu (reorder by drag / arrows, add a section), the paper in a shadow root.
- **Home's tools** — ATS check (paste résumé + job → band + evidence), Format (paste → formatted HTML preview + print), Tailor (account + credit), each a plain form in a card.

## Styling in use

Since A203 (3) (11-13): draft's **Dusk** — canvas `#1B1B1B`, cards `#262626`, wells `#2E2E2E`, border `#343434`, ink `#FFF / #A3A3A3`, accent `#FBD3C4`; draft's depth shadows on every control, radius 11, no capsules; DM Sans body, Instrument Serif display, the Barlow Condensed stamp. The toolkit's own structure CSS is themed through `--pt-host-*`; Edit PDF carries a `.pt-sb` sandbox block with the Dusk values written in. **Only Dusk dark** exists — no Dusk light, Plain light / dark, no theme switch, no density setting.

## What is missing for a document workspace (D189's shape against today)

| D189 asks | Today |
|---|---|
| (1) One shell: top bar (file name, save state, history, undo / redo, Download ▾, Print, Share, Done), mode tabs, a tool bar | **None.** Every tool page is a separate mini-app: a hero, steps, 16 tabs, a form. Undo exists only inside Edit (per line) and the editor. |
| (2) Workspace: page strip · canvas with a navigator (page n / N, zoom, Fit) · properties panel (+ Résumé tab) | Page thumbnails only in Organize; Edit / Sign show pages as a long column with no navigator, zoom or page strip; no properties panel (Edit's toolbar is the nearest). |
| (3) Structured editor vs PDF edit, labelled; "Make this an editable résumé" | Both exist (the editor; Edit PDF) and A203 (2) links them one way ("Open in the résumé editor"), but nothing labels which mode a document is in. |
| (4) Documents home: drop a file, recent documents, Start from, the tools grid opening the SAME workspace | `/` is a tool page with tabs; `/pdf/` is a card grid of separate pages; nothing is remembered between visits. |
| (5) One design system with draft | Dusk only (A203 (3)); no light themes, no density, the toolkit and editor each carry their own copies of the tokens. |
| (6) Autosave + version history, states, shortcuts, accessibility, phone bottom sheets | The editor autosaves to this browser (one version); the toolkit keeps nothing; no shortcut list; phone = the same column narrower. |
| (7) Inside draft: the same component, focused mode | The editor already is (D157); the PDF tools are not offered in draft at all. |

## Notes for P1 (the sketch)

- The pieces to reuse, not rebuild: the content-stream text editor + OCR (A203 (2)–(4)), the signature maker (A203), Organize's page operations, the toolkit's 16 operations in `core.js` / `render.js` / `office.js`, the editor's section model (`src/editor/sections.js`).
- Every tool page should become a landing page that opens the workspace with that tool active (D189 (4)) — the 16 SEO pages stay (findable by "merge pdf" etc.), their bodies change.

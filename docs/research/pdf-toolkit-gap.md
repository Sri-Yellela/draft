# Resume Master's PDF toolkit vs two mainstream PDF editors (D188 (1)–(3)) — 2026-11-13

Sources: D188's photos (11-11) and the owner's two screenshots of 11-13 (resume-master `docs/Screenshot 2026-11-13 124520.png` —
a fill-and-sign editor, PDFfiller; `…124546.png` — Smallpdf's Edit & Annotate). Features only; no document contents.
Measured against resume-master `f1af96f` (11-13: A203 Edit PDF in place + OCR, Sign PDF, the editor's sandbox options, the
site in draft's Dusk). The site's structure is audited in `rm-site-audit.md` (D189 P0).

## (1) Inventory — what Resume Master offers today

| Tool | Where it lives | Runs | Library (licence) |
|---|---|---|---|
| Merge · Split · Organize (reorder / rotate / delete) · Watermark · Protect (AES-256) · Unlock · Images → PDF | toolkit `core.js`, tool pages + home's PDF tab | browser | @cantoo/pdf-lib (MIT) |
| Compress (re-encode pictures; Maximum = flatten) | `core.js` + `render.js` | browser | pdf-lib, pdf.js (Apache-2.0), canvas |
| PDF → images · PDF → text (reading order, two columns) | `render.js`, `pdfText.js` | browser | pdf.js |
| PDF → Word (.docx) · PDF → Excel (.xlsx) | `office.js` | browser | fflate (MIT) |
| OCR (text + a searchable PDF) | `render.js` | browser | tesseract.js + core + eng data (Apache-2.0) |
| HTML → PDF | `ui.js` (sandboxed frame, the browser prints) | browser | — |
| **Edit PDF** — the page's own text edited in place, a field on every line, OCR for text in pictures, face / size / B / I / U / colour, "Open in the résumé editor" | `textEdit.js`, `textEditor.js`, `core.applyTextEdits`, `pdfToDoc.js` (A203 (2)–(4)) | browser | pdf-lib, pdf.js, tesseract.js |
| **Sign PDF** — signature + initials drawn / typed / traced from a photo (vector), date, name; placed, dragged, resized; SVG download | `sign.js`, `editor.js`, `core.applyEdits` (A203) | browser | pdf-lib |
| Résumé editor (structured: sections, the sandbox's toolbar, Review changes, HTML, PDF by print, opens a PDF) | `public/editor/`, `src/editor/sections.js` (D157, A203 (2)) | browser | — |
| Parse a résumé PDF (text layer) · format · ATS score | API `/v1/resumes/parse-pdf`, `/format`, `/ats/score` | server | pdf.js, the vendored ATS scorer |
| Tailor / generate / enhance / gists | API `/v1/resumes/*` (metered) | server | Anthropic API |

## (2) Gap matrix

| Feature (A = Smallpdf · B = PDFfiller) | RM | Note |
|---|---|---|
| B · **Edit existing text in place, a box on every line** | **has** | A203 (2)–(4): stream-level removal + real text; OCR fields for text in pictures. ⚠ font substitution is not yet *disclosed* (D188 (4)) |
| A · Add text / B · Text, Text Box | **partly** | in Sign (Name / Date) and the retired add-items Edit; not in the edit workspace |
| B · Erase | **partly** | white-out existed in the add-items Edit; not in the workspace |
| A/B · Image | **partly** | same |
| A/B · Sign (draw / type / upload) | **has** | Sign PDF (vector, traced uploads, initials) |
| B · Check ✓ · Cross ✗ | **no** | |
| A/B · Shapes | **no** | |
| A · Draw (pens) · Highlight | **no** | |
| A · **Redact** (true removal) | **no** | the stream reader (A203 (2)) can strip text under a box — then cover + flatten pictures under it |
| A · Watermark | **has** | separate tool |
| A · Crop | **no** | pdf-lib setCropBox |
| A/B · Undo · Redo | **partly** | Edit: per line; editor: yes; no global undo in the toolkit |
| A · Select · Pan | **partly** | click-to-edit; no pan / zoom |
| A/B · Page strip (thumbnails, duplicate / rotate / delete, + add page) | **partly** | Organize has thumbnails + rotate / delete / reorder; not inside Edit / Sign; no duplicate |
| A · Add PDF / image / Word / Excel / PowerPoint into one PDF | **partly** | Merge (PDFs) + Images → PDF; no Word / Excel / PowerPoint → PDF |
| A/B · Navigator (page n / N, zoom %, Fit) | **no** | |
| A · Modes: Edit & Annotate · Fill & Sign · Organize Pages | **partly** | separate tools, no shared shell (D189) |
| B · **Fill out** (the PDF's own form fields) | **no** | pdf-lib's AcroForm (getForm, text / check / radio / dropdown) |
| B · Create form (add fields) | **no** | |
| B · Invite to sign · A · Share · Save to cloud | **no** | |
| A · AI PDF / B · assistant | **no** | |
| A/B · Download · Print | **partly** | Download per tool; no Print in the toolkit |
| A · Compress · Convert · OCR | **has** | |
| B · Table | **no** | |
| A · Pro upsell banner | — | not wanted (D182) |

## (3) Classification for draft's people (job seekers)

**ADOPT NOW** (serve a résumé, a cover letter, an application, an offer):
- **Edit text in place** — ✅ built; **+ disclose font substitution** ("font substituted: Helvetica for Calibri" in the properties / on save) — `d188FontSubstitutionDisclosed`.
- **The edit workspace's add-tools**: Text box · Erase (white-out) · Image · Signature / Initials (from Sign) · Check ✓ · Cross ✗ · Date — what offer letters and onboarding forms need.
- **Fill out** (AcroForm fields: text, check, radio, dropdown, signature field) — W-4 / I-9-style and employer forms.
- **Redact, truly** — remove a phone / address / photo before a résumé goes public (D183); the text leaves the stream (A203 (2)'s reader), pictures under the box are flattened — `d188RedactionRemovesText`.
- **Compress with the limit shown** — the file's size against the form's cap (most ATS: 2–5 MB) — `d188CompressShowsSizeVsLimit`.
- **Word → PDF** (most people hold a .docx) — needs a .docx reader in the browser; the licence checked first (mammoth BSD-2 → HTML → the print path).
- **Merge / organise inside the workspace** — résumé + cover letter + transcript in one file; + duplicate page — `d188MergeKeepsPageOrder`.
- **Undo / Redo, page strip, navigator, zoom + Fit** — the workspace's basics (D189 (1)–(2)).
- **OCR** — ✅ built (tool + inside Edit).

**LATER**: Highlight · Draw · Shapes · comments (reviewing with a mentor / a D180 connection) · Ask about this PDF (an offer's terms, through D162's gateway with D173's fencing) · Crop · Excel / PowerPoint → PDF · Print in the toolkit.

**NOT**: Invite to sign / Create form (e-signature workflows and form-building are another product) · Tables in résumés (they break ATS parsing — WARN when a résumé has one — `d188TableInResumeWarns`) · cloud storage beyond the person's own résumés and application files · upsell banners (D182).

**Licences (D188 (4))**: in use — pdf-lib MIT, pdf.js Apache-2.0, tesseract.js Apache-2.0, fflate MIT. No AGPL (MuPDF / Ghostscript are not used) — `d188NoAgplWithoutLicence`.

## Build order (sized), inside D189's workspace once its sketch is approved

1. **Disclose font substitution** in Edit (S — can ship before the shell).
2. **The workspace shell** (D189 P2: top bar, modes, tool bar, page strip, canvas + navigator, properties) hosting today's Edit and Sign (L).
3. **Add-tools in Edit & Annotate / Fill & Sign**: text box, erase, image, signature / initials, ✓ / ✗, date (M — the parts exist in A203's `editor.js`).
4. **Fill out** AcroForm fields (M).
5. **Redact** with true removal (M).
6. **Compress size-vs-limit**, **Word → PDF** (S + M).
7. Undo / redo across all tools, keyboard shortcuts, phone bottom sheets (M — D189 P5).

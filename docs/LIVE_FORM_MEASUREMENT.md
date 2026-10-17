# Live form measurement — what the extension reads on real application forms

**Measured 2026-10-15**, read-only, by the live-markup lane. Structure only: the forms are public, and no value was typed,
chosen, attached or submitted. Nobody signed in, and no personal data was entered or recorded. Question wordings are the
employers' own public text and are quoted only where a classifier rule depends on them.

## How

- **Browser.** A real headless Chrome (`puppeteer-core` + `test-support/extensionBrowser.mjs findChrome`). Each page was
  loaded with `networkidle2`, waited on for about 8 s, and scrolled once so lazy embeds mounted. Only GET requests were
  made — the page's own loads.
- **Code.** The probe in every frame is the extension's OWN `probeFormShape` (`gated-handoff.js __probeSource`), the text the
  service worker injects. The fields were then classified by `fieldSemantics.js` (`classifyFields`, `fileTypeOf` /
  `fileTypesOf`, `guessLabelOf`) and by `gated-handoff.js questionKind`. Panel rows come from `review-overlay.js panelRowsForStep`.
- **robots.txt.** It was read first. `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com` and `apply.workable.com`
  allow these paths. `boards.greenhouse.io` disallows `/embed/`, and nothing there was fetched directly. Stripe's embed is
  on `job-boards.greenhouse.io` and was loaded only by Stripe's own page.
- **Load.** About four loads per site, over two rounds: before the changes, and once after them with the new code.
- **Snapshots — not saved.** No snapshot is saved under `test-support/fixtures/live/`. The rendered markup was large (Lever's
  form was 1.2 MB, most of it a location list) and full of each employer's own copy. The structures that mattered are
  reproduced in miniature, with synthetic words, in `test/liveFormMarkup.test.js`, and the Greenhouse one in full in the
  fixture `scripts/fakeAtsGreenhouseStandard.js`.

## The forms

| # | Form | Where the fields are |
|---|---|---|
| 1 | Stripe — `stripe.com/careers/apply/software-engineer-backend/8198280` | In an iframe: `job-boards.greenhouse.io/embed/job_app` (`?for=stripe&token=8198280`). The posting page `…/careers/listing/…/8198280` has NO form, only "Apply" links to `/careers/apply/…`. `job-boards.greenhouse.io/stripe/jobs/8198280` redirects to Stripe's posting. |
| 2 | Greenhouse — `job-boards.greenhouse.io/discord/jobs/8840756002` | top frame |
| 3 | Greenhouse — `job-boards.greenhouse.io/figma/jobs/5426468004` | top frame |
| 4 | Lever — `jobs.lever.co/palantir/<posting>/apply` | top frame (also two hCaptcha frames) |
| 5 | Ashby — `jobs.ashbyhq.com/ramp/<posting>/application` | top frame, no `<form>` element (the probe's scope is the document) |
| 6 | Workable — `apply.workable.com/huggingface/j/19A136F8E2/apply/` | top frame |

## Before → after

In the table:

- **Fields** = `probeFormShape().fields`.
- **Unlabelled** = fields with no `labelSource`. In brackets: how many of them the panel would show (it skips an invisible field
  that is not an upload).
- **Keyed** = fields given a vocabulary key.

| # | Fields before → after | Unlabelled before → after | Keyed before → after | Uploads typed, after | Panel, after |
|---|---|---|---|---|---|
| 1 Stripe | **45 → 29** | 0 → 0 | 12 → 11 (twins gone; +current-company, +current-title, +location) | resume, cover_letter | 28 rows, 0 Unlabelled, 1 résumé row |
| 2 Discord | **34 → 25** | 0 → 0 | 12 → 10 (twins gone) | resume, cover_letter | 24 rows, 0 Unlabelled, 1 résumé row |
| 3 Figma | **24 → 20** | 0 → 0 | 10 → 9 (twins gone; +website "Other Website") | resume | 19 rows, 0 Unlabelled, 1 résumé row |
| 4 Lever | 59 → 59 | 0 → 0 | **7 → 9** (+location, +how-heard) | resume | 54 rows, 0 Unlabelled, 1 résumé row |
| 5 Ashby | 17 → 17 | **2 (1) → 1 (0)** | 4 → 4 | other (autofill drop zone), resume, cover_letter | 13 rows, 0 Unlabelled, **1** résumé row (was 2 once labelled) |
| 6 Workable | 22 → 21 | **1 (1) → 0** | 7 → 7 | **other → resume** | 17 rows, 0 Unlabelled, 1 résumé row |

Stripe's 29 includes the phone widget's hidden country search box (`iti-0__search-input`, labelled "Search", invisible),
which rendered on some loads and not on others. The panel does not list it.

## What was wrong, form by form

### Greenhouse (1–3) — and the "43 fields" in the owner's field report 4

- **Duplicate fields.** Every **required** react-select picker is followed by react-select's backing input:
  `<input required tabindex="-1" aria-hidden="true">`, with no id and no name. The probe counted each one as a field of its
  own and labelled it from its group ("School*", "Degree*", …). On Stripe that was **14 of 45** fields, each a second row
  for the same question.
  - Fixed in the probe AND in `applyPlan`, whose filters stay byte-identical: a non-radio / checkbox / file input that is
    `aria-hidden="true"` and `tabindex="-1"` is not a field.
  - Radios, checkboxes and file inputs are exempt. Workable's real radios are exactly that, behind `role=radio` wrappers,
    and Lever's résumé input is `tabindex="-1"`.
- **Labels were already right.** Every Greenhouse field resolved its label (`for` / `group`), uploads included: "Resume/CV*"
  from the group heading, never "Attach".
- **Wordings now keyed:**
  - "Who is your current or previous employer?" → current-company
  - "What is your current or previous job title?" → current-title
  - "If located in the US, in what city and state do you reside?" → location
  - "Other Website" → website
- **EEO.** "I consider myself a member of the LGBTQ+ community" was read as an ordinary question. `questionKind` now reads
  it as EEO.
- **Unkeyed, as D96 §7 requires.** Every eligibility, sponsorship, opt-in, screening and EEO question stays without a key:
  the Yes/No "authorized to work", "sponsor you", "opt-in to receive WhatsApp messages", "N years of experience",
  Gender / Race / Veteran / Disability / Pronouns / LGBTQ+.

### Lever (4)

- **Wrapping label.** A question's `<label>` wraps the question AND its field. The location label's text was therefore
  "Current location ✱No location found. Try entering a different location", which matched nothing. The résumé's text
  carried "ATTACH RESUME/CV … Couldn't auto-read resume. Analyzing resume…".
  - Fixed: a wrapping label gives its label-ish part (`.application-label`) BEFORE the field.
  - Its text is read without the controls inside it, so a wrapped `<select>`'s options never become a label.
  - Location is now keyed.
- **Wording now keyed:** "Please tell us how you heard about this opportunity." → how-heard.
- **Not keyed, still:** "Which university are you currently attending or did you last attend? …" (a long, conditional
  question). The language checkbox group is 33 boxes, one question.
- **False EEO reading — fixed after the lane (43k, open item 6).** "Name Pronunciation" read as EEO because `pronoun` matched the letters in "pronounce"; `questionKind` now matches `\bpronouns?\b` as a word (`test/eeoPronounWord.test.js`).

### Ashby (5)

- **Autofill drop zone.** The "Autofill from resume" drop zone is an unnamed `<input type=file>` whose words come AFTER it
  (an h3, then "Upload your resume here to autofill key application fields"). It was **Unlabelled**.
  - Fixed: a file input with no other label takes the words just after it in its own box (a box holding no other field),
    asked last.
  - Labelled, it reads as a résumé upload, so the panel would draw **two** résumé rows. `fieldSemantics.js fileTypesOf`
    reads a form's uploads together: when there are two or more `resume` uploads and some — not all — say autofill /
    parse, those are `other`.
  - A **lone** autofill upload stays `resume` — Workday's "Autofill with Resume" step has only that one.
  - The attach itself already chose the real field (`resumeInputScore` on its own words).
- **Long labels.** Two long custom questions fell to their placeholder "Type here…": the 300-character limit refused
  their `<label for>`. Fixed: a label the page TIES to its field (`for` / `aria-labelledby` / `aria-label`) is not
  refused for length. The limit stays on the inferred sources.
- **reCAPTCHA.** The `g-recaptcha-response` textarea is Unlabelled and invisible. The panel does not list it.

### Workable (6)

- **Résumé label.** The résumé upload's first `<label for>` is its preview, an `<svg>` whose fallback text is "SVGs not
  supported by this browser." That was its label, so it was typed **other**. Its second `<label for>` is the button
  "Choose file". Its `aria-labelledby` names the heading AND that button.
  - Fixed: a label's words are read without `<svg>`, scripts and controls.
  - Every `<label for>` is asked.
  - An `aria-labelledby` list drops its button-word pieces.
  - The upload now reads "Resume", typed `resume`.
- **Long question.** One required question (≈ 330 characters, tied by `aria-labelledby`) was Unlabelled — the length
  limit again. Fixed as above.
- **Backing input.** The select-style combobox has a backing `<input name=… tabindex="-1" aria-hidden="true">`, dropped
  like Greenhouse's.

## The fixture against the live markup (`scripts/fakeAtsGreenhouseStandard.js`)

The T18 / T23 fixture was transcribed from the field report. It now copies the measured structure:

- **Pickers.** The react-select markup: `select__input`, `aria-haspopup="true"`, and the backing input after each
  required one. On a pick the query is cleared and the menu unmounts, as react-select does.
  - The old fixture left the picked text in the input and in a hidden menu. The fill's read-back passed only because of
    that leftover.
- **Which questions are pickers.** Degree, the eligibility / sponsorship questions and Gender / Veteran Status are now
  pickers, not `<select>`s.
- **Country and Phone.** Country is required, in `fieldset.phone-input` under a hidden legend "Phone". Phone has no
  autocomplete token. Text fields carry an `aria-label`.
- **Upload.** The nesting is `div › .secondary-button › .button-container › .file-upload__wrapper › .file-upload[role=group]`,
  with Dropbox, "Enter manually" (its `<label for="<id>_text">` names no input) and "Accepted file types".
  - At this depth, `resumePanel.js attachResumeFile`'s 4-step walk never reached the group, which is where a file name
    would show. It now treats the upload's group as the wrap.
- **Layout.** The education header is a `<p>`, followed by "Add another". The EEO block is `.eeoc__container` under an
  `<h2>`, not a fieldset. The custom questions are in a second `.application--questions`. "Locate me" follows the location
  picker.

### Not measured, still transcribed

- **Discipline, start / end month and year.** None of the three Greenhouse forms asked them; the employer configures the
  education block.
- **The file name after an attach.** Nothing was attached to a live form.
- **Any picker's options.** No list was opened — that would have meant typing into the page — including the phone Country
  list's format ("United States +1").
- **Lever's location suggestions** and Ashby's location autocomplete options.

## Tests

`test/liveFormMarkup.test.js` reproduces each structure in miniature, with synthetic words. Its browser tests run in a
real Chrome; the classifier tests run without one. It covers:

- the backing input in the probe AND `applyPlan` (index alignment);
- Workable's aria-hidden radios staying fields;
- the svg label and "Choose file";
- every `<label for>` being asked;
- long tied labels;
- Lever's wrapping label and a wrapped `<select>`;
- Ashby's drop zone and one résumé row, in the panel and in the intent model's tells;
- a lone autofill upload staying `resume`;
- the new wordings and their near misses;
- LGBTQ+ → EEO, with eligibility / EEO / consent unkeyed.

**Mutation check:** 20 mutations of the changed code. 19 were caught. The one survivor (letting `fileTypesOf` consider a
single résumé upload) is equivalent: its other condition already requires a non-autofill résumé upload beside it.

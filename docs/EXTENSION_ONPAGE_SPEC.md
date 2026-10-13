# D96 · D97 · D98 — the extension on the page: fixes, memory, auto-read, and a résumé generated where you apply

**Owner, 10-13 (local unpacked, Zoom's Workday, signed in as the personal account).** Decisions: **résumé output = D, panel first, editor on demand — CONFIRMED** · **auto-read = OPT-IN PER SITE, with auto-capture to the user's OWN account after the read (D64, extended); capturing postings for the SHARED board from the browser is a NO-GO — see `docs/AUTO_READ_RISK_ANALYSIS.md`** · **an acknowledged answer is remembered — ONE tick, eligibility included, not asked again; a change is recorded and not stored until re-acknowledged (§4)** · **no version bump: the listing already says v1.5.2 (bumped before this instruction) — KEEP v1.5.2 as the single local working version, do not bump again, and fold every further fix into the same zip** in `extension/submission/`.
**Sketch (the specification):** `docs/sketches/extension-onpage.html` — ⛔ build to the file, not this prose. ⚠ *Not seen in a browser by its author — the owner opens it first.*

---

## 0 · The real page (the fixture)
`https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`
**Parse:** tenant `zoom` · data centre `wd5` · locale `en-US` · site `Zoom` · location slug `Remote--(US)` (decode brackets and the double hyphen) · title slug `Software-Engineer` · requisition `R19749-1` (`R19749` + repost suffix `-1`) · stage `/apply/applyManually` · tracking `source=linkedin`.
**Opened straight from a LinkedIn link — the posting page was never seen**, so the extension never read the description; the capture matched a board job by title + company (the board's Zoom copy comes from another ATS).
**The apply flow (from the owner's screenshots):** *My Information · My Experience · Application Questions · Voluntary Disclosures · Review.* **Fixture URLs for the later stages are added ONLY from what the owner pastes — never invented.**

---

# D96 · FIXES AND MEMORY

## 1 · The symptoms (all observed)
1. The same job is not recognised across stages; capture prompts again, then says "already captured".
2. Fill says *"draft doesn't know this job — capture it first"* while the popup says the job is already in the imports.
3. The review panel says **"Ready. Everything uncertain has been checked" with "0 field(s) filled"**.
4. **First Name\* / Last Name\*** are flagged *"guessed field"* — exact labels, the asterisk defeats the match.
5. Only 4 fields were filled; address lines, state, phone are missing, and **unfilled fields are not listed at all**.
6. The panel cannot be collapsed or closed and stays on screen.
7. **Nothing persists:** close the popup or reload and it is zero — no page read, no prepared answers.
8. What the owner **acknowledged or typed** is not remembered next time and is not in the Copy sheet.
9. The Copy sheet lives in the **popup**, which Chrome closes when the page gets focus; it has no close control; it lists 4 answers.
10. *Captured today* did not count the job captured twice. *(The popup now reads "Captured: 1 today · 0 already on your board" — keep that; the earlier "0" was the automatic-capture list.)*

## 2 · One job identity, and a binding that follows the tab
- **Canonical key per ATS**, used by capture, context, fill, prepare, Copy sheet and "I submitted it". **Workday:** `tenant|site|R19749` (the base id); the `-1` is kept as `rev`. **P0 reports whether a `-1` / `-2` repost is the same job** (ask the owner if unclear).
- **A normaliser** strips the locale, `/apply`, `/apply/applyManually`, `/apply/useMyLastApplication`, `/login`, `/createAccount`-style stages, and `?source=` and other tracking parameters; it decodes the location slug.
- **Capture on an apply page** sends the **canonical posting URL** (stage, query and locale stripped) plus the key, and the title and company read from the application page's header. The server answers **which board job the key, or (company, title), matches.**
- **THE TAB BINDING:** `chrome.storage.session`: `(tabId, origin) → { jobId, jobKey, boundAt, via }`. Set on a capture, on a recognised posting, on a context match. **Used FIRST** by fill, prepare, Copy sheet and "I submitted it". Cleared when the tab closes, when a **different** posting is recognised in the tab, or by **Unlink this page**. ⛔ **No new permission** (no `tabs`, no `webNavigation`) — it relies on the `activeTab` grant, which persists across same-origin navigation. ⛔ **Never written to the server; never shared across tabs or users** — which is why Workday needs **no origin-table entry** (D67's security call stands). **It must also survive Workday changing steps WITHOUT changing the URL.**
- **Wording, one place:** after a capture that matched a board job — *"Software Engineer at Zoom is on your board and in your imports."* Fill says *"capture it first"* **only** when there is truly no binding and no match; when it uses the binding it says so (*"Using Software Engineer at Zoom, captured 10:41"*).

## 3 · Persisted progress — the popup remembers
**One record per job**, `chrome.storage.local`, key = the canonical job key:
```
{ jobKey, jobId, title, company,
  captured:  { at },
  read:      { at, stage, fieldCount },
  prepared:  { at, packetId },
  filled:    { n, of, needYou, check },
  reviewed:  { at }, submitted: { at },
  updatedAt }
```
- ⛔ **No answer VALUES in this record** (they live in saved answers, §4); fields are identified by a normalised-label hash.
- **The popup opens knowing the job and where you are:** *Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you · Reviewed · Submitted* — and an **In progress** list of the last five jobs (title · company · where it stands) that brings you back.
- **Survives** closing the popup, reloading the page, a browser restart, and opening another job. **Retention 30 days; cleared on Disconnect and sign-out.**
- **The prepared packet stays on the server** (the existing drafted-application record, D55–D58); the popup shows its state, it does not re-ask on open. *(Whether the progress should also live server-side so it follows the user across devices is a later decision — local first.)*
- ⛔ **D23 holds:** opening the popup reads **nothing** from the page and asks the server **nothing** about it. The popup shows what it already **remembers**; "Read again" is a click.

## 4 · What the owner confirms is REMEMBERED — the lifecycle (owner, 10-13)
**The rule:** *tick once and it is remembered; it is not asked again unless the user wants to change it. A change is recorded as a change, and the new value is NOT stored until the user acknowledges it again.*
```
            acknowledge                     edit
  (asked) ─────────────► ACKNOWLEDGED ───────────────► CHANGED (this application only)
     ▲                    reused by every               │  history row: from → to · when
     │                    fill and the Copy sheet        │  the old value is NO LONGER auto-used
     │                                                   │  the new value is NOT stored
     └───────────────────── asked again ◄────────────────┘
                                                         │ acknowledge the new value
                                                         ▼
                                                    ACKNOWLEDGED (new value)
```
- **Acknowledging a guess, or typing an answer and ticking *Remember*, stores a saved answer** (the D55 `saved_answers` table) keyed by the **normalised question label + widget kind + option wording**, with its **source** (`you typed` · `you acknowledged`), **the date acknowledged** and a **state** (`acknowledged` · `changed`). It is **used by every later fill and shown in the Copy sheet** — text, dropdown choices, radios and ticked boxes alike. **One tick; it is not asked again.**
- **This applies to EVERY category, eligibility and voluntary disclosures included** (work authorisation, sponsorship, visa, clearance, citizenship, gender, race, disability, veteran status, date of birth, salary expectation). It is the user's own stated answer, **never a guess** (D36: exact-or-blank for anything the user has not stated).
- **Editing a remembered answer:** the panel shows *"You changed this — acknowledge to remember it."* **A history row is written** (what, from → to, when, which job); **the new value is used for THIS application only; the old value stops being auto-used; the new value is not stored until re-acknowledged.** Declining leaves it unremembered, so the **next** application **asks again** — no stale value survives a change.
- **Safeguards (each a test):**
  1. ⛔ **Never tick or fill a terms, consent, privacy-notice, attestation ("I certify…") or signature control** — whatever was remembered. These are always the user's own click.
  2. **A material difference in the question or its options is a NEW question** and is asked (a different country, different option wording).
  3. **Nothing is invisible:** a remembered answer still appears in the review panel under *Filled*, marked *"you acknowledged this on 11 Oct"*, and eligibility rows keep *"you are attesting to this"* in the Copy sheet.
  4. **A quiet, non-blocking review reminder every 90 days** for eligibility and disclosure answers (*"You last reviewed your work-authorisation answers in July"*) — in Settings, and once in the panel. *(✅ Confirmed by the owner, 10-13.)*
  5. **Settings → Saved answers** lists each answer with its **state, date acknowledged and history**, with **Edit** and **Delete** (Delete means the next fill asks again).
  6. **Conflicts:** the newest acknowledged answer for a question wins; two labels that merely resemble each other stay separate.
- **A label's trailing "\*" and surrounding punctuation are ignored before matching**, so *"First Name\*"* is an **exact** match, not a guess.

## 5 · The review panel (the sketch's tab 1)
- **Header:** the mark, **Collapse** (to a slim bar that still says *"2 need you · 14 of 18 filled"*), **Close**, **Esc**. A progress line and bar: *14 of 18 filled · 2 need you · 3 to check.*
- **ALL fields listed in three groups** — **Needs you** (open) · **Check** (open) · **Filled** (collapsed) — each row: label · value · **source** (`profile` · `saved` · `you typed` · `matched loosely`) · edit · acknowledge. **Nothing is silent:** a field draft could not fill is listed under *Needs you* with a place to type it, and a value ready to copy.
- **"Ready" means ready:** *nothing needs you* **and** *at least one field was filled*. With 0 filled it says **"Nothing was filled — the page has no fields draft recognises yet."** **"I submitted it" is disabled until Ready.**
- **A typed or acknowledged row moves to Filled at once** and shows *"remembered for next time"* (or, for a sensitive answer, an unticked box).
- **It docks to a side, remembers which, and never covers the field being filled** (it can be dragged). **D60:** rectangular marks, no pills; both themes.

## 6 · The Copy sheet — a persistent in-page panel
Same family as the review panel (shadow DOM, extension-origin styles). **Stays open while the owner clicks into page fields.** **Close**, **Esc**, **Minimise**; each answer has **Copy → "Copied"**. It shows the **prepared + saved answers** with their source and which job, and the unanswered count. **The popup's "Copy sheet" button opens the panel and closes the popup.** Eligibility rows keep *"you are attesting to this"*. ⛔ It never reads or writes the page's fields and keeps no keystrokes.

## 7 · Field coverage — what "filled" means
- **Native** inputs, selects, checkboxes, radios, textareas.
- **Workday's custom widgets:** the combobox (a button that opens a listbox — open it, choose the option by its text, **verify the chosen value**), **date** pickers (type in the page's format), radio groups, checkbox groups, the typeahead (state, country, phone code).
- **Verification after every fill:** read the value back; if it did not take, the row goes to *Needs you* with the value ready to copy. **Never a silent miss.**
- **A widget that cannot be filled safely** is listed with the value to copy, never skipped.
- **Password and payment fields are never read, never filled, never listed.**

## 8 · Tests — each red when its line is removed
The Workday normaliser: the posting, `/apply`, `/apply/applyManually`, `/apply/useMyLastApplication`, a locale prefix, `?source=linkedin` → **the SAME key**; the owner's exact URL equals the plain posting's key; stages with no requisition id resolve through the **binding** · the binding is set by a capture, used by fill / prepare / Copy sheet, cleared on tab close and by a different posting, **never sent to the server** · a second capture of one job: no prompt, count 1 · **progress survives a reload** (a browser pass) and contains **no answer value** · an acknowledged answer is in the **next fill and the Copy sheet** · an answer is remembered after ONE acknowledgement (eligibility included) and not asked again · **an edit is recorded, the new value is NOT stored until re-acknowledged, and the old value is no longer auto-used** · **a terms / consent / attestation / signature control is never ticked** · a material change in a question is asked as new · "Ready" is **never** shown with 0 filled · the asterisk is stripped · Collapse / Close / Esc work · the Copy sheet **survives a page click and a field focus** · a fill that did not take is listed under *Needs you* · password fields are never read · **the manifest's permission list is unchanged (a test pins it)** · the release checks pass · **the SAME zip is rebuilt, no version bump.** **A browser pass** on the Workday-shaped fixture and the fake ATS, both themes.

---

# D97 · AUTO-READ — OPT-IN, PER SITE (revised 10-13 after the risk analysis)

**Read first: `docs/AUTO_READ_RISK_ANALYSIS.md`.** The owner asked for the extension to read the page, prepare answers, **and capture the job after reading — even if it does not fit the user, in case it fits someone else.** **The judgement:** read, prepare, capture **to the user's own account**, and fill are **GO**; **keeping postings for the shared board from the browser is NO-GO** (it contradicts the listing's *"discards an irrelevant posting without storing it"*, the declared single purpose, and Chrome Web Store's rule that browsing activity may be collected only for a user-facing feature). **The same goal is served by the server-side discovery loops, a later *Suggest this company* button, and a local read-quality indicator.**
**D23 stays the default** (every read begins with a click or a keystroke); **the owner chooses, site by site, to let draft read for them.**

## 1 · How it works
- **Options → "Read application pages automatically"** — a list of sites with a switch each. **Presets:** Workday (`*.myworkdayjobs.com`) first; Greenhouse, Lever, Ashby, Workable (the five D64 hosts); SmartRecruiters, iCIMS later. **Each switch asks Chrome for that site's permission at the moment it is pressed** (`chrome.permissions.request` on a user gesture; **optional host permissions — no new install warning**). **Off removes the content script and revokes the permission.**
- **FOUR separate switches, all default OFF, each explained in the plain words in `AUTO_READ_RISK_ANALYSIS.md` §7:**
  1. **Read automatically** — the page structure is read on arrival and on a step change (a **debounced** watcher for Workday's single-page navigation: ten rapid changes make one read).
  2. **Prepare automatically** — build the answer packet for the bound job once the page is read. *(No model call; no Draft slot.)*
  3. **Capture jobs automatically — to MY account** — D64's behaviour, extended to each site added. **A page that is not a posting sends NOTHING; an irrelevant posting is DISCARDED and not stored** — unchanged. **Undo** and the **Captured today** count stay.
  4. **Fill automatically when everything is prepared** — its own warning. **Fill never submits.** ⛔ **It never ticks a terms, consent, privacy-notice, attestation or signature control.**
- **A first-use disclosure INSIDE the extension** (not only the store listing — Chrome requires the prominent disclosure and consent in the UI), then a small unobtrusive badge on the page (*"14 of 18 ready — press Ctrl+Shift+Y"*) — never a modal, never a takeover.
- **READ QUALITY, locally:** the panel says *"14 of 18 fields recognised — good read"* or *"partial read — check these"*. If a site reads badly, the user presses the **existing *Report this form*** (labels only, two clicks).

## 2 · Rules
- ⛔ **Never runs on a site that is not switched on.** ⛔ **Never on `linkedin.com`, `indeed.com` or `glassdoor.com`.** ⛔ **Skips every password and payment input and any field whose value the person has typed; never sends a typed value.** ⛔ **Never submits and never clicks a submit control.** ⛔ **A kill switch in Options turns every automatic behaviour off at once.**
- It registers its content script with `chrome.scripting.registerContentScripts` (persisting across sessions) **only for hosts the owner has granted.**
- ⛔ **NOT in this build — and not to be added without a new decision:** storing a posting that does not fit the user; sending any page content or address to draft for other users' benefit; a shared-board contribution from the browser. *(Later, each its own row: **Suggest this company** — a two-click, user-initiated button that shows exactly what is sent: the company's public job-board address and the ATS family, nothing else; optional anonymous read-quality counts.)*
- **Privacy documents:** `PRIVACY_RECONCILIATION.md` and `STORE_LISTING.md` gain the optional-host list and the disclosure; *not published now — recorded for the next upload.* **They must still say** *"an irrelevant posting is discarded and not stored"*.

## 3 · Tests
Nothing runs on a site that is not enabled · enabling asks Chrome (a stubbed `permissions.request` on a click, **never on page load**) · disabling removes the script and the permission · password and payment fields are never read · a typed value never leaves the page · **a page that is not a posting sends nothing (not its address, not a hash)** · **an irrelevant posting is discarded and nothing is stored** · **nothing is ever sent for the shared board** · no read, capture or fill on LinkedIn / Indeed / Glassdoor · ten rapid step changes make one read · "Fill automatically" off means no fill without the keystroke · **no terms / consent / attestation / signature control is ever ticked** · no submit is ever clicked · the kill switch stops all four behaviours · the manifest adds **only** optional host permissions (the exact list pinned).

---

# D98 · A RÉSUMÉ GENERATED ON THE PAGE — "D: PANEL FIRST, EDITOR ON DEMAND"

**Owner:** *"prepare and trigger a résumé generation to the Resume Master API for this job right on the page, view it, and include it in the autofill payload."*

## 1 · The shape
**The extension never calls a model and never calls Resume Master directly.** It asks **draft's server** — the same generation the web app uses — which spends **a Draft slot**, runs the **claim guard** and the **ATS scorer**, stores the result as a **normal tailored résumé** linked to the job, and returns it. The user sees **no cost**, only the allowance (*"uses 1 of 10 Draft slots today"*). **D17 holds** (résumé generation is the one model call). **It is user-triggered, never automatic.**

## 2 · P0 — read-only inventory (report first)
The generation route(s) and `coreGenerateResume`; the slot accounting and the silent A+ swap; Resume Master's contract (`jobContext`, `job.keywords`, `options.cache`) and its **export tools** (PDF / HTML / DOCX); **whether a PDF can be rendered server-side and where it is stored**; the web app's **résumé editor** and the route that opens it for one résumé; the **apply snapshot** (what *What we sent* holds); and **whether a PDF can be set on Workday's upload control** (a real-Chrome experiment: a hidden `input[type=file]`, a custom drop zone).

## 3 · P1 — the server
`POST /api/extension/resume` (the extension's own token; the job from the **binding**) → returns a **generation id**; `GET` it for **status** (queued · generating · ready · refused · failed · cancelled) and the **result**: **sanitised HTML** (an allow-list of tags, no scripts, no external resources), the **change set** (D90), the **score before → after**, the **guard report**, and — once requested — a **PDF**. **Idempotent per (job, base-résumé hash)**; **cancellable**; **rate-limited**; errors sanitised to a small fixed set (*"Résumé generation is unavailable right now"*); **no money, token counts or model names in any response to the user.** The slot is spent when generation **starts**, refunded on a **cancel before work begins** or a **server failure**. *(The agent states the exact refund rule.)*

## 4 · P2 — the panel (the sketch's tab 3, option D)
A **Résumé** section in the same on-page panel family. **States:**
1. **Not generated** — *Generate a résumé for this job* (shows the job it will use and the slot cost).
2. **Generating** — a **persistent progress** line (10–20 s), **Cancel**, survives a Workday step change and a popup close.
3. **Ready** — a **preview** (rendered inside a shadow DOM from the sanitised HTML), **ATS before → after**, **"What we changed — 9 bullets, +16"** (the D90 summary, with a link), and **the guard's result in plain words**; buttons **Regenerate · Edit in a full page · Attach**.
4. **Refused** (the claim guard) — the reasons in plain words; **nothing is attached**.
5. **Attached** — *"Attached: FirstName_LastName_Company_Role.pdf"*, and the résumé row in the review panel's *Filled* group.

## 5 · Attach — and the fallback
- On **Attach** the server renders the **PDF**, **stores it as an artifact linked to the job and the apply snapshot** (so *What we sent* later shows **this exact file**). The extension then finds the page's **file input(s) that accept PDF**, sets the file (`DataTransfer`, then `input` and `change` events), and **verifies the page shows the file name.**
- **If the page's control cannot be set** (Workday's custom drop zone is the likely case): *"Download PDF"* + the file name copied + a one-line hint (*"drag it onto the upload box"*) — **never a silent miss.**
- **File name:** `FirstName_LastName_Company_Role.pdf`, sanitised (letters, digits, underscore).
- **It becomes part of the autofill payload:** the résumé is listed in the review panel and the Copy sheet as *Résumé — attached ✓*, and a later fill attaches the **same** file without regenerating.

## 6 · P3 — Edit on demand
**Edit in a full page** opens the **existing web editor** for this résumé in a new tab (the user is signed in there already). **On save the claim guard and the scorer re-run** and a **new version** is stored; the panel offers *"Use the edited version"*. The editor keeps the "what we changed" view.

## 7 · Not in this row
Automatic generation · generating without a bound job · any model call outside draft's server · cover letters (a later row) · an in-panel editor · money, tokens or model names shown to the user.

## 8 · Tests
Generation is **user-triggered only** · the extension makes **no call to Resume Master** (a test greps the extension's network targets) · the slot is spent once per (job, base-résumé hash) and refunded on cancel / server failure · **a guard refusal attaches nothing and stores nothing** · the preview HTML is **sanitised** (a script tag and an external image are dropped) · the PDF is stored and linked to the job and the snapshot · **Attach sets a file on a plain input and the page shows the name** · **on a custom drop zone it falls back to Download PDF and says so** · cancel stops the work · the panel survives a step change · **no cost, token or model text in any user response** · the extension permission list is unchanged · both themes, D60.

## 9 · The owner decides
The file-name pattern · whether **Attach** also saves a copy under the résumé's versions (recommendation: yes) · whether *Regenerate* spends another slot (recommendation: yes, with a plain warning).

---

## Order of work
**D96 first** (it fixes what the owner is hitting now and every later row builds on it) → **D97 P0 and D98 P0 in parallel** (read-only) → the owner reads both reports → **D97 build** → **D98 P1–P2** → **D98 P3**. **Do not push without the owner's go; the extension upload remains the owner's.**

# The extension run — D96 · D97 · D98 — as parallel jobs

**For the coordinator agent.** Read with `docs/EXTENSION_ONPAGE_SPEC.md` (what to build), `docs/AUTO_READ_RISK_ANALYSIS.md` (what is allowed) and the sketch `docs/sketches/extension-onpage.html` (the look). **Owner's decisions (10-13), all confirmed:** build **D** for the résumé · **four** auto switches, all default off · **no shared-board capture from the browser** · **one tick remembers an answer, eligibility included; a change is recorded and not stored until re-acknowledged; a 90-day quiet review reminder** · **no version bump — v1.5.2 stays the one local working version, one zip rebuilt at the end.**

---

## 0 · What is already done — the coordinator verifies, then takes only what is open
From the log at the time of writing: **D95** (admin accounts separated) is built through Phase 2 (migration **162**); **D92 and D93 are live**; **D94** P0–P2 are built locally; **extension v1.5.2** carries the first part of D96 (the tab binding, the Copy sheet in the page, "Captured today" counting by job; `workdayStages` tests). **Do NOT redo any of it.** Measure what exists (a short read of `NOW`, the three D rows, and the extension source) and mark each job card **done / partly done / open** before spawning anyone.

## 1 · Not in this run (gated on the owner — do not touch)
D95 Phase 3 (turning enforcement on) · D94 P3 (the Resend events, the owner's step) · D90 P4 (waits for the plugin's v1) · the Web Store upload · any push · the shared-board capture (**NO-GO**) · "Suggest this company" and read-quality telemetry (**later rows**).

---

## 2 · The lanes

```
 PHASE 1 (parallel, no shared files)            PHASE 2 (parallel, after J1 merges)         PHASE 3 (serial)
 ┌─ J1  job identity · binding · progress ─┐     ┌─ J4  panel · Copy sheet · saved answers ─┐   ┌─ J9  integration
 ├─ J2  fixtures + browser-pass harness ───┤     ├─ J5  auto-read / prepare / capture / fill ┤   ├─ J10 privacy + listing reconcile
 ├─ J3  D98 P0 + server P1 (no extension) ─┤ ──► ├─ J6  on-page résumé panel + Attach ───────┤ ─►│     release checks, ONE zip
 └─ J7  D97 P0 (read-only) ────────────────┘     └─ J8  server: saved-answer lifecycle ──────┘   └─ owner's browser walk
```
**Each lane works in its OWN git worktree and branch, and never pushes.** **Only the coordinator edits the shared files** — `extension/background.js` (the message router), `extension/manifest.json`, `extension/submission/STORE_LISTING.md`, `PRIVACY_RECONCILIATION.md`, `docs/WORKLOG.md` — and merges the branches. **Migrations are reserved up front** (high-water is **163** — `163_delete_former_admin_row`, D95, live; ⛔ CORRECTED by the owner 10-13: **J8 → 164**, **J3 → 165, 166, 167**) (generation records, PDF artifacts, extension résumé), anything else asks the coordinator. Both migration runners byte-identical.

**The wiring contract** (so lanes never collide in `background.js`): every lane adds its message handlers in **its own module** exporting `handlers = { MESSAGE_TYPE: async (msg, sender) => … }`; the coordinator adds one import line per module to the router.

---

## 3 · Job cards

### J1 · Job identity, tab binding, persisted progress — *foundation; merge first*
**Spec:** D96 §2–§3. **Owns:** `extension/jobKey.js` (the normaliser — Workday `tenant|site|R19749`, `rev` kept, locale / stage / `?source=` stripped, the owner's URL as the fixture), `extension/binding.js` (`chrome.storage.session`), `extension/progress.js` (`chrome.storage.local`, no answer values, 30 days, "In progress" list), the server answer "which board job is this key". **Publishes** a small API the other lanes import: `keyOf(url)`, `bind/unbind/boundJob(tabId)`, `progress.get/set/list`. **Does most of what v1.5.2 started — extend, don't redo.**
**Done when:** the normaliser gives ONE key for the posting, `/apply`, `/apply/applyManually`, `/apply/useMyLastApplication`, a locale prefix and `?source=linkedin`; the binding is set / used / cleared as spec'd and never sent to the server; progress survives a reload and holds no value; **the permission list is unchanged (pinned by a test).**

### J2 · Fixtures and the browser-pass harness — *unblocks everyone's tests*
**Owns:** `scripts/fakeAts.js` additions and `test-support/`. A **Workday-shaped fixture** (posting → `/apply` → `/apply/applyManually` → `/apply/useMyLastApplication` → a login page → create-account → My Information → My Experience → Application Questions → Voluntary Disclosures → Review) **with Workday's custom widgets** (a combobox button + listbox, a typeahead, a date picker, radio and checkbox groups, a hidden `input[type=file]` behind a custom drop zone); a **plain-HTML control form**; later-stage URLs added **only from what the owner pastes**. **A real-Chrome harness** (skips with its reason where no Chrome exists) that loads the unpacked extension, drives a fixture, and reads the panel. **Done when:** every lane can run its browser pass against the fixture with one command.

### J3 · D98 P0 and the server (P1) — *no extension code*
**Spec:** D98 §2–§3. **P0 first, reported:** the generation route and `coreGenerateResume`, slot accounting and the silent A+ swap, Resume Master's contract and **export tools**, whether a **PDF** can be rendered and stored, the web **editor** route, the **apply snapshot**; and **a real-Chrome experiment** on whether a PDF can be set on Workday's upload control (use J2's fixture). **Then P1:** `POST /api/extension/resume` → a generation id; status; result (sanitised HTML, the D90 change set, score before → after, the guard report); a PDF on request stored as an artifact linked to the job and the snapshot; **idempotent per (job, base-résumé hash)**, **cancellable**, rate-limited, **errors sanitised, no money / tokens / model names to the user**; the slot spent at start and refunded on a cancel before work or a server failure. **Migrations 165–167.** **Done when:** an extension-token request generates, polls, cancels, and returns a stored PDF; a guard refusal stores nothing.

### J4 · The panel, the Copy sheet, the answer lifecycle (client) — *after J1*
**Spec:** D96 §4–§7 and the sketch's tab 1. **Owns:** `extension/review-overlay.js` (the panel) and the in-page Copy sheet module. **Delivers:** Collapse / Close / Esc / dock side; **every field listed** (Needs you · Check · Filled) with its **source**; **"Ready" only when nothing needs you AND ≥ 1 field was filled**; the asterisk stripped before matching; **the answer lifecycle** — acknowledge once → remembered; an edit → *"You changed this — acknowledge to remember it"*, a history row, the old value no longer auto-used, the new value not stored until re-acknowledged; ⛔ **never tick or fill a terms / consent / privacy-notice / attestation / signature control**; **field coverage** incl. Workday's widgets with **read-back verification** and a miss listed under *Needs you*; password / payment fields never read. **Uses J8's API** (stub it until J8 merges). **Done when:** the owner's walk on the fixture shows 14-of-18 style progress, every unfilled field listed, a typed answer remembered on the next run.

### J5 · Auto-read, prepare, capture, fill — *after J1*
**Spec:** D97 (revised) and the risk analysis §4. **P0 is J7's report — build only after the coordinator has read it.** **Owns:** `extension/autoRead.js`, the Options page's switches and disclosure. **Four switches, all default OFF:** Read · Prepare · **Capture to my account** (D64, extended — *a page that is not a posting sends nothing; an irrelevant posting is discarded and not stored*) · Fill (**never submits**). Each site's switch asks Chrome for that site's **optional host permission on a click, never on load**; off revokes it; **a kill switch**; Workday first plus the five D64 hosts; **never on LinkedIn / Indeed / Glassdoor**; skips every password / payment field; a **debounced** step watcher (ten rapid changes = one read); a **local read-quality line** (*"14 of 18 recognised — good read"* / *"partial read"*). ⛔ **No shared-board capture, no page content or address sent for others.** **Done when:** nothing runs on a site that is not enabled, and the manifest adds **only** optional hosts (the exact list pinned).

### J6 · The on-page résumé (client) — *after J1 and J3's P1*
**Spec:** D98 §4–§6 and the sketch's tab 3 (option D). **Owns:** `extension/resumePanel.js`. States: Not generated → Generating (persistent progress, **Cancel**, survives a step change and a popup close) → Ready (a **shadow-DOM** preview of the sanitised HTML, ATS before → after, *What we changed*, Regenerate · **Edit in a full page** · Attach) → Refused (reasons; nothing attached) → Attached. **Attach** sets the PDF on the page's `input[type=file]` (`DataTransfer`, then `input` and `change`), **verifies the name shows**, **and falls back to *Download PDF* + the name copied + a hint on a custom drop zone — never a silent miss.** File name `FirstName_LastName_Company_Role.pdf`. **User-triggered only; the extension never calls a model or Resume Master.** **Done when:** generation, cancel, refusal, attach and the fallback all run on J2's fixtures.

### J7 · D97 P0 — *read-only, report first*
Read the extractor, `POPUP_CONTEXT`, `autoCapture.js` and D64's behaviour; report what a watcher needs for Workday's single-page navigation, how registered content scripts persist, what the Chrome permission prompt flow needs, and **re-read Chrome Web Store's User Data policy** (`developer.chrome.com/docs/webstore/user_data`) against the four switches. **No code.**

### J8 · Server: the saved-answer lifecycle — *independent*
**Spec:** D96 §4. **Migration 164** (additive; both runners): a `state` (`acknowledged` | `changed`), `acknowledged_at`, and an `answer_history` table (from → to · when · which job). Routes for acknowledge / change / list / delete under the existing saved-answers router; **Settings → Saved answers** shows state, date and history with Edit and Delete; **the 90-day review reminder** (non-blocking; Settings, and once in the panel) for eligibility and disclosure answers; **the key is the normalised label + widget kind + option wording** (a material change = a new question). **Done when:** one acknowledgement is reused by every later fill; an edit writes a history row and the next application asks again; a terms / consent / attestation / signature control is never returned as fillable.

### J9 · Integration — *the coordinator, serial*
Merge the lanes in this order: **J1 → J8 → J3 → J4 → J5 → J6**, running **the full suite after each merge** (it must stay green; the baseline is **4197**). Wire the handler modules into `background.js`. **A full browser pass** on the Workday fixture and the fake ATS, **both themes, desktop width**, end to end: capture on an apply page → bound → read → prepared → fill → panel → acknowledge → reopen the popup (it remembers) → generate a résumé → attach → Copy sheet.

### J10 · Privacy, listing, release — *the coordinator, serial, last*
Update `PRIVACY_RECONCILIATION.md` and `STORE_LISTING.md` (the optional-host list, the disclosure text, the storage field if it changed — **and the sentence "an irrelevant posting is discarded and not stored" must still be true and still be there**); run **`npm run build:extension -- --check`**; **rebuild the SAME zip, v1.5.2, no bump**; re-run the release checks. Write **one** session report into `WORKLOG.md` (not one per lane).

---

## 4 · Rules for every lane
1. **Own worktree, own branch, never push.** The coordinator never pushes either; **the push is the owner's.**
2. **Tests first, mutation-checked:** each new test is shown to fail with its rule removed. **`npm test` stays green.** **No capsule shapes (D60); both themes (D91).**
3. **Only the coordinator touches the shared files** (§2). A lane that needs a change there asks.
4. **Ask before you invent:** a later-stage Workday URL, a widget's behaviour, or anything the spec does not say goes to the coordinator, who asks the owner.
5. **Report in this shape** — *done · measured (what you ran) · not done · surprises* — as a section the coordinator pastes; **never invent a figure.**
6. **Stop and report, do not improvise,** if a change would add a permission, send page content to the server, or turn on a behaviour by default.

## 5 · What the owner does
Places the three docs and the sketch in the repo · pastes the prompt · **walks the finished build once on the real Zoom flow** (and sends the URL of each later step) · says **"push"** only after that.

# D98 · P0 — the inventory before the server (lane J3, 2026-10-13)

Read-only, measured from the source at `2914719` and one real-Chrome experiment. Spec: `docs/EXTENSION_ONPAGE_SPEC.md`
(D98), card J3 of `docs/EXTENSION_PARALLEL_PLAN.md`. **Verdict: P1 needs no new extension permission, sends no page
content to the server, makes no model call outside draft's server, and turns nothing on by default — P1 proceeds.**

## 1 · The generation route and `coreGenerateResume`

- **`POST /api/generate`** (`server.js`, "GENERATE" block). Cookie-session or token (`requireAuth`). The body carries
  `jobId`, `job` (the CLIENT's copy of the job), `resumeText`, `forceRegen`, `tool`. Order: the A+ swap → the tool
  entitlement (`requireToolEntitlement`, only while monetisation is on) → a base-résumé sanity check (≥ 100 chars, no
  placeholder text) → a CACHED artifact for (user, job, tool) is served free and re-scored locally → for a NEW one:
  tools service configured (else 503) → plan limit `checkLimit(db, user, "resume_generate")` (429) → Draft slots
  `draftSlots().remaining > 0` (429 `slotsExhausted`) → in-flight lock `user:job:tool` (409) →
  `coreGenerateResume({ … cache: false })` → **the slot is debited on SUCCESS** (`recordGenerationSlot`) → the job is
  tagged Pending (`markPending`, "generated") → a manual packet is prepared (`applyLine.prepareManualPacket`, D56).
  Every answer passes `userSafeGeneration` (no tool, retry, usage, cost, tokens, model, cache).
- **`coreGenerateResume({ userId, jobId, job, tool, resumeText, employers, cache })`** — the one kernel, shared with
  the apply worker's `generateResumeForApply` (which passes the `scraped_jobs` row as the job, no employers, and does
  its own `checkLimit`). It reads the profile, the active job profile and its stored base résumé (which WINS over the
  caller's `resumeText`), the profile's claims, `include_summary`; scores the BASE locally first (AK1, the "before");
  calls `toolsService.generate` ONCE (no automatic retry, D70); meters usage (`recordToolsServiceUsage`); scores the
  result locally (the "after"); stores it through D57's one store `storeGeneratedResume` (version + current résumé +
  `user_jobs.resume_generated`, one transaction; on a store failure the plan count is refunded and a
  `ResumeStoreError` thrown); emits `resume_generated` and a notification. Returns `{ html, atsScore, atsReport,
  baseAtsScore, version, resumeId, generatedAt, retry }`.
- **The claim guard runs in the tools service** (AF2): a violation is a 422 with the violations and NO document,
  thrown as `ToolsServiceError` code `resume_claim_violation`; nothing reaches the store. Draft adds a second,
  additive check on what it serves (`validateResumeClaims` + `profileContradictionFindings`, the route's `kbFindings`).
- ⚠ **No cancellation hook exists.** `toolsService.generate` owns its own `AbortController` (150 s timeout) and takes
  no signal; `coreGenerateResume` has no "cancelled?" check. A cancel therefore cannot stop a model call already sent —
  it can only stop the STORE. P1 adds an optional `isCancelled` callback to `coreGenerateResume`, checked before the
  model call and again before the store (a targeted edit; the web route and the worker pass none and are unchanged).

## 2 · Slot accounting and the silent A+ swap

- **One allowance** (`services/draftSlots.js`, A63): a Draft and a generated résumé each use one of the day's slots
  (`draft_slots` entitlement via the D88 resolver; system default `DAILY_DRAFT_SLOTS` → `DECK_SIZE` = 10), a trailing
  24-hour window. A generation is a `draft_slot_uses` row (`kind = 'generate'`); "remaining" counts rows, so
  **deleting the row is an exact refund**. Today the web route writes it only after success — a guard refusal, a
  tools-service failure and a store failure therefore cost no slot on the web.
- **Separately**, the plan's generation count (`checkLimit` over `usage_events.success = 1`) — `refundGeneration`
  marks the usage row unsuccessful on a store failure.
- **The silent A+ swap:** when the resolver's `a_plus_default` is true for the user, a `generate` becomes
  `a_plus_resume` with no word to the user; `userSafeGeneration` drops `tool`/`toolLabel`, and `userSafeResumeRow`
  keeps a reload from showing "A+". The extension route must apply the same swap and the same silence.

## 3 · Resume Master's contract and its export tools

- Vendored contract **1.5.0** (`contract/resume-master/`; RM `4e89300`). `GenerateRequest = { mode, roleFamily,
  domain, candidate, profile, claims, employers, job: { title, company, category, description, stack, keywords? },
  baseResumeText, options: { includeSummary, cache, jobContext?: "description" | "keywords" } }`.
  draft sends `options.cache: false` from the interactive caller only (`RESUME_MASTER_ACCEPTS_CACHE_OPTION = true`);
  **draft does not send `jobContext` or `job.keywords` today** (RM has them behind its own flag, D70 Phase 1).
- **Export tools: none for a résumé.** RM's token API is `/v1/version`, `/v1/resumes/generate`, `/enhance`,
  `/format`, `/parse-pdf`, `/v1/ats/score`. No PDF, HTML-to-PDF or DOCX export. (RM's public site has a PDF *text*
  tool — the opposite direction.) The web app exports by **client-side print** (`printResume`); `POST /api/export-pdf`
  and `GET /api/resumes/:jobId/pdf` answer 503 `useClientSide: true`.

## 4 · Can a PDF be rendered server-side today, and where would it be stored?

- **Rendered: yes.** `htmlToPdf(html)` in `server.js` (puppeteer-core through `services/browserLauncher.js`:
  `@sparticuz/chromium` on Railway, a system Chrome locally; Letter, background printed, ~70 MB per call). It is used
  today only by the apply pipeline, which prints into `os.tmpdir()` (`tmpPdfPath`) and deletes the file.
- **Stored: nowhere.** D16 (`services/applicationArtifacts.js`) decided on measurement to keep **HTML, brotli-11**
  (~1.7 KB a résumé) and print a PDF on demand — a stored PDF is ~94 KB and compresses 1.2×, ~56× the HTML.
  ⚠ **D98 asks for the PDF itself to be stored** ("so *What we sent* shows this exact file"). That reverses D16's
  rule for this one path. P1 stores it as a BLOB in the database (no new volume path), capped at D16's 2 MB, refused
  when the volume is low (`volumeRoomFor`), and deleted with the job's résumé unless it is linked to an application
  record (then it lives exactly as long as that record). The owner should know the size cost: one PDF ≈ 55 HTML
  snapshots.
- ⛔ The PDF is printed from the **sanitised** HTML (§P1), so the server's Chromium never fetches an external resource
  a generated document might name.

## 5 · The web résumé editor and the route that opens it

- The editor is **`client/src/panels/SandboxPanel.jsx`**, mounted only inside `JobsPanel.jsx` (`openSandbox`), opened
  after a Generate or from a job's résumé. **No URL opens it for one résumé:** the board deep link is
  `/app/jobs?job=<jobId>` (`JOB_URL_PARAM = "job"`, `client/src/lib/jobUrl.js`), which selects the job; the sandbox is
  not reachable from an address. P3 ("Edit in a full page") needs a param such as `&edit=resume` — client work, not
  this lane's.
- ⚠ **The editor's save does NOT re-run the claim guard or the scorer.** `POST /api/resumes/:jobId/html` overwrites
  `resumes.html` (and a matching `resume_versions` row) and nulls the ATS cache key; the next read re-scores. D98 §6
  requires the guard and scorer on save and a NEW version — P3 must add that; nothing in P1 depends on it.

## 6 · The apply snapshot ("What we sent")

- `application_artifacts` (migration 125, D16): when an application is RECORDED (`recordSubmission` →
  `snapshotResumeForRecord`) the CURRENT `resumes.html` for (user, job) is copied once, brotli, with its sha256, as
  `source = snapshot_at_record`. *What we sent* (`/api/applications/:id/resume`, D90's `sent:<record id>`) serves it,
  and D90 matches it back to a version by byte-identical HTML.
- The snapshot is taken at RECORD time, which is AFTER an attach. So P1 links the PDF in two places: at attach, when a
  record already exists; and inside `snapshotResumeForRecord`, which links the newest attached PDF for (user, job) to
  the record and its snapshot row. Attach also makes the attached version the current résumé (so the HTML snapshot and
  the PDF are the same document).

## 7 · How the extension authenticates, and how `boundJobId` reaches `routes/apply.js`

- **Its own token**, never the cookie: an `auth_contexts` row whose `user_agent` is `EXTENSION_USER_AGENT`
  (`"resume-master-extension"`, `shared/brand.js`), sent as `X-RM-Auth-Context` (or `Authorization: Bearer`).
  `bindAuthContext` hydrates `req.user` and sets `req.authContextUserAgent`; `shared/authPolicy.js`
  `isExtensionCredential(req)` is the one predicate. The extension route requires it — a browser tab's cookie or token
  is refused.
- **`boundJobId`**: `extension/gated-handoff.js` sends `boundJobId: bound?.jobId ?? null` in the body of
  `/api/apply/handoff/match`, `/prepare`, `/copy-sheet`, `/handoff/submitted`. `routes/apply.js` `boundJob(userId, hint)`
  honours it ONLY when `userHasJob(db, userId, id)` (`services/manualHandoff.js`: a résumé, a star or applied flag, a
  record, a Draft, a packet, an application or a capture). P1 uses the same rule: another user's job, or a job that is
  not the user's own, is refused as "not on your board".

## 8 · The exact slot rule P1 implements

1. **Spent when generation starts**: the `draft_slot_uses` row is written in the same transaction as the generation
   row (status `queued`) — so a second click cannot spend twice, and the allowance shown is already the new one.
2. **Once per (job, base-résumé hash)**: a second request for the same job and the same base (sha256 of the base text,
   `hashBase`) returns the existing generation — queued, generating or ready — and spends nothing. A résumé the web app
   already made for this job from the same base is reused the same way (the web's own rule: a cached one costs nothing).
3. **Refunded** (the row deleted, `refund_reason` recorded) on: a **cancel while queued**; a cancel that lands before
   the model call is sent; a **server failure** (the tools service unreachable / erroring, the store failing, any
   unexpected error); and — ⚠ provisional, owner decides — a **claim-guard refusal**, because the web app charges
   nothing for a refused résumé and D98 says this is "the same generation the web app uses".
4. **Kept** on a cancel after the model call was sent (the work was done; nothing is stored or attached).
5. **Regenerate** spends another slot (provisional, owner decides: D98 §9's recommendation) and the response carries
   a plain warning.

## 9 · Real-Chrome experiment — a PDF on the Workday-shaped drop zone

⛔ **This measures the FIXTURE (`scripts/fakeAts.js` `/workday-replica`), not live Workday.** The fixture's own header
says its markup "is not re-measured against a live tenant".

Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe` (system), headless, puppeteer-core. The page was
served unchanged except its start step (`step: 0` → `step: 1`, *My Experience*, by request interception) so the drop
zones render without filling *My Information* first. Two zones (`file-upload-drop-zone`: Cover Letter, then
Resume/CV — the fixture's "(e) trap" order).

| | What was done | Result |
|---|---|---|
| A | Résumé zone: `input[type=file][data-automation-id="file-upload-input-ref"]` (opacity 0, absolutely over the zone, `accept=".pdf,.doc,.docx"`) — `new DataTransfer()`, `items.add(File(pdf))`, `input.files = dt.files`, then `input` and `change` (bubbling) | ✅ `files.length = 1`; the status flips to `file-upload-successful` and reads *"Ada_Example_Zoom_Software_Engineer.pdf · 0.01 KB · Successfully Uploaded!"* — **the name shows** |
| B | Cover-letter zone with the input set to `display: none` first | ✅ set, and the name shows — visibility does not matter to the fixture |
| C | A synthetic `dragover` + `drop` (`DragEvent` with the DataTransfer) on the zone, no input touched | ✅ the name shows (the fixture listens for `drop`) |
| D | After A, *Save and Continue* | ✅ no "Resume/CV is required" error — the page's own required check accepts the set file |

**Read with care:** the experiment ran in the page's main world (`page.evaluate`), not from an extension's isolated
content-script world; `input.files` and dispatched events are shared DOM state, so the same calls are expected to work
there, but that was not measured here. Live Workday may validate the upload with its own XHR (an upload endpoint) on
`change`; the fixture does not, so **J6's fallback (Download PDF + the name copied + the hint) stays mandatory**, and
the "verify the name shows" step is what tells the two cases apart.

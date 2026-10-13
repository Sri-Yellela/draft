# Privacy reconciliation — manifest × code × policy × dashboard

The 2026-08-01 Web Store rules are enforced by cross-checking three documents against each other:
the **manifest**, the **privacy policy** at `https://jobsviadraft.com/privacy`, and the **Privacy
practices** tab in the developer dashboard. A contradiction between any two of the three is the
rejection. So the check cannot be "does the policy sound right" — it has to be a join, and every
row has to be complete in every column.

Three failure directions, all rejections:

| Orphan | Means | Verdict |
|---|---|---|
| A permission with no code | over-declaration | remove the permission |
| Code with no policy paragraph | undisclosed practice | disclose it, or delete the code |
| A policy claim with no code | false disclosure | narrow the claim |

Enforced by `test/privacyReconciliation.test.js`, which fails if a row names a permission the
manifest does not declare, or if the manifest declares one this file does not cover.

Policy paragraph references are to section headings on
`https://jobsviadraft.com/privacy` (source: `client/src/pages/marketing/PrivacyPage.jsx`).

**Code is cited by SYMBOL, not by line number.** This table originally carried `file:line`, and the
line numbers were wrong twice within a day — once when capture moved to the service worker and again
when it moved to injection. A citation that rots silently is worse than a vague one, because it
still looks precise. Symbols survive edits, they are what a reviewer actually wants to grep for, and
`test/privacyReconciliation.test.js` now fails if a cited symbol is not in the file it is cited
from — so this table cannot drift the way the line numbers did.

---

## ⭐ D68 · THE COPY SHEET, CHECKED (owner, 10-07: "it's the user's own payload so shouldn't be an issue — check compliance wise")

| Check | Finding | Where |
|---|---|---|
| Shown only to the signed-in user, their own answers | ✅ `/api/apply/copy-sheet` is `requireAuth`; the packet is read `WHERE id=? AND user_id=?` and the fallback is the caller's own `user_profile` | `routes/apply.js` |
| Showing it writes nothing into the page and sends nothing anywhere else | ✅ the extension's copy-sheet request is one call to our server; the popup builds the list with `textContent` (never parsed), injects nothing, and stores nothing — no storage key | `extension/gated-handoff.js`, `extension/popup.js` |
| Work-authorisation and EEO answers covered by the policy | ⚠ → ✅ **fixed**: the policy did not name the Copy sheet. It now says it shows the user's own answers, including work-authorisation and voluntary self-identification answers they saved, in the popup, to them | *Filling an Application* |
| Clipboard writes only on the user's click, not logged | ✅ `navigator.clipboard.writeText` only in the per-row copy button's click handler; the server logs `copy_sheet_opened` with COUNTS only (`answerCount`), never a value | `extension/popup.js`, `routes/apply.js` |
| Web Store *Limited Use* wording | ⚠ → ✅ **fixed**: the affirmation was absent from the policy and the listing notes. The policy now carries it in the User Data Policy's own terms (*How We Use Your Data*); the dashboard's Privacy practices certification must match it at the release (F 4) | `PrivacyPage.jsx` |

No new collection: the Copy sheet adds no permission, host, storage key or stored field.

## ⭐ D86 · BRING-YOUR-OWN-MODEL RÉSUMÉS — the user's own ChatGPT or Claude (10-08; a web-app flow, not the extension)

| Check | Finding | Where |
|---|---|---|
| What the host receives | Only through `get_generation_brief`: the base résumé's sections as bullets with ids — **no header**, and every string scrubbed of email / phone / URL shapes — the claimed skills and verbs, and the job's title, company, level, location and the base résumé's MATCHED keywords. Not the posting's full text | `services/byom/resumePatch.js` `buildBrief`, `scrubContact`; test `d86Byom` |
| Policy paragraph | ✅ *Your own ChatGPT or Claude* names exactly those items, *under your own account and its terms*, the never list, no model call by draft, and Disconnect. ⚠ The row's draft sentence said *the job description*; narrowed to what the code sends (*A policy claim with no code → narrow the claim*) | `PrivacyPage.jsx` |
| Consent screen | ✅ The same sentence, the *It never sees* list (contact details, passwords, applications, other jobs) and the scopes, on draft's own page and session; no script; not frameable | `services/byom/consentPage.js` |
| Off by default, twice | ✅ The operator's switch (`byom_enabled`) and the user's (`users.byom_enabled`) both start OFF; every tool call re-checks both and the host allow-list | `services/byom/policy.js` |
| Credentials | ✅ Codes and tokens stored as SHA-256 hashes; tokens bound to `/mcp`; Disconnect revokes the connection and every token at once; a replayed code or refresh token revokes the connection | `services/byom/oauthServer.js` |
| Logs | ✅ `mcp_audit` holds tool, outcome and refusal CODES — never résumé text; Settings and Admin read only that | `routes/byom.js` |
| Retention (D86 compliance, 10-09) | ✅ A brief's copy of the base résumé (`byom_briefs.base_json`) and its refusal text are emptied a day after the brief is used, closed or expired; `mcp_audit` rows are deleted after 12 months; the policy paragraph states both and that connector content never trains a model | `services/byom/policy.js` `purgeByomData` (every 6 h, `server.js`); test `d86ConnectorCompliance` |
| v1 read-only tools (D86, 10-09) | ✅ `draft_search_jobs` (the user's board through the board's own query: ids, titles, companies, places, levels, pay, the user's stored ATS score — no prose), `draft_get_job` (one public posting's structured fields and a ≤ 600-character summary; the posting's text only on request, capped and neutralised) and `draft_score_resume_for_job` (the base résumé's score and matched / missing terms). The policy paragraph names all three | `services/byom/tools.js`, `services/byom/untrusted.js`; test `d86ConnectorCompliance` |
| Instructions (D86 compliance, 10-09) | ✅ The connector sends data only — no `instructions` in the brief or at initialize (Anthropic Directory Policy §2F); the guidance is the static Skill in the separate public plugin repository | `routes/byom.js` `SERVER_INFO`; test `d86ConnectorCompliance` |
| ⏸ Notice to users | Is this a material change that needs notice before the operator's switch goes on? The owner's call (WORKLOG O87), as O85 was for automatic capture | — |

## ⭐ D90 · EVERY UPLOADED RÉSUMÉ IS KEPT (10-10; the web app, not the extension)

| Check | Finding | Where |
|---|---|---|
| What is kept | each DISTINCT base résumé the user saves (deduplicated by hash), and on each tailored version the id of the upload it was made from | `services/baseResumeHistory.js`; migration 157 `base_resume_uploads`, `resume_versions.base_upload_id` |
| Policy | ✅ Data Storage and Security: "We keep each résumé you upload — not only the newest … deleted with your account" | `PrivacyPage.jsx` |
| Deletion / merge | ✅ cascades from `users`; moves with the person on a merge | migration 157; `services/accountService.js` MERGE map |
| Who sees it | the user only — the comparison endpoints are authenticated and own-data (a 404 otherwise); no eligibility or EEO field is in any response | `routes/resumeChanges.js`; test `d90ResumeChanges` |

## ⭐ D88 · SUPPORT REQUESTS AND ACCOUNT ADMINISTRATION (10-09, 39d; the web app, not the extension)

| What | Where in code | Kept | Policy |
|---|---|---|---|
| A support request: category, subject, the messages; the page and the app version | `services/tickets.js` `openTicket` (the context is three named fields — `test/d88Tickets.test.js`) | deleted with the account (ON DELETE CASCADE, migration 156) or 24 months after solved (`purgeSolvedTickets`) | Data Storage and Security, "If you contact support…" |
| An admin's internal note on a request | `ticket_messages.internal = 1` — never in the user's reads | as the request | — (not about the user's data beyond the request) |
| An admin's change to an account, with its reason | `admin_audit_log.reason` (migration 155), `services/userAdmin.js` `writeAudit` | the audit log (never edited) | "we keep a record of the change and why" |
| Per-user overrides and admin notes | `user_entitlement_overrides`, `user_notes` | deleted with the account (`deleteAccount`) | as above |

Not collected: no form answer, eligibility answer or résumé is attached to a request; no attachments in v1.

## Permissions

| Manifest permission | Code that requires it | Policy paragraph | Dashboard justification |
|---|---|---|---|
| `activeTab` | `background.js` `captureActiveTab()`, `previewActiveTab()` and `handleGatedHandoff()`, each reached only from `chrome.commands.onCommand` or a popup message; `popup.js` `getCurrentTab()`. The grant IS the invocation. | *Browser Extension* — "reads nothing until you invoke it… only that one tab". *Filling an Application* — "It holds no standing permission for any employer or job-portal site". | Granted only on explicit invocation; used to read the job posting in view and to fill an application form the user opened. No host permission exists for any site the extension reads a job from, so this per-tab grant is the only access there is. |
| `contextMenus` | `background.js` `saveLinkToDraft()` and the `chrome.contextMenus.onClicked` listener, which sends **Save this page to draft** to the same `captureActiveTab()` as the button and the shortcut; the two items are `formReport.js` `CONTEXT_MENUS`, created once in `onInstalled`. (D55 decision B, 10-07.) | *Job Listings* — "the toolbar button, the keyboard shortcut and the right-click **Save this page to draft** are three ways of triggering it". *Browser Extension* — "**Save link to draft** … sends only that link's address … no page is opened or read … we refuse any other link and save nothing". | Adds two right-click items: *Save this page to draft* (the same capture as the toolbar button, on the page the user right-clicked) and *Save link to draft* (sends only the link's address to our server, which reads the posting from that job board's own listing or refuses the link). Reads nothing until the user picks an item; grants no access of its own. |
| `scripting` | `background.js` `captureActiveTab()` and `reportCapture()`, which inject the two functions in `extractor.js` — `extractJobPayload()` and `showCaptureToast()`; the `REPORT_FORM` handler injects `formReport.js` `collectFormLabels()`; `gated-handoff.js` `probeFormShape()`, `applyPlan()`, `applyOverlayEdit()`; `review-overlay.js` `renderOverlay()`; `popup.js` ATS Score Tool. | *Browser Extension* — "If you click **ATS Score Tool** … it copies the visible text of that page". *Filling an Application* — "enters them into that employer's form". | Injects a one-off script into the invoked tab to read the posting, collect text for an ATS score, fill the form and render the review panel. Nothing is injected into any other tab, and nothing is registered to run persistently. |
| `optional_host_permissions` (D64, 10-07) | `background.js` `maybeAutoCapture()`, reached from `chrome.tabs.onUpdated` ONLY while `autoCaptureEnabled` is on AND `chrome.permissions.contains` holds the origin; requested by `options-auto.js` at the user's click (`chrome.permissions.request`), removed when switched off. Five public posting hosts: `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`, `apply.workable.com` — ⛔ no gated portal, no LinkedIn / Indeed, never `<all_urls>`. | *Capturing Job Pages Automatically (optional, off by default)* — what is read (a posting only, checked in the browser), what is sent (the posting's text and address), what is kept (only a posting that fits the user's board; nothing otherwise), that nothing is filled or submitted, and the off switch. | ⏸ **Written fresh at the release (lane F 4, O82 e)** — the single-purpose text changes: the extension now reads postings on these five hosts without a click when the user opts in. |
| `storage` | **Nine keys, two areas.** ⭐ D96 §3 / J1 (10-13): `progress.js` `progress.patch()` / `set()` / `claim()` → `jobProgress` (`storage.local`) — where each application stands, one record per job (draft job id, page key, title, company, posting address, the times of captured · read · prepared · reviewed · submitted, filled n of m · needs-you · to-check counts, the prepared packet's id); ⛔ no answer value (a whitelist, `sanitiseRecord()`); 30 days from its last change; removed by `progress.clearAll()` on Disconnect (`auth.js` `disconnect()`), on sign-out and when another account connects (`auth.js` `getIdentity()`); never sent. ⭐ v1.5.2 (10-13): `tabBinding.js` `bindTab()` / `setBindingDock()` → `bind:{tabId}` (`storage.session`) — which job a tab is on (job id, title, company, when linked, the Copy sheet's dock side), set by a capture or a recognised posting, removed by `clearBinding()` when the tab closes, a different job is recognised, or the user unlinks it; sent to the server only as a hint the server honours for the user's own job. ⭐ D64 (10-07): `autoCapture.js` `setAutoCaptureSetting()` → `autoCaptureEnabled` (`storage.local`), the automatic-capture switch — one on/off value, written by Options' switch and by `background.js` when Chrome's optional access is removed. `background.js` `reportCapture()` → `lastCapture` (`storage.local`); `background.js` `reportHandoff()` → `lastGatedHandoff` (`storage.session`); `gated-handoff.js` `savePacketForTab()`, `loadPacketForTab()`, `clearPacketForTab()`, `sweepExpiredPackets()` → `gate:{tabId}` (`storage.session`); `gated-handoff.js` `saveBatchForTab()`, `loadBatchForTab()`, `clearBatchForTab()` → `batch:{tabId}` (`storage.session`); `auth.js` `storeToken()` → `authToken` and `getIdentity()` → `authIdentity`, both (`storage.local`), both removed by `clearStoredToken()`. `options.js` uses `storage.sync` only to DELETE a value the retired shortcut recorder left behind. | *What the Extension Stores in Your Browser* — **all nine items** (D64 adds *whether automatic capture is switched on*; v1.5.2 adds *which job a tab is on*; D96 adds *where each application stands*), each with the area it lives in and its real lifetime. ⚠ Only `gate:` gets the ten-minute expiry; the policy says so rather than implying it covers everything. ⚠ `authToken` is the ONE stored value that is transmitted, and the policy names it as such. | Nine values. In `chrome.storage.local`: where each application stands — per job, its id, title, company and posting address, when each step happened and the filled / needs-you counts, no answers, 30 days, deleted on disconnect, sign-out or another account; whether automatic capture is switched on; the result of the most recent capture, so the popup can show the outcome of a hotkey capture it was not open for; the account the extension is connected to, so the popup can name it; and the extension's own access token, which is sent with each request to our backend and to nowhere else. In `chrome.storage.session` (memory-backed, discarded on browser restart): the prepared answers for an application in progress, with a 10-minute expiry and cleared when the tab closes; the result of the most recent form fill; when several applications are queued for one employer site, that site's origin and how many remain; and which job a tab is on — the job's id, title and company, when it was linked and the Copy sheet's dock side — cleared when the tab closes, shows a different job, or is unlinked. |

⚠ **The storage row was wrong until 2026-09-15, and this is how.** The policy said the extension
keeps "two things" and enumerated `lastCapture` and the packet. It writes four.
`background.js` `reportHandoff()` was cited in this table's code column while the policy paragraph
it pointed at described only the other two, and `gated-handoff.js` `saveBatchForTab()` was cited
nowhere at all — so the join looked complete in both directions while an undisclosed key sat on each
side of it. `gated-handoff.js` `sweepExpiredPackets()` filters on `k.startsWith('gate:')`, which
means `lastGatedHandoff` and `batch:{tabId}` never got the expiry the policy promised; they live
until the browser restarts, or until `chrome.tabs.onRemoved` fires for `batch:`. The fix was to the
**policy**, not the code: two undisclosed session keys are honest behaviour with dishonest
documentation, and deleting a key to make a sentence true would have been the wrong direction.
**Follow-up, deliberately not done here:** the sweep arguably should cover every session key rather
than just `gate:`, since the policy promised an expiry two of four did not get. That is a behaviour
change and belongs in its own commit.

**Declared nowhere, deliberately:** `tabs`, `cookies`, `notifications`, `history`, `webNavigation`,
`<all_urls>`. Each is asserted absent by `test/manifestMinimumPermission.test.js`; the reasoning is
in `extension/MANIFEST_RATIONALE.md`. The policy's matching negative claims are "does **not** read,
store, or transmit your session cookies, login credentials, or any authentication tokens" and "does
**not** collect your browsing history".

## Host permissions

**One, and it is our own server.** No job board, no employer portal, nothing the extension reads a
job from. Capture injects under the `activeTab` grant the user's invocation creates, so the
extension needs no standing access to any site in order to capture from it — and holds none.

| Manifest host | Code that requires it | Policy paragraph | Dashboard justification |
|---|---|---|---|
| `https://jobsviadraft.com/*` | `auth.js` `authedFetch()` is the single network path, and `bootstrapToken()` is the single credentialed one. Through it: `background.js` `importCapturedJob()` posts `/api/import/job`, the `PROBE_AUTH` handler calls `/api/auth/me`, `recordGateReview()` posts `/api/apply/gate-review`, `advanceBatch()` calls `/api/apply/gate-packets`; `gated-handoff.js` `api()` and its resume fetch. Every one of them is `credentials:'omit'` and carries the extension's own bearer token; no secret is embedded in the package. | *Browser Extension* — "Data extracted by the extension is sent to … and associated with the account you connected the extension to … it sends the token and not the browser cookie". | Our own backend. The extension identifies itself with a token it obtained for itself, not with the browser's session cookie, so it acts only as the account the user connected it to. |

**No content script is declared**, so there is no origin the extension runs on automatically. The
policy's central claim — "reads nothing until you invoke it" — is true because of that absence, and
`test/privacyReconciliation.test.js` fails if any non-`jobsviadraft.com` host is declared again,
because the claim would stop being true the moment one is.

## Data flows with no permission of their own

Not every disclosure hangs off a permission. These are the flows a reviewer will see in the code,
and each still needs a policy paragraph.

| Flow | Code | Policy paragraph | Retained server-side? | Crosses to the tools service? |
|---|---|---|---|---|
| Captured job posting → the user's account | `background.js` `captureActiveTab()` then `importCapturedJob()`, which posts `/api/import/job`; the page is read by `extractor.js` `extractJobPayload()` | *Job Listings*, *Browser Extension* | Yes — title, company, location, description, URL, in `scraped_jobs`, linked to the account; and (A62, 10-02) one `job_captures` row — the URL, the ATS and board slug it names, and whether it was new or matched a posting already on the board — linked to the account until the account is deleted, then kept without it | No — capture never reaches it |
| A right-clicked **link** → the user's account (D55 decision B) | `background.js` `saveLinkToDraft()` posts `/api/import/link` with the link's address only (`formReport.js` `saveableLink()`: http(s) or nothing); the server checks `services/jobs/importJob.js` `linkRefetchability()` and refuses any link it cannot refetch from the ATS's own listing, before any fetch; then the same `importJob()` as a capture, with `refetchOnly` | *Browser Extension* — the right-click bullet: "sends only that link's address … no page is opened or read … we refuse any other link and save nothing" | Yes — exactly as a capture: the posting from the ATS's listing in `scraped_jobs`, starred for the user, and one `job_captures` row (origin `import_url`). A refused link stores nothing | No |
| ATS Score page text → `/ats-score?jd=…` | `popup.js` ATS button collects via `chrome.scripting` → `background.js` `OPEN_ATS_SCORE` opens the tab | *Browser Extension*, ATS bullet — states plainly that the text travels in the URL and may appear in server logs | Only as ordinary request logs; not stored as a record | No — draft scores locally with `@draft/ats-scorer`; there is no network hop to score |
| The capture confirmation shown in the page | `extractor.js` `showCaptureToast()`, injected by `background.js` `reportCapture()` after a capture the user asked for | *Browser Extension*, ATS bullet — "no longer changes the appearance of any page except to show you a confirmation message after a capture you asked for" | Not a data flow; disclosed because it is the only thing the extension puts on a page | No |
| Job description → Anthropic | ⚠ **no longer by ATS scoring, enrichment or capture** (D17, A80, 10-05): ATS scoring is `@draft/ats-scorer`, enrichment is export → import, capture reads deterministically (D33). A job description reaches Anthropic now only inside generation (next row) and in draft's two cover-letter calls (`server.js`, `callModel`) | *Browser Extension*, fifth bullet, cross-referencing *Third-Party Services* — ✅ **corrected 10-05 (O72b):** the bullet now says scoring sends nothing, and *Anthropic* names cover letters (direct) and the wizard's chip suggestions; `test/privacyO72Corrections.test.js` pins it | Per Anthropic's API terms; not used for training | Only generation goes through the tools service (next row); cover letters go to Anthropic from draft directly |
| Profile answers → employer's form | `gated-handoff.js` fill | *Filling an Application* | Not retained by us; released into the page the user opened | No |
| The application page's **full URL** → our server, on a fill, *Prepare*, the Copy sheet and *I submitted* (D56) | `gated-handoff.js` `runGatedHandoff()` (posts `/api/apply/handoff/match` and the token mint `/api/apply/gate-packets/:id/token` with `url: tab.url`), `prepareAndFill()` (`/api/apply/prepare`), `copySheetFor()` (`/api/apply/copy-sheet`) and `recordSubmitted()` (`/api/apply/handoff/submitted`), each through `pageUrlOf()` — the whole `href`, path and query included, in the request BODY (not a query string) | *Filling an Application* — "sends that page's **full address** (including its path and any query) … used for that check and not kept … When you press **I submitted**, that address is kept with the application's record" | Match, mint, prepare and copy sheet: **not stored** — used to pick the packet (origin list + job id) and discarded. *I submitted*: **stored** as the application record's `evidence_url` (`services/applicationRecords.js`, capped at 2,000 characters), linked to the account and deleted with it. ⭐ **D69 (c), 10-07 (owner):** before it is stored, the query is reduced to the id-type parameters (`services/evidenceUrl.js` `EVIDENCE_ID_PARAMS` — `gh_jid`, `jobId`, `applicationId`, `req`…, each value id-shaped; a numeric Greenhouse `token`); session and one-time tokens, `utm_*`, `gclid` and emails never reach the row, and the fragment is dropped | No |
| ⭐ D67 (2) · learned origin pairs | `routes/apply.js` `/api/apply/handoff/submitted` → `services/learnedOrigins.js` `recordSighting()`, only for a job the user holds a packet for, on a page outside that job's addresses | *Filling an Application* — "we remember the **two site names** … the shared record holds only the two site names and a count, never who showed it" | `apply_origin_pairs`: two HOSTNAMES and a count, shared, no identity; `apply_origin_sightings`: (pair, user) to count distinct users and offer the pair to the user who saw it, deleted with the account. Promoted at 3 users; an admin can revoke (logged in `admin_audit_log`) | No |
| A cleared Draft House item → the 7-day bin (D53, 10-07) | `services/draftBin.js` — Clear (`DELETE /api/apply/run-jobs/:id`, `POST /api/apply/bin/clear`), Restore, Delete now; the sweep `purgeSweep()` scheduled in `server.js` | *Draft House* | Yes — for **7 days** after Clear, restorable; then its prepared answers, handoff packets and screenshot are deleted (the row stays as a scrubbed tombstone for the run's stored counters). Invisible past its date at read time even if the sweep is late. The résumé is the board's, deleted there. A sent application is never cleared | No |
| Form **structure** → our server (opt-in, default OFF) | `gated-handoff.js` schema capture, server-enforced consent | *Learning an Application Form* | Yes, as a fact about the employer's form; not linked to the user | No |
| **Report this form** — the form page's **host** and its field **labels** → our server (D55 decision E, user-invoked, two clicks) | `popup.js` *Report this form* → *Send report*; `background.js` `REPORT_FORM` handler injects `formReport.js` `collectFormLabels()` (label text read from a clone with every control removed — never a value) and builds the body with `buildFormReport()` from `reportHostOf()` (the hostname only, never the path or query); `services/formReports.js` `validateFormReport()` refuses any key but host, labels, fieldCount, extensionVersion and scrubs value-shaped label text; `recordFormReport()` stores it in `form_reports` (migration `136_form_reports`) | *Reporting a Form That Isn't Recognised* — "that site's host name … never the rest of the page address … the form's field labels, never your answers; the report is linked to your account and deleted after 30 days" | Yes — host, labels, field count and extension version, **linked to the reporter's account** (deleted with it; exported with it) and **deleted after 30 days** (`purgeExpiredFormReports()`, on every report and on a 6-hour sweep). Rate-limited to 10 an hour, 30 a day | No |
| Résumé + the profile details it draws on + the job description → the tools service → Anthropic (A4) | `server.js` `coreGenerateResume()`, `enhanceProfileResume()` and the `/api/standalone/generate` route — each through (`/api/parse-pdf` left this row with A80 V1: draft reads the PDF's text layer itself and sends it nowhere; ✅ the page's *Resume Master* paragraph says so since 10-05, O72b) `services/toolsService.js` `createToolsServiceClient()`; the body is built by `services/toolsServiceRequests.js` `generateRequest()` | *Third-Party Services* — **Resume Master** and **Anthropic** | **Not by the tools service** — it has no database and logs no content, only token counts. draft stores the RESULT, as before, in `resumes` / `resume_versions` | **Yes — this is the cross-service flow.** Sent over TLS with draft's own service token, as any third-party client would; every field is declared in the vendored, generated contract `contract/resume-master/`, which a checksum test pins |
| Résumé + job posting typed or pasted into an AI assistant (ChatGPT, Claude, any MCP host) → that assistant's operator (D21) | **None in draft.** The user's own action in the host's app; draft is not in this path at all | **Resume Master's** policy (`resumemaster.one/privacy.html`, source resume-master docs/PRIVACY.md), *Through an AI assistant* — "the assistant receives your text first, under its own terms". ⚠ NOT draft's *Third-Party Services*: draft neither sends nor receives this | **By the host, under the host's terms** (OpenAI, Anthropic, …) — not ours to state, and the policy says exactly that instead of guessing | No — this leg ends at the host |
| The same résumé text + job posting → Resume Master `POST /mcp`, tool `score_ats_fit`, **without a token** when `RM_MCP_ANONYMOUS` is set (D21, 10-04) | resume-master, not draft: src/http/auth.js `mcpCaller` admits a token-less caller as `ANONYMOUS_CLIENT` behind src/http/metering.js `createAnonymousLimiter`; src/mcp/server.js `mcpHandlers` → src/tools/deterministic.js `scoreAts` and `atsOutcome` | Resume Master's *Through an AI assistant* (what it receives, keeps, who receives it) and its *What it receives* `/mcp` row | **No content.** One request log line (method, path, status, ms, client `(anonymous)`) and one metering line (route, result, zero counts). A salted SHA-256 of the caller's IP, truncated, **in memory only**, per-process salt, never logged — each map is emptied when its window turns over, so a hash is held at most a minute (per-minute count) and never past its UTC day | **It IS the tools service, reached directly by the host — not through draft.** No model call, so nothing continues to Anthropic. draft's own calls to Resume Master (row above) are unchanged |
**D21 (10-04): the two MCP rows are the one flow in this file that draft is not part of.** They are here because the question "a résumé pasted into ChatGPT reaches OpenAI before it reaches us" has to be answered somewhere a reviewer of either product will look; the disclosure itself lives in Resume Master's policy, and no recipient is added to draft's *Third-Party Services*.

## Negative disclosures, and the code that makes them true

| Policy claim | Why it is true |
|---|---|
| No browsing-history collection | No `history`, `tabs` or `webNavigation` permission, and now no host permission for any site either — a tab's URL is readable only after the user invokes the extension on it. `e2CaptureConvergence.mjs` asserts the negative directly: before invocation the extension cannot see the job tab at all. |
| No scraping of job lists or saved-job lists | `saved-jobs-content.js` and `SCRAPE_SAVED_JOBS` are absent from source and from the packed zip — asserted by `test/extensionSubmission.test.js`. |
| Nothing is read until you invoke it, and only that tab | No content script and no job-board host permission exist, so there is no origin the extension can run on unbidden. Every read — capture, ATS, handoff — is an `executeScript` into the tab an invocation just granted. |
| No remotely hosted code | CSP `script-src 'self'`; no `eval`, `new Function`, `importScripts` or remote `<script src>` anywhere in the bundle. |
| No sale of personal data; no unrelated transfer; no creditworthiness use | No such code path exists. Third parties are enumerated in *Third-Party Services* — see the verified table below, which replaces the stale enumeration this row used to carry. |
| Nothing pushes data into the extension | `externally_connectable` absent — no website can message it. |

## Third-party recipients — verified against live code, 2026-09-15

This row used to be a flat list inside the negative-disclosures table, and it went stale for five
weeks: it named **Clearbit Logo API** as a recipient and omitted **DuckDuckGo Icons**, which is the
provider browsers actually request. Task X swapped them on 2026-09-08 and the deployed policy has
been right ever since — only this file was wrong. A named processor that receives nothing is a false
disclosure in the same way an undisclosed one is a gap, so each entry now carries its live status.

| Named in the policy | What reaches it | Code | Live status |
|---|---|---|---|
| **Railway** | hosting; everything | the deployment itself | **live** |
| **Resume Master** | résumé text or PDF, the profile details it draws on (name, contact details, stated years, job profile, claimed skills), the job description — for generation, A+ and PDF reading | `services/toolsService.js` `createToolsServiceClient()`, configured by `RESUME_MASTER_URL` + `RESUME_MASTER_TOKEN` | ⚠ **NOT YET LIVE** — Phase B deploys it. Until then draft's generation and A+ answer 503 and PDF reading degrades to local extraction. Processes, does not retain — its `docs/API.md`, enforced there by `test/http.test.js` (sentinel PII must appear in no log line) and `test/stateless.test.js` |
| **Anthropic** | job descriptions, résumé content | `services/modelCall.js` `callModel()` — draft's cover letters (`server.js`), and the domain-profile chip suggestions (`routes/domainProfiles.js`, A80 V3); the smart-search classifier is deleted (A80 V6, 10-05 — no UI had called it since April); job-description enrichment no longer calls it (deleted, A80 10-05: export → import only). Generation since A4 via **Resume Master**, which is its only provider | **live** — `ANTHROPIC_KEY` set, Haiku per A2 |
| **SerpApi** | search terms and filters | `services/jobs/aggregator.js` `searchJobs()`; reached by `POST /api/jobs/search` | **live in production** (`SERPAPI_KEY` set). Absent from `cacheJobs` by design — `ATS_SOURCE_NAMES` only. ⚠ Not set locally, which is the only reason a local boot logs `Inactive (not configured): adzuna, serpapi`; that line describes the dev box, not production |
| **Apify** | job titles, locations, filters for one refresh | per-user `apify_token` set via `/api/settings/apify-token`; ⚠ since A58 (10-02) reached by NO code path: `server.js` `scrapeJobs()` (the only `ApifyClient` caller) lost its one entry point when the admin force-scrape was removed, and was deleted 10-02 (18) — the token setting remains, unused | **conditional, and the policy says so** — "if you have not connected a token, nothing is ever sent". True whether or not any user has |
| **Adzuna** | search terms and filters | `services/jobs/sources/adzuna.js` `isConfigured()` requires **both** `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` | ⚠ **OVER-DISCLOSED.** Neither variable is in the Railway inventory, so in production Adzuna is inactive and receives **nothing**. Both are set locally. The policy states flatly that search terms "are sent to Adzuna when you search" — true on a dev box, not true of the deployed product |
| **Job boards we search directly** | search terms and filters | the seven ATS plugins, all now reached via `services/jobs/aggregator.js` `groupCompaniesByAtsType()` | **live** |
| **DuckDuckGo Icons** | a company domain, in an image URL | `LOGO_HOST` in `shared/companyLogos.js` | **live** — the only logo provider |
| **LinkedIn OAuth** | name, email, on opt-in sign-in | OAuth callback | **live, optional** |
| **Resend** | the recipient's email address and the message — the password-reset link, the code confirming a new email address, and service notices (Admin → System → Notices); it posts back bounces and spam complaints (`/api/hooks/resend`, Svix-signed), which suppress the address. Product news: consent captured (sign-up box OFF by default, Settings), NO send path built (D73 §B) | `services/emailService.js` `sendEmail()` → `api.resend.com/emails`, reached by the reset route and `routes/accountManagement.js` (email change) | **live** — `RESEND_API_KEY` and `EMAIL_FROM` set (owner, 10-09) |
| **Cloudflare Email Routing** | inbound mail a person sends to privacy@ / support@ (and postmaster@, abuse@, dmarc@) — the message as written, forwarded to the inbox the owner reads | none — DNS / Cloudflare configuration, no code sends to it | **live** (owner, 10-09) |
| **Your own ChatGPT or Claude** | the base résumé's work history and skills **without contact details**, claimed skills, and the job's title, company, level, location and matched keywords — under the USER's own account and that provider's terms | `routes/byom.js` `/mcp` → `services/byom/tools.js` `get_generation_brief` (`resumePatch.js` `buildBrief`); reached only by a host the user connected themselves | **built 10-08 (D86), OFF** — the operator's switch and the user's both start off; see the D86 section above |
| *Clearbit Logo API* | **nothing** | appears only in `services/jobs/backfillCompanyLogos.js` `RETIRED_LOGO_HOSTS`, a repair list that rewrites bad rows | **retired.** Named in the policy only as the thing DuckDuckGo replaced, which is the correct way to name it |
| *THEIRSTACK* | **nothing** | only consumer is the offline `scripts/providerEval` harness | **vestigial, and correctly NOT named in the policy** |
| *Google Fonts* | **nothing** — self-hosted since 2026-09-15 | four `@fontsource/*` packages imported in `client/src/main.jsx`, served from our own origin. Guarded by `test/selfHostedFonts.test.js` | **retired.** Was a real recipient of every visitor's IP and user-agent until that date, on every page, and the policy had never named it. Now named the way Clearbit is — as a former recipient that receives nothing |

✅ **Google Fonts — FIXED 2026-09-15, and it was worse than first reported.** The finding was that
`client/index.html` preconnected `fonts.googleapis.com` / `fonts.gstatic.com` and loaded two
families, handing Google every visitor's IP and user-agent on every page including the privacy page
itself, while *Third-Party Services* named no such recipient — the same shape as the Google S2
favicon fallback task X removed.

**There were TWO call sites and FOUR families, not one and two.** `client/src/index.css` line 1 also
carried `@import url('https://fonts.googleapis.com/…Instrument+Serif…Inter…')`, which the first
sweep of `index.html` missed entirely and which was confirmed live in the deployed CSS. Self-hosting
only the two families named in the original finding would have left Google receiving the same
request on the same page and made the policy's new claim false. That second site is the reason
`test/selfHostedFonts.test.js` walks the whole `client/` tree rather than checking the two files
that were wrong.

All four are now `@fontsource/*` packages imported in `client/src/main.jsx` — exactly the weights
the two retired requests asked for — served from our own origin. `EFFECTIVE_DATE` moved to
September 15, 2026 for this and the storage change; both reduce what leaves the browser, so neither
triggers the policy's advance-notice commitment, which covers changes adverse to a user.

### What is machine-guarded, and what is not

`test/privacyReconciliation.test.js` now asserts that **this table's named set matches the set the
policy names** — that was the actual reason the Clearbit row rotted unnoticed. The existing
third-party test only ever checked the *policy* against the code, never this file's own
enumeration, so both directions of that row were unguarded while the rest of the join was covered.

Still **manually maintained and unguarded**: the *Live status* column above (it depends on
deployment environment variables, which no offline test can read), and whether a paragraph is
honest prose. Those need a human.

## Dashboard — Privacy practices tab

Single purpose, permission justifications and the data-use answers are in `STORE_LISTING.md`, which
is the copy actually pasted into the dashboard. This file is the join that proves those answers are
not inventions.

Data types to declare **collected**: *Personally identifiable information* (job captures are
account-linked; the handoff moves the user's own name, email, phone, address and work-authorization
answers) and *Website content* (job posting text, ATS Score page text, opt-in form structure, and —
D55, next release — the address of a link saved with *Save link to draft*, and the host and field
labels of a form the user reports with *Report this form*, account-linked and kept 30 days).

Declared **not collected**: authentication information, web history, user activity, health,
financial, personal communications, location.

**Re-checked 2026-09-28 for A4 — no dashboard change needed.** The extension's own data types and
flows are unchanged: it never talks to the tools service, and nothing it sends to our server moved.
What changed is server-side — a captured job description, when the user later generates a résumé
with it, now reaches Anthropic *through* the tools service instead of directly. That flow already
existed and was already disclosed; the tools service is a processor for the same flow, run by the
same operator, and retains nothing. The three certifications still hold: nothing is sold, the use is
the item's single purpose (helping the user complete an application they chose to make), and none is
creditworthiness. The policy names the new recipient, and the third-party table below does too.

## Before submitting

- [ ] The policy is **deployed**, not just committed — `PrivacyPage.jsx` renders at
      `https://jobsviadraft.com/privacy` and shows the current Effective date.
- [ ] That URL returns **200 anonymously**, with no redirect and no sign-in.
- [ ] `npm test` — `privacyReconciliation.test.js` and `manifestMinimumPermission.test.js` pass.

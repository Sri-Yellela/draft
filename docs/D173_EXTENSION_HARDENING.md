# D173 (7) · Extension hardening review — manifest v1.7.0

Read from the code on 2026-11-20 (46y, branch `l46y-fidelity` from `b9bc6c70`): `extension/manifest.json` v1.7.0,
`extension/background.js` and the modules it configures, every content script (declared, registered and injected). A
written review only — **nothing in `extension/` was changed**, so the v1.7.0 zip prepared in 46y (`f714b024`) stands.
The per-entry justification of each permission stays in `extension/MANIFEST_RATIONALE.md` (guarded by
`test/manifestMinimumPermission.test.js`); this file is the security reading on top of it.

## 1. What the manifest grants

| Kind | Entries | Granted |
|---|---|---|
| `permissions` | `activeTab` · `contextMenus` · `scripting` · `storage` | at install |
| `optional_permissions` | `cookies` | only on the person's press ("apply here while you're away", D112 item 7), read for one portal family's own origins (`applyAway.js` `cookies.getAll({ url })`) |
| `host_permissions` | `https://jobsviadraft.com/*` + the eight board origins: `boards.greenhouse.io` · `job-boards.greenhouse.io` · `jobs.lever.co` · `jobs.ashbyhq.com` · `apply.workable.com` · `*.myworkdayjobs.com` · `*.myworkdaysite.com` · `jobs.smartrecruiters.com` | at install (the board origins since D191, owner 11-18) |
| `optional_host_permissions` | the same eight board origins again + `https://*/*` | `https://*/*` only through the one global ask (D112 b2), never itself requested at install |
| `content_security_policy.extension_pages` | `script-src 'self'; object-src 'self'` | — no remote code, no `eval` |
| `externally_connectable` | **not declared** | no web page can call `chrome.runtime.sendMessage` / `connect` into the extension; every message the service worker receives comes from the extension's own pages or its own content scripts |
| `web_accessible_resources` | **not declared** | no extension file is loadable by a web page (nothing to fingerprint the install with beyond the bridge's marker, §2) |

Not declared, on purpose: `tabs`, `<all_urls>` in any list, `notifications`, `webRequest`, `cookies` at install,
`history`, `downloads`.

## 2. Content scripts — what each can read

### Declared in the manifest (run on every matching page, top frame only)

| Script | Matches | Reads | Sends | Notes |
|---|---|---|---|---|
| `boardBridge.js` | `https://jobsviadraft.com/*` (document_start) | only `window.postMessage` data shaped `{ source: 'draft-board', type: 'OPEN_JOB', jobId, nonce, intent }` from **this window and draft's own origin**, carrying this load's nonce, a job id matching `^[\w.:\|@\-]{1,128}$`, during a real click (`navigator.userActivation.isActive`) | `OPEN_JOB { jobId, via: 'board', intent?, at }` to the worker; a reply `OPEN_JOB_RESULT` back to the page | Writes one attribute: `data-draft-extension = <per-load nonce>` on `<html>`. The page learns only "the extension is installed". |
| `panelArrive.js` | the eight board origins (document_idle) | `location.href`, only to send once per address | `PANEL_ARRIVE` (no address, no text) | The worker re-checks frame 0 + its own id (`background.js` PANEL_ARRIVE) and decides everything. |

### Registered at run time (`autoRead.js`, `chrome.scripting.registerContentScripts`), only after consent + Chrome's grant

| Script | Where | Reads | Sends |
|---|---|---|---|
| `jobSignals.js` + `globalReadDetector.js` | `https://*/*`, every frame — only while the person said Allow on the global ask AND Chrome granted `https://*/*`; never LinkedIn / Indeed / Glassdoor / draft's own site (`excludeMatches`) | the page's structure for "is this a job page" (`__draftJobSignals`: titles, schema.org JobPosting, apply controls) | nothing on a non-job page; on a job page ONE `AUTO_READ_DETECTED` carrying only the reason word |
| `autoReadWatcher.js` | a site the person switched on (Options) and Chrome granted | origin + path, the step's NAME and the NUMBER of controls — **no field value** | a debounced "step changed" |

### Injected on demand (`chrome.scripting.executeScript`), each after a gesture or a re-checked grant

| What | World | Reads / does |
|---|---|---|
| `extractJobPayload` (capture) | isolated | the posting's text, title, company, apply link |
| `probeFormShape`, `findMissingRequired`, `fieldsHeld`, `fieldValuesHeld`, `wizardState`, `collectFormLabels` | isolated | the application form's labels, types, options and (for the review panel) the current values of the fields draft filled |
| `applyPlan` (fill, overlay edits) | **MAIN** | sets values into the form's controls (framework setters need the page's world); `NEVER_FILL_RE` refuses password / payment fields |
| `attachResumeFile` | isolated | puts the résumé file into the form's upload |
| `pressSubmitInPage` / `readResultInPage` (A207 (a)) | isolated | presses the form's own submit only after the panel's trusted press (`GATE_SEND`: `trigger: 'press'`, `trusted: true`, frame 0, an extension-submit packet), then reads the result page's words |
| `dock.js` + `popup-layer.js`, `review-overlay.js`, `jobPanel.js`, `resumePanel.js`, `atsReport.js` | isolated, top frame | draw draft's panels into the page inside a shadow root |
| `portalSignedInInPage`, `probeIntentPage`, `frameSrcsInPage`, `showCaptureToast`, `badgeDismissed` | isolated | one fact each (signed in? which intent page? which frames?) |

## 3. Message handlers and their sender checks

A web page cannot message the worker (no `externally_connectable`), so "sender" here means: an extension page
(Options, runner, notice, apply-away, global-ask), or one of the extension's own content scripts running in some page.
The checks therefore defend against a content script being driven by a page (via the DOM or `postMessage`), and against
a message from a frame or tab other than the one meant.

| Handler(s) | Sent by | Check | Verdict |
|---|---|---|---|
| `OPEN_JOB` (`boardOpen.js`) | `boardBridge.js` | `fromDraftPage`: a tab, frame 0, this extension's id, `sender.url` AND `sender.tab.url` on draft's origin; the SERVER confirms the job is on the person's board and names the address | ✅ strong |
| `BOARD_TAB` | extension page | `fromExtensionPage` (`sender.url` under `chrome.runtime.getURL('')`) | ✅ |
| `PANEL_ARRIVE` | `panelArrive.js` | frame 0, a tab, own id | ✅ |
| `PANEL_PROFILES` / `PANEL_PROFILE_PICK` / `PANEL_ASK` / `PANEL_REFRESH` / `PANEL_SETTING` / `DOCK_ACT` / `DOCK_FILL` / `DOCK_TAB` / `OPEN_SETTINGS` | the dock / panel in the page | `trigger: 'click'`, frame 0, a tab | ✅ (the panel drops untrusted events before sending) |
| `GATE_SEND` | the review panel | `trigger: 'press'`, `trusted: true`, frame 0, a tab holding an extension-submit packet | ✅ |
| `DOCK_SUBMITTED` | the dock | `trigger: 'click'`, frame 0, a tab | ✅ |
| `GATE_REVIEW_EDIT` / `GATE_SUBMITTED` / `GATE_REVIEW_STATE` / `GATE_BATCH_NEXT` | the review panel | a tab (`sender.tab.id`); the job is resolved from the tab's released packet, never from the message | ⚠ no frame-0 / click check on `GATE_SUBMITTED` (records Sent) or `GATE_BATCH_NEXT` (moves the batch on) — see R2 |
| `RUNNER_*` | `runner.html` | `fromRunner`: own id + `runner.html` URL | ✅ |
| `DIAGNOSTICS` | `options.html` | own id + `options.html` URL | ✅ |
| `TOOLBAR_PRESS` | extension pages (the walks) | own id + extension URL | ✅ |
| `AUTO_READ_*` (consent, sites, kill, pending, state) | Options / notice | `fromExtensionPage` on every settings message; `AUTO_READ_DETECTED` refused FROM an extension page (it must come from a page) | ✅ |
| answer memory, résumé panel, apply-away, global ask, tab state, intent, dock place, form-frame handlers | panels / extension pages | each module's own check (answer memory and the résumé panel resolve the job from the tab's packet or binding, never the message; `INTENT_SETTINGS` extension pages only; `INTENT_CHOOSE` the dock's trusted click in frame 0; `DOCK_PLACE` frame 0) | ✅ (read per module; not re-tested here) |
| `CAPTURE_ACTIVE_TAB` · `PREVIEW_ACTIVE_TAB` · `POPUP_CONTEXT` · `FILL_ACTIVE_TAB` · `PREPARE_ACTIVE_TAB` · `SUBMITTED_ACTIVE_TAB` · `COPY_SHEET_PANEL` · `DOCK_OPEN` (`background.js` first listener) and `REPORT_FORM` | **nobody** — the toolbar popup that sent them was retired in T31; no file in `extension/` sends these types today (grepped) | **none** — they act on the active tab (`tabs.query({ active: true })`), and `SUBMITTED_ACTIVE_TAB` records a submission for it | ⚠ see R1 |

## 4. Findings and recommendations

No clear defect was found — nothing a web page can do today reaches a privileged action, because no page can message
the worker and every content script that forwards page data validates it first. The recommendations below are
defence in depth, each needing a new zip / version, so **none was made in this lane** (the owner decides when the next
store upload carries them).

- **R1 — retire or gate the popup-era handlers.** The eight popup handlers and `REPORT_FORM` have no sender in the
  extension since T31 and check nothing; any of the extension's own content scripts (including the ones registered on
  `https://*/*`) could send `SUBMITTED_ACTIVE_TAB` and record a submission for whatever tab is active. Delete them (the
  toolbar press, the context menu and the hotkeys reach the same functions directly), or put `fromExtensionPage(sender)`
  in front of each. ⚠ `test/d55ContextMenuFormReport.test.js` and `test/o100DockSubmitted.test.js` read these names —
  move their pins with the change.
- **R2 — `GATE_SUBMITTED` and `GATE_BATCH_NEXT` should require frame 0 and the panel's click**, as `DOCK_SUBMITTED` and
  `GATE_SEND` already do (`GATE_SUBMITTED` records "Sent" for the tab's application, `GATE_BATCH_NEXT` opens the batch's
  next application; the evidence rule FA5 is server-side, so this is belt and braces).
- **R3 — the in-page panels use OPEN shadow roots** (`dock.js:436`, `popup-layer.js:121`, `review-overlay.js:606`,
  `jobPanel.js:28`, `resumePanel.js:389/418`, `atsReport.js:1166`). The employer's page — and any third-party script on
  it — can read `host.shadowRoot` and so read what draft draws there (the answers under review, the résumé panel, the
  assistant's replies). Most of it is going into that page's form anyway, but not all (the panel's "your day", other
  jobs, profile names). Options: `mode: 'closed'` (cheap; content scripts run in the isolated world, so the page cannot
  patch `attachShadow` for them), or the sensitive views in an extension-origin iframe (`web_accessible_resources`
  scoped to the board origins). ⚠ The real-Chrome walks reach into `shadowRoot`; they would need the host's reference.
- **R4 — the MAIN-world fill.** `applyPlan` runs in the page's world, so a hostile page can observe the values as they
  are set (it receives them anyway on submit) and could interfere with the fill (it cannot make the extension submit:
  submission needs the trusted press, R2 / `GATE_SEND`). Keep the MAIN-world surface to the setter calls only — the
  plan carries values, never tokens or other jobs' data (true today: `matched.plan`, the résumé file and fill options).
- **R5 — tidy `optional_host_permissions`.** The eight board origins are listed in both `host_permissions` (granted at
  install since D191) and `optional_host_permissions`; the optional copies are now inert. Dropping them changes nothing
  a person sees and shortens the store's permission review. `https://*/*` stays optional and is requested only by the
  one global ask.
- **R6 — `boardBridge.js` runs on every `jobsviadraft.com` page.** Its marker tells any page on draft's origin that the
  extension is installed; its one action is guarded by the nonce, the origin, the click and the server's own check.
  If draft ever serves user-authored HTML on its origin (D180 profiles, public pages), keep it inert (no script) — an
  XSS on draft's origin would be able to ask the extension to open a job the person already has on their board, nothing
  more.
- **R7 — the one credentialed call** is `auth.js`'s `GET /api/auth/extension-token` (`credentials: 'include'`, draft's
  origin only); every other request carries the extension's own token with `credentials: 'omit'`. Keep it that way:
  a new `credentials: 'include'` would act as whatever session the browser holds.

## 5. Tightest host permissions — the check

Against what the code needs today: `https://jobsviadraft.com/*` (the bridge, the token) and the eight board origins
(D191's panel opens by itself there — the owner's install-time pick of 11-18) are the minimum for v1.7.0's features.
Narrower is possible only by giving up a feature: moving the boards back to optional would bring back the per-site
grant step D191 removed. Nothing broader is declared at install. R5 is the only narrowing with no cost.

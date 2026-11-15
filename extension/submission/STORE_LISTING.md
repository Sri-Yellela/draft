# Chrome Web Store listing — draft v1.7.0

> **v1.7.0 + D191 rebuilt to the current spec (2026-11-15, 46o — the owner's "rebuild and revamp extension to current
> specifications").** Still v1.7.0 (unpublished — the zip is rebuilt). ⛔ **ONE NEW PERMISSION: `sidePanel`** (the owner
> chose it, 11-15) — draft's panel (your day, what draft knows about the job on this tab, a search of draft, Tiny) opens in
> Chrome's side panel beside the page instead of a small window. Chrome shows no install warning for it; it reads no page
> and collects nothing. Paste into the dashboard's `sidePanel` justification: *"Shows draft's panel — your day, what draft
> knows about the job on this tab, a search of draft and Tiny — in Chrome's side panel beside the page, when you open it. It
> reads no page and collects nothing."* **What the panel shows on a posting** (D191 (2a)–(2d), from draft's own records, no
> AI): the role's subcategory, level and posted salary, *Works with* (the stack the posting names), a one-word fit with the
> ATS match, *"you've proven 4 of their top 8"*, your application's state, and Draft / Save / Apply from here / Open in
> draft / Send to a connection; the employer's logo, one line about it, its H-1B record, open jobs and hiring trend. **No new
> data:** the panel shows the press's read (already disclosed under `activeTab`). **The in-product disclosure (the store's
> User Data Policy: prominent disclosure, and disclosure of changed practices after install):** `notice.html` opens once on
> install and on an update from before 1.7.0 — what draft reads, when, and where it goes — and again from Settings. ⛔
> **`privacy_policy_url` left the manifest** — it is not a manifest key (Chrome logs "Unrecognized manifest key"); the
> policy URL is the dashboard's field (below). 👤 At the upload: the `sidePanel` justification above; Privacy practices
> unchanged in kind; the owner's two lines from the 46m / 46n addenda still apply. Paste-ready line for the description:
> *"Open draft beside any job posting: your match, the role's level and pay, the employer's visa-sponsorship record and
> hiring trend — all from draft's own data, no AI."*

> **v1.7.0 + A211 (1a) (2026-11-15, 46n — the owner's "automate applications using the user's own session … by seeking
> permission").** A new extension page, **"Apply while this is open"** (the runner tab): it lists the applications draft holds
> to be sent from the user's own browser (sites that flag draft's servers). On the user's click of **Fill all**, Chrome asks
> the user for those application sites (the existing OPTIONAL host permissions — nothing new in the manifest), the extension
> opens each in a background tab and fills it from the user's saved answers; **nothing is sent until the user presses Send
> all**, and then only the applications that read Ready, each from the user's own browser, each confirmation read back. A bot
> check or a question only the user can answer stops that application at "Needs you". **No new permission, no new host, no
> new data** (the same packets, fill and press as A207). Paste-ready line for the description: *"Keep draft's runner tab
> open and it fills your waiting applications in the background — you press Send all, and only the ready ones go, from your
> own browser."* 👤 Re-read Privacy practices → Website content at the upload: unchanged in kind (the same form answers).

> **v1.7.0 + D191 (2026-11-14, 46m — the owner's "the extension revamped … enough to be the primary source of traffic").**
> Still v1.7.0 (unpublished — the zip is rebuilt). **No new permission, no new host.** What changed: (1) on a job posting,
> after the press's question, a line with the employer's facts from draft's own records — its H-1B filings (US Department of
> Labor data) and how many of its jobs are open on draft — with a button to its company page on draft; (2) on a page with
> nothing else to say, the day in one line ("Today: 3 new matches · 1 needs you") with buttons to draft; (3) the toolbar
> badge shows today's new matches (asked of draft when a page finishes loading or on a press, at most every five minutes —
> never on a timer); (4) **signed out**, the press reads the posting's company name with the page's own extractor and asks
> draft's PUBLIC company record for it (no account, no cookie sent) — "sign up to see your match and apply with one click".
> ⛔ **(4) is a new data flow for signed-out users: the employer's name and the page's address go to draft's server on the
> press.** Re-paste at the upload that carries it: Privacy practices → Website content (signed-out: the posting's company
> name and address, on the press, to draft's server, not stored), and the privacy policy's extension section must say the
> same in the same push (👤 owner step — the agent did not change the policy). Paste-ready short description (≤ 132):
> *"See your match for any job, which companies sponsor visas, and fill applications in one press — you submit every one."*
> Paste-ready first paragraph: *"draft knows the job you're looking at: your ATS match, the employer's H-1B filing record
> and their other open jobs — all from draft's own data, no AI. Draft it to your board in one press; when you apply, draft
> fills the form from your saved answers and résumé and stops before Submit — you review and send it yourself."*

> **v1.7.0 (2026-11-13, 46l — A207, the owner's "make the extension path the primary submit for ATS boards that flag
> server submissions").** Where an employer's application site flags submissions sent from draft's servers, the review
> panel offers **Submit application**: the user's ONE press of it (a trusted click, after every required field is
> filled) clicks that form's own submit button in the user's browser, and the extension reads the page it went to —
> Sent is recorded only on the employer's confirmation. Nothing else ever sends (no timer, page script, fill or batch
> step). **No new permission, no new host, no new data collected** — the press uses the `activeTab` / `scripting`
> access the fill already has on that tab; the confirmation page's address is the one "I submitted it" already sends.
> The single-purpose and "never submits" statements below now read "never submits on its own".

> **v1.6.1 (2026-11-12, 46j — the owner's "bump up the extension to latest requirements").** 1.6.0 plus 46i's
> `3889f77c` (Open & fill fills by itself on a tab draft opened to apply). No new permission, no new host, no new
> data collected — the listing text and the privacy disclosures below are unchanged. Checked against the Chrome Web
> Store's 2026 policy update (enforced 2026-08-01: every data collection prominently disclosed, changes in data
> handling disclosed to users): this version changes no data handling.

> **v1.6.0 (2026-10-30, D112 — NOT yet uploaded; released on the owner's word).** The manifest is 1.6.0 since D112
> item 4 (global read, `d43550f` — its listing changes are that commit's). ⭐⭐ **D112 item 7 adds ONE optional API
> permission, `cookies`** — *"Let draft apply here while you're away"*: on a signed-in amazon.jobs page the dock offers
> the line; a small window's Allow asks Chrome for `cookies` and that portal's three hosts; the extension verifies the
> apply worker's key against the identity built into it, reads only that portal's cookies, seals them on the device and
> uploads the sealed copy (draft cannot read it); Disconnect deletes it and the key. ⛔ **At the upload that carries it,
> re-paste: the `cookies` justification, the `https://*/*` justification, Privacy practices → Authentication information
> (becomes COLLECTED), the reviewer notes — paste-ready text in `docs/privacy/PENDING_D100_D103.md` §7 — together with
> the privacy policy's change in the same push.** The sections below still describe the extension WITHOUT it; while
> `PINNED_WORKER_IDENTITY` (extension/applyAway.js) is empty the feature is inert and they stay true.


> **The toolbar popup is retired (2026-10-25, T31, owner decision — NOT yet uploaded).** ⛔ **Re-paste at the next
> upload: `activeTab`, `storage` (now NINE values — it said Ten values before T31), the optional host permissions,
> the single purpose's last paragraph, the Privacy practices tab's Website content item 4, the reviewer notes and the
> test instructions.** **No permission was added or removed.** What changed: the extension has no toolbar popup any
> more (`manifest.json` declares no `default_popup`). **Pressing the toolbar icon** (or a shortcut the user binds to
> it) toggles draft's on-page panel (the dock): on a page that is not a web page it opens the draft board; if the dock
> is open it closes it to its launcher and reads nothing; otherwise it opens the dock and — signed in only — **that
> one press reads the page** (the tab's address goes to our server, as the separate "Read this page" press used to
> send it), then shows only what the page needs as small in-page prompts: sign in; "Add this job to draft?"
> [Capture] [Draft]; "Answers prepared" [Fill]; the company notice; and the automatic-reading offers. **Where each
> popup control went:** Capture, Draft and Fill → those prompts; Unlink this page → an icon in the dock's ATS tab; the
> Copy sheet, ATS report and résumé → the dock's tabs (they already lived there); Report this form → offered by the
> dock when a fill meets a form draft does not recognise (still two clicks, host and labels only); the account (who
> is signed in, Sign in, Disconnect, LinkedIn), each site's permission switch, the one-prompt consent for every preset
> site and **Always read here** → the extension's **settings page**, where every `chrome.permissions.request` now
> happens (a web page cannot request a permission); the dock's gear opens it. **Storage: nine keys** — the
> most-recent-capture key is no longer written (a capture's outcome is the toast on the page). The privacy policy says
> the same, effective October 25, 2026. **Reviewers: press the toolbar icon** on a job posting or an application page.

> **v1.5.2, folded further (2026-10-15, T17 — still v1.5.2, NOT yet uploaded).** ⛔ **Re-paste at the next upload: the
> `storage` justification (now TEN values) and the reviewer notes.** What changed: everything the extension shows on a
> page — the review panel, the ATS report, the résumé, the Copy sheet and the one-line status — now sits in ONE panel
> (the dock) in the page's TOP frame only, never inside an embedded form's iframe; it can be dragged, resized, snapped
> to an edge, collapsed, and any of its four tabs opened in its own floating window. Where it sits is remembered per
> site (`dockPlace`, local storage: the site's origin and the panel's position and size — nothing of the page). The
> panels are drawn in the account's theme (all four). No permission changed. **T22 (same day): the popup is a launcher** —
> its capture, fill and score tiles and its stand-alone résumé button are gone (Capture it / Fill it stay as the one main
> action; the Draft button stays; **Open dock** added); the right-click menu gains **Fill this application with draft**
> and **Show draft's ATS report** (re-paste the `contextMenus` justification); the Score tile's page-text-in-a-URL path
> to the ATS Score page is gone (Website content item 3, and the privacy policy says so).

> **v1.5.2, folded further (2026-10-15, D97 REVISED + T12 — still v1.5.2, NOT yet uploaded).** ⛔ **Re-paste at the next
> upload: the optional host permissions justification, `scripting`, `storage`, the reviewer notes and the test
> instructions.** What changed: **(1) automatic reading after ONE consent** — the popup shows a one-time card (*"draft
> reads job and application pages for you and prepares your answers. Allow it on these sites"*) with the disclosure in
> plain words and ONE Chrome prompt for the preset hosts; granted, Read and Prepare are on there (Capture and Fill stay
> separate switches, off). **(2) SmartRecruiters** (`jobs.smartrecruiters.com`) joins the preset hosts. **(3) "Always
> read here"** — a popup switch that asks Chrome, from the click, for the ONE company careers origin the user is on (and
> the ATS frame known for it); the manifest's `optional_host_permissions` therefore ends with **`https://*/*`** — optional
> only, never granted at install, never itself requested. Required permissions and `host_permissions` are unchanged.
> ⛔ A broad optional host pattern may draw a closer review; the justification below says why it exists.

> **v1.5.2, folded further (2026-10-14, D96–D98 — still v1.5.2 by the owner's rule, NOT yet uploaded).** ⛔ **Re-paste
> at the next upload: the single purpose, `scripting`, `storage`, the optional host permissions, the Privacy practices
> tab and the reviewer notes and test instructions** — each changed below. What changed: **(1) automatic reading
> (D97)** — Capture became one of FOUR per-site switches (Read · Prepare · Capture · Fill), all off, behind an in-UI
> disclosure and "I agree", with a kill switch; Workday's public hosts `*.myworkdayjobs.com` and `*.myworkdaysite.com`
> join the optional list (a deliberate reversal of "no gated portal", owner 10-13); a content script (the watcher) is
> registered at runtime only for a site the user switched on. **(2) answer memory (D96 §4)** — an answer the user
> acknowledges in the review panel is sent to their own Saved answers. **(3) the résumé on the page (D98)** —
> generated on draft's server only when the user presses Generate, previewed and attached. The storage field still
> lists nine values (D64's switch is now the automatic-reading settings; the progress record also keeps a generated
> résumé's id). The privacy policy is effective October 14, 2026. Required permissions are unchanged.

> **v1.5.2 (2026-10-13) — one job across every stage of an application, and the Copy sheet in the page.** A tab now
> remembers the job it captured or recognised (`bind:{tabId}`, session storage — **the storage field below changed:
> eight values, re-paste it**, and the privacy policy's storage list gained the item, effective October 13, 2026);
> the Copy sheet opens as a panel in the page with Close, Esc, Minimise and a dock side instead of in the popup;
> "Captured today" counts distinct jobs by any route. No permission changed (still activeTab, contextMenus,
> scripting, storage and the one host). Upload v1.5.2 in place of any earlier build not yet uploaded.

> **v1.5.1 (2026-10-09) is v1.5.0 plus one visual fix (D60):** three small controls — the review overlay's buttons
> and edit field, and the popup's compact links — had corners so round they read as capsules; they are now
> rounded rectangles. No permission, data use or behaviour changed, so every field below stands as written for
> v1.5.0. **If v1.5.0 was never uploaded, upload v1.5.1 in its place;** if it was, v1.5.1 is the update.

Copy for the Web Store developer dashboard, **written fresh for v1.5.0 on 2026-10-07** (release
finalisation, after D60–D69). Every justification below was written against the actual code and cites
the file that uses the permission, because the dashboard rejects justifications that don't match
observable behaviour. ⛔ **Re-paste every field** — single purpose, every permission justification
(three changed or are new), the storage field and the whole Privacy practices tab. The previous text
in the dashboard describes a build that no longer exists.

Upload artifact: `extension/submission/resume-master-extension-v1.5.2.zip`
(build with `npm run build:extension` — never hand-assemble it; see extension/README.md).

---

## What changed — read by the reviewer, who compares this package with the published one

**The only published build is v1.0.0 — UNLISTED, link-only.** v1.1.1 was uploaded for review on
2026-09-28 (owner-reported; not published); v1.2.0 through v1.4.1 were built and never uploaded.
**v1.5.0 replaces all of them in one submission** — ⛔ withdraw v1.1.1 from review if it is still there. It posts to
the former address, which now serves a separate résumé tools service, so its captures are no longer
received. Against v1.0.0:

1. **The product was renamed.** "Resume Master" → **draft**, and the listing title with it.
2. **The host permission moved**, from `https://resumemaster.one/*` to `https://jobsviadraft.com/*`.
   Same server, same operator, new address. The old address still serves and is deliberately NOT
   redirected — a credentialed `fetch` does not follow redirects, so a 301 would break v1.0.0 silently.
3. **The privacy policy URL moved with it**, and the policy is live on the new origin.
4. **The extension holds an access token of its own** (`auth.js`) instead of borrowing the browser's
   session — one of the nine stored values, and the only one transmitted (to our backend only).
5. **No job-board content script and no job-board host permission at install.** v1.0.0 declared six job boards
   and ran a content script on them; that is gone. **One small script runs on jobsviadraft.com only (D99), so the
   draft website can hand a job from your board to the extension** — it reads nothing from the page. Every read starts at a click or a keystroke —
   **except automatic reading (item 6), which is off until the user switches it on, site by site.**
6. **Automatic reading (opt-in, off by default; D64, extended by D97 on 2026-10-14).** The options page
   has FOUR switches per site — **Read · Prepare · Capture · Fill** — all off, usable only after the user
   has read the in-extension disclosure and pressed "I agree". Switching a site on asks Chrome, at that
   click, for that site's `optional_host_permissions`: five public job-posting hosts
   (`boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`,
   `apply.workable.com`) and Workday's `*.myworkdayjobs.com` and `*.myworkdaysite.com`. **Read** sends
   nothing. **Prepare** runs only on a tab already linked to one of the user's own jobs. **Capture**: a
   page that **is a job posting** (its URL has a posting's shape, or it carries JobPosting structured
   data — never an application step) is sent to the user's account, where our server decides whether it
   fits their board — and **discards an irrelevant posting without storing it**. A page that is not a
   posting sends **nothing** — not its address, not a hash. **Fill** may press the form's own Save and
   Continue but **never submits on its own** (v1.7.0: where an employer's site flags submissions from draft's servers, the
   review panel offers **Submit application** — the user's own press of it sends that one form from their browser), never ticks a terms, consent, attestation or signature box, and never
   saves the form's structure for other users. A kill switch turns all of it off and gives every host
   back. Never LinkedIn, Indeed or Glassdoor.
   ⭐ **Since 10-15:** a one-time consent turns Read and Prepare on for the preset hosts (SmartRecruiters'
   `jobs.smartrecruiters.com` among them) with ONE Chrome prompt, and **Always read here** asks for one company
   careers origin from a click (under the optional `https://*/*`). ⭐ **Since 10-25 (T31)** both live on the
   settings page (*Read application pages automatically*); the dock's prompt on a page only offers them and opens
   that page.
7. **NEW · `contextMenus`** — right-click **Save this page to draft** and **Save link to draft**.
8. **NEW · Report this form** — the form page's host and field labels (never values), on two clicks.
9. **No toolbar popup (T31, 10-25).** The toolbar icon opens draft's panel on the page (the dock — Fill · ATS ·
   Résumé · Copy sheet) and, signed in, reads the page in that same press, then asks only what the page needs
   (Capture or Draft a posting, Fill prepared answers); the **Copy sheet** lists the user's own prepared answers to
   copy by hand. The account, permissions and automatic reading are on the extension's settings page.
10. **The capture result** says what happened — added, already on the board, or held off it and why.

⛔ A rename, a host-permission change and a new optional host permission is the shape that triggers an
in-depth review. Expect a longer queue.

---

## Single purpose

> Help the user apply to the jobs they choose: get the job postings they are looking at into their own
> Draft account — when they capture one, or automatically on the job sites they have switched that on
> for — and, on an application form they have opened and signed in to themselves, fill it with answers
> they have already given us (when they invoke the extension, or automatically on the sites they have
> switched that on for), with a résumé tailored for that job if they ask for one, for them to review and
> submit.

Capture (manual or automatic) and fill are the same purpose at two points in one flow: the user finds a
job, and the user applies to it. Automatic reading is the same capture, preparation and fill without the
click, on the sites the user has switched on and granted, and capture only for pages that are postings.
Nothing is ever submitted by the extension.

The extension's other controls (the dock's ATS, Résumé and Copy sheet tabs, Report this form, the dock's gear →
the settings page with the account, Sign in with LinkedIn, per-site permissions and automatic reading) are not
separate features: they open a page of the user's own Draft account or the extension's own settings page, or they
serve the application in front of the user.

---

## Description (matches `manifest.json` byte for byte)

> Capture the job you're viewing, and fill the application you signed in to reach. You review every
> answer and submit it yourself.

---

## What the extension does, end to end

| Trigger | What happens |
|---|---|
| **Press the toolbar icon** (or a shortcut the user binds to it) | On a page that is not a web page, opens the draft board. If draft's panel is open on the page, closes it to its launcher — nothing is read. Otherwise opens the panel (the dock) and, signed in only, reads the page in that same press: asks our server whether it is on the user's board — the tab's address, in the request body — and shows only what the page needs as small prompts in the panel (sign in; *Add this job to draft?* Capture / Draft; *Answers prepared* Fill; the company notice; the automatic-reading offers). Nothing is read or sent before the press. |
| The panel's **Capture** / **Ctrl+Shift+K** / right-click **Save this page to draft** | **One capture implementation**: reads the job description on the page in view and sends it to the user's Draft account. Works on any job posting, including employers' own careers pages. |
| Right-click **Save link to draft** | Sends only the link's address; our server reads the posting from the job board's own listing, or refuses the link and saves nothing. |
| **Automatic capture** (off by default; settings page) | Only on a granted host the user switched Capture on for (a preset job host, or a site chosen with Always read here): a page that is a posting is sent to the user's account; our server keeps it only if it fits their board. A non-posting sends nothing. |
| **Automatic reading** (after the one-time consent on the settings page, or Always read here there) | On an allowed site: an application page's question labels and counts are read and kept on this computer (nothing sent); on a tab linked to the user's own job, the answers are prepared on our server (the page's address is sent). |
| The panel's **Fill** / **Ctrl+Shift+Y** / right-click **Fill this application with draft** / the panel's **Fill this page** on an application form | The gated handoff: fetches the answers the user already saved (building them on demand for a job of the user's with nothing prepared), checks this page is that application's, fills the form and shows a review panel. The user submits. |
| **I submitted it** | Records the application against the page in view (its address is the evidence). |
| Right-click **Show draft's ATS report** | Opens the extension's panel on the page (Fill · ATS · Résumé · Copy sheet), in the page's top frame — movable, resizable, kept open — at its ATS tab. Reads nothing of the page to open it. |
| **Copy sheet** (the panel's tab) | Lists the user's own prepared answers in the panel on the page, each with a copy button. Writes nothing into the page's fields. |
| **Report this form** → **Send the report** (offered by the panel when a fill meets a form draft does not recognise) | Shows first, then sends: the form page's host and its field labels — never values. |
| **Unlink this page** (an icon in the panel's ATS tab) | Forgets which job this tab is on. Sends nothing. |
| The panel's gear → **settings page** | The account (who is signed in, Sign in, Disconnect, Sign in with LinkedIn), keyboard shortcuts (both commands, as bound), one permission switch per site, and automatic reading (the one-prompt consent, Always read here, the per-site switches). Every Chrome permission prompt is asked from here. |

### Which sites it works on

**Any job posting the user invokes it on.** The extension holds no permission for any site in advance
except our own backend; it reads the tab the user invoked it on. Automatic reading additionally works
on the preset hosts (five public posting hosts, Workday's two public hosts and SmartRecruiters') — and only
on those the user allows — and, with **Always read here**, on a company careers site the user chose, one
origin at a time.

---

## Permission justifications

**`activeTab`**
> Granted only when the user explicitly invokes the extension — pressing the toolbar icon, a
> right-click menu item, or one of the keyboard shortcuts. It is used to read the job
> posting on the page the user is viewing and to fill the application form on a page they have opened
> and signed in to themselves. The extension holds no install-time permission for any job site or
> employer portal, so it reaches such a page only through that per-tab, per-invocation grant.

*(Code: `background.js` `chrome.action.onClicked` → `pressToolbar()` → `toolbarPress.js` `toolbarPress()` (the press's
own tab; the page is read through `popupContext()` only when signed in), `chrome.commands.onCommand` and
`chrome.contextMenus.onClicked`, each inside a user-gesture handler; the panel's buttons reach the service worker as
`DOCK_ACT` — a trusted click from the page's top frame, acting on that tab only. `captureActiveTab()`,
`previewActiveTab()` and `handleGatedHandoff()` are reached only from there.)*

**`contextMenus`**
> Adds four items to the right-click menu. **Fill this application with draft** runs the same fill as the panel's
> **Fill** and Ctrl+Shift+Y, on the page the user right-clicked; **Show draft's ATS report** opens the extension's
> panel on that page at its ATS tab (draft's report for the job, from our backend — it reads nothing of the page).
> **Save this page to draft** runs the same capture as the
> panel's Capture and Ctrl+Shift+K, on the page the user right-clicked. **Save link to draft** sends only the address of
> the link the user right-clicked to our backend, which reads that posting from the job board's own
> listing — or refuses the link and saves nothing if it is not a posting on a board we read directly.
> No item reads anything until the user picks it, and the permission grants no access to any page.

*(Code: `background.js` `chrome.contextMenus.onClicked` → `captureActiveTab()` / `saveLinkToDraft()` / `handleGatedHandoff()` / `openDock()`;
the items are `formReport.js` `CONTEXT_MENUS`.)*

**`scripting`**
> Injects a one-off script into a tab to (a) read the job posting the user is capturing, (b) on a toolbar
> press, open or close the extension's panel in the page's top frame and draw its prompts there, and read a
> form's field labels (never values) when the user reports that form, (c) fill the application form and render the
> review panel on a handoff, and (d) when automatic reading is on for a site, register a small watcher
> script on that site only (`chrome.scripting.registerContentScripts`) that notices a new application
> step and reads no values, check a page there for JobPosting structured data, and run the switched-on
> steps. The manifest declares no content script; the watcher is registered only for hosts the user
> switched on and granted, and unregistered when they switch it off.

*(Code: `background.js` `captureActiveTab()` / `reportCapture()` injecting `extractor.js`
`extractJobPayload()` and `showCaptureToast()`; ⭐ T31 `background.js` `pressToolbar()` (the dock's state and
collapse, frame 0 only) and `toolbarPress.js` `renderRelay()` drawn by `dockHost.js` `drawInDock()`; `reportForm()`
injecting `formReport.js` `collectFormLabels()`; the automatic path, `autoReadWatcher.js` (the watcher) →
`autoRead.js` `syncRegistrations()` / `runAutoPass()` / `autoStep()` / `pageHasJobPosting()`; `gated-handoff.js` `probeFormShape()`,
`applyPlan()`, `applyOverlayEdit()`; `review-overlay.js` `renderOverlay()`; `autofill-badge.js`.)*

**`storage`**
> Nine values. Eight never leave the browser; the ninth is the extension's own access token, which is
> sent to our backend and to nowhere else. In `chrome.storage.local`: the username of the account the
> extension is connected to, so the settings page can name it; that
> access token, which is how the extension identifies itself to us — not the user's password and not
> their website session, deleted the moment they disconnect the extension; the automatic-reading settings
> (which of Read, Prepare, Capture and Fill the user switched on for each site, when they agreed to the
> disclosure, and — while Read is on — the question labels, never answers, and field counts of pages read,
> 30 days); and where each application stands — for each job the user captures, reads, prepares, drafts, fills or
> submits with the extension, its draft id, title, company and posting address, when each step happened,
> how many fields were filled or still need the user, and the id and status of a résumé generated for it —
> no answers and no résumé content, kept 30 days from its last change, deleted on disconnect, sign-out or
> another account connecting; and where the extension's on-page panel sits on each site the user used it on —
> the site's origin (never a path) and the panel's position, size, snapped edge, collapsed state, tab and which
> tabs are in their own windows — nothing of the page, the 50 most recent sites, each kept 30 days.
> In `chrome.storage.session` (memory-backed,
> discarded on browser restart): the prepared answers for an application in progress, with a 10-minute
> expiry and cleared when the tab closes; the result of the most recent form fill, so the extension can
> report a fill started with the keyboard; when several applications are queued for one employer
> site, that site's origin and how many remain, so a batch can resume in the same tab — no answers and
> nothing about the user in that one; and which job a tab is on (the job's draft id, title and company, and
> when it was linked; for a tab the user's draft board opened, whether it was opened to apply or to view; and,
> once the user chooses, whether they are drafting that job or filling it in themselves) once the user captures a job there or draft recognises
> the posting, so the later pages of that application are known to be the same job — no answers, never
> shared between tabs, deleted when the tab closes, shows a different job, or the user unlinks it.

*(Code: `background.js` `reportHandoff()` → `lastGatedHandoff` (session) — ⭐ T31: `reportCapture()` now only shows
the toast on the page and writes no key; `gated-handoff.js` → `gate:{tabId}` and `batch:{tabId}` (session);
`auth.js` → `authToken` and `authIdentity` (local); `autoRead.js` `updateSettings()` (set from the settings page and, for "Later" on the dock's one-time offer, the service worker) → `autoRead` (local), which replaced D64's `autoCaptureEnabled` (migrated once by `migrateLegacy()`, then removed) — since 10-15 it also holds the one-time consent, the sites chosen with Always read here, and which job host's form a site embeds (an origin and a site name, never a path);
`tabBinding.js` `bindTab()` → `bind:{tabId}` (session), removed by `clearBinding()` on tab close and "Unlink this page";
`progress.js` `progress.patch()` / `set()` / `claim()` → `jobProgress` (local), removed by `progress.clearAll()` from `auth.js` `disconnect()` and `getIdentity()` (sign-out, another account);
⭐ T17: `dockHost.js` `saveDockPlace()` (its one write, `writeDockPlaces()`, from the dock's `DOCK_PLACE` message — a page's top frame only) → `dockPlace` (local), the 50 most recent sites, 30 days.)*

**Host permission** — one, our own backend
> `https://jobsviadraft.com/*` is our own server. The extension calls it with an access token of its
> own, obtained once when the user connects the extension. The browser's session cookie is deliberately
> NOT sent (`credentials: 'omit'` on every call but the one that obtains the token), so the extension
> acts as the one account the user connected, not as whatever session the browser holds.

**Optional host permissions** — the preset job hosts, and `https://*/*` for "Always read here"; each requested only
from the user's click, never at install
> `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`,
> `apply.workable.com` — the public posting pages of the job boards our service reads — and
> `*.myworkdayjobs.com` and `*.myworkdaysite.com`, where Workday serves employers' postings and
> application forms. Requested at runtime with `chrome.permissions.request` when the user switches that
> site on in the options page (after the in-extension disclosure and "I agree"), and removed when they
> switch it off or press the kill switch. With them, and only for the switches the user turned on: a
> posting is captured to the user's own account (a page that is not a posting sends nothing), an
> application page's structure is read locally, answers are prepared for a tab linked to the user's own
> job, and the form is filled for the user to review and submit. ⛔ Never `<all_urls>`, never at install,
> never LinkedIn, Indeed or Glassdoor.
>
> **The preset set, in one prompt.** The extension's settings page (*Read application pages automatically*) shows a
> one-time card that explains, in plain words, what automatic reading reads and sends; its "Allow on these sites"
> button requests every preset host above
> plus `jobs.smartrecruiters.com` in ONE `chrome.permissions.request`. Granted, Read and Prepare turn on there;
> Capture and Fill stay separate switches, off. A refusal leaves everything off. (On a page, draft's panel may
> offer this; its button only opens the settings page — a web page cannot request a permission, so every
> `chrome.permissions.request` is made on the settings page, inside the user's click.)
>
> **`https://*/*` — "Always read here".** Employers' careers sites are on their own domains, and Chrome can only
> request an origin the manifest lists as optional. The pattern is NEVER requested itself and grants nothing at
> install: on a page that looks like a job or an application, draft's panel offers "Always read here", which opens
> the settings page for that tab's site; the "Always read here" switch there requests
> ONE origin (`https://<that site>/*`) — plus the job host whose frame holds that site's application form, when
> the extension already knows it — from the user's click, after the same disclosure. Removing the site in the
> options page, turning its last switch off or pressing the kill switch gives it back. Never LinkedIn, Indeed or
> Glassdoor. Every other site stays reachable only through `activeTab`.

| Host | Why |
|---|---|
| `https://jobsviadraft.com/*` | Our own backend: capture, the auth probe, the handoff packet, the board check |
| five posting hosts + Workday's two + SmartRecruiters (optional) | Automatic reading — Read · Prepare · Capture · Fill — only for the sites and switches the user turns on |
| `https://*/*` (optional) | "Always read here": ONE origin requested from the user's click; never requested itself, never at install |

Full derivation, including every permission deliberately **not** requested and why, is in
`extension/MANIFEST_RATIONALE.md`; `test/manifestMinimumPermission.test.js` fails the build if that file
and the manifest disagree.

---

## Data usage disclosures

These are the answers for the **Privacy practices** tab.

- **Personally identifiable information** — **collected and transmitted.** Two distinct flows:
  1. *Capture and ATS scoring.* Job postings the user captures (by hand or automatically) are stored in
     **their own Draft account**, an identified account — so this is declared as collection of
     personally identifiable information, though the posting text is employer-authored.
  2. *The handoff.* The extension fetches, from the user's own Draft account, the details they saved
     there — name, email, phone, postal address, work-authorization and self-identification answers —
     and enters them into the application form the user opened, or lists them on the Copy sheet. This
     is the user's own data, sent to the employer's form at their instruction; it is never sent to any
     third party other than that form.
- **Website content** — **collected, in these cases:**
  1. The text of a job posting the user captures, sent to their account.
  2. *Automatic capture, when switched on:* the address and text of a page on a granted host the user switched
     Capture on for **that is a job posting** — kept only if it fits the user's board, otherwise
     discarded without being stored. Nothing is sent for any other page.
  3. *(Removed with T22, 10-15: the popup's Score tile, which passed a job page's visible text to the ATS Score
     page in that page's URL, is gone — draft's own report for the job is shown in the extension's on-page panel.
     The privacy policy says so.)*
  4. The tab's address when the user presses the toolbar icon on that page (signed in), and the application page's full
     address on a fill, Prepare, the Copy sheet and **I submitted it** — used to match the page to the
     application; kept only on **I submitted it**, as evidence on the application record.
  5. The address of a link the user saves with **Save link to draft** — the link only.
  6. On **Report this form** → **Send the report**: the form page's host name (never its path or query) and its
     field labels — never values. Linked to the user's account, deleted after 30 days.
  7. *Optional and off by default:* the **structure** of an application form (labels, types, required
     flags, option lists — never values), to recognise the same form for other users. A per-account
     setting, enforced on our server.
- **Authentication information** — *not collected.* The extension never reads, stores or transmits any
  portal's session cookie, password or token. It cannot sign the user in and does not try. It holds no
  `cookies` permission.
- **Web history** — *not collected.* The extension reads the address only of a tab the user invoked it
  on, or — with automatic reading on — of a page on a site the user switched on and granted, and sends it
  only for a posting, or for preparing a tab already linked to the user's own job. It holds no `tabs`, `history` or `webNavigation` permission.
- **User activity** — *not collected.* No clickstream, no analytics, no telemetry.
- **Health / financial / personal communications / location** — *not collected.*

Certifications — tick all four:
- Not being sold to third parties.
- Not being used or transferred for purposes unrelated to the item's single purpose.
- Not being used or transferred to determine creditworthiness or for lending purposes.
- ⭐ **I certify that this item's use of user data complies with the Chrome Web Store User Data Policy,
  including the Limited Use requirements.** (D68: the privacy policy carries the same affirmation, in
  *How We Use Your Data*.)

Privacy policy URL: `https://jobsviadraft.com/privacy` (set in the Developer Dashboard's privacy policy field — ⭐ 46o: it is not a manifest key, and `manifest.json` no longer carries it).

---

## ⭐ The dashboard, field by field — paste-ready (checked 2026-10-09, release check A3)

In the order the developer dashboard asks. ⛔ The owner pastes, ticks and uploads — never an agent.
⚠ = the dashboard's exact wording or requirement was not verifiable from this repository.

**Package**
1. **Upload** `extension/submission/resume-master-extension-v1.5.2.zip` — 443,430 bytes, SHA-256
   `d4a50579482a42d89747d53d34da95a537a0f7bbadab35e2d96e902c1bc2eb08` (built 2026-10-25 15:16 with T31, byte-identical
   to `extension/` per `test/extensionSubmission.test.js`, measured 10-25). ⛔ Not the v1.5.0 zip this line named
   until 10-25 — that is the pre-T31 build. The version must be higher than anything in review.

**Store listing tab**
2. **Description** — the summary is *Description* above (it is the manifest's). The detailed description is
   *What the extension does, end to end* above, which names automatic capture (off by default).
3. **Category** — ⏸ the owner picks. Suggested: *Productivity → Workflow & Planning* (⚠ the list's current names).
4. **Language** — English.
5. **Store icon** — 128×128: `extension/icons/icon128.png` (uploaded separately from the zip; the package does not carry the listing icon).
6. **Screenshots** — 1280×800 PNG: `docs/store-screenshots/1-review-overlay.png`, `2-dock.png`, `3-options.png`.
   ✅ **Regenerated 2026-10-25 for T31** (`npm run store:screenshots`, ALL PASS, the synthetic Ada Lovelace fixture) —
   the review in the dock's Fill view over the gated form; **`2-dock.png` replaces `2-popup.png`**: the dock the
   toolbar press opens on a posting, asking "Add this job to draft?" [Capture] [Draft]; and the settings page. ⛔ In
   the dashboard, **delete the old popup screenshot** and upload all three.
7. **Small promo tile** — 440×280: **none in the repository.** ⚠ Check whether the dashboard requires it.
8. **Marquee promo tile** — 1400×560, optional: none.
9. **Official URL / homepage** — `https://jobsviadraft.com`.
10. **Support URL** — `https://jobsviadraft.com/contact` · **support email** `support@jobsviadraft.com` (routed by Cloudflare Email Routing, 10-09).

**Privacy practices tab**
11. **Single purpose** — *Single purpose* above.
12. **Permission justifications** — *Permission justifications* above: `activeTab`, `contextMenus`, `scripting`,
    `storage`, the host permission `https://jobsviadraft.com/*`, and the optional hosts (the presets and `https://*/*`).
13. **Remote code** — **"No, I am not using remote code."** Justification if asked: every script is in the package;
    the manifest's CSP is `script-src 'self'; object-src 'self'`; `chrome.scripting.executeScript` runs only
    packaged functions (`func:`), never a string or a fetched file; there is no `eval` or `new Function`.
14. **Data usage** — *Data usage disclosures* above.
15. **Certifications** — the four above. ⛔ **The owner certifies**, including Limited Use.
16. **Privacy policy URL** — `https://jobsviadraft.com/privacy` (dated October 9, 2026 once pushed).

**Distribution tab**
17. **Visibility** — ⏸ the owner: v1.0.0 is published *unlisted*; keep unlisted or go public.
18. **Regions** — ⏸ the owner (the board is US-only, D78).

**Account**
19. **Trader declaration** (EU) — ⏸ **the owner decides**: a *trader* must show a verified address and contact
    publicly on the listing; a *non-trader* declaration is for non-commercial publishers. This is a personal
    and legal call, not engineering — decided outside this repository.

**Test instructions**
20. *Test instructions* below — with a reviewer account the owner creates. Never commit its credentials.

---

## Reviewer notes

> The extension never submits an application on its own. It fills the form and shows a review panel; the user
> presses the employer's own submit button — or, where the employer's site flags submissions sent from draft's servers
> (v1.7.0), the panel's **Submit application**: that one press by the user (a trusted click, after every required field is
> filled) clicks the form's submit button in their own browser, and the confirmation page is the record. No timer, page
> script or batch step ever sends.
>
> It never crosses a sign-in or a CAPTCHA. The user authenticates on a portal themselves; only then can
> they invoke the extension there, and that invocation is what grants access to that one tab. The
> extension holds no host permission at install for any employer portal; Workday's public hosts are
> optional and granted only if the user switches Workday on for automatic reading.
>
> There is no toolbar popup: pressing the toolbar icon opens draft's panel on the page and, signed in, reads that
> page in the same press (its address goes to our server); pressing it again closes the panel and reads nothing.
>
> The only behaviour without a click is **automatic reading**, which is OFF until the user agrees — on the settings
> page, in its one-time card (one Chrome prompt for the preset job hosts) or a site's own switch — at which point
> Chrome asks them to grant those hosts. Every permission prompt is asked from the settings page.
> **Always read here** adds one company careers site at a time, from a click there (the
> optional `https://*/*` exists only so that one origin can be requested; it is never requested itself). Four switches per site (Read · Prepare · Capture · Fill), each off. Capture
> sends a page only when the page is a job posting; Fill may press Save and Continue but never submits on its own (only the user's press of Submit application does);
> a kill switch turns everything off.
>
> A résumé is generated on the page only when the user presses Generate in the résumé panel; the
> extension asks our server, which does the work — the extension never calls a model or any other
> service. An answer is sent to the user's own Saved answers only when they acknowledge it in the review
> panel or type it with "Remember for next time" ticked.
>
> Before releasing anything into a page, it checks that the page is one of that application's own
> addresses and, where the address names a job, that it is the same job. On a mismatch it releases
> nothing.
>
> No remotely hosted code. Everything executed ships in the package: no `eval`, no `new Function`, no
> `importScripts`, no remote `<script src>`. The CSP in the manifest is `script-src 'self'`.
>
> `externally_connectable` is deliberately absent. No website can message this extension — except draft's own site
> (jobsviadraft.com), through one small declared content script, which can ask it to open a job from your board: it
> sends a job id only, and the extension checks with draft's server before it opens the address the server returns.

---

## Test instructions — ⛔ OWNER: still required, still not in this file

Every behaviour begins with a signed-in account; a reviewer who cannot sign in sees "Sign in to Draft"
and nothing else. ⛔ **Create a reviewer account on `https://jobsviadraft.com`** (not the owner's, not
`admin`), give it a completed profile with SYNTHETIC details, and paste its credentials into the
dashboard's **Test instructions** field with the steps below. ⛔ Never commit them here.

> Sign in at https://jobsviadraft.com with the account above. Then:
>
> **The toolbar icon:** there is no popup. Press the toolbar icon on a Greenhouse application page: draft's panel
> (the dock) opens on the page and that one press reads it; the panel shows only what the page needs — for a
> posting, "Add this job to draft?" with Capture and Draft; with answers prepared, Fill. Press the icon again and
> the panel closes to its launcher. The panel's gear opens Settings (account, permissions, automatic reading).
>
> **Capture:** open any job posting and press Ctrl+Shift+K, or press the toolbar icon → **Capture**. The posting
> appears on the account's board.
>
> **Automatic reading:** open Settings (the panel's gear, or the extension's options) → **Read application pages
> automatically** → **Allow on these sites** → grant; Read and Prepare are now on for Greenhouse there. Open an
> application form on job-boards.greenhouse.io: it is read without a press. On a company careers page (for example
> one embedding a Greenhouse form), press the toolbar icon: the panel offers to read that site automatically —
> **Set up** opens Settings for that site, where **Always read here** asks Chrome for that one site. **Capture:** in Settings, switch on Capture for Lever or Greenhouse and grant
> the site. Open a posting on jobs.lever.co or job-boards.greenhouse.io; it is added without a click if it fits the
> board.
>
> **Résumé on the page:** on an application form linked to a job (Fill or Prepare it first), press the toolbar
> icon → the panel's **Résumé** tab → Generate. Preview it, then Attach.
>
> **Fill:** from the board, Draft a job and start the application. Sign in to the employer's site if
> it asks, then press Ctrl+Shift+Y on the form. The answers appear with a review panel. **The extension
> does not submit on its own** — on a site that flags draft's servers, the panel's Submit application sends it when the user presses it.

---

## Pre-submission checklist

- [ ] `npm run build:extension` — regenerates the zip and fails on a flipped dev switch
- [ ] `npm test` — `extensionSubmission.test.js` proves the zip is byte-identical to `extension/`;
      `manifestMinimumPermission.test.js` proves every permission is justified
- [ ] `node scripts/e3PermissionAudit.mjs` — removes each declared permission in a real Chrome
- [ ] ⛔ Confirm `https://jobsviadraft.com/privacy` serves the policy dated with this release
      (grep the deployed bundle — the URL returns an SPA shell). **Push before upload.**
- [ ] ⛔ Confirm the reviewer account signs in on `https://jobsviadraft.com`
- [ ] Read `PRIVACY_RECONCILIATION.md` — every row complete
- [ ] Paste: single purpose · every permission justification (`activeTab`, `contextMenus`, `scripting`,
      `storage`, the host permission, **the optional host permissions**) · the Privacy practices tab ·
      the four certifications, **including Limited Use**
- [x] Regenerate the store screenshots (`npm run store:screenshots`) — ✅ 10-25 (T31): `2-popup.png` became
      `2-dock.png`, the dock and its question; replace the popup image in the dashboard
- [ ] Upload `resume-master-extension-v1.5.2.zip` — the dashboard's version must be higher than any in review

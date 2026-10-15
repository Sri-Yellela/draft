# Chrome Web Store listing — draft v1.5.2

> **v1.5.2, folded further (2026-10-15, T17 — still v1.5.2, NOT yet uploaded).** ⛔ **Re-paste at the next upload: the
> `storage` justification (now TEN values) and the reviewer notes.** What changed: everything the extension shows on a
> page — the review panel, the ATS report, the résumé, the Copy sheet and the one-line status — now sits in ONE panel
> (the dock) in the page's TOP frame only, never inside an embedded form's iframe; it can be dragged, resized, snapped
> to an edge, collapsed, and any of its four tabs opened in its own floating window. Where it sits is remembered per
> site (`dockPlace`, local storage: the site's origin and the panel's position and size — nothing of the page). The
> panels are drawn in the account's theme (all four). No permission changed.

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
   session — one of the eight stored values, and the only one transmitted (to our backend only).
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
   Continue but **never submits**, never ticks a terms, consent, attestation or signature box, and never
   saves the form's structure for other users. A kill switch turns all of it off and gives every host
   back. Never LinkedIn, Indeed or Glassdoor.
   ⭐ **Since 10-15:** a one-time card in the popup turns Read and Prepare on for the preset hosts (SmartRecruiters'
   `jobs.smartrecruiters.com` among them) with ONE Chrome prompt, and **Always read here** asks for one company
   careers origin from a click (under the optional `https://*/*`).
7. **NEW · `contextMenus`** — right-click **Save this page to draft** and **Save link to draft**.
8. **NEW · Report this form** — the form page's host and field labels (never values), on two clicks.
9. **The popup** leads with the posting as a job card (logo, company, the ATS score for the user's
   résumé), shows what a fill will use before it runs, and offers **Prepare this application** and
   **I submitted it** on a form; the **Copy sheet** lists the user's own prepared answers to copy by hand.
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

The popup's other controls (Score, Open draft, Copy sheet, Report form, More → the options page with
keyboard shortcuts, Sign in with LinkedIn and the automatic-capture switch) are not separate features:
they open a page of the user's own Draft account or the extension's own options page, or they serve
the application in front of the user.

---

## Description (matches `manifest.json` byte for byte)

> Capture the job you're viewing, and fill the application you signed in to reach. You review every
> answer and submit it yourself.

---

## What the extension does, end to end

| Trigger | What happens |
|---|---|
| Toolbar → **Read this page** (or R) | Reads the posting in view locally and asks our server whether it is on the user's board — the tab's address, in the request body. Shows the job card. Nothing is read before this press. |
| Toolbar → **Capture it** / **Ctrl+Shift+K** / right-click **Save this page to draft** | **One capture implementation**: reads the job description on the page in view and sends it to the user's Draft account. Works on any job posting, including employers' own careers pages. |
| Right-click **Save link to draft** | Sends only the link's address; our server reads the posting from the job board's own listing, or refuses the link and saves nothing. |
| **Automatic capture** (off by default; options page) | Only on a granted host the user switched Capture on for (a preset job host, or a site chosen with Always read here): a page that is a posting is sent to the user's account; our server keeps it only if it fits their board. A non-posting sends nothing. |
| **Automatic reading** (after the popup's one-time card, or Always read here) | On an allowed site: an application page's question labels and counts are read and kept on this computer (nothing sent); on a tab linked to the user's own job, the answers are prepared on our server (the page's address is sent). |
| **Fill it** / **Ctrl+Shift+Y** on an application form | The gated handoff: fetches the answers the user already saved, checks this page is that application's, fills the form and shows a review panel. The user submits. |
| **Prepare this application** | For a job of the user's with nothing prepared: builds the answers on demand, then the same handoff. |
| **I submitted it** | Records the application against the page in view (its address is the evidence). |
| **Copy sheet** | Lists the user's own prepared answers in the popup, each with a copy button. Writes nothing into the page. |
| **Report form** → **Send report** | Shows first, then sends: the form page's host and its field labels — never values. |
| **Score** | Collects the visible text of the page in view and opens the user's ATS Score page with it prefilled. |
| **Open draft** · More → **Sign in with LinkedIn** | Opens a Draft page in a new tab. Reads nothing. |
| More → options page | Keyboard shortcuts (both commands, as bound), Sign in with LinkedIn, the automatic-capture switch. |

### Which sites it works on

**Any job posting the user invokes it on.** The extension holds no permission for any site in advance
except our own backend; it reads the tab the user invoked it on. Automatic reading additionally works
on the preset hosts (five public posting hosts, Workday's two public hosts and SmartRecruiters') — and only
on those the user allows — and, with **Always read here**, on a company careers site the user chose, one
origin at a time.

---

## Permission justifications

**`activeTab`**
> Granted only when the user explicitly invokes the extension — clicking the toolbar button, a
> right-click menu item, or pressing one of the two keyboard shortcuts. It is used to read the job
> posting on the page the user is viewing and to fill the application form on a page they have opened
> and signed in to themselves. The extension holds no install-time permission for any job site or
> employer portal, so it reaches such a page only through that per-tab, per-invocation grant.

*(Code: `background.js` `chrome.commands.onCommand`, `chrome.contextMenus.onClicked` and the popup's
messages, each calling `chrome.tabs.query({active: true, currentWindow: true})` inside a user-gesture
handler; `captureActiveTab()`, `previewActiveTab()` and `handleGatedHandoff()` are reached only from there.)*

**`contextMenus`**
> Adds two items to the right-click menu. **Save this page to draft** runs the same capture as the
> toolbar button, on the page the user right-clicked. **Save link to draft** sends only the address of
> the link the user right-clicked to our backend, which reads that posting from the job board's own
> listing — or refuses the link and saves nothing if it is not a posting on a board we read directly.
> Neither item reads anything until the user picks it, and the permission grants no access to any page.

*(Code: `background.js` `chrome.contextMenus.onClicked` → `captureActiveTab()` / `saveLinkToDraft()`;
the items are `formReport.js` `CONTEXT_MENUS`.)*

**`scripting`**
> Injects a one-off script into a tab to (a) read the job posting the user is capturing, (b) collect
> the visible text when the user asks for an ATS score, (c) fill the application form and render the
> review panel on a handoff, and (d) when automatic reading is on for a site, register a small watcher
> script on that site only (`chrome.scripting.registerContentScripts`) that notices a new application
> step and reads no values, check a page there for JobPosting structured data, and run the switched-on
> steps. The manifest declares no content script; the watcher is registered only for hosts the user
> switched on and granted, and unregistered when they switch it off.

*(Code: `background.js` `captureActiveTab()` / `reportCapture()` injecting `extractor.js`
`extractJobPayload()` and `showCaptureToast()`; the automatic path, `autoReadWatcher.js` (the watcher) →
`autoRead.js` `syncRegistrations()` / `runAutoPass()` / `autoStep()` / `pageHasJobPosting()`; `gated-handoff.js` `probeFormShape()`,
`applyPlan()`, `applyOverlayEdit()`; `review-overlay.js` `renderOverlay()`; `autofill-badge.js`.)*

**`storage`**
> Ten values. Nine never leave the browser; the tenth is the extension's own access token, which is
> sent to our backend and to nowhere else. In `chrome.storage.local`: the result of the user's most
> recent capture, so the popup can show the outcome of a capture made with the keyboard while the popup
> was closed; the username of the account the extension is connected to, so the popup can name it; that
> access token, which is how the extension identifies itself to us — not the user's password and not
> their website session, deleted the moment they disconnect the extension; the automatic-reading settings
> (which of Read, Prepare, Capture and Fill the user switched on for each site, when they agreed to the
> disclosure, and — while Read is on — the question labels, never answers, and field counts of pages read,
> 30 days); and where each application stands — for each job the user captures, reads, prepares, fills or
> submits with the extension, its draft id, title, company and posting address, when each step happened,
> how many fields were filled or still need the user, and the id and status of a résumé generated for it —
> no answers and no résumé content, kept 30 days from its last change, deleted on disconnect, sign-out or
> another account connecting; and where the extension's on-page panel sits on each site the user used it on —
> the site's origin (never a path) and the panel's position, size, snapped edge, collapsed state, tab and which
> tabs are in their own windows — nothing of the page, the 50 most recent sites, each kept 30 days.
> In `chrome.storage.session` (memory-backed,
> discarded on browser restart): the prepared answers for an application in progress, with a 10-minute
> expiry and cleared when the tab closes; the result of the most recent form fill, so the popup can
> report a fill started with the keyboard; when several applications are queued for one employer
> site, that site's origin and how many remain, so a batch can resume in the same tab — no answers and
> nothing about the user in that one; and which job a tab is on (the job's draft id, title and company, and
> when it was linked) once the user captures a job there or draft recognises
> the posting, so the later pages of that application are known to be the same job — no answers, never
> shared between tabs, deleted when the tab closes, shows a different job, or the user unlinks it.

*(Code: `background.js` `reportCapture()` → `lastCapture` (local) and `reportHandoff()` →
`lastGatedHandoff` (session); `gated-handoff.js` → `gate:{tabId}` and `batch:{tabId}` (session);
`auth.js` → `authToken` and `authIdentity` (local); `autoRead.js` `updateSettings()` (set from the options page and the popup) → `autoRead` (local), which replaced D64's `autoCaptureEnabled` (migrated once by `migrateLegacy()`, then removed) — since 10-15 it also holds the one-time consent, the sites chosen with Always read here, and which job host's form a site embeds (an origin and a site name, never a path);
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
> **The preset set, in one prompt.** The extension's popup shows a one-time card that explains, in plain words,
> what automatic reading reads and sends; its "Allow on these sites" button requests every preset host above
> plus `jobs.smartrecruiters.com` in ONE `chrome.permissions.request`. Granted, Read and Prepare turn on there;
> Capture and Fill stay separate switches, off. A refusal leaves everything off.
>
> **`https://*/*` — "Always read here".** Employers' careers sites are on their own domains, and Chrome can only
> request an origin the manifest lists as optional. The pattern is NEVER requested itself and grants nothing at
> install: the popup's "Always read here" switch, shown on a page that looks like a job or an application, requests
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
  3. The visible text of a job page when the user clicks **Score**, passed to their ATS Score page. It
     travels in the URL of the page that opens, so it can appear in ordinary server logs (stated in the
     privacy policy).
  4. The tab's address when the user presses **Read this page**, and the application page's full
     address on a fill, Prepare, the Copy sheet and **I submitted it** — used to match the page to the
     application; kept only on **I submitted it**, as evidence on the application record.
  5. The address of a link the user saves with **Save link to draft** — the link only.
  6. On **Report form** → **Send report**: the form page's host name (never its path or query) and its
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

Privacy policy URL: `https://jobsviadraft.com/privacy` (set in `manifest.json`).

---

## ⭐ The dashboard, field by field — paste-ready (checked 2026-10-09, release check A3)

In the order the developer dashboard asks. ⛔ The owner pastes, ticks and uploads — never an agent.
⚠ = the dashboard's exact wording or requirement was not verifiable from this repository.

**Package**
1. **Upload** `extension/submission/resume-master-extension-v1.5.0.zip` — 193,616 bytes, SHA-256
   `0e7c6c4efa8eedc3967c17bd7ed3d3ff93efcfefff32bbf79b7f3011faad5bd2` (built 2026-10-08 19:33, byte-identical
   to `extension/` per `test/extensionSubmission.test.js`). The version must be higher than anything in review.

**Store listing tab**
2. **Description** — the summary is *Description* above (it is the manifest's). The detailed description is
   *What the extension does, end to end* above, which names automatic capture (off by default).
3. **Category** — ⏸ the owner picks. Suggested: *Productivity → Workflow & Planning* (⚠ the list's current names).
4. **Language** — English.
5. **Store icon** — 128×128: `extension/icons/icon128.png` (uploaded separately from the zip; the package does not carry the listing icon).
6. **Screenshots** — 1280×800 PNG: `docs/store-screenshots/1-review-overlay.png`, `2-popup.png`, `3-options.png`.
   ✅ **Regenerated 2026-10-09** (`npm run store:screenshots`, ALL PASS, the synthetic Ada Lovelace fixture) — they show
   the D63 popup, overlay and options page.
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

> The extension never submits an application. It fills the form and shows a review panel; the user
> presses the employer's own submit button.
>
> It never crosses a sign-in or a CAPTCHA. The user authenticates on a portal themselves; only then can
> they invoke the extension there, and that invocation is what grants access to that one tab. The
> extension holds no host permission at install for any employer portal; Workday's public hosts are
> optional and granted only if the user switches Workday on for automatic reading.
>
> The only behaviour without a click is **automatic reading**, which is OFF until the user agrees — in the popup's
> one-time card (one Chrome prompt for the preset job hosts) or in the options page — at which point Chrome asks
> them to grant those hosts. **Always read here** adds one company careers site at a time, from a click (the
> optional `https://*/*` exists only so that one origin can be requested; it is never requested itself). Four switches per site (Read · Prepare · Capture · Fill), each off. Capture
> sends a page only when the page is a job posting; Fill may press Save and Continue but never submits;
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
> **Capture:** open any job posting and press Ctrl+Shift+K, or click the toolbar button → Read this
> page → Capture it. The posting appears on the account's board.
>
> **Automatic reading:** open the toolbar popup — the card "Let draft read job pages for you" → **Allow on these
> sites** → grant. Open an application form on job-boards.greenhouse.io: the popup now says "Reading automatically on
> this site". On a company careers page (for example one embedding a Greenhouse form), switch on **Always read here**
> and grant that one site. **Capture:** in the extension's options, switch
> on Capture for Lever or Greenhouse and grant the site. Open a posting on jobs.lever.co or
> job-boards.greenhouse.io; it is added without a click if it fits the board.
>
> **Résumé on the page:** on an application form linked to a job (Fill or Prepare it first), open the
> popup → "Résumé for this job" → Generate. Preview it, then Attach.
>
> **Fill:** from the board, Draft a job and start the application. Sign in to the employer's site if
> it asks, then press Ctrl+Shift+Y on the form. The answers appear with a review panel. **The extension
> does not submit.**

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
- [ ] Regenerate the store screenshots (`npm run store:screenshots`) — the popup, badge and overlay changed (D63)
- [ ] Upload `resume-master-extension-v1.5.0.zip` — the dashboard's version must be higher than any in review

# Chrome Web Store listing — draft v1.5.0

Copy for the Web Store developer dashboard, **written fresh for v1.5.0 on 2026-10-07** (release
finalisation, after D60–D69). Every justification below was written against the actual code and cites
the file that uses the permission, because the dashboard rejects justifications that don't match
observable behaviour. ⛔ **Re-paste every field** — single purpose, every permission justification
(three changed or are new), the storage field and the whole Privacy practices tab. The previous text
in the dashboard describes a build that no longer exists.

Upload artifact: `extension/submission/resume-master-extension-v1.5.0.zip`
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
   session — one of the seven stored values, and the only one transmitted (to our backend only).
5. **No content script, no job-board host permission at install.** v1.0.0 declared six job boards and
   ran a content script on them; that is gone. Every read starts at a click or a keystroke —
   **except automatic capture (item 6), which is off until the user switches it on.**
6. **NEW · Automatic capture (opt-in, off by default).** Switching it on in the extension's options asks
   Chrome, at that click, for `optional_host_permissions` on **five public job-posting hosts only**
   (`boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`,
   `apply.workable.com`). With it on, a page on those hosts that **is a job posting** (its URL has a
   posting's shape, or it carries JobPosting structured data) is sent to the user's account, where our
   server decides whether it fits their board — and **discards an irrelevant posting without storing
   it**. A page that is not a posting sends **nothing** — not its address, not a hash. Switching it off
   removes the host access. It never fills or submits anything.
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
> for — and, when they invoke the extension on an application form they have opened and signed in to
> themselves, fill it with answers they have already given us, for them to review and submit.

Capture (manual or automatic) and fill are the same purpose at two points in one flow: the user finds a
job, and the user applies to it. Automatic capture is the same capture without the click, on five
public job-posting sites the user has granted, and only for pages that are postings. Nothing is ever
submitted by the extension.

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
| **Automatic capture** (off by default; options page) | On the five granted posting hosts only: a page that is a posting is sent to the user's account; our server keeps it only if it fits their board. A non-posting sends nothing. |
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
except our own backend; it reads the tab the user invoked it on. Automatic capture additionally works
on the five public posting hosts — and only after the user grants them.

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
> review panel on a handoff, and (d) when automatic capture is on, check a page on one of the five
> granted posting hosts for JobPosting structured data. The extension declares no content script; the
> automatic check runs only on the hosts the user granted, only while the switch is on.

*(Code: `background.js` `captureActiveTab()` / `reportCapture()` injecting `extractor.js`
`extractJobPayload()` and `showCaptureToast()`; the automatic path `chrome.tabs.onUpdated` →
`autoCapture.js` `autoCaptureStep()` / `pageHasJobPosting()`; `gated-handoff.js` `probeFormShape()`,
`applyPlan()`, `applyOverlayEdit()`; `review-overlay.js` `renderOverlay()`; `autofill-badge.js`.)*

**`storage`**
> Seven values. Six never leave the browser; the seventh is the extension's own access token, which is
> sent to our backend and to nowhere else. In `chrome.storage.local`: the result of the user's most
> recent capture, so the popup can show the outcome of a capture made with the keyboard while the popup
> was closed; the username of the account the extension is connected to, so the popup can name it; that
> access token, which is how the extension identifies itself to us — not the user's password and not
> their website session, deleted the moment they disconnect the extension; and whether the user has
> switched automatic capture on (a single on/off value). In `chrome.storage.session` (memory-backed,
> discarded on browser restart): the prepared answers for an application in progress, with a 10-minute
> expiry and cleared when the tab closes; the result of the most recent form fill, so the popup can
> report a fill started with the keyboard; and, when several applications are queued for one employer
> site, that site's origin and how many remain, so a batch can resume in the same tab — no answers and
> nothing about the user in that one.

*(Code: `background.js` `reportCapture()` → `lastCapture` (local) and `reportHandoff()` →
`lastGatedHandoff` (session); `gated-handoff.js` → `gate:{tabId}` and `batch:{tabId}` (session);
`auth.js` → `authToken` and `authIdentity` (local); `autoCapture.js` (set from the options page) → `autoCaptureEnabled` (local).)*

**Host permission** — one, our own backend
> `https://jobsviadraft.com/*` is our own server. The extension calls it with an access token of its
> own, obtained once when the user connects the extension. The browser's session cookie is deliberately
> NOT sent (`credentials: 'omit'` on every call but the one that obtains the token), so the extension
> acts as the one account the user connected, not as whatever session the browser holds.

**Optional host permissions** — five public job-posting hosts, requested only when the user switches
automatic capture on
> `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`,
> `apply.workable.com` — the public posting pages of the job boards our service reads. Requested at
> runtime with `chrome.permissions.request` when the user turns on **Capture job pages automatically**
> in the options page, and removed when they turn it off. With them, a page on these hosts that is a
> job posting is sent to the user's account without a click; a page that is not a posting sends
> nothing. ⛔ Never `<all_urls>`, never at install, and never a site where the user signs in: employer
> portals stay reachable only through `activeTab`.

| Host | Why |
|---|---|
| `https://jobsviadraft.com/*` | Our own backend: capture, the auth probe, the handoff packet, the board check |
| five posting hosts (optional) | Automatic capture, only when the user switches it on |

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
  2. *Automatic capture, when switched on:* the address and text of a page on one of the five granted
     posting hosts **that is a job posting** — kept only if it fits the user's board, otherwise
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
  on, or — with automatic capture on — of a page on the five granted hosts, and sends it only for a
  posting. It holds no `tabs`, `history` or `webNavigation` permission.
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

## Reviewer notes

> The extension never submits an application. It fills the form and shows a review panel; the user
> presses the employer's own submit button.
>
> It never crosses a sign-in or a CAPTCHA. The user authenticates on a portal themselves; only then can
> they invoke the extension there, and that invocation is what grants access to that one tab. The
> extension holds no host permission for any employer portal.
>
> The only behaviour without a click is **automatic capture**, which is OFF until the user switches it
> on in the options page — at which point Chrome asks them to grant five public job-posting hosts. It
> sends a page only when the page is a job posting, and never fills or submits.
>
> Before releasing anything into a page, it checks that the page is one of that application's own
> addresses and, where the address names a job, that it is the same job. On a mismatch it releases
> nothing.
>
> No remotely hosted code. Everything executed ships in the package: no `eval`, no `new Function`, no
> `importScripts`, no remote `<script src>`. The CSP in the manifest is `script-src 'self'`.
>
> `externally_connectable` is deliberately absent. No website can message this extension.

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
> **Automatic capture:** in the extension's options, switch on "Capture job pages automatically" and
> grant the five sites. Open a posting on jobs.lever.co or job-boards.greenhouse.io; it is added
> without a click if it fits the board.
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

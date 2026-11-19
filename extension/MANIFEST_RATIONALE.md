# Manifest rationale — why each declared thing is declared

Every entry in `manifest.json` justified against the code that requires it, at v1.0.0.

**Why this is a file and not comments in the manifest.** Chrome tolerates `//` comments in
`manifest.json`, but `scripts/buildExtension.mjs`, `scripts/publishExtension.mjs` and two test files
all `JSON.parse` it, and the Web Store's own validator is not something to gamble on for a first
submission under the 2026-08-01 rules. The manifest stays strict JSON; the justification lives here
and is **enforced** — `test/manifestMinimumPermission.test.js` fails if a declared permission or host
has no row below, or if a row names something no longer declared. A rationale that can drift is not
a rationale.

The rule applied throughout: **if removing it breaks nothing, it is not declared.** For `storage` and
`scripting` the "what breaks" column is not reasoning — it was measured, by building the extension
without each one, loading it in a real Chrome and confirming the API namespace is gone. See
`scripts/e3PermissionAudit.mjs`.

`activeTab` is measured differently, and the difference is worth stating rather than hiding. It grants
access rather than an API, and only in response to a real user gesture that no API can mint — so a
probe that removes it and looks from inside an extension page distinguishes nothing: with `activeTab`
declared but not invoked, a tab the extension has no host permission for is exactly as invisible as it
is without the permission at all. The first version of the audit did exactly that and printed PASS;
run as a control with `activeTab` present it printed the same thing, so it was measuring nothing. The
real measurement is `scripts/g0ActiveTabSpike.mjs`, which delivers a genuine OS-level `Ctrl+Shift+Y`
to a focused Chrome running this manifest, with host permissions covering none of the test origins so
injection can only succeed through the grant. Its control trial C — navigate to another origin — shows
access **revoked**, which is the removal case. Findings: `docs/GATED_HANDOFF_ARCHITECTURE.md` §9.

---

## Permissions

| Permission | Required by | What breaks without it |
|---|---|---|
| `activeTab` | `background.js:112` (hotkey capture), `background.js:130` (gated handoff), the **toolbar press** (⭐ T31, 10-25: `background.js` `chrome.action.onClicked` → `toolbarPress.js` — the toolbar popup is retired, and the press grants it as opening the popup did); also the right-click **Save this page to draft** (a context-menu click grants it too) and the dock's **Report this form** (D55) | The gated handoff cannot reach the portal at all — there is deliberately no host permission for any portal origin, so this grant, taken per tab at the moment the user invokes the extension, is the only access that exists. Injection fails with "Cannot access contents of the page". |
| `contextMenus` | `background.js` `chrome.contextMenus.create` (in `onInstalled`, the four items in `formReport.js` `CONTEXT_MENUS`) and `chrome.contextMenus.onClicked` → `captureActiveTab()` / `saveLinkToDraft()` (D55 decision B, 10-07) / `handleGatedHandoff()` / `openDock()` (⭐ T22, 10-15: the popup's fill and score tiles left, and what they did stays one right-click away) | `chrome.contextMenus` is undefined: the right-click items **Save this page to draft**, **Save link to draft**, **Fill this application with draft** and **Show draft's ATS report** do not exist. Nothing else changes — the toolbar button and `Ctrl+Shift+K` capture as before. It adds no access: *Save this page* runs the same capture under the `activeTab` grant the click itself creates, and *Save link* reads no page at all — it sends the link's address to our server, which refetches the posting from the ATS's own listing or refuses the link. Chrome shows no install-time warning for it. |
| `scripting` | `gated-handoff.js:398,452,486,521,656` (probe, fill, overlay, edits), `dockHost.js` (the dock and its popups, top frame only), `toolbarPress.js` (the press's toggle) | `chrome.scripting` is undefined. The gated handoff cannot read a form, fill one, or render the review overlay; the dock cannot be drawn. |
| `storage` | `background.js` `reportCapture()` (`storage.local` last capture), `background.js:147,190` + `gated-handoff.js:259-308` (`storage.session` packets and batch state) | `chrome.storage` is undefined. The dock cannot remember where it sat on a site, and the handoff cannot hold a packet across an MV3 service-worker teardown. (`storage.sync` is no longer used: the custom-shortcut recorder it backed was retired with the content script, and rebinding is now Chrome's own.) |

**Not declared, deliberately:**

- `tabs` — `activeTab` already gives the extension the only tab URL it needs: the one the user just
  invoked it on. A blanket `tabs` grant would expose the URL and title of *every* open tab, which is
  the opposite of what this design is for.
- `cookies` — **not in `permissions`** (never granted at install). ⭐⭐ Since D112 item 7 (v1.6.0, owner 10-30) it is
  declared as an **optional** permission only — see *Optional permissions* below: read once, for one portal's own
  hosts, from the user's press, and sealed before it leaves the browser. Credentialed requests to draft's own server
  still carry nothing of ours (the extension's token, `credentials: 'omit'`). (The retired v0.1.0 builds declared it
  at install and never read one; they are deleted.)
- `notifications` — the handoff reports through `chrome.action`'s badge instead, so no additional
  user-facing consent prompt is requested for a status message.
- `<all_urls>` — never, in any list. ⭐ Since T12 (owner, 10-15) the OPTIONAL list ends with `https://*/*` — never
  `host_permissions`, never granted at install, never itself requested; see *Optional host permissions* below.
- **any job board or employer origin** — no longer needed at all, and that is the point. See host
  permissions.

## Optional permissions

⭐⭐ **D112 item 7 (owner 10-30: *"build both android thing and apply here when im away … we can release it when we are
ready"*; v1.6.0) — "Let draft apply here while you're away".** The attended Amazon run (D100 P5) showed Amazon's sign-in
refuses the apply worker's automated browser, so the worker can apply there only with the user's own sign-in. On a
connectable portal's page where the user is signed in (`applyAway.js` `APPLY_AWAY_FAMILIES` — today Amazon only:
`www.amazon.jobs`, `amazon.jobs`, `account.amazon.jobs`, the same family as `services/applyOrigins.js`), the dock offers
the line; pressed, a small extension window (b2's shape, `apply-away.html`) gives the reason, and its **Allow and
connect** calls `chrome.permissions.request({ permissions: ['cookies'], origins: <that family's three origins> })` as the
click's first call. Not now asks Chrome nothing. Nothing is requested at install, on load, or from any other click.

Granted, the service worker: asks draft for a per-session key the apply worker mints → **verifies its Ed25519 signature
against the worker identity pinned in `applyAway.js`** (never the identity draft's reply names; a bad signature stops
everything before a cookie is read) → reads `chrome.cookies.getAll` for **that family's origins only**, keeping only
cookies of those hosts or their parent domain → **seals them in the extension** (X25519 + HKDF-SHA256 + AES-256-GCM, bound
to user · portal · version — the scheme `apply-worker/lib/keys.js` opens) → uploads the ciphertext only
(`/api/portals/upload`). draft's server stores it and cannot open it. **Disconnect** deletes the session (the worker
destroys the key, so every stored copy becomes unreadable) and gives `cookies` back (`chrome.permissions.remove`). No
cookie is ever written or removed, and nothing is read on any other site. ⚠ Inert until the owner pins the deployed
worker's identity (`PINNED_WORKER_IDENTITY` is empty: the line is never offered). Pinned by `test/d112ApplyAway.test.js`.

| Optional permission | Required by | What breaks without it |
|---|---|---|
| `cookies` | `applyAway.js` `readFamilyCookies()` — called only by `connectAway()`, after the minted key verified, for the TAB's portal family; requested only by `apply-away.js` `onAllow` (with that family's origins) | "Let draft apply here while you're away" cannot exist on desktop: the worker cannot apply on a portal (Amazon) that refuses its own sign-in. Everything else is unchanged — the extension still fills that portal itself while the user is there. |

## Host permissions

⭐ **D191 sketch 2 (owner, 11-18: "Ask at install", then "alright go") — the six job-board families are declared
again, at install, for ONE purpose: the panel opens by itself on a posting there** (Tsenta-style; the owner's
screenshot was a Workday posting). The hosts are exactly autoRead.js `SITES`' origins (the same list stays in
`optional_host_permissions` too, so the D97 consent's `chrome.permissions.request` keeps working unchanged):
`https://boards.greenhouse.io/*`, `https://job-boards.greenhouse.io/*`, `https://jobs.lever.co/*`, `https://jobs.ashbyhq.com/*`, `https://apply.workable.com/*`, `https://*.myworkdayjobs.com/*`, `https://*.myworkdaysite.com/*`, `https://jobs.smartrecruiters.com/*`.
What the grant is used for, and nothing else: the declared content script `panelArrive.js` (below) says "a page
loaded"; `background.js` `panelArrive()` then injects the extractor and the panel into the TOP frame of a page that
is a posting (`hasPostingUrlShape()`, or on Workday the page's own JobPosting), ⛔ never an application step
(`isApplyStageUrl()`), only while the panel's "Open by itself" switch is on and the kill switch off. ⚠ This
reverses the reasoning kept below ("no portal origin in `host_permissions`"): Workday's hosts now carry standing
access to every tenant the person can reach. The owner chose it knowing Chrome's install warning; the code's limits
above are what keeps it to postings, and `test/d191OnePanel.test.js` pins them.

**Before D191 (kept for the history): there was exactly one, and it is our own server.** No job board is declared. No employer portal is
declared. Nothing the extension reads a job from is declared.

That is not a narrowing of the old list, it is a different mechanism. Capture used to run from a
CONTENT SCRIPT, which needs a host permission for every origin it runs on — so the extension could
only capture from sites the manifest named, and naming them was also what let `popup.js` read
`tab.url` to decide whether to show the button. Seven hosts bought six job boards, and no more:
a Greenhouse posting embedded on an employer's own careers domain was unreachable, and there is no
list of employer domains to add.

Capture now injects on demand under the `activeTab` grant the user's own invocation creates, which
is the same mechanism the gated handoff has always used to reach a Workday tenant it has no
permission for. The extension therefore captures from ANY job page while asking for access to NONE
of them, and it holds no standing access to any site at any time.

| Host | Required by | What breaks without it |
|---|---|---|
| `https://boards.greenhouse.io/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://job-boards.greenhouse.io/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://jobs.lever.co/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://jobs.ashbyhq.com/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://apply.workable.com/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://*.myworkdayjobs.com/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://*.myworkdaysite.com/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://jobs.smartrecruiters.com/*` | ⭐ D191: `panelArrive.js` (declared content script) → `background.js` `panelArrive()` → `pageFirstRead()` + `drawPanel()` | The panel cannot open by itself on a posting here; it opens on the person's press only (activeTab), as before 1.7.0. |
| `https://jobsviadraft.com/*` | `background.js:26` `/api/import/job`, `:76` `/api/auth/me`, `:195` `/api/apply/gate-review`, `:216` `/api/apply/gate-packets`; `gated-handoff.js:338,469`; D55: `saveLinkToDraft()` `/api/import/link`, the `REPORT_FORM` handler `/api/form-reports` | The service worker's fetches become subject to CORS. `corsOrigin` refuses `chrome-extension://` in production, so capture, the auth probe and the whole handoff fail. |

Measured, not argued: `scripts/e6PopupGrant.mjs` opens a real popup by a real invocation on an
origin with no host permission and confirms it can both read `tab.url` and inject; its control arm —
the same page opened as an ordinary tab, which is not an invocation — can do neither.
`scripts/e2CaptureConvergence.mjs` then captures from a fixture origin the manifest does not cover,
from both triggers, and asserts first that the extension cannot even see that tab until invoked.

**No portal origin is declared in `host_permissions`** — not Workday, not Amazon, not Meta. Nor any job
board. Every page the extension reads at install is reached per-tab, per-invocation, by the user's own
gesture. (Since D97, owner 10-13, Workday's two public hosts are **optional** host permissions — granted
only when the user switches Workday on in Options; see the next section.)

**`extractor.js` has a Workday entry, and that is not a contradiction.** The selector map says how to
read a page IF the user invokes capture on one; it grants nothing and is consulted only after access
already exists. Workday is also the portal the gated handoff fills, so the temptation to "make it
work properly" by adding `*.myworkdayjobs.com` to `host_permissions` is exactly the mistake to avoid:
it would convert a per-invocation grant into standing access to every tenant the user can reach.
`test/manifestMinimumPermission.test.js` fails if a workday host is ever declared there. ⭐ D97 (owner,
10-13) offers Workday as an **optional** host instead — standing access only after the user's own click
in Options, given back when they switch it off; `host_permissions` is unchanged.

## Optional host permissions (D64, 10-07; D97, 10-13; D97 REVISED + T12, 10-15)

**Nothing is granted at install, and nothing is granted except from the user's own click.** These clicks can — all
on the extension's own Settings page (Settings → Permissions' switch too, `options-permissions.js` `onAllow`) —
ask, each calling `chrome.permissions.request` as the FIRST call of its handler, inside the gesture, and Chrome
shows its own prompt naming the hosts:

1. ⭐ **Settings → "Allow on these sites"** (D97 REVISED, owner 10-14: *"read has got to be automatic, we will seek
   permissions"*; ⭐ T31, 10-25: moved from the retired toolbar popup's one-time card) — under the disclosure in plain
   words, **ONE prompt for every preset host below** (`options-auto.js` `onConsentAll`). Granted → Read and Prepare
   are on for those sites; Capture and Fill stay their own switches, off. A refusal writes nothing. The dock offers it
   only on a preset site, before any consent — and opens Settings to press it (a web page cannot ask Chrome).
2. **A switch in Settings** → *Read application pages automatically*, per site (`options-auto.js` `onSwitch`),
   after the disclosure and *I agree* — as since D97.
3. ⭐ **"Always read <site>" in Settings** (T12; ⭐ T31: moved from the retired toolbar popup) — for ONE company careers
   origin, the one the dock offered it on (the tab's own origin, carried to `options.html?here=…`), plus the ATS
   site whose frame holds its form when that is known locally (`options-auto.js` `onAlwaysHere`); a frame found
   later is allowed from Settings → Permissions.

Turning a site's last switch off, *Remove* in Settings, or *Turn off everything* calls `chrome.permissions.remove`.
Until the user clicks, the paragraph above is still true word for word: no standing access to any site.

The owner decided (10-07) that capture should happen when a posting is opened, with no click — which
`activeTab` cannot do, because it is granted only by an invocation. D97 (10-13) extended that to four
per-site switches, all off by default: **Read** (the form's labels and counts, kept on this computer),
**Prepare** (only on a tab already linked to one of the user's jobs), **Capture to my account** (D64), and
**Fill** (never submits on its own — v1.7.0's Submit application sends a form only on the user's own press, where the employer's site flags draft's servers). So the access is OPTIONAL, asked for at the moment the user opts in, per site.

⭐ **D97 REVERSES D64's "no gated portal" line for Workday only (owner, 10-13):** `*.myworkdayjobs.com`
and `*.myworkdaysite.com` are offered, because Workday changes steps without changing the address and a
watcher has to be in the page to notice. They stay out of `host_permissions`. ⭐ **SmartRecruiters' public job
host `jobs.smartrecruiters.com` is offered since 10-15** (owner, decision 2 — it reverses this paragraph's old
"not offered" for SmartRecruiters). Amazon, iCIMS, Taleo and Meta are not offered as presets. ⛔ **LinkedIn,
Indeed and Glassdoor are never offered** — not in the list, excluded from every registered content script
(`excludeMatches`), refused by "Always read here" (`customOriginFor`), and refused in code (`autoStep`).

⭐⭐ **D112 (owner 10-30, T35 = A — GLOBAL READ, v1.6.0): `https://*/*` IS NOW REQUESTED, WHOLE, ONCE.** This reverses the T12 paragraph below's "the pattern itself is never requested". The ask is ONE press with the reason shown: a small extension window over the posting (`global-ask.html`, `chrome.windows.create({ type: 'popup' })` — design call b2) — *"Let draft read job postings on any site?"* · Allow / Not now, with *"A page that is not a job posting sends nothing — not its address, not a hash."* Allow calls `chrome.permissions.request({ origins: ['https://*/*'] })` as the click's first call; Not now asks Chrome nothing; on either answer the window closes and focus returns to the posting tab. The answer is kept in the existing `autoRead` key (no new storage key), so the ask is made once. Granted, a detector is registered for every https page — it reads only the page's address, its JSON-LD tags, its iframes' addresses and the TYPE / NAME of its form controls, decides LOCALLY, and on a page that is not a job page does nothing: no message, no request, no storage write. LinkedIn, Indeed and Glassdoor are excluded (`NEVER_MATCHES`, `NEVER_HOSTS`, the same list), and so is draft's own site. **Still nothing is granted at install**: `host_permissions` is exactly draft's own server and no new permission or install warning is added (`chrome.windows` needs none). Turned off in Settings → Permissions or by *Turn off everything*, the pattern is given back (`chrome.permissions.remove`). Pinned by `test/d112GlobalRead.test.js`.

⭐ **`https://*/*` — the OPTIONAL list only (T12, owner 10-15, decision 1).** D64 and D97 said "no `<all_urls>`,
ever". **That rule is reversed for the OPTIONAL list only, and for this reason:** employers' careers sites live
on arbitrary domains (`stripe.com`, `airbnb.com`, …), often embedding an ATS's form in a frame, and Chrome can
only `permissions.request` an origin the manifest lists as optional — so without a broad optional pattern there
is no way to offer "Always read here" on a company's own site at all. What did NOT change: **nothing is granted
at install** (`host_permissions` is still exactly draft's own server, and Chrome shows no install warning for an
optional host); **the pattern itself is never requested** — every request names one origin (`https://<host>/*`),
the one the user is on, from their click, plus the ATS frame site known for it; it is given back on Remove, when
its last switch is turned off, or by *Turn off everything*. It is still never in `host_permissions`, and
`<all_urls>` is still in no list. Pinned by `test/d97rT12AlwaysRead.test.js`.

The preset list is ONE table, `extension/autoRead.js` `SITES`; the manifest's `optional_host_permissions` is that
table then `https://*/*` (`MANIFEST_OPTIONAL_HOSTS`), pinned by `test/j5AutoRead.test.js`.

| Optional host | Required by | What breaks without it |
|---|---|---|
| `https://boards.greenhouse.io/*` | `autoRead.js` — the registered watcher and `runAutoPass()` on Greenhouse, after `autoStep()` decides it may | The automatic switches do nothing on Greenhouse; manual capture and fill are unchanged. |
| `https://job-boards.greenhouse.io/*` | the same — Greenhouse's newer board host | The same, on the newer host. |
| `https://jobs.lever.co/*` | the same — Lever | The automatic switches do nothing on Lever. |
| `https://jobs.ashbyhq.com/*` | the same — Ashby | The automatic switches do nothing on Ashby. |
| `https://apply.workable.com/*` | the same — Workable | The automatic switches do nothing on Workable. |
| `https://*.myworkdayjobs.com/*` | the same — Workday's tenants (D97) | The automatic switches do nothing on Workday; Ctrl+Shift+Y and the popup still work through `activeTab`. |
| `https://*.myworkdaysite.com/*` | the same — Workday's second public host (D97) | The same, on that host. |
| `https://jobs.smartrecruiters.com/*` | the same — SmartRecruiters' public job host (owner 10-15) | The automatic switches do nothing on SmartRecruiters; manual capture and fill are unchanged. |
| `https://*/*` | ⭐⭐ D112 (v1.6.0, owner 10-30: T35 = A, global read) — requested WHOLE, once, from the Allow press of the ask window (`global-ask.js` `onAllow`, opened by `globalRead.js` `openGlobalAsk()`) or from Settings → Permissions' *Job postings on any site* switch (`options-permissions.js` `onAllowGlobal`); `autoRead.js` `desiredRegistrations()` then registers the local detector (`jobSignals.js` + `globalReadDetector.js`) for it, excluding LinkedIn / Indeed / Glassdoor and draft's own site, and `scopeFor()` / `autoStep()` decide every pass. ⭐ T12 — `onAlwaysHere` may still ask for ONE origin under it. Never granted at install | Global read cannot exist: the detector cannot run on a careers site no list names, and the posting the user opens is not read until they press the toolbar icon. "Always read here" cannot exist either. Everything else is unchanged — the press still reads any page through `activeTab`. |

What is read and sent, and when:
- **Read** sends nothing. The labels (never a value — a label's text is read from a clone with every
  control removed) and the counts stay in `chrome.storage.local` for 30 days, for the read-quality line.
- **Prepare** sends the page's address and the tab's linked job to `/api/apply/prepare` — only when the
  tab is already linked to one of the user's own jobs; otherwise nothing.
- **Capture**: a page is a posting when its URL has a posting's shape or it carries JobPosting JSON-LD
  (checked in the page, locally), and never when it is an application page (Workday's `applyFlowPage`,
  an `/apply` stage). ⛔ A page that is not a posting sends nothing. A posting's text is sent to
  `/api/import/auto`; the server keeps it only if it belongs on the user's board (US, the active
  profile's roles) and stores NOTHING otherwise.
- **Fill** is the Ctrl+Shift+Y handoff with `auto: true`: it may press the page's own Save and Continue,
  never Submit, never past Review, never a terms / consent / attestation / signature control, and never
  sends the form's structure (`captureFormSchema` is skipped).

## Content scripts

⭐ **D191 sketch 2 (owner 11-18) — a SECOND declared script, `panelArrive.js`, on the six board families only**
(the hosts above), top frame, `document_idle`. It reads nothing from the page and sends no address or text: it
sends `PANEL_ARRIVE` once per address (and again on the boards' single-page navigation). The worker re-checks the
sender (this extension, frame 0), the switches and the posting's shape before it injects anything. Never on
LinkedIn, Indeed or Glassdoor (not in its matches). Pinned by `test/manifestMinimumPermission.test.js`.

**Before D191: one declared, on draft's own origin only (D99 J11, owner 10-14: "build the bridge"):** `boardBridge.js`,
`matches: ["https://jobsviadraft.com/*"]` — already the one host, so **no permission is added** — top frame only,
`document_start`. It lets the draft website hand a job from the board to the extension: the page posts a **job id**
(never an address), the script forwards it to the service worker, and `boardOpen.js` asks draft's server whether
the job is on this user's board, opens **the address the server returns** with `chrome.tabs.create` (no `tabs`
permission is needed to open a tab) and binds that tab to the job. It reads nothing from the page and sends nothing
anywhere itself. It accepts a message only from the same window, draft's origin, carrying this load's nonce, a
well-formed job id, during a real click (user activation); the worker re-checks the sender (a top-frame content
script of this extension on draft's origin) and rate-limits (10 a minute). No script is declared on any job board —
pinned exactly by `test/manifestMinimumPermission.test.js`.

⭐ **One is REGISTERED at run time, and only where the user asked (D97, owner 10-13):** `autoReadWatcher.js`,
by `chrome.scripting.registerContentScripts`, for a site the user switched on in Options and Chrome granted —
never anywhere else, never on LinkedIn, Indeed or Glassdoor (`excludeMatches`). It reads no value and makes
no request: it tells the service worker "the step changed" (debounced — ten rapid changes are one message),
and the service worker re-checks the switch and the permission on every message. Registrations are
reconciled on install, update, startup and every permission change; turning a site off unregisters it.
⭐ T12: a site the user chose with "Always read here" gets one registration for its own origin plus the ATS
frame site allowed there, with `allFrames` (the form is often that ATS's embedded frame); a message from a
sub-frame is accepted only from a known ATS site's frame, and only while the page that embeds it is a custom
site listing that ATS — anything else is ignored.

This is the change that removed the six job-board host permissions, and it is worth stating as a
privacy property rather than a refactor: there is no longer any page the extension runs on
automatically. Before, six sites were read whenever a tab of theirs was open. Now nothing is read
until the user presses the shortcut or opens the popup, and only the tab they did it on — or, since
D97, on a site the user switched on themselves (above).

The extractor lives in `extractor.js` and is injected by `chrome.scripting.executeScript`. Its
per-site selector map is an OPTIMISATION, not a gate — an unlisted site falls through to a generic
largest-content-block heuristic and still captures, which is exactly what makes an embedded board
work. It currently names LinkedIn, Indeed, Glassdoor, Lever, Greenhouse, Workable, Ashby and
Workday, verified against real postings by `scripts/e5GreenhouseHost.mjs`.

Several of those boards publish JSON-LD, which the extractor prefers over any selector — so a
selector can be wrong and the page still capture perfectly. That is not theoretical: the Ashby entry
once pinned a CSS-module class with a build hash in it and matched nothing, for weeks, invisibly.
e5 therefore re-runs each named board with the JSON-LD deleted, so the selectors have to do the work
they exist for, and a test rejects build-hashed class names outright.

## Commands

| Command | Default | Feature |
|---|---|---|
| `capture-job` | `Ctrl+Shift+K` | Capture the posting in view. One implementation, shared with the popup button (E2), injected under `activeTab` (E7). Rebindable only at `chrome://extensions/shortcuts` — the page-scoped custom override retired with the content script, and it never worked outside six sites anyway. |
| `fill-gated-application` | `Ctrl+Shift+Y` | The gated handoff. `Ctrl+Shift+G` was the first choice and Chrome silently refuses to bind it — it is Chrome's own find-previous — leaving a command with no key. |

## Deliberate absences

- **`externally_connectable` is ABSENT AND MUST STAY ABSENT.** With it, a website could message the
  extension. The design inverts that on purpose: nothing pushes data inward, the extension *pulls* from
  our server with the user's own session. Adding this key would not "fix" anything; it would remove a
  security property. Asserted by `test/extensionGatedHandoff.test.js`.
  ⭐ **The one inward path is D99's bridge (above):** draft's own page, through the declared content script, may
  ask the extension to open **a job id** — no data, no address, no answer. What the tab opens and whether it opens
  at all is decided by draft's server for the signed-in user, never by the page.
- **No remotely hosted code.** MV3 forbids it and nothing loads any — no `eval`, no `new Function`,
  no `importScripts`, no remote `<script src>`.
- **`popup.css` is deleted, not unshipped.** It was the v0.1.0 stylesheet, superseded by the inline
  `<style>` block in `popup.html`; it had been excluded from every build since v1.2.0 and nothing
  referenced it.

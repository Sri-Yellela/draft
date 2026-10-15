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
| `activeTab` | `background.js:112` (hotkey capture), `background.js:130` (gated handoff), `popup.js:9` (`getCurrentTab`); also the right-click **Save this page to draft** (a context-menu click grants it too) and the popup's **Report this form** (D55) | The gated handoff cannot reach the portal at all — there is deliberately no host permission for any portal origin, so this grant, taken per tab at the moment the user invokes the extension, is the only access that exists. Injection fails with "Cannot access contents of the page". |
| `contextMenus` | `background.js` `chrome.contextMenus.create` (in `onInstalled`, the four items in `formReport.js` `CONTEXT_MENUS`) and `chrome.contextMenus.onClicked` → `captureActiveTab()` / `saveLinkToDraft()` (D55 decision B, 10-07) / `handleGatedHandoff()` / `openDock()` (⭐ T22, 10-15: the popup's fill and score tiles left, and what they did stays one right-click away) | `chrome.contextMenus` is undefined: the right-click items **Save this page to draft**, **Save link to draft**, **Fill this application with draft** and **Show draft's ATS report** do not exist. Nothing else changes — the toolbar button and `Ctrl+Shift+K` capture as before. It adds no access: *Save this page* runs the same capture under the `activeTab` grant the click itself creates, and *Save link* reads no page at all — it sends the link's address to our server, which refetches the posting from the ATS's own listing or refuses the link. Chrome shows no install-time warning for it. |
| `scripting` | `gated-handoff.js:398,452,486,521,656` (probe, fill, overlay, edits), `popup.js` ATS button | `chrome.scripting` is undefined. The gated handoff cannot read a form, fill one, or render the review overlay; the ATS-score button cannot collect the page text. |
| `storage` | `background.js` `reportCapture()` (`storage.local` last capture), `background.js:147,190` + `gated-handoff.js:259-308` (`storage.session` packets and batch state) | `chrome.storage` is undefined. The popup cannot show the result of a hotkey capture it was not open for, and the handoff cannot hold a packet across an MV3 service-worker teardown. (`storage.sync` is no longer used: the custom-shortcut recorder it backed was retired with the content script, and rebinding is now Chrome's own.) |

**Not declared, deliberately:**

- `tabs` — `activeTab` already gives the extension the only tab URL it needs: the one the user just
  invoked it on. A blanket `tabs` grant would expose the URL and title of *every* open tab, which is
  the opposite of what this design is for.
- `cookies` — the extension never reads a cookie. Credentialed requests carry the user's session
  because `credentials: 'include'` lets the browser attach it; nothing reads its value. (The retired
  v0.1.0 builds declared this; they are deleted.)
- `notifications` — the handoff reports through `chrome.action`'s badge instead, so no additional
  user-facing consent prompt is requested for a status message.
- `<all_urls>` — never, in any list. ⭐ Since T12 (owner, 10-15) the OPTIONAL list ends with `https://*/*` — never
  `host_permissions`, never granted at install, never itself requested; see *Optional host permissions* below.
- **any job board or employer origin** — no longer needed at all, and that is the point. See host
  permissions.

## Host permissions

**There is exactly one, and it is our own server.** No job board is declared. No employer portal is
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

**Nothing is granted at install, and nothing is granted except from the user's own click.** Three clicks can
ask, each calling `chrome.permissions.request` as the FIRST call of its handler, inside the gesture, and Chrome
shows its own prompt naming the hosts:

1. ⭐ **The popup's one-time card** (D97 REVISED, owner 10-14: *"read has got to be automatic, we will seek
   permissions"*) — *"draft reads job and application pages for you and prepares your answers. Allow it on these
   sites"*, the disclosure in plain words, and **ONE prompt for every preset host below** (`popup-auto.js`
   `onConsent`). Granted → Read and Prepare are on for those sites; Capture and Fill stay their own switches, off.
   A refusal writes nothing. The card lives in the popup only — there is no first-run tab (owner 10-15).
2. **A switch in Settings** → *Read application pages automatically*, per site (`options-auto.js` `onSwitch`),
   after the disclosure and *I agree* — as since D97.
3. ⭐ **"Always read here" in the popup** (T12) — for ONE company careers origin the user is on (`stripe.com`…),
   plus the ATS site whose frame holds its form when that is known locally (`popup-auto.js` `onAlwaysHere`; a
   second click, `onAllowFrame`, asks for the frame's site when it was not known before the first).

Turning a site's last switch off, *Remove* in Settings, or *Turn off everything* calls `chrome.permissions.remove`.
Until the user clicks, the paragraph above is still true word for word: no standing access to any site.

The owner decided (10-07) that capture should happen when a posting is opened, with no click — which
`activeTab` cannot do, because it is granted only by an invocation. D97 (10-13) extended that to four
per-site switches, all off by default: **Read** (the form's labels and counts, kept on this computer),
**Prepare** (only on a tab already linked to one of the user's jobs), **Capture to my account** (D64), and
**Fill** (never submits). So the access is OPTIONAL, asked for at the moment the user opts in, per site.

⭐ **D97 REVERSES D64's "no gated portal" line for Workday only (owner, 10-13):** `*.myworkdayjobs.com`
and `*.myworkdaysite.com` are offered, because Workday changes steps without changing the address and a
watcher has to be in the page to notice. They stay out of `host_permissions`. ⭐ **SmartRecruiters' public job
host `jobs.smartrecruiters.com` is offered since 10-15** (owner, decision 2 — it reverses this paragraph's old
"not offered" for SmartRecruiters). Amazon, iCIMS, Taleo and Meta are not offered as presets. ⛔ **LinkedIn,
Indeed and Glassdoor are never offered** — not in the list, excluded from every registered content script
(`excludeMatches`), refused by "Always read here" (`customOriginFor`), and refused in code (`autoStep`).

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
| `https://*/*` | ⭐ T12 — `popup-auto.js` `onAlwaysHere` asks for ONE origin under it (`https://<host>/*`) from the click; `autoRead.js` `desiredRegistrations()` registers the watcher there (and in the allowed ATS frame, all frames) and `scopeFor()` / `autoStep()` decide every pass. Never requested itself; never granted at install | "Always read here" cannot exist: Chrome refuses to request an origin the optional list does not cover, so a company's own careers site could never be read automatically. Everything else is unchanged. |

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

**One declared, on draft's own origin only (D99 J11, owner 10-14: "build the bridge"):** `boardBridge.js`,
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

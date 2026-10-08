# E2E Track B — running the extension against a LOCAL server and the fake application site

Written for D87 (10-09) as the source for `E2E_TEST_GUIDE.md` §0. Track A tests the packaged
extension against production; **Track B runs everything on the developer's machine**, so a fill can
be driven to the submit click with no real employer and no real candidate.

Nothing here sends anything anywhere: the fake site records submissions in memory, and the local
server runs on a throwaway database.

## 1 · Prerequisites

| | |
|---|---|
| Node | **≥ 20** (the repo builds `better-sqlite3`, so a native toolchain must be installed) |
| Chrome | Google Chrome, desktop. The extension is loaded unpacked into it (§4) |
| Checkout | `npm install` at the root, then `npm run build` (installs and builds `client/` into `client/dist`, which the server serves) |

## 2 · Start the local server (`:3001`)

The server reads `.env` when one exists; **an EMPTY variable on the command line wins over `.env`**,
which is how the paid keys are switched off below. `RM_DATA_DIR` points the database at a throwaway
folder, so nothing touches `data/`.

**macOS / Linux / Git Bash:**
```bash
mkdir -p /tmp/draft-e2e
RM_DATA_DIR=/tmp/draft-e2e USAGE_FAILURE_SINK_PATH=/tmp/draft-e2e/sink.jsonl \
PORT=3001 NODE_ENV=development \
ADMIN_USER=admin ADMIN_PASSWORD='choose-a-local-password' \
ANTHROPIC_KEY= SERPAPI_KEY= THEIRSTACK_API_KEY= GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= \
BOARD_FIT_PRECOMPUTE=off RESUME_MASTER_URL=http://127.0.0.1:9 \
node server.js
```

**Windows PowerShell:**
```powershell
New-Item -ItemType Directory -Force $env:TEMP\draft-e2e | Out-Null
$env:RM_DATA_DIR="$env:TEMP\draft-e2e"; $env:USAGE_FAILURE_SINK_PATH="$env:TEMP\draft-e2e\sink.jsonl"
$env:PORT="3001"; $env:NODE_ENV="development"
$env:ADMIN_USER="admin"; $env:ADMIN_PASSWORD="choose-a-local-password"
$env:ANTHROPIC_KEY=""; $env:SERPAPI_KEY=""; $env:THEIRSTACK_API_KEY=""
$env:GOOGLE_CLIENT_ID=""; $env:GOOGLE_CLIENT_SECRET=""
$env:BOARD_FIT_PRECOMPUTE="off"; $env:RESUME_MASTER_URL="http://127.0.0.1:9"
node server.js
```

Open **http://localhost:3001**. Notes:
- **An empty database crawls the public ATS boards at first boot** (free, read-only, a few minutes,
  ~2,000 rows). The board is usable while it runs.
- **The admin account** is created at boot from `ADMIN_USER` / `ADMIN_PASSWORD`. Use it only to
  create the test account (§3).
- **Résumé generation is OFF** in this recipe (`ANTHROPIC_KEY` empty, the tools service pointed at a
  dead port). Every fill path works without it; a *Generate* returns an error, which is expected.
  Don't put a real key in for Track B.
- **`NODE_ENV=development` admits any origin**, so the unpacked extension's ID does not matter here.
- In development the session cookie is not `Secure`, so `http://localhost` sign-in works.

## 3 · The test account (no email service needed)

**Sign-up needs no email service.** `/api/auth/register` creates the account and signs it in at once;
there is no verification step, and nothing in the product is gated on a verified address
(`email_verified_at` is displayed in Account, never checked). Without `RESEND_API_KEY` the server
logs `[email] not sent — no email provider configured` for the mails it would have sent (password
reset among them) and carries on.

Two ways to get an ordinary, non-admin account:
1. **Sign up** at `/register` with a synthetic name and an address like `tester@example.com`.
2. **Admin → System → Users → Create User**: a username and a password (8+ characters),
   **leave "Admin user" unticked** → a BASIC-plan account with an empty profile. The tester fills
   the profile at first sign-in.

The same two routes work on **production**: either the tester signs up, or the owner creates the
account in Admin → System → Users with "Admin user" unticked.

## 4 · Point the extension at the local server

The DEV SWITCH is two lines at the top of `extension/config.js` and `extension/background.js`
(the service worker keeps its own copy). In **both** files:

```js
// const RESUME_MASTER_URL = 'https://jobsviadraft.com'; // A: production
const RESUME_MASTER_URL = 'http://localhost:3001'; // B: local dev (npm start serves :3001)
```

Then chrome://extensions → **Developer mode** → **Load unpacked** → the `extension/` folder (or
reload it). **Flip both back before any build**: `npm run build:extension` refuses an active
localhost URL, and so does `test/extensionSubmission.test.js`.

⚠ Use a **separate Chrome profile**, and don't keep the store copy of draft installed beside the
unpacked one: both claim the same shortcuts.

## 5 · Start the fake application site (`:4599`)

```bash
node scripts/fakeAts.js            # http://localhost:4599
PORT=5000 node scripts/fakeAts.js  # any other port
```

**The pages:**

| page | shaped like | what it tests |
|---|---|---|
| `/` | — | index of every form |
| `/greenhouse` | Greenhouse | a 2-step form; traps: an inverted sponsorship question, an ambiguous name field; the résumé is taken at step 1 |
| `/lever` | Lever | 1 step; traps: lowercase yes/no, a "Review and Submit" button |
| `/ashby` | Ashby (native controls) | 1 step; traps: a required typeahead, a date format |
| `/ashby-spa` | **Ashby as it really renders** | React-rendered in two chunks; a nameless required date picker, UUID field names, checkboxes named by their question, EEOC radio groups. Options: `?answerable=1` `?autofilltrap=1` `?deadsubmit=1` `?delay=ms` |
| `/workday-replica` | **Workday** | a six-step wizard: listboxes rendered in a portal, typeaheads, skill chips, *Add Another* sections, a drop zone behind a cover-letter decoy, *Save and Continue*, Review, a recorded Submit. `GET /_workday-replica/state` shows what it saved and whether Submit was pressed |
| `/twoorigin/jobs/<id>` → `/twoorigin/apply/<id>` | **the two-address Apply** (Amazon's shape) | the posting is served on `http://localhost:4599`, *Apply now* goes to `http://127.0.0.1:4599` — a different origin to the browser and to the extension. The prepared answers must follow the candidate across |
| `/multistep` | — | one step 1 offering both navigation styles (a real POST to a new document, and `history.pushState`), plus a cross-origin control |
| `/spa` | any hydrating ATS | fields injected after a delay (`?delay=ms`, default 2500) — a fill that does not wait walks an empty page |
| `GET /_submissions` · `POST /_reset` | — | everything submitted so far, as JSON (assert on the **recorded answers**, not on "submitted"); and clear it |

Every form contains at least one deliberate trap. **A run that "succeeds" while answering a trap
wrongly is the failure Track B exists to catch** — check `/_submissions`, not the success screen.
Uploads are real multipart: a résumé that arrived is in `files`, never in `fields`.

## 6 · The server-side fill and Chrome

The **extension** fills in the tester's own Chrome and needs nothing else. The **server-side fill**
(auto-apply, `services/applyAutomation.js`) launches its own browser through
`services/browserLauncher.js`, in this order:

1. `PUPPETEER_EXECUTABLE_PATH` (or the legacy `BROWSER_EXECUTABLE_PATH`) — **checked to exist**; a
   wrong path falls through rather than failing at launch
2. **Windows:** `C:\Program Files\Google\Chrome\Application\chrome.exe`, the `(x86)` path, then
   `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
3. **Linux:** `/usr/bin/chromium-browser`, `/usr/bin/chromium`, `/usr/bin/google-chrome(-stable)`,
   `/usr/local/bin/chromium`, `/usr/local/bin/chrome`, then the bundled `@sparticuz/chromium`

⚠ **macOS has no built-in path.** On a Mac, set it before starting the server:
```bash
PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node server.js
```
Without it the launcher reaches the bundled Linux binary and fails with
`browser_launch_failed` / `browser_binary_not_found`.

## 7 · The automated harnesses (optional)

With the server from §2 running on `:3001`:
```bash
npm run verify:harness
```
It starts the fake site on `:4599` itself and **refuses to start when nothing answers on `:3001`**.
It compares each harness's pass count against `scripts/harnessBaseline.json`, so a run that stops
early is a failure. The harnesses do not use the DEV SWITCH: each rewrites the extension's URL in a
temporary copy to point at the server it boots.

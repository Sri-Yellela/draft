# Apply worker — how the auto-apply pipeline runs for users

**Status:** design, written 2026-10-09 (D79). Nothing here is built; **step one is a spike (§9)**, not the system.
**Supersedes the capture half of `VM_EXECUTION.md` V2** (the extension no longer captures sessions — §6).
**Read with:** `E3_SECURITY_DESIGN.md` (the security design — **unreviewed, O12**), `VM_EXECUTION.md`, `CRAWLER_WORKER.md`
(the worker whose boundary this one rehearses), D22 (the dashboard surface), D36 / O73 (the attended-first rule).

---

## 0 · The answer in one paragraph

**Users do not get a VM.** A user gets **an encrypted session per portal, stored as data.** When an application runs,
**a shared worker opens a fresh browser, loads that session, fills the form, stops at Review, and throws the browser
away.** The worker is **a service, not a machine per person** — a pool, with one isolated browser process per run.

**It exists for one tier of the board:** `gated` / `account` portals (Workday, Meta, Amazon) — **about 5%** of postings —
and **it is the only way auto-apply can ever work on a phone,** where there is no extension. The other ~95% (`direct`)
needs none of it.

---

## 1 · Three trust zones — never one project

| Zone | Does | Holds | Why separate |
|---|---|---|---|
| **draft** (the web app) | queue, caps, kill switch, consent, the user interface | **ciphertext only** — it **cannot** decrypt a session | the thing users and the internet touch |
| **crawler** (D75) | opens public pages to find boards | nothing secret, **no user data** | it opens hostile pages; a browser exploit finds nothing |
| **apply worker** (this doc) | **decrypts a session in memory for one run** | the keys, for the length of a run | **it is the only component allowed to decrypt** |

⛔ **The apply worker is NOT a service in the crawler's project, and not in draft's.** It goes in **its own Railway
workspace or on a small VPS**, with **its own deploy permissions** — E3's requirement, and the one Railway's
project-wide access cannot give inside a shared project.

⛔ **The worker holds no database credentials.** Like the crawler it **leases a job over a narrow signed API** and returns
a result; **draft decides.**

**Where the keys live:** ⛔ outside any environment variable the web app can read. **A key service (AWS KMS or Google
KMS) is the standard answer; Railway has none**, so it is **a new vendor in the trust boundary** and a new bill — *the
owner's decision (§10).*

**Per-run isolation:** **start with a long-lived worker service running each run in a fresh, separate Chromium process
and an empty profile, wiped after.** True *container-per-run* (Fly Machines, Cloud Run Jobs, Fargate) is the upgrade if
volume or isolation demands it — **not needed for an attended pilot.**

---

## 2 · How a session is protected — the part that decides everything

The existing design lets **draft** encrypt the session. That means **a compromised draft deploy can read sessions as they
arrive**, and cryptography cannot help (E3 §4 says so). **This design removes that exposure:**

1. **The worker has a long-lived SIGNING identity key. Its public half is built into the Android app** — pinned, so a
   hacked draft cannot substitute it.
2. To connect a portal, the app asks (via draft) for a **fresh per-session encryption public key.** **The worker mints it,
   keeps the private half in its own KMS-wrapped store keyed by session id, and signs the public half.**
3. **The app verifies the signature, then seals the session** (cookies + localStorage for that one origin) **to that
   per-session key** — AES-256-GCM for the data, the data key wrapped to the per-session key, `user · portal · version`
   bound in as associated data — **and uploads ciphertext.**
4. **Draft stores ciphertext it cannot read.**
5. **Revoke = the worker destroys that session's private key.** ⭐ **The ciphertext — in the database, in every backup —
   becomes permanently unreadable, immediately.** (The older design promised this and could not keep it once backups
   existed; per-session keys keep it.)

⛔ **What is never held:** a password, a card, a form value, a keystroke, **a screenshot of a signed-in page.**

**The breach sentence** (E3's test — *if it is uncomfortable to read, the design is not finished*):
*"If draft's database leaks, an attacker gets ciphertext sealed to keys that never touch draft. If the worker is
breached, an attacker gets the sessions of users with a run in progress and the keys for stored sessions — each
time-limited, scoped to one portal, and revocable by the portal. No password is ever stored."*

---

## 3 · The data

```
portal_sessions      id, user_id, portal_family, ciphertext, key_id, consent_at, expires_at (the portal's own),
                     last_used_at, revoked_at
portal_session_uses  session_id, apply_run_job_id, started_at, outcome        -- the use log users see
apply_remote_runs    apply_run_job_id, state, worker_id, lease_until, attempts, field_list_json (labels + values, no pixels)
```

- **Consent is per portal, never per account**, recorded before anything is stored.
- `expires_at` is **the portal's real expiry** — never one we invent.
- **The worker's key store is its own** (a small encrypted store on the worker's volume, wrapped by the KMS key) — **not in
  draft's database.**

---

## 4 · The run — attended first, always

```
QUEUED → LEASED → SESSION LOADED → (signed out? → STOPPED: "sign in again")
       → FILLED → READY TO APPROVE ──(user approves the VALUES)──► REFILLED + VERIFIED → SUBMITTED → RECORDED
                                 └──(user skips / lets it lapse)──► CLEARED
```

1. **Lease.** The worker asks `GET /api/applyworker/next`; draft checks **the kill switch, the caps (per-run, per-day,
   per-company), the portal's enabled flag and the attended lock** *before* handing anything over — **before the session
   is decrypted.**
2. **Load.** Decrypt in memory, open the portal, **confirm it is still signed in.** If not → the run **stops** and the user
   sees a *Stopped* card: *"Meta signed you out — sign in again."*
3. **Fill** with the **existing resolver and packet** (`applyAutomation.js`; the same exact-or-blank rules; **eligibility is
   never guessed**), and **stop at Review.**
4. **Send the field list to draft, not pixels:** every label and the value typed, plus the résumé preview. ⛔ **No screenshot
   of a signed-in page is stored or shown.**
5. **The user approves the values.** The worker **refills, verifies every value equals what was approved, and aborts on any
   difference**, then submits. *(A page held open for hours is fragile and a security smell; **re-doing it on approval is
   deterministic.**)*
6. **Record** — a `job_applications` row with the tailored score; **evidence = origin + id-like parameters only** (D69(c)).
7. **Any failure leaves the item retryable** — a 429, a dead process or a timeout never stamps an application *attempted.*
8. **A rotated session** is re-sealed to the same per-session key before it is stored again — **never written in the clear,
   not for one hop.**

⛔ **UNATTENDED IS LOCKED** until **O73's attended real applications and a supervised full-auto run have both passed**, and
**the kill switch is proven MID-BATCH on this path.** AUTO may be shown; it may not be switched on.

---

## 5 · Back end — what gets built

| | |
|---|---|
| **draft** | the three tables · `/api/portals/*` (connect start / upload / list / revoke) · `/api/applyworker/*` (lease / result) · the queue states and the *Ready to approve* card · the portal enable-list · the admin **Apply runs** page |
| **worker** | the lease loop · the key store · the signing identity · per-run Chromium · the fill (reusing the pipeline) · SSRF + robots-style guards · the interaction audit log · **no DB credentials** |
| **recorded reversal** | `/api/apply/session/*` returns **410** today — **reversing it is a RECORDED DELIBERATE REVERSAL** (code, worklog, `CORRECTIONS_REGISTER.md`), stating *what changed in the design*: **the password never passes through us, and draft cannot read the session.** |

---

## 6 · Front end — ⛔ the Portals PLACEMENT below is superseded by §6b

**Where it lives — nothing new in the top bar:**

- **Settings → *Portals you are signed in to*** (D22): per portal **status** (active · expiring · expired) · **what is held**
  (*your signed-in session at myworkday.com — never your password*) · **what is not** · **the use log** (*"used to apply to
  Rocket Software, 3 Oct"*) · **Remove** (*"destroys the key; the stored data becomes unreadable immediately"*) · **Refresh.**
- **Draft House** (D14): a remote run is **a card in Queued with its phase**; an expired session is **a Stopped card**; a
  new **Ready to approve** card holds **the field list** with **Approve · Skip · Clear**, and **the phone is notified.**
  *Same object, same caps, same kill switch — not a second page.*
- **The mode control** shows **SEMI / AUTO, with AUTO locked and saying why.**

**Connecting a portal — the platform decision:**

| | How |
|---|---|
| **Android (the front end for this feature)** | **Settings → Portals → Connect <portal>** → the per-portal consent screen → an **in-app browser opens the portal's own sign-in** → the user signs in → **Done — save my session** → the app **seals and uploads.** *The password is typed into the portal's page; the app reads cookies only.* |
| **Desktop** | **no capture.** The gated handoff stays — the extension borrows the user's own session for one gesture under `activeTab`. ⛔ **This is why the extension needs no `cookies` permission and its listing does not change** (D13's argument). |
| **Web, signed in on a phone browser** | explains that connecting happens in the Android app |

**Disclosures that DO change** (everything moves together, as always): the **Play Store data-safety form** (session
cookies uploaded) · the privacy policy · `PRIVACY_RECONCILIATION.md` · the in-app consent copy.

---

## 6b · The Portals surface — ✅ DECIDED 10-09

**Supersedes §6's Settings placement and D22's.** Sketches: **`portals-draft-house.html`** (the chosen layout — desktop and Android) · `sessions-keyring.html` (the card). ⛔ **Build to the files, not to this prose** (D30, D31, D34 and D35 all drifted when built from a description). The **connect flow** and **the approval screen** in `sessions.html` are **recommendations, NOT yet chosen** (§6b.9).

1. **Where it lives — Draft House, in one place.** A **Portals** box (a depth box with a key icon) sits **in the run bar**, beside the mode control. **It is plain when all is well and shows a MARK only when something needs the user** — `N expired` (red) or `N ending` (amber). It opens **a drawer on desktop** (right edge, ~410px, with a scrim; × and Esc close it) and **a bottom sheet on Android** — **the same component.** **Settings keeps ONE pointer row** — *"Portals you are signed in to · 3 connected · 1 expired — managed in Draft House"* with **Open in Draft House.** ⛔ **No second copy of the cards.**
2. **Reconnect from the problem.** A Stopped card for an ended session carries **Reconnect**; it **opens the drawer with that portal's card already expanded.**
3. **The card is plain.** A **logo tile and a name — nothing else when the portal is healthy.** Exceptions appear as **marks** (D60): **expiring** → `N days` + an amber left edge · **expired** → `Expired` + a red left edge · **removed** → `Removed`, dashed and dim. It is **a real `<button>` with `aria-expanded` and `aria-controls`** and **expands in place** (the `0fr → 1fr` easing). **Expanded it holds only what is specific to that portal:** the host · **a time bar with "N days left — until about 14 Oct. That is Workday's date, not ours"** (⛔ *if the portal gives no date, say* "until the portal signs you out" — **never invent one**) · **the use log** (the latest two, **Show all N**) · the actions.
4. ⛔ **Connect again appears ONLY on a dropped connection** — **expired**, or **removed by the user.** A healthy or expiring portal offers **Remove** and nothing else. **Remove** opens an **inline confirm** — *"destroys the key; the stored data becomes unreadable immediately — not marked deleted, unreadable. Applications already sent are unaffected; queued ones for this portal will stop"* — *Keep it / Remove.* **After removal the card stays as a dim, dashed record** — *"Key destroyed — unreadable since 9 Oct, 14:02"* — **and its use log is kept**; removing never erases the history.
5. ⛔ **The general promise is said ONCE, above the cards — never repeated per card:** *"**Sealed.** draft stores your signed-in session for each portal but cannot open it — only the apply worker can, while it runs your application. **Your password, card details and anything you type are never held.**"*
6. **The empty state** (no portals yet): *"No portals connected"* — what a portal is (employers that make you sign in before you can apply: Workday, Meta, Amazon), that **connecting happens in the Android app**, and that **on a computer draft borrows your own browser's session through the extension, one application at a time.** ⛔ **No dead Connect button on desktop.** A dashed **"Connect a portal — In the Android app"** card closes the list.
7. **Tests (each red when removed):** a collapsed card contains **no** *Holds* / *Never holds* text · a healthy card shows **no mark** · **Connect again renders only for an expired or removed portal** · **Reconnect on a Stopped card opens the drawer with that card expanded** · Settings holds **exactly one pointer and no card list** · the drawer is **keyboard-operable** (focus moves in, Esc closes, focus returns to the Portals box) · `prefers-reduced-motion` respected · **no capsule shapes** (D60) · both themes.
8. ⚠ **Known, accepted:** an **expiring** portal has no Connect again — if users want one before it drops, put it in the Portals box's hint, **not on the card** · an open card is taller than its neighbours · **the drawer covers the board while open** — it is a place to check and act, not to live in.
9. ⏸ **NOT YET CHOSEN — recommendations only (`sessions.html`):** **the connect flow** (consent per portal → sign in on the portal's own page → *Save my session* → sealing → connected; **add a manual "I'm signed in" fallback to step 3**) · **the approval screen** (**B, the receipt with "same as your last application here except…", on the phone; C, the résumé beside the values, on desktop**) · the notification text (*"A job is ready for your approval"* — never a company or a value). ⛔ **No swipe-to-approve, ever** — nothing submits on a gesture (D36).

---

## 7 · The rules inherited, restated

- **Per-portal enable-list.** A portal is **off until V4 (§8) clears it** — the UI says *"draft can't apply to this portal
  automatically"* rather than hiding why.
- **Eligibility is exact-or-blank** (D36); **nothing submits on a gesture**; **the daily caps and the per-company cap**
  apply to remote runs exactly as to local ones; **no model call** except résumé generation (D17).
- **The worker never logs in, never creates an account, never solves a CAPTCHA.** A challenge **stops the run** and says so.

---

## 8 · What could kill it — answered BEFORE building for any portal (V4)

1. ⛔ **Terms of service.** **Some applicant-tracking systems forbid automated submission regardless of who authorised
   it** — *"the user authorised it" is not a defence for a terms violation by us.* **Per-platform fact: Workday, Meta,
   Amazon each need reading, and the owner's counsel agenda should cover it.** A portal whose terms forbid it **stays off.**
2. ⛔ **Session binding.** A session captured on a phone and **replayed from a datacenter IP** may be challenged,
   re-authenticated or killed. **Datacenter IPs are also the flagged shape for automated submission.** *Unmeasured.*
3. **The security review (O12) is unread**, and the Android app is early (Phase 2a).
4. **A platform change** — portals redesign; the fill, like any autofill, **rots** (`AUTOFILL_TARGET.md` §8.3).

---

## 9 · The spike — step one is NOT the system

**Goal:** answer §8.1 and §8.2 **cheaply, before any key service, worker project or Android work is paid for.** **Nothing
is uploaded to draft. Nothing is submitted.**

**One portal, the owner's own account.** ⚠ **Prefer a secondary account** if one exists — an automated session can get an
account challenged, and a candidate's real application history is worth protecting. *Suggested first portal: Amazon
(a single account at `account.amazon.jobs`, and the two-origin case D56 already hit).*

| Step | What | Output |
|---|---|---|
| **S0.1** | **Read the portal's terms** on automated access; ask counsel if unclear | allow / forbid / silent — **if forbid, stop** |
| **S0.2** | `scripts/spikeCaptureSession.mjs` — a **headed** browser on the owner's machine; **the owner signs in themselves**; the script saves cookies + localStorage **for that origin** to a **passphrase-encrypted file outside the repo** | a session file; ⛔ **never committed, never uploaded** |
| **S0.3** | **Replay it:** (a) headless on the owner's machine, same IP · (b) from **a datacenter box** — Railway's free throwaway VM (`ssh railway.new`) is exactly enough — then **delete the box and sign out in the portal to kill the session** | *does the session survive? any challenge, CAPTCHA or forced re-login?* |
| **S0.4** | Run the existing fill against **a real application page up to Review — do not press Submit** | fields filled · mismatches · where it stops |
| **S0.5** | Report: a **go / no-go matrix** — terms · replay from the same IP · replay from a datacenter · fill quality | the decision for the owner |

**After a GO:** P1 the key service and the per-session sealing (§2) · P2 the worker service and the lease API · P3 the
Android connect flow · P4 the approval card and push notification · P5 an **attended pilot on one portal, the owner's
account, five applications** · P6 more portals, **each through V4** · **P7 unattended — only past the gate.**

---

## 10 · Decisions for the owner

1. **The first portal** for the spike (and a secondary account to use).
2. **The key service** — AWS KMS or Google KMS (a new vendor), or defer until the spike says GO.
3. **Where the worker runs** — a **separate Railway workspace** or a **VPS** (§1).
4. **Push notifications** for *Ready to approve* — Firebase Cloud Messaging is the Android default; **a third party that sees
   a notification's text** → the notification says *"A job is ready for your approval"*, **never a company or a value.**
5. **Whether the product wants this at all** if S0.1 or S0.3 comes back no — the honest fallback is the **gated handoff on
   desktop and no auto-apply on a phone.**

---

*Related: D22 (the dashboard) · D13 / D23 (the extension) · D53 / D54 (the queue and company tracking) · D56 (two-origin
Apply) · D69(c) (evidence) · D75 (the crawler's boundary) · E3 / O12.*

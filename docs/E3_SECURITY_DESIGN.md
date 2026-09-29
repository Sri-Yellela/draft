# E3 — Remote browser profiles: the security design

**Design document. Nothing here is built, and nothing here may be built yet.** Written 2026-09-29 as
`POST_MIGRATION_DESIGN.md` §E3 requires: *"The security design is the first task, not a follow-up."*
⛔ Building stays behind AF5, full-auto proven on the direct tier, and the kill switch verified
mid-batch — see that doc's prerequisites. This document is prerequisite 4, and it is **unreviewed**
(WORKLOG OWNER 12).

⛔ Do not write any of it into `ARCHITECTURE.md`.

---

## 0 · The premise, corrected before anything else

The parent doc says: *"The user signs into the portal themselves, through a streamed remote view.
**You never see the password.**"*

⛔ **That is not true of a streamed view, and the design has to say so.** In a streamed sign-in the
remote browser runs on our worker; the user's keystrokes travel to it as input events and are typed
into the portal's password field **by our process**. The password is never *stored*, but it
**passes through our infrastructure in plaintext**, in memory, as keystrokes. Anyone who can run
code on the streaming worker — including a future deploy of this repository — can read it.

So there are two sign-in shapes, and they are not equivalent:

| | Where the password is typed | Does it touch our servers? | Works on |
|---|---|---|---|
| **A · Device sign-in, session upload** ⭐ | The user's own device — a WebView in the Android app, or the desktop browser with the extension | **No.** Only the resulting cookies are uploaded | Mobile (WebView `CookieManager`) and desktop (extension, `cookies` permission for that one portal, requested at the moment of use) |
| B · Streamed remote view | Our worker's browser, driven by streamed input | **Yes**, transiently, as input events | Anything with a screen |

⭐ **Recommendation: A is the design; B is not built.** A keeps the property the gated handoff has
today — the credential never leaves hardware the user controls — and it is the mobile path the
parent doc wanted, because the Android app *can* host a WebView even though it cannot host an
extension. B exists only as a fallback if a portal defeats A (see §6), and would need its own
review.

⚠ **A has one open technical question per portal:** whether the portal binds its session to the
IP address or device fingerprint that signed in. If it does, a cookie minted on a phone on a
residential IP is invalidated the first time a datacenter worker presents it. That is a
per-platform fact, measured by trying it, not assumed (§6).

---

## 1 · What is stored, exactly

**Per (user, portal registrable domain)** — one *profile*:

- Cookies whose domain is the portal's registrable domain or a subdomain of it — name, value,
  domain, path, expiry, `Secure`, `HttpOnly`, `SameSite`. Nothing for any other site: the capture
  filters by registrable domain (the same check that stopped "Localhost" being filed as a company)
- `localStorage` for that portal's origins only
- Metadata, unencrypted: `user_id`, portal domain, `created_at`, `last_used_at`, `expires_at`,
  profile version

**Never stored:** passwords, form values, keystrokes, screenshots, page HTML, IndexedDB, cache,
history, cookies for any other domain. ⛔ The capture step asserts this rather than assuming it: a
test feeds a jar with a foreign-domain cookie and a password-field value and requires both absent
from the stored blob.

Size: tens of kilobytes, not "tens of megabytes" — a full Chrome profile directory is **not** what
is stored. The run container starts from a clean profile and has these cookies injected.

---

## 2 · Encryption: keyed how, decrypted where, for how long

**Envelope encryption.**

- Each profile has its own random 256-bit **data key**; the blob is AES-256-GCM under it, with
  additional authenticated data `user_id | portal_domain | profile_version`, so a ciphertext copied
  onto another user's row, or another portal's, **fails to decrypt** instead of logging someone into
  the wrong account
- The data key is stored **wrapped** by a **key-encryption key held outside the application's
  environment** — a KMS (or, minimally, a separate secret store the worker reads at start and the
  web app cannot)

⛔ **Not `COOKIE_ENCRYPTION_KEY`.** Two reasons, both measured in `server.js`:
1. It lives in the same Railway environment as the database volume — one environment dump yields
   both the ciphertext and the key
2. **When it is unset it silently falls back to a random key generated at boot** (`server.js`,
   beside its declaration). For integration secrets that means "lost on restart"; for portal
   sessions it would mean every profile silently dies on every deploy. A missing key must stop the
   worker, not degrade it — this repository's Shape 3, silence reported as success

**Decrypted where:** only inside the **run worker**, immediately before the cookies are injected
into a fresh browser context. The web app never decrypts a profile; no API returns one.

**For how long:** the plaintext exists for the life of one run container — **15 minutes hard cap**,
killed by the pool, not by itself. The container has no swap and no core dumps; its browser
context is discarded at exit. At the end of a run the worker may **re-capture** the jar (portals
rotate session cookies) and re-encrypt it under a **new** data key.

---

## 3 · Revocation — the user ends it, and what that deletes

- **"Disconnect <portal>"**, one button per portal, and **"Disconnect all"**. Each deletes the
  ciphertext **and** its wrapped data key — crypto-shredding, so a backup made before the delete
  holds a blob nothing can open once the data key is gone. ⚠ That requires data keys to NOT be in
  the database backups. Either they live in the KMS, or backups must exclude that table; decide
  when building, and test that a restored backup cannot decrypt a disconnected profile
- Best-effort: a disconnect also runs the portal's own sign-out from a worker, so the session
  dies at the portal, not only here. Reported as best-effort, never as done, unless the portal's
  response confirms it
- **Automatic expiry:** `min(the portal's own cookie expiry, 30 days since the user last signed in
  themselves)`. An expired profile is deleted, not kept disabled
- Account deletion cascades to every profile, with the same shredding
- **Every use is visible to the user:** a per-portal log of "used by the application to <action>
  at <time>", readable in the account page. A session the user cannot see being used is one they
  cannot know to revoke

---

## 4 · What a breach exposes — written down plainly

> **An attacker who obtains the profile table AND the key-encryption key can act as the user on
> every portal the user connected — submit or withdraw applications, read application status, and
> read or change the profile the user keeps on that portal (which typically holds their address,
> phone number, work authorisation and sometimes demographic answers) — until the portal's session
> expires, the user disconnects, or the portal revokes it. They get no passwords, nothing on any
> other site, and no access to the user's email.**

That sentence **is** uncomfortable, and the parent doc says that means the design is not finished.
What makes it acceptable is not in the sentence but in the conditions around it:

- **Both halves are needed.** The database alone — the likeliest breach, e.g. a leaked backup —
  yields ciphertext only, *if* the KEK is genuinely elsewhere (§2). ⛔ If the KEK ends up in the
  same Railway env, the sentence applies to a database breach, and the design has failed
- **The window is bounded** by §3's expiry, and is shortest for the portals that expire sessions
  aggressively — typically the gated ones
- **Compare the alternative honestly:** stored credentials would add "and the password, forever,
  and wherever else they reused it". Stored sessions are strictly smaller

Still unresolved, and it must be before build: **a malicious or compromised deploy of this
repository** can read profiles as they are decrypted in the worker. KMS separation does not defend
against the code that is allowed to call the KMS. Mitigation is process — the worker as a separate
service with its own deploy permissions and review — not cryptography. Named here so no one
mistakes §2 for protection against it.

---

## 5 · Can the sign-in be intercepted, and by whom

**With shape A (recommended):** the password is typed on the user's device, over TLS, to the
portal. We are not in that path. What we receive is the cookie upload, over our TLS, authenticated
by the user's own draft session. Interception of the upload yields a session (the §4 exposure for
one portal), not a password. Railway's edge terminates our TLS, so Railway is in the trust boundary
for the upload — as it already is for everything else draft serves.

**With shape B (not built):** the password crosses our infrastructure as input events. Who could
read it: Railway's edge (TLS termination), any code running on the streaming worker, and anyone
with access to its memory. ⛔ This is the reason B is not the design.

---

## 6 · Per-platform facts to establish before building for a platform

Each of these is a **fact to measure per platform**, not a property to assume. ⛔ None has been
checked.

| Platform | Terms prohibit automated submission? | Session bound to IP / fingerprint? | Sign-in in a WebView allowed? (some IdPs block embedded browsers) |
|---|---|---|---|
| Workday | unchecked | unchecked | unchecked |
| Amazon (amazon.jobs) | unchecked | unchecked | unchecked |
| Meta careers | unchecked | unchecked | unchecked |

⛔ A "prohibited" in column one means we do not build for that platform, regardless of who
authorised it. ⚠ Google sign-in refuses embedded WebViews by policy; a portal that only offers
"Sign in with Google" may force shape B or be out of scope.

**Detection** (datacenter IPs): residential proxies are the usual answer, and the parent doc calls
them murky — they are, and this design **does not adopt them**. If a platform flags datacenter
submission, that platform is out of scope for E3; it stays on the desktop gated handoff.

---

## 7 · Reversing the `/api/apply/session/*` retirement — recorded, not quiet

`3d8e26a` (2026-08-25) made both routes answer **410**, with the replacement named: *"Portal
sessions are no longer stored on the server. A portal that wants you signed in is handed to your
own browser."* E3 reverses that decision. It is a legitimate reversal, and this is its record:

- **What changes:** the server stores portal sessions again — encrypted per §2, for gated portals
  only, opt-in per portal
- **Why it is different from what was retired:** what was retired stored sessions under the
  app-wide `COOKIE_ENCRYPTION_KEY`, with no per-user key, no expiry, no use log and no revocation
  path the user could see. §§2–3 are exactly those four
- **What does not change:** the desktop gated handoff remains the default. E3 is additive, and the
  410 routes stay 410 — E3 gets new routes with new names, so a stale client cannot reach new
  behaviour by accident

---

## 8 · The kill switch applies to this too

`1bb2a29` made the apply kill switch reachable in a hurry. E3 runs are applications, so they obey
it — **checked per run, before the cookies are decrypted**, not only at batch admission. A stopped
switch must mean no profile is decrypted, which is a stronger and more testable statement than "no
application is submitted".

---

## 9 · Before this can be called reviewed

- [ ] Owner review of §0's correction — shape A as the design, shape B not built
- [ ] Where the KEK lives, named (a service, not "a KMS")
- [ ] §4's sentence accepted as written, or the design changed until it can be
- [ ] §6 filled in for at least the first platform, by measurement
- [ ] The separate-worker deploy boundary (§4, last paragraph) agreed

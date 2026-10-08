# VM / Remote Browser Profiles — execution

> ⛔ **UPDATE 2026-10-09 (D79): read `docs/APPLY_WORKER.md` first.** It supersedes **V2 (the extension captures the session)** — capture is **mobile-first, in the Android app**, and **draft stores ciphertext it cannot read** (a per-session key minted by the worker). The security principles below stand: **device sign-in, then session upload; never a password.** **Step one is a spike (`APPLY_WORKER.md` §9), not this build list.**

**Build document.** The security design is `E3_SECURITY_DESIGN.md` — ⛔ **read it first and do not
re-derive it.** This is the work that follows from it.

Owner direction 2026-10-01: **build and wire this before AF5 completes**, so testing moves straight
from supervised applications into the VM path.

---

## ⚠ The sequencing risk, stated once

The roadmap had this last for a reason. Building it now inverts the safety order:

- **The pipeline has completed ONE real application.** AF5 — thirty supervised — is what establishes
  that the deterministic resolver, the four gates and the handoff work against real employers.
- ⛔ **Semi mode runs NEITHER the completeness gate NOR the low-confidence gate.** `isUnattended =
  isFullAuto || isPreview`. So the gates that would protect unattended running **have never fired
  against a real employer** — supervision has been the only control.
- **Full-auto has never run unattended against a real employer at all.**

⭐ **The mitigation that makes this safe:** build the infrastructure now, but **do not let it submit
unattended until AF5 and a supervised full-auto run have both passed.** The VM can be built, wired,
and exercised in a mode where a human still approves each submission. That gets the owner what they
want — no gap between AF5 and VM testing — without betting thirty real applications on machinery
nobody has watched.

⛔ **The kill switch must be verified MID-BATCH, not only at admission**, before the first
unattended run. That was proven once (1 of 3 submitted, 2 held) — re-prove it on this path.

---

## What this is, and is not

| | |
|---|---|
| ⛔ **Not** | a VM per user, idling |
| **Is** | an **encrypted browser profile** per user — cookies and localStorage, tens of MB — mounted into an **ephemeral container** per run, torn down after |

A worker pool. Railway supports this shape: a worker service with a mounted volume, or profiles in
object storage hydrated per run.

### What it buys

**The gated tier** — `automation_tier` `gated`/`account`: Workday, Meta, Amazon. Roughly 95% of the
board is `direct` and needs none of this.

⭐ **And it is the only thing that makes mobile auto-apply possible.** The gated handoff works
because the user's own desktop browser holds the authenticated portal session and the extension
borrows it for one gesture under `activeTab`. **There is no extension on a phone.**

---

## ⛔ The sign-in flow — the whole security design

**`E3_SECURITY_DESIGN.md` corrected its own parent here and the correction is load-bearing:**

⛔ **A streamed remote sign-in DOES pass the password through our servers.** The earlier design said
otherwise and was wrong. If the user types into a browser we are rendering, we are in the path.

⭐ **The design is device sign-in, then session upload.** The user signs in **on their own machine**,
in their own browser. What leaves is the **session**, not the credential.

| | Breach yields |
|---|---|
| Stored credentials | Passwords — permanent, reusable, frequently reused elsewhere |
| ⭐ Stored session cookies | **Time-limited, revocable by the portal, scoped to one site** |

**We never see the password. That is the property the whole feature rests on.**

### Storage

- **Envelope encryption.** ⛔ The KEK lives **outside the application environment** — not
  `COOKIE_ENCRYPTION_KEY`, not a Railway variable the app can read.
- **Crypto-shred revocation.** Revoking destroys the key, not the rows. The data becomes
  unrecoverable immediately rather than eventually.
- **Cookies and localStorage only.** ⛔ Never form values, never keystrokes, never a screenshot of
  a signed-in page.
- **The breach sentence** is written down in the design. ⛔ If it is uncomfortable to read, the
  design is not finished.

---

## ⛔ The 410 reversal

`/api/apply/session/*` returns **410**, with the replacement named. It was retired for precisely
this reason.

⛔ **Reversing it is legitimate but must be a RECORDED DELIBERATE REVERSAL** — in the code, in the
worklog, and in `CORRECTIONS_REGISTER.md` — not a feature that quietly arrives. State what changed
about the design such that the original objection no longer holds.

---

## The work

```
V1 · THE PROFILE STORE
  Encrypted profile per (user, portal origin). Envelope encryption, KEK outside the app env.
  Crypto-shred on revoke. ⛔ Nothing stored before the user has explicitly consented to THIS portal,
  and consent is per-portal, not per-account.
  ⛔ The user can see every stored profile and destroy any of them, and the UI says plainly what is
  held: "your signed-in session at myworkday.com, stored until you remove it or it expires."

V2 · DEVICE SIGN-IN AND SESSION UPLOAD
  The user signs in on their own machine. The extension (desktop) captures the session for that
  origin and uploads it.
  ⛔ The extension already holds the per-gesture activeTab grant and its own sessionLess token —
  reuse both. Do not invent a second credential path.
  ⛔ The extension's privacy disclosure CHANGES: it would now transmit a portal session, which its
  current listing explicitly says it does not do. Six storage keys are declared and one is
  transmitted. This makes a seventh, and it is the most sensitive. The Web Store data-use
  declaration, the privacy policy and PRIVACY_RECONCILIATION.md's join all change together, and the
  extension needs a version bump and re-review.

V3 · THE WORKER
  Ephemeral container per run. Hydrate the profile, run the existing applyAutomation.js flow, tear
  down. ⛔ The profile is never written back unless the portal rotated the session — and if it did,
  re-encrypt rather than storing the new value in the clear for even one hop.
  ⛔ A run that fails leaves the row RETRYABLE, exactly as enrichJob does. A 429 or a dead container
  must not stamp an application as attempted.

V4 · DETECTION AND TERMS — ⛔ ANSWER BEFORE BUILDING FOR A PORTAL
  · Datacenter IPs are the flagged shape for automated submission, and the gated portals are
    precisely the ones that check. Residential proxies are the usual answer and they are murky.
  · ⛔ SOME ATS TERMS PROHIBIT AUTOMATED SUBMISSION REGARDLESS OF WHO AUTHORISED IT. This is a
    PER-PLATFORM FACT. Check Workday, Meta and Amazon specifically before building for them, and
    report which allow it, which forbid it, and which are silent.
  · ⚠ "The user authorised it" is not a defence against a terms violation by us.

V5 · THE GATE
  ⛔ The worker may NOT submit unattended until AF5 and a supervised full-auto run have both passed.
  Until then it runs in a mode where a human approves each submission — same machinery, human in
  the loop.
  ⛔ Verify the kill switch MID-BATCH on this path before that changes.
```

## Verify

A session uploaded from the extension decrypts in a worker and reaches a gated portal signed in ·
revocation destroys the key and the next run fails closed · a failed run leaves the application
retryable · the kill switch stops an in-flight batch · the extension's listing, policy and
reconciliation join all agree about the new data flow · **the breach sentence is written down.**

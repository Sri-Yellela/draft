# Privacy — what D100 and D103 add, ready for the owner (not live)

> ✅ **APPLIED 2026-10-30 (D112 item 3) — effective October 31, 2026, the push day.** The owner's answers: no notice
> period (no registered users yet); the effective date is the push that applies it; **inbox mail kept 6 months = 180
> days** (`services/inbox.js` `INBOX_RETENTION_DEFAULT_DAYS`, swept at boot and daily whether or not
> `INBOX_RETENTION_DAYS` is set). Added beyond this draft: *Connecting Gmail* (D112 item 2, with Google's Limited Use
> affirmation) and *Reading Job Postings on Any Site* (D112 item 4, T35 = A). The live text is
> `client/src/pages/marketing/PrivacyPage.jsx`; the rows are in `extension/submission/PRIVACY_RECONCILIATION.md`
> § D112; `test/d112PrivacyText.test.js` pins them. This file is kept as the draft's record — the ⚠ lines below about
> the retention period and the notice decision are superseded.

**Status:** drafted 2026-10-30 (WORKLOG 43q) from the code as built, **not applied to the live policy**
(`client/src/pages/marketing/PrivacyPage.jsx`, effective October 25, 2026). D100 and D103 both say these disclosures
**ship in the same push** as the features. Every item below is a **MATERIAL** change — draft starts keeping new kinds of
data — so the policy's own *Changes to This Policy* commitment applies: **the owner chooses the effective date and
whether registered users are notified first** (as O85 / O87 were his). Then the agent moves the text into the page,
bumps `EFFECTIVE_DATE`, adds the change-log comment, and adds the rows below to `extension/submission/PRIVACY_RECONCILIATION.md`.

Nothing here is legal advice; it is a description of what the code does, for counsel to read with the owner.

---

## 1 · New policy text (for *Information We Collect*, after *Browser Extension*)

### Applying for You (the apply worker)

> If you choose to, draft can fill in and send applications for you on employer portals that require you to be signed
> in. You choose the mode: **SEMI** (the default — draft fills the application and waits for you to approve the
> answers it will send) or **FULL AUTO** (draft sends applications that match the filters, times and daily limit you
> set, without asking each time). Every application records whether you approved it or your FULL AUTO setting sent it.
>
> **Signed-in portal sessions.** To apply on a portal that requires sign-in, you can connect it. Your app seals the
> portal's session (its cookies) with a key that only our separate apply service holds; **draft's own servers store it
> only in that sealed form and cannot read it**. The apply service opens it only while it is applying for you. When you
> remove a portal, the key is destroyed, and every stored copy becomes unreadable.
>
> **Portal accounts draft creates for you.** If you agree for a portal, draft can create an account there for you,
> using **your own email address** and a password our apply service generates. The password is sealed the same way —
> draft's servers never see it. The account is yours: you can sign in to it with the portal's own "forgot password".
> Removing it in draft destroys our copy of the key; the account at the portal stays yours.
>
> **Agreeing to a portal's terms for you.** Only if you switch it on in Auto settings, draft ticks a portal's terms of
> service, privacy policy or data-processing consent box when an application or a sign-up requires it — never a
> signature, a statement that your answers are true, or a box that signs you up for marketing. Off (the default), the
> application waits for you to tick it yourself.
>
> **What the apply service will not do:** it never answers a CAPTCHA or other human check, and never guesses an
> eligibility answer (work authorisation, sponsorship, citizenship,
> clearance, criminal history) — those stop the application and wait for you. It never stores a screenshot of a page
> you are signed in to; it keeps the list of fields and the values it filled.

### Your Application Inbox

> If you turn it on, draft gives you a private forwarding address (`…@in.jobsviadraft.com`). You add a filter in your
> own email that forwards replies from job application systems to it; **employers keep writing to your real
> address**, and draft never connects to your mailbox. For each forwarded message we keep the sender, the subject,
> the time it arrived and its text (up to 20,000 characters; formatting removed; **attachments are never stored**),
> sort it into a category (applied, interview, assessment, offer, rejection and so on) by fixed rules — no AI model
> reads your mail — and link it to the application it is about. An interview or offer email updates that
> application's status. You can re-file or detach a message. Revoking your address stops new mail at once.
>
> **Verification codes.** If you allow it for a specific portal, our apply service may read a verification code that
> portal emails you, within 10 minutes of asking for it, to finish an application or an account it is creating for
> you. Each such read is logged and shown to you.

### Your Profile and Application Defaults

> Your profile is kept in sections (summary, experience, education, skills, links), filled from your résumé when you
> first open it; editing it never changes the résumé file you uploaded. **Application defaults** hold the answers you
> set for common questions (work authorisation, sponsorship, relocation, start date, voluntary self-identification);
> an answer you have not set is left blank and draft asks you, rather than assuming one.

## 2 · Third parties (for *Third-Party Services*)

- **Our apply service** — a separate service we run (on Railway, in its own project), which holds the session keys
  and opens your sealed sessions while it applies. It holds no database credentials.
- **Resend (inbound)** — receives mail sent to your forwarding address and passes it to draft.
- **The employer portals** you apply to receive what an application sends them, as they would if you applied by hand.

## 3 · Retention and deletion (for *Data Storage and Security* / *Your Rights*)

| Data | Kept | Deleted |
|---|---|---|
| Sealed portal session | until you remove the portal (or it expires at the portal) | with your account; removing it destroys the key |
| Sealed portal-account credential | until you remove it | with your account; removing destroys the key |
| The fields an application filled | with the application | with your account |
| Inbox messages | ⚠ **no retention period is built yet** — the owner sets one (e.g. 12 months) and the agent adds the sweep; until then, until you delete your account | with your account (cascade); revoking the address stops intake |
| Verification-code reads | the log row (which message, which portal, when) | with your account |

⚠ **D103 P1 asks for "retention and deletion in Settings"** — the settings switch and the sweep are **not built**; the
policy must not promise a period until they are.

## 4 · Rows for `extension/submission/PRIVACY_RECONCILIATION.md`

Nothing in the **extension** changes with D100 / D103 as built: the desktop "Let draft apply here while you're away"
(D100 P3, which needs the optional `cookies` permission) is **not built**, so the manifest, the store listing and the
dashboard's Privacy practices are unchanged. When P3 desktop is built, it adds a row: `cookies` (optional, requested at
that press) · the sealed upload (`/api/portals/upload`) · this policy's *Applying for You*.
⭐ **Superseded 2026-10-30 (D112 item 7): P3 desktop is BUILT (extension v1.6.0, not released) — its text is §7 below.**

## 5 · Play Store data-safety form (Android)

When the Android app ships the portal connect (D100 P3), the form gains: *Personal info → Other (portal session
cookies)* — collected, encrypted in transit, not shared except with the user's own employer portals, deletable.

## 6 · In-app consent copy (one line each, at the point of consent)

- **FULL AUTO:** "draft will send applications that match your settings without asking each time. You can switch
  back to SEMI or Stop everything at any time."
- **Connect a portal:** "draft stores your signed-in session for this portal sealed — it cannot read it. Only the
  apply service opens it, while it applies for you. Your password is never stored."
- **Create an account for me:** "draft will create a {portal} account with your email and a password only its apply
  service can read. You can always take it over with {portal}'s 'forgot password'."
- **Agree to terms for me:** "draft will tick a portal's terms, privacy or data-processing box for you when an
  application needs it. Never a signature or a statement that your answers are true. Off, those wait for you."
- **Read verification codes:** "draft's apply service may read a code {portal} emails you, within 10 minutes, to
  finish an application. Each read is logged."
- **Inbox:** "Forward replies from job sites to this address. Employers keep writing to your own email; draft never
  connects to your mailbox."

---

## 7 · D112 item 7 — the extension's "Let draft apply here while you're away" (BUILT in v1.6.0, NOT released)

⛔ **Apply ONLY in the push that uploads the extension version carrying it, on the owner's word** (D112 item 7: "built
now, released when the owner says"). Until then the live policy and the store listing stay true as they are: the zip
is built, but the feature is inert (`extension/applyAway.js` `PINNED_WORKER_IDENTITY` is empty until the owner pins the
deployed apply worker's identity, and nothing is offered while it is empty). This is a **material** change to the
extension's data handling.

**What the code does** (`extension/applyAway.js`, `apply-away.html` / `apply-away.js`; pinned by
`test/d112ApplyAway.test.js`): on a page of a portal draft can connect (today **amazon.jobs** only — `www.amazon.jobs`,
`amazon.jobs`, `account.amazon.jobs`) where the page shows the user is signed in, the dock offers *"Let draft apply here
while you're away?"*. The press opens a small window with the reasons; its **Allow and connect** asks Chrome for the
optional `cookies` permission and those three hosts. Granted, the extension asks draft for a key the apply worker minted,
**checks the key's signature against the worker identity built into the extension**, reads **only that portal's cookies**,
**seals them on the computer** to that key and uploads the sealed copy. draft's servers store it and cannot open it; the
apply worker opens it only while applying for the user. **Disconnect** deletes it there and the worker destroys the key,
so every stored copy becomes unreadable; the `cookies` permission is given back. No cookie is written or removed; no
other site's cookie is read; the portal password is never read.

**Policy — replace the extension bullet** *"It does not read, store, or transmit your session cookies, login credentials,
or any authentication token belonging to any other site…"* **with:**
> It does **not** read, store, or transmit your session cookies, login credentials, or any authentication token
> belonging to any other site — **with one exception you choose:** on a portal draft can apply on for you (today
> amazon.jobs), *Let draft apply here while you're away* reads that portal's sign-in cookies once, after you allow it
> (Chrome asks you for that site only), seals them on your computer so that only our separate apply service can open
> them, and sends only the sealed copy. Our own servers cannot read it. Disconnect at any time, in the extension or in
> Draft House → Portals: the key is destroyed and the stored copy can never be opened again. Your password is never
> read. The one credential it otherwise holds is its own — the access token described above.

**Policy — *Applying for You* → *Signed-in portal sessions*:** after *"Your app seals the portal's session (its
cookies)"* add *"— on Android, in the app; on a computer, in draft's browser extension —"*.

**`extension/submission/PRIVACY_RECONCILIATION.md` row:** `cookies` (optional permission, requested only in the
*apply here while you're away* window's Allow press, for one portal's hosts) · reads that portal's cookies once, sealed
in the extension to the apply worker's verified key · `/api/portals/upload` (ciphertext only) · Disconnect →
`DELETE /api/portals/:id`, the key destroyed · the policy's extension bullet (above) and *Applying for You*.

**Store listing / dashboard (the owner pastes at that upload):**
1. **Permission justifications — add `cookies` (optional):** *"Requested only when the user presses 'Let draft apply
   here while you're away' on a job portal draft supports (today amazon.jobs), with that portal's hosts only. The
   extension reads that portal's sign-in cookies once, seals them on the device to a key held only by our separate
   apply service (verified against a key built into the extension), and uploads the sealed copy so the service can
   apply for the user when they are away. Our servers cannot read it. Never another site's cookies; no cookie is written
   or removed; removed again on Disconnect."*
2. **Optional host permissions:** the three amazon.jobs hosts are requested under the existing optional `https://*/*`
   for this press — say so in the `https://*/*` justification.
3. **Privacy practices → Authentication information:** changes from *not collected* to **collected** — *"the sign-in
   cookies of one job portal the user chooses to connect, sealed on the device; our servers cannot read them; deleted
   on Disconnect."* (Remove *"It holds no `cookies` permission."*)
4. **Reviewer notes:** how to see it (a signed-in amazon.jobs page → the toolbar press → the line → the window), and
   that a reviewer without a deployed worker sees nothing (the line is offered only when draft's apply worker runs).

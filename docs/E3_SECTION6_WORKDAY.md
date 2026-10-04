# D22 — E3 §6 measured for Workday, and the §4 portal-domain gap

Research only, 2026-10-04 (session 25, D22). Two load-bearing facts were re-checked independently the same day: the host-only, no-`Expires` session cookies on the nvidia tenant, and the three Terms-of-Service clauses quoted verbatim. "MEASURED" means I fetched a public
page or asset myself today (no sign-in, no form, no submission). VERIFIED = I read the source at the
URL given. UNVERIFIED = inferred or secondary, not confirmed.

## Verdict

**For Workday, §6 doesn't rule E3 out on detection, but it limits it heavily, and two findings could still rule it out.**
(1) **Session lifetime and scope.** Every Workday session cookie I saw is host-only on the employer's
own subdomain (`<tenant>.wdN.myworkdayjobs.com`) and has no `Expires` date. So a stored session works
for one employer only, and how long it lives is set by Workday's server-side idle timeout, not by any
date we could read or show. That timeout is not measured; employee-side Workday sessions are 15–30
minutes. If the candidate timeout is similar, "sign in on the phone, apply later from the worker"
does not work for Workday. What remains is "sign in, then run straight away", once per employer.
(2) **Terms.** Workday's own Terms of Service ban "any applications that interact with our Sites
without our prior written consent" and letting "any other person or entity … use your account". The
career site's own code shows a "Continue with MyWorkday" sign-in that binds the candidate to those
terms. Whether the terms also cover ordinary per-employer email/password accounts is not settled; the
employer's own candidate terms also apply and differ by tenant. Under §6's rule (prohibited means not
built), this needs an owner/legal reading before any build.
(3) **Detection.** Every tenant I fetched sits behind Cloudflare Bot Management or Bot Fight Mode
(`__cf_bm` is set). Cloudflare documents that its JavaScript detections catch headless browsers.
Whether Workday challenges datacenter IPs is unverified. Workday's own anti-bot checks (honeypot,
timing, click filter) sit on the sign-in and create-account forms only, which shape A keeps on the
user's device.
**Cheapest decisive next step:** an owner-only check, with no automation and no datacenter. Sign in
to one tenant on a phone, leave it idle, and reload at 30, 60 and 120 minutes. If the session is dead
within about an hour, the datacenter-replay question no longer matters for Workday. Only if it
survives is the second test worth an owner decision: replay the same cookies once from a headful
browser on a worker, as a GET of Candidate Home only, never a submit — and only after the terms
reading.

**Why Workday first:** `VM_EXECUTION.md` puts Workday first in the gated tier ("Workday, Meta,
Amazon"). In the code, `services/jobs/automationTier.js` maps `workday: "account"`. It is the only one
of the three that covers many employers rather than one: Meta and Amazon are each one employer, so a
"no" there removes one company, while a "no" on Workday removes most of the account tier. And
`GATED_HANDOFF_ARCHITECTURE.md` (R2/R3) already has observations from a live Workday tenant.

---

## Task A — §6 for Workday, question by question

### A1. Do the terms prohibit automated submission? (§6 column 1; VM_EXECUTION V4)

**Answer: not "silent". Prohibitive where Workday's own terms apply; differs by tenant beyond that. Needs an owner/legal reading.**

- **VERIFIED:** Workday's Recruitment Privacy Statement does **not** apply to candidates of Workday
  customers: *"If you applied for a role with another company or Workday customer: This Privacy
  Statement does not apply."* The employer is the controller. [workday.com recruiting privacy statement]
- **VERIFIED:** Workday Terms of Service (last updated 08/13/2026). Scope: (a) workday.com, (b) *"any
  web pages, websites … or other documents … that directly reference these Terms"*, (c) Community,
  (d) Workday APIs. Prohibitions that bear on E3:
  - *"Develop or use any applications that interact with our Sites without our prior written consent"*
  - *"Use or attempt to use another user's account or information, share your log-in information, or
    otherwise allow any other person or entity to use your account, without authorization"*
  - *"Use any data mining, robots or similar data gathering or extraction methods designed to scrape or
    extract data"*; *"Bypass or ignore instructions contained in our robots.txt file"*.
- **MEASURED:** the career-site bundle (`wd5.myworkdaycdn.com/.../2026.40.17/cx-jobs.min.js`) lists
  these sign-in providers: `EMAIL_PASSWORD, USAJOBS, APPLE, GOOGLE, LINKEDIN, OKTA, ADMIRAL`. ADMIRAL is
  shown as "Continue with MyWorkday" and is sorted first. It carries the disclaimer *"By clicking
  continue with MyWorkday, you agree to Workday's {terms} and {privacy policy}"*, where {terms} links
  to `workday.com/en-us/legal/site-terms.html`. So a candidate who uses MyWorkday explicitly accepts the
  terms quoted above, and the account-sharing clause applies directly to a stored session that we use.
- **UNVERIFIED:** whether a tenant's plain email/password account brings in Workday's Terms. The
  reference appears only in the MyWorkday disclaimer, and only if the tenant has that provider turned
  on. I did not find a tenant page that shows it.
- **VERIFIED:** each tenant sets its own account-creation consent text ("Require Candidate Home
  Account" with an "Account Creation Consent Message") [doc.workday.com, Set Up Candidate Home
  Accounts]. So the employer's terms differ per tenant and would have to be read per employer.
  **UNVERIFIED:** whether typical tenant texts ban automation. I found no Workday-tenant example either
  way.
- **Side note (not E3-specific):** read broadly, the "applications that interact with our Sites"
  clause would also cover the existing desktop extension's gated handoff. Worth putting to the owner in
  the same question.

### A2. Is the session bound to IP or fingerprint? (§6 column 2; §0's open question)

**Answer: not measured, and it cannot be without an owner-run replay. The evidence points to binding to the device or browser, not provably to IP.**

- **MEASURED** (public GET of three tenants: nvidia wd5, salesforce wd12, walmart wd5). Responses come
  through Cloudflare (`Server: cloudflare`, `CF-RAY`). They set `PLAY_SESSION`, `CALYPSO_SESSION`,
  `CALYPSO_CSRF_TOKEN` and **`wd-browser-id`**, all `HttpOnly; Secure`, with **no `Domain` attribute
  (host-only)** and **no `Expires`** (they die when the browser closes). The middle segment of
  `CALYPSO_SESSION` is base64 of the tenant name (`bnZpZGlh` = nvidia, `c2FsZXNmb3JjZQ==` =
  salesforce). The page also embeds `geoIpCountryCode` from the server's IP lookup.
- **VERIFIED (Cloudflare docs):** `__cf_bm` is set *"on end-user devices that access customer sites
  protected by Bot Management or Bot Fight Mode"*, holds bot-score data, and expires after 30 minutes
  of inactivity. `cf_clearance` (issued after a challenge) is *"securely tied to the specific visitor
  and device … preventing reuse across machines"*. So a challenge passed on the phone does **not**
  carry over to the worker.
- **UNVERIFIED:** whether Workday's server checks that `wd-browser-id` and the session were created
  together, or compares IP or user agent on reuse. The cookie name suggests browser tracking; nothing
  public says how it is enforced.

### A3. Datacenter / headless detection (§6 "Detection")

- **MEASURED:** Cloudflare Bot Management or Bot Fight Mode is active on all three tenants (`__cf_bm`
  present). Same pod and same headers, so this is almost certainly Workday-wide, not per employer
  (inference).
- **VERIFIED (Cloudflare docs):** bot score comes from heuristics, machine learning and *"JavaScript
  Detections: catches headless browsers … and other automation tools"*; customers *"block, challenge,
  or allow requests based on their score"*. **UNVERIFIED:** which score threshold or action Workday
  uses, and whether a datacenter ASN alone triggers a challenge.
- **MEASURED (cx-jobs bundle):** Workday's own check, `addSpamBotProtection`, runs when the
  **sign-in/auth view** loads. It has three parts: a honeypot input `name="website"` labelled *"This
  input is for robots only, do not enter if you're human."*, a timed test (`N(500)`, probably a 500 ms
  minimum; meaning unconfirmed), and a `NoCaptchaButtonClickFilter` overlay on the submit button. No
  reCAPTCHA, hCaptcha or Turnstile URL appears in the bundle. These checks sit on the sign-in forms,
  which shape A keeps on the device. The application wizard itself is covered only by Cloudflare,
  as far as this bundle shows.
- **UNVERIFIED (secondary sources, not relied on):** vendor blogs (scale.jobs and others) say Workday
  flags fast, repetitive submissions. These are marketing claims with no evidence behind them.
- ⚠ **Mis-attribution to avoid:** search summaries credited "27-minute warning / 30-minute idle /
  4-hour access code" and "invisible CAPTCHA at sign-in" to Workday. Reading the sources shows the
  first is **Oracle Recruiting Cloud** and the second **Dayforce**. Neither is Workday evidence.

### A4. Session length, and one session per tenant? (decides whether a stored session is reusable)

- **MEASURED: one session per tenant.** The session cookies are host-only on
  `<tenant>.wdN.myworkdayjobs.com`, and `CALYPSO_SESSION` contains the tenant name. One sign-in, and
  one stored profile, per employer. **VERIFIED (secondary):** candidate accounts are per employer
  (froghire, jobwizard guides; Workday's statement that the customer controls the data).
- ⛔ **This breaks §1's key.** §1 stores a profile per *(user, portal **registrable domain**)*. Every
  Workday tenant shares the registrable domain `myworkdayjobs.com`, so that key would merge every
  employer's session into one profile. Workday needs the key to be the **host**.
- **MEASURED: no persistent expiry.** The session cookies have no `Expires`. §3's `min(the portal's
  own cookie expiry, 30 days)` therefore always falls back to 30 days for Workday, which overstates the
  real lifetime. D22's planned *"Meta will sign you out on 5 Oct"* copy cannot be produced for
  Workday from the cookies.
- **UNVERIFIED: the server idle timeout for candidates.** Employee-side Workday sessions are set per
  tenant, typically 15–30 minutes (for example WSU: 15–20 minutes, later 30) — VERIFIED for employees,
  only an analogy for candidates. No public Workday document gives the candidate timeout. This is the
  deciding unknown (see Verdict).
- No "remember me" or "stay signed in" option appears in the auth bundle (MEASURED: no
  `rememberMe`/`stayLoggedIn` strings).

### A5. Sign-in in a WebView allowed? (§6 column 3)

- **VERIFIED:** Google has blocked OAuth in Android WebView since 2021-09-30. Workday's "Sign in with
  Google" will therefore fail inside the app's WebView.
- **VERIFIED:** Workday's social sign-in is Google and Apple for candidate accounts, and is *"not
  support[ed] … for external career sites that use Embed Mode"*. The bundle also lists LinkedIn, Okta,
  USAJOBS and MyWorkday.
- **UNVERIFIED:** email/password sign-in in a WebView. Nothing found that blocks it; it is an ordinary
  form. **UNVERIFIED:** Apple, LinkedIn and MyWorkday in a WebView.
- **VERIFIED, applies to Embed Mode only:** iOS and Safari third-party-cookie blocking breaks
  *embedded* career sites. Direct `myworkdayjobs.com` pages are first-party. Do not read this as a
  WebView finding.

### A6. MFA / email verification

- **MEASURED (bundle):** a tenant feature flag `accountVerification` (default `true`). There are
  strings for resending account verification, *"Verify It's you … Send a verification link to your
  new email address"* (when the email is changed), and `FailedVerificationEmail`. **VERIFIED:** the
  tenant setting "Enable Candidate Verification Email" exists [doc.workday.com].
- **MEASURED:** no MFA, OTP or one-time-code strings in the candidate bundle. **UNVERIFIED:** whether
  a separate sign-in bundle adds MFA. Corroborating but secondary: another open-source Workday agent
  (OSApplyTrack #277) plans for "verification email read from the tenant's mailbox" on account
  creation and does not mention MFA.
- Effect on E3: creating an account and changing the email need the user's mailbox, which is fine on
  the device under shape A. Ordinary sign-in seems to have no second factor, so nothing beyond the
  idle timeout forces a fresh sign-in.

### §6 table, filled for Workday (proposed)

| Platform | Terms prohibit automated submission? | Session bound to IP / fingerprint? | Sign-in in a WebView allowed? |
|---|---|---|---|
| Workday | ⚠ Workday ToS prohibits "applications that interact with our Sites" and account sharing; applies at least to the MyWorkday sign-in; tenant terms differ — **owner/legal reading needed** | unmeasured; host-only and per tenant, no `Expires`, `wd-browser-id`; Cloudflare BM present; `cf_clearance` device-bound | email/password: probably yes (unverified); Google: **no**; Apple/LinkedIn/MyWorkday: unverified |

---

## Task B — the portal domain in §4

**The sentence being replaced** (`E3_SECURITY_DESIGN.md` §4, lines 116–121, verbatim):

> **An attacker who obtains the profile table AND the key-encryption key can act as the user on
> every portal the user connected — submit or withdraw applications, read application status, and
> read or change the profile the user keeps on that portal (which typically holds their address,
> phone number, work authorisation and sometimes demographic answers) — until the portal's session
> expires, the user disconnects, or the portal revokes it. They get no passwords, nothing on any
> other site, and no access to the user's email.**

**Proposed replacement** (keep the first sentence and add a second that covers the database-only
breach):

> **An attacker who obtains the profile table AND the key-encryption key can act as the user on
> every portal the user connected — submit or withdraw applications, read application status, and
> read or change the profile the user keeps on that portal (which typically holds their address,
> phone number, work authorisation and sometimes demographic answers) — until the portal's session
> expires, the user disconnects, or the portal revokes it. They get no passwords, nothing on any
> other site, and no access to the user's email. An attacker who obtains the database alone, without
> the key, can act as no one — but learns which employers each user holds a live session with, and
> when each was connected and last used: the portal host is stored in the clear and names the
> employer (`metacareers.com`; for Workday, the tenant subdomain, e.g. `<employer>.wd5.myworkdayjobs.com`),
> and the use log names the applications. That is a list of the employers each user is pursuing. It
> is not new exposure: `job_applications` and `application_records` already hold the company, role
> and job URL of every application in the clear, so the same breach yields it today without E3.**

Two matching edits to go with it: in §1, change "Metadata, unencrypted:" to "Metadata, unencrypted
**and sensitive** (see §4):", and replace "portal domain" with "portal **host**" (see A4: for Workday
the registrable domain is the wrong key).

**The repo fact behind the last clause** (read from `server.js`): `job_applications` (line 465)
stores `company, role, job_url` per `user_id`. `application_records` (line 3911) stores `job_id,
state, submitted_at, evidence_url`. Both are plaintext.

### Options

| Option | How the Settings list and use log work | Cost | What it buys |
|---|---|---|---|
| 1. Encrypt the host under the profile's own data key | The list needs a KMS unwrap per profile, but §2 says the web app never decrypts → the web app can't render the list | Breaks §2's boundary, or forces the list through the worker | — |
| 2. Encrypt the host (and use-log text) under a separate per-user metadata key the web app can read | Web app decrypts to render. Worker lookup ("is there a profile for this job's host?") needs a blind index: `HMAC(k_index, user_id‖host)` | New key, blind index, rotation; use-log rows encrypted too | Protects a database-only breach **for the E3 tables only**. The employer list still leaks from `job_applications` |
| 3. Plaintext, documented ⭐ | Unchanged: list and log query by `user_id` | One sentence | Honest. Matches the rest of the database |

**Recommendation: option 3.** Keep the host in plaintext and replace the sentence as above.
Encrypting it alone would protect nothing: the same breach reads the employer list from
`job_applications.company`, and the §4 sentence would then imply privacy that does not exist. If the
owner wants the employer list protected, that is a database-wide decision (encrypt `company`, `role`
and `job_url` in the application tables too). It belongs in its own row, not in E3. Option 2 is the
design to use if that decision is made.

---

## Sources

Read and relied on:
- Workday Terms of Service — https://www.workday.com/en-us/legal/site-terms.html
- Workday Recruitment Privacy Statement — https://www.workday.com/en-us/privacy/recruiting-privacy-statement.html
- Workday docs, Social Sign-In for Candidate Accounts — https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/career-sites/concept--social-sign-in-for-candidate-accounts.html
- Workday docs, Steps: Set Up Candidate Home Accounts — https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/career-sites/gtv1538650489786.html
- Workday docs, Steps: Set Up External Career Sites — https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/career-sites/san1431625385171.html
- Workday docs, Troubleshooting: External Career Sites (Embed Mode cookie note) — https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/career-sites/lng1653000955284.html
- Cloudflare cookies — https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/
- Cloudflare bot score — https://developers.cloudflare.com/bots/concepts/bot-score/
- Cloudflare clearance — https://developers.cloudflare.com/cloudflare-challenges/concepts/clearance/
- Google OAuth embedded-webview block — https://developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint.html
- WSU, Workday session length (employee side, analogy only) — https://modernization.wsu.edu/2021/02/02/increase-to-workday-session-length/
- OSApplyTrack issue #277 (secondary) — https://github.com/CryptoJones/OSApplyTrack/issues/277
- Per-employer accounts (secondary) — https://www.froghire.ai/blog/why-new-workday-account-each-employer

Measured directly (public GET, 2026-10-04):
- `https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite` (headers and HTML), `/robots.txt`
- `https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site`, `https://walmart.wd5.myworkdayjobs.com/en-US/WalmartExternal` (headers)
- `https://wd5.myworkdaycdn.com/wday/asset/candidate-experience-jobs/2026.40.17/cx-jobs.min.js`

Checked and **rejected as Workday evidence**: https://docs.oracle.com/en/cloud/saas/talent-management/faimh/career-site-session.html (Oracle) and https://help.dayforce.com/r/documents/Recruiting-Guide/CAPTCHA-Image-Verification (Dayforce).

Repo: `docs/E3_SECURITY_DESIGN.md` §§0,1,3,4,6; `docs/VM_EXECUTION.md` V4; `docs/WORKLOG.md` D22; `services/jobs/automationTier.js`; `server.js` lines 465, 3911.

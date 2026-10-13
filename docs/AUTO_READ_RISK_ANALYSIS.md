# Auto-read, auto-capture and remembered answers — risk analysis and judgement

**Requested by the owner, 10-13:** *"Auto-read — we are not auto-capturing; might as well do that after reading, and see if it is a good ATS read for the site in general, if not for the user — maybe a CS job that fits someone else's profile. We can add that to the disclaimer. First run a risk analysis and give me a judgement call."* · *"If the user acknowledges an answer it is good enough for the copy sheet: tick once, not asked again unless the user changes it — a change is recorded as changed and not stored until re-acknowledged."*
**Not legal advice. Counsel confirms the legal and store-policy conclusions before anything ships to users.**

---

## 1 · The judgement, in one table

| # | Capability | Verdict | One line why |
|---|---|:-:|---|
| R1 | **Auto-read** the page's structure on sites I switch on | **GO, with conditions** | The same read "Read this page" makes today, minus one click, on hosts the owner grants. |
| R2 | **Auto-prepare** the answers once read | **GO** | No model, no slot, nothing leaves the machine that doesn't already. |
| R3 | **Auto-capture to MY account** (D64, extended to the sites I add — Workday included) | **GO, with conditions** | A user-facing feature for that user; **an irrelevant posting is still discarded without being stored** — the promise already in the listing. |
| R4 | **Auto-fill** when everything is prepared | **GO, as its own switch, default off** | Filling is not submitting. **Terms, consent, attestation and signature boxes are never ticked.** |
| **R5** | **Keep postings that do not fit the user, for the shared board** (the owner's proposal) | **NO-GO from the browser** | Contradicts the declared single purpose and the listing's own promise; browsing activity collected for a purpose that is not the user's feature. See §3. |
| R6 | Share the *link* of a job as a lead for the board | **DEFER** | Smaller than R5 but the same class of data. Revisit at publication. |
| R7 | **"Suggest this company"** — a two-click, user-initiated button that sends the company's public job-board address | **GO (later, small)** | A user-facing action with a preview of what is sent, like *Report this form*. It gets the owner "a CS job for someone else's profile" without collecting anyone's browsing. |
| R8 | **Read quality** — show the user "14 of 18 fields recognised · good read / partial read" | **GO (local only)** | It is for that user's feature. Sending quality counts to draft is **DEFER** (optional diagnostics, later). |
| R9 | **Remember an acknowledged answer, eligibility included — one tick, not asked again** | **GO, with safeguards** | The user stated it; the risk is staleness and legal attestations, both mitigated (§5). |

---

## 2 · What already exists, and what it promises
From `extension/submission/STORE_LISTING.md` (the text the Web Store reviewer reads):
- **Automatic capture exists (D64), opt-in, off by default,** on five public hosts via optional host permissions. A page that **is a posting** is sent to the **user's account**, where *"our server decides whether it fits their board — **and discards an irrelevant posting without storing it**."*
- ***"A page that is not a posting sends nothing — not its address, not a hash."***
- **Single purpose:** *"Help the user apply to the jobs they choose: get the job postings they are looking at into **their own** Draft account … and, when they invoke the extension on an application form … fill it with answers they have already given us."*
- **Every read begins at a click or a keystroke**, except automatic capture, which is off until switched on.
**So the product's shape is deliberately user-scoped and data-minimal. Those sentences are promises** — in the listing, and by extension in the privacy policy — and the owner's proposal would reverse one of them.

---

## 3 · R5 in detail — why "capture it anyway, it may fit someone else" is a NO-GO from the browser

**The policy.** Chrome Web Store's User Data policy treats *"collecting web browsing activity and any information about the website content … including the domains or URLs the browser interacts with"* and *"clipping or scraping content from a website that the user visits"* as **user data**. It allows web browsing activity to be collected and transmitted **only to the extent required for a user-facing feature that is prominently described** in the store page **and** in the UI, with the **prominent disclosure and consent inside the product's UI** — and it names *"collects web browsing activity in the background for another purpose"* as a violation. **A posting stored for someone else's benefit is collected for another purpose.** *(Source: developer.chrome.com/docs/webstore/user_data — counsel and the agent re-read it before any change.)*

| Risk | L | I | Why |
|---|:-:|:-:|---|
| **Web Store removal or rejection** — the extension's declared single purpose and its listing say "discards an irrelevant posting"; storing it contradicts both | M | **H** | The only published build is unlisted v1.0.0; a rename + new host + new optional permission is already "the shape that triggers an in-depth review". A purpose change is worse. |
| **Privacy and trust** — *which jobs a person looks at* is sensitive; **someone employed and quietly looking at competitors' roles is exactly the person this would expose** | M | **H** | A feed of "jobs viewed" is a job-search diary. The user did not choose to publish it. |
| **Terms of the sites** — many browsers each reading Workday pages into one store is **distributed scraping** | M | M | Today's server-side discovery uses public ATS boards under D75/D80's conservative posture; browser-sourced capture bypasses that posture. |
| **Poisoning** — a page crafted to look like a posting; injected text | M | M | Browser-sourced content cannot be trusted; it would need a server re-fetch to verify, which makes the browser's copy pointless. |
| **Board rules cannot be enforced** — D78 (CS only, 120 days), D80 (**evidence per company**, no staffing agencies, no VC boards), and the **LinkedIn / Indeed / Glassdoor exclusion** | H | M | A browser cannot supply a company's hiring evidence; excluding forbidden hosts reliably in a browser is fragile. |
| **Contradicting the privacy policy** — "not stored" becomes "stored for others" | **H** | **H** | A policy that says one thing while the code does another is the worst outcome. |
| **Data quality** — partial reads from varied pages | H | L | Duplicates and half-postings in the shared board. |

**Verdict: do not do R5 from the browser.** *"A CS job that fits someone else's profile"* is a real goal; the board already grows that way **from the server**.

**What gets the same result safely**
1. **Server-side discovery, which exists:** the weekly Hacker News sweep, the nightly probe of candidate companies, the Google Jobs searches, the curated pool (D80–D82). It uses **public ATS boards the server fetches itself**, applies D78/D80 admission, keeps **evidence per company**, and never involves a user's browsing.
2. **R7 "Suggest this company"** — on a company's job pages the user clicks **Suggest**, sees *exactly* what would be sent (**the company's public job-board address and the ATS family — nothing else, not the job, not the account, not what they typed**), and confirms. It feeds **Admin → Companies → Candidates**, where the owner approves (the trust ladder, D82). **It is a user-facing action, not background collection** — the same shape as *Report this form*.
3. **Read quality, locally (R8)** — the panel says *"14 of 18 recognised — good read"* or *"partial read — check these"*. If a site reads badly, the user presses the **existing *Report this form*** (labels only, two clicks). That is how "is it a good ATS read for the site in general" gets answered **without** harvesting anyone's browsing.

---

## 4 · The GO items — conditions

**R1 · Auto-read**
- **Opt-in per site, default off** (D97): each switch asks Chrome for that site's optional host permission **at the click**; off revokes it.
- **A first-use disclosure inside the extension (not only the listing)** — *what is read* (the job's title and company; the form's question labels and structure); *what is never read* (anything typed, any password or payment field); *what is sent* (the labels, to match your answers — what "Read this page" sends today); *how long it is kept* (30 days, on your machine).
- **Skips** password and payment inputs and any field with a typed value. **Never** on LinkedIn, Indeed or Glassdoor (the sites draft never reads for jobs). A **kill switch** stops every automatic behaviour.
- A **debounced** watcher (Workday changes steps without changing the URL); ten rapid changes make one read.

**R3 · Auto-capture to my account**
- D64's behaviour, offered for **each site the owner adds** (Workday first). **A page that is not a posting sends nothing; an irrelevant posting is discarded and not stored** — unchanged.
- **Its own switch, separate from read and prepare**, so a person can read without capturing.
- **Undo** and **"Captured today"** (the popup already says *"1 today · 0 already on your board"*) stay.
- The disclosure says: *"A job page you open on this site is sent to your draft account. draft keeps it if it fits your board and discards it if it does not. It is never shared with other people."*

**R4 · Auto-fill** — off by default, behind its own warning; **fills, never submits**; every field is **verified after filling**; **terms, consent, privacy-notice, attestation ("I certify…") and signature controls are never ticked or filled by the extension, whatever was remembered.**

---

## 5 · R9 — remembered answers: the lifecycle the owner chose

**The rule.** *Tick once and it is remembered; it is not asked again unless the user wants to change it. A change is recorded as a change, and the new value is **not stored** until the user acknowledges it again.*

```
            acknowledge                     edit
  (asked) ─────────────► ACKNOWLEDGED ───────────────► CHANGED (this application only)
     ▲                    reused by every               │  history row: from → to · when
     │                    fill and the Copy sheet        │  the old value is NO LONGER auto-used
     │                                                   │  the new value is NOT stored
     └───────────────────── asked again ◄────────────────┘
                                                         │ acknowledge the new value
                                                         ▼
                                                    ACKNOWLEDGED (new value)
```
- **Applies to every category, eligibility and voluntary disclosures included** — the owner's call. The answer is the **user's own stated answer**, never a guess (D36 stands: exact-or-blank for anything the user has not stated).
- **A change writes a history row** (what, from → to, when, which job) and the panel shows *"You changed this — acknowledge to remember it."* Declining leaves it **unremembered**, so the next application **asks again** — no stale value survives a change.
- **Settings → Saved answers** lists each answer with its **state**, **date acknowledged** and **history**, with **Edit** and **Delete**.

| Risk | L | I | Mitigation |
|---|:-:|:-:|---|
| **Stale eligibility** — work-authorisation or sponsorship status changes (a permit lapses, a visa converts) and an old "Yes" keeps being filled | M | **H** | **A quiet, non-blocking review reminder** every 90 days for eligibility and disclosure answers (*"You last reviewed your work-authorisation answers in July"*), shown in Settings and once in the panel. The answer stays valid; the user is nudged. |
| **A legal attestation filled for the user** | L | **H** | **Never tick terms, consent, privacy-notice, attestation or signature controls** — carve-out in the code and a test. |
| **A question that looks the same but is not** (a different country, a different option wording) | M | M | The saved answer is keyed by the **normalised question label + widget kind + option wording**; a material difference is a **new** question and is asked. |
| **A shared computer / a second person** | L | M | Saved answers live in the account, not the browser; Disconnect clears the local copy. |
| **Invisible reuse** | M | M | A remembered answer still **appears in the review panel** (under *Filled*, marked *"you acknowledged this on 11 Oct"*) and, for eligibility, keeps *"you are attesting to this"* in the Copy sheet. Nothing is silent. |
| **Voluntary disclosures** (gender, race, disability, veteran) | L | M | "Decline to self-identify" is a valid, storable answer; the user ticks it once like any other. |
**Judgement: GO.** The two real risks (staleness, attestations) have concrete mitigations.

---

## 6 · Staged rollout
1. **Stage 1 — read + prepare** (R1, R2, R8-local), opt-in, on Workday first. *Exit:* the owner's own Workday flow reads and prepares correctly through the five steps.
2. **Stage 2 — auto-capture to my account** (R3) on the sites I add. *Exit:* no non-posting page sends anything (a test); the popup counts correctly.
3. **Stage 3 — auto-fill** (R4), its own switch. *Exit:* every fill is verified; no consent box is ever ticked.
4. **Later — R7 "Suggest this company"** and the answer-review reminder.
5. **Never from the browser:** R5. **Revisit only if** the owner publishes and wants shared-board contributions — then it needs **a separate, prominent, in-UI consent; URL-only; server-verified; counsel's review; and the Web Store's review** — not a quiet default.

## 7 · Disclosure wording (the Options page, in plain words)
> **Read pages automatically** — on the sites you choose, draft reads the job's title and company and the form's question labels. It never reads what you type, and never a password or payment field. The labels are sent to your draft account to match your saved answers, and kept on your computer for 30 days.
> **Capture jobs automatically** — a job page you open on those sites is sent to your draft account. draft keeps it if it fits your board and discards it if it doesn't. It is never shared with other people.
> **Fill automatically** — draft fills the form once your answers are ready. It never submits, and never ticks a box that agrees to terms or states something on your behalf.

## 8 · Updates to the plan (made 10-13)
- **D97** now has **four switches:** Read · Prepare · **Capture to my account (D64, extended)** · Fill — all default off, each explained. R5 is **removed** from scope; **R7** and the optional diagnostics are listed as *later*.
- **D96 §4** is rewritten to the lifecycle in §5, with the carve-outs.
- **D98** — *build D* is confirmed.
- **Version:** the listing already says **v1.5.2** (the agent bumped before the "no bump" instruction). **Keep v1.5.2 as the single local working version; do not bump again; fold every further fix into it.**

## 9 · Decisions — CONFIRMED by the owner, 10-13
1. ✅ **R5 is a NO-GO from the browser;** the alternatives in §3 stand (server-side discovery, **Suggest this company** later, local read quality).
2. ✅ **The 90-day review reminder** for eligibility and disclosure answers: **yes** (non-blocking).
3. ✅ **Build D** for the résumé; **four auto switches** (Read · Prepare · Capture to my account · Fill), all default off.
*Still open, minor:* hosts to offer beyond Workday and the five D64 hosts (SmartRecruiters, iCIMS, Taleo, SuccessFactors) — **ship Workday + the five now; add the rest later.**

## 9b · (the original list, kept for the record)
1. **Confirm the NO-GO on R5** and the alternatives in §3 (server discovery, R7 later, local read quality).
2. **R9's 90-day review reminder** for eligibility and disclosure answers — yes or no? (Recommendation: yes; it never blocks.)
3. **Hosts to offer in D97 beyond the five:** Workday is first; add SmartRecruiters, iCIMS, Taleo, SuccessFactors later?

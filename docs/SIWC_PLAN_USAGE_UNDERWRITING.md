# Sign in with ChatGPT (plan usage) — underwriting, privacy, compliance, plan

**Written 2026-10-09 · D89 · companion to `CLAUDE_CONNECTOR_COMPLIANCE.md` and `BYO_MODEL_EXPANSION.md`.**
**Status:** design and diligence. Nothing is built. **Read §0 first — it corrects what I said before.**

---

## 0 · Verdict, and the correction

**Last turn I proposed: *draft's server calls OpenAI's Responses API with each user's token.* That architecture is NOT permitted by OpenAI's own terms.**

OpenAI's *Sign in with ChatGPT Terms* say, in substance:
- **§1** *"Any persistent storage of Authentication Tokens must be local and under the user's control, not in a remote or managed environment."*
- **§2 User control** *"Requests must originate from the user's local runtime, or a remote runtime only that user controls."*
- **§2 User authorization** *Requests must be for the authenticated user and arise from their activity or expressly authorised automations; **obtain express consent before background use**; another user's activity must not trigger requests to the authenticated user's account.*
- **§2 Connected application only** *Use the plan only for the application the user connected; no general-purpose API access for other tools.*
- **§4** *No pooling, transferring, reselling, gifting or sharing plan usage or tokens; no multiple accounts, rotating accounts or splitting usage to bypass limits.*
The docs add: *keep access, refresh and ID tokens in **protected local or self-hosted runtime storage**, and **out of browser storage**, source control, logs, analytics and support transcripts.*

**A multi-tenant server on Railway holding many users' refresh tokens is a "remote or managed environment" that is not "only that user's".** On the published terms it is **ruled out**.
⚠ *The terms I read are the open-source / local flow's. A **hosted commercial partner** (interest form, "limited trial for selected commercial partners") may be offered different terms — **nobody outside OpenAI can know.** Do not build on a hosted design until OpenAI says so in writing.*

**So there are three architectures. Verdict per architecture:**

| | Architecture | Terms fit | Verdict |
|---|---|---|---|
| **H** | **Hosted** — draft's server holds tokens and calls OpenAI | ✗ §1, §2 | **Not viable** unless OpenAI grants a written partner exception |
| **L** | **Local runtime** — a program on the **user's own machine** does the sign-in and the OpenAI calls; draft's server never sees OpenAI tokens and only receives the **output** to verify and store | ✓ §1, §2, §4 | **Viable in principle; storage form needs OpenAI's confirmation** (below) |
| **P** | **Plugin** — the user's ChatGPT calls draft's MCP tools (the other ChatGPT route) | n/a — no tokens at all | **Viable**; gated by directory approval and a testing workspace |

**The local runtime has two forms, and they differ on the "browser storage" line:**
- **L1 · the browser extension.** *Pros:* nothing new to install for current users. *Cons:* an extension's `chrome.storage` is **browser storage**; the docs say to keep tokens **out of** it. **Whether an extension counts as a "local runtime" with "protected local storage" is a question for OpenAI.**
- **L2 · a small native helper** (open-source) holding tokens in the **OS keyring**, reached by the extension over native messaging. *Compliant on any reading; heavy to build and distribute.*

**Recommendation:** treat **P (plugin) as the ChatGPT route**. Use the **interest form** to ask the one question that decides whether **L1** is allowed. **Never build H.**

### What was read, and what was not
**Read:** SIWC *Overview*, *Preview limitations*, the *Accounts and sessions* and *Registration and sign-in* extracts, the *Sign in with ChatGPT Terms* (the clauses quoted above), OpenAI's *Plugin guidelines*; third-party summaries (WorkOS, DEV, eesel, loginwith.ai) **only to cross-check**.
**Not read — Phase 0 reads them:** the full Terms (§3, §5 onward), the *On your website* page (the hosted flow), the official *UI/UX guidelines*, *Models and inference*, *Errors and recovery*, *Token reference*, OpenAI's Usage Policies and Privacy Policy as they apply to plan usage.
⚠ The product is a **preview**, launched at DevDay on 2026-09-29; **terms will move.**

---

## 1 · Compliance matrix — Sign in with ChatGPT Terms and docs

| Clause | Requirement | H (hosted) | L (local) | Control / evidence |
|---|---|:-:|:-:|---|
| §1 | Obtain tokens only through the supported flow; **never ask for passwords or session cookies** | ✓ | ✓ | standard OAuth + PKCE; a test greps for cookie handling |
| §1 | Keep account info and tokens secure | ✓ | ✓ | §5 |
| §1 | **Persistent token storage local and under the user's control — not remote or managed** | **✗** | ✓ | L only |
| §2 | **Requests originate from the user's local runtime, or a remote runtime only that user controls** | **✗** | ✓ | L only |
| §2 | Requests are for the authenticated user and **arise from their activity** | — | ✓ | **only on the user's click** — see below |
| §2 | **Express consent before any background use** | — | ✓ | **no background generation** |
| §2 | **Another user's activity must not trigger requests on this user's account** | **✗** | ✓ | a per-user local runtime cannot |
| §2 | **Connected application only; no general-purpose API access** | ✓ | ✓ | the runtime exposes **no proxy** and uses the token **only** for résumé generation |
| §4 | No pooling, reselling, gifting, sharing of tokens or plan usage | ✓ | ✓ | no admin or support path can read a token |
| §4 | No multiple accounts, rotating accounts, or splitting usage to bypass limits | ✓ | ✓ | **no account rotation; no silent fallback** |
| docs | **Serialise refreshes** for one session (rotating refresh token) | — | ✓ | a mutex; a test for two concurrent refreshes |
| docs | Tokens **never in URLs, logs, analytics, support transcripts** | ✓ | ✓ | log scrubbing test; D88's ticket tool never captures them |
| docs | Treat a valid ID token as **not** authorising plan usage; check the granted scope | ✓ | ✓ | scope check before every inference |
| docs | Reuse the issued `client_id` and a **stable host id**; keep registrations separate per account | — | ✓ | one record per account |

**A design rule that follows from §2: generation is always foreground.** *D52's "the Draft click IS the start"* means a queued job can run without the user watching. **A queued job must never spend the plan.** The plan is used **only** for an interactive "Write it" the user just clicked, **in the page the user is looking at.**

---

## 2 · Privacy underwriting (architecture L; the same rules govern P)

### 2.1 Data flow — who sees what

| # | From → to | What | Notes |
|---|---|---|---|
| 1 | draft → the user's extension | the **brief**: base résumé bullets (with ids), claims, keywords, job basics | **no contact details; no eligibility or EEO** (D86 DR-4) |
| 2 | **the user's device → OpenAI** (`api.openai.com`) | the brief and draft's static instructions, as one Responses request, **`store: false`** | **draft's server is not in this path** |
| 3 | OpenAI → the user's device | the proposed patch (streamed) | |
| 4 | the user's extension → draft | the **patch only**, for the claim guard, scoring and storage | the existing extension token (D87) |
| 5 | OpenAI ↔ the user's device | OAuth tokens (access 1 h; refresh 30 d, **rotating**) | **never sent to draft** |

### 2.2 Roles and legal basis
- **draft** is the **controller** of account and résumé data. **For step 2, OpenAI processes the content under the *user's own* OpenAI relationship** (their ChatGPT plan and terms). **draft is not OpenAI's customer here and signs no processing agreement with it.**
- ⚠ **But draft designs what is sent** (the brief, the instructions) and **initiates the transmission through its software.** A regulator could treat draft as a **(joint) controller of that transmission.** *Counsel Q2.* **Mitigation:** disclose it plainly; get **express, separate, revocable consent**; send the minimum; give the user a **preview of what will be sent.**
- **Legal basis (GDPR):** **consent** for the OpenAI transmission (a distinct, optional feature), **contract** for the draft service itself. **US:** notice and choice (state privacy laws); **no "sale" or "sharing"** — draft transfers no data to OpenAI and gets nothing from it.

### 2.3 Minimisation, retention, rights
- **Minimisation:** the brief carries **bullets and claims, not the whole résumé**; **no contact details, no DOB, no address, no photo, no eligibility answers, no EEO**. **The user can exclude individual bullets before sending.**
- **Special-category risk:** résumés can reveal **religion, disability, political or union affiliation, nationality, health** through ordinary content (a society membership, a volunteer role, a work-authorisation line). *Mitigations:* a **pre-send review** ("this is what will go to OpenAI"), the **exclude** control, **no automatic inclusion of eligibility lines.**
- **Retention:** **draft** — résumé versions per the policy (D88's retention list). **OpenAI** — governed by the user's ChatGPT data settings and OpenAI's terms; **`store: false` is required** for this flow. ⚠ *Whether plan-usage requests are excluded from training, and for how long they are retained for abuse monitoring, is **not stated in what I read.** Read OpenAI's data-use pages for plan usage; **never promise more than they say.***
- **Rights:** access, deletion and export of **draft's** data through D88's utilities; **for OpenAI's copy, link the user to OpenAI's process.** **Revoking the grant is done in ChatGPT Settings → Usage**; draft's *Disconnect* clears the **local** record and **says so honestly** (*it does not revoke at OpenAI*).
- **Children:** draft is **18+.** *(OpenAI's own plugin rules mention ages 13–17 — a separate question for the plugin route; counsel Q6.)*
- **Cross-border:** user device → OpenAI (US); draft hosted in the US. **EU users:** note the transfer; counsel Q3 on mechanisms.

### 2.4 Notices and consent — what must say what
- **Privacy policy — a section "Writing with your ChatGPT plan":** what is sent, **that it goes from the user's device directly to OpenAI under their account**, that **draft never receives their OpenAI tokens**, that **draft's server is not in that path**, retention at each end, how to disconnect and revoke, contact.
- **Consent screen** (separate from sign-up, **off by default**): *"Use my ChatGPT plan to write résumés. Your résumé bullets and the job's keywords are sent from this device to OpenAI. They count against your ChatGPT plan, and your own weekly cap applies. draft never sees your OpenAI sign-in."* **Not bundled with the terms.**
- **Required plan-usage UI** (from a third-party summary; **verify against OpenAI's official UI/UX page**): the *Continue with ChatGPT* button · a one-time *"You're using your ChatGPT plan"* notice · a *"Using ChatGPT plan"* label near the control · a *"Manage usage"* link to ChatGPT's usage settings · **kept clearly separate from draft's own plans.**
- ⛔ **This is a deliberate exception to "users see no cost internals" (the cost-hiding prompt): it is the user's *own* plan, and OpenAI requires it be shown.**

### 2.5 Chrome Web Store consequence (L1 only)
- The extension would need **host permissions for `auth.openai.com` and `api.openai.com`** and would **handle authentication information.** **That is a change in privacy practices** — **new permission justifications, the data-use disclosures, the Limited Use certification, the privacy policy and `PRIVACY_RECONCILIATION.md` all change** (D44.2).
- ⛔ **Recommendation: ship it as a SEPARATE extension** (*"draft for ChatGPT"*), **not inside the main extension** — so the main listing's review and the O85 upload are **not** disturbed, and a refusal costs nothing else.
- Chrome's remote-code rule: **prompts ship inside the package**; nothing is fetched and executed.

### 2.6 DPIA triggers (a documented assessment — keep on file)
Systematic processing of résumé content · a new recipient (OpenAI) · special-category possible · automated generation affecting a person's job prospects (**no automated decision about them — the user decides**). **Conclusion expected: a short DPIA, low-to-medium risk with the §2.3 controls.** *Counsel confirms.*

---

## 3 · Compliance underwriting beyond the SIWC Terms

| Area | Position | Controls |
|---|---|---|
| **Fraud and falsified records** (OpenAI Usage Policies — to be read in Phase 0) | Same exposure as Claude: a tool that tailors résumés can be misused to invent experience | **The claim guard is mandatory and server-side**; it runs on step 4, so **no fabricated patch is ever saved** |
| **AI-assisted applications** | Employers' own terms; ambiguity | the AI-assistance notice (DR-13) |
| **Employment-law regimes** (automated employment decision tools, e.g. NYC Local Law 144) | Aimed at **employers'** screening tools; draft is **applicant-side** | **no tool ranks or screens people**; ToS bars employer-side use |
| **EU AI Act / GDPR Art. 22** | No decision about a person is made by draft | state in the DPIA |
| **Consumer protection (FTC)** | Claims about *"free"* and *"uses your own plan"* must be true | the copy says whose limits apply, and that **a weekly cap may stop a résumé mid-way** |
| **Platform terms — Anthropic's AUP** | The Usage Policy bars routing requests **through consumer subscriptions**; **this path uses *OpenAI's* explicitly permitted mechanism only** | **never** build a Claude equivalent that stores a user's Claude session |
| **Brand** | *"Sign in with ChatGPT"* and the button have branding rules | follow OpenAI's UI page; don't imply endorsement |
| **Accessibility** | Consent and error screens | keyboard-operable, both themes |

---

## 4 · Security underwriting — token custody (architecture L)

**Threats:** a stolen refresh token spends the victim's plan and reads nothing else (the grant excludes conversations), **but it is an account-linked credential** · malware reading browser storage · a logged token · a support screenshot · a **rotation race** that logs the user out · **account mix-up** when a user has several ChatGPT accounts.
**Controls:**
1. **Store only the refresh token and the ID token; derive access tokens on demand** (1 h).
2. **L2 (native helper):** the **OS keyring**, owner-only. **L1 (extension):** *only if OpenAI confirms extension storage is acceptable* — **encrypt at rest with a non-extractable WebCrypto key**, and **never** in `localStorage` or page-reachable storage.
3. **A mutex around refresh**; persist the *replacement* token before using it.
4. **Scope check before each request:** the granted scopes must include `chatgpt.tokens.use.direct`.
5. **No logging of tokens or of any request body**; a log-scrubbing test; **no analytics event carries them.**
6. **Account separation:** one record per issued `client_id` and verified identity; the active account is **shown**.
7. **Disconnect:** stop requests → end the renewable session → clear the tokens; **tell the user how to revoke at OpenAI.**
8. **No fallback:** an expired or failed grant **never** switches to an API key or to another account; it shows *"Sign in again."*
9. **Incident plan:** a bug that exposes a token → instruct users to **revoke in ChatGPT Settings**, publish a notice, rotate our client registration.

---

## 5 · Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| S1 | **Building H** and finding it forbidden | M | **H** | **never build H** without a written exception |
| S2 | OpenAI says an extension is **not** a local runtime | M | M | ask in the form; **L2** fallback; the plugin route remains |
| S3 | **Never selected** for the commercial trial | **H** | L | nothing depends on it; the plugin route stands alone |
| S4 | Terms change in the preview | **H** | M | snapshot and diff the Terms and the docs monthly |
| S5 | The user's weekly cap stops a résumé mid-job | **H** | L | the "write it with draft" fallback; clear copy |
| S6 | A background job spends a user's plan (violates §2) | M | **H** | **generation is foreground-only**; a test |
| S7 | Token exposure | L | **H** | §4 |
| S8 | A regulator treats draft as a controller of the OpenAI transmission | M | M | consent, preview, minimisation, counsel Q2 |
| S9 | Prompts retuned for OpenAI models underperform | M | M | the **local prototype** measures it *before* any build |
| S10 | The Chrome review reacts to new permissions | M | M | **a separate extension** |

---

## 6 · Gates (nothing is built before G2)

| Gate | What | Who | Exit |
|---|---|---|---|
| **G0 · Read** | the unread SIWC pages and OpenAI's Usage Policies; snapshot the Terms | agent | a one-page diff |
| **G1 · Ask** | **submit the interest form with the exact questions below**; ask counsel Q1–Q6 | **owner** | the submission receipt |
| **G2 · Prototype locally** | the owner's **own** local script (*personal project, running locally — allowed without approval*) runs the résumé path on their **own Plus** account | owner + agent | **ATS lift, guard pass, blind pick vs today** |
| **G3 · Decide** | build L1, L2 or neither, on G1's answer and G2's quality | owner | a logged decision |
| **G4 · Build behind a flag** | provider abstraction, the local runtime, the consent and UI, the tests | agent | tests green |
| **G5 · Verify** | the compliance matrix, the token tests, the foreground-only test, a counsel read | agent + counsel | signed off |
| **G6 · Ship** | a **separate extension** → the Web Store | owner | live |

**Tests (each red when removed):** the OpenAI token is **never sent to draft** · no request body or token in any log · generation runs **only on a user click** (a queued job cannot call it) · a missing `chatgpt.tokens.use.direct` scope refuses to run · a failed grant **does not fall back** · two concurrent refreshes yield one valid token · the consent is **off by default** and **separate from sign-up** · **the patch is claim-guarded before it is saved.**

---

## 7 · Interest form — draft text (edit, then submit)

> **Company / app:** draft (jobsviadraft.com) — a job-application workspace for job seekers.
> **What we want to do:** let a signed-in **Plus or Pro** user write a **tailored résumé** using **their own ChatGPT plan**. The user clicks "Write it" in a browser extension; the extension (**a program running on the user's own device**) signs the user in with ChatGPT, requests plan usage, and sends a Responses API request **directly from the user's device** (`store: false`, streamed). **draft's server never receives OpenAI tokens and makes no request to OpenAI.** The extension returns only the **proposed text** to draft, where it is **validated** (a deterministic check that nothing is invented) and saved.
> **Plan-usage uses:** résumé tailoring only. **No background use**, no queued generation, no general-purpose proxy.
> **Data sent to OpenAI:** résumé bullets and job keywords, **no contact details, no eligibility or demographic data**, and a preview the user approves.
> **Questions:**
> 1. **Is a free browser extension, acting as the user's local runtime, eligible for plan usage under the Sign in with ChatGPT Terms (§1 and §2)?** If not, would an open-source native helper be?
> 2. **Our extension stores tokens in encrypted extension storage. Is that "protected local storage", or must tokens be in the OS keyring?**
> 3. **Is there a hosted-app path, and if so what terms apply to token custody?** *(We will not build a hosted design without written confirmation.)*
> 4. **Are plan-usage requests excluded from model training, and what retention applies?**
> 5. **Timeline and selection criteria for the commercial trial.**
> **Users:** pre-launch; a small beta first. **Contact:** the owner.

---

## 8 · Questions for counsel
1. **Q1** — AI-assisted applications: notice sufficiency; employers' terms.
2. **Q2** — Is draft a (joint) controller of the device-to-OpenAI transmission its software initiates?
3. **Q3** — Cross-border transfer mechanism for EU users (device → OpenAI).
4. **Q4** — What the privacy policy must say about OpenAI's retention when we cannot state it.
5. **Q5** — Whether the consent screen satisfies "express consent" for plan usage under the SIWC Terms and GDPR.
6. **Q6** — Age gating (18+) against OpenAI's 13–17 language for plugins.
7. **Q7** — Liability if a user's weekly cap or a revoked grant fails a résumé mid-application.

## 9 · Decisions for the owner
- **D1 · Submit the interest form** (G1) — *yes recommended; it is free.*
- **D2 · Run the local prototype** (G2) on your Plus account.
- **D3 · If L1 is allowed: a separate extension** (recommended) **or** inside the main one.
- **D4 · Treat the plugin (P) as the primary ChatGPT route** — *recommended; SIWC is an opportunistic add-on.*

---

## 10 · Paste-ready WORKLOG row

> **D89 · SIGN IN WITH CHATGPT (PLAN USAGE) — an opportunistic second ChatGPT route, underwritten 10-09.** *(Full text: `docs/SIWC_PLAN_USAGE_UNDERWRITING.md`.)* **CORRECTION: the earlier idea — draft's server calling OpenAI with each user's token — is NOT permitted** by OpenAI's Sign in with ChatGPT Terms (**§1: persistent token storage must be local and under the user's control, not in a remote or managed environment; §2: requests must originate from the user's local runtime or one only that user controls; express consent before background use**). **Three architectures: H (hosted) ✗ never build without a written exception · L (a local runtime on the user's device; draft's server never sees OpenAI tokens) — viable in principle, L1 = the extension (storage form to be confirmed by OpenAI), L2 = an open-source native helper with the OS keyring · P (the plugin) — the primary route.** **Eligibility:** Plus and Pro only; commercial hosted apps are a **limited trial via an interest form**; **a preview** (`store:false`, `stream:true`, many Responses fields unsupported). **Hard rules:** **generation is FOREGROUND-ONLY — a queued job never spends a user's plan**; no silent fallback to another provider or account; no token in any log, URL, analytics or ticket; the plan is used for résumé generation only. **Privacy:** the device sends the brief (bullets, claims, keywords — no contact details, no eligibility or EEO) **directly to OpenAI under the user's own account**; draft receives only the patch and **claim-guards it**; **a separate, off-by-default consent with a pre-send preview**; a policy section; **if L1, a SEPARATE extension** (new host permissions and authentication-information handling would otherwise reopen the O85 review). **Gates:** G0 read → **G1 submit the interest form (owner)** → G2 **a local prototype on the owner's own Plus** (ATS lift, guard pass, blind pick) → G3 decide → G4 build behind a flag → G5 verify → G6 ship. **Owner decides:** submit the form · the prototype · a separate extension · P as the primary ChatGPT route.

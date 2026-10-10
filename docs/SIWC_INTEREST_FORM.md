# Sign in with ChatGPT — the interest form

**What this is:** OpenAI's waitlist for *commercial* apps that want "Sign in with ChatGPT" and, optionally, to let users spend their **own ChatGPT plan** on AI requests.
**Where:** **https://openai.com/form/sign-in-with-chatgpt-interest/**
**Do you have to submit it?** **No.** Nothing else in the plan depends on it. **It is free and takes ten minutes**, so it is worth doing — but **expect a long wait and a real chance of no reply** (see "Odds").

---

## Before you submit — checklist
- [ ] **One person submits: the owner.** *A second submission from the developer would look like a duplicate and confuse the reply.*
- [ ] **Use the company-domain email — `yellela.s@jobsviadraft.com` — in the "Work email" field.** *It matches the website you enter, it is the address OpenAI will answer, and it proves the routing works.* **Send yourself a test email first** and confirm it reaches Gmail.
- [ ] **`https://jobsviadraft.com` loads, and the privacy policy is live** (OpenAI may look).
- [ ] **No ChatGPT or Plus account is needed to submit.** *The form takes a work email, a name, a company and a website. Nothing asks for a ChatGPT login.*
- [ ] **Do not put the developer's ChatGPT account, email or any token anywhere in the form.**
- [ ] **Keep a copy** (screenshot or text) and **write the date in the WORKLOG.**

---

## The fields (as the form currently shows them) and what to enter

| Field | Enter |
|---|---|
| **Work email** * | `yellela.s@jobsviadraft.com` |
| **First name** * / **Last name** * | your legal name |
| **Company name** * | `draft` *(if a legal entity exists or is planned, use that name — ask counsel; see Q8 in the compliance document)* |
| **Website URL** * | `https://jobsviadraft.com` |
| **Job title** | `Founder` |
| **What capabilities would you like to implement?** | **Sign in and ChatGPT plan use for AI requests** |
| **Which of your products would use Sign in with ChatGPT?** | `draft — a job-application workspace for job seekers (web app and a Chrome extension)` |

**Fields the earlier (2025) version of this form also asked — answer them if they appear:**
| Question | Honest answer |
|---|---|
| Size of your user base (weekly users) | **Pre-launch / fewer than 1,000** |
| How do you charge for AI features today? | **We do not charge yet. The AI feature (résumé tailoring) is currently provided at our cost; a subscription is planned.** |
| Are you an OpenAI API customer? | **No.** *(Do not claim otherwise.)* |

### The free-text answer (if there is a "tell us more" box)

**Short version (~600 characters):**
> draft helps job seekers tailor résumés and track applications. We'd like Plus/Pro users to write a tailored résumé using their own ChatGPT plan. Our design: a program running on the user's own device signs the user in and sends a Responses API request directly from that device (store: false); our server never receives OpenAI tokens and makes no OpenAI requests. Only the proposed text returns to us, where a deterministic check ensures nothing is invented. Generation happens only on the user's click — never in the background. We'd welcome guidance on whether a local runtime like this is eligible.

**Long version (use if the box is large):**
> draft (jobsviadraft.com) is a job-application workspace: it finds roles, scores a candidate's résumé against them, and helps tailor the résumé and track applications. Résumé tailoring is our one AI feature.
> **What we want:** let a signed-in Plus/Pro user write a tailored résumé with their own ChatGPT plan, instead of us paying for the model.
> **How we'd build it so it respects the Sign in with ChatGPT Terms:** the user clicks "Write it" in a browser extension. The extension — a program on the user's own device — signs the user in with ChatGPT, requests plan usage, and sends a Responses API request directly from the device (store: false, streamed). **draft's server never receives or stores OpenAI tokens and makes no request to OpenAI.** The extension returns only the proposed text to draft, where a deterministic check confirms nothing is invented (no skill, title, employer or date the user doesn't have) and saves it.
> **Scope:** résumé tailoring only. No background use, no queued generation, no general-purpose proxy, no account rotation. The data sent to OpenAI is résumé bullets and job keywords — **no contact details and no eligibility or demographic data** — shown to the user for approval before sending.
> **Questions:** (1) Is a free browser extension acting as the user's local runtime eligible? If not, would an open-source native helper be? (2) Is encrypted extension storage acceptable for tokens, or must they be in the OS keyring? (3) Is there a hosted-app path, and what token-custody terms apply? We will not build a hosted design without written confirmation. (4) Are plan-usage requests excluded from model training, and what retention applies? (5) What is the timeline and selection criteria?
> **Technical contact:** [developer name and email]. **Stage:** pre-launch; a small beta first.

---

## Who is the developer in all this?
- **The developer's Plus account is not used for the form.** It is for a later **local prototype**: *"personal projects that run locally"* are allowed to use plan usage **without approval.**
- **The prototype rules (OpenAI's terms):**
  - The developer signs in with **his own** ChatGPT account and spends **his own** plan. **Never share a token, a login or a session with anyone — including you.** *(The terms ban sharing and pooling plan usage.)*
  - **You cannot use his account**, and he cannot "lend" it to the company. **If you want to test it yourself, you need your own ChatGPT plan** *(Go, Plus and Pro are all eligible, per OpenAI's help page — Go is the cheapest).*
  - It runs **locally on his machine**, with **fake sample résumé data** — never real users' data — and **no tokens stored in the repo.**
  - **Keep it a small open-source or clearly personal script** so it sits inside the "open-source / personal local" eligibility; do not run it as a service.
  - **If his ChatGPT account is an employer's, he must not use it.**

---

## What happens next
- **Expect an auto-reply at most.** There is no stated timeline.
- **Do not submit again.** If nothing arrives in **3–4 weeks**, reply once to any confirmation, from the same address.
- **Odds — be realistic.** OpenAI says it is *"currently offered to a select group of commercial partners"*, and the launch partners named are **Airtable, GitLab, HubSpot, Notion, Supabase and Vercel.** A pre-launch product is a long shot. **Nothing is lost by trying, and nothing should wait for it.**
- **If you hear back:** forward it to the agent and counsel **before** replying — the answers to questions 1–4 decide whether anything gets built.
- **If you never hear back:** the plugin route (D86) is the ChatGPT route. Nothing else changes.

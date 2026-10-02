# The Recruiter Layer — design and execution

**Design document. Nothing here is built.** ⛔ Do not write any of it into `ARCHITECTURE.md`.

⚠ **Not currently scheduled.** This layer appears in `PRODUCT_MODEL.md` as recorded-for-later and
nowhere in the worklog. FE-6 built a recruiter surface with **no front door** — no recruiter role,
no signup path, no acquisition story. This document is what it would take to make that a product.

---

## The central idea

**Reverse the matching.** A recruiter uploads a hiring profile; it is ATS-assessed exactly as a
candidate's résumé is; they receive a **daily draft of candidates** rather than a searchable
database.

⭐ **The same scorer runs both directions.** A job description against a résumé is the same
comparison whichever side initiated it. No second matching engine — `@draft/ats-scorer` serves both,
and every improvement to it improves both sides at once.

---

## ⛔ The vibe comes from restraint, not from UI

The owner's framing — *find your match, not the hectic job market* — is a **mechanics** decision,
not a visual one. It fails if the UI is calm and the mechanics are a search box.

**The asymmetry that governs everything:** one candidate applying to thirty jobs is normal. One
recruiter contacting thirty candidates is normal. **Thirty recruiters contacting one candidate is
spam.** Candidates are the scarce side, so the product protects them structurally.

Four mechanics, and the product is a job board with extra steps without them:

| | |
|---|---|
| ⭐ **Double opt-in** | A recruiter drafts a candidate. The candidate sees *"a recruiter at Stripe is interested"* and accepts or passes. **Contact is impossible before mutual interest.** This single decision is what separates this from LinkedIn Recruiter |
| ⭐ **Caps on both sides** | Recruiters get a daily draft too, and it is small. ⛔ **Unlimited recruiter search destroys the model.** Scarcity is what makes a draft mean something |
| ⭐ **Blind-first** | Candidates appear with skills, experience shape and fit band — **no name, no photo, no exact location** — until mutual interest. Reduces bias, makes the match about fit, and is cheap to build |
| **Transparency both ways** | Each side sees *why* — which terms matched, which did not. The ATS report already does this for candidates; recruiters get the mirror |

---

## Three personas, not two

| | Wants | Gets | Sees candidates? |
|---|---|---|---|
| **Candidate** | A job | Daily draft of roles | — |
| **Recruiter** | A hire | Daily draft of candidates, blind-first | ⛔ Only opted-in, only blind, only until mutual |
| **ATS partner** | Scoring for their own product | API + MCP | ⛔ **Never.** Tooling only |

⛔ **The ATS partner tier is NOT a recruiter tier.** A Greenhouse or Lever integration wants the
scorer, the parser and the formatter as an API. **It never touches candidate data.** Conflating them
is how a tooling contract becomes a data-sharing contract.

---

## ⛔ Consent and the integrity line

**§7 says: companies and roles only, never individual dossiers.** A candidate profile shared with a
recruiter is **not** a §7 violation — it is user-generated and consented, which is categorically
different from a KB built from scraped data. ⛔ **But the line must be stated explicitly**, or the
first person to read §7 and this document together will conclude one of them is wrong.

**The consent rules:**

1. **Opt-in per profile, not per account.** A candidate may share their Software Engineering profile
   and not their Data Science one
2. **Revocable, and revocation is retroactive** for anything not yet mutual
3. ⭐ **The candidate sees who viewed them** — before mutual interest, as "a recruiter at Stripe",
   after it, by name
4. ⛔ **Nothing is shared by default, ever.** Not a pre-ticked box, not an opt-out. The AG2 claims
   surface already follows this rule and the copy is the model: *"claiming a term says it is true of
   you"*
5. **The privacy policy and the Web Store data-use declaration both change.** Candidate data going
   to a third party is a new disclosure. `PRIVACY_RECONCILIATION.md`'s join gains a column

⚠ **Discrimination exposure.** Showing recruiters names, photos and locations creates real legal
risk in hiring. **Blind-first mitigates it structurally** rather than by policy, which is why it is
a mechanic and not a nicety.

---

## Ideas worth building

### ⭐ Grade the employer's posting

The hiring profile goes through the ATS scorer **as a document to be assessed**, not only as a
query. *"Your posting names no specific technologies"* · *"78% of this is boilerplate"* ·
*"'rockstar' and 'ninja' narrow your applicant pool"*.

**This is the most novel thing available here.** Everyone grades candidates; nobody grades the
employer. It is deterministic, free, uses machinery that exists, and it is the single best reason
for a recruiter to try the product.

⚠ They will hate it and they will use it.

### ⭐ Mutual-fit, not one-sided fit

A candidate's fit for a role and a role's fit for a candidate **are not the same number.** A senior
engineer is a poor match for an intern posting *and* vice versa — the seniority guard already knows
this in one direction.

Show **both** bands. A match where one side is Strong and the other Weak is worth surfacing *as
that*, not averaged into a middling score.

### Recruiter accountability as a visible signal

**Response rate, measured.** *"This recruiter replies to 80% of mutual matches."* Candidates decide
whether to accept with that in view.

⛔ It must be measured, never self-reported — it is the same discipline as flag-don't-fabricate, and
it is the thing that makes a recruiter's draft worth accepting.

### The draft is dealt, both ways

Reuse `UI_REDESIGN.md`'s deck. Recruiters get the same ritual: ten candidates, dealt, considered,
done. **The symmetry is the product** — both sides doing the same calm daily thing.

### A pass is final and both sides know it

No re-surfacing, no "they viewed you again" nudges. ⛔ **Those mechanics are exactly the hectic
job-market feeling the owner is trying to avoid**, and dating apps that added them got worse.

---

## ⭐ FUTURE — the employer side flips the ATS answer

**Owner, 2026-10-01:** the recruiter layer means **employers become customers**, and that inverts
every conclusion the 10-01 ATS investigation reached.

### What that investigation found, and why it flips

It concluded: no ATS submission integration is possible, because **every path requires credentials
from each individual employer** — Greenhouse, Lever, Ashby and Workable API keys; Workday
integration users; SmartRecruiters partner OAuth. A deal with the *vendor* unlocks nothing. A
candidate-side tool cannot qualify for LinkedIn Apply Connect, Indeed Apply or any equivalent,
because those are configured **on the employer's side** and each employer opts in.

⭐ **That was the right answer for a candidate-only product. It is the wrong answer once employers
sign up.**

**An employer with a recruiter account can authorise their own ATS.** They already hold the
credentials; the blocker was never technical, it was that we had no relationship with them. The
recruiter side *is* that relationship.

### The sequence this creates

```
1  Candidates use the product. Browser automation fills employers' forms — the only route
   available, and what every comparable tool does.
2  Employers join as recruiters, for the reverse draft and grade-the-posting.
3  ⭐ An employer connects their own ATS — their key, their consent, their instance.
4  Candidates applying to THAT employer submit through the integration instead of the browser.
   Faster, more reliable, and no form-filling failure modes at all.
```

⭐ **Each integration is a per-employer win, not a platform-wide one** — and that is fine. It is
also a reason for an employer to sign up: *"connect your ATS and applications arrive structured."*

### ⭐ What becomes worth revisiting, and when

| | Now | Once employers are on board |
|---|---|---|
| **ATS submission integration** | ⛔ Not possible | ⭐ **Possible, per employer, with their consent** |
| **SmartRecruiters partner programme** | ⛔ Not worth it — each employer must still connect, and the board has **zero** SmartRecruiters rows | ⭐ **Worth applying.** It is the only open partner route, and an employer asking to connect is the signal that makes the paperwork worth it |
| **Apply Connect / Indeed Apply** | ⛔ A candidate-side tool does not qualify | ⚠ Still employer-configured. Revisit only if an employer asks |

⛔ **Do not build any of this before employers exist.** The investigation's conclusion stands for
today: **browser automation is the architecture, not a workaround.** This section is the trigger
list for when that changes — not a plan to start now.

⚠ **And one thing that does not flip: Recruitee's unauthenticated submission endpoint.** It is meant
for a company's own careers site, so using it without permission is unauthorised regardless of who
else joins. 4 rows of 2,616. **Never build on it.**

---


| | Why it blocks |
|---|---|
| ⛔ **Outcome data** | `job_applications` is **empty**. "The match works" is unvalidated — ρ = 0.746 is against the owner's own judgement of 30 postings, and nothing connects any score to an employer replying. **A two-sided product whose matching is unvalidated will fail on both sides at once** |
| ⛔ **Candidate supply** | Zero users. A recruiter's first draft would be empty. ⚠ The classic cold-start problem, and the candidate side must be real first |
| ⛔ **The student pivot** | The board is **3.0% entry/intern**. If draft serves students, recruiters hiring students need a candidate pool that does not exist either |
| **Public profiles** | No candidate-facing profile exists to share. Needs building, and it is the thing recruiters actually see |
| **Recruiter identity** | ⚠ Verifying someone is really at Stripe. ⭐ **The company KB can do this** — email-domain to known-employer matching is a real use of data already held |

---

## Execution order, when it is scheduled

1. **Candidate supply first.** No recruiter product without candidates. This is downstream of AF5,
   the daily draft and real users
2. **Public candidate profiles** — opt-in, blind-first by construction, revocable
3. **Recruiter accounts and verification** — separate signup, separate session scope, KB-backed
   employer verification
4. **Hiring profiles + grade-the-posting** ⭐ the standalone-valuable piece, and the acquisition hook
5. **The reverse draft** — scoring candidates against a hiring profile
6. **Double opt-in and the contact channel**
7. **Accountability signals** — needs volume before the numbers mean anything

⛔ **Step 4 is shippable alone.** Grade-the-posting needs no candidates, no consent surface and no
matching. It is a free tool for recruiters that puts the brand in front of them before the two-sided
product exists — the same acquisition logic as the free ATS connector.

---

# The KB expansion

Separate from the recruiter layer, requested alongside it.

## Today

`company_org_units`, `company_technographics`, hiring signals. Read by the **9.6 failsafe**, which
flags résumé claims against company facts. Built only from **company-emitted data** — never from
claims.

## Wanted

**In ATS scoring** · **in generation as a sanity check** · **as API and MCP**.

### ⭐ The generation sanity check is the strongest use, and it is urgent

**G1 is live: generation invents content.** Kafka lifted from a job ad, two unsourced responsibility
bullets. The claim guard checks only years and seniority.

⭐ **The KB can catch a class of this that nothing else can.** If a generated résumé claims a team,
a title or a technology at a named company, the KB knows whether that company has it.

⚠ **It will not catch everything** — "Kafka" is not a company fact. But it catches the
company-shaped fabrications, and it is machinery that already exists and already does exactly this
for the failsafe.

⛔ **Extend the existing failsafe; do not build a second checker.** Two systems judging the same
question is this codebase's most-repeated defect shape, and the failsafe already has the
confidence-and-provenance discipline.

⛔ **A false "this does not match" is the costly error** — §7 names it. The Bangalore incident is the
precedent: a *location* was parsed as an org unit and flagged against a **true** claim. Any
extension inherits that risk.

### In ATS scoring — ⚠ with a caveat

A candidate at Stripe being scored against a Stripe posting is a real signal. But ⛔ **the scorer is
deterministic, local, free and makes zero model calls**, and that is why the daily draft can score
thousands of rows. **A KB lookup must not make scoring stateful or slow**, or it breaks the property
everything downstream depends on.

**Precompute into the scoring input; never query per score.**

### API and MCP

⚠ **Verify first, do not assume:** `POST_MIGRATION_DESIGN.md` names ATS scoring as the top MCP
candidate, and Resume Master's `/mcp` is live (returns 401 unauthenticated). ⛔ **Whether ATS scoring
is actually exposed over API and MCP today is unconfirmed** — check before designing a KB tool
beside it.

**If ATS scoring is not exposed, that is the first thing to ship**, before any KB tool. It is the
deterministic, free, genuinely-useful one.

**A KB tool would answer:** *"What teams does Stripe have?"* · *"What is Notion's stack?"* ·
*"Is this company hiring in infrastructure?"*

⛔ **Companies and roles only. No individual dossiers.** §7 is absolute and becomes a contractual
promise the moment it is an API.

---

# Job profiles into account management

The owner also asked to move job profiles into an extended profile section.

⚠ **Small on the surface, load-bearing underneath.** `domain_profiles` is the per-profile scoping for
the board, the scorer, the bridge, generation and CC5's per-`(user, profile, job)` keying. Moving
where it is *edited* is a UI change; ⛔ moving what it *is* would touch every one of those.

**Scope it as: relocate the editing surface, change no schema.**

⭐ **And fix the thing that makes it confusing today.** The one control that genuinely moves curation
is a textarea labelled **"Extracted Titles / Keywords / Skills"**, sitting in the Profile panel away
from every surface where a user learns a term matters — and `/signals/refresh` or a résumé re-upload
**silently overwrites their edits**. If profiles move, that is the moment to fix the label, the
placement and the silent overwrite.

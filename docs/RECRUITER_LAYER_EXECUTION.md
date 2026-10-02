# Recruiter Layer + KB — execution

**Build document.** The design and its reasoning are in `RECRUITER_LAYER.md`; this is the work.

⛔ **Nothing here is scheduled.** Most of it blocks on candidate supply, which does not exist. Two
pieces do not — **R1 and K1** — and both are shippable alone. This file exists so the work is ready
when the dependency clears, not so it starts now.

**All proposals accepted by the owner, 2026-09-30.**

---

## What can be built now, and what cannot

| | Task | Blocked on |
|---|---|---|
| ⭐ **R1** | Grade the employer's posting | **nothing** |
| ⭐ **K1** | KB sanity check on generation | **nothing** — attacks G1 directly |
| **K2** | KB in ATS scoring | K1 |
| **K3** | KB over API + MCP | ⚠ verify ATS scoring is exposed first |
| **P1** | Job profiles into account management | nothing, but low value alone |
| R2 | Public candidate profiles | real users |
| R3 | Recruiter accounts + verification | R2 |
| R4 | The reverse draft | R2, R3 |
| R5 | Double opt-in + contact | R4 |
| R6 | Accountability signals | volume |

---

## ⭐ R1 — Grade the employer's posting

```
THE ONE PIECE THAT NEEDS NOTHING. No candidates, no consent surface, no matching, no recruiter
accounts. A free tool that puts the brand in front of recruiters before the two-sided product
exists — the same acquisition logic as the free ATS connector.

⭐ EVERYONE GRADES CANDIDATES. NOBODY GRADES THE EMPLOYER. That is the whole idea, and it runs on
machinery that already exists.

WHAT IT MEASURES — all deterministic, all from the existing extractor
 · SPECIFICITY — how many extracted terms are real technologies vs generic language. The
   generic-language classifier already exists (it correctly holds Managed, Partnered, Coordinated,
   Grew) and the corpus gives the baseline: the head of 6,130 distinct skill strings is SOFT SKILLS,
   not technologies — cross-functional collaboration 498, communication 435, then python at 164.
   A posting whose terms are all head-of-distribution is saying nothing.
 · BOILERPLATE RATIO — how much is company copy versus role content. Measurable against the corpus:
   text that appears across many postings from the same company is boilerplate by construction.
 · REQUIREMENTS CLARITY — does it state required vs preferred? ⚠ The detection rate for a
   requirements section was never measured across 20 postings; do that first and report it. If it
   is low, say so rather than scoring a third of postings and silently skipping the rest.
 · SENIORITY COHERENCE — "5+ years" on a posting titled Junior. The seniority guard already knows
   this comparison.
 · NARROWING LANGUAGE — "rockstar", "ninja", "work hard play hard". ⚠ Evidence-based list only,
   not opinion. If you cannot cite why a phrase narrows a pool, leave it out.

⛔ CONSTRAINTS
 · ZERO MODEL CALLS. Same property as scoreAtsLocally — deterministic, local, free, instant. It is
   what lets this be a free public tool.
 · ⛔ COMPARATIVE, NOT ABSOLUTE. "Your posting names 3 specific technologies; the median engineering
   posting on our board names 11" is defensible. "Your posting scores 42/100" is not — and the
   score-vs-band lesson is live: the ATS panel showed "58" beside "Strong match" and the number was
   the defect.
 · ⛔ NEVER A LEAGUE TABLE OF EMPLOYERS. Grading a posting someone submits is a service. Publishing
   rankings of companies who did not ask is a different product with different legal exposure.
 · Rate-limit it. It is public, and the anonymous-spend lesson stands: /api/standalone/generate was
   Sonnet at 8192 tokens with a quota keyed on a cookie the caller controls.

VERIFY: run it over 50 real board postings and report the distribution. ⛔ If every posting scores
the same, it is measuring nothing — that was the v3 ATS engine's exact failure, where the whole
remaining spread was sd 2.87 on a 0-100 scale.
```

---

## ⭐ K1 — KB sanity check on generation

```
⛔ G1 IS LIVE: GENERATION INVENTS CONTENT. Two real documents claimed things the candidate never
did — Kafka lifted from the job ad, two unsourced responsibility bullets, an unsourced skill. The
prompt forbids it; the claim guard checks only YEARS and SENIORITY, so both passed. This blocks
AF5.

⭐ THE KB CATCHES A CLASS OF THIS THAT NOTHING ELSE CAN. If generated output claims a team, a title
or a technology AT A NAMED COMPANY, the KB knows whether that company has it.

⚠ IT WILL NOT CATCH EVERYTHING. "Kafka" is not a company fact. Say so plainly in the report — an
over-claimed guard is worse than a narrow one, because the next person stops looking.

⛔ EXTEND THE 9.6 FAILSAFE. DO NOT BUILD A SECOND CHECKER. It already does exactly this comparison,
already has confidence and provenance, and two systems judging one question is this codebase's
most-repeated defect shape.

⛔ A FALSE "THIS DOES NOT MATCH" IS THE COSTLY ERROR — §7 names it, and there is a precedent:
"Bangalore" was flagged as not matching any Stripe team because a LOCATION was parsed as an org
unit, against a TRUE claim. The fix excluded locations before matching; any extension inherits that
risk and must be checked the same way.

WHAT IT CHECKS
 · a team or org unit at a named employer → company_org_units
 · a technology claimed at a named employer → company_technographics
 · a title shape inconsistent with what that company posts

⛔ WHAT IT DOES NOT DO
 · judge whether the candidate is good
 · learn from the résumé — ⛔ §7: THE KB GROWS FROM COMPANY-EMITTED DATA ONLY. A generated claim is
   not evidence about a company and must never be written back
 · block generation outright. It FLAGS. flag-don't-fabricate cuts both ways: the system does not
   invent, and it does not silently delete a claim it cannot verify

WHERE IT RUNS: before the artifact persists, alongside AF2's hard assertion. ⛔ That assertion must
run on the Resume Master path too — it was added because repairing other plumbing would otherwise
have opened a bypass, and the split moved the code.

VERIFY: regenerate the two documents that produced G1 and confirm the company-shaped fabrications
are flagged. ⛔ Then run a TRUE claim through it — the owner's real résumé, with Stripe and
Bangalore in it — and confirm NOTHING is flagged. The false-positive direction is the one that
costs trust.
```

---

## K2 — KB in ATS scoring

```
⛔ READ THIS FIRST. scoreAtsLocally is deterministic, local, free and makes ZERO model calls, pinned
by a test asserting the scrape block contains no messages.create. THAT PROPERTY IS LOad-BEARING: it
is why the daily draft can score thousands of rows, why the swipe card can show a free fit band, and
why the MCP connector can be free.

⛔ A KB LOOKUP MUST NOT MAKE SCORING STATEFUL OR SLOW. Precompute into the scoring input; never
query per score. If that cannot be done cleanly, report it and stop rather than adding a database
read to the scorer.

WHAT IT WOULD ADD: a candidate at a company whose stack the KB knows gets credit for technologies
the company demonstrably uses but the résumé did not spell out.

⚠ MEASURE BEFORE SHIPPING. ρ on the graded 30, before and after. The precedent is exact: G1's
synonym table was built, wired to all 8 call sites, and moved ρ by +0.000 because the intersection
was empty. ⛔ "It should help" is not evidence.
```

---

### ⛔ K2 — MEASURED 2026-10-02 (17), NOT SHIPPED

`scripts/k2KbScoringRho.mjs` (read-only) precomputes exactly what this section allows — the KB stack
of the employers the résumé names, appended to the candidate basis as claimed skills, the scorer
unchanged — and re-scores the graded 30. The only employer the KB knows on that résumé is Stripe.

| variant | rho (baseline 0.746) |
|---|---|
| KB skills, top 5 / 10 / 20 / 40 / 80 by weight | 0.735 / 0.726 / 0.708 / 0.609 / 0.580 |
| KB skills filtered to the scorer's technical vocabulary, top 5 / 10 / 20 / 40 | **0.752** / 0.721 / 0.679 / 0.559 |
| the curated per-company stack (DOMAIN_TOOL_REGISTRY, 15 terms) | 0.734 |

The one gain (+0.006) is inside what n=30 can distinguish; every larger credit HURTS, because it
gives the candidate terms their résumé does not show and so flattens the ordering. Why: the
technographics are mined from POSTINGS and are dominated by soft skills ("communication",
"stakeholder management") — a fact about how the employer writes job ads, not about what a person
there used. ⛔ So K2 stops here, as this section says it must. ⚠ Separately: the curated stack the
registry returns for "Stripe" begins GCP, Pub/Sub, BigQuery, GKE — worth checking which company key
it resolved to before anything else relies on it.

## K3 — KB over API and MCP

```
⛔ VERIFY FIRST, DO NOT ASSUME: is ATS SCORING actually exposed over API and MCP today?
POST_MIGRATION_DESIGN.md names it as the top MCP candidate and Resume Master's /mcp is live
(returns 401 unauthenticated), but whether the scorer is among its tools is UNCONFIRMED.

⛔ IF IT IS NOT, SHIP THAT FIRST. It is the deterministic, free, genuinely-useful one, and a KB tool
beside a missing scorer tool is the wrong order.

THE KB TOOL ANSWERS: what teams does this company have · what is its stack · is it hiring in this
area · (with LCA data) has it sponsored visas.

⛔ COMPANIES AND ROLES ONLY. NO INDIVIDUAL DOSSIERS. §7 is absolute and becomes a CONTRACTUAL
PROMISE the moment it is an API — the same shift the integrity rules made when generation moved.

⛔ EVERY ANSWER CARRIES CONFIDENCE AND PROVENANCE. The KB's own rule. An MCP client may present a
tool's output as its own conclusion, so a low-confidence answer rendered as fact is a fabrication
created by a layer you do not control.

⚠ Visa data specifically: is_h1b_sponsor NULL means NO SIGNAL, never "does not sponsor". 0 of 1,261
postings mention H-1B. Company-level LCA evidence is a fact about the EMPLOYER, never a promise
about a role.
```

---

## P1 — Job profiles into account management

```
⚠ SMALL ON THE SURFACE, LOAD-BEARING UNDERNEATH. domain_profiles is the per-profile scoping for the
board, the scorer, the bridge, generation and CC5's per-(user, profile, job) keying.

⛔ SCOPE: RELOCATE THE EDITING SURFACE. CHANGE NO SCHEMA. Moving where it is edited is a UI change;
moving what it IS would touch every one of those consumers.

⭐ AND FIX WHAT MAKES IT CONFUSING TODAY — this is the real value, not the move:
 · The one control that genuinely moves curation is a textarea labelled "Extracted Titles /
   Keywords / Skills", sitting in the Profile panel away from every surface where a user learns a
   term matters.
 · ⛔ /signals/refresh and a résumé re-upload call upsertSimpleApplyProfile and SILENTLY OVERWRITE
   the user's edits, with no warning in the UI.
 · The copy says "Extracted" — accurate today, and it must stop being accurate. Auto-extracted and
   user-asserted must be DISTINGUISHABLE in the store.

⚠ CC4 already made claimed terms reach both the band and the board ranking, so the user-enrichable
layer exists. This is about making it findable and safe to edit.
```

---

## R2 to R6 — the two-sided product

```
⛔ ALL OF THIS BLOCKS ON CANDIDATE SUPPLY. Zero users. A recruiter's first draft would be empty, and
job_applications is empty so the matching itself is unvalidated — ρ = 0.746 is against the owner's
own judgement of 30 postings and nothing connects any score to an employer replying.

⛔ A TWO-SIDED PRODUCT WHOSE MATCHING IS UNVALIDATED FAILS ON BOTH SIDES AT ONCE. Do not start R2
before AF5 and real users.

R2 · PUBLIC CANDIDATE PROFILES
 · ⛔ OPT-IN PER PROFILE, NOT PER ACCOUNT. A candidate may share Software Engineering and not Data
   Science.
 · ⛔ BLIND BY CONSTRUCTION, not by a display flag. Skills, experience shape, fit band. No name, no
   photo, no exact location, until mutual interest. It mitigates real discrimination exposure
   structurally rather than by policy.
 · Revocable, and revocation is retroactive for anything not yet mutual.
 · ⛔ NOTHING SHARED BY DEFAULT. Not a pre-ticked box, not an opt-out. AG2's claims copy is the
   model: "claiming a term says it is true of you".
 · The candidate sees who viewed them — "a recruiter at Stripe" before mutual, by name after.
 · ⛔ BOTH privacy policies change, and the Web Store data-use declaration. Candidate data reaching
   a third party is a new disclosure; PRIVACY_RECONCILIATION.md's join gains a column.
 · ⛔ STATE THE §7 LINE EXPLICITLY IN THE CODE AND THE POLICY: a consented, user-controlled profile
   is NOT the "individual dossier" §7 forbids. Without that sentence, the first person to read both
   concludes one of them is wrong.

R3 · RECRUITER ACCOUNTS
 · Separate signup, separate session scope, separate role. ⛔ NOT a flag on a candidate account.
 · ⭐ EMPLOYER VERIFICATION VIA THE COMPANY KB — email domain against known employers. A real use of
   data already held, and the thing that makes "a recruiter at Stripe" mean something.
 · ⛔ THE ATS-PARTNER TIER IS NOT THIS. A Greenhouse or Lever integration wants the scorer, parser
   and formatter as an API and NEVER touches candidate data. Conflating them turns a tooling
   contract into a data-sharing contract.

R4 · THE REVERSE DRAFT
 · ⭐ THE SAME SCORER, BOTH DIRECTIONS. A JD against a résumé is the same comparison whichever side
   initiated it. ⛔ Do not build a second matching engine.
 · ⭐ SHOW BOTH BANDS. A candidate's fit for a role and a role's fit for a candidate are NOT the
   same number — a senior engineer is a poor match for an intern posting and vice versa, and the
   seniority guard already knows this in one direction. A match that is Strong one way and Weak the
   other is worth surfacing AS THAT, never averaged.
 · ⛔ CAPS ON BOTH SIDES. Recruiters get a small daily draft. UNLIMITED RECRUITER SEARCH DESTROYS
   THE MODEL — scarcity is what makes a draft mean something, and it is the whole difference between
   this and LinkedIn Recruiter.
 · Reuse the deck from UI_REDESIGN.md. ⭐ The symmetry IS the product: both sides doing the same
   calm daily thing.

R5 · DOUBLE OPT-IN
 · ⭐ THE SINGLE MOST IMPORTANT MECHANIC. Recruiter drafts a candidate → candidate sees "a recruiter
   at Stripe is interested" → accepts or passes → ONLY THEN is contact possible.
 · ⛔ A PASS IS FINAL. No re-surfacing, no "they viewed you again" nudges. Those mechanics are
   exactly the hectic job-market feeling this product exists to avoid.
 · Transparency both ways: each side sees WHICH TERMS matched. The ATS report already does this for
   candidates; recruiters get the mirror.

R6 · ACCOUNTABILITY
 · Recruiter response rate, ⛔ MEASURED, NEVER SELF-REPORTED. Same discipline as
   flag-don't-fabricate, and it is what makes accepting a draft worth doing.
 · ⚠ Needs volume before the numbers mean anything. A rate over four matches is noise.
```

---

## Sequence

```
R1 ──┐                                   (nothing blocks these two)
K1 ──┴─→ K2 ─→ K3        P1              
                                         
AF5 ─→ real users ─→ R2 ─→ R3 ─→ R4 ─→ R5 ─→ R6
```

⭐ **R1 and K1 are the ones to build when there is capacity.** K1 attacks a live defect that blocks
AF5; R1 is a free standalone tool that needs no users and is the recruiter-side acquisition hook.

⛔ **Everything R2 and after waits on AF5 and real users.** Not because it is hard, but because a
two-sided marketplace with no candidates and unvalidated matching is a demo, not a product.

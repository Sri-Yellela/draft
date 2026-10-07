# Tagging strategy — the layer everything reads

**Status:** strategy, written 2026-10-08 (D72). Nothing here is built except what §11 lists as existing.
**Owner's framing:** *"we need to tag everything within a posting and résumé properly, so we can control
it. This is the one thing that will make or break this."*

---

## 0 · Why this is the one thing

Every feature the product sells is a **comparison of two sets of facts** — what a posting asks for and what a
candidate has. If the facts are wrong, every surface built on them is wrong *confidently*:

| Surface | Reads | When the tag is wrong |
|---|---|---|
| The filter sentence and dials (D30/D35) | level, function, workplace, location, pay | the board hides the right jobs and shows the wrong ones (D42's Boston test) |
| "For you" ranking and the ATS score | skills, verbs, competencies, years | a fit number that means nothing |
| The posting panel and the deck strip (D32) | pay, location, workstyle, requirements | *"not stated"* about a fact the text states (D71) |
| Eligibility notices (D59) | citizenship, clearance, authorisation | a candidate applies to a job they cannot hold — or is told they cannot when they can |
| Résumé generation (D70) | evidenced and claimed terms | fabrication — a skill the candidate never had |
| The application packet and autofill (D55, D65) | candidate facts, form-question meaning | the wrong value in the wrong box, **sent to a real employer** |
| Company tracking (D54) | company identity, sector | two applications into one employer, unaware |
| Validation | outcomes joined to tags | no way to learn what actually predicts a reply |

**One tag layer, read by all of them, is the product.** Two tag stores that drift apart is the failure this
document exists to prevent — it is the same disease as three `StampLogo` implementations.

---

## 1 · The model — three subjects, one vocabulary

Tags describe **three subjects**, against **one shared set of dimensions**:

```
POSTING      what the job asks for / offers          "4+ years · Python · Boston · $143k–$194k · Secret clearance"
CANDIDATE    what the person has / states            "6 yrs · Python (bullet 3) · Boston · authorised: stated"
QUESTION     what a form field is asking             "this question asks about work authorisation"
```

The third is easy to miss and is what makes autofill safe: **a form question is tagged with the dimension it
asks about**, so the resolver maps *dimension → candidate fact* exactly, rather than guessing from the
question's wording. Matching is then **dimension against dimension**, which is explainable — *"9 of 12"* is
nine tag comparisons, each one inspectable.

---

## 2 · A tag is a claim with provenance

A tag is never a bare value. Every tag row carries:

| Field | Meaning |
|---|---|
| `dimension` | which fact (§3) |
| `value` | from the dimension's vocabulary, or a normalised number / range / place |
| **`state`** | **`stated`** (the source says so) · **`derived`** (we computed it) · **`unknown`** (we could not tell) |
| `source` | provider field · JSON-LD · label block · prose pattern · vocabulary match · **owner** · candidate |
| **`span`** | character offsets in the normalised text (`description_text`) that justify it — the *evidence* |
| `confidence` | for `derived` only |
| `tagger_version` | so a vocabulary change is traceable and re-tag is a batch |
| `text_hash` | the text it was read from — a changed posting makes its tags *stale*, never silently wrong |

**Three rules that are not negotiable:**

1. ⛔ **`unknown` is not `no`.** A posting with no stated workstyle is *unknown*, not *on-site* (a real defect:
   every such posting read "On-site"). A level that cannot be read is *unknown*, not *mid*. Filters keep
   unknowns **visibly** and rank known matches first.
2. ⛔ **The owner's tag wins and survives a re-tag.** A tag written by the owner is never overwritten by the
   extractor — it is the ground truth the extractor is measured against.
3. ⛔ **No default is ever a tag.** If a dimension has no evidence it has no value. Defaults are how the board
   went empty four times and how 592 of 868 postings became *mid*.

---

## 3 · The dimension registry — the control surface

A **registry** defines every dimension once. Nothing may be tagged, filtered, scored or filled that is not in it.
Each entry declares: **class**, **type**, **cardinality**, **vocabulary**, **writers**, **comparison**, **uses**.

### 3.1 · Class — the idea that makes it controllable

| Class | Meaning | Behaviour |
|---|---|---|
| **HARD** | eligibility and legality | **surfaced, never decided, never guessed.** A mismatch produces a notice or a stop; the product never answers it for the candidate |
| **SOFT** | fit and ranking | contributes to a score; a miss lowers a score, never blocks |
| **INFO** | useful, not compared | shown; never scored |
| **BOILERPLATE** | EEO statements, benefits paragraphs, *"fast-paced"* | **tagged as such and excluded** from scoring and requirements — and shown quietly (D32) |

### 3.2 · The dimensions

**Posting side**

| Dimension | Class | Type | Notes |
|---|---|---|---|
| `citizenship` | **HARD** | enum | `citizen_only` · `us_person` · `none_stated` (D59 — distinct, both exclude F-1 / OPT) |
| `clearance` | **HARD** | enum + status | none · public trust · Secret · TS · TS/SCI · polygraph; *active required / interim ok / ability to obtain* |
| `work_authorization`, `sponsorship` | **HARD** | enum | *"will not sponsor"*, *"must be authorised"* — statements in the posting |
| `location` | **HARD** (country) / SOFT (city) | **set** of places | country·state·metro·city; `remote` is a **separate flag**, not a place |
| `pay` | INFO / SOFT (sort) | **per location** `(min, max, currency, unit)` | D71; hourly stays hourly |
| `workstyle` | SOFT | enum | onsite · hybrid · remote — **unknown ≠ onsite** |
| `level` | SOFT | enum (closed) | entry · mid · senior · lead · intern — **unknown ≠ mid** |
| `years_required` | SOFT | number / range | regex + word-number map (*"four years"*) |
| `function` | SOFT | enum (closed) | what the person *does* |
| **`industry` / sub-domain** | SOFT | enum (closed), **company-level** | what the employer *is* — **the missing dimension behind D42's "finance"** |
| `employment_type` | SOFT | enum | full-time · contract · intern · part-time (7.7% coverage today) |
| `skills`, `verbs`, `competencies` | SOFT | canonical term + `kind` + weight | the ATS vocabulary; each term carries its **evidence span** |
| `education`, `certifications`, `languages` | SOFT / HARD (if legally required) | set | |
| `benefits`, `travel`, `relocation`, `shift` | INFO | | |
| `posted_at`, `closes_at`, `requisition_id` | INFO | | the posting's own date, not the crawl's |
| `apply_origins`, `ats`, `ats_job_id` | INFO | | D56/D67 — where the application form lives |
| `boilerplate` spans | BOILERPLATE | span set | EEO, benefits, culture, *"fast-paced environment"* |

**Candidate side** (every candidate tag has a **tier**, §6)

`skills` (with years per skill, derived from dates) · `titles_held` · `level_held` · `education` · `certifications` ·
`languages` · `location` · **`work_authorization`** · **`sponsorship_needed`** · **`clearance_held`** · `pay_expectation` ·
`workstyle_preference` · **`eeo_*`** (ethnicity, disability, veteran — Article 9).

**Question side:** the `dimension` a form question asks about, plus the normalised question text (keyed with `{company}`
templated) — feeding the resolver and the saved-answers store.

---

## 4 · HARD vs SOFT is the product's safety model

- **HARD dimensions are never inferred, never defaulted, never fuzzy-matched.** They are compared **exactly** and a
  mismatch is **shown**, not resolved. *"This role requires U.S. citizenship. Your profile states F-1."* — a notice,
  at Draft and in the panel; **the product does not decide.**
- **Candidate values for HARD dimensions are STATED by the candidate, in the profile — never read out of résumé text**
  (O61: sensitive, unreliable, Article 9 territory).
- **SOFT dimensions** may be derived and weighted; a wrong soft tag degrades ranking, not safety.
- The registry's `class` is what the resolver, the filters and the generation prompt consult — so *"may this be guessed?"*
  has **one answer in one place**.

---

## 5 · The pipeline

```
INGEST (crawl · capture · import)
  → NORMALISE   decode, strip to structured text            →  description_text      (D59)
  → EXTRACT     a deterministic LADDER per dimension:
                  provider field → JSON-LD → leading label block → TRAILING block (D71)
                  → prose pattern with context → vocabulary phrase match → UNKNOWN
  → RESIDUAL    unknowns go to the OWNER'S EXPORT → TAG → IMPORT sweep   (D17: no model call)
  → STORE       tag rows with state, source, span, version, hash
  → DERIVE      composites (annualised pay estimate, years from dates, requirements row)
  → MATERIALISE the read model the filters and the board use (denormalised columns)
  → MEASURE     precision / recall / coverage per dimension; drift per source and ATS
  → GATE        a dimension's READINESS decides what the UI may do with it (§8)
```

⛔ **No model call anywhere in this pipeline.** Résumé generation is the only model call in the product (D17).
**Deterministic where it can be; the owner's sweep where it cannot** — which is also what makes the tags
*reproducible* and *testable*.

---

## 6 · Candidate tags — tiers

Every candidate fact states **how we know it**:

| Tier | Meaning | May feed generation / filling? |
|---|---|---|
| **evidenced** | present in the résumé text — carries a **bullet / role id and span** | yes |
| **claimed** | the candidate asserted it (a dated claim, withdrawable) | yes |
| **stated** | entered in the profile (eligibility, preferences) | yes — **the only source for HARD dimensions** |
| **derived** | computed (years per skill from dates) | shown; flagged; never the sole basis for a claim |

- Résumé **bullets and roles get stable ids**, so a tag can point at its evidence — and so **D70's patch output** can
  return *"bullet 3 → rewritten"* instead of the whole résumé, and the **claim guard** can verify *"this term appears
  in the base résumé or in the claims"* as a lookup rather than a search.
- ⛔ **Article 9 columns are stated, never extracted and never inferred**, used **only** to answer an employer's own
  EEO question, and offered an explicit *decline to answer* (autofill §8).
- Candidate tags are **personal data**: stored with the profile, deleted with the account, never sent to a third party,
  and **not in logs**.

---

## 7 · Vocabulary and the learning loop — how it "gets better with usage"

**What is true:** the vocabulary can improve with use. **What is not:** that it does so by itself.

- A vocabulary entry is `canonical term · aliases · kind (skill / verb / competency / tool) · weight · status · version`.
- **Terms enter through a queue, never directly.** The **unknown-term queue** collects phrases that appear in postings
  or claims and match nothing, **ranked by how many postings they appear in.** Other signals: **candidate claims**
  not in the vocabulary · **corrections** (a user marks a tag wrong) · **captured postings** from companies not yet
  crawled · and, later, **outcomes**.
- **The owner promotes in batches**, through the export → tag → import path with the **five guards** (invalid value ·
  stale · unknown id · concurrency · a refusal that reconciles), a **batch row** and a **revert**.
- Every vocabulary change **bumps `tagger_version`**, triggers a **dry-run re-tag** with before/after pairs, and
  **re-measures ρ** — a vocabulary edit must never move scores silently.
- ⛔ **Never auto-promote.** An unreviewed term is how *Managed*, *collaboration* and *Secured* became "skills
  missing".

---

## 8 · Measurement and readiness — coverage is not accuracy

D29 reported metro at **91.7% coverage** and the Boston filter was still wrong. **Coverage says how often a column is
filled; it says nothing about whether the value is right.** So:

- Every dimension has a **gold set** — a hand-checked sample (about 50–100), reusing the A76 export/import machinery.
- Per dimension, per value: **precision**, **recall**, **coverage**, and **drift by source and by ATS**.
- **Readiness** is a state, shown in Admin, and **the UI obeys it**:

| State | Meaning | What the UI may do |
|---|---|---|
| **experimental** | below threshold or unmeasured | Admin only |
| **beta** | usable, with a stated caveat | shown with the caveat (*"47% have a workstyle on file"*) |
| **ready** | meets its threshold | drives a filter, a sort or a score |

Proposed thresholds — **HARD: precision ≥ 98%** (recall reported, never hidden); **SOFT: precision ≥ 90%**. *The owner sets them.*
**The filter sentence's dials and the Requirements row read readiness**, not a hope.

An **Admin → Tags** page shows, per dimension: class · readiness · coverage · precision · recall · drift · the unknown-term
queue size · the last re-tag batch.

---

## 9 · Where tags are used — the usage map

| Consumer | Reads | Rule |
|---|---|---|
| Filter sentence, dials, sort | `ready` dimensions only | unknown kept and labelled; known matches first |
| "For you" ranking | HARD filter first, then SOFT match | HARD mismatches are **shown**, not silently dropped |
| ATS score | skills · verbs · competencies · years | each term traceable to a tag row; BOILERPLATE excluded |
| Posting panel | deck strip, Requirements row, in-text marks (spans) | *"not stated"* only after the whole text was read |
| Résumé generation | evidenced + claimed terms only (D70) | the model never sees unclaimed requirements |
| Packet and autofill | candidate facts by dimension | HARD exact-or-blank; SOFT may use saved answers |
| Eligibility notices | HARD posting tags vs HARD candidate tags | notice at Draft and in the panel; never a decision |
| Company tracking | company key + `industry` | one identity across boards |
| Learning | outcomes joined to tags | which dimensions actually predict a reply |

---

## 10 · What must never happen — the failures already seen

- **Coverage taken for accuracy** (metro 91.7% and wrong).
- **Substring matching** — *Boston Post Rd* tagged as Boston; *IN* matching Washington; *CA* matching Canada.
- **`unknown` stored as a value** — every untitled posting *mid*; every unstated workstyle *on-site*.
- **A surface asserting what it could have checked** — *"not stated"* beside a salary in the text.
- **Boilerplate read as requirements** — *Managed*, *EEO*, the benefits paragraph.
- **A model creeping in** to "help" a tagger. D17 stands.
- **Two stores diverging** — a tag in one table and a different one in a column the board reads.
- **A vocabulary edit that silently moves scores.**
- **Eligibility inferred** — from a résumé, from a default, from a fuzzy match.

---

## 11 · Storage — extend, do not rewrite

What already exists (D29, D59, D65, D71): `scraped_jobs.tag_*` columns, `job_tag_places` (location as a set),
`TAGGER_VERSION`, `description_text`, the owner export/import at `/api/admin/job-tags`, the résumé parse of work history
and skills (migration 138), the label-block parser, the claim guard, `skills_json`.

**The target (sketch):**

```
tag_dimensions   registry: key, class, type, cardinality, vocabulary, writers, comparison, uses
tag_vocab        canonical term, aliases, kind, weight, status, version
posting_tags     job_id, dimension, value, state, source, span_start, span_end, confidence, tagger_version, text_hash
candidate_tags   user_id, profile_id, dimension, value, tier, resume_ref (role_id / bullet_id / span), asserted_at
question_tags    question_hash, dimension
tag_gold         the hand-checked sample, for measurement
```

**`posting_tags` is the source of truth; the existing `tag_*` columns become its materialised read model** — kept,
fast, and *written only from `posting_tags`*. A **strangler migration**: new rows alongside the old columns, a parity
test that fails if they disagree, then the writers move over one dimension at a time. **No big-bang rewrite.**
Both migration runners, byte-identical, as always.

---

## 12 · Phases — each with an exit test

| Phase | Deliverable | Exit test |
|---|---|---|
| **P0 · Inventory and registry** | every tag-like field in the repo mapped to a dimension; the registry as data; **coverage, precision and recall measured per dimension** against a first gold set | **no behaviour changes.** A table: dimension · class · coverage · precision · recall · readiness |
| **P1 · Provenance and spans** | `posting_tags` with state / source / span / version / hash, written alongside the old columns | parity test between rows and columns; a changed text marks its tags stale |
| **P2 · Vocabulary queue and sweep tooling** | the unknown-term queue, ranked; the owner's export → tag → import with the five guards, a batch row, a revert | a promoted term re-tags in dry run and shows the ρ delta before apply |
| **P3 · Candidate tags and tiers** | `candidate_tags`; stable bullet / role ids; HARD fields only from the profile | generation and the claim guard read tiers; a test that no HARD value comes from résumé text |
| **P4 · Question tags** | `question_tags`; the resolver maps dimension → fact | eligibility questions resolve exact-or-blank; the Test-a-question tool reads it |
| **P5 · Readiness gates** | Admin → Tags; the UI obeys readiness | a `beta` dial shows its caveat; an `experimental` one is hidden |
| **P6 · Outcomes** | outcomes joined to tags | a report: which dimensions predict screen / interview |

**P0 first, and nothing else until it reports** — the one lesson of this project: *measure before building*, because the
first measurement has inverted the premise every time.

---

## 13 · Decisions for the owner

1. **The class of each dimension** (HARD / SOFT / INFO) — §3.2 proposes; you correct.
2. **Readiness thresholds** — §8 proposes 98% / 90%.
3. **Gold sets** — about 50 per dimension, graded by you in the existing export/import format; or by a second reader for the less
   sensitive ones. This is the cost of trusting the layer.
4. **Who promotes vocabulary** — proposed: the owner only, in batches.
5. **The `industry` dimension** — adopt a company-level sector tag (the missing dimension behind D42's "finance")?
6. **Storage** — the strangler migration in §11, or keep extending the columns and accept the drift risk?

---

*Related rows: D29 (the tag layer) · D42 (precision and recall) · D59 (requirements and label blocks) · D65 (résumé work history
and skills) · D70 (keywords instead of the posting) · D71 (pay and location in the prose) · D54 (company identity) · AUTOFILL_TARGET.md §8.*

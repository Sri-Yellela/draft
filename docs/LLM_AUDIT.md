# LLM AUDIT — D123 P1

**What this is:** the read-only audit D123 P1 asks for: where a tailored résumé's cost goes, what the call does right and
wrong, what is wrong with the prompt itself, and every other model call. **Static only** (owner 11-01: *"do not do live
calls, static evaluation and eval of the prompt and tokens itself is the first thing"*). No model was called for this
report. Counts, lengths and rule names only: no résumé or posting text appears here.

**Measured 2026-11-01 (43x).** The tools service is `resume-master` `50f83e0` (= production, `/v1/version`); draft is
`3848d4f`. Tool: `scripts/d123LlmAudit.mjs --static`, which builds the EXACT request draft sends
(`services/toolsServiceRequests.js` `generateRequest`) and renders it with the tools service's own `assemblePrompt` /
`buildRuntimeInputs`, imported from the sibling checkout (not a copy). **Evaluation set:** 3 résumés (the owner's, and
D124's two fictional samples, `content/trial/sample-a.json` and `sample-b.json`) × 10 real postings (5 software, 5 ML /
data, entry to mid, 9 companies) from the local board copy = **30 requests**.

✅ **Production's ledgers were read later the same session** (section (a), "Production, measured"). ⚠ **Pending:**
**the live runs.** The harness's live mode stays off until the prompt is fixed (the owner's order). ⚠ When it runs,
the local key needs `ANTHROPIC_WORKSPACE_ID` in `.env`: Anthropic refuses it as *"not scoped to a workspace"*.

---

## (a) Where the money goes: one tailored résumé today

**Calls per résumé (from the code):** **1** Sonnet call (`resume_generate`, `claude-sonnet-5`, `max_tokens 8192`,
thinking off). A Haiku `classifier` call (400) is added only when no `roleFamily` is sent, which happens when the account
has no active job profile. `resume_format` is off in production (`llmFormat: false`). On the apply path, **+1 Haiku
`cover_letter_apply` per job** (see (d)). The SDK may send a call twice (`maxRetries: 1`). Draft makes no automatic retry
(`services/generationRetry.js`).

**Input, by part** (mean characters over the 10 postings; tokens at **3.10 chars/token**, the Sonnet 5 calibration
AL6 read from the ledger, 6,704 cache-write tokens ↔ 20,814 static characters):

| part | owner (engineering) | sample A (engineering) | sample B (data) | what it is |
|---|---|---|---|---|
| L1 global rules (static) | 9,397 ch · 3,031 t | same | same | `prompts/layer1_global_rules.md` |
| L2 domain module (static) | 7,660 ch · 2,471 t | same | 2,743 ch · 885 t | `layer2_domains/engineering.md` / `data.md` |
| L3 mode overlay (static) | 1,296 ch · 418 t | same | same | `layer3_modes/generate.md` |
| candidate + profile + claims | 805 ch · 260 t | 865 · 279 | 861 · 278 | contact, years, seniority, profile chips |
| **job description** | 4,439 ch · 1,432 t | same | same | **the whole posting text** (median 5,001 ch) |
| base résumé | 4,933 ch · 1,591 t | 2,001 · 645 | 1,895 · 611 | the whole résumé |
| **input total** | **≈ 9,200 t** | **≈ 8,280 t** | **≈ 6,660 t** | |

**The static prompt is 64–69 % of the input** for the engineering module (18,353 characters ≈ 5,920 tokens) and is
paid at the full rate on every interactive Generate: draft sends `cache: false` there (D70 Phase 3), because Phase 0
measured 0 cache reads in 11 production rows.

**Output:** the model writes **the whole résumé as HTML, with CSS**. The only measured output figure is the local
ledger's mean of **3,145 tokens** (n = 9 `resume_generate` rows, Sept). ⚠ Production's mean is not read (pending).

**Price per résumé at today's rates** (`src/model/prices.js`: Sonnet 5 $2 / $10 per MTok, Haiku 4.5 $1 / $5; cache
write 1.25×, read 0.1×):

| | owner | sample A | sample B |
|---|---|---|---|
| input (cache off, as sent) | 1.84¢ | 1.66¢ | 1.33¢ |
| output (3,145 t) | **3.15¢** | 3.15¢ | 3.15¢ |
| **total, Sonnet, as sent** | **4.99¢** | 4.80¢ | 4.48¢ |
| same request on Haiku 4.5 (no other change) | 2.49¢ | 2.40¢ | 2.24¢ |

**⚠ This model gives ≈ 5¢, not the 13¢ the owner sees.**

### Production, measured 11-01 (43x, `railway ssh`, read-only, counts only)

**The tools service's `model_usage`** (the ledger exists since A97, 10-14): **3 generate calls in total.**

| day | in | out | cache write | cost | |
|---|---|---|---|---|---|
| 10-15 | 10,490 | 3,432 | 0 | **5.53¢** | delivered |
| 10-15 | 0 | 0 | 0 | 0 | failed: the unscoped key (T19) |
| 10-31 | 4,097 | 4,046 | **7,897** | **6.84¢** | delivered; ⚠ **the static prefix was cache-WRITTEN** (1.25×) and never read |

**Draft's `usage_events`, `resume_generate` since 09-01:** 10 calls for 7 (person, job) pairs, **4 failed, 1 refused by
the claim guard**, $0.386 in all. That is 3.9¢ a call, **≈ 6.4¢ per successful call**, and **7.7¢ per delivered
résumé** once the paid refusal is spread over the five deliveries. Calls per pair: 1 × 5 pairs, 2 × 1, 3 × 1.

**So, measured:** a successful call costs **5.5–6.8¢**. Its total input is 10.5–12.0k tokens, more than this audit's static
model because production's runtime inputs are larger. Its output is **3.4–4.0k tokens**: output alone is 3.4–4.0¢, the
biggest line, as modelled. **Neither ledger shows 13¢ for one résumé.** The nearest real case is **a résumé that took
two paid calls (≈ 6.8¢ × 2 ≈ 13.7¢)**, which is the shape of the 2- and 3-call pairs above (a refusal or failure, then
a retry). ⚠ If the 13¢ was read from the Anthropic Console, it may include spend no ledger here sees (another key, local
scripts). Before D17 deleted it, **`enrich_job` was the real spender: $6.79 over 2,952 Haiku calls in September**.

**Finding P-1 — the cache is written on a one-shot call.** The 10-31 generation wrote 7,897 tokens to the cache, at
1.25× (+0.4¢), and nothing read them. Draft sends `cache: false` only from the interactive web Generate
(D70 Phase 3). The extension and apply paths leave it unset, so caching stays on. After R5 shrinks the static block
this hardly matters, but until then each one-shot pays the surcharge.

**Output is the biggest line: ≈ 63 % of the price**, and most of it is not résumé content (see (c) items 1 and 2).

---

## (b) Quality: what we do right and wrong

**Measured statically (draft's own scorer, the same call `coreGenerateResume` makes for "before"):**
- **ATS before, on the base résumé:** owner 20–61, sample A 20–59, sample B 19–45. **The scorer declined 6 of 30**
  (2 postings × 3 résumés: too little signal in the posting), so those six get no lift figure at all.
- **JD terms the base résumé misses** (scorer's `tier1_missing`): 0–12 per posting. These are what an "ATS-pushing"
  tailoring has to place honestly or leave out.
- **⚠ The posting is cut at 5,000 characters:** in the local board copy, **1,208 of 2,616 descriptions are exactly 5,000
  characters long**. `description_full` (D84 F3) exists but is empty locally, and generation sends `job.description`,
  never `description_full`. When a posting is longer, its requirements section, which usually comes last, never reaches
  the model or the scorer. **Production (11-01): of 3,850 active postings, 1,848 are cut at 5,000 characters, and 1,246
  of those have a longer `description_full` that generation does not read.**

**From the code and earlier measurements (not re-measured):**
- **Right:** one call, no loops; thinking off; output capped; the claim guard runs on every document and a refusal
  returns no document; every call is metered with no content; the formatter makes layout deterministic; the summary is
  opt-in and its rules are removed from the prompt instead of being stripped afterwards.
- **Wrong:** **the claim guard checks two things only**, years (`years_exceed_profile` / `years_below_profile`) and
  seniority (`seniority_unsupported`), in `src/integrity/resumeClaimGuard.js`. **It does not check new numbers, new
  skills, new employers, titles or dates.** That matches CURRENT STATE's *"fabrication: 2 of 2 real generations invented
  content"* (10-01): the guard cannot see the kind of invention the prompt invites (see (c)).
- **The guard runs after the paid call** (MODEL_CALLS.md item 7): a refusal is a full Sonnet bill.
- **Not measurable without live runs** (the harness's live mode records them): guard pass rate, ATS after, bullets kept /
  reworded / unmatched / dropped, numbers not in the base résumé, buzzword count, length.

---

## (c) The prompt itself: redundant, contradictory, ignored, inviting invention

Line numbers are in `resume-master/prompts/`.

**Paid for and thrown away:**
1. **The model writes CSS that is deleted.** L1:10–12 asks for *"All CSS must be in `<style>` in `<head>`"* and a list
   of 17 class names. `normalizeResumeHtml` strips every `<style>` (`resumeFormatter.js:955`) and injects its own
   `RESUME_STYLE_BLOCK` (`:936`). L1's own header comment says *"CSS/layout is enforced deterministically"*. **Every
   CSS token is paid output at $10/MTok.**
2. **The whole résumé is re-emitted as HTML**, even though the formatter re-parses it into structure
   (`buildStructuredResume`). Contact lines, education, dates and unchanged bullets are all paid output. D123 P2's
   "changes only" JSON removes this.
3. **L1:14, the PDF comment** (*"Save and submit as PDF…"*), is an instruction to the person that the model is asked to
   type into every document.

**Rules for the other mode, sent on every Generate call:**
4. L1:37–39 (excluded companies, the target-company / origin-company rule), L1:64's A+ location rule and L1:66 (the
   FAANG limit and *"strongest company most recent"* ordering) only make sense for A+, which **chooses** companies. In
   Generate the employers are the candidate's own. They cost about 700 characters per call, and they ask the model to
   reason about reordering real employers.

**Contradictions that invite invention:**
5. **L1:29** *"Do not echo or paraphrase existing resume bullets. Create new bullets from company reality, JD needs,
   and provided facts"* and **L1:93** *"avoid copying candidate resume wording"*, against **L3 generate:7** *"Generate
   bullets ONLY from the candidate's real experience… Do not fabricate responsibilities"*. The global layer orders a
   rewrite of every bullet, from "company reality" (what the model believes the company does), not from what the
   candidate did. This is the most likely source of the 10-01 inventions, and it also forces the whole document to be
   rewritten (item 2).
6. **L1:31** *"Metrics must be provided by the candidate **or be clearly credible approximations calibrated to company
   scale**"*. This is a licence to invent numbers, and the guard does not check numbers.
7. **L1:97–98** quotas: *"at least two stakeholder/business judgment bullets"*, *"at least one explicit tradeoff and
   decision outcome"*. These demand content whether or not the base résumé has it.
8. **L1:43–50** skill distribution: *"Assign each skill to one primary employer"*, *"no employer carries more than
   60 %"*, *"Each employer must cover at least one JD-relevant requirement"*, *"every tool in bullets appears in Skills"*.
   These require moving tools between employers, which **L3:7 forbids** (*"Do not… reassign tools across employers"*).
9. **L1:25** the *"translation table"* and a *"Transferable to target stack"* Skills row put tools the candidate never
   used into the Skills section, which an ATS reads as claims.
10. **L3:17–19** *"AI-related terms may only appear in the most recent experience slot"* is an arbitrary rule. It can
    hide an ML candidate's honest earlier work.

**Work the model repeats that draft already did, deterministically:**
11. **L1:16–23** asks the model to extract Tier 1 / 2 / 3 terms from the JD. Draft's scorer already has them
    (`tier1_matched` / `tier1_missing`, competencies, verbs), and the tools service has accepted `jobContext:
    "keywords"` since contract 1.5.0 (D70 Phase 1, `services/jobKeywordContext.js`). **Draft never sends it**, so the
    whole posting (≈ 1,430 t) goes every time.
12. **L2 engineering:27–62, the 31-company "canonical tool registry"** (≈ 2,600 ch ≈ 850 t on every engineering call).
    It is hand-written. It helps only when the candidate worked at one of those 31 companies: none of the three test
    résumés' employers is in it. Its rule *"Only assign a tool to a company if it appears in that company's entry"* is
    undefined for every other employer. **Draft's KB already has the data-derived version of this:**
    `company_technographics` (company × skill × weight × posting_count, from real postings). Locally it covers 10
    companies, 8,690 rows, and 2 names in the owner's résumé match a KB company. **Production (11-01): 63 companies,
    19,248 rows, 61 of them with ≥ 10 postings of evidence.**
13. **L2:64–85**, the keyword *classes* and a 35-verb pool, describe what the model already knows (≈ 1,500 ch). The
    candidate's own verbs and the JD's verbs are the ones that score.

**Fine as it is:** the truthfulness paragraph L1:33 (*"The JD steers EMPHASIS and ORDERING. It never sets a QUANTITY
or a LEVEL"*); the summary on/off conditionals; thinking disabled; the authoritative years and seniority lines in the
runtime inputs.

---

## (d) Every other model call

Swept 11-01: `callModel(`, `messages.create`, batches and other providers' endpoints, across draft (outside `test/` and
`scripts/`), the apply worker and the crawler. MODEL_CALLS.md (10-14) is still accurate:

| purpose | where | model · max | when | note |
|---|---|---|---|---|
| `resume_generate` | tools `generate.js:98` | Sonnet 5 · 8192 | every tailoring | the call this audit is about |
| `classifier` | tools `classifier.js:46` | Haiku · 400 | no `roleFamily` sent | ⚠ a **trial account with no job profile** would pay it; D124 should send the sample's family |
| `resume_format` | tools `generate.js:114` | Haiku · 4096 | `RESUME_MASTER_LLM_FORMAT=1` | off in production |
| `resume_enhance` | tools `enhance.js:33` | Sonnet 5 · 8000 | A+ enhancement, on press | |
| `cover_letter` | draft `server.js:13575` | Haiku · 800 | on press | allowed by D17 ("cover-letter siblings") |
| `cover_letter_apply` | draft `server.js:12572` | Haiku · 800 | **every approved apply job** (`routes/apply.js:1673`, `:1738`) | ⚠ generated **even when the form has no cover-letter field**: a paid call per job for nothing |
| `domain_chips` | draft `routes/domainProfiles.js:690` | Haiku · 600 | "suggest chips" on a job profile | ⚠ **not on D17's allowed list** (résumé + A+ + cover letters). The owner keeps it or replaces it with KB terms |

**None in** the apply worker (D100), the crawler, the inbox (D103), saved answers or Fill. ✅ D17 holds, apart from
`domain_chips`.

---

## (e) Recommendations, each with its expected saving

Per résumé, from the ≈ 5.0¢ modelled above (owner's résumé; production's real figure is pending).

| # | change | saving (est.) | risk |
|---|---|---|---|
| R1 | **Output = JSON of changes only** (P2): `bulletId → new text`, skills order, summary line; code assembles the résumé | output 3,145 t → ≈ 500–700 t: **−2.5¢** | the assembler must keep layout; What We Changed reads the same JSON |
| R2 | **Stop asking for CSS, class lists and the PDF comment** (moot after R1, but immediate if R1 slips) | ⚠ unmeasured, probably several hundred output tokens | none: the formatter replaces them already |
| R3 | **Send keywords, not the posting** (`jobContext: "keywords"` exists, unused): matched, missing-but-placeable, verbs, ≤ 8 responsibility phrases | ≈ 1,430 t → ≈ 300 t: **−0.2¢** (Sonnet) | must read the FULL posting (`description_full`), not the 5,000-char cut |
| R4 | **Replace the static registry with the KB, per candidate:** only the candidate's own employers' stacks from `company_technographics`, intersected with the JD's terms | ≈ 850 t → ≈ 50–150 t | coverage is thin for small employers (then: evidenced / claimed only) |
| R5 | **Cut L1 to the rules Generate uses**: drop the A+ rules (item 4), the quotas (7), the distribution rules (8), the Tier extraction (11), the CSS contract (1) | static ≈ 5,900 t → ≈ 800–1,200 t: **−1.0¢** | none: these are the contradictions in (c) |
| R6 | **Send only the résumé sections that can carry the terms** (the structured Profile, D101) and keep the rest in code | 645–1,590 t → ≈ 400–900 t | the guard still compares against the full base résumé |
| R7 | **Haiku 4.5 by default, Sonnet only after a Haiku guard failure** (P3) | ≈ −50 % on whatever is left | quality is to be measured in the live runs (P5's evaluation set) |
| R8 | **Deterministic guard additions** before Haiku: no number absent from the base résumé; no employer / title / date change; no Skills term that is not evidenced, claimed or KB-backed for that employer | none directly; they make R7 and the ATS push safe | false positives on reformatted numbers (normalise "40,000" = "40k") |
| R9 | **Cover letter only when the form asks for one** | −1 Haiku call per apply job without a cover-letter field | none |
| R10 | **Trial accounts send their sample's `roleFamily`** | the classifier (≈ 0.25¢) on each trial generation | none |

**R1 + R3–R7 together:** ≈ 3,000 t in / ≈ 600 t out on Haiku 4.5 is **≈ 0.6¢** (0.3¢ in + 0.3¢ out), below D123's 1¢
target. ⚠ **Prompt caching barely matters after R5.** A ≈ 1k-token static block is under Anthropic's minimum cacheable
length for Haiku-class models (verify the current minimum before building P2's cache breakpoint), and the static block
stops being most of the bill.

---

## The direction for the lean call (owner 11-01)

*"For the trial version … we should use haiku and the resume tailoring stuff should be truly pushing ats, we would be
using our kb to maximise the ats within the scope of the users experience companies."*

What that means for P2, in the terms of this audit:
- **Haiku** for the trial (D124) and as the default (P3).
- **Push ATS:** every JD term the scorer reports as missing is a candidate for placement, not only the evidenced ones.
  This **amends D70 Phase 1's rule** *"what is NEVER sent: missing-and-unclaimed terms"*.
- **Within the scope of the user's experience companies:** a missing term may be placed **only at an employer where the
  KB shows it in that company's stack** (`company_technographics`, a weight and posting-count floor), and only as part
  of what the candidate actually did there. Draft decides placement deterministically and sends it to the model as
  `{ employer, term, kbWeight }`. The model words the bullet; it does not choose the term.
- **Never:** a new number, employer, title, date, level or year count (R8 enforces this in code). A term with no
  evidence, no claim and no KB support for one of the candidate's employers is left out, and the user sees it under
  *"missing — add it to your profile if it is true"*.
- ⚠ **For the two samples, the KB has nothing to give**: their employers are fictional, so their lift comes from evidenced
  terms only. The sample résumés already carry a broad, realistic stack for that reason.

---

## P2 · BUILT (11-01, 43x): the lean call — static measure, no model called

**Tools service `35c37f3` (contract 1.7.0, local):** `options.tailoring: "lean"`. Code parses the base résumé
(`buildStructuredResume`). Haiku sees only the keywords and the bullets (with ids) and the skills rows, and returns
JSON of changes. `checkLeanChanges` refuses a new number, a skill nobody supports, a KB term at the wrong employer, or
an over-long bullet. One Sonnet repair carries the exact messages; what is still refused is reverted. Then
`renderStructuredResume` and the contractual claim guard. **Draft:** `services/leanTailoring.js`, the full posting text
(`description_full`), the keywords, and the KB placements at the candidate's own employers (≥ 3 postings). Off unless
`DRAFT_TAILORING=lean`; trial accounts (D124) default to lean.

**The same 30 requests, rendered as the lean call would send them:**

| | system | user message | input ≈ tokens | was (full) | KB placements (10 postings) |
|---|---|---|---|---|---|
| owner | 2,063 ch | 4,835 ch (4,638–5,062) | **≈ 2,200** | ≈ 9,200 | 19 |
| sample A | 2,063 ch | 2,009 ch | **≈ 1,300** | ≈ 8,280 | 0 (fictional employers) |
| sample B | 2,063 ch | 1,962 ch | **≈ 1,300** | ≈ 6,660 | 0 |

Tokens are at 3.10 chars/token (the Sonnet 5 calibration; Haiku 4.5's tokenizer gives fewer, so this is the upper
bound). **Expected price on Haiku 4.5:** input ≈ 0.13–0.22¢, plus output (JSON edits, estimated 400–800 t)
≈ 0.2–0.4¢, so **≈ 0.35–0.6¢ per résumé**. A repair adds ≈ 1¢ (Sonnet). ⚠ Output tokens and quality are estimates
until the live runs (`scripts/d123LlmAudit.mjs`).

# Phase A + B — Execution

The working document for the split. `ROADMAP.md` holds the sequencing and the reasoning;
this holds the work.

**Run A1 → A2 → A3 → A4 → B, in order, one commit per task, reporting between each.**

⚠ **The Anthropic balance is deliberately unfunded.** Every model-backed path 502s. That is fine for
A1 and A3 and for most of A2/A4 — but **no generation can be exercised end to end until it is
funded**. Say plainly which verification steps were structural and which were real runs; do not
report a stub as a run.

---

## A1 — Extract `@draft/ats-scorer`

```
The smallest piece with the widest effect. Deterministic, no database, no model call.

WHAT COMES WITH IT — ⛔ SPLITTING THE SCORER FROM THESE IS THE WHOLE RISK
The scorer depends on the term registry, normaliseAtsTerm, compound detection, the term rejector,
the ambiguity guard and the competency registry. AG1 and AH3 fixed real defects INSIDE
candidateTermsFromJob — sentence fragments emitted as skills, competencies filed as verbs — and the
profile→board bridge never inherited them because it called cleanStringList instead. A package that
leaves any of these behind recreates exactly that split.

⛔ WHAT MUST NOT COME: ats_term_weights loading. It reads the database. The package TAKES WEIGHTS AS
AN ARGUMENT; each product loads its own.

⛔ THE SIGNATURE IS THE POINT. loadTermWeights returns an ENVELOPE — { weights: Map, stale, … } —
and weightedRatio expects a MAP. `.size` on a plain object is `undefined`, so four harnesses
silently took the unweighted branch while labelling themselves weighted. Envelope: 0 of 30 scores
differ from unweighted. Map: 24 of 30. Every figure those harnesses produced described a different
scorer than the one they named.
An explicit package signature makes that a TYPE ERROR rather than a silent fallback. Design it so
the wrong shape cannot be passed quietly.

ALSO IN SCOPE
 · the synonyms argument — CC3 wired it to all 8 scorer call sites; the package must accept it and
   the invariants hold: ONE HOP NEVER TRANSITIVE · corroboration never promotes · a rejection is
   sticky · (a,b) and (b,a) are the same row · an absent table degrades to "no synonyms"
 · the staleness refusal — resolveTermWeights resolves a stale envelope to null exactly as
   server.js does. ⛔ Callers reaching for .weights themselves would apply weights the scorer is
   meant to reject, swapping one silent wrongness for another
 · shared/atsBands.js — ✅ **DECIDED 2026-09-27: the SCORE travels, the BANDS stay in draft.**
   The test is not "which product owns it" but what kind of thing it is: **the score is a fact about
   a résumé and a job description; the band is a product decision about how to present it.**
   Strong / Moderate / Weak, where the cutpoints sit, and "Not enough signal" as its own state were
   all calibrated against draft's board distribution and draft's users. Resume Master's customers
   would want their own thresholds against their own corpus, so it builds its own rather than
   inheriting cutpoints tuned for somebody else's board.
   ⛔ **BUT CHECK WHERE THE SENIORITY GUARD LIVES.** If it sits in atsBands.js it is misfiled: it is
   SCORING, not presentation — it moved ρ from 0.643 to 0.732 — and it must travel with the
   SCORER. Report whether the file separates cleanly or whether the guard has to be lifted out
   first.

DISTRIBUTION
Owner chose an npm package. State how both repos consume it — private registry, or a git dependency.
⛔ If publishing adds friction, copied-with-checksum is the pattern this project already uses for
contract/mobile-api.v1.json and it works. Recommend one; do not build two.

VERIFY — ⛔ THIS IS THE ACCEPTANCE TEST
scripts/am1GradedCorpusVerify.mjs must reproduce ρ = 0.746 TO 0.000 against the extracted package.
Not within tolerance — the tolerance was tightened 0.02 → 0.005 precisely because 0.02 absorbed a
0.009 drift for weeks and printed CONTROL OK. If ρ moves at all, something did not come across.
Also: the scrape-block assertion (no messages.create) must still hold, and scoring 1,000 board rows
must remain free and fast.
```

---

## A2 — The `resume-master` repo and the tools

```
⛔ THE REPO EXISTS AND IS EMPTY. It was created today, which is what silently re-pointed draft's
origin. Confirm draft's remote is github.com/Sri-Yellela/draft.git before anything else.

WHAT MOVES
 · coreGenerateResume and the generation prompt layers
 · enhanceProfileResume (the A+ path)
 · the formatting system — RESUME_STYLE_BLOCK, FORMATTING_SYSTEM, the deterministic HTML renderer
 · the PDF artifact and editor
 · résumé parsing (parse-pdf)
Both products import @draft/ats-scorer.

⛔ THE INTEGRITY RULES MOVE WITH THE CODE AND BECOME CONTRACTUAL. AF2's hard assertion that output
cannot claim more experience than the profile states; flag-don't-fabricate; §7. These are internal
protections today. As an API they are promises to third parties — keep every assertion and every
test, and say so in the API's own documentation.

⭐ FIX THE DUPLICATED RESUME CSS WHILE MOVING IT. 45 of 46 lines of RESUME_STYLE_BLOCK are
duplicated into the FORMATTING_SYSTEM prompt — which is HOW ONE CORRUPT CHARACTER reached both the
renderer and the model instruction, rendering a mangled bullet in every generated PDF. Interpolate
rather than duplicate. This is the right moment; it is a behaviour change and the prompt is being
rewritten anyway.

⭐ FIX PROMPT-CACHE BREAKPOINT PLACEMENT. See ROADMAP.md A2 for the full detail. In short: caching
is already wired and the defect is that the 6,704-token prefix is WRITTEN EVERY TIME AND READ NEVER.
Check placement against the 20-block lookback rule — a breakpoint on a block that varies per request
writes a fresh entry each time and never reads one. ⛔ Do NOT remove the breakpoints; the measured
net is $0.3632 saved and a lever already sits at the measured-best setting.

STATELESS — NO DATABASE. Input in, output back, nothing persisted. That is what keeps the privacy
story simple. Add one only when Resume Master has its own direct customers.

⛔ LOGGING MUST NOT RETAIN PAYLOADS. A résumé carries a home address, phone and employment history.
usage_events records tokens and cost, never content. Carry that rule across.

THE REBRAND GUARD NEEDS A CARVE-OUT. It forbids `resumemaster` literals, and a product legitimately
named that needs one. ⛔ Write it as a RULE in BRAND.md, not an allowlist entry — the allowlist
self-prunes, so an entry for files that do not exist fails immediately.
```

---

## A3 — The API contract

```
⛔ GENERATED, NEVER HAND-WRITTEN. The pattern exists and is proven: contract/mobile-api.v1.json is
produced by EXECUTING mapJobRow.js rather than parsing it, because a regex agrees with the source's
text while execution agrees with its behaviour. Reuse scripts/generateMobileContract.mjs's approach.

WHAT THE GENERATOR CAUGHT LAST TIME, and will again:
 · eight fields with no null coalescing, so JSON.stringify DELETES them — they arrive ABSENT, not
   null, and a typed decoder throws on a missing key it would accept as null
 · eleven wrong declarations in the contract's OWN first draft, found by an envelope harness the
   author had claimed existed and had not built

⛔ THE ENVELOPE HARNESS IS THE DELIVERABLE, not the schema file. Verify DECLARED shapes against REAL
responses, one-directional (real → declared) on purpose: several fields are legitimately conditional
and the reverse direction cries wolf and gets deleted.

ALSO
 · checksum manifest, LF-NORMALISED — the repos differ in line endings and a raw-byte verify fails
   spuriously
 · version it, and make a shape change without regeneration FAIL A TEST. That guard fired on its
   first real opportunity when nextCursor was added without regenerating
 · auth — ✅ **DECIDED 2026-09-27: a SERVICE TOKEN, modelled on the existing sessionLess tokens.**
   Long-lived secret in draft's environment, sent as a bearer header, with a revoke path. The
   pattern already exists twice: `/api/auth/extension-token` and `/api/auth/mobile-token`, both
   `sessionLess: true` and deliberately separate so revoking one does not kill the other. A service
   token is the same shape with a third audience.

   ⛔ **DO NOT MAKE IT SEAMLESS IN A WAY THAT COUPLES THEM.** The temptation, since the owner owns
   both products, is a shared secret or shared session infrastructure. That quietly turns two
   products back into one and undoes the reason for splitting. **draft holds a token exactly as any
   third party would** — which also means the API is genuinely exercised as an API rather than as an
   internal call wearing HTTP.
   ⛔ Not a shared cookie, not a shared SESSION_SECRET, and do NOT copy draft's environment across.
   Resume Master is stateless and needs almost none of it; SESSION_SECRET or GOOGLE_CLIENT_SECRET
   sitting in a second service widens the blast radius for no benefit.

   **BUILD PER-CLIENT ACCOUNTING FROM THE START, even with one client and no limits enforced.** If
   Resume Master ever has other customers, rate limiting and metering have to key on identity, and
   retrofitting identity into every call site afterwards is the expensive version. Report the shape;
   leave the limits off.
```

---

## A4 — draft calls the API

```
Replace direct calls to the moved tools with the generated client.

⛔ PERSONAL DATA NOW CROSSES A SERVICE BOUNDARY. Consequences, all required:
 · BOTH privacy policies describe the flow. Resume Master's says PROCESSES, DOES NOT RETAIN
 · PRIVACY_RECONCILIATION.md's four-column join gains a FIFTH column for the cross-service flow.
   ⛔ Note its third-party row is MANUALLY MAINTAINED and NOT covered by the test — it went stale
   for three weeks inside the file whose purpose is preventing exactly that
 · the Web Store data-use declaration needs re-checking
 · ⛔ verify the deployed policy by GREPPING THE BUILT BUNDLE. The URL returns a ~2,044-byte SPA
   shell with zero policy text; loading it proves nothing, and that check has been wrong five times

DEGRADATION — decide and state
What happens when Resume Master is unreachable? Generation fails, or queues, or degrades? ⛔ Capture
already learned this lesson: /api/import/job had a HARD model dependency and an unfunded balance
took it to zero rather than to a reduced mode. Do not recreate that shape across a network boundary.

⛔ A NON-RETRYABLE FAILURE MUST SAY SO. isPermanentModelFailure already exists in modelCall.js;
whatever replaces that path keeps the distinction. "Please try again" for a billing failure is a
message that can never be true.
```

---

## B — Stand up Resume Master

```
⛔ IN THIS ORDER. Moving a domain to a project with no code means resumemaster.one serves nothing
for as long as the build takes.

1. New Railway project. Deploy the tools service on its DEFAULT *.up.railway.app URL.
2. ⛔ VERIFY THERE BY ASSERTING A JSON KEY, never a 200. The SPA catch-all answers 200 with
   index.html for any unknown path and has produced a false finding FIVE times — the enrichment
   routes, approvalCap, /api/config, /api/admin/stats, and a "confirmed" deployment that had not
   happened.
3. Point draft's API client at that URL. End-to-end test.
4. ONLY THEN remove resumemaster.one from the draft service and add it to the tools service.
5. Remove the stale OAuth redirect URI for the old domain from Google Cloud Console (owner action).

⚠ Re-adding a custom domain means a NEW CERTIFICATE. Usually minutes. Do it at a quiet hour.
⚠ Domain slots are TWO PER SERVICE, confirmed — so this is not constrained.

VERIFY: both domains answer with their own service's version endpoint. draft still signs in. The
extension still captures against jobsviadraft.com — its manifest declares that host and it is under
review, so a break there is a rejection.
```

---

## Standing rules for every task here

```
Session-aware: read by SYMBOL, not line number. Regression-proof: dependents and children in the
SAME pass with verdicts. Migrations additive + dual-path, byte-identical in BOTH runners — and now
transactional, one migration per transaction including its schema_migrations row.

⛔ DO NOT use sed -i, Python whole-file writes, or anything that rewrites server.js or
scripts/migrations.js wholesale. The byte-identity tests depend on line endings and the failure
shows as CLEAN in git diff. It has bitten three times, including a checkout round-trip that
renormalised the tree and broke five tests on a byte-identical commit.

⛔ A GUARD NEVER SEEN TO FAIL IS NOT EVIDENCE. Seven have shipped inert in this project:
modelCallGuard missing messages.batches.create · its comment stripper erasing https:// URLs ·
three dead source anchors in passing tests · ae5BoardUi stubbing a dead logo host with a 1×1 PNG ·
ak2BandSurfaces green for months on a fixture that invented the field under test · the monetisation
lever cached as a boot constant making both states unreachable · privacyReconciliation's input a
hardcoded file list. Verify by INJECTING a violation.

⛔ SCREENSHOT ANYTHING USER-VISIBLE. In one session four separate things were green and wrong: a
privacy policy a single request falsifies, a harness scoring unweighted while labelling itself
weighted, a guard proving a sweep complete on the one component it could not see, and two tests
REQUIRING the legacy brand to stay. Code wired, tests passing, docs agreeing — the only thing that
disagreed was looking at the output.

Re-derive the test baseline first. Introduced failures must be 0. Note the two deliberate
submission-zip failures if the extension source has moved ahead of the published zip; they are not
rot.
```

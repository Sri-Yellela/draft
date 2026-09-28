# WORKLOG — the single source of truth

**This file is the only place work is tracked.** Every other doc is reference material for a task
named here. If a task is not in this file, it is not being worked on.

**Last updated:** 2026-09-28

---

## How to use this file

**Owner:** read *NOW* and *OWNER QUEUE*. Everything you need to do is there, in order, with nothing
else mixed in.

**Agent:** read *NOW* and *AGENT QUEUE*. Run the top item. When finished, write a report into
*SESSION LOG* at the top, move the task into *DONE* with one line, and update *CURRENT STATE* with
measured figures. ⛔ Do not create a new session-report file — P5 established those fold in here.

**Assistant (chat):** read the newest *SESSION LOG* entry, update *CURRENT STATE*, move finished
items to *DONE*, add new work to the queues, and record confirmed decisions in *DECISIONS*.

**At handover:** delete *AGENT QUEUE*, *OWNER QUEUE* and *SESSION LOG*. What remains — current
state, decisions, done, and the doc directory — is the handover document.

---

## CURRENT STATE

⚠ **Every figure here is measured, never carried forward.** This project's planning docs have been
stale **eight times**, twice about their own headline. Re-derive before trusting.

| | |
|---|---|
| Production (draft) | `jobsviadraft.com` — `/api/version` 09-28: commit **`e2e732f`**, contract 1.1.1, weighted scoring on (493 terms, 9.2 days old). ⚠ **Local commits not pushed**, A1 onward — see OWNER QUEUE 3 |
| Production (Resume Master) | **not deployed.** ⛔ `resumemaster.one/v1/version` answers **200** — it is draft's 2,029-byte SPA shell (`text/html`), because the domain still points at draft. Asserting the JSON key catches this; a 200 does not |
| Resume Master repo | `github.com/Sri-Yellela/resume-master`, `main` = **`0b84a5d`**. **171 tests, 171 pass** — also on a fresh CRLF clone |
| Resume Master contract | **v1.0.0**, generated — `contract/resume-master-api.v1.json` + `.d.ts`, shape hash `VERSIONS.json`. Envelope harness: 47 scenarios, every declared (route, status) covered. Live verifier: 21/21 against a local boot; **fails every check against `resumemaster.one` today**, as it must |
| Test baseline (draft) | **2696 / 2696 / 0** — measured 09-28 in the working tree, and 09-27 on a fresh CRLF worktree. No deliberate failures |
| Migration high-water | **109** (`109_restore_stripped_seniority_titles`) in both runners, 110 entries each; production reports 116 applied, latest 109 |
| Contract | v1.1.1 (mobile) · v1.0.0 (Resume Master, above) |
| Extension | **v1.1.1 reuploaded by the owner, 09-28** (built at `5e7f72e`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| ATS ρ | **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — owner-reported 09-28.** ⚠ Not yet verified by a real call: no generation has been exercised end to end since, and every A1/A2 model-backed test used a fake client. The first real generation is the verification |
| Users | **none** |
| `job_applications` | **empty** — nothing has ever validated the product against an employer |
| Board | ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

---

## NOW

**A4 — draft calls the Resume Master API.** A1–A3 are done; Resume Master is on GitHub at
`0b84a5d` with a generated contract (v1.0.0) and its envelope harness. A4 vendors `contract/` into
draft with a checksum test, builds the client, and replaces draft's direct generation calls.
⛔ Needs draft's real token (OWNER 1) before it can be exercised against anything live.

⚠ **draft has unpushed local commits** (`git log origin/main..main`): A1 and its test-count update,
the BRAND rule, the icons, and these worklog updates. ⛔ **Pushing deploys draft, and A1 carries the scorer registries into the production image,
so production ATS scores will change.** Deliberate owner decision, not an incidental push.

---

## OWNER QUEUE

| | Task | Why it is here |
|---|---|---|
| 1 | ⛔ **Mint draft's service token** — `node scripts/mintClientToken.mjs draft` in `resume-master/` | **Blocks Phase B.** It prints the token ONCE, which is why the agent did not run it. The token goes into draft's Railway env as `RESUME_MASTER_TOKEN`; the printed entry goes into Resume Master's `RESUME_MASTER_CLIENT_TOKENS` |
| 2 | **Replace the store icon in the dashboard** | Uploaded separately from the zip — the package upload does not carry it |
| 3 | **Decide when to push draft's unpushed commits** (`git log origin/main..main` — A1 onward) | ⛔ Production ATS scores change when A1 lands. Not a side effect of a routine push |
| 4 | **Phase B go-ahead**, then remove the stale `resumemaster.one` OAuth redirect URI from Google Cloud Console | After A4 |
| 5 | **AF5 — 30 supervised applications** | ⛔ LAST. Run ONE first and confirm `job_applications` gets a row with `ats_score_at_apply` populated |

✅ **Done by the owner:** the A2 file copy · Anthropic balance funded · extension v1.1.1 rebuilt,
committed and reuploaded · `marketing.md` deferred — **the pilot is gated to CS anyway**.

---

## AGENT QUEUE

Run top to bottom. One commit per task. Report into *SESSION LOG* between each.

| | Task | Prompt lives in | Blocked on |
|---|---|---|---|
| 1 | **A4** — draft calls the API. Vendor `../resume-master/contract/` into draft with a checksum test (the mobile-contract pattern, reversed); the vendor-naming carve-out lands with the client (`BRAND.md`) | `PHASE_A_B_EXECUTION.md` §A4 | owner token (OWNER 1) for any live run |
| 2 | **B** — deploy Resume Master, move the domain. Verify with `npm run verify:live -- --base <url>` in resume-master, never a 200 | `PHASE_A_B_EXECUTION.md` §B | A4, ⛔ owner go-ahead |
| 3 | Fix the two disagreeing `getDomainModuleKey` functions — ⚠ **half done:** collapsed to one in Resume Master (`5112249`, the resolver's, which is the one generation used — behaviour preserved). draft's two copies retire when A4 removes draft's generation path | below | A4 |
| 4 | `.dockerignore` excludes `data/` from the production image — **wider than QUALIFICATION_ROLE_MAP** | below | — |
| 5 | ⭐ **Reconcile `DONE` against `git log`** | below | — |
| 6 | Mobile corruption sweep (Android) | `CORRUPTION_SWEEP.md` | — |
| 7 | iOS Phase 1 audit | `../draft-ios/IOS.md` | ⛔ needs a Mac |

**5 · Reconcile the `DONE` section.** It was written from the chat record, not from `git log`, so it
is incomplete and possibly mis-dated. Walk the log, add what is missing, correct what is wrong, and
remove anything that never actually landed. ⛔ **Both directions matter** — this project has found
tasks marked open that were done *and* tasks marked done that were not, in the same audit.

**3 · Two `getDomainModuleKey` functions disagree.** A project-manager role in an unmatched domain
gets `pm_general` from one and `general` from the other. Shape 1. **Won in Resume Master:
`services/qualificationResolver.js`'s** — it is the one `coreGenerateResume` called, so every
existing résumé was produced by it; the classifier's private copy only fed `parsed.domainModuleKey`,
which generation overwrote. What remains is draft's side, which goes away with A4.

**4 · `.dockerignore` keeps `data/` out of the production image** (`data` + `data/`, re-including
only `ROLE_ALIAS_MAP.json`, since 2026-04-23; Railway's builder is Docker). Measured from the rule,
not from a production read — ⛔ confirm first with `[domain-registry] JSON file not found` in Railway
logs. It excludes FOUR tracked files, not one:
 · `DOMAIN_METADATA_REGISTRY.json` + `DOMAIN_TOOL_REGISTRY.json` — the scorer's vocabulary. **Fixed
   for the scorer by A1**: they now ship inside `packages/ats-scorer/data`. ⛔ Deploying A1 therefore
   changes production ATS scores (an empty vocabulary moved 27 of 30 graded scores). Still missing
   for `routes/domainProfiles.js`, masked by its `BUILTIN_REGISTRY` copy — compare the two before
   un-masking, or the picker changes too
 · `QUALIFICATION_ROLE_MAP.json` — `services/qualificationResolver.js`'s fallback, empty in prod.
   (`searchQueryBuilder.js` names it in its header but reads only `ROLE_ALIAS_MAP.json`, the one
   re-included file — checked, not affected)
 · the fix is probably `!data/*.json` — but it changes the domain picker in production, so it is a
   measured change with its own before/after, not a one-line tidy-up

---

## DONE

Newest first. One line each; detail lives in `SESSION LOG` or the named doc.

⚠ **This list was written from the chat record, not from `git log`.** It is almost certainly
incomplete and some items may be mis-dated. ⛔ **The next agent to touch this file should reconcile
it against `git log` and correct it** — that reconciliation is itself a queued task.

### The split (in progress)

| | |
|---|---|
| **A1** (`3c3fd1d`, 09-27) | `@draft/ats-scorer` extracted as a package. ✅ **Confirmed: ρ = 0.746, drift 0.000, at tolerance 0.005** against the package, plus 1,065 full reports deep-equal before/after. The wrong weights shape is now a TypeError. ⚠ Unpushed — carries the scorer registries into the production image, so **production ATS scores change on deploy** |
| **A2** (`5112249` in resume-master, `083ad39` BRAND rule in draft, 09-27) | Tools moved. ⛔ Only the STATELESS part crossed — `coreGenerateResume` mixes draft's DB reads and writes, notifications and weighted scoring with prompt assembly, the model call, formatting and the claim guard. Runtime-inputs text byte-identical to draft's over 324 cases |
| **A3 · contract** (`a76074f`, 09-28, resume-master) | Generated OpenAPI 3.1 + TypeScript, v1.0.0, LF-normalised checksums, append-only version → shape-hash ledger. Four shapes **derived by execution**; envelopes declared. ⛔ The envelope harness boots the real app on every `npm test` — 47 scenarios, every declared (route, status) covered, keys AND types checked. Live verifier for Phase B |
| **A3 · service token** (`1ad17a3`, 09-28) | Filed under A2 before; it is A3's auth half. `rmk_<client>.<secret>`; Resume Master stores only the hash in `RESUME_MASTER_CLIENT_TOKENS`. Rejected before the body is read · **503 with no clients configured rather than open** · a malformed token list stops boot · rotate by adding the new hash beside the old. Per-client accounting logs token counts only, failed calls included, limits off. 122/122, **each new check seen to fail when deliberately broken**; the token and its hash appear in no log |
| **Extension v1.1.1** (`5e7f72e`, 09-28) | ⛔ **v1.1.0 shipped with the old "RM" icon in all three sizes** while its name and listing said draft. Shipped the `/d` monogram — the only set consistent across sizes, since the full wordmark is illegible at 16px. ⛔ The manifest had carried **no top-level `icons` entry since May**, so the install and extensions-page surfaces showed a generic icon. Version bumped because the store refuses an upload at or below the version under review. Rebuilt, committed, **reuploaded by the owner** |

### Migration and rebrand — complete

| | |
|---|---|
| Domain | `resumemaster.one` → `jobsviadraft.com`. DNS moved to Cloudflare (GoDaddy cannot `CNAME` at an apex), certificate live, both hosts serving |
| Brand | Resume Master → **draft**. 79 files across three repos. `shared/brand.js` is the single source; a guard fails on any legacy literal outside an allowlist that **self-prunes** |
| Repo | `resume-master` → `draft` on GitHub and locally. Sibling paths fixed in both mobile repos. ⛔ Creating the new empty `resume-master` repo silently stopped GitHub redirecting the old name — caught before a push sent draft's history to the wrong repo |
| OAuth | Google and LinkedIn redirect URIs moved; `APP_BASE_URL`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL` updated |
| Email | Cloudflare Email Routing for `privacy@`; Resend verified for `noreply@` |
| The logo | Three implementations of one mark collapsed into one `StampLogo`. ⛔ The rebrand guard had been **blind to the most visible instance in the product** — `TopBar` split the name across two spans, and two tests *required* the legacy name to render |

### Extension — the v1.1.0 work (superseded in review by v1.1.1, above)

| | |
|---|---|
| Privilege escalation | ⛔ A fetch from the extension origin reached **7 of 7 admin routes**. Closed server-side, so already-published builds are protected too. Three separate `requireAdmin` definitions collapsed into `shared/authPolicy.js` |
| Identity | Own `sessionLess` token instead of the ambient cookie; the popup now names the account it acts as |
| Capture | Degrades instead of failing — parses the labelled block the published build already posts, so users benefit with no store update. ⛔ "Localhost" was filed as a company before the registrable-domain check landed |
| Dead routes | `/resume` and `/ats-score` did not exist and the SPA catch-all sent admins to `/admin`. Both tool pages also threw `ReferenceError` on render — **they had never worked**, and `vite build` exits 0 on that |
| Fill path | Read-back after set. A value the page reverts is now reported skipped, not filled. Comboboxes, multi-selects, dates, contenteditable added |
| Non-retryable errors | "Please try again" for a billing failure is a message that can never be true |
| Icons | ✅ Committed and shipped in **v1.1.1** — see the split section above. The two red `extensionSubmission` tests went green with the rebuild |

### Curation — CC1 to CC5

| | |
|---|---|
| CC1 / CC1b | `target_titles` stopped deciding board membership and became rank keys; the `job_role_map` INNER JOIN became LEFT with soft-null. Graded-corpus reachability **8/30 → 30/30**, 277 permanently invisible postings restored |
| CC2 | The bridge matches a term inside a phrase; `'[]'` stopped meaning mismatch. Multi-word match rate 53% → 75.5% |
| CC3 | `skill_synonyms` wired into all 8 scorer call sites. ⛔ The earlier "+0.000" was never a weak effect — **there was no effect path at all** |
| CC4 | A claimed term now reaches the band and the board, not only generation |
| CC5 | Every stored score keyed `(user_id, domain_profile_id, job_id)`. ⛔ The brief named one cross-user read; there were **seven**, and the two it missed were worse |
| ⛔ **Still true** | **The board ranks by `discovered_at DESC`, not by fit.** Explicitly scoped out; the highest-leverage item left |

### Pipeline, enrichment, infrastructure

| | |
|---|---|
| Enrichment control | Freshness gate on `scraped_at` (⛔ not `discovered_at` — same rows, opposite answers), manual trigger with dry run, export/import with five guards, batch provenance and revert |
| Provider routing | Built and guarded. ⛔ Verdict: **keep Haiku** — Groq scored 30.5% Jaccard, and its pinned model had been **deleted entirely** |
| Sources | Four more ATS providers enabled, +141 rows. Four companies seeded inactive at 0% description coverage. ⛔ Live search had been **structurally capped at three of seven sources** |
| Monetisation lever | One flag, off. `/pricing` had claimed paid upgrades against a **non-trader** declaration |
| Anonymous spend | `/api/standalone/generate` was Sonnet at 8192 tokens, unauthenticated, quota keyed on a cookie the caller controls. Bounded three ways |
| Version endpoint | `/api/version` — "what is deployed" went from git archaeology to one curl |
| Migrations | Now transactional. ⛔ Migration 108 was the first to destroy anything; a failure mid-way would have been a **boot loop with no way in** |
| Cleanup brake | `cleanup_log` id 85 deleted 1,288 rows locally. ⛔ The brake was committed, documented, and **not deployed** for a day |
| Board restore | 5 → 1,296 rows from a pinned evidence DB. ρ reproduces from the table, not only from a fixture |
| Logos | Clearbit is dead — no A record. ⛔ Its fallback for "provider unreachable" **was Clearbit**, and a silent Google-favicon fallback was sending browsing to an undisclosed third party |
| Docs | P5 reset: `README`, `HANDOFF`, `ARCHITECTURE` written from measured state, plus a doc guard |

### Mobile

| | |
|---|---|
| Android Phase 1 + 2a | Toolchain, auth via `/api/auth/mobile-token`, contract-typed API layer, Room persistence. ⛔ Builder and preview held **separate repositories**, so "Export as PDF" shipped the mock résumé |
| Android constraint fix | "Hard throw right: apply" was implemented in **five places** and reached a badge reading **"Application sent"** — having sent nothing |
| iOS | ⛔ **No session has ever run.** 30 of 32 Swift files are in the build target; the two omitted are the entire network and auth surface |


---

## SESSION LOG

Newest first. ⛔ Agents append here rather than creating a new file.

### 2026-09-28 · A3 — the API contract (`a76074f`, `0b84a5d` resume-master)

**Generated, never hand-written.** `contract/resume-master-api.v1.json` (OpenAPI 3.1) and `.d.ts`
from `scripts/generateContract.mjs`; `CHECKSUMS.json` LF-normalised for a consumer's copy;
`VERSIONS.json` an append-only version → shape-hash ledger.

- **Derived by execution**, where there is one chokepoint — the mapJobRow approach: `AtsReport`
  (scoreAtsLocally, 9 variant scenarios), `UsageRecord`, `ClaimViolation`, `ClaimInspection`.
  Execution found what a hand-written schema would miss: a violation's `claimed`/`allowed` are
  **numbers** for years and **strings** for seniority. Generation refuses if a derived array's
  item type was never observed — the first run left **five ATS arrays untyped**; a scenario was
  added rather than a guess.
- ⛔ **Premise that differs from the mobile contract's, in this service's favour.** Mobile envelopes
  had to be declared and checked by an occasional script because building them meant booting a
  server with a database. Resume Master has none, so **the envelope harness boots the real app on
  every `npm test`**: 47 scenarios, every endpoint × every declared outcome; each real response
  checked for JSON, a declared status, and every key AND value type declared (real → declared,
  one direction on purpose). Fails if any declared (route, status) is exercised by nothing, or if
  the route table and the app disagree.
- ⛔ **"Eight fields arrive ABSENT, not null" was mapJobRow's defect, not a law.** Over 1,065 real
  ATS reports every top-level key is always present. Inference round-trips through JSON so an
  `undefined` field would be declared optional.
- **Version guard fired twice on real shape changes during the work** — a nullable enum JSON Schema
  would have rejected as null (and TypeScript had silently dropped `| null`), and an undeclared 413
  on `/v1/ats/score`. 1.0.0 had never been committed, so the ledger was reset; from `a76074f` on, the
  same change needs a bump.
- **Live verifier** (`npm run verify:live -- --base <url>`): 21/21 against a local boot of
  `server.js`; **every check fails against `resumemaster.one` today** (draft's SPA), where a 200
  would have passed. That is Phase B's "verify there".
- **Found by running the suite repeatedly:** `auth.test`'s tampered token was a no-op for the 1 in
  64 tokens ending in "A". Fixed; 0 failures in 300 runs.
- **Structural vs real:** model TEXT in-process is canned; the body SHAPES come from the real
  handlers. No metered scenario has been run live.
- 171/171 (fresh CRLF clone too). Seven injected violations each caught — an undeclared key, a type
  change, an HTML 404, a dropped scenario, a hand-edited contract, an undocumented route, and a new
  field in the scorer's report (caught through the derivation alone).
- ⚠ `.idea/` was swept into `a76074f` by `git add -A`; untracked and ignored in `0b84a5d`.

### 2026-09-28 · Worklog brought up to date (before A3)

Measured, not carried: production `/api/version` → commit `e2e732f`, contract 1.1.1, 116
migrations applied, latest 109 · both runners' high-water 109 (110 entries each) · draft suite
2696/2696/0 · Resume Master `main` = `1ad17a3`, 122/122.

⛔ **`resumemaster.one/v1/version` answers 200 — and is draft's 2,029-byte SPA shell** (`text/html`),
because the domain still points at draft. That would have been a sixth "confirmed deployment" from a
200. Phase B's verify step must assert `service: "resume-master"`.

**DOC DIRECTORY was wrong in four places** (corrected below): `ARCHITECTURE.md` and `HANDOFF.md` are
at the repo root, not in `docs/`; `PRIVACY_RECONCILIATION.md` is in `extension/submission/`;
`NEXT_WORK.md` was listed "retire it" but was **already deleted** in P5 (CORRECTIONS_REGISTER says
so); and ~80 docs in `docs/` were unlisted.

**The `.dockerignore` task was narrower than the defect** — rewritten as agent task 5.
`searchQueryBuilder.js` was suspected and checked: it reads only the re-included `ROLE_ALIAS_MAP`.

**Owner-reported, not measured:** Anthropic balance funded; v1.1.1 reuploaded. No real generation
has run since, so the balance is unverified until the first one.

### 2026-09-28 · Service token + extension v1.1.1

**Token (`1ad17a3`, resume-master).** Built on the `sessionLess` SHAPE — a bearer secret per
audience, revocable independently — but ⛔ **not its storage**: draft's tokens are rows in draft's
database, and Resume Master has none. So it stores only `sha256(token)` in env. Rejected before the
body is parsed; zero clients fails closed (503); a malformed list refuses to boot; rotation by two
overlapping hashes. Per-client metering line per model request, failed calls included; the limit hook
runs before spend and allows everything. 122/122, four injected violations each caught. A real boot
with a throwaway token: 401 without, 200 with, neither token nor hash in the log.

**Icons (`5e7f72e`, draft).** ⛔ The committed icons — so every icon in the v1.1.0 package in review —
were the old **"RM"** mark. Two uncommitted sets differed: the wordmark set's 16px was a bare slash;
the `/d` set was consistent. Shipped `/d`. The manifest had had **no top-level `icons` key since
c818b9c (05-08)** — added. v1.1.1 because the listing's own checklist says the store refuses an
upload at or below the version in review. `publishExtension --dry-run` preflight OK; suite 2696/0.

### 2026-09-27 · A2 complete (`5112249` resume-master · `083ad39` draft)

Resume Master built from the copied modules plus a re-written kernel, runtime inputs, model path and
HTTP layer — **no database, no content logged**, usage records returned for the caller to meter.
The integrity rules are contractual in its `docs/API.md`: the claim guard runs before return, a
violation withholds the document (422), it cannot be skipped, an unread document is refused.

- **Prompt unchanged:** runtime-inputs text byte-identical to draft's `buildRuntimeInputs` —
  executed from `server.js` — over **324 cases, 0 differ**; a draft-rendered golden fixture pins it.
- **CSS:** `FORMATTING_SYSTEM` is now built from `RESUME_STYLE_BLOCK`; a test fails if its source
  restates CSS.
- **Cache:** breakpoints kept exactly; a test pins that no per-request value reaches a cached block.
- ⛔ **Caught by reading, not memory:** the seniority vocabulary is `junior|mid|senior|executive`;
  written from memory as "lead", which would have changed the classifier prompt.
- **Structural vs real:** every model-backed test uses a fake client and says so. Real runs: the
  324-case parity, the deterministic routes, a boot asserting `/v1/version`'s JSON key and a JSON 404.
- 111/111 at A2, also on a fresh CRLF clone; each new guard seen to fail on an injected violation.
- BRAND.md: the carve-out premise was wrong — the second product is its own repository, which
  draft's guard never scans. Replaced with the vendor-naming RULE, to land with A4's client.

### 2026-09-27 · A1 — `@draft/ats-scorer` (`3c3fd1d`, `85570d4`)

- ✅ **ρ = 0.746, drift 0.000, at tolerance 0.005** against the extracted package. ⛔ The brief's
  premise that the tolerance had been tightened was wrong for THIS script: only `al3` and `an3` had
  been; `am1GradedCorpusVerify` was still 0.02. Tightened.
- **ρ is too coarse on its own:** 16 of 30 postings already differ from the grading key while ρ
  holds, and an EMPTY vocabulary *raises* ρ to 0.791. So A1 also required **1,065 full reports
  deep-equal** before/after (graded 30 ± synonyms, 5 thin-résumé, 1,000 board rows).
- **Seniority guard:** not in `atsBands.js` — it was already in the scorer, and is worth
  **0.645 → 0.746** re-measured (the 0.643 → 0.732 in three docs was stale; corrected). What did NOT
  separate cleanly was `resume_depth`: the scorer embedded band presentation in every report, so the
  package stopped emitting it and draft's wrapper attaches it.
- **The remaining silent fallback:** any wrong `termWeights` shape still resolved to "unweighted".
  Now a TypeError; `termWeightEnvelope.test`'s "malformed → null" assertion inverted, reason recorded.
- ⛔ **Production has scored against an EMPTY vocabulary since April** — `.dockerignore` excludes
  `data/`, and the loader's "deliberate" empty fallback blamed Railway. Structural finding.
- ⛔ `.gitignore`'s unanchored `data/` would have left the package's registries **out of the
  commit** with every local test green. Caught at staging; now guarded.
- Suite 2696/2696/0 on a fresh CRLF worktree.

### 2026-09-27 · A2 inventory (paused before writing)

**Three brief premises were wrong:**

1. ⛔ **The prompt cache is already placed correctly.** The three breakpoints sit on the static
   system layers with per-request material (JD, résumé, candidate details) in the user message
   after them — exactly what the API guidance prescribes. Three blocks is far inside the 20-block
   lookback and three breakpoints is within the limit of four. **"Written every time and read
   never" is what a CORRECT breakpoint does when no second request arrives within five minutes.**
   Nine `resume_generate` calls locally, 6,704 written, 0 read. Nothing to move; pre-warming waits
   for D1.
2. **The duplicated CSS has drifted into THREE copies, not one corrupt character.** The live
   renderer moved to a new design and no longer draws its own bullet — that fix already landed.
   An unused copy at `server.js:271` and the `FORMATTING_SYSTEM` prompt still carry the old design;
   only 35 of the renderer's 43 lines survive in the prompt. So the optional reformatting pass
   would tell the model to reformat toward a design the renderer abandoned. Behind
   `RESUME_MASTER_LLM_FORMAT=1`, zero `resume_format` events. Fix by building the prompt from the
   renderer's CSS.
3. **There is no server-side PDF to move.** `/api/export-pdf` returns 503 by design ("use
   client-side print"). The PDF is the renderer's print-ready HTML printed by the browser. The
   editor is draft's UI and stays; Resume Master serves the print-ready HTML.

**⛔ `coreGenerateResume` cannot move as one piece.** It mixes draft's database reads and writes,
notifications and weighted scoring with the stateless part — prompt assembly, the model call,
formatting, the claim guard. Only the stateless part crosses.

**Usage tracking:** Resume Master returns token counts per call and draft records them in
`usage_events`. Keeps Resume Master stateless and gives per-client accounting a home.

**Also found:** two `getDomainModuleKey` functions disagree · `prompts/layer2_domains/marketing.md`
is never used · `QUALIFICATION_ROLE_MAP.json` is excluded from the production image · the brand-guard
carve-out is unnecessary, since Resume Master is a separate repo draft's guard never scans.

---

## DECISIONS

Confirmed and applied. ⛔ Do not re-litigate; if one is wrong, measure and record the reversal.

| Date | Decision |
|---|---|
| 09-28 | **`marketing.md` deferred** — the pilot is gated to CS. Resume Master carries today's behaviour (no mapping selects it) |
| 09-28 | Extension icon is the **`/d` monogram** at every size; v1.1.1 |
| 09-27 | **Bands stay in draft, the score travels.** The score is a fact about a résumé and a JD; the band is a product decision. Cutpoints were calibrated on draft's board. ✅ **Checked in A1: the seniority guard was never in `atsBands.js`** — it is in the scorer and travels with it. `resume_depth` was the part that had to be lifted out |
| 09-27 | **Service token for draft → Resume Master**, on the existing `sessionLess` pattern. ⛔ Not a shared secret — draft holds a token exactly as any third party would, or the API is an internal call wearing HTTP. Per-client accounting built from the start, limits off |
| 09-27 | Commit trailers off in both repos |
| 09-26 | **AF5 runs LAST**, against the final path. Two-day build window kills the parallel argument |
| 09-26 | **Two unlinked products.** Separate users, databases, deployments. `resumemaster.one` is **never retired**; ⛔ **the 301 never happens** — a credentialed fetch returns an opaque response reading as an empty answer, forever |
| 09-26 | Resume Master is **stateless, no database** |
| 09-26 | The ATS scorer is an **npm package, not an HTTP call** |
| 09-25 | Brand is **draft**, lowercase wordmark. `com.draft.android` / `com.draft.ios` |
| 09-25 | Audience is **students and new grads**. ⛔ Blocked on ingestion — the board is 3.0% entry/intern |
| — | Enrichment stays on **Haiku**. Groq measured 30.5% Jaccard on `skills_json` |

---

## DOC DIRECTORY

✅ **Verified against the tree 2026-09-28.** Paths are from the repo root. Four entries were wrong
when this was written from memory — the root-level and extension paths below, and `NEXT_WORK.md`,
which P5 had already deleted.

**Live — read these**

| File | For |
|---|---|
| `docs/WORKLOG.md` | ⭐ this file. The only place work is tracked |
| `docs/PHASE_A_B_EXECUTION.md` | the current split. A1–A4 and B |
| `docs/ROADMAP.md` | sequencing across all phases and both products |
| `docs/PRODUCT_MODEL.md` | the reasoning behind the two-product split and the daily draft |
| `docs/BRAND.md` | naming, canonical host, permanent identifiers — and the vendor-naming rule for A4 |
| `ARCHITECTURE.md` | ⚠ **repo root**, not `docs/`. What the system actually does, measured |
| `HANDOFF.md` | ⚠ **repo root**. Orientation for a new session |
| `docs/CORRECTIONS_REGISTER.md` | ⭐ every wrong claim and what replaced it. **Read as method, not fact** |
| `docs/FINDINGS_ARCHIVE.md` | the defect shapes and their precedents |
| `docs/STUDENT_BOARD_FINDING.md` | why the audience pivot is blocked on ingestion |
| `extension/submission/PRIVACY_RECONCILIATION.md` | ⚠ **not in `docs/`**. ⛔ Enforced by a test; its third-party row is manually maintained and NOT covered |
| `extension/submission/STORE_LISTING.md` | the Web Store copy and the upload checklist — now v1.1.1 |
| `docs/am1-ats-graded-corpus.json` | ⛔ **irreplaceable** — the original postings were destroyed in the id-85 deletion |
| `../resume-master/docs/API.md` | Resume Master's API and its contractual promises |

**Reference — superseded but kept for reasoning** (all in `docs/`)

`MIGRATION_AND_REBRAND.md` (done; retirement steps struck) · `DOMAIN_MIGRATION.md` (superseded) ·
`AUDIT_AND_REPLAN.md` · `RECONCILE_AND_RESIDUAL.md` · `CURATION_CONSOLIDATION.md` ·
`P5_DOCUMENTATION_RESET.md` · `MOBILE_STATE.md` · `DETAIL_FETCH_ECONOMICS.md` (open; Phase 1 and 2
findings in `DETAIL_FETCH_PHASE1_FINDINGS.md` / `DETAIL_FETCH_PHASE2_VERIFY.md`) ·
`CORRUPTION_SWEEP.md` (desktop done, mobile pending) · `EXTENSION_DIAGNOSIS.md` (the extension's
history, §6.6 the deliberate-failure record)

**Task records, one per task — detail behind DONE entries** (all in `docs/`)

`CC1_BOARD_MEMBERSHIP` · `CC1B_ROLE_KEY_SOFT_NULL` · `CC2_SKILL_MATCHING` · `CC3_SYNONYMS_WIRED` ·
`CC4_CLAIMS_REACH_CURATION` · `CC5_PER_PROFILE_SCORES` · the `af*`, `ai*`, `aj*`, `ak*`, `al*`, `am*`
reports · `auto-apply-*` · `GATED_HANDOFF_*` · `ATS_TERM_WEIGHTS_SCHEDULE` · `MONETISATION_AUDIT` ·
`PIPELINE_DIAGNOSIS` · `ENRICHMENT_BACKLOG_2026-09-18` · `PART1_RECONCILED*` · `ROLE_MAP_BACKFILL` ·
`SOURCE_HEALTH_FALSE_CRITICAL` · `SWIPE_FEED_DESIGN` · `w1-ats-providers` · `x1-clearbit-dead` ·
`jobo-auto-apply-analysis` · `jobs-segregation-architecture` · `linkedin-extension-audit` ·
`mobile-linkedin-import` · `profile-isolation-note` · `privacy-policy.md`

**Prompt collections** — `EXECUTION_PROMPTS.md` · `QUEUED_PROMPTS.md` · `AUTOAPPLY_PROMPTS.md` ·
`GATED_HANDOFF_PROMPTS.md`. ⚠ Superseded as a queue by this file; not yet classified by a retirement
pass.

**Directories** — `ai1-summary/` · `migration/` · `monetisation-lever/` · `privacy/` ·
`store-screenshots/`

---

## STANDING RULES

Prepend to every agent task.

```
Session-aware: read by SYMBOL, not line number. Regression-proof: dependents and children in the
SAME pass with verdicts. Migrations additive + dual-path, byte-identical in BOTH runners, and
transactional. Re-derive the test baseline first; introduced failures must be 0.

⛔ A 200 IS NOT EVIDENCE. The SPA catch-all answers 200 with index.html for any unknown path and has
produced a false finding FIVE times. Assert a specific JSON key.

⛔ A GUARD NEVER SEEN TO FAIL IS NOT EVIDENCE. Seven have shipped inert. Verify by INJECTING a
violation.

⛔ SCREENSHOT ANYTHING USER-VISIBLE. In one session four things were green and wrong: a policy a
single request falsifies, a harness scoring unweighted while labelling itself weighted, a guard
proving a sweep complete on the one component it could not see, and two tests REQUIRING the legacy
brand to stay.

⛔ NO sed -i, NO Python whole-file writes on server.js or scripts/migrations.js. The byte-identity
tests depend on line endings and the failure shows as CLEAN in git diff. Three incidents.

⛔ WHERE A PREMISE IS WRONG, SAY SO AND MEASURE. Three briefs in a row had their central premise
inverted by the first measurement, and each time that was the most valuable thing in the session.
```

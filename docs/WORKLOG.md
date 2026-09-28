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
| Production (draft) | `jobsviadraft.com` ONLY — **`a7a9c7f`**, deployed 09-28 18:20Z (B step 4's policy fix). A1 and A4 are LIVE. Verified: `/api/auth/me` JSON, Google sign-in redirects to the `jobsviadraft.com` callback, the capture endpoint answers JSON; the BUILT bundle carries the new policy sentences and not the old one |
| Production (Resume Master) | **LIVE at `https://resumemaster.one`** (since B step 4, 09-28 — verifier 21/21 ON THE DOMAIN; ⛔ certificate `VALIDATING_OWNERSHIP` until the owner's DNS edit) and `https://resume-master-production-d960.up.railway.app`, commit **`814356d`**, service `resume-master` in draft's Railway project `resume-master` (owner's choice: kept there). Boot log: `model=true clients=["draft"]`. ⛔ `resumemaster.one` still points at draft (B step 4 not done) — it answers draft's SPA shell |
| Resume Master repo | `github.com/Sri-Yellela/resume-master`, `main` = **`814356d`**, auto-deploys on push. **197 tests, 197 pass** |
| draft ↔ Resume Master | draft's `RESUME_MASTER_URL` → the Railway URL above; token set. ⭐ **First real generation, 09-28**: through the live service AND through draft's own client on draft's production env — both passed the claim guard; **first cache READ ever on generation** (7,009 read, 0 written) once two requests fell inside five minutes. ⚠ Not yet run through draft's HTTP route by a signed-in user (OWNER 2) |
| Resume Master contract | **v1.0.0**, generated; vendored in draft. **Live verifier: 24/24 conform against the deployed service, including the three metered scenarios** |
| Test baseline (draft) | **2691 / 2691 / 0** — measured 09-28 after A4 in the working tree AND on a fresh CRLF worktree (root + `client/` dependencies installed). Fell from 2696 because the prompt's tests MOVED to resume-master; nothing was dropped. No deliberate failures |
| Migration high-water | **109** (`109_restore_stripped_seniority_titles`) in both runners, 110 entries each; production reports 116 applied, latest 109 |
| Contract | v1.1.1 (mobile) · v1.0.0 (Resume Master, above) |
| Extension | **v1.1.1 reuploaded by the owner, 09-28** (built at `5e7f72e`; `/d` icon, top-level `icons` key). Replaces v1.1.0, which carried the old "RM" icon. Manifest declares `https://jobsviadraft.com/*`. ⚠ Owner-reported; the dashboard is not agent-visible |
| ATS ρ | **0.746**, drift 0.000, against the extracted package (`am1GradedCorpusVerify`, tolerance now 0.005). Seniority guard is worth 0.645 → 0.746 |
| Anthropic balance | **Funded — VERIFIED 09-28** by real generation, A+ and PDF calls (Resume Master references draft's `ANTHROPIC_KEY`, owner's choice) |
| ⛔ Fabrication | **2 of 2 real generations contained material the candidate never stated** (a JD skill; two invented responsibility bullets and an unsourced skill). The claim guard enforces years and seniority only. Resume Master's `docs/API.md` now says so. ⛔ **Blocks AF5** — agent queue 2 |
| Users | **none** |
| `job_applications` | **empty** — nothing has ever validated the product against an employer |
| Board | ~2,663 active per `STUDENT_BOARD_FINDING.md` (not re-measured against production this session; local `scraped_jobs` = 2,616). **80 (3.0%) are entry or intern** |

---

## NOW

**B — steps 1–4 done; ⛔ one owner DNS edit left, then step 5.** `resumemaster.one` now serves
Resume Master (verified 21/21 on the domain itself); draft `a7a9c7f` serves only `jobsviadraft.com`,
signs in, and its deployed policy says where each address goes.

⛔ **The DNS edit is not optional.** The domain works today only because Railway's edge routes by
hostname and the OLD A record still reaches the same edge. The certificate for Resume Master's copy of
the domain is `VALIDATING_OWNERSHIP` and cannot issue or renew until DNS points at the NEW target —
see OWNER QUEUE 1.

---

## OWNER QUEUE

| | Task | Why it is here |
|---|---|---|
| 1 | ⛔ **At name.com, point `resumemaster.one` at the new target:** change the apex record from `b8h66npc.up.railway.app` to **`hhdv8gnd.up.railway.app`** (ANAME/CNAME-flattened at `@`, as today). Then tell the agent, who checks `railway domain status a2ac6249-2c0d-4450-9352-ba915c6b9b41` for a VALID certificate | The certificate cannot issue or renew until this is done; today's working state is an edge-routing coincidence |
| 1b | ~~Generate ONE résumé in the app~~ ✅ done 09-28 — recorded end to end (see G2 answer) | Closes B step 3's last gap: the HTTP route, the `usage_events` row and the lift measurement have not run on the new path. ⚠ READ the result — see *Fabrication* in CURRENT STATE |
| 2 | ~~B step 4 go-ahead~~ ✅ given and done 09-28 — domain moved, except the DNS edit in row 1 | New certificate; a quiet hour. See NOW for the pre-check |
| 3 | At a quiet moment: delete the stray `RESUME_MASTER_CLIENT_TOKENS` from the **draft** service | Inert (draft never reads it), but Railway's `variable delete` cannot skip the redeploy, so it restarts production |
| 4 | ~~Replace the store icon in the dashboard~~ ✅ done by the owner, 09-28 | Uploaded separately from the zip — the package upload does not carry it |
| 5 | **B step 5: remove the stale `resumemaster.one` OAuth redirect URI** from Google Cloud Console | ✅ Unblocked — draft's live redirect is `https://jobsviadraft.com/auth/google/callback` (read from the redirect Google receives). The old URI now points at a service with no `/auth` route |
| 6 | **AF5 — 30 supervised applications** | ⛔ LAST. The résumé-guard work (G1) is **deferred to post-migration by the owner (09-28)** — AF5 itself is post-migration, and every generated document still needs reading before it is sent. Run ONE first and confirm `job_applications` gets a row with `ats_score_at_apply` populated |

✅ **Done by the owner:** the A2 file copy · Anthropic balance funded · extension v1.1.1 rebuilt,
committed and reuploaded · `marketing.md` deferred — **the pilot is gated to CS anyway** · **service
tokens minted and live** (09-28) — draft's in its Railway env as `RESUME_MASTER_TOKEN`, the entry in
Resume Master's `RESUME_MASTER_CLIENT_TOKENS`. ⚠ Owner-reported; the agent never saw the token, by
design.

---

## AGENT QUEUE

Run top to bottom. One commit per task. Report into *SESSION LOG* between each.

| | Task | Prompt lives in | Blocked on |
|---|---|---|---|
| 1 | **B step 4 close-out** — after the owner's DNS edit, confirm `railway domain status a2ac6249-…` shows a VALID certificate and re-run `verify:live -- --base https://resumemaster.one` | `PHASE_A_B_EXECUTION.md` §B | ⛔ owner DNS edit (OWNER 1) |
| 2 | ⏸ **DEFERRED to post-migration by the owner (09-28)** — "a work in progress". An unsupported-content check for generation. 2 of 2 real generations stated things the candidate never did. Measure first: generate against real base résumés (thin and full) and count unsupported bullets and skills — the rate decides the design (withhold vs flag vs mark for review). Then a mechanical check beside the claim guard, same contract (a violation withholds or flags; never silently passes) | Resume Master `docs/API.md` promise 3 | — |
| 3 | Delete draft's two dead `getDomainModuleKey` copies — the disagreement is **resolved** (one definition in Resume Master, `5112249`); since A4 neither draft copy has a caller that reads its result | below | — |
| 4 | `.dockerignore` excludes `data/` from the production image — **wider than QUALIFICATION_ROLE_MAP** | below | — |
| 5 | ⭐ **Reconcile `DONE` against `git log`** | below | — |
| 6 | Mobile corruption sweep (Android) | `CORRUPTION_SWEEP.md` | — |
| 7 | iOS Phase 1 audit | `../draft-ios/IOS.md` | ⛔ needs a Mac |

**5 · Reconcile the `DONE` section.** It was written from the chat record, not from `git log`, so it
is incomplete and possibly mis-dated. Walk the log, add what is missing, correct what is wrong, and
remove anything that never actually landed. ⛔ **Both directions matter** — this project has found
tasks marked open that were done *and* tasks marked done that were not, in the same audit.

**3 · Two `getDomainModuleKey` functions disagreed.** A project-manager role in an unmatched domain
got `pm_general` from one and `general` from the other. Shape 1. **Resolved in Resume Master:
`services/qualificationResolver.js`'s won** — it is the one `coreGenerateResume` called, so every
existing résumé was produced by it. ✅ Since A4 both draft copies are dead: `qualificationResolver`'s
export has no caller, and `classifier.js`'s private copy only sets `parsed.domainModuleKey`, which
smart-search (its one remaining caller) never reads. Deleting them is cleanup, not a behaviour change.

**4 · `.dockerignore` keeps `data/` out of the production image** (`data` + `data/`, re-including
only `ROLE_ALIAS_MAP.json`, since 2026-04-23; Railway's builder is Docker). Measured from the rule,
not from a production read. ⚠ **B found a second layer:** production's `/app/data` is a Railway
VOLUME (`resume-master-volume`, where the database lives), and a volume mounted there hides whatever
the image put at that path — so what production reads from `data/` is whatever the volume holds, not
the image. The 409 retained log lines carried no `[domain-registry] JSON file not found`, which only
fires when that route is hit; a container listing needs an SSH key on the Railway account (not set
up). Still unobserved either way. Scorer: unaffected since A1, which reads from the package, outside
the volume. It excludes FOUR tracked files, not one:
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

## ⛔ OBSERVED IN PRODUCTION — 2026-09-29, first real generations

The first time anyone read real output end to end. **Seven findings, none blocking the domain move,
several blocking AF5.** Recorded so they are not lost in the split's momentum.

### ⛔ G1 · Generation invents content — BLOCKS AF5

Agent-found. Two real documents said things the candidate never did: **Kafka, lifted from the job
ad**, and two unsourced responsibility bullets ("Collaborated with risk and infrastructure
teams…", "Instrumented service-level metrics…") plus an unsourced skill.

⛔ **The prompt forbids this. The claim guard only checks YEARS and SENIORITY, so both passed.**
Not new with the split — the same prompt draft always used. An unsupported-content check is queued.

⚠ Two samples on a deliberately thin test résumé show the problem exists; they do not give a rate.

### G2 · The generated résumé looks barely changed — owner-observed

Against the owner's real (thick) résumé, output reads close to the input. ⚠ **In tension with G1**,
which was measured on a thin one — a thin résumé may invite padding while a thick one gets almost
nothing. **Neither the change rate nor the invention rate is measured.** Both need a real sample,
not two anecdotes.

⛔ Open and unverified: **is generation even being triggered on the web route?** The usage record
from the owner's run is the check, and the agent is waiting to read it.

✅ **Answered, agent-measured 09-28 from both services' logs: YES.** The owner's run went
`/api/generate` → the tools service in 28.6 s, module `engineering`; the claim guard inspected 5,678
chars; `usage_events` got a `resume_generate` row (user 3, Sonnet 5, 3,979 in / 3,798 out,
**$0.0635**, a cold 7,009-token cache write); and the lift was recorded **42 → 58 (+16)**. Resume
Master's metering line matches to the token. So the model ran and the scorer saw a 16-point change —
"barely changed" is then a question about WHAT changed, which still needs the real sample above.

### ⛔ G3 · AG4's duplication defect is LIVE AGAIN

The generated résumé shows a role stated three times:

```
Stripe | Software Development Engineer, Payments Infrastructure Bangalore
Software Development Engineer, Payments Infrastructure        ← italic restatement
Bangalore
```

⛔ This is **exactly** AG4's shape, and AG4's tests pass: *"a model's plain-text restatement of the
header and bullets is read, not reprinted"* · *"a nested entry-header does not leak its date into
the body"*. **Green tests, live defect** — the eighth instance of that pattern. The tests assert
something narrower than the behaviour, or the path has changed under them.

Corroborated independently, agent 09-28: the agent's own second real generation (synthetic résumé,
Stripe role) extracted as `Stripe | Software Engineer 2021 - 2025 Software Engineer 2021 - 2025` and
`B.S. Computer Science 2021 B.S. Computer Science 2021` — the same role-restatement shape, on a
different résumé. Two independent documents, so it is not a one-off input.

### G4 · Formatting need not be a model call at all — and mostly already is not

⭐ **The owner is right, and it is closer to true than it looks.** Formatting is deterministic
(`resumeFormatter.js`). The LLM formatting pass is behind `RESUME_MASTER_LLM_FORMAT=1` and A2 found
**zero `resume_format` events ever** — it has never run.

⛔ But the stale artifact remains: `FORMATTING_SYSTEM` still carries **35 of the renderer's 43 CSS
lines describing a design the renderer ABANDONED**. So the prompt spends tokens on, and could
instruct a model toward, a layout that no longer exists.

⚠ **Correction, agent 09-28: that artifact is already gone.** A2 rebuilt `FORMATTING_SYSTEM` in Resume
Master FROM `RESUME_STYLE_BLOCK` (a test fails if its source restates any CSS), and A4 deleted
draft's copy along with the unused `server.js` stylesheet. What is left is only the decision below —
and it is now a decision about Resume Master's code, off by default and never run.

**Decide:** delete the LLM format path outright, or rebuild its prompt from the renderer's CSS.
Deleting is cheaper and nothing uses it.

### ⛔ G5 · The ATS panel shows a NUMBER and a BAND, and they read as contradictory

The panel shows **"ATS Score 58"** beside **"Strong match"**.

⛔ **The band is CORRECT** — the Strong cutpoint is 44 at 100% precision, and v4's median is 28, so
58 is comfortably Strong. **The defect is showing the number at all.** 58/100 reads as a failing
grade to a human; ρ = 0.746 supports coarse ordering and not a displayed figure; and the mobile
contract already marks `matchScore` **INTERNAL — DO NOT DISPLAY**. The desktop panel never got the
same treatment.

**Fix: show the band, drop the number.** `UI_REDESIGN.md` already says this; it is live today and
does not need to wait for the redesign.

### G6 · The generic-language classifier has gaps

A "Generic language" section exists and correctly holds *Managed, Partnered, Coordinated, Grew* —
but **"Defined" and "Created" are listed as MISSING VERBS**, and **"collaboration" as a MISSING
COMPETENCY**.

All three are things almost any candidate could claim, so surfacing them as gaps implies a
deficiency that is not real. ⛔ AH3 built exactly this suppression and set a specificity threshold;
these three sit the wrong side of it. Note the corpus head is **soft skills, not technologies** —
*collaboration* appears 199 times — so the threshold is under-tuned rather than absent.

### G7 · Resume Master's Railway URL errors in a browser — ⚠ CHECK BEFORE THE DOMAIN MOVE

`resume-master-production-d960.up.railway.app` returns an error when opened directly, while the
agent's live verifier passes **24 of 24 scenarios** against it.

⚠ **Most likely benign** — an API-only service has no route at `/`, so a bare visit 404s. But
⛔ **confirm what the root returns and that it is intentional BEFORE moving `resumemaster.one` onto
it.** A domain move onto a service that genuinely errors makes the failure public, and this project
has five precedents of a status code being read as evidence in the wrong direction.

✅ **Confirmed before the move, agent 09-28, with a browser's own request** (Chrome user-agent,
`Accept: text/html…`): `/` → **404 `application/json` `{"error":"not_found"}`**, and `/favicon.ico` and
`/robots.txt` the same. INTENTIONAL: the service has no root route, its catch-all answers every
unknown path with a JSON 404 by design (the opposite of draft's SPA catch-all), and that is declared
in the contract (`x-not-found`) and pinned by two envelope-harness scenarios. A browser renders it as
raw JSON on a 404 — which reads as an error, and is not one. ⚠ Consequence accepted: since step 4,
anyone opening `resumemaster.one` sees that JSON. A human-facing root is a contract change (a route,
so a version bump) if ever wanted.

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
| **B step 4** (09-28) | `resumemaster.one` moved to Resume Master and verified 21/21 on the domain; the policy's two now-false sentences fixed and verified in the built bundle (`a7a9c7f`). ⛔ Certificate waits on the owner's DNS edit |
| **B steps 1–3** (09-28) | Resume Master live on Railway (`814356d`), verified 24/24 incl. metered; draft `e046b7c` live and calling it; first real generations and first cache read. Found and fixed: a rejected request reported retryable (`fc5ed5c`). ⛔ Found: generation invents content (2/2) — blocks AF5 |
| **A4** (`8a3eb53` draft, deployed at B step 3 · `1fbb9bb` resume-master, 09-28) | draft calls the tools service for generation, A+ and PDF reading, as a third-party client with its own token; contract vendored and checksum-pinned. ⛔ **`/api/standalone/generate` had never passed the claim guard** — fixed by routing it through the service. PDF reading degrades to local extraction. Every error says whether retrying helps. draft's prompt copy and its assembler deleted. Privacy: policy + reconciliation's fifth column; Web Store declaration re-checked, unchanged |
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

### 2026-09-28 · B step 3 close-out + step 4 — the owner's generation, and the domain move

**The owner's web-route generation, read from both services' logs** (the production database is not
reachable without an SSH key): `/api/generate` → tools service in 28.6 s; claim guard inspected
5,678 chars; `usage_events` row written ($0.0635, 3,979 in / 3,798 out, cold 7,009 cache write);
lift **42 → 58**. Resume Master's metering line matches to the token. Step 3 is closed.

**The root URL, before the move — confirmed, not assumed:** a browser's own request (Chrome UA,
`Accept: text/html`) gets `404 application/json {"error":"not_found"}` at `/`, `/favicon.ico` and
`/robots.txt`. Intentional and contract-pinned; it only LOOKS like an error. See G7.

**Pre-check that changed the move:**
- draft's config referenced the old domain nowhere; but ⛔ **two privacy-policy sentences would have
  gone false the moment it moved** ("reachable at the former address… the same servers"; "sent to
  either address… both reach the same servers"). Rewritten and deployed in the same window (`a7a9c7f`)
  — verified by grepping the BUILT bundle, the page URL being a 2,029-byte shell.
- ⛔ **The repo contradicted itself about v1.0.0** — tests called it "published… on users' machines",
  the listing "never published". The owner: **published UNLISTED**. It posts to the former address, so
  its captures stop being received — accepted, and now said in the policy and the listing.

**The move:** `resumemaster.one` detached from draft and attached to Resume Master on port 8080.
Railway issued a new DNS target (`hhdv8gnd` replacing `b8h66npc`). ⭐ The domain served Resume Master
immediately — `verify:live --base https://resumemaster.one`: **21/21**, where this morning every check
failed there. ⛔ That is Railway's edge routing by hostname while the OLD A record still reaches it —
**not** the DNS being right. The certificate is `VALIDATING_OWNERSHIP` until the owner's name.com edit.

**draft after:** `jobsviadraft.com` only; sign-in redirects to the `jobsviadraft.com` callback; the
capture endpoint answers JSON; 2691/2691.

### 2026-09-28 · B steps 1–3 — Resume Master live; draft calls it; the first real generations

**Step 1 — the service existed, and was half-configured.** The owner had created `resume-master` as a
service INSIDE draft's Railway project (kept there, owner's choice; an empty `vibrant-tenderness`
project also exists). It auto-deploys from GitHub. ⛔ "Tokens are live" held for draft only: the
client list `RESUME_MASTER_CLIENT_TOKENS` was on the **draft** service, and Resume Master had **no
model key** (it reads `ANTHROPIC_API_KEY`; draft's is `ANTHROPIC_KEY`). Fixed: the hash entry copied
across (format-checked; hashes only), and `ANTHROPIC_API_KEY = ${{draft.ANTHROPIC_KEY}}` as a Railway
reference (owner's choice) — no secret passed through the agent. ⚠ Agent slip: `railway domain` with
no arguments CREATES a domain; it generated the `*.up.railway.app` URL step 1 needed, unintended.

**Step 2 — verified by JSON key.** `/v1/version` → `service: "resume-master"` at the deployed
commit; JSON 404s; auth fails closed until the list is set, then `model=true clients=["draft"]` in the
boot log. `verify:live` via `railway run --service draft` (draft's real token, never seen): 21/21.

**Step 3 — draft pointed at it and pushed.** `RESUME_MASTER_URL` set with `--skip-deploys`, so draft
restarted once — on the push of A1…A4 (`e046b7c`). Boot: `tools service client: configured`. The
stray client list on draft is left (inert; `variable delete` cannot skip a redeploy).

**The first real generations this project has run end to end:**
- `verify:live --metered`: generation and A+ passed; **parse-pdf failed** — two findings:
  1. ⛔ **A request the provider REJECTED was reported retryable.** An invalid PDF → provider 400
     `invalid_request_error` → service `502 retryable:true`. Retrying an invalid document fails
     identically forever. Fixed in resume-master `fc5ed5c`: 400/401/403/404/413/422 are permanent
     (draft's `failureAttribution` set). No contract change.
  2. The fixture was a zero-page stub whose comment called it "well-formed" — green in every
     in-process test, rejected on first contact. Replaced with a real one-page PDF with a computed
     xref, read back by all four bundled `pdf.js` versions.
  → re-run after the fix: **24/24 conform against the live service**.
- **Through draft's own client on draft's production env** (synthetic candidate, JD asking 8+ years,
  profile 4): the claim guard passed a real document that claims no years figure and keeps the
  candidate's own level ("Backend Engineer", not the JD's "Senior…"). ⭐ **First cache READ ever on
  generation: 7,009 read, 0 written** — two requests inside five minutes, which confirms A2's finding
  that placement was right and arrival rate was the constraint.
- ⛔ **FABRICATION, the most important finding of B:** 2 of 2 real documents stated things the
  candidate never did — one listed Kafka from the JD; the other added two bullets describing
  responsibilities with no source ("Collaborated with risk and infrastructure teams…",
  "Instrumented service-level metrics…") and an unsourced skill. The prompt forbids exactly this
  ("Never fabricate … responsibilities"; "Generate bullets ONLY from the candidate's real
  experience"); the claim guard enforces years and seniority only, so both passed. Not a regression
  — the same prompt draft always used; the first time real output was read. The base résumé was
  deliberately thin, which may invite padding; 2 samples is a finding, not a rate. Resume Master's
  `docs/API.md` (`814356d`) now separates what is ENFORCED from what is only INSTRUCTED. Queued as
  agent task 2, ⛔ blocking AF5.
- ⚠ Also seen, unconfirmed: the role and education lines appeared twice in the extracted text —
  possibly an entry-header/entry-role render duplication, possibly the extraction; needs a render.

**Not verified:** the HTTP route, `usage_events` row and lift measurement on the new path need a
signed-in user (OWNER 1). The empty-vocabulary claim about production stays structural — and the
listing showed `/app/data` is a volume, which changes the mechanism (agent task 4).

### 2026-09-28 · A4 — draft calls the tools service (`8a3eb53` draft · `1fbb9bb` resume-master)

**What moved.** `coreGenerateResume`, `enhanceProfileResume`, `/api/parse-pdf` and
`/api/standalone/generate` now call `services/toolsService.js`; the request body is built by
`services/toolsServiceRequests.js` with the exact mapping the 324-case prompt-parity check used.
draft keeps its database work, scoring with its own weights, the lift measurement and notifications.

**Premises that did not hold:**
1. ⛔ **Not every résumé passed the claim guard.** `/api/standalone/generate` assembled its own prompt
   and called the model directly, with no guard and no deterministic render. AG3's test "every path
   funnels through `coreGenerateResume`" counted that function's callers and could not see it. Now
   routed through the service; the test asserts the cause instead — no prompt assembly or generation
   call left in draft.
2. ⛔ **The brief's "four-column join" is the PERMISSIONS table, but the cross-service flow has no
   permission** — résumé data reaches the service server-side. So the fifth column went on the
   data-flow join, where the flow is, plus its own row; the third-party table gained the recipient.
3. ⛔ **`menuSurfaceStyle`'s "real bullet" test was guarding dead code** — it counted `content: "•"` in
   `server.js`'s unused stylesheet copy and the formatting prompt, never the renderer, which uses
   `list-style: disc`. Rewritten against the renderer.
4. **"One logged path" (modelCallGuard) could not survive two services** — the service's calls are
   made elsewhere. Restated as one path per CALLER; the client may record calls it did not make and
   is asserted to make none itself.

**Decided and stated:**
- **Degradation:** generation / A+ fail fast, retryable, not queued (the apply pipeline already holds
  a failed generation for review). **PDF reading degrades** to local `pdf-parse` and says so
  (`source`, `degraded`, `degradedReason`). Board, scoring, capture, autofill never touch the service.
- **Non-retryable says so:** the four routes answered `500 {error: e.message}` for everything; now a
  real status and `retryable`. ⛔ And `failureAttribution` honours an explicit `permanent` — the
  service reports an exhausted balance as 502 permanent:true, and 502 is in TRANSIENT_HTTP.
- **Usage:** records land in `usage_events` under the same purpose/event_type, so limits and the cost
  panel are unchanged; the standalone surface keeps its own attribution.
- **Brand (vendor rule):** only the client, its mapping, the vendored contract, the policy's
  Third-Party section and the reconciliation name the product. `server.js` says `toolsService`. ⛔ The
  client's first draft leaked "Resume Master" and the env-var names into USER-FACING errors — caught
  by a test. A new guard pins the policy's literal to its Third-Party section.
- **Privacy:** the policy names the recipient ("processes, does not retain"), effective 09-28 — the
  first bump that ADDS a recipient; advance notice would apply from the first user on. Resume Master
  has `docs/PRIVACY.md`. **Web Store declaration re-checked: unchanged** — the extension's own flows
  did not move.

**Deleted from draft:** `services/promptAssembler.js`, `prompts/`, `buildRuntimeInputs`, the dead
`RESUME_STYLE_BLOCK` copy, and four live-generation harnesses that would now measure a prompt
production no longer runs.

**Tests — every failure given a verdict, nothing lost.** Moved to resume-master: 9 prompt tests +
the only-carrier rule from `summaryOptIn`, 2 from `resumeArtifacts`, the claims wording, the 1h-TTL
guard (the risk now spans the boundary: draft prices the service's cache writes). Rewritten for the
new wiring: withheld-never-persisted, claims reach the request, the lift row id, A+ untokenized, the
classifier count. Removed: one test of a deleted script. draft 2696 → **2691** by moving, not dropping.

⚠ **Incident:** a stray `sed -i` converted `server.js` to LF mid-work. Caught by the line-ending count
immediately, restored to CRLF (10,288 lines, 0 bare LF, byte-identity tests green) before anything
else ran. Afterwards `server.js` was touched only by the Edit tool and a byte-checked splice.
⚠ Also: scripts piped to `node -` through this shell's heredoc **lose backslashes** — two generated
test rewrites lost their regex escapes (one silently loosened a match). Found, fixed with the Edit
tool; moved tests were diffed against `HEAD` to confirm they were copied as data, intact.

**Verified:** draft 2691/2691, resume-master 195/195. Eight injected violations each caught. **A real
cross-service run** — draft's client against resume-master's real server, no fakes: the draft-built
body passes the service's validation; wrong token, invalid body and a non-PDF are refused before any
spend; no model key answers 503 `retryable:false` through every layer; unreachable is the only
retryable case; the service log held neither the token nor the résumé.
⛔ **NOT A RUN:** no generation has been exercised end to end — that is Phase B step 3, and it is also
the first real check of the funded balance.

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
| 09-28 | **The résumé guards (G1) are deferred to post-migration** — "a work in progress". Resume Master's `docs/API.md` states what is enforced and what is not in the meantime |
| 09-28 | **Resume Master stays in draft's Railway project**, as its own service; its model key is a reference to draft's (`${{draft.ANTHROPIC_KEY}}`) |
| 09-28 | **`resumemaster.one` belongs to Resume Master** (B step 4). Its root answers a JSON 404 by design. **v1.0.0 of the extension is published UNLISTED** and posts there — accepted: its captures are no longer received |
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

**Design documents — ⛔ NOTHING IN THESE IS BUILT.** Do not write any of them into
`ARCHITECTURE.md`, which documents what exists.

| File | For | Gated on |
|---|---|---|
| `UI_REDESIGN.md` | ⭐ The deck model replacing listings-into-cards, the cream/orange/glass palette, the transition inventory. Keyboard is acceleration, never the only path — mobile has none, and the gestures must mean the same things | Phase B. ⛔ **Its one blocking decision: does position encode fit?** If yes, the board's ordering problem becomes a hard dependency, and the board still ranks by `discovered_at DESC` |
| `POST_MIGRATION_DESIGN.md` | ⭐ MCP connectors (the **deterministic** tools — scoring, parsing, formatting; generation is the weakest candidate) and remote browser profiles for the gated tier | MCP: Phase B. ⛔ Profiles: AF5, proven full-auto, **and a security design as the first task** |

⚠ Both are experimental and may be reverted or absorbed. They are kept because the reasoning is
expensive to rebuild, not because either is committed.

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

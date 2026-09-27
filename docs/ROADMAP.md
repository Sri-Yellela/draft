# Roadmap — two products, one platform

**Written 2026-09-26.** Supersedes the sequencing in `PRODUCT_MODEL.md`; that file still holds the
reasoning behind each decision.

**Current state:** migration complete, production is draft on `jobsviadraft.com`. Extension v1.1.0
submitted and under review. Suite ~2675. **No users.** Anthropic balance deliberately unfunded.
`job_applications` empty — nothing has ever validated the product against an employer.

---

## The shape

| | | Domain | State |
|---|---|---|---|
| **draft** | The job platform. Board → daily draft, curation, auto-apply, extension, mobile | `jobsviadraft.com` | live |
| **Resume Master** | Stateless tools. Generation, formatting, PDF, parsing, ATS scoring | `resumemaster.one` | to build |
| **`@draft/ats-scorer`** | The shared package both import | — | to build |
| **MCP connectors** | Resume Master's deterministic tools, as LLM tools | — | later |

⛔ **The products are not linked.** Separate user bases, separate databases, separate deployments.
draft is a third-party caller of Resume Master's API, which is what makes the API earn itself.

---

## AF5 runs LAST — it is the testing phase

**Owner decision 2026-09-26:** the split and both deployments complete by end of day 27th, so AF5
runs at the end, against the final path.

An earlier version of this file argued for running AF5 in parallel, on the grounds that employer
replies take two to six weeks and the daily draft needs that outcome data to tune. **That argument
does not survive a two-day build window** — and it had a real counter: generation moves behind an
API in Phase A, so running AF5 first validates a path that is about to change, and a break during
the split would be discovered after thirty real applications had gone out with it.

⛔ **One thing survives from it.** Before the batch, run ONE application and confirm
`job_applications` holds a row with `ats_score_at_apply` populated. `recordAtsOutcome` has never
been exercised — the only `resume_generate` events since it landed carried `job_id = null`. Four
cents against thirty applications' worth of data that is unrecoverable once they are sent.

---

## Phase A — Split the codebase

*No deploy risk. Nothing changes in production until Phase B.*

**A1 · Extract `@draft/ats-scorer` as an npm package.**
The smallest piece with the widest effect. Deterministic, no DB, no model call — pinned by a test
asserting the scrape block contains no `messages.create`.

⛔ Its dependencies come too: the term registry, `normaliseAtsTerm`, compound detection, the term
rejector, the ambiguity guard, the competency registry. Splitting the scorer from them is what made
AG1's and AH3's fixes unreachable from the bridge.

⛔ **What must NOT come: `ats_term_weights` loading.** That reads the database. The package takes
weights as an argument; each product loads its own. This is also where the envelope-vs-Map defect
lived — four harnesses passed `{ weights: Map, stale }` where a Map was expected, and `.size` on a
plain object is `undefined`, so every one silently scored unweighted while labelling itself
weighted. **An explicit package signature makes that a type error instead of a silent fallback.**

**A2 · Create the `resume-master` repo and move the tools.**
Generation, the formatting system, the PDF artifact and editor, résumé parsing. Both products import
the scorer package.

⛔ **The integrity rules move with the generation code and become contractual.** AF2's assertion
that output cannot claim more experience than the profile states, flag-don't-fabricate, and the §7
rules are currently internal protections. Sold as an API they are promises to third parties.

### ⭐ Fix prompt-cache breakpoint placement while the prompt is being rewritten

Generation's prompt structure moves in this phase anyway. **That is the moment to fix caching** —
not before, and not as a separate project.

⛔ **Caching is already wired, and the defect is the opposite of "not set up".** The prompt layers
and `RESUME_STYLE_BLOCK` already carry `cache_control`, and a test asserts every block does. The
measured problem is that **the 6,704-token prefix is written every time and read never** — a 25%
surcharge buying nothing. A real generation measured output 51% / **cache write 40%** / input 8.6%.

⛔ **But do NOT simply remove the breakpoints.** AK2 measured the net at **$0.3632 saved** — removing
them forfeits $0.39 to recover $0.02. A lever already exists, defaulted to the measured-best
setting, with a test that fails if the net ever flips. Leave it unless the measurement moves.

**The real constraint is arrival rate, not structure.** A cache hit needs a second request inside
five minutes, and `resume_generate` has run **once in 1,367 events**. Elsewhere the same mechanism
reaches 7.25× and 7.98× reads per write on clustered calls — evidence it works when requests
cluster.

**What to actually do here:**

1. ⛔ **Check breakpoint placement against the 20-block lookback rule.** Cache writes happen ONLY at
   the marked block, and the lookback finds prior *writes*, not stable content. A breakpoint sitting
   on a block that varies per request — a timestamp, the job description, the candidate's résumé —
   writes a fresh entry every time and never reads one. **That is precisely the
   written-every-time-read-never symptom.** Move it to the last block identical across requests:
   the end of the static prefix, not the varying payload.
2. **Consider pre-warming with `max_tokens: 0`.** Writes the cache and returns nothing. Warming the
   shared prefix before a batch of approvals turns a cold first call warm. Use an EXPLICIT
   breakpoint on the static prefix — automatic caching places it on the last block, which here is
   the placeholder. Same thinking config and effort as the real requests, or the warm entry is keyed
   differently and real traffic never hits it.
3. **The daily draft is the clustering opportunity.** Approving ten applications in one sitting is
   exactly the burst that turns one write into nine reads. Sequence the cache tuning to land with
   D1, not before it.
4. Keep `usage_events` reconciling. Every call site stays tracked, and `cacheCreationTokensOf` reads
   the API's own `cache_creation_input_tokens` — a field name that was once wrong and made every
   cache-write cost read as $0.

⛔ **ATS SCORING CANNOT BENEFIT FROM THIS.** `scoreAtsLocally` makes **zero model calls** —
deterministic and local, pinned by a test asserting the scrape block contains no `messages.create`.
There is no prompt to cache. Adding caching there would mean adding a model call in order to remove
one. **It is also why the daily draft works at all:** scoring thousands of rows costs nothing.

**A3 · Generate the API contract.**
⛔ **Generated, never hand-written.** The pattern exists: `contract/mobile-api.v1.json` is produced
by *executing* `mapJobRow.js`, with a checksum test and an envelope harness that caught eleven wrong
declarations in its own first draft. Reuse it.

**A4 · draft calls the API.**
Replace direct calls with the client. ⛔ **Personal data now crosses a service boundary** — a résumé
carries a home address, phone, employment history. Both privacy policies must describe it;
Resume Master's says *processes, does not retain*. `PRIVACY_RECONCILIATION.md`'s four-column join
gains a fifth for the cross-service flow. Logging must not retain payloads.

---

## Phase B — Stand up Resume Master

⛔ **In this order.** Moving a domain to a project with no code means `resumemaster.one` serves
nothing for days.

1. New Railway project. Deploy the tools service on its default `*.up.railway.app`.
2. **Verify there** — assert a JSON key, never a 200.
3. Point draft's API client at that URL. End-to-end test.
4. **Only then** remove `resumemaster.one` from the draft service and add it to the tools service.
5. Remove the stale OAuth redirect URI for the old domain.

⚠ Re-adding a custom domain means a new certificate. Usually minutes. Do it at a quiet hour.

**Stateless to start — no database.** Add one only when Resume Master has its own direct customers.

---

## Phase C — Make draft real

**C1 · Fund the Anthropic balance.** Unblocks enrichment, generation, capture's full path. The
enrichment backlog has grown every night since 09-17.

**C2 · AF5 — 30 supervised applications.** ⭐ Runs LAST — after Phase B, against the final path.
See *AF5 runs LAST* above.

⛔ Confirm the recording path fires before running thirty. The only `resume_generate` events since
AK1 landed carried `job_id = null`, so `recordAtsOutcome` has **never been exercised**. Run one
application, check `job_applications` has a row with `ats_score_at_apply` populated, then run the
rest. That data is unrecoverable once the applications are sent.

**C3 · Manual outcome capture.** One tap per application: replied / rejected / interview / none.
`shared/applicationResponse.js` already encodes the rules — a rejection counts as a response,
`MATURITY_DAYS = 30` means NULL is not yet "no response". A forwarding alias comes later; Gmail read
scope is a restricted scope with an annual third-party security assessment and is a separate
decision entirely.

---

## Phase D — The product model

**D1 · The daily draft.** Ten picks instead of a board. ρ ≈ 0.75 supports coarse ordering, not a
trustworthy ranking; a daily set only requires the top ten be good. ⛔ **Needs C2's outcome data to
tune.** Open questions in `PRODUCT_MODEL.md`: how many, what happens on a thin day, does an
undrafted job return.

**D2 · The UI.** Dark, high contrast, serif display, one thing per screen. Close to a client rewrite
— the current UI is a desktop-shaped tiled dock with 13 media queries total.

⛔ Decide first, still open: **the résumé gate hides a board the server has already filled.**
`/api/jobs` ranked 688 jobs without a résumé; only the ATS sort and search defaults need the
signals. Gating the sort rather than the board is a much better first impression.

**D3 · The free local workspace.** An ungated page in draft: captured jobs, autofill, history, ATS
score — all local and free. Generation behind the payment gate. ⭐ **The free tier is the funnel** —
value first, sign-up after. It also closes the anonymous-spend question by design: anonymous users
never trigger a model call.

**D4 · Payment gating.** `monetisationEnabled` is one flag. ⛔ **Flipping it makes the Chrome Web
Store trader declaration inaccurate and it must be updated in the same change.** "Coming soon" is a
statement of intent and needs neither.

---

## Phase E — Expansion

**E1 · MCP connectors.** ⛔ The candidates are the **deterministic** tools — ATS scoring, PDF
formatting, résumé parsing. Generation is an LLM calling an API to call an LLM. Anything that costs
money needs the same billing boundary as the API.

**E2 · Mobile 2c/2d.** ⛔ `ANDROID.md` and `IOS.md` specify a swipe feed and review queue against
the **board** model. Revise for the daily draft before building. iOS still has no build evidence at
all — 30 of 32 Swift files in the target, the two omitted being the entire network and auth surface.

**E3 · Remote browser profiles.** Not a VM per user — an encrypted browser profile per user, mounted
into an ephemeral container per run. The user signs into the portal themselves through a streamed
view; **you never see the password**, and a breach yields revocable session cookies rather than
reusable credentials.

⛔ **The security design is the first task, not a follow-up.** `/api/apply/session/*` returns 410,
retired for precisely this — reversing it must be a recorded deliberate reversal. Some ATS terms
prohibit automated submission regardless of authorisation: **per-platform fact, check which.** It is
also the only thing that makes mobile auto-apply possible, since there is no extension on a phone.

---

## What blocks what

```
A1 scorer package ──→ A2 tools repo ──→ A3 contract ──→ A4 draft calls API ──→ B  deploy + domain
                                                                                │
              ┌─────────────────────────────────────────────────────────────────┘
              ▼
C1 credit ──→ C2 AF5 ──→ C3 outcomes ─────────────────────────────→ D1 daily draft ──→ D2 UI
                                                                                │
                                                                    D3 free tier ──→ D4 payments
                                                                                │
                                                          B ──→ E1 MCP    D1 ──→ E2 mobile    E3 VM
```

⭐ **C2 waits for B.** AF5 is the testing phase and runs against the final path — see *AF5 runs
LAST* above. C1 (funding) has no code dependency and can happen any time before C2.

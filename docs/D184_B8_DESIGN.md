# D184 B-8 · the contextual tiebreaker on the board — design and measurement (46y)

**The ask (D192 (4d) + D184 B-8):** the contextual ATS score (`@draft/ats-scorer` `src/contextual.js` `scoreContextual`; draft's
inputs in `services/atsContextual.js`) orders cards **inside the same skill-match tier** on the board. Nothing else about the
ranking changes — the skill-match number, its band, the B-8 skill tier key, the tailoring trigger.

**Why it was not built in 46x:** the block needs a company stack per posting. Computed per request, or inside the board's
precompute one company per posting on the one thread, it is the class of whole-board pass that froze production
(A126 / A158 / A162 / A186: synchronous SQL on the one thread stalls every request).

## 1 · Where the order is computed today

| Piece | Where | What it does |
|---|---|---|
| The order | `services/jobs/jobCursor.js` `buildOrderKeys` | default order, fit on: `ineligible → ghost → known → rank keys → skill tier (B-8, skillTiers.js) → FIT_KEYS (band ordinal, aor.ats_score DESC) → NEWEST → company A–Z → job_id`. One declaration drives the ORDER BY **and** the keyset cursor. |
| The board | `server.js` `/api/jobs` (boardPageResponse) | builds the keys (`skillTier` from `tierSkills`, read on the workers) and runs the list in the read pool (A126). The fit keys read `aor` = the caller's `ats_only_reports` row. |
| Best bets | `/api/best-bets` → `bestBetsFor(fetchBoardPage)` | reads the **curated** board pages → inherits the tiebreaker. |
| The deck | `/api/today` → `todaysDeck(fetchBoardPage sort=atsScore)` → `shared/dealRanking.js` | an **explicit** sort (`atsScore`, whose tie-breaks are the sort panel's words, D24-pinned) then a continuous blended deal score — **not changed** (ties are rare in a blended number, and the atsScore sort's tie-break is a user-visible promise). |
| The scores | `services/jobs/boardFitPrecompute.js` | the per (user, profile) pass: plan in keyset pages through the read pool, score in the score worker (`scoreWorker.js`), write after scoring in commit chunks (DELETE + INSERT → a new row id → the cursor's fit epoch moves). |

## 2 · The design

**Stored, not computed per request.** Migration **278** adds `ats_only_reports.contextual_score INTEGER` and
`contextual_key TEXT` (ADD COLUMN, nullable, no default — a schema change only, no table rewrite of the ~491k-row table).

**Computed in the precompute, beside the skill match** (`services/jobs/boardContextual.js`):

1. **Once per pass** (`createPassContext`): the résumé side from the profile row's stored placement
   (`placement_category / subcategory / level / also`, no taxonomy re-read — A158) + the base résumé's text and its
   technologies (`shared/techVocabulary.js`), Admin → Ops' weights (`contextualWeights`), and the **key** = hash(version,
   placement, weights). The résumé text is not in the key: `basis_hash` already re-scores a row when it changes.
2. **Per batch of 50** (`itemsFor`): ONE read through the read pool for the batch's posting side
   (`job_taxonomy` + `job_company`), then `ensureStacks` for the companies **not yet in the pass's cache** — three bulk
   reads per 200 companies (`company_tech` rows, the `ofPostings` window count with stackFor's CROSS JOIN order, `company_facts`
   industry), all through the read pool. **Each company's stack is read once per pass, never once per posting, never on the
   one thread.** The shape is the ONE `techStackShape` that `companyStackOf` also uses (tested equal).
3. **The arithmetic in the score worker** (`scoreWorker.js`): the batch message carries `ctx = { shared, items }`; the worker
   scores the report and then `contextualScoreFor` (the same pure function the main-thread fallback calls) with the report's
   score. When the worker cannot answer, the existing time-sliced fallback computes both.
4. **Written with the score** (`storeAtsReportForProfile` + the same DELETE + INSERT): `{ score, key }`. The fit epoch
   (MAX(id)) already signs any order change. Every other writer (the panel, the slim expander) passes no `contextual` and
   **keeps** the row's number when the replaced row had the same basis + posting hash (then the skill match — and so the
   contextual number — is the same).
5. **Staleness:** the plan marks a row `ctx` when the switch is on and `contextual_key IS NOT` the pass's key (a new
   placement, new weights, or a row scored before the switch) → re-scored by the normal path. Company stacks are
   corpus-side (like term weights): not in the key; a row picks up a moved stack when next scored. A posting side that
   cannot be read is written with the score and **no key** → retried next pass; it never fails the pass.

**The order key** (`jobCursor.js` `CONTEXTUAL_KEYS` = `NULLS_LAST(aor.contextual_score)`, `aor.contextual_score DESC`):
directly **after** FIT_KEYS, before recency — default order with fit on only; never under a search or an explicit sort.
So it only reorders rows the board used to order by recency: same skill tier, same band, same score. A row without a number
sorts after the numbered rows of its own (band, score) group, never across groups. **The choice the owner may revisit:**
placing it after the band but *before* the score would let the contextual score beat a 1-point skill-match difference; that
changes "the existing skill-match number orders the board", so it is not what was built.

**Kill switch:** the flag `board_contextual_tiebreak` (`shared/flags.js`, env `BOARD_CONTEXTUAL_TIEBREAK`, Admin's switch —
no deploy needed). Default **on** (measured, §4). Off: no key on the board, the precompute computes nothing and marks nothing stale (the board's order and
cursors are byte-for-byte today's). **On is a one-time re-score of every active profile's scope** (their rows have no key),
through the same off-loop path a scorer-version change takes; the boot / crawl passes skip idle accounts (A139).

## 3 · Cost model

Per pass of N in-scope postings, C distinct companies:

| Work | Where | Count |
|---|---|---|
| posting side | read pool | N / 50 reads (one per batch) |
| company stacks | read pool | 3 × ⌈C / 200⌉ reads, once per pass |
| contextual arithmetic | score worker | N × (responsibility phrases + stack fit) — beside the ≈ 6.7 ms skill match |
| main thread | — | building the batch's `ctx` objects (maps, no SQL); two extra bound columns per INSERT |
| board read | read pool | two more ORDER BY terms on a column already in the `aor` row |

## 4 · Measured (`scripts/d184B8Measure.mjs`, the 100k scale fixture)

**Fixture:** `tmp/scale-100k` (100,000 active postings, 20 users, 491,117 stored reports), copied to `tmp/b8run`, migrated to
278, re-seen (`scraped_at` within 6 days), its company records rebuilt from the postings' own names (**3,000 companies,
39,047 stack rows** from `job_tech`, ≥ 2 postings — the fixture's example.com had merged everything into one record) and the
profile placed. One profile, its A112 scope (`computing`): **49,072 postings**, a FORCED pass (every row scored), through the
real score worker (1) and read pool (1, as `bgReadPool` in production). `monitorEventLoopDelay` at 5 ms resolution over the
pass (Windows' timer floor makes the mean ≈ 15 ms in both runs).

| | without (switch off) | with (switch on) |
|---|---|---|
| whole-board pass | **210.3 s** | **227.0 s** (+8 %) |
| longest event-loop block | **54 ms** | **34 ms** |
| event-loop p99 | 20 ms | 18 ms |
| longest commit chunk (400 rows) | 19 ms | 27 ms |
| read pool fallbacks to the main thread | 0 (247 served) | **0** (2,045 served) |
| scored off the loop | 49,072 / 49,072 | 49,072 / 49,072 |
| contextual numbers written | 0 | **49,072** (52 distinct values) |
| companies read | — | 3,000, each once (816 bulk reads: the first ~270 batches each brought ≤ 50 new companies) |
| process RSS | 427 MB | 451 MB |
| the board's first page (50, scope, fit keys) | 313 ms | 313 ms (302 / 339 before any number existed) |

**Verdict:** no new main-thread block (the longest block was the existing pass's own, and it was shorter with the tiebreaker
— run-to-run noise); every new read stayed in the read pool; the arithmetic stayed in the score worker; the board query
costs nothing measurable. **The switch defaults ON.** The cost to plan for is the one-time re-score when it first turns on (each
active profile's scope, ≈ 3.5 min per 49k postings on one worker — the same as a scorer-version change), off the loop.

⚠ What this does NOT show: 20 concurrent users during that re-score (the scale suite's load), nor production's real company
count (more than 3,000; the per-pass cache then holds more stacks — ~20 entries each — and the bulk reads scale with distinct
companies, not postings). The fixture's synthetic résumé ties almost every posting on one score (49,070 of 49,072 rows share a
score), so the measurement exercises the tiebreaker on nearly every row — the worst case for its effect, not for its cost.

## 5 · Tests

`test/d184B8Tiebreaker.test.js` (8): the pure key order; the tier order on SQLite incl. a keyset walk at page sizes 1–4;
`contextualScoreFor` = `scoreContextual`; the precompute (number + key on every row, one bulk stack read per pass, `ctx`
re-scores on a new placement / weights, off = nothing, a failed posting-side read retries); the stack cache = `companyStackOf`;
the wiring (migration 278 byte-identical, the flag, server / worker / store, no per-posting `stackFor`, no model).

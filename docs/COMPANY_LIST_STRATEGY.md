# Growing the Company List

**The single thing the product rests on.** Every job on the board comes from a configured company's
board on an ATS. No companies, no jobs, no product.

⛔ **Read the premise first, because it is counter-intuitive and it was misunderstood once already:**

**`ashby/linear` means Linear's jobs, hosted on Ashby.** There is no "all jobs from Ashby" endpoint.
Ashby is a *vendor*; each employer has its own board on it; **no ATS publishes a cross-customer
feed**, because the jobs belong to the employers, not the ATS.

⭐ **So the board grows by adding COMPANIES, not by adding SOURCES.** Enabling a seventh ATS adds
nothing on its own. Adding a hundred Greenhouse companies adds a hundred boards.

---

# ⛔ 1 · Two problems that look like one

The owner's symptom was *"I found Ashby jobs by hand that are not on our board."* That has **two
possible causes with completely different fixes**, and they must be measured apart.

### Coverage — the company is not in the list at all

Measured earlier: **~25 configured companies against ~2,200 that exist.** If someone searches a
company we have never heard of, nothing we do to the crawler helps.

### Freshness — the company IS in the list, and we are not seeing its new posts

The Pipeline Health panel shows ten companies with **no new row in 134 to 542 hours**, and
⭐ **three of them read exactly 542h** — `lever/openx`, `workable/persado`, `workable/skroutz`.
Independent companies do not go quiet in unison. **That is a set of slugs that died together**, and
it is the same failure as Lever's three slugs that all 404'd because those companies had moved off
Lever.

⛔ **MEASURE WHICH ONE YOU HAVE BEFORE BUILDING ANYTHING.** Take ten jobs found by hand that are
missing from the board and ask, per job: *was the company configured?* If yes, it is freshness. If
no, it is coverage. **A coverage project will not fix a freshness bug and vice versa.**

---

# ⚠ 2 · The uncomfortable question worth asking first

**A daily draft is ten jobs per user per day.** The board already carries ~2,460 active rows.

⛔ **For pure volume, 25 companies is already more than one user can consume.** So before launching a
large ingestion project, establish what is actually missing:

| If the gap is… | Then the fix is… |
|---|---|
| **Specific companies people care about** | Coverage — §3. Demand-driven, not bulk |
| **Nothing posted in the last few days** | Freshness — §5. Crawl cadence and dead slugs |
| **Nothing US-based and relevant** | ⛔ Neither. It is the non-US filter (queue 37) and curation |

⚠ **The board is already majority non-US.** Tripling a board that is mostly unusable triples the
unusable part. **Sequence the US filter first**, or the growth measurement is meaningless.

---

# 3 · Where company slugs actually come from — five channels

Every ATS exposes a per-company board at a predictable URL. Validation is cheap: request it, see
whether a non-empty job list comes back. ⚠ Verify the exact paths against the live code rather than
trusting this table.

```
greenhouse    boards-api.greenhouse.io/v1/boards/{slug}/jobs
lever         api.lever.co/v0/postings/{slug}?mode=json
ashby         api.ashbyhq.com/posting-api/job-board/{slug}
workable      apply.workable.com/api/v1/widget/accounts/{slug}
recruitee     {slug}.recruitee.com/api/offers/
```

### A · Public curated lists — the seed

Maintained lists of companies using each ATS exist publicly, and an earlier session already used
them to count **~2,200 companies**. ⭐ **This is the cheapest way from 25 to hundreds.**

⚠ They go stale, they skew toward well-known companies, and they will contain dead slugs. **Validate
every one before enabling it** — see §4.

### B · ⭐ The extension as a discovery channel — the elegant one

**When a user captures a job, the URL tells you the ATS and the company slug.**
`jobs.ashbyhq.com/openai/...` → source `ashby`, slug `openai`.

⭐ **If that company is not configured, that is a company a real person cares about, discovered at
zero cost and perfectly targeted.** No list, no guessing, no crawling — the demand finds you.

⛔ **Do not auto-enable from this.** Queue it for validation first; an extension capture proves a
page exists, not that the board is worth crawling.

### C · ⭐⭐ AGGREGATORS ARE THE DISCOVERY LAYER. ATS BOARDS ARE THE FRESHNESS LAYER.

**Owner, 2026-10-01 — this is the central idea of the whole document.**

`adzuna` and `serpapi` are configured and show **LIVE SEARCH ONLY, 0 active rows**. They contribute
nothing to the board today. But they have the one thing the ATS boards do not:

> **Aggregators see the WHOLE market.** Direct ATS boards see only the ~25 companies we happen to
> have configured. The aggregator's jobs are 2–3 days old — but they are *everything*.

⭐ **And the compounding part: an aggregator result's URL contains the ATS host and the company
slug.** So every aggregator search does not just find a job — **it finds a company, permanently.**

```
            aggregator search                 →  a job we were missing, 2–3 days old
            its URL → ashby/linear           →  a company we did not have
            configure that company            →  ⭐ EVERY future Linear posting, on day one,
                                                  direct from the board, for free, forever
```

⭐ **That is the engine.** The aggregator is slow and broad; the ATS board is fast and narrow.
Use the broad one to find companies and the narrow one to stay fresh. **Each search permanently
converts a slice of the market from "2–3 days late" to "same day", and it never has to be repeated
for that company.**

⚠ **It also explains why a one-person company list cannot win.** One person can name twenty
companies. The market has thousands, and the owner cannot enumerate them by hand — but a search for
the roles that matter will surface them, and each one surfaced is permanent coverage.

**What to build:**

1. Run aggregator searches for the role families the product serves.
2. Extract `(ats_host, slug)` from every result URL.
3. ⛔ **Validate before enabling** — does the board exist and return a non-empty list? §4.
4. Add the company. From then on it is crawled directly and its postings arrive same-day.
5. ⚠ **Track the conversion rate** — how many searched results yield a *new* company. When that
   number falls toward zero, the market is covered for that role family and the searches can stop.

⚠ **Both keys are already configured and already paid for.** This is not a new dependency; it is
using two things that currently return nothing.

### D · User request — the strongest demand signal

An "add a company" control. One person asking is worth more than a hundred names from a list,
because it is evidence rather than inventory. ⚠ Needs a validation step and a way to say no.

### E · Technographic lookup

Services that identify which ATS a company uses, by domain. Useful for a **targeted** list — "the
200 companies our users most want" — rather than bulk discovery. ⚠ Paid, and probably premature.

---

# ⛔ 4 · A company list is MAINTAINED, not imported

**This is the part that gets skipped, and it is why three slugs read 542h.**

Companies **move ATS**. They get acquired, they stop hiring, they rebrand their slug. A list
imported once decays silently, and the symptom is exactly what the panel shows: a configured company
producing nothing, indistinguishable from a company that simply is not hiring.

### What has to exist alongside discovery

| | |
|---|---|
| **Validation on add** | Does the board exist and return a non-empty list? ⛔ Never enable a slug that has never returned a row |
| **Decay detection** | A configured company producing nothing for N crawls is either dead or quiet. ⛔ **Distinguish a 404 from an empty-but-alive board** — they look identical downstream and have opposite fixes |
| **Description coverage** | ⛔ **Never enable a source or company at 0% descriptions.** Ubisoft, Bosch and Adobe were seeded inactive for exactly this: 648 rows that could never be enriched |
| **Auto-deactivate, visibly** | A dead slug should cost one crawl to learn, not one crawl per crawl forever. ⛔ Reversible and surfaced — a company silently dropped is a silent data loss |

⚠ **The Pipeline Health threshold needs checking before any of this.** Ten warnings all read "no row
in Nh, threshold 48h" — **most companies do not post a new job every two days.** A threshold that
flags healthy small boards trains everyone to ignore the panel, and this project has already shipped
a health check that called a working source critical because it counted the wrong column.

---

# 5 · Freshness — the other half

Coverage gets you companies. **Freshness gets you their new postings**, and that is what the owner
actually asked for.

1. **Crawl cadence.** How often is each company polled? A daily crawl means a job posted this
   morning appears tomorrow. ⚠ For a product whose promise is *today's draft*, that may not be
   enough.
2. **Completeness per crawl.** ⛔ `workday.js` caps at 300 and Workday needs whole-site paging. A
   cap that silently truncates looks exactly like a company that stopped posting.
3. **The 542h cluster.** ⭐ Three companies, identical to the hour. Start here — it is the highest
   signal-to-effort item on this page.
4. **`recruitee/hygraph`** — active, zero rows. The panel says "a dead slug, or its postings were
   dropped before they were written." **Find out which**, because one is a list problem and the
   other is a writer bug.

---

# ⛔ 6 · Growth is bounded by what you can enrich

**More companies means more rows, and rows are not free.**

- **Enrichment is manual.** There is a backlog and a daily cron that processes a limited batch.
- **The board is majority non-US** and the platform is US-only (queue 37).
- Every row costs storage, crawl time and a place in the curation measurements.

⛔ **Do not enable a thousand companies and then discover the enrichment queue is six weeks deep.**
Growth is paced by the slowest downstream step, and right now that is enrichment.

---

# ⭐ 7 · What I would do, in order

```
1  MEASURE WHICH PROBLEM YOU HAVE. Ten hand-found missing jobs; per job, was the company
   configured? ⛔ Do not start a coverage project to fix a freshness bug.

2  FIX THE 542h CLUSTER and recruitee/hygraph. Small, specific, and if slugs are dying silently
   then every number below is measured on a leaking board.

3  CHECK THE 48h THRESHOLD. If it flags healthy boards, the panel is training you to ignore it.

4  ⛔ LAND THE US-ONLY FILTER FIRST (queue 37). Growing a board that is mostly unusable grows the
   unusable part, and every growth measurement before it is meaningless.

5  ⭐ TURN THE EXTENSION INTO A DISCOVERY CHANNEL. Cheapest, best-targeted, zero marginal cost, and
   it gets better the more the product is used.

6  ⭐ MINE adzuna AND serpapi RESULTS FOR SLUGS. Two keys already configured and contributing
   nothing; this makes them the discovery engine, role-targeted rather than bulk.

7  SEED FROM CURATED LISTS, validated on add, paced against enrichment capacity. Hundreds, not
   thousands, and measure the board after each batch.

8  BUILD THE MAINTENANCE LOOP (§4) BEFORE the list is large enough that decay is invisible.
```

⭐ **Steps 5 and 6 are the ones that compound.** A curated list is a one-time import that starts
decaying immediately; discovery from real usage improves on its own and is targeted by actual
demand rather than by someone else's idea of which companies matter.

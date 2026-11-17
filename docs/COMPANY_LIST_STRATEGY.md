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

### C · ⭐ SERPAPI IS A DISCOVERY POOL. ATS BOARDS ARE THE FRESHNESS LAYER.

⛔ **REWRITTEN 2026-10-03 — a deliberate correction, not a drift.** The 10-01 version named BOTH
aggregators as slug sources and paired each harvested slug with the job it was found under. The D4
probe and the owner's own live call found three things wrong with that; `CORRECTIONS_REGISTER.md`
records each. Evidence: `docs/LIVE_SEARCH_FINDING.md` (D4) and `docs/SERPAPI_SLUG_YIELD.md` (the
20-search measurement).

**The idea that survives — the owner's, 10-01:** a direct ATS board sees only the companies we have
configured; an aggregator sees the whole market. An ATS URL found through an aggregator names a
company **permanently** — configure it once and every future posting arrives same-day, direct from
its board. Slow and broad finds companies; fast and narrow keeps them fresh.

**What changed:**

1. ⛔ **Adzuna is RETIRED as a slug source.** Its results — API `redirect_url` and browser links
   alike — are `adzuna.com/land/ad/…` click-tracking redirects (50 of 50 in D4); the employer URL
   exists only two hops later, outside the API. Descriptions are excerpts (≈500 chars), which
   collides with §4's "never enable a source at 0% description coverage". US coverage is its weak
   side (UK/EU-first). And some redirects land on other aggregators (aiapply.co and similar):
   part of its inventory is second-hand. ⚠ Adzuna's rows also left the board **deliberately** on
   2026-07-23 (`e3935b4`, the crawl restricted to direct ATS sources) — not by a defect.
2. ⭐ **SerpApi (`engine=google_jobs`) is the source.** `apply_options[].link` carries UNWRAPPED
   ATS URLs — `jobs.ashbyhq.com/coder/…`, `blueorigin.wd5.myworkdayjobs.com/blueorigin/…`. No
   redirect to follow: slug extraction is a string parse (`detectKnownAtsMatch`,
   `services/jobs/importJob.js`). ⛔ Every call carries `hl=en&gl=us` — without them the response
   is localised ("Estados Unidos", "hace 18 horas") and would silently defeat the US-only gate.
   Pinned by `test/serpapiLocale.test.js`.
3. ⛔ **A POOL, NOT A PAIRING.** Google clusters similar postings: the `apply_options` under one
   result are NOT routes to one job. Under "Staff Software Engineer (AI Agents)" at People In AI sat
   Coder's Ashby job, Western Alliance Bank's Workday "Staff Engineer I — GRC" and a Mural link;
   NVIDIA's result carried Rocket Software's Workday and a Toast careers link. ⛔ **Never attach a
   harvested slug to the job it was found under** — that corrupts company attribution (the
   "Localhost" and "Physical Superintelligence → Intel" class). Each search yields an **unordered
   pool of `(ats_host, slug)` pairs; the job association is discarded entirely.** This section's
   purpose was always to find COMPANIES, not to enrich jobs.

**Measured yield (20 searches, every role family, 2026-10-03 — `SERPAPI_SLUG_YIELD.md`):**

```
200 jobs · 1,031 apply_options links · 52 on an ATS host (5.0%) · 83.4% job-board-to-job-board
50 distinct (vendor, slug) pairs · 0 already configured · 50 NEW
  ashby 9 · lever 1 · smartrecruiters 3 · workable 1 · recruitee 1   → 15 crawlable today
  workday 25 (adapter exists; site needs a path parse; 300-posting cap)  → NOT harvest-ready
  icims 4 · jazzhr 2 · oracle 1 · eightfold 1 · gem 1 · pinpoint 1     → no adapter
  ⛔ greenhouse 0 · lever 1 — our two largest configured vendors barely appear
cost: free plan, 250 searches/month (NOT "already paid for"); 0.75 new crawlable non-Workday
slugs per search, 2.0 counting Workday — falling as the pool saturates
```

⚠ **So harvesting feeds mostly Workday and Ashby, not Greenhouse.** Ashby is ready today. Workday is
a separate project (site extraction, validation, and an adapter that caps at 300 postings with a
title filter — poor for Wells Fargo-, Boeing-, Comcast-sized boards) and must be decided as such.

**What to build — when the owner says so (nothing is built):**

1. A small batch of google_jobs searches (`hl=en&gl=us`, `location=United States`) across the role
   families; every `apply_options[].link` into one pool.
2. `detectKnownAtsMatch` on each link → `(ats_type, slug)`; drop the job association.
3. Write the pairs where the existing harvest already reads them — the `harvestedSuggestions` →
   `validateBoard` → admin add-company path (`services/companyList.js`, `routes/companies.js`),
   which is live and dry-by-default. ⛔ **Never auto-enable.**
4. ⛔ **Validate before enabling** (§4) — and add **description coverage** to `validateBoard` first:
   it checks dead / empty / live and US evidence today, not descriptions.
5. ⚠ **Track the conversion rate** — new pairs per search. When it falls toward zero for a family,
   that family is covered and its searches stop.
6. ⚠ A49's dedup gates any **job** ingestion from the aggregator itself; this section ingests
   companies only, which is why it does not need it.

⚠ **For the owner:** Jobright — a direct competitor — appears in Google's apply list (21 links in 12
of 20 queries).

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

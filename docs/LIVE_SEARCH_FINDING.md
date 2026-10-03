# "LIVE SEARCH ONLY" — what it means, and whether §3C's slug harvest works

**D4 · probed 2026-10-03 · nothing built.** Code at `131e721` (= production per `/api/version`).
Real searches spent: **Adzuna 1 · SerpApi 3** (account now reads 3 of 250 used this month — all three are these).

⛔ **Evidence limits, up front.** No Railway CLI here, and logging in to the production admin API with
the local `.env` admin credentials was **refused by this session's permission layer** — so **no
production row was read.** Every DB count below is from local copies (`data/resume_master.db`,
09-26; the 10-03 working copy at migration 124; four older snapshots 08-31…09-18). They hold crawl
output and almost no user activity (4–5 users, 0 captures). The owner queries that close each gap are
in § Owner actions.

---

## ⛔ ADDENDUM 2026-10-03 — the owner's live call and a 20-search measurement supersede parts of this

- **SerpApi DOES carry unwrapped ATS URLs** in `apply_options[].link` (the owner's call: Ashby, three Workday tenants, eightfold). This probe's "0 / 20, 0 new" read only `apply_options[0]` — the URL the plugin keeps — and two of three searches had no location. ⇒ **20 searches with `hl=en&gl=us`: 50 distinct pairs, 50 NEW** (`docs/SERPAPI_SLUG_YIELD.md`). The SerpApi half of the verdict below is **superseded**; the Adzuna half stands and is now the owner's decision: **Adzuna retired as a slug source.**
- ⛔ **Google clusters similar postings** — one result's `apply_options` belong to different companies. Harvest is a POOL; never pair a slug with its job.
- **§2 corrected: Adzuna's absence from the board is DELIBERATE**, not a defect — `4c4ce74` (2026-07-23) restricted `cacheJobs` to direct ATS sources, and `8b780e0` (same day) made every aggregator copy lose dedup to its ATS listing. Nothing recorded a reason; the excerpted descriptions would have been one. The defect is only the live-search route (§1).
- `hl=en&gl=us`: the plugin has sent both since `462618f`; the owner's Spanish response came from a call without them. Now pinned by `test/serpapiLocale.test.js`.
- §3C is rewritten (`COMPANY_LIST_STRATEGY.md`); the corrections are in `CORRECTIONS_REGISTER.md`.

---

## ⭐ Verdict on `COMPANY_LIST_STRATEGY.md` §3C

**§3C does not work as written, and it needs rewriting.**

- ⛔ **Adzuna: 50 of 50 result URLs are Adzuna's own wrapper** (`www.adzuna.com/details/…` or
  `/land/ad/…`). The API response contains **no ATS host anywhere**. The employer URL only appears two
  hops later, inside an HTML page with a 5-second meta-refresh, **outside the API**. Where you do get
  there, the URLs are good: **4 of 12 sampled were greenhouse/lever/ashby with an extractable slug**,
  and 3 more were Workday.
- ⛔ **SerpApi (Google Jobs): 1 of 20 jobs carried a supported-ATS link** (lever/spotify, which is
  already configured), and it was **7th of 8 apply options**. The URL the code actually keeps
  (`apply_options[0]`) pointed at a supported ATS **0 of 20** times. The rest go to LinkedIn, Indeed,
  ZipRecruiter, etc., or to employer careers pages.
- ⭐ **The receiving half already exists and works.** URL → (ats, slug) parsing, the `job_captures`
  record, "unconfigured slug" suggestions, a dead/empty/live board validator, and a dry-by-default admin
  "add company" route are all there and in production. **What is missing is the input:** nothing feeds
  aggregator URLs into it, and the aggregator URLs don't contain slugs anyway.
- ⚠ "Both keys are configured **and already paid for**" is **wrong for SerpApi**: it is the **Free Plan,
  250 searches/month**.

---

## 1 · What "LIVE SEARCH ONLY" means

**It is a static label. It means "keyed, but not one of the crawl's sources." It does not reflect any
activity at all.**

```
routes/adminDb.js:49    const CRAWL_SOURCES = new Set([...DIRECT_ATS_SOURCES, "jobo"]);
routes/adminDb.js:196   const inCrawl = CRAWL_SOURCES.has(name);
routes/adminDb.js:257   else if (!configured)  health = "not_configured";
routes/adminDb.js:258   else if (!inCrawl)     health = "live_search_only";   ← before ANY row/run check
client/src/pages/admin/DBInspector.jsx:290   live_search_only: { label: "LIVE SEARCH ONLY" }
DBInspector.jsx:365-370 / services/adminGlance.js:52   treated as benign, never alerted
```

`configured` = `ADZUNA_APP_ID && ADZUNA_APP_KEY` (`sources/adzuna.js:46`) / `SERPAPI_KEY`
(`sources/serpapi.js:38`). The branch comes **before** every row/run check, so **the panel would say
LIVE SEARCH ONLY whether live search ran 10,000 times today or never.** The "0 active rows" beside it
is the only real number.

**The "live search" it names: one route, and that route's only caller can't reach it.**

```
server.js:8079   app.post("/api/jobs/search", requireAuth, …)  → searchJobs() fans out to every
                 configured plugin incl. adzuna + serpapi (aggregator.js:681-705)
server.js:~8140  then WRITES results back: INSERT OR IGNORE INTO scraped_jobs (is_active defaults 1)
                 via reconcileFingerprint — so this is NOT "never persisted"; it persists when called
client/src/pages/LandingPage.jsx:119   the ONLY client caller (grep: client/, extension/)
client/src/App.jsx:803                 LandingPage is rendered ONLY for logged-out visitors
                                       (logged-in → redirect to /app or /admin)
```

Production probe, unauthenticated, the way the landing page calls it:

```
$ curl -X POST https://jobsviadraft.com/api/jobs/search -H 'Content-Type: application/json' -d '{"query":"x"}'
{"error":"Unauthorized."}   HTTP 401
```

⛔ **So it is a dead branch hiding behind a healthy-looking grey label.** The landing page's search
button (`UnifiedSearchBar` → `onSearch` → `handleSearch`) always gets a 401 from a route only a
logged-in user can call, and a logged-in user never sees that page. (The `requireAuth` on the route
dates from `2d93807`, 05-11.) The logged-in board's search is local (A72/A74: *"There is no live
scraping any more"*, `UnifiedSearchBar.jsx:56-60`). `server.js:7944` removed the other fall-through
to `searchJobs()`. ⚠ `jobQuery.js:560` says "searchJobs never writes": that's true of the function
itself, but not of its one route, which does write.

## 2 · Are we ingesting from them? — no; the crawl's exclusion is a decision (07-23), the live route's is a defect

| DB (local) | adzuna | serpapi |
|---|---|---|
| `data/resume_master.db` (09-26, 2,616 rows: gh 1681 · ashby 794 · lever 130 · workable 7 · recruitee 4) | **0** | **0** |
| 10-03 working copy (migration 124) | 0 | 0 |
| snapshots 08-31, 09-07, 09-08, 09-18 | 0 | 0 |

Every row, in every local snapshot, has `scraped_at` = one crawl instant: they are crawl output only.
⚠ **Not representative of production for these two sources.** A code comment (`jobQuery.js:557-561`)
says production carries **10 adzuna rows** with `discovered_at` NULL, "orphans from the pre-pivot
architecture". Not verified here.

**Why it's zero (traced):**
- **Crawl:** `cacheJobs` iterates `company_ats_list` by `ats_type` (`aggregator.js:786`, `:67`
  *"non-ATS sources (adzuna, serpapi) use live search only"*), and `cacheJoboFeed` reads only jobo. No
  cron, script or scheduler calls either plugin (grep across `server.js routes services scripts
  shared extension`).
- **Live search:** the only path is the dead route above.
- ⇒ **Zero by design for the crawl** (aggregators were deliberately kept out of the board).
  **Zero by defect for live search:** an auth-gated route whose only caller is unauthenticated.

## 3 · ⛔ Do their results carry ATS URLs?

Keys are in the local `.env` (masked: `ADZUNA_APP_ID=9a6…`, `SERPAPI_KEY=af2…`). The params match the
plugin code. Raw responses (keys stripped) are in `C:\Users\duggi\.claude\jobs\901b87b7\tmp\d4\`.

### Adzuna — 1 search: `what=software engineer`, `us`, `results_per_page=50`, `sort_by=date` (as `adzuna.js` + the route's `sort:'dateDesc'`)

`count: 177,241` · 50 returned, all created 10-03 04:25–04:43Z.

```
redirect_url host                          50 / 50   www.adzuna.com
   /details/{id}?utm_medium=api&utm_source=…   46
   /land/ad/{id}?se=…&v=…                       4
any ATS host anywhere in the JSON              0      (grep: greenhouse|lever|ashby|workable|…)
description                                    50/50 truncated to exactly 500 chars
company                                        Jobot 11 + Vaco 11 = 44% staffing agencies
```

⛔ **The API gives 0% ATS URLs: 100% are Adzuna's redirect wrapper.**

**Followed (GET, no JS, browser UA), 12 picked to cover different companies.** `/details/` returns 200 with an Adzuna job page (no
redirect). Its apply link is `/land/ad/{id}`, which returns 200 with
`<meta http-equiv="refresh" content="5; url=…">`. That meta-refresh target is the employer URL:

| company | final target | class |
|---|---|---|
| Anduril | `boards.greenhouse.io/andurilindustries/jobs/5254033007` | ⭐ ATS greenhouse · slug `andurilindustries` · **not configured** |
| Olsson | `boards.greenhouse.io/olsson/jobs/5440928008` | ⭐ ATS greenhouse · `olsson` · not configured |
| Lightship | `jobs.lever.co/lightship/67872353-…` | ⭐ ATS lever · `lightship` · not configured |
| Timely | `jobs.ashbyhq.com/timely/2f0d645d-…` | ⭐ ATS ashby · `timely` · not configured |
| Capital One | `capitalone.wd12.myworkdayjobs.com/capital_one/job/…` | ATS workday · tenant+site recoverable |
| Toyota | `toyota.wd503.myworkdayjobs.com/tmna/job/…` | ATS workday |
| Cisco | `cisco.wd5.myworkdayjobs.com/cisco_careers/job/…` | ATS workday |
| Visionist | `jobs.jobvite.com/visionist/job/omHeAfwB` | ATS jobvite: **no crawler** |
| Welldoc | `welldoc.bamboohr.com/careers/405` | ATS bamboohr: **no crawler** |
| Microsoft | `apply.careers.microsoft.com/careers/job/…` | employer careers page |
| Amazon | `amazon.jobs/jobs/10566720` | employer careers page |
| Jobot | `air-api.jobiqo.com/clicktracker?destination=…monster.com…` | job board (Monster) via click tracker |

**Of 12 followed, 4 (33%) reach a crawlable slug** (greenhouse/lever/ashby, all 4 new), 3/12 are
Workday, 2/12 are ATSes we have no crawler for, 2/12 are employer pages, and 1/12 is a job board. The
`detectKnownAtsMatch` parser already returns `greenhouse:andurilindustries`, `lever:lightship`,
`ashby:timely`, `greenhouse:olsson` and `workday:toyota` (tenant only) for these URLs (run here,
read-only).

⚠ **To get these you scrape adzuna.com HTML (details page → land page → meta-refresh). That isn't
the API.** It's 2 page loads per result, it registers as publisher click-throughs, and it probably
sits outside Adzuna's API terms. The owner needs to check the terms before anything is built on it.
**12 of 50 is a small sample.** Staffing agencies (44% here) will never yield a slug.

### SerpApi (google_jobs) — 3 searches

| # | params | result |
|---|---|---|
| 1 | **exactly as `serpapi.js`**: `q=software engineer, hl=en, gl=us, chips=date_posted:week, num=10, start=0`, no location | ⛔ `"jobs_results_state": "Fully empty"`, `error: "Google hasn't returned any results for this query."` `num`/`start` are absent from the echoed `search_parameters`. |
| 2 | same, without `chips/num/start` | 10 jobs, 57 apply options |
| 3 | `q=backend engineer, location=United States, chips=date_posted:week` | 10 jobs, 46 apply options |

```
                                   #2      #3      total
jobs                               10      10      20
apply_options[].link               57      46      103
  → supported ATS (gh/lever/ashby/…)  0     1       1   (jobs.lever.co/spotify — ALREADY configured; option 3 of 8)
  → other ATS (JazzHR applytojob)     0     1       1
  → job boards (LinkedIn, Indeed, ZipRecruiter, Monster, Dice, Glassdoor, bebee, jobright, …)
                                     46     29      75  (73%)
  → employer / other (careers.garmin.com, careers.netapp.com, careers.hrblock.com, apexsystems,
     fluidjobs, nextlegacy, …)       11     15      26
URL the CODE keeps = apply_options[0]
  → supported ATS                     0      0      0 / 20
  → job board                         4      7      11 / 20
share_link                         10/10 google.com/search wrapper (20/20)
related_links                       none present
detected_extensions                 absent in #2 (serpapi.js reads salary/posted_at from it)
```

⛔ **1 of 20 jobs (5%) carried a supported-ATS link at all, and that one is already configured.
New slugs found: 0.** ⚠ Search #1 shows the plugin's own params get **nothing** for a no-location
query. Three searches can't tell whether `start`/`num` or the missing location is the cause. Either
way, the live plugin returns empty for the landing page's most likely input.

### Fractions, combined

| | ATS URL in the API payload | crawlable new slug (sampled) |
|---|---|---|
| Adzuna | **0 / 50** (100% wrapper) | 4 / 12 followed, **only by scraping adzuna.com** |
| SerpApi | 2 / 103 links (1 supported) | **0 / 20** |

⛔ **Mostly wrapped or job-board links. The slug harvest does not work as written.**

## 4 · Is the harvest infrastructure there? — the receiving half is

| piece | exists? | where |
|---|---|---|
| URL → (ats, slug) | ✅ | `services/jobs/importJob.js:82-165` `detectKnownAtsMatch`: greenhouse, lever, ashby, smartrecruiters, workable (`apply.` form only), recruitee; workday gives the **tenant only** (the `site` is "never guessed"). `jobGateway.js:23` `atsSlugOf` |
| record of seen slugs | ✅ | `job_captures` (migration 122) `url, ats_type, ats_slug, origin`, written by `ingestJob` (`jobGateway.js`) for every capture/import |
| "unconfigured slug" list | ✅ | `services/companyList.js:38` `harvestedSuggestions` (job_captures minus company_ats_list, ranked by distinct people); shown in admin Company list (`client/src/panels/adminOps.jsx:568`) |
| validator before enabling | ✅ partly | `companyList.js:60` `validateBoard` → `dead` (404/410) / `empty` / `live` + US-eligible count. ⛔ **No description-coverage check**, so it would pass a Ubisoft/Bosch/Adobe-shaped board. ⚠ A workday suggestion (tenant only) **can't be validated as-is**: the crawler needs `wd#\|tenant\|site` (`workday.js:10`). |
| company list | ✅ **table** | `company_ats_list` (29 rows, 22 active locally: gh 10/9, lever 7/5, ashby 4/4, workable 3/2, recruitee 2/2, smartrecruiters 2/0, workday 1/0). Also seeded by migrations |
| "URL seen" → "company added" | ✅ human-in-loop | `routes/companies.js` at `/api/admin/companies` (`server.js:7068`): POST probes (dry by default), and a second POST with `confirm:true` + matching `expectState` adds it; a 404 board is refused; audited (`admin_audit_log`). Built by A50 step 4 (`a21cd42`, 10-02, in production) |
| aggregator result → any of the above | ⛔ **none** | `searchJobs` results never touch `job_captures`/`atsSlugOf`. No batch "run role-family searches and extract" job exists |
| auto-enable | ⛔ none, correctly | always admin-confirmed |

So "none of it" is wrong. A62/A50 built everything **downstream** of the URL. Only the aggregator
input is missing, and Q3 shows that input mostly doesn't carry slugs.

## 5 · Cost and limits

| | plan / quota | per search | spent today for 0 rows? |
|---|---|---|---|
| SerpApi | **Free Plan, 250 searches/month**, 250/hour, renews 10-12 (from `serpapi.com/account.json`, which costs nothing) | 1 credit, empty results included (#1 was counted) | **No.** `this_month_usage: 3` = this probe's three. Nothing else used this key since ~09-12. ⚠ That holds only if production uses the same key as local `.env` (not verifiable here) |
| Adzuna | no account endpoint. Adzuna's published developer limits are ~25 calls/min, 250/day, 1,000/week, 2,500/month (**not verified for this account**) | 1 call per 50 results; the plugin pages up to 200 → up to 4 calls/search (300 ms apart) | **No caller can reach it** (route 401s, nothing scheduled) |

No caching in either plugin. Nothing calls them on a schedule. Startup only calls `isConfigured()`
(no network). **Spend today ≈ 0, because the only path is dead, not because something was designed
to limit it.** ⚠ If the route were ever fixed as it stands, each landing-page search would cost 1
SerpApi + up to 4 Adzuna calls. 250/month = **~8 searches a day** before the free plan runs out.

## 6 · The other three free slug sources (A45 b–d)

| source | wired into harvest? | where the URL lives | local count |
|---|---|---|---|
| (b) extension captures + imported URLs | ✅ **yes** | `job_captures.url / ats_type / ats_slug` (origins `capture`, `import_url`, `paste`, `admin_import`) | 0 rows |
| (c) jobs opened from our board | ⛔ no | `application_records (user_id, job_id, origin='opened_posting')`: **job_id only**, URL via `scraped_jobs.url/apply_url`. `user_job_views` has no writer left | 0 |
| (d) apply / handoff targets | ⛔ no | `apply_gate_packets.apply_url, expected_origin` (`routes/apply.js:977, 3498`); `application_records.origin` | 0 |

⚠ **(c) and (d) are close to worthless as slug sources, by construction.** They point at board rows,
and board rows come from companies already in `company_ats_list`, or from captures (already in
`job_captures`), or from jobo/legacy aggregator rows. Measured locally: **2,616 rows → 1,738 URLs
parsed → 14 distinct (ats, slug) pairs, 0 not configured.** The only exceptions would be **jobo rows**
(a cross-company feed, paused with a 402 since ~08-13) and any legacy aggregator rows, which exist
only in production.

## ⛔ Constraints on whatever comes next

- ⛔ **Never enable a company at 0% description coverage.** Ubisoft/Bosch/Adobe were seeded inactive
  for this: 648 rows that could never be enriched. **`validateBoard` doesn't check it today.** Any
  harvest that enables boards needs that check added first.
- ⛔ **Validate every harvested slug before enabling it** (the route already forces this: dry → confirm
  + `expectState`). Workday suggestions need a resolved `site` before they can be validated at all.
- ⛔ **Don't ingest aggregator rows to get volume.** Adzuna descriptions are 500-char snippets behind
  wrapper URLs, and 44% of this sample were staffing agencies. That's the 0%-description problem again.
- ⚠ **A49's dedup gates this.** An aggregator result and the ATS board return the same posting
  (Anduril's greenhouse job above is both). The live-search write-back already goes through
  `reconcileFingerprint`, so any new path must too.
- ⚠ Don't "fix" the dead `/api/jobs/search` just to make the label true. That would turn on per-visitor
  spend against a 250/month free plan.

## ⭐ Recommended next step (not built)

1. **Rewrite §3C.** Say aggregator APIs **do not expose ATS URLs** (Adzuna 0/50, SerpApi 1/20).
   Discovery through them means either scraping Adzuna's landing pages (terms question for the owner;
   ~33% hit rate on a 12-sample) or not using them.
2. **Cheapest real discovery:** feed the existing `harvestedSuggestions` + `validateBoard` + admin
   add-company path from **(A) the public curated lists** and **(b) captures**, which are already
   wired. Add a **description-coverage line to `validateBoard`** first.
3. **Relabel or drop `live_search_only`.** It reports a capability that no reachable code uses. Pick
   one: remove the landing page's live-search call, or mark the sources "not used". Owner's call.
4. If the owner still wants aggregator discovery, run a **20-result bounded measurement** (Adzuna only,
   following `/land/ad` by hand) for one role family. Measure the new-slug rate before any build.

## Owner actions — what I could not verify

1. **Production aggregator rows (Q2).** Admin → DB Inspector raw query, or Railway:
   ```sql
   SELECT source, COUNT(*) n, SUM(is_active) active,
          datetime(MAX(scraped_at),'unixepoch') last, SUM(scraped_at > strftime('%s','now','-30 days')) last30d
   FROM scraped_jobs WHERE source IN ('adzuna','serpapi','jobo') GROUP BY source;
   ```
2. **Slugs already held in production (Q6).** The admin **Company list** "suggestions" table answers
   (b) directly. For the rest:
   ```sql
   SELECT origin, ats_type, COUNT(DISTINCT lower(ats_slug)) slugs, COUNT(*) captures FROM job_captures
   WHERE ats_slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_ats_list c
     WHERE c.ats_type = job_captures.ats_type AND lower(c.ats_slug) = lower(job_captures.ats_slug))
   GROUP BY origin, ats_type;
   SELECT expected_origin, COUNT(*) FROM apply_gate_packets GROUP BY 1 ORDER BY 2 DESC LIMIT 50;
   SELECT url FROM scraped_jobs WHERE source IN ('jobo','adzuna','serpapi');  -- parse with detectKnownAtsMatch offline
   ```
3. **Whether production's `SERPAPI_KEY` is the local one.** If it isn't, look at that account's
   `this_month_usage` (Q5):
   `curl "https://serpapi.com/account.json?api_key=KEY"` (free, doesn't count as a search).
4. **Reproduce Q3** (each costs one search):
   ```
   curl "https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=APP_ID&app_key=KEY&results_per_page=50&what=software%20engineer&sort_by=date&sort_direction=down"
   curl "https://serpapi.com/search?engine=google_jobs&q=software%20engineer&hl=en&gl=us&chips=date_posted:week&num=10&start=0&api_key=KEY"
   ```
5. **Adzuna terms:** does following `/land/ad` pages to read the employer URL comply with the API
   agreement? Do this before anything in §3C option 1 is built.

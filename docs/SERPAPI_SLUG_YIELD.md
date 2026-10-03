# SerpApi google_jobs — ATS slug yield from 20 searches (D4 addendum, 2026-10-03)

This was measurement only. No repo file was modified, nothing was committed, and no server was started. The API key is masked everywhere, and a check confirmed that none of the saved files contain it.
Raw responses, account snapshots, the full pool and the scripts were kept OUTSIDE the repository (the session scratchpad) — measurement inputs, not product code.

## Method
- Exactly **20** calls: `engine=google_jobs`, `location=United States`, **`hl=en`, `gl=us`**, one page each (no `chips`, `num` or `start`). Each echoed `search_parameters` shows `hl:en, gl:us, location_used:"United States"`.
- The queries cover the families in `services/jobs/jobTaxonomy.js` ROLE_FAMILIES: 13 engineering/data/pm queries, plus embedded, design, marketing, sales, finance and hr.
- **Pool semantics.** Every `apply_options[].link` goes into one unordered pool, and the job it came from is ignored. I also checked `source_link`: it was always one of the apply options (200/200), so it added nothing. `share_link` is a google.com wrapper and `thumbnail` is an image, so neither has slugs.
- **Slug parse.** `detectKnownAtsMatch` was imported read-only from `services/jobs/importJob.js` and run on every link. I also used a scratch pure-string parser covering more vendors, and it recovers the Workday `site`.
- **"Configured" set.** It has 34 keys: `company_ats_list` in `data/resume_master.db` (29 rows, opened read-only) plus the seed tuples in `scripts/migrations.js` and `server.js`. That includes legacy pairs like greenhouse:notionhq and lever:ramp. Workday also matches at tenant level.

## Headline numbers
| | |
|---|---|
| jobs | **200** (10 per query, 20/20 queries non-empty) |
| apply_options links | **1,031** (avg 5.2 per job) |
| links on any ATS host | **52 (5.0%)** |
| distinct (vendor, slug) pairs | **50** (only 2 seen twice: blueorigin, rocket) |
| …already configured | **0** |
| …NEW | **50** |
| …NEW on a vendor we crawl today, excluding Workday (ashby, lever, smartrecruiters, workable, recruitee) | **15** |
| …NEW on Workday (adapter exists) | **25** |
| …NEW on a vendor with no adapter | **10** (icims 4, jazzhr 2, oracle 1, eightfold 1, gem 1, pinpoint 1) |
| **greenhouse links** | **0 of 1,031**, even though greenhouse is our largest vendor |

## By vendor (distinct pairs: new / configured)
| vendor | new / configured | slugs | `detectKnownAtsMatch` |
|---|---|---|---|
| workday (myworkdayjobs) | 25 / 0 | westernalliancebank·wab, blueorigin·blueorigin, scanhealthplan·scancareers, rocket·rocket_careers, boeing·external_careers, wk·external, genmills·gmi_external_careers, jll·jllcareers, ms·external, ryder·rydercareers, centene·centene_external, hntb·hntb_careers, tiaa·search, wf·wellsfargojobs, legalshieldcorp·lsc, oclc·oclc_careers, roguefitness·…_external_careers, massgeneralbrigham·mgbexternal, medable·explore-career-opportunities, inspirebrands·inspirecareers, veralto·x-ritejobs, umb·umbexternal, purple·purplecareers, mckesson·external_careers, comcast·comcast_careers | 27/27 links, but **tenant only** (by design it never guesses the site). The scratch parser got the site from path segment 1 (or 2 after an `en-US` locale) on all 25. ⚠ I lowercased the site; the original case is in `analysis.json` examples, and the site still needs live validation. |
| ashby | 9 / 0 | coder, bjakcareer, marianaminerals, twenty, odyssey, quora, ironcladhq, socure, doppel | 9/9 ✅ |
| smartrecruiters | 3 / 0 | PhillyTechCo, Mirantis, SonomaConsultingInc (2 of the 3 look like staffing or small agencies) | 3/3 ✅ |
| lever | 1 / 0 | palantir | ✅ |
| workable | 1 / 0 | rockstar-3 (`apply.workable.com` form) | ✅ |
| recruitee | 1 / 0 | curotec | ✅ |
| greenhouse | 0 / 0 | none appeared | (the parser handles `/{slug}/jobs/{id}`; the `embed/job_app?for=` form is **not** parsed) |
| icims | 4 / 0 | lmi, resume-chesterton, ermcoeci, brightspring | ⛔ not parsed, no adapter |
| jazzhr (applytojob) | 2 / 0 | brightvisiontechnologies, marketbridge | ⛔ not parsed, no adapter |
| oracle (oraclecloud) | 1 / 0 | eeho / site CX_45001 | ⛔ not parsed, no adapter |
| eightfold | 1 / 0 | fortive | ⛔ not parsed, no adapter |
| gem | 1 / 0 | quo | ⛔ not parsed, no adapter |
| pinpoint | 1 / 0 | marchex | ⛔ not parsed, no adapter |
| jobvite, bamboohr, taleo, successfactors, adp, ukg, … | 0 | none appeared | (jobvite and bamboohr showed up in the earlier Adzuna follow sample, not here) |

**Workday adapter limits** (`services/jobs/sources/workday.js`):
- The slug must be `wd#|tenant|site`.
- The list call pulls 20 per page for at most 15 pages, so **300 postings per board at most**. It then filters by title words and keeps **`PER_COMPANY_MAX = pageSize*3`** (150 at the default 50).
- There is no incremental mode and no detail fetch in the list step.
- The one configured Workday row (adobe) is inactive.
- Several harvested tenants are huge boards: Wells Fargo, Boeing, Comcast, McKesson, Centene, Morgan Stanley (`ms`), JLL. The 300 cap would truncate these, and a title filter on page 1–15 order is not a family filter.

## Link mix (1,031 links)
| class | links | share | as apply_options[0] (200 jobs) |
|---|---|---|---|
| aggregator → aggregator (job boards) | 860 | **83.4%** | 141 |
| ATS hosts | 52 | **5.0%** | 11 |
| employer careers pages (stripe.com, careers.toasttab.com, jobs.nvidia.com, capitalonecareers.com, metacareers.com, …) | 57 | 5.5% | 39 |
| spam-like / scraper mirrors (*.liveblog365.com, *.social-networking.me, *.mysmartpros.com, vacario.ru, …) | 39 | 3.8% | 0 |
| university career-center boards (.edu) | 13 | 1.3% | 5 |
| staffing agencies (apexsystems, randstadusa, …) | 6 | 0.6% | 3 |
| VC portfolio boards (getro, insightpartners, indexventures, cantos) | 4 | 0.4% | 1 |

- Top aggregator hosts: bebee 92, linkedin 90, indeed 63, ziprecruiter 58, jobleads 50, monster 45, talents.vaia 44, tealhq 34, builtin.com 22 (plus builtin{boston,chicago,colorado,nyc,sf} 14 more), **jobright.ai 21**, trabajo.org 19, jobrapido 19, simplyhired 17, theladders 16, jobgether 16, startup.jobs 15, glassdoor 13, careerbuilder 10, dice 8, adzuna 7, welcometothejungle 6, wellfound 3.
- ⭐ **Jobright (competitor): 21 links (2.0%), in 12 of 20 queries.** It was apply_options[0] on 4 jobs (source_link = jobright).
- Only 41/200 jobs carried any ATS link. Per the pool rule, that link usually belongs to a different job anyway.

## Per query
| # | query | family | jobs | links | ATS links | new pairs (first seen) | jobright |
|---|---|---|---|---|---|---|---|
| 1 | software engineer | engineering | 10 | 73 | 7 | 7 | 2 |
| 2 | backend engineer | engineering | 10 | 47 | 2 | 2 | 0 |
| 3 | frontend engineer | engineering | 10 | 43 | 0 | 0 | 1 |
| 4 | full stack engineer | engineering | 10 | 56 | 3 | 3 | 4 |
| 5 | machine learning engineer | eng/data | 10 | 59 | 1 | 1 | 0 |
| 6 | data scientist | data | 10 | 41 | 1 | 1 | 0 |
| 7 | data analyst | data | 10 | 55 | 4 | 4 | 0 |
| 8 | data engineer | data | 10 | 44 | 2 | 2 | 0 |
| 9 | product manager | pm | 10 | 59 | 10 | 9 | 1 |
| 10 | technical program manager | pm | 10 | 44 | 0 | 0 | 1 |
| 11 | site reliability engineer devops | engineering | 10 | 46 | 2 | 2 | 0 |
| 12 | security engineer | engineering | 10 | 68 | 5 | 5 | 2 |
| 13 | mobile engineer ios android | engineering | 10 | 31 | 0 | 0 | 0 |
| 14 | new grad software engineer | engineering | 10 | 58 | 2 | 2 | 3 |
| 15 | embedded firmware engineer | embedded_firmware | 10 | 52 | 0 | 0 | 1 |
| 16 | product designer | design | 10 | 39 | 2 | 2 | 1 |
| 17 | marketing manager | marketing | 10 | 57 | 4 | 4 | 2 |
| 18 | account executive | sales | 10 | 58 | 4 | 4 | 1 |
| 19 | financial analyst | finance | 10 | 46 | 1 | 1 | 0 |
| 20 | technical recruiter | hr | 10 | 55 | 2 | 1 | 2 |
| | **total** | | **200** | **1,031** | **52** | **50** | **21** |

## Cost and quota
- **Account:** Free Plan, 250/month, renews 2026-10-12. Before: **4 used / 246 left**, which is the 3 earlier probe searches plus the owner's 1. After: **24 used / 226 left**. All 20 counted. `account_rate_limit_per_hour` = 250, while the pricing page lists 50/hour for free.
- **Effective cost per search:** $0 on the free plan, capped at 250 a month. Paid tiers (serpapi.com/pricing, fetched today):
  - Starter $25 for 1k/mo ($0.025 per search)
  - Developer $75 for 5k ($0.015)
  - Production $150 for 15k ($0.010)
  - Big Data $275 for 30k ($0.0092)
  - "Only successful searches are counted"; empty result sets count.
- **Per new slug in this run:** 2.5 new pairs per search, all vendors. The crawlable-today set without Workday gives **0.75 per search (~1.3 searches per slug)**; adding Workday gives 2.0 per search.
- The free plan's ~226 remaining searches could yield roughly **~170 non-Workday crawlable slugs and ~280 Workday boards** this month, *if* the rate held. It won't hold, because repeats will rise once the 34 configured and early finds saturate (only 2 of 52 ATS links repeated so far).

## Language check (hl=en, gl=us)
- All 200 jobs came back in English: "18 hours ago", "Full-time", "Work from home", "Health insurance". Across 200 jobs: 0 Spanish tokens ("hace", "Tiempo completo", "Estados Unidos") and 454 English extension tokens. `search_parameters` echoes `hl:en, gl:us`.
- ⚠ I did **not** run a control call without hl/gl, since that would have been a 21st search. The "Spanish without them" side rests on the owner's call. What this run shows is that **with** them, output is English.

## Verdict
- **The new-company rate is high, and every single pair was new.** 50/50 distinct pairs were unconfigured, and the pool barely repeated. This reverses the D4 "0 new" result. That result came from reading only `apply_options[0]` over 20 jobs, without `location`.
- **Ashby is the clear win.** It yields 9 new from 20 searches, `detectKnownAtsMatch` parses it 9/9, and the adapter exists. Lever, smartrecruiters, workable and recruitee add a trickle (6 total). Some smartrecruiters hits are staffing shops, so they need `validateBoard` plus a description-coverage check.
- **Workday is the volume (25 new, mostly large US employers), but it is not harvest-ready.** `detectKnownAtsMatch` returns the tenant only. The site would need the path parse used here, then validation. The adapter's 300-posting cap and title filter are poor fits for giant boards like Wells Fargo, Boeing and Comcast.
- **Greenhouse never appeared** in 1,031 links, so this source will not grow our main vendor.
- 10 of 50 pairs are on vendors with no adapter (icims, jazzhr, oracle, eightfold, gem, pinpoint). They are worthless today.
- **Recommendation: a harvester is justified for Ashby (plus lever, smartrecruiters, workable, recruitee as by-catch), and conditionally for Workday.** It would be a small batch job that feeds the existing `harvestedSuggestions` → `validateBoard` → admin add-company path, never auto-enabling. The free plan's 226 remaining searches are enough to run it this month. Expect the yield per search to fall as the pool saturates. Only 5% of links are ATS URLs, and those are the only part that's useful; the other 95% is aggregator noise, including 21 Jobright links.

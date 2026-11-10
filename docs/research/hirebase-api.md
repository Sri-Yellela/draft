# Hirebase API — the facts draft's client is built on

Read 2026-11-10 (46d) from Hirebase's public docs: `https://www.hirebase.org/docs/llms.txt` → `authentication.md`,
`api-reference/jobs/search-post.md`, `jobs/estimate.md`, `jobs/expired-jobs.md`, `billing/usage-headers.md`,
`errors.md`, `data/get-categories.md`. Re-read before changing `services/hirebase/`. No live call was made to write this.

## Auth and base
- Base `https://api.hirebase.org`, paths under `/v2/`. Header **`x-api-key: <key>`** (no Bearer) on every metered call.
- draft reads the key from `HIREBASE_KEY` (Railway), falling back to `HIREBASE_API_KEY`.

## Search — `POST /v2/jobs/search` (JSON body; unknown params → 422)
- `job_category` string[] (singular in the request; e.g. `"Software Engineer Jobs"`; invalid → 422)
- `geo_locations` `[{ city, region, country }]` — country `"United States"`; `geofilter_params { mode, radius, unit }`
- `days_ago` int · `date_posted` `YYYY-MM-DD` (on or after) · `ingested_after` / `ingested_before` ISO-8601 (on `first_ingested`)
- `job_board` string[] = INCLUDE list · **`exclude_job_board` string[] = EXCLUSION list** (not on Export)
- `hide_recruiting_agencies`, `filter_incomplete_jobs`, `return_raw_description`, `visa`, `include_no_salary`: `"true"` / `"false"`
- `sort_by`: `relevance` | `date_posted` | `first_ingested` | `salary` | `yoe`; `sort_order`: `desc` (default) | `asc`
- `page` (default 1) + `limit` (default 10, **max 100**). No cursor.
- **Cost: 1 unit (`m_jobs_api_calls`) per job RETURNED.**
- Polling advice (theirs): `ingested_after` = last run − 2 h, `sort_by: first_ingested`, `sort_order: asc`, upsert by `_id`.
- Response: `{ jobs[], total_count, company_count, page, limit, total_pages }`.
- Per job: `_id`, `job_title`, `job_title_raw`, `description` (summary HTML), `description_raw` (full HTML, only when asked),
  `application_link`, `locations[] {city, region, country, coordinates, bbox, address}` (match may be on ANY), `location_raw`,
  `location_type`, `job_type` (`Full Time` · `Part Time` · `Contract / Temporary` · `Internship`), `salary_range {min, max,
  currency, period}` (`yearly`|`year`, `hourly`|`hour`, `monthly`, `daily`), `yoe_range {min, max}`, `experience_level`,
  `education_level`, `job_categories[]`, `visa_sponsored`, `skills[]`, `technologies[]`, `benefits[]`, `team`,
  `requirements_summary`, `job_board`, `job_board_link`, `platform_job_id`, `company_name`, `company_slug`, `company_link`,
  `company_logo`, `company_data {description_summary, linkedin_link, services, size_range, industries, subindustries, type,
  is_recruiting_agency, is_3rd_party_agency}`, `date_posted`, `first_ingested`, `md5_hash`, `signals[]`, `recruiter_agency`,
  `offers_equity`, `meta_completeness`, seven `*_score` fields (0–10, opaque — never stored), `contact_email` /
  `contact_phone` (paid plans — Contact Data, **never stored**).

## Estimate — `POST /v2/jobs/estimate` (free, works at the cap)
- Same body as search. `limit: 0` → the total match count. Response `{ "cost": N }`, N = min(limit, matches).

## Expired feed — `GET /v2/jobs/expired-jobs?since=&page=&limit=` (free)
- `since` REQUIRED, within the last 14 days. `limit` ≤ 1000. Response `{ jobs[] {_id, company_slug, job_slug, date_expired}, total_count, page, limit, total_pages }`; walk pages in order within 15 min.

## Usage headers (on successful and quota-429 responses of metered endpoints)
`Hirebase-Usage-Feature`, `-Meter`, `-Unit`, `-Included-Limit`, `-Included-Used`, `-Included-Remaining`, `-Overage-Used`,
`-Overage-Mode` (`block` | `meter`), `-Total-Used`, `-Period-Start`, `-Period-End`. Rate headers on every response:
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## 429 — two different things
- **Rate limit:** 100 requests / 60 s per key (all endpoints). Has `Retry-After` (seconds). Wait and retry.
- **Quota:** `X-Billing-Code: limit_exceeded`. **Never retry.** A pre-check may refuse a request whose `limit` exceeds the
  remaining allowance — lower `limit`.
- Others: 400, 401, 402, 403 (`X-Billing-Code: feature_missing`), 404, 422 (`detail[]`), 500.

## Plans (jobs / month)
Free 500 (block) · Starter $99 25,000 (block) · Growth $249 250,000 then $1.50 / 1k · Scale $999 2,000,000 then $1.00 / 1k ·
Pro (web) $50 10,000 then $5.00 / 1k.

## Categories (`GET /v2/jobs/data/categories`, no key)
Includes `Software Engineer Jobs`, `Engineering Jobs`, `Data Analyst Jobs`, `Product Jobs`, `Project & Program Management Jobs`,
`Security Engineer Jobs`, `Support Engineer Jobs`, `Information Technology Jobs`, … (39 in all on 11-10). `job_board` has no
documented value list (examples: greenhouse, lever, workable, linkedin, iCIMS).

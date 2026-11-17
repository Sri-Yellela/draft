# D27 — what each board filter actually does (diagnosis, 2026-10-04)

Written BEFORE any code changed, as D27 requires. Every figure below is measured, not read off a
comment.

**Where the numbers come from.** The real `server.js` (branch `d29-filter-tags` = `main` `1a1812d`),
booted on port 3031 against a throwaway COPY of the local database (`data/resume_master.db`, the
09-26 snapshot: 2,616 rows). The copy was put through today's US-only gate (`usEligibility`) first,
so it holds what production's gate would admit — **1,866 active rows** — and a synthetic user with
one engineering profile (target title "Software Engineer") was registered on it. Every count is that
user's `GET /api/jobs` `total`. Production was not queried (no database access from here); the
shape of the defects does not depend on which snapshot is used, the exact counts do. ⚠ The
snapshot's posting dates are old, so the recency counts (`ageFilter=1d` → 0) say nothing.

The board for this profile, unfiltered: **534 rows** (the role scope — declared bucket plus
unclassified — not the 1,866 pool).

## The three failure classes D27 asked about

| class | meaning | fix |
|---|---|---|
| **never wired** | the control changes client state that never reaches a request | client |
| **dead column** | the request arrives, the predicate runs, but the column is empty (or holds a fallback dressed as a value), so it filters nothing or filters on a guess | data (D29) |
| **dropped** | the value is sent, then overwritten or ignored before the WHERE clause | client or server |

## Per filter

| control (where) | param → predicate | result on 534 | class | finding |
|---|---|---|---|---|
| **Location** (search bar) | `location` → `sj.location LIKE %x%` | Boston **1** · Cambridge **0** · Bay Area **0** · San Francisco 370 · **CA 206** · **IN 52** · **MA 3** · NY 190 · Washington 33 | ⛔ **wrong comparison** + ⛔ **never wired on change** | ⭐ **The reproducible "irrelevant results".** A substring over free text: `IN` matches Seatt-le Wash-**in**-gton, Berl-**in** and "Remote with**in** Canada"; `MA` matches O-**ma**-ha; `CA` matches **Ca**nada; "Bay Area" finds none of 370 San Francisco rows; "Washington" mixes Seattle with DC; "Cambridge" (MA) finds nothing. ⛔ Also: the bar's location box has no Enter handler and its onChange only sets the bar's local state — **typing a city and pressing Enter does nothing**; only the magnifier button commits it. |
| Location (drawer) | same `location` param | same | wrong comparison | Same predicate, same defects. `locations=` (jobQuery.js) is the same LIKE. |
| **US-only gate** (ingest) | `usEligibility` at write time | 1,866 of 2,616 admitted | works, but parses the same free text | Built on a real parser (`segments` + `classifySegment`), not LIKE — it is the right base for D29. It only answers "is any US place named", and nothing stores what it parsed, so the board cannot reuse it. Re-derived under D29. |
| **Level** (bar "Any Level", drawer pills, sentence "level") | `experience_levels` → soft-null IN | senior 206 · mid 262 · intern 16 | ⛔ **dead column in disguise** | Wired and applied correctly — but the column is **0% NULL because `normalizeExperienceLevel` returns `'mid'` for any title with no seniority word** (`schema.js:33`). Of 868 active "mid" rows, 592 were never enriched — nothing but the fallback ever looked at them. "Mid (262)" counts unknowns as mid; `manager` → `lead` also files "Account Manager" as lead. The soft-null escape never fires because nothing is NULL. |
| **Domain** (bar "Any Domain") | `domain` → `sj.bucket_domain` soft-null | fintech 124 · saas 5 | ⛔ **dead column in disguise** + **wrong dimension** | `'general'` (57% of active rows) is detectDomain's "matched nothing" fallback stored as a value, so picking any domain HARD-drops every unknown row. And it is the **industry** (fintech/edtech), not the job function D30's dial means (design · engineering · data · product). |
| **Work model** (drawer, sentence "where") | `work_models` → soft-null IN | remote 338 · onsite 302 | works, sparse | 1,017 of 1,866 (54%) NULL, so "remote" keeps 283 unknowns (ordered after the 55 known, A73). Of 251 `remote` rows only 194 say so in the location; 6 `hybrid` rows have "remote" in the location. |
| Employment type (drawer) | `employmentType` / `employment_types` | **534** either way | ⛔ **dead column** | 2,609 of 2,616 NULL. Soft-null keeps everything: the control cannot change the board. |
| Work type (param only) | `workType` → `sj.work_type` | 534 | dead column | No writer (already noted in the drawer; control removed earlier). |
| Category (param only) | `category` → `sj.category` | 534 | dead column | No writer. |
| Min / max YoE (drawer) | `minYoe`/`maxYoe` → `min_years_exp` | **534** | ⛔ **dead column** | `min_years_exp` is NULL on every row. The server also derives a max-YoE from the résumé on every request — it filters nothing either. |
| Max applicants (drawer) | `maxApplicants` | 534 | dead column | `applicant_count` has no writer (SORTS already says so for its sort). |
| Provider (drawer) | `source` / `sources_include` / `_exclude` | lever 19 · ¬greenhouse 231 | works | Works — and is an admin concept (D26): it leaves the user surface. |
| Automation tier (drawer) | `tiers_include` | direct **534** | works, uninformative | 2,609 of 2,616 rows are `direct`. |
| Salary (drawer) | `salary_min_usd` | ≥150k → 383 | works | Hard on NULL by design (unverifiable pay is excluded). |
| Skills (drawer) | `skills_include` | python 395 | works | CC2's whole-word matcher. |
| Sponsor-friendly / company LCA | `sponsorship_friendly` / `company_sponsorship` | 532 / 534 | dead columns (posting side) | `requires_work_auth`/`is_h1b_sponsor` almost all NULL; LCA table holds 22 companies here. |
| **Posted** (drawer "New in 24h", sentence "posted") | `ageFilter` + `posted_after` | 1m → 220 | works server-side, ⛔ **dropped client-side** | ⛔ Pressing Search in the bar re-applies the bar's `status`, and `status = ""` runs `setAgeFilter("")` — **every search silently clears the sentence's "posted" clause.** The bar's level select does the same to `experience_levels`: pick Senior in the sentence, search with the bar at "Any Level", and Senior is gone. |
| **Fit** (sentence) | `fit_bands` | strong → 0 (no scores yet for a new user) | works (hard) | See A85 below. |
| Keyword search (bar) | `localSearch` | backend 252 · react 89 · data engineer 14 | works | A72's ranked search answers ordinary terms on today's code. |
| Status (bar "All Jobs" dropdown) | `status` → boardTab / ageFilter / applied | — | redundant | Duplicates the ALL / ★ / `/d` chips (D26) — and is the control that clobbers `ageFilter` above. |

## Are the panel counts true?

**They are true counts of the caller's own board, not of the whole pool and not of a page.** The
owner's *Intern 1 · Entry 5 · Mid 88 · Senior 121 · Lead 76 · Executive 2 = 293* against "~2,600" is
the role scope: the drawer's counts (`include_facets`) run the board's own WHERE clause, and
2,600 is every active row across every role. Here the same request sums to 534 = the board's `total`.

But three things make them **look** more precise than they are:

1. **Level sums to the total only because nothing is NULL** — the `mid` fallback above. The number
   beside "Mid" is mostly rows nobody classified.
2. **NULLs are dropped from the drawer's facets** (`facetRows.filter(r => r.value != null)`):
   the work-model counts sum to 251 of 534, and the 283 unknowns that every option KEEPS are not
   shown anywhere in that panel.
3. **The drawer's facets include their own dimension's selection**: with Senior picked, the level
   facet reads only *Senior 206*. (D24's `GET /api/jobs/facets`, which the sentence uses, replaces
   the clause's own choice instead — that one is right.)

## What this means for D29 and D30

- Location, level and domain are not broken in the query builder; **the comparison is wrong** (free
  text) or **the stored value lies** (a fallback stored as a value). That is D29's tag layer.
- Employment type, YoE and applicants are dead columns: D29 can tag employment type from the title
  (contract / intern / part-time) — YoE and applicants have no source and their controls should go.
- Two client defects are fixed with D30: the bar's location/level/domain apply only on the
  magnifier, and a bar search clobbers the sentence's level and posted clauses. D26/D28 remove those
  bar controls; the sentence becomes the one place they live.

## After D29 — the tag layer, measured on the same copy (1,866 active)

Coverage per tag (`GET /api/admin/job-tags`), deterministic rules only, no owner tags yet:

| tag | known | share | source of the value |
|---|---|---|---|
| country | 1,866 | 100% | the place parser (every admitted row names a US place, or a remote role's description does) |
| state | 1,714 | 91.9% | "City, ST", state names, known cities |
| metro | 1,712 | 91.7% | 23 metros, closed vocabulary (`shared/jobTagVocabulary.js`) |
| remote / workplace | 886 | 47.5% | location words, the stored workplace_type, a description sentence that states the arrangement |
| level | 1,217 | 65.2% | the title, then the stated years of experience; **no 'mid' fallback** |
| function | 1,430 | 76.6% | the classifier's role bucket; `general` → NULL |
| employment type | 143 | 7.7% | stated by the source, the title, or a description sentence |

**US-only, re-derived:** the tag verdict and the ingest gate (`usEligibility`) agree on every one of
the 2,616 rows — 1,866 US, 711 non-US, 27 unknown, 12 remote with no region. The US-only work was
not resting on the substring match: it had its own parser, which the tag layer now reuses.

**The location filter, after:** Boston 1 known + 32 kept as unknown (country-only or remote) · Bay
Area 422 (was 0) · CA 424 (was 206, a mix of California and Canada) · IN 32, none of them
Washington or Berlin · Washington resolves to the state.

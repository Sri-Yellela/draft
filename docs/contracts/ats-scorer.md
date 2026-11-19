# The ATS scorer contract

D192 (3), from the owner on 11-14: ship the ATS scorer *"as an api contract from rm to draft just like the pdf module … none of what draft already features should change"*.

## The pieces

| | Where | Version (measured 2026-11-19, 46x) |
|---|---|---|
| The scorer's code | `packages/ats-scorer` in draft (the source of truth). The tools service vendors a byte-checked copy in `vendor/ats-scorer` | `@draft/ats-scorer` **1.5.0** (was 1.4.0; the log's "1.2.0" was stale) |
| The tools service's HTTP contract | the tools-service repo, `src/contract/endpoints.js`, generated to `contract/`. Draft vendors it in `contract/resume-master/` | **1.10.0** (was 1.9.0 in the service and 1.8.0 in draft's copy; the log's "1.6.0" was stale) |
| **The ATS response contract** (this document) | the `contract` field of a v2 answer; `CONTEXTUAL_CONTRACT` in the package | **1.x** = the AtsReport alone (`POST /v1/ats/score`) · **2.0.0** = the report plus the contextual block (`POST /v2/ats/score`) |

**How the versions move.** A new field in a response is a minor bump of the service contract, and the generator refuses a shape change without one (`VERSIONS.json` is append-only). A changed or removed field is a new major of the ATS contract, served at a new path. The old path keeps being served. Draft reads whichever version the response declares, so it never sees a shape it does not know.

**Where draft scores.** Draft scores in its own process through the package (`services/localAtsScorer.js`), with the same code the tools service runs, so there is no network call per score. The tools service serves the same functions over HTTP and MCP for every other caller.

## v1: `POST /v1/ats/score` (unchanged)

Request: `{ job, resumeText, signalProfile?, domainProfile?, claims?, termWeights?, synonyms? }`. Response: `{ report: AtsReport }`.
The report's shape is derived by running `scoreAtsLocally` (see `contract/resume-master/resume-master-api.v1.json` → `AtsReport`). **Unchanged in 2.0.0.** The number, the board ranking, the tailoring trigger, "Tailored" and the Résumé tab all keep reading it.

## v2: `POST /v2/ats/score` (ATS contract 2.0.0, service 1.10.0)

Request: everything v1 takes, plus the context the caller holds. The tools service stores none of it.

```jsonc
{
  "job": { "title": "…", "company": "Kestrel Payments", "description": "…" },
  "resumeText": "…",
  "posting": { "category": "software-engineering", "subcategory": "swe.backend", "level": "senior" },   // D179's classifier
  "resume":  { "category": "software-engineering", "subcategory": "swe.backend", "level": "senior",
               "also": { "subcategory": "swe.fullstack" } },                                              // D184 B-1's placement
  "company": { "industry": "financial technology",
               "techStack": [ { "name": "Apache Kafka", "category": "data", "postingShare": 0.64 } ] },  // D179 (5)
  "weights": { "skill_match": 0.5, "role_fit": 0.2, "responsibility_overlap": 0.15, "tech_stack": 0.15 } // optional
}
```

- `company.techStack` **absent**: the service looks the company up. The name comes from `company.name`, else `job.company`, else the posting's "About X" / "at X" line. The lookup asks draft's public `GET /api/public/company-stack?name=` and keeps each answer **24 h in memory**, never on disk. A failure is "no data" and is not kept.
- `company.techStack: []`: the caller knows of none, so there is no lookup and `tech_stack` is `no_data`.
- Unknown weight names, negative weights, or all weights zero → **400**.

Response:

```jsonc
{
  "contract": "2.0.0",
  "report": { /* the v1 AtsReport, field for field */ },
  "contextual": {
    "contract": "2.0.0",
    "score": 78,                       // null when the skill match declined
    "weights": { "skill_match": 0.5, "role_fit": 0.2, "responsibility_overlap": 0.15, "tech_stack": 0.15 },
    "parts": {
      "skill_match":            { "score": 74, "status": "ok", "weight": 0.5 },
      "role_fit":               { "score": 100, "status": "ok", "weight": 0.2, "relation": "same_role", "level_gap": 0, … },
      "responsibility_overlap": { "score": 67, "status": "ok", "weight": 0.15, "phrases": 3, "matched": […], "missing": […] },
      "tech_stack":             { "score": 55, "status": "ok", "weight": 0.15, "exact": […], "ecosystem": […], "gaps": […] }
    },
    "similarities":    { "skills": [], "stack": [], "ecosystem": [{ "yours": "Apache Airflow", "theirs": "Prefect", "family": "orchestration" }],
                         "domains": [], "role": [], "responsibilities": [] },
    "dissimilarities": [ { "kind": "stack_gap", "tech": "Terraform", "share": 0.4, "action": "learn", "penalty": true },
                         { "kind": "responsibility", "phrase": "Lead a team of 5 engineers", "action": "evidence", "penalty": true },
                         { "kind": "domain", "theirs": "healthcare", "yours": ["fintech"], "penalty": false } ]
  },
  "company": { "source": "request" }     // request | lookup | none
}
```

### How each part is scored (all deterministic; no model, no embedding)

| part | rule |
|---|---|
| skill match | the v1 report's `score`, unchanged |
| role fit | Same subcategory = 100, the résumé's "also fits" subcategory = 85, same category = 65, another category = 20. The level gap costs 10 / 25 / 40 / 50 for 1 / 2 / 3 / 4+ steps short, and half that when over-levelled. A shared industry adds 10; a different one is listed with `penalty: false`. No placement on either side → `no_data` |
| responsibility overlap | The posting's *What you'll do* lines, else its bullets, as phrases (up to 12). A phrase matches when one résumé line holds at least 2, and at least half, of the 4 tokens after its leading verb. Score = the share of phrases matched |
| tech-stack compatibility | Each technology is weighted by its `postingShare`. Exact match = full credit, same purpose (`ECOSYSTEMS`) = half, gap = none. The résumé's extras are neutral. No stack → `no_data` |

A part with `no_data` gets weight 0, and the others are rescaled to sum to 1. The fixtures are in `packages/ats-scorer/test/contextual.test.js`; draft's inputs are tested in `test/d192ContextualDraft.test.js`, and the tools service's route in its `test/atsContextualV2.test.js`.

## Draft's side

- `services/atsContextual.js` reads the inputs from draft's own tables: `job_taxonomy` and `level_read`, the active job profile's placement, `company_tech` through `stackFor`, and `company_facts.industry`. The weights come from Admin → Ops (`app_settings.ats_contextual_weights`, `GET/PUT /api/admin/ats-contextual-weights`).
- `GET /api/jobs/:id/contextual` returns the block for a board posting. The extension's press answer carries `ats.contextual` beside `ats.report`.
- `GET /api/public/company-stack?name=` is public and read-only: 60 requests a minute per IP, `Cache-Control: public, max-age=86400`, and nothing about any person. The answer is `{ matched, name, slug, industry, techStack }`, or `{ matched: false }`.

## Changelog

- **2.0.0** (service 1.10.0, package 1.5.0, 2026-11-19): `POST /v2/ats/score` and the contextual block. The v1 report is unchanged.
- **1.x**: the AtsReport alone. Its history is in `packages/ats-scorer/README.md` and the service's `endpoints.js` version notes.

# ATLAS_BOUNDARY — D134 P0, the boundary audit

**Measured 2026-11-02 on `main` at `2fcd674` (session 44f). Nothing in the code is changed by this document.**
Every line reference was read from the tree at that commit; re-derive before trusting a number here once
code moves (the P2 lint rule `d134NoCrossDbAccess` replaces this list as the source of truth).

D134's rule: ⛔ *Atlas never reads draft's database; draft never reads Atlas's — only the contract API and
its event feed.* This document lists every place that rule is broken today, in three lists: (A) draft
reading or writing Atlas data, (B) Atlas reading draft data, (C) the thesaurus's readers. Each row says what
replaces it under `contract/atlas/v1` (P1).

How it was found: the table list from `scripts/migrations.js` / `server.js`'s migration list; every
`FROM / JOIN / INTO / UPDATE` of those tables in `server.js`, `services/`, `routes/`, `shared/`,
`client/src/`; every `import` across the line in both directions. Tests and offline `scripts/` are listed
separately at the end (they move with the code they test).

---

## 0 · What counts as Atlas

**Atlas's code today:** `services/atlas/*` (21 files), `services/learn/*` (8), `services/thumbs/*`,
`routes/atlas.js`, `routes/learn.js`, `routes/learnAdmin.js`, `routes/thumbs.js`, `shared/atlas*.js`,
`shared/learn*.js`, `content/atlas/`, `content/learn/`; on the client `client/src/pages/atlas/*`,
`client/src/lib/atlasLinks.js`, `client/src/panels/adminAtlas.jsx`. **The thesaurus's code** lives in
draft's `services/kb/skillSynonyms.js` + `services/kb/synonymTransfer.js` — D134 gives it to Atlas.

**Atlas's tables (22), all in draft's one SQLite database:**

| Group | Tables | Created by | Personal data? |
|---|---|---|---|
| Graph | `atlas_nodes`, `atlas_edges`, `atlas_resources`, `atlas_wiki_cache` | 177 (`server.js:5465`), widened 189–194, 201 | no |
| Thesaurus | `skill_synonyms` | 098 (`server.js:3321`), owner aliases 123 (`server.js:4109`) | no |
| Stats | `atlas_node_stats` (177), `atlas_posting_match`, `atlas_role_level_stats`, `atlas_live_state`, `atlas_posting_dirty` (199, `server.js:6032`) | | no — but `atlas_posting_match.posting_id` and `company_key` are draft's ids and names |
| Change counter | `atlas_changes` (198) | triggers on `atlas_nodes` + `skill_synonyms` (`server.js:6009–6014`) | no |
| Link counts | `atlas_link_counts` (193) | anonymous day × event counts | no |
| Learn content | `learn_content` (198), `learn_needs`, `learn_teaches`, `learn_extra_items`, `learn_routes` (202) | | no |
| Learn progress | `learn_progress` (195), `learn_opened`, `learn_explanations`, `learn_builds` (202) | `user_id REFERENCES users(id) ON DELETE CASCADE` | ⚠ **yes** — keyed by draft's `users.id`; `learn_explanations.body` is the person's own writing, `learn_builds.url` a link to their own work |
| Pictures | `resource_thumbs` (204) | | no |

**Not Atlas:** `job_role_map` (the board's role classifier, `services/jobs/*`), `ats_term_weights`,
`company_*`, `lca_*` (the sponsorship facts a role page shows are draft's — see B10).

---

## A · Draft reads or writes Atlas

### A1 · SQL against Atlas tables from draft code (5 places + the schema)

| # | Where | What | Replaced by (v1) |
|---|---|---|---|
| A1.1 | `services/jobs/publicJobPage.js:168` | the public job page's "Atlas pages for this posting's skills": `SELECT slug, name FROM atlas_nodes WHERE status='published' AND lower(term) IN …` | `POST /v1/resolve` (terms → published slugs) |
| A1.2 | `services/leanTailoring.js:188` | `broaderTerms` — `atlas_edges` ⋈ `atlas_nodes` for `part_of` / `requires` (P6d's code tier, P6a's payload) | `POST /v1/resolve` → `broader[]` |
| A1.3 | `server.js:6060`, `:6063`, `:6070` (migration 199) | ⛔ **triggers ON `scraped_jobs`** (insert / update of 9 columns / delete) write `atlas_posting_dirty` — every draft write to a posting writes into Atlas | `POST /v1/events/postings` (draft sends the matcher's output; no trigger crosses) |
| A1.4 | `server.js:10146` | boot: `SELECT 1 FROM atlas_nodes` to decide whether to build the live baseline | gone — Atlas boots itself |
| A1.5 | `services/accountService.js:306`, `:309` | account merge plan: `learn_progress`, `learn_opened`, `learn_explanations`, `learn_builds` → `keepInto` | `POST /v1/subjects/{subject}/merge` |
| — | the schema | all 22 tables are created by draft's migrations (`server.js` list, mirrored in `scripts/migrations.js`); `atlas_*` and `learn_*` FKs point at draft's `users(id)` | P2 moves them to Atlas's own database by a migration; the `users` FK becomes an opaque `subject` |

### A2 · Draft imports Atlas code (in-process calls a contract replaces)

| # | Where | Imports | Why | Replaced by |
|---|---|---|---|---|
| A2.1 | `services/jobs/aggregator.js:1080`, `:1099` · `boardAge.js:134` · `dedupRetire.js:129`, `:203` · `descriptionText.js:105`, `:142` · `detailFetch.js:712` · `enrichmentBatches.js:231` · `enrichmentTransfer.js:498` · `jobGateway.js:72` · `levelRead.js:35` · `routes/jobData.js:166` · `server.js:7048`, `:11462` | `atlasPostingsChanged` (`services/atlas/atlasLive.js:134`) — **15 call sites in 12 files**, several inside draft's write transactions | the board's writes move the Atlas counts "in the same transaction" (D118 P1) | the same 15 sites call draft's own **outbox** (`atlas_outbox`, draft-side) which `POST /v1/events/postings` drains — the transaction boundary stays draft's |
| A2.2 | `services/interviewPrep.js:22` (used `:238`, `:240`, `:259`, `:271`) | `searchNodes`, `readNode`, `profileTerms`, `termOf`, `aliasesOf` | D110's prep: a skill's page + the person's gaps | `GET /v1/search`, `GET /v1/nodes/{slug}`, `POST /v1/resolve`; the person's terms are draft's own (B1) |
| A2.3 | `services/atsCalibration.js:24` (used `:151`) | `ACTIVE_POSTINGS_WHERE`, `countedSentences`, `companyBoilerplate` from `postingMatcher.js` | calibration counts only a posting's requirement sentences | `packages/atlas-matcher` (pure; draft passes the company's postings) |
| A2.4 | `server.js:107–121`, `:7193–7226`, `:8983`, `:10104–10148` | `refreshThumbs`, `seedLearnContentIfEmpty`, `seedCircleData`, `checkExtraItems`, `seedAtlasFromRegistry`, `importLearnConcepts`, `publishLearnConcepts`, `learnContent`, `importLearnPatterns`, `seedAtlasFamilies`, `computeAtlasStats`, `liveVersion`, `atlasSitemapRoutes`, `checkAtlasLinks`, `autoPublish`, `runAtlasAutoPipeline` | draft's boot seeds Atlas and draft's nightly runs Atlas's jobs | Atlas's own boot and scheduler (P3); `atlasSitemapRoutes` → draft builds `/sitemap-atlas.xml` from `GET /v1/nodes?status=published` |
| A2.5 | `server.js:100–102`, `:108`, mounts `:10083–10099` | `createAtlasRouter`, `createAtlasAdminRouter`, `createLearnRouter`, `createLearnAdminRouter`, `createThumbsRouter`, `createThumbsAdminRouter`, `resourceItems` | Atlas's HTTP lives on draft's Express app under `/api/atlas`, `/api/learn`, `/api/thumbs`, `/api/admin/{atlas,learn,thumbs}` | draft keeps those paths as a **thin proxy / BFF** onto `/v1` (the client's 18 fetch sites need not change in P2) |

### A3 · Draft's client calls Atlas's HTTP (fine today; listed so P2's proxy covers each)

`client/src/lib/atlasLinks.js` (`/api/atlas/resolve`, `/terms/:jobId`, `/peek/:slug`, `/link-event`) ·
`client/src/pages/atlas/atlasModel.js` (`/node/:slug`, `/search`) · `YourMap.jsx` (`/me`, `/tree/role/:key`,
`/tree/family/:key`) · `LearnView.jsx`, `YourCourse.jsx` (`/api/learn`, `/circle`, `/circle/my-route`,
`/earned`, `/opened`, `/explained`, `/built`) · `components/ResourceTile.jsx` (`/api/thumbs/learn`) ·
`panels/adminAtlas.jsx` (the editor, `/api/admin/atlas/*`). Names only — `shared/trialTour.js:41` and
`components/ExploreLock.jsx:24` use `learn_progress` as an **action name**, not the table.

---

## B · Atlas reads draft

### B1 · SQL against draft tables from Atlas code

| # | Where | Reads | For | Replaced by (v1) |
|---|---|---|---|---|
| B1.1 | `services/atlas/atlasStore.js:90` | `profile_skills` (the person's skills) | `haveTerms` / `profileTerms` → `you`, Your map, peek's have / missing, interview prep | ⛔ draft sends the skills in the request (`POST /v1/map`, `POST /v1/resolve`, `?subject` reads carry no skills) — Atlas never stores them |
| B1.2 | `services/atlas/atlasStore.js:105–107` | `profile_base_resumes`, `base_resume`, `resumes` (existence of a résumé, `content`) | `hasResume` ("upload a résumé" vs "your map") | draft decides and sends `hasResume` (or nothing: the empty state is draft's UI) |
| B1.3 | `services/atlas/atlasStore.js:17`, `:93` | `profileFromResume` (`services/structuredProfile.js`) — **reads the résumé's parse** | D120 P1's fallback when the Profile has no skills | draft's — it sends the skills it has |
| B1.4 | `services/atlas/atlasMe.js:218` | `domain_profiles` (target titles, profile name) | Your map's target roles | `POST /v1/map` `roles[]` (titles; Atlas resolves them to role nodes) |
| B1.5 | `services/atlas/atlasMe.js:225` | `user_profile.current_job_title` | same, the fallback | same |
| B1.6 | `services/atlas/postingMatcher.js:222`, `:248`, `:278` | `scraped_jobs` (count/sum/max key, each company's postings' text, every active posting's text) | the board's vocabulary key, per-company boilerplate, the bulk match | `packages/atlas-matcher` runs **in draft** over draft's text; Atlas receives matched terms (`POST /v1/events/postings`) |
| B1.7 | `services/atlas/atlasStats.js:120`, `:150` | `scraped_jobs` (text, level, pay) | `atlas_node_stats`, the nightly full recount | events + `POST /v1/events/postings/reconcile` (the nightly drift check, `d134EventsDriveStats`) |
| B1.8 | `services/atlas/atlasLive.js:144`, `:147` | `scraped_jobs` (one dirty posting; orphans `NOT IN (SELECT id FROM scraped_jobs)`) | the live counts | events (`op: close` replaces the orphan sweep) |
| B1.9 | `services/atlas/atlasTree.js:53` | `scraped_jobs` (every active posting, per tree build) | the tree's per-level shares | Atlas's own `atlas_posting_match` (already fed by events) |
| B1.10 | `services/atlas/atlasLinks.js:92` | `scraped_jobs` by `job_id` (title, company, text, `skills_json`) | `/api/atlas/terms/:jobId` — the D114 link spans | `POST /v1/annotate` (draft sends the text it owns + the skills it extracted) |
| B1.11 | `services/atlas/atlasSponsors.js:30` | `scraped_jobs` (company, title of active postings) + draft's LCA facts (B2) | D108 P3 "Sponsors who hire this role" on a role page | ⛔ **stays draft's** — draft composes it beside the role page (Atlas holds no employer immigration facts) |

### B2 · Atlas imports draft code

| # | Where | Imports | Note |
|---|---|---|---|
| B2.1 | `atlasStore.js:14`, `postingMatcher.js:34`, `atlasSponsors.js:10` | `normaliseAtsTerm` (`services/localAtsScorer.js`) | the ONE term normaliser — moves into `packages/atlas-matcher` and both sides import it from there |
| B2.2 | `atlasStore.js:15` | `recordSynonymProposals`, `confirmSynonym` (`services/kb/skillSynonyms.js`) | the thesaurus's writer — moves into Atlas (C) |
| B2.3 | `atlasStore.js:17` | `profileFromResume` (`services/structuredProfile.js`) | B1.3 — removed |
| B2.4 | `atlasMe.js:24` | `userLevelFor` (`services/picks.js`) | the person's level — draft sends `level` in `POST /v1/map` |
| B2.5 | `atlasMe.js:25`, `atlasRolePage.js:19` | `LEVELS_READ` (`shared/postingLevel.js`) | a shared constant — becomes part of the contract (the `Level` enum) |
| B2.6 | `atlasSeed.js:15` | `REGISTRY_DIR` (`packages/ats-scorer/src/vocabulary.js`) | Atlas seeds draft nodes from the scorer's registry files — see C3 |
| B2.7 | `atlasSponsors.js:11–12` | `sponsorshipFactFor`, `sponsorshipSignal` (`services/kb/sponsorship*.js`) | B1.11 — stays draft's |
| B2.8 | `services/learn/learnEarned.js:17` (used `:126`) | `checkEvidence` (`services/proofLinks.js`, D109) | the evidence rule for a build link — a pure function; copied into Atlas or moved to `shared/` |
| B2.9 | `services/thumbs/resourceThumbs.js:24` | `sniffImage` (`services/jobs/companyLogoStore.js`) | a pure function — moved to a shared util |

### B3 · Atlas uses draft's sign-in

`routes/learn.js:43–68` (`requireAuth` → `req.user.id`), `routes/atlas.js:121`, `:131`, `:139`, `:174`
(`req.user?.id` on peek, `/me`, trees, node) — the person is draft's `users.id`. **v1:** draft authenticates
the person and calls Atlas with its API key + an opaque `subject` (D134: chosen by the consumer). Atlas never
sees a draft session.

---

## C · The thesaurus (`skill_synonyms`) and its readers

**One table, two owners today:** the scorer reads it, the Atlas writes aliases into it. D134 gives it to Atlas;
draft's scorer keeps a **versioned snapshot** updated from the feed.

| # | Where | Reads / writes | Kind | Under v1 |
|---|---|---|---|---|
| C1.1 | `services/kb/skillSynonyms.js:94–96`, `:186`, `:211`, `:217`, `:243`, `:258`, `:269` | all of it — propose, confirm, reject, list, `loadConfirmedSynonyms` (memoised) | the code | moves to Atlas |
| C1.2 | `server.js:8536` `atsSynonyms()` → **13 call sites** on the scoring path (e.g. `:8629`, `:10095`) | confirmed rows as a `Map` | ⭐ hot path (25 jobs a batch) | the local snapshot (`GET /v1/thesaurus/snapshot` + `GET /v1/changes`) — still a `Map`, still instant |
| C1.3 | `services/kb/companyProfile.js:38` | `loadConfirmedSynonyms` (stack merge) | read | the snapshot |
| C1.4 | `services/kb/synonymTransfer.js:164`, `:196` | the D17 export → owner → import path | write (proposals) | `POST /v1/admin/thesaurus/proposals` (admin scope) |
| C1.5 | `services/atlas/atlasStore.js:57` `aliasesOf`, used by `atlasEditor.js:91`, `:200`, `atlasLearnImport.js:46`, `atlasLinks.js:65`, `atlasStore.js:97`, `:131`, `:176`, `:219`, `postingMatcher.js:335`, `learnLinks.js:36`, **`interviewPrep.js:271` (draft)** | aliases of a term | read | inside Atlas; draft's one use → `POST /v1/resolve` |
| C1.6 | `services/atlas/atlasStore.js:73–74` (`addAlias`), `atlasEditor.js` merge | confirm an alias | write | inside Atlas |
| C1.7 | `services/atlas/atlasLinks.js:61` | count of confirmed aliases (cache key) | read | inside Atlas |
| C1.8 | `server.js:6012–6014` | triggers → `atlas_changes` | the change counter | becomes the change log behind `GET /v1/changes` |
| C1.9 | `server.js:4109` (migration 123) | the owner's aliases, seeded | write, once | Atlas's seed |
| C2 | `shared/tagRegistry.js:113` | a declaration (`skill_synonyms` is the vocabulary), no access | doc | updated to name the snapshot |

**C3 · a second vocabulary, flagged.** `packages/ats-scorer` (1.3.0) reads its own skill vocabulary from
`DOMAIN_TOOL_REGISTRY.json` / `DOMAIN_METADATA_REGISTRY.json` (`vocabulary.js:43–44`, `skillVocabularyTerms`
`:112`) and Atlas **seeds its nodes from the same files** (`atlasSeed.js:15`). That is two lists of "what is a
skill" that already differ (Atlas adds concepts, patterns, curated nodes; the registry adds nothing Atlas
curates). The synonyms are injected (`scorer.js:1145`, a `Map` of confirmed rows — refused in any other shape,
`:1130`), so the snapshot slots in without touching the scorer. **The vocabulary is not injected.** Decision
for the owner in P1 (`contract/atlas/v1/README.md` § Open questions, Q3).

---

## D · Offline scripts and tests (move with their code; no runtime crossing)

Scripts touching Atlas tables: `scripts/al3SkillSynonyms.mjs:19`, `:122–174` · `al3SynonymRhoEffect.mjs:142` ·
`am1PurgeImpactAudit.mjs:139`, `:170` (all `skill_synonyms`) · `applyMigrations.js:81` (`atlas_nodes`, the
194 backup check) · `learn/extractTracker.mjs:13` (`learn_content`). Tests: every `test/d105*`, `d114*`–`d120*`,
`d123*`, `d125*` file that builds a draft database and reads Atlas tables in it — P2's in-process transport
keeps them working; P3 splits them into Atlas's suite and draft's consumer-contract suite
(`d134ConsumerContractDraft`).

---

## E · Counts (for P2's guard to drive to zero)

| Crossing | Count |
|---|---|
| draft SQL → Atlas tables (runtime, excluding the schema) | **5** (A1.1–A1.5) — one of them three triggers |
| draft code → Atlas imports | **15** `atlasPostingsChanged` call sites in 12 files · 1 interview prep · 1 calibration · 16 boot/scheduler imports in `server.js` · 6 router factories |
| Atlas SQL → draft tables | **11** sites over `profile_skills`, `profile_base_resumes`, `base_resume`, `resumes`, `domain_profiles`, `user_profile`, `scraped_jobs` (B1.1–B1.11) |
| Atlas code → draft imports | **9** (B2.1–B2.9) |
| thesaurus readers outside Atlas | **3** (C1.2 the scorer's 13 calls, C1.3, C1.4) + interview prep's `aliasesOf` |
| tables holding personal data | **4** (`learn_progress`, `learn_opened`, `learn_explanations`, `learn_builds`) |

**What this means for P2:** the hard crossings are A1.3 / A2.1 (the board's writes drive the counts, today in
the same transaction) and B1.6–B1.10 (Atlas reads posting text). Both are solved by one move: the matcher
becomes a package that draft runs over its own text, and Atlas is told the result. Everything else is a
lookup the contract already names.

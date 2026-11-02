# contract/atlas/v1 — Atlas's domain model and API (D134 P1, ON PAPER)

**Status: a proposal for the owner's (and the chat assistant's) review. Nothing calls it yet; no code moves
until P1 is reviewed (D134: P2–P5 wait).** Written 2026-11-02 (session 44f) from the P0 audit,
[`docs/ATLAS_BOUNDARY.md`](../../../docs/ATLAS_BOUNDARY.md), and from the code as it is at `c1bb6c7`.

- `openapi.yaml` — the API, OpenAPI 3.1. ⛔ **Additive changes only within v1** (a new optional field, a
  new endpoint, a new enum value only where the field is marked `x-extensible-enum`). Removing or
  renaming anything, or changing a meaning, is **v2**.
- This file — the domain model the API speaks, the rules it holds to, how today's endpoints map onto it,
  and the questions the owner decides before P2.

---

## 1 · The rules (from D134, made checkable)

| Rule | What the contract does about it | Test (P2+) |
|---|---|---|
| ⛔ Atlas never reads draft's database; draft never reads Atlas's | every crossing in ATLAS_BOUNDARY.md becomes a call below; nothing else exists | `d134NoCrossDbAccess` |
| ⛔ Atlas holds no personal data | a person is a **`subject`**: an opaque string (≤ 128 chars) the consumer chooses — draft sends an HMAC of `users.id` under a draft-side key, never the id, email or name. Skill lists in `POST /v1/map` / `/v1/resolve` are used for that call and not stored. Stored per subject: only Learn progress facts (§2.6). | `d134NoPersonalDataInAtlas` |
| ⛔ One thesaurus, owned by Atlas | `GET /v1/thesaurus/snapshot` (versioned) + `GET /v1/changes`; draft's scorer holds the snapshot as its `Map` | `d134OneThesaurusSnapshotFeed` |
| The matcher is one versioned package | `packages/atlas-matcher` (pure: text + snapshot → matched terms); every posting event names the `matcherVersion` + `snapshotVersion` it was read with | `d134MatcherPackageVersioned` |
| Stats are fed by events, never by reading postings | `POST /v1/events/postings` + the nightly `…/reconcile` | `d134EventsDriveStats` (drift 0 vs the recount) |
| Keys and scopes | one API key per consumer; scopes `read · compute · events · learn · admin` | `d134ScopesEnforced` |
| Latency | `GET /v1/peek/{slug}` and `POST /v1/resolve` p95 ≤ 100 ms from draft | `d134LatencyBudgets` |
| Every response matches the spec | responses validated against `openapi.yaml` in tests | `d134ContractValidates` |

---

## 2 · The domain model (Atlas's own — not draft's tables renamed)

Names are the API's. The column each comes from today is given so P2's migration has a map.

### 2.1 Node
A thing on the map. `slug` (stable, the public URL's key) · `kind` ∈ role · skill · tool · concept ·
pattern · stack (`atlas_nodes.kind`, widened in 194) · `name` · `term` (the normalised form the matcher
matches) · `definition` + `definitionBy` (`owner` | a curator | `drafted`, D105 P11) · `status` ∈ draft ·
published · `family` ∈ ml · systems · infra · data · backend (`x-extensible-enum`, `shared/atlasFamilies.js`,
D116 / D127) · `wikidataId` · `publishedAt`, `updatedAt`. **Never** in the public read: `published_by`,
`unpublished_by` (curator names; admin scope only).

### 2.2 Alias — the thesaurus
`term` ↔ `equivalent`, `relation` ∈ alias · related (`skill_synonyms.relation`, `RELATIONS` in
`services/kb/skillSynonyms.js:47`; broader / narrower are edges — `part_of` / `requires` — not aliases),
`status` ∈ proposed · confirmed · rejected, `confidence` (orders the review queue only — ⛔ corroboration
never promotes, G1's rule kept). **Only confirmed rows are in the snapshot.** The public read of a node
shows its confirmed `alias` relations as `aliases[]`. `alias_of` in D134's edge list **is** this table, not
an edge (today's code already treats it so, `server.js:5460`).

### 2.3 Edge
`from` → `to` (slugs), `type` ∈ requires · part_of · used_with · alternative_to · leads_to, `source` ∈
owner · registry · wikidata · onet · board. Read as `related[]` on a node: `{ type, dir: out|in, slug, kind, name }`.

### 2.4 Resource, WikiSummary, Thumb
**Resource:** `url`, `title`, `level`, `format`, `hours`, `cost`, `source` (wikidata · wikipedia · owner …),
`checkedAt`, `checkStatus`; a dead link is never served. **Thumb** (D119): the stored picture, by
`urlHash` (sha256 of the URL) — `GET /v1/thumbs/{urlHash}` returns the image bytes. **WikiSummary:**
Wikipedia's text **as Wikipedia's** — `title`, `extract`, `pageUrl`, `fetchedAt` and the `licence` block
(CC BY-SA 4.0) always together (`d105WikiAttributed`).

### 2.5 Stats — fed by consumers
Per node: `postings`, `topSkills[]`, `topRoles[]`, `pay { minUsd, medianUsd, maxUsd, n }`, `computedAt`.
Per role × level: postings asking for each node (`atlas_role_level_stats`), and the mid → senior rises.
**Source of truth:** the posting events (§4). Atlas keeps, per consumer, **one row per posting id it was
told about** — `{ consumer, postingRef, companyKey, role, level, asked[], linked[], payMinUsd, payMaxUsd }`
(today `atlas_posting_match`) — and the counts are sums over it. `postingRef` and `companyKey` are the
consumer's opaque strings (draft: the posting's id; the company normalised). No posting text, title or URL.
Stats are reported **per consumer** in v1 (draft is the only one); pooling across consumers is a v1
additive option the owner decides later (Q5).

### 2.6 Learn
**Content** (versioned: `learn_content`, the tracker imported as JSON, never evaluated) · **Piece** (a
step: `needs[]`, `opens[]`, `teaches[]` terms → nodes, items) · **Item** (a resource inside a piece, extra
items from D115 P5) · **Checkpoint** (an "explain it" prompt) · **Route** (a name + target pieces).
**Subject progress** (D117 C8 — earned, never ticked): `opened` (item, at), `explained` (checkpoint,
words, at), `built` (piece, kind, at). The rule that turns marks into a piece's state and into **learned
nodes** (D116 M8) is `shared/learnStepState.js` — it becomes part of Atlas, and draft's client reads the
state from `GET /v1/subjects/{subject}/state` instead of computing it. ⚠ **What is stored for
"explained" and "built" is Q1** (the person's own text and link).

### 2.7 Map (computed, never stored)
`POST /v1/map` takes `{ subject?, skills[], roles[], level?, aim? }` and returns D116 M1's tree for those
skills against those roles: the families, each node's have / missing / learned ring, the three facts, the
route. Learned rings come from the subject's progress; **the skills are not stored.**

---

## 3 · Where each piece of today's API goes

Draft keeps its own public paths (`/api/atlas/*`, `/api/learn/*`, `/api/thumbs/*`) as a thin proxy over
`/v1` — the client's fetch sites (ATLAS_BOUNDARY § A3) do not change in P2. The proxy adds the subject
and the person's skills where today the Atlas code read them from draft's tables.

| Today (draft, `routes/*.js`) | v1 | Scope | Notes |
|---|---|---|---|
| `GET /api/atlas/search?q=` | `GET /v1/search?q=` | read | D-normalised (`shared/atlasSearchNormalize.js`) |
| `GET /api/atlas/resolve?terms=` | `POST /v1/resolve` | compute | + `broader[]` and `siblings[]` (D123 P6c / P6d); replaces `leanTailoring.broaderTerms` (A1.2) and `publicJobPage.atlasLinksFor` (A1.1) |
| `GET /api/atlas/terms/:jobId` | `POST /v1/annotate` | compute | draft sends the text + its `skills[]`; Atlas returns the linkable terms and spans |
| `GET /api/atlas/peek/:slug` | `GET /v1/peek/{slug}` | read | `you` (have / missing) computed by draft's proxy from the person's skills, or `?skills=` — Q2 |
| `GET /api/atlas/node/:slug` | `GET /v1/nodes/{slug}` (+ `GET /v1/roles/{slug}` for a role's board data) | read | `sponsors` is **draft's** — the proxy adds it (B1.11); `you` as for peek |
| `GET /api/atlas/me` | `POST /v1/map` | compute | draft sends skills, target-role titles, level (B1.1–B1.5, B2.4) |
| `GET /api/atlas/tree/role/:key`, `/tree/family/:key` | `GET /v1/trees/roles/{slug}`, `GET /v1/trees/families/{key}` (public) · `POST /v1/map` with `roles` / `family` (personal) | read / compute | |
| `POST /api/atlas/link-event` | `POST /v1/events/links` | events | anonymous day × event counts |
| sitemap (`atlasSitemapRoutes`) | `GET /v1/nodes?status=published&fields=slug,updatedAt` | read | draft renders `/sitemap-atlas.xml` |
| `GET /api/learn`, `/circle`, `/circle/my-route` | `GET /v1/learn/content`, `GET /v1/learn/circle`, `GET /v1/subjects/{subject}/route` | learn | |
| `GET /api/learn/earned`, `/progress` | `GET /v1/subjects/{subject}/state` | learn | |
| `POST /api/learn/opened`, `PUT /explained`, `PUT /built`, `PUT /progress`, `POST /progress/import` | `PUT /v1/subjects/{subject}/progress` (one body, `kind` = opened · explained · built) | learn | the old ticks (`learn_progress`, 195) are kept read-only and no longer count — they migrate as-is and are not in v1 |
| account merge (`accountService.js:306–309`) | `POST /v1/subjects/{subject}/merge` `{ from }` | learn | `keepInto` semantics |
| account deletion (FK `ON DELETE CASCADE`) | `DELETE /v1/subjects/{subject}` | learn | draft calls it in its deletion path — today a cascade does it silently |
| `GET /api/thumbs/:hash`, `/learn` | `GET /v1/thumbs/{urlHash}` | read | |
| the board's writes → `atlasPostingsChanged` (15 sites) | `POST /v1/events/postings` from draft's outbox | events | §4 |
| `computeAtlasStats` nightly | `POST /v1/events/postings/reconcile` | events | §4 |
| `loadConfirmedSynonyms` (the scorer) | `GET /v1/thesaurus/snapshot` + `GET /v1/changes` | read | §5 |
| `/api/admin/atlas/*` (29 routes), `/api/admin/learn/*` (11), `/api/admin/thumbs/*` (4) | `/v1/admin/*` | admin | listed in `openapi.yaml` by group; their bodies are today's, to be pinned in P2 |

---

## 4 · Posting events — how the counts stay live without Atlas reading a posting

1. **Draft runs the matcher.** `packages/atlas-matcher` (today's `postingMatcher` + the boilerplate fix,
   pure) reads a posting's text with the thesaurus snapshot and the company's boilerplate set (draft computes
   that from its own postings — it is the one step that needs a company's other postings, so it stays with
   the data, ATLAS_BOUNDARY A2.3 / B1.6).
2. **Draft records an outbox row** in the same transaction as the board write — the 15
   `atlasPostingsChanged` sites write to a draft-side `atlas_outbox` instead (and migration 199's triggers on
   `scraped_jobs` are replaced by the same outbox; A1.3). The transaction boundary stays draft's.
3. **A drain sends batches** (`POST /v1/events/postings`, ≤ 500 events): `{ op: upsert | close, postingRef,
   companyKey, role?, level?, asked[], linked[], pay?, matcherVersion, snapshotVersion, at }`. Idempotent by
   `(postingRef, at)`; a later `at` wins; a batch answers per-event `accepted | stale | rejected`.
4. **Nightly reconcile.** Draft sends the full list of active `postingRef`s with a digest of each one's
   terms (`POST /v1/events/postings/reconcile`, paged by a `runId`). Atlas closes refs it holds that are
   absent, reports refs whose digest differs (draft re-sends them) and reports the **drift** — the number
   `d134EventsDriveStats` holds at 0.
5. **A new snapshot version** means every posting must be re-read with it: Atlas marks stats `stale:
   snapshotVersion < N` until the consumer's reconcile with the new version lands. Pages show the counts with
   `computedAt` meanwhile (they never go blank).

---

## 5 · The thesaurus snapshot and the change feed

- `GET /v1/thesaurus/snapshot` → `{ version, generatedAt, terms: [{ term, equivalents[] }], nodes: [{ slug,
  kind, term, status }] }` (`ETag` = version). Confirmed rows only. The scorer's `Map<normalisedTerm,
  string[]>` is built from it exactly as `loadConfirmedSynonyms` builds it today (`scorer.js:1130` refuses
  any other shape — unchanged).
- `GET /v1/changes?since=<cursor>&limit=` → `{ changes: [{ seq, at, entity: node|alias|edge|stats|learn, op:
  upsert|delete, key, snapshotVersion? }], next, hasMore }`. Cursor = the last `seq` seen; `410 Gone` if the
  cursor is older than retention (30 days) → re-take the snapshot.
- Draft persists `{ snapshotVersion, cursor }` and the snapshot file locally; on boot it scores from the file
  (no network on the scoring path); a poller applies changes every 60 s. ⚠ Today's `atlas_changes` is a
  single counter (198) — P2 replaces it with a real append-only change log.

---

## 6 · Auth, limits, errors, versioning

- `Authorization: Bearer atl_<key>`; a key has a consumer id and scopes. Missing / wrong → `401`; scope
  missing → `403 { error: "scope_required", scope }`.
- Rate limits per key (headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; `429` with
  `Retry-After`). Draft's defaults proposed: read 50 /s, compute 20 /s, events 5 batches /s.
- Every response carries `X-Request-Id` (echoed when the caller sends one). Reads carry `ETag` and
  `Cache-Control` (public reads `public, max-age=60`, the live window D118 P1 uses today; subject reads
  `private, no-store`).
- One error shape: `{ error: <code>, message, requestId, details? }`.
- `GET /v1/version` → `{ api: "1.0.0", build, matcherVersion, snapshotVersion }`. The spec's `info.version`
  is the contract version (semver, minor = additive).

---

## 7 · Open questions — the owner decides before P2

**Q1 · The person's own words and links in Learn.** `learn_explanations.body` (what they wrote to explain
a checkpoint) and `learn_builds.url` (a link to what they built) are the person's own content. D134 says
Atlas holds no personal data. **Recommendation:** the body and URL stay in **draft**; Atlas receives
`{ checkpoint, words }` / `{ piece, kind, evidenceOk: true }` after draft applies the same rules
(`EXPLAIN_MIN_WORDS` = 25, the `OWN_WORDS` paste refusal — which needs the text, so it can only run where the
text is kept — and D109's `checkEvidence`) and stores only the earned fact. A standalone customer without
its own store would then have no place for the text — acceptable for v1? (Alternative: Atlas stores them
under the subject, encrypted, deletable with the subject — simpler for outside customers, weaker on D134's rule.)

**Q2 · `you` on a public page.** Today peek and node pages answer have / missing for a signed-in reader
from their Profile. **Recommendation:** draft's proxy adds it (it has the skills; one `POST /v1/resolve`
per page, cached per person) — Atlas's public reads stay public and cacheable for everyone.

**Q3 · The scorer's own vocabulary** (ATLAS_BOUNDARY C3). `packages/ats-scorer` reads "what is a skill" from
its registry files; Atlas seeds from the same files and then curates. **Recommendation:** the snapshot
carries the node list; the scorer's vocabulary becomes injectable (like synonyms) and draft feeds it from the
snapshot — one list. This is a change to `@draft/ats-scorer` (→ 1.4.0) and moves ATS scores, so it needs its
own measured before / after (D125's gold set) and is **not** part of P2 unless the owner says so.

**Q4 · Sponsorship on role pages** stays draft's (immigration facts about employers are not Atlas's domain,
and the LCA data is draft's). Confirm.

**Q5 · Pooled stats.** When a second consumer sends postings, are the public counts per consumer or pooled
(and deduplicated how)? v1 reports per consumer; pooling is additive later.

**Q6 · Where the editor lives.** The admin editor (`adminAtlas.jsx`, 44 admin routes) stays in draft's
admin panel and calls `/v1/admin/*` with draft's admin key — or Atlas gets its own small admin page. v1
supports either; **recommendation:** draft's panel, for now.

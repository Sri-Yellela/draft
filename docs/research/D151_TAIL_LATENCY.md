# D151 · How large systems keep p99 low at scale — and what draft does with it

*Researched 2026-11-08 (45j) on the owner's "research how large companies do this to achieve the best p99 latency with much
more scale and jobs and various other heavy options." Sources at the end; claims taken from secondary write-ups are marked.*

## 1 · What the big systems do

**Search engines answer from posting lists, not table scans.** LinkedIn's Galene (people, job and recruiter search) and
every Lucene-family engine keep an *inverted index*: for each term or facet value, the list of document ids that have it. A
query intersects the lists, **starting from the most selective one**, so the work is proportional to the matches, not the
corpus. LinkedIn's faceting post splits the problem into *discovery* (which values exist) and *counting* (how many), counts
from the inverted index, and keeps counts **exact for low-cardinality facets while allowing estimates for high-cardinality
ones** — the trade that made faceting fast enough at their scale.

**Facet counts are bitmap intersections.** The fastest embedded designs keep one bitmap per facet value (Roaring bitmaps):
a facet count is `popcount(matches ∩ filters ∩ value)` — microseconds per value, independent of how many rows match.
Bitmaps are updated in the same transaction as the row. (Source: a Rust project, pylon-storage, pairing SQLite FTS5 with
Roaring bitmaps for "Meilisearch-class latency at 1 M rows without a second service" — the project's own claim.)

**Expensive per-field structures are built ahead of the query.** Elasticsearch builds *global ordinals* per field for
aggregations lazily, on the first search that needs them; `eager_global_ordinals` moves that cost to index/refresh time
"if search performance is a priority" — the cost moves off the read path.

**Tail latency is engineered, not hoped for** (Dean & Barroso, *The Tail at Scale*, Google, CACM 2013 — via summaries):
- *Hedged requests:* after the p95 time, send a second copy to another replica and take the first answer; a reported
  example cut a BigTable p99 from 1,800 ms to 74 ms for ≈ 2 % more load (figure from a secondary write-up — check the paper).
- *Tied requests:* copies that cancel each other once one starts.
- *Micro-partitioning and selective replication* so a hot shard spreads; *latency-induced probation* for a slow replica.
- *Good-enough answers:* return within budget with what's ready rather than wait for the slowest part.
- Background work is **sliced and rate-limited** so it never sits in front of a user request.

**Freshness is a separate pipeline.** Indeed measures freshness as the time from a job being found to it being
searchable, and runs document serving (docstore) as its own system; Glassdoor runs a *nearline* system for relevance work
that can't fit the request path. Heavy work happens near-line; the request reads its result.

## 2 · What draft has done (11-08, measured on the 100k synthetic fixture)

| Step | Pattern | Effect |
|---|---|---|
| `f5f26e3` / later `READ_SLOW_FULL` | measure first: the slow statement + its plan | found the real culprits |
| migration 228 · `job_captures(user_id, job_id)` | index the correlated lookup | no `SCAN jc` per posting |
| `a3dc58a` ≈ 50 ms tag/level slices | background work sliced (Tail at Scale) | board 2.2–2.4 s → 1.3–1.4 s (1 user) |
| `04c14a5` scoring in a worker thread | heavy work off the request path | → 1.0–1.2 s; scoring gone from the main thread |
| migration 229 + one capped read | build the ordering ahead (eager ordinals' idea) + *good enough* ("2,000+") | → **0.23–0.31 s** (1 user) |
| `6bf8c0e` score gate as a driving IN-list | intersect from the most selective list | deck p95 11.1 → 6.1 s (20 users) |
| `b2698b6` ★ / + / /d start from the person's rows | the same, for the person's own lists | **2.6× throughput**; facets p95 13.6 → 4.6 s |
| ANALYZE (planner statistics) | tried | no effect here — not adopted |

## 3 · What remains, and the plan (in order)

1. **Find the 27 s event-loop block** seen once in the 11-08 20-user run (everything else is noise beside it).
2. **Facets as counts over the person's set, in one pass.** Today: a head count + 4 view totals + one aggregate per filter
   clause, each a separate statement re-running the board's preparation. With the board now starting from the person's
   scored set (hundreds of rows), the clause aggregates can be **one statement** over that set (`SUM(CASE…)` per option),
   and the four view totals can come from small owned sets. Then a **stale-while-revalidate** cache: answer from the last
   counts at once and refresh in the background — a count a few seconds old is "good enough" (Tail at Scale).
3. **The deck and Full House at 20 users** — the remaining whole-board statements on those paths, found with the same
   slow-read log, each made to start from the smallest set.
4. **Read-pool sizing** — 2 workers on this 8 GB laptop; production's Railway plan decides the right number (measure there).
5. **Beyond ≈ 1 M active postings, or when the web and the crawler must scale apart** (D151 Rule 4's recorded trigger):
   a search engine (OpenSearch / Meilisearch / Typesense) — inverted index, bitmap facets, its own replicas, hedging at the
   client — fed near-line from SQLite. Not before: at today's ≈ 17.5 k active postings and the 100k test, SQLite with the
   patterns above is the measured answer.

## Sources

- [The Many Facets of "Faceted Search" — LinkedIn Engineering](https://engineering.linkedin.com/faceting/many-facets-faceted-search)
- [LinkedIn's Galene search architecture built on Apache Lucene — Lucidworks](https://lucidworks.com/blog/linkedins-galene-search-architecture-built-on-apache-lucene)
- [Search federation architecture at LinkedIn](https://engineering.linkedin.com/blog/2018/03/search-federation-architecture-at-linkedin)
- [Scaling LinkedIn's search infrastructure — LeadDev StaffPlus 2025 (slides)](https://leaddev.com/wp-content/uploads/2025/11/Scaling-LinkedIns-search-infrastructure-Key-decisions-and-engineering-challenges-Rahul-Raja-StaffPlus-New-York-2025.pdf)
- [The Tail at Scale — summary by Adrian Colyer](https://blog.acolyer.org/2015/01/15/the-tail-at-scale/) · [Request hedging write-up (DEV)](https://dev.to/gabrielanhaia/request-hedging-the-tail-at-scale-technique-most-teams-skip-2j37) · primary: research.google/pubs/pub40801
- [Elasticsearch: eager global ordinals](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/eager-global-ordinals)
- [pylon-storage: SQLite FTS5 + Roaring bitmap facets (project source)](https://docs.rs/crate/pylon-storage/latest/source/src/search_query.rs)
- [Indeed: From 1 to 1 Billion — evolution of a document serving system](https://engineering.indeedblog.com/blog/2013/03/from-1-to-1-billion-part-1/)
- [Glassdoor: building a nearline system for scale and performance](https://medium.com/glassdoor-engineering/building-a-nearline-system-for-scale-and-performance-part-ii-9e01bf51b23d)
- [ParadeDB: faceting concepts](https://www.paradedb.com/learn/search-concepts/faceting)

# D193-5 · The data-engineering roadmap, as a route and a landing page (for the owner's review)

*46z, 2026-11-20. A DRAFT: nothing is added or published. A guided route is DATA a person adds in Admin (Atlas → the
circle's review → Routes, `learn_routes`), and a public page publishes, so both wait for the owner's word.*

## The stations, and what Atlas already has for each
The reels' roadmap (D193 gap 4): SQL → Python → Git & Linux → data modelling → warehousing → ETL / ELT → Spark →
Databricks → cloud → Airflow → Kafka → end-to-end projects. All but two stations are already covered by approved decks
(the data pathway) and course pieces (*From silicon to software*):

| # | Station | Course piece (the circle) | Approved decks |
|---|---|---|---|
| 1 | SQL | `b1` SQL and the relational model | `da-f-01` SQL in depth · `da-iv-01` SQL rounds |
| 2 | Python | `c3` Python and practical programming | `da-f-03` Python for data |
| 3 | Git and Linux | `c5` The programmer's toolkit · `lx1` Linux in depth | — |
| 4 | Data modelling | `b2` Inside a database | `da-f-02` grain and star schemas · `da-p-03` slowly changing dimensions |
| 5 | Warehousing | — | `da-b-03` Warehouses and lakes · `da-p-05` the semantic layer |
| 6 | ETL / ELT | — | `da-b-04` dbt and testing · `da-p-01` idempotent pipelines · `da-f-05` data quality · `da-b-05` change data capture |
| 7 | Spark | — | **none: a new deck** |
| 8 | Databricks | — | **none.** A vendor platform: per the register's rule it's a *Try it on* beside other vendors' equivalents, not a station of its own. Proposed: fold into 7 as "Spark on a managed platform". |
| 9 | Cloud | `o4` VMs, containers and the cloud | `cl-b-05` cloud building blocks |
| 10 | Airflow | — | `da-b-02` Orchestration |
| 11 | Kafka | `x2` System design (queues) | `da-b-06` Kafka · `da-b-01` batch and streaming · `da-p-02` late data |
| 12 | End-to-end projects | — | `da-c-01` A revenue pipeline · `da-c-02` product event analytics |

## (a) The route: one row in Admin
- **id** `data-engineering` · **name** *Data engineering roadmap* · **targets** `["b1","c3","c5","lx1","b2","o4","x2"]`
  (the course pieces, in station order; the route then lights those pieces and the decks above hang off them).
- It's added in Admin, not by a migration, the same way the four seeded routes can be edited.

## (b) The landing page: `/learn/data-engineering-roadmap` (D185-6's public shape)
- Title *Data engineering roadmap 2027*, one line per station (the table above, in plain words), each linking its deck
  (public, `/atlas/library/<deck>`), and *Sign up to keep learning* at the end. No numbers that aren't measured.
- Server-rendered like `services/jobs/landingPages.js` (canonical, JSON-LD `ItemList` of the decks, the sitemap).
- With D194, the page's preview plays the first deck's first three points (Read mode, muted), then the sign-up line.

## What the owner decides
1. Add the route (a) as written, or change its pieces.
2. Publish the landing page (b). The agent builds it on the owner's yes.
3. A new Spark deck (station 7), and whether Databricks is folded into it.

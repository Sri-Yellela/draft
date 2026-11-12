# A187 Stage 1 — design for the owner, with prices (46i, 2026-11-12)

**Status: a proposal. Nothing is bought or built.** It answers the owner's 11-11 question (*"we need to think of scale too … how do big players do it"*) for the step after Stage 0. The capacity model and how large job sites do it are in WORKLOG ▶▶▶ 46g, A187. Prices were looked up on 2026-11-12 and are approximate. Re-check them on each vendor's own pricing page before deciding.

## 1. Why Stage 1, and when

Measured, not assumed (re-measure before quoting):

| Limit | Evidence | When it bites |
|---|---|---|
| **One main thread** serves every request | Staging 20e / 20f profiles: the main thread is ~100 % busy for the whole 20-user load window (`boardPageResponse`, `requireAuth`, Your skills, sponsorship signals). More read workers make warm throughput **worse** (2 → 6 workers: 12,547 → 10,848 requests a minute). | Roughly 1,000 people active at once (≈ 110 req / s on staging) |
| **Every deploy is an outage** | One SQLite file on one volume. Railway stops the old container before the new one starts. 11-12 00:33Z: ~30 s of 502s. 11-11 21:04Z: the owner's Approve failed in that window. | Now (each push) |
| **Storage grows users × postings** | ~34 MB a user in stored reports at 100k postings (A187). Stage 0's score-only storage cuts this to ~3–5 MB. | ~1k users on this 45 GB volume without Stage 0; ~10k with it |
| **One SQLite writer** | All writes are serialised. A 6 GB synchronous backup froze the site for ~2 h (A186, fixed with online backup). | The write rate grows with users × new postings |

**Trigger to start Stage 1:** any of the following. Sustained > 300 people active at once. The owner wants zero-downtime deploys. Stage 0 is done and the volume passes 70 %.

## 2. What Stage 1 changes

1. **SQLite → managed Postgres.** The data lives outside the app container, so **two app instances** can run, and deploys roll over with no outage.
2. **Redis** holds the kept caches (board order, facets, the deck), the sessions and the per-user event fan-out (`emitToUser`, 20 call sites). Today these are in-process maps, so a second instance would not see them, and a deploy empties them (the cold first loads, 1.9–2.4 s each on staging).
3. **Board search and facets:** first **Postgres + `pg_trgm` / full-text search**. Move to a search index (Typesense / Meilisearch / OpenSearch) only if Postgres cannot hold facets p95 ≤ 300 ms at 1M postings.
4. **Two app instances** behind Railway's proxy, with rolling deploys and health checks (`/api/version`).

## 3. Prices (approximate, 2026-11-12)

| Item | Option | Rate | Estimate for Stage 1's start |
|---|---|---|---|
| App instances | Railway (as today) | $20 / vCPU-month, $10 / GB RAM-month, $0.15 / GB-month volume, $0.05 / GB egress ([Railway docs](https://docs.railway.com/reference/pricing)) | 2 × (2 vCPU, 4 GB) ≈ 2 × $80 = **~$160 / month** at full use. Billed on use; today's 0.11 vCPU average would cost far less. |
| Postgres | **A — Railway Postgres** (a service on the same resource rates) | as above | 2 vCPU / 4 GB / 50 GB ≈ $40 + $40 + $7.50 = **~$90 / month** at full use |
| | **B — Neon** (serverless, scale to zero) | Launch $0.106 / CU-hour (1 CU ≈ 4 GB), storage $0.35 / GB-month ([Neon](https://neon.com/blog/why-we-no-longer-lock-premium-features)) | 1 CU always on ≈ 730 h × $0.106 ≈ $77 + 50 GB × $0.35 ≈ $18 = **~$95 / month** |
| Redis | Railway Redis service | resource rates | 0.5 vCPU / 1 GB ≈ **~$20 / month** |
| Search index (only if Postgres falls short) | Typesense Cloud | from ~$0.05–0.06 / hour for the smallest cluster (≈ $40–45 / month; third-party figures, [Typesense billing](https://cloud-help.typesense.org/article/billing-process)) | **$0 at first** (Postgres FTS); ~$45–150 / month if needed |

**Stage 1 total: about $250–300 / month at full use**, on top of today's bill. It is likely lower in practice, because Railway bills the vCPU and RAM actually used. Staging adds a smaller copy (~$20–40 / month).

Not chosen: AWS RDS / ElastiCache (more to run and a second vendor, for no gain at this size) and Supabase (a whole platform, when only the database is needed).

## 4. The migration: the real cost is code, not hosting

- **2,906 `db.prepare(` calls in 275 files** (re-measured 11-12 across `server.js`, `routes`, `services`, `shared`, `scripts`, `packages`) are **synchronous** better-sqlite3 calls. Postgres clients are asynchronous, so **every caller becomes `async`**, along with every function that calls those callers. This is the bulk of the work.
- SQL dialect: `unixepoch()`, `INSERT OR IGNORE`, `ON CONFLICT … excluded`, JSON functions, the registered SQL functions (`boardSearch`, score freshness, description basis — A72 / A85 / D59) and `rowid` walks all need Postgres equivalents.
- The 270 migrations become one Postgres schema plus a one-time data copy, rehearsed on staging with the 100k fixture.
- Kept caches and sessions move to Redis. The event fan-out uses Redis pub/sub.

**Sequencing:**
1. Run a data-access layer in front of SQLite while the site stays on SQLite, converting module by module, async first.
2. Run Postgres in staging and copy data across nightly.
3. Run both side by side on staging with the scale suite.
4. Cut over in a planned window, with backups on both sides.
5. Add the second app instance and rolling deploys.

Estimate: **several weeks of agent sessions**. The async conversion touches most of the server, so each module needs its own tests green and a scale-suite run.

## 5. What the owner decides

1. **When to start Stage 1** — at a trigger in §1, or now for zero-downtime deploys.
2. **Postgres A (Railway) or B (Neon).** The agent recommends **A**: one vendor, one network, staging on the same pattern, and price parity at this size.
3. **The monthly budget** (§3: ~$250–300 at full use) and a cap.
4. Until then, **Stage 0** continues: score-only storage, `DRAFT_READ_WORKERS_SIZE=4` on production (measured, ▶▶▶ 46i) and the flags table.

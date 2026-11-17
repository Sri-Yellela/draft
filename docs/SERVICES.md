# SERVICES — the service catalogue (D173 (5))

Every running service, who owns it, what it calls and what calls it, how to tell it is healthy, and the targets it
is held to. Extends D151 Rule 6 (the deploy's ready gate) and D171 (who started it, which key paid).

**Measured 2026-11-07 (45h):** Railway's project list (MCP `list-projects` / `list-services`), the live endpoints
(`curl`), and the code at `3983e94`. ⚠ The targets column is the agreed bar, not a measured SLO — the "measured" column
says where today's figure came from.

| Service | Where it runs | Owner | Calls | Called by | Health | Targets (measured) |
|---|---|---|---|---|---|---|
| **draft** (the web app, jobsviadraft.com) | Railway project `resume-master`, service `draft`, one container on a volume (SQLite) — deploys do NOT overlap (memory: the old container stops first) | the owner | the tools service · Anthropic (cover letters, suggestions) · job boards / SerpApi / Adzuna · Resend · Google (sign-in, Gmail) · the browser push services | browsers · the extension · the crawler (lease / result) · the apply worker (lease) · connectors (BYOM) | `GET /api/health/ready` (Railway's healthcheck; 503 while warming) · `GET /api/version` (commit, migrations, `readPool`, `atsWeights`, `classify`) | ready after a deploy < 60 s (11-07: `3983e94` started 05:24:27Z, the classify pass done 05:25:02Z) · `/api/jobs` p50 < 1 s (⚠ 11-06 23:57Z: 4.6 s for the owner during the boot board-fit) · `readPool.fallback` 0 |
| **the tools service** (Resume Master, resumemaster.one) | Railway project `resume-master`, service `resume-master`; no database | the owner | Anthropic (its own key) | draft (`services/toolsService.js`, bearer token) · its own site | `GET /v1/version` | generate p95 < 60 s · `resume_claim_violation` rate watched (D175 FA7) |
| **the crawler** | Railway project `resume-master`, service `crawler`; no database, no user data, no model | the owner | public company sites and job boards (rules of engagement, `docs/CRAWLER_WORKER.md`) · draft (`/api/crawler/*`, signed results) | — (it leases from draft) | `GET /health` on its own port · draft's `GET /api/crawler/status` (the kill switch) | a paused answer stops a task within one page |
| **the apply worker** | ⚠ **not deployed** — designed for its own Railway project (`docs/APPLY_WORKER.md` §1); the second project (`vibrant-tenderness`) has no services at 11-07 | the owner | draft (lease), employer portals | — | — | — |
| **Atlas** | inside draft (`routes/atlas*`, the Atlas queue) — not a separate service | the owner | — | draft's pages | `/api/version` → `atlasQueue` | the live-count queue drains in the background (A121, 44p) |

## One request id across services

**`x-request-id`** follows one piece of work from draft to the tools service:

- **draft** gives every request an id (`services/requestContext.js`: the caller's `x-request-id` when it is a plain
  token, else a fresh UUID), answers with it in the `x-request-id` response header, and runs each application run's job
  inside `run<runId>-job<jobId>` — so every log line of one application carries the same id.
- **draft → the tools service:** `services/toolsService.js` sends the current id as `x-request-id` on every call.
- **the tools service** logs it as `rid` on its request line and echoes it back (`src/http/app.js`, `requestIdOf`);
  a missing or malformed id gets none — it never invents one.
- **to follow one application:** Railway logs → draft service → filter `run<runId>-job<jobId>`; then the
  resume-master service → filter the same string.

Tests: draft `d173RequestIdAcrossServices`, resume-master `d173RequestIdAcrossServices`.

⚠ **Not yet carried:** the model provider's own request id (Anthropic's `request-id` response header) is logged by
draft on a failed call (`errorRequestId`) but not tied to the draft id on success; the crawler's leases carry their
task id, not a request id.

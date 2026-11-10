// services/hirebase/ingest.js — ⭐ HB-5 + HB-6 (D187 HB-INFRA): one Hirebase job → landed, deduped, into draft's ONE pipeline.
//
//   landHirebaseJob(db, job, { runId }) → { action: 'new' | 'merged' | 'dropped', jobId?, outOfMarket?, reason? }
//
// (0) LAND — hirebase_raw holds the payload as it may be stored (mapJob's sanitize: no contact fields, no scores).
// (1) THE CRAWL WINS — Hirebase's platform_job_id is the source ATS's own id, and a crawled posting's job_id is
//     `<ats>::<that id>` (normalizeJob), so `${job_board}::${platform_job_id}` names our own copy when we crawl it: that
//     row is NOT rewritten — only its empty platform_job_id / first_ingested are filled (enrichment, never replacement).
// (2) EVERYTHING ELSE goes through services/jobs/jobGateway.js ingestJob (origin "hirebase") — the SAME deduper
//     (reconcileFingerprint: a match on company + title + location attaches, and the existing row stays as it was),
//     the same canonical write and the same US-only gate as every crawled source. No new processing: the taxonomy,
//     level, ghost, liveness and scoring passes read the row as they read any other (HB-6).
// (3) IDEMPOTENT — the same _id twice is the same `hirebase::<_id>` row (and the same hirebase_raw row).
import { normalizeHirebaseJob, HIREBASE_SOURCE } from "./mapJob.js";
import { ingestJob } from "../jobs/jobGateway.js";

export const HIREBASE_ORIGIN = "hirebase";

export function landHirebaseJob(db, job, { runId = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const mapped = normalizeHirebaseJob(job);
  if (!mapped) return { action: "dropped", reason: "incomplete" };
  const { posting, extras, raw } = mapped;
  db.prepare(`INSERT INTO hirebase_raw (hb_id, payload_json, first_ingested, md5_hash, fetched_at, run_id) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(hb_id) DO UPDATE SET payload_json = excluded.payload_json, first_ingested = COALESCE(excluded.first_ingested, first_ingested),
      md5_hash = excluded.md5_hash, fetched_at = excluded.fetched_at, run_id = excluded.run_id`)
    .run(extras.source_id, JSON.stringify(raw), extras.first_ingested, extras.md5_hash, now, runId);

  // (1) our own crawled copy, by the source ATS's own id
  const crawledId = extras.job_board && extras.platform_job_id ? `${extras.job_board}::${extras.platform_job_id}` : null;
  const crawled = crawledId ? db.prepare("SELECT job_id FROM scraped_jobs WHERE job_id = ?").get(crawledId) : null;
  if (crawled) {
    enrich(db, crawled.job_id, extras, { ownRow: false });
    return { action: "merged", jobId: crawled.job_id, matchedBy: "platform_job_id" };
  }
  // (2) the one gateway
  const r = ingestJob(db, { job: posting, origin: HIREBASE_ORIGIN, matchedBy: "hirebase", searchQuery: "hirebase", sourceLabel: "Hirebase", now });
  const ownRow = r.action === "inserted";
  enrich(db, r.jobId, extras, { ownRow });
  return { action: ownRow ? "new" : "merged", jobId: r.jobId, outOfMarket: !!r.outOfMarket, matchedBy: ownRow ? null : "fingerprint" };
}

/** Fill what Hirebase adds. Its own row gets its source link; a crawled row only gets EMPTY fields filled. */
function enrich(db, jobId, extras, { ownRow }) {
  try {
    if (ownRow) {
      db.prepare(`UPDATE scraped_jobs SET source_id = ?, platform_job_id = COALESCE(platform_job_id, ?), first_ingested = COALESCE(first_ingested, ?)
        WHERE job_id = ? AND source = ?`).run(extras.source_id, extras.platform_job_id, extras.first_ingested, jobId, HIREBASE_SOURCE);
    } else {
      db.prepare(`UPDATE scraped_jobs SET platform_job_id = COALESCE(platform_job_id, ?), first_ingested = COALESCE(first_ingested, ?) WHERE job_id = ?`)
        .run(extras.platform_job_id, extras.first_ingested, jobId);
    }
  } catch (e) { console.warn(`[hirebase] enrich ${jobId}: ${e.message}`); }
}

/** HB-7 expired feed: a listing Hirebase reports expired → our Hirebase-only row is retired (a crawled row is the crawl's). */
export function retireExpiredHirebaseJob(db, hbId, { now = Math.floor(Date.now() / 1000) } = {}) {
  return db.prepare(`UPDATE scraped_jobs SET is_active = 0, retired_reason = COALESCE(retired_reason, 'hirebase_expired'), retired_at = COALESCE(retired_at, ?)
    WHERE source = ? AND source_id = ? AND is_active = 1`).run(now, HIREBASE_SOURCE, String(hbId)).changes;
}

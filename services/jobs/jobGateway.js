// ── A62: ONE GATEWAY FOR JOB DATA IN ───────────────────────────────────────────────────────────
//
// Owner, 10-02 (a plan restated): job data in and out at will, AND the jobs a user brings in go
// through the same gateway every other source uses. ⛔ Never a second writer — Shape 1, the defect
// this codebase keeps finding (a new source bypassing the deduper). So this module calls the ONE
// deduper (reconcileFingerprint), the ONE canonical write (upsertCanonicalJob) and queue 37's ONE
// US-only gate (holdOutOfMarket, via gateOutOfMarket) — it adds no rule of its own, only the record.
//
// Callers: services/jobs/importJob.js (extension capture, imported URL, pasted text) and the admin
// job-data import (routes/jobData.js). Each ingestion writes one job_captures row (migration 122):
// what came in, from where, which ATS host + slug its URL names (A45's harvest), and what the
// gateway did — inserted, or ATTACHED to a row already on the board (A49 #4: it attaches and says
// so), and whether the US-only gate held it out.
import {
  reconcileFingerprint, upsertCanonicalJob, fingerprintJob, gateOutOfMarket, previewFingerprint, SOURCE_LABELS,
} from "./aggregator.js";
import { classifyJob } from "./classifyJob.js";
import { usEligibility, officeLocations } from "./usLocation.js";

export const CAPTURE_ORIGINS = Object.freeze(["capture", "import_url", "paste", "admin_import"]);

/** The ATS + board slug a posting URL names, or nulls — the same matchers the importer reuses. */
export function atsSlugOf(url, detectKnownAtsMatch) {
  const m = url && detectKnownAtsMatch ? detectKnownAtsMatch(url) : null;
  if (!m) return { ats_type: null, ats_slug: null };
  return { ats_type: m.type, ats_slug: m.slug ?? m.tenant ?? null };
}

function recordCapture(db, row) {
  db.prepare(`
    INSERT INTO job_captures (user_id, job_id, url, ats_type, ats_slug, origin, action, out_of_market, batch_id)
    VALUES (@user_id, @job_id, @url, @ats_type, @ats_slug, @origin, @action, @out_of_market, @batch_id)
  `).run(row);
}

/**
 * Ingest one normalised job. Returns { jobId, action: 'inserted' | 'attached', outOfMarket }.
 *
 * @param job      a normalised job (services/jobs/schema.js shape: id, title, company, url, source…)
 * @param origin   one of CAPTURE_ORIGINS
 * @param gate     apply the US-only gate to a NEWLY inserted row (a row it attaches to keeps its own
 *                 market status). On for every caller today; a parameter so the rule is visible.
 */
export function ingestJob(db, { job, origin, userId = null, batchId = null, matchedBy, searchQuery,
                                sourceLabel = null, detectKnownAtsMatch = null, gate = true,
                                now = Math.floor(Date.now() / 1000) }) {
  if (!CAPTURE_ORIGINS.includes(origin)) throw new Error(`unknown capture origin ${origin}`);
  // Informational tagging only — never gates (an explicit import must never silently vanish).
  const verdict = classifyJob(job.title || "", job.description || "", job.company || "");
  const jobForDedup = { ...job, company_icon_url: job.thumbnail || job.company_icon_url || null };
  const dedup = reconcileFingerprint(db, jobForDedup);

  let jobId, action, outOfMarket = false;
  if (dedup.action === "insert_canonical") {
    const canonical = dedup.job;
    upsertCanonicalJob(db, {
      jobId: job.id, canonical, verdict, dedup, now,
      contentHash: fingerprintJob(canonical),
      searchQuery: searchQuery || origin,
      sourceLabel: sourceLabel || SOURCE_LABELS[canonical.source] || SOURCE_LABELS.import,
      matchedBy: matchedBy || origin,
    });
    jobId = job.id;
    action = "inserted";
    // Queue 37: the board admits only postings with positive US evidence. A capture outside the US
    // is held off the SHARED board (demoted, logged in rejected_jobs) exactly as a crawled one is;
    // the caller still attaches it to the user and must say why it is not on the board.
    if (gate) outOfMarket = gateOutOfMarket(db, canonical, jobId, now);
  } else {
    jobId = dedup.intoJobId;
    action = "attached";
  }
  try {
    recordCapture(db, {
      user_id: userId, job_id: jobId, url: job.url || job.apply_url || null,
      ...atsSlugOf(job.apply_url || job.url, detectKnownAtsMatch),
      origin, action, out_of_market: outOfMarket ? 1 : 0, batch_id: batchId,
    });
  } catch (e) {
    // A database without migration 122 still ingests; the record is the only thing lost.
    console.warn(`[jobGateway] capture not recorded for ${jobId}: ${e.message}`);
  }
  return { jobId, action, outOfMarket };
}

/** Read-only: what ingestJob WOULD do with this job — for an import's dry run. */
export function previewIngest(db, job) {
  const p = previewFingerprint(db, { ...job, company_icon_url: job.thumbnail || job.company_icon_url || null });
  const market = usEligibility({ location: job.location, description: job.description, offices: officeLocations(job._raw) });
  return {
    action: p.action === "fold" ? "attach" : p.action,
    existingJobId: p.existingJobId,
    // Only an inserted row is gated; an attached one keeps the existing row's status.
    outOfMarket: p.action !== "fold" && !market.admit,
    marketReason: market.admit ? null : market.reason,
  };
}

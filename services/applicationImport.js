// ── D55 · IMPORT PAST APPLICATIONS INTO THE TABLE ────────────────────────────────────────────────────
//
// The file is read and validated by shared/applicationCsv.js (the panel previews with the same code).
// This adds the two things only the server can do — the duplicate check against the user's own
// history, and the write — and it is DRY RUN unless `apply` is true, so the panel shows exactly what
// will land before anything does.
//
// ⛔ WHAT LANDS: one SENT job_applications row per accepted line — company, title, the date it was
// sent, its outcome folded through mergeResponse (so furthest_stage ranks it like any other) — with
// auto_status 'imported' and source 'csv_import'. ⛔ NEVER a Draft (no apply_run_jobs), never a pending
// record (no application_records), and ⛔ NEVER AN ATS SCORE: ats_score_at_apply / ats_scorer_version
// are NULL, because no résumé of ours was scored against that posting and a guessed number would poison
// the dataset AK1 exists to validate. first_response_at is the file's reply date or NULL — the import
// time is not when the employer replied.
//
// ⛔ DUPLICATES: the D54 COMPANY KEY + the title (shared/companyIdentity.js groupCompanies, run over the
// user's history AND the file together, so "STRIPE" in the file and "Stripe, Inc." in The Table are one
// company, and two same-named companies with different websites stay two). Never the display name.
import crypto from "node:crypto";
import { readImport, titleKey } from "../shared/applicationCsv.js";
import { mergeResponse } from "../shared/applicationResponse.js";
import { groupCompanies, companyNameKey } from "../shared/companyIdentity.js";
import { listHistory } from "./applicationRecords.js";

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * @returns {{ error?, detail?, applied, imported: [...], duplicates: [...], invalid: [...] }}
 */
export function importApplications(db, userId, { csv, mapping = {}, apply = false, now = nowSec() } = {}) {
  const file = readImport(csv, mapping, { now });
  if (file.error) return file;

  const existing = listHistory(db, userId, { now, limit: 100000 });
  let domainBy = new Map();
  try {
    domainBy = new Map(db.prepare("SELECT company, domain FROM company_logos WHERE domain IS NOT NULL").all()
      .map(r => [companyNameKey(r.company), r.domain]));
  } catch { /* no logo store: names and boards still key */ }
  const items = [
    ...existing.map(r => ({ id: `e:${r.jobId}`, company: r.company, url: r.applyUrl,
      domain: r.companyDomain ?? domainBy.get(companyNameKey(r.company)) ?? null })),
    ...file.candidates.map((c, i) => ({ id: `c:${i}`, company: c.company, url: c.url,
      domain: c.domain ?? domainBy.get(companyNameKey(c.company)) ?? null })),
  ];
  const { keyOf } = groupCompanies(items);

  const seen = new Map();   // companyKey|title → what holds it
  for (const r of existing) seen.set(`${keyOf.get(`e:${r.jobId}`)}|${titleKey(r.title)}`, { existing: true, jobId: r.jobId });
  const accepted = [], duplicates = [];
  file.candidates.forEach((c, i) => {
    const companyKey = keyOf.get(`c:${i}`);
    const k = `${companyKey}|${titleKey(c.title)}`;
    const hit = seen.get(k);
    if (hit) {
      duplicates.push({ row: c.row, company: c.company, title: c.title,
        reason: hit.existing ? "duplicate_existing" : "duplicate_in_file", ...(hit.existing ? {} : { firstRow: hit.row }) });
      return;
    }
    seen.set(k, { existing: false, row: c.row });
    accepted.push({ ...c, companyKey });
  });

  const imported = accepted.map(c => ({
    row: c.row, company: c.company, title: c.title, appliedAt: c.appliedAt, outcome: c.outcome,
    jobId: `import:${crypto.createHash("sha256").update(`${userId}|${c.companyKey}|${titleKey(c.title)}`).digest("hex").slice(0, 24)}`,
  }));
  if (!apply || !accepted.length) {
    return { applied: false, dryRun: !apply, imported, duplicates, invalid: file.invalid };
  }

  const ins = db.prepare(`
    INSERT INTO job_applications
      (user_id, job_id, company, role, job_url, source, location, apply_mode, applied_at, notes, auto_status,
       ats_score_at_apply, ats_scorer_version, ats_report_at_apply, ats_scored_at,
       response_outcome, furthest_stage, first_response_at, outcome_at, outcome_source, company_domain)
    VALUES (?, ?, ?, ?, ?, 'csv_import', ?, 'MANUAL', ?, ?, 'imported',
            NULL, NULL, NULL, NULL,
            ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, job_id) DO NOTHING
  `);
  let written = 0;
  db.transaction(() => {
    accepted.forEach((c, i) => {
      const m = c.outcome == null && c.repliedAt == null ? null : mergeResponse({}, { outcome: c.outcome, source: "import" }, { now });
      written += ins.run(
        userId, imported[i].jobId, c.company, c.title, c.url, c.location, c.appliedAt, c.notes,
        m?.response_outcome ?? null, m?.furthest_stage ?? null,
        // The file's reply date, or nothing — never the moment of the import.
        c.repliedAt ?? null,
        m ? now : null, m ? "import" : null,
        c.domain ?? null,
      ).changes;
    });
  })();
  return { applied: true, written, imported, duplicates, invalid: file.invalid };
}

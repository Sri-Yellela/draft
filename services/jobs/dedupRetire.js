// A49 fixes 4 and 5 — what happens to a row, and to the people who acted on it, when dedup decides
// it is a duplicate of another row.
//
// reconcileFingerprint (aggregator.js) is still the ONE deduper; this module is only what it does
// once it has decided. Before A49 that was a bare `UPDATE scraped_jobs SET is_active = 0`:
//
//   - fix 4: every user's Save, Pass, application, résumé and view stayed keyed to the demoted
//     job_id. The board reads the canonical row, so a Saved job vanished from Saved, a Passed job was
//     dealt again (a Pass is the persisted "never deal this again" decision), and an applied job read
//     as un-applied — the cleanup_log id-85 class, one row at a time. A user's state on a job_id that
//     FOLDED and so never got a row (a live-search result the user starred before write-back) was
//     worse: the 7-day cleanup's orphan cascade deletes user_jobs whose job_id has no scraped_jobs row.
//   - fix 5: nothing recorded WHY the row went inactive or WHICH row it was a duplicate of, so a
//     wrong merge could not be told from a closed listing, let alone undone; and the 7-day age
//     cleanup then hard-deleted it, because a demoted row's scraped_at is never refreshed.
//
// Now a retirement is a recorded, reversible act: the row is soft-retired with `duplicate_of`,
// `retired_reason` and `retired_at` (migration 116); the users' state moves to the canonical row;
// and job_dedup_log keeps exactly what moved, so restoreRetiredDuplicate can put it back and keep
// the two rows apart from then on.

export const RETIRED_AS_DUPLICATE = 'duplicate';

// Every per-user table keyed by job_id whose rows express something the user DID or OWNS for that
// posting. Logs (usage_events, apply_job_logs, apply_run_jobs, apply_gate_packets) are history and
// stay on the job_id they happened against — the retired row still exists, so they are not orphaned.
// `unique` is the table's UNIQUE key minus job_id: a row that would collide with the user's own row
// on the canonical is left where it is (the retired row survives, so nothing is lost) — except
// user_jobs, which is MERGED, because two disagreeing decision rows for one posting is the bug.
const MOVABLE_TABLES = ['job_applications', 'resumes', 'resume_versions', 'user_job_views', 'ats_only_reports'];

const presentCache = new WeakMap();
function presentTables(db) {
  let set = presentCache.get(db);
  if (!set) {
    set = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));
    presentCache.set(db, set);
  }
  return set;
}

/**
 * One user's two decision rows for the same posting, merged into one. Nothing is dropped:
 * applied / visited / resume_generated are facts and OR together; starred and disliked are the
 * user's verdict, and when the two rows DISAGREE (saved one copy, passed the other) the more
 * recent decision wins — the user's latest word on the posting, not an arbitrary one. The
 * canonical row's profile tag wins, the duplicate's fills a blank.
 */
export function mergeUserJobRows(canonical, duplicate) {
  const or = (k) => (Number(canonical[k]) || Number(duplicate[k])) ? 1 : 0;
  const verdict = (r) => (Number(r.starred) ? 'starred' : Number(r.disliked) ? 'disliked' : null);
  const a = verdict(canonical), b = verdict(duplicate);
  let starred = or('starred'), disliked = or('disliked');
  if (a && b && a !== b) {
    const latest = (Number(duplicate.updated_at) || 0) > (Number(canonical.updated_at) || 0) ? duplicate : canonical;
    starred = Number(latest.starred) ? 1 : 0;
    disliked = Number(latest.disliked) ? 1 : 0;
  }
  return {
    visited: or('visited'), applied: or('applied'), resume_generated: or('resume_generated'),
    starred, disliked,
    domain_profile_id: canonical.domain_profile_id ?? duplicate.domain_profile_id ?? null,
    updated_at: Math.max(Number(canonical.updated_at) || 0, Number(duplicate.updated_at) || 0) || null,
  };
}

/**
 * Moves every user's state from one job_id to another. Returns what moved, in a shape
 * restoreRetiredDuplicate can reverse, or null when there was nothing to move.
 */
export function moveUserState(db, fromJobId, toJobId) {
  if (!fromJobId || !toJobId || fromJobId === toJobId) return null;
  const present = presentTables(db);
  const moved = { user_jobs_moved: [], user_jobs_merged: [] };
  let any = false;

  if (present.has('user_jobs')) {
    const cols = db.prepare('PRAGMA table_info(user_jobs)').all().map(c => c.name);
    const rows = db.prepare('SELECT * FROM user_jobs WHERE job_id = ?').all(fromJobId);
    for (const row of rows) {
      const target = db.prepare('SELECT * FROM user_jobs WHERE user_id = ? AND job_id = ?').get(row.user_id, toJobId);
      if (!target) {
        db.prepare('UPDATE user_jobs SET job_id = ? WHERE id = ?').run(toJobId, row.id);
        moved.user_jobs_moved.push(row.id);
      } else {
        const m = mergeUserJobRows(target, row);
        const sets = Object.keys(m).filter(k => cols.includes(k));
        db.prepare(`UPDATE user_jobs SET ${sets.map(k => `${k} = @${k}`).join(', ')} WHERE id = @id`)
          .run({ ...Object.fromEntries(sets.map(k => [k, m[k]])), id: target.id });
        db.prepare('DELETE FROM user_jobs WHERE id = ?').run(row.id);
        // The duplicate's row is kept whole, so a restore can re-create it exactly.
        moved.user_jobs_merged.push({ into: target.id, row, target_before: target });
      }
      any = true;
    }
  }

  for (const t of MOVABLE_TABLES) {
    if (!present.has(t)) continue;
    const ids = db.prepare(`SELECT id FROM ${t} WHERE job_id = ?`).all(fromJobId).map(r => r.id);
    const done = [];
    for (const id of ids) {
      if (db.prepare(`UPDATE OR IGNORE ${t} SET job_id = ? WHERE id = ?`).run(toJobId, id).changes) done.push(id);
    }
    if (done.length) { moved[t] = done; any = true; }
  }
  return any ? moved : null;
}

/**
 * Soft-retires `fromJobId` as a duplicate of `toJobId`, moves its users' state to `toJobId`, and
 * logs both. Idempotent: a row already retired into the same canonical with no user state left on
 * it is a no-op (the unchanged-crawl path calls this for every merged posting on every crawl).
 * A job_id with no scraped_jobs row still has its user state moved — see the header.
 */
export function retireDuplicate(db, { fromJobId, toJobId, reason = RETIRED_AS_DUPLICATE, now = Math.floor(Date.now() / 1000) }) {
  if (!fromJobId || !toJobId || fromJobId === toJobId) return { retired: false, moved: null };
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM scraped_jobs WHERE job_id = ?').get(fromJobId);
    let retired = false;
    if (row && (Number(row.is_active) === 1 || row.duplicate_of !== toJobId)) {
      db.prepare(`
        UPDATE scraped_jobs SET is_active = 0, duplicate_of = ?, retired_reason = ?, retired_at = ?
        WHERE job_id = ?
      `).run(toJobId, reason, now, fromJobId);
      retired = true;
    }
    const moved = moveUserState(db, fromJobId, toJobId);
    if ((retired || moved) && presentTables(db).has('job_dedup_log')) {
      db.prepare(`
        INSERT INTO job_dedup_log (from_job_id, to_job_id, reason, moved_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(fromJobId, toJobId, reason, moved ? JSON.stringify(moved) : null, now);
    }
    return { retired, moved };
  })();
}

/**
 * True when someone has restored `a` and `b` apart — dedup must not merge them again, or a restore
 * would last exactly until the next crawl.
 */
export function keptApart(db, a, b) {
  if (!a || !b || !presentTables(db).has('job_dedup_log')) return false;
  return !!db.prepare(`
    SELECT 1 FROM job_dedup_log
    WHERE restored_at IS NOT NULL
      AND ((from_job_id = ? AND to_job_id = ?) OR (from_job_id = ? AND to_job_id = ?))
    LIMIT 1
  `).get(a, b, b, a);
}

/**
 * Undoes a retirement: the row is active again, the user state that moved goes back, and the pair
 * is recorded as kept apart. Returns { restored, from, into } or { restored: false, reason }.
 */
export function restoreRetiredDuplicate(db, jobId, { now = Math.floor(Date.now() / 1000) } = {}) {
  return db.transaction(() => {
    const row = db.prepare('SELECT job_id, duplicate_of FROM scraped_jobs WHERE job_id = ?').get(jobId);
    if (!row) return { restored: false, reason: 'no such row' };
    if (!row.duplicate_of) return { restored: false, reason: 'not retired as a duplicate' };
    const into = row.duplicate_of;
    const logs = db.prepare(`
      SELECT * FROM job_dedup_log WHERE from_job_id = ? AND restored_at IS NULL ORDER BY id DESC
    `).all(jobId);
    for (const log of logs) {
      const moved = log.moved_json ? JSON.parse(log.moved_json) : null;
      if (!moved) continue;
      for (const id of moved.user_jobs_moved || []) {
        db.prepare('UPDATE OR IGNORE user_jobs SET job_id = ? WHERE id = ? AND job_id = ?').run(jobId, id, log.to_job_id);
      }
      for (const { into: targetId, row: original, target_before: before } of moved.user_jobs_merged || []) {
        const cols = Object.keys(original).filter(k => k !== 'id');
        db.prepare(`INSERT OR IGNORE INTO user_jobs (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          .run(...cols.map(k => original[k]));
        // The canonical row goes back to what the user had on it before the merge — but only the
        // columns the merge wrote, and only if nothing has touched it since.
        if (before) {
          const cur = db.prepare('SELECT * FROM user_jobs WHERE id = ?').get(targetId);
          const merged = mergeUserJobRows(before, original);
          const untouched = cur && Object.keys(merged).every(k => !(k in cur) || cur[k] == merged[k]);
          if (untouched) {
            const sets = Object.keys(merged).filter(k => k in cur);
            db.prepare(`UPDATE user_jobs SET ${sets.map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
              .run(...sets.map(k => before[k]), targetId);
          }
        }
      }
      for (const t of MOVABLE_TABLES) {
        for (const id of moved[t] || []) {
          db.prepare(`UPDATE OR IGNORE ${t} SET job_id = ? WHERE id = ? AND job_id = ?`).run(jobId, id, log.to_job_id);
        }
      }
    }
    db.prepare('UPDATE job_dedup_log SET restored_at = ? WHERE from_job_id = ? AND restored_at IS NULL').run(now, jobId);
    db.prepare(`
      UPDATE scraped_jobs SET is_active = 1, duplicate_of = NULL, retired_reason = NULL, retired_at = NULL
      WHERE job_id = ?
    `).run(jobId);
    // Record the decision even when nothing had moved, so keptApart() sees it.
    if (!logs.length) {
      db.prepare(`
        INSERT INTO job_dedup_log (from_job_id, to_job_id, reason, moved_json, created_at, restored_at)
        VALUES (?, ?, ?, NULL, ?, ?)
      `).run(jobId, into, RETIRED_AS_DUPLICATE, now, now);
    }
    return { restored: true, from: jobId, into };
  })();
}

// services/payloadParts.js — ⭐ A198 (46j, owner 11-13: "make sure once any part of the payload is made its retained and
// recorded as such, like an idempotency key, so that the loop doesnt fail").
//
// Every piece a run MAKES for one person × one posting is kept under (user_id, job_id, kind, part_key) — migration 274 —
// and every later run of that job reads it back instead of making it again:
//   kind 'answer'        part_key = the question, normalised  → the drafted free-text answer or the picked option
//   kind 'cover_letter'  part_key = 'html'                    → the cover letter's HTML (made into a PDF per run)
// The résumé is already kept per job (the resumes table; resumeCurrency decides reuse) and the person's own answers in
// their profile (custom_answers) — those stay where they are.
//
// FIRST WRITE WINS (INSERT OR IGNORE): a piece, once made, is the piece. A run that races another for the same question
// keeps whichever was recorded first, so two runs of one job never send two different answers to the same question.
// A table that does not exist yet (an un-migrated copy) degrades to "nothing kept" — never a failed run.

export const PART_KINDS = Object.freeze({ ANSWER: "answer", COVER_LETTER: "cover_letter" });

/** The key a question is kept under: case, spacing and a trailing * : ? . ! are not words. */
export const partKeyOf = (question) => String(question || "").toLowerCase().replace(/[\s*:?.!]+$/g, "").replace(/\s+/g, " ").trim();

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

/** The kept answers for this person × posting: { [question as first recorded]: value }. */
export function keptAnswers(db, { userId, jobId }) {
  return safe(() => {
    const out = {};
    for (const r of db.prepare(`SELECT value, source FROM apply_payload_parts WHERE user_id = ? AND job_id = ? AND kind = 'answer'`)
      .all(userId, String(jobId))) {
      const v = JSON.parse(r.value);
      if (v && typeof v.question === "string" && typeof v.answer === "string" && v.answer) out[v.question] = v.answer;
    }
    return out;
  }, {});
}

/** Keep answers just made (first write wins). Returns how many were newly kept. */
export function keepAnswers(db, { userId, jobId, answers, source = "drafted", runJobId = null }) {
  return safe(() => {
    const ins = db.prepare(`INSERT OR IGNORE INTO apply_payload_parts (user_id, job_id, kind, part_key, value, source, run_job_id)
                            VALUES (?, ?, 'answer', ?, ?, ?, ?)`);
    let n = 0;
    db.transaction(() => {
      for (const [question, answer] of Object.entries(answers || {})) {
        const key = partKeyOf(question);
        if (!key || answer == null || String(answer) === "") continue;
        n += ins.run(userId, String(jobId), key, JSON.stringify({ question, answer: String(answer) }), source, runJobId).changes;
      }
    })();
    return n;
  }, 0);
}

/**
 * ⭐ A198 (2) (46j, owner 11-13: "its still asking these questions, i answered a short while ago"): the PERSON's answers for
 * this job — kept every time they answer (whatever "Save for next time" says), and a later answer to the same question
 * REPLACES the earlier one (a correction is theirs to make). Returned separately so a run feeds them in as the person's own
 * answers (custom_answers — exact-question, so even an eligibility question takes it), not as a draft.
 */
export function keepPersonAnswers(db, { userId, jobId, answers }) {
  return safe(() => {
    const up = db.prepare(`INSERT INTO apply_payload_parts (user_id, job_id, kind, part_key, value, source)
                           VALUES (?, ?, 'answer', ?, ?, 'person')
                           ON CONFLICT(user_id, job_id, kind, part_key) DO UPDATE SET value = excluded.value, source = 'person', created_at = unixepoch()`);
    let n = 0;
    db.transaction(() => {
      for (const [question, answer] of Object.entries(answers || {})) {
        const key = partKeyOf(question);
        if (!key || answer == null || String(answer).trim() === "") continue;
        n += up.run(userId, String(jobId), key, JSON.stringify({ question, answer: String(answer) })).changes;
      }
    })();
    return n;
  }, 0);
}

/** The kept answers split by who made them: { person: {q: a}, drafted: {q: a} }. */
export function keptAnswersBySource(db, { userId, jobId }) {
  return safe(() => {
    const out = { person: {}, drafted: {} };
    for (const r of db.prepare(`SELECT value, source FROM apply_payload_parts WHERE user_id = ? AND job_id = ? AND kind = 'answer'`)
      .all(userId, String(jobId))) {
      const v = JSON.parse(r.value);
      if (!v || typeof v.question !== "string" || typeof v.answer !== "string" || !v.answer) continue;
      (r.source === "person" ? out.person : out.drafted)[v.question] = v.answer;
    }
    return out;
  }, { person: {}, drafted: {} });
}

/** The kept cover letter's HTML, or null. */
export function keptCoverLetter(db, { userId, jobId }) {
  return safe(() => db.prepare(`SELECT value FROM apply_payload_parts WHERE user_id = ? AND job_id = ? AND kind = 'cover_letter' AND part_key = 'html'`)
    .pluck().get(userId, String(jobId)) ?? null, null);
}

/** Keep a cover letter just written (first write wins). */
export function keepCoverLetter(db, { userId, jobId, html, runJobId = null }) {
  if (!html) return 0;
  return safe(() => db.prepare(`INSERT OR IGNORE INTO apply_payload_parts (user_id, job_id, kind, part_key, value, source, run_job_id)
                                VALUES (?, ?, 'cover_letter', 'html', ?, 'written', ?)`).run(userId, String(jobId), String(html), runJobId).changes, 0);
}

/**
 * A cover letter for this person × posting: the kept one, else `write()` (→ { html }) once — and kept. The one helper every
 * run path uses, so a letter is written at most once per job.
 */
export async function coverLetterOnce(db, { userId, jobId, runJobId = null, write }) {
  const kept = keptCoverLetter(db, { userId, jobId });
  if (kept) return { html: kept, kept: true };
  const cl = await write();
  if (cl?.html) keepCoverLetter(db, { userId, jobId, html: cl.html, runJobId });
  return cl?.html ? { html: cl.html, kept: false } : cl;
}

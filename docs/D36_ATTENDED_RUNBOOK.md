# D36 — the attended runbook: ONE real application per path

⛔ **This is the owner's step, attended. A human approves every submit (AF5).** Nothing here is run by
an agent, and FULL AUTO is not on this list to run: it stays locked (`FULL_AUTO_PROVEN = false` in
`routes/apply.js`) until the owner decides otherwise after these four paths and AF5.

⛔ **ONE application first.** Do path 1 with one job, run the checks, and **confirm the
`job_applications` row before anything else is sent.** The score at apply is unrecoverable once the
applications are out. Only then do path 2 with one job, then path 3 with one job. Thirty applications
(AF5) come after all of it.

Everything below uses **synthetic placeholders** — `<job_id>`, `<you>`, "Northwind" — never a real
person's details. Run the SQL in the admin Database inspector (or `sqlite3` on a copy of the volume);
`<uid>` is your user id. Every check states what it should return; **any other answer is a stop.**

---

## 0 · Before the first one

| Check | How | Must be |
|---|---|---|
| The deployed build has D36 | `GET /api/version` | the commit that contains `fix(D36·7)` |
| Your sponsorship situation is STATED | Profile → Visa Sponsorship | one of the three options, not "Select…". ⛔ Unset now **holds and asks** — it is never answered for you |
| Clearance | Profile → clearance box | ticked only if you hold one; unticked is now "unknown", and a clearance question will be asked |
| Kill switch | `GET /api/admin/full-auto` | `{"disabled": false}` (else every Draft is refused with "paused by the operator") |
| AUTO is locked | Draft House run bar | AUTO greyed, *"Auto has never run unattended against a real employer."* |
| Caps | Draft House run bar | Previews / Approvals / Submitted with `used` you expect; Draft slots on the board |

```sql
-- 0a. nothing in flight
SELECT id, status, approval_mode FROM apply_runs WHERE user_id=<uid> AND status IN ('queued','running','waiting');
--     expect: no rows
-- 0b. FULL AUTO cannot be asked for (expect 403 full_auto_locked)
--     POST /api/apply/runs {"jobIds":["<job_id>"],"mode":"auto","approvalMode":"auto"}
```

**Stop if:** the sponsorship select is unset and you intend to apply to a form that asks it (it will
hold — answer it in Draft House, then continue), `/api/version` predates D36, or 0a returns rows.

---

## 1 · MANUAL — generate, review, apply on the employer's site yourself, record it

1. On the board, open ONE posting. **Generate** a résumé for it (uses 1 Draft slot — the board says so).
   - UI: the résumé opens; the job is tagged **Pending**.
2. Read the résumé. ⛔ Stop if it claims anything you never did (G1).
3. Apply on the employer's own site yourself, attaching that résumé. Keep the confirmation (page URL,
   email subject, or reference number).
4. The Table → Pending → the job → **Record**: when, how, and ONE piece of evidence.
   - UI must say **"Verified — it is in your Submitted applications."** If it says *"Recorded, not
     verified yet"*, add the evidence it names.

```sql
-- 1a. the generation was metered against THIS job, and the lift closed
SELECT id, event_type, job_id, ats_score_before, ats_score_after FROM usage_events
 WHERE user_id=<uid> AND event_type='resume_generate' ORDER BY id DESC LIMIT 1;
--     expect: job_id = '<job_id>', ats_score_after NOT NULL (NULL only if the scorer declined)
-- 1b. ⛔ THE ROW
SELECT id, job_id, apply_mode, auto_status, ats_score_at_apply, ats_scorer_version FROM job_applications
 WHERE user_id=<uid> AND job_id='<job_id>';
--     expect: one row, apply_mode MANUAL, auto_status verified, ats_score_at_apply NOT NULL, a version
-- 1c. the résumé that was sent is kept
SELECT ar.id, ar.state, aa.source FROM application_records ar
  LEFT JOIN application_artifacts aa ON aa.record_id = ar.id
 WHERE ar.user_id=<uid> AND ar.job_id='<job_id>';
--     expect: state verified, source snapshot_at_record;  The Table → Download résumé opens it
```

**Stop if:** 1b has no row, or `ats_score_at_apply` is NULL on a job you generated for. (NULL is
expected ONLY when you recorded a job you never generated for — there is then no report to stamp, and
no kept résumé: the download answers `artifact_missing`.)

---

## 2 · SEMI — Draft, preview, YOU approve, it submits

1. ONE job from a Greenhouse / Lever / Ashby posting. **Draft** it (deck D/→ or the board's Draft).
   - Toast: *"Drafted — it waits for your review — nothing is sent until you approve it."*
2. Draft House → wait for the preview. Expected outcomes, each a real stop until handled:
   - *"Filled and waiting for your approval"* → step 3.
   - A question (incomplete form / low confidence / an ATTESTATION) → answer it in Draft House; the
     retry previews again. ⛔ Answer eligibility questions yourself; nothing proposes them for you now.
3. **Review answers.** Every answer shows its rule. ⛔ Stop on any GUESS you would not send.
   Open **What we filled ↗** and read the form.
4. **Approve & send** (one job — not "Approve all").
   - Panel: *"Submitting 1 application."* — this is NOT "sent". Wait for the row.
5. Draft House / Runs: the job leaves Stopped; The Table shows it **Sent · waiting**.

```sql
-- 2a. the preview and the approved run, by id
SELECT id, run_id, status, reason_code, approved_at IS NOT NULL AS approved, approved_from_run_job_id,
       base_ats_score, resume_artifact_id, resume_ats_score, submit_verified, submit_evidence
  FROM apply_run_jobs WHERE user_id=<uid> AND job_id='<job_id>' ORDER BY id;
--     expect: preview row superseded + approved=1;  approved row status submitted, submit_verified 1,
--             submit_evidence like 'confirmation_page%' or 'url_changed%'
-- 2b. what was sent, field by field, with the rule for each
SELECT answers_json FROM apply_run_jobs WHERE id=<approved run-job id>;
--     read: provenance per field — handler_exact / field_map_exact / custom_answer / label_exact are
--     exact; label_fuzzy is a GUESS. ⛔ Any eligibility answer must be custom_answer or
--     sponsorship_derived (from YOUR stated situation), never label_fuzzy.
-- 2c. ⛔ THE ROW
SELECT id, apply_mode, auto_status, ats_score_at_apply, ats_scorer_version FROM job_applications
 WHERE user_id=<uid> AND job_id='<job_id>';
--     expect: apply_mode AUTO, auto_status verified, ats_score_at_apply NOT NULL
-- 2d. the record and the kept résumé (as 1c)
-- 2e. caps moved as the bar says: Approvals +1, Submitted +1; Draft slots +1 (an approval no longer refunds it)
```

**Stop if:** the approved row ends anything but `submitted` (read `reason_code` / `reason_detail` —
e.g. `resume_pdf_failed`, `answers_changed_since_approval`, `full_auto_disabled`, `submit_unverified`);
`submit_verified` is 0 (it clicked and could not confirm: check the employer's portal before anything
else); or 2c has no row / a NULL score.

---

## 3 · GATED HANDOFF — the extension fills a portal form under activeTab, YOU submit

1. ONE job whose portal needs a sign-in (Workday-shaped). **Draft** it.
   - Draft House: **"The employer's portal wants you signed in"** (held_gate). The handoff lists
     "N answers ready, M for you to answer".
2. Sign in to the portal yourself, reach the application form, invoke the extension (popup **Fill it**
   or Ctrl+Shift+Y).
   - ⛔ **The review overlay must appear**: *"Review before you submit"*, Eligibility first. If the
     popup instead says *"…but the review panel could not open"*, the answers were NOT laid out —
     check every field yourself, or stop.
   - ⚠ No résumé is attached on this path (the handoff never generates one). Attach yours.
3. Acknowledge every guess; answer work authorisation and sponsorship yourself (they are left blank).
4. **You** press the portal's submit. Keep the confirmation.
5. The Table → Pending: the job is there (tagged by the handoff) → **Record** it with the evidence.

```sql
-- 3a. the held run and its packet
SELECT rj.id, rj.status, rj.reason_code, p.id AS packet, p.gate_reason, p.consumed_at IS NOT NULL AS released,
       p.resume_artifact_id
  FROM apply_run_jobs rj JOIN apply_gate_packets p ON p.run_job_id = rj.id
 WHERE rj.user_id=<uid> AND rj.job_id='<job_id>';
--     expect: held_gate / login_required, released 1, resume_artifact_id NULL (no résumé on this path)
-- 3b. the overlay review was recorded (acknowledged / edited counts, never values)
SELECT gate_review_json FROM apply_run_jobs WHERE id=<run-job id>;
-- 3c. the job reached Pending at the handoff, then verified on your record
SELECT state, origin FROM application_records WHERE user_id=<uid> AND job_id='<job_id>';
--     expect: verified (origin draft)
-- 3d. ⛔ THE ROW
SELECT id, apply_mode, auto_status, ats_score_at_apply FROM job_applications
 WHERE user_id=<uid> AND job_id='<job_id>';
--     expect: one row, MANUAL, verified. ⚠ ats_score_at_apply is NULL on this path (nothing was
--     generated or scored for it) — known, reported in D36; record it and move on.
```

**Stop if:** the overlay does not appear; the extension fills anything into the sign-in form; or 3c
shows no row after you recorded.

---

## 4 · FULL AUTO — not run

⛔ Locked. `POST /api/apply/runs {approvalMode:"auto"}` and the answers retry's answer-and-send both
answer **403 full_auto_locked**, and a row that would send unattended is held **full_auto_locked**
before anything opens. It was walked only against the local fake ATS, in a scratchpad copy of the
route, by D36. Opening it is an owner decision after AF5 (D22).

---

## Stop conditions — any one ends the session

1. A `job_applications` row is missing, or its score is NULL where a résumé was generated.
2. Any eligibility answer (work authorisation, sponsorship, visa, clearance, citizenship, EEO) shown
   as a GUESS, or filled when you did not state it.
3. A screen says "sent" / "submitted" and the row is not `submitted` with `submit_verified = 1`.
4. A submit happened without your Approve press, or the extension pressed a submit.
5. The review overlay did not render on the gated path.
6. Anything typed into a sign-in or password box.
7. The kill switch (`PUT /api/admin/full-auto {"disabled":true}`) is your emergency stop: a job already
   being filled is held **before its submit click** (`full_auto_disabled`). ⚠ Your own ⏸ Stop everything
   still lets the one being filled finish — use **Abort** on that job instead.

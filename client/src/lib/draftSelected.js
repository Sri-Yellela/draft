// ── D112 a1 · "Draft selected" — the board's multi-select, one job at a time ────────────────────
//
// Owner, 10-30 (WORKLOG D112 item 9, a1): shift-click or a tick selects cards on the board, and
// "Draft selected (N)" drafts them. ⛔ A NOTICE FOR EACH DUPLICATE — not one combined notice (the
// assistant's recommendation; the owner's call): every selected job at a company where the user
// already has an application shows D54's per-company notice, one after another, each with
// Draft it / Skip. The others draft without a stop.
//
// This file is the SEQUENCE only — pure, so `d112aOneNoticePerDuplicate` can drive it with fakes.
// The board (panels/JobsPanel.jsx) hands it:
//   noticeFor(job)  D54's sentence for this job's company, or null (JobsPanel companyNoticeFor)
//   ask(step)       shows the notice and resolves DRAFT_IT or SKIP — the user's answer
//   draft(job)      the ONE Draft call (lib/jobDecisions.js commitDecision → POST /api/apply/runs)
//
// ⛔ Notices are read from the company index as it stood when "Draft selected" was pressed — a job
//    drafted earlier in this same batch does not raise a notice for the next one: the user picked
//    both on purpose, together. (D54's rule is "a company where you ALREADY have an application".)
// ⛔ One job at a time, in the order picked. Never a combined POST — each job gets the same route,
//    the same refusals and the same slot count as a single Draft.
// ⛔ The server's refusals are respected. A 429 (out of drafts) or a 409 (setup missing, paused)
//    would refuse every job after it too, so the batch STOPS there and says the server's sentence;
//    "already drafted" (400) is the drafted state, so it counts as drafted and the batch goes on.

export const DRAFT_IT = "draft";
export const SKIP = "skip";

const idOf = (job) => String(job?.jobId ?? job?.id ?? "");

/** True when a refusal would refuse every later job too (cap, setup, pause) — the batch stops. */
export function stopsBatch(err) {
  if (err?.payload?.code === "already_drafted") return false;
  return err?.status === 429 || err?.status === 409;
}

/**
 * The plan: the selected jobs in the order picked, each with its notice (or null). Duplicate picks
 * collapse to the first; a job that is already drafted (or has no id) is dropped — it is not asked
 * about and not posted.
 * @returns {{ job: object, notice: string|null }[]}
 */
export function planDraftSelected(jobs = [], { noticeFor = () => null, alreadyDrafted = () => false } = {}) {
  const seen = new Set();
  const plan = [];
  for (const job of jobs) {
    const id = idOf(job);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (alreadyDrafted(job)) continue;
    plan.push({ job, notice: noticeFor(job) || null });
  }
  return plan;
}

/**
 * Run the batch. Resolves to what happened — never throws for a refused Draft.
 * @returns {Promise<{ total: number, notices: number, drafted: object[], skipped: object[],
 *                     refused: { job: object, error: string }[], stopped: { job: object, error: string }|null }>}
 */
export async function runDraftSelected({ jobs = [], noticeFor, alreadyDrafted, ask, draft } = {}) {
  const plan = planDraftSelected(jobs, { noticeFor, alreadyDrafted });
  const out = { total: plan.length, notices: 0, drafted: [], skipped: [], refused: [], stopped: null };
  const withNotice = plan.filter(s => s.notice).length;
  let asked = 0;
  for (const step of plan) {
    if (step.notice) {
      out.notices += 1;
      asked += 1;
      const answer = await ask({ job: step.job, notice: step.notice, index: asked, of: withNotice });
      if (answer !== DRAFT_IT) { out.skipped.push(step.job); continue; }
    }
    try {
      await draft(step.job);
      out.drafted.push(step.job);
    } catch (e) {
      if (e?.payload?.code === "already_drafted") { out.drafted.push(step.job); continue; }
      const refusal = { job: step.job, error: e?.message || "Not drafted." };
      out.refused.push(refusal);
      if (stopsBatch(e)) { out.stopped = refusal; break; }
    }
  }
  return out;
}

/** The one line the board says when the batch ends: "Drafted 2 of 3 — 1 skipped. They wait for your review …" */
export function draftSelectedSummary(r) {
  if (!r) return "";
  const end = (t) => (/[.!?]$/.test(t) ? t : t + ".");
  const tail = [];
  if (r.skipped.length) tail.push(`${r.skipped.length} skipped`);
  const others = r.refused.filter(x => x !== r.stopped);
  if (others.length) tail.push(`${others.length} refused (${others.map(x => `${x.job?.company || "a job"}: ${x.error}`).join("; ")})`);
  let line = end(`Drafted ${r.drafted.length} of ${r.total}` + (tail.length ? ` — ${tail.join(", ")}` : ""));
  if (r.stopped) {
    const left = r.total - r.drafted.length - r.skipped.length - r.refused.length;
    line += ` Stopped at ${r.stopped.job?.company || "a job"} — ${end(r.stopped.error)}` + (left > 0 ? ` ${left} not tried.` : "");
  }
  if (r.drafted.length) line += " They wait for your review in Draft House — nothing is sent until you approve.";
  return line;
}

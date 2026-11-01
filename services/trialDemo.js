// ⭐ THE TRIAL'S DEMONSTRATION (owner 11-01, overriding D124 / D129's live run for the trial): "drafting 2 picks should
// automatically take them to the survey … the draft house is doing nothing, this should be end to end … show the
// complete simulation". After a sample account's 2nd Draft, Draft House REPLAYS a complete run for each pick — reading
// the job, tailoring the résumé (the sample résumé and its tailored version side by side — SIMULATED, no model: owner
// 11-01 "we don't even need to tailor anything … show a sample resume and a tailored one"), filling the practice form
// with the sample's own values, the consent box left to the tester, Sent, the confirmation — labelled "Demonstration".
// Nothing is sent anywhere: completing the replay records the two as sent BY DEMONSTRATION (reason_code
// 'demonstration') with draft's practice-form confirmation in the Inbox, which locks the trial into the survey.
import { samples, activeSampleId, recordPracticeSubmission } from "./trial.js";
import { recordSubmissionFromPipeline } from "./applicationRecords.js";

export const DEMO_REASON = "demonstration";
const PRACTICE_EVIDENCE = "draft's practice form confirmed it (the trial demonstration — nothing was sent to the employer)";

/** The two (or fewer) jobs this account drafted, newest first. */
export function draftedJobs(db, userId, limit = 2) {
  try {
    return db.prepare(`SELECT rj.job_id, rj.status, sj.title, sj.company, sj.location, sj.ats_report, sj.description, sj.description_text
      FROM apply_run_jobs rj LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id = ? AND rj.status <> 'cancelled' AND COALESCE(rj.hidden_at, 0) = 0
      GROUP BY rj.job_id ORDER BY MAX(rj.created_at) DESC LIMIT ?`).all(userId, limit);
  } catch { return []; }
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Does `text` name `term` as a whole term ("C++", "Node.js", "Go" — not "Google")? */
export const names = (text, term) => new RegExp(`(?<![\\w+#.])${esc(term)}(?![\\w+#])`, "i").test(text);

/** The résumé's own skills: the items of the SKILLS section ("Languages: Java, Python" → Java, Python). */
export function resumeSkills(text) {
  const lines = String(text || "").split("\n");
  const at = lines.findIndex(l => /^SKILLS\b/.test(l.trim()));
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^[A-Z][A-Z &]+$/.test(l.trim())) break;
    const body = l.includes(":") ? l.slice(l.indexOf(":") + 1) : l;
    for (const raw of body.replace(/[()]/g, ",").split(/[,;]/)) { const t = raw.trim(); if (t && t.length <= 40 && !out.includes(t)) out.push(t); }
  }
  return out;
}

/**
 * The posting's terms this résumé already shows: the posting's stored report (tier1_matched) when it has one, else the
 * résumé's own skills that the posting's text names. Only terms the résumé ALREADY has — tailoring never adds a skill.
 */
export function postingTerms(resumeText, job) {
  let fromReport = [];
  try { fromReport = (JSON.parse(job?.ats_report || "null")?.tier1_matched || []).filter(t => typeof t === "string"); } catch { /* no report */ }
  const shown = fromReport.filter(t => names(resumeText, t));
  if (shown.length) return shown.slice(0, 10);
  const posting = [job?.title, job?.description_text, job?.description].filter(Boolean).join("\n");
  return resumeSkills(resumeText).filter(t => names(posting, t)).slice(0, 10);
}

/**
 * ⭐ Owner 11-01: "live tailoring is simulated … we don't even need to tailor anything, but … show a sample resume and a
 * tailored one as part of the process". The demonstration's tailored résumé is made HERE, with no model: the sample
 * résumé, re-arranged for the posting — a summary line naming the posting's terms the résumé already shows, each
 * section's bullets reordered so the ones naming those terms lead, and each skills line led by the matched skills. Every
 * word comes from the sample résumé or the posting's title and company; nothing is added that the sample did not do.
 * Returns the full résumé before and after, line by line, each tailored line marked ("added" | "moved").
 */
export function simulateTailoring(resumeText, job, sample = {}) {
  const before = String(resumeText || "").replace(/\r\n/g, "\n").split("\n");
  const terms = postingTerms(resumeText, job);
  const hits = (l) => terms.filter(t => names(l, t)).length;
  const after = before.map(text => ({ text, change: null }));
  if (terms.length) {
    // each run of bullets: the ones naming the posting's terms first (stable)
    for (let i = 0; i < after.length;) {
      if (!/^\s*[-•]/.test(after[i].text)) { i++; continue; }
      let j = i; while (j < after.length && /^\s*[-•]/.test(after[j].text)) j++;
      const run = after.slice(i, j);
      const sorted = run.map((l, k) => ({ l, k, h: hits(l.text) })).sort((a, b) => b.h - a.h || a.k - b.k);
      sorted.forEach(({ l, k }, n) => { after[i + n] = { text: l.text, change: k > n ? "moved" : null }; });   // marked: the ones brought up
      i = j;
    }
    // each skills line: the matched skills first
    const sk = after.findIndex(l => /^SKILLS\b/.test(l.text.trim()));
    for (let i = sk + 1; sk >= 0 && i < after.length && !/^[A-Z][A-Z &]+$/.test(after[i].text.trim()); i++) {
      const l = after[i].text, c = l.indexOf(":");
      if (c < 0) continue;
      const items = l.slice(c + 1).split(/,(?![^(]*\))/).map(x => x.trim()).filter(Boolean);
      const lead = items.filter(x => terms.some(t => names(x, t))), rest = items.filter(x => !lead.includes(x));
      const text = `${l.slice(0, c)}: ${[...lead, ...rest].join(", ")}`;
      if (text !== l) after[i] = { text, change: "moved" };
    }
    // a summary under the contact lines, in the résumé's and the posting's own words
    const head = after.findIndex((l, k) => k > 0 && !l.text.trim());
    const list = terms.slice(0, 4);
    const named = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];
    const role = job?.title || sample.targetTitle || "this role";
    after.splice(head < 0 ? 2 : head, 0, { text: "", change: null }, { text: "SUMMARY", change: "added" },
      { text: `For the ${role}${job?.company ? ` role at ${job.company}` : ""}: hands-on with ${named}, shown in the work below.`, change: "added" });
  }
  return { before, after, terms, changed: after.filter(l => l.change).length };
}

/**
 * The tailoring for (sample, job): made once and kept for every later tester on that sample (trial_demo_tailoring).
 * Deterministic — the same sample and posting always give the same résumé.
 */
export function demoTailoring(db, { sampleId, job }) {
  const key = [sampleId, String(job.job_id)];
  const row = db.prepare("SELECT changes_json FROM trial_demo_tailoring WHERE sample_id = ? AND job_id = ?").get(...key);
  const kept = row ? JSON.parse(row.changes_json) : null;
  if (Array.isArray(kept?.after)) return { status: "ready", ...kept };
  const s = samples()[sampleId] || {};
  const t = simulateTailoring(s.resumeText, job, s);
  db.prepare("INSERT OR REPLACE INTO trial_demo_tailoring (sample_id, job_id, changes_json) VALUES (?, ?, ?)").run(...key, JSON.stringify(t));
  return { status: "ready", ...t };
}

/** The practice form's fields, filled with the SAMPLE's own values (a fictional person). */
export function demoFormFields(sampleId) {
  const c = samples()[sampleId]?.candidate || {};
  const [first, ...rest] = String(c.fullName || "").split(" ");
  return [
    ["First name", first], ["Last name", rest.join(" ")], ["Email", c.email], ["Phone", c.phone],
    ["Résumé", "the tailored résumé (PDF)"], ["LinkedIn", c.linkedinUrl || "—"],
  ].map(([label, value]) => ({ label, value: value || "—" }));
}

/** Everything the replay shows, for this account's drafted picks. */
export function demoState(db, userId) {
  const sampleId = activeSampleId(db, userId);
  if (!sampleId) return { ok: false, reason: "not_a_sample" };
  const jobs = draftedJobs(db, userId);
  return {
    ok: true, sample: sampleId, fields: demoFormFields(sampleId),
    runs: jobs.map(j => ({ jobId: j.job_id, title: j.title, company: j.company, location: j.location,
      sent: j.status === "submitted", tailoring: demoTailoring(db, { sampleId, job: j }) })),
  };
}

/** The replay finished: the picks recorded as sent by demonstration, each with the practice form's confirmation. */
export function completeDemo(db, userId, { deliver = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const sampleId = activeSampleId(db, userId);
  if (!sampleId) throw Object.assign(new Error("The demonstration is for a sample résumé."), { status: 400, code: "not_a_sample" });
  const jobs = draftedJobs(db, userId);
  for (const j of jobs) {
    if (j.status === "submitted") continue;
    db.prepare(`UPDATE apply_run_jobs SET status = 'submitted', reason_code = ?, reason_detail = 'the trial demonstration (a replay; nothing was sent to the employer)',
      finished_at = ?, submit_verified = 1, submit_evidence = ? WHERE user_id = ? AND job_id = ? AND status <> 'cancelled'`)
      .run(DEMO_REASON, now, PRACTICE_EVIDENCE, userId, j.job_id);
    // The Table reads the application record: Sent, as a pipeline send that the practice form confirmed (owner 11-01:
    // the 2 were stuck "Drafted — in Draft House" on The Table).
    const rj = db.prepare("SELECT id FROM apply_run_jobs WHERE user_id = ? AND job_id = ? AND status = 'submitted' ORDER BY id DESC LIMIT 1").get(userId, j.job_id);
    if (rj) try { recordSubmissionFromPipeline(db, { userId, jobId: j.job_id, runJobId: rj.id }); } catch { /* the run stands as sent */ }
    recordPracticeSubmission(db, { userId, job: { job_id: j.job_id, title: j.title, company: j.company }, fieldsFilled: 6, resumeAttached: true, deliver });
  }
  return { completed: jobs.length };
}

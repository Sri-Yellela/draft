// ⭐ THE TRIAL'S DEMONSTRATION (owner 11-01, overriding D124 / D129's live run for the trial): "drafting 2 picks should
// automatically take them to the survey … the draft house is doing nothing, this should be end to end … show the
// complete simulation". After a sample account's 2nd Draft, Draft House REPLAYS a complete run for each pick — reading
// the job, tailoring the résumé (the sample résumé and its tailored version side by side — SIMULATED, no model: owner
// 11-01 "we don't even need to tailor anything … show a sample resume and a tailored one"), filling the practice form
// with the sample's own values, the consent box left to the tester, Sent, the confirmation — labelled "Demonstration".
// Nothing is sent anywhere: completing the replay records the two as sent BY DEMONSTRATION (reason_code
// 'demonstration') with draft's practice-form confirmation in the Inbox, which locks the trial into the survey.
//
// ⭐ A111 P4 · the same demonstration on the tester's OWN résumé (the own-résumé pathway, behind `trial_own_resume`): the
// tailoring is simulated from THEIR résumé (keyed per user × posting — deterministic from the two, so it is computed on
// read and never stored; a sample's is kept per sample × posting for every later tester, migration 210), the practice
// form is filled from the résumé's own contact lines (falling back to the account's name and email), and the rest is
// the sample path's, unchanged. Tailoring never adds a skill the résumé does not already show.
import { samples, activeSampleId, isOwnTrial, recordPracticeSubmission } from "./trial.js";
import { recordSubmissionFromPipeline } from "./applicationRecords.js";
import { prefillFromResumeText } from "../shared/resumePrefill.js";

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

// A111: a real résumé writes its skills heading in any case ("Skills", "Technical Skills", "SKILLS & TOOLS"); a sample's is
// "SKILLS". The heading is a line of its own; a section ends at the next heading — an all-caps line (the samples'), or a
// usual section name on its own line in any case.
const SKILLS_HEADING = /^(?:technical\s+|core\s+|key\s+)?(?:skills|competencies)(?:\s*(?:&|and)\s*(?:tools|technologies|competencies))?\s*:?$/i;
const SECTION_NAME = /^(?:professional\s+|work\s+)?(?:experience|employment|education|projects|certifications?|licenses?|awards|honors|publications|volunteer(?:ing)?|interests|languages|summary|profile|leadership|activities|references)(?:\s*(?:&|and)\s*\w+)?\s*:?$/i;
const isHeading = (line) => { const t = String(line ?? "").trim(); return /^[A-Z][A-Z &]+$/.test(t) || SECTION_NAME.test(t) || SKILLS_HEADING.test(t); };
const skillsAt = (lines) => lines.findIndex(l => /^SKILLS\b/.test(String(l).trim()) || SKILLS_HEADING.test(String(l).trim()));

/** The résumé's own skills: the items of the SKILLS section ("Languages: Java, Python" → Java, Python). */
export function resumeSkills(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const at = skillsAt(lines);
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (isHeading(l)) break;
    const body = l.includes(":") ? l.slice(l.indexOf(":") + 1) : l;
    for (const raw of body.replace(/[()]/g, ",").split(/[,;•|]/)) { const t = raw.replace(/^\s*[-–]\s*/, "").trim(); if (t && t.length <= 40 && !out.includes(t)) out.push(t); }
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
  return resumeSkills(resumeText).filter(t => names(posting, t) && names(resumeText, t)).slice(0, 10);
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
    const sk = skillsAt(after.map(l => l.text));
    for (let i = sk + 1; sk >= 0 && i < after.length && !isHeading(after[i].text); i++) {
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

/**
 * A111 · the tailoring for (THIS user's résumé, job), per user × posting: the same simulation over the tester's own résumé.
 * The posting's terms come from THIS user's own stored ATS report for it (the board's one scorer, against their résumé),
 * else from their résumé's skills the posting names — and either way only terms the résumé already shows. Nothing stored:
 * it is a pure function of the résumé and the posting, so every read gives the same résumé.
 */
export function ownTailoring(db, { userId, profileId = null, resumeText, job }) {
  let report = null;
  try {
    report = db.prepare("SELECT ats_report FROM ats_only_reports WHERE user_id = ? AND job_id = ? AND (domain_profile_id IS ? OR domain_profile_id IS NULL) ORDER BY id DESC LIMIT 1")
      .pluck().get(userId, String(job.job_id), profileId) || null;
  } catch { report = null; }
  return { status: "ready", ...simulateTailoring(resumeText, { ...job, ats_report: report || null }) };
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

/**
 * A111 · the practice form's fields from the tester's OWN résumé: its contact lines (A33's prefill — the name on the first
 * line, the email, the phone, the LinkedIn), each missing one from the account (its name and sign-up email). Never an
 * eligibility answer (A33's NEVER_PREFILL) — the practice form leaves those to the person, as the real one does.
 */
export function ownFormFields(resumeText, account = {}) {
  const p = prefillFromResumeText(resumeText);
  const fromResume = String(p.full_name?.value || "").trim().split(/\s+/).filter(Boolean);
  const first = fromResume.length >= 2 ? fromResume[0] : String(account.first_name || "").trim();
  const last = fromResume.length >= 2 ? fromResume.slice(1).join(" ") : String(account.last_name || "").trim();
  return [
    ["First name", first], ["Last name", last], ["Email", p.email?.value || account.email], ["Phone", p.phone?.value],
    ["Résumé", "the tailored résumé (PDF)"], ["LinkedIn", p.linkedin_url?.value || "—"],
  ].map(([label, value]) => ({ label, value: String(value ?? "").trim() || "—" }));
}

/**
 * Whose résumé the demonstration runs on: a sample ({ kind: "sample", sampleId }) — the safety rule's question, asked
 * first — or, on the own-résumé pathway, the tester's own active base résumé ({ kind: "own", resumeText, profileId,
 * account }). Null for anyone else.
 */
export function demoSubject(db, userId) {
  const sampleId = activeSampleId(db, userId);
  if (sampleId) return { kind: "sample", sampleId };
  if (!isOwnTrial(db, userId)) return null;
  const row = db.prepare(`SELECT d.id, b.content FROM domain_profiles d JOIN profile_base_resumes b ON b.profile_id = d.id AND b.user_id = d.user_id
    WHERE d.user_id = ? AND d.is_active = 1`).get(userId);
  if (!row?.content) return null;
  let account = {};
  try { account = db.prepare("SELECT first_name, last_name, email FROM user_profile WHERE user_id = ?").get(userId) || {}; } catch { account = {}; }
  return { kind: "own", profileId: row.id, resumeText: String(row.content).replace(/<[^>]+>/g, " "), account };
}

/** Everything the replay shows, for this account's drafted picks. */
export function demoState(db, userId) {
  const who = demoSubject(db, userId);
  if (!who) return { ok: false, reason: "not_a_sample" };
  const jobs = draftedJobs(db, userId);
  if (who.kind === "own") {
    return {
      ok: true, sample: null, own: true, fields: ownFormFields(who.resumeText, who.account),
      runs: jobs.map(j => ({ jobId: j.job_id, title: j.title, company: j.company, location: j.location,
        sent: j.status === "submitted", tailoring: ownTailoring(db, { userId, profileId: who.profileId, resumeText: who.resumeText, job: j }) })),
    };
  }
  const { sampleId } = who;
  return {
    ok: true, sample: sampleId, fields: demoFormFields(sampleId),
    runs: jobs.map(j => ({ jobId: j.job_id, title: j.title, company: j.company, location: j.location,
      sent: j.status === "submitted", tailoring: demoTailoring(db, { sampleId, job: j }) })),
  };
}

/** The replay finished: the picks recorded as sent by demonstration, each with the practice form's confirmation. */
export function completeDemo(db, userId, { deliver = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const who = demoSubject(db, userId);
  if (!who) throw Object.assign(new Error("The demonstration is for a sample résumé."), { status: 400, code: "not_a_sample" });
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
    recordPracticeSubmission(db, { userId, job: { job_id: j.job_id, title: j.title, company: j.company }, fieldsFilled: 6, resumeAttached: true, deliver,
      own: who.kind === "own" });
  }
  return { completed: jobs.length };
}

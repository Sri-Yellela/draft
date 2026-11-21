// ⭐ 47a (owner 11-21) · E2 tailor from the Résumé tab · E3 the fill carries a READY tailored résumé · E4 View résumé in draft's
// sandbox, with What we changed against the base AND the job.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resumePanelModel } from "../extension/resumePanel.js";
import { compareResumes } from "../services/resumeChanges.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const JOB = { jobId: "j1", title: "Data Engineer", company: "Kestrel" };
const ID = "erg_0123456789abcdef01234567";

test("e2 the Résumé tab: Tailor when none exists, Try again after a refusal / failure / cancel — the person's click, the one start", () => {
  assert.deepEqual(resumePanelModel({ job: JOB }).actions.map(a => [a.role, a.label, !!a.primary]), [["generate", "Tailor my résumé for this job", true]]);
  for (const status of ["refused", "failed", "cancelled"]) {
    assert.deepEqual(resumePanelModel({ job: JOB, view: { id: ID, status, job: JOB } }).actions.map(a => a.label), ["Try again"], status);
  }
  assert.deepEqual(resumePanelModel({ job: JOB, view: { id: ID, status: "generating", job: JOB } }).actions.map(a => a.role), ["cancel"], "never a second start while one runs");
  const src = read("extension/resumePanel.js");
  assert.match(src, /RESUME_GENERATE: async \(msg, sender\) => \{\s*if \(msg\?\.trigger !== 'click'\) return refuse/, "the handler still refuses anything but a click");
});

test("e3 the fill: an attached résumé first, else this job's READY tailored one (asked as Attach asks), else the packet's", () => {
  const src = read("extension/gated-handoff.js");
  const fn = src.slice(at(src, "export async function tailoredPdfPath("), at(src, "/** The panel meta's `files`"));
  assert.match(fn, /if \(b\?\.id !== id \|\| b\.status !== 'ready'\) return null;/, "refused / failed / unfinished are never filled in");
  assert.match(fn, /authedFetch\(serverUrl, `\$\{base\}\/pdf`, \{ method: 'POST'/);
  assert.match(fn, /pdf\.url\.startsWith\(`\$\{base\}\/pdf`\)/, "only draft's own stored-file route");
  assert.match(src, /const tailoredPath = !panelResume\?\.attached && panelResume\?\.id && serverUrl \? await tailoredPdfPath\(serverUrl, panelResume\.id\)/);
});

test("e4 View résumé opens draft's sandbox for the job; What we changed says how the job's must-haves read before and after", () => {
  assert.match(read("services/extensionResume.js"), /openUrl: `\/draft\/resume\/\$\{encodeURIComponent\(g\.job_id\)\}`/);
  assert.equal(resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB } }).actions.find(a => a.role === "edit").label, "View résumé");
  const before = "Jane Doe\nExperience\nKestrel — Data Engineer\n- Built SQL reports for finance\nSkills\nSQL, Excel";
  const after = "Jane Doe\nExperience\nKestrel — Data Engineer\n- Built SQL and Python pipelines on Airflow for finance\nSkills\nSQL, Python, Airflow";
  const r = compareResumes({ before, after, afterReport: { tier1_matched: ["sql", "python", "airflow"], tier1_missing: ["kafka"] } });
  assert.deepEqual({ asked: r.againstJob.asked, before: r.againstJob.before, after: r.againstJob.after }, { asked: 4, before: 1, after: 3 });
  assert.deepEqual(r.againstJob.terms.find(t => t.term === "kafka"), { term: "kafka", before: false, after: false });
  assert.equal(compareResumes({ before, after }).againstJob, null, "no report — nothing claimed about the job");
  const ui = read("client/src/components/ResumeChangesPanel.jsx");
  assert.match(ui, /data-against-job=""/);
  assert.match(ui, /of the job's \{d\.againstJob\.asked\} must-haves/);
});

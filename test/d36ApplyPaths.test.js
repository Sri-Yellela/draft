import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tmpPdfPath } from "../routes/apply.js";
import { describeApplication } from "../client/src/lib/applyObstacles.js";
import { at as anchor } from "../test-support/sourceAnchors.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import {
  submitBlockedReason, resolveSponsorshipNeed, buildAnswers, eligibilityClassOf, sanitizeDiscoveredFields,
} from "../services/applyAutomation.js";

// D36 — EVERY APPLY PATH, END TO END. Each test here pins a defect the walk found against the local
// fake ATS on a throwaway server (synthetic user, keys blanked); the walk itself is in the D36 report
// and docs/D36_ATTENDED_RUNBOOK.md. Read the source as text with line endings normalised, because
// the tree is CRLF on Windows and LF elsewhere and neither is what these assertions are about.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ── 1 · A résumé that was written must not be reported as never written ──────────────────────────
// Walked 10-05: Draft → preview → Approve. The approved run generated the résumé (artifact 8, score
// 90), then held `resume_unavailable` — "No resume was generated, so there was nothing to attach".
// The temp PDF name embedded the job id (`greenhouse::6110219004` shape) and `:` is illegal in a
// Windows path; `catch { return null; }` hid the ENOENT. Two defects: the name, and the silence.

test("D36 · the temp PDF name is portable: a real job id with '::' yields no colon in the file name", () => {
  const p = tmpPdfPath("resume", 83, "greenhouse::6110219004", 1791240074381);
  assert.equal(path.dirname(p), os.tmpdir());
  const base = path.basename(p);
  assert.doesNotMatch(base, /[:<>"|?*\\/]/, `not a portable file name: ${base}`);
  assert.equal(base, "resume_83_greenhouse_6110219004_1791240074381.pdf");
  // Something a person can still trace back to the job and the user.
  assert.match(tmpPdfPath("cl", 7, "lever::abc-123"), /cl_7_lever_abc-123_\d+\.pdf$/);
});

test("D36 · every run-time PDF goes through tmpPdfPath — no raw job id in a temp file name", () => {
  const src = read("routes/apply.js");
  assert.doesNotMatch(src, /path\.join\(os\.tmpdir\(\),\s*`(?:resume|cl)_\$\{userId\}_\$\{jobId\}/,
    "a temp PDF path still interpolates the raw job id");
  assert.ok((src.match(/tmpPdfPath\("resume", userId, jobId\)/g) || []).length >= 3, "the three résumé sites");
  assert.ok((src.match(/tmpPdfPath\("cl", userId, jobId\)/g) || []).length >= 3, "the three cover-letter sites");
});

test("D36 · a failed résumé PDF is RECORDED as resume_pdf_failed, never swallowed into resume_unavailable", () => {
  const src = read("routes/apply.js");
  // Each place a GENERATED résumé is converted for upload (semi's CASE B, approved/auto CASE C).
  const sites = [...src.matchAll(/await htmlToPdf\(gen\.html\);[\s\S]{0,400}?\}\s*catch\s*(\([^)]*\))?\s*\{([\s\S]{0,300}?)\n\s{10}\}/g)];
  assert.equal(sites.length, 2, "expected the two generated-résumé conversion sites");
  for (const m of sites) {
    assert.ok(m[1], "the catch binds the error — a bare `catch {` cannot say what failed");
    assert.match(m[2], /docFailure = resumePdfFailure\(e\)/, "the failure is kept for attribution");
    assert.match(m[2], /logEvent\([^)]*"resume_pdf_failed"/, "and written to the run's own history");
  }
  // And it outranks the browser's downstream symptom when the row's reason is chosen.
  assert.match(src, /: genFailure \? genFailure\.reasonCode\n\s*: docFailure \? docFailure\.reasonCode\n\s*: atsHeld/);
  assert.match(src, /const reasonDetail = genFailure \? genFailure\.detail : docFailure \? docFailure\.detail/);
});

test("D36 · the user is told the résumé EXISTS, and is not offered to generate another", () => {
  const o = describeApplication({ status: "held_review", reasonCode: "resume_pdf_failed" });
  assert.notEqual(o.obstacle, "resume pdf failed", "resume_pdf_failed has no copy in client/src/lib/applyObstacles.js");
  assert.match(o.obstacle, /written/i);
  assert.doesNotMatch(o.obstacle, /no r[ée]sum[ée] was generated/i);
  assert.equal(o.resumeBlocked, false, "a Generate button would point at a résumé the user already has");
  assert.equal(o.retryable, true);
});

// ── shared harness: the real schema, the real routes, no browser ─────────────────────────────────
function mount({ env = {} } = {}) {
  const prev = {};
  for (const [k, v] of Object.entries(env)) { prev[k] = process.env[k]; process.env[k] = v; }
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Dana','Example','dana@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  // An UNROUTABLE apply URL: any path that wrongly reaches the browser fails at navigation, never
  // at a real employer.
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash)
              VALUES ('gh::1','Backend Engineer','Northwind','http://127.0.0.1:9/gh','http://127.0.0.1:9/gh?ats=boards.greenhouse.io','t','h1')`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  const hooks = applyRoutes(app, db, (req, _res, next) => next(),
    () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = (p) => fetch(base + p).then(r => r.json());
  const stop = () => {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    server.close();
  };
  return { db, post, get, hooks, stop };
}
const waitFor = async (fn, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); }
  return fn();
};
const statusOf = (db, id) => db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(id);

// ── 7 · FULL AUTO RUNS ATTENDED ONLY ──────────────────────────────────────────────────────────────
// Found 10-05: FULL_AUTO_PROVEN = false shaped only the run bar. POST /api/apply/runs with
// approvalMode:'auto' (and /api/apply/answers, "answer-and-send in one step") still started a run that
// SUBMITTED to the employer unattended — test/applyApprovalFlow.test.js even pinned that it did.

test("D36·7 · the lock is a literal at module scope that nothing can reassign or read from config", () => {
  const src = read("routes/apply.js");
  assert.match(src, /\nconst FULL_AUTO_PROVEN = false;\n/, "a module-scope literal false");
  assert.equal((src.match(/FULL_AUTO_PROVEN\s*=(?!=)/g) || []).length, 1, "declared once, never reassigned");
  const decl = anchor(src, "const FULL_AUTO_PROVEN");
  assert.doesNotMatch(src.slice(decl, decl + 60), /process\.env|app_settings|getSetting|envInt/);
  // Read by the bar, by admission and by processing — not by the bar alone.
  assert.ok((src.match(/!FULL_AUTO_PROVEN/g) || []).length >= 3, "autoModeState, startRun and processRunJob all read it");
  assert.match(src, /resolvedMode === "auto" && resolvedApproval === "auto" && !FULL_AUTO_PROVEN/);
  assert.match(src, /mode === "auto" && approvalMode === "auto" && !FULL_AUTO_PROVEN/);
});

test("D36·7 · POST /api/apply/runs refuses approvalMode:'auto' — 403 full_auto_locked, nothing queued", async () => {
  const t = mount();
  try {
    const r = await t.post("/api/apply/runs", { jobIds: ["gh::1"], mode: "auto", approvalMode: "auto" });
    assert.equal(r.status, 403);
    const body = await r.json();
    assert.equal(body.error, "full_auto_locked");
    assert.match(body.message, /wait for your approval/);
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), 0);
    // The ordinary Draft is untouched: it previews and waits. (A job with no posting row, so the run
    // fails fast with job_not_found instead of opening a browser in a unit test.)
    const ok = await t.post("/api/apply/runs", { jobIds: ["no-posting::1"], mode: "auto", surface: "board" });
    assert.equal(ok.status, 202);
    assert.equal(t.db.prepare("SELECT approval_mode FROM apply_runs").pluck().get(), "required");
    assert.equal((await t.get("/api/apply/run-bar")).mode.auto.locked, true);
  } finally { t.stop(); }
});

test("D36·7 · the answers retry cannot 'answer-and-send in one step' either", async () => {
  const t = mount();
  try {
    const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
    t.db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,open_questions_json)
                  VALUES (?,1,'gh::1','held_review','incomplete_form',?)`).run(run, JSON.stringify([{ question: "Start date", reason: "unanswered" }]));
    const r = await t.post("/api/apply/answers", { answers: { "Start date": "11/02/2026" }, retryJobIds: ["gh::1"], approvalMode: "auto" });
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, "full_auto_locked");
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_runs WHERE approval_mode='auto'").pluck().get(), 0);
  } finally { t.stop(); }
});

test("D36·7 · a run row that would send unattended is HELD before anything opens", async () => {
  const t = mount();
  try {
    // However it got there — a legacy NULL approval_mode reads as 'auto' — boot recovery starts it.
    for (const approval of ["auto", null]) {
      const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','queued',1,?)").run(approval).lastInsertRowid;
      const rj = t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'gh::1','queued')").run(run).lastInsertRowid;
      t.hooks.recoverInterruptedRuns();
      assert.ok(await waitFor(() => statusOf(t.db, rj) !== "queued" && statusOf(t.db, rj) !== "running"));
      const row = t.db.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE id=?").get(rj);
      assert.deepEqual([row.status, row.reason_code], ["held_review", "full_auto_locked"], `approval_mode ${approval}`);
      const events = t.db.prepare("SELECT event FROM apply_job_logs WHERE run_job_id=?").pluck().all(rj);
      assert.ok(events.includes("full_auto_locked"));
      assert.ok(!events.includes("site_visit_started"), "no browser was opened");
      await waitFor(() => t.db.prepare("SELECT COUNT(*) FROM apply_runs WHERE status IN ('queued','running')").pluck().get() === 0);
    }
  } finally { t.stop(); }
});

test("D36·7 · the user is told nothing was sent, and how to send it reviewed", () => {
  const o = describeApplication({ status: "held_review", reasonCode: "full_auto_locked" });
  assert.match(o.obstacle, /nothing was opened or sent/);
  assert.match(o.action, /wait for your approval/);
  assert.equal(o.protective, true);
});

// ── 2 · THE KILL SWITCH STOPS A RUN ALREADY IN FLIGHT ─────────────────────────────────────────────
// Walked 10-05 (scratchpad harness: real routes, real autoApply, local fake ATS): approve a preview,
// let the approved run open the form while its résumé is still generating, throw the operator's kill
// switch. Before: the run submitted (fake ATS count 1, job_applications written) — the switch was read
// only at admission and when a job STARTED. After: held full_auto_disabled, count 0. The same
// harness with the routes' blocker removed submits again (seen red). Every path that can run
// unattended — an approved SEMI submit and FULL AUTO — goes through autoApply mode 'full'.

test("D36·2 · submitBlockedReason: null proceeds, a reason blocks, and a THROW blocks (fail-closed)", async () => {
  assert.equal(await submitBlockedReason(null), null);
  assert.equal(await submitBlockedReason(() => null), null);
  assert.equal(await submitBlockedReason(() => "full_auto_disabled"), "full_auto_disabled");
  assert.equal(await submitBlockedReason(async () => "full_auto_disabled"), "full_auto_disabled");
  assert.equal(await submitBlockedReason(() => { throw new Error("database is locked"); }), "submit_check_failed");
});

test("D36·2 · the check sits at the LAST moment before the click, after the per-job abort", () => {
  const src = read("services/applyAutomation.js");
  const abort = anchor(src, "aborted before submit");
  const blocked = anchor(src, "const blockedBy = await submitBlockedReason(submitBlocker);");
  const submitting = anchor(src, 'inProgress.set(String(jobId), { status: "submitting", browser });');
  const click = anchor(src, "await best.btn.click();");
  assert.ok(abort > 0 && blocked > abort, "after the abort checkpoint");
  assert.ok(submitting > blocked && click > submitting, "before anything can be clicked");
  // Between the check and the click there is no await that could let the switch change unseen
  // except the button scan itself — and the check returns before the browser is told to submit.
  assert.match(src.slice(blocked, submitting), /status:\s*"held_review",\s*\n\s*reasonCode:\s*blockedBy/);
});

test("D36·2 · every autoApply that can submit is given the operator's switch", () => {
  const src = read("routes/apply.js");
  assert.match(src, /const submitBlocker = applyMode === "full"\n\s*\? \(\) => \(fullAutoDisabled\(\) \? "full_auto_disabled" : null\)\n\s*: null;/);
  // CASE A (current artifact) and CASE C (generate in parallel) are the two full-mode call sites.
  const calls = [...src.matchAll(/autoApply\(jobUrl, autofillPayload, \{([\s\S]*?)\}\);/g)].map(m => m[1]);
  const fullCapable = calls.filter(c => /mode: applyMode/.test(c) && !/documentsDeferred: true/.test(c));
  assert.equal(fullCapable.length, 2);
  for (const c of fullCapable) assert.match(c, /\bsubmitBlocker,/);
});

test("D36·2 · a run stopped in flight says it was not sent, and can be drafted again", () => {
  for (const code of ["full_auto_disabled", "submit_check_failed"]) {
    const o = describeApplication({ status: "held_review", reasonCode: code });
    assert.match(o.obstacle, /not sent|before this one was sent/, code);
    assert.equal(o.retryable, true, code);
    assert.equal(o.protective, true, code);
  }
});

// ── 4 · ELIGIBILITY IS MAPPED EXACTLY, OR FLAGGED AND STOPPED — NEVER GUESSED ─────────────────────
// Walked 10-05 two ways. (a) FULL AUTO in the harness on the fake ATS's Greenhouse form: "Do you now
// or in the future require sponsorship?" answered "No" at sponsorship_derived / 1.0 for a synthetic
// user who had stated NOTHING — requires_sponsorship is NOT NULL DEFAULT 0 and 0 was read as 'none'.
// (b) The real autoApply in mode 'full' on a synthetic local trap page (scratchpad eligTrap.mjs): the
// pre-fix code SUBMITTED ethnicity="Springfield" (attr 'city' ⊂ "ethnicity"), "Tell us why…"="555-0136"
// ('tel' ⊂ "tell_us_why"), "Personal statement"="IL" ('state'), relocation=location, "Country of
// citizenship"="United States", "Referrer's email"=the candidate's own, and sponsorship "No" three
// times (select via the legacy label sweep, a text box by name, a radio) plus clearance "no" — every
// gate passed, most at handler_exact 1.0. After: every one of those fields blank, each refusal recorded.
const automationSrc = read("services/applyAutomation.js");
function emitted(name) {
  const open = `const ${name} = \``;
  const i = anchor(automationSrc, open);
  const raw = automationSrc.slice(i + open.length, anchor(automationSrc, "`;", i));
  return eval("`" + raw + "`"); // eslint-disable-line no-eval -- the template literal, exactly as emitted
}
const fnFrom = (src, name) => {
  const k = anchor(src, `function ${name}(`);
  return src.slice(k, anchor(src, "\n  }\n", k) + 4);
};

test("D36·4 · a sponsorship situation is never read off a column default", () => {
  assert.equal(resolveSponsorshipNeed({ requires_sponsorship: 0 }), null);
  assert.equal(resolveSponsorshipNeed({}), null);
  // The Greenhouse question, a synthetic user with nothing stated: refused, not "No".
  const fields = [{ field_id: "s", name: "job_application[requires_sponsorship]", type: "select", is_required: true,
    label: "Do you now or in the future require sponsorship for work authorization?", handler_type: "sponsorship",
    handler_source: "attr", options: [{ value: "", label: "Select..." }, { value: "Yes", label: "Yes" }, { value: "No", label: "No" }] }];
  const payload = { sponsorship_need: resolveSponsorshipNeed({ requires_sponsorship: 0 }),
    field_map: { requires_sponsorship: "No", sponsorship: "No" }, handler_map: { sponsorship: "No" }, custom_answers: {} };
  const [a] = buildAnswers(fields, payload);
  assert.equal(a.skipped, true, `answered ${a.value} at ${a.provenance}`);
  assert.ok(a.refusals.some(r => /unknown_sponsorship_need/.test(r)));
  // Stated, it is answered — the refusal is about the default, not the question.
  const [b] = buildAnswers(fields, { ...payload, sponsorship_need: "none" });
  assert.equal(b.value, "No");
});

test("D36·4 · citizenship is an attestation class: residence never answers it", () => {
  assert.equal(eligibilityClassOf("Country of citizenship"), "citizenship");
  assert.equal(eligibilityClassOf("Are you a U.S. citizen or permanent resident?"), "citizenship");
  const fields = [{ field_id: "c", name: "country_of_citizenship", type: "text", label: "Country of citizenship",
    handler_type: "country", handler_source: "attr", is_required: true, options: [] }];
  sanitizeDiscoveredFields(fields);
  const [a] = buildAnswers(fields, { field_map: { country: "United States" }, handler_map: { country: "United States" }, custom_answers: {} });
  assert.equal(a.skipped, true, `answered ${a.value}`);
  // The candidate's own answer to THAT question is the only thing that may fill it.
  const [b] = buildAnswers(fields, { field_map: {}, handler_map: {}, custom_answers: { "Country of citizenship": "Canada" } });
  assert.equal(b.value, "Canada");
  assert.equal(b.provenance, "custom_answer");
});

test("D36·4 · attribute-derived handlers are vetted: third party, inverted class, citizenship", () => {
  const f = (name, label, handler_type) => ({ name, label, handler_type, handler_source: "attr", type: "text" });
  const fields = [
    f("referrer_email", "Referrer's email", "email"),
    f("work_authorization", "Will you require sponsorship to work here?", "work-auth"),
    f("country_of_citizenship", "Country of citizenship", "country"),
    f("requires_sponsorship", "Do you require sponsorship?", "sponsorship"),   // the exact signal survives
    f("email", "Email", "email"),
  ];
  sanitizeDiscoveredFields(fields);
  assert.deepEqual(fields.map(x => x.handler_type), [null, null, null, "sponsorship", "email"]);
  assert.match(fields[0].handler_rejected, /third_party_subject/);
  assert.match(fields[1].handler_rejected, /eligibility_class:sponsorship/);
});

test("D36·4 · an attribute names a handler by whole token or leading word — never by substring", () => {
  const disc = emitted("DISCOVER_FN_SRC");
  const attrHit = new Function(`${fnFrom(disc, "tokenMatch")}\nconst PREFIX_UNSAFE = { state: 1, major: 1 };\n${fnFrom(disc, "attrHit")}\nreturn attrHit;`)();
  const no = [["ethnicity", "city"], ["tell_us_why", "tel"], ["telecommute", "tel"], ["personal_statement", "state"],
              ["relocation", "location"], ["hotel_name", "tel"], ["statement", "state"], ["majority_owner", "major"]];
  const yes = [["job_application[email]", "email"], ["_systemfield_email", "email"], ["applicantEmail", "email"],
               ["emailaddress", "email"], ["phonenumber", "phone"], ["zipCode", "zip"], ["zipcode", "zipcode"],
               ["tel", "tel"], ["given-name", "given-name"], ["address_line1", "address_line1"],
               ["urls[LinkedIn]", "linkedin"], ["job_application[first_name]", "first_name"], ["state", "state"]];
  for (const [raw, key] of no) assert.equal(attrHit(raw, key), false, `${raw} must not name '${key}'`);
  for (const [raw, key] of yes) assert.equal(attrHit(raw, key), true, `${raw} must name '${key}'`);
  assert.match(disc, /if \(attrHit\(raw, key\)\) return \{ handler: ht, source: 'attr' \};/);
  assert.doesNotMatch(disc, /val\.includes\(substr\)/, "the raw substring match is gone");
});

test("D36·4 · the legacy in-page sweep never fills an eligibility field", () => {
  const fill = emitted("FILL_FN_SRC");
  const g = { eligibility: [["sponsorship", "\\bsponsor(?:s|ed|ship)?\\b"], ["clearance", "\\bclearance\\b"]],
              canonicalKeys: { sponsorship: ["requires_sponsorship"] }, thirdPartyRe: "$^", identityKeyRe: "$^" };
  const refused = new Function("g", `${fnFrom(fill, "refused")}\nreturn refused;`)(g);
  // Even the CANONICAL key is refused on this path — it has no direction, tense or provenance.
  assert.equal(refused("Will you require sponsorship?", "requires_sponsorship"), true);
  assert.equal(refused("Do you hold an active security clearance?", "has_clearance"), true);
  assert.equal(refused("First name", "first_name"), false);
  // Step 1 (exact name) consults it, and step 5's sponsorship/clearance radios are gone.
  assert.match(fill, /if \(refused\(describe\(el\) \+ ' ' \+ \(\(el\.labels && el\.labels\[0\]\) \? el\.labels\[0\]\.textContent : ''\), name\)\) return;/);
  assert.doesNotMatch(fill, /fm\.requires_sponsorship === "Yes"/);
  assert.doesNotMatch(fill, /fm\.has_clearance === "Yes"/);
});

test("D36·4 · server.js does not turn has_clearance's default 0 into an answer", () => {
  const server = read("server.js");
  assert.match(server, /has_clearance:profile\?\.has_clearance\?"Yes":"",/);
  assert.doesNotMatch(server, /has_clearance:profile\?\.has_clearance\?"Yes":"No"/);
});

// ── 3 · A REFUSED RETRY LEAVES THE APPLICATION WHERE IT WAS ──────────────────────────────────────
// Found 10-05 reading the answers path, then reproduced here before the fix: POST /api/apply/answers
// with retryJobIds superseded the held rows and THEN asked startRun, so a refusal (the kill switch's
// 503 in this test) returned an error with the application already gone from Draft House — not held,
// not retried, nothing to press.
test("D36·3 · a retry the server refuses puts the held application back, questions and all", async () => {
  const t = mount();
  try {
    const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
    const held = t.db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,finished_at,open_questions_json)
                  VALUES (?,1,'gh::1','held_review','incomplete_form',1700000000,?)`).run(run, JSON.stringify([{ question: "Start date", reason: "unanswered" }])).lastInsertRowid;
    t.db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_full_auto_disabled', '1')").run();
    const r = await t.post("/api/apply/answers", { answers: { "Start date": "11/02/2026" }, retryJobIds: ["gh::1"] });
    assert.equal(r.status, 503);
    const body = await r.json();
    assert.equal(body.error, "full_auto_disabled");
    assert.deepEqual(body.saved, ["Start date"], "the answer itself is still kept");
    const row = t.db.prepare("SELECT status, reason_code, finished_at FROM apply_run_jobs WHERE id=?").get(held);
    assert.deepEqual(row, { status: "held_review", reason_code: "incomplete_form", finished_at: 1700000000 },
      "the held row must be exactly as it was");
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), 1, "no run was started");
    // And once the switch is lifted the same retry goes through and supersedes it.
    t.db.prepare("UPDATE app_settings SET value='0' WHERE key='apply_full_auto_disabled'").run();
    t.db.prepare("DELETE FROM scraped_jobs WHERE job_id='gh::1'").run(); // the retry then fails fast: no browser in a unit test
    const ok = await t.post("/api/apply/answers", { answers: { "Start date": "11/02/2026" }, retryJobIds: ["gh::1"] });
    assert.equal(ok.status, 202);
    assert.equal(t.db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(held), "superseded");
  } finally { t.stop(); }
});

// D33 part 3 — THE GATEWAY SAYS WHY. A capture that answers success and then cannot be found is
// "silence reported as success". The server now answers one `capture` object, worded once
// (services/jobs/captureOutcome.js): inserted · attached to an existing posting (with a link to it) ·
// held off the board, and why · closed. The extension shows that text as given
// (extension/captureResult.js), and so does the site (/extension, part 4).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ingestJob } from "../services/jobs/jobGateway.js";
import { importJob } from "../services/jobs/importJob.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { describeCapture, HELD_WHY, jobLink, recentCaptures, CAPTURE_OUTCOMES } from "../services/jobs/captureOutcome.js";
import { usEligibility } from "../services/jobs/usLocation.js";
import { jobDetailHref } from "../client/src/lib/jobUrl.js";
import { captureResultFrom } from "../extension/captureResult.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (7,1,'Current','engineering','general',1)`).run();
  return d;
}
const seed = (d, { id, active = 1, held = null }) => {
  d.prepare(`INSERT INTO scraped_jobs (job_id,search_query,_hash,title,company,url,source,location,updated_at,is_active,description)
             VALUES (?,'crawl','h','Backend Engineer','Northwind',?,'greenhouse','Remote',?,?,'Build things.')`)
    .run(id, `https://boards.greenhouse.io/northwind/jobs/${id.split(":").pop()}`, Math.floor(Date.now() / 1000), active);
  if (held) d.prepare("INSERT INTO rejected_jobs (job_id,title,company,source,reason,rejected_at) VALUES (?,'','','',?,0)").run(id, `out_of_market:${held}`);
  return d.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id);
};

test("every reason the US-only gate can hold a posting for has words — none is held without its why", () => {
  const samples = [
    { location: "Remote", description: "Ship things." },                                    // remote_region_unstated
    { location: "Remote", description: "You must be based in Germany." },                  // remote_non_us_by_description
    { location: "London, United Kingdom", description: "" },                                // non_us_location
    { location: "N/A", description: "" },                                                   // location_unparseable
    { location: null, description: "" },
  ];
  const reasons = new Set(samples.map(usEligibility).filter(v => !v.admit).map(v => v.reason));
  assert.deepEqual([...reasons].sort(), ["location_unparseable", "non_us_location", "remote_non_us_by_description", "remote_region_unstated"]);
  for (const r of reasons) assert.ok(HELD_WHY[r], `no words for ${r}`);
  // And usEligibility's body names no other refusing reason this list could be missing.
  const src = read("services/jobs/usLocation.js");
  const body = src.slice(at(src, "export function usEligibility"), at(src, "// The state table"));
  const named = new Set([...body.matchAll(/"([a-z_]+)"/g)].map(m => m[1]));
  for (const notAReason of ["us", "non_us", "remote_unqualified", "unknown", "us_location", "us_office", "remote_us_by_description"]) named.delete(notAReason);
  assert.deepEqual([...named].sort(), [...reasons].sort());
});

test("the four outcomes, each in its own words, each with a link to the job on draft", () => {
  const d = db();
  seed(d, { id: "greenhouse:northwind:1" });
  seed(d, { id: "greenhouse:northwind:2", active: 0, held: "remote_region_unstated" });
  seed(d, { id: "greenhouse:northwind:3", active: 0 });
  const t = { title: "Backend Engineer", company: "Northwind" };

  const ins = describeCapture(d, { jobId: "greenhouse:northwind:1", action: "inserted", ...t });
  assert.equal(ins.outcome, "inserted");
  assert.equal(ins.onBoard, true);
  // D41(a): a capture no longer stars, so no outcome says "★ Saved".
  assert.equal(ins.message, "Added to the board: Backend Engineer at Northwind — it is in ALL, and in your imports.");

  const att = describeCapture(d, { jobId: "greenhouse:northwind:1", action: "attached", ...t });
  assert.equal(att.outcome, "attached");
  assert.equal(att.matchedExisting, true);
  // v1.5.2 (owner 10-12): ONE wording after a capture that matched a board job
  assert.equal(att.message, "Backend Engineer at Northwind is on your board and in your imports.");
  assert.equal(att.link, "/app/jobs/greenhouse%3Anorthwind%3A1");   // 47m (D199 C7): the job's address is its opening sheet

  const held = describeCapture(d, { jobId: "greenhouse:northwind:2", action: "attached", ...t });
  assert.equal(held.outcome, "held", "an attach to a held row is reported as HELD — 'already on the board' would be false");
  assert.equal(held.onBoard, false);
  assert.equal(held.reason, "remote_region_unstated");
  assert.match(held.message, /NOT on the board/);
  assert.ok(held.message.includes(HELD_WHY.remote_region_unstated));

  const closed = describeCapture(d, { jobId: "greenhouse:northwind:3", action: "inserted", ...t });
  assert.equal(closed.outcome, "closed");
  assert.match(closed.message, /listing .* has closed/);

  const noProfile = describeCapture(d, { jobId: "greenhouse:northwind:1", action: "inserted", ...t, noActiveProfile: true });
  assert.match(noProfile.message, /no active job profile/);
  assert.throws(() => describeCapture(d, { jobId: "nope", action: "inserted" }), /never be reported without one/);
  // D41(d) adds "refused": no US evidence, nothing written (recentCaptures words it).
  assert.deepEqual([...CAPTURE_OUTCOMES], ["inserted", "attached", "held", "closed", "refused"]);
  d.close();
});

test("the link is the client's own job address (jobDetailHref), so it opens the job by id", () => {
  for (const id of ["greenhouse:northwind:1", "import:3f2a", "a b/c?d"]) assert.equal(jobLink(id), jobDetailHref(id));
  assert.equal(jobLink(null), null);
});

test("importJob answers the capture object — attached, and held with its reason", async () => {
  const d = db();
  const live = seed(d, { id: "greenhouse:northwind:11" });
  let r = await importJob({ url: live.url }, { db: d, anthropic: null, userId: 1 });
  assert.equal(r.capture.outcome, "attached");
  assert.equal(r.capture.link, jobLink(live.job_id));
  assert.equal(r.message, r.capture.message);
  assert.equal(r.attachedToExisting, true, "the A49 flag is kept for callers that read it");

  const held = seed(d, { id: "greenhouse:northwind:12", active: 0, held: "remote_region_unstated" });
  r = await importJob({ url: held.url }, { db: d, anthropic: null, userId: 1 });
  assert.equal(r.capture.outcome, "held");
  assert.equal(r.capture.reason, "remote_region_unstated");
  assert.equal(r.outOfMarket, true);
  d.close();
});

test("a gated insert reads held through ingestJob + describeCapture (no flag carried through a branch)", () => {
  const d = db();
  const job = { id: "import:r1", title: "Platform Engineer", company: "Northwind", location: "Remote",
                url: "https://northwind.example.com/jobs/r1", source: "import", description: "Ship platform work." };
  const r = ingestJob(d, { job, origin: "capture", userId: 1 });
  const c = describeCapture(d, { jobId: r.jobId, action: r.action, title: job.title, company: job.company });
  assert.equal(c.outcome, "held");
  assert.equal(c.reason, "remote_region_unstated");
  d.close();
});

test("the popup's recent captures carry what happened to each (POST /api/import/context)", async () => {
  const d = db();
  seed(d, { id: "greenhouse:northwind:21" });
  seed(d, { id: "greenhouse:northwind:22", active: 0, held: "non_us_location" });
  const cap = d.prepare("INSERT INTO job_captures (user_id,job_id,origin,action,created_at) VALUES (1,?,'capture',?,?)");
  cap.run("greenhouse:northwind:21", "inserted", 1000);
  cap.run("greenhouse:northwind:22", "inserted", 2000);
  cap.run("ghost:1", "inserted", 3000);   // its posting was pruned since
  const list = recentCaptures(d, 1, 5);
  assert.deepEqual(list.map(x => [x.jobId, x.outcome, x.onBoard]),
    [["ghost:1", "missing", false], ["greenhouse:northwind:22", "held", false], ["greenhouse:northwind:21", "inserted", true]]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/api/import", createImportJobRouter(d, null));
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/import/context`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com/" }) });
    const body = await res.json();
    assert.equal(body.recent[1].outcome, "held");
    assert.match(body.recent[1].message, /outside the US/);
  } finally { server.close(); d.close(); }
});

// ── The extension shows the server's words ───────────────────────────────────────────────────────
const SITE = "https://jobsviadraft.com";

test("extension: a capture result is the server's capture object, as given", () => {
  const held = captureResultFrom(200, { job: {}, capture: { outcome: "held", onBoard: false, jobId: "j1",
    message: "Saved to ★ Saved, but NOT on the shared board: …", link: "/app/jobs?job=j1" } }, SITE);
  assert.deepEqual(held, { success: true, outcome: "held", onBoard: false, jobId: "j1",
    message: "Saved to ★ Saved, but NOT on the shared board: …", link: `${SITE}/app/jobs?job=j1` });
  const ins = captureResultFrom(200, { capture: { outcome: "inserted", onBoard: true, jobId: "j2", message: "Added", link: "/app/jobs?job=j2" } }, SITE);
  assert.equal(ins.onBoard, true);
});

test("extension: ⛔ a 2xx that does not say where the job went is NOT a capture", () => {
  const silent = captureResultFrom(200, { job: { title: "Engineer" } }, SITE);
  assert.equal(silent.success, false);
  assert.match(silent.message, /without saying where this job went/);
  assert.equal(captureResultFrom(200, {}, SITE).success, false);
  assert.equal(captureResultFrom(401, {}, SITE).message, "Sign in to draft first");
  assert.equal(captureResultFrom(503, { error: "unavailable" }, SITE).message, "unavailable");
  assert.equal(captureResultFrom(200, { needsClientCapture: true, message: "Open it" }, SITE).success, false);
  // A link only ever points at draft.
  const off = captureResultFrom(200, { capture: { outcome: "inserted", jobId: "j", message: "m", link: "//evil.example/x" } }, SITE);
  assert.equal(off.link, null);
});

test("extension: the background and the page word nothing themselves", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /return captureResultFrom\(res\.status, json, RESUME_MASTER_URL\);/);
  assert.doesNotMatch(bg, /`Captured: \$\{label\}`|Already on your board: /, "the old self-worded success is back");
  // ⭐ T31: the retired popup showed the server's sentence; the page's capture toast shows it now, and the dock's Capture
  // adds no words of its own
  assert.match(bg, /func: showCaptureToast, args: \[result\.message, !!result\.success, toastTheme\(\)\]/);
  assert.match(bg, /capture: async \(tab\) => \{ const r = await captureActiveTab\(tab\); return \{ ok: !!r\?\.success, say: null \}; \}/);
});

test("extension: a remote JSON-LD posting sends 'Remote (United States)', which the gate admits", async () => {
  const src = read("extension/extractor.js").replace(/^export /gm, "");
  const ld = { "@type": "JobPosting", title: "Platform Engineer", hiringOrganization: { name: "Northwind" },
    jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "United States" },
    description: "<p>" + "Ship the platform. ".repeat(20) + "</p>" };
  const el = (text) => ({ textContent: text, innerText: text });
  const document = {
    title: "Platform Engineer - Northwind",
    querySelectorAll: (sel) => (sel.includes("ld+json") ? [el(JSON.stringify(ld))] : []),
    querySelector: () => null,
    createElement: () => { const o = {}; Object.defineProperty(o, "innerHTML", { set(v) { o.innerText = v.replace(/<[^>]+>/g, ""); } }); return o; },
    body: el(""),
  };
  const where = { hostname: "careers.northwind.example", href: "https://careers.northwind.example/jobs/9" };
  const sandbox = { document, window: { location: where }, location: where };
  vm.runInNewContext(`${src}\nresult = extractJobPayload();`, sandbox);
  assert.equal(sandbox.result.ok, true);
  assert.match(sandbox.result.text, /^Location: Remote \(United States\)$/m);
  assert.match(sandbox.result.text, /^Work Type: Remote$/m);
  assert.equal(usEligibility({ location: sandbox.result.location, description: "" }).admit, true);
  // Without the requirement it still says Remote, and that is what the gate judges by description.
  delete ld.applicantLocationRequirements;
  vm.runInNewContext(`${src}\nresult = extractJobPayload();`, sandbox);
  assert.equal(sandbox.result.location, "Remote");
});

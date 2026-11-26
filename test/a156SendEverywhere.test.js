// A156 (45q, the 45q list's (11)) · D180's Send a job where postings appear — the board's list rows and the company page,
// through the ONE picker, only while the network is on. Source pins (the network is off; a walk waits on it being on).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("a156SendOnListRows: the board's rows carry their public path; the row offers Send only with the network on", () => {
  const server = read("server.js");
  const route = server.slice(at(server, 'app.get("/api/jobs", requireAuth'), at(server, "// ── THE BOARD, AS A FUNCTION"));
  assert.match(route, /readPool\.all\(`SELECT id, job_id, company, title FROM scraped_jobs WHERE job_id IN/, "one read, on the workers");
  assert.match(route, /publicPath: pub\.get/);
  const panel = read("client/src/panels/JobsPanel.jsx");
  // 47j R2 (changed on purpose): the bubble's Send left with the classic rows. A row opens its opening sheet (D199 C7), whose
  // Send is the same rule — the network on → the picker; else the job's public path is shared
  assert.match(panel, /onOpen=\{\(job\) => navigateSheet\(job\)\}/);
  const sheet = read("client/src/plate/OpeningSheet.jsx");
  assert.match(sheet, /if \(networkOn\) \{ setPicking\(job\); return; \}/);
  assert.match(sheet, /if \(!job\.publicPath\) \{ setSaid\("This job has no public page yet"\); return; \}/);
  assert.match(panel, /api\("\/api\/network\/status"\)/);
  assert.match(panel, /<SendJobPicker job=\{sending\}/);
});

test("a156SendOnCompanyPage: inside the shell, network on → Send beside each open job, the same picker", () => {
  const page = read("client/src/pages/companies/CompanyPage.jsx");
  assert.match(page, /if \(!inApp\) return undefined;\s*let live = true;\s*api\("\/api\/network\/status"\)/, "signed out never asks");
  assert.match(page, /\{networkOn && <button type="button" className="co__send"/);
  assert.match(page, /<SendJobPicker job=\{sending\}/);
  assert.equal((read("client/src/components/SendJobPicker.jsx").match(/export default function SendJobPicker/g) || []).length, 1, "one picker");
});

#!/usr/bin/env node
// D74 P0 item 3 · WHAT THE CRAWL THROWS AWAY — a re-fetch of the configured boards, classified exactly
// as cacheJobs classifies them, to sample the postings it DROPS. A `dropped` posting (classifyJob found no
// role) is counted in pipeline_runs and stored nowhere, so this is the only way to look at one.
//
//   node scripts/d74DropSample.mjs --companies <json file of company_ats_list rows> [--per 100] [--out <file>]
//
// ⛔ WRITES NOTHING to any database. It calls the same source plugins the crawl calls (public board JSON,
// one request per company, as the daily crawl does), then applies the crawl's two checks in its order:
// usEligibility (the US gate) → classifyJob (collar, role). Output: per source, the counts, and up to
// `per` dropped postings (title, company, url) in a deterministic order for a person to judge.
import fs from "node:fs";
import crypto from "node:crypto";
import greenhouse from "../services/jobs/sources/greenhouse.js";
import lever from "../services/jobs/sources/lever.js";
import ashby from "../services/jobs/sources/ashby.js";
import workable from "../services/jobs/sources/workable.js";
import recruitee from "../services/jobs/sources/recruitee.js";
import { classifyJob } from "../services/jobs/classifyJob.js";
import { usEligibility, officeLocations } from "../services/jobs/usLocation.js";

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const companies = JSON.parse(fs.readFileSync(flag("companies"), "utf8")).filter(c => c.active);
const per = Number(flag("per", 100));
const PLUGINS = { greenhouse, lever, ashby, workable, recruitee };
const order = (s) => crypto.createHash("sha1").update(`d74|${s}`).digest("hex");

const report = {};
for (const [name, plugin] of Object.entries(PLUGINS)) {
  const cos = companies.filter(c => c.ats_type === name);
  if (!cos.length) continue;
  const { jobs } = await plugin.search({ query: "", _companies: cos, pageSize: 300 });
  const counts = { fetched: jobs.length, outOfMarket: 0, blueCollar: 0, dropped: 0, kept: 0 };
  const dropped = [], keptRoles = {};
  for (const job of jobs) {
    const market = usEligibility({ location: job.location, description: job.description, offices: officeLocations(job._raw) });
    if (!market.admit) { counts.outOfMarket++; continue; }
    const v = classifyJob(job.title || "", job.description || "", job.company || "");
    if (v.collar === "blue") { counts.blueCollar++; continue; }
    if (v.roleKey === null) { counts.dropped++; dropped.push({ title: job.title, company: job.company, url: job.url }); continue; }
    counts.kept++; keptRoles[v.roleKey] = (keptRoles[v.roleKey] || 0) + 1;
  }
  dropped.sort((a, b) => order(a.url || a.title).localeCompare(order(b.url || b.title)));
  report[name] = { companies: cos.length, ...counts, keptRoles, sample: dropped.slice(0, per) };
}
const out = flag("out");
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify({ ...v, sample: v.sample.length }));

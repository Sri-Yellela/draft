#!/usr/bin/env node
// D123 P1 — THE AUDIT: what one tailored résumé really costs, and what it does right and wrong. LIVE: it calls the model.
//
// Each run is the EXACT request draft sends (services/toolsServiceRequests.js generateRequest), handed to the tools
// service's OWN generateResume (imported from the sibling checkout, never a copy) with a real Anthropic client from the
// local .env (ANTHROPIC_KEY). So the prompt, the model, the guard and the usage record are production's, byte for byte;
// only the key (local-dev) differs.
//
// ⛔ COUNTS ONLY LEAVE THIS SCRIPT. The JSON it writes holds token counts, character counts, rule names, scores and
// tallies — never a résumé's or a posting's text. --keep-html <dir> additionally saves each generated document for a
// human reading; point it OUTSIDE the repository.
//
// Usage:
//   node scripts/d123LlmAudit.mjs --out <file.json> [--resumes owner,A,B] [--jobs id,id,…] [--mode GENERATE|A_PLUS]
//        [--static] [--tailoring full|lean] [--cache on|off] [--owner-user 15] [--rm ../resume-master] [--db data/resume_master.db] [--keep-html <dir>]
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { generateRequest } from "../services/toolsServiceRequests.js";
import { listProfileClaims } from "../services/profileSignalAggregator.js";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { withPostingText } from "../services/jobs/descriptionText.js";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { leanJobKeywords, fullPostingText } from "../services/leanTailoring.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
  }
  return out;
}
const opt = args(process.argv.slice(2));
if (!opt.out) { console.error("--out <file.json> is required"); process.exit(2); }

// The evaluation set's default ten postings: five software, five ML / data, entry to mid, nine companies.
const DEFAULT_JOBS = [
  "ashby::297b4ece-765f-4eea-b1b8-46057cb6501f", "greenhouse::6042172", "greenhouse::6101145004",
  "ashby::4e64ab86-4e30-403b-b1b9-41dc052570ce", "greenhouse::5704320004",
  "greenhouse::7716341", "greenhouse::4956672008", "greenhouse::8735070002",
  "lever::2196948b-9338-4943-acba-cb529335ed16", "greenhouse::6201407004",
];

const rmDir = path.resolve(ROOT, opt.rm || "../resume-master");
const rm = (p) => import(pathToFileURL(path.join(rmDir, p)).href);
const { generateResume } = await rm("src/generation/generate.js");
const { createAnthropicClient } = await rm("src/model/anthropicCall.js");
const { loadAllPrompts, assemblePrompt } = await rm("src/generation/promptAssembler.js");
const { buildRuntimeInputs } = await rm("src/generation/runtimeInputs.js");
const { getDomainModuleKey } = await rm("src/generation/domainModule.js");
const { costOf } = await rm("src/model/prices.js");
const { htmlToText } = await rm("src/integrity/resumeClaimGuard.js");
const quiet = console.log; console.log = () => {}; loadAllPrompts(); console.log = quiet;

// --static: build and measure every request, send nothing (owner 11-01: "do not do live calls" until the prompt is fixed).
const STATIC = opt.static === true;
const client = STATIC ? null : createAnthropicClient({ apiKey: process.env.ANTHROPIC_KEY, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID });
if (!STATIC && !client) { console.error("no ANTHROPIC_KEY in .env"); process.exit(2); }
const db = new Database(path.resolve(ROOT, opt.db || "data/resume_master.db"), { readonly: true, fileMustExist: true });
const synonyms = (() => { try { return loadConfirmedSynonyms(db); } catch { return null; } })();
const mode = opt.mode || "GENERATE";
const cache = opt.cache === "on" ? undefined : false;
const tailoring = opt.tailoring === "lean" ? "lean" : "full"; // D123 P2: lean = the Haiku JSON-edits call // the interactive Generate sends cache:false (D70 Phase 3)

// ── the résumés ───────────────────────────────────────────────────────────────────────────────
function ownerResume(userId) {
  const dp = db.prepare("SELECT * FROM domain_profiles WHERE user_id=? AND is_active=1").get(userId);
  const profile = db.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId) || {};
  const text = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=? AND user_id=?").get(dp?.id, userId)?.content
    || db.prepare("SELECT content FROM base_resume WHERE user_id=?").get(userId)?.content || "";
  let claims = null; try { claims = listProfileClaims(db, { userId, profileId: dp.id }); } catch { /* none */ }
  return { key: "owner", profile, dp, text, claims };
}
function sampleResume(id) {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial", `sample-${id.toLowerCase()}.json`), "utf8"));
  const c = s.candidate;
  return {
    key: `sample-${id}`,
    profile: { full_name: c.fullName, email: c.email, phone: c.phone, location: c.location, linkedin_url: c.linkedinUrl,
               github_url: c.githubUrl, years_of_experience: c.yearsOfExperience },
    dp: { profile_name: s.label, role_family: s.roleFamily, domain: s.domain, seniority: s.seniority,
          selected_keywords: "[]", selected_tools: "[]", selected_verbs: "[]", include_summary: 0 },
    text: s.resumeText, claims: null,
  };
}
const resumes = String(opt.resumes || "owner,A,B").split(",").map(k => k === "owner" ? ownerResume(Number(opt["owner-user"] || 15)) : sampleResume(k));

const jobIds = opt.jobs ? String(opt.jobs).split(",") : DEFAULT_JOBS;
const jobs = jobIds.map(id => db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(id)).filter(Boolean);
if (jobs.length !== jobIds.length) console.warn(`⚠ ${jobIds.length - jobs.length} job id(s) not found`);

// ── measures (counts only) ────────────────────────────────────────────────────────────────────
const norm = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9%+.#]+/g, " ").trim();
const baseBullets = (text) => String(text).split(/\r?\n/).map(l => l.trim()).filter(l => /^[-•*▪●◦]\s*/.test(l)).map(l => norm(l.replace(/^[-•*▪●◦]\s*/, "")));
const htmlBullets = (html) => [...String(html).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => norm(m[1]));
const numbersIn = (s) => new Set((String(s).match(/\d[\d,.]*\s*%?/g) || []).map(n => n.replace(/[,\s]/g, "").replace(/\.$/, "")));
// Wording a candidate would rarely write about themselves; counted, not judged.
const BUZZ = ["spearhead", "leverag", "synerg", "cutting-edge", "cutting edge", "passionate", "results-driven", "dynamic",
              "robust", "seamless", "innovative", "world-class", "utiliz", "orchestrat", "champion", "pioneer", "cross-functional",
              "best-in-class", "drove", "impactful", "scalable", "end-to-end", "mission-critical", "state-of-the-art"];
const buzz = (s) => { const t = String(s).toLowerCase(); return BUZZ.reduce((n, w) => n + (t.split(w).length - 1), 0); };
const jaccard = (a, b) => { const A = new Set(a.split(" ")), B = new Set(b.split(" ")); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

function ats(job, resumeText, dp) {
  try {
    const family = roleFamilyForTitle(job.normalized_title || job.title || "");
    const tw = loadTermWeights(db, family);
    const r = scoreAtsLocally({ job: withPostingText(job), resumeText, domainProfile: dp, termWeights: tw?.weights?.size ? tw.weights : null, synonyms });
    return { score: r.score, matched: r.tier1_matched || [], missing: r.tier1_missing || [], weighted: !!tw?.weights?.size };
  } catch (e) { return { score: null, error: e.message.slice(0, 80) }; }
}

const JD_MARK = "**TARGET JOB DESCRIPTION**", RESUME_MARK = "**BASE RESUME TEXT**";
function parts(body, includeSummary) {
  const moduleKey = getDomainModuleKey(body.roleFamily, body.domain);
  const runtime = buildRuntimeInputs({ candidate: body.candidate, job: body.job, baseResumeText: body.baseResumeText, mode: body.mode,
                                       employers: body.employers, profile: body.profile, claims: body.claims });
  const { systemBlocks } = assemblePrompt(moduleKey, body.mode, runtime, { SUMMARY: includeSummary });
  const sys = systemBlocks.map(b => b.text.length);
  const jdAt = runtime.indexOf(JD_MARK), resAt = runtime.indexOf(RESUME_MARK);
  return { moduleKey, chars: { "L1 global rules": sys[0] || 0, "L2 domain module": sys[1] || 0, "L3 mode overlay": sys[2] || 0,
    "candidate + profile + claims": jdAt > 0 ? jdAt : 0, "job description": resAt > jdAt ? resAt - jdAt : 0,
    "base résumé": resAt >= 0 ? runtime.length - resAt : 0, "runtime total": runtime.length } };
}

const results = [];
const outPath = path.resolve(opt.out);
const keep = opt["keep-html"] ? path.resolve(opt["keep-html"]) : null;
if (keep) fs.mkdirSync(keep, { recursive: true });
for (const r of resumes) {
  for (const job of jobs) {
    let keywords = null;
    if (tailoring === "lean") {
      const family = roleFamilyForTitle(job.normalized_title || job.title || "");
      const tw = loadTermWeights(db, family);
      const report = scoreAtsLocally({ job: { ...job, description: fullPostingText(job) }, resumeText: r.text, domainProfile: r.dp,
                                       termWeights: tw?.weights?.size ? tw.weights : null, synonyms });
      keywords = leanJobKeywords(db, { job, report, claims: r.claims, resumeText: r.text, synonyms });
    }
    const body = generateRequest({ profile: r.profile, job, baseResumeText: r.text, mode, employers: [], domainProfile: r.dp,
                                   claims: r.claims, includeSummary: r.dp?.include_summary === 1, cache, tailoring, keywords });
    const p = parts(body, r.dp?.include_summary === 1);
    const before = ats(job, r.text, r.dp);
    if (STATIC) {
      results.push({ resume: r.key, job: job.job_id, company: job.company, title: job.title, mode, module: p.moduleKey,
                     promptChars: p.chars, atsBefore: before.score, atsWeighted: before.weighted,
                     jdTerms: (before.matched?.length || 0) + (before.missing?.length || 0), jdTermsMissing: before.missing?.length ?? null,
                     baseBullets: baseBullets(r.text).length, baseChars: r.text.length });
      continue;
    }
    const t0 = Date.now();
    const row = { resume: r.key, job: job.job_id, company: job.company, title: job.title, mode, tailoring, cache: cache !== false,
                  placements: keywords?.placements?.length ?? null,
                  module: p.moduleKey, promptChars: p.chars, atsBefore: before.score, atsWeighted: before.weighted };
    try {
      const g = await generateResume(client, body);
      row.ok = true;
      row.usage = g.usage;
      row.tailoringResult = g.tailoring || null;
      const text = htmlToText(g.html);
      const bb = baseBullets(r.text), hb = htmlBullets(g.html);
      const kept = hb.filter(b => bb.includes(b)).length;
      const reworded = hb.filter(b => !bb.includes(b) && bb.some(x => jaccard(x, b) >= 0.35)).length;
      const newB = hb.length - kept - reworded;
      const baseNums = numbersIn(r.text), outNums = numbersIn(text);
      const after = ats(job, text, r.dp);
      row.out = { htmlChars: g.html.length, textChars: text.length, bullets: hb.length, baseBullets: bb.length,
                  bulletsKept: kept, bulletsReworded: reworded, bulletsUnmatched: newB,
                  baseBulletsDropped: bb.filter(b => !hb.includes(b) && !hb.some(x => jaccard(x, b) >= 0.35)).length,
                  newNumbers: [...outNums].filter(n => !baseNums.has(n)).length, buzzBase: buzz(r.text), buzzOut: buzz(text),
                  hasSummary: /summary|profile/i.test((g.html.match(/<h[1-3][^>]*>[^<]*<\/h[1-3]>/gi) || []).join(" ")) };
      row.atsAfter = after.score;
      row.termsAdded = before.missing ? before.missing.filter(t => (after.matched || []).includes(t)).length : null;
      row.termsStillMissing = after.missing ? after.missing.length : null;
      if (keep) fs.writeFileSync(path.join(keep, `${r.key}__${job.job_id.replace(/[^a-z0-9]+/gi, "_")}.html`), g.html);
    } catch (e) {
      row.ok = false;
      row.error = { code: e.code || e.name, status: e.status ?? null, rules: (e.violations || []).map(v => v.rule || v.code || v.type || "?"), message: e.code === "resume_claim_violation" ? null : String(e.message).slice(0, 160) };
      row.usage = e.usageSoFar || (e.usage ? [e.usage] : []);
    }
    row.ms = Date.now() - t0;
    row.cost = row.usage.reduce((n, u) => n + (costOf(u) || 0), 0);
    results.push(row);
    fs.writeFileSync(outPath, JSON.stringify(results, null, 1));
    const u = row.usage.find(x => x.purpose === "resume_generate") || {};
    quiet(`${r.key.padEnd(9)} ${String(job.company).slice(0, 14).padEnd(14)} ${row.ok ? "ok  " : "FAIL"} in=${u.input_tokens ?? "-"} out=${u.output_tokens ?? "-"} ` +
          `cw=${u.cache_creation_input_tokens ?? 0} cr=${u.cache_read_input_tokens ?? 0} att=${u.attempts} ${(row.cost * 100).toFixed(2)}¢ ${(row.ms / 1000).toFixed(1)}s ` +
          `ats ${row.atsBefore}→${row.atsAfter ?? "-"}${row.ok ? "" : " " + row.error.code + " " + row.error.rules.join(",")}`);
  }
}
if (STATIC) fs.writeFileSync(outPath, JSON.stringify(results, null, 1));
quiet(`wrote ${results.length} rows to ${outPath}`);

#!/usr/bin/env node
// D123 · THE MODEL-COMPARISON HARNESS — the same postings and résumés through any list of tailorings and models, with
// guard pass, valid JSON, ATS lift, cost and latency recorded per run, and unlabelled pairs written for the owner's
// blind check (P6g's acceptance: "today's full call vs the new lean call, sides hidden").
//
// Owner 11-01: "a model-comparison harness that runs the same postings and résumés through any list of providers and
// models … ready to run the moment you add keys." It is d123LlmAudit.mjs's loop, widened:
//
//   • ROUTES — `tailoring[:model]`: full · lean:haiku · lean:sonnet · payload:haiku · payload:sonnet · payload:open · code.
//     Each request is built by draft's OWN generateRequest (services/toolsServiceRequests.js) with keywords from
//     leanJobKeywords (lean) or payloadJobKeywords (payload / code), and handed to the tools service's OWN
//     generateResume, imported from the sibling checkout (never a copy). So the prompt, the checks, the repair and the
//     usage record are production's, byte for byte; only the key differs.
//   • GISTS (P6g (2)) — built ONCE per résumé with generateGists (Sonnet) when any payload route is listed, kept in
//     memory and sent with every payload request; their cost is reported apart (it is paid once per résumé, not per job).
//   • OPEN — an `:open` route needs RM_OPENAI_COMPAT_BASE_URL, RM_OPENAI_COMPAT_API_KEY and RM_OPEN_MODEL in the
//     environment; without them (and always under --dry) it is SKIPPED with the reason printed, never a failed run.
//   • --dry — a fake client: no network, a canned JSON edit for a tailoring call, a canned gist per entry, the base
//     résumé rendered back for the full call. Every row says `dry: true`. It exercises the whole pipeline with no keys.
//
// ⛔ COUNTS ONLY in results.json and summary.md — token counts, scores, rule names, latencies; never a résumé's or a
// posting's text. ⛔ The BLIND PAIRS do carry the documents (a person has to read them), so --out must be OUTSIDE the
// repository; an --out inside it is refused unless --allow-in-repo (tests only). The key that unblinds them
// (blind-key.json) sits beside blind/, never inside it. scripts/d123BlindCheck.mjs reads the key and the owner's picks.
//
// Usage:
//   node scripts/d123CompareModels.mjs --out <dir outside the repo> [--dry]
//        [--routes full,lean:haiku,payload:haiku,payload:sonnet,code] [--resumes owner,A,B] [--jobs id,…]
//        [--pairs full,payload:haiku] [--limit-pairs 20] [--seed 123] [--owner-user 15] [--db data/resume_master.db]
//        [--rm ../resume-master] [--max-cost 3]
//
// ⭐ D171 FIX 5 (45n, owner 11-08 decision (3): "the paid harness run, capped at $3, the cost estimate printed before
// spending") · --max-cost (USD, default 3): the ESTIMATE (calls × each route's typical cost) is printed before the first
// call, and the loop STOPS before any call whose typical cost would take the spend past the cap (spent = the measured
// cost of the calls so far). A dry run spends nothing and ignores the cap.
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
import { leanJobKeywords, payloadJobKeywords, fullPostingText } from "../services/leanTailoring.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_ROUTES = Object.freeze(["full", "lean:haiku", "payload:haiku", "payload:sonnet", "code"]);
export const DEFAULT_PAIRS = Object.freeze(["full", "payload:haiku"]);
// The audit's evaluation set: five software, five ML / data, entry to mid, nine companies.
export const DEFAULT_JOBS = Object.freeze([
  "ashby::297b4ece-765f-4eea-b1b8-46057cb6501f", "greenhouse::6042172", "greenhouse::6101145004",
  "ashby::4e64ab86-4e30-403b-b1b9-41dc052570ce", "greenhouse::5704320004",
  "greenhouse::7716341", "greenhouse::4956672008", "greenhouse::8735070002",
  "lever::2196948b-9338-4943-acba-cb529335ed16", "greenhouse::6201407004",
]);
const TAILORINGS = new Set(["full", "lean", "payload", "code"]);
const MODELS = new Set(["haiku", "sonnet", "open"]);

/** "payload:haiku" → { name, tailoring: "payload", model: "haiku" }; refuses what the tools service would refuse. */
export function parseRoute(name) {
  const [tailoring, model = null, extra] = String(name).trim().split(":");
  if (!TAILORINGS.has(tailoring) || extra !== undefined) throw new Error(`unknown route "${name}"`);
  if (model !== null && !MODELS.has(model)) throw new Error(`route "${name}": model must be haiku, sonnet or open`);
  if (model && (tailoring === "full" || tailoring === "code")) throw new Error(`route "${name}": ${tailoring} takes no model`);
  return { name: String(name).trim(), tailoring, model };
}

/** Why an :open route cannot run here, or null. */
export function openSkipReason(env, dry) {
  if (dry) return "dry run: the open provider's client lives in the tools service and is not faked";
  const missing = ["RM_OPENAI_COMPAT_BASE_URL", "RM_OPENAI_COMPAT_API_KEY", "RM_OPEN_MODEL"].filter(k => !env[k]);
  return missing.length ? `not configured (${missing.join(", ")} unset)` : null;
}

// ── measures (counts only) ────────────────────────────────────────────────────────────────────
const median = (a) => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { const s = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null; };
/** Dollars for a list of usage rows, or null when any row is unpriced — a null is a visible gap, never $0. */
export function costOfAll(usage, costOf) {
  let n = 0;
  for (const u of usage || []) { const c = costOf(u); if (c == null) return null; n += c; }
  return n;
}

/** A seeded RNG (mulberry32): the same --seed draws the same sides, so a rerun can be checked. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * The fake model for --dry. Tells the three calls apart by their system prompt: the gist call (one canned line per
 * entry id it was sent), a tailoring call (an empty, valid edit — every check passes, nothing changes) and the full
 * call (the current base résumé rendered by the tools service's own renderer, so the claim guard sees honest HTML).
 */
function dryClient({ render, current }) {
  const calls = [];
  return { calls, messages: { create: async (params) => {
    calls.push({ model: params.model });
    const system = typeof params.system === "string" ? params.system : (params.system || []).map(b => b?.text || "").join("\n");
    const user = (params.messages || []).map(m => (typeof m.content === "string" ? m.content : (m.content || []).map(c => c.text || "").join(""))).join("\n");
    let text;
    if (/^For each employer entry of a resume/.test(system)) {
      text = JSON.stringify(Object.fromEntries([...user.matchAll(/^\[(e\d+)\]/gm)].map(m => [m[1], "Worked on the software systems this entry describes."])));
    } else if (/You tailor an existing resume/.test(system)) {
      text = JSON.stringify({ bullets: {} });
    } else {
      text = render(current.text);
    }
    return { content: [{ type: "text", text }], usage: { input_tokens: Math.ceil((system.length + user.length) / 4), output_tokens: Math.ceil(text.length / 4) } };
  } } };
}

function insideRepo(dir) {
  const rel = path.relative(ROOT.toLowerCase(), path.resolve(dir).toLowerCase());
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** One pair: two documents side by side, Left and Right, nothing that names a route, a model or a cost. */
function pairHtml(id, leftHtml, rightHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${id}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#eee}h1{font-size:16px;margin:12px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 12px 12px}.col h2{font-size:14px;margin:6px 0}
iframe{width:100%;height:85vh;border:1px solid #999;background:#fff}</style></head><body>
<h1>${id} — which résumé would you send?</h1><div class="cols">
<div class="col"><h2>Left</h2><iframe sandbox srcdoc="${esc(leftHtml)}"></iframe></div>
<div class="col"><h2>Right</h2><iframe sandbox srcdoc="${esc(rightHtml)}"></iframe></div>
</div></body></html>`;
}

/** The index: a Left / Right / Tie choice per pair and a button that saves picks.json. No network. */
function indexHtml(ids) {
  const rows = ids.map(id => `<tr><td><a href="${id}.html" target="_blank">${id}</a></td>${["left", "right", "tie"].map(v =>
    `<td><label><input type="radio" name="${id}" value="${v}"> ${v[0].toUpperCase() + v.slice(1)}</label></td>`).join("")}</tr>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Blind check</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}td{padding:4px 12px}</style></head><body>
<h1>Blind check</h1><p>Open each pair, read both sides, pick the one you would send (or Tie). Then save your picks and hand
picks.json to <code>scripts/d123BlindCheck.mjs</code>.</p>
<table>${rows}</table><p><button id="save">Save picks.json</button> <span id="n"></span></p>
<script>
const ids = ${JSON.stringify(ids)};
function picks() { const o = {}; for (const id of ids) { const c = document.querySelector('input[name="' + id + '"]:checked'); if (c) o[id] = c.value; } return o; }
document.addEventListener("change", () => { document.getElementById("n").textContent = Object.keys(picks()).length + " of " + ids.length + " picked"; });
document.getElementById("save").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(picks(), null, 1)], { type: "application/json" }));
  a.download = "picks.json"; a.click();
};
</script></body></html>`;
}

function summaryMd(results, gistCosts, skipped, dry) {
  const routes = [...new Set(results.map(r => r.route))];
  const f = (x, d = 1) => (x == null ? "–" : Number(x).toFixed(d));
  let md = `# D123 model comparison${dry ? " (DRY RUN — fake model, numbers are not real)" : ""}\n\n`;
  md += "| route | n | ok | guard pass | valid JSON | median ATS lift | median ¢ | p90 ¢ | median s | repairs | model not called |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
  for (const route of routes) {
    const rows = results.filter(r => r.route === route);
    const share = (k) => `${Math.round(100 * rows.filter(r => r[k]).length / rows.length)} %`;
    const cents = rows.map(r => (r.cost == null ? null : r.cost * 100));
    md += `| ${route} | ${rows.length} | ${share("ok")} | ${share("guardPass")} | ${share("validJson")} | ${f(median(rows.map(r => r.lift)))} | ` +
          `${f(median(cents), 2)} | ${f(pct(cents, 0.9), 2)} | ${f(median(rows.map(r => r.ms / 1000)))} | ${rows.filter(r => r.repaired).length} | ` +
          `${rows.filter(r => r.modelCalled === false).length} |\n`;
  }
  if (Object.keys(gistCosts).length) {
    md += "\n**Gists (once per résumé, Sonnet):** " + Object.entries(gistCosts).map(([k, v]) => `${k} ${v.cost == null ? "unpriced" : `${(v.cost * 100).toFixed(2)}¢`} (${v.gists} gists)`).join(" · ") + "\n";
  }
  if (skipped.length) md += "\n**Skipped:** " + skipped.map(s => `${s.route} — ${s.reason}`).join(" · ") + "\n";
  return md;
}

/**
 * Runs the comparison. Everything the CLI does, importable for the test.
 * @returns { results, skipped, pairs: number, outDir }
 */
export async function runCompare(opts = {}) {
  const outDir = path.resolve(opts.out || "");
  if (!opts.out) throw new Error("--out <dir> is required");
  if (insideRepo(outDir) && !opts.allowInRepo) throw new Error(`--out ${outDir} is inside the repository; the blind pairs carry résumé text — choose a directory outside it`);
  const env = opts.env || process.env;
  const dry = opts.dry === true;
  const log = opts.log || console.log;
  const routes = (opts.routes || DEFAULT_ROUTES).map(parseRoute);
  const pairRoutes = opts.pairs || DEFAULT_PAIRS;
  const limitPairs = Number(opts.limitPairs ?? 20);

  const rmDir = path.resolve(ROOT, opts.rm || "../resume-master");
  const rm = (p) => import(pathToFileURL(path.join(rmDir, p)).href);
  const { generateResume, generateGists } = await rm("src/generation/generate.js");
  const { createAnthropicClient } = await rm("src/model/anthropicCall.js");
  const { loadAllPrompts } = await rm("src/generation/promptAssembler.js");
  const { costOf } = await rm("src/model/prices.js");
  const { htmlToText } = await rm("src/integrity/resumeClaimGuard.js");
  const { buildStructuredResume, renderStructuredResume } = await rm("src/formatting/resumeFormatter.js");
  const quiet = console.log; console.log = () => {}; try { loadAllPrompts(); } finally { console.log = quiet; }

  const current = { text: "" };
  const client = dry ? dryClient({ render: (t) => renderStructuredResume(buildStructuredResume(t)), current })
    : createAnthropicClient({ apiKey: env.ANTHROPIC_KEY, workspaceId: env.ANTHROPIC_WORKSPACE_ID });
  if (!client) throw new Error("no ANTHROPIC_KEY in .env (or run with --dry)");

  const db = opts.db || new Database(path.resolve(ROOT, opts.dbPath || "data/resume_master.db"), { readonly: true, fileMustExist: true });
  const synonyms = (() => { try { return loadConfirmedSynonyms(db); } catch { return null; } })();
  const weightsFor = (job) => { try { const tw = loadTermWeights(db, roleFamilyForTitle(job.normalized_title || job.title || "")); return tw?.weights?.size ? tw.weights : null; } catch { return null; } };

  // ── the résumés (d123LlmAudit.mjs's loaders) ─────────────────────────────────────────────────
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
  const resumes = (opts.resumes || ["owner", "A", "B"]).map(k => (k === "owner" ? ownerResume(Number(opts.ownerUser || 15)) : sampleResume(k)));
  const jobIds = opts.jobs || DEFAULT_JOBS;
  const jobs = jobIds.map(id => db.prepare("SELECT * FROM scraped_jobs WHERE job_id=?").get(id)).filter(Boolean);
  if (jobs.length !== jobIds.length) log(`⚠ ${jobIds.length - jobs.length} job id(s) not found`);

  function ats(job, resumeText, dp) {
    try { return scoreAtsLocally({ job: withPostingText(job), resumeText, domainProfile: dp, termWeights: weightsFor(job), synonyms }).score; }
    catch { return null; }
  }
  function report(job, r) {
    return scoreAtsLocally({ job: { ...job, description: fullPostingText(job) }, resumeText: r.text, domainProfile: r.dp, termWeights: weightsFor(job), synonyms });
  }

  const skipped = [];
  const runnable = routes.filter(rt => {
    const why = rt.model === "open" ? openSkipReason(env, dry) : null;
    if (why) { skipped.push({ route: rt.name, reason: why }); log(`skip ${rt.name}: ${why}`); }
    return !why;
  });

  // ⭐ D171 FIX 5 · the cap and the estimate — typical cost per call by route (D170 (2): the full A+ / Generate call on
  // Sonnet ≈ 6¢; a lean / payload edit on Haiku ≈ 1¢, on Sonnet ≈ 3¢; code calls no model), gists ≈ 3¢ a résumé.
  const maxCost = Number(opts.maxCost ?? 3);
  const typical = (rt) => (rt.tailoring === "code" ? 0 : rt.tailoring === "full" ? 0.06 : rt.model === "sonnet" ? 0.03 : 0.01);
  const estimate = resumes.length * jobs.length * runnable.reduce((a, rt) => a + typical(rt), 0)
    + (runnable.some(rt => rt.tailoring === "payload") ? resumes.length * 0.03 : 0);
  log(`ESTIMATE: ${resumes.length} résumés × ${jobs.length} postings × ${runnable.map(r => r.name).join(" + ")} ≈ $${estimate.toFixed(2)}` +
      (dry ? " (dry — nothing spent)" : ` · cap $${maxCost.toFixed(2)}${estimate > maxCost ? " — the cap will stop it early" : ""}`));
  let spent = 0, capped = false;

  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  const docs = new Map();          // `${resume}|${job}` → { route: html } — for the blind pairs only, never written raw
  const gistCosts = {};
  const wantGists = runnable.some(rt => rt.tailoring === "payload");
  for (const r of resumes) {
    current.text = r.text;
    let gists = [];
    if (wantGists) {
      try {
        const g = await generateGists(client, { baseResumeText: r.text });
        gists = g.gists;
        gistCosts[r.key] = { cost: costOfAll(g.usage, costOf), gists: g.gists.length, numberless: g.numberless.length };
      } catch (e) {
        gistCosts[r.key] = { cost: costOfAll(e.usageSoFar || [], costOf), gists: 0, error: e.code || e.name };
        log(`⚠ gists for ${r.key} failed (${e.code || e.name}); payload runs without them`);
      }
    }
    for (const job of jobs) {
      if (capped) break;
      const atsBefore = ats(job, r.text, r.dp);
      let rep = null;
      try { rep = report(job, r); } catch { rep = null; }
      for (const rt of runnable) {
        if (!dry && spent + typical(rt) > maxCost) { capped = true; log(`⛔ cap: $${spent.toFixed(2)} spent, the next ${rt.name} call would pass $${maxCost.toFixed(2)} — stopping`); break; }
        let keywords = null;
        if (rt.tailoring !== "full" && rep) {
          try {
            keywords = rt.tailoring === "lean"
              ? leanJobKeywords(db, { job, report: rep, claims: r.claims, resumeText: r.text, synonyms })
              : payloadJobKeywords(db, { job, report: rep, claims: r.claims, resumeText: r.text, synonyms });
          } catch { keywords = null; }
        }
        const row = { route: rt.name, tailoring: rt.tailoring, modelAsked: rt.model, resume: r.key, job: job.job_id,
                      company: job.company, ...(dry ? { dry: true } : {}), atsBefore };
        if (rt.tailoring !== "full" && !keywords) {
          Object.assign(row, { ok: false, guardPass: false, validJson: false, error: { code: "no_keywords" }, usage: [], cost: null, ms: 0 });
          results.push(row); continue;
        }
        const body = generateRequest({ profile: r.profile, job, baseResumeText: r.text, mode: "GENERATE", employers: [], domainProfile: r.dp,
                                       claims: r.claims, includeSummary: r.dp?.include_summary === 1, cache: false,
                                       tailoring: rt.tailoring, keywords, model: rt.model, gists: rt.tailoring === "payload" ? gists : null });
        const t0 = Date.now();
        try {
          const g = await generateResume(client, body, { env });
          const t = g.tailoring || null;
          const refused = (t?.refused || []).map(x => x.kind);
          const after = ats(job, htmlToText(g.html), r.dp);
          Object.assign(row, {
            ok: true, modelUsed: t ? t.model : (g.usage.find(u => u.purpose === "resume_generate")?.model ?? null),
            guardPass: refused.length === 0, validJson: !refused.includes("unreadable_answer"),
            repaired: !!t?.repaired, refused, changed: t?.changed ?? null, added: t?.added ?? null,
            modelCalled: t ? (t.modelCalled ?? true) : true, atsAfter: after, lift: after != null && atsBefore != null ? after - atsBefore : null,
            usage: g.usage,
          });
          const k = `${r.key}|${job.job_id}`;
          if (!docs.has(k)) docs.set(k, {});
          docs.get(k)[rt.name] = g.html;
        } catch (e) {
          Object.assign(row, { ok: false, guardPass: false, validJson: e.code !== "resume_claim_violation" ? false : true,
            error: { code: e.code || e.name, status: e.status ?? null, rules: (e.violations || []).map(v => v.rule || v.code || v.type || "?"),
                     message: e.code === "resume_claim_violation" ? null : String(e.message).slice(0, 160) },
            usage: e.usageSoFar || (e.usage ? [e.usage] : []) });
        }
        row.ms = Date.now() - t0;
        row.cost = costOfAll(row.usage, costOf);
        if (row.cost != null) spent += row.cost;
        row.usage = row.usage.map(u => ({ purpose: u.purpose, model: u.model, input_tokens: u.input_tokens, output_tokens: u.output_tokens,
          cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens, attempts: u.attempts }));
        results.push(row);
        fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ dry, gistCosts, skipped, results }, null, 1));
        log(`${r.key.padEnd(9)} ${String(job.company).slice(0, 14).padEnd(14)} ${rt.name.padEnd(15)} ${row.ok ? "ok  " : "FAIL"} ` +
            `${row.cost == null ? "unpriced" : `${(row.cost * 100).toFixed(2)}¢`} ${(row.ms / 1000).toFixed(1)}s ats ${atsBefore}→${row.atsAfter ?? "-"}` +
            `${row.ok ? "" : ` ${row.error.code}`}`);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ dry, gistCosts, skipped, results, spent, maxCost, capped }, null, 1));
  fs.writeFileSync(path.join(outDir, "summary.md"), summaryMd(results, gistCosts, skipped, dry));
  log(`SPENT: $${spent.toFixed(2)}${dry ? " (dry)" : ` of the $${maxCost.toFixed(2)} cap${capped ? " — stopped by the cap" : ""}`}`);

  // ── the blind pairs ─────────────────────────────────────────────────────────────────────────
  const [a, b] = pairRoutes;
  const draw = rng(Number(opts.seed ?? 123));
  const key = {};
  const blindDir = path.join(outDir, "blind");
  let n = 0;
  for (const [k, byRoute] of docs) {
    if (n >= limitPairs) break;
    if (!byRoute[a] || !byRoute[b]) continue;
    const id = `pair-${String(++n).padStart(2, "0")}`;
    const [left, right] = draw() < 0.5 ? [a, b] : [b, a];
    const [resume, job] = k.split("|");
    const rowOf = (route) => results.find(x => x.route === route && x.resume === resume && x.job === job);
    key[id] = { left, right, resume, job, atsBefore: rowOf(a)?.atsBefore ?? null,
                atsAfter: { [a]: rowOf(a)?.atsAfter ?? null, [b]: rowOf(b)?.atsAfter ?? null },
                cost: { [a]: rowOf(a)?.cost ?? null, [b]: rowOf(b)?.cost ?? null } };
    fs.mkdirSync(blindDir, { recursive: true });
    fs.writeFileSync(path.join(blindDir, `${id}.html`), pairHtml(id, byRoute[left], byRoute[right]));
  }
  if (n) {
    fs.writeFileSync(path.join(blindDir, "index.html"), indexHtml(Object.keys(key)));
    fs.writeFileSync(path.join(outDir, "blind-key.json"), JSON.stringify({ pairs: [a, b], seed: Number(opts.seed ?? 123), key }, null, 1));
  }
  if (!opts.db) db.close();
  log(`wrote ${results.length} rows, ${n} blind pairs to ${outDir}`);
  return { results, skipped, pairs: n, outDir, gistCosts };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────
function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next && !next.startsWith("--") ? (i++, next) : true;
  }
  return out;
}
const list = (v) => (v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : undefined);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });
  const o = args(process.argv.slice(2));
  console.warn("⚠ the blind pairs carry résumé text: --out must be a directory OUTSIDE the repository.");
  runCompare({ out: o.out, dry: o.dry === true, routes: list(o.routes), resumes: list(o.resumes), jobs: list(o.jobs), pairs: list(o.pairs),
               limitPairs: o["limit-pairs"], maxCost: o["max-cost"], seed: o.seed, ownerUser: o["owner-user"], dbPath: o.db, rm: o.rm, allowInRepo: o["allow-in-repo"] === true })
    .catch(e => { console.error(e.message); process.exit(2); });
}

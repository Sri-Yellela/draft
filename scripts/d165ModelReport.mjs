#!/usr/bin/env node
// scripts/d165ModelReport.mjs — ⛔ D165 A2 / A6 (6) · WHICH MODEL AND PROMPT EACH RÉSUMÉ PATH REALLY USES, regenerated.
//
// Owner 11-06: "i dont even know if … the prompt we modified is active now … and if the model has been switched to haiku".
// The answer was worked out by hand in 45a's audit; this writes it from the source every time:
//   · draft side — how a generation picks lean vs full (services/leanTailoring.js) and that the apply path calls the full
//     route (server.js generateResumeForApply → coreGenerateResume);
//   · the tools service — its model constants and which route uses which (src/model/anthropicCall.js, src/generation/
//     generate.js, tailor.js), and whether the full prompt carries prompts/bullet_craft.md (promptAssembler.js);
//   · live — resumemaster.one /v1/version (its commit) and draft's /api/version (its commit), unless --offline.
// ⚠ What it CANNOT read: production's DRAFT_TAILORING / Admin → Ops → Tailoring value (a production read). It says so.
//
// Usage: node scripts/d165ModelReport.mjs [--offline] [--rm <path to resume-master>] [--out docs/D165_MODEL_REPORT.md]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const offline = args.includes("--offline");
const RM = path.resolve(opt("--rm", path.join(ROOT, "..", "resume-master")));
const OUT = path.resolve(ROOT, opt("--out", "docs/D165_MODEL_REPORT.md"));

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const find = (src, re) => (src ? (re.exec(src)?.[1] ?? null) : null);

export function draftFacts(root = ROOT) {
  const server = read(path.join(root, "server.js")) || "";
  const lean = read(path.join(root, "services", "leanTailoring.js")) || "";
  return {
    applyCallsFullRoute: /function generateResumeForApply[\s\S]*?coreGenerateResume\(/.test(server),
    applyRetriesClaimOnce: /e\?\.code !== "resume_claim_violation"/.test(server),
    leanSwitch: /DRAFT_TAILORING/.test(lean) ? "Admin → Ops → Tailoring (app_settings) wins over DRAFT_TAILORING; else full" : "not found",
  };
}

export function toolsFacts(rm = RM) {
  const call = read(path.join(rm, "src", "model", "anthropicCall.js"));
  if (!call) return { available: false };
  const gen = read(path.join(rm, "src", "generation", "generate.js")) || "";
  const tailor = read(path.join(rm, "src", "generation", "tailor.js")) || "";
  const asm = read(path.join(rm, "src", "generation", "promptAssembler.js")) || "";
  const sonnet = find(call, /export const MODEL_SONNET = "([^"]+)"/);
  const haiku = find(call, /export const MODEL_HAIKU = "([^"]+)"/);
  const tailorModel = find(tailor, /export const TAILOR_MODEL = (MODEL_\w+)/);
  const repairModel = find(tailor, /export const TAILOR_REPAIR_MODEL = (MODEL_\w+)/);
  const name = (c) => (c === "MODEL_SONNET" ? sonnet : c === "MODEL_HAIKU" ? haiku : c);
  return {
    available: true, sonnet, haiku,
    generateModel: /model: MODEL_SONNET/.test(gen) ? sonnet : /model: MODEL_HAIKU/.test(gen) ? haiku : null,
    generateFallback: /model: MODEL_HAIKU/.test(gen) && /model: MODEL_SONNET/.test(gen) ? haiku : null,
    tailorModel: name(tailorModel), tailorRepairModel: name(repairModel),
    fullPromptHasBulletCraft: /bullet_craft/.test(asm),
    leanPromptHasBulletCraft: /bullet_craft|BULLET_CRAFT/.test(tailor),
    bulletCraftFile: fs.existsSync(path.join(rm, "prompts", "bullet_craft.md")),
  };
}

async function live() {
  if (offline) return { tools: "not read (--offline)", draft: "not read (--offline)" };
  const get = async (u) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(10000) }); return r.ok ? await r.json() : null; } catch { return null; } };
  const t = await get("https://resumemaster.one/v1/version");
  const d = await get("https://jobsviadraft.com/api/version");
  return { tools: t ? `${String(t.commit || "").slice(0, 7)} (scorer ${t.scorer}, llmFormat ${t.llmFormat})` : "unreachable",
           draft: d ? `${d.commit} (started ${d.startedAt})` : "unreachable" };
}

export function renderReport({ d, t, l, at = new Date().toISOString() }) {
  const yes = (b) => (b ? "yes" : "NO");
  const rows = [
    ["Apply runs (Draft, Ask me first, Apply for me)", "full generate route", t.available ? t.generateModel : "?", t.available ? `layer 1 + domain module + mode overlay; bullet_craft.md: ${yes(t.fullPromptHasBulletCraft)}` : "?", `draft calls the full route: ${yes(d.applyCallsFullRoute)}; one retry on a withheld résumé: ${yes(d.applyRetriesClaimOnce)}`],
    ["Posting → Résumé for this job (full)", "full generate route", t.available ? t.generateModel : "?", t.available ? `bullet_craft.md: ${yes(t.fullPromptHasBulletCraft)}` : "?", d.leanSwitch],
    ["Posting → Résumé for this job (lean)", "lean tailor route", t.available ? t.tailorModel : "?", t.available ? `bullet_craft.md: ${yes(t.leanPromptHasBulletCraft)}` : "?", `repair pass: ${t.available ? t.tailorRepairModel : "?"}`],
  ];
  return [
    "# D165 — which model and prompt each résumé path uses",
    "",
    `Generated by \`scripts/d165ModelReport.mjs\` at ${at}. Do not edit by hand: re-run the script.`,
    "",
    "| Path | Route | Model | Prompt | Notes |",
    "|---|---|---|---|---|",
    ...rows.map(r => `| ${r.join(" | ")} |`),
    "",
    `- Live: the tools service ${l.tools}; draft ${l.draft}.`,
    `- The tools service's models: Sonnet = \`${t.sonnet ?? "?"}\`, Haiku = \`${t.haiku ?? "?"}\`${t.available ? "" : " (resume-master not found next to draft; pass --rm)"}.`,
    "- ⚠ Not read: production's `DRAFT_TAILORING` / Admin → Ops → Tailoring value (a production read). Lean is used only when that switch says so; the 11-06 Prophetic run's log shows the full route on Sonnet.",
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const d = draftFacts(), t = toolsFacts(), l = await live();
  const md = renderReport({ d, t, l });
  fs.writeFileSync(OUT, md);
  console.log(md);
  console.log(`[d165ModelReport] wrote ${path.relative(ROOT, OUT)}`);
}

#!/usr/bin/env node
// D84 F9 — re-run after each enrichment batch: node scripts/d84ExtractorMeasure.mjs <export.jsonl> <filled.jsonl>
// First run 10-09 on the rehearsal 20: precision 44.8%, recall 33.8% (vocabulary coverage 34% of the model's hard skills).
// D84 F9 — a deterministic phrase-match extractor (the scorer's skills vocabulary + the F6 alias groups, no model)
// against the MODEL's skills on the owner's 20 filled rows. Micro-averaged precision / recall, per-row detail.
import fs from "node:fs";
import { skillVocabularyTerms } from "@draft/ats-scorer";
import { SKILL_GROUPS, canonicalSkill } from "../shared/skillAliases.js";

const [exportPath, filledPath] = process.argv.slice(2);
const rows = (p) => fs.readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim().startsWith("{")).map((l) => JSON.parse(l)).filter((o) => o.job_id);
const exp = new Map(rows(exportPath).map((o) => [o.job_id, o]));
const filled = rows(filledPath);

const vocab = new Map(skillVocabularyTerms().map((t) => [t.toLowerCase(), t]));
const surface = new Map();                          // phrase (lowercase) -> canonical
for (const [k, v] of vocab) surface.set(k, v);
for (const g of SKILL_GROUPS) for (const n of g) surface.set(n.toLowerCase(), canonicalSkill(n, vocab).name);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = [...surface].filter(([p]) => p.length >= 2).map(([p, c]) => [new RegExp(`(^|[^a-z0-9+#.])${esc(p)}(?=$|[^a-z0-9+#])`, "i"), c]);

const norm = (s) => canonicalSkill(s, vocab).name.toLowerCase();
let tp = 0, fp = 0, fn = 0, modelHard = 0, modelInVocab = 0;
const missed = new Map(), extra = new Map();
for (const f of filled) {
  const e = exp.get(String(f.job_id));
  if (!e) continue;
  const text = `${e.source?.title ?? ""}\n${e.source?.description ?? ""}`;
  const got = new Set(patterns.filter(([re]) => re.test(text)).map(([, c]) => c.toLowerCase()));
  const skills = (f.enrichment?.skills_json ?? []).map((s) => (typeof s === "string" ? { skill: s, type: "hard" } : s));
  const hard = skills.filter((s) => s.type !== "soft");
  modelHard += hard.length;
  const want = new Set(hard.map((s) => norm(s.skill)));
  for (const w of want) if (vocab.has(w) || [...surface.values()].some((c) => c.toLowerCase() === w)) modelInVocab++;
  for (const g of got) (want.has(g) ? tp++ : (fp++, extra.set(g, (extra.get(g) || 0) + 1)));
  for (const w of want) if (!got.has(w)) { fn++; missed.set(w, (missed.get(w) || 0) + 1); }
}
const P = tp / (tp + fp), R = tp / (tp + fn);
console.log(`rows ${filled.length} · model hard skills ${modelHard} (${modelInVocab} of them are vocabulary terms)`);
console.log(`extractor vs model (hard skills): precision ${(100 * P).toFixed(1)}% · recall ${(100 * R).toFixed(1)}% · tp ${tp} fp ${fp} fn ${fn}`);
const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k}(${n})`).join(", ");
console.log(`the model named, the extractor missed: ${top(missed)}`);
console.log(`the extractor found, the model did not name: ${top(extra)}`);

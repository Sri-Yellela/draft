#!/usr/bin/env node
// D72 P0 · THE FIRST GOLD SET — a sample per dimension for a person to grade (strategy §8, §13.3).
// ⛔ READ-ONLY on the database. Writes CSVs to an OUTPUT DIRECTORY you name (default data/d72-gold/,
// which is gitignored: the files carry posting excerpts and are working material, not repository content).
//
//   node scripts/d72GoldExport.mjs [--db <path>] [--out <dir>] [--per 50] [--seed d72]
//
// One file per dimension: dimension,job_id,content_hash,url,title,company,location,extracted,gold,note,excerpt
//   extracted  what the tagger holds now (blank = it says UNKNOWN)
//   gold       ← THE GRADER WRITES THIS: the posting's true value in the dimension's vocabulary (README.txt),
//              or `none` when the posting does not state it. Leave blank to skip a row.
// The sample is STRATIFIED — half rows the tagger filled, half it left unknown — because precision is
// measured on the first half and RECALL needs the second: a tagger that says nothing is never "wrong"
// on precision alone. Deterministic for a seed (a hash order), so a re-export is the same sample.
// scripts/d72P0Measure.mjs --gold <dir> reads the graded files back; nothing is imported into the database.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { salaryLabel, yearsAsked } from "../shared/postingFacts.js";

const argv = process.argv.slice(2);
const flag = (k, dflt) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : dflt; };
const dataDir = process.env.RM_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = flag("db", path.join(dataDir, "resume_master.db"));
const out = flag("out", path.join(dataDir, "d72-gold"));
const per = Number(flag("per", 50));
const seed = flag("seed", "d72");
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const placesOf = db.prepare("SELECT country, state, metro FROM job_tag_places WHERE job_id = ?");
const placeText = (id) => placesOf.all(id).map(p => p.metro ? `metro:${p.metro}` : p.state ? `state:${p.state}` : p.country === "US" ? "us" : "non_us").join(";");

// What the tagger holds now, per dimension — blank means it says UNKNOWN.
const DIMS = {
  level:            { vocab: "intern | entry | mid | senior | lead | executive",           get: (r) => r.tag_level },
  workstyle:        { vocab: "remote | hybrid | onsite",                                   get: (r) => r.tag_workplace },
  employment_type:  { vocab: "full-time | contract | internship | part-time",              get: (r) => r.tag_employment, hint: /\b(?:contract|intern(?:ship)?|part[- ]time|full[- ]time|temporary)\b/i },
  function:         { vocab: "engineering | data | design | product | marketing | sales | operations | finance | people | legal", get: (r) => r.tag_function },
  location_country: { vocab: "us | non_us | remote_unqualified",                           get: (r) => (r.tag_us && r.tag_us !== "unknown" ? r.tag_us : "") },
  location_place:   { vocab: "metro:<key> or state:<XX>, ';'-separated (the job-tags export format)", get: (r) => placeText(r.job_id) },
  pay:              { vocab: "as the deck prints it: $143.7k–$194.4k · $45–$60 /hr · CAD 63.9k–79.9k", get: (r) => salaryLabel(mapJobRow(r)) || "", hint: /\$\s?\d|\bsalary\b|\bcompensation\b|\bpay range\b/i },
  years_required:   { vocab: "the minimum years asked, a number (4), or a range (3-5)",    get: (r) => { const y = yearsAsked(r.text); return y ? String(y.min ?? y.label ?? "") : ""; }, hint: /\byears?\b/i },
  citizenship:      { vocab: "citizen_only | us_person | none_stated",                      get: (r) => (r.req_citizenship && r.req_citizenship !== "none_stated" ? r.req_citizenship : ""), hint: /\bcitizen|\bU\.?S\.? person|\bITAR\b|\bexport control/i },
  clearance:        { vocab: "public_trust | secret | top_secret | ts_sci | unspecified",   get: (r) => (r.req_clearance && r.req_clearance !== "none" ? r.req_clearance : ""), hint: /\bclearance\b|\bsecret\b|\bpolygraph\b|\bpublic trust\b/i },
};

const rows = db.prepare(`SELECT sj.*, COALESCE(sj.description_text, sj.description) AS text FROM scraped_jobs sj
                         WHERE sj.is_active = 1 AND sj.description IS NOT NULL`).all();
const order = (id, dim) => crypto.createHash("sha1").update(`${seed}|${dim}|${id}`).digest("hex");
const csv = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const excerpt = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 1200);

fs.mkdirSync(out, { recursive: true });
const summary = {};
for (const [dim, spec] of Object.entries(DIMS)) {
  const withVal = [], without = [];
  for (const r of rows) (spec.get(r) ? withVal : without).push(r);
  const pick = (list, k) => list.sort((a, b) => order(a.job_id, dim).localeCompare(order(b.job_id, dim))).slice(0, k);
  const half = Math.floor(per / 2);
  const a = pick(withVal, Math.min(half, withVal.length));
  // ⭐ RECALL is measured where a miss would hide: for a dimension with a `hint`, the unknown half leans on
  // rows whose text uses the dimension's words (citizenship's 45 random unknowns would all be true "none").
  const hinted = spec.hint ? without.filter(r => spec.hint.test(r.text || "")) : [];
  const bHint = pick(hinted, Math.min(hinted.length, Math.ceil((per - a.length) * 0.8)));
  const rest = without.filter(r => !bHint.includes(r));
  const b = [...bHint, ...pick(rest, per - a.length - bHint.length)];
  const sample = [...a, ...b].sort((x, y) => order(x.job_id, dim + "/mix").localeCompare(order(y.job_id, dim + "/mix")));
  const lines = ["dimension,job_id,content_hash,url,title,company,location,extracted,gold,note,excerpt"];
  for (const r of sample) lines.push([dim, r.job_id, r.content_hash, r.url, r.title, r.company, r.location, spec.get(r), "", "", excerpt(r.text)].map(csv).join(","));
  fs.writeFileSync(path.join(out, `${dim}.csv`), lines.join("\n") + "\n");
  summary[dim] = { rows: sample.length, extracted: a.length, unknown: b.length, unknownWithHint: bHint.length, populationFilled: withVal.length, population: rows.length };
}
fs.writeFileSync(path.join(out, "README.txt"), [
  "D72 P0 gold set — grade the `gold` column of each CSV. Leave a row blank to skip it.",
  "Write the posting's TRUE value in the dimension's vocabulary, or `none` when the posting does not state it.",
  "Judge from the posting itself (open the url) — the excerpt is the first 1,200 characters only.",
  "Then: node scripts/d72P0Measure.mjs --gold <this folder>", "",
  ...Object.entries(DIMS).map(([k, v]) => `${k}: ${v.vocab}`),
].join("\n") + "\n");
console.log(JSON.stringify({ out, seed, per, summary }, null, 2));

// services/crawlerJ1Score.js — ⛔ D75 J1 ACCEPTANCE · score J1's results against a KNOWN-ANSWER set
// (docs/CRAWLER_WORKER.md §7: the correct (vendor, slug) for >= 90 %, and a WRONG one for none —
// "a wrong answer is worse than none").
//
// Pure: no database, no network, no file. scripts/d75J1Score.mjs reads the files and prints this.
//
// What a result IS here is what it is in draft: a crawler_tasks row (type j1_find_board) whose result_json
// carries the worker's EVIDENCE — URLs where an ATS was seen. The worker never names a vendor or a slug;
// draft does, with harvestPairOf (services/slugHarvest.js), and acceptResult writes every distinct pair it
// reads to the slug-harvest pool. So the scorer reads the evidence through the SAME parser and judges the
// SET of pairs a task would have written:
//   · correct — the set is exactly the known pair (ats_type and slug equal; the slug compared case-insensitively);
//   · wrong   — the set names any pair that is not the known one (a wrong ATS, a wrong slug, or the right
//               pair plus another): that other pair would land in the pool, which is the harm §7 counts;
//   · missed  — no pair at all: no task, a dry run, none / blocked / error, or only an unsupported vendor.
// Precision = correct / (correct + wrong) — of the answers it named, how many were right.
// Recall    = correct / known             — of the companies asked about, how many it got.
import { harvestPairOf } from "./slugHarvest.js";

export const RECALL_TARGET = 0.9;

/** A URL or a bare host → its lowercase hostname without a leading "www." (null when unreadable). */
export function normHost(v) {
  if (!v) return null;
  const s = String(v).trim();
  let h;
  try { h = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname; } catch { return null; }
  return h.toLowerCase().replace(/^www\./, "") || null;
}

const parseMaybe = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return null; }
};

/**
 * The rows a results file may hold, in draft's real shapes:
 *   · crawler_tasks rows as exported (`sqlite3 -json … "SELECT * FROM crawler_tasks"`): input_json and
 *     result_json are JSON strings;
 *   · GET /api/admin/crawler's summary ({ tasks: [...] }): evidence (first 5) and result_status inline;
 *   · either with input / result already parsed.
 */
export function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

/** One row → { host, id, outcome status, the evidence, whether it was a dry run }. */
export function readRow(row) {
  const input = parseMaybe(row?.input_json) ?? parseMaybe(row?.input) ?? {};
  const result = parseMaybe(row?.result_json) ?? parseMaybe(row?.result);
  const host = normHost(row?.target_host) ?? normHost(input?.baseUrl) ?? normHost(row?.baseUrl);
  const evidence = Array.isArray(result?.evidence) ? result.evidence : Array.isArray(row?.evidence) ? row.evidence : [];
  const status = row?.result_status ?? result?.status ?? row?.status ?? null;
  const dryRun = status === "dry_run" || result?.dryRun === true;
  const finished = !!result || row?.result_status != null || Array.isArray(row?.evidence)
    || ["done", "failed", "refused"].includes(row?.status);
  return { host, id: Number(row?.id) || 0, type: row?.type ?? "j1_find_board", status, dryRun, finished, evidence };
}

/** The distinct (ats_type, slug) pairs a row's evidence names, and the unsupported vendors it saw. */
export function pairsOf(evidence, pairOf = harvestPairOf) {
  const pairs = [], unsupported = [];
  for (const e of evidence) {
    const p = pairOf(typeof e === "string" ? e : e?.url);
    if (!p) continue;
    if (p.unsupported) { if (!unsupported.includes(p.unsupported)) unsupported.push(p.unsupported); continue; }
    const pair = { atsType: String(p.atsType).toLowerCase(), slug: String(p.slug) };
    if (!pairs.some(q => q.atsType === pair.atsType && q.slug.toLowerCase() === pair.slug.toLowerCase())) pairs.push(pair);
  }
  return { pairs, unsupported };
}

const rate = (num, den) => (den ? +(num / den).toFixed(4) : null);
const tallyOf = () => ({ known: 0, correct: 0, wrong: 0, missed: 0 });
const finish = (t) => ({ ...t, precision: rate(t.correct, t.correct + t.wrong), recall: rate(t.correct, t.known) });

/**
 * @param {{ company: string, url: string, ats_type: string, slug: string }[]} known
 * @param {object[]} rows   draft's J1 task rows (see rowsOf)
 * @param {{ pairOf?: Function }} [opts]   the evidence parser — draft's harvestPairOf unless a test swaps it
 */
export function scoreJ1(known, rows, { pairOf = harvestPairOf } = {}) {
  // The task that answers for a host: the newest finished one (a retry supersedes), else the newest at all.
  const byHost = new Map();
  // Ties on id (rows without one) go to the later row in the file.
  for (const r of rows.map(readRow)) {
    if (r.type !== "j1_find_board" || !r.host) continue;
    const cur = byHost.get(r.host);
    if (!cur || r.finished > cur.finished || (r.finished === cur.finished && r.id >= cur.id)) byHost.set(r.host, r);
  }

  const companies = [], byAts = {}, overall = tallyOf(), usedHosts = new Set();
  let dryRuns = 0;
  for (const k of known) {
    const ats = String(k.ats_type).toLowerCase(), slug = String(k.slug);
    const host = normHost(k.url);
    const t = (byAts[ats] ??= tallyOf());
    t.known++; overall.known++;
    const hit = host ? byHost.get(host) ?? null : null;
    if (hit) usedHosts.add(host);
    const { pairs, unsupported } = hit ? pairsOf(hit.evidence, pairOf) : { pairs: [], unsupported: [] };
    const named = pairs.map(p => `${p.atsType}/${p.slug}`);
    let outcome, reason = null;
    if (pairs.length) {
      const right = pairs.length === 1 && pairs[0].atsType === ats && pairs[0].slug.toLowerCase() === slug.toLowerCase();
      outcome = right ? "correct" : "wrong";
    } else {
      outcome = "missed";
      reason = !hit ? "no_task" : hit.dryRun ? "dry_run" : !hit.finished ? "not_finished"
        : unsupported.length ? `unsupported:${unsupported.join(",")}` : String(hit.status || "none");
      if (hit?.dryRun) dryRuns++;
    }
    t[outcome]++; overall[outcome]++;
    companies.push({ company: k.company, host, expected: `${ats}/${slug}`, outcome, named, reason, taskId: hit?.id || null });
  }

  const total = finish(overall);
  return {
    byAts: Object.fromEntries(Object.entries(byAts).map(([a, t]) => [a, finish(t)])),
    overall: total,
    wrong: companies.filter(c => c.outcome === "wrong"),
    missed: companies.filter(c => c.outcome === "missed"),
    companies,
    dryRuns,
    unmatchedTasks: [...byHost.keys()].filter(h => !usedHosts.has(h)),
    acceptance: { recallTarget: RECALL_TARGET, pass: total.known > 0 && total.recall >= RECALL_TARGET && total.wrong === 0 },
  };
}

const pct = (v) => (v == null ? "  —  " : `${(v * 100).toFixed(1).padStart(5)}%`);

/** The report as text: per ATS, overall, the wrong answers, the misses, and the §7 verdict. */
export function formatReport(r) {
  const out = [];
  const line = (name, t) => `${name.padEnd(12)} known ${String(t.known).padStart(3)}  correct ${String(t.correct).padStart(3)}  wrong ${String(t.wrong).padStart(3)}  missed ${String(t.missed).padStart(3)}  precision ${pct(t.precision)}  recall ${pct(t.recall)}`;
  out.push("D75 J1 — known-answer score", "");
  for (const [a, t] of Object.entries(r.byAts).sort()) out.push(line(a, t));
  out.push(line("OVERALL", r.overall), "");
  out.push(`WRONG ANSWERS (${r.wrong.length}) — each would have put a wrong pair in the pool:`);
  for (const c of r.wrong) out.push(`  ${c.company} (${c.host}, task ${c.taskId}): expected ${c.expected}, named ${c.named.join(" + ")}`);
  if (!r.wrong.length) out.push("  none");
  out.push("", `MISSED (${r.missed.length}):`);
  for (const c of r.missed) out.push(`  ${c.company} (${c.host}${c.taskId ? `, task ${c.taskId}` : ""}): expected ${c.expected} — ${c.reason}`);
  if (!r.missed.length) out.push("  none");
  if (r.dryRuns) out.push("", `⚠ ${r.dryRuns} answer(s) came from DRY-RUN tasks: a dry run makes no request and cannot find a board. Score a live run.`);
  if (r.unmatchedTasks.length) out.push("", `(${r.unmatchedTasks.length} J1 task host(s) not in the known-answer set, ignored: ${r.unmatchedTasks.slice(0, 10).join(", ")}${r.unmatchedTasks.length > 10 ? " …" : ""})`);
  out.push("", `§7 ACCEPTANCE (recall >= ${r.acceptance.recallTarget * 100}% AND zero wrong): ${r.acceptance.pass ? "PASS" : "FAIL"}`);
  return out.join("\n");
}

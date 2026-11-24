// services/learn/explainerScript.js — ⭐ D198 E2 (owner 11-24) · THE ATLAS EXPLAINER'S SCRIPT FORMAT + ITS LINT.
// Format A (concept) is final (the owner's "yes approved write it up", 11-24; the oracle is canvas v4,
// docs/sketches/Atlas plate system v4.html — *Explainer · Big O, acted out* + *Storyboard*). Formats B–D are
// sketched first and are refused here until they are (E6).
//
// One script = one explainer: content/explainers/<id>/script.json. Its shape:
//   { id, format: "A", region: "III", title: { text, tape }, kicker,
//     plate: { kind: "costTable", columns: [{ id, label, ask }], rows: [{ id, label, sub, cells: { <col>: { big, level, reason } } }],
//              footnotes: [] },
//     beats: [{ name, ask: { tag, text }, op, say, keyword, act: { target, do, data }, cost: [{ on, level, reason }],
//               holdMs?, overlay? }],
//     proof, realWorld: { query, template }, check: { question, options: [], answer }, smallPrint, factChecked, sources? }
// The cost scale is the region's ramp in three steps (light / mid / deep) — green stays *proven*, clay stays *you / next*.
// Every cost carries a one-word reason (the doc: "a one-word reason under every number").
// ⚠ Deviation from the row's field list, on purpose: a beat's `cost` is a LIST ({ on, level, reason } per structure the
// beat acts on), because the sketch's beats set two or more cells at once (Access: the array's O(1) INDEX and the list's
// O(n) HOP); the row's singular `reason` is each entry's reason.
// Pure: no I/O, no model (D190).

export const FORMATS = Object.freeze({ A: "concept" });
export const NOT_YET_FORMATS = Object.freeze({ B: "scenario", C: "roadmap", D: "resource list" });
/** The voice rule: one sentence-sized line per beat, at most 14 words (≈ 2.5 words a second). */
export const MAX_WORDS = 14;
export const WORDS_PER_SECOND = 2.5;
/** Format A shows ten progress squares (past ink, now clay, ahead empty). */
export const BEATS_FORMAT_A = 10;
export const COST_LEVELS = Object.freeze(["light", "mid", "deep"]);
/** Region ramps (light → deep). Only Region III's is built (for the explainer); every other region builds its ramp first. */
export const RAMPS = Object.freeze({
  III: Object.freeze(["#FBF1EA", "#F5E2D6", "#EFD0BE", "#E6BA9F", "#D99C78", "#C97F55", "#B4532A", "#8F4122", "#6B3119", "#4A2211"]),
});
/** The three cost steps on each built ramp. */
export const COST_COLOURS = Object.freeze({ III: Object.freeze({ light: "#F5E2D6", mid: "#E6BA9F", deep: "#8F4122" }) });
export const OVERLAYS = Object.freeze({
  usualAnswer: ["answer", "stamp"],
  whereItRuns: ["line", "detail"],
  yourTurn: [],               // its question and options are the script's `check`
  savedCard: [],
});
const ACT_DO = Object.freeze(["land", "light", "jump", "hop", "scan", "bucket", "shift", "relink", "close", "unlink",
  "grow", "path", "ticket", "stamp", "answer", "all"]);

const strip = (w) => String(w).replace(/[.,’'"?:;!—–()“”]/g, "").toLowerCase();
export const wordsOf = (say) => String(say || "").trim().split(/\s+/).filter(Boolean);
/** Seconds the line takes at the voice's pace (E3's audio replaces this with the measured length). */
export const spokenSeconds = (say) => Math.round((wordsOf(say).length / WORDS_PER_SECOND) * 10) / 10;

/** True when the keyword is a word of the line (the captions paint that word in the region colour). */
export function keywordInLine(say, keyword) {
  const k = strip(keyword);
  return !!k && wordsOf(say).some((w) => strip(w).startsWith(k));
}

function costProblems(where, c) {
  const out = [];
  if (!COST_LEVELS.includes(c?.level)) out.push(`${where}: cost level must be ${COST_LEVELS.join(" / ")}`);
  const r = String(c?.reason ?? "").trim();
  if (!r) out.push(`${where}: a cost without a reason`);
  else if (/\s/.test(r)) out.push(`${where}: the reason is one word ("${r}")`);
  return out;
}

/** d198BeatLint — one beat's problems ([] = fine). */
export function beatProblems(beat, i, script = {}) {
  const at = `beat ${String(i + 1).padStart(2, "0")}${beat?.name ? ` "${beat.name}"` : ""}`;
  const out = [];
  if (!beat || typeof beat !== "object") return [`${at}: not an object`];
  if (!String(beat.name || "").trim()) out.push(`${at}: no name`);
  if (!beat.ask?.tag || !String(beat.ask?.text || "").trim()) out.push(`${at}: the question line needs a tag and a question`);
  const n = wordsOf(beat.say).length;
  if (!n) out.push(`${at}: nothing said`);
  if (n > MAX_WORDS) out.push(`${at}: ${n} words — a beat says at most ${MAX_WORDS}`);
  if (!String(beat.keyword || "").trim()) out.push(`${at}: no keyword`);
  else if (n && !keywordInLine(beat.say, beat.keyword)) out.push(`${at}: the keyword "${beat.keyword}" is not a word of the line`);
  if (!beat.act || !beat.act.target || !ACT_DO.includes(beat.act.do)) out.push(`${at}: act needs a target and a known move (${ACT_DO.join(", ")})`);
  for (const [k, c] of (Array.isArray(beat.cost) ? beat.cost : []).entries()) {
    out.push(...costProblems(`${at} cost ${k + 1}`, c));
    if (!c?.on) out.push(`${at} cost ${k + 1}: names no structure`);
  }
  if (beat.cost != null && !Array.isArray(beat.cost)) out.push(`${at}: cost is a list`);
  if (beat.holdMs != null && !(Number.isFinite(beat.holdMs) && beat.holdMs > 0)) out.push(`${at}: holdMs must be a positive number`);
  if (beat.overlay != null) {
    const kind = beat.overlay?.kind;
    if (!Object.hasOwn(OVERLAYS, kind)) out.push(`${at}: overlay kind must be one of ${Object.keys(OVERLAYS).join(", ")}`);
    else for (const f of OVERLAYS[kind]) if (!String(beat.overlay[f] ?? "").trim()) out.push(`${at}: the ${kind} overlay has no ${f}`);
    if (kind === "yourTurn" && !script.check) out.push(`${at}: the yourTurn overlay needs the script's check`);
    if (kind === "whereItRuns" && !String(script.realWorld?.template || "").includes("[N]")) out.push(`${at}: whereItRuns needs realWorld.template with [N]`);
  }
  return out;
}

/** d198BeatLint — the whole script's problems ([] = fine). `publish: true` also needs factChecked. */
export function scriptProblems(script, { publish = false } = {}) {
  const out = [];
  if (!script || typeof script !== "object") return ["not an object"];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(script.id || ""))) out.push("id must be kebab-case");
  if (Object.hasOwn(NOT_YET_FORMATS, script.format)) out.push(`format ${script.format} (${NOT_YET_FORMATS[script.format]}) is not built yet — it is sketched and approved first (D198 E6)`);
  else if (!Object.hasOwn(FORMATS, script.format)) out.push(`format must be one of ${Object.keys(FORMATS).join(", ")}`);
  if (!Object.hasOwn(RAMPS, script.region)) out.push(`region ${script.region}: no ramp built yet (built: ${Object.keys(RAMPS).join(", ")}) — build the region's ramp first`);
  if (!String(script.title?.text || "").trim() || !String(script.title?.tape || "").trim()) out.push("title needs text and its label tape");
  const beats = Array.isArray(script.beats) ? script.beats : [];
  if (script.format === "A" && beats.length !== BEATS_FORMAT_A) out.push(`format A has ${BEATS_FORMAT_A} beats (got ${beats.length})`);
  beats.forEach((b, i) => out.push(...beatProblems(b, i, script)));
  const plate = script.plate;
  if (!plate || plate.kind !== "costTable" || !Array.isArray(plate.columns) || !Array.isArray(plate.rows)) out.push("plate must be one costTable (columns + rows)");
  else {
    const cols = new Set(plate.columns.map((c) => c.id));
    for (const row of plate.rows) for (const [col, cell] of Object.entries(row.cells || {})) {
      if (!cols.has(col)) out.push(`plate ${row.id}.${col}: no such column`);
      if (cell?.level == null && !cell?.big) continue;                 // "—" cells (no index) carry a reason only
      if (cell?.level == null) { if (!String(cell?.reason || "").trim()) out.push(`plate ${row.id}.${col}: a cell without a reason`); continue; }
      out.push(...costProblems(`plate ${row.id}.${col}`, cell));
    }
    const rowIds = new Set(plate.rows.map((r) => r.id));
    for (const [i, b] of beats.entries()) for (const c of (Array.isArray(b?.cost) ? b.cost : [])) {
      if (c?.on && !rowIds.has(c.on)) out.push(`beat ${String(i + 1).padStart(2, "0")}: cost on "${c.on}" — no such row`);
    }
  }
  if (!String(script.proof || "").trim() || !/\d/.test(String(script.proof))) out.push("proof needs its numbers");
  if (!String(script.realWorld?.query || "").trim() || !String(script.realWorld?.template || "").includes("[N]")) out.push("realWorld needs a market query and a template with [N]");
  const ck = script.check;
  if (!ck || !String(ck.question || "").trim() || !Array.isArray(ck.options) || ck.options.length < 2 || !ck.options.includes(ck.answer)) out.push("check needs a question, options and an answer among them");
  if (!String(script.smallPrint || "").trim()) out.push("no small print");
  if (typeof script.factChecked !== "boolean") out.push("factChecked must be true or false");
  else if (publish && !script.factChecked) out.push("not fact-checked — it can't publish");
  if (/reels_output/i.test(JSON.stringify(script))) out.push("references reels_output — harvested files stay private research");
  return out;
}

/** The explainer's length at the voice's pace, before E3's audio is measured: each beat's words + its hold. */
export function estimatedSeconds(script, { pauseMs = 900 } = {}) {
  const beats = Array.isArray(script?.beats) ? script.beats : [];
  const ms = beats.reduce((t, b) => t + (b.holdMs ?? spokenSeconds(b.say) * 1000 + pauseMs), 0);
  return Math.round(ms / 100) / 10;
}

// client/src/pages/atlas/learnModel.js — ⭐ D115 P2–P3 · the Learn view's pure half: steps, a step's state, what is
// next, and the browser's progress when signed out. No React here, so the rules are testable as plain functions.
import { matchCandidate } from "../../../../shared/atlasSearchNormalize.js";

export const LOCAL_KEY = "draft-learn-progress";   // signed out: { [markId]: at } in this browser
export const checkpointId = (stepId, i) => `${stepId}#c${i}`;

/** Every step in order, with its part, phase and numbers — the tracker's own "Step 1 … 108". */
export function flatSteps(learn) {
  const out = [];
  (learn?.PARTS || []).forEach((part, pi) => (part.phases || []).forEach((ph, phi) => (ph.steps || []).forEach((s, si) => {
    out.push({ ...s, n: out.length + 1, partIndex: pi + 1, part: part.t, phase: ph.t, phaseId: ph.id, inPhase: si + 1 });
  })));
  return out;
}

/** One phase number per phase across the whole path (the tracker's grid numbers). */
export function phaseNumbers(learn) {
  const m = new Map(); let n = 0;
  for (const part of learn?.PARTS || []) for (const ph of part.phases || []) m.set(ph.id, ++n);
  return m;
}

/**
 * A step's progress: its REQUIRED items (not optional) done and its checkpoints explained.
 * @returns {{ done, total, complete: boolean, started: boolean }}
 */
export function stepState(step, marks) {
  const req = (step.items || []).filter(it => !it.o).map(it => it.id);
  const cps = (step.c || []).map((_, i) => checkpointId(step.id, i));
  const all = [...req, ...cps];
  const done = all.filter(id => marks[id]).length;
  const anyOptional = (step.items || []).some(it => it.o && marks[it.id]);
  return { done, total: all.length, complete: all.length > 0 && done === all.length, started: done > 0 || anyOptional };
}

/** Up next: the first step not complete — skipping advanced steps when "Basics first" is on. */
export function nextStep(steps, marks, { basicsOnly = false } = {}) {
  return steps.find(s => !(basicsOnly && s.lv === "a") && !stepState(s, marks).complete) || null;
}

/** "N of M core resources done" — the required items across the path. */
export function coreCounts(steps, marks) {
  const req = steps.flatMap(s => (s.items || []).filter(it => !it.o));
  return { done: req.filter(it => marks[it.id]).length, total: req.length };
}

/** The Concepts view's search — the ONE normaliser (BUG 10-31), over the term, then its definition. */
export function searchConcepts(index, q) {
  const query = String(q ?? "").trim();
  if (!query) return (index || []).map(t => ({ ...t, via: null }));
  const hits = [];
  for (const t of index || []) {
    const m = matchCandidate(query, { name: t.term, definition: t.def });
    if (m) hits.push({ ...t, via: m.via, rank: m.rank });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.term.localeCompare(b.term)).map(({ rank, ...t }) => t);
}

/** The browser's marks (signed out) — try/catch-guarded: a private window or blocked storage reads as none. */
export function readLocal(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse(storage?.getItem(LOCAL_KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function writeLocal(marks, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { storage?.setItem(LOCAL_KEY, JSON.stringify(marks)); return true; } catch { return false; }
}
export function clearLocal(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { storage?.removeItem(LOCAL_KEY); } catch { /* nothing to clear */ }
}
/** The browser's marks as the account import takes them. */
export const localAsImport = (marks) => Object.entries(marks || {}).map(([id, at]) => ({ id, at: Math.floor(Number(at) || 0) }));

// services/learn/learnContent.js — ⭐ D115 · the owner's tracker as the app reads it: content/learn/silicon-to-software.json
// (written by scripts/learn/extractTracker.mjs from docs/From silicon to software_ progress tracker.html). Read once.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEARN_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/learn/silicon-to-software.json");

let cached = null;
/** @returns {{ source, PARTS, ATLAS, INDEX }} */
export function learnContent(file = LEARN_FILE) {
  if (cached && cached.file === file) return cached.data;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  cached = { file, data };
  return data;
}

/** Every step, in order, with its part and phase — the tracker's own numbering (Step 1 … 108). */
export function stepsOf(learn) {
  const out = [];
  learn.PARTS.forEach((part, pi) => (part.phases || []).forEach(ph => (ph.steps || []).forEach(s => {
    out.push({ ...s, n: out.length + 1, part: part.t, partIndex: pi + 1, phase: ph.t, phaseId: ph.id });
  })));
  return out;
}

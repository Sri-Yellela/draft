// ⭐ D198 E1 · the explainer's clock — pure, so the app's player and E4's export draw the SAME frame at the same time.
// A script (services/learn/explainerScript.js, content/explainers/<id>/script.json) becomes a timeline: each beat speaks
// its line, then holds. With E3's audio a beat carries `audioMs` (the rendered line's measured length) and the captions
// advance word by word across exactly that length; without it the voice's pace (2.5 words a second) stands in.
// `holdMs` on a beat overrides the beat's whole length. Under Reduce motion the slash holds still and a line shows whole.

export const WORDS_PER_SECOND = 2.5;
export const PAUSE_MS = 900;                 // the hold after the line (the sketch's 900 ms before the next beat)
export const SLASH_TURN = Object.freeze(["/", "|", "\\", "|"]);   // the /d mark: one step per beat, "/ | \ | /"

export const wordsOf = (say) => String(say || "").trim().split(/\s+/).filter(Boolean);
const strip = (w) => String(w).replace(/[.,’'"?:;!—–()“”]/g, "").toLowerCase();

/** The slash for beat i — still ("/") under Reduce motion. */
export function slashFor(i, reduce = false) {
  return reduce ? SLASH_TURN[0] : SLASH_TURN[((i % SLASH_TURN.length) + SLASH_TURN.length) % SLASH_TURN.length];
}

/** The spoken part of a beat in ms: the audio's measured length, else the voice's pace. */
export function speakMs(beat) {
  if (Number.isFinite(beat?.audioMs) && beat.audioMs > 0) return beat.audioMs;
  return Math.round((wordsOf(beat?.say).length / WORDS_PER_SECOND) * 1000);
}

/** [{ i, start, speak, end }] — every beat's place on the clock (ms from the explainer's start). */
export function timeline(script) {
  const beats = Array.isArray(script?.beats) ? script.beats : [];
  let t = 0;
  return beats.map((b, i) => {
    const speak = speakMs(b);
    const len = Number.isFinite(b?.holdMs) && b.holdMs > 0 ? Math.max(b.holdMs, speak) : speak + PAUSE_MS;
    const row = { i, start: t, speak, end: t + len };
    t += len;
    return row;
  });
}
export const lengthMs = (script) => { const tl = timeline(script); return tl.length ? tl[tl.length - 1].end : 0; };

/** The frame at `ms`: which beat, how many of its words are spoken, the slash, whether it's over. Deterministic. */
export function frameAt(script, ms, { reduce = false } = {}) {
  const tl = timeline(script);
  if (!tl.length) return { i: 0, w: 0, slash: slashFor(0, reduce), done: true, n: 0 };
  const t = Math.max(0, ms);
  const row = tl.find((r) => t < r.end) || tl[tl.length - 1];
  const n = wordsOf(script.beats[row.i].say).length;
  const into = t - row.start;
  // word k is spoken once (k + 1) / n of the spoken part has passed; a reduced-motion line shows whole at once
  const w = reduce ? n : Math.min(n, Math.floor((into / Math.max(1, row.speak)) * n + 1e-9));
  return { i: row.i, w, slash: slashFor(row.i, reduce), done: t >= tl[tl.length - 1].end, n };
}

/** Each word of a line: { t, state: "spoken" | "waiting", key } — the keyword wears the region colour once spoken. */
export function captionWords(say, keyword, w) {
  const k = strip(keyword);
  return wordsOf(say).map((t, idx) => ({ t, state: idx < w ? "spoken" : "waiting", key: !!k && strip(t).startsWith(k), now: idx === w - 1 }));
}

/** The ten progress squares: past ink, now clay, ahead empty (LitSquares' states). */
export function progressSquares(i, n) {
  return Array.from({ length: n }, (_, k) => (k < i ? "ink" : k === i ? "today" : "ahead"));
}

/** The plate panel's columns at beat i: a column shows once its beat has come; the beat's own column is lit, earlier
 *  ones dim to 40 %; the saved card (act.do "all") lights every column. → { [col]: "hidden" | "lit" | "dim" } */
export function columnStates(script, i) {
  const cols = (script?.plate?.columns || []).map((c) => c.id);
  const beats = script?.beats || [];
  const out = Object.fromEntries(cols.map((c) => [c, "hidden"]));
  if (beats[i]?.act?.do === "all") { for (const c of cols) out[c] = "lit"; return out; }
  for (let k = 0; k <= i && k < beats.length; k++) {
    const op = beats[k]?.op;
    if (op && op in out) out[op] = k === i ? "lit" : "dim";
  }
  return out;
}

/** The market line: the template with [N] filled, or null when the count isn't known (nothing is invented). */
export function marketLine(script, openings) {
  const tpl = script?.realWorld?.template;
  if (!tpl || !Number.isFinite(openings)) return null;
  return tpl.replace("[N]", openings.toLocaleString("en-US"));
}

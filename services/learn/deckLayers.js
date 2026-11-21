// services/learn/deckLayers.js — ⭐ D195 (owner 11-14) · HOW ATLAS TEACHES — the content design rule as a lint on a deck.
// "teaching concepts in a simple animated way for understanding with a mathematical and systematic approach yet linking it
// to real world application." Every deck written under the rule carries THREE LAYERS, in this order:
//   (1) concept    the idea, simply — one idea, no unexplained jargon
//   (2) proof      the math or the system underneath — one formula, one diagram or one worked example, with its numbers
//   (3) realWorld  where it runs, who uses it, what breaks — a NAMED system or failure, never a toy, ending in a Try step
// A slide says which layer it serves (`layer`); the deck names its real-world example (`realWorld: { name, url }`) and its
// Try step (`try: { source, url }` — a source in the D176 register whose teachingUse includes "try" and whose licence is
// open). The pacing reads D194's own player model (the same beats and holds the reel plays), so "≤ 90 s" is measured the
// way the learner sees it. Decks written before the rule (batches before D195_FROM_VERSION) are not linted.
// Pure: no I/O, no model (D190).
import { beatsOf, holdMs } from "../../client/src/pages/atlas/deckPlay.js";

export const LAYERS = Object.freeze(["concept", "proof", "realWorld"]);
/** The first deck batch written under the rule (decks-v25, re-drafted in 47a). Older batches predate it. */
export const D195_FROM_VERSION = 25;
/** D195's pacing, in seconds at 1×: layer 1 in the first 15–20 s, layer 2 in the next 20–30 s, layer 3 in the last 15–20 s. */
export const PACING_S = Object.freeze({ concept: 20, proof: 30, realWorld: 20, total: 90 });
/** Words that mark a made-up example when a real one exists (D195 (3): "never a toy example when a real one exists"). */
export const TOY_WORDS = Object.freeze(["foo", "bar", "baz", "acme", "example.com", "widget", "toy", "imagine a", "hypothetical", "lorem"]);

const textOf = (p) => (p && typeof p === "object" ? String(p.text ?? "") : String(p ?? ""));
const contentSlides = (deck) => (Array.isArray(deck?.slides) ? deck.slides.slice(0, -1) : []);   // the last slide is the check

/** True when a batch must follow the rule. */
export function underRule(version) {
  return Number(version) >= D195_FROM_VERSION;
}

/** d195EveryDeckHasThreeLayers — problems ([] = fine): each layer present, in order; the proof shows its numbers. */
export function threeLayerProblems(deck) {
  const out = [];
  const slides = contentSlides(deck);
  const seq = slides.map(s => s.layer);
  for (const s of slides) if (!LAYERS.includes(s.layer)) out.push(`"${s.title}": layer must be one of ${LAYERS.join(" / ")}`);
  for (const l of LAYERS) if (!seq.includes(l)) out.push(`no ${l} slide`);
  const rank = seq.map(l => LAYERS.indexOf(l)).filter(i => i >= 0);
  if (rank.some((r, i) => i > 0 && r < rank[i - 1])) out.push("layers out of order (concept → proof → realWorld)");
  const proof = slides.filter(s => s.layer === "proof").flatMap(s => (s.points || []).map(textOf)).join(" ");
  if (proof && !/\d/.test(proof)) out.push("the proof shows no number, formula or worked example");
  if (!deck?.realWorld?.name || !/^https:\/\//.test(String(deck?.realWorld?.url || ""))) out.push("realWorld needs a named example with an https link");
  if (!deck?.try?.source || !/^https:\/\//.test(String(deck?.try?.url || ""))) out.push("try needs a register source and an https link");
  return out;
}

/** d195AnimatedPacingUnder90s — seconds per layer at 1×, as D194's player holds each beat (the check beat excluded). */
export function pacing(deck, speed = 1) {
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const secs = { concept: 0, proof: 0, realWorld: 0, total: 0 };
  for (const b of beatsOf(deck)) {
    if (b.check) continue;
    const s = holdMs(b, speed) / 1000;
    const layer = slides[b.slide]?.layer;
    if (LAYERS.includes(layer)) secs[layer] += s;
    secs.total += s;
  }
  for (const k of Object.keys(secs)) secs[k] = Math.round(secs[k] * 10) / 10;
  return secs;
}
export function pacingProblems(deck) {
  const p = pacing(deck);
  return Object.entries(PACING_S).filter(([k, max]) => p[k] > max).map(([k, max]) => `${k} runs ${p[k]} s (≤ ${max} s)`);
}

/** d195TryLinkToOpenSource — the Try step's source is in the register, open, needs no account, and teaches by doing. */
export function tryProblems(deck, registry) {
  const t = deck?.try;
  if (!t?.source) return ["no try step"];
  const src = (registry?.sources || []).find(s => s.id === t.source);
  if (!src) return [`try source "${t.source}" is not in the register`];
  const out = [];
  if (!["open-reuse", "share-alike"].includes(src.licenceClass)) out.push(`try source "${src.id}" is ${src.licenceClass}, not open`);
  if (src.accountNeeded) out.push(`try source "${src.id}" needs an account`);
  if (!(src.teachingUse || []).includes("try")) out.push(`try source "${src.id}" has no "try" teachingUse`);
  let host = null, own = null;
  try { host = new URL(t.url).hostname.replace(/^www\./, ""); own = new URL(src.url).hostname.replace(/^www\./, ""); } catch { out.push("try url is not a url"); }
  if (host && own && host !== own && !host.endsWith(`.${own}`)) out.push(`try url ${host} is not on ${own}`);
  return out;
}

/** d195NoToyExampleWhenRealExists — the real-world layer names a real thing; no placeholder companies or toy words. */
export function toyProblems(deck) {
  const words = contentSlides(deck).filter(s => s.layer === "realWorld").flatMap(s => [s.title, ...(s.points || []).map(textOf)]).join(" ").toLowerCase();
  const hits = TOY_WORDS.filter(w => new RegExp(`(^|[^a-z])${w.replace(".", "\\.")}([^a-z]|$)`).test(words));
  const out = hits.map(w => `real-world layer uses "${w}"`);
  const name = String(deck?.realWorld?.name || "").toLowerCase();
  const head = name.split(/[\s(,]/)[0].replace(/['’]s$/, "").replace(/[^a-z0-9.+-]/g, "");   // "Cloudflare's …" → cloudflare
  if (name && !words.includes(head)) out.push(`the real-world slides never name "${deck.realWorld.name}"`);
  return out;
}

/** Every problem a rule deck has, in one list (for a batch writer and Admin's review). */
export function ruleProblems(deck, registry) {
  return [...threeLayerProblems(deck), ...pacingProblems(deck), ...tryProblems(deck, registry), ...toyProblems(deck)];
}

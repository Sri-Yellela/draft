// shared/pastel.js — ⭐ 46u (owner 11-17: "assign random pastel colors as bg to the courses and guides, like they are on a
// book or book stack … do the same coloring to the slides of each deck … just dont leave anything bland"; sketch A, books
// on a shelf, https://claude.ai/artifact/EVGbW7AoRqqwKTnRtiGfUD) · THE ONE PLACE AN ITEM'S PASTEL IS PICKED.
//
// "Random" is STABLE per item: FNV-1a over the id picks one of the eight PASTEL_n tokens every theme defines
// (client/src/themes/*.js), so a course keeps its colour on every visit, on both sites, and a deck's slides share it.
// Never Math.random. The colour itself is a token (var(--c-pastel-n)) — no literal leaves the theme files.

export const PASTEL_COUNT = 8;

/** 1…8 for an id (a course, guide, pathway, deck or skill). Pure. */
export function pastelIndex(id) {
  let h = 2166136261;
  for (const ch of String(id ?? "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % PASTEL_COUNT) + 1;
}

/** The CSS colour for an id: `var(--c-pastel-n)`. */
export const pastelVar = (id) => `var(--c-pastel-${pastelIndex(id)})`;

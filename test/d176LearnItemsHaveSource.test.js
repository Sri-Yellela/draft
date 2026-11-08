// ⭐ D176-3 · EVERY LEARN ITEM HAS ITS SOURCE — resolved from the register (services/atlas/learnSources.js) against the
// content Learn serves. Owner 11-07: one register row per creator or site, each `to-verify` (link-only until D176-1).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerIndex, itemSource, learnSourceSummary, creatorOf, isSearchLink, hostSlug, OWN_SOURCE } from "../services/atlas/learnSources.js";
import { validateRegistry } from "../services/atlas/sourceRegistry.js";
import { withRealLinks } from "../services/learn/learnContent.js";

const reg = JSON.parse(fs.readFileSync("content/sources/registry.json", "utf8"));
// D178-2: the content as Learn serves it — the verified real links laid over the search links.
const seed = withRealLinks(JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8")));

test("d176LearnItemsHaveSource: every seed item resolves to a registered source, or is flagged for a named one", () => {
  const s = learnSourceSummary(seed, reg);
  assert.equal(s.items, 373);
  assert.deepEqual(s.unregistered, [], "no item names a source the register lacks");
  assert.equal(s.resolved + s.needsNamedSource.length, s.items);
  // A ratchet: the flagged search links may only be replaced, never added to.
  // A ratchet: 60 on 11-07; 5 after D178-2's verified real links (content/links/learn-links-v1.json).
  assert.ok(s.needsNamedSource.length <= 5, `${s.needsNamedSource.length} items link to a search with no named source (was 5 after D178-2)`);
  assert.equal(s.own, 38, "our own Build tasks are draft-original");
});

test("d176LearnItemsHaveSource: the register still validates, and every row D176-3 added is to-verify (link-only)", () => {
  const v = validateRegistry(reg);
  assert.ok(v.ok, v.problems.join(" · "));
  const added = reg.sources.filter(x => /by D176-3/.test(x.notes || ""));
  assert.ok(added.length >= 180);
  // D176-1 (11-08): a row leaves to-verify only with the page's own wording quoted in its notes, the page, and the date.
  for (const x of added) {
    if (x.licenceClass === "to-verify") continue;
    assert.match(x.verified, /^\d{4}-\d{2}-\d{2}$/, `${x.id}: a checked licence records its date`);
    assert.match(x.notes, /D176-1 \(\d{4}-\d{2}-\d{2}\): [a-z-]+, read at https:\/\/\S+[^"]*: "[^"]{8,}/, `${x.id}: the licence page's wording is quoted`);
  }
  assert.ok(reg.sources.some(x => x.id === OWN_SOURCE && x.licenceClass === "open-reuse"), "draft's own tasks are a row");
  const ids = reg.sources.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
});

test("d176LearnItemsHaveSource: how an item finds its source", () => {
  const index = registerIndex({ sources: [
    { id: "computerphile", name: "Computerphile", publisher: "Computerphile", url: "https://www.youtube.com/results?search_query=Computerphile" },
    { id: "mit-ocw", name: "MIT OpenCourseWare", publisher: "MIT", url: "https://ocw.mit.edu/" },
    { id: "ms-docs", name: "Docs", publisher: "Microsoft", url: "https://learn.microsoft.com/docs" },
    { id: "ms-training", name: "Training", publisher: "Microsoft", url: "https://learn.microsoft.com/training" },
  ] });
  assert.deepEqual(itemSource({ t: "Build it" }, index), { id: OWN_SOURCE, via: "own" });
  assert.deepEqual(itemSource({ u: "https://www.youtube.com/results?search_query=turing", s: "Computerphile" }, index), { id: "computerphile", via: "creator" });
  assert.equal(itemSource({ u: "https://www.youtube.com/results?search_query=x", s: "YouTube search" }, index).flag, "needs_named_source");
  assert.equal(itemSource({ u: "https://www.google.com/search?q=x", s: "A SQLite clone, step by step" }, index).flag, "needs_named_source", "a description is not a source");
  assert.deepEqual(itemSource({ u: "https://ocw.mit.edu/courses/6-004" }, index), { id: "mit-ocw", via: "host" });
  assert.deepEqual(itemSource({ u: "https://learn.microsoft.com/training/paths/x" }, index), { id: "ms-training", via: "host" }, "the longest matching path");
  assert.equal(itemSource({ u: "https://nand2tetris.org/project01" }, index).want, "nand2tetris");
  assert.equal(creatorOf("Allen Downey, free"), "Allen Downey");
  assert.equal(creatorOf("The Tor Project"), "The Tor Project");
  assert.equal(creatorOf("Google’s 2017 TPU paper"), null);
  assert.equal(isSearchLink("https://openlibrary.org/search?q=Petzold"), true);
  assert.equal(isSearchLink("https://www.youtube.com/watch?v=abc"), false, "a video page is a host link, not a search");
  assert.equal(hostSlug("3blue1brown.com"), "3blue1brown");
});

test("d176LearnItemsHaveSource: Admin → Atlas → Sources reports it", () => {
  const route = fs.readFileSync("routes/atlas.js", "utf8");
  assert.match(route, /learnSourceSummary\(servedLearnContent\(db\), reg\)/, "against the content Learn serves (the database), not the seed");
  assert.match(fs.readFileSync("client/src/panels/adminAtlas.jsx", "utf8"), /data-atlas-sources-learn=""/);
});

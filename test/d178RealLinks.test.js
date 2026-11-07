// ⭐ D178-2 · d178NoFakeMedia — a Learn item that linked to a SEARCH is replaced by a VERIFIED real page from
// content/links/learn-links-v*.json, laid over whatever content Learn serves; a real YouTube / Open Library page keeps its
// creator as its source (D176-3); an entry without a url changes nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withRealLinks, linkReplacements, _resetLinks } from "../services/learn/learnContent.js";
import { registerIndex, itemSource } from "../services/atlas/learnSources.js";

const doc = { PARTS: [{ t: "P", phases: [{ t: "ph", steps: [{ id: "s1", items: [
  { id: "a", k: "Video", t: "Crash Course CS 1-4", s: "CrashCourse", u: "https://www.youtube.com/results?search_query=crash+course" },
  { id: "b", k: "Video", t: "Antennas", s: "YouTube search", u: "https://www.youtube.com/results?search_query=antenna" },
  { id: "c", k: "Book", t: "Code", s: "Charles Petzold", u: "https://openlibrary.org/search?q=code" },
] }] }] }] };

test("d178NoFakeMedia: verified links replace search links; nothing else changes; the input is never mutated", () => {
  const map = new Map([["a", { url: "https://www.youtube.com/playlist?list=PL8dPuuaLjXtNlUrzyH5r6jN9ulIgZBpdo", by: null }],
    ["b", { url: "https://www.youtube.com/watch?v=ZaXm6wau-jc", by: "Lesics" }]]);
  const out = withRealLinks(doc, map);
  const items = out.PARTS[0].phases[0].steps[0].items;
  assert.equal(items[0].u, "https://www.youtube.com/playlist?list=PL8dPuuaLjXtNlUrzyH5r6jN9ulIgZBpdo");
  assert.equal(items[1].u, "https://www.youtube.com/watch?v=ZaXm6wau-jc"); assert.equal(items[1].by, "Lesics");
  assert.equal(items[2].u, doc.PARTS[0].phases[0].steps[0].items[2].u, "no entry: unchanged (still a search, still flagged)");
  assert.match(doc.PARTS[0].phases[0].steps[0].items[0].u, /results\?search_query/, "the input is never mutated");
  assert.equal(withRealLinks(doc, new Map()), doc);
});

test("d178NoFakeMedia: a real platform page keeps its creator as its source", () => {
  const index = registerIndex({ sources: [
    { id: "crashcourse", name: "CrashCourse", publisher: "CrashCourse", url: "https://www.youtube.com/results?search_query=CrashCourse" },
    { id: "lesics", name: "Lesics", publisher: "Lesics", url: "https://www.youtube.com/results?search_query=Lesics" }] });
  assert.deepEqual(itemSource({ u: "https://www.youtube.com/playlist?list=PLx", s: "CrashCourse" }, index), { id: "crashcourse", via: "creator" });
  assert.deepEqual(itemSource({ u: "https://www.youtube.com/watch?v=x", s: "YouTube search", by: "Lesics" }, index), { id: "lesics", via: "creator" });
});

test("d178NoFakeMedia: the links file — only https urls count; no file, nothing replaced", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d178-links-"));
  try {
    _resetLinks(); assert.equal(linkReplacements(dir).size, 0);
    fs.writeFileSync(path.join(dir, "learn-links-v1.json"), JSON.stringify({ links: [{ id: "a", url: "https://x.example/v" }, { id: "b", url: null }, { id: "c", url: "http://insecure.example" }] }));
    _resetLinks(); assert.deepEqual([...linkReplacements(dir).keys()], ["a"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); _resetLinks(); }
});

test("d178NoFakeMedia: content/links/learn-links-v1.json — every link verified and evidenced; every search item replaced or left with its reason", async () => {
  const f = JSON.parse(fs.readFileSync("content/links/learn-links-v1.json", "utf8"));
  const { learnItems, isSearchLink } = await import("../services/atlas/learnSources.js");
  const seed = JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8"));
  const searchIds = learnItems(seed).filter(x => isSearchLink(x.item.u)).map(x => x.item.id).sort();
  const covered = [...f.links.map(l => l.id), ...f.left.map(l => l.id)].sort();
  assert.deepEqual(covered, searchIds, "each search item is either replaced or listed as left");
  for (const l of f.links) {
    assert.match(l.url, /^https:\/\//, l.id);
    assert.ok(l.verified && l.evidence, `${l.id}: how it was verified, and what the check returned`);
    assert.doesNotMatch(l.url, /youtube\.com\/results|google\.com\/search|openlibrary\.org\/search/, `${l.id} is not a search`);
  }
  for (const l of f.left) assert.ok(l.why, `${l.id}: why it is left`);
  assert.ok(f.links.length >= 190, `${f.links.length} replaced`);
});

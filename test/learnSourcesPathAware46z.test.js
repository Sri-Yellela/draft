// 46z: learnSources' host match was path-blind when a host had ONE register row — every GitHub link in Learn was credited
// to cfd-python (the one GitHub row), the RLHF blog post to the Hugging Face COURSES (Apache-2.0, so it read as adaptable).
// A row with a path answers only under that path; a root row answers for the whole host; the longest path wins.
import test from "node:test";
import assert from "node:assert/strict";
import { registerIndex, itemSource } from "../services/atlas/learnSources.js";

const reg = (rows) => registerIndex({ sources: rows.map(([id, url]) => ({ id, url, name: id, publisher: id })) });

test("one repository's row is not the source of every link on its host", () => {
  const idx = reg([["cfd-python", "https://github.com/barbagroup/CFDPython"]]);
  assert.equal(itemSource({ u: "https://github.com/barbagroup/CFDPython/blob/master/x.ipynb" }, idx).id, "cfd-python");
  const other = itemSource({ u: "https://github.com/donnemartin/system-design-primer" }, idx);
  assert.equal(other.id, null);
  assert.equal(other.flag, "unregistered");
  assert.equal(itemSource({ u: "https://github.com/barbagroup/CFDPythonExtra" }, idx).id, null, "a path prefix is a whole segment");
});

test("a root row answers for its host; the longest path wins", () => {
  const idx = reg([["github", "https://github.com/"], ["os-tutorial", "https://github.com/cfenollosa/os-tutorial"]]);
  assert.equal(itemSource({ u: "https://github.com/cfenollosa/os-tutorial" }, idx).id, "os-tutorial");
  assert.equal(itemSource({ u: "https://github.com" }, idx).id, "github");
  assert.equal(itemSource({ u: "https://github.com/someone/else" }, idx).id, "github");
});

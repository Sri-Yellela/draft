// 46a (owner 11-10: "add a approve all button for the candidates") · Admin → Companies → Candidates: Approve all runs the
// SAME dry-run → confirm → backup path as Approve, with every probed candidate — nothing is added without the confirm.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

test("Approve all: every probed candidate, through the one dry-run-then-confirm approve path", () => {
  const src = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  const start = at(src, "function DiscoveryCandidates(");
  const body = src.slice(start, at(src, "\n// ── Slug harvest", start));   // the region fails loudly if an anchor moves
  assert.match(body, /const probedIds = \(d\?\.candidates \|\| \[\]\)\.filter\(r => r\.status === "probed"\)\.map\(r => r\.id\)/);
  assert.match(body, /data-approve-all="" disabled=\{!probedIds\.length \|\| !!busy\} onClick=\{\(\) => approve\(probedIds\)\}/);
  assert.match(body, /Approve all \$\{probedIds\.length \|\| ""\}…/);
  // one path: the dry run, then the in-page confirm, then the confirmed POST with the dry run's own eligible ids
  assert.equal((body.match(/candidates\/approve/g) || []).length, 2, "one dry run + one confirmed call — no second approve path");
  assert.match(body, /if \(!await ask\(\{ title: `Add \$\{dry\.eligible\.length\}/);
  assert.match(body, /confirm: true, expectIds: dry\.eligible\.map\(e => e\.id\)/);
});

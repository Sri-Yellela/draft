// ⭐ D83 · THE ADMIN MAP (39d) — five groups, each a question; every panel lives in exactly one, and the
// map and the page cannot drift. Decided from docs/ADMIN_AUDIT.md's proposed marks. Each assertion was
// mutated red and restored.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ADMIN_GROUPS, readAdminPlace, writeAdminPlace } from "../client/src/panels/adminMap.js";

const panel = fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8").replace(/\r\n/g, "\n");
const drawn = [...panel.matchAll(/at\("(\w+)", "(\w+)"\)/g)].map(m => `${m[1]}/${m[2]}`);

test("D83 map: five groups, in order, each with its question", () => {
  assert.deepEqual(ADMIN_GROUPS.map(g => [g.label, g.question]), [
    ["Today", "What needs me?"], ["The board", "What is on it, and why?"], ["People", "Who is using it?"],
    ["Data", "What is stored?"], ["System", "Is it set up right?"]]);
});

test("D83 map: every panel on the map is drawn, and nothing is drawn that is not on the map", () => {
  const onMap = ADMIN_GROUPS.flatMap(g => g.sections.map(([s]) => `${g.id}/${s}`));
  assert.equal(new Set(onMap).size, onMap.length, "a panel is in two places");
  assert.deepEqual(onMap.filter(p => !drawn.includes(p)), [], "on the map but never drawn");
  assert.deepEqual([...new Set(drawn)].filter(p => !onMap.includes(p)), [], "drawn but not on the map");
});

test("D83 map: the audit's retirements and moves hold", () => {
  assert.doesNotMatch(panel, /topTab|OpsTab|CacheTab|"users_analytics"/, "the old tab bar is back");
  // contact messages were drawn under EVERY tab (audit #19) — now only People → Messages
  assert.equal((panel.match(/<ContactMessagesSection /g) || []).length, 1);
  assert.match(panel, /\{at\("people", "messages"\) && <ContactMessagesSection theme=\{theme\}\/>\}/);
  assert.doesNotMatch(panel, /label="(Token Usage|API Cost|Cache Savings|Cache Hit Rate)"/, "Usage's dead tiles (audit #16)");
  assert.doesNotMatch(fs.readFileSync("client/src/panels/adminOps.jsx", "utf8"), /export function OpsTab/);
});

test("D83 map: the URL names a place; an unknown one lands on a real panel, never a blank page", () => {
  assert.deepEqual(readAdminPlace("?g=board&s=crawler"), { g: "board", s: "crawler" });
  assert.deepEqual(readAdminPlace("?g=board&s=nope"), { g: "board", s: "companies" });
  assert.deepEqual(readAdminPlace("?g=ops"), { g: "today", s: "glance" });
  assert.deepEqual(readAdminPlace(""), { g: "today", s: "glance" });
  assert.deepEqual(writeAdminPlace("people"), { g: "people", s: "users" });
});

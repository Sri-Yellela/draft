// ⛔ D165 A6 (6) · d165LiveModelAndPromptReported — the model / prompt table is regenerated from the source, never by hand.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { draftFacts, toolsFacts, renderReport } from "../scripts/d165ModelReport.mjs";

function fakeToolsRepo({ tailor = "MODEL_HAIKU", craft = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d165-rm-"));
  const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
  w("src/model/anthropicCall.js", 'export const MODEL_SONNET = "claude-sonnet-x";\nexport const MODEL_HAIKU = "claude-haiku-y";\n');
  w("src/generation/generate.js", "call({ model: MODEL_SONNET });\n");
  w("src/generation/tailor.js", `export const TAILOR_MODEL = ${tailor};\nexport const TAILOR_REPAIR_MODEL = MODEL_SONNET;\n${craft ? "// bullet_craft\n" : ""}`);
  w("src/generation/promptAssembler.js", craft ? "// prompts/bullet_craft.md\n" : "\n");
  if (craft) w("prompts/bullet_craft.md", "x");
  return dir;
}

test("d165LiveModelAndPromptReported: the table names each path's model and whether the bullet craft is loaded", () => {
  const t = toolsFacts(fakeToolsRepo());
  assert.deepEqual([t.generateModel, t.tailorModel, t.tailorRepairModel, t.fullPromptHasBulletCraft], ["claude-sonnet-x", "claude-haiku-y", "claude-sonnet-x", true]);
  const d = draftFacts();
  assert.equal(d.applyCallsFullRoute, true, "draft's apply path calls the full route");
  assert.equal(d.applyRetriesClaimOnce, true);
  const md = renderReport({ d, t, l: { tools: "abc1234", draft: "def5678" }, at: "T" });
  assert.match(md, /\| Apply runs \(Draft, Ask me first, Apply for me\) \| full generate route \| claude-sonnet-x \|/);
  assert.match(md, /\| Posting → Résumé for this job \(lean\) \| lean tailor route \| claude-haiku-y \|/);
  assert.match(md, /Not read: production's `DRAFT_TAILORING`/, "it says what it cannot read");
  // A changed constant shows up in the next report — the point of regenerating it.
  assert.match(renderReport({ d, t: toolsFacts(fakeToolsRepo({ tailor: "MODEL_SONNET", craft: false })), l: { tools: "-", draft: "-" } }),
    /lean tailor route \| claude-sonnet-x \| bullet_craft\.md: NO/);
  assert.equal(toolsFacts(path.join(os.tmpdir(), "no-such-repo-d165")).available, false);
});

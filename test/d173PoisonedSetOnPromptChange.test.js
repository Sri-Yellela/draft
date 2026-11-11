// ⛔ D173 (1) · THE POISONED SET RUNS ON EVERY PROMPT CHANGE. Two parts:
//   (a) every file that calls a model (callTask) is listed below with what untrusted text it carries — a new model call
//       fails here until it is listed, and a call that carries untrusted text must fence it (services/untrustedText.js);
//   (b) the whole poisoned set (test/fixtures/d173Poisoned.js) through every prompt builder that carries untrusted text:
//       every untrusted string lands inside its fence, stripped, under the system rule.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCoverLetterRequest } from "../services/coverLetterPrompt.js";
import { htmlToText } from "../services/jobs/htmlToText.js";
import { UNTRUSTED_DATA_RULE } from "../services/untrustedText.js";
import { POSTINGS, OWN_RESUME, ZW, TAG_A } from "./fixtures/d173Poisoned.js";
import { at } from "../test-support/sourceAnchors.js";

// file → what it sends. "untrusted" files must import the fence; "own" files send only the person's own input.
const MODEL_CALLERS = {
  "server.js": { carries: "untrusted", what: "the job description in both cover letters", fence: /buildCoverLetterRequest/ },
  "routes/domainProfiles.js": { carries: "own", what: "the domain, role family and the person's own chip lists (generate-chips)" },
  // 46f: listed (46e's own callers, pushed before the suite ran): both carry untrusted text and both fence it.
  "services/applicationAnswerDraft.js": { carries: "untrusted", what: "the employer's question and the role's title (D185-1 / A182's run drafts)", fence: /fenceUntrusted\("posting", untrusted\)/ },
  "services/assistant/assistant.js": { carries: "untrusted", what: "the asker's question and the retrieved Atlas lessons / help (T5)", fence: /fenceUntrusted\(/ },
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".claude", "client", "test", "dist", "data"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(e.name)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

test("d173PoisonedSetOnPromptChange (a): every model caller is listed, and the untrusted ones fence", () => {
  const callers = [...walk("services"), ...walk("routes"), "server.js"]
    .filter(f => f !== "services/modelGateway.js" && f !== "services/modelCall.js")
    .filter(f => /\bcallTask\(\{/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(callers.sort(), Object.keys(MODEL_CALLERS).sort(), "a new model call: list it in MODEL_CALLERS with what it sends");
  for (const [f, c] of Object.entries(MODEL_CALLERS)) {
    if (c.carries === "untrusted") assert.match(fs.readFileSync(f, "utf8"), c.fence, `${f} fences ${c.what}`);
  }
});

test("d173PoisonedSetOnPromptChange (b): the whole poisoned set lands inside the fence, stripped, under the rule", () => {
  for (const p of POSTINGS) {
    const jd = p.text ?? htmlToText(p.html);
    const r = buildCoverLetterRequest({ resumeText: OWN_RESUME, targetLine: "Engineer", jobDescription: jd, toneDesc: "formal" });
    assert.ok(r.system.includes(UNTRUSTED_DATA_RULE), p.id);
    const body = r.messages[0].content;
    assert.ok(!body.includes(ZW) && !body.includes(TAG_A), `${p.id}: no invisible characters reach the model`);
    const inside = body.slice(at(body, "<untrusted_posting>"), at(body, "</untrusted_posting>"));
    const outside = body.replace(inside, "");
    assert.equal(body.match(/<\/untrusted_posting>/g).length, 1, `${p.id}: one closing tag`);
    for (const line of r.untrusted.split("\n").map(s => s.trim()).filter(s => s.length > 12 && !/untrusted_/.test(s))) {
      assert.ok(!outside.includes(line), `${p.id}: "${line}" appears outside the fence`);
    }
  }
});

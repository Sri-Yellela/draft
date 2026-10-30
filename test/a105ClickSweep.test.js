import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⭐ A105 (owner 10-30: "our product is time") — the click sweep's fixes, one test per finding.

// A105 finding 3 — recording a submission keeps the job: History → Pending opens THAT row's form.
test("A105 (3) · History's 'Record the submission' opens that job's form in Pending; 'I submitted it' is on every posting", () => {
  const db = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");
  const pending = fs.readFileSync("client/src/components/PendingApplications.jsx", "utf8");
  assert.match(db, /onOpenPending=\{\(jobId\) => \{ setPendingFocus\(jobId \|\| null\); setActiveSheet\("pending"\); \}\}/);
  assert.match(db, /focusJobId=\{pendingFocus\}/);
  assert.match(pending, /const \[open, setOpen\] = useState\(focusJobId\);/);
  assert.match(pending, /scrollIntoView/);
});

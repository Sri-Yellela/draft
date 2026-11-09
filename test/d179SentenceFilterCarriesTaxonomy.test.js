// ⭐ D179 (a) — the test the spec named, written in 45o with A145: the filter sentence carries the taxonomy as the approved
// sketch draws it — "discovering [Backend · Software engineering] roles … in [Boston], using [Go], at companies that have
// sponsored H-1B" — each part opening its own picker with true counts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sentenceText, sentenceParts, roleWord, TECHNOLOGY, OPEN_SET_CLAUSES, SENTENCE_CLAUSES } from "../shared/filterSentence.js";

test("D179 (a) · the role word reads subcategory · category; a name that carries its category reads alone", () => {
  assert.equal(roleWord({ label: "Backend", group: "Software engineering" }), "Backend · Software engineering");
  assert.equal(roleWord({ label: "Software engineering · general", group: "Software engineering" }), "Software engineering · general");
  assert.equal(roleWord(null), null);
  assert.equal(sentenceText({ role_label: "Backend · Software engineering" }),
    "discovering Backend · Software engineering roles at all career levels and all workstyles in the United States.");
});

test("D179 (a) · \"using [Go]\" is a clause of its own — optional, an open set with a find box, after the place", () => {
  const tech = SENTENCE_CLAUSES.find((c) => c.key === "tech");
  assert.ok(tech && !tech.permanent && tech.dim === TECHNOLOGY);
  assert.ok(OPEN_SET_CLAUSES.includes("tech"));
  assert.ok(TECHNOLOGY.options.some((o) => o.value === "Go"));
  assert.equal(sentenceParts({}).slots.some((s) => s.key === "tech"), false, "absent until set");
  assert.equal(sentenceText({ tech: "Go", company_sponsorship: "filed" }),
    "discovering all roles at all career levels and all workstyles in the United States, using Go, at companies that have sponsored H-1B.");
});

test("D179 (a) · the facets count technologies from job_tech in one grouped read; the role picker leads the domain panel", () => {
  const facets = fs.readFileSync("services/jobs/boardFacets.js", "utf8");
  assert.match(facets, /key: "tech",\s+remove: \[TECHNOLOGY\.param\]/);
  assert.match(facets, /JOIN job_tech jtt ON jtt\.job_id = sj\.job_id \$\{whereClause\} GROUP BY jtt\.tech/);
  assert.ok(facets.indexOf('key: "tech"') < facets.indexOf('key: "role"'), "the facets' order follows the sentence's clauses, then role");
  const panel = fs.readFileSync("client/src/components/WordPanel.jsx", "utf8");
  assert.match(panel, /<RolePicker params=\{params\} facets=\{facets\} onPatch=\{onPatch\} \/>\s*<div className="fh-addrow" data-domain-kinds="">/);
  assert.doesNotMatch(fs.readFileSync("client/src/components/BoardHeadline.jsx", "utf8"), /onClearTech/, "45l's press-to-clear token is gone");
});

// (12) 45q · D184 B-6's leftover: the PUBLIC /in/<handle> page's experience rows are the shared company object — a link to
// the public company page and the stack its postings show — and an unknown employer stays plain text, never a guess.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { companyLine, renderPublicProfile } from "../routes/publicProfile.js";

test("d184PublicExperienceLinks: a known employer links to /companies/<slug> with its stack and what the row used; unknown stays plain", () => {
  const known = companyLine({ company: "Toast", companyRef: { slug: "toast", name: "Toast", stack: ["React", "TypeScript", "Apache Kafka"], used: ["React", "TypeScript"] } });
  assert.match(known, /<a href="\/companies\/toast" data-company-link="">Toast<\/a>/);
  assert.match(known, /Toast works with React, TypeScript, Apache Kafka — used React, TypeScript there/);
  assert.equal(companyLine({ company: "Suffolk <Construction>", companyRef: null }), "Suffolk &lt;Construction&gt;", "escaped, no link, no stack");
  const noStack = companyLine({ company: "Acme", companyRef: { slug: "acme", name: "Acme", stack: [], used: [] } });
  assert.ok(!/works with/.test(noStack), "nothing said when the company's postings show no stack");
  const html = renderPublicProfile({ handle: "maya", view: { header: { name: "Maya" }, sections: { experience: { items: [
    { title: "Engineer", company: "Toast", companyRef: { slug: "toast", name: "Toast", stack: ["React"], used: ["React"] } }] } } } });
  assert.match(html, /data-company-link/);
  const route = fs.readFileSync(new URL("../routes/publicProfile.js", import.meta.url), "utf8");
  assert.ok(route.includes("experienceEntities(db, out.view.sections.experience.items)"), "the one resolver (B-6), on the public route");
});

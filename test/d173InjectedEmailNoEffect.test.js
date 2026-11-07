// ⛔ D173 (1) · an email that gives orders has no effect. The inbox is RULES, no model (D17) — so the attack surface is
// hidden text planting a code or flipping a category. Hidden parts are removed before the mail is stored, filed or read.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bodyText, categorise, codeOf } from "../services/inbox.js";
import { EMAILS } from "./fixtures/d173Poisoned.js";

const byId = (id) => EMAILS.find(e => e.id === id);

test("d173InjectedEmailNoEffect: a hidden second code is never the one read", () => {
  const e = byId("hidden_code");
  const body = bodyText({ html: e.html });
  assert.doesNotMatch(body, /000000|Ignore/);
  assert.equal(codeOf({ subject: e.subject, body }), e.expectCode);
});

test("d173InjectedEmailNoEffect: hidden text cannot flip the category", () => {
  const e = byId("hidden_category_flip");
  const poisoned = categorise({ subject: e.subject, body: bodyText({ html: e.html }), fromDomain: "greenhouse.io" });
  const clean = categorise({ subject: e.subject, body: bodyText({ html: e.expectCategoryAsClean }), fromDomain: "greenhouse.io" });
  assert.deepEqual(poisoned, clean);
  assert.notEqual(poisoned.category, "offer");
});

test("d173InjectedEmailNoEffect: a visible order is stored as text and does nothing — no model reads the inbox", () => {
  const e = byId("visible_order");
  const body = bodyText({ html: e.html });
  assert.match(body, /forward the candidate/, "kept as the person's mail — it is data");
  assert.equal(categorise({ subject: e.subject, body, fromDomain: "example.com" }).category === "offer", false);
  for (const f of ["services/inbox.js", "services/gmail.js"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(src, /callTask|callModel|modelGateway|messages\.create/, `${f} calls no model (D17) — if one is added, fence the mail (services/untrustedText.js)`);
  }
});

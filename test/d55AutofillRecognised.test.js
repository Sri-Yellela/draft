// D55 (l) — "this form isn't recognised": say so and stop, rather than half-filling (§8.3).
// Run for real by scripts/d55AutofillWorkday.mjs on fakeAts /gated/signin.

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

import { formRecognition } from "../extension/gated-handoff.js";

const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const f = (over) => ({ index: 0, name: null, id: null, type: "text", label: "", required: false, options: null, ...over });

test("(l) nothing in the packet matching anything is not recognised", () => {
  assert.equal(formRecognition({ fields: [f({ label: "Favourite colour" }), f({ index: 1, label: "Pet's name" })] }, []).recognised, false);
});

test("(l) a sign-in form the packet barely matches is NOT an application — the extension never signs in", () => {
  const shape = { fields: [f({ name: "email", type: "email", label: "Email" }), f({ index: 1, name: "password", type: "password", label: "Password" })] };
  const r = formRecognition(shape, [{ index: 0, name: "email" }]);
  assert.equal(r.recognised, false);
  assert.match(r.why, /sign-in form/);
});

test("(l) one match among many fields is a half-fill, refused; two or more is a form we know", () => {
  const fields = [f({ name: "email" }), f({ index: 1, name: "q1" }), f({ index: 2, name: "q2" }), f({ index: 3, name: "q3" })];
  assert.equal(formRecognition({ fields }, [{ index: 0 }]).recognised, false);
  assert.equal(formRecognition({ fields }, [{ index: 0 }, { index: 1 }]).recognised, true);
  assert.equal(formRecognition({ fields: [f({ name: "email" })] }, [{ index: 0 }]).recognised, true,
    "a one-field page whose one field matched is recognised");
});

test("(l) a known adapter is recognised on any step, even one the packet has nothing for", () => {
  assert.equal(formRecognition({ wizard: { step: "Voluntary Disclosures" }, fields: [f({ label: "Gender" })] }, []).recognised, true);
  assert.equal(formRecognition({ fields: [f({ automationId: "legalNameSection_firstName" })] }, []).adapter, "workday");
});

test("(l) the refusal happens BEFORE anything is typed, and says so on the page", () => {
  const fill = src.slice(at(src, "async function fillFromPacket("), at(src, "async function captureFormSchema("));
  const refusal = fill.indexOf("reason: 'form_not_recognised'");
  assert.ok(refusal > 0 && refusal < fill.indexOf("func: applyPlan,"), "recognition must be decided before the fill injects");
  assert.match(fill, /await showBadge\(tab\.id, 'unrecognised', \{ note: recognition\.why \}\)/);
  assert.match(fill, /This form isn't recognised — nothing was filled\./);
});

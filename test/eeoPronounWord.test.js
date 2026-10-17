// Agent open item 6 (WORKLOG 43k) · LIVE (Lever, 10-15, docs/LIVE_FORM_MEASUREMENT.md): "Name Pronunciation" read as EEO,
// because questionKind matched the letters "pronoun" inside "pronounce". A pronouns question is EEO; a question about
// how to say a name is not.
import test from "node:test";
import assert from "node:assert/strict";

const { questionKind } = await import("../extension/gated-handoff.js");

test("a name-pronunciation question is NOT an EEO question", () => {
  for (const q of ["Name Pronunciation", "How do you pronounce your name?", "Pronunciation of your name (optional)"]) {
    assert.notEqual(questionKind(q), "eeo", q);
  }
});

test("a pronouns question still IS an EEO question", () => {
  for (const q of ["Pronouns", "What are your pronouns?", "Preferred pronoun", "Personal pronouns (optional)"]) {
    assert.equal(questionKind(q), "eeo", q);
  }
});
